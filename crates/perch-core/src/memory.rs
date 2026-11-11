//! Project memory: plain Markdown files an agent or a person keeps for a whole Project, read on
//! demand and never injected into a prompt (ROADMAP "Projects parity", item 1; DECISIONS
//! 2026-11-07). Own design: Orca has nothing like it.
//!
//! This module is pure file work, with no database and no network. One flat folder per Project,
//! `<memory root>/<project id>/` (0700, files 0600), holds only `*.md` files with safe names. A
//! sidecar `.provenance.json` records who wrote each file, when, and at which revision. The
//! revision is a short hash of the content; a file whose content no longer matches its recorded
//! revision was edited on disk, and is reported as such instead of keeping a false author.
//!
//! Every write and delete names the revision it was based on (none: the file must not exist yet),
//! so a stale writer gets [`Error::Conflict`] and nothing is overwritten. Writes go to a temp
//! file in the folder and are renamed into place, under one lock. The core's seams are
//! `server/memory.rs` (people, `memory.*`) and `server/agent.rs` (agents, `perch memory`); the
//! root is the history database's directory, chosen by the core.
use crate::instructions::MAX_CHARS;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Files per Project; a new file past this is refused.
pub const MAX_FILES: usize = 64;
const MAX_NAME_BYTES: usize = 64;
/// More than any text of [`MAX_CHARS`] characters needs; a longer file was put there outside Perch.
const MAX_BYTES: u64 = MAX_CHARS as u64 * 4;
const PROVENANCE: &str = ".provenance.json";
/// Present in a Project's folder when its agents are not to use memory. A file, not a column: the
/// folder is the whole of a Project's memory, so the switch travels and is removed with it. Its
/// leading dot keeps it out of the index (`check_name`).
const OFF: &str = ".off";
const REVISION_CHARS: usize = 12;
const SUMMARY_CHARS: usize = 120;

// ponytail: one lock for every Project in this process; writes are tiny. A second core process
// on the same folder is not covered (the revision check still refuses a stale base).
static LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug)]
pub enum Error {
    /// The request itself is wrong (a bad name, too long, the folder is full).
    Invalid(String),
    NotFound(String),
    /// The file is not at the revision the writer based its change on; the text says what to do.
    Conflict(String),
    Io(std::io::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(text) | Self::NotFound(text) | Self::Conflict(text) => f.write_str(text),
            Self::Io(error) => write!(f, "Perch could not use the memory folder: {error}"),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// Who wrote a file. `kind` is `person`, `agent` (`session` is its session id) or `outside`
/// (the content on disk is not what Perch recorded).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Author {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session: Option<String>,
    pub label: String,
}

impl Author {
    pub fn person() -> Self {
        Self {
            kind: "person".into(),
            session: None,
            label: "a person".into(),
        }
    }

    pub fn agent(session: &str, label: &str) -> Self {
        Self {
            kind: "agent".into(),
            session: Some(session.into()),
            label: label.into(),
        }
    }

    fn outside() -> Self {
        Self {
            kind: "outside".into(),
            session: None,
            label: "edited outside Perch".into(),
        }
    }
}

/// One file in the index.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub size: u64,
    pub revision: String,
    pub author: Author,
    /// Milliseconds since the epoch: when Perch recorded the write, or the file's mtime when it
    /// was edited outside.
    pub updated_at: u64,
    /// The first non-empty line, cut short.
    pub summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct File {
    pub entry: Entry,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Recorded {
    author: Author,
    updated_at: u64,
    revision: String,
}

type Provenance = BTreeMap<String, Recorded>;

/// A file name Perch will keep: letters, digits, `-`, `_` and `.`, ending `.md`, no leading dot.
pub fn check_name(name: &str) -> Result<(), Error> {
    let stem = name.strip_suffix(".md").unwrap_or("");
    if stem.is_empty()
        || name.len() > MAX_NAME_BYTES
        || name.starts_with('.')
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    {
        return Err(Error::Invalid(format!(
            "\"{name}\" is not a memory file name: use letters, digits, - _ and . only, end it \
             with .md, no leading dot, at most {MAX_NAME_BYTES} characters"
        )));
    }
    Ok(())
}

fn check_text(text: &str) -> Result<String, Error> {
    let text = text.replace("\r\n", "\n");
    if text.trim().is_empty() {
        return Err(Error::Invalid(
            "a memory file needs text; delete the file to remove it".into(),
        ));
    }
    if text.contains('\0') {
        return Err(Error::Invalid(
            "a memory file cannot contain NUL characters".into(),
        ));
    }
    if text.chars().count() > MAX_CHARS {
        return Err(Error::Invalid(format!(
            "a memory file is limited to {MAX_CHARS} characters; split it into several files"
        )));
    }
    Ok(text)
}

/// The Project's folder: `project_id` is letters, digits, `-` and `_`, so nothing climbs out.
/// Not created here.
pub fn folder(root: &Path, project_id: &str) -> Result<PathBuf, Error> {
    if project_id.is_empty()
        || project_id.len() > 128
        || !project_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
    {
        return Err(Error::Invalid(
            "a project id is letters, digits, - and _".into(),
        ));
    }
    Ok(root.join("memory").join(project_id))
}

/// A short hash of the content: what a writer names as the revision it read.
pub fn revision_of(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()[..REVISION_CHARS]
        .to_string()
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

/// A regular file's bytes, at most `MAX_BYTES + 1` of them. `None` for a missing file, a symlink
/// or anything that is not a regular file: those are not memory.
struct Loaded {
    bytes: Vec<u8>,
    size: u64,
    modified: u64,
}

impl Loaded {
    fn too_long(&self) -> bool {
        self.size > MAX_BYTES
    }

    fn revision(&self) -> String {
        revision_of(&self.bytes)
    }
}

fn load(path: &Path) -> std::io::Result<Option<Loaded>> {
    let file = match std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        // O_NOFOLLOW on a symlink.
        Err(error) if error.raw_os_error() == Some(libc::ELOOP) => return Ok(None),
        Err(error) => return Err(error),
    };
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Ok(None);
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes)?;
    Ok(Some(Loaded {
        bytes,
        size: metadata.len(),
        modified: metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |elapsed| elapsed.as_millis() as u64),
    }))
}

fn summary_of(text: &str) -> String {
    let line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or_default();
    if line.chars().count() > SUMMARY_CHARS {
        format!("{}…", line.chars().take(SUMMARY_CHARS).collect::<String>())
    } else {
        line.to_string()
    }
}

fn entry_of(name: &str, loaded: &Loaded, recorded: Option<&Recorded>) -> Entry {
    let revision = loaded.revision();
    let (author, updated_at) = match recorded {
        Some(recorded) if recorded.revision == revision => {
            (recorded.author.clone(), recorded.updated_at)
        }
        _ => (Author::outside(), loaded.modified),
    };
    Entry {
        name: name.into(),
        size: loaded.size,
        revision,
        author,
        updated_at,
        summary: summary_of(&String::from_utf8_lossy(&loaded.bytes)),
    }
}

/// Anything wrong with the sidecar reads as "nothing recorded": every file then shows as edited
/// outside Perch, which is true of what Perch can vouch for.
fn load_provenance(dir: &Path) -> Provenance {
    std::fs::read(dir.join(PROVENANCE))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

/// Write `bytes` as `dir/name` through a temp file in the same folder and a rename, so a reader
/// sees the old file or the new one and a failure leaves no temp file behind.
fn atomic_write(dir: &Path, name: &str, bytes: &[u8]) -> std::io::Result<()> {
    let temporary = dir.join(format!(".{name}.tmp"));
    let written = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(&temporary)
        .and_then(|mut file| {
            file.write_all(bytes)?;
            file.sync_all()
        })
        .and_then(|()| std::fs::rename(&temporary, dir.join(name)));
    if written.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    written
}

fn save_provenance(dir: &Path, provenance: &Provenance) -> std::io::Result<()> {
    atomic_write(dir, PROVENANCE, &serde_json::to_vec(provenance)?)
}

fn lock() -> std::sync::MutexGuard<'static, ()> {
    LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// The names of the memory files in `dir`; a missing folder has none.
fn names(dir: &Path) -> std::io::Result<Vec<String>> {
    let reader = match std::fs::read_dir(dir) {
        Ok(reader) => reader,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let mut names: Vec<String> = reader
        .filter_map(|item| item.ok()?.file_name().into_string().ok())
        .filter(|name| check_name(name).is_ok())
        .collect();
    names.sort();
    Ok(names)
}

/// The index: every file with its size, revision, author and summary, by name.
pub fn list(root: &Path, project_id: &str) -> Result<Vec<Entry>, Error> {
    let dir = folder(root, project_id)?;
    let _guard = lock();
    let provenance = load_provenance(&dir);
    let mut entries = Vec::new();
    for name in names(&dir)? {
        if let Some(loaded) = load(&dir.join(&name))? {
            entries.push(entry_of(&name, &loaded, provenance.get(&name)));
        }
    }
    Ok(entries)
}

pub fn read(root: &Path, project_id: &str, name: &str) -> Result<File, Error> {
    check_name(name)?;
    let dir = folder(root, project_id)?;
    let _guard = lock();
    let loaded = load(&dir.join(name))?
        .ok_or_else(|| Error::NotFound(format!("there is no memory file named {name}")))?;
    if loaded.too_long() {
        return Err(Error::Invalid(format!(
            "{name} is larger than Perch reads ({MAX_BYTES} bytes); it was edited outside Perch"
        )));
    }
    let entry = entry_of(name, &loaded, load_provenance(&dir).get(name));
    Ok(File {
        entry,
        text: String::from_utf8_lossy(&loaded.bytes).into_owned(),
    })
}

fn stale(name: &str, base: &str, current: &str) -> Error {
    Error::Conflict(format!(
        "{name} changed since you read it (it is at revision {current}, you had {base}). Read it \
         again, merge your change into what is there, and write with base revision {current}."
    ))
}

/// Create or replace `name`. `base` is the revision the writer read; `None` means the file must
/// not exist yet. Anything else is a conflict and nothing is written.
pub fn write(
    root: &Path,
    project_id: &str,
    name: &str,
    text: &str,
    base: Option<&str>,
    author: &Author,
) -> Result<Entry, Error> {
    check_name(name)?;
    let text = check_text(text)?;
    let dir = folder(root, project_id)?;
    let _guard = lock();
    let current = load(&dir.join(name))?;
    match (&current, base) {
        (None, None) => {
            if names(&dir)?.len() >= MAX_FILES {
                return Err(Error::Invalid(format!(
                    "this Project's memory holds {MAX_FILES} files already; delete or merge one first"
                )));
            }
        }
        (None, Some(_)) => {
            return Err(Error::Conflict(format!(
                "{name} no longer exists. Write it without a base revision to create it again."
            )))
        }
        (Some(current), None) => {
            let revision = current.revision();
            return Err(Error::Conflict(format!(
                "{name} already exists (revision {revision}). Read it, merge your change into it, \
                 and write with base revision {revision}."
            )));
        }
        (Some(current), Some(base)) if current.revision() != base => {
            return Err(stale(name, base, &current.revision()));
        }
        _ => {}
    }
    std::fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(&dir)?;
    atomic_write(&dir, name, text.as_bytes())?;
    let updated_at = now_millis();
    let revision = revision_of(text.as_bytes());
    let mut provenance = load_provenance(&dir);
    provenance.insert(
        name.into(),
        Recorded {
            author: author.clone(),
            updated_at,
            revision: revision.clone(),
        },
    );
    save_provenance(&dir, &provenance)?;
    Ok(Entry {
        name: name.into(),
        size: text.len() as u64,
        revision,
        author: author.clone(),
        updated_at,
        summary: summary_of(&text),
    })
}

/// Remove `name`, only if it is still at revision `base`.
pub fn delete(root: &Path, project_id: &str, name: &str, base: &str) -> Result<(), Error> {
    check_name(name)?;
    let dir = folder(root, project_id)?;
    let _guard = lock();
    let current = load(&dir.join(name))?
        .ok_or_else(|| Error::NotFound(format!("there is no memory file named {name}")))?;
    if current.revision() != base {
        return Err(stale(name, base, &current.revision()));
    }
    std::fs::remove_file(dir.join(name))?;
    let mut provenance = load_provenance(&dir);
    if provenance.remove(name).is_some() {
        save_provenance(&dir, &provenance)?;
    }
    Ok(())
}

/// Whether the Project's agents may use its memory. On unless the folder holds the off marker.
/// An unreadable folder counts as on: this only withholds, never destroys.
pub fn enabled(root: &Path, project_id: &str) -> Result<bool, Error> {
    Ok(!folder(root, project_id)?.join(OFF).exists())
}

/// Turn the Project's agents' use of memory on or off. The files stay as they are and people keep
/// reading and editing them.
pub fn set_enabled(root: &Path, project_id: &str, on: bool) -> Result<(), Error> {
    let dir = folder(root, project_id)?;
    let _guard = lock();
    let marker = dir.join(OFF);
    if on {
        match std::fs::remove_file(&marker) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => return Err(error.into()),
            _ => {}
        }
    } else {
        std::fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&dir)?;
        std::fs::write(&marker, b"")?;
    }
    Ok(())
}

/// Remove a whole Project's memory folder (the Project was removed). Holds the same lock as every
/// write, removes only that one folder, and treats "no folder" as done. A symlink at the folder's
/// place is unlinked, never followed.
pub fn remove_project(root: &Path, project_id: &str) -> Result<(), Error> {
    let dir = folder(root, project_id)?;
    let _guard = lock();
    match std::fs::symlink_metadata(&dir) {
        Ok(meta) if meta.is_dir() => std::fs::remove_dir_all(&dir)?,
        Ok(_) => std::fs::remove_file(&dir)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    /// A private root per test, removed afterwards.
    struct Root(PathBuf);

    impl Root {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("perch-memory-{}", uuid::Uuid::new_v4())))
        }

        fn dir(&self) -> PathBuf {
            folder(&self.0, "proj-1").unwrap()
        }
    }

    impl Drop for Root {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn put(root: &Root, name: &str, text: &str, base: Option<&str>) -> Result<Entry, Error> {
        write(&root.0, "proj-1", name, text, base, &Author::person())
    }

    #[test]
    fn removing_a_project_removes_only_its_own_memory_and_a_missing_folder_is_fine() {
        let root = Root::new();
        put(&root, "a.md", "one", None).unwrap();
        write(&root.0, "proj-2", "b.md", "two", None, &Author::person()).unwrap();
        remove_project(&root.0, "proj-1").unwrap();
        assert!(!root.dir().exists());
        assert_eq!(list(&root.0, "proj-2").unwrap().len(), 1);
        remove_project(&root.0, "proj-1").unwrap();
        assert!(remove_project(&root.0, "../proj-2").is_err());
        assert_eq!(list(&root.0, "proj-2").unwrap().len(), 1);
    }

    #[test]
    fn turning_memory_off_keeps_the_files_and_stays_out_of_the_index() {
        let root = Root::new();
        assert!(enabled(&root.0, "proj-1").unwrap());
        put(&root, "a.md", "one", None).unwrap();
        set_enabled(&root.0, "proj-1", false).unwrap();
        assert!(!enabled(&root.0, "proj-1").unwrap());
        assert!(enabled(&root.0, "proj-2").unwrap());
        assert_eq!(list(&root.0, "proj-1").unwrap().len(), 1);
        set_enabled(&root.0, "proj-1", true).unwrap();
        set_enabled(&root.0, "proj-1", true).unwrap();
        assert!(enabled(&root.0, "proj-1").unwrap());
        // Off before any file exists makes the folder; removing the Project removes the switch.
        set_enabled(&root.0, "proj-2", false).unwrap();
        remove_project(&root.0, "proj-2").unwrap();
        assert!(enabled(&root.0, "proj-2").unwrap());
    }

    #[test]
    fn only_safe_markdown_names_and_plain_project_ids_are_accepted() {
        for good in ["a.md", "notes-1_b.md", "v1.2.md", "A.MD.md"] {
            assert!(check_name(good).is_ok(), "{good}");
        }
        let long = format!("{}.md", "a".repeat(MAX_NAME_BYTES));
        for bad in [
            "../x.md",
            "a/b.md",
            "a\\b.md",
            ".hidden.md",
            ".md",
            "notes",
            "notes.txt",
            "notes.md.bak",
            "a b.md",
            "é.md",
            ".provenance.json",
            "",
            long.as_str(),
        ] {
            assert!(check_name(bad).is_err(), "{bad:?}");
        }
        let root = Path::new("/r");
        assert_eq!(folder(root, "p-1_x").unwrap(), Path::new("/r/memory/p-1_x"));
        for bad in ["", "..", "a/b", "a.b", &"x".repeat(129)] {
            assert!(folder(root, bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_write_with_no_base_creates_and_never_replaces() {
        let root = Root::new();
        let first = put(&root, "plan.md", "# Plan\nstep one\n", None).unwrap();
        assert_eq!(first.summary, "# Plan");
        assert_eq!(first.author, Author::person());
        let again = put(&root, "plan.md", "other", None).unwrap_err();
        assert!(
            matches!(&again, Error::Conflict(text) if text.contains(&first.revision)),
            "{again}"
        );
        assert_eq!(
            read(&root.0, "proj-1", "plan.md").unwrap().text,
            "# Plan\nstep one\n"
        );
        // A base for a file that is not there is a conflict too, not a create.
        assert!(matches!(
            put(&root, "gone.md", "x", Some("abc")),
            Err(Error::Conflict(_))
        ));
        assert!(!root.dir().join("gone.md").exists());
    }

    #[test]
    fn a_stale_revision_conflicts_and_the_current_one_replaces() {
        let root = Root::new();
        let v1 = put(&root, "a.md", "one", None).unwrap();
        let v2 = put(&root, "a.md", "two", Some(&v1.revision)).unwrap();
        assert_ne!(v1.revision, v2.revision);
        let stale = put(&root, "a.md", "three", Some(&v1.revision)).unwrap_err();
        assert!(
            matches!(&stale, Error::Conflict(text)
                if text.contains(&v2.revision) && text.contains("merge")),
            "{stale}"
        );
        assert_eq!(read(&root.0, "proj-1", "a.md").unwrap().text, "two");
        assert!(matches!(
            delete(&root.0, "proj-1", "a.md", &v1.revision),
            Err(Error::Conflict(_))
        ));
        delete(&root.0, "proj-1", "a.md", &v2.revision).unwrap();
        assert!(list(&root.0, "proj-1").unwrap().is_empty());
        assert!(matches!(
            delete(&root.0, "proj-1", "a.md", &v2.revision),
            Err(Error::NotFound(_))
        ));
        assert!(
            !load_provenance(&root.dir()).contains_key("a.md"),
            "a deleted file keeps no record"
        );
    }

    #[test]
    fn size_and_count_are_capped() {
        let root = Root::new();
        let at_cap = "x".repeat(MAX_CHARS);
        assert!(put(&root, "big.md", &at_cap, None).is_ok());
        let over = "x".repeat(MAX_CHARS + 1);
        assert!(matches!(
            put(&root, "bigger.md", &over, None),
            Err(Error::Invalid(_))
        ));
        for refused in ["", "  \n", "a\0b"] {
            assert!(put(&root, "z.md", refused, None).is_err(), "{refused:?}");
        }
        for index in 1..MAX_FILES {
            put(&root, &format!("f{index}.md"), "x", None).unwrap();
        }
        assert_eq!(list(&root.0, "proj-1").unwrap().len(), MAX_FILES);
        let full = put(&root, "one-more.md", "x", None).unwrap_err();
        assert!(
            matches!(&full, Error::Invalid(text) if text.contains("64")),
            "{full}"
        );
        // Replacing a file in a full folder is still fine.
        let big = list(&root.0, "proj-1")
            .unwrap()
            .into_iter()
            .find(|entry| entry.name == "big.md")
            .unwrap();
        assert!(put(&root, "big.md", "small", Some(&big.revision)).is_ok());
    }

    #[test]
    fn a_file_edited_on_disk_is_reported_as_edited_outside_perch() {
        let root = Root::new();
        let written = put(&root, "a.md", "mine", None).unwrap();
        let agent = Author::agent("sess-1", "claude \"fix parser\"");
        let by_agent = write(&root.0, "proj-1", "b.md", "theirs", None, &agent).unwrap();
        let listed = list(&root.0, "proj-1").unwrap();
        assert_eq!(listed[0].author, Author::person());
        assert_eq!(listed[1].author, agent);
        assert_eq!(listed[1].revision, by_agent.revision);

        std::fs::write(root.dir().join("a.md"), "changed by hand").unwrap();
        let listed = list(&root.0, "proj-1").unwrap();
        assert_eq!(listed[0].author.kind, "outside");
        assert_eq!(listed[0].author.label, "edited outside Perch");
        assert_ne!(listed[0].revision, written.revision);
        assert_eq!(listed[1].author, agent, "other files keep theirs");
        // A file dropped in by hand has no record at all.
        std::fs::write(root.dir().join("c.md"), "dropped").unwrap();
        let listed = list(&root.0, "proj-1").unwrap();
        assert_eq!(listed[2].author.kind, "outside");
        assert_eq!(
            read(&root.0, "proj-1", "c.md").unwrap().entry.author.kind,
            "outside"
        );
        // The old revision no longer matches, so a writer that read before the edit conflicts.
        assert!(matches!(
            put(&root, "a.md", "x", Some(&written.revision)),
            Err(Error::Conflict(_))
        ));
    }

    #[test]
    fn the_folder_is_private_and_a_write_leaves_no_temp_file() {
        let root = Root::new();
        put(&root, "a.md", "one", None).unwrap();
        let first = put(&root, "a.md", "two", Some(&revision_of(b"one"))).unwrap();
        assert_eq!(first.size, 3);
        let mode = |path: &Path| std::fs::metadata(path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&root.dir()), 0o700);
        assert_eq!(mode(&root.dir().join("a.md")), 0o600);
        assert_eq!(mode(&root.dir().join(PROVENANCE)), 0o600);
        let mut left: Vec<String> = std::fs::read_dir(root.dir())
            .unwrap()
            .map(|item| item.unwrap().file_name().into_string().unwrap())
            .collect();
        left.sort();
        assert_eq!(left, [".provenance.json", "a.md"]);
        // A failed rename removes its temp file.
        std::fs::create_dir(root.dir().join("dir.md")).unwrap();
        assert!(atomic_write(&root.dir(), "dir.md", b"x").is_err());
        assert!(!root.dir().join(".dir.md.tmp").exists());
    }

    #[test]
    fn only_regular_files_are_memory_and_odd_ones_are_skipped() {
        let root = Root::new();
        put(&root, "a.md", "one", None).unwrap();
        let outside = root.0.join("secret.txt");
        std::fs::write(&outside, "secret").unwrap();
        std::os::unix::fs::symlink(&outside, root.dir().join("link.md")).unwrap();
        std::fs::create_dir(root.dir().join("dir.md")).unwrap();
        std::fs::write(root.dir().join("notes.txt"), "no").unwrap();
        let names: Vec<String> = list(&root.0, "proj-1")
            .unwrap()
            .into_iter()
            .map(|entry| entry.name)
            .collect();
        assert_eq!(names, ["a.md"]);
        assert!(matches!(
            read(&root.0, "proj-1", "link.md"),
            Err(Error::NotFound(_))
        ));
        // A file outside Perch's size is listed but not read.
        std::fs::write(
            root.dir().join("huge.md"),
            vec![b'x'; MAX_BYTES as usize + 10],
        )
        .unwrap();
        assert!(list(&root.0, "proj-1")
            .unwrap()
            .iter()
            .any(|entry| entry.name == "huge.md"));
        assert!(matches!(
            read(&root.0, "proj-1", "huge.md"),
            Err(Error::Invalid(_))
        ));
    }

    #[test]
    fn a_missing_or_unreadable_record_does_not_hide_files_and_projects_do_not_mix() {
        let root = Root::new();
        assert!(list(&root.0, "nothing-yet").unwrap().is_empty());
        put(&root, "a.md", "one", None).unwrap();
        std::fs::write(root.dir().join(PROVENANCE), "not json").unwrap();
        let listed = list(&root.0, "proj-1").unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].author.kind, "outside");
        assert!(list(&root.0, "proj-2").unwrap().is_empty());
        assert!(read(&root.0, "proj-2", "a.md").is_err());
    }
}
