// The icon lookup in the bundled font, the test for a character the configured font lacks, the
// fitting of an icon into its cell and of an oversize fallback glyph into its width follow
// `icon_glyph`, `is_icon`, `fallback_icon`, the icon fitting in `row_ops` and `fallback_size` of
// `src/terminal.rs` in herdr (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch: the fitting is a pure
// function that can be tested without a text system, and the bundled font is added to the text
// system only when it is not there. See THIRD_PARTY_NOTICES.md.

//! Characters the configured font does not have. A private-use icon (a Nerd Font glyph in a
//! prompt or file tree) comes from the bundled symbols font, fitted to the cell by its outline;
//! any other fallback glyph wider than its cell is scaled down to fit it.

use gpui::{point, px, App, Font, Pixels, Point, TextSystem, WindowTextSystem};
use std::borrow::Cow;

/// Symbols Nerd Font (MIT), bundled so icons draw whatever fonts the machine has.
pub const SYMBOLS_FONT: &str = "Symbols Nerd Font";
const SYMBOLS_FONT_FILE: &[u8] = include_bytes!("../../assets/fonts/SymbolsNerdFont-Regular.ttf");

/// Make the bundled font known to `cx`'s text system, once for it.
pub fn install(cx: &mut App) {
    let system = cx.text_system();
    if system.all_font_names().iter().any(|n| n == SYMBOLS_FONT) {
        return;
    }
    // A font that cannot be added leaves icons to whatever the platform falls back to.
    let _ = system.add_fonts(vec![Cow::Borrowed(SYMBOLS_FONT_FILE)]);
}

/// An icon's glyph in the bundled font, with its outline's bounds in font units (y up).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct IconGlyph {
    pub id: u32,
    pub units_per_em: f32,
    pub x0: f32,
    pub y0: f32,
    pub x1: f32,
    pub y1: f32,
}

/// Read from the font file itself, not through text shaping: shaping may take the character from
/// another installed font (old Nerd Fonts put a squirrel where the markdown icon is now).
pub fn icon_glyph(c: char) -> Option<IconGlyph> {
    thread_local! {
        static FACE: Option<ttf_parser::Face<'static>> = ttf_parser::Face::parse(SYMBOLS_FONT_FILE, 0).ok();
    }
    FACE.with(|face| {
        let face = face.as_ref()?;
        let id = face.glyph_index(c)?;
        let b = face.glyph_bounding_box(id)?;
        Some(IconGlyph {
            id: u32::from(id.0),
            units_per_em: f32::from(face.units_per_em()),
            x0: f32::from(b.x_min),
            y0: f32::from(b.y_min),
            x1: f32::from(b.x_max),
            y1: f32::from(b.y_max),
        })
    })
}

/// A Nerd Font icon: one character in a Unicode private use area.
pub fn is_icon(text: &str) -> bool {
    let mut chars = text.chars();
    matches!(
        (chars.next(), chars.next()),
        (Some(c), None) if matches!(c as u32, 0xE000..=0xF8FF | 0xF0000..=0x10FFFD)
    )
}

/// The bundled font's glyph for `text`, when it is an icon the configured `font` lacks. An icon
/// the font has keeps the font's own proportions.
pub fn fallback_icon(
    text: &str,
    font: &Font,
    system: &TextSystem,
    font_px: Pixels,
) -> Option<IconGlyph> {
    let c = text.chars().next().filter(|_| is_icon(text))?;
    let id = system.resolve_font(font);
    if system.advance(id, font_px, c).is_ok() {
        return None;
    }
    icon_glyph(c)
}

/// Where an icon's glyph origin goes in its cell and at what size, to fit it by its outline:
/// centred, as tall as fits, and up to two cells wide when `room` says a space follows (prompts,
/// statuslines, file trees). `cell` is the cell's width and height.
pub fn fit_icon(icon: IconGlyph, cell: (f32, f32), room: f32) -> (Point<Pixels>, Pixels) {
    let (w, h) = (cell.0 * room, cell.1);
    let (gw, gh) = ((icon.x1 - icon.x0).max(1.0), (icon.y1 - icon.y0).max(1.0));
    // Up to about a cell and a half of two, so it does not touch the next word.
    let scale = (w * if room > 1.0 { 0.75 } else { 0.9 } / gw).min(h * 0.72 / gh);
    // Centred in its own cell; a wider icon starts at the cell and spills into the space after.
    let left = ((cell.0 - gw * scale) / 2.0).max(0.0) - icon.x0 * scale;
    let baseline = (h - gh * scale) / 2.0 + icon.y1 * scale;
    (point(px(left), px(baseline)), px(scale * icon.units_per_em))
}

/// The font size that fits a single fallback glyph into `width`, when the glyph comes from
/// another font and is wider: shaping at a cell width moves the glyph but does not resize it.
pub fn fallback_size(
    text: &str,
    wide: bool,
    font: &Font,
    width: Pixels,
    font_px: Pixels,
    system: &WindowTextSystem,
) -> Option<Pixels> {
    if wide || text.is_ascii() {
        return None;
    }
    let first = text.chars().next()?;
    let primary = system.resolve_font(font);
    if system.advance(primary, font_px, first).is_ok() {
        return None;
    }
    let run = gpui::TextRun {
        len: text.len(),
        font: font.clone(),
        color: Default::default(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = system.shape_line(text.to_owned().into(), font_px, &[run], None);
    (line.width() > width).then(|| font_px * f32::from(width) / f32::from(line.width()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn icons_are_the_private_use_characters_on_their_own() {
        assert!(is_icon("\u{e0a0}"));
        assert!(is_icon("\u{f0001}"));
        assert!(!is_icon("a"));
        assert!(!is_icon("\u{e0a0}x"));
        assert!(!is_icon(""));
    }

    #[test]
    fn the_bundled_font_has_the_icons_programs_draw() {
        // The git branch and the folder icons of a prompt.
        for c in ['\u{e0a0}', '\u{f07b}', '\u{f015}'] {
            let icon = icon_glyph(c).unwrap_or_else(|| panic!("no glyph for U+{:X}", c as u32));
            assert!(icon.x1 > icon.x0 && icon.y1 > icon.y0 && icon.units_per_em > 0.0);
        }
        assert_eq!(icon_glyph('a'), None);
    }

    #[test]
    fn an_icon_is_centred_in_its_cell_and_a_spacious_one_may_spill_over() {
        let icon = icon_glyph('\u{f07b}').unwrap();
        let cell = (8.0, 16.0);
        let (offset, size) = fit_icon(icon, cell, 1.0);
        let scale = f32::from(size) / icon.units_per_em;
        let width = (icon.x1 - icon.x0) * scale;
        let height = (icon.y1 - icon.y0) * scale;
        assert!(width <= cell.0 * 0.9 + 0.01 && height <= cell.1 * 0.72 + 0.01);
        // The outline sits centred across the cell and between its top and bottom.
        let left = f32::from(offset.x) + icon.x0 * scale;
        assert!((left - (cell.0 - width) / 2.0).abs() < 0.01 || left >= 0.0);
        let top = f32::from(offset.y) - icon.y1 * scale;
        assert!((top - (cell.1 - height) / 2.0).abs() < 0.01);
        // Given two cells it may be wider, never more than the two cells.
        let (_, roomy) = fit_icon(icon, cell, 2.0);
        assert!(roomy >= size);
        let roomy_width = (icon.x1 - icon.x0) * f32::from(roomy) / icon.units_per_em;
        assert!(roomy_width <= cell.0 * 2.0 * 0.75 + 0.01);
    }
}
