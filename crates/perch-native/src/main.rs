//! Perch native client: one window onto a running perch-core.
//!
//! Finds the core a headless run published in `core.json` (`PERCHD_DIR`, else `~/.perch/daemon`)
//! and looks again after it restarts. `PERCH_NATIVE_TEST=1` opens the window without focus and
//! sets it up from a script (`test_mode.rs`).

use futures::StreamExt;
use gpui::{prelude::*, px, size, App, Bounds, WindowBounds, WindowOptions};
use perch_native::client::{follow, Core, Update};
use perch_native::sidebar::{Heard, Model, Toast};
use perch_native::ui::Workspace;
use perch_native::{notify, sound};
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
        let (width, height) = test.as_ref().and_then(|t| t.size).unwrap_or((1100., 720.));
        let bounds = Bounds::centered(None, size(px(width), px(height)), cx);
        let window = cx
            .open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
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
                    })
                },
            )
            .expect("could not open the window");
        let workspace = window.update(cx, |_, _, cx| cx.entity()).expect("window");
        // A scripted run is watched, not listened to: it makes no sound and posts no notification.
        let silent = test.is_some();
        if let Some(test) = test {
            cx.spawn(async move |cx| test_mode::run(test.steps, window, cx).await)
                .detach();
        }
        cx.spawn(async move |cx| {
            while let Some(update) = update_rx.next().await {
                // A sound is due: play it here, not in the view, so no test ever does.
                if let Update::Alert(heard) = update {
                    announce(heard, silent, sound::play, notify::show, |heard| {
                        workspace.update(cx, |workspace, cx| workspace.toast(heard, cx))
                    });
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
/// (a scripted test run) skips both; the window's own toast is not.
fn announce(
    heard: Heard,
    silent: bool,
    play: impl FnOnce(&Heard),
    show: impl FnOnce(&str),
    toast: impl FnOnce(Heard),
) {
    if !silent {
        play(&heard);
    }
    match heard.toast {
        Toast::Off => {}
        Toast::System if !silent => show(&heard.text()),
        Toast::System => {}
        Toast::App => toast(heard),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_native::sidebar::Alert;
    use std::cell::Cell;

    fn heard(toast: Toast) -> Heard {
        Heard {
            alert: Alert::Done,
            sound: true,
            file: None,
            toast,
            session_id: "s".into(),
            title: "t".into(),
        }
    }

    /// How many times it played, posted a notification and showed a toast.
    fn run(toast: Toast, silent: bool) -> (u32, u32, u32) {
        let (played, shown, toasted) = (Cell::new(0), Cell::new(0), Cell::new(0));
        announce(
            heard(toast),
            silent,
            |_| played.set(played.get() + 1),
            |_| shown.set(shown.get() + 1),
            |_| toasted.set(toasted.get() + 1),
        );
        (played.get(), shown.get(), toasted.get())
    }

    #[test]
    fn a_test_run_plays_no_sound_and_posts_no_notification() {
        assert_eq!(run(Toast::System, false), (1, 1, 0));
        assert_eq!(run(Toast::System, true), (0, 0, 0));
        assert_eq!(run(Toast::App, true), (0, 0, 1), "the window's toast stays");
        assert_eq!(run(Toast::Off, true), (0, 0, 0));
        assert_eq!(run(Toast::Off, false), (1, 0, 0));
    }
}
