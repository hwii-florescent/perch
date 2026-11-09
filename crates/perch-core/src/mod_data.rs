//! A mod's durable data (herdr's per-mod app-home files): small JSON values by key that a mod keeps
//! across reloads, restarts and edits of its code. The page reaches it through `POST mods/data`
//! (`server::mods::data`) and `@perch/sdk`'s `useModData` / a legacy mod's `api.data`.
//!
//! **Where.** `<root>/mod-data/<id>/<key>.json`, beside `mods/`, never inside a mod's folder: a
//! clone (`perch mod clone`) copies the source package and nothing of this, and removing a mod
//! leaves its data. A stock screen's data is under `@stock-<name>` (`@` is not in a plain id, so no
//! mod can take that folder).
//!
//! **Rules.** An id is a plain mod id or `stock:<name>`; a key is 1 to 120 of letters, digits, `.`,
//! `-` and `_`, not starting with `.`; so a key or an id never names a path outside its folder. A
//! value is any JSON up to [`MAX_VALUE_BYTES`]; a mod keeps at most [`MAX_KEYS`]. A file that is not
//! a plain file (a symlink, a folder) is refused, never followed.
//!
//! **Revisions and writers.** A value's revision is the SHA-256 of its stored bytes. A write or a
//! delete may name the revision it expects (or that the key must not exist); a different one is a
//! [`Error::Conflict`] and nothing changes. Writes go to a temporary file renamed over the old one,
//! under one lock, so two writers never interleave and a reader sees the old value or the new one.
//!
//! **Corruption.** A file that is not JSON (edited by hand, cut short by a full disk) reads as
//! [`Value::Corrupt`] with its revision, never as missing: only a write naming that revision
//! replaces it, and the bad bytes are first copied to `.corrupt/<key>-<millis>.json`.
use serde_json::Value as Json;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The largest value, as stored JSON.
pub const MAX_VALUE_BYTES: usize = 1024 * 1024;
/// The most keys one mod keeps.
pub const MAX_KEYS: usize = 1000;
const MAX_KEY_LEN: usize = 120;
const DIR: &str = "mod-data";
const CORRUPT_DIR: &str = ".corrupt";
/// One writer at a time, across every mod (writes are small and rare).
static WRITES: Mutex<()> = Mutex::new(());

#[derive(Debug)]
pub enum Error {
    Invalid(String),
    /// The key holds another revision than the caller expected (`None`: it does not exist).
    Conflict(Option<String>),
    Io(std::io::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(text) => f.write_str(text),
            Self::Conflict(_) => f.write_str("the value changed since it was read"),
            Self::Io(error) => write!(f, "Perch could not use the mod's data folder: {error}"),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// What a write or delete expects the key to hold now.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Expect {
    Anything,
    Absent,
    Revision(String),
}

impl Expect {
    /// From a request body's `expected`: absent is anything, `null` is absent, a string a revision.
    pub fn from_body(body: &Json) -> Result<Self, Error> {
        match body.get("expected") {
            None => Ok(Self::Anything),
            Some(Json::Null) => Ok(Self::Absent),
            Some(Json::String(revision)) => Ok(Self::Revision(revision.clone())),
            Some(_) => Err(Error::Invalid(
                "expected is a revision, or null for a key that must not exist".into(),
            )),
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum Value {
    Missing,
    Found { value: Json, revision: String },
    Corrupt { revision: String, error: String },
}

/// The data folder of `id` (a plain mod id or `stock:<name>`), or why `id` names none.
pub fn folder(root: &Path, id: &str) -> Result<PathBuf, Error> {
    let name = match id.strip_prefix(crate::mods::STOCK_PREFIX) {
        Some(stock) if crate::mods::plain_id(stock) => format!("@stock-{stock}"),
        None if crate::mods::plain_id(id) => id.to_string(),
        _ => {
            return Err(Error::Invalid(
                "a mod id is letters, digits, - and _ (or stock:<name>)".into(),
            ))
        }
    };
    Ok(root.join(DIR).join(name))
}

pub fn key_ok(key: &str) -> bool {
    (1..=MAX_KEY_LEN).contains(&key.len())
        && !key.starts_with('.')
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn file(dir: &Path, key: &str) -> Result<PathBuf, Error> {
    if !key_ok(key) {
        return Err(Error::Invalid(format!(
            "a key is 1 to {MAX_KEY_LEN} letters, digits, ., - and _, not starting with ."
        )));
    }
    Ok(dir.join(format!("{key}.json")))
}

fn revision(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// The folder itself must be a real folder (or not exist yet); a symlink there is refused.
fn check_folder(dir: &Path) -> Result<bool, Error> {
    match std::fs::symlink_metadata(dir) {
        Ok(meta) if meta.is_dir() => Ok(true),
        Ok(_) => Err(Error::Invalid(format!(
            "{} is not a plain folder",
            dir.display()
        ))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

/// The stored bytes of a key, `None` when it has none; a symlink or folder in its place is refused.
fn stored(path: &Path) -> Result<Option<Vec<u8>>, Error> {
    match std::fs::symlink_metadata(path) {
        Ok(meta) if meta.is_file() => {
            if meta.len() > (MAX_VALUE_BYTES as u64) * 2 {
                return Err(Error::Invalid(format!(
                    "{} is larger than a value may be",
                    path.display()
                )));
            }
            Ok(Some(std::fs::read(path)?))
        }
        Ok(_) => Err(Error::Invalid(format!(
            "{} is not a plain file",
            path.display()
        ))),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub fn read(dir: &Path, key: &str) -> Result<Value, Error> {
    let path = file(dir, key)?;
    if !check_folder(dir)? {
        return Ok(Value::Missing);
    }
    Ok(match stored(&path)? {
        None => Value::Missing,
        Some(bytes) => match serde_json::from_slice(&bytes) {
            Ok(value) => Value::Found {
                value,
                revision: revision(&bytes),
            },
            Err(error) => Value::Corrupt {
                revision: revision(&bytes),
                error: format!("{key} is not valid JSON ({error}); write it again to replace it"),
            },
        },
    })
}

fn check(expect: &Expect, now: Option<&str>) -> Result<(), Error> {
    let ok = match expect {
        Expect::Anything => true,
        Expect::Absent => now.is_none(),
        Expect::Revision(want) => now == Some(want.as_str()),
    };
    if ok {
        Ok(())
    } else {
        Err(Error::Conflict(now.map(str::to_string)))
    }
}

fn millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis())
}

/// Keeps a corrupt value's bytes before it is replaced or deleted.
fn keep_corrupt(dir: &Path, key: &str, bytes: &[u8]) -> Result<(), Error> {
    if serde_json::from_slice::<Json>(bytes).is_ok() {
        return Ok(());
    }
    let aside = dir.join(CORRUPT_DIR);
    std::fs::create_dir_all(&aside)?;
    std::fs::write(aside.join(format!("{key}-{}.json", millis())), bytes)?;
    Ok(())
}

/// Stores `value` under `key` if the key holds what `expect` says; returns the new revision.
pub fn write(dir: &Path, key: &str, value: &Json, expect: &Expect) -> Result<String, Error> {
    let path = file(dir, key)?;
    let bytes = serde_json::to_vec(value).map_err(|e| Error::Invalid(e.to_string()))?;
    if bytes.len() > MAX_VALUE_BYTES {
        return Err(Error::Invalid(format!(
            "a value is at most {} KiB as JSON",
            MAX_VALUE_BYTES / 1024
        )));
    }
    let _one = WRITES
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let exists = check_folder(dir)?;
    let before = if exists { stored(&path)? } else { None };
    check(expect, before.as_deref().map(revision).as_deref())?;
    if before.is_none() && exists && list(dir)?.len() >= MAX_KEYS {
        return Err(Error::Invalid(format!(
            "a mod keeps at most {MAX_KEYS} keys; delete some first"
        )));
    }
    std::fs::create_dir_all(dir)?;
    if let Some(old) = &before {
        keep_corrupt(dir, key, old)?;
    }
    let temporary = dir.join(format!(".write-{key}-{}-{}", std::process::id(), millis()));
    {
        use std::io::Write;
        let mut out = std::fs::File::create(&temporary)?;
        out.write_all(&bytes)?;
        out.sync_all()?;
    }
    if let Err(error) = std::fs::rename(&temporary, &path) {
        let _ = std::fs::remove_file(&temporary);
        return Err(error.into());
    }
    Ok(revision(&bytes))
}

/// Deletes `key` if it holds what `expect` says; false when there was nothing to delete.
pub fn delete(dir: &Path, key: &str, expect: &Expect) -> Result<bool, Error> {
    let path = file(dir, key)?;
    let _one = WRITES
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if !check_folder(dir)? {
        check(expect, None)?;
        return Ok(false);
    }
    let before = stored(&path)?;
    check(expect, before.as_deref().map(revision).as_deref())?;
    let Some(old) = before else { return Ok(false) };
    keep_corrupt(dir, key, &old)?;
    std::fs::remove_file(&path)?;
    Ok(true)
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct Entry {
    pub key: String,
    pub revision: String,
    pub size: u64,
}

/// Every key the mod keeps, sorted, with its revision (plain files only).
pub fn list(dir: &Path) -> Result<Vec<Entry>, Error> {
    if !check_folder(dir)? {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for item in std::fs::read_dir(dir)? {
        let item = item?;
        let name = item.file_name();
        let Some(key) = name.to_str().and_then(|n| n.strip_suffix(".json")) else {
            continue;
        };
        if !key_ok(key) || !item.file_type()?.is_file() {
            continue;
        }
        let Ok(Some(bytes)) = stored(&item.path()) else {
            continue;
        };
        entries.push(Entry {
            key: key.to_string(),
            revision: revision(&bytes),
            size: bytes.len() as u64,
        });
    }
    entries.sort_by(|a, b| a.key.cmp(&b.key));
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("perch-mod-data-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn values_survive_keep_their_revision_and_conflict_on_a_stale_one() {
        let root = root();
        let dir = folder(&root, "notes").unwrap();
        assert_eq!(read(&dir, "a").unwrap(), Value::Missing);
        let first = write(&dir, "a", &json!({"n": 1}), &Expect::Absent).unwrap();
        let Value::Found { value, revision } = read(&dir, "a").unwrap() else {
            panic!()
        };
        assert_eq!(
            (value, revision.as_str()),
            (json!({"n": 1}), first.as_str())
        );
        // A second create, and a write against an old revision, change nothing.
        assert!(matches!(
            write(&dir, "a", &json!(2), &Expect::Absent),
            Err(Error::Conflict(Some(now))) if now == first
        ));
        let second = write(&dir, "a", &json!(2), &Expect::Revision(first.clone())).unwrap();
        assert!(matches!(
            write(&dir, "a", &json!(3), &Expect::Revision(first.clone())),
            Err(Error::Conflict(Some(now))) if now == second
        ));
        assert_eq!(
            list(&dir).unwrap(),
            [Entry {
                key: "a".into(),
                revision: second.clone(),
                size: 1
            }]
        );
        assert!(matches!(
            delete(&dir, "a", &Expect::Revision(first)),
            Err(Error::Conflict(_))
        ));
        assert!(delete(&dir, "a", &Expect::Revision(second)).unwrap());
        assert!(!delete(&dir, "a", &Expect::Anything).unwrap());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn keys_and_ids_never_name_a_path_outside_the_mods_folder() {
        let root = root();
        for id in ["../mods", "a/b", "", "stock:../x", "stock:", "x y", ".."] {
            assert!(folder(&root, id).is_err(), "{id:?}");
        }
        assert_eq!(
            folder(&root, "stock:sidebar").unwrap(),
            root.join("mod-data/@stock-sidebar")
        );
        let dir = folder(&root, "notes").unwrap();
        for key in [
            "../x",
            "a/b",
            "..",
            ".hidden",
            "",
            "a\\b",
            "a\0",
            "é",
            &"k".repeat(121),
        ] {
            assert!(read(&dir, key).is_err(), "{key:?}");
            assert!(
                write(&dir, key, &json!(1), &Expect::Anything).is_err(),
                "{key:?}"
            );
        }
        // A symlink planted in place of a value or of the folder is refused, not followed.
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(root.join("secret"), "\"outside\"").unwrap();
        std::os::unix::fs::symlink(root.join("secret"), dir.join("link.json")).unwrap();
        assert!(read(&dir, "link").is_err());
        assert!(write(&dir, "link", &json!(1), &Expect::Anything).is_err());
        assert!(list(&dir).unwrap().is_empty());
        let other = folder(&root, "other").unwrap();
        std::os::unix::fs::symlink(&dir, &other).unwrap();
        assert!(read(&other, "x").is_err());
        assert_eq!(
            std::fs::read_to_string(root.join("secret")).unwrap(),
            "\"outside\""
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn a_corrupt_value_is_reported_and_kept_aside_before_it_is_replaced() {
        let root = root();
        let dir = folder(&root, "notes").unwrap();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.json"), "{cut sho").unwrap();
        let Value::Corrupt { revision, .. } = read(&dir, "a").unwrap() else {
            panic!()
        };
        // Not missing: a create cannot silently replace it, only its revision can.
        assert!(write(&dir, "a", &json!(1), &Expect::Absent).is_err());
        write(&dir, "a", &json!(1), &Expect::Revision(revision)).unwrap();
        let aside: Vec<_> = std::fs::read_dir(dir.join(CORRUPT_DIR))
            .unwrap()
            .map(|e| std::fs::read_to_string(e.unwrap().path()).unwrap())
            .collect();
        assert_eq!(aside, ["{cut sho"]);
        assert_eq!(list(&dir).unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn simultaneous_writers_against_one_revision_have_exactly_one_winner() {
        let root = root();
        let dir = folder(&root, "notes").unwrap();
        let start = write(&dir, "count", &json!(0), &Expect::Anything).unwrap();
        let wins: usize = (0..8)
            .map(|n| {
                let (dir, start) = (dir.clone(), start.clone());
                std::thread::spawn(move || {
                    write(&dir, "count", &json!(n + 1), &Expect::Revision(start)).is_ok()
                })
            })
            .collect::<Vec<_>>()
            .into_iter()
            .map(|t| t.join().unwrap() as usize)
            .sum();
        assert_eq!(wins, 1);
        // No temporary file is left behind.
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn values_and_key_counts_are_bounded() {
        let root = root();
        let dir = folder(&root, "notes").unwrap();
        let big = json!("x".repeat(MAX_VALUE_BYTES));
        assert!(write(&dir, "big", &big, &Expect::Anything).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }
}
