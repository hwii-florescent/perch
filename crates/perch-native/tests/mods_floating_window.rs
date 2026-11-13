//! The stock floating screens in a real window: the web's own screens, unchanged, through the
//! native React runtime, opened by the window's real callers, their results acted on by the window,
//! closed by Escape and by a press outside their panel, the keyboard back on the terminal after.
//!
//! - Navigator: the Navigator's key opens it over the whole window; typing narrows it; Enter or a
//!   click on a row shows that session; Escape, the key again, or a press on the dim backdrop closes
//!   it without anything beneath taking the press.
//! - Pane menu: a right-click in a pane opens it at the press; Rename pane turns it into a field
//!   that has the keyboard, and Enter or OK renames that pane's session; Escape and a press outside
//!   close it without anything beneath taking the press.
//! - New session: the sidebar's New session opens the menu with the keyboard, its agent picker and
//!   the computer's projects then No project; a project or No project starts the picked agent there
//!   (a Quickchat for No project); Escape and a press outside close it without anything beneath
//!   taking the press. Cmd+T opens the tab strip's launcher below its "+". The agent dropdown
//!   lists the agents below it, and the one picked is the one started.
//! - Dialog: a script opens it with the file menu's New file prompt; a path typed (or typed over
//!   all of the field after Cmd+A) and Enter close it with the create action; Escape and a press on
//!   the dim backdrop close it with nothing.
//! - Notifications: a session's card opens that session and goes; × only puts it away; a usage
//!   alert's card opens nothing; a mod's runs its action; a card goes by itself; the keyboard stays on the terminal and a
//!   press beside a card reaches what is beneath.
//! - Confirmation: closing an agent's tab asks through the close guard drawn in the confirmation;
//!   Escape and a press on the dim backdrop cancel and keep the tab, Keep running puts the tab
//!   away without ending it, and Enter stops it (with Don't show again, the warning is turned off).
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Command;
use perch_native::mods::{self, POLL};
use perch_native::sidebar::{Alert, Heard, State, Toast};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::ui::{OpenSession, Workspace};
use perch_native::workspace::Notice;
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;

const WIDTH: f32 = 1000.;
const HEIGHT: f32 = 700.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Project `p` on this computer, holding `alpha` and `bravo` (Claude sessions).
fn state() -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "inbound.v1"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project]})));
    let sessions: Vec<Value> = ["alpha", "bravo"]
        .iter()
        .enumerate()
        .map(|(i, title)| {
            json!({"id": title, "title": title, "cwd": "/work", "createdAt": i, "status": "idle",
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"})
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
    opened: Rc<RefCell<Vec<OpenSession>>>,
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

    /// A left press and release at `(x, y)`, through the window's dispatch.
    fn mouse(&mut self, x: f32, y: f32) {
        self.mouse_with(MouseButton::Left, x, y);
    }

    fn mouse_with(&mut self, button: MouseButton, x: f32, y: f32) {
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

    /// A left press, a move with it held or its release at `(x, y)`, through the window's
    /// dispatch.
    fn down(&mut self, (x, y): (f32, f32)) {
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
    }

    fn held_to(&mut self, (x, y): (f32, f32)) {
        self.input(PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(x), px(y)),
            pressed_button: Some(MouseButton::Left),
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

    fn center(&mut self, name: &str) -> (f32, f32) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        (f32::from(at.x), f32::from(at.y))
    }

    /// A click in the middle of what is named `name`.
    fn click(&mut self, name: &str) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        self.mouse(f32::from(at.x), f32::from(at.y));
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

    fn terminal_focused(&mut self) -> bool {
        self.ws(|ws, window, cx| {
            ws.terminal()
                .expect("a terminal")
                .focus_handle(cx)
                .is_focused(window)
        })
    }

    /// What the window asked the core for since the last call.
    fn asked(&mut self) -> Vec<Command> {
        std::iter::from_fn(|| self.asked.try_recv().ok()).collect()
    }

    fn shown(&mut self) -> Option<String> {
        self.ws(|ws, _, _| ws.open().map(|o| o.session_id.clone()))
    }
}

fn navigator(rig: &mut Rig) {
    let toggle = if cfg!(target_os = "macos") {
        "cmd-p"
    } else {
        "ctrl-p"
    };
    // The Navigator's key opens the stock Navigator over the whole window, its field holding the
    // keyboard, every session listed.
    rig.press(toggle);
    assert_eq!(rig.open_screens(), ["navigator"]);
    let scrim = rig
        .record("navigator-scrim")
        .expect("the backdrop is drawn");
    assert_eq!(
        (scrim.bounds.size.width, scrim.bounds.size.height),
        (px(WIDTH), px(HEIGHT)),
        "the backdrop covers the window"
    );
    let panel = rig.record("navigator-panel").expect("the palette is drawn");
    assert_eq!(panel.bounds.size.width, px(560.), "the web's width");
    assert_eq!(
        panel.bounds.origin.y,
        px((HEIGHT * 0.12).round()),
        "12% of the window down"
    );
    assert!(!rig.terminal_focused(), "the Navigator has the keyboard");
    let rows = rig.keys("navigator-row");
    assert_eq!(rows, ["bravo", "alpha"], "newest first");

    // Typing narrows the list; Escape closes it and the terminal has the keyboard again.
    rig.type_text("brav");
    assert_eq!(rig.keys("navigator-row"), ["bravo"]);
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused(), "the terminal has the keyboard back");
    assert_eq!(rig.shown().as_deref(), Some("alpha"), "nothing was picked");

    // Enter picks the highlighted row: the window shows that session.
    rig.press(toggle);
    rig.type_text("brav");
    rig.press("enter");
    assert!(rig.open_screens().is_empty(), "Enter closed it");
    assert_eq!(
        rig.shown().as_deref(),
        Some("bravo"),
        "switchTo reached the window"
    );

    // A click on a row picks it too.
    rig.press(toggle);
    rig.click("navigator-row:alpha");
    assert!(rig.open_screens().is_empty());
    assert_eq!(rig.shown().as_deref(), Some("alpha"));

    // A press on the backdrop closes it, and nothing beneath takes that press (the sidebar's
    // first row sits under this corner).
    let before = rig.opened.borrow().len();
    rig.press(toggle);
    assert_eq!(rig.open_screens(), ["navigator"]);
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert_eq!(
        rig.opened.borrow().len(),
        before,
        "nothing beneath was pressed"
    );
    assert!(rig.terminal_focused());

    // A press on the panel, off its rows, keeps it open; the Navigator's key closes it.
    rig.press(toggle);
    let chips = rig.record("navigator-chips").unwrap().bounds;
    rig.mouse(
        f32::from(chips.origin.x + chips.size.width - px(10.)),
        f32::from(chips.center().y),
    );
    assert_eq!(rig.open_screens(), ["navigator"], "a press inside keeps it");
    rig.press(toggle);
    assert!(rig.open_screens().is_empty(), "its key closes it");
    assert!(rig.terminal_focused());
    println!("navigator: ok");
}

fn pane_menu(rig: &mut Rig) {
    // A right-click in the pane opens the stock menu at the press, with the keyboard.
    let (x, y) = (600., 300.);
    rig.mouse_with(MouseButton::Right, x, y);
    assert_eq!(rig.open_screens(), ["pane-menu"]);
    let panel = rig.record("pane-menu").expect("the menu is drawn");
    assert_eq!(panel.bounds.origin, point(px(x), px(y)), "at the press");
    let rows = rig.keys("pane-menu-item");
    assert_eq!(
        rows,
        [
            "split-right",
            "split-down",
            "split-session",
            "split-tab",
            "zoom",
            "rename",
            "close"
        ],
        "no Stop agent (nothing to stop)"
    );

    // Escape closes it and the terminal has the keyboard again.
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused());

    // A press outside closes it, and nothing beneath takes that press (the sidebar's first row
    // sits under this corner).
    let before = rig.opened.borrow().len();
    rig.mouse_with(MouseButton::Right, x, y);
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the press outside closed it");
    assert_eq!(
        rig.opened.borrow().len(),
        before,
        "nothing beneath was pressed"
    );
    assert!(rig.terminal_focused());

    // Rename pane: the rows become a field holding the title, with the keyboard; Enter renames
    // the pane's session.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.asked();
    rig.click("pane-menu-item:rename");
    assert_eq!(rig.open_screens(), ["pane-menu"], "a press inside keeps it");
    assert!(rig.record("pane-menu-rename-input").is_some());
    assert!(!rig.terminal_focused(), "the field has the keyboard");
    rig.type_text(" two");
    rig.press("enter");
    assert!(rig.open_screens().is_empty(), "Enter closed it");
    let renamed = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Rename { session_id, title } if session_id == "alpha" && title == "alpha two")
    });
    assert!(renamed, "the rename reached the window and its core");
    assert!(rig.terminal_focused());

    // OK renames too.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("pane-menu-item:rename");
    rig.type_text("3");
    rig.click("pane-menu-rename-confirm");
    assert!(rig.open_screens().is_empty());
    let renamed = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Rename { session_id, title } if session_id == "alpha" && title == "alpha3")
    });
    assert!(renamed, "OK renamed it");
    println!("pane-menu: ok");
}

/// The panes on screen, in layout order, and the one with the keyboard.
fn panes(rig: &mut Rig) -> (Vec<String>, Option<String>) {
    rig.ws(|ws, _, _| (ws.tabs().shown(), ws.tabs().active().map(str::to_string)))
}

fn split_with_session(rig: &mut Rig) {
    let (x, y) = (600., 300.);
    assert_eq!(panes(rig), (vec!["alpha".into()], Some("alpha".into())));

    // Add session inside this tab: the Split with session picker opens where the menu was, listing
    // every other session; dismissed, nothing changes.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("pane-menu-item:split-session");
    assert_eq!(rig.open_screens(), ["session-split"]);
    let picker = rig.record("session-split").expect("the picker is drawn");
    assert_eq!(
        picker.bounds.origin,
        point(px(x), px(y)),
        "at the menu's place"
    );
    assert_eq!(
        rig.keys("session-split-option"),
        ["bravo"],
        "not the pane's own"
    );
    rig.press("escape");
    assert!(rig.open_screens().is_empty());
    assert_eq!(panes(rig), (vec!["alpha".into()], Some("alpha".into())));

    // A session picked shows on the right of the pane, with the keyboard.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("pane-menu-item:split-session");
    rig.click("session-split-option:bravo");
    assert!(rig.open_screens().is_empty());
    assert_eq!(
        panes(rig),
        (vec!["alpha".into(), "bravo".into()], Some("bravo".into()))
    );

    // Show beside an open tab: the tab menu opens for the pane, offering the open tabs it can
    // take; Show this tab full size takes the pane out, Separate all dissolves the split.
    rig.ws(|ws, window, cx| {
        ws.run_command("pane.unsplit", Some(&json!({"id": "bravo"})), window, cx)
    })
    .unwrap();
    rig.ws(|ws, window, cx| {
        ws.run_command("tab.select", Some(&json!({"id": "alpha"})), window, cx)
    })
    .unwrap();
    assert_eq!(panes(rig), (vec!["alpha".into()], Some("alpha".into())));
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("pane-menu-item:split-tab");
    assert_eq!(rig.open_screens(), ["tab-menu"]);
    assert_eq!(
        rig.keys("tab-menu-item"),
        [
            "tab-menu-rename",
            "tab-menu-split-right",
            "tab-menu-split-below",
            "tab-split-with-bravo",
            "session-inbound-accept-alpha",
            "session-inbound-hold-alpha",
            "session-inbound-refuse-alpha",
            "tab-menu-close"
        ]
    );
    rig.click("tab-menu-item:tab-split-with-bravo");
    assert!(rig.open_screens().is_empty());
    assert_eq!(
        panes(rig),
        (vec!["alpha".into(), "bravo".into()], Some("alpha".into())),
        "bravo beside alpha, which keeps the keyboard"
    );
    rig.mouse_with(MouseButton::Right, x / 2. + 120., y);
    rig.click("pane-menu-item:split-tab");
    assert_eq!(
        rig.keys("tab-menu-item"),
        [
            "tab-menu-rename",
            "tab-menu-split-right",
            "tab-menu-split-below",
            "tab-unsplit",
            "tab-untile-all",
            "session-inbound-accept-alpha",
            "session-inbound-hold-alpha",
            "session-inbound-refuse-alpha",
            "tab-menu-close"
        ],
        "in a split, with no other tab to offer"
    );
    rig.click("tab-menu-item:tab-untile-all");
    assert_eq!(panes(rig), (vec!["alpha".into()], Some("alpha".into())));
    println!("split-with-session: ok");
}

fn tab_menu(rig: &mut Rig) {
    // bravo is a tab: a right-click on it in the strip opens its menu at the press, and does not
    // show it.
    assert!(tabs(rig).contains(&"bravo".to_string()));
    let at = rig
        .record("tab:bravo")
        .expect("bravo's tab")
        .bounds
        .center();
    let (x, y) = (f32::from(at.x), f32::from(at.y));
    rig.mouse_with(MouseButton::Right, x, y);
    assert_eq!(rig.open_screens(), ["tab-menu"]);
    let menu = rig.record("tab-menu").expect("the menu is drawn");
    assert_eq!(menu.bounds.origin, point(px(x), px(y)), "at the press");
    assert_eq!(
        rig.shown().as_deref(),
        Some("alpha"),
        "a right-click selects nothing"
    );
    assert_eq!(
        rig.keys("tab-menu-item"),
        [
            "tab-menu-rename",
            "tab-menu-split-right",
            "tab-menu-split-below",
            "tab-split-with-alpha",
            "session-inbound-accept-bravo",
            "session-inbound-hold-bravo",
            "session-inbound-refuse-bravo",
            "tab-menu-close"
        ]
    );
    // The session's inbound choices, the current one ticked; another one picked is asked of the
    // core, which the menu then follows.
    let props = rig
        .ws(|ws, _, _| ws.screen_props("tab-menu").cloned())
        .unwrap();
    assert_eq!(
        props["extraItems"][0]["label"], "\u{2713} Accept messages from other sessions",
        "accept is ticked"
    );
    rig.asked();
    rig.click("tab-menu-item:session-inbound-hold-bravo");
    assert!(rig.open_screens().is_empty());
    let held = rig.asked().into_iter().any(|c| {
        matches!(c, Command::InboundMode { session_id, mode } if session_id == "bravo" && mode == "hold")
    });
    assert!(held, "hold is asked for");
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("tab-menu-item:session-inbound-accept-bravo");
    assert!(rig.asked().is_empty(), "the current choice asks nothing");
    rig.mouse_with(MouseButton::Right, x, y);
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused());

    // Rename tab: a field holding the tab's title, all of it selected, with the keyboard; what is
    // typed replaces it and Save renames bravo's session.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.asked();
    rig.click("tab-menu-item:tab-menu-rename");
    assert!(rig.record("tab-menu-rename-input").is_some());
    rig.type_text("Bravo two");
    rig.click("tab-menu-rename-save");
    assert!(rig.open_screens().is_empty());
    let renamed = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Rename { session_id, title } if session_id == "bravo" && title == "Bravo two")
    });
    assert!(renamed, "Save renamed bravo");
    assert_eq!(rig.shown().as_deref(), Some("alpha"));

    // Split right with new terminal: bravo gets the keyboard and a terminal is started beside it.
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("tab-menu-item:tab-menu-split-right");
    assert_eq!(
        rig.shown().as_deref(),
        Some("bravo"),
        "the split is made on bravo"
    );
    let launched = rig
        .asked()
        .into_iter()
        .any(|c| matches!(c, Command::Launch { provider, .. } if provider == "terminal"));
    assert!(launched, "a new terminal is asked for");
    rig.ws(|ws, window, cx| {
        ws.run_command("tab.select", Some(&json!({"id": "alpha"})), window, cx)
    })
    .unwrap();

    // Close tab is the tab's ×: bravo's terminal is attached to nothing, so the tab is put away
    // and its session is not ended (the close guard of an attached agent is `confirm`'s test).
    rig.mouse_with(MouseButton::Right, x, y);
    rig.click("tab-menu-item:tab-menu-close");
    assert!(!tabs(rig).contains(&"bravo".to_string()), "the tab went");
    let notice = rig.ws(|ws, _, _| ws.notice().map(str::to_string));
    assert!(
        notice.is_some_and(|n| n.contains("keeps running")),
        "and says the session was not ended"
    );
    rig.draw();
    println!("tab-menu: ok");
}

/// Attaches the tab with the keyboard to a stand-in core: what it asks the core, and what the core says.
fn tab_drag(rig: &mut Rig) {
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "bravo".into(), Some("claude".into()), cx)
        })
    });
    let select = |rig: &mut Rig, id: &str| {
        rig.ws(|ws, window, cx| {
            ws.run_command("tab.select", Some(&json!({ "id": id })), window, cx)
        })
        .unwrap();
        rig.draw();
    };
    select(rig, "alpha");
    let layout = |rig: &mut Rig| rig.ws(|ws, _, _| (ws.tabs().strip().to_vec(), ws.tabs().shown()));
    let ids = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    assert_eq!(layout(rig), (ids(&["alpha", "bravo"]), ids(&["alpha"])));

    // A press that moves less than 5 px is a press: nothing is dragged.
    let tab = rig.center("tab:alpha");
    rig.down(tab);
    rig.held_to((tab.0 + 3., tab.1));
    assert!(rig.open_screens().is_empty());
    rig.up((tab.0 + 3., tab.1));
    assert_eq!(layout(rig), (ids(&["alpha", "bravo"]), ids(&["alpha"])));

    // On the strip the drop is a slot in it: past bravo's middle, alpha goes after it. The layer
    // is up while the tab is dragged, with no split to show; Escape ends it with nothing changed.
    let past = (rig.center("tab:bravo").0 + 20., tab.1);
    rig.down(tab);
    rig.held_to((tab.0 + 10., tab.1));
    rig.held_to(past);
    assert_eq!(rig.open_screens(), ["tab-drag"]);
    assert!(rig.record("tab-drag-layer").is_some(), "the layer is drawn");
    assert!(
        rig.record("tab-drop-zone").is_none(),
        "over the strip, no split"
    );
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape took the layer away");
    rig.up(past);
    assert_eq!(
        layout(rig),
        (ids(&["alpha", "bravo"]), ids(&["alpha"])),
        "and changed nothing"
    );
    rig.down(tab);
    rig.held_to((tab.0 + 10., tab.1));
    rig.held_to(past);
    rig.up(past);
    assert_eq!(
        layout(rig),
        (ids(&["bravo", "alpha"]), ids(&["alpha"])),
        "alpha went after bravo"
    );
    assert!(rig.open_screens().is_empty());

    // On a pane the drop splits on the side nearest the pointer: alpha dragged to the right edge
    // of bravo's pane shows beside it, on its right, with the keyboard. Its own pane takes nothing.
    select(rig, "bravo");
    let tab = rig.center("tab:alpha");
    let right = (WIDTH - 20., HEIGHT / 2.);
    rig.down(tab);
    rig.held_to((tab.0, tab.1 + 20.));
    rig.held_to(right);
    let zone = rig
        .record("tab-drop-zone:right")
        .expect("the right half a split takes");
    let middle = f32::from(zone.bounds.origin.x + zone.bounds.size.width / 2.);
    assert!(middle > WIDTH / 2., "the right half: {:?}", zone.bounds);
    rig.up(right);
    assert_eq!(
        layout(rig),
        (ids(&["bravo", "alpha"]), ids(&["bravo", "alpha"]))
    );
    assert_eq!(
        rig.shown().as_deref(),
        Some("alpha"),
        "the dropped tab has the keyboard"
    );
    assert!(rig.open_screens().is_empty());
    rig.ws(|ws, window, cx| {
        ws.run_command("pane.unsplit", Some(&json!({"id": "alpha"})), window, cx)
    })
    .unwrap();
    println!("tab-drag: ok");
}

fn link(
    rig: &mut Rig,
) -> (
    UnboundedReceiver<ToCore>,
    futures::channel::mpsc::UnboundedSender<FromCore>,
) {
    let (to_core, asked) = unbounded::<ToCore>();
    let (core, from_core) = unbounded::<FromCore>();
    rig.ws(|ws, _, cx| {
        let view = ws.terminal().expect("a terminal").clone();
        view.update(cx, |view, cx| view.link(to_core, from_core, cx))
    });
    core.unbounded_send(FromCore::Attached {
        replay: String::new(),
        input: true,
        resize: true,
        agent: None,
    })
    .unwrap();
    rig.draw();
    (asked, core)
}

fn ends(rx: &mut UnboundedReceiver<ToCore>) -> usize {
    std::iter::from_fn(|| rx.try_recv().ok())
        .filter(|m| *m == ToCore::End)
        .count()
}

fn tabs(rig: &mut Rig) -> Vec<String> {
    rig.ws(|ws, _, _| ws.tabs().strip().to_vec())
}

fn close_tab(rig: &mut Rig) {
    rig.ws(|ws, window, cx| ws.run_command("tabs.close", None, window, cx))
        .unwrap();
    rig.draw();
}

fn confirm(rig: &mut Rig) {
    let (mut to_core, _core) = link(rig);
    // Closing an agent's tab opens the close guard in the confirmation, centred, its Stop button
    // holding the keyboard.
    close_tab(rig);
    assert_eq!(rig.open_screens(), ["confirm"]);
    let panel = rig.record("confirm-panel").expect("the dialog is drawn");
    assert_eq!(panel.bounds.size.width, px(360.));
    assert_eq!(panel.bounds.origin.x, px((WIDTH - 360.) / 2.), "centred");
    assert!(rig.record("confirm-accept").is_some());
    assert!(!rig.terminal_focused(), "the dialog has the keyboard");

    // Escape cancels: the tab stays, nothing was ended, the terminal has the keyboard again.
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(tabs(rig).contains(&"alpha".to_string()), "kept");
    assert_eq!(ends(&mut to_core), 0);
    assert!(rig.terminal_focused());

    // A press on the backdrop cancels too, and nothing beneath takes it.
    let before = rig.opened.borrow().len();
    close_tab(rig);
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert_eq!(
        rig.opened.borrow().len(),
        before,
        "nothing beneath was pressed"
    );
    assert!(tabs(rig).contains(&"alpha".to_string()), "kept");
    assert_eq!(ends(&mut to_core), 0);
    assert!(rig.terminal_focused());

    // A press inside keeps it; Keep running puts the tab away and ends nothing.
    close_tab(rig);
    rig.click("confirm-message");
    assert_eq!(rig.open_screens(), ["confirm"], "a press inside keeps it");
    rig.click("confirm-extra");
    assert!(rig.open_screens().is_empty());
    assert!(
        !tabs(rig).contains(&"alpha".to_string()),
        "the tab was put away"
    );
    assert_eq!(ends(&mut to_core), 0, "and its agent keeps running");
    assert!(rig.ws(|ws, _, _| ws.notice().is_some_and(|n| n.contains("keeps running"))));

    // Opened again: Don't show again, then Enter stops it for everyone and turns the warning off.
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    let (mut to_core, core) = link(rig);
    close_tab(rig);
    // A click on the row's words ticks its box, as on the web.
    rig.click("confirm-extra@1");
    rig.asked();
    rig.press("enter");
    assert!(rig.open_screens().is_empty(), "Enter closed it");
    assert_eq!(ends(&mut to_core), 1, "Enter stopped it");
    let off = rig.asked().into_iter().any(|c| {
        matches!(c, Command::UpdateSettings(patch) if patch == serde_json::json!({"warnCloseAgent": false}))
    });
    assert!(off, "Don't show again turned the warning off");
    core.unbounded_send(FromCore::Ended).unwrap();
    rig.draw();
    assert!(
        !tabs(rig).contains(&"alpha".to_string()),
        "the tab goes once the core says it ended"
    );
    println!("confirm: ok");
}

/// The unscoped New session menu, as New quickchat opens it (Cmd+Shift+T is the launcher).
fn open_new_session(rig: &mut Rig) {
    rig.ws(|ws, window, cx| ws.run_command("nests.scratchpad", None, window, cx))
        .unwrap();
    rig.draw();
}

fn launched(rig: &mut Rig) -> Vec<(String, Option<String>, String)> {
    rig.asked()
        .into_iter()
        .filter_map(|c| match c {
            Command::Launch {
                host_id,
                cwd,
                provider,
            } => Some((host_id, cwd, provider)),
            _ => None,
        })
        .collect()
}

fn new_session(rig: &mut Rig) {
    // New quickchat opens the stock menu, unscoped: the agent picker, then the computer's
    // project and No project.
    open_new_session(rig);
    assert_eq!(rig.open_screens(), ["new-session"]);
    assert!(rig.record("launcher").is_some(), "the menu is drawn");
    assert!(rig.record("agent-select").is_some());
    assert_eq!(rig.keys("project-option"), ["0", "none"]);

    // Escape closes it and the terminal has the keyboard again.
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused());

    // A press outside closes it, and nothing beneath takes that press.
    let before = rig.opened.borrow().len();
    open_new_session(rig);
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the press outside closed it");
    assert_eq!(
        rig.opened.borrow().len(),
        before,
        "nothing beneath was pressed"
    );

    // A project starts the picked agent (the last pick, Claude) in its folder.
    rig.asked();
    open_new_session(rig);
    rig.click("project-option:0");
    assert!(rig.open_screens().is_empty(), "the pick closed it");
    assert_eq!(
        launched(rig),
        [("local".into(), Some("/work".into()), "claude".into())]
    );

    // No project starts a Quickchat.
    open_new_session(rig);
    rig.click("project-option:none");
    assert_eq!(launched(rig), [("local".into(), None, "claude".into())]);

    // Cmd+T, as the web's: the tab strip opens the menu for its workspace's folder (home here, with
    // no workspace open), below its "+".
    let plus = rig
        .record("tab-new")
        .expect("the tab strip draws its +")
        .bounds;
    rig.press(if cfg!(target_os = "macos") {
        "cmd-t"
    } else {
        "ctrl-t"
    });
    assert_eq!(rig.open_screens(), ["new-session"]);
    let props = rig
        .ws(|ws, _, _| ws.screen_props("new-session").cloned())
        .unwrap();
    assert_eq!(props["fixedCwd"], "~", "for the strip's folder");
    let anchor = &props["anchorRect"];
    assert_eq!(
        (anchor["x"].as_f64(), anchor["y"].as_f64()),
        (
            Some(f32::from(plus.origin.x).into()),
            Some(f32::from(plus.origin.y).into())
        ),
        "anchored to the +"
    );
    let panel = rig.record("launcher").expect("the menu is drawn").bounds;
    assert_eq!(
        panel.origin.y,
        plus.origin.y + plus.size.height + px(4.),
        "4px below the +"
    );
    assert!(
        rig.record("launcher-filter").is_some(),
        "the scoped launcher"
    );
    rig.press("escape");
    assert!(rig.open_screens().is_empty());
    assert!(rig.terminal_focused());

    // The agent dropdown is the web's: a press lists the agents under it, a pick is what starts.
    // Its rows match the parity table's launcher rows, so they carry those names here.
    open_new_session(rig);
    let trigger = rig.record("agent-select").expect("the dropdown").bounds;
    assert!(rig.record("launcher-option").is_none(), "closed at first");
    rig.click("agent-select");
    let rows: Vec<_> = ["launcher-option", "launcher-option@1"]
        .iter()
        .map(|name| {
            rig.record(name)
                .expect("Claude and Codex are listed")
                .bounds
        })
        .collect();
    assert!(
        rows[0].origin.y >= trigger.origin.y + trigger.size.height,
        "below the dropdown"
    );
    assert!(rig.record("launcher-option@2").is_none(), "two agents");
    assert_eq!(rig.open_screens(), ["new-session"], "the menu stays");
    rig.asked();
    rig.click("launcher-option@1");
    assert!(
        rig.record("launcher-option").is_none(),
        "a pick closes the list"
    );
    rig.click("project-option:0");
    assert_eq!(
        launched(rig),
        [("local".into(), Some("/work".into()), "codex".into())],
        "Codex, as picked"
    );
    println!("new-session: ok");
}

/// Opens the dialog as a script does, with the New file prompt for `/work`; what it closes with
/// goes to `results`.
fn open_dialog(rig: &mut Rig, results: &Rc<RefCell<Vec<Value>>>) {
    let seen = results.clone();
    let props = json!({"workspaceId": "w", "workspacePath": "/work", "x": 0, "y": 0,
        "initialStage": "newFile", "nativeAvailable": true, "canAsk": true});
    let opened = rig.ws(move |ws, _, cx| {
        ws.open_screen(
            "dialog",
            props,
            None,
            Some(Box::new(move |_, result, _, _| {
                seen.borrow_mut().push(result)
            })),
            cx,
        )
    });
    assert!(opened, "the stock dialog draws the dialog screen");
    rig.draw();
    assert_eq!(rig.open_screens(), ["dialog"]);
}

fn dialog(rig: &mut Rig) {
    let results: Rc<RefCell<Vec<Value>>> = Rc::default();
    // The field holds the folder; a name typed after it and Enter create the file there.
    open_dialog(rig, &results);
    let panel = rig
        .record("dialog-panel")
        .expect("the panel is drawn")
        .bounds;
    assert_eq!(
        panel.origin.x,
        px((WIDTH - 480.) / 2.),
        "centred, 480px wide"
    );
    assert!(!rig.terminal_focused(), "the dialog has the keyboard");
    rig.type_text("notes.md");
    rig.press("enter");
    assert!(rig.open_screens().is_empty(), "Enter closed it");
    assert_eq!(
        results.borrow_mut().drain(..).collect::<Vec<_>>(),
        [json!({"action": "createFileAt", "args": ["/work", "notes.md"]})]
    );
    assert!(rig.terminal_focused());

    // Cmd+A, then a path typed over all of it.
    open_dialog(rig, &results);
    rig.press(if cfg!(target_os = "macos") {
        "cmd-a"
    } else {
        "ctrl-a"
    });
    rig.type_text("/tmp/plan.md");
    rig.click("dialog-confirm");
    assert_eq!(
        results.borrow_mut().drain(..).collect::<Vec<_>>(),
        [json!({"action": "createFileAt", "args": ["/tmp", "plan.md"]})]
    );

    // Escape, and a press on the backdrop, close it with nothing; nothing beneath takes the press.
    open_dialog(rig, &results);
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    open_dialog(rig, &results);
    rig.click("dialog-title");
    assert_eq!(rig.open_screens(), ["dialog"], "a press inside keeps it");
    let before = rig.opened.borrow().len();
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert_eq!(rig.opened.borrow().len(), before, "nothing beneath");
    assert_eq!(
        results.borrow_mut().drain(..).collect::<Vec<_>>(),
        [Value::Null, Value::Null]
    );
    assert!(rig.terminal_focused());
    println!("dialog: ok");
}

fn heard(alert: Alert, session_id: &str, title: &str, body: Option<&str>) -> Heard {
    Heard {
        alert,
        session_id: session_id.into(),
        title: title.into(),
        sound: false,
        file: None,
        toast: Toast::App,
        body: body.map(str::to_string),
    }
}

fn toast(rig: &mut Rig) {
    // A finished session's card, top right; the terminal keeps the keyboard.
    rig.ws(|ws, _, cx| ws.toast(heard(Alert::Done, "bravo", "bravo", None), cx));
    rig.draw();
    assert_eq!(rig.open_screens(), ["toast"]);
    let card = rig.record("toast-card").expect("the card is drawn").bounds;
    assert_eq!(
        card.origin.x + card.size.width,
        px(WIDTH - 12.),
        "12px from the right"
    );
    assert_eq!(card.origin.y, px(12.), "12px from the top");
    assert!(rig.terminal_focused(), "the keyboard stays on the terminal");
    // A press beside the card reaches the terminal beneath, and the card stays.
    rig.mouse(WIDTH / 2., HEIGHT / 2.);
    assert!(rig.terminal_focused());
    assert_eq!(rig.open_screens(), ["toast"], "the card stays");
    // The card opens its session and goes.
    rig.click("toast-open");
    assert_eq!(rig.shown().as_deref(), Some("bravo"));
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));
    assert!(rig.open_screens().is_empty(), "no card, no screen");

    // × only puts it away.
    rig.ws(|ws, _, cx| ws.toast(heard(Alert::Blocked, "alpha", "alpha", None), cx));
    rig.draw();
    rig.click("toast-dismiss");
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));
    assert_eq!(rig.shown().as_deref(), Some("bravo"), "nothing opened");

    // A usage alert says its title and body, and opening it opens nothing.
    let alert = heard(
        Alert::Usage,
        "usage",
        "Codex 5h limit at 93%",
        Some("Resets in 42 minutes"),
    );
    rig.ws(|ws, _, cx| ws.toast(alert, cx));
    rig.draw();
    assert!(
        rig.record("toast-detail").is_some(),
        "its body is the detail line"
    );
    rig.click("toast-open");
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));
    assert_eq!(rig.shown().as_deref(), Some("bravo"), "nothing opened");

    // A mod's notification runs its action when opened.
    rig.ws(|ws, _, cx| {
        let action = Some(("tab.select".to_string(), Some(json!({"id": "alpha"}))));
        let notice = Notice {
            level: Some("info".into()),
            icon: Some("\u{2713}".into()),
            action,
            timeout: None,
        };
        ws.notify_for_mod("deploy", "Deployed".into(), None, notice, cx)
    });
    rig.draw();
    rig.click("toast-open");
    assert_eq!(rig.shown().as_deref(), Some("alpha"), "its action ran");
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));

    // Any command a mod can run is an action: Go to a session, and Choose a theme, which the
    // core keeps.
    let notify = |rig: &mut Rig, command: &str, args: Value| {
        rig.ws(|ws, _, cx| {
            let notice = Notice {
                level: None,
                icon: None,
                action: Some((command.to_string(), Some(args))),
                timeout: None,
            };
            ws.notify_for_mod("deploy", "Deployed".into(), None, notice, cx)
        });
        rig.draw();
        rig.click("toast-open");
        assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));
        assert_eq!(rig.ws(|ws, _, _| ws.notice().map(str::to_string)), None);
    };
    notify(rig, "session.open", json!({"id": "bravo"}));
    assert_eq!(rig.shown().as_deref(), Some("bravo"), "the session opened");
    rig.asked();
    notify(rig, "app.theme", json!({"name": "catppuccin-latte"}));
    let saved = rig.asked().into_iter().any(
        |c| matches!(c, Command::UpdateSettings(v) if v == json!({"theme": "catppuccin-latte"})),
    );
    assert!(saved, "the theme is the core's to keep");

    // Left alone, a card goes by itself (6 s for a finished session).
    rig.ws(|ws, _, cx| ws.toast(heard(Alert::Done, "alpha", "alpha", None), cx));
    rig.draw();
    rig.cx.advance_clock(std::time::Duration::from_secs(7));
    rig.draw();
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()), "it went");
    assert!(rig.open_screens().is_empty());

    // The confirmation that follows closes alpha's tab: show it again.
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    println!("toast: ok");
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-floating-window-{}", std::process::id()));
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
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let opened: Rc<RefCell<Vec<OpenSession>>> = Rc::default();
    let _opened = cx.update(|cx| {
        let opened = opened.clone();
        let sidebar = workspace.read(cx).sidebar().clone();
        cx.subscribe(&sidebar, move |_, event: &OpenSession, _| {
            opened.borrow_mut().push(event.clone())
        })
    });
    let mut rig = Rig {
        cx,
        window,
        opened,
        asked,
    };
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    assert!(
        rig.terminal_focused(),
        "the tab's terminal has the keyboard"
    );

    navigator(&mut rig);
    pane_menu(&mut rig);
    split_with_session(&mut rig);
    tab_menu(&mut rig);
    tab_drag(&mut rig);
    new_session(&mut rig);
    dialog(&mut rig);
    toast(&mut rig);
    confirm(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_floating_window: ok");
}
