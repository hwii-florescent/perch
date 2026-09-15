//! Session CRUD, messages, titles, and dockview layout. Pure move from
//! `db.rs` — see the refactor plan's Phase 5. No logic changed.
//!
//! MessageRow, SessionRow, SessionListRow are re-exported from db/mod.rs
//! (`pub use sessions::{...}`) to keep `crate::db::X` import paths
//! working — SessionRow is used from server/terminal.rs,
//! SessionListRow from server/session.rs.
//!
//! SESSION_LIST_ROW_SELECT + session_list_row_from_row are shared by
//! list_sessions and get_session_row **on purpose** (see CLAUDE.md) —
//! kept together here, still both private, still only used by those two
//! methods, both of which live in this file.

use super::*;

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
    /// OpenCode's own session id for this Perch CLI session.
    pub opencode_session_id: Option<String>,
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

impl HistoryDb {
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
                ensure_project_workspace_locked(&conn, host_id, cwd, None, false, None)?;
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
            "SELECT cwd, claude_session_id, codex_thread_id, opencode_session_id, last_agent, last_model, host_id,
                    project_id, workspace_id, cli_provider_id
             FROM sessions WHERE id = ?1",
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SessionRow {
                cwd: row.get(0)?,
                claude_session_id: row.get(1)?,
                codex_thread_id: row.get(2)?,
                opencode_session_id: row.get(3)?,
                last_agent: row.get(4)?,
                last_model: row.get(5)?,
                host_id: row
                    .get::<_, Option<String>>(6)?
                    .filter(|h| !h.is_empty())
                    .unwrap_or_else(|| "local".to_string()),
                project_id: row.get(7)?,
                workspace_id: row.get(8)?,
                cli_provider_id: row.get(9)?,
            }))
        } else {
            Ok(None)
        }
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

    pub fn set_opencode_session_id(
        &self,
        id: &str,
        opencode_session_id: &str,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE sessions SET opencode_session_id = ?2 WHERE id = ?1",
            params![id, opencode_session_id],
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
}
