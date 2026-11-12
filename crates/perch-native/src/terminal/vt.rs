// The frame read (`Vt::frame` and `read_cell`), the render-hold and OSC 52
// callbacks, and the key and mouse encoder calls below follow `src/vt.rs` of
// herdr (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch:
// no theme file, search, links, selection or kitty graphics; the paste encoder,
// replay muting and the scroll-position reads are Perch's own. See
// THIRD_PARTY_NOTICES.md.

//! A client-side terminal on libghostty-vt: fed the bytes a session's shell wrote, read back
//! as the frame to draw, and asked to encode what the person types, clicks and pastes for the
//! program, in whatever keyboard and mouse modes it has asked for.
//!
//! The server keeps its own emulator (`perchd::screen`) to repaint an attach; this one is the
//! view's. Both turn grapheme clustering (mode 2027) on only when the program asks, so their
//! width rules, and therefore where a row wraps, agree.
//!
//! Everything here is a read of, or a write to, native handles that are not thread-safe, so a
//! [`Vt`] is neither `Send` nor `Sync`: one thread owns it.

use ghostty_sys as g;
use std::ffi::c_void;
use std::ptr;
use std::time::{Duration, Instant};

/// Scrollback kept per terminal: whichever of these Ghostty reaches first. Ghostty prunes whole
/// pages, so the retained history can run a page past the line limit.
pub const SCROLLBACK_LINES: usize = 10_000;
pub const SCROLLBACK_BYTES: usize = 10 * 1024 * 1024;

/// An OSC 52 payload larger than this is ignored.
const MAX_CLIPBOARD_BYTES: usize = 1 << 20;
/// A synchronised-output frame the program never ends is shown after this long.
const MAX_HOLD: Duration = Duration::from_millis(1000);

const BRACKETED_PASTE: g::GhosttyMode = 2004;
const SYNC_OUTPUT: g::GhosttyMode = 2026;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Rgb(pub u8, pub u8, pub u8);

impl From<g::GhosttyColorRgb> for Rgb {
    fn from(c: g::GhosttyColorRgb) -> Self {
        Rgb(c.r, c.g, c.b)
    }
}

impl From<Rgb> for g::GhosttyColorRgb {
    fn from(c: Rgb) -> Self {
        g::GhosttyColorRgb {
            r: c.0,
            g: c.1,
            b: c.2,
        }
    }
}

/// The colours a program's default and ANSI colours resolve to. The default is xterm.js's, which
/// is what the web terminal shows when the computer has no terminal profile to read.
#[derive(Clone, PartialEq, Debug)]
pub struct Theme {
    pub fg: Rgb,
    pub bg: Rgb,
    pub cursor: Rgb,
    /// The glyph under a block cursor; the background when the profile names none.
    pub cursor_text: Option<Rgb>,
    /// Selected cells' background; the foreground mixed 30 percent into the background when the
    /// profile names none, as xterm.js does.
    pub selection_bg: Option<Rgb>,
    /// Selected cells' text; their own colour when the profile names none.
    pub selection_fg: Option<Rgb>,
    pub ansi: [Rgb; 16],
    /// 1 leaves a program's colours alone; above it, text is pushed toward black or white until
    /// it reaches this contrast ratio against its background (1 to 21).
    pub minimum_contrast: f32,
}

impl Theme {
    fn selection_background(&self) -> Rgb {
        self.selection_bg
            .unwrap_or_else(|| mix(self.bg, self.fg, 0.3))
    }
}

/// `a` with `amount` of `b` mixed in.
fn mix(a: Rgb, b: Rgb, amount: f32) -> Rgb {
    let m = |a: u8, b: u8| (f32::from(a) + (f32::from(b) - f32::from(a)) * amount).round() as u8;
    Rgb(m(a.0, b.0), m(a.1, b.1), m(a.2, b.2))
}

/// WCAG relative luminance.
fn luminance(c: Rgb) -> f32 {
    let lin = |v: u8| {
        let v = f32::from(v) / 255.0;
        if v <= 0.04045 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * lin(c.0) + 0.7152 * lin(c.1) + 0.0722 * lin(c.2)
}

/// WCAG contrast ratio, 1 to 21.
pub fn contrast(a: Rgb, b: Rgb) -> f32 {
    let (la, lb) = (luminance(a), luminance(b));
    (la.max(lb) + 0.05) / (la.min(lb) + 0.05)
}

/// `fg`, or near-white or near-black when it would vanish into `bg`.
fn readable(fg: Rgb, bg: Rgb, minimum: f32) -> Rgb {
    if minimum <= 1.0 || contrast(fg, bg) >= minimum {
        return fg;
    }
    let (light, dark) = (Rgb(0xf2, 0xf2, 0xf4), Rgb(0x1b, 0x1b, 0x1e));
    if contrast(light, bg) >= contrast(dark, bg) {
        light
    } else {
        dark
    }
}

/// Glyphs drawn as shapes keep the colours the program gave them under minimum contrast: box
/// drawing, block elements, Powerline separators and the legacy computing blocks.
fn keeps_program_colour(text: &str) -> bool {
    text.chars().next().is_some_and(|c| {
        matches!(c as u32, 0x2500..=0x259f | 0xe0b0..=0xe0d7 | 0x1fb00..=0x1fbff | 0x1cc00..=0x1cebf)
    })
}

impl Default for Theme {
    fn default() -> Self {
        let hex = |v: u32| Rgb((v >> 16) as u8, (v >> 8) as u8, v as u8);
        Self {
            fg: hex(0xffffff),
            bg: hex(0x000000),
            cursor: hex(0xffffff),
            cursor_text: None,
            selection_bg: None,
            selection_fg: None,
            minimum_contrast: 1.0,
            ansi: [
                0x2e3436, 0xcc0000, 0x4e9a06, 0xc4a000, 0x3465a4, 0x75507b, 0x06989a, 0xd3d7cf,
                0x555753, 0xef2929, 0x8ae234, 0xfce94f, 0x729fcf, 0xad7fa8, 0x34e2e2, 0xeeeeec,
            ]
            .map(hex),
        }
    }
}

/// One screen cell, colours resolved (inverse already applied).
#[derive(Clone, Default, PartialEq, Debug)]
pub struct Cell {
    /// The whole grapheme cluster. Empty for a blank cell, the tail half of a wide character and
    /// hidden (SGR 8) text.
    pub text: String,
    pub fg: Rgb,
    /// `None`: the terminal's default background.
    pub bg: Option<Rgb>,
    pub bold: bool,
    pub italic: bool,
    pub faint: bool,
    pub underline: bool,
    /// How the underline is drawn, when there is one.
    pub underline_style: Underline,
    /// The underline's own colour (SGR 58); the text's when `None`.
    pub underline_color: Option<Rgb>,
    pub strike: bool,
    /// The head of a two-cell character; the next cell is its tail.
    pub wide: bool,
    /// The cell is part of the selection; `bg` and `fg` already show it.
    pub selected: bool,
}

#[derive(Clone, Copy, Default, PartialEq, Eq, Debug)]
pub enum Underline {
    #[default]
    None,
    Single,
    Double,
    Curly,
    Dotted,
    Dashed,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CursorShape {
    Block,
    Bar,
    Underline,
    Hollow,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Cursor {
    pub x: u16,
    pub y: u16,
    pub shape: CursorShape,
    pub color: Rgb,
    /// The glyph under a block cursor is drawn in this colour.
    pub text: Rgb,
    /// The cursor is on a two-cell character and covers both cells.
    pub wide: bool,
    /// The program asked for a blinking cursor (DECSCUSR 0, 1, 3, 5).
    pub blink: bool,
}

/// The visible rows, read once.
#[derive(Clone, Debug)]
pub struct Frame {
    pub rows: Vec<Vec<Cell>>,
    /// Where to draw the cursor; `None` when the program hid it or it is scrolled out of view.
    pub cursor: Option<Cursor>,
    /// The cursor's cell even when hidden: where an input method puts its candidate window.
    pub cursor_cell: Option<(u16, u16)>,
    pub fg: Rgb,
    pub bg: Rgb,
    /// Matches of the search in these rows.
    pub search: Vec<super::search::Span>,
}

impl Frame {
    /// A row's text, a blank cell as a space and trailing blanks dropped.
    pub fn row_text(&self, y: usize) -> String {
        let mut text = String::new();
        let mut tail = false;
        for cell in self.rows.get(y).into_iter().flatten() {
            // The second half of a wide character has no text of its own.
            if !tail {
                text.push_str(if cell.text.is_empty() {
                    " "
                } else {
                    &cell.text
                });
            }
            tail = cell.wide;
        }
        text.truncate(text.trim_end().len());
        text
    }
}

/// Where the viewport is in the scrollable area, in rows.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Scrollbar {
    pub total: u64,
    /// Rows above the viewport.
    pub offset: u64,
    /// Rows the viewport shows.
    pub len: u64,
}

impl Scrollbar {
    pub fn at_bottom(&self) -> bool {
        self.offset + self.len >= self.total
    }
}

/// Something the program did that the view, not the screen, answers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Event {
    /// A new window title (OSC 0 or 2).
    Title(String),
    /// The program asks to set the system clipboard (OSC 52 write, UTF-8 text). Nothing here
    /// writes the clipboard: the view decides whether this one may.
    ClipboardWrite(String),
}

/// What a key press is, to the encoder.
#[derive(Clone, Copy, Debug)]
pub struct KeyInput<'a> {
    pub key: g::GhosttyKey,
    pub mods: g::GhosttyMods,
    /// The modifiers that went into making `text` (Shift for ":"), which kitty's protocol must
    /// not report again.
    pub consumed: g::GhosttyMods,
    /// The text the key types, if it types any.
    pub text: Option<&'a str>,
    /// The key's character with no modifier applied.
    pub unshifted: Option<char>,
    pub repeat: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MouseAction {
    Press,
    Release,
    Motion,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MouseButton {
    Left,
    Middle,
    Right,
    WheelUp,
    WheelDown,
    WheelLeft,
    WheelRight,
}

impl MouseButton {
    fn raw(self) -> g::GhosttyMouseButton {
        match self {
            Self::Left => g::GHOSTTY_MOUSE_BUTTON_LEFT,
            Self::Middle => g::GHOSTTY_MOUSE_BUTTON_MIDDLE,
            Self::Right => g::GHOSTTY_MOUSE_BUTTON_RIGHT,
            Self::WheelUp => g::GHOSTTY_MOUSE_BUTTON_FOUR,
            Self::WheelDown => g::GHOSTTY_MOUSE_BUTTON_FIVE,
            Self::WheelLeft => g::GHOSTTY_MOUSE_BUTTON_SIX,
            Self::WheelRight => g::GHOSTTY_MOUSE_BUTTON_SEVEN,
        }
    }
}

/// A mouse event, positioned in device pixels from the grid's top left corner.
#[derive(Clone, Copy, Debug)]
pub struct MouseInput {
    pub action: MouseAction,
    pub button: Option<MouseButton>,
    pub mods: g::GhosttyMods,
    pub x: f32,
    pub y: f32,
    /// A button is held down (another one, for a press).
    pub any_pressed: bool,
    /// A cell in device pixels.
    pub cell: (f32, f32),
}

/// Holds what the terminal's callbacks write into; boxed so its address is stable.
struct Shared {
    state: g::GhosttyRenderState,
    size: g::GhosttySizeReportSize,
    held_since: Option<Instant>,
    title_changed: bool,
    /// Replies the terminal writes back to the program (device attributes, cursor position).
    replies: Vec<u8>,
    /// The last OSC 52 write since the events were taken.
    clipboard: Option<String>,
}

unsafe extern "C" fn on_write_pty(
    _t: g::GhosttyTerminal,
    userdata: *mut c_void,
    data: *const u8,
    len: usize,
) {
    // SAFETY: userdata is the boxed `Shared` registered in `Vt::new`, alive as long as the terminal.
    let shared = unsafe { &mut *(userdata as *mut Shared) };
    if !data.is_null() && len > 0 {
        // SAFETY: Ghostty hands over `len` readable bytes for the duration of the call.
        shared
            .replies
            .extend_from_slice(unsafe { std::slice::from_raw_parts(data, len) });
    }
}

unsafe extern "C" fn on_clipboard_write(
    _t: g::GhosttyTerminal,
    userdata: *mut c_void,
    request: *const g::GhosttyClipboardWrite,
) {
    // SAFETY: as in `on_write_pty`; the request is borrowed for this call.
    let shared = unsafe { &mut *(userdata as *mut Shared) };
    let request = unsafe { &*request };
    if request.size < std::mem::size_of::<g::GhosttyClipboardWrite>()
        || request.location != g::GHOSTTY_CLIPBOARD_LOCATION_STANDARD
    {
        return;
    }
    let text = if request.contents_len == 0 {
        ""
    } else {
        if request.contents_len != 1 || request.contents.is_null() {
            return;
        }
        // SAFETY: one content entry, checked non-null above.
        let content = unsafe { &*request.contents };
        if content.mime.ptr.is_null() || content.data.len > MAX_CLIPBOARD_BYTES {
            return;
        }
        let mime = unsafe { std::slice::from_raw_parts(content.mime.ptr, content.mime.len) };
        if mime != b"text/plain" {
            return;
        }
        let bytes = if content.data.len == 0 {
            &[][..]
        } else if content.data.ptr.is_null() {
            return;
        } else {
            unsafe { std::slice::from_raw_parts(content.data.ptr, content.data.len) }
        };
        let Ok(text) = std::str::from_utf8(bytes) else {
            return;
        };
        text
    };
    // Only the last write of a batch matters, which also bounds a flood.
    shared.clipboard = Some(text.to_owned());
    if let Some(reply) = request.reply {
        let result = g::GhosttyClipboardWriteReply {
            size: std::mem::size_of::<g::GhosttyClipboardWriteReply>(),
            result: g::GHOSTTY_CLIPBOARD_WRITE_RESULT_SUCCESS,
            remember: false,
        };
        // SAFETY: the reply function belongs to this request.
        unsafe { reply(request, &result) };
    }
}

unsafe extern "C" fn on_render_hold(_t: g::GhosttyTerminal, userdata: *mut c_void, held: bool) {
    // SAFETY: as in `on_write_pty`.
    let shared = unsafe { &mut *(userdata as *mut Shared) };
    if held {
        // Capture the finished frame the program wants on screen before it redraws.
        unsafe { g::ghostty_render_state_update(shared.state, _t) };
        shared.held_since = Some(Instant::now());
    } else {
        shared.held_since = None;
    }
}

unsafe extern "C" fn on_size(
    _t: g::GhosttyTerminal,
    userdata: *mut c_void,
    out: *mut g::GhosttySizeReportSize,
) -> bool {
    // SAFETY: as in `on_write_pty`; `out` is a valid out-pointer.
    let shared = unsafe { &*(userdata as *const Shared) };
    if shared.size.cell_width == 0 || shared.size.cell_height == 0 {
        return false;
    }
    unsafe { *out = shared.size };
    true
}

unsafe extern "C" fn on_title(_t: g::GhosttyTerminal, userdata: *mut c_void) {
    // SAFETY: as in `on_write_pty`.
    let shared = unsafe { &mut *(userdata as *mut Shared) };
    shared.title_changed = true;
}

pub struct Vt {
    term: g::GhosttyTerminal,
    shared: Box<Shared>,
    rows_it: g::GhosttyRenderStateRowIterator,
    cells: g::GhosttyRenderStateRowCells,
    keys: g::GhosttyKeyEncoder,
    key_event: g::GhosttyKeyEvent,
    mouse: g::GhosttyMouseEncoder,
    mouse_event: g::GhosttyMouseEvent,
    last_mouse_report: Vec<u8>,
    pub(super) gesture: super::select::Gesture,
    pub(super) search: super::search::State,
    cols: u16,
    rows: u16,
    theme: Theme,
    /// Replies and clipboard writes are dropped while a replay is fed: they answer queries and
    /// requests the program made long ago.
    replaying: bool,
}

fn ok(result: g::GhosttyResult, what: &str) {
    assert!(
        result == g::GHOSTTY_SUCCESS,
        "libghostty-vt {what} failed: {result}"
    );
}

impl Vt {
    pub fn new(cols: u16, rows: u16) -> Vt {
        let (cols, rows) = (cols.max(1), rows.max(1));
        // SAFETY: every handle is created through its own constructor, checked, and freed once
        // in `Drop`; options take the pointer types their keys document.
        unsafe {
            let mut term = ptr::null_mut();
            ok(
                g::ghostty_terminal_new(ptr::null(), &mut term, cols, rows),
                "terminal_new",
            );
            let mut state = ptr::null_mut();
            ok(
                g::ghostty_render_state_new(ptr::null(), &mut state),
                "render_state_new",
            );
            let mut rows_it = ptr::null_mut();
            ok(
                g::ghostty_render_state_row_iterator_new(ptr::null(), &mut rows_it),
                "row_iterator_new",
            );
            let mut cells = ptr::null_mut();
            ok(
                g::ghostty_render_state_row_cells_new(ptr::null(), &mut cells),
                "row_cells_new",
            );
            let mut keys = ptr::null_mut();
            ok(
                g::ghostty_key_encoder_new(ptr::null(), &mut keys),
                "key_encoder_new",
            );
            let mut key_event = ptr::null_mut();
            ok(
                g::ghostty_key_event_new(ptr::null(), &mut key_event),
                "key_event_new",
            );
            let mut mouse = ptr::null_mut();
            ok(
                g::ghostty_mouse_encoder_new(ptr::null(), &mut mouse),
                "mouse_encoder_new",
            );
            let mut mouse_event = ptr::null_mut();
            ok(
                g::ghostty_mouse_event_new(ptr::null(), &mut mouse_event),
                "mouse_event_new",
            );
            let mut shared = Box::new(Shared {
                state,
                size: g::GhosttySizeReportSize {
                    rows,
                    columns: cols,
                    cell_width: 0,
                    cell_height: 0,
                },
                held_since: None,
                title_changed: false,
                replies: Vec::new(),
                clipboard: None,
            });
            let set = |option, value: *const c_void| g::ghostty_terminal_set(term, option, value);
            set(
                g::GHOSTTY_TERMINAL_OPT_USERDATA,
                &mut *shared as *mut Shared as *const c_void,
            );
            let hold: g::GhosttyTerminalRenderHoldFn = Some(on_render_hold);
            set(g::GHOSTTY_TERMINAL_OPT_RENDER_HOLD, hold_ptr(hold));
            let title: g::GhosttyTerminalTitleChangedFn = Some(on_title);
            set(g::GHOSTTY_TERMINAL_OPT_TITLE_CHANGED, hold_ptr(title));
            let size: g::GhosttyTerminalSizeFn = Some(on_size);
            set(g::GHOSTTY_TERMINAL_OPT_SIZE, hold_ptr(size));
            let write: g::GhosttyTerminalWritePtyFn = Some(on_write_pty);
            set(g::GHOSTTY_TERMINAL_OPT_WRITE_PTY, hold_ptr(write));
            let clipboard: g::GhosttyTerminalClipboardWriteFn = Some(on_clipboard_write);
            set(g::GHOSTTY_TERMINAL_OPT_CLIPBOARD_WRITE, hold_ptr(clipboard));
            // No read callback: a program can never read the local clipboard.
            set(
                g::GHOSTTY_TERMINAL_OPT_CLIPBOARD_WRITE_MAX_BYTES,
                &MAX_CLIPBOARD_BYTES as *const usize as *const c_void,
            );
            set(
                g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_LINES,
                &SCROLLBACK_LINES as *const usize as *const c_void,
            );
            set(
                g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_BYTES,
                &SCROLLBACK_BYTES as *const usize as *const c_void,
            );
            // Images the program sends are kept, up to a cap, so the view can draw them.
            super::graphics::install_png_decoder();
            set(
                g::GHOSTTY_TERMINAL_OPT_KITTY_IMAGE_STORAGE_LIMIT,
                &super::graphics::STORAGE_LIMIT as *const u64 as *const c_void,
            );
            let mut vt = Vt {
                term,
                shared,
                rows_it,
                cells,
                keys,
                key_event,
                mouse,
                mouse_event,
                last_mouse_report: Vec::new(),
                gesture: super::select::Gesture::new(),
                search: Default::default(),
                cols,
                rows,
                theme: Theme::default(),
                replaying: false,
            };
            vt.apply_theme();
            vt
        }
    }

    pub(super) fn term(&self) -> g::GhosttyTerminal {
        self.term
    }

    pub fn size(&self) -> (u16, u16) {
        (self.cols, self.rows)
    }

    /// The colour behind cells that have none of their own.
    pub fn background(&self) -> Rgb {
        self.theme.bg
    }

    /// Lines of history kept (Ghostty still caps the bytes too).
    pub fn set_scrollback_lines(&mut self, lines: usize) {
        // SAFETY: the option takes a usize.
        unsafe {
            g::ghostty_terminal_set(
                self.term,
                g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_LINES,
                (&lines as *const usize).cast(),
            );
        }
    }

    /// The cursor shape and blink a program that has not chosen its own gets (DECSCUSR 0).
    pub fn set_default_cursor(&mut self, shape: CursorShape, blink: bool) {
        let style: g::GhosttyTerminalCursorStyle = match shape {
            CursorShape::Bar => g::GHOSTTY_TERMINAL_CURSOR_STYLE_BAR,
            CursorShape::Underline => g::GHOSTTY_TERMINAL_CURSOR_STYLE_UNDERLINE,
            _ => g::GHOSTTY_TERMINAL_CURSOR_STYLE_BLOCK,
        };
        // SAFETY: the options take a cursor style and a bool.
        unsafe {
            g::ghostty_terminal_set(
                self.term,
                g::GHOSTTY_TERMINAL_OPT_DEFAULT_CURSOR_STYLE,
                (&style as *const g::GhosttyTerminalCursorStyle).cast(),
            );
            g::ghostty_terminal_set(
                self.term,
                g::GHOSTTY_TERMINAL_OPT_DEFAULT_CURSOR_BLINK,
                (&blink as *const bool).cast(),
            );
        }
        // Becomes the cursor now, unless the program has picked its own since.
        self.write(b"\x1b[0 q");
    }

    pub fn set_theme(&mut self, theme: Theme) {
        if self.theme != theme {
            self.theme = theme;
            self.apply_theme();
        }
    }

    fn apply_theme(&mut self) {
        let t = &self.theme;
        // The built-in 256-colour palette, with the theme's sixteen over the first entries.
        let mut palette = [g::GhosttyColorRgb::default(); 256];
        // SAFETY: the palette key reads and writes 256 colours.
        unsafe {
            g::ghostty_terminal_get(
                self.term,
                g::GHOSTTY_TERMINAL_DATA_COLOR_PALETTE_DEFAULT,
                palette.as_mut_ptr().cast(),
            );
        }
        for (slot, color) in palette.iter_mut().zip(t.ansi) {
            *slot = color.into();
        }
        let (fg, bg, cursor): (g::GhosttyColorRgb, g::GhosttyColorRgb, g::GhosttyColorRgb) =
            (t.fg.into(), t.bg.into(), t.cursor.into());
        // SAFETY: colour options take a GhosttyColorRgb, the palette 256 of them.
        unsafe {
            for (option, value) in [
                (g::GHOSTTY_TERMINAL_OPT_COLOR_FOREGROUND, &fg),
                (g::GHOSTTY_TERMINAL_OPT_COLOR_BACKGROUND, &bg),
                (g::GHOSTTY_TERMINAL_OPT_COLOR_CURSOR, &cursor),
            ] {
                g::ghostty_terminal_set(
                    self.term,
                    option,
                    (value as *const g::GhosttyColorRgb).cast(),
                );
            }
            g::ghostty_terminal_set(
                self.term,
                g::GHOSTTY_TERMINAL_OPT_COLOR_PALETTE,
                palette.as_ptr().cast(),
            );
        }
    }

    /// Feed the shell's output. Replies the program's queries get, and its clipboard requests,
    /// are collected for [`Self::take_replies`] and [`Self::take_events`].
    pub fn write(&mut self, bytes: &[u8]) {
        // SAFETY: ptr/len describe `bytes`; Ghostty copies what it keeps.
        unsafe { g::ghostty_terminal_vt_write(self.term, bytes.as_ptr(), bytes.len()) };
        self.feed_search();
        if self.replaying {
            self.shared.replies.clear();
            self.shared.clipboard = None;
        }
    }

    /// Whether what is written is a replay of the past (the attach repaint). Its queries are
    /// answered by nobody, and its clipboard writes happened already.
    pub fn set_replaying(&mut self, replaying: bool) {
        self.replaying = replaying;
    }

    /// Resize the grid, reflowing the screen and its history. `cell` is a cell in device
    /// pixels, for the terminal size reports a program may ask for.
    pub fn resize(&mut self, cols: u16, rows: u16, cell: (u32, u32)) {
        if cols == 0 || rows == 0 {
            return;
        }
        let (cell_w, cell_h) = (cell.0.max(1), cell.1.max(1));
        self.shared.size = g::GhosttySizeReportSize {
            rows,
            columns: cols,
            cell_width: cell_w,
            cell_height: cell_h,
        };
        // SAFETY: plain call on the owned handle.
        let done = unsafe { g::ghostty_terminal_resize(self.term, cols, rows, cell_w, cell_h) };
        if done == g::GHOSTTY_SUCCESS {
            (self.cols, self.rows) = (cols, rows);
        }
    }

    /// What the program asked of the view since the last call.
    pub fn take_events(&mut self) -> Vec<Event> {
        let mut events = Vec::new();
        if std::mem::take(&mut self.shared.title_changed) {
            events.push(Event::Title(self.title()));
        }
        if let Some(text) = self.shared.clipboard.take() {
            events.push(Event::ClipboardWrite(text));
        }
        events
    }

    /// What the terminal says back to the program (answers to its queries) since the last call.
    pub fn take_replies(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.shared.replies)
    }

    pub fn title(&self) -> String {
        let mut s = g::GhosttyString::default();
        // SAFETY: the title key writes a GhosttyString borrowed from the terminal; copied here.
        let ok = unsafe {
            g::ghostty_terminal_get(
                self.term,
                g::GHOSTTY_TERMINAL_DATA_TITLE,
                (&mut s as *mut g::GhosttyString).cast(),
            )
        };
        if ok != g::GHOSTTY_SUCCESS || s.ptr.is_null() {
            return String::new();
        }
        // SAFETY: ptr/len describe the borrowed title.
        String::from_utf8_lossy(unsafe { std::slice::from_raw_parts(s.ptr, s.len) }).into_owned()
    }

    fn get<T: Default>(&self, data: g::GhosttyTerminalData) -> Option<T> {
        let mut out = T::default();
        // SAFETY: every key used here writes a `T` of the type the call site names.
        let ok = unsafe { g::ghostty_terminal_get(self.term, data, (&mut out as *mut T).cast()) };
        (ok == g::GHOSTTY_SUCCESS).then_some(out)
    }

    /// The kitty keyboard flags the program set on the active screen.
    pub fn kitty_keyboard_flags(&self) -> u8 {
        self.get(g::GHOSTTY_TERMINAL_DATA_KITTY_KEYBOARD_FLAGS)
            .unwrap_or(0)
    }

    /// Whether DEC private mode `number` is set (1 application cursor keys, 2004 bracketed
    /// paste, 1004 focus events...).
    pub fn dec_mode(&self, number: u16) -> bool {
        let mut config = g::GhosttyTerminalModeConfig {
            mode: number & 0x7fff,
            value: false,
        };
        // SAFETY: the mode key reads and writes a GhosttyTerminalModeConfig.
        let ok = unsafe {
            g::ghostty_terminal_get(
                self.term,
                g::GHOSTTY_TERMINAL_DATA_MODE,
                (&mut config as *mut g::GhosttyTerminalModeConfig).cast(),
            )
        };
        ok == g::GHOSTTY_SUCCESS && config.value
    }

    /// The program takes the mouse (any tracking mode is on).
    pub fn mouse_tracking(&self) -> bool {
        self.get(g::GHOSTTY_TERMINAL_DATA_MOUSE_TRACKING)
            .unwrap_or(false)
    }

    pub fn alt_screen(&self) -> bool {
        self.get::<g::GhosttyTerminalScreen>(g::GHOSTTY_TERMINAL_DATA_ACTIVE_SCREEN)
            == Some(g::GHOSTTY_TERMINAL_SCREEN_ALTERNATE)
    }

    /// Rows of history above the live screen.
    pub fn scrollback_rows(&self) -> usize {
        self.get(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)
            .unwrap_or(0)
    }

    fn scroll(
        &mut self,
        tag: g::GhosttyTerminalScrollViewportTag,
        set: impl FnOnce(&mut g::GhosttyTerminalScrollViewport),
    ) {
        let mut scroll = g::GhosttyTerminalScrollViewport {
            tag,
            ..Default::default()
        };
        set(&mut scroll);
        // SAFETY: plain call on the owned handle.
        unsafe { g::ghostty_terminal_scroll_viewport(self.term, scroll) };
        self.feed_search();
    }

    /// Scroll the viewport by lines: negative toward older output.
    pub fn scroll_viewport(&mut self, delta: isize) {
        self.scroll(g::GHOSTTY_SCROLL_VIEWPORT_DELTA, |s| s.value.delta = delta);
    }

    /// Scroll so `row`, counted from the oldest line, is the first visible row.
    pub fn scroll_to_row(&mut self, row: usize) {
        self.scroll(g::GHOSTTY_SCROLL_VIEWPORT_ROW, |s| s.value.row = row);
    }

    pub fn scroll_to_top(&mut self) {
        self.scroll(g::GHOSTTY_SCROLL_VIEWPORT_TOP, |_| {});
    }

    /// Back to the live screen.
    pub fn scroll_to_bottom(&mut self) {
        self.scroll(g::GHOSTTY_SCROLL_VIEWPORT_BOTTOM, |_| {});
    }

    pub fn scrollbar(&self) -> Scrollbar {
        let bar: g::GhosttyTerminalScrollbar = self
            .get(g::GHOSTTY_TERMINAL_DATA_SCROLLBAR)
            .unwrap_or_default();
        Scrollbar {
            total: bar.total,
            offset: bar.offset,
            len: bar.len,
        }
    }

    /// When a synchronised-output block the program has not ended must be shown anyway.
    pub fn render_hold_deadline(&self) -> Option<Instant> {
        self.shared.held_since.map(|since| since + MAX_HOLD)
    }

    /// Whether a frame is being held back for synchronised output (mode 2026).
    pub fn held(&self) -> bool {
        self.shared.held_since.is_some()
    }

    /// Wrap pasted text as the program asked: bracketed (mode 2004) or newlines as carriage
    /// returns. Control bytes that could end the paste early or inject keys become spaces.
    pub fn paste_bytes(&self, text: &str) -> Vec<u8> {
        let bracketed = self.dec_mode(BRACKETED_PASTE);
        // Unbracketed, a line break is one carriage return, as Enter sends.
        let text = if bracketed {
            std::borrow::Cow::Borrowed(text)
        } else {
            std::borrow::Cow::Owned(text.replace("\r\n", "\n"))
        };
        let mut data = text.as_bytes().to_vec();
        // Brackets, escape sequences and newline handling add at most a few bytes.
        let mut out = vec![0u8; data.len() + 16];
        let mut written = 0usize;
        // SAFETY: both buffers are live for the call; `data` is modified in place by contract.
        let mut result = unsafe {
            g::ghostty_paste_encode(
                data.as_mut_ptr().cast(),
                data.len(),
                bracketed,
                out.as_mut_ptr().cast(),
                out.len(),
                &mut written,
            )
        };
        if result == g::GHOSTTY_OUT_OF_SPACE {
            out.resize(written, 0);
            data = text.as_bytes().to_vec();
            // SAFETY: as above, with the size the first call asked for.
            result = unsafe {
                g::ghostty_paste_encode(
                    data.as_mut_ptr().cast(),
                    data.len(),
                    bracketed,
                    out.as_mut_ptr().cast(),
                    out.len(),
                    &mut written,
                )
            };
        }
        if result != g::GHOSTTY_SUCCESS {
            return Vec::new();
        }
        out.truncate(written);
        out
    }

    /// Updates the render state (unless a synchronised-output block holds the frame back) and
    /// reads the visible rows.
    pub fn frame(&mut self) -> Frame {
        if let Some(since) = self.shared.held_since {
            if since.elapsed() > MAX_HOLD {
                // The program never ended its block: show what it has drawn.
                let config = g::GhosttyTerminalModeConfig {
                    mode: SYNC_OUTPUT,
                    value: false,
                };
                // SAFETY: the mode option takes a GhosttyTerminalModeConfig.
                unsafe {
                    g::ghostty_terminal_set(
                        self.term,
                        g::GHOSTTY_TERMINAL_OPT_MODE,
                        (&config as *const g::GhosttyTerminalModeConfig).cast(),
                    );
                }
                self.shared.held_since = None;
            }
        }
        let state = self.shared.state;
        // SAFETY: handles are owned by self; each getter writes the type its key documents.
        unsafe {
            if self.shared.held_since.is_none() {
                g::ghostty_render_state_update(state, self.term);
            }
            let mut colors = g::GhosttyRenderStateColors {
                size: std::mem::size_of::<g::GhosttyRenderStateColors>(),
                ..Default::default()
            };
            g::ghostty_render_state_get(
                state,
                g::GHOSTTY_RENDER_STATE_DATA_COLORS,
                (&mut colors as *mut g::GhosttyRenderStateColors).cast(),
            );
            let fg_default = Rgb::from(colors.foreground);
            let bg_default = Rgb::from(colors.background);

            let mut rows = Vec::with_capacity(self.rows as usize);
            g::ghostty_render_state_get(
                state,
                g::GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR,
                (&mut self.rows_it as *mut g::GhosttyRenderStateRowIterator).cast(),
            );
            while g::ghostty_render_state_row_iterator_next(self.rows_it) {
                g::ghostty_render_state_row_get(
                    self.rows_it,
                    g::GHOSTTY_RENDER_STATE_ROW_DATA_CELLS,
                    (&mut self.cells as *mut g::GhosttyRenderStateRowCells).cast(),
                );
                let mut row = Vec::with_capacity(self.cols as usize);
                while g::ghostty_render_state_row_cells_next(self.cells) {
                    row.push(self.read_cell(&colors));
                }
                rows.push(row);
            }

            let mut cur = g::GhosttyRenderStateCursor {
                size: std::mem::size_of::<g::GhosttyRenderStateCursor>(),
                ..Default::default()
            };
            g::ghostty_render_state_get(
                state,
                g::GHOSTTY_RENDER_STATE_DATA_CURSOR,
                (&mut cur as *mut g::GhosttyRenderStateCursor).cast(),
            );
            // A cursor on the tail of a wide character belongs to its head.
            let x = if cur.wide_tail {
                cur.viewport_x.saturating_sub(1)
            } else {
                cur.viewport_x
            };
            let cursor = (cur.visible && cur.viewport_has_value).then(|| Cursor {
                x,
                y: cur.viewport_y,
                shape: match cur.visual_style {
                    g::GHOSTTY_RENDER_STATE_CURSOR_VISUAL_STYLE_BAR => CursorShape::Bar,
                    g::GHOSTTY_RENDER_STATE_CURSOR_VISUAL_STYLE_UNDERLINE => CursorShape::Underline,
                    g::GHOSTTY_RENDER_STATE_CURSOR_VISUAL_STYLE_BLOCK_HOLLOW => CursorShape::Hollow,
                    _ => CursorShape::Block,
                },
                color: if colors.cursor_has_value {
                    colors.cursor.into()
                } else {
                    fg_default
                },
                text: self.theme.cursor_text.unwrap_or(bg_default),
                wide: cur.wide_tail
                    || rows
                        .get(usize::from(cur.viewport_y))
                        .and_then(|r| r.get(usize::from(x)))
                        .is_some_and(|c| c.wide),
                blink: cur.blinking,
            });
            g::ghostty_render_state_clean(state);
            Frame {
                rows,
                cursor,
                cursor_cell: cur.viewport_has_value.then_some((x, cur.viewport_y)),
                fg: fg_default,
                bg: bg_default,
                search: self.search.spans.clone(),
            }
        }
    }

    /// The cell the row-cells iterator is on.
    ///
    /// SAFETY: the caller has just advanced `self.cells` to a cell.
    unsafe fn read_cell(&self, colors: &g::GhosttyRenderStateColors) -> Cell {
        let (fg_default, bg_default) = (Rgb::from(colors.foreground), Rgb::from(colors.background));
        let c = self.cells;
        // SAFETY: each getter below writes the type its key documents.
        unsafe {
            let mut raw: g::GhosttyCell = Default::default();
            g::ghostty_render_state_row_cells_get(
                c,
                g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_RAW,
                (&mut raw as *mut g::GhosttyCell).cast(),
            );
            let mut wide: g::GhosttyCellWide = g::GHOSTTY_CELL_WIDE_NARROW;
            g::ghostty_cell_get(
                raw,
                g::GHOSTTY_CELL_DATA_WIDE,
                (&mut wide as *mut g::GhosttyCellWide).cast(),
            );
            let mut style = g::GhosttyStyle {
                size: std::mem::size_of::<g::GhosttyStyle>(),
                ..Default::default()
            };
            g::ghostty_render_state_row_cells_get(
                c,
                g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE,
                (&mut style as *mut g::GhosttyStyle).cast(),
            );
            let mut color = g::GhosttyColorRgb::default();
            let fg = if g::ghostty_render_state_row_cells_get(
                c,
                g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR,
                (&mut color as *mut g::GhosttyColorRgb).cast(),
            ) == g::GHOSTTY_SUCCESS
            {
                Rgb::from(color)
            } else {
                fg_default
            };
            let bg = (g::ghostty_render_state_row_cells_get(
                c,
                g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR,
                (&mut color as *mut g::GhosttyColorRgb).cast(),
            ) == g::GHOSTTY_SUCCESS)
                .then(|| Rgb::from(color));
            let (mut fg, mut bg) = (fg, bg);
            if style.inverse {
                let new_fg = bg.unwrap_or(bg_default);
                bg = Some(fg);
                fg = new_fg;
            }
            let mut selected = false;
            g::ghostty_render_state_row_cells_get(
                c,
                g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_SELECTED,
                (&mut selected as *mut bool).cast(),
            );
            if selected {
                bg = Some(self.theme.selection_background());
                if let Some(selection_fg) = self.theme.selection_fg {
                    fg = selection_fg;
                }
            }
            let underline_color = match style.underline_color.tag {
                g::GHOSTTY_STYLE_COLOR_RGB => Some(Rgb::from(style.underline_color.value.rgb)),
                g::GHOSTTY_STYLE_COLOR_PALETTE => colors
                    .palette
                    .get(usize::from(style.underline_color.value.palette))
                    .map(|c| Rgb::from(*c)),
                _ => None,
            };
            let mut text = String::new();
            if wide != g::GHOSTTY_CELL_WIDE_SPACER_TAIL
                && wide != g::GHOSTTY_CELL_WIDE_SPACER_HEAD
                && !style.invisible
            {
                let mut len: u32 = 0;
                g::ghostty_render_state_row_cells_get(
                    c,
                    g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN,
                    (&mut len as *mut u32).cast(),
                );
                if len > 0 {
                    let mut codepoints = vec![0u32; len as usize];
                    g::ghostty_render_state_row_cells_get(
                        c,
                        g::GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF,
                        codepoints.as_mut_ptr().cast(),
                    );
                    text = codepoints.into_iter().filter_map(char::from_u32).collect();
                }
            }
            // Unicode placeholders and the like keep the colours they were given.
            if self.theme.minimum_contrast > 1.0 && !keeps_program_colour(&text) {
                fg = readable(fg, bg.unwrap_or(bg_default), self.theme.minimum_contrast);
            }
            // A placeholder cell draws no text and no rules: its colours name an image, and the
            // image is drawn over it.
            let placeholder = text.starts_with('\u{10eeee}');
            if placeholder {
                text.clear();
            }
            Cell {
                text,
                fg,
                bg,
                bold: style.bold,
                italic: style.italic,
                faint: style.faint,
                underline: style.underline != 0 && !placeholder,
                underline_style: match style.underline {
                    _ if placeholder => Underline::None,
                    g::GHOSTTY_SGR_UNDERLINE_SINGLE => Underline::Single,
                    g::GHOSTTY_SGR_UNDERLINE_DOUBLE => Underline::Double,
                    g::GHOSTTY_SGR_UNDERLINE_CURLY => Underline::Curly,
                    g::GHOSTTY_SGR_UNDERLINE_DOTTED => Underline::Dotted,
                    g::GHOSTTY_SGR_UNDERLINE_DASHED => Underline::Dashed,
                    _ => Underline::None,
                },
                underline_color,
                strike: style.strikethrough && !placeholder,
                wide: wide == g::GHOSTTY_CELL_WIDE_WIDE,
                selected,
            }
        }
    }

    /// The bytes one key press sends the program, in the keyboard mode it asked for (legacy,
    /// application cursor keys, modifyOtherKeys, or the kitty protocol with its flags). Empty
    /// when the key sends nothing.
    pub fn encode_key(&mut self, input: KeyInput) -> Vec<u8> {
        // SAFETY: the encoder, event and terminal handles are owned by self; the event borrows
        // the text only until the encode call returns.
        unsafe {
            g::ghostty_key_encoder_setopt_from_terminal(self.keys, self.term);
            // Option types Alt sequences, as the web terminal's default does.
            let option = g::GHOSTTY_OPTION_AS_ALT_TRUE;
            g::ghostty_key_encoder_setopt(
                self.keys,
                g::GHOSTTY_KEY_ENCODER_OPT_MACOS_OPTION_AS_ALT,
                (&option as *const g::GhosttyOptionAsAlt).cast(),
            );
            let e = self.key_event;
            g::ghostty_key_event_set_action(
                e,
                if input.repeat {
                    g::GHOSTTY_KEY_ACTION_REPEAT
                } else {
                    g::GHOSTTY_KEY_ACTION_PRESS
                },
            );
            g::ghostty_key_event_set_key(e, input.key);
            g::ghostty_key_event_set_mods(e, input.mods);
            let printable = input
                .text
                .is_some_and(|t| !t.is_empty() && !t.chars().any(char::is_control));
            g::ghostty_key_event_set_consumed_mods(e, if printable { input.consumed } else { 0 });
            match input.text {
                Some(t) if printable => {
                    g::ghostty_key_event_set_utf8(e, t.as_ptr().cast(), t.len())
                }
                _ => g::ghostty_key_event_set_utf8(e, ptr::null(), 0),
            }
            g::ghostty_key_event_set_unshifted_codepoint(
                e,
                input.unshifted.map_or(0, |c| c as u32),
            );
            let mut buf = [0u8; 128];
            let mut len = 0usize;
            let result = g::ghostty_key_encoder_encode(
                self.keys,
                e,
                buf.as_mut_ptr().cast(),
                buf.len(),
                &mut len,
            );
            if result != g::GHOSTTY_SUCCESS {
                return Vec::new();
            }
            buf[..len].to_vec()
        }
    }

    /// The report a program that tracks the mouse gets for `input`, in the tracking mode and
    /// format it chose; empty when that mode does not report this event.
    pub fn encode_mouse(&mut self, input: MouseInput) -> Vec<u8> {
        // Ghostty takes whole-pixel cells; a fractional one rounded alone makes the reported
        // column run ahead of the pointer, so the position moves into a grid of whole cells:
        // the same column and row exactly, pixels (SGR-pixel mode) within a few percent.
        let (cw, ch) = input.cell;
        let (cwi, chi) = (cw.round().max(1.0), ch.round().max(1.0));
        let (x, y) = (input.x / cw.max(1.0) * cwi, input.y / ch.max(1.0) * chi);
        // SAFETY: the encoder, event and terminal handles are owned by self.
        unsafe {
            g::ghostty_mouse_encoder_setopt_from_terminal(self.mouse, self.term);
            let size = g::GhosttyMouseEncoderSize {
                size: std::mem::size_of::<g::GhosttyMouseEncoderSize>(),
                screen_width: self.cols as u32 * cwi as u32,
                screen_height: self.rows as u32 * chi as u32,
                cell_width: cwi as u32,
                cell_height: chi as u32,
                ..Default::default()
            };
            g::ghostty_mouse_encoder_setopt(
                self.mouse,
                g::GHOSTTY_MOUSE_ENCODER_OPT_SIZE,
                (&size as *const g::GhosttyMouseEncoderSize).cast(),
            );
            g::ghostty_mouse_encoder_setopt(
                self.mouse,
                g::GHOSTTY_MOUSE_ENCODER_OPT_ANY_BUTTON_PRESSED,
                (&input.any_pressed as *const bool).cast(),
            );
            let e = self.mouse_event;
            let action = match input.action {
                MouseAction::Press => g::GHOSTTY_MOUSE_ACTION_PRESS,
                MouseAction::Release => g::GHOSTTY_MOUSE_ACTION_RELEASE,
                MouseAction::Motion => g::GHOSTTY_MOUSE_ACTION_MOTION,
            };
            g::ghostty_mouse_event_set_action(e, action);
            match input.button {
                Some(b) => g::ghostty_mouse_event_set_button(e, b.raw()),
                None => g::ghostty_mouse_event_clear_button(e),
            }
            g::ghostty_mouse_event_set_mods(e, input.mods);
            g::ghostty_mouse_event_set_position(e, g::GhosttyMousePosition { x, y });
            let mut buf = [0u8; 64];
            let mut len = 0usize;
            let result = g::ghostty_mouse_encoder_encode(
                self.mouse,
                e,
                buf.as_mut_ptr().cast(),
                buf.len(),
                &mut len,
            );
            if result != g::GHOSTTY_SUCCESS || len == 0 {
                return Vec::new();
            }
            // Refreshing the encoder's terminal and size options resets its own cell
            // tracking, so motion within a cell is dropped here instead.
            if input.action == MouseAction::Motion && self.last_mouse_report == buf[..len] {
                return Vec::new();
            }
            let report = buf[..len].to_vec();
            // Remember the motion that matches a press or release, so a focus click cannot
            // start a drag report from the same cell.
            if input.action != MouseAction::Motion {
                g::ghostty_mouse_event_set_action(e, g::GHOSTTY_MOUSE_ACTION_MOTION);
                if input.action == MouseAction::Release {
                    g::ghostty_mouse_event_clear_button(e);
                }
                len = 0;
                if g::ghostty_mouse_encoder_encode(
                    self.mouse,
                    e,
                    buf.as_mut_ptr().cast(),
                    buf.len(),
                    &mut len,
                ) != g::GHOSTTY_SUCCESS
                {
                    len = 0;
                }
            }
            self.last_mouse_report.clear();
            self.last_mouse_report.extend_from_slice(&buf[..len]);
            report
        }
    }
}

/// A callback as the pointer a terminal option takes.
fn hold_ptr<F: Copy>(callback: Option<F>) -> *const c_void {
    // SAFETY: an `Option<extern fn>` is exactly one nullable pointer.
    unsafe { std::mem::transmute_copy::<Option<F>, *const c_void>(&callback) }
}

impl Drop for Vt {
    fn drop(&mut self) {
        self.search.free();
        self.gesture.free(self.term);
        // SAFETY: every handle was created in `new` and is freed once, the render state last
        // because the terminal's callbacks may still name it until the terminal is gone.
        unsafe {
            g::ghostty_mouse_event_free(self.mouse_event);
            g::ghostty_mouse_encoder_free(self.mouse);
            g::ghostty_key_event_free(self.key_event);
            g::ghostty_key_encoder_free(self.keys);
            g::ghostty_render_state_row_cells_free(self.cells);
            g::ghostty_render_state_row_iterator_free(self.rows_it);
            g::ghostty_terminal_free(self.term);
            g::ghostty_render_state_free(self.shared.state);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fed(cols: u16, rows: u16, bytes: &str) -> Vt {
        let mut vt = Vt::new(cols, rows);
        vt.write(bytes.as_bytes());
        vt
    }

    fn key(key: g::GhosttyKey, mods: u32) -> KeyInput<'static> {
        KeyInput {
            key,
            mods: mods as g::GhosttyMods,
            consumed: 0,
            text: None,
            unshifted: None,
            repeat: false,
        }
    }

    fn typed(key: g::GhosttyKey, mods: u32, text: &'static str) -> KeyInput<'static> {
        KeyInput {
            text: Some(text),
            unshifted: text.chars().next(),
            ..self::key(key, mods)
        }
    }

    fn mouse(action: MouseAction, button: Option<MouseButton>, col: u32, row: u32) -> MouseInput {
        MouseInput {
            action,
            button,
            mods: 0,
            // The middle of the cell, with 10 x 20 pixel cells.
            x: col as f32 * 10.0 + 5.0,
            y: row as f32 * 20.0 + 10.0,
            any_pressed: false,
            cell: (10.0, 20.0),
        }
    }

    #[test]
    fn fed_bytes_become_cells_with_their_styles() {
        let mut vt = fed(
            20,
            3,
            "plain \x1b[1;31mbold-red\x1b[0m \x1b[3;4;9;2mfancy\x1b[0m\r\n\x1b[44;38;2;1;2;3mx\x1b[7my\x1b[0mz",
        );
        let theme = Theme::default();
        let frame = vt.frame();
        let cell = |x: usize, y: usize| frame.rows[y][x].clone();
        assert_eq!(frame.row_text(0), "plain bold-red fancy");
        assert_eq!(frame.row_text(1), "xyz");
        let plain = cell(0, 0);
        assert_eq!((plain.fg, plain.bg, plain.bold), (theme.fg, None, false));
        let red = cell(6, 0);
        assert_eq!(red.text, "b");
        assert!(red.bold);
        assert_eq!(red.fg, theme.ansi[1]);
        let fancy = cell(15, 0);
        assert!(fancy.italic && fancy.underline && fancy.strike && fancy.faint);
        // Truecolour foreground over an ANSI background.
        let styled = cell(0, 1);
        assert_eq!((styled.fg, styled.bg), (Rgb(1, 2, 3), Some(theme.ansi[4])));
        // Inverse swaps them; a cell with no background swaps with the default one.
        let inverse = cell(1, 1);
        assert_eq!(
            (inverse.fg, inverse.bg),
            (theme.ansi[4], Some(Rgb(1, 2, 3)))
        );
        let after = cell(2, 1);
        assert_eq!((after.fg, after.bg), (theme.fg, None));
        let mut inverted = fed(5, 1, "\x1b[7mi");
        let swapped = inverted.frame().rows[0][0].clone();
        assert_eq!((swapped.fg, swapped.bg), (theme.bg, Some(theme.fg)));
    }

    #[test]
    fn hidden_text_keeps_its_cell_but_no_glyph() {
        let mut vt = fed(10, 1, "a\x1b[8mb\x1b[0mc");
        let frame = vt.frame();
        assert_eq!(frame.rows[0][1].text, "");
        assert_eq!(frame.rows[0][2].text, "c");
    }

    #[test]
    fn wide_characters_take_two_cells_and_the_tail_is_empty() {
        let mut vt = fed(10, 1, "a\u{4e16}\u{754c}b\u{1f600}");
        let frame = vt.frame();
        let row = &frame.rows[0];
        assert_eq!(row[1].text, "\u{4e16}");
        assert!(row[1].wide);
        assert!(!row[2].wide && row[2].text.is_empty(), "the tail is blank");
        assert_eq!(row[3].text, "\u{754c}");
        assert_eq!(row[5].text, "b");
        // Emoji are two cells wide as well.
        assert_eq!(row[6].text, "\u{1f600}");
        assert!(row[6].wide);
        assert_eq!(frame.row_text(0), "a\u{4e16}\u{754c}b\u{1f600}");
        // The cursor sits after the emoji, at column 8.
        assert_eq!(frame.cursor.map(|c| c.x), Some(8));
    }

    #[test]
    fn grapheme_clusters_stay_in_one_cell_once_the_program_asks() {
        // A combining accent joins its base in any mode.
        let mut vt = fed(10, 1, "e\u{301}x");
        let frame = vt.frame();
        assert_eq!(frame.rows[0][0].text, "e\u{301}");
        assert_eq!(frame.rows[0][1].text, "x");
        // A text-style symbol followed by VS16 becomes a two-cell emoji under mode 2027.
        let mut emoji = fed(10, 1, "\x1b[?2027h\u{270d}\u{fe0f}x");
        let frame = emoji.frame();
        assert_eq!(frame.rows[0][0].text, "\u{270d}\u{fe0f}");
        assert!(frame.rows[0][0].wide);
        assert_eq!(frame.rows[0][2].text, "x");
        // Without the mode the width is the symbol's own: one cell.
        let mut plain = fed(10, 1, "\u{270d}\u{fe0f}x");
        assert!(!plain.frame().rows[0][0].wide);
    }

    #[test]
    fn the_cursor_has_a_position_shape_and_visibility() {
        let mut vt = fed(10, 3, "ab\r\nc");
        let cursor = vt.frame().cursor.unwrap();
        assert_eq!(
            (cursor.x, cursor.y, cursor.shape),
            (1, 1, CursorShape::Block)
        );
        assert_eq!(cursor.color, Theme::default().cursor);
        vt.write(b"\x1b[6 q");
        assert_eq!(vt.frame().cursor.unwrap().shape, CursorShape::Bar);
        vt.write(b"\x1b[4 q");
        assert_eq!(vt.frame().cursor.unwrap().shape, CursorShape::Underline);
        vt.write(b"\x1b[?25l");
        let hidden = vt.frame();
        assert!(hidden.cursor.is_none());
        assert_eq!(hidden.cursor_cell, Some((1, 1)));
    }

    #[test]
    fn a_resize_reflows_and_reports_its_size() {
        let mut vt = fed(10, 3, "0123456789ab");
        assert_eq!(vt.frame().row_text(1), "ab");
        vt.resize(20, 5, (8, 16));
        assert_eq!(vt.size(), (20, 5));
        let frame = vt.frame();
        assert_eq!(frame.rows.len(), 5);
        assert_eq!(frame.rows[0].len(), 20);
        assert_eq!(frame.row_text(0), "0123456789ab");
        // Asked for its size in pixels, the terminal answers with the cell size it was given.
        vt.write(b"\x1b[16t");
        assert_eq!(vt.take_replies(), b"\x1b[6;16;8t");
        // A resize to nothing is ignored.
        vt.resize(0, 5, (8, 16));
        assert_eq!(vt.size(), (20, 5));
    }

    #[test]
    fn a_program_that_asks_for_in_band_size_reports_gets_each_change() {
        let mut vt = Vt::new(20, 4);
        vt.resize(30, 5, (9, 18));
        assert!(
            vt.take_replies().is_empty(),
            "a shell receives no resize input"
        );
        vt.write(b"\x1b[?2048h");
        assert_eq!(
            vt.take_replies(),
            b"\x1b[48;5;30;90;270t",
            "enabling reports the geometry"
        );
        vt.resize(40, 6, (9, 18));
        assert_eq!(vt.take_replies(), b"\x1b[48;6;40;108;360t");
        assert!(vt.take_replies().is_empty(), "each change is reported once");
        vt.write(b"\x1b[?2048l");
        vt.resize(50, 7, (9, 18));
        assert!(vt.take_replies().is_empty());
    }

    #[test]
    fn five_thousand_styled_lines_stay_reachable_at_either_width() {
        for cols in [80u16, 200] {
            let mut vt = Vt::new(cols, 24);
            for n in 0..5000 {
                vt.write(format!("\x1b[3{}mline {n}\x1b[0m\r\n", n % 8).as_bytes());
            }
            vt.scroll_to_top();
            assert_eq!(vt.frame().row_text(0), "line 0", "{cols} columns");
            vt.scroll_to_bottom();
            assert!(vt.frame().row_text(22).starts_with("line 4999"));
        }
    }

    #[test]
    fn keys_encode_in_the_mode_the_program_asked_for() {
        let mut vt = Vt::new(80, 24);
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ENTER, 0)), b"\r");
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ESCAPE, 0)), b"\x1b");
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_BACKSPACE, 0)), b"\x7f");
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ARROW_UP, 0)), b"\x1b[A");
        assert_eq!(
            vt.encode_key(key(g::GHOSTTY_KEY_ARROW_LEFT, g::GHOSTTY_MODS_CTRL)),
            b"\x1b[1;5D"
        );
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_PAGE_UP, 0)), b"\x1b[5~");
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_F5, 0)), b"\x1b[15~");
        assert_eq!(vt.encode_key(typed(g::GHOSTTY_KEY_A, 0, "a")), b"a");
        assert_eq!(
            vt.encode_key(typed(g::GHOSTTY_KEY_C, g::GHOSTTY_MODS_CTRL, "c")),
            b"\x03"
        );
        // Option types an Escape prefix.
        assert_eq!(
            vt.encode_key(typed(g::GHOSTTY_KEY_X, g::GHOSTTY_MODS_ALT, "x")),
            b"\x1bx"
        );
        // Application cursor keys change the arrows.
        vt.write(b"\x1b[?1h");
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ARROW_UP, 0)), b"\x1bOA");
    }

    #[test]
    fn kitty_keyboard_flags_the_program_set_change_the_encoding() {
        let mut vt = Vt::new(80, 24);
        assert_eq!(vt.kitty_keyboard_flags(), 0);
        // Legacy: Escape is a bare byte, and Ctrl-I and Tab are the same key.
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ESCAPE, 0)), b"\x1b");
        // The program pushes "disambiguate escape codes".
        vt.write(b"\x1b[>1u");
        assert_eq!(vt.kitty_keyboard_flags(), 1);
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ESCAPE, 0)), b"\x1b[27u");
        assert_eq!(
            vt.encode_key(typed(g::GHOSTTY_KEY_A, g::GHOSTTY_MODS_CTRL, "a")),
            b"\x1b[97;5u"
        );
        // Shift-; types ":", which the encoder must not report as a shifted key.
        let colon = KeyInput {
            consumed: g::GHOSTTY_MODS_SHIFT as g::GhosttyMods,
            ..typed(g::GHOSTTY_KEY_SEMICOLON, g::GHOSTTY_MODS_SHIFT, ":")
        };
        assert_eq!(vt.encode_key(colon), b":");
        // Reporting event types adds the release of a key, which legacy mode never sees.
        vt.write(b"\x1b[>3u");
        assert_eq!(vt.kitty_keyboard_flags(), 3 | 1);
        let repeat = KeyInput {
            repeat: true,
            ..key(g::GHOSTTY_KEY_ARROW_UP, 0)
        };
        assert_eq!(vt.encode_key(repeat), b"\x1b[1;1:2A");
        // Popping the flags restores legacy encoding.
        vt.write(b"\x1b[<2u");
        assert_eq!(vt.kitty_keyboard_flags(), 0);
        assert_eq!(vt.encode_key(key(g::GHOSTTY_KEY_ESCAPE, 0)), b"\x1b");
    }

    #[test]
    fn the_mouse_is_reported_only_in_the_mode_and_format_the_program_chose() {
        let mut vt = Vt::new(80, 24);
        assert!(!vt.mouse_tracking());
        assert!(vt
            .encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Left), 5, 3))
            .is_empty());
        // Button tracking with SGR coordinates.
        vt.write(b"\x1b[?1000h\x1b[?1006h");
        assert!(vt.mouse_tracking());
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Left), 5, 3)),
            b"\x1b[<0;6;4M"
        );
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Release, Some(MouseButton::Left), 5, 3)),
            b"\x1b[<0;6;4m"
        );
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Right), 0, 0)),
            b"\x1b[<2;1;1M"
        );
        // The wheel is buttons 4 to 7; a modifier adds its bit.
        for (button, code) in [
            (MouseButton::WheelUp, 64),
            (MouseButton::WheelDown, 65),
            (MouseButton::WheelLeft, 66),
            (MouseButton::WheelRight, 67),
        ] {
            assert_eq!(
                vt.encode_mouse(mouse(MouseAction::Press, Some(button), 2, 2)),
                format!("\x1b[<{code};3;3M").into_bytes()
            );
        }
        let ctrl = MouseInput {
            mods: g::GHOSTTY_MODS_CTRL as g::GhosttyMods,
            ..mouse(MouseAction::Press, Some(MouseButton::WheelUp), 2, 2)
        };
        assert_eq!(vt.encode_mouse(ctrl), b"\x1b[<80;3;3M");
        // Plain motion is not reported in button mode, and is once per cell in any-event mode.
        assert!(vt
            .encode_mouse(mouse(MouseAction::Motion, None, 7, 7))
            .is_empty());
        vt.write(b"\x1b[?1003h");
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Motion, None, 7, 7)),
            b"\x1b[<35;8;8M"
        );
        assert!(vt
            .encode_mouse(mouse(MouseAction::Motion, None, 7, 7))
            .is_empty());
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Motion, None, 8, 7)),
            b"\x1b[<35;9;8M"
        );
        // Turning the modes off stops the reports.
        vt.write(b"\x1b[?1003l\x1b[?1000l");
        assert!(!vt.mouse_tracking());
    }

    #[test]
    fn minimum_contrast_lifts_text_but_leaves_shape_glyphs_alone() {
        let dim = "\x1b[38;2;20;20;20m";
        let feed = |minimum: f32| {
            let mut vt = Vt::new(20, 2);
            vt.set_theme(Theme {
                minimum_contrast: minimum,
                ..Theme::default()
            });
            vt.write(format!("{dim}a\u{2500}\u{e0b0}\u{2588}").as_bytes());
            vt.frame()
        };
        let bg = Theme::default().bg;
        // Off (1): the program's own dark grey on black stays unreadable.
        let off = feed(1.0);
        assert_eq!(off.rows[0][0].fg, Rgb(20, 20, 20));
        // On: the letter is pushed until it meets the ratio, the shapes keep their colour.
        let on = feed(4.5);
        assert!(contrast(on.rows[0][0].fg, bg) >= 4.5, "{:?}", on.rows[0][0]);
        for x in 1..4 {
            assert_eq!(
                on.rows[0][x].fg,
                Rgb(20, 20, 20),
                "column {x} keeps its colour"
            );
        }
        // Text that already meets the ratio is not touched.
        let mut vt = Vt::new(20, 2);
        vt.set_theme(Theme {
            minimum_contrast: 4.5,
            ..Theme::default()
        });
        vt.write(b"\x1b[38;2;240;240;100mr");
        assert_eq!(vt.frame().rows[0][0].fg, Rgb(240, 240, 100));
    }

    #[test]
    fn a_drag_is_reported_in_the_modes_that_ask_for_it_and_pixels_when_the_program_wants_them() {
        let drag = |col: u32, row: u32| MouseInput {
            any_pressed: true,
            ..mouse(MouseAction::Motion, Some(MouseButton::Left), col, row)
        };
        // Press-and-release tracking never sees motion.
        let mut vt = fed(80, 24, "\x1b[?1000h\x1b[?1006h");
        vt.encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Left), 2, 2));
        assert!(vt.encode_mouse(drag(3, 2)).is_empty());
        // Button tracking reports a drag once per changed cell, and not inside the pressed cell.
        vt.write(b"\x1b[?1002h");
        vt.encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Left), 2, 2));
        assert!(vt.encode_mouse(drag(2, 2)).is_empty(), "same cell");
        assert_eq!(vt.encode_mouse(drag(3, 2)), b"\x1b[<32;4;3M");
        assert!(vt.encode_mouse(drag(3, 2)).is_empty(), "once per cell");
        // Pixel format: positions are the pointer's own pixels.
        vt.write(b"\x1b[?1016h");
        assert_eq!(
            vt.encode_mouse(mouse(MouseAction::Press, Some(MouseButton::Left), 2, 2)),
            b"\x1b[<0;25;50M"
        );
    }

    #[test]
    fn a_fractional_cell_size_reports_the_cell_under_the_pointer() {
        let mut vt = fed(100, 10, "\x1b[?1000h\x1b[?1006h");
        let at = |col: f32| MouseInput {
            action: MouseAction::Press,
            button: Some(MouseButton::Left),
            mods: 0,
            x: col * 11.7 + 5.0,
            y: 5.0,
            any_pressed: false,
            cell: (11.7, 24.3),
        };
        assert_eq!(vt.encode_mouse(at(60.0)), b"\x1b[<0;61;1M");
    }

    #[test]
    fn the_viewport_scrolls_through_history_and_returns() {
        let mut vt = Vt::new(20, 5);
        for line in 0..60 {
            vt.write(format!("line {line}\r\n").as_bytes());
        }
        assert!(vt.scrollback_rows() >= 55);
        let live = vt.frame().row_text(0);
        assert_eq!(live, "line 56");
        assert!(vt.scrollbar().at_bottom());
        vt.scroll_viewport(-10);
        assert_eq!(vt.frame().row_text(0), "line 46");
        assert!(!vt.scrollbar().at_bottom());
        vt.scroll_viewport(3);
        assert_eq!(vt.frame().row_text(0), "line 49");
        vt.scroll_to_top();
        assert_eq!(vt.frame().row_text(0), "line 0");
        assert_eq!(vt.scrollbar().offset, 0);
        vt.scroll_to_row(20);
        assert_eq!(vt.frame().row_text(0), "line 20");
        // New output while scrolled back leaves the viewport where it is.
        vt.write(b"fresh\r\n");
        assert_eq!(vt.frame().row_text(0), "line 20");
        vt.scroll_to_bottom();
        assert!(vt.scrollbar().at_bottom());
        assert_eq!(vt.frame().row_text(0), "line 57");
    }

    #[test]
    fn scrollback_is_capped_in_lines_and_in_bytes() {
        let mut vt = Vt::new(80, 24);
        for line in 0..30_000 {
            vt.write(format!("line {line}\r\n").as_bytes());
        }
        let kept = vt.scrollback_rows();
        // Ghostty prunes whole pages, so history lands within a page of the limit.
        assert!((9_500..10_500).contains(&kept), "{kept} rows kept");
        vt.scroll_to_top();
        let oldest = vt.frame().row_text(0);
        // 30,000 lines were written and roughly the last 10,000 kept.
        let first: usize = oldest.trim_start_matches("line ").parse().unwrap();
        assert!((19_000..20_500).contains(&first), "{oldest}");

        let mut heavy = Vt::new(500, 24);
        for line in 0..10_000 {
            let styled: String = (0..250)
                .map(|cell| format!("\x1b[3{}mx", (cell + line) % 8))
                .collect();
            heavy.write(format!("{styled}\x1b[0m\r\n").as_bytes());
        }
        let kept = heavy.scrollback_rows();
        assert!(
            kept < 9_000,
            "{kept} heavy rows kept; the byte cap did not apply"
        );
        assert!(kept > 100);
    }

    #[test]
    fn paste_is_bracketed_only_when_the_program_asked() {
        let mut vt = Vt::new(80, 24);
        assert_eq!(vt.paste_bytes("a\nb\r\nc"), b"a\rb\rc");
        vt.write(b"\x1b[?2004h");
        assert_eq!(vt.paste_bytes("a\nb"), b"\x1b[200~a\nb\x1b[201~");
        // An escape in the text can't end the paste early.
        let pasted = vt.paste_bytes("x\x1b[201~rm -rf y");
        let inner = &pasted[6..pasted.len() - 6];
        assert!(!inner.contains(&0x1b), "{inner:?}");
        assert_eq!(vt.paste_bytes(""), b"\x1b[200~\x1b[201~");
    }

    #[test]
    fn synchronised_output_holds_the_frame_until_the_block_ends() {
        let mut vt = fed(20, 2, "old");
        assert_eq!(vt.frame().row_text(0), "old");
        vt.write(b"\x1b[?2026h\x1b[H\x1b[2Jnew");
        assert!(vt.held());
        assert!(vt.render_hold_deadline().is_some());
        // What the program is drawing is not shown until it finishes.
        assert_eq!(vt.frame().row_text(0), "old");
        vt.write(b"\x1b[?2026l");
        assert!(!vt.held());
        assert_eq!(vt.frame().row_text(0), "new");
    }

    #[test]
    fn a_block_the_program_never_ends_is_shown_after_the_deadline() {
        let mut vt = fed(20, 2, "old\x1b[?2026h\x1b[H\x1b[2Jnew");
        assert_eq!(vt.frame().row_text(0), "old");
        vt.shared.held_since = Some(Instant::now() - MAX_HOLD - Duration::from_millis(10));
        assert_eq!(vt.frame().row_text(0), "new");
        assert!(!vt.held());
    }

    #[test]
    fn a_title_is_reported_once_per_change() {
        let mut vt = Vt::new(20, 2);
        assert!(vt.take_events().is_empty());
        vt.write(b"\x1b]2;first\x07");
        assert_eq!(vt.take_events(), vec![Event::Title("first".into())]);
        assert!(vt.take_events().is_empty());
        vt.write(b"\x1b]0;second\x1b\\");
        assert_eq!(vt.take_events(), vec![Event::Title("second".into())]);
        assert_eq!(vt.title(), "second");
    }

    #[test]
    fn clipboard_writes_surface_as_events_and_nothing_is_written_here() {
        let b64 = |text: &str| {
            const ALPHABET: &[u8] =
                b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            let mut out = String::new();
            for chunk in text.as_bytes().chunks(3) {
                let n =
                    chunk.iter().fold(0u32, |n, b| n << 8 | *b as u32) << (8 * (3 - chunk.len()));
                for i in 0..4 {
                    if i <= chunk.len() {
                        out.push(ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char);
                    } else {
                        out.push('=');
                    }
                }
            }
            out
        };
        let mut vt = Vt::new(20, 2);
        vt.write(format!("\x1b]52;c;{}\x07", b64("hello clip")).as_bytes());
        assert_eq!(
            vt.take_events(),
            vec![Event::ClipboardWrite("hello clip".into())]
        );
        // Only the last write of a batch is kept.
        vt.write(format!("\x1b]52;c;{}\x07\x1b]52;c;{}\x07", b64("one"), b64("two")).as_bytes());
        assert_eq!(vt.take_events(), vec![Event::ClipboardWrite("two".into())]);
        // A read request is never answered.
        vt.write(b"\x1b]52;c;?\x07");
        assert!(vt.take_events().is_empty());
        assert!(vt.take_replies().is_empty());
        // Over 1 MiB is ignored.
        let big = "a".repeat(MAX_CLIPBOARD_BYTES + 1);
        vt.write(format!("\x1b]52;c;{}\x07", b64(&big)).as_bytes());
        assert!(vt.take_events().is_empty());
        // A replay's clipboard writes already happened.
        vt.set_replaying(true);
        vt.write(format!("\x1b]52;c;{}\x07", b64("old")).as_bytes());
        vt.set_replaying(false);
        assert!(vt.take_events().is_empty());
    }

    #[test]
    fn queries_are_answered_live_and_not_during_a_replay() {
        let mut vt = Vt::new(80, 24);
        vt.write(b"\x1b[c");
        assert!(
            vt.take_replies().starts_with(b"\x1b[?"),
            "device attributes"
        );
        vt.write(b"ab\x1b[6n");
        assert_eq!(vt.take_replies(), b"\x1b[1;3R");
        vt.set_replaying(true);
        vt.write(b"\x1b[c\x1b[6n");
        vt.set_replaying(false);
        assert!(vt.take_replies().is_empty());
    }

    #[test]
    fn dropping_a_terminal_with_state_does_not_crash() {
        let mut vt = fed(10, 3, "text\x1b[?2026h\x1b[?1000h");
        vt.frame();
        drop(vt);
    }
}
