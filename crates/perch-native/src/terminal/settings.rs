//! What the terminal looks like and how it behaves, from what the core tells every client.
//!
//! The web terminal builds itself from two things the core sends on connect: the user's own
//! terminal profile (`server.info`: font, size, colours, cursor) and the settings
//! (`settings.current`). This is the same, read the same way, so the native terminal looks like
//! the one the user already runs. Nothing here reads an iTerm2 or Ghostty file: the core did.
//! Missing pieces fall back to xterm.js's stock defaults, never to Perch's own palette.

use super::vt::{CursorShape, Rgb, Theme};
use perch_core::iterm_profile::TerminalProfile;
use perch_core::protocol::SettingsData;
use std::collections::BTreeMap;

/// Used when the core could not read a profile: the web terminal's generic stack.
pub const FALLBACK_FAMILIES: [&str; 6] = [
    "Menlo",
    "Monaco",
    "Courier New",
    "DejaVu Sans Mono",
    "Liberation Mono",
    "Consolas",
];
pub const FALLBACK_FONT_PX: f32 = 13.0;
pub const MIN_SCROLLBACK: u32 = 100;
pub const MAX_SCROLLBACK: u32 = 200_000;
pub const DEFAULT_SCROLLBACK: u32 = 10_000;

/// Whether Option types Alt sequences (`optionAsAlt`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum OptionAsAlt {
    /// The keyboard layout's characters.
    Off,
    /// Alt sequences. GPUI does not say which Option key is down, so `left` and `right` act as
    /// `auto` for both.
    #[default]
    Auto,
}

impl OptionAsAlt {
    fn parse(text: &str) -> Self {
        if text == "off" {
            Self::Off
        } else {
            Self::Auto
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Settings {
    /// The first installed family of the profile's, else of the generic stack.
    pub font_family: String,
    pub font_px: f32,
    pub theme: Theme,
    /// The shape and blink the cursor has until the program picks its own.
    pub cursor_shape: CursorShape,
    pub cursor_blink: bool,
    /// Space between the pane's edge and the grid, in logical pixels: `[x, y]`.
    pub padding: (f32, f32),
    pub opacity: f32,
    pub scrollbar: bool,
    /// A program may write the system clipboard (OSC 52).
    pub clipboard_write: bool,
    pub option_as_alt: OptionAsAlt,
    pub scrollback: usize,
    /// Releasing a mouse selection copies it, as iTerm2 does by default. The core has no setting
    /// for this, so it is the native terminal's own.
    pub copy_on_select: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            font_family: FALLBACK_FAMILIES[0].to_owned(),
            font_px: FALLBACK_FONT_PX,
            theme: Theme::default(),
            cursor_shape: CursorShape::Block,
            cursor_blink: false,
            padding: (0.0, 0.0),
            opacity: 1.0,
            scrollbar: true,
            clipboard_write: true,
            option_as_alt: OptionAsAlt::Auto,
            scrollback: DEFAULT_SCROLLBACK as usize,
            copy_on_select: true,
        }
    }
}

fn hex(text: &str) -> Option<Rgb> {
    let digits = text.strip_prefix('#')?;
    (digits.len() == 6 && digits.is_ascii()).then_some(())?;
    let byte = |i: usize| u8::from_str_radix(&digits[i..i + 2], 16).ok();
    Some(Rgb(byte(0)?, byte(2)?, byte(4)?))
}

/// The profile's palette for the OS appearance, as the web picks it: the dark or light variant
/// when the profile has one, else the single palette.
pub fn palette_for(profile: &TerminalProfile, dark: bool) -> Option<&BTreeMap<String, String>> {
    let scoped = if dark {
        &profile.theme_dark
    } else {
        &profile.theme_light
    };
    [scoped, &profile.theme]
        .into_iter()
        .find(|palette| !palette.is_empty())
}

/// Name of the 16 ANSI colours in the profile's palette, in order.
const ANSI: [&str; 16] = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightMagenta",
    "brightCyan",
    "brightWhite",
];

/// A theme from a profile palette over xterm's stock colours. A colour the palette lacks (or
/// cannot be read) keeps the stock one.
pub fn theme_from(palette: &BTreeMap<String, String>) -> Theme {
    let mut theme = Theme::default();
    let get = |key: &str| palette.get(key).and_then(|v| hex(v));
    if let Some(c) = get("foreground") {
        theme.fg = c;
        theme.cursor = c;
    }
    if let Some(c) = get("background") {
        theme.bg = c;
    }
    if let Some(c) = get("cursor") {
        theme.cursor = c;
    }
    theme.cursor_text = get("cursorAccent");
    theme.selection_bg = get("selectionBackground");
    theme.selection_fg = get("selectionForeground");
    for (slot, name) in theme.ansi.iter_mut().zip(ANSI) {
        if let Some(c) = get(name) {
            *slot = c;
        }
    }
    theme
}

/// The first of `wanted` (a CSS family, possibly a quoted list) and the generic stack that is
/// installed; the stack's first when none is, so the pane still draws.
pub fn pick_family(wanted: Option<&str>, installed: &[String]) -> String {
    let have = |name: &str| installed.iter().any(|f| f == name);
    wanted
        .into_iter()
        .flat_map(|list| list.split(','))
        .map(|name| name.trim().trim_matches(['"', '\'']))
        .chain(FALLBACK_FAMILIES)
        .find(|name| !name.is_empty() && have(name))
        .unwrap_or(FALLBACK_FAMILIES[0])
        .to_owned()
}

impl Settings {
    /// What the core told this client. `dark` is the window's appearance; `installed` the font
    /// families the machine has.
    pub fn from_core(
        profile: Option<&TerminalProfile>,
        data: Option<&SettingsData>,
        dark: bool,
        installed: &[String],
    ) -> Self {
        let mut settings = Self::default();
        if let Some(profile) = profile {
            if let Some(palette) = palette_for(profile, dark) {
                settings.theme = theme_from(palette);
            }
            settings.font_px = profile.font_size.map_or(FALLBACK_FONT_PX, |s| s as f32);
            settings.font_family = pick_family(profile.font_family.as_deref(), installed);
            settings.cursor_shape = match profile.cursor_style.as_deref() {
                Some("bar") => CursorShape::Bar,
                Some("underline") => CursorShape::Underline,
                _ => CursorShape::Block,
            };
            settings.cursor_blink = profile.cursor_blink.unwrap_or(false);
        } else {
            settings.font_family = pick_family(None, installed);
        }
        if let Some(data) = data {
            settings.theme.minimum_contrast = if data.minimum_contrast.is_finite() {
                data.minimum_contrast.clamp(1.0, 21.0) as f32
            } else {
                1.0
            };
            settings.clipboard_write = data.clipboard_write;
            settings.scrollbar = data.pane_scrollbars;
            let pad = |v: f64| {
                if v.is_finite() {
                    v.clamp(0.0, 64.0) as f32
                } else {
                    0.0
                }
            };
            settings.padding = (pad(data.terminal_padding[0]), pad(data.terminal_padding[1]));
            settings.opacity = if data.terminal_opacity.is_finite() {
                data.terminal_opacity.clamp(0.1, 1.0) as f32
            } else {
                1.0
            };
            settings.option_as_alt = OptionAsAlt::parse(&data.option_as_alt);
            settings.scrollback = data
                .terminal_scrollback
                .clamp(MIN_SCROLLBACK, MAX_SCROLLBACK) as usize;
        }
        settings
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile() -> TerminalProfile {
        let palette = |bg: &str, fg: &str| {
            BTreeMap::from([
                ("background".to_owned(), bg.to_owned()),
                ("foreground".to_owned(), fg.to_owned()),
                ("red".to_owned(), "#aa0000".to_owned()),
                ("selectionBackground".to_owned(), "#112233".to_owned()),
                ("cursorAccent".to_owned(), "#445566".to_owned()),
            ])
        };
        TerminalProfile {
            font_family: Some("MesloLGS NF".into()),
            font_size: Some(15.0),
            theme: palette("#101010", "#e0e0e0"),
            theme_light: palette("#fafafa", "#202020"),
            theme_dark: BTreeMap::new(),
            cursor_style: Some("bar".into()),
            cursor_blink: Some(true),
        }
    }

    #[test]
    fn the_profile_sets_colours_font_and_cursor_and_the_appearance_picks_the_palette() {
        let installed = vec!["MesloLGS NF".to_owned(), "Menlo".to_owned()];
        let dark = Settings::from_core(Some(&profile()), None, true, &installed);
        // No dark variant: the single palette.
        assert_eq!(dark.theme.bg, Rgb(0x10, 0x10, 0x10));
        assert_eq!(dark.theme.fg, Rgb(0xe0, 0xe0, 0xe0));
        assert_eq!(
            dark.theme.cursor,
            Rgb(0xe0, 0xe0, 0xe0),
            "cursor follows fg"
        );
        assert_eq!(dark.theme.ansi[1], Rgb(0xaa, 0, 0));
        assert_eq!(
            dark.theme.ansi[2],
            Theme::default().ansi[2],
            "stock colour kept"
        );
        assert_eq!(dark.theme.selection_bg, Some(Rgb(0x11, 0x22, 0x33)));
        assert_eq!(dark.theme.cursor_text, Some(Rgb(0x44, 0x55, 0x66)));
        assert_eq!(dark.font_family, "MesloLGS NF");
        assert_eq!(dark.font_px, 15.0);
        assert_eq!(dark.cursor_shape, CursorShape::Bar);
        assert!(dark.cursor_blink);
        let light = Settings::from_core(Some(&profile()), None, false, &installed);
        assert_eq!(light.theme.bg, Rgb(0xfa, 0xfa, 0xfa));
    }

    #[test]
    fn a_ghostty_config_becomes_the_look_the_same_way() {
        // The core falls back to Ghostty when iTerm2 gave nothing; the client cannot tell.
        let profile = perch_core::ghostty_profile::parse_config(
            "font-family = JetBrains Mono\nfont-size = 14\nbackground = #112233\nforeground = #eeeeee\npalette = 1=#ff0000\ncursor-style = bar\n",
        )
        .expect("a profile");
        let installed = vec!["JetBrains Mono".to_owned()];
        let s = Settings::from_core(Some(&profile), None, true, &installed);
        assert_eq!(s.theme.bg, Rgb(0x11, 0x22, 0x33));
        assert_eq!(s.theme.ansi[1], Rgb(0xff, 0, 0));
        assert_eq!(s.font_family, "JetBrains Mono");
        assert_eq!(s.font_px, 14.0);
        assert_eq!(s.cursor_shape, CursorShape::Bar);
    }

    #[test]
    fn a_missing_profile_is_xterms_stock_look_and_a_missing_font_is_menlo() {
        let none = Settings::from_core(None, None, true, &["Menlo".to_owned()]);
        assert_eq!(none, Settings::default());
        let installed = vec!["Monaco".to_owned()];
        let s = Settings::from_core(Some(&profile()), None, true, &installed);
        assert_eq!(
            s.font_family, "Monaco",
            "the stack's first installed family"
        );
        assert_eq!(
            pick_family(Some("\"Fira Code\", Menlo"), &["Menlo".into()]),
            "Menlo"
        );
    }

    #[test]
    fn settings_are_clamped_as_the_web_clamps_them() {
        let mut data: SettingsData =
            serde_json::from_str(r#"{"theme":"x"}"#).expect("a settings object");
        data.minimum_contrast = 99.0;
        data.terminal_padding = [100.0, -3.0];
        data.terminal_opacity = 0.0;
        data.terminal_scrollback = 5;
        data.option_as_alt = "off".into();
        data.clipboard_write = false;
        data.pane_scrollbars = false;
        let s = Settings::from_core(None, Some(&data), true, &[]);
        assert_eq!(s.theme.minimum_contrast, 21.0);
        assert_eq!(s.padding, (64.0, 0.0));
        assert_eq!(s.opacity, 0.1);
        assert_eq!(s.scrollback, 100);
        assert_eq!(s.option_as_alt, OptionAsAlt::Off);
        assert!(!s.clipboard_write && !s.scrollbar);
    }
}
