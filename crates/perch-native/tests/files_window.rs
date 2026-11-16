//! The Files screen in a real window, against a core this test plays: the drawer's Files tab
//! lists the workspace (the screen asks for the tree; the answer is drawn as rows), a click on a
//! row opens the file as the workspace's preview tab, which reads the file and its durable buffer,
//! closing the tab asks nothing and keeps the store's document, and `files.extract` asks the
//! core to extract an archive.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Command;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

fn state() -> State {
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
        "snapshotRevision": 1, "projects": [project], "workspaces": [checkout]})));
    state
}

fn state_model() -> perch_native::sidebar::Model {
    state().model()
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

    fn settle(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..4 {
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
        let error = self.ws(|ws, _, cx| ws.screen_error("files", cx));
        assert!(error.is_none(), "the files screen failed: {error:?}");
        probe::records().into_values().collect()
    }

    /// The `fs.*` frames the window sent the core since the last call.
    fn sent(&mut self) -> Vec<Value> {
        let mut frames = Vec::new();
        while let Ok(command) = self.asked.try_recv() {
            if let Command::Send(frame) = command {
                if frame["type"].as_str().is_some_and(|t| t.starts_with("fs.")) {
                    frames.push(frame);
                }
            }
        }
        frames
    }

    fn answer(&mut self, value: Value) {
        let message = message(value);
        self.ws(|ws, _, cx| ws.on_files_message(&message, cx));
    }

    fn click(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                for input in [
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Left,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                ] {
                    window.dispatch_event(input, cx);
                }
            })
            .unwrap();
    }
}

fn named<'a>(records: &'a [ProbeRecord], suffix: &str) -> Option<&'a ProbeRecord> {
    records.iter().find(|r| r.name.ends_with(suffix))
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-files-window-{}", std::process::id()));
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
    let kept = scratch.join("window.json");
    let window = cx
        .open_window(size(px(1200.), px(800.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model.clone(), Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                    .with_window_state(kept.clone())
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    rig.settle();
    rig.sent();

    // The explorer asks for the workspace's root and draws the answer.
    rig.ws(|ws, _, cx| ws.show_files("w1", cx));
    rig.settle();
    let sent = rig.sent();
    let tree = sent
        .iter()
        .find(|f| f["type"] == "fs.tree")
        .unwrap_or_else(|| panic!("the explorer asks for the tree: {sent:?}"));
    assert_eq!(tree["workspaceId"], "w1");
    rig.answer(json!({"type": "fs.tree.result", "requestId": tree["requestId"],
        "workspaceId": "w1", "path": tree["path"].as_str().unwrap_or(""), "entries": [
            {"path": "src", "name": "src", "kind": "directory", "size": 0, "readonly": false, "executable": false},
            {"path": "README.md", "name": "README.md", "kind": "file", "size": 6, "readonly": false, "executable": false},
        ], "truncated": false}));
    let records = rig.settle();
    let row = named(&records, "files-entry:README.md").unwrap_or_else(|| {
        let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
        names.sort();
        panic!("README.md has a row: {names:?}")
    });

    // A click opens it as the workspace's preview tab, which reads it and its buffer.
    let at = row.bounds.center();
    rig.click(at);
    rig.settle();
    let id = "w1\nREADME.md";
    let tabs = rig.ws(|ws, _, _| (ws.tabs().shown(), ws.tabs().is_preview(id)));
    assert_eq!(tabs, (vec![id.to_string()], true), "a preview tab");
    let sent = rig.sent();
    let read = sent
        .iter()
        .find(|f| f["type"] == "fs.read")
        .unwrap_or_else(|| panic!("the file is read: {sent:?}"));
    assert_eq!(read["path"], "README.md");
    assert!(
        sent.iter().any(|f| f["type"] == "fs.buffer.get"),
        "{sent:?}"
    );
    rig.answer(
        json!({"type": "fs.read.result", "requestId": read["requestId"],
        "workspaceId": "w1", "content": "# Work", "version": "v1",
        "metadata": {"path": "README.md", "name": "README.md", "size": 6, "readonly": false,
                     "executable": false, "kind": "file"}}),
    );
    rig.settle();
    let loaded = rig.ws(|ws, _, _| {
        ws.files()
            .document("w1", "README.md")
            .map(|d| d.content.clone())
    });
    assert_eq!(loaded.as_deref(), Some("# Work"));
    // The native editor holds the file, by the web's document key.
    let editors = rig
        .cx
        .update(|cx| cx.global::<WindowMods>().editors.clone());
    let doc = "w1\0README.md\x000";
    let text = |rig: &mut Rig| {
        let state = editors
            .state(doc)
            .unwrap_or_else(|| panic!("the editor is open: {:?}", editors.keys()));
        rig.cx.update(|cx| state.read(cx).value().to_string())
    };
    assert_eq!(text(&mut rig), "# Work");

    // A draft the core kept arrives after the editor opened: the editor takes it.
    let get = sent.iter().find(|f| f["type"] == "fs.buffer.get").unwrap();
    rig.answer(json!({"type": "fs.buffer.result", "requestId": get["requestId"], "workspaceId": "w1",
        "buffer": {"workspaceId": "w1", "path": "README.md", "content": "# Kept", "baseContent": "# Work",
            "baseVersion": "v1", "externalVersion": "v1", "revision": 1, "dirty": true, "conflict": false,
            "updatedAt": 0}}));
    rig.settle();
    assert_eq!(text(&mut rig), "# Kept");

    // An edit reaches the store as the draft, and an edited preview is kept.
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            editors.set_value(doc, "# Work!", false, window, cx)
        })
        .unwrap();
    // The store has it at once; the screen and the strip are told shortly after.
    rig.cx.run_until_parked();
    let draft = rig.ws(|ws, _, _| {
        ws.files()
            .document("w1", "README.md")
            .map(|d| d.content.clone())
    });
    assert_eq!(draft.as_deref(), Some("# Work!"));
    rig.cx.advance_clock(std::time::Duration::from_millis(200));
    rig.settle();
    let draft = rig.ws(|ws, _, _| {
        ws.files()
            .document("w1", "README.md")
            .map(|d| (d.content.clone(), d.dirty()))
    });
    assert_eq!(draft, Some(("# Work!".to_string(), true)));
    assert!(
        !rig.ws(|ws, _, _| ws.tabs().is_preview(id)),
        "an edited preview is kept"
    );

    // An edit not yet sent (its debounce has not run) goes to the core's buffer when the window
    // flushes its drafts before closing.
    rig.sent();
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            editors.set_value(doc, "# Work!!", false, window, cx)
        })
        .unwrap();
    rig.cx.run_until_parked();
    assert!(
        !rig.sent().iter().any(|f| f["type"] == "fs.buffer.set"),
        "not sent before its debounce"
    );
    rig.ws(|ws, _, cx| ws.flush_drafts(cx));
    let sent = rig.sent();
    assert!(
        sent.iter()
            .any(|f| f["type"] == "fs.buffer.set" && f["content"] == "# Work!!"),
        "{sent:?}"
    );

    // Closing asks nothing: the tab goes, the document stays in the store.
    let closed = rig
        .ws(|ws, window, cx| ws.run_command("tabs.close", Some(&json!({ "id": id })), window, cx));
    assert!(closed.is_ok(), "{closed:?}");
    rig.settle();
    assert!(rig.ws(|ws, _, _| ws.tabs().shown().is_empty()));
    assert!(rig.ws(|ws, _, _| ws.files().document("w1", "README.md").is_some()));

    // `files.extract` asks the core to extract the archive.
    rig.sent();
    let asked = rig.ws(|ws, window, cx| {
        let args = json!({ "workspaceId": "w1", "path": "a.zip" });
        ws.run_command("files.extract", Some(&args), window, cx)
    });
    assert!(asked.is_ok(), "{asked:?}");
    let sent = rig.sent();
    assert!(
        sent.iter()
            .any(|f| f["type"] == "fs.extract" && f["path"] == "a.zip"),
        "{sent:?}"
    );

    // A regular file tab is kept in the window's state file and opened again by the next window,
    // without the keyboard; a preview is not kept.
    rig.ws(|ws, _, cx| ws.open_file("w1", "src/lib.rs", false, cx));
    rig.ws(|ws, _, cx| ws.open_file("w1", "docs/clean.md", true, cx));
    rig.settle();
    let state: Value = serde_json::from_slice(&std::fs::read(&kept).unwrap()).unwrap();
    assert_eq!(state["files"], json!(["w1\nsrc/lib.rs"]), "{state}");
    let next = rig.cx.update(|cx| {
        cx.new(|cx| Workspace::new(state_model(), None, cx).with_window_state(kept.clone()))
    });
    let strip = rig.cx.update(|cx| {
        (
            next.read(cx).tabs().strip().to_vec(),
            next.read(cx).tabs().active().map(str::to_string),
        )
    });
    assert_eq!(strip, (vec!["w1\nsrc/lib.rs".to_string()], None));

    let _ = std::fs::remove_dir_all(&scratch);
    println!("files window: ok");
}
