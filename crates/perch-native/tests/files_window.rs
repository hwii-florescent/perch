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

    fn right_click(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Right,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Right,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
    }

    /// Clicks the element named `suffix`, failing with every name drawn when there is none.
    fn click_named(&mut self, suffix: &str) {
        let records = self.settle();
        let at = named(&records, suffix)
            .unwrap_or_else(|| {
                let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
                names.sort();
                panic!("no {suffix}: {names:?}")
            })
            .bounds
            .center();
        self.click(at);
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

    // The entry menu: Delete, confirmed, asks the core to delete the entry; once it has, the
    // entry's open tab closes.
    rig.ws(|ws, _, cx| ws.open_file("w1", "README.md", false, cx));
    rig.ws(|ws, _, cx| ws.show_files("w1", cx));
    let records = rig.settle();
    let row = named(&records, "files-entry:README.md")
        .expect("README.md's row")
        .bounds
        .center();
    rig.sent();
    rig.right_click(row);
    // A workspace on this computer offers Open in Default App and Reveal; Ask agent waits for the
    // native Context Bridge. Neither is clicked here: it would open another app.
    let menu = rig.settle();
    assert!(named(&menu, ":file-menu-open-default").is_some());
    assert!(named(&menu, ":file-menu-reveal").is_some());
    assert!(named(&menu, ":file-menu-ask-agent").is_none());
    for bad in ["../outside", "/etc", "a/../../b"] {
        let refused = rig.ws(|ws, window, cx| {
            ws.run_command(
                "files.reveal",
                Some(&json!({ "workspaceId": "w1", "path": bad })),
                window,
                cx,
            )
        });
        assert!(refused.is_err(), "{bad} is refused");
    }
    rig.click_named(":file-menu-delete");
    rig.click_named("confirm-accept");
    rig.settle();
    let sent = rig.sent();
    let delete = sent
        .iter()
        .find(|f| f["type"] == "fs.mutate")
        .unwrap_or_else(|| panic!("the entry is deleted: {sent:?}"));
    assert_eq!(
        (delete["op"].as_str(), delete["path"].as_str()),
        (Some("delete"), Some("README.md"))
    );
    rig.answer(
        json!({"type": "fs.mutate.result", "requestId": delete["requestId"], "workspaceId": "w1",
        "op": "delete", "path": "README.md"}),
    );
    rig.settle();
    assert!(
        !rig.ws(|ws, _, _| ws.tabs().contains("w1\nREADME.md")),
        "its tab closed"
    );

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

    // The strip is kept in the window's state file, a preview as a preview, as the web keeps its
    // file tabs, and opened again by the next window, without the keyboard.
    rig.ws(|ws, _, cx| ws.open_file("w1", "src/lib.rs", false, cx));
    rig.ws(|ws, _, cx| ws.open_file("w1", "docs/clean.md", true, cx));
    rig.settle();
    let state: Value = serde_json::from_slice(&std::fs::read(&kept).unwrap()).unwrap();
    let w1 = &state["tabs"]["strips"]["w1"];
    assert_eq!(
        (&w1["strip"], &w1["previews"]),
        (
            &json!(["w1\nsrc/lib.rs", "w1\ndocs/clean.md"]),
            &json!(["w1\ndocs/clean.md"])
        ),
        "{state}"
    );

    // Back and Forward move over file tabs as over sessions.
    let active = |rig: &mut Rig| rig.ws(|ws, _, _| ws.tabs().active().map(str::to_string));
    assert_eq!(active(&mut rig).as_deref(), Some("w1\ndocs/clean.md"));
    let back = rig.ws(|ws, window, cx| ws.run_command("nav.back", None, window, cx));
    assert!(back.is_ok(), "{back:?}");
    assert_eq!(active(&mut rig).as_deref(), Some("w1\nsrc/lib.rs"));
    let forward = rig.ws(|ws, window, cx| ws.run_command("nav.forward", None, window, cx));
    assert!(forward.is_ok(), "{forward:?}");
    assert_eq!(active(&mut rig).as_deref(), Some("w1\ndocs/clean.md"));
    let next = rig.cx.update(|cx| {
        cx.new(|cx| Workspace::new(state_model(), None, cx).with_window_state(kept.clone()))
    });
    let strip = rig.cx.update(|cx| {
        (
            next.read(cx).tabs().strip().to_vec(),
            next.read(cx).tabs().active().map(str::to_string),
        )
    });
    // The kept tab belongs to w1's strip: no workspace is on screen yet, so none is drawn, and it
    // is there again once w1 is.
    assert_eq!(strip, (vec![], None));
    next.update(&mut rig.cx, |ws, cx| {
        ws.open_file("w1", "docs/new.md", false, cx)
    });
    let (strip, preview) = rig.cx.update(|cx| {
        let tabs = next.read(cx).tabs();
        (tabs.strip().to_vec(), tabs.is_preview("w1\ndocs/clean.md"))
    });
    assert_eq!(
        strip,
        ["w1\nsrc/lib.rs", "w1\ndocs/clean.md", "w1\ndocs/new.md"]
    );
    assert!(preview, "the preview comes back as a preview");

    // A Markdown file's Preview draws its draft, rendered, in place of the editor. A long one (as the repository's
    // docs are): lexed at once it ran past the 500 ms a click may take, and Preview never showed.
    let item = "- **Item** with `code`, a [link](https://perch.dev) and enough words to be a real line of a doc.\n";
    let long = format!(
        "# Notes title\n\nSome *words*.\n\n{}\n## More\n\nEnd.\n",
        item.repeat(800)
    );
    assert!(long.len() > 70_000);
    rig.ws(|ws, _, cx| ws.open_file("w1", "notes.md", false, cx));
    rig.settle();
    let sent = rig.sent();
    let read = sent
        .iter()
        .find(|f| f["type"] == "fs.read" && f["path"] == "notes.md")
        .unwrap_or_else(|| panic!("the file is read: {sent:?}"));
    rig.answer(
        json!({"type": "fs.read.result", "requestId": read["requestId"],
        "workspaceId": "w1", "content": long.clone(), "version": "v1",
        "metadata": {"path": "notes.md", "name": "notes.md", "size": 30, "readonly": false,
                     "executable": false, "kind": "file", "mediaType": "text/markdown"}}),
    );
    let records = rig.settle();
    let loaded = rig.ws(|ws, _, _| {
        ws.files()
            .document("w1", "notes.md")
            .map(|d| d.content.clone())
    });
    assert_eq!(loaded.as_ref(), Some(&long));
    assert!(named(&records, "files-markdown-preview").is_none());
    assert!(
        named(&records, "files-editor").is_some(),
        "the editor first"
    );
    let toggle = named(&records, "files-markdown-view")
        .unwrap_or_else(|| {
            let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
            names.sort();
            panic!("a Markdown file has the Source/Preview toggle: {names:?}")
        })
        .bounds;
    // Preview is the toggle's second half.
    let preview = gpui::point(
        toggle.origin.x + toggle.size.width * 0.75,
        toggle.origin.y + toggle.size.height * 0.5,
    );
    rig.click(preview);
    let records = rig.settle();
    if let Some(dir) = std::env::var_os("PERCH_FILES_SHOTS") {
        let image = rig
            .cx
            .update_window(rig.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
                window.render_to_image().expect("offscreen render")
            })
            .unwrap();
        image
            .save(PathBuf::from(dir).join("markdown-preview.png"))
            .unwrap();
    }
    let shown = named(&records, "files-markdown-preview").unwrap_or_else(|| {
        let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
        names.sort();
        panic!("Preview draws the rendered draft: {names:?}")
    });
    assert!(
        shown.bounds.size.height > px(100.),
        "the preview fills the pane: {:?}",
        shown.bounds
    );
    assert!(
        named(&records, "files-editor").is_none(),
        "the editor is hidden under Preview"
    );

    let _ = std::fs::remove_dir_all(&scratch);
    println!("files window: ok");
}
