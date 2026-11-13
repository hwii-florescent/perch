//! The stock chrome screens in a real window: the `tabs` mod is the tab strip (a tab per open
//! session, the shown one marked, a click shows a tab, its × closes it, a right click opens the tab's
//! menu, + opens the New session screen), the `status` mod is the status line (its zoom button resets the
//! zoom) and the `pane-header` mod heads each pane of a split (leave the split, close the pane).
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event
//! goes through the window's own dispatch.

use futures::channel::mpsc::unbounded;
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::Update;
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::ui::{Workspace, SIDEBAR_WIDTH};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

/// A New session screen that only shows the props it was opened with.
const NEW_SESSION: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    return div().id(`new-session-for-${perch.props().hostId}`).size_full().bg("#202020");
  }
}
"##;

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 600.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project, holding an idle session per title.
fn state(titles: &[&str]) -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project]})));
    let sessions: Vec<Value> = titles
        .iter()
        .map(|title| {
            json!({"id": title, "title": title, "cwd": "/work", "createdAt": 0, "status": "idle",
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"})
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

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

    /// Draws the window afresh, letting mod loads, React's commits and deferred calls settle
    /// first, and returns what the mods named.
    fn draw(&mut self) -> Vec<ProbeRecord> {
        for _ in 0..3 {
            self.cx.advance_clock(POLL);
            self.cx.run_until_parked();
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    probe::clear();
                    window.refresh();
                    let _ = window.draw(cx);
                })
                .unwrap();
        }
        probe::records().into_values().collect()
    }

    fn record(&mut self, name: &str) -> Option<ProbeRecord> {
        self.draw().into_iter().find(|r| r.name == name)
    }

    /// The keys of the records named `name:<key>`, left to right.
    fn keys(&mut self, name: &str) -> Vec<String> {
        let prefix = format!("{name}:");
        let mut found: Vec<(f32, String)> = self
            .draw()
            .into_iter()
            .filter_map(|r| {
                let key = r.name.strip_prefix(prefix.as_str())?.to_string();
                Some((f32::from(r.bounds.origin.x), key))
            })
            .collect();
        found.sort_by(|a, b| a.0.total_cmp(&b.0));
        found.into_iter().map(|(_, key)| key).collect()
    }

    /// A press and release of `button` in the middle of `name`, through the window's dispatch.
    fn click_with(&mut self, name: &str, button: MouseButton) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds
            .center();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button,
                        position: at,
                        modifiers: Modifiers::default(),
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    fn click(&mut self, name: &str) {
        self.click_with(name, MouseButton::Left);
    }

    fn strip(&mut self) -> Vec<String> {
        self.ws(|ws, _, _| ws.tabs().strip().to_vec())
    }

    fn active(&mut self) -> Option<String> {
        self.ws(|ws, _, _| ws.tabs().active().map(str::to_string))
    }

    fn open(&mut self, id: &str) {
        self.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id.into(), Some("claude".into()), cx)
            })
        });
        self.draw();
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-chrome-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");
    std::fs::create_dir_all(user.join("new-session")).unwrap();
    std::fs::write(user.join("new-session/main.js"), NEW_SESSION).unwrap();

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state(&["alpha", "bravo", "charlie"]).model();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };

    // Nothing open: no strip; the status line is there.
    rig.draw();
    assert!(rig.record("tab-strip").is_none(), "no tab, no strip");
    let status = rig.record("status-bar").expect("the status mod draws");
    assert_eq!(
        status.bounds.origin.y + status.bounds.size.height,
        px(HEIGHT),
        "at the window's foot"
    );

    // The strip: a tab per open session, in order, beside the sidebar; the last opened is shown.
    rig.open("alpha");
    rig.open("bravo");
    assert_eq!(rig.keys("tab"), ["alpha", "bravo"]);
    let strip = rig.record("tab-strip").expect("the tabs mod draws");
    assert!(
        strip.bounds.origin.x >= px(SIDEBAR_WIDTH),
        "beside the sidebar"
    );
    assert_eq!(
        strip.bounds.size.height,
        px(44.),
        "as high as the web's strip"
    );
    assert_eq!(rig.active().as_deref(), Some("bravo"));
    let weight = |rig: &mut Rig, id: &str| {
        rig.record(&format!("tab-label:{id}"))
            .unwrap_or_else(|| panic!("{id}'s label is drawn"))
            .font_weight
    };
    assert!(
        weight(&mut rig, "bravo") > weight(&mut rig, "alpha"),
        "the shown tab is marked"
    );

    // A click shows a tab; its × closes it.
    rig.click("tab:alpha");
    assert_eq!(rig.active().as_deref(), Some("alpha"), "tab.select ran");
    // The first click on a window that is not key makes it key, and the window is drawn again
    // between the press and the release: the click on the other tab still lands.
    let at = rig.record("tab:bravo").unwrap().bounds.center();
    rig.cx
        .update_window(rig.window.into(), |_, window: &mut Window, cx| {
            window.dispatch_event(
                PlatformInput::MouseDown(MouseDownEvent {
                    button: MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                    first_mouse: true,
                }),
                cx,
            );
            window.activate_window();
            window.refresh();
            let _ = window.draw(cx);
            window.dispatch_event(
                PlatformInput::MouseUp(MouseUpEvent {
                    button: MouseButton::Left,
                    position: at,
                    modifiers: Modifiers::default(),
                    click_count: 1,
                }),
                cx,
            );
        })
        .unwrap();
    rig.cx.run_until_parked();
    assert_eq!(
        rig.active().as_deref(),
        Some("bravo"),
        "a first click lands"
    );
    rig.click("tab:alpha");
    rig.click("tab-close:alpha");
    assert_eq!(rig.strip(), ["bravo"], "tab.close ran");
    assert_eq!(rig.keys("tab"), ["bravo"]);

    // A right click opens the tab's menu.
    rig.click_with("tab:bravo", MouseButton::Right);
    let menu = rig.ws(|ws, _, _| (ws.menu_labels(), ws.screens_open()));
    assert!(
        menu.0.is_some() || menu.1.contains(&"tab-menu"),
        "tab.menu opened a menu: {menu:?}"
    );
    rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
        .ok();
    rig.ws(|ws, window, cx| ws.run_command("menu.close", None, window, cx))
        .ok();

    // + asks for a New session on the tab's computer.
    rig.click("tab-new");
    assert!(
        rig.ws(|ws, _, _| ws.screens_open())
            .contains(&"new-session"),
        "+ opened the New session screen"
    );
    assert!(
        rig.record("new-session-for-local").is_some(),
        "for this computer"
    );
    rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
        .ok();
    println!("mods_chrome_window: tab strip ok");

    // The status line's zoom button shows when zoomed and puts the zoom back.
    rig.ws(|ws, window, cx| ws.run_command("app.zoom_in", None, window, cx))
        .unwrap();
    assert!(rig.ws(|ws, _, _| ws.zoom_factor()) > 1.);
    rig.click("zoom-indicator");
    assert_eq!(
        rig.ws(|ws, _, _| ws.zoom_factor()),
        1.,
        "app.zoom_reset ran"
    );
    assert!(rig.record("zoom-indicator").is_none(), "at 100% it goes");
    println!("mods_chrome_window: status line ok");

    // A split heads each pane: leaving the split shows that pane alone, closing one closes its tab.
    let split = |rig: &mut Rig, new: &str| {
        rig.ws(|ws, window, cx| ws.run_command("panes.splitRight", None, window, cx))
            .unwrap();
        rig.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |sidebar, cx| {
                sidebar.apply(
                    Update::Launched {
                        host_id: "local".into(),
                        session_id: new.into(),
                        provider: "terminal".into(),
                    },
                    cx,
                )
            })
        });
        rig.draw();
    };
    assert!(
        rig.record("pane-header:bravo").is_none(),
        "a lone pane has no header"
    );
    split(&mut rig, "charlie");
    let mut headed = rig.keys("pane-header");
    headed.sort();
    assert_eq!(headed, ["bravo", "charlie"], "a header per pane");
    rig.click("pane-expand:bravo");
    assert_eq!(
        rig.ws(|ws, _, _| ws.tabs().shown()),
        ["bravo"],
        "pane.unsplit ran"
    );
    assert!(rig.keys("pane-header").is_empty(), "alone, no headers");
    split(&mut rig, "delta");
    rig.click("pane-close:delta");
    assert!(
        !rig.strip().contains(&"delta".to_string()),
        "pane.close ran"
    );
    println!("mods_chrome_window: pane headers ok");

    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_chrome_window: ok");
}
