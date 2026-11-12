// The key table (`map_key`), the shifted-punctuation table and the legacy control
// aliases follow `src/terminal.rs` of herdr
// (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch:
// no Windows input mode and no per-side Option setting (GPUI 0.3 does not report
// the side); Option always types Alt sequences, as in the web terminal. See
// THIRD_PARTY_NOTICES.md.

//! What a GPUI key press sends the program: the key described to the encoder in
//! [`super::vt`], which encodes it once, in the mode the program asked for.

use super::settings::OptionAsAlt;
use super::vt::{KeyInput, Vt};
use ghostty_sys as g;
use gpui::Keystroke;

/// The bytes for `keystroke`, or `None` when the terminal has nothing to say for it (a key with
/// no meaning here, or a Command chord, which belongs to the app).
pub fn key_bytes(vt: &mut Vt, keystroke: &Keystroke, repeat: bool) -> Option<Vec<u8>> {
    key_bytes_with(vt, keystroke, repeat, OptionAsAlt::Auto)
}

/// [`key_bytes`] under the `optionAsAlt` setting: with it off, Option types the keyboard
/// layout's character instead of an Alt sequence.
pub fn key_bytes_with(
    vt: &mut Vt,
    keystroke: &Keystroke,
    repeat: bool,
    option: OptionAsAlt,
) -> Option<Vec<u8>> {
    let mut m = keystroke.modifiers;
    if option == OptionAsAlt::Off {
        m.alt = false;
    }
    if m.platform {
        return None;
    }
    // libghostty leaves these aliases to fixterms, but GPUI drops their control text. Legacy
    // mode needs them spelled out; a negotiated mode keeps the whole chord.
    if vt.kitty_keyboard_flags() == 0 && m.control && !m.alt && !m.function {
        let alias = match keystroke.key.as_str() {
            "[" if !m.shift => Some((g::GHOSTTY_KEY_BRACKET_LEFT, g::GHOSTTY_KEY_ESCAPE)),
            "i" if !m.shift => Some((g::GHOSTTY_KEY_I, g::GHOSTTY_KEY_TAB)),
            "m" if !m.shift => Some((g::GHOSTTY_KEY_M, g::GHOSTTY_KEY_ENTER)),
            _ => None,
        };
        if let Some((key, alias)) = alias {
            let legacy = vt.encode_key(plain(alias, 0));
            return Some(control_alias_bytes(vt, key, &keystroke.key, false, legacy));
        }
        if matches!(keystroke.key.as_str(), "-" | "_") {
            let shifted = m.shift || keystroke.key == "_";
            let text = if shifted { "_" } else { "-" };
            return Some(control_alias_bytes(
                vt,
                g::GHOSTTY_KEY_MINUS,
                text,
                shifted,
                vec![0x1f],
            ));
        }
    }
    let Some((key, shifted, unshifted)) = map_key(&keystroke.key) else {
        // A key the table does not know types its text, if it has any.
        return keystroke
            .key_char
            .as_ref()
            .filter(|_| !m.control)
            .map(|text| text.as_bytes().to_vec());
    };
    let mut mods: g::GhosttyMods = 0;
    if m.shift || shifted {
        mods |= g::GHOSTTY_MODS_SHIFT as g::GhosttyMods;
    }
    if m.control {
        mods |= g::GHOSTTY_MODS_CTRL as g::GhosttyMods;
    }
    if m.alt {
        mods |= g::GHOSTTY_MODS_ALT as g::GhosttyMods;
    }
    // Shift made the text; the kitty protocol must not report it again.
    let consumed = mods & g::GHOSTTY_MODS_SHIFT as g::GhosttyMods;
    let text = if m.alt {
        // macOS turns Option-x into another character; Alt sequences name the key itself.
        alt_text(&keystroke.key, shifted || m.shift)
    } else if keystroke.key == "space" {
        Some(" ".to_owned())
    } else if m.control {
        None
    } else {
        // Real key events carry the character they type; one built by hand may not.
        keystroke.key_char.clone().or_else(|| {
            alt_text(&keystroke.key, shifted || m.shift).filter(|_| !named(&keystroke.key))
        })
    };
    Some(vt.encode_key(KeyInput {
        key,
        mods,
        consumed,
        text: text.as_deref(),
        unshifted,
        repeat,
    }))
}

/// A bare key press.
fn plain(key: g::GhosttyKey, mods: g::GhosttyMods) -> KeyInput<'static> {
    KeyInput {
        key,
        mods,
        consumed: 0,
        text: None,
        unshifted: None,
        repeat: false,
    }
}

/// A key with a name rather than a character.
fn named(key: &str) -> bool {
    key.chars().count() > 1
}

/// The text of an Alt chord: the key's own character, upper case under Shift.
fn alt_text(key: &str, shift: bool) -> Option<String> {
    let mut chars = key.chars();
    let (Some(c), None) = (chars.next(), chars.next()) else {
        return (key == "space").then(|| " ".to_owned());
    };
    Some(if shift {
        c.to_uppercase().collect()
    } else {
        c.to_string()
    })
}

fn control_alias_bytes(
    vt: &mut Vt,
    key: g::GhosttyKey,
    text: &str,
    shifted: bool,
    legacy: Vec<u8>,
) -> Vec<u8> {
    // libghostty has no getter for modifyOtherKeys. Probe with printable base text so its
    // encoder keeps the chord when the program asked for CSI 27.
    let mods = g::GHOSTTY_MODS_CTRL as g::GhosttyMods
        | if shifted {
            g::GHOSTTY_MODS_SHIFT as g::GhosttyMods
        } else {
            0
        };
    let encoded = vt.encode_key(KeyInput {
        text: Some(text),
        unshifted: text.chars().next(),
        ..plain(key, mods)
    });
    if encoded.starts_with(b"\x1b[27;") {
        encoded
    } else {
        legacy
    }
}

/// A GPUI key name as the encoder's key, whether Shift is implied by the name (`:` is shifted
/// `;`), and the key's unshifted character.
pub fn map_key(key: &str) -> Option<(g::GhosttyKey, bool, Option<char>)> {
    let named = match key {
        "enter" => g::GHOSTTY_KEY_ENTER,
        "tab" => g::GHOSTTY_KEY_TAB,
        "escape" => g::GHOSTTY_KEY_ESCAPE,
        "backspace" => g::GHOSTTY_KEY_BACKSPACE,
        "space" => return Some((g::GHOSTTY_KEY_SPACE, false, Some(' '))),
        "delete" => g::GHOSTTY_KEY_DELETE,
        "insert" => g::GHOSTTY_KEY_INSERT,
        "home" => g::GHOSTTY_KEY_HOME,
        "end" => g::GHOSTTY_KEY_END,
        "pageup" => g::GHOSTTY_KEY_PAGE_UP,
        "pagedown" => g::GHOSTTY_KEY_PAGE_DOWN,
        "up" => g::GHOSTTY_KEY_ARROW_UP,
        "down" => g::GHOSTTY_KEY_ARROW_DOWN,
        "left" => g::GHOSTTY_KEY_ARROW_LEFT,
        "right" => g::GHOSTTY_KEY_ARROW_RIGHT,
        _ => g::GHOSTTY_KEY_UNIDENTIFIED,
    };
    if named != g::GHOSTTY_KEY_UNIDENTIFIED {
        return Some((named, false, None));
    }
    if let Some(n) = key.strip_prefix('f').and_then(|n| n.parse::<u8>().ok()) {
        if (1..=12).contains(&n) {
            return Some((g::GHOSTTY_KEY_F1 + (n - 1) as g::GhosttyKey, false, None));
        }
    }
    let mut chars = key.chars();
    let (Some(c), None) = (chars.next(), chars.next()) else {
        return None;
    };
    const SHIFTED: &[(char, char)] = &[
        ('~', '`'),
        ('!', '1'),
        ('@', '2'),
        ('#', '3'),
        ('$', '4'),
        ('%', '5'),
        ('^', '6'),
        ('&', '7'),
        ('*', '8'),
        ('(', '9'),
        (')', '0'),
        ('_', '-'),
        ('+', '='),
        ('{', '['),
        ('}', ']'),
        ('|', '\\'),
        (':', ';'),
        ('"', '\''),
        ('<', ','),
        ('>', '.'),
        ('?', '/'),
    ];
    let (base, shifted) = match SHIFTED.iter().find(|(s, _)| *s == c) {
        Some((_, b)) => (*b, true),
        None => (c, false),
    };
    let code = match base {
        'a'..='z' => g::GHOSTTY_KEY_A + (base as u8 - b'a') as g::GhosttyKey,
        '0'..='9' => g::GHOSTTY_KEY_DIGIT_0 + (base as u8 - b'0') as g::GhosttyKey,
        '`' => g::GHOSTTY_KEY_BACKQUOTE,
        '\\' => g::GHOSTTY_KEY_BACKSLASH,
        '[' => g::GHOSTTY_KEY_BRACKET_LEFT,
        ']' => g::GHOSTTY_KEY_BRACKET_RIGHT,
        ',' => g::GHOSTTY_KEY_COMMA,
        '=' => g::GHOSTTY_KEY_EQUAL,
        '-' => g::GHOSTTY_KEY_MINUS,
        '.' => g::GHOSTTY_KEY_PERIOD,
        '\'' => g::GHOSTTY_KEY_QUOTE,
        ';' => g::GHOSTTY_KEY_SEMICOLON,
        '/' => g::GHOSTTY_KEY_SLASH,
        _ => g::GHOSTTY_KEY_UNIDENTIFIED,
    };
    Some((code, shifted, Some(base)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stroke(text: &str) -> Keystroke {
        Keystroke::parse(text).unwrap()
    }

    fn sent(vt: &mut Vt, text: &str) -> Vec<u8> {
        key_bytes(vt, &stroke(text), false).unwrap_or_default()
    }

    #[test]
    fn option_as_alt_off_types_the_layouts_character() {
        let mut vt = Vt::new(80, 24);
        let mut option_s = stroke("alt-s");
        option_s.key_char = Some("ß".into());
        assert_eq!(
            key_bytes_with(&mut vt, &option_s, false, OptionAsAlt::Off).unwrap(),
            "ß".as_bytes()
        );
        assert_eq!(
            key_bytes_with(&mut vt, &option_s, false, OptionAsAlt::Auto).unwrap(),
            b"\x1bs"
        );
    }

    #[test]
    fn plain_and_named_keys() {
        let mut vt = Vt::new(80, 24);
        assert_eq!(sent(&mut vt, "a"), b"a");
        assert_eq!(sent(&mut vt, "shift-a"), b"A");
        assert_eq!(sent(&mut vt, "enter"), b"\r");
        assert_eq!(sent(&mut vt, "tab"), b"\t");
        assert_eq!(sent(&mut vt, "shift-tab"), b"\x1b[Z");
        assert_eq!(sent(&mut vt, "escape"), b"\x1b");
        assert_eq!(sent(&mut vt, "backspace"), b"\x7f");
        assert_eq!(sent(&mut vt, "space"), b" ");
        assert_eq!(sent(&mut vt, "down"), b"\x1b[B");
        assert_eq!(sent(&mut vt, "delete"), b"\x1b[3~");
        assert_eq!(sent(&mut vt, "home"), b"\x1b[H");
        assert_eq!(sent(&mut vt, "pagedown"), b"\x1b[6~");
        assert_eq!(sent(&mut vt, "f1"), b"\x1bOP");
        assert_eq!(sent(&mut vt, "f12"), b"\x1b[24~");
        assert_eq!(sent(&mut vt, "ctrl-right"), b"\x1b[1;5C");
        assert_eq!(sent(&mut vt, "7"), b"7");
    }

    #[test]
    fn control_chords_and_aliases_in_legacy_mode() {
        let mut vt = Vt::new(80, 24);
        assert_eq!(sent(&mut vt, "ctrl-c"), b"\x03");
        assert_eq!(sent(&mut vt, "ctrl-d"), b"\x04");
        assert_eq!(sent(&mut vt, "ctrl-z"), b"\x1a");
        // These four have no control text in GPUI, so they are spelled out.
        assert_eq!(sent(&mut vt, "ctrl-["), b"\x1b");
        assert_eq!(sent(&mut vt, "ctrl-i"), b"\t");
        assert_eq!(sent(&mut vt, "ctrl-m"), b"\r");
        assert_eq!(sent(&mut vt, "ctrl--"), b"\x1f");
        // With the kitty protocol on, the chord keeps its identity.
        vt.write(b"\x1b[>1u");
        assert_eq!(sent(&mut vt, "ctrl-i"), b"\x1b[105;5u");
        assert_eq!(sent(&mut vt, "ctrl-c"), b"\x1b[99;5u");
        assert_eq!(sent(&mut vt, "escape"), b"\x1b[27u");
    }

    #[test]
    fn modify_other_keys_keeps_the_aliased_chord() {
        let mut vt = Vt::new(80, 24);
        vt.write(b"\x1b[>4;2m");
        assert_eq!(sent(&mut vt, "ctrl-i"), b"\x1b[27;5;105~");
    }

    #[test]
    fn shifted_punctuation_maps_to_its_base_key_with_shift() {
        assert_eq!(
            map_key(":"),
            Some((g::GHOSTTY_KEY_SEMICOLON, true, Some(';')))
        );
        assert_eq!(map_key("?"), Some((g::GHOSTTY_KEY_SLASH, true, Some('/'))));
        assert_eq!(
            map_key("("),
            Some((g::GHOSTTY_KEY_DIGIT_9, true, Some('9')))
        );
        assert_eq!(
            map_key(";"),
            Some((g::GHOSTTY_KEY_SEMICOLON, false, Some(';')))
        );
        assert_eq!(map_key("f13"), None);
        assert_eq!(
            map_key("é"),
            Some((g::GHOSTTY_KEY_UNIDENTIFIED, false, Some('é')))
        );
        let mut vt = Vt::new(80, 24);
        vt.write(b"\x1b[>1u");
        // Typing ":" under the kitty protocol sends the text, not shift+;.
        let colon = Keystroke {
            modifiers: gpui::Modifiers::shift(),
            key: ";".into(),
            key_char: Some(":".into()),
        };
        assert_eq!(key_bytes(&mut vt, &colon, false).unwrap(), b":");
    }

    #[test]
    fn option_types_alt_sequences_and_command_is_left_to_the_app() {
        let mut vt = Vt::new(80, 24);
        // macOS makes Option-x the character "≈"; the program gets Escape and the key.
        let option_x = Keystroke {
            modifiers: gpui::Modifiers::alt(),
            key: "x".into(),
            key_char: Some("\u{2248}".into()),
        };
        assert_eq!(key_bytes(&mut vt, &option_x, false).unwrap(), b"\x1bx");
        assert_eq!(sent(&mut vt, "alt-shift-x"), b"\x1bX");
        assert_eq!(sent(&mut vt, "alt-backspace"), b"\x1b\x7f");
        assert_eq!(sent(&mut vt, "alt-left"), b"\x1b[1;3D");
        assert_eq!(key_bytes(&mut vt, &stroke("cmd-c"), false), None);
        assert_eq!(key_bytes(&mut vt, &stroke("cmd-v"), false), None);
    }

    #[test]
    fn an_unmapped_key_types_its_text() {
        let mut vt = Vt::new(80, 24);
        let accented = Keystroke {
            modifiers: gpui::Modifiers::default(),
            key: "\u{e9}".into(),
            key_char: Some("\u{e9}".into()),
        };
        assert_eq!(
            key_bytes(&mut vt, &accented, false).unwrap(),
            "é".as_bytes()
        );
        let nothing = Keystroke {
            modifiers: gpui::Modifiers::default(),
            key: "capslock".into(),
            key_char: None,
        };
        assert_eq!(key_bytes(&mut vt, &nothing, false), None);
    }
}
