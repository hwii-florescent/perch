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
//! - Folder browser: the sidebar's Add (and the start page's Add project) opens its form with the
//!   browser listing folders through the core; typing filters, a folder goes in, Use this folder
//!   (its key) registers it through the core and closes the form, a refusal stays in it; Escape
//!   and a press outside close it.
//! - Instructions: the project's menu opens them, loaded through the core; typed text is saved
//!   through it and the dialog closes once it takes it, a refusal stays in it with the reason;
//!   Escape and a press on the backdrop close it.
//! - Memory: the project's menu opens its files, listed through the core; a file opens, Back
//!   returns, Delete asks first in place and deletes at the revision read; Close, Escape and a
//!   press on the backdrop close it.
//! - Worktrees: a git project's + opens its worktree menu on the create form, listed through the
//!   core; a create the core refuses stays with the reason, one it makes closes the form; Remove
//!   asks first and a dirty checkout is asked again, forced; Open starts a terminal there;
//!   Escape and a press outside close it. Where the core runs creates in the background, a create
//!   is a job: the form closes on its acceptance, the job is a sidebar row (failed with its
//!   reason, retried through the core), and Settings' starting pane starts once the checkout is
//!   listed. New workspace's key and leader W open the shown project's menu; `worktree.remove`
//!   asks first in it.
//! - Terminal find: the terminal's find key opens the find bar over its pane with the keyboard in
//!   it; what is typed is the terminal's query (and never reaches the shell); Escape and × close
//!   it, the keyboard back in the terminal.
//! - Start: the main area with nothing open; New session, `?`, a workspace's agent buttons and the
//!   connecting page.
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
use perch_native::client::{self, Command, Update};
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

/// Project `p` on this computer (a git repository), holding `alpha` and `bravo` (Claude sessions).
fn state() -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "repoPath": "/work", "favorite": false, "createdAt": 0, "updatedAt": 0});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "instructions.v1", "memory.v1", "memory.off.v1",
            "worktree.startFrom"]})));
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
    /// The window as drawn, written to `PERCH_NATIVE_SHOT_DIR/<name>.png` when that is set.
    fn shot(&mut self, name: &str) {
        let Some(dir) = std::env::var_os("PERCH_NATIVE_SHOT_DIR") else {
            return;
        };
        self.draw();
        let image = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, _| {
                window.render_to_image().expect("offscreen render")
            })
            .unwrap();
        image
            .save(std::path::Path::new(&dir).join(format!("{name}.png")))
            .expect("the picture is saved");
    }

    /// One wheel step down (three lines) at `(x, y)`.
    fn scroll(&mut self, x: f32, y: f32) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::ScrollWheel(gpui::ScrollWheelEvent {
                        position: point(px(x), px(y)),
                        delta: gpui::ScrollDelta::Lines(point(0., -3.)),
                        modifiers: Modifiers::default(),
                        touch_phase: gpui::TouchPhase::Moved,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }

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
    // Add project asks the sidebar for its form, which lists the folder it was last in.
    rig.asked();
    rig.click("start-action:home-add-project");
    assert!(
        answer_listings(rig, home_listing).is_empty(),
        "only the listing"
    );
    assert!(
        rig.record("folder-browser-filter").is_some(),
        "the form is open"
    );
    rig.press("escape");
    assert!(rig.record("folder-browser").is_none());

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

/// Answers every folder listing the window asked for with `listing(path)`; what else it asked
/// for is returned.
fn answer_listings(rig: &mut Rig, listing: impl Fn(Option<&str>) -> Value) -> Vec<Command> {
    let mut other = Vec::new();
    for command in rig.asked() {
        match command {
            Command::Ask { frame, reply } if frame["type"] == "fs.browse" => {
                let _ = reply.send(Ok(listing(frame["path"].as_str())));
            }
            command => other.push(command),
        }
    }
    rig.draw();
    other
}

/// The folders under `/home/dev` and nothing under `code`.
fn home_listing(path: Option<&str>) -> Value {
    match path {
        None | Some("/home/dev") => json!({"path": "/home/dev", "parent": "/home", "entries": [
            {"name": "code", "path": "/home/dev/code", "isGitRepo": false},
            {"name": "notes", "path": "/home/dev/notes", "isGitRepo": true}]}),
        Some(other) => json!({"path": other, "parent": "/home/dev", "entries": []}),
    }
}

const USE_FOLDER: &str = if cfg!(target_os = "macos") {
    "cmd-enter"
} else {
    "ctrl-enter"
};

/// The sidebar's Add project, opened and its folder listed through the core.
fn open_add_project(rig: &mut Rig) {
    rig.click("add-project-button");
    let asked = answer_listings(rig, home_listing);
    assert!(asked.is_empty(), "only the listing: {asked:?}");
    assert!(
        rig.record("folder-browser-filter").is_some(),
        "the form is open"
    );
}

/// Twenty folders under `/home/dev`: more than the list's 260 px shows.
fn many_listing(path: Option<&str>) -> Value {
    let entries: Vec<Value> = (0..20)
        .map(|i| json!({"name": format!("folder-{i:02}"), "path": format!("/home/dev/folder-{i:02}"), "isGitRepo": false}))
        .collect();
    json!({"path": path.unwrap_or("/home/dev"), "parent": "/home", "entries": entries})
}

/// The Add project dialog with more folders than fit: a wheel over the list scrolls the list and
/// nothing else, so the title, the name field and the path stay where they are.
fn add_project_scroll(rig: &mut Rig) {
    rig.asked();
    rig.click("add-project-button");
    answer_listings(rig, many_listing);
    let top = |rig: &mut Rig, name: &str| {
        f32::from(
            rig.record(name)
                .unwrap_or_else(|| panic!("{name} is drawn"))
                .bounds
                .origin
                .y,
        )
    };
    let (crumbs, first, use_it) = (
        top(rig, "folder-browser-crumbs"),
        top(rig, "folder-browser-entry:folder-00"),
        top(rig, "folder-browser-use"),
    );
    let list = rig.record("folder-browser-list").unwrap().bounds;
    assert!(
        f32::from(list.size.height) <= 260.,
        "the list is cut at 260 px: {list:?}"
    );
    rig.shot("add-project-before");
    for _ in 0..2 {
        rig.scroll(500., 380.);
    }
    rig.shot("add-project-scrolled");
    assert!(
        top(rig, "folder-browser-entry:folder-00") < first - 50.,
        "the list scrolled"
    );
    assert_eq!(top(rig, "folder-browser-crumbs"), crumbs, "the path stayed");
    assert_eq!(
        top(rig, "folder-browser-use"),
        use_it,
        "Use this folder stayed"
    );
    rig.press("escape");
    assert!(rig.record("folder-browser").is_none(), "Escape closed it");
}

fn folder_browser(rig: &mut Rig) {
    rig.asked();
    // The sidebar's Add opens its form with the folder browser in it, listing home through the
    // core; the filter field has the keyboard, so typing filters and runs no window key.
    open_add_project(rig);
    assert_eq!(rig.keys("folder-browser-entry"), ["code", "notes"]);
    // The form is laid out against the window, as the web's fixed dialog is, not inside the sidebar.
    let form = rig.record("folder-browser").unwrap().bounds;
    assert!(
        f32::from(form.size.width) > 400. && f32::from(form.center().x) > 400.,
        "the form is centred in the window: {form:?}"
    );
    assert!(
        rig.record("folder-browser-git:notes").is_some(),
        "a git badge"
    );
    assert!(!rig.terminal_focused(), "the form's field has the keyboard");
    rig.type_text("no");
    assert_eq!(rig.keys("folder-browser-entry"), ["notes"], "filtered");
    assert!(rig.open_screens().is_empty(), "no window key ran");
    rig.press("backspace");
    rig.press("backspace");
    assert_eq!(rig.keys("folder-browser-entry"), ["code", "notes"]);
    // A folder goes in; the core lists it.
    rig.click("folder-browser-entry:code");
    answer_listings(rig, home_listing);
    assert!(rig.record("folder-browser-note").is_some(), "No subfolders");
    // Use this folder's key registers it as a project through the core; once the core says so the
    // form closes and the terminal has the keyboard again.
    rig.press(USE_FOLDER);
    let asked = rig.asked();
    let [Command::AddProject {
        host_id,
        path,
        name,
        reply,
    }] = <[Command; 1]>::try_from(asked).expect("one request")
    else {
        panic!("Add project asks the core to register the folder");
    };
    assert_eq!(
        (host_id.as_str(), path.as_str(), name),
        ("local", "/home/dev/code", None)
    );
    reply.send(Ok(Value::Null)).unwrap();
    rig.draw();
    assert!(rig.record("folder-browser").is_none(), "the form closed");
    assert!(rig.terminal_focused(), "the keyboard is back");
    assert_eq!(
        rig.ws(|ws, _, _| ws.add_project_state().clone())["status"],
        "idle",
        "the sidebar took the answer"
    );

    // A refusal stays in the form, with the core's reason. The form opens again in the folder
    // it was last in.
    open_add_project(rig);
    assert!(
        rig.record("folder-browser-crumb@2").is_some(),
        "back in code"
    );
    assert!(rig.record("folder-browser-note").is_some(), "No subfolders");
    rig.click("folder-browser-use");
    let Some(Command::AddProject { reply, .. }) = rig.asked().pop() else {
        panic!("Use this folder registers it");
    };
    reply
        .send(Err("project path is not an existing directory".into()))
        .unwrap();
    rig.draw();
    assert!(rig.record("folder-browser").is_some(), "the form stays");
    assert_eq!(
        rig.ws(|ws, _, _| ws.add_project_state().clone())["error"],
        "project path is not an existing directory"
    );

    // Escape closes the form, and so does a press outside it; the keyboard goes back each time.
    rig.press("escape");
    assert!(rig.record("folder-browser").is_none(), "Escape closed it");
    assert!(rig.terminal_focused(), "the keyboard is back after Escape");
    open_add_project(rig);
    rig.mouse(WIDTH - 8., HEIGHT - 8.);
    assert!(
        rig.record("folder-browser").is_none(),
        "a press outside closed it"
    );
    assert!(
        rig.terminal_focused(),
        "the keyboard is back after the press"
    );
    println!("folder-browser: ok");
}

/// The record whose id ends in `:test_id`: an element the parity table does not name, by its
/// `data-testid` (`~n12:workspace-project-memory-p`).
fn by_test_id(rig: &mut Rig, test_id: &str) -> String {
    let suffix = format!(":{test_id}");
    rig.draw()
        .into_iter()
        .map(|r| r.name.to_string())
        .find(|name| name.ends_with(&suffix))
        .unwrap_or_else(|| panic!("{test_id} is drawn"))
}

/// The one question the window put to the core since the last call: its frame and its reply.
fn one_ask(rig: &mut Rig, kind: &str) -> (Value, client::Answer) {
    let asked = rig.asked();
    let mut asks: Vec<(Value, client::Answer)> = asked
        .into_iter()
        .filter_map(|command| match command {
            Command::Ask { frame, reply } => Some((frame, reply)),
            _ => None,
        })
        .collect();
    assert_eq!(asks.len(), 1, "one question");
    let (frame, reply) = asks.pop().unwrap();
    assert_eq!(frame["type"], kind, "{frame}");
    (frame, reply)
}

/// Project `p`'s menu (a right press on its row), then its item `test_id`.
fn project_menu_item(rig: &mut Rig, test_id: &str) {
    let at = rig
        .record("project-toggle:p")
        .expect("the project row")
        .bounds
        .center();
    rig.mouse_with(MouseButton::Right, f32::from(at.x), f32::from(at.y));
    let item = by_test_id(rig, test_id);
    rig.click(&item);
}

fn instructions(rig: &mut Rig) {
    rig.asked();
    // The project's menu opens Instructions, which loads them through the core.
    project_menu_item(rig, "workspace-project-instructions-p");
    assert_eq!(rig.open_screens(), ["instructions"]);
    let (frame, reply) = one_ask(rig, "instructions.get");
    assert_eq!(
        (&frame["scope"], &frame["id"]),
        (&json!("project"), &json!("p"))
    );
    let loaded = json!({"scope": "project", "id": "p", "text": "", "folders": [], "revision": 1,
        "maxChars": 100});
    reply.send(Ok(loaded.clone())).unwrap();
    rig.draw();
    assert!(!rig.terminal_focused(), "the dialog has the keyboard");
    // Typed text is saved through the core; once it takes it the dialog closes.
    let field = rig
        .record("instructions-text")
        .expect("the text field")
        .bounds
        .center();
    rig.mouse(f32::from(field.x), f32::from(field.y));
    rig.type_text("Hi");
    rig.click("instructions-save");
    let (frame, reply) = one_ask(rig, "instructions.set");
    assert_eq!(
        (&frame["text"], &frame["folders"]),
        (&json!("Hi"), &json!([]))
    );
    reply
        .send(Ok(json!({"text": "Hi", "folders": [], "maxChars": 100})))
        .unwrap();
    rig.draw();
    assert!(rig.open_screens().is_empty(), "saved, closed");
    assert!(rig.terminal_focused(), "the keyboard is back");

    // A refusal stays in the dialog with the core's reason.
    project_menu_item(rig, "workspace-project-instructions-p");
    let (_, reply) = one_ask(rig, "instructions.get");
    reply.send(Ok(loaded.clone())).unwrap();
    rig.draw();
    rig.click("instructions-save");
    let (_, reply) = one_ask(rig, "instructions.set");
    reply
        .send(Err("Reference folders must be absolute paths.".into()))
        .unwrap();
    rig.draw();
    assert_eq!(
        rig.open_screens(),
        ["instructions"],
        "the refusal keeps it open"
    );
    assert!(
        rig.record("instructions-error").is_some(),
        "with the reason"
    );
    // Escape closes it, and so does a press on the backdrop.
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    assert!(rig.terminal_focused());
    project_menu_item(rig, "workspace-project-instructions-p");
    let (_, reply) = one_ask(rig, "instructions.get");
    reply.send(Ok(loaded)).unwrap();
    rig.mouse(8., 8.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert!(rig.terminal_focused());
    println!("instructions: ok");
}

fn memory(rig: &mut Rig) {
    rig.asked();
    let entry = json!({"name": "a.md", "size": 2, "revision": "r1",
        "author": {"kind": "outside"}, "updatedAt": 0});
    let index = json!({"projectId": "p", "files": [entry], "maxFiles": 8, "maxChars": 100});
    // The project's menu opens its memory, listed through the core.
    project_menu_item(rig, "workspace-project-memory-p");
    assert_eq!(rig.open_screens(), ["memory"]);
    let (frame, reply) = one_ask(rig, "memory.list");
    assert_eq!(frame["projectId"], "p");
    reply.send(Ok(index.clone())).unwrap();
    rig.draw();
    assert_eq!(rig.keys("memory-row"), ["a.md"]);
    assert!(
        rig.record("memory-enabled").is_some(),
        "the core can turn memory off"
    );
    // A file opens through the core; Back returns to the list.
    rig.click("memory-open:a.md");
    let (frame, reply) = one_ask(rig, "memory.get");
    assert_eq!(frame["name"], "a.md");
    reply
        .send(Ok(
            json!({"projectId": "p", "file": {"entry": entry, "text": "hi"}}),
        ))
        .unwrap();
    rig.draw();
    assert!(rig.record("memory-file-name").is_some(), "the file is open");
    rig.click("memory-back");
    assert!(rig.record("memory-file-name").is_none(), "back in the list");
    // Delete asks first, in place over the dialog; yes deletes it at the revision it was read at.
    rig.click("memory-delete:a.md");
    assert!(rig.record("memory-confirm").is_some(), "the question");
    assert_eq!(rig.open_screens(), ["memory"], "drawn in the dialog");
    let accept = by_test_id(rig, "confirm-accept");
    rig.click(&accept);
    let (frame, reply) = one_ask(rig, "memory.delete");
    assert_eq!(
        (&frame["name"], &frame["baseRevision"]),
        (&json!("a.md"), &json!("r1"))
    );
    reply
        .send(Ok(
            json!({"projectId": "p", "files": [], "maxFiles": 8, "maxChars": 100}),
        ))
        .unwrap();
    rig.draw();
    assert!(
        rig.record("memory-note").is_some() || rig.keys("memory-row").is_empty(),
        "gone"
    );
    // Close, Escape and a press on the backdrop close it.
    rig.click("memory-close");
    assert!(rig.open_screens().is_empty(), "Close closed it");
    assert!(rig.terminal_focused());
    project_menu_item(rig, "workspace-project-memory-p");
    let (_, reply) = one_ask(rig, "memory.list");
    reply.send(Ok(index)).unwrap();
    rig.press("escape");
    assert!(rig.open_screens().is_empty(), "Escape closed it");
    project_menu_item(rig, "workspace-project-memory-p");
    rig.mouse(8., 8.);
    assert!(rig.open_screens().is_empty(), "the backdrop closed it");
    assert!(rig.terminal_focused());
    println!("memory: ok");
}

/// Project `p`'s worktrees as the core lists them: its main checkout and a dirty linked one.
fn worktree_listing() -> Value {
    json!({"type": "worktree.list.result", "hostId": "local", "repoPath": "/work",
        "defaultRoot": "/wt", "worktrees": [
            {"path": "/work", "branch": "main", "head": "a1", "isPrimary": true, "isDirty": false},
            {"path": "/wt/fix", "branch": "fix", "head": "b2", "isPrimary": false, "isDirty": true}]})
}

/// Answers the menu's listing of project `p`'s worktrees.
fn list_worktrees(rig: &mut Rig) {
    let (frame, reply) = one_ask(rig, "worktree.list");
    assert_eq!(frame["repoPath"], "/work", "{frame}");
    assert!(frame.get("hostId").is_none(), "this computer is left out");
    reply.send(Ok(worktree_listing())).unwrap();
    rig.draw();
}

/// Project `p`'s + (shown while the pointer is over its row, and only then named).
fn click_worktree_plus(rig: &mut Rig) {
    let plus = match rig.record("worktree-plus") {
        Some(_) => "worktree-plus".to_string(),
        None => by_test_id(rig, "worktree-menu-local-/work"),
    };
    rig.click(&plus);
}

/// The window's question in its confirmation, then yes.
fn accept_confirmation(rig: &mut Rig) {
    assert_eq!(rig.open_screens(), ["confirm"], "asked first");
    rig.click("confirm-accept");
}

fn worktree(rig: &mut Rig) {
    rig.asked();
    // A git project's + (shown when the pointer is over its row) opens its menu on the create
    // form, its worktrees listed through the core and the keyboard in the task name.
    click_worktree_plus(rig);
    list_worktrees(rig);
    assert!(rig.record("worktree-popover").is_some(), "the menu is open");
    assert_eq!(rig.keys("worktree-entry"), ["/work", "/wt/fix"]);
    assert!(rig.record("worktree-name-input").is_some(), "on the form");
    assert!(!rig.terminal_focused(), "the form has the keyboard");
    // A create the core refuses stays in the form with its reason.
    rig.type_text("Fix it");
    rig.click("worktree-create-submit");
    let (frame, reply) = one_ask(rig, "worktree.create");
    assert_eq!(
        (&frame["repoPath"], &frame["name"], &frame["branch"]),
        (&json!("/work"), &json!("Fix it"), &json!("")),
        "{frame}"
    );
    reply
        .send(Ok(json!({"type": "worktree.error", "hostId": "local",
            "message": "A branch named fix-it already exists.", "dirty": false})))
        .unwrap();
    rig.draw();
    assert!(rig.record("worktree-error").is_some(), "with the reason");
    assert!(
        rig.record("worktree-name-input").is_some(),
        "still on the form"
    );
    // One it makes closes the form and lists the worktrees again.
    rig.click("worktree-create-submit");
    let (_, reply) = one_ask(rig, "worktree.create");
    reply
        .send(Ok(
            json!({"type": "worktree.done", "hostId": "local", "action": "create",
            "path": "/wt/fix-it"}),
        ))
        .unwrap();
    rig.draw();
    list_worktrees(rig);
    assert!(
        rig.record("worktree-name-input").is_none(),
        "the form closed"
    );
    assert!(
        rig.record("worktree-new").is_some(),
        "the list's New worktree"
    );

    // Remove asks first; a dirty checkout comes back refused and is asked again, forced.
    rig.click("worktree-remove:/wt/fix");
    accept_confirmation(rig);
    let (frame, reply) = one_ask(rig, "worktree.remove");
    assert_eq!(
        (&frame["path"], &frame["force"], &frame["deleteBranch"]),
        (&json!("/wt/fix"), &json!(false), &json!(false)),
        "{frame}"
    );
    reply
        .send(Ok(json!({"type": "worktree.error", "hostId": "local",
            "message": "contains modified or untracked files", "dirty": true})))
        .unwrap();
    rig.draw();
    accept_confirmation(rig);
    let (frame, reply) = one_ask(rig, "worktree.remove");
    assert_eq!(frame["force"], true, "forced the second time");
    reply
        .send(Ok(
            json!({"type": "worktree.done", "hostId": "local", "action": "remove",
            "path": "/wt/fix"}),
        ))
        .unwrap();
    rig.draw();
    list_worktrees(rig);
    assert!(rig.open_screens().is_empty(), "the questions are gone");

    // Open starts a terminal in that checkout and closes the menu.
    rig.click("worktree-open:/work");
    assert_eq!(
        launched(rig),
        [(
            "local".to_string(),
            Some("/work".to_string()),
            "terminal".to_string()
        )]
    );
    assert!(rig.record("worktree-popover").is_none(), "Open closed it");

    // Escape closes it, and so does a press outside it; the keyboard goes back.
    click_worktree_plus(rig);
    list_worktrees(rig);
    rig.press("escape");
    assert!(rig.record("worktree-popover").is_none(), "Escape closed it");
    assert!(rig.terminal_focused(), "the keyboard is back");
    click_worktree_plus(rig);
    list_worktrees(rig);
    rig.mouse(WIDTH - 8., HEIGHT - 8.);
    assert!(
        rig.record("worktree-popover").is_none(),
        "a press outside closed it"
    );
    assert!(rig.terminal_focused());
    println!("worktree: ok");
}

const NEW_WORKSPACE_KEY: &str = if cfg!(target_os = "macos") {
    "cmd-n"
} else {
    "ctrl-shift-n"
};

/// `state()` where this computer's core runs creates in the background (`worktree.job`), with
/// Settings' "Empty workspace opens" set to a terminal, and then `more` from the core.
fn job_state(more: &[Value]) -> State {
    let mut state = state();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "worktree.startFrom", "worktree.job"]})));
    state.apply(&message(json!({"type": "settings.current",
        "settings": {"emptyWorkspaceAgent": "terminal"}})));
    for frame in more {
        state.apply(&message(frame.clone()));
    }
    state
}

fn show(rig: &mut Rig, state: State) {
    let model = state.model();
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
    });
    rig.draw();
}

/// A background create of `/wt/job` (branch `job`) as `worktree.jobs` lists it.
fn job(status: &str, error: Option<&str>) -> Value {
    json!({"type": "worktree.jobs", "jobs": [{"jobId": "j1", "repoPath": "/work", "branch": "job",
        "path": "/wt/job", "status": status, "phase": "Checking out", "error": error,
        "startedAt": 1}]})
}

fn worktree_jobs(rig: &mut Rig) {
    show(rig, job_state(&[]));
    rig.asked();
    // Where the core says `worktree.job`, a create is a job: the form closes once the core takes
    // it, and nothing starts before the checkout is listed.
    click_worktree_plus(rig);
    list_worktrees(rig);
    // The menu was last closed on its form, so the form does not take the keyboard again by
    // itself (as on the web): a press in the task name gives it.
    rig.click("worktree-name-input");
    assert!(!rig.terminal_focused(), "the form has the keyboard");
    rig.type_text("Job");
    rig.click("worktree-create-submit");
    let (frame, reply) = one_ask(rig, "worktree.job.start");
    assert_eq!(
        (&frame["repoPath"], &frame["name"]),
        (&json!("/work"), &json!("Job")),
        "{frame}"
    );
    assert!(frame.get("hostId").is_none(), "this computer's own");
    reply
        .send(Ok(
            json!({"type": "worktree.job.started", "job": {"jobId": "j1",
            "repoPath": "/work", "branch": "job", "path": "/wt/job", "status": "running",
            "phase": "Checking out", "startedAt": 1}}),
        ))
        .unwrap();
    rig.draw();
    assert!(
        rig.record("worktree-popover").is_none(),
        "the form closed at once"
    );
    // Its progress is a sidebar row; a failed one says so with the reason until retried.
    show(rig, job_state(&[job("running", None)]));
    by_test_id(rig, "worktree-job-cancel-job");
    show(
        rig,
        job_state(&[job("failed", Some("fatal: no space left"))]),
    );
    // Retry and Dismiss are drawn for a failed job only.
    by_test_id(rig, "worktree-job-dismiss-job");
    assert!(launched(rig).is_empty(), "a failed create starts nothing");
    let retry = by_test_id(rig, "worktree-job-retry-job");
    rig.click(&retry);
    let retried = rig
        .asked()
        .into_iter()
        .any(|c| matches!(c, Command::WorktreeJob { verb: "retry", job_id } if job_id == "j1"));
    assert!(retried, "Retry is the core's");
    // Once the core lists the checkout, the starting pane ("Empty workspace opens") starts in it.
    let made = json!({"type": "workspace.updated", "workspace": {"id": "w2", "projectId": "p",
        "hostId": "local", "path": "/wt/job", "name": "job", "branch": "job",
        "parentWorkspaceId": "w1", "dirty": false, "state": "active", "createdAt": 1,
        "updatedAt": 1, "pinned": false}, "snapshotEpoch": "e", "snapshotRevision": 2});
    show(
        rig,
        job_state(&[made.clone(), json!({"type": "worktree.jobs", "jobs": []})]),
    );
    assert_eq!(
        launched(rig),
        [(
            "local".to_string(),
            Some("/wt/job".to_string()),
            "terminal".to_string()
        )]
    );
    let run = |rig: &mut Rig, name: &str, args: Value| {
        rig.ws(|ws, window, cx| ws.run_command(name, Some(&args), window, cx))
    };
    assert!(run(rig, "worktree.cancel", json!({"id": "j1"})).is_err());

    // New workspace's key and leader W open the shown project's menu, the key on the form.
    rig.press(NEW_WORKSPACE_KEY);
    list_worktrees(rig);
    assert!(rig.record("worktree-popover").is_some(), "the menu is open");
    assert!(rig.record("worktree-name-input").is_some(), "on the form");
    rig.press("escape");
    rig.press("ctrl-space");
    rig.press("shift-w");
    list_worktrees(rig);
    assert!(
        rig.record("worktree-popover").is_some(),
        "leader W opened it"
    );
    assert!(rig.record("worktree-name-input").is_none(), "on the list");
    assert!(rig.terminal_focused(), "the list takes no keyboard");
    rig.mouse(WIDTH - 8., HEIGHT - 8.);
    assert!(rig.record("worktree-popover").is_none());

    // `worktree.remove` asks first in the menu; only yes removes it.
    assert!(run(rig, "worktree.remove", json!({"id": "w1"})).is_err());
    run(rig, "worktree.remove", json!({"id": "w2"})).unwrap();
    rig.draw();
    assert!(
        !rig.asked().iter().any(|c| matches!(c, Command::Ask { .. })),
        "nothing is removed before the answer"
    );
    accept_confirmation(rig);
    let (frame, reply) = one_ask(rig, "worktree.remove");
    assert_eq!(frame["path"], "/wt/job", "{frame}");
    reply
        .send(Ok(
            json!({"type": "worktree.done", "hostId": "local", "action": "remove",
            "path": "/wt/job"}),
        ))
        .unwrap();
    rig.draw();
    assert!(rig.open_screens().is_empty());
    // What the computer can do changing asks nothing again.
    show(rig, state());
    assert!(
        rig.open_screens().is_empty(),
        "the removal is not asked again"
    );
    assert!(rig.terminal_focused());
    println!("worktree-jobs: ok");
}

const FIND_KEY: &str = if cfg!(target_os = "macos") {
    "cmd-f"
} else {
    "ctrl-f"
};

/// The query the terminal on screen holds, and whether its find is open.
fn find_state(rig: &mut Rig) -> (String, bool) {
    rig.ws(|ws, _, cx| {
        let view = ws.terminal().expect("a terminal").read(cx);
        (view.find_query().to_string(), view.find_open())
    })
}

fn terminal_find(rig: &mut Rig) {
    // The find key opens the bar over the pane, its field with the keyboard.
    rig.press(FIND_KEY);
    assert!(rig.record("term-search").is_some(), "the find bar is drawn");
    assert!(!rig.terminal_focused(), "the bar's field has the keyboard");
    rig.type_text("needle");
    assert_eq!(
        find_state(rig),
        ("needle".to_string(), true),
        "the terminal's query"
    );
    // Escape closes it and gives the terminal the keyboard back.
    rig.press("escape");
    assert!(!find_state(rig).1, "find closed");
    assert!(rig.record("term-search").is_none(), "the bar went");
    assert!(rig.terminal_focused(), "the keyboard is back");
    // Opened again it holds the query; × closes it.
    rig.press(FIND_KEY);
    assert!(rig.record("term-search-input").is_some());
    rig.click("term-search-button:Close (Escape)");
    assert!(!find_state(rig).1, "× closed it");
    assert!(rig.terminal_focused());
    println!("terminal-find: ok");
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
    folder_browser(&mut rig);
    add_project_scroll(&mut rig);
    instructions(&mut rig);
    memory(&mut rig);
    worktree(&mut rig);
    worktree_jobs(&mut rig);
    terminal_find(&mut rig);
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
