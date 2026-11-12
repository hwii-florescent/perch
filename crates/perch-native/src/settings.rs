//! The terminal section of Settings: the three things the web's Settings > Terminal offers
//! (`stock-ui/settings-terminal`) and the other terminal fields the core's `settings.current`
//! carries (colour contrast, clipboard writes, scrollbars, padding, opacity, Option as Alt, the
//! alert sounds and toasts), read from the core and changed with a `settings.update` that carries
//! only the field that changed.
//!
//! Scrollback is saved only when it is in range, as the web does, so typing `5000` never stores
//! `5` on the way. The core applies the login shell to terminals it starts afterwards. Line
//! height, ligatures and scroll speed are not here: the core has no such fields.

use perch_core::protocol::SettingsData;
use serde_json::{json, Value};

/// The range the web accepts for scrollback lines (`xtermSetup.ts`).
pub const MIN_SCROLLBACK: u32 = 100;
pub const MAX_SCROLLBACK: u32 = 200_000;

/// The ranges the core accepts (`settings.rs` in the core), which a stepper never leaves.
pub const CONTRAST: (f64, f64) = (1.0, 21.0);
pub const OPACITY: (f64, f64) = (0.1, 1.0);
pub const PADDING: (f64, f64) = (0.0, 64.0);

/// The values the core accepts for Option as Alt, and for how toasts are delivered, in the order
/// a click cycles through them.
pub const OPTION_AS_ALT: [&str; 5] = ["auto", "on", "off", "left", "right"];
pub const TOAST_DELIVERY: [&str; 3] = ["app", "system", "off"];

#[derive(Clone, Debug, Default, PartialEq)]
pub struct TerminalSettings {
    /// Lines of scrollback each terminal keeps.
    pub scrollback: u32,
    /// Plain terminals start as a login shell.
    pub login_shell: bool,
    /// Dropped paths are wrapped in double quotes rather than single.
    pub dropped_path_double_quotes: bool,
    /// Text below this contrast ratio (1 to 21) is pushed toward black or white.
    pub minimum_contrast: f64,
    /// A program may write the clipboard (OSC 52).
    pub clipboard_write: bool,
    pub pane_scrollbars: bool,
    /// Space around the text, across and down, in pixels.
    pub padding: [f64; 2],
    /// 0.1 to 1: below 1 what is behind a terminal shows through.
    pub opacity: f64,
    pub option_as_alt: String,
    /// Alert sounds are on, and which file replaces the system sound for each kind (empty: the
    /// system's own).
    pub sound_enabled: bool,
    pub sound_done: String,
    pub sound_blocked: String,
    /// `off`, `app` or `system`.
    pub toast_delivery: String,
}

impl TerminalSettings {
    pub fn from_wire(settings: &SettingsData) -> Self {
        Self {
            scrollback: settings.terminal_scrollback,
            login_shell: settings.terminal_login_shell,
            dropped_path_double_quotes: settings.dropped_path_double_quotes,
            minimum_contrast: settings.minimum_contrast,
            clipboard_write: settings.clipboard_write,
            pane_scrollbars: settings.pane_scrollbars,
            padding: settings.terminal_padding,
            opacity: settings.terminal_opacity,
            option_as_alt: settings.option_as_alt.clone(),
            sound_enabled: settings.sound_enabled,
            sound_done: settings.sound_done.clone(),
            sound_blocked: settings.sound_blocked.clone(),
            toast_delivery: settings.toast_delivery.clone(),
        }
    }
}

/// One setting the person changed.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Change {
    Scrollback(u32),
    LoginShell(bool),
    DroppedPathDoubleQuotes(bool),
    MinimumContrast(f64),
    ClipboardWrite(bool),
    PaneScrollbars(bool),
    Padding([f64; 2]),
    Opacity(f64),
    OptionAsAlt(&'static str),
    SoundEnabled(bool),
    ToastDelivery(&'static str),
}

impl Change {
    /// The `settings.update` patch: this field and no other. `keybindings` in particular is never
    /// in it, because the core replaces that whole map.
    pub fn patch(self) -> Value {
        match self {
            Self::Scrollback(n) => json!({ "terminalScrollback": n }),
            Self::LoginShell(on) => json!({ "terminalLoginShell": on }),
            Self::DroppedPathDoubleQuotes(on) => json!({ "droppedPathDoubleQuotes": on }),
            Self::MinimumContrast(ratio) => json!({ "minimumContrast": ratio }),
            Self::ClipboardWrite(on) => json!({ "clipboardWrite": on }),
            Self::PaneScrollbars(on) => json!({ "paneScrollbars": on }),
            Self::Padding(pad) => json!({ "terminalPadding": pad }),
            Self::Opacity(opacity) => json!({ "terminalOpacity": opacity }),
            Self::OptionAsAlt(mode) => json!({ "optionAsAlt": mode }),
            Self::SoundEnabled(on) => json!({ "soundEnabled": on }),
            Self::ToastDelivery(how) => json!({ "toastDelivery": how }),
        }
    }
}

/// `value` moved by `by` and kept inside `range`, without the drift of repeated float steps
/// (`0.7 - 0.1` is not `0.6`): rounded to the step's own precision.
pub fn stepped(value: f64, by: f64, range: (f64, f64)) -> f64 {
    let scale = 1.0 / by.abs().min(1.0);
    (((value + by).clamp(range.0, range.1)) * scale).round() / scale
}

/// The entry after `current` in `choices`, wrapping; the first when `current` is not in it.
pub fn next_choice(choices: &[&'static str], current: &str) -> &'static str {
    let at = choices.iter().position(|c| *c == current);
    choices[at.map_or(0, |at| (at + 1) % choices.len())]
}

/// The scrollback typed, when it is a whole number in range.
pub fn scrollback_from_text(text: &str) -> Option<u32> {
    text.trim()
        .parse::<u32>()
        .ok()
        .filter(|n| (MIN_SCROLLBACK..=MAX_SCROLLBACK).contains(n))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_number_in_range_is_saved() {
        assert_eq!(scrollback_from_text("5000"), Some(5000));
        assert_eq!(scrollback_from_text(" 100 "), Some(100));
        assert_eq!(scrollback_from_text("200000"), Some(200_000));
        for bad in ["", "5", "99", "200001", "-4", "12.5", "ten", "1e4"] {
            assert_eq!(scrollback_from_text(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn steppers_stay_in_the_core_ranges_without_drifting() {
        assert_eq!(stepped(0.7, -0.1, OPACITY), 0.6);
        assert_eq!(stepped(0.2, -0.1, OPACITY), 0.1);
        assert_eq!(stepped(0.1, -0.1, OPACITY), 0.1);
        assert_eq!(stepped(0.9, 0.1, OPACITY), 1.0);
        assert_eq!(stepped(1.0, 0.1, OPACITY), 1.0);
        assert_eq!(stepped(4.5, 0.5, CONTRAST), 5.0);
        assert_eq!(stepped(1.0, -0.5, CONTRAST), 1.0);
        assert_eq!(stepped(21.0, 0.5, CONTRAST), 21.0);
        assert_eq!(stepped(62.0, 4.0, PADDING), 64.0);
        assert_eq!(stepped(2.0, -4.0, PADDING), 0.0);
    }

    #[test]
    fn a_choice_cycles_and_every_value_is_one_the_core_accepts() {
        assert_eq!(next_choice(&OPTION_AS_ALT, "auto"), "on");
        assert_eq!(next_choice(&OPTION_AS_ALT, "right"), "auto");
        assert_eq!(next_choice(&OPTION_AS_ALT, "unknown"), "auto");
        assert_eq!(next_choice(&TOAST_DELIVERY, "off"), "app");
    }

    #[test]
    fn a_change_patches_its_own_field_only() {
        let patch = Change::Scrollback(2500).patch();
        assert_eq!(patch, json!({"terminalScrollback": 2500}));
        assert_eq!(
            Change::LoginShell(true).patch(),
            json!({"terminalLoginShell": true})
        );
        assert_eq!(
            Change::DroppedPathDoubleQuotes(false).patch(),
            json!({"droppedPathDoubleQuotes": false})
        );
        assert_eq!(
            Change::Padding([2.0, 4.0]).patch(),
            json!({"terminalPadding": [2.0, 4.0]})
        );
        assert_eq!(
            Change::OptionAsAlt("off").patch(),
            json!({"optionAsAlt": "off"})
        );
        assert_eq!(
            Change::ToastDelivery("system").patch(),
            json!({"toastDelivery": "system"})
        );
    }
}
