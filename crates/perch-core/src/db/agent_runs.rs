//! Logical runs: the family of children, mail and notes a *conversation* owns, apart from the
//! terminal tab, the agent process and its credential that carry it.
//!
//! A run is named by a string. The run a lead tab had before this existed is its own session id
//! and has no row, so old rows (`agent_mail.run_id`, `sub_sessions.parent_run_id`) stay valid
//! unchanged; every later run is a uuid in `agent_runs`. A lead's current run is
//! `sessions.run_id`; a child is always in the run it was started in (`sub_sessions.parent_run_id`),
//! however often its own conversation is reset.
//!
//! A run begins at a launch (`issue`) and at a provider-confirmed new conversation
//! ([`HistoryDb::observe_conversation`]); a known conversation seen again restores its run. Nothing
//! is inferred from input or text, and a conversation the session does not own is ignored.
use super::*;

/// What one observed provider conversation did to the session's run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Observed {
    /// The session's current conversation, or one that cannot be placed (another session's, a child
    /// of nobody): nothing changed.
    Unchanged,
    /// The first conversation since the launch joined the run the launch began.
    Bound,
    /// A new conversation began this run, replacing the one the session had.
    Fresh(String),
    /// A known conversation came back, and with it this earlier run.
    Resumed(String),
}

/// A key as stored: unique within its run, so a fresh conversation of the same tab may reuse the
/// words of an earlier one without being handed that one's message, card or child. The run an old
/// tab had (its own session id) keeps its keys as they were.
pub fn scoped_key(run_id: &str, session_id: &str, key: &str) -> String {
    if run_id == session_id {
        key.to_string()
    } else {
        format!("{run_id}:{key}")
    }
}

/// The run `session` is in. `None` when the session does not exist.
pub(super) fn run_of(conn: &Connection, session_id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT COALESCE(
            (SELECT parent_run_id FROM sub_sessions WHERE child_session_id = s.id),
            s.run_id, s.id)
         FROM sessions s WHERE s.id = ?1",
        params![session_id],
        |row| row.get(0),
    )
    .optional()
}

fn is_child(conn: &Connection, session_id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT 1 FROM sub_sessions WHERE child_session_id = ?1",
        params![session_id],
        |_| Ok(()),
    )
    .optional()
    .map(|found| found.is_some())
}

/// Forget a run nothing refers to: an abandoned launch, or the empty run a resume replaced.
fn drop_if_empty(conn: &Connection, run_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM agent_runs WHERE run_id = ?1
           AND NOT EXISTS (SELECT 1 FROM sub_sessions WHERE parent_run_id = ?1)
           AND NOT EXISTS (SELECT 1 FROM agent_mail WHERE run_id = ?1)
           AND NOT EXISTS (SELECT 1 FROM agent_conversations WHERE run_id = ?1)
           AND NOT EXISTS (SELECT 1 FROM suggestions WHERE run_id = ?1)",
        params![run_id],
    )?;
    Ok(())
}

/// Start a fresh run for a lead session and make it current, with no conversation yet. `None` for a
/// session that does not exist or is a child (a child never has a run of its own).
pub(super) fn begin_run_locked(
    conn: &Connection,
    session_id: &str,
) -> rusqlite::Result<Option<String>> {
    if is_child(conn, session_id)? {
        return Ok(None);
    }
    let Some(before) = run_of(conn, session_id)? else {
        return Ok(None);
    };
    let run = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO agent_runs (run_id, session_id, created_at) VALUES (?1, ?2, ?3)",
        params![run, session_id, now_millis()],
    )?;
    conn.execute(
        "UPDATE sessions SET run_id = ?2, conversation_ordinal = 0 WHERE id = ?1",
        params![session_id, run],
    )?;
    drop_if_empty(conn, &before)?;
    Ok(Some(run))
}

impl HistoryDb {
    /// The run a session is in: its lead's current run, or the one a child was started in.
    pub fn run_of(&self, session_id: &str) -> anyhow::Result<Option<String>> {
        Ok(run_of(&self.conn.lock().unwrap(), session_id)?)
    }

    /// Whether a run still exists: its lead's session does, and it is the lead's own first run or
    /// one that has a row.
    pub fn run_exists(&self, run_id: &str) -> anyhow::Result<bool> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT 1 FROM agent_runs WHERE run_id = ?1
                 UNION SELECT 1 FROM sessions WHERE id = ?1",
                params![run_id],
                |_| Ok(()),
            )
            .optional()?
            .is_some())
    }

    /// The runs a lead session has started since the first (which is named by the session).
    pub fn runs_of_session(&self, session_id: &str) -> anyhow::Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare("SELECT run_id FROM agent_runs WHERE session_id = ?1")?;
        let rows = statement.query_map(params![session_id], |row| row.get(0))?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// The ordinal of the session's current provider conversation: 0 before one is seen.
    pub fn conversation_ordinal(&self, session_id: &str) -> anyhow::Result<u32> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT conversation_ordinal FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(0))
    }

    /// Record the provider conversation a session's agent is in now, as its native adapter
    /// confirmed it, and move the session's run if that is a boundary: the session's first
    /// conversation since its launch joins that launch's run, a conversation not seen before in
    /// a session that already had one begins a fresh run, and a known one restores its own run.
    /// An unrecognized conversation of a legacy tab (no recorded launch) starts a fresh run:
    /// there is no evidence that it owns the tab's earlier family. Known resumes are unchanged.
    /// A child's run never changes; only its conversation is counted.
    pub fn observe_conversation(
        &self,
        session_id: &str,
        provider_id: &str,
        conversation_id: &str,
    ) -> anyhow::Result<Observed> {
        if conversation_id.is_empty() {
            return Ok(Observed::Unchanged);
        }
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let Some(current) = run_of(&tx, session_id)? else {
            return Ok(Observed::Unchanged);
        };
        let child = is_child(&tx, session_id)?;
        let known: Option<(String, String, u32)> = tx
            .query_row(
                "SELECT session_id, run_id, ordinal FROM agent_conversations
                 WHERE provider_id = ?1 AND conversation_id = ?2",
                params![provider_id, conversation_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        let ordinal: u32 = tx.query_row(
            "SELECT conversation_ordinal FROM sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;
        let set_ordinal = |tx: &rusqlite::Transaction<'_>, ordinal: u32| {
            tx.execute(
                "UPDATE sessions SET conversation_ordinal = ?2 WHERE id = ?1",
                params![session_id, ordinal],
            )
        };
        let observed = match known {
            // Another session's conversation is not this session's to resume.
            Some((owner, ..)) if owner != session_id => Observed::Unchanged,
            Some((_, run, known_ordinal)) => {
                if known_ordinal != ordinal {
                    set_ordinal(&tx, known_ordinal)?;
                }
                if child || run == current {
                    Observed::Unchanged
                } else {
                    tx.execute(
                        "UPDATE sessions SET run_id = ?2 WHERE id = ?1",
                        params![session_id, run],
                    )?;
                    drop_if_empty(&tx, &current)?;
                    Observed::Resumed(run)
                }
            }
            None => {
                // Only a recorded launch may bind its first conversation to an unobserved run.
                // The legacy tab-id fallback is not evidence of this conversation's ownership.
                let fresh = !child && (ordinal > 0 || current == session_id);
                let run = if fresh {
                    begin_run_locked(&tx, session_id)?.unwrap_or(current)
                } else {
                    current
                };
                let next: u32 = tx.query_row(
                    "SELECT COALESCE(MAX(ordinal), 0) + 1 FROM agent_conversations
                     WHERE session_id = ?1",
                    params![session_id],
                    |row| row.get(0),
                )?;
                tx.execute(
                    "INSERT INTO agent_conversations
                        (provider_id, conversation_id, session_id, run_id, ordinal, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        provider_id,
                        conversation_id,
                        session_id,
                        run,
                        next,
                        now_millis()
                    ],
                )?;
                set_ordinal(&tx, next)?;
                if fresh {
                    Observed::Fresh(run)
                } else {
                    Observed::Bound
                }
            }
        };
        tx.commit()?;
        Ok(observed)
    }

    /// Every child ever started under a lead session, in whichever run, with the run it is in.
    /// A person sees all of them; an agent sees only its own run's.
    pub fn sub_sessions_in_run(&self, run_id: &str) -> anyhow::Result<Vec<SubSessionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(&format!(
            "SELECT {} FROM sub_sessions WHERE parent_run_id = ?1
             ORDER BY created_at, child_session_id",
            sub_sessions::COLUMNS
        ))?;
        let rows = statement.query_map(params![run_id], sub_sessions::row_from)?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Whether `child` was started in `caller`'s current run: what a lead needs to read it, steer it,
    /// stop it or hear from it.
    pub fn owns_child(
        &self,
        caller_session_id: &str,
        child_session_id: &str,
    ) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let Some(run) = run_of(&conn, caller_session_id)? else {
            return Ok(false);
        };
        Ok(conn
            .query_row(
                "SELECT 1 FROM sub_sessions
                 WHERE child_session_id = ?1 AND parent_session_id = ?2 AND parent_run_id = ?3",
                params![child_session_id, caller_session_id, run],
                |_| Ok(()),
            )
            .optional()?
            .is_some())
    }

    /// Forget a deleted session's runs and conversations.
    pub(super) fn delete_agent_runs_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM agent_runs WHERE session_id = ?1",
            params![session_id],
        )?;
        conn.execute(
            "DELETE FROM agent_conversations WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    fn db_with(sessions: &[&str]) -> (HistoryDb, WorkspaceRow) {
        let db = HistoryDb::open(
            std::env::temp_dir().join(format!("perch-runs-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/perch-runs-nest", Some("nest"), None)
            .unwrap();
        for id in sessions {
            db.create_session_in_workspace(id, &workspace, "/tmp/perch-runs-nest")
                .unwrap();
        }
        (db, workspace)
    }

    fn launch(db: &HistoryDb, workspace: &WorkspaceRow, session: &str) {
        db.issue(&AgentKey::new(&workspace.id, session, "claude").unwrap())
            .unwrap();
    }

    fn child(db: &HistoryDb, workspace: &WorkspaceRow, id: &str, key: &str) {
        let spec = SubSessionSpec {
            child_session_id: id,
            parent_session_id: "lead",
            parent_incarnation: "i",
            workspace,
            cwd: "/tmp/perch-runs-nest",
            provider_id: "codex",
            model: None,
            spawn_key: key,
            task: "t",
        };
        assert!(matches!(
            db.reserve_sub_session(&spec).unwrap(),
            Reserved::New(_)
        ));
    }

    #[test]
    fn a_session_without_a_launch_is_in_the_run_its_own_id_names() {
        let (db, _) = db_with(&["lead"]);
        assert_eq!(db.run_of("lead").unwrap().as_deref(), Some("lead"));
        assert_eq!(db.run_of("nobody").unwrap(), None);
        assert!(db.run_exists("lead").unwrap());
        assert!(!db.run_exists("nobody").unwrap());
    }

    #[test]
    fn a_legacy_leads_first_conversation_does_not_adopt_its_old_children() {
        let (db, workspace) = db_with(&["lead"]);
        child(&db, &workspace, "old", "k");
        assert_eq!(db.run_of("lead").unwrap().as_deref(), Some("lead"));
        // No provider identity is not evidence of a new conversation.
        assert_eq!(
            db.observe_conversation("lead", "pi", "").unwrap(),
            Observed::Unchanged
        );
        let observed = db.observe_conversation("lead", "pi", "new-pi").unwrap();
        let Observed::Fresh(run) = observed else {
            panic!("an unrecognized conversation must not inherit a legacy family: {observed:?}");
        };
        assert_ne!(run, "lead");
        assert!(!db.owns_child("lead", "old").unwrap());
        assert!(db.sub_sessions_in_run(&run).unwrap().is_empty());
        assert_eq!(db.sub_sessions_in_run("lead").unwrap().len(), 1);
        assert_eq!(db.run_of("old").unwrap().as_deref(), Some("lead"));
        assert_eq!(
            db.sub_session("old").unwrap().unwrap().state,
            crate::sub_sessions::SubState::Starting
        );
        // Reconnects and explicit resumes of the newly recorded conversation keep its own family.
        child(&db, &workspace, "new", "k");
        assert_eq!(
            db.observe_conversation("lead", "pi", "new-pi").unwrap(),
            Observed::Unchanged
        );
        assert!(db.owns_child("lead", "new").unwrap());
        launch(&db, &workspace, "lead");
        assert_eq!(
            db.observe_conversation("lead", "pi", "new-pi").unwrap(),
            Observed::Resumed(run)
        );
        assert!(db.owns_child("lead", "new").unwrap());
        assert!(!db.owns_child("lead", "old").unwrap());
    }

    #[test]
    fn a_launch_begins_a_fresh_run_and_a_child_stays_in_the_run_that_started_it() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        let first = db.run_of("lead").unwrap().unwrap();
        assert_ne!(first, "lead");
        assert!(db.run_exists(&first).unwrap());
        child(&db, &workspace, "c1", "k");
        assert_eq!(db.run_of("c1").unwrap().as_deref(), Some(first.as_str()));
        // The tab's agent exits and another is launched: a new run, and the child is not in it.
        launch(&db, &workspace, "lead");
        let second = db.run_of("lead").unwrap().unwrap();
        assert_ne!(first, second);
        assert_eq!(db.run_of("c1").unwrap().as_deref(), Some(first.as_str()));
        assert!(!db.owns_child("lead", "c1").unwrap());
        assert_eq!(db.sub_sessions_in_run(&second).unwrap().len(), 0);
        assert_eq!(db.sub_sessions_in_run(&first).unwrap().len(), 1);
        // The same words may name a new child in the new run.
        child(&db, &workspace, "c2", "k");
        assert!(db.owns_child("lead", "c2").unwrap());
        // The abandoned launch left no run behind of its own.
        assert_eq!(db.runs_of_session("lead").unwrap().len(), 2);
    }

    #[test]
    fn a_launch_that_replaces_an_empty_run_leaves_nothing_of_it() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        launch(&db, &workspace, "lead");
        launch(&db, &workspace, "lead");
        assert_eq!(db.runs_of_session("lead").unwrap().len(), 1);
    }

    #[test]
    fn the_first_conversation_joins_the_launch_and_a_new_one_begins_a_run() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        let r1 = db.run_of("lead").unwrap().unwrap();
        // A launch-created run may already have children before its first native snapshot.
        child(&db, &workspace, "old", "k");
        assert_eq!(
            db.observe_conversation("lead", "claude", "c-1").unwrap(),
            Observed::Bound
        );
        assert_eq!(db.run_of("lead").unwrap().unwrap(), r1);
        assert!(db.owns_child("lead", "old").unwrap());
        // Seen again (a repaint, a duplicate snapshot, a reconnect): nothing moves.
        for _ in 0..3 {
            assert_eq!(
                db.observe_conversation("lead", "claude", "c-1").unwrap(),
                Observed::Unchanged
            );
        }
        let Observed::Fresh(r2) = db.observe_conversation("lead", "claude", "c-2").unwrap() else {
            panic!("a new conversation is a boundary");
        };
        assert_ne!(r1, r2);
        assert_eq!(db.run_of("lead").unwrap().unwrap(), r2);
        assert!(!db.owns_child("lead", "old").unwrap());
        assert_eq!(db.conversation_ordinal("lead").unwrap(), 2);
        // Coming back to the first conversation restores its run and its child.
        assert_eq!(
            db.observe_conversation("lead", "claude", "c-1").unwrap(),
            Observed::Resumed(r1.clone())
        );
        assert!(db.owns_child("lead", "old").unwrap());
        assert_eq!(db.conversation_ordinal("lead").unwrap(), 1);
    }

    #[test]
    fn resuming_a_known_conversation_after_a_relaunch_restores_its_run() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        db.observe_conversation("lead", "claude", "c-1").unwrap();
        let r1 = db.run_of("lead").unwrap().unwrap();
        child(&db, &workspace, "old", "k");
        // Exit, then a plain launch: a fresh run.
        launch(&db, &workspace, "lead");
        let fresh = db.run_of("lead").unwrap().unwrap();
        assert_ne!(fresh, r1);
        assert!(!db.owns_child("lead", "old").unwrap());
        // The same launch resumed `c-1`.
        assert_eq!(
            db.observe_conversation("lead", "claude", "c-1").unwrap(),
            Observed::Resumed(r1.clone())
        );
        assert!(db.owns_child("lead", "old").unwrap());
        assert!(
            !db.run_exists(&fresh).unwrap(),
            "the empty launch run is dropped"
        );
    }

    #[test]
    fn a_conversation_of_another_session_or_provider_is_not_resumed() {
        let (db, workspace) = db_with(&["lead", "other"]);
        launch(&db, &workspace, "lead");
        launch(&db, &workspace, "other");
        db.observe_conversation("lead", "claude", "c-1").unwrap();
        let before = db.run_of("other").unwrap();
        assert_eq!(
            db.observe_conversation("other", "claude", "c-1").unwrap(),
            Observed::Unchanged
        );
        assert_eq!(db.run_of("other").unwrap(), before);
        // The same id under another provider is another conversation.
        assert_eq!(
            db.observe_conversation("other", "pi", "c-1").unwrap(),
            Observed::Bound
        );
        assert_eq!(
            db.observe_conversation("lead", "claude", "").unwrap(),
            Observed::Unchanged
        );
    }

    #[test]
    fn a_child_that_resets_stays_in_its_run_and_counts_its_conversations() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        let run = db.run_of("lead").unwrap().unwrap();
        child(&db, &workspace, "kid", "k");
        assert_eq!(
            db.observe_conversation("kid", "codex", "t-1").unwrap(),
            Observed::Bound
        );
        assert_eq!(db.conversation_ordinal("kid").unwrap(), 1);
        assert_eq!(
            db.observe_conversation("kid", "codex", "t-2").unwrap(),
            Observed::Bound
        );
        assert_eq!(db.conversation_ordinal("kid").unwrap(), 2);
        assert_eq!(db.run_of("kid").unwrap().as_deref(), Some(run.as_str()));
        assert_eq!(db.parent_of("kid").unwrap().as_deref(), Some("lead"));
        assert!(db.owns_child("lead", "kid").unwrap());
    }

    #[test]
    fn keys_are_unique_within_a_run_only() {
        assert_eq!(scoped_key("lead", "lead", "k"), "k");
        assert_eq!(scoped_key("r2", "lead", "k"), "r2:k");
        assert_ne!(scoped_key("r2", "lead", "k"), scoped_key("r3", "lead", "k"));
    }

    /// A database from before runs: its children join the run their lead's id names, the table is
    /// rebuilt once, a backup is kept beside it, and reopening changes nothing and backs up nothing new.
    #[test]
    fn an_older_database_is_backed_up_and_its_children_keep_their_leads_run() {
        let path = std::env::temp_dir().join(format!("perch-runs-old-{}.sqlite", Uuid::new_v4()));
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE sessions (id TEXT PRIMARY KEY, cwd TEXT NOT NULL,
                    claude_session_id TEXT, opencode_session_id TEXT, created_at INTEGER NOT NULL);
                 INSERT INTO sessions (id, cwd, created_at) VALUES ('lead', '/tmp', 0), ('kid', '/tmp', 0);
                 CREATE TABLE sub_sessions (
                    child_session_id TEXT PRIMARY KEY, parent_session_id TEXT NOT NULL,
                    parent_incarnation TEXT NOT NULL, workspace_id TEXT NOT NULL,
                    provider_id TEXT NOT NULL, model TEXT, spawn_key TEXT NOT NULL, state TEXT NOT NULL,
                    task TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
                    UNIQUE (parent_session_id, spawn_key));
                 INSERT INTO sub_sessions VALUES
                    ('kid', 'lead', 'i', 'w', 'codex', NULL, 'k', 'running', 'task', 1, 1);",
            )
            .unwrap();
        }
        let db = HistoryDb::open(&path).unwrap();
        let kid = db.sub_session("kid").unwrap().unwrap();
        assert_eq!(
            (kid.parent_run_id.as_str(), kid.task.as_str()),
            ("lead", "task")
        );
        assert_eq!(db.run_of("kid").unwrap().as_deref(), Some("lead"));
        assert_eq!(db.run_of("lead").unwrap().as_deref(), Some("lead"));
        assert!(db.owns_child("lead", "kid").unwrap());
        let backup = PathBuf::from(format!("{}.pre-run-identity.bak", path.display()));
        let old = Connection::open(&backup).unwrap();
        let old_rows: i64 = old
            .query_row("SELECT COUNT(*) FROM sub_sessions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(old_rows, 1);
        assert!(
            old.prepare("SELECT parent_run_id FROM sub_sessions")
                .is_err(),
            "the backup is the database as it was"
        );
        drop(db);
        std::fs::remove_file(&backup).unwrap();
        let again = HistoryDb::open(&path).unwrap();
        assert!(again.owns_child("lead", "kid").unwrap());
        assert!(
            !backup.exists(),
            "an already migrated database is not copied again"
        );
        // The first native snapshot after this upgrade has no recorded conversation ownership.
        assert!(matches!(
            again.observe_conversation("lead", "pi", "new-pi").unwrap(),
            Observed::Fresh(_)
        ));
        assert!(!again.owns_child("lead", "kid").unwrap());
        assert_eq!(again.run_of("kid").unwrap().as_deref(), Some("lead"));
        assert_eq!(again.sub_session("kid").unwrap().unwrap().task, "task");
    }

    #[test]
    fn deleting_a_session_forgets_its_runs_and_conversations() {
        let (db, workspace) = db_with(&["lead"]);
        launch(&db, &workspace, "lead");
        db.observe_conversation("lead", "claude", "c-1").unwrap();
        db.delete_session("lead").unwrap();
        assert!(db.runs_of_session("lead").unwrap().is_empty());
        assert_eq!(
            db.conn
                .lock()
                .unwrap()
                .query_row("SELECT COUNT(*) FROM agent_conversations", [], |r| r
                    .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
