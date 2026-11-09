//! Mods, as in herdr's desktop app: a folder `<root>/mods/<id>/` with a `main.js` that Perch's own
//! page imports and runs with the person's full access. There is no approval and no sandbox: a mod
//! is trusted code, like a shell script you wrote, and an edit applies at once (the web reloads it
//! when [`ModInfo::revision`] changes). `mod.json` is optional: `{"name", "description", "place":
//! "dock"|"overlay"|"none", "entry": "main.js"}`.
//!
//! What stays safe is stock Perch: a mod that fails to load never replaces a working one, a mod can
//! be turned off from Settings or `perch mod disable`, and `PERCH_MODS=off` (or the Settings
//! switch) loads none, so Perch starts even when a mod breaks the page. State is `mod-state.json`
//! beside `mods/`. Only [`source`] and [`package_file`] serve a mod's code.
//!
//! A package (`"format": "esm"` in `mod.json`, with an optional `"api"` range) is a folder of ES
//! modules, CSS and assets the page loads as one graph. Its revision is the SHA-256 of every
//! supported file (sorted relative path, length, bytes); [`scan`] keeps the last
//! [`RETAINED_SNAPSHOTS`] revisions' bytes in memory, so every read of one revision is that
//! revision's bytes (never the disk now), and rehashes only when a file's metadata stamp moves.
//! A legacy client that does not accept `esm` is never shown a package (`server::mods`).
//!
//! Stock screens ship as packages too, in the web app's own build (`stock-ui/` beside
//! `index.html`, written by `packages/web/scripts/export-stock-ui.mjs`). [`stock`] lists them as
//! `stock:<id>`, a namespace no mod can take ([`plain_id`] refuses `:`), even while mods are off:
//! they are Perch as shipped, and the page loads them from its own origin, never through
//! `mods/package` or the mods folder. The core reads them only to list and to clone
//! ([`clone_stock`]); a core with no web build (headless, remote) has none.
//!
//! Installing is one step whatever the source ([`install_from`]): a folder, or a git URL cloned to
//! a temporary folder first, is copied and each copied mod's `mod.json` gets `installedFrom` (kind,
//! location, git commit and the SHA-256 of the files as installed). A manifest may name its own
//! stable `id` and `publisher`; nothing assumes the package came from a local folder, so a registry
//! is one more source kind in front of the same step.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, VecDeque};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};

const MAX_BYTES: u64 = 2 * 1024 * 1024;
const STATE: &str = "mod-state.json";

#[derive(Debug)]
pub enum Error {
    Invalid(String),
    NotFound(String),
    /// Mods are off, or this mod is.
    Off(String),
    /// A package revision that is no longer kept: list the mods again.
    Gone(String),
    Io(std::io::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(text) | Self::NotFound(text) | Self::Off(text) | Self::Gone(text) => {
                f.write_str(text)
            }
            Self::Io(error) => write!(f, "Perch could not use the mods folder: {error}"),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// The one setting: all mods off. (Older settings files may still hold a `mode`; it is ignored.)
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Policy {
    pub off: bool,
}

impl Policy {
    pub fn is_off(&self) -> bool {
        self.off || safe_mode()
    }
}

/// `PERCH_MODS=off` in the core's environment: stock Perch even when no UI can reach Settings.
pub fn safe_mode() -> bool {
    std::env::var("PERCH_MODS").is_ok_and(|value| value.eq_ignore_ascii_case("off"))
}

/// Where a mod's page shows: docked as a pane, over the app, or nowhere (it only runs).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Place {
    #[default]
    Dock,
    Overlay,
    None,
    /// Only where a layout block or Perch itself puts it: never docked, overlaid or run hidden on
    /// its own (stock screens and their clones).
    Layout,
}

#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Manifest {
    name: String,
    description: String,
    place: Place,
    entry: Option<String>,
    format: Option<String>,
    api: Option<String>,
    origin: Option<String>,
    version: Option<String>,
    cloned_from: Option<ClonedFrom>,
    /// The package's own stable id as published; `install` names the folder after it.
    id: Option<String>,
    publisher: Option<String>,
    installed_from: Option<InstalledFrom>,
}

/// Where `perch mod install` took a mod from, written into its `mod.json` as `installedFrom`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledFrom {
    /// `folder` or `git` (a registry would be another kind).
    pub kind: String,
    /// The folder or the git URL as given (git URLs are public https, so they hold no credentials).
    pub location: String,
    /// The git commit installed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
    /// `sha256:<hex>` of the mod's files as installed, before this record was written: every file
    /// by sorted relative path, each path and its bytes preceded by their length (u64, little
    /// endian), the same scheme as a package revision.
    #[serde(default)]
    pub digest: String,
}

/// The one package format: ES modules the page imports through `mods/package`.
pub const PACKAGE_FORMAT: &str = "esm";

/// The mod a clone was copied from, and that mod's revision at the time.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClonedFrom {
    pub id: String,
    pub revision: String,
    /// The source's `mod.json` `version`, when it had one (a stock screen always does).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub place: Place,
    pub enabled: bool,
    /// Changes whenever the mod's files do, so an open mod reloads when it is edited.
    pub revision: String,
    /// Why the folder cannot be loaded, if it cannot.
    pub error: Option<String>,
    /// Font files in the mod's `fonts/` folder (`.ttf`, `.otf`, `.woff`, `.woff2`): the page loads each
    /// under its file name without the extension, so a layout can name it in `font`.
    #[serde(default)]
    pub fonts: Vec<String>,
    /// `esm` for a package; absent for a single-file mod.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    /// The host API range a package was written for (`mod.json` `api`), as written.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,
    /// A package's entry module (default `main.js`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entry: Option<String>,
    /// Every file of a package's current revision, sorted: the only paths `mods/package` serves.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,
    /// Where this copy came from (`clone` for `perch mod clone`, `stock` for a shipped screen), as
    /// recorded in `mod.json`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    /// The package's own version (`mod.json` `version`), as written.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cloned_from: Option<ClonedFrom>,
    /// Who published the package (`mod.json` `publisher`), as written.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    /// Where `perch mod install` took it from, and the digest of what it copied.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_from: Option<InstalledFrom>,
}

fn mods_dir(root: &Path) -> PathBuf {
    root.join("mods")
}

pub(crate) fn plain_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn disabled(root: &Path) -> Vec<String> {
    #[derive(Deserialize, Default)]
    #[serde(default)]
    struct State {
        disabled: Vec<String>,
    }
    std::fs::read_to_string(root.join(STATE))
        .ok()
        .and_then(|text| serde_json::from_str::<State>(&text).ok())
        .map(|state| state.disabled)
        .unwrap_or_default()
}

/// The entry file of a mod, relative and inside its folder.
fn entry_of(manifest: &Manifest) -> Result<&str, Error> {
    let entry = manifest.entry.as_deref().unwrap_or("main.js");
    let path = Path::new(entry);
    if path.components().all(|c| matches!(c, Component::Normal(_)))
        && path.extension().is_some_and(|e| e == "js" || e == "mjs")
    {
        Ok(entry)
    } else {
        Err(Error::Invalid(
            "entry must be a relative .js or .mjs path inside the mod".into(),
        ))
    }
}

fn read_manifest(dir: &Path) -> Result<Manifest, Error> {
    let manifest: Manifest = match std::fs::read_to_string(dir.join("mod.json")) {
        Ok(text) => serde_json::from_str(&text)
            .map_err(|error| Error::Invalid(format!("mod.json is not valid: {error}")))?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Manifest::default(),
        Err(error) => return Err(error.into()),
    };
    if manifest
        .format
        .as_deref()
        .is_some_and(|f| f != PACKAGE_FORMAT)
    {
        return Err(Error::Invalid(format!(
            "mod.json format is \"{PACKAGE_FORMAT}\" or absent"
        )));
    }
    let short = |text: &Option<String>, max: usize| {
        text.as_ref()
            .is_none_or(|t| t.len() <= max && !t.chars().any(char::is_control))
    };
    if !short(&manifest.api, 64)
        || !short(&manifest.origin, 300)
        || !short(&manifest.version, 64)
        || !short(&manifest.publisher, 120)
    {
        return Err(Error::Invalid(
            "mod.json api, origin, version or publisher is too long or holds control characters"
                .into(),
        ));
    }
    if manifest.id.as_deref().is_some_and(|id| !plain_id(id)) {
        return Err(Error::Invalid(
            "mod.json id is a plain id: letters, digits, - and _".into(),
        ));
    }
    Ok(manifest)
}

/// Files a package may hold and serve, by extension (case-sensitive), with their content type.
/// Nothing that a browser would open as a document: no HTML.
const PACKAGE_KINDS: [(&str, &str); 10] = [
    ("js", "text/javascript; charset=utf-8"),
    ("mjs", "text/javascript; charset=utf-8"),
    ("css", "text/css; charset=utf-8"),
    ("json", "application/json"),
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("webp", "image/webp"),
    ("woff2", "font/woff2"),
    ("woff", "font/woff"),
];
const MAX_PACKAGE_FILES: usize = 2000;
const MAX_PACKAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_PACKAGE_DEPTH: usize = 16;
/// Revisions of one package kept in memory, so a page still loading one finishes on its bytes.
pub const RETAINED_SNAPSHOTS: usize = 4;

/// One revision of a package: its files' bytes, by relative path.
pub struct Snapshot {
    pub revision: String,
    files: BTreeMap<String, Arc<[u8]>>,
}

/// The retained revisions of one package (newest last) and the metadata stamp of the newest.
#[derive(Default)]
struct Retained {
    stamp: String,
    snapshots: VecDeque<Arc<Snapshot>>,
}

// ponytail: one process-wide table keyed by the mod's folder, cleared whole past 256 packages (a
// page then sees 410 and lists again); the upgrade path is an LRU owned by `AppState`.
static PACKAGES: LazyLock<Mutex<HashMap<PathBuf, Retained>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// A path inside a package as the page names it: `/`-separated segments of letters, digits, `.`,
/// `-` and `_`, none empty or starting with `.` (so no `..`, no hidden files, no `\`, `%` or NUL).
fn package_path_ok(rel: &str) -> bool {
    rel.len() <= 512
        && rel.split('/').all(|segment| {
            !segment.is_empty()
                && !segment.starts_with('.')
                && segment
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        })
}

fn package_kind(rel: &str) -> Option<&'static str> {
    let ext = rel.rsplit_once('.')?.1;
    PACKAGE_KINDS
        .iter()
        .find(|(e, _)| *e == ext)
        .map(|(_, kind)| *kind)
}

/// What changes when a file is written: size, modified and (on unix) changed time and inode. The
/// changed time moves on every write even when the modified time is put back.
fn file_stamp(meta: &std::fs::Metadata) -> String {
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
    #[cfg(unix)]
    let changed = {
        use std::os::unix::fs::MetadataExt;
        (meta.ctime(), meta.ctime_nsec(), meta.ino())
    };
    // ponytail: without a changed time, a same-size edit that restores the modified time is missed
    // until another change; unix (macOS, Linux) is where cores run.
    #[cfg(not(unix))]
    let changed = ();
    format!("{}:{modified:?}:{changed:?}", meta.len())
}

/// Every supported file of a package, sorted by relative path, with its metadata stamp. A link, an
/// unsafe name or a package past the limits is refused rather than partly served.
fn inventory(dir: &Path) -> Result<Vec<(String, PathBuf, String)>, Error> {
    let mut found = Vec::new();
    let mut bytes = 0u64;
    let mut stack = vec![(dir.to_path_buf(), String::new(), 0usize)];
    while let Some((folder, prefix, depth)) = stack.pop() {
        for entry in std::fs::read_dir(&folder)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            let rel = format!("{prefix}{name}");
            let kind = entry.file_type()?;
            if kind.is_symlink() {
                return Err(Error::Invalid(format!(
                    "a package cannot hold links ({rel})"
                )));
            }
            if kind.is_dir() {
                if depth + 1 >= MAX_PACKAGE_DEPTH {
                    return Err(Error::Invalid(format!(
                        "a package is at most {MAX_PACKAGE_DEPTH} folders deep ({rel})"
                    )));
                }
                stack.push((entry.path(), format!("{rel}/"), depth + 1));
                continue;
            }
            if !kind.is_file() || package_kind(&rel).is_none() {
                continue;
            }
            if !package_path_ok(&rel) {
                return Err(Error::Invalid(format!(
                    "package file names are letters, digits, '.', '-' and '_' ({rel})"
                )));
            }
            let meta = entry.metadata()?;
            bytes += meta.len();
            if found.len() >= MAX_PACKAGE_FILES || bytes > MAX_PACKAGE_BYTES {
                return Err(Error::Invalid(format!(
                    "a package is at most {MAX_PACKAGE_FILES} files and 64 MiB"
                )));
            }
            found.push((rel, entry.path(), file_stamp(&meta)));
        }
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(found)
}

/// The current snapshot of the package in `dir`: the retained one when no file's stamp moved,
/// else every file read, hashed and kept (unchanged files share the previous revision's bytes).
fn package(dir: &Path) -> Result<Arc<Snapshot>, Error> {
    let files = inventory(dir)?;
    let stamp: String = files
        .iter()
        .map(|(rel, _, stamp)| format!("{rel}={stamp};"))
        .collect();
    let previous = {
        let store = PACKAGES.lock().unwrap();
        let retained = store.get(dir);
        match retained.and_then(|r| r.snapshots.back().cloned()) {
            Some(newest) if retained.is_some_and(|r| r.stamp == stamp) => return Ok(newest),
            newest => newest,
        }
    };
    let mut hasher = Sha256::new();
    let mut read = BTreeMap::new();
    let mut total = 0u64;
    for (rel, path, _) in files {
        let bytes = std::fs::read(&path)?;
        total += bytes.len() as u64;
        if total > MAX_PACKAGE_BYTES {
            return Err(Error::Invalid(
                "a package is at most 64 MiB (it grew while being read)".into(),
            ));
        }
        for part in [rel.as_bytes(), &bytes] {
            hasher.update((part.len() as u64).to_le_bytes());
            hasher.update(part);
        }
        let shared = previous
            .as_ref()
            .and_then(|p| p.files.get(&rel))
            .filter(|old| ***old == *bytes)
            .cloned()
            .unwrap_or_else(|| Arc::from(bytes));
        read.insert(rel, shared);
    }
    let snapshot = Arc::new(Snapshot {
        revision: format!("{:x}", hasher.finalize()),
        files: read,
    });
    let mut store = PACKAGES.lock().unwrap();
    if store.len() >= 256 && !store.contains_key(dir) {
        store.clear();
    }
    let retained = store.entry(dir.to_path_buf()).or_default();
    retained.stamp = stamp;
    retained
        .snapshots
        .retain(|s| s.revision != snapshot.revision);
    retained.snapshots.push_back(snapshot.clone());
    while retained.snapshots.len() > RETAINED_SNAPSHOTS {
        retained.snapshots.pop_front();
    }
    Ok(snapshot)
}

/// One file of a retained package revision, with its content type, by exact path in that
/// revision's file list. Never reads the disk: an unknown or dropped revision is [`Error::Gone`].
pub fn package_file(
    root: &Path,
    policy: &Policy,
    id: &str,
    revision: &str,
    rel: &str,
) -> Result<(Arc<[u8]>, &'static str), Error> {
    if policy.is_off() {
        return Err(Error::Off("mods are off".into()));
    }
    let dir = mods_dir(root).join(id);
    if !plain_id(id) || !dir.is_dir() {
        return Err(Error::NotFound(format!("no mod \"{id}\"")));
    }
    if disabled(root).iter().any(|other| other == id) {
        return Err(Error::Off(format!("mod \"{id}\" is off")));
    }
    let kind = package_kind(rel)
        .filter(|_| package_path_ok(rel))
        .ok_or_else(|| Error::NotFound(format!("mod \"{id}\" has no file \"{rel}\"")))?;
    let snapshot = PACKAGES
        .lock()
        .unwrap()
        .get(&dir)
        .and_then(|r| r.snapshots.iter().find(|s| s.revision == revision).cloned())
        .ok_or_else(|| {
            Error::Gone(format!(
                "revision {revision} of mod \"{id}\" is no longer kept; list the mods again"
            ))
        })?;
    let bytes = snapshot
        .files
        .get(rel)
        .cloned()
        .ok_or_else(|| Error::NotFound(format!("mod \"{id}\" has no file \"{rel}\"")))?;
    Ok((bytes, kind))
}

fn stamp(path: &Path) -> String {
    match std::fs::metadata(path) {
        Ok(m) => {
            let at = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
            format!("{}:{:?};", m.len(), at)
        }
        Err(_) => "missing;".into(),
    }
}

/// Every folder in `mods/`, working or not; nothing when mods are off. Never fails because of one
/// bad folder: it is listed with its `error`.
pub fn scan(root: &Path, policy: &Policy) -> Vec<ModInfo> {
    let Ok(entries) = std::fs::read_dir(mods_dir(root)) else {
        return Vec::new();
    };
    if policy.is_off() {
        return Vec::new();
    }
    let off = disabled(root);
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| plain_id(name))
        .collect();
    names.sort();
    names
        .into_iter()
        .map(|id| {
            let enabled = !off.contains(&id);
            mod_info(&mods_dir(root).join(&id), id, enabled)
        })
        .collect()
}

/// The mod in `dir` as [`scan`] lists it, named `id`; `enabled` unless it is turned off.
fn mod_info(dir: &Path, id: String, enabled: bool) -> ModInfo {
    let dir = dir.to_path_buf();
    let manifest = read_manifest(&dir);
    let package_format = manifest.as_ref().ok().and_then(|m| m.format.clone());
    let loaded = manifest.and_then(|m| {
        let entry = entry_of(&m)?.to_string();
        if m.format.is_some() {
            let snapshot = package(&dir)?;
            if !snapshot.files.contains_key(&entry) {
                return Err(Error::Invalid(format!("{entry} is missing")));
            }
            return Ok((m, entry, snapshot.revision.clone(), Some(snapshot)));
        }
        if !dir.join(&entry).is_file() {
            return Err(Error::Invalid(format!("{entry} is missing")));
        }
        let sum = format!(
            "{}{}",
            stamp(&dir.join("mod.json")),
            stamp(&dir.join(&entry))
        );
        let revision = sum.bytes().fold(0xcbf29ce484222325u64, |h, b| {
            (h ^ u64::from(b)).wrapping_mul(0x100000001b3)
        });
        Ok((m, entry, format!("{revision:x}"), None))
    });
    match loaded {
        Ok((m, entry, revision, snapshot)) => ModInfo {
            enabled,
            name: if m.name.is_empty() {
                id.clone()
            } else {
                m.name
            },
            description: m.description,
            place: m.place,
            revision,
            error: None,
            fonts: fonts_of(&dir),
            entry: snapshot.as_ref().map(|_| entry),
            files: snapshot
                .map(|s| s.files.keys().cloned().collect())
                .unwrap_or_default(),
            format: m.format,
            api: m.api,
            origin: m.origin,
            version: m.version,
            cloned_from: m.cloned_from,
            publisher: m.publisher,
            installed_from: m.installed_from,
            id,
        },
        Err(error) => ModInfo {
            enabled: false,
            name: id.clone(),
            description: String::new(),
            place: Place::None,
            revision: String::new(),
            error: Some(error.to_string()),
            fonts: Vec::new(),
            // Still marked, so a client that cannot load packages is not shown a broken one.
            format: package_format,
            api: None,
            entry: None,
            files: Vec::new(),
            origin: None,
            version: None,
            cloned_from: None,
            publisher: None,
            installed_from: None,
            id,
        },
    }
}

const MAX_FONT_BYTES: u64 = 4 * 1024 * 1024;
const FONT_KINDS: [(&str, &str); 4] = [
    ("ttf", "font/ttf"),
    ("otf", "font/otf"),
    ("woff", "font/woff"),
    ("woff2", "font/woff2"),
];

fn font_name_ok(name: &str) -> bool {
    name.len() <= 80
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ' '))
        && name.rsplit_once('.').is_some_and(|(_, ext)| {
            FONT_KINDS
                .iter()
                .any(|(e, _)| *e == ext.to_ascii_lowercase())
        })
}

/// The usable font files in `<mod>/fonts/`, sorted, at most 8.
fn fonts_of(dir: &Path) -> Vec<String> {
    let mut found: Vec<String> = std::fs::read_dir(dir.join("fonts"))
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| {
            e.file_type().is_ok_and(|t| t.is_file())
                && e.metadata().is_ok_and(|m| m.len() <= MAX_FONT_BYTES)
        })
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| font_name_ok(n))
        .collect();
    found.sort();
    found.truncate(8);
    found
}

/// One font file of an enabled mod, with its content type; only names `scan` lists are served.
pub fn font(
    root: &Path,
    policy: &Policy,
    id: &str,
    name: &str,
) -> Result<(Vec<u8>, &'static str), Error> {
    let found = scan(root, policy)
        .into_iter()
        .find(|m| m.id == id && m.enabled && m.error.is_none())
        .ok_or_else(|| Error::NotFound(format!("no enabled mod \"{id}\"")))?;
    if !found.fonts.iter().any(|f| f == name) {
        return Err(Error::NotFound(format!(
            "mod \"{id}\" has no font \"{name}\""
        )));
    }
    let ext = name
        .rsplit_once('.')
        .map_or("", |(_, e)| e)
        .to_ascii_lowercase();
    let kind = FONT_KINDS
        .iter()
        .find(|(e, _)| *e == ext)
        .map_or("font/ttf", |(_, k)| k);
    let path = mods_dir(root)
        .join(id)
        .join("fonts")
        .join(name)
        .canonicalize()?;
    if !path.starts_with(mods_dir(root).join(id).canonicalize()?) {
        return Err(Error::Invalid(
            "the font points outside the mod's folder".into(),
        ));
    }
    Ok((std::fs::read(path)?, kind))
}

const ICON_KINDS: [(&str, &str); 5] = [
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("webp", "image/webp"),
];
const SOUND_KINDS: [(&str, &str); 5] = [
    ("mp3", "audio/mpeg"),
    ("wav", "audio/wav"),
    ("ogg", "audio/ogg"),
    ("m4a", "audio/mp4"),
    ("flac", "audio/flac"),
];

/// A file the person points at from `programs.json` or `settings.json` (an icon, a sound): by
/// relative path under the folder that holds `mods/`, of one of `kinds`, up to `max` bytes. Nothing
/// outside that folder is served, symlinks resolved.
fn folder_asset(
    root: &Path,
    policy: &Policy,
    rel: &str,
    kinds: &[(&str, &'static str)],
    max: u64,
    what: &str,
) -> Result<(Vec<u8>, &'static str), Error> {
    if policy.is_off() {
        return Err(Error::NotFound("mods are off".into()));
    }
    let relative = Path::new(rel);
    if rel.is_empty()
        || !relative
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
    {
        return Err(Error::Invalid(format!(
            "{what} is a relative path inside the folder"
        )));
    }
    let ext = relative
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let kind = kinds
        .iter()
        .find(|(e, _)| *e == ext)
        .map(|(_, k)| *k)
        .ok_or_else(|| {
            Error::Invalid(format!(
                "{what} is a {}",
                kinds.iter().map(|(e, _)| *e).collect::<Vec<_>>().join(", ")
            ))
        })?;
    let base = root.canonicalize()?;
    let path = base.join(relative).canonicalize()?;
    if !path.starts_with(&base) {
        return Err(Error::Invalid(format!("{what} points outside the folder")));
    }
    if std::fs::metadata(&path)?.len() > max {
        return Err(Error::Invalid(format!("larger than {} KiB", max / 1024)));
    }
    Ok((std::fs::read(path)?, kind))
}

/// A program icon from `programs.json` (`"icon": "my-icons/mytool.svg"`), up to 1 MiB.
pub fn icon(root: &Path, policy: &Policy, rel: &str) -> Result<(Vec<u8>, &'static str), Error> {
    folder_asset(root, policy, rel, &ICON_KINDS, 1024 * 1024, "an icon")
}

/// A notification sound from `settings.json` (`soundDone`, `soundBlocked`), up to 2 MiB.
pub fn sound(root: &Path, policy: &Policy, rel: &str) -> Result<(Vec<u8>, &'static str), Error> {
    folder_asset(root, policy, rel, &SOUND_KINDS, 2 * 1024 * 1024, "a sound")
}

/// Turn one mod off or back on.
pub fn set_enabled(root: &Path, policy: &Policy, id: &str, enabled: bool) -> Result<(), Error> {
    if !scan(root, policy).iter().any(|m| m.id == id) {
        return Err(Error::NotFound(format!(
            "no mod \"{id}\" (or mods are off)"
        )));
    }
    let mut off = disabled(root);
    off.retain(|other| other != id);
    if !enabled {
        off.push(id.to_string());
    }
    std::fs::write(
        root.join(STATE),
        serde_json::json!({ "disabled": off }).to_string(),
    )?;
    Ok(())
}

/// The code of an enabled, loadable mod, read from inside its own folder (symlinks resolved).
pub fn source(root: &Path, policy: &Policy, id: &str) -> Result<String, Error> {
    let found = scan(root, policy)
        .into_iter()
        .find(|m| m.id == id)
        .ok_or_else(|| Error::NotFound(format!("no mod \"{id}\" (or mods are off)")))?;
    if let Some(error) = found.error {
        return Err(Error::Invalid(error));
    }
    if !found.enabled {
        return Err(Error::Invalid(format!("mod \"{id}\" is off")));
    }
    if found.format.is_some() {
        return Err(Error::Invalid(format!(
            "mod \"{id}\" is a package; its files load from mods/package"
        )));
    }
    let dir = mods_dir(root).join(id);
    let entry = entry_of(&read_manifest(&dir)?)?.to_string();
    let (base, file) = (dir.canonicalize()?, dir.join(entry).canonicalize()?);
    if !file.starts_with(&base) {
        return Err(Error::Invalid(format!(
            "mod \"{id}\" points outside its folder"
        )));
    }
    if std::fs::metadata(&file)?.len() > MAX_BYTES {
        return Err(Error::Invalid(format!("mod \"{id}\" is larger than 2 MiB")));
    }
    Ok(std::fs::read_to_string(file)?)
}

/// `perch mod remove <id>`: takes a mod folder or a layout file out of use. It moves to
/// `<root>/mods-removed/` (named with the time) instead of being deleted, so a mistake is one `mv`.
/// `only` names which one when a mod and a layout share the id (`"mod"` or `"layout"`).
pub fn remove(root: &Path, id: &str, only: Option<&str>) -> Result<String, Error> {
    if !plain_id(id) {
        return Err(Error::Invalid("an id is letters, digits, - and _".into()));
    }
    let (mod_dir, layout_file) = (
        mods_dir(root).join(id),
        root.join("layouts").join(format!("{id}.json")),
    );
    let (has_mod, has_layout) = (
        mod_dir.is_dir() && only != Some("layout"),
        layout_file.is_file() && only != Some("mod"),
    );
    let (from, kind) = match (has_mod, has_layout) {
        (true, false) => (mod_dir, "mod"),
        (false, true) => (layout_file, "layout"),
        (true, true) => {
            return Err(Error::Invalid(format!(
                "\"{id}\" is both a mod and a layout; say which: perch mod remove {id} mod|layout"
            )))
        }
        (false, false) => return Err(Error::NotFound(format!("no mod or layout \"{id}\""))),
    };
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis());
    let trash = root.join("mods-removed");
    std::fs::create_dir_all(&trash)?;
    let name = from.file_name().and_then(|n| n.to_str()).unwrap_or(id);
    std::fs::rename(&from, trash.join(format!("{stamp}-{name}")))?;
    if kind == "mod" {
        let mut off = disabled(root);
        off.retain(|other| other != id);
        std::fs::write(
            root.join(STATE),
            serde_json::json!({ "disabled": off }).to_string(),
        )?;
    } else if crate::layouts::current(root).as_deref() == Some(id) {
        std::fs::write(
            root.join("layout-state.json"),
            serde_json::json!({ "layout": null }).to_string(),
        )?;
    }
    Ok(kind.to_string())
}

/// What `install` added, and what the person should know before trusting it.
#[derive(Debug, Default, Serialize)]
pub struct Installed {
    pub mods: Vec<String>,
    pub layouts: Vec<String>,
    pub warnings: Vec<String>,
}

const MAX_INSTALL_FILES: usize = 300;
const MAX_INSTALL_BYTES: u64 = 8 * 1024 * 1024;

/// `owner/repo[/sub/path]` or a `https://github.com/owner/repo[/tree/<branch>/sub/path]` link.
fn github_source(source: &str) -> Result<(String, Option<String>, Vec<String>), Error> {
    let bad = || Error::Invalid("a source is owner/repo[/folder] or a github.com link".into());
    let path = source
        .strip_prefix("https://github.com/")
        .unwrap_or(source)
        .trim_end_matches('/');
    let parts: Vec<&str> = path.split('/').collect();
    let word = |text: &str| {
        !text.is_empty()
            && text.len() <= 100
            && text
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
            && !text.starts_with(['-', '.'])
    };
    if parts.len() < 2 || !word(parts[0]) || !word(parts[1].trim_end_matches(".git")) {
        return Err(bad());
    }
    let repo = format!("{}/{}", parts[0], parts[1].trim_end_matches(".git"));
    let (branch, sub) = match parts.get(2) {
        Some(&"tree") if parts.len() > 3 => (Some(parts[3].to_string()), &parts[4..]),
        _ => (None, &parts[2..]),
    };
    if !sub.iter().all(|s| word(s)) || branch.as_deref().is_some_and(|b| !word(b)) {
        return Err(bad());
    }
    Ok((repo, branch, sub.iter().map(|s| s.to_string()).collect()))
}

/// An https git URL on a public host: no credentials, no ports, and no address that is this computer or
/// its network (the core would be fetching on someone's say-so).
fn public_git_url(url: &str) -> Result<(), Error> {
    let bad = || {
        Error::Invalid(
            "a git source is an https:// URL on a public host (or owner/repo for GitHub)".into(),
        )
    };
    let rest = url.strip_prefix("https://").ok_or_else(bad)?;
    let (host, path) = rest.split_once('/').ok_or_else(bad)?;
    let host_ok = host.contains('.')
        && host.len() <= 100
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.'))
        && !host.starts_with(['-', '.'])
        && !host.chars().all(|c| c.is_ascii_digit() || c == '.')
        && !host.ends_with(".local")
        && !host.ends_with(".internal")
        && !host.ends_with(".localhost");
    let path_ok = !path.is_empty()
        && path.len() <= 200
        && !path
            .split('/')
            .any(|p| p.is_empty() || p == ".." || p.starts_with('-'))
        && path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'));
    if host_ok && path_ok {
        Ok(())
    } else {
        Err(bad())
    }
}

/// The most `copy_tree` copies: files and bytes.
type CopyLimit = (usize, u64);
const INSTALL_LIMIT: CopyLimit = (MAX_INSTALL_FILES, MAX_INSTALL_BYTES);
/// A whole package (a stock-sized screen is hundreds of files); a sanity bound, not a quota.
const PACKAGE_COPY_LIMIT: CopyLimit = (MAX_PACKAGE_FILES, MAX_PACKAGE_BYTES);

fn copy_tree(
    from: &Path,
    to: &Path,
    files: &mut usize,
    bytes: &mut u64,
    limit: CopyLimit,
) -> Result<(), Error> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_text = name.to_string_lossy();
        let kind = entry.file_type()?;
        if name_text.starts_with('.') || name_text == "node_modules" || kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            copy_tree(&entry.path(), &to.join(&name), files, bytes, limit)?;
        } else {
            *files += 1;
            *bytes += entry.metadata()?.len();
            if *files > limit.0 || *bytes > limit.1 {
                return Err(Error::Invalid(format!(
                    "too big to copy: at most {} files and {} MiB",
                    limit.0,
                    limit.1 / (1024 * 1024)
                )));
            }
            std::fs::copy(entry.path(), to.join(&name))?;
        }
    }
    Ok(())
}

/// What the code does that deserves a word to the person before it runs, found by plain text search.
fn warnings_for(id: &str, dir: &Path) -> Vec<String> {
    let mut text = String::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(next) = stack.pop() {
        for entry in std::fs::read_dir(&next).into_iter().flatten().flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().is_some_and(|e| e == "js") {
                text.push_str(&std::fs::read_to_string(&path).unwrap_or_default());
            }
        }
    }
    [
        ("exec(", "runs programs on this computer"),
        ("fetch(", "reaches the network"),
        ("WebSocket", "opens network connections"),
        ("writeTextFile", "writes files on this computer"),
        ("readTextFile", "reads files on this computer"),
        (
            "api.socket",
            "sends messages to Perch itself (it can start terminals)",
        ),
    ]
    .iter()
    .filter(|(needle, _)| text.contains(needle))
    .map(|(_, what)| format!("mod \"{id}\" {what}"))
    .collect()
}

/// `perch mod install <source>`: copies mods and layouts from a public GitHub repo into the mods and
/// layouts folders. A repo laid out like this home (`mods/<name>/`, `layouts/<name>.json`) gives all
/// of them; a folder with a `main.js` at its top is one mod named after the folder. Never overwrites:
/// a name already in use stops the install before anything is copied. Blocking (it runs `git`).
pub fn install(root: &Path, source: &str) -> Result<Installed, Error> {
    // A folder on this computer: `/abs/path` or `~/path`.
    if source.starts_with('/') || source.starts_with("~/") {
        let path = match source.strip_prefix("~/") {
            Some(rest) => PathBuf::from(
                std::env::var_os("HOME").ok_or_else(|| Error::Invalid("no home folder".into()))?,
            )
            .join(rest),
            None => PathBuf::from(source),
        };
        return install_from(
            root,
            &path,
            &InstalledFrom {
                kind: "folder".into(),
                location: path.display().to_string(),
                commit: None,
                digest: String::new(),
            },
        );
    }
    // Any other git host over https: `https://host/path[.git][#branch]`.
    if source.starts_with("https://") && !source.starts_with("https://github.com/") {
        let (url, branch) = source
            .split_once('#')
            .map_or((source, None), |(u, b)| (u, Some(b)));
        public_git_url(url)?;
        if branch.is_some_and(|b| {
            b.is_empty()
                || b.len() > 100
                || !b
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'))
        }) {
            return Err(Error::Invalid("a branch is plain text".into()));
        }
        return install_from_url(root, url, branch, &[]);
    }
    let (repo, branch, sub) = github_source(source)?;
    install_from_url(
        root,
        &format!("https://github.com/{repo}.git"),
        branch.as_deref(),
        &sub,
    )
}

/// `install` for any git URL or path; the source has already been checked. The clone is a
/// temporary folder handed to [`install_from`], recorded as the URL and the commit it holds.
fn install_from_url(
    root: &Path,
    url: &str,
    branch: Option<&str>,
    sub: &[String],
) -> Result<Installed, Error> {
    let repo = url.trim_start_matches("https://");
    let work = std::env::temp_dir().join(format!("perch-install-{}", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut clone = std::process::Command::new("git");
        clone.args(["clone", "--depth", "1", "--quiet"]);
        if let Some(branch) = branch {
            clone.args(["--branch", branch]);
        }
        clone.arg(url).arg(&work).env("GIT_TERMINAL_PROMPT", "0");
        let output = clone
            .output()
            .map_err(|e| Error::Invalid(format!("could not run git: {e}")))?;
        if !output.status.success() {
            return Err(Error::Invalid(format!(
                "could not fetch {repo}: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            )));
        }
        let commit = std::process::Command::new("git")
            .arg("-C")
            .arg(&work)
            .args(["rev-parse", "HEAD"])
            .output()
            .ok()
            .filter(|out| out.status.success())
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .filter(|commit| !commit.is_empty());
        install_from(
            root,
            &sub.iter().fold(work.clone(), |dir, s| dir.join(s)),
            &InstalledFrom {
                kind: "git".into(),
                location: url.to_string(),
                commit,
                digest: String::new(),
            },
        )
    })();
    let _ = std::fs::remove_dir_all(&work);
    result
}

/// `sha256:<hex>` of every file under `dir` that [`copy_tree`] copies, as [`InstalledFrom::digest`]
/// describes.
fn tree_digest(dir: &Path) -> Result<String, Error> {
    let mut files = Vec::new();
    let mut stack = vec![(dir.to_path_buf(), String::new())];
    while let Some((folder, prefix)) = stack.pop() {
        for entry in std::fs::read_dir(&folder)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let kind = entry.file_type()?;
            if name.starts_with('.') || name == "node_modules" || kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                stack.push((entry.path(), format!("{prefix}{name}/")));
            } else {
                files.push((format!("{prefix}{name}"), entry.path()));
            }
        }
    }
    files.sort();
    let mut hasher = Sha256::new();
    for (rel, path) in files {
        let bytes = std::fs::read(path)?;
        for part in [rel.as_bytes(), &bytes] {
            hasher.update((part.len() as u64).to_le_bytes());
            hasher.update(part);
        }
    }
    Ok(format!("sha256:{:x}", hasher.finalize()))
}

/// Writes where an installed mod came from into its `mod.json` (made if absent), with the digest
/// of its files as copied. A manifest that is not a JSON object is left as it is.
fn record_install(dir: &Path, from: &InstalledFrom) -> Result<(), Error> {
    let from = InstalledFrom {
        digest: tree_digest(dir)?,
        ..from.clone()
    };
    let path = dir.join("mod.json");
    let mut manifest = match std::fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => return Ok(()),
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => serde_json::Map::new(),
        Err(error) => return Err(error.into()),
    };
    manifest.insert(
        "installedFrom".into(),
        serde_json::to_value(&from)
            .map_err(|e| Error::Invalid(format!("could not write mod.json: {e}")))?,
    );
    let text = serde_json::to_string_pretty(&manifest)
        .map_err(|e| Error::Invalid(format!("could not write mod.json: {e}")))?;
    std::fs::write(path, text)?;
    Ok(())
}

/// The id a mod folder installs as: its `mod.json` `id` when it names one, else the folder's name.
fn install_id(dir: &Path, folder: String) -> String {
    std::fs::read_to_string(dir.join("mod.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|manifest| manifest["id"].as_str().map(str::to_string))
        .filter(|id| plain_id(id))
        .unwrap_or(folder)
}

/// The one install step, whatever the source: `top` is a folder on disk (the source itself, or a
/// git clone of it) and `from` says where it came from. Copies every mod and layout it holds and
/// records `from` and the copied files' digest in each mod's `mod.json`.
pub fn install_from(root: &Path, top: &Path, from: &InstalledFrom) -> Result<Installed, Error> {
    let name_hint = from.location.trim_end_matches('/');
    let name_hint = name_hint.strip_suffix(".git").unwrap_or(name_hint);
    if !top.is_dir() {
        return Err(Error::NotFound(
            "that folder is not in the repository".into(),
        ));
    }
    let mut found: Vec<(String, PathBuf, bool)> = Vec::new(); // (id, source, is layout)
    for entry in std::fs::read_dir(top.join("mods"))
        .into_iter()
        .flatten()
        .flatten()
    {
        let id = entry.file_name().to_string_lossy().into_owned();
        if entry.path().join("main.js").is_file() && plain_id(&id) {
            found.push((install_id(&entry.path(), id), entry.path(), false));
        }
    }
    for entry in std::fs::read_dir(top.join("layouts"))
        .into_iter()
        .flatten()
        .flatten()
    {
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(id) = name.strip_suffix(".json").filter(|id| plain_id(id)) {
            found.push((id.to_string(), entry.path(), true));
        }
    }
    if found.is_empty() && top.join("main.js").is_file() {
        let last = name_hint.rsplit('/').next().unwrap_or(name_hint);
        let id = top
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| plain_id(n) && !n.starts_with("perch-install-"))
            .unwrap_or(last)
            .to_string();
        found.push((install_id(top, id), top.to_path_buf(), false));
    }
    if found.is_empty() {
        return Err(Error::Invalid(
            "nothing to install: expected mods/<name>/main.js, layouts/<name>.json or a main.js at the top".into(),
        ));
    }
    for (id, _, is_layout) in &found {
        let taken = if *is_layout {
            root.join("layouts").join(format!("{id}.json"))
        } else {
            mods_dir(root).join(id)
        };
        if !plain_id(id) || taken.exists() {
            return Err(Error::Invalid(format!(
                "\"{id}\" already exists; remove it first (perch mod remove {id}) or install nothing over it"
            )));
        }
    }
    let mut done = Installed::default();
    let (mut files, mut bytes) = (0, 0);
    for (id, source, is_layout) in found {
        if is_layout {
            std::fs::create_dir_all(root.join("layouts"))?;
            std::fs::copy(&source, root.join("layouts").join(format!("{id}.json")))?;
            done.layouts.push(id);
        } else {
            let to = mods_dir(root).join(&id);
            copy_tree(&source, &to, &mut files, &mut bytes, INSTALL_LIMIT)?;
            record_install(&to, from)?;
            done.warnings.extend(warnings_for(&id, &to));
            done.mods.push(id);
        }
    }
    Ok(done)
}

/// A mod or layout that ships inside Perch to copy and change (herdr ships its defaults the same way).
/// `files` are relative to `mods/<id>/` for a mod, or to `layouts/` for a layout.
pub struct Example {
    pub id: &'static str,
    pub layout: bool,
    pub about: &'static str,
    files: &'static [(&'static str, &'static str)],
}

pub const EXAMPLES: &[Example] = &[
    Example {
        id: "command-list",
        layout: false,
        about: "a filterable list of every app command, plus a command and key of its own (api.commands, run, command, overlay)",
        files: &[
            ("main.js", include_str!("mod_examples/command-list/main.js")),
            ("mod.json", include_str!("mod_examples/command-list/mod.json")),
        ],
    },
    Example {
        id: "session-count",
        layout: false,
        about: "a live session count that toasts when one is blocked (api.store, notify)",
        files: &[
            ("main.js", include_str!("mod_examples/session-count/main.js")),
            ("mod.json", include_str!("mod_examples/session-count/mod.json")),
        ],
    },
    Example {
        id: "compact-rows",
        layout: false,
        about: "draws the sidebar's session rows and the notification cards itself (api.slot)",
        files: &[
            ("main.js", include_str!("mod_examples/compact-rows/main.js")),
            ("mod.json", include_str!("mod_examples/compact-rows/mod.json")),
        ],
    },
    Example {
        id: "ide",
        layout: true,
        about: "layout: sidebar | tabs over canvas | files, no look of its own",
        files: &[("ide.json", include_str!("mod_examples/ide.json"))],
    },
    Example {
        id: "midnight",
        layout: true,
        about: "layout: a dark theme with rounded, outlined cards and a status bar (theme, colors, radius, border)",
        files: &[("midnight.json", include_str!("mod_examples/midnight.json"))],
    },
];

/// Duplicates a mod or layout already in the folders, as herdr's "Duplicate mod/layout": the copy is
/// `new_id` (default `<id>-copy`), yours to edit, and nothing is overwritten. A mod is copied whole
/// (a package up to [`PACKAGE_COPY_LIMIT`]) into a hidden folder first, so the copy appears complete
/// or not at all, and its `mod.json` records `origin: "clone"` and `clonedFrom`. A copy never takes
/// the id of a shipped example.
fn clone_installed(root: &Path, id: &str, new_id: Option<&str>) -> Result<Option<String>, Error> {
    let (mod_dir, layout) = (
        mods_dir(root).join(id),
        root.join("layouts").join(format!("{id}.json")),
    );
    if !plain_id(id) || !(mod_dir.is_dir() || layout.is_file()) {
        return Ok(None);
    }
    let copy = new_id.map_or_else(|| format!("{id}-copy"), String::from);
    let to = if mod_dir.is_dir() {
        mods_dir(root).join(&copy)
    } else {
        root.join("layouts").join(format!("{copy}.json"))
    };
    if !plain_id(&copy) || to.exists() {
        return Err(Error::Invalid(format!(
            "\"{copy}\" is taken or not a plain id; pass another: perch mod clone {id} <id>"
        )));
    }
    if !mod_dir.is_dir() {
        // A layout copy records what it was copied from, as a package copy does; a file that is not a
        // JSON object (it cannot load either) is copied as it is.
        let text = std::fs::read_to_string(&layout)?;
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(serde_json::Value::Object(mut object)) => {
                object.insert("clonedFrom".into(), serde_json::json!({ "id": id }));
                crate::layouts::write_new(root, &copy, &serde_json::Value::Object(object))?;
            }
            _ => {
                std::fs::copy(&layout, &to)?;
            }
        }
        return Ok(Some(copy));
    }
    let source = mod_info(&mod_dir, id.to_string(), true);
    let from = ClonedFrom {
        id: id.to_string(),
        revision: source.revision,
        version: source.version,
    };
    let limit = if source.format.is_some() {
        PACKAGE_COPY_LIMIT
    } else {
        INSTALL_LIMIT
    };
    copy_mod(root, &mod_dir, &copy, &from, limit)?;
    Ok(Some(copy))
}

/// Copies the mod folder `from` to `mods/<copy>` through a hidden staging folder, so the copy
/// appears complete or not at all, and records `from` as its provenance. Refuses an id that is not
/// plain, is taken or is a shipped example's.
fn copy_mod(
    root: &Path,
    from: &Path,
    copy: &str,
    source: &ClonedFrom,
    limit: CopyLimit,
) -> Result<(), Error> {
    let to = mods_dir(root).join(copy);
    if !plain_id(copy) || to.exists() {
        return Err(Error::Invalid(format!(
            "\"{copy}\" is taken or not a plain id; pass another: perch mod clone {} <id>",
            source.id
        )));
    }
    if EXAMPLES.iter().any(|e| e.id == copy) {
        return Err(Error::Invalid(format!(
            "\"{copy}\" is a shipped example's id; pass another: perch mod clone {} <id>",
            source.id
        )));
    }
    let staging = mods_dir(root).join(format!(".clone-{}", uuid::Uuid::new_v4()));
    let made = copy_tree(from, &staging, &mut 0, &mut 0, limit)
        .and_then(|()| record_clone(&staging, source))
        .and_then(|()| {
            if to.exists() {
                return Err(Error::Invalid(format!("\"{copy}\" was taken meanwhile")));
            }
            Ok(std::fs::rename(&staging, &to)?)
        });
    if made.is_err() {
        let _ = std::fs::remove_dir_all(&staging);
    }
    made
}

/// The prefix of a stock screen's id. No mod, layout or clone id can start with it.
pub const STOCK_PREFIX: &str = "stock:";
const MAX_CATALOG_BYTES: u64 = 1024 * 1024;

/// One package of `stock-ui/catalog.json`; the rest of what it says is in its `mod.json`.
#[derive(Deserialize)]
struct CatalogEntry {
    id: String,
    revision: String,
}

#[derive(Deserialize)]
struct Catalog {
    packages: Vec<CatalogEntry>,
}

/// The stock screens in `stock_dir` (the web build's `stock-ui/`), as `stock:<id>`: placed only by
/// Perch or a layout, and listed whether mods are on or off. A package whose files no longer hash to
/// the catalog's revision is listed with that error (a half-rebuilt web app), not served or copied.
/// No `catalog.json` (a core without a web build) is no stock screens.
pub fn stock(stock_dir: &Path) -> Vec<ModInfo> {
    let path = stock_dir.join("catalog.json");
    let read = std::fs::metadata(&path)
        .ok()
        .filter(|m| m.is_file() && m.len() <= MAX_CATALOG_BYTES)
        .and_then(|_| std::fs::read_to_string(&path).ok())
        .and_then(|text| serde_json::from_str::<Catalog>(&text).ok());
    let Some(catalog) = read else {
        return Vec::new();
    };
    catalog
        .packages
        .into_iter()
        .filter(|entry| plain_id(&entry.id))
        .map(|entry| {
            let mut info = mod_info(
                &stock_dir.join(&entry.id),
                format!("{STOCK_PREFIX}{}", entry.id),
                true,
            );
            let problem = if info.error.is_some() {
                None
            } else if info.format.as_deref() != Some(PACKAGE_FORMAT) {
                Some("a stock screen is a package (format \"esm\")".to_string())
            } else if info.revision != entry.revision {
                Some(
                    "its files do not match the web build's catalog.json; rebuild Perch's web app"
                        .into(),
                )
            } else {
                None
            };
            if let Some(problem) = problem {
                info.error = Some(problem);
                info.enabled = false;
            }
            info.place = Place::Layout;
            info.origin = Some("stock".into());
            info
        })
        .collect()
}

/// `perch mod clone stock:<id> [new id]`: copies a stock screen's whole package out of the web build
/// into `mods/<new id>` (default `<id>-copy`), yours to edit; the copy records the screen, its
/// revision and version as `clonedFrom`. The stock screen itself is never changed, and the copy can
/// never take a `stock:` id, so it never stands in for stock (or runs while mods are off).
pub fn clone_stock(
    root: &Path,
    stock_dir: &Path,
    id: &str,
    new_id: Option<&str>,
) -> Result<String, Error> {
    let name = id.strip_prefix(STOCK_PREFIX).unwrap_or(id);
    let shipped = stock(stock_dir);
    let Some(source) = shipped.into_iter().find(|m| m.id == id) else {
        let names: Vec<String> = stock(stock_dir).into_iter().map(|m| m.id).collect();
        return Err(Error::NotFound(format!(
            "no stock screen \"{id}\" (this Perch ships: {})",
            if names.is_empty() {
                "none; a core without its web app has none".into()
            } else {
                names.join(", ")
            }
        )));
    };
    if let Some(error) = source.error {
        return Err(Error::Invalid(format!("{id} cannot be copied: {error}")));
    }
    let copy = new_id.map_or_else(|| format!("{name}-copy"), String::from);
    let from = ClonedFrom {
        id: source.id,
        revision: source.revision,
        version: source.version,
    };
    // ponytail: the files are checked against the catalog just before copying, not after; a web
    // rebuild during the copy could mix two builds (the clone is still a complete, editable package).
    copy_mod(
        root,
        &stock_dir.join(name),
        &copy,
        &from,
        PACKAGE_COPY_LIMIT,
    )?;
    Ok(copy)
}

/// Writes a clone's provenance into its `mod.json` (made if absent). A `mod.json` that is not a
/// JSON object is left as copied: the clone is as broken as its source and says so in its error.
fn record_clone(dir: &Path, from: &ClonedFrom) -> Result<(), Error> {
    let path = dir.join("mod.json");
    let mut manifest = match std::fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(serde_json::Value::Object(map)) => map,
            _ => return Ok(()),
        },
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => serde_json::Map::new(),
        Err(error) => return Err(error.into()),
    };
    // A copy is the person's own package, not the published one it came from.
    for key in ["id", "publisher", "installedFrom"] {
        manifest.remove(key);
    }
    manifest.insert("origin".into(), "clone".into());
    manifest.insert(
        "clonedFrom".into(),
        serde_json::to_value(from)
            .map_err(|e| Error::Invalid(format!("could not write mod.json: {e}")))?,
    );
    let text = serde_json::to_string_pretty(&manifest)
        .map_err(|e| Error::Invalid(format!("could not write mod.json: {e}")))?;
    std::fs::write(path, text)?;
    Ok(())
}

/// `perch mod clone <example|id> [as <id>]`: copies a shipped example (or one of your own mods or
/// layouts) into the mods or layouts folder as `new_id` (default: its own name, or `<id>-copy`) and
/// returns that id. Never overwrites: an id in use is refused.
pub fn clone_example(root: &Path, example: &str, new_id: Option<&str>) -> Result<String, Error> {
    let Some(found) = EXAMPLES.iter().find(|e| e.id == example) else {
        return clone_installed(root, example, new_id)?.ok_or_else(|| {
            Error::NotFound(format!(
                "no example or mod \"{example}\" (examples: {})",
                EXAMPLES.iter().map(|e| e.id).collect::<Vec<_>>().join(", ")
            ))
        });
    };
    let id = new_id.unwrap_or(found.id);
    if !plain_id(id) {
        return Err(Error::Invalid(
            "an id is letters, digits, - and _ (at most 64)".into(),
        ));
    }
    let (dir, taken) = if found.layout {
        (
            root.join("layouts"),
            root.join("layouts").join(format!("{id}.json")),
        )
    } else {
        (mods_dir(root).join(id), mods_dir(root).join(id))
    };
    if taken.exists() {
        return Err(Error::Invalid(format!(
            "\"{id}\" already exists; pass another id: perch mod clone {example} <id>"
        )));
    }
    std::fs::create_dir_all(&dir)?;
    for (name, text) in found.files {
        let name = if found.layout {
            format!("{id}.json")
        } else {
            (*name).to_string()
        };
        std::fs::write(dir.join(name), text)?;
    }
    Ok(id.to_string())
}

/// `keys.json` and `programs.json` in the folder that holds `mods/`: read and checked here, applied by
/// the page (key bindings by section, the program table for names, icons and tiles). A bad file is
/// reported (`perch mod status`, Settings) and ignored; the last good one is not kept.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct UserFiles {
    pub keys: Option<serde_json::Value>,
    pub keys_error: Option<String>,
    pub programs: Option<serde_json::Value>,
    pub programs_error: Option<String>,
}

const USER_FILE_MAX: u64 = 256 * 1024;

fn read_json(root: &Path, name: &str) -> Option<Result<serde_json::Value, String>> {
    let path = root.join(name);
    let meta = std::fs::metadata(&path).ok()?;
    if meta.len() > USER_FILE_MAX {
        return Some(Err("larger than 256 KiB".into()));
    }
    Some(
        std::fs::read_to_string(&path)
            .map_err(|e| e.to_string())
            .and_then(|text| serde_json::from_str(&text).map_err(|e| e.to_string())),
    )
}

/// Sections are `global`, `terminal`, `layout:<id>` and `mod:<id>`, each an object of key → action.
/// An action's own shape is judged when its key is pressed (a bad one shows a toast), so a typo in
/// one binding does not take the others down.
fn keys_ok(value: &serde_json::Value) -> Result<(), String> {
    let sections = value
        .as_object()
        .ok_or("keys.json is an object of sections")?;
    for (section, bindings) in sections {
        let named = |prefix: &str| section.strip_prefix(prefix).is_some_and(plain_id);
        if !(section == "global" || section == "terminal" || named("layout:") || named("mod:")) {
            return Err(format!(
                "section \"{section}\" is not global, terminal, layout:<name> or mod:<name>"
            ));
        }
        if !bindings.is_object() {
            return Err(format!("section \"{section}\" is an object of key: action"));
        }
    }
    Ok(())
}

fn programs_ok(value: &serde_json::Value) -> Result<(), String> {
    let top = value.as_object().ok_or("programs.json is an object")?;
    let strings = |v: &serde_json::Value| {
        v.as_array()
            .is_some_and(|a| a.iter().all(|s| s.is_string()))
    };
    for key in ["shells", "interpreters"] {
        if top.get(key).is_some_and(|v| !strings(v)) {
            return Err(format!("\"{key}\" is a list of program names"));
        }
    }
    let Some(programs) = top.get("programs") else {
        return Ok(());
    };
    for (id, entry) in programs.as_object().ok_or("\"programs\" is an object")? {
        let entry = entry
            .as_object()
            .ok_or_else(|| format!("programs.{id} is an object"))?;
        for (field, value) in entry {
            let ok = match field.as_str() {
                "name" | "icon" | "tile" | "color" => value.is_string(),
                "tint" => value.is_boolean(),
                "match" | "run" => strings(value),
                _ => true,
            };
            if !ok {
                return Err(format!("programs.{id}.{field} has the wrong type"));
            }
        }
    }
    Ok(())
}

pub fn scan_user_files(root: &Path, policy: &Policy) -> UserFiles {
    if policy.is_off() {
        return UserFiles::default();
    }
    let mut files = UserFiles::default();
    match read_json(root, "keys.json").map(|r| r.and_then(|v| keys_ok(&v).map(|()| v))) {
        Some(Ok(value)) => files.keys = Some(value),
        Some(Err(error)) => files.keys_error = Some(error),
        None => {}
    }
    match read_json(root, "programs.json").map(|r| r.and_then(|v| programs_ok(&v).map(|()| v))) {
        Some(Ok(value)) => files.programs = Some(value),
        Some(Err(error)) => files.programs_error = Some(error),
        None => {}
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_shipped_example_loads_and_a_clone_never_overwrites() {
        let root = Root::new();
        let policy = Policy::default();
        for example in EXAMPLES {
            assert_eq!(
                clone_example(&root.0, example.id, None).unwrap(),
                example.id
            );
            assert!(
                clone_example(&root.0, example.id, None).is_err(),
                "{} overwritten",
                example.id
            );
        }
        clone_example(&root.0, "command-list", Some("mine")).unwrap();
        assert!(clone_example(&root.0, "nope", None).is_err());
        // One of your own, copied under a new name (and never over an existing one).
        assert_eq!(clone_example(&root.0, "mine", None).unwrap(), "mine-copy");
        assert!(clone_example(&root.0, "mine", None).is_err());
        std::fs::copy(
            root.0.join("layouts/ide.json"),
            root.0.join("layouts/home.json"),
        )
        .unwrap();
        assert_eq!(
            clone_example(&root.0, "home", Some("dusk")).unwrap(),
            "dusk"
        );
        std::fs::remove_file(root.0.join("layouts/home.json")).unwrap();
        assert!(root.0.join("mods/mine-copy/main.js").is_file());
        std::fs::remove_dir_all(mods_dir(&root.0).join("mine-copy")).unwrap();
        std::fs::remove_file(root.0.join("layouts/dusk.json")).unwrap();
        assert!(clone_example(&root.0, "ide", Some("../x")).is_err());
        let mods = scan(&root.0, &policy);
        assert_eq!(mods.len(), 4, "{mods:?}"); // the three example mods, and mine
        assert!(
            mods.iter().all(|m| m.enabled && m.error.is_none()),
            "{mods:?}"
        );
        let layouts = crate::layouts::scan(&root.0, &policy);
        assert_eq!(layouts.len(), 2);
        assert!(layouts.iter().all(|l| l.error.is_none()), "{layouts:?}");
        // Cloning the layout under a new id keeps the shipped name inside the file.
        assert!(root.0.join("layouts/ide.json").is_file());
    }

    #[test]
    fn a_mods_font_files_are_listed_and_only_those_are_served() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("pretty", "main.js", "export default () => {}");
        root.put("pretty", "fonts/Pixel One.ttf", "ttfbytes");
        root.put("pretty", "fonts/notes.txt", "x");
        root.put("pretty", "fonts/.hidden.otf", "x");
        let found = scan(&root.0, &policy);
        assert_eq!(found[0].fonts, vec!["Pixel One.ttf"]);
        let (bytes, kind) = font(&root.0, &policy, "pretty", "Pixel One.ttf").unwrap();
        assert_eq!((bytes.as_slice(), kind), (&b"ttfbytes"[..], "font/ttf"));
        for bad in ["notes.txt", "../main.js", ".hidden.otf", "nope.ttf"] {
            assert!(font(&root.0, &policy, "pretty", bad).is_err(), "{bad}");
        }
        assert!(font(&root.0, &policy, "nope", "Pixel One.ttf").is_err());
    }

    #[test]
    fn remove_moves_to_the_trash_and_install_copies_without_overwriting() {
        let root = Root::new();
        root.put("keep", "main.js", "export default () => {}");
        let src = std::env::temp_dir().join(format!("perch-src-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(src.join("mods/spy")).unwrap();
        std::fs::create_dir_all(src.join("layouts")).unwrap();
        std::fs::write(
            src.join("mods/spy/main.js"),
            "export default (el, api) => api.exec('ls')",
        )
        .unwrap();
        std::fs::write(src.join("mods/spy/.hidden"), "x").unwrap();
        std::fs::write(
            src.join("layouts/wide.json"),
            r#"{"name":"Wide","root":{"type":"block","content":"tabs"}}"#,
        )
        .unwrap();

        let here = |location: &Path| InstalledFrom {
            kind: "folder".into(),
            location: location.display().to_string(),
            commit: None,
            digest: String::new(),
        };
        let done = install_from(&root.0, &src, &here(&src)).unwrap();
        assert_eq!(
            (done.mods.as_slice(), done.layouts.as_slice()),
            (&["spy".to_string()][..], &["wide".to_string()][..])
        );
        assert!(
            done.warnings.iter().any(|w| w.contains("runs programs")),
            "{:?}",
            done.warnings
        );
        assert!(!mods_dir(&root.0).join("spy/.hidden").exists());
        // A second install stops on the taken name and changes nothing.
        assert!(install_from(&root.0, &src, &here(&src)).is_err());

        assert_eq!(remove(&root.0, "spy", None).unwrap(), "mod");
        assert!(!mods_dir(&root.0).join("spy").exists());
        assert_eq!(
            std::fs::read_dir(root.0.join("mods-removed"))
                .unwrap()
                .count(),
            1
        );
        assert_eq!(remove(&root.0, "wide", None).unwrap(), "layout");
        assert!(remove(&root.0, "wide", None).is_err());
        assert!(remove(&root.0, "../x", None).is_err());
        assert!(mods_dir(&root.0).join("keep").is_dir());

        // A lone main.js is one mod named after its folder.
        let solo = src.join("solo-mod");
        std::fs::create_dir_all(&solo).unwrap();
        std::fs::write(solo.join("main.js"), "export default () => {}").unwrap();
        assert_eq!(
            install_from(&root.0, &solo, &here(&solo)).unwrap().mods,
            vec!["solo-mod"]
        );
        assert!(install_from(&root.0, &src.join("none"), &here(&src)).is_err());
        let _ = std::fs::remove_dir_all(&src);
    }

    /// Registry-ready provenance: what `install` copied is recorded in the copy's `mod.json` (source
    /// kind, location and the SHA-256 of the files as copied), a manifest's own `id` names the
    /// folder, and a clone of an installed package is the person's own, not the published one.
    #[test]
    fn install_records_its_source_and_digest_and_a_clone_drops_them() {
        let root = Root::new();
        let src = std::env::temp_dir().join(format!("perch-provenance-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(src.join("art")).unwrap();
        std::fs::write(
            src.join("mod.json"),
            r#"{"id":"pretty-clock","publisher":"acme","version":"2.1.0","api":"^1","format":"esm"}"#,
        )
        .unwrap();
        std::fs::write(src.join("main.js"), "export default () => null;").unwrap();
        std::fs::write(src.join("art/dot.svg"), "<svg/>").unwrap();
        let before = tree_digest(&src).unwrap();
        let done = install(&root.0, src.to_str().unwrap()).unwrap();
        assert_eq!(
            done.mods,
            vec!["pretty-clock"],
            "the manifest's id, not the folder's name"
        );
        let info = scan(&root.0, &Policy::default()).remove(0);
        assert_eq!(
            (
                info.publisher.as_deref(),
                info.version.as_deref(),
                info.api.as_deref()
            ),
            (Some("acme"), Some("2.1.0"), Some("^1"))
        );
        let from = info.installed_from.unwrap();
        assert_eq!(
            (from.kind.as_str(), from.location.as_str(), from.commit),
            ("folder", src.to_str().unwrap(), None)
        );
        assert_eq!(from.digest, before, "the digest of the files as published");
        assert!(from.digest.starts_with("sha256:") && from.digest.len() == 7 + 64);
        // A same-length edit is a different digest.
        std::fs::write(src.join("art/dot.svg"), "<svG/>").unwrap();
        assert_ne!(tree_digest(&src).unwrap(), before);

        clone_example(&root.0, "pretty-clock", Some("mine")).unwrap();
        let copy = scan(&root.0, &Policy::default())
            .into_iter()
            .find(|m| m.id == "mine")
            .unwrap();
        assert_eq!(
            (copy.publisher, copy.installed_from, copy.origin.as_deref()),
            (None, None, Some("clone"))
        );
        assert_eq!(copy.cloned_from.unwrap().id, "pretty-clock");
        // A manifest id that is not a plain id is an error, not a folder name.
        std::fs::write(src.join("mod.json"), r#"{"id":"../x"}"#).unwrap();
        assert!(read_manifest(&src).is_err());
        let _ = std::fs::remove_dir_all(&src);
    }

    #[test]
    fn install_clones_a_real_repo_and_takes_one_folder_of_it() {
        let git = |dir: &Path, args: &[&str]| {
            let out = std::process::Command::new("git")
                .current_dir(dir)
                .args(["-c", "user.name=t", "-c", "user.email=t@t"])
                .args(args)
                .output()
                .unwrap();
            assert!(
                out.status.success(),
                "{args:?}: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        };
        let repo = std::env::temp_dir().join(format!("perch-repo-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(repo.join("mods/clock")).unwrap();
        std::fs::create_dir_all(repo.join("extras/solo")).unwrap();
        std::fs::write(
            repo.join("mods/clock/main.js"),
            "export default (el) => { el.textContent = 'tick' }",
        )
        .unwrap();
        std::fs::write(
            repo.join("extras/solo/main.js"),
            "export default () => fetch('/x')",
        )
        .unwrap();
        git(&repo, &["init", "-q", "-b", "main"]);
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-q", "-m", "x"]);
        let url = repo.to_str().unwrap();

        let all = Root::new();
        let done = install_from_url(&all.0, url, None, &[]).unwrap();
        assert_eq!(done.mods, vec!["clock"]);
        // The git source is recorded with the commit it held.
        let head = std::process::Command::new("git")
            .current_dir(&repo)
            .args(["rev-parse", "HEAD"])
            .output()
            .unwrap();
        let installed = scan(&all.0, &Policy::default())
            .remove(0)
            .installed_from
            .unwrap();
        assert_eq!(
            (installed.kind.as_str(), installed.location.as_str()),
            ("git", url)
        );
        assert_eq!(
            installed.commit.as_deref(),
            Some(String::from_utf8_lossy(&head.stdout).trim())
        );
        assert!(mods_dir(&all.0).join("clock/main.js").is_file());
        assert!(!mods_dir(&all.0).join("clock/.git").exists());

        let one = Root::new();
        let done =
            install_from_url(&one.0, url, Some("main"), &["extras".into(), "solo".into()]).unwrap();
        assert_eq!(done.mods, vec!["solo"]);
        assert!(
            done.warnings
                .iter()
                .any(|w| w.contains("reaches the network")),
            "{:?}",
            done.warnings
        );
        assert!(install_from_url(&one.0, url, Some("nope"), &[]).is_err());
        assert!(install_from_url(&one.0, "/no/such/repo", None, &[]).is_err());
        let _ = std::fs::remove_dir_all(&repo);
    }

    #[test]
    fn a_program_icon_is_served_from_inside_the_folder_only() {
        let root = std::env::temp_dir().join(format!("perch-icons-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("my-icons")).unwrap();
        std::fs::write(root.join("my-icons/a.svg"), "<svg/>").unwrap();
        std::fs::write(root.join("secret.txt"), "x").unwrap();
        let on = Policy { off: false };
        let (bytes, kind) = icon(&root, &on, "my-icons/a.svg").unwrap();
        assert_eq!((bytes.as_slice(), kind), (&b"<svg/>"[..], "image/svg+xml"));
        assert!(icon(&root, &on, "../x.svg").is_err());
        assert!(icon(&root, &on, "/etc/hosts.png").is_err());
        assert!(icon(&root, &on, "secret.txt").is_err()); // not an image
        assert!(icon(&root, &Policy { off: true }, "my-icons/a.svg").is_err());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(root.join("secret.txt"), root.join("my-icons/link.png"))
                .unwrap();
            assert!(icon(&root, &on, "my-icons/link.png").is_ok()); // inside the folder: fine
            let outside =
                std::env::temp_dir().join(format!("perch-outside-{}.png", uuid::Uuid::new_v4()));
            std::fs::write(&outside, "x").unwrap();
            std::os::unix::fs::symlink(&outside, root.join("my-icons/out.png")).unwrap();
            assert!(icon(&root, &on, "my-icons/out.png").is_err()); // a link out is refused
            let _ = std::fs::remove_file(outside);
        }
        std::fs::write(root.join("my-icons/ding.mp3"), "ID3").unwrap();
        assert_eq!(
            sound(&root, &on, "my-icons/ding.mp3").unwrap().1,
            "audio/mpeg"
        );
        assert!(sound(&root, &on, "my-icons/a.svg").is_err()); // an image is not a sound
        assert!(icon(&root, &on, "my-icons/ding.mp3").is_err());
        assert!(sound(&root, &on, "../ding.mp3").is_err());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn keys_and_programs_files_are_read_checked_and_reported() {
        let root = std::env::temp_dir().join(format!("perch-user-files-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let on = Policy { off: false };
        assert_eq!(scan_user_files(&root, &on), UserFiles::default());
        std::fs::write(
            root.join("keys.json"),
            r#"{"global":{"ctrl-shift-t":"tab.new"},"layout:terminals":{},"mod:editor":{"ctrl-s":"editor.save"}}"#,
        )
        .unwrap();
        std::fs::write(
            root.join("programs.json"),
            r#"{"programs":{"mytool":{"name":"My Tool","tint":true,"match":["mytool-dev"],"run":["mytool"]}},"shells":["xonsh"]}"#,
        )
        .unwrap();
        let files = scan_user_files(&root, &on);
        assert!(files.keys.is_some() && files.keys_error.is_none());
        assert!(files.programs.is_some() && files.programs_error.is_none());
        // An unknown section, a wrong field type and broken JSON are reported, not applied.
        std::fs::write(root.join("keys.json"), r#"{"sidebar":{}}"#).unwrap();
        std::fs::write(
            root.join("programs.json"),
            r#"{"programs":{"a":{"run":"a"}}}"#,
        )
        .unwrap();
        let files = scan_user_files(&root, &on);
        assert!(files.keys.is_none() && files.keys_error.unwrap().contains("sidebar"));
        assert!(
            files.programs.is_none() && files.programs_error.unwrap().contains("programs.a.run")
        );
        std::fs::write(root.join("keys.json"), "{").unwrap();
        assert!(scan_user_files(&root, &on).keys_error.is_some());
        assert_eq!(
            scan_user_files(&root, &Policy { off: true }),
            UserFiles::default()
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn other_git_hosts_must_be_public_https_and_a_local_folder_installs() {
        for ok in ["https://gitlab.com/o/r.git", "https://codeberg.org/o/r"] {
            assert!(
                public_git_url(ok.split('#').next().unwrap()).is_ok(),
                "{ok}"
            );
        }
        for bad in [
            "http://gitlab.com/o/r",
            "https://localhost/o/r",
            "https://127.0.0.1/o/r",
            "https://10.0.0.5/o/r",
            "https://printer.local/o/r",
            "https://user@gitlab.com/o/r",
            "https://gitlab.com:8080/o/r",
            "https://gitlab.com/o/../r",
            "https://gitlab.com/-o/r",
            "https://gitlab.com",
        ] {
            assert!(public_git_url(bad).is_err(), "{bad}");
        }
        let root = Root::new();
        let from = std::env::temp_dir().join(format!("perch-local-src-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&from).unwrap();
        std::fs::write(from.join("main.js"), "export default () => {}").unwrap();
        let done = install(&root.0, from.to_str().unwrap()).unwrap();
        assert_eq!(done.mods.len(), 1);
        assert!(install(&root.0, "https://localhost/o/r").is_err());
        let _ = std::fs::remove_dir_all(&from);
    }

    #[test]
    fn github_sources_are_checked_before_git_runs() {
        assert_eq!(github_source("o/r").unwrap(), ("o/r".into(), None, vec![]));
        assert_eq!(
            github_source("https://github.com/o/r.git/").unwrap().0,
            "o/r"
        );
        let (repo, branch, sub) = github_source("https://github.com/o/r/tree/main/mods/x").unwrap();
        assert_eq!(
            (repo.as_str(), branch.as_deref(), sub),
            (
                "o/r",
                Some("main"),
                vec!["mods".to_string(), "x".to_string()]
            )
        );
        for bad in [
            "",
            "o",
            "o/../x",
            "http://evil.test/o/r",
            "o/r/..",
            "-o/r;rm",
            "o r/x",
        ] {
            assert!(github_source(bad).is_err(), "{bad}");
        }
    }

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("perch-mods-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(mods_dir(&root)).unwrap();
            Self(root)
        }
        fn put(&self, id: &str, file: &str, text: &str) {
            let dir = mods_dir(&self.0).join(id);
            std::fs::create_dir_all(dir.join(file).parent().unwrap()).unwrap();
            std::fs::write(dir.join(file), text).unwrap();
        }
    }
    impl Drop for Root {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn a_folder_with_main_js_loads_at_once_and_a_bad_one_never_breaks_the_rest() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("board", "main.js", "export default () => {}");
        root.put("board", "mod.json", r#"{"name":"Board","place":"overlay"}"#);
        root.put("plain", "main.js", "export default () => {}");
        root.put("nojs", "readme.txt", "x");
        root.put("badjson", "mod.json", "{");
        root.put("badjson", "main.js", "");
        root.put("away", "mod.json", r#"{"entry":"../x.js"}"#);
        let found = scan(&root.0, &policy);
        let by = |id: &str| found.iter().find(|m| m.id == id).unwrap();
        assert_eq!(
            (by("board").name.as_str(), by("board").place),
            ("Board", Place::Overlay)
        );
        assert!(by("board").enabled && by("board").error.is_none());
        assert_eq!(
            (by("plain").name.as_str(), by("plain").place),
            ("plain", Place::Dock)
        );
        for broken in ["nojs", "badjson", "away"] {
            assert!(
                by(broken).error.is_some() && !by(broken).enabled,
                "{broken}"
            );
        }
        assert!(
            source(&root.0, &policy, "away").is_err() && source(&root.0, &policy, "nojs").is_err()
        );
    }

    #[test]
    fn turning_off_stops_serving_and_an_edit_changes_the_revision() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("m", "main.js", "export default () => 1");
        let before = scan(&root.0, &policy)[0].revision.clone();
        assert_eq!(
            source(&root.0, &policy, "m").unwrap(),
            "export default () => 1"
        );
        set_enabled(&root.0, &policy, "m", false).unwrap();
        assert!(!scan(&root.0, &policy)[0].enabled);
        assert!(source(&root.0, &policy, "m").is_err());
        set_enabled(&root.0, &policy, "m", true).unwrap();
        root.put("m", "main.js", "export default () => 22222");
        assert_ne!(scan(&root.0, &policy)[0].revision, before);
        assert!(set_enabled(&root.0, &policy, "nope", false).is_err());
    }

    const PACKAGE: &str = r#"{"name":"Pkg","format":"esm","api":"^1"}"#;

    #[test]
    fn a_package_revision_is_its_content_and_its_reads_stay_on_that_revision() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("pkg", "mod.json", PACKAGE);
        root.put("pkg", "main.js", "import './ui/a.js'");
        root.put("pkg", "ui/a.js", "export const a = 1");
        root.put("pkg", "ui/look.css", "a{}");
        root.put("pkg", "README.md", "not served");
        let first = scan(&root.0, &policy).remove(0);
        assert_eq!(first.error, None);
        assert_eq!(
            (first.format.as_deref(), first.api.as_deref()),
            (Some("esm"), Some("^1"))
        );
        assert_eq!(first.entry.as_deref(), Some("main.js"));
        assert_eq!(
            first.files,
            ["main.js", "mod.json", "ui/a.js", "ui/look.css"]
        );
        assert_eq!(first.revision.len(), 64, "a full SHA-256");
        // A scan with nothing changed reuses the digest.
        assert_eq!(scan(&root.0, &policy)[0].revision, first.revision);
        let read = |rev: &str, path: &str| package_file(&root.0, &policy, "pkg", rev, path);
        let (bytes, kind) = read(&first.revision, "ui/a.js").unwrap();
        assert_eq!(
            (&*bytes, kind),
            (&b"export const a = 1"[..], "text/javascript; charset=utf-8")
        );

        // The same length, with the modified time put back: still a new revision.
        let file = mods_dir(&root.0).join("pkg/ui/a.js");
        let modified = std::fs::metadata(&file).unwrap().modified().unwrap();
        std::fs::write(&file, "export const a = 2").unwrap();
        std::fs::File::options()
            .write(true)
            .open(&file)
            .unwrap()
            .set_modified(modified)
            .unwrap();
        assert_eq!(
            std::fs::metadata(&file).unwrap().modified().unwrap(),
            modified
        );
        let second = scan(&root.0, &policy).remove(0);
        assert_ne!(second.revision, first.revision);
        // Each revision reads its own bytes: no fallback to the disk now.
        assert_eq!(
            &*read(&first.revision, "ui/a.js").unwrap().0,
            b"export const a = 1"
        );
        assert_eq!(
            &*read(&second.revision, "ui/a.js").unwrap().0,
            b"export const a = 2"
        );

        // Only listed, well-formed paths; nothing beside or above the package.
        std::fs::write(root.0.join("secret.js"), "stolen").unwrap();
        for bad in [
            "../secret.js",
            "ui/../main.js",
            "./main.js",
            "ui//a.js",
            "/main.js",
            "ui\\a.js",
            "%2e%2e/secret.js",
            "Main.js",
            "README.md",
            "main.js\0",
            "",
        ] {
            assert!(
                matches!(read(&second.revision, bad), Err(Error::NotFound(_))),
                "{bad:?}"
            );
        }
        // An unknown revision, and one pushed out by newer ones, are gone.
        assert!(matches!(read("feed", "main.js"), Err(Error::Gone(_))));
        for n in 0..RETAINED_SNAPSHOTS {
            root.put("pkg", "ui/a.js", &format!("export const a = {}", n + 10));
            scan(&root.0, &policy);
        }
        assert!(matches!(
            read(&first.revision, "main.js"),
            Err(Error::Gone(_))
        ));
        let now = scan(&root.0, &policy).remove(0).revision;
        assert!(read(&now, "main.js").is_ok());

        // Off is refused: one mod, or all of them.
        set_enabled(&root.0, &policy, "pkg", false).unwrap();
        assert!(matches!(read(&now, "main.js"), Err(Error::Off(_))));
        set_enabled(&root.0, &policy, "pkg", true).unwrap();
        assert!(matches!(
            package_file(&root.0, &Policy { off: true }, "pkg", &now, "main.js"),
            Err(Error::Off(_))
        ));
        // A package is never served as a single legacy file.
        assert!(source(&root.0, &policy, "pkg").is_err());
    }

    #[test]
    fn a_package_with_a_link_or_a_bad_format_is_refused_whole() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("weird", "mod.json", r#"{"format":"cjs"}"#);
        root.put("weird", "main.js", "x");
        #[cfg(unix)]
        {
            root.put("linked", "mod.json", PACKAGE);
            root.put("linked", "main.js", "x");
            std::fs::write(root.0.join("secret.js"), "stolen").unwrap();
            std::os::unix::fs::symlink(
                root.0.join("secret.js"),
                mods_dir(&root.0).join("linked/leak.js"),
            )
            .unwrap();
        }
        for info in scan(&root.0, &policy) {
            assert!(info.error.is_some() && !info.enabled, "{info:?}");
            assert!(info.files.is_empty(), "{info:?}");
        }
    }

    #[test]
    fn a_legacy_mod_keeps_the_old_wire_shape_and_a_package_carries_its_fields() {
        let root = Root::new();
        root.put("old", "main.js", "export default () => {}");
        root.put("pkg", "mod.json", PACKAGE);
        root.put("pkg", "main.js", "x");
        let found = scan(&root.0, &Policy::default());
        let old = serde_json::to_value(&found[0]).unwrap();
        let keys: Vec<&str> = old
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(
            keys,
            [
                "description",
                "enabled",
                "error",
                "fonts",
                "id",
                "name",
                "place",
                "revision"
            ]
        );
        let pkg = serde_json::to_value(&found[1]).unwrap();
        for key in ["format", "api", "entry", "files"] {
            assert!(pkg.get(key).is_some(), "{key}: {pkg}");
        }
        // An old peer's ModInfo still parses.
        let back: ModInfo = serde_json::from_value(old).unwrap();
        assert_eq!(back, found[0]);
    }

    #[test]
    fn a_cloned_package_is_whole_new_and_says_where_it_came_from() {
        let root = Root::new();
        let policy = Policy::default();
        root.put("pkg", "mod.json", PACKAGE);
        root.put("pkg", "main.js", "x");
        // Past the 300-file install cap: a package copies whole.
        for n in 0..320 {
            root.put("pkg", &format!("parts/p{n}.js"), "export default 1");
        }
        let source = scan(&root.0, &policy).remove(0);
        assert_eq!(clone_example(&root.0, "pkg", Some("mine")).unwrap(), "mine");
        let copy = scan(&root.0, &policy)
            .into_iter()
            .find(|m| m.id == "mine")
            .unwrap();
        assert_eq!(copy.error, None);
        assert_eq!(copy.files.len(), source.files.len());
        assert_eq!(copy.origin.as_deref(), Some("clone"));
        assert_eq!(
            copy.cloned_from,
            Some(ClonedFrom {
                id: "pkg".into(),
                revision: source.revision.clone(),
                version: None,
            })
        );
        assert_eq!(copy.format.as_deref(), Some("esm"));
        // Never over an existing mod, never as a shipped example, and nothing half-made is left.
        assert!(clone_example(&root.0, "pkg", Some("mine")).is_err());
        assert!(clone_example(&root.0, "pkg", Some("command-list")).is_err());
        assert!(clone_example(&root.0, "pkg", Some("pkg")).is_err());
        let names: Vec<_> = std::fs::read_dir(mods_dir(&root.0))
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        assert!(names.iter().all(|n| !n.starts_with('.')), "{names:?}");
    }

    /// The revision `export-stock-ui.mjs` computes for the same files (its test pins the same value),
    /// so a stock package the web build wrote is the revision this core lists.
    const SHARED_DIGEST_FILES: [(&str, &str); 2] =
        [("main.js", "export default 1;\n"), ("mod.json", "{}\n")];
    const SHARED_DIGEST: &str = "5b7477fe52e6579f4473624a6d7a7c385e63f84b8273af9986dd2fceec6db433";

    /// A web build's stock folder with one screen, `demo`, and its catalog.
    fn stock_build(root: &Root, revision: Option<&str>) -> PathBuf {
        let dir = root.0.join("web").join("stock-ui");
        let package = dir.join("demo");
        std::fs::create_dir_all(package.join("parts")).unwrap();
        std::fs::write(
            package.join("mod.json"),
            r#"{"name":"Demo","format":"esm","api":"^1","version":"1.0.0","place":"layout","origin":"stock"}"#,
        )
        .unwrap();
        std::fs::write(
            package.join("main.js"),
            "export { default } from \"./parts/view.js\";",
        )
        .unwrap();
        std::fs::write(package.join("parts/view.js"), "export default () => null;").unwrap();
        std::fs::write(
            package.join("perch-sdk.d.ts"),
            "declare module \"@perch/sdk\" {}",
        )
        .unwrap();
        let revision = revision.map_or_else(|| package_digest(&package), String::from);
        std::fs::write(
            dir.join("catalog.json"),
            format!(r#"{{"packages":[{{"id":"demo","revision":"{revision}"}},{{"id":"../up","revision":"x"}}]}}"#),
        )
        .unwrap();
        dir
    }

    fn package_digest(dir: &Path) -> String {
        package(dir).unwrap().revision.clone()
    }

    #[test]
    fn a_package_digest_is_the_one_the_web_exporter_computes() {
        let root = Root::new();
        let dir = root.0.join("digest");
        std::fs::create_dir_all(&dir).unwrap();
        for (name, text) in SHARED_DIGEST_FILES {
            std::fs::write(dir.join(name), text).unwrap();
        }
        assert_eq!(package_digest(&dir), SHARED_DIGEST);
    }

    #[test]
    fn stock_screens_list_as_their_own_namespace_and_clone_into_a_new_id() {
        let root = Root::new();
        let stock_dir = stock_build(&root, None);
        let listed = stock(&stock_dir);
        assert_eq!(listed.len(), 1, "a catalog id that is not plain is skipped");
        let demo = &listed[0];
        assert_eq!(demo.id, "stock:demo");
        assert_eq!((demo.error.as_deref(), demo.enabled), (None, true));
        assert_eq!(demo.place, Place::Layout);
        assert_eq!(demo.origin.as_deref(), Some("stock"));
        assert_eq!(demo.version.as_deref(), Some("1.0.0"));
        assert_eq!(demo.files, ["main.js", "mod.json", "parts/view.js"]);
        // Stock is Perch as shipped: listed with mods off, and never served from the mods folder.
        root.put("demo", "main.js", "export default 'user';");
        assert!(scan(&root.0, &Policy { off: true }).is_empty());
        assert!(package_file(
            &root.0,
            &Policy::default(),
            "stock:demo",
            &demo.revision,
            "main.js"
        )
        .is_err());

        let made = clone_stock(&root.0, &stock_dir, "stock:demo", None).unwrap();
        assert_eq!(made, "demo-copy");
        let copy = scan(&root.0, &Policy::default())
            .into_iter()
            .find(|m| m.id == "demo-copy")
            .unwrap();
        assert_eq!(copy.error, None);
        assert_eq!(
            copy.place,
            Place::Layout,
            "a clone is never docked or run hidden either"
        );
        assert_eq!(copy.origin.as_deref(), Some("clone"));
        assert_eq!(copy.api.as_deref(), Some("^1"));
        assert_eq!(
            copy.cloned_from,
            Some(ClonedFrom {
                id: "stock:demo".into(),
                revision: demo.revision.clone(),
                version: Some("1.0.0".into()),
            })
        );
        let copied = mods_dir(&root.0).join("demo-copy");
        assert!(
            copied.join("perch-sdk.d.ts").is_file(),
            "the SDK types travel with the copy"
        );
        assert_eq!(
            std::fs::read_to_string(copied.join("parts/view.js")).unwrap(),
            "export default () => null;"
        );
        // Never over a taken id, never as a stock or example id, and stock is left as it was.
        for taken in ["demo-copy", "stock:mine", "command-list", "a/b"] {
            assert!(
                clone_stock(&root.0, &stock_dir, "stock:demo", Some(taken)).is_err(),
                "{taken}"
            );
        }
        assert!(clone_stock(&root.0, &stock_dir, "stock:nope", Some("x")).is_err());
        assert_eq!(stock(&stock_dir)[0].revision, demo.revision);
        // A copy edited in place changes, stock does not.
        std::fs::write(copied.join("parts/view.js"), "export default () => 'mine';").unwrap();
        let edited = scan(&root.0, &Policy::default())
            .into_iter()
            .find(|m| m.id == "demo-copy")
            .unwrap();
        assert_ne!(edited.revision, copy.revision);
        assert_eq!(stock(&stock_dir)[0].revision, demo.revision);
    }

    #[test]
    fn a_stock_build_that_drifted_from_its_catalog_is_listed_broken_and_not_copied() {
        let root = Root::new();
        let stock_dir = stock_build(&root, Some("0000"));
        let demo = stock(&stock_dir).remove(0);
        assert!(
            demo.error
                .as_deref()
                .is_some_and(|e| e.contains("catalog.json")),
            "{demo:?}"
        );
        assert!(!demo.enabled);
        assert!(clone_stock(&root.0, &stock_dir, "stock:demo", Some("x")).is_err());
        assert!(!mods_dir(&root.0).join("x").exists());
        // No web build is no stock screens.
        assert!(stock(&root.0.join("nowhere")).is_empty());
    }

    #[test]
    fn off_finds_and_serves_nothing_and_a_symlink_cannot_leave_the_folder() {
        let root = Root::new();
        root.put("m", "main.js", "x");
        let off = Policy { off: true };
        assert!(scan(&root.0, &off).is_empty());
        assert!(source(&root.0, &off, "m").is_err());
        #[cfg(unix)]
        {
            let secret = root.0.join("secret.js");
            std::fs::write(&secret, "stolen").unwrap();
            let link = mods_dir(&root.0).join("m").join("link.js");
            std::os::unix::fs::symlink(&secret, &link).unwrap();
            root.put("m", "mod.json", r#"{"entry":"link.js"}"#);
            assert!(source(&root.0, &Policy::default(), "m").is_err());
        }
    }
}
