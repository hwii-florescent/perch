//! Durable attention events (`attention_events`), the record behind Needs You
//! and Welcome Back (`server/attention.rs` admits them; see its header).
//!
//! Three separate axes per row: `requires_action` + `resolved_at` (Needs You
//! until the source resolves it), `read` (unread is cleared by viewing, never
//! by background restoration) and `dismissed` (the user hid an update; a live
//! question cannot be dismissed unless its evidence is unconfirmed).

use super::*;

/// Visible window: older rows are neither listed nor kept past boot pruning.
pub const ATTENTION_WINDOW_MS: i64 = 7 * 24 * 60 * 60 * 1000;
/// Most rows a snapshot lists; the list is newest first.
pub const MAX_ATTENTION_LISTED: usize = 100;
/// Rows kept at boot, newest first (unresolved questions always survive).
const MAX_ATTENTION_ROWS: i64 = 500;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttentionRow {
    pub id: String,
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub agent_id: String,
    /// `question` | `failed` | `finished` | `exited`.
    pub kind: String,
    pub requires_action: bool,
    /// `verified` | `heuristic` | `unconfirmed`.
    pub certainty: String,
    pub summary: String,
    pub occurred_at: i64,
    /// Turns coalesced into this unread row.
    pub count: i64,
    pub read: bool,
    pub resolved_at: Option<i64>,
    /// Changes of the newest completed turn that started before this event.
    pub changed_path_count: Option<usize>,
    pub changed_paths: Vec<String>,
}

/// What to record. `read` is true when a viewer was already watching.
pub struct AttentionAdmit<'a> {
    pub session_id: &'a str,
    pub agent_id: &'a str,
    pub kind: &'a str,
    pub requires_action: bool,
    pub certainty: &'a str,
    pub summary: &'a str,
    pub read: bool,
    pub now: i64,
}

const SELECT: &str = "SELECT a.id, a.session_id, s.workspace_id, s.project_id, a.agent_id, a.kind,
        a.requires_action, a.certainty, a.summary, a.occurred_at, a.count, a.read, a.resolved_at
     FROM attention_events a LEFT JOIN sessions s ON s.id = a.session_id";

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttentionRow> {
    Ok(AttentionRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workspace_id: row.get(2)?,
        project_id: row.get(3)?,
        agent_id: row.get(4)?,
        kind: row.get(5)?,
        requires_action: row.get::<_, i64>(6)? != 0,
        certainty: row.get(7)?,
        summary: row.get(8)?,
        occurred_at: row.get(9)?,
        count: row.get(10)?,
        read: row.get::<_, i64>(11)? != 0,
        resolved_at: row.get(12)?,
        changed_path_count: None,
        changed_paths: Vec::new(),
    })
}

impl HistoryDb {
    pub(super) fn migrate_attention(conn: &Connection) -> anyhow::Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS attention_events (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                requires_action INTEGER NOT NULL DEFAULT 0,
                certainty TEXT NOT NULL DEFAULT 'verified',
                summary TEXT NOT NULL DEFAULT '',
                occurred_at INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 1,
                read INTEGER NOT NULL DEFAULT 0,
                dismissed INTEGER NOT NULL DEFAULT 0,
                resolved_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS attention_events_session
                ON attention_events(session_id, kind);
            CREATE INDEX IF NOT EXISTS attention_events_time
                ON attention_events(occurred_at DESC);",
        )?;
        Ok(())
    }

    /// Open the session's question, or refresh the certainty of the one
    /// already open (one per session: a repeated prompt is the same item).
    pub fn open_attention_question(
        &self,
        session_id: &str,
        agent_id: &str,
        certainty: &str,
        now: i64,
    ) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let open: Option<(String, String)> = conn
            .query_row(
                "SELECT id, certainty FROM attention_events
                 WHERE session_id = ?1 AND kind = 'question' AND resolved_at IS NULL AND dismissed = 0",
                params![session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((id, current)) = open {
            if current == certainty {
                return Ok(false);
            }
            conn.execute(
                "UPDATE attention_events SET certainty = ?2 WHERE id = ?1",
                params![id, certainty],
            )?;
            return Ok(true);
        }
        conn.execute(
            "INSERT INTO attention_events
                (id, session_id, agent_id, kind, requires_action, certainty, summary, occurred_at)
             VALUES (?1, ?2, ?3, 'question', 1, ?4, 'Waiting for you', ?5)",
            params![
                Uuid::new_v4().to_string(),
                session_id,
                agent_id,
                certainty,
                now
            ],
        )?;
        Ok(true)
    }

    /// The source resolved `kind` (`question` answered, `failed` superseded by
    /// a new turn). Resolution, not reading: only real evidence calls this.
    pub fn resolve_attention(
        &self,
        session_id: &str,
        kind: &str,
        now: i64,
    ) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE attention_events SET resolved_at = ?3
             WHERE session_id = ?1 AND kind = ?2 AND resolved_at IS NULL",
            params![session_id, kind, now],
        )? > 0)
    }

    /// Record an update. An unread, undismissed row of the same kind for the
    /// session absorbs it (newer time, one more turn), so an agent finishing
    /// ten turns while you are away is one row, not ten.
    pub fn record_attention(&self, admit: AttentionAdmit<'_>) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        let updated = if admit.read {
            0
        } else {
            conn.execute(
                "UPDATE attention_events SET occurred_at = ?3, summary = ?4, count = count + 1,
                        certainty = ?5
                 WHERE session_id = ?1 AND kind = ?2 AND read = 0 AND dismissed = 0
                   AND resolved_at IS NULL",
                params![
                    admit.session_id,
                    admit.kind,
                    admit.now,
                    admit.summary,
                    admit.certainty
                ],
            )?
        };
        if updated == 0 {
            conn.execute(
                "INSERT INTO attention_events
                    (id, session_id, agent_id, kind, requires_action, certainty, summary,
                     occurred_at, read)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    Uuid::new_v4().to_string(),
                    admit.session_id,
                    admit.agent_id,
                    admit.kind,
                    admit.requires_action as i64,
                    admit.certainty,
                    admit.summary,
                    admit.now,
                    admit.read as i64
                ],
            )?;
        }
        Ok(())
    }

    /// Viewing a session reads its events; it never resolves a question.
    pub fn read_attention_for_session(&self, session_id: &str) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE attention_events SET read = 1 WHERE session_id = ?1 AND read = 0",
            params![session_id],
        )? > 0)
    }

    /// `read` marks rows read. `dismiss` hides updates and failures; a live
    /// question stays until answered unless its evidence is unconfirmed.
    pub fn update_attention(&self, ids: &[String], dismiss: bool) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let mut changed = 0;
        for id in ids.iter().take(MAX_ATTENTION_LISTED) {
            changed += if dismiss {
                conn.execute(
                    "UPDATE attention_events SET dismissed = 1, read = 1
                     WHERE id = ?1 AND dismissed = 0
                       AND (kind != 'question' OR certainty = 'unconfirmed' OR resolved_at IS NOT NULL)",
                    params![id],
                )?
            } else {
                conn.execute(
                    "UPDATE attention_events SET read = 1 WHERE id = ?1 AND read = 0",
                    params![id],
                )?
            };
        }
        Ok(changed > 0)
    }

    pub fn delete_attention_for_session(&self, session_id: &str) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "DELETE FROM attention_events WHERE session_id = ?1",
            params![session_id],
        )? > 0)
    }

    /// Boot: a question's blocked state lived in the previous process, so it
    /// is no longer confirmed. Keep it, say so, and prune old history.
    pub fn reconcile_attention_at_boot(&self, now: i64) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE attention_events SET certainty = 'unconfirmed'
             WHERE kind = 'question' AND resolved_at IS NULL",
            [],
        )?;
        conn.execute(
            "DELETE FROM attention_events
             WHERE NOT (kind = 'question' AND resolved_at IS NULL AND dismissed = 0)
               AND (occurred_at < ?1 OR id NOT IN
                    (SELECT id FROM attention_events ORDER BY occurred_at DESC LIMIT ?2))",
            params![now - ATTENTION_WINDOW_MS, MAX_ATTENTION_ROWS],
        )?;
        conn.execute(
            "DELETE FROM attention_events WHERE session_id NOT IN (SELECT id FROM sessions)",
            [],
        )?;
        Ok(())
    }

    /// Unresolved, undismissed events from the window, newest first, with the
    /// changes of each event's turn when Git recorded one.
    pub fn list_attention(&self, now: i64) -> anyhow::Result<Vec<AttentionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "{SELECT} WHERE a.dismissed = 0 AND a.resolved_at IS NULL AND a.occurred_at >= ?1
             ORDER BY a.occurred_at DESC LIMIT ?2"
        ))?;
        let mut rows = stmt
            .query_map(
                params![now - ATTENTION_WINDOW_MS, MAX_ATTENTION_LISTED as i64],
                row_from,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        drop(stmt);
        let mut turn = conn.prepare(
            "SELECT changed_paths_json, after_status FROM agent_change_snapshots
             WHERE session_id = ?1 AND completed = 1 AND created_at <= ?2
             ORDER BY created_at DESC LIMIT 1",
        )?;
        for row in rows.iter_mut().filter(|row| row.kind == "finished") {
            let found: Option<(Option<String>, Option<String>)> = turn
                .query_row(params![row.session_id, row.occurred_at], |r| {
                    Ok((r.get(0)?, r.get(1)?))
                })
                .optional()?;
            let Some((paths, status)) = found else {
                continue;
            };
            let paths: Vec<String> = paths
                .and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default();
            row.changed_path_count = status
                .and_then(|status| serde_json::from_str::<serde_json::Value>(&status).ok())
                .and_then(|status| status["turnChangedPathCount"].as_u64())
                .map(|count| count as usize)
                .or(Some(paths.len()));
            row.changed_paths = paths.into_iter().take(5).collect();
        }
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db_with_session() -> (HistoryDb, String) {
        let dir = std::env::temp_dir().join(format!("perch-attention-{}", Uuid::new_v4()));
        let db = HistoryDb::open(dir.join("history.sqlite")).unwrap();
        let id = Uuid::new_v4().to_string();
        db.create_session(&id, "/tmp").unwrap();
        (db, id)
    }

    fn finished<'a>(session: &'a str, read: bool, now: i64) -> AttentionAdmit<'a> {
        AttentionAdmit {
            session_id: session,
            agent_id: "claude",
            kind: "finished",
            requires_action: false,
            certainty: "verified",
            summary: "Finished",
            read,
            now,
        }
    }

    #[test]
    fn questions_stay_until_resolved_and_survive_restart_unconfirmed() {
        let (db, s) = db_with_session();
        let now = now_millis();
        assert!(db
            .open_attention_question(&s, "claude", "verified", now)
            .unwrap());
        assert!(!db
            .open_attention_question(&s, "claude", "verified", now)
            .unwrap());
        // Reading and dismissing do not answer a live question.
        assert!(db.read_attention_for_session(&s).unwrap());
        let id = db.list_attention(now).unwrap()[0].id.clone();
        assert!(!db
            .update_attention(std::slice::from_ref(&id), true)
            .unwrap());
        assert_eq!(db.list_attention(now).unwrap().len(), 1);
        // Restart: kept, but no longer confirmed, and then dismissable.
        db.reconcile_attention_at_boot(now).unwrap();
        assert_eq!(db.list_attention(now).unwrap()[0].certainty, "unconfirmed");
        assert!(db
            .open_attention_question(&s, "claude", "verified", now)
            .unwrap());
        assert_eq!(db.list_attention(now).unwrap()[0].certainty, "verified");
        assert!(db.resolve_attention(&s, "question", now).unwrap());
        assert!(db.list_attention(now).unwrap().is_empty());
    }

    #[test]
    fn unread_updates_coalesce_and_read_ones_do_not() {
        let (db, s) = db_with_session();
        let now = now_millis();
        db.record_attention(finished(&s, false, now)).unwrap();
        db.record_attention(finished(&s, false, now + 1)).unwrap();
        let rows = db.list_attention(now + 1).unwrap();
        assert_eq!(
            (rows.len(), rows[0].count, rows[0].occurred_at),
            (1, 2, now + 1)
        );
        db.read_attention_for_session(&s).unwrap();
        db.record_attention(finished(&s, false, now + 2)).unwrap();
        db.record_attention(finished(&s, true, now + 3)).unwrap();
        assert_eq!(db.list_attention(now + 3).unwrap().len(), 3);
        let ids: Vec<_> = db
            .list_attention(now)
            .unwrap()
            .into_iter()
            .map(|r| r.id)
            .collect();
        assert!(db.update_attention(&ids, true).unwrap());
        assert!(db.list_attention(now + 3).unwrap().is_empty());
    }

    #[test]
    fn deleted_sessions_and_old_history_are_pruned() {
        let (db, s) = db_with_session();
        let now = now_millis();
        db.record_attention(finished(&s, false, now - ATTENTION_WINDOW_MS - 1))
            .unwrap();
        db.record_attention(AttentionAdmit {
            kind: "exited",
            ..finished(&s, false, now)
        })
        .unwrap();
        db.record_attention(finished("gone", false, now)).unwrap();
        db.reconcile_attention_at_boot(now).unwrap();
        let rows = db.list_attention(now).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].kind, "exited");
        assert!(db.delete_attention_for_session(&s).unwrap());
    }
}
