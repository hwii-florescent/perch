//! The review's diff as a mod places it, in a real (offscreen) window: a screen opens a key with `perch-diff`, places
//! the `diff` engine by that key, and sends view state with `setProps`; the window's Git store publishes the diff by
//! workspace (`Diffs::set_data`) and the view draws its rows; a click on a line comes back to the screen as a
//! `selectLine` event, and the screen is re-rendered to read it.

use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::git::store::DiffSnapshot;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::json;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;

const SCREEN: &str = r##"
import { View, div } from "gpui-kit";
import * as engine from "perch-engine";
import * as diff from "perch-diff";
export default class extends View {
  init() { this.got = []; }
  render() {
    diff.open("diff:w", { workspaceId: "w" });
    for (const e of diff.events("diff:w")) this.got.push(`${e.type}-${e.side}-${e.line}`);
    diff.setProps("diff:w", { wrap: false, selection: this.got.length ? { path: "a.rs", side: "new", start: 2, end: 2 } : null });
    let root = div().id("root").size_full().flex().flex_col();
    for (const g of this.got) root = root.child(div().id(`got-${g}`).h(1).w(1));
    return root.child(div().id("slot").h(400).w(800).child(engine.Engine.new("diff:w", { engine: "diff" })));
  }
}
"##;

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Rig {
    fn win<R>(&mut self, f: impl FnOnce(&mut Window, &mut gpui::App) -> R) -> R {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                f(window, cx)
            })
            .unwrap()
    }

    fn step(&mut self) -> Vec<ProbeRecord> {
        self.cx.advance_clock(POLL);
        self.cx.run_until_parked();
        self.win(|window, cx| {
            probe::clear();
            window.refresh();
            let _ = window.draw(cx);
        });
        probe::records().into_values().collect()
    }

    fn until(&mut self, name: &str) -> gpui::Bounds<gpui::Pixels> {
        for _ in 0..200 {
            if let Some(r) = self.step().into_iter().find(|r| r.name.as_ref() == name) {
                return r.bounds;
            }
        }
        panic!("{name} is never drawn");
    }

    fn click(&mut self, at: gpui::Point<gpui::Pixels>) {
        self.win(|window, cx| {
            for input in [
                PlatformInput::MouseDown(gpui::MouseDownEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                    first_mouse: false,
                }),
                PlatformInput::MouseUp(gpui::MouseUpEvent {
                    button: gpui::MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                }),
            ] {
                window.dispatch_event(input, cx);
            }
        });
        self.step();
    }
}

fn diff() -> DiffSnapshot {
    serde_json::from_value(json!({
        "workspaceId": "w",
        "target": { "kind": "workingTree" },
        "files": [{
            "oldPath": "a.rs", "newPath": "a.rs", "status": "modified", "isBinary": false,
            "hunks": [{
                "oldStart": 1, "oldCount": 2, "newStart": 1, "newCount": 2, "header": "@@ -1,2 +1,2 @@",
                "lines": [
                    { "kind": "context", "content": "fn main() {", "oldLine": 1, "newLine": 1 },
                    { "kind": "addition", "content": "    run();", "newLine": 2 },
                ],
            }],
        }],
        "hunkCount": 1,
        "truncated": false,
        "sourceRevision": "rev",
    }))
    .expect("a diff")
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-diff-engine-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    std::fs::create_dir_all(user.join("instructions")).unwrap();
    std::fs::write(
        user.join("instructions/mod.json"),
        r#"{ "name": "Diff engine" }"#,
    )
    .unwrap();
    std::fs::write(user.join("instructions/main.js"), SCREEN).unwrap();

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = futures::channel::mpsc::unbounded();
    let mut state = State::default();
    state.connect();
    let model = state.model();
    let window = cx
        .open_window(size(px(1024.), px(600.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    let opened = rig
        .window
        .update(&mut rig.cx, |ws, _, cx| {
            ws.open_screen("instructions", json!({}), None, None, cx)
        })
        .unwrap();
    assert!(opened, "the screen is drawn in the instructions slot");
    rig.until("slot");

    let diffs = rig.cx.update(|cx| cx.global::<WindowMods>().diffs.clone());
    let view = diffs.view("diff:w").expect("the screen opened the key");
    rig.cx
        .update(|cx| diffs.set_data("w", Some(Rc::new(diff())), Rc::default(), cx));
    rig.step();
    let rows = rig.cx.update(|cx| view.read(cx).rows().rows.len());
    assert_eq!(
        rows, 4,
        "the store's diff is drawn: file, hunk and two lines"
    );
    let error = rig
        .window
        .update(&mut rig.cx, |ws, _, cx| ws.screen_error("instructions", cx))
        .unwrap();
    assert!(error.is_none(), "the screen runs: {error:?}");
    println!("ok: the store's diff reaches the view a screen placed by key");

    let line = rig
        .cx
        .update(|cx| view.read(cx).list_state().bounds_for_item(3))
        .expect("the added line is drawn");
    rig.click(line.center());
    rig.until("got-selectLine-new-2");
    let selected = rig.cx.update(|cx| view.read(cx).props().selection.clone());
    assert_eq!(
        selected.map(|s| (s.path, s.start, s.end)),
        Some(("a.rs".to_string(), 2, 2)),
        "the screen's selection reaches the view"
    );
    println!(
        "ok: a click comes back to the screen as selectLine, and its selection reaches the view"
    );

    let _ = std::fs::remove_dir_all(&scratch);
    println!("diff_engine_window: ok");
}
