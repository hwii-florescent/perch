//! Tabs dragged back and forth along the strip, against a real core that keeps the order and the
//! shared tabs and sends them back: after every drop each tab's slot, button, label and close
//! button are drawn where the strip lays it, none over another, nothing left slid aside.
//!
//! A drop is the moment the slide ends, and in a window with working agents something else moves
//! between the frame that sees the drag end and the strip's catch-up (a session's new title): the
//! test moves another part of the window's data there, so the end of the slide must survive it.
//!
//! The core and the teardown are in `common`: the core is a child of this test with everything it
//! touches private to a scratch directory. No window is shown or focused; the pointer goes
//! through the window's own dispatch.

mod common;

use common::{Harness, Rig};
use gpui::{
    point, px, Modifiers, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PlatformInput,
    Window,
};
use gpui_shell::probe;
use perch_native::client::{follow, Command as Order};
use perch_native::mods::{self, WindowMods, POLL};
use serde_json::json;
use std::time::Duration;

fn main() {
    common::run("tab_strip_overlap_window", window);
}

/// Each tab's slot (`[data-tab-entry]`) as drawn, in the strip's order, and the parts of tabs
/// drawn outside their own slot (button, label, close button).
fn drawn(h: &mut Harness) -> (Vec<(String, f32, f32)>, Vec<String>) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    let records = probe::records();
    let span = |name: String| {
        records.values().find(|r| r.name == name).map(|r| {
            let x = f32::from(r.bounds.origin.x);
            (x, x + f32::from(r.bounds.size.width))
        })
    };
    let strip = h.ws(|ws, _| ws.tabs().strip().to_vec());
    let mut slots = Vec::new();
    let mut astray = Vec::new();
    for id in &strip {
        let Some((l, r)) = span(format!("tab-slot:{id}")) else {
            continue;
        };
        slots.push((id.clone(), l, r));
        for part in ["tab", "tab-label", "tab-close"] {
            match span(format!("{part}:{id}")) {
                Some((pl, pr)) if pl >= l - 0.5 && pr <= r + 0.5 => {}
                found => astray.push(format!("{part}:{id} at {found:?}, slot {l}..{r}")),
            }
        }
    }
    (slots, astray)
}

/// One frame: the window's work, the strip's catch-up timer, a draw.
fn frame(h: &mut Harness) {
    h.cx.run_until_parked();
    h.cx.advance_clock(POLL);
    h.cx.run_until_parked();
    h.draw();
}

fn input(h: &mut Harness, input: PlatformInput) {
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.dispatch_event(input, cx);
    })
    .unwrap();
    h.cx.run_until_parked();
}

/// A left press on `id`'s tab, moved `out` and then back to `dx`, let go there.
fn drag(h: &mut Harness, id: &str, out: f32, dx: f32, n: usize) {
    let (tabs, _) = drawn(h);
    let (_, l, r) = tabs.iter().find(|t| t.0 == id).unwrap().clone();
    let (x, y) = ((l + r) / 2., 20.);
    let at = |x: f32| point(px(x), px(y));
    input(
        h,
        PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: at(x),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }),
    );
    frame(h);
    let path = (1..=6)
        .map(|k| 8. + (out - 8.) * k as f32 / 6.)
        .chain((1..=6).map(|k| out + (dx - out) * k as f32 / 6.));
    for step in path {
        input(
            h,
            PlatformInput::MouseMove(MouseMoveEvent {
                position: at(x + step),
                pressed_button: Some(MouseButton::Left),
                modifiers: Modifiers::default(),
            }),
        );
        frame(h);
    }
    // The release, the frame that sees the drag end (it queues the strip's catch-up), and
    // something else moving before that catch-up runs, as a working session's title does.
    let release = PlatformInput::MouseUp(MouseUpEvent {
        button: MouseButton::Left,
        position: at(x + dx),
        modifiers: Modifiers::default(),
        click_count: 1,
    });
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        window.dispatch_event(release, cx);
    })
    .unwrap();
    h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
        let _ = window.draw(cx);
        let perch = cx.global::<WindowMods>().perch.clone();
        perch.set_props("tab-strip-overlap-test", json!(n));
        perch.flush(cx);
    })
    .unwrap();
    frame(h);
}

fn window(rig: &mut Rig) {
    let folder = rig.scratch.join("project");
    std::fs::create_dir_all(&folder).unwrap();
    let folder = folder.to_string_lossy().to_string();
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .unwrap();
    let (_, core) = rig.start_core(&runtime);
    let sessions: Vec<String> = runtime.block_on(async {
        let mut connection = core.connect().await.expect("connect");
        connection.create_project(&folder).await.expect("project");
        let mut ids = Vec::new();
        for _ in 0..4 {
            let id = connection
                .create_session(Some(&folder), None)
                .await
                .expect("create");
            let terminal = connection
                .open_terminal(&id, 80, 24)
                .await
                .expect("open terminal");
            connection.release_terminal(&terminal).await.unwrap();
            ids.push(id);
        }
        ids
    });

    let (commands, command_rx) = futures::channel::mpsc::unbounded();
    let (update_tx, updates) = futures::channel::mpsc::unbounded();
    let locate = core.clone();
    let follower = runtime.spawn(follow(
        move || Ok(locate.clone()),
        command_rx,
        update_tx,
        Duration::from_millis(100),
    ));
    let mut h = Harness::new(core, commands, updates);
    let workspace = h.window.entity(&h.cx).unwrap();
    let user = rig.scratch.join("native-mods");
    let handle = h.window.into();
    h.cx.update(|cx| mods::start_in(user, &workspace, handle, cx));

    h.wait("the sessions listed", |h| {
        h.ws(|ws, cx| {
            let store = &ws.sidebar().read(cx).model().store;
            sessions.iter().all(|id| {
                store
                    .sessions
                    .iter()
                    .any(|s| s.id == *id && s.workspace_id.is_some())
            })
        })
    });
    // Titles of different lengths, so a label drawn in another tab's slot shows on a shot.
    for (n, id) in sessions.iter().enumerate() {
        h.send(Order::Rename {
            session_id: id.clone(),
            title: format!("{n} {}", "tab title ".repeat(n + 1)),
        });
    }
    h.show_tab(&sessions[0]);
    h.wait("every tab drawn with its title", |h| {
        let titled = h.ws(|ws, cx| {
            let store = &ws.sidebar().read(cx).model().store;
            sessions.iter().all(|id| {
                store
                    .sessions
                    .iter()
                    .any(|s| s.id == *id && s.title.contains("tab title"))
            })
        });
        titled && drawn(h).0.len() == sessions.len()
    });

    let width = {
        let (tabs, _) = drawn(&mut h);
        tabs[0].2 - tabs[0].1
    };
    // (tab, how far out, where it is let go), in slot widths: there and back, past the ends,
    // dropped where it started.
    let plan: [(usize, f32, f32); 8] = [
        (1, 1.2, 1.2),
        (3, -2.2, -2.2),
        (0, 2.2, 0.),
        (2, -1.5, 1.2),
        (3, -3.2, -3.2),
        (1, 2.5, -0.6),
        (0, 1.2, 0.),
        (2, -1.2, 0.1),
    ];
    for (n, (index, out, dx)) in plan.into_iter().enumerate() {
        let id = h.ws(|ws, _| ws.tabs().strip()[index].clone());
        drag(&mut h, &id, out * width, dx * width, n);
        // The core keeps the order and the shared tabs and sends them back.
        h.settle();
        let (tabs, astray) = drawn(&mut h);
        if let Ok(dir) = std::env::var("SHOT") {
            h.cx.update_window(h.window.into(), |_, window: &mut Window, _| {
                let image = window.render_to_image().unwrap();
                image
                    .save(std::path::Path::new(&dir).join(format!("tab-strip-drag-{n}.png")))
                    .unwrap();
            })
            .unwrap();
        }
        assert_eq!(
            tabs.len(),
            sessions.len(),
            "drag {n}: every tab is drawn: {tabs:?}"
        );
        assert!(
            astray.is_empty(),
            "drag {n}: parts of tabs outside their slot: {astray:#?}"
        );
        for pair in tabs.windows(2) {
            assert!(
                (pair[1].1 - pair[0].2 - 3.).abs() < 1.,
                "drag {n}: {} and {} are not side by side in the strip's order: {tabs:?}",
                pair[0].0,
                pair[1].0
            );
        }
    }

    h.close();
    follower.abort();
    drop(runtime);
}
