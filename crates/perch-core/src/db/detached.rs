//! Detached run rows (direct-mode hosts — see `detached.rs`). Pure move
//! from `db.rs` — see the refactor plan's Phase 5. No logic changed.

use super::*;

impl HistoryDb {
    // -----------------------------------------------------------------------
    // Detached runs (direct-mode hosts — see `detached.rs`)
    // -----------------------------------------------------------------------

    /// Record a freshly-launched detached turn as `status = 'running'`.
    pub fn insert_detached_run(&self, run: &DetachedRunRow) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "INSERT OR REPLACE INTO detached_runs
                (run_id, session_id, host_id, ssh_host, agent, model, cwd, run_dir, log_path,
                 pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status,
                 created_at, operation_id)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
            params![
                run.run_id,
                run.session_id,
                run.host_id,
                run.ssh_host,
                run.agent,
                run.model,
                run.cwd,
                run.run_dir,
                run.log_path,
                run.pid,
                run.pgid,
                run.proc_start,
                run.cursor_offset,
                run.cursor_inode,
                run.provider_session_id,
                run.status,
                run.created_at,
                run.operation_id,
            ],
        )?;
        Ok(())
    }

    /// Attach the process identity to a run row that was written *before* the
    /// remote launch (see the durability barrier in `detached.rs`). Split from
    /// `insert_detached_run` so the row exists from the moment perch commits
    /// to running a turn, not from the moment the remote answers.
    pub fn attach_detached_pid(
        &self,
        run_id: &str,
        pid: i64,
        pgid: i64,
        proc_start: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs SET pid = ?2, pgid = ?3, proc_start = ?4 WHERE run_id = ?1",
            params![run_id, pid, pgid, proc_start],
        )?;
        Ok(())
    }

    /// Persist the tail cursor for a run. Written when a tail child ends (not
    /// per line) — within one perch lifetime the authoritative cursor is the
    /// in-memory one; this copy exists so a *reaper* can tell how much of a
    /// log was ingested, and to make the truncation check on re-attach
    /// meaningful. See `detached.rs` for why recovery still re-reads from 0.
    pub fn update_detached_cursor(
        &self,
        run_id: &str,
        offset: u64,
        inode: u64,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs SET cursor_offset = ?2, cursor_inode = ?3 WHERE run_id = ?1",
            params![run_id, offset as i64, inode as i64],
        )?;
        Ok(())
    }

    /// Terminal state for a run: `'done' | 'failed' | 'cancelled'`.
    pub fn finish_detached_run(
        &self,
        run_id: &str,
        status: &str,
        provider_session_id: Option<&str>,
    ) -> anyhow::Result<()> {
        self.conn.lock().unwrap().execute(
            "UPDATE detached_runs
             SET status = ?2, provider_session_id = COALESCE(?3, provider_session_id)
             WHERE run_id = ?1",
            params![run_id, status, provider_session_id],
        )?;
        Ok(())
    }

    /// Every run still marked `running` — the recovery worklist a fresh perch
    /// process reads at startup.
    pub fn unfinished_detached_runs(&self) -> anyhow::Result<Vec<DetachedRunRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT run_id, session_id, host_id, ssh_host, agent, model, cwd, run_dir, log_path,
                    pid, pgid, proc_start, cursor_offset, cursor_inode, provider_session_id, status,
                    created_at, operation_id
             FROM detached_runs WHERE status = 'running' ORDER BY created_at ASC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DetachedRunRow {
                    run_id: row.get(0)?,
                    session_id: row.get(1)?,
                    host_id: row.get(2)?,
                    ssh_host: row.get(3)?,
                    agent: row.get(4)?,
                    model: row.get(5)?,
                    cwd: row.get(6)?,
                    run_dir: row.get(7)?,
                    log_path: row.get(8)?,
                    pid: row.get(9)?,
                    pgid: row.get(10)?,
                    proc_start: row.get(11)?,
                    cursor_offset: row.get(12)?,
                    cursor_inode: row.get(13)?,
                    provider_session_id: row.get(14)?,
                    status: row.get(15)?,
                    created_at: row.get(16)?,
                    operation_id: row.get(17)?,
                })
            })?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// The most recent still-running run for a session, if any — used by
    /// `chat.cancel` to find the process group to signal.
    pub fn running_detached_run_for_session(
        &self,
        session_id: &str,
    ) -> anyhow::Result<Option<DetachedRunRow>> {
        Ok(self
            .unfinished_detached_runs()?
            .into_iter()
            .rfind(|r| r.session_id == session_id))
    }
}

/// One detached turn's durable record. Mirrors the `detached_runs` table.
#[derive(Debug, Clone)]
pub struct DetachedRunRow {
    pub run_id: String,
    pub session_id: String,
    pub host_id: String,
    pub ssh_host: String,
    /// `"claude"` | `"codex"`.
    pub agent: String,
    pub model: Option<String>,
    pub cwd: String,
    pub run_dir: String,
    pub log_path: String,
    /// Pid of the detached job's top-level shell — what liveness checks probe.
    pub pid: Option<i64>,
    /// Process-group id of that job, read back from `ps` at launch rather than
    /// assumed (under `bash -c 'set -m'` it equals `pid`, but the launcher has
    /// a non-bash fallback). Cancel signals the whole *group*, so a `claude`
    /// that shelled out doesn't leak children.
    pub pgid: Option<i64>,
    /// Opaque start-time identity of `pid` captured at launch (Linux
    /// `/proc/<pid>/stat` field 22, else `ps -o lstart=`). Compared verbatim
    /// on recovery so a recycled pid can't masquerade as a live turn.
    pub proc_start: Option<String>,
    pub cursor_offset: i64,
    pub cursor_inode: i64,
    /// The provider's own continuity id scraped from the run log (claude
    /// `session_id` / codex `thread_id`).
    pub provider_session_id: Option<String>,
    /// `'running' | 'done' | 'failed' | 'cancelled'`.
    pub status: String,
    pub created_at: i64,
    /// The prompt operation that launched this run, when the run was created
    /// by the durable hosted/review send path. Legacy rows may have none.
    pub operation_id: Option<String>,
}
