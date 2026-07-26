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
//!   "defaultCwd": "/home/user/projects"
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub custom_models: CustomModelsData,
    pub default_cwd: Option<String>,
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
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub custom_models: Option<CustomModelsData>,
    /// Outer None = no change; Some(None) = clear; Some(Some(_)) = set.
    /// Deserialized with a custom helper because serde's double-Option
    /// needs special treatment: by default `"defaultCwd": null` and the
    /// field being absent both deserialize as `None`.
    #[serde(
        default,
        deserialize_with = "deserialize_option_option_string"
    )]
    pub default_cwd: Option<Option<String>>,
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
    path: PathBuf,
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

    /// Open using the canonical `~/.perch/settings.json` path.
    pub fn load_default() -> Self {
        let path = default_settings_path()
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
            None => {}                         // absent → unchanged
            Some(None) => guard.default_cwd = None,  // null → clear
            Some(Some(v)) => guard.default_cwd = Some(v),
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
