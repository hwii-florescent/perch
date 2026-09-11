//! Session/message history, persisted to SQLite, mirroring
//! `reference/node-server-spec/src/db.ts`. Unlike the Node version (which
//! juggles better-sqlite3 vs. node:sqlite fallbacks), `rusqlite`'s
//! `bundled` feature always gives us a real synchronous SQLite — no
//! fallback needed.

use std::collections::HashMap;
use std::fmt;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::agent_persistence::SqliteConnectionAdapter;
use crate::protocol::HistoryMessage;
use crate::review::{ReviewComment, ReviewPacket};

pub struct MessageRow {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub thinking: Option<String>,
    pub operation_id: Option<String>,
    pub created_at: i64,
}

pub struct SessionRow {
    pub cwd: String,
    /// The Claude CLI's own internal session id for this perch session's
    /// most recent Claude turn (distinct from the perch `session_id` key) —
    /// what gets passed to `claude --resume` to restore context. `None` if
    /// no Claude turn has completed yet (e.g. a brand-new or codex-only
    /// session).
    pub claude_session_id: Option<String>,
    /// The codex CLI's own `thread_id` for this perch session's most recent
    /// codex turn — what gets passed to `codex resume` to restore context.
    /// `None` if no codex turn has completed yet.
    pub codex_thread_id: Option<String>,
    /// Agent name ("claude" | "codex") from the most recently completed turn.
    /// Persisted so that after a server restart, entering CLI mode can restore
    /// the correct model alias via `update_session_last_model` / `get_session`.
    pub last_agent: Option<String>,
    /// Model alias from the most recently completed turn (e.g.
    /// "claude-haiku-4-5"). Persisted alongside `last_agent` so that CLI
    /// attach after a server restart passes the correct `--model` flag,
    /// preventing the GenAI proxy 404 that occurs when claude falls back to
    /// the dated snapshot id recorded in its transcript.
    pub last_model: Option<String>,
    /// Host this session belongs to: `"local"` for an ordinary session, or a
    /// direct-mode host id (`hosts.rs`) for a session whose cwd and agent
    /// process live on a remote machine that has no perch of its own.
    pub host_id: String,
    /// Stable durable project association. `None` only for a legacy row that
    /// could not be imported (kept optional for old database compatibility).
    pub project_id: Option<String>,
    /// Stable durable workspace association. `None` only for a legacy row
    /// that could not be imported.
    pub workspace_id: Option<String>,
    pub cli_provider_id: Option<String>,
}

/// Durable project row. The database stores settings as opaque JSON text so
/// project-specific preferences can grow without repeated schema changes.
#[derive(Debug, Clone)]
pub struct ProjectRow {
    pub id: String,
    pub host_id: String,
    pub name: String,
    pub path: String,
    pub repo_path: Option<String>,
    pub default_branch: Option<String>,
    pub favorite: bool,
    pub archived: bool,
    pub settings: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Durable workspace row. The first foundation slice creates one workspace
/// for each project path; worktree/editor work may add child rows later.
#[derive(Debug, Clone)]
pub struct WorkspaceRow {
    pub id: String,
    pub project_id: String,
    pub host_id: String,
    pub path: String,
    pub name: String,
    pub branch: Option<String>,
    pub base_branch: Option<String>,
    pub dirty: bool,
    pub start_snapshot: Option<String>,
    pub parent_workspace_id: Option<String>,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Coherent project/workspace metadata and focus returned by one snapshot.
pub type WorkspaceSnapshot = (
    Vec<ProjectRow>,
    Vec<WorkspaceRow>,
    Option<String>,
    Option<String>,
);

/// Durable editor buffer. The content is intentionally bounded by the
/// filesystem adapter before it reaches SQLite. `base_content` is the exact
/// bounded text the editor opened, retained so a merge/compare can still be
/// offered after an external edit and a process restart. `base_version` is
/// its disk version; `external_version` is the last disk version observed by
/// the core. Keeping all three lets a dirty draft survive a reconnect/restart
/// while still exposing an external-change conflict.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileBufferRow {
    pub workspace_id: String,
    pub path: String,
    pub content: String,
    pub base_content: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Metadata needed by buffer lists and the external-change poller.  Keeping
/// draft/base text out of this row is important: a watcher pass must never
/// materialize hundreds of megabytes merely to decide which paths need a
/// closer look.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileBufferMetadataRow {
    pub workspace_id: String,
    pub path: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub updated_at: i64,
}

/// Values used when creating or replacing a durable editor buffer.
#[derive(Debug, Clone)]
pub struct FileBufferUpdate {
    pub content: String,
    pub base_content: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub dirty: bool,
    pub conflict: bool,
}

/// One bounded filesystem observation used to reconcile an open buffer. The
/// references keep watcher and request paths allocation-free while grouping
/// the related values into one coherent update.
#[derive(Debug, Clone, Copy)]
pub struct FileBufferObservation<'a> {
    pub content: Option<&'a str>,
    pub base_content: Option<&'a str>,
    pub base_version: Option<&'a str>,
    pub external_version: Option<&'a str>,
    pub dirty: bool,
    pub conflict: bool,
}

/// Values needed to atomically reconcile one completed filesystem save.
#[derive(Debug, Clone, Copy)]
pub struct FileSaveCompletion<'a> {
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub path: &'a str,
    pub content: &'a str,
    pub version: &'a str,
    pub expected_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: &'a str,
    pub max_receipts: usize,
}

/// Values for a completed-save idempotency receipt.
#[derive(Debug, Clone, Copy)]
pub struct FileSaveOperation<'a> {
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub path: &'a str,
    pub content_version: &'a str,
    pub expected_buffer_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: &'a str,
    pub max_receipts: usize,
}

/// A durable save intent written before the filesystem rename. If the
/// process exits between publication and buffer reconciliation, startup can
/// compare the on-disk hash to `version` and complete only the matching
/// reconciliation. A later draft revision is never overwritten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSaveIntentRow {
    pub operation_id: String,
    pub workspace_id: String,
    pub path: String,
    pub content: String,
    pub version: String,
    pub expected_buffer_revision: Option<u64>,
    pub created_at: i64,
}

/// Completed save receipt used to make a retried request idempotent across a
/// reconnect or process restart. Metadata is stored as bounded JSON and
/// decoded by the server only after it has verified the operation id and
/// workspace/path pair.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSaveOperationRow {
    pub operation_id: String,
    pub workspace_id: String,
    pub path: String,
    pub content_version: String,
    pub expected_buffer_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: String,
    pub created_at: i64,
}

/// Optimistic buffer mutations return the current row when another client
/// supplied a stale revision. This is deliberately typed so the server can
/// return the current bounded draft rather than silently dropping it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileBufferError {
    Conflict {
        expected: Option<u64>,
        current: Option<Box<FileBufferRow>>,
    },
    Limit {
        limit: usize,
    },
    ContentTooLarge {
        limit: usize,
    },
    Dirty {
        current: Box<FileBufferRow>,
    },
    Database {
        message: String,
    },
}

/// Durable authorization receipt for a destructive Git action. The status
/// fingerprint and exact canonical path set are retained so a restart or a
/// second connection cannot turn an old preview into an unbounded approval.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitPreviewRow {
    pub preview_id: String,
    pub operation: String,
    pub workspace_id: String,
    pub paths_json: String,
    pub status_fingerprint: String,
    pub message_digest: Option<String>,
    pub message: Option<String>,
    pub expires_at: i64,
    pub consumed: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptOperationRow {
    pub operation_id: String,
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub payload_digest: String,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Durable before/after boundary for one agent turn.  The status fields are
/// bounded Git summaries encoded as JSON by the server; paths contain only
/// workspace-relative names and are capped before they reach SQLite.  Git
/// content remains derived from the recorded revisions, so this row does not
/// grow with every turn's file contents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentChangeSnapshotRow {
    pub snapshot_id: String,
    pub operation_id: String,
    pub workspace_id: String,
    pub session_id: String,
    pub agent: String,
    pub before_head: Option<String>,
    pub before_branch: Option<String>,
    pub before_status: String,
    pub before_paths: Vec<String>,
    pub after_head: Option<String>,
    pub after_branch: Option<String>,
    pub after_status: Option<String>,
    pub after_paths: Option<Vec<String>>,
    pub changed_paths: Option<Vec<String>>,
    pub completed: bool,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

/// A bounded input for starting an agent change snapshot.  `snapshot_id` is
/// separate from `operation_id` so a caller can use one stable turn id while
/// retaining a distinct display/history identity.
#[derive(Debug, Clone)]
pub struct AgentChangeSnapshotStart<'a> {
    pub snapshot_id: &'a str,
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub session_id: &'a str,
    pub agent: &'a str,
    pub before_head: Option<&'a str>,
    pub before_branch: Option<&'a str>,
    pub before_status: &'a str,
    pub before_paths: &'a [String],
    pub created_at: i64,
}

/// A bounded input for finishing an agent change snapshot.  Completion is an
/// idempotent compare-and-set: the first after-boundary wins, and retries
/// return the already completed row without replacing its Git evidence.
#[derive(Debug, Clone)]
pub struct AgentChangeSnapshotFinish<'a> {
    pub snapshot_id: &'a str,
    pub after_head: Option<&'a str>,
    pub after_branch: Option<&'a str>,
    pub after_status: &'a str,
    pub after_paths: &'a [String],
    pub completed_at: i64,
}

/// Maximum bounded metadata retained for one agent turn.  A status poll can
/// expose many paths in a generated repository; retaining a deterministic
/// prefix keeps recovery and UI packets cheap while still carrying the common
/// case in full.
pub const MAX_AGENT_CHANGE_PATHS: usize = 512;
pub const MAX_AGENT_CHANGE_STATUS_BYTES: usize = 64 * 1024;

/// The result of the compare-and-set that crosses the prompt dispatch
/// boundary. `won_claim` is true for exactly one caller of a queued
/// operation; callers that observe an already-claimed or terminal operation
/// must not launch another provider process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptClaim {
    pub operation: PromptOperationRow,
    pub won_claim: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewPacketRow {
    pub packet: ReviewPacket,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReviewUpdateResult {
    Updated(ReviewComment),
    Conflict(ReviewComment),
    NotFound,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReviewDeleteResult {
    Deleted,
    Conflict(ReviewComment),
    NotFound,
}

impl fmt::Display for FileBufferError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Conflict { expected, current } => write!(
                f,
                "file buffer revision conflict (expected {}, current {})",
                expected
                    .map(|revision| revision.to_string())
                    .as_deref()
                    .unwrap_or("<absent>"),
                current
                    .as_ref()
                    .map(|row| row.revision.to_string())
                    .as_deref()
                    .unwrap_or("<absent>")
            ),
            Self::Limit { limit } => write!(f, "workspace file buffer limit reached ({limit})"),
            Self::ContentTooLarge { limit } => {
                write!(f, "file buffer content exceeds the {limit}-byte limit")
            }
            Self::Dirty { .. } => f.write_str("file buffer has unsaved or conflicted content"),
            Self::Database { message } => f.write_str(message),
        }
    }
}

impl std::error::Error for FileBufferError {}

/// Maximum number of durable buffer rows retained for one workspace. The
/// server also caps the total rows it polls for external invalidation.
pub const MAX_FILE_BUFFERS_PER_WORKSPACE: usize = 128;
pub const MAX_FILE_BUFFER_WATCHES: usize = 512;
/// The durable draft cap follows the service write/read cap. The server
/// checks the workspace service's exact limit before calling these methods;
/// this constant protects direct DB callers and malformed old clients.
pub const MAX_FILE_BUFFER_BYTES: usize = 4 * 1024 * 1024;

/// Lightweight row returned by [`HistoryDb::list_sessions`], used to populate
/// `session.list` and `session.updated` wire messages without reading full
/// message content.
pub struct SessionListRow {
    pub id: String,
    pub cwd: String,
    pub created_at: i64,
    /// Display title: a user rename if set, else the first user-message
    /// snippet (up to 40 chars) via a correlated subquery, else the CLI-mode
    /// first-prompt title (`cli_title`), else empty.
    pub title: String,
    /// Agent name from the most recent assistant message, if any.
    pub last_agent: Option<String>,
    /// Model from the most recent assistant message, if any.
    pub last_model: Option<String>,
    /// Whether this session has been archived.
    pub archived: bool,
    /// `"local"` or a direct-mode host id — see [`SessionRow::host_id`].
    pub host_id: String,
    /// The `cli_activity` flag: has this session ever been typed into in CLI
    /// mode. Surfaced on the wire as `SessionSummary::cli_started`.
    pub cli_started: bool,
    pub project_id: Option<String>,
    pub workspace_id: Option<String>,
    pub cli_provider_id: Option<String>,
}

/// Shared `SELECT` body for [`HistoryDb::list_sessions`] and
/// [`HistoryDb::get_session_row`] — column list and column *order* must stay
/// identical between the two so [`session_list_row_from_row`] can map both
/// result sets the same way, and so a `session.updated` push (built from
/// `get_session_row`) can never disagree with the equivalent row in
/// `session.list` (built from `list_sessions`). Callers append their own
/// `WHERE`/`ORDER BY` clause.
const SESSION_LIST_ROW_SELECT: &str = "SELECT
                s.id,
                s.cwd,
                s.created_at,
                COALESCE(
                    NULLIF(s.title_override, ''),
                    (SELECT SUBSTR(content, 1, 40)
                     FROM messages
                     WHERE session_id = s.id AND role = 'user'
                     ORDER BY id ASC LIMIT 1),
                    NULLIF(s.cli_title, ''),
                    ''
                ) AS title,
                (SELECT agent
                 FROM messages
                 WHERE session_id = s.id AND role = 'assistant'
                 ORDER BY id DESC LIMIT 1) AS last_agent,
                (SELECT model
                 FROM messages
                 WHERE session_id = s.id AND role = 'assistant'
                 ORDER BY id DESC LIMIT 1) AS last_model,
                s.archived,
                s.host_id,
                s.cli_activity,
                s.project_id,
                s.workspace_id,
                s.cli_provider_id
             FROM sessions s
             ";

/// Shared nav-visibility predicate for [`HistoryDb::list_sessions`] and
/// [`HistoryDb::get_session_row`]: a session is visible once it has at least
/// one message (Hosted mode) OR `cli_activity = 1` (CLI mode, set on first
/// keystroke — see `cli_activity`'s migration comment). Factored out so the
/// two call sites cannot drift apart on this filter, which would otherwise
/// let a `session.updated` push disagree with `session.list` about whether a
/// row exists. Callers combine this with their own `s.id = ?` etc.
const SESSION_VISIBILITY_FILTER: &str = "(EXISTS (
                 SELECT 1 FROM messages WHERE session_id = s.id
             ) OR s.cli_activity = 1)";

/// Row-mapping closure shared by `list_sessions` / `get_session_row` so the
/// column->field mapping cannot drift between the two call sites.
fn session_list_row_from_row(row: &rusqlite::Row) -> rusqlite::Result<SessionListRow> {
    Ok(SessionListRow {
        id: row.get(0)?,
        cwd: row.get(1)?,
        created_at: row.get(2)?,
        title: row.get(3)?,
        last_agent: row.get(4)?,
        last_model: row.get(5)?,
        archived: row.get::<_, i32>(6).unwrap_or(0) != 0,
        host_id: row
            .get::<_, Option<String>>(7)
            .unwrap_or(None)
            .filter(|h| !h.is_empty())
            .unwrap_or_else(|| "local".to_string()),
        cli_started: row.get::<_, i32>(8).unwrap_or(0) != 0,
        project_id: row.get(9)?,
        workspace_id: row.get(10)?,
        cli_provider_id: row.get(11)?,
    })
}

pub struct HistoryDb {
    conn: Mutex<Connection>,
}

/// Borrow the application's existing SQLite connection for bounded auxiliary
/// persistence (agent lifecycle/mode rows).  The adapter deliberately exposes
/// no path or second connection, so those rows share the same transaction
/// owner as sessions and messages.
impl SqliteConnectionAdapter for HistoryDb {
    fn with_connection<R, F>(&self, operation: F) -> anyhow::Result<R>
    where
        F: FnOnce(&mut Connection) -> anyhow::Result<R>,
    {
        let mut connection = self
            .conn
            .lock()
            .map_err(|_| anyhow::anyhow!("history database mutex is poisoned"))?;
        operation(&mut connection)
    }
}

impl HistoryDb {
    pub fn open_default() -> anyhow::Result<Self> {
        Self::open(default_db_path())
    }

    pub fn open(db_path: impl AsRef<Path>) -> anyhow::Result<Self> {
        let db_path = db_path.as_ref();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    /// Additive migration: creates the full-shape tables for fresh installs,
    /// and `ALTER TABLE ADD COLUMN`s any columns missing from an existing
    /// `~/.perch/history.sqlite` (older installs only have `sessions(id, cwd,
    /// created_at)` and `messages(id, session_id, role, content,
    /// created_at)`). Idempotent — safe to run on every start.
    fn migrate(&self) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                cwd TEXT NOT NULL,
                claude_session_id TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                agent TEXT,
                model TEXT,
                thinking TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS messages_session_role
                ON messages(session_id, role, id);
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                repo_path TEXT,
                default_branch TEXT,
                favorite INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                settings TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS projects_host_path
                ON projects(host_id, path);
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                host_id TEXT NOT NULL,
                path TEXT NOT NULL,
                name TEXT NOT NULL,
                branch TEXT,
                base_branch TEXT,
                dirty INTEGER NOT NULL DEFAULT 0,
                start_snapshot TEXT,
                parent_workspace_id TEXT,
                state TEXT NOT NULL DEFAULT 'active',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS workspaces_host_path
                ON workspaces(host_id, path);
            CREATE INDEX IF NOT EXISTS workspaces_project
                ON workspaces(project_id, created_at);
            CREATE TABLE IF NOT EXISTS workspace_state (
                host_id TEXT PRIMARY KEY,
                active_project_id TEXT,
                active_workspace_id TEXT,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS file_buffers (
                workspace_id TEXT NOT NULL,
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                base_content TEXT NOT NULL DEFAULT '',
                base_version TEXT,
                external_version TEXT,
                revision INTEGER NOT NULL DEFAULT 0,
                dirty INTEGER NOT NULL DEFAULT 0,
                conflict INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (workspace_id, path)
            );",
        )?;
        // `file_buffers` was introduced while this database schema was
        // already in use by development builds. Keep the migration additive
        // so an existing buffer row retains its draft instead of being
        // silently dropped when base-content persistence is enabled.
        let mut file_buffer_columns = std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(file_buffers)")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                file_buffer_columns.insert(name);
            }
        }
        if !file_buffer_columns.contains("base_content") {
            conn.execute(
                "ALTER TABLE file_buffers ADD COLUMN base_content TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS file_save_intents (
                operation_id TEXT NOT NULL DEFAULT '',
                workspace_id TEXT NOT NULL,
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                version TEXT NOT NULL,
                expected_buffer_revision INTEGER,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (workspace_id, path)
            );
            CREATE INDEX IF NOT EXISTS file_save_intents_created
                ON file_save_intents(created_at ASC, workspace_id ASC, path ASC);",
        )?;
        let mut save_intent_columns = std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(file_save_intents)")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                save_intent_columns.insert(name);
            }
        }
        if !save_intent_columns.contains("operation_id") {
            conn.execute(
                "ALTER TABLE file_save_intents ADD COLUMN operation_id TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS file_save_operations (
                operation_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                path TEXT NOT NULL,
                content_version TEXT NOT NULL,
                expected_buffer_revision INTEGER,
                bytes_written INTEGER NOT NULL,
                metadata_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS file_save_operations_created
                ON file_save_operations(created_at ASC);",
        )?;
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS file_buffers_workspace_updated
             ON file_buffers(workspace_id, updated_at DESC, path ASC);",
        )?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS git_previews (
                preview_id TEXT PRIMARY KEY,
                operation TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                paths_json TEXT NOT NULL,
                status_fingerprint TEXT NOT NULL,
                message_digest TEXT,
                message TEXT,
                expires_at INTEGER NOT NULL,
                consumed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS git_previews_expiry
                ON git_previews(expires_at ASC, consumed ASC);
            CREATE TABLE IF NOT EXISTS review_comments (
                comment_id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                comment_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS review_comments_workspace
                ON review_comments(workspace_id, updated_at ASC, comment_id ASC);
            CREATE TABLE IF NOT EXISTS review_packets (
                packet_id TEXT PRIMARY KEY,
                send_operation_id TEXT NOT NULL UNIQUE,
                workspace_id TEXT NOT NULL,
                packet_json TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'queued',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS review_packets_workspace
                ON review_packets(workspace_id, updated_at ASC);
            CREATE TABLE IF NOT EXISTS prompt_operations (
                operation_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workspace_id TEXT,
                payload_digest TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'queued',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS prompt_operations_state
                ON prompt_operations(state, updated_at ASC);",
        )?;

        // Agent turn boundaries are additive metadata.  The status payloads
        // stay in JSON so adding a Git summary field does not require another
        // migration, while the unique operation id makes a retried turn
        // boundary idempotent across reconnects and restarts.
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS agent_change_snapshots (
                snapshot_id TEXT PRIMARY KEY,
                operation_id TEXT NOT NULL UNIQUE,
                workspace_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                agent TEXT NOT NULL,
                before_head TEXT,
                before_branch TEXT,
                before_status TEXT NOT NULL,
                before_paths_json TEXT NOT NULL,
                after_head TEXT,
                after_branch TEXT,
                after_status TEXT,
                after_paths_json TEXT,
                changed_paths_json TEXT,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                completed_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS agent_change_snapshots_workspace
                ON agent_change_snapshots(workspace_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS agent_change_snapshots_session
                ON agent_change_snapshots(session_id, created_at DESC);",
        )?;

        let mut existing_columns = std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(messages)")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                existing_columns.insert(name);
            }
        }
        for (column, ddl) in [
            ("agent", "ALTER TABLE messages ADD COLUMN agent TEXT"),
            ("model", "ALTER TABLE messages ADD COLUMN model TEXT"),
            ("thinking", "ALTER TABLE messages ADD COLUMN thinking TEXT"),
            (
                "operation_id",
                "ALTER TABLE messages ADD COLUMN operation_id TEXT",
            ),
        ] {
            if !existing_columns.contains(column) {
                conn.execute(ddl, [])?;
            }
        }

        let mut existing_session_columns = std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(sessions)")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                existing_session_columns.insert(name);
            }
        }
        if !existing_session_columns.contains("claude_session_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN claude_session_id TEXT", [])?;
        }
        if !existing_session_columns.contains("codex_thread_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN codex_thread_id TEXT", [])?;
        }
        if !existing_session_columns.contains("last_agent") {
            conn.execute("ALTER TABLE sessions ADD COLUMN last_agent TEXT", [])?;
        }
        if !existing_session_columns.contains("last_model") {
            conn.execute("ALTER TABLE sessions ADD COLUMN last_model TEXT", [])?;
        }
        if !existing_session_columns.contains("archived") {
            conn.execute(
                "ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }
        if !existing_session_columns.contains("pane_layout") {
            conn.execute("ALTER TABLE sessions ADD COLUMN pane_layout TEXT", [])?;
        }
        if !existing_session_columns.contains("title_override") {
            conn.execute("ALTER TABLE sessions ADD COLUMN title_override TEXT", [])?;
        }
        // Direct-mode (`hosts.rs::HostMode::Direct`) sessions live in *this*
        // DB even though their cwd, agent process and transcript are on a
        // remote machine — perch is the only thing that knows they exist,
        // because the remote runs no perch. `host_id` is what tags them;
        // NULL / `'local'` means an ordinary local session, which is why the
        // column is nullable rather than `NOT NULL DEFAULT 'local'` (an
        // existing install's rows stay untouched and read back as local).
        if !existing_session_columns.contains("host_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN host_id TEXT", [])?;
        }
        // CLI mode (`terminal.create` with `agentAttach`) never writes to
        // `messages` — the agent's own PTY owns the transcript — so the
        // `WHERE EXISTS (... messages ...)` visibility filter below would
        // hide every CLI-mode session forever, including ones the user
        // actually typed into. `cli_activity` is flipped to 1 on the FIRST
        // keystroke into such a terminal (see `server.rs`'s `terminal.input`
        // handler and `mark_cli_activity`), mirroring Hosted mode's
        // first-user-message visibility rule without marking the blank
        // throwaway session every CLI-mode connect mints (that session gets
        // an `agentAttach` on mount but the user never types into it).
        if !existing_session_columns.contains("cli_provider_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN cli_provider_id TEXT", [])?;
        }
        if !existing_session_columns.contains("cli_activity") {
            conn.execute(
                "ALTER TABLE sessions ADD COLUMN cli_activity INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }
        // The auto-title in `SESSION_LIST_ROW_SELECT` is "first row in
        // `messages` with role='user'", which a CLI-mode session never has —
        // so every CLI session stayed permanently titled "(new session)" in
        // the nav no matter how much work happened in it. `cli_title` is the
        // CLI-mode equivalent of that first user message: the first prompt
        // the user submits into the agent's PTY, reconstructed from the
        // keystroke stream (see `server.rs`'s `CliTitleBuffer`). Written
        // once and never overwritten, so it behaves like the first-message
        // title rather than drifting to whatever was typed most recently.
        if !existing_session_columns.contains("cli_title") {
            conn.execute("ALTER TABLE sessions ADD COLUMN cli_title TEXT", [])?;
        }
        if !existing_session_columns.contains("project_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN project_id TEXT", [])?;
        }
        if !existing_session_columns.contains("workspace_id") {
            conn.execute("ALTER TABLE sessions ADD COLUMN workspace_id TEXT", [])?;
        }

        // One row per *detached turn* launched on a direct host. This is the
        // durable half of detached mode: everything needed to re-attach to a
        // turn that is still running on the remote after perch itself has
        // been killed and restarted (prior-art conventions B2/B3/B4 — cursor
        // with file identity, pid *plus* start-time identity, and the
        // tri-state recovery decision).
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS detached_runs (
                run_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                host_id TEXT NOT NULL,
                ssh_host TEXT NOT NULL,
                agent TEXT NOT NULL,
                model TEXT,
                cwd TEXT NOT NULL,
                run_dir TEXT NOT NULL,
                log_path TEXT NOT NULL,
                pid INTEGER,
                pgid INTEGER,
                proc_start TEXT,
                cursor_offset INTEGER NOT NULL DEFAULT 0,
                cursor_inode INTEGER NOT NULL DEFAULT 0,
                provider_session_id TEXT,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                operation_id TEXT
            );
            CREATE INDEX IF NOT EXISTS detached_runs_status
                ON detached_runs (status);",
        )?;
        // `operation_id` links a detached run back to the durable prompt
        // operation that authorized it. Older databases predate review and
        // prompt outboxes, so add the nullable column without disturbing the
        // existing run rows or their recovery identity.
        let mut detached_run_columns = std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("PRAGMA table_info(detached_runs)")?;
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                detached_run_columns.insert(name);
            }
        }
        if !detached_run_columns.contains("operation_id") {
            conn.execute("ALTER TABLE detached_runs ADD COLUMN operation_id TEXT", [])?;
        }
        // Materialize first-class project/workspace metadata for every old
        // session. This is a metadata-only pass: it never creates a runtime,
        // resumes an agent, or changes an existing archived project flag.
        // Keep the association pass atomic. A crash during startup can then
        // only leave the old schema untouched or the complete metadata import
        // visible to the next process.
        conn.execute_batch("BEGIN IMMEDIATE")?;
        if let Err(err) = Self::import_legacy_workspaces_locked(&conn) {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(err);
        }
        conn.execute_batch("COMMIT")?;
        Ok(())
    }

    /// Import old session rows into first-class metadata records. The input
    /// rows are collected before inserts so the statement borrow does not
    /// overlap with the writes and the pass remains deterministic.
    fn import_legacy_workspaces_locked(conn: &Connection) -> anyhow::Result<()> {
        let legacy = {
            let mut stmt = conn.prepare(
                "SELECT id, cwd, COALESCE(NULLIF(host_id, ''), 'local'), archived,
                        project_id, workspace_id
                 FROM sessions ORDER BY created_at ASC, id ASC",
            )?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i32>(3).unwrap_or(0) != 0,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<String>>(5)?,
                    ))
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };

        // A project is archived on first import only when every legacy
        // session for that host/path is archived. Mixed groups stay active so
        // a live session remains discoverable; subsequent migrations never
        // overwrite an existing archived flag.
        let mut group_archived: HashMap<(String, String), bool> = HashMap::new();
        for (_, cwd, host_id, archived, _, _) in &legacy {
            let host_id = normalized_host_id(host_id).to_string();
            let path = canonical_path_for_host(&host_id, cwd);
            group_archived
                .entry((host_id, path))
                .and_modify(|all| *all &= *archived)
                .or_insert(*archived);
        }

        for (id, cwd, host_id, archived, project_id, workspace_id) in legacy {
            let host_id = normalized_host_id(&host_id);
            let path = canonical_path_for_host(host_id, &cwd);
            let archive_project = group_archived
                .get(&(host_id.to_string(), path.clone()))
                .copied()
                .unwrap_or(archived);
            let (imported_project_id, imported_workspace_id) =
                ensure_project_workspace_locked(conn, host_id, &path, None, archive_project)?;
            // Do not disturb explicit associations created by a newer client,
            // but fill both columns for every pre-foundation row.
            let project_id = project_id
                .filter(|id| !id.trim().is_empty())
                .unwrap_or(imported_project_id);
            let workspace_id = workspace_id
                .filter(|id| !id.trim().is_empty())
                .unwrap_or(imported_workspace_id);
            conn.execute(
                "UPDATE sessions
                 SET host_id = COALESCE(NULLIF(host_id, ''), ?2),
                     project_id = COALESCE(NULLIF(project_id, ''), ?3),
                     workspace_id = COALESCE(NULLIF(workspace_id, ''), ?4)
                 WHERE id = ?1",
                params![id, host_id, project_id, workspace_id,],
            )?;
        }
        Ok(())
    }

    pub fn create_session(&self, id: &str, cwd: &str) -> anyhow::Result<()> {
        self.create_session_on_host(id, cwd, "local")
    }

    /// Lazily materialize a session row, tagged with the host that owns it.
    /// `host_id` is `"local"` for ordinary sessions and a direct-mode host id
    /// for detached ones. `INSERT OR IGNORE` keeps this a no-op for rows that
    /// already exist, so the host tag is applied separately (a session never
    /// moves hosts, but the row may predate this column).
    pub fn create_session_on_host(&self, id: &str, cwd: &str, host_id: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        let host_id = normalized_host_id(host_id);
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let (project_id, workspace_id) =
                ensure_project_workspace_locked(&conn, host_id, cwd, None, false)?;
            conn.execute(
                "INSERT OR IGNORE INTO sessions
                    (id, cwd, created_at, host_id, project_id, workspace_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, cwd, now_millis(), host_id, project_id, workspace_id],
            )?;
            conn.execute(
                "UPDATE sessions
                 SET host_id = COALESCE(NULLIF(host_id, ''), ?2),
                     project_id = COALESCE(NULLIF(project_id, ''), ?3),
                     workspace_id = COALESCE(NULLIF(workspace_id, ''), ?4)
                 WHERE id = ?1",
                params![id, host_id, project_id, workspace_id],
            )?;
            anyhow::Ok(())
        })();
        match result {
            Ok(()) => {
                conn.execute_batch("COMMIT")?;
                Ok(())
            }
            Err(err) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(err)
            }
        }
    }

    pub fn get_session(&self, id: &str) -> anyhow::Result<Option<SessionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT cwd, claude_session_id, codex_thread_id, last_agent, last_model, host_id,
                    project_id, workspace_id, cli_provider_id
             FROM sessions WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SessionRow {
                cwd: row.get(0)?,
                claude_session_id: row.get(1)?,
                codex_thread_id: row.get(2)?,
                last_agent: row.get(3)?,
                last_model: row.get(4)?,
                host_id: row
                    .get::<_, Option<String>>(5)?
                    .filter(|h| !h.is_empty())
                    .unwrap_or_else(|| "local".to_string()),
                project_id: row.get(6)?,
                workspace_id: row.get(7)?,
                cli_provider_id: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    // -----------------------------------------------------------------------
    // Durable project/workspace metadata
    // -----------------------------------------------------------------------

    /// Return projects for one host. Archived rows are retained in the DB and
    /// are included only when explicitly requested, so a normal sidebar
    /// refresh cannot accidentally resurrect archived projects.
    pub fn list_projects(
        &self,
        host_id: &str,
        include_archived: bool,
    ) -> anyhow::Result<Vec<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                    settings, created_at, updated_at
             FROM projects WHERE host_id = ?1 ORDER BY favorite DESC, updated_at DESC, id ASC"
        } else {
            "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                    settings, created_at, updated_at
             FROM projects WHERE host_id = ?1 AND archived = 0
             ORDER BY favorite DESC, updated_at DESC, id ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![normalized_host_id(host_id)], project_row_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn get_project(&self, id: &str) -> anyhow::Result<Option<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        get_project_locked(&conn, id)
    }

    /// Idempotently create a project and its default workspace for a
    /// host/path pair. Existing rows are returned untouched, including their
    /// archived state and user-selected name.
    pub fn create_project(
        &self,
        host_id: &str,
        path: &str,
        name: Option<&str>,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let conn = self.conn.lock().unwrap();
        let host_id = normalized_host_id(host_id);
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let (project_id, workspace_id) =
                ensure_project_workspace_locked(&conn, host_id, path, name, false)?;
            let project = get_project_locked(&conn, &project_id)?
                .ok_or_else(|| anyhow::anyhow!("project disappeared after creation"))?;
            let workspace = get_workspace_locked(&conn, &workspace_id)?
                .ok_or_else(|| anyhow::anyhow!("workspace disappeared after creation"))?;
            anyhow::Ok((project, workspace))
        })();
        match result {
            Ok(rows) => {
                conn.execute_batch("COMMIT")?;
                Ok(rows)
            }
            Err(err) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(err)
            }
        }
    }

    /// Persist the Git metadata for a workspace.  `start_snapshot` is a
    /// creation boundary: once recorded it is never replaced by a later poll
    /// or branch switch.  This lets a diff request use the same workspace
    /// start even after several agent turns or reconnects.
    pub fn update_workspace_git_state(
        &self,
        workspace_id: &str,
        branch: Option<&str>,
        base_branch: Option<&str>,
        dirty: bool,
        head: Option<&str>,
    ) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces
             SET branch = COALESCE(?2, branch),
                 base_branch = COALESCE(?3, base_branch),
                 dirty = ?4,
                 start_snapshot = CASE
                     WHEN start_snapshot IS NULL THEN ?5
                     ELSE start_snapshot
                 END,
                 updated_at = ?6
             WHERE id = ?1",
            params![
                workspace_id,
                branch,
                base_branch,
                dirty as i32,
                head,
                now_millis()
            ],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("workspace not found: {workspace_id}"));
        }
        get_workspace_locked(&conn, workspace_id)?
            .ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Idempotently register a linked worktree as a child workspace.  The
    /// `project_path` must identify the repository's primary checkout; the
    /// method creates or reuses that project/default workspace and then binds
    /// the linked checkout to it.  Repeating a create after a lost response
    /// returns the existing child row rather than creating duplicate metadata.
    pub fn create_worktree_workspace(
        &self,
        host_id: &str,
        project_path: &str,
        checkout_path: &str,
        branch: Option<&str>,
        base_branch: Option<&str>,
        start_snapshot: Option<&str>,
    ) -> anyhow::Result<WorkspaceRow> {
        let host_id = normalized_host_id(host_id);
        let project_path = canonical_path_for_host(host_id, project_path);
        let checkout_path = canonical_path_for_host(host_id, checkout_path);
        if project_path.is_empty() || checkout_path.is_empty() {
            return Err(anyhow::anyhow!("workspace paths cannot be empty"));
        }
        if let Some(branch) = branch {
            validate_workspace_metadata(branch, "branch")?;
        }
        if let Some(base_branch) = base_branch {
            validate_workspace_metadata(base_branch, "base branch")?;
        }
        if let Some(start_snapshot) = start_snapshot {
            validate_workspace_metadata(start_snapshot, "start snapshot")?;
        }
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let (project_id, parent_workspace_id) =
                ensure_project_workspace_locked(&conn, host_id, &project_path, None, false)?;
            let existing = conn
                .query_row(
                    "SELECT id FROM workspaces WHERE host_id = ?1 AND path = ?2
                     ORDER BY created_at ASC, id ASC LIMIT 1",
                    params![host_id, checkout_path],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            if let Some(workspace_id) = existing {
                let workspace = get_workspace_locked(&conn, &workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"))?;
                if workspace.project_id != project_id {
                    return Err(anyhow::anyhow!(
                        "worktree path already belongs to another project"
                    ));
                }
                conn.execute(
                    "UPDATE workspaces
                     SET branch = COALESCE(?2, branch),
                         base_branch = COALESCE(?3, base_branch),
                         start_snapshot = CASE
                             WHEN start_snapshot IS NULL THEN ?4
                             ELSE start_snapshot
                         END,
                         updated_at = ?5
                     WHERE id = ?1",
                    params![
                        workspace_id,
                        branch,
                        base_branch,
                        start_snapshot,
                        now_millis()
                    ],
                )?;
                return get_workspace_locked(&conn, &workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"));
            }

            // A worktree path equal to the primary checkout is the durable
            // parent workspace itself, never a second child row.
            if checkout_path == project_path {
                return get_workspace_locked(&conn, &parent_workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"));
            }
            let workspace_id = Uuid::new_v4().to_string();
            let now = now_millis();
            let name = branch
                .filter(|branch| !branch.trim().is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| project_name_for_path(&checkout_path));
            conn.execute(
                "INSERT INTO workspaces
                    (id, project_id, host_id, path, name, branch, base_branch, dirty,
                     start_snapshot, parent_workspace_id, state, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, 'active', ?10, ?10)",
                params![
                    workspace_id,
                    project_id,
                    host_id,
                    checkout_path,
                    name,
                    branch,
                    base_branch,
                    start_snapshot,
                    parent_workspace_id,
                    now,
                ],
            )?;
            get_workspace_locked(&conn, &workspace_id)?
                .ok_or_else(|| anyhow::anyhow!("workspace disappeared after insertion"))
        })();
        match result {
            Ok(workspace) => {
                conn.execute_batch("COMMIT")?;
                Ok(workspace)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Mark a removed linked checkout archived while retaining its project,
    /// comments, buffers, and agent history for safe inspection.  The primary
    /// project workspace is never archived by this path.
    pub fn archive_workspace_for_path(
        &self,
        host_id: &str,
        checkout_path: &str,
    ) -> anyhow::Result<Option<WorkspaceRow>> {
        let host_id = normalized_host_id(host_id);
        let checkout_path = canonical_path_for_host(host_id, checkout_path);
        let conn = self.conn.lock().unwrap();
        let workspace_id = conn
            .query_row(
                "SELECT id FROM workspaces
                 WHERE host_id = ?1 AND path = ?2 AND parent_workspace_id IS NOT NULL
                 LIMIT 1",
                params![host_id, checkout_path],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let Some(workspace_id) = workspace_id else {
            return Ok(None);
        };
        conn.execute(
            "UPDATE workspaces SET state = 'archived', updated_at = ?2 WHERE id = ?1",
            params![workspace_id, now_millis()],
        )?;
        get_workspace_locked(&conn, &workspace_id)
    }

    pub fn rename_project(&self, id: &str, name: &str) -> anyhow::Result<ProjectRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE projects SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("project not found: {id}"));
        }
        get_project_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("project disappeared"))
    }

    pub fn set_project_archived(&self, id: &str, archived: bool) -> anyhow::Result<ProjectRow> {
        let conn = self.conn.lock().unwrap();
        let _project = get_project_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {id}"))?;
        let changed = conn.execute(
            "UPDATE projects SET archived = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, archived as i32, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("project not found: {id}"));
        }
        if archived {
            // Never leave a hidden project as the active selection. Choose a
            // deterministic active fallback on the same host, or clear focus
            // when no visible project remains.
            let states = {
                let mut stmt = conn
                    .prepare("SELECT host_id FROM workspace_state WHERE active_project_id = ?1")?;
                let rows = stmt
                    .query_map(params![id], |row| row.get::<_, String>(0))?
                    .collect::<Result<Vec<_>, _>>()?;
                rows
            };
            for host_id in states {
                let fallback: Option<(String, String)> = {
                    let mut stmt = conn.prepare(
                        "SELECT p.id, w.id
                         FROM projects p JOIN workspaces w ON w.project_id = p.id
                         WHERE p.host_id = ?1 AND p.archived = 0 AND w.state != 'archived'
                         ORDER BY p.favorite DESC, p.updated_at DESC, p.id ASC,
                                  w.created_at ASC, w.id ASC LIMIT 1",
                    )?;
                    let mut rows = stmt.query(params![&host_id])?;
                    let result = rows.next()?.map(|row| {
                        Ok::<(String, String), rusqlite::Error>((row.get(0)?, row.get(1)?))
                    });
                    result.transpose()?
                };
                if let Some((project_id, workspace_id)) = fallback {
                    set_workspace_focus_locked(&conn, &host_id, &project_id, &workspace_id)?;
                } else {
                    conn.execute(
                        "UPDATE workspace_state
                         SET active_project_id = NULL, active_workspace_id = NULL,
                             updated_at = ?2
                         WHERE host_id = ?1",
                        params![host_id, now_millis()],
                    )?;
                }
            }
        }
        get_project_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("project disappeared"))
    }

    pub fn list_workspaces(
        &self,
        host_id: &str,
        project_id: Option<&str>,
    ) -> anyhow::Result<Vec<WorkspaceRow>> {
        let conn = self.conn.lock().unwrap();
        let mut rows = Vec::new();
        if let Some(project_id) = project_id {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                        start_snapshot, parent_workspace_id, state, created_at, updated_at
                 FROM workspaces WHERE host_id = ?1 AND project_id = ?2
                 ORDER BY created_at ASC, id ASC",
            )?;
            for row in stmt.query_map(
                params![normalized_host_id(host_id), project_id],
                workspace_row_from_row,
            )? {
                rows.push(row?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                        start_snapshot, parent_workspace_id, state, created_at, updated_at
                 FROM workspaces WHERE host_id = ?1
                 ORDER BY created_at ASC, id ASC",
            )?;
            for row in
                stmt.query_map(params![normalized_host_id(host_id)], workspace_row_from_row)?
            {
                rows.push(row?);
            }
        }
        Ok(rows)
    }

    pub fn get_workspace(&self, id: &str) -> anyhow::Result<Option<WorkspaceRow>> {
        let conn = self.conn.lock().unwrap();
        get_workspace_locked(&conn, id)
    }

    pub fn rename_workspace(&self, id: &str, name: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("workspace not found: {id}"));
        }
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Focus a project's default workspace. Archived projects are not
    /// focusable; this prevents a normal navigation action from unarchiving
    /// metadata or reviving stale agent state.
    pub fn focus_project(&self, id: &str) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let conn = self.conn.lock().unwrap();
        let (project, workspace) = self.resolve_project_workspace_locked(&conn, id)?;
        set_workspace_focus_locked(&conn, &project.host_id, &project.id, &workspace.id)?;
        Ok((project, workspace))
    }

    /// Resolve a project's default workspace without changing any focus
    /// state. The server uses this for per-connection focus, so one browser or
    /// phone cannot steal another device's active workspace.
    pub fn resolve_project_workspace(
        &self,
        id: &str,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let conn = self.conn.lock().unwrap();
        self.resolve_project_workspace_locked(&conn, id)
    }

    fn resolve_project_workspace_locked(
        &self,
        conn: &Connection,
        id: &str,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let project = get_project_locked(conn, id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {id}"))?;
        if project.archived {
            return Err(anyhow::anyhow!("project is archived: {id}"));
        }
        let workspace = get_default_workspace_locked(conn, &project.id)?
            .ok_or_else(|| anyhow::anyhow!("project has no workspace: {id}"))?;
        if workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {}", workspace.id));
        }
        Ok((project, workspace))
    }

    /// Validate and return a workspace without changing persisted focus.
    pub fn resolve_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(&conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.host_id != workspace.host_id {
            return Err(anyhow::anyhow!(
                "workspace host does not match project host"
            ));
        }
        if project.archived || workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {id}"));
        }
        Ok(workspace)
    }

    /// Focus an existing workspace after checking both host and project
    /// ownership. The host comparison is deliberate: a remote id can never
    /// select a local workspace by guessing a UUID.
    pub fn focus_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = self.resolve_workspace_locked(&conn, id)?;
        let project = get_project_locked(&conn, &workspace.project_id)
            .ok()
            .flatten()
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        set_workspace_focus_locked(&conn, &workspace.host_id, &project.id, &workspace.id)?;
        Ok(workspace)
    }

    fn resolve_workspace_locked(
        &self,
        conn: &Connection,
        id: &str,
    ) -> anyhow::Result<WorkspaceRow> {
        let workspace = get_workspace_locked(conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.host_id != workspace.host_id {
            return Err(anyhow::anyhow!(
                "workspace host does not match project host"
            ));
        }
        if project.archived || workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {id}"));
        }
        Ok(workspace)
    }

    /// Restore metadata state only. No session runtime or agent is started as
    /// a side effect; the caller must explicitly resume a session.
    pub fn restore_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(&conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.archived {
            return Err(anyhow::anyhow!("project is archived: {}", project.id));
        }
        conn.execute(
            "UPDATE workspaces SET state = 'active', updated_at = ?2 WHERE id = ?1",
            params![id, now_millis()],
        )?;
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Read all metadata required for one coherent snapshot under a single
    /// SQLite mutex hold. This prevents a focus mutation from landing between
    /// the project/workspace lists and the active selection.
    pub fn workspace_snapshot(
        &self,
        host_id: &str,
        project_id: Option<&str>,
    ) -> anyhow::Result<WorkspaceSnapshot> {
        let conn = self.conn.lock().unwrap();
        let host_id = normalized_host_id(host_id);
        let projects = list_projects_locked(&conn, host_id)?;
        let workspaces = if let Some(project_id) = project_id {
            list_workspaces_locked(&conn, host_id, Some(project_id))?
        } else {
            list_workspaces_locked(&conn, host_id, None)?
        };
        let (active_project_id, active_workspace_id) = active_focus_locked(&conn, host_id)?;
        Ok((projects, workspaces, active_project_id, active_workspace_id))
    }

    /// Read the persisted focus for one host without loading the project or
    /// workspace rows. The server uses this only to seed a newly-created
    /// connection; subsequent focus navigation is kept in that connection's
    /// state so one browser/device cannot move another client's selection.
    pub fn active_focus(&self, host_id: &str) -> anyhow::Result<(Option<String>, Option<String>)> {
        let conn = self.conn.lock().unwrap();
        active_focus_locked(&conn, normalized_host_id(host_id))
    }

    /// Return one durable editor buffer, if it is open in the workspace.
    pub fn get_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
    ) -> anyhow::Result<Option<FileBufferRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(get_file_buffer_locked(&conn, workspace_id, path)?)
    }

    /// Return only the bounded metadata needed to populate a buffer list.
    /// Draft and base text are loaded by `get_file_buffer` for one requested
    /// path, so a list response cannot amplify a workspace's retained text
    /// into a large SQLite allocation.
    pub fn list_file_buffer_metadata(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<FileBufferMetadataRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_buffer_metadata_locked(
            &conn,
            Some(workspace_id),
            limit,
        )?)
    }

    /// Return a bounded cross-workspace watch set for the background
    /// invalidation poller. Rows represent open buffers, so no repository scan
    /// or eager directory walk is needed.
    pub fn list_file_buffers_for_watch(
        &self,
        limit: usize,
    ) -> anyhow::Result<Vec<FileBufferMetadataRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_buffer_metadata_locked(&conn, None, limit)?)
    }

    /// Create or replace a draft using optimistic buffer revision checking.
    /// A missing expected revision is accepted only for a new row; existing
    /// rows require the caller to name the revision it read.
    pub fn set_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        update: FileBufferUpdate,
        expected_revision: Option<u64>,
        max_buffers: usize,
    ) -> Result<FileBufferRow, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        validate_file_buffer_update(&update, MAX_FILE_BUFFER_BYTES)?;
        let existing = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: existing.map(Box::new),
                });
            }
            (Some(_current), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: existing.map(Box::new),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        if existing.is_none() {
            let count = count_file_buffers_locked(&conn, workspace_id)
                .map_err(file_buffer_database_error)?;
            if count >= max_buffers {
                return Err(FileBufferError::Limit { limit: max_buffers });
            }
        }
        let now = now_millis();
        let revision = existing
            .as_ref()
            .map(|buffer| buffer.revision.saturating_add(1))
            .unwrap_or(1);
        let result = conn.execute(
            "INSERT INTO file_buffers
                (workspace_id, path, content, base_content, base_version,
                 external_version, revision, dirty, conflict, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(workspace_id, path) DO UPDATE SET
                content = excluded.content,
                base_content = excluded.base_content,
                base_version = excluded.base_version,
                external_version = excluded.external_version,
                revision = excluded.revision,
                dirty = excluded.dirty,
                conflict = excluded.conflict,
                updated_at = excluded.updated_at",
            params![
                workspace_id,
                path,
                update.content,
                update.base_content,
                update.base_version,
                update.external_version,
                revision as i64,
                update.dirty as i32,
                update.conflict as i32,
                now,
            ],
        );
        result.map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
            .ok_or_else(|| file_buffer_database_error(anyhow::anyhow!("file buffer disappeared")))
    }

    /// Insert a clean row when a file tab is first opened. A second opener of
    /// the same path gets the existing row and therefore sees the same draft.
    pub fn ensure_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        update: FileBufferUpdate,
        max_buffers: usize,
    ) -> Result<FileBufferRow, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        validate_file_buffer_update(&update, MAX_FILE_BUFFER_BYTES)?;
        if let Some(existing) =
            get_file_buffer_locked(&conn, workspace_id, path).map_err(file_buffer_database_error)?
        {
            return Ok(existing);
        }
        let count =
            count_file_buffers_locked(&conn, workspace_id).map_err(file_buffer_database_error)?;
        if count >= max_buffers {
            return Err(FileBufferError::Limit { limit: max_buffers });
        }
        let now = now_millis();
        conn.execute(
            "INSERT INTO file_buffers
                (workspace_id, path, content, base_content, base_version,
                 external_version, revision, dirty, conflict, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9, ?9)",
            params![
                workspace_id,
                path,
                update.content,
                update.base_content,
                update.base_version,
                update.external_version,
                update.dirty as i32,
                update.conflict as i32,
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
            .ok_or_else(|| file_buffer_database_error(anyhow::anyhow!("file buffer disappeared")))
    }

    /// Record the newest disk observation for an existing open buffer. Dirty
    /// content is preserved; clean content may be replaced by the fresh disk
    /// text. Returns `None` when the row no longer exists.
    pub fn observe_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        observation: FileBufferObservation<'_>,
    ) -> anyhow::Result<Option<FileBufferRow>> {
        let FileBufferObservation {
            content,
            base_content,
            base_version,
            external_version,
            dirty,
            conflict,
        } = observation;
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_file_buffer_locked(&conn, workspace_id, path)? else {
            return Ok(None);
        };
        let unchanged = current.external_version.as_deref() == external_version
            && current.dirty == dirty
            && current.conflict == conflict
            && content.is_none();
        if unchanged {
            return Ok(Some(current));
        }
        let now = now_millis();
        if let Some(content) = content {
            let Some(base_content) = base_content else {
                return Err(anyhow::anyhow!(
                    "base content is required when refreshing a file buffer"
                ));
            };
            conn.execute(
                "UPDATE file_buffers SET content = ?3, base_content = ?4,
                    base_version = ?5, external_version = ?6, dirty = ?7,
                    conflict = ?8, revision = revision + 1, updated_at = ?9
                 WHERE workspace_id = ?1 AND path = ?2",
                params![
                    workspace_id,
                    path,
                    content,
                    base_content,
                    base_version,
                    external_version,
                    dirty as i32,
                    conflict as i32,
                    now,
                ],
            )?;
        } else {
            conn.execute(
                "UPDATE file_buffers SET external_version = ?3,
                    dirty = ?4, conflict = ?5, revision = revision + 1,
                    updated_at = ?6
                 WHERE workspace_id = ?1 AND path = ?2",
                params![
                    workspace_id,
                    path,
                    external_version,
                    dirty as i32,
                    conflict as i32,
                    now,
                ],
            )?;
        }
        Ok(get_file_buffer_locked(&conn, workspace_id, path)?)
    }

    /// Persist the intent for an upcoming filesystem publication. This is a
    /// separate row from the draft so a crash after rename but before the
    /// normal reconciliation can be repaired on the next startup.
    pub fn begin_file_save_intent(
        &self,
        operation_id: &str,
        workspace_id: &str,
        path: &str,
        content: &str,
        version: &str,
        expected_buffer_revision: Option<u64>,
    ) -> Result<FileSaveIntentRow, FileBufferError> {
        if content.len() > MAX_FILE_BUFFER_BYTES {
            return Err(FileBufferError::ContentTooLarge {
                limit: MAX_FILE_BUFFER_BYTES,
            });
        }
        let conn = self.conn.lock().unwrap();
        let current = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&current, expected_buffer_revision) {
            (Some(row), Some(expected)) if row.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: current.map(Box::new),
                });
            }
            (Some(row), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: Some(Box::new(row.clone())),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        let now = now_millis();
        conn.execute(
            "INSERT INTO file_save_intents
                (operation_id, workspace_id, path, content, version,
                 expected_buffer_revision, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(workspace_id, path) DO UPDATE SET
                operation_id = excluded.operation_id,
                content = excluded.content,
                version = excluded.version,
                expected_buffer_revision = excluded.expected_buffer_revision,
                created_at = excluded.created_at",
            params![
                operation_id,
                workspace_id,
                path,
                content,
                version,
                expected_buffer_revision.map(|revision| revision as i64),
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        Ok(FileSaveIntentRow {
            operation_id: operation_id.to_string(),
            workspace_id: workspace_id.to_string(),
            path: path.to_string(),
            content: content.to_string(),
            version: version.to_string(),
            expected_buffer_revision,
            created_at: now,
        })
    }

    /// Atomically reconcile a completed filesystem publication, record its
    /// idempotency receipt, and remove the matching save intent. The
    /// transaction also recognizes the exact already-reconciled row left by
    /// an older process that exited between those steps.
    pub fn complete_file_save(
        &self,
        completion: FileSaveCompletion<'_>,
    ) -> Result<Option<FileBufferRow>, FileBufferError> {
        let FileSaveCompletion {
            operation_id,
            workspace_id,
            path,
            content,
            version,
            expected_revision,
            bytes_written,
            metadata_json,
            max_receipts,
        } = completion;
        if content.len() > MAX_FILE_BUFFER_BYTES {
            return Err(FileBufferError::ContentTooLarge {
                limit: MAX_FILE_BUFFER_BYTES,
            });
        }
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(file_buffer_database_error)?;
        let existing =
            get_file_buffer_locked(&tx, workspace_id, path).map_err(file_buffer_database_error)?;
        let already_reconciled = existing.as_ref().is_some_and(|row| {
            row.content == content
                && row.base_content == content
                && row.base_version.as_deref() == Some(version)
                && row.external_version.as_deref() == Some(version)
                && !row.dirty
                && !row.conflict
                && expected_revision
                    .is_some_and(|expected| row.revision == expected.saturating_add(1))
        });
        // A save intent is checked after filesystem publication during
        // recovery.  If an editor revision was committed after the intent,
        // the publication is still complete but must not erase that newer
        // draft.  Record the receipt and remove only this intent below; the
        // caller receives the newer row so it can surface its conflict.
        let preserve_newer = match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision > expected => true,
            (Some(current), Some(expected)) if current.revision < expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: Some(Box::new(current.clone())),
                });
            }
            (Some(current), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: Some(Box::new(current.clone())),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => false,
        };
        if !already_reconciled && !preserve_newer {
            if existing.is_some() {
                let now = now_millis();
                tx.execute(
                    "UPDATE file_buffers SET content = ?3, base_content = ?3,
                        base_version = ?4, external_version = ?4, dirty = 0,
                        conflict = 0, revision = revision + 1, updated_at = ?5
                     WHERE workspace_id = ?1 AND path = ?2",
                    params![workspace_id, path, content, version, now],
                )
                .map_err(file_buffer_database_error)?;
            }
        } else if preserve_newer
            && !already_reconciled
            && existing
                .as_ref()
                .is_some_and(|row| row.content != content || row.dirty)
        {
            // Recovery proved that this operation reached disk, but a later
            // editor revision is now authoritative. Keep its text and mark
            // the row conflicted so the client must choose how to merge.
            let now = now_millis();
            tx.execute(
                "UPDATE file_buffers SET conflict = 1, revision = revision + 1,
                    updated_at = ?3
                 WHERE workspace_id = ?1 AND path = ?2",
                params![workspace_id, path, now],
            )
            .map_err(file_buffer_database_error)?;
        }
        let now = now_millis();
        tx.execute(
            "INSERT OR IGNORE INTO file_save_operations
                (operation_id, workspace_id, path, content_version,
                 expected_buffer_revision, bytes_written, metadata_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                operation_id,
                workspace_id,
                path,
                version,
                expected_revision.map(|revision| revision as i64),
                bytes_written.min(i64::MAX as usize) as i64,
                metadata_json,
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        tx.execute(
            "DELETE FROM file_save_intents
             WHERE operation_id = ?1 AND workspace_id = ?2 AND path = ?3
               AND version = ?4",
            params![operation_id, workspace_id, path, version],
        )
        .map_err(file_buffer_database_error)?;
        let max_receipts = max_receipts.min(i64::MAX as usize) as i64;
        tx.execute(
            "DELETE FROM file_save_operations
             WHERE operation_id IN (
                SELECT operation_id FROM file_save_operations
                ORDER BY created_at ASC, operation_id ASC
                LIMIT CASE WHEN (SELECT COUNT(*) FROM file_save_operations) > ?1
                           THEN (SELECT COUNT(*) FROM file_save_operations) - ?1
                           ELSE 0 END
             )",
            params![max_receipts],
        )
        .map_err(file_buffer_database_error)?;
        let result = if existing.is_some() {
            get_file_buffer_locked(&tx, workspace_id, path).map_err(file_buffer_database_error)?
        } else {
            None
        };
        tx.commit().map_err(file_buffer_database_error)?;
        Ok(result)
    }

    /// List a bounded number of pending save intents for startup recovery.
    pub fn list_file_save_intents(&self, limit: usize) -> anyhow::Result<Vec<FileSaveIntentRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_save_intents_locked(&conn, limit)?)
    }

    /// Return a completed save receipt by its request/operation id.
    pub fn get_file_save_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<FileSaveOperationRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(get_file_save_operation_locked(&conn, operation_id)?)
    }

    /// Record a completed save receipt. Replays of the same operation id keep
    /// the original result, which makes a retried WS request idempotent.
    pub fn record_file_save_operation(
        &self,
        operation: FileSaveOperation<'_>,
    ) -> anyhow::Result<()> {
        let FileSaveOperation {
            operation_id,
            workspace_id,
            path,
            content_version,
            expected_buffer_revision,
            bytes_written,
            metadata_json,
            max_receipts,
        } = operation;
        let conn = self.conn.lock().unwrap();
        let now = now_millis();
        conn.execute(
            "INSERT OR IGNORE INTO file_save_operations
                (operation_id, workspace_id, path, content_version,
                 expected_buffer_revision, bytes_written, metadata_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                operation_id,
                workspace_id,
                path,
                content_version,
                expected_buffer_revision.map(|revision| revision as i64),
                bytes_written.min(i64::MAX as usize) as i64,
                metadata_json,
                now,
            ],
        )?;
        let max_receipts = max_receipts.min(i64::MAX as usize) as i64;
        conn.execute(
            "DELETE FROM file_save_operations
             WHERE operation_id IN (
                SELECT operation_id FROM file_save_operations
                ORDER BY created_at ASC, operation_id ASC
                LIMIT CASE WHEN (SELECT COUNT(*) FROM file_save_operations) > ?1
                           THEN (SELECT COUNT(*) FROM file_save_operations) - ?1
                           ELSE 0 END
             )",
            params![max_receipts],
        )?;
        Ok(())
    }

    /// Remove an intent only when its identifying values still match. A
    /// mismatched row belongs to a newer save and must remain intact.
    pub fn clear_file_save_intent(
        &self,
        operation_id: &str,
        workspace_id: &str,
        path: &str,
        version: &str,
        expected_buffer_revision: Option<u64>,
    ) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let current = get_file_save_intent_locked(&conn, workspace_id, path)?;
        let Some(current) = current else {
            return Ok(false);
        };
        if current.operation_id != operation_id
            || current.version != version
            || current.expected_buffer_revision != expected_buffer_revision
        {
            return Ok(false);
        }
        conn.execute(
            "DELETE FROM file_save_intents WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path],
        )?;
        Ok(true)
    }

    /// Reconcile the durable draft as part of an explicit atomic file save.
    /// The same foundation lock that guards the filesystem publication guards
    /// this revision check, so a later editor update cannot be cleared by an
    /// earlier save.
    pub fn reconcile_file_buffer_after_save(
        &self,
        workspace_id: &str,
        path: &str,
        content: &str,
        version: &str,
        expected_revision: Option<u64>,
    ) -> Result<Option<FileBufferRow>, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        let existing = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: existing.map(Box::new),
                });
            }
            (Some(_), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: existing.map(Box::new),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        if existing.is_none() {
            return Ok(None);
        }
        let now = now_millis();
        conn.execute(
            "UPDATE file_buffers SET content = ?3, base_version = ?4,
                base_content = ?3, external_version = ?4, dirty = 0,
                conflict = 0, revision = revision + 1, updated_at = ?5
             WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path, content, version, now],
        )
        .map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path).map_err(file_buffer_database_error)
    }

    /// Close a tab's durable row. Dirty/conflicted content requires an
    /// explicit discard flag, and the caller must name the current revision.
    pub fn close_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        expected_revision: Option<u64>,
        discard: bool,
    ) -> Result<bool, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
        else {
            return Ok(false);
        };
        if expected_revision != Some(current.revision) {
            return Err(FileBufferError::Conflict {
                expected: expected_revision,
                current: Some(Box::new(current)),
            });
        }
        if (current.dirty || current.conflict) && !discard {
            return Err(FileBufferError::Dirty {
                current: Box::new(current),
            });
        }
        conn.execute(
            "DELETE FROM file_buffers WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path],
        )
        .map_err(file_buffer_database_error)?;
        Ok(true)
    }

    pub fn session_exists(&self, id: &str) -> anyhow::Result<bool> {
        Ok(self.get_session(id)?.is_some())
    }

    pub fn set_cli_provider(&self, id: &str, provider_id: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET cli_provider_id = ?2 WHERE id = ?1",
            params![id, provider_id],
        )?;
        Ok(())
    }

    pub fn set_claude_session_id(&self, id: &str, claude_session_id: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET claude_session_id = ?2 WHERE id = ?1",
            params![id, claude_session_id],
        )?;
        Ok(())
    }

    pub fn set_codex_thread_id(&self, id: &str, codex_thread_id: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET codex_thread_id = ?2 WHERE id = ?1",
            params![id, codex_thread_id],
        )?;
        Ok(())
    }

    pub fn set_archived(&self, id: &str, archived: bool) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET archived = ?2 WHERE id = ?1",
            params![id, archived as i32],
        )?;
        Ok(())
    }

    /// Flip a CLI-mode session's `cli_activity` flag on — see the
    /// `cli_activity` migration comment and [`SESSION_VISIBILITY_FILTER`].
    /// Callers (`server.rs`'s `terminal.input` handler) are expected to only
    /// call this once per session per process lifetime (an in-memory set
    /// dedupes the per-keystroke calls); the `UPDATE` itself is naturally
    /// idempotent regardless.
    pub fn mark_cli_activity(&self, session_id: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET cli_activity = 1 WHERE id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    /// Record the CLI-mode auto-title (the session's first submitted prompt)
    /// — see the `cli_title` migration comment.
    ///
    /// The `WHERE ... cli_title IS NULL OR cli_title = ''` clause is the
    /// whole point: this is a *first* prompt, not a *latest* prompt, so once
    /// a session has one it must never be rewritten. Enforcing that in SQL
    /// rather than in the caller means a restart (which drops the in-memory
    /// "already titled" set) can't retitle a session from its next prompt.
    /// Returns whether a row was actually written, so the caller only pays
    /// for a `session.updated` broadcast when something changed.
    pub fn set_cli_title(&self, id: &str, title: &str) -> anyhow::Result<bool> {
        let changed = self.conn.lock().unwrap().execute(
            "UPDATE sessions SET cli_title = ?2
             WHERE id = ?1 AND (cli_title IS NULL OR cli_title = '')",
            params![id, title],
        )?;
        Ok(changed > 0)
    }

    /// Set (or clear, with an empty string) a user-chosen title override for
    /// a session. Once non-empty, `list_sessions`'s title expression prefers
    /// this over the auto-derived first-user-message snippet — see the
    /// `COALESCE(NULLIF(...))` there.
    pub fn set_title_override(&self, id: &str, title: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET title_override = ?2 WHERE id = ?1",
            params![id, title],
        )?;
        Ok(())
    }

    /// Permanently remove a session and all of its persisted messages. Unlike
    /// `set_archived`, this is destructive and irreversible — callers are
    /// responsible for tearing down any in-memory runtime/PTY state first.
    pub fn delete_session(&self, id: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE session_id = ?1", params![id])?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Fetch the persisted dockview layout blob (raw JSON text) for a
    /// session, Phase 3's Workspace → Tab → Pane model. `None` when the
    /// session row doesn't exist or has never had a layout saved.
    pub fn get_session_layout(&self, id: &str) -> anyhow::Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT pane_layout FROM sessions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(row.get::<_, Option<String>>(0)?)
        } else {
            Ok(None)
        }
    }

    /// Persist a session's dockview layout blob as raw JSON text. The server
    /// never interprets this value — it's opaque to Rust, only stored and
    /// echoed back verbatim via `session.layout`.
    pub fn set_session_layout(&self, id: &str, layout_json: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET pane_layout = ?2 WHERE id = ?1",
            params![id, layout_json],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Git previews, review comments, and prompt-operation receipts
    // -----------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn insert_git_preview(
        &self,
        preview_id: &str,
        operation: &str,
        workspace_id: &str,
        paths_json: &str,
        status_fingerprint: &str,
        message_digest: Option<&str>,
        message: Option<&str>,
        expires_at: i64,
    ) -> anyhow::Result<GitPreviewRow> {
        let conn = self.conn.lock().unwrap();
        let created_at = now_millis();
        conn.execute(
            "INSERT INTO git_previews
                (preview_id, operation, workspace_id, paths_json, status_fingerprint,
                 message_digest, message, expires_at, consumed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)",
            params![
                preview_id,
                operation,
                workspace_id,
                paths_json,
                status_fingerprint,
                message_digest,
                message,
                expires_at,
                created_at
            ],
        )?;
        get_git_preview_locked(&conn, preview_id)?
            .ok_or_else(|| anyhow::anyhow!("Git preview disappeared after insertion: {preview_id}"))
    }

    /// Atomically consume an unexpired preview for one workspace. Returning
    /// `None` covers unknown, expired, already-consumed, and cross-workspace
    /// receipts; callers must obtain a fresh preview rather than guessing.
    pub fn consume_git_preview(
        &self,
        preview_id: &str,
        workspace_id: &str,
        now: i64,
    ) -> anyhow::Result<Option<GitPreviewRow>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE git_previews SET consumed = 1
             WHERE preview_id = ?1 AND workspace_id = ?2
               AND consumed = 0 AND expires_at > ?3",
            params![preview_id, workspace_id, now],
        )?;
        if changed == 0 {
            return Ok(None);
        }
        get_git_preview_locked(&conn, preview_id)
    }

    pub fn insert_review_comment(&self, comment: &ReviewComment) -> anyhow::Result<()> {
        let json = serde_json::to_string(comment)?;
        self.conn.lock().unwrap().execute(
            "INSERT INTO review_comments
                (comment_id, workspace_id, version, comment_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                comment.id,
                comment.workspace_id,
                comment.version,
                json,
                comment.created_at,
                comment.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
    ) -> anyhow::Result<Option<ReviewComment>> {
        let conn = self.conn.lock().unwrap();
        get_review_comment_locked(&conn, workspace_id, comment_id)
    }

    pub fn list_review_comments(
        &self,
        workspace_id: &str,
        max: usize,
    ) -> anyhow::Result<Vec<ReviewComment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT comment_json FROM review_comments
             WHERE workspace_id = ?1
             ORDER BY updated_at ASC, comment_id ASC LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(params![workspace_id, max as i64], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows.into_iter()
            .map(|json| serde_json::from_str(&json).map_err(Into::into))
            .collect()
    }

    pub fn update_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
        expected_version: u64,
        comment: &ReviewComment,
    ) -> anyhow::Result<ReviewUpdateResult> {
        let json = serde_json::to_string(comment)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let current = get_review_comment_locked(&conn, workspace_id, comment_id)?;
            let Some(current) = current else {
                return anyhow::Ok(ReviewUpdateResult::NotFound);
            };
            if current.version != expected_version {
                return anyhow::Ok(ReviewUpdateResult::Conflict(current));
            }
            conn.execute(
                "UPDATE review_comments
                 SET version = ?4, comment_json = ?3, updated_at = ?5
                 WHERE workspace_id = ?1 AND comment_id = ?2 AND version = ?6",
                params![
                    workspace_id,
                    comment_id,
                    json,
                    comment.version,
                    comment.updated_at,
                    expected_version
                ],
            )?;
            anyhow::Ok(ReviewUpdateResult::Updated(comment.clone()))
        })();
        match outcome {
            Ok(result) => {
                conn.execute_batch("COMMIT")?;
                Ok(result)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn delete_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
        expected_version: u64,
    ) -> anyhow::Result<ReviewDeleteResult> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let current = get_review_comment_locked(&conn, workspace_id, comment_id)?;
            let Some(current) = current else {
                return anyhow::Ok(ReviewDeleteResult::NotFound);
            };
            if current.version != expected_version {
                return anyhow::Ok(ReviewDeleteResult::Conflict(current));
            }
            conn.execute(
                "DELETE FROM review_comments WHERE workspace_id = ?1 AND comment_id = ?2
                 AND version = ?3",
                params![workspace_id, comment_id, expected_version],
            )?;
            anyhow::Ok(ReviewDeleteResult::Deleted)
        })();
        match outcome {
            Ok(result) => {
                conn.execute_batch("COMMIT")?;
                Ok(result)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn insert_review_packet(
        &self,
        packet: &ReviewPacket,
        now: i64,
    ) -> anyhow::Result<ReviewPacketRow> {
        let json = serde_json::to_string(packet)?;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO review_packets
                (packet_id, send_operation_id, workspace_id, packet_json, state,
                 created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)",
            params![
                packet.packet_id,
                packet.send_operation_id,
                packet.workspace_id,
                json,
                now
            ],
        )?;
        let row = get_review_packet_locked(&conn, &packet.packet_id)?
            .ok_or_else(|| anyhow::anyhow!("review packet disappeared after insertion"))?;
        if row.packet.send_operation_id != packet.send_operation_id || row.packet != *packet {
            return Err(anyhow::anyhow!(
                "review packet id already belongs to a different payload"
            ));
        }
        Ok(row)
    }

    pub fn get_review_packet(&self, packet_id: &str) -> anyhow::Result<Option<ReviewPacketRow>> {
        let conn = self.conn.lock().unwrap();
        get_review_packet_locked(&conn, packet_id)
    }

    /// Look up the packet reserved for one send operation. The operation id
    /// is the stable key shared with `prompt_operations`, so completion of a
    /// normal chat dispatch can settle the corresponding review outbox row
    /// without keeping an in-memory packet map.
    pub fn get_review_packet_for_operation(
        &self,
        send_operation_id: &str,
    ) -> anyhow::Result<Option<ReviewPacketRow>> {
        let conn = self.conn.lock().unwrap();
        let packet_id = conn
            .query_row(
                "SELECT packet_id FROM review_packets
                 WHERE send_operation_id = ?1",
                params![send_operation_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        packet_id
            .map(|packet_id| get_review_packet_locked(&conn, &packet_id))
            .transpose()
            .map(|packet| packet.flatten())
    }

    /// Move a packet forward in its durable delivery state without ever
    /// downgrading `delivered` or `unconfirmed`. The operation/workspace pair
    /// is checked while the row is locked so a guessed packet id cannot be
    /// applied to another workspace.
    pub fn set_review_packet_state(
        &self,
        packet_id: &str,
        send_operation_id: &str,
        workspace_id: &str,
        state: &str,
        now: i64,
    ) -> anyhow::Result<Option<ReviewPacketRow>> {
        if !matches!(state, "queued" | "claimed" | "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!("invalid review packet state: {state}"));
        }
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_review_packet_locked(&conn, packet_id)? else {
            return Ok(None);
        };
        if current.packet.send_operation_id != send_operation_id
            || current.packet.workspace_id != workspace_id
        {
            return Ok(None);
        }
        let next = match current.state.as_str() {
            "delivered" => current.state.clone(),
            "unconfirmed" if state != "delivered" => current.state.clone(),
            "claimed" if state == "queued" => current.state.clone(),
            _ => state.to_string(),
        };
        conn.execute(
            "UPDATE review_packets SET state = ?2, updated_at = ?3 WHERE packet_id = ?1",
            params![packet_id, next, now],
        )?;
        get_review_packet_locked(&conn, packet_id)
    }

    /// Claim a queued review packet with a compare-and-set. The row and the
    /// winner bit are returned under the same connection lock, so only the
    /// caller that changed `queued` to `claimed` may dispatch the packet.
    pub fn claim_review_packet(
        &self,
        packet_id: &str,
        send_operation_id: &str,
        workspace_id: &str,
        now: i64,
    ) -> anyhow::Result<Option<(ReviewPacketRow, bool)>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE review_packets SET state = 'claimed', updated_at = ?4
             WHERE packet_id = ?1 AND send_operation_id = ?2
               AND workspace_id = ?3 AND state = 'queued'",
            params![packet_id, send_operation_id, workspace_id, now],
        )?;
        Ok(get_review_packet_locked(&conn, packet_id)?.map(|row| (row, changed == 1)))
    }

    /// A claimed packet crossed the dispatch boundary. A restart cannot prove
    /// whether the provider accepted it, so leave it recoverable as
    /// `unconfirmed` instead of silently retrying it.
    pub fn mark_claimed_review_packets_unconfirmed(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE review_packets SET state = 'unconfirmed', updated_at = ?1
             WHERE state = 'claimed'",
            params![now_millis()],
        )?)
    }

    /// Reconcile the review outbox with its shared prompt operation after a
    /// restart. A packet and its prompt are intentionally separate rows so
    /// older databases can migrate additively; this pass closes the small
    /// crash window between either row being claimed and the other row being
    /// written. A claimed packet with no prompt is always unconfirmed, while
    /// a prompt that reached `delivered` is safe to promote its packet to the
    /// same terminal state.
    pub fn reconcile_review_packets_with_prompt_operations(&self) -> anyhow::Result<usize> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT packet_id, send_operation_id, state
             FROM review_packets
             WHERE state IN ('queued', 'claimed', 'unconfirmed')",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(stmt);

        let mut changed = 0usize;
        for (packet_id, operation_id, packet_state) in rows {
            let prompt_state = conn
                .query_row(
                    "SELECT state FROM prompt_operations WHERE operation_id = ?1",
                    params![operation_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            let next = match (packet_state.as_str(), prompt_state.as_deref()) {
                // A completed prompt is durable evidence that the packet was
                // handed to the session, even if the packet update itself
                // was interrupted.
                (_, Some("delivered")) => Some("delivered"),
                // A claimed/unconfirmed prompt may already have reached the
                // provider. Never turn it back into a dispatchable packet.
                (_, Some("claimed" | "unconfirmed")) => Some("unconfirmed"),
                // A claimed packet with no corresponding prompt is the old
                // packet-before-prompt crash window; it is uncertain too.
                ("claimed" | "unconfirmed", None) => Some("unconfirmed"),
                _ => None,
            };
            if let Some(next) = next.filter(|next| *next != packet_state) {
                changed += conn.execute(
                    "UPDATE review_packets SET state = ?2, updated_at = ?3
                     WHERE packet_id = ?1",
                    params![packet_id, next, now_millis()],
                )?;
            }
        }
        Ok(changed)
    }

    /// Reserve a prompt operation and its user message in one SQLite
    /// transaction. A retry with the same operation id is accepted only when
    /// its session, workspace, and payload digest all match; it never creates
    /// a second message row.
    #[allow(clippy::too_many_arguments)]
    pub fn reserve_prompt_operation(
        &self,
        operation_id: &str,
        session_id: &str,
        workspace_id: Option<&str>,
        payload_digest: &str,
        content: &str,
        agent: Option<&str>,
        model: Option<&str>,
    ) -> anyhow::Result<(PromptOperationRow, bool)> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let existing = get_prompt_operation_locked(&conn, operation_id)?;
            if let Some(existing) = existing {
                if existing.session_id != session_id
                    || existing.workspace_id.as_deref() != workspace_id
                    || existing.payload_digest != payload_digest
                {
                    return Err(anyhow::anyhow!(
                        "prompt operation id is already bound to a different payload"
                    ));
                }
                return anyhow::Ok((existing, false));
            }
            let now = now_millis();
            conn.execute(
                "INSERT INTO prompt_operations
                    (operation_id, session_id, workspace_id, payload_digest, state,
                     created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)",
                params![operation_id, session_id, workspace_id, payload_digest, now],
            )?;
            conn.execute(
                "INSERT INTO messages
                    (session_id, role, content, agent, model, thinking, operation_id,
                     created_at)
                 VALUES (?1, 'user', ?2, ?3, ?4, NULL, ?5, ?6)",
                params![session_id, content, agent, model, operation_id, now],
            )?;
            let row = get_prompt_operation_locked(&conn, operation_id)?
                .ok_or_else(|| anyhow::anyhow!("prompt operation disappeared after insertion"))?;
            anyhow::Ok((row, true))
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn get_prompt_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<PromptOperationRow>> {
        let conn = self.conn.lock().unwrap();
        get_prompt_operation_locked(&conn, operation_id)
    }

    /// Claim only queued operations. The update and row read happen while
    /// the connection is locked, and `won_claim` records whether this caller
    /// changed the row. Repeated callers receive the current state with
    /// `won_claim = false`, which prevents two connections from launching the
    /// same prompt.
    pub fn claim_prompt_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<PromptClaim>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE prompt_operations SET state = 'claimed', updated_at = ?2
             WHERE operation_id = ?1 AND state = 'queued'",
            params![operation_id, now_millis()],
        )?;
        Ok(
            get_prompt_operation_locked(&conn, operation_id)?.map(|operation| PromptClaim {
                operation,
                won_claim: changed == 1,
            }),
        )
    }

    pub fn set_prompt_operation_state(
        &self,
        operation_id: &str,
        state: &str,
    ) -> anyhow::Result<()> {
        if !matches!(state, "queued" | "claimed" | "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!("invalid prompt operation state: {state}"));
        }
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_prompt_operation_locked(&conn, operation_id)? else {
            return Ok(());
        };
        // `unconfirmed` means the dispatch boundary was crossed before a
        // restart or disconnect. It is terminal until a caller has positive
        // evidence of delivery; a retry must never downgrade it back into a
        // dispatchable state. `delivered` is likewise immutable.
        let next = match current.state.as_str() {
            "delivered" => "delivered",
            "unconfirmed" if state != "delivered" => "unconfirmed",
            "claimed" if state == "queued" => "claimed",
            _ => state,
        };
        if next != current.state {
            conn.execute(
                "UPDATE prompt_operations SET state = ?2, updated_at = ?3
                 WHERE operation_id = ?1",
                params![operation_id, next, now_millis()],
            )?;
        }
        Ok(())
    }

    /// Atomically settle a prompt dispatch and the review packet that uses
    /// the same operation id. The two rows are separate for migration
    /// compatibility, but publishing one durable outcome must not leave the
    /// packet claiming success while the prompt is still uncertain (or vice
    /// versa).
    pub fn settle_prompt_dispatch(
        &self,
        operation_id: &str,
        state: &str,
        now: i64,
    ) -> anyhow::Result<Option<PromptOperationRow>> {
        if !matches!(state, "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!(
                "invalid prompt dispatch settlement state: {state}"
            ));
        }
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let Some(current) = get_prompt_operation_locked(&conn, operation_id)? else {
                return anyhow::Ok(None);
            };
            let next_prompt = match current.state.as_str() {
                "delivered" => "delivered",
                "unconfirmed" if state != "delivered" => "unconfirmed",
                _ => state,
            };
            if next_prompt != current.state {
                conn.execute(
                    "UPDATE prompt_operations SET state = ?2, updated_at = ?3
                     WHERE operation_id = ?1",
                    params![operation_id, next_prompt, now],
                )?;
            }

            let packet = conn
                .query_row(
                    "SELECT packet_id, state FROM review_packets
                     WHERE send_operation_id = ?1",
                    params![operation_id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()?;
            if let Some((packet_id, packet_state)) = packet {
                let next_packet = match packet_state.as_str() {
                    "delivered" => "delivered",
                    "unconfirmed" if next_prompt != "delivered" => "unconfirmed",
                    _ if next_prompt == "delivered" => "delivered",
                    _ => "unconfirmed",
                };
                if next_packet != packet_state {
                    conn.execute(
                        "UPDATE review_packets SET state = ?2, updated_at = ?3
                         WHERE packet_id = ?1",
                        params![packet_id, next_packet, now],
                    )?;
                }
            }
            get_prompt_operation_locked(&conn, operation_id)
        })();
        match outcome {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Begin an agent turn's Git change boundary.  The insert is keyed by
    /// `operation_id`, so a reconnect that retries the same prompt receives
    /// the original before snapshot and cannot overwrite it with a later
    /// working-tree state.
    pub fn begin_agent_change_snapshot(
        &self,
        start: AgentChangeSnapshotStart<'_>,
    ) -> anyhow::Result<AgentChangeSnapshotRow> {
        validate_agent_snapshot_identity(start.snapshot_id, "snapshot")?;
        validate_agent_snapshot_identity(start.operation_id, "operation")?;
        validate_agent_snapshot_identity(start.workspace_id, "workspace")?;
        validate_agent_snapshot_identity(start.session_id, "session")?;
        validate_agent_snapshot_identity(start.agent, "agent")?;
        validate_agent_snapshot_text(start.before_status, "before status")?;
        let before_paths_json = encode_agent_snapshot_paths(start.before_paths)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            if let Some(existing) = get_agent_change_snapshot_locked(&conn, start.operation_id)? {
                if existing.workspace_id != start.workspace_id
                    || existing.session_id != start.session_id
                    || existing.agent != start.agent
                    || existing.before_head.as_deref() != start.before_head
                    || existing.before_branch.as_deref() != start.before_branch
                    || existing.before_status != start.before_status
                    || serde_json::to_string(&existing.before_paths)? != before_paths_json
                {
                    return Err(anyhow::anyhow!(
                        "agent change operation id is already bound to a different boundary"
                    ));
                }
                return anyhow::Ok(existing);
            }
            conn.execute(
                "INSERT INTO agent_change_snapshots
                    (snapshot_id, operation_id, workspace_id, session_id, agent,
                     before_head, before_branch, before_status, before_paths_json,
                     completed, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10)",
                params![
                    start.snapshot_id,
                    start.operation_id,
                    start.workspace_id,
                    start.session_id,
                    start.agent,
                    start.before_head,
                    start.before_branch,
                    start.before_status,
                    before_paths_json,
                    start.created_at,
                ],
            )?;
            get_agent_change_snapshot_locked(&conn, start.operation_id)?
                .ok_or_else(|| anyhow::anyhow!("agent change snapshot disappeared after insertion"))
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Finish one agent turn's Git change boundary exactly once.  The changed
    /// path set is the union of before and after status paths, which preserves
    /// a path that an agent modified and then restored to clean.  A retry
    /// after completion returns the first durable after snapshot unchanged.
    pub fn finish_agent_change_snapshot(
        &self,
        finish: AgentChangeSnapshotFinish<'_>,
    ) -> anyhow::Result<Option<AgentChangeSnapshotRow>> {
        validate_agent_snapshot_identity(finish.snapshot_id, "snapshot")?;
        validate_agent_snapshot_text(finish.after_status, "after status")?;
        let after_paths_json = encode_agent_snapshot_paths(finish.after_paths)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let Some(current) = get_agent_change_snapshot_locked(&conn, finish.snapshot_id)? else {
                return anyhow::Ok(None);
            };
            if current.completed {
                return anyhow::Ok(Some(current));
            }
            let mut changed_paths = current.before_paths.clone();
            changed_paths.extend(finish.after_paths.iter().cloned());
            changed_paths.sort();
            changed_paths.dedup();
            let changed_paths_json = encode_agent_snapshot_paths(&changed_paths)?;
            conn.execute(
                "UPDATE agent_change_snapshots
                 SET after_head = ?2, after_branch = ?3, after_status = ?4,
                     after_paths_json = ?5, changed_paths_json = ?6,
                     completed = 1, completed_at = ?7
                 WHERE snapshot_id = ?1 AND completed = 0",
                params![
                    finish.snapshot_id,
                    finish.after_head,
                    finish.after_branch,
                    finish.after_status,
                    after_paths_json,
                    changed_paths_json,
                    finish.completed_at,
                ],
            )?;
            get_agent_change_snapshot_locked(&conn, finish.snapshot_id)
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Return completed and in-flight turn boundaries newest first.  The
    /// caller supplies a small limit; this method never exposes an unbounded
    /// history slice to a UI reconnect.
    pub fn list_agent_change_snapshots(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<AgentChangeSnapshotRow>> {
        validate_agent_snapshot_identity(workspace_id, "workspace")?;
        let limit = limit.min(MAX_AGENT_CHANGE_PATHS);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT snapshot_id, operation_id, workspace_id, session_id, agent,
                    before_head, before_branch, before_status, before_paths_json,
                    after_head, after_branch, after_status, after_paths_json,
                    changed_paths_json, completed, created_at, completed_at
             FROM agent_change_snapshots
             WHERE workspace_id = ?1
             ORDER BY created_at DESC, snapshot_id DESC
             LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(
                params![workspace_id, limit as i64],
                agent_change_snapshot_row_from_row,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// A claimed operation has crossed the dispatch boundary. After a process
    /// restart there is no safe way to know whether the provider accepted it,
    /// so preserve the packet and mark it unconfirmed instead of relaunching.
    pub fn mark_claimed_prompt_operations_unconfirmed(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE prompt_operations SET state = 'unconfirmed', updated_at = ?1
             WHERE state = 'claimed'",
            params![now_millis()],
        )?)
    }

    /// Persist the agent name and model alias used for the most recently
    /// completed turn. Called from `persist_turn` in `server.rs` so that after
    /// a server restart, entering CLI mode can reconstruct `--model <alias>`
    /// from the DB row rather than letting claude fall back to the dated
    /// snapshot id in its transcript (which the GenAI proxy 404s).
    pub fn update_session_last_model(
        &self,
        id: &str,
        agent: &str,
        model: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET last_agent = ?2, last_model = ?3 WHERE id = ?1",
            params![id, agent, model],
        )?;
        Ok(())
    }

    pub fn add_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
        agent: Option<&str>,
        model: Option<&str>,
        thinking: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO messages (session_id, role, content, agent, model, thinking, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session_id,
                role,
                content,
                agent,
                model,
                thinking,
                now_millis()
            ],
        )?;
        Ok(())
    }

    pub fn get_messages(&self, session_id: &str) -> anyhow::Result<Vec<MessageRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, agent, model, thinking, operation_id, created_at
             FROM messages WHERE session_id = ?1 ORDER BY id ASC",
        )?;
        let rows = stmt
            .query_map(params![session_id], |row| {
                Ok(MessageRow {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    agent: row.get(4)?,
                    model: row.get(5)?,
                    thinking: row.get(6)?,
                    operation_id: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// Load a session's full transcript as wire-ready `HistoryMessage`s,
    /// used to answer `session.resume` (works even after a server restart,
    /// since it reads from SQLite rather than the in-memory ring buffer).
    pub fn load_messages(&self, session_id: &str) -> anyhow::Result<Vec<HistoryMessage>> {
        Ok(self
            .get_messages(session_id)?
            .into_iter()
            .map(|row| HistoryMessage {
                id: row.id.to_string(),
                role: row.role,
                text: row.content,
                agent: row.agent.and_then(|a| match a.as_str() {
                    "claude" => Some(crate::protocol::AgentKind::Claude),
                    "codex" => Some(crate::protocol::AgentKind::Codex),
                    _ => None,
                }),
                model: row.model,
                thinking: row.thinking,
                created_at: Some(row.created_at),
            })
            .collect())
    }

    /// Return all sessions ordered newest-first, with title (first user
    /// message snippet) and last-agent/model via correlated subqueries.
    /// Sessions with zero messages AND no CLI activity are excluded (Fix 3:
    /// blank sessions are not inserted into the DB until the first message
    /// arrives, but any pre-existing zero-message/no-activity rows from
    /// before this change are also hidden). CLI-mode sessions become visible
    /// on first keystroke instead — see [`SESSION_VISIBILITY_FILTER`].
    /// Used to build `session.list` and `session.updated` wire messages.
    pub fn list_sessions(&self) -> anyhow::Result<Vec<SessionListRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!(
            "{SESSION_LIST_ROW_SELECT}
             WHERE {SESSION_VISIBILITY_FILTER}
             ORDER BY s.created_at DESC"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map([], session_list_row_from_row)?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// Single-row counterpart to [`Self::list_sessions`], used by the
    /// `session_events_tx` forwarder in `server.rs` to fetch the one row that
    /// changed instead of re-running the full multi-subquery list query per
    /// event per connected client. Column semantics are shared with
    /// `list_sessions` via [`SESSION_LIST_ROW_SELECT`] / [`session_list_row_from_row`]
    /// so a `session.updated` push can never disagree with the row the same
    /// session would have in `session.list`.
    ///
    /// Deliberately keeps the same [`SESSION_VISIBILITY_FILTER`] as
    /// `list_sessions`: a session with zero messages and no CLI activity yet
    /// is not returned, matching prior behaviour (the old call site built the
    /// full list via `list_sessions()` and then `.find()`d the id in it — an
    /// invisible session was never in that list, so it never produced a
    /// `session.updated` push either).
    pub fn get_session_row(&self, id: &str) -> anyhow::Result<Option<SessionListRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!(
            "{SESSION_LIST_ROW_SELECT}
             WHERE s.id = ?1 AND {SESSION_VISIBILITY_FILTER}"
        );
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![id], session_list_row_from_row)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    // -----------------------------------------------------------------------
    // Detached runs (direct-mode hosts — see `detached.rs`)
    // -----------------------------------------------------------------------

    /// Record a freshly-launched detached turn as `status = 'running'`.
    pub fn insert_detached_run(&self, run: &DetachedRunRow) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT OR REPLACE INTO detached_runs
                (run_id, session_id, host_id, ssh_host, agent, model, cwd, run_dir, log_path,
                 pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status,
                 created_at, operation_id)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
            params![
                run.run_id,
                run.session_id,
                run.host_id,
                run.ssh_host,
                run.agent,
                run.model,
                run.cwd,
                run.run_dir,
                run.log_path,
                run.pid,
                run.pgid,
                run.proc_start,
                run.cursor_offset,
                run.cursor_inode,
                run.provider_session_id,
                run.status,
                run.created_at,
                run.operation_id,
            ],
        )?;
        Ok(())
    }

    /// Attach the process identity to a run row that was written *before* the
    /// remote launch (see the durability barrier in `detached.rs`). Split from
    /// `insert_detached_run` so the row exists from the moment perch commits
    /// to running a turn, not from the moment the remote answers.
    pub fn attach_detached_pid(
        &self,
        run_id: &str,
        pid: i64,
        pgid: i64,
        proc_start: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs SET pid = ?2, pgid = ?3, proc_start = ?4 WHERE run_id = ?1",
            params![run_id, pid, pgid, proc_start],
        )?;
        Ok(())
    }

    /// Persist the tail cursor for a run. Written when a tail child ends (not
    /// per line) — within one perch lifetime the authoritative cursor is the
    /// in-memory one; this copy exists so a *reaper* can tell how much of a
    /// log was ingested, and to make the truncation check on re-attach
    /// meaningful. See `detached.rs` for why recovery still re-reads from 0.
    pub fn update_detached_cursor(
        &self,
        run_id: &str,
        offset: u64,
        inode: u64,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs SET cursor_offset = ?2, cursor_inode = ?3 WHERE run_id = ?1",
            params![run_id, offset as i64, inode as i64],
        )?;
        Ok(())
    }

    /// Terminal state for a run: `'done' | 'failed' | 'cancelled'`.
    pub fn finish_detached_run(
        &self,
        run_id: &str,
        status: &str,
        provider_session_id: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs
             SET status = ?2, provider_session_id = COALESCE(?3, provider_session_id)
             WHERE run_id = ?1",
            params![run_id, status, provider_session_id],
        )?;
        Ok(())
    }

    /// Every run still marked `running` — the recovery worklist a fresh perch
    /// process reads at startup.
    pub fn unfinished_detached_runs(&self) -> anyhow::Result<Vec<DetachedRunRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT run_id, session_id, host_id, ssh_host, agent, model, cwd, run_dir, log_path,
                    pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status,
                    created_at, operation_id
             FROM detached_runs WHERE status = 'running' ORDER BY created_at ASC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DetachedRunRow {
                    run_id: row.get(0)?,
                    session_id: row.get(1)?,
                    host_id: row.get(2)?,
                    ssh_host: row.get(3)?,
                    agent: row.get(4)?,
                    model: row.get(5)?,
                    cwd: row.get(6)?,
                    run_dir: row.get(7)?,
                    log_path: row.get(8)?,
                    pid: row.get(9)?,
                    pgid: row.get(10)?,
                    proc_start: row.get(11)?,
                    cursor_offset: row.get(12)?,
                    cursor_inode: row.get(13)?,
                    provider_session_id: row.get(14)?,
                    status: row.get(15)?,
                    created_at: row.get(16)?,
                    operation_id: row.get(17)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// The most recent still-running run for a session, if any — used by
    /// `chat.cancel` to find the process group to signal.
    pub fn running_detached_run_for_session(
        &self,
        session_id: &str,
    ) -> anyhow::Result<Option<DetachedRunRow>> {
        Ok(self
            .unfinished_detached_runs()?
            .into_iter()
            .rfind(|r| r.session_id == session_id))
    }
}

/// One detached turn's durable record. Mirrors the `detached_runs` table.
#[derive(Debug, Clone)]
pub struct DetachedRunRow {
    pub run_id: String,
    pub session_id: String,
    pub host_id: String,
    pub ssh_host: String,
    /// `"claude"` | `"codex"`.
    pub agent: String,
    pub model: Option<String>,
    pub cwd: String,
    pub run_dir: String,
    pub log_path: String,
    /// Pid of the detached job's top-level shell — what liveness checks probe.
    pub pid: Option<i64>,
    /// Process-group id of that job, read back from `ps` at launch rather than
    /// assumed (under `bash -c 'set -m'` it equals `pid`, but the launcher has
    /// a non-bash fallback). Cancel signals the whole *group*, so a `claude`
    /// that shelled out doesn't leak children.
    pub pgid: Option<i64>,
    /// Opaque start-time identity of `pid` captured at launch (Linux
    /// `/proc/<pid>/stat` field 22, else `ps -o lstart=`). Compared verbatim
    /// on recovery so a recycled pid can't masquerade as a live turn.
    pub proc_start: Option<String>,
    pub cursor_offset: i64,
    pub cursor_inode: i64,
    /// The provider's own continuity id scraped from the run log (claude
    /// `session_id` / codex `thread_id`).
    pub provider_session_id: Option<String>,
    /// `'running' | 'done' | 'failed' | 'cancelled'`.
    pub status: String,
    pub created_at: i64,
    /// The prompt operation that launched this run, when the run was created
    /// by the durable hosted/review send path. Legacy rows may have none.
    pub operation_id: Option<String>,
}

/// Normalize empty/null-like host ids to the local namespace. Callers must
/// invoke this only for values that have already been selected as local or
/// remote; it never aliases a non-empty remote id to local.
fn normalized_host_id(host_id: &str) -> &str {
    if host_id.trim().is_empty() {
        "local"
    } else {
        host_id
    }
}

/// Canonicalize a path for durable host-scoped identity.
///
/// Local paths use the filesystem's canonical spelling when the directory
/// exists, then fall back to a lexical absolute normalization. Remote paths
/// are never passed to local canonicalize or is_dir; doing so could
/// accidentally identify a remote workspace with an unrelated local path.
pub fn canonical_path_for_host(host_id: &str, raw_path: &str) -> String {
    let host_id = normalized_host_id(host_id);
    let raw_path = raw_path.trim();
    let expanded = if host_id == "local" {
        expand_local_tilde(raw_path)
    } else {
        raw_path.to_string()
    };
    if host_id == "local" {
        if let Ok(path) = std::fs::canonicalize(&expanded) {
            return path.to_string_lossy().to_string();
        }
    }
    lexical_normalize_path(&expanded, host_id == "local")
}

fn expand_local_tilde(path: &str) -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    if path == "~" {
        home
    } else if path.starts_with("~/") {
        format!("{home}{}", &path[1..])
    } else if path.is_empty() {
        home
    } else {
        path.to_string()
    }
}

fn lexical_normalize_path(path: &str, make_absolute: bool) -> String {
    let raw = Path::new(path);
    let owned_base;
    let base = if make_absolute && !raw.is_absolute() {
        owned_base = std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("/"))
            .join(raw);
        owned_base.as_path()
    } else {
        raw
    };

    let mut normalized = PathBuf::new();
    for component in base.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new("/")),
            Component::CurDir => {}
            Component::ParentDir => {
                // Never climb above a root. Relative remote paths retain a
                // leading .. only when there is no segment to pop.
                if !normalized.pop() && !make_absolute {
                    normalized.push("..");
                }
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    let result = normalized.to_string_lossy().to_string();
    if result.is_empty() {
        if make_absolute {
            "/".to_string()
        } else {
            ".".to_string()
        }
    } else {
        result
    }
}

fn project_name_for_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Project")
        .to_string()
}

fn get_git_preview_locked(
    conn: &Connection,
    preview_id: &str,
) -> anyhow::Result<Option<GitPreviewRow>> {
    conn.query_row(
        "SELECT preview_id, operation, workspace_id, paths_json, status_fingerprint,
                message_digest, message, expires_at, consumed, created_at
         FROM git_previews WHERE preview_id = ?1",
        params![preview_id],
        |row| {
            Ok(GitPreviewRow {
                preview_id: row.get(0)?,
                operation: row.get(1)?,
                workspace_id: row.get(2)?,
                paths_json: row.get(3)?,
                status_fingerprint: row.get(4)?,
                message_digest: row.get(5)?,
                message: row.get(6)?,
                expires_at: row.get(7)?,
                consumed: row.get::<_, i32>(8)? != 0,
                created_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn get_review_comment_locked(
    conn: &Connection,
    workspace_id: &str,
    comment_id: &str,
) -> anyhow::Result<Option<ReviewComment>> {
    let json = conn
        .query_row(
            "SELECT comment_json FROM review_comments
             WHERE workspace_id = ?1 AND comment_id = ?2",
            params![workspace_id, comment_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    json.map(|json| serde_json::from_str(&json).map_err(Into::into))
        .transpose()
}

fn get_review_packet_locked(
    conn: &Connection,
    packet_id: &str,
) -> anyhow::Result<Option<ReviewPacketRow>> {
    let row = conn
        .query_row(
            "SELECT packet_json, state, created_at, updated_at
             FROM review_packets WHERE packet_id = ?1",
            params![packet_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()?;
    row.map(|(json, state, created_at, updated_at)| {
        Ok(ReviewPacketRow {
            packet: serde_json::from_str(&json)?,
            state,
            created_at,
            updated_at,
        })
    })
    .transpose()
}

fn get_prompt_operation_locked(
    conn: &Connection,
    operation_id: &str,
) -> anyhow::Result<Option<PromptOperationRow>> {
    conn.query_row(
        "SELECT operation_id, session_id, workspace_id, payload_digest, state,
                created_at, updated_at
         FROM prompt_operations WHERE operation_id = ?1",
        params![operation_id],
        |row| {
            Ok(PromptOperationRow {
                operation_id: row.get(0)?,
                session_id: row.get(1)?,
                workspace_id: row.get(2)?,
                payload_digest: row.get(3)?,
                state: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn validate_agent_snapshot_identity(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty() || value.len() > 512 || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "agent change {label} is empty, oversized, or contains NUL"
        ));
    }
    Ok(())
}

fn validate_workspace_metadata(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty() || value.len() > 4096 || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "workspace {label} is empty, oversized, or contains NUL"
        ));
    }
    Ok(())
}

fn validate_agent_snapshot_text(value: &str, label: &str) -> anyhow::Result<()> {
    if value.len() > MAX_AGENT_CHANGE_STATUS_BYTES || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "agent change {label} exceeds the {MAX_AGENT_CHANGE_STATUS_BYTES}-byte limit"
        ));
    }
    Ok(())
}

fn encode_agent_snapshot_paths(paths: &[String]) -> anyhow::Result<String> {
    if paths.len() > MAX_AGENT_CHANGE_PATHS {
        return Err(anyhow::anyhow!(
            "agent change path set exceeds {MAX_AGENT_CHANGE_PATHS} entries"
        ));
    }
    let mut normalized = paths.to_vec();
    for path in &normalized {
        if path.is_empty() || path.len() > 4096 || path.contains('\0') {
            return Err(anyhow::anyhow!("agent change path is invalid or oversized"));
        }
    }
    normalized.sort();
    normalized.dedup();
    let encoded = serde_json::to_string(&normalized)?;
    if encoded.len() > MAX_AGENT_CHANGE_STATUS_BYTES {
        return Err(anyhow::anyhow!(
            "agent change path set exceeds the {MAX_AGENT_CHANGE_STATUS_BYTES}-byte limit"
        ));
    }
    Ok(encoded)
}

fn decode_agent_snapshot_paths(json: &str) -> anyhow::Result<Vec<String>> {
    let paths: Vec<String> = serde_json::from_str(json)?;
    // Validate persisted rows too: a corrupt/old DB must fail closed rather
    // than return unbounded path metadata to the UI.
    let encoded = encode_agent_snapshot_paths(&paths)?;
    let canonical: Vec<String> = serde_json::from_str(&encoded)?;
    Ok(canonical)
}

fn agent_change_snapshot_row_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<AgentChangeSnapshotRow> {
    let before_paths_json: String = row.get(8)?;
    let after_paths_json: Option<String> = row.get(12)?;
    let changed_paths_json: Option<String> = row.get(13)?;
    let before_paths = decode_agent_snapshot_paths(&before_paths_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            8,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::other(error.to_string())),
        )
    })?;
    let after_paths = after_paths_json
        .as_deref()
        .map(decode_agent_snapshot_paths)
        .transpose()
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                12,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::other(error.to_string())),
            )
        })?;
    let changed_paths = changed_paths_json
        .as_deref()
        .map(decode_agent_snapshot_paths)
        .transpose()
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                13,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::other(error.to_string())),
            )
        })?;
    Ok(AgentChangeSnapshotRow {
        snapshot_id: row.get(0)?,
        operation_id: row.get(1)?,
        workspace_id: row.get(2)?,
        session_id: row.get(3)?,
        agent: row.get(4)?,
        before_head: row.get(5)?,
        before_branch: row.get(6)?,
        before_status: row.get(7)?,
        before_paths,
        after_head: row.get(9)?,
        after_branch: row.get(10)?,
        after_status: row.get(11)?,
        after_paths,
        changed_paths,
        completed: row.get::<_, i32>(14)? != 0,
        created_at: row.get(15)?,
        completed_at: row.get(16)?,
    })
}

fn get_agent_change_snapshot_locked(
    conn: &Connection,
    key: &str,
) -> anyhow::Result<Option<AgentChangeSnapshotRow>> {
    conn.query_row(
        "SELECT snapshot_id, operation_id, workspace_id, session_id, agent,
                before_head, before_branch, before_status, before_paths_json,
                after_head, after_branch, after_status, after_paths_json,
                changed_paths_json, completed, created_at, completed_at
         FROM agent_change_snapshots
         WHERE snapshot_id = ?1 OR operation_id = ?1
         ORDER BY snapshot_id = ?1 DESC
         LIMIT 1",
        params![key],
        agent_change_snapshot_row_from_row,
    )
    .optional()
    .map_err(Into::into)
}

fn project_row_from_row(row: &rusqlite::Row) -> rusqlite::Result<ProjectRow> {
    Ok(ProjectRow {
        id: row.get(0)?,
        host_id: row.get(1)?,
        name: row.get(2)?,
        path: row.get(3)?,
        repo_path: row.get(4)?,
        default_branch: row.get(5)?,
        favorite: row.get::<_, i32>(6).unwrap_or(0) != 0,
        archived: row.get::<_, i32>(7).unwrap_or(0) != 0,
        settings: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn workspace_row_from_row(row: &rusqlite::Row) -> rusqlite::Result<WorkspaceRow> {
    Ok(WorkspaceRow {
        id: row.get(0)?,
        project_id: row.get(1)?,
        host_id: row.get(2)?,
        path: row.get(3)?,
        name: row.get(4)?,
        branch: row.get(5)?,
        base_branch: row.get(6)?,
        dirty: row.get::<_, i32>(7).unwrap_or(0) != 0,
        start_snapshot: row.get(8)?,
        parent_workspace_id: row.get(9)?,
        state: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn get_project_locked(conn: &Connection, id: &str) -> anyhow::Result<Option<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                settings, created_at, updated_at
         FROM projects WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(project_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn get_workspace_locked(conn: &Connection, id: &str) -> anyhow::Result<Option<WorkspaceRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                start_snapshot, parent_workspace_id, state, created_at, updated_at
         FROM workspaces WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(workspace_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn list_projects_locked(conn: &Connection, host_id: &str) -> anyhow::Result<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                settings, created_at, updated_at
         FROM projects WHERE host_id = ?1
         ORDER BY favorite DESC, updated_at DESC, id ASC",
    )?;
    let rows = stmt
        .query_map(params![host_id], project_row_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn list_workspaces_locked(
    conn: &Connection,
    host_id: &str,
    project_id: Option<&str>,
) -> anyhow::Result<Vec<WorkspaceRow>> {
    let mut rows = Vec::new();
    if let Some(project_id) = project_id {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                    start_snapshot, parent_workspace_id, state, created_at, updated_at
             FROM workspaces WHERE host_id = ?1 AND project_id = ?2
             ORDER BY created_at ASC, id ASC",
        )?;
        for row in stmt.query_map(params![host_id, project_id], workspace_row_from_row)? {
            rows.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                    start_snapshot, parent_workspace_id, state, created_at, updated_at
             FROM workspaces WHERE host_id = ?1
             ORDER BY created_at ASC, id ASC",
        )?;
        for row in stmt.query_map(params![host_id], workspace_row_from_row)? {
            rows.push(row?);
        }
    }
    Ok(rows)
}

fn get_default_workspace_locked(
    conn: &Connection,
    project_id: &str,
) -> anyhow::Result<Option<WorkspaceRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                start_snapshot, parent_workspace_id, state, created_at, updated_at
         FROM workspaces WHERE project_id = ?1 ORDER BY created_at ASC, id ASC LIMIT 1",
    )?;
    let mut rows = stmt.query(params![project_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(workspace_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn set_workspace_focus_locked(
    conn: &Connection,
    host_id: &str,
    project_id: &str,
    workspace_id: &str,
) -> anyhow::Result<()> {
    conn.execute(
        "INSERT INTO workspace_state (host_id, active_project_id, active_workspace_id, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(host_id) DO UPDATE SET
           active_project_id = excluded.active_project_id,
           active_workspace_id = excluded.active_workspace_id,
           updated_at = excluded.updated_at",
        params![host_id, project_id, workspace_id, now_millis()],
    )?;
    Ok(())
}

fn active_focus_locked(
    conn: &Connection,
    host_id: &str,
) -> anyhow::Result<(Option<String>, Option<String>)> {
    let mut stmt = conn.prepare(
        "SELECT active_project_id, active_workspace_id
         FROM workspace_state WHERE host_id = ?1",
    )?;
    let mut rows = stmt.query(params![host_id])?;
    if let Some(row) = rows.next()? {
        Ok((row.get(0)?, row.get(1)?))
    } else {
        Ok((None, None))
    }
}

/// Ensure one project/default workspace pair exists. archive_project is used
/// only by the legacy import; normal user-created projects start active.
fn ensure_project_workspace_locked(
    conn: &Connection,
    host_id: &str,
    raw_path: &str,
    requested_name: Option<&str>,
    archive_project: bool,
) -> anyhow::Result<(String, String)> {
    let host_id = normalized_host_id(host_id);
    let path = canonical_path_for_host(host_id, raw_path);
    let existing_project: Option<(String, bool)> = {
        let mut stmt =
            conn.prepare("SELECT id, archived FROM projects WHERE host_id = ?1 AND path = ?2")?;
        let mut rows = stmt.query(params![host_id, path])?;
        rows.next()?
            .map(|row| {
                Ok::<(String, bool), rusqlite::Error>((
                    row.get(0)?,
                    row.get::<_, i32>(1).unwrap_or(0) != 0,
                ))
            })
            .transpose()?
    };

    let project_id = if let Some((id, _)) = existing_project {
        id
    } else {
        let id = Uuid::new_v4().to_string();
        let now = now_millis();
        let name = requested_name
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| project_name_for_path(&path));
        let repo_path = if host_id == "local" && Path::new(&path).join(".git").exists() {
            Some(path.clone())
        } else {
            None
        };
        conn.execute(
            "INSERT INTO projects
                (id, host_id, name, path, repo_path, default_branch, favorite, archived,
                 settings, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, 0, ?6, '{}', ?7, ?7)",
            params![
                id,
                host_id,
                name,
                path,
                repo_path,
                archive_project as i32,
                now
            ],
        )?;
        id
    };

    let workspace_id: Option<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id FROM workspaces WHERE host_id = ?1 AND path = ?2
             ORDER BY created_at ASC, id ASC LIMIT 1",
        )?;
        let mut rows = stmt.query(params![host_id, path])?;
        rows.next()?
            .map(|row| Ok::<(String, String), rusqlite::Error>((row.get(0)?, row.get(1)?)))
            .transpose()?
    };
    let workspace_id = if let Some((id, workspace_project_id)) = workspace_id {
        if workspace_project_id != project_id {
            return Err(anyhow::anyhow!(
                "workspace path already belongs to another project"
            ));
        }
        id
    } else {
        let id = Uuid::new_v4().to_string();
        let now = now_millis();
        let name = project_name_for_path(&path);
        conn.execute(
            "INSERT INTO workspaces
                (id, project_id, host_id, path, name, branch, base_branch, dirty,
                 start_snapshot, parent_workspace_id, state, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, 0, NULL, NULL, 'active', ?6, ?6)",
            params![id, project_id, host_id, path, name, now],
        )?;
        id
    };
    Ok((project_id, workspace_id))
}

fn validate_file_buffer_update(
    update: &FileBufferUpdate,
    limit: usize,
) -> Result<(), FileBufferError> {
    if update.content.len() > limit || update.base_content.len() > limit {
        return Err(FileBufferError::ContentTooLarge { limit });
    }
    Ok(())
}

fn file_buffer_database_error(error: impl Into<anyhow::Error>) -> FileBufferError {
    let error: anyhow::Error = error.into();
    FileBufferError::Database {
        message: error.to_string(),
    }
}

fn file_buffer_row_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileBufferRow> {
    let revision: i64 = row.get(6)?;
    Ok(FileBufferRow {
        workspace_id: row.get(0)?,
        path: row.get(1)?,
        content: row.get(2)?,
        base_content: row.get(3)?,
        base_version: row.get(4)?,
        external_version: row.get(5)?,
        revision: revision.max(0) as u64,
        dirty: row.get::<_, i64>(7)? != 0,
        conflict: row.get::<_, i64>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn get_file_buffer_locked(
    conn: &Connection,
    workspace_id: &str,
    path: &str,
) -> rusqlite::Result<Option<FileBufferRow>> {
    conn.query_row(
        "SELECT workspace_id, path, content, base_content, base_version,
                external_version, revision, dirty, conflict, created_at, updated_at
         FROM file_buffers WHERE workspace_id = ?1 AND path = ?2",
        params![workspace_id, path],
        file_buffer_row_from_row,
    )
    .optional()
}

fn file_buffer_metadata_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<FileBufferMetadataRow> {
    let revision: i64 = row.get(4)?;
    Ok(FileBufferMetadataRow {
        workspace_id: row.get(0)?,
        path: row.get(1)?,
        base_version: row.get(2)?,
        external_version: row.get(3)?,
        revision: revision.max(0) as u64,
        dirty: row.get::<_, i64>(5)? != 0,
        conflict: row.get::<_, i64>(6)? != 0,
        updated_at: row.get(7)?,
    })
}

fn list_file_buffer_metadata_locked(
    conn: &Connection,
    workspace_id: Option<&str>,
    limit: usize,
) -> rusqlite::Result<Vec<FileBufferMetadataRow>> {
    let limit = limit.min(i64::MAX as usize) as i64;
    if let Some(workspace_id) = workspace_id {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, base_version, external_version,
                    revision, dirty, conflict, updated_at
             FROM file_buffers WHERE workspace_id = ?1
             ORDER BY updated_at DESC, path ASC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![workspace_id, limit], file_buffer_metadata_from_row)?;
        rows.collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, base_version, external_version,
                    revision, dirty, conflict, updated_at
             FROM file_buffers
             ORDER BY updated_at DESC, workspace_id ASC, path ASC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], file_buffer_metadata_from_row)?;
        rows.collect()
    }
}

fn count_file_buffers_locked(conn: &Connection, workspace_id: &str) -> rusqlite::Result<usize> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM file_buffers WHERE workspace_id = ?1",
        params![workspace_id],
        |row| row.get(0),
    )?;
    Ok(count.max(0) as usize)
}

fn file_save_intent_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileSaveIntentRow> {
    let expected: Option<i64> = row.get(5)?;
    Ok(FileSaveIntentRow {
        operation_id: row.get(0)?,
        workspace_id: row.get(1)?,
        path: row.get(2)?,
        content: row.get(3)?,
        version: row.get(4)?,
        expected_buffer_revision: expected.map(|revision| revision.max(0) as u64),
        created_at: row.get(6)?,
    })
}

fn get_file_save_intent_locked(
    conn: &Connection,
    workspace_id: &str,
    path: &str,
) -> rusqlite::Result<Option<FileSaveIntentRow>> {
    conn.query_row(
        "SELECT operation_id, workspace_id, path, content, version,
                expected_buffer_revision, created_at
         FROM file_save_intents WHERE workspace_id = ?1 AND path = ?2",
        params![workspace_id, path],
        file_save_intent_from_row,
    )
    .optional()
}

fn list_file_save_intents_locked(
    conn: &Connection,
    limit: usize,
) -> rusqlite::Result<Vec<FileSaveIntentRow>> {
    let limit = limit.min(i64::MAX as usize) as i64;
    let mut stmt = conn.prepare(
        "SELECT operation_id, workspace_id, path, content, version,
                expected_buffer_revision, created_at
         FROM file_save_intents
         ORDER BY created_at ASC, workspace_id ASC, path ASC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], file_save_intent_from_row)?;
    rows.collect()
}

fn file_save_operation_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileSaveOperationRow> {
    let expected: Option<i64> = row.get(4)?;
    let bytes_written: i64 = row.get(5)?;
    Ok(FileSaveOperationRow {
        operation_id: row.get(0)?,
        workspace_id: row.get(1)?,
        path: row.get(2)?,
        content_version: row.get(3)?,
        expected_buffer_revision: expected.map(|revision| revision.max(0) as u64),
        bytes_written: bytes_written.max(0) as usize,
        metadata_json: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn get_file_save_operation_locked(
    conn: &Connection,
    operation_id: &str,
) -> rusqlite::Result<Option<FileSaveOperationRow>> {
    conn.query_row(
        "SELECT operation_id, workspace_id, path, content_version,
                expected_buffer_revision, bytes_written, metadata_json, created_at
         FROM file_save_operations WHERE operation_id = ?1",
        params![operation_id],
        file_save_operation_from_row,
    )
    .optional()
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn default_db_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join(".perch").join("history.sqlite")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn temp_db_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "perch-db-test-{name}-{}.sqlite",
            uuid::Uuid::new_v4()
        ))
    }

    /// Seeds `n_sessions` sessions with `n_messages_per_session` messages
    /// each in one transaction — bypasses `add_message`'s one-autocommit-per-
    /// row cost, since this is a measurement harness for `list_sessions()` /
    /// `get_session_row()`, not a test of the insert path itself. Returns the
    /// seeded session ids in insertion order.
    fn seed(db: &HistoryDb, n_sessions: usize, n_messages_per_session: usize) -> Vec<String> {
        let mut ids = Vec::with_capacity(n_sessions);
        let conn = db.conn.lock().unwrap();
        conn.execute_batch("BEGIN").unwrap();
        for i in 0..n_sessions {
            let id = format!("sess-{i:04}");
            conn.execute(
                "INSERT INTO sessions (id, cwd, created_at, host_id) VALUES (?1, ?2, ?3, 'local')",
                params![id, format!("/tmp/proj-{}", i % 5), i as i64],
            )
            .unwrap();
            for j in 0..n_messages_per_session {
                let role = if j % 2 == 0 { "user" } else { "assistant" };
                conn.execute(
                    "INSERT INTO messages (session_id, role, content, agent, model, thinking, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)",
                    params![id, role, format!("message body {j} for {id}"), "claude", "claude-haiku-4-5", j as i64],
                )
                .unwrap();
            }
            ids.push(id);
        }
        conn.execute_batch("COMMIT").unwrap();
        ids
    }

    /// Correctness (not timing) is what this test asserts on — see the
    /// workstream note about timing-based assertions being flaky in CI.
    /// Timing numbers are printed via `eprintln!` (visible with `--nocapture`)
    /// for the write-up, not asserted on.
    ///
    /// Seeds ~200 sessions x 200 messages (40,000 rows) — roughly the shape
    /// `messages_session_role` (db.rs migration) is meant to help with — then
    /// checks that `get_session_row(id)` agrees field-for-field with the
    /// matching row from `list_sessions()` for a sample of ids, and that the
    /// `WHERE EXISTS` (has-at-least-one-message) filter behaves identically
    /// for both: a session with zero messages appears in neither.
    #[test]
    fn get_session_row_matches_list_sessions_over_a_large_seed() {
        let path = temp_db_path("bench");
        let db = HistoryDb::open(&path).unwrap();
        let ids = seed(&db, 200, 200);

        // A session with no messages yet must be invisible to both queries —
        // this is the `WHERE EXISTS` semantic `get_session_row` deliberately
        // preserves from `list_sessions` (see its doc comment).
        db.create_session("empty-session", "/tmp/empty").unwrap();

        let t0 = Instant::now();
        let list = db.list_sessions().unwrap();
        let list_elapsed = t0.elapsed();

        assert_eq!(
            list.len(),
            ids.len(),
            "empty session must be filtered out of list_sessions()"
        );
        assert!(!list.iter().any(|r| r.id == "empty-session"));

        let sample: Vec<&String> = ids.iter().step_by(7).collect();
        let t1 = Instant::now();
        for id in &sample {
            let row = db
                .get_session_row(id)
                .unwrap()
                .unwrap_or_else(|| panic!("get_session_row returned None for seeded session {id}"));
            let expected = list.iter().find(|r| &r.id == *id).unwrap();
            assert_eq!(row.id, expected.id);
            assert_eq!(row.cwd, expected.cwd);
            assert_eq!(row.created_at, expected.created_at);
            assert_eq!(row.title, expected.title);
            assert_eq!(row.last_agent, expected.last_agent);
            assert_eq!(row.last_model, expected.last_model);
            assert_eq!(row.archived, expected.archived);
            assert_eq!(row.host_id, expected.host_id);
        }
        let get_elapsed = t1.elapsed();

        assert!(db.get_session_row("empty-session").unwrap().is_none());
        assert!(db.get_session_row("does-not-exist").unwrap().is_none());

        eprintln!(
            "[bench] {} sessions x 200 messages: list_sessions() = {list_elapsed:?}; \
             get_session_row() x{} = {get_elapsed:?} (avg {:?}/call)",
            ids.len(),
            sample.len(),
            get_elapsed / sample.len() as u32,
        );

        drop(db);
        let _ = std::fs::remove_file(&path);
    }

    /// CLI-mode sessions (no rows in `messages` ever, per `agent.rs`'s doc
    /// comments on `terminal.create`/`agentAttach`) must stay invisible until
    /// `mark_cli_activity` fires on first keystroke — otherwise every blank
    /// throwaway session a CLI-mode connect mints would flood the sidebar.
    #[test]
    fn cli_only_session_hidden_until_marked_active() {
        let path = temp_db_path("cli-hidden");
        let db = HistoryDb::open(&path).unwrap();
        db.create_session("cli-sess", "/tmp/cli-proj").unwrap();

        // Zero messages, cli_activity = 0 (default): invisible to both.
        assert!(
            !db.list_sessions()
                .unwrap()
                .iter()
                .any(|r| r.id == "cli-sess"),
            "unmarked CLI session must not appear in list_sessions()"
        );
        assert!(
            db.get_session_row("cli-sess").unwrap().is_none(),
            "unmarked CLI session must not appear in get_session_row()"
        );

        // First keystroke: mark_cli_activity flips it visible everywhere.
        db.mark_cli_activity("cli-sess").unwrap();
        db.set_cli_provider("cli-sess", "configured-provider")
            .unwrap();
        assert_eq!(
            db.get_session("cli-sess")
                .unwrap()
                .unwrap()
                .cli_provider_id
                .as_deref(),
            Some("configured-provider")
        );

        assert!(
            db.list_sessions()
                .unwrap()
                .iter()
                .any(|r| r.id == "cli-sess"),
            "marked CLI session must appear in list_sessions()"
        );
        assert!(
            db.get_session_row("cli-sess").unwrap().is_some(),
            "marked CLI session must appear in get_session_row()"
        );

        drop(db);
        let db = HistoryDb::open(&path).unwrap();
        let single = db.get_session_row("cli-sess").unwrap().unwrap();
        let listed = db
            .list_sessions()
            .unwrap()
            .into_iter()
            .find(|row| row.id == "cli-sess")
            .unwrap();
        assert_eq!(
            single.cli_provider_id.as_deref(),
            Some("configured-provider")
        );
        assert_eq!(single.cli_provider_id, listed.cli_provider_id);

        drop(db);
        let _ = std::fs::remove_file(&path);
    }

    /// CLI-mode sessions get their nav title from `cli_title` (their first
    /// submitted prompt, reconstructed in `cli_title.rs`), and that title must
    /// behave like Hosted mode's first-user-message title: written once,
    /// never rewritten by later prompts, and always outranked by a user
    /// rename.
    #[test]
    fn cli_title_is_write_once_and_loses_to_a_rename() {
        let path = temp_db_path("cli-title");
        let db = HistoryDb::open(&path).unwrap();
        db.create_session("cli-sess", "/tmp/cli-proj").unwrap();
        db.mark_cli_activity("cli-sess").unwrap();

        // No title yet -> the nav shows its "(new session)" placeholder.
        assert_eq!(db.get_session_row("cli-sess").unwrap().unwrap().title, "");

        // First submitted prompt becomes the title.
        assert!(db.set_cli_title("cli-sess", "fix the login bug").unwrap());
        assert_eq!(
            db.get_session_row("cli-sess").unwrap().unwrap().title,
            "fix the login bug"
        );

        // A later prompt must not retitle the session — this is the guard
        // that makes a perch restart mid-session safe (the in-memory
        // "already titled" state is gone, but the DB still refuses).
        let rewrote = db.set_cli_title("cli-sess", "later prompt").unwrap();
        assert!(!rewrote);
        assert_eq!(
            db.get_session_row("cli-sess").unwrap().unwrap().title,
            "fix the login bug"
        );

        // An explicit rename still wins, and survives further prompts.
        db.set_title_override("cli-sess", "Login work").unwrap();
        assert!(!db.set_cli_title("cli-sess", "another prompt").unwrap());
        assert_eq!(
            db.get_session_row("cli-sess").unwrap().unwrap().title,
            "Login work"
        );

        // list_sessions must agree with get_session_row about all of it.
        let listed = db.list_sessions().unwrap();
        let row = listed.iter().find(|r| r.id == "cli-sess").unwrap();
        assert_eq!(row.title, "Login work");

        drop(db);
        let _ = std::fs::remove_file(&path);
    }

    /// A session that already has messages (Hosted mode, or a CLI session
    /// that was also used in Hosted mode) must stay visible regardless of
    /// `cli_activity` — the flag only ever adds visibility, never removes it.
    #[test]
    fn session_with_messages_visible_regardless_of_cli_activity() {
        let path = temp_db_path("messages-visible");
        let db = HistoryDb::open(&path).unwrap();
        let ids = seed(&db, 1, 2);
        let id = &ids[0];

        assert!(db.list_sessions().unwrap().iter().any(|r| &r.id == id));
        assert!(db.get_session_row(id).unwrap().is_some());

        // cli_activity stays 0 here (never marked) — messages alone suffice.
        let row = db.get_session_row(id).unwrap().unwrap();
        assert_eq!(&row.id, id);

        drop(db);
        let _ = std::fs::remove_file(&path);
    }

    /// `get_session_row` and `list_sessions` must agree field-for-field on a
    /// CLI-only (no-messages, `cli_activity = 1`) session too, not just the
    /// message-backed sessions the large-seed test above covers — this is
    /// the same invariant `SESSION_VISIBILITY_FILTER` exists to protect.
    #[test]
    fn get_session_row_matches_list_sessions_for_cli_only_session() {
        let path = temp_db_path("cli-matches-list");
        let db = HistoryDb::open(&path).unwrap();
        let ids = seed(&db, 3, 2);
        db.create_session("cli-only", "/tmp/cli-only-proj").unwrap();
        db.mark_cli_activity("cli-only").unwrap();

        let list = db.list_sessions().unwrap();
        assert_eq!(list.len(), ids.len() + 1);
        let expected = list.iter().find(|r| r.id == "cli-only").unwrap();

        let row = db.get_session_row("cli-only").unwrap().unwrap();
        assert_eq!(row.id, expected.id);
        assert_eq!(row.cwd, expected.cwd);
        assert_eq!(row.created_at, expected.created_at);
        assert_eq!(row.title, expected.title);
        assert_eq!(row.last_agent, expected.last_agent);
        assert_eq!(row.last_model, expected.last_model);
        assert_eq!(row.archived, expected.archived);
        assert_eq!(row.host_id, expected.host_id);

        drop(db);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn legacy_sessions_import_to_stable_host_scoped_metadata() {
        let path = temp_db_path("workspace-import");
        let local_dir = std::env::temp_dir().join(format!("perch-project-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&local_dir).unwrap();
        let local_alias = local_dir.join("nested").join("..");

        let db = HistoryDb::open(&path).unwrap();
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO sessions (id, cwd, created_at, host_id, archived)
                 VALUES ('legacy-local', ?1, 1, NULL, 0)",
                params![local_alias.to_string_lossy().to_string()],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO sessions (id, cwd, created_at, host_id, archived)
                 VALUES ('legacy-remote', '/srv/perch/../perch', 2, 'dev-host', 1)",
                [],
            )
            .unwrap();
        }
        drop(db);

        let db = HistoryDb::open(&path).unwrap();
        let local_row = db.get_session("legacy-local").unwrap().unwrap();
        let remote_row = db.get_session("legacy-remote").unwrap().unwrap();
        assert_eq!(local_row.host_id, "local");
        assert!(local_row.project_id.is_some());
        assert!(local_row.workspace_id.is_some());
        assert_eq!(remote_row.host_id, "dev-host");
        assert!(remote_row.project_id.is_some());
        assert!(remote_row.workspace_id.is_some());

        let local_projects = db.list_projects("local", true).unwrap();
        let remote_projects = db.list_projects("dev-host", true).unwrap();
        assert_eq!(local_projects.len(), 1);
        assert_eq!(remote_projects.len(), 1);
        assert_eq!(remote_projects[0].path, "/srv/perch");
        assert!(remote_projects[0].archived);
        assert!(db.list_projects("dev-host", false).unwrap().is_empty());

        let local_project_id = local_row.project_id.clone().unwrap();
        let local_workspace_id = local_row.workspace_id.clone().unwrap();
        drop(db);
        let db = HistoryDb::open(&path).unwrap();
        let local_again = db.get_session("legacy-local").unwrap().unwrap();
        assert_eq!(
            local_again.project_id.as_deref(),
            Some(local_project_id.as_str())
        );
        assert_eq!(
            local_again.workspace_id.as_deref(),
            Some(local_workspace_id.as_str())
        );
        assert_eq!(db.list_projects("local", true).unwrap().len(), 1);
        assert_eq!(db.list_projects("dev-host", true).unwrap().len(), 1);

        drop(db);
        std::fs::remove_dir_all(&local_dir).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn project_creation_is_idempotent_and_does_not_unarchive() {
        let path = temp_db_path("workspace-idempotent");
        let project_dir = std::env::temp_dir().join(format!("perch-project-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&project_dir).unwrap();
        let db = HistoryDb::open(&path).unwrap();

        let (first, workspace) = db
            .create_project("local", &project_dir.to_string_lossy(), Some("Original"))
            .unwrap();
        db.set_project_archived(&first.id, true).unwrap();
        let (again, same_workspace) = db
            .create_project("local", &project_dir.to_string_lossy(), Some("Changed"))
            .unwrap();
        assert_eq!(again.id, first.id);
        assert_eq!(again.name, "Original");
        assert!(again.archived);
        assert_eq!(same_workspace.id, workspace.id);
        assert!(db.focus_project(&first.id).is_err());

        let restored = db.set_project_archived(&first.id, false).unwrap();
        assert!(!restored.archived);
        let (_, focused) = db.focus_project(&first.id).unwrap();
        assert_eq!(focused.id, workspace.id);
        let (_, _, active_project, active_workspace) =
            db.workspace_snapshot("local", None).unwrap();
        assert_eq!(active_project.as_deref(), Some(first.id.as_str()));
        assert_eq!(active_workspace.as_deref(), Some(workspace.id.as_str()));

        drop(db);
        std::fs::remove_dir_all(&project_dir).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn linked_worktree_workspace_is_idempotent_and_preserves_start_snapshot() {
        let path = temp_db_path("worktree-workspace");
        let project_dir = std::env::temp_dir().join(format!("perch-project-{}", Uuid::new_v4()));
        let child_dir = std::env::temp_dir().join(format!("perch-worktree-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&project_dir).unwrap();
        std::fs::create_dir_all(&child_dir).unwrap();
        let db = HistoryDb::open(&path).unwrap();

        let child = db
            .create_worktree_workspace(
                "local",
                &project_dir.to_string_lossy(),
                &child_dir.to_string_lossy(),
                Some("feature/demo"),
                Some("main"),
                Some("head-1"),
            )
            .unwrap();
        assert!(child.parent_workspace_id.as_deref().is_some());
        assert_eq!(child.start_snapshot.as_deref(), Some("head-1"));
        assert_eq!(
            db.list_workspaces("local", Some(&child.project_id))
                .unwrap()
                .len(),
            2
        );

        let same = db
            .create_worktree_workspace(
                "local",
                &project_dir.to_string_lossy(),
                &child_dir.to_string_lossy(),
                Some("feature/demo"),
                Some("main"),
                Some("head-2"),
            )
            .unwrap();
        assert_eq!(same.id, child.id);
        assert_eq!(same.start_snapshot.as_deref(), Some("head-1"));

        let updated = db
            .update_workspace_git_state(
                &child.id,
                Some("feature/demo"),
                Some("main"),
                true,
                Some("head-3"),
            )
            .unwrap();
        assert!(updated.dirty);
        assert_eq!(updated.start_snapshot.as_deref(), Some("head-1"));
        let archived = db
            .archive_workspace_for_path("local", &child_dir.to_string_lossy())
            .unwrap()
            .unwrap();
        assert_eq!(archived.id, child.id);
        assert_eq!(archived.state, "archived");
        assert!(db
            .archive_workspace_for_path("local", &child_dir.to_string_lossy())
            .unwrap()
            .is_some());

        drop(db);
        std::fs::remove_dir_all(&project_dir).ok();
        std::fs::remove_dir_all(&child_dir).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn archiving_active_project_selects_or_clears_a_visible_fallback() {
        let path = temp_db_path("workspace-fallback");
        let first_dir = std::env::temp_dir().join(format!("perch-project-{}", Uuid::new_v4()));
        let second_dir = std::env::temp_dir().join(format!("perch-project-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&first_dir).unwrap();
        std::fs::create_dir_all(&second_dir).unwrap();
        let db = HistoryDb::open(&path).unwrap();
        let (first, _) = db
            .create_project("local", &first_dir.to_string_lossy(), None)
            .unwrap();
        let (second, second_workspace) = db
            .create_project("local", &second_dir.to_string_lossy(), None)
            .unwrap();
        db.focus_project(&first.id).unwrap();
        db.set_project_archived(&first.id, true).unwrap();
        let (_, _, active_project, active_workspace) =
            db.workspace_snapshot("local", None).unwrap();
        assert_eq!(active_project.as_deref(), Some(second.id.as_str()));
        assert_eq!(
            active_workspace.as_deref(),
            Some(second_workspace.id.as_str())
        );

        db.set_project_archived(&second.id, true).unwrap();
        let (_, _, active_project, active_workspace) =
            db.workspace_snapshot("local", None).unwrap();
        assert!(active_project.is_none());
        assert!(active_workspace.is_none());

        drop(db);
        std::fs::remove_dir_all(&first_dir).ok();
        std::fs::remove_dir_all(&second_dir).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn file_buffers_persist_base_content_revision_and_save_intents() {
        let path = temp_db_path("file-buffer-durable");
        let workspace_path =
            std::env::temp_dir().join(format!("perch-buffer-ws-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&workspace_path).unwrap();
        let db = HistoryDb::open(&path).unwrap();
        let (_, workspace) = db
            .create_project("local", &workspace_path.to_string_lossy(), None)
            .unwrap();
        let row = db
            .ensure_file_buffer(
                &workspace.id,
                "src/main.rs",
                FileBufferUpdate {
                    content: "base".to_string(),
                    base_content: "base".to_string(),
                    base_version: Some("base-hash".to_string()),
                    external_version: Some("base-hash".to_string()),
                    dirty: false,
                    conflict: false,
                },
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        assert_eq!(row.revision, 0);
        assert_eq!(row.base_content, "base");

        let draft = db
            .set_file_buffer(
                &workspace.id,
                "src/main.rs",
                FileBufferUpdate {
                    content: "draft".to_string(),
                    base_content: "base".to_string(),
                    base_version: Some("base-hash".to_string()),
                    external_version: Some("base-hash".to_string()),
                    dirty: true,
                    conflict: false,
                },
                Some(0),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        assert_eq!(draft.revision, 1);
        let intent = db
            .begin_file_save_intent(
                "op-1",
                &workspace.id,
                "src/main.rs",
                "draft",
                "draft-hash",
                Some(draft.revision),
            )
            .unwrap();
        assert_eq!(intent.expected_buffer_revision, Some(1));

        drop(db);
        let db = HistoryDb::open(&path).unwrap();
        let reopened = db
            .get_file_buffer(&workspace.id, "src/main.rs")
            .unwrap()
            .unwrap();
        assert_eq!(reopened.content, "draft");
        assert_eq!(reopened.base_content, "base");
        assert!(reopened.dirty);
        assert_eq!(db.list_file_save_intents(8).unwrap(), vec![intent.clone()]);
        db.record_file_save_operation(FileSaveOperation {
            operation_id: "op-1",
            workspace_id: &workspace.id,
            path: "src/main.rs",
            content_version: "draft-hash",
            expected_buffer_revision: Some(1),
            bytes_written: 5,
            metadata_json: "{}",
            max_receipts: 8,
        })
        .unwrap();
        // The operation id is a durable idempotency key: a replay cannot
        // replace the original receipt with a different result.
        db.record_file_save_operation(FileSaveOperation {
            operation_id: "op-1",
            workspace_id: &workspace.id,
            path: "src/main.rs",
            content_version: "different-hash",
            expected_buffer_revision: Some(9),
            bytes_written: 99,
            metadata_json: "{\"different\":true}",
            max_receipts: 8,
        })
        .unwrap();
        let receipt = db.get_file_save_operation("op-1").unwrap().unwrap();
        assert_eq!(receipt.content_version, "draft-hash");
        assert_eq!(receipt.bytes_written, 5);
        assert!(db
            .clear_file_save_intent("op-1", &workspace.id, "src/main.rs", "draft-hash", Some(1),)
            .unwrap());
        assert!(db.list_file_save_intents(8).unwrap().is_empty());

        drop(db);
        std::fs::remove_dir_all(&workspace_path).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn file_buffer_revision_conflict_dirty_close_and_capacity_are_explicit() {
        let path = temp_db_path("file-buffer-guards");
        let workspace_path =
            std::env::temp_dir().join(format!("perch-buffer-ws-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&workspace_path).unwrap();
        let db = HistoryDb::open(&path).unwrap();
        let (_, workspace) = db
            .create_project("local", &workspace_path.to_string_lossy(), None)
            .unwrap();
        let update = |content: &str| FileBufferUpdate {
            content: content.to_string(),
            base_content: "base".to_string(),
            base_version: Some("base-hash".to_string()),
            external_version: Some("base-hash".to_string()),
            dirty: true,
            conflict: false,
        };
        let current = db
            .set_file_buffer(&workspace.id, "one.txt", update("one"), Some(0), 1)
            .unwrap();
        let error = db
            .set_file_buffer(&workspace.id, "one.txt", update("stale"), Some(0), 1)
            .unwrap_err();
        assert!(matches!(
            error,
            FileBufferError::Conflict {
                expected: Some(0),
                current: Some(_)
            }
        ));
        assert!(matches!(
            db.set_file_buffer(&workspace.id, "two.txt", update("two"), Some(0), 1),
            Err(FileBufferError::Limit { limit: 1 })
        ));
        assert!(matches!(
            db.close_file_buffer(&workspace.id, "one.txt", Some(current.revision), false),
            Err(FileBufferError::Dirty { .. })
        ));
        assert!(db
            .close_file_buffer(&workspace.id, "one.txt", Some(current.revision), true)
            .unwrap());
        assert!(db
            .get_file_buffer(&workspace.id, "one.txt")
            .unwrap()
            .is_none());

        drop(db);
        std::fs::remove_dir_all(&workspace_path).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn completed_save_is_idempotent_and_preserves_a_newer_draft() {
        let path = temp_db_path("file-save-complete");
        let workspace_path =
            std::env::temp_dir().join(format!("perch-buffer-ws-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&workspace_path).unwrap();
        let db = HistoryDb::open(&path).unwrap();
        let (_, workspace) = db
            .create_project("local", &workspace_path.to_string_lossy(), None)
            .unwrap();
        let baseline = db
            .ensure_file_buffer(
                &workspace.id,
                "src/main.rs",
                FileBufferUpdate {
                    content: "base".to_string(),
                    base_content: "base".to_string(),
                    base_version: Some("base-hash".to_string()),
                    external_version: Some("base-hash".to_string()),
                    dirty: false,
                    conflict: false,
                },
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        let draft = db
            .set_file_buffer(
                &workspace.id,
                "src/main.rs",
                FileBufferUpdate {
                    content: "draft".to_string(),
                    base_content: "base".to_string(),
                    base_version: Some("base-hash".to_string()),
                    external_version: Some("base-hash".to_string()),
                    dirty: true,
                    conflict: false,
                },
                Some(baseline.revision),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        let draft_version = crate::filesystem::FileService::version_for_bytes(b"draft");

        // Ordinary completion advances the row once and removes the intent in
        // the same SQLite transaction as its replay receipt.
        db.begin_file_save_intent(
            "op-complete",
            &workspace.id,
            "src/main.rs",
            "draft",
            &draft_version,
            Some(draft.revision),
        )
        .unwrap();
        let completed = db
            .complete_file_save(FileSaveCompletion {
                operation_id: "op-complete",
                workspace_id: &workspace.id,
                path: "src/main.rs",
                content: "draft",
                version: &draft_version,
                expected_revision: Some(draft.revision),
                bytes_written: 5,
                metadata_json: "{}",
                max_receipts: 1_024,
            })
            .unwrap()
            .unwrap();
        assert_eq!(completed.revision, draft.revision + 1);
        assert_eq!(completed.content, "draft");
        assert!(!completed.dirty);
        assert!(!completed.conflict);
        assert!(db.get_file_save_operation("op-complete").unwrap().is_some());
        assert!(db.list_file_save_intents(8).unwrap().is_empty());

        // Simulate a process exit after the row reconciliation but before the
        // receipt insertion. Recovery must recognize the exact row and avoid
        // incrementing its revision a second time.
        let reconciled_revision = completed.revision;
        db.begin_file_save_intent(
            "op-after-reconcile",
            &workspace.id,
            "src/main.rs",
            "draft",
            &draft_version,
            Some(reconciled_revision),
        )
        .unwrap();
        let reconciled = db
            .reconcile_file_buffer_after_save(
                &workspace.id,
                "src/main.rs",
                "draft",
                &draft_version,
                Some(reconciled_revision),
            )
            .unwrap()
            .unwrap();
        assert_eq!(reconciled.revision, reconciled_revision + 1);
        let recovered = db
            .complete_file_save(FileSaveCompletion {
                operation_id: "op-after-reconcile",
                workspace_id: &workspace.id,
                path: "src/main.rs",
                content: "draft",
                version: &draft_version,
                expected_revision: Some(reconciled_revision),
                bytes_written: 5,
                metadata_json: "{}",
                max_receipts: 1_024,
            })
            .unwrap()
            .unwrap();
        assert_eq!(recovered.revision, reconciled.revision);
        assert!(db
            .get_file_save_operation("op-after-reconcile")
            .unwrap()
            .is_some());
        assert!(db.list_file_save_intents(8).unwrap().is_empty());

        // A later draft revision is authoritative. Completion records the
        // operation while retaining that text and marking the row conflicted.
        db.begin_file_save_intent(
            "op-newer",
            &workspace.id,
            "src/main.rs",
            "draft",
            &draft_version,
            Some(recovered.revision),
        )
        .unwrap();
        let newer = db
            .set_file_buffer(
                &workspace.id,
                "src/main.rs",
                FileBufferUpdate {
                    content: "newer draft".to_string(),
                    base_content: "draft".to_string(),
                    base_version: Some(draft_version.clone()),
                    external_version: Some(draft_version.clone()),
                    dirty: true,
                    conflict: false,
                },
                Some(recovered.revision),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        let preserved = db
            .complete_file_save(FileSaveCompletion {
                operation_id: "op-newer",
                workspace_id: &workspace.id,
                path: "src/main.rs",
                content: "draft",
                version: &draft_version,
                expected_revision: Some(recovered.revision),
                bytes_written: 5,
                metadata_json: "{}",
                max_receipts: 1_024,
            })
            .unwrap()
            .unwrap();
        assert_eq!(preserved.content, newer.content);
        assert!(preserved.dirty);
        assert!(preserved.conflict);
        assert!(db.get_file_save_operation("op-newer").unwrap().is_some());
        assert!(db.list_file_save_intents(8).unwrap().is_empty());

        // If publication never happened, the intent remains available for a
        // later recovery pass instead of being mistaken for a handled save.
        db.begin_file_save_intent(
            "op-prepublish",
            &workspace.id,
            "src/main.rs",
            "never published",
            "missing-on-disk",
            Some(preserved.revision),
        )
        .unwrap();
        assert!(db
            .list_file_save_intents(8)
            .unwrap()
            .iter()
            .any(|intent| intent.operation_id == "op-prepublish"));

        drop(db);
        std::fs::remove_dir_all(&workspace_path).ok();
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn prompt_claim_has_one_winner_under_concurrency() {
        let path = temp_db_path("prompt-claim");
        let db = std::sync::Arc::new(HistoryDb::open(&path).unwrap());
        db.reserve_prompt_operation(
            "prompt-op",
            "session-op",
            Some("workspace-op"),
            "digest-op",
            "run this",
            Some("claude"),
            Some("claude-sonnet-4-5"),
        )
        .unwrap();

        let first = {
            let db = db.clone();
            std::thread::spawn(move || db.claim_prompt_operation("prompt-op").unwrap())
        };
        let second = {
            let db = db.clone();
            std::thread::spawn(move || db.claim_prompt_operation("prompt-op").unwrap())
        };
        let first = first.join().unwrap().unwrap();
        let second = second.join().unwrap().unwrap();

        assert_ne!(first.won_claim, second.won_claim);
        assert_eq!(first.operation.state, "claimed");
        assert_eq!(second.operation.state, "claimed");
        assert!(db
            .get_prompt_operation("prompt-op")
            .unwrap()
            .is_some_and(|operation| operation.state == "claimed"));

        drop(db);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn prompt_operation_terminal_states_cannot_be_downgraded() {
        let path = temp_db_path("prompt-state");
        let db = HistoryDb::open(&path).unwrap();
        db.reserve_prompt_operation(
            "prompt-op",
            "session-op",
            None,
            "digest-op",
            "run this",
            None,
            None,
        )
        .unwrap();
        db.set_prompt_operation_state("prompt-op", "claimed")
            .unwrap();
        db.set_prompt_operation_state("prompt-op", "unconfirmed")
            .unwrap();
        db.set_prompt_operation_state("prompt-op", "queued")
            .unwrap();
        db.set_prompt_operation_state("prompt-op", "claimed")
            .unwrap();
        assert_eq!(
            db.get_prompt_operation("prompt-op").unwrap().unwrap().state,
            "unconfirmed"
        );

        db.set_prompt_operation_state("prompt-op", "delivered")
            .unwrap();
        db.set_prompt_operation_state("prompt-op", "queued")
            .unwrap();
        assert_eq!(
            db.get_prompt_operation("prompt-op").unwrap().unwrap().state,
            "delivered"
        );
        assert!(db.set_prompt_operation_state("prompt-op", "bogus").is_err());

        drop(db);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn agent_change_snapshot_records_one_before_after_boundary_idempotently() {
        let path = temp_db_path("agent-change-snapshot");
        let db = HistoryDb::open(&path).unwrap();
        let before_paths = vec!["old.rs".to_string(), "shared.rs".to_string()];
        let started = db
            .begin_agent_change_snapshot(AgentChangeSnapshotStart {
                snapshot_id: "snapshot-1",
                operation_id: "turn-1",
                workspace_id: "workspace-1",
                session_id: "session-1",
                agent: "claude",
                before_head: Some("head-1"),
                before_branch: Some("main"),
                before_status: r#"{"head":"head-1"}"#,
                before_paths: &before_paths,
                created_at: 10,
            })
            .unwrap();
        assert_eq!(started.snapshot_id, "snapshot-1");
        assert!(!started.completed);

        // A retry with the same operation returns the original boundary even
        // if its caller presents the paths in a different order.
        let retry_paths = vec!["shared.rs".to_string(), "old.rs".to_string()];
        let retried = db
            .begin_agent_change_snapshot(AgentChangeSnapshotStart {
                snapshot_id: "snapshot-1",
                operation_id: "turn-1",
                workspace_id: "workspace-1",
                session_id: "session-1",
                agent: "claude",
                before_head: Some("head-1"),
                before_branch: Some("main"),
                before_status: r#"{"head":"head-1"}"#,
                before_paths: &retry_paths,
                created_at: 11,
            })
            .unwrap();
        assert_eq!(retried, started);

        let after_paths = vec!["new.rs".to_string(), "shared.rs".to_string()];
        let finished = db
            .finish_agent_change_snapshot(AgentChangeSnapshotFinish {
                snapshot_id: "snapshot-1",
                after_head: Some("head-2"),
                after_branch: Some("main"),
                after_status: r#"{"head":"head-2"}"#,
                after_paths: &after_paths,
                completed_at: 20,
            })
            .unwrap()
            .unwrap();
        assert!(finished.completed);
        assert_eq!(finished.after_head.as_deref(), Some("head-2"));
        assert_eq!(
            finished.changed_paths,
            Some(vec![
                "new.rs".to_string(),
                "old.rs".to_string(),
                "shared.rs".to_string(),
            ])
        );

        // Completion is first-writer-wins. A late callback cannot replace the
        // visible after boundary or changed-path set.
        let late_paths = vec!["late.rs".to_string()];
        let late = db
            .finish_agent_change_snapshot(AgentChangeSnapshotFinish {
                snapshot_id: "snapshot-1",
                after_head: Some("head-3"),
                after_branch: Some("other"),
                after_status: r#"{"head":"head-3"}"#,
                after_paths: &late_paths,
                completed_at: 30,
            })
            .unwrap()
            .unwrap();
        assert_eq!(late, finished);
        assert_eq!(
            db.list_agent_change_snapshots("workspace-1", 8).unwrap(),
            vec![finished]
        );

        drop(db);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn prompt_and_review_settlement_rolls_back_together_on_packet_failure() {
        let path = temp_db_path("prompt-settlement");
        let db = HistoryDb::open(&path).unwrap();
        db.create_session("session-op", "/tmp/perch-prompt-settlement")
            .unwrap();
        db.reserve_prompt_operation(
            "prompt-op",
            "session-op",
            Some("workspace-op"),
            "digest-op",
            "run this",
            Some("claude"),
            None,
        )
        .unwrap();
        db.insert_review_packet(
            &crate::review::ReviewPacket {
                packet_id: "packet-op".to_string(),
                idempotency_key: "review-send:prompt-op".to_string(),
                send_operation_id: "prompt-op".to_string(),
                workspace_id: "workspace-op".to_string(),
                target_session_id: Some("session-op".to_string()),
                target_agent_id: Some("claude".to_string()),
                current_revision: "revision-op".to_string(),
                comments: Vec::new(),
                markdown: "Review notes".to_string(),
            },
            1,
        )
        .unwrap();

        // Force the second write in the transaction to fail. The prompt row
        // must remain queued after SQLite rolls back the first write too.
        {
            let conn = db.conn.lock().unwrap();
            conn.execute_batch(
                "CREATE TRIGGER fail_review_packet_settlement
                 BEFORE UPDATE OF state ON review_packets
                 WHEN NEW.packet_id = 'packet-op' AND NEW.state = 'delivered'
                 BEGIN SELECT RAISE(ABORT, 'packet settlement failed'); END;",
            )
            .unwrap();
        }
        assert!(db
            .settle_prompt_dispatch("prompt-op", "delivered", 2)
            .is_err());
        assert_eq!(
            db.get_prompt_operation("prompt-op").unwrap().unwrap().state,
            "queued"
        );
        assert_eq!(
            db.get_review_packet("packet-op").unwrap().unwrap().state,
            "queued"
        );

        {
            let conn = db.conn.lock().unwrap();
            conn.execute_batch("DROP TRIGGER fail_review_packet_settlement")
                .unwrap();
        }
        let settled = db
            .settle_prompt_dispatch("prompt-op", "delivered", 3)
            .unwrap()
            .unwrap();
        assert_eq!(settled.state, "delivered");
        assert_eq!(
            db.get_review_packet("packet-op").unwrap().unwrap().state,
            "delivered"
        );

        drop(db);
        std::fs::remove_file(&path).ok();
    }
}
