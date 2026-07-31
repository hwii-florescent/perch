//! SSH host configuration store for perch.
//!
//! Reads/writes `~/.perch/hosts.json` atomically (write to temp → rename).
//!
//! JSON shape on disk (camelCase to match the TypeScript client):
//! ```json
//! {
//!   "hosts": [
//!     {
//!       "id": "uuid",
//!       "name": "my-devpod",
//!       "sshHost": "my-devpod.internal.example.com",
//!       "remotePort": 7788,
//!       "enabled": true
//!     }
//!   ]
//! }
//! ```

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

fn default_remote_port() -> u16 {
    7788
}

fn default_enabled() -> bool {
    true
}

fn default_mode() -> String {
    "perch".to_string()
}

/// How perch talks to a host.
///
/// * `"perch"` (default, and what every pre-existing `hosts.json` entry
///   deserializes to) — full federation: ssh tunnel to a *perch install* on
///   the remote, which owns its own sessions and DB. See `hub.rs`.
/// * `"direct"` — the remote has **no perch**, only `claude`/`codex` + `tmux`.
///   perch drives the CLIs itself over ssh, running each hosted turn detached
///   so it survives the laptop closing *and* perch quitting. Sessions live in
///   the *local* DB tagged with this host's id. See `detached.rs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostMode {
    Perch,
    Direct,
}

impl SshHost {
    pub fn mode_kind(&self) -> HostMode {
        match self.mode.as_str() {
            "direct" => HostMode::Direct,
            _ => HostMode::Perch,
        }
    }

    pub fn is_direct(&self) -> bool {
        self.mode_kind() == HostMode::Direct
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SshHost {
    pub id: String,
    pub name: String,
    pub ssh_host: String,
    #[serde(default = "default_remote_port")]
    pub remote_port: u16,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// `"perch"` (default) or `"direct"` — see [`HostMode`]. A plain `String`
    /// rather than an enum so an unknown value written by a newer perch
    /// degrades to `"perch"` instead of failing the whole file's parse (the
    /// store's error path drops *every* host on a parse error).
    #[serde(default = "default_mode")]
    pub mode: String,
    /// Skip SSH tunnel; connect directly to this WS URL (e.g. `ws://127.0.0.1:7800/ws`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direct_url: Option<String>,
    /// Command used to auto-start the remote perch binary when not already running.
    /// The literal `{port}` is replaced with the remote port.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_cmd: Option<String>,
}

impl Default for SshHost {
    fn default() -> Self {
        SshHost {
            id: String::new(),
            name: String::new(),
            ssh_host: String::new(),
            remote_port: default_remote_port(),
            enabled: default_enabled(),
            mode: default_mode(),
            direct_url: None,
            remote_cmd: None,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct HostsConfig {
    pub hosts: Vec<SshHost>,
}

// ---------------------------------------------------------------------------
// HostsStore
// ---------------------------------------------------------------------------

pub struct HostsStore {
    path: PathBuf,
    inner: Mutex<HostsConfig>,
}

impl HostsStore {
    /// Open (or create) the hosts file at `path`.
    /// A missing or invalid file silently yields an empty config.
    pub fn load(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let inner = Self::read_from_disk(&path).unwrap_or_default();
        HostsStore {
            path,
            inner: Mutex::new(inner),
        }
    }

    /// Open using the canonical `~/.perch/hosts.json` path.
    pub fn load_default() -> Self {
        let path = default_hosts_path()
            .unwrap_or_else(|| PathBuf::from(".perch/hosts.json"));
        Self::load(path)
    }

    fn read_from_disk(path: &Path) -> Option<HostsConfig> {
        let text = std::fs::read_to_string(path).ok()?;
        match serde_json::from_str::<HostsConfig>(&text) {
            Ok(c) => Some(c),
            Err(e) => {
                tracing::warn!("~/.perch/hosts.json parse error (using empty): {e}");
                None
            }
        }
    }

    /// Return the current list of hosts.
    pub fn list(&self) -> Vec<SshHost> {
        self.inner.lock().unwrap().hosts.clone()
    }

    /// Look up a single host by id. Used by the direct-mode (`detached.rs`)
    /// paths in `server.rs`, which need the host's `sshHost` and `mode` to
    /// decide whether a session is driven over ssh rather than through the
    /// hub's WS connection.
    pub fn get(&self, id: &str) -> Option<SshHost> {
        self.inner.lock().unwrap().hosts.iter().find(|h| h.id == id).cloned()
    }

    /// Insert or update a host by id (upsert).
    /// If a host with the same id exists, it is replaced in place.
    /// Otherwise the host is appended.
    pub fn upsert(&self, host: SshHost) -> anyhow::Result<Vec<SshHost>> {
        let mut guard = self.inner.lock().unwrap();
        let existing_pos = guard.hosts.iter().position(|h| h.id == host.id);
        match existing_pos {
            Some(idx) => guard.hosts[idx] = host,
            None => guard.hosts.push(host),
        }
        let snapshot = guard.hosts.clone();
        drop(guard);
        self.write_to_disk_hosts(&snapshot)?;
        Ok(snapshot)
    }

    /// Remove a host by id. No-op if not found.
    pub fn delete(&self, id: &str) -> anyhow::Result<Vec<SshHost>> {
        let mut guard = self.inner.lock().unwrap();
        guard.hosts.retain(|h| h.id != id);
        let snapshot = guard.hosts.clone();
        drop(guard);
        self.write_to_disk_hosts(&snapshot)?;
        Ok(snapshot)
    }

    fn write_to_disk_hosts(&self, hosts: &[SshHost]) -> anyhow::Result<()> {
        let config = HostsConfig { hosts: hosts.to_vec() };
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp_path = self.path.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(&config)?;
        std::fs::write(&tmp_path, json)?;
        std::fs::rename(&tmp_path, &self.path)?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve `~/.perch/hosts.json` without the `dirs` crate.
pub fn default_hosts_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".perch").join("hosts.json"))
}
