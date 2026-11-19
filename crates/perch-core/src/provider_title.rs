//! The title a session's own provider gave it, read from that provider's local files, so Perch
//! names sessions the way Claude Code and Codex do without a model call of its own.
//!
//! - Claude Code appends `{"type":"ai-title","aiTitle":…}` to its transcript
//!   (`~/.claude/projects/<cwd-slug>/<session-id>.jsonl`) during the first turn and re-appends it
//!   with the session metadata on every flush; a `/rename` there writes `custom-title`, which
//!   Claude itself prefers. The tail of the file therefore always holds the current pair.
//! - Codex appends `{"id":…,"thread_name":…}` to `$CODEX_HOME/session_index.jsonl`; the last line
//!   for a thread wins.
//! - OMP keeps a fixed-width `{"type":"title","title":…}` header as the first line of
//!   `~/.omp/agent/sessions/<cwd-slug>/<timestamp>_<session-id>.jsonl`, rewritten in place.
//! - Pi and OpenCode write no title of their own; their sessions keep the cleaned first prompt.
//!
//! [`refresh`] runs on every session update (`notify_session_updated`), which fires on each turn
//! boundary. It only stores the title (`HistoryDb::set_provider_title`); the title expression ranks
//! a Perch rename above it, so a rename is never overwritten. A provider file that cannot be found
//! or read leaves the stored title as it was.

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

use serde_json::Value;

use crate::db::HistoryDb;

/// How much of a transcript's end is read for its title records. Claude re-appends them at every
/// metadata flush, so they sit in the last few records of a healthy file.
const TAIL_BYTES: u64 = 256 * 1024;

/// What a provider file last looked like, so an unchanged file is not read again.
struct Seen {
    path: PathBuf,
    stamp: (u64, Option<SystemTime>),
    title: Option<String>,
}

/// Where each provider keeps its session files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Roots {
    /// Claude Code's config dir (`~/.claude`, or `CLAUDE_CONFIG_DIR`).
    pub claude: PathBuf,
    /// Codex's home (`~/.codex`, or `CODEX_HOME`).
    pub codex: PathBuf,
    /// OMP's agent dir (`~/.omp/agent`).
    pub omp: PathBuf,
}

impl Roots {
    /// The default locations under one home directory.
    pub fn under(home: &Path) -> Self {
        Self {
            claude: home.join(".claude"),
            codex: home.join(".codex"),
            omp: home.join(".omp/agent"),
        }
    }

    /// The locations this process's providers use, or `None` without a `HOME`.
    pub fn from_env() -> Option<Self> {
        let mut roots = Self::under(Path::new(&std::env::var_os("HOME")?));
        if let Some(dir) = std::env::var_os("CLAUDE_CONFIG_DIR") {
            roots.claude = dir.into();
        }
        if let Some(dir) = std::env::var_os("CODEX_HOME") {
            roots.codex = dir.into();
        }
        Some(roots)
    }
}

/// Adopt the provider's title for `session_id`, if any of its provider sessions has one.
/// `live` lists the running runtimes' `(provider_id, provider_session_id)`; the session row's
/// remembered Claude and Codex ids are tried after them. Returns whether the stored title changed.
pub fn refresh(
    roots: &Roots,
    db: &HistoryDb,
    session_id: &str,
    mut live: Vec<(String, String)>,
) -> bool {
    if let Ok(Some(row)) = db.get_session(session_id) {
        live.extend(row.claude_session_id.map(|id| ("claude".to_string(), id)));
        live.extend(row.codex_thread_id.map(|id| ("codex".to_string(), id)));
    }
    let Some(title) = live
        .iter()
        .find_map(|(provider, id)| read_title(roots, provider, id))
    else {
        return false;
    };
    db.set_provider_title(session_id, &title)
        .unwrap_or_else(|error| {
            tracing::warn!(session_id, %error, "could not store the provider's session title");
            false
        })
}

/// The current title `provider` wrote for its session `id`, if it wrote one.
pub fn read_title(roots: &Roots, provider: &str, id: &str) -> Option<String> {
    // ponytail: one process-wide map of every provider session seen, never pruned; an entry is a
    // path and a short title, so even thousands of sessions stay small.
    static SEEN: OnceLock<Mutex<HashMap<String, Seen>>> = OnceLock::new();
    let key = format!("{roots:?}:{provider}:{id}");
    let mut seen = SEEN.get_or_init(Default::default).lock().unwrap();
    let path = match seen.get(&key) {
        Some(entry) if entry.path.exists() => entry.path.clone(),
        _ => locate(roots, provider, id)?,
    };
    let meta = std::fs::metadata(&path).ok()?;
    let stamp = (meta.len(), meta.modified().ok());
    if let Some(entry) = seen
        .get(&key)
        .filter(|e| e.path == path && e.stamp == stamp)
    {
        return entry.title.clone();
    }
    let title = match provider {
        "claude" => claude_title(&read_tail(&path)?),
        "codex" => codex_title(&read_tail(&path)?, id),
        "omp" => omp_title(&first_line(&path)?),
        _ => None,
    };
    seen.insert(
        key,
        Seen {
            path,
            stamp,
            title: title.clone(),
        },
    );
    title
}

fn locate(roots: &Roots, provider: &str, id: &str) -> Option<PathBuf> {
    // Provider ids end up in file names: anything but a plain id is not ours to look up.
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return None;
    }
    match provider {
        "claude" => {
            let file = format!("{id}.jsonl");
            subdirs(&roots.claude.join("projects"))
                .map(|dir| dir.join(&file))
                .find(|path| path.is_file())
        }
        "codex" => Some(roots.codex.join("session_index.jsonl")).filter(|path| path.is_file()),
        "omp" => {
            let suffix = format!("_{id}.jsonl");
            subdirs(&roots.omp.join("sessions")).find_map(|dir| {
                std::fs::read_dir(dir)
                    .ok()?
                    .flatten()
                    .map(|e| e.path())
                    .find(|path| {
                        path.file_name()
                            .and_then(|name| name.to_str())
                            .is_some_and(|name| name.ends_with(&suffix))
                    })
            })
        }
        _ => None,
    }
}

fn subdirs(root: &Path) -> impl Iterator<Item = PathBuf> {
    std::fs::read_dir(root)
        .into_iter()
        .flat_map(|entries| entries.flatten().map(|entry| entry.path()))
}

/// The last [`TAIL_BYTES`] of a file, starting at a whole line.
fn read_tail(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(TAIL_BYTES);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).ok()?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    Some(match (start, text.find('\n')) {
        (0, _) | (_, None) => text,
        (_, Some(newline)) => text[newline + 1..].to_string(),
    })
}

fn first_line(path: &Path) -> Option<String> {
    let mut line = String::new();
    BufReader::new(File::open(path).ok()?)
        .read_line(&mut line)
        .ok()?;
    Some(line)
}

/// Claude Code's title in a transcript tail: its last `/rename`, else its last `ai-title`.
pub fn claude_title(tail: &str) -> Option<String> {
    let mut ai = None;
    let mut custom = None;
    for line in tail.lines() {
        // Cheap prefix test first: most lines are large message records.
        if !line.starts_with(r#"{"type":"ai-title""#)
            && !line.starts_with(r#"{"type":"custom-title""#)
        {
            continue;
        }
        let Ok(record) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        match record["type"].as_str() {
            Some("ai-title") => ai = text(&record["aiTitle"]).or(ai),
            Some("custom-title") => custom = text(&record["customTitle"]).or(custom),
            _ => {}
        }
    }
    custom.or(ai)
}

/// Codex's latest `thread_name` for `thread_id` in `session_index.jsonl`.
pub fn codex_title(index: &str, thread_id: &str) -> Option<String> {
    index
        .lines()
        .rev()
        .filter(|line| line.contains(thread_id))
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .find(|record| record["id"].as_str() == Some(thread_id))
        .and_then(|record| text(&record["thread_name"]))
}

/// OMP's title from its session file's header line.
pub fn omp_title(header: &str) -> Option<String> {
    let record = serde_json::from_str::<Value>(header.trim()).ok()?;
    (record["type"].as_str() == Some("title"))
        .then(|| text(&record["title"]))
        .flatten()
}

fn text(value: &Value) -> Option<String> {
    let title = value
        .as_str()?
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    (!title.is_empty()).then_some(title)
}

#[cfg(test)]
mod tests {
    use super::*;

    const CLAUDE: &str = include_str!("provider_title_fixtures/claude.jsonl");
    const CLAUDE_RENAMED: &str = include_str!("provider_title_fixtures/claude-renamed.jsonl");
    const CODEX: &str = include_str!("provider_title_fixtures/codex-session-index.jsonl");
    const OMP: &str = include_str!("provider_title_fixtures/omp.jsonl");
    const CLAUDE_ID: &str = "0875eaf4-4f52-4d77-a897-a8bc95223438";
    const CODEX_ID: &str = "01a1bf5c-4bed-7ae0-93eb-ed267fcc764d";

    #[test]
    fn provider_records_parse_to_their_current_title() {
        assert_eq!(
            claude_title(CLAUDE).as_deref(),
            Some("Mobile route subsession layout")
        );
        assert_eq!(
            claude_title(CLAUDE_RENAMED).as_deref(),
            Some("Phone layout")
        );
        assert_eq!(
            codex_title(CODEX, CODEX_ID).as_deref(),
            Some("Check sentinel contents")
        );
        assert_eq!(
            codex_title(CODEX, "01a1ffff-0000-0000-0000-000000000000"),
            None
        );
        assert_eq!(
            omp_title(OMP.lines().next().unwrap()).as_deref(),
            Some("🚨 SENT: Read sentinel.txt contents")
        );
        assert_eq!(
            omp_title(r#"{"type":"title","v":1,"title":"","pad":"   "}"#),
            None
        );
    }

    struct Fixture {
        home: PathBuf,
        db: HistoryDb,
        db_path: PathBuf,
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.home);
            let _ = std::fs::remove_file(&self.db_path);
        }
    }

    fn fixture(name: &str) -> Fixture {
        let home = std::env::temp_dir().join(format!(
            "perch-provider-title-{name}-{}",
            uuid::Uuid::new_v4()
        ));
        let claude_dir = home.join(".claude/projects/-tmp-project");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join(format!("{CLAUDE_ID}.jsonl")), CLAUDE).unwrap();
        std::fs::create_dir_all(home.join(".codex")).unwrap();
        std::fs::write(home.join(".codex/session_index.jsonl"), CODEX).unwrap();
        let omp_dir = home.join(".omp/agent/sessions/-tmp-project");
        std::fs::create_dir_all(&omp_dir).unwrap();
        std::fs::write(
            omp_dir.join(format!("2026-11-09T08-13-20-000Z_{CODEX_ID}.jsonl")),
            OMP,
        )
        .unwrap();
        let db_path = home.with_extension("db");
        let db = HistoryDb::open(&db_path).unwrap();
        db.create_session("sess", "/tmp/project").unwrap();
        db.mark_cli_activity("sess").unwrap();
        Fixture { home, db, db_path }
    }

    fn title(fx: &Fixture) -> String {
        fx.db.get_session_row("sess").unwrap().unwrap().title
    }

    #[test]
    fn recorded_claude_and_codex_titles_replace_the_first_prompt() {
        let fx = fixture("adopt");
        fx.db.set_cli_title("sess", "ak-debug").unwrap();
        assert_eq!(title(&fx), "ak-debug");

        fx.db.set_claude_session_id("sess", CLAUDE_ID).unwrap();
        assert!(refresh(&Roots::under(&fx.home), &fx.db, "sess", Vec::new()));
        assert_eq!(title(&fx), "Mobile route subsession layout");
        assert!(
            !refresh(&Roots::under(&fx.home), &fx.db, "sess", Vec::new()),
            "unchanged"
        );

        // The provider renames its session: Perch follows.
        let file = fx
            .home
            .join(format!(".claude/projects/-tmp-project/{CLAUDE_ID}.jsonl"));
        std::fs::write(&file, CLAUDE_RENAMED).unwrap();
        assert!(refresh(&Roots::under(&fx.home), &fx.db, "sess", Vec::new()));
        assert_eq!(title(&fx), "Phone layout");

        // A live Codex runtime is asked first.
        let live = vec![("codex".to_string(), CODEX_ID.to_string())];
        assert!(refresh(&Roots::under(&fx.home), &fx.db, "sess", live));
        assert_eq!(title(&fx), "Check sentinel contents");

        let live = vec![("omp".to_string(), CODEX_ID.to_string())];
        assert!(refresh(&Roots::under(&fx.home), &fx.db, "sess", live));
        assert_eq!(title(&fx), "🚨 SENT: Read sentinel.txt contents");
    }

    #[test]
    fn a_rename_wins_over_every_provider_title() {
        let fx = fixture("rename");
        fx.db.set_claude_session_id("sess", CLAUDE_ID).unwrap();
        fx.db.set_title_override("sess", "My name").unwrap();
        refresh(&Roots::under(&fx.home), &fx.db, "sess", Vec::new());
        assert_eq!(title(&fx), "My name");
        let live = vec![("codex".to_string(), CODEX_ID.to_string())];
        refresh(&Roots::under(&fx.home), &fx.db, "sess", live);
        assert_eq!(title(&fx), "My name");
    }

    #[test]
    fn sessions_without_a_provider_title_keep_the_cleaned_prompt() {
        let fx = fixture("none");
        fx.db.set_cli_title("sess", "ak-debug").unwrap();
        let live = vec![("pi".to_string(), CODEX_ID.to_string())];
        assert!(!refresh(&Roots::under(&fx.home), &fx.db, "sess", live));
        assert_eq!(title(&fx), "ak-debug");
    }
}
