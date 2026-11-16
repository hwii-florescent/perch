//! Perch native client: one window onto a running perch-core.
//!
//! Finds the core a headless run published in `core.json` (`PERCHD_DIR`, else `~/.perch/daemon`)
//! and looks again after it restarts. `PERCH_NATIVE_TEST=1` opens the window without focus and
//! sets it up from a script (`test_mode.rs`).

use futures::StreamExt;
use gpui::{
    point, prelude::*, px, size, App, Bounds, TitlebarOptions, WindowBounds, WindowOptions,
};
use perch_native::client::{follow, Core, Update};
use perch_native::sidebar::{Heard, Model, Toast};
use perch_native::ui::Workspace;
use perch_native::{notify, shell, sound};
use std::time::Duration;

mod test_mode;

fn main() {
    let test = match test_mode::TestMode::from_env() {
        Ok(test) => test,
        Err(error) => {
            eprintln!("perch-native: {error}");
            std::process::exit(2);
        }
    };
    let (command_tx, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, mut update_rx) = futures::channel::mpsc::unbounded();
    // GPUI owns the main thread; the core connection runs on its own runtime.
    std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("could not start the connection runtime")
            .block_on(follow(
                || Core::discover(&perchd::server::default_dir()),
                command_rx,
                update_tx,
                Duration::from_secs(2),
            ));
    });
    gpui_platform::application().run(move |cx: &mut App| {
        let (opened_tx, mut opened_rx) = futures::channel::mpsc::unbounded();
        notify::init(opened_tx);
        let (width, height) = test.as_ref().and_then(|t| t.size).unwrap_or((1100., 720.));
        let bounds = Bounds::centered(None, size(px(width), px(height)), cx);
        let window = cx
            .open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    // The window draws its own title row (the sidebar card's head); the system's
                    // lights sit inside it, as the Tauri app places them.
                    titlebar: Some(TitlebarOptions {
                        title: Some("Perch".into()),
                        appears_transparent: true,
                        traffic_light_position: Some(point(
                            px(shell::LIGHTS_LEFT),
                            px(shell::LIGHTS_TOP),
                        )),
                    }),
                    // The window moves only from its heads' empty space (`shell::drags_window`):
                    // AppKit's own title bar drag would take presses on the tab strip there.
                    app_owns_titlebar_drag: true,
                    // A test window is ordered in without taking the keyboard, and the app is
                    // never activated.
                    focus: test.is_none(),
                    show: !test.as_ref().is_some_and(|t| t.hidden),
                    ..Default::default()
                },
                |_, cx| {
                    cx.new(|cx| {
                        Workspace::new(Model::default(), Some(command_tx), cx)
                            .with_core(|| Core::discover(&perchd::server::default_dir()))
                            .with_window_state(perch_native::mods::user_dir().join(".window.json"))
                            .with_browser_file(perch_native::mods::user_dir().join(".browser.json"))
                    })
                },
            )
            .expect("could not open the window");
        let workspace = window.update(cx, |_, _, cx| cx.entity()).expect("window");
        // Drafts not yet in the core's buffers go before the window or the app does.
        window
            .update(cx, |_, window, cx| {
                let flushing = workspace.clone();
                window.on_window_should_close(cx, move |_, cx| {
                    flushing.update(cx, |workspace, cx| workspace.flush_drafts(cx));
                    true
                });
                cx.on_app_quit(|workspace, cx| {
                    workspace.flush_drafts(cx);
                    // The client's task sends the frames: give it a moment before the app goes.
                    cx.background_executor().timer(Duration::from_millis(100))
                })
                .detach();
            })
            .expect("window");
        perch_native::mods::start(&workspace, window.into(), cx);
        // A scripted run is watched, not listened to: it makes no sound and posts no notification.
        let silent = test.is_some();
        if let Some(test) = test {
            cx.spawn(async move |cx| test_mode::run(test.steps, window, cx).await)
                .detach();
        }
        // A clicked notification brings the window forward on the session it is about.
        cx.spawn(async move |cx| {
            while let Some(id) = opened_rx.next().await {
                let _ = window.update(cx, |workspace, window, cx| {
                    cx.activate(true);
                    window.activate_window();
                    if id != perch_native::sidebar::USAGE_NOTIFICATION {
                        let _ = workspace.show_session(&id, cx);
                    }
                });
            }
        })
        .detach();
        cx.spawn(async move |cx| {
            while let Some(update) = update_rx.next().await {
                // A sound is due: play it here, not in the view, so no test ever does.
                if let Update::Alert(heard) = update {
                    announce(
                        heard,
                        silent,
                        notify::available(),
                        sound::play,
                        notify::show,
                    );
                    continue;
                }
                if let Update::Review(message) = update {
                    let _ = cx.update(|cx| {
                        if let Some(git) = perch_native::git::host(cx) {
                            git.on_delivery(&message, cx);
                        }
                    });
                    continue;
                }
                if let Update::Files(message) = update {
                    workspace.update(cx, |workspace, cx| workspace.on_files_message(&message, cx));
                    continue;
                }
                let sidebar = workspace.read_with(cx, |workspace, _| workspace.sidebar().clone());
                sidebar.update(cx, |sidebar, cx| sidebar.apply(update, cx));
            }
        })
        .detach();
    });
}

/// What a due alert does: its sound and its system notification are for a person, so `silent`
/// (a scripted test run) skips both. The desktop client never toasts in its window (that is the
/// phone's); without a bundle (`bundled` false) a system notification would carry another app's
/// name, so nothing is posted. Whatever the delivery, "app" or "system", it is a system
/// notification; only "off" posts none.
fn announce(
    heard: Heard,
    silent: bool,
    bundled: bool,
    play: impl FnOnce(&Heard),
    show: impl FnOnce(&str, &str, &str),
) {
    if silent {
        return;
    }
    play(&heard);
    if bundled && heard.toast != Toast::Off {
        let (title, body) = heard.system_note();
        show(&title, &body, &heard.session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_native::sidebar::Alert;
    use std::cell::{Cell, RefCell};

    fn heard(toast: Toast) -> Heard {
        Heard {
            alert: Alert::Done,
            sound: true,
            file: None,
            toast,
            session_id: "s".into(),
            title: "t".into(),
            body: None,
        }
    }

    /// How many times it played, and what it posted.
    fn run(heard: Heard, silent: bool, bundled: bool) -> (u32, Vec<(String, String, String)>) {
        let (played, shown) = (Cell::new(0), RefCell::new(Vec::new()));
        announce(
            heard,
            silent,
            bundled,
            |_| played.set(played.get() + 1),
            |title, body, id| {
                shown
                    .borrow_mut()
                    .push((title.into(), body.into(), id.into()))
            },
        );
        (played.get(), shown.take())
    }

    fn note(title: &str, body: &str, id: &str) -> Vec<(String, String, String)> {
        vec![(title.into(), body.into(), id.into())]
    }

    #[test]
    fn a_session_finishing_posts_the_tauri_apps_notification() {
        assert_eq!(
            run(heard(Toast::System), false, true),
            (1, note("Session finished", "t", "s"))
        );
        let mut blocked = heard(Toast::System);
        blocked.alert = Alert::Blocked;
        assert_eq!(
            run(blocked.clone(), false, true).1,
            note("Session needs attention", "t", "s")
        );
        blocked.title.clear();
        assert_eq!(
            run(blocked, false, true).1,
            note("Session needs attention", "(untitled session)", "s")
        );
        let mut usage = heard(Toast::System);
        (usage.alert, usage.session_id) = (Alert::Usage, "usage".into());
        usage.body = Some("Resets in 42 minutes".into());
        assert_eq!(
            run(usage, false, true).1,
            note("t", "Resets in 42 minutes", "usage")
        );
    }

    #[test]
    fn every_delivery_but_off_is_a_system_notification_never_a_window_toast() {
        assert_eq!(run(heard(Toast::App), false, true).1.len(), 1);
        assert_eq!(run(heard(Toast::System), false, true).1.len(), 1);
        assert_eq!(
            run(heard(Toast::Off), false, true),
            (1, vec![]),
            "off keeps the sound only"
        );
    }

    #[test]
    fn without_a_bundle_or_in_a_test_run_nothing_is_posted() {
        for toast in [Toast::App, Toast::System, Toast::Off] {
            assert_eq!(run(heard(toast), false, false), (1, vec![]), "unbundled");
            assert_eq!(run(heard(toast), true, true), (0, vec![]), "a test run");
        }
    }
}
