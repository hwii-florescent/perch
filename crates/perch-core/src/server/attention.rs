//! Attention admission: the one Rust projection behind Needs You and
//! Welcome Back (UI-UX-DIRECTION §10, PRODUCT-STRATEGY §15).
//!
//! Rows live in `attention_events` (`db/attention.rs`). Admission follows
//! the same evidence that drives the sidebar's blocked/running sets, never
//! output silence or a guess dressed up as fact:
//! - **question** (Needs You): the agent entered Blocked. Certainty is
//!   `verified` with a native bridge, else `heuristic` (OSC title, configured
//!   marker, output pattern). Resolved only when the source leaves Blocked,
//!   the user types into it, or its PTY ends; viewing never resolves it.
//!   After a core restart an open question is `unconfirmed` until the agent
//!   reports again.
//! - **failed** (Needs You): provider error. Resolved by the next turn.
//! - **finished** (Recent updates): a turn ended. Recorded only when nobody
//!   was viewing the session; unread rows coalesce per session. A legacy
//!   terminal that merely went quiet is `heuristic`, not a completion.
//!   A turn whose end was observed only after a core restart says so.
//! - **exited** (Recent updates): the agent process ended unseen, or was
//!   found gone at boot while it had been working (`unconfirmed`).
//!
//! Every change broadcasts one bounded `attention.snapshot`.

use super::*;
use crate::agent_fleet::{AgentKey, AgentState, AgentTransition};
use crate::db::AttentionAdmit;
use crate::protocol::AttentionEvent;

fn now() -> i64 {
    now_millis() as i64
}

fn viewed(app: &AppState, session_id: &str) -> bool {
    app.session_viewers
        .lock()
        .unwrap()
        .get(session_id)
        .is_some_and(|set| !set.is_empty())
}

fn certainty(app: &AppState, session_id: &str) -> &'static str {
    if app.agent_runtime.has_native_status(session_id) {
        "verified"
    } else {
        "heuristic"
    }
}

fn changed(app: &AppState, result: anyhow::Result<bool>) {
    match result {
        Ok(true) => broadcast(app),
        Ok(false) => {}
        Err(error) => tracing::warn!(%error, "could not record attention"),
    }
}

fn record(
    app: &AppState,
    session_id: &str,
    agent_id: &str,
    kind: &str,
    certainty: &str,
    summary: &str,
) {
    let requires_action = kind == "failed";
    let read = viewed(app, session_id);
    // Updates seen as they happened are not news; failures still need action.
    if read && !requires_action {
        return;
    }
    changed(
        app,
        app.db
            .record_attention(AttentionAdmit {
                session_id,
                agent_id,
                kind,
                requires_action,
                certainty,
                summary,
                read,
                now: now(),
            })
            .map(|_| true),
    );
}

/// Snapshot of the current list for every connection.
pub(super) fn snapshot(app: &AppState) -> ServerMessage {
    let events = app
        .db
        .list_attention(now())
        .unwrap_or_default()
        .into_iter()
        .map(|row| AttentionEvent {
            id: row.id,
            session_id: row.session_id,
            workspace_id: row.workspace_id,
            project_id: row.project_id,
            agent_id: row.agent_id,
            kind: row.kind,
            requires_action: row.requires_action,
            certainty: row.certainty,
            summary: row.summary,
            occurred_at: row.occurred_at,
            count: row.count.max(1) as u32,
            read: row.read,
            changed_path_count: row.changed_path_count,
            changed_paths: row.changed_paths,
        })
        .collect();
    ServerMessage::AttentionSnapshot { events }
}

pub(super) fn broadcast(app: &AppState) {
    broadcast_foundation(app, snapshot(app));
}

/// The agent is waiting on the human.
pub(super) fn question(app: &AppState, session_id: &str, agent_id: &str, certainty: &str) {
    changed(
        app,
        app.db
            .open_attention_question(session_id, agent_id, certainty, now()),
    );
}

/// The prompt was answered: typed into, or its PTY ended.
pub(super) fn answered(app: &AppState, session_id: &str) {
    changed(app, app.db.resolve_attention(session_id, "question", now()));
}

/// A Hosted or detached (direct-host) turn settled; both report their own
/// turn end, so this is a verified boundary.
pub(super) fn settled(app: &AppState, session_id: &str, failed: bool) {
    let agent = app
        .db
        .get_session(session_id)
        .ok()
        .flatten()
        .and_then(|row| row.cli_provider_id.or(row.last_agent))
        .unwrap_or_default();
    let (kind, summary) = if failed {
        ("failed", "Turn failed")
    } else {
        ("finished", "Finished")
    };
    record(app, session_id, &agent, kind, "verified", summary);
}

/// Agents in a submitted turn, so a settle is a finished turn and not a
/// provider starting up idle. `true` = the turn began before a core restart.
pub(super) type OpenTurns = HashMap<AgentKey, bool>;

/// Agents that were working or blocked when the previous core stopped (the
/// lifecycle restore turned them Reconnecting). Call before recovery runs.
pub(super) fn turns_open_at_boot(app: &AppState) -> OpenTurns {
    app.agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .filter(|s| {
            s.state == AgentState::Reconnecting && s.reason.starts_with("runtime restarted")
        })
        .map(|s| (s.key, true))
        .collect()
}

/// Lifecycle transitions of CLI agents, in order (`spawn_agent_turn_state_task`).
pub(super) fn on_transition(
    app: &AppState,
    key: &AgentKey,
    transition: &AgentTransition,
    starts_turn: bool,
    open: &mut OpenTurns,
) {
    if !transition.changed || key.agent_id == crate::agent_fleet::TERMINAL_PROVIDER {
        return;
    }
    let session = key.session_id.as_str();
    let agent = key.agent_id.as_str();
    if matches!(
        transition.to,
        AgentState::Reconnecting | AgentState::Sleeping
    ) {
        return;
    }
    // Leaving Blocked, or the first report after a restart that is not
    // Blocked, is evidence that no prompt is waiting any more.
    if transition.to != AgentState::Blocked
        && matches!(
            transition.from,
            AgentState::Blocked | AgentState::Reconnecting
        )
    {
        answered(app, session);
    }
    let certainty = certainty(app, session);
    match transition.to {
        AgentState::Blocked => {
            open.entry(key.clone()).or_insert(false);
            question(app, session, agent, certainty);
        }
        AgentState::Working if starts_turn => {
            open.insert(key.clone(), false);
            changed(app, app.db.resolve_attention(session, "failed", now()));
        }
        AgentState::Working => {}
        AgentState::Done | AgentState::Idle => {
            if let Some(away) = open.remove(key) {
                let summary = if away {
                    "Finished while Perch was closed"
                } else {
                    "Finished"
                };
                record(app, session, agent, "finished", certainty, summary);
            }
        }
        AgentState::Error => {
            open.remove(key);
            record(app, session, agent, "failed", certainty, "Agent error");
        }
        AgentState::Exited => {
            open.remove(key);
            record(app, session, agent, "exited", "verified", "Agent exited");
        }
        AgentState::Reconnecting | AgentState::Sleeping => {}
    }
}

/// Boot: found an agent that was working before the restart but whose
/// process is gone, or whose wrapper recorded its exit while Perch was closed.
pub(super) fn gone_while_closed(app: &AppState, key: &AgentKey, confirmed: bool) {
    let (certainty, summary) = if confirmed {
        ("verified", "Agent exited while Perch was closed")
    } else {
        ("unconfirmed", "Was working; its process is gone")
    };
    record(
        app,
        &key.session_id,
        &key.agent_id,
        "exited",
        certainty,
        summary,
    );
}

/// Boot reconciliation: open questions lost their live evidence.
pub(super) fn reconcile_at_boot(app: &AppState) {
    if let Err(error) = app.db.reconcile_attention_at_boot(now()) {
        tracing::warn!(%error, "could not reconcile attention history");
    }
}

/// A connection started viewing the session: its updates are read. A live
/// question stays in Needs You (read is not resolved).
pub(super) fn viewed_session(app: &AppState, session_id: &str) {
    changed(app, app.db.read_attention_for_session(session_id));
}

pub(super) fn forget_session(app: &AppState, session_id: &str) {
    changed(app, app.db.delete_attention_for_session(session_id));
}

pub(super) fn handle_list(state: &Arc<ConnState>) {
    let _ = state.out_tx.send(snapshot(&state.app));
}

pub(super) fn handle_update(state: &Arc<ConnState>, ids: &[String], dismiss: bool) {
    changed(&state.app, state.app.db.update_attention(ids, dismiss));
}
