//! Agent incarnations (`crate::agent_identity`): one row per launch of a local agent session,
//! holding the SHA-256 of its token, never the token. A new launch of a session revokes the
//! earlier rows; an exit revokes its own. The latest `perch report` of a run is kept on its
//! row; it is a claim and nothing reads it as a result yet.
use super::*;
use crate::agent_fleet::AgentKey;
use crate::agent_identity::{self, AgentIdentity, IdentityStore, Issued};

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
            "UPDATE agent_identities SET report = ?2, reported_at = ?3
             WHERE incarnation = ?1 AND revoked_at IS NULL",
            params![incarnation, text, now_millis()],
        )? > 0)
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
                (incarnation, workspace_id, session_id, provider_id, token_hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                issued.incarnation,
                key.workspace_id,
                key.session_id,
                key.agent_id,
                agent_identity::hash_token(&issued.token),
                now
            ],
        )?;
        tx.commit()?;
        Ok(issued)
    }

    fn revoke_session(&self, key: &AgentKey) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE agent_identities SET revoked_at = ?2
             WHERE session_id = ?1 AND revoked_at IS NULL",
            params![key.session_id, now_millis()],
        )?;
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

    #[test]
    fn deleting_a_session_deletes_its_incarnations() {
        let db = db();
        let issued = db.issue(&key("a")).unwrap();
        db.delete_session("a").unwrap();
        assert_eq!(db.authenticate_agent(&issued.token).unwrap(), None);
        assert!(db.agent_report(&issued.incarnation).unwrap().is_none());
    }
}
