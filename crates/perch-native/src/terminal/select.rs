// The gesture calls below (press, drag and release events with their sub-pixel geometry, the
// selection format options and select-all) follow `Vt::select`, `Vt::select_all` and
// `Vt::selection_text` of `src/vt.rs` in herdr (https://github.com/herdrdev/herdr-app,
// commit 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch: the click time is
// the caller's, shift-click extends the selection, and an autoscroll tick is exposed. See
// THIRD_PARTY_NOTICES.md.

//! Selecting text on the screen with Ghostty's gesture model: a press, a drag and a release,
//! with double and triple clicks choosing a word and a line, and the selection kept by Ghostty
//! as the screen scrolls.

use super::vt::Vt;
use ghostty_sys as g;
use std::ffi::c_void;

/// Pointer positions and geometry go to Ghostty in 1/64 pixel, where a fractional cell width
/// stays exact, so the highlight follows the pointer at any scale.
const SUBPIXEL: f32 = 64.0;
/// Two presses this close in time and space make a double click.
const REPEAT_NS: u64 = 500_000_000;
const REPEAT_PX: f64 = 4.0;

/// One step of a pointer gesture.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Step {
    Press,
    Drag,
    Release,
}

/// Where the pointer is: the cell it is in, and its position in the grid's own pixels (device
/// pixels, from the grid's top left) with the size of a cell and of the grid.
#[derive(Clone, Copy, Debug)]
pub struct Pointer {
    pub col: u16,
    pub row: u16,
    pub x: f32,
    pub y: f32,
    pub cell_width: f32,
    pub height: f32,
    /// A monotonic clock, in nanoseconds, for telling a double click from two single ones.
    pub now_ns: u64,
}

/// The handles of a selection gesture; part of a [`Vt`].
pub struct Gesture {
    gesture: g::GhosttySelectionGesture,
    press: g::GhosttySelectionGestureEvent,
    drag: g::GhosttySelectionGestureEvent,
    release: g::GhosttySelectionGestureEvent,
    tick: g::GhosttySelectionGestureEvent,
}

impl Gesture {
    pub(super) fn new() -> Self {
        let event = |kind| {
            let mut e = std::ptr::null_mut();
            // SAFETY: the out pointer is valid; the event is freed in `free`.
            let result =
                unsafe { g::ghostty_selection_gesture_event_new(std::ptr::null(), &mut e, kind) };
            assert!(result == g::GHOSTTY_SUCCESS, "gesture_event_new failed");
            e
        };
        let mut gesture = std::ptr::null_mut();
        // SAFETY: as above.
        let result = unsafe { g::ghostty_selection_gesture_new(std::ptr::null(), &mut gesture) };
        assert!(result == g::GHOSTTY_SUCCESS, "selection_gesture_new failed");
        Self {
            gesture,
            press: event(g::GHOSTTY_SELECTION_GESTURE_EVENT_TYPE_PRESS),
            drag: event(g::GHOSTTY_SELECTION_GESTURE_EVENT_TYPE_DRAG),
            release: event(g::GHOSTTY_SELECTION_GESTURE_EVENT_TYPE_RELEASE),
            tick: event(g::GHOSTTY_SELECTION_GESTURE_EVENT_TYPE_AUTOSCROLL_TICK),
        }
    }

    /// Free the handles; `term` is the terminal the gesture was used with.
    pub(super) fn free(&mut self, term: g::GhosttyTerminal) {
        // SAFETY: each handle is freed once, here.
        unsafe {
            g::ghostty_selection_gesture_event_free(self.press);
            g::ghostty_selection_gesture_event_free(self.drag);
            g::ghostty_selection_gesture_event_free(self.release);
            g::ghostty_selection_gesture_event_free(self.tick);
            g::ghostty_selection_gesture_free(self.gesture, term);
        }
    }
}

fn sized_selection() -> g::GhosttySelection {
    g::GhosttySelection {
        size: std::mem::size_of::<g::GhosttySelection>(),
        ..Default::default()
    }
}

impl Vt {
    fn viewport_ref(&self, col: u16, row: u16) -> Option<g::GhosttyGridRef> {
        let (cols, rows) = self.size();
        let mut r = g::GhosttyGridRef {
            size: std::mem::size_of::<g::GhosttyGridRef>(),
            ..Default::default()
        };
        let mut p = g::GhosttyPoint {
            tag: g::GHOSTTY_POINT_TAG_VIEWPORT,
            ..Default::default()
        };
        p.value.coordinate = g::GhosttyPointCoordinate {
            x: col.min(cols.saturating_sub(1)),
            y: u32::from(row.min(rows.saturating_sub(1))),
        };
        // SAFETY: `p` and `r` are valid for the call.
        (unsafe { g::ghostty_terminal_grid_ref(self.term(), p, &mut r) } == g::GHOSTTY_SUCCESS)
            .then_some(r)
    }

    fn install_selection(&mut self, selection: Option<&g::GhosttySelection>) {
        // SAFETY: the option takes a selection, or null to clear.
        unsafe {
            g::ghostty_terminal_set(
                self.term(),
                g::GHOSTTY_TERMINAL_OPT_SELECTION,
                selection.map_or(std::ptr::null(), |s| {
                    (s as *const g::GhosttySelection).cast()
                }),
            );
        }
    }

    /// Feed one step of a left-button gesture. A press that starts nothing (a single click)
    /// clears the selection; two presses in quick succession select a word, three a line.
    pub fn select(&mut self, step: Step, at: Pointer) {
        let Some(r) = self.viewport_ref(at.col, at.row) else {
            return;
        };
        let position = g::GhosttySurfacePosition {
            x: f64::from(at.x * SUBPIXEL),
            y: f64::from(at.y * SUBPIXEL),
        };
        let event = match step {
            Step::Press => self.gesture.press,
            Step::Drag => self.gesture.drag,
            Step::Release => self.gesture.release,
        };
        // SAFETY: each option takes the type passed; the values live through the calls.
        unsafe {
            let set = |option, value: *const c_void| {
                g::ghostty_selection_gesture_event_set(event, option, value)
            };
            set(
                g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_REF,
                (&r as *const g::GhosttyGridRef).cast(),
            );
            set(
                g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_POSITION,
                (&position as *const g::GhosttySurfacePosition).cast(),
            );
            match step {
                Step::Press => {
                    let distance = REPEAT_PX * f64::from(SUBPIXEL);
                    set(
                        g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_TIME_NS,
                        (&at.now_ns as *const u64).cast(),
                    );
                    set(
                        g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_REPEAT_INTERVAL_NS,
                        (&REPEAT_NS as *const u64).cast(),
                    );
                    set(
                        g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_REPEAT_DISTANCE,
                        (&distance as *const f64).cast(),
                    );
                }
                Step::Drag => {
                    let geometry = self.geometry(&at);
                    set(
                        g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_GEOMETRY,
                        (&geometry as *const g::GhosttySelectionGestureGeometry).cast(),
                    );
                }
                Step::Release => {}
            }
        }
        let mut selection = sized_selection();
        // SAFETY: gesture, terminal and event are live; the out pointer is valid.
        let result = unsafe {
            g::ghostty_selection_gesture_event(
                self.gesture.gesture,
                self.term(),
                event,
                &mut selection,
            )
        };
        match result {
            g::GHOSTTY_SUCCESS => self.install_selection(Some(&selection)),
            _ if step == Step::Press => self.install_selection(None),
            _ => {}
        }
    }

    fn geometry(&self, at: &Pointer) -> g::GhosttySelectionGestureGeometry {
        g::GhosttySelectionGestureGeometry {
            columns: u32::from(self.size().0),
            cell_width: (at.cell_width.max(1.0) * SUBPIXEL).round() as u32,
            padding_left: 0,
            screen_height: (at.height.max(1.0) * SUBPIXEL).round() as u32,
        }
    }

    /// Which way a drag in progress asks the viewport to scroll: `-1` up, `1` down, `0` not.
    pub fn drag_autoscroll(&self) -> i8 {
        let mut request: g::GhosttySelectionGestureAutoscroll =
            g::GHOSTTY_SELECTION_GESTURE_AUTOSCROLL_NONE;
        // SAFETY: the key writes the type passed.
        unsafe {
            g::ghostty_selection_gesture_get(
                self.gesture.gesture,
                self.term(),
                g::GHOSTTY_SELECTION_GESTURE_DATA_AUTOSCROLL,
                (&mut request as *mut g::GhosttySelectionGestureAutoscroll).cast(),
            );
        }
        match request {
            g::GHOSTTY_SELECTION_GESTURE_AUTOSCROLL_UP => -1,
            g::GHOSTTY_SELECTION_GESTURE_AUTOSCROLL_DOWN => 1,
            _ => 0,
        }
    }

    /// Extend the drag after the viewport scrolled under a pointer held past the grid's edge.
    pub fn autoscroll_tick(&mut self, at: Pointer) {
        let event = self.gesture.tick;
        let geometry = self.geometry(&at);
        let coordinate = g::GhosttyPointCoordinate {
            x: at.col.min(self.size().0.saturating_sub(1)),
            y: u32::from(at.row.min(self.size().1.saturating_sub(1))),
        };
        let mut selection = sized_selection();
        // SAFETY: the options take the types passed; the values live through the calls.
        let result = unsafe {
            g::ghostty_selection_gesture_event_set(
                event,
                g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_GEOMETRY,
                (&geometry as *const g::GhosttySelectionGestureGeometry).cast(),
            );
            g::ghostty_selection_gesture_event_set(
                event,
                g::GHOSTTY_SELECTION_GESTURE_EVENT_OPT_VIEWPORT,
                (&coordinate as *const g::GhosttyPointCoordinate).cast(),
            );
            g::ghostty_selection_gesture_event(
                self.gesture.gesture,
                self.term(),
                event,
                &mut selection,
            )
        };
        if result == g::GHOSTTY_SUCCESS {
            self.install_selection(Some(&selection));
        }
    }

    /// Move the selection's loose end to the cell under `col`, `row` (shift-click): the end
    /// farther from the click stays. With nothing selected this does nothing.
    pub fn extend_selection(&mut self, col: u16, row: u16) -> bool {
        let Some(r) = self.viewport_ref(col, row) else {
            return false;
        };
        let mut current = sized_selection();
        // SAFETY: the key writes a selection.
        let have = unsafe {
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_SELECTION,
                (&mut current as *mut g::GhosttySelection).cast(),
            )
        } == g::GHOSTTY_SUCCESS;
        if !have {
            return false;
        }
        let mut ordered = sized_selection();
        // SAFETY: `current` came from this terminal just now.
        unsafe {
            g::ghostty_terminal_selection_ordered(
                self.term(),
                &current,
                g::GHOSTTY_SELECTION_ORDER_FORWARD,
                &mut ordered,
            );
        }
        let screen_row = |r: &g::GhosttyGridRef| {
            let mut p = g::GhosttyPointCoordinate::default();
            // SAFETY: `r` is a live snapshot of this terminal.
            unsafe {
                g::ghostty_terminal_point_from_grid_ref(
                    self.term(),
                    r,
                    g::GHOSTTY_POINT_TAG_SCREEN,
                    &mut p,
                );
            }
            (p.y, p.x)
        };
        let before_start = screen_row(&r) < screen_row(&ordered.start);
        let extended = if before_start {
            g::GhosttySelection {
                start: r,
                ..ordered
            }
        } else {
            g::GhosttySelection { end: r, ..ordered }
        };
        self.install_selection(Some(&extended));
        true
    }

    /// Select the active screen and its history. On the alternate screen that is the alternate
    /// screen alone. Copies nothing.
    pub fn select_all(&mut self) {
        let mut selection = sized_selection();
        // SAFETY: the out pointer is valid.
        let found = unsafe { g::ghostty_terminal_select_all(self.term(), &mut selection) }
            == g::GHOSTTY_SUCCESS;
        self.install_selection(found.then_some(&selection));
    }

    pub fn clear_selection(&mut self) {
        self.install_selection(None);
    }

    pub fn has_selection(&self) -> bool {
        let mut current = sized_selection();
        // SAFETY: the key writes a selection.
        unsafe {
            g::ghostty_terminal_get(
                self.term(),
                g::GHOSTTY_TERMINAL_DATA_SELECTION,
                (&mut current as *mut g::GhosttySelection).cast(),
            ) == g::GHOSTTY_SUCCESS
        }
    }

    /// The selected text: soft-wrapped lines joined, trailing blanks trimmed.
    pub fn selection_text(&self) -> Option<String> {
        let options = g::GhosttyTerminalSelectionFormatOptions {
            size: std::mem::size_of::<g::GhosttyTerminalSelectionFormatOptions>(),
            emit: g::GHOSTTY_FORMATTER_FORMAT_PLAIN,
            unwrap: true,
            trim: true,
            ..Default::default()
        };
        let mut ptr: *mut u8 = std::ptr::null_mut();
        let mut len = 0usize;
        // SAFETY: the out pointers are valid; the buffer is Ghostty's and freed below.
        unsafe {
            if g::ghostty_terminal_selection_format_alloc(
                self.term(),
                std::ptr::null(),
                options,
                &mut ptr,
                &mut len,
            ) != g::GHOSTTY_SUCCESS
                || ptr.is_null()
            {
                return None;
            }
            let text = String::from_utf8_lossy(std::slice::from_raw_parts(ptr, len)).into_owned();
            g::ghostty_free(std::ptr::null(), ptr, len);
            (!text.is_empty()).then_some(text)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(col: u16, row: u16, x: f32, now_ns: u64) -> Pointer {
        Pointer {
            col,
            row,
            x,
            y: 5.0 + f32::from(row) * 20.0,
            cell_width: 10.0,
            height: 60.0,
            now_ns,
        }
    }

    fn click(vt: &mut Vt, col: u16, x: f32, now_ns: u64) {
        vt.select(Step::Press, at(col, 0, x, now_ns));
        vt.select(Step::Release, at(col, 0, x, now_ns));
    }

    #[test]
    fn a_drag_selects_and_a_single_click_clears() {
        let mut vt = Vt::new(30, 3);
        vt.write(b"hello world\r\nsecond line");
        vt.select(Step::Press, at(0, 0, 1.0, 1));
        vt.select(Step::Drag, at(4, 0, 48.0, 2));
        vt.select(Step::Release, at(4, 0, 48.0, 3));
        assert_eq!(vt.selection_text().as_deref(), Some("hello"));
        assert!(vt.frame().rows[0][0].selected);
        assert!(!vt.frame().rows[0][8].selected);
        // A click far from the last one, with no drag, clears it.
        click(&mut vt, 20, 205.0, 5_000_000_000);
        assert_eq!(vt.selection_text(), None);
        assert!(!vt.has_selection());
    }

    #[test]
    fn double_click_selects_a_word_and_triple_click_the_line() {
        let mut vt = Vt::new(30, 3);
        vt.write(b"hello world\r\nsecond line");
        let want = [None, Some("hello"), Some("hello world")];
        for (n, expected) in want.into_iter().enumerate() {
            click(&mut vt, 1, 14.0, 1_000 + n as u64 * 100_000_000);
            assert_eq!(vt.selection_text().as_deref(), expected, "click {}", n + 1);
        }
        // Slow clicks never add up.
        click(&mut vt, 1, 14.0, 9_000_000_000);
        assert_eq!(vt.selection_text(), None);
    }

    #[test]
    fn shift_click_moves_the_far_end_and_select_all_covers_history() {
        let mut vt = Vt::new(20, 8);
        vt.write(b"one two three\r\nfour");
        assert!(!vt.extend_selection(3, 0), "nothing to extend");
        vt.select(Step::Press, at(0, 0, 1.0, 1));
        vt.select(Step::Drag, at(2, 0, 28.0, 2));
        vt.select(Step::Release, at(2, 0, 28.0, 3));
        assert!(vt.extend_selection(6, 0));
        assert_eq!(vt.selection_text().as_deref(), Some("one two"));
        vt.write(b"\r\nfive\r\nsix\r\nseven\r\neight\r\nnine\r\nten\r\neleven");
        vt.select_all();
        let all = vt.selection_text().unwrap();
        assert!(
            all.starts_with("one two three") && all.ends_with("eleven"),
            "{all:?}"
        );
        assert!(all.contains("four"), "history included: {all:?}");
        // The alternate screen has no history: select-all covers only it.
        vt.write(b"\x1b[?1049hon the alt screen");
        vt.select_all();
        assert_eq!(vt.selection_text().as_deref(), Some("on the alt screen"));
    }

    #[test]
    fn the_selection_survives_scrolling() {
        let mut vt = Vt::new(20, 3);
        for n in 0..30 {
            vt.write(format!("line {n}\r\n").as_bytes());
        }
        vt.scroll_viewport(-10);
        vt.select(Step::Press, at(0, 1, 1.0, 1));
        vt.select(Step::Drag, at(5, 1, 55.0, 2));
        vt.select(Step::Release, at(5, 1, 55.0, 3));
        let text = vt.selection_text().unwrap();
        vt.scroll_viewport(10);
        assert_eq!(vt.selection_text().as_deref(), Some(text.as_str()));
        vt.scroll_viewport(-10);
        assert!(vt.frame().rows.iter().flatten().any(|c| c.selected));
    }

    #[test]
    fn a_wrapped_line_is_copied_whole_without_its_trailing_blanks() {
        let mut vt = Vt::new(10, 4);
        vt.write(b"0123456789abcdef   \r\nnext");
        vt.select(Step::Press, at(0, 0, 1.0, 1));
        vt.select(Step::Drag, at(9, 1, 98.0, 2));
        vt.select(Step::Release, at(9, 1, 98.0, 3));
        assert_eq!(vt.selection_text().as_deref(), Some("0123456789abcdef"));
    }

    #[test]
    fn a_drag_past_an_edge_asks_the_viewport_to_scroll_that_way() {
        let mut vt = Vt::new(20, 3);
        for n in 0..30 {
            vt.write(format!("line {n}\r\n").as_bytes());
        }
        vt.scroll_viewport(-10);
        vt.select(Step::Press, at(2, 1, 25.0, 1));
        let beyond = |y: f32| Pointer {
            y,
            ..at(2, 1, 25.0, 2)
        };
        vt.select(Step::Drag, beyond(30.0));
        assert_eq!(vt.drag_autoscroll(), 0, "inside the grid");
        vt.select(Step::Drag, beyond(-12.0));
        assert_eq!(vt.drag_autoscroll(), -1, "above it");
        vt.select(Step::Drag, beyond(75.0));
        assert_eq!(vt.drag_autoscroll(), 1, "below it");
    }
}
