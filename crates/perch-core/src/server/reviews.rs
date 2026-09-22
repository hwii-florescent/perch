//! `review.*` arm bodies, the `spawn_review_*` functions, and the review
//! delivery settling helpers. Pure move from `server.rs` — see the
//! refactor plan's Phase 3. No logic changed.
//!
//! `route_git_review_request`, `git_error_response`, and
//! `resolve_git_target_or_fail` (review diffing resolves a git workspace
//! target too) come from `git.rs`/`mod.rs` via the normal privacy rules —
//! see git.rs's module doc. `settle_review_packet_from_db` stays
//! pub(super): mod.rs's still-resident review_delivery_tests module calls
//! it directly. `resolve_review_target`, `review_snapshot_revision`, and
//! `prompt_payload_digest` live in session.rs (already pub(super) there,
//! Phase 3's session.rs commit) and are imported by name below.

use super::*;
use session::{prompt_payload_digest, resolve_review_target, review_snapshot_revision};

fn review_error_response(request_id: String, error: review::ReviewError) -> ServerMessage {
    request_error(
        Some(request_id),
        Some("review_invalid".to_string()),
        error.to_string(),
        false,
    )
}

fn spawn_review_list(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        match app.db.list_review_comments(&workspace_id, 4096) {
            Ok(comments) => {
                let _ = out_tx.send(ServerMessage::ReviewListResult {
                    request_id,
                    workspace_id,
                    comments,
                });
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_list_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_review_create(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    id: String,
    session_id: Option<String>,
    agent_id: Option<String>,
    path: String,
    base: source_control::DiffTarget,
    base_revision: String,
    side: ReviewSide,
    range: review::LineRange,
    body: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let source = match app
            .git
            .review_source(&target, &base, &path, side.label())
            .await
        {
            Ok(source) => source,
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
                return;
            }
        };
        if source.revision != base_revision {
            fail(
                &out_tx,
                request_id,
                "review_stale_source",
                "the source changed since this line was shown; refresh the diff before commenting",
                true,
            );
            return;
        }
        let draft = ReviewCommentDraft {
            id,
            workspace_id: workspace_id.clone(),
            session_id,
            agent_id,
            path,
            base,
            base_revision,
            side,
            range,
            body,
        };
        let comment = match review::create_comment(draft, &source.lines, wall_clock_millis()) {
            Ok(comment) => comment,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        if let Err(error) = app.db.insert_review_comment(&comment) {
            fail(
                &out_tx,
                request_id,
                "review_create_failed",
                error.to_string(),
                true,
            );
            return;
        }
        let _ = out_tx.send(ServerMessage::ReviewCommentResult {
            request_id,
            workspace_id,
            comment,
        });
    });
}

fn spawn_review_update(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    body: String,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let Some(comment) = (match app.db.get_review_comment(&workspace_id, &comment_id) {
            Ok(comment) => comment,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_get_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_not_found",
                "review comment was not found",
                false,
            );
            return;
        };
        if comment.version != expected_version {
            fail(
                &out_tx,
                request_id,
                "review_conflict",
                "review comment changed; refresh before editing",
                true,
            );
            return;
        }
        let next = match review::edit_comment(&comment, body, wall_clock_millis()) {
            Ok(next) => next,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        match app
            .db
            .update_review_comment(&workspace_id, &comment_id, expected_version, &next)
        {
            Ok(ReviewUpdateResult::Updated(comment)) => {
                let _ = out_tx.send(ServerMessage::ReviewCommentResult {
                    request_id,
                    workspace_id,
                    comment,
                });
            }
            Ok(ReviewUpdateResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before editing",
                    true,
                );
            }
            Ok(ReviewUpdateResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_update_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

fn spawn_review_resolve(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    resolved: bool,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let Some(comment) = (match app.db.get_review_comment(&workspace_id, &comment_id) {
            Ok(comment) => comment,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_get_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_not_found",
                "review comment was not found",
                false,
            );
            return;
        };
        if comment.version != expected_version {
            fail(
                &out_tx,
                request_id,
                "review_conflict",
                "review comment changed; refresh before updating",
                true,
            );
            return;
        }
        let next = review::set_comment_resolved(&comment, resolved, wall_clock_millis());
        match app
            .db
            .update_review_comment(&workspace_id, &comment_id, expected_version, &next)
        {
            Ok(ReviewUpdateResult::Updated(comment)) => {
                let _ = out_tx.send(ServerMessage::ReviewCommentResult {
                    request_id,
                    workspace_id,
                    comment,
                });
            }
            Ok(ReviewUpdateResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before updating",
                    true,
                );
            }
            Ok(ReviewUpdateResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_update_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

fn spawn_review_delete(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        match app
            .db
            .delete_review_comment(&workspace_id, &comment_id, expected_version)
        {
            Ok(ReviewDeleteResult::Deleted) => {
                let _ = out_tx.send(ServerMessage::ReviewDeleteResult {
                    request_id,
                    workspace_id,
                    comment_id,
                    deleted: true,
                });
            }
            Ok(ReviewDeleteResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before deleting",
                    true,
                );
            }
            Ok(ReviewDeleteResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delete_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_review_batch_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    send_operation_id: String,
    target_session_id: Option<String>,
    target_agent_id: Option<String>,
    current_revision: String,
    instruction: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        // Resolve the Git target and the destination before reading or
        // inserting any packet row. A packet for a missing/mismatched session
        // is not useful durable work and must never become an orphaned send.
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let (target_session_id, target_agent) = match resolve_review_target(
            &app,
            &workspace_id,
            target_session_id.as_deref(),
            target_agent_id.as_deref(),
        ) {
            Ok(target) => target,
            Err(message) => {
                fail(&out_tx, request_id, "review_target_invalid", message, false);
                return;
            }
        };
        let comments = match app.db.list_review_comments(&workspace_id, 4096) {
            Ok(comments) => comments,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_list_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        };
        let unresolved = comments
            .iter()
            .filter(|comment| matches!(comment.status, review::ReviewStatus::Unresolved))
            .count();
        if unresolved == 0 {
            let _ = out_tx.send(review_error_response(
                request_id,
                review::ReviewError::NoUnresolvedComments,
            ));
            return;
        }

        // Re-read every source represented by an unresolved comment. The
        // caller's revision is only an expectation: it can never authorize a
        // stale anchor or substitute for the server-owned bytes.
        let mut refreshed_comments = Vec::with_capacity(unresolved);
        let mut source_entries = Vec::with_capacity(unresolved);
        for comment in comments
            .into_iter()
            .filter(|comment| matches!(comment.status, review::ReviewStatus::Unresolved))
        {
            let source = match app
                .git
                .review_source(&target, &comment.base, &comment.path, comment.side.label())
                .await
            {
                Ok(source) => source,
                Err(error) => {
                    let _ = out_tx.send(git_error_response(request_id, error));
                    return;
                }
            };
            let refreshed = if source.revision == comment.base_revision {
                comment
            } else {
                let (candidate, result) = match review::reanchor_comment(
                    &comment,
                    &source.lines,
                    &source.revision,
                    wall_clock_millis(),
                ) {
                    Ok(result) => result,
                    Err(error) => {
                        let _ = out_tx.send(review_error_response(request_id, error));
                        return;
                    }
                };
                match result.state {
                    review::ReanchorState::Exact | review::ReanchorState::Reanchored => {
                        match app.db.update_review_comment(
                            &comment.workspace_id,
                            &comment.id,
                            comment.version,
                            &candidate,
                        ) {
                            Ok(crate::db::ReviewUpdateResult::Updated(_)) => candidate,
                            Ok(crate::db::ReviewUpdateResult::Conflict(_)) => {
                                fail(&out_tx, request_id, "review_conflict", "review comment changed while preparing the packet; refresh and try again", true);
                                return;
                            }
                            Ok(crate::db::ReviewUpdateResult::NotFound) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_not_found",
                                    "review comment was removed while preparing the packet",
                                    false,
                                );
                                return;
                            }
                            Err(error) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_reanchor_failed",
                                    error.to_string(),
                                    true,
                                );
                                return;
                            }
                        }
                    }
                    review::ReanchorState::Ambiguous
                    | review::ReanchorState::Stale
                    | review::ReanchorState::Orphaned => {
                        // Persist the explicit stale/orphaned state so every
                        // reconnect shows the same safe decision. It is never
                        // silently folded into a packet at an unrelated line.
                        match app.db.update_review_comment(
                            &comment.workspace_id,
                            &comment.id,
                            comment.version,
                            &candidate,
                        ) {
                            Ok(ReviewUpdateResult::Updated(_)) => {}
                            Ok(ReviewUpdateResult::Conflict(_)) => {
                                fail(&out_tx, request_id, "review_conflict", "review comment changed while recording its stale anchor; refresh and try again", true);
                                return;
                            }
                            Ok(ReviewUpdateResult::NotFound) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_not_found",
                                    "review comment was removed while recording its stale anchor",
                                    false,
                                );
                                return;
                            }
                            Err(error) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_reanchor_failed",
                                    error.to_string(),
                                    true,
                                );
                                return;
                            }
                        }
                        fail(&out_tx, request_id, "review_stale_anchor", "a review anchor no longer identifies the same source; refresh the diff and move the comment deliberately", true);
                        return;
                    }
                }
            };
            let base = serde_json::to_string(&refreshed.base).unwrap_or_default();
            source_entries.push((
                refreshed.id.clone(),
                base,
                refreshed.path.clone(),
                refreshed.side.label().to_string(),
                refreshed.base_revision.clone(),
            ));
            refreshed_comments.push(refreshed);
        }
        // `git.diff.result.sourceRevision` is the digest of every visible
        // source in that diff, while this packet revision is the digest of
        // the exact comment sources (including their ids and target metadata).
        // They intentionally have different domains: a diff may contain more
        // files/sides than the unresolved comments, and comments may retain
        // anchors from more than one selected target. The source re-read above
        // already verifies each comment's server-owned revision and performs
        // safe re-anchoring when it changed, so comparing the two digests here
        // would reject an otherwise valid packet on every normal UI flow.
        let _ = current_revision;
        let canonical_revision = review_snapshot_revision(source_entries);
        let packet = match review::build_batch_packet(review::ReviewBatchRequest {
            send_operation_id,
            workspace_id,
            target_session_id: Some(target_session_id),
            target_agent_id: Some(target_agent),
            current_revision: canonical_revision,
            instruction,
            comments: refreshed_comments,
        }) {
            Ok(packet) => packet,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        if let Err(error) = app.db.insert_review_packet(&packet, wall_clock_millis()) {
            fail(
                &out_tx,
                request_id,
                "review_packet_failed",
                error.to_string(),
                true,
            );
            return;
        }
        let _ = out_tx.send(ServerMessage::ReviewBatchPreviewResult { request_id, packet });
    });
}

pub(super) fn review_delivery_result(
    request_id: String,
    row: crate::db::ReviewPacketRow,
) -> ServerMessage {
    ServerMessage::ReviewBatchSendResult {
        request_id,
        workspace_id: row.packet.workspace_id.clone(),
        packet_id: row.packet.packet_id.clone(),
        send_operation_id: row.packet.send_operation_id.clone(),
        delivery: row.state,
        target_session_id: row.packet.target_session_id.clone(),
        target_agent_id: row.packet.target_agent_id.clone(),
    }
}

/// Apply a durable prompt outcome to its review packet and return the packet
/// row. The database method updates both rows in one transaction; this helper
/// keeps the server from ever reporting a packet state based on a failed or
/// partial write.
fn settle_review_packet_from_prompt(
    app: &AppState,
    packet_id: &str,
    send_operation_id: &str,
    workspace_id: &str,
    prompt_state: &str,
) -> Result<crate::db::ReviewPacketRow, String> {
    settle_review_packet_from_db(
        &app.db,
        packet_id,
        send_operation_id,
        workspace_id,
        prompt_state,
    )
}

/// Testable DB-only half of [`settle_review_packet_from_prompt`]. Keeping the
/// state decision independent from the connection/runtime lets the retry race
/// be exercised with a temporary SQLite fixture, without constructing a live
/// WebSocket application state or starting a provider process.
pub(super) fn settle_review_packet_from_db(
    db: &HistoryDb,
    packet_id: &str,
    send_operation_id: &str,
    workspace_id: &str,
    prompt_state: &str,
) -> Result<crate::db::ReviewPacketRow, String> {
    let settlement = match prompt_state {
        "delivered" => "delivered",
        // A claimed prompt crossed the launch boundary, but a caller cannot
        // prove provider acceptance from the row alone. Preserve it as an
        // unconfirmed outbox item until the owning dispatch settles it.
        "unconfirmed" => "unconfirmed",
        "claimed" => {
            // A live retry may observe the original sender after it has
            // claimed the operation but before provider acceptance. Leave
            // that in-flight state untouched; only startup recovery or a
            // verified launch failure may convert it to unconfirmed.
            return db
                .get_review_packet(packet_id)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "review packet disappeared while settling delivery".to_string());
        }
        // Queued is a live pre-claim state. A normal retry can observe it
        // between reserve and claim, so changing it to unconfirmed here
        // could steal the only dispatch winner from the original caller.
        "queued" => {
            return db
                .get_review_packet(packet_id)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "review packet disappeared while settling delivery".to_string());
        }
        other => return Err(format!("invalid prompt operation state {other:?}")),
    };
    db.settle_prompt_dispatch(send_operation_id, settlement, wall_clock_millis())
        .map_err(|error| error.to_string())?;
    let packet = db
        .get_review_packet(packet_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "review packet disappeared while settling delivery".to_string())?;
    if packet.packet.send_operation_id != send_operation_id
        || packet.packet.workspace_id != workspace_id
    {
        return Err(
            "review packet changed workspace or operation while settling delivery".to_string(),
        );
    }
    Ok(packet)
}

fn spawn_review_batch_send(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    packet_id: String,
    send_operation_id: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    let state = state.clone();
    tokio::spawn(async move {
        let Some(row) = (match app.db.get_review_packet(&packet_id) {
            Ok(row) => row,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_packet_not_found",
                "review packet was not found",
                false,
            );
            return;
        };
        if row.packet.workspace_id != workspace_id
            || row.packet.send_operation_id != send_operation_id
        {
            fail(
                &out_tx,
                request_id,
                "review_packet_mismatch",
                "review packet does not belong to this workspace or operation",
                false,
            );
            return;
        }

        // A prompt operation may have settled before the packet update (for
        // example, a process died between those two durable writes). Repair
        // the packet from that source of truth before deciding whether to
        // dispatch anything.
        match app.db.get_prompt_operation(&send_operation_id) {
            Ok(Some(prompt)) if matches!(prompt.state.as_str(), "delivered" | "unconfirmed") => {
                match settle_review_packet_from_prompt(
                    &app,
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    &prompt.state,
                ) {
                    Ok(row) if matches!(row.state.as_str(), "delivered" | "unconfirmed") => {
                        let _ = out_tx.send(review_delivery_result(request_id, row));
                        return;
                    }
                    Ok(_) => {}
                    Err(error) => {
                        fail(
                            &out_tx,
                            request_id,
                            "review_delivery_persistence_failed",
                            error,
                            false,
                        );
                        return;
                    }
                }
            }
            Ok(Some(_)) | Ok(None) => {}
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delivery_persistence_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }
        let row = match app.db.get_review_packet(&packet_id) {
            Ok(Some(row)) => row,
            Ok(None) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_not_found",
                    "review packet was not found",
                    false,
                );
                return;
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        };
        if matches!(row.state.as_str(), "delivered" | "unconfirmed") {
            let _ = out_tx.send(review_delivery_result(request_id, row));
            return;
        }
        if row.state == "claimed" {
            // A claimed packet without a settled prompt is the crash window
            // between the two durable reservations. It cannot be safely
            // replayed, even if the prompt row is still queued.
            let result = match app.db.get_prompt_operation(&send_operation_id) {
                Ok(Some(prompt)) if prompt.state == "queued" || prompt.state == "claimed" => {
                    // The prompt may still be between reservation and its
                    // CAS claim on the original sender. Leave both rows
                    // untouched; the winner must retain the right to launch.
                    match app.db.get_review_packet(&packet_id) {
                        Ok(Some(row)) => Ok(row),
                        Ok(None) => {
                            Err("review packet disappeared while settling delivery".to_string())
                        }
                        Err(error) => Err(error.to_string()),
                    }
                }
                Ok(Some(prompt)) => settle_review_packet_from_prompt(
                    &app,
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    &prompt.state,
                ),
                Ok(None) => match app.db.set_review_packet_state(
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    "unconfirmed",
                    wall_clock_millis(),
                ) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => {
                        Err("review packet disappeared while settling delivery".to_string())
                    }
                    Err(error) => Err(error.to_string()),
                },
                Err(error) => Err(error.to_string()),
            };
            match result {
                Ok(row) => {
                    let _ = out_tx.send(review_delivery_result(request_id, row));
                }
                Err(error) => {
                    fail(
                        &out_tx,
                        request_id,
                        "review_delivery_persistence_failed",
                        error,
                        false,
                    );
                }
            }
            return;
        }

        let (session_id, agent) = match resolve_review_target(
            &app,
            &workspace_id,
            row.packet.target_session_id.as_deref(),
            row.packet.target_agent_id.as_deref(),
        ) {
            Ok(target) => target,
            Err(message) => {
                fail(&out_tx, request_id, "review_target_invalid", message, false);
                return;
            }
        };
        let Some(session) = (match app.db.get_session(&session_id) {
            Ok(session) => session,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_target_invalid",
                    error.to_string(),
                    false,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_target_invalid",
                "target session was not found",
                false,
            );
            return;
        };
        // Route by what owns the session, not by what the provider *can* do.
        // `native_ui::supported` is true for claude and codex, so keying on it
        // alone sent a Hosted session's packet down the native path, where the
        // write went to a CLI that does not exist and delivery never settled —
        // the UI sat on "Waiting for the agent…" forever. A session with no
        // `cli_provider_id` is Hosted and takes the ordinary prompt path.
        if session.cli_provider_id.is_some() && crate::native_ui::supported(&agent) {
            native_ui::send_review(&state, request_id, row, &session_id, &agent).await;
            return;
        }
        let agent = match agent.as_str() {
            "claude" => AgentKind::Claude,
            "codex" => AgentKind::Codex,
            // Reachable now that routing keys on ownership rather than on
            // provider capability: `target_agent_id` comes from the client,
            // and a Hosted session can name any provider the target check
            // allows. Only claude and codex have a hosted runner, so this is
            // a client error, never a panic.
            other => {
                fail(
                    &out_tx,
                    request_id,
                    "review_target_invalid",
                    format!("{other} has no hosted runner; start its CLI in this session to send review notes."),
                    false,
                );
                return;
            }
        };
        let payload_digest = prompt_payload_digest(
            &session_id,
            Some(&workspace_id),
            &session.host_id,
            &session.cwd,
            &row.packet.markdown,
            agent,
            None,
            false,
            None,
            &[],
        );
        let (prompt, _) = match app.db.reserve_prompt_operation(
            &send_operation_id,
            &session_id,
            Some(&workspace_id),
            &payload_digest,
            &row.packet.markdown,
            Some(agent_str(agent)),
            None,
        ) {
            Ok(result) => result,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_prompt_rejected",
                    error.to_string(),
                    false,
                );
                return;
            }
        };
        if matches!(prompt.state.as_str(), "delivered" | "unconfirmed") {
            match settle_review_packet_from_prompt(
                &app,
                &packet_id,
                &send_operation_id,
                &workspace_id,
                &prompt.state,
            ) {
                Ok(row) => {
                    let _ = out_tx.send(review_delivery_result(request_id, row));
                }
                Err(error) => {
                    fail(
                        &out_tx,
                        request_id,
                        "review_delivery_persistence_failed",
                        error,
                        false,
                    );
                }
            }
            return;
        }

        // Reserve the prompt first. If the process exits after the packet is
        // claimed but before the normal chat path claims this operation,
        // startup reconciliation marks both rows unconfirmed and a retry can
        // never launch a duplicate provider turn.
        let Some((claimed, won)) = (match app.db.claim_review_packet(
            &packet_id,
            &send_operation_id,
            &workspace_id,
            wall_clock_millis(),
        ) {
            Ok(result) => result,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_packet_not_found",
                "review packet was not found",
                false,
            );
            return;
        };
        if !won {
            let _ = out_tx.send(review_delivery_result(request_id, claimed));
            return;
        }
        let chat_session_id = session_id.clone();
        let chat_text = claimed.packet.markdown.clone();
        // The normal chat path owns prompt reservation, provider launch, and
        // session routing. Reuse it with the packet's send operation id so a
        // retry cannot create a second user message or provider turn.
        let chat = ClientMessage::ChatSend {
            session_id,
            text: claimed.packet.markdown.clone(),
            operation_id: Some(claimed.packet.send_operation_id.clone()),
            agent,
            model: None,
            plan_mode: false,
            effort: None,
            attachments: None,
        };
        // `handle_message` only needs the raw JSON for hub routing. Supplying
        // the complete wire payload keeps a remote session from receiving an
        // empty prompt while preserving the typed local path.
        let raw_chat = serde_json::json!({
            "type": "chat.send",
            "sessionId": chat_session_id,
            "text": chat_text,
            "operationId": send_operation_id,
            "agent": agent_str(agent),
        })
        .to_string();
        handle_message(&state, chat, &raw_chat);
        tokio::task::yield_now().await;
        // The normal path settles the prompt when its dispatch task is
        // accepted. Until that durable outcome is visible, report the packet
        // as claimed; a later retry will observe the same row and never start
        // another provider process. A queued prompt here means the typed path
        // rejected the target before claiming it, so preserve uncertainty
        // rather than claiming delivery.
        let result = match app.db.get_prompt_operation(&send_operation_id) {
            Ok(Some(prompt)) if prompt.state == "claimed" => {
                match app.db.get_review_packet(&packet_id) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => Err("review packet disappeared while dispatching".to_string()),
                    Err(error) => Err(error.to_string()),
                }
            }
            Ok(Some(prompt)) if prompt.state == "queued" => {
                // A queued operation is provably pre-dispatch. It can be
                // claimed by the original sender after this retry observes
                // it, so do not convert it into a terminal state.
                match app.db.get_review_packet(&packet_id) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => {
                        Err("review packet disappeared while dispatching review packet".to_string())
                    }
                    Err(error) => Err(error.to_string()),
                }
            }
            Ok(Some(prompt)) => settle_review_packet_from_prompt(
                &app,
                &packet_id,
                &send_operation_id,
                &workspace_id,
                &prompt.state,
            ),
            Ok(None) => {
                Err("prompt operation disappeared while dispatching review packet".to_string())
            }
            Err(error) => Err(error.to_string()),
        };
        match result {
            Ok(row) => {
                let _ = out_tx.send(review_delivery_result(request_id, row));
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delivery_persistence_failed",
                    error,
                    false,
                );
            }
        }
    });
}

pub(super) fn handle_review_list(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_list(state, request_id, workspace_id);
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_review_create(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    id: String,
    session_id: Option<String>,
    agent_id: Option<String>,
    path: String,
    base: source_control::DiffTarget,
    base_revision: String,
    side: crate::review::ReviewSide,
    range: crate::review::LineRange,
    body: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_create(
        state,
        request_id,
        workspace_id,
        id,
        session_id,
        agent_id,
        path,
        base,
        base_revision,
        side,
        range,
        body,
    );
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_review_update(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    comment_id: String,
    body: String,
    expected_version: u64,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_update(
        state,
        request_id,
        workspace_id,
        comment_id,
        body,
        expected_version,
    );
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_review_resolve(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    comment_id: String,
    resolved: bool,
    expected_version: u64,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_resolve(
        state,
        request_id,
        workspace_id,
        comment_id,
        resolved,
        expected_version,
    );
}

pub(super) fn handle_review_delete(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    comment_id: String,
    expected_version: u64,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_delete(
        state,
        request_id,
        workspace_id,
        comment_id,
        expected_version,
    );
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_review_batch_preview(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    send_operation_id: String,
    target_session_id: Option<String>,
    target_agent_id: Option<String>,
    current_revision: String,
    instruction: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_batch_preview(
        state,
        request_id,
        workspace_id,
        send_operation_id,
        target_session_id,
        target_agent_id,
        current_revision,
        instruction,
    );
}

pub(super) fn handle_review_batch_send(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    packet_id: String,
    send_operation_id: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_review_batch_send(
        state,
        request_id,
        workspace_id,
        packet_id,
        send_operation_id,
    );
}
