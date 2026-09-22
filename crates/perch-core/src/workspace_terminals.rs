//! Persistent shell panes. The database owns pane identity; this one host-wide
//! registry owns PTYs and bounded replay. Releasing a view never kills a shell.

use crate::agent_persistence::SqliteConnectionAdapter;
use crate::db::HistoryDb;
use crate::terminal::TerminalReplay as Replay;
pub use crate::terminal::MAX_TERMINAL_REPLAY_BYTES;
use crate::terminal::{AgentTerminalRegistry, TerminalDataListener, TerminalExitListener};
use anyhow::{anyhow, bail};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub const MAX_WORKSPACE_TERMINALS: usize = 64;
const MAX_VIEWERS: usize = 32;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS workspace_terminals (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    pane_id TEXT NOT NULL,
    cwd TEXT NOT NULL,
    cols INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    backend TEXT NOT NULL,
    state TEXT NOT NULL,
    exit_code INTEGER,
    UNIQUE(session_id, pane_id)
);";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTerminal {
    pub id: String,
    pub session_id: String,
    pub workspace_id: String,
    pub pane_id: String,
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    /// daemon survives a core restart; process (in-process fallback) survives
    /// client detachment only.
    pub backend: String,
    /// starting, running, exited, or lost (requires an explicit new shell).
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
}

fn read_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkspaceTerminal> {
    Ok(WorkspaceTerminal {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workspace_id: row.get(2)?,
        pane_id: row.get(3)?,
        cwd: row.get(4)?,
        cols: row.get(5)?,
        rows: row.get(6)?,
        backend: row.get(7)?,
        state: row.get(8)?,
        exit_code: row.get(9)?,
    })
}

const SELECT: &str = "SELECT id, session_id, workspace_id, pane_id, cwd, cols, rows, backend, state, exit_code FROM workspace_terminals";

struct Viewer {
    on_data: TerminalDataListener,
    on_exit: TerminalExitListener,
}

#[derive(Default)]
struct Stream {
    replay: Replay,
    viewers: HashMap<String, Viewer>,
}

pub struct WorkspaceTerminals {
    db: Arc<HistoryDb>,
    runtime: Arc<AgentTerminalRegistry>,
    /// Serializes reserve/spawn/close, including simultaneous browser opens.
    operations: Mutex<()>,
    streams: Arc<Mutex<HashMap<String, Stream>>>,
}

impl WorkspaceTerminals {
    pub fn new(db: Arc<HistoryDb>) -> anyhow::Result<Self> {
        db.with_connection(|conn| {
            conn.execute_batch(SCHEMA)?;
            Ok(())
        })?;
        Ok(Self {
            db,
            runtime: Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {}))),
            operations: Mutex::new(()),
            streams: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn list(&self, session_id: &str) -> anyhow::Result<Vec<WorkspaceTerminal>> {
        self.db.with_connection(|conn| {
            let mut statement = conn.prepare(&format!(
                "{SELECT} WHERE session_id = ?1 ORDER BY rowid LIMIT ?2"
            ))?;
            let rows =
                statement.query_map(params![session_id, MAX_WORKSPACE_TERMINALS], read_row)?;
            Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
        })
    }

    fn reserve(
        &self,
        session_id: &str,
        pane_id: &str,
        cols: u16,
        rows: u16,
    ) -> anyhow::Result<(WorkspaceTerminal, bool)> {
        if pane_id.is_empty() || pane_id.len() > 256 || pane_id.chars().any(char::is_control) {
            bail!("invalid terminal pane id");
        }
        if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
            bail!("invalid terminal dimensions");
        }
        let session = self
            .db
            .get_session(session_id)?
            .ok_or_else(|| anyhow!("unknown session"))?;
        if session.host_id != "local" {
            bail!("terminal must be opened on its owning host");
        }
        let workspace_id = session
            .workspace_id
            .ok_or_else(|| anyhow!("session has no workspace"))?;
        self.db.with_connection(|conn| {
            let tx = conn.transaction()?;
            if let Some(row) = tx.query_row(&format!("{SELECT} WHERE session_id = ?1 AND pane_id = ?2"), params![session_id, pane_id], read_row).optional()? {
                tx.commit()?;
                return Ok((row, false));
            }
            let count: usize = tx.query_row("SELECT COUNT(*) FROM workspace_terminals", [], |row| row.get(0))?;
            if count >= MAX_WORKSPACE_TERMINALS { bail!("close an existing terminal before opening another"); }
            let row = WorkspaceTerminal {
                id: uuid::Uuid::new_v4().to_string(), session_id: session_id.to_string(), workspace_id,
                pane_id: pane_id.to_string(), cwd: session.cwd, cols, rows,
                backend: "pending".to_string(), state: "starting".to_string(), exit_code: None,
            };
            tx.execute("INSERT INTO workspace_terminals (id, session_id, workspace_id, pane_id, cwd, cols, rows, backend, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", params![row.id, row.session_id, row.workspace_id, row.pane_id, row.cwd, cols, rows, row.backend, row.state])?;
            tx.commit()?;
            Ok((row, true))
        })
    }

    fn update(&self, row: &WorkspaceTerminal) -> anyhow::Result<()> {
        self.db.with_connection(|conn| {
            conn.execute("UPDATE workspace_terminals SET cols = ?2, rows = ?3, backend = ?4, state = ?5, exit_code = ?6 WHERE id = ?1 AND state != 'exited'", params![row.id, row.cols, row.rows, row.backend, row.state, row.exit_code])?;
            Ok(())
        })
    }

    /// `ready` runs under the replay lock, before any live bytes can overtake
    /// the snapshot. It should enqueue the opened reply on the WS writer.
    #[allow(clippy::too_many_arguments)]
    pub fn open(
        &self,
        session_id: &str,
        pane_id: &str,
        viewer_id: &str,
        cols: u16,
        rows: u16,
        login_shell: bool,
        on_data: TerminalDataListener,
        on_exit: TerminalExitListener,
        ready: impl FnOnce(&WorkspaceTerminal, String),
    ) -> anyhow::Result<()> {
        let _operation = self.operations.lock().unwrap();
        let (mut row, created) = self.reserve(session_id, pane_id, cols, rows)?;
        let key = format!("shell-{}", row.id);
        let identity = self.runtime.runtime_identity(&key);
        if identity.is_none() && !matches!(row.state.as_str(), "exited" | "lost") {
            // Once a launch may have happened, an absent process must never
            // be silently replaced by a fresh shell with an empty context.
            let resumable = row.backend == "daemon" && crate::daemon::session_alive(&key);
            if !created && !resumable {
                row.state = "lost".to_string();
                self.update(&row)?;
            } else {
                self.streams
                    .lock()
                    .unwrap()
                    .entry(row.id.clone())
                    .or_default();
                let streams = self.streams.clone();
                let id = row.id.clone();
                let data = Arc::new(move |_: String, text: String| {
                    let mut streams = streams.lock().unwrap();
                    if let Some(stream) = streams.get_mut(&id) {
                        stream.replay.push(&text);
                        for viewer in stream.viewers.values() {
                            (viewer.on_data)(id.clone(), text.clone());
                        }
                    }
                });
                let streams = self.streams.clone();
                let id = row.id.clone();
                let db = self.db.clone();
                let exit = Arc::new(move |_: String, code: i32| {
                    let _ = db.with_connection(|conn| {
                        conn.execute("UPDATE workspace_terminals SET state = 'exited', exit_code = ?2 WHERE id = ?1", params![id, code])?;
                        Ok(())
                    });
                    let streams = streams.lock().unwrap();
                    if let Some(stream) = streams.get(&id) {
                        for viewer in stream.viewers.values() {
                            (viewer.on_exit)(id.clone(), code);
                        }
                    }
                });
                let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
                let mut command = vec![shell];
                if login_shell {
                    command.push("-l".to_string());
                }
                let attached = if resumable {
                    self.runtime.attach_existing(
                        &key,
                        "host-runtime",
                        cols,
                        rows,
                        Some(row.cwd.clone()),
                        data,
                        exit,
                    )
                } else {
                    self.runtime.attach(
                        &key,
                        "host-runtime",
                        cols,
                        rows,
                        Some(row.cwd.clone()),
                        command,
                        data,
                        exit,
                    )
                };
                if let Err(error) = attached {
                    row.state = "lost".to_string();
                    self.update(&row)?;
                    return Err(error.context("could not open persistent shell"));
                }
                row.backend = if self
                    .runtime
                    .runtime_identity(&key)
                    .is_some_and(|identity| identity.daemon_session.is_some())
                {
                    "daemon"
                } else {
                    "process"
                }
                .to_string();
                row.state = "running".to_string();
                self.update(&row)?;
            }
        }
        let mut streams = self.streams.lock().unwrap();
        // The process can exit during attach. Never resurrect its persisted
        // running state or publish a stale ready snapshot after its exit.
        row = self
            .list(session_id)?
            .into_iter()
            .find(|candidate| candidate.id == row.id)
            .ok_or_else(|| anyhow!("terminal was closed"))?;
        let stream = streams.entry(row.id.clone()).or_default();
        if stream.viewers.len() >= MAX_VIEWERS && !stream.viewers.contains_key(viewer_id) {
            bail!("terminal viewer limit reached");
        }
        ready(&row, stream.replay.text());
        stream
            .viewers
            .insert(viewer_id.to_string(), Viewer { on_data, on_exit });
        Ok(())
    }

    pub fn release(&self, terminal_id: &str, viewer_id: &str) {
        if let Some(stream) = self.streams.lock().unwrap().get_mut(terminal_id) {
            stream.viewers.remove(viewer_id);
        }
    }

    pub fn release_connection(&self, viewer_id: &str) {
        let prefix = format!("{viewer_id}:");
        for stream in self.streams.lock().unwrap().values_mut() {
            stream
                .viewers
                .retain(|id, _| id != viewer_id && !id.starts_with(&prefix));
        }
    }

    pub fn contains(&self, terminal_id: &str) -> bool {
        self.streams.lock().unwrap().contains_key(terminal_id)
    }

    pub fn input(&self, terminal_id: &str, viewer_id: &str, data: &str) -> anyhow::Result<()> {
        if data.len() > MAX_TERMINAL_REPLAY_BYTES {
            bail!("terminal input exceeds limit");
        }
        let streams = self.streams.lock().unwrap();
        if !streams.get(terminal_id).is_some_and(|stream| {
            stream.viewers.contains_key(viewer_id)
                || stream
                    .viewers
                    .keys()
                    .any(|id| id.starts_with(&format!("{viewer_id}:")))
        }) {
            bail!("terminal is not attached to this view");
        }
        drop(streams);
        self.runtime.input(&format!("shell-{terminal_id}"), data);
        Ok(())
    }

    pub fn resize(
        &self,
        terminal_id: &str,
        viewer_id: &str,
        cols: u16,
        rows: u16,
    ) -> anyhow::Result<()> {
        if cols == 0 || rows == 0 || cols > 1000 || rows > 1000 {
            bail!("invalid terminal dimensions");
        }
        let streams = self.streams.lock().unwrap();
        if !streams.get(terminal_id).is_some_and(|stream| {
            stream.viewers.contains_key(viewer_id)
                || stream
                    .viewers
                    .keys()
                    .any(|id| id.starts_with(&format!("{viewer_id}:")))
        }) {
            bail!("terminal is not attached to this view");
        }
        drop(streams);
        self.runtime
            .resize(&format!("shell-{terminal_id}"), cols, rows);
        self.db.with_connection(|conn| {
            conn.execute(
                "UPDATE workspace_terminals SET cols = ?2, rows = ?3 WHERE id = ?1",
                params![terminal_id, cols, rows],
            )?;
            Ok(())
        })?;
        Ok(())
    }

    /// Closing is explicit and scoped to the session, unlike releasing a view.
    pub fn close(&self, session_id: &str, terminal_id: &str) -> anyhow::Result<()> {
        let _operation = self.operations.lock().unwrap();
        self.close_locked(session_id, terminal_id)
    }

    /// Deleting a session also closes its shells under the same spawn lock.
    pub fn delete_session(&self, session_id: &str) -> anyhow::Result<()> {
        let _operation = self.operations.lock().unwrap();
        for terminal in self.list(session_id)? {
            self.close_locked(session_id, &terminal.id)?;
        }
        self.db.delete_session(session_id)
    }

    fn close_locked(&self, session_id: &str, terminal_id: &str) -> anyhow::Result<()> {
        let exists = self
            .list(session_id)?
            .iter()
            .any(|row| row.id == terminal_id);
        if !exists {
            bail!("terminal does not belong to this session");
        }
        let key = format!("shell-{terminal_id}");
        // An in-process fallback shell has no daemon session; kill it here.
        self.runtime.kill(&key);
        // A daemon shell may not even be attached after a restart. Closing is
        // final, so its history goes too.
        std::thread::spawn(move || crate::daemon::discard(&key));
        self.db.with_connection(|conn| {
            conn.execute(
                "DELETE FROM workspace_terminals WHERE id = ?1 AND session_id = ?2",
                params![terminal_id, session_id],
            )?;
            Ok(())
        })?;
        if let Some(stream) = self.streams.lock().unwrap().remove(terminal_id) {
            // The child waiter runs later; publish closure before discarding
            // its subscribers so every device stops showing a live shell.
            for viewer in stream.viewers.values() {
                (viewer.on_exit)(terminal_id.to_string(), -1);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn replay_is_bounded_and_keeps_utf8_valid() {
        let mut replay = Replay::default();
        for _ in 0..100 {
            replay.push(&"🙂".repeat(1000));
        }
        assert!(replay.text().len() <= MAX_TERMINAL_REPLAY_BYTES);
        assert!(!replay.text().contains('\u{fffd}'));
        replay.push(&"🙂".repeat(MAX_TERMINAL_REPLAY_BYTES));
        assert!(replay.text().len() <= MAX_TERMINAL_REPLAY_BYTES);
        assert!(!replay.text().contains('\u{fffd}'));
    }

    #[test]
    fn shell_survives_view_release_and_panes_keep_separate_identity() {
        let db = Arc::new(HistoryDb::open(":memory:").unwrap());
        db.create_session("shell-test", "/tmp").unwrap();
        let manager = WorkspaceTerminals::new(db).unwrap();
        let mut first = None;
        manager
            .open(
                "shell-test",
                "pane-one",
                "viewer",
                80,
                24,
                false,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
                |row, _| first = Some(row.clone()),
            )
            .unwrap();
        let first = first.unwrap();
        manager
            .input(
                &first.id,
                "viewer",
                "printf 'PERSISTED_%s\\n' SHELL_SENTINEL\r",
            )
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(3);
        while !manager.streams.lock().unwrap()[&first.id]
            .replay
            .text()
            .contains("PERSISTED_SHELL_SENTINEL")
            && Instant::now() < deadline
        {
            std::thread::sleep(Duration::from_millis(10));
        }
        manager.release(&first.id, "viewer");
        assert!(manager.input(&first.id, "viewer", "wrong\r").is_err());
        let mut restored = None;
        let mut replay = String::new();
        manager
            .open(
                "shell-test",
                "pane-one",
                "viewer-two",
                80,
                24,
                false,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
                |row, text| {
                    restored = Some(row.clone());
                    replay = text;
                },
            )
            .unwrap();
        let mut second = None;
        manager
            .open(
                "shell-test",
                "pane-two",
                "viewer-two",
                80,
                24,
                false,
                Arc::new(|_, _| {}),
                Arc::new(|_, _| {}),
                |row, _| second = Some(row.clone()),
            )
            .unwrap();
        let second = second.unwrap();
        // Stop fixture processes before assertions so failures cannot leak shells.
        manager.close("shell-test", &first.id).unwrap();
        manager.close("shell-test", &second.id).unwrap();
        assert_eq!(restored.unwrap().id, first.id);
        assert_ne!(first.id, second.id);
        assert!(replay.contains("PERSISTED_SHELL_SENTINEL"));
        assert!(manager.list("shell-test").unwrap().is_empty());
    }

    #[test]
    fn missing_persisted_backend_is_lost_without_spawning_a_replacement() {
        let db = Arc::new(HistoryDb::open(":memory:").unwrap());
        db.create_session("lost-shell", "/tmp").unwrap();
        let manager = WorkspaceTerminals::new(db.clone()).unwrap();
        for backend in ["process", "daemon", "tmux", "pending"] {
            let (mut row, _) = manager.reserve("lost-shell", backend, 80, 24).unwrap();
            row.backend = backend.into();
            row.state = "running".into();
            manager.update(&row).unwrap();
            let mut state = String::new();
            manager
                .open(
                    "lost-shell",
                    backend,
                    "viewer",
                    80,
                    24,
                    false,
                    Arc::new(|_, _| {}),
                    Arc::new(|_, _| {}),
                    |row, _| state = row.state.clone(),
                )
                .unwrap();
            assert_eq!(state, "lost");
            assert!(manager
                .runtime
                .runtime_identity(&format!("shell-{}", row.id))
                .is_none());
            manager.close("lost-shell", &row.id).unwrap();
        }
        manager.delete_session("lost-shell").unwrap();
        assert!(db.get_session("lost-shell").unwrap().is_none());
    }
}
