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

use std::collections::BTreeMap;
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
    pub theme: BTreeMap<String, String>,
    /// Appearance-specific palettes, when the source terminal defines them
    /// (iTerm2's `… (Light)` / `… (Dark)` key variants, Ghostty's
    /// `light`/`dark` theme pair). Empty when the terminal has a single
    /// palette — which is the common case, and why `theme` remains the
    /// unconditional fallback rather than being replaced by these.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub theme_light: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub theme_dark: BTreeMap<String, String>,
    /// Cursor shape in xterm.js's own vocabulary: `block` | `underline` |
    /// `bar`. `None` falls through to xterm's default, exactly like the
    /// palette does — perch never invents a shape of its own.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_style: Option<String>,
    /// Whether the cursor blinks. `None` falls through to xterm's default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_blink: Option<bool>,
}

impl TerminalProfile {
    pub fn is_empty(&self) -> bool {
        self.font_family.is_none()
            && self.font_size.is_none()
            && self.theme.is_empty()
            && self.theme_light.is_empty()
            && self.theme_dark.is_empty()
            && self.cursor_style.is_none()
            && self.cursor_blink.is_none()
    }
}

/// iTerm2 colour key -> xterm.js theme key. `Ansi N Color` maps positionally
/// onto xterm's ramp, which uses the same 0-15 ordering. `pub(crate)` because
/// `ghostty_profile` shares the same positional ramp for its `palette = N=…`
/// entries.
pub(crate) const ANSI_KEYS: [&str; 16] = [
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
/// The unsuffixed keys are read into `theme`. iTerm2 also stores `… (Light)` /
/// `… (Dark)` variants, and they are read into `theme_light`/`theme_dark` —
/// but **only when the profile's "Use Separate Colors for Light and Dark Mode"
/// is actually on**.
///
/// That gate is load-bearing, not defensive. iTerm2 writes and *keeps* the
/// suffixed keys even while the option is off, so they are routinely present
/// and fully populated on a profile that does not use them (verified on this
/// machine: the option is `false` and both complete variants sit in the
/// plist). Shipping them unconditionally would let the client repaint the
/// terminal on an OS appearance change into colours the user's iTerm2 is not
/// using — which is precisely the "perch substitutes its own palette" failure
/// this whole module exists to prevent, just sourced from a stale key instead
/// of a UI token. When the option is off the base keys are the only truth, so
/// both variants stay empty and the client's fallback to `theme` is the
/// correct — and only — behaviour.
///
/// A variant that is present but not usable (missing background or foreground)
/// is likewise left empty rather than shipped half-built.
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

    profile.theme = build_palette(bookmark, "");

    // See the doc comment: the suffixed variants are only the user's real
    // colours when this option is on. Absent key => treat as off.
    let separate_light_dark = bookmark
        .get("Use Separate Colors for Light and Dark Mode")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if separate_light_dark {
        let light = build_palette(bookmark, " (Light)");
        if light.contains_key("background") && light.contains_key("foreground") {
            profile.theme_light = light;
        }
        let dark = build_palette(bookmark, " (Dark)");
        if dark.contains_key("background") && dark.contains_key("foreground") {
            profile.theme_dark = dark;
        }
    }

    profile.cursor_style = bookmark
        .get("Cursor Type")
        .and_then(|v| v.as_i64())
        .and_then(cursor_style_from_iterm)
        .map(str::to_string);
    profile.cursor_blink = bookmark.get("Blinking Cursor").and_then(|v| v.as_bool());

    if profile.is_empty() {
        None
    } else {
        Some(profile)
    }
}

/// Read one palette out of a bookmark dictionary: `suffix` is `""` for the
/// unsuffixed (currently-active) colours, or `" (Light)"`/`" (Dark)"` for the
/// appearance-specific variants. Shared by all three passes so the key list
/// lives in exactly one place.
fn build_palette(bookmark: &serde_json::Value, suffix: &str) -> BTreeMap<String, String> {
    let mut theme = BTreeMap::new();
    let mut put = |key: &str, iterm_key: &str| {
        let full_key = format!("{iterm_key}{suffix}");
        if let Some(hex) = bookmark.get(&full_key).and_then(color_to_hex) {
            theme.insert(key.to_string(), hex);
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
    theme
}

/// iTerm2's `"Cursor Type"` integer -> xterm.js's cursor-shape vocabulary.
/// Anything other than the three documented values (0/1/2) is a shape we
/// don't recognise, so it stays `None` and falls through to xterm's default
/// rather than guessing.
fn cursor_style_from_iterm(n: i64) -> Option<&'static str> {
    match n {
        0 => Some("underline"),
        1 => Some("bar"),
        2 => Some("block"),
        _ => None,
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
    fn cursor_type_integers_map_to_xterm_vocabulary() {
        for (n, expected) in [(0, "underline"), (1, "bar"), (2, "block")] {
            let mut b = fixture();
            b["Cursor Type"] = json!(n);
            let p = parse_bookmark(&b).unwrap();
            assert_eq!(p.cursor_style.as_deref(), Some(expected), "type {n}");
        }
    }

    #[test]
    fn unknown_cursor_type_stays_none() {
        for n in [3, 4, -1, 99] {
            let mut b = fixture();
            b["Cursor Type"] = json!(n);
            let p = parse_bookmark(&b).unwrap();
            assert_eq!(p.cursor_style, None, "type {n} should not map to a shape");
        }
        // A non-integer shape (wrong type in the plist) must also stay None.
        let mut b = fixture();
        b["Cursor Type"] = json!("block");
        let p = parse_bookmark(&b).unwrap();
        assert_eq!(p.cursor_style, None);
    }

    #[test]
    fn blinking_cursor_bool_is_read_through() {
        let mut b = fixture();
        b["Blinking Cursor"] = json!(true);
        assert_eq!(parse_bookmark(&b).unwrap().cursor_blink, Some(true));

        let mut b = fixture();
        b["Blinking Cursor"] = json!(false);
        assert_eq!(parse_bookmark(&b).unwrap().cursor_blink, Some(false));

        // Absent entirely -> None, not a guessed default.
        assert_eq!(parse_bookmark(&fixture()).unwrap().cursor_blink, None);
    }

    /// Add a complete, obviously-distinguishable pair of light/dark variants.
    fn with_light_dark_variants(b: &mut serde_json::Value) {
        b["Background Color (Light)"] = json!({
            "Red Component": 1.0, "Green Component": 1.0, "Blue Component": 1.0,
        });
        b["Foreground Color (Light)"] = json!({
            "Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0,
        });
        b["Background Color (Dark)"] = json!({
            "Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0,
        });
        b["Foreground Color (Dark)"] = json!({
            "Red Component": 1.0, "Green Component": 1.0, "Blue Component": 1.0,
        });
    }

    #[test]
    fn light_and_dark_variants_are_read_when_complete_and_enabled() {
        let mut b = fixture();
        with_light_dark_variants(&mut b);
        b["Use Separate Colors for Light and Dark Mode"] = json!(true);
        let p = parse_bookmark(&b).unwrap();
        assert_eq!(p.theme_light.get("background").unwrap(), "#ffffff");
        assert_eq!(p.theme_light.get("foreground").unwrap(), "#000000");
        assert_eq!(p.theme_dark.get("background").unwrap(), "#000000");
        assert_eq!(p.theme_dark.get("foreground").unwrap(), "#ffffff");
        // The unsuffixed theme is unaffected by the variants existing.
        assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
    }

    /// The regression this guards: iTerm2 keeps fully-populated `(Light)` /
    /// `(Dark)` keys around even when the profile does not use them — that is
    /// the state of the machine this was developed on. Honouring them anyway
    /// would repaint the pane on an OS appearance change into colours the
    /// user's terminal never shows, which is the exact class of bug this
    /// module exists to prevent.
    #[test]
    fn complete_variants_are_ignored_when_the_profile_does_not_use_them() {
        for present in [false, true] {
            let mut b = fixture();
            with_light_dark_variants(&mut b);
            // `false` explicitly, and the key absent entirely, must behave
            // identically — absent means the user never turned it on.
            if present {
                b["Use Separate Colors for Light and Dark Mode"] = json!(false);
            }
            let p = parse_bookmark(&b).unwrap();
            assert!(
                p.theme_light.is_empty() && p.theme_dark.is_empty(),
                "variants must be dropped when the option is off (key present: {present})"
            );
            // The colours actually in effect still come through.
            assert_eq!(p.theme.get("background").unwrap(), "#1e1e2e");
        }
    }

    /// A profile with no "Use Separate Colors" variants at all must leave
    /// both maps empty, so the client's fallback to `theme` is clean.
    #[test]
    fn absent_variant_leaves_the_map_empty() {
        let p = parse_bookmark(&fixture()).unwrap();
        assert!(p.theme_light.is_empty());
        assert!(p.theme_dark.is_empty());
    }

    /// A variant missing background or foreground is not usable as a
    /// stand-alone palette, so it must be dropped entirely rather than
    /// shipped half-built.
    #[test]
    fn incomplete_variant_stays_empty_rather_than_partial() {
        let mut b = fixture();
        // The option must be ON, or the gate short-circuits first and this
        // would pass without ever exercising the completeness check.
        b["Use Separate Colors for Light and Dark Mode"] = json!(true);
        // Only a light *foreground*, no light background: incomplete.
        b["Foreground Color (Light)"] = json!({
            "Red Component": 0.0, "Green Component": 0.0, "Blue Component": 0.0,
        });
        let p = parse_bookmark(&b).unwrap();
        assert!(p.theme_light.is_empty());
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
