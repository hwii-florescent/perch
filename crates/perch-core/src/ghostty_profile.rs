//! Reading the user's Ghostty config into the same [`TerminalProfile`] shape
//! `iterm_profile` produces, for the same reason: perch must never substitute
//! its own theme for the pane's real terminal, and this is the Ghostty-shaped
//! half of "look like the terminal the user actually runs".
//!
//! Ghostty's config is a flat text file, `key = value` per line, `#` for
//! comments — no plist, no shelling out needed. Deliberately best-effort,
//! same as `iterm_profile`: no Ghostty, no config file, or a shape we don't
//! recognise all yield `None`/empty fields, never a guessed value.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::iterm_profile::{TerminalProfile, ANSI_KEYS};

fn default_config_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(xdg) = std::env::var_os("XDG_CONFIG_HOME") {
        paths.push(Path::new(&xdg).join("ghostty").join("config"));
    } else if let Some(home) = std::env::var_os("HOME") {
        paths.push(
            Path::new(&home)
                .join(".config")
                .join("ghostty")
                .join("config"),
        );
    }
    if let Some(home) = std::env::var_os("HOME") {
        paths.push(
            Path::new(&home)
                .join("Library")
                .join("Application Support")
                .join("com.mitchellh.ghostty")
                .join("config"),
        );
    }
    paths
}

/// Load the first Ghostty config found on disk, or `None` if none exist / none
/// parse into anything usable.
pub fn load() -> Option<TerminalProfile> {
    for path in default_config_paths() {
        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Some(profile) = parse_config(&text) {
                return Some(profile);
            }
        }
    }
    None
}

/// Parse Ghostty config *text* into a profile. Split from the I/O so it can
/// be unit-tested without touching the filesystem.
///
/// `theme = light:X,dark:Y` is deliberately ignored: resolving a named theme
/// to actual colours would mean shipping Ghostty's bundled theme files, and
/// fabricating colours is exactly what this module must never do. A config
/// that only sets `theme` yields empty palettes, same as one that sets
/// nothing at all — the client falls back to xterm's stock defaults.
pub fn parse_config(text: &str) -> Option<TerminalProfile> {
    let mut profile = TerminalProfile::default();
    let mut palette: BTreeMap<usize, String> = BTreeMap::new();

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            continue;
        }

        match key {
            "font-family" => {
                let name = value.trim_matches('"').trim_matches('\'');
                if !name.is_empty() {
                    profile.font_family = Some(name.to_string());
                }
            }
            "font-size" => {
                if let Ok(size) = value.parse::<f64>() {
                    // Same sanity bound as iTerm2's parse: a bogus size must
                    // not reach xterm's `fit()`, which divides by cell size.
                    if (4.0..=72.0).contains(&size) {
                        profile.font_size = Some(size);
                    }
                }
            }
            "background" => {
                if let Some(hex) = normalize_hex(value) {
                    profile.theme.insert("background".to_string(), hex);
                }
            }
            "foreground" => {
                if let Some(hex) = normalize_hex(value) {
                    profile.theme.insert("foreground".to_string(), hex);
                }
            }
            "cursor-color" => {
                if let Some(hex) = normalize_hex(value) {
                    profile.theme.insert("cursor".to_string(), hex);
                }
            }
            "selection-background" => {
                if let Some(hex) = normalize_hex(value) {
                    profile.theme.insert("selectionBackground".to_string(), hex);
                }
            }
            "selection-foreground" => {
                if let Some(hex) = normalize_hex(value) {
                    profile.theme.insert("selectionForeground".to_string(), hex);
                }
            }
            "cursor-style" => {
                // Ghostty already speaks xterm's vocabulary here; only pass
                // through the values xterm.js actually recognises.
                if matches!(value, "block" | "bar" | "underline") {
                    profile.cursor_style = Some(value.to_string());
                }
            }
            "cursor-style-blink" => match value {
                "true" => profile.cursor_blink = Some(true),
                "false" => profile.cursor_blink = Some(false),
                _ => {}
            },
            "palette" => {
                // `palette = N=#rrggbb`, repeatable, N in 0..=15.
                if let Some((idx, hex)) = value.split_once('=') {
                    if let Ok(idx) = idx.trim().parse::<usize>() {
                        if idx < ANSI_KEYS.len() {
                            if let Some(hex) = normalize_hex(hex.trim()) {
                                palette.insert(idx, hex);
                            }
                        }
                    }
                }
            }
            // Includes `theme` (see doc comment above) and anything else we
            // don't recognise: ignored rather than guessed at.
            _ => {}
        }
    }

    for (idx, hex) in palette {
        profile.theme.insert(ANSI_KEYS[idx].to_string(), hex);
    }

    if profile.is_empty() {
        None
    } else {
        Some(profile)
    }
}

/// `#rrggbb` or bare `rrggbb` -> lowercase `#rrggbb`. Anything else (a named
/// colour, an rgba() form, garbage) is a shape we don't parse, so `None`.
fn normalize_hex(value: &str) -> Option<String> {
    let hex = value.strip_prefix('#').unwrap_or(value);
    if hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(format!("#{}", hex.to_lowercase()))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_font_and_colors() {
        let cfg = r#"
            font-family = JetBrains Mono
            font-size = 13
            background = #1e1e2e
            foreground = cdd6f4
        "#;
        let p = parse_config(cfg).unwrap();
        assert_eq!(p.font_family.as_deref(), Some("JetBrains Mono"));
        assert_eq!(p.font_size, Some(13.0));
        assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
        assert_eq!(p.theme.get("foreground").unwrap(), "#cdd6f4");
    }

    #[test]
    fn both_hash_and_bare_hex_spellings_parse() {
        let cfg = "background = #112233\nforeground = 445566";
        let p = parse_config(cfg).unwrap();
        assert_eq!(p.theme.get("background").unwrap(), "#112233");
        assert_eq!(p.theme.get("foreground").unwrap(), "#445566");
    }

    #[test]
    fn palette_entries_map_positionally_onto_ansi_keys() {
        let cfg = "palette = 1=#ff0000\npalette = 9=#ff8080\npalette = 0=112233";
        let p = parse_config(cfg).unwrap();
        assert_eq!(p.theme.get("red").unwrap(), "#ff0000");
        assert_eq!(p.theme.get("brightRed").unwrap(), "#ff8080");
        assert_eq!(p.theme.get("black").unwrap(), "#112233");
    }

    #[test]
    fn out_of_range_palette_index_is_ignored() {
        let cfg = "palette = 16=#ff0000\npalette = 99=#00ff00";
        assert!(parse_config(cfg).is_none());
    }

    #[test]
    fn cursor_style_values_pass_through_and_unknown_stays_none() {
        for style in ["block", "bar", "underline"] {
            let cfg = format!("cursor-style = {style}\nbackground = #000000");
            let p = parse_config(&cfg).unwrap();
            assert_eq!(p.cursor_style.as_deref(), Some(style));
        }
        let cfg = "cursor-style = beam\nbackground = #000000";
        let p = parse_config(cfg).unwrap();
        assert_eq!(p.cursor_style, None);
    }

    #[test]
    fn cursor_blink_bool_parses() {
        let cfg = "cursor-style-blink = true\nbackground = #000000";
        assert_eq!(parse_config(cfg).unwrap().cursor_blink, Some(true));
        let cfg = "cursor-style-blink = false\nbackground = #000000";
        assert_eq!(parse_config(cfg).unwrap().cursor_blink, Some(false));
    }

    #[test]
    fn comments_blank_lines_and_malformed_lines_are_skipped() {
        let cfg = r#"
            # this is a comment
            background = #1e1e2e

            this-line-has-no-equals-sign
            = missing-key
            foreground =
        "#;
        let p = parse_config(cfg).unwrap();
        assert_eq!(p.theme.len(), 1);
        assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
    }

    /// `theme = light:X,dark:Y` must never be turned into fabricated colours.
    #[test]
    fn named_theme_key_does_not_synthesize_colours() {
        let cfg = "theme = light:catppuccin-latte,dark:catppuccin-mocha";
        assert!(parse_config(cfg).is_none());

        let cfg = "theme = light:catppuccin-latte,dark:catppuccin-mocha\nbackground = #1e1e2e";
        let p = parse_config(cfg).unwrap();
        assert!(p.theme_light.is_empty());
        assert!(p.theme_dark.is_empty());
        assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
    }

    #[test]
    fn a_config_with_none_of_the_recognised_keys_yields_none() {
        let cfg = r#"
            # nothing perch understands here
            some-unrelated-setting = 42
            another-one = yes
        "#;
        assert!(parse_config(cfg).is_none());
    }

    #[test]
    fn an_empty_config_yields_none() {
        assert!(parse_config("").is_none());
        assert!(parse_config("   \n  \n").is_none());
    }

    /// Reading the *real* config must never panic or hang, whatever this
    /// machine happens to have installed. `None` is a legitimate outcome.
    #[test]
    fn loading_the_real_config_is_safe() {
        let _ = load();
    }
}
