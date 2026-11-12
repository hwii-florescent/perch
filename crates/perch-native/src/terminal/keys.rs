// The key table (`map_key`), the shifted-punctuation table and the legacy control
// aliases follow `src/terminal.rs` of herdr
// (https://github.com/herdrdev/herdr-app, commit
// 4c8c622d7965a6f6787f55b1896b70795fc68918), licensed under the Apache License,
// Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Modified for Perch:
// no Windows input mode, and the Option side is read from the system at key time
// (GPUI 0.3 does not report it) and applied as the web terminal's `optionAsAlt`
// does. See THIRD_PARTY_NOTICES.md.

//! What a GPUI key press sends the program: the key described to the encoder in
//! [`super::vt`], which encodes it once, in the mode the program asked for. A Command chord is the
//! app's and encodes to nothing; the keymap's default editing keys (line start, line end, delete
//! to line start) stand in for the ones the web leaves the program, and [`expects_real_chords`]
//! says when the program wants the chords themselves instead.

use super::settings::OptionAsAlt;
use super::vt::{KeyInput, Vt};
use ghostty_sys as g;
use gpui::Keystroke;

/// Which Option key is down.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OptionSide {
    /// Neither is down, or the system did not say.
    None,
    Left,
    Right,
    Both,
}

/// Whether Option acts as Alt for `key` under `setting` with `side` down, as the web terminal
/// does: a key with a name (the arrows, Backspace, F1) always carries Alt, xterm.js encodes it
/// so; a key that types a character carries it only when the setting names an Option key that
/// is down, and otherwise types the layout's character.
pub fn option_is_alt(setting: OptionAsAlt, side: OptionSide, key: &str) -> bool {
    if named(key) && key != "space" {
        return true;
    }
    match setting {
        OptionAsAlt::Auto => true,
        OptionAsAlt::Off => false,
        OptionAsAlt::Left => matches!(side, OptionSide::Left | OptionSide::Both),
        OptionAsAlt::Right => matches!(side, OptionSide::Right | OptionSide::Both),
    }
}

/// The Option side to decide `keystroke` by under `setting`: asked of the system only when the
/// setting names a side and Option is down, else [`OptionSide::None`].
pub fn option_side_for(setting: OptionAsAlt, keystroke: &Keystroke) -> OptionSide {
    if keystroke.modifiers.alt && matches!(setting, OptionAsAlt::Left | OptionAsAlt::Right) {
        held_option_side()
    } else {
        OptionSide::None
    }
}

/// The Option side from the device-dependent bits of the modifier flags (`NX_DEVICELALTKEYMASK`
/// and `NX_DEVICERALTKEYMASK`).
fn option_side_of_flags(flags: u64) -> OptionSide {
    const LEFT: u64 = 0x20;
    const RIGHT: u64 = 0x40;
    match (flags & LEFT != 0, flags & RIGHT != 0) {
        (true, true) => OptionSide::Both,
        (true, false) => OptionSide::Left,
        (false, true) => OptionSide::Right,
        (false, false) => OptionSide::None,
    }
}

/// Which Option key the system says is down. GPUI reports only that Option is, so this asks the
/// HID system's modifier state at key time: a key a program posts without the hardware has no
/// side, and neither has one the person let go of before this ran. Test mode
/// (`PERCH_NATIVE_TEST=1`) never asks, so a headless run does not depend on the real keyboard.
#[cfg(target_os = "macos")]
pub fn held_option_side() -> OptionSide {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        /// `CGEventSourceFlagsState`: the modifier flags of an event source's state table.
        fn CGEventSourceFlagsState(state: i32) -> u64;
    }
    /// `kCGEventSourceStateHIDSystemState`.
    const HID_SYSTEM_STATE: i32 = 1;
    if std::env::var_os("PERCH_NATIVE_TEST").is_some_and(|v| v == "1") {
        return OptionSide::None;
    }
    // SAFETY: a plain query of the system's modifier state; it takes no pointers.
    option_side_of_flags(unsafe { CGEventSourceFlagsState(HID_SYSTEM_STATE) })
}

/// Other systems do not tell the sides apart: either counts, so `left` and `right` act as `auto`.
#[cfg(not(target_os = "macos"))]
pub fn held_option_side() -> OptionSide {
    OptionSide::Both
}

/// The bytes for `keystroke`, or `None` when the terminal has nothing to say for it (a key with
/// no meaning here, or a Command chord, which belongs to the app).
pub fn key_bytes(vt: &mut Vt, keystroke: &Keystroke, repeat: bool) -> Option<Vec<u8>> {
    key_bytes_with(vt, keystroke, repeat, OptionAsAlt::Auto, OptionSide::None)
}

/// [`key_bytes`] under the `optionAsAlt` setting and the Option key that is down
/// ([`option_is_alt`]): where Option is not Alt it types the keyboard layout's character. Option
/// still counts as held, consumed by that character, so a program that asked for every key as an
/// escape code (kitty `>9u`) is told, as herdr's encoder does; the web has no answer there.
pub fn key_bytes_with(
    vt: &mut Vt,
    keystroke: &Keystroke,
    repeat: bool,
    option: OptionAsAlt,
    side: OptionSide,
) -> Option<Vec<u8>> {
    let mut m = keystroke.modifiers;
    // Option was held, whether or not it acts as Alt: a program that asked for every key as an
    // escape code is told so, and the layout's character it made is the text.
    let option_held = m.alt;
    m.alt = option_held && option_is_alt(option, side, &keystroke.key);
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
    if option_held {
        mods |= g::GHOSTTY_MODS_ALT as g::GhosttyMods;
    }
    // Shift made the text; the kitty protocol must not report it again. Nor Option, when it made
    // the layout's character instead of an Alt chord.
    let mut consumed = mods & g::GHOSTTY_MODS_SHIFT as g::GhosttyMods;
    if option_held && !m.alt {
        consumed |= g::GHOSTTY_MODS_ALT as g::GhosttyMods;
    }
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
    modify_other_keys_chord(vt, key, text, shifted).unwrap_or(legacy)
}

/// The chord Ctrl+`key` as the program wants it when it asked for modifyOtherKeys (CSI 27), else
/// `None`. libghostty has no getter for that mode, so probe with printable base text: its
/// encoder keeps the chord only in that mode.
fn modify_other_keys_chord(
    vt: &mut Vt,
    key: g::GhosttyKey,
    text: &str,
    shifted: bool,
) -> Option<Vec<u8>> {
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
    encoded.starts_with(b"\x1b[27;").then_some(encoded)
}

/// Whether the program asked for the real chords, by the kitty keyboard protocol or
/// modifyOtherKeys. The editing keys the keymap ships (line start and end, delete to line start)
/// step aside then: the program tells those chords apart and gets them.
pub fn expects_real_chords(vt: &mut Vt) -> bool {
    vt.kitty_keyboard_flags() != 0
        || modify_other_keys_chord(vt, g::GHOSTTY_KEY_A, "a", false).is_some()
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
            key_bytes_with(
                &mut vt,
                &option_s,
                false,
                OptionAsAlt::Off,
                OptionSide::None
            )
            .unwrap(),
            "ß".as_bytes()
        );
        assert_eq!(
            key_bytes_with(
                &mut vt,
                &option_s,
                false,
                OptionAsAlt::Auto,
                OptionSide::None
            )
            .unwrap(),
            b"\x1bs"
        );
    }

    fn option(key: &str, text: Option<&str>) -> Keystroke {
        Keystroke {
            modifiers: gpui::Modifiers::alt(),
            key: key.into(),
            key_char: text.map(Into::into),
        }
    }

    #[test]
    fn option_sides_encode_shortcuts_and_native_text() {
        use OptionAsAlt::{Auto, Left, Off, Right};
        use OptionSide::{Both, None as Nothing};
        let sides = [Nothing, OptionSide::Left, OptionSide::Right, Both];
        // Plain, kitty disambiguate (`>1u`), and kitty report-all (`>9u`).
        for (mode, kitty) in [(&b""[..], 0), (b"\x1b[>1u", 1), (b"\x1b[>9u", 2)] {
            for setting in [Auto, Off, Left, Right] {
                for side in sides {
                    let as_alt = match setting {
                        Auto => true,
                        Off => false,
                        Left => matches!(side, OptionSide::Left | Both),
                        Right => matches!(side, OptionSide::Right | Both),
                    };
                    let mut vt = Vt::new(20, 3);
                    vt.write(mode);
                    let mut send = |key: &str, text: Option<&str>| {
                        key_bytes_with(&mut vt, &option(key, text), false, setting, side).unwrap()
                    };
                    let why = format!("{setting:?} {side:?} {mode:?}");
                    // A letter: Alt names the key, otherwise the layout's character is typed. A
                    // program that asked for every key as an escape code is still told Option
                    // was held.
                    for native in ["\u{3c0}", "@"] {
                        let expected: &[u8] = match (as_alt, kitty) {
                            (true, 0) => b"\x1bp",
                            (_, 2) | (true, _) => b"\x1b[112;3u",
                            (false, _) => native.as_bytes(),
                        };
                        assert_eq!(send("p", Some(native)), expected, "{why} {native}");
                    }
                    // An arrow and Backspace carry Alt whatever the setting and the side.
                    assert_eq!(send("left", None), b"\x1b[1;3D", "{why}");
                    let backspace: &[u8] = if kitty > 0 {
                        b"\x1b[127;3u"
                    } else {
                        b"\x1b\x7f"
                    };
                    assert_eq!(send("backspace", None), backspace, "{why}");
                }
            }
        }
    }

    #[test]
    fn the_side_comes_from_the_systems_device_bits() {
        assert_eq!(option_side_of_flags(0), OptionSide::None);
        assert_eq!(option_side_of_flags(0x20), OptionSide::Left);
        assert_eq!(option_side_of_flags(0x40), OptionSide::Right);
        assert_eq!(option_side_of_flags(0x60), OptionSide::Both);
        // The other bits of the flags (Shift, Command, the generic Option bit) say nothing.
        assert_eq!(
            option_side_of_flags(0x0008_0000 | 0x0002_0000),
            OptionSide::None
        );
        assert_eq!(option_side_of_flags(0x0008_0000 | 0x20), OptionSide::Left);
    }

    #[test]
    fn the_system_is_asked_only_for_a_named_side_with_option_down() {
        // These never reach the system, so they hold whatever the keyboard is doing.
        for setting in [OptionAsAlt::Auto, OptionAsAlt::Off] {
            assert_eq!(
                option_side_for(setting, &option("p", None)),
                OptionSide::None
            );
        }
        let plain = stroke("p");
        for setting in [OptionAsAlt::Left, OptionAsAlt::Right] {
            assert_eq!(option_side_for(setting, &plain), OptionSide::None);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_system_query_links_and_answers() {
        // Only that it links and returns; which key is down is not this test's to decide.
        let _ = held_option_side();
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
    fn word_motion_keys_send_what_the_web_terminal_sends() {
        // xterm.js on macOS: Option with Left, Right and Backspace are its modified keys, which
        // the encoder spells the same; the Command chords are the app's and send nothing.
        let mut vt = Vt::new(80, 24);
        assert_eq!(sent(&mut vt, "alt-left"), b"\x1b[1;3D");
        assert_eq!(sent(&mut vt, "alt-right"), b"\x1b[1;3C");
        assert_eq!(sent(&mut vt, "alt-backspace"), b"\x1b\x7f");
        for chord in ["cmd-left", "cmd-right", "cmd-backspace"] {
            assert_eq!(key_bytes(&mut vt, &stroke(chord), false), None, "{chord}");
        }
        // A negotiated keyboard mode changes the spelling, as it does in the web terminal.
        vt.write(b"\x1b[>1u");
        assert_eq!(sent(&mut vt, "alt-left"), b"\x1b[1;3D");
        assert_eq!(sent(&mut vt, "alt-backspace"), b"\x1b[127;3u");
    }

    #[test]
    fn the_program_asking_for_real_chords_is_told_apart() {
        let mut vt = Vt::new(80, 24);
        assert!(!expects_real_chords(&mut vt));
        // modifyOtherKeys level 1 leaves control letters as they are.
        vt.write(b"\x1b[>4;1m");
        assert!(!expects_real_chords(&mut vt));
        vt.write(b"\x1b[>4;2m");
        assert!(expects_real_chords(&mut vt));
        vt.write(b"\x1b[>4;0m");
        assert!(!expects_real_chords(&mut vt));
        vt.write(b"\x1b[>1u");
        assert!(expects_real_chords(&mut vt));
        vt.write(b"\x1b[<u");
        assert!(!expects_real_chords(&mut vt));
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
