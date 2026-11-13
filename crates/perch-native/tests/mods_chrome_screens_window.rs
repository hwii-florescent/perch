//! The rest of the web's chrome screens in a real window, each the web's own screen unchanged
//! through the native React runtime, opened by the window's real caller, acted on, and closed by
//! Escape and a press outside where the web closes it, the keyboard back where it was after.
//!
//! - Keybind help: Cmd+/, a plain `?` outside a terminal and the leader chord then `?` open it;
//!   it lists every binding the window answers, with a person's choice of key and the bindings in
//!   `keys.json`; typing narrows it; Escape and a press on the dim backdrop close it.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::keymap::Keymap;
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

const HELP_KEY: &str = if cfg!(target_os = "macos") {
    "cmd-/"
} else {
    "ctrl-shift-/"
};

/// How many of the help's rows the window draws.
fn help_rows(rig: &mut Rig) -> usize {
    rig.draw()
        .iter()
        .filter(|r| r.name == "keybind-help-row" || r.name.starts_with("keybind-help-row@"))
        .count()
}

/// The rows of `keymap`'s help that the search `query` keeps, as the web's screen filters them.
fn matching(keymap: &Keymap, query: &str) -> usize {
    let q = query.to_lowercase();
    keymap
        .help()
        .iter()
        .filter(|row| {
            ["keys", "description"]
                .iter()
                .any(|k| row[k].as_str().unwrap().to_lowercase().contains(&q))
        })
        .count()
}

fn keybind_help(rig: &mut Rig) {
    // Cmd+/ opens it over the whole window, with the keyboard, a row for every binding the
    // window answers.
    let keymap = Keymap::new(Default::default(), None);
    rig.press(HELP_KEY);
    assert_eq!(rig.open_screens(), ["keybind-help"]);
    assert!(!rig.terminal_focused(), "the help has the keyboard");
    assert_eq!(help_rows(rig), matching(&keymap, ""), "every binding");
    // Typing narrows it; Escape closes it and the terminal has the keyboard again.
    rig.type_text("zoom");
    let zoom = matching(&keymap, "zoom");
    assert!(zoom > 0);
    assert_eq!(help_rows(rig), zoom, "the bindings that say zoom");
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused(), "the terminal has the keyboard back");

    // The leader chord then `?` opens it; a press on the backdrop closes it.
    rig.press("ctrl-space");
    rig.press("shift-/");
    assert_eq!(
        rig.open_screens(),
        ["keybind-help"],
        "the leader's follow-up opened it"
    );
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert!(rig.terminal_focused());

    // A plain `?` is the terminal's while it has the keyboard.
    rig.press("shift-/");
    assert!(rig.open_screens().is_empty(), "the terminal took the `?`");

    // A person's key and the bindings in `keys.json` are what it lists.
    let mut model = state().model();
    model
        .keybindings
        .insert("global.settings".into(), "cmd+shift+,".into());
    model.keys_file = Some(json!({"global": {"ctrl-shift-t": "tabs.next"}}));
    let keymap = Keymap::new(model.keybindings.clone(), model.keys_file.clone());
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
    });
    rig.press(HELP_KEY);
    rig.type_text("next tab");
    assert_eq!(help_rows(rig), matching(&keymap, "next tab"));
    assert!(
        keymap
            .help()
            .iter()
            .any(|r| r["description"] == "Next tab" && r["keys"] == "⌃⇧T"),
        "the keys.json binding is a row"
    );
    rig.press("escape");
    println!("keybind-help: ok");
}

fn main() {
    let scratch: PathBuf = std::env::temp_dir().join(format!(
        "perch-chrome-screens-window-{}",
        std::process::id()
    ));
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

    keybind_help(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_chrome_screens_window: ok");
}
