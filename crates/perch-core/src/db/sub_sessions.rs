//! Sub-session records (`crate::sub_sessions`): one row per child a lead started, and the
//! `sessions.parent_session_id` link that nests the child under its lead. The limits are
//! checked and the rows written in one transaction, so two spawns racing cannot both pass a
//! count that only one of them fits under.
use super::*;
use crate::sub_sessions::{self, Refusal, SpawnContext, SubState, TurnOrigin};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubSessionRow {
    pub child_session_id: String,
    pub parent_session_id: String,
    /// The lead's run when it spawned, so a record says whose authority started the child.
    pub parent_incarnation: String,
    pub workspace_id: String,
    pub provider_id: String,
    pub model: Option<String>,
    pub spawn_key: String,
    pub state: SubState,
    pub task: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A spawn to record, after everything that does not need the database has been checked.
pub struct SubSessionSpec<'a> {
    pub child_session_id: &'a str,
    pub parent_session_id: &'a str,
    pub parent_incarnation: &'a str,
    pub workspace: &'a WorkspaceRow,
    pub cwd: &'a str,
    pub provider_id: &'a str,
    pub model: Option<&'a str>,
    pub spawn_key: &'a str,
    pub task: &'a str,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Reserved {
    /// Recorded; the caller launches it.
    New(SubSessionRow),
    /// The same key from the same lead already started this child. Nothing is started again.
    Existing(SubSessionRow),
    Refused(Refusal),
}

const COLUMNS: &str = "child_session_id, parent_session_id, parent_incarnation, workspace_id,
    provider_id, model, spawn_key, state, task, created_at, updated_at";

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<SubSessionRow> {
    let state: String = row.get(7)?;
    Ok(SubSessionRow {
        child_session_id: row.get(0)?,
        parent_session_id: row.get(1)?,
        parent_incarnation: row.get(2)?,
        workspace_id: row.get(3)?,
        provider_id: row.get(4)?,
        model: row.get(5)?,
        spawn_key: row.get(6)?,
        // A state this build does not know is unknown, which still counts as live.
        state: SubState::parse(&state).unwrap_or(SubState::StartUnknown),
        task: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

impl HistoryDb {
    /// Admit and record a spawn: the key's earlier child if there is one, else the limits and
    /// the turn rule, then the child's session row and its record, atomically.
    pub fn reserve_sub_session(
        &self,
        spec: &SubSessionSpec<'_>,
        turn: Option<TurnOrigin>,
    ) -> anyhow::Result<Reserved> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let existing = tx
            .query_row(
                &format!(
                    "SELECT {COLUMNS} FROM sub_sessions
                     WHERE parent_session_id = ?1 AND spawn_key = ?2"
                ),
                params![spec.parent_session_id, spec.spawn_key],
                row_from,
            )
            .optional()?;
        if let Some(existing) = existing {
            return Ok(Reserved::Existing(existing));
        }
        let caller_is_child = tx
            .query_row(
                "SELECT parent_session_id IS NOT NULL FROM sessions WHERE id = ?1",
                params![spec.parent_session_id],
                |row| row.get::<_, bool>(0),
            )
            .optional()?
            .ok_or_else(|| anyhow::anyhow!("the lead session no longer exists"))?;
        let live_placeholders = vec!["?"; SubState::LIVE.len()].join(",");
        let count = |live_only: bool| -> anyhow::Result<usize> {
            let mut sql =
                "SELECT COUNT(*) FROM sub_sessions WHERE parent_session_id = ?".to_string();
            let mut values: Vec<&dyn rusqlite::ToSql> = vec![&spec.parent_session_id];
            if live_only {
                sql += &format!(" AND state IN ({live_placeholders})");
                values.extend(SubState::LIVE.iter().map(|s| s as &dyn rusqlite::ToSql));
            }
            Ok(tx.query_row(&sql, values.as_slice(), |row| row.get::<_, i64>(0))? as usize)
        };
        let context = SpawnContext {
            caller_is_child,
            turn,
            live_children: count(true)?,
            all_children: count(false)?,
        };
        if let Err(refusal) = sub_sessions::admit(&context) {
            return Ok(Reserved::Refused(refusal));
        }
        let now = now_millis();
        tx.execute(
            "INSERT INTO sessions
                (id, cwd, created_at, host_id, project_id, workspace_id, parent_session_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                spec.child_session_id,
                spec.cwd,
                now,
                spec.workspace.host_id,
                spec.workspace.project_id,
                spec.workspace.id,
                spec.parent_session_id
            ],
        )?;
        tx.execute(
            "INSERT INTO sub_sessions
                (child_session_id, parent_session_id, parent_incarnation, workspace_id,
                 provider_id, model, spawn_key, state, task, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'starting', ?8, ?9, ?9)",
            params![
                spec.child_session_id,
                spec.parent_session_id,
                spec.parent_incarnation,
                spec.workspace.id,
                spec.provider_id,
                spec.model,
                spec.spawn_key,
                spec.task,
                now
            ],
        )?;
        let row = tx.query_row(
            &format!("SELECT {COLUMNS} FROM sub_sessions WHERE child_session_id = ?1"),
            params![spec.child_session_id],
            row_from,
        )?;
        tx.commit()?;
        Ok(Reserved::New(row))
    }

    pub fn sub_session(&self, child_session_id: &str) -> anyhow::Result<Option<SubSessionRow>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                &format!("SELECT {COLUMNS} FROM sub_sessions WHERE child_session_id = ?1"),
                params![child_session_id],
                row_from,
            )
            .optional()?)
    }

    /// The child a lead's spawn key started, if any record of it exists.
    pub fn sub_session_by_key(
        &self,
        parent_session_id: &str,
        spawn_key: &str,
    ) -> anyhow::Result<Option<SubSessionRow>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                &format!(
                    "SELECT {COLUMNS} FROM sub_sessions
                     WHERE parent_session_id = ?1 AND spawn_key = ?2"
                ),
                params![parent_session_id, spawn_key],
                row_from,
            )
            .optional()?)
    }

    /// Every child a lead started, oldest first.
    pub fn sub_sessions_of(&self, parent_session_id: &str) -> anyhow::Result<Vec<SubSessionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM sub_sessions WHERE parent_session_id = ?1
             ORDER BY created_at, child_session_id"
        ))?;
        let rows = statement.query_map(params![parent_session_id], row_from)?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Put a just-reserved child in a checkout made for it (`perch spawn --worktree`).
    pub fn move_child_to_workspace(
        &self,
        child_session_id: &str,
        workspace: &WorkspaceRow,
        cwd: &str,
    ) -> anyhow::Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE sessions SET cwd = ?2, project_id = ?3, workspace_id = ?4 WHERE id = ?1",
            params![child_session_id, cwd, workspace.project_id, workspace.id],
        )?;
        tx.execute(
            "UPDATE sub_sessions SET workspace_id = ?2 WHERE child_session_id = ?1",
            params![child_session_id, workspace.id],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// The lead a session was started under, if it is a child.
    pub fn parent_of(&self, session_id: &str) -> anyhow::Result<Option<String>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT parent_session_id FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten())
    }

    /// Move a child from one of `from` to `to`; `false` when it was in none of them, so two
    /// writers cannot both settle the same step.
    pub fn move_sub_session(
        &self,
        child_session_id: &str,
        from: &[SubState],
        to: SubState,
    ) -> anyhow::Result<bool> {
        let placeholders = vec!["?"; from.len()].join(",");
        let now = now_millis();
        let to = to.as_str();
        let from: Vec<&str> = from.iter().map(|state| state.as_str()).collect();
        let mut values: Vec<&dyn rusqlite::ToSql> = vec![&to, &now, &child_session_id];
        values.extend(from.iter().map(|s| s as &dyn rusqlite::ToSql));
        Ok(self.conn.lock().unwrap().execute(
            &format!(
                "UPDATE sub_sessions SET state = ?, updated_at = ?
                 WHERE child_session_id = ? AND state IN ({placeholders})"
            ),
            values.as_slice(),
        )? > 0)
    }

    /// At boot: a launch that was in flight when the core stopped is not known to have
    /// finished or failed.
    pub fn mark_unfinished_sub_sessions_unknown(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE sub_sessions SET state = 'start_unknown', updated_at = ?1
             WHERE state = 'starting'",
            params![now_millis()],
        )?)
    }

    pub(super) fn delete_sub_sessions_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM sub_sessions WHERE child_session_id = ?1 OR parent_session_id = ?1",
            params![session_id],
        )?;
        // A child outlives its lead's deletion as an ordinary session.
        conn.execute(
            "UPDATE sessions SET parent_session_id = NULL WHERE parent_session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db_with_lead() -> (HistoryDb, WorkspaceRow) {
        let db = HistoryDb::open(
            std::env::temp_dir().join(format!("perch-sub-sessions-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/perch-sub-sessions-nest", Some("nest"), None)
            .unwrap();
        db.create_session_in_workspace("lead", &workspace, "/tmp/perch-sub-sessions-nest")
            .unwrap();
        (db, workspace)
    }

    fn spec<'a>(workspace: &'a WorkspaceRow, child: &'a str, key: &'a str) -> SubSessionSpec<'a> {
        SubSessionSpec {
            child_session_id: child,
            parent_session_id: "lead",
            parent_incarnation: "run-1",
            workspace,
            cwd: "/tmp/nest",
            provider_id: "codex",
            model: Some("gpt-5.6-luna"),
            spawn_key: key,
            task: "do a thing",
        }
    }

    fn reserve(db: &HistoryDb, workspace: &WorkspaceRow, n: usize) -> Reserved {
        let (child, key) = (format!("child-{n}"), format!("key-{n}"));
        db.reserve_sub_session(&spec(workspace, &child, &key), Some(TurnOrigin::Person))
            .unwrap()
    }

    #[test]
    fn a_spawn_records_the_child_under_its_lead() {
        let (db, workspace) = db_with_lead();
        let Reserved::New(row) = reserve(&db, &workspace, 1) else {
            panic!("expected a new child");
        };
        assert_eq!(row.state, SubState::Starting);
        assert_eq!(row.model.as_deref(), Some("gpt-5.6-luna"));
        assert_eq!(row.parent_incarnation, "run-1");
        assert_eq!(db.parent_of("child-1").unwrap().as_deref(), Some("lead"));
        assert_eq!(db.parent_of("lead").unwrap(), None);
        assert_eq!(db.sub_sessions_of("lead").unwrap(), vec![row]);
    }

    #[test]
    fn the_same_key_returns_the_same_child_and_starts_nothing_new() {
        let (db, workspace) = db_with_lead();
        let Reserved::New(first) = reserve(&db, &workspace, 1) else {
            panic!()
        };
        let again = db
            .reserve_sub_session(
                &spec(&workspace, "child-other", "key-1"),
                Some(TurnOrigin::Person),
            )
            .unwrap();
        assert_eq!(again, Reserved::Existing(first));
        assert_eq!(db.sub_sessions_of("lead").unwrap().len(), 1);
        assert!(!db.session_exists("child-other").unwrap());
    }

    #[test]
    fn the_fifth_live_child_and_the_ninth_child_are_refused_before_a_session_exists() {
        let (db, workspace) = db_with_lead();
        for n in 1..=4 {
            assert!(matches!(reserve(&db, &workspace, n), Reserved::New(_)));
        }
        assert_eq!(
            reserve(&db, &workspace, 5),
            Reserved::Refused(Refusal::Concurrent)
        );
        assert!(!db.session_exists("child-5").unwrap());
        // Stopped children free their slot but still count toward the total.
        for n in 1..=4 {
            let id = format!("child-{n}");
            assert!(db
                .move_sub_session(&id, &[SubState::Starting], SubState::Stopped)
                .unwrap());
        }
        for n in 5..=8 {
            assert!(
                matches!(reserve(&db, &workspace, n), Reserved::New(_)),
                "{n}"
            );
            let id = format!("child-{n}");
            db.move_sub_session(&id, &[SubState::Starting], SubState::Exited)
                .unwrap();
        }
        assert_eq!(
            reserve(&db, &workspace, 9),
            Reserved::Refused(Refusal::Descendants)
        );
    }

    #[test]
    fn unknown_states_keep_their_slot() {
        let (db, workspace) = db_with_lead();
        for n in 1..=4 {
            reserve(&db, &workspace, n);
        }
        db.move_sub_session("child-1", &[SubState::Starting], SubState::StopUnknown)
            .unwrap();
        db.move_sub_session("child-2", &[SubState::Starting], SubState::StartUnknown)
            .unwrap();
        assert_eq!(
            reserve(&db, &workspace, 5),
            Reserved::Refused(Refusal::Concurrent)
        );
    }

    #[test]
    fn a_child_cannot_spawn_and_a_turn_not_opened_by_a_person_cannot_either() {
        let (db, workspace) = db_with_lead();
        reserve(&db, &workspace, 1);
        let from_child = SubSessionSpec {
            parent_session_id: "child-1",
            ..spec(&workspace, "grandchild", "k")
        };
        assert_eq!(
            db.reserve_sub_session(&from_child, Some(TurnOrigin::Person))
                .unwrap(),
            Reserved::Refused(Refusal::Depth)
        );
        for turn in [Some(TurnOrigin::Agent), None] {
            assert_eq!(
                db.reserve_sub_session(&spec(&workspace, "c2", "k2"), turn)
                    .unwrap(),
                Reserved::Refused(Refusal::NotPersonTurn)
            );
        }
        assert!(!db.session_exists("c2").unwrap());
    }

    #[test]
    fn a_state_moves_only_from_the_states_named() {
        let (db, workspace) = db_with_lead();
        reserve(&db, &workspace, 1);
        assert!(!db
            .move_sub_session("child-1", &[SubState::Running], SubState::Stopping)
            .unwrap());
        assert!(db
            .move_sub_session("child-1", &[SubState::Starting], SubState::Running)
            .unwrap());
        assert_eq!(
            db.sub_session("child-1").unwrap().unwrap().state,
            SubState::Running
        );
    }

    #[test]
    fn a_launch_in_flight_at_boot_becomes_unknown_not_failed() {
        let (db, workspace) = db_with_lead();
        reserve(&db, &workspace, 1);
        reserve(&db, &workspace, 2);
        db.move_sub_session("child-2", &[SubState::Starting], SubState::Running)
            .unwrap();
        assert_eq!(db.mark_unfinished_sub_sessions_unknown().unwrap(), 1);
        let state = |id: &str| db.sub_session(id).unwrap().unwrap().state;
        assert_eq!(state("child-1"), SubState::StartUnknown);
        assert_eq!(state("child-2"), SubState::Running);
    }

    #[test]
    fn deleting_a_lead_frees_its_children_and_deleting_a_child_drops_its_record() {
        let (db, workspace) = db_with_lead();
        reserve(&db, &workspace, 1);
        reserve(&db, &workspace, 2);
        db.delete_session("child-1").unwrap();
        assert_eq!(db.sub_sessions_of("lead").unwrap().len(), 1);
        db.delete_session("lead").unwrap();
        assert!(db.sub_sessions_of("lead").unwrap().is_empty());
        assert_eq!(db.parent_of("child-2").unwrap(), None);
        assert!(db.session_exists("child-2").unwrap());
    }
}
