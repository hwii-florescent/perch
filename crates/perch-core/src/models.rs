//! Static model catalogue for perch.
//!
//! Returns the full built-in model list unconditionally — no CLI probing, no
//! semver gating. This is a deliberate design decision: version-gating is not
//! practical across environments (devpods, local macs, CI, SSH targets), and
//! the overhead of shelling out to `claude --version` at startup is not
//! justified when the model aliases used here work on any current proxy.
//!
//! Custom models can be appended via `~/.perch/settings.json` (see
//! `append_custom_models`). Stage D will replace that ad-hoc reader with a
//! formal `settings.rs` module.

use crate::protocol::ModelEntry;

/// The complete set of model lists for this server instance.
pub struct ModelLists {
    pub claude: Vec<ModelEntry>,
    pub codex: Vec<ModelEntry>,
}

/// Built-in Claude models, best/newest first.
/// Only bare aliases — dated snapshot ids (e.g. `claude-haiku-4-5-20251001`)
/// 404 on the GenAI proxy; the aliases are the stable identifiers.
const CLAUDE_CATALOGUE: &[(&str, &str)] = &[
    ("claude-fable-5",    "Fable 5"),
    ("claude-opus-4-8",   "Opus 4.8"),
    ("claude-opus-4-7",   "Opus 4.7"),
    ("claude-opus-4-6",   "Opus 4.6"),
    ("claude-sonnet-5",   "Sonnet 5"),
    ("claude-sonnet-4-6", "Sonnet 4.6"),
    ("claude-haiku-4-5",  "Haiku 4.5"),
];

/// Built-in Codex models, sourced from the installed `codex` CLI's own model
/// catalogue (`~/.codex/model-catalog.json`, referenced by `config.toml`'s
/// `model_catalog_json`) rather than guessed — that file lists every model
/// slug/display-name corp's `corp-gateway` codex provider currently serves, all with
/// `visibility: "list"`. Slugs (e.g. `gpt-5.6-terra`) are already the stable
/// identifiers codex expects via `-m`/`--model`, so no alias translation is
/// needed here (unlike Claude's dated-snapshot problem above).
///
/// `gpt-5.4-mini` is kept first (i.e. the default — `defaultModel()` in
/// `packages/web/src/models.ts` picks index 0) to preserve the pre-existing
/// default; the rest follow the catalogue's own best-first ordering.
const CODEX_CATALOGUE: &[(&str, &str)] = &[
    ("gpt-5.4-mini",   "GPT-5.4 Mini"),
    ("gpt-5.6-sol",    "GPT-5.6 Sol"),
    ("gpt-5.6-luna",   "GPT-5.6 Luna"),
    ("gpt-5.6-terra",  "GPT-5.6 Terra"),
    ("gpt-5.5",        "GPT-5.5"),
    ("gpt-5.4",        "GPT-5.4"),
    ("gpt-5.4-nano",   "GPT-5.4 Nano"),
    ("gpt-5.3-codex",  "GPT-5.3 Codex"),
];

// ---------------------------------------------------------------------------
// Custom models from ~/.perch/settings.json
// ---------------------------------------------------------------------------

/// Append any custom models declared in `~/.perch/settings.json`.
///
/// Expected shape (camelCase keys):
/// ```json
/// {
///   "customModels": {
///     "claude": [{"id": "my-model", "label": "My Model"}],
///     "codex":  [{"id": "my-codex", "label": "My Codex"}]
///   }
/// }
/// ```
///
/// Missing file, malformed JSON, or any missing field → silently ignored.
/// Duplicates (by id) are dropped to keep the list clean.
///
/// Stage D replaces this ad-hoc reader with a formal `settings.rs` module.
fn append_custom_models(
    claude_list: &mut Vec<ModelEntry>,
    codex_list: &mut Vec<ModelEntry>,
) {
    let settings_path = match dirs_path() {
        Some(p) => p,
        None => return,
    };
    let text = match std::fs::read_to_string(&settings_path) {
        Ok(t) => t,
        Err(_) => return,
    };
    let val: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("~/.perch/settings.json parse error (ignoring): {e}");
            return;
        }
    };
    let Some(custom) = val.get("customModels") else { return };

    for (agent_key, target) in [("claude", &mut *claude_list), ("codex", &mut *codex_list)] {
        let Some(arr) = custom.get(agent_key).and_then(|v| v.as_array()) else {
            continue;
        };
        for entry in arr {
            let Some(id) = entry.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let label = entry
                .get("label")
                .and_then(|v| v.as_str())
                .unwrap_or(id);
            // Dedupe by id.
            if target.iter().any(|m| m.id == id) {
                continue;
            }
            target.push(ModelEntry {
                id: id.to_string(),
                label: label.to_string(),
            });
        }
    }
}

/// Resolve `~/.perch/settings.json` without the `dirs` crate.
fn dirs_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".perch").join("settings.json"))
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Return the full model catalogue for this server instance.
///
/// The built-in lists are static by design (user decision — per-environment
/// version-gating via `claude --version` is not practical). Custom entries
/// from `~/.perch/settings.json` are appended after the built-ins and
/// deduplicated by id. Stage D formalises custom-model configuration.
pub fn catalogue() -> ModelLists {
    let mut claude: Vec<ModelEntry> = CLAUDE_CATALOGUE
        .iter()
        .map(|(id, label)| ModelEntry {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect();

    let mut codex: Vec<ModelEntry> = CODEX_CATALOGUE
        .iter()
        .map(|(id, label)| ModelEntry {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect();

    append_custom_models(&mut claude, &mut codex);

    ModelLists { claude, codex }
}
