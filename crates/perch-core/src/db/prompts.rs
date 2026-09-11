//! Prompt operation reservation/claim/settlement and agent-change-
//! snapshot rows. Pure move from `db.rs` — see the refactor plan's
//! Phase 5. No logic changed.
//!
//! `PromptOperationRow`, `PromptClaim`, `AgentChangeSnapshotRow`,
//! `AgentChangeSnapshotStart`, `AgentChangeSnapshotFinish`,
//! `MAX_AGENT_CHANGE_PATHS`, `MAX_AGENT_CHANGE_STATUS_BYTES` are
//! re-exported from db/mod.rs (`pub use prompts::{...}`) to keep
//! `crate::db::X` import paths working — `PromptClaim` is used from
//! server/session.rs, and the rest were part of db.rs's public surface
//! before this split even though nothing outside db/ currently names
//! them directly.
//!
//! `validate_workspace_metadata` stayed in mod.rs despite sitting
//! textually between two functions that moved here: it's used by the
//! not-yet-split projects/workspace methods, not by anything here.

use super::*;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptOperationRow {
    pub operation_id: String,
    pub session_id: String,
    pub workspace_id: Option<String>,
    pub payload_digest: String,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Durable before/after boundary for one agent turn.  The status fields are
/// bounded Git summaries encoded as JSON by the server; paths contain only
/// workspace-relative names and are capped before they reach SQLite.  Git
/// content remains derived from the recorded revisions, so this row does not
/// grow with every turn's file contents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentChangeSnapshotRow {
    pub snapshot_id: String,
    pub operation_id: String,
    pub workspace_id: String,
    pub session_id: String,
    pub agent: String,
    pub before_head: Option<String>,
    pub before_branch: Option<String>,
    pub before_status: String,
    pub before_paths: Vec<String>,
    pub after_head: Option<String>,
    pub after_branch: Option<String>,
    pub after_status: Option<String>,
    pub after_paths: Option<Vec<String>>,
    pub changed_paths: Option<Vec<String>>,
    pub completed: bool,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

/// A bounded input for starting an agent change snapshot.  `snapshot_id` is
/// separate from `operation_id` so a caller can use one stable turn id while
/// retaining a distinct display/history identity.
#[derive(Debug, Clone)]
pub struct AgentChangeSnapshotStart<'a> {
    pub snapshot_id: &'a str,
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub session_id: &'a str,
    pub agent: &'a str,
    pub before_head: Option<&'a str>,
    pub before_branch: Option<&'a str>,
    pub before_status: &'a str,
    pub before_paths: &'a [String],
    pub created_at: i64,
}

/// A bounded input for finishing an agent change snapshot.  Completion is an
/// idempotent compare-and-set: the first after-boundary wins, and retries
/// return the already completed row without replacing its Git evidence.
#[derive(Debug, Clone)]
pub struct AgentChangeSnapshotFinish<'a> {
    pub snapshot_id: &'a str,
    pub after_head: Option<&'a str>,
    pub after_branch: Option<&'a str>,
    pub after_status: &'a str,
    pub after_paths: &'a [String],
    pub completed_at: i64,
}

/// Maximum bounded metadata retained for one agent turn.  A status poll can
/// expose many paths in a generated repository; retaining a deterministic
/// prefix keeps recovery and UI packets cheap while still carrying the common
/// case in full.
pub const MAX_AGENT_CHANGE_PATHS: usize = 512;
pub const MAX_AGENT_CHANGE_STATUS_BYTES: usize = 64 * 1024;

/// The result of the compare-and-set that crosses the prompt dispatch
/// boundary. `won_claim` is true for exactly one caller of a queued
/// operation; callers that observe an already-claimed or terminal operation
/// must not launch another provider process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptClaim {
    pub operation: PromptOperationRow,
    pub won_claim: bool,
}

impl HistoryDb {
    /// Reserve a prompt operation and its user message in one SQLite
    /// transaction. A retry with the same operation id is accepted only when
    /// its session, workspace, and payload digest all match; it never creates
    /// a second message row.
    #[allow(clippy::too_many_arguments)]
    pub fn reserve_prompt_operation(
        &self,
        operation_id: &str,
        session_id: &str,
        workspace_id: Option<&str>,
        payload_digest: &str,
        content: &str,
        agent: Option<&str>,
        model: Option<&str>,
    ) -> anyhow::Result<(PromptOperationRow, bool)> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let existing = get_prompt_operation_locked(&conn, operation_id)?;
            if let Some(existing) = existing {
                if existing.session_id != session_id
                    || existing.workspace_id.as_deref() != workspace_id
                    || existing.payload_digest != payload_digest
                {
                    return Err(anyhow::anyhow!(
                        "prompt operation id is already bound to a different payload"
                    ));
                }
                return anyhow::Ok((existing, false));
            }
            let now = now_millis();
            conn.execute(
                "INSERT INTO prompt_operations
                    (operation_id, session_id, workspace_id, payload_digest, state,
                     created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)",
                params![operation_id, session_id, workspace_id, payload_digest, now],
            )?;
            conn.execute(
                "INSERT INTO messages
                    (session_id, role, content, agent, model, thinking, operation_id,
                     created_at)
                 VALUES (?1, 'user', ?2, ?3, ?4, NULL, ?5, ?6)",
                params![session_id, content, agent, model, operation_id, now],
            )?;
            let row = get_prompt_operation_locked(&conn, operation_id)?
                .ok_or_else(|| anyhow::anyhow!("prompt operation disappeared after insertion"))?;
            anyhow::Ok((row, true))
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn get_prompt_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<PromptOperationRow>> {
        let conn = self.conn.lock().unwrap();
        get_prompt_operation_locked(&conn, operation_id)
    }

    /// Claim only queued operations. The update and row read happen while
    /// the connection is locked, and `won_claim` records whether this caller
    /// changed the row. Repeated callers receive the current state with
    /// `won_claim = false`, which prevents two connections from launching the
    /// same prompt.
    pub fn claim_prompt_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<PromptClaim>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE prompt_operations SET state = 'claimed', updated_at = ?2
             WHERE operation_id = ?1 AND state = 'queued'",
            params![operation_id, now_millis()],
        )?;
        Ok(
            get_prompt_operation_locked(&conn, operation_id)?.map(|operation| PromptClaim {
                operation,
                won_claim: changed == 1,
            }),
        )
    }

    pub fn set_prompt_operation_state(
        &self,
        operation_id: &str,
        state: &str,
    ) -> anyhow::Result<()> {
        if !matches!(state, "queued" | "claimed" | "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!("invalid prompt operation state: {state}"));
        }
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_prompt_operation_locked(&conn, operation_id)? else {
            return Ok(());
        };
        // `unconfirmed` means the dispatch boundary was crossed before a
        // restart or disconnect. It is terminal until a caller has positive
        // evidence of delivery; a retry must never downgrade it back into a
        // dispatchable state. `delivered` is likewise immutable.
        let next = match current.state.as_str() {
            "delivered" => "delivered",
            "unconfirmed" if state != "delivered" => "unconfirmed",
            "claimed" if state == "queued" => "claimed",
            _ => state,
        };
        if next != current.state {
            conn.execute(
                "UPDATE prompt_operations SET state = ?2, updated_at = ?3
                 WHERE operation_id = ?1",
                params![operation_id, next, now_millis()],
            )?;
        }
        Ok(())
    }

    /// Atomically settle a prompt dispatch and the review packet that uses
    /// the same operation id. The two rows are separate for migration
    /// compatibility, but publishing one durable outcome must not leave the
    /// packet claiming success while the prompt is still uncertain (or vice
    /// versa).
    pub fn settle_prompt_dispatch(
        &self,
        operation_id: &str,
        state: &str,
        now: i64,
    ) -> anyhow::Result<Option<PromptOperationRow>> {
        if !matches!(state, "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!(
                "invalid prompt dispatch settlement state: {state}"
            ));
        }
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let Some(current) = get_prompt_operation_locked(&conn, operation_id)? else {
                return anyhow::Ok(None);
            };
            let next_prompt = match current.state.as_str() {
                "delivered" => "delivered",
                "unconfirmed" if state != "delivered" => "unconfirmed",
                _ => state,
            };
            if next_prompt != current.state {
                conn.execute(
                    "UPDATE prompt_operations SET state = ?2, updated_at = ?3
                     WHERE operation_id = ?1",
                    params![operation_id, next_prompt, now],
                )?;
            }

            let packet = conn
                .query_row(
                    "SELECT packet_id, state FROM review_packets
                     WHERE send_operation_id = ?1",
                    params![operation_id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()?;
            if let Some((packet_id, packet_state)) = packet {
                let next_packet = match packet_state.as_str() {
                    "delivered" => "delivered",
                    "unconfirmed" if next_prompt != "delivered" => "unconfirmed",
                    _ if next_prompt == "delivered" => "delivered",
                    _ => "unconfirmed",
                };
                if next_packet != packet_state {
                    conn.execute(
                        "UPDATE review_packets SET state = ?2, updated_at = ?3
                         WHERE packet_id = ?1",
                        params![packet_id, next_packet, now],
                    )?;
                }
            }
            get_prompt_operation_locked(&conn, operation_id)
        })();
        match outcome {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Begin an agent turn's Git change boundary.  The insert is keyed by
    /// `operation_id`, so a reconnect that retries the same prompt receives
    /// the original before snapshot and cannot overwrite it with a later
    /// working-tree state.
    pub fn begin_agent_change_snapshot(
        &self,
        start: AgentChangeSnapshotStart<'_>,
    ) -> anyhow::Result<AgentChangeSnapshotRow> {
        validate_agent_snapshot_identity(start.snapshot_id, "snapshot")?;
        validate_agent_snapshot_identity(start.operation_id, "operation")?;
        validate_agent_snapshot_identity(start.workspace_id, "workspace")?;
        validate_agent_snapshot_identity(start.session_id, "session")?;
        validate_agent_snapshot_identity(start.agent, "agent")?;
        validate_agent_snapshot_text(start.before_status, "before status")?;
        let before_paths_json = encode_agent_snapshot_paths(start.before_paths)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            if let Some(existing) = get_agent_change_snapshot_locked(&conn, start.operation_id)? {
                if existing.workspace_id != start.workspace_id
                    || existing.session_id != start.session_id
                    || existing.agent != start.agent
                    || existing.before_head.as_deref() != start.before_head
                    || existing.before_branch.as_deref() != start.before_branch
                    || existing.before_status != start.before_status
                    || serde_json::to_string(&existing.before_paths)? != before_paths_json
                {
                    return Err(anyhow::anyhow!(
                        "agent change operation id is already bound to a different boundary"
                    ));
                }
                return anyhow::Ok(existing);
            }
            conn.execute(
                "INSERT INTO agent_change_snapshots
                    (snapshot_id, operation_id, workspace_id, session_id, agent,
                     before_head, before_branch, before_status, before_paths_json,
                     completed, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10)",
                params![
                    start.snapshot_id,
                    start.operation_id,
                    start.workspace_id,
                    start.session_id,
                    start.agent,
                    start.before_head,
                    start.before_branch,
                    start.before_status,
                    before_paths_json,
                    start.created_at,
                ],
            )?;
            get_agent_change_snapshot_locked(&conn, start.operation_id)?
                .ok_or_else(|| anyhow::anyhow!("agent change snapshot disappeared after insertion"))
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Finish one agent turn's Git change boundary exactly once.  The changed
    /// path set is the union of before and after status paths, which preserves
    /// a path that an agent modified and then restored to clean.  A retry
    /// after completion returns the first durable after snapshot unchanged.
    pub fn finish_agent_change_snapshot(
        &self,
        finish: AgentChangeSnapshotFinish<'_>,
    ) -> anyhow::Result<Option<AgentChangeSnapshotRow>> {
        validate_agent_snapshot_identity(finish.snapshot_id, "snapshot")?;
        validate_agent_snapshot_text(finish.after_status, "after status")?;
        let after_paths_json = encode_agent_snapshot_paths(finish.after_paths)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let Some(current) = get_agent_change_snapshot_locked(&conn, finish.snapshot_id)? else {
                return anyhow::Ok(None);
            };
            if current.completed {
                return anyhow::Ok(Some(current));
            }
            let mut changed_paths = current.before_paths.clone();
            changed_paths.extend(finish.after_paths.iter().cloned());
            changed_paths.sort();
            changed_paths.dedup();
            let changed_paths_json = encode_agent_snapshot_paths(&changed_paths)?;
            conn.execute(
                "UPDATE agent_change_snapshots
                 SET after_head = ?2, after_branch = ?3, after_status = ?4,
                     after_paths_json = ?5, changed_paths_json = ?6,
                     completed = 1, completed_at = ?7
                 WHERE snapshot_id = ?1 AND completed = 0",
                params![
                    finish.snapshot_id,
                    finish.after_head,
                    finish.after_branch,
                    finish.after_status,
                    after_paths_json,
                    changed_paths_json,
                    finish.completed_at,
                ],
            )?;
            get_agent_change_snapshot_locked(&conn, finish.snapshot_id)
        })();
        match result {
            Ok(row) => {
                conn.execute_batch("COMMIT")?;
                Ok(row)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn get_agent_change_snapshot(
        &self,
        snapshot_id: &str,
    ) -> anyhow::Result<Option<AgentChangeSnapshotRow>> {
        validate_agent_snapshot_identity(snapshot_id, "snapshot")?;
        let conn = self.conn.lock().unwrap();
        get_agent_change_snapshot_locked(&conn, snapshot_id)
    }

    /// Return completed and in-flight turn boundaries newest first.  The
    /// caller supplies a small limit; this method never exposes an unbounded
    /// history slice to a UI reconnect.
    pub fn list_agent_change_snapshots(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<AgentChangeSnapshotRow>> {
        validate_agent_snapshot_identity(workspace_id, "workspace")?;
        let limit = limit.min(MAX_AGENT_CHANGE_PATHS);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT snapshot_id, operation_id, workspace_id, session_id, agent,
                    before_head, before_branch, before_status, before_paths_json,
                    after_head, after_branch, after_status, after_paths_json,
                    changed_paths_json, completed, created_at, completed_at
             FROM agent_change_snapshots
             WHERE workspace_id = ?1
             ORDER BY created_at DESC, snapshot_id DESC
             LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(
                params![workspace_id, limit as i64],
                agent_change_snapshot_row_from_row,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// A claimed operation has crossed the dispatch boundary. After a process
    /// restart there is no safe way to know whether the provider accepted it,
    /// so preserve the packet and mark it unconfirmed instead of relaunching.
    pub fn mark_claimed_prompt_operations_unconfirmed(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE prompt_operations SET state = 'unconfirmed', updated_at = ?1
             WHERE state = 'claimed'",
            params![now_millis()],
        )?)
    }
}

fn get_prompt_operation_locked(
    conn: &Connection,
    operation_id: &str,
) -> anyhow::Result<Option<PromptOperationRow>> {
    conn.query_row(
        "SELECT operation_id, session_id, workspace_id, payload_digest, state,
                created_at, updated_at
         FROM prompt_operations WHERE operation_id = ?1",
        params![operation_id],
        |row| {
            Ok(PromptOperationRow {
                operation_id: row.get(0)?,
                session_id: row.get(1)?,
                workspace_id: row.get(2)?,
                payload_digest: row.get(3)?,
                state: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn validate_agent_snapshot_identity(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty() || value.len() > 512 || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "agent change {label} is empty, oversized, or contains NUL"
        ));
    }
    Ok(())
}

fn validate_agent_snapshot_text(value: &str, label: &str) -> anyhow::Result<()> {
    if value.len() > MAX_AGENT_CHANGE_STATUS_BYTES || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "agent change {label} exceeds the {MAX_AGENT_CHANGE_STATUS_BYTES}-byte limit"
        ));
    }
    Ok(())
}

fn encode_agent_snapshot_paths(paths: &[String]) -> anyhow::Result<String> {
    if paths.len() > MAX_AGENT_CHANGE_PATHS {
        return Err(anyhow::anyhow!(
            "agent change path set exceeds {MAX_AGENT_CHANGE_PATHS} entries"
        ));
    }
    let mut normalized = paths.to_vec();
    for path in &normalized {
        if path.is_empty() || path.len() > 4096 || path.contains('\0') {
            return Err(anyhow::anyhow!("agent change path is invalid or oversized"));
        }
    }
    normalized.sort();
    normalized.dedup();
    let encoded = serde_json::to_string(&normalized)?;
    if encoded.len() > MAX_AGENT_CHANGE_STATUS_BYTES {
        return Err(anyhow::anyhow!(
            "agent change path set exceeds the {MAX_AGENT_CHANGE_STATUS_BYTES}-byte limit"
        ));
    }
    Ok(encoded)
}

fn decode_agent_snapshot_paths(json: &str) -> anyhow::Result<Vec<String>> {
    let paths: Vec<String> = serde_json::from_str(json)?;
    // Validate persisted rows too: a corrupt/old DB must fail closed rather
    // than return unbounded path metadata to the UI.
    let encoded = encode_agent_snapshot_paths(&paths)?;
    let canonical: Vec<String> = serde_json::from_str(&encoded)?;
    Ok(canonical)
}

fn agent_change_snapshot_row_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<AgentChangeSnapshotRow> {
    let before_paths_json: String = row.get(8)?;
    let after_paths_json: Option<String> = row.get(12)?;
    let changed_paths_json: Option<String> = row.get(13)?;
    let before_paths = decode_agent_snapshot_paths(&before_paths_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            8,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::other(error.to_string())),
        )
    })?;
    let after_paths = after_paths_json
        .as_deref()
        .map(decode_agent_snapshot_paths)
        .transpose()
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                12,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::other(error.to_string())),
            )
        })?;
    let changed_paths = changed_paths_json
        .as_deref()
        .map(decode_agent_snapshot_paths)
        .transpose()
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                13,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::other(error.to_string())),
            )
        })?;
    Ok(AgentChangeSnapshotRow {
        snapshot_id: row.get(0)?,
        operation_id: row.get(1)?,
        workspace_id: row.get(2)?,
        session_id: row.get(3)?,
        agent: row.get(4)?,
        before_head: row.get(5)?,
        before_branch: row.get(6)?,
        before_status: row.get(7)?,
        before_paths,
        after_head: row.get(9)?,
        after_branch: row.get(10)?,
        after_status: row.get(11)?,
        after_paths,
        changed_paths,
        completed: row.get::<_, i32>(14)? != 0,
        created_at: row.get(15)?,
        completed_at: row.get(16)?,
    })
}

fn get_agent_change_snapshot_locked(
    conn: &Connection,
    key: &str,
) -> anyhow::Result<Option<AgentChangeSnapshotRow>> {
    conn.query_row(
        "SELECT snapshot_id, operation_id, workspace_id, session_id, agent,
                before_head, before_branch, before_status, before_paths_json,
                after_head, after_branch, after_status, after_paths_json,
                changed_paths_json, completed, created_at, completed_at
         FROM agent_change_snapshots
         WHERE snapshot_id = ?1 OR operation_id = ?1
         ORDER BY snapshot_id = ?1 DESC
         LIMIT 1",
        params![key],
        agent_change_snapshot_row_from_row,
    )
    .optional()
    .map_err(Into::into)
}
