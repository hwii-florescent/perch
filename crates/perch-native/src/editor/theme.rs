//! Syntax colours from Perch's theme tokens, as the web's `editorSyntax.ts` takes them from CSS variables: the
//! highlighter names a kind (`keyword`, `string`, ...), [`SyntaxColours`] maps each kind to one of nine theme
//! tokens. The palette is read on every paint, so [`set_theme`] recolours an open editor on its next frame without
//! reparsing it.

use crate::mods::theme::{self, Theme};
use gpui::{FontStyle, FontWeight, HighlightStyle, Hsla};
use gpui_base::input::HighlightStyleResolver;
use std::sync::{Arc, LazyLock, RwLock};

/// The theme tokens the mapping uses, as `editorSyntax.ts` `SYNTAX_VARS` names them.
pub const SYNTAX_TOKENS: [&str; 9] = [
    "mauve",
    "green",
    "peach",
    "blue",
    "yellow",
    "teal",
    "overlay-1",
    "red",
    "text",
];

/// Each kind the highlighter emits: its token (an index into [`SYNTAX_TOKENS`]), italic, bold. The web's
/// `syntaxStyle` rule for rule.
const KINDS: [(&str, Option<usize>, bool, bool); 10] = [
    ("keyword", Some(0), false, false),
    ("string", Some(1), false, false),
    ("number", Some(2), false, false),
    ("function", Some(3), false, false),
    ("type", Some(4), false, false),
    ("tag", Some(5), false, false),
    ("comment", Some(6), true, false),
    ("invalid", Some(7), false, false),
    ("heading", None, false, true),
    ("emphasis", None, true, false),
];

/// The kind names, in the highlighter's order.
pub fn kind_name(kind: u8) -> &'static str {
    KINDS[kind as usize].0
}

/// How many kinds there are.
pub const KIND_COUNT: u8 = KINDS.len() as u8;

/// Resolves the highlighter's kinds to colours from the current palette.
pub struct SyntaxColours(RwLock<[Hsla; 9]>);

impl SyntaxColours {
    pub fn new(theme: &Theme) -> Self {
        Self(RwLock::new(palette(theme)))
    }

    /// Takes `theme`'s colours; editors pick them up on their next paint.
    pub fn set(&self, theme: &Theme) {
        *self.0.write().unwrap_or_else(|e| e.into_inner()) = palette(theme);
    }
}

fn palette(theme: &Theme) -> [Hsla; 9] {
    SYNTAX_TOKENS.map(|token| hex(theme.token(token).unwrap_or("#000000")))
}

fn hex(value: &str) -> Hsla {
    let n = u32::from_str_radix(value.trim_start_matches('#'), 16).unwrap_or(0);
    gpui::rgb(n).into()
}

impl HighlightStyleResolver for SyntaxColours {
    fn style(&self, name: &str) -> Option<HighlightStyle> {
        let (_, token, italic, bold) = KINDS.iter().find(|(kind, ..)| *kind == name)?;
        let palette = self.0.read().unwrap_or_else(|e| e.into_inner());
        Some(HighlightStyle {
            color: token.map(|t| palette[t]),
            font_style: italic.then_some(FontStyle::Italic),
            font_weight: bold.then_some(FontWeight::BOLD),
            ..Default::default()
        })
    }
}

static COLOURS: LazyLock<Arc<SyntaxColours>> =
    LazyLock::new(|| Arc::new(SyntaxColours::new(&theme::resolve(theme::DEFAULT))));

/// The palette every Perch editor paints with.
pub fn colours() -> Arc<SyntaxColours> {
    COLOURS.clone()
}

/// Moves every Perch editor to `theme` (called where the window applies a theme).
pub fn set_theme(theme: &Theme) {
    COLOURS.set(theme);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_token_is_a_theme_token_and_themes_colour_differently() {
        for token in SYNTAX_TOKENS {
            assert!(theme::TOKENS.contains(&token), "{token}");
        }
        let colours = SyntaxColours::new(&theme::resolve("perch"));
        let before = colours.style("keyword").unwrap().color;
        colours.set(&theme::resolve("catppuccin-latte"));
        let after = colours.style("keyword").unwrap().color;
        assert_ne!(before, after, "a theme switch recolours a kind");
        assert_eq!(
            colours.style("comment").unwrap().font_style,
            Some(FontStyle::Italic)
        );
        assert!(colours.style("heading").unwrap().color.is_none());
        assert!(colours.style("no-such-kind").is_none());
        for kind in 0..KIND_COUNT {
            assert!(colours.style(kind_name(kind)).is_some());
        }
    }
}
