//! The `perch` module in a running window: what a mod reads reaches it, a change re-renders the
//! mods that read it (and only those), `run` runs the window's own command, a theme change
//! redraws with the new tokens and sets gpui-base's theme, and the parity helper writes a mod's
//! rendering as the web reference is written.
//!
//! Offscreen, as the other render tests: GPUI's test platform draws through Metal into a texture;
//! no window is shown or focused and no core runs.

#[path = "common/parity.rs"]
mod parity;

use gpui::{px, size, AppContext as _, HeadlessAppContext, Hsla, Window, WindowHandle};
use gpui_shell::probe::{self, ProbeRecord};
use gpui_shell::{HostArguments, HostValue};
use perch_core::protocol::ServerMessage;
use perch_native::client::Update;
use perch_native::mods::perch::Perch;
use perch_native::mods::{self, theme, ModHost, ModView};
use perch_native::sidebar::{Model, State};
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

/// Draws `count` boxes' worth of width from `perch.terminals()`, in the theme's accent.
const COUNT: &str = r#"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    const n = perch.terminals().length;
    const t = perch.theme();
    return div().id("root").size_full().bg(t["panel-bg"])
      .child(div().id("count").w(10 * n + 10).h(20).bg(t.accent));
  }
}
"#;

/// Reads nothing that changes; its width counts its renders.
const BYSTANDER: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
let renders = 0;
export default class extends View {
  render() {
    renders += 1;
    perch.themes();
    return div().id("root").size_full()
      .child(div().id("renders").w(10 * renders).h(10).bg("#ff0000"));
  }
}
"##;

/// Asks the window for its Navigator as soon as it loads.
const RUNNER: &str = r#"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  init() {
    perch.run("app.palette").then(() => { globalThis.ran = true; });
  }
  render() { return div().id("root").size_full(); }
}
"#;

/// Draws a box as wide as ten device pixels' worth of logical pixels: `10 * perch.scale()`.
const SCALE: &str = r#"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    return div().id("root").size_full()
      .child(div().id("scale").w(10 * perch.scale()).h(10));
  }
}
"#;

fn session(id: &str) -> Value {
    json!({
        "id": id, "title": id, "cwd": "/tmp", "createdAt": 1, "status": "idle", "hostId": "local",
    })
}

fn model(ids: &[&str]) -> Model {
    let mut state = State::default();
    state.connect();
    let list: Vec<Value> = ids.iter().map(|id| session(id)).collect();
    let message: ServerMessage =
        serde_json::from_value(json!({ "type": "session.list", "sessions": list })).unwrap();
    state.apply(&message);
    state.model()
}

fn hex(color: Hsla) -> String {
    parity::rgba(color)[..7].to_string()
}

/// Draws `window` afresh; returns the probe's record of `name`.
fn draw(cx: &mut HeadlessAppContext, window: WindowHandle<ModView>, name: &str) -> ProbeRecord {
    cx.run_until_parked();
    cx.update_window(window.into(), |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
    let error = cx.update(|cx| window.entity(&*cx).unwrap().read(cx).error(cx));
    assert_eq!(error, None, "the mod renders");
    probe::record(name).unwrap_or_else(|| panic!("{name} was laid out"))
}

fn open(cx: &mut HeadlessAppContext, host: &ModHost, id: &str) -> WindowHandle<ModView> {
    cx.open_window(size(px(300.), px(100.)), |window, cx| {
        host.view(id, window, cx)
    })
    .unwrap()
}

fn write_mod(user: &std::path::Path, id: &str, text: &str) {
    std::fs::create_dir_all(user.join(id)).unwrap();
    std::fs::write(user.join(id).join("main.js"), text).unwrap();
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-mods-perch-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    write_mod(&user, "count", COUNT);
    write_mod(&user, "bystander", BYSTANDER);
    write_mod(&user, "runner", RUNNER);
    write_mod(&user, "scale", SCALE);

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    cx.update(mods::init);
    let host = ModHost::new(user.clone()).expect("the mod host starts");
    let perch = Perch::new();
    perch.register(&host);

    // The window the module follows: its model and its commands.
    let workspace_window = cx
        .open_window(size(px(1000.), px(700.)), |_, cx| {
            cx.new(|cx| Workspace::new(model(&["s-1", "s-2"]), None, cx))
        })
        .unwrap();
    let workspace = workspace_window.entity(&cx).unwrap();
    cx.update(|cx| perch.attach(&workspace, workspace_window.into(), cx));

    // Data reaches the mod.
    let count = open(&mut cx, &host, "count");
    let bystander = open(&mut cx, &host, "bystander");
    let first = draw(&mut cx, count, "count");
    assert_eq!(first.bounds.size.width, px(30.), "two sessions");
    let dark = theme::resolve("perch");
    assert_eq!(first.background.map(hex).as_deref(), dark.token("accent"));
    let renders = draw(&mut cx, bystander, "renders").bounds.size.width;

    // `perch.scale()` is the scale factor of the window the mod is drawn in.
    let scale = open(&mut cx, &host, "scale");
    let factor = cx
        .update_window(scale.into(), |_, window: &mut Window, _| {
            window.scale_factor()
        })
        .unwrap();
    assert_eq!(
        draw(&mut cx, scale, "scale").bounds.size.width,
        px(10. * factor),
        "perch.scale() is the window's scale factor"
    );
    cx.update_window(scale.into(), |_, window, _| window.remove_window())
        .unwrap();

    // A change the window sees re-renders the mod that read it, and not the one that did not.
    cx.update(|cx| {
        let sidebar = workspace.read(cx).sidebar().clone();
        sidebar.update(cx, |sidebar, cx| {
            sidebar.apply(Update::Model(model(&["s-1", "s-2", "s-3"])), cx)
        });
    });
    let second = draw(&mut cx, count, "count");
    assert_eq!(second.bounds.size.width, px(40.), "three sessions");
    assert_eq!(
        draw(&mut cx, bystander, "renders").bounds.size.width,
        renders,
        "a mod that read nothing that changed is not run again"
    );

    // A theme change redraws with the new tokens and sets gpui-base's theme.
    let latte = theme::resolve("catppuccin-latte");
    perch.set_theme("catppuccin-latte");
    cx.update(|cx| perch.flush(cx));
    let third = draw(&mut cx, count, "count");
    assert_eq!(third.background.map(hex).as_deref(), latte.token("accent"));
    let root = probe::record("root").unwrap();
    assert_eq!(root.background.map(hex).as_deref(), latte.token("panel-bg"));
    assert!(
        draw(&mut cx, bystander, "renders").bounds.size.width > renders,
        "a new theme reaches every mod"
    );
    let base = cx.update(|cx| {
        let theme = gpui_base::Theme::global(cx);
        (
            theme.appearance == gpui_base::ThemeAppearance::Light,
            hex(theme.tokens.colors.primary),
        )
    });
    assert_eq!(base, (true, latte.token("accent").unwrap().to_string()));
    assert_eq!(
        perch
            .module("count")
            .call("themeName", &HostArguments::new([]))
            .unwrap(),
        HostValue::Str("catppuccin-latte".into())
    );

    // `run` runs the window's command; an unknown one is refused before anything runs.
    assert!(!cx.update(|cx| workspace.read(cx).palette_open()));
    let runner = open(&mut cx, &host, "runner");
    draw(&mut cx, runner, "root");
    assert!(
        cx.update(|cx| workspace.read(cx).palette_open()),
        "perch.run(\"app.palette\") opened the Navigator"
    );
    let refused = perch.module("runner").begin(
        "run",
        &HostArguments::new([HostValue::Str("no.such.command".into())]),
    );
    assert!(refused.is_err_and(|e| e.message().contains("no.such.command")));

    // The parity helper: the stock probe mod from the sidebar fixture, as the web writes it.
    let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));
    let out = scratch.join("parity");
    let shot = parity::capture(
        &mut cx,
        &parity::Capture {
            mod_id: "parity-probe",
            fixture: &fixture,
            state: "by-project",
            theme: parity::Theme::Light,
            out: &out,
        },
    );
    assert_eq!(shot.png, out.join("sidebar.by-project.light.png"));
    let image = image::open(&shot.png).expect("a PNG").to_rgba8();
    assert_eq!(image.dimensions(), (480, 1600), "240 x 800 at scale 2");
    let written: Value =
        serde_json::from_str(&std::fs::read_to_string(&shot.json).unwrap()).unwrap();
    assert_eq!(written, shot.report);
    assert_eq!(written["schema"], parity::SCHEMA);
    assert_eq!(
        (&written["screen"], &written["state"], &written["theme"]),
        (&json!("sidebar"), &json!("by-project"), &json!("light"))
    );
    assert_eq!(
        written["tokens"]["accent"],
        json!(format!("{}ff", latte.token("accent").unwrap()))
    );
    let element = |name: &str| {
        written["elements"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["name"] == name)
            .cloned()
            .unwrap_or_else(|| panic!("{name} is in the JSON"))
    };
    let host_row = element("probe-host");
    assert_eq!(host_row["key"], Value::Null);
    assert_eq!(
        host_row["box"],
        json!({ "x": 8.0, "y": 8.0, "width": 224.0, "height": 20.0 })
    );
    let project = element("probe-project");
    assert_eq!(
        project["key"], "p-perch",
        "the first project the navigation lists"
    );
    assert_eq!(project["colors"]["backgroundColor"]["token"], "accent");
    // The PNG holds what the JSON says: the project row is filled with the accent.
    let accent = u32::from_str_radix(&latte.token("accent").unwrap()[1..], 16).unwrap();
    let pixel = image.get_pixel(2 * 100, 2 * (8 + 20 + 4 + 12));
    assert_eq!(
        u32::from_be_bytes([0, pixel[0], pixel[1], pixel[2]]),
        accent,
        "the project row's fill"
    );

    for window in [
        count.into(),
        bystander.into(),
        runner.into(),
        workspace_window.into(),
    ] {
        cx.update_window(window, |_, window, _| window.remove_window())
            .unwrap();
    }
    cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_perch: ok");
}
