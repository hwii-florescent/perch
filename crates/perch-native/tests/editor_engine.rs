//! The native editor engine in a real (offscreen) window: a user mod opens a document through `perch-editor` and
//! draws it with `Editor.new(docKey)`; keys go through the window's own dispatch to the focused editor. Checks what
//! the web's `CodeEditor.tsx` promises (user edits heard as changes, caret out, a store value applied without an
//! undo entry or a change event, undo, parked state restored by key, at most 32 parked), that a theme switch recolours
//! an open editor, that typing stays quick while a slow background parse runs, and the timing budgets: typing in a
//! highlighted 1,000-line file at most 4 ms per key and frame, 10,000 lines at most 8 ms, every line coloured within
//! 500 ms of opening (off the UI thread), and the lines on screen coloured in the first frame (failing above twice
//! those in a release build, or one frame late, and at the budgets themselves with `PERCH_BUDGET_STRICT=1`; debug
//! builds only report).
//!
//! `PERCH_EDITOR_REPORT=1` prints the numbers. `PERCH_EDITOR_LINES=1000,10000,50000` picks the timed sizes;
//! `PERCH_EDITOR_UNCAPPED=1` lifts the 300,000-character highlight cap, to time the highlighter on the measurement
//! file (110-character lines).

use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, PlatformInput, Window,
    WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::editor::{highlight, theme as syntax_theme, Editors};
use perch_native::mods::{self, theme, WindowMods, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Opens `props.key` with `props.path` and `props.value`, draws it, and shows what it heard as probe ids.
const EDITOR: &str = r##"
import { View, div } from "gpui-kit";
import * as editor from "perch-editor";
import * as perch from "perch";
export default class extends View {
  init() {
    const p = perch.props();
    this.key = p.key;
    // A document the test opened from Rust is only drawn (its text does not cross the script boundary).
    this.restored = p.preopened ? true : editor.open(p.key, { path: p.path, value: p.value }).restored;
    this.changes = 0;
    this.caret = "1-1";
  }
  render() {
    for (const e of editor.events(this.key)) {
      if (e.type === "change") this.changes += 1;
      if (e.type === "caret") this.caret = `${e.line}-${e.col}`;
    }
    return div().id("editor-root").size_full().bg("#1e1e1e").flex().flex_col()
      .child(div().id(`editor-restored-${this.restored}`).h(1).w(1))
      .child(div().id(`editor-changes-${this.changes}`).h(1).w(1))
      .child(div().id(`editor-caret-${this.caret}`).h(1).w(1))
      .child(div().id("editor-box").flex_1().child(editor.Editor.new(this.key)));
  }
}
"##;

const WIDTH: f32 = 1280.;
const HEIGHT: f32 = 800.;

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

    /// One pass of timers and tasks, then one frame.
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

    fn picture(&mut self) -> u64 {
        let image = self.win(|window, _| window.render_to_image().expect("offscreen render"));
        let mut hasher = DefaultHasher::new();
        image.as_raw().hash(&mut hasher);
        hasher.finish()
    }

    /// Opens the editor mod on `key`; returns the editor's box once drawn.
    fn open(&mut self, key: &str, path: &str, value: &str) -> gpui::Bounds<gpui::Pixels> {
        let opened = self.ws(|ws, _, cx| {
            ws.open_screen(
                "instructions",
                json!({ "key": key, "path": path, "value": value }),
                None,
                None,
                cx,
            )
        });
        assert!(opened, "the editor mod is drawn in the instructions slot");
        for _ in 0..200 {
            let records = self.step(true);
            if let Some(area) = records.iter().find(|r| r.name.as_ref() == "editor-box") {
                return area.bounds;
            }
            let error = self.ws(|ws, _, cx| ws.screen_error("instructions", cx));
            assert!(error.is_none(), "{key}: {error:?}");
        }
        panic!("{key}: the editor is never drawn");
    }

    /// Opens `key` from Rust, then the mod that draws it; returns the box and the times to the editor's creation
    /// and to its first drawn frame.
    fn open_from_rust(
        &mut self,
        key: &str,
        path: &str,
        value: &str,
    ) -> (gpui::Bounds<gpui::Pixels>, Duration, Duration) {
        let editors = self.editors();
        let options = gpui_shell::HostValue::Object(vec![
            ("path".into(), path.into()),
            ("value".into(), value.into()),
        ]);
        let started = Instant::now();
        self.win(|window, cx| {
            editors
                .open("instructions", key, &options, window, cx)
                .unwrap()
        });
        let created = started.elapsed();
        let opened = self.ws(|ws, _, cx| {
            ws.open_screen(
                "instructions",
                json!({ "key": key, "preopened": true }),
                None,
                None,
                cx,
            )
        });
        assert!(opened);
        for _ in 0..200 {
            let records = self.step(true);
            if let Some(area) = records.iter().find(|r| r.name.as_ref() == "editor-box") {
                return (area.bounds, created, started.elapsed());
            }
        }
        panic!("{key}: the editor is never drawn");
    }

    fn close(&mut self) {
        self.ws(|ws, window, cx| {
            ws.screen_closed("instructions", serde_json::Value::Null, window, cx)
        });
        for _ in 0..3 {
            self.step(true);
        }
    }

    /// A probe id the mod drew with `prefix`, without it.
    fn shown(&mut self, prefix: &str) -> String {
        self.step(true)
            .iter()
            .find_map(|r| r.name.strip_prefix(prefix).map(str::to_string))
            .unwrap_or_default()
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
        self.step(false);
    }

    /// Types `key` into the focused editor and draws; returns how long that took.
    fn key(&mut self, key: &str) -> Duration {
        let key = gpui::Keystroke::parse_with_os(key, gpui::OperatingSystem::Mac).unwrap();
        let started = Instant::now();
        self.win(|window, cx| {
            window.dispatch_keystroke(key, cx);
        });
        self.cx.run_until_parked();
        self.step(false);
        started.elapsed()
    }

    /// Steps until no background parse runs (every line coloured); returns how long that took.
    fn until_coloured(&mut self) -> Duration {
        let started = Instant::now();
        for _ in 0..20_000 {
            self.cx.run_until_parked();
            if highlight::background_parses_running() == 0 {
                self.step(false);
                if highlight::background_parses_running() == 0 {
                    return started.elapsed();
                }
            }
            std::thread::sleep(Duration::from_millis(1));
        }
        panic!("the background parse never finished");
    }

    fn value(&mut self, key: &str) -> String {
        let state = self.editors().state(key).expect("open");
        self.cx.update(|cx| state.read(cx).value().to_string())
    }
}

fn env_list(name: &str, default: &[usize]) -> Vec<usize> {
    std::env::var(name)
        .ok()
        .map(|v| v.split(',').filter_map(|n| n.trim().parse().ok()).collect())
        .unwrap_or_else(|| default.to_vec())
}

/// `lines` Rust lines of about 27 characters (10,000 stay under the highlight cap).
fn short_rust(lines: usize) -> String {
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

/// The measurement file's lines (110 characters, `measurements.md`).
fn long_rust(lines: usize) -> String {
    (0..lines)
        .map(|i| {
            format!(
                "fn step_{i}(input: &[u32]) -> Option<u32> {{ let x = input.get({})?; Some(x * {} + 1) }} // line {i}",
                i % 97,
                i % 13
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn behaves_like_the_web_editor(rig: &mut Rig) {
    let text = short_rust(200);
    let area = rig.open("doc-a", "src/a.rs", &text);
    assert_eq!(rig.shown("editor-restored-"), "false");
    // Click at the start of the first line's text, then type: changes and the caret are heard.
    rig.click(point(area.origin.x + px(60.), area.origin.y + px(8.)));
    rig.win(|_, _| {});
    let editors = rig.editors();
    let state = editors.state("doc-a").unwrap();
    rig.win(|window, cx| {
        state.update(cx, |s, cx| {
            s.set_cursor_position(gpui_base::input::Position::new(0, 0), window, cx)
        })
    });
    rig.step(false);
    let _ = editors.drain("doc-a");
    for key in ["x", "y", "z"] {
        rig.key(key);
    }
    assert!(
        rig.value("doc-a").starts_with("xyzfn f0"),
        "{:?}",
        &rig.value("doc-a")[..20]
    );
    assert_ne!(
        rig.shown("editor-changes-"),
        "0",
        "user edits are heard as changes"
    );
    assert_eq!(rig.shown("editor-caret-"), "1-4", "the caret is 1-based");
    rig.cx.update(|cx| assert!(state.read(cx).can_undo()));

    // A store value: applied, no change event, no undo entry, the caret kept.
    let stored = format!("// from disk\n{text}");
    let changes = rig.shown("editor-changes-");
    rig.win(|window, cx| editors.set_value("doc-a", &stored, true, window, cx));
    assert_eq!(rig.value("doc-a"), stored);
    assert_eq!(
        rig.shown("editor-changes-"),
        changes,
        "an external value is not echoed as a change"
    );
    rig.cx.update(|cx| {
        assert!(
            !state.read(cx).can_undo(),
            "an external value leaves no undo entry"
        )
    });
    // Applying the value it already has is a no-op.
    rig.win(|window, cx| editors.set_value("doc-a", &stored, true, window, cx));

    // Undo returns to the stored value after typing.
    rig.key("q");
    assert_ne!(rig.value("doc-a"), stored);
    rig.key("cmd-z");
    assert_eq!(rig.value("doc-a"), stored, "undo reverts the typed key");
    rig.key("w");
    let typed = rig.value("doc-a");

    // Parked by key: reopening with the same text restores undo history; other text starts over.
    rig.close();
    editors.park("doc-a");
    assert!(editors.is_parked("doc-a"));
    rig.open("doc-a", "src/a.rs", &typed);
    assert_eq!(rig.shown("editor-restored-"), "true");
    rig.cx.update(|cx| {
        assert!(
            state.read(cx).can_undo(),
            "a restored editor keeps its history"
        )
    });
    rig.close();
    editors.park("doc-a");
    rig.open("doc-a", "src/a.rs", "something else");
    assert_eq!(rig.shown("editor-restored-"), "false");
    rig.close();
    editors.release("doc-a");

    // At most 32 parked: the least recently parked goes.
    rig.win(|window, cx| {
        for i in 0..33 {
            let key = format!("p{i}");
            editors
                .open(
                    "test",
                    &key,
                    &gpui_shell::HostValue::Object(vec![
                        ("path".into(), "x.rs".into()),
                        ("value".into(), "fn x() {}".into()),
                    ]),
                    window,
                    cx,
                )
                .unwrap();
            editors.park(&key);
        }
    });
    assert!(
        editors.state("p0").is_none(),
        "the oldest parked editor was dropped"
    );
    assert!(editors.state("p1").is_some() && editors.state("p32").is_some());
    for i in 0..33 {
        editors.release(&format!("p{i}"));
    }
    assert!(editors.keys().is_empty());
}

fn a_theme_switch_recolours_an_open_editor(rig: &mut Rig) {
    rig.open("doc-theme", "src/t.rs", &short_rust(60));
    rig.until_coloured();
    let before = rig.picture();
    rig.cx
        .update(|_| syntax_theme::set_theme(&theme::resolve("catppuccin")));
    rig.step(true);
    let after = rig.picture();
    rig.cx
        .update(|_| syntax_theme::set_theme(&theme::resolve("perch")));
    rig.step(true);
    assert_ne!(before, after, "the syntax colours follow the theme");
    assert_eq!(rig.picture(), before, "and come back with it");
    rig.close();
    rig.editors().release("doc-theme");
}

fn typing_stays_quick_during_a_slow_parse(rig: &mut Rig) {
    // 20 ms a line makes the 2,000-line parse take 40 s, so it is still running when the keys arrive however slow
    // the machine is; setting the delay back to zero below lets it finish at once.
    highlight::slow_background_parse_for_tests(Duration::from_millis(20));
    let area = rig.open("doc-slow", "src/s.rs", &short_rust(2_000));
    rig.click(point(area.origin.x + px(200.), area.origin.y + px(100.)));
    assert!(
        highlight::background_parses_running() > 0,
        "the parse is still running while keys arrive"
    );
    let mut worst = Duration::ZERO;
    for i in 0..10 {
        worst = worst.max(rig.key(if i == 4 { "enter" } else { "/" }));
    }
    let still = highlight::background_parses_running() > 0;
    highlight::slow_background_parse_for_tests(Duration::ZERO);
    rig.until_coloured();
    assert!(rig.value("doc-slow").matches('/').count() >= 9);
    report(&format!(
        "typing during a slow background parse: worst key and frame {worst:?}; parse still running after the keys: {still}"
    ));
    // Typing never waited for the 40 s parse.
    assert!(
        worst < Duration::from_millis(500),
        "typing waited for the parse: {worst:?}"
    );
    rig.close();
    rig.editors().release("doc-slow");
}

fn report(line: &str) {
    if std::env::var_os("PERCH_EDITOR_REPORT").is_some() {
        println!("{line}");
    }
}

/// How far over a budget a release run may go: twice it for noisy machines, none when strict.
fn margin() -> u32 {
    if std::env::var("PERCH_BUDGET_STRICT").as_deref() == Ok("1") {
        1
    } else {
        2
    }
}

fn timings(rig: &mut Rig) {
    let uncapped = std::env::var_os("PERCH_EDITOR_UNCAPPED").is_some();
    if uncapped {
        highlight::set_max_highlight_chars_for_tests(usize::MAX);
    }
    let release = !cfg!(debug_assertions);
    let steps = 30;
    for lines in env_list("PERCH_EDITOR_LINES", &[1_000, 10_000]) {
        let text = if uncapped || lines > 10_000 {
            long_rust(lines)
        } else {
            short_rust(lines)
        };
        let highlighted = uncapped || text.chars().count() <= highlight::MAX_HIGHLIGHT_CHARS;
        let key = format!("timed-{lines}");
        let (area, created, first) = rig.open_from_rust(&key, "src/big.rs", &text);
        let coloured = rig.until_coloured() + first;
        rig.click(point(area.origin.x + px(200.), area.origin.y + px(100.)));
        let mut each: Vec<Duration> = (0..steps)
            .map(|i| rig.key(if i % 10 == 9 { "enter" } else { "a" }))
            .collect();
        each.sort();
        let mean = each.iter().sum::<Duration>() / steps as u32;
        report(&format!(
            "editor {lines} lines ({} chars, {}): open {created:?}, first frame {first:?}, every line coloured {coloured:?}; typed {steps} keys, mean {mean:?}, median {:?}, worst {:?} per key and frame",
            text.len(),
            if highlighted { "highlighted" } else { "plain, over the cap" },
            each[steps / 2],
            each[steps - 1],
        ));
        if release && highlighted && !uncapped {
            let budget = match lines {
                ..=1_000 => Duration::from_millis(4),
                _ => Duration::from_millis(8),
            };
            assert!(
                mean <= budget * margin(),
                "{lines} lines: {mean:?} per key, budget {budget:?}"
            );
            if lines <= 10_000 {
                assert!(
                    coloured <= Duration::from_millis(500) * margin(),
                    "{lines} lines coloured in {coloured:?}"
                );
            }
        }
        rig.close();
        rig.editors().release(&key);
    }
    highlight::set_max_highlight_chars_for_tests(highlight::MAX_HIGHLIGHT_CHARS);
}

/// The lines on screen are coloured in the first frame: the parse that runs on the UI thread when a file opens covers
/// them, and the rest of the file follows off it. The first frame of a second opening of the same 10,000-line file is
/// compared with the fully coloured picture of the first.
fn visible_lines_are_coloured_in_the_first_frame(rig: &mut Rig) {
    let text = short_rust(10_000);
    rig.open_from_rust("visible-done", "src/v.rs", &text);
    rig.until_coloured();
    let coloured = rig.picture();
    rig.close();
    rig.editors().release("visible-done");

    rig.open_from_rust("visible", "src/v.rs", &text);
    let mut late = 0;
    while rig.picture() != coloured && late < 10 {
        late += 1;
        rig.step(false);
    }
    rig.until_coloured();
    assert_eq!(
        rig.picture(),
        coloured,
        "both openings draw the same coloured picture"
    );
    report(&format!(
        "editor 10000 lines: the lines on screen were coloured {late} frame(s) after the first"
    ));
    if !cfg!(debug_assertions) {
        assert!(
            late < margin(),
            "the lines on screen were coloured {late} frame(s) after the first"
        );
    }
    rig.close();
    rig.editors().release("visible");
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-editor-engine-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    std::fs::create_dir_all(user.join("instructions")).unwrap();
    std::fs::write(
        user.join("instructions/mod.json"),
        r#"{ "name": "Editor engine" }"#,
    )
    .unwrap();
    std::fs::write(user.join("instructions/main.js"), EDITOR).unwrap();

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
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    for _ in 0..3 {
        rig.step(true);
    }

    behaves_like_the_web_editor(&mut rig);
    println!("ok: the editor behaves as the web's CodeEditor");
    a_theme_switch_recolours_an_open_editor(&mut rig);
    println!("ok: a theme switch recolours an open editor");
    typing_stays_quick_during_a_slow_parse(&mut rig);
    println!("ok: typing stays quick during a slow background parse");
    visible_lines_are_coloured_in_the_first_frame(&mut rig);
    println!("ok: the lines on screen are coloured in the first frame");
    timings(&mut rig);
    println!("ok: editor timings");
    let _ = std::fs::remove_dir_all(&scratch);
}
