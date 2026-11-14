//! Draws the window offscreen with several sessions open and checks what it shows: tabs, a split
//! with different content in each pane, the terminal settings and an
//! attention mark on a tab. Keys go through the window's own key path (`dispatch_keystroke`), so
//! the dispatcher that runs before the terminal is what is tested. No window is created, shown or
//! focused, and no core is involved: the terminals are fed what a core would send.

use futures::channel::mpsc::{unbounded, UnboundedReceiver, UnboundedSender};
use gpui::{
    point, px, size, AppContext, EntityInputHandler, HeadlessAppContext, KeyDownEvent, Keystroke,
    Modifiers, MouseButton, MouseDownEvent, MouseUpEvent, PlatformInput, Window, WindowHandle,
};
use perch_native::client::{Command, Core, Update};
use perch_native::sidebar::{Model, State};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::terminal::clipboard::MemoryClipboard;
use perch_native::terminal::links::Target;
use perch_native::terminal::{Status, TerminalEvent, TerminalView};
use perch_native::ui::{Workspace, SIDEBAR_WIDTH};
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

    /// The box (logical pixels, `x0 x1 y0 y1`) holding every pixel of `color` inside the area.
    fn bounds_of(&self, color: u32, x0: f32, x1: f32, y0: f32, y1: f32) -> Option<[f32; 4]> {
        let want = [(color >> 16) as u8, (color >> 8) as u8, color as u8];
        let mut found: Option<[usize; 4]> = None;
        for (y, row) in self.raw.chunks_exact(self.width * 4).enumerate() {
            for (x, p) in row.chunks_exact(4).enumerate() {
                let inside = (x0 * self.scale) as usize <= x
                    && x < (x1 * self.scale) as usize
                    && (y0 * self.scale) as usize <= y
                    && y < (y1 * self.scale) as usize;
                if inside && p[..3].iter().zip(want).all(|(a, b)| a.abs_diff(b) <= 2) {
                    let [a, b, c, d] = found.get_or_insert([x, x, y, y]);
                    (*a, *b, *c, *d) = ((*a).min(x), (*b).max(x), (*c).min(y), (*d).max(y));
                }
            }
        }
        found.map(|f| f.map(|v| v as f32 / self.scale))
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
    /// The links the window was asked to open. None is ever handed to the system.
    opened: Rc<std::cell::RefCell<Vec<Target>>>,
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
        let opened = Rc::new(std::cell::RefCell::new(Vec::new()));
        let record = opened.clone();
        let window = cx
            .open_window(size(px(WIDTH), px(HEIGHT)), |_, cx| {
                cx.new(|cx| {
                    Workspace::new(model, commands, cx)
                        .with_core(locate)
                        .with_clipboard(held)
                        .with_opener(Rc::new(move |target| {
                            record.borrow_mut().push(target.clone())
                        }))
                })
            })
            .unwrap();
        Self {
            cx,
            window,
            clipboard,
            opened,
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

    /// A named command, as a key or the Navigator runs it.
    fn run(&mut self, name: &str, args: Value) -> Result<(), String> {
        self.window
            .update(&mut self.cx, |ws, window, cx| {
                ws.run_command(name, Some(&args), window, cx)
            })
            .unwrap()
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
    // The strip itself is the stock `tabs` mod (`mods_chrome_window`); mods are off here.
    h.draw().save("two-tabs");

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

/// A control in the settings panel sends the core the one setting it changes, and the panel shows
/// the value the core then reports. The core's side (saving it, telling every follower) is
/// `workspace_session`.
fn a_settings_control_sends_the_changed_value() {
    let mut shown = model(&[("alpha", json!({}))]);
    shown.terminal = Some(Box::new(perch_native::settings::TerminalSettings {
        scrollback: 4321,
        login_shell: true,
        ..Default::default()
    }));
    let (commands, mut sent) = unbounded();
    let mut h = Harness::build(shown, Some(commands), || Err(anyhow::anyhow!("no core")));
    h.open("alpha");
    assert!(h.press("cmd-,"));
    assert!(h.ws(|ws| ws.settings_open()));
    let panel = h.draw();
    // Only the login shell switch is on, so its text is the one green thing below the tab strip
    // (a tab's idle dot is the same green).
    let on = 0x4caf6a;
    let [x0, x1, y0, y1] = panel
        .bounds_of(on, SIDEBAR_WIDTH, WIDTH, TAB_BAR_HEIGHT, HEIGHT)
        .expect("the login shell switch shows On");
    std::iter::from_fn(|| sent.try_recv().ok()).for_each(drop);
    h.click(
        (x0 + x1) / 2.,
        (y0 + y1) / 2.,
        MouseButton::Left,
        Modifiers::default(),
    );
    let patches: Vec<Value> = std::iter::from_fn(|| sent.try_recv().ok())
        .filter_map(|c| match c {
            Command::UpdateSettings(patch) => Some(patch),
            _ => None,
        })
        .collect();
    assert_eq!(
        patches,
        [json!({"terminalLoginShell": false})],
        "the click changes that setting alone"
    );

    // The panel shows what the core reports, not what was asked.
    assert!(panel.count(on, SIDEBAR_WIDTH, WIDTH, TAB_BAR_HEIGHT, HEIGHT) > 20);
    let mut told = model(&[("alpha", json!({}))]);
    told.terminal = Some(Box::new(perch_native::settings::TerminalSettings {
        scrollback: 4321,
        login_shell: false,
        ..Default::default()
    }));
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar()
                .update(cx, |sidebar, cx| sidebar.apply(Update::Model(told), cx))
        })
        .unwrap();
    assert_eq!(
        h.draw()
            .count(on, SIDEBAR_WIDTH, WIDTH, TAB_BAR_HEIGHT, HEIGHT),
        0,
        "the switch is off once the core says so"
    );
    println!("workspace_render: settings control ok");
}

/// A click on a link in a terminal reaches the window, which hands the target to its opener: a
/// URL and a file alike, from whichever pane the click was in. Here the opener only records, so
/// nothing is ever opened. (Finding the link under the pointer is `terminal_render`'s.)
fn a_clicked_link_reaches_the_windows_opener() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.open("bravo");
    h.draw();
    let say = |h: &mut Harness, target: Target| {
        h.window
            .update(&mut h.cx, |ws, _, cx| {
                let view = ws.terminal().expect("a terminal on screen").clone();
                view.update(cx, |_, cx| cx.emit(TerminalEvent::OpenLink(target)))
            })
            .unwrap();
        h.cx.run_until_parked();
    };
    let url = Target::Url("https://example.com/docs".into());
    let file = Target::File("/work/notes.txt".into());
    say(&mut h, url.clone());
    say(&mut h, file.clone());
    assert_eq!(*h.opened.borrow(), [url, file]);
    println!("workspace_render: link opener ok");
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

/// What the core was asked to type, one entry per send.
fn typed(rx: &mut UnboundedReceiver<ToCore>) -> Vec<Vec<u8>> {
    asked(rx)
        .into_iter()
        .filter_map(|m| match m {
            ToCore::Input(bytes) => Some(bytes),
            _ => None,
        })
        .collect()
}

/// A key press as macOS hands it over: GPUI's key path first, and, when that leaves the key
/// unhandled, the system's text input, which inserts the event's own characters
/// (`insertText:`). True when the key path took it.
fn key_then_text(h: &mut Harness, keystroke: Keystroke, characters: &str, held: bool) -> bool {
    let taken =
        h.cx.update_window(h.window.into(), |_, window: &mut Window, cx| {
            !window
                .dispatch_event(
                    PlatformInput::KeyDown(KeyDownEvent {
                        keystroke,
                        is_held: held,
                        prefer_character_input: false,
                    }),
                    cx,
                )
                .propagate
        })
        .unwrap();
    if !taken {
        h.window
            .update(&mut h.cx, |ws, window, cx| {
                let view = ws.terminal().expect("a terminal on screen").clone();
                view.update(cx, |v, cx| {
                    v.replace_text_in_range(None, characters, window, cx)
                })
            })
            .unwrap();
    }
    h.cx.run_until_parked();
    taken
}

fn plain(key: &str, text: &str) -> Keystroke {
    Keystroke {
        modifiers: Modifiers::default(),
        key: key.into(),
        key_char: Some(text.into()),
    }
}

/// The Navigator opens on the web's key, Command-P. Command-Shift-P is not bound in the web or
/// here: the window leaves it to the terminal, which sends a Command chord nothing. A person who
/// wants it chooses it in Settings or `keys.json`, and the window then runs the Navigator's
/// command from a terminal that has the keyboard. No mod draws the Navigator here, so the window
/// says so: that notice is how this sees the command ran.
fn navigator_asked(h: &mut Harness) -> bool {
    h.notice().is_some_and(|n| n.contains("Navigator"))
}

fn the_navigator_opens_on_the_webs_key() {
    let mut h = Harness::new(model(&[("alpha", json!({}))]));
    h.open("alpha");
    h.draw();
    let (mut rx, _core) = h.live();
    h.draw();
    typed(&mut rx);
    assert!(!h.press("cmd-shift-p"), "nothing binds Command-Shift-P");
    assert_eq!(h.notice(), None);
    assert_eq!(
        typed(&mut rx),
        Vec::<Vec<u8>>::new(),
        "and the shell gets nothing"
    );
    assert!(h.press("cmd-p"));
    assert!(navigator_asked(&mut h));

    for chosen in [
        // Settings > Keyboard replaces the default key.
        (Some(("global.navigator", "cmd+shift+p")), None),
        // keys.json adds a key for the typed command.
        (
            None,
            Some(json!({"global": {"cmd-shift-p": "app.palette"}})),
        ),
    ] {
        let mut keyed = model(&[("alpha", json!({}))]);
        if let Some((id, keys)) = chosen.0 {
            keyed.keybindings.insert(id.into(), keys.into());
        }
        keyed.keys_file = chosen.1.clone();
        let mut h = Harness::new(keyed);
        h.open("alpha");
        h.draw();
        let (mut rx, _core) = h.live();
        h.draw();
        typed(&mut rx);
        assert!(
            h.press("cmd-shift-p"),
            "{chosen:?}: the chosen key is taken"
        );
        assert!(navigator_asked(&mut h), "{chosen:?}");
        assert_eq!(typed(&mut rx), Vec::<Vec<u8>>::new());
    }
    println!("workspace_render: navigator key ok");
}

/// `/` goes through the window's keymap and the terminal like any letter and types `/`, however
/// it is spelled: the key itself, or a posted event whose key code GPUI reads as another key.
fn a_slash_types_a_slash() {
    let mut h = Harness::new(model(&[("alpha", json!({}))]));
    h.open("alpha");
    h.draw();
    let (mut rx, _core) = h.live();
    h.draw();
    typed(&mut rx);
    assert!(h.press("/"), "the window took /");
    // Shift+1 as macOS reports it: the key it types, with Shift spent.
    assert!(h.press("!"), "the window took Shift+1");
    assert_eq!(typed(&mut rx), vec![b"/".to_vec(), b"!".to_vec()]);
    // The key `/` as macOS reports it (code 44 on ABC), and as GPUI reports a posted `/` whose
    // key code is 0.
    key_then_text(&mut h, plain("/", "/"), "/", false);
    key_then_text(&mut h, plain("a", "a"), "/", false);
    assert_eq!(typed(&mut rx), vec![b"/".to_vec(), b"/".to_vec()]);
    println!("workspace_render: slash ok");
}

/// GPUI builds a key's text from its key code, so a key event a program posts with its own
/// characters on key code 0 reaches the key path as `a`. A plain key that only types its text
/// is left to the text input, which reads the event's characters; everything the encoder spells
/// differently (repeats, modified keys, a program that asked for every key as an escape code)
/// stays on the key path.
fn posted_characters_type_as_they_are() {
    let mut h = Harness::new(model(&[("alpha", json!({}))]));
    h.open("alpha");
    h.draw();
    let (mut rx, core) = h.live();
    h.draw();
    typed(&mut rx);
    for posted in ["\u{e9}", "\u{65e5}", "Z", "?"] {
        key_then_text(&mut h, plain("a", "a"), posted, false);
        assert_eq!(typed(&mut rx), vec![posted.as_bytes().to_vec()], "{posted}");
    }
    // A real key types once, through the text input.
    assert!(h.press("a"));
    assert_eq!(typed(&mut rx), vec![b"a".to_vec()]);
    // A held key repeats on the key path, so macOS's press-and-hold menu never takes it.
    assert!(key_then_text(&mut h, plain("e", "e"), "e", true));
    assert_eq!(typed(&mut rx), vec![b"e".to_vec()]);
    // Option as Alt and Control stay on the key path.
    let mut option = plain("x", "\u{2248}");
    option.modifiers = Modifiers::alt();
    assert!(key_then_text(&mut h, option, "\u{2248}", false));
    let mut control = plain("c", "c");
    control.modifiers = Modifiers::control();
    control.key_char = None;
    assert!(key_then_text(&mut h, control, "", false));
    assert_eq!(typed(&mut rx), vec![b"\x1bx".to_vec(), b"\x03".to_vec()]);
    // A program that asked for every key as an escape code (kitty `>9u`) gets the key's code.
    core.unbounded_send(FromCore::Output("\x1b[>9u".into()))
        .unwrap();
    h.cx.run_until_parked();
    assert!(key_then_text(&mut h, plain("a", "a"), "a", false));
    assert_eq!(typed(&mut rx), vec![b"\x1b[97u".to_vec()]);
    println!("workspace_render: posted characters ok");
}

/// A click lands where it is, with no pointer move before it and after typing: GPUI finds what is
/// under the pointer from the click's own position. A pane of a split (a tab: `mods_chrome_window`).
fn a_click_needs_no_move_before_it() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.open("bravo");
    assert!(h.press("cmd-1"));
    assert_eq!(h.active().as_deref(), Some("alpha"));
    h.draw();

    // A split: a click in the pane without the keyboard gives it the keyboard.
    assert!(h.press("cmd-d"));
    h.window
        .update(&mut h.cx, |ws, _, cx| {
            ws.sidebar().update(cx, |sidebar, cx| {
                sidebar.apply(
                    Update::Launched {
                        host_id: "local".into(),
                        session_id: "charlie".into(),
                        provider: "terminal".into(),
                    },
                    cx,
                )
            })
        })
        .unwrap();
    h.cx.run_until_parked();
    h.draw();
    assert_eq!(h.active().as_deref(), Some("charlie"));
    h.press("x");
    h.click(
        SIDEBAR_WIDTH + 100.,
        HEIGHT / 2.,
        MouseButton::Left,
        Modifiers::default(),
    );
    assert_eq!(h.active().as_deref(), Some("alpha"), "the left pane");
    h.draw();
    let left = h.ws(|ws| ws.terminal().cloned()).unwrap();
    let focused = h
        .window
        .update(&mut h.cx, |_, window, cx| {
            gpui::Focusable::focus_handle(&left, cx).is_focused(window)
        })
        .unwrap();
    assert!(focused, "and its terminal the keyboard");

    println!("workspace_render: click without a move ok");
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

    // A page at a time, by the commands that have no key by default.
    h.run("terminal.scrollPageUp", json!({})).unwrap();
    assert!(!has(&mut h, "line 200"), "a page up left the bottom");
    let paged = top(&mut h);
    h.run("terminal.scrollPageDown", json!({})).unwrap();
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

/// A phone holds the size of two of three attached terminals: the pane offers the web's two
/// choices only when typing is shared, "this" takes one terminal's input and size, "all" takes
/// the size alone of each terminal a phone holds, and a terminal this window sizes is never asked.
fn the_size_is_taken_back_from_a_phone_for_one_terminal_or_all() {
    use perch_core::agent_fleet::AgentState;
    use perch_native::terminal::attach::{AgentInfo, SHARED_INPUT};
    let info = |resize: bool, resize_on_device: bool| {
        FromCore::Agent(AgentInfo {
            state: AgentState::Idle,
            input: resize,
            resize,
            input_elsewhere: false,
            resize_on_device,
        })
    };
    // What was asked of the core, but for the size a view that sizes its terminal tells it.
    let taken = |rx: &mut UnboundedReceiver<ToCore>| -> Vec<ToCore> {
        asked(rx)
            .into_iter()
            .filter(|m| !matches!(m, ToCore::Resize(..)))
            .collect()
    };
    let mut h = Harness::new(model(&[
        ("a", json!({"cliProviderId": "terminal"})),
        ("b", json!({"cliProviderId": "terminal"})),
        ("c", json!({"cliProviderId": "terminal"})),
    ]));
    let (mut rxs, mut txs) = (Vec::new(), Vec::new());
    for id in ["a", "b", "c"] {
        h.open_as(id, Some("terminal"));
        h.draw();
        let (rx, tx) = h.live();
        rxs.push(rx);
        txs.push(tx);
    }
    let say = |h: &mut Harness, which: usize, message: FromCore| {
        txs[which].unbounded_send(message).unwrap();
        h.cx.run_until_parked();
    };
    // Nothing is held by a phone yet: there is nothing to take back.
    assert_eq!(
        h.run("terminal.takeBackAll", json!({})),
        Err("No phone holds the size of a terminal in this window.".into())
    );
    assert_eq!(
        h.run("terminal.takeBack", json!({})),
        Err("No phone holds this terminal's size, or it is not attached.".into())
    );
    for rx in &mut rxs {
        assert_eq!(taken(rx), vec![]);
    }

    // A phone sizes a and c; this window sizes b, which is on screen and has the keyboard.
    say(&mut h, 0, info(false, true));
    say(&mut h, 1, info(true, false));
    say(&mut h, 2, info(false, true));
    // Without shared typing the web offers Take control, not the choices.
    assert!(h.ws(|ws| ws.terminal().is_some()));
    h.open_as("c", Some("terminal"));
    assert!(h.view(|v| v.size_held_by_phone() && !v.offers_take_back()));
    // Without shared typing the web offers Take control, and the pane's chip says who types.
    assert!(h.view(|v| !v.agent_control()["control"].is_null()));
    for which in 0..3 {
        say(
            &mut h,
            which,
            FromCore::Capabilities(vec![SHARED_INPUT.into()]),
        );
    }
    assert!(h.view(|v| v.offers_take_back()));
    // The phone-size notice says it; the agent's chip says nothing.
    assert!(h.view(|v| v.agent_control()["label"].is_null()));
    // The window sizes b: no choices, and neither command has anything to do there.
    h.open_as("b", Some("terminal"));
    assert!(!h.view(|v| v.size_held_by_phone() || v.offers_take_back()));
    assert!(h.run("terminal.takeBack", json!({})).is_err());
    assert_eq!(taken(&mut rxs[1]), vec![]);

    // This one: a single take of the input and the size, for the terminal on screen.
    h.open_as("a", Some("terminal"));
    assert_eq!(h.run("terminal.takeBack", json!({})), Ok(()));
    assert_eq!(taken(&mut rxs[0]), vec![ToCore::TakeControl]);
    assert_eq!(taken(&mut rxs[1]), vec![]);
    assert_eq!(taken(&mut rxs[2]), vec![]);

    // All: the size alone, once for each terminal a phone holds, wherever it is shown, and
    // none for b.
    assert_eq!(h.run("terminal.takeBackAll", json!({})), Ok(()));
    assert_eq!(taken(&mut rxs[0]), vec![ToCore::TakeSize]);
    assert_eq!(taken(&mut rxs[1]), vec![]);
    assert_eq!(taken(&mut rxs[2]), vec![ToCore::TakeSize]);

    // The grant for c, which is not on screen, arrives: it tells the size it last fitted at
    // once, not when its tab comes back.
    say(&mut h, 2, info(true, false));
    assert_eq!(asked(&mut rxs[2]), vec![ToCore::Resize(94, 31)]);
    say(&mut h, 2, info(false, true));

    // The pane's choices are the phone-size stock screen's, which runs these same commands.
    h.open_as("a", Some("terminal"));
    // Once the core says this window has the size, the choices go and the commands refuse.
    say(&mut h, 0, info(true, false));
    assert!(!h.view(|v| v.offers_take_back()));
    assert!(
        h.view(|v| v.agent_control()["label"].is_null()),
        "the owner is told nothing"
    );
    println!("workspace_render: take back ok");
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

/// A right-click in a pane asks for the pane menu there. No mod draws it here, so the window says
/// so; the stock menu's own behaviour is `mods_floating_window`'s.
fn the_pane_menu_opens_on_right_click() {
    let mut h = Harness::new(model(&[("alpha", json!({})), ("bravo", json!({}))]));
    h.open("alpha");
    h.draw();
    assert_eq!(h.notice(), None);
    h.click(
        SIDEBAR_WIDTH + 300.,
        200.,
        MouseButton::Right,
        Modifiers::default(),
    );
    assert!(h.notice().is_some_and(|n| n.contains("pane menu")));
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

fn asked(rx: &mut UnboundedReceiver<ToCore>) -> Vec<ToCore> {
    std::iter::from_fn(|| rx.try_recv().ok()).collect()
}

/// How many times the core was asked to end the session.
fn ends(rx: &mut UnboundedReceiver<ToCore>) -> usize {
    asked(rx).iter().filter(|m| **m == ToCore::End).count()
}

/// Closing a tab ends its session as the web does: a terminal at once, an agent only through the
/// close guard while the warning is on (and a shell with an agent typed into it counts as one), at
/// once when it is off. No mod draws the close guard here, so an agent is not ended and the window
/// says so; the stock close guard's answers are `mods_floating_window`'s.
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
        let (mut rx, _core) = h.live();
        for _ in 0..2 {
            assert_eq!(h.run("tabs.close", json!({})), Ok(()));
            assert_eq!(ends(&mut rx), 0, "{id}: not ended without the close guard");
            assert!(h.notice().unwrap().contains("confirmation"), "{id}");
            assert!(h.ws(|ws| ws.tabs().contains(id)));
        }
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
    let (choosing, status, control) =
        h.view(|v| (v.choosing(), v.status().clone(), v.agent_control()));
    assert!(choosing);
    assert_eq!(
        status,
        Status::Detached,
        "nothing is attached before a choice"
    );
    assert!(
        control["label"].is_null(),
        "the choices stand in for the agent's chip"
    );
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
    the_navigator_opens_on_the_webs_key();
    a_slash_types_a_slash();
    posted_characters_type_as_they_are();
    a_click_needs_no_move_before_it();
    a_blank_session_offers_the_launch_choices();
    closing_a_tab_ends_its_session();
    a_tab_that_cannot_end_its_session_is_put_away();
    a_session_with_no_launch_provider_is_not_attached();
    a_deleted_session_closes_its_tab_whenever_the_core_says_so();
    the_pane_menu_opens_on_right_click();
    a_peek_is_a_terminal_over_the_window();
    tabs_out_of_sight_are_parked_beyond_twelve();
    zoom_scales_the_terminals();
    two_tabs();
    a_split_shows_each_pane();
    terminal_settings_show_what_the_core_sent();
    a_settings_control_sends_the_changed_value();
    a_clicked_link_reaches_the_windows_opener();
    keys_json_and_chosen_keys_rule();
    editing_keys_reach_the_shell_through_the_window();
    terminal_commands_run_from_keys_and_the_palette();
    the_size_is_taken_back_from_a_phone_for_one_terminal_or_all();
    kept_tabs_are_hidden_not_dropped();
    println!("workspace_render: ok");
}
