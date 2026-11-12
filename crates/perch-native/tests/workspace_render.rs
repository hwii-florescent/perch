//! Draws the window offscreen with several sessions open and checks what it shows: tabs, a split
//! with different content in each pane, the command palette, the terminal settings and an
//! attention mark on a tab. Keys go through the window's own key path (`dispatch_keystroke`), so
//! the dispatcher that runs before the terminal is what is tested. No window is created, shown or
//! focused, and no core is involved: the terminals are fed what a core would send.

use gpui::{px, size, AppContext, HeadlessAppContext, Keystroke, Window, WindowHandle};
use perch_native::client::Update;
use perch_native::sidebar::{Attention, Model, State};
use perch_native::terminal::attach::FromCore;
use perch_native::ui::{tint, Workspace, SIDEBAR_WIDTH};
use perch_native::workspace::TAB_BAR_HEIGHT;
use serde_json::{json, Value};
use std::sync::Arc;

fn message(value: Value) -> perch_core::protocol::ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project that can start a terminal, holding a session per `(id, flags)`.
fn model(sessions: &[(&str, Value)]) -> Model {
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [{
            "id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
            "createdAt": 0, "updatedAt": 0}]})));
    state.apply(&message(
        json!({"type": "agent.manifest.list", "requestId": "r", "manifests": [
        {"id": "terminal", "displayName": "Terminal", "supportedModes": ["cli"],
         "resumability": "none", "capabilities": ["interactiveTerminal"],
         "statusDetection": "none", "available": true}]}),
    ));
    let sessions: Vec<Value> = sessions
        .iter()
        .map(|(id, flags)| {
            let mut session = json!({
                "id": id, "title": id, "cwd": "/work", "createdAt": 0, "status": "idle",
                "hostId": "local", "projectId": "p", "cliProviderId": "claude"});
            for (key, value) in flags.as_object().unwrap() {
                session[key] = value.clone();
            }
            session
        })
        .collect();
    state.apply(&message(
        json!({"type": "session.list", "sessions": sessions}),
    ));
    state.model()
}

struct Shot {
    raw: Vec<u8>,
    width: usize,
    scale: f32,
}

impl Shot {
    /// Pixels of `color` (within rounding) inside the box `x0..x1`, `y0..y1` (logical pixels).
    fn count(&self, color: u32, x0: f32, x1: f32, y0: f32, y1: f32) -> usize {
        let want = [(color >> 16) as u8, (color >> 8) as u8, color as u8];
        let (x0, x1) = ((x0 * self.scale) as usize, (x1 * self.scale) as usize);
        let (y0, y1) = ((y0 * self.scale) as usize, (y1 * self.scale) as usize);
        self.raw
            .chunks_exact(self.width * 4)
            .enumerate()
            .filter(|(y, _)| (y0..y1).contains(y))
            .map(|(_, row)| {
                row.chunks_exact(4)
                    .enumerate()
                    .filter(|(x, p)| {
                        (x0..x1).contains(x)
                            && p[..3].iter().zip(want).all(|(a, b)| a.abs_diff(b) <= 2)
                    })
                    .count()
            })
            .sum()
    }

    /// Near-white pixels: bright text.
    fn bright(&self, x0: f32, x1: f32, y0: f32, y1: f32) -> usize {
        let (x0, x1) = ((x0 * self.scale) as usize, (x1 * self.scale) as usize);
        let (y0, y1) = ((y0 * self.scale) as usize, (y1 * self.scale) as usize);
        self.raw
            .chunks_exact(self.width * 4)
            .enumerate()
            .filter(|(y, _)| (y0..y1).contains(y))
            .map(|(_, row)| {
                row.chunks_exact(4)
                    .enumerate()
                    .filter(|(x, p)| (x0..x1).contains(x) && p[..3].iter().all(|c| *c >= 0xc0))
                    .count()
            })
            .sum()
    }
}

const WIDTH: f32 = 1000.;
const HEIGHT: f32 = 520.;

struct Harness {
    cx: HeadlessAppContext,
    window: WindowHandle<Workspace>,
}

impl Harness {
    fn new(model: Model) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                // A core that cannot be found: every tab gets a terminal that has no shell.
                cx.new(|cx| {
                    Workspace::new(model, None, cx)
                        .with_core(|| Err(anyhow::anyhow!("no core in this test")))
                })
            })
            .unwrap();
        Self { cx, window }
    }

    fn open(&mut self, id: &str) {
        let id = id.to_string();
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                ws.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id, Some("terminal".into()), cx)
                })
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn draw(&mut self) -> Shot {
        let (image, scale) = self
            .cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                let _ = window.draw(cx);
                (
                    window.render_to_image().expect("offscreen render"),
                    window.scale_factor(),
                )
            })
            .unwrap();
        // Set SHOT to a folder to look at each frame.
        if let Ok(dir) = std::env::var("SHOT") {
            static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let n = N.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let _ = image.save(format!("{dir}/frame-{n:03}.png"));
        }
        Shot {
            width: image.width() as usize,
            raw: image.into_raw(),
            scale,
        }
    }

    /// A key through the window's own path. True when the window took it.
    fn press(&mut self, spec: &str) -> bool {
        let keystroke = Keystroke::parse(spec).unwrap();
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_keystroke(keystroke, cx)
            })
            .unwrap()
    }

    fn type_text(&mut self, text: &str) {
        for c in text.chars() {
            self.press(&c.to_string());
        }
    }

    fn ws<R>(&mut self, f: impl FnOnce(&Workspace) -> R) -> R {
        self.window.update(&mut self.cx, |ws, _, _| f(ws)).unwrap()
    }

    /// The core sent this screen to the pane of `index` among those on screen.
    fn show(&mut self, index: usize, screen: &str) {
        let views = self.ws(|ws| ws.terminals());
        let view = views[index].1.clone();
        self.window
            .update(&mut self.cx, |_, _, cx| {
                view.update(cx, |view, cx| {
                    view.core_said(
                        FromCore::Attached {
                            replay: screen.into(),
                            input: false,
                            resize: false,
                            agent: None,
                        },
                        cx,
                    )
                })
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    fn strip(&mut self) -> Vec<String> {
        self.ws(|ws| ws.tabs().strip().to_vec())
    }

    fn active(&mut self) -> Option<String> {
        self.ws(|ws| ws.tabs().active().map(str::to_string))
    }

    fn shown(&mut self) -> Vec<String> {
        self.ws(|ws| ws.tabs().shown())
    }
}

/// A screen filled with one colour.
fn filled(r: u8, g: u8, b: u8) -> String {
    format!("\x1b[48;2;{r};{g};{b}m\x1b[2J")
}

fn two_tabs() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    let area = SIDEBAR_WIDTH..WIDTH;
    let bar = (0.0, TAB_BAR_HEIGHT);

    // Nothing open: no tab strip, a quiet main area.
    let empty = h.draw();
    assert_eq!(h.strip(), Vec::<String>::new());
    assert_eq!(empty.bright(area.start, area.end, 0.0, HEIGHT), 0);

    // Two sessions open at once are two tabs, and the second has the keyboard.
    h.open("alpha");
    h.open("bravo");
    assert_eq!(h.strip(), ["alpha", "bravo"]);
    assert_eq!(h.active().as_deref(), Some("bravo"));
    // Only the tab on screen has a terminal laid out; the other is kept and not drawn.
    assert_eq!(h.shown(), ["bravo"]);
    assert_eq!(h.ws(|ws| ws.terminals().len()), 1);
    let both = h.draw();
    assert!(
        both.bright(area.start, area.end, bar.0, bar.1) > 20,
        "the active tab's title is drawn in the strip"
    );

    // The keys of the web's table switch tabs, and the window takes them before the terminal.
    assert!(h.press("cmd-1"), "tabs.jump1 is taken");
    assert_eq!(h.active().as_deref(), Some("alpha"));
    assert!(h.press("cmd-shift-]"), "tabs.next is taken");
    assert_eq!(h.active().as_deref(), Some("bravo"));
    assert!(h.press("cmd-shift-["));
    assert_eq!(h.active().as_deref(), Some("alpha"));
    assert!(h.press("cmd-9"), "tabs.last");
    assert_eq!(h.active().as_deref(), Some("bravo"));
    // A key nothing binds is left for the terminal.
    assert!(!h.press("x") || h.ws(|ws| ws.notice().is_none()));
    // The terminal on screen is the one with the keyboard.
    h.draw();
    let focused = h.ws(|ws| ws.terminal().cloned()).unwrap();
    let on_screen = h
        .window
        .update(&mut h.cx, |_, window, cx| {
            gpui::Focusable::focus_handle(&focused, cx).is_focused(window)
        })
        .unwrap();
    assert!(on_screen, "the shown tab's terminal holds the keyboard");

    // Closing a tab shows the next, and the window is quiet again when none is left. These
    // sessions are not terminals this window types for, so closing only puts them away.
    assert!(h.press("cmd-w"));
    assert_eq!(h.strip(), ["alpha"]);
    assert_eq!(h.active().as_deref(), Some("alpha"));
    assert!(h.press("cmd-w"));
    assert_eq!(h.strip(), Vec::<String>::new());
    assert!(h.ws(|ws| ws.open().is_none()));
    println!("workspace_render: two tabs ok");
}

fn attention_on_a_tab() {
    let tab_bar_dot = |h: &mut Harness, attention: Attention| {
        h.draw()
            .count(tint(attention).0, SIDEBAR_WIDTH, WIDTH, 0.0, TAB_BAR_HEIGHT)
    };
    let mut quiet = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    quiet.open("alpha");
    quiet.open("bravo");
    assert_eq!(
        tab_bar_dot(&mut quiet, Attention::NeedsYou),
        0,
        "no tab needs you"
    );

    // alpha needs you while bravo is the tab being read: alpha's tab says so, in the strip.
    let mut h = Harness::new(model(&[
        ("alpha", json!({"blocked": true})),
        ("bravo", json!({})),
    ]));
    h.open("alpha");
    h.open("bravo");
    assert!(
        tab_bar_dot(&mut h, Attention::NeedsYou) > 10,
        "the tab of a session that needs you has the red dot"
    );
    let fill = h.draw().count(
        tint(Attention::NeedsYou).1,
        SIDEBAR_WIDTH,
        WIDTH,
        0.0,
        TAB_BAR_HEIGHT,
    );
    assert!(fill > 30, "and its label ({fill} fill pixels)");
    // The mark is live: when the core says the session is no longer waiting, it goes.
    let settled = model(&[("alpha", json!({})), ("bravo", json!({}))]);
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(settled), cx))
        })
        .unwrap();
    assert_eq!(tab_bar_dot(&mut h, Attention::NeedsYou), 0);
    println!("workspace_render: attention mark ok");
}

fn a_split_shows_each_pane() {
    let mut h = Harness::new(model(&[("alpha", json!({}))]));
    h.open("alpha");
    // Splitting right asks the core for a terminal beside the focused one; nothing is split until
    // the core says the session exists.
    assert!(h.press("cmd-d"), "panes.splitRight is taken");
    assert_eq!(h.shown(), ["alpha"]);
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar().update(cx, |sidebar, cx| {
                sidebar.apply(
                    Update::Launched {
                        host_id: "local".into(),
                        session_id: "bravo".into(),
                        provider: "terminal".into(),
                    },
                    cx,
                )
            })
        })
        .unwrap();
    h.cx.run_until_parked();
    assert_eq!(h.shown(), ["alpha", "bravo"]);
    assert_eq!(h.strip(), ["alpha", "bravo"], "both are tabs");
    assert_eq!(
        h.active().as_deref(),
        Some("bravo"),
        "the new pane has the keyboard"
    );

    // A different screen in each pane.
    h.draw();
    h.show(0, &filled(200, 0, 0));
    h.show(1, &filled(0, 170, 0));
    let shot = h.draw();
    let mid = SIDEBAR_WIDTH + (WIDTH - SIDEBAR_WIDTH) / 2.0;
    let (below_bar, bottom) = (TAB_BAR_HEIGHT + 20.0, HEIGHT - 20.0);
    let red = |x0, x1| shot.count(0xc80000, x0, x1, below_bar, bottom);
    let green = |x0, x1| shot.count(0x00aa00, x0, x1, below_bar, bottom);
    let (left, right) = ((SIDEBAR_WIDTH, mid), (mid, WIDTH));
    assert!(red(left.0, left.1) > 20_000, "red fills the left pane");
    assert_eq!(red(right.0, right.1), 0, "and none of the right");
    assert!(
        green(right.0, right.1) > 20_000,
        "green fills the right pane"
    );
    assert_eq!(green(left.0, left.1), 0, "and none of the left");

    // Focus moves between the panes, and each keeps its own terminal.
    assert!(h.press("cmd-alt-left"), "panes.focus.left is taken");
    assert_eq!(h.active().as_deref(), Some("alpha"));
    h.draw();
    h.draw();
    let views = h.ws(|ws| ws.terminals());
    let held: Vec<bool> = views
        .iter()
        .map(|(_, view)| {
            let view = view.clone();
            h.window
                .update(&mut h.cx, |_, window, cx| {
                    gpui::Focusable::focus_handle(&view, cx).is_focused(window)
                })
                .unwrap()
        })
        .collect();
    assert_eq!(held, [true, false], "the left terminal has the keyboard");
    assert!(h.press("cmd-]"), "panes.next");
    assert_eq!(h.active().as_deref(), Some("bravo"));
    h.press("cmd-alt-right");
    assert_eq!(
        h.active().as_deref(),
        Some("bravo"),
        "nothing is right of the last pane"
    );

    // Zoom shows the focused pane alone; again restores the split.
    assert!(h.press("cmd-shift-enter"));
    assert_eq!(h.shown(), ["bravo"]);
    let zoomed = h.draw();
    assert_eq!(
        zoomed.count(0xc80000, SIDEBAR_WIDTH, WIDTH, below_bar, bottom),
        0
    );
    assert!(h.press("cmd-shift-enter"));
    assert_eq!(h.shown(), ["alpha", "bravo"]);

    println!("workspace_render: split ok");
}

fn the_palette_lists_and_runs_commands() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.open("bravo");
    let before = h.draw();
    let overlay = |shot: &Shot| shot.count(0x1c1c1f, SIDEBAR_WIDTH, WIDTH, 0.0, HEIGHT);
    assert!(!h.ws(|ws| ws.palette_open()));
    assert!(h.press("cmd-p"), "global.navigator is taken");
    assert!(h.ws(|ws| ws.palette_open()));
    let open = h.draw();
    assert!(
        overlay(&open) > overlay(&before) + 20_000,
        "the palette is drawn over the main area"
    );
    assert!(
        open.bright(SIDEBAR_WIDTH + 100.0, WIDTH - 100.0, 40.0, 200.0) > 50,
        "with its rows"
    );

    // Typing narrows it and does not reach the terminal; Enter runs the command.
    h.type_text("zoom");
    assert!(h.press("enter"));
    assert!(!h.ws(|ws| ws.palette_open()));
    assert!(
        !h.ws(|ws| ws.tabs().zoomed()),
        "a lone pane has nothing to zoom"
    );
    assert_eq!(h.ws(|ws| ws.notice().map(str::to_string)), None);

    // A session is a row too: going to it shows its tab.
    h.press("cmd-p");
    h.type_text("go to alpha");
    h.press("enter");
    assert_eq!(h.active().as_deref(), Some("alpha"));

    // Escape and the same key close it; Enter on nothing does nothing.
    h.press("cmd-p");
    assert!(h.press("escape"));
    assert!(!h.ws(|ws| ws.palette_open()));
    h.press("cmd-p");
    assert!(h.press("cmd-p"));
    assert!(!h.ws(|ws| ws.palette_open()));
    // The alternate key opens it outside a terminal only; in a terminal the program keeps cmd-k.
    println!("workspace_render: palette ok");
}

fn terminal_settings_show_what_the_core_sent() {
    let mut h = Harness::new(model(&[("alpha", json!({}))]));
    h.open("alpha");
    let before = h.draw();
    assert!(h.press("cmd-,"), "global.settings is taken");
    assert!(h.ws(|ws| ws.settings_open()));
    let waiting = h.draw();
    assert_ne!(before.raw, waiting.raw, "the panel is drawn");
    // Once the core has sent the settings the panel shows them.
    let mut with_settings = model(&[("alpha", json!({}))]);
    with_settings.terminal = Some(perch_native::settings::TerminalSettings {
        scrollback: 4321,
        login_shell: true,
        dropped_path_double_quotes: false,
    });
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar().update(cx, |sidebar, cx| {
                sidebar.apply(Update::Model(with_settings), cx)
            })
        })
        .unwrap();
    let shown = h.draw();
    assert_ne!(waiting.raw, shown.raw);
    // Login shell is on: its switch text is green; double quotes is off: dim.
    assert!(shown.count(0x4caf6a, SIDEBAR_WIDTH, WIDTH, 0.0, HEIGHT) > 20);
    assert!(h.press("cmd-,"), "the same key closes it");
    assert!(!h.ws(|ws| ws.settings_open()));
    println!("workspace_render: settings ok");
}

fn keys_json_and_chosen_keys_rule() {
    let mut keyed = model(&[("alpha", json!({})), ("bravo", json!({}))]);
    keyed
        .keybindings
        .insert("tabs.next".into(), "cmd+alt+n".into());
    keyed
        .keybindings
        .insert("global.sidebar".into(), String::new());
    keyed.keys_file =
        Some(json!({"global": {"alt-1": "tab.select:2", "ctrl-shift-x": "pane.zoom"}}));
    let mut h = Harness::new(keyed);
    h.open("alpha");
    h.open("bravo");
    h.press("cmd-1");
    assert_eq!(h.active().as_deref(), Some("alpha"));
    // The default key no longer does it; the chosen one does.
    assert!(!h.press("cmd-shift-]"));
    assert_eq!(h.active().as_deref(), Some("alpha"));
    assert!(h.press("cmd-alt-n"));
    assert_eq!(h.active().as_deref(), Some("bravo"));
    // An unbound sidebar key goes to the terminal.
    assert!(!h.press("cmd-b"));
    // keys.json: `tab.select:2` fills the first argument.
    h.press("cmd-1");
    assert!(h.press("alt-1"));
    assert_eq!(h.active().as_deref(), Some("bravo"));
    println!("workspace_render: keys ok");
}

fn main() {
    two_tabs();
    attention_on_a_tab();
    a_split_shows_each_pane();
    the_palette_lists_and_runs_commands();
    terminal_settings_show_what_the_core_sent();
    keys_json_and_chosen_keys_rule();
    println!("workspace_render: ok");
}
