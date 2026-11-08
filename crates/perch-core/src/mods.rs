//! Perch mods: user- or agent-written extensions that live as plain folders (DECISIONS
//! 2026-11-08, "Mods"). Pure file work, no database and no network, like `memory.rs`.
//!
//! A mod is `<root>/mods/<id>/perch-mod.toml` plus whatever files its commands and panels need.
//! The manifest declares `[[actions]]` and `[[events]]` (argv commands, run without a shell, that
//! call back through the `perch` CLI) and `[[panels]]` (an HTML page for a sandboxed iframe), plus
//! the capabilities it wants. This module only discovers, validates and approves; running
//! commands and serving panels are other seams, and both must refuse a mod that is not
//! [`Status::Active`].
//!
//! **Approval is its own policy** ([`Policy`]), separate from Project and sub-session permissions:
//! `ask` waits for a person, `auto-safe` approves a mod that only needs a panel, events and reading
//! project files, `auto-all` approves everything; `off` turns every mod off. Only a person sets the policy (the
//! caller passes it in; it never comes from a mod). Approval pins the manifest's hash, so a
//! changed manifest is re-evaluated against the policy. The state and audit files sit beside the
//! `mods/` folder, not inside a mod.
//!
//! ponytail: the hash covers the manifest only. The scripts it points at can change without a new
//! approval, as in herdr; capabilities are enforceable for panels and scoped core calls, not for
//! a process that runs as the user. Event names are not checked against a list until the event
//! seam exists.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

pub const MANIFEST: &str = "perch-mod.toml";
/// The events a mod can hook, fired from `server/attention.rs` when an agent session changes.
pub const EVENTS: [&str; 3] = ["session.needs-you", "session.done", "session.failed"];
const STATE: &str = "mod-state.json";
const AUDIT: &str = "mod-audit.jsonl";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_ID: usize = 64;
const HASH_CHARS: usize = 16;

// ponytail: one lock for the whole mods root; scans and approvals are tiny.
static LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug)]
pub enum Error {
    Invalid(String),
    NotFound(String),
    /// The manifest is not the one the caller looked at; look again.
    Conflict(String),
    Io(std::io::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(text) | Self::NotFound(text) | Self::Conflict(text) => f.write_str(text),
            Self::Io(error) => write!(f, "Perch could not use the mods folder: {error}"),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// What a mod may ask for. `Network` and `WriteProject` are declarations a process mod can only
/// be trusted to keep; `Panel` and core calls are enforced.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Capability {
    Panel,
    Events,
    ReadProject,
    WriteProject,
    Network,
    Build,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Build {
    pub command: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Action {
    pub id: String,
    pub title: String,
    pub command: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub on: String,
    pub command: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Panel {
    pub id: String,
    pub title: String,
    /// An `.html` file inside the mod's folder.
    pub entry: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    #[serde(default)]
    pub build: Vec<Build>,
    #[serde(default)]
    pub actions: Vec<Action>,
    #[serde(default)]
    pub events: Vec<Event>,
    #[serde(default)]
    pub panels: Vec<Panel>,
}

fn plain_id(id: &str, allow_dot: bool) -> bool {
    !id.is_empty()
        && id.len() <= MAX_ID
        && !id.starts_with('.')
        && id.chars().all(|c| {
            c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | ':') || (allow_dot && c == '.')
        })
}

fn check_command(what: &str, command: &[String]) -> Result<(), Error> {
    if command.first().is_none_or(|program| program.is_empty()) {
        return Err(Error::Invalid(format!(
            "{what} needs a command (an argv list, no shell)"
        )));
    }
    Ok(())
}

fn check_unique<'a>(what: &str, ids: impl Iterator<Item = &'a str>) -> Result<(), Error> {
    let mut seen = BTreeSet::new();
    for id in ids {
        if !plain_id(id, false) {
            return Err(Error::Invalid(format!(
                "{what} id \"{id}\" may use letters, digits, - _ : only"
            )));
        }
        if !seen.insert(id) {
            return Err(Error::Invalid(format!("{what} id \"{id}\" is used twice")));
        }
    }
    Ok(())
}

impl Manifest {
    pub fn parse(text: &str) -> Result<Self, Error> {
        let manifest: Self =
            toml::from_str(text).map_err(|e| Error::Invalid(format!("{MANIFEST}: {e}")))?;
        manifest.validate()?;
        Ok(manifest)
    }

    fn validate(&self) -> Result<(), Error> {
        if !plain_id(&self.id, true) {
            return Err(Error::Invalid(format!(
                "mod id \"{}\" may use letters, digits, . - _ : (up to {MAX_ID})",
                self.id
            )));
        }
        if self.name.trim().is_empty() || self.version.trim().is_empty() {
            return Err(Error::Invalid("a mod needs a name and a version".into()));
        }
        check_unique("action", self.actions.iter().map(|a| a.id.as_str()))?;
        check_unique("panel", self.panels.iter().map(|p| p.id.as_str()))?;
        for build in &self.build {
            check_command("a build step", &build.command)?;
        }
        for action in &self.actions {
            check_command(&format!("action \"{}\"", action.id), &action.command)?;
        }
        for event in &self.events {
            if !EVENTS.contains(&event.on.as_str()) {
                return Err(Error::Invalid(format!(
                    "unknown event \"{}\" (known: {})",
                    event.on,
                    EVENTS.join(", ")
                )));
            }
            check_command(&format!("event \"{}\"", event.on), &event.command)?;
        }
        for panel in &self.panels {
            let path = Path::new(&panel.entry);
            let inside = path.components().all(|c| matches!(c, Component::Normal(_)));
            if !inside || path.extension().is_none_or(|e| e != "html") {
                return Err(Error::Invalid(format!(
                    "panel \"{}\" entry must be a relative .html path inside the mod",
                    panel.id
                )));
            }
        }
        Ok(())
    }

    /// What approving this manifest lets run or show, one line each (commands as argv).
    pub fn preview(&self) -> Vec<String> {
        let argv = |command: &[String]| command.join(" ");
        let mut lines = Vec::new();
        lines.extend(
            self.build
                .iter()
                .map(|b| format!("build: {}", argv(&b.command))),
        );
        lines.extend(
            self.actions
                .iter()
                .map(|a| format!("action {}: {}", a.id, argv(&a.command))),
        );
        lines.extend(
            self.events
                .iter()
                .map(|e| format!("on {}: {}", e.on, argv(&e.command))),
        );
        lines.extend(
            self.panels
                .iter()
                .map(|p| format!("panel {}: {}", p.id, p.entry)),
        );
        lines
    }

    /// Declared capabilities plus those the manifest's own contents imply.
    pub fn required(&self) -> BTreeSet<Capability> {
        let mut set: BTreeSet<_> = self.capabilities.iter().copied().collect();
        if !self.panels.is_empty() {
            set.insert(Capability::Panel);
        }
        if !self.events.is_empty() {
            set.insert(Capability::Events);
        }
        if !self.build.is_empty() {
            set.insert(Capability::Build);
        }
        set
    }
}

/// What `auto-safe` will approve: a mod that only shows a panel, reacts to events and reads
/// project files. Anything else (build steps, network, writing project files) still asks.
const SAFE: [Capability; 3] = [
    Capability::Panel,
    Capability::Events,
    Capability::ReadProject,
];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Mode {
    /// A person approves every new or changed mod.
    #[default]
    Ask,
    /// A mod whose needs are all in [`SAFE`] is approved by policy; the rest ask.
    AutoSafe,
    /// Everything is approved by policy; each approval is still logged.
    AutoAll,
}

/// The mod approval policy. Set by a person only; it is an input here, never read from a mod.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Policy {
    pub mode: Mode,
    /// Mods off: the same as `PERCH_MODS=off`, from Settings.
    pub off: bool,
}

impl Policy {
    fn approves(&self, required: &BTreeSet<Capability>) -> bool {
        match self.mode {
            Mode::Ask => false,
            Mode::AutoSafe => required.iter().all(|c| SAFE.contains(c)),
            Mode::AutoAll => true,
        }
    }

    fn label(&self) -> &'static str {
        match self.mode {
            Mode::Ask => "policy:ask",
            Mode::AutoSafe => "policy:auto-safe",
            Mode::AutoAll => "policy:auto-all",
        }
    }

    /// Mods are off: by this policy or by `PERCH_MODS=off` in the core's environment.
    pub fn is_off(&self) -> bool {
        self.off || safe_mode()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum Status {
    Active,
    Disabled,
    /// Waiting for a person: nothing may run or be served.
    Pending {
        reason: String,
    },
    Invalid {
        error: String,
    },
}

/// An action or panel as a list shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Titled {
    pub id: String,
    pub title: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub actions: Vec<Titled>,
    pub panels: Vec<Titled>,
    /// Everything that would run or be shown, one line each, so approval is informed.
    pub preview: Vec<String>,
    /// Pins what was looked at; [`approve`] must name it.
    pub hash: String,
    pub required: Vec<Capability>,
    pub status: Status,
    /// `person` or `policy:<mode>`; absent until approved.
    pub approved_by: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Approved {
    hash: String,
    by: String,
    at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Record {
    enabled: bool,
    approved: Option<Approved>,
}

type State = BTreeMap<String, Record>;

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

fn private_dir(path: &Path) -> Result<(), Error> {
    std::fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(path)?;
    Ok(())
}

fn load_state(root: &Path) -> State {
    // A missing or unreadable state is "nothing approved": the safe reading.
    std::fs::read_to_string(root.join(STATE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_state(root: &Path, state: &State) -> Result<(), Error> {
    private_dir(root)?;
    let tmp = root.join(format!("{STATE}.tmp"));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&tmp)?;
    file.write_all(
        serde_json::to_string_pretty(state)
            .unwrap_or_default()
            .as_bytes(),
    )?;
    file.sync_all()?;
    std::fs::rename(tmp, root.join(STATE))?;
    Ok(())
}

fn audit(root: &Path, id: &str, hash: &str, action: &str, by: &str) -> Result<(), Error> {
    let line = serde_json::json!({ "at": now_millis(), "mod": id, "hash": hash, "action": action, "by": by });
    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .mode(0o600)
        .open(root.join(AUDIT))?;
    writeln!(file, "{line}")?;
    Ok(())
}

fn mods_dir(root: &Path) -> PathBuf {
    root.join("mods")
}

/// Reads one folder: its manifest, its hash.
fn read_mod(dir: &Path) -> Result<(Manifest, String), Error> {
    let path = dir.join(MANIFEST);
    let meta = std::fs::metadata(&path)
        .map_err(|_| Error::Invalid(format!("no {MANIFEST} in this folder")))?;
    if meta.len() > MAX_MANIFEST_BYTES {
        return Err(Error::Invalid(format!(
            "{MANIFEST} is larger than {MAX_MANIFEST_BYTES} bytes"
        )));
    }
    let bytes = std::fs::read(&path)?;
    let text = String::from_utf8(bytes.clone())
        .map_err(|_| Error::Invalid(format!("{MANIFEST} is not UTF-8")))?;
    let manifest = Manifest::parse(&text)?;
    let dir_name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if manifest.id != dir_name {
        return Err(Error::Invalid(format!(
            "the folder is \"{dir_name}\" but the manifest id is \"{}\"",
            manifest.id
        )));
    }
    let hash = format!("{:x}", Sha256::digest(&bytes))[..HASH_CHARS].to_string();
    Ok((manifest, hash))
}

fn status_of(record: &Record, hash: &str) -> Status {
    match &record.approved {
        Some(a) if a.hash == hash => {
            if record.enabled {
                Status::Active
            } else {
                Status::Disabled
            }
        }
        Some(_) => Status::Pending {
            reason: "the manifest changed since it was approved".into(),
        },
        None => Status::Pending {
            reason: "waiting for a person to approve it".into(),
        },
    }
}

/// Every mod folder with its status. A new or changed manifest is approved here only when `policy`
/// allows; otherwise it stays pending.
pub fn scan(root: &Path, policy: &Policy) -> Result<Vec<ModInfo>, Error> {
    scan_with(root, policy, policy.is_off())
}

/// The one gate before anything of a mod runs or is served: the mod, only if it is
/// [`Status::Active`] under `policy`.
pub fn active(root: &Path, policy: &Policy, id: &str) -> Result<ModInfo, Error> {
    let found = scan(root, policy)?;
    let Some(info) = found.into_iter().find(|info| info.id == id) else {
        return Err(Error::NotFound(format!("no mod \"{id}\"")));
    };
    match &info.status {
        Status::Active => Ok(info),
        Status::Disabled => Err(Error::Invalid(format!("mod \"{id}\" is turned off"))),
        Status::Pending { reason } => Err(Error::Invalid(format!(
            "mod \"{id}\" is not approved: {reason}"
        ))),
        Status::Invalid { error } => {
            Err(Error::Invalid(format!("mod \"{id}\" is invalid: {error}")))
        }
    }
}

/// Every Active mod with its manifest and folder, for the seams that run or serve them. The
/// manifest is read again and must still be the one that was approved.
pub fn active_all(root: &Path, policy: &Policy) -> Result<Vec<(Manifest, PathBuf)>, Error> {
    let mut out = Vec::new();
    for info in scan(root, policy)? {
        if info.status != Status::Active {
            continue;
        }
        let dir = mods_dir(root).join(&info.id);
        if let Ok((manifest, hash)) = read_mod(&dir) {
            if hash == info.hash {
                out.push((manifest, dir));
            }
        }
    }
    Ok(out)
}

/// [`active`] with the manifest and folder.
pub fn load_active(root: &Path, policy: &Policy, id: &str) -> Result<(Manifest, PathBuf), Error> {
    let info = active(root, policy, id)?;
    let dir = mods_dir(root).join(id);
    let (manifest, hash) = read_mod(&dir)?;
    if hash != info.hash {
        return Err(Error::Conflict(format!(
            "mod \"{id}\" changed while it was starting"
        )));
    }
    Ok((manifest, dir))
}

/// The header a panel is served with. `sandbox` gives it an opaque origin even if opened outside
/// an iframe; with no network, no frames, no forms and inline-only script and style, a panel can
/// only draw and talk to the page that embeds it.
pub const PANEL_CSP: &str =
    "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; \
    style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
const MAX_PANEL_BYTES: u64 = 2 * 1024 * 1024;

/// A panel's single HTML file, for an Active mod. The path is confined to the mod's folder after
/// symlinks resolve, and the file is size-capped.
pub fn panel_html(
    root: &Path,
    policy: &Policy,
    id: &str,
    panel: &str,
) -> Result<(String, BTreeSet<Capability>), Error> {
    let (manifest, dir) = load_active(root, policy, id)?;
    let entry = manifest
        .panels
        .iter()
        .find(|p| p.id == panel)
        .ok_or_else(|| Error::NotFound(format!("mod \"{id}\" has no panel \"{panel}\"")))?;
    let (base, file) = (dir.canonicalize()?, dir.join(&entry.entry).canonicalize()?);
    if !file.starts_with(&base) {
        return Err(Error::Invalid(format!(
            "panel \"{panel}\" points outside its mod"
        )));
    }
    if std::fs::metadata(&file)?.len() > MAX_PANEL_BYTES {
        return Err(Error::Invalid(format!(
            "panel \"{panel}\" is larger than {MAX_PANEL_BYTES} bytes"
        )));
    }
    let html = String::from_utf8(std::fs::read(&file)?)
        .map_err(|_| Error::Invalid(format!("panel \"{panel}\" is not UTF-8")))?;
    Ok((html, manifest.required()))
}

/// The folder a mod keeps its own files in (`PERCH_MOD_DATA`); outside the mod so updates keep it.
pub fn data_dir(root: &Path, id: &str) -> PathBuf {
    root.join("mod-data").join(id)
}

/// Safe mode: `PERCH_MODS=off` in the core's environment (or `off` in the policy). No mod is
/// found, approved, run or served, and nothing is written, so stock Perch starts even when no
/// agent or UI can turn mods off.
pub fn safe_mode() -> bool {
    std::env::var("PERCH_MODS").is_ok_and(|value| value.eq_ignore_ascii_case("off"))
}

fn scan_with(root: &Path, policy: &Policy, safe: bool) -> Result<Vec<ModInfo>, Error> {
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let dir = mods_dir(root);
    if safe || !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut state = load_state(root);
    let mut changed = false;
    let mut found = Vec::new();
    let mut names: Vec<_> = std::fs::read_dir(&dir)?
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect();
    names.sort();
    for name in names {
        match read_mod(&dir.join(&name)) {
            Err(error) => found.push(ModInfo {
                id: name,
                name: String::new(),
                version: String::new(),
                description: String::new(),
                actions: Vec::new(),
                panels: Vec::new(),
                preview: Vec::new(),
                hash: String::new(),
                required: Vec::new(),
                status: Status::Invalid {
                    error: error.to_string(),
                },
                approved_by: None,
            }),
            Ok((manifest, hash)) => {
                let required = manifest.required();
                let record = state.entry(manifest.id.clone()).or_insert(Record {
                    enabled: true,
                    approved: None,
                });
                if record.approved.as_ref().is_none_or(|a| a.hash != hash)
                    && policy.approves(&required)
                {
                    let by = policy.label();
                    record.approved = Some(Approved {
                        hash: hash.clone(),
                        by: by.into(),
                        at: now_millis(),
                    });
                    audit(root, &manifest.id, &hash, "approved", by)?;
                    changed = true;
                }
                found.push(ModInfo {
                    status: status_of(record, &hash),
                    approved_by: record.approved.as_ref().map(|a| a.by.clone()),
                    preview: manifest.preview(),
                    actions: manifest
                        .actions
                        .iter()
                        .map(|a| Titled {
                            id: a.id.clone(),
                            title: a.title.clone(),
                        })
                        .collect(),
                    panels: manifest
                        .panels
                        .iter()
                        .map(|p| Titled {
                            id: p.id.clone(),
                            title: p.title.clone(),
                        })
                        .collect(),
                    description: manifest.description,
                    id: manifest.id,
                    name: manifest.name,
                    version: manifest.version,
                    hash,
                    required: required.into_iter().collect(),
                });
            }
        }
    }
    if changed {
        save_state(root, &state)?;
    }
    Ok(found)
}

/// A person approves the manifest they looked at (`hash` from [`scan`]). Callers must make sure a
/// person asked: an agent session or a mod must never reach this.
pub fn approve(root: &Path, policy: &Policy, id: &str, hash: &str) -> Result<(), Error> {
    refuse_when_off(policy)?;
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if !plain_id(id, true) {
        return Err(Error::Invalid(format!("\"{id}\" is not a mod id")));
    }
    let (_, current) = read_mod(&mods_dir(root).join(id)).map_err(|e| match e {
        Error::Io(_) | Error::Invalid(_) => Error::NotFound(format!("no valid mod \"{id}\"")),
        other => other,
    })?;
    if current != hash {
        return Err(Error::Conflict(format!(
            "mod \"{id}\" changed since you looked at it; review it again"
        )));
    }
    let mut state = load_state(root);
    state
        .entry(id.into())
        .or_insert(Record {
            enabled: true,
            approved: None,
        })
        .approved = Some(Approved {
        hash: current.clone(),
        by: "person".into(),
        at: now_millis(),
    });
    save_state(root, &state)?;
    audit(root, id, &current, "approved", "person")
}

fn refuse_when_off(policy: &Policy) -> Result<(), Error> {
    if policy.is_off() {
        return Err(Error::Invalid(
            "Mods are turned off (Settings > Mods, or PERCH_MODS=off), so they cannot be changed. Turn them back on first."
                .into(),
        ));
    }
    Ok(())
}

/// Turns a mod off or on without touching its approval.
pub fn set_enabled(root: &Path, policy: &Policy, id: &str, enabled: bool) -> Result<(), Error> {
    refuse_when_off(policy)?;
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if !plain_id(id, true) || !mods_dir(root).join(id).is_dir() {
        return Err(Error::NotFound(format!("no mod \"{id}\"")));
    }
    let mut state = load_state(root);
    state
        .entry(id.into())
        .or_insert(Record {
            enabled,
            approved: None,
        })
        .enabled = enabled;
    save_state(root, &state)?;
    audit(
        root,
        id,
        "",
        if enabled { "enabled" } else { "disabled" },
        "person",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A private root per test, removed afterwards.
    struct Root(PathBuf);

    impl Root {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("perch-mods-{}", uuid::Uuid::new_v4())))
        }

        fn put(&self, id: &str, manifest: &str) {
            let dir = mods_dir(&self.0).join(id);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join(MANIFEST), manifest).unwrap();
        }

        fn one(&self, policy: &Policy) -> ModInfo {
            scan(&self.0, policy).unwrap().remove(0)
        }
    }

    impl Drop for Root {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    const PANEL: &str = r#"
id = "plan"
name = "Plan"
version = "0.1.0"
[[panels]]
id = "board"
title = "Plan"
entry = "index.html"
"#;

    const BUILD: &str = r#"
id = "heavy"
name = "Heavy"
version = "0.1.0"
[[build]]
command = ["npm", "ci"]
"#;

    fn invalid(text: &str) -> String {
        Manifest::parse(text).unwrap_err().to_string()
    }

    #[test]
    fn a_manifest_must_be_plain_and_inside_its_folder() {
        assert!(Manifest::parse(PANEL).is_ok());
        let head = "id = \"x\"\nname = \"X\"\nversion = \"1\"\n";
        for (bad, why) in [
            (
                "id = \"../x\"\nname = \"X\"\nversion = \"1\"\n".to_string(),
                "mod id",
            ),
            (
                format!("{head}[[actions]]\nid = \"a.b\"\ntitle = \"t\"\ncommand = [\"x\"]\n"),
                "letters",
            ),
            (
                format!("{head}[[actions]]\nid = \"a\"\ntitle = \"t\"\ncommand = []\n"),
                "needs a command",
            ),
            (
                format!("{head}[[panels]]\nid = \"p\"\ntitle = \"t\"\nentry = \"../x.html\"\n"),
                "relative .html",
            ),
            (
                format!("{head}[[panels]]\nid = \"p\"\ntitle = \"t\"\nentry = \"/etc/x.html\"\n"),
                "relative .html",
            ),
            (
                format!("{head}[[panels]]\nid = \"p\"\ntitle = \"t\"\nentry = \"x.js\"\n"),
                "relative .html",
            ),
            (format!("{head}capabilites = []\n"), "unknown field"),
            (
                format!("{head}[[events]]\non = \"session.dnoe\"\ncommand = [\"x\"]\n"),
                "unknown event",
            ),
        ] {
            let error = invalid(&bad);
            assert!(error.contains(why), "{why}: {error}");
        }
        let twice = format!("{head}[[panels]]\nid = \"p\"\ntitle = \"t\"\nentry = \"a.html\"\n[[panels]]\nid = \"p\"\ntitle = \"t\"\nentry = \"b.html\"\n");
        assert!(invalid(&twice).contains("used twice"));
    }

    #[test]
    fn what_a_manifest_contains_implies_its_capabilities() {
        let panel = Manifest::parse(PANEL).unwrap();
        assert_eq!(panel.required(), [Capability::Panel].into());
        let build = Manifest::parse(BUILD).unwrap();
        assert_eq!(build.required(), [Capability::Build].into());
    }

    #[test]
    fn ask_waits_for_a_person_and_a_changed_manifest_waits_again() {
        let root = Root::new();
        root.put("plan", PANEL);
        let ask = Policy::default();
        let info = root.one(&ask);
        assert!(matches!(info.status, Status::Pending { .. }));

        approve(&root.0, &ask, "plan", &info.hash).unwrap();
        let info = root.one(&ask);
        assert_eq!(info.status, Status::Active);
        assert_eq!(info.approved_by.as_deref(), Some("person"));

        root.put("plan", &PANEL.replace("0.1.0", "0.2.0"));
        let changed = root.one(&ask);
        assert!(matches!(changed.status, Status::Pending { .. }));
        // The hash the person looked at is stale now.
        assert!(matches!(
            approve(&root.0, &ask, "plan", &info.hash),
            Err(Error::Conflict(_))
        ));
        approve(&root.0, &ask, "plan", &changed.hash).unwrap();
        assert_eq!(root.one(&ask).status, Status::Active);
    }

    #[test]
    fn auto_safe_approves_only_the_safe_kinds() {
        let root = Root::new();
        root.put("plan", PANEL);
        root.put("heavy", BUILD);
        let within = Policy {
            mode: Mode::AutoSafe,
            ..Policy::default()
        };
        let mods = scan(&root.0, &within).unwrap();
        let by_id = |id: &str| mods.iter().find(|m| m.id == id).unwrap();
        assert_eq!(by_id("plan").status, Status::Active);
        assert_eq!(
            by_id("plan").approved_by.as_deref(),
            Some("policy:auto-safe")
        );
        assert!(matches!(by_id("heavy").status, Status::Pending { .. }));

        let all = Policy {
            mode: Mode::AutoAll,
            ..Policy::default()
        };
        let mods = scan(&root.0, &all).unwrap();
        assert!(mods.iter().all(|m| m.status == Status::Active));
        let log = std::fs::read_to_string(root.0.join(AUDIT)).unwrap();
        assert_eq!(log.lines().count(), 2, "{log}");
    }

    #[test]
    fn safe_mode_finds_and_writes_nothing() {
        let root = Root::new();
        root.put("plan", PANEL);
        let all = AUTO;
        assert!(scan_with(&root.0, &all, true).unwrap().is_empty());
        assert!(!root.0.join(STATE).exists() && !root.0.join(AUDIT).exists());
        assert_eq!(scan_with(&root.0, &all, false).unwrap().len(), 1);
    }

    #[test]
    fn disabling_keeps_the_approval_and_a_bad_folder_is_reported() {
        let root = Root::new();
        root.put("plan", PANEL);
        let within = Policy {
            mode: Mode::AutoSafe,
            ..Policy::default()
        };
        assert_eq!(root.one(&within).status, Status::Active);
        set_enabled(&root.0, &within, "plan", false).unwrap();
        assert_eq!(root.one(&within).status, Status::Disabled);
        set_enabled(&root.0, &within, "plan", true).unwrap();
        assert_eq!(root.one(&within).status, Status::Active);

        root.put("other", PANEL); // the folder name and the manifest id disagree
        let mods = scan(&root.0, &within).unwrap();
        let other = mods.iter().find(|m| m.id == "other").unwrap();
        assert!(
            matches!(&other.status, Status::Invalid { error } if error.contains("manifest id"))
        );
        assert!(matches!(
            set_enabled(&root.0, &within, "nope", true),
            Err(Error::NotFound(_))
        ));
    }

    // --- Regression: a bad mod must not break Perch or reach what it was not approved for. ---

    const AUTO: Policy = Policy {
        mode: Mode::AutoAll,
        off: false,
    };

    /// Group 1: whatever is in a mod folder, listing never fails and the good mods still load.
    #[test]
    fn broken_mod_folders_are_reported_and_never_break_the_rest() {
        let root = Root::new();
        root.put("good", &PANEL.replace("\"plan\"", "\"good\""));
        let bad = |id: &str, bytes: &[u8]| {
            let dir = mods_dir(&root.0).join(id);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join(MANIFEST), bytes).unwrap();
        };
        bad("garbage", b"this is {{ not toml");
        bad("binary", &[0xff, 0xfe, 0x00, 0x80]);
        bad("huge", &vec![b'#'; MAX_MANIFEST_BYTES as usize + 1]);
        bad("empty", b"");
        std::fs::create_dir_all(mods_dir(&root.0).join("nomanifest")).unwrap();
        // A symlinked manifest (to a file that is not a manifest) and a symlinked folder.
        let link = mods_dir(&root.0).join("linked");
        std::fs::create_dir_all(&link).unwrap();
        std::os::unix::fs::symlink("/etc/hosts", link.join(MANIFEST)).unwrap();
        std::os::unix::fs::symlink(
            mods_dir(&root.0).join("good"),
            mods_dir(&root.0).join("alias"),
        )
        .unwrap();

        let mods = scan(&root.0, &AUTO).unwrap();
        let state = |id: &str| mods.iter().find(|m| m.id == id).map(|m| m.status.clone());
        assert_eq!(state("good"), Some(Status::Active));
        for id in ["garbage", "binary", "huge", "empty", "nomanifest", "linked"] {
            assert!(
                matches!(state(id), Some(Status::Invalid { .. })),
                "{id}: {:?}",
                state(id)
            );
        }
        assert_eq!(state("alias"), None, "a symlinked folder is not followed");
    }

    /// Group 2: only an approved, enabled mod with an unchanged manifest ever reads as Active.
    #[test]
    fn nothing_but_an_approved_enabled_unchanged_mod_is_active() {
        let root = Root::new();
        root.put("plan", PANEL);
        let ask = Policy::default();
        let active = |policy: &Policy| active(&root.0, policy, "plan");
        assert!(active(&ask).is_err(), "new and unapproved");
        let hash = root.one(&ask).hash;
        approve(&root.0, &ask, "plan", &hash).unwrap();
        assert!(active(&ask).is_ok());
        set_enabled(&root.0, &ask, "plan", false).unwrap();
        assert!(active(&ask).is_err(), "disabled");
        set_enabled(&root.0, &ask, "plan", true).unwrap();
        root.put("plan", &PANEL.replace("Plan\"\nentry", "Evil\"\nentry"));
        assert!(active(&ask).is_err(), "manifest changed after approval");
        assert!(
            active(&Policy {
                off: true,
                ..ask.clone()
            })
            .is_err(),
            "mods off"
        );
        assert!(active(&ask).is_err());
        std::fs::write(mods_dir(&root.0).join("plan").join(MANIFEST), "x = [").unwrap();
        assert!(active(&ask).is_err(), "now invalid");
        // A state file that is damaged means nothing is approved, not everything.
        std::fs::write(root.0.join(STATE), "{ not json").unwrap();
        root.put("plan", PANEL);
        assert!(active(&ask).is_err());
    }

    /// Panels: served only for an Active mod, from inside its folder, with the locked-down header.
    #[test]
    fn a_panel_is_served_only_from_an_active_mod_and_only_from_its_own_folder() {
        let root = Root::new();
        root.put("plan", PANEL);
        let dir = mods_dir(&root.0).join("plan");
        std::fs::write(dir.join("index.html"), "<p>hi</p>").unwrap();
        let ask = Policy::default();
        assert!(
            panel_html(&root.0, &ask, "plan", "board").is_err(),
            "not approved yet"
        );
        let hash = root.one(&ask).hash;
        approve(&root.0, &ask, "plan", &hash).unwrap();
        let (html, needs) = panel_html(&root.0, &ask, "plan", "board").unwrap();
        assert_eq!(html, "<p>hi</p>");
        assert_eq!(needs, [Capability::Panel].into());
        assert!(matches!(
            panel_html(&root.0, &ask, "plan", "nope"),
            Err(Error::NotFound(_))
        ));
        // A symlink that leads out of the folder is refused, and so is an oversized file.
        std::fs::remove_file(dir.join("index.html")).unwrap();
        std::fs::write(root.0.join("secret.html"), "secret").unwrap();
        std::os::unix::fs::symlink(root.0.join("secret.html"), dir.join("index.html")).unwrap();
        let escaped = panel_html(&root.0, &ask, "plan", "board")
            .unwrap_err()
            .to_string();
        assert!(escaped.contains("outside"), "{escaped}");
        std::fs::remove_file(dir.join("index.html")).unwrap();
        std::fs::write(
            dir.join("index.html"),
            vec![b'x'; MAX_PANEL_BYTES as usize + 1],
        )
        .unwrap();
        assert!(panel_html(&root.0, &ask, "plan", "board").is_err());
        // The header shuts the network and frames; nothing in it opens a door.
        for needle in [
            "sandbox allow-scripts",
            "default-src 'none'",
            "form-action 'none'",
        ] {
            assert!(PANEL_CSP.contains(needle), "{needle}");
        }
        assert!(!PANEL_CSP.contains("connect-src") && !PANEL_CSP.contains("allow-same-origin"));
    }

    /// Group 3: a mod cannot approve itself. Approval lives beside the mods folder, never in a
    /// mod, and nothing a mod puts in its own folder counts; turning mods off blocks changes.
    #[test]
    fn a_mod_cannot_approve_itself_and_off_blocks_changes() {
        let root = Root::new();
        root.put("plan", PANEL);
        let ask = Policy::default();
        let hash = root.one(&ask).hash;
        let forged = format!(
            r#"{{"plan":{{"enabled":true,"approved":{{"hash":"{hash}","by":"person","at":1}}}}}}"#
        );
        std::fs::write(mods_dir(&root.0).join("plan").join(STATE), &forged).unwrap();
        std::fs::write(mods_dir(&root.0).join("plan").join(AUDIT), "").unwrap();
        assert!(matches!(root.one(&ask).status, Status::Pending { .. }));
        // Ask never approves by policy, however many times it is scanned.
        for _ in 0..3 {
            assert!(matches!(root.one(&ask).status, Status::Pending { .. }));
        }
        assert!(!root.0.join(AUDIT).exists());
        // A short or wrong hash is not an approval.
        assert!(approve(&root.0, &ask, "plan", &hash[..6]).is_err());
        assert!(approve(&root.0, &ask, "../plan", &hash).is_err());
        // Mods off: no change goes through, and nothing is listed.
        let off = Policy { off: true, ..AUTO };
        assert!(approve(&root.0, &off, "plan", &hash).is_err());
        assert!(set_enabled(&root.0, &off, "plan", false).is_err());
        assert!(scan(&root.0, &off).unwrap().is_empty());
        assert!(!root.0.join(STATE).exists());
    }
}
