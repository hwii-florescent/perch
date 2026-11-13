//! The stock chrome screens in a real window: the `tabs` mod is the tab strip (a tab per open
//! session, the shown one marked, a click shows a tab, its × closes it, a right click opens the tab's
//! menu, + opens the New session screen), the `status` mod is the status line (its zoom button resets the
//! zoom) and the `pane-header` mod heads each pane of a split (leave the split, close the pane).
//! Each copy of a React screen is its own: a pane's header redraws by itself, a screen keeps its own
//! `document` while others open over it, a closed one leaves nothing running, and a copy's timers
//! outlive the screens opened after it.
//!
//! Offscreen, as the other render tests: no window is shown or focused, no core runs, and every event
//! goes through the window's own dispatch.

use futures::channel::mpsc::unbounded;
use gpui::{
    px, size, AppContext as _, HeadlessAppContext, Keystroke, Modifiers, MouseButton,
    MouseDownEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::client::{Command, Update};
use perch_native::mods::{self, POLL};
use perch_native::sidebar::{Alert, Heard, State, Toast};
use perch_native::ui::{Workspace, SIDEBAR_WIDTH};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

/// A New session screen that only shows the props it was opened with, and what the React runtime
/// holds: its live copies by screen and how many listeners they have on the window's data (all mods
/// share one script context, so a plain mod can read the runtime's registry).
const NEW_SESSION: &str = r##"
import { View, div } from "gpui-kit";
import * as perch from "perch";
export default class extends View {
  render() {
    let el = div().id(`new-session-for-${perch.props().hostId}`).size_full().bg("#202020");
    const copies = [...(globalThis[Symbol.for("perch.react.copies")] ?? [])];
    const count = {};
    for (const copy of copies) count[copy.screen] = (count[copy.screen] ?? 0) + 1;
    for (const [screen, n] of Object.entries(count)) el = el.child(div().id(`react-copies:${screen}=${n}`).h(1));
    const listeners = copies.reduce((sum, copy) => sum + copy.listening(), 0);
    return el.child(div().id(`react-listeners=${listeners}`).h(1));
  }
}
"##;

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 600.;

/// Copies folder `from` to `to`, as a person copies a stock mod to edit it.
fn copy_dir(from: &std::path::Path, to: &std::path::Path) {
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

/// A session's notification, as the window hears one.
fn heard(alert: Alert, session_id: &str) -> Heard {
    Heard {
        alert,
        session_id: session_id.into(),
        title: session_id.into(),
        sound: false,
        file: None,
        toast: Toast::App,
        body: None,
    }
}

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project, holding an idle session per title.
fn state(titles: &[&str]) -> State {
    state_with(titles, &[])
}

/// One project, holding a session per title, waiting for the person when it is in `blocked`.
fn state_with(titles: &[&str], blocked: &[&str]) -> State {
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
                "hostId": "local", "projectId": "p", "cliProviderId": "claude",
                "blocked": blocked.contains(title)})
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

    fn press(&mut self, spec: &str) {
        let keystroke = Keystroke::parse(spec).unwrap();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap();
        self.cx.run_until_parked();
        self.draw();
    }

    /// Types `text` a key at a time where the keyboard is.
    fn type_text(&mut self, text: &str) {
        for c in text.chars() {
            let keystroke = Keystroke {
                modifiers: Modifiers::default(),
                key: c.to_string(),
                key_char: Some(c.to_string()),
            };
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, cx| {
                    window.dispatch_keystroke(keystroke, cx)
                })
                .unwrap();
            self.cx.run_until_parked();
        }
        self.draw();
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
    let (tx, mut asked) = unbounded();
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
    cx.update(|cx| mods::start_in(user.clone(), &workspace, window.into(), cx));
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
    let menu = rig.ws(|ws, _, _| ws.screens_open());
    assert!(
        menu.contains(&"tab-menu") || menu.contains(&"pane-menu"),
        "tab.menu opened a menu: {menu:?}"
    );
    rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
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

    // Plan usage: the status bar asks the core once it is up (and every 3 minutes after, as the
    // web's does), and shows the core's answer.
    let usage_asks = std::iter::from_fn(|| asked.try_recv().ok())
        .filter(|c| matches!(c, Command::UsageGet { force: false }))
        .count();
    assert_eq!(usage_asks, 1, "usage.get went out once on connect");
    assert!(rig.keys("usage-account").is_empty(), "no answer yet");
    let mut answered = state(&["alpha", "bravo", "charlie"]);
    answered.usage_result(
        json!([
            {"provider": "claude", "label": "dev@example.com", "plan": "Max 5x",
             "windows": [{"label": "5h", "usedPercent": 42, "windowMinutes": 300,
                          "resetsAt": 1767312000}]},
            {"provider": "codex", "label": "dev@example.com", "plan": "Plus",
             "windows": [{"label": "5h", "usedPercent": 93, "windowMinutes": 300,
                          "resetsAt": 1767312000}]},
        ]),
        Value::Null,
        1767312000000,
    );
    let model = answered.model();
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
    });
    rig.draw();
    let account = rig
        .record("usage-account")
        .expect("the answer reaches the status bar");
    assert!(
        account.bounds.size.width > px(40.),
        "an account and its window"
    );
    assert!(
        rig.record("usage-account@1").is_some(),
        "and the other account"
    );
    assert!(rig.record("usage-unavailable").is_none());

    // The window's size is the screens' viewport: below 900 px the middle block goes, and it
    // comes back when the window widens, without a restart.
    let resize = |rig: &mut Rig, width: f32| {
        rig.cx
            .update_window(rig.window.into(), |_, window: &mut Window, cx| {
                window.resize(size(px(width), px(HEIGHT)));
                window.bounds_changed(cx);
            })
            .unwrap();
        rig.draw();
    };
    rig.ws(|ws, window, cx| ws.run_command("app.zoom_in", None, window, cx))
        .unwrap();
    assert!(
        rig.record("status-details").is_some(),
        "wide: details shown"
    );
    resize(&mut rig, 850.);
    assert!(
        rig.record("status-details").is_none(),
        "narrow: details hidden"
    );
    resize(&mut rig, WIDTH);
    assert!(rig.record("status-details").is_some(), "wide again");
    rig.ws(|ws, window, cx| ws.run_command("app.zoom_reset", None, window, cx))
        .unwrap();
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

    // Each pane's header is its own copy of the mod: when a split moves on, the header that stays
    // and the new one both redraw when their sessions change.
    split(&mut rig, "charlie");
    split(&mut rig, "delta");
    assert_eq!(
        rig.ws(|ws, _, _| ws.tabs().shown().to_vec()),
        ["charlie", "delta"],
        "the split moved on"
    );
    let dot = |rig: &mut Rig, id: &str| {
        rig.record(&format!("pane-header-state-dot:{id}"))
            .unwrap_or_else(|| panic!("{id}'s state dot is drawn"))
            .background
    };
    let before = (dot(&mut rig, "charlie"), dot(&mut rig, "delta"));
    let model = state_with(
        &["alpha", "bravo", "charlie", "delta"],
        &["charlie", "delta"],
    )
    .model();
    rig.ws(|ws, _, cx| {
        ws.sidebar()
            .update(cx, |sidebar, cx| sidebar.apply(Update::Model(model), cx))
    });
    rig.draw();
    assert_ne!(
        dot(&mut rig, "charlie"),
        before.0,
        "the header that stayed redrew"
    );
    assert_ne!(dot(&mut rig, "delta"), before.1, "the new header redrew");
    println!("mods_chrome_window: a header per copy ok");

    // A copy keeps its own document while others come and go: with the Navigator open a card
    // mounts the toast, and the Navigator's key listener, which its source adds to `document` again
    // as the list narrows, is still on the Navigator's own document, so Enter picks the row.
    let palette = |rig: &mut Rig| {
        rig.ws(|ws, window, cx| ws.run_command("app.palette", None, window, cx))
            .unwrap();
        rig.draw();
    };
    palette(&mut rig);
    assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["navigator"]);
    rig.ws(|ws, _, cx| ws.toast(heard(Alert::Done, "charlie"), cx));
    rig.draw();
    assert!(rig.record("toast-card").is_some(), "the card is up");
    rig.type_text("brav");
    rig.press("enter");
    assert!(
        !rig.ws(|ws, _, _| ws.screens_open()).contains(&"navigator"),
        "Enter closed the Navigator"
    );
    assert_eq!(rig.active().as_deref(), Some("bravo"), "and picked the row");
    rig.cx.advance_clock(Duration::from_secs(7));
    rig.draw();
    assert!(
        rig.ws(|ws, _, _| ws.screens_open()).is_empty(),
        "the card went"
    );

    // A copy that leaves the window goes: opened and closed again and again, the Navigator leaves
    // no copy behind and nothing listening on the window's data.
    let held = |rig: &mut Rig| {
        rig.click("tab-new");
        let mut held: Vec<String> = rig
            .draw()
            .into_iter()
            .filter_map(|r| r.name.strip_prefix("react-").map(str::to_string))
            .collect();
        held.sort();
        rig.ws(|ws, window, cx| ws.run_command("overlay.close", None, window, cx))
            .unwrap();
        rig.draw();
        held
    };
    let before = held(&mut rig);
    assert!(
        !before.iter().any(|h| h.starts_with("copies:navigator")),
        "the closed Navigator is gone: {before:?}"
    );
    for _ in 0..3 {
        palette(&mut rig);
        assert_eq!(rig.ws(|ws, _, _| ws.screens_open()), ["navigator"]);
        palette(&mut rig);
    }
    assert_eq!(held(&mut rig), before, "nothing left behind");

    // A person's copy of a screen takes over from the stock one and reloads on each save, and
    // removing it gives the stock one back: each time the copy it replaced goes, so one status
    // bar is one live copy.
    let status_copies = |rig: &mut Rig| {
        let held = held(rig);
        held.iter()
            .find_map(|h| h.strip_prefix("copies:status=").map(str::to_string))
            .unwrap_or_default()
    };
    let mine = user.join("status");
    copy_dir(&user.join(".stock/status"), &mine);
    rig.draw();
    assert_eq!(status_copies(&mut rig), "1", "the person's copy took over");
    let main = std::fs::read_to_string(mine.join("main.js")).unwrap();
    for edit in 1..=2 {
        std::fs::write(mine.join("main.js"), format!("{main}\n// edit {edit}\n")).unwrap();
        rig.draw();
        assert!(
            rig.record("status-bar").is_some(),
            "the edited bar is drawn"
        );
        assert_eq!(status_copies(&mut rig), "1", "save {edit} left one copy");
    }
    std::fs::remove_dir_all(&mine).unwrap();
    rig.draw();
    assert!(rig.record("status-bar").is_some(), "the stock bar is back");
    assert_eq!(status_copies(&mut rig), "1", "the stock one is back alone");
    // Each copy's timers are its own: with every screen opened after the status bar closed again,
    // the bar's 3-minute usage loop still takes its turns.
    let usage_asks = |asked: &mut futures::channel::mpsc::UnboundedReceiver<Command>| {
        std::iter::from_fn(|| asked.try_recv().ok())
            .filter(|c| matches!(c, Command::UsageGet { force: false }))
            .count()
    };
    usage_asks(&mut asked);
    for _ in 0..2 {
        rig.cx.advance_clock(Duration::from_secs(180));
        rig.draw();
        assert_eq!(usage_asks(&mut asked), 1, "a turn every 3 minutes");
    }
    println!("mods_chrome_window: copies of a screen ok");

    let _ = std::fs::remove_dir_all(&scratch);
    println!("mods_chrome_window: ok");
}
