//! A strip that overflows draws its tabs only inside its own bounds: with the sidebar open and a
//! long strip (sessions, a stack, plain terminals, files), at widths that overflow, scrolled to the
//! start and to the end, after a tab is added and after a drag, no part of any tab shows left of
//! the strip's start (under the sidebar) or right of its end. The active tab stays in view.
//!
//! "Shows" is the tab's box cut by the clip GPUI draws it under (`ProbeRecord::mask`): a tab
//! scrolled out of the strip keeps its laid-out box, which is fine as long as nothing of it is
//! drawn there.
//!
//! Offscreen, no core: no window is shown or focused, every event goes through the window's own
//! dispatch.

use futures::channel::mpsc::unbounded;
use gpui::{
    point, px, size, AppContext as _, Bounds, HeadlessAppContext, Modifiers, MouseButton,
    MouseDownEvent, MouseMoveEvent, MouseUpEvent, Pixels, PlatformInput, Window, WindowHandle,
};
use gpui_shell::probe::{self, ProbeRecord};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, POLL};
use perch_native::sidebar::State;
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

const HEIGHT: f32 = 700.;
const SESSIONS: usize = 15;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// `lead` with sub-sessions `sub1`, `sub2`, then `s0`.. (every third a plain terminal).
fn state() -> State {
    let project = json!({"id": "p", "hostId": "local", "name": "Work", "path": "/work",
        "favorite": false, "createdAt": 0, "updatedAt": 0});
    let checkout = json!({"id": "w1", "projectId": "p", "hostId": "local", "path": "/work",
        "name": "w1", "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0,
        "pinned": false});
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot", "workspace.order.v1"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project.clone()]})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [checkout]})));
    let ids = ids();
    let sessions: Vec<Value> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| {
            let parent = id.starts_with("sub").then_some("lead");
            let provider = (i % 3 != 2).then_some("claude");
            json!({"id": id, "title": format!("{id} a longer title"), "cwd": "/work",
                "createdAt": i, "status": "idle", "hostId": "local", "projectId": "p",
                "workspaceId": "w1", "cliProviderId": provider, "parentSessionId": parent})
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state
}

fn ids() -> Vec<String> {
    ["lead", "sub1", "sub2"]
        .into_iter()
        .map(str::to_string)
        .chain((0..SESSIONS).map(|n| format!("s{n}")))
        .collect()
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

fn x(b: &Bounds<Pixels>) -> (f32, f32) {
    let l = f32::from(b.origin.x);
    (l, l + f32::from(b.size.width))
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

    fn input(&mut self, input: PlatformInput) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(input, cx);
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn resize(&mut self, width: f32) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, _| {
                window.resize(size(px(width), px(HEIGHT)));
            })
            .unwrap();
    }

    /// Every tab part drawn outside the strip, and whether the active tab shows whole. Panics
    /// when the strip does not overflow: the case under test.
    fn check(&mut self, when: &str) {
        let records = self.draw();
        if let Ok(dir) = std::env::var("SHOT") {
            self.cx
                .update_window(self.window.into(), |_, window: &mut Window, _| {
                    let image = window.render_to_image().unwrap();
                    let name = when.replace(' ', "-");
                    image
                        .save(std::path::Path::new(&dir).join(format!("overflow-{name}.png")))
                        .unwrap();
                })
                .unwrap();
        }
        let strip = records
            .iter()
            .find(|r| r.name == "tab-strip")
            .unwrap_or_else(|| panic!("{when}: the strip is drawn"));
        let (sl, sr) = x(&strip.bounds);
        let sidebar_right = records
            .iter()
            .filter(|r| r.name.starts_with("session-button:"))
            .map(|r| x(&r.bounds).1)
            .fold(0f32, f32::max);
        assert!(
            sidebar_right > 0. && sidebar_right <= sl + 1.,
            "{when}: the sidebar is open, left of the strip ({sidebar_right} vs {sl})"
        );
        let parts: Vec<&ProbeRecord> = records
            .iter()
            .filter(|r| {
                ["tab-slot:", "tab:", "tab-label:", "tab-close:"]
                    .iter()
                    .any(|p| r.name.starts_with(p))
            })
            .collect();
        let overflowing = parts
            .iter()
            .any(|r| x(&r.bounds).0 < sl - 0.5 || x(&r.bounds).1 > sr + 0.5);
        assert!(overflowing, "{when}: the strip overflows ({sl}..{sr})");
        let mut astray = Vec::new();
        for r in &parts {
            let (bl, br) = x(&r.bounds);
            let (ml, mr) = x(&r.mask);
            let (l, r_) = (bl.max(ml), br.min(mr));
            if r_ - l > 0.5 && (l < sl - 0.5 || r_ > sr + 0.5) {
                astray.push(format!(
                    "{} shows {l}..{r_} (box {bl}..{br}, clip {ml}..{mr})",
                    r.name
                ));
            }
        }
        assert!(
            astray.is_empty(),
            "{when}: tab parts drawn outside the strip {sl}..{sr}: {astray:#?}"
        );
        let active = self
            .ws(|ws, _, _| ws.tabs().active().map(str::to_string))
            .unwrap();
        let slot = records
            .iter()
            .find(|r| r.name == format!("tab-slot:{active}").as_str())
            .unwrap_or_else(|| panic!("{when}: the active tab {active} is drawn"));
        let (al, ar) = x(&slot.bounds);
        assert!(
            al >= sl - 0.5 && ar <= sr + 0.5,
            "{when}: the active tab {active} is in view ({al}..{ar} in {sl}..{sr})"
        );
    }

    fn show(&mut self, id: &str) {
        let id = id.to_string();
        self.ws(|ws, _, cx| {
            ws.sidebar().update(cx, |s, cx| {
                s.open("local".into(), id, Some("claude".into()), cx)
            })
        });
    }

    fn center(&mut self, name: &str) -> (f32, f32) {
        let r = self
            .draw()
            .into_iter()
            .find(|r| r.name == name)
            .unwrap_or_else(|| panic!("{name} is drawn"));
        let c = r.bounds.center();
        (f32::from(c.x), f32::from(c.y))
    }

    fn drag(&mut self, from: (f32, f32), dx: f32) {
        let at = |x: f32| point(px(x), px(from.1));
        self.input(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: at(from.0),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
        self.draw();
        for k in 1..=8 {
            self.input(PlatformInput::MouseMove(MouseMoveEvent {
                position: at(from.0 + dx * k as f32 / 8.),
                pressed_button: Some(MouseButton::Left),
                modifiers: Modifiers::default(),
            }));
            self.draw();
        }
        self.input(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: at(from.0 + dx),
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
        self.draw();
    }
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-tab-overflow-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let model = state().model();
    let window = cx
        .open_window(size(px(1100.), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(model, Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(scratch.join("native-mods"), &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };
    for id in ids() {
        rig.show(&id);
    }
    for name in ["notes.md", "README.md"] {
        rig.ws(|ws, _, cx| ws.open_file("w1", name, false, cx));
    }
    rig.draw();
    let strip = rig.ws(|ws, _, _| ws.tabs().strip().to_vec());
    assert!(strip.len() >= 18, "a long strip: {strip:?}");

    for width in [1100., 800., 1400.] {
        rig.resize(width);
        // Scrolled to the start, then to the end, then back to the middle.
        rig.show("lead");
        rig.check(&format!("{width} at the start"));
        rig.ws(|ws, _, cx| ws.open_file("w1", "README.md", false, cx));
        rig.check(&format!("{width} at the end"));
        rig.show("s7");
        rig.check(&format!("{width} in the middle"));
    }

    rig.resize(1000.);
    // A tab added at the end of a strip scrolled to the start.
    rig.show("lead");
    rig.check("before adding");
    rig.ws(|ws, _, cx| ws.open_file("w1", "added.md", false, cx));
    rig.check("after adding a tab");
    rig.show("s1");
    rig.check("back near the start after adding");

    // A drag along the strip, from the middle and from the start.
    rig.show("s5");
    let at = rig.center("tab:s5");
    rig.drag(at, -180.);
    rig.check("after dragging a middle tab left");
    rig.show("lead");
    let at = rig.center("tab:sub1");
    rig.drag(at, 260.);
    rig.check("after dragging a stack member");

    let _ = std::fs::remove_dir_all(&scratch);
}
