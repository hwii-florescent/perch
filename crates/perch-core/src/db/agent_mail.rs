//! The durable queue behind `perch send` (`crate::agent_mail`): one row per message or note,
//! its receipt, and the count of automatic wakes a lead has spent since a person last spoke to
//! it. Admission (the run, the limits, the key) is checked and the row written in one
//! transaction, and a delivery is claimed by one atomic `queued` to `delivering` update, so a
//! message is attempted at most once however many passes race for it. A row left `delivering`
//! by a core that stopped is `unconfirmed` at boot and never claimed again (Orca's rule that a
//! send that may have reached the agent is never sent again).
use super::*;
use crate::agent_mail::{self, MailKind, MailState, SendContext, SendRefusal};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MailRow {
    pub id: String,
    /// The run's lead: the key of its message count and its wake count.
    pub run_id: String,
    pub kind: MailKind,
    pub sender_session_id: String,
    pub sender_provider: String,
    pub sender_label: String,
    pub target_session_id: String,
    pub target_provider: String,
    /// The receiver's run the message was addressed to; delivery requires it to be live still.
    pub target_incarnation: String,
    pub body: String,
    pub state: MailState,
    /// Why it waits or was not delivered.
    pub reason: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A message to admit.
pub struct NewMail<'a> {
    pub sender_session_id: &'a str,
    pub sender_provider: &'a str,
    pub sender_label: &'a str,
    pub target_session_id: &'a str,
    pub target_provider: &'a str,
    /// Whether the receiver is an agent Perch started (a bridge to deliver through).
    pub target_is_agent: bool,
    pub body: &'a str,
    pub key: &'a str,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Enqueued {
    New(MailRow),
    /// The same sender and key already queued this message. Nothing is queued again.
    Existing(MailRow),
    Refused(SendRefusal),
}

#[derive(Debug, PartialEq, Eq)]
pub enum Cancelled {
    Cancelled,
    /// Already being delivered or settled; it cannot be taken back.
    TooLate(MailState),
    /// Not this sender's message.
    NotFound,
}

const COLUMNS: &str = "id, run_id, kind, sender_session_id, sender_provider, sender_label,
    target_session_id, target_provider, target_incarnation, body, state, reason,
    created_at, updated_at";

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<MailRow> {
    let kind: String = row.get(2)?;
    let state: String = row.get(10)?;
    Ok(MailRow {
        id: row.get(0)?,
        run_id: row.get(1)?,
        kind: MailKind::parse(&kind).unwrap_or(MailKind::Message),
        sender_session_id: row.get(3)?,
        sender_provider: row.get(4)?,
        sender_label: row.get(5)?,
        target_session_id: row.get(6)?,
        target_provider: row.get(7)?,
        target_incarnation: row.get(8)?,
        body: row.get(9)?,
        // A state this build does not know was possibly delivered: never claim it again.
        state: MailState::parse(&state).unwrap_or(MailState::Unconfirmed),
        reason: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

/// The lead of the run `session` is in: its parent if it is a child, else itself. `None` when
/// the session does not exist.
fn run_of(conn: &Connection, session_id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT COALESCE(parent_session_id, id) FROM sessions WHERE id = ?1",
        params![session_id],
        |row| row.get(0),
    )
    .optional()
}

fn live_incarnation_of(conn: &Connection, session_id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT incarnation FROM agent_identities
         WHERE session_id = ?1 AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1",
        params![session_id],
        |row| row.get(0),
    )
    .optional()
}

fn pending_for(conn: &Connection, target: &str) -> rusqlite::Result<usize> {
    conn.query_row(
        "SELECT COUNT(*) FROM agent_mail
         WHERE target_session_id = ?1 AND state IN ('queued', 'delivering')",
        params![target],
        |row| row.get::<_, i64>(0),
    )
    .map(|count| count as usize)
}

impl HistoryDb {
    /// Admit and queue a message: the sender's earlier message under the same key if there is
    /// one, else the run, the limits and the receiver's live identity, then the row, atomically.
    pub fn enqueue_message(&self, new: &NewMail<'_>) -> anyhow::Result<Enqueued> {
        self.admit_mail(new, MailKind::Message, MailState::Queued)
    }

    /// Record a steer an agent sends into a child's running turn. Admitted like a message (same run,
    /// limits, live receiver, key, and it counts toward the run's messages) but never queued: the
    /// row starts `delivering`, claimed as it is sent, and is settled by the receiver's answer.
    pub fn record_steer(&self, new: &NewMail<'_>) -> anyhow::Result<Enqueued> {
        self.admit_mail(new, MailKind::Steer, MailState::Delivering)
    }

    /// Record a message (queued) or a steer (claimed) a person sent from the family strip. The
    /// sender is [`crate::crew_actions::PERSON`], so it does not count toward the run's messages
    /// and spends no wake. `new.sender_session_id` is ignored; `new.target_session_id` must be a
    /// session of a run.
    pub fn record_person_mail(
        &self,
        new: &NewMail<'_>,
        kind: MailKind,
    ) -> anyhow::Result<Enqueued> {
        debug_assert!(matches!(kind, MailKind::Message | MailKind::Steer));
        let state = if kind == MailKind::Steer {
            MailState::Delivering
        } else {
            MailState::Queued
        };
        let person = NewMail {
            sender_session_id: crate::crew_actions::PERSON,
            sender_provider: crate::crew_actions::PERSON,
            sender_label: crate::crew_actions::PERSON,
            ..*new
        };
        self.admit_mail(&person, kind, state)
    }

    fn admit_mail(
        &self,
        new: &NewMail<'_>,
        kind: MailKind,
        state: MailState,
    ) -> anyhow::Result<Enqueued> {
        let from_person = new.sender_session_id == crate::crew_actions::PERSON;
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let existing = tx
            .query_row(
                &format!(
                    "SELECT {COLUMNS} FROM agent_mail
                     WHERE sender_session_id = ?1 AND idem_key = ?2"
                ),
                params![new.sender_session_id, new.key],
                row_from,
            )
            .optional()?;
        if let Some(existing) = existing {
            return Ok(Enqueued::Existing(existing));
        }
        let target_run = run_of(&tx, new.target_session_id)?;
        let sender_run = if from_person {
            target_run.clone()
        } else {
            run_of(&tx, new.sender_session_id)?
        };
        if from_person && target_run.is_none() {
            // A session in no run: there is nobody to write to.
            return Ok(Enqueued::Refused(SendRefusal::OtherRun));
        }
        let run = sender_run
            .clone()
            .ok_or_else(|| anyhow::anyhow!("the sending session no longer exists"))?;
        let incarnation = live_incarnation_of(&tx, new.target_session_id)?;
        // What an agent of the run sent counts, a person's does not.
        let run_messages: i64 = tx.query_row(
            "SELECT COUNT(*) FROM agent_mail
             WHERE run_id = ?1 AND kind IN ('message', 'steer') AND sender_session_id <> ?2",
            params![run, crate::crew_actions::PERSON],
            |row| row.get(0),
        )?;
        let context = SendContext {
            to_self: new.sender_session_id == new.target_session_id,
            same_run: target_run.is_some() && target_run == sender_run,
            target_live: incarnation.is_some(),
            target_is_agent: new.target_is_agent,
            // The run's limit is on what its agents send.
            run_messages: if from_person {
                0
            } else {
                run_messages as usize
            },
            target_pending: pending_for(&tx, new.target_session_id)?,
        };
        if let Err(refusal) = agent_mail::admit_send(&context) {
            return Ok(Enqueued::Refused(refusal));
        }
        let id = Uuid::new_v4().to_string();
        let now = now_millis();
        tx.execute(
            "INSERT INTO agent_mail
                (id, run_id, kind, sender_session_id, sender_provider, sender_label,
                 target_session_id, target_provider, target_incarnation, body, idem_key,
                 state, reason, created_at, updated_at)
             VALUES (?1, ?2, ?12, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?13, '', ?11, ?11)",
            params![
                id,
                run,
                new.sender_session_id,
                new.sender_provider,
                new.sender_label,
                new.target_session_id,
                new.target_provider,
                incarnation,
                new.body,
                new.key,
                now,
                kind.as_str(),
                state.as_str()
            ],
        )?;
        let row = tx.query_row(
            &format!("SELECT {COLUMNS} FROM agent_mail WHERE id = ?1"),
            params![id],
            row_from,
        )?;
        tx.commit()?;
        Ok(Enqueued::New(row))
    }

    /// A claimed steer that certainly never reached its receiver (nothing was handed over): it
    /// is `undelivered`, with the reason. Not for anything that may have been written.
    pub fn void_claimed_mail(&self, id: &str, reason: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE agent_mail SET state = 'undelivered', reason = ?2, updated_at = ?3
             WHERE id = ?1 AND state = 'delivering'",
            params![id, reason, now_millis()],
        )?;
        Ok(())
    }

    /// What a person sent a session from the family strip, newest first.
    pub fn person_mail_to(&self, session_id: &str, limit: usize) -> anyhow::Result<Vec<MailRow>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM agent_mail
             WHERE target_session_id = ?1 AND sender_session_id = ?2
             ORDER BY created_at DESC, rowid DESC LIMIT ?3"
        ))?;
        let rows = statement.query_map(
            params![session_id, crate::crew_actions::PERSON, limit as i64],
            row_from,
        )?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Interrupts the lead sent this child since a person last wrote to the lead.
    pub fn lead_interrupts(&self, child_session_id: &str) -> anyhow::Result<u32> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT interrupts FROM agent_interrupts WHERE child_session_id = ?1",
                params![child_session_id],
                |row| row.get::<_, u32>(0),
            )
            .optional()?
            .unwrap_or(0))
    }

    /// Count one interrupt a lead is about to send a child.
    pub fn spend_lead_interrupt(
        &self,
        lead_session_id: &str,
        child_session_id: &str,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO agent_interrupts (child_session_id, lead_session_id, interrupts)
             VALUES (?1, ?2, 1)
             ON CONFLICT(child_session_id) DO UPDATE SET interrupts = interrupts + 1",
            params![child_session_id, lead_session_id],
        )?;
        Ok(())
    }

    /// Queue Perch's own status note from `child` to `lead`. A note of the same child still
    /// waiting is replaced, so a lead is told a child's latest state once, not each step.
    /// `None` when the lead has no live identity to address.
    pub fn enqueue_note(
        &self,
        child: (&str, &str, &str),
        lead: (&str, &str),
        body: &str,
    ) -> anyhow::Result<Option<MailRow>> {
        let (child_id, child_provider, child_label) = child;
        let (lead_id, lead_provider) = lead;
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let Some(incarnation) = live_incarnation_of(&tx, lead_id)? else {
            return Ok(None);
        };
        let now = now_millis();
        let replaced = tx.execute(
            "UPDATE agent_mail SET body = ?1, sender_label = ?2, target_incarnation = ?3,
                    reason = '', created_at = ?4, updated_at = ?4
             WHERE kind = 'note' AND state = 'queued'
               AND sender_session_id = ?5 AND target_session_id = ?6",
            params![body, child_label, incarnation, now, child_id, lead_id],
        )?;
        let id: String = if replaced > 0 {
            tx.query_row(
                "SELECT id FROM agent_mail WHERE kind = 'note' AND state = 'queued'
                 AND sender_session_id = ?1 AND target_session_id = ?2",
                params![child_id, lead_id],
                |row| row.get(0),
            )?
        } else {
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO agent_mail
                    (id, run_id, kind, sender_session_id, sender_provider, sender_label,
                     target_session_id, target_provider, target_incarnation, body, idem_key,
                     state, reason, created_at, updated_at)
                 VALUES (?1, ?2, 'note', ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, 'queued', '', ?10, ?10)",
                params![
                    id,
                    lead_id,
                    child_id,
                    child_provider,
                    child_label,
                    lead_id,
                    lead_provider,
                    incarnation,
                    body,
                    now
                ],
            )?;
            id
        };
        let row = tx.query_row(
            &format!("SELECT {COLUMNS} FROM agent_mail WHERE id = ?1"),
            params![id],
            row_from,
        )?;
        tx.commit()?;
        Ok(Some(row))
    }

    pub fn mail(&self, id: &str) -> anyhow::Result<Option<MailRow>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                &format!("SELECT {COLUMNS} FROM agent_mail WHERE id = ?1"),
                params![id],
                row_from,
            )
            .optional()?)
    }

    /// Mail addressed to a session, newest first. Reading it consumes nothing.
    pub fn mail_to(&self, session_id: &str, limit: usize) -> anyhow::Result<Vec<MailRow>> {
        self.mail_where("target_session_id", session_id, limit)
    }

    /// Mail a session sent, newest first, with its receipts.
    pub fn mail_from(&self, session_id: &str, limit: usize) -> anyhow::Result<Vec<MailRow>> {
        self.mail_where("sender_session_id", session_id, limit)
    }

    fn mail_where(
        &self,
        column: &str,
        session_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<MailRow>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM agent_mail WHERE {column} = ?1
             ORDER BY created_at DESC, rowid DESC LIMIT ?2"
        ))?;
        let rows = statement.query_map(params![session_id, limit as i64], row_from)?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Receivers with something waiting, for a delivery pass.
    pub fn queued_mail_targets(&self) -> anyhow::Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn
            .prepare("SELECT DISTINCT target_session_id FROM agent_mail WHERE state = 'queued'")?;
        let rows = statement.query_map([], |row| row.get(0))?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// What waits for a receiver, oldest first.
    pub fn queued_mail_for(&self, target_session_id: &str) -> anyhow::Result<Vec<MailRow>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM agent_mail WHERE target_session_id = ?1 AND state = 'queued'
             ORDER BY created_at, rowid"
        ))?;
        let rows = statement.query_map(params![target_session_id], row_from)?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// Claim these for one delivery attempt: all of them move `queued` to `delivering` or none
    /// does, so two passes cannot both deliver the same message.
    pub fn claim_mail(&self, ids: &[String]) -> anyhow::Result<bool> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let now = now_millis();
        for id in ids {
            let moved = tx.execute(
                "UPDATE agent_mail SET state = 'delivering', reason = '', updated_at = ?2
                 WHERE id = ?1 AND state = 'queued'",
                params![id, now],
            )?;
            if moved == 0 {
                return Ok(false);
            }
        }
        tx.commit()?;
        Ok(true)
    }

    /// Give claimed mail back to the queue, only for a failure that happened before any byte
    /// or bridge call, so it is certain nothing reached the receiver.
    pub fn unclaim_mail(&self, ids: &[String], reason: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute(
                "UPDATE agent_mail SET state = 'queued', reason = ?2, updated_at = ?3
                 WHERE id = ?1 AND state = 'delivering'",
                params![id, reason, now_millis()],
            )?;
        }
        Ok(())
    }

    /// Settle claimed mail as `delivered` or `unconfirmed`, only from `delivering`.
    pub fn settle_mail(
        &self,
        ids: &[String],
        state: MailState,
        reason: &str,
    ) -> anyhow::Result<()> {
        debug_assert!(matches!(
            state,
            MailState::Delivered | MailState::Unconfirmed
        ));
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute(
                "UPDATE agent_mail SET state = ?2, reason = ?3, updated_at = ?4
                 WHERE id = ?1 AND state = 'delivering'",
                params![id, state.as_str(), reason, now_millis()],
            )?;
        }
        Ok(())
    }

    /// Say why queued mail is still waiting, touching a row only when the reason changed.
    pub fn set_mail_wait(&self, ids: &[String], reason: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute(
                "UPDATE agent_mail SET reason = ?2, updated_at = ?3
                 WHERE id = ?1 AND state = 'queued' AND reason <> ?2",
                params![id, reason, now_millis()],
            )?;
        }
        Ok(())
    }

    /// Give up on queued mail with a reason. `false` when it was no longer queued.
    pub fn undeliver_mail(&self, id: &str, reason: &str) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE agent_mail SET state = 'undelivered', reason = ?2, updated_at = ?3
             WHERE id = ?1 AND state = 'queued'",
            params![id, reason, now_millis()],
        )? > 0)
    }

    /// The sender takes back a message still waiting.
    pub fn cancel_mail(&self, sender_session_id: &str, id: &str) -> anyhow::Result<Cancelled> {
        let Some(row) = self.mail(id)?.filter(|row| {
            row.sender_session_id == sender_session_id && row.kind == MailKind::Message
        }) else {
            return Ok(Cancelled::NotFound);
        };
        if self.undeliver_mail(id, "cancelled by its sender")? {
            return Ok(Cancelled::Cancelled);
        }
        let now = self.mail(id)?.map_or(row.state, |row| row.state);
        Ok(Cancelled::TooLate(now))
    }

    /// At boot: mail claimed when the core stopped may or may not have reached its receiver.
    pub fn mark_delivering_mail_unconfirmed(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE agent_mail SET state = 'unconfirmed', updated_at = ?1,
                    reason = 'Perch stopped while delivering it; it may have arrived'
             WHERE state = 'delivering'",
            params![now_millis()],
        )?)
    }

    /// Remove a session row alone, as a race with a delete would leave it.
    #[cfg(test)]
    pub(crate) fn remove_session_row_only(&self, session_id: &str) {
        self.conn
            .lock()
            .unwrap()
            .execute("DELETE FROM sessions WHERE id = ?1", params![session_id])
            .unwrap();
    }

    /// The run a session is in: its lead's id. `None` when the session does not exist.
    pub fn run_of(&self, session_id: &str) -> anyhow::Result<Option<String>> {
        Ok(run_of(&self.conn.lock().unwrap(), session_id)?)
    }

    /// The incarnation of a session that has not ended, if any.
    pub fn live_incarnation(&self, session_id: &str) -> anyhow::Result<Option<String>> {
        Ok(live_incarnation_of(&self.conn.lock().unwrap(), session_id)?)
    }

    pub fn mail_wakes(&self, lead_session_id: &str) -> anyhow::Result<u32> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT wakes FROM agent_mail_wakes WHERE lead_session_id = ?1",
                params![lead_session_id],
                |row| row.get::<_, u32>(0),
            )
            .optional()?
            .unwrap_or(0))
    }

    pub fn spend_mail_wake(&self, lead_session_id: &str) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO agent_mail_wakes (lead_session_id, wakes) VALUES (?1, 1)
             ON CONFLICT(lead_session_id) DO UPDATE SET wakes = wakes + 1",
            params![lead_session_id],
        )?;
        Ok(())
    }

    /// A person opened a turn on the lead: its automatic wakes start again.
    pub fn reset_mail_wakes(&self, lead_session_id: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM agent_mail_wakes WHERE lead_session_id = ?1",
            params![lead_session_id],
        )?;
        // The lead's interrupt allowance starts again with it.
        conn.execute(
            "DELETE FROM agent_interrupts WHERE lead_session_id = ?1",
            params![lead_session_id],
        )?;
        Ok(())
    }

    /// A deleted lead takes its run's mail with it; mail still waiting for a deleted receiver
    /// can no longer arrive.
    pub(super) fn delete_agent_mail_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM agent_mail WHERE run_id = ?1",
            params![session_id],
        )?;
        conn.execute(
            "UPDATE agent_mail SET state = 'undelivered', reason = 'the receiver was deleted',
                    updated_at = ?2
             WHERE target_session_id = ?1 AND state = 'queued'",
            params![session_id, now_millis()],
        )?;
        conn.execute(
            "DELETE FROM agent_mail_wakes WHERE lead_session_id = ?1",
            params![session_id],
        )?;
        conn.execute(
            "DELETE FROM agent_interrupts WHERE lead_session_id = ?1",
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
    use crate::sub_sessions::TurnOrigin;

    struct Run {
        db: HistoryDb,
        workspace: WorkspaceRow,
    }

    /// A lead, a child and a sibling, each with a live identity.
    fn run() -> Run {
        let db = HistoryDb::open(
            std::env::temp_dir().join(format!("perch-agent-mail-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/perch-agent-mail-nest", Some("nest"), None)
            .unwrap();
        db.create_session_in_workspace("lead", &workspace, "/tmp/perch-agent-mail-nest")
            .unwrap();
        db.set_cli_provider("lead", "claude").unwrap();
        db.issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        for child in ["a", "b"] {
            let reserved = db
                .reserve_sub_session(
                    &crate::db::SubSessionSpec {
                        child_session_id: child,
                        parent_session_id: "lead",
                        parent_incarnation: "run-1",
                        workspace: &workspace,
                        cwd: "/tmp/perch-agent-mail-nest",
                        provider_id: "codex",
                        model: None,
                        spawn_key: child,
                        task: "t",
                    },
                    Some(TurnOrigin::Person),
                )
                .unwrap();
            assert!(matches!(reserved, Reserved::New(_)));
            db.set_cli_provider(child, "codex").unwrap();
            db.issue(&AgentKey::new(&workspace.id, child, "codex").unwrap())
                .unwrap();
        }
        Run { db, workspace }
    }

    fn send<'a>(from: &'a str, to: &'a str, body: &'a str, key: &'a str) -> NewMail<'a> {
        NewMail {
            sender_session_id: from,
            sender_provider: "codex",
            sender_label: "label",
            target_session_id: to,
            target_provider: "codex",
            target_is_agent: true,
            body,
            key,
        }
    }

    fn queued(db: &HistoryDb, new: &NewMail<'_>) -> MailRow {
        match db.enqueue_message(new).unwrap() {
            Enqueued::New(row) => row,
            other => panic!("expected a new message, got {other:?}"),
        }
    }

    #[test]
    fn a_message_inside_the_run_is_queued_for_the_incarnation_it_was_addressed_to() {
        let Run { db, .. } = run();
        let row = queued(&db, &send("a", "lead", "done", "k1"));
        assert_eq!(
            (row.run_id.as_str(), row.state),
            ("lead", MailState::Queued)
        );
        assert_eq!(
            row.target_incarnation,
            db.live_incarnation("lead").unwrap().unwrap()
        );
        // Siblings may write to each other; so may the lead to a child.
        queued(&db, &send("a", "b", "hi", "k2"));
        queued(&db, &send("lead", "a", "go", "k3"));
        assert_eq!(db.mail_to("lead", 10).unwrap().len(), 1);
        assert_eq!(db.mail_from("a", 10).unwrap().len(), 2);
    }

    // Orca: a message is admitted once; the same send made again returns the first.
    #[test]
    fn the_same_key_returns_the_first_message_and_queues_nothing() {
        let Run { db, .. } = run();
        let first = queued(&db, &send("a", "lead", "one", "k"));
        let again = db.enqueue_message(&send("a", "lead", "two", "k")).unwrap();
        assert_eq!(again, Enqueued::Existing(first.clone()));
        assert_eq!(db.mail_to("lead", 10).unwrap().len(), 1);
        // The key belongs to its sender.
        queued(&db, &send("b", "lead", "other", "k"));
    }

    #[test]
    fn a_refusal_queues_nothing() {
        let Run { db, workspace } = run();
        for (new, expect) in [
            (send("a", "a", "x", "k1"), SendRefusal::ToSelf),
            (send("a", "ghost", "x", "k2"), SendRefusal::OtherRun),
            (
                NewMail {
                    target_is_agent: false,
                    ..send("a", "lead", "x", "k3")
                },
                SendRefusal::CannotReceive,
            ),
        ] {
            assert_eq!(db.enqueue_message(&new).unwrap(), Enqueued::Refused(expect));
        }
        // A session of another run (its own lead, no parent) cannot be written to.
        db.create_session_in_workspace("other-lead", &workspace, "/tmp/perch-agent-mail-nest")
            .unwrap();
        db.set_cli_provider("other-lead", "claude").unwrap();
        db.issue(&AgentKey::new(&workspace.id, "other-lead", "claude").unwrap())
            .unwrap();
        assert_eq!(
            db.enqueue_message(&send("a", "other-lead", "x", "k4"))
                .unwrap(),
            Enqueued::Refused(SendRefusal::OtherRun)
        );
        assert!(db.mail_to("lead", 10).unwrap().is_empty());
    }

    #[test]
    fn a_receiver_with_no_live_identity_cannot_be_written_to() {
        let Run { db, .. } = run();
        let incarnation = db.live_incarnation("a").unwrap().unwrap();
        db.revoke_agent_incarnation(&incarnation).unwrap();
        assert_eq!(
            db.enqueue_message(&send("lead", "a", "x", "k")).unwrap(),
            Enqueued::Refused(SendRefusal::NotRunning)
        );
    }

    #[test]
    fn fifty_messages_per_run_and_thirty_two_waiting_per_receiver() {
        let Run { db, .. } = run();
        for n in 0..agent_mail::MAX_PENDING_PER_TARGET {
            queued(&db, &send("a", "lead", "x", &format!("k{n}")));
        }
        assert_eq!(
            db.enqueue_message(&send("a", "lead", "x", "over")).unwrap(),
            Enqueued::Refused(SendRefusal::QueueFull)
        );
        // Settled mail frees the receiver's queue but still counts for the run.
        for row in db.queued_mail_for("lead").unwrap() {
            assert!(db.undeliver_mail(&row.id, "test").unwrap());
        }
        for n in agent_mail::MAX_PENDING_PER_TARGET..agent_mail::MAX_MESSAGES_PER_RUN {
            queued(&db, &send("b", "lead", "x", &format!("k{n}")));
            for row in db.queued_mail_for("lead").unwrap() {
                db.undeliver_mail(&row.id, "test").unwrap();
            }
        }
        assert_eq!(
            db.enqueue_message(&send("b", "lead", "x", "past-fifty"))
                .unwrap(),
            Enqueued::Refused(SendRefusal::RunLimit)
        );
    }

    #[test]
    fn notes_do_not_count_toward_the_run_limit_and_a_childs_newer_note_replaces_its_queued_one() {
        let Run { db, .. } = run();
        let first = db
            .enqueue_note(("a", "codex", "A"), ("lead", "claude"), "first")
            .unwrap()
            .unwrap();
        let second = db
            .enqueue_note(("a", "codex", "A"), ("lead", "claude"), "second")
            .unwrap()
            .unwrap();
        assert_eq!(first.id, second.id, "replaced, not added");
        assert_eq!(db.queued_mail_for("lead").unwrap().len(), 1);
        assert_eq!(db.queued_mail_for("lead").unwrap()[0].body, "second");
        db.enqueue_note(("b", "codex", "B"), ("lead", "claude"), "other")
            .unwrap()
            .unwrap();
        assert_eq!(db.queued_mail_for("lead").unwrap().len(), 2);
        // Once claimed, a newer note is a new row: the delivered one is not rewritten.
        assert!(db.claim_mail(std::slice::from_ref(&second.id)).unwrap());
        let third = db
            .enqueue_note(("a", "codex", "A"), ("lead", "claude"), "third")
            .unwrap()
            .unwrap();
        assert_ne!(third.id, second.id);
        // Notes are not messages for the 50 count.
        for n in 0..agent_mail::MAX_MESSAGES_PER_RUN {
            let row = queued(&db, &send("a", "b", "x", &format!("k{n}")));
            db.undeliver_mail(&row.id, "test").unwrap();
        }
    }

    // Orca: never sends a message twice when it already waits; only the pass whose claim lands sends.
    #[test]
    fn only_one_claim_lands_and_a_claimed_message_is_not_offered_again() {
        let Run { db, .. } = run();
        let row = queued(&db, &send("a", "lead", "x", "k"));
        let ids = vec![row.id.clone()];
        assert!(db.claim_mail(&ids).unwrap());
        assert!(
            !db.claim_mail(&ids).unwrap(),
            "a second pass cannot also deliver it"
        );
        assert!(db.queued_mail_for("lead").unwrap().is_empty());
        assert!(db.queued_mail_targets().unwrap().is_empty());
        // A claim of several is all or nothing.
        let one = queued(&db, &send("a", "lead", "y", "k2"));
        let two = queued(&db, &send("a", "lead", "z", "k3"));
        assert!(db.claim_mail(std::slice::from_ref(&two.id)).unwrap());
        assert!(!db.claim_mail(&[one.id.clone(), two.id.clone()]).unwrap());
        assert_eq!(
            db.mail(&one.id).unwrap().unwrap().state,
            MailState::Queued,
            "rolled back"
        );
    }

    // Orca: a send that may have reached the agent is never sent again.
    #[test]
    fn mail_claimed_when_the_core_stopped_is_unconfirmed_and_never_claimed_again() {
        let Run { db, .. } = run();
        let row = queued(&db, &send("a", "lead", "x", "k"));
        assert!(db.claim_mail(std::slice::from_ref(&row.id)).unwrap());
        assert_eq!(db.mark_delivering_mail_unconfirmed().unwrap(), 1);
        let after = db.mail(&row.id).unwrap().unwrap();
        assert_eq!(after.state, MailState::Unconfirmed);
        assert!(after.reason.contains("may have arrived"));
        assert!(!db.claim_mail(std::slice::from_ref(&row.id)).unwrap());
        // Queued mail is untouched by the same boot step.
        let waiting = queued(&db, &send("a", "lead", "y", "k2"));
        assert_eq!(db.mark_delivering_mail_unconfirmed().unwrap(), 0);
        assert_eq!(
            db.mail(&waiting.id).unwrap().unwrap().state,
            MailState::Queued
        );
    }

    #[test]
    fn a_claim_settles_only_from_delivering_and_a_wait_reason_changes_only_when_it_differs() {
        let Run { db, .. } = run();
        let row = queued(&db, &send("a", "lead", "x", "k"));
        let ids = vec![row.id.clone()];
        db.settle_mail(&ids, MailState::Delivered, "").unwrap();
        assert_eq!(
            db.mail(&row.id).unwrap().unwrap().state,
            MailState::Queued,
            "not claimed: not settled"
        );
        db.set_mail_wait(&ids, "the receiver is working").unwrap();
        let waiting = db.mail(&row.id).unwrap().unwrap();
        assert_eq!(waiting.reason, "the receiver is working");
        db.set_mail_wait(&ids, "the receiver is working").unwrap();
        assert_eq!(
            db.mail(&row.id).unwrap().unwrap().updated_at,
            waiting.updated_at
        );
        assert!(db.claim_mail(&ids).unwrap());
        db.settle_mail(&ids, MailState::Delivered, "").unwrap();
        let done = db.mail(&row.id).unwrap().unwrap();
        assert_eq!(
            (done.state, done.reason.as_str()),
            (MailState::Delivered, "")
        );
        assert!(
            !db.undeliver_mail(&row.id, "late").unwrap(),
            "settled mail stays settled"
        );
    }

    #[test]
    fn a_sender_cancels_its_own_queued_message_and_nothing_else() {
        let Run { db, .. } = run();
        let row = queued(&db, &send("a", "lead", "x", "k"));
        assert_eq!(db.cancel_mail("b", &row.id).unwrap(), Cancelled::NotFound);
        assert_eq!(db.cancel_mail("a", "nope").unwrap(), Cancelled::NotFound);
        assert_eq!(db.cancel_mail("a", &row.id).unwrap(), Cancelled::Cancelled);
        let after = db.mail(&row.id).unwrap().unwrap();
        assert_eq!(
            (after.state, after.reason.as_str()),
            (MailState::Undelivered, "cancelled by its sender")
        );
        let claimed = queued(&db, &send("a", "lead", "y", "k2"));
        assert!(db.claim_mail(std::slice::from_ref(&claimed.id)).unwrap());
        assert_eq!(
            db.cancel_mail("a", &claimed.id).unwrap(),
            Cancelled::TooLate(MailState::Delivering)
        );
        // A status note is Perch's, not an agent's to cancel.
        let note = db
            .enqueue_note(("a", "codex", "A"), ("lead", "claude"), "n")
            .unwrap()
            .unwrap();
        assert_eq!(db.cancel_mail("a", &note.id).unwrap(), Cancelled::NotFound);
    }

    #[test]
    fn wakes_count_per_lead_and_a_person_resets_them() {
        let Run { db, .. } = run();
        assert_eq!(db.mail_wakes("lead").unwrap(), 0);
        for _ in 0..3 {
            db.spend_mail_wake("lead").unwrap();
        }
        assert_eq!(db.mail_wakes("lead").unwrap(), 3);
        assert_eq!(db.mail_wakes("a").unwrap(), 0);
        db.reset_mail_wakes("lead").unwrap();
        assert_eq!(db.mail_wakes("lead").unwrap(), 0);
    }

    #[test]
    fn deleting_the_lead_deletes_the_runs_mail_and_deleting_a_receiver_undelivers_what_waits() {
        let Run { db, .. } = run();
        let to_child = queued(&db, &send("lead", "a", "x", "k1"));
        let to_sibling = queued(&db, &send("a", "b", "y", "k2"));
        db.delete_session("a").unwrap();
        let after = db.mail(&to_child.id).unwrap().unwrap();
        assert_eq!(after.state, MailState::Undelivered);
        assert!(after.reason.contains("deleted"));
        assert_eq!(
            db.mail(&to_sibling.id).unwrap().unwrap().state,
            MailState::Queued,
            "its receiver lives"
        );
        db.delete_session("lead").unwrap();
        assert!(db.mail(&to_child.id).unwrap().is_none());
        assert!(db.mail(&to_sibling.id).unwrap().is_none());
        assert_eq!(db.mail_wakes("lead").unwrap(), 0);
    }

    fn from_the_person(
        to: &'static str,
        body: &'static str,
        key: &'static str,
    ) -> NewMail<'static> {
        send("ignored", to, body, key)
    }

    #[test]
    fn a_steer_counts_toward_the_runs_limit_and_a_persons_message_does_not() {
        let Run { db, .. } = run();
        for n in 0..49 {
            let to = if n % 2 == 0 { "a" } else { "b" };
            queued(&db, &send("lead", to, "m", &format!("k{n}")));
        }
        // The 50th message of the run is a steer: claimed as it is sent, never queued.
        let Enqueued::New(steer) = db.record_steer(&send("lead", "a", "use b", "s1")).unwrap()
        else {
            panic!("the steer should be recorded");
        };
        assert_eq!(
            (steer.kind, steer.state),
            (MailKind::Steer, MailState::Delivering)
        );
        assert_eq!(
            db.enqueue_message(&send("lead", "b", "one too many", "k50"))
                .unwrap(),
            Enqueued::Refused(SendRefusal::RunLimit)
        );
        // What the person wrote is the person's: it still goes in, as the person, with no sender run.
        let Enqueued::New(person) = db
            .record_person_mail(
                &from_the_person("b", "please also add tests", "p1"),
                MailKind::Message,
            )
            .unwrap()
        else {
            panic!("a person's message should be queued");
        };
        assert_eq!(
            (
                person.sender_session_id.as_str(),
                person.run_id.as_str(),
                person.state
            ),
            ("person", "lead", MailState::Queued)
        );
        // The same request again returns the first and queues nothing.
        assert!(matches!(
            db.record_person_mail(&from_the_person("b", "changed", "p1"), MailKind::Message)
                .unwrap(),
            Enqueued::Existing(row) if row.id == person.id
        ));
        assert_eq!(db.person_mail_to("b", 10).unwrap().len(), 1);
        assert!(
            db.person_mail_to("a", 10).unwrap().is_empty(),
            "only the person's"
        );
    }

    #[test]
    fn a_person_steer_is_claimed_as_it_is_sent_and_a_steer_that_never_left_is_voided() {
        let Run { db, .. } = run();
        let Enqueued::New(steer) = db
            .record_person_mail(&from_the_person("a", "use b", "s1"), MailKind::Steer)
            .unwrap()
        else {
            panic!("recorded");
        };
        assert_eq!(
            (steer.kind, steer.state),
            (MailKind::Steer, MailState::Delivering)
        );
        assert!(
            db.queued_mail_for("a").unwrap().is_empty(),
            "a steer is never queued"
        );
        db.void_claimed_mail(&steer.id, "it could not be reached")
            .unwrap();
        let after = db.mail(&steer.id).unwrap().unwrap();
        assert_eq!(after.state, MailState::Undelivered);
        assert_eq!(after.reason, "it could not be reached");
        // A settled row is not voided again.
        db.void_claimed_mail(&steer.id, "other").unwrap();
        assert_eq!(
            db.mail(&steer.id).unwrap().unwrap().reason,
            "it could not be reached"
        );
        // A person cannot message a session in no run: nothing is queued for a stranger.
        assert!(matches!(
            db.record_person_mail(&from_the_person("nobody", "hi", "p9"), MailKind::Message)
                .unwrap(),
            Enqueued::Refused(_)
        ));
    }

    #[test]
    fn a_leads_interrupts_are_counted_per_child_and_start_again_when_a_person_writes_to_the_lead() {
        let Run { db, .. } = run();
        assert_eq!(db.lead_interrupts("a").unwrap(), 0);
        db.spend_lead_interrupt("lead", "a").unwrap();
        db.spend_lead_interrupt("lead", "a").unwrap();
        db.spend_lead_interrupt("lead", "b").unwrap();
        assert_eq!(
            (
                db.lead_interrupts("a").unwrap(),
                db.lead_interrupts("b").unwrap()
            ),
            (2, 1)
        );
        // A person opening a turn on the lead resets the wakes, and the allowance with them.
        db.reset_mail_wakes("lead").unwrap();
        assert_eq!(
            (
                db.lead_interrupts("a").unwrap(),
                db.lead_interrupts("b").unwrap()
            ),
            (0, 0)
        );
        db.spend_lead_interrupt("lead", "a").unwrap();
        db.delete_session("lead").unwrap();
        assert_eq!(db.lead_interrupts("a").unwrap(), 0);
    }

    #[test]
    fn mail_lists_are_newest_first_and_bounded() {
        let Run { db, .. } = run();
        for n in 0..5 {
            queued(&db, &send("a", "lead", &format!("m{n}"), &format!("k{n}")));
        }
        let rows = db.mail_to("lead", 3).unwrap();
        assert_eq!(
            rows.iter().map(|r| r.body.as_str()).collect::<Vec<_>>(),
            ["m4", "m3", "m2"]
        );
    }
}
