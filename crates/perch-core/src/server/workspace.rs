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
    tokio::spawn(async move {
        match crate::worktree::list(&repo_path).await {
            Ok(listing) => {
                let _ = out_tx.send(ServerMessage::WorktreeListResult {
                    request_id,
                    host_id: "local".to_string(),
                    repo_path,
                    default_root: listing.default_root,
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

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_worktree_create(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    repo_path: String,
    branch: String,
    new_branch: bool,
    path: Option<String>,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let result =
            crate::worktree::create(&repo_path, &branch, new_branch, path.as_deref()).await;
        let _ = out_tx.send(match result {
            Ok(created) => ServerMessage::WorktreeDone {
                request_id,
                host_id: "local".to_string(),
                action: "create".to_string(),
                path: created,
                workspace: None,
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

pub(super) fn handle_worktree_remove(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    repo_path: String,
    path: String,
    force: bool,
) {
    if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let result = crate::worktree::remove(&repo_path, &path, force).await;
        let _ = out_tx.send(match result {
            Ok(()) => ServerMessage::WorktreeDone {
                request_id,
                host_id: "local".to_string(),
                action: "remove".to_string(),
                path,
                workspace: None,
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

pub(super) fn handle_project_create(
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
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    match state
        .app
        .db
        .create_project("local", &canonical, name.as_deref())
    {
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
