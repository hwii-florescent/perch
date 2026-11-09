//! Suggested tasks a lead put in front of a person (`crate::suggestions`). One row per task, grouped
//! into a card by `card_id`. The key of a `perch suggest` names the card, so a retry returns it and
//! adds nothing. The limits and the rows are checked and written in one transaction.
use super::*;
use crate::suggestions::{self, Suggested, SuggestionState};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SuggestionRow {
    pub id: String,
    pub lead_session_id: String,
    pub card_id: String,
    pub position: i64,
    pub task: String,
    pub agent: String,
    pub model: Option<String>,
    pub worktree: bool,
    pub state: SuggestionState,
    /// The sub-session the person started from it.
    pub child_session_id: Option<String>,
    /// Why Start did not start it, shown on the card.
    pub reason: String,
    pub created_at: i64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Added {
    /// A new card; its rows in order.
    New(Vec<SuggestionRow>),
    /// The same key already made this card; nothing was added.
    Existing(Vec<SuggestionRow>),
    Refused(String),
}

const COLUMNS: &str = "id, lead_session_id, card_id, position, task, agent, model, worktree,
    state, child_session_id, reason, created_at";

fn row_from(row: &rusqlite::Row<'_>) -> rusqlite::Result<SuggestionRow> {
    let state: String = row.get(8)?;
    Ok(SuggestionRow {
        id: row.get(0)?,
        lead_session_id: row.get(1)?,
        card_id: row.get(2)?,
        position: row.get(3)?,
        task: row.get(4)?,
        agent: row.get(5)?,
        model: row.get(6)?,
        worktree: row.get::<_, i64>(7)? != 0,
        // A state this build does not know waits for the person, which starts nothing.
        state: SuggestionState::parse(&state).unwrap_or(SuggestionState::Pending),
        child_session_id: row.get(9)?,
        reason: row.get(10)?,
        created_at: row.get(11)?,
    })
}

impl HistoryDb {
    /// Put a card of suggestions in front of the person, or return the card this key made before.
    pub fn add_suggestions(
        &self,
        lead_session_id: &str,
        key: &str,
        items: &[Suggested],
    ) -> anyhow::Result<Added> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        // A card belongs to the run that made it, and its key is unique within that run.
        let run = super::agent_runs::run_of(&tx, lead_session_id)?
            .unwrap_or_else(|| lead_session_id.to_string());
        let key = &super::scoped_key(&run, lead_session_id, key);
        let earlier = {
            let mut stmt = tx.prepare(&format!(
                "SELECT {COLUMNS} FROM suggestions
                 WHERE lead_session_id = ?1 AND card_key = ?2 ORDER BY position"
            ))?;
            let rows = stmt.query_map(params![lead_session_id, key], row_from)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        if !earlier.is_empty() {
            return Ok(Added::Existing(earlier));
        }
        let pending: i64 = tx.query_row(
            "SELECT COUNT(*) FROM suggestions
             WHERE lead_session_id = ?1 AND state IN ('pending', 'starting')
               AND COALESCE(NULLIF(run_id, ''), lead_session_id) = ?2",
            params![lead_session_id, run],
            |row| row.get(0),
        )?;
        let max_pending = self.limits().waiting_cards as usize;
        if let Err(reason) = suggestions::check_batch(items.len(), pending as usize, max_pending) {
            return Ok(Added::Refused(reason));
        }
        let card_id = uuid::Uuid::new_v4().to_string();
        let now = now_millis();
        for (position, item) in items.iter().enumerate() {
            tx.execute(
                "INSERT INTO suggestions
                    (id, lead_session_id, card_id, card_key, position, task, agent, model,
                     worktree, state, reason, created_at, updated_at, run_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', '', ?10, ?10, ?11)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    lead_session_id,
                    card_id,
                    key,
                    position as i64,
                    item.task,
                    item.agent,
                    item.model,
                    item.worktree as i64,
                    now,
                    run
                ],
            )?;
        }
        let rows = {
            let mut stmt = tx.prepare(&format!(
                "SELECT {COLUMNS} FROM suggestions WHERE card_id = ?1 ORDER BY position"
            ))?;
            let rows = stmt.query_map(params![card_id], row_from)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        tx.commit()?;
        Ok(Added::New(rows))
    }

    /// Every suggestion of a lead, oldest card first, in card order.
    pub fn suggestions_of(&self, lead_session_id: &str) -> anyhow::Result<Vec<SuggestionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM suggestions WHERE lead_session_id = ?1
             ORDER BY created_at, card_id, position"
        ))?;
        let rows = stmt.query_map(params![lead_session_id], row_from)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    /// A lead's suggestions in its current run: what an agent is told of, never an earlier
    /// conversation's.
    pub fn suggestions_in_run(&self, lead_session_id: &str) -> anyhow::Result<Vec<SuggestionRow>> {
        let run = self.run_of(lead_session_id)?;
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM suggestions
             WHERE lead_session_id = ?1 AND COALESCE(NULLIF(run_id, ''), lead_session_id) = ?2
             ORDER BY created_at, card_id, position"
        ))?;
        let rows = stmt.query_map(params![lead_session_id, run], row_from)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn suggestion(&self, id: &str) -> anyhow::Result<Option<SuggestionRow>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                &format!("SELECT {COLUMNS} FROM suggestions WHERE id = ?1"),
                params![id],
                row_from,
            )
            .optional()?)
    }

    /// Move a suggestion from one of `from` to `to`, setting its child and reason; `false` when it
    /// was in none of them, so two clicks cannot both take the same step.
    pub fn move_suggestion(
        &self,
        id: &str,
        from: &[SuggestionState],
        to: SuggestionState,
        child_session_id: Option<&str>,
        reason: &str,
    ) -> anyhow::Result<bool> {
        let placeholders = vec!["?"; from.len()].join(",");
        let to = to.as_str();
        let now = now_millis();
        let from: Vec<&str> = from.iter().map(|state| state.as_str()).collect();
        let mut values: Vec<&dyn rusqlite::ToSql> =
            vec![&to, &child_session_id, &reason, &now, &id];
        values.extend(from.iter().map(|s| s as &dyn rusqlite::ToSql));
        Ok(self.conn.lock().unwrap().execute(
            &format!(
                "UPDATE suggestions
                 SET state = ?, child_session_id = COALESCE(?, child_session_id), reason = ?,
                     updated_at = ?
                 WHERE id = ? AND state IN ({placeholders})"
            ),
            values.as_slice(),
        )? > 0)
    }

    /// The person chose Start: take the step `pending` to `starting`, recording the options they
    /// chose in the card (agent, model, worktree). `false` when it was not waiting, so a second
    /// click starts nothing.
    pub fn begin_suggestion(&self, id: &str, chosen: &Suggested) -> anyhow::Result<bool> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE suggestions
             SET state = 'starting', agent = ?2, model = ?3, worktree = ?4, reason = '',
                 updated_at = ?5
             WHERE id = ?1 AND state = 'pending'",
            params![
                id,
                chosen.agent,
                chosen.model,
                chosen.worktree as i64,
                now_millis()
            ],
        )? > 0)
    }

    /// At boot: a Start that was in flight when the core stopped. If the sub-session was recorded
    /// the suggestion is started (the card then shows its real state); if not, nothing was started
    /// and it waits for the person again.
    pub fn settle_unfinished_suggestions(&self) -> anyhow::Result<usize> {
        let conn = self.conn.lock().unwrap();
        let now = now_millis();
        let started = conn.execute(
            "UPDATE suggestions SET state = 'started', updated_at = ?1,
                    child_session_id = (SELECT child_session_id FROM sub_sessions
                        WHERE parent_session_id = suggestions.lead_session_id
                          AND spawn_key = 'suggestion-' || suggestions.id)
             WHERE state = 'starting' AND EXISTS (SELECT 1 FROM sub_sessions
                        WHERE parent_session_id = suggestions.lead_session_id
                          AND spawn_key = 'suggestion-' || suggestions.id)",
            params![now],
        )?;
        let waiting = conn.execute(
            "UPDATE suggestions SET state = 'pending', updated_at = ?1 WHERE state = 'starting'",
            params![now],
        )?;
        Ok(started + waiting)
    }

    pub(super) fn delete_suggestions_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM suggestions WHERE lead_session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(task: &str) -> Suggested {
        Suggested {
            task: task.into(),
            agent: "codex".into(),
            model: None,
            worktree: false,
        }
    }

    fn db() -> HistoryDb {
        HistoryDb::open(
            std::env::temp_dir().join(format!("perch-suggest-{}.sqlite", uuid::Uuid::new_v4())),
        )
        .unwrap()
    }

    #[test]
    fn a_card_is_stored_in_order_and_its_key_returns_it_again() {
        let db = db();
        let Added::New(rows) = db
            .add_suggestions("lead", "k1", &[item("one"), item("two")])
            .unwrap()
        else {
            panic!("a new card");
        };
        assert_eq!(
            rows.iter().map(|row| row.task.as_str()).collect::<Vec<_>>(),
            ["one", "two"]
        );
        assert!(rows.iter().all(|row| row.state == SuggestionState::Pending));
        assert_eq!(rows[0].card_id, rows[1].card_id);
        let Added::Existing(again) = db.add_suggestions("lead", "k1", &[item("other")]).unwrap()
        else {
            panic!("the same key");
        };
        assert_eq!(again, rows);
        assert_eq!(db.suggestions_of("lead").unwrap().len(), 2);
        // Another lead's key is its own.
        assert!(matches!(
            db.add_suggestions("lead2", "k1", &[item("x")]).unwrap(),
            Added::New(_)
        ));
    }

    #[test]
    fn a_lead_cannot_have_more_waiting_than_the_limit_and_an_answer_frees_room() {
        let db = db();
        for card in 0..2 {
            let items: Vec<Suggested> = (0..suggestions::MAX_PER_CARD)
                .map(|n| item(&format!("t{n}")))
                .collect();
            assert!(matches!(
                db.add_suggestions("lead", &format!("k{card}"), &items)
                    .unwrap(),
                Added::New(_)
            ));
        }
        let Added::Refused(reason) = db.add_suggestions("lead", "k9", &[item("more")]).unwrap()
        else {
            panic!("over the limit");
        };
        assert!(reason.contains("still waiting"), "{reason}");
        let first = &db.suggestions_of("lead").unwrap()[0];
        assert!(db
            .move_suggestion(
                &first.id,
                &[SuggestionState::Pending],
                SuggestionState::Dismissed,
                None,
                ""
            )
            .unwrap());
        assert!(matches!(
            db.add_suggestions("lead", "k9", &[item("more")]).unwrap(),
            Added::New(_)
        ));
    }

    #[test]
    fn a_step_is_taken_once_and_a_started_suggestion_remembers_its_child() {
        let db = db();
        let Added::New(rows) = db.add_suggestions("lead", "k", &[item("one")]).unwrap() else {
            panic!("a new card");
        };
        let id = &rows[0].id;
        assert!(db
            .move_suggestion(
                id,
                &[SuggestionState::Pending],
                SuggestionState::Starting,
                None,
                ""
            )
            .unwrap());
        assert!(
            !db.move_suggestion(
                id,
                &[SuggestionState::Pending],
                SuggestionState::Starting,
                None,
                ""
            )
            .unwrap(),
            "a second click finds it already starting"
        );
        assert!(db
            .move_suggestion(
                id,
                &[SuggestionState::Starting],
                SuggestionState::Started,
                Some("child"),
                ""
            )
            .unwrap());
        let kept = db.suggestion(id).unwrap().unwrap();
        assert_eq!(kept.state, SuggestionState::Started);
        assert_eq!(kept.child_session_id.as_deref(), Some("child"));
        // A later move without a child keeps it.
        assert!(db
            .move_suggestion(
                id,
                &[SuggestionState::Started],
                SuggestionState::Dismissed,
                None,
                ""
            )
            .unwrap());
        assert_eq!(
            db.suggestion(id)
                .unwrap()
                .unwrap()
                .child_session_id
                .as_deref(),
            Some("child")
        );
    }

    #[test]
    fn a_start_in_flight_at_boot_is_started_if_its_child_was_recorded_else_it_waits_again() {
        let db = db();
        let Added::New(rows) = db
            .add_suggestions("lead", "k", &[item("one"), item("two")])
            .unwrap()
        else {
            panic!("a new card");
        };
        for row in &rows {
            db.move_suggestion(
                &row.id,
                &[SuggestionState::Pending],
                SuggestionState::Starting,
                None,
                "",
            )
            .unwrap();
        }
        // The first one's child was recorded before the core stopped.
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO sub_sessions
                    (child_session_id, parent_session_id, parent_incarnation, parent_run_id,
                     workspace_id, provider_id, spawn_key, state, task, created_at, updated_at)
                 VALUES ('child', 'lead', 'i', 'lead', 'w', 'codex', ?1, 'start_unknown', 'one', 0, 0)",
                params![suggestions::spawn_key(&rows[0].id)],
            )
            .unwrap();
        }
        assert_eq!(db.settle_unfinished_suggestions().unwrap(), 2);
        let first = db.suggestion(&rows[0].id).unwrap().unwrap();
        assert_eq!(first.state, SuggestionState::Started);
        assert_eq!(first.child_session_id.as_deref(), Some("child"));
        assert_eq!(
            db.suggestion(&rows[1].id).unwrap().unwrap().state,
            SuggestionState::Pending
        );
    }
}
