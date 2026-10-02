//! CLI launch metadata adapted from Orca's MIT-licensed catalog.
//! See THIRD_PARTY_NOTICES.md for the pinned source and license.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use serde::Deserialize;

use crate::agent_fleet::{
    self, AgentMode, EnvironmentPolicy, LaunchSpec, PromptTransport, ProviderCapability,
    ProviderManifest, RegistryError, Resumability, ResumePlacement, StatusDetection,
};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CatalogEntry {
    pub id: String,
    pub display_name: String,
    pub executable: String,
    pub aliases: Vec<String>,
    pub prefix_args: Vec<String>,
    pub default_args: Vec<String>,
    pub environment: BTreeMap<String, String>,
    pub homepage_url: String,
    pub resume_flag: Option<String>,
}

static CATALOG: OnceLock<Result<Vec<CatalogEntry>, serde_json::Error>> = OnceLock::new();

pub fn entries() -> Result<&'static [CatalogEntry], RegistryError> {
    match CATALOG.get_or_init(|| serde_json::from_str(include_str!("agent_catalog.json"))) {
        Ok(entries) => Ok(entries),
        Err(error) => Err(RegistryError::Catalog(error.to_string())),
    }
}

pub fn lookup(id: &str) -> Option<&'static CatalogEntry> {
    entries().ok()?.iter().find(|entry| entry.id == id)
}

impl CatalogEntry {
    pub fn manifest(&self) -> ProviderManifest {
        let mut manifest = match self.id.as_str() {
            "claude" => ProviderManifest::claude(),
            "codex" => ProviderManifest::codex(),
            _ => ProviderManifest {
                id: self.id.clone(),
                display_name: self.display_name.clone(),
                launch: LaunchSpec {
                    executable: self.executable.clone(),
                    prefix_args: Vec::new(),
                    prompt: PromptTransport::Stdin,
                    suffix_args: Vec::new(),
                    resume_prefix_args: Vec::new(),
                    resume: self
                        .resume_flag
                        .as_ref()
                        .map_or(ResumePlacement::Unsupported, |flag| ResumePlacement::Flag {
                            flag: flag.clone(),
                        }),
                    mode_overrides: BTreeMap::new(),
                },
                supported_modes: [AgentMode::Cli].into_iter().collect(),
                resumability: if self.resume_flag.is_some() {
                    Resumability::ProviderSession
                } else {
                    Resumability::PersistentProcess
                },
                capabilities: [ProviderCapability::InteractiveTerminal]
                    .into_iter()
                    .collect(),
                status_detection: StatusDetection::ExitStatus,
                environment: EnvironmentPolicy::default(),
            },
        };
        if let Some(cli) = manifest.launch.mode_overrides.get_mut(&AgentMode::Cli) {
            cli.executable = self.executable.clone();
            cli.prefix_args = self.prefix_args.clone();
            cli.suffix_args = self.default_args.clone();
        } else {
            manifest.launch.prefix_args = self.prefix_args.clone();
            manifest.launch.suffix_args = self.default_args.clone();
        }
        if self.resume_flag.is_some() {
            manifest.capabilities.insert(ProviderCapability::Resume);
        }
        manifest.environment.set.extend(self.environment.clone());
        manifest
    }
}

/// Detection and process launch use the same resolver. Aliases only apply to
/// the catalog's default executable; an explicit override stays explicit.
pub fn resolve_executable(provider_id: &str, executable: &str) -> Result<PathBuf, String> {
    let mut candidates = vec![executable];
    if let Some(entry) = lookup(provider_id).filter(|entry| entry.executable == executable) {
        candidates.extend(entry.aliases.iter().map(String::as_str));
    }
    for candidate in &candidates {
        if let Ok(path) = agent_fleet::resolve_executable(candidate, None) {
            if !is_namesake(provider_id, &path) {
                return Ok(path);
            }
        }
    }
    // Finder and headless shells may have a smaller PATH than a login shell.
    // Probe a fixed set of normal install locations, never scan directories.
    let mut directories = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        for suffix in [
            ".local/bin",
            ".opencode/bin",
            ".cargo/bin",
            ".bun/bin",
            ".npm-global/bin",
            ".npm/bin",
        ] {
            directories.push(PathBuf::from(&home).join(suffix));
        }
    }
    directories.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ]);
    for candidate in candidates
        .into_iter()
        .filter(|candidate| !candidate.contains('/'))
    {
        for directory in &directories {
            let path = directory.join(candidate);
            if let Ok(resolved) = agent_fleet::resolve_executable(&path.to_string_lossy(), None) {
                if !is_namesake(provider_id, &resolved) {
                    return Ok(resolved);
                }
            }
        }
    }
    Err(format!(
        "executable `{executable}` was not found on PATH or in standard install locations"
    ))
}

/// A different tool installed under an agent's executable name. Homebrew's
/// `goose` formula is pressly's DB-migration CLI (Block's agent is
/// `block-goose-cli`), so a bare PATH hit would list Goose as installed.
fn is_namesake(provider_id: &str, path: &Path) -> bool {
    let Some(marker) = namesake_version_marker(provider_id) else {
        return false;
    };
    // ponytail: cached per path for the process lifetime; reinstalling a
    // different tool at the same path needs a restart to be re-probed.
    static SEEN: OnceLock<Mutex<HashMap<PathBuf, bool>>> = OnceLock::new();
    let seen = SEEN.get_or_init(Default::default);
    if let Some(&known) = seen.lock().unwrap().get(path) {
        return known;
    }
    let namesake = std::process::Command::new(path)
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .output()
        .is_ok_and(|output| String::from_utf8_lossy(&output.stdout).starts_with(marker));
    seen.lock().unwrap().insert(path.to_path_buf(), namesake);
    namesake
}

/// `--version` output prefix of the namesake, never of the agent itself.
fn namesake_version_marker(provider_id: &str) -> Option<&'static str> {
    match provider_id {
        "goose" => Some("goose version:"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn upstream_catalog_is_complete_unique_and_valid() {
        let entries = entries().unwrap();
        assert_eq!(entries.len(), 36);
        let mut ids = BTreeSet::new();
        for entry in entries {
            assert!(ids.insert(&entry.id));
            entry.manifest().validate().unwrap();
            assert!(entry.homepage_url.starts_with("https://"));
        }
        let teams = lookup("claude-agent-teams").unwrap().manifest();
        assert_eq!(teams.launch.executable, "claude");
        assert_eq!(teams.launch.prefix_args, ["--teammate-mode", "in-process"]);
        assert_eq!(
            teams.environment.set["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"],
            "1"
        );
    }

    #[cfg(unix)]
    #[test]
    fn pressly_goose_is_not_the_goose_agent() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("perch-namesake-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let fake = |name: &str, version: &str| {
            let path = dir.join(name);
            std::fs::write(&path, format!("#!/bin/sh\necho '{version}'\n")).unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            path
        };
        assert!(is_namesake(
            "goose",
            &fake("migrate", "goose version: v3.27.1")
        ));
        assert!(!is_namesake("goose", &fake("agent", "goose 1.9.0")));
        assert!(!is_namesake("claude", &fake("claude", "goose version: v3")));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
