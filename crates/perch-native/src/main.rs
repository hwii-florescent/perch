//! Perch native client: one window onto a running perch-core.
//!
//! Finds the core a headless run published in `core.json` (`PERCHD_DIR`, else `~/.perch/daemon`)
//! and looks again after it restarts.

use futures::StreamExt;
use gpui::{prelude::*, px, size, App, Bounds, WindowBounds, WindowOptions};
use perch_native::client::{follow, Core, Update};
use perch_native::sidebar::Model;
use perch_native::sound;
use perch_native::ui::Workspace;
use std::time::Duration;

fn main() {
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
        let bounds = Bounds::centered(None, size(px(1100.), px(720.)), cx);
        let window = cx
            .open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                |_, cx| cx.new(|cx| Workspace::new(Model::default(), Some(command_tx), cx)),
            )
            .expect("could not open the window");
        let workspace = window.update(cx, |_, _, cx| cx.entity()).expect("window");
        cx.spawn(async move |cx| {
            while let Some(update) = update_rx.next().await {
                // A sound is due: play it here, not in the view, so no test ever does.
                if let Update::Alert(alert) = update {
                    sound::play(alert);
                    continue;
                }
                let sidebar = workspace.read_with(cx, |workspace, _| workspace.sidebar().clone());
                sidebar.update(cx, |sidebar, cx| sidebar.apply(update, cx));
            }
        })
        .detach();
    });
}
