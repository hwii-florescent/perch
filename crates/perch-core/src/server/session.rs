//! `session.*`/`chat.*`/`commands.*` arm bodies, plus the turn
//! lifecycle helpers they share (prompt dispatch reservation/settlement,
//! runtime bookkeeping, agent-event forwarding, and CLI title capture).
//! Pure move from `server.rs` — see the refactor plan's Phase 3. No
//! logic changed.
//!
//! `SessionRuntime`/`PendingTurn` stay in mod.rs on purpose: `ConnState`
//! (mod.rs) holds a `Mutex<HashMap<String, SessionRuntime>>` field, and
//! terminal.rs (a sibling module, already extracted) reads SessionRuntime
//! fields directly (`.claude_runner`, `.cwd`, `.host_id`,
//! `.last_codex_runner`) — moving the struct here would need every field
//! widened to pub(super) for terminal.rs to keep compiling, for no benefit.
//! This module still constructs/reads them freely: the type (defined in
//! the parent module) and its default-private fields are already visible
//! to every descendant of `server`, this module included.
//!
//! pub(super): agent_str, settle_prompt_dispatch, local_sessions_snapshot,
//! build_session_summary, mark_unseen_if_unviewed, should_forward_to_viewer,
//! status_message (mod.rs's DetachedSink/handle_socket/background tasks
//! and still-resident test modules call these directly — confirmed with
//! `cargo build --tests`); resolve_review_target, review_snapshot_revision,
//! prompt_payload_digest (reviews.rs, a sibling module, calls these too).

use super::*;

fn operation_id_or_new(operation_id: Option<String>) -> String {
    operation_id
        .filter(|operation_id| !operation_id.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

/// Digest every input that can change the provider turn. The digest is stored
/// with the operation id so a reconnect cannot reuse an id for a different
/// session, provider, model, mode, or attachment set.
#[allow(clippy::too_many_arguments)]
pub(super) fn prompt_payload_digest(
    session_id: &str,
    workspace_id: Option<&str>,
    host_id: &str,
    cwd: &str,
    text: &str,
    agent: AgentKind,
    model: Option<&str>,
    plan_mode: bool,
    effort: Option<&str>,
    attachments: &[String],
) -> String {
    let payload = (
        session_id,
        workspace_id,
        host_id,
        cwd,
        text,
        agent_str(agent),
        model,
        plan_mode,
        effort,
        attachments,
    );
    let encoded = serde_json::to_vec(&payload).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Reserve and claim one prompt before any provider process is started. A
/// duplicate operation in a terminal or unconfirmed state returns `None` and
/// must never launch another provider process.
#[allow(clippy::too_many_arguments)]
fn reserve_and_claim_prompt(
    app: &AppState,
    operation_id: &str,
    session_id: &str,
    workspace_id: Option<&str>,
    payload_digest: &str,
    text: &str,
    agent: AgentKind,
    model: Option<&str>,
) -> Result<Option<crate::db::PromptClaim>, String> {
    let (reserved, _) = app
        .db
        .reserve_prompt_operation(
            operation_id,
            session_id,
            workspace_id,
            payload_digest,
            text,
            Some(agent_str(agent)),
            model,
        )
        .map_err(|error| error.to_string())?;
    if reserved.state != "queued" {
        return Ok(None);
    }
    let claim = app
        .db
        .claim_prompt_operation(operation_id)
        .map_err(|error| error.to_string())?;
    Ok(claim.filter(|claim| claim.won_claim))
}

fn report_settlement_failure(
    state: &Arc<ConnState>,
    session_id: &str,
    operation_id: &str,
    error: String,
) {
    tracing::error!(
        session_id,
        operation_id,
        error = %error,
        "failed to persist prompt dispatch outcome"
    );
    emit(
        state,
        session_id,
        ServerMessage::Error {
            message: format!("prompt operation {operation_id} could not be settled: {error}"),
            request_id: None,
            code: Some("prompt_dispatch_persistence_failed".to_string()),
            retryable: false,
        },
    );
}

/// Resolve the session and provider named by a review packet. A missing
/// provider is an error instead of silently selecting Claude, because a
/// packet sent to the wrong CLI cannot be recovered by retrying it.
pub(super) fn resolve_review_target(
    app: &AppState,
    workspace_id: &str,
    target_session_id: Option<&str>,
    target_agent_id: Option<&str>,
) -> Result<(String, AgentKind), String> {
    let session_id = target_session_id
        .filter(|session_id| !session_id.trim().is_empty())
        .ok_or_else(|| "a target session is required to send review notes".to_string())?;
    let session = app
        .db
        .get_session(session_id)
        .map_err(|error| format!("could not read target session: {error}"))?
        .ok_or_else(|| "target session was not found".to_string())?;
    if session.workspace_id.as_deref() != Some(workspace_id) {
        return Err("target session does not belong to this workspace".to_string());
    }
    let provider = target_agent_id
        .or(session.last_agent.as_deref())
        .ok_or_else(|| {
            "choose a target provider before sending review notes to a new session".to_string()
        })?;
    let agent = match provider {
        "claude" => AgentKind::Claude,
        "codex" => AgentKind::Codex,
        other => return Err(format!("unsupported target provider {other:?}")),
    };
    Ok((session_id.to_string(), agent))
}

/// Produce a stable aggregate for the exact source selected for each comment.
/// The comment id and target are included so two different source selections
/// cannot collapse to the same review snapshot by accident.
pub(super) fn review_snapshot_revision(
    mut entries: Vec<(String, String, String, String, String)>,
) -> String {
    entries.sort();
    let encoded = serde_json::to_vec(&entries).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Move `state`'s connection to viewing `session_id`: remove it from
/// whichever session it was previously viewing (if different), add it to the
/// new session's viewer set, and clear `unseen_sessions` for the newly-viewed
/// session — a connection actively viewing a session has, by definition,
/// "seen" it. Broadcasts `session.updated` when that clears a real unseen
/// flag so all clients repaint the dot immediately (a no-op broadcast is
/// avoided when there was nothing to clear, e.g. a brand-new blank session).
fn set_active_session(state: &Arc<ConnState>, session_id: &str) {
    let previous = {
        let mut active = state.active_session_id.lock().unwrap();
        let previous = active.clone();
        *active = Some(session_id.to_string());
        previous
    };
    {
        let mut viewers = state.app.session_viewers.lock().unwrap();
        if let Some(prev_id) = previous.as_deref() {
            if prev_id != session_id {
                if let Some(set) = viewers.get_mut(prev_id) {
                    set.remove(&state.conn_id);
                    if set.is_empty() {
                        viewers.remove(prev_id);
                    }
                }
            }
        }
        viewers
            .entry(session_id.to_string())
            .or_default()
            .insert(state.conn_id.clone());
    }
    let was_unseen = state.app.unseen_sessions.lock().unwrap().remove(session_id);
    if was_unseen {
        notify_session_updated(&state.app, session_id);
    }
}

/// Build a fresh `ClaudeRunner` (optionally primed to `--resume` a known
/// claude session id) and register it as the session's runtime for this
/// connection. When `last_agent` is "claude" and `last_model` is Some, the
/// model is restored on the runner so that CLI-mode attach (which reads
/// `claude_runner.model()`) passes the correct `--model` flag even after a
/// server restart — without this, claude would fall back to the dated snapshot
/// id in its transcript (e.g. `claude-haiku-4-5-20251001`), which the GenAI
/// proxy rejects.
fn insert_runtime(
    state: &Arc<ConnState>,
    session_id: &str,
    cwd: &str,
    claude_session_id: Option<String>,
    last_agent: Option<&str>,
    last_model: Option<&str>,
) {
    insert_runtime_on_host(
        state,
        session_id,
        cwd,
        "local",
        claude_session_id,
        last_agent,
        last_model,
    )
}

#[allow(clippy::too_many_arguments)]
fn insert_runtime_on_host(
    state: &Arc<ConnState>,
    session_id: &str,
    cwd: &str,
    host_id: &str,
    claude_session_id: Option<String>,
    last_agent: Option<&str>,
    last_model: Option<&str>,
) {
    let claude_runner = Arc::new(ClaudeRunner::new(ClaudeRunnerOptions {
        cwd: cwd.to_string(),
        claude_bin: None,
        permission_mode: None,
    }));
    if let Some(id) = claude_session_id {
        claude_runner.resume_session(id);
    }
    // Restore the model alias from the DB so that CLI attach after a server
    // restart passes `--model <alias>` rather than letting claude fall back to
    // the dated snapshot id in the transcript. Only applies when the last agent
    // was claude (model aliases are per-agent; codex model is on CodexRunner).
    if last_agent.map(|a| a == "claude").unwrap_or(false) {
        if let Some(model) = last_model {
            claude_runner.set_model(Some(model.to_string()));
        }
    }
    state.runtimes.lock().unwrap().insert(
        session_id.to_string(),
        SessionRuntime {
            cwd: cwd.to_string(),
            host_id: host_id.to_string(),
            claude_runner,
            active_runner: Mutex::new(None),
            last_codex_runner: Mutex::new(None),
            last_usage: LastUsage::default(),
            pending_turn: Mutex::new(None),
        },
    );
}

/// Append a `chat.chunk`'s text to the in-flight turn being accumulated for
/// `session_id`, if any (a no-op once `persist_turn` has taken it — e.g.
/// stray events arriving after cancellation).
fn append_pending_text(state: &Arc<ConnState>, session_id: &str, text: &str) {
    if let Some(runtime) = state.runtimes.lock().unwrap().get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.text.push_str(text);
        }
    }
}

/// Same as [`append_pending_text`] but for `chat.thinking` deltas.
fn append_pending_thinking(state: &Arc<ConnState>, session_id: &str, text: &str) {
    if let Some(runtime) = state.runtimes.lock().unwrap().get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.thinking.push_str(text);
        }
    }
}

/// Record a provider failure on the in-flight operation before the runner's
/// terminal `chat.done` event arrives. This keeps an error from being mistaken
/// for a successful completion when a provider emits both events.
fn mark_pending_prompt_failed(state: &Arc<ConnState>, session_id: &str) {
    let operation_id = {
        let map = state.runtimes.lock().unwrap();
        let Some(runtime) = map.get(session_id) else {
            return;
        };
        let mut pending = runtime.pending_turn.lock().unwrap();
        let Some(turn) = pending.as_mut() else {
            return;
        };
        turn.failed = true;
        turn.operation_id.clone()
    };
    if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, "unconfirmed") {
        report_settlement_failure(state, session_id, &operation_id, error);
    }
}

/// Record positive provider progress on the local in-flight turn. This is
/// separate from the durable settlement call because a tool-only turn can
/// have no assistant text when its terminal `Done` event arrives.
fn mark_pending_prompt_accepted(state: &Arc<ConnState>, session_id: &str) {
    let map = state.runtimes.lock().unwrap();
    if let Some(runtime) = map.get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.accepted = true;
        }
    }
}

/// Mirror the claude runner's current internal session id into the `sessions`
/// row so a later `session.resume` (possibly after a server restart) can
/// pass it to `--resume`. Harmless no-op for codex-only turns (it just
/// re-writes whatever claude id, if any, this runtime already had).
fn persist_claude_session_id(state: &Arc<ConnState>, session_id: &str) {
    let claude_session_id = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id)
            .and_then(|r| r.claude_runner.claude_session_id())
    };
    if let Some(id) = claude_session_id {
        let _ = state.app.db.set_claude_session_id(session_id, &id);
    }
}

/// Mirror the most recently used codex runner's `thread_id` (if any) into the
/// `sessions` row, so a later CLI-mode attach can `codex resume` it. No-op
/// for turns that didn't use codex, or haven't seen a `thread.started` event
/// yet.
fn persist_codex_thread_id(state: &Arc<ConnState>, session_id: &str) {
    let thread_id = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id).and_then(|r| {
            r.last_codex_runner
                .lock()
                .unwrap()
                .as_ref()
                .and_then(|r| r.thread_id())
        })
    };
    if let Some(id) = thread_id {
        let _ = state.app.db.set_codex_thread_id(session_id, &id);
    }
}

fn update_last_usage(state: &Arc<ConnState>, session_id: &str, usage: Option<&ChatUsage>) {
    let Some(usage) = usage else { return };
    if let Some(runtime) = state.runtimes.lock().unwrap().get_mut(session_id) {
        runtime.last_usage = LastUsage {
            context_tokens: Some(usage.context_tokens),
            cost_usd: Some(usage.cost_usd),
        };
    }
}

fn handle_agent_event(state: &Arc<ConnState>, session_id: &str, event: AgentEvent) {
    match event {
        AgentEvent::Chunk(text) => {
            append_pending_text(state, session_id, &text);
            emit(
                state,
                session_id,
                ServerMessage::ChatChunk {
                    session_id: session_id.to_string(),
                    text,
                },
            );
        }
        AgentEvent::Thinking(text) => {
            append_pending_thinking(state, session_id, &text);
            emit(
                state,
                session_id,
                ServerMessage::ChatThinking {
                    session_id: session_id.to_string(),
                    text,
                },
            );
        }
        AgentEvent::ToolUse { name, input } => emit(
            state,
            session_id,
            ServerMessage::ChatToolUse {
                session_id: session_id.to_string(),
                name,
                input,
            },
        ),
        AgentEvent::ToolResult { name, result } => emit(
            state,
            session_id,
            ServerMessage::ChatToolResult {
                session_id: session_id.to_string(),
                name,
                result,
            },
        ),
        AgentEvent::Plan { content } => emit(
            state,
            session_id,
            ServerMessage::ChatPlan {
                session_id: session_id.to_string(),
                content,
            },
        ),
        AgentEvent::Done(usage) => {
            update_last_usage(state, session_id, usage.as_ref());
            persist_turn(state, session_id);
            persist_claude_session_id(state, session_id);
            persist_codex_thread_id(state, session_id);
            emit(
                state,
                session_id,
                ServerMessage::ChatDone {
                    session_id: session_id.to_string(),
                    usage,
                },
            );
            let (cwd, last_usage) = {
                let map = state.runtimes.lock().unwrap();
                map.get(session_id)
                    .map(|r| (r.cwd.clone(), r.last_usage.clone()))
                    .unwrap_or_default()
            };
            emit(
                state,
                session_id,
                status_message(get_status(&cwd, Some(&last_usage))),
            );
            // Turn complete — mark idle, mark unseen if no one is watching
            // (herdr's `done` state), and broadcast to all connections.
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
            notify_session_updated(&state.app, session_id);
        }
        AgentEvent::Error(message) => {
            // Error also ends the turn — ensure running status can't get stuck.
            mark_pending_prompt_failed(state, session_id);
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
            notify_session_updated(&state.app, session_id);
            emit(
                state,
                session_id,
                ServerMessage::Error {
                    message,
                    request_id: None,
                    code: None,
                    retryable: false,
                },
            );
        }
    }
}

/// Create a session that lives in *this* DB but runs on a direct host.
///
/// Deliberately does **not** validate the cwd: doing so would cost an ssh
/// round trip on the message loop for every new session, and the cwd is
/// already chosen from the remote directory browser (`fs.browse` over ssh).
/// A bad path fails on the first turn with the remote shell's own message.
fn create_direct_session(
    state: &Arc<ConnState>,
    host: &crate::hosts::SshHost,
    cwd: Option<String>,
) {
    let Some(cwd) = cwd.filter(|c| !c.trim().is_empty()) else {
        let _ = state.out_tx.send(ServerMessage::Error {
            message: format!("pick a directory on {} to start a session there", host.name),
            request_id: None,
            code: None,
            retryable: false,
        });
        return;
    };
    let session_id = Uuid::new_v4().to_string();
    state.app.registry.create(&session_id, &cwd);
    insert_runtime_on_host(state, &session_id, &cwd, &host.id, None, None, None);
    set_active_session(state, &session_id);
    let _ = state.out_tx.send(ServerMessage::SessionCreated {
        session_id: session_id.clone(),
    });
}

fn emit(state: &Arc<ConnState>, session_id: &str, message: ServerMessage) {
    state.app.registry.record(session_id, message.clone());
    let _ = state.out_tx.send(message);
}

/// Write the accumulated assistant reply for the just-finished turn to
/// SQLite as one `messages` row, then clear the pending-turn slot. Turns
/// that produced no text and no thinking (e.g. an immediate spawn failure)
/// aren't persisted — there's nothing worth showing on resume.
fn persist_turn(state: &Arc<ConnState>, session_id: &str) {
    let turn = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id)
            .and_then(|r| r.pending_turn.lock().unwrap().take())
    };
    let Some(turn) = turn else { return };
    let operation_id = turn.operation_id.clone();
    let outcome = if turn.accepted && !turn.failed {
        "delivered"
    } else {
        "unconfirmed"
    };
    if turn.text.is_empty() && turn.thinking.is_empty() {
        if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, outcome) {
            tracing::error!(
                session_id,
                operation_id,
                error = %error,
                "failed to persist prompt dispatch outcome"
            );
        }
        return;
    }
    let thinking = if turn.thinking.is_empty() {
        None
    } else {
        Some(turn.thinking.as_str())
    };
    let _ = state.app.db.add_message(
        session_id,
        "assistant",
        &turn.text,
        Some(agent_str(turn.agent)),
        turn.model.as_deref(),
        thinking,
    );
    if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, outcome) {
        tracing::error!(
            session_id,
            operation_id,
            error = %error,
            "failed to persist prompt dispatch outcome"
        );
    }
    // Persist the agent+model so that after a server restart, CLI-mode attach
    // can reconstruct `--model <alias>` from the DB row instead of letting
    // claude fall back to the dated snapshot id in its transcript.
    let _ = state.app.db.update_session_last_model(
        session_id,
        agent_str(turn.agent),
        turn.model.as_deref(),
    );
}

pub(super) fn agent_str(agent: AgentKind) -> &'static str {
    match agent {
        AgentKind::Claude => "claude",
        AgentKind::Codex => "codex",
    }
}

/// Settle a prompt dispatch and, when the operation belongs to a review
/// packet, settle the packet from that same durable outcome. The packet state
/// is never inferred from a socket call returning; it follows the persisted
/// prompt operation instead.
pub(super) fn settle_prompt_dispatch(
    app: &AppState,
    operation_id: &str,
    state: &str,
) -> Result<(), String> {
    app.db
        .settle_prompt_dispatch(operation_id, state, wall_clock_millis())
        .map_err(|error| error.to_string())?;
    if let Some(row) = app
        .db
        .get_review_packet_for_operation(operation_id)
        .map_err(|error| error.to_string())?
    {
        let _ = app
            .hub
            .hub_events_tx
            .send(Arc::new(ServerMessage::ReviewBatchDelivery {
                workspace_id: row.packet.workspace_id,
                packet_id: row.packet.packet_id,
                send_operation_id: row.packet.send_operation_id,
                delivery: row.state,
                host_id: Some("local".to_string()),
                target_session_id: row.packet.target_session_id,
                target_agent_id: row.packet.target_agent_id,
            }));
    }
    Ok(())
}

pub(super) fn local_sessions_snapshot(app: &AppState) -> Vec<SessionSummary> {
    let rows = app.db.list_sessions().unwrap_or_default();
    let running = app.running_sessions.lock().unwrap();
    let unseen = app.unseen_sessions.lock().unwrap();
    let blocked = app.blocked_sessions.lock().unwrap();
    rows.into_iter()
        .map(|row| build_session_summary(row, &running, &unseen, &blocked))
        .collect()
}

/// Build a `SessionSummary` from a DB row and the current running/unseen/
/// blocked snapshots. `unseen`/`blocked` are only meaningful for local
/// sessions — remote summaries are built elsewhere (`hub.rs`) and always
/// report `false` unless the remote itself set them.
pub(super) fn build_session_summary(
    row: crate::db::SessionListRow,
    running: &std::collections::HashSet<String>,
    unseen: &std::collections::HashSet<String>,
    blocked: &std::collections::HashSet<String>,
) -> SessionSummary {
    let status = if running.contains(&row.id) {
        SessionStatus::Running
    } else {
        SessionStatus::Idle
    };
    let last_agent = row.last_agent.as_deref().and_then(|a| match a {
        "claude" => Some(AgentKind::Claude),
        "codex" => Some(AgentKind::Codex),
        _ => None,
    });
    SessionSummary {
        id: row.id.clone(),
        title: row.title,
        cwd: row.cwd,
        created_at: row.created_at,
        last_agent,
        last_model: row.last_model,
        status,
        // Local *storage*, but not necessarily the local *host*: a direct-mode
        // session's row lives here while its cwd and agent live on a remote
        // with no perch of its own, and the sidebar must group it under that
        // host (see `db.rs`'s `sessions.host_id`).
        host_id: row.host_id,
        cli_started: row.cli_started,
        cli_provider_id: row.cli_provider_id,
        archived: row.archived,
        unseen: unseen.contains(&row.id),
        blocked: blocked.contains(&row.id),
        project_id: row.project_id,
        workspace_id: row.workspace_id,
    }
}

/// Called when a turn finishes (`chat.done` or a terminal error) and
/// `session_id` is removed from `running_sessions`. If no connection is
/// currently viewing the session, mark it unseen (herdr's `done` state) so
/// `build_session_summary` reports it on the next broadcast. Callers already
/// broadcast `session.updated` right after removing from `running_sessions`,
/// so this doesn't need to trigger its own notify.
pub(super) fn mark_unseen_if_unviewed(app: &AppState, session_id: &str) {
    let has_viewer = app
        .session_viewers
        .lock()
        .unwrap()
        .get(session_id)
        .map(|set| !set.is_empty())
        .unwrap_or(false);
    if !has_viewer {
        app.unseen_sessions
            .lock()
            .unwrap()
            .insert(session_id.to_string());
    }
}

/// Decide whether a hub-broadcast `ServerMessage` should be forwarded to one
/// particular connection (`conn_id`). Only the per-session *streaming* chat
/// events are session-scoped — everything else (sidebar/host/global state)
/// must reach every connection regardless of what it's viewing, so this
/// defaults to `true` (forward) for any variant not explicitly listed as
/// session-scoped below. A detached (direct-mode) turn broadcasts on
/// `hub_events_tx` to every connection (see `DetachedSink::emit`'s doc
/// comment) because it has no single initiating connection to unicast to;
/// this is the filter that keeps a client watching session A from also
/// receiving session B's live chat frames.
///
/// `viewers` mirrors `AppState::session_viewers`: for each local session id,
/// the set of connection ids currently viewing it. A session with no entry,
/// or an entry with an empty set, has no viewers, so the event is dropped for
/// every connection until someone subscribes — at which point the ring-buffer
/// replay (`SessionRegistry::replay`, see `ClientMessage::SessionSubscribe`)
/// catches the new viewer up on anything already recorded.
pub(super) fn should_forward_to_viewer(
    msg: &ServerMessage,
    conn_id: &str,
    viewers: &HashMap<String, HashSet<String>>,
) -> bool {
    let session_id = match msg {
        ServerMessage::ChatChunk { session_id, .. }
        | ServerMessage::ChatThinking { session_id, .. }
        | ServerMessage::ChatToolUse { session_id, .. }
        | ServerMessage::ChatToolResult { session_id, .. }
        | ServerMessage::ChatDone { session_id, .. }
        | ServerMessage::ChatPlan { session_id, .. } => session_id,
        // `error` (the bare `ServerMessage::Error` variant) carries no
        // session id at all, so it can't be session-scoped-filtered — always
        // forward it. Everything else (session.list/updated/created/deleted,
        // host.info, workspace.git, server.info, terminal.*, settings,
        // hosts.*, commands.list, session.history/layout, fs/worktree
        // replies, …) is global or drives the sidebar, and must reach every
        // connection: fail open by forwarding.
        _ => return true,
    };
    viewers
        .get(session_id)
        .is_some_and(|set| set.contains(conn_id))
}

pub(super) fn status_message(status: crate::status::StatusInfo) -> ServerMessage {
    ServerMessage::StatusUpdate {
        cwd: status.cwd,
        branch: status.branch,
        context_tokens: status.context_tokens,
        cost_usd: status.cost_usd,
    }
}

pub(super) fn handle_session_create(
    state: &Arc<ConnState>,
    cwd: Option<String>,
    host_id: Option<String>,
) {
    // Route to remote host if host_id is set and non-local.
    let target = host_id.as_deref().unwrap_or("local");
    if target != "local" && !target.is_empty() {
        // Direct-mode host: there is no perch on the other end to
        // forward to. The session row lives *here*, tagged with the
        // host id; only the cwd, the agent process and the transcript
        // are remote.
        if let Some(host) = direct_host(state, target) {
            create_direct_session(state, &host, cwd);
            return;
        }
        // Forward a stripped message (no hostId) so the remote creates a
        // local session rather than trying to route further.
        let forward_json = match &cwd {
            Some(c) => format!(
                r#"{{"type":"session.create","cwd":{}}}"#,
                serde_json::to_string(c).unwrap_or_default()
            ),
            None => r#"{"type":"session.create"}"#.to_string(),
        };
        state.app.hub.forward(target, &forward_json);
        return;
    }
    // Local session creation — Fix 2: validate the requested cwd.
    let resolved_cwd = if let Some(raw_cwd) = cwd {
        // Expand a leading `~` to the user's home directory.
        let expanded = if raw_cwd == "~" || raw_cwd.starts_with("~/") {
            let home = std::env::var("HOME").unwrap_or_default();
            if raw_cwd == "~" {
                home
            } else {
                format!("{home}{}", &raw_cwd[1..])
            }
        } else {
            raw_cwd
        };
        // Validate that it's an existing directory.
        if !std::path::Path::new(&expanded).is_dir() {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("cwd is not an existing directory: {expanded}"),
                request_id: None,
                code: None,
                retryable: false,
            });
            return;
        }
        expanded
    } else {
        state.app.default_cwd.clone()
    };
    let session_id = Uuid::new_v4().to_string();
    // Persist the identity before publishing it. Empty sessions stay
    // out of navigation via SESSION_VISIBILITY_FILTER, but their mode
    // overrides and a second viewer must survive reconnect/restart.
    if let Err(error) = state.app.db.create_session(&session_id, &resolved_cwd) {
        fail(
            &state.out_tx,
            None,
            "session_create_failed",
            format!("could not persist session: {error}"),
            true,
        );
        return;
    }
    state.app.registry.create(&session_id, &resolved_cwd);
    insert_runtime(state, &session_id, &resolved_cwd, None, None, None);
    set_active_session(state, &session_id);
    let _ = state.out_tx.send(ServerMessage::SessionCreated {
        session_id: session_id.clone(),
    });
    let _ = state
        .out_tx
        .send(status_message(get_status(&resolved_cwd, None)));
    // Do NOT broadcast session.updated yet — session has no messages,
    // so it won't appear in list_sessions() until the first
    // chat.send or terminal.create agentAttach.
}

pub(super) fn handle_session_resume(state: &Arc<ConnState>, session_id: String) {
    match state.app.db.get_session(&session_id) {
        Ok(Some(row)) => {
            state.app.registry.create(&session_id, &row.cwd);
            insert_runtime_on_host(
                state,
                &session_id,
                &row.cwd,
                &row.host_id,
                row.claude_session_id.clone(),
                row.last_agent.as_deref(),
                row.last_model.as_deref(),
            );
            set_active_session(state, &session_id);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let messages = state.app.db.load_messages(&session_id).unwrap_or_default();
            let _ = state.out_tx.send(ServerMessage::SessionHistory {
                session_id: session_id.clone(),
                messages,
            });
            let _ = state
                .out_tx
                .send(status_message(get_status(&row.cwd, None)));
            notify_session_updated(&state.app, &session_id);
        }
        _ => {
            // Unknown/stale id (fresh machine, cleared DB, server
            // restart lost it — shouldn't happen since we read from
            // SQLite, but be defensive) — behave like session.create:
            // mint a brand-new session with no history.
            let new_id = Uuid::new_v4().to_string();
            let cwd = state.app.default_cwd.clone();
            state.app.registry.create(&new_id, &cwd);
            let _ = state.app.db.create_session(&new_id, &cwd);
            insert_runtime(state, &new_id, &cwd, None, None, None);
            set_active_session(state, &new_id);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: new_id.clone(),
            });
            let _ = state.out_tx.send(status_message(get_status(&cwd, None)));
            notify_session_updated(&state.app, &new_id);
        }
    }
}

pub(super) fn handle_session_mode_get(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    session_id: String,
    device_id: String,
    workspace_id: Option<String>,
) {
    // A remote session owns its mode policy on the remote perch. The
    // request id is registered before forwarding so the hub can route
    // the response back to this exact connection.
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
        return;
    }
    let workspace_id = match mode_workspace_for_session(state, &session_id, workspace_id.as_deref())
    {
        Ok(workspace_id) => workspace_id,
        Err(error) => {
            fail(&state.out_tx, request_id, "unknown_session", error, false);
            return;
        }
    };
    match effective_session_mode(state, &device_id, &session_id, workspace_id.as_deref()) {
        Ok((mode, scope, revision)) => {
            let _ = state.out_tx.send(ServerMessage::SessionMode {
                request_id,
                session_id,
                device_id,
                workspace_id,
                mode: wire_session_mode(mode),
                scope,
                revision,
            });
        }
        Err(error) => {
            fail(&state.out_tx, request_id, "mode_read_failed", error, true);
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_session_mode_set(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    session_id: String,
    device_id: String,
    scope: SessionModeScope,
    workspace_id: Option<String>,
    mode: Option<WireSessionMode>,
    clear_override: bool,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
        return;
    }
    let workspace_id = match mode_workspace_for_session(state, &session_id, workspace_id.as_deref())
    {
        Ok(workspace_id) => workspace_id,
        Err(error) => {
            fail(&state.out_tx, request_id, "unknown_session", error, false);
            return;
        }
    };
    let mutation_revision = match scope {
        SessionModeScope::Session => state.app.agent_persistence.set_session_override(
            &session_id,
            if clear_override {
                None
            } else {
                mode.map(fleet_session_mode)
            },
            now_millis(),
        ),
        SessionModeScope::Workspace => {
            let Some(workspace_id) = workspace_id.as_deref() else {
                fail(
                    &state.out_tx,
                    request_id,
                    "workspace_required",
                    "the session has no server-owned workspace override",
                    false,
                );
                return;
            };
            state.app.agent_persistence.set_workspace_override(
                workspace_id,
                if clear_override {
                    None
                } else {
                    mode.map(fleet_session_mode)
                },
                now_millis(),
            )
        }
        SessionModeScope::Device => match mode.filter(|_| !clear_override) {
            Some(mode) => state.app.agent_persistence.set_device_default(
                &device_id,
                fleet_session_mode(mode),
                now_millis(),
            ),
            None => state.app.agent_persistence.clear_device_default(&device_id),
        },
        SessionModeScope::Default => Err(anyhow::anyhow!(
            "session.mode.set cannot target the default scope"
        )),
    };
    let mutation_revision = match mutation_revision {
        Ok(revision) => revision,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "mode_write_failed",
                error.to_string(),
                true,
            );
            return;
        }
    };
    // The direct result above is device-specific and remains
    // request-correlated. Every other connected client receives only
    // this invalidation and must refetch using its own device id and
    // server-owned precedence chain.
    let _ = state
        .app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::SessionModeInvalidated {
            session_id: session_id.clone(),
            workspace_id: workspace_id.clone(),
            device_id: (scope == SessionModeScope::Device).then_some(device_id.clone()),
            host_id: Some("local".to_string()),
            revision: mutation_revision,
        }));
    let (effective, effective_scope, revision) =
        match effective_session_mode(state, &device_id, &session_id, workspace_id.as_deref()) {
            Ok(result) => result,
            Err(error) => {
                fail(&state.out_tx, request_id, "mode_read_failed", error, true);
                return;
            }
        };
    project_mode_to_lifecycle(state, &session_id, effective, revision);
    let _ = state.out_tx.send(ServerMessage::SessionMode {
        request_id,
        session_id,
        device_id,
        workspace_id,
        mode: wire_session_mode(effective),
        scope: effective_scope,
        revision,
    });
}

pub(super) fn handle_session_subscribe(state: &Arc<ConnState>, raw_text: &str, session_id: String) {
    // If this is a remote session, forward to the remote.
    // Register a unicast BEFORE forwarding so the ring-buffer replay
    // that comes back as session.history hits our out_tx.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    // If the session is currently mid-turn, skip ring-buffer replay —
    // replaying a half-streamed turn into a freshly-switched view would
    // produce a truncated, inconsistent rendering. History up to the
    // last *completed* turn is still accessible via session.resume.
    let is_running = state
        .app
        .running_sessions
        .lock()
        .unwrap()
        .contains(&session_id);
    set_active_session(state, &session_id);
    if !is_running {
        for event in state.app.registry.replay(&session_id) {
            let _ = state.out_tx.send(event);
        }
    }
}

pub(super) fn handle_session_list(state: &Arc<ConnState>) {
    let mut sessions = local_sessions_snapshot(&state.app);
    // Append remote sessions (tagged with their host_id), sorted by
    // host then by createdAt desc within each host.
    let mut remote = state.app.hub.remote_sessions_snapshot();
    remote.sort_by(|a, b| {
        a.host_id
            .cmp(&b.host_id)
            .then(b.created_at.cmp(&a.created_at))
    });
    sessions.extend(remote);
    // Direct send — not recorded into the ring buffer.
    let _ = state.out_tx.send(ServerMessage::SessionList { sessions });
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_chat_send(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: &str,
    text: &str,
    operation_id: &Option<String>,
    agent: AgentKind,
    model: &Option<String>,
    plan_mode: bool,
    effort: &Option<String>,
    attachments: &Option<Vec<String>>,
) {
    // Route remote sessions through the hub.
    if let Some(host_id) = state.app.hub.route_for_session(session_id) {
        // Register a unicast so chat.chunk/done/etc. come back to us.
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.to_string()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    let _agent_operation = state.app.agent_operation_lock.lock().unwrap();
    if state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .iter()
        .any(|snapshot| {
            snapshot.key.session_id == *session_id
                && state.app.agent_runtime.runtime_alive(&snapshot.key)
        })
    {
        fail(
            &state.out_tx,
            None,
            "agent_cli_active",
            "This agent is still running in CLI. Use its terminal, or stop the CLI before starting a Chat turn."
                .to_string(),
            false,
        );
        return;
    }
    // Local chat turn. Resolve the runtime before reserving anything:
    // a guessed session id must not consume an operation id or leave
    // a durable prompt that can never be launched.
    let session_id = session_id.to_string();
    let text = text.to_string();
    let operation_id = operation_id_or_new(operation_id.clone());
    let model = model.clone();
    let effort = effort.clone();
    let attachments: Vec<String> = attachments.clone().unwrap_or_default();

    let Some((host_id, cwd)) = ({
        let map = state.runtimes.lock().unwrap();
        map.get(&session_id)
            .map(|runtime| (runtime.host_id.clone(), runtime.cwd.clone()))
    }) else {
        fail(
            &state.out_tx,
            None,
            "unknown_session",
            format!("unknown session {session_id}"),
            false,
        );
        return;
    };

    // Direct-mode host: launch the turn detached over ssh instead of
    // spawning a local child. Everything after this point (persisting
    // the user row, marking the session running) is identical — only
    // the runner differs, and it lives in `AppState` so the turn
    // survives this connection going away.
    if host_id != "local" {
        let Some(host) = direct_host(state, &host_id) else {
            fail(
                &state.out_tx,
                None,
                "host_unavailable",
                format!("host {host_id} is no longer configured"),
                false,
            );
            return;
        };
        if let Err(error) = state
            .app
            .db
            .create_session_on_host(&session_id, &cwd, &host_id)
        {
            fail(
                &state.out_tx,
                None,
                "prompt_reservation_failed",
                error.to_string(),
                true,
            );
            return;
        }
        let Some(row) = state.app.db.get_session(&session_id).ok().flatten() else {
            fail(
                &state.out_tx,
                None,
                "unknown_session",
                format!("unknown session {session_id}"),
                false,
            );
            return;
        };
        let payload_digest = prompt_payload_digest(
            &session_id,
            row.workspace_id.as_deref(),
            &host_id,
            &cwd,
            &text,
            agent,
            model.as_deref(),
            plan_mode,
            effort.as_deref(),
            &attachments,
        );
        let claim = match reserve_and_claim_prompt(
            &state.app,
            &operation_id,
            &session_id,
            row.workspace_id.as_deref(),
            &payload_digest,
            &text,
            agent,
            model.as_deref(),
        ) {
            Ok(claim) => claim,
            Err(error) => {
                fail(
                    &state.out_tx,
                    None,
                    "prompt_operation_rejected",
                    error,
                    false,
                );
                return;
            }
        };
        if claim.is_none() {
            // A reconnect replayed a queued/claimed/terminal
            // operation. The durable row already owns the prompt;
            // only its original winner may launch it.
            return;
        }
        state
            .app
            .running_sessions
            .lock()
            .unwrap()
            .insert(session_id.clone());
        notify_session_updated(&state.app, &session_id);
        state.app.detached.start_turn(TurnRequest {
            session_id,
            operation_id: Some(operation_id.clone()),
            host_id,
            ssh_host: host.ssh_host,
            cwd,
            agent,
            model,
            // The attachment note is appended remote-side: the
            // paths it has to name only exist once the run
            // directory is known (see `launch_and_tail`).
            prompt: text,
            claude_session_id: row.claude_session_id,
            codex_thread_id: row.codex_thread_id,
            plan_mode,
            effort,
            attachments,
        });
        // Keep the operation `claimed` until the detached tail sees
        // real provider progress. `start_turn` only scheduled an SSH
        // launch; a missing binary, rejected credentials, or a crash
        // before the first provider event must remain `unconfirmed`
        // and must never be reported as delivered.
        return;
    }

    // Local turn: claude reads every attachment off the text note;
    // codex takes images through `-i` and the rest off the note.
    let (image_paths, note_paths): (Vec<String>, Vec<String>) = match agent {
        AgentKind::Claude => (Vec::new(), attachments.clone()),
        AgentKind::Codex => attachments
            .iter()
            .cloned()
            .partition(|p| crate::agent::is_image_path(p)),
    };
    let prompt = crate::agent::append_attachment_note(&text, &note_paths);

    if let Err(error) = state.app.db.create_session(&session_id, &cwd) {
        fail(
            &state.out_tx,
            None,
            "prompt_reservation_failed",
            error.to_string(),
            true,
        );
        return;
    }
    let Some(row) = state.app.db.get_session(&session_id).ok().flatten() else {
        fail(
            &state.out_tx,
            None,
            "unknown_session",
            format!("unknown session {session_id}"),
            false,
        );
        return;
    };
    let payload_digest = prompt_payload_digest(
        &session_id,
        row.workspace_id.as_deref(),
        &host_id,
        &cwd,
        &text,
        agent,
        model.as_deref(),
        plan_mode,
        effort.as_deref(),
        &attachments,
    );
    let claim = match reserve_and_claim_prompt(
        &state.app,
        &operation_id,
        &session_id,
        row.workspace_id.as_deref(),
        &payload_digest,
        &text,
        agent,
        model.as_deref(),
    ) {
        Ok(claim) => claim,
        Err(error) => {
            fail(
                &state.out_tx,
                None,
                "prompt_operation_rejected",
                error,
                false,
            );
            return;
        }
    };
    if claim.is_none() {
        return;
    }

    let runner = {
        let map = state.runtimes.lock().unwrap();
        let Some(runtime) = map.get(&session_id) else {
            drop(map);
            if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, "unconfirmed") {
                report_settlement_failure(state, &session_id, &operation_id, error);
            }
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("unknown session {session_id}"),
                request_id: None,
                code: None,
                retryable: false,
            });
            return;
        };
        let runner: Arc<dyn AgentRunner> = match agent {
            AgentKind::Codex => {
                let codex_runner = Arc::new(CodexRunner::new(CodexRunnerOptions {
                    cwd: runtime.cwd.clone(),
                    codex_bin: None,
                    model: model.clone(),
                    plan_mode,
                    effort: effort.clone(),
                    image_paths,
                }));
                *runtime.last_codex_runner.lock().unwrap() = Some(codex_runner.clone());
                codex_runner
            }
            AgentKind::Claude => {
                runtime.claude_runner.set_model(model.clone());
                runtime
                    .claude_runner
                    .set_turn_options(plan_mode, effort.as_deref());
                runtime.claude_runner.clone()
            }
        };
        *runtime.active_runner.lock().unwrap() = Some(runner.clone());
        *runtime.pending_turn.lock().unwrap() = Some(PendingTurn {
            agent,
            model: model.clone(),
            operation_id: operation_id.clone(),
            failed: false,
            accepted: false,
            text: String::new(),
            thinking: String::new(),
        });
        runner
    };

    // Mark running before spawning so the status is visible immediately.
    state
        .app
        .running_sessions
        .lock()
        .unwrap()
        .insert(session_id.clone());
    notify_session_updated(&state.app, &session_id);

    let state = state.clone();
    let operation_id_for_task = operation_id.clone();
    let session_id_for_task = session_id.clone();
    tokio::spawn(async move {
        let (tx, mut rx) = unbounded_channel::<AgentEvent>();
        let send_fut = runner.send(prompt, tx);
        let state_for_forward = state.clone();
        let operation_for_forward = operation_id_for_task.clone();
        let session_for_forward = session_id_for_task.clone();
        let forward = async move {
            let mut accepted = false;
            let mut provider_error = false;
            while let Some(event) = rx.recv().await {
                // A provider stream event is the first positive
                // evidence that the launched process accepted this
                // turn. Spawn/task scheduling alone is insufficient:
                // a missing binary or auth failure can occur after
                // the task was queued but before any provider event.
                if matches!(&event, AgentEvent::Error(_)) {
                    provider_error = true;
                } else if !accepted && !provider_error && event.is_provider_progress() {
                    accepted = true;
                    mark_pending_prompt_accepted(&state_for_forward, &session_for_forward);
                    if let Err(error) = settle_prompt_dispatch(
                        &state_for_forward.app,
                        &operation_for_forward,
                        "delivered",
                    ) {
                        report_settlement_failure(
                            &state_for_forward,
                            &session_for_forward,
                            &operation_for_forward,
                            error,
                        );
                    }
                }
                handle_agent_event(&state_for_forward, &session_for_forward, event);
            }
            accepted
        };
        let (_, accepted) = tokio::join!(send_fut, forward);
        if !accepted {
            // No provider event arrived. The runner may have failed
            // before spawn, exited before producing output, or lost
            // its stream; all are ambiguous and must remain safe to
            // inspect without falsely claiming delivery.
            if let Err(error) =
                settle_prompt_dispatch(&state.app, &operation_id_for_task, "unconfirmed")
            {
                report_settlement_failure(
                    &state,
                    &session_id_for_task,
                    &operation_id_for_task,
                    error,
                );
            }
        }
    });
}

pub(super) fn handle_chat_cancel(state: &Arc<ConnState>, raw_text: &str, session_id: String) {
    // Route remote sessions through the hub.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    if let Some(runtime) = state.runtimes.lock().unwrap().get(&session_id) {
        if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
            runner.cancel();
        }
    }
    // Direct-mode host: the turn is a detached remote process group,
    // so cancel is `kill -TERM -<pgid>` over ssh (see `detached.rs`).
    // Unconditional — the manager is a no-op when this session has no
    // running detached run, and queues the cancel when the launch
    // round trip is still in flight.
    state.app.detached.cancel(&session_id);
    // Remove from running immediately on cancel — the agent may still
    // emit a trailing Done/Error, but remove here to be safe.
    state
        .app
        .running_sessions
        .lock()
        .unwrap()
        .remove(&session_id);
    notify_session_updated(&state.app, &session_id);
}

pub(super) fn handle_commands_list(state: &Arc<ConnState>, raw_text: &str, session_id: &str) {
    // Remote (perch-mode) sessions: the remote instance knows its own
    // cwd and CLIs, so ask it and unicast the reply back.
    if let Some(host_id) = state.app.hub.route_for_session(session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.to_string()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    let session_id = session_id.to_string();
    let Some((host_id, cwd)) = ({
        let map = state.runtimes.lock().unwrap();
        map.get(&session_id)
            .map(|r| (r.host_id.clone(), r.cwd.clone()))
    }) else {
        let _ = state.out_tx.send(ServerMessage::CommandsList {
            session_id,
            claude: Vec::new(),
            codex: Vec::new(),
        });
        return;
    };
    // Direct-mode host: probe the same two commands over ssh.
    let ssh_host = if host_id == "local" {
        None
    } else {
        direct_host(state, &host_id).map(|h| h.ssh_host)
    };
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let lists = crate::commands::list_for(&host_id, ssh_host.as_deref(), &cwd).await;
        let _ = out_tx.send(ServerMessage::CommandsList {
            session_id,
            claude: lists.claude,
            codex: lists.codex,
        });
    });
}

pub(super) fn handle_session_archive(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
    archived: bool,
) {
    // Route remote sessions through the hub.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    match state.app.db.set_archived(&session_id, archived) {
        Ok(()) => {
            // Broadcast a session.updated so all tabs update immediately.
            notify_session_updated(&state.app, &session_id);
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("session.archive failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

pub(super) fn handle_session_delete(state: &Arc<ConnState>, raw_text: &str, session_id: String) {
    // Route remote sessions through the hub.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }

    let _agent_operation = state.app.agent_operation_lock.lock().unwrap();
    let agent_keys = state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .filter(|snapshot| snapshot.key.session_id == session_id)
        .map(|snapshot| snapshot.key)
        .collect::<Vec<_>>();
    for key in &agent_keys {
        if let Err(error) = state.app.agent_runtime.remove(key) {
            fail(
                &state.out_tx,
                None,
                "agent_stop_failed",
                error.to_string(),
                true,
            );
            return;
        }
    }

    // Cancel any in-flight turn and drop this connection's runtime
    // for the session (claude_runner, pending_turn, etc.).
    if let Some(runtime) = state.runtimes.lock().unwrap().remove(&session_id) {
        if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
            runner.cancel();
        }
        // Direct-mode session: kill the detached remote turn and the
        // remote CLI-mode tmux session too, or they would outlive the
        // session they belong to — which is exactly the property that
        // makes detached mode useful, and exactly the wrong one here.
        if runtime.host_id != "local" {
            state.app.detached.cancel(&session_id);
            if let Some(host) = direct_host(state, &runtime.host_id) {
                let sid = session_id.clone();
                tokio::spawn(async move {
                    crate::detached::kill_cli_session(&host.ssh_host, &sid).await;
                });
            }
        }
    }

    // Kill any CLI-attached (agentAttach) terminal(s) for this
    // session — a dangling `claude --resume` process would otherwise
    // keep running (and fighting a future fresh attach) after the
    // session it belongs to is gone. Deleting a session must kill it
    // for every viewer sharing it, not just this connection, so this
    // goes through `agent_terminals.kill` (app-wide) rather than only
    // clearing this connection's own bookkeeping.
    let attached_terminal_ids: Vec<String> = {
        let map = state.terminal_agent_sessions.lock().unwrap();
        map.iter()
            .filter(|(_, sid)| **sid == session_id)
            .map(|(tid, _)| tid.clone())
            .collect()
    };
    for terminal_id in attached_terminal_ids {
        state
            .terminal_agent_sessions
            .lock()
            .unwrap()
            .remove(&terminal_id);
        // Direct-mode (ssh/tmux) attach still lives only in this
        // connection's `TerminalManager`; a local shared agent
        // terminal lives in the app-wide registry.
        state.terminals.kill(&terminal_id);
    }
    state.app.agent_terminals.kill(&session_id);

    // Drop every other piece of in-memory bookkeeping keyed by this
    // session id.
    state.app.registry.remove(&session_id);
    state
        .app
        .running_sessions
        .lock()
        .unwrap()
        .remove(&session_id);
    state
        .app
        .unseen_sessions
        .lock()
        .unwrap()
        .remove(&session_id);
    state
        .app
        .blocked_sessions
        .lock()
        .unwrap()
        .remove(&session_id);
    state
        .app
        .session_viewers
        .lock()
        .unwrap()
        .remove(&session_id);
    if state.active_session_id.lock().unwrap().as_deref() == Some(session_id.as_str()) {
        *state.active_session_id.lock().unwrap() = None;
    }

    match state.app.workspace_terminals.delete_session(&session_id) {
        Ok(()) => {
            for key in &agent_keys {
                let _ = state.app.agent_persistence.delete_snapshot(key);
                state.app.agent_modes.lock().unwrap().remove(key);
            }
            state
                .app
                .cli_active_sessions
                .lock()
                .unwrap()
                .remove(&session_id);

            // Fan out to every connection (this one included) via the
            // same broadcast channel hosts.upsert/delete use, since
            // the row a normal session.updated event looks up is gone.
            let _ = state
                .app
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::SessionDeleted {
                    session_id: session_id.clone(),
                }));
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("session.delete failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

pub(super) fn handle_session_layout_get(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
) {
    // Route remote sessions through the hub. Register a unicast
    // BEFORE forwarding (same pattern as chat.send / session.subscribe)
    // so the session.layout reply routes back to this connection.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    let layout = state
        .app
        .db
        .get_session_layout(&session_id)
        .unwrap_or(None)
        .and_then(|raw| serde_json::from_str(&raw).ok());
    let _ = state
        .out_tx
        .send(ServerMessage::SessionLayout { session_id, layout });
}

pub(super) fn handle_session_layout_set(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
    layout: serde_json::Value,
) {
    // Route remote sessions through the hub — fire-and-forget, same
    // as session.archive (no reply is expected by the caller).
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    // A layout can be saved for a brand-new session before its first
    // chat message (Fix 3 defers the `sessions` row insert until then)
    // — materialize the row here too so the UPDATE below isn't a
    // silent no-op. INSERT OR IGNORE, same as chat.send's lazy insert.
    if let Some(cwd) = state
        .runtimes
        .lock()
        .unwrap()
        .get(&session_id)
        .map(|r| r.cwd.clone())
    {
        let _ = state.app.db.create_session(&session_id, &cwd);
    }
    let layout_str = serde_json::to_string(&layout).unwrap_or_default();
    if let Err(e) = state.app.db.set_session_layout(&session_id, &layout_str) {
        let _ = state.out_tx.send(ServerMessage::Error {
            message: format!("session.layout.set failed: {e}"),
            request_id: None,
            code: None,
            retryable: false,
        });
    }
}

pub(super) fn handle_session_rename(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
    title: String,
) {
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    match state.app.db.set_title_override(&session_id, title.trim()) {
        Ok(()) => {
            notify_session_updated(&state.app, &session_id);
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("session.rename failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}
