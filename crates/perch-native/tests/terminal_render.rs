//! Renders the terminal view offscreen from the messages a core sends and checks what is drawn
//! and what the view asks of the core.
//!
//! GPUI's test platform draws through the real Metal renderer into a texture
//! (`Window::render_to_image`); no window is created, shown or focused. The core is a pair of
//! channels the test holds the far ends of. This is its own binary with a custom `main`, as Zed's
//! headless tests are, so AppKit runs on the main thread.

use futures::channel::mpsc::{unbounded, UnboundedReceiver, UnboundedSender};
use gpui::{
    point, px, size, AppContext, HeadlessAppContext, KeyDownEvent, Keystroke, Modifiers,
    MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, ScrollDelta, ScrollWheelEvent,
    TouchPhase, Window, WindowHandle,
};
use perch_native::terminal::attach::{FromCore, ToCore};
use perch_native::terminal::clipboard::MemoryClipboard;
use perch_native::terminal::keys::key_bytes;
use perch_native::terminal::layout::{MIN_COLS, MIN_FONT_PX};

/// The web terminal's default padding: none.
const PAD_X: f32 = 0.0;
const PAD_Y: f32 = 0.0;
use perch_native::terminal::vt::Theme;
use perch_native::terminal::{Status, TerminalEvent, TerminalView};
use std::sync::Arc;

/// Default colours of the terminal, as pixels.
fn rgb(hex: u32) -> [u8; 3] {
    [(hex >> 16) as u8, (hex >> 8) as u8, hex as u8]
}

thread_local! {
    /// The test being run, which names its frame in `PERCH_NATIVE_SHOT_DIR`.
    static SHOT_NAME: std::cell::Cell<&'static str> = const { std::cell::Cell::new("frame") };
}

/// Run one test, naming the frames it dumps.
fn run(name: &'static str, test: impl FnOnce()) {
    SHOT_NAME.with(|n| n.set(name));
    test();
}

struct Shot {
    raw: Vec<u8>,
    width: usize,
    scale: f32,
    cell: (f32, f32),
}

impl Shot {
    /// The pixel at a logical position.
    fn at(&self, x: f32, y: f32) -> [u8; 3] {
        let (px, py) = ((x * self.scale) as usize, (y * self.scale) as usize);
        let i = (py * self.width + px) * 4;
        [self.raw[i], self.raw[i + 1], self.raw[i + 2]]
    }

    /// The middle of a cell.
    fn center(&self, col: usize, row: usize) -> [u8; 3] {
        let (x, y) = self.cell_origin(col, row);
        self.at(x + self.cell.0 / 2.0, y + self.cell.1 / 2.0)
    }

    fn cell_origin(&self, col: usize, row: usize) -> (f32, f32) {
        (
            PAD_X + col as f32 * self.cell.0,
            PAD_Y + row as f32 * self.cell.1,
        )
    }

    /// Pixels in the `cols` x 1 cells at (`col`, `row`) that are not `background`.
    fn ink(&self, col: usize, row: usize, cols: usize, background: [u8; 3]) -> usize {
        self.count(col, row, cols, |p| differs(p, background))
    }

    fn count(
        &self,
        col: usize,
        row: usize,
        cols: usize,
        matches: impl Fn([u8; 3]) -> bool,
    ) -> usize {
        let (x0, y0) = self.cell_origin(col, row);
        let (x1, y1) = (x0 + self.cell.0 * cols as f32, y0 + self.cell.1);
        let mut n = 0;
        let mut y = y0;
        while y < y1 - 0.5 {
            let mut x = x0;
            while x < x1 - 0.5 {
                if matches(self.at(x, y)) {
                    n += 1;
                }
                x += 1.0 / self.scale;
            }
            y += 1.0 / self.scale;
        }
        n
    }
}

fn near(a: [u8; 3], b: [u8; 3]) -> bool {
    a.iter().zip(b).all(|(x, y)| x.abs_diff(y) <= 3)
}

fn differs(a: [u8; 3], b: [u8; 3]) -> bool {
    !near(a, b)
}

struct Harness {
    cx: HeadlessAppContext,
    window: WindowHandle<TerminalView>,
    to_core: UnboundedReceiver<ToCore>,
    from_core: UnboundedSender<FromCore>,
}

impl Harness {
    /// A terminal view of `width` x `height` logical pixels, linked to a core this test plays.
    fn open(width: f32, height: f32) -> Self {
        let mut cx = HeadlessAppContext::with_platform(
            gpui_platform::current_platform(true).text_system(),
            Arc::new(()),
            gpui_platform::current_headless_renderer,
        );
        let window = cx
            .open_window(size(px(width), px(height)), |_, cx| {
                cx.new(TerminalView::new)
            })
            .unwrap();
        let (to_core_tx, to_core) = unbounded();
        let (from_core, from_core_rx) = unbounded();
        window
            .update(&mut cx, |view, _, cx| {
                view.link(to_core_tx, from_core_rx, cx)
            })
            .unwrap();
        Self {
            cx,
            window,
            to_core,
            from_core,
        }
    }

    fn say(&mut self, event: FromCore) {
        self.from_core.unbounded_send(event).unwrap();
        self.cx.run_until_parked();
    }

    /// The core attaches the view as the owner of everything and repaints it at `cols` x `rows`.
    fn attach(&mut self, cols: u16, rows: u16, screen: &str) {
        self.attach_as(true, true, cols, rows, screen);
    }

    fn attach_as(&mut self, input: bool, resize: bool, cols: u16, rows: u16, screen: &str) {
        self.say(FromCore::Attached {
            replay: format!("\x1b[8;{rows};{cols}t{screen}"),
            input,
            resize,
            agent: None,
        });
    }

    fn output(&mut self, text: &str) {
        self.say(FromCore::Output(text.into()));
    }

    /// Everything the view has sent the core so far.
    fn sent(&mut self) -> Vec<ToCore> {
        let mut sent = Vec::new();
        while let Ok(message) = self.to_core.try_recv() {
            sent.push(message);
        }
        sent
    }

    fn view<R>(
        &mut self,
        f: impl FnOnce(&mut TerminalView, &mut gpui::Context<TerminalView>) -> R,
    ) -> R {
        self.window
            .update(&mut self.cx, |view, _, cx| f(view, cx))
            .unwrap()
    }

    fn focus(&mut self) {
        self.window
            .update(&mut self.cx, |view, window, cx| view.focus(window, cx))
            .unwrap();
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
        // Off unless asked: the last frame of each test, to look at.
        if let Some(dir) = std::env::var_os("PERCH_NATIVE_SHOT_DIR") {
            let name = SHOT_NAME.with(|n| n.get());
            std::fs::create_dir_all(&dir).expect("shot dir");
            image
                .save(std::path::Path::new(&dir).join(format!("{name}.png")))
                .expect("write the frame");
        }
        let cell = self.view(|view, _| view.cell_size()).expect("laid out");
        Shot {
            width: image.width() as usize,
            raw: image.into_raw(),
            scale,
            cell: (f32::from(cell.width), f32::from(cell.height)),
        }
    }

    /// Press, drag and release the left button from one cell to another, as the pointer would.
    /// `(col, row)` is a cell; `frac` where in it (0 left edge, 1 right edge).
    fn drag(&mut self, from: (usize, usize, f32), to: (usize, usize, f32)) {
        let (x0, y0) = self.pos(from);
        let (x1, y1) = self.pos(to);
        self.press(MouseButton::Left, x0, y0, Modifiers::default());
        self.view(|v, cx| {
            v.mouse_moved(
                &MouseMoveEvent {
                    position: point(px(x1), px(y1)),
                    pressed_button: Some(MouseButton::Left),
                    modifiers: Modifiers::default(),
                },
                cx,
            )
        });
        self.release(MouseButton::Left, x1, y1, Modifiers::default());
    }

    fn pos(&mut self, (col, row, frac): (usize, usize, f32)) -> (f32, f32) {
        let cell = self.view(|v, _| v.cell_size()).expect("laid out");
        (
            PAD_X + (col as f32 + frac) * f32::from(cell.width),
            PAD_Y + (row as f32 + 0.5) * f32::from(cell.height),
        )
    }

    fn press(&mut self, button: MouseButton, x: f32, y: f32, modifiers: Modifiers) {
        self.view(|v, cx| {
            v.mouse_down(
                &MouseDownEvent {
                    button,
                    position: point(px(x), px(y)),
                    modifiers,
                    click_count: 1,
                    first_mouse: false,
                },
                cx,
            )
        });
    }

    fn release(&mut self, button: MouseButton, x: f32, y: f32, modifiers: Modifiers) {
        self.view(|v, cx| {
            v.mouse_up(
                &MouseUpEvent {
                    button,
                    position: point(px(x), px(y)),
                    modifiers,
                    click_count: 1,
                },
                cx,
            )
        });
    }

    fn click(&mut self, cell: (usize, usize, f32)) {
        let (x, y) = self.pos(cell);
        self.press(MouseButton::Left, x, y, Modifiers::default());
        self.release(MouseButton::Left, x, y, Modifiers::default());
    }

    fn resize(&mut self, width: f32, height: f32) {
        self.cx
            .update_window(self.window.into(), |_, window: &mut Window, cx| {
                window.resize(size(px(width), px(height)));
                window.bounds_changed(cx);
            })
            .unwrap();
    }
}

fn key(text: &str, key_char: Option<&str>) -> KeyDownEvent {
    let mut keystroke = Keystroke::parse(text).unwrap();
    keystroke.key_char = key_char.map(Into::into);
    KeyDownEvent {
        keystroke,
        is_held: false,
        prefer_character_input: false,
    }
}

fn wheel(lines: f32) -> ScrollWheelEvent {
    ScrollWheelEvent {
        position: point(px(100.), px(100.)),
        delta: ScrollDelta::Lines(point(0., lines)),
        modifiers: Modifiers::default(),
        touch_phase: TouchPhase::Moved,
    }
}

fn main() {
    let theme = Theme::default();
    let (bg, fg) = (
        rgb(u32::from(theme.bg.0) << 16 | u32::from(theme.bg.1) << 8 | u32::from(theme.bg.2)),
        rgb(0xffffff),
    );

    run("colours_and_cursor", || colours_and_cursor(bg, fg));
    run("attributes", || attributes(bg, fg));
    run("wide_and_emoji", || wide_and_emoji(bg));
    run("resize_authority", resize_authority);
    run("narrow_panes_shrink_the_font", narrow_panes_shrink_the_font);
    run("input_and_scrolling", input_and_scrolling);
    run("disconnect_keeps_the_screen", disconnect_keeps_the_screen);
    run(
        "workspace_attaches_the_open_session",
        workspace_attaches_the_open_session,
    );
    run("profile_and_settings", profile_and_settings);
    run("selection_and_clipboard", selection_and_clipboard);
    run("find_in_the_pane", find_in_the_pane);
    run("links_in_the_pane", links_in_the_pane);
    println!("terminal_render: ok");
}

/// The user's terminal profile and the settings change what is drawn: colours, cursor, padding,
/// opacity and Option as Alt, live, and the dark and light palettes follow the window.
fn profile_and_settings() {
    use perch_core::iterm_profile::TerminalProfile;
    use perch_core::protocol::SettingsData;
    use std::collections::BTreeMap;
    let palette = |bg: &str, fg: &str| {
        BTreeMap::from([
            ("background".to_owned(), bg.to_owned()),
            ("foreground".to_owned(), fg.to_owned()),
            ("red".to_owned(), "#cc3333".to_owned()),
            ("cursor".to_owned(), "#00ff00".to_owned()),
        ])
    };
    let profile = TerminalProfile {
        font_family: Some("Monaco".into()),
        font_size: Some(15.0),
        theme: BTreeMap::new(),
        theme_light: palette("#f0f0e0", "#202020"),
        theme_dark: palette("#102030", "#d0d0d0"),
        cursor_style: Some("bar".into()),
        cursor_blink: None,
    };
    let mut h = Harness::open(900., 420.);
    h.view(|v, cx| {
        v.set_dark(Some(true), cx);
        v.apply_core(Some(Some(profile.clone())), None, cx);
    });
    h.attach(100, 24, "\x1b[41m  \x1b[0mhi");
    h.focus();
    let shot = h.draw();
    assert!(
        near(shot.at(450., 300.), rgb(0x102030)),
        "the dark palette's background"
    );
    assert!(near(shot.center(0, 0), rgb(0xcc3333)), "the profile's red");
    assert_eq!(h.view(|v, _| v.font_px()), Some(15.0), "the profile's size");
    // The profile's cursor: a bar, in its colour, after "hi" at column 4.
    let (x, y) = shot.cell_origin(4, 0);
    assert!(
        near(shot.at(x + 0.5, y + shot.cell.1 / 2.0), rgb(0x00ff00)),
        "profile cursor colour and bar shape"
    );
    h.view(|v, cx| v.set_dark(Some(false), cx));
    let shot = h.draw();
    assert!(
        near(shot.at(450., 300.), rgb(0xf0f0e0)),
        "the light palette follows the window"
    );

    // Settings: padding moves the grid, opacity lets the window show through.
    let mut data: SettingsData = serde_json::from_str(r#"{"theme":"x"}"#).unwrap();
    data.terminal_padding = [20.0, 10.0];
    data.terminal_opacity = 0.5;
    h.view(|v, cx| v.apply_core(None, Some(data), cx));
    let shot = h.draw();
    let (x, y) = (20.0 + 0.5 * shot.cell.0, 10.0 + 0.5 * shot.cell.1);
    // The red cells now start at the padding; opacity blends them with the window behind.
    let p = shot.at(x, y);
    assert!(p[0] > p[1] && p[0] < 0xcc, "half-transparent red {p:?}");
    assert!(
        shot.at(5., 5.) != shot.at(x, y),
        "the padding is outside the grid"
    );
    assert_eq!(
        h.view(|v, _| v.fitted_size()).map(|s| s.0),
        Some(((900.0f32 - 40.0) / shot.cell.0 + 0.01).floor() as u16)
    );
}

/// Selecting with the pointer and the keyboard, copying, pasting, and a program's OSC 52 write,
/// all against a clipboard of the test's own.
fn selection_and_clipboard() {
    let mut h = Harness::open(900., 420.);
    let clip = std::rc::Rc::new(MemoryClipboard::new(Some("pasted\ntext")));
    h.view(|v, _| v.set_clipboard(clip.clone()));
    h.attach(100, 24, "ab   cd\r\nhello world\r\nsecond   line");
    h.focus();
    h.draw();

    // A drag selects, shows it, and copies on release; the highlight stays.
    h.drag((0, 1, 0.1), (4, 1, 0.9));
    assert_eq!(h.view(|v, _| v.selection_text()).as_deref(), Some("hello"));
    assert_eq!(clip.text().as_deref(), Some("hello"), "copied on release");
    // Cells 2-4 of row 0 are blank: select across them and look at the pixels.
    h.drag((0, 0, 0.1), (6, 0, 0.9));
    let shot = h.draw();
    let fg = rgb(0xffffff);
    let selected = rgb(0x4d4d4d);
    assert!(
        near(shot.center(3, 0), selected),
        "selection colour {:?}",
        shot.center(3, 0)
    );
    assert!(
        near(shot.center(20, 1), rgb(0)),
        "other rows are not selected"
    );
    assert!(shot.ink(0, 0, 1, selected) > 4, "the text shows over it");
    let _ = fg;

    // Double click: a word. Triple click: the line. A click elsewhere: nothing.
    h.click((7, 1, 0.5));
    h.click((7, 1, 0.5));
    assert_eq!(h.view(|v, _| v.selection_text()).as_deref(), Some("world"));
    h.click((7, 1, 0.5));
    assert_eq!(
        h.view(|v, _| v.selection_text()).as_deref(),
        Some("hello world")
    );
    std::thread::sleep(std::time::Duration::from_millis(600));
    h.click((30, 5, 0.5));
    assert_eq!(h.view(|v, _| v.selection_text()), None);

    // Shift-click moves the end of the selection.
    h.drag((0, 1, 0.1), (1, 1, 0.9));
    let (x, y) = h.pos((4, 1, 0.9));
    h.press(
        MouseButton::Left,
        x,
        y,
        Modifiers {
            shift: true,
            ..Default::default()
        },
    );
    h.release(
        MouseButton::Left,
        x,
        y,
        Modifiers {
            shift: true,
            ..Default::default()
        },
    );
    assert_eq!(h.view(|v, _| v.selection_text()).as_deref(), Some("hello"));

    // The selection survives scrolling through history.
    let many: String = (0..60).map(|n| format!("row {n}\r\n")).collect();
    h.output(&many);
    h.drag((0, 3, 0.1), (3, 3, 0.9));
    let picked = h.view(|v, _| v.selection_text()).expect("selected");
    h.view(|v, cx| v.scroll_wheel(&wheel(5.), cx));
    assert_eq!(h.view(|v, _| v.selection_text()), Some(picked));

    // Select all waits for copy; copy writes the clipboard and ends the selection; typing
    // clears it.
    clip.write_text_for_test("old");
    h.view(|v, cx| v.select_all(cx));
    assert_eq!(
        clip.text().as_deref(),
        Some("old"),
        "select all copies nothing"
    );
    let all = h.view(|v, _| v.selection_text()).unwrap();
    assert!(
        all.contains("hello world") && all.contains("row 59"),
        "history included"
    );
    assert!(h.view(|v, cx| v.key_down(&key("cmd-c", None), cx)));
    assert_eq!(clip.text(), Some(all));
    assert_eq!(
        h.view(|v, _| v.selection_text()),
        None,
        "copy ends the selection"
    );
    assert!(
        !h.view(|v, cx| v.key_down(&key("cmd-c", None), cx)),
        "with nothing selected the chord is left to the app"
    );
    h.view(|v, cx| v.select_all(cx));
    h.sent();
    assert!(h.view(|v, cx| v.key_down(&key("a", Some("a")), cx)));
    assert_eq!(h.view(|v, _| v.selection_text()), None, "typing clears it");
    h.sent();

    // Paste: the command key, and a middle click.
    clip.write_text_for_test("old");
    assert!(h.view(|v, cx| v.key_down(&key("cmd-v", None), cx)));
    let (x, y) = h.pos((2, 2, 0.5));
    h.press(MouseButton::Middle, x, y, Modifiers::default());
    let pasted: Vec<_> = h
        .sent()
        .into_iter()
        .filter_map(|m| match m {
            ToCore::Input(bytes) => Some(bytes),
            _ => None,
        })
        .collect();
    assert_eq!(pasted, vec![b"old".to_vec(), b"old".to_vec()]);

    // A program that takes the mouse gets the click, and our selection ends.
    h.drag((0, 1, 0.1), (3, 1, 0.9));
    assert!(h.view(|v, _| v.selection_text()).is_some());
    h.output("\x1b[?1000h\x1b[?1006h");
    h.click((0, 1, 0.5));
    assert_eq!(h.view(|v, _| v.selection_text()), None);
    assert!(h
        .sent()
        .iter()
        .any(|m| matches!(m, ToCore::Input(b) if b.starts_with(b"\x1b[<0;"))));
    h.output("\x1b[?1000l");

    // OSC 52: a program sets the clipboard, unless the setting is off. A `?` read gets nothing.
    h.output("\x1b]52;c;aGk=\x07");
    assert_eq!(clip.text().as_deref(), Some("hi"));
    h.output("\x1b]52;c;?\x07");
    assert!(h.sent().is_empty(), "a program cannot read the clipboard");
    let mut data: perch_core::protocol::SettingsData =
        serde_json::from_str(r#"{"theme":"x"}"#).unwrap();
    data.clipboard_write = false;
    h.view(|v, cx| v.apply_core(None, Some(data), cx));
    h.output("\x1b]52;c;bm8=\x07");
    assert_eq!(clip.text().as_deref(), Some("hi"), "clipboardWrite off");
}

/// Links: found in the text and in OSC 8, underlined under the link key, and a click on one with
/// the key held is an event for the window to act on, never an action of the view's own.
fn links_in_the_pane() {
    use perch_native::terminal::links::Target;
    let dir = std::env::temp_dir().join(format!("perch-render-links-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("notes.txt"), "").unwrap();
    let mut h = Harness::open(900., 420.);
    let events = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
    let seen = events.clone();
    let _subscription = h
        .window
        .update(&mut h.cx, |_, _, cx| {
            let view = cx.entity();
            cx.subscribe(&view, move |_, _, event: &TerminalEvent, _| {
                seen.borrow_mut().push(event.clone())
            })
        })
        .unwrap();
    h.view(|v, _| v.set_cwd(Some(dir.clone())));
    h.attach(
        100,
        24,
        "visit https://example.com/docs now\r\n\
         \x1b]8;;https://marked.example/target\x07click me\x1b]8;;\x07\r\n\
         open ./notes.txt:7 and ./missing.txt\r\n",
    );
    h.focus();
    h.draw();
    h.sent();
    let cmd = Modifiers { platform: true, ..Default::default() };
    let at = |h: &mut Harness, cell: (usize, usize, f32)| h.pos(cell);
    let mv = |h: &mut Harness, cell: (usize, usize, f32), modifiers: Modifiers| {
        let (x, y) = at(h, cell);
        h.view(|v, cx| {
            v.mouse_moved(
                &MouseMoveEvent { position: point(px(x), px(y)), pressed_button: None, modifiers },
                cx,
            )
        });
    };

    // Without the link key nothing is a link; with it the link is underlined.
    mv(&mut h, (10, 0, 0.5), Modifiers::default());
    assert!(h.view(|v, _| v.hovered_link().is_none()));
    mv(&mut h, (10, 0, 0.5), cmd);
    let hit = h.view(|v, _| v.hovered_link().cloned()).expect("a link under the pointer");
    assert_eq!(hit.target, "https://example.com/docs");
    let shot = h.draw();
    let base = shot.cell_origin(6, 0);
    let underline = (0..shot.cell.1 as usize * shot.scale as usize)
        .map(|i| shot.at(base.0 + 2.0, base.1 + i as f32 / shot.scale))
        .filter(|p| near(*p, rgb(0xffffff)))
        .count();
    assert!(underline >= 1, "the underline under the link");
    h.view(|v, cx| v.modifiers_changed(Modifiers::default(), cx));
    assert!(h.view(|v, _| v.hovered_link().is_none()), "letting go of the key ends it");

    // Command-click on a link says so; it does not select, and a program that takes the mouse
    // is not told of the click.
    h.output("\x1b[?1000h\x1b[?1006h");
    let (x, y) = at(&mut h, (10, 0, 0.5));
    h.press(MouseButton::Left, x, y, cmd);
    h.release(MouseButton::Left, x, y, cmd);
    assert_eq!(
        events.borrow().last(),
        Some(&TerminalEvent::OpenLink(Target::Url("https://example.com/docs".into())))
    );
    assert!(h.sent().is_empty(), "the click was not reported to the program");
    h.output("\x1b[?1000l");
    assert_eq!(h.view(|v, _| v.selection_text()), None);

    // OSC 8 opens its own URI; a file opens only if it exists, ':7' dropped.
    let (x, y) = at(&mut h, (3, 1, 0.5));
    h.press(MouseButton::Left, x, y, cmd);
    assert_eq!(
        events.borrow().last(),
        Some(&TerminalEvent::OpenLink(Target::Url("https://marked.example/target".into())))
    );
    let (x, y) = at(&mut h, (7, 2, 0.5));
    h.press(MouseButton::Left, x, y, cmd);
    assert_eq!(
        events.borrow().last(),
        Some(&TerminalEvent::OpenLink(Target::File(dir.join("notes.txt")))),
        "the file next to the terminal"
    );
    let count = events.borrow().len();
    let (x, y) = at(&mut h, (26, 2, 0.5));
    h.press(MouseButton::Left, x, y, cmd);
    assert_eq!(events.borrow().len(), count, "a file that does not exist is not a link");
    std::fs::remove_dir_all(&dir).unwrap();
}

/// Typing into the pane as the keyboard does.
fn type_keys(h: &mut Harness, text: &str) {
    for c in text.chars() {
        let s = c.to_string();
        assert!(h.view(|v, cx| v.key_down(&key(&s, Some(&s)), cx)), "{c:?}");
    }
}

/// Finding text: the bar, the counter, the highlights, navigation into history, and that the
/// shell hears none of it.
fn find_in_the_pane() {
    let mut h = Harness::open(900., 420.);
    let clip = std::rc::Rc::new(MemoryClipboard::new(None));
    h.view(|v, _| v.set_clipboard(clip.clone()));
    let mut screen = String::from("Needle in history\r\n");
    for n in 0..60 {
        screen += &format!("filler {n}\r\n");
    }
    screen += "a needle here\r\nnothing\r\nNEEDLE again";
    h.attach(100, 24, &screen);
    h.focus();
    h.draw();
    h.sent();

    assert!(h.view(|v, cx| v.key_down(&key("cmd-f", None), cx)), "cmd-f opens the bar");
    assert!(h.view(|v, _| v.find_open()));
    assert_eq!(h.view(|v, _| v.find_label()), "");
    type_keys(&mut h, "needle");
    // Indexing runs in steps; the label says so until it is done.
    let mut ticks = 0;
    while h.view(|v, cx| v.search_tick(cx)) == std::time::Duration::from_millis(33) {
        ticks += 1;
        assert!(ticks < 1000, "the search never finished");
    }
    assert_eq!(h.view(|v, _| v.find_label()), "3 matches");
    // Matches are tinted: a live one at the low opacity, over the default background.
    let shot = h.draw();
    let spans = h.view(|v, _| v.frame().search);
    assert_eq!(spans.len(), 2, "two matches are on screen: {spans:?}");
    let span = spans[0];
    let (x, y) = shot.cell_origin(usize::from(span.start), usize::from(span.row));
    let tinted = shot.at(x + 0.5 / shot.scale, y + 0.5 / shot.scale);
    assert!(near(tinted, [71, 59, 17]), "28 percent of the tint {tinted:?}");

    // Enter selects the next match and scrolls it into view; the oldest is in history.
    for _ in 0..3 {
        assert!(h.view(|v, cx| v.key_down(&key("enter", None), cx)));
    }
    assert!(h.view(|v, _| v.frame().row_text(0) == "Needle in history" || (0..24).any(|r| v.frame().row_text(r) == "Needle in history")));
    let label = h.view(|v, _| v.find_label());
    assert!(label.ends_with("/ 3"), "{label}");
    let shot = h.draw();
    let spans = h.view(|v, _| v.frame().search);
    let selected = spans.iter().find(|s| s.selected).expect("the selected match is in view");
    let (x, y) = shot.cell_origin(usize::from(selected.start), usize::from(selected.row));
    let bright = shot.at(x + 0.5 / shot.scale, y + 0.5 / shot.scale);
    assert!(near(bright, [140, 116, 34]), "55 percent of the tint {bright:?}");
    assert!(h.view(|v, cx| v.key_down(&key("shift-enter", None), cx)));
    let after = h.view(|v, _| v.find_label());
    assert_ne!(after, label, "shift-enter went the other way");

    // Nothing typed, navigated or composed reached the shell.
    assert!(h.view(|v, cx| v.key_down(&key("backspace", None), cx)));
    let composed = h
        .window
        .update(&mut h.cx, |view, window, cx| {
            gpui::EntityInputHandler::replace_text_in_range(view, None, "é", window, cx)
        });
    composed.unwrap();
    assert_eq!(h.view(|v, _| v.find_query().to_string()), "needlé");
    assert!(h.sent().iter().all(|m| !matches!(m, ToCore::Input(_))), "the shell heard nothing");
    // Paste goes into the field too.
    clip.write_text_for_test("needle\nsecond line");
    assert!(h.view(|v, cx| v.key_down(&key("cmd-v", None), cx)));
    assert_eq!(h.view(|v, _| v.find_query().to_string()), "needléneedle");

    // No match, then escape: highlights gone, query kept, the next open starts selected.
    h.view(|v, cx| v.set_find_query("zzz", cx));
    while h.view(|v, cx| v.search_tick(cx)) == std::time::Duration::from_millis(33) {}
    assert_eq!(h.view(|v, _| v.find_label()), "No matches");
    assert!(h.view(|v, cx| v.key_down(&key("escape", None), cx)));
    assert!(!h.view(|v, _| v.find_open()));
    assert!(h.view(|v, _| v.frame().search).is_empty());
    assert!(h.sent().is_empty());
    h.view(|v, cx| v.open_find(cx));
    assert_eq!(h.view(|v, _| v.find_query().to_string()), "zzz");
    type_keys(&mut h, "x");
    assert_eq!(h.view(|v, _| v.find_query().to_string()), "x", "typing replaced the old query");
    // The bar is on screen at the top right.
    let shot = h.draw();
    assert!(shot.ink(88, 0, 10, rgb(0)) > 100, "the find bar is drawn");
}

/// Backgrounds, foregrounds, inverse and the cursor in each shape and focus.
fn colours_and_cursor(bg: [u8; 3], fg: [u8; 3]) {
    let mut h = Harness::open(900., 420.);
    // Row 0: ANSI backgrounds red, green, blue (two cells each) then a truecolour one.
    // Row 1: a truecolour foreground full block, an inverse blank, then plain text.
    h.attach(
        100,
        24,
        "\x1b[41m  \x1b[42m  \x1b[44m  \x1b[48;2;10;200;30m  \x1b[0m\r\n\
         \x1b[38;2;255;128;0m\u{2588}\u{2588}\x1b[0m\x1b[7m  \x1b[0mHello",
    );
    let shot = h.draw();
    let t = Theme::default();
    let hex = |c: perch_native::terminal::vt::Rgb| {
        rgb(u32::from(c.0) << 16 | u32::from(c.1) << 8 | u32::from(c.2))
    };
    assert!(
        near(shot.center(0, 0), hex(t.ansi[1])),
        "red background {:?}",
        shot.center(0, 0)
    );
    assert!(near(shot.center(1, 0), hex(t.ansi[1])));
    assert!(near(shot.center(2, 0), hex(t.ansi[2])), "green background");
    assert!(near(shot.center(4, 0), hex(t.ansi[4])), "blue background");
    assert!(
        near(shot.center(6, 0), [10, 200, 30]),
        "truecolour background"
    );
    assert!(
        near(shot.center(8, 0), bg),
        "default background past the runs"
    );
    // A full block is the foreground colour at its middle, over the default background.
    assert!(
        near(shot.center(0, 1), [255, 128, 0]),
        "truecolour foreground {:?}",
        shot.center(0, 1)
    );
    assert!(near(shot.center(1, 1), [255, 128, 0]));
    // Inverse paints the foreground colour as background.
    assert!(
        near(shot.center(2, 1), fg),
        "inverse blank {:?}",
        shot.center(2, 1)
    );
    // Text is ink in its own cells only.
    for (col, ch) in "Hello".chars().enumerate() {
        assert!(shot.ink(4 + col, 1, 1, bg) > 4, "ink for {ch:?}");
    }
    assert_eq!(
        shot.ink(10, 1, 1, bg),
        0,
        "nothing after the text and the cursor"
    );
    // The cursor sits after "Hello" at column 9; the pane is not focused, so it is an outline:
    // its edge is the cursor colour and its middle is not.
    let (x, y) = shot.cell_origin(9, 1);
    assert!(
        near(shot.at(x + 1.0 / shot.scale, y + shot.cell.1 / 2.0), fg),
        "hollow cursor edge"
    );
    assert!(near(shot.center(9, 1), bg), "hollow cursor is empty");

    // Focused, the cursor is a filled block over its cell.
    h.focus();
    let shot = h.draw();
    assert!(near(shot.center(9, 1), fg), "block cursor fills its cell");
    // The cell under a block cursor shows its glyph in the background colour: the 'H' of
    // "Hello" is the cell at column 4 of row 1.
    h.output("\x1b[2;5H");
    let shot = h.draw();
    assert!(
        shot.count(4, 1, 1, |p| near(p, fg)) > 20,
        "the block covers the cell"
    );
    assert!(
        shot.ink(4, 1, 1, fg) > 10,
        "the glyph under it is drawn in the background colour"
    );

    // Bar and underline shapes (focused), and a hidden cursor.
    h.output("\x1b[1;1H\x1b[6 q");
    let shot = h.draw();
    let (x, y) = shot.cell_origin(0, 0);
    assert!(
        near(shot.at(x + 0.5, y + shot.cell.1 / 2.0), fg),
        "bar at the left edge"
    );
    h.output("\x1b[4 q");
    let shot = h.draw();
    assert!(
        near(shot.at(x + shot.cell.0 / 2.0, y + shot.cell.1 - 0.75), fg),
        "underline cursor at the bottom"
    );
    h.output("\x1b[?25l");
    let shot = h.draw();
    assert!(
        differs(shot.at(x + shot.cell.0 / 2.0, y + shot.cell.1 - 0.75), fg),
        "hidden cursor is not drawn"
    );
}

/// Bold, italic, faint, underline and strikethrough.
fn attributes(bg: [u8; 3], fg: [u8; 3]) {
    let mut h = Harness::open(900., 420.);
    h.attach(
        100,
        24,
        "M\x1b[1mM\x1b[0m\x1b[3mM\x1b[0m\x1b[2mM\x1b[0m\r\n\
         \x1b[4m   \x1b[0m\r\n\x1b[9m   \x1b[0m\r\n   ",
    );
    let shot = h.draw();
    let plain = shot.ink(0, 0, 1, bg);
    let bold = shot.ink(1, 0, 1, bg);
    let italic = shot.ink(2, 0, 1, bg);
    assert!(plain > 10, "plain M has ink");
    assert!(bold > plain, "bold M has more ink ({bold} vs {plain})");
    assert_ne!(italic, plain, "italic M differs from upright");
    // Faint text is the foreground at 60 percent over the background: no pixel reaches full.
    let brightest = shot.count(3, 0, 1, |p| p[0] > 250);
    assert_eq!(brightest, 0, "faint text never reaches full brightness");
    assert!(shot.ink(3, 0, 1, bg) > 10);
    // An underline is a rule of the foreground colour, a cell wide, below the baseline.
    let rule = |row: usize| shot.count(0, row, 3, |p| near(p, fg));
    let (cell_pixels, _) = (shot.cell.0 * shot.scale, 0);
    assert!(
        rule(1) as f32 >= cell_pixels * 3.0 * 0.9,
        "underline spans three cells ({})",
        rule(1)
    );
    assert!(
        rule(2) as f32 >= cell_pixels * 3.0 * 0.9,
        "strikethrough spans three cells ({})",
        rule(2)
    );
    assert_eq!(rule(3), 0, "plain blanks draw nothing");
    // The strike is higher in the cell than the underline.
    let first_rule_row = |row: usize| {
        let (x, y) = shot.cell_origin(1, row);
        let mut dy = 0.0;
        while dy < shot.cell.1 {
            if near(shot.at(x + 2.0, y + dy), fg) {
                return dy;
            }
            dy += 1.0 / shot.scale;
        }
        panic!("no rule in row {row}");
    };
    assert!(
        first_rule_row(2) < first_rule_row(1),
        "strike above underline"
    );
}

/// CJK, emoji and a combining mark take their cells and are drawn, with fallback fonts.
fn wide_and_emoji(bg: [u8; 3]) {
    let mut h = Harness::open(900., 420.);
    h.attach(100, 24, "\u{4e16}\u{754c}ab\r\n\u{1f600}x\r\ne\u{301}z");
    let shot = h.draw();
    // Each CJK character is ink across its two cells; the next cell starts the next glyph.
    assert!(
        shot.ink(0, 0, 1, bg) > 10 && shot.ink(1, 0, 1, bg) > 10,
        "first wide character spans two cells"
    );
    assert!(
        shot.ink(2, 0, 1, bg) > 10 && shot.ink(3, 0, 1, bg) > 10,
        "second wide character spans two cells"
    );
    assert!(shot.ink(4, 0, 1, bg) > 4, "'a' follows in the fifth cell");
    // The emoji is coloured: it has pixels that are not grey, in its two cells.
    let coloured = shot.count(0, 1, 2, |p| {
        let (hi, lo) = (p.iter().max().unwrap(), p.iter().min().unwrap());
        hi - lo > 60
    });
    assert!(coloured > 20, "emoji is drawn in colour ({coloured})");
    assert!(
        shot.ink(2, 1, 1, bg) > 4,
        "'x' follows the emoji in the third cell"
    );
    // The accent shares the cell of its base letter, and 'z' keeps the second cell.
    assert!(shot.ink(0, 2, 1, bg) > 4);
    assert!(shot.ink(1, 2, 1, bg) > 4);
}

/// The owner fits the pane and asks for it once; a view that doesn't own the size takes the
/// core's and never asks.
fn resize_authority() {
    let mut h = Harness::open(900., 420.);
    h.attach(80, 24, "prompt$ ");
    // The replay's size marker set the grid; nothing has been laid out yet.
    assert_eq!(h.view(|v, _| v.grid_size()), (80, 24));
    let shot = h.draw();
    let fitted = h.view(|v, _| v.fitted_size()).unwrap();
    assert!(fitted.0 >= MIN_COLS && fitted.1 > 1);
    // The owner tells the core the size it fits, once, right after attaching.
    assert_eq!(h.sent(), vec![ToCore::Resize(fitted.0, fitted.1)]);
    h.draw();
    assert_eq!(h.sent(), vec![], "an unchanged pane asks nothing more");
    // The core applies it and announces it in the stream; the grid follows.
    h.output(&format!("\x1b[8;{};{}t", fitted.1, fitted.0));
    assert_eq!(h.view(|v, _| v.grid_size()), fitted);
    let _ = shot;
    // A smaller pane asks again, with a size the cell and pane explain.
    h.resize(700., 300.);
    h.draw();
    let smaller = h.view(|v, _| v.fitted_size()).unwrap();
    assert!(
        smaller.0 < fitted.0 && smaller.1 < fitted.1,
        "{smaller:?} vs {fitted:?}"
    );
    assert_eq!(h.sent(), vec![ToCore::Resize(smaller.0, smaller.1)]);
    // The pane's cells: width and height divide the padded pane exactly.
    let cell = h.view(|v, _| v.cell_size()).unwrap();
    let (cw, ch) = (f32::from(cell.width), f32::from(cell.height));
    assert_eq!(smaller.0, ((700. - 2. * PAD_X) / cw + 0.01).floor() as u16);
    assert_eq!(smaller.1, ((300. - 2. * PAD_Y) / ch + 0.01).floor() as u16);

    // A view that doesn't hold the resize lease never sends a size and takes the core's.
    let mut other = Harness::open(900., 420.);
    other.attach_as(true, false, 120, 40, "");
    other.draw();
    other.resize(700., 300.);
    other.draw();
    assert_eq!(
        other.sent(),
        vec![],
        "a view without the resize lease sends no size"
    );
    assert_eq!(other.view(|v, _| v.grid_size()), (120, 40));
    other.output("\x1b[8;50;90t");
    assert_eq!(other.view(|v, _| v.grid_size()), (90, 50));
    // It still draws what the program draws at that size.
    other.output("\x1b[1;1Hfar");
    let shot = other.draw();
    assert!(shot.ink(0, 0, 3, rgb(0x000000)) > 10);
}

/// Below 80 columns the font shrinks, down to a floor, instead of the grid.
fn narrow_panes_shrink_the_font() {
    let mut h = Harness::open(900., 420.);
    h.attach(80, 24, "");
    h.draw();
    let normal = h.view(|v, _| v.font_px()).unwrap();
    assert!(
        (normal - 13.0).abs() < 0.01,
        "a wide pane keeps the base size"
    );

    h.resize(560., 420.);
    h.draw();
    let (cols, _) = h.view(|v, _| v.fitted_size()).unwrap();
    let shrunk = h.view(|v, _| v.font_px()).unwrap();
    assert!(cols >= MIN_COLS, "{cols} columns in a narrow pane");
    assert!(
        shrunk < normal && shrunk >= MIN_FONT_PX,
        "font shrank to {shrunk}"
    );

    // Past the floor the grid gives way.
    h.resize(300., 420.);
    h.draw();
    let (cols, _) = h.view(|v, _| v.fitted_size()).unwrap();
    assert!(cols < MIN_COLS, "{cols} columns in a very narrow pane");
    assert!((h.view(|v, _| v.font_px()).unwrap() - MIN_FONT_PX).abs() < 0.01);
}

/// Keys, paste, the wheel and the mouse go to the program as the program asked.
fn input_and_scrolling() {
    let mut h = Harness::open(900., 420.);
    h.attach(100, 24, "");
    h.draw();
    h.sent();

    let typed =
        |h: &mut Harness, event: KeyDownEvent| -> bool { h.view(|v, cx| v.key_down(&event, cx)) };
    assert!(typed(&mut h, key("a", Some("a"))));
    assert!(typed(&mut h, key("enter", None)));
    assert!(typed(&mut h, key("ctrl-c", None)));
    assert!(typed(&mut h, key("up", None)));
    assert!(
        !typed(&mut h, key("cmd-c", None)),
        "command chords belong to the app"
    );
    assert!(
        !typed(&mut h, key("shift", None)),
        "a modifier alone sends nothing"
    );
    let sent: Vec<u8> = h
        .sent()
        .into_iter()
        .flat_map(|m| match m {
            ToCore::Input(b) => b,
            other => panic!("{other:?}"),
        })
        .collect();
    assert_eq!(sent, b"a\r\x03\x1b[A");

    // Bracketed paste only when the program asked.
    h.view(|v, cx| v.paste("one\ntwo", cx));
    assert_eq!(h.sent(), vec![ToCore::Input(b"one\rtwo".to_vec())]);
    h.output("\x1b[?2004h");
    h.view(|v, cx| v.paste("one\ntwo", cx));
    assert_eq!(
        h.sent(),
        vec![ToCore::Input(b"\x1b[200~one\ntwo\x1b[201~".to_vec())]
    );

    // Kitty keyboard flags the program set.
    h.output("\x1b[>1u");
    typed(&mut h, key("escape", None));
    assert_eq!(h.sent(), vec![ToCore::Input(b"\x1b[27u".to_vec())]);
    h.output("\x1b[<u");

    // The wheel scrolls history on the primary screen; typing returns to the bottom.
    for line in 0..80 {
        h.output(&format!("history {line}\r\n"));
    }
    h.draw();
    let bottom = h.view(|v, _| v.frame().row_text(0));
    h.view(|v, cx| v.scroll_wheel(&wheel(2.0), cx));
    let scrolled = h.view(|v, _| v.frame().row_text(0));
    assert_ne!(scrolled, bottom);
    let old: usize = scrolled.trim_start_matches("history ").parse().unwrap();
    let live: usize = bottom.trim_start_matches("history ").parse().unwrap();
    assert!(old < live, "scrolled back from {live} to {old}");
    assert_eq!(h.sent(), vec![], "scrolling history sends nothing");
    h.view(|v, cx| v.scroll_wheel(&wheel(-1.0), cx));
    assert!(
        h.view(|v, _| v.frame().row_text(0)) != scrolled,
        "the wheel turns both ways"
    );
    assert!(typed(&mut h, key("a", Some("a"))));
    assert_eq!(
        h.view(|v, _| v.frame().row_text(0)),
        bottom,
        "typing returns to the live screen"
    );
    h.sent();

    // On the alternate screen without the mouse the wheel types arrow keys.
    h.output("\x1b[?1049h");
    h.view(|v, cx| v.scroll_wheel(&wheel(1.0), cx));
    let arrows = h.sent();
    assert_eq!(arrows.len(), 1);
    assert!(matches!(&arrows[0], ToCore::Input(b) if b.starts_with(b"\x1b[A") && b.len() % 3 == 0));
    // With the mouse on, the program gets wheel buttons at the pointer.
    h.output("\x1b[?1000h\x1b[?1006h");
    h.draw();
    h.view(|v, cx| v.scroll_wheel(&wheel(1.0), cx));
    let reports = h.sent();
    assert!(
        matches!(&reports[0], ToCore::Input(b) if b.starts_with(b"\x1b[<64;")),
        "{reports:?}"
    );

    // Clicks reach a program that takes the mouse; shift keeps them.
    let down = h.view(|v, _| {
        v.mouse(
            perch_native::terminal::vt::MouseAction::Press,
            Some(gpui::MouseButton::Left),
            point(px(PAD_X + 20.), px(PAD_Y + 20.)),
            Modifiers::default(),
        )
    });
    assert!(down);
    let sent = h.sent();
    assert!(
        matches!(&sent[0], ToCore::Input(b) if b.starts_with(b"\x1b[<0;") && b.ends_with(b"M")),
        "{sent:?}"
    );
    let up = h.view(|v, _| {
        v.mouse(
            perch_native::terminal::vt::MouseAction::Release,
            Some(gpui::MouseButton::Left),
            point(px(PAD_X + 20.), px(PAD_Y + 20.)),
            Modifiers::default(),
        )
    });
    assert!(up);
    assert!(matches!(&h.sent()[0], ToCore::Input(b) if b.ends_with(b"m")));
    let shifted = h.view(|v, _| {
        v.mouse(
            perch_native::terminal::vt::MouseAction::Press,
            Some(gpui::MouseButton::Left),
            point(px(30.), px(30.)),
            Modifiers::shift(),
        )
    });
    assert!(!shifted, "shift keeps the mouse for the terminal");
    assert_eq!(h.sent(), vec![]);

    // Without the input lease nothing is typed.
    let mut watcher = Harness::open(900., 420.);
    watcher.attach_as(false, false, 80, 24, "watching");
    watcher.draw();
    assert!(!watcher.view(|v, cx| v.key_down(&key("a", Some("a")), cx)));
    watcher.view(|v, cx| v.paste("x", cx));
    assert_eq!(watcher.sent(), vec![]);
    // The key encoder is not involved at all for a key that types nothing.
    let mut vt = perch_native::terminal::vt::Vt::new(80, 24);
    assert_eq!(
        key_bytes(&mut vt, &Keystroke::parse("cmd-q").unwrap(), false),
        None
    );
}

/// Picking a session gives the main area a terminal for it, only when there is a core to
/// find; picking the same one again keeps it, another replaces it.
fn workspace_attaches_the_open_session() {
    use perch_native::sidebar::Model;
    use perch_native::ui::Workspace;

    let mut cx = HeadlessAppContext::with_platform(
        gpui_platform::current_platform(true).text_system(),
        Arc::new(()),
        gpui_platform::current_headless_renderer,
    );
    let pick = |cx: &mut HeadlessAppContext, window: WindowHandle<Workspace>, id: &str| {
        window
            .update(cx, |workspace, _, cx| {
                workspace.sidebar().update(cx, |sidebar, cx| {
                    sidebar.open("local".into(), id.into(), Some("terminal".into()), cx)
                })
            })
            .unwrap();
        cx.run_until_parked();
        window
            .update(cx, |workspace, _, _| workspace.terminal().cloned())
            .unwrap()
    };

    // No core to attach to: the main area keeps its quiet title and makes no terminal.
    let bare = cx
        .open_window(size(px(640.), px(360.)), |_, cx| {
            cx.new(|cx| Workspace::new(Model::default(), None, cx))
        })
        .unwrap();
    assert!(pick(&mut cx, bare, "alpha").is_none());

    // A core that cannot be found shows as a failed terminal, not as nothing.
    let lost = cx
        .open_window(size(px(640.), px(360.)), |_, cx| {
            cx.new(|cx| {
                Workspace::new(Model::default(), None, cx)
                    .with_core(|| Err(anyhow::anyhow!("no core is running")))
            })
        })
        .unwrap();
    let first = pick(&mut cx, lost, "alpha").expect("a terminal for the session");
    let status = first.read_with(&cx, |view, _| view.status().clone());
    assert!(
        matches!(&status, Status::Failed(reason) if reason.contains("no core is running")),
        "{status:?}"
    );
    assert_eq!(pick(&mut cx, lost, "alpha").unwrap(), first, "same session");
    assert_ne!(
        pick(&mut cx, lost, "beta").unwrap(),
        first,
        "another session"
    );
}

/// A dropped connection leaves the screen as it was and says so; it is not an exit.
fn disconnect_keeps_the_screen() {
    let mut h = Harness::open(900., 420.);
    let events = std::rc::Rc::new(std::cell::RefCell::new(Vec::new()));
    let seen = events.clone();
    let subscription = h
        .window
        .update(&mut h.cx, |_, _, cx| {
            let view = cx.entity();
            cx.subscribe(&view, move |_, _, event: &TerminalEvent, _| {
                seen.borrow_mut().push(event.clone())
            })
        })
        .unwrap();
    h.attach(80, 24, "\x1b]2;the title\x07still here\r\n");
    h.draw();
    let before = h.view(|v, _| v.frame().row_text(0));
    assert_eq!(before, "still here");
    assert_eq!(h.view(|v, _| v.title().to_string()), "the title");
    h.say(FromCore::Disconnected(
        "the core closed the connection".into(),
    ));
    assert!(matches!(
        h.view(|v, _| v.status().clone()),
        Status::Disconnected(_)
    ));
    assert_eq!(
        h.view(|v, _| v.frame().row_text(0)),
        before,
        "the screen is kept"
    );
    let shot = h.draw();
    assert!(shot.ink(0, 0, 10, rgb(0x000000)) > 20, "and still drawn");
    assert!(
        !h.view(|v, cx| v.key_down(&key("a", Some("a")), cx)),
        "nothing is typed into a dropped terminal"
    );
    assert_eq!(
        h.sent()
            .iter()
            .filter(|m| matches!(m, ToCore::Input(_)))
            .count(),
        0
    );
    // Only the core saying so marks the shell as ended.
    h.say(FromCore::Exited(3));
    assert_eq!(h.view(|v, _| v.status().clone()), Status::Exited(3));
    let events = events.borrow();
    assert!(events.contains(&TerminalEvent::Title("the title".into())));
    assert!(events
        .iter()
        .any(|e| matches!(e, TerminalEvent::Status(Status::Disconnected(_)))));
    drop(subscription);
}
