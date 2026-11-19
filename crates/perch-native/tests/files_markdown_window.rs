//! The owner's steps with real Markdown documents of this repository, in the window the owner has (12 projects,
//! 44 sessions, the drawer at its narrowest): the drawer's Files tab lists the repository, `docs/` opens, a click
//! opens a long document (`PERCH_MD_FILES`, comma-separated; default `docs/ARCHITECTURE.md` (72 KB, the owner's) and
//! `docs/UI-UX-DIRECTION.md` (106 KB), whose Preview the script engine cut past its time budget) in its tab; its source is
//! scrolled, Preview is clicked and scrolled, Source is clicked, the editor is clicked and scrolled, Preview and
//! Source again; the tab is closed and the drawer closed and opened again. At every step no copy of the Files screen
//! may have been stopped past a time budget or report an error, the preview must draw the whole document, and at the
//! end the drawer draws its rows. The preview is the window's Markdown engine: it holds the whole document.
//!
//! Every script call is timed by the engine's own deadline: run this in release (`cargo test --release`) for the
//! shipped timing. `PERCH_MD_SHOTS=dir` saves a frame of each step.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs (this test plays it).

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, ScrollDelta, ScrollEvent, TouchPhase, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Command;
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;

const PROJECTS: usize = 12;
const SESSIONS: usize = 44;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

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
    let sessions: Vec<Value> = (0..SESSIONS)
        .map(|i| {
            let p = i % PROJECTS;
            json!({"id": format!("s{i}"), "title": format!("Session {i}"), "cwd": "/work",
                "createdAt": 0, "updatedAt": 0, "status": "idle",
                "hostId": "local", "projectId": format!("p{p}"), "workspaceId": format!("w{p}"),
                "cliProviderId": "claude"})
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

/// The entries of `dir` (relative to the repository) as the core lists them.
fn entries(repo: &Path, dir: &str) -> Vec<Value> {
    let mut entries: Vec<Value> = std::fs::read_dir(repo.join(dir))
        .unwrap()
        .filter_map(Result::ok)
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = if dir.is_empty() {
                name.clone()
            } else {
                format!("{dir}/{name}")
            };
            let kind = if e.path().is_dir() { "directory" } else { "file" };
            let size = e.metadata().map(|m| m.len()).unwrap_or(0);
            json!({"path": path, "name": name, "kind": kind, "size": size, "readonly": false, "executable": false})
        })
        .collect();
    entries.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    entries
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    asked: UnboundedReceiver<Command>,
    repo: PathBuf,
    shots: Option<PathBuf>,
    step: usize,
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

    fn win(&mut self, f: impl FnOnce(&mut Window, &mut gpui::App)) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                f(window, cx)
            })
            .unwrap();
    }

    /// Lets the window run and answers the core's file requests; fails when a copy of the Files screen was stopped
    /// or reports an error. Returns what the last frame drew.
    fn settle(&mut self, what: &str) -> Vec<ProbeRecord> {
        let mut slowest = (std::time::Duration::ZERO, std::time::Duration::ZERO);
        for _ in 0..6 {
            self.serve();
            self.cx.advance_clock(POLL);
            let started = std::time::Instant::now();
            self.cx.run_until_parked();
            slowest.0 = slowest.0.max(started.elapsed());
            let started = std::time::Instant::now();
            self.win(|window, cx| {
                probe::clear();
                window.refresh();
                let _ = window.draw(cx);
            });
            slowest.1 = slowest.1.max(started.elapsed());
            if let Some(error) = self.failure() {
                self.shot(what);
                panic!("{what}: the Files screen failed: {error}");
            }
        }
        println!(
            "{what}: slowest run {:?}, slowest frame {:?}",
            slowest.0, slowest.1
        );
        self.shot(what);
        probe::records().into_values().collect()
    }

    /// Why a copy of the Files screen (the drawer's, a file tab's) is not drawn as its mod means: a call into it was
    /// stopped past its time budget, its render threw, or it would not load.
    fn failure(&mut self) -> Option<String> {
        let mut keys = vec!["files#drawer".to_string()];
        keys.extend(
            self.ws(|ws, _, _| ws.tabs().shown())
                .iter()
                .map(|id| format!("files#{id}")),
        );
        for key in keys {
            let Some(view) = self.ws(|ws, _, _| ws.screen_view(&key)) else {
                continue;
            };
            let found = self.cx.update(|cx| {
                let view = view.read(cx);
                let stopped = view.script_view(cx).and_then(|s| {
                    s.read(cx)
                        .was_stopped()
                        .then(|| s.read(cx).build_error().map(str::to_string))
                });
                match stopped {
                    Some(why) => Some(format!("stopped: {why:?}")),
                    None => view.error(cx),
                }
            });
            if let Some(found) = found {
                return Some(format!("{key:?}: {found}"));
            }
        }
        None
    }

    fn shot(&mut self, name: &str) {
        let Some(dir) = self.shots.clone() else {
            return;
        };
        self.step += 1;
        let file = dir.join(format!("{:02}-{name}.png", self.step));
        self.win(|window, cx| {
            let _ = window.draw(cx);
            window
                .render_to_image()
                .expect("offscreen render")
                .save(file)
                .unwrap();
        });
    }

    /// Answers the core's requests: listings and reads from the repository; a document has no kept draft.
    fn serve(&mut self) {
        let mut frames = Vec::new();
        while let Ok(command) = self.asked.try_recv() {
            if let Command::Send(frame) = command {
                frames.push(frame);
            }
        }
        for frame in frames {
            let id = frame["requestId"].clone();
            let path = frame["path"].as_str().unwrap_or("").to_string();
            let answer = match frame["type"].as_str() {
                Some("fs.tree") => {
                    json!({"type": "fs.tree.result", "requestId": id, "workspaceId": "w0",
                    "path": path, "entries": entries(&self.repo, &path), "truncated": false})
                }
                Some("fs.read") => {
                    let content = std::fs::read_to_string(self.repo.join(&path)).unwrap();
                    let name = path.rsplit('/').next().unwrap().to_string();
                    json!({"type": "fs.read.result", "requestId": id, "workspaceId": "w0", "content": content,
                        "version": "v1", "metadata": {"path": path, "name": name, "size": content.len(),
                        "readonly": false, "executable": false, "kind": "file", "mediaType": "text/markdown"}})
                }
                _ => continue,
            };
            let answer = message(answer);
            self.ws(|ws, _, cx| ws.on_files_message(&answer, cx));
        }
    }

    fn press(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.win(|window, cx| {
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
        });
    }

    fn wheel(&mut self, at: gpui::Point<gpui::Pixels>, lines: f32) {
        self.win(|window, cx| {
            window.dispatch_event(
                PlatformInput::Scroll(ScrollEvent {
                    source: gpui::ScrollSource::Pointer,
                    position: at,
                    delta: ScrollDelta::Lines(point(0., -lines)),
                    modifiers: Modifiers::default(),
                    touch_phase: TouchPhase::Moved,
                }),
                cx,
            );
        });
    }

    /// The element named `suffix` in the last frame, failing with every name drawn when there is none.
    fn find(&mut self, records: &[ProbeRecord], suffix: &str, what: &str) -> ProbeRecord {
        if let Some(found) = records.iter().find(|r| r.name.ends_with(suffix)) {
            return found.clone();
        }
        self.shot(what);
        let mut names: Vec<_> = records.iter().map(|r| r.name.to_string()).collect();
        names.sort();
        panic!("{what}: no {suffix} drawn: {names:?}")
    }

    fn click(&mut self, suffix: &str, what: &str) {
        let records = self.settle(what);
        let at = self.find(&records, suffix, what).bounds.center();
        self.press(at);
    }

    /// Clicks Source (`false`) or Preview (`true`): the halves of the toggle.
    fn view(&mut self, preview: bool, what: &str) -> Vec<ProbeRecord> {
        let records = self.settle(what);
        let toggle = self.find(&records, "files-markdown-view", what).bounds;
        let x = if preview { 0.75 } else { 0.25 };
        self.press(point(
            toggle.origin.x + toggle.size.width * x,
            toggle.origin.y + toggle.size.height * 0.5,
        ));
        self.settle(what)
    }
}

/// The owner's steps with `file`: open it from the drawer, scroll, Preview, scroll, Source, click and scroll, Preview
/// and Source again, close its tab, close and open the drawer.
fn steps(rig: &mut Rig, file: &str) {
    let (dir, name) = file.rsplit_once('/').unwrap_or(("", file));
    let source = std::fs::read_to_string(rig.repo.join(file)).unwrap();

    // The document's folder opens (unless it is open), then the document.
    let records = rig.settle("drawer");
    let row = format!("files-entry:{file}");
    if !dir.is_empty() && !records.iter().any(|r| r.name.ends_with(&row)) {
        rig.click(&format!("files-entry:{dir}"), "folder");
    }
    rig.click(&row, "open");
    let records = rig.settle("opened");
    let tab = format!("w0\n{file}");
    assert!(
        rig.ws(|ws, _, _| ws.tabs().contains(&tab)),
        "{name} opened in a tab"
    );
    let editor = rig.find(&records, "files-editor", "opened").bounds.center();
    for _ in 0..5 {
        rig.wheel(editor, 10.);
        rig.settle("source-scrolled");
    }

    // Preview draws the whole document; it scrolls.
    let records = rig.view(true, "preview");
    let preview = rig
        .find(&records, "files-markdown-preview", "preview")
        .bounds;
    assert!(
        preview.size.height > px(200.),
        "the preview fills the pane: {preview:?}"
    );
    let last = source
        .lines()
        .rev()
        .find_map(|l| l.strip_prefix("## ").or_else(|| l.strip_prefix("# ")))
        .unwrap()
        .trim()
        .to_string();
    let held = perch_native::files::markdown::documents();
    assert!(
        held.iter().any(|d| d.contains(&last)),
        "the preview holds the document to its last heading {last:?}"
    );
    for _ in 0..5 {
        rig.wheel(preview.center(), 10.);
        rig.settle("preview-scrolled");
    }

    // Source again, clicks and scrolls in the editor, then Preview and Source once more.
    let records = rig.view(false, "source");
    assert!(
        records
            .iter()
            .all(|r| !r.name.ends_with("files-markdown-preview")),
        "Source hides the preview"
    );
    let editor = rig.find(&records, "files-editor", "source").bounds;
    for (x, y) in [(0.3, 0.2), (0.6, 0.5), (0.4, 0.8)] {
        rig.press(point(
            editor.origin.x + editor.size.width * x,
            editor.origin.y + editor.size.height * y,
        ));
        rig.settle("source-click");
        rig.wheel(editor.center(), 6.);
        rig.settle("source-click-scrolled");
    }
    rig.view(true, "preview-again");
    rig.view(false, "source-again");
    assert!(
        perch_native::files::markdown::documents().is_empty(),
        "Source lets the preview's document go"
    );

    // The tab closes; the drawer closes and opens again and draws its rows.
    let closed = rig
        .ws(|ws, window, cx| ws.run_command("tabs.close", Some(&json!({ "id": tab })), window, cx));
    assert!(closed.is_ok(), "{closed:?}");
    rig.settle("closed");
    for _ in 0..2 {
        rig.ws(|ws, window, cx| ws.run_command("global.drawer", None, window, cx))
            .unwrap();
        rig.settle("drawer-toggled");
    }
    let records = rig.settle("reopened");
    rig.find(&records, "files-entry:AGENTS.md", "reopened");
    println!("files markdown window: {file} ({} bytes) ok", source.len());
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-files-markdown-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let files = std::env::var("PERCH_MD_FILES")
        .unwrap_or_else(|_| "docs/ARCHITECTURE.md,docs/UI-UX-DIRECTION.md".into());

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, asked) = unbounded();
    let model = state(&repo).model();
    let kept = scratch.join("window.json");
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
    cx.update(|cx| mods::start_watched_in(user.clone(), &workspace, window.into(), cx));
    let shots = std::env::var_os("PERCH_MD_SHOTS").map(PathBuf::from);
    let mut rig = Rig {
        cx,
        window,
        asked,
        repo,
        shots,
        step: 0,
    };
    rig.settle("start");

    // A session of the repository on screen, the drawer opened on Files with the drawer key.
    let shown = rig.ws(|ws, _, cx| ws.show_session("s0", cx));
    assert!(shown.is_ok(), "{shown:?}");
    rig.ws(|ws, window, cx| ws.run_command("global.drawer", None, window, cx))
        .unwrap();
    for file in files.split(',') {
        steps(&mut rig, file.trim());
    }

    let _ = std::fs::remove_dir_all(&scratch);
    println!("files markdown window: ok");
}
