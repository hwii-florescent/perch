//! Mods, as in herdr's desktop app: a folder `<root>/mods/<id>/` with a `main.js` that Perch's own
//! page imports and runs with the person's full access. There is no approval and no sandbox: a mod
//! is trusted code, like a shell script you wrote, and an edit applies at once (the web reloads it
//! when [`ModInfo::revision`] changes). `mod.json` is optional: `{"name", "description", "place":
//! "dock"|"overlay"|"none", "entry": "main.js"}`.
//!
//! What stays safe is stock Perch: a mod that fails to load never replaces a working one, a mod can
//! be turned off from Settings or `perch mod disable`, and `PERCH_MODS=off` (or the Settings
//! switch) loads none, so Perch starts even when a mod breaks the page. State is `mod-state.json`
//! beside `mods/`. Only [`source`] reads a mod's code, from inside its own folder.
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

const MAX_BYTES: u64 = 2 * 1024 * 1024;
const STATE: &str = "mod-state.json";

#[derive(Debug)]
pub enum Error {
    Invalid(String),
    NotFound(String),
    Io(std::io::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(text) | Self::NotFound(text) => f.write_str(text),
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
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct Manifest {
    name: String,
    description: String,
    place: Place,
    entry: Option<String>,
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
        && path.extension().is_some_and(|e| e == "js")
    {
        Ok(entry)
    } else {
        Err(Error::Invalid(
            "entry must be a relative .js path inside the mod".into(),
        ))
    }
}

fn read_manifest(dir: &Path) -> Result<Manifest, Error> {
    match std::fs::read_to_string(dir.join("mod.json")) {
        Ok(text) => serde_json::from_str(&text)
            .map_err(|error| Error::Invalid(format!("mod.json is not valid: {error}"))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Manifest::default()),
        Err(error) => Err(error.into()),
    }
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
            let dir = mods_dir(root).join(&id);
            let loaded = read_manifest(&dir).and_then(|m| {
                let entry = entry_of(&m)?.to_string();
                if dir.join(&entry).is_file() {
                    Ok((m, entry))
                } else {
                    Err(Error::Invalid(format!("{entry} is missing")))
                }
            });
            let revision = |entry: &str| {
                let sum = format!(
                    "{}{}",
                    stamp(&dir.join("mod.json")),
                    stamp(&dir.join(entry))
                );
                sum.bytes().fold(0xcbf29ce484222325u64, |h, b| {
                    (h ^ u64::from(b)).wrapping_mul(0x100000001b3)
                })
            };
            match loaded {
                Ok((m, entry)) => ModInfo {
                    enabled: !off.contains(&id),
                    name: if m.name.is_empty() {
                        id.clone()
                    } else {
                        m.name
                    },
                    description: m.description,
                    place: m.place,
                    revision: format!("{:x}", revision(&entry)),
                    error: None,
                    fonts: fonts_of(&dir),
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
                    id,
                },
            }
        })
        .collect()
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

fn copy_tree(from: &Path, to: &Path, files: &mut usize, bytes: &mut u64) -> Result<(), Error> {
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
            copy_tree(&entry.path(), &to.join(&name), files, bytes)?;
        } else {
            *files += 1;
            *bytes += entry.metadata()?.len();
            if *files > MAX_INSTALL_FILES || *bytes > MAX_INSTALL_BYTES {
                return Err(Error::Invalid(format!(
                    "too big to install: at most {MAX_INSTALL_FILES} files and 8 MiB"
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
        return install_from(root, &path, source);
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
        return install_from_url(root, url, branch, &[], url.trim_start_matches("https://"));
    }
    let (repo, branch, sub) = github_source(source)?;
    install_from_url(
        root,
        &format!("https://github.com/{repo}.git"),
        branch.as_deref(),
        &sub,
        &repo,
    )
}

/// `install` for any git URL or path; the source has already been checked.
fn install_from_url(
    root: &Path,
    url: &str,
    branch: Option<&str>,
    sub: &[String],
    repo: &str,
) -> Result<Installed, Error> {
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
        install_from(
            root,
            &sub.iter().fold(work.clone(), |dir, s| dir.join(s)),
            repo,
        )
    })();
    let _ = std::fs::remove_dir_all(&work);
    result
}

/// The copy half of `install`, from a folder already on disk.
pub fn install_from(root: &Path, top: &Path, name_hint: &str) -> Result<Installed, Error> {
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
            found.push((id, entry.path(), false));
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
        found.push((id, top.to_path_buf(), false));
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
    for (id, from, is_layout) in found {
        if is_layout {
            std::fs::create_dir_all(root.join("layouts"))?;
            std::fs::copy(&from, root.join("layouts").join(format!("{id}.json")))?;
            done.layouts.push(id);
        } else {
            let to = mods_dir(root).join(&id);
            copy_tree(&from, &to, &mut files, &mut bytes)?;
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
/// `new_id` (default `<id>-copy`), yours to edit, and nothing is overwritten.
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
    if mod_dir.is_dir() {
        copy_tree(&mod_dir, &to, &mut 0, &mut 0)?;
    } else {
        std::fs::copy(&layout, &to)?;
    }
    Ok(Some(copy))
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

        let done = install_from(&root.0, &src, "o/r").unwrap();
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
        assert!(install_from(&root.0, &src, "o/r").is_err());

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
            install_from(&root.0, &solo, "o/r").unwrap().mods,
            vec!["solo-mod"]
        );
        assert!(install_from(&root.0, &src.join("none"), "o/r").is_err());
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
        let done = install_from_url(&all.0, url, None, &[], "o/r").unwrap();
        assert_eq!(done.mods, vec!["clock"]);
        assert!(mods_dir(&all.0).join("clock/main.js").is_file());
        assert!(!mods_dir(&all.0).join("clock/.git").exists());

        let one = Root::new();
        let done = install_from_url(
            &one.0,
            url,
            Some("main"),
            &["extras".into(), "solo".into()],
            "o/r",
        )
        .unwrap();
        assert_eq!(done.mods, vec!["solo"]);
        assert!(
            done.warnings
                .iter()
                .any(|w| w.contains("reaches the network")),
            "{:?}",
            done.warnings
        );
        assert!(install_from_url(&one.0, url, Some("nope"), &[], "o/r").is_err());
        assert!(install_from_url(&one.0, "/no/such/repo", None, &[], "o/r").is_err());
        let _ = std::fs::remove_dir_all(&repo);
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
