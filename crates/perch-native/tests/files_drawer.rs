//! The drawer's Files tab in the owner's shape: many projects and sessions, a session of this repository shown, a
//! narrow drawer opened on Files the way a person opens it (the drawer key, not `show_files`), the root listed from
//! the repository. One React commit of the explorer runs past its time budget, as a slow commit under load does: the
//! cut leaves that React tree half done (the drawer was blank), so the copy must start afresh and draw its rows
//! again. Then sessions are busy for a while and the drawer is closed and opened again; the rows stay.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs (this test plays it).

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{px, size, AppContext as _, HeadlessAppContext, Window, WindowHandle};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

const PROJECTS: usize = 12;
const SESSIONS: usize = 44;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// `PROJECTS` projects with a workspace each (`w0` is the repository), `SESSIONS` sessions spread over them.
fn state(repo: &Path) -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    let path = |i: usize| {
        if i == 0 {
            repo.display().to_string()
        } else {
            format!("/work/p{i}")
        }
    };
    let projects: Vec<Value> = (0..PROJECTS)
        .map(|i| {
            json!({"id": format!("p{i}"), "hostId": "local", "name": format!("Project {i}"),
            "path": path(i), "favorite": false, "createdAt": 0, "updatedAt": 0})
        })
        .collect();
    let workspaces: Vec<Value> = (0..PROJECTS)
        .map(|i| json!({"id": format!("w{i}"), "projectId": format!("p{i}"), "hostId": "local",
            "path": path(i), "name": format!("w{i}"), "branch": "main", "dirty": false, "state": "active",
            "createdAt": 0, "updatedAt": 0, "pinned": false}))
        .collect();
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": projects, "workspaces": workspaces})));
    state.apply(&message(sessions(0)));
    state
}

/// The session list at `tick`: each session's title and update time move, as busy agents' do.
fn sessions(tick: usize) -> Value {
    let list: Vec<Value> = (0..SESSIONS)
        .map(|i| {
            let p = i % PROJECTS;
            json!({"id": format!("s{i}"), "title": format!("Session {i} · {tick}"), "cwd": "/work",
                "createdAt": 0, "updatedAt": tick, "status": if (i + tick) % 3 == 0 { "running" } else { "idle" },
                "hostId": "local", "projectId": format!("p{p}"), "workspaceId": format!("w{p}"),
                "cliProviderId": "claude"})
        })
        .collect();
    json!({"type": "session.list", "sessions": list})
}

/// The repository's root as the core lists it.
fn root_entries(repo: &Path) -> Vec<Value> {
    let mut entries: Vec<Value> = std::fs::read_dir(repo)
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let kind = if e.path().is_dir() { "directory" } else { "file" };
            json!({"path": name, "name": name, "kind": kind, "size": 0, "readonly": false, "executable": false})
        })
        .collect();
    entries.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    entries
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
        probe::records().into_values().collect()
    }

    /// Saves the window's frame as a PNG when `PERCH_DRAWER_SHOTS` names a folder.
    fn shot(&mut self, name: &str) {
        let Some(dir) = std::env::var_os("PERCH_DRAWER_SHOTS") else {
            return;
        };
        let image = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
                window.render_to_image().expect("offscreen render")
            })
            .unwrap();
        image
            .save(Path::new(&dir).join(format!("{name}.png")))
            .unwrap();
    }

    /// Answers every `fs.tree` the window asked for with the repository's root.
    fn serve(&mut self, repo: &Path) {
        for frame in self.sent() {
            if frame["type"] == "fs.tree" {
                assert_eq!(frame["workspaceId"], "w0");
                let answer = message(
                    json!({"type": "fs.tree.result", "requestId": frame["requestId"],
                    "workspaceId": "w0", "path": "", "entries": root_entries(repo), "truncated": false}),
                );
                self.ws(|ws, _, cx| ws.on_files_message(&answer, cx));
            }
        }
    }

    /// Lets the window run, answering the explorer, until it draws the root's rows; fails with what it drew.
    fn rows(&mut self, repo: &Path, what: &str) {
        let mut records = Vec::new();
        for _ in 0..40 {
            self.serve(repo);
            records = self.settle();
            if records
                .iter()
                .any(|r| r.name.ends_with("files-entry:AGENTS.md"))
            {
                return;
            }
        }
        self.shot(what);
        panic!("{what}: the explorer draws no rows: {:?}", names(&records));
    }

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
}

/// 60 model updates from `from`, each drawn; how long they took.
fn churn(rig: &mut Rig, live: &mut State, from: usize) -> std::time::Duration {
    let sidebar = rig.ws(|ws, _, _| ws.sidebar().clone());
    let started = Instant::now();
    for tick in from..from + 60 {
        live.apply(&message(sessions(tick)));
        let model = live.model();
        rig.cx
            .update(|cx| sidebar.update(cx, |s, cx| s.apply(Update::Model(model), cx)));
        rig.cx.run_until_parked();
        rig.cx
            .update_window(rig.window.into(), |_, window: &mut Window, cx| {
                window.refresh();
                let _ = window.draw(cx);
            })
            .unwrap();
    }
    started.elapsed()
}

fn names(records: &[ProbeRecord]) -> Vec<String> {
    let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
    names.sort();
    names
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-files-drawer-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, asked) = unbounded();
    let mut live = state(&repo);
    let model = live.model();
    let kept = scratch.join("window.json");
    // The owner's window: about 1230 points wide, the drawer at its narrowest.
    std::fs::write(&kept, r#"{"toolsWidth": 280}"#).unwrap();
    let window = cx
        .open_window(size(px(1231.), px(830.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model.clone(), Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                    .with_window_state(kept.clone())
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));

    // The person's copy of the stock screen: the same explorer, whose React commit that first draws the tree runs
    // past the 500 ms a timer may take.
    let stock = user.join(".stock/files");
    let mine = user.join("files");
    let copied = std::process::Command::new("cp")
        .arg("-R")
        .arg(&stock)
        .arg(&mine)
        .status()
        .unwrap();
    assert!(copied.success());
    let main = std::fs::read_to_string(stock.join("main.js")).unwrap().replace(
        "export default screen(\"files\", Files,",
        "import { createElement } from \"react\";\nimport { useWorkspaceFiles } from \"@perch/sdk\";\n\
         function Slow(p) { const f = useWorkspaceFiles(p.workspaceId); let slow = false; \
         if (p.layout === \"explorer\" && f.trees[\"\"]?.state === \"ready\" && !globalThis.__slowOnce) { globalThis.__slowOnce = 1; slow = true; } \
         if (slow) { const t = Date.now(); while (Date.now() - t < 700) {} } \
         return createElement(Files, p); }\n\
         export default screen(\"files\", Slow,",
    );
    assert!(
        main.contains("Slow"),
        "the stock screen's entry changed: {main}"
    );
    std::fs::write(mine.join("main.js"), main).unwrap();

    let mut rig = Rig { cx, window, asked };
    rig.settle();
    rig.sent();

    // A session of the repository is on screen; the drawer opens on Files as the drawer key opens it.
    for id in ["s0", "s12", "s24"] {
        let shown = rig.ws(|ws, _, cx| ws.show_session(id, cx));
        assert!(shown.is_ok(), "{shown:?}");
    }
    rig.ws(|ws, window, cx| ws.run_command("global.drawer", None, window, cx))
        .unwrap();
    rig.rows(&repo, "files-drawer-open");

    // Busy sessions: the core's model moves many times a second.
    churn(&mut rig, &mut live, 1);
    rig.rows(&repo, "files-drawer-busy");

    // Closed and opened again.
    for _ in 0..2 {
        rig.ws(|ws, window, cx| ws.run_command("global.drawer", None, window, cx))
            .unwrap();
        rig.settle();
    }
    rig.rows(&repo, "files-drawer-reopened");

    let _ = std::fs::remove_dir_all(&scratch);
    println!("files drawer: ok");
}
