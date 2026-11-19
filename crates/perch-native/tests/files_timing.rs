//! How quickly the Files screen follows the person, in a real (offscreen) window against a core this test plays:
//!
//! - The explorer: a workspace root of 1,000 and 5,000 files, timed from the core's listing to the first frame that
//!   draws its rows (budget 300 ms), then per wheel step over the tree (budget 16 ms per step and frame).
//! - The editor: a 1,000- and a 10,000-line file in a file tab, each typed key timed from its dispatch through the
//!   draft reaching the window's store to the drawn frame (budget 4 ms per key at 1,000 lines, 8 ms at 10,000), one
//!   key per 16 ms frame, so the screen is shown the typing every 150 ms as when a person types.
//!
//! Every number is printed. With `PERCH_BUDGET_STRICT=1` a number over its budget fails the run; otherwise a release
//! build fails only past twice the budget (the margin a loaded CI machine needs) and a debug build only reports. `PERCH_FILES_TREE=1000,5000`, `PERCH_FILES_LINES=1000,10000` and
//! `PERCH_FILES_STEPS=30` pick the sizes and the number of steps and keys. Resident memory before and after each
//! is printed too (`ps`), for the heap the screen grows.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event goes through
//! the window's own dispatch.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Modifiers, PlatformInput,
    ScrollDelta, ScrollEvent, TouchPhase, Window, WindowHandle,
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
use std::time::{Duration, Instant};

const TREE_SIZES: &[usize] = &[1_000, 5_000];

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
    // `w1` for the editor, one checkout per tree size for the explorer.
    let ids = std::iter::once("w1".to_string()).chain(
        env_list("PERCH_FILES_TREE", TREE_SIZES)
            .into_iter()
            .map(|n| format!("tree-{n}")),
    );
    let checkouts: Vec<Value> = ids
        .map(|id| {
            json!({"id": id, "projectId": "p", "hostId": "local", "path": format!("/work/{id}"),
                "name": id, "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
                "pinned": false})
        })
        .collect();
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": checkouts})));
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

    fn win<R>(&mut self, f: impl FnOnce(&mut Window, &mut gpui::App) -> R) -> R {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                f(window, cx)
            })
            .unwrap()
    }

    /// One pass of timers and tasks, then one frame (all of it with `refresh`).
    fn step(&mut self, refresh: bool) -> Vec<ProbeRecord> {
        self.cx.advance_clock(POLL);
        self.cx.run_until_parked();
        self.win(|window, cx| {
            probe::clear();
            if refresh {
                window.refresh();
            }
            let _ = window.draw(cx);
        });
        probe::records().into_values().collect()
    }

    /// One 16 ms frame, as keys arrive while typing: the window's timers that are due run (the screen is shown what
    /// was typed every 150 ms), then what is dirty is drawn.
    fn frame(&mut self) {
        self.cx.advance_clock(Duration::from_millis(16));
        self.cx.run_until_parked();
        self.win(|window, cx| {
            let _ = window.draw(cx);
        });
    }

    fn settle(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.step(true);
        }
        let error = self.ws(|ws, _, cx| ws.screen_error("files", cx));
        assert!(error.is_none(), "the files screen failed: {error:?}");
        self.step(true)
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

    fn asked_for(&mut self, kind: &str) -> Value {
        let sent = self.sent();
        // The newest: an older request of the same kind is stale.
        sent.iter()
            .rfind(|f| f["type"] == kind)
            .cloned()
            .unwrap_or_else(|| panic!("the window asks for {kind}: {sent:?}"))
    }

    fn answer(&mut self, value: Value) {
        let message = message(value);
        self.ws(|ws, _, cx| ws.on_files_message(&message, cx));
    }

    fn wheel(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.win(|window, cx| {
            window.dispatch_event(
                PlatformInput::Scroll(ScrollEvent {
                    source: gpui::ScrollSource::Pointer,
                    position: at,
                    delta: ScrollDelta::Lines(point(0., -3.)),
                    modifiers: Modifiers::default(),
                    touch_phase: TouchPhase::Moved,
                }),
                cx,
            );
        });
        self.cx.run_until_parked();
    }
}

/// This process's resident memory in MB (`ps`).
fn rss_mb() -> f64 {
    let out = std::process::Command::new("ps")
        .args(["-o", "rss=", "-p", &std::process::id().to_string()])
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout)
        .trim()
        .parse::<f64>()
        .unwrap_or(0.)
        / 1024.
}

fn env_list(name: &str, default: &[usize]) -> Vec<usize> {
    std::env::var(name)
        .ok()
        .map(|v| v.split(',').filter_map(|n| n.trim().parse().ok()).collect())
        .unwrap_or_else(|| default.to_vec())
}

fn strict() -> bool {
    std::env::var("PERCH_BUDGET_STRICT").as_deref() == Ok("1")
}

/// The budget a number is held to: its own when strict, twice it in an ordinary release run, none in a debug build.
fn held(budget: Duration) -> Option<Duration> {
    if strict() {
        Some(budget)
    } else if cfg!(debug_assertions) {
        None
    } else {
        Some(budget * 2)
    }
}

fn within(what: &str, took: Duration, budget: Duration) {
    if let Some(limit) = held(budget) {
        assert!(
            took <= limit,
            "{what}: {took:?}, budget {budget:?} (held to {limit:?})"
        );
    }
}

fn stats(each: &mut [Duration]) -> (Duration, Duration, Duration) {
    each.sort();
    let mean = each.iter().sum::<Duration>() / each.len() as u32;
    (mean, each[each.len() / 2], each[each.len() - 1])
}

fn entry(path: &str) -> Value {
    json!({"path": path, "name": path, "kind": "file", "size": 10, "readonly": false, "executable": false})
}

fn tree(rig: &mut Rig, files: usize, steps: usize) {
    let workspace = format!("tree-{files}");
    let rss = rss_mb();
    rig.ws(|ws, _, cx| ws.show_files(&workspace, cx));
    rig.settle();
    let asked = rig.asked_for("fs.tree");
    let entries: Vec<Value> = (0..files)
        .map(|i| entry(&format!("file-{i:05}.rs")))
        .collect();
    // Timed: the reply and the frames that follow it. Each is then checked with an untimed full redraw (the probe
    // records only what a frame draws again).
    let before = rig.cx.update(|cx| cx.global::<WindowMods>().host.metrics());
    let mut first = Duration::ZERO;
    let at = Instant::now();
    rig.answer(json!({"type": "fs.tree.result", "requestId": asked["requestId"],
        "workspaceId": workspace, "path": asked["path"].as_str().unwrap_or(""), "entries": entries, "truncated": false}));
    first += at.elapsed();
    let mut frames = 0;
    let scroll = loop {
        frames += 1;
        let at = Instant::now();
        rig.step(false);
        first += at.elapsed();
        let records = rig.step(true);
        if records
            .iter()
            .any(|r| r.name.ends_with("files-entry:file-00000.rs"))
        {
            break records
                .iter()
                .find(|r| r.name == "files-tree")
                .map(|r| r.bounds)
                .expect("the tree's scroll box");
        }
        if frames >= 100 {
            let error = rig.ws(|ws, _, cx| ws.screen_error("files", cx));
            let mut names: Vec<_> = records
                .iter()
                .map(|r| r.name.to_string())
                .filter(|n| n.starts_with('~') || n.contains("drawer") || n.contains("tools"))
                .collect();
            names.sort();
            names.truncate(40);
            let held = rig.ws(|ws, _, _| {
                ws.files()
                    .tree(&workspace, "")
                    .map(|t| (t.entries.len(), format!("{:?}", t.state)))
            });
            if let Some(dir) = std::env::var_os("PERCH_FILES_SHOT") {
                let image = rig.win(|window, _| window.render_to_image().unwrap());
                image
                    .save(std::path::Path::new(&dir).join("tree-stuck.png"))
                    .unwrap();
            }
            panic!("{files} files: the rows are never drawn; store {held:?}; error {error:?}; {names:?}");
        }
    };
    let opening = rig
        .cx
        .update(|cx| cx.global::<WindowMods>().host.metrics())
        .since(&before);
    println!(
        "tree {files} files: script renders {}, script time {:?} (slowest {:?}), materialize time {:?}",
        opening.script_renders(),
        opening.script_render_time(),
        opening.slowest_script_render(),
        opening.materialize_time()
    );
    let rss_drawn = rss_mb();
    let mut each: Vec<Duration> = (0..steps)
        .map(|_| {
            let at = Instant::now();
            rig.wheel(scroll.center());
            rig.step(false);
            at.elapsed()
        })
        .collect();
    // The rows drawn followed the wheel: after more steps, a row well below the first window is drawn.
    for _ in 0..60 {
        rig.wheel(scroll.center());
        rig.step(false);
    }
    let records = rig.step(true);
    let deepest = records
        .iter()
        .filter_map(|r| {
            r.name
                .strip_prefix("files-entry:file-")?
                .strip_suffix(".rs")?
                .parse::<usize>()
                .ok()
        })
        .max()
        .unwrap_or(0);
    if files >= 1_000 {
        assert!(
            deepest >= 200,
            "{files} files: after the wheel the deepest row drawn is {deepest}"
        );
    }
    let (mean, median, worst) = stats(&mut each);
    println!(
        "tree {files} files: first draw {first:?} ({frames} frames); {steps} wheel steps, mean {mean:?}, median \
         {median:?}, worst {worst:?}; RSS {rss:.0} -> {rss_drawn:.0} MB"
    );
    within(
        &format!("tree {files}: first draw"),
        first,
        Duration::from_millis(300),
    );
    within(
        &format!("tree {files}: wheel step"),
        mean,
        Duration::from_millis(16),
    );
}

fn rust(lines: usize) -> String {
    (0..lines)
        .map(|i| match i % 5 {
            0 => format!("fn f{i}() -> u8 {{ 1 }}"),
            1 => format!("let s = \"v{i}\"; // n"),
            2 => format!("/* b */ x += {};", i % 97),
            3 => "struct S { a: u32 }".to_string(),
            _ => format!("const C: f64 = {i}.5;"),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn typing(rig: &mut Rig, lines: usize, steps: usize) {
    let path = format!("big-{lines}.rs");
    let text = rust(lines);
    let rss = rss_mb();
    rig.ws(|ws, _, cx| ws.open_file("w1", &path, false, cx));
    rig.settle();
    let sent = rig.sent();
    let read = sent
        .iter()
        .find(|f| f["type"] == "fs.read")
        .expect("fs.read")
        .clone();
    let get = sent
        .iter()
        .find(|f| f["type"] == "fs.buffer.get")
        .expect("fs.buffer.get")
        .clone();
    let opened = Instant::now();
    rig.answer(json!({"type": "fs.read.result", "requestId": read["requestId"], "workspaceId": "w1",
        "content": text, "version": "v1",
        "metadata": {"path": path, "name": path, "size": text.len(), "readonly": false, "executable": false,
                     "kind": "file"}}));
    rig.answer(json!({"type": "fs.buffer.result", "requestId": get["requestId"], "workspaceId": "w1",
        "buffer": {"workspaceId": "w1", "path": path, "content": text, "baseContent": text, "baseVersion": "v1",
            "externalVersion": "v1", "revision": 0, "dirty": false, "conflict": false, "updatedAt": 0}}));
    let editors = rig
        .cx
        .update(|cx| cx.global::<WindowMods>().editors.clone());
    let doc = format!("w1\0{path}\x000");
    let mut frames = 0;
    let state = loop {
        frames += 1;
        rig.step(false);
        if let Some(state) = editors.state(&doc) {
            break state;
        }
        assert!(
            frames < 100,
            "{lines} lines: the editor never opens: {:?}",
            editors.keys()
        );
    };
    let first = opened.elapsed();
    rig.win(|window, cx| {
        let handle = state.read(cx).focus_handle(cx);
        window.focus(&handle, cx);
    });
    rig.step(false);
    let rss_open = rss_mb();
    let mut each: Vec<Duration> = (0..steps)
        .map(|i| {
            let key = gpui::Keystroke::parse(if i % 10 == 9 { "enter" } else { "a" }).unwrap();
            let at = Instant::now();
            rig.win(|window, cx| {
                window.dispatch_keystroke(key, cx);
            });
            rig.frame();
            at.elapsed()
        })
        .collect();
    let (mean, median, worst) = stats(&mut each);
    for _ in 0..3 {
        rig.step(false);
    }
    let typed = rig.cx.update(|cx| state.read(cx).value().to_string());
    let draft = rig.ws(|ws, _, _| ws.files().document("w1", &path).map(|d| d.content.clone()));
    assert_eq!(
        draft.as_deref(),
        Some(typed.as_str()),
        "{lines} lines: the store has every key"
    );
    assert_ne!(typed, text, "{lines} lines: the keys reached the editor");
    println!(
        "editor {lines} lines: open to editor {first:?} ({frames} frames); {steps} keys, mean {mean:?}, median \
         {median:?}, worst {worst:?} per key and frame; RSS {rss:.0} -> {rss_open:.0} -> {:.0} MB",
        rss_mb()
    );
    let budget = if lines <= 1_000 { 4 } else { 8 };
    within(
        &format!("editor {lines}: per key"),
        mean,
        Duration::from_millis(budget),
    );
    let id = format!("w1\n{path}");
    rig.ws(|ws, window, cx| ws.run_command("tabs.close", Some(&json!({ "id": id })), window, cx))
        .unwrap();
    rig.settle();
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-files-timing-{}", std::process::id()));
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
        .open_window(size(px(1280.), px(800.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window, asked };
    rig.settle();
    rig.sent();

    let steps = env_list("PERCH_FILES_STEPS", &[30])[0];
    for files in env_list("PERCH_FILES_TREE", TREE_SIZES) {
        tree(&mut rig, files, steps);
    }
    for lines in env_list("PERCH_FILES_LINES", &[1_000, 10_000]) {
        typing(&mut rig, lines, steps);
    }
    let _ = std::fs::remove_dir_all(&scratch);
    println!(
        "files timing: ok{}",
        if strict() {
            ""
        } else if cfg!(debug_assertions) {
            " (debug build: budgets reported, not enforced)"
        } else {
            " (held to twice the budgets; PERCH_BUDGET_STRICT=1 holds them exactly)"
        }
    );
}
