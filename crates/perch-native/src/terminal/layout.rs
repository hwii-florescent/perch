//! The terminal's cell, and how many of them fit a pane.
//!
//! Follows the web terminal (`xtermSetup.ts`): a pane keeps at least [`MIN_COLS`] columns, the
//! width agent CLIs treat as the minimum sane one, by shrinking the font, never below
//! [`MIN_FONT_PX`], rather than handing the program fewer columns.

use gpui::{font, px, Font, FontStyle, FontWeight, Pixels, Size, Window};

/// Columns a pane is kept at by scaling the font down.
pub const MIN_COLS: u16 = 80;
/// Past this, shrinking further is unreadable: a very narrow pane reflows instead.
pub const MIN_FONT_PX: f32 = 7.0;
/// The size the web terminal uses when the computer has no terminal profile to read.
pub const DEFAULT_FONT_PX: f32 = 13.0;
/// The first family of the web terminal's generic stack; a computer without it falls back to
/// GPUI's default fonts.
pub const FONT_FAMILY: &str = "Menlo";
/// Space around the grid, in logical pixels.
pub const PAD_X: f32 = 8.0;
pub const PAD_Y: f32 = 6.0;

/// Slack for a pane whose width is cols x cell exactly, which float layout can land a hair under.
const EPSILON: f32 = 0.01;

pub fn cell_font(bold: bool, italic: bool) -> Font {
    let mut f = font(FONT_FAMILY);
    if bold {
        f.weight = FontWeight::BOLD;
    }
    if italic {
        f.style = FontStyle::Italic;
    }
    f
}

/// One cell at one font size, in logical pixels rounded to whole device pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Metrics {
    pub font_px: f32,
    pub width: Pixels,
    pub height: Pixels,
    /// From the top of the line to its baseline.
    pub ascent: Pixels,
    pub descent: Pixels,
}

pub fn metrics(window: &Window, font_px: f32) -> Metrics {
    let text = window.text_system();
    let scale = window.scale_factor();
    let id = text.resolve_font(&cell_font(false, false));
    let size = px(font_px);
    let device =
        |v: Pixels, round: fn(f32) -> f32| px(round(f32::from(v) * scale).max(1.0) / scale);
    let advance = text
        .advance(id, size, 'M')
        .map_or(px(font_px * 0.6), |s| s.width);
    let ascent = text.ascent(id, size);
    let descent = text.descent(id, size).abs();
    Metrics {
        font_px,
        width: device(advance, f32::round),
        height: device(ascent + descent, f32::ceil),
        ascent,
        descent,
    }
}

/// The font size and grid that fit a pane.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Fit {
    pub metrics: Metrics,
    pub cols: u16,
    pub rows: u16,
}

/// The grid inside `available` (the pane less its padding) at `base_px`, shrinking the font to
/// keep [`MIN_COLS`] columns. The size is computed, then corrected from the measured column
/// count at most twice, always downward, so the grid never passes through a wider shape.
pub fn fit(window: &Window, available: Size<Pixels>, base_px: f32) -> Fit {
    let width = f32::from(available.width);
    let columns = |m: &Metrics| ((width / f32::from(m.width) + EPSILON).floor()).max(0.0) as u32;
    let mut m = metrics(window, base_px);
    let target = u32::from(MIN_COLS);
    if width > 0.0 && columns(&m) < target {
        let per_column = width / MIN_COLS as f32;
        let tenth = |v: f32| (v * 10.0).floor() / 10.0;
        let mut size = tenth(base_px * per_column / f32::from(m.width)).max(MIN_FONT_PX);
        m = metrics(window, size);
        for _ in 0..2 {
            let cols = columns(&m);
            if cols >= target || size <= MIN_FONT_PX || cols == 0 {
                break;
            }
            size = tenth(size * cols as f32 / MIN_COLS as f32).max(MIN_FONT_PX);
            m = metrics(window, size);
        }
    }
    let rows = (f32::from(available.height) / f32::from(m.height) + EPSILON).floor();
    Fit {
        metrics: m,
        cols: columns(&m).clamp(1, u16::MAX as u32) as u16,
        rows: rows.clamp(1.0, u16::MAX as f32) as u16,
    }
}
