//! The slash commands each CLI's own `/` menu offers, for the UI-mode composer.
//!
//! No CLI exposes its built-in command list to an outside process: Claude's headless `init` list
//! omits the terminal-only ones (`/resume`, `/rewind`, `/help`, `/login`, ...), Codex has no list at
//! all, and Pi/OMP's `getCommands()` returns only what extensions, prompt templates and skills added.
//! So the built-ins are data (`slash_commands.json`) captured from each installed CLI's real `/`
//! menu (Pi from its exported `BUILTIN_SLASH_COMMANDS`), and everything session-specific (skills,
//! plugin and project commands, extensions) is read live and merged in by [`with_builtins`].
//!
//! The data names the CLI version it was captured from. A newer CLI may offer commands that are
//! missing here; typing one still works, it just is not suggested. Regenerate with
//! `e2e/capture-slash-menu.sh` when bumping a CLI.

use crate::protocol::CommandEntry;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

#[derive(Deserialize)]
struct Captured {
    commands: Vec<CommandEntry>,
}

fn captured() -> &'static HashMap<String, Captured> {
    static DATA: OnceLock<HashMap<String, Captured>> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("slash_commands.json"))
            .expect("slash_commands.json is valid")
    })
}

/// The built-in commands of `agent`, tagged `builtin`; empty for a CLI with no capture.
pub fn builtins(agent: &str) -> Vec<CommandEntry> {
    captured().get(agent).map_or_else(Vec::new, |agent| {
        agent
            .commands
            .iter()
            .cloned()
            .map(|entry| CommandEntry {
                kind: Some("builtin".into()),
                ..entry
            })
            .collect()
    })
}

/// Built-ins first, then what the running CLI reported. A reported entry that repeats a built-in's
/// name is dropped (the built-in is what `/name` runs); one with no description of its own keeps
/// nothing, so the picker never shows a blank where the CLI had no prose.
pub fn with_builtins(agent: &str, live: Vec<CommandEntry>) -> Vec<CommandEntry> {
    let mut merged = builtins(agent);
    let mut seen: HashSet<String> = merged.iter().map(|entry| entry.name.clone()).collect();
    for entry in live {
        if seen.insert(entry.name.clone()) {
            merged.push(entry);
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, kind: &str) -> CommandEntry {
        CommandEntry {
            name: name.into(),
            description: None,
            argument_hint: None,
            kind: Some(kind.into()),
        }
    }

    #[test]
    fn every_supported_cli_has_a_capture_with_names_and_no_duplicates() {
        for agent in ["claude", "codex", "pi", "omp"] {
            let list = builtins(agent);
            assert!(list.len() > 20, "{agent} capture looks empty");
            let names: HashSet<_> = list.iter().map(|entry| entry.name.as_str()).collect();
            assert_eq!(names.len(), list.len(), "{agent} has duplicate names");
            assert!(
                list.iter().all(|entry| !entry.name.is_empty()
                    && !entry.name.contains(char::is_whitespace)
                    && !entry.name.starts_with('/')),
                "{agent} has a malformed name"
            );
            assert!(list
                .iter()
                .all(|entry| entry.kind.as_deref() == Some("builtin")));
        }
    }

    #[test]
    fn the_terminal_only_commands_the_headless_list_omits_are_present() {
        let claude = builtins("claude");
        for name in ["resume", "rewind", "help", "login", "status", "export"] {
            assert!(
                claude.iter().any(|entry| entry.name == name),
                "claude /{name}"
            );
        }
        assert!(builtins("codex")
            .iter()
            .any(|entry| entry.name == "compact"));
        assert!(builtins("pi").iter().any(|entry| entry.name == "compact"));
        assert!(builtins("omp").iter().any(|entry| entry.name == "compact"));
    }

    #[test]
    fn live_entries_follow_the_builtins_and_never_shadow_them() {
        let merged = with_builtins(
            "pi",
            vec![
                entry("compact", "extension"),
                entry("lens-map", "extension"),
            ],
        );
        let compact: Vec<_> = merged
            .iter()
            .filter(|entry| entry.name == "compact")
            .collect();
        assert_eq!(compact.len(), 1);
        assert_eq!(compact[0].kind.as_deref(), Some("builtin"));
        assert_eq!(merged.last().unwrap().name, "lens-map");
    }

    #[test]
    fn an_unknown_cli_keeps_only_what_it_reported() {
        assert_eq!(with_builtins("other", vec![entry("x", "skill")]).len(), 1);
    }
}
