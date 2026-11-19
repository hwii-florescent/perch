//! The native editor as the web's `CodeEditor`, in a real (offscreen) window, keys through the window's own dispatch.
//!
//! Typing: every case of `packages/web/src/editorTyping.cases.json` (the web's own test reads the same file) typed into
//! a native editor, with Perch's typing rules in front of `gpui-base`; a store value applied from outside keeps the undo
//! history it does not touch; and typing with the rules in front stays within half a millisecond of the bare editor
//! (`PERCH_EDITOR_REPORT=1` prints the numbers; a debug build only reports).
//!
//! The screen: a React screen in the sidebar's place (in the flow of the window, as Files is) places `CodeEditor` from
//! the native `@perch/sdk` beside a text field, keyed by path and reload as `files.tsx` does. Keys typed into the
//! editor stay the editor's (the field and the document's key listeners hear none), a press on the field takes the
//! keyboard back, the editor's shortcuts run (save, find, find next only while Find is open, go to line), Escape closes
//! Find, Tab indents, re-keying parks the editor (undo still works when it comes back) and the right-click menu acts
//! on the editor and gives it the keyboard back.

use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::editor::{highlight, Editors};
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Draws the editor `props.key` that the test opened from Rust.
const PLAIN: &str = r##"
import { View, div } from "gpui-kit";
import * as editor from "perch-editor";
import * as perch from "perch";
export default class extends View {
  init() { this.key = perch.props().key; }
  render() {
    editor.events(this.key);
    return div().id("editor-root").size_full().bg("#1e1e1e").flex().flex_col()
      .child(div().id("editor-box").flex_1().child(editor.Editor.new(this.key)));
  }
}
"##;

/// A React screen placing `CodeEditor` as `files.tsx` does, beside a text field; what it heard is drawn as test ids.
const FIXTURE: &str = r##"
import { screen } from "./screen.js";
import { createElement as h, useEffect, useState } from "react";
import { CodeEditor } from "@perch/sdk";

function Fixture() {
  const [value, setValue] = useState("const a = 1;\n");
  const [epoch, setEpoch] = useState(0);
  const [field, setField] = useState("");
  const [saves, setSaves] = useState(0);
  const [docKeys, setDocKeys] = useState(0);
  useEffect(() => {
    const heard = () => setDocKeys((n) => n + 1);
    document.addEventListener("keydown", heard);
    return () => document.removeEventListener("keydown", heard);
  }, []);
  const status = (name) => h("div", { "data-testid": name, onClick: () => {}, style: { width: 2, height: 2 } });
  return h("div", { style: { display: "flex", flexDirection: "column", width: "100%", height: "100%" } },
    status(`saves-${saves}`), status(`field-${field || "empty"}`), status(`dockeys-${docKeys}`), status(`epoch-${epoch}`),
    h("input", { "data-testid": "beside", value: field, onChange: (e) => setField(e.target.value), onKeyDown: () => {}, style: { height: 24 } }),
    h("button", { type: "button", "data-testid": "reload", onClick: () => setEpoch((n) => 1 - n), style: { height: 24 } }, "Reload"),
    h("div", { "data-testid": "editor-box", onClick: () => {}, style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
      h(CodeEditor, {
        key: `a.ts\0${epoch}`, docKey: `fixture\0a.ts\0${epoch}`, path: "a.ts", value,
        onChange: setValue, onSave: () => setSaves((n) => n + 1), onCaret: () => {},
        readOnly: false, wrap: false, label: "Editing a.ts",
      })));
}

export default screen("sidebar", Fixture, { container: { display: "flex", flexDirection: "column", width: "100%", height: "100%" }, keyboard: "in-flow" });
"##;

const FIXTURE_KEY: &str = "fixture\0a.ts\0";

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
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

    fn editors(&mut self) -> Editors {
        self.cx
            .update(|cx| cx.global::<WindowMods>().editors.clone())
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

    /// Steps a few frames, so timers the screen set (a commit, a focus hand-off) have run.
    fn settle(&mut self) -> Vec<ProbeRecord> {
        let mut records = Vec::new();
        for _ in 0..4 {
            records = self.step();
        }
        records
    }

    /// The bounds of the element named `name` (or `~n..:name`), once drawn.
    fn find(&mut self, name: &str) -> Option<gpui::Bounds<gpui::Pixels>> {
        let suffix = format!(":{name}");
        self.settle()
            .into_iter()
            .find(|r| r.name.as_ref() == name || r.name.ends_with(&suffix))
            .map(|r| r.bounds)
    }

    fn until(&mut self, name: &str) -> gpui::Bounds<gpui::Pixels> {
        for _ in 0..100 {
            if let Some(bounds) = self.find(name) {
                return bounds;
            }
        }
        panic!("{name} is never drawn");
    }

    /// The value of the status test id `prefix-<value>` the fixture draws.
    fn status(&mut self, prefix: &str) -> String {
        let marker = format!(":{prefix}-");
        self.settle()
            .iter()
            .find_map(|r| r.name.split_once(&marker).map(|(_, v)| v.to_string()))
            .unwrap_or_default()
    }

    fn press(&mut self, at: gpui::Point<gpui::Pixels>, button: MouseButton) {
        self.win(|window, cx| {
            for input in [
                PlatformInput::MouseDown(gpui::MouseDownEvent {
                    button,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                    first_mouse: false,
                }),
                PlatformInput::MouseUp(gpui::MouseUpEvent {
                    button,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                }),
            ] {
                window.dispatch_event(input, cx);
            }
        });
        self.settle();
    }

    fn click(&mut self, name: &str) {
        let at = self.until(name).center();
        self.press(at, MouseButton::Left);
    }

    /// Types `key`: a single character as typed text, else a key name GPUI parses (`enter`, `cmd-z`).
    fn key(&mut self, key: &str) {
        let keystroke = match key {
            "backspace" | "enter" | "tab" | "escape" => {
                Keystroke::parse_with_os(key, gpui::OperatingSystem::Mac).unwrap()
            }
            "undo" => Keystroke::parse("cmd-z").unwrap(),
            _ if key.chars().count() == 1 => Keystroke {
                modifiers: Modifiers::default(),
                key: key.to_string(),
                key_char: Some(key.to_string()),
            },
            _ => Keystroke::parse_with_os(key, gpui::OperatingSystem::Mac).unwrap(),
        };
        self.win(|window, cx| {
            window.dispatch_keystroke(keystroke, cx);
        });
        self.cx.run_until_parked();
        self.step();
    }

    /// `key`'s text with the caret at `|` or the selection between `[` and `]`.
    fn shown(&mut self, key: &str) -> String {
        let state = self.editors().state(key).expect("open");
        self.cx.update(|cx| {
            let state = state.read(cx);
            let (text, range) = (state.value().to_string(), state.selected_range());
            if range.is_empty() {
                format!("{}|{}", &text[..range.start], &text[range.start..])
            } else {
                format!(
                    "{}[{}]{}",
                    &text[..range.start],
                    &text[range.clone()],
                    &text[range.end..]
                )
            }
        })
    }

    /// Opens `key` on `path` holding `doc` (caret or selection marked) from Rust, draws it in the plain mod and gives
    /// it the keyboard.
    fn open_plain(&mut self, key: &str, path: &str, doc: &str) {
        let (text, range) = match doc.find('|') {
            Some(at) => (doc.replacen('|', "", 1), at..at),
            None => {
                let (start, end) = (doc.find('[').unwrap(), doc.find(']').unwrap() - 1);
                (doc.replace(['[', ']'], ""), start..end)
            }
        };
        let editors = self.editors();
        let options = gpui_shell::HostValue::Object(vec![
            ("path".into(), path.into()),
            ("value".into(), text.into()),
        ]);
        self.win(|window, cx| {
            editors
                .open("instructions", key, &options, window, cx)
                .unwrap()
        });
        let opened = self
            .ws(|ws, _, cx| ws.open_screen("instructions", json!({ "key": key }), None, None, cx));
        assert!(opened);
        self.until("editor-box");
        let state = editors.state(key).unwrap();
        self.win(|window, cx| {
            state.update(cx, |s, cx| s.focus(window, cx));
            state.update(cx, |s, cx| s.set_selected_range(range, cx));
        });
        self.settle();
    }

    fn close_plain(&mut self, key: &str) {
        self.ws(|ws, window, cx| ws.screen_closed("instructions", Value::Null, window, cx));
        self.settle();
        self.editors().release(key);
    }
}

fn typing_cases(rig: &mut Rig) {
    let table: Value = serde_json::from_str(include_str!(
        "../../../packages/web/src/editorTyping.cases.json"
    ))
    .unwrap();
    let cases = table["cases"].as_array().unwrap();
    let mut failed = Vec::new();
    for (i, case) in cases.iter().enumerate() {
        let name = case["name"].as_str().unwrap();
        let key = format!("case-{i}");
        rig.open_plain(
            &key,
            case["file"].as_str().unwrap(),
            case["doc"].as_str().unwrap(),
        );
        for typed in case["keys"].as_array().unwrap() {
            rig.key(typed.as_str().unwrap());
        }
        let got = rig.shown(&key);
        let want = case["expect"].as_str().unwrap();
        if got != want {
            failed.push(format!("{name}: got {got:?}, want {want:?}"));
        }
        rig.close_plain(&key);
    }
    assert!(
        failed.is_empty(),
        "typing cases failed:\n{}",
        failed.join("\n")
    );
    println!("ok: {} typing cases match the web's", cases.len());
}

fn store_values_keep_history(rig: &mut Rig) {
    let editors = rig.editors();
    // An outside edit clear of the typing keeps it undoable.
    rig.open_plain("history-1", "a.ts", "ab|");
    rig.key("x");
    rig.win(|window, cx| editors.set_value("history-1", "Zabx", true, window, cx));
    assert_eq!(
        rig.shown("history-1"),
        "Zabx|",
        "the caret moves with the text before it"
    );
    rig.key("undo");
    assert_eq!(
        rig.shown("history-1"),
        "Zab|",
        "the typed x is undone where it now is"
    );
    rig.close_plain("history-1");
    // One over the typing drops it: undo does not replay across text it never saw.
    rig.open_plain("history-2", "a.ts", "ab|");
    rig.key("x");
    rig.win(|window, cx| editors.set_value("history-2", "aQ", true, window, cx));
    rig.key("undo");
    assert_eq!(rig.shown("history-2").replace('|', ""), "aQ");
    rig.close_plain("history-2");
    println!("ok: a store value keeps the history it does not touch");
}

fn typing_cost(rig: &mut Rig) {
    let report = std::env::var("PERCH_EDITOR_REPORT").is_ok();
    let release = !cfg!(debug_assertions);
    let text: String = (0..10_000)
        .map(|i| match i % 4 {
            0 => format!("fn f{i}() -> u8 {{ 1 }}\n"),
            1 => format!("let s = \"v{i}\"; // n\n"),
            2 => format!("x += {};\n", i % 97),
            _ => "struct S { a: u32 }\n".to_string(),
        })
        .collect();
    let doc = format!("{}|", text);
    rig.open_plain("cost", "big.rs", &doc);
    // Timed as phase 1's numbers were: once every line is coloured, each key dispatched and the frame it changes
    // drawn (no forced redraw of the whole window).
    while highlight::background_parses_running() > 0 {
        rig.cx.run_until_parked();
        std::thread::sleep(Duration::from_millis(1));
    }
    rig.settle();
    let mut times = Vec::new();
    for i in 0..30 {
        let typed = if i % 10 == 9 { "(" } else { "a" };
        let keystroke = Keystroke {
            modifiers: Modifiers::default(),
            key: typed.to_string(),
            key_char: Some(typed.to_string()),
        };
        let started = Instant::now();
        rig.win(|window, cx| {
            window.dispatch_keystroke(keystroke, cx);
        });
        rig.cx.run_until_parked();
        rig.cx.advance_clock(POLL);
        rig.cx.run_until_parked();
        rig.win(|window, cx| {
            let _ = window.draw(cx);
        });
        times.push(started.elapsed());
    }
    rig.close_plain("cost");
    let mean = times.iter().sum::<Duration>() / times.len() as u32;
    let worst = times.iter().max().copied().unwrap_or_default();
    if report || !release {
        println!("editor_typing: 10,000 highlighted lines, typing rules in front: {mean:?} per key and frame (worst {worst:?})");
    }
    if release {
        // Phase 1's bare editor: 1.8 ms per key and frame; the rules may add 0.5 ms, with the 2x CI margin.
        assert!(
            mean <= Duration::from_micros(2 * 2_300),
            "typing costs {mean:?} per key"
        );
    }
    println!("ok: typing cost");
}

fn the_screen(rig: &mut Rig) {
    let key0 = format!("{FIXTURE_KEY}0");
    rig.until("editor-box");
    assert_eq!(rig.status("saves"), "0");

    // A press on the editor gives it the keyboard; what is typed is the editor's alone.
    let editor = rig.until("editor-box");
    rig.press(
        point(editor.origin.x + px(120.), editor.origin.y + px(8.)),
        MouseButton::Left,
    );
    rig.key("cmd-down");
    rig.key("x");
    rig.key("y");
    let editors = rig.editors();
    let value = rig
        .cx
        .update(|cx| editors.state(&key0).unwrap().read(cx).value().to_string());
    assert!(value.ends_with("xy"), "typed into the editor: {value:?}");
    assert_eq!(
        rig.status("field"),
        "empty",
        "the field beside it heard nothing"
    );
    assert_eq!(
        rig.status("dockeys"),
        "0",
        "the document's key listeners heard nothing"
    );
    println!("ok: keys typed into the editor never reach the screen's text field");

    // Tab indents inside the editor.
    rig.key("tab");
    let value = rig
        .cx
        .update(|cx| editors.state(&key0).unwrap().read(cx).value().to_string());
    assert!(value.ends_with("xy  "), "Tab indents: {value:?}");
    println!("ok: Tab indents inside the editor");

    // The editor's shortcuts: save, find (and find next only while it is open), Escape closes Find, go to line.
    rig.key("cmd-s");
    assert_eq!(
        rig.status("saves"),
        "1",
        "the save shortcut reaches onSave once"
    );
    let open = |rig: &mut Rig| {
        let state = editors.state(&key0).unwrap();
        rig.cx.update(|cx| state.read(cx).search_session().open)
    };
    let caret = |rig: &mut Rig| {
        let state = editors.state(&key0).unwrap();
        rig.cx.update(|cx| state.read(cx).selected_range())
    };
    let before = caret(rig);
    rig.key("f3");
    assert_eq!(
        caret(rig),
        before,
        "find next does nothing while Find is closed"
    );
    rig.key("cmd-f");
    assert!(open(rig), "cmd-f opens Find");
    rig.key("escape");
    assert!(!open(rig), "Escape closes Find");
    rig.key("ctrl-g");
    rig.until("editor-goto-line");
    println!("ok: the editor's shortcuts run, and Escape closes Find");

    // A press on the field takes the keyboard back.
    rig.click("beside");
    rig.key("z");
    assert_eq!(rig.status("field"), "z", "the field types again");
    let after = rig
        .cx
        .update(|cx| editors.state(&key0).unwrap().read(cx).value().to_string());
    assert!(
        after.ends_with("xy  "),
        "and the editor heard nothing: {after:?}"
    );
    println!("ok: a press on the field takes the keyboard back");

    // Re-keyed by a reload, the editor is parked, not lost: back on its key, undo still works.
    rig.click("reload");
    assert_eq!(rig.status("epoch"), "1");
    assert!(editors.is_parked(&key0), "the first key is parked");
    rig.click("reload");
    assert_eq!(rig.status("epoch"), "0");
    let editor = rig.until("editor-box");
    rig.press(
        point(editor.origin.x + px(120.), editor.origin.y + px(8.)),
        MouseButton::Left,
    );
    rig.key("undo");
    let undone = rig
        .cx
        .update(|cx| editors.state(&key0).unwrap().read(cx).value().to_string());
    assert!(
        !undone.ends_with("xy  "),
        "undo after the editor came back: {undone:?}"
    );
    println!("ok: re-keying parks the editor; undo works when it comes back");

    // The right-click menu acts on the editor and gives it the keyboard back.
    rig.press(
        point(editor.origin.x + px(120.), editor.origin.y + px(8.)),
        MouseButton::Right,
    );
    rig.until("editor-context-menu");
    rig.click("editor-menu-select-all");
    assert!(rig.find("editor-context-menu").is_none(), "the menu closes");
    let state = editors.state(&key0).unwrap();
    let (all, focused) = rig.win(|window, cx| {
        let s = state.read(cx);
        (
            s.selected_range().len() == s.text().len(),
            s.focus_handle(cx).is_focused(window),
        )
    });
    assert!(
        all && focused,
        "Select All ran and the editor has the keyboard"
    );
    println!("ok: the right-click menu acts on the editor and gives it the keyboard back");
}

fn copy_dir(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for entry in std::fs::read_dir(from).unwrap().flatten() {
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), target).unwrap();
        }
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-editor-typing-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    std::fs::create_dir_all(user.join("instructions")).unwrap();
    std::fs::write(
        user.join("instructions/mod.json"),
        r#"{ "name": "Editor" }"#,
    )
    .unwrap();
    std::fs::write(user.join("instructions/main.js"), PLAIN).unwrap();
    // The fixture screen in the sidebar's place, with the React runtime beside it as every React screen has.
    let runtime = Path::new(env!("CARGO_MANIFEST_DIR")).join("mods/react-runtime");
    copy_dir(&runtime, &user.join("sidebar"));
    std::fs::write(
        user.join("sidebar/mod.json"),
        r#"{ "name": "Editor fixture", "runtime": "react" }"#,
    )
    .unwrap();
    std::fs::write(user.join("sidebar/main.js"), FIXTURE).unwrap();

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
        .open_window(size(px(1280.), px(800.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    rig.settle();

    typing_cases(&mut rig);
    store_values_keep_history(&mut rig);
    typing_cost(&mut rig);
    the_screen(&mut rig);

    let _ = std::fs::remove_dir_all(&scratch);
    println!("editor_typing: ok");
}
