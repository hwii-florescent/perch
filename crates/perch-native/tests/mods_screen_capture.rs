//! The chrome screens against the web reference, with a window: the props the window's real
//! openers give a screen mod (the palette key, a right-click in a pane, the close guard, a
//! notification, the sidebar's New) have the fields the web screen was given in the matching
//! fixture state, and the parity capture draws a screen mod as the window places it (in flow at
//! the reference's size, floating on the backdrop of a 1280 x 800 window), doing the fixture's
//! steps as real events, into the reference's schema.
//!
//! Offscreen: no window is shown or focused, no core runs, and every event goes through the
//! window's own dispatch. The mods are tiny user mods the test writes, not ports.

#[path = "common/parity.rs"]
mod parity;
#[path = "common/parity_screens.rs"]
mod parity_screens;

use futures::channel::mpsc::unbounded;
use gpui::{
    point, px, size, AppContext as _, Modifiers, MouseButton, MouseDownEvent, MouseUpEvent,
    PlatformInput, Window, WindowHandle,
};
use parity_screens::ScreenFixture;
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::sidebar::{Alert, Heard, Toast};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

const PLAIN: &str = r##"
import { View, div } from "gpui-kit";
export default class extends View {
  render() { return div().id("screen-root").size_full().bg("#303030"); }
}
"##;

/// In flow: the status bar, its folder's text as the status line has it.
const STATUS: &str = r##"
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const line = perch.statusLine();
    return h_flex().id("status-bar").size_full().bg("#161616")
      .child(div().id("status-dot").w(6).h(6).bg(line.connected ? "#7fb685" : "#d3b46a"))
      .child(div().id("status-cwd").w(4 * line.cwd.length).h(12).child(line.cwd));
  }
}
"##;

/// Floating: the Navigator over the whole window, placing its panel as the web's does (12% of the
/// window down, centred), whose field takes the keys typed into it once clicked.
const NAVIGATOR: &str = r##"
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  init(props, cx) { this.field = cx.focus_handle(); this.query = ""; }
  render() {
    const p = perch.props();
    return v_flex().id("navigator-scrim").size_full().items_center()
      .pt(Math.round(p.viewport.height * 0.12))
      .child(this.panel(p));
  }
  panel(p) {
    return v_flex().id("navigator-panel").w(560).h(320).bg("#202020")
      .child(div().id("navigator-input").track_focus(this.field)
        .w(10 + 10 * this.query.length).h(30).bg("#333333")
        .on_click(() => this.field.focus())
        .on_key_down((event, cx) => {
          if (event.key_char) { this.query += event.key_char; cx.notify(); }
        }))
      .child(div().id("navigator-list").w(100).h(10 * p.sessions.length).bg("#444444"));
  }
}
"##;

const WIDTH: f32 = 1280.;
const HEIGHT: f32 = 800.;

/// Fields the window adds to a floating screen's props: the window's size, which the web reads
/// from `window.innerWidth`/`innerHeight` rather than a prop.
const VIEWPORT: &str = "viewport";

/// Every field path of `web` that `native` lacks and of `native` that `web` lacks, less the
/// `allowed` paths (each with its reason, which the caller states).
fn field_differences(web: &Value, native: &Value, allowed: &[&str]) -> Vec<String> {
    let (mut a, mut b) = (BTreeSet::new(), BTreeSet::new());
    parity_screens::shape("", web, &mut a);
    parity_screens::shape("", native, &mut b);
    let allowed = |path: &String| {
        allowed.iter().any(|p| {
            let p = format!(".{p}");
            *path == p || path.starts_with(&format!("{p}.")) || path.starts_with(&format!("{p}["))
        })
    };
    let missing = a.difference(&b).filter(|p| !allowed(p));
    let extra = b.difference(&a).filter(|p| !allowed(p));
    missing
        .map(|p| format!("web only: {p}"))
        .chain(extra.map(|p| format!("native only: {p}")))
        .collect()
}

struct Rig {
    cx: gpui::HeadlessAppContext,
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

    fn draw(&mut self) {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
    }

    fn props(&mut self, id: &str) -> Value {
        self.draw();
        self.ws(|ws, _, _| ws.screen_props(id).cloned())
            .unwrap_or_else(|| panic!("{id} is open"))
    }

    fn close_all(&mut self) {
        while !self.ws(|ws, _, _| ws.screens_open()).is_empty() {
            let id = self.ws(|ws, _, _| ws.screens_open()[0]);
            if id == "toast" {
                self.ws(|ws, window, cx| {
                    let ids: Vec<String> =
                        ws.notifications().iter().map(|n| n.id.clone()).collect();
                    for id in ids {
                        ws.run_command(
                            "notification.dismiss",
                            Some(&json!({ "id": id })),
                            window,
                            cx,
                        )
                        .unwrap();
                    }
                });
            } else {
                self.ws(|ws, window, cx| ws.screen_closed(id, Value::Null, window, cx));
            }
            self.draw();
        }
    }

    fn right_click(&mut self, x: f32, y: f32) {
        let position = point(px(x), px(y));
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button: MouseButton::Right,
                        position,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button: MouseButton::Right,
                        position,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }
}

fn write_mod(dir: &Path, id: &str, text: &str) {
    std::fs::create_dir_all(dir.join(id)).unwrap();
    std::fs::write(dir.join(id).join("main.js"), text).unwrap();
}

/// The props the window's own openers give the screen mods, against the web's.
fn openers_give_the_web_fields(scratch: &Path) {
    let user = scratch.join("native-mods");
    for id in ["navigator", "pane-menu", "confirm", "toast", "new-session"] {
        write_mod(&user, id, PLAIN);
    }
    let navigator = ScreenFixture::load("navigator");
    let data = navigator.data("empty-query");
    let model = parity_screens::model_from(&data);
    let mut cx = parity_screens::headless();
    let (tx, _asked) = unbounded();
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
    assert!(cx.update(|cx| cx.has_global::<WindowMods>()));
    let mut rig = Rig { cx, window };
    // The fixture's shown session, then the one the pane menu is opened on, as tabs.
    for id in ["s-perch-1", "s-perch-2"] {
        rig.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id.into(), Some("claude".into()), cx)
            })
        });
    }
    rig.draw();
    let mut failures = Vec::new();
    let mut check = |what: &str, web: &Value, native: &Value, allowed: &[&str]| {
        let found = field_differences(web, native, allowed);
        if !found.is_empty() {
            failures.push(format!("{what}:\n  {}", found.join("\n  ")));
        }
    };

    // The palette key opens the Navigator with what the web's Navigator route builds.
    rig.ws(|ws, _, _| assert!(ws.screens_open().is_empty()));
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            window.dispatch_keystroke(gpui::Keystroke::parse("cmd-p").unwrap(), cx)
        })
        .unwrap();
    let native = rig.props("navigator");
    let web = navigator.expected("empty-query")["props"].clone();
    check("navigator (palette key)", &web, &native, &[VIEWPORT]);
    assert_eq!(
        native["viewport"],
        json!({ "width": WIDTH, "height": HEIGHT })
    );
    // The values the window derives from the same data, as the web derives them; the agents and
    // what the native Navigator can do are its own (no file search, no run).
    for key in ["sessions", "connected", "workspace"] {
        assert_eq!(native[key], web[key], "navigator {key}");
    }
    rig.close_all();

    // A right-click in a pane opens the pane menu on it.
    rig.right_click(WIDTH - 200., HEIGHT / 2.);
    let native = rig.props("pane-menu");
    let web = ScreenFixture::load("pane-menu").expected("agent-pane")["props"].clone();
    // `items`: the native menu's own entries, which a mod may list as they are.
    check(
        "pane-menu (right-click)",
        &web,
        &native,
        &["items", VIEWPORT],
    );
    for key in ["panelId", "title", "canClose", "maximized"] {
        assert_eq!(native[key], web[key], "pane-menu {key}");
    }
    rig.close_all();

    // The close guard asks through the confirmation for an agent's terminal.
    let (to_core, _to) = unbounded::<ToCore>();
    let (core, from_core) = unbounded::<FromCore>();
    rig.ws(|ws, _, cx| {
        let view = ws.terminal().expect("a terminal").clone();
        view.update(cx, |view, cx| view.link(to_core, from_core, cx))
    });
    core.unbounded_send(FromCore::Attached {
        replay: String::new(),
        input: true,
        resize: true,
        agent: None,
    })
    .unwrap();
    rig.draw();
    rig.ws(|ws, window, cx| ws.run_command("tabs.close", None, window, cx))
        .unwrap();
    let native = rig.props("confirm");
    // The close guard's props (`CloseGuardProps`), as its web state opens it; the confirmation's
    // own states are for other callers. `sessionId`: `CloseGuardProps` has it; the fixture,
    // which draws no session, leaves it out.
    let web = ScreenFixture::load("confirm").expected("close-agent")["props"].clone();
    check(
        "confirm (close guard)",
        &web,
        &native,
        &["sessionId", VIEWPORT],
    );
    assert_eq!(native["sessionId"], "s-perch-2");
    rig.close_all();

    // A notification puts up the toast, with no props but the window's size: it reads
    // `notifications()`.
    rig.ws(|ws, _, cx| {
        ws.toast(
            Heard {
                alert: Alert::Done,
                session_id: "s-perch-2".into(),
                title: "Fix terminal slash input".into(),
                sound: false,
                file: None,
                toast: Toast::App,
                body: None,
            },
            cx,
        )
    });
    let native = rig.props("toast");
    assert_eq!(
        native,
        json!({ "viewport": { "width": WIDTH, "height": HEIGHT } }),
        "the toast takes no props"
    );
    let item = rig.cx.update(|cx| {
        let ws = workspace.read(cx);
        let model = ws.sidebar().read(cx).model();
        perch_native::mods::perch::notification_json(&ws.notifications()[0], model)
    });
    let web = ScreenFixture::load("toast").expected("done")["notifications"][0].clone();
    check("toast item (notification)", &web, &item, &[]);
    rig.close_all();

    // New quickchat opens the unscoped New session panel (the sidebar's New is the launcher).
    rig.ws(|ws, window, cx| ws.run_command("nests.scratchpad", None, window, cx))
        .unwrap();
    let native = rig.props("new-session");
    let web = ScreenFixture::load("new-session").expected("unscoped")["props"].clone();
    check("new-session (sidebar's New)", &web, &native, &[VIEWPORT]);
    // The folders differ by design: the web's callers offer one project (a project row's +) or
    // none, and this fixture state lists three by hand; the native sidebar's New offers every
    // project the host can start in.
    assert_eq!(native["hostId"], web["hostId"]);
    rig.close_all();

    assert!(failures.is_empty(), "{}", failures.join("\n"));
    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
}

/// The capture helper with a tiny mod per kind: in flow (the status bar) and floating (the
/// Navigator, with its typed query as real key events).
fn captures_a_screen_as_the_window_places_it(scratch: &Path) {
    let user = scratch.join("capture-mods");
    write_mod(&user, "status", STATUS);
    write_mod(&user, "navigator", NAVIGATOR);
    let out = scratch.join("native");
    let mut cx = parity_screens::headless();

    let status = ScreenFixture::load("status");
    let shot = parity_screens::capture(
        &mut cx,
        &parity_screens::ScreenCapture {
            fixture: &status,
            state: "long-path",
            theme: parity::Theme::Dark,
            mods: Some(&user),
            out: &out,
        },
    );
    let report = &shot.report;
    assert_eq!(
        (
            &report["schema"],
            &report["screen"],
            &report["state"],
            &report["theme"]
        ),
        (
            &json!("perch-native-parity/1"),
            &json!("status"),
            &json!("long-path"),
            &json!("dark")
        )
    );
    assert_eq!(report["tokens"].as_object().unwrap().len(), 18);
    let element = |report: &Value, name: &str| -> Value {
        report["elements"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["name"] == name)
            .cloned()
            .unwrap_or_else(|| panic!("{name} in {}", report["elements"]))
    };
    assert_eq!(
        element(report, "status-bar")["box"],
        json!({ "x": 0.0, "y": 0.0, "width": 1280.0, "height": 24.0 }),
        "the reference's render size"
    );
    let cwd = status.data("long-path")["status"]["cwd"]
        .as_str()
        .unwrap()
        .len();
    assert_eq!(
        element(report, "status-cwd")["box"]["width"],
        json!(4. * cwd as f64),
        "the state's data reached the mod"
    );
    let png = image::open(&shot.png).expect("the PNG").into_rgba8();
    assert_eq!(png.dimensions(), (2560, 48), "at scale 2");
    assert!(shot.json.ends_with("status.long-path.dark.json"));

    let navigator = ScreenFixture::load("navigator");
    let shot = parity_screens::capture(
        &mut cx,
        &parity_screens::ScreenCapture {
            fixture: &navigator,
            state: "searching",
            theme: parity::Theme::Light,
            mods: Some(&user),
            out: &out,
        },
    );
    let report = &shot.report;
    assert_eq!(
        element(report, "navigator-scrim")["box"],
        json!({ "x": 0.0, "y": 0.0, "width": WIDTH, "height": HEIGHT }),
        "over the whole window"
    );
    assert_eq!(
        element(report, "navigator-panel")["box"],
        json!({ "x": 360.0, "y": 96.0, "width": 560.0, "height": 320.0 }),
        "where the mod puts its panel from the viewport, as the web's: in window coordinates"
    );
    // The state's step typed "perch" into the field: five keys, each a real event.
    assert_eq!(
        element(report, "navigator-input")["box"]["width"],
        json!(60.0)
    );
    let sessions = navigator.props("searching").unwrap()["sessions"]
        .as_array()
        .unwrap()
        .len();
    assert_eq!(
        element(report, "navigator-list")["box"]["height"],
        json!(10. * sessions as f64),
        "the fixture's props"
    );
    let png = image::open(&shot.png).expect("the PNG").into_rgba8();
    assert_eq!(png.dimensions(), (2560, 1600));
    // The backdrop is the light theme's, outside the screen's box.
    let backdrop = report["tokens"]["backdrop"].as_str().unwrap().to_string();
    let corner = png.get_pixel(4, 4).0;
    assert_eq!(
        format!(
            "#{:02x}{:02x}{:02x}{:02x}",
            corner[0], corner[1], corner[2], corner[3]
        ),
        backdrop
    );
}

/// The capture names a face the way the web asks for it, one name for one request: the app's
/// stack, a form control's bare `system-ui` and the monospace stack stay apart, and any other
/// family is reported as GPUI drew it, so a wrong face still fails the family check.
fn family_names_are_exact() {
    assert_eq!(
        parity::web_family(".SystemUIFont"),
        "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    );
    assert_eq!(parity::web_family(".AppleSystemUIFont"), "system-ui");
    assert_eq!(
        parity::web_family("Menlo"),
        "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
    );
    for other in ["Helvetica", "system-ui", "IBM Plex Sans", ""] {
        assert_eq!(parity::web_family(other), other, "{other:?} is not renamed");
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-mods-screen-capture-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));

    family_names_are_exact();
    openers_give_the_web_fields(&scratch);
    captures_a_screen_as_the_window_places_it(&scratch);

    if let Some(dir) = std::env::var_os("PERCH_PARITY_KEEP") {
        let _ = std::fs::create_dir_all(&dir);
        for entry in std::fs::read_dir(scratch.join("native")).unwrap().flatten() {
            let _ = std::fs::copy(entry.path(), Path::new(&dir).join(entry.file_name()));
        }
    }
    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_screen_capture: ok");
}
