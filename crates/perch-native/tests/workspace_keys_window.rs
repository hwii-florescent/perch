//! The window's keys that the keybind help lists, pressed in a real window, each followed by what
//! it did and the keyboard back in the terminal:
//!
//! - Resize mode and the leader's grow and shrink: the focused pane of a split takes or gives the
//!   web's step against its neighbour, resize mode stays armed for its next key, and Escape, any
//!   other key or its timeout end it.
//! - Back and Forward: the tabs shown before and after, by when they were shown.
//! - The leader's `w`: the newest session of the next folder, folders ordered by their newest.
//! - Add project (Cmd+O): the sidebar's form, with the folder browser listing through the core.
//! - Closing an agent's session that has no tab here asks first, as its tab's × does.
//! - Closing a session the sidebar does not show, as a hidden terminal, ends it through the core.
//! - A new project with a program (`project.new` with `argv`): added, then the program run in
//!   the workspace of the folder asked for once the core lists it, never in another project
//!   listed meanwhile, and its terminal shown once listed. A refused add runs nothing.
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

/// Project `p` in `/work` with `alpha` and `bravo`, and `charlie` alone in `/other`, newest last;
/// `echo`, in `/work` as old as `alpha`, is never opened.
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
    .chain([
        json!({"id": "echo", "title": "echo", "cwd": "/work", "createdAt": 0,
        "status": "idle", "hostId": "local", "projectId": "p", "cliProviderId": "claude"}),
    ])
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
    // Back and Forward are per workspace: charlie's own has nothing before it.
    assert!(rig.press(back));
    assert_eq!(rig.active().as_deref(), Some("charlie"));
    rig.open("bravo");
    assert!(rig.press(back));
    assert_eq!(rig.active().as_deref(), Some("alpha"));
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

/// A left press and release at `at`, through the window's dispatch.
fn click_at(rig: &mut Rig, at: gpui::Point<gpui::Pixels>) {
    let (button, modifiers) = (gpui::MouseButton::Left, gpui::Modifiers::default());
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            window.dispatch_event(
                gpui::PlatformInput::MouseDown(gpui::MouseDownEvent {
                    button,
                    position: at,
                    modifiers,
                    click_count: 1,
                    first_mouse: false,
                }),
                cx,
            );
            window.dispatch_event(
                gpui::PlatformInput::MouseUp(gpui::MouseUpEvent {
                    button,
                    position: at,
                    modifiers,
                    click_count: 1,
                }),
                cx,
            );
        })
        .unwrap();
    rig.draw();
}

fn close_untabbed(rig: &mut Rig) {
    rig.asked();
    let close = |rig: &mut Rig, id: &str| {
        let result = rig.ws(|ws, window, cx| {
            ws.run_command(
                "session.request_close",
                Some(&json!({"id": id})),
                window,
                cx,
            )
        });
        rig.draw();
        result
    };
    // Its workspace's strip lists it, but no terminal was ever attached to it.
    assert!(rig.ws(|ws, _, _| ws.view("echo").is_none()), "no terminal");
    close(rig, "echo").unwrap();
    assert_eq!(
        rig.ws(|ws, _, _| ws.screens_open()),
        ["confirm"],
        "asked first"
    );
    assert!(rig.asked().is_empty(), "nothing before the answer");
    rig.press("escape");
    assert!(rig.asked().is_empty(), "cancelled: nothing ended");
    assert!(rig.terminal_focused());
    close(rig, "echo").unwrap();
    let accept = rig
        .draw()
        .into_iter()
        .find(|r| r.name == "confirm-accept")
        .expect("the guard's Stop")
        .bounds
        .center();
    click_at(rig, accept);
    let asked = rig.asked();
    assert!(
        matches!(&asked[..], [Command::DeleteSession { session_id, .. }] if session_id == "echo"),
        "the answer ends it through the core: {asked:?}"
    );
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty());
    assert!(rig.terminal_focused());
    assert!(close(rig, "nope").is_err());

    // A terminal the sidebar does not show is still the core's: it is ended at once.
    let mut more = state();
    more.apply(&message(
        json!({"type": "session.updated", "session": {"id": "foxtrot",
        "title": "", "cwd": "/loose", "createdAt": 9, "status": "idle", "hostId": "local",
        "cliProviderId": "terminal", "cliStarted": true}}),
    ));
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(more.model()), cx))
    });
    rig.draw();
    assert!(
        rig.ws(|ws, _, cx| ws.sidebar().read(cx).session_to_open("foxtrot"))
            .is_none(),
        "not in the sidebar"
    );
    close(rig, "foxtrot").unwrap();
    let asked = rig.asked();
    assert!(
        matches!(&asked[..], [Command::DeleteSession { session_id, .. }] if session_id == "foxtrot"),
        "ended through the core: {asked:?}"
    );
    println!("close untabbed: ok");
}

/// Closing a lead asks what becomes of its sub-sessions even with no agent warning to give (both
/// are terminals here): the default keeps them, the other button stops them with it.
fn close_lead(rig: &mut Rig) {
    rig.asked();
    let mut more = state();
    for (id, parent) in [("golf", None), ("hotel", Some("golf"))] {
        more.apply(&message(
            json!({"type": "session.updated", "session": {"id": id,
            "title": id, "cwd": "/work", "createdAt": 20, "status": "idle", "hostId": "local",
            "cliProviderId": "terminal", "cliStarted": true, "parentSessionId": parent}}),
        ));
    }
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(more.model()), cx))
    });
    rig.draw();
    let close = |rig: &mut Rig, button: &str| {
        rig.ws(|ws, window, cx| {
            ws.run_command(
                "session.request_close",
                Some(&json!({"id": "golf"})),
                window,
                cx,
            )
        })
        .unwrap();
        rig.draw();
        assert_eq!(
            rig.ws(|ws, _, _| ws.screens_open()),
            ["confirm"],
            "asked first"
        );
        assert!(rig.asked().is_empty(), "nothing before the answer");
        let drawn = rig.draw();
        let at = drawn
            .iter()
            .find(|r| r.name == "close-guard-stop-sub-sessions")
            .expect("the guard asks about the sub-sessions")
            .bounds
            .center();
        match button {
            "enter" => assert!(rig.press("enter")),
            _ => click_at(rig, at),
        }
        assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty());
        rig.asked()
    };
    let asked = close(rig, "enter");
    assert!(
        matches!(&asked[..], [Command::DeleteSession { session_id, stop_sub_sessions: false }] if session_id == "golf"),
        "the default (Enter) keeps them: {asked:?}"
    );
    let asked = close(rig, "close-guard-stop-sub-sessions");
    assert!(
        matches!(&asked[..], [Command::DeleteSession { session_id, stop_sub_sessions: true }] if session_id == "golf"),
        "the other button stops them: {asked:?}"
    );
    println!("close lead: ok");
}

/// `state()` with a core that runs programs, and `more` of what it said.
fn running(more: &[Value]) -> perch_native::sidebar::Model {
    let mut state = state();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "workspace.run.v1"]})));
    for m in more {
        state.apply(&message(m.clone()));
    }
    state.model()
}

fn new_project_running(rig: &mut Rig) {
    // Asked for with a trailing slash; the core lists the folder by its real path, `/new`.
    let args = json!({"folder": "/new/", "argv": ["claude", "--model", "x"], "task": "go"});
    let run = |rig: &mut Rig| {
        rig.asked();
        let result =
            rig.ws(|ws, window, cx| ws.run_command("project.new", Some(&args), window, cx));
        rig.draw();
        result
    };
    // A core that cannot run a program is refused before anything is added.
    assert!(run(rig).unwrap_err().contains("updated core"));
    assert!(rig.asked().is_empty());
    let model = |more: &[Value]| Update::Model(running(more));
    let apply = |rig: &mut Rig, update: Update| {
        rig.ws(|ws, _, cx| ws.sidebar().update(cx, |s, cx| s.apply(update, cx)));
        rig.draw();
    };
    apply(rig, model(&[]));
    // A bad argv is refused too.
    let bad = json!({"folder": "/new", "argv": []});
    assert!(rig
        .ws(|ws, window, cx| ws.run_command("project.new", Some(&bad), window, cx))
        .is_err());

    let add = |rig: &mut Rig| {
        run(rig).unwrap();
        let added = rig.asked().into_iter().find_map(|c| match c {
            Command::AddProject { path, reply, .. } => Some((path, reply)),
            _ => None,
        });
        let (path, reply) = added.expect("the folder is added through the core");
        assert_eq!(path, "/new/");
        reply
    };
    let asked_run = |rig: &mut Rig| {
        rig.asked().into_iter().find_map(|c| match c {
            Command::Ask { frame, reply } if frame["type"] == "workspace.run" => {
                Some((frame, reply))
            }
            _ => None,
        })
    };

    // The core refuses the folder: nothing runs, and the window says why.
    add(rig).send(Err("not a folder".into())).unwrap();
    rig.draw();
    assert!(asked_run(rig).is_none(), "nothing runs");
    assert!(rig
        .ws(|ws, _, _| ws.notice().map(str::to_string))
        .is_some_and(|n| n.contains("not a folder") && n.contains("/new/ was not started")));

    // The folder is added, answered before the core lists it, while another device adds
    // `/b`, listed first. The program runs in the folder's own workspace, once listed.
    let reply = add(rig);
    reply.send(Ok(Value::Null)).unwrap();
    rig.draw();
    assert!(asked_run(rig).is_none(), "not before the folder is listed");
    let other = json!({"id": "pb", "hostId": "local", "name": "B", "path": "/b",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let project = json!({"id": "p2", "hostId": "local", "name": "New", "path": "/new",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let workspace = |id: &str, project: &str, path: &str| {
        json!({"id": id, "projectId": project, "hostId": "local", "path": path, "name": "main",
            "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0, "pinned": false})
    };
    let listed = [
        json!({"type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
            "snapshotRevision": 2, "projects": [{"id": "p", "hostId": "local", "name": "Work",
            "path": "/work", "favorite": false, "createdAt": 0, "updatedAt": 0}, other, project]}),
        json!({"type": "workspace.snapshot", "requestId": "r", "hostId": "local",
            "snapshotEpoch": "e", "snapshotRevision": 2, "projects": [other, project],
            "workspaces": [workspace("wb", "pb", "/b"), workspace("w2", "p2", "/new")]}),
    ];
    apply(rig, model(&listed));
    rig.cx.advance_clock(Duration::from_millis(200));
    rig.draw();
    let (frame, reply) = asked_run(rig).expect("the program is run through the core");
    assert_eq!(
        frame["workspaceId"], "w2",
        "the folder's, not the other device's"
    );
    assert_eq!(frame["command"], "'claude' '--model' 'x' 'go'");
    reply.send(Ok(json!({"sessionId": "run1"}))).unwrap();
    rig.draw();
    assert_ne!(
        rig.active().as_deref(),
        Some("run1"),
        "not before it is listed"
    );
    // Listed: its terminal is shown, with the keyboard.
    let mut more = listed.to_vec();
    more.push(
        json!({"type": "session.list", "sessions": [{"id": "run1", "title": "claude",
        "cwd": "/new", "createdAt": 9, "status": "idle", "hostId": "local", "projectId": "p2",
        "workspaceId": "w2"}]}),
    );
    apply(rig, model(&more));
    rig.cx.advance_clock(Duration::from_millis(200));
    rig.draw();
    assert_eq!(rig.active().as_deref(), Some("run1"));
    assert!(rig.terminal_focused());
    println!("new project running: ok");
}

/// Closing the last tab: the terminal that goes lets go of the keyboard, even while something
/// still holds its view, and the window keeps it, so its keys still work.
fn close_last_tab(rig: &mut Rig) {
    rig.open("alpha");
    let mut closed = Vec::new();
    while rig.active().is_some() {
        let handle = rig.ws(|ws, _, cx| ws.terminal().expect("a terminal").focus_handle(cx));
        rig.ws(|ws, window, cx| ws.run_command("tabs.close", None, window, cx))
            .unwrap();
        rig.draw();
        // An agent attached to nothing asks first; Keep running puts its tab away.
        if rig.ws(|ws, _, _| ws.screens_open()) == ["confirm"] {
            let keep = rig
                .draw()
                .into_iter()
                .find(|r| r.name == "confirm-extra")
                .expect("the guard's Keep running")
                .bounds
                .center();
            click_at(rig, keep);
        }
        closed.push(handle);
        assert!(closed.len() < 20, "the tabs close");
    }
    let held = rig.ws(|_, window, _| closed.iter().any(|h| h.is_focused(window)));
    assert!(!held, "no closed terminal keeps the keyboard");
    assert!(
        rig.ws(|_, window, cx| window.focused(cx).is_some()),
        "the window has it"
    );
    assert!(
        rig.press(if MAC { "cmd-b" } else { "ctrl-b" }),
        "its keys still work"
    );
    rig.press(if MAC { "cmd-b" } else { "ctrl-b" });
    println!("close last tab: ok");
}

/// A workspace key landing on a workspace with no session shows its start page, as the web's
/// `openEmptyWorkspace`: no tab of the other workspace stays on screen.
fn empty_workspace(rig: &mut Rig) {
    let mut more = state();
    more.apply(&message(json!({
        "type": "project.list", "requestId": "r2", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 2, "projects": [
            {"id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
             "createdAt": 0, "updatedAt": 0},
            {"id": "q", "hostId": "local", "name": "Empty", "path": "/empty", "favorite": false,
             "createdAt": 1, "updatedAt": 1}]})));
    more.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r2", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 2,
        "projects": [
            {"id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
             "createdAt": 0, "updatedAt": 0},
            {"id": "q", "hostId": "local", "name": "Empty", "path": "/empty", "favorite": false,
             "createdAt": 1, "updatedAt": 1}],
        "workspaces": [
            {"id": "w1", "projectId": "p", "hostId": "local", "path": "/work", "name": "main",
             "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0, "pinned": false},
            {"id": "w2", "projectId": "q", "hostId": "local", "path": "/empty", "name": "main",
             "dirty": false, "state": "active", "createdAt": 1, "updatedAt": 1, "pinned": false}]})));
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(more.model()), cx))
    });
    rig.open("alpha");
    assert!(rig.active().is_some());
    let mut seen_empty = false;
    for _ in 0..4 {
        assert!(rig.press("ctrl-shift-down"), "the workspace key is taken");
        if rig.active().is_none() {
            seen_empty = true;
            assert!(rig.drawn("start-card") || rig.ws(|ws, _, _| ws.tabs().visible().is_none()));
            break;
        }
    }
    assert!(seen_empty, "the empty workspace shows its start page");
    println!("empty workspace: ok");
}

/// Before the core has made the Quickchat project, the sidebar draws the Quickchat section with
/// its +, and New quickchat shows Quickchat's start page, as the web's (whose client makes the
/// project as it connects).
fn quickchat_before_first(rig: &mut Rig) {
    let names: Vec<String> = rig.draw().into_iter().map(|r| r.name.to_string()).collect();
    for name in ["chats-header", "chats-new-button"] {
        assert!(
            names.iter().any(|n| n == name),
            "{name} is drawn with no Quickchat project"
        );
    }
    rig.ws(|ws, window, cx| ws.run_command("quickchat.new", None, window, cx))
        .expect("New quickchat works before the first quickchat");
    rig.draw();
    assert_eq!(rig.active(), None, "the start page");
    let drawn = rig.draw();
    assert!(
        drawn.iter().any(|r| r.name == "start-target"),
        "Quickchat's start page, not home"
    );
    // An agent picked there starts a quickchat (no folder), which makes the project.
    rig.asked();
    let start = drawn
        .iter()
        .find(|r| r.name == "start-action:workspace-start-claude")
        .expect("the start page's agents")
        .bounds
        .center();
    click_at(rig, start);
    let asked = rig.asked();
    assert!(
        asked
            .iter()
            .any(|c| matches!(c, Command::Launch { cwd: None, provider, .. }
            if provider == "claude")),
        "started in the home folder: {asked:?}"
    );
    println!("quickchat before first: ok");
}

/// Commands the web has that the window now runs as it does: `key.bind` keeps a key in the core's
/// settings (and refuses one the web refuses), leader 9 is the 9th tab or the last, leader c
/// starts a terminal in the project on screen with no picker, and `agent.next` skips terminals.
fn web_commands(rig: &mut Rig) {
    let run = |rig: &mut Rig, name: &str, args: Value| {
        rig.ws(|ws, window, cx| ws.run_command(name, Some(&args), window, cx))
    };
    rig.asked();
    run(
        rig,
        "key.bind",
        json!({"command": "global.sidebar", "keys": "cmd+shift+y"}),
    )
    .unwrap();
    let saved: Vec<Value> = rig
        .asked()
        .into_iter()
        .filter_map(|c| match c {
            Command::UpdateSettings(patch) => Some(patch),
            _ => None,
        })
        .collect();
    assert_eq!(
        saved,
        [json!({"keybindings": {"global.sidebar": "cmd+shift+y"}})]
    );
    let refused = run(
        rig,
        "key.bind",
        json!({"command": "global.sidebar", "keys": "y"}),
    );
    assert!(refused.unwrap_err().contains("cannot be bound"));
    assert!(
        run(rig, "key.bind", json!({"keys": "cmd+y"})).is_err(),
        "needs a command"
    );
    assert!(rig.asked().is_empty(), "nothing saved for a refused key");

    rig.open("alpha");
    rig.open("bravo");
    run(rig, "tabs.jump1", json!({})).unwrap();
    assert_eq!(rig.active().as_deref(), Some("alpha"));
    run(rig, "leader.jump9", json!({})).unwrap();
    assert_eq!(
        rig.active().as_deref(),
        Some("bravo"),
        "fewer than 9: the last"
    );

    rig.asked();
    run(rig, "leader.newSession", json!({})).unwrap();
    let launched: Vec<_> = rig
        .asked()
        .into_iter()
        .filter_map(|c| match c {
            Command::Launch { cwd, provider, .. } => Some((cwd, provider)),
            _ => None,
        })
        .collect();
    assert_eq!(
        launched,
        [(Some("/work".to_string()), "terminal".to_string())]
    );
    println!("web-commands: ok");
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-keys-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let mut rig = rig(scratch.join("native-mods"));
    rig.draw();

    quickchat_before_first(&mut rig);
    history(&mut rig);
    next_project(&mut rig);
    resize(&mut rig);
    add_project(&mut rig);
    held_keyboard(&mut rig);
    close_untabbed(&mut rig);
    close_lead(&mut rig);
    new_project_running(&mut rig);
    empty_workspace(&mut rig);
    close_last_tab(&mut rig);
    web_commands(&mut rig);

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("workspace_keys_window: ok");
}
