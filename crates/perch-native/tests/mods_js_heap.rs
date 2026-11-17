//! The mods' script heap stays flat: the stock screens mounted at the owner's shape (10 projects,
//! 44 sessions, 7 tabs, plain terminals listed), then
//!
//! - Settings opened again and again under a script budget so small its first draw is stopped
//!   part-way (as a slow frame is), each time closed and the window changed after: the copies so
//!   stopped are let go, not kept with their whole tree;
//! - a simulated minute of sessions changing status, frame by frame.
//!
//! The QuickJS heap is compared after a full collection. Offscreen, no core.
//! `PERCH_JS_HEAP_SECONDS` lengthens the minute.

use futures::channel::mpsc::unbounded;
use gpui::{px, size, AppContext as _, HeadlessAppContext, Window};
use perch_core::protocol::ServerMessage;
use perch_native::client::Update;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 1400.;
const SESSIONS: usize = 44;
const PROJECTS: usize = 10;
const KIDS: usize = 10;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn project(p: usize) -> Value {
    json!({"id": format!("p{p}"), "hostId": "local", "name": format!("project-{p}"),
           "path": format!("/code/project-{p}"), "favorite": p < 2, "createdAt": p, "updatedAt": 0})
}

/// `tick` moves which sessions are running, so each tick is one status change for the sidebar.
fn state(sessions: usize, tick: usize) -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    let projects: Vec<Value> = (0..PROJECTS).map(project).collect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects})));
    let mut checkouts = vec![];
    for p in 0..PROJECTS {
        for w in 0..(if p < 3 { 2 } else { 1 }) {
            let path = format!("/code/project-{p}{}", if w == 1 { "-wt" } else { "" });
            checkouts.push(
                json!({"id": format!("w{p}-{w}"), "projectId": format!("p{p}"),
                "hostId": "local", "path": path, "name": format!("w{p}-{w}"), "dirty": w == 0,
                "state": "active", "createdAt": 0, "updatedAt": 0, "pinned": false}),
            );
        }
    }
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects, "workspaces": checkouts})));
    let list: Vec<Value> = (0..sessions)
        .map(|n| {
            let p = if n <= KIDS { 0 } else { n % PROJECTS };
            let cwd = format!(
                "/code/project-{p}{}",
                if p < 3 && n % 2 == 1 { "-wt" } else { "" }
            );
            let busy = n == 12 + tick % 20 || n.is_multiple_of(4);
            let mut session = json!({
                "id": format!("s{n}"), "title": format!("Session {n} doing some real work here"),
                "cwd": cwd, "createdAt": n, "status": if busy { "running" } else { "idle" },
                "hostId": "local", "projectId": format!("p{p}"),
                "cliProviderId": if n % 3 == 0 { "codex" } else { "claude" }});
            if (1..=KIDS).contains(&n) {
                session["parentSessionId"] = json!("s0");
            }
            session
        })
        .collect();
    state.apply(&message(json!({"type": "session.list", "sessions": list})));
    state
}

const FRAME: Duration = Duration::from_millis(16);
/// Growth allowed over the status minute, after warm-up: caches and JIT feedback settle well below it.
const BOUND: i64 = 2 * 1024 * 1024;
/// Stopped Settings loads, and the objects they may leave between the first and the last (a
/// stopped copy kept alive is some 130 objects and 24 KB of Settings alone; a whole tree, thousands).
const STOPS: usize = 16;
const STOP_BOUND: i64 = 400;
/// A budget Settings' first draw does not fit in, though loading its module does.
const STOP_BUDGET: Duration = Duration::from_millis(20);

fn main() {
    let seconds: u64 = std::env::var("PERCH_JS_HEAP_SECONDS")
        .ok()
        .and_then(|n| n.parse().ok())
        .unwrap_or(60);
    let scratch = std::env::temp_dir().join(format!("perch-js-heap-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    // What a release build of the app does: no parity names.
    gpui_shell::probe::set_named(false);
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state(SESSIONS, 0).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    let user = scratch.join("native-mods");
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let frame = |cx: &mut HeadlessAppContext, step: Duration| {
        cx.advance_clock(step);
        cx.run_until_parked();
        cx.update_window(window.into(), |_, window: &mut Window, cx| {
            window.refresh();
            let _ = window.draw(cx);
        })
        .unwrap();
    };
    let run = |cx: &mut HeadlessAppContext, name: &str, args: Value| {
        let _ = window.update(cx, |ws, window, cx| {
            ws.run_command(name, Some(&args), window, cx)
        });
        for _ in 0..4 {
            frame(cx, FRAME);
        }
    };
    let show_terminals = |cx: &mut HeadlessAppContext, on: bool| {
        cx.update(|cx| {
            let perch = cx.global::<WindowMods>().perch.clone();
            let mut settings = perch.sidebar();
            settings.show_terminals = on;
            perch.set_sidebar(settings);
            perch.flush(cx);
        });
        for _ in 0..4 {
            frame(cx, FRAME);
        }
    };
    let error = |cx: &mut HeadlessAppContext, id: &str| {
        cx.update_window(window.into(), |_, _, cx| {
            workspace.read(cx).screen_error(id, cx)
        })
        .ok()
        .flatten()
    };
    let heap = |cx: &mut HeadlessAppContext, collect: bool| {
        cx.update(|cx| cx.global::<WindowMods>().host.js_heap(collect))
    };
    for _ in 0..8 {
        frame(&mut cx, POLL);
    }
    for n in 0..7 {
        run(&mut cx, "session.open", json!({"id": format!("s{n}")}));
    }
    show_terminals(&mut cx, true);
    for _ in 0..40 {
        frame(&mut cx, POLL);
    }

    // Settings stopped part-way, again and again. The window changes after each, so the work a
    // stopped load left queued runs, as it does in the app.
    let mut stopped = 0;
    let mut after = vec![];
    for _ in 0..STOPS {
        gpui_shell::probe::set_budget(Some(STOP_BUDGET));
        run(&mut cx, "global.settings", json!({}));
        gpui_shell::probe::set_budget(None);
        stopped += error(&mut cx, "settings").is_some() as usize;
        run(&mut cx, "overlay.close", json!({}));
        show_terminals(&mut cx, false);
        show_terminals(&mut cx, true);
        for _ in 0..10 {
            frame(&mut cx, FRAME);
        }
        after.push(heap(&mut cx, true));
    }
    let mb = |bytes: i64| bytes as f64 / 1048576.;
    let (first_stop, last_stop) = (after[1], *after.last().unwrap());
    println!(
        "{stopped} of {STOPS} Settings loads stopped: js heap {:.2} MB ({} objects) after the second, {:.2} MB ({} objects) after the last",
        mb(first_stop.0), first_stop.1, mb(last_stop.0), last_stop.1
    );

    let mut readings = vec![(0, heap(&mut cx, false), heap(&mut cx, true))];
    let frames_per_second = 1000 / FRAME.as_millis() as u64;
    for second in 1..=seconds {
        for f in 0..frames_per_second {
            if f % 6 == 0 {
                let model = state(SESSIONS, (second * 10 + f / 6) as usize).model();
                workspace.update(&mut cx, |ws, cx| {
                    ws.sidebar()
                        .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
                });
            }
            frame(&mut cx, FRAME);
        }
        if second % 10 == 0 || second == seconds {
            let before = heap(&mut cx, false);
            readings.push((second, before, heap(&mut cx, true)));
        }
    }
    for (second, before, (bytes, objects)) in &readings {
        println!(
            "status {second:>4} s: js heap {:.2} MB ({} objects) before a collection, {:.2} MB ({objects} objects) after",
            mb(before.0), before.1, mb(*bytes)
        );
    }
    let _ = std::fs::remove_dir_all(&scratch);
    let (first, last) = (readings[0].2, readings.last().unwrap().2);
    assert_eq!(error(&mut cx, "sidebar"), None, "the sidebar stays loaded");
    // A machine fast enough to fit Settings in the budget tests nothing here.
    assert!(
        stopped * 2 >= STOPS,
        "only {stopped} of {STOPS} Settings loads were stopped"
    );
    assert!(
        last_stop.1 - first_stop.1 <= STOP_BOUND,
        "stopped Settings loads kept {} objects ({:.2} MB) over {} loads",
        last_stop.1 - first_stop.1,
        mb(last_stop.0 - first_stop.0),
        STOPS - 2
    );
    assert!(
        last.0 - first.0 <= BOUND,
        "the script heap grew {:.2} MB in {seconds} s of status changes ({} objects)",
        mb(last.0 - first.0),
        last.1 - first.1
    );
}
