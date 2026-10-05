//! `surface.*` / `viewer.presentation.*` arm bodies. The storage rules live
//! in `crate::surfaces`; this only maps results to replies. Resources of a
//! remote workspace are refused by the store (open them on their own host).

use super::*;
use crate::surfaces::{self as store, PresentationUpdate, SurfaceKind, SurfaceLocator};

fn reply<T>(
    state: &Arc<ConnState>,
    request_id: String,
    result: Result<T, store::SurfaceError>,
    ok: impl FnOnce(String, T) -> ServerMessage,
) {
    let message = match result {
        Ok(value) => ok(request_id, value),
        Err(error) => request_error(
            Some(request_id),
            Some(error.code().into()),
            error.to_string(),
            matches!(error, store::SurfaceError::Storage(_)),
        ),
    };
    let _ = state.out_tx.send(message);
}

pub(super) fn handle_open(
    state: &Arc<ConnState>,
    request_id: String,
    viewer_id: String,
    workspace_id: String,
    kind: SurfaceKind,
    locator: SurfaceLocator,
) {
    let result = store::open(&state.app.db, &viewer_id, &workspace_id, kind, &locator);
    reply(state, request_id, result, |request_id, surface| {
        ServerMessage::SurfaceOpened {
            request_id,
            surface,
        }
    });
}

pub(super) fn handle_list(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let result = store::list(&state.app.db, &workspace_id);
    reply(state, request_id, result, |request_id, surfaces| {
        ServerMessage::SurfaceListResult {
            request_id,
            workspace_id,
            surfaces,
        }
    });
}

pub(super) fn handle_close(
    state: &Arc<ConnState>,
    request_id: String,
    viewer_id: String,
    workspace_id: String,
    resource_id: String,
) {
    let result = store::close(&state.app.db, &viewer_id, &workspace_id, &resource_id);
    reply(state, request_id, result, |request_id, ()| {
        ServerMessage::SurfaceClosed {
            request_id,
            workspace_id,
            resource_id,
        }
    });
}

fn presentation_reply(
    state: &Arc<ConnState>,
    request_id: String,
    result: Result<store::ViewerPresentation, store::SurfaceError>,
) {
    reply(state, request_id, result, |request_id, presentation| {
        ServerMessage::ViewerPresentation {
            request_id,
            presentation,
        }
    });
}

pub(super) fn handle_presentation_get(
    state: &Arc<ConnState>,
    request_id: String,
    viewer_id: String,
    workspace_id: String,
) {
    let result = store::get_presentation(&state.app.db, &viewer_id, &workspace_id);
    presentation_reply(state, request_id, result);
}

pub(super) fn handle_presentation_set(
    state: &Arc<ConnState>,
    request_id: String,
    viewer_id: String,
    workspace_id: String,
    presentation: PresentationUpdate,
) {
    let result = store::set_presentation(&state.app.db, &viewer_id, &workspace_id, &presentation);
    presentation_reply(state, request_id, result);
}

pub(super) fn handle_import(
    state: &Arc<ConnState>,
    request_id: String,
    viewer_id: String,
    workspace_id: String,
    files: Vec<String>,
    session_order: Vec<String>,
) {
    let result = store::import_legacy(
        &state.app.db,
        &viewer_id,
        &workspace_id,
        &files,
        &session_order,
    );
    presentation_reply(state, request_id, result);
}
