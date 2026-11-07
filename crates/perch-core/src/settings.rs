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

// ---------------------------------------------------------------------------
// Value types (all serde(default) so missing fields fall back gracefully)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
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
    /// The one global view for every agent session: `"cli"` (terminal, the
    /// default) or `"ui"` (native chat over the same agent process). Files
    /// written before 2026-11-05 may hold `"hosted"`, which now means `"ui"`
    /// (see [`normalize_chat_mode`]).
    #[serde(default = "default_chat_mode")]
    pub chat_mode: String,
    /// Lines of scrollback each terminal pane retains. Defaults to the 10000
    /// that used to be hardcoded client-side, so existing files are unchanged.
    #[serde(default = "default_terminal_scrollback")]
    pub terminal_scrollback: u32,
    /// Spawn plain terminal panes as a login shell. Defaults to `false`.
    #[serde(default)]
    pub terminal_login_shell: bool,
    /// Use shell-escaped double quotes for dropped paths; false keeps single quotes.
    #[serde(default)]
    pub dropped_path_double_quotes: bool,
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
    /// A single-clicked file opens as a replaceable preview tab. Defaults to `true`.
    #[serde(default = "default_true")]
    pub preview_tabs: bool,
    /// Tab corner style: "square" or "round". Defaults to square.
    #[serde(default = "default_tab_shape")]
    pub tab_shape: String,
    /// The desktop app also listens on the LAN so a paired phone can reach it
    /// (`server/phone_access.rs`). Off by default: nothing but loopback listens
    /// until the user turns it on.
    #[serde(default)]
    pub phone_access: bool,
    /// Address of the relay phones can use from any network (`relay/`); empty = off.
    #[serde(default)]
    pub relay_url: String,
    /// The user completed or skipped macOS permission setup; never a grant.
    #[serde(default)]
    pub permissions_setup_dismissed: bool,
    /// Default address-bar search engine. Older settings keep Google.
    #[serde(default = "default_browser_search_engine")]
    pub browser_search_engine: String,
    /// Ask the search engine for suggestions as the user types in the address bar. Off by
    /// default: what is typed leaves the machine (Vivaldi and Brave also default off).
    #[serde(default)]
    pub browser_search_suggestions: bool,
    /// Notify when a plan usage window reaches this percent (`usage/alerts.rs`);
    /// 0 = off.
    #[serde(default = "default_usage_limit_alert")]
    pub usage_limit_alert: u8,
    /// Notify once a day when API-equivalent spend passes this many dollars; 0 = off.
    #[serde(default)]
    pub usage_daily_budget_usd: f64,
    /// A cheap model writes a short summary when a sub-session finishes a turn without having
    /// reported (`reporter.rs`). Defaults to on; off keeps the last-message fallback.
    #[serde(default = "default_reporter_enabled")]
    pub reporter_enabled: bool,
    /// The model the reporter asks of the Claude CLI.
    #[serde(default = "default_reporter_claude_model")]
    pub reporter_claude_model: String,
    /// The model the reporter asks of the Codex CLI.
    #[serde(default = "default_reporter_codex_model")]
    pub reporter_codex_model: String,
    /// Lets a lead start sub-sessions with `perch spawn` without a person's click. Off (the
    /// default): `perch spawn` puts a suggested-task card in the lead's chat instead
    /// (`suggestions.rs`).
    #[serde(default)]
    pub leads_start_without_asking: bool,
    /// The model the reporter asks of Pi (`provider/id`); empty means Pi has no reporter.
    #[serde(default)]
    pub reporter_pi_model: String,
    /// The model the reporter asks of OMP (`provider/id`); empty means OMP has no reporter.
    #[serde(default)]
    pub reporter_omp_model: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            default_cwd: None,
            theme: default_theme(),
            sound_enabled: false,
            toast_delivery: default_toast_delivery(),
            chat_mode: default_chat_mode(),
            terminal_scrollback: default_terminal_scrollback(),
            terminal_login_shell: false,
            dropped_path_double_quotes: false,
            empty_workspace_agent: String::new(),
            keybindings: Default::default(),
            warn_close_agent: true,
            preview_tabs: true,
            tab_shape: default_tab_shape(),
            phone_access: false,
            relay_url: String::new(),
            permissions_setup_dismissed: false,
            browser_search_engine: default_browser_search_engine(),
            browser_search_suggestions: false,
            usage_limit_alert: default_usage_limit_alert(),
            usage_daily_budget_usd: 0.0,
            reporter_enabled: true,
            reporter_claude_model: default_reporter_claude_model(),
            reporter_codex_model: default_reporter_codex_model(),
            reporter_pi_model: String::new(),
            reporter_omp_model: String::new(),
            leads_start_without_asking: false,
        }
    }
}

pub(crate) fn default_reporter_enabled() -> bool {
    true
}

pub(crate) fn default_reporter_claude_model() -> String {
    "haiku".to_string()
}

pub(crate) fn default_reporter_codex_model() -> String {
    "gpt-6-luna".to_string()
}

pub(crate) fn default_usage_limit_alert() -> u8 {
    80
}

pub(crate) fn default_browser_search_engine() -> String {
    "google".to_string()
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

/// Accept the legacy `"hosted"` spelling; anything unknown is the terminal.
fn normalize_chat_mode(mode: &str) -> String {
    match mode {
        "ui" | "hosted" => "ui".to_string(),
        _ => default_chat_mode(),
    }
}

fn default_tab_shape() -> String {
    "square".to_string()
}

// ---------------------------------------------------------------------------
// Patch type — outer Option = field present/absent; inner Option = value or null
// ---------------------------------------------------------------------------

/// Patch applied by `settings.update`.
///
/// Each field follows the "absent = unchanged" convention:
/// - `default_cwd: None` → leave current default_cwd alone
/// - `default_cwd: Some(None)` → clear (set to null)
/// - `default_cwd: Some(Some("..."))` → set to that path
/// - `theme: None` → leave current theme alone
/// - `theme: Some("...")` → set to that theme (no "clear" case — a theme
///   name is never nullable, unlike `default_cwd`)
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
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
    pub dropped_path_double_quotes: Option<bool>,
    pub empty_workspace_agent: Option<String>,
    pub keybindings: Option<std::collections::BTreeMap<String, String>>,
    pub warn_close_agent: Option<bool>,
    pub preview_tabs: Option<bool>,
    pub tab_shape: Option<String>,
    pub phone_access: Option<bool>,
    pub relay_url: Option<String>,
    pub permissions_setup_dismissed: Option<bool>,
    pub browser_search_engine: Option<String>,
    pub browser_search_suggestions: Option<bool>,
    pub usage_limit_alert: Option<u8>,
    pub usage_daily_budget_usd: Option<f64>,
    pub reporter_enabled: Option<bool>,
    pub reporter_claude_model: Option<String>,
    pub reporter_codex_model: Option<String>,
    pub reporter_pi_model: Option<String>,
    pub reporter_omp_model: Option<String>,
    pub leads_start_without_asking: Option<bool>,
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
            Ok(mut s) => {
                if !valid_browser_search_engine(&s.browser_search_engine) {
                    s.browser_search_engine = default_browser_search_engine();
                }
                s.chat_mode = normalize_chat_mode(&s.chat_mode);
                Some(s)
            }
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
        if let Some(engine) = &patch.browser_search_engine {
            anyhow::ensure!(
                valid_browser_search_engine(engine),
                "unknown browser search engine"
            );
        }
        if let Some(percent) = patch.usage_limit_alert {
            anyhow::ensure!(percent <= 100, "usage limit alert must be 0-100");
        }
        if let Some(budget) = patch.usage_daily_budget_usd {
            anyhow::ensure!(
                budget.is_finite() && (0.0..=100_000.0).contains(&budget),
                "usage daily budget must be 0-100000"
            );
        }
        for model in [&patch.reporter_claude_model, &patch.reporter_codex_model]
            .into_iter()
            .flatten()
        {
            crate::sub_sessions::check_model(model).map_err(|message| anyhow::anyhow!(message))?;
        }
        // Pi and OMP have no default: empty clears the model, so that harness has no reporter.
        for model in [&patch.reporter_pi_model, &patch.reporter_omp_model]
            .into_iter()
            .flatten()
            .filter(|model| !model.is_empty())
        {
            crate::sub_sessions::check_model(model).map_err(|message| anyhow::anyhow!(message))?;
        }
        let mut guard = self.inner.lock().unwrap();
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
            guard.chat_mode = normalize_chat_mode(&chat_mode);
        }
        if let Some(scrollback) = patch.terminal_scrollback {
            guard.terminal_scrollback = scrollback;
        }
        if let Some(login_shell) = patch.terminal_login_shell {
            guard.terminal_login_shell = login_shell;
        }
        if let Some(double_quotes) = patch.dropped_path_double_quotes {
            guard.dropped_path_double_quotes = double_quotes;
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
        if let Some(preview) = patch.preview_tabs {
            guard.preview_tabs = preview;
        }
        if let Some(tab_shape) = patch.tab_shape {
            guard.tab_shape = tab_shape;
        }
        if let Some(phone_access) = patch.phone_access {
            guard.phone_access = phone_access;
        }
        if let Some(relay_url) = patch.relay_url {
            guard.relay_url = relay_url.trim().to_string();
        }
        if let Some(dismissed) = patch.permissions_setup_dismissed {
            guard.permissions_setup_dismissed = dismissed;
        }
        if let Some(engine) = patch.browser_search_engine {
            guard.browser_search_engine = engine;
        }
        if let Some(suggestions) = patch.browser_search_suggestions {
            guard.browser_search_suggestions = suggestions;
        }
        if let Some(percent) = patch.usage_limit_alert {
            guard.usage_limit_alert = percent;
        }
        if let Some(budget) = patch.usage_daily_budget_usd {
            guard.usage_daily_budget_usd = budget;
        }
        if let Some(enabled) = patch.reporter_enabled {
            guard.reporter_enabled = enabled;
        }
        if let Some(model) = patch.reporter_claude_model {
            guard.reporter_claude_model = model;
        }
        if let Some(model) = patch.reporter_codex_model {
            guard.reporter_codex_model = model;
        }
        if let Some(allowed) = patch.leads_start_without_asking {
            guard.leads_start_without_asking = allowed;
        }
        if let Some(model) = patch.reporter_pi_model {
            guard.reporter_pi_model = model;
        }
        if let Some(model) = patch.reporter_omp_model {
            guard.reporter_omp_model = model;
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

fn valid_browser_search_engine(engine: &str) -> bool {
    matches!(engine, "google" | "duckduckgo" | "bing" | "brave")
}

/// Resolve `~/.perch/settings.json` without pulling in the `dirs` crate.
pub fn default_settings_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".perch").join("settings.json"))
}

#[cfg(test)]
mod keybinding_tests {
    use super::*;

    #[test]
    fn browser_search_engine_defaults_round_trips_and_rejects_invalid_patches() {
        let dir =
            std::env::temp_dir().join(format!("perch-search-settings-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert_eq!(store.get().browser_search_engine, "google");
        for engine in ["google", "duckduckgo", "bing", "brave"] {
            let patch: SettingsPatch =
                serde_json::from_value(serde_json::json!({"browserSearchEngine": engine})).unwrap();
            store.update(patch).unwrap();
            assert_eq!(
                SettingsStore::load(&path).get().browser_search_engine,
                engine
            );
        }
        let patch: SettingsPatch = serde_json::from_value(
            serde_json::json!({"browserSearchEngine": "unknown", "theme": "perch"}),
        )
        .unwrap();
        assert!(store.update(patch).is_err());
        assert_eq!(store.get().browser_search_engine, "brave");
        assert_eq!(store.get().theme, "light");
        assert_eq!(
            SettingsStore::load(&path).get().browser_search_engine,
            "brave"
        );

        // A future/hand-edited value must not discard the rest of the settings file.
        std::fs::write(
            &path,
            r#"{"browserSearchEngine":"unknown","theme":"light"}"#,
        )
        .unwrap();
        let loaded = SettingsStore::load(&path).get();
        assert_eq!(loaded.browser_search_engine, "google");
        assert_eq!(loaded.theme, "light");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reporter_models_default_per_harness_and_pi_and_omp_can_be_cleared() {
        let dir =
            std::env::temp_dir().join(format!("perch-reporter-settings-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let store = SettingsStore::load(&path);
        let now = store.get();
        assert_eq!(
            (
                now.reporter_claude_model.as_str(),
                now.reporter_codex_model.as_str(),
                now.reporter_pi_model.as_str(),
                now.reporter_omp_model.as_str(),
            ),
            ("haiku", "gpt-6-luna", "", "")
        );
        let patch =
            |value: serde_json::Value| -> SettingsPatch { serde_json::from_value(value).unwrap() };
        store
            .update(patch(serde_json::json!({
                "reporterPiModel": "anthropic/claude-haiku-4-5",
                "reporterOmpModel": "openai-codex/gpt-5.6-luna",
            })))
            .unwrap();
        let loaded = SettingsStore::load(&path).get();
        assert_eq!(loaded.reporter_pi_model, "anthropic/claude-haiku-4-5");
        assert_eq!(loaded.reporter_omp_model, "openai-codex/gpt-5.6-luna");
        // Pi and OMP may be cleared; Claude and Codex always keep a model; none takes a flag.
        store
            .update(patch(serde_json::json!({"reporterPiModel": ""})))
            .unwrap();
        assert_eq!(store.get().reporter_pi_model, "");
        assert!(store
            .update(patch(serde_json::json!({"reporterClaudeModel": ""})))
            .is_err());
        assert!(store
            .update(patch(serde_json::json!({"reporterOmpModel": "--no-tools"})))
            .is_err());
        assert_eq!(store.get().reporter_omp_model, "openai-codex/gpt-5.6-luna");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn search_suggestions_are_off_until_the_user_turns_them_on() {
        let dir =
            std::env::temp_dir().join(format!("perch-suggest-settings-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert!(!store.get().browser_search_suggestions);
        let on: SettingsPatch =
            serde_json::from_value(serde_json::json!({"browserSearchSuggestions": true})).unwrap();
        store.update(on).unwrap();
        assert!(SettingsStore::load(&path).get().browser_search_suggestions);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn usage_alert_settings_default_round_trip_and_reject_out_of_range() {
        let dir =
            std::env::temp_dir().join(format!("perch-usage-settings-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert_eq!(store.get().usage_limit_alert, 80);
        assert_eq!(store.get().usage_daily_budget_usd, 0.0);
        let patch =
            |value: serde_json::Value| -> SettingsPatch { serde_json::from_value(value).unwrap() };
        store
            .update(patch(
                serde_json::json!({"usageLimitAlert": 0, "usageDailyBudgetUsd": 25.5}),
            ))
            .unwrap();
        let loaded = SettingsStore::load(&path).get();
        assert_eq!(loaded.usage_limit_alert, 0);
        assert_eq!(loaded.usage_daily_budget_usd, 25.5);
        for bad in [
            serde_json::json!({"usageLimitAlert": 101}),
            serde_json::json!({"usageDailyBudgetUsd": -1}),
            serde_json::json!({"usageDailyBudgetUsd": 100001}),
        ] {
            assert!(store.update(patch(bad)).is_err());
        }
        assert_eq!(store.get().usage_limit_alert, 0);
        assert_eq!(store.get().usage_daily_budget_usd, 25.5);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn chat_mode_defaults_to_cli_and_maps_legacy_hosted_to_ui() {
        let dir = std::env::temp_dir().join(format!("perch-settings-mode-{}", std::process::id()));
        let path = dir.join("settings.json");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, r#"{"theme":"perch"}"#).unwrap();
        assert_eq!(SettingsStore::load(&path).get().chat_mode, "cli");
        std::fs::write(&path, r#"{"chatMode":"hosted"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert_eq!(store.get().chat_mode, "ui");
        store
            .update(serde_json::from_str(r#"{"chatMode":"bogus"}"#).unwrap())
            .unwrap();
        assert_eq!(store.get().chat_mode, "cli");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn keybindings_and_close_warning_round_trip_and_default() {
        let dir = std::env::temp_dir().join(format!("perch-settings-kb-{}", std::process::id()));
        let path = dir.join("settings.json");
        // An old file without the new fields still loads, with the defaults.
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, r#"{"theme":"perch"}"#).unwrap();
        let store = SettingsStore::load(&path);
        assert!(store.get().keybindings.is_empty());
        assert!(!store.get().dropped_path_double_quotes);
        assert!(!store.get().permissions_setup_dismissed);
        assert!(store.get().warn_close_agent);
        assert_eq!(store.get().tab_shape, "square");

        let patch: SettingsPatch = serde_json::from_str(
            r#"{"keybindings":{"tabs.new":"cmd+t","panes.splitRight":""},"warnCloseAgent":false,"tabShape":"round","permissionsSetupDismissed":true,"droppedPathDoubleQuotes":true}"#,
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
        assert_eq!(reloaded.tab_shape, "round");
        assert!(reloaded.permissions_setup_dismissed);
        assert!(reloaded.dropped_path_double_quotes);
        store
            .update(serde_json::from_str(r#"{"droppedPathDoubleQuotes":false}"#).unwrap())
            .unwrap();
        assert!(!SettingsStore::load(&path).get().dropped_path_double_quotes);
        std::fs::remove_dir_all(&dir).ok();
    }
}
