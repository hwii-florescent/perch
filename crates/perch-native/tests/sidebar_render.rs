//! Renders the window offscreen with fake sessions and checks the sidebar shows them.
//!
//! GPUI's test platform draws through the real Metal renderer into a texture
//! (`Window::render_to_image`); no window is created, shown or focused. This is its own
//! binary with a custom `main`, as Zed's headless tests are, so AppKit runs on the main thread.

use gpui::{px, size, AppContext, HeadlessAppContext, Window};
use perch_core::protocol::{ProjectSummary, SessionSummary};
use perch_native::client::Snapshot;
use perch_native::ui::{Load, Workspace, SIDEBAR_WIDTH};
use std::sync::Arc;

fn project(id: &str, name: &str) -> ProjectSummary {
    serde_json::from_value(serde_json::json!({
        "id": id, "hostId": "local", "name": name, "path": "/work", "favorite": false,
        "createdAt": 0, "updatedAt": 0,
    }))
    .unwrap()
}

fn session(title: &str, project_id: &str) -> SessionSummary {
    serde_json::from_value(serde_json::json!({
        "id": title, "title": title, "cwd": "/work", "createdAt": 0, "status": "idle",
        "projectId": project_id,
    }))
    .unwrap()
}

/// What the sidebar and the main area show for `titles`: the number of title-colored pixels in each.
fn bright_pixels(cx: &mut HeadlessAppContext, titles: &[&str]) -> (usize, usize, Vec<u8>) {
    let snapshot = Snapshot {
        projects: vec![project("p", "Work")],
        sessions: titles.iter().map(|t| session(t, "p")).collect(),
    };
    let window = cx
        .open_window(size(px(640.), px(360.)), |_, cx| {
            cx.new(|_| Workspace {
                load: Load::Ready(snapshot),
            })
        })
        .unwrap();
    let image = cx
        .update_window(window.into(), |_, window: &mut Window, cx| {
            let _ = window.draw(cx);
            (
                window.render_to_image().expect("offscreen render"),
                window.scale_factor(),
            )
        })
        .unwrap();
    let (image, scale) = image;
    let edge = (SIDEBAR_WIDTH * scale) as u32;
    let (mut sidebar, mut main) = (0, 0);
    for (x, _, pixel) in image.enumerate_pixels() {
        // Title text is near-white; the background and the dim hints never get this bright.
        if pixel.0[..3].iter().all(|channel| *channel >= 0xc0) {
            if x < edge {
                sidebar += 1;
            } else {
                main += 1;
            }
        }
    }
    (sidebar, main, image.into_raw())
}

fn main() {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (none, none_main, _) = bright_pixels(&mut cx, &[]);
    let (one, one_main, alpha) = bright_pixels(&mut cx, &["alpha"]);
    let (three, _, _) = bright_pixels(&mut cx, &["alpha", "bravo", "charlie"]);
    let (_, _, bravo) = bright_pixels(&mut cx, &["bravo"]);
    assert_eq!(none, 0, "a sidebar with no sessions has no title text");
    assert!(
        one > 20,
        "one session title should be drawn, got {one} pixels"
    );
    assert!(
        three > one,
        "three titles draw more than one ({three} vs {one})"
    );
    assert_eq!(none_main + one_main, 0, "the main area stays quiet");
    assert_ne!(alpha, bravo, "the title text is what differs");
    println!("sidebar_render: ok (title pixels: 0, {one}, {three})");
}
