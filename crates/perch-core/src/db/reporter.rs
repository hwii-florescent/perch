//! What the cheap-model reporter (`crate::reporter`) keeps: one running summary per session, the
//! notes the next turn's summary starts from, and a row per model call for the spend estimate.
use super::*;

/// A session's running notes: what its last finished turn amounted to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredSummary {
    pub text: String,
    /// `done`, `blocked`, `needs_you` or `failed` for a model's summary; empty for the two
    /// fallbacks.
    pub status: String,
    /// `summary` (a model wrote it), `report` (the child's own `perch report` of that turn) or
    /// `last-message` (the model was not asked or failed).
    pub source: String,
    /// The model that wrote a `summary`.
    pub model: Option<String>,
    /// When the turn it covers ended, in milliseconds. A `perch report` newer than this is of a
    /// later turn.
    pub as_of: i64,
}

/// One model call, as the spend estimate prices it.
#[derive(Debug, Clone, PartialEq)]
pub struct ReporterRun {
    pub at: i64,
    /// `claude` or `codex`: whose CLI answered.
    pub provider: String,
    pub model: String,
    pub session_id: String,
    pub input: u64,
    pub cache_read: u64,
    pub cache_write: u64,
    pub output: u64,
    pub cost_usd: Option<f64>,
}

impl HistoryDb {
    pub fn session_summary(&self, session_id: &str) -> anyhow::Result<Option<StoredSummary>> {
        Ok(self
            .conn
            .lock()
            .unwrap()
            .query_row(
                "SELECT text, status, source, model, as_of FROM session_summaries
                 WHERE session_id = ?1",
                params![session_id],
                |row| {
                    Ok(StoredSummary {
                        text: row.get(0)?,
                        status: row.get(1)?,
                        source: row.get(2)?,
                        model: row.get(3)?,
                        as_of: row.get(4)?,
                    })
                },
            )
            .optional()?)
    }

    /// Replace a session's running notes. A turn that ended earlier than the notes already kept
    /// never overwrites them.
    pub fn store_summary(&self, session_id: &str, summary: &StoredSummary) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO session_summaries (session_id, text, status, source, model, as_of)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(session_id) DO UPDATE SET
                text = excluded.text, status = excluded.status, source = excluded.source,
                model = excluded.model, as_of = excluded.as_of
             WHERE excluded.as_of >= session_summaries.as_of",
            params![
                session_id,
                summary.text,
                summary.status,
                summary.source,
                summary.model,
                summary.as_of
            ],
        )?;
        Ok(())
    }

    pub fn record_reporter_run(&self, run: &ReporterRun) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT INTO reporter_runs
                (at, provider, model, session_id, input, cache_read, cache_write, output, cost_usd)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                run.at,
                run.provider,
                run.model,
                run.session_id,
                run.input as i64,
                run.cache_read as i64,
                run.cache_write as i64,
                run.output as i64,
                run.cost_usd
            ],
        )?;
        Ok(())
    }

    /// The model calls since `since_ms`, oldest first. A session's deletion keeps its calls: the
    /// money was spent.
    pub fn reporter_runs_since(&self, since_ms: i64) -> anyhow::Result<Vec<ReporterRun>> {
        let conn = self.conn.lock().unwrap();
        let mut statement = conn.prepare(
            "SELECT at, provider, model, session_id, input, cache_read, cache_write, output, cost_usd
             FROM reporter_runs WHERE at >= ?1 ORDER BY at",
        )?;
        let rows = statement.query_map(params![since_ms], |row| {
            Ok(ReporterRun {
                at: row.get(0)?,
                provider: row.get(1)?,
                model: row.get(2)?,
                session_id: row.get(3)?,
                input: row.get::<_, i64>(4)? as u64,
                cache_read: row.get::<_, i64>(5)? as u64,
                cache_write: row.get::<_, i64>(6)? as u64,
                output: row.get::<_, i64>(7)? as u64,
                cost_usd: row.get(8)?,
            })
        })?;
        Ok(rows.collect::<Result<_, _>>()?)
    }

    /// What the agents of `session_id`'s run have sent, for the reporter's message-limit guard.
    pub fn run_agent_messages(&self, session_id: &str) -> anyhow::Result<usize> {
        let conn = self.conn.lock().unwrap();
        let Some(run) = super::agent_runs::run_of(&conn, session_id)? else {
            return Ok(0);
        };
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM agent_mail
             WHERE run_id = ?1 AND kind IN ('message', 'steer') AND sender_session_id <> ?2",
            params![run, crate::crew_actions::PERSON],
            |row| row.get(0),
        )?;
        Ok(count as usize)
    }

    pub(super) fn delete_summary_locked(conn: &Connection, session_id: &str) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM session_summaries WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open() -> HistoryDb {
        HistoryDb::open(
            std::env::temp_dir().join(format!("perch-reporter-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap()
    }

    fn summary(text: &str, source: &str, as_of: i64) -> StoredSummary {
        StoredSummary {
            text: text.into(),
            status: "done".into(),
            source: source.into(),
            model: (source == "summary").then(|| "claude-haiku-4-5".into()),
            as_of,
        }
    }

    #[test]
    fn a_sessions_notes_are_replaced_by_a_later_turn_and_not_by_an_earlier_one() {
        let db = open();
        assert_eq!(db.session_summary("c").unwrap(), None);
        db.store_summary("c", &summary("first", "summary", 100))
            .unwrap();
        db.store_summary("c", &summary("second", "report", 200))
            .unwrap();
        let kept = db.session_summary("c").unwrap().unwrap();
        assert_eq!(
            (kept.text.as_str(), kept.source.as_str()),
            ("second", "report")
        );
        assert_eq!(kept.model, None, "a report names no model");
        // A slow call for an earlier turn lands after the later one: it is dropped.
        db.store_summary("c", &summary("stale", "summary", 150))
            .unwrap();
        assert_eq!(db.session_summary("c").unwrap().unwrap().text, "second");
    }

    #[test]
    fn model_calls_are_kept_for_the_spend_estimate_in_time_order() {
        let db = open();
        let run = |at, cost| ReporterRun {
            at,
            provider: "claude".into(),
            model: "claude-haiku-4-5".into(),
            session_id: "c".into(),
            input: 541,
            cache_read: 0,
            cache_write: 0,
            output: 80,
            cost_usd: cost,
        };
        db.record_reporter_run(&run(300, Some(0.001))).unwrap();
        db.record_reporter_run(&run(100, None)).unwrap();
        let all = db.reporter_runs_since(0).unwrap();
        assert_eq!(all.iter().map(|r| r.at).collect::<Vec<_>>(), [100, 300]);
        assert_eq!(all[1].cost_usd, Some(0.001));
        assert_eq!(db.reporter_runs_since(200).unwrap().len(), 1);
    }
}
