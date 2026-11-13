//! The stock floating screens in a real window: the web's own screens, unchanged, through the
//! native React runtime, opened by the window's real callers, their results acted on by the window,
//! closed by Escape and by a press outside their panel, the keyboard back on the terminal after.
//!
//! - Navigator: the Navigator's key opens it over the whole window; typing narrows it; Enter or a
//!   click on a row shows that session; Escape, the key again, or a press on the dim backdrop closes
//!   it without anything beneath taking the press.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::unbounded;
use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::ui::{OpenSession, Workspace};
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
        "capabilities": ["workspace.snapshot"]})));
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
        let position = point(px(x), px(y));
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Left,
                        position,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Left,
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
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let opened: Rc<RefCell<Vec<OpenSession>>> = Rc::default();
    let _opened = cx.update(|cx| {
        let opened = opened.clone();
        let sidebar = workspace.read(cx).sidebar().clone();
        cx.subscribe(&sidebar, move |_, event: &OpenSession, _| {
            opened.borrow_mut().push(event.clone())
        })
    });
    let mut rig = Rig { cx, window, opened };
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

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_floating_window: ok");
}
