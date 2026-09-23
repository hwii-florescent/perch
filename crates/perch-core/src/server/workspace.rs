//! `project.*`/`workspace.*`/`worktree.*` arm bodies, plus the
//! foundation snapshot/focus/wire-mapper helpers they share. Pure move
//! from `server.rs` — see the refactor plan's Phase 3. No logic changed.
//!
//! `effective_focus` is pub(super): the still-resident
//! `foundation_focus_tests` module calls it directly. `broadcast_foundation`,
//! `fail`/`request_error`, and `route_git_review_request` stay in mod.rs —
//! they're shared with the agent-lifecycle background task and other
//! not-yet-extracted domains — and are reached here via `super::`.

use super::*;

/// Allocate a metadata revision. Callers must hold `foundation_lock` while
/// mutating the DB, allocating this value, and publishing the corresponding
/// event/snapshot; keeping the lock outside this helper makes nested snapshot
/// builders safe.
fn next_snapshot_revision_locked(app: &AppState) -> u64 {
    app.snapshot_revision
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        + 1
}

fn project_to_wire(row: crate::db::ProjectRow) -> ProjectSummary {
    ProjectSummary {
        id: row.id,
        host_id: row.host_id,
        name: row.name,
        path: row.path,
        repo_path: row.repo_path,
        default_branch: row.default_branch,
        favorite: row.favorite,
        archived: row.archived,
        settings: row
            .settings
            .and_then(|settings| serde_json::from_str(&settings).ok()),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn workspace_to_wire(row: crate::db::WorkspaceRow) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id,
        project_id: row.project_id,
        host_id: row.host_id,
        path: row.path,
        name: row.name,
        branch: row.branch,
        base_branch: row.base_branch,
        dirty: row.dirty,
        start_snapshot: row.start_snapshot,
        parent_workspace_id: row.parent_workspace_id,
        pinned: row.pinned,
        hidden: row.hidden,
        state: match row.state.as_str() {
            "sleeping" => WorkspaceState::Sleeping,
            "archived" => WorkspaceState::Archived,
            _ => WorkspaceState::Active,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn current_snapshot_revision_locked(app: &AppState) -> u64 {
    app.snapshot_revision
        .load(std::sync::atomic::Ordering::SeqCst)
}

/// Foundation requests never fall through to a local DB when a caller names
/// another host. Direct hosts have no project metadata service in this slice;
/// a later remote-capability path can replace this explicit refusal.
fn reject_non_local_foundation_host(
    host_id: Option<&str>,
    request_id: &str,
) -> Option<ServerMessage> {
    let host_id = host_id.unwrap_or("local").trim();
    if host_id.is_empty() || host_id == "local" {
        None
    } else {
        Some(request_error(
            Some(request_id.to_string()),
            Some("unsupported_remote".to_string()),
            format!("project/workspace metadata is not available on host {host_id}"),
            false,
        ))
    }
}

fn local_project(app: &AppState, project_id: &str) -> Option<crate::db::ProjectRow> {
    app.db
        .get_project(project_id)
        .ok()
        .flatten()
        .filter(|project| project.host_id == "local")
}

fn local_workspace(app: &AppState, workspace_id: &str) -> Option<crate::db::WorkspaceRow> {
    app.db
        .get_workspace(workspace_id)
        .ok()
        .flatten()
        .filter(|workspace| workspace.host_id == "local")
}

/// Build a workspace snapshot while `foundation_lock` is held. The DB's
/// persisted focus is only the fallback for a connection that has not
/// navigated yet; an established connection's local focus wins so one client
/// cannot steal another client's selection.
fn workspace_snapshot_locked(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: Option<String>,
) -> ServerMessage {
    if let Some(project_id) = project_id.as_deref() {
        let Some(project) = local_project(&state.app, project_id) else {
            return request_error(
                Some(request_id),
                Some("project_not_found".to_string()),
                "project is not present on the local host",
                false,
            );
        };
        if project.archived {
            return request_error(
                Some(request_id),
                Some("project_archived".to_string()),
                "project is archived",
                false,
            );
        }
    }
    match state
        .app
        .db
        .workspace_snapshot("local", project_id.as_deref())
    {
        Ok((projects, workspaces, active_project_id, active_workspace_id)) => {
            let connection_project_id = state.active_project_id.lock().unwrap().clone();
            let connection_workspace_id = state.active_workspace_id.lock().unwrap().clone();
            let (active_project_id, active_workspace_id) = effective_focus(
                &projects,
                &workspaces,
                connection_project_id.as_deref(),
                connection_workspace_id.as_deref(),
                active_project_id.as_deref(),
                active_workspace_id.as_deref(),
            );
            ServerMessage::WorkspaceSnapshot {
                request_id,
                host_id: "local".to_string(),
                snapshot_epoch: state.app.snapshot_epoch.clone(),
                snapshot_revision: current_snapshot_revision_locked(&state.app),
                projects: projects.into_iter().map(project_to_wire).collect(),
                workspaces: workspaces.into_iter().map(workspace_to_wire).collect(),
                active_project_id,
                active_workspace_id,
            }
        }
        Err(err) => request_error(
            Some(request_id),
            Some("workspace_snapshot_failed".to_string()),
            format!("workspace.snapshot failed: {err}"),
            true,
        ),
    }
}

/// Send a snapshot to one connection while `foundation_lock` is held. Focus
/// replies are intentionally unicast; metadata row events use
/// `broadcast_foundation` and reach the other clients without changing their
/// connection-local focus.
fn send_workspace_snapshot_locked(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: Option<String>,
) {
    let message = workspace_snapshot_locked(state, request_id, project_id);
    let _ = state.out_tx.send(message);
}

fn send_workspace_snapshot(state: &Arc<ConnState>, request_id: String, project_id: Option<String>) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    send_workspace_snapshot_locked(state, request_id, project_id);
}

/// Hub-routing preamble shared by the request-correlated `worktree.*` family.
/// Registers a single-shot unicast slot keyed by `requestId` (so the remote's
/// one reply reaches only the connection that asked) and forwards the
/// host-stripped request. Returns `true` when the message was routed — the
/// caller must return immediately in that case.
fn route_worktree_request(
    state: &Arc<ConnState>,
    host_id: Option<&str>,
    request_id: &str,
    raw_text: &str,
) -> bool {
    let target = host_id.unwrap_or("local");
    if target == "local" || target.is_empty() {
        return false;
    }
    state.app.hub.register_unicast(
        PendingKey::Worktree(request_id.to_string()),
        state.conn_id.clone(),
        state.out_tx.clone(),
    );
    state.app.hub.forward(target, &strip_host_id(raw_text));
    true
}

/// Choose a coherent active project/workspace pair from one connection's
/// local focus, then the persisted seed. Rows may have changed between two
/// requests (for example, another client archived the selected project), so
/// neither stored pair is trusted until both ids are present and active in the
/// snapshot being built.
pub(super) fn effective_focus(
    projects: &[crate::db::ProjectRow],
    workspaces: &[crate::db::WorkspaceRow],
    connection_project_id: Option<&str>,
    connection_workspace_id: Option<&str>,
    persisted_project_id: Option<&str>,
    persisted_workspace_id: Option<&str>,
) -> (Option<String>, Option<String>) {
    let project_is_active = |project_id: &str| {
        projects
            .iter()
            .any(|project| project.id == project_id && !project.archived)
    };
    let workspace_is_active_for = |project_id: &str, workspace_id: &str| {
        workspaces.iter().any(|workspace| {
            workspace.id == workspace_id
                && workspace.project_id == project_id
                && workspace.state != "archived"
        })
    };
    let choose_for_project = |project_id: &str, preferred_workspace_id: Option<&str>| {
        if !project_is_active(project_id) {
            return None;
        }
        let workspace_id = preferred_workspace_id
            .filter(|workspace_id| workspace_is_active_for(project_id, workspace_id))
            .map(str::to_string)
            .or_else(|| {
                workspaces
                    .iter()
                    .find(|workspace| {
                        workspace.project_id == project_id && workspace.state != "archived"
                    })
                    .map(|workspace| workspace.id.clone())
            })?;
        Some((project_id.to_string(), workspace_id))
    };

    // A connection's own selection always wins over the persisted default,
    // but only while it still names a visible active pair.
    if let (Some(project_id), Some(workspace_id)) = (connection_project_id, connection_workspace_id)
    {
        if let Some(pair) = choose_for_project(project_id, Some(workspace_id)) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let Some(project_id) = connection_project_id {
        if let Some(pair) = choose_for_project(project_id, None) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let (Some(project_id), Some(workspace_id)) = (persisted_project_id, persisted_workspace_id) {
        if let Some(pair) = choose_for_project(project_id, Some(workspace_id)) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let Some(project_id) = persisted_project_id {
        if let Some(pair) = choose_for_project(project_id, None) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    projects
        .iter()
        .filter(|project| !project.archived)
        .find_map(|project| choose_for_project(&project.id, None))
        .map(|(project_id, workspace_id)| (Some(project_id), Some(workspace_id)))
        .unwrap_or((None, None))
}

/// Whether a stored workspace row already reflects `entry`, so registering it
/// again would write nothing. Mirrors the SQL in `create_worktree_workspace`
/// and `update_workspace_git_state`: `branch`/`base_branch` are `COALESCE`d
/// (a `None` never clears a stored value) and `dirty` is a plain overwrite.
/// Refreshing a checkout never changes its recorded or missing creation ref.
fn workspace_matches_worktree(
    row: &crate::db::WorkspaceRow,
    entry: &crate::worktree::WorktreeInfo,
) -> bool {
    let branch_current = entry.branch.is_none() || entry.branch == row.branch;
    // Only a removed checkout is archived, so one git lists again was re-created.
    branch_current && row.dirty == entry.is_dirty && row.state != "archived"
}

/// Register every checkout in `listing` as a workspace under the repo's
/// project, returning the wire rows in listing order.
///
/// `worktree.list` is a read path — opening the worktree menu must not cost a
/// write and a `WorkspaceUpdated` fan-out per checkout every time. One read of
/// the local workspaces establishes what is already registered; an entry whose
/// stored row already matches is returned from that read untouched, so an
/// unchanged listing does no writes and broadcasts nothing.
/// A checkout seen here for the first time is external (made with `git
/// worktree add` outside perch) and starts hidden, after Orca; `created`
/// names the one perch itself just made, which starts shown, as does one
/// that perch sessions already ran in. Rows that already exist keep their
/// visibility. A checkout moved with `git worktree move` is its old row
/// (same project and branch, old path no longer listed) at a new path.
pub(super) fn register_worktree_listing(
    app: &AppState,
    listing: &crate::worktree::WorktreeListing,
    created: Option<&str>,
) -> anyhow::Result<Vec<WorkspaceSummary>> {
    let created = created.map(|path| crate::db::canonical_path_for_host("local", path));
    let primary = listing
        .worktrees
        .iter()
        .find(|entry| entry.is_primary)
        .ok_or_else(|| anyhow::anyhow!("repository has no primary checkout"))?;
    let _guard = app.foundation_lock.lock().unwrap();
    let known: std::collections::HashMap<String, crate::db::WorkspaceRow> = app
        .db
        .list_workspaces("local", None)?
        .into_iter()
        .map(|row| (row.path.clone(), row))
        .collect();
    // Record the primary checkout's boundary before a child can implicitly
    // create it without a ref. Existing workspaces, including missing refs,
    // stay untouched; listing order need not put the primary checkout first.
    if !known.contains_key(&crate::db::canonical_path_for_host("local", &primary.path)) {
        app.db
            .create_project("local", &primary.path, None, primary.head.as_deref())?;
    }
    let mut session_cwds: Option<HashSet<String>> = None;
    let listed: HashSet<String> = listing
        .worktrees
        .iter()
        .map(|entry| crate::db::canonical_path_for_host("local", &entry.path))
        .collect();
    let project_id = known
        .get(&crate::db::canonical_path_for_host("local", &primary.path))
        .map(|row| row.project_id.clone());
    let mut workspaces = Vec::new();
    for entry in &listing.worktrees {
        let path = crate::db::canonical_path_for_host("local", &entry.path);
        if let Some(current) = known
            .get(&path)
            .filter(|row| workspace_matches_worktree(row, entry))
        {
            workspaces.push(workspace_to_wire(current.clone()));
            continue;
        }
        // An entry absent from `known` is registered now, so its current
        // head is the honest registration boundary — the same rule
        // `project.create` follows. Only a row that already exists keeps
        // whatever boundary it was given, including none.
        let moved = known.values().find(|row| {
            !known.contains_key(&path)
                && entry.branch.is_some()
                && row.branch == entry.branch
                && row.parent_workspace_id.is_some()
                && row.state != "archived"
                && Some(&row.project_id) == project_id.as_ref()
                && !listed.contains(&row.path)
        });
        let workspace = match moved {
            Some(row) => app.db.set_workspace_path(&row.id, &path)?,
            None => app.db.create_worktree_workspace(
                "local",
                &primary.path,
                &entry.path,
                entry.branch.as_deref(),
                None,
                entry.head.as_deref(),
            )?,
        };
        let mut workspace = app.db.update_workspace_git_state(
            &workspace.id,
            entry.branch.as_deref(),
            None,
            entry.is_dirty,
        )?;
        if workspace.state == "archived" {
            workspace = app.db.restore_workspace(&workspace.id)?;
        }
        if moved.is_none()
            && !known.contains_key(&path)
            && !entry.is_primary
            && created.as_ref() != Some(&path)
        {
            let cwds = session_cwds.get_or_insert_with(|| {
                let sessions = app.db.list_sessions().unwrap_or_default();
                sessions
                    .into_iter()
                    .map(|row| crate::db::canonical_path_for_host("local", &row.cwd))
                    .collect()
            });
            if !cwds.contains(&path) {
                workspace = app.db.set_workspace_hidden(&workspace.id, true)?;
            }
        }
        let project = app
            .db
            .get_project(&workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("worktree project disappeared"))?;
        let revision = next_snapshot_revision_locked(app);
        broadcast_foundation(
            app,
            ServerMessage::ProjectUpdated {
                request_id: None,
                project: project_to_wire(project),
                snapshot_epoch: app.snapshot_epoch.clone(),
                snapshot_revision: revision,
            },
        );
        let workspace = workspace_to_wire(workspace);
        broadcast_foundation(
            app,
            ServerMessage::WorkspaceUpdated {
                request_id: None,
                workspace: workspace.clone(),
                snapshot_epoch: app.snapshot_epoch.clone(),
                snapshot_revision: revision,
            },
        );
        workspaces.push(workspace);
    }
    Ok(workspaces)
}

/// Find worktrees added or removed outside perch without the worktree menu
/// open (docs/reference/worktree-scan-fingerprint.md in Orca): each local
/// project's `.git/worktrees` entries and their `gitdir` paths are the
/// fingerprint, and only a
/// changed fingerprint pays for `git worktree list`. `seen` is the caller's
/// memory between passes. A linked worktree row whose checkout git no longer
/// lists (`git worktree remove` in a shell) is archived, like perch's own
/// delete. Checkouts a create job is still making are left to the job.
/// ponytail: a project whose own path is a linked worktree (`.git` is a
/// file) is skipped.
pub(super) async fn discover_worktrees(app: &AppState, seen: &mut HashMap<String, Vec<String>>) {
    let projects = app.db.list_projects("local", false).unwrap_or_default();
    for project in projects {
        let admin = std::path::Path::new(&project.path).join(".git/worktrees");
        // Each admin dir's `gitdir` names its checkout, so a move shows too.
        let mut names: Vec<String> = std::fs::read_dir(&admin)
            .map(|dir| {
                dir.flatten()
                    .map(|entry| {
                        let gitdir = std::fs::read_to_string(entry.path().join("gitdir"));
                        format!(
                            "{:?} {}",
                            entry.file_name(),
                            gitdir.unwrap_or_default().trim()
                        )
                    })
                    .collect()
            })
            .unwrap_or_default();
        names.sort();
        if seen
            .get(&project.path)
            .map_or(names.is_empty(), |old| *old == names)
        {
            continue;
        }
        seen.insert(project.path.clone(), names);
        let mut listing = match crate::worktree::list(&project.path).await {
            Ok(listing) => listing,
            Err(error) => {
                tracing::debug!(path = %project.path, %error, "worktree discovery skipped");
                continue;
            }
        };
        let busy = worktree_jobs::busy_paths(app);
        listing
            .worktrees
            .retain(|entry| !busy.contains(&entry.path));
        if let Err(error) = register_worktree_listing(app, &listing, None) {
            tracing::warn!(path = %project.path, %error, "could not register discovered worktrees");
            continue;
        }
        let listed: HashSet<String> = listing
            .worktrees
            .iter()
            .map(|entry| crate::db::canonical_path_for_host("local", &entry.path))
            .chain(
                busy.iter()
                    .map(|path| crate::db::canonical_path_for_host("local", path)),
            )
            .collect();
        let _guard = app.foundation_lock.lock().unwrap();
        let rows = app
            .db
            .list_workspaces("local", Some(&project.id))
            .unwrap_or_default();
        for row in rows {
            if row.parent_workspace_id.is_none()
                || row.state == "archived"
                || listed.contains(&row.path)
            {
                continue;
            }
            match app.db.archive_workspace_for_path("local", &row.path) {
                Ok(Some(row)) => publish_workspace_locked(app, None, workspace_to_wire(row)),
                Ok(None) => {}
                Err(error) => {
                    tracing::warn!(path = %row.path, %error, "could not archive a removed worktree")
                }
            }
        }
    }
}

pub(super) fn handle_worktree_list(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    repo_path: String,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    tokio::spawn(async move {
        match crate::worktree::list(&repo_path).await {
            Ok(listing) => {
                // Registration is a side effect of a read. Git already told us
                // what the checkouts are, so a DB failure here must not blank
                // the worktree menu — log it and still answer the listing.
                if let Err(error) = register_worktree_listing(&app, &listing, None) {
                    tracing::warn!(%repo_path, %error, "could not register worktree checkouts");
                }
                let _ = out_tx.send(ServerMessage::WorktreeListResult {
                    request_id,
                    host_id: "local".to_string(),
                    repo_path,
                    default_root: listing.default_root,
                    base_ref: listing.base_ref,
                    refs: listing.refs,
                    worktrees: listing
                        .worktrees
                        .into_iter()
                        .map(|w| WorktreeEntry {
                            path: w.path,
                            branch: w.branch,
                            head: w.head,
                            is_primary: w.is_primary,
                            is_dirty: w.is_dirty,
                        })
                        .collect(),
                });
            }
            Err(message) => {
                let _ = out_tx.send(ServerMessage::WorktreeError {
                    request_id,
                    host_id: "local".to_string(),
                    message,
                    dirty: false,
                });
            }
        }
    });
}

/// Register a freshly created checkout as a workspace of its repo's project
/// and, when asked, nest it under `parent` (`workspace.nest` rules).
pub(super) async fn register_created(
    app: &AppState,
    repo_path: &str,
    created: &str,
    parent: Option<&str>,
) -> anyhow::Result<WorkspaceSummary> {
    let listing = crate::worktree::list(repo_path)
        .await
        .map_err(anyhow::Error::msg)?;
    let workspaces = register_worktree_listing(app, &listing, Some(created))?;
    let canonical = crate::db::canonical_path_for_host("local", created);
    let mut workspace = workspaces
        .into_iter()
        .find(|workspace| workspace.path == canonical)
        .ok_or_else(|| anyhow::anyhow!("created checkout is missing from the workspace list"))?;
    // A discovery pass may have seen the checkout between `git worktree add`
    // and now and registered it as external.
    if workspace.hidden {
        let _guard = app.foundation_lock.lock().unwrap();
        workspace = workspace_to_wire(app.db.set_workspace_hidden(&workspace.id, false)?);
        publish_workspace_locked(app, None, workspace.clone());
    }
    let Some(parent) = parent.filter(|p| !p.is_empty()) else {
        return Ok(workspace);
    };
    let _guard = app.foundation_lock.lock().unwrap();
    let nested = workspace_to_wire(app.db.set_workspace_parent(&workspace.id, Some(parent))?);
    publish_workspace_locked(app, None, nested.clone());
    Ok(nested)
}

/// Broadcast one changed workspace row. Caller holds `foundation_lock`.
fn publish_workspace_locked(
    app: &AppState,
    request_id: Option<String>,
    workspace: WorkspaceSummary,
) {
    let revision = next_snapshot_revision_locked(app);
    broadcast_foundation(
        app,
        ServerMessage::WorkspaceUpdated {
            request_id,
            workspace,
            snapshot_epoch: app.snapshot_epoch.clone(),
            snapshot_revision: revision,
        },
    );
}

pub(super) fn handle_worktree_create(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    req: crate::worktree::CreateRequest,
    parent: Option<String>,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    tokio::spawn(async move {
        let result = async {
            let created = crate::worktree::create(&req)
                .await
                .map_err(|error| anyhow::anyhow!(error.message))?;
            let workspace =
                register_created(&app, &req.repo_path, &created, parent.as_deref()).await?;
            anyhow::Ok((workspace.path.clone(), workspace))
        }
        .await;
        let _ = out_tx.send(match result {
            Ok((created, workspace)) => ServerMessage::WorktreeDone {
                request_id,
                host_id: "local".to_string(),
                action: "create".to_string(),
                path: created,
                workspace: Some(workspace),
                preserved_branch: None,
            },
            Err(err) => ServerMessage::WorktreeError {
                request_id,
                host_id: "local".to_string(),
                message: err.to_string(),
                dirty: false,
            },
        });
    });
}

/// `worktree.remove`: the checkout (and with `delete_branch`, its merged
/// branch) goes, and its workspace row is archived — history, comments and
/// buffers stay inspectable, but the sidebar no longer lists it.
#[allow(clippy::too_many_arguments)]
pub(super) fn handle_worktree_remove(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    repo_path: String,
    path: String,
    force: bool,
    delete_branch: bool,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    tokio::spawn(async move {
        let result = if delete_branch {
            crate::worktree::delete(&repo_path, &path, force).await
        } else {
            crate::worktree::remove(&repo_path, &path, force)
                .await
                .map(|()| None)
        };
        if result.is_ok() {
            let _guard = app.foundation_lock.lock().unwrap();
            match app.db.archive_workspace_for_path("local", &path) {
                Ok(Some(row)) => publish_workspace_locked(&app, None, workspace_to_wire(row)),
                Ok(None) => {}
                Err(error) => tracing::warn!(%path, %error, "could not archive removed worktree"),
            }
        }
        let _ = out_tx.send(match result {
            Ok(preserved) => ServerMessage::WorktreeDone {
                request_id,
                host_id: "local".to_string(),
                action: "remove".to_string(),
                path,
                workspace: None,
                preserved_branch: preserved.map(|b| crate::protocol::WorktreePreservedBranch {
                    name: b.name,
                    head: b.head,
                    commits: b.commits,
                    unmerged: b.unmerged,
                }),
            },
            Err(err) => ServerMessage::WorktreeError {
                request_id,
                host_id: "local".to_string(),
                message: err.message,
                dirty: err.dirty,
            },
        });
    });
}

pub(super) fn handle_worktree_branch_delete(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    repo_path: String,
    branch: String,
    expected_head: String,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let result = crate::worktree::delete_branch(&repo_path, &branch, &expected_head).await;
        let _ = out_tx.send(match result {
            Ok(()) => ServerMessage::WorktreeDone {
                request_id,
                host_id: "local".to_string(),
                action: "branchDelete".to_string(),
                path: branch,
                workspace: None,
                preserved_branch: None,
            },
            Err(err) => ServerMessage::WorktreeError {
                request_id,
                host_id: "local".to_string(),
                message: err.message,
                dirty: false,
            },
        });
    });
}

/// `workspace.pin` / `workspace.nest`: one row mutation, broadcast as
/// `workspace.updated` (which also answers the request), or an `error`.
pub(super) fn handle_workspace_mutation(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    code: &str,
    mutate: impl FnOnce(&crate::db::HistoryDb, &str) -> anyhow::Result<crate::db::WorkspaceRow>,
) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
        fail(
            &state.out_tx,
            request_id,
            "workspace_not_found",
            "workspace is not present on the local host",
            false,
        );
        return;
    };
    match mutate(&state.app.db, &workspace.id) {
        Ok(row) => publish_workspace_locked(&state.app, Some(request_id), workspace_to_wire(row)),
        Err(err) => fail(&state.out_tx, request_id, code, err.to_string(), false),
    }
}

pub(super) fn handle_project_list(
    state: &Arc<ConnState>,
    request_id: String,
    host_id: Option<String>,
    include_archived: bool,
) {
    if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id) {
        let _ = state.out_tx.send(message);
        return;
    }
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    match state.app.db.list_projects("local", include_archived) {
        Ok(projects) => {
            let _ = state.out_tx.send(ServerMessage::ProjectList {
                request_id,
                host_id: "local".to_string(),
                snapshot_epoch: state.app.snapshot_epoch.clone(),
                snapshot_revision: current_snapshot_revision_locked(&state.app),
                projects: projects.into_iter().map(project_to_wire).collect(),
            });
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "project_list_failed",
                format!("project.list failed: {err}"),
                true,
            );
        }
    }
}

pub(super) async fn handle_project_create(
    state: &Arc<ConnState>,
    request_id: String,
    host_id: Option<String>,
    path: String,
    name: Option<String>,
) {
    if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id) {
        let _ = state.out_tx.send(message);
        return;
    }
    let canonical = crate::db::canonical_path_for_host("local", &path);
    if !Path::new(&canonical).is_dir() {
        fail(
            &state.out_tx,
            request_id,
            "invalid_path",
            format!("project path is not an existing directory: {canonical}"),
            false,
        );
        return;
    }
    // Capture the registration boundary before acknowledging the project.
    // Git resolves packed refs and linked checkouts; no tree scan is needed.
    let start_snapshot = match WorkspaceTarget::new(&canonical, &canonical) {
        Ok(target) => state.app.git.head_revision(&target).await,
        Err(_) => None,
    };
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    match state.app.db.create_project(
        "local",
        &canonical,
        name.as_deref(),
        start_snapshot.as_deref(),
    ) {
        Ok((project, workspace)) => {
            let revision = next_snapshot_revision_locked(&state.app);
            let project = project_to_wire(project);
            let workspace = workspace_to_wire(workspace);
            // Publish the row event while the mutation's revision is
            // still protected by foundation_lock. The initiating
            // connection also receives the complete correlated
            // snapshot below, including the default workspace.
            broadcast_foundation(
                &state.app,
                ServerMessage::ProjectUpdated {
                    request_id: Some(request_id.clone()),
                    project,
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
            // Project creation also inserts its default workspace.
            // Publish that row at the same serialized revision so
            // already-connected clients can materialize the complete
            // project/workspace pair without waiting for a refresh.
            broadcast_foundation(
                &state.app,
                ServerMessage::WorkspaceUpdated {
                    request_id: Some(request_id.clone()),
                    workspace,
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
            // The default workspace is part of project creation. A
            // correlated snapshot gives the client its stable id and
            // active selection in one coherent payload.
            let snapshot = workspace_snapshot_locked(state, request_id.clone(), None);
            let _ = state.out_tx.send(snapshot);
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "project_create_failed",
                format!("project.create failed: {err}"),
                true,
            );
        }
    }
}

pub(super) fn handle_project_rename(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    name: String,
) {
    let name = name.trim().to_string();
    if name.is_empty() {
        fail(
            &state.out_tx,
            request_id,
            "invalid_name",
            "project name cannot be empty",
            false,
        );
        return;
    }
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(project) = local_project(&state.app, &project_id) else {
        fail(
            &state.out_tx,
            request_id,
            "project_not_found",
            "project is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.rename_project(&project.id, &name) {
        Ok(project) => {
            let revision = next_snapshot_revision_locked(&state.app);
            broadcast_foundation(
                &state.app,
                ServerMessage::ProjectUpdated {
                    request_id: Some(request_id),
                    project: project_to_wire(project),
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "project_rename_failed",
                format!("project.rename failed: {err}"),
                true,
            );
        }
    }
}

pub(super) fn handle_project_archive(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    archived: bool,
) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(project) = local_project(&state.app, &project_id) else {
        fail(
            &state.out_tx,
            request_id,
            "project_not_found",
            "project is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.set_project_archived(&project.id, archived) {
        Ok(project) => {
            let revision = next_snapshot_revision_locked(&state.app);
            broadcast_foundation(
                &state.app,
                ServerMessage::ProjectUpdated {
                    request_id: Some(request_id.clone()),
                    project: project_to_wire(project),
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
            send_workspace_snapshot_locked(state, request_id, None);
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "project_archive_failed",
                format!("project.archive failed: {err}"),
                true,
            );
        }
    }
}

pub(super) fn handle_project_focus(state: &Arc<ConnState>, request_id: String, project_id: String) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(project) = local_project(&state.app, &project_id) else {
        fail(
            &state.out_tx,
            request_id,
            "project_not_found",
            "project is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.focus_project(&project.id) {
        Ok((_project, workspace)) => {
            // Persisted focus seeds future connections. The active
            // selection for this established connection is kept in
            // ConnState, so a focus action in one tab/device cannot
            // move another client's selection.
            *state.active_project_id.lock().unwrap() = Some(project.id.clone());
            *state.active_workspace_id.lock().unwrap() = Some(workspace.id.clone());
            let revision = next_snapshot_revision_locked(&state.app);
            let _ = state.out_tx.send(ServerMessage::WorkspaceFocus {
                request_id: request_id.clone(),
                host_id: "local".to_string(),
                snapshot_epoch: state.app.snapshot_epoch.clone(),
                snapshot_revision: revision,
                active_project_id: Some(project.id),
                active_workspace_id: Some(workspace.id),
            });
            send_workspace_snapshot_locked(state, request_id, None);
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "project_focus_failed",
                format!("project.focus failed: {err}"),
                false,
            );
        }
    }
}

pub(super) fn handle_workspace_snapshot(
    state: &Arc<ConnState>,
    request_id: String,
    host_id: Option<String>,
    project_id: Option<String>,
) {
    if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id) {
        let _ = state.out_tx.send(message);
        return;
    }
    send_workspace_snapshot(state, request_id, project_id);
}

pub(super) fn handle_workspace_focus(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
        fail(
            &state.out_tx,
            request_id,
            "workspace_not_found",
            "workspace is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.focus_workspace(&workspace.id) {
        Ok(workspace) => {
            *state.active_project_id.lock().unwrap() = Some(workspace.project_id.clone());
            *state.active_workspace_id.lock().unwrap() = Some(workspace.id.clone());
            let revision = next_snapshot_revision_locked(&state.app);
            let _ = state.out_tx.send(ServerMessage::WorkspaceFocus {
                request_id,
                host_id: "local".to_string(),
                snapshot_epoch: state.app.snapshot_epoch.clone(),
                snapshot_revision: revision,
                active_project_id: Some(workspace.project_id),
                active_workspace_id: Some(workspace.id),
            });
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "workspace_focus_failed",
                format!("workspace.focus failed: {err}"),
                false,
            );
        }
    }
}

pub(super) fn handle_workspace_rename(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    name: String,
) {
    let name = name.trim().to_string();
    if name.is_empty() {
        fail(
            &state.out_tx,
            request_id,
            "invalid_name",
            "workspace name cannot be empty",
            false,
        );
        return;
    }
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
        fail(
            &state.out_tx,
            request_id,
            "workspace_not_found",
            "workspace is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.rename_workspace(&workspace.id, &name) {
        Ok(workspace) => {
            let revision = next_snapshot_revision_locked(&state.app);
            broadcast_foundation(
                &state.app,
                ServerMessage::WorkspaceUpdated {
                    request_id: Some(request_id),
                    workspace: workspace_to_wire(workspace),
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "workspace_rename_failed",
                format!("workspace.rename failed: {err}"),
                true,
            );
        }
    }
}

pub(super) fn handle_workspace_restore(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
        fail(
            &state.out_tx,
            request_id,
            "workspace_not_found",
            "workspace is not present on the local host",
            false,
        );
        return;
    };
    match state.app.db.restore_workspace(&workspace.id) {
        Ok(workspace) => {
            let revision = next_snapshot_revision_locked(&state.app);
            broadcast_foundation(
                &state.app,
                ServerMessage::WorkspaceUpdated {
                    request_id: Some(request_id),
                    workspace: workspace_to_wire(workspace),
                    snapshot_epoch: state.app.snapshot_epoch.clone(),
                    snapshot_revision: revision,
                },
            );
        }
        Err(err) => {
            fail(
                &state.out_tx,
                request_id,
                "workspace_restore_failed",
                format!("workspace.restore failed: {err}"),
                false,
            );
        }
    }
}

#[cfg(test)]
mod worktree_registration_tests {
    use super::*;

    fn row(
        branch: Option<&str>,
        dirty: bool,
        start_snapshot: Option<&str>,
    ) -> crate::db::WorkspaceRow {
        crate::db::WorkspaceRow {
            id: "w1".into(),
            project_id: "p1".into(),
            host_id: "local".into(),
            path: "/repo/wt".into(),
            name: "wt".into(),
            branch: branch.map(str::to_string),
            base_branch: None,
            dirty,
            start_snapshot: start_snapshot.map(str::to_string),
            parent_workspace_id: Some("w0".into()),
            state: "active".into(),
            created_at: 1,
            updated_at: 1,
            pinned: false,
            hidden: false,
        }
    }

    fn info(
        branch: Option<&str>,
        dirty: bool,
        head: Option<&str>,
    ) -> crate::worktree::WorktreeInfo {
        crate::worktree::WorktreeInfo {
            path: "/repo/wt".into(),
            branch: branch.map(str::to_string),
            head: head.map(str::to_string),
            is_primary: false,
            is_dirty: dirty,
        }
    }

    /// The skip must be exact: a row that is *not* current has to be written and
    /// broadcast, or the menu keeps showing a stale branch/dirty marker.
    #[test]
    fn only_a_row_git_would_not_change_is_treated_as_current() {
        assert!(workspace_matches_worktree(
            &row(Some("feat"), true, Some("sha1")),
            &info(Some("feat"), true, Some("sha1"))
        ));
        // dirty is a plain overwrite, so any difference needs the write.
        assert!(!workspace_matches_worktree(
            &row(Some("feat"), false, Some("sha1")),
            &info(Some("feat"), true, Some("sha1"))
        ));
        // A moved branch needs the write.
        assert!(!workspace_matches_worktree(
            &row(Some("feat"), true, Some("sha1")),
            &info(Some("other"), true, Some("sha1"))
        ));
        // Detached HEAD sends branch: None, which COALESCE would not clear.
        assert!(workspace_matches_worktree(
            &row(Some("feat"), true, Some("sha1")),
            &info(None, true, Some("sha1"))
        ));
        // Missing and recorded creation refs are both immutable; a new HEAD
        // alone must not turn this read path into a metadata write.
        assert!(workspace_matches_worktree(
            &row(Some("feat"), true, None),
            &info(Some("feat"), true, Some("sha1"))
        ));
        assert!(workspace_matches_worktree(
            &row(Some("feat"), true, None),
            &info(Some("feat"), true, None)
        ));
        assert!(workspace_matches_worktree(
            &row(Some("feat"), true, Some("sha1")),
            &info(Some("feat"), true, Some("sha2"))
        ));
    }
}
