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

mod detached;
pub use detached::DetachedRunRow;
mod prompts;
pub use prompts::{
    AgentChangeSnapshotFinish, AgentChangeSnapshotRow, AgentChangeSnapshotStart, PromptClaim,
    PromptOperationRow, MAX_AGENT_CHANGE_PATHS, MAX_AGENT_CHANGE_STATUS_BYTES,
};
mod git_review;
pub use git_review::{GitPreviewRow, ReviewDeleteResult, ReviewPacketRow, ReviewUpdateResult};
mod file_buffers;
pub use file_buffers::{
    FileBufferError, FileBufferMetadataRow, FileBufferObservation, FileBufferRow, FileBufferUpdate,
    FileSaveCompletion, FileSaveIntentRow, FileSaveOperation, FileSaveOperationRow,
    MAX_FILE_BUFFERS_PER_WORKSPACE, MAX_FILE_BUFFER_BYTES, MAX_FILE_BUFFER_WATCHES,
};
mod projects;
pub use projects::{ProjectRow, WorkspaceRow, WorkspaceSnapshot};
mod sessions;
pub use sessions::{MessageRow, SessionListRow, SessionRow};
mod providers;
pub use providers::ProviderPreference;

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
            CREATE TABLE IF NOT EXISTS provider_preferences (
                provider_id TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                is_default INTEGER NOT NULL DEFAULT 0
            );
            CREATE UNIQUE INDEX IF NOT EXISTS provider_default
                ON provider_preferences(is_default) WHERE is_default = 1;
            CREATE TABLE IF NOT EXISTS provider_catalog_state (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                revision INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO provider_catalog_state(id, revision) VALUES (1, 0);
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
