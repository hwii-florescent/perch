//! Perch native client: one window onto a running perch-core.
//!
//! Finds the core a headless run published in `core.json` (`PERCHD_DIR`, else `~/.perch/daemon`).

use gpui::{prelude::*, px, size, App, Bounds, WindowBounds, WindowOptions};
use perch_native::client::{Core, Snapshot};
use perch_native::ui::{Load, Workspace};

fn main() {
    let (tx, rx) = futures::channel::oneshot::channel();
    // GPUI owns the main thread; the core connection runs on its own runtime.
    std::thread::spawn(move || {
        let result = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(anyhow::Error::from)
            .and_then(|runtime| runtime.block_on(fetch()));
        let _ = tx.send(result.map_err(|e| format!("{e:#}")));
    });
    gpui_platform::application().run(move |cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(1100.), px(720.)), cx);
        let window = cx
            .open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                |_, cx| {
                    cx.new(|_| Workspace {
                        load: Load::Loading,
                    })
                },
            )
            .expect("could not open the window");
        let view = window.update(cx, |_, _, cx| cx.entity()).expect("window");
        cx.spawn(async move |cx| {
            let load = match rx.await {
                Ok(Ok(snapshot)) => Load::Ready(snapshot),
                Ok(Err(error)) => Load::Failed(error),
                Err(_) => Load::Failed("the connection thread ended".into()),
            };
            view.update(cx, |workspace, cx| {
                workspace.load = load;
                cx.notify();
            });
        })
        .detach();
    });
}

async fn fetch() -> anyhow::Result<Snapshot> {
    let core = Core::discover(&perchd::server::default_dir())?;
    core.connect().await?.snapshot().await
}
