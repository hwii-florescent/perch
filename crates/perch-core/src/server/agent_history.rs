//! Before/after boundaries for agent turns (`agent_change_snapshots`).
//!
//! Managed CLI input and structured prompts capture before dispatch; native
//! completion, configured markers and process exit capture after completion.
//! Those synchronous barriers prevent Perch from delivering the next input
//! before its baseline exists. Repaint and session-status notifications do
//! not create managed turns. Legacy hosted runners retain the status observer
//! below; their asynchronous capture still needs migration to the barriers.
//!
//! Content commits preserve uncommitted work. GitService retains them under
//! internal refs so recorded comparisons remain reachable through Git GC.

use super::*;

use crate::db::{AgentChangeSnapshotFinish, AgentChangeSnapshotStart, MAX_AGENT_CHANGE_PATHS};
use std::collections::HashMap;
use std::sync::LazyLock;

/// Transition state for turn recording. Process-global, keyed by session id
/// (uuids, so two in-process cores in a test cannot collide) — the same shape
/// `commands.rs` already uses for its per-host cache, and it keeps `AppState`
/// unchanged.
static HISTORY: LazyLock<TurnHistory> = LazyLock::new(TurnHistory::default);

/// See [`attach_runtime`].
static RUNTIME: std::sync::OnceLock<tokio::runtime::Handle> = std::sync::OnceLock::new();

#[derive(Default)]
struct TurnHistory {
    /// Last observed running flag per session, so a repeated
    /// `session.updated` for an unchanged session records nothing.
    running: Mutex<HashMap<String, bool>>,
    /// ponytail: one global async lock serializes every boundary capture.
    /// Concurrent workspaces queue behind a slow capture. Upgrade to
    /// workspace-keyed locks when populated performance measurements require it.
    capture: tokio::sync::Mutex<HashMap<String, String>>,
}

/// Record a turn boundary if `session_id`'s running flag actually changed.
/// Called from `notify_session_updated`, which fans out from every transition
/// site; anything but a real change returns without touching Git or SQLite.
pub(super) fn observe_session(app: &AppState, session_id: &str) {
    // Managed CLI turns have synchronous input/completion barriers. A later
    // status notification must not race or duplicate their boundary writes.
    if app
        .agent_runtime
        .lifecycle()
        .list()
        .iter()
        .any(|snapshot| snapshot.key.session_id == session_id)
    {
        return;
    }
    let running = app.running_sessions.lock().unwrap().contains(session_id);
    let was_running = HISTORY
        .running
        .lock()
        .unwrap()
        .insert(session_id.to_string(), running);
    // Act only on a real transition. A session that was never running and
    // still isn't (a plain shell, a rename, a viewer change) has no boundary
    // to close, and the first sighting of an idle session is not a turn end.
    let begins = running && was_running != Some(true);
    let ends = !running && was_running == Some(true);
    if !(begins || ends) {
        return;
    }
    let app = app.clone();
    let session_id = session_id.to_string();
    // `observe_session` is called from async handlers *and* from the agent
    // terminal activity callback, which runs on a pty reader thread with no
    // current runtime — `tokio::spawn` would panic there.
    let Some(runtime) = tokio::runtime::Handle::try_current()
        .ok()
        .or_else(|| RUNTIME.get().cloned())
    else {
        return;
    };
    runtime.spawn(async move {
        if let Err(error) = capture(&app.db, &app.git, &session_id, running).await {
            tracing::warn!(session_id, %error, "could not record agent turn boundary");
        }
    });
}

/// Record a runtime to spawn boundary captures on when the caller has none.
/// Called once per server boot; the first one wins, which is what a test
/// process running several cores needs (any runtime can host the capture —
/// the state it works on is passed in).
pub(super) fn attach_runtime(handle: tokio::runtime::Handle) {
    let _ = RUNTIME.set(handle);
}

/// Forget a session's transition state. Called when the session row goes
/// away, so a reused id cannot inherit a stale running flag.
pub(super) fn forget_session(session_id: &str) {
    HISTORY.running.lock().unwrap().remove(session_id);
}

pub(super) async fn capture(
    db: &HistoryDb,
    git: &GitService,
    session_id: &str,
    running: bool,
) -> anyhow::Result<()> {
    let Some(session) = db.get_session(session_id)? else {
        // Deleted mid-turn: nothing durable left to anchor a boundary to.
        return Ok(());
    };
    if session.host_id != "local" {
        // Git for a remote workspace is not reachable from this process; the
        // owning host records its own turns.
        return Ok(());
    }
    let Some(workspace_id) = session.workspace_id else {
        return Ok(());
    };
    let workspace = db.resolve_workspace(&workspace_id)?;
    let target = match WorkspaceTarget::new(workspace.id.clone(), workspace.path) {
        Ok(target) => target,
        Err(_) => return Ok(()),
    };

    let mut open = HISTORY.capture.lock().await;
    if running {
        if open.contains_key(session_id) {
            // A boundary is already open for this session; the first one wins,
            // exactly like the durable row's own idempotence.
            return Ok(());
        }
        let boundary = boundary(git, &target).await;
        let snapshot_id = Uuid::new_v4().to_string();
        let agent = session
            .cli_provider_id
            .or(session.last_agent)
            .unwrap_or_else(|| "unknown".to_string());
        db.begin_agent_change_snapshot(AgentChangeSnapshotStart {
            snapshot_id: &snapshot_id,
            operation_id: &snapshot_id,
            workspace_id: &workspace_id,
            session_id,
            agent: &agent,
            before_head: boundary.revision.as_deref(),
            before_branch: boundary.branch.as_deref(),
            before_status: &boundary.status,
            before_paths: &boundary.paths,
            created_at: wall_clock_millis(),
        })?;
        open.insert(session_id.to_string(), snapshot_id);
    } else {
        let Some(snapshot_id) = open.get(session_id).cloned() else {
            return Ok(());
        };
        let boundary = boundary(git, &target).await;
        let before = db
            .get_agent_change_snapshot(&snapshot_id)?
            .and_then(|row| row.before_head);
        let mut changed_paths = match (before.as_deref(), boundary.revision.as_deref()) {
            (Some(before), Some(after)) => {
                git.compare_changed_paths(&target, before, after).await?
            }
            _ => Vec::new(), // Missing endpoints remain unavailable in the review selector.
        };
        changed_paths.truncate(MAX_AGENT_CHANGE_PATHS);
        db.finish_agent_change_snapshot(AgentChangeSnapshotFinish {
            snapshot_id: &snapshot_id,
            after_head: boundary.revision.as_deref(),
            after_branch: boundary.branch.as_deref(),
            after_status: &boundary.status,
            after_paths: &boundary.paths,
            changed_paths: &changed_paths,
            completed_at: wall_clock_millis(),
        })?;
        open.remove(session_id);
    }
    Ok(())
}

struct Boundary {
    revision: Option<String>,
    branch: Option<String>,
    status: String,
    paths: Vec<String>,
}

/// One side of a turn: a content commit that includes uncommitted and
/// untracked work, plus the bounded status summary the row stores.
async fn boundary(git: &GitService, target: &WorkspaceTarget) -> Boundary {
    let revision = git.content_snapshot(target).await;
    let status = git
        .status(target, source_control::StatusOptions::default())
        .await
        .ok();
    let branch = status.as_ref().and_then(|status| status.branch.clone());
    let mut paths: Vec<String> = status
        .as_ref()
        .map(|status| {
            status
                .entries
                .iter()
                .map(|entry| entry.path.clone())
                .collect()
        })
        .unwrap_or_default();
    paths.sort();
    paths.dedup();
    paths.truncate(MAX_AGENT_CHANGE_PATHS);
    let summary = serde_json::json!({
        "dirty": status.as_ref().is_some_and(|status| status.dirty()),
        "conflicted": status.as_ref().is_some_and(|status| status.conflicted()),
        "changed": paths.len(),
    });
    Boundary {
        revision,
        branch,
        status: summary.to_string(),
        paths,
    }
}

/// The newest completed turn for a workspace, as the Git surface reports it.
/// Incomplete boundaries are skipped: a turn still running has no after side
/// to diff against.
pub(super) fn last_completed_turn(
    app: &AppState,
    workspace_id: &str,
) -> Option<crate::protocol::AgentTurnSummary> {
    let rows = app.db.list_agent_change_snapshots(workspace_id, 16).ok()?;
    let row = rows
        .into_iter()
        .find(|row| row.completed && row.before_head.is_some() && row.after_head.is_some())?;
    Some(crate::protocol::AgentTurnSummary {
        snapshot_id: row.snapshot_id,
        session_id: row.session_id,
        agent: row.agent,
        before_ref: row.before_head?,
        after_ref: row.after_head,
        changed_paths: row.changed_paths.unwrap_or_default(),
        completed_at: row.completed_at,
    })
}
