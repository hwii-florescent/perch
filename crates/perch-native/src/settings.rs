//! The terminal fields of the core's `settings.current` this client's terminals and alerts follow
//! (scrollback, login shell, contrast, clipboard writes, copy on select, scrollbars, padding, opacity,
//! Option as Alt, the alert sounds and toasts), and the one-field `settings.update` patches the window
//! sends itself (the close-agent warning's "never ask again"). The Settings screen is the web's page
//! (`mods/settings`), which saves through the core the same way.

use perch_core::protocol::SettingsData;
use serde_json::{json, Value};

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
    /// A selection made with the mouse is copied when it is released.
    pub copy_on_select: bool,
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
    /// Closing an agent's tab asks first.
    pub warn_close_agent: bool,
}

impl TerminalSettings {
    pub fn from_wire(settings: &SettingsData) -> Self {
        Self {
            scrollback: settings.terminal_scrollback,
            login_shell: settings.terminal_login_shell,
            dropped_path_double_quotes: settings.dropped_path_double_quotes,
            minimum_contrast: settings.minimum_contrast,
            clipboard_write: settings.clipboard_write,
            copy_on_select: settings.copy_on_select,
            pane_scrollbars: settings.pane_scrollbars,
            padding: settings.terminal_padding,
            opacity: settings.terminal_opacity,
            option_as_alt: settings.option_as_alt.clone(),
            sound_enabled: settings.sound_enabled,
            sound_done: settings.sound_done.clone(),
            sound_blocked: settings.sound_blocked.clone(),
            toast_delivery: settings.toast_delivery.clone(),
            warn_close_agent: settings.warn_close_agent,
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
    CopyOnSelect(bool),
    PaneScrollbars(bool),
    Padding([f64; 2]),
    Opacity(f64),
    OptionAsAlt(&'static str),
    SoundEnabled(bool),
    ToastDelivery(&'static str),
    WarnCloseAgent(bool),
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
            Self::CopyOnSelect(on) => json!({ "copyOnSelect": on }),
            Self::PaneScrollbars(on) => json!({ "paneScrollbars": on }),
            Self::Padding(pad) => json!({ "terminalPadding": pad }),
            Self::Opacity(opacity) => json!({ "terminalOpacity": opacity }),
            Self::OptionAsAlt(mode) => json!({ "optionAsAlt": mode }),
            Self::SoundEnabled(on) => json!({ "soundEnabled": on }),
            Self::ToastDelivery(how) => json!({ "toastDelivery": how }),
            Self::WarnCloseAgent(on) => json!({ "warnCloseAgent": on }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            Change::CopyOnSelect(false).patch(),
            json!({"copyOnSelect": false})
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
