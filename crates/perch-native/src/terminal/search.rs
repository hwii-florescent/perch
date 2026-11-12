// The search calls below (new, set needle, feed, tick, select next and previous, and the
// conversion of the viewport's match snapshots to row spans) follow `start_search`,
// `progress_search`, `search_navigate`, `feed_search` and `read_search_data` of `src/vt.rs` in
// herdr (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch. See THIRD_PARTY_NOTICES.md.

//! Finding text in the screen and its scrollback with Ghostty's search: it indexes in bounded
//! steps (never blocking the window), reports how many matches there are, selects one, and
//! scrolls the viewport to show it. It does not touch the copy selection.

use super::vt::Vt;
use ghostty_sys as g;
use std::ffi::c_void;

/// Where a search stands.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Progress {
    pub total: usize,
    /// The match navigation is on, counted from 0.
    pub selected: Option<usize>,
    /// Everything has been indexed; `total` is final.
    pub complete: bool,
}

/// A match in the viewport: cells `start..=end` of `row`. A match across rows is one span per row.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Span {
    pub row: u16,
    pub start: u16,
    pub end: u16,
    /// Navigation is on this match.
    pub selected: bool,
}

/// The search of a [`Vt`].
#[derive(Default)]
pub struct State {
    handle: Option<g::GhosttySearch>,
    active: bool,
    progress: Progress,
    pub(super) spans: Vec<Span>,
}

impl State {
    pub(super) fn free(&mut self) {
        if let Some(handle) = self.handle.take() {
            // SAFETY: freed once, before its terminal.
            unsafe { g::ghostty_search_free(handle) };
        }
    }
}

impl Vt {
    /// Search for `needle` (an empty one ends the search). Case does not matter.
    pub fn search(&mut self, needle: &str) {
        if self.search.handle.is_none() {
            if needle.is_empty() {
                return;
            }
            let mut handle = std::ptr::null_mut();
            // SAFETY: the out pointer is valid; the handle is freed in `State::free`.
            let result =
                unsafe { g::ghostty_search_new(std::ptr::null(), &mut handle, self.term()) };
            if result != g::GHOSTTY_SUCCESS || handle.is_null() {
                return;
            }
            self.search.handle = Some(handle);
        }
        let Some(handle) = self.search.handle else {
            return;
        };
        self.search.active = !needle.is_empty();
        let value = g::GhosttyString {
            ptr: needle.as_ptr(),
            len: needle.len(),
        };
        let value = if needle.is_empty() {
            std::ptr::null()
        } else {
            (&value as *const g::GhosttyString).cast::<c_void>()
        };
        // SAFETY: the needle option takes a string, or null to clear; `needle` outlives the call
        // (Ghostty copies it).
        let result = unsafe { g::ghostty_search_set(handle, g::GHOSTTY_SEARCH_OPT_NEEDLE, value) };
        if result != g::GHOSTTY_SUCCESS {
            return;
        }
        if self.search.active {
            self.feed_search();
            self.search_step();
        } else {
            self.search.progress = Progress::default();
            self.search.spans.clear();
        }
    }

    pub fn search_progress(&self) -> Progress {
        self.search.progress
    }

    /// The matches in the viewport, as row spans.
    pub fn search_spans(&self) -> &[Span] {
        &self.search.spans
    }

    /// One bounded unit of indexing; true when what is known changed. Interactive searches must
    /// not call Ghostty's blocking `run` on the window's thread.
    pub fn search_step(&mut self) -> bool {
        let Some(handle) = self.search.handle.filter(|_| self.search.active) else {
            return false;
        };
        let before = (self.search.progress, self.search.spans.clone());
        let mut status = g::GHOSTTY_SEARCH_STATUS_COMPLETE;
        // SAFETY: the key writes a status.
        unsafe {
            g::ghostty_search_get(
                handle,
                g::GHOSTTY_SEARCH_DATA_STATUS,
                (&mut status as *mut g::GhosttySearchStatus).cast(),
            );
        }
        if status == g::GHOSTTY_SEARCH_STATUS_FEED_REQUIRED {
            self.feed_search();
        }
        // SAFETY: the out pointer is valid.
        if unsafe { g::ghostty_search_tick(handle, &mut status) } == g::GHOSTTY_SUCCESS {
            self.read_search(handle, status);
        }
        before != (self.search.progress, self.search.spans.clone())
    }

    /// Select the next (toward older text) or previous match and scroll it into view. Only once
    /// indexing is complete: the select call catches up synchronously.
    pub fn search_navigate(&mut self, previous: bool) -> bool {
        let Some(handle) = self
            .search
            .handle
            .filter(|_| self.search.active && self.search.progress.complete)
        else {
            return false;
        };
        let option = if previous {
            g::GHOSTTY_SEARCH_OPT_SELECT_PREV
        } else {
            g::GHOSTTY_SEARCH_OPT_SELECT_NEXT
        };
        // SAFETY: the select options take no value.
        if unsafe { g::ghostty_search_set(handle, option, std::ptr::null()) } != g::GHOSTTY_SUCCESS
        {
            return false;
        }
        self.feed_search();
        true
    }

    /// Tell the search the screen changed. Called after anything that writes or scrolls.
    pub(super) fn feed_search(&mut self) {
        let Some(handle) = self.search.handle.filter(|_| self.search.active) else {
            return;
        };
        // SAFETY: plain call on the owned handle.
        if unsafe { g::ghostty_search_feed(handle) } != g::GHOSTTY_SUCCESS {
            return;
        }
        let mut status = g::GHOSTTY_SEARCH_STATUS_COMPLETE;
        // SAFETY: the key writes a status.
        unsafe {
            g::ghostty_search_get(
                handle,
                g::GHOSTTY_SEARCH_DATA_STATUS,
                (&mut status as *mut g::GhosttySearchStatus).cast(),
            );
        }
        self.read_search(handle, status);
    }

    fn read_search(&mut self, handle: g::GhosttySearch, status: g::GhosttySearchStatus) {
        let get = |key, out: *mut c_void| {
            // SAFETY: `out` is the type the key documents.
            unsafe { g::ghostty_search_get(handle, key, out) }
        };
        let mut total = 0usize;
        get(
            g::GHOSTTY_SEARCH_DATA_TOTAL_MATCHES,
            (&mut total as *mut usize).cast(),
        );
        let mut index = 0usize;
        let selected = (get(
            g::GHOSTTY_SEARCH_DATA_SELECTED_INDEX,
            (&mut index as *mut usize).cast(),
        ) == g::GHOSTTY_SUCCESS)
            .then_some(index);
        self.search.progress = Progress {
            total,
            selected,
            complete: status == g::GHOSTTY_SEARCH_STATUS_COMPLETE,
        };

        // Ghostty hands out snapshots of the viewport's matches, not pointers into the terminal:
        // turn them into spans now, before anything changes the screen.
        let blank = || g::GhosttySelection {
            size: std::mem::size_of::<g::GhosttySelection>(),
            ..Default::default()
        };
        let mut buffer = g::GhosttySelectionBuffer {
            ptr: std::ptr::null_mut(),
            cap: 0,
            len: 0,
        };
        let buffer_ptr = (&mut buffer as *mut g::GhosttySelectionBuffer).cast::<c_void>();
        let result = get(g::GHOSTTY_SEARCH_DATA_VIEWPORT_MATCHES, buffer_ptr);
        let mut matches = Vec::new();
        if result == g::GHOSTTY_OUT_OF_SPACE && buffer.len > 0 {
            matches = std::iter::repeat_with(blank).take(buffer.len).collect();
            buffer.ptr = matches.as_mut_ptr();
            buffer.cap = matches.len();
            buffer.len = 0;
            if get(g::GHOSTTY_SEARCH_DATA_VIEWPORT_MATCHES, buffer_ptr) != g::GHOSTTY_SUCCESS {
                self.search.spans.clear();
                return;
            }
        } else if result != g::GHOSTTY_SUCCESS {
            self.search.spans.clear();
            return;
        }
        let mut current = blank();
        let have_current = get(
            g::GHOSTTY_SEARCH_DATA_SELECTED_MATCH,
            (&mut current as *mut g::GhosttySelection).cast(),
        ) == g::GHOSTTY_SUCCESS;
        let (cols, rows) = self.size();
        let mut spans = Vec::new();
        for found in matches.iter().take(buffer.len) {
            let mut equal = false;
            if have_current {
                // SAFETY: both selections are fresh snapshots of this terminal.
                unsafe {
                    g::ghostty_terminal_selection_equal(self.term(), found, &current, &mut equal);
                }
            }
            let point = |r: &g::GhosttyGridRef| {
                let mut p = g::GhosttyPointCoordinate::default();
                // SAFETY: `r` is a fresh snapshot of this terminal.
                let ok = unsafe {
                    g::ghostty_terminal_point_from_grid_ref(
                        self.term(),
                        r,
                        g::GHOSTTY_POINT_TAG_VIEWPORT,
                        &mut p,
                    )
                } == g::GHOSTTY_SUCCESS;
                ok.then_some(p)
            };
            let (Some(mut start), Some(mut end)) = (point(&found.start), point(&found.end)) else {
                continue;
            };
            let swapped = (start.y, start.x) > (end.y, end.x);
            if swapped {
                std::mem::swap(&mut start, &mut end);
            }
            // A match ends on a wide character's first cell; cover its second too.
            let tail = if swapped { &found.start } else { &found.end };
            if self.grid_ref_is_wide(tail) {
                end.x += 1;
            }
            let last_row = end.y.min(u32::from(rows.saturating_sub(1)));
            if start.y >= u32::from(rows) {
                continue;
            }
            for row in start.y..=last_row {
                let first = if row == start.y { start.x } else { 0 };
                let last = if row == end.y {
                    end.x
                } else {
                    cols.saturating_sub(1)
                };
                if first <= last && first < cols {
                    spans.push(Span {
                        row: row as u16,
                        start: first,
                        end: last.min(cols.saturating_sub(1)),
                        selected: equal,
                    });
                }
            }
        }
        self.search.spans = spans;
    }

    fn grid_ref_is_wide(&self, r: &g::GhosttyGridRef) -> bool {
        let mut cell: g::GhosttyCell = Default::default();
        let mut wide: g::GhosttyCellWide = g::GHOSTTY_CELL_WIDE_NARROW;
        // SAFETY: `r` is a fresh snapshot; the keys write the types passed.
        unsafe {
            g::ghostty_grid_ref_cell(r, &mut cell) == g::GHOSTTY_SUCCESS
                && g::ghostty_cell_get(
                    cell,
                    g::GHOSTTY_CELL_DATA_WIDE,
                    (&mut wide as *mut g::GhosttyCellWide).cast(),
                ) == g::GHOSTTY_SUCCESS
                && wide == g::GHOSTTY_CELL_WIDE_WIDE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn indexed(vt: &mut Vt) -> Progress {
        for _ in 0..1000 {
            vt.search_step();
            if vt.search_progress().complete {
                break;
            }
        }
        vt.search_progress()
    }

    #[test]
    fn a_plain_query_matches_case_insensitively_on_screen_and_in_history() {
        let mut vt = Vt::new(30, 4);
        vt.write(b"Needle first\r\n");
        for n in 0..20 {
            vt.write(format!("filler {n}\r\n").as_bytes());
        }
        vt.write(b"another NEEDLE here\r\nlast needle");
        vt.search("needle");
        let progress = indexed(&mut vt);
        assert_eq!(progress.total, 3, "{progress:?}");
        // The viewport shows the two newest; the oldest is only in history.
        let spans: Vec<_> = vt
            .search_spans()
            .iter()
            .map(|s| (s.row, s.start, s.end))
            .collect();
        assert!(spans.contains(&(3, 5, 10)), "{spans:?}");
        // Navigation scrolls to the oldest match.
        assert!(vt.search_navigate(false));
        assert!(vt.search_navigate(false));
        assert!(vt.search_navigate(false));
        let frame = vt.frame();
        assert!(
            (0..4).any(|y| frame.row_text(y) == "Needle first"),
            "scrolled the oldest match into view: {:?}",
            (0..4).map(|y| frame.row_text(y)).collect::<Vec<_>>()
        );
        let selected = vt.search_progress().selected;
        assert!(selected.is_some());
        assert!(
            vt.search_spans().iter().any(|s| s.selected),
            "a selected match is in view"
        );
    }

    #[test]
    fn a_search_does_not_replace_the_copy_selection_and_ends_cleanly() {
        let mut vt = Vt::new(30, 4);
        vt.write(b"alpha beta\r\nbeta gamma");
        vt.select_all();
        vt.search("beta");
        indexed(&mut vt);
        vt.search_navigate(false);
        assert_eq!(
            vt.selection_text().as_deref(),
            Some("alpha beta\nbeta gamma")
        );
        vt.search("");
        assert_eq!(vt.search_progress(), Progress::default());
        assert!(vt.search_spans().is_empty());
        assert!(!vt.search_navigate(false), "no query, no navigation");
    }

    #[test]
    fn output_after_the_query_is_found_too() {
        let mut vt = Vt::new(30, 4);
        vt.write(b"one\r\n");
        vt.search("later");
        assert_eq!(indexed(&mut vt).total, 0);
        vt.write(b"match later\r\n");
        assert_eq!(indexed(&mut vt).total, 1);
    }
}
