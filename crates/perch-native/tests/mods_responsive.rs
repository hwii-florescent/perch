//! How quickly the stock React screens follow the pointer and the core, in a window of 40 sessions.
//!
//! - Hover: moving the pointer over the sidebar's rows draws each row's hover from the description
//!   already built: no script render, no re-description of the tree.
//! - Core updates: a burst of sessions deleted (stopped elsewhere) reaches the sidebar and the tab
//!   strip with no input at all, tabs out of sight included.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event
//! goes through the window's own dispatch. `PERCH_RESPONSIVE_REPORT=1` prints the timings.

use futures::channel::mpsc::unbounded;
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseMoveEvent, PlatformInput,
    Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Update;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 1400.;
const SESSIONS: usize = 40;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn project() -> Value {
    json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
           "createdAt": 0, "updatedAt": 0})
}

/// One project holding `ids`, every fourth a sub-session of the one before it.
fn state(ids: &[String]) -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project()]})));
    let checkout = json!({"id": "w1", "projectId": "p", "hostId": "local", "path": "/work",
        "name": "w1", "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project()], "workspaces": [checkout]})));
    let sessions: Vec<Value> = ids
        .iter()
        .map(|id| {
            let n: usize = id[1..].parse().unwrap();
            let mut session = json!({
                "id": id, "title": format!("Session {n}"), "cwd": "/work", "createdAt": n,
                "status": if n.is_multiple_of(3) { "running" } else { "idle" },
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"});
            if n % 4 == 3 {
                session["parentSessionId"] = json!(format!("s{}", n - 1));
            }
            session
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

fn ids(range: impl Iterator<Item = usize>) -> Vec<String> {
    range.map(|n| format!("s{n}")).collect()
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn ws<R>(
        &mut self,
        f: impl FnOnce(&mut Workspace, &mut Window, &mut gpui::Context<Workspace>) -> R,
    ) -> R {
        self.window
            .update(&mut self.cx, |ws, window, cx| f(ws, window, cx))
            .unwrap()
    }

    /// Lets loads, React's commits and timers settle, then draws everything afresh.
    fn settle(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.draw_frame(true);
        }
        probe::records().into_values().collect()
    }

    /// One frame: what is dirty is drawn again (all of it with `refresh`).
    fn draw_frame(&mut self, refresh: bool) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                probe::clear();
                if refresh {
                    window.refresh();
                }
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    fn keys(&mut self, records: &[ProbeRecord], name: &str) -> Vec<String> {
        let prefix = format!("{name}:");
        let mut found: Vec<(f32, String)> = records
            .iter()
            .filter_map(|r| {
                let key = r.name.strip_prefix(prefix.as_str())?.to_string();
                Some((f32::from(r.bounds.origin.y + r.bounds.origin.x), key))
            })
            .collect();
        found.sort_by(|a, b| a.0.total_cmp(&b.0));
        found.into_iter().map(|(_, key)| key).collect()
    }

    fn metrics(&mut self) -> gpui_shell::RuntimeMetrics {
        self.cx
            .update(|cx| cx.global::<WindowMods>().host.metrics())
    }

    fn click(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                for input in [
                    PlatformInput::MouseDown(gpui::MouseDownEvent {
                        button: gpui::MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    PlatformInput::MouseUp(gpui::MouseUpEvent {
                        button: gpui::MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                ] {
                    window.dispatch_event(input, cx);
                }
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn move_to(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseMove(MouseMoveEvent {
                        position: at,
                        pressed_button: None,
                        modifiers: Modifiers::default(),
                    }),
                    cx,
                );
            })
            .unwrap();
    }
}

fn report() -> bool {
    std::env::var_os("PERCH_RESPONSIVE_REPORT").is_some()
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-responsive-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let all = ids(0..SESSIONS);
    let model = state(&all).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };

    let started = Instant::now();
    let records = rig.settle();
    let first = started.elapsed();
    let rows = rig.keys(&records, "session-button");
    if rows.is_empty() {
        let mut names: Vec<_> = records.iter().map(|r| r.name.clone()).collect();
        names.sort();
        eprintln!("{names:?}");
    }
    assert_eq!(rows.len(), SESSIONS, "every session has a row: {rows:?}");
    // Open a few tabs, to see them go with their sessions.
    for id in ["s1", "s2", "s5", "s6", "s20"] {
        rig.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id.into(), Some("claude".into()), cx)
            })
        });
    }
    let records = rig.settle();
    // s3 and s7 are sub-sessions of s2 and s6: they open with their leads.
    assert_eq!(rig.keys(&records, "tab"), ["s1", "s2", "s3", "s5", "s6", "s7", "s20"]);

    // Hover: sweep the pointer down and up the rows, a frame per move.
    let centers: Vec<_> = rows
        .iter()
        .map(|id| {
            records
                .iter()
                .find(|r| r.name == format!("session-button:{id}"))
                .unwrap()
                .bounds
                .center()
        })
        .collect();
    let sweeps: usize = std::env::var("PERCH_RESPONSIVE_SWEEPS")
        .ok()
        .and_then(|n| n.parse().ok())
        .unwrap_or(1);
    let sweep: Vec<_> = (0..sweeps)
        .flat_map(|_| centers.iter().chain(centers.iter().rev()))
        .copied()
        .collect();
    let before = rig.metrics();
    let started = Instant::now();
    let mut slowest = Duration::ZERO;
    for at in &sweep {
        let frame = Instant::now();
        // GPUI's test platform draws a window the move made dirty before the call returns, as a frame would.
        rig.move_to(*at);
        rig.cx.run_until_parked();
        slowest = slowest.max(frame.elapsed());
    }
    let hover = started.elapsed();
    let spent = rig.metrics().since(&before);
    if report() {
        println!(
            "first draw (3 settles): {first:?}\nhover: {} moves, {:?} each, slowest {slowest:?}; \
             script renders {}, script time {:?}, materializations {}, materialize time {:?}",
            sweep.len(),
            hover / sweep.len() as u32,
            spent.script_renders(),
            spent.script_render_time(),
            spent.materializations(),
            spent.materialize_time(),
        );
    }

    assert_eq!(
        spent.script_renders(),
        0,
        "hovering draws from the description already built, without running the screen's script"
    );

    // Stops: the core deletes eight sessions, four of them open in tabs that are not shown (so no
    // terminal is attached to hear it), and the window gets no input after. The sidebar's facts
    // carry each deletion, as the follower sends them.
    let mut facts = state(&all);
    let started = Instant::now();
    let gone = ["s1", "s2", "s5", "s6", "s9", "s10", "s13", "s14"];
    for id in gone {
        facts.apply(&message(
            json!({"type": "session.deleted", "sessionId": id}),
        ));
        let model = facts.model();
        rig.ws(|ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
        });
    }
    // A few frames' worth of time, with tasks and timers run: nothing is clicked or moved.
    for _ in 0..4 {
        rig.cx.advance_clock(Duration::from_millis(16));
        rig.cx.run_until_parked();
    }
    let settled = started.elapsed();
    rig.draw_frame(true);
    let records: Vec<ProbeRecord> = probe::records().into_values().collect();
    if report() {
        println!("stop burst: {settled:?} to settle with no input");
    }
    let rows = rig.keys(&records, "session-button");
    assert_eq!(
        rows.len(),
        SESSIONS - gone.len(),
        "the sidebar drops every stopped session with no input: {rows:?}"
    );
    assert!(
        rows.iter().all(|id| !gone.contains(&id.as_str())),
        "{rows:?}"
    );
    assert_eq!(
        rig.keys(&records, "tab"),
        ["s3", "s7", "s20"],
        "the strip closes the tabs of the stopped sessions and keeps the others"
    );
    // Settings' Keyboard page opens and draws within the script's budgets.
    rig.ws(|ws, window, cx| ws.run_command("global.settings", None, window, cx))
        .unwrap();
    let records = rig.settle();
    let nav = records
        .iter()
        .find(|r| r.name.as_ref() == "settings-nav:keyboard")
        .expect("the Keyboard section is listed")
        .bounds
        .center();
    let before = rig.metrics();
    let started = Instant::now();
    rig.click(nav);
    let records = rig.settle();
    let opened = started.elapsed();
    let spent = rig.metrics().since(&before);
    let error = rig.ws(|ws, _, cx| ws.screen_error("settings", cx));
    let rows = records
        .iter()
        .filter(|r| r.name.contains("keybinding-"))
        .count();
    if report() {
        println!(
            "keyboard page: {opened:?} to open, {rows} binding records, script renders {}, script time {:?}, \
             materializations {}, materialize time {:?}; error {error:?}",
            spent.script_renders(),
            spent.script_render_time(),
            spent.materializations(),
            spent.materialize_time(),
        );
    }
    assert_eq!(error, None, "the Keyboard page draws");
    assert!(rows > 0, "the Keyboard page draws its bindings");

    // A script stopped in the middle of an event (past its time budget) says so where it is drawn.
    rig.ws(|ws, window, cx| ws.screen_closed("settings", serde_json::Value::Null, window, cx));
    let status = user.join("status");
    std::fs::create_dir_all(&status).unwrap();
    std::fs::write(status.join("mod.json"), r#"{ "name": "Spin" }"#).unwrap();
    std::fs::write(
        status.join("main.js"),
        r#"import { View, div } from "gpui-kit";
export default class Spin extends View {
  render(_cx) {
    return div().id("spin").size_full().on_click(() => { for (;;) {} }).child("spin");
  }
}
"#,
    )
    .unwrap();
    let records = rig.settle();
    let spin = records
        .iter()
        .find(|r| r.name.as_ref() == "spin")
        .expect("the person's status mod is drawn")
        .bounds
        .center();
    rig.click(spin);
    rig.settle();
    let view = rig.ws(|ws, _, _| ws.screen_view("status")).unwrap();
    let error = rig.cx.update(|cx| view.read(cx).error(cx));
    assert!(
        error.as_deref().is_some_and(|e| e.contains("was stopped")),
        "a stopped click handler is reported, not dropped: {error:?}"
    );
    println!("mods_responsive: ok");
    let _ = std::fs::remove_dir_all(&scratch);
}
