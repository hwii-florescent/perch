//! One order of a workspace's sessions, in the tab strip and the sidebar alike, as the web's
//! `workspaceTabs` keeps it: oldest first, then the core's chat order (`workspace.order`), each
//! sub-session straight after its lead. A drag in the strip writes the core's order, so the sidebar
//! follows; a drag of a sidebar row writes it too, so the strip follows; and an order the core
//! broadcasts (another screen's move) reorders both. A sidebar row's drag only reorders: it never
//! splits, which stays a strip gesture.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

const WIDTH: f32 = 1200.;
const HEIGHT: f32 = 900.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Project `p`, checkout `w1`: `leader` with its sub-sessions `p4` and `p7`, then `perf` and
/// `leak`, oldest first; with the core's chat order `order`, when given.
fn state(order: Option<&[&str]>) -> State {
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
    let sessions: Vec<Value> = [
        ("leader", None),
        ("p4", Some("leader")),
        ("p7", Some("leader")),
        ("perf", None),
        ("leak", None),
    ]
    .iter()
    .enumerate()
    .map(|(i, (id, parent))| {
        json!({"id": id, "title": id, "cwd": "/work", "createdAt": i, "status": "idle",
            "hostId": "local", "projectId": "p", "workspaceId": "w1", "cliProviderId": "claude",
            "parentSessionId": parent})
    })
    .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    if let Some(order) = order {
        state.apply(&message(
            json!({"type": "workspace.order", "hostId": "local",
            "projects": [], "sessions": order}),
        ));
    }
    state
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    asked: UnboundedReceiver<Command>,
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

    fn draw(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    probe::clear();
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
        probe::records().into_values().collect()
    }

    fn center(&mut self, name: &str) -> (f32, f32) {
        let at = self
            .draw()
            .into_iter()
            .find(|r| r.name == name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        (f32::from(at.x), f32::from(at.y))
    }

    /// The sidebar's session rows, top to bottom.
    fn rows(&mut self) -> Vec<String> {
        let mut found: Vec<(f32, String)> = self
            .draw()
            .into_iter()
            .filter_map(|r| {
                let id = r.name.strip_prefix("session-button:")?.to_string();
                Some((f32::from(r.bounds.origin.y), id))
            })
            .collect();
        found.sort_by(|a, b| a.0.total_cmp(&b.0));
        found.into_iter().map(|(_, id)| id).collect()
    }

    fn strip(&mut self) -> Vec<String> {
        self.draw();
        self.ws(|ws, _, _| ws.tabs().strip().to_vec())
    }

    fn panes(&mut self) -> Vec<String> {
        self.ws(|ws, _, _| ws.tabs().shown())
    }

    /// The chat orders the window asked the core to keep since the last call.
    fn orders(&mut self) -> Vec<Vec<String>> {
        std::iter::from_fn(|| self.asked.try_recv().ok())
            .filter_map(|c| match c {
                Command::SetOrder {
                    sessions: Some(sessions),
                    ..
                } => Some(sessions),
                _ => None,
            })
            .collect()
    }

    fn input(&mut self, input: PlatformInput) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(input, cx);
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    /// A left press at `from`, held through `via` to `to`, released there.
    fn drag(&mut self, from: (f32, f32), via: &[(f32, f32)], to: (f32, f32)) {
        let at = |(x, y): (f32, f32)| point(px(x), px(y));
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: at(from),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
        for &step in via.iter().chain([&to]) {
            self.input(PlatformInput::MouseMove(MouseMoveEvent {
                position: at(step),
                pressed_button: Some(MouseButton::Left),
                modifiers: Modifiers::default(),
            }));
        }
        self.input(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: at(to),
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
    }

    /// What the core says next, as the follower hands it on.
    fn core_says(&mut self, state: State) {
        let model = state.model();
        self.ws(|ws, _, cx| {
            ws.sidebar()
                .update(cx, |s, cx| s.apply(Update::Model(model), cx))
        });
        self.draw();
    }
}

fn strings(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-tab-order-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, asked) = unbounded();
    let model = state(None).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    // Manual order: sorting by attention is a view with no drag.
    let perch = rig.cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    let mut settings = perch.sidebar();
    settings.sort_by_attention = false;
    perch.set_sidebar(settings);
    rig.cx.update(|cx| perch.flush(cx));

    // Opened out of order (the sub-sessions first, as a lead's sub-sessions often are), the strip
    // still lists them as the sidebar does.
    for id in ["p7", "p4", "leader", "perf", "leak"] {
        rig.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id.into(), Some("claude".into()), cx)
            })
        });
    }
    let first = strings(&["leader", "p4", "p7", "perf", "leak"]);
    assert_eq!(
        rig.rows(),
        first,
        "the sidebar: oldest first, sub-sessions under their lead"
    );
    assert_eq!(rig.strip(), first, "the strip shows the sidebar's order");
    rig.orders();

    // A drag in the strip: leak before perf. The core is asked to keep it, and the sidebar
    // follows at once.
    let leak = rig.center("tab:leak");
    let perf = rig.center("tab:perf");
    let before_perf = (perf.0 - 20., perf.1);
    rig.drag(leak, &[(leak.0 - 10., leak.1)], before_perf);
    let moved = strings(&["leader", "p4", "p7", "leak", "perf"]);
    assert_eq!(rig.strip(), moved, "leak went before perf in the strip");
    assert_eq!(
        rig.orders(),
        std::slice::from_ref(&moved),
        "the order goes to the core"
    );
    assert_eq!(rig.rows(), moved, "and the sidebar follows");
    assert_eq!(rig.panes().len(), 1, "a drop on the strip splits nothing");

    // A drag of a sidebar row: perf above leader. The strip follows.
    let row = |rig: &mut Rig, id: &str| rig.center(&format!("session-button:{id}"));
    let perf = row(&mut rig, "perf");
    let leader = row(&mut rig, "leader");
    let above = (leader.0, leader.1 - 6.);
    rig.drag(
        perf,
        &[(perf.0, perf.1 - 3.), (perf.0, perf.1 - 12.)],
        above,
    );
    let moved = strings(&["perf", "leader", "p4", "p7", "leak"]);
    let asked = rig.orders();
    assert_eq!(asked.len(), 1, "one order on the release: {asked:?}");
    assert_eq!(rig.rows(), moved, "perf is first in the sidebar");
    assert_eq!(rig.strip(), moved, "and in the strip");

    // A sub-session moves within its lead's family: p7 dragged to the strip's start lands first
    // among leader's sub-sessions, in the strip and the sidebar alike.
    let p7 = rig.center("tab:p7");
    let start = rig.center("tab:perf");
    rig.drag(p7, &[(p7.0 - 10., p7.1)], (start.0 - 40., start.1));
    let moved = strings(&["perf", "leader", "p7", "p4", "leak"]);
    assert_eq!(rig.strip(), moved, "p7 stays in leader's family");
    assert_eq!(rig.rows(), moved);
    rig.orders();

    // A sidebar row dragged out over the terminal is no split: the row goes home, nothing is
    // asked, the strip and its one pane are as they were.
    let leak = row(&mut rig, "leak");
    let middle = (WIDTH * 0.75, HEIGHT / 2.);
    rig.drag(
        leak,
        &[(leak.0, leak.1 - 3.), (leak.0 + 40., leak.1 - 12.)],
        middle,
    );
    assert!(rig.orders().is_empty(), "nothing is asked");
    assert_eq!(rig.panes().len(), 1, "a sidebar drag never splits");
    assert!(
        !rig.ws(|ws, _, _| ws.screens_open()).contains(&"tab-drag"),
        "no tab drag started"
    );
    assert_eq!(rig.strip(), moved);
    assert_eq!(rig.rows(), moved);

    // Another screen's move (the phone's), broadcast by the core, reorders both.
    rig.core_says(state(Some(&["leak", "leader", "p4", "p7", "perf"])));
    let moved = strings(&["leak", "leader", "p4", "p7", "perf"]);
    assert_eq!(rig.rows(), moved, "the sidebar takes the core's order");
    assert_eq!(rig.strip(), moved, "and so does the strip");

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("tab_order_window: ok");
}
