//! Reading the user's real terminal appearance out of their iTerm2 profile.
//!
//! Why this exists: perch used to paint CLI-mode terminals with *its own*
//! theme tokens — panel background, accent as the cursor, a 16-colour ramp
//! synthesised from the UI palette. That is wrong on its face. The thing in
//! that pane is the same `claude`/`codex` the user runs in iTerm2, and its
//! output is coloured by the *terminal's* palette, so substituting perch's
//! palette silently restyles the agent's UI into colours it never chose. The
//! user's ask was literal: look like iTerm2, don't overlay anything.
//!
//! macOS keeps iTerm2's settings in a plist, and the default profile is the
//! first entry of `New Bookmarks`. Colours are stored as sRGB component
//! dictionaries with 0..1 floats; the font as a single `"<PostScript-name>
//! <size>"` string. This module parses that into something the web client can
//! hand straight to xterm.js.
//!
//! Read once at boot and shipped in `server.info`. Deliberately best-effort:
//! no iTerm2, a different terminal, or a plist shape we don't recognise all
//! yield `None`, and the client then falls back to **xterm.js's own stock
//! defaults** — never to perch's UI theme, because the whole point is to stop
//! doing that.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

/// Everything needed to make an xterm.js instance look like the user's
/// terminal. Field names are already the client-facing camelCase.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    /// PostScript font name, e.g. `MesloLGS-NF-Regular`. Sent alongside
    /// `font_family` because the client needs the human family name for CSS
    /// but the plist only stores the PostScript one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
    /// xterm `ITheme` keys -> `#rrggbb`. Empty when nothing was parsed.
    #[serde(default)]
    pub theme: std::collections::BTreeMap<String, String>,
}

impl TerminalProfile {
    pub fn is_empty(&self) -> bool {
        self.font_family.is_none() && self.font_size.is_none() && self.theme.is_empty()
    }
}

/// iTerm2 colour key -> xterm.js theme key. `Ansi N Color` maps positionally
/// onto xterm's ramp, which uses the same 0-15 ordering.
const ANSI_KEYS: [&str; 16] = [
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

fn default_plist_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    Some(
        Path::new(&home)
            .join("Library")
            .join("Preferences")
            .join("com.googlecode.iterm2.plist"),
    )
}

/// Load the default (first) iTerm2 profile, or `None` if it isn't available.
pub fn load() -> Option<TerminalProfile> {
    let path = default_plist_path()?;
    if !path.exists() {
        return None;
    }
    load_from(&path)
}

/// Extract the default profile as JSON via `plutil`.
///
/// Shelling out to `plutil` rather than adding a plist crate is deliberate:
/// the file is in Apple's *binary* plist format, it is read exactly once at
/// boot, and `plutil` is part of the base OS. A dependency to parse one
/// optional cosmetic file at startup is not worth it.
///
/// Note the `-extract "New Bookmarks".0` rather than `-convert` on the whole
/// file: iTerm2's plist holds objects with no JSON representation (data blobs
/// among the non-profile settings), so converting the document wholesale
/// fails with "Invalid object in plist for JSON format". The default profile
/// subtree on its own is pure dictionaries, strings and numbers.
fn load_from(path: &Path) -> Option<TerminalProfile> {
    let out = Command::new("/usr/bin/plutil")
        .args(["-extract", "New Bookmarks.0", "json", "-o", "-", "--"])
        .arg(path)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let bookmark: serde_json::Value = serde_json::from_slice(&out.stdout).ok()?;
    parse_bookmark(&bookmark)
}

/// Build a profile from one iTerm2 bookmark (profile) dictionary. Split out
/// from the I/O so it can be unit-tested against a fixture.
///
/// Only the unsuffixed keys are read. iTerm2 also stores `… (Light)` /
/// `… (Dark)` variants, but those are only authoritative when the profile's
/// "Use Separate Colors for Light and Dark Mode" is on; the base keys always
/// hold the colours actually in effect, which is what we want to mirror.
pub fn parse_bookmark(bookmark: &serde_json::Value) -> Option<TerminalProfile> {
    let mut profile = TerminalProfile::default();

    // "MesloLGS-NF-Regular 13" -> family + size. The size is always the last
    // whitespace-separated token; everything before it is the PostScript name,
    // which may itself contain spaces.
    if let Some(font) = bookmark.get("Normal Font").and_then(|v| v.as_str()) {
        if let Some((name, size)) = font.rsplit_once(' ') {
            if let Ok(size) = size.parse::<f64>() {
                // Sanity-bound the size before it reaches xterm. A profile we
                // mis-parse (or an exotic `Normal Font` format) could yield 0
                // or something absurd, and xterm has no guard of its own: a
                // zero cell size makes `fit()` divide by zero and the pane
                // renders nothing at all. Out-of-range means "we don't
                // understand this", so drop the font entirely and let the
                // client use its default rather than force a wrong number.
                if (4.0..=72.0).contains(&size) {
                    profile.font_size = Some(size);
                    profile.font_family = Some(postscript_to_css_family(name));
                }
            }
        }
    }

    let mut put = |key: &str, iterm_key: &str| {
        if let Some(hex) = bookmark.get(iterm_key).and_then(color_to_hex) {
            profile.theme.insert(key.to_string(), hex);
        }
    };
    put("background", "Background Color");
    put("foreground", "Foreground Color");
    put("cursor", "Cursor Color");
    put("cursorAccent", "Cursor Text Color");
    put("selectionBackground", "Selection Color");
    put("selectionForeground", "Selected Text Color");
    for (i, key) in ANSI_KEYS.iter().enumerate() {
        put(key, &format!("Ansi {i} Color"));
    }

    if profile.is_empty() {
        None
    } else {
        Some(profile)
    }
}

/// iTerm2 stores a PostScript name (`MesloLGS-NF-Regular`); CSS wants the
/// family (`MesloLGS NF`). Dropping the trailing weight/style token and
/// turning hyphens into spaces recovers it for the overwhelmingly common
/// naming convention, and a wrong guess is harmless — the client appends a
/// monospace fallback chain, so an unmatched family just falls through.
fn postscript_to_css_family(ps_name: &str) -> String {
    const STYLE_SUFFIXES: [&str; 12] = [
        "Regular",
        "Book",
        "Medium",
        "Light",
        "Bold",
        "Italic",
        "Oblique",
        "Retina",
        "Mono",
        "BoldItalic",
        "SemiBold",
        "Thin",
    ];
    let base = match ps_name.rsplit_once('-') {
        Some((head, tail)) if STYLE_SUFFIXES.contains(&tail) => head,
        _ => ps_name,
    };
    base.replace('-', " ")
}

/// `{Red Component: 0.5, ...}` (0..1 sRGB floats) -> `#rrggbb`.
fn color_to_hex(value: &serde_json::Value) -> Option<String> {
    let component = |name: &str| -> Option<u8> {
        let f = value.get(name)?.as_f64()?;
        Some((f.clamp(0.0, 1.0) * 255.0).round() as u8)
    };
    let r = component("Red Component")?;
    let g = component("Green Component")?;
    let b = component("Blue Component")?;
    Some(format!("#{r:02x}{g:02x}{b:02x}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fixture() -> serde_json::Value {
        json!({
            "Name": "Default",
            "Normal Font": "MesloLGS-NF-Regular 13",
            "Background Color": {
                "Red Component": 0.117647, "Green Component": 0.117647,
                "Blue Component": 0.180392,
            },
            "Foreground Color": {
                "Red Component": 0.803922, "Green Component": 0.839216,
                "Blue Component": 0.956863,
            },
            "Ansi 1 Color": {
                "Red Component": 0.952941, "Green Component": 0.545098,
                "Blue Component": 0.658824,
            },
            // Must be ignored in favour of the unsuffixed key above.
            "Ansi 1 Color (Light)": {
                "Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0,
            },
        })
    }

    #[test]
    fn parses_font_and_colors_from_the_default_profile() {
        let p = parse_bookmark(&fixture()).unwrap();
        assert_eq!(p.font_family.as_deref(), Some("MesloLGS NF"));
        assert_eq!(p.font_size, Some(13.0));
        assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
        assert_eq!(p.theme.get("foreground").unwrap(), "#cdd6f4");
        assert_eq!(p.theme.get("red").unwrap(), "#f38ba8");
    }

    /// Keys the profile doesn't define must simply be absent, so the client
    /// leaves xterm's own default for them rather than inventing a colour.
    #[test]
    fn missing_keys_are_omitted_not_defaulted() {
        let p = parse_bookmark(&fixture()).unwrap();
        assert!(!p.theme.contains_key("green"));
        assert!(!p.theme.contains_key("cursor"));
    }

    /// Another user's profile is an arbitrary font at an arbitrary size, so
    /// the parse must not assume anything about either. A family we can't
    /// resolve is harmless (the client appends a generic monospace stack), but
    /// a nonsense *size* would break xterm's cell metrics, so it is dropped.
    #[test]
    fn other_users_fonts_parse_or_degrade_safely() {
        let with_font = |s: &str| {
            let mut b = fixture();
            b["Normal Font"] = json!(s);
            parse_bookmark(&b).unwrap()
        };

        // Ordinary alternatives.
        let p = with_font("JetBrainsMono-Regular 14");
        assert_eq!(p.font_family.as_deref(), Some("JetBrainsMono"));
        assert_eq!(p.font_size, Some(14.0));
        let p = with_font("Monaco 12");
        assert_eq!(p.font_family.as_deref(), Some("Monaco"));

        // Absurd or unparseable sizes: drop the font, keep the colours. The
        // profile is still useful, and the client falls back to its default
        // font rather than being handed a size that breaks `fit()`.
        for bad in [
            "Menlo 0",
            "Menlo -3",
            "Menlo 500",
            "Menlo",
            "Menlo notanumber",
        ] {
            let p = with_font(bad);
            assert_eq!(p.font_size, None, "{bad} should not yield a size");
            assert_eq!(p.font_family, None, "{bad} should not yield a family");
            assert!(!p.theme.is_empty(), "{bad} should still keep colours");
        }
    }

    /// A profile with no font at all, or no colours at all, must still return
    /// whichever half it does have rather than nothing.
    #[test]
    fn partial_profiles_return_the_half_that_exists() {
        let colours_only = json!({
            "Background Color": {
                "Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0,
            }
        });
        let p = parse_bookmark(&colours_only).unwrap();
        assert!(p.font_family.is_none());
        assert_eq!(p.theme.get("background").unwrap(), "#000000");

        let font_only = json!({ "Normal Font": "Monaco 12" });
        let p = parse_bookmark(&font_only).unwrap();
        assert!(p.theme.is_empty());
        assert_eq!(p.font_size, Some(12.0));
    }

    #[test]
    fn an_empty_bookmark_yields_nothing() {
        assert!(parse_bookmark(&json!({})).is_none());
        assert!(parse_bookmark(&json!({"Name": "Default"})).is_none());
    }

    #[test]
    fn postscript_names_become_css_families() {
        assert_eq!(
            postscript_to_css_family("MesloLGS-NF-Regular"),
            "MesloLGS NF"
        );
        assert_eq!(postscript_to_css_family("SFMono-Regular"), "SFMono");
        assert_eq!(postscript_to_css_family("Menlo"), "Menlo");
        // Unknown trailing token is kept — it is part of the family name.
        assert_eq!(
            postscript_to_css_family("JetBrainsMono-NF"),
            "JetBrainsMono NF"
        );
    }

    /// Reading the *real* profile must never panic or hang, whatever this
    /// machine happens to have installed. Result is intentionally unasserted:
    /// `None` is a legitimate outcome (no iTerm2, or a CI box).
    #[test]
    fn loading_the_real_profile_is_safe() {
        let _ = load();
    }
}
