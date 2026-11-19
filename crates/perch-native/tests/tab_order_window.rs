//! One order of a workspace's sessions, in the tab strip and the sidebar alike, as the web's
//! `workspaceTabs` keeps it: oldest first, then the core's chat order (`workspace.order`); the
//! sidebar lists each sub-session under its lead, the strip keeps the order a person dragged into
//! it, as the web's. A drag in the strip writes the core's order, so the sidebar
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
use std::cell::Cell;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;

const WIDTH: f32 = 1200.;
const HEIGHT: f32 = 900.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Project `p`, checkout `w1`: `leader` with its sub-sessions `p4` and `p7`, then `perf` and
/// `leak`, oldest first; with the core's chat order `order`, when given.
fn state(order: Option<&[&str]>) -> State {
    state_with(order, 0)
}

/// `state`, plus `more` sessions `s0`.. after the five, for a long strip.
fn state_with(order: Option<&[&str]>, more: usize) -> State {
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
    let extra: Vec<String> = (0..more).map(|n| format!("s{n}")).collect();
    let sessions: Vec<Value> = [
        ("leader", None),
        ("p4", Some("leader")),
        ("p7", Some("leader")),
        ("perf", None),
        ("leak", None),
    ]
    .into_iter()
    .chain(extra.iter().map(|id| (id.as_str(), None)))
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
                    // Pages that only record: WebKit cannot run headless.
                    .with_browser_pages(perch_native::browser::fake::browsers().0)
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    // Manual order by default: sorting by attention (a view with no drag) is off until chosen,
    // so the sidebar's rows reorder in project organize as they come.
    let perch = rig.cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    assert!(!perch.sidebar().sort_by_attention);
    assert_eq!(perch.sidebar().organize, "project");

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

    // While a tab is dragged along the strip, each move re-renders the strip (its tabs slide)
    // and the drag's own screen, and no other screen: the sidebar, the status line and the rest
    // read nothing that moves with the pointer. That re-render is accepted because it is cheap:
    // under 4 ms of script a move with 20 tabs in a release build (`drag_cost_with_twenty_tabs`).
    let at = |(x, y): (f32, f32)| point(px(x), px(y));
    let moving = |x: f32, y: f32| {
        PlatformInput::MouseMove(MouseMoveEvent {
            position: at((x, y)),
            pressed_button: Some(MouseButton::Left),
            modifiers: Modifiers::default(),
        })
    };
    let leader = rig.center("tab:leader");
    let leak = rig.center("tab:leak");
    rig.input(PlatformInput::MouseDown(MouseDownEvent {
        button: MouseButton::Left,
        position: at(leader),
        modifiers: Modifiers::default(),
        click_count: 1,
        first_mouse: false,
    }));
    rig.input(moving(leader.0 + 10., leader.1));
    let before = perch.refreshes();
    let steps = 12;
    for i in 1..=steps {
        let x = leader.0 + 10. + (leak.0 - leader.0 - 10.) * i as f32 / steps as f32;
        rig.input(moving(x, leader.1));
    }
    let after = perch.refreshes();
    let moved: Vec<(&String, u64)> = after
        .iter()
        .map(|(key, n)| (key, n - before.get(key).copied().unwrap_or(0)))
        .filter(|(_, n)| *n > 0)
        .collect();
    assert!(
        moved
            .iter()
            .all(|(key, _)| *key == "tabs" || *key == "tab-drag"),
        "only the strip and the drag re-render while a tab moves along it: {moved:?}"
    );
    assert!(
        moved.iter().any(|(key, n)| *key == "tabs" && *n >= 3),
        "the strip slides as the tab passes others: {moved:?}"
    );
    // Escape ends it with nothing changed, and the strip's tabs come to rest.
    rig.input(PlatformInput::KeyDown(gpui::KeyDownEvent {
        keystroke: gpui::Keystroke::parse("escape").unwrap(),
        is_held: false,
        prefer_character_input: false,
    }));
    assert!(
        rig.ws(|ws, _, _| ws.tab_slide().is_null()),
        "no slide is left"
    );
    assert!(!rig.ws(|ws, _, _| ws.screens_open()).contains(&"tab-drag"));
    rig.input(PlatformInput::MouseUp(MouseUpEvent {
        button: MouseButton::Left,
        position: at(leak),
        modifiers: Modifiers::default(),
        click_count: 1,
    }));
    assert_eq!(rig.strip(), first, "an Escaped drag moves nothing");
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

    // A sub-session dragged out of its stack (to the strip's start) stays in it, first among
    // leader's sub-sessions, in the strip and the sidebar alike.
    let p7 = rig.center("tab:p7");
    let start = rig.center("tab:perf");
    rig.drag(p7, &[(p7.0 - 10., p7.1)], (start.0 - 40., start.1));
    let moved = strings(&["perf", "leader", "p7", "p4", "leak"]);
    assert_eq!(
        rig.strip(),
        moved,
        "a sub-session stays in its lead's stack"
    );
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

    stacks_among_other_tabs(&mut rig);
    drag_cost_with_twenty_tabs(&mut rig, &perch);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    pointer_leaving_ends_hover(&mut rig.cx);
    let _ = std::fs::remove_dir_all(&scratch);
    println!("tab_order_window: ok");
}

/// A press and release at the centre of record `name`.
fn click(rig: &mut Rig, name: &str) {
    let (x, y) = rig.center(name);
    let at = point(px(x), px(y));
    rig.input(PlatformInput::MouseDown(MouseDownEvent {
        button: MouseButton::Left,
        position: at,
        modifiers: Modifiers::default(),
        click_count: 1,
        first_mouse: false,
    }));
    rig.input(PlatformInput::MouseUp(MouseUpEvent {
        button: MouseButton::Left,
        position: at,
        modifiers: Modifiers::default(),
        click_count: 1,
    }));
}

/// The strip agrees with the sidebar after every drop: its session tabs are the sidebar's rows (a
/// folded stack shows only its lead in both), every sub-session's tab sits in its lead's stack,
/// no other tab sits inside a stack, and no two drawn tabs overlap.
fn agrees(rig: &mut Rig, folded: bool, what: &str) -> Vec<String> {
    let strip = rig.strip();
    let rows = rig.rows();
    let sessions: Vec<String> = strip
        .iter()
        .filter(|id| !id.contains('\n'))
        .cloned()
        .collect();
    let shown: Vec<String> = sessions
        .iter()
        .filter(|id| !(folded && (*id == "p4" || *id == "p7")))
        .cloned()
        .collect();
    assert_eq!(
        shown, rows,
        "{what}: the strip's sessions are the sidebar's rows"
    );
    let lead = strip.iter().position(|id| id == "leader").unwrap();
    let mut stack: Vec<&str> = strip[lead + 1..lead + 3]
        .iter()
        .map(String::as_str)
        .collect();
    stack.sort();
    assert_eq!(stack, ["p4", "p7"], "{what}: the stack is whole: {strip:?}");
    let mut boxes: Vec<(f32, f32, String)> = rig
        .draw()
        .into_iter()
        .filter_map(|r| {
            let id = r.name.strip_prefix("tab-slot:")?.to_string();
            let x = f32::from(r.bounds.origin.x);
            Some((x, x + f32::from(r.bounds.size.width), id))
        })
        .collect();
    boxes.sort_by(|a, b| a.0.total_cmp(&b.0));
    for pair in boxes.windows(2) {
        assert!(
            pair[0].1 <= pair[1].0 + 0.5,
            "{what}: {} and {} overlap: {boxes:?}",
            pair[0].2,
            pair[1].2
        );
    }
    strip
}

/// Stacks among files, a page and the review: the strip folds with the sidebar, a folded and an
/// open stack each drag as one, a file dropped onto a stack lands beside it, a sub-session dragged
/// away stays in its stack, and the strip agrees with the sidebar after every drop, in the strip
/// or the sidebar, back and forth.
fn stacks_among_other_tabs(rig: &mut Rig) {
    rig.core_says(state(Some(&["leader", "p4", "p7", "perf", "leak"])));
    for (command, args) in [
        ("file.open", json!({"workspaceId": "w1", "path": "a.rs"})),
        (
            "browser.open",
            json!({"workspaceId": "w1", "url": "example.com"}),
        ),
        ("review.open", json!({"workspaceId": "w1"})),
    ] {
        rig.ws(|ws, window, cx| ws.run_command(command, Some(&args), window, cx))
            .unwrap();
    }
    let file = "w1\na.rs";
    let strip = agrees(rig, false, "opened");
    assert_eq!(
        &strip[..5],
        strings(&["leader", "p4", "p7", "perf", "leak"])
    );
    rig.orders();

    // The file dropped between the lead and its first sub-session lands after the stack.
    let at = rig.center(&format!("tab:{file}"));
    let p4 = rig.center("tab:p4");
    rig.drag(at, &[(at.0 - 10., at.1)], (p4.0 - 60., p4.1));
    let strip = agrees(rig, false, "a file dropped onto the stack");
    assert_eq!(&strip[..4], strings(&["leader", "p4", "p7", file]));

    // The strip's count folds the stack in the sidebar too.
    click(rig, "tab-stack-count:leader");
    assert!(rig
        .ws(|_, _, cx| cx.global::<WindowMods>().perch.clone())
        .sidebar()
        .folded_sessions
        .contains(&"leader".to_string()));
    agrees(rig, true, "folded from the strip");

    // The folded stack dragged after leak moves whole, its file with it.
    let lead = rig.center("tab:leader");
    let leak = rig.center("tab:leak");
    rig.drag(lead, &[(lead.0 + 10., lead.1)], (leak.0 + 40., leak.1));
    let strip = agrees(rig, true, "the folded stack dragged");
    let sessions: Vec<&String> = strip.iter().filter(|id| !id.contains('\n')).collect();
    assert_eq!(sessions, ["perf", "leak", "leader", "p4", "p7"]);

    // Opened from the sidebar, the open stack dragged back first.
    click(rig, "session-fold-button:leader");
    agrees(rig, false, "opened from the sidebar");
    let lead = rig.center("tab:leader");
    let perf = rig.center("tab:perf");
    rig.drag(lead, &[(lead.0 - 10., lead.1)], (perf.0 - 60., perf.1));
    let strip = agrees(rig, false, "the open stack dragged");
    assert_eq!(&strip[..3], strings(&["leader", "p4", "p7"]));

    // A sidebar row moved, then a strip tab moved back, twice: the two views stay one order.
    let row = |rig: &mut Rig, id: &str| rig.center(&format!("session-button:{id}"));
    for _ in 0..2 {
        let leak = row(rig, "leak");
        let leader = row(rig, "leader");
        rig.drag(
            leak,
            &[(leak.0, leak.1 - 3.), (leak.0, leak.1 - 12.)],
            (leader.0, leader.1 - 6.),
        );
        let strip = agrees(rig, false, "a sidebar row dragged");
        assert_eq!(strip[0], "leak");
        let leak = rig.center("tab:leak");
        let end = rig.center("tab:perf");
        rig.drag(leak, &[(leak.0 + 10., leak.1)], (end.0 + 60., end.1));
        agrees(rig, false, "the tab dragged back");
    }

    // A sub-session dragged away from its stack stays in it.
    let last = rig.strip().last().cloned().unwrap();
    let p4 = rig.center("tab:p4");
    let end = rig.center(&format!("tab:{last}"));
    // Past the last tab's middle, still inside the strip (which scrolls: its last tab runs past its edge).
    rig.drag(p4, &[(p4.0 + 10., p4.1)], (end.0 + 15., p4.1));
    let strip = agrees(rig, false, "a sub-session dragged away");
    let lead = strip.iter().position(|id| id == "leader").unwrap();
    assert_eq!(&strip[lead..lead + 3], strings(&["leader", "p7", "p4"]));

    for id in [file, "w1\n\0review", "w1\n\0browser\nhttps://example.com/"] {
        rig.ws(|ws, window, cx| ws.run_command("tab.close", Some(&json!({"id": id})), window, cx))
            .unwrap();
    }
    rig.orders();
}

/// What one pointer move costs in script while a tab is dragged along a 20-tab strip: the strip's
/// own re-render (its tabs slide) plus the ghost's. Bounded at 4 ms per move in a release build,
/// well inside a 60-120 Hz pointer and the 50 ms render budget; a debug build only prints it.
fn drag_cost_with_twenty_tabs(rig: &mut Rig, perch: &perch_native::mods::perch::Perch) {
    rig.core_says(state_with(None, 15));
    for n in 0..15 {
        rig.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), format!("s{n}"), Some("claude".into()), cx)
            })
        });
    }
    assert_eq!(rig.strip().len(), 20, "a 20-tab strip");
    let at = |(x, y): (f32, f32)| point(px(x), px(y));
    let moving = |x: f32, y: f32| {
        PlatformInput::MouseMove(MouseMoveEvent {
            position: at((x, y)),
            pressed_button: Some(MouseButton::Left),
            modifiers: Modifiers::default(),
        })
    };
    // The strip scrolls to its active (last opened) tab: drag that one to the leftmost tab shown.
    let mut shown: Vec<(f32, f32)> = rig
        .draw()
        .into_iter()
        .filter(|r| r.name.starts_with("tab:") && f32::from(r.bounds.origin.x) >= 0.)
        .map(|r| {
            (
                f32::from(r.bounds.center().x),
                f32::from(r.bounds.center().y),
            )
        })
        .collect();
    shown.sort_by(|a, b| a.0.total_cmp(&b.0));
    assert!(shown.len() >= 8, "most of the strip is shown: {shown:?}");
    let (to, from) = (shown[0], *shown.last().unwrap());
    rig.input(PlatformInput::MouseDown(MouseDownEvent {
        button: MouseButton::Left,
        position: at(from),
        modifiers: Modifiers::default(),
        click_count: 1,
        first_mouse: false,
    }));
    rig.input(moving(from.0 - 10., from.1));
    let host = rig.cx.update(|cx| cx.global::<WindowMods>().host.clone());
    let before = (host.metrics(), perch.refreshes());
    let steps = 40;
    for i in 1..=steps {
        let x = from.0 - 10. + (to.0 - from.0 + 10.) * i as f32 / steps as f32;
        rig.input(moving(x, from.1));
    }
    assert!(
        rig.ws(|ws, _, _| ws.screens_open()).contains(&"tab-drag"),
        "the drag is on"
    );
    let spent = host.metrics().since(&before.0);
    let strip_renders = perch.refreshes().get("tabs").copied().unwrap_or(0)
        - before.1.get("tabs").copied().unwrap_or(0);
    let per_move = spent.script_render_time() / steps;
    println!(
        "tab_order_window: 20-tab drag, {steps} moves: strip renders {strip_renders}, script \
         renders {}, script render {:.2} ms per move (slowest render {:.2} ms)",
        spent.script_renders(),
        per_move.as_secs_f64() * 1000.,
        spent.slowest_script_render().as_secs_f64() * 1000.,
    );
    if !cfg!(debug_assertions) {
        assert!(
            per_move < std::time::Duration::from_millis(4),
            "a drag move costs under 4 ms of script with 20 tabs: {per_move:?}"
        );
    }
    rig.input(PlatformInput::KeyDown(gpui::KeyDownEvent {
        keystroke: gpui::Keystroke::parse("escape").unwrap(),
        is_held: false,
        prefer_character_input: false,
    }));
    rig.input(PlatformInput::MouseUp(MouseUpEvent {
        button: MouseButton::Left,
        position: at(to),
        modifiers: Modifiers::default(),
        click_count: 1,
    }));
}

/// An element hovered when the pointer leaves the window is no longer hovered, though no move
/// came after the one that hovered it: a row's hover-only actions and a hover popover hide.
fn pointer_leaving_ends_hover(cx: &mut HeadlessAppContext) {
    use gpui::{InteractiveElement as _, StatefulInteractiveElement as _, Styled as _};
    struct Box(Rc<Cell<bool>>);
    impl gpui::Render for Box {
        fn render(
            &mut self,
            _: &mut Window,
            _: &mut gpui::Context<Self>,
        ) -> impl gpui::IntoElement {
            let hovered = self.0.clone();
            gpui::div()
                .id("box")
                .size_full()
                .on_hover(move |on, _, _| hovered.set(*on))
        }
    }
    let hovered = Rc::new(Cell::new(false));
    let shown = hovered.clone();
    let window = cx
        .open_window(size(px(200.), px(200.)), move |_, cx| {
            cx.new(|_| Box(shown))
        })
        .unwrap();
    let mut send = |input: PlatformInput| {
        cx.update_window(window.into(), |_, window: &mut Window, cx| {
            window.dispatch_event(input, cx);
        })
        .unwrap();
        for _ in 0..2 {
            cx.run_until_parked();
            cx.update_window(window.into(), |_, window: &mut Window, cx| {
                window.refresh();
                let _ = window.draw(cx);
            })
            .unwrap();
        }
        cx.run_until_parked();
    };
    send(PlatformInput::MouseMove(MouseMoveEvent {
        position: point(px(100.), px(100.)),
        pressed_button: None,
        modifiers: Modifiers::default(),
    }));
    assert!(hovered.get(), "the pointer over it hovers it");
    send(PlatformInput::MouseExited(gpui::MouseExitEvent {
        position: point(px(100.), px(100.)),
        pressed_button: None,
        modifiers: Modifiers::default(),
    }));
    assert!(
        !hovered.get(),
        "the pointer left the window: nothing is hovered"
    );
    cx.update_window(window.into(), |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
}
