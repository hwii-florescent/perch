//! A terminal's current screen, scrollback and modes, and the bytes that
//! recreate them in a fresh emulator. A byte tail of the output can't: a TUI
//! that paints once and then redraws only what changed (pi's status line ticks
//! every second) pushes its full paint out of any tail within minutes, and the
//! modes it set at startup (alternate screen, mouse reporting) go with it. A
//! view rebuilt from the tail then shows a near-empty screen and never reports
//! the wheel.
//!
//! The emulator is Ghostty's (libghostty-vt, via `ghostty-sys`). The daemon
//! keeps one [`Screen`] per session, fed from spawn, so an attach can end in
//! an exact repaint however long ago the app quit; the runtime keeps one per
//! terminal for the views it opens.
//!
//! Everything here is a read of, or a write to, one native terminal handle;
//! callers serialise access (a `Mutex`), which is why [`Screen`] is `Send` but
//! not `Sync`.

use ghostty_sys as g;
use std::ptr;

/// Scrollback kept per terminal: whichever of these Ghostty reaches first.
/// Ghostty prunes whole pages, so the retained history can run a page
/// (dozens to ~a hundred rows) past the line limit.
const SCROLLBACK_LINES: usize = 10_000;
const SCROLLBACK_BYTES: usize = 10 * 1024 * 1024;

/// Bytes of one unfinished escape sequence Ghostty remembers so a snapshot
/// taken mid-sequence still works and [`Screen::restore`] can hand the
/// sequence's start to a client whose live stream resumes mid-way.
const CONTINUATION_BYTES: usize = 256 * 1024;

/// An owned native terminal.
struct Term(g::GhosttyTerminal);

impl Drop for Term {
    fn drop(&mut self) {
        // SAFETY: the handle came from ghostty_terminal_new / the snapshot
        // decoder and is freed exactly once, here.
        unsafe { g::ghostty_terminal_free(self.0) };
    }
}

impl Term {
    fn new(cols: u16, rows: u16) -> Option<Self> {
        let mut handle = ptr::null_mut();
        // SAFETY: out-pointer to a local; the handle is owned by the result.
        let ok = unsafe { g::ghostty_terminal_new(ptr::null(), &mut handle, cols, rows) };
        (ok == g::GHOSTTY_SUCCESS && !handle.is_null()).then_some(Self(handle))
    }

    fn set<T>(&self, option: g::GhosttyTerminalOption, value: &T) -> bool {
        // SAFETY: every option used here takes a pointer to a `T` of the
        // type the call site passes.
        let ok = unsafe { g::ghostty_terminal_set(self.0, option, (value as *const T).cast()) };
        ok == g::GHOSTTY_SUCCESS
    }

    fn get<T: Default>(&self, data: g::GhosttyTerminalData) -> Option<T> {
        let mut out = T::default();
        // SAFETY: every data key used here writes a `T` of the type the call
        // site asks for.
        let ok = unsafe { g::ghostty_terminal_get(self.0, data, (&mut out as *mut T).cast()) };
        (ok == g::GHOSTTY_SUCCESS).then_some(out)
    }

    fn write(&self, bytes: &[u8]) {
        // SAFETY: ptr/len describe `bytes`; Ghostty copies what it keeps.
        unsafe { g::ghostty_terminal_vt_write(self.0, bytes.as_ptr(), bytes.len()) };
    }

    /// A DEC private (`ansi == false`) or ANSI mode.
    fn mode(&self, number: u16, ansi: bool) -> bool {
        let mut config = g::GhosttyTerminalModeConfig {
            mode: mode_id(number, ansi),
            value: false,
        };
        // SAFETY: the mode key reads and writes a GhosttyTerminalModeConfig.
        let ok = unsafe {
            g::ghostty_terminal_get(
                self.0,
                g::GHOSTTY_TERMINAL_DATA_MODE,
                (&mut config as *mut g::GhosttyTerminalModeConfig).cast(),
            )
        };
        ok == g::GHOSTTY_SUCCESS && config.value
    }

    /// Flips the mode's bit only; unlike `CSI ? Nh/l` it triggers no side
    /// effect such as switching screens.
    fn set_mode_bit(&self, number: u16, value: bool) {
        let config = g::GhosttyTerminalModeConfig {
            mode: mode_id(number, false),
            value,
        };
        self.set(g::GHOSTTY_TERMINAL_OPT_MODE, &config);
    }

    fn string(&self, data: g::GhosttyTerminalData) -> String {
        match self.get::<g::GhosttyString>(data) {
            // SAFETY: the string is borrowed from the terminal until its next
            // mutation; it is copied out before returning.
            Some(s) if !s.ptr.is_null() => unsafe {
                String::from_utf8_lossy(std::slice::from_raw_parts(s.ptr, s.len)).into_owned()
            },
            _ => String::new(),
        }
    }

    fn alternate(&self) -> bool {
        self.get::<g::GhosttyTerminalScreen>(g::GHOSTTY_TERMINAL_DATA_ACTIVE_SCREEN)
            == Some(g::GHOSTTY_TERMINAL_SCREEN_ALTERNATE)
    }

    /// An independent copy of every screen, its history, modes and parser
    /// state, which [`Screen::restore`] may switch screens on freely.
    fn duplicate(&self) -> Option<Term> {
        let (mut data, mut len) = (ptr::null_mut(), 0usize);
        // SAFETY: out-pointers to locals; the buffer is freed below.
        let ok =
            unsafe { g::ghostty_snapshot_encode_alloc(self.0, ptr::null(), &mut data, &mut len) };
        if ok != g::GHOSTTY_SUCCESS {
            return None;
        }
        let mut decoder = ptr::null_mut();
        let mut copy = ptr::null_mut();
        // SAFETY: the decoder only borrows `data`, which outlives it here.
        let decoded = unsafe {
            let mut ok = g::ghostty_snapshot_decoder_new_buf(ptr::null(), &mut decoder, data, len);
            if ok == g::GHOSTTY_SUCCESS {
                ok = g::ghostty_snapshot_decoder_decode(decoder, &mut copy);
                g::ghostty_snapshot_decoder_free(decoder);
            }
            g::ghostty_free(ptr::null(), data, len);
            ok
        };
        (decoded == g::GHOSTTY_SUCCESS && !copy.is_null()).then_some(Term(copy))
    }

    /// The unfinished escape sequence at the end of the input, if any.
    fn continuation(&self) -> Vec<u8> {
        let (mut data, mut len) = (ptr::null_mut(), 0usize);
        // SAFETY: out-pointers to locals; the buffer is freed after the copy.
        unsafe {
            let ok =
                g::ghostty_terminal_continuation_alloc(self.0, ptr::null(), &mut data, &mut len);
            if ok != g::GHOSTTY_SUCCESS || data.is_null() {
                return Vec::new();
            }
            let bytes = std::slice::from_raw_parts(data, len).to_vec();
            g::ghostty_free(ptr::null(), data, len);
            bytes
        }
    }

    /// A reference to the cell at column `x`, row `y` of `tag`'s coordinates.
    fn grid_ref(&self, tag: g::GhosttyPointTag, x: u16, y: u32) -> Option<g::GhosttyGridRef> {
        let point = g::GhosttyPoint {
            tag,
            value: g::GhosttyPointValue {
                coordinate: g::GhosttyPointCoordinate { x, y },
            },
        };
        let mut grid_ref = g::GhosttyGridRef {
            size: std::mem::size_of::<g::GhosttyGridRef>(),
            ..Default::default()
        };
        // SAFETY: out-pointer to a local sized as the API requires.
        let ok = unsafe { g::ghostty_terminal_grid_ref(self.0, point, &mut grid_ref) };
        (ok == g::GHOSTTY_SUCCESS).then_some(grid_ref)
    }

    /// Rows `0..rows` of `tag`'s coordinate space, `cols` wide.
    fn rows_selection(
        &self,
        tag: g::GhosttyPointTag,
        cols: u16,
        rows: u32,
    ) -> Option<g::GhosttySelection> {
        Some(g::GhosttySelection {
            size: std::mem::size_of::<g::GhosttySelection>(),
            start: self.grid_ref(tag, 0, 0)?,
            end: self.grid_ref(tag, cols.checked_sub(1)?, rows.checked_sub(1)?)?,
            rectangle: false,
        })
    }

    fn format(
        &self,
        emit: g::GhosttyFormatterFormat,
        unwrap: bool,
        extra: Extra,
        selection: &g::GhosttySelection,
    ) -> Option<Vec<u8>> {
        let options = g::GhosttyFormatterTerminalOptions {
            size: std::mem::size_of::<g::GhosttyFormatterTerminalOptions>(),
            emit,
            unwrap,
            trim: true,
            extra: g::GhosttyFormatterTerminalExtra {
                size: std::mem::size_of::<g::GhosttyFormatterTerminalExtra>(),
                palette: false,
                modes: extra.modes,
                scrolling_region: extra.screen_state,
                tabstops: false,
                pwd: false,
                keyboard: extra.screen_state,
                screen: g::GhosttyFormatterScreenExtra {
                    size: std::mem::size_of::<g::GhosttyFormatterScreenExtra>(),
                    cursor: extra.screen_state,
                    style: extra.screen_state,
                    hyperlink: extra.screen_state,
                    protection: extra.screen_state,
                    kitty_keyboard: false,
                    charsets: extra.screen_state,
                },
            },
            selection,
        };
        let mut formatter = ptr::null_mut();
        // SAFETY: the selection outlives the formatter, which is freed below.
        // The output buffer is copied before it is freed.
        unsafe {
            if g::ghostty_formatter_terminal_new(ptr::null(), &mut formatter, self.0, options)
                != g::GHOSTTY_SUCCESS
            {
                return None;
            }
            let (mut data, mut len) = (ptr::null_mut(), 0usize);
            let ok = g::ghostty_formatter_format_alloc(formatter, ptr::null(), &mut data, &mut len);
            g::ghostty_formatter_free(formatter);
            if ok != g::GHOSTTY_SUCCESS {
                return None;
            }
            let bytes = if data.is_null() {
                Vec::new()
            } else {
                let bytes = std::slice::from_raw_parts(data, len).to_vec();
                g::ghostty_free(ptr::null(), data, len);
                bytes
            };
            Some(bytes)
        }
    }

    /// The kitty keyboard flags of the active screen, top of stack first,
    /// popping the stack empty as it goes: only the copy [`Screen::restore`]
    /// owns is ever probed. Entries at the bottom that are zero are
    /// indistinguishable from an empty stack and are dropped.
    fn drain_keyboard_stack(&self) -> Vec<u8> {
        let mut stack = Vec::new();
        // Ghostty's stack is a ring of eight.
        for _ in 0..8 {
            let flags = self.get::<u8>(g::GHOSTTY_TERMINAL_DATA_KITTY_KEYBOARD_FLAGS);
            stack.push(flags.unwrap_or(0));
            self.write(b"\x1b[<u");
        }
        while stack.last() == Some(&0) {
            stack.pop();
        }
        stack
    }
}

/// What a [`Term::format`] call emits besides the cells.
#[derive(Clone, Copy)]
struct Extra {
    /// Non-default terminal modes, before the cells.
    modes: bool,
    /// Scrolling region, keyboard modes, cursor, SGR style, hyperlink,
    /// protection and charsets, after the cells.
    screen_state: bool,
}

/// How many bytes at the end of `bytes` are the start of a UTF-8 character
/// whose remaining bytes haven't arrived.
fn unfinished_utf8_len(bytes: &[u8]) -> usize {
    for back in 1..=bytes.len().min(3) {
        let byte = bytes[bytes.len() - back];
        if byte & 0xc0 == 0x80 {
            continue;
        }
        let needs = match byte {
            0xc2..=0xdf => 2,
            0xe0..=0xef => 3,
            0xf0..=0xf4 => 4,
            _ => return 0,
        };
        return if back < needs { back } else { 0 };
    }
    0
}

fn mode_id(number: u16, ansi: bool) -> g::GhosttyMode {
    (number & 0x7fff) | (u16::from(ansi) << 15)
}

/// `CSI = f u` then `CSI > f u` per entry, bottom of the stack first, after a
/// reset: leaves the screen's stack and flags as `top_first` describes.
fn keyboard_stack_sequence(top_first: &[u8]) -> String {
    let mut out = String::from("\x1b[<16u");
    for (index, flags) in top_first.iter().rev().enumerate() {
        out += &format!("\x1b[{}{flags}u", if index == 0 { '=' } else { '>' });
    }
    out
}

pub struct Screen {
    term: Term,
    cols: u16,
    rows: u16,
    /// Whether any output has been processed. A screen that was never fed
    /// (a session reloaded after a daemon restart) knows nothing, and its
    /// blank repaint would erase the replayed history it should complement.
    fed: bool,
    /// The first bytes of a UTF-8 character the last read ended inside. They
    /// are kept out of the terminal, which would print a replacement
    /// character for them when a repaint cancels its unfinished input, and
    /// handed on at the end of the repaint instead, where the live stream
    /// resumes.
    held: Vec<u8>,
}

// SAFETY: the native terminal has no thread affinity; it is only unsafe to use
// from two threads at once, and every owner keeps a Screen behind a Mutex.
// Not `Sync`.
unsafe impl Send for Screen {}

impl Screen {
    pub fn new(cols: u16, rows: u16) -> Self {
        Self::with_scrollback(cols, rows, SCROLLBACK_LINES, SCROLLBACK_BYTES)
    }

    /// For readers that only follow titles or modes: no history to hold.
    pub fn without_scrollback(cols: u16, rows: u16) -> Self {
        Self::with_scrollback(cols, rows, 0, 0)
    }

    fn with_scrollback(cols: u16, rows: u16, lines: usize, bytes: usize) -> Self {
        let (cols, rows) = (cols.max(1), rows.max(1));
        let term = Term::new(cols, rows).expect("libghostty-vt could not allocate a terminal");
        term.set(g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_LINES, &lines);
        term.set(g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_BYTES, &bytes);
        term.set(
            g::GHOSTTY_TERMINAL_OPT_CONTINUATION_MAX_BYTES,
            &CONTINUATION_BYTES,
        );
        // A daemon screen never draws images, and a repaint can't carry them.
        term.set(g::GHOSTTY_TERMINAL_OPT_KITTY_IMAGE_STORAGE_LIMIT, &0u64);
        Self {
            term,
            cols,
            rows,
            fed: false,
            held: Vec::new(),
        }
    }

    pub fn process(&mut self, bytes: &[u8]) {
        self.fed |= !bytes.is_empty();
        if self.held.is_empty() {
            let cut = bytes.len() - unfinished_utf8_len(bytes);
            self.term.write(&bytes[..cut]);
            self.held.extend_from_slice(&bytes[cut..]);
        } else {
            self.held.extend_from_slice(bytes);
            let cut = self.held.len() - unfinished_utf8_len(&self.held);
            self.term.write(&self.held[..cut]);
            self.held.drain(..cut);
        }
    }

    pub fn set_size(&mut self, cols: u16, rows: u16) {
        let (cols, rows) = (cols.max(1), rows.max(1));
        // The daemon doesn't know the cell size in pixels; only terminal size
        // reports use it, and nothing answers those.
        // SAFETY: plain call on the owned handle.
        let ok = unsafe { g::ghostty_terminal_resize(self.term.0, cols, rows, 1, 1) };
        if ok == g::GHOSTTY_SUCCESS {
            (self.cols, self.rows) = (cols, rows);
        }
    }

    /// The visible rows as text: soft wraps joined, trailing blanks dropped.
    pub fn contents(&self) -> String {
        let text = self
            .term
            .rows_selection(g::GHOSTTY_POINT_TAG_ACTIVE, self.cols, u32::from(self.rows))
            .and_then(|all| {
                let no_extras = Extra {
                    modes: false,
                    screen_state: false,
                };
                self.term
                    .format(g::GHOSTTY_FORMATTER_FORMAT_PLAIN, true, no_extras, &all)
            })
            .unwrap_or_default();
        String::from_utf8_lossy(&text).trim_end().to_string()
    }

    /// `(row, column)`, zero-based, within the visible rows.
    pub fn cursor_position(&self) -> (u16, u16) {
        let row = self
            .term
            .get(g::GHOSTTY_TERMINAL_DATA_CURSOR_Y)
            .unwrap_or(0);
        let col = self
            .term
            .get(g::GHOSTTY_TERMINAL_DATA_CURSOR_X)
            .unwrap_or(0);
        (row, col)
    }

    pub fn title(&self) -> String {
        self.term.string(g::GHOSTTY_TERMINAL_DATA_TITLE)
    }

    pub fn alternate_screen(&self) -> bool {
        self.term.alternate()
    }

    /// Whether DEC private mode `number` is set (1000 mouse, 2004 bracketed
    /// paste, 1004 focus events, 7 autowrap...).
    pub fn dec_mode(&self, number: u16) -> bool {
        self.term.mode(number, false)
    }

    /// The active screen's kitty keyboard flags.
    pub fn keyboard_flags(&self) -> u8 {
        self.term
            .get(g::GHOSTTY_TERMINAL_DATA_KITTY_KEYBOARD_FLAGS)
            .unwrap_or(0)
    }

    /// Rows of history above the visible rows.
    pub fn scrollback_rows(&self) -> usize {
        self.term
            .get(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)
            .unwrap_or(0)
    }

    /// Bytes that turn any emulator of this size into this screen: its
    /// scrollback, contents, cursor, modes, both screens' keyboard stacks and
    /// a half-received escape sequence. They begin with a full reset, so
    /// whatever the emulator held before, including a replayed byte tail, is
    /// replaced rather than duplicated.
    ///
    /// Empty when there is nothing to say or it can't be said (never fed;
    /// native failure); callers then keep what they already have.
    pub fn restore(&self) -> String {
        String::from_utf8_lossy(&self.restore_bytes()).into_owned()
    }

    /// [`Self::restore`] as the bytes themselves: when the output so far ends
    /// inside a UTF-8 character, so do they, ready for the rest of it.
    pub fn restore_bytes(&self) -> Vec<u8> {
        if !self.fed {
            return Vec::new();
        }
        self.try_restore().unwrap_or_default()
    }

    fn try_restore(&self) -> Option<Vec<u8>> {
        // The formatter only reads the active screen, and switching screens
        // on the live terminal would change it (the cursor is copied, 1049
        // clears). Work on a copy.
        let copy = self.term.duplicate()?;
        // The copy is mid-sequence exactly where this terminal is; finish it
        // so the sequences written below parse cleanly.
        copy.write(b"\x18");
        let (cols, rows) = (self.cols, self.rows);
        let autowrap = copy.mode(7, false);
        // Rows are emitted for an emulator that wraps; the real setting is
        // restored after them.
        copy.set_mode_bit(7, true);

        let mut out = b"\x1bc".to_vec();
        let title: String = self.title().chars().filter(|c| !c.is_control()).collect();
        if !title.is_empty() {
            out.extend(format!("\x1b]2;{title}\x1b\\").bytes());
        }

        let alternate = copy.alternate();
        let mut alternate_part = Vec::new();
        let mut alternate_keys = Vec::new();
        if alternate {
            // The alternate is entered after the primary is painted: 1049
            // saves the primary's cursor, clears the alternate and keeps the
            // cursor and style, which the rows below don't expect.
            alternate_part = b"\x1b[?1049h\x1b[0m\x1b[H".to_vec();
            alternate_part.extend(paint_active(&copy, cols, rows, false)?);
            alternate_keys = copy.drain_keyboard_stack();
            // Back to the primary screen, whichever of the three alternate
            // screen modes entered the alternate; 1049 also restores the
            // cursor from where the primary was left.
            copy.write(b"\x1b[?1049l");
            copy.set_mode_bit(47, false);
            copy.set_mode_bit(1047, false);
        }

        // History first, then the visible rows aligned to the emulator's own.
        let history = copy.get::<usize>(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)?;
        if history > 0 {
            let selection =
                copy.rows_selection(g::GHOSTTY_POINT_TAG_SCREEN, cols, history as u32)?;
            let no_extras = Extra {
                modes: false,
                screen_state: false,
            };
            let text = copy.format(g::GHOSTTY_FORMATTER_FORMAT_VT, false, no_extras, &selection)?;
            // Blank rows format to nothing, so count the line feeds present
            // and add the rest: one per history row, and the visible rows'
            // worth to push the history above them.
            let present = text.iter().filter(|&&b| b == b'\n').count();
            out.extend(text);
            out.extend(b"\x1b[0m");
            for _ in 0..(history - present.min(history)) + usize::from(rows) - 1 {
                out.extend(b"\r\n");
            }
            out.extend(b"\x1b[H");
        }
        out.extend(paint_active(&copy, cols, rows, true)?);
        out.extend(keyboard_stack_sequence(&copy.drain_keyboard_stack()).bytes());
        if alternate {
            out.extend(alternate_part);
            out.extend(keyboard_stack_sequence(&alternate_keys).bytes());
        }
        if !autowrap {
            out.extend(b"\x1b[?7l");
        }
        // The live stream resumes inside this sequence or character if one
        // is open.
        out.extend(self.term.continuation());
        out.extend(&self.held);
        Some(out)
    }
}

/// The visible rows of the active screen with the state that follows them.
fn paint_active(term: &Term, cols: u16, rows: u16, modes: bool) -> Option<Vec<u8>> {
    let selection = term.rows_selection(g::GHOSTTY_POINT_TAG_ACTIVE, cols, u32::from(rows))?;
    let extra = Extra {
        modes,
        screen_state: true,
    };
    term.format(g::GHOSTTY_FORMATTER_FORMAT_VT, false, extra, &selection)
}

#[cfg(test)]
impl Screen {
    /// Everything the screen holds, history first, as plain text.
    fn transcript(&self) -> String {
        let total = self.scrollback_rows() as u32 + u32::from(self.rows);
        let all = self
            .term
            .rows_selection(g::GHOSTTY_POINT_TAG_SCREEN, self.cols, total)
            .unwrap();
        let none = Extra {
            modes: false,
            screen_state: false,
        };
        let text = self
            .term
            .format(g::GHOSTTY_FORMATTER_FORMAT_PLAIN, false, none, &all)
            .unwrap();
        String::from_utf8(text).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fed(cols: u16, rows: u16, bytes: &[u8]) -> Screen {
        let mut screen = Screen::new(cols, rows);
        screen.process(bytes);
        screen
    }

    /// What a client gets on attach: a fresh emulator fed the repaint.
    fn reattached(source: &Screen) -> Screen {
        fed(source.cols, source.rows, &source.restore_bytes())
    }

    /// The reattached screen is the source in everything a user or an app
    /// can observe, and asking it to repaint again says the same thing.
    fn assert_same(source: &Screen, view: &Screen) {
        assert!(!source.restore_bytes().is_empty());
        assert_eq!(view.transcript(), source.transcript());
        assert_eq!(view.cursor_position(), source.cursor_position());
        assert_eq!(view.alternate_screen(), source.alternate_screen());
        assert_eq!(view.scrollback_rows(), source.scrollback_rows());
        assert_eq!(view.title(), source.title());
        assert_eq!(view.restore_bytes(), source.restore_bytes());
    }

    #[test]
    fn restore_clears_stale_input_modes_and_alternate_screen() {
        let mut view = Screen::new(80, 24);
        view.process(b"\x1b[?1049h\x1b[?1003h\x1b[?1006h\x1b[?1004h\x1b[>31u\x1b[?7l");
        let shell = fed(80, 24, b"shell prompt");
        view.process(shell.restore().as_bytes());
        assert!(!view.alternate_screen());
        for mode in [9, 1000, 1002, 1003, 1005, 1006, 1016, 1004] {
            assert!(!view.dec_mode(mode), "mode {mode} left set");
        }
        assert!(view.dec_mode(7), "autowrap left off");
        assert_eq!(view.keyboard_flags(), 0);
        assert!(view.contents().starts_with("shell prompt"));
        // The alternate screen's keyboard flags were stale too.
        view.process(b"\x1b[?1049h");
        assert_eq!(view.keyboard_flags(), 0);
    }

    #[test]
    fn restore_keeps_keyboard_stacks_for_later_pops() {
        let mut source = Screen::new(80, 24);
        source.process(b"\x1b[>1u\x1b[>3u\x1b[?1049h\x1b[>5u\x1b[>7u");
        let mut view = Screen::new(80, 24);
        view.process(b"\x1b[>31u\x1b[?1049h\x1b[>31u");
        // A daemon repaint can be replayed and repainted again by the core.
        for _ in 0..2 {
            view.process(source.restore().as_bytes());
            assert_eq!(view.keyboard_flags(), source.keyboard_flags());
        }
        for bytes in [
            b"\x1b[<u".as_slice(),
            b"\x1b[?1049l",
            b"\x1b[<u",
            b"\x1b[<u",
            b"\x1b[<u",
        ] {
            source.process(bytes);
            view.process(bytes);
            assert_eq!(view.keyboard_flags(), source.keyboard_flags(), "{bytes:?}");
        }
    }

    #[test]
    fn mode_tracking_is_independent_of_read_boundaries() {
        let bytes = b"\x1b[?7;1004h\x1b[>1u\x1b[?1049h\x1b[>3u\x1b[=4;2u";
        let mut whole = Screen::new(80, 24);
        whole.process(bytes);
        assert!(whole.dec_mode(1004));
        assert_eq!(whole.keyboard_flags(), 7);
        for split in 0..=bytes.len() {
            let mut split_view = Screen::new(80, 24);
            split_view.process(&bytes[..split]);
            split_view.process(&bytes[split..]);
            assert_eq!(split_view.restore(), whole.restore(), "split at {split}");
        }
        whole.process(b"\x1b[?1049l");
        assert_eq!(whole.keyboard_flags(), 1);
    }

    #[test]
    fn a_tui_attached_long_after_it_painted_repaints_exactly() {
        let mut source = fed(
            100,
            30,
            b"\x1b[?1049h\x1b[?25l\x1b[1;1H\x1b[1;44mHEADER\x1b[0m\x1b[20;1H> prompt\x1b[5;10H\x1b[38;5;203mred\x1b[0m",
        );
        for tick in 0..20_000 {
            source.process(format!("\x1b[30;1H\x1b[2Kstatus {tick}").as_bytes());
        }
        let view = reattached(&source);
        assert!(view.alternate_screen());
        let screen = view.contents();
        assert!(screen.starts_with("HEADER"), "{screen}");
        assert!(screen.contains("> prompt") && screen.contains("status 19999"));
        assert_same(&source, &view);
    }

    #[test]
    fn scrollback_beyond_one_screen_survives_restore() {
        let mut source = Screen::new(80, 24);
        for line in 0..500 {
            source.process(format!("line {line} \x1b[3{}mcolour\x1b[0m\r\n", line % 8).as_bytes());
        }
        source.process(b"$ ");
        assert!(source.scrollback_rows() > 400);
        let view = reattached(&source);
        assert!(view.transcript().starts_with("line 0 colour\n"));
        assert!(view.transcript().contains("line 250 colour\n"));
        assert_same(&source, &view);
    }

    #[test]
    fn mouse_and_paste_modes_survive_reattach() {
        let source = fed(
            100,
            30,
            b"\x1b[?1049h\x1b[?1000h\x1b[?1006h\x1b[?2004h\x1b[?1004h\x1b[?1h\x1b[?25l",
        );
        let view = reattached(&source);
        for mode in [1000, 1006, 2004, 1004, 1, 1049] {
            assert!(view.dec_mode(mode), "mode {mode} lost");
        }
        assert!(!view.dec_mode(1003));
        assert!(!view.dec_mode(25));
        assert_same(&source, &view);
    }

    #[test]
    fn autowrap_off_applies_after_wrapped_history() {
        // Lines wrap while autowrap is on, then an app turns it off. The
        // wrapped rows must come back as they were, and the setting too.
        let mut source = Screen::new(20, 5);
        source.process("x".repeat(70).as_bytes());
        source.process(b"\r\n\xe4\xb8\x96\xe7\x95\x8c\xe4\xb8\x96\xe7\x95\x8c\xe4\xb8\x96\xe7\x95\x8c\xe4\xb8\x96\xe7\x95\x8c\xe4\xb8\x96\xe7\x95\x8c\xe4\xb8\x96\r\nend\x1b[?7l");
        let view = reattached(&source);
        assert!(!view.dec_mode(7));
        assert!(source.restore().ends_with("\x1b[?7l"));
        assert_same(&source, &view);
    }

    #[test]
    fn blank_rows_below_the_cursor_keep_the_viewport_aligned() {
        // Ctrl-L in a shell: lots of history, a prompt on the first row.
        let mut source = Screen::new(80, 24);
        for line in 0..100 {
            source.process(format!("old {line}\r\n").as_bytes());
        }
        source.process(b"\x1b[H\x1b[2Jprompt $ ");
        let view = reattached(&source);
        assert_eq!(view.cursor_position(), source.cursor_position());
        assert!(view.contents().starts_with("prompt $"));
        assert_same(&source, &view);
    }

    #[test]
    fn an_escape_sequence_split_by_the_attach_point_completes_after_it() {
        let mut source = fed(80, 24, b"before \x1b[3");
        let mut view = reattached(&source);
        for screen in [&mut source, &mut view] {
            screen.process(b"1mred\x1b[0m after");
        }
        assert_eq!(view.contents(), "before red after");
        assert_same(&source, &view);
    }

    #[test]
    fn titles_and_pending_wrap_survive() {
        let source = fed(10, 3, b"\x1b]2;my title\x07abcdefghij");
        let view = reattached(&source);
        assert_eq!(view.title(), "my title");
        assert_same(&source, &view);
    }

    #[test]
    fn an_unfed_screen_has_nothing_to_restore() {
        assert_eq!(Screen::new(80, 24).restore(), "");
    }

    #[test]
    fn scrollback_is_capped_in_lines() {
        let mut source = Screen::new(80, 24);
        for line in 0..30_000 {
            source.process(format!("line {line}\r\n").as_bytes());
        }
        let kept = source.scrollback_rows();
        // Ghostty prunes whole pages, so the retained history lands within a
        // page of the limit, not exactly on it.
        assert!((9_500..10_500).contains(&kept), "{kept} rows kept");
        assert!(source.transcript().contains("line 29999"));
        assert!(!source.transcript().contains("line 100\n"));
    }

    #[test]
    fn scrollback_is_capped_in_bytes_when_rows_are_heavy() {
        // 500 columns of styled text cost far more than the average row.
        let mut source = Screen::new(500, 24);
        for line in 0..10_000 {
            let styled: String = (0..250)
                .map(|cell| format!("\x1b[3{}mx", (cell + line) % 8))
                .collect();
            source.process(format!("{styled}\x1b[0m\r\n").as_bytes());
        }
        let kept = source.scrollback_rows();
        assert!(
            kept < 9_000,
            "{kept} heavy rows kept; the byte cap did not apply"
        );
        assert!(kept > 100);
    }

    #[test]
    fn resizing_keeps_history_and_the_repaint_matches() {
        let mut source = Screen::new(80, 24);
        for line in 0..200 {
            source.process(format!("row {line}\r\n").as_bytes());
        }
        source.set_size(100, 30);
        let view = reattached(&source);
        assert_same(&source, &view);
    }

    #[test]
    fn a_character_split_by_the_attach_point_completes_after_it() {
        for prefix in [&b""[..], b"\x1b[?1049h"] {
            let mut start = prefix.to_vec();
            start.extend(b"before \xe4\xb8");
            let mut source = fed(80, 24, &start);
            let mut view = reattached(&source);
            for screen in [&mut source, &mut view] {
                screen.process(b"\x96 after");
            }
            assert_eq!(view.contents(), "before \u{4e16} after");
            assert_same(&source, &view);
        }
    }

    #[test]
    fn a_sequence_longer_than_the_continuation_limit_does_not_end_repaints() {
        let mut source = fed(80, 24, b"hello\x1b]0;");
        source.process(&vec![b'x'; CONTINUATION_BYTES + 1024]);
        // Whether or not it can be repainted now, it must not panic.
        let _ = source.restore();
        source.process(b"\x07 after");
        let view = reattached(&source);
        assert!(!source.restore_bytes().is_empty());
        assert_same(&source, &view);
    }

    #[test]
    fn output_is_the_same_wherever_a_read_ends_inside_a_character() {
        let bytes = "a\u{e9}\u{4e16}\u{1f600}b".as_bytes();
        let mut whole = fed(20, 3, bytes);
        for split in 0..=bytes.len() {
            let mut halves = Screen::new(20, 3);
            halves.process(&bytes[..split]);
            halves.process(&bytes[split..]);
            assert_eq!(halves.contents(), whole.contents(), "split at {split}");
            assert_eq!(halves.restore_bytes(), whole.restore_bytes());
        }
        whole.process(b"\xe4");
        whole.process(b"\xb8\x96");
        assert!(whole.contents().ends_with('\u{4e16}'));
    }
}
