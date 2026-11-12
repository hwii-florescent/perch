//! Draws the window offscreen with several sessions open and checks what it shows: tabs, a split
//! with different content in each pane, the command palette, the terminal settings and an
//! attention mark on a tab. Keys go through the window's own key path (`dispatch_keystroke`), so
//! the dispatcher that runs before the terminal is what is tested. No window is created, shown or
//! focused, and no core is involved: the terminals are fed what a core would send.

use futures::channel::mpsc::{unbounded, UnboundedReceiver, UnboundedSender};
use gpui::{
    point, px, size, AppContext, HeadlessAppContext, Keystroke, Modifiers, MouseButton,
    MouseDownEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use perch_native::client::{Command, Core, Update};
use perch_native::sidebar::{Alert, Attention, Heard, Model, State, Toast};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::terminal::clipboard::MemoryClipboard;
use perch_native::terminal::{Status, TerminalView};
use perch_native::ui::{tint, Workspace, SIDEBAR_WIDTH};
use perch_native::workspace::TAB_BAR_HEIGHT;
use serde_json::{json, Value};
use std::rc::Rc;
use std::sync::Arc;

fn message(value: Value) -> perch_core::protocol::ServerMessage {
    serde_json::from_value(value).unwrap()
}

/// One project that can start a terminal, holding a session per `(id, flags)`.
fn model(sessions: &[(&str, Value)]) -> Model {
    model_with_agents(sessions, &[])
}

/// [`model`] where the core also offers the agents named in `agents`.
fn model_with_agents(sessions: &[(&str, Value)], agents: &[&str]) -> Model {
    let manifests: Vec<Value> = std::iter::once("terminal")
        .chain(agents.iter().copied())
        .map(|id| {
            json!({"id": id, "displayName": id, "supportedModes": ["cli"],
                   "resumability": "none", "capabilities": ["interactiveTerminal"],
                   "statusDetection": "none", "available": true})
        })
        .collect();
    let mut state = State::default();
    state.connect();
    state.apply(&message(json!({
        "type": "project.list", "requestId": "r", "hostId": "local", "snapshotEpoch": "e",
        "snapshotRevision": 1, "projects": [{
            "id": "p", "hostId": "local", "name": "Work", "path": "/work", "favorite": false,
            "createdAt": 0, "updatedAt": 0}]})));
    state.apply(&message(
        json!({"type": "agent.manifest.list", "requestId": "r", "manifests": manifests}),
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
    /// Write the picture as `name.png` into `PERCH_NATIVE_SHOT_DIR`, when it is set, to look at.
    fn save(&self, name: &str) {
        let Some(dir) = std::env::var_os("PERCH_NATIVE_SHOT_DIR") else {
            return;
        };
        let rows = self.raw.len() / 4 / self.width;
        let image = image::RgbaImage::from_raw(self.width as u32, rows as u32, self.raw.clone())
            .expect("the picture is whole");
        image
            .save(std::path::Path::new(&dir).join(format!("{name}.png")))
            .expect("the picture is saved");
    }

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

    /// Pixels that are clearly red, inside the box (an image scaled smoothly has no exact colour).
    fn reddish(&self, x0: f32, x1: f32, y0: f32, y1: f32) -> usize {
        let (x0, x1) = ((x0 * self.scale) as usize, (x1 * self.scale) as usize);
        let (y0, y1) = ((y0 * self.scale) as usize, (y1 * self.scale) as usize);
        self.raw
            .chunks_exact(self.width * 4)
            .enumerate()
            .filter(|(y, _)| (y0..y1).contains(y))
            .map(|(_, row)| {
                row.chunks_exact(4)
                    .enumerate()
                    .filter(|(x, p)| (x0..x1).contains(x) && p[0] > 200 && p[1] < 60 && p[2] < 60)
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
    /// What the terminals copy to and paste from; the real clipboard is never touched.
    clipboard: Rc<MemoryClipboard>,
}

impl Harness {
    fn new(model: Model) -> Self {
        // A core that cannot be found: every tab gets a terminal that has no shell.
        Self::build(model, None, || Err(anyhow::anyhow!("no core in this test")))
    }

    fn build(
        model: Model,
        commands: Option<UnboundedSender<Command>>,
        locate: impl Fn() -> anyhow::Result<Core> + 'static,
    ) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let clipboard = Rc::new(MemoryClipboard::default());
        let held = clipboard.clone();
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                cx.new(|cx| {
                    Workspace::new(model, commands, cx)
                        .with_core(locate)
                        .with_clipboard(held)
                })
            })
            .unwrap();
        Self {
            cx,
            window,
            clipboard,
        }
    }

    /// The terminal with the keyboard.
    fn view<R>(&mut self, f: impl FnOnce(&mut TerminalView) -> R) -> R {
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                let view = ws.terminal().expect("a terminal on screen").clone();
                view.update(cx, |view, _| f(view))
            })
            .unwrap()
    }

    fn notice(&mut self) -> Option<String> {
        self.ws(|ws| ws.notice().map(str::to_string))
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

    /// Show a session the way the sidebar does when it is picked. A plain terminal is not listed,
    /// so the launch says what it is: `launched`.
    fn open_as(&mut self, id: &str, launched: Option<&str>) {
        let (id, launched) = (id.to_string(), launched.map(str::to_string));
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                ws.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id, launched, cx)
                })
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    /// Stand in for the core on the terminal with the keyboard: it is attached and holds the
    /// keyboard, and what it asks of the core arrives on the receiver. Keep the sender to keep
    /// the terminal attached, and answer through it.
    fn live(&mut self) -> (UnboundedReceiver<ToCore>, UnboundedSender<FromCore>) {
        let (to_core, asked) = unbounded();
        let (core, from_core) = unbounded();
        self.window
            .update(&mut self.cx, |ws, _, cx| {
                let view = ws.terminal().expect("a terminal on screen").clone();
                view.update(cx, |view, cx| view.link(to_core, from_core, cx))
            })
            .unwrap();
        core.unbounded_send(FromCore::Attached {
            replay: String::new(),
            input: true,
            resize: true,
            agent: None,
        })
        .unwrap();
        self.cx.run_until_parked();
        (asked, core)
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

    /// A click at a window position, through the window's own event dispatch.
    fn click(&mut self, x: f32, y: f32, button: MouseButton, modifiers: Modifiers) {
        let position = point(px(x), px(y));
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.dispatch_event(
                    PlatformInput::MouseDown(MouseDownEvent {
                        button,
                        position,
                        modifiers,
                        click_count: 1,
                        first_mouse: false,
                    }),
                    cx,
                );
                window.dispatch_event(
                    PlatformInput::MouseUp(MouseUpEvent {
                        button,
                        position,
                        modifiers,
                        click_count: 1,
                    }),
                    cx,
                );
            })
            .unwrap();
        self.cx.run_until_parked();
    }

    /// A named command, as a key or the palette runs it.
    fn run(&mut self, name: &str, args: Value) -> Result<(), String> {
        self.window
            .update(&mut self.cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
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
    both.save("two-tabs");

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
    let marked = h.draw();
    marked.save("attention");
    let fill = marked.count(
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
    shot.save("split");
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
    open.save("palette");
    assert!(
        overlay(&open) > overlay(&before) + 20_000,
        "the palette is drawn over the main area"
    );
    assert!(
        open.bright(SIDEBAR_WIDTH + 100.0, WIDTH - 100.0, 40.0, 200.0) > 50,
        "with its rows"
    );

    // Typing narrows it and does not reach the terminal; Enter runs the command.
    h.type_text("restore");
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
    with_settings.terminal = Some(Box::new(perch_native::settings::TerminalSettings {
        scrollback: 4321,
        login_shell: true,
        ..Default::default()
    }));
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar().update(cx, |sidebar, cx| {
                sidebar.apply(Update::Model(with_settings), cx)
            })
        })
        .unwrap();
    let shown = h.draw();
    shown.save("settings");
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

/// The Command editing keys go through the window to the focused shell as typed bytes, unless
/// the program asked for the real chords or keys.json binds the key.
fn editing_keys_reach_the_shell_through_the_window() {
    let mut keyed = model(&[("alpha", json!({}))]);
    keyed.keys_file = Some(json!({"terminal": {"cmd-backspace": "send:gone"}}));
    let mut h = Harness::new(keyed);
    h.open("alpha");
    h.draw();
    let (mut rx, core) = h.live();
    let typed = |rx: &mut UnboundedReceiver<ToCore>| -> Vec<Vec<u8>> {
        asked(rx)
            .into_iter()
            .filter_map(|m| match m {
                ToCore::Input(bytes) => Some(bytes),
                _ => None,
            })
            .collect()
    };
    typed(&mut rx);
    assert!(h.press("cmd-left"));
    assert!(h.press("cmd-right"));
    assert!(h.press("cmd-backspace"));
    assert_eq!(
        typed(&mut rx),
        vec![b"\x01".to_vec(), b"\x05".to_vec(), b"gone".to_vec()],
        "keys.json replaces one of the three"
    );
    // The program asks for the kitty keyboard protocol: the keys are its to see, and the app has
    // nothing to send for a Command chord.
    core.unbounded_send(FromCore::Output("\x1b[>1u".into()))
        .unwrap();
    h.cx.run_until_parked();
    assert!(!h.press("cmd-left"));
    assert_eq!(typed(&mut rx), Vec::<Vec<u8>>::new());
}

fn terminal_commands_run_from_keys_and_the_palette() {
    let mut keyed = model(&[("alpha", json!({}))]);
    keyed
        .keybindings
        .insert("terminal.clear".into(), "cmd+shift+k".into());
    keyed.keys_file = Some(json!({"terminal": {"alt-j": "send:ls"}}));
    let mut h = Harness::new(keyed);
    h.open("alpha");
    h.draw();
    // 200 numbered lines: the first ones have scrolled into the history.
    let screen: String = (1..=200).map(|n| format!("line {n}\r\n")).collect();
    h.show(0, &screen);
    h.draw();
    let top = |h: &mut Harness| h.view(|v| v.frame().row_text(0));
    let has = |h: &mut Harness, text: &str| {
        h.view(|v| {
            let frame = v.frame();
            (0..frame.rows.len()).any(|y| frame.row_text(y) == text)
        })
    };
    assert!(has(&mut h, "line 200"), "the live screen is on show");

    // Scroll to an end: the window's keymap runs the terminal's action, so the program is not
    // asked (it is not even attached here), and the view moves.
    assert!(h.press("cmd-up"), "terminal.scrollTop is taken");
    assert_eq!(top(&mut h), "line 1");
    assert!(h.press("cmd-down"), "terminal.scrollBottom is taken");
    assert!(has(&mut h, "line 200"));

    // A page at a time, from the palette.
    h.press("cmd-p");
    h.type_text("scroll up a page");
    assert!(h.press("enter"));
    assert!(!has(&mut h, "line 200"), "a page up left the bottom");
    let paged = top(&mut h);
    h.press("cmd-p");
    h.type_text("scroll down a page");
    h.press("enter");
    assert!(has(&mut h, "line 200"), "and a page down came back");
    assert_ne!(paged, top(&mut h));
    assert_eq!(h.notice(), None);

    // Select all waits for copy; copy writes the selection to the clipboard and ends it.
    assert!(h.press("cmd-a"));
    assert!(h.view(|v| v.selection_text()).is_some());
    assert_eq!(h.clipboard.text(), None, "select all copies nothing");
    assert!(h.press("cmd-c"));
    let copied = h.clipboard.text().expect("copied");
    assert!(copied.contains("line 200"), "the whole screen and history");
    assert!(h.view(|v| v.selection_text()).is_none());
    // With nothing selected the window says so instead of sending the key to the program.
    assert!(h.press("cmd-c"));
    assert_eq!(
        h.notice().as_deref(),
        Some("Nothing is selected in that terminal.")
    );

    // Find opens from its key. While its field holds the keys, paste goes into the field.
    assert!(h.press("cmd-f"));
    assert!(h.view(|v| v.find_open()));
    h.clipboard.write_text_for_test("line 17");
    h.press("cmd-v");
    assert_eq!(h.view(|v| v.find_query().to_string()), "line 17");
    h.press("escape");
    assert!(!h.view(|v| v.find_open()));

    // A key the person moved: the old one is no longer taken (the view's own chord is gone
    // too), and the new one clears the history.
    h.press("cmd-up");
    assert_eq!(top(&mut h), "line 1");
    h.press("cmd-k");
    assert_eq!(top(&mut h), "line 1", "cmd-k no longer clears");
    assert!(h.press("cmd-shift-k"));
    h.press("cmd-up");
    assert_ne!(top(&mut h), "line 1", "the history is gone");

    // `send:` types through the terminal's own send, which refuses a view that cannot type.
    h.press("alt-j");
    assert_eq!(
        h.notice().as_deref(),
        Some("This terminal is view only: another view controls it.")
    );
    println!("workspace_render: terminal commands ok");
}

/// A tab that is not on screen stays attached and keeps what it drew: its terminal is told it is
/// hidden and shown again with its kitty image still there.
fn kept_tabs_are_hidden_not_dropped() {
    const RGBA: &str = "/wAA/wD/AP8AAP///////w==";
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.draw();
    h.show(
        0,
        &format!("\x1b_Ga=T,f=32,s=2,v=2,i=1,c=40,r=8,C=1;{RGBA}\x1b\\"),
    );
    let area = SIDEBAR_WIDTH..WIDTH;
    let red = |shot: &Shot| shot.reddish(area.start, area.end, TAB_BAR_HEIGHT, HEIGHT);
    assert!(red(&h.draw()) > 500, "alpha shows its image");
    let uploaded = |h: &mut Harness, id: &str| {
        h.window
            .update(&mut h.cx, |ws, _, cx| {
                ws.view(id).unwrap().update(cx, |v, _| v.uploaded_images())
            })
            .unwrap()
    };
    let hidden = |h: &mut Harness, id: &str| {
        h.window
            .update(&mut h.cx, |ws, _, cx| {
                ws.view(id).unwrap().update(cx, |v, _| v.is_hidden())
            })
            .unwrap()
    };
    assert_eq!(uploaded(&mut h, "alpha"), 1);
    assert!(!hidden(&mut h, "alpha"));

    // Another tab takes the screen: alpha is kept, hidden, and still holds its image.
    h.open("bravo");
    let other = h.draw();
    assert_eq!(red(&other), 0, "alpha is not drawn behind bravo");
    assert!(hidden(&mut h, "alpha"), "alpha was told it is off screen");
    assert!(!hidden(&mut h, "bravo"));
    assert_eq!(
        uploaded(&mut h, "alpha"),
        1,
        "its image survives the switch"
    );
    assert_eq!(h.ws(|ws| ws.terminals().len()), 1);

    // Back to alpha: told it is shown, and the image is drawn again.
    assert!(h.press("cmd-1"));
    let back = h.draw();
    assert!(!hidden(&mut h, "alpha"));
    assert!(hidden(&mut h, "bravo"));
    assert!(red(&back) > 500, "alpha shows its image again");
    println!("workspace_render: kept tabs ok");
}

/// Zoom keys scale every terminal's text, kept ones and ones opened afterwards, and refit the
/// grid; reset puts it back. The level is capped at both ends. (The window is narrow, so zooming
/// in is held back by the 80-column minimum: the steps down show the scale.)
fn zoom_scales_the_terminals() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.draw();
    let font = |h: &mut Harness, id: &str| {
        h.window
            .update(&mut h.cx, |ws, _, cx| {
                ws.view(id)
                    .unwrap()
                    .update(cx, |v, _| (v.font_px().unwrap(), v.grid_size()))
            })
            .unwrap()
    };
    let near = |a: f32, b: f32| (a - b).abs() < 0.2;
    let (base, grid) = font(&mut h, "alpha");

    assert!(h.press("cmd--"), "view.zoomOut is taken");
    h.draw();
    let (smaller, smaller_grid) = font(&mut h, "alpha");
    assert!(near(smaller, base / 1.2), "{base} -> {smaller}");
    assert!(
        smaller_grid.0 > grid.0 && smaller_grid.1 > grid.1,
        "{grid:?} -> {smaller_grid:?}"
    );
    assert_eq!(h.notice().as_deref(), Some("Zoom 83%"));

    // A tab opened afterwards is at the same zoom, and a tab kept out of sight follows.
    h.open("bravo");
    h.draw();
    assert!(near(font(&mut h, "bravo").0, base / 1.2));
    assert!(h.press("cmd--"));
    h.draw();
    assert!(near(font(&mut h, "bravo").0, base / 1.44));
    assert!(h.press("cmd-1"));
    h.draw();
    assert!(
        near(font(&mut h, "alpha").0, base / 1.44),
        "the kept tab followed"
    );

    // The + key, with and without Shift, steps up; reset goes back to 100%.
    assert!(h.press("cmd-shift-="));
    h.draw();
    assert!(near(font(&mut h, "alpha").0, base / 1.2));
    assert!(h.press("cmd-="));
    h.draw();
    assert_eq!(font(&mut h, "alpha"), (base, grid));
    assert!(h.press("cmd--"));
    assert!(h.press("cmd-0"));
    h.draw();
    assert_eq!(font(&mut h, "alpha"), (base, grid));
    assert_eq!(h.notice().as_deref(), Some("Zoom 100%"));

    // The ends of the range.
    for _ in 0..12 {
        assert!(h.press("cmd-="));
    }
    assert_eq!(h.notice().as_deref(), Some("Zoom 430%"));
    for _ in 0..20 {
        assert!(h.press("cmd--"));
    }
    assert_eq!(h.notice().as_deref(), Some("Zoom 40%"));
    println!("workspace_render: zoom ok");
}

/// Tabs out of sight keep their terminal attached up to twelve; the one unseen longest lets go
/// and attaches again when it is shown.
fn tabs_out_of_sight_are_parked_beyond_twelve() {
    let names: Vec<String> = (0..15).map(|n| format!("s{n:02}")).collect();
    let sessions: Vec<(&str, Value)> = names.iter().map(|n| (n.as_str(), json!({}))).collect();
    let mut h = Harness::new(model(&sessions));
    for name in &names[..14] {
        h.open(name);
        h.draw();
    }
    let attached = |h: &mut Harness, id: &str| h.ws(|ws| ws.view(id).is_some());
    // 14 open, one on screen: twelve kept, the first parked.
    assert!(!attached(&mut h, "s00"), "the oldest tab let go");
    for name in &names[1..14] {
        assert!(attached(&mut h, name), "{name} is kept");
    }
    assert_eq!(h.ws(|ws| ws.tabs().strip().len()), 14, "no tab was closed");

    // Showing it attaches it again, and now the one unseen longest is parked.
    h.open("s00");
    h.draw();
    assert!(attached(&mut h, "s00"));
    assert!(!attached(&mut h, "s01"));
    assert!(attached(&mut h, "s02"));
    // One more tab: s02 is next.
    h.open(&names[14]);
    h.draw();
    assert!(!attached(&mut h, "s02"));
    println!("workspace_render: parked tabs ok");
}

/// A right-click in a pane opens the pane menu there, a click on an entry runs it on that pane,
/// and a click elsewhere or any key closes it.
fn the_pane_menu_opens_on_right_click() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.draw();
    let (x, y) = (SIDEBAR_WIDTH + 300., 200.);
    let plain = Modifiers::default();
    assert_eq!(h.ws(|ws| ws.menu_labels()), None);
    h.click(x, y, MouseButton::Right, plain);
    let before = h.draw();
    before.save("pane-menu");
    let labels = h.ws(|ws| ws.menu_labels()).expect("the menu is open");
    assert_eq!(labels[0], "Copy");
    assert!(labels.contains(&"Split right") && labels.contains(&"Close"));
    assert!(
        !labels.contains(&"Stop the terminal"),
        "a view that cannot stop its shell does not offer to"
    );
    assert!(
        !labels.contains(&"Zoom pane"),
        "a lone pane has nothing to zoom"
    );
    assert!(
        before.count(0x1c1c1f, x, x + 150., y, y + 100.) > 2000,
        "the menu is drawn where it was asked"
    );

    // An entry runs on the pane: Find opens the find bar of that terminal.
    let find = labels.iter().position(|l| l.starts_with("Find")).unwrap();
    assert!(!h.view(|v| v.find_open()));
    h.click(
        x + 20.,
        y + 4. + 28. * find as f32 + 14.,
        MouseButton::Left,
        plain,
    );
    assert_eq!(
        h.ws(|ws| ws.menu_labels()),
        None,
        "choosing closes the menu"
    );
    assert!(h.view(|v| v.find_open()), "Find ran on the clicked pane");

    // A click elsewhere closes it without running anything; so does a key (Escape is only that).
    h.click(x, y, MouseButton::Right, plain);
    assert!(h.ws(|ws| ws.menu_labels()).is_some());
    h.click(x + 400., y + 200., MouseButton::Left, plain);
    assert_eq!(h.ws(|ws| ws.menu_labels()), None);
    println!("workspace_render: pane menu ok");
}

/// `terminal.peek` shows a session's terminal over the window with no tab of its own; park puts
/// it away; keep makes it a tab; show goes to a session's tab, opening one.
fn a_peek_is_a_terminal_over_the_window() {
    let mut h = Harness::new(model(&[
        ("alpha", json!({})),
        ("bravo", json!({})),
        ("charlie", json!({})),
    ]));
    h.open("alpha");
    h.draw();
    let plain = h.draw();
    h.run("terminal.peek", json!({"id": "bravo"})).unwrap();
    let peeking = h.draw();
    peeking.save("peek");
    assert_eq!(
        h.ws(|ws| ws.peeked().map(str::to_string)).as_deref(),
        Some("bravo")
    );
    assert_eq!(h.strip(), ["alpha"], "a peek has no tab");
    assert_ne!(plain.raw, peeking.raw, "the peek is drawn");
    let shown = h
        .window
        .update(&mut h.cx, |ws, _, cx| {
            ws.view("bravo").map(|v| !v.read(cx).is_hidden())
        })
        .unwrap();
    assert_eq!(shown, Some(true), "its terminal is on screen");
    // A session with a tab is shown by its tab.
    assert!(h.run("terminal.peek", json!({"id": "alpha"})).is_err());
    // Park puts it away; the terminal lets go.
    h.run("terminal.park", json!({})).unwrap();
    assert_eq!(h.ws(|ws| ws.peeked().map(str::to_string)), None);
    assert!(h.ws(|ws| ws.view("bravo").is_none()));
    assert!(
        h.run("terminal.park", json!({})).is_err(),
        "nothing left to put away"
    );
    // A second peek of the same session puts it away too.
    h.run("terminal.peek", json!({"id": "bravo"})).unwrap();
    h.run("terminal.peek", json!({"id": "bravo"})).unwrap();
    assert_eq!(h.ws(|ws| ws.peeked().map(str::to_string)), None);
    // A click outside closes it.
    h.run("terminal.peek", json!({"id": "bravo"})).unwrap();
    h.draw();
    h.click(
        SIDEBAR_WIDTH + 2.,
        HEIGHT - 4.,
        MouseButton::Left,
        Modifiers::default(),
    );
    assert_eq!(h.ws(|ws| ws.peeked().map(str::to_string)), None);
    // Keep turns it into a tab and goes there.
    h.run("terminal.peek", json!({"id": "bravo"})).unwrap();
    h.run("terminal.keep", json!({"id": "bravo"})).unwrap();
    assert_eq!(h.ws(|ws| ws.peeked().map(str::to_string)), None);
    assert_eq!(h.strip(), ["alpha", "bravo"]);
    assert_eq!(h.active().as_deref(), Some("bravo"));
    // Show opens a tab for a session that has none, and goes to one that has.
    h.run("terminal.show", json!({"id": "charlie"})).unwrap();
    assert_eq!(h.active().as_deref(), Some("charlie"));
    h.run("terminal.show", json!({"id": "alpha"})).unwrap();
    assert_eq!(h.active().as_deref(), Some("alpha"));
    assert!(h.run("terminal.show", json!({"id": "nothing"})).is_err());
    println!("workspace_render: peek ok");
}

/// A toast says which session finished or needs the person, goes by itself after a while, and a
/// click on it opens that session. Nothing is played or sent to the system here.
fn a_toast_names_the_session_and_opens_it() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    let plain = h.draw();
    let heard = |alert: Alert| Heard {
        alert,
        session_id: "bravo".into(),
        title: "bravo".into(),
        sound: true,
        file: None,
        toast: Toast::App,
    };
    h.window
        .update(&mut h.cx, |ws, _, cx| ws.toast(heard(Alert::Blocked), cx))
        .unwrap();
    let shown = h.draw();
    shown.save("toast");
    assert_ne!(plain.raw, shown.raw, "the toast is drawn");
    assert_eq!(
        h.ws(|ws| ws.toast_text().map(str::to_string)).as_deref(),
        Some("bravo needs you")
    );

    // A click opens the session and takes the toast away.
    h.click(
        WIDTH - 40.,
        TAB_BAR_HEIGHT + 30.,
        MouseButton::Left,
        Modifiers::default(),
    );
    assert_eq!(h.active().as_deref(), Some("bravo"));
    assert_eq!(h.ws(|ws| ws.toast_text().map(str::to_string)), None);

    // Left alone, it goes by itself; a newer one replaces an older.
    h.window
        .update(&mut h.cx, |ws, _, cx| ws.toast(heard(Alert::Done), cx))
        .unwrap();
    assert_eq!(
        h.ws(|ws| ws.toast_text().map(str::to_string)).as_deref(),
        Some("bravo finished")
    );
    h.cx.advance_clock(std::time::Duration::from_secs(9));
    h.cx.run_until_parked();
    assert_eq!(h.ws(|ws| ws.toast_text().map(str::to_string)), None);
    println!("workspace_render: toast ok");
}

fn asked(rx: &mut UnboundedReceiver<ToCore>) -> Vec<ToCore> {
    std::iter::from_fn(|| rx.try_recv().ok()).collect()
}

/// How many times the core was asked to end the session.
fn ends(rx: &mut UnboundedReceiver<ToCore>) -> usize {
    asked(rx).iter().filter(|m| **m == ToCore::End).count()
}

/// Closing a tab ends its session as the web does: a terminal at once, an agent after a second
/// close while the warning is on (and a shell with an agent typed into it counts as one), at once
/// when it is off. The ask is taken back after a while.
fn closing_a_tab_ends_its_session() {
    let sessions = [
        ("plain", json!({"cliProviderId": "terminal"})),
        ("agent", json!({"cliProviderId": "claude"})),
        (
            "typed",
            json!({"cliProviderId": "terminal", "currentProviderId": "claude"}),
        ),
    ];
    let mut h = Harness::new(model(&sessions));
    h.open_as("plain", Some("terminal"));
    h.draw();
    let (mut rx, core) = h.live();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert!(
        asked(&mut rx).contains(&ToCore::End),
        "a terminal ends at once"
    );
    assert!(h.notice().unwrap().starts_with("Ending the session"));
    assert!(
        h.ws(|ws| ws.tabs().contains("plain")),
        "until the core says"
    );
    core.unbounded_send(FromCore::Ended).unwrap();
    h.cx.run_until_parked();
    assert!(!h.ws(|ws| ws.tabs().contains("plain")));

    for id in ["agent", "typed"] {
        h.open_as(id, None);
        h.draw();
        let (mut rx, core) = h.live();
        assert_eq!(h.run("tabs.close", json!({})), Ok(()));
        assert_eq!(ends(&mut rx), 0, "{id}: the first close only asks");
        assert!(h.notice().unwrap().starts_with("Closing ends"), "{id}");
        assert!(h.ws(|ws| ws.tabs().contains(id)));
        if id == "typed" {
            // Left alone, the ask is taken back, and the next close asks again.
            h.cx.advance_clock(std::time::Duration::from_secs(9));
            h.cx.run_until_parked();
            assert_eq!(h.notice(), None);
            assert_eq!(h.run("tabs.close", json!({})), Ok(()));
            assert_eq!(ends(&mut rx), 0, "{id}: it asks again");
        }
        assert_eq!(h.run("tabs.close", json!({})), Ok(()));
        assert_eq!(ends(&mut rx), 1, "{id}: the second ends");
        assert!(
            h.ws(|ws| ws.tabs().contains(id)),
            "{id}: until the core says"
        );
        core.unbounded_send(FromCore::Ended).unwrap();
        h.cx.run_until_parked();
        assert!(!h.ws(|ws| ws.tabs().contains(id)), "{id}");
    }

    // With the warning off an agent ends at once; a core that does not confirm it keeps the tab.
    let mut quiet = model(&sessions);
    quiet.terminal = Some(Box::new(perch_native::settings::TerminalSettings {
        warn_close_agent: false,
        ..Default::default()
    }));
    let mut h = Harness::new(quiet);
    h.open_as("agent", None);
    h.draw();
    let (mut rx, core) = h.live();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert_eq!(ends(&mut rx), 1);
    h.cx.advance_clock(std::time::Duration::from_secs(6));
    h.cx.run_until_parked();
    assert!(h.ws(|ws| ws.tabs().contains("agent")), "unconfirmed: kept");
    assert!(h.notice().unwrap().contains("session is still running"));
    core.unbounded_send(FromCore::EndRefused("another view controls it".into()))
        .unwrap();
    h.cx.run_until_parked();
    assert!(h.ws(|ws| ws.tabs().contains("agent")), "refused: kept");

    println!("workspace_render: close ok");
}

/// A tab that only watches a session another view controls, and one with no attached terminal,
/// leave the view and send nothing: the session keeps running.
fn a_tab_that_cannot_end_its_session_is_put_away() {
    let mut h = Harness::new(model(&[
        ("watched", json!({"cliProviderId": "claude"})),
        (
            "blank",
            json!({"cliProviderId": null, "currentProviderId": "terminal"}),
        ),
    ]));
    h.open_as("watched", None);
    h.draw();
    let (mut rx, core) = h.live();
    core.unbounded_send(FromCore::Attached {
        replay: String::new(),
        input: false,
        resize: false,
        agent: None,
    })
    .unwrap();
    h.cx.run_until_parked();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert_eq!(ends(&mut rx), 0, "a watcher ends nothing");
    assert!(!h.ws(|ws| ws.tabs().contains("watched")));
    assert!(h.notice().unwrap().contains("Another view controls"));

    h.open_as("blank", None);
    h.draw();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert!(!h.ws(|ws| ws.tabs().contains("blank")));
    assert!(h.notice().unwrap().contains("not attached"));
}

/// A session the core deletes closes its tab whenever the news comes: after the wait for it ran
/// out, after a refusal, and when this window never asked.
fn a_deleted_session_closes_its_tab_whenever_the_core_says_so() {
    let mut h = Harness::new(model(&[
        ("late", json!({"cliProviderId": "terminal"})),
        ("refused", json!({"cliProviderId": "terminal"})),
        ("elsewhere", json!({"cliProviderId": "terminal"})),
    ]));
    // The answer comes after the five seconds the window waits.
    h.open_as("late", Some("terminal"));
    h.draw();
    let (mut rx, core) = h.live();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert!(asked(&mut rx).contains(&ToCore::End));
    h.cx.advance_clock(std::time::Duration::from_secs(6));
    h.cx.run_until_parked();
    assert!(
        h.ws(|ws| ws.tabs().contains("late")),
        "the tab waits no longer"
    );
    assert!(h.notice().unwrap().contains("still running"));
    core.unbounded_send(FromCore::Ended).unwrap();
    h.cx.run_until_parked();
    assert!(
        !h.ws(|ws| ws.tabs().contains("late")),
        "a late deletion closes it"
    );

    // A refusal keeps the tab; the deletion that follows still closes it.
    h.open_as("refused", Some("terminal"));
    h.draw();
    let (mut rx, core) = h.live();
    assert_eq!(h.run("tabs.close", json!({})), Ok(()));
    assert!(asked(&mut rx).contains(&ToCore::End));
    core.unbounded_send(FromCore::EndRefused("another view controls it".into()))
        .unwrap();
    h.cx.run_until_parked();
    assert!(h.ws(|ws| ws.tabs().contains("refused")));
    assert!(h.notice().unwrap().contains("the core refused"));
    core.unbounded_send(FromCore::Ended).unwrap();
    h.cx.run_until_parked();
    assert!(!h.ws(|ws| ws.tabs().contains("refused")));

    // Someone else deleted a session this window shows and never asked to end.
    h.open_as("elsewhere", Some("terminal"));
    h.draw();
    let (_rx, core) = h.live();
    core.unbounded_send(FromCore::Ended).unwrap();
    h.cx.run_until_parked();
    assert!(!h.ws(|ws| ws.tabs().contains("elsewhere")));
    println!("workspace_render: deleted session ok");
}

/// The pane menu stops a terminal's process only on a second, explicit click.
fn stopping_a_terminal_from_the_pane_menu_asks_first() {
    let mut h = Harness::new(model(&[("alpha", json!({"cliProviderId": "claude"}))]));
    h.open_as("alpha", None);
    h.draw();
    let (mut rx, _core) = h.live();
    let (x, y) = (SIDEBAR_WIDTH + 300., 200.);
    let plain = Modifiers::default();
    h.click(x, y, MouseButton::Right, plain);
    h.draw();
    let labels = h.ws(|ws| ws.menu_labels()).expect("the menu is open");
    let stop = labels
        .iter()
        .position(|l| *l == "Stop the terminal")
        .unwrap();
    // Rows are about 30 pixels tall; the click lands in the middle of the entry.
    let item = (x + 20., y + 4. + 30. * stop as f32 + 15.);
    h.click(item.0, item.1, MouseButton::Left, plain);
    h.draw();
    let labels = h.ws(|ws| ws.menu_labels()).expect("still open");
    assert_eq!(labels[stop], "Stop \u{2014} confirm");
    assert!(
        !asked(&mut rx).contains(&ToCore::Kill),
        "the first click stops nothing"
    );
    // A click elsewhere takes the question back; asking again starts over.
    h.click(x + 400., y + 200., MouseButton::Left, plain);
    assert_eq!(h.ws(|ws| ws.menu_labels()), None);
    h.click(x, y, MouseButton::Right, plain);
    h.draw();
    assert_eq!(
        h.ws(|ws| ws.menu_labels()).unwrap()[stop],
        "Stop the terminal"
    );
    h.click(item.0, item.1, MouseButton::Left, plain);
    h.draw();
    assert!(!asked(&mut rx).contains(&ToCore::Kill));
    h.click(item.0, item.1, MouseButton::Left, plain);
    assert_eq!(
        h.ws(|ws| ws.menu_labels()),
        None,
        "choosing closes the menu"
    );
    assert!(
        asked(&mut rx).contains(&ToCore::Kill),
        "the second click stops it"
    );
    println!("workspace_render: stop confirm ok");
}

/// A session with no recorded launch provider is not attached under a guessed one.
fn a_session_with_no_launch_provider_is_not_attached() {
    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let window = cx
        .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
            let core = perch_native::client::Core::with_token("http://127.0.0.1:9/", "t").unwrap();
            let open = perch_native::ui::OpenSession {
                host_id: "local".into(),
                session_id: "blank".into(),
                title: "blank".into(),
                provider_id: None,
                blank: false,
                core_url: None,
            };
            cx.new(|cx| TerminalView::attach(core, &open, cx))
        })
        .unwrap();
    let (status, can_type) = window
        .update(&mut cx, |view, _, _| {
            (view.status().clone(), view.can_type())
        })
        .unwrap();
    assert!(
        matches!(&status, Status::Failed(note) if note.contains("will not guess")),
        "{status:?}"
    );
    assert!(!can_type);
    println!("workspace_render: no launch provider ok");
}

/// A listed session nobody launched anything in offers the launch choices in its tab, and the
/// one picked attaches that session. One started without a recorded provider is never offered
/// them, and neither is one that was started elsewhere while the person chose.
fn a_blank_session_offers_the_launch_choices() {
    let (commands, mut launched) = unbounded();
    let sessions = [
        ("blank", json!({"cliProviderId": null, "cliStarted": false})),
        (
            "started",
            json!({"cliProviderId": null, "cliStarted": true}),
        ),
        ("late", json!({"cliProviderId": null, "cliStarted": false})),
    ];
    let mut h = Harness::build(
        model_with_agents(&sessions, &["claude"]),
        Some(commands),
        // Nothing listens here: the terminal that is attached gives up on its own.
        || Core::with_token("http://127.0.0.1:9/", "t"),
    );

    h.open_as("blank", None);
    h.draw();
    assert!(h.ws(|ws| ws.open().is_some_and(|o| o.blank)));
    let (choosing, status, note) = h.view(|v| (v.choosing(), v.status().clone(), v.note()));
    assert!(choosing);
    assert_eq!(
        status,
        Status::Detached,
        "nothing is attached before a choice"
    );
    assert!(note.is_some_and(|n| n.contains("Choose")));
    // The choices are the launch list, the terminal first: Down moves to the agent after it and
    // Enter starts this session with it.
    assert!(h.press("down"));
    assert!(h.press("enter"));
    let open = h.ws(|ws| ws.open().cloned()).unwrap();
    assert_eq!(
        (
            open.session_id.as_str(),
            open.provider_id.as_deref(),
            open.blank
        ),
        ("blank", Some("claude"), false)
    );
    let (choosing, status) = h.view(|v| (v.choosing(), v.status().clone()));
    assert!(!choosing);
    assert_eq!(status, Status::Connecting);
    while let Ok(command) = launched.try_recv() {
        assert!(
            !matches!(command, Command::Launch { .. }),
            "the choice starts no new session: {command:?}"
        );
    }

    // Started with no recorded provider: real uncertainty, so no choices and no guess.
    h.open_as("started", None);
    let (choosing, status) = h.view(|v| (v.choosing(), v.status().clone()));
    assert!(!choosing);
    assert!(matches!(&status, Status::Failed(note) if note.contains("will not guess")));

    // The row changes while the person is choosing: nothing is started.
    h.open_as("late", None);
    h.draw();
    assert!(h.view(|v| v.choosing()));
    let started = model_with_agents(
        &[(
            "late",
            json!({"cliProviderId": "claude", "cliStarted": true}),
        )],
        &["claude"],
    );
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(started), cx))
        })
        .unwrap();
    assert!(h.press("enter"));
    let (choosing, status) = h.view(|v| (v.choosing(), v.status().clone()));
    assert!(!choosing);
    assert!(matches!(&status, Status::Failed(note) if note.contains("started elsewhere")));
    assert_eq!(h.ws(|ws| ws.open().cloned()).unwrap().provider_id, None);
    println!("workspace_render: blank session choices ok");
}

fn main() {
    a_blank_session_offers_the_launch_choices();
    closing_a_tab_ends_its_session();
    a_tab_that_cannot_end_its_session_is_put_away();
    a_session_with_no_launch_provider_is_not_attached();
    a_deleted_session_closes_its_tab_whenever_the_core_says_so();
    stopping_a_terminal_from_the_pane_menu_asks_first();
    a_toast_names_the_session_and_opens_it();
    the_pane_menu_opens_on_right_click();
    a_peek_is_a_terminal_over_the_window();
    tabs_out_of_sight_are_parked_beyond_twelve();
    zoom_scales_the_terminals();
    two_tabs();
    attention_on_a_tab();
    a_split_shows_each_pane();
    the_palette_lists_and_runs_commands();
    terminal_settings_show_what_the_core_sent();
    keys_json_and_chosen_keys_rule();
    editing_keys_reach_the_shell_through_the_window();
    terminal_commands_run_from_keys_and_the_palette();
    kept_tabs_are_hidden_not_dropped();
    println!("workspace_render: ok");
}
