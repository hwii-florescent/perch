//! The native client without a window, for memory measurements while the display sleeps or the console is locked
//! (`scripts/measure-native-memory.sh --offscreen`): the same workspace, mods, core connection and test-mode script as
//! `perch-native` (`PERCH_NATIVE_TEST=1`, `PERCH_NATIVE_SIZE`, `PERCH_NATIVE_SCRIPT`), presented every 16 ms by GPUI's
//! headless Metal renderer into one reused texture. A shown window needs frames from the display, which a sleeping display does
//! not give; this needs none. It holds one render target in place of a real window's
//! drawables (the window server's share), so its footprint is close to, not equal to, a shown window's. Runs until it is stopped.

use gpui::{prelude::*, px, size, HeadlessAppContext};
use perch_native::client::{follow, Core, Update};
use perch_native::sidebar::{Model, Toast};
use perch_native::ui::Workspace;
use std::sync::Arc;
use std::time::Duration;

#[path = "../src/test_mode.rs"]
#[allow(dead_code)]
mod test_mode;

const FRAME: Duration = Duration::from_millis(16);

fn main() {
    let test = match test_mode::TestMode::from_env() {
        Ok(Some(test)) => test,
        Ok(None) => {
            eprintln!("measure_offscreen: set PERCH_NATIVE_TEST=1 (and PERCH_NATIVE_SCRIPT for what to show)");
            std::process::exit(2);
        }
        Err(error) => {
            eprintln!("measure_offscreen: {error}");
            std::process::exit(2);
        }
    };
    let (command_tx, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, mut update_rx) = futures::channel::mpsc::unbounded();
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

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (width, height) = test.size.unwrap_or((1100., 720.));
    let window = cx
        .open_window(size(px(width), px(height)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(Model::default(), Some(command_tx), cx)
                    .with_core(|| Core::discover(&perchd::server::default_dir()))
                    .with_window_state(perch_native::mods::user_dir().join(".window.json"))
                    .with_browser_file(perch_native::mods::user_dir().join(".browser.json"))
            })
        })
        .expect("could not open the offscreen window");
    let workspace = cx.update(|cx| {
        let workspace = window.update(cx, |_, _, cx| cx.entity()).expect("window");
        perch_native::mods::start(&workspace, window.into(), cx);
        let steps = test.steps.clone();
        cx.spawn(async move |cx| test_mode::run(steps, window, cx).await)
            .detach();
        workspace
    });

    // The executor's clock is this loop's: it follows the real one, one frame at a time.
    loop {
        // As `perch-native` hands the follower's updates over, without sounds or system notifications. Read here,
        // not by a spawned task: the test executor that drives this window is not woken from the follower's thread.
        while let Ok(update) = update_rx.try_recv() {
            cx.update(|cx| match update {
                Update::Alert(heard) => {
                    if matches!(heard.toast, Toast::App) {
                        workspace.update(cx, |workspace, cx| workspace.toast(heard, cx));
                    }
                }
                Update::Files(message) => {
                    workspace.update(cx, |workspace, cx| workspace.on_files_message(&message, cx));
                }
                update => {
                    let sidebar = workspace.read(cx).sidebar().clone();
                    sidebar.update(cx, |sidebar, cx| sidebar.apply(update, cx));
                }
            });
        }
        cx.run_until_parked();
        // Draws what changed and renders it on the GPU into one reused target, as a display's frame would.
        if let Err(error) = cx.present(window.into()) {
            eprintln!("measure_offscreen: {error}");
            std::process::exit(1);
        }
        cx.advance_clock(FRAME);
        std::thread::sleep(FRAME);
    }
}
