//! Screens drawn by mods in a real window: a mod with a screen's id takes that screen's place (the
//! tab strip in flow; a confirmation, the pane menu and the notifications floating over the whole
//! window), gets its props and re-renders when they change, and a floating one returns a result to
//! the window, which gives the keyboard back to the terminal that had it. A floating mod places
//! its own panel and closes itself on a press outside it; Escape is the window's. Under a modal
//! screen nothing beneath takes the mouse; under the notifications everything does but the card.
//! The data screens read (status line usage, zoom, notifications, tabs) reaches them and
//! re-renders them when it changes.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every
//! event goes through the window's own dispatch. The mods are user mods the test writes.

use futures::channel::mpsc::{unbounded, UnboundedReceiver};
use gpui::{
    point, px, size, AppContext as _, Focusable as _, HeadlessAppContext, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, ScrollDelta, ScrollWheelEvent,
    TouchPhase, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use gpui_shell::{HostArguments, HostValue};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, WindowMods, POLL};
use perch_native::shell;
use perch_native::sidebar::{Alert, Heard, State, Toast};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::ui::{Workspace, SIDEBAR_WIDTH};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;
use std::time::Duration;

const WIDTH: f32 = 1000.;
const HEIGHT: f32 = 700.;

const TABS: &str = r##"
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const tabs = perch.workspaceTabs().tabs;
    return h_flex().id("tabs-root").size_full().bg("#202020")
      .child(div().id("tabs-count").w(10 * tabs.length + 10).h(20).bg("#ff0000"));
  }
}
"##;

const STATUS: &str = r##"
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const line = perch.statusLine();
    return h_flex().id("status-root").size_full()
      .child(div().id("status-zoom").w(Math.round(perch.zoom() * 100)).h(10).bg("#00ff00"))
      .child(div().id("status-tokens").w((line.contextTokens ?? 0) / 100 + 1).h(10).bg("#0000ff"))
      .child(div().id("status-hit").flex_1().h_full()
        .on_mouse_down("left", (event, cx) => { this.presses = (this.presses ?? 0) + 1; cx.notify(); })
        .on_scroll_wheel((event, cx) => { this.scrolls = (this.scrolls ?? 0) + 1; cx.notify(); })
        .child(div().id("status-presses").w(1 + 10 * (this.presses ?? 0)).h(4).bg("#ff00ff"))
        .child(div().id("status-scrolls").w(1 + 10 * (this.scrolls ?? 0)).h(4).bg("#00ffff")));
  }
}
"##;

const CONFIRM: &str = r##"
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const props = perch.props();
    return div().id("confirm-root").size_full()
      .on_mouse_down("left", () => perch.close())
      .child(v_flex().id("confirm-panel").w(360).h(120).bg("#303030")
        .on_mouse_down("left", (event, cx) => cx.stop_propagation())
        .child(div().id("confirm-message").w(10 * (props.message ?? "").length).h(20).bg("#ffffff"))
        .child(div().id("confirm-yes").w(80).h(30).bg("#00ff00")
          .on_click(() => perch.close({ confirmed: true }))));
  }
}
"##;

/// A status line that names each terminal with its state (`term:<session>:<state>`).
const TERMINALS: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    return div().id("terms").size_full().children(perch.terminals().map((t) =>
      div().id(`term:${t.sessionId}:${t.state}`).w(10).h(10).bg("#ffffff")));
  }
}
"##;

/// A status line that, once, asks for a confirmation that says it is busy.
const OPENER: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    if (!this.asked) {
      this.asked = true;
      perch.openScreen("confirm", { message: "locked", busy: true }).catch(() => {});
    }
    return div().id("opener").size_full();
  }
}
"##;

/// A tab menu that shows its tab's title as a bar (10 px a character) and renames it.
const TAB_MENU: &str = r##"
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const props = perch.props();
    return div().id("menu-root").size_full()
      .child(v_flex().id("menu-panel").absolute().left(props.x).top(props.y).w(200).h(120)
        .bg("#303030")
        .on_mouse_down_out(() => perch.close())
        .child(div().id("menu-items").w(10 * (props.self?.title ?? "").length).h(10).bg("#ffffff"))
        .child(div().id("menu-rename").w(100).h(30).bg("#00ff00")
          .on_click(() => perch.close({ action: "rename", args: ["Renamed"] }))));
  }
}
"##;

const TOAST: &str = r##"
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import * as perch from "perch";
export default class extends View {
  render() {
    const { items } = perch.notifications();
    return v_flex().id("toast-root").size_full().justify_end().items_end()
      .child(v_flex().id("toast-card").w(300).bg("#202020")
        .on_mouse_down("left", (event, cx) => cx.stop_propagation())
        .child(div().id("toast-count").w(20 * items.length + 1).h(10).bg("#ffffff"))
        .child(div().id("toast-dismiss").w(50).h(30).bg("#ff0000")
          .on_click(() => { if (items[0]) perch.run("notification.dismiss", { id: items[0].id }); })));
  }
}
"##;

const NAVIGATOR: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    const props = perch.props();
    return div().id("nav-root").size_full().bg("#303030")
      .child(div().id("nav-sessions").w(10 * (props.sessions ?? []).length).h(10).bg("#ffffff"));
  }
}
"##;

const NEW_SESSION: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    const props = perch.props();
    return div().id("new-root").size_full().bg("#303030")
      .child(div().id("new-start").w(100).h(30).bg("#00ff00")
        .on_click(() => perch.close({ cwd: props.projectCwds[0], agent: "claude" })));
  }
}
"##;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project with an agent session `alpha`, on a computer that can start Claude.
fn state() -> State {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [{
            "id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
            "createdAt": 0, "updatedAt": 0}]})));
    let manifests: Vec<Value> = ["terminal", "claude"]
        .iter()
        .map(|id| {
            json!({"id": id, "displayName": if *id == "claude" { "Claude" } else { "Terminal" },
                   "supportedModes": ["cli"], "resumability": "none",
                   "capabilities": ["interactiveTerminal"], "statusDetection": "none",
                   "available": true})
        })
        .collect();
    state.apply(&message(
        json!({"type": "agent.manifest.list", "requestId": "r", "manifests": manifests}),
    ));
    state.apply(&message(json!({"type": "session.list", "sessions": [{
        "id": "alpha", "title": "Alpha", "cwd": "/work", "createdAt": 0, "status": "idle",
        "hostId": "local", "projectId": "p", "cliProviderId": "claude"}]})));
    state
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
    asked: UnboundedReceiver<Command>,
    user: PathBuf,
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

    /// Draws the window afresh, letting mod loads and deferred calls settle first.
    fn draw(&mut self) {
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
    }

    fn record(&mut self, name: &str) -> Option<ProbeRecord> {
        self.draw();
        probe::record(name)
    }

    fn write(&self, id: &str, text: &str) {
        std::fs::create_dir_all(self.user.join(id)).unwrap();
        std::fs::write(self.user.join(id).join("main.js"), text).unwrap();
        // The window looks for screen mods at most every POLL.
        std::thread::sleep(POLL + Duration::from_millis(20));
    }

    fn remove(&self, id: &str) {
        std::fs::remove_dir_all(self.user.join(id)).unwrap();
        std::thread::sleep(POLL + Duration::from_millis(20));
    }

    fn mouse(&mut self, x: f32, y: f32) {
        let position = point(px(x), px(y));
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
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
        self.cx.run_until_parked();
    }

    fn scroll(&mut self, x: f32, y: f32) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::ScrollWheel(ScrollWheelEvent {
                        position: point(px(x), px(y)),
                        delta: ScrollDelta::Lines(point(0., -3.)),
                        modifiers: Modifiers::default(),
                        touch_phase: TouchPhase::Moved,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    /// A click in the middle of the element the probe recorded as `name`.
    fn click(&mut self, name: &str) {
        let at = self
            .record(name)
            .unwrap_or_else(|| panic!("{name} is drawn"))
            .bounds;
        self.mouse(
            f32::from(at.origin.x + at.size.width / 2.),
            f32::from(at.origin.y + at.size.height / 2.),
        );
    }

    fn press(&mut self, spec: &str) {
        let keystroke = Keystroke::parse(spec).unwrap();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn terminal_focused(&mut self) -> bool {
        self.ws(|ws, window, cx| {
            ws.terminal()
                .expect("a terminal")
                .focus_handle(cx)
                .is_focused(window)
        })
    }

    fn open_confirm(&mut self, message: &str) -> Rc<RefCell<Option<Value>>> {
        let got = Rc::new(RefCell::new(None));
        let keep = got.clone();
        let opened = self.ws(|ws, _, cx| {
            ws.open_screen(
                "confirm",
                json!({ "message": message }),
                None,
                Some(Box::new(move |_, result, _, _| {
                    *keep.borrow_mut() = Some(result)
                })),
                cx,
            )
        });
        assert!(opened, "a confirm mod draws the confirmation");
        self.draw();
        got
    }

    fn asked(&mut self) -> Vec<Command> {
        std::iter::from_fn(|| self.asked.try_recv().ok()).collect()
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-mods-screens-{}", std::process::id()));
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
    let mut state = state();
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
    assert!(
        cx.update(|cx| cx.has_global::<WindowMods>()),
        "the engine started"
    );
    let mut rig = Rig {
        cx,
        window,
        asked,
        user,
    };
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    rig.draw();
    assert!(
        rig.terminal_focused(),
        "the tab's terminal has the keyboard"
    );

    // In flow: the stock strip; a user's tabs mod takes its place with the window's tabs;
    // removing it brings the stock strip back.
    assert!(rig.record("tab-strip").is_some(), "the stock strip");
    assert!(rig.record("tabs-count").is_none());
    rig.write("tabs", TABS);
    let strip = rig.record("tabs-count").expect("the tabs mod is placed");
    assert_eq!(strip.bounds.size.width, px(20.), "one tab");
    let root = probe::record("tabs-root").unwrap();
    assert_eq!(
        (root.bounds.origin, root.bounds.size.height),
        (
            point(px(SIDEBAR_WIDTH + 2. * shell::GUTTER), px(shell::GUTTER)),
            px(shell::HEAD)
        ),
        "where the strip is drawn: the main card's head"
    );
    rig.remove("tabs");
    assert!(rig.record("tabs-count").is_none());
    assert!(rig.record("tab-strip").is_some(), "the stock strip is back");

    // The status bar: the status line's usage from `status.update` and the zoom reach it, and a
    // change of either re-renders it.
    rig.write("status", STATUS);
    assert_eq!(
        rig.record("status-zoom").unwrap().bounds.size.width,
        px(100.)
    );
    assert_eq!(
        rig.record("status-tokens").unwrap().bounds.size.width,
        px(1.)
    );
    state.apply(&message(json!({
        "type": "status.update", "cwd": "/work", "branch": "main",
        "contextTokens": 4900, "costUsd": 0.25})));
    let model = state.model();
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |s, cx| s.apply(Update::Model(model), cx))
    });
    assert_eq!(
        rig.record("status-tokens").unwrap().bounds.size.width,
        px(50.)
    );
    rig.ws(|ws, window, cx| ws.run_command("app.zoom_in", None, window, cx))
        .unwrap();
    let zoomed = rig.record("status-zoom").unwrap().bounds.size.width;
    assert!(
        zoomed > px(100.),
        "zoom in re-renders the status bar ({zoomed:?})"
    );
    let line = rig.cx.update(|cx| {
        let perch = cx.global::<WindowMods>().perch.clone();
        let module = perch.module("probe");
        let call = |name: &str, args: Vec<HostValue>| {
            perch_native::mods::perch::from_host(
                &module.call(name, &HostArguments::new(args)).unwrap(),
            )
        };
        (
            call("statusLine", vec![]),
            call("providers", vec![]),
            call("paneLook", vec![]),
        )
    });
    assert_eq!(
        (&line.0["contextTokens"], &line.0["costUsd"]),
        (&json!(4900), &json!(0.25))
    );
    // The agents a host can start (a plain terminal is not one).
    assert_eq!(line.1, json!([{"id": "claude", "name": "Claude"}]));
    assert_eq!(line.2["headerHeight"], json!(28));

    // Floating: a confirmation gets its props, re-renders when they change, and closes itself
    // with a result; the keyboard goes back to the terminal.
    rig.write("confirm", CONFIRM);
    let got = rig.open_confirm("Sure?");
    assert_eq!(
        rig.record("confirm-message").unwrap().bounds.size.width,
        px(50.)
    );
    assert!(!rig.terminal_focused(), "the confirmation has the keyboard");
    // Over the whole window, which its props say the size of; it places its own panel.
    let root = probe::record("confirm-root").unwrap();
    assert_eq!(
        (root.bounds.origin, root.bounds.size),
        (point(px(0.), px(0.)), size(px(WIDTH), px(HEIGHT)))
    );
    assert_eq!(
        rig.ws(|ws, _, _| ws.screen_props("confirm").cloned())
            .unwrap()["viewport"],
        json!({ "width": WIDTH, "height": HEIGHT })
    );
    rig.ws(|ws, _, cx| ws.update_screen("confirm", json!({ "message": "Really sure?" }), cx));
    assert_eq!(
        rig.record("confirm-message").unwrap().bounds.size.width,
        px(120.)
    );
    rig.click("confirm-yes");
    rig.draw();
    assert_eq!(*got.borrow(), Some(json!({ "confirmed": true })));
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty(), "closed");
    assert!(rig.record("confirm-root").is_none());
    assert!(
        rig.terminal_focused(),
        "the keyboard is back on the terminal"
    );

    // Escape dismisses it, once, in the window, unless it is busy; a press on its backdrop (the
    // mod's own, as the web's) dismisses it too, and nothing beneath takes that press. Each time
    // it opens again.
    let got = rig.open_confirm("Again?");
    rig.ws(|ws, _, cx| {
        ws.update_screen("confirm", json!({ "message": "Again?", "busy": true }), cx)
    });
    rig.press("escape");
    assert_eq!(*got.borrow(), None, "a busy confirmation stays");
    assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["confirm"]);
    rig.ws(|ws, _, cx| ws.update_screen("confirm", json!({ "message": "Again?" }), cx));
    rig.press("escape");
    assert_eq!(*got.borrow(), Some(Value::Null), "Escape is a dismissal");
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty());
    rig.draw();
    assert!(rig.terminal_focused());
    let got = rig.open_confirm("Once more?");
    let presses = rig.record("status-presses").unwrap().bounds.size.width;
    rig.mouse(WIDTH - 20., HEIGHT - 10.);
    assert_eq!(
        *got.borrow(),
        Some(Value::Null),
        "a press outside is a dismissal"
    );
    assert_eq!(
        rig.record("status-presses").unwrap().bounds.size.width,
        presses,
        "the status bar beneath did not take it"
    );
    rig.draw();
    assert!(rig.terminal_focused());

    // The close guard asks through the confirmation, for a terminal attached to an agent's
    // session; dismissed, the tab stays.
    let (to_core, _asked_core) = unbounded::<ToCore>();
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
    rig.draw();
    assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["confirm"]);
    // The close guard's props (`CloseGuardProps`): the tab's name.
    let guard = rig
        .ws(|ws, _, _| ws.screen_props("confirm").cloned())
        .unwrap();
    assert!(
        guard["label"].as_str().unwrap().contains("Alpha"),
        "{guard}"
    );
    rig.press("escape");
    assert_eq!(
        rig.ws(|ws, _, _| ws.tabs().strip().to_vec()),
        ["alpha"],
        "kept"
    );

    // A menu opened at a point returns the action picked, which runs on its tab.
    rig.write("tab-menu", TAB_MENU);
    rig.ws(|ws, window, cx| {
        ws.run_command(
            "tab.menu",
            Some(&json!({"id": "alpha", "x": 400, "y": 200})),
            window,
            cx,
        )
    })
    .unwrap();
    let items = rig.record("menu-items").expect("the tab menu mod is open");
    let root = probe::record("menu-root").unwrap();
    assert_eq!(
        (root.bounds.origin, root.bounds.size),
        (point(px(0.), px(0.)), size(px(WIDTH), px(HEIGHT))),
        "over the whole window"
    );
    assert_eq!(
        probe::record("menu-panel").unwrap().bounds.origin,
        point(px(400.), px(200.)),
        "its panel at the point its props say"
    );
    assert_eq!(
        items.bounds.size.width,
        px(50.),
        "the window's props for the tab: its title, Alpha"
    );
    rig.asked();
    rig.click("menu-rename");
    let renamed = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Rename { session_id, title } if session_id == "alpha" && title == "Renamed")
    });
    assert!(renamed, "the menu's rename ran on its tab");
    // A press outside its panel closes it: the mod's own `on_mouse_down_out`, as the web's menu.
    rig.ws(|ws, window, cx| {
        ws.run_command(
            "tab.menu",
            Some(&json!({"id": "alpha", "x": 400, "y": 200})),
            window,
            cx,
        )
    })
    .unwrap();
    assert!(rig.record("menu-panel").is_some());
    rig.mouse(100., 100.);
    rig.draw();
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty(), "closed");
    assert!(rig.asked().is_empty(), "nothing ran");
    assert!(rig.terminal_focused());

    // Notifications: the toast screen shows them, not modal, and dismissing the last puts it away.
    rig.write("toast", TOAST);
    rig.ws(|ws, _, cx| {
        ws.toast(
            Heard {
                alert: Alert::Done,
                session_id: "alpha".into(),
                title: "Alpha".into(),
                sound: false,
                file: None,
                toast: Toast::App,
                body: None,
            },
            cx,
        )
    });
    assert_eq!(
        rig.record("toast-count").unwrap().bounds.size.width,
        px(21.)
    );
    assert!(
        rig.terminal_focused(),
        "a notification does not take the keyboard"
    );
    // Its layer covers the window and takes nothing: a press and a scroll beside its card reach
    // the status bar beneath; a press on the card is the card's.
    let card = probe::record("toast-card").unwrap().bounds;
    let hit = probe::record("status-hit").unwrap().bounds;
    assert!(
        card.right() > hit.left() && card.bottom() > hit.top(),
        "the card is over the bar"
    );
    let beside = (f32::from(card.left()) - 20., f32::from(hit.top()) + 5.);
    let over = (f32::from(card.right()) - 5., f32::from(hit.top()) + 5.);
    let width = |rig: &mut Rig, name: &str| rig.record(name).unwrap().bounds.size.width;
    let (presses, scrolls) = (
        width(&mut rig, "status-presses"),
        width(&mut rig, "status-scrolls"),
    );
    rig.mouse(beside.0, beside.1);
    assert_eq!(width(&mut rig, "status-presses"), presses + px(10.));
    rig.scroll(beside.0, beside.1);
    assert_eq!(width(&mut rig, "status-scrolls"), scrolls + px(10.));
    rig.mouse(over.0, over.1);
    assert_eq!(
        width(&mut rig, "status-presses"),
        presses + px(10.),
        "the card took it"
    );
    assert!(rig.terminal_focused(), "and the keyboard stays");
    let item = rig.cx.update(|cx| {
        let ws = workspace.read(cx);
        let model = ws.sidebar().read(cx).model();
        perch_native::mods::perch::notification_json(&ws.notifications()[0], model)
    });
    assert_eq!(
        (
            &item["heading"],
            &item["detail"],
            &item["kind"],
            &item["hasSession"]
        ),
        (
            &json!("Claude finished"),
            &json!("Alpha"),
            &json!("done"),
            &json!(true)
        )
    );
    rig.click("toast-dismiss");
    rig.draw();
    assert!(rig.ws(|ws, _, _| ws.notifications().is_empty()));
    assert!(
        rig.record("toast-root").is_none(),
        "no notifications, no toast"
    );

    // The Navigator opens as a screen with the sessions, and its own key closes it again.
    rig.write("navigator", NAVIGATOR);
    rig.ws(|ws, window, cx| ws.run_command("app.palette", None, window, cx))
        .unwrap();
    assert_eq!(
        rig.record("nav-sessions").unwrap().bounds.size.width,
        px(10.)
    );
    assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["navigator"]);
    rig.press("cmd-p");
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty());

    // New quickchat opens New session as a screen in place of the sidebar's panel; what it
    // picks is launched.
    rig.write("new-session", NEW_SESSION);
    rig.ws(|ws, window, cx| ws.run_command("nests.scratchpad", None, window, cx))
        .unwrap();
    rig.draw();
    let props = rig
        .ws(|ws, _, _| ws.screen_props("new-session").cloned())
        .unwrap();
    assert_eq!(
        (&props["hostId"], &props["projectCwds"]),
        (&json!("local"), &json!(["/work"]))
    );
    rig.asked();
    rig.click("new-start");
    let launched = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Launch { cwd, provider, .. }
            if cwd.as_deref() == Some("/work") && provider == "claude")
    });
    assert!(launched, "the New session screen's pick is launched");

    // startSession: the launch the New session panel sends.
    rig.asked();
    rig.ws(|ws, window, cx| {
        ws.run_command(
            "session.start",
            Some(&json!({"hostId": "local", "cwd": "/work", "agent": "claude"})),
            window,
            cx,
        )
    })
    .unwrap();
    let launched = rig.asked().into_iter().any(|c| {
        matches!(c, Command::Launch { host_id, cwd, provider }
            if host_id == "local" && cwd.as_deref() == Some("/work") && provider == "claude")
    });
    assert!(launched);
    let refused = rig.ws(|ws, window, cx| {
        ws.run_command("session.start", Some(&json!({"agent": "kiro"})), window, cx)
    });
    assert!(refused.is_err_and(|e| e.contains("kiro")));

    // A busy confirmation the window opened keeps Escape from it; one a mod opened cannot be
    // busy, so Escape always closes it.
    rig.ws(|ws, _, cx| {
        ws.open_screen(
            "confirm",
            json!({"message": "x", "busy": true}),
            None,
            None,
            cx,
        )
    });
    rig.draw();
    rig.press("escape");
    rig.draw();
    assert_eq!(
        rig.ws(|ws, _, _| ws.screens_open()),
        ["confirm"],
        "the window's busy one stays"
    );
    rig.ws(|ws, _, cx| ws.update_screen("confirm", json!({"busy": false}), cx));
    rig.press("escape");
    rig.draw();
    assert!(rig.ws(|ws, _, _| ws.screens_open()).is_empty());
    rig.write("status", OPENER);
    rig.draw();
    assert_eq!(
        rig.ws(|ws, _, _| ws.screens_open()),
        ["confirm"],
        "the mod opened it"
    );
    let props = rig
        .ws(|ws, _, _| ws.screen_props("confirm").cloned())
        .unwrap();
    assert_eq!(props.get("busy"), None, "a mod's busy is dropped");
    rig.press("escape");
    rig.draw();
    assert!(
        rig.ws(|ws, _, _| ws.screens_open()).is_empty(),
        "Escape closed it"
    );

    // `perch.terminals()` says `running` only while the terminal is attached, `exited` once the
    // core said its shell ended, and otherwise `unknown`: a tab in the strip is not evidence.
    rig.write("status", TERMINALS);
    let state = |rig: &mut Rig, id: &str| {
        rig.draw();
        let prefix = format!("term:{id}:");
        probe::records()
            .into_keys()
            .filter_map(|name| name.strip_prefix(prefix.as_str()).map(str::to_string))
            .collect::<Vec<_>>()
    };
    rig.ws(|ws, _, cx| {
        ws.sidebar().update(cx, |s, cx| {
            s.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    let (to_core, _asked_core) = unbounded::<ToCore>();
    let (core, from_core) = unbounded::<FromCore>();
    rig.ws(|ws, _, cx| {
        let view = ws.terminal().expect("a terminal").clone();
        view.update(cx, |view, cx| view.link(to_core, from_core, cx))
    });
    assert_eq!(state(&mut rig, "alpha"), ["unknown"], "attaching");
    core.unbounded_send(FromCore::Attached {
        replay: String::new(),
        input: true,
        resize: true,
        agent: None,
    })
    .unwrap();
    assert_eq!(state(&mut rig, "alpha"), ["running"], "attached");
    core.unbounded_send(FromCore::Exited(0)).unwrap();
    assert_eq!(
        state(&mut rig, "alpha"),
        ["exited"],
        "the core said it ended"
    );

    rig.cx
        .update_window(rig.window.into(), |_, window, _| window.remove_window())
        .unwrap();
    rig.cx.run_until_parked();
    let _ = std::fs::remove_dir_all(&scratch);
    let _: &Path = &scratch;
    println!("mods_screens: ok");
}
