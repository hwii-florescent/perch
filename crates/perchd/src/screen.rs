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
//! - **Blanks and erased cells.** Ghostty's formatter gets two things wrong
//!   that a repaint can't leave. It writes the empty cells between two cells
//!   of a line as spaces in the style of the cell before them, so a gap an app
//!   skipped over after painted cells (cursor-forward past a coloured, inverse
//!   or underlined run) would come back painted. And it prints nothing for
//!   cells erased in a colour (`ESC[48;5;Nm ESC[K`, a themed background) when
//!   no text is beside them, so such a row came back in the default colour.
//!   [`Term::plan_rows`] reads every cell once per repaint and finds both. A
//!   gap is handled by ending the formatter's call just before it (it resets
//!   the style when it stops, and the next call starts with the blanks). A row
//!   with erased cells is printed part by part: the cells with text through
//!   the formatter, the blanks that precede a cell with output as spaces, and
//!   each erased run as its colour, `ECH` and `CUF`, which leaves the cells
//!   empty with only the background, as they were. A run at a soft wrap goes
//!   through the formatter with the cells beside it (it writes them as spaces
//!   in their colour), since only a printed cell wraps. Rows that need none of
//!   this are formatted in one call, unchanged. All of it counts toward the
//!   size limit like any other bytes. Joined rows that would need a part of a
//!   wrapped row printed where the formatter prints nothing (blanks that end
//!   it after a painted cell, a run at the wrap with no text in the row) are
//!   made with one line per row instead. That fallback cannot carry the marker
//!   a wide character that did not fit leaves in the last column, so that cell
//!   comes back unstyled.
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

    /// The cells from `start` to `end`, each `(column, row)` in `tag`'s
    /// coordinates, end included.
    fn span(
        &self,
        tag: g::GhosttyPointTag,
        start: (u16, u32),
        end: (u16, u32),
    ) -> Option<g::GhosttySelection> {
        Some(g::GhosttySelection {
            size: std::mem::size_of::<g::GhosttySelection>(),
            start: self.grid_ref(tag, start.0, start.1)?,
            end: self.grid_ref(tag, end.0, end.1)?,
            rectangle: false,
        })
    }

    /// `count` rows of `tag`'s coordinate space from row `first`, `cols` wide.
    fn rows_selection(
        &self,
        tag: g::GhosttyPointTag,
        cols: u16,
        first: u32,
        count: u32,
    ) -> Option<g::GhosttySelection> {
        self.span(
            tag,
            (0, first),
            (cols.checked_sub(1)?, first + count.checked_sub(1)?),
        )
    }

    /// Whether row `y` of `tag`'s coordinates continues the line above it:
    /// the row above ended in a soft wrap.
    fn continues_line_above(&self, tag: g::GhosttyPointTag, y: u32) -> bool {
        self.grid_ref(tag, 0, y)
            .is_some_and(|row| row_flag(&row, g::GHOSTTY_ROW_DATA_WRAP_CONTINUATION))
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

    /// What Ghostty's formatter makes of the cell `grid_ref` points at.
    fn cell_kind(grid_ref: &g::GhosttyGridRef) -> Option<CellKind> {
        let mut cell = 0;
        let (mut content, mut wide) = (0, 0);
        let (mut text, mut styling) = (false, false);
        let keys = [
            g::GHOSTTY_CELL_DATA_CONTENT_TAG,
            g::GHOSTTY_CELL_DATA_WIDE,
            g::GHOSTTY_CELL_DATA_HAS_TEXT,
            g::GHOSTTY_CELL_DATA_HAS_STYLING,
        ];
        let mut values = [
            (&mut content as *mut i32).cast(),
            (&mut wide as *mut i32).cast(),
            (&mut text as *mut bool).cast(),
            (&mut styling as *mut bool).cast(),
        ];
        // SAFETY: the ref came from a live terminal; each key writes the type
        // its value pointer has here.
        let ok = unsafe {
            g::ghostty_grid_ref_cell(grid_ref, &mut cell) == g::GHOSTTY_SUCCESS
                && g::ghostty_cell_get_multi(
                    cell,
                    keys.len(),
                    keys.as_ptr(),
                    values.as_mut_ptr(),
                    ptr::null_mut(),
                ) == g::GHOSTTY_SUCCESS
        };
        if !ok {
            return None;
        }
        // A cell erased in a colour holds the colour as its content.
        let background = match content {
            g::GHOSTTY_CELL_CONTENT_BG_COLOR_PALETTE => {
                let mut index = 0u8;
                // SAFETY: the palette key writes a byte.
                let ok = unsafe {
                    g::ghostty_cell_get(
                        cell,
                        g::GHOSTTY_CELL_DATA_COLOR_PALETTE,
                        (&mut index as *mut u8).cast(),
                    )
                };
                (ok == g::GHOSTTY_SUCCESS).then_some(Background::Palette(index))
            }
            g::GHOSTTY_CELL_CONTENT_BG_COLOR_RGB => {
                let mut rgb = g::GhosttyColorRgb::default();
                // SAFETY: the RGB key writes a GhosttyColorRgb.
                let ok = unsafe {
                    g::ghostty_cell_get(
                        cell,
                        g::GHOSTTY_CELL_DATA_COLOR_RGB,
                        (&mut rgb as *mut g::GhosttyColorRgb).cast(),
                    )
                };
                (ok == g::GHOSTTY_SUCCESS).then_some(Background::Rgb(rgb.r, rgb.g, rgb.b))
            }
            _ => None,
        };
        Some(match (wide, background) {
            (g::GHOSTTY_CELL_WIDE_SPACER_HEAD, _) => CellKind::Spacer { head: true },
            (g::GHOSTTY_CELL_WIDE_SPACER_TAIL, _) => CellKind::Spacer { head: false },
            (_, Some(background)) => CellKind::Erased(background),
            (g::GHOSTTY_CELL_WIDE_NARROW, None) if !text && !styling => CellKind::Blank,
            _ => CellKind::Filled {
                text,
                painted: styling,
            },
        })
    }

    /// How [`Self::format_vt_rows`] prints each row of the active screen;
    /// see [`Plan`]. `unwrap` is the layout the rows will be formatted in.
    fn plan_rows(&self, cols: u16, rows: u16, unwrap: bool) -> Option<Plan> {
        let history = self.get::<usize>(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)? as u32;
        let total = history + u32::from(rows);
        let mut plan = Plan {
            rows: Vec::with_capacity(total as usize),
            ..Plan::default()
        };
        let mut kinds = Vec::with_capacity(cols.into());
        let mut parts = Vec::new();
        // Whether the row above is joined to this one, and whether it ends in
        // a painted style that a call spanning both rows would carry over.
        let (mut joined, mut open) = (false, false);
        for y in 0..total {
            let mut at = self.grid_ref(g::GHOSTTY_POINT_TAG_SCREEN, 0, y)?;
            let wraps = unwrap && row_flag(&at, g::GHOSTTY_ROW_DATA_WRAP);
            kinds.clear();
            for x in 0..cols {
                at.x = x;
                kinds.push(Self::cell_kind(&at)?);
            }
            if plan.blank_cell.is_none() {
                let empty = |kind: &CellKind| matches!(kind, CellKind::Blank | CellKind::Erased(_));
                plan.blank_cell = kinds.iter().position(empty).map(|x| (x as u16, y));
            }
            let has_text = kinds
                .iter()
                .any(|kind| matches!(kind, CellKind::Filled { text: true, .. }));
            let has_erased = kinds.iter().any(|kind| matches!(kind, CellKind::Erased(_)));
            if !has_text && !has_erased {
                // A row without text prints nothing and ends the style.
                plan.rows.push(0);
                (joined, open) = (false, false);
                continue;
            }

            parts.clear();
            // The cells the formatter will print in one call so far, and the
            // run of blank cells waiting for a cell with output after them.
            let mut piece: Option<(u16, u16)> = None;
            let mut blanks: Option<(u16, u16)> = None;
            let (mut painted, mut cut) = (joined && open, false);
            // A row that wraps into the next, or continues the one above, has
            // to be printed up to and from the margin, where the terminal only
            // wraps for a cell it prints: erased cells there go with the
            // formatter, which writes them as spaces in their colour.
            let leading = kinds
                .iter()
                .take_while(|kind| matches!(kind, CellKind::Erased(_)))
                .count();
            let trailing = kinds
                .iter()
                .rev()
                .take_while(|kind| matches!(kind, CellKind::Erased(_)))
                .count();
            for (x, kind) in (0..).zip(&kinds) {
                let margin = (joined && usize::from(x) < leading)
                    || (wraps && usize::from(x) >= kinds.len() - trailing);
                match *kind {
                    CellKind::Spacer { .. } => {}
                    CellKind::Blank => match &mut blanks {
                        Some((_, len)) => *len += 1,
                        None => blanks = Some((x, 1)),
                    },
                    CellKind::Filled { painted: now, .. } => {
                        match (blanks.take(), &mut piece) {
                            (Some((start, _)), Some((from, to))) if painted => {
                                // The formatter would write these blanks
                                // in the style of the cell before them: end
                                // the call there, which resets the style.
                                push_cells(&mut parts, &kinds, &mut plan.spans_rows, (*from, *to));
                                (piece, cut) = (Some((start, x)), true);
                            }
                            // Blanks the row above carried a style into.
                            (Some((0, _)), None) if painted => plan.spans_rows = true,
                            (Some((start, _)), None) => piece = Some((start, x)),
                            (_, Some((_, to))) => *to = x,
                            (None, None) => piece = Some((x, x)),
                        }
                        painted = now;
                    }
                    CellKind::Erased(_) if margin => {
                        // As a cell in a style without text.
                        match (blanks.take(), &mut piece) {
                            (Some((start, _)), Some((from, to))) if painted => {
                                push_cells(&mut parts, &kinds, &mut plan.spans_rows, (*from, *to));
                                (piece, cut) = (Some((start, x)), true);
                            }
                            (Some((start, _)), None) => piece = Some((start, x)),
                            (_, Some((_, to))) => *to = x,
                            (None, None) => piece = Some((x, x)),
                        }
                        painted = true;
                    }
                    CellKind::Erased(background) => {
                        if let Some((from, to)) = piece.take() {
                            push_cells(&mut parts, &kinds, &mut plan.spans_rows, (from, to));
                        }
                        if let Some((_, len)) = blanks.take() {
                            parts.push(Part::Spaces(len));
                        }
                        match parts.last_mut() {
                            Some(Part::Erase {
                                from,
                                len,
                                background: before,
                            }) if *before == background && *from + *len == x => *len += 1,
                            _ => parts.push(Part::Erase {
                                from: x,
                                len: 1,
                                background,
                            }),
                        }
                        painted = false;
                    }
                }
            }
            if let Some((from, to)) = piece {
                push_cells(&mut parts, &kinds, &mut plan.spans_rows, (from, to));
            }
            let last = kinds
                .iter()
                .rev()
                .find(|kind| !matches!(kind, CellKind::Spacer { .. }));
            if wraps && matches!(last, Some(CellKind::Blank)) {
                // Blanks that end a wrapped row print nothing, so the next
                // row can't follow it with no line break.
                plan.spans_rows |= painted;
            }
            let wide_wraps = matches!(kinds.last(), Some(CellKind::Spacer { head: true }));
            let flags = [
                (has_text, HAS_TEXT),
                (wraps, WRAPS_ON),
                (wide_wraps, WIDE_WRAPS_ON),
            ];
            plan.rows.push(
                flags
                    .iter()
                    .filter(|(on, _)| *on)
                    .fold(0, |all, (_, flag)| all | flag),
            );
            if parts.iter().any(|part| !matches!(part, Part::Cells { .. })) {
                plan.special.push((y, std::mem::take(&mut parts)));
            } else if cut {
                // Only calls of the formatter, one per cut.
                let starts = parts.iter().skip(1).filter_map(|part| match *part {
                    Part::Cells { from, .. } => Some((y, from)),
                    _ => None,
                });
                plan.cuts.extend(starts);
            }
            (joined, open) = (wraps, painted);
        }
        Some(plan)
    }

    /// [`Self::format`] as VT of rows `first` to `last` of the screen's
    /// coordinates, in calls cut at `cuts`: the formatter ends its output with
    /// a style reset, so the blanks that start the next call are written
    /// unpainted. Only the first call carries the modes and only the last the
    /// state that follows the cells.
    fn format_vt_calls(
        &self,
        cols: u16,
        (first, last): (u32, u32),
        layout: Layout,
        extra: Extra,
        plan: &Plan,
    ) -> Option<Vec<u8>> {
        let (tag, vt) = (g::GHOSTTY_POINT_TAG_SCREEN, g::GHOSTTY_FORMATTER_FORMAT_VT);
        // A selection that ends on that marker takes in the character on the
        // next row, which is printed there.
        let wide = plan.rows[last as usize] & WIDE_WRAPS_ON != 0;
        let end = (cols.checked_sub(if wide { 2 } else { 1 })?, last);
        let cuts = &plan.cuts;
        let from = cuts.partition_point(|&(y, _)| y < first);
        let (mut start, mut modes, mut out) = ((0, first), extra.modes, Vec::new());
        for &(y, x) in cuts[from..].iter().take_while(|&&(y, _)| y <= last) {
            let call = Extra {
                modes,
                screen_state: false,
            };
            out.extend(self.format(vt, layout, call, &self.span(tag, start, (x - 1, y))?)?);
            (start, modes) = ((x, y), false);
        }
        let call = Extra { modes, ..extra };
        out.extend(self.format(vt, layout, call, &self.span(tag, start, end)?)?);
        Some(out)
    }

    /// [`Self::format`] as VT of `count` rows from row `first` of the screen's
    /// coordinates, and the row the cursor ends on (relative to `first`).
    /// The rows the plan has own bytes for are printed part by part, and the
    /// rows between them in calls of the formatter.
    fn format_vt_rows(
        &self,
        cols: u16,
        (first, count): (u32, u32),
        layout: Layout,
        extra: Extra,
        plan: &Plan,
    ) -> Option<(Vec<u8>, u32)> {
        let (tag, vt) = (g::GHOSTTY_POINT_TAG_SCREEN, g::GHOSTTY_FORMATTER_FORMAT_VT);
        let end = first + count;
        let has_text = |y: u32| plan.rows[y as usize] & HAS_TEXT != 0;
        let special = {
            let from = plan.special.partition_point(|(y, _)| *y < first);
            let to = plan.special.partition_point(|(y, _)| *y < end);
            &plan.special[from..to]
        };
        if special.is_empty() {
            let bytes = self.format_vt_calls(cols, (first, end - 1), layout, extra, plan)?;
            let last = (first..end).rev().find(|&y| has_text(y));
            return Some((bytes, last.map_or(0, |y| y - first)));
        }

        // The modes before and the state after the cells come from a call
        // that prints no cell: one for a cell without text.
        let blank = plan.blank_cell?;
        let stateless = self.span(tag, blank, blank)?;
        let mut out = Vec::new();
        if extra.modes {
            let modes_only = Extra {
                screen_state: false,
                ..extra
            };
            out.extend(self.format(vt, layout, modes_only, &stateless)?);
        }
        // The row the cursor is on; none yet means `first`.
        let mut at: Option<u32> = None;
        // The line breaks to get from the cursor's row to row `to`, whose
        // first cell is printed if `prints`: a row that wraps into it needs
        // none then.
        let line_breaks = |out: &mut Vec<u8>, at: Option<u32>, to: u32, prints: bool| {
            let breaks = match at {
                None => to - first,
                Some(at) if prints && to == at + 1 && plan.rows[at as usize] & WRAPS_ON != 0 => 0,
                Some(at) => to - at,
            };
            for _ in 0..breaks {
                out.extend(b"\r\n");
            }
        };
        let (mut y, mut rest) = (first, special);
        while y < end {
            if let Some(((row, parts), after)) =
                rest.split_first().filter(|((row, _), _)| *row == y)
            {
                line_breaks(&mut out, at, y, true);
                for part in parts {
                    match *part {
                        Part::Cells { from, to } => {
                            let cells = self.span(tag, (from, y), (to, y))?;
                            out.extend(self.format(vt, layout, NO_EXTRAS, &cells)?);
                        }
                        Part::Spaces(len) => out.resize(out.len() + usize::from(len), b' '),
                        Part::Erase {
                            from,
                            len,
                            background,
                        } => {
                            let colour = match background {
                                Background::Palette(index) => format!("48;5;{index}"),
                                Background::Rgb(r, g, b) => format!("48;2;{r};{g};{b}"),
                            };
                            out.extend(format!("\x1b[{colour}m").bytes());
                            out.extend(format!("\x1b[{len}X").bytes());
                            // The cursor stays where the row ends.
                            if from + len < cols {
                                out.extend(format!("\x1b[{len}C").bytes());
                            }
                            out.extend(b"\x1b[0m");
                        }
                    }
                }
                (at, y, rest) = (Some(*row), y + 1, after);
                continue;
            }
            // Rows the formatter prints as they are, up to the next one it
            // doesn't: it breaks the lines between them, and before the first
            // row with text, itself.
            let stop = rest.first().map_or(end, |(row, _)| *row);
            let Some(last) = (y..stop).rev().find(|&row| has_text(row)) else {
                y = stop;
                continue;
            };
            line_breaks(&mut out, at, y, has_text(y));
            out.extend(self.format_vt_calls(cols, (y, last), layout, NO_EXTRAS, plan)?);
            (at, y) = (Some(last), stop);
        }
        if extra.screen_state {
            let state_only = Extra {
                modes: false,
                ..extra
            };
            out.extend(self.format(vt, layout, state_only, &stateless)?);
        }
        Some((out, at.map_or(0, |row| row - first)))
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

/// Cells `from` to `to` of a row, through the formatter, which prints nothing
/// for cells without text (`spans_rows` is set then, as the row can't be
/// printed as it is).
fn push_cells(
    parts: &mut Vec<Part>,
    kinds: &[CellKind],
    spans_rows: &mut bool,
    (from, to): (u16, u16),
) {
    let cells = &kinds[usize::from(from)..=usize::from(to)];
    *spans_rows |= !cells
        .iter()
        .any(|kind| matches!(kind, CellKind::Filled { text: true, .. }));
    parts.push(Part::Cells { from, to });
}

/// A flag of the row `grid_ref` is in.
fn row_flag(grid_ref: &g::GhosttyGridRef, key: g::GhosttyRowData) -> bool {
    let (mut row, mut flag) = (0, false);
    // SAFETY: the ref came from a terminal that is still alive; the row keys
    // used here write a bool.
    unsafe {
        g::ghostty_grid_ref_row(grid_ref, &mut row) == g::GHOSTTY_SUCCESS
            && g::ghostty_row_get(row, key, (&mut flag as *mut bool).cast()) == g::GHOSTTY_SUCCESS
            && flag
    }
}

/// What Ghostty's formatter makes of a cell.
#[derive(Clone, Copy)]
enum CellKind {
    /// The other half of a wide character: no output of its own. `head` is
    /// the one that ends a row the character didn't fit on.
    Spacer { head: bool },
    /// No text and no style: written as a space, and only if a cell with
    /// output follows it on the line.
    Blank,
    /// Erased in a colour: no text, only a background. The formatter prints
    /// nothing for a row part of these alone.
    Erased(Background),
    /// A cell with text, or in a style without any.
    Filled {
        text: bool,
        /// Not in the default style.
        painted: bool,
    },
}

/// The colour a cell was erased in.
#[derive(Clone, Copy, PartialEq)]
enum Background {
    Palette(u8),
    Rgb(u8, u8, u8),
}

/// A row's bytes, part by part, for a row the formatter can't print as it is.
#[derive(Clone, Copy)]
enum Part {
    /// Cells `from` to `to` of the row, through the formatter. It ends with
    /// a style reset, so what follows starts unpainted.
    Cells { from: u16, to: u16 },
    /// Blank cells that a cell with output follows, written as spaces.
    Spaces(u16),
    /// `len` cells from column `from` erased in a colour, which leaves the
    /// cells empty with only the background, as they were.
    Erase {
        from: u16,
        len: u16,
        background: Background,
    },
}

/// Which rows of the screen the formatter prints as they are, and for the
/// rest what to print instead.
#[derive(Default)]
struct Plan {
    /// Per row of the screen, history first: [`HAS_TEXT`] and [`WRAPS_ON`].
    rows: Vec<u8>,
    /// The rows with cells erased in a colour, in order, which the formatter
    /// can't print as they are, and what to print instead.
    special: Vec<(u32, Vec<Part>)>,
    /// `(row, column)` of the first of each run of blank cells that the
    /// formatter would write, as spaces, in the style of the cell before
    /// them, in rows not in `special`. Its calls end just before them, which
    /// resets the style.
    cuts: Vec<(u32, u16)>,
    /// A cell without text, which the formatter prints nothing for.
    blank_cell: Option<(u16, u32)>,
    /// Rows joined by a soft wrap would have to be printed where they can't
    /// be, so they can't be joined (only meant for a layout that joins).
    spans_rows: bool,
}

/// The row has a cell with text.
const HAS_TEXT: u8 = 1;
/// The row wraps into the next one, which is printed after it with no line
/// break.
const WRAPS_ON: u8 = 2;
/// The row ends in a marker for a wide character that wrapped onto the next.
const WIDE_WRAPS_ON: u8 = 4;

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
        let mut plan = copy.plan_rows(cols, rows, layout.unwrap)?;
        let mut alternate_part = Vec::new();
        let mut alternate_keys = Vec::new();
        let mut alternate_rows = String::new();
        if alternate {
            // The alternate is entered after the primary is painted: 1049
            // saves the primary's cursor, clears the alternate and keeps the
            // cursor and style, which the rows below don't expect.
            alternate_part = b"\x1b[?1049h\x1b[0m\x1b[H".to_vec();
            if layout.unwrap && plan.spans_rows {
                return Some(None);
            }
            alternate_part.extend(paint_active(&copy, cols, rows, false, layout, &plan)?);
            alternate_keys = copy.drain_keyboard_stack();
            alternate_rows = copy.rows_text(g::GHOSTTY_POINT_TAG_ACTIVE, cols, 0, rows.into())?;
            // Back to the primary screen, whichever of the three alternate
            // screen modes entered the alternate; 1049 also restores the
            // cursor from where the primary was left.
            copy.write(b"\x1b[?1049l");
            copy.set_mode_bit(47, false);
            copy.set_mode_bit(1047, false);
            plan = copy.plan_rows(cols, rows, layout.unwrap)?;
        }
        if layout.unwrap && plan.spans_rows {
            return Some(None);
        }

        // After the history: the visible rows (the emulator's own rows line
        // up with them), then everything that follows from them.
        let history = copy.get::<usize>(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)?;
        let visible = paint_active(&copy, cols, rows, true, layout, &plan)?;
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
        let mut scrollback = paint_history(&copy, (cols, rows), (history, keep), layout, &plan)?;
        // Output grows with the rows kept, nearly in proportion: aim a
        // little under the limit and measure again.
        for _ in 0..6 {
            if keep == 0 || fixed.saturating_add(scrollback.len()) <= max_bytes {
                break;
            }
            let budget = max_bytes.saturating_sub(fixed) as u128;
            let smaller = (keep as u128 * budget * 9 / 10 / scrollback.len() as u128) as usize;
            keep = smaller.min(keep - 1);
            scrollback = paint_history(&copy, (cols, rows), (history, keep), layout, &plan)?;
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
    (cols, rows): (u16, u16),
    (history, keep): (usize, usize),
    layout: Layout,
    plan: &Plan,
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
    // Blank rows print nothing, so the row the cursor stops on is not known
    // from the text: it comes with the bytes. Then feed it down to the bottom
    // of the screen that history plus the visible rows fill, which pushes the
    // history above the visible rows.
    let range = (history - keep, keep + joined);
    let (mut out, last_row) = term.format_vt_rows(cols, range, layout, NO_EXTRAS, plan)?;
    out.extend(b"\x1b[0m");
    for _ in 0..(keep + u32::from(rows) - 1).saturating_sub(last_row) {
        out.extend(b"\r\n");
    }
    out.extend(b"\x1b[H");
    Some(out)
}

/// The visible rows of the active screen with the state that follows them.
fn paint_active(
    term: &Term,
    cols: u16,
    rows: u16,
    modes: bool,
    layout: Layout,
    plan: &Plan,
) -> Option<Vec<u8>> {
    let history = term.get::<usize>(g::GHOSTTY_TERMINAL_DATA_SCROLLBACK_ROWS)? as u32;
    let extra = Extra {
        modes,
        screen_state: true,
    };
    let (bytes, _) = term.format_vt_rows(cols, (history, rows.into()), layout, extra, plan)?;
    Some(bytes)
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

    /// What a client gets on attach: a fresh emulator fed the repaint.
    fn reattached(source: &Screen) -> Screen {
        fed(source.cols, source.rows, &source.restore_bytes())
    }

    /// How every cell of `screen`, history first, looks: colours and text
    /// attributes, with `-` for a cell in the default style. Whether the cell
    /// holds text is left out: an empty cell and a space look alike.
    fn cell_looks(screen: &Screen) -> Vec<Vec<String>> {
        let color = |c: &g::GhosttyStyleColor| match c.tag {
            g::GHOSTTY_STYLE_COLOR_PALETTE => format!("p{}", unsafe { c.value.palette }),
            g::GHOSTTY_STYLE_COLOR_RGB => {
                let rgb = unsafe { c.value.rgb };
                format!("#{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b)
            }
            _ => "-".into(),
        };
        let total = screen.scrollback_rows() as u32 + u32::from(screen.rows);
        (0..total)
            .map(|y| {
                (0..screen.cols)
                    .map(|x| {
                        let at = screen
                            .term
                            .grid_ref(g::GHOSTTY_POINT_TAG_SCREEN, x, y)
                            .unwrap();
                        let mut style = g::GhosttyStyle {
                            size: std::mem::size_of::<g::GhosttyStyle>(),
                            ..Default::default()
                        };
                        let (mut cell, mut tag) = (0u64, 0i32);
                        let (mut palette, mut rgb) = (0u8, g::GhosttyColorRgb::default());
                        // SAFETY: the ref was just produced by this terminal;
                        // each key writes the type it is given here.
                        unsafe {
                            g::ghostty_grid_ref_style(&at, &mut style);
                            g::ghostty_grid_ref_cell(&at, &mut cell);
                            let key = g::GHOSTTY_CELL_DATA_CONTENT_TAG;
                            g::ghostty_cell_get(cell, key, (&mut tag as *mut i32).cast());
                            let key = g::GHOSTTY_CELL_DATA_COLOR_PALETTE;
                            g::ghostty_cell_get(cell, key, (&mut palette as *mut u8).cast());
                            let key = g::GHOSTTY_CELL_DATA_COLOR_RGB;
                            g::ghostty_cell_get(
                                cell,
                                key,
                                (&mut rgb as *mut g::GhosttyColorRgb).cast(),
                            );
                        }
                        // A cell erased in a colour holds the colour as its
                        // content; a printed one holds it in its style.
                        let background = match tag {
                            g::GHOSTTY_CELL_CONTENT_BG_COLOR_PALETTE => format!("p{palette}"),
                            g::GHOSTTY_CELL_CONTENT_BG_COLOR_RGB => {
                                format!("#{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b)
                            }
                            _ => color(&style.bg_color),
                        };
                        let flags: String = [
                            (style.bold, 'b'),
                            (style.italic, 'i'),
                            (style.faint, 'f'),
                            (style.blink, 'k'),
                            (style.inverse, 'v'),
                            (style.invisible, 'h'),
                            (style.strikethrough, 's'),
                            (style.overline, 'o'),
                        ]
                        .iter()
                        .filter_map(|&(on, c)| on.then_some(c))
                        .collect();
                        let look = format!(
                            "{}/{background}/{}/{flags}/{}",
                            color(&style.fg_color),
                            color(&style.underline_color),
                            style.underline
                        );
                        if look == "-/-/-//0" {
                            "-".into()
                        } else {
                            look
                        }
                    })
                    .collect()
            })
            .collect()
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

    /// Two cells painted in `style`, seven untouched cells (skipped with
    /// cursor-forward, so empty and in the default style), then `marker`.
    fn gap_row(style: &str, marker: &str) -> String {
        format!("{style}  \x1b[7C\x1b[0m {marker}\r\n")
    }

    /// The looks of the first row of `screen` reading `marker`.
    fn row_looks(screen: &Screen, marker: &str) -> Vec<String> {
        let row = screen
            .transcript()
            .lines()
            .position(|line| line.contains(marker))
            .expect("the marker row");
        cell_looks(screen).swap_remove(row)
    }

    /// Of the row reading `marker`, the gap (columns 2 to 8) is in the
    /// default style in `screen` while the two cells before it are painted.
    fn assert_gap_unpainted(screen: &Screen, marker: &str) {
        let looks = row_looks(screen, marker);
        assert_ne!(looks[0], "-", "the cells before the gap are painted");
        assert_eq!(looks[0], looks[1]);
        assert!(
            looks[2..9].iter().all(|look| look == "-"),
            "gap cells are painted: {:?}",
            &looks[..10]
        );
    }

    /// The gap comes back in the default style, and everything else as it was.
    fn assert_gap_stays_unpainted(source: &Screen, marker: &str) {
        let view = reattached(source);
        assert_same(source, &view);
        assert_eq!(cell_looks(&view), cell_looks(source));
        assert_gap_unpainted(source, marker);
        assert_gap_unpainted(&view, marker);
    }

    #[test]
    fn a_gap_after_painted_cells_stays_unpainted_on_the_visible_rows() {
        for style in [
            "\x1b[48;5;238m",
            "\x1b[7m",
            "\x1b[4m",
            "\x1b[48;2;10;20;30m",
        ] {
            let mut source = Screen::new(40, 8);
            source.process(format!("top\r\n{}$ ", gap_row(style, "gap-marker")).as_bytes());
            assert_eq!(source.scrollback_rows(), 0);
            assert_gap_stays_unpainted(&source, "gap-marker");
        }
    }

    #[test]
    fn a_gap_after_painted_cells_stays_unpainted_in_scrollback() {
        for style in ["\x1b[48;5;238m", "\x1b[7m", "\x1b[4m"] {
            let mut source = Screen::new(40, 6);
            source.process(gap_row(style, "gap-marker").as_bytes());
            for line in 0..20 {
                source.process(format!("line {line}\r\n").as_bytes());
            }
            assert!(source.scrollback_rows() > 10);
            assert_gap_stays_unpainted(&source, "gap-marker");
        }
    }

    #[test]
    fn a_gap_after_painted_cells_stays_unpainted_on_the_alternate_screen() {
        for style in ["\x1b[48;5;238m", "\x1b[7m", "\x1b[4m"] {
            let mut source = Screen::new(40, 8);
            source.process(b"shell\r\n\x1b[?1049h\x1b[H");
            source.process(format!("{}$ ", gap_row(style, "gap-marker")).as_bytes());
            assert!(source.alternate_screen());
            assert_gap_stays_unpainted(&source, "gap-marker");
        }
    }

    #[test]
    fn gaps_in_a_trimmed_repaint_stay_unpainted_and_count_toward_the_limit() {
        let mut source = Screen::new(40, 6);
        for line in 0..400 {
            let style = ["\x1b[48;5;238m", "\x1b[7m", "\x1b[4m"][line % 3];
            source.process(gap_row(style, &format!("gap-marker {line}")).as_bytes());
        }
        let limit = 4_000;
        assert!(source.restore_bytes().len() > 3 * limit, "the premise");
        let bytes = source.restore_bytes_within(limit);
        assert!(bytes.len() <= limit, "{} bytes", bytes.len());
        let view = fed(40, 6, &bytes);
        let kept = view.scrollback_rows();
        assert!(kept > 20 && kept < 300, "{kept} rows kept");
        let (before, after) = (cell_looks(&source), cell_looks(&view));
        assert_eq!(after[..], before[before.len() - after.len()..]);
        assert_gap_unpainted(&view, "gap-marker 399");
        assert_gap_unpainted(&view, &format!("gap-marker {}", 399 - kept));
    }

    #[test]
    fn a_gap_inside_a_wrapped_line_keeps_the_wrap() {
        // Inverse text wraps; on the second row a gap follows it, then text.
        let mut source = Screen::new(12, 5);
        source.process(b"\x1b[7mabcdefghijklxy\x1b[4C\x1b[0mzz");
        let plan = source.term.plan_rows(12, 5, true).unwrap();
        assert_eq!(plan.cuts, [(1, 2)]);
        let mut view = reattached(&source);
        assert_same(&source, &view);
        assert_eq!(cell_looks(&view), cell_looks(&source));
        assert_eq!(wrap_flags(&view), wrap_flags(&source));
        assert_same_after_widening(&mut source, &mut view);
    }

    #[test]
    fn a_gap_that_crosses_a_soft_wrap_stays_unpainted() {
        // Inverse text wraps onto the second row; the cells at the start of
        // that row are erased to the default style and text follows them.
        let mut source = Screen::new(12, 5);
        source.process(b"\x1b[7mabcdefghijkl123456\x1b[2;1H\x1b[0m\x1b[2X\x1b[2;4H\x1b[7mxy");
        assert_eq!(wrap_flags(&source)[..2], [(true, false), (false, true)]);
        let view = reattached(&source);
        assert_same(&source, &view);
        assert_eq!(cell_looks(&view), cell_looks(&source));
        let looks = &cell_looks(&view)[1];
        assert!(looks[..2].iter().all(|look| look == "-"), "{looks:?}");
        assert_ne!(looks[3], "-");
    }

    /// The reattached screen, after checking every cell in it looks as in
    /// the source.
    fn assert_same_looks(source: &Screen) -> Screen {
        let view = reattached(source);
        assert_same(source, &view);
        assert_eq!(cell_looks(&view), cell_looks(source));
        view
    }

    /// Erased cells in `screen`: the cells that don't look default.
    fn painted_cells(screen: &Screen) -> usize {
        cell_looks(screen)
            .iter()
            .flatten()
            .filter(|look| *look != "-")
            .count()
    }

    #[test]
    fn rows_of_erased_cells_keep_their_background_on_the_visible_rows() {
        for erase in [
            "\x1b[48;5;238m\x1b[K",
            "\x1b[48;2;10;20;30m\x1b[2K",
            "\x1b[44m\x1b[40X",
        ] {
            let mut source = Screen::new(40, 8);
            source.process(
                format!("top\r\n{erase}\r\n{erase}\r\n\r\n{erase}\x1b[0m\r\n$ ").as_bytes(),
            );
            assert_eq!(painted_cells(&source), 3 * 40, "the premise");
            assert_same_looks(&source);
        }
    }

    #[test]
    fn rows_of_erased_cells_keep_their_background_in_scrollback() {
        let mut source = Screen::new(40, 6);
        for line in 0..20 {
            let erase = if line % 2 == 0 {
                "\x1b[48;5;238m\x1b[K"
            } else {
                "\x1b[7m"
            };
            source.process(format!("{erase}\r\n\x1b[0mline {line}\r\n").as_bytes());
        }
        assert!(source.scrollback_rows() > 20);
        assert!(painted_cells(&source) >= 10 * 40, "the premise");
        assert_same_looks(&source);
    }

    #[test]
    fn rows_of_erased_cells_keep_their_background_on_the_alternate_screen() {
        // An editor with a themed background: erase the screen in a colour,
        // then write a little text over it.
        let mut source = Screen::new(40, 8);
        source.process(b"shell\r\n\x1b[?1049h\x1b[48;5;238m\x1b[2J\x1b[H\x1b[0;7mfile.rs\x1b[48;5;238m\x1b[K\x1b[3;3H\x1b[0;48;5;238mfn main() {}\x1b[5;1H~");
        assert!(source.alternate_screen());
        assert!(painted_cells(&source) > 5 * 40, "the premise");
        assert_same_looks(&source);
    }

    #[test]
    fn erased_runs_beside_text_and_gaps_come_back_exactly() {
        for bytes in [
            // erased, gap, text
            "\x1b[44m\x1b[3X\x1b[3C\x1b[0m\x1b[5C text\r\nnext",
            // text, gap, erased to the end of the row
            "\x1b[44mab\x1b[5C\x1b[3X\x1b[0m\r\nnext",
            "\x1b[44mab\x1b[5C\x1b[K\x1b[0m\r\nnext",
            // text, erased, no gap
            "abc\x1b[44m\x1b[K\x1b[0m\r\nnext",
            // erased, gap, erased, text
            "\x1b[44m\x1b[2X\x1b[5C\x1b[2X\x1b[0m\x1b[2C zz\r\nnext",
            // blanks, then erased cells, then text
            "\x1b[3C\x1b[44m\x1b[2X\x1b[2C\x1b[0mzz\r\nnext",
            // two colours side by side, then blanks and text
            "\x1b[44m\x1b[2X\x1b[2C\x1b[48;2;1;2;3m\x1b[2X\x1b[2C\x1b[0m\x1b[2Czz\r\nnext",
            // painted text, gap, erased, gap, painted text
            "\x1b[7mab\x1b[3C\x1b[44m\x1b[2X\x1b[2C\x1b[7m\x1b[3Ccd\x1b[0m\r\nnext",
            // wide characters beside the runs
            "\x1b[44m\u{4e16}\x1b[2X\x1b[3C\x1b[0m\u{754c}\r\nnext",
            // erased up to the last column, and the first column
            "\x1b[44m\x1b[30X\x1b[0m\r\n\x1b[44m\x1b[27C\x1b[3X\x1b[0mx\r\n\x1b[44m\x1b[3X\x1b[0mnext",
        ] {
            let source = fed(30, 6, bytes.as_bytes());
            assert!(painted_cells(&source) > 0, "{bytes:?}");
            assert_same_looks(&source);
        }
    }

    #[test]
    fn erased_runs_across_a_soft_wrap_come_back_exactly() {
        for bytes in [
            // a wrapped line whose second row starts with erased cells
            "abcdefghijkl\x1b[44mXY\x1b[2;1H\x1b[2X\x1b[0m\x1b[5;1H",
            // a wrapped line whose first row ends with erased cells
            "\x1b[7mabcdefghijklxy\x1b[1;11H\x1b[44m\x1b[2X\x1b[0m\x1b[5;1H",
            // erased cells inside both rows of a wrapped line
            "ab\x1b[44m\x1b[2X\x1b[0m\x1b[2Cef\x1b[3Cijklmn\x1b[2;3H\x1b[44m\x1b[2X\x1b[0m",
        ] {
            let source = fed(12, 5, bytes.as_bytes());
            assert!(painted_cells(&source) > 0, "{bytes:?}");
            let view = reattached(&source);
            assert_same(&source, &view);
            // The last column is left out: a wide character that didn't fit
            // leaves a marker there that a one-line-per-row repaint can't
            // carry.
            let cols = usize::from(source.cols) - 1;
            for (after, before) in cell_looks(&view).iter().zip(cell_looks(&source)) {
                assert_eq!(after[..cols], before[..cols], "{bytes:?}");
            }
        }
    }

    #[test]
    fn erased_rows_in_a_trimmed_repaint_keep_their_background_and_count_toward_the_limit() {
        let mut source = Screen::new(40, 6);
        for line in 0..400 {
            let erase = ["\x1b[48;5;238m\x1b[K", "\x1b[44m\x1b[3X", "\x1b[7m "][line % 3];
            source.process(
                format!(
                    "{erase}\r\n\x1b[0m{}\r\n",
                    gap_row("\x1b[4m", &format!("m {line}"))
                )
                .as_bytes(),
            );
        }
        let limit = 6_000;
        assert!(source.restore_bytes().len() > 3 * limit, "the premise");
        let bytes = source.restore_bytes_within(limit);
        assert!(bytes.len() <= limit, "{} bytes", bytes.len());
        let view = fed(40, 6, &bytes);
        let kept = view.scrollback_rows();
        assert!(kept > 20 && kept < 700, "{kept} rows kept");
        let (before, after) = (cell_looks(&source), cell_looks(&view));
        assert_eq!(after[..], before[before.len() - after.len()..]);
    }

    #[test]
    fn random_output_keeps_the_style_of_every_cell() {
        for hostile in [false, true] {
            for seed in 1..=60 {
                let source = random_screen(seed * 0x9e37_79b9, hostile);
                let (before, after) = (cell_looks(&source), cell_looks(&reattached(&source)));
                // The last column is left out: a wide character that didn't
                // fit leaves a marker there that a one-line-per-row repaint
                // can't carry.
                let cols = usize::from(source.cols) - 1;
                for (row, (before, after)) in before.iter().zip(&after).enumerate() {
                    assert_eq!(after[..cols], before[..cols], "seed {seed}, row {row}");
                }
            }
        }
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
                1 if hostile => {
                    let sgr = ["0", "1", "4", "31", "44", "7", "48;5;238", "48;2;10;20;30"];
                    format!("\x1b[{}m", sgr[next(8) as usize])
                }
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
