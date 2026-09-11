//! Git action previews, review comments, and review-packet dispatch.
//! Pure move from `db.rs` — see the refactor plan's Phase 5. No logic
//! changed.
//!
//! `GitPreviewRow`, `ReviewPacketRow`, `ReviewUpdateResult`,
//! `ReviewDeleteResult` are re-exported from db/mod.rs
//! (`pub use git_review::{...}`) to keep `crate::db::X` import paths
//! working — all four are used from server/reviews.rs (and
//! ReviewDeleteResult/ReviewUpdateResult from server/mod.rs's own
//! top-level use block).

use super::*;

/// Durable authorization receipt for a destructive Git action. The status
/// fingerprint and exact canonical path set are retained so a restart or a
/// second connection cannot turn an old preview into an unbounded approval.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitPreviewRow {
    pub preview_id: String,
    pub operation: String,
    pub workspace_id: String,
    pub paths_json: String,
    pub status_fingerprint: String,
    pub message_digest: Option<String>,
    pub message: Option<String>,
    pub expires_at: i64,
    pub consumed: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewPacketRow {
    pub packet: ReviewPacket,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReviewUpdateResult {
    Updated(ReviewComment),
    Conflict(ReviewComment),
    NotFound,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReviewDeleteResult {
    Deleted,
    Conflict(ReviewComment),
    NotFound,
}

impl HistoryDb {
    // -----------------------------------------------------------------------
    // Git previews, review comments, and prompt-operation receipts
    // -----------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn insert_git_preview(
        &self,
        preview_id: &str,
        operation: &str,
        workspace_id: &str,
        paths_json: &str,
        status_fingerprint: &str,
        message_digest: Option<&str>,
        message: Option<&str>,
        expires_at: i64,
    ) -> anyhow::Result<GitPreviewRow> {
        let conn = self.conn.lock().unwrap();
        let created_at = now_millis();
        conn.execute(
            "INSERT INTO git_previews
                (preview_id, operation, workspace_id, paths_json, status_fingerprint,
                 message_digest, message, expires_at, consumed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)",
            params![
                preview_id,
                operation,
                workspace_id,
                paths_json,
                status_fingerprint,
                message_digest,
                message,
                expires_at,
                created_at
            ],
        )?;
        get_git_preview_locked(&conn, preview_id)?
            .ok_or_else(|| anyhow::anyhow!("Git preview disappeared after insertion: {preview_id}"))
    }

    pub fn get_git_preview(&self, preview_id: &str) -> anyhow::Result<Option<GitPreviewRow>> {
        let conn = self.conn.lock().unwrap();
        get_git_preview_locked(&conn, preview_id)
    }

    /// Atomically consume an unexpired preview for one workspace. Returning
    /// `None` covers unknown, expired, already-consumed, and cross-workspace
    /// receipts; callers must obtain a fresh preview rather than guessing.
    pub fn consume_git_preview(
        &self,
        preview_id: &str,
        workspace_id: &str,
        now: i64,
    ) -> anyhow::Result<Option<GitPreviewRow>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE git_previews SET consumed = 1
             WHERE preview_id = ?1 AND workspace_id = ?2
               AND consumed = 0 AND expires_at > ?3",
            params![preview_id, workspace_id, now],
        )?;
        if changed == 0 {
            return Ok(None);
        }
        get_git_preview_locked(&conn, preview_id)
    }

    pub fn insert_review_comment(&self, comment: &ReviewComment) -> anyhow::Result<()> {
        let json = serde_json::to_string(comment)?;
        self.conn.lock().unwrap().execute(
            "INSERT INTO review_comments
                (comment_id, workspace_id, version, comment_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                comment.id,
                comment.workspace_id,
                comment.version,
                json,
                comment.created_at,
                comment.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
    ) -> anyhow::Result<Option<ReviewComment>> {
        let conn = self.conn.lock().unwrap();
        get_review_comment_locked(&conn, workspace_id, comment_id)
    }

    pub fn list_review_comments(
        &self,
        workspace_id: &str,
        max: usize,
    ) -> anyhow::Result<Vec<ReviewComment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT comment_json FROM review_comments
             WHERE workspace_id = ?1
             ORDER BY updated_at ASC, comment_id ASC LIMIT ?2",
        )?;
        let rows = stmt
            .query_map(params![workspace_id, max as i64], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows.into_iter()
            .map(|json| serde_json::from_str(&json).map_err(Into::into))
            .collect()
    }

    pub fn update_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
        expected_version: u64,
        comment: &ReviewComment,
    ) -> anyhow::Result<ReviewUpdateResult> {
        let json = serde_json::to_string(comment)?;
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let current = get_review_comment_locked(&conn, workspace_id, comment_id)?;
            let Some(current) = current else {
                return anyhow::Ok(ReviewUpdateResult::NotFound);
            };
            if current.version != expected_version {
                return anyhow::Ok(ReviewUpdateResult::Conflict(current));
            }
            conn.execute(
                "UPDATE review_comments
                 SET version = ?4, comment_json = ?3, updated_at = ?5
                 WHERE workspace_id = ?1 AND comment_id = ?2 AND version = ?6",
                params![
                    workspace_id,
                    comment_id,
                    json,
                    comment.version,
                    comment.updated_at,
                    expected_version
                ],
            )?;
            anyhow::Ok(ReviewUpdateResult::Updated(comment.clone()))
        })();
        match outcome {
            Ok(result) => {
                conn.execute_batch("COMMIT")?;
                Ok(result)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn delete_review_comment(
        &self,
        workspace_id: &str,
        comment_id: &str,
        expected_version: u64,
    ) -> anyhow::Result<ReviewDeleteResult> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let outcome = (|| {
            let current = get_review_comment_locked(&conn, workspace_id, comment_id)?;
            let Some(current) = current else {
                return anyhow::Ok(ReviewDeleteResult::NotFound);
            };
            if current.version != expected_version {
                return anyhow::Ok(ReviewDeleteResult::Conflict(current));
            }
            conn.execute(
                "DELETE FROM review_comments WHERE workspace_id = ?1 AND comment_id = ?2
                 AND version = ?3",
                params![workspace_id, comment_id, expected_version],
            )?;
            anyhow::Ok(ReviewDeleteResult::Deleted)
        })();
        match outcome {
            Ok(result) => {
                conn.execute_batch("COMMIT")?;
                Ok(result)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn insert_review_packet(
        &self,
        packet: &ReviewPacket,
        now: i64,
    ) -> anyhow::Result<ReviewPacketRow> {
        let json = serde_json::to_string(packet)?;
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO review_packets
                (packet_id, send_operation_id, workspace_id, packet_json, state,
                 created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?5)",
            params![
                packet.packet_id,
                packet.send_operation_id,
                packet.workspace_id,
                json,
                now
            ],
        )?;
        let row = get_review_packet_locked(&conn, &packet.packet_id)?
            .ok_or_else(|| anyhow::anyhow!("review packet disappeared after insertion"))?;
        if row.packet.send_operation_id != packet.send_operation_id || row.packet != *packet {
            return Err(anyhow::anyhow!(
                "review packet id already belongs to a different payload"
            ));
        }
        Ok(row)
    }

    pub fn get_review_packet(&self, packet_id: &str) -> anyhow::Result<Option<ReviewPacketRow>> {
        let conn = self.conn.lock().unwrap();
        get_review_packet_locked(&conn, packet_id)
    }

    /// Look up the packet reserved for one send operation. The operation id
    /// is the stable key shared with `prompt_operations`, so completion of a
    /// normal chat dispatch can settle the corresponding review outbox row
    /// without keeping an in-memory packet map.
    pub fn get_review_packet_for_operation(
        &self,
        send_operation_id: &str,
    ) -> anyhow::Result<Option<ReviewPacketRow>> {
        let conn = self.conn.lock().unwrap();
        let packet_id = conn
            .query_row(
                "SELECT packet_id FROM review_packets
                 WHERE send_operation_id = ?1",
                params![send_operation_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        packet_id
            .map(|packet_id| get_review_packet_locked(&conn, &packet_id))
            .transpose()
            .map(|packet| packet.flatten())
    }

    /// Move a packet forward in its durable delivery state without ever
    /// downgrading `delivered` or `unconfirmed`. The operation/workspace pair
    /// is checked while the row is locked so a guessed packet id cannot be
    /// applied to another workspace.
    pub fn set_review_packet_state(
        &self,
        packet_id: &str,
        send_operation_id: &str,
        workspace_id: &str,
        state: &str,
        now: i64,
    ) -> anyhow::Result<Option<ReviewPacketRow>> {
        if !matches!(state, "queued" | "claimed" | "delivered" | "unconfirmed") {
            return Err(anyhow::anyhow!("invalid review packet state: {state}"));
        }
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_review_packet_locked(&conn, packet_id)? else {
            return Ok(None);
        };
        if current.packet.send_operation_id != send_operation_id
            || current.packet.workspace_id != workspace_id
        {
            return Ok(None);
        }
        let next = match current.state.as_str() {
            "delivered" => current.state.clone(),
            "unconfirmed" if state != "delivered" => current.state.clone(),
            "claimed" if state == "queued" => current.state.clone(),
            _ => state.to_string(),
        };
        conn.execute(
            "UPDATE review_packets SET state = ?2, updated_at = ?3 WHERE packet_id = ?1",
            params![packet_id, next, now],
        )?;
        get_review_packet_locked(&conn, packet_id)
    }

    /// Claim a queued review packet with a compare-and-set. The row and the
    /// winner bit are returned under the same connection lock, so only the
    /// caller that changed `queued` to `claimed` may dispatch the packet.
    pub fn claim_review_packet(
        &self,
        packet_id: &str,
        send_operation_id: &str,
        workspace_id: &str,
        now: i64,
    ) -> anyhow::Result<Option<(ReviewPacketRow, bool)>> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE review_packets SET state = 'claimed', updated_at = ?4
             WHERE packet_id = ?1 AND send_operation_id = ?2
               AND workspace_id = ?3 AND state = 'queued'",
            params![packet_id, send_operation_id, workspace_id, now],
        )?;
        Ok(get_review_packet_locked(&conn, packet_id)?.map(|row| (row, changed == 1)))
    }

    /// A claimed packet crossed the dispatch boundary. A restart cannot prove
    /// whether the provider accepted it, so leave it recoverable as
    /// `unconfirmed` instead of silently retrying it.
    pub fn mark_claimed_review_packets_unconfirmed(&self) -> anyhow::Result<usize> {
        Ok(self.conn.lock().unwrap().execute(
            "UPDATE review_packets SET state = 'unconfirmed', updated_at = ?1
             WHERE state = 'claimed'",
            params![now_millis()],
        )?)
    }

    /// Reconcile the review outbox with its shared prompt operation after a
    /// restart. A packet and its prompt are intentionally separate rows so
    /// older databases can migrate additively; this pass closes the small
    /// crash window between either row being claimed and the other row being
    /// written. A claimed packet with no prompt is always unconfirmed, while
    /// a prompt that reached `delivered` is safe to promote its packet to the
    /// same terminal state.
    pub fn reconcile_review_packets_with_prompt_operations(&self) -> anyhow::Result<usize> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT packet_id, send_operation_id, state
             FROM review_packets
             WHERE state IN ('queued', 'claimed', 'unconfirmed')",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(stmt);

        let mut changed = 0usize;
        for (packet_id, operation_id, packet_state) in rows {
            let prompt_state = conn
                .query_row(
                    "SELECT state FROM prompt_operations WHERE operation_id = ?1",
                    params![operation_id],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            let next = match (packet_state.as_str(), prompt_state.as_deref()) {
                // A completed prompt is durable evidence that the packet was
                // handed to the session, even if the packet update itself
                // was interrupted.
                (_, Some("delivered")) => Some("delivered"),
                // A claimed/unconfirmed prompt may already have reached the
                // provider. Never turn it back into a dispatchable packet.
                (_, Some("claimed" | "unconfirmed")) => Some("unconfirmed"),
                // A claimed packet with no corresponding prompt is the old
                // packet-before-prompt crash window; it is uncertain too.
                ("claimed" | "unconfirmed", None) => Some("unconfirmed"),
                _ => None,
            };
            if let Some(next) = next.filter(|next| *next != packet_state) {
                changed += conn.execute(
                    "UPDATE review_packets SET state = ?2, updated_at = ?3
                     WHERE packet_id = ?1",
                    params![packet_id, next, now_millis()],
                )?;
            }
        }
        Ok(changed)
    }
}
fn get_git_preview_locked(
    conn: &Connection,
    preview_id: &str,
) -> anyhow::Result<Option<GitPreviewRow>> {
    conn.query_row(
        "SELECT preview_id, operation, workspace_id, paths_json, status_fingerprint,
                message_digest, message, expires_at, consumed, created_at
         FROM git_previews WHERE preview_id = ?1",
        params![preview_id],
        |row| {
            Ok(GitPreviewRow {
                preview_id: row.get(0)?,
                operation: row.get(1)?,
                workspace_id: row.get(2)?,
                paths_json: row.get(3)?,
                status_fingerprint: row.get(4)?,
                message_digest: row.get(5)?,
                message: row.get(6)?,
                expires_at: row.get(7)?,
                consumed: row.get::<_, i32>(8)? != 0,
                created_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn get_review_comment_locked(
    conn: &Connection,
    workspace_id: &str,
    comment_id: &str,
) -> anyhow::Result<Option<ReviewComment>> {
    let json = conn
        .query_row(
            "SELECT comment_json FROM review_comments
             WHERE workspace_id = ?1 AND comment_id = ?2",
            params![workspace_id, comment_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    json.map(|json| serde_json::from_str(&json).map_err(Into::into))
        .transpose()
}

fn get_review_packet_locked(
    conn: &Connection,
    packet_id: &str,
) -> anyhow::Result<Option<ReviewPacketRow>> {
    let row = conn
        .query_row(
            "SELECT packet_json, state, created_at, updated_at
             FROM review_packets WHERE packet_id = ?1",
            params![packet_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()?;
    row.map(|(json, state, created_at, updated_at)| {
        Ok(ReviewPacketRow {
            packet: serde_json::from_str(&json)?,
            state,
            created_at,
            updated_at,
        })
    })
    .transpose()
}
