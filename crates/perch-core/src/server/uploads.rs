//! Raw HTTP attachment adapter. Authorize before reading bytes; stream to a
//! bounded local file, optionally SCP it to the session's configured SSH host.
//! The caller never supplies a hostname or an arbitrary remote destination.

use super::*;
use axum::body::Body;
use std::io;
use tokio_util::io::StreamReader;

pub(super) async fn attachment_upload(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    body: Body,
) -> axum::response::Response {
    if let Err(status) = authorize_request(&state, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    if headers
        .get(axum::http::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .is_some_and(|size| size > crate::uploads::MAX_UPLOAD_BYTES)
    {
        return (StatusCode::PAYLOAD_TOO_LARGE, "file too large (max 1 GiB)").into_response();
    }
    let session_id = params
        .get("sessionId")
        .map(String::as_str)
        .unwrap_or("unknown");
    let name = params
        .get("name")
        .map(String::as_str)
        .unwrap_or("attachment");
    let remote = match remote_host(&state, &params, session_id) {
        Ok(host) => host,
        Err((status, message)) => return (status, message).into_response(),
    };
    let reader = StreamReader::new(
        body.into_data_stream()
            .map(|chunk| chunk.map_err(io::Error::other)),
    );
    let upload = match tokio::time::timeout(
        std::time::Duration::from_secs(3600),
        crate::uploads::receive(session_id, name, reader),
    )
    .await
    {
        Ok(Ok(upload)) => upload,
        Ok(Err(error)) => {
            let status = match error.kind() {
                io::ErrorKind::FileTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
                io::ErrorKind::InvalidInput => StatusCode::BAD_REQUEST,
                io::ErrorKind::TimedOut => StatusCode::REQUEST_TIMEOUT,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            return (status, format!("could not receive upload: {error}")).into_response();
        }
        Err(_) => return (StatusCode::REQUEST_TIMEOUT, "upload exceeded one hour").into_response(),
    };
    let path = if let Some(host) = remote {
        // Recheck after a potentially long upload: removal, disable, changed
        // SSH alias or session ownership cannot silently retarget this transfer.
        if remote_host(&state, &params, session_id)
            .ok()
            .flatten()
            .as_ref()
            != Some(&host)
        {
            return (
                StatusCode::CONFLICT,
                "remote target changed during upload; drop again",
            )
                .into_response();
        }
        let path =
            match crate::ssh::stage_upload(&host.ssh_host, session_id, name, upload.path()).await {
                Ok(path) => path,
                Err(error) => return (StatusCode::BAD_GATEWAY, error).into_response(),
            };
        if remote_host(&state, &params, session_id)
            .ok()
            .flatten()
            .as_ref()
            != Some(&host)
        {
            return (
                StatusCode::CONFLICT,
                "remote target changed during SCP; no path was inserted",
            )
                .into_response();
        }
        // `upload` drops its local staging copy after the transfer.
        path
    } else {
        upload.persist().to_string_lossy().into_owned()
    };
    axum::Json(serde_json::json!({"path": path, "name": crate::uploads::sanitize_filename(name)}))
        .into_response()
}

fn remote_host(
    state: &AppState,
    params: &HashMap<String, String>,
    session_id: &str,
) -> Result<Option<crate::hosts::SshHost>, (StatusCode, &'static str)> {
    let Some(host_id) = params.get("hostId") else {
        return if params.contains_key("scp") {
            Err((StatusCode::BAD_REQUEST, "SCP requires a configured host"))
        } else {
            Ok(None)
        };
    };
    if params.get("scp").map(String::as_str) != Some("1") {
        return Err((
            StatusCode::BAD_REQUEST,
            "remote uploads require explicit SCP intent",
        ));
    }
    let host = state
        .hosts
        .get(host_id)
        .filter(|host| host.enabled && host.direct_url.is_none() && !host.ssh_host.is_empty())
        .ok_or((
            StatusCode::BAD_REQUEST,
            "SSH host is disabled, missing, or not an SSH connection",
        ))?;
    let matches = if host.is_direct() {
        state
            .db
            .get_session(session_id)
            .ok()
            .flatten()
            .is_some_and(|session| session.host_id == *host_id)
    } else {
        state.hub.is_connected(host_id)
            && state
                .hub
                .remote_sessions_snapshot()
                .iter()
                .any(|session| session.id == session_id && session.host_id == *host_id)
    };
    if !matches {
        return Err((
            StatusCode::CONFLICT,
            "remote session is missing, disconnected, or belongs to another host",
        ));
    }
    Ok(Some(host))
}
