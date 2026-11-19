//! What the sidebar's rows do in a real window, through the stock `sidebar` mod and the window's
//! own screens. A session row's menu (right-click) is the stock tab menu for that session, whether
//! or not it has a tab: the window works out what may be done, runs the tab's actions (rename,
//! show beside an open tab, split) and the session's inbound choices, and a row of the sidebar's
//! own (Move up, Move down) runs the sidebar's command. A row's drag is the web's own, with the
//! pointer forwarded to the sidebar only while the press lasts.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event
//! goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    div, point, px, size, AnyWindowHandle, AppContext as _, HeadlessAppContext, IntoElement,
    Keystroke, Modifiers, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PlatformInput,
    Render, Window, WindowHandle,
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

const WIDTH: f32 = 1000.;
const HEIGHT: f32 = 900.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Project `p` with checkout `w1`, holding `alpha`, `bravo` and `charlie` (Claude sessions), on a
/// core with inbound control.
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
        "capabilities": ["workspace.snapshot", "workspace.order.v1", "inbound.v1"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project.clone()]})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [checkout]})));
    let sessions: Vec<Value> = ["alpha", "bravo", "charlie"]
        .iter()
        .enumerate()
        .map(|(i, title)| {
            json!({"id": title, "title": title, "cwd": "/work", "createdAt": i, "status": "idle",
                "hostId": "local", "projectId": "p", "workspaceId": "w1", "cliProviderId": "claude"})
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

    /// Draws the window afresh, letting mod loads, React's commits and timers settle first, and
    /// returns what was named.
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

    fn record(&mut self, name: &str) -> Option<ProbeRecord> {
        self.draw().into_iter().find(|r| r.name == name)
    }

    /// The keys of the records named `name:<key>`, top to bottom.
    fn keys(&mut self, name: &str) -> Vec<String> {
        let prefix = format!("{name}:");
        let mut found: Vec<(f32, String)> = self
            .draw()
            .into_iter()
            .filter_map(|r| {
                let key = r.name.strip_prefix(prefix.as_str())?.to_string();
                Some((f32::from(r.bounds.origin.y), key))
            })
            .collect();
        found.sort_by(|a, b| a.0.total_cmp(&b.0));
        found.into_iter().map(|(_, key)| key).collect()
    }

    /// A press and release of `button` at `(x, y)`, through the window's dispatch.
    fn mouse(&mut self, button: MouseButton, x: f32, y: f32) {
        let position = point(px(x), px(y));
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button,
                        position,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button,
                        position,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    fn center(&mut self, name: &str) -> (f32, f32) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        (f32::from(at.x), f32::from(at.y))
    }

    fn click(&mut self, name: &str) {
        let (x, y) = self.center(name);
        self.mouse(MouseButton::Left, x, y);
    }

    fn right_click(&mut self, name: &str) -> (f32, f32) {
        let (x, y) = self.center(name);
        self.mouse(MouseButton::Right, x, y);
        (x, y)
    }

    fn press(&mut self, spec: &str) {
        let keystroke = Keystroke::parse(spec).unwrap();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    /// Types `text` a key at a time where the keyboard is.
    fn type_text(&mut self, text: &str) {
        for c in text.chars() {
            let key = if c == ' ' {
                "space".to_string()
            } else {
                c.to_lowercase().to_string()
            };
            let keystroke = Keystroke {
                modifiers: Modifiers {
                    shift: c.is_uppercase(),
                    ..Modifiers::default()
                },
                key,
                key_char: Some(c.to_string()),
            };
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    window.dispatch_keystroke(keystroke, cx)
                })
                .unwrap();
            self.cx.run_until_parked();
        }
        self.draw();
    }

    fn open_screens(&mut self) -> Vec<&'static str> {
        self.ws(|ws, _, _| ws.screens_open())
    }

    /// What the window asked the core for since the last call.
    fn asked(&mut self) -> Vec<Command> {
        std::iter::from_fn(|| self.asked.try_recv().ok()).collect()
    }

    /// The tabs, the panes on screen and the one with the keyboard.
    fn tabs(&mut self) -> (Vec<String>, Vec<String>, Option<String>) {
        self.ws(|ws, _, _| {
            let tabs = ws.tabs();
            (
                tabs.strip().to_vec(),
                tabs.shown(),
                tabs.active().map(str::to_string),
            )
        })
    }

    /// A left press, a move with it held, a move with no button (its release was not seen) or
    /// its release at `(x, y)`, through the window's dispatch.
    fn down(&mut self, (x, y): (f32, f32)) {
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
    }

    fn moved(&mut self, (x, y): (f32, f32), held: bool) {
        self.input(PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(x), px(y)),
            pressed_button: held.then_some(MouseButton::Left),
            modifiers: Modifiers::default(),
        }));
    }

    fn up(&mut self, (x, y): (f32, f32)) {
        self.input(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
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

    /// The pointer the window last forwarded to a mod following a press.
    fn forwarded(&mut self) -> Value {
        self.ws(|ws, _, _| ws.pointer_follow().clone())
    }
}

/// A window with nothing in it.
struct Blank;

impl Render for Blank {
    fn render(&mut self, _: &mut Window, _: &mut gpui::Context<Self>) -> impl IntoElement {
        div()
    }
}

fn strings(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

/// The orders the window asked the core to keep for sessions.
fn session_orders(asked: Vec<Command>) -> Vec<Vec<String>> {
    asked
        .into_iter()
        .filter_map(|c| match c {
            Command::SetOrder {
                sessions: Some(sessions),
                ..
            } => Some(sessions),
            _ => None,
        })
        .collect()
}

/// A session row's drag is the web's own (`beginReorderDrag`): the window forwards the pointer to
/// the sidebar only while the press lasts, the rows slide as the web's do, and the order goes to
/// the core once, on the release. Escape, the window losing focus and a lost release end the
/// drag with nothing changed, the rows back in their places.
fn row_drag(rig: &mut Rig, elsewhere: AnyWindowHandle) {
    let y = |rig: &mut Rig, id: &str| rig.center(&format!("session-button:{id}")).1;
    let bravo = rig.center("session-button:bravo");
    let charlie = rig.center("session-button:charlie");
    let alpha_y = y(rig, "alpha");
    let step = charlie.1 - bravo.1;
    assert!(step > 10., "rows a row apart: {step}");
    let below = (bravo.0, charlie.1 + step / 2.);
    let near = |a: f32, b: f32| (a - b).abs() < 1.;
    let in_place = |rig: &mut Rig| {
        near(y(rig, "alpha"), alpha_y)
            && near(y(rig, "bravo"), bravo.1)
            && near(y(rig, "charlie"), charlie.1)
    };

    // Without a press nothing is forwarded, wherever the pointer goes.
    let before = rig.forwarded();
    rig.moved(charlie, false);
    rig.moved(bravo, true);
    assert_eq!(rig.forwarded(), before, "no press, nothing forwarded");

    // Bravo dragged below charlie: under a few pixels it is still a press; past them it follows
    // the pointer (kept inside the list) and charlie slides up into its place.
    rig.asked();
    rig.down(bravo);
    rig.moved((bravo.0, bravo.1 + 2.), true);
    assert_eq!(rig.forwarded()["phase"], "move", "the press is followed");
    assert!(in_place(rig), "a few pixels move nothing");
    rig.moved((below.0, below.1 - 1.), true);
    rig.moved(below, true);
    assert!(
        near(y(rig, "bravo"), charlie.1) && near(y(rig, "charlie"), bravo.1),
        "bravo follows the pointer, charlie slides into its place: {} {}",
        y(rig, "bravo"),
        y(rig, "charlie")
    );
    assert!(
        session_orders(rig.asked()).is_empty(),
        "nothing is asked while dragging"
    );
    rig.up(below);
    assert_eq!(
        session_orders(rig.asked()),
        [strings(&["alpha", "charlie", "bravo"])],
        "the order goes to the core once, on the release"
    );
    assert_eq!(rig.forwarded()["phase"], "up");
    // The order is shown at once, as the web's store does, before the core's broadcast.
    assert!(
        near(y(rig, "alpha"), alpha_y)
            && near(y(rig, "charlie"), bravo.1)
            && near(y(rig, "bravo"), charlie.1),
        "the rows show the new order at once"
    );
    // The core's own word replaces it (here, a list from a core that never kept the move).
    let fresh = state().model();
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(fresh), cx))
    });
    assert!(in_place(rig), "the core's order is what stays");
    assert_eq!(
        rig.tabs().2.as_deref(),
        Some("alpha"),
        "the release is no click"
    );
    let ended = rig.forwarded();
    rig.moved(charlie, true);
    rig.moved(bravo, false);
    assert_eq!(
        rig.forwarded(),
        ended,
        "nothing is forwarded after the release"
    );

    // Each way out that is not a release: the rows go back and a later release sends nothing.
    let drag = |rig: &mut Rig| {
        rig.down(bravo);
        rig.moved((below.0, below.1 - 1.), true);
        rig.moved(below, true);
        assert!(near(y(rig, "charlie"), bravo.1), "the drag is under way");
    };
    let nothing_changed = |rig: &mut Rig, how: &str| {
        assert_eq!(rig.forwarded()["phase"], "cancel", "{how}");
        assert!(in_place(rig), "{how}: the rows are back");
        rig.up(below);
        rig.draw();
        assert!(
            session_orders(rig.asked()).is_empty(),
            "{how}: no order is sent"
        );
        assert!(in_place(rig), "{how}");
    };
    drag(rig);
    rig.press("escape");
    nothing_changed(rig, "Escape");

    drag(rig);
    rig.moved((below.0 + 3., below.1), false);
    nothing_changed(rig, "a lost release");

    let activate = |rig: &mut Rig, window: AnyWindowHandle| {
        rig.cx
            .update_window(window, |_, window, _| window.activate_window())
            .unwrap();
        rig.cx.run_until_parked();
        rig.draw();
    };
    let home: AnyWindowHandle = rig.window.into();
    activate(rig, home);
    drag(rig);
    activate(rig, elsewhere);
    assert_eq!(rig.forwarded()["phase"], "cancel", "losing focus");
    activate(rig, home);
    nothing_changed(rig, "losing focus");
}

fn session_menu(rig: &mut Rig) {
    // bravo has no tab: its row's menu is the tab menu for bravo, at the press, with the
    // sidebar's own rows and its inbound choices after the split rows.
    let (x, y) = rig.right_click("session-button:bravo");
    assert_eq!(rig.open_screens(), ["tab-menu"]);
    let menu = rig.record("tab-menu").expect("the menu is drawn");
    assert_eq!(menu.bounds.origin, point(px(x), px(y)), "at the press");
    // Beside it, its workspace's sessions, as the web's strip for that workspace: alpha's tab,
    // then charlie, which has none.
    let rows = rig.keys("tab-menu-item");
    assert_eq!(
        &rows[..3],
        strings(&[
            "tab-menu-rename",
            "tab-menu-split-right",
            "tab-menu-split-below"
        ])
    );
    assert!(
        rig.record("tab-menu-show-beside").is_some(),
        "one Show beside row"
    );
    rig.click("tab-menu-show-beside");
    assert_eq!(
        rig.keys("tab-menu-beside-item"),
        strings(&["tab-split-with-alpha", "tab-split-with-charlie"])
    );
    assert!(
        rows.iter()
            .any(|r| r.starts_with("workspace-session-move-")),
        "the sidebar's move rows: {rows:?}"
    );
    assert!(
        rows.contains(&"session-inbound-hold-bravo".to_string()),
        "{rows:?}"
    );
    assert_eq!(rows.last().map(String::as_str), Some("tab-menu-close"));
    // Dismissed, nothing changes.
    rig.press("escape");
    assert!(rig.open_screens().is_empty());
    assert_eq!(
        rig.tabs(),
        (
            strings(&["alpha", "bravo", "charlie"]),
            strings(&["alpha"]),
            Some("alpha".into())
        )
    );

    // Rename tab renames bravo's session, which is not shown.
    rig.right_click("session-button:bravo");
    rig.asked();
    rig.click("tab-menu-item:tab-menu-rename");
    rig.type_text("Bravo two");
    rig.press("enter");
    assert!(rig.open_screens().is_empty(), "Enter saved it");
    let renamed = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Rename { session_id, title } if session_id == "bravo" && title == "Bravo two")
    });
    assert!(renamed, "bravo is renamed");
    assert_eq!(rig.tabs().2.as_deref(), Some("alpha"), "and is not shown");

    // Show beside alpha: bravo's tab opens with alpha beside it (the web's `joinSplit` puts the
    // other tab after the menu's), and bravo has the keyboard.
    rig.right_click("session-button:bravo");
    rig.click("tab-menu-show-beside");
    rig.click("tab-menu-beside-item:tab-split-with-alpha");
    assert!(rig.open_screens().is_empty());
    assert_eq!(
        rig.tabs(),
        (
            strings(&["alpha", "bravo", "charlie"]),
            strings(&["bravo", "alpha"]),
            Some("bravo".into())
        )
    );
    rig.ws(|ws, window, cx| {
        ws.run_command("pane.unsplit", Some(&json!({"id": "bravo"})), window, cx)
    })
    .unwrap();

    // Bravo put away: charlie's menu shows bravo beside it, and its tab opens again.
    rig.ws(|ws, window, cx| {
        ws.run_command("tabs.close", Some(&json!({"id": "bravo"})), window, cx)
    })
    .unwrap();
    rig.draw();
    // Bravo's terminal is attached to nothing: the close guard asks first, and Keep running puts
    // the tab away.
    rig.click("confirm-extra");
    assert_eq!(
        rig.tabs().0,
        strings(&["alpha", "charlie"]),
        "bravo's tab is put away"
    );
    rig.right_click("session-button:charlie");
    rig.click("tab-menu-show-beside");
    rig.click("tab-menu-beside-item:tab-split-with-bravo");
    // The strip lists them in the sidebar's order, whatever order they opened in.
    assert_eq!(
        rig.tabs(),
        (
            strings(&["alpha", "bravo", "charlie"]),
            strings(&["charlie", "bravo"]),
            Some("charlie".into())
        )
    );

    // An inbound choice is asked of the core.
    rig.right_click("session-button:charlie");
    rig.asked();
    rig.click("tab-menu-item:session-inbound-refuse-charlie");
    let refused = rig.asked().into_iter().any(|c| {
        matches!(c, Command::InboundMode { session_id, mode } if session_id == "charlie" && mode == "refuse")
    });
    assert!(refused, "refuse is asked for");
    println!("session-menu: ok");
}

/// The sidebar's actions on what the core keeps: each asks the core, names its target and is
/// refused for one the core does not have; the ones that end something ask first where the web
/// does.
fn sidebar_commands(rig: &mut Rig) {
    let run = |rig: &mut Rig, name: &str, args: Value| {
        rig.asked();
        let result = rig.ws(|ws, window, cx| ws.run_command(name, Some(&args), window, cx));
        rig.draw();
        (result, rig.asked())
    };

    // A session row's Move down puts it after the next one, in the order the core keeps.
    rig.right_click("session-button:bravo");
    rig.asked();
    rig.click("tab-menu-item:workspace-session-move-down-bravo");
    assert!(rig.open_screens().is_empty());
    let order = rig.asked().into_iter().find_map(|c| match c {
        Command::SetOrder {
            host_id,
            sessions,
            projects: None,
        } => Some((host_id, sessions)),
        _ => None,
    });
    assert_eq!(
        order,
        Some((
            "local".into(),
            Some(strings(&["alpha", "charlie", "bravo"]))
        )),
        "bravo goes after charlie"
    );
    let (refused, asked) = run(
        rig,
        "session.move",
        json!({"id": "nope", "target": "alpha", "siblings": []}),
    );
    assert!(
        refused.is_err() && asked.is_empty(),
        "an unknown session is refused"
    );
    // A sibling the core does not list on this computer never goes into its order.
    let (_, asked) = run(
        rig,
        "session.move",
        json!({"id": "alpha", "target": "charlie", "after": true,
               "siblings": ["ghost", "bravo", "charlie", "alpha"]}),
    );
    let written = asked.into_iter().find_map(|c| match c {
        Command::SetOrder { sessions, .. } => sessions,
        _ => None,
    });
    assert!(
        written.as_ref().is_some_and(
            |ids| !ids.contains(&"ghost".to_string()) && ids.contains(&"alpha".to_string())
        ),
        "{written:?}"
    );
    // Nor does a target on another computer: the move is refused.
    let with_remote = |rig: &mut Rig, remote: bool| {
        let mut state = state();
        if remote {
            state.apply(&message(
                json!({"type": "session.updated", "session": {"id": "far",
                "title": "far", "cwd": "/work", "createdAt": 9, "status": "idle",
                "hostId": "buildbox", "cliProviderId": "claude"}}),
            ));
        }
        let model = state.model();
        rig.ws(|ws, _, cx| {
            ws.sidebar()
                .update(cx, |s, cx| s.apply(Update::Model(model), cx))
        });
        rig.draw();
    };
    with_remote(rig, true);
    let (refused, asked) = run(
        rig,
        "session.move",
        json!({"id": "alpha", "target": "far", "siblings": ["alpha", "bravo"]}),
    );
    assert!(
        refused.is_err() && asked.is_empty(),
        "another computer's target is refused: {asked:?}"
    );
    with_remote(rig, false);

    // Deleting a session asks the core; its tab stays until the core says it is gone.
    let (result, asked) = run(rig, "session.close", json!({"id": "bravo"}));
    assert_eq!(result, Ok(()));
    assert!(
        matches!(&asked[..], [Command::DeleteSession { session_id, .. }] if session_id == "bravo")
    );
    assert!(
        rig.tabs().0.contains(&"bravo".to_string()),
        "the tab waits for the core"
    );

    // Closing a project ends its sessions: only with the answer to the sidebar's question.
    let (result, asked) = run(rig, "project.close", json!({"id": "p"}));
    assert!(result.unwrap_err().contains("confirmed"));
    assert!(asked.is_empty(), "nothing is asked without the answer");
    let (_, asked) = run(rig, "project.close", json!({"id": "p", "confirmed": true}));
    assert!(matches!(&asked[..], [Command::RemoveProject { project_id }] if project_id == "p"));
    let (refused, _) = run(
        rig,
        "project.close",
        json!({"id": "nope", "confirmed": true}),
    );
    assert!(refused.is_err());

    let (_, asked) = run(rig, "project.rename", json!({"id": "p", "name": " Play "}));
    assert!(matches!(&asked[..], [Command::RenameProject { name, .. }] if name == "Play"));
    let (_, asked) = run(
        rig,
        "project.move",
        json!({"id": "p", "target": "p", "after": true}),
    );
    assert!(
        matches!(&asked[..], [Command::SetOrder { projects: Some(p), .. }] if *p == strings(&["p"]))
    );
    let (_, asked) = run(rig, "project.new", json!({"folder": "/play"}));
    assert!(matches!(&asked[..], [Command::CreateProject { path, .. }] if path == "/play"));
    let (_, asked) = run(rig, "workspace.rename", json!({"id": "w1", "name": "main"}));
    assert!(
        matches!(&asked[..], [Command::RenameWorkspace { workspace_id, name }] if workspace_id == "w1" && name == "main")
    );
    let (_, asked) = run(rig, "workspace.hide", json!({"id": "w1", "hidden": false}));
    assert!(matches!(
        &asked[..],
        [Command::HideWorkspace { hidden: false, .. }]
    ));
    let (_, asked) = run(rig, "workspace.restore", json!({"id": "w1"}));
    assert!(matches!(&asked[..], [Command::RestoreWorkspace { .. }]));
    let (refused, _) = run(rig, "workspace.restore", json!({"id": "nope"}));
    assert!(refused.is_err());
    let (_, asked) = run(rig, "host.refresh", json!({"id": "local"}));
    assert!(matches!(&asked[..], [Command::RefreshHost(h)] if h == "local"));

    // The view's own: a project by position, and a workspace shown with its session last shown.
    let (result, _) = run(rig, "project.select", json!({"index": 1}));
    assert_eq!(result, Ok(()));
    let (result, _) = run(rig, "project.select", json!({"index": 2}));
    assert_eq!(result, Err("There is no project 2.".into()));
    rig.ws(|ws, window, cx| {
        ws.run_command("tab.select", Some(&json!({"id": "alpha"})), window, cx)
    })
    .unwrap();
    let (result, _) = run(rig, "workspace.open", json!({"id": "w1"}));
    assert_eq!(result, Ok(()));
    let last = rig.tabs().0.last().cloned();
    assert_eq!(rig.tabs().2, last, "its last tab is shown");

    // A folder row shows the folder's newest session on the shown computer; a folder or computer
    // without sessions is refused and nothing changes.
    rig.ws(|ws, window, cx| {
        ws.run_command("tab.select", Some(&json!({"id": "alpha"})), window, cx)
    })
    .unwrap();
    let (result, asked) = run(rig, "folder.select", json!({"cwd": "/work"}));
    assert_eq!(result, Ok(()));
    assert_eq!(
        rig.tabs().2.as_deref(),
        Some("charlie"),
        "the newest is shown"
    );
    assert!(
        asked
            .iter()
            .all(|c| matches!(c, Command::View(id) if id == "charlie")),
        "only the view is told: {asked:?}"
    );
    for args in [
        json!({}),
        json!({"cwd": "/elsewhere"}),
        json!({"cwd": "/work", "host": "buildbox"}),
    ] {
        let (refused, asked) = run(rig, "folder.select", args.clone());
        assert!(refused.is_err() && asked.is_empty(), "{args} is refused");
        assert_eq!(rig.tabs().2.as_deref(), Some("charlie"));
    }
    println!("sidebar-commands: ok");
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-sidebar-actions-{}", std::process::id()));
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
    let model = state().model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    // Another window, to take the focus from this one.
    let elsewhere: AnyWindowHandle = cx
        .open_window(size(px(100.), px(100.)), |_, cx| cx.new(|_| Blank))
        .unwrap()
        .into();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    // Every session of alpha's workspace has a tab.
    assert_eq!(rig.tabs().0, strings(&["alpha", "bravo", "charlie"]));

    // Manual order, as the Move rows need (sorting by attention is a view, with no Move).
    let perch = rig.cx.update(|cx| cx.global::<WindowMods>().perch.clone());
    let mut settings = perch.sidebar();
    settings.sort_by_attention = false;
    perch.set_sidebar(settings);
    rig.cx.update(|cx| perch.flush(cx));
    rig.draw();
    row_drag(&mut rig, elsewhere);
    session_menu(&mut rig);
    sidebar_commands(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_sidebar_actions: ok");
}
