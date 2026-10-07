//! Formal settings store for perch.
//!
//! Reads/writes `~/.perch/settings.json` atomically (write to temp → rename).
//! Replaces the ad-hoc custom-model reader in `models.rs` (which still exists
//! for the `server.info` catalogue path; Stage D's model catalogue now picks
//! up custom models via this module when the settings store is wired into
//! `AppState`).
//!
//! JSON shape on disk (camelCase to match the TypeScript client):
//! ```json
//! {
//!   "customModels": {
//!     "claude": [{"id": "my-model", "label": "My Model"}],
//!     "codex":  []
//!   },
//!   "defaultCwd": "/home/user/projects",
//!   "theme": "perch"
//! }
//! ```

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::protocol::ModelEntry;

// ---------------------------------------------------------------------------
// Value types (all serde(default) so missing fields fall back gracefully)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct CustomModelsData {
    pub claude: Vec<ModelEntry>,
    pub codex: Vec<ModelEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub custom_models: CustomModelsData,
    pub default_cwd: Option<String>,
    /// Selected theme name (key into the web client's `THEMES` table).
    /// Defaults to `"perch"`, perch's monotone look.
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Play a short WebAudio-generated tone on session done/blocked
    /// transitions. Defaults to `false` (opt-in).
    #[serde(default)]
    pub sound_enabled: bool,
    /// Toast delivery mode: `"off"` | `"app"` | `"system"`. Defaults to `"app"`.
    #[serde(default = "default_toast_delivery")]
    pub toast_delivery: String,
    /// Global chat rendering mode: `"hosted"` | `"cli"`. Used to be per-chat
    /// client state (a footer toggle in the chat pane); now a single global
    /// setting so every open chat pane renders the same way, controlled from
    /// Settings. Defaults to `"cli"`; the one mode for every session.
    #[serde(default = "default_chat_mode")]
    pub chat_mode: String,
    /// Lines of scrollback each terminal pane retains. Defaults to the 10000
    /// that used to be hardcoded client-side, so existing files are unchanged.
    #[serde(default = "default_terminal_scrollback")]
    pub terminal_scrollback: u32,
    /// Spawn plain terminal panes as a login shell. Defaults to `false`.
    #[serde(default)]
    pub terminal_login_shell: bool,
    /// Provider id a click on a workspace with no sessions starts
    /// (e.g. `"terminal"`). Empty (the default) shows the start picker.
    #[serde(default)]
    pub empty_workspace_agent: String,
    /// Shortcut overrides: action id → key combo (`"cmd+shift+t"`), `""` =
    /// no shortcut. An absent id keeps the client's default.
    #[serde(default)]
    pub keybindings: std::collections::BTreeMap<String, String>,
    /// Ask before closing a tab that runs an agent. Defaults to `true`.
    #[serde(default = "default_true")]
    pub warn_close_agent: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            custom_models: CustomModelsData::default(),
            default_cwd: None,
            theme: default_theme(),
            sound_enabled: false,
            toast_delivery: default_toast_delivery(),
            chat_mode: default_chat_mode(),
            terminal_scrollback: default_terminal_scrollback(),
            terminal_login_shell: false,
            empty_workspace_agent: String::new(),
            keybindings: Default::default(),
            warn_close_agent: true,
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_theme() -> String {
    "perch".to_string()
}

fn default_terminal_scrollback() -> u32 {
    10_000
}

fn default_toast_delivery() -> String {
    "app".to_string()
}

fn default_chat_mode() -> String {
    "cli".to_string()
}

// ---------------------------------------------------------------------------
// Patch type — outer Option = field present/absent; inner Option = value or null
// ---------------------------------------------------------------------------

/// Patch applied by `settings.update`.
///
/// Each field follows the "absent = unchanged" convention:
/// - `custom_models: None`  → leave current custom models alone
/// - `custom_models: Some(data)` → replace the whole struct
/// - `default_cwd: None` → leave current default_cwd alone
/// - `default_cwd: Some(None)` → clear (set to null)
/// - `default_cwd: Some(Some("..."))` → set to that path
/// - `theme: None` → leave current theme alone
/// - `theme: Some("...")` → set to that theme (no "clear" case — a theme
///   name is never nullable, unlike `default_cwd`)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub custom_models: Option<CustomModelsData>,
    /// Outer None = no change; Some(None) = clear; Some(Some(_)) = set.
    /// Deserialized with a custom helper because serde's double-Option
    /// needs special treatment: by default `"defaultCwd": null` and the
    /// field being absent both deserialize as `None`.
    #[serde(default, deserialize_with = "deserialize_option_option_string")]
    pub default_cwd: Option<Option<String>>,
    pub theme: Option<String>,
    pub sound_enabled: Option<bool>,
    pub toast_delivery: Option<String>,
    pub chat_mode: Option<String>,
    pub terminal_scrollback: Option<u32>,
    pub terminal_login_shell: Option<bool>,
    pub empty_workspace_agent: Option<String>,
    pub keybindings: Option<std::collections::BTreeMap<String, String>>,
    pub warn_close_agent: Option<bool>,
}

/// Deserialize a field where `absent`, `null`, and `"value"` are distinct:
/// - field absent   → `None`
/// - field = null   → `Some(None)`
/// - field = "str"  → `Some(Some("str"))`
fn deserialize_option_option_string<'de, D>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    // serde_json will call the deserializer; if the field is absent the default
    // kicks in (`None`) before this function is even called (because of
    // `#[serde(default)]`). When the field IS present, we get `Some(inner)`.
    let inner: Option<String> = Option::deserialize(deserializer)?;
    Ok(Some(inner))
}

// ---------------------------------------------------------------------------
// SettingsStore
// ---------------------------------------------------------------------------

pub struct SettingsStore {
    pub(crate) path: PathBuf,
    inner: Mutex<Settings>,
}

impl SettingsStore {
    /// Open (or create) the settings file at `path`.
    /// A missing or invalid file silently yields `Settings::default()`.
    pub fn load(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let inner = Self::read_from_disk(&path).unwrap_or_default();
        SettingsStore {
            path,
            inner: Mutex::new(inner),
        }
    }

    /// Open `$PERCH_SETTINGS` (tests isolate with it), else the canonical
    /// `~/.perch/settings.json`.
    pub fn load_default() -> Self {
        let path = std::env::var_os("PERCH_SETTINGS")
            .map(PathBuf::from)
            .or_else(default_settings_path)
            .unwrap_or_else(|| PathBuf::from(".perch/settings.json"));
        Self::load(path)
    }

    fn read_from_disk(path: &Path) -> Option<Settings> {
        let text = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str::<Settings>(&text) {
            Ok(s) => Some(s),
            Err(e) => {
                tracing::warn!("~/.perch/settings.json parse error (using defaults): {e}");
                None
            }
        }
    }

    /// Return a clone of the current settings.
    pub fn get(&self) -> Settings {
        self.inner.lock().unwrap().clone()
    }

    /// Apply `patch` to the in-memory settings and persist atomically.
    pub fn update(&self, patch: SettingsPatch) -> anyhow::Result<Settings> {
        let mut guard = self.inner.lock().unwrap();
        if let Some(cm) = patch.custom_models {
            guard.custom_models = cm;
        }
        match patch.default_cwd {
            None => {}                              // absent → unchanged
            Some(None) => guard.default_cwd = None, // null → clear
            Some(Some(v)) => guard.default_cwd = Some(v),
        }
        if let Some(theme) = patch.theme {
            guard.theme = theme;
        }
        if let Some(sound_enabled) = patch.sound_enabled {
            guard.sound_enabled = sound_enabled;
        }
        if let Some(toast_delivery) = patch.toast_delivery {
            guard.toast_delivery = toast_delivery;
        }
        if let Some(chat_mode) = patch.chat_mode {
            guard.chat_mode = chat_mode;
        }
        if let Some(scrollback) = patch.terminal_scrollback {
            guard.terminal_scrollback = scrollback;
        }
        if let Some(login_shell) = patch.terminal_login_shell {
            guard.terminal_login_shell = login_shell;
        }
        if let Some(agent) = patch.empty_workspace_agent {
            guard.empty_workspace_agent = agent;
        }
        if let Some(keybindings) = patch.keybindings {
            guard.keybindings = keybindings;
        }
        if let Some(warn) = patch.warn_close_agent {
            guard.warn_close_agent = warn;
        }
        let snapshot = guard.clone();
        drop(guard);
        self.write_to_disk(&snapshot)?;
        Ok(snapshot)
    }

    fn write_to_disk(&self, settings: &Settings) -> anyhow::Result<()> {
        // Ensure the parent directory exists.
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // Write to a temp file, then rename (atomic on POSIX).
        let tmp_path = self.path.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(settings)?;
        std::fs::write(&tmp_path, json)?;
        std::fs::rename(&tmp_path, &self.path)?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve `~/.perch/settings.json` without pulling in the `dirs` crate.
pub fn default_settings_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".perch").join("settings.json"))
}

#[cfg(test)]
mod keybinding_tests {
    use super::*;

    #[test]
    fn keybindings_and_close_warning_round_trip_and_default() {
        let dir = std::env::temp_dir().join(format!("perch-settings-kb-{}", std::process::id()));
        let path = dir.join("settings.json");
        // An old file without the new fields still loads, with the defaults.
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, r#"{"theme":"perch"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert!(store.get().keybindings.is_empty());
        assert!(store.get().warn_close_agent);

        let patch: SettingsPatch = serde_json::from_str(
            r#"{"keybindings":{"tabs.new":"cmd+t","panes.splitRight":""},"warnCloseAgent":false}"#,
        )
        .unwrap();
        store.update(patch).unwrap();
        let reloaded = SettingsStore::load(&path).get();
        assert_eq!(
            reloaded.keybindings.get("tabs.new").map(String::as_str),
            Some("cmd+t")
        );
        assert_eq!(
            reloaded
                .keybindings
                .get("panes.splitRight")
                .map(String::as_str),
            Some("")
        );
        assert!(!reloaded.warn_close_agent);
        std::fs::remove_dir_all(&dir).ok();
    }
}
