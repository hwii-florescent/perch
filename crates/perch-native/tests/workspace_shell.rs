//! The window's frame as the web's StockWindow draws it, with the stock mods in it: a sidebar card, a main
//! card and, once opened, a drawer card, each round, on the theme's backdrop and 8 px apart, with the status
//! bar below them on the backdrop. The test fails when the window loses its cards, its backdrop, its 44 px
//! head row, its toggles, its drawer or its resize handles.
//!
//! Four states are drawn (nothing open, a session open, the sidebar collapsed, the drawer open); set
//! `PERCH_NATIVE_SHOT_DIR` to a folder to save each as `window-<state>.png`, the pictures the web's
//! `window` reference (`e2e/native-parity`) is set beside. Offscreen, as the other render tests: no window
//! is shown or focused, no core runs, and every press goes through the window's own dispatch.

use futures::channel::mpsc::unbounded;
use gpui::{
    point, px, size, AppContext as _, HeadlessAppContext, Modifiers, MouseButton, MouseDownEvent,
    MouseMoveEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use perch_core::protocol::ServerMessage;
use perch_native::mods::{self, theme, POLL};
use perch_native::shell::{self, Tools};
use perch_native::sidebar::{Model, State};
use perch_native::ui::Workspace;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

const WIDTH: f32 = 1100.;
const HEIGHT: f32 = 720.;
/// The status bar's height, below the cards.
const STATUS: f32 = 24.;

fn message(value: Value) -> ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// A connected core with no project.
fn empty() -> Model {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "server.info", "hostname": "studio", "isSsh": false, "platform": "macOS",
        "capabilities": ["workspace.snapshot"]})));
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": []})));
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [], "workspaces": []})));
    state.model()
}

/// A project with one session.
fn with_session() -> Model {
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
    state.apply(&message(json!({
        "type": "workspace.snapshot", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [project], "workspaces": [{
            "id": "w1", "projectId": "p", "hostId": "local", "path": "/work", "name": "w1",
            "dirty": false, "state": "active", "createdAt": 0, "updatedAt": 0, "pinned": false}]})));
    state.apply(&message(json!({"type": "session.list", "sessions": [{
        "id": "alpha", "title": "alpha", "cwd": "/work", "createdAt": 0, "status": "idle",
        "hostId": "local", "projectId": "p", "cliProviderId": "claude"}]})));
    state.model()
}

struct Rig {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

/// One frame: its pixels and the scale they were drawn at.
struct Frame {
    image: image::RgbaImage,
    scale: f32,
}

impl Frame {
    /// The colour at a logical position.
    fn at(&self, x: f32, y: f32) -> u32 {
        let p = self
            .image
            .get_pixel((x * self.scale) as u32, (y * self.scale) as u32);
        (p[0] as u32) << 16 | (p[1] as u32) << 8 | p[2] as u32
    }

    fn save(&self, name: &str) {
        if let Some(dir) = std::env::var_os("PERCH_NATIVE_SHOT_DIR") {
            let file = PathBuf::from(dir).join(format!("window-{name}.png"));
            self.image.save(file).expect("the picture is saved");
        }
    }
}

impl Rig {
    fn ws<R>(&mut self, f: impl FnOnce(&mut Workspace, &mut gpui::Context<Workspace>) -> R) -> R {
        self.window
            .update(&mut self.cx, |ws, _, cx| f(ws, cx))
            .unwrap()
    }

    /// Draws afresh, letting the mods' loads and commits settle first.
    fn frame(&mut self) -> Frame {
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
        let (image, scale) = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, _| {
                (
                    window.render_to_image().expect("offscreen render"),
                    window.scale_factor(),
                )
            })
            .unwrap();
        Frame { image, scale }
    }

    fn send(&mut self, event: PlatformInput) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(event, cx);
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    /// A key through the window's own dispatch.
    fn key(&mut self, spec: &str) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(
                    gpui::Keystroke::parse_with_os(spec, gpui::OperatingSystem::Mac).unwrap(),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn press(&mut self, x: f32, y: f32) {
        self.send(PlatformInput::MouseDown(MouseDownEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
            first_mouse: false,
        }));
    }

    fn release(&mut self, x: f32, y: f32) {
        self.send(PlatformInput::MouseUp(MouseUpEvent {
            button: MouseButton::Left,
            position: point(px(x), px(y)),
            modifiers: Modifiers::default(),
            click_count: 1,
        }));
    }

    fn click(&mut self, x: f32, y: f32) {
        self.press(x, y);
        self.release(x, y);
        // The pointer leaves, so nothing is drawn as hovered in the next frame.
        self.send(PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(1.), px(HEIGHT - 1.)),
            pressed_button: None,
            modifiers: Modifiers::default(),
        }));
    }

    /// Holds the handle at `from`, moves to `to` and lets go.
    fn drag(&mut self, from: (f32, f32), to: (f32, f32)) {
        self.press(from.0, from.1);
        self.frame();
        self.send(PlatformInput::MouseMove(MouseMoveEvent {
            position: point(px(to.0), px(to.1)),
            pressed_button: Some(MouseButton::Left),
            modifiers: Modifiers::default(),
        }));
        self.release(to.0, to.1);
    }
}

/// The colour `token` has in the default theme.
fn token(name: &str) -> u32 {
    let theme = theme::resolve(theme::DEFAULT);
    u32::from_str_radix(theme.token(name).unwrap().trim_start_matches('#'), 16).unwrap()
}

fn main() {
    let scratch: PathBuf =
        std::env::temp_dir().join(format!("perch-shell-window-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&scratch);
    std::fs::create_dir_all(scratch.join("home")).unwrap();
    std::env::set_var("HOME", scratch.join("home"));
    let user = scratch.join("native-mods");

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let (tx, _asked) = unbounded();
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(empty(), Some(tx), cx)
                    .with_core(|| Err(anyhow::anyhow!("no core in this test")))
            })
        })
        .unwrap();
    let workspace = window.entity(&cx).unwrap();
    cx.update(|cx| mods::start_in(user, &workspace, window.into(), cx));
    let mut rig = Rig { cx, window };

    let (backdrop, card) = (token("backdrop"), token("card-bg"));
    assert_ne!(backdrop, card, "the cards lift off the backdrop");
    let gutter = shell::GUTTER;
    let sidebar = shell::SIDEBAR_DEFAULT;
    let main_left = gutter + sidebar + gutter;
    let card_bottom = HEIGHT - STATUS;
    // The lights' room: the toggle sits `TOGGLE_INSET_MAC` into the sidebar card's head, 28 px wide, centred
    // in the 44 px row that starts `GUTTER` down.
    let head_middle = gutter + shell::HEAD / 2.;
    let toggle_x = gutter + shell::TOGGLE_INSET_MAC + 14.;

    // 1. Nothing open, the sidebar open: three layers (backdrop, cards, the status bar on the backdrop).
    let start = rig.frame();
    start.save("empty");
    assert_eq!(
        start.at(2., 2.),
        backdrop,
        "the window edge is the backdrop"
    );
    assert_eq!(start.at(WIDTH - 3., 2.), backdrop);
    assert_eq!(
        start.at(9., 9.),
        backdrop,
        "the sidebar card's corner is round"
    );
    assert_eq!(start.at(20., 20.), card, "the sidebar card");
    assert_eq!(start.at(30., 300.), card);
    assert_eq!(
        start.at(gutter + sidebar + gutter / 2., 300.),
        backdrop,
        "an 8 px gutter between the cards"
    );
    assert_eq!(start.at(main_left + 12., 300.), card, "the main card");
    assert_eq!(
        start.at(WIDTH - gutter - 12., 300.),
        card,
        "to 8 px of the edge"
    );
    assert_eq!(start.at(WIDTH - 4., 300.), backdrop);
    assert_eq!(
        start.at(main_left + 2., gutter + 2.),
        backdrop,
        "the main card's corner is round"
    );
    assert_eq!(
        start.at(30., card_bottom - 3.),
        card,
        "the cards run down to the status bar"
    );
    // What a mod paints square into a corner (the start page's fill) does not show past the rounding.
    assert_eq!(
        start.at(main_left + 2., card_bottom - 2.),
        backdrop,
        "the main card's bottom corner is round"
    );
    assert_eq!(start.at(WIDTH - gutter - 2., card_bottom - 2.), backdrop);
    assert_eq!(
        start.at(gutter + 2., card_bottom - 2.),
        backdrop,
        "the sidebar card's too"
    );
    assert_eq!(
        start.at(30., card_bottom + 3.),
        backdrop,
        "the status bar is on the backdrop"
    );
    assert_eq!(start.at(WIDTH - 3., HEIGHT - 3.), backdrop);
    assert_eq!(
        rig.ws(|ws, _| ws.drawer()),
        None,
        "the drawer starts closed"
    );
    // The 44 px head: the sidebar mod starts under it.
    let under_head = gutter + shell::HEAD;
    assert!(
        (0..4).any(|row| start.at(toggle_x, head_middle - 6. + row as f32 * 4.) != card),
        "the sidebar toggle is drawn in the head, past the traffic lights"
    );
    assert!(
        (0..40).all(|dy| start.at(30., gutter + 2. + dy as f32) == card),
        "nothing but the card fills the head's left of the lights ({under_head})"
    );

    // 2. A session open: the strip heads the main card, in the same 44 px row.
    rig.ws(|ws, cx| {
        ws.sidebar().update(cx, |sidebar, cx| {
            sidebar.apply(perch_native::client::Update::Model(with_session()), cx);
            sidebar.open("local".into(), "alpha".into(), Some("claude".into()), cx)
        })
    });
    let session = rig.frame();
    session.save("session");
    assert_eq!(session.at(9., 9.), backdrop);
    assert_eq!(session.at(30., 300.), card);
    assert_eq!(
        session.at(main_left + 1., 400.),
        card,
        "the main card around the terminal"
    );
    assert_eq!(session.at(30., card_bottom + 3.), backdrop);

    // 3. The sidebar collapsed by its toggle: no sidebar card, and the toggle heads the main card.
    rig.click(toggle_x, head_middle);
    assert!(!rig.ws(|ws, cx| ws.sidebar().read(cx).visible()));
    let collapsed = rig.frame();
    collapsed.save("collapsed");
    assert_eq!(
        collapsed.at(9., 9.),
        backdrop,
        "the main card now starts at the edge"
    );
    assert_eq!(collapsed.at(20., 20.), card);
    assert_eq!(
        collapsed.at(gutter + 1., 300.),
        card,
        "the main card starts where the sidebar card was"
    );
    assert_ne!(
        collapsed.at(gutter + sidebar + gutter / 2., 300.),
        backdrop,
        "no gutter where the sidebar was"
    );
    assert_eq!(collapsed.at(WIDTH - 4., 300.), backdrop);
    assert!(
        (0..4).any(|row| collapsed.at(toggle_x, head_middle - 6. + row as f32 * 4.) != card),
        "the toggle is in the main card's head, clear of the lights"
    );
    rig.click(toggle_x, head_middle);
    assert!(
        rig.ws(|ws, cx| ws.sidebar().read(cx).visible()),
        "the toggle shows it again"
    );

    // 4. The drawer: opened by the main head's toggle, a card on the right with the tabs and a hand-off.
    let drawer_toggle = (WIDTH - gutter - 8. - 14., head_middle);
    rig.click(drawer_toggle.0, drawer_toggle.1);
    assert_eq!(rig.ws(|ws, _| ws.drawer()), Some(Tools::Files));
    let drawer = rig.frame();
    drawer.save("drawer");
    // 46% of the window, less than what leaves the main card 320 beside the sidebar: 506.
    let width = 506.;
    let drawer_left = WIDTH - gutter - width;
    assert_eq!(drawer.at(drawer_left + 12., 400.), card, "the drawer card");
    assert_eq!(
        drawer.at(drawer_left - gutter / 2., 400.),
        backdrop,
        "a gutter before it"
    );
    assert_eq!(
        drawer.at(drawer_left - gutter - 1., 400.),
        card,
        "the main card ends before it"
    );
    assert_eq!(drawer.at(WIDTH - 4., 400.), backdrop);
    // The drawer's head carries its toggle, so the main card's own is gone.
    // Git is the second tab: 8 px in, "Files" 53 px wide, 2 px between.
    rig.click(drawer_left + 8. + 53. + 2. + 20., head_middle);
    assert_eq!(rig.ws(|ws, _| ws.drawer()), Some(Tools::Git));
    rig.click(WIDTH - gutter - 8. - 14., head_middle);
    assert_eq!(
        rig.ws(|ws, _| ws.drawer()),
        None,
        "the drawer's toggle closes it"
    );
    rig.click(drawer_toggle.0, drawer_toggle.1);
    assert_eq!(
        rig.ws(|ws, _| ws.drawer()),
        Some(Tools::Git),
        "it reopens on the tab it had"
    );
    // The web's key toggles it too (Cmd+Shift+B; Alt+Shift+B elsewhere).
    let drawer_key = if cfg!(target_os = "macos") {
        "cmd-shift-b"
    } else {
        "alt-shift-b"
    };
    rig.key(drawer_key);
    assert_eq!(
        rig.ws(|ws, _| ws.drawer()),
        None,
        "the key closes the drawer"
    );
    rig.key(drawer_key);
    assert_eq!(
        rig.ws(|ws, _| ws.drawer()),
        Some(Tools::Git),
        "and opens it again"
    );

    // Handles: the gutter beside a column resizes it, within the web's bounds.
    let gap = drawer_left - gutter / 2.;
    rig.drag((gap, 400.), (gap + 100., 400.));
    let narrower = rig.frame();
    assert_ne!(
        narrower.at(gap + 4., 400.),
        backdrop,
        "the drawer's old gutter is the main card now"
    );
    assert_eq!(
        narrower.at(drawer_left + 100. - gutter / 2., 400.),
        backdrop,
        "a new gutter 100 px right"
    );
    let sidebar_gap = gutter + sidebar + gutter / 2.;
    rig.drag((sidebar_gap, 400.), (sidebar_gap + 60., 400.));
    let wider = rig.frame();
    assert_eq!(
        wider.at(gutter + sidebar + 30., 400.),
        card,
        "the sidebar card grew by 60"
    );
    assert_eq!(wider.at(sidebar_gap + 60., 400.), backdrop);
    rig.drag((sidebar_gap + 60., 400.), (0., 400.));
    let least = rig.frame();
    assert_eq!(
        least.at(gutter + shell::SIDEBAR_MIN + gutter / 2., 400.),
        backdrop,
        "no narrower than 180"
    );
    println!("workspace_shell: ok");
    let _ = std::fs::remove_dir_all(scratch);
}
