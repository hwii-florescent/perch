//! Model catalogue for perch.
//!
//! Two lists with deliberately different sourcing strategies:
//!
//! * **Claude** — a static list of bare aliases. There is no machine-local
//!   file that enumerates them, and version-gating via `claude --version` is
//!   not practical across environments (devpods, local macs, CI, SSH
//!   targets), so the aliases below are used unconditionally.
//! * **Codex** — read at boot from the local codex installation
//!   (`~/.codex/config.toml` → `model_catalog_json`, defaulting to
//!   `~/.codex/model-catalog.json`) so the picker mirrors whatever the codex
//!   CLI on *this* machine actually serves, rather than a list copied from
//!   one developer's laptop. `CODEX_CATALOGUE` remains as the fallback for
//!   machines with no readable catalog file.
//!
//! The local lists are resolved once at startup. Remote hosts get their own:
//! `mode: "perch"` hosts report theirs over the wire (`server.info`), and
//! `mode: "direct"` hosts have their `~/.codex` config+catalogue fetched by
//! `hub.rs` during the prereq probe and parsed here by
//! [`parse_remote_codex_payload`] — same two parsers, different transport.
//!
//! Custom models can be appended via `~/.perch/settings.json` (see
//! `append_custom_models`). Stage D will replace that ad-hoc reader with a
//! formal `settings.rs` module.

use std::path::PathBuf;

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
    ("claude-opus-5",     "Opus 5"),
    ("claude-opus-4-8",   "Opus 4.8"),
    ("claude-opus-4-7",   "Opus 4.7"),
    ("claude-opus-4-6",   "Opus 4.6"),
    ("claude-sonnet-5",   "Sonnet 5"),
    ("claude-sonnet-4-6", "Sonnet 4.6"),
    ("claude-haiku-4-5",  "Haiku 4.5"),
];

/// Fallback Codex models, used only when the local codex installation has no
/// readable model catalogue (see `load_codex_models`).
///
/// This snapshot was taken from a machine whose `codex` CLI is backed by
/// corp's `corp-gateway` provider; the slugs (e.g. `gpt-5.6-terra`) are already the
/// stable identifiers codex expects via `-m`/`--model`, so no alias
/// translation is needed here (unlike Claude's dated-snapshot problem above).
///
/// Best-first, in the catalogue's own priority order. `gpt-5.4-mini` carries
/// the `isDefault` flag (the historical perch default) — lists are never
/// reordered around the default; clients preselect the flagged entry.
const CODEX_CATALOGUE: &[(&str, &str)] = &[
    ("gpt-5.6-sol",    "GPT-5.6 Sol"),
    ("gpt-5.6-luna",   "GPT-5.6 Luna"),
    ("gpt-5.6-terra",  "GPT-5.6 Terra"),
    ("gpt-5.5",        "GPT-5.5"),
    ("gpt-5.4",        "GPT-5.4"),
    ("gpt-5.4-mini",   "GPT-5.4 Mini"),
    ("gpt-5.4-nano",   "GPT-5.4 Nano"),
    ("gpt-5.3-codex",  "GPT-5.3 Codex"),
];

/// The flagged default within [`CODEX_CATALOGUE`].
const CODEX_FALLBACK_DEFAULT: &str = "gpt-5.4-mini";

// ---------------------------------------------------------------------------
// Runtime codex catalogue (~/.codex)
// ---------------------------------------------------------------------------

/// Default catalogue filename inside `~/.codex` when `config.toml` does not
/// point somewhere else via `model_catalog_json`.
const CODEX_CATALOG_FILE: &str = "model-catalog.json";

/// Extract the two `~/.codex/config.toml` top-level keys perch cares about:
/// `model` (the slug the codex CLI itself defaults to) and
/// `model_catalog_json` (absolute path to the catalogue file).
///
/// Pure so it can be unit-tested without touching `$HOME`. Any parse failure
/// is treated as "neither key present" — a broken/unfamiliar codex config
/// must never stop perch from booting.
///
/// `pub(crate)` because the same text also arrives over ssh from a direct-mode
/// host (see [`parse_remote_codex_payload`]).
pub(crate) fn parse_codex_config(toml_text: &str) -> (Option<String>, Option<PathBuf>) {
    let value: toml::Value = match toml_text.parse() {
        Ok(v) => v,
        Err(_) => return (None, None),
    };
    let model = value
        .get("model")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let catalog = value
        .get("model_catalog_json")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    (model, catalog)
}

/// Read `priority` as an integer, tolerating a JSON float.
fn catalog_priority(entry: &serde_json::Value) -> i64 {
    match entry.get("priority") {
        Some(v) => v
            .as_i64()
            .or_else(|| v.as_f64().map(|f| f as i64))
            .unwrap_or(0),
        None => 0,
    }
}

/// Whether a catalogue entry should be shown in the picker: codex marks
/// hidden/experimental models with a `visibility` other than `"list"`; the
/// key being absent means "listed".
fn catalog_visible(entry: &serde_json::Value) -> bool {
    match entry.get("visibility") {
        None | Some(serde_json::Value::Null) => true,
        Some(v) => v.as_str() == Some("list"),
    }
}

/// Parse a codex `model-catalog.json` into perch model entries.
///
/// Shape: `{"models": [{"slug", "display_name", "visibility", "priority"}]}`.
/// Entries without a `slug` are skipped, `display_name` falls back to the
/// slug, duplicates (by slug) are dropped, and the result is sorted by
/// `priority` ascending (codex's own best-first ordering; missing = 0).
///
/// If `default_slug` is present in the list, that entry gets `is_default:
/// true` **in place** — the list always stays in the catalogue's own
/// best-first order (user decision: never reorder around the default; the
/// web client preselects the flagged entry, falling back to index 0).
///
/// Pure: returns an empty vec on any malformed input, and the caller decides
/// whether to fall back to [`CODEX_CATALOGUE`].
///
/// `pub(crate)` because a direct-mode host's catalogue arrives over ssh and is
/// parsed with exactly this function (see [`parse_remote_codex_payload`]).
pub(crate) fn parse_codex_catalog(json_text: &str, default_slug: Option<&str>) -> Vec<ModelEntry> {
    let value: serde_json::Value = match serde_json::from_str(json_text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let Some(models) = value.get("models").and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    let mut collected: Vec<(i64, ModelEntry)> = Vec::new();
    for entry in models {
        if !catalog_visible(entry) {
            continue;
        }
        let Some(slug) = entry.get("slug").and_then(|v| v.as_str()) else {
            continue;
        };
        if slug.is_empty() || collected.iter().any(|(_, m)| m.id == slug) {
            continue;
        }
        let label = entry
            .get("display_name")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or(slug);
        collected.push((
            catalog_priority(entry),
            ModelEntry {
                id: slug.to_string(),
                label: label.to_string(),
                is_default: false,
            },
        ));
    }

    // Stable sort keeps file order for equal priorities.
    collected.sort_by_key(|(priority, _)| *priority);
    let mut list: Vec<ModelEntry> = collected.into_iter().map(|(_, m)| m).collect();

    // The configured default keeps its catalogue position — clients preselect
    // the flagged entry rather than perch reordering the list (user decision:
    // the picker should always read best-first, exactly as codex orders it).
    if let Some(default_slug) = default_slug {
        if let Some(entry) = list.iter_mut().find(|m| m.id == default_slug) {
            entry.is_default = true;
        }
    }

    list
}

// ---------------------------------------------------------------------------
// Remote codex catalogue (direct-mode hosts, fetched over ssh)
// ---------------------------------------------------------------------------

/// Marker line introducing the remote `~/.codex/config.toml` text.
pub(crate) const REMOTE_CFG_MARKER: &str = "__PERCH_CODEX_CFG__";

/// Marker line introducing the remote model-catalogue JSON text.
pub(crate) const REMOTE_CATALOG_MARKER: &str = "__PERCH_CODEX_CATALOG__";

/// Parse the delimited payload produced by
/// `ssh::fetch_remote_codex_catalog` for a `mode: "direct"` host.
///
/// The remote has no perch to ask, so instead of a protocol message perch
/// `cat`s the two files it would have read locally and ships them back in one
/// stream, separated by marker lines:
///
/// ```text
/// __PERCH_CODEX_CFG__
/// <contents of ~/.codex/config.toml>
/// __PERCH_CODEX_CATALOG__
/// <contents of the model catalogue json>
/// ```
///
/// Either section may be empty (missing/unreadable file on the remote), and
/// anything before the first marker is discarded — an ssh login can prepend a
/// MOTD, exactly as [`crate::ssh::probe_host`] guards against. A marker is
/// only recognised as a **whole line**, so the same text appearing inside a
/// JSON string cannot split the payload.
///
/// The two sections then go through the same [`parse_codex_config`] /
/// [`parse_codex_catalog`] pair used for the local install, including
/// flagging the configured default slug via `is_default` (in place — order is
/// never changed). Returns an empty vec for
/// anything malformed or missing; the caller (`hub.rs`) decides the fallback.
pub(crate) fn parse_remote_codex_payload(payload: &str) -> Vec<ModelEntry> {
    #[derive(PartialEq, Clone, Copy)]
    enum Section {
        Preamble,
        Config,
        Catalog,
    }

    let mut section = Section::Preamble;
    let mut config = String::new();
    let mut catalog = String::new();
    for line in payload.lines() {
        let trimmed = line.trim();
        if trimmed == REMOTE_CFG_MARKER {
            section = Section::Config;
            continue;
        }
        if trimmed == REMOTE_CATALOG_MARKER {
            section = Section::Catalog;
            continue;
        }
        match section {
            Section::Preamble => {}
            Section::Config => {
                config.push_str(line);
                config.push('\n');
            }
            Section::Catalog => {
                catalog.push_str(line);
                catalog.push('\n');
            }
        }
    }

    if catalog.trim().is_empty() {
        return Vec::new();
    }
    let (default_slug, _) = parse_codex_config(&config);
    parse_codex_catalog(&catalog, default_slug.as_deref())
}

/// Load the codex model list from the local codex installation.
///
/// `~/.codex/config.toml` supplies the default model slug and (optionally) an
/// override path for the catalogue; otherwise `~/.codex/model-catalog.json`
/// is used. Returns `None` when anything is missing or unusable, in which
/// case the caller falls back to the static [`CODEX_CATALOGUE`].
fn load_codex_models() -> Option<Vec<ModelEntry>> {
    let codex_dir = PathBuf::from(std::env::var("HOME").ok()?).join(".codex");

    let (default_slug, catalog_override) = std::fs::read_to_string(codex_dir.join("config.toml"))
        .ok()
        .map(|text| parse_codex_config(&text))
        .unwrap_or((None, None));

    let catalog_path = catalog_override.unwrap_or_else(|| codex_dir.join(CODEX_CATALOG_FILE));
    let json_text = std::fs::read_to_string(&catalog_path).ok()?;

    let models = parse_codex_catalog(&json_text, default_slug.as_deref());
    if models.is_empty() {
        return None;
    }
    tracing::info!(
        "[perch] codex models from {}: {} entries (default {})",
        catalog_path.display(),
        models.len(),
        models
            .iter()
            .find(|m| m.is_default)
            .unwrap_or(&models[0])
            .id
    );
    Some(models)
}

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
                is_default: false,
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
/// Claude is static by design (user decision — per-environment version-gating
/// via `claude --version` is not practical). Codex is read at boot from the
/// local codex installation so the picker mirrors what *this* machine's codex
/// actually serves, falling back to [`CODEX_CATALOGUE`] when no catalogue file
/// is readable. Custom entries from `~/.perch/settings.json` are appended
/// after the built-ins and deduplicated by id.
///
/// Resolved once at startup for the local host only — federated hosts report
/// their own lists, so nothing here is ever probed per host.
pub fn catalogue() -> ModelLists {
    let mut claude: Vec<ModelEntry> = CLAUDE_CATALOGUE
        .iter()
        .map(|(id, label)| ModelEntry {
            id: id.to_string(),
            label: label.to_string(),
            is_default: false,
        })
        .collect();

    let mut codex: Vec<ModelEntry> = match load_codex_models() {
        Some(list) => list,
        None => {
            tracing::info!(
                "[perch] no readable codex model catalogue (~/.codex) — \
                 falling back to the built-in codex model list"
            );
            CODEX_CATALOGUE
                .iter()
                .map(|(id, label)| ModelEntry {
                    id: id.to_string(),
                    label: label.to_string(),
                    is_default: *id == CODEX_FALLBACK_DEFAULT,
                })
                .collect()
        }
    };

    append_custom_models(&mut claude, &mut codex);

    ModelLists { claude, codex }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Trimmed-down shape of a real `~/.codex/model-catalog.json`.
    const CATALOG: &str = r#"{
      "models": [
        {"slug": "gpt-5.4", "display_name": "GPT-5.4", "visibility": "list", "priority": -10},
        {"slug": "gpt-5.6-sol", "display_name": "GPT-5.6 Sol", "visibility": "list", "priority": -30},
        {"slug": "gpt-5.6-luna", "display_name": "GPT-5.6 Luna", "visibility": "list", "priority": -29},
        {"slug": "gpt-5.3-codex", "display_name": "GPT-5.3 Codex", "visibility": "list", "priority": -2}
      ]
    }"#;

    fn ids(list: &[ModelEntry]) -> Vec<&str> {
        list.iter().map(|m| m.id.as_str()).collect()
    }

    #[test]
    fn catalog_sorted_by_priority_ascending() {
        let list = parse_codex_catalog(CATALOG, None);
        assert_eq!(
            ids(&list),
            vec!["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.4", "gpt-5.3-codex"]
        );
        assert_eq!(list[0].label, "GPT-5.6 Sol");
    }

    #[test]
    fn default_model_is_flagged_in_place() {
        let list = parse_codex_catalog(CATALOG, Some("gpt-5.6-luna"));
        // Order is untouched — the default is flagged, not promoted.
        assert_eq!(
            ids(&list),
            vec!["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.4", "gpt-5.3-codex"]
        );
        assert_eq!(
            list.iter().find(|m| m.is_default).map(|m| m.id.as_str()),
            Some("gpt-5.6-luna")
        );
        assert_eq!(list.iter().filter(|m| m.is_default).count(), 1);
    }

    #[test]
    fn unknown_default_model_leaves_order_untouched() {
        let list = parse_codex_catalog(CATALOG, Some("gpt-9-nope"));
        assert_eq!(ids(&list), ids(&parse_codex_catalog(CATALOG, None)));
        assert!(list.iter().all(|m| !m.is_default));
    }

    #[test]
    fn hidden_models_and_slugless_entries_are_skipped() {
        let json = r#"{
          "models": [
            {"slug": "shown", "priority": -5},
            {"slug": "hidden", "visibility": "hidden", "priority": -9},
            {"slug": "internal", "visibility": "none", "priority": -8},
            {"display_name": "No slug", "priority": -7}
          ]
        }"#;
        assert_eq!(ids(&parse_codex_catalog(json, None)), vec!["shown"]);
    }

    #[test]
    fn missing_visibility_counts_as_listed_and_missing_priority_is_zero() {
        let json = r#"{
          "models": [
            {"slug": "no-priority", "display_name": "No Priority"},
            {"slug": "negative", "display_name": "Negative", "priority": -1},
            {"slug": "positive", "display_name": "Positive", "priority": 5}
          ]
        }"#;
        assert_eq!(
            ids(&parse_codex_catalog(json, None)),
            vec!["negative", "no-priority", "positive"]
        );
    }

    #[test]
    fn duplicate_slugs_are_dropped_keeping_the_first() {
        let json = r#"{
          "models": [
            {"slug": "dup", "display_name": "First", "priority": -1},
            {"slug": "dup", "display_name": "Second", "priority": -9},
            {"slug": "other", "display_name": "Other", "priority": -5}
          ]
        }"#;
        let list = parse_codex_catalog(json, None);
        assert_eq!(ids(&list), vec!["other", "dup"]);
        assert_eq!(list[1].label, "First");
    }

    #[test]
    fn display_name_falls_back_to_slug() {
        let json = r#"{"models": [{"slug": "bare-slug"}, {"slug": "empty", "display_name": ""}]}"#;
        let list = parse_codex_catalog(json, None);
        assert_eq!(list[0].label, "bare-slug");
        assert_eq!(list[1].label, "empty");
    }

    #[test]
    fn malformed_or_shapeless_catalog_yields_nothing() {
        assert!(parse_codex_catalog("", None).is_empty());
        assert!(parse_codex_catalog("not json at all", None).is_empty());
        assert!(parse_codex_catalog("{}", None).is_empty());
        assert!(parse_codex_catalog(r#"{"models": "nope"}"#, None).is_empty());
        assert!(parse_codex_catalog(r#"{"models": []}"#, None).is_empty());
    }

    #[test]
    fn config_yields_model_and_catalog_path() {
        let toml_text = r#"
model = "gpt-5.6-luna"
model_catalog_json = "/Users/someone/.codex/model-catalog.json"
model_provider = "corp-gateway"

[features]
js_repl = false
"#;
        let (model, path) = parse_codex_config(toml_text);
        assert_eq!(model.as_deref(), Some("gpt-5.6-luna"));
        assert_eq!(
            path,
            Some(PathBuf::from("/Users/someone/.codex/model-catalog.json"))
        );
    }

    #[test]
    fn config_without_the_keys_or_malformed_yields_none() {
        let (model, path) = parse_codex_config("model_provider = \"corp-gateway\"\n");
        assert!(model.is_none() && path.is_none());

        let (model, path) = parse_codex_config("this is [not valid toml");
        assert!(model.is_none() && path.is_none());

        // Empty strings are treated as absent.
        let (model, path) = parse_codex_config("model = \"\"\nmodel_catalog_json = \"\"\n");
        assert!(model.is_none() && path.is_none());
    }

    #[test]
    fn real_shaped_catalog_matches_expected_runtime_order() {
        // Mirrors this machine's ~/.codex catalogue (8 models, all "list").
        let json = r#"{
          "models": [
            {"slug": "gpt-5.6-sol", "display_name": "GPT-5.6 Sol", "visibility": "list", "priority": -30},
            {"slug": "gpt-5.6-luna", "display_name": "GPT-5.6 Luna", "visibility": "list", "priority": -29},
            {"slug": "gpt-5.6-terra", "display_name": "GPT-5.6 Terra", "visibility": "list", "priority": -28},
            {"slug": "gpt-5.5", "display_name": "GPT-5.5", "visibility": "list", "priority": -20},
            {"slug": "gpt-5.4", "display_name": "GPT-5.4", "visibility": "list", "priority": -10},
            {"slug": "gpt-5.4-mini", "display_name": "GPT-5.4 Mini", "visibility": "list", "priority": -6},
            {"slug": "gpt-5.4-nano", "display_name": "GPT-5.4 Nano", "visibility": "list", "priority": -4},
            {"slug": "gpt-5.3-codex", "display_name": "GPT-5.3 Codex", "visibility": "list", "priority": -2}
          ]
        }"#;
        let (model, _) = parse_codex_config("model = \"gpt-5.6-luna\"\n");
        let list = parse_codex_catalog(json, model.as_deref());
        assert_eq!(
            ids(&list),
            vec![
                "gpt-5.6-sol",
                "gpt-5.6-luna",
                "gpt-5.6-terra",
                "gpt-5.5",
                "gpt-5.4",
                "gpt-5.4-mini",
                "gpt-5.4-nano",
                "gpt-5.3-codex",
            ]
        );
        assert_eq!(
            list.iter().find(|m| m.is_default).map(|m| m.id.as_str()),
            Some("gpt-5.6-luna")
        );
    }

    #[test]
    fn remote_payload_parses_config_and_catalog() {
        let payload = format!(
            "{REMOTE_CFG_MARKER}\n\
             model = \"gpt-5.4\"\n\
             model_catalog_json = \"/home/user/.codex/model-catalog.json\"\n\
             model_provider = \"corp-gateway\"\n\
             {REMOTE_CATALOG_MARKER}\n{CATALOG}\n"
        );
        let list = parse_remote_codex_payload(&payload);
        // Order stays priority-sorted; the config default is flagged in place.
        assert_eq!(
            ids(&list),
            vec!["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.4", "gpt-5.3-codex"]
        );
        assert_eq!(
            list.iter().find(|m| m.is_default).map(|m| m.id.as_str()),
            Some("gpt-5.4")
        );
    }

    #[test]
    fn remote_payload_tolerates_an_ssh_preamble() {
        // A chatty remote login (MOTD) prepends noise before the first marker.
        let payload = format!(
            "Welcome to Ubuntu\n* documentation: https://help.ubuntu.com\n\
             {REMOTE_CFG_MARKER}\nmodel = \"gpt-5.3-codex\"\n{REMOTE_CATALOG_MARKER}\n{CATALOG}"
        );
        let list = parse_remote_codex_payload(&payload);
        assert_eq!(
            list.iter().find(|m| m.is_default).map(|m| m.id.as_str()),
            Some("gpt-5.3-codex")
        );
    }

    #[test]
    fn remote_payload_without_a_config_section_keeps_catalog_order() {
        // Remote has a catalogue but no readable config.toml: nothing to
        // promote, so codex's own priority ordering stands.
        let payload = format!("{REMOTE_CFG_MARKER}\n{REMOTE_CATALOG_MARKER}\n{CATALOG}");
        assert_eq!(
            ids(&parse_remote_codex_payload(&payload)),
            ids(&parse_codex_catalog(CATALOG, None))
        );
        // Same when the config marker is absent entirely.
        let payload = format!("{REMOTE_CATALOG_MARKER}\n{CATALOG}");
        assert_eq!(
            ids(&parse_remote_codex_payload(&payload)),
            vec!["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.4", "gpt-5.3-codex"]
        );
    }

    #[test]
    fn remote_payload_without_a_usable_catalog_yields_nothing() {
        // Stock codex install: config present, no catalogue file.
        let payload =
            format!("{REMOTE_CFG_MARKER}\nmodel = \"gpt-5.4\"\n{REMOTE_CATALOG_MARKER}\n");
        assert!(parse_remote_codex_payload(&payload).is_empty());
        // Garbage where the catalogue should be, no markers at all, empty.
        let payload = format!(
            "{REMOTE_CFG_MARKER}\n{REMOTE_CATALOG_MARKER}\ncat: No such file or directory\n"
        );
        assert!(parse_remote_codex_payload(&payload).is_empty());
        assert!(parse_remote_codex_payload("just some ssh noise").is_empty());
        assert!(parse_remote_codex_payload("").is_empty());
    }

    #[test]
    fn remote_payload_markers_must_be_whole_lines() {
        // The marker text inside a JSON string must not split the payload:
        // both models below still parse even though a display name contains
        // the catalog marker verbatim.
        let json = r#"{
          "models": [
            {"slug": "gpt-5.4", "display_name": "GPT-5.4 __PERCH_CODEX_CATALOG__ edition", "priority": -10},
            {"slug": "gpt-5.6-sol", "display_name": "GPT-5.6 Sol", "priority": -30}
          ]
        }"#;
        let payload =
            format!("{REMOTE_CFG_MARKER}\nmodel = \"gpt-5.4\"\n{REMOTE_CATALOG_MARKER}\n{json}");
        let list = parse_remote_codex_payload(&payload);
        assert_eq!(ids(&list), vec!["gpt-5.6-sol", "gpt-5.4"]);
        assert_eq!(list[1].label, "GPT-5.4 __PERCH_CODEX_CATALOG__ edition");
        assert!(list[1].is_default);
    }
}
