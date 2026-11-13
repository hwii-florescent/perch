//! A native mod drawn offscreen: what its `render()` describes is what is drawn, an edit on disk
//! is drawn without a restart, and a version that throws leaves the last good one drawn and says
//! why.
//!
//! GPUI's test platform draws through the real Metal renderer into a texture; no window is
//! created, shown or focused. Its own binary with a custom `main`, as the other render tests are.
//! Boxes, colours and fonts are read from gpui-shell's probe (every element a mod names with
//! `.id(...)`), and checked against the pixels.

use gpui::{px, size, Entity, HeadlessAppContext, Hsla, Pixels, Window, WindowHandle};
use gpui_shell::probe::{self, ProbeRecord};
use perch_native::mods::{self, ModHost, ModView, POLL};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

const WIDTH: f32 = 400.;
const HEIGHT: f32 = 240.;

/// A mod whose one named box has every property the probe reads. `{bg}`, `{width}` and `{text}`
/// vary between versions. Each version's final call (`close`) records its text, and the box names
/// the versions closed so far (`closed:Hello,...`).
const BOX: &str = r##"
import { View, div } from "gpui-kit";
export default class extends View {
  close() { globalThis.closed = [...(globalThis.closed ?? []), "{text}"]; }
  render() {
    return div().id("root").size_full().bg("#202020").p(10).flex().flex_col().justify_end()
      .child(div().id(`closed:${(globalThis.closed ?? []).join(",")}`).w(1).h(1))
      .child(div().id("box").w({width}).h(40).bg("{bg}").border(2).border_color("#00ff00")
        .rounded(6).font_family("Menlo").text_size(14).font_weight(700).line_height("20px")
        .text_color("#ffffff").child("{text}"));
  }
}
"##;

/// A mod that tries what a mod may and may not reach, and names a box for each outcome.
const REACH: &str = r##"
import { View, div } from "gpui-kit";
import { readFile, writeFile } from "fs/promises";
export default class extends View {
  init(_props, cx) {
    this.seen = {};
    const note = (key, attempt) => attempt.then(() => "ok", () => "denied")
      .then((how) => { this.seen[key] = how; cx.notify(); });
    const now = (f) => { try { f(); return Promise.resolve(); } catch (e) { return Promise.reject(e); } };
    note("own", now(() => {}).then(() => readFile("main.js", "utf8")));
    note("home", now(() => {}).then(() => readFile("{home}", "utf8")));
    note("other", now(() => {}).then(() => writeFile("{other}", "overwritten")));
    note("data", now(() => {}).then(() => writeFile("{data}", "mine")));
    note("clipboard", now(() => cx.read_from_clipboard()));
  }
  render() {
    return div().id("reach-root").size_full().children(
      Object.entries(this.seen).map(([k, v]) => div().id(`reach-${k}-${v}`).w(10).h(10)));
  }
}
"##;

fn draw_any(cx: &mut HeadlessAppContext, window: gpui::AnyWindowHandle) {
    cx.update_window(window, |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
}

fn box_mod(bg: &str, width: u32, text: &str) -> String {
    BOX.replace("{bg}", bg)
        .replace("{width}", &width.to_string())
        .replace("{text}", text)
}

struct Frame {
    raw: Vec<u8>,
    width: usize,
    scale: f32,
}

impl Frame {
    /// The colour at a logical point, as `0xRRGGBB`.
    fn at(&self, x: f32, y: f32) -> u32 {
        let (x, y) = ((x * self.scale) as usize, (y * self.scale) as usize);
        let p = &self.raw[(y * self.width + x) * 4..][..3];
        u32::from_be_bytes([0, p[0], p[1], p[2]])
    }

    /// How many pixels inside a logical box are near `color`.
    fn count(&self, bounds: gpui::Bounds<Pixels>, color: u32) -> usize {
        let want = color.to_be_bytes();
        let scale = |v: Pixels| (f32::from(v) * self.scale) as usize;
        let (x0, y0) = (scale(bounds.origin.x), scale(bounds.origin.y));
        let (x1, y1) = (scale(bounds.right()), scale(bounds.bottom()));
        (y0..y1)
            .flat_map(|y| (x0..x1).map(move |x| (x, y)))
            .filter(|(x, y)| {
                let p = &self.raw[(y * self.width + x) * 4..][..3];
                p.iter().zip(&want[1..]).all(|(a, b)| a.abs_diff(*b) <= 2)
            })
            .count()
    }
}

/// `0xRRGGBB` of a resolved colour.
fn hex(color: Hsla) -> u32 {
    let rgb = color.to_rgb();
    let byte = |v: f32| (v * 255.).round() as u32;
    (byte(rgb.r) << 16) | (byte(rgb.g) << 8) | byte(rgb.b)
}

/// Draws the whole window afresh and reads it back with the probe's records.
fn draw(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>) -> (Frame, ProbeRecord) {
    let (image, scale) = cx
        .update_window(window.into(), |_, window: &mut Window, cx| {
            probe::clear();
            // A frame GPUI replays from its view cache prepaints nothing to record.
            window.refresh();
            let _ = window.draw(cx);
            (
                window.render_to_image().expect("offscreen render"),
                window.scale_factor(),
            )
        })
        .unwrap();
    let frame = Frame {
        width: image.width() as usize,
        raw: image.into_raw(),
        scale,
    };
    let record = probe::record("box").expect("the named box was laid out");
    (frame, record)
}

/// Lets the mod's file watch run until `done` holds for what is drawn.
fn until(
    cx: &mut HeadlessAppContext,
    window: WindowHandle<ModView>,
    what: &str,
    done: impl Fn(&ModView, &gpui::App, &ProbeRecord) -> bool,
) -> (Frame, ProbeRecord) {
    for _ in 0..40 {
        cx.advance_clock(POLL);
        cx.run_until_parked();
        let (frame, record) = draw(cx, window);
        let view: Entity<ModView> = window.entity(cx).unwrap();
        if cx.update(|cx| done(view.read(cx), cx, &record)) {
            return (frame, record);
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    panic!("timed out waiting for {what}");
}

/// The versions of the probe mod that got their final call, as the box last named them.
fn closed() -> String {
    probe::records()
        .into_keys()
        .find_map(|name| name.strip_prefix("closed:").map(str::to_string))
        .expect("the closed list is drawn")
}

fn write(dir: &Path, text: &str) {
    std::fs::write(dir.join("main.js"), text).unwrap();
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-mods-render-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    // The engine reads nothing of the person's: its home is the scratch folder.
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    let dir = user.join("probe");
    std::fs::create_dir_all(&dir).unwrap();
    write(&dir, &box_mod("#ff0000", 120, "Hello"));

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    cx.update(mods::init);
    let host = ModHost::new(user.clone()).expect("the mod host starts");
    assert!(
        host.find("example").is_some_and(|m| !m.user),
        "the stock mod is there"
    );
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |window, cx| {
            host.view("probe", window, cx)
        })
        .unwrap();
    let view = window.entity(&cx).unwrap();

    // What render() describes is what is drawn.
    let (frame, first) = draw(&mut cx, window);
    let error = cx.update(|cx| view.read(cx).error(cx));
    assert_eq!(error, None, "the mod loads and renders");
    let want = gpui::bounds(
        gpui::point(px(10.), px(HEIGHT - 50.)),
        size(px(120.), px(40.)),
    );
    assert_eq!(
        first.bounds, want,
        "the box is where the description puts it"
    );
    assert_eq!(first.background.map(hex), Some(0xff0000));
    assert_eq!(first.border_color.map(hex), Some(0x00ff00));
    assert_eq!(first.border_widths, [px(2.); 4]);
    assert_eq!(first.corner_radii, [px(6.); 4]);
    assert_eq!(hex(first.text_color), 0xffffff);
    assert_eq!(
        (
            first.font_family.as_ref(),
            first.font_size,
            first.font_weight.0,
            first.line_height
        ),
        ("Menlo", px(14.), 700., px(20.))
    );
    let root = probe::record("root").expect("the root is named too");
    assert_eq!(root.bounds.size, size(px(WIDTH), px(HEIGHT)));
    assert_eq!(frame.at(WIDTH - 20., 20.), 0x202020, "the root's fill");
    assert_eq!(
        frame.at(10. + 110., HEIGHT - 50. + 30.),
        0xff0000,
        "the box's fill"
    );
    assert_eq!(
        frame.at(10. + 60., HEIGHT - 50. + 0.5),
        0x00ff00,
        "the border"
    );
    let text = frame.count(first.bounds, 0xffffff);
    assert!(
        text > 20,
        "the text is drawn in the box ({text} white pixels)"
    );

    // An edit on disk is drawn by the same view, without a restart.
    write(&dir, &box_mod("#0000ff", 200, "Hello again"));
    let (frame, second) = until(&mut cx, window, "the edit", |_, _, record| {
        record.bounds.size.width == px(200.)
    });
    assert_eq!(second.background.map(hex), Some(0x0000ff));
    assert_eq!(frame.at(10. + 190., HEIGHT - 50. + 30.), 0x0000ff);
    assert_eq!(
        frame.count(second.bounds, 0xff0000),
        0,
        "the old fill is gone"
    );
    assert_eq!(
        window.entity(&cx).unwrap(),
        view,
        "the same view reloaded in place"
    );
    assert_eq!(
        cx.update(|cx| view.read(cx).source().map(Path::to_path_buf)),
        Some(dir.clone())
    );
    assert_eq!(
        closed(),
        "Hello",
        "the version the reload replaced got its final call"
    );

    // A version that throws while loading keeps the last good one drawn and reports why.
    write(&dir, "throw new Error(\"broken at load\");\n");
    let (frame, kept) = until(&mut cx, window, "the load error", |view, _, _| {
        view.load_error().is_some()
    });
    let error = cx.update(|cx| view.read(cx).error(cx)).unwrap();
    assert!(error.contains("broken at load"), "{error}");
    assert_eq!(kept, second, "the last working version is still laid out");
    assert_eq!(frame.at(10. + 190., HEIGHT - 50. + 30.), 0x0000ff);
    assert_eq!(closed(), "Hello", "and it was not closed");

    // One that throws in render() keeps the last good render, under the shell's banner.
    write(
        &dir,
        r#"
import { View } from "gpui-kit";
export default class extends View {
  render() { throw new Error("broken in render"); }
}
"#,
    );
    let (frame, kept) = until(&mut cx, window, "the render error", |view, cx, _| {
        view.render_error(cx).is_some()
    });
    let error = cx.update(|cx| view.read(cx).error(cx)).unwrap();
    assert!(error.contains("broken in render"), "{error}");
    assert_eq!(
        cx.update(|cx| view.read(cx).load_error().map(str::to_string)),
        None
    );
    assert_eq!(kept, second, "the last good render is still laid out");
    assert_eq!(frame.at(10. + 190., HEIGHT - 50. + 30.), 0x0000ff);

    // Fixing it clears the error.
    write(&dir, &box_mod("#ff0000", 120, "Fixed"));
    until(&mut cx, window, "the fix", |view, cx, record| {
        view.error(cx).is_none() && record.bounds.size.width == px(120.)
    });
    assert_eq!(
        closed(),
        "Hello,Hello again",
        "the working version went when the one throwing in render() replaced it"
    );

    // A user folder made while a stock mod is shown takes its place, and removing it gives the
    // stock one back.
    let stock = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |window, cx| {
            host.view("example", window, cx)
        })
        .unwrap();
    let source = |cx: &mut HeadlessAppContext| {
        let view = stock.entity(&*cx).unwrap();
        cx.update(|cx| view.read(cx).source().map(Path::to_path_buf))
    };
    assert_eq!(source(&mut cx), Some(user.join(".stock/example")));
    let mine = user.join("example");
    std::fs::create_dir_all(&mine).unwrap();
    write(&mine, &box_mod("#ff0000", 120, "Mine"));
    let switched = |cx: &mut HeadlessAppContext, want: &Path| {
        (0..40).any(|_| {
            cx.advance_clock(POLL);
            cx.run_until_parked();
            std::thread::sleep(Duration::from_millis(25));
            source(cx).as_deref() == Some(want)
        })
    };
    assert!(
        switched(&mut cx, &mine),
        "the user folder replaces the stock mod"
    );
    std::fs::remove_dir_all(&mine).unwrap();
    assert!(
        switched(&mut cx, &user.join(".stock/example")),
        "the stock mod comes back"
    );

    // What a mod may reach: its own folder to read, its own data folder to write, the clipboard
    // to write but not read. Not the home folder, not another mod's folder.
    std::fs::write(scratch.join("home/secret"), "token").unwrap();
    let reach = user.join("reach");
    std::fs::create_dir_all(&reach).unwrap();
    write(
        &reach,
        &REACH
            .replace("{home}", &scratch.join("home/secret").display().to_string())
            .replace("{other}", &dir.join("main.js").display().to_string())
            .replace(
                "{data}",
                &user.join(".data/reach/note.txt").display().to_string(),
            ),
    );
    let before = std::fs::read_to_string(dir.join("main.js")).unwrap();
    let reached = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |window, cx| {
            host.view("reach", window, cx)
        })
        .unwrap();
    let want = [
        "reach-own-ok",
        "reach-data-ok",
        "reach-home-denied",
        "reach-other-denied",
        "reach-clipboard-denied",
    ];
    let all = (0..40).any(|_| {
        cx.advance_clock(POLL);
        cx.run_until_parked();
        draw_any(&mut cx, reached.into());
        std::thread::sleep(Duration::from_millis(25));
        want.iter().all(|name| probe::record(name).is_some())
    });
    let drawn: Vec<String> = probe::records()
        .into_keys()
        .map(|n| n.to_string())
        .filter(|n| n.starts_with("reach-"))
        .collect();
    assert!(all, "what the mod reached: {drawn:?}");
    assert_eq!(
        std::fs::read_to_string(dir.join("main.js")).unwrap(),
        before
    );
    assert_eq!(
        std::fs::read_to_string(user.join(".data/reach/note.txt")).unwrap(),
        "mine"
    );

    // A folder with the engine's own manifest is refused before the engine reads it (it would
    // clone the manifest's git dependencies), and says why where a load failure is shown. This
    // manifest lacks the engine's required `id`, so even unrefused nothing would be cloned.
    let manifest = user.join("manifest");
    std::fs::create_dir_all(&manifest).unwrap();
    write(&manifest, &box_mod("#ff0000", 120, "Manifest"));
    std::fs::write(
        manifest.join("gpui-shell.json"),
        r#"{"dependencies": {"x": {"git": "https://example.invalid/x.git", "rev": "main"}}}"#,
    )
    .unwrap();
    let refused = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |window, cx| {
            host.view("manifest", window, cx)
        })
        .unwrap();
    cx.advance_clock(POLL);
    cx.run_until_parked();
    let error = refused
        .read_with(&cx, |view, _| view.load_error().map(str::to_string))
        .unwrap();
    assert!(
        error
            .as_deref()
            .is_some_and(|e| e.contains("gpui-shell.json")),
        "{error:?}"
    );

    for window in [window.into(), stock.into(), reached.into(), refused.into()] {
        cx.update_window(window, |_, window, _| window.remove_window())
            .unwrap();
    }
    cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!(
        "mods_render: ok (text pixels {text}, scale {})",
        frame.scale
    );
}
