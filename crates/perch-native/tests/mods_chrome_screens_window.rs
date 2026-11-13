//! The rest of the web's chrome screens in a real window, each the web's own screen unchanged
//! through the native React runtime, opened by the window's real caller, acted on, and closed by
//! Escape and a press outside where the web closes it, the keyboard back where it was after.
//!
//! - Keybind help: Cmd+/, a plain `?` outside a terminal and the leader chord then `?` open it;
//!   it lists every binding the window answers, with a person's choice of key and the bindings in
//!   `keys.json`; typing narrows it; Escape and a press on the dim backdrop close it.
//! - Launcher: Cmd+Shift+T opens it on the computer's projects; a project then an agent starts
//!   it there, No project a Quickchat; Backspace goes back; the browser and new file rows are
//!   refused with the reason; Escape and a press on the backdrop close it.
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
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [{"id": "w1", "projectId": "p",
        "hostId": "local", "path": "/work", "name": "main", "dirty": false, "state": "active",
        "createdAt": 0, "updatedAt": 0, "pinned": false}]})));
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

const LAUNCHER_KEY: &str = if cfg!(target_os = "macos") {
    "cmd-shift-t"
} else {
    "alt-shift-t"
};

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

fn launcher(rig: &mut Rig) {
    // Cmd+Shift+T opens it over the whole window with the keyboard: the computer's project (the
    // one shown highlighted), Add project and No project.
    rig.press(LAUNCHER_KEY);
    assert_eq!(rig.open_screens(), ["launcher"]);
    assert!(!rig.terminal_focused(), "the launcher has the keyboard");
    assert_eq!(rig.keys("launcher-row"), ["p", "add", "none"]);
    let props = rig
        .ws(|ws, _, _| ws.screen_props("launcher").cloned())
        .unwrap();
    assert_eq!(props["activeProjectId"], "p", "the shown session's project");
    assert_eq!(
        props["projects"][0]["workspace"],
        json!({"id": "w1", "path": "/work"}),
        "with the workspace a tab lands in"
    );
    // Typing filters; Escape closes it and the terminal has the keyboard again.
    rig.type_text("zzq");
    assert!(rig.keys("launcher-row").is_empty(), "nothing matches");
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused(), "the terminal has the keyboard back");

    // A press on the backdrop closes it, and nothing beneath takes that press.
    let before = rig.opened.borrow().len();
    rig.press(LAUNCHER_KEY);
    rig.mouse(20., HEIGHT - 20.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert_eq!(
        rig.opened.borrow().len(),
        before,
        "nothing beneath was pressed"
    );
    assert!(rig.terminal_focused());

    // Enter on the project lists its agents, the browser and file rows; 1 starts the first agent
    // in the project's workspace.
    rig.asked();
    rig.press(LAUNCHER_KEY);
    rig.press("enter");
    let rows = rig.keys("launcher-row");
    assert_eq!(&rows[rows.len() - 2..], ["browser", "file"], "{rows:?}");
    let first = rows[0].clone();
    rig.press("1");
    assert!(rig.open_screens().is_empty(), "the pick closed it");
    assert_eq!(
        launched(rig),
        [("local".into(), Some("/work".into()), first.clone())]
    );
    assert!(rig.terminal_focused());

    // No project starts a Quickchat; Backspace on an empty filter goes back to the projects.
    rig.press(LAUNCHER_KEY);
    rig.click("launcher-row:none");
    assert_eq!(rig.keys("launcher-row").first(), Some(&first), "its agents");
    rig.press("backspace");
    assert_eq!(
        rig.keys("launcher-row"),
        ["p", "add", "none"],
        "back to the projects"
    );
    rig.click("launcher-row:none");
    rig.click(&format!("launcher-row:{first}"));
    assert_eq!(launched(rig), [("local".into(), None, first)]);

    // What this window cannot open is listed and refused with the reason.
    for (row, reason) in [
        (
            "browser",
            "A browser tab does not open in the native window yet.",
        ),
        (
            "file",
            "A new file needs the files view, which the native window does not have yet.",
        ),
    ] {
        rig.press(LAUNCHER_KEY);
        rig.press("enter");
        rig.click(&format!("launcher-row:{row}"));
        assert!(rig.open_screens().is_empty(), "{row} closed it");
        assert_eq!(
            rig.ws(|ws, _, _| ws.notice().map(str::to_string))
                .as_deref(),
            Some(reason)
        );
    }
    assert!(launched(rig).is_empty(), "nothing started");
    println!("launcher: ok");
}

/// A window on `state()` with the stock mods written to `user`, nothing open in it.
fn rig(user: PathBuf) -> Rig {
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
    Rig {
        cx,
        window,
        opened,
        asked,
    }
}

fn rig_with_nothing_open(user: PathBuf) -> Rig {
    let mut rig = rig(user);
    rig.draw();
    rig
}

fn start(rig: &mut Rig) {
    // Nothing open: the main area is the web's home page, with Add project and New session.
    assert!(
        rig.record("start-panel").is_some(),
        "the start page is drawn"
    );
    assert!(rig.record("start-logo").is_some(), "with the logo's box");
    assert_eq!(
        rig.keys("start-action"),
        ["home-add-project", "no-session-create"]
    );
    // New session opens the New session menu under the button; a project starts the agent.
    rig.asked();
    rig.click("start-action:no-session-create");
    assert_eq!(rig.open_screens(), ["new-session"]);
    rig.click("project-option:0");
    assert!(rig.open_screens().is_empty(), "the pick closed it");
    assert_eq!(
        launched(rig),
        [("local".into(), Some("/work".into()), "claude".into())]
    );
    // A plain `?` with nothing focused opens the keybind help.
    rig.press("shift-/");
    assert_eq!(
        rig.open_screens(),
        ["keybind-help"],
        "`?` outside a terminal"
    );
    rig.press("escape");

    // A workspace focused with no session of it open: its start picker; an agent starts there.
    rig.ws(|ws, window, cx| {
        ws.run_command("workspace.focus", Some(&json!({"id": "w1"})), window, cx)
    })
    .unwrap();
    rig.draw();
    let agents = rig.keys("start-action");
    assert!(!agents.is_empty(), "an agent button per agent");
    assert!(rig.record("start-target").is_some(), "the place picker");
    rig.click(&format!("start-action:{}", agents[0]));
    let started = launched(rig);
    assert_eq!(started.len(), 1, "one start: {started:?}");
    assert_eq!(started[0].1.as_deref(), Some("/work"), "in its own folder");

    // With the core away: Connecting…, nothing to press.
    rig.ws(|ws, _, cx| {
        let model = State::default().model();
        ws.sidebar()
            .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
    });
    rig.draw();
    assert!(rig.record("start-panel").is_some(), "Connecting… is drawn");
    assert!(rig.keys("start-action").is_empty());
    println!("start: ok");
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

    let mut rig = rig(user.clone());
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
    launcher(&mut rig);
    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();

    let mut rig = rig_with_nothing_open(user);
    start(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_chrome_screens_window: ok");
}
