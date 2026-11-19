//! A click on a sidebar session row shows its tab as fast as a click on the strip's tab does.
//!
//! Both clicks go through the window's own dispatch (press, release) with the stock screens, and
//! each is timed from the press to the switched tab drawn. Neither may wait on a timer: the tab
//! must be shown before the test clock moves at all, and the sidebar's wall time stays within the
//! strip's plus a small margin (median of several repeats; a release measurement, a debug build
//! only reports it).
//!
//! A row press starts the web's reorder drag, which the strip's press does not: it adds window
//! listeners on the press and removes them on the release, and the window follows the press. None
//! of that may cost the sidebar a whole-tree describe or a re-render of its own (it did: about
//! twice the strip's time at five sessions, more with a long list).
//!
//! Offscreen, no core: the sidebar opens a session from facts it already holds.

use futures::channel::mpsc::unbounded;
use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, perch::Perch, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

const WIDTH: f32 = 1200.;
const HEIGHT: f32 = 900.;
const SESSIONS: usize = 5;
const REPEATS: usize = 7;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn state() -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let checkout = json!({"id": "w1", "projectId": "p", "hostId": "local", "path": "/work",
        "name": "w1", "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "workspace.order.v1"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project.clone()]})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [checkout]})));
    let sessions: Vec<Value> = (0..SESSIONS)
        .map(|i| {
            json!({"id": format!("s{i}"), "title": format!("s{i}"), "cwd": "/work",
                "createdAt": i, "status": "idle", "hostId": "local", "projectId": "p",
                "workspaceId": "w1", "cliProviderId": "claude"})
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    perch: Perch,
}

impl Rig {
    fn active(&mut self) -> Option<String> {
        self.window
            .update(&mut self.cx, |ws, _, _| {
                ws.tabs().active().map(str::to_string)
            })
            .unwrap()
    }

    fn frame(&mut self) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                probe::clear();
                window.refresh();
                let _ = window.draw(cx);
            })
            .unwrap();
    }

    fn settle(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.frame();
        }
        probe::records().into_values().collect()
    }

    fn center(&mut self, name: &str) -> (f32, f32) {
        let at = self
            .settle()
            .into_iter()
            .find(|r| r.name == name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        (f32::from(at.x), f32::from(at.y))
    }

    fn dispatch(&mut self, input: PlatformInput) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(input, cx);
            })
            .unwrap();
    }

    /// Press and release at `at`, then run what is ready and draw one frame, with the test clock
    /// held still: the time it took, whether `id` was shown by then, and how many times the
    /// sidebar's script rendered for it.
    fn click(&mut self, (x, y): (f32, f32), id: &str) -> (Duration, bool, u64) {
        let renders = |rig: &Self| rig.perch.refreshes().get("sidebar").copied().unwrap_or(0);
        let before = renders(self);
        let position = point(px(x), px(y));
        let started = Instant::now();
        self.dispatch(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
        // A frame between them, as a person's click has: the window follows the press from it.
        self.cx.run_until_parked();
        self.frame();
        self.dispatch(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position,
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
        self.cx.run_until_parked();
        self.frame();
        let took = started.elapsed();
        (
            took,
            self.active().as_deref() == Some(id),
            renders(self) - before,
        )
    }
}

fn median(mut list: Vec<Duration>) -> Duration {
    list.sort();
    list[list.len() / 2]
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-sidebar-click-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state().model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(scratch.join("native-mods"), &workspace, window.into(), cx));
    let perch = cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    let mut rig = Rig { cx, window, perch };
    for i in 0..SESSIONS {
        rig.window
            .update(&mut rig.cx, |ws, _, cx| {
                ws.sidebar().update(cx, |s, cx| {
                    s.open("local".into(), format!("s{i}"), Some("claude".into()), cx)
                })
            })
            .unwrap();
    }
    rig.settle();

    // The strip shows s1, the sidebar s3, and again: each click is a real switch.
    let (id, other) = ("s1", "s3");
    let (mut strip, mut sidebar) = (vec![], vec![]);
    let (mut strip_renders, mut sidebar_renders) = (0, 0);
    for _ in 0..REPEATS * 2 {
        let at = rig.center(&format!("tab:{id}"));
        let (took, shown, renders) = rig.click(at, id);
        assert!(shown, "a strip click shows {id} with no timer waited on");
        strip.push(took);
        strip_renders = renders;

        let at = rig.center(&format!("session-button:{other}"));
        let (took, shown, renders) = rig.click(at, other);
        sidebar_renders = renders;
        assert!(
            shown,
            "a sidebar click shows {other} with no timer waited on, as the strip's does"
        );
        sidebar.push(took);
    }
    let (strip, sidebar) = (median(strip), median(sidebar));
    eprintln!(
        "click to drawn, median of {}: strip {strip:?} ({strip_renders} sidebar renders), \
         sidebar {sidebar:?} ({sidebar_renders} sidebar renders)",
        REPEATS * 2
    );
    if cfg!(debug_assertions) {
        eprintln!("debug build: timings are reported, not judged (run with --release)");
    } else {
        let margin = Duration::from_millis(8);
        assert!(
            sidebar <= strip + margin,
            "a sidebar click costs {sidebar:?}, the strip's {strip:?} (+{margin:?} allowed)"
        );
    }
    let _ = std::fs::remove_dir_all(&scratch);
}
