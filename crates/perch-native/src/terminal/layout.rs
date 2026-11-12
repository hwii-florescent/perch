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
    /// How far every glyph moves right in its cell, as Ghostty re-centres glyphs in a cell
    /// rounded to whole device pixels (its `renderGlyph`).
    pub glyph_x: Pixels,
}

// The glyph re-centring follows `glyph_x` of `src/terminal.rs` in herdr
// (https://github.com/herdrdev/herdr-app, commit 4c8c622d7965a6f6787f55b1896b70795fc68918),
// licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
// See THIRD_PARTY_NOTICES.md.

/// Ghostty's re-centring of glyphs in their cells, in device pixels: half the cell's difference
/// from the face's unrounded advance. CoreText keeps, when the cell is the narrower, only the
/// part under a whole pixel, so glyphs keep their subpixel phase without sliding a pixel left;
/// FreeType moves only into a wider cell, by whole pixels, to keep hinting.
pub fn glyph_x(cell_width: f32, face_width: f32) -> f32 {
    let dx = (cell_width - face_width) / 2.0;
    if cfg!(target_os = "macos") {
        if dx < 0.0 {
            dx - dx.trunc()
        } else {
            dx
        }
    } else if dx > 0.0 {
        dx.round()
    } else {
        0.0
    }
}

pub fn metrics(window: &Window, family: &str, font_px: f32) -> Metrics {
    let text = window.text_system();
    let scale = window.scale_factor();
    let id = text.resolve_font(&cell_font(family, false, false));
    let size = px(font_px);
    let device =
        |v: Pixels, round: fn(f32) -> f32| px(round(f32::from(v) * scale).max(1.0) / scale);
    // The cell is as wide as the widest printable ASCII advance, in whole device pixels.
    let face_width = (' '..='~')
        .filter_map(|c| text.advance(id, size, c).ok())
        .map(|s| f32::from(s.width) * scale)
        .reduce(f32::max)
        .unwrap_or(font_px * scale * 0.6);
    let cell_width = face_width.round().max(1.0);
    let ascent = text.ascent(id, size);
    let descent = text.descent(id, size).abs();
    Metrics {
        font_px,
        width: px(cell_width / scale),
        height: device(ascent + descent, f32::ceil),
        ascent,
        descent,
        glyph_x: px(glyph_x(cell_width, face_width) / scale),
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

#[cfg(test)]
mod tests {
    use super::*;

    /// (cell, face, CoreText, FreeType), in device pixels.
    #[test]
    fn glyphs_are_recentred_as_ghostty_does() {
        for (cell, face, core_text, free_type) in [
            (7.0, 7.2, -0.1, 0.0),
            (14.0, 14.4, -0.2, 0.0),
            (8.0, 8.0, 0.0, 0.0),
            // -1.3: the whole pixel is dropped.
            (7.0, 9.6, -0.3, 0.0),
            // A wider cell: all the way, or the nearest whole pixel.
            (8.0, 7.6, 0.2, 0.0),
            (9.0, 7.2, 0.9, 1.0),
        ] {
            let want = if cfg!(target_os = "macos") {
                core_text
            } else {
                free_type
            };
            let got = glyph_x(cell, face);
            assert!(
                (got - want).abs() < 1e-5,
                "cell {cell}, face {face}: {got}, want {want}"
            );
        }
    }
}
