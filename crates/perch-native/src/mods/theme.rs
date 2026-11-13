//! The web app's themes (`packages/web/src/themes.ts`) as the 18 tokens a screen draws with, and
//! the same colours in gpui-base's `Theme` global so its controls match.
//!
//! [`THEMES`] holds each theme's source palette as `themes.ts` keeps it (Catppuccin's two
//! flavours mapped onto Perch's roles as `catppuccinPalette` does); [`resolve`] applies
//! `resolveTheme` (every foreground moved toward the theme's text pole until it reads 4.5:1 on
//! every surface) and adds `backdrop` (`backdropFor`) and `card-bg` (the panel colour: this client
//! draws no glass). An unknown name is the default, `perch`.

use gpui::App;

/// The tokens a screen reads, by the names of the web's CSS custom properties without `--`.
pub const TOKENS: [&str; 18] = [
    "accent",
    "panel-bg",
    "surface-0",
    "surface-1",
    "surface-dim",
    "overlay-0",
    "overlay-1",
    "text",
    "subtext-0",
    "mauve",
    "green",
    "yellow",
    "red",
    "blue",
    "teal",
    "peach",
    "backdrop",
    "card-bg",
];

/// The theme used when none is chosen or the chosen one is unknown.
pub const DEFAULT: &str = "perch";

/// Each shipped theme's source palette: the first 16 [`TOKENS`], in that order.
pub const THEMES: &[(&str, [&str; 16])] = &[
    (
        "perch",
        [
            "#c8c8c8", "#161616", "#262626", "#333333", "#1c1c1c", "#3a3a3a", "#9b9b9b", "#d8d8d8",
            "#9b9b9b", "#a993c9", "#7fb685", "#d3b46a", "#df8c8c", "#7aa2d7", "#7fb8b8", "#d39a6a",
        ],
    ),
    (
        "catppuccin",
        [
            "#89b4fa", "#181825", "#313244", "#45475a", "#1e1e2e", "#6c7086", "#7f849c", "#cdd6f4",
            "#a6adc8", "#cba6f7", "#a6e3a1", "#f9e2af", "#f38ba8", "#89b4fa", "#94e2d5", "#fab387",
        ],
    ),
    (
        "catppuccin-latte",
        [
            "#1e66f5", "#eff1f5", "#e6e9ef", "#ccd0da", "#e6e9ef", "#9ca0b0", "#8c8fa1", "#4c4f69",
            "#6c6f85", "#8839ef", "#40a02b", "#df8e1d", "#d20f39", "#1e66f5", "#179299", "#fe640b",
        ],
    ),
    (
        "terminal",
        [
            "#0000ee", "#000000", "#121212", "#1c1c1c", "#000000", "#e5e5e5", "#ffffff", "#e5e5e5",
            "#e5e5e5", "#e5e5e5", "#00cd00", "#cdcd00", "#ff0000", "#0000ee", "#00cdcd", "#cdcd00",
        ],
    ),
    (
        "tokyo-night",
        [
            "#7aa2f7", "#1a1b26", "#24283b", "#292e42", "#1a1b26", "#565f89", "#697196", "#c0caf5",
            "#a9b1d6", "#bb9af7", "#9ece6a", "#e0af68", "#f7768e", "#7aa2f7", "#7dcfff", "#ff9e64",
        ],
    ),
    (
        "tokyo-night-day",
        [
            "#2959aa", "#e6e7ed", "#d6d8df", "#e1e2e8", "#d6d8df", "#c1c2c7", "#707280", "#343b59",
            "#4a5272", "#5a3e8e", "#485e30", "#8f5e15", "#942f2f", "#2959aa", "#006c86", "#965027",
        ],
    ),
    (
        "dracula",
        [
            "#bd93f9", "#282a36", "#343746", "#44475a", "#21222c", "#6272a4", "#828cb4", "#f8f8f2",
            "#d2d2dc", "#ff79c6", "#50fa7b", "#f1fa8c", "#ff5555", "#8be9fd", "#8be9fd", "#ffb86c",
        ],
    ),
    (
        "nord",
        [
            "#88c0d0", "#2e3440", "#3b4252", "#434c5e", "#2e3440", "#4c566a", "#646e82", "#d8dee9",
            "#d8dee9", "#b48ead", "#a3be8c", "#ebcb8b", "#bf616a", "#81a1c1", "#8fbcbb", "#d08770",
        ],
    ),
    (
        "gruvbox",
        [
            "#d79921", "#282828", "#3c3836", "#504945", "#282828", "#928374", "#a89984", "#ebdbb2",
            "#d5c4a1", "#d3869b", "#b8bb26", "#fabd2f", "#fb4934", "#83a598", "#8ec07c", "#fe8019",
        ],
    ),
    (
        "gruvbox-light",
        [
            "#076678", "#fbf1c7", "#ebdbb2", "#d5c4a1", "#f2e5bc", "#928374", "#7c6f64", "#3c3836",
            "#504945", "#8f3f71", "#79740e", "#b57614", "#9d0006", "#076678", "#427b58", "#af3a03",
        ],
    ),
    (
        "one-dark",
        [
            "#61afef", "#282c34", "#2c313a", "#3e4451", "#282c34", "#5c6370", "#737a87", "#abb2bf",
            "#969ca8", "#c678dd", "#98c379", "#e5c07b", "#e06c75", "#61afef", "#56b6c2", "#d19a66",
        ],
    ),
    (
        "one-light",
        [
            "#4078f2", "#fafafa", "#eaeaeb", "#e5e5e6", "#f5f5f6", "#a0a1a7", "#686b77", "#383a42",
            "#686b77", "#a626a4", "#50a14f", "#c18401", "#e45649", "#4078f2", "#0184bc", "#986801",
        ],
    ),
    (
        "solarized",
        [
            "#268bd2", "#002b36", "#073642", "#004454", "#00212b", "#586e75", "#657b83", "#93a1a1",
            "#839496", "#d33682", "#859900", "#b58900", "#dc322f", "#268bd2", "#2aa198", "#cb4b16",
        ],
    ),
    (
        "solarized-light",
        [
            "#268bd2", "#fdf6e3", "#eee8d5", "#eee8d5", "#eee8d5", "#93a1a1", "#586e75", "#657b83",
            "#586e75", "#d33682", "#859900", "#b58900", "#dc322f", "#268bd2", "#2aa198", "#cb4b16",
        ],
    ),
    (
        "kanagawa",
        [
            "#7e9cd8", "#1f1f28", "#2a2a37", "#363646", "#1f1f28", "#727169", "#87867d", "#dcd7ba",
            "#c8c093", "#957fb8", "#76946a", "#c0a36e", "#c34043", "#7e9cd8", "#7fb4ca", "#ffa066",
        ],
    ),
    (
        "kanagawa-lotus",
        [
            "#4d699b", "#f2ecbc", "#dcd5ac", "#c9cbd1", "#d5cea3", "#a09cac", "#8a8980", "#545464",
            "#43436c", "#624c83", "#6f894e", "#77713f", "#c84053", "#4d699b", "#4e8ca2", "#cc6d00",
        ],
    ),
    (
        "rose-pine",
        [
            "#c4a7e7", "#191724", "#1f1d2e", "#26233a", "#191724", "#6e6a86", "#908caa", "#e0def4",
            "#908caa", "#c4a7e7", "#31748f", "#f6c177", "#eb6f92", "#31748f", "#9ccfd8", "#ebbcba",
        ],
    ),
    (
        "rose-pine-dawn",
        [
            "#907aa9", "#faf4ed", "#f2e9e1", "#fffaf3", "#f2e9e1", "#9893a5", "#797593", "#575279",
            "#797593", "#907aa9", "#286983", "#ea9d34", "#b4637a", "#286983", "#56949f", "#d7827e",
        ],
    ),
    (
        "vesper",
        [
            "#ffc799", "#101010", "#232323", "#282828", "#101010", "#5c5c5c", "#7e7e7e", "#ffffff",
            "#a0a0a0", "#ffd1a8", "#99ffe4", "#ffc799", "#ff8080", "#b0b0b0", "#66ddcc", "#ffc799",
        ],
    ),
];

/// Indexes into a palette.
const PANEL: usize = 1;
const SURFACE_0: usize = 2;
const SURFACE_1: usize = 3;
const SURFACE_DIM: usize = 4;
const TEXT: usize = 7;
/// The colours `resolveTheme` keeps readable: text, subtext, overlay-1, accent and the accents.
const FOREGROUNDS: [usize; 11] = [7, 8, 6, 0, 9, 10, 11, 12, 13, 14, 15];

/// One theme, resolved: its name, whether it is light, and the 18 tokens as `#rrggbb`.
#[derive(Clone, Debug, PartialEq)]
pub struct Theme {
    pub name: String,
    pub light: bool,
    pub tokens: [String; 18],
}

impl Theme {
    /// The colour of `token`, `#rrggbb`.
    pub fn token(&self, token: &str) -> Option<&str> {
        let at = TOKENS.iter().position(|t| *t == token)?;
        Some(&self.tokens[at])
    }
}

/// Every theme's name, the default first.
pub fn names() -> Vec<&'static str> {
    THEMES.iter().map(|(name, _)| *name).collect()
}

fn rgb(hex: &str) -> [f64; 3] {
    let channel = |at: usize| {
        hex.get(at..at + 2)
            .and_then(|c| u8::from_str_radix(c, 16).ok())
            .unwrap_or(0) as f64
    };
    [channel(1), channel(3), channel(5)]
}

fn hex(rgb: [f64; 3]) -> String {
    // `Math.round` on values that are never negative.
    format!(
        "#{:02x}{:02x}{:02x}",
        rgb[0].round() as u8,
        rgb[1].round() as u8,
        rgb[2].round() as u8
    )
}

fn luminance(hex: &str) -> f64 {
    let [r, g, b] = rgb(hex).map(|v| {
        let v = v / 255.0;
        if v <= 0.04045 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    });
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

fn contrast(a: &str, b: &str) -> f64 {
    let (x, y) = (luminance(a), luminance(b));
    (x.max(y) + 0.05) / (x.min(y) + 0.05)
}

/// `a` mixed with `pct` percent of `b`.
fn mix(a: &str, b: &str, pct: f64) -> String {
    let (a, b) = (rgb(a), rgb(b));
    hex([0, 1, 2].map(|i| a[i] * (1.0 - pct / 100.0) + b[i] * pct / 100.0))
}

/// `backdropFor`: the panel colour pushed just far enough (1.12:1) to read as a layer behind the
/// cards; toward black, else toward the text colour.
fn backdrop(panel: &str, text: &str) -> String {
    for (toward, max) in [("#000000", 90), (text, 40)] {
        for pct in (4..=max).step_by(2) {
            let candidate = mix(panel, toward, pct as f64);
            if contrast(&candidate, panel) >= 1.12 {
                return candidate;
            }
        }
    }
    mix(panel, text, 40.0)
}

/// `resolveTheme` plus `backdrop` and `card-bg`, for `name` (the default when unknown).
pub fn resolve(name: &str) -> Theme {
    let (name, source) = THEMES
        .iter()
        .find(|(n, _)| *n == name)
        .unwrap_or(&THEMES[0]);
    let light = luminance(source[PANEL]) > 0.179;
    let backgrounds = [
        source[PANEL],
        source[SURFACE_0],
        source[SURFACE_1],
        source[SURFACE_DIM],
    ];
    let mut palette: Vec<String> = source.iter().map(|c| c.to_string()).collect();
    let pole = if light { 0.0 } else { 255.0 };
    for key in FOREGROUNDS {
        let from = rgb(source[key]);
        for step in 0..=100 {
            let candidate = hex(from.map(|v| v + (pole - v) * step as f64 / 100.0));
            if backgrounds.iter().all(|bg| contrast(&candidate, bg) >= 4.5) {
                palette[key] = candidate;
                break;
            }
        }
    }
    palette.push(backdrop(&palette[PANEL], &palette[TEXT]));
    palette.push(palette[PANEL].clone());
    Theme {
        name: name.to_string(),
        light,
        tokens: palette
            .try_into()
            .unwrap_or_else(|_| unreachable!("16 + 2 tokens")),
    }
}

/// Puts `theme` into gpui-base's `Theme` global, which its controls and `cx.theme()` read.
pub fn apply(theme: &Theme, cx: &mut App) {
    let t = |token: &str| theme.token(token).unwrap_or("#000000").to_string();
    let palette = serde_json::json!({
        "background": t("panel-bg"), "foreground": t("text"),
        "surface": t("card-bg"), "surface_foreground": t("text"),
        "primary": t("accent"), "primary_foreground": t("panel-bg"),
        "secondary": t("surface-0"), "secondary_foreground": t("text"),
        "muted": t("surface-0"), "muted_foreground": t("subtext-0"),
        "accent": t("surface-1"), "accent_foreground": t("text"),
        "destructive": t("red"), "destructive_foreground": t("panel-bg"),
        "border": t("overlay-0"), "input": t("overlay-0"), "ring": t("accent"),
    });
    match serde_json::from_value::<gpui_base::ColorTokens>(palette) {
        Ok(colors) => {
            let global = gpui_base::Theme::global_mut(cx);
            global.appearance = if theme.light {
                gpui_base::ThemeAppearance::Light
            } else {
                gpui_base::ThemeAppearance::Dark
            };
            global.tokens.colors = colors;
        }
        Err(error) => eprintln!(
            "perch-native: theme {} did not map onto mod tokens: {error}",
            theme.name
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The values `<html>` carries in the web app (the web reference's section 7).
    const PERCH: [&str; 18] = [
        "#c8c8c8", "#161616", "#262626", "#333333", "#1c1c1c", "#3a3a3a", "#9b9b9b", "#d8d8d8",
        "#9b9b9b", "#a993c9", "#7fb685", "#d3b46a", "#df8c8c", "#7aa2d7", "#7fb8b8", "#d39a6a",
        "#050505", "#161616",
    ];
    const LATTE: [&str; 18] = [
        "#1851c2", "#eff1f5", "#e6e9ef", "#ccd0da", "#e6e9ef", "#9ca0b0", "#575964", "#4c4f69",
        "#555869", "#7230c9", "#29661c", "#7b4e10", "#b30d30", "#1851c2", "#106368", "#983c07",
        "#e1e3e6", "#eff1f5",
    ];

    #[test]
    fn the_two_reference_themes_resolve_to_the_web_values() {
        for (name, want, light) in [("perch", PERCH, false), ("catppuccin-latte", LATTE, true)] {
            let theme = resolve(name);
            assert_eq!(theme.tokens.map(|t| t), want.map(String::from), "{name}");
            assert_eq!(theme.light, light, "{name}");
        }
    }

    #[test]
    fn an_unknown_theme_is_the_default_and_every_theme_resolves() {
        assert_eq!(resolve("no-such").name, DEFAULT);
        assert_eq!(names()[0], DEFAULT);
        assert_eq!(names().len(), 19);
        for name in names() {
            let theme = resolve(name);
            assert!(
                theme
                    .tokens
                    .iter()
                    .all(|t| t.len() == 7 && t.starts_with('#')),
                "{name}"
            );
        }
    }
}
