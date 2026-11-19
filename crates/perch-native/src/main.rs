//! Perch native client: one window onto a running perch-core.
//!
//! Finds the core a headless run published in `core.json` (`PERCHD_DIR`, else `~/.perch/daemon`)
//! and looks again after it restarts. Installed as the Perch app (`perch.app`, with `perch-core`
//! beside it in `Contents/MacOS`), it starts that core when none is running, as the Tauri app ran
//! its own. `PERCH_NATIVE_TEST=1` opens the window without focus and sets it up from a script
//! (`test_mode.rs`).

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
    if test.is_none() {
        start_bundled_core();
    }
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
    // `perch://` links are handed to the app, possibly before its window exists: they queue here
    // until the window takes them (`Workspace::open_link` holds one until the core answers).
    let (link_tx, mut link_rx) = futures::channel::mpsc::unbounded();
    let app = gpui_platform::application();
    app.on_open_urls(move |urls| {
        urls.into_iter()
            .for_each(|url| drop(link_tx.unbounded_send(url)))
    });
    app.run(move |cx: &mut App| {
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
            while let Some(url) = link_rx.next().await {
                let _ = window.update(cx, |workspace, window, cx| {
                    cx.activate(true);
                    window.activate_window();
                    workspace.open_link(&url, window, cx);
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
                if let Update::Health(health) = update {
                    workspace.update(cx, |workspace, cx| workspace.daemon_health(&health, cx));
                    continue;
                }
                if let Update::Review(message) = update {
                    cx.update(|cx| {
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

/// The Tauri app's port, kept so the core's address (and what the phone and the web keyed by it)
/// stays the same when the native app takes over.
const APP_PORT: &str = "47788";

/// The `perch-core` shipped beside `exe` (`perch.app/Contents/MacOS/`), if there is one.
fn bundled_core(exe: &std::path::Path) -> Option<std::path::PathBuf> {
    Some(exe.parent()?.join("perch-core")).filter(|core| core.is_file())
}

/// Starts the `perch-core` shipped beside this executable when no core is running. It runs in its
/// own process group, as the terminal daemon does, so closing the window leaves the phone and the
/// terminals served; the next launch finds it through `core.json`. A development build has no
/// `perch-core` beside it and starts nothing.
/// ponytail: a core started here outlives the app; stop it with the app once there is a Quit.
fn start_bundled_core() {
    use std::os::unix::process::CommandExt;
    use std::process::{Command, Stdio};
    let dir = perchd::server::default_dir();
    if perchd::agent_cli::read_core_file(&dir).is_ok() {
        return;
    }
    let Some(core) = std::env::current_exe()
        .ok()
        .and_then(|exe| bundled_core(&exe))
    else {
        return;
    };
    let log = std::fs::create_dir_all(&dir).and_then(|_| {
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("core.log"))
    });
    let mut start = Command::new(&core);
    // A launch from a Perch terminal must not hand that terminal's identity to the core.
    for name in ["PERCH_SESSION", "PERCH_TOKEN", "PERCH_SHELL"] {
        start.env_remove(name);
    }
    if std::env::var_os("PERCH_PORT").is_none() {
        start.env("PERCH_PORT", APP_PORT);
    }
    start
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(log.map_or_else(|_| Stdio::null(), Stdio::from));
    if let Err(error) = start.spawn() {
        eprintln!("perch-native: could not start {}: {error}", core.display());
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

    #[test]
    fn only_a_core_shipped_beside_the_app_is_started() {
        let dir = std::env::temp_dir().join(format!("perch-bundle-{}", std::process::id()));
        let macos = dir.join("perch.app/Contents/MacOS");
        std::fs::create_dir_all(&macos).unwrap();
        let exe = macos.join("perch-native");
        assert_eq!(
            bundled_core(&exe),
            None,
            "a development build starts nothing"
        );
        std::fs::write(macos.join("perch-core"), "").unwrap();
        assert_eq!(bundled_core(&exe), Some(macos.join("perch-core")));
        std::fs::remove_dir_all(&dir).unwrap();
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
