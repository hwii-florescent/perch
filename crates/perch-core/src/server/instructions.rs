//! `instructions.get` / `instructions.set`: read and save the Instructions of a Project or
//! Workspace on this core (capability `instructions.v1`). Rules live in `crate::instructions`, the
//! store in `db/instructions.rs`. Only local Projects and Workspaces have Instructions here; a
//! remote one keeps its own on the owning core.

use super::*;

/// Whether `id` names a local Project (`project`) or Workspace (`workspace`).
fn local_target(app: &AppState, scope: &str, id: &str) -> bool {
    match scope {
        "project" => app
            .db
            .get_project(id)
            .ok()
            .flatten()
            .is_some_and(|project| project.host_id == "local"),
        "workspace" => app
            .db
            .get_workspace(id)
            .ok()
            .flatten()
            .is_some_and(|workspace| workspace.host_id == "local"),
        _ => false,
    }
}

fn reply(
    state: &Arc<ConnState>,
    request_id: String,
    scope: String,
    id: String,
    error: Option<String>,
) {
    let (stored, revision) = state
        .app
        .db
        .get_instructions(&scope, &id)
        .unwrap_or_default();
    let _ = state.out_tx.send(ServerMessage::InstructionsState {
        request_id,
        scope,
        id,
        text: stored.text,
        folders: stored.folders,
        revision: revision.max(0) as u64,
        max_chars: crate::instructions::MAX_CHARS as u32,
        error,
    });
}

pub(super) fn handle_get(state: &Arc<ConnState>, request_id: String, scope: String, id: String) {
    let error = (!local_target(&state.app, &scope, &id))
        .then(|| "This Project or Workspace is not on this computer.".to_string());
    reply(state, request_id, scope, id, error);
}

pub(super) fn handle_set(
    state: &Arc<ConnState>,
    request_id: String,
    scope: String,
    id: String,
    text: String,
    folders: Vec<String>,
) {
    let error = if local_target(&state.app, &scope, &id) {
        state
            .app
            .db
            .set_instructions(&scope, &id, &text, &folders)
            .err()
            .map(|error| error.to_string())
    } else {
        Some("This Project or Workspace is not on this computer.".to_string())
    };
    reply(state, request_id, scope, id, error);
}
