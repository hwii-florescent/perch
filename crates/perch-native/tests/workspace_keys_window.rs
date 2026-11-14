//! The window's keys that the keybind help lists, pressed in a real window, each followed by what
//! it did and the keyboard back in the terminal:
//!
//! - Resize mode and the leader's grow and shrink: the focused pane of a split takes or gives the
//!   web's step against its neighbour, resize mode stays armed for its next key, and Escape, any
//!   other key or its timeout end it.
//! - Back and Forward: the tabs shown before and after, by when they were shown.
//! - The leader's `w`: the newest session of the next folder, folders ordered by their newest.
//! - Add project (Cmd+O): the sidebar's form, with the folder browser listing through the core.
//! - A field of an in-flow screen that holds the keyboard lets go of it when its screen is no
//!   longer drawn or loads again, so the terminal takes the keyboard back.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::tabs::Node;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

const WIDTH: f32 = 1200.;
const HEIGHT: f32 = 700.;
const MAC: bool = cfg!(target_os = "macos");

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// Project `p` in `/work` with `alpha` and `bravo`, and `charlie` alone in `/other`, newest last.
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
    let sessions: Vec<Value> = [
        ("alpha", "/work"),
        ("bravo", "/work"),
        ("charlie", "/other"),
    ]
    .iter()
    .enumerate()
    .map(|(i, (title, cwd))| {
        let mut session = json!({"id": title, "title": title, "cwd": cwd, "createdAt": i,
                "status": "idle", "hostId": "local", "cliProviderId": "claude"});
        if *cwd == "/work" {
            session["projectId"] = json!("p");
        }
        session
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

    fn drawn(&mut self, name: &str) -> bool {
        self.draw().iter().any(|r| r.name == name)
    }

    /// A key through the window's dispatch; true when the window took it.
    fn press(&mut self, spec: &str) -> bool {
        let keystroke = Keystroke::parse(spec).unwrap();
        let taken = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
        taken
    }

    fn leader(&mut self, follow_up: &str) {
        assert!(self.press("ctrl-space"));
        assert!(self.press(follow_up), "the leader took {follow_up}");
    }

    fn active(&mut self) -> Option<String> {
        self.ws(|ws, _, _| ws.tabs().active().map(str::to_string))
    }

    fn open(&mut self, id: &str) {
        let id = id.to_string();
        self.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id, Some("claude".into()), cx)
            })
        });
        self.draw();
    }

    fn terminal_focused(&mut self) -> bool {
        self.ws(|ws, window, cx| {
            ws.terminal()
                .expect("a terminal")
                .focus_handle(cx)
                .is_focused(window)
        })
    }

    /// The shares of the split on screen.
    fn sizes(&mut self) -> Vec<f32> {
        match self.ws(|ws, _, _| ws.tabs().visible()) {
            Some(Node::Split { sizes, .. }) => sizes,
            other => panic!("not a split: {other:?}"),
        }
    }

    fn asked(&mut self) -> Vec<Command> {
        std::iter::from_fn(|| self.asked.try_recv().ok()).collect()
    }
}

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
    Rig { cx, window, asked }
}

fn history(rig: &mut Rig) {
    let (back, forward) = if MAC {
        ("ctrl--", "ctrl-shift-_")
    } else {
        ("alt-shift-left", "alt-shift-right")
    };
    rig.open("alpha");
    rig.open("bravo");
    rig.open("charlie");
    assert!(rig.press(back));
    assert_eq!(rig.active().as_deref(), Some("bravo"));
    assert!(rig.terminal_focused(), "the terminal has the keyboard");
    assert!(rig.press(back));
    assert_eq!(rig.active().as_deref(), Some("alpha"));
    assert!(
        rig.press(back),
        "the key is the window's even with nothing before"
    );
    assert_eq!(rig.active().as_deref(), Some("alpha"));
    assert!(rig.press(forward));
    assert_eq!(rig.active().as_deref(), Some("bravo"));
    // A tab shown by other means is a visit, which drops what was ahead.
    rig.open("alpha");
    assert!(rig.press(forward));
    assert_eq!(rig.active().as_deref(), Some("alpha"), "nothing ahead");
    assert!(rig.press(back));
    assert_eq!(rig.active().as_deref(), Some("bravo"));
    assert!(rig.terminal_focused());
    println!("history: ok");
}

fn next_project(rig: &mut Rig) {
    // From /work, the next folder by newest session is /other: its newest, charlie.
    rig.open("alpha");
    rig.leader("w");
    assert_eq!(rig.active().as_deref(), Some("charlie"));
    assert!(rig.terminal_focused());
    // And on round to /work's newest, bravo.
    rig.leader("w");
    assert_eq!(rig.active().as_deref(), Some("bravo"));
    assert!(rig.terminal_focused());
    println!("next project: ok");
}

fn resize(rig: &mut Rig) {
    // alpha with a new terminal beside it, which has the keyboard.
    rig.open("alpha");
    rig.ws(|ws, window, cx| ws.run_command("panes.splitRight", None, window, cx))
        .unwrap();
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |sidebar, cx| {
            sidebar.apply(
                Update::Launched {
                    host_id: "local".into(),
                    session_id: "delta".into(),
                    provider: "terminal".into(),
                },
                cx,
            )
        })
    });
    rig.draw();
    assert_eq!(rig.active().as_deref(), Some("delta"));
    let even = rig.sizes();
    assert!((even[0] - 0.5).abs() < 1e-4, "{even:?}");

    // Leader then `r`: resize mode. `l` grows the focused pane, and the mode stays for the next.
    rig.leader("r");
    assert!(rig.ws(|ws, _, _| ws.resize_armed()), "resize mode is armed");
    assert!(rig.press("l"));
    let grown = rig.sizes();
    assert!(grown[1] > even[1] + 0.01, "{even:?} then {grown:?}");
    assert!(rig.ws(|ws, _, _| ws.resize_armed()), "still in resize mode");
    assert!(rig.press("l"));
    let more = rig.sizes();
    assert!(more[1] > grown[1] + 0.01, "{grown:?} then {more:?}");
    assert!(rig.press("h"));
    assert!(
        (rig.sizes()[1] - grown[1]).abs() < 1e-4,
        "h shrinks it back"
    );
    // Escape ends it: the next `l` is the terminal's and resizes nothing.
    assert!(rig.press("escape"));
    assert!(!rig.ws(|ws, _, _| ws.resize_armed()));
    let before = rig.sizes();
    rig.press("l");
    assert_eq!(rig.sizes(), before, "the terminal's key");
    assert!(rig.terminal_focused());

    // Any other key ends it too, and so does its time running out.
    rig.leader("r");
    rig.press("v");
    assert!(
        !rig.ws(|ws, _, _| ws.resize_armed()),
        "another key ended it"
    );
    rig.leader("r");
    rig.cx.advance_clock(Duration::from_millis(1600));
    rig.cx.run_until_parked();
    assert!(!rig.ws(|ws, _, _| ws.resize_armed()), "its time ran out");

    // The leader's grow and shrink, one step each, with no mode.
    let before = rig.sizes();
    rig.leader("shift-=");
    let grown = rig.sizes();
    assert!(grown[1] > before[1] + 0.01, "{before:?} then {grown:?}");
    rig.leader("-");
    assert!((rig.sizes()[1] - before[1]).abs() < 1e-4);
    assert!(!rig.ws(|ws, _, _| ws.resize_armed()));
    assert!(rig.terminal_focused());
    println!("resize: ok");
}

fn add_project(rig: &mut Rig) {
    rig.asked();
    assert!(rig.press(if MAC { "cmd-o" } else { "ctrl-shift-o" }));
    // The sidebar's form opens, its folder browser listing through the core.
    let mut listed = false;
    for command in rig.asked() {
        if let Command::Ask { frame, reply } = command {
            assert_eq!(frame["type"], "fs.browse", "only the listing");
            let _ = reply.send(Ok(
                json!({"path": "/home/dev", "parent": "/home", "entries": [
                {"name": "code", "path": "/home/dev/code", "isGitRepo": false}]}),
            ));
            listed = true;
        }
    }
    assert!(listed, "the folder browser asked for its listing");
    assert!(rig.drawn("folder-browser-filter"), "the form is open");
    rig.press("escape");
    assert!(!rig.drawn("folder-browser"), "Escape closed it");
    assert!(rig.terminal_focused(), "the terminal has the keyboard back");
    println!("add project: ok");
}

/// The sidebar's copy says one of its fields holds the keyboard, as `screen.js` does on focus.
fn hold_in_sidebar(rig: &mut Rig) {
    let load = rig
        .cx
        .update(|cx| cx.global::<WindowMods>().perch.loads("sidebar"));
    assert!(load > 0, "the sidebar's copy is loaded");
    // The field takes the focus from the terminal and says so; the window leaves it there.
    rig.ws(|ws, window, cx| {
        window.blur(cx);
        ws.hold_keyboard("sidebar", load, true, cx)
    });
    rig.draw();
    assert!(rig.ws(|ws, _, _| ws.keyboard_held()));
    assert!(!rig.terminal_focused(), "the terminal does not take it");
}

fn held_keyboard(rig: &mut Rig) {
    // The sidebar goes while one of its fields holds the keyboard: the terminal takes it back.
    hold_in_sidebar(rig);
    assert!(rig.press(if MAC { "cmd-b" } else { "ctrl-shift-b" }));
    assert!(!rig.ws(|ws, _, _| ws.keyboard_held()), "let go");
    assert!(rig.terminal_focused());
    assert!(rig.press(if MAC { "cmd-b" } else { "ctrl-shift-b" }));
    // The sidebar's copy loads again (its files changed): the new copy holds nothing.
    hold_in_sidebar(rig);
    rig.cx.update(|cx| {
        cx.global::<WindowMods>().perch.module("sidebar");
    });
    rig.draw();
    assert!(!rig.ws(|ws, _, _| ws.keyboard_held()), "let go");
    assert!(rig.terminal_focused());
    println!("held keyboard: ok");
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-keys-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let mut rig = rig(scratch.join("native-mods"));
    rig.draw();

    history(&mut rig);
    next_project(&mut rig);
    resize(&mut rig);
    add_project(&mut rig);
    held_keyboard(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("workspace_keys_window: ok");
}
