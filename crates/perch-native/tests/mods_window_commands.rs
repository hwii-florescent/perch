//! The window commands stock mods run beyond the keymap's: `project.home` shows the project's start page,
//! `tab.pin` keeps a previewed file's tab, `workspace.files` and `workspace.git` open the drawer's tabs.
//! Offscreen, as the other window tests: no window is shown or focused, no core runs.

use gpui::{px, size, AppContext as _, HeadlessAppContext, Window, WindowHandle};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, POLL};
use perch_native::shell::Tools;
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::sync::Arc;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project with one checkout, `w1`, holding a session.
fn model() -> perch_native::sidebar::Model {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let checkout = json!({"id": "w1", "projectId": "p", "hostId": "local", "path": "/work",
        "name": "w1", "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project.clone()], "workspaces": [checkout]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r2", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 2, "projects": [project]})));
    state.apply(&message(json!({"type": "session.list", "sessions": [
        {"id": "alpha", "title": "alpha", "cwd": "/work", "createdAt": 0, "status": "idle",
         "hostId": "local", "projectId": "p", "workspaceId": "w1", "cliProviderId": "claude",
         "blocked": false}]})));
    state.model()
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn draw(&mut self) {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
    }

    fn run(&mut self, name: &str, args: Value) -> Result<(), String> {
        let result = self
            .window
            .update(&mut self.cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
            })
            .unwrap();
        self.draw();
        result
    }

    fn read<R>(&mut self, f: impl FnOnce(&Workspace) -> R) -> R {
        self.window.read_with(&self.cx, |ws, _| f(ws)).unwrap()
    }
}

fn project_home_shows_the_start_page() {
    let mut rig = rig();
    rig.window
        .update(&mut rig.cx, |ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
            })
        })
        .unwrap();
    rig.draw();
    assert_eq!(
        rig.read(|ws| ws.tabs().active().map(str::to_string)),
        Some("alpha".into())
    );
    rig.run("project.home", json!({"projectId": "p", "name": "Work"}))
        .unwrap();
    assert_eq!(
        rig.read(|ws| ws.tabs().visible().is_none()),
        true,
        "no tab on screen"
    );
    assert_eq!(
        rig.read(|ws| ws.tabs().strip().to_vec()),
        ["alpha"],
        "its tab stays in the strip"
    );
    assert!(rig
        .run("project.home", json!({"projectId": "gone"}))
        .is_err());
    assert!(rig.run("project.home", json!({})).is_err());
}

fn tab_pin_keeps_a_preview() {
    let mut rig = rig();
    let file = "w1\na.txt";
    rig.run(
        "file.open",
        json!({"workspaceId": "w1", "path": "a.txt", "preview": true}),
    )
    .unwrap();
    assert!(rig.read(|ws| ws.tabs().is_preview(file)));
    rig.run("tab.pin", json!({"id": file})).unwrap();
    assert!(!rig.read(|ws| ws.tabs().is_preview(file)), "kept");
    rig.run(
        "file.open",
        json!({"workspaceId": "w1", "path": "b.txt", "preview": true}),
    )
    .unwrap();
    assert!(
        rig.read(|ws| ws.tabs().strip().iter().any(|t| t == file)),
        "the next preview does not replace a kept tab"
    );
    // A tab that is not a preview stays as it is.
    rig.run("tab.pin", json!({"id": file})).unwrap();
    assert!(rig.run("tab.pin", json!({"id": "nope"})).is_err());
    assert!(rig.run("tab.pin", json!({})).is_err());
}

fn workspace_files_and_git_open_the_drawer() {
    let mut rig = rig();
    assert_eq!(rig.read(|ws| ws.drawer()), None);
    rig.run("workspace.git", json!({"id": "w1"})).unwrap();
    assert_eq!(rig.read(|ws| ws.drawer()), Some(Tools::Git));
    rig.run("workspace.files", json!({"id": "w1"})).unwrap();
    assert_eq!(rig.read(|ws| ws.drawer()), Some(Tools::Files));
    rig.run("workspace.git", json!({"id": "w1"})).unwrap();
    assert_eq!(rig.read(|ws| ws.drawer()), Some(Tools::Git));
    for command in ["workspace.git", "workspace.files"] {
        assert!(
            rig.run(command, json!({"id": "gone"})).is_err(),
            "{command}"
        );
        assert!(rig.run(command, json!({})).is_err(), "{command}");
    }
}

fn rig() -> Rig {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let window = cx
        .open_window(size(px(1100.), px(600.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model(), None, cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    let user = std::env::temp_dir().join(format!("perch-window-commands-{}", std::process::id()));
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    rig.draw();
    rig
}

fn main() {
    let scratch =
        std::env::temp_dir().join(format!("perch-window-commands-home-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(&scratch).unwrap();
    std::env::set_var("HOME", &scratch);
    project_home_shows_the_start_page();
    tab_pin_keeps_a_preview();
    workspace_files_and_git_open_the_drawer();
    let _ = std::fs::remove_dir_all(&scratch);
    let _ = std::fs::remove_dir_all(
        std::env::temp_dir().join(format!("perch-window-commands-{}", std::process::id())),
    );
    println!("mods_window_commands: ok");
}
