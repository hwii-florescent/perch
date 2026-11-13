//! The native side of the parity check: a mod drawn from a parity fixture's state, written as the
//! web reference writes itself (`<screen>.<state>.<theme>.png` and `.json`, schema
//! `perch-native-parity/1`), so `e2e/native-parity/compare.mjs` can hold the two together.
//!
//! The fixture's data is fed to the sidebar's own reducer as the core's messages would carry it
//! (no core runs), so what a mod reads through `perch` is what the window would show.
//!
//! ```ignore
//! #[path = "common/parity.rs"]
//! mod parity;
//! let fixture = parity::Fixture::load(&parity::fixture_path("sidebar"));
//! let shot = parity::capture(&mut cx, &parity::Capture {
//!     mod_id: "sidebar", fixture: &fixture, state: "by-project", theme: parity::Theme::Dark,
//!     out: &parity::native_dir(),
//! });
//! ```
//!
//! Elements are what the mod names with `.id(...)`: `name`, or `name:key` for one of many. An id that starts with
//! `~` is not an element: a mod that needs ids for handlers on unnamed nodes (the React runtime) marks them so.
//! GPUI's system UI face (`.SystemUIFont`) is written as the web serialises the app's UI font stack
//! ([`UI_FONT_STACK`]), which is the face both draw with.

#![allow(dead_code)]

use gpui::{
    point, px, size, HeadlessAppContext, Hsla, Modifiers, MouseMoveEvent, Pixels, PlatformInput,
    Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::mods::perch::{Perch, SidebarSettings};
use perch_native::mods::theme;
use perch_native::mods::ModHost;
use perch_native::sidebar::State;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

pub const SCHEMA: &str = "perch-native-parity/1";

/// WebKit's serialisation of the app's `--font-ui` stack, the macOS system UI face (San Francisco).
pub const UI_FONT_STACK: &str =
    "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif";

/// A font family as the web reference writes it.
fn family(name: &str) -> String {
    if name == ".SystemUIFont" {
        UI_FONT_STACK.into()
    } else {
        name.into()
    }
}

/// The repository's `e2e/native-parity/`.
pub fn parity_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../e2e/native-parity")
}

pub fn fixture_path(screen: &str) -> PathBuf {
    parity_dir().join("fixtures").join(format!("{screen}.json"))
}

/// Where native renderings go, beside the web's `artifacts-native-parity/web/`.
pub fn native_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../e2e/artifacts-native-parity/native")
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Theme {
    /// `perch`, the app's default.
    Dark,
    /// `catppuccin-latte`.
    Light,
}

impl Theme {
    pub fn word(self) -> &'static str {
        match self {
            Theme::Dark => "dark",
            Theme::Light => "light",
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Theme::Dark => "perch",
            Theme::Light => "catppuccin-latte",
        }
    }
}

/// A parity fixture (`perch-native-parity-fixture/1`).
pub struct Fixture(pub Value);

impl Fixture {
    pub fn load(path: &Path) -> Self {
        let text = std::fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("reading {}: {e}", path.display()));
        Self(serde_json::from_str(&text).expect("the fixture is JSON"))
    }

    pub fn screen(&self) -> &str {
        self.0["screen"]
            .as_str()
            .expect("the fixture names its screen")
    }

    pub fn states(&self) -> Vec<String> {
        self.0["states"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|s| s["id"].as_str().map(str::to_string))
            .collect()
    }

    fn state(&self, id: &str) -> &Value {
        self.0["states"]
            .as_array()
            .and_then(|list| list.iter().find(|s| s["id"] == id))
            .unwrap_or_else(|| panic!("the fixture has no state {id}"))
    }

    /// The store's data for state `id`: the base data with the state's patch over it (sessions
    /// and host states merged by id, every other key replaced).
    pub fn data(&self, id: &str) -> Value {
        let mut data = self.0["data"].clone();
        let patch = self.state(id)["patch"]
            .as_object()
            .cloned()
            .unwrap_or_default();
        for (key, value) in patch {
            match key.as_str() {
                "sessions" => {
                    let changes = value.as_object().cloned().unwrap_or_default();
                    for session in data["sessions"].as_array_mut().into_iter().flatten() {
                        let Some(change) = session["id"].as_str().and_then(|id| changes.get(id))
                        else {
                            continue;
                        };
                        for (field, v) in change.as_object().into_iter().flatten() {
                            session[field] = v.clone();
                        }
                    }
                }
                "hostStates" => {
                    for (host, state) in value.as_object().into_iter().flatten() {
                        data["hostStates"][host] = state.clone();
                    }
                }
                _ => data[key.as_str()] = value,
            }
        }
        data
    }

    /// The sidebar's view settings in state `id`.
    pub fn view(&self, id: &str) -> SidebarSettings {
        let view = &self.state(id)["view"];
        let mut settings = SidebarSettings::default();
        if let Some(word) = view["organize"].as_str() {
            settings.organize = word.into();
        }
        settings.sort_by_attention = view["sortByAttention"].as_bool().unwrap_or(true);
        settings.show_terminals = view["showTerminals"].as_bool().unwrap_or(false);
        settings.collapsed_projects = view["collapsedProjects"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect();
        settings
    }

    /// The fixture's logical size, and the window's.
    pub fn size(&self) -> ((f32, f32), (f32, f32)) {
        let pair = |v: &Value| {
            (
                v["width"].as_f64().unwrap_or(240.) as f32,
                v["height"].as_f64().unwrap_or(800.) as f32,
            )
        };
        (pair(&self.0["size"]), pair(&self.0["window"]))
    }
}

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value.clone()).unwrap_or_else(|e| panic!("{value}: {e}"))
}

/// The sidebar's state after the core's messages for `data` (a fixture's store data).
pub fn state_from(data: &Value) -> State {
    let mut state = State::default();
    state.connect();
    if data["connected"] == false {
        state.disconnect(None);
    }
    let text = |v: &Value| v.as_str().unwrap_or_default().to_string();
    let mut info = data["serverInfo"].clone();
    info["capabilities"] = data["workspaceCapabilities"].clone();
    state.apply(&message(info));
    if data["status"].is_object() {
        state.apply(&message(json!({
            "type": "status.update",
            "cwd": text(&data["status"]["cwd"]),
            "branch": text(&data["status"]["branch"]),
        })));
    }
    state.apply(&message(
        json!({ "type": "hosts.list", "hosts": data["hosts"] }),
    ));
    let projects = data["workspaceProjects"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let workspaces = data["workspaces"].as_array().cloned().unwrap_or_default();
    let on = |list: &[Value], host: &str| -> Vec<Value> {
        list.iter()
            .filter(|v| v["hostId"] == host)
            .cloned()
            .collect()
    };
    let mut hosts = vec!["local".to_string()];
    for (id, facts) in data["hostStates"].as_object().into_iter().flatten() {
        let mut facts = facts.clone();
        if let Some(caps) = data["workspaceCapabilitiesByHost"].get(id) {
            facts["capabilities"] = caps.clone();
        }
        state.apply(&message(facts));
        hosts.push(id.clone());
    }
    for host in &hosts {
        state.apply(&message(json!({
            "type": "project.list", "requestId": "fixture", "hostId": host,
            "snapshotEpoch": "fixture", "snapshotRevision": 1,
            "projects": on(&projects, host),
        })));
        if data["workspaceSnapshotByHost"][host]["state"] == "ready" {
            state.apply(&message(json!({
                "type": "workspace.snapshot", "requestId": "fixture", "hostId": host,
                "snapshotEpoch": "fixture", "snapshotRevision": 1,
                "projects": on(&projects, host), "workspaces": on(&workspaces, host),
            })));
        }
    }
    state.apply(&message(
        json!({ "type": "session.list", "sessions": data["sessions"] }),
    ));
    if let Some(id) = data["sessionId"].as_str() {
        state.view(id);
    }
    state
}

/// Publishes fixture state `id` to `perch`: the store, what is on screen and the sidebar's view.
pub fn publish(perch: &Perch, fixture: &Fixture, id: &str) {
    let data = fixture.data(id);
    perch.set_model(state_from(&data).model());
    let text = |key: &str| data[key].as_str().map(str::to_string);
    perch.set_active(
        text("activeHostId"),
        text("sessionId"),
        text("activeWorkspaceId"),
    );
    perch.set_sidebar(fixture.view(id));
}

/// One rendering to make.
pub struct Capture<'a> {
    pub mod_id: &'a str,
    pub fixture: &'a Fixture,
    pub state: &'a str,
    pub theme: Theme,
    pub out: &'a Path,
}

/// What [`capture`] wrote.
pub struct Shot {
    pub png: PathBuf,
    pub json: PathBuf,
    pub report: Value,
}

/// `#rrggbbaa`, lower case.
pub fn rgba(color: Hsla) -> String {
    let c = color.to_rgb();
    let byte = |v: f32| (v.clamp(0., 1.) * 255.).round() as u8;
    format!(
        "#{:02x}{:02x}{:02x}{:02x}",
        byte(c.r),
        byte(c.g),
        byte(c.b),
        byte(c.a)
    )
}

/// The token whose colour `value` is (any alpha), else null.
fn token_of(value: &str, tokens: &Map<String, Value>) -> Value {
    tokens
        .iter()
        .find(|(_, t)| t.as_str().is_some_and(|t| t[..7] == value[..7]))
        .map_or(Value::Null, |(name, _)| json!(name))
}

fn colour(color: Hsla, tokens: &Map<String, Value>) -> Value {
    let value = rgba(color);
    json!({ "token": token_of(&value, tokens), "value": value })
}

fn round(v: Pixels) -> f64 {
    (f64::from(f32::from(v)) * 100.).round() / 100.
}

/// The element entries for the probe's records, in schema order: by name, then top to bottom.
pub fn elements(
    records: impl IntoIterator<Item = ProbeRecord>,
    tokens: &Map<String, Value>,
    text_sized: &dyn Fn(&str) -> bool,
) -> Vec<Value> {
    let mut list: Vec<(String, Option<String>, ProbeRecord)> = records
        .into_iter()
        .filter(|r| !r.name.starts_with('~'))
        .map(|r| {
            let (name, key) = match r.name.split_once(':') {
                Some((name, key)) => (name.to_string(), Some(key.to_string())),
                None => (r.name.to_string(), None),
            };
            (name, key, r)
        })
        .collect();
    list.sort_by(|a, b| {
        (
            a.0.as_str(),
            f32::from(a.2.bounds.origin.y),
            f32::from(a.2.bounds.origin.x),
        )
            .partial_cmp(&(
                b.0.as_str(),
                f32::from(b.2.bounds.origin.y),
                f32::from(b.2.bounds.origin.x),
            ))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut index = std::collections::HashMap::<String, usize>::new();
    list.into_iter()
        .map(|(name, key, r)| {
            let at = index.entry(name.clone()).or_default();
            let mut colors = Map::new();
            colors.insert("color".into(), colour(r.text_color, tokens));
            if let Some(bg) = r.background.filter(|c| c.a > 0.) {
                colors.insert("backgroundColor".into(), colour(bg, tokens));
            }
            if let Some(border) = r.border_color {
                let sides = ["Top", "Right", "Bottom", "Left"];
                for (side, width) in sides.iter().zip(r.border_widths) {
                    if width > px(0.) {
                        colors.insert(format!("border{side}Color"), colour(border, tokens));
                    }
                }
            }
            let mut element = json!({
                "name": name,
                "key": key,
                "index": *at,
                "box": {
                    "x": round(r.bounds.origin.x), "y": round(r.bounds.origin.y),
                    "width": round(r.bounds.size.width), "height": round(r.bounds.size.height),
                },
                "textSized": text_sized(&name),
                "colors": colors,
                "font": {
                    "family": family(&r.font_family),
                    "size": round(r.font_size),
                    "weight": r.font_weight.0,
                    "lineHeight": round(r.line_height),
                    "lineHeightNormal": false,
                },
            });
            if let Some(opacity) = r.opacity.filter(|o| *o < 1.) {
                element["opacity"] = json!(opacity);
            }
            *at += 1;
            element
        })
        .collect()
}

/// Names `named-elements.json` marks as sized by their text, for `screen`.
fn text_sized_names(screen: &str) -> Vec<String> {
    let path = parity_dir().join("named-elements.json");
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let table: Value = serde_json::from_str(&text).unwrap_or_default();
    table["screens"][screen]["elements"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|e| e["textSized"] == true)
        .filter_map(|e| e["name"].as_str().map(str::to_string))
        .collect()
}

/// Draws mod `mod_id` with the fixture state's data and theme at the fixture's logical size and
/// scale 2, and writes `<screen>.<state>.<theme>.png` and `.json` into `out`.
pub fn capture(cx: &mut HeadlessAppContext, capture: &Capture) -> Shot {
    let screen = capture.fixture.screen().to_string();
    let ((width, height), (window_w, window_h)) = capture.fixture.size();
    let scratch = std::env::temp_dir().join(format!(
        "perch-parity-{}-{}-{}",
        std::process::id(),
        capture.state,
        capture.theme.word()
    ));
    let _ = std::fs::remove_dir_all(&scratch);
    let host = ModHost::new(scratch.join("native-mods")).expect("the mod host starts");
    let perch = Perch::new();
    perch.register(&host);
    publish(&perch, capture.fixture, capture.state);
    perch.set_theme(capture.theme.name());
    cx.update(|cx| perch.flush(cx));

    let window = cx
        .open_window(size(px(width), px(height)), |window, cx| {
            host.view(capture.mod_id, window, cx)
        })
        .expect("an offscreen window");
    let view = window.entity(&*cx).unwrap();
    let (image, scale) = cx
        .update_window(window.into(), |_, window: &mut Window, cx| {
            // The pointer starts at the window's top left, which would hover what is drawn there; the web
            // reference is drawn with no pointer over it.
            window.dispatch_event(
                PlatformInput::MouseMove(MouseMoveEvent {
                    position: point(px(-1.), px(-1.)),
                    pressed_button: None,
                    modifiers: Modifiers::default(),
                }),
                cx,
            );
            probe::clear();
            window.refresh();
            let _ = window.draw(cx);
            (
                window.render_to_image().expect("offscreen render"),
                window.scale_factor(),
            )
        })
        .unwrap();
    let error = cx.update(|cx| view.read(cx).error(cx));
    assert_eq!(error, None, "mod {} draws", capture.mod_id);
    assert_eq!(scale, 2., "drawn at scale 2");

    let resolved = theme::resolve(capture.theme.name());
    let tokens: Map<String, Value> = theme::TOKENS
        .iter()
        .zip(resolved.tokens.iter())
        .map(|(name, value)| (name.to_string(), json!(format!("{value}ff"))))
        .collect();
    let sized = text_sized_names(&screen);
    let report = json!({
        "schema": SCHEMA,
        "screen": screen,
        "state": capture.state,
        "theme": capture.theme.word(),
        "renderer": "perch-native gpui",
        "mod": capture.mod_id,
        "size": { "width": width, "height": height, "scale": scale },
        "window": { "width": window_w, "height": window_h },
        "tokens": tokens,
        "elements": elements(probe::records().into_values(), &tokens, &|n| {
            sized.iter().any(|s| s == n)
        }),
        "hiddenCounts": {},
    });

    std::fs::create_dir_all(capture.out).expect("the output folder");
    let stem = format!("{screen}.{}.{}", capture.state, capture.theme.word());
    let png = capture.out.join(format!("{stem}.png"));
    let json_path = capture.out.join(format!("{stem}.json"));
    image.save(&png).expect("the PNG is written");
    std::fs::write(
        &json_path,
        serde_json::to_string_pretty(&report).unwrap() + "\n",
    )
    .expect("the JSON is written");

    cx.update_window(window.into(), |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    Shot {
        png,
        json: json_path,
        report,
    }
}
