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
            );",
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
        Ok(())
    }

    pub fn create_session(&self, id: &str, cwd: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT OR IGNORE INTO sessions (id, cwd, created_at) VALUES (?1, ?2, ?3)",
            params![id, cwd, now_millis()],
        )?;
        Ok(())
    }

    pub fn get_session(&self, id: &str) -> anyhow::Result<Option<SessionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT cwd, claude_session_id, codex_thread_id FROM sessions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(SessionRow {
                cwd: row.get(0)?,
                claude_session_id: row.get(1)?,
                codex_thread_id: row.get(2)?,
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
