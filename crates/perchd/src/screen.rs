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
//!
//! # The repaint
//!
//! [`Screen::restore_bytes_within`] starts with a full reset, so whatever the
//! client held, a replayed byte tail included, is replaced and not duplicated.
//! It carries, in order: the title, the newest scrollback rows, the visible
//! rows, cursor, style and modes, the keyboard stack of each screen, the
//! alternate screen if it is active, and the start of a half-received escape
//! sequence or character.
//!
//! - **Wraps.** Soft-wrapped lines are written as one line, so a client that
//!   wraps at the same width records the wrap and reflows it on a resize. The
//!   join is checked: the result is replayed into a scratch emulator, and if
//!   any row would move (an erase can leave a wrap flag over a blank row) the
//!   repaint is made again with one line per row, which has no wraps and every
//!   row in place.
//! - **Size.** The scrollback goes in whole rows, newest first, as many as fit
//!   the caller's limit; the bytes themselves are never cut. The visible rows,
//!   modes and a pending sequence are not trimmed (see the `ponytail:` note on
//!   the method).
//! - **Keyboard stacks.** Ghostty keeps eight entries per screen (a program
//!   using the kitty keyboard protocol pushes one or two). A stack left on the
//!   screen that is not active is restored too.
//! - **Alternate screen.** The repaint enters it with 1049, whichever of 47,
//!   1047 or 1049 the app used. 47 and 1047 share one cursor between the
//!   screens, so the primary cursor is overwritten whichever of them leaves;
//!   the one place the difference could show, a 1049 exit after a 47 or 1047
//!   entry, reads the saved cursor in the source and the view alike.
//! - **Images.** Kitty graphics storage is off: a repaint can't carry an image
//!   and holding the pixels would only cost memory. Images do not survive a
//!   reattach. Enabling it would mean bounding the storage and re-transmitting
//!   every live placement into the repaint; not worth it for terminal UIs that
//!   redraw their images when asked.
//!
//! # Who still needs a byte tail
//!
//! A fed screen's repaint replaces the tail on the client. The daemon sends
//! the tail first anyway for a live session, and the core keeps one:
//!
//! - The daemon's screen is empty for a session reloaded after a daemon
//!   restart that has not produced output since; its repaint is empty and the
//!   retained log is all there is to replay.
//! - Every reattached core feeds the stream to observers that read output
//!   rather than a picture (status detection, titles); the tail is how they
//!   catch up. They also use `since` to resume with no repaint at all.
//! - A repaint is empty when the engine fails to copy the screen; the tail is
//!   what a client has left.
//!
//! The daemon does not send the tail of an exited session that has a repaint:
//! nothing observes its output, and a client ends such an attach once its seq
//! reaches the stream's end, which the tail alone does, before the repaint
//! behind it is read. perch-core's `TerminalReplay`, which serves views (not
//! observers), does not send its tail with a repaint, only when there is
//! none.

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

    /// `count` rows of `tag`'s coordinate space from row `first`, `cols` wide.
    fn rows_selection(
        &self,
        tag: g::GhosttyPointTag,
        cols: u16,
        first: u32,
        count: u32,
    ) -> Option<g::GhosttySelection> {
        Some(g::GhosttySelection {
            size: std::mem::size_of::<g::GhosttySelection>(),
            start: self.grid_ref(tag, 0, first)?,
            end: self.grid_ref(tag, cols.checked_sub(1)?, first + count.checked_sub(1)?)?,
            rectangle: false,
        })
    }

    /// Whether row `y` of `tag`'s coordinates continues the line above it:
    /// the row above ended in a soft wrap.
    fn continues_line_above(&self, tag: g::GhosttyPointTag, y: u32) -> bool {
        let Some(grid_ref) = self.grid_ref(tag, 0, y) else {
            return false;
        };
        let (mut row, mut continues) = (0, false);
        // SAFETY: the ref was just produced by this terminal; the row key
        // writes a bool.
        unsafe {
            g::ghostty_grid_ref_row(&grid_ref, &mut row) == g::GHOSTTY_SUCCESS
                && g::ghostty_row_get(
                    row,
                    g::GHOSTTY_ROW_DATA_WRAP_CONTINUATION,
                    (&mut continues as *mut bool).cast(),
                ) == g::GHOSTTY_SUCCESS
                && continues
        }
    }

    /// The text of `count` rows of `tag`'s coordinates from row `first`,
    /// one line per row, trailing blanks and blank rows at the end dropped.
    fn rows_text(
        &self,
        tag: g::GhosttyPointTag,
        cols: u16,
        first: u32,
        count: u32,
    ) -> Option<String> {
        let selection = self.rows_selection(tag, cols, first, count)?;
        let layout = Layout {
            unwrap: false,
            trim: true,
        };
        let text = self.format(
            g::GHOSTTY_FORMATTER_FORMAT_PLAIN,
            layout,
            NO_EXTRAS,
            &selection,
        )?;
        Some(String::from_utf8_lossy(&text).into_owned())
    }

    fn format(
        &self,
        emit: g::GhosttyFormatterFormat,
        layout: Layout,
        extra: Extra,
        selection: &g::GhosttySelection,
    ) -> Option<Vec<u8>> {
        let options = g::GhosttyFormatterTerminalOptions {
            size: std::mem::size_of::<g::GhosttyFormatterTerminalOptions>(),
            emit,
            unwrap: layout.unwrap,
            trim: layout.trim,
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

/// How a [`Term::format`] call lays out rows.
#[derive(Clone, Copy)]
struct Layout {
    /// Join soft-wrapped rows into one line instead of ending each with a line
    /// break, so an emulator that wraps at the same width records the wrap.
    unwrap: bool,
    /// Drop trailing blanks, spaces included. A space that wrapped onto a row
    /// of its own is a row; trimming it would lose the row.
    trim: bool,
}

/// What a person reads: wraps joined, trailing blanks gone.
const READABLE: Layout = Layout {
    unwrap: true,
    trim: true,
};
/// The repaint's first choice: wraps joined, every printed cell kept.
const JOINED: Layout = Layout {
    unwrap: true,
    trim: false,
};
/// The repaint's fallback: one line per row, which keeps every row where it
/// is but records no wraps.
const ONE_LINE_PER_ROW: Layout = Layout {
    unwrap: false,
    trim: true,
};

/// What a [`Term::format`] call emits besides the cells.
#[derive(Clone, Copy)]
struct Extra {
    /// Non-default terminal modes, before the cells.
    modes: bool,
    /// Scrolling region, keyboard modes, cursor, SGR style, hyperlink,
    /// protection and charsets, after the cells.
    screen_state: bool,
}

const NO_EXTRAS: Extra = Extra {
    modes: false,
    screen_state: false,
};

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
        term.set_mode_bit(2027, true);
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
            .rows_selection(
                g::GHOSTTY_POINT_TAG_ACTIVE,
                self.cols,
                0,
                u32::from(self.rows),
            )
            .and_then(|all| {
                self.term
                    .format(g::GHOSTTY_FORMATTER_FORMAT_PLAIN, READABLE, NO_EXTRAS, &all)
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
    /// replaced rather than duplicated. Soft-wrapped lines come out joined,
    /// so an emulator of the same width records the wraps and can reflow
    /// them on a resize.
    ///
    /// Empty when there is nothing to say or it can't be said (never fed;
    /// native failure); callers then keep what they already have.
    pub fn restore(&self) -> String {
        String::from_utf8_lossy(&self.restore_bytes()).into_owned()
    }

    /// [`Self::restore`] as the bytes themselves: when the output so far ends
    /// inside a UTF-8 character, so do they, ready for the rest of it.
    pub fn restore_bytes(&self) -> Vec<u8> {
        self.restore_bytes_within(usize::MAX)
    }

    /// [`Self::restore_bytes`] in at most `max_bytes`, by carrying fewer of
    /// the oldest scrollback rows, never by cutting the bytes: what comes out
    /// is always a whole repaint.
    ///
    /// ponytail: the visible rows, modes and a pending escape sequence are
    /// never trimmed, so a screen whose visible part alone is over the limit
    /// (hundreds of styled columns by hundreds of rows) repaints past it.
    /// The caller's transport has to carry that, or the limit has to be
    /// raised past the largest screen a client can have.
    pub fn restore_bytes_within(&self, max_bytes: usize) -> Vec<u8> {
        if !self.fed {
            return Vec::new();
        }
        self.try_restore(max_bytes).unwrap_or_default()
    }

    fn try_restore(&self, max_bytes: usize) -> Option<Vec<u8>> {
        // Joining soft-wrapped rows into one line is only safe while every
        // row survives it. Erases can leave a wrap flag over a row that is
        // blank or short, and the joined text then loses or shifts a row.
        // The rows come back from replaying the result, so a repaint that
        // does not reproduce them is made again with one line per row.
        self.repaint(max_bytes, JOINED)
            .flatten()
            .or_else(|| self.repaint(max_bytes, ONE_LINE_PER_ROW).flatten())
    }

    /// `None` if the engine failed; `Some(None)` if the repaint, replayed,
    /// does not reproduce the rows (only checked when `layout` joins rows).
    fn repaint(&self, max_bytes: usize, layout: Layout) -> Option<Option<Vec<u8>>> {
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

        let mut head = b"\x1bc".to_vec();
        let title: String = self.title().chars().filter(|c| !c.is_control()).collect();
        if !title.is_empty() {
            head.extend(format!("\x1b]2;{title}\x1b\\").bytes());
        }

        let alternate = copy.alternate();
        let mut alternate_part = Vec::new();
        let mut alternate_keys = Vec::new();
        let mut alternate_rows = String::new();
        if alternate {
            // The alternate is entered after the primary is painted: 1049
            // saves the primary's cursor, clears the alternate and keeps the
            // cursor and style, which the rows below don't expect.
            alternate_part = b"\x1b[?1049h\x1b[0m\x1b[H".to_vec();
            alternate_part.extend(paint_active(&copy, cols, rows, false, layout)?);
            alternate_keys = copy.drain_keyboard_stack();
            alternate_rows = copy.rows_text(g::GHOSTTY_POINT_TAG_ACTIVE, cols, 0, rows.into())?;
            // Back to the primary screen, whichever of the three alternate
            // screen modes entered the alternate; 1049 also restores the
            // cursor from where the primary was left.
            copy.write(b"\x1b[?1049l");
            copy.set_mode_bit(47, false);
            copy.set_mode_bit(1047, false);
        }

        // After the history: the visible rows (the emulator's own rows line
        // up with them), then everything that follows from them.
        let history = copy.get::<usize>(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)?;
        let visible = paint_active(&copy, cols, rows, true, layout)?;
        let mut rest = visible.clone();
        rest.extend(keyboard_stack_sequence(&copy.drain_keyboard_stack()).bytes());
        if alternate {
            rest.extend(&alternate_part);
            rest.extend(keyboard_stack_sequence(&alternate_keys).bytes());
        } else {
            // An alternate screen left behind keeps its keyboard stack (a
            // program that crashed without popping), and the next program to
            // enter it finds the stack. 47 doesn't clear the screen, and
            // the cursor goes there and back unchanged.
            copy.write(b"\x1b[?47h");
            let left_behind = copy.drain_keyboard_stack();
            copy.write(b"\x1b[?47l");
            if !left_behind.is_empty() {
                rest.extend(b"\x1b[?47h");
                rest.extend(keyboard_stack_sequence(&left_behind).bytes());
                rest.extend(b"\x1b[?47l");
            }
        }
        if !autowrap {
            rest.extend(b"\x1b[?7l");
        }
        // The live stream resumes inside this sequence or character if one
        // is open.
        rest.extend(self.term.continuation());
        rest.extend(&self.held);

        let fixed = head.len() + rest.len();
        let mut keep = history;
        let mut scrollback = paint_history(&copy, cols, rows, history, keep, layout)?;
        // Output grows with the rows kept, nearly in proportion: aim a
        // little under the limit and measure again.
        for _ in 0..6 {
            if keep == 0 || fixed.saturating_add(scrollback.len()) <= max_bytes {
                break;
            }
            let budget = max_bytes.saturating_sub(fixed) as u128;
            let smaller = (keep as u128 * budget * 9 / 10 / scrollback.len() as u128) as usize;
            keep = smaller.min(keep - 1);
            scrollback = paint_history(&copy, cols, rows, history, keep, layout)?;
        }
        if fixed.saturating_add(scrollback.len()) > max_bytes {
            keep = 0;
            scrollback.clear();
        }

        if layout.unwrap {
            let first = (history - keep) as u32;
            let expected = copy.rows_text(
                g::GHOSTTY_POINT_TAG_SCREEN,
                cols,
                first,
                keep as u32 + rows as u32,
            )?;
            let mut shown = head.clone();
            shown.extend(&scrollback);
            shown.extend(&visible);
            let alternate_shown = alternate.then_some((&alternate_part, &alternate_rows));
            if !replays_as(&shown, cols, rows, keep, &expected, alternate_shown) {
                return Some(None);
            }
        }

        let mut out = head;
        out.extend(scrollback);
        out.extend(rest);
        Some(Some(out))
    }
}

/// Whether feeding `bytes` to a fresh emulator leaves `keep` scrollback rows
/// and the visible rows reading `expected`, and, with an alternate screen,
/// leaves it reading `alternate_rows` after `alternate_part`.
fn replays_as(
    bytes: &[u8],
    cols: u16,
    rows: u16,
    keep: usize,
    expected: &str,
    alternate: Option<(&Vec<u8>, &String)>,
) -> bool {
    let reads = |bytes: &[u8], kept: usize, tag, first, count: u32, expected: &str| {
        let Some(view) = Term::new(cols, rows) else {
            return false;
        };
        view.set(g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_LINES, &(kept + 1));
        view.set(
            g::GHOSTTY_TERMINAL_OPT_SCROLLBACK_MAX_BYTES,
            &(SCROLLBACK_BYTES * 8),
        );
        view.write(bytes);
        view.rows_text(tag, cols, first, count).as_deref() == Some(expected)
    };
    let screen = g::GHOSTTY_POINT_TAG_SCREEN;
    reads(
        bytes,
        keep,
        screen,
        0,
        (keep + usize::from(rows)) as u32,
        expected,
    ) && alternate.is_none_or(|(part, rows_text)| {
        reads(
            part,
            0,
            g::GHOSTTY_POINT_TAG_ACTIVE,
            0,
            u32::from(rows),
            rows_text,
        )
    })
}

/// The newest `keep` of `history` scrollback rows, as bytes that leave them
/// above the visible rows of an emulator of this size.
fn paint_history(
    term: &Term,
    cols: u16,
    rows: u16,
    history: usize,
    keep: usize,
    layout: Layout,
) -> Option<Vec<u8>> {
    if keep == 0 {
        return Some(Vec::new());
    }
    let (history, keep) = (history as u32, keep as u32);
    // The line the last scrollback row ends may carry on into the visible
    // rows. Those are printed here too, joined to it, so the wrap is
    // recorded; the visible rows are painted again over them afterwards.
    let mut joined = 0;
    while layout.unwrap
        && joined < u32::from(rows)
        && term.continues_line_above(g::GHOSTTY_POINT_TAG_ACTIVE, joined)
    {
        joined += 1;
    }
    let selection = term.rows_selection(
        g::GHOSTTY_POINT_TAG_SCREEN,
        cols,
        history - keep,
        keep + joined,
    )?;
    let vt = g::GHOSTTY_FORMATTER_FORMAT_VT;
    let mut out = term.format(vt, layout, NO_EXTRAS, &selection)?;
    // Blank rows format to nothing, so the row the cursor stops on is not
    // known from the text: count it with one line per row, where it is the
    // number of line feeds. Then feed it down to the bottom of the screen
    // that history plus the visible rows fill, which pushes the history
    // above the visible rows.
    let per_row = Layout {
        unwrap: false,
        ..layout
    };
    let last_row = term
        .format(vt, per_row, NO_EXTRAS, &selection)?
        .iter()
        .filter(|&&b| b == b'\n')
        .count() as u32;
    out.extend(b"\x1b[0m");
    for _ in 0..(keep + u32::from(rows) - 1).saturating_sub(last_row) {
        out.extend(b"\r\n");
    }
    out.extend(b"\x1b[H");
    Some(out)
}

/// The visible rows of the active screen with the state that follows them.
fn paint_active(term: &Term, cols: u16, rows: u16, modes: bool, layout: Layout) -> Option<Vec<u8>> {
    let selection = term.rows_selection(g::GHOSTTY_POINT_TAG_ACTIVE, cols, 0, u32::from(rows))?;
    let extra = Extra {
        modes,
        screen_state: true,
    };
    term.format(g::GHOSTTY_FORMATTER_FORMAT_VT, layout, extra, &selection)
}

#[cfg(test)]
impl Screen {
    /// Everything the screen holds, history first, as plain text.
    fn transcript(&self) -> String {
        let total = self.scrollback_rows() as u32 + u32::from(self.rows);
        let all = self
            .term
            .rows_selection(g::GHOSTTY_POINT_TAG_SCREEN, self.cols, 0, total)
            .unwrap();
        let rows = Layout {
            unwrap: false,
            trim: true,
        };
        let text = self
            .term
            .format(g::GHOSTTY_FORMATTER_FORMAT_PLAIN, rows, NO_EXTRAS, &all)
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

    #[test]
    fn a_symbol_with_vs16_is_two_cells_from_the_start() {
        let screen = fed(10, 2, "\u{270d}\u{fe0f}x".as_bytes());
        assert!(screen.dec_mode(2027));
        assert_eq!(screen.cursor_position(), (0, 3));
        // The repaint carries the mode, so a client that reads it parses as this screen did.
        assert_same(&screen, &reattached(&screen));
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
        assert_eq!(
            String::from_utf8_lossy(&view.restore_bytes()),
            String::from_utf8_lossy(&source.restore_bytes())
        );
    }

    /// Per row of scrollback and screen: (soft-wrapped, continues the row above).
    fn wrap_flags(screen: &Screen) -> Vec<(bool, bool)> {
        let total = screen.scrollback_rows() as u32 + u32::from(screen.rows);
        let flag = |row, key| {
            let mut value = false;
            // SAFETY: the row key writes a bool.
            unsafe { g::ghostty_row_get(row, key, (&mut value as *mut bool).cast()) };
            value
        };
        (0..total)
            .map(|y| {
                let grid_ref = screen
                    .term
                    .grid_ref(g::GHOSTTY_POINT_TAG_SCREEN, 0, y)
                    .unwrap();
                let mut row = 0;
                // SAFETY: the ref was just produced by this terminal.
                unsafe { g::ghostty_grid_ref_row(&grid_ref, &mut row) };
                (
                    flag(row, g::GHOSTTY_ROW_DATA_WRAP),
                    flag(row, g::GHOSTTY_ROW_DATA_WRAP_CONTINUATION),
                )
            })
            .collect()
    }

    /// Resizing both wider joins a soft-wrapped line back into one only when
    /// the wrap was recorded, so the transcripts agree only if the view kept it.
    fn assert_same_after_widening(source: &mut Screen, view: &mut Screen) {
        let (cols, rows) = (source.cols + 100, source.rows);
        source.set_size(cols, rows);
        view.set_size(cols, rows);
        assert_eq!(view.transcript(), source.transcript());
        assert_eq!(view.cursor_position(), source.cursor_position());
    }

    #[test]
    fn soft_wrapped_lines_rejoin_when_the_view_widens() {
        let mut source = Screen::new(20, 5);
        let long: String = (0..70).map(|i| char::from(b'a' + (i % 26) as u8)).collect();
        // The first line wraps into scrollback, the rest on the visible rows.
        source.process(format!("{long}\r\n").as_bytes());
        for line in 0..6 {
            source.process(format!("{line}\r\n").as_bytes());
        }
        source.process(format!("\x1b[31m{long}\x1b[0m\r\nend").as_bytes());
        assert!(source.scrollback_rows() >= 4);
        let mut view = reattached(&source);
        assert!(view.transcript().contains(&long[..20]));
        assert_same_after_widening(&mut source, &mut view);
        assert!(view.transcript().contains(&long), "{}", view.transcript());
        assert!(view.contents().contains(&long));
    }

    #[test]
    fn a_line_wrapping_across_the_scrollback_boundary_stays_one_line() {
        // The long line starts in scrollback and ends on the first visible rows.
        let mut source = Screen::new(10, 4);
        source.process(b"top\r\n");
        source.process("0123456789".repeat(5).as_bytes());
        source.process(b"\r\nb\r\nc\r\nd");
        let history = source.scrollback_rows();
        assert!(
            source.contents().starts_with("789") || history >= 3,
            "{history}"
        );
        let mut view = reattached(&source);
        assert_same(&source, &view);
        assert_same_after_widening(&mut source, &mut view);
        let transcript = view.transcript();
        assert!(transcript.contains(&"0123456789".repeat(5)), "{transcript}");
    }

    /// Whether the repaint of `source` joins its soft-wrapped rows (it falls
    /// back to one line per row when joining would move a row).
    fn keeps_wraps(source: &Screen) -> bool {
        source
            .repaint(usize::MAX, JOINED)
            .is_some_and(|joined| joined.is_some())
    }

    /// Reattached, the source's rows are where they were. With `reflows`,
    /// widening joins the wraps the repaint kept as it does for the source;
    /// that is not asked of a source that is not what an app draws, such as
    /// a wrap flag left over a blank row.
    fn assert_rows_and_wraps(source: &mut Screen, reflows: bool) -> bool {
        let mut view = reattached(source);
        assert_same(source, &view);
        let joined = keeps_wraps(source);
        if joined && reflows {
            assert_eq!(wrap_flags(&view), wrap_flags(source));
            assert_same_after_widening(source, &mut view);
        }
        joined
    }

    #[test]
    fn wraps_survive_the_cases_that_make_rows_ambiguous() {
        // (output, whether its wraps are expected to survive and reflow)
        let cases: [(&[u8], bool); 8] = [
            // A space that wrapped onto a row of its own.
            (b"xxxxxxxxxx yy\r\nafter\r\nmore", true),
            // The same space as the last thing printed.
            (b"xxxxxxxxxx ", true),
            // The continuation row erased; the wrap flag may remain over a
            // blank row, which joining would drop.
            (b"xxxxxxxxxxyyyy\x1b[2K\r\nafter", false),
            // The last cell of the wrapped row erased.
            (b"xxxxxxxxxxyyyy\x1b[1;10H\x1b[X\x1b[2;1Hafter", false),
            // A wide character that didn't fit leaves a gap and wraps.
            (b"123456789\xe4\xb8\x96abc\r\nafter", true),
            // A full row ended by a line feed is not a wrap.
            (b"xxxxxxxxxx\r\nyyyy\r\nzzzzzzzzzz\r\nw", true),
            // Styled blanks (background colour) after a wrapped row.
            (b"xxxxxxxxxx\x1b[44m   \x1b[0m\r\nafter", true),
            // Blank lines among wrapped ones.
            (
                b"\r\nxxxxxxxxxxyyyyyyyyyyz\r\n\r\n\r\nxxxxxxxxxxyyyy\r\n",
                true,
            ),
        ];
        for (index, (case, expect_wraps)) in cases.iter().enumerate() {
            for lead in [0, 12] {
                // `lead` lines of history push the case into scrollback.
                let mut source = Screen::new(10, 4);
                for line in 0..lead {
                    source.process(format!("old {line}\r\n").as_bytes());
                }
                source.process(case);
                for tail in 0..lead / 4 {
                    source.process(format!("\r\nnew {tail}").as_bytes());
                }
                let joined = assert_rows_and_wraps(&mut source, *expect_wraps);
                assert!(
                    joined || !expect_wraps,
                    "case {index} lead {lead} lost its wraps"
                );
            }
        }
    }

    /// Fixed-seed output at a narrow width, so rows wrap constantly: text,
    /// wide characters and colours, plus (with `hostile`) cursor moves and
    /// erases, which can leave wrap flags over rows that joining would lose.
    fn random_screen(seed: u64, hostile: bool) -> Screen {
        let mut state = seed;
        let mut next = move |bound: u64| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state % bound
        };
        let mut source = Screen::new(12, 6);
        for _ in 0..400 {
            let piece: String = match next(if hostile { 12 } else { 8 }) {
                0 => "\r\n".into(),
                1 => format!("\x1b[{}m", [0, 1, 4, 31, 44, 7][next(6) as usize]),
                2 => "\u{4e16}\u{754c}".into(),
                3 => " ".repeat(1 + next(14) as usize),
                8 => format!("\x1b[{};{}H", 1 + next(6), 1 + next(12)),
                9 | 10 => [
                    "\x1b[K", "\x1b[2K", "\x1b[1K", "\x1b[X", "\x1b[2J", "\x1b[3P",
                ][next(6) as usize]
                    .into(),
                _ => "abcdefghij0123456789"[..1 + next(19) as usize].into(),
            };
            source.process(piece.as_bytes());
        }
        source
    }

    #[test]
    fn wraps_survive_across_many_pages_of_scrollback() {
        // Ghostty stores history in pages; a wrapped line can straddle two.
        let mut source = Screen::new(80, 24);
        for line in 0..3_000 {
            let text = format!(
                "{line:05} \x1b[3{}m{}\x1b[0m",
                line % 8,
                "w".repeat(150 + line % 40)
            );
            source.process(format!("{text}\r\n").as_bytes());
        }
        assert!(source.scrollback_rows() > 5_000);
        assert!(assert_rows_and_wraps(&mut source, true));
    }

    #[test]
    fn ordinary_output_keeps_every_wrap_and_reflows_alike() {
        for seed in 1..=60 {
            let mut source = random_screen(seed * 0x9e37_79b9, false);
            assert!(
                assert_rows_and_wraps(&mut source, true),
                "seed {seed} fell back to one line per row"
            );
        }
    }

    #[test]
    fn hostile_output_keeps_every_row_in_place() {
        // Whatever the app did to its rows, the rows come back where they
        // were, with or without the wraps.
        for seed in 1..=60 {
            let mut source = random_screen(seed * 0x9e37_79b9, true);
            assert_rows_and_wraps(&mut source, false);
        }
    }

    /// 10,000 rows of 500 columns with a style change on every cell: the
    /// heaviest history a daemon screen can hold.
    fn heavy_history() -> Screen {
        let mut source = Screen::new(500, 24);
        for line in 0..10_000 {
            let styled: String = (0..250)
                .map(|cell| format!("\x1b[3{};4{}mx", (cell + line) % 8, (cell + line / 3) % 8))
                .collect();
            source.process(format!("{styled}\x1b[0m {line}\r\n").as_bytes());
        }
        source.process(b"$ \x1b[?2004h");
        source
    }

    #[test]
    fn a_repaint_over_the_limit_drops_the_oldest_scrollback_whole() {
        let source = heavy_history();
        let limit = 4 * 1024 * 1024;
        assert!(source.restore_bytes().len() > limit, "the premise");
        let bytes = source.restore_bytes_within(limit);
        assert!(bytes.len() <= limit, "{} bytes", bytes.len());
        assert!(bytes.starts_with(b"\x1bc"));
        // Whole, not cut: a fresh emulator ends in the source's visible
        // screen, cursor and modes, with the newest history above them.
        let view = fed(500, 24, &bytes);
        assert_eq!(view.contents(), source.contents());
        assert_eq!(view.cursor_position(), source.cursor_position());
        assert!(view.dec_mode(2004));
        let (kept, all) = (view.scrollback_rows(), source.scrollback_rows());
        assert!(kept > 100 && kept < all, "{kept} of {all} rows kept");
        assert!(source.transcript().ends_with(&view.transcript()));
        assert!(view.transcript().contains(" 9999\n"));
        // And it is a repaint like any other: repeating it says the same.
        assert_eq!(view.restore_bytes_within(limit), bytes);
    }

    #[test]
    fn a_repaint_under_the_limit_is_not_trimmed() {
        let source = heavy_history();
        let whole = source.restore_bytes();
        assert_eq!(source.restore_bytes_within(whole.len()), whole);
        assert_ne!(source.restore_bytes_within(whole.len() - 1), whole);
    }

    #[test]
    fn a_limit_below_the_visible_screen_still_repaints_the_visible_screen() {
        let mut source = Screen::new(80, 24);
        for line in 0..200 {
            source.process(format!("line {line}\r\n").as_bytes());
        }
        let bytes = source.restore_bytes_within(1);
        let view = fed(80, 24, &bytes);
        assert_eq!(view.scrollback_rows(), 0);
        assert_eq!(view.contents(), source.contents());
        assert_eq!(view.cursor_position(), source.cursor_position());
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
    fn a_keyboard_stack_left_on_the_inactive_screen_comes_back() {
        // A program that crashed on the alternate screen without popping
        // what it pushed; the next program to enter it finds the stack.
        // The shell is mid-line with a pending wrap and a style.
        let mut source = Screen::new(10, 4);
        source.process(b"\x1b[?1049h\x1b[>5u\x1b[>7u\x1b[?1049l\x1b[1;32m0123456789");
        let mut view = reattached(&source);
        assert_same(&source, &view);
        for screen in [&mut source, &mut view] {
            screen.process(b"x\x1b[?1049h");
        }
        assert_eq!(view.keyboard_flags(), 7);
        assert_eq!(view.keyboard_flags(), source.keyboard_flags());
        for _ in 0..3 {
            for screen in [&mut source, &mut view] {
                screen.process(b"\x1b[<u");
            }
            assert_eq!(view.keyboard_flags(), source.keyboard_flags());
        }
        assert_eq!(view.transcript(), source.transcript());
    }

    #[test]
    fn keyboard_stacks_come_back_as_deep_as_the_engine_keeps_them() {
        // Ghostty keeps eight entries per screen (a program using the kitty
        // keyboard protocol pushes one or two); nothing deeper exists to
        // restore, and what does exist pops the same in the view.
        for alternate in [false, true] {
            let mut source = Screen::new(80, 24);
            source.process(if alternate { b"\x1b[?1049h" } else { b"" });
            for level in 1..=12u8 {
                source.process(format!("\x1b[>{level}u").as_bytes());
            }
            let mut view = reattached(&source);
            for pop in 0..10 {
                assert_eq!(view.keyboard_flags(), source.keyboard_flags(), "pop {pop}");
                for screen in [&mut source, &mut view] {
                    screen.process(b"\x1b[<u");
                }
            }
        }
    }

    #[test]
    fn leaving_a_legacy_alternate_screen_keeps_the_cursor_it_had() {
        // Modes 47 and 1047 share one cursor between the screens, so the
        // primary cursor at the moment of attach is overwritten on the way
        // out and need not be restored. The repaint enters with 1049, which
        // saves the primary cursor it painted; the one thing that can read
        // it is a later 1049 exit, and it reads what the source's saved
        // cursor holds.
        for (enter, leave) in [
            ("47", "47"),
            ("1047", "1047"),
            ("47", "1047"),
            ("1047", "47"),
            ("1049", "1049"),
            ("47", "1049"),
            ("1047", "1049"),
        ] {
            let mut source = Screen::new(20, 6);
            source.process(
                format!("\x1b[1;31mshell\x1b[3;4H\x1b[?{enter}h\x1b[5;9Hfull screen app")
                    .as_bytes(),
            );
            let mut view = reattached(&source);
            assert_same(&source, &view);
            for screen in [&mut source, &mut view] {
                screen.process(format!("\x1b[?{leave}l back").as_bytes());
            }
            assert_eq!(view.alternate_screen(), source.alternate_screen());
            assert_eq!(
                view.cursor_position(),
                source.cursor_position(),
                "{enter} then {leave}"
            );
            assert_eq!(
                view.transcript(),
                source.transcript(),
                "{enter} then {leave}"
            );
        }
    }

    #[test]
    fn kitty_images_are_not_stored_and_the_repaint_carries_none() {
        // Graphics storage is off on daemon screens: a repaint can't carry
        // an image, and holding the pixels would cost memory for nothing.
        let mut source = Screen::new(40, 10);
        source.process(b"before \x1b_Ga=T,f=24,s=1,v=1;/wAA\x1b\\ after");
        let bytes = source.restore_bytes();
        assert!(!bytes.windows(3).any(|w| w == b"\x1b_G"));
        let view = reattached(&source);
        assert_same(&source, &view);
        assert!(view.contents().starts_with("before"));
        assert!(view.contents().contains("after"));
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
