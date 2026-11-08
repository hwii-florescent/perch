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
                    id,
                },
                Err(error) => ModInfo {
                    enabled: false,
                    name: id.clone(),
                    description: String::new(),
                    place: Place::None,
                    revision: String::new(),
                    error: Some(error.to_string()),
                    id,
                },
            }
        })
        .collect()
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

/// `perch mod clone <example> [as <id>]`: copies a shipped example into the mods or layouts folder
/// as `new_id` (default: its own name) and returns that id. Never overwrites: an id in use is refused.
pub fn clone_example(root: &Path, example: &str, new_id: Option<&str>) -> Result<String, Error> {
    let found = EXAMPLES.iter().find(|e| e.id == example).ok_or_else(|| {
        Error::NotFound(format!(
            "no example \"{example}\" (try: {})",
            EXAMPLES.iter().map(|e| e.id).collect::<Vec<_>>().join(", ")
        ))
    })?;
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

    struct Root(PathBuf);
    impl Root {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("perch-mods-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(mods_dir(&root)).unwrap();
            Self(root)
        }
        fn put(&self, id: &str, file: &str, text: &str) {
            let dir = mods_dir(&self.0).join(id);
            std::fs::create_dir_all(&dir).unwrap();
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
