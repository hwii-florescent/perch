//! The terminal section of Settings: the three things the web's Settings > Terminal offers
//! (`stock-ui/settings-terminal`), read from the core's `settings.current` and changed with a
//! `settings.update` that carries only the field that changed.
//!
//! Scrollback is saved only when it is in range, as the web does, so typing `5000` never stores
//! `5` on the way. The core applies the login shell to terminals it starts afterwards, and the
//! quoting of dropped paths belongs to file drops, which this client does not do yet.

use perch_core::protocol::SettingsData;
use serde_json::{json, Value};

/// The range the web accepts for scrollback lines (`xtermSetup.ts`).
pub const MIN_SCROLLBACK: u32 = 100;
pub const MAX_SCROLLBACK: u32 = 200_000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TerminalSettings {
    /// Lines of scrollback each terminal keeps.
    pub scrollback: u32,
    /// Plain terminals start as a login shell.
    pub login_shell: bool,
    /// Dropped paths are wrapped in double quotes rather than single.
    pub dropped_path_double_quotes: bool,
}

impl TerminalSettings {
    pub fn from_wire(settings: &SettingsData) -> Self {
        Self {
            scrollback: settings.terminal_scrollback,
            login_shell: settings.terminal_login_shell,
            dropped_path_double_quotes: settings.dropped_path_double_quotes,
        }
    }
}

/// One setting the person changed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Change {
    Scrollback(u32),
    LoginShell(bool),
    DroppedPathDoubleQuotes(bool),
}

impl Change {
    /// The `settings.update` patch: this field and no other. `keybindings` in particular is never
    /// in it, because the core replaces that whole map.
    pub fn patch(self) -> Value {
        match self {
            Self::Scrollback(n) => json!({ "terminalScrollback": n }),
            Self::LoginShell(on) => json!({ "terminalLoginShell": on }),
            Self::DroppedPathDoubleQuotes(on) => json!({ "droppedPathDoubleQuotes": on }),
        }
    }
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
    }
}
