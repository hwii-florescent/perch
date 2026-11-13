//! The parity check for the chrome screens (tabs, status bar, Navigator, pane header and menu,
//! confirmation, dialog, notifications, New session): a screen fixture read the way the web
//! reference reads it, its state fed to the Rust models as the core's messages and the window's
//! state, what the `perch` module derives from that compared with what the web screen was fed
//! (`fixtures/sdk/<screen>.<state>.json`), and a screen mod drawn as the window places it and
//! written in the reference's schema for `compare.mjs`.
//!
//! The test crate declares both files:
//!
//! ```ignore
//! #[path = "common/parity.rs"]
//! mod parity;
//! #[path = "common/parity_screens.rs"]
//! mod parity_screens;
//!
//! let fixture = parity_screens::ScreenFixture::load("status");
//! let mut cx = parity_screens::headless();
//! let shot = parity_screens::capture(&mut cx, &parity_screens::ScreenCapture {
//!     fixture: &fixture, state: "connected", theme: parity::Theme::Dark,
//!     mods: None, // the stock mod; or Some(dir) holding `<dir>/status/main.js`
//!     out: &parity::native_dir(),
//! });
//! // then: node e2e/native-parity/compare.mjs --web-dir e2e/artifacts-native-parity/web \
//! //         --native-dir e2e/artifacts-native-parity/native
//! ```

#![allow(dead_code)]

use super::parity::{self, Theme};
use gpui::{
    div, point, px, size, AppContext as _, HeadlessAppContext, IntoElement, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, ParentElement, PlatformInput,
    Render, Styled, Window,
};
use gpui_shell::probe::{self, ProbeRecord};
use gpui_shell::HostArguments;
use perch_native::mods::perch::{
    from_host, inbound_items, notification_json, tab_menu_props, to_host, workspace_mates, Perch,
    WindowState,
};
use perch_native::mods::screens::{self, Place};
use perch_native::mods::{theme, ModHost, ModView};
use perch_native::sidebar::{Alert, Heard, Model, Request, Toast};
use perch_native::tabs::Tabs;
use perch_native::workspace::{Notice, Notification};
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// A screen's parity fixture, with the sidebar's data under it when it says `dataFrom`.
pub struct ScreenFixture {
    pub screen: String,
    raw: Value,
    data: Value,
}

impl ScreenFixture {
    pub fn load(screen: &str) -> Self {
        let raw = parity::Fixture::load(&parity::fixture_path(screen)).0;
        let mut data = match raw["dataFrom"].as_str() {
            Some(from) => parity::Fixture::load(&parity::fixture_path(from)).0["data"].clone(),
            None => json!({}),
        };
        for (key, value) in raw["data"].as_object().into_iter().flatten() {
            data[key.as_str()] = value.clone();
        }
        Self {
            screen: screen.to_string(),
            raw,
            data,
        }
    }

    pub fn states(&self) -> Vec<String> {
        self.raw["states"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|s| s["id"].as_str().map(str::to_string))
            .collect()
    }

    fn state(&self, id: &str) -> &Value {
        self.raw["states"]
            .as_array()
            .and_then(|list| list.iter().find(|s| s["id"] == id))
            .unwrap_or_else(|| panic!("{} has no state {id}", self.screen))
    }

    /// The store's data in state `id`: the patch over the data (`sessions` and `hostStates`
    /// merged by id, `keepSessions` and `addSessions` applied, every other key replaced).
    pub fn data(&self, id: &str) -> Value {
        let mut data = self.data.clone();
        let patch = self.state(id)["patch"]
            .as_object()
            .cloned()
            .unwrap_or_default();
        for (key, value) in patch {
            match key.as_str() {
                "sessions" => {
                    for session in data["sessions"].as_array_mut().into_iter().flatten() {
                        let Some(change) = session["id"].as_str().and_then(|id| value.get(id))
                        else {
                            continue;
                        };
                        for (field, v) in change.as_object().into_iter().flatten() {
                            session[field] = v.clone();
                        }
                    }
                }
                "keepSessions" => {
                    let keep = value.as_array().cloned().unwrap_or_default();
                    if let Some(list) = data["sessions"].as_array_mut() {
                        list.retain(|s| keep.contains(&s["id"]));
                    }
                }
                "addSessions" => {
                    let more = value.as_array().cloned().unwrap_or_default();
                    if let Some(list) = data["sessions"].as_array_mut() {
                        list.extend(more);
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

    /// The props in state `id`: the fixture's with the state's over them (a null removes one).
    /// None for a screen that takes none.
    pub fn props(&self, id: &str) -> Option<Value> {
        let base = self.raw.get("props");
        let over = self.state(id).get("props");
        if base.is_none() && over.is_none() {
            return None;
        }
        let mut props = base.cloned().unwrap_or_else(|| json!({}));
        for (key, value) in over.and_then(Value::as_object).into_iter().flatten() {
            match value {
                Value::Null => {
                    props.as_object_mut().unwrap().remove(key);
                }
                _ => props[key.as_str()] = value.clone(),
            }
        }
        Some(props)
    }

    /// What the person does on the way to state `id` (`type`, `key`, `click`).
    pub fn steps(&self, id: &str) -> Vec<Value> {
        self.state(id)["steps"]
            .as_array()
            .cloned()
            .unwrap_or_default()
    }

    /// The screen's logical size in state `id`, and the window's.
    pub fn size(&self, id: &str) -> ((f32, f32), (f32, f32)) {
        let pick = |key: &str| {
            let v = self.state(id).get(key).unwrap_or(&self.raw[key]);
            (
                v["width"].as_f64().unwrap_or(1280.) as f32,
                v["height"].as_f64().unwrap_or(800.) as f32,
            )
        };
        (pick("size"), pick("window"))
    }

    /// What the web screen was fed in state `id`.
    pub fn expected(&self, id: &str) -> Value {
        let path = parity::parity_dir()
            .join("fixtures/sdk")
            .join(format!("{}.{id}.json", self.screen));
        let text = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("reading {}: {e}", path.display()));
        serde_json::from_str(&text).expect("the sdk file is JSON")
    }
}

fn message(value: Value) -> perch_core::protocol::ServerMessage {
    serde_json::from_value(value.clone()).unwrap_or_else(|e| panic!("{value}: {e}"))
}

/// The Rust model after the core's messages for `data`. The web store keeps `server.info`'s
/// capabilities and the workspace ones apart; the core sends them as one list.
pub fn model_from(data: &Value) -> Model {
    let mut fed = data.clone();
    let mut capabilities: Vec<Value> = data["workspaceCapabilities"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    for c in data["serverInfo"]["capabilities"]
        .as_array()
        .into_iter()
        .flatten()
    {
        if !capabilities.contains(c) {
            capabilities.push(c.clone());
        }
    }
    fed["workspaceCapabilities"] = json!(capabilities);
    let mut state = parity::state_from(&fed);
    if data["status"].is_object() {
        let mut update = data["status"].clone();
        update["type"] = json!("status.update");
        for key in ["cwd", "branch"] {
            if !update[key].is_string() {
                update[key] = json!("");
            }
        }
        state.apply(&message(update));
    }
    // Plan usage as the web's store holds it (`usage.result` as it came, received when the
    // store says). The fixture's spend predates the core's `unpriced`, so it is kept as JSON,
    // as the web keeps it.
    if data["usage"].as_array().is_some_and(|a| !a.is_empty()) {
        let at = data["usageUpdatedAt"].as_u64().unwrap_or(0);
        state.usage_result(data["usage"].clone(), data["spend"].clone(), at);
    }
    // A host's agent list as the core answered it. A list still loading keeps the last answer
    // and has been asked for again; one that failed was refused when asked.
    for (host, catalog) in data["agentManifestsByHost"]
        .as_object()
        .into_iter()
        .flatten()
    {
        let manifests = catalog["manifests"].as_array().cloned().unwrap_or_default();
        if catalog["state"] == "ready" || !manifests.is_empty() {
            let mut reply = json!({
                "type": "agent.manifest.list", "requestId": "fixture", "manifests": manifests,
            });
            if host != "local" {
                reply["hostId"] = json!(host);
            }
            state.apply(&message(reply));
        }
        let ask = Request::Providers(host.clone());
        match catalog["state"].as_str() {
            Some("loading") => state.asked(&ask, "fixture-again"),
            Some("error") => {
                state.asked(&ask, "fixture-again");
                state.apply(&message(json!({
                    "type": "error", "requestId": "fixture-again",
                    "message": catalog["error"].as_str().unwrap_or_default(),
                })));
            }
            _ => {}
        }
    }
    state.model()
}

/// What the window shows in a fixture state: the shown workspace's sessions as its tabs (oldest
/// first), the focused one active, its split beside it unless it is zoomed, the zoom at 100% and
/// the notifications (sessions, usage alerts and mods' `notify`).
pub fn window_from(data: &Value, model: &Model) -> WindowState {
    let active = data["sessionId"].as_str().map(str::to_string);
    let sessions = data["sessions"].as_array().cloned().unwrap_or_default();
    let workspace = data["activeWorkspaceId"]
        .as_str()
        .map(str::to_string)
        .or_else(|| {
            sessions
                .iter()
                .find(|s| s["id"].as_str() == active.as_deref())
                .and_then(|s| s["workspaceId"].as_str().map(str::to_string))
        });
    let mut mine: Vec<&Value> = sessions
        .iter()
        .filter(|s| workspace.is_some() && s["workspaceId"].as_str() == workspace.as_deref())
        .collect();
    mine.sort_by_key(|s| s["createdAt"].as_i64().unwrap_or(0));
    let strip: Vec<String> = mine
        .iter()
        .filter_map(|s| s["id"].as_str().map(str::to_string))
        .collect();
    let zoomed_id = data["splitSets"]["zoomedId"].as_str();
    let set = data["splitSets"]["sets"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|set| {
            set["ids"]
                .as_array()
                .is_some_and(|ids| ids.iter().any(|id| id.as_str() == active.as_deref()))
        });
    let shown: Vec<String> = match (&active, set) {
        (Some(id), _) if zoomed_id == Some(id.as_str()) => vec![id.clone()],
        (Some(_), Some(set)) => set["ids"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|id| id.as_str().map(str::to_string))
            .filter(|id| strip.contains(id))
            .collect(),
        (Some(id), None) => vec![id.clone()],
        (None, _) => Vec::new(),
    };
    let notifications = data["toasts"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|toast| {
            let alert = match toast["kind"].as_str() {
                Some("done") => Alert::Done,
                Some("blocked") => Alert::Blocked,
                Some("usage") => Alert::Usage,
                _ => return None,
            };
            let session_id = toast["sessionId"].as_str()?.to_string();
            let text = |key: &str| toast[key].as_str().map(str::to_string);
            // A mod's `notify` carries its level, icon and action; the core's usage alert and a
            // session's carry none.
            let notice = session_id.starts_with("mod:").then(|| Notice {
                level: text("level"),
                icon: text("icon"),
                action: toast["action"]["command"]
                    .as_str()
                    .map(|c| (c.to_string(), toast["action"].get("args").cloned())),
                timeout: None,
            });
            let note = Notification {
                id: toast["id"].as_str()?.to_string(),
                heard: Heard {
                    alert,
                    session_id,
                    title: text("title").unwrap_or_default(),
                    sound: false,
                    file: None,
                    toast: Toast::App,
                    body: (alert == Alert::Usage).then(|| text("body")).flatten(),
                },
                notice,
            };
            Some(notification_json(&note, model))
        })
        .collect();
    WindowState {
        zoomed: zoomed_id.is_some(),
        strip,
        shown,
        active,
        zoom: 1.,
        notifications,
        new_tab: 0,
        terminals: Default::default(),
    }
}

/// Publishes fixture state `id` to `perch`: the store, what the window shows and the props of
/// the screen (under its own id).
pub fn publish(perch: &Perch, fixture: &ScreenFixture, id: &str) {
    let data = fixture.data(id);
    let model = model_from(&data);
    let window = window_from(&data, &model);
    perch.set_model(model);
    let text = |key: &str| data[key].as_str().map(str::to_string);
    perch.set_active(
        text("activeHostId"),
        text("sessionId"),
        text("activeWorkspaceId"),
    );
    perch.set_window(window);
    // The window's logical size, as the window publishes it (the screen itself is drawn at the
    // state's size).
    let (_, viewport) = fixture.size(id);
    perch.set_viewport(viewport);
    if let Some(props) = fixture.props(id) {
        perch.set_props(&fixture.screen, props);
    }
}

/// What the `perch` module answers for each key of a web `sdk` object (`props` and `steps` are
/// the screen's own and are not asked for). Null for a key the module has no answer to.
pub fn native_sdk(perch: &Perch, expected: &Value, props: Option<&Value>) -> Value {
    let module = perch.module("parity");
    let call = |name: &str, args: Vec<Value>| {
        let args = HostArguments::new(args.iter().map(to_host).collect::<Vec<_>>());
        from_host(
            &module
                .call(name, &args)
                .unwrap_or_else(|e| panic!("{name}: {}", e.message())),
        )
    };
    let mut native = Map::new();
    for key in expected.as_object().into_iter().flatten().map(|(k, _)| k) {
        let value = match key.as_str() {
            "props" | "steps" => continue,
            "workspaceTabs" => call("workspaceTabs", vec![]),
            "statusLine" => call("statusLine", vec![]),
            "zoom" => call("zoom", vec![]),
            "paneLook" => call("paneLook", vec![]),
            "planUsage" => call("planUsage", vec![]),
            "notifications" => call("notifications", vec![])["items"].clone(),
            "agentChoices" => {
                let host = props
                    .and_then(|p| p["hostId"].as_str())
                    .unwrap_or("local")
                    .to_string();
                call("agentChoices", vec![json!(host)])
            }
            _ => Value::Null,
        };
        native.insert(key.clone(), value);
    }
    Value::Object(native)
}

/// One way native differs from web, at a path.
#[derive(Clone, Debug, PartialEq)]
pub struct Difference {
    pub path: String,
    pub web: Value,
    pub native: Value,
}

impl std::fmt::Display for Difference {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}: web {} / native {}",
            self.path, self.web, self.native
        )
    }
}

/// Every path where `native` differs from `web`. A key on one side only is a difference (its
/// missing side is null); lists of different lengths differ as a whole.
pub fn diff(path: &str, web: &Value, native: &Value, out: &mut Vec<Difference>) {
    let mut differ = || {
        out.push(Difference {
            path: path.to_string(),
            web: web.clone(),
            native: native.clone(),
        })
    };
    match (web, native) {
        (Value::Object(a), Value::Object(b)) => {
            for key in a.keys().chain(b.keys().filter(|k| !a.contains_key(*k))) {
                let at = format!("{path}.{key}");
                match (a.get(key), b.get(key)) {
                    (Some(x), Some(y)) => diff(&at, x, y, out),
                    (x, y) => out.push(Difference {
                        path: at,
                        web: x.cloned().unwrap_or(Value::Null),
                        native: y.cloned().unwrap_or(Value::Null),
                    }),
                }
            }
        }
        (Value::Array(a), Value::Array(b)) if a.len() == b.len() => {
            for (i, (x, y)) in a.iter().zip(b).enumerate() {
                diff(&format!("{path}[{i}]"), x, y, out);
            }
        }
        (Value::Number(a), Value::Number(b)) if a.as_f64() == b.as_f64() => {}
        _ if web != native => differ(),
        _ => {}
    }
}

/// Fields the core always sends that a fixture leaves out: a session's `blocked` and `unseen`
/// are false on the wire (serde defaults), so the web reads them absent only in the fixture.
pub fn fill_wire_defaults(sdk: &mut Value) {
    let Some(tabs) = sdk
        .pointer_mut("/workspaceTabs/tabs")
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    for tab in tabs.iter_mut().filter(|t| t["kind"] == "session") {
        for key in ["blocked", "unseen"] {
            if tab.get(key).is_none() {
                tab[key] = json!(false);
            }
        }
    }
}

/// A difference the native client cannot remove: a path (with `[*]` for any index) in some
/// states (`*` for all) of a screen, and why.
pub struct Exception {
    pub screen: &'static str,
    pub states: &'static [&'static str],
    pub path: &'static str,
    pub reason: &'static str,
}

impl Exception {
    pub fn covers(&self, screen: &str, state: &str, path: &str) -> bool {
        self.screen == screen
            && (self.states == ["*"] || self.states.contains(&state))
            && path_matches(self.path, path)
    }
}

/// `pattern` with `[*]` for any index; a pattern covers the paths under it too.
fn path_matches(pattern: &str, path: &str) -> bool {
    let mut rest = path;
    for (i, part) in pattern.split("[*]").enumerate() {
        if i > 0 {
            let Some(close) = rest.strip_prefix('[').and_then(|r| r.find(']')) else {
                return false;
            };
            rest = &rest[close + 2..];
        }
        let Some(after) = rest.strip_prefix(part) else {
            return false;
        };
        rest = after;
    }
    rest.is_empty() || rest.starts_with('.') || rest.starts_with('[')
}

/// The keys of every object in `value`, as paths; a list's items are one shape (`[*]`).
pub fn shape(path: &str, value: &Value, out: &mut std::collections::BTreeSet<String>) {
    match value {
        Value::Object(map) => {
            for (key, v) in map {
                let at = format!("{path}.{key}");
                out.insert(at.clone());
                shape(&at, v, out);
            }
        }
        Value::Array(list) => {
            for v in list {
                shape(&format!("{path}[*]"), v, out);
            }
        }
        _ => {}
    }
}

/// A headless app that draws with the platform's text system, as the window does.
pub fn headless() -> HeadlessAppContext {
    HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    )
}

/// One screen rendering to make.
pub struct ScreenCapture<'a> {
    pub fixture: &'a ScreenFixture,
    pub state: &'a str,
    pub theme: Theme,
    /// A folder of user mods to load the screen's mod from; None for the stock one.
    pub mods: Option<&'a Path>,
    pub out: &'a Path,
}

/// What [`capture`] wrote.
pub struct Shot {
    pub png: PathBuf,
    pub json: PathBuf,
    pub report: Value,
}

/// The window as it holds a screen: in flow, the screen's region alone; floating, the screen
/// over the whole window, on the backdrop.
struct Stage {
    view: gpui::Entity<ModView>,
    backdrop: Option<gpui::Hsla>,
}

impl Render for Stage {
    fn render(&mut self, _: &mut Window, _: &mut gpui::Context<Self>) -> impl IntoElement {
        let stage = div().size_full();
        match self.backdrop {
            Some(backdrop) => stage.bg(backdrop),
            None => stage,
        }
        .child(self.view.clone())
    }
}

/// The key a web step names, as a keystroke.
fn web_key(key: &str) -> String {
    match key {
        "ArrowDown" => "down".into(),
        "ArrowUp" => "up".into(),
        "ArrowLeft" => "left".into(),
        "ArrowRight" => "right".into(),
        "Enter" => "enter".into(),
        "Escape" => "escape".into(),
        "Tab" => "tab".into(),
        "Backspace" => "backspace".into(),
        " " => "space".into(),
        other => other.to_lowercase(),
    }
}

/// The named element (`name` or `name:key`) a web step's selector means: the element whose
/// selector it is, or the one keyed by the tail of the test id it names.
fn named(screen: &str, selector: &str) -> String {
    let table: Value = serde_json::from_str(
        &std::fs::read_to_string(parity::parity_dir().join("named-elements.json")).unwrap(),
    )
    .unwrap();
    let elements = table["screens"][screen]["elements"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if let Some(e) = elements.iter().find(|e| e["selector"] == selector) {
        return e["name"].as_str().unwrap().to_string();
    }
    let test_id = selector
        .strip_prefix("[data-testid=\"")
        .and_then(|s| s.strip_suffix("\"]"))
        .unwrap_or_else(|| panic!("no named element of {screen} is {selector}"));
    elements
        .iter()
        .find_map(|e| {
            let strip = e["key"]["strip"].as_str()?;
            let key = test_id.strip_prefix(strip)?;
            Some(format!("{}:{key}", e["name"].as_str()?))
        })
        .or_else(|| {
            // An element keyed by its whole test id (no prefix to strip).
            elements
                .iter()
                .find(|e| e["key"]["attr"] == "data-testid" && e["key"]["strip"].is_null())
                .map(|e| format!("{}:{test_id}", e["name"].as_str().unwrap()))
        })
        .unwrap_or_else(|| panic!("no named element of {screen} is {selector}"))
}

fn draw(cx: &mut HeadlessAppContext, window: gpui::AnyWindowHandle) {
    cx.run_until_parked();
    cx.update_window(window, |_, window: &mut Window, cx| {
        probe::clear();
        window.refresh();
        let _ = window.draw(cx);
    })
    .unwrap();
}

fn click(cx: &mut HeadlessAppContext, window: gpui::AnyWindowHandle, name: &str) {
    draw(cx, window);
    let at = probe::record(name)
        .unwrap_or_else(|| panic!("{name} is drawn"))
        .bounds;
    let position = point(
        at.origin.x + at.size.width / 2.,
        at.origin.y + at.size.height / 2.,
    );
    cx.update_window(window, |_, window: &mut Window, cx| {
        window.dispatch_event(
            PlatformInput::MouseDown(MouseDownEvent {
                button: MouseButton::Left,
                position,
                modifiers: Modifiers::default(),
                click_count: 1,
                first_mouse: false,
            }),
            cx,
        );
        window.dispatch_event(
            PlatformInput::MouseUp(MouseUpEvent {
                button: MouseButton::Left,
                position,
                modifiers: Modifiers::default(),
                click_count: 1,
            }),
            cx,
        );
    })
    .unwrap();
    cx.run_until_parked();
}

fn press(cx: &mut HeadlessAppContext, window: gpui::AnyWindowHandle, keystroke: Keystroke) {
    cx.update_window(window, |_, window: &mut Window, cx| {
        window.dispatch_keystroke(keystroke, cx)
    })
    .unwrap();
    cx.run_until_parked();
}

/// Does a fixture state's `steps` in the window, as events: a `type` clicks its field, selects
/// what is in it and types the text a key at a time, a `key` presses one key where the keyboard
/// is, a `click` clicks.
fn run_steps(
    cx: &mut HeadlessAppContext,
    window: gpui::AnyWindowHandle,
    screen: &str,
    steps: &[Value],
) {
    for step in steps {
        if let Some(typed) = step.get("type") {
            click(
                cx,
                window,
                &named(screen, typed["selector"].as_str().unwrap()),
            );
            // The web sets the field's value: what was in it goes, so it is selected first.
            let all = if cfg!(target_os = "macos") {
                "cmd-a"
            } else {
                "ctrl-a"
            };
            press(cx, window, Keystroke::parse(all).unwrap());
            for c in typed["text"].as_str().unwrap_or_default().chars() {
                let key = if c == ' ' {
                    "space".to_string()
                } else {
                    c.to_lowercase().to_string()
                };
                let modifiers = Modifiers {
                    shift: c.is_uppercase() || "~!@#$%^&*()_+{}|:\"<>?".contains(c),
                    ..Modifiers::default()
                };
                press(
                    cx,
                    window,
                    Keystroke {
                        modifiers,
                        key,
                        key_char: Some(c.to_string()),
                    },
                );
            }
        } else if let Some(key) = step.get("key") {
            let spec = web_key(key["key"].as_str().unwrap_or_default());
            press(cx, window, Keystroke::parse(&spec).unwrap());
        } else if let Some(selector) = step.get("click").and_then(Value::as_str) {
            click(cx, window, &named(screen, selector));
        } else {
            panic!("a step this helper does not know: {step}");
        }
    }
}

/// Names `named-elements.json` marks as sized by their text, for `screen`.
fn text_sized_names(screen: &str) -> Vec<String> {
    let text = std::fs::read_to_string(parity::parity_dir().join("named-elements.json"))
        .expect("named-elements.json");
    let table: Value = serde_json::from_str(&text).unwrap_or_default();
    table["screens"][screen]["elements"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|e| e["textSized"] == true)
        .filter_map(|e| e["name"].as_str().map(str::to_string))
        .collect()
}

/// The screen whose mod draws fixture screen `screen`: the sidebar's session menu is the tab
/// menu for that session.
fn drawn_by(screen: &str) -> &str {
    match screen {
        "session-menu" => "tab-menu",
        other => other,
    }
}

/// The tab menu's props for a session menu's (`{id, x, y, extraItems}`), as the window works
/// them out (`open_session_menu`): the window's tabs in fixture state `data`, its split set
/// joined, and the session's inbound choices after the sidebar's rows.
fn session_menu_props(data: &Value, menu: &Value) -> Value {
    let model = model_from(data);
    let window = window_from(data, &model);
    let mut tabs = Tabs::default();
    for id in &window.strip {
        tabs.open(id);
    }
    for set in data["splitSets"]["sets"].as_array().into_iter().flatten() {
        let ids: Vec<&str> = set["ids"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .collect();
        for other in ids.iter().skip(1) {
            tabs.join(ids[0], other);
        }
    }
    let id = menu["id"]
        .as_str()
        .expect("a session menu names its session");
    let title = |tab: &str| {
        model
            .store
            .sessions
            .iter()
            .find(|s| s.id == tab)
            .map_or_else(|| tab.to_string(), |s| s.title.clone())
    };
    let mut extra = menu["extraItems"].as_array().cloned().unwrap_or_default();
    extra.extend(inbound_items(&model.store, id));
    let at = (
        menu["x"].as_f64().unwrap_or(0.) as f32,
        menu["y"].as_f64().unwrap_or(0.) as f32,
    );
    let mates = workspace_mates(&model.store, tabs.strip(), id);
    tab_menu_props(&tabs, &mates, id, at, &title, false, extra)
}

/// Draws screen `fixture.screen`'s mod in a fixture state as the window holds it: an in-flow
/// screen alone at the state's size, a floating one over the whole of the state's window on the
/// backdrop, with `viewport` in its props. The state's `steps` are done as events. Writes
/// `<screen>.<state>.<theme>.png` and `.json` into `out`, in the web reference's schema.
pub fn capture(cx: &mut HeadlessAppContext, capture: &ScreenCapture) -> Shot {
    let fixture = capture.fixture;
    let screen_id = fixture.screen.as_str();
    let drawn = drawn_by(screen_id);
    let screen = screens::screen(drawn).unwrap_or_else(|| panic!("no screen {drawn}"));
    let ((width, height), (window_w, window_h)) = fixture.size(capture.state);
    let empty =
        std::env::temp_dir().join(format!("perch-parity-screens-{}-none", std::process::id()));
    let host =
        ModHost::new(capture.mods.map_or(empty, Path::to_path_buf)).expect("the mod host starts");
    assert!(host.find(drawn).is_some(), "a mod draws screen {drawn}");
    let perch = Perch::new();
    perch.register(&host);
    publish(&perch, fixture, capture.state);
    let floating = matches!(screen.place, Place::Floating { .. });
    let mut props = fixture.props(capture.state);
    if drawn != screen_id {
        let menu = props.take().unwrap_or_else(|| json!({}));
        props = Some(session_menu_props(&fixture.data(capture.state), &menu));
    }
    if floating {
        // As the window gives every floating screen: its size.
        let with =
            screens::with_viewport(props.as_ref().unwrap_or(&json!({})), (window_w, window_h));
        perch.set_props(screen.id, with.clone());
        props = Some(with);
    }
    // A pane header is placed once per pane, keyed by its tab.
    let key = match (screen.id, props.as_ref().and_then(|p| p["id"].as_str())) {
        ("pane-header", Some(id)) => format!("pane-header#{id}"),
        _ => screen.id.to_string(),
    };
    if key != screen.id {
        perch.set_props(&key, props.clone().unwrap_or_else(|| json!({})));
    }
    perch.set_theme(capture.theme.name());
    cx.update(|cx| perch.flush(cx));

    let resolved = theme::resolve(capture.theme.name());
    let tokens: Map<String, Value> = theme::TOKENS
        .iter()
        .zip(resolved.tokens.iter())
        .map(|(name, value)| (name.to_string(), json!(format!("{value}ff"))))
        .collect();
    let window_size = if floating {
        (window_w, window_h)
    } else {
        (width, height)
    };
    let backdrop = floating.then(|| {
        let hex = tokens["backdrop"].as_str().unwrap();
        gpui::Rgba::try_from(&hex[..7]).unwrap().into()
    });
    let window = cx
        .open_window(size(px(window_size.0), px(window_size.1)), |window, cx| {
            let view = host.view_keyed(screen.id, &key, window, cx);
            cx.new(|_| Stage { view, backdrop })
        })
        .expect("an offscreen window");
    let handle: gpui::AnyWindowHandle = window.into();
    // The idle pointer sits at the window's corner and would hover what is there; a reference is
    // drawn with no pointer over it.
    cx.update_window(handle, |_, window: &mut Window, cx| {
        window.dispatch_event(
            PlatformInput::MouseMove(MouseMoveEvent {
                position: point(px(-1.), px(-1.)),
                pressed_button: None,
                modifiers: Modifiers::default(),
            }),
            cx,
        );
    })
    .unwrap();
    run_steps(cx, handle, screen.id, &fixture.steps(capture.state));
    cx.update_window(handle, |_, window: &mut Window, cx| {
        window.dispatch_event(
            PlatformInput::MouseMove(MouseMoveEvent {
                position: point(px(-1.), px(-1.)),
                pressed_button: None,
                modifiers: Modifiers::default(),
            }),
            cx,
        );
    })
    .unwrap();
    draw(cx, handle);
    let (image, scale) = cx
        .update_window(handle, |_, window: &mut Window, _| {
            (
                window.render_to_image().expect("offscreen render"),
                window.scale_factor(),
            )
        })
        .unwrap();
    let records: Vec<ProbeRecord> = probe::records().into_values().collect();
    let stage = window.entity(&*cx).unwrap();
    let error = cx.update(|cx| stage.read(cx).view.read(cx).error(cx));
    assert_eq!(error, None, "the {screen_id} mod draws");

    let sized = text_sized_names(screen.id);
    let report = json!({
        "schema": parity::SCHEMA,
        "screen": screen_id,
        "state": capture.state,
        "theme": capture.theme.word(),
        "renderer": "perch-native gpui",
        "mod": screen.id,
        "size": { "width": width, "height": height, "scale": scale },
        "window": { "width": window_w, "height": window_h },
        "tokens": tokens,
        "elements": parity::elements(records, &tokens, &|n| sized.iter().any(|s| s == n)),
        "hiddenCounts": {},
    });
    std::fs::create_dir_all(capture.out).expect("the output folder");
    let stem = format!("{screen_id}.{}.{}", capture.state, capture.theme.word());
    let png = capture.out.join(format!("{stem}.png"));
    let json_path = capture.out.join(format!("{stem}.json"));
    image.save(&png).expect("the PNG is written");
    std::fs::write(
        &json_path,
        serde_json::to_string_pretty(&report).unwrap() + "\n",
    )
    .expect("the JSON is written");
    cx.update_window(handle, |_, window, _| window.remove_window())
        .unwrap();
    cx.run_until_parked();
    Shot {
        png,
        json: json_path,
        report,
    }
}
