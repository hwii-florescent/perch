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

use crate::agent_fleet::AgentState;
use crate::db::{AgentChangeSnapshotFinish, AgentChangeSnapshotStart, MAX_AGENT_CHANGE_PATHS};
use crate::protocol::AgentTurnState;
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
    let mut open = HISTORY.capture.lock().await;
    // Completion consumes the pending boundary even if a read, Git operation,
    // or final write fails. Retrying later would capture newer files and could
    // attribute the next turn to this one. Keep the durable row incomplete.
    let completing = if running {
        None
    } else {
        let Some(snapshot_id) = open.remove(session_id) else {
            return Ok(());
        };
        Some(snapshot_id)
    };
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
            before_status: &boundary.status.to_string(),
            before_paths: &boundary.paths,
            created_at: wall_clock_millis(),
        })?;
        open.insert(session_id.to_string(), snapshot_id);
    } else if let Some(snapshot_id) = completing {
        let mut boundary = boundary(git, &target).await;
        let before = db
            .get_agent_change_snapshot(&snapshot_id)?
            .and_then(|row| row.before_head);
        let mut changed_paths = match (before.as_deref(), boundary.revision.as_deref()) {
            (Some(before), Some(after)) => {
                git.compare_changed_paths(&target, before, after).await?
            }
            _ => Vec::new(), // Missing endpoints remain unavailable in the review selector.
        };
        if before.is_some() && boundary.revision.is_some() {
            boundary.status["turnChangedPathCount"] = changed_paths.len().into();
        }
        changed_paths.truncate(MAX_AGENT_CHANGE_PATHS);
        db.finish_agent_change_snapshot(AgentChangeSnapshotFinish {
            snapshot_id: &snapshot_id,
            after_head: boundary.revision.as_deref(),
            after_branch: boundary.branch.as_deref(),
            after_status: &boundary.status.to_string(),
            after_paths: &boundary.paths,
            changed_paths: &changed_paths,
            completed_at: wall_clock_millis(),
        })?;
    }
    Ok(())
}

struct Boundary {
    revision: Option<String>,
    branch: Option<String>,
    status: serde_json::Value,
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
    let summary = serde_json::json!({
        "dirty": status.as_ref().is_some_and(|status| status.dirty()),
        "conflicted": status.as_ref().is_some_and(|status| status.conflicted()),
        "changed": paths.len(),
    });
    paths.truncate(MAX_AGENT_CHANGE_PATHS);
    Boundary {
        revision,
        branch,
        status: summary,
        paths,
    }
}

/// Is the session that opened a turn still inside it? A durable row with no
/// after side has two causes the database cannot tell apart — the agent is
/// still working, or the capture will never close — so the live runtime
/// decides. `completed = false` on its own is not evidence of either.
fn turn_in_flight(app: &AppState, workspace_id: &str, session_id: &str) -> bool {
    let mut managed = app
        .agent_runtime
        .lifecycle()
        .list_workspace(workspace_id)
        .into_iter()
        .filter(|snapshot| snapshot.key.session_id == session_id)
        .peekable();
    if managed.peek().is_some() {
        // The lifecycle registry owns managed CLI turns; `observe_session`
        // returns early for them, so `running_sessions` is not their truth.
        return managed.any(|snapshot| {
            matches!(
                snapshot.state,
                AgentState::Working | AgentState::Blocked | AgentState::Reconnecting
            )
        });
    }
    app.running_sessions.lock().unwrap().contains(session_id)
}

/// The newest recorded turn for a workspace, as the Git surface reports it.
///
/// The newest row wins even when it has no usable comparison. Scanning past
/// it for an older completed one used to present last week's work under the
/// label "last agent turn" whenever the latest capture failed — the honest
/// answer is this turn plus [`AgentTurnState`], and the client decides what
/// it can offer. Recorded rows are never rewritten or invented here.
pub(super) fn last_agent_turn(
    app: &AppState,
    workspace_id: &str,
    session_id: Option<&str>,
) -> Option<crate::protocol::AgentTurnSummary> {
    let row = app
        .db
        .list_agent_change_snapshots(workspace_id, session_id, 1)
        .ok()?
        .into_iter()
        .next()?;
    let in_flight = turn_in_flight(app, workspace_id, &row.session_id);
    Some(summarize_turn(row, in_flight))
}

/// The reportable shape of one durable row. Split from [`last_agent_turn`] so
/// the decision is testable without standing up an `AppState`: everything the
/// state depends on is the row plus the one live fact above it.
fn summarize_turn(
    row: crate::db::AgentChangeSnapshotRow,
    in_flight: bool,
) -> crate::protocol::AgentTurnSummary {
    let has_before = row.before_head.is_some();
    let state = if row.completed && has_before && row.after_head.is_some() {
        AgentTurnState::Complete
    } else if !row.completed && has_before && in_flight {
        AgentTurnState::Running
    } else {
        AgentTurnState::Unavailable
    };
    let paths = row.changed_paths.unwrap_or_default();
    let changed_path_count = if state == AgentTurnState::Complete {
        row.after_status
            .as_deref()
            .and_then(|status| serde_json::from_str::<serde_json::Value>(status).ok())
            .and_then(|status| status["turnChangedPathCount"].as_u64())
            .and_then(|count| usize::try_from(count).ok())
            .filter(|count| *count >= paths.len())
            // Older records at the cap may have omitted paths. Their exact
            // total is unknown, but a shorter list was never truncated.
            .or_else(|| (paths.len() < MAX_AGENT_CHANGE_PATHS).then_some(paths.len()))
    } else {
        None
    };
    crate::protocol::AgentTurnSummary {
        snapshot_id: row.snapshot_id,
        session_id: row.session_id,
        agent: row.agent,
        // Empty only in the `Unavailable` case where the before side was
        // never recorded either; `state` is what gates comparing at all.
        before_ref: row.before_head.unwrap_or_default(),
        after_ref: row.after_head,
        changed_paths: paths,
        changed_path_count,
        completed_at: row.completed_at,
        state,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_bounded_path_list_keeps_the_full_turn_count_after_reopen() {
        let root = std::env::temp_dir().join(format!("perch-turn-count-{}", Uuid::new_v4()));
        let repo = root.join("repo");
        std::fs::create_dir_all(&repo).unwrap();
        let init = std::process::Command::new("git")
            .args(["-c", "core.hooksPath=/dev/null", "init", "-q"])
            .current_dir(&repo)
            .status()
            .unwrap();
        assert!(init.success());
        let db_path = root.join("history.sqlite");
        let db = HistoryDb::open(&db_path).unwrap();
        let session = Uuid::new_v4().to_string();
        db.create_session(&session, repo.to_str().unwrap()).unwrap();
        let workspace = db
            .get_session(&session)
            .unwrap()
            .unwrap()
            .workspace_id
            .unwrap();
        let git = GitService::default();
        capture(&db, &git, &session, true).await.unwrap();
        for index in 0..=MAX_AGENT_CHANGE_PATHS {
            std::fs::write(repo.join(format!("file-{index:04}.txt")), "new\n").unwrap();
        }
        capture(&db, &git, &session, false).await.unwrap();
        drop(db);
        let db = HistoryDb::open(&db_path).unwrap();
        let mut row = db
            .list_agent_change_snapshots(&workspace, None, 1)
            .unwrap()
            .remove(0);
        let report = summarize_turn(row.clone(), false);
        assert_eq!(report.state, AgentTurnState::Complete);
        assert_eq!(report.changed_paths.len(), MAX_AGENT_CHANGE_PATHS);
        assert_eq!(report.changed_path_count, Some(MAX_AGENT_CHANGE_PATHS + 1));
        // A legacy capped row cannot claim the list length is the exact total.
        row.after_status = Some("{}".into());
        assert_eq!(summarize_turn(row, false).changed_path_count, None);

        // Dirty working-tree paths are not this turn's changed-path count.
        capture(&db, &git, &session, true).await.unwrap();
        std::fs::write(repo.join("file-0000.txt"), "next turn\n").unwrap();
        capture(&db, &git, &session, false).await.unwrap();
        let mut row = db
            .list_agent_change_snapshots(&workspace, None, 1)
            .unwrap()
            .remove(0);
        assert_eq!(
            summarize_turn(row.clone(), false).changed_path_count,
            Some(1)
        );
        row.after_status = Some("{}".into());
        assert_eq!(summarize_turn(row, false).changed_path_count, Some(1));
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn failed_completion_never_reuses_the_previous_turn_boundary() {
        // Cover failure both before workspace resolution and at the final DB
        // write. A completion notification consumes its boundary in either case.
        for fail_at_lookup in [true, false] {
            let root = std::env::temp_dir().join(format!("perch-turn-failure-{}", Uuid::new_v4()));
            let repo = root.join("repo");
            std::fs::create_dir_all(&repo).unwrap();
            let git_command = |args: &[&str]| {
                let result = std::process::Command::new("git")
                    .args([
                        "-c",
                        "core.hooksPath=/dev/null",
                        "-c",
                        "user.name=Perch fixture",
                        "-c",
                        "user.email=fixture@perch.test",
                    ])
                    .args(args)
                    .current_dir(&repo)
                    .output()
                    .unwrap();
                assert!(
                    result.status.success(),
                    "{}",
                    String::from_utf8_lossy(&result.stderr)
                );
            };
            git_command(&["init", "-q"]);
            std::fs::write(repo.join("base.txt"), "base\n").unwrap();
            git_command(&["add", "base.txt"]);
            git_command(&["commit", "-qm", "fixture"]);
            let db_path = root.join("history.sqlite");
            let db = HistoryDb::open(&db_path).unwrap();
            let session = Uuid::new_v4().to_string();
            db.create_session(&session, repo.to_str().unwrap()).unwrap();
            let workspace = db
                .get_session(&session)
                .unwrap()
                .unwrap()
                .workspace_id
                .unwrap();
            let git = GitService::default();
            capture(&db, &git, &session, true).await.unwrap();
            let first = db.list_agent_change_snapshots(&workspace, None, 8).unwrap()[0]
                .snapshot_id
                .clone();
            std::fs::write(repo.join("first.txt"), "first turn\n").unwrap();
            let fault = rusqlite::Connection::open(&db_path).unwrap();
            fault.execute_batch(if fail_at_lookup {
                "ALTER TABLE sessions RENAME COLUMN cwd TO unavailable_cwd"
            } else {
                "CREATE TRIGGER fail_completion BEFORE UPDATE ON agent_change_snapshots BEGIN SELECT RAISE(ABORT, 'fixture completion failure'); END"
            }).unwrap();
            assert!(capture(&db, &git, &session, false).await.is_err());
            fault
                .execute_batch(if fail_at_lookup {
                    "ALTER TABLE sessions RENAME COLUMN unavailable_cwd TO cwd"
                } else {
                    "DROP TRIGGER fail_completion"
                })
                .unwrap();

            // Exercise both a late Ready and a new prompt immediately after
            // failure; neither may reuse the old pending boundary.
            if fail_at_lookup {
                capture(&db, &git, &session, false).await.unwrap();
            }
            assert!(
                !db.get_agent_change_snapshot(&first)
                    .unwrap()
                    .unwrap()
                    .completed
            );
            capture(&db, &git, &session, true).await.unwrap();
            std::fs::write(repo.join("second.txt"), "second turn\n").unwrap();
            capture(&db, &git, &session, false).await.unwrap();
            let rows = db.list_agent_change_snapshots(&workspace, None, 8).unwrap();
            assert_eq!(rows.len(), 2);
            assert_eq!(rows.iter().filter(|row| row.completed).count(), 1);
            let complete = rows.iter().find(|row| row.completed).unwrap();
            assert_ne!(complete.snapshot_id, first);
            assert_eq!(
                complete.changed_paths.as_deref(),
                Some(["second.txt".to_string()].as_slice())
            );
            assert!(complete.before_head.is_some() && complete.after_head.is_some());
            drop(fault);
            drop(db);
            std::fs::remove_dir_all(root).unwrap();
        }
    }

    /// The selector must never present an older turn as the newest one. This
    /// drives one successful turn, then a second whose completion fails, over
    /// real Git and SQLite, and checks what the Git surface would report.
    #[tokio::test]
    async fn an_uncaptured_newest_turn_is_reported_instead_of_an_older_success() {
        let root = std::env::temp_dir().join(format!("perch-turn-report-{}", Uuid::new_v4()));
        let repo = root.join("repo");
        std::fs::create_dir_all(&repo).unwrap();
        let git_command = |args: &[&str]| {
            let result = std::process::Command::new("git")
                .args([
                    "-c",
                    "core.hooksPath=/dev/null",
                    "-c",
                    "user.name=Perch fixture",
                    "-c",
                    "user.email=fixture@perch.test",
                ])
                .args(args)
                .current_dir(&repo)
                .output()
                .unwrap();
            assert!(
                result.status.success(),
                "{}",
                String::from_utf8_lossy(&result.stderr)
            );
        };
        git_command(&["init", "-q"]);
        std::fs::write(repo.join("base.txt"), "base\n").unwrap();
        git_command(&["add", "base.txt"]);
        git_command(&["commit", "-qm", "fixture"]);
        let db_path = root.join("history.sqlite");
        let db = HistoryDb::open(&db_path).unwrap();
        let session = Uuid::new_v4().to_string();
        db.create_session(&session, repo.to_str().unwrap()).unwrap();
        let workspace = db
            .get_session(&session)
            .unwrap()
            .unwrap()
            .workspace_id
            .unwrap();
        let git = GitService::default();
        let newest = |db: &HistoryDb| {
            db.list_agent_change_snapshots(&workspace, None, 1)
                .unwrap()
                .into_iter()
                .next()
                .unwrap()
        };

        // A turn that finished: the complete comparison the reviewer wants.
        capture(&db, &git, &session, true).await.unwrap();
        std::fs::write(repo.join("first.txt"), "first turn\n").unwrap();
        capture(&db, &git, &session, false).await.unwrap();
        let good = summarize_turn(newest(&db), false);
        assert_eq!(good.state, AgentTurnState::Complete);
        assert!(good.after_ref.is_some());
        assert_eq!(good.changed_paths, vec!["first.txt".to_string()]);

        // A turn still running: reportable, but without an after side, so the
        // client compares its base against the working tree.
        capture(&db, &git, &session, true).await.unwrap();
        let running = summarize_turn(newest(&db), true);
        assert_eq!(running.state, AgentTurnState::Running);
        assert!(running.after_ref.is_none());
        assert!(!running.before_ref.is_empty());
        assert_ne!(running.snapshot_id, good.snapshot_id);

        // That turn's completion now fails, which consumes its boundary and
        // leaves the row permanently open — the shape a crash mid-turn also
        // leaves behind. The older success must not stand in for it.
        std::fs::write(repo.join("second.txt"), "second turn\n").unwrap();
        let fault = rusqlite::Connection::open(&db_path).unwrap();
        fault.execute_batch("CREATE TRIGGER fail_completion BEFORE UPDATE ON agent_change_snapshots BEGIN SELECT RAISE(ABORT, 'fixture completion failure'); END").unwrap();
        assert!(capture(&db, &git, &session, false).await.is_err());
        fault.execute_batch("DROP TRIGGER fail_completion").unwrap();
        let stranded = summarize_turn(newest(&db), false);
        assert_eq!(stranded.state, AgentTurnState::Unavailable);
        assert_eq!(stranded.snapshot_id, running.snapshot_id);
        assert_ne!(stranded.snapshot_id, good.snapshot_id);
        assert!(stranded.after_ref.is_none());

        // The next turn restores review without touching the stranded row.
        capture(&db, &git, &session, true).await.unwrap();
        std::fs::write(repo.join("third.txt"), "third turn\n").unwrap();
        capture(&db, &git, &session, false).await.unwrap();
        let recovered = summarize_turn(newest(&db), false);
        assert_eq!(recovered.state, AgentTurnState::Complete);
        assert_eq!(recovered.changed_paths, vec!["third.txt".to_string()]);
        assert!(
            !db.get_agent_change_snapshot(&stranded.snapshot_id)
                .unwrap()
                .unwrap()
                .completed
        );

        drop(fault);
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }
}
