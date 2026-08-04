//! Session/message history, persisted to SQLite, mirroring
//! `reference/node-server-spec/src/db.ts`. Unlike the Node version (which
//! juggles better-sqlite3 vs. node:sqlite fallbacks), `rusqlite`'s
//! `bundled` feature always gives us a real synchronous SQLite — no
//! fallback needed.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};

use crate::protocol::HistoryMessage;

pub struct MessageRow {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub agent: Option<String>,
    pub model: Option<String>,
    pub thinking: Option<String>,
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
}

/// Lightweight row returned by [`HistoryDb::list_sessions`], used to populate
/// `session.list` and `session.updated` wire messages without reading full
/// message content.
pub struct SessionListRow {
    pub id: String,
    pub cwd: String,
    pub created_at: i64,
    /// First user-message snippet (up to 40 chars) via a correlated subquery,
    /// or empty string if the session has no user messages yet.
    pub title: String,
    /// Agent name from the most recent assistant message, if any.
    pub last_agent: Option<String>,
    /// Model from the most recent assistant message, if any.
    pub last_model: Option<String>,
    /// Whether this session has been archived.
    pub archived: bool,
    /// `"local"` or a direct-mode host id — see [`SessionRow::host_id`].
    pub host_id: String,
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
                s.host_id
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
    })
}

pub struct HistoryDb {
    conn: Mutex<Connection>,
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
                ON messages(session_id, role, id);",
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
            conn.execute("ALTER TABLE sessions ADD COLUMN archived INTEGER NOT NULL DEFAULT 0", [])?;
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
        if !existing_session_columns.contains("cli_activity") {
            conn.execute(
                "ALTER TABLE sessions ADD COLUMN cli_activity INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
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
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS detached_runs_status
                ON detached_runs (status);",
        )?;
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
        conn.execute(
            "INSERT OR IGNORE INTO sessions (id, cwd, created_at, host_id) VALUES (?1, ?2, ?3, ?4)",
            params![id, cwd, now_millis(), host_id],
        )?;
        conn.execute(
            "UPDATE sessions SET host_id = ?2 WHERE id = ?1 AND (host_id IS NULL OR host_id = '')",
            params![id, host_id],
        )?;
        Ok(())
    }

    pub fn get_session(&self, id: &str) -> anyhow::Result<Option<SessionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT cwd, claude_session_id, codex_thread_id, last_agent, last_model, host_id
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
            }))
        } else {
            Ok(None)
        }
    }


    pub fn session_exists(&self, id: &str) -> anyhow::Result<bool> {
        Ok(self.get_session(id)?.is_some())
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
            params![session_id, role, content, agent, model, thinking, now_millis()],
        )?;
        Ok(())
    }

    pub fn get_messages(&self, session_id: &str) -> anyhow::Result<Vec<MessageRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, agent, model, thinking, created_at
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
                    created_at: row.get(7)?,
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
                 pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
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
    pub fn update_detached_cursor(&self, run_id: &str, offset: u64, inode: u64) -> anyhow::Result<()> {
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
                    pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status, created_at
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
                })
            })?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// The most recent still-running run for a session, if any — used by
    /// `chat.cancel` to find the process group to signal.
    pub fn running_detached_run_for_session(&self, session_id: &str) -> anyhow::Result<Option<DetachedRunRow>> {
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
        std::env::temp_dir().join(format!("perch-db-test-{name}-{}.sqlite", uuid::Uuid::new_v4()))
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

        assert_eq!(list.len(), ids.len(), "empty session must be filtered out of list_sessions()");
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
            !db.list_sessions().unwrap().iter().any(|r| r.id == "cli-sess"),
            "unmarked CLI session must not appear in list_sessions()"
        );
        assert!(
            db.get_session_row("cli-sess").unwrap().is_none(),
            "unmarked CLI session must not appear in get_session_row()"
        );

        // First keystroke: mark_cli_activity flips it visible everywhere.
        db.mark_cli_activity("cli-sess").unwrap();

        assert!(
            db.list_sessions().unwrap().iter().any(|r| r.id == "cli-sess"),
            "marked CLI session must appear in list_sessions()"
        );
        assert!(
            db.get_session_row("cli-sess").unwrap().is_some(),
            "marked CLI session must appear in get_session_row()"
        );

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
}
