//! The terminal's cell, and how many of them fit a pane.
//!
//! Follows the web terminal (`xtermSetup.ts`): a pane keeps at least [`MIN_COLS`] columns, the
//! width agent CLIs treat as the minimum sane one, by shrinking the font, never below
//! [`MIN_FONT_PX`], rather than handing the program fewer columns.

use gpui::{font, px, Font, FontStyle, FontWeight, Pixels, SharedString, Size, Window};

/// Columns a pane is kept at by scaling the font down.
pub const MIN_COLS: u16 = 80;
/// Past this, shrinking further is unreadable: a very narrow pane reflows instead.
pub const MIN_FONT_PX: f32 = 7.0;

/// Slack for a pane whose width is cols x cell exactly, which float layout can land a hair under.
const EPSILON: f32 = 0.01;

pub fn cell_font(family: &str, bold: bool, italic: bool) -> Font {
    let mut f = font(SharedString::from(family.to_owned()));
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

pub fn metrics(window: &Window, family: &str, font_px: f32) -> Metrics {
    let text = window.text_system();
    let scale = window.scale_factor();
    let id = text.resolve_font(&cell_font(family, false, false));
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
pub fn fit(window: &Window, available: Size<Pixels>, family: &str, base_px: f32) -> Fit {
    let width = f32::from(available.width);
    let columns = |m: &Metrics| ((width / f32::from(m.width) + EPSILON).floor()).max(0.0) as u32;
    let mut m = metrics(window, family, base_px);
    let target = u32::from(MIN_COLS);
    if width > 0.0 && columns(&m) < target {
        let per_column = width / MIN_COLS as f32;
        let tenth = |v: f32| (v * 10.0).floor() / 10.0;
        let mut size = tenth(base_px * per_column / f32::from(m.width)).max(MIN_FONT_PX);
        m = metrics(window, family, size);
        for _ in 0..2 {
            let cols = columns(&m);
            if cols >= target || size <= MIN_FONT_PX || cols == 0 {
                break;
            }
            size = tenth(size * cols as f32 / MIN_COLS as f32).max(MIN_FONT_PX);
            m = metrics(window, family, size);
        }
    }
    let rows = (f32::from(available.height) / f32::from(m.height) + EPSILON).floor();
    Fit {
        metrics: m,
        cols: columns(&m).clamp(1, u16::MAX as u32) as u16,
        rows: rows.clamp(1.0, u16::MAX as f32) as u16,
    }
}
