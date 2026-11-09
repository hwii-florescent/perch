//! Agent incarnations (`crate::agent_identity`): one row per launch of a local agent session,
//! holding the SHA-256 of its token, never the token. A new launch of a session revokes the
//! earlier rows; an exit revokes its own. The latest `perch report` of a run is kept on its
//! row; it is a claim and nothing reads it as a result yet.
use super::*;
use crate::agent_fleet::AgentKey;
use crate::agent_identity::{self, AgentIdentity, IdentityStore, Issued, LauncherIdentity};

impl HistoryDb {
    /// The run a token was issued to, if that run has not ended.
    pub fn authenticate_agent(&self, token: &str) -> anyhow::Result<Option<AgentIdentity>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT workspace_id, session_id, provider_id, incarnation FROM agent_identities
                 WHERE token_hash = ?1 AND revoked_at IS NULL",
                params![agent_identity::hash_token(token)],
                |row| {
                    Ok(AgentIdentity {
                        workspace_id: row.get(0)?,
                        session_id: row.get(1)?,
                        provider_id: row.get(2)?,
                        incarnation: row.get(3)?,
                    })
                },
            )
            .optional()?)
    }

    /// Keep an agent's report on its run. `false` when the run has ended.
    pub fn record_agent_report(&self, incarnation: &str, text: &str) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE agent_identities SET report = ?2, reported_at = ?3,
                    report_conversation = (SELECT conversation_ordinal FROM sessions
                                           WHERE id = agent_identities.session_id)
             WHERE incarnation = ?1 AND revoked_at IS NULL",
            params![incarnation, text, now_millis()],
        )? > 0)
    }

    /// The ordinal of the conversation a session's newest report was left in (0: unknown).
    pub fn latest_report_conversation(&self, session_id: &str) -> anyhow::Result<u32> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT report_conversation FROM agent_identities
                 WHERE session_id = ?1 AND report IS NOT NULL
                 ORDER BY reported_at DESC LIMIT 1",
                params![session_id],
                |row| row.get::<_, Option<u32>>(0),
            )
            .optional()?
            .flatten()
            .unwrap_or(0))
    }

    /// The tab runtime a launcher token was issued to, if it has not ended.
    pub fn authenticate_launcher(&self, token: &str) -> anyhow::Result<Option<LauncherIdentity>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT workspace_id, session_id, owner_provider_id FROM agent_launchers
                 WHERE token_hash = ?1 AND revoked_at IS NULL",
                params![agent_identity::hash_token(token)],
                |row| {
                    Ok(LauncherIdentity {
                        workspace_id: row.get(0)?,
                        session_id: row.get(1)?,
                        owner_provider_id: row.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    /// Give the agent process `pid`, typed into the tab a launcher belongs to, an identity of its
    /// own: its predecessor's is revoked, and it begins a fresh run. One process is issued once, so a
    /// request that repeats its pid (an agent, or a tool it runs) gets nothing. `None` when
    /// `pid` already has an identity.
    pub fn issue_for_launch(
        &self,
        launcher: &LauncherIdentity,
        provider_id: &str,
        pid: u32,
    ) -> anyhow::Result<Option<Issued>> {
        let issued = Issued {
            incarnation: Uuid::new_v4().to_string(),
            token: agent_identity::mint_token(),
        };
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let seen: Option<i64> = tx
            .query_row(
                "SELECT 1 FROM agent_identities WHERE session_id = ?1 AND launch_pid = ?2",
                params![launcher.session_id, pid],
                |row| row.get(0),
            )
            .optional()?;
        if seen.is_some() {
            return Ok(None);
        }
        let now = now_millis();
        tx.execute(
            "UPDATE agent_identities SET revoked_at = ?2
             WHERE session_id = ?1 AND revoked_at IS NULL",
            params![launcher.session_id, now],
        )?;
        tx.execute(
            "INSERT INTO agent_identities
                (incarnation, workspace_id, session_id, provider_id, owner_provider_id,
                 token_hash, created_at, launch_pid)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                issued.incarnation,
                launcher.workspace_id,
                launcher.session_id,
                provider_id,
                launcher.owner_provider_id,
                agent_identity::hash_token(&issued.token),
                now,
                pid
            ],
        )?;
        super::agent_runs::begin_run_locked(&tx, &launcher.session_id)?;
        tx.commit()?;
        Ok(Some(issued))
    }

    /// The live agent process an incarnation was issued to, for retiring it once that process is
    /// confirmed gone.
    pub fn revoke_launch_pid(&self, session_id: &str, pid: u32) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE agent_identities SET revoked_at = ?3
             WHERE session_id = ?1 AND launch_pid = ?2 AND revoked_at IS NULL",
            params![session_id, pid, now_millis()],
        )?;
        Ok(())
    }

    /// Every live incarnation with the runtime key perchd knows its tab by, for the boot check.
    pub fn active_agent_owners(&self) -> anyhow::Result<Vec<(String, AgentKey)>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(
            "SELECT incarnation, workspace_id, session_id,
                    COALESCE(owner_provider_id, provider_id)
             FROM agent_identities WHERE revoked_at IS NULL",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;
        Ok(rows
            .filter_map(Result::ok)
            .filter_map(|(incarnation, workspace, session, provider)| {
                Some((
                    incarnation,
                    AgentKey::new(&workspace, &session, &provider).ok()?,
                ))
            })
            .collect())
    }

    /// Every live launcher with the runtime key perchd knows its tab by, for the boot check.
    pub fn active_launcher_owners(&self) -> anyhow::Result<Vec<(String, AgentKey)>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(
            "SELECT token_hash, workspace_id, session_id, owner_provider_id
             FROM agent_launchers WHERE revoked_at IS NULL",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;
        Ok(rows
            .filter_map(Result::ok)
            .filter_map(|(hash, workspace, session, provider)| {
                Some((hash, AgentKey::new(&workspace, &session, &provider).ok()?))
            })
            .collect())
    }

    pub fn revoke_launcher(&self, token_hash: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE agent_launchers SET revoked_at = ?2 WHERE token_hash = ?1 AND revoked_at IS NULL",
            params![token_hash, now_millis()],
        )?;
        Ok(())
    }

    pub(super) fn delete_agent_launchers_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM agent_launchers WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    /// The report a run last left and when, in milliseconds.
    pub fn agent_report(&self, incarnation: &str) -> anyhow::Result<Option<(String, i64)>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT report, reported_at FROM agent_identities
                 WHERE incarnation = ?1 AND report IS NOT NULL",
                params![incarnation],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?)
    }

    /// The newest report any run of a session left, and when, in milliseconds. A report
    /// outlives its run: a child that reported and exited is still read.
    pub fn latest_session_report(&self, session_id: &str) -> anyhow::Result<Option<(String, i64)>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT report, reported_at FROM agent_identities
                 WHERE session_id = ?1 AND report IS NOT NULL
                 ORDER BY reported_at DESC LIMIT 1",
                params![session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?)
    }

    /// Every run that has not ended, for the boot-time check against what perchd says.
    pub fn active_agent_identities(&self) -> anyhow::Result<Vec<AgentIdentity>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(
            "SELECT workspace_id, session_id, provider_id, incarnation FROM agent_identities
             WHERE revoked_at IS NULL",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(AgentIdentity {
                workspace_id: row.get(0)?,
                session_id: row.get(1)?,
                provider_id: row.get(2)?,
                incarnation: row.get(3)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// End exactly one run, for a check that must not touch a launch that started meanwhile.
    pub fn revoke_agent_incarnation(&self, incarnation: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE agent_identities SET revoked_at = ?2
             WHERE incarnation = ?1 AND revoked_at IS NULL",
            params![incarnation, now_millis()],
        )?;
        Ok(())
    }

    pub(super) fn delete_agent_identities_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM agent_identities WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

impl HistoryDb {
    /// A fixture's re-issue of a session's identity that keeps the run its children were started in:
    /// the launch a test stands for happened before them.
    #[cfg(test)]
    pub(crate) fn issue_in_current_run(&self, key: &AgentKey) -> anyhow::Result<Issued> {
        let run = self.run_of(&key.session_id)?;
        let issued = self.issue(key)?;
        if let Some(run) = run {
            self.conn.lock().unwrap().execute(
                "UPDATE sessions SET run_id = ?2 WHERE id = ?1",
                params![key.session_id, run],
            )?;
        }
        Ok(issued)
    }
}

impl IdentityStore for HistoryDb {
    fn issue(&self, key: &AgentKey) -> anyhow::Result<Issued> {
        let issued = Issued {
            incarnation: Uuid::new_v4().to_string(),
            token: agent_identity::mint_token(),
        };
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let now = now_millis();
        tx.execute(
            "UPDATE agent_identities SET revoked_at = ?2
             WHERE session_id = ?1 AND revoked_at IS NULL",
            params![key.session_id, now],
        )?;
        tx.execute(
            "INSERT INTO agent_identities
                (incarnation, workspace_id, session_id, provider_id, owner_provider_id,
                 token_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6)",
            params![
                issued.incarnation,
                key.workspace_id,
                key.session_id,
                key.agent_id,
                agent_identity::hash_token(&issued.token),
                now
            ],
        )?;
        // A launch is a new agent, so a new run (a resume of a known conversation restores its own).
        super::agent_runs::begin_run_locked(&tx, &key.session_id)?;
        tx.commit()?;
        Ok(issued)
    }

    fn issue_launcher(&self, key: &AgentKey) -> anyhow::Result<String> {
        let token = agent_identity::mint_launcher();
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let now = now_millis();
        tx.execute(
            "UPDATE agent_launchers SET revoked_at = ?2 WHERE session_id = ?1 AND revoked_at IS NULL",
            params![key.session_id, now],
        )?;
        tx.execute(
            "INSERT INTO agent_launchers
                (token_hash, workspace_id, session_id, owner_provider_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                agent_identity::hash_token(&token),
                key.workspace_id,
                key.session_id,
                key.agent_id,
                now
            ],
        )?;
        tx.commit()?;
        Ok(token)
    }

    fn revoke_launch(&self, session_id: &str, pid: u32) -> anyhow::Result<()> {
        self.revoke_launch_pid(session_id, pid)
    }

    fn revoke_session(&self, key: &AgentKey) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = now_millis();
        for table in ["agent_identities", "agent_launchers"] {
            conn.execute(
                &format!(
                    "UPDATE {table} SET revoked_at = ?2 WHERE session_id = ?1 AND revoked_at IS NULL"
                ),
                params![key.session_id, now],
            )?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> HistoryDb {
        HistoryDb::open(
            std::env::temp_dir().join(format!("perch-identity-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap()
    }
    fn key(session: &str) -> AgentKey {
        AgentKey::new("nest", session, "claude").unwrap()
    }

    #[test]
    fn a_token_names_exactly_the_run_it_was_issued_to() {
        let db = db();
        let (a, b) = (db.issue(&key("a")).unwrap(), db.issue(&key("b")).unwrap());
        let who = db.authenticate_agent(&a.token).unwrap().unwrap();
        assert_eq!(
            (who.session_id.as_str(), who.incarnation.as_str()),
            ("a", a.incarnation.as_str())
        );
        assert_eq!(
            db.authenticate_agent(&b.token).unwrap().unwrap().session_id,
            "b"
        );
        assert_eq!(db.authenticate_agent("perch_agent_unknown").unwrap(), None);
        assert_eq!(db.authenticate_agent("").unwrap(), None);
    }

    #[test]
    fn the_database_keeps_only_a_hash() {
        let db = db();
        let issued = db.issue(&key("a")).unwrap();
        let conn = db.conn.lock().unwrap();
        let stored: String = conn
            .query_row("SELECT token_hash FROM agent_identities", [], |r| r.get(0))
            .unwrap();
        assert_ne!(stored, issued.token);
        assert_eq!(stored, agent_identity::hash_token(&issued.token));
    }

    #[test]
    fn a_new_launch_of_a_session_ends_the_old_incarnation() {
        let db = db();
        let old = db.issue(&key("a")).unwrap();
        let other = db.issue(&key("b")).unwrap();
        let new = db.issue(&key("a")).unwrap();
        assert_eq!(
            db.authenticate_agent(&old.token).unwrap(),
            None,
            "stale incarnation"
        );
        assert!(db.authenticate_agent(&new.token).unwrap().is_some());
        assert!(
            db.authenticate_agent(&other.token).unwrap().is_some(),
            "other sessions keep theirs"
        );
        assert!(!db.record_agent_report(&old.incarnation, "late").unwrap());
    }

    #[test]
    fn revoking_ends_a_run_and_a_report_is_kept_for_a_live_one() {
        let db = db();
        let issued = db.issue(&key("a")).unwrap();
        assert!(db.record_agent_report(&issued.incarnation, "done").unwrap());
        assert!(db
            .record_agent_report(&issued.incarnation, "done again")
            .unwrap());
        assert_eq!(
            db.agent_report(&issued.incarnation).unwrap().unwrap().0,
            "done again"
        );
        assert_eq!(db.active_agent_identities().unwrap().len(), 1);
        db.revoke_session(&key("a")).unwrap();
        db.revoke_session(&key("a")).unwrap();
        assert_eq!(db.authenticate_agent(&issued.token).unwrap(), None);
        assert!(db.active_agent_identities().unwrap().is_empty());
        assert!(!db
            .record_agent_report(&issued.incarnation, "after the end")
            .unwrap());
    }

    fn shell(db: &HistoryDb, session: &str) -> (String, LauncherIdentity) {
        let key = AgentKey::new("nest", session, "terminal").unwrap();
        let token = db.issue_launcher(&key).unwrap();
        let launcher = db.authenticate_launcher(&token).unwrap().unwrap();
        (token, launcher)
    }

    #[test]
    fn a_launcher_opens_only_its_own_shell_and_is_never_an_agent_token() {
        let db = db();
        let (token, launcher) = shell(&db, "tab");
        assert!(token.starts_with(agent_identity::LAUNCHER_PREFIX));
        assert!(agent_identity::looks_like_agent_token(&token));
        assert_eq!(launcher.session_id, "tab");
        assert_eq!(launcher.owner_provider_id, "terminal");
        // It is no incarnation, and an incarnation is no launcher.
        assert_eq!(db.authenticate_agent(&token).unwrap(), None);
        let agent = db.issue(&key("tab")).unwrap();
        assert_eq!(db.authenticate_launcher(&agent.token).unwrap(), None);
        // The database keeps a hash only; a newer launcher replaces it; an exit ends it.
        let (newer, _) = shell(&db, "tab");
        assert_eq!(db.authenticate_launcher(&token).unwrap(), None);
        db.revoke_session(&AgentKey::new("nest", "tab", "terminal").unwrap())
            .unwrap();
        assert_eq!(db.authenticate_launcher(&newer).unwrap(), None);
    }

    #[test]
    fn each_agent_typed_into_a_shell_is_issued_once_and_the_last_ones_identity_ends() {
        let db = db();
        let (_, launcher) = shell(&db, "tab");
        let first = db
            .issue_for_launch(&launcher, "claude", 100)
            .unwrap()
            .unwrap();
        let who = db.authenticate_agent(&first.token).unwrap().unwrap();
        assert_eq!(
            (who.session_id.as_str(), who.provider_id.as_str()),
            ("tab", "claude")
        );
        // The same process (an agent, or a tool of it) asking again gets nothing and changes nothing.
        assert!(db
            .issue_for_launch(&launcher, "claude", 100)
            .unwrap()
            .is_none());
        assert!(db.authenticate_agent(&first.token).unwrap().is_some());
        // The next agent has its own identity; the one it replaced has none.
        let second = db.issue_for_launch(&launcher, "pi", 200).unwrap().unwrap();
        assert_eq!(db.authenticate_agent(&first.token).unwrap(), None);
        assert_eq!(
            db.authenticate_agent(&second.token)
                .unwrap()
                .unwrap()
                .provider_id,
            "pi"
        );
        // Confirmed exit retires that process's identity, and a stale pid retires nothing else.
        db.revoke_launch_pid("tab", 100).unwrap();
        assert!(db.authenticate_agent(&second.token).unwrap().is_some());
        db.revoke_launch_pid("tab", 200).unwrap();
        assert_eq!(db.authenticate_agent(&second.token).unwrap(), None);
        // The shell's launcher outlives them both, and boot reconciles by the shell's own runtime.
        assert!(db
            .authenticate_launcher(&shell_token(&db))
            .unwrap()
            .is_some());
        let third = db
            .issue_for_launch(&launcher, "codex", 300)
            .unwrap()
            .unwrap();
        let owners = db.active_agent_owners().unwrap();
        assert_eq!(owners.len(), 1);
        assert_eq!(
            owners[0].1.agent_id, "terminal",
            "not the typed agent's name"
        );
        let _ = third;
    }

    fn shell_token(db: &HistoryDb) -> String {
        shell(db, "other").0
    }

    #[test]
    fn a_launch_begins_a_run_of_its_own_for_the_agent() {
        let db = db();
        let (_, workspace) = db
            .create_project("local", "/tmp/perch-identity-launch", Some("nest"), None)
            .unwrap();
        db.create_session_in_workspace("tab", &workspace, "/tmp/perch-identity-launch")
            .unwrap();
        let key = AgentKey::new(&workspace.id, "tab", "terminal").unwrap();
        let launcher = db
            .authenticate_launcher(&db.issue_launcher(&key).unwrap())
            .unwrap()
            .unwrap();
        db.issue_for_launch(&launcher, "claude", 10)
            .unwrap()
            .unwrap();
        let first = db.run_of("tab").unwrap().unwrap();
        db.issue_for_launch(&launcher, "claude", 11)
            .unwrap()
            .unwrap();
        assert_ne!(db.run_of("tab").unwrap().unwrap(), first);
    }

    #[test]
    fn deleting_a_session_deletes_its_incarnations() {
        let db = db();
        let issued = db.issue(&key("a")).unwrap();
        db.delete_session("a").unwrap();
        assert_eq!(db.authenticate_agent(&issued.token).unwrap(), None);
        assert!(db.agent_report(&issued.incarnation).unwrap().is_none());
    }
}
