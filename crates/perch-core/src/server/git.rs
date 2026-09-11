//! `git.*` arm bodies, the `spawn_git_*` functions, and the git error
//! mappers. Pure move from `server.rs` — see the refactor plan's Phase 3.
//! No logic changed.
//!
//! `route_git_review_request` (federated routing, shared with review.rs's
//! still-unmoved arms) and `wall_clock_millis` (used well beyond git) stay
//! in `mod.rs` as cross-domain infrastructure; this module calls them via
//! `super::`.

use super::*;

/// Resolve a durable local workspace for a Git operation. Git callers never
/// receive a root path from the client: the DB row is authoritative and the
/// target canonicalizes that row before opening a subprocess.
fn git_workspace_target(app: &AppState, workspace_id: &str) -> Result<WorkspaceTarget, String> {
    let workspace = app
        .db
        .resolve_workspace(workspace_id)
        .map_err(|error| format!("workspace {workspace_id:?} is unavailable: {error}"))?;
    if workspace.host_id != "local" {
        return Err(format!(
            "Git access is not available on workspace host {}",
            workspace.host_id
        ));
    }
    WorkspaceTarget::new(workspace.id, workspace.path)
        .map_err(|error| format!("workspace {workspace_id:?} is not a valid Git target: {error}"))
}

pub(super) fn git_error_response(request_id: String, error: GitError) -> ServerMessage {
    let code = match error {
        GitError::InvalidTarget(_) | GitError::InvalidPath(_) => "invalid_target",
        GitError::CommandFailed { .. } => "git_command_failed",
        GitError::TimedOut => "git_timeout",
        GitError::OutputLimit => "git_output_limit",
        GitError::InvalidRef(_) => "invalid_ref",
        GitError::InvalidPatch(_) => "invalid_patch",
        GitError::NoStagedChanges => "no_staged_changes",
        GitError::ConfirmationRequired => "confirmation_required",
        GitError::ConfirmationMismatch(_) => "confirmation_mismatch",
        GitError::Io(_) => "git_io_error",
        GitError::Parse(_) => "git_parse_error",
    };
    request_error(
        Some(request_id),
        Some(code.to_string()),
        error.to_string(),
        false,
    )
}

fn git_workspace_error(request_id: String, message: String) -> ServerMessage {
    request_error(
        Some(request_id),
        Some("workspace_unavailable".to_string()),
        message,
        false,
    )
}

/// Resolve `workspace_id` to a `WorkspaceTarget`, or send a
/// `git_workspace_error` reply and return `None`. This is the
/// `git_workspace_target(&app, &workspace_id)` resolve-or-send-error prelude
/// used at the top of every git.* arm; callers keep the original
/// `let target = match ... { Some(target) => target, None => return };`
/// shape.
pub(super) fn resolve_git_target_or_fail(
    app: &AppState,
    workspace_id: &str,
    request_id: &str,
    out_tx: &UnboundedSender<ServerMessage>,
) -> Option<WorkspaceTarget> {
    match git_workspace_target(app, workspace_id) {
        Ok(target) => Some(target),
        Err(message) => {
            let _ = out_tx.send(git_workspace_error(request_id.to_string(), message));
            None
        }
    }
}

fn spawn_git_status(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    include_ignored: bool,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app
            .git
            .status(&target, source_control::StatusOptions { include_ignored })
            .await
        {
            Ok(status) => {
                let _ = out_tx.send(ServerMessage::GitStatusResult {
                    request_id,
                    workspace_id,
                    status,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_refs(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.branch_refs(&target).await {
            Ok(refs) => {
                let _ = out_tx.send(ServerMessage::GitRefsResult {
                    request_id,
                    workspace_id,
                    refs,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_git_diff(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    target: crate::source_control::DiffTarget,
    include_untracked: bool,
    ignore_whitespace: bool,
    context_lines: Option<u32>,
    path: Option<String>,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let workspace_target =
            match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
                Some(target) => target,
                None => return,
            };
        let options = DiffOptions {
            target,
            include_untracked,
            ignore_whitespace,
            context_lines: context_lines.unwrap_or(3),
            path,
        };
        match app.git.diff(&workspace_target, options).await {
            Ok(diff) => {
                let mut source_revisions = BTreeMap::new();
                for file in &diff.files {
                    if let Some(path) = file.old_path.as_deref() {
                        if let Ok(source) = app
                            .git
                            .review_source(&workspace_target, &diff.target, path, "old")
                            .await
                        {
                            source_revisions.insert(format!("{path}:old"), source.revision);
                        }
                    }
                    if let Some(path) = file.new_path.as_deref() {
                        if let Ok(source) = app
                            .git
                            .review_source(&workspace_target, &diff.target, path, "new")
                            .await
                        {
                            source_revisions.insert(format!("{path}:new"), source.revision);
                        }
                    }
                }
                let source_revisions = (!source_revisions.is_empty()).then_some(source_revisions);
                let source_revision = source_revisions.as_ref().map(|revisions| {
                    let encoded = serde_json::to_vec(revisions).unwrap_or_default();
                    let digest = Sha256::digest(encoded);
                    digest.iter().map(|byte| format!("{byte:02x}")).collect()
                });
                let _ = out_tx.send(ServerMessage::GitDiffResult {
                    request_id,
                    workspace_id,
                    target: diff.target,
                    files: diff.files,
                    hunk_count: diff.hunk_count,
                    truncated: diff.truncated,
                    source_revision,
                    source_revisions,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

const GIT_PREVIEW_TTL_MS: i64 = 60_000;

fn git_operation_name(operation: source_control::DestructiveOperation) -> String {
    match operation {
        source_control::DestructiveOperation::Commit => "commit".to_string(),
        source_control::DestructiveOperation::Discard(mode) => {
            format!(
                "discard:{}",
                serde_json::to_string(&mode).unwrap_or_default()
            )
        }
    }
}

fn git_preview_wire(
    preview_id: String,
    operation: String,
    workspace_id: String,
    paths: Vec<String>,
    status: source_control::GitStatus,
    message: Option<String>,
    expires_at: i64,
) -> crate::protocol::GitPreviewReceipt {
    crate::protocol::GitPreviewReceipt {
        preview_id,
        operation,
        workspace_id,
        paths,
        status,
        message,
        expires_at,
    }
}

fn send_git_action_error(
    out_tx: &UnboundedSender<ServerMessage>,
    request_id: String,
    message: impl Into<String>,
) {
    fail(out_tx, request_id, "git_action_failed", message, false);
}

fn spawn_git_path_action(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    paths: Option<Vec<String>>,
    patch: Option<String>,
    stage: bool,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let result = match (paths, patch) {
            (Some(paths), None) if !paths.is_empty() => {
                if stage {
                    app.git.stage_paths(&target, &paths).await
                } else {
                    app.git.unstage_paths(&target, &paths).await
                }
            }
            (None, Some(patch)) if !patch.is_empty() => {
                if stage {
                    app.git.stage_patch(&target, &patch).await
                } else {
                    app.git.unstage_patch(&target, &patch).await
                }
            }
            _ => Err(GitError::InvalidPatch(
                "exactly one non-empty paths or patch value is required".to_string(),
            )),
        };
        match result {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_discard_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    mode: DiscardMode,
    paths: Vec<String>,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.preview_discard(&target, mode, &paths).await {
            Ok(preview) => {
                let preview_id = Uuid::new_v4().to_string();
                let expires_at = wall_clock_millis().saturating_add(GIT_PREVIEW_TTL_MS);
                let operation = git_operation_name(preview.operation);
                let paths_json = match serde_json::to_string(&preview.paths) {
                    Ok(json) => json,
                    Err(error) => {
                        send_git_action_error(&out_tx, request_id, error.to_string());
                        return;
                    }
                };
                if let Err(error) = app.db.insert_git_preview(
                    &preview_id,
                    &operation,
                    &workspace_id,
                    &paths_json,
                    &preview.status_fingerprint,
                    None,
                    None,
                    expires_at,
                ) {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
                let wire = git_preview_wire(
                    preview_id,
                    operation,
                    workspace_id,
                    preview.paths,
                    preview.status,
                    None,
                    expires_at,
                );
                let _ = out_tx.send(ServerMessage::GitPreviewResult {
                    request_id,
                    preview: wire,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_discard(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    preview_id: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let Some(row) =
            (match app
                .db
                .consume_git_preview(&preview_id, &workspace_id, wall_clock_millis())
            {
                Ok(row) => row,
                Err(error) => {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
            })
        else {
            send_git_action_error(
                &out_tx,
                request_id,
                "preview is unknown, expired, consumed, or belongs to another workspace",
            );
            return;
        };
        let Some(mode) = row
            .operation
            .strip_prefix("discard:")
            .and_then(parse_discard_mode)
        else {
            send_git_action_error(&out_tx, request_id, "preview is not a discard operation");
            return;
        };
        let paths: Vec<String> = match serde_json::from_str(&row.paths_json) {
            Ok(paths) => paths,
            Err(error) => {
                send_git_action_error(&out_tx, request_id, error.to_string());
                return;
            }
        };
        let confirmation = ActionConfirmation::from_verified_parts(
            workspace_id.clone(),
            source_control::DestructiveOperation::Discard(mode),
            paths,
            row.status_fingerprint,
            row.message_digest,
        );
        match app.git.discard(&target, confirmation).await {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn parse_discard_mode(value: &str) -> Option<DiscardMode> {
    serde_json::from_str(value).ok()
}

fn spawn_git_commit_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    message: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.preview_commit(&target, &message).await {
            Ok(preview) => {
                let preview_id = Uuid::new_v4().to_string();
                let expires_at = wall_clock_millis().saturating_add(GIT_PREVIEW_TTL_MS);
                let operation = git_operation_name(preview.preview.operation);
                let paths_json = match serde_json::to_string(&preview.preview.paths) {
                    Ok(json) => json,
                    Err(error) => {
                        send_git_action_error(&out_tx, request_id, error.to_string());
                        return;
                    }
                };
                if let Err(error) = app.db.insert_git_preview(
                    &preview_id,
                    &operation,
                    &workspace_id,
                    &paths_json,
                    &preview.preview.status_fingerprint,
                    preview.preview.message_digest.as_deref(),
                    Some(&preview.message),
                    expires_at,
                ) {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
                let wire = git_preview_wire(
                    preview_id,
                    operation,
                    workspace_id,
                    preview.preview.paths,
                    preview.preview.status,
                    Some(preview.message),
                    expires_at,
                );
                let _ = out_tx.send(ServerMessage::GitPreviewResult {
                    request_id,
                    preview: wire,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_commit(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    preview_id: String,
    message: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let Some(row) =
            (match app
                .db
                .consume_git_preview(&preview_id, &workspace_id, wall_clock_millis())
            {
                Ok(row) => row,
                Err(error) => {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
            })
        else {
            send_git_action_error(
                &out_tx,
                request_id,
                "preview is unknown, expired, consumed, or belongs to another workspace",
            );
            return;
        };
        if row.operation != "commit" {
            send_git_action_error(&out_tx, request_id, "preview is not a commit operation");
            return;
        }
        if row.message.as_deref() != Some(message.as_str()) {
            send_git_action_error(
                &out_tx,
                request_id,
                "commit message differs from the preview",
            );
            return;
        }
        let paths: Vec<String> = match serde_json::from_str(&row.paths_json) {
            Ok(paths) => paths,
            Err(error) => {
                send_git_action_error(&out_tx, request_id, error.to_string());
                return;
            }
        };
        let confirmation = ActionConfirmation::from_verified_parts(
            workspace_id.clone(),
            source_control::DestructiveOperation::Commit,
            paths,
            row.status_fingerprint,
            row.message_digest,
        );
        match app
            .git
            .commit(
                &target,
                CommitRequest {
                    message,
                    confirmation,
                },
            )
            .await
        {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

pub(super) fn handle_git_status(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    include_ignored: bool,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_status(state, request_id, workspace_id, include_ignored);
}

pub(super) fn handle_git_refs(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_refs(state, request_id, workspace_id);
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_git_diff(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    target: source_control::DiffTarget,
    include_untracked: bool,
    ignore_whitespace: bool,
    context_lines: Option<u32>,
    path: Option<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_diff(
        state,
        request_id,
        workspace_id,
        target,
        include_untracked,
        ignore_whitespace,
        context_lines,
        path,
    );
}

pub(super) fn handle_git_stage(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    paths: Option<Vec<String>>,
    patch: Option<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_path_action(state, request_id, workspace_id, paths, patch, true);
}

pub(super) fn handle_git_unstage(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    paths: Option<Vec<String>>,
    patch: Option<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_path_action(state, request_id, workspace_id, paths, patch, false);
}

pub(super) fn handle_git_discard_preview(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    mode: DiscardMode,
    paths: Vec<String>,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_discard_preview(state, request_id, workspace_id, mode, paths);
}

pub(super) fn handle_git_discard(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    preview_id: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_discard(state, request_id, workspace_id, preview_id);
}

pub(super) fn handle_git_commit_preview(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    message: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_commit_preview(state, request_id, workspace_id, message);
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_git_commit(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    workspace_id: String,
    host_id: Option<String>,
    preview_id: String,
    message: String,
) {
    if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
        return;
    }
    spawn_git_commit(state, request_id, workspace_id, preview_id, message);
}
