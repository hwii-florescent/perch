//! `/agent/*`: the only routes an agent's token opens (`crate::agent_identity`), used by the
//! `perch` command (`perchd::agent_cli`). Own design, slice 3.
//!
//! The rules are the reverse of every other route's: these accept *only* an agent token (no
//! device token, no local UI token) and only from this machine without a proxy or a
//! browser Origin, and `authorize_request` refuses an agent token everywhere else. A token
//! authorises the run it was issued to and nothing more: the caller must also name that
//! session, so a token lifted into another session's shell is refused.
use super::*;
use crate::agent_identity::{self, AgentIdentity};
use axum::response::Response;
use axum::Json;
use serde_json::{json, Value};

fn refuse(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

/// The bearer token of a request, if it sent one.
pub(super) fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
}

fn authorize(
    state: &AppState,
    peer: &SocketAddr,
    headers: &HeaderMap,
    body: &Value,
) -> Result<AgentIdentity, (StatusCode, &'static str)> {
    if headers.contains_key(axum::http::header::ORIGIN) || !local_request(peer, headers) {
        return Err((
            StatusCode::FORBIDDEN,
            "agent requests are accepted only from this computer",
        ));
    }
    let Some(token) = bearer(headers).filter(|token| agent_identity::looks_like_agent_token(token))
    else {
        return Err((StatusCode::UNAUTHORIZED, "no agent token was sent"));
    };
    let identity = match state.db.authenticate_agent(token) {
        Ok(Some(identity)) => identity,
        Ok(None) => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "this agent token is unknown or its run has ended",
            ))
        }
        Err(error) => {
            tracing::error!(%error, "agent token lookup failed");
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Perch could not check the agent token",
            ));
        }
    };
    if body["session"].as_str() != Some(identity.session_id.as_str()) {
        return Err((
            StatusCode::FORBIDDEN,
            "this token belongs to a different session",
        ));
    }
    Ok(identity)
}

/// `POST {base}agent/whoami`: which run the token belongs to.
pub(super) async fn whoami(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    // The run's notes folder: plain files for the members of the run, never injected anywhere.
    let notes = state
        .db
        .run_of(&identity.session_id)
        .ok()
        .flatten()
        .and_then(|run| crate::native_ui::notes_dir(&run).ok())
        .map(|path| path.display().to_string());
    Json(json!({
        "session": identity.session_id,
        "workspace": identity.workspace_id,
        "provider": identity.provider_id,
        "incarnation": identity.incarnation,
        "notes": notes,
        // The Project's memory folder: plain files, never injected anywhere (`perch memory`).
        "memory": memory::agent_folder(&state, &identity),
    }))
    .into_response()
}

/// `POST {base}agent/launch`: a Perch shell's `perch __launch` asks for the identity of the agent it is
/// about to become. The bearer is the shell's launcher, which opens nothing else. The core issues
/// only to the process its own launch marker names, descended from that shell, once: an agent (or a
/// tool it runs) asking again, or any other process, gets nothing.
pub(super) async fn launch(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    if headers.contains_key(axum::http::header::ORIGIN) || !local_request(&peer, &headers) {
        return refuse(
            StatusCode::FORBIDDEN,
            "agent requests are accepted only from this computer",
        );
    }
    let Some(token) =
        bearer(&headers).filter(|token| token.starts_with(agent_identity::LAUNCHER_PREFIX))
    else {
        return refuse(StatusCode::UNAUTHORIZED, "no launcher token was sent");
    };
    let launcher = match state.db.authenticate_launcher(token) {
        Ok(Some(launcher)) => launcher,
        Ok(None) => {
            return refuse(
                StatusCode::UNAUTHORIZED,
                "this launcher is unknown or its shell has ended",
            )
        }
        Err(error) => {
            tracing::error!(%error, "launcher lookup failed");
            return refuse(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Perch could not check the launcher",
            );
        }
    };
    let provider = body["provider"].as_str().unwrap_or_default().to_string();
    let pid = body["pid"].as_u64().and_then(|pid| u32::try_from(pid).ok());
    if body["session"].as_str() != Some(launcher.session_id.as_str())
        || !crate::native_ui::PROVIDERS.contains(&provider.as_str())
        || pid.is_none_or(|pid| pid <= 1)
    {
        return refuse(
            StatusCode::BAD_REQUEST,
            "this is not a launch Perch can name",
        );
    }
    let pid = pid.unwrap_or_default();
    let app = state.clone();
    let issued = tokio::task::spawn_blocking(move || {
        let owner = AgentKey::new(
            &launcher.workspace_id,
            &launcher.session_id,
            &launcher.owner_provider_id,
        )
        .map_err(|error| error.to_string())?;
        app.agent_runtime.verify_launch(&owner, &provider, pid)?;
        app.db
            .issue_for_launch(&launcher, &provider, pid)
            .map_err(|error| {
                tracing::error!(%error, "could not issue an agent identity");
                "Perch could not issue an identity".to_string()
            })?
            .ok_or_else(|| "that agent already has its identity".to_string())
            .inspect(|_| notify_session_updated(&app, &launcher.session_id))
    })
    .await;
    match issued {
        Ok(Ok(issued)) => Json(json!({ "token": issued.token })).into_response(),
        Ok(Err(why)) => {
            tracing::info!(%why, "an agent launch was not issued an identity");
            refuse(StatusCode::FORBIDDEN, &why)
        }
        Err(_) => refuse(StatusCode::INTERNAL_SERVER_ERROR, "Perch could not launch"),
    }
}

/// `POST {base}agent/report`: leave a report on this run. A claim, never a result.
pub(super) async fn report(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    let text = body["text"].as_str().unwrap_or_default().trim();
    if text.is_empty() {
        return refuse(StatusCode::BAD_REQUEST, "a report needs text");
    }
    if text.chars().count() > perchd::agent_cli::REPORT_MAX_CHARS {
        return refuse(
            StatusCode::BAD_REQUEST,
            &format!(
                "a report is limited to {} characters",
                perchd::agent_cli::REPORT_MAX_CHARS
            ),
        );
    }
    match state.db.record_agent_report(&identity.incarnation, text) {
        Ok(true) => {
            if let Ok(child) = crate::agent_fleet::AgentKey::new(
                &identity.workspace_id,
                &identity.session_id,
                &identity.provider_id,
            ) {
                let (app, text) = (state.clone(), text.to_string());
                let _ = tokio::task::spawn_blocking(move || {
                    super::agent_mail::note_report(&app, &child, &text)
                })
                .await;
            }
            Json(json!({ "ok": true })).into_response()
        }
        Ok(false) => refuse(StatusCode::UNAUTHORIZED, "this run has ended"),
        Err(error) => {
            tracing::error!(%error, "agent report could not be saved");
            refuse(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Perch could not save the report",
            )
        }
    }
}

fn answer(result: Result<Value, sub_sessions::Failure>) -> Response {
    match result {
        Ok(body) => Json(body).into_response(),
        Err((status, error)) => refuse(status, &error),
    }
}

/// `POST {base}agent/spawn`: start a sub-session (`server/sub_sessions.rs`).
pub(super) async fn spawn(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    match sub_sessions::SpawnRequest::parse(&body) {
        // Leads that may not start without asking put the task in front of the person instead.
        Ok(request) if !state.settings.get().leads_start_without_asking => {
            answer(suggestions::suggest_spawn(&state, &identity, request))
        }
        Ok(request) => answer(sub_sessions::spawn(&state, &identity, request).await),
        Err(failure) => answer(Err(failure)),
    }
}

/// `POST {base}agent/suggest`: put one or more tasks in front of the person as a card
/// (`server/suggestions.rs`). Nothing is started.
pub(super) async fn suggest(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(suggestions::suggest(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/suggestions`: the tasks still waiting for a person, with ids. Read-only.
pub(super) async fn suggestions_waiting(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(suggestions::waiting(&state, &identity)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/answer`: `perch start` / `perch dismiss`, done only when a person typed that
/// line in the caller's terminal (`suggestions::answer_typed`).
pub(super) async fn suggestion_answer(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(
            suggestions::answer_typed(
                &state,
                &identity,
                body["verb"].as_str().unwrap_or_default(),
                body["target"].as_str().unwrap_or_default(),
            )
            .await,
        ),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/list`: the caller's run and what Perch knows of each member.
pub(super) async fn list(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(sub_sessions::list(&state, &identity).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/read`: a bounded tail of one of the caller's own sub-sessions' transcript.
pub(super) async fn read(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    let Some(target) = body["target"].as_str().filter(|target| !target.is_empty()) else {
        return refuse(
            StatusCode::BAD_REQUEST,
            "say which sub-session: perch read <session> [--turns N]",
        );
    };
    let turns = match crate::child_read::check_turns(body["turns"].as_u64()) {
        Ok(turns) => turns,
        Err(error) => return refuse(StatusCode::BAD_REQUEST, &error),
    };
    answer(sub_sessions::read(&state, &identity, target, turns).await)
}

/// `POST {base}agent/search {session, query, limit?}`: other sessions of the caller's Project
/// (`server/session_search.rs`).
pub(super) async fn search(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(super::session_search::search(&state, &identity, &body).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/terminal/read {session, target?, lines?}`: the caller's own terminal screen
/// (`server/terminal_read.rs`); any other target is refused.
pub(super) async fn terminal_read(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    match super::terminal_read::read_own(&identity, &body).await {
        Ok(value) => Json(value).into_response(),
        Err((status, error)) => refuse(status, &error),
    }
}

/// `POST {base}agent/stop`: stop one of the caller's own sub-sessions.
pub(super) async fn stop(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    let Some(target) = body["target"].as_str().filter(|target| !target.is_empty()) else {
        return refuse(
            StatusCode::BAD_REQUEST,
            "say which sub-session: perch stop <session>",
        );
    };
    answer(sub_sessions::stop(&state, &identity, target).await)
}

/// `POST {base}agent/steer`: put text into the running turn of one of the caller's own sub-sessions.
/// The core refuses it from a sub-session, and for a session that is not the caller's child.
pub(super) async fn steer(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(
            crew_actions::agent_action(
                &state,
                &identity,
                crate::crew_actions::Action::Steer,
                &body,
            )
            .await,
        ),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/interrupt`: stop the current turn of one of the caller's own sub-sessions.
pub(super) async fn interrupt(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(
            crew_actions::agent_action(
                &state,
                &identity,
                crate::crew_actions::Action::Interrupt,
                &body,
            )
            .await,
        ),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/send`: queue a message for another session of the caller's run.
pub(super) async fn send(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    answer(agent_mail::send(&state, &identity, &body))
}

/// `POST {base}agent/inbox`: what was sent to the caller and what it sent, with receipts.
pub(super) async fn inbox(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(agent_mail::inbox(&state, &identity)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/cancel`: take back a message that is still queued.
pub(super) async fn cancel(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let identity = match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => identity,
        Err((status, error)) => return refuse(status, error),
    };
    let Some(id) = body["message"].as_str().filter(|id| !id.is_empty()) else {
        return refuse(
            StatusCode::BAD_REQUEST,
            "say which message: perch cancel <message>",
        );
    };
    answer(agent_mail::cancel(&state, &identity, id))
}

/// `POST {base}agent/memory/list`: the caller's Project memory index (`server/memory.rs`).
pub(super) async fn memory_list(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(memory::agent_list(&state, &identity)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/memory/read`: one file of the caller's Project memory (`server/memory.rs`).
pub(super) async fn memory_read(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(memory::agent_read(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/memory/write`: create or replace one file of the caller's Project memory; a stale base conflicts (`server/memory.rs`).
pub(super) async fn memory_write(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(memory::agent_write(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/memory/delete`: delete one file of the caller's Project memory, if still at the base revision (`server/memory.rs`).
pub(super) async fn memory_delete(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(memory::agent_delete(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/list`: every mod and whether mods are off (`server/mods.rs`).
pub(super) async fn mod_list(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_list(&state)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/enable`: turn one mod off or back on (`server/mods.rs`).
pub(super) async fn mod_enable(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(mods::agent_set_enabled(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/layout`: choose the window layout, or `stock` (`server/mods.rs`).
pub(super) async fn mod_layout(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_set_layout(&state, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/use`: show a package in place of a stock screen, or the stock screen again (`server/mods.rs`).
pub(super) async fn mod_use(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_set_use(&state, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/dom`: what the person's page drew for a mod (`server/mods.rs`).
pub(super) async fn mod_dom(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_dom(&state, &body).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/examples`: the shipped examples to copy (`server/mods.rs`).
pub(super) async fn mod_examples(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(Ok(mods::agent_examples(&state))),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/clone`: copy a shipped example, stock screen or mod into the mods or layouts folder (`server/mods.rs`).
pub(super) async fn mod_clone(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_clone(&state, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/remove`: move a mod or layout to the trash folder (`server/mods.rs`).
pub(super) async fn mod_remove(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_remove(&state, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/install`: copy mods and layouts from a GitHub repo (`server/mods.rs`).
pub(super) async fn mod_install(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_install(&state, &body).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/do`: run an app command on the person's screen (`server/mods.rs`).
pub(super) async fn mod_do(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_do(&state, &body).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/exec`: run one program on a computer from Settings > Hosts (`server/mods.rs`).
pub(super) async fn exec(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => mods::agent_exec(&state, &body).await,
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/check`: did the person's page load this mod's current files (`server/mods.rs`).
pub(super) async fn mod_check(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(_) => answer(mods::agent_check(&state, &body).await),
        Err((status, error)) => refuse(status, error),
    }
}

/// `POST {base}agent/mod/open`: show an enabled mod on the person's screen (`server/mods.rs`).
pub(super) async fn mod_open(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    match authorize(&state, &peer, &headers, &body) {
        Ok(identity) => answer(mods::agent_open(&state, &identity, &body)),
        Err((status, error)) => refuse(status, error),
    }
}

/// An agent token on a route that is not `/agent/*` is refused outright, even from loopback:
/// whoever holds one is an agent, and agents get agent operations only.
pub(super) fn carries_agent_token(headers: &HeaderMap, params: &HashMap<String, String>) -> bool {
    bearer(headers)
        .into_iter()
        .chain(params.get("token").map(String::as_str))
        .chain(cookie_value(headers, "perch_device").as_deref())
        .any(agent_identity::looks_like_agent_token)
}

#[cfg(test)]
pub(super) mod tests {
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    fn headers(token: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("host", "127.0.0.1:1".parse().unwrap());
        if let Some(token) = token {
            headers.insert("authorization", format!("Bearer {token}").parse().unwrap());
        }
        headers
    }

    #[test]
    fn an_agent_token_is_recognised_wherever_it_is_presented() {
        let token = agent_identity::mint_token();
        assert!(carries_agent_token(&headers(Some(&token)), &HashMap::new()));
        let query = HashMap::from([("token".to_string(), token.clone())]);
        assert!(carries_agent_token(&headers(None), &query));
        let mut cookie = headers(None);
        cookie.insert("cookie", format!("perch_device={token}").parse().unwrap());
        assert!(carries_agent_token(&cookie, &HashMap::new()));
        // A paired device's token and a bare request are not agent tokens.
        let device = HashMap::from([("token".to_string(), "0123abcd".to_string())]);
        assert!(!carries_agent_token(&headers(None), &device));
        assert!(!carries_agent_token(
            &headers(Some("0123abcd")),
            &HashMap::new()
        ));
    }

    #[test]
    fn the_bearer_header_is_parsed_strictly() {
        assert_eq!(
            bearer(&headers(Some("perch_agent_x"))),
            Some("perch_agent_x")
        );
        assert_eq!(bearer(&headers(None)), None);
        let mut basic = HeaderMap::new();
        basic.insert("authorization", "Basic abc".parse().unwrap());
        assert_eq!(bearer(&basic), None);
    }

    /// One request on a booted core: the status line's code and the JSON body.
    pub(in crate::server) async fn request(
        address: SocketAddr,
        method: &str,
        path: &str,
        extra_headers: &[(&str, &str)],
        body: &str,
    ) -> (u16, Value) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut text = format!(
            "{method} {path} HTTP/1.0\r\nHost: 127.0.0.1:{}\r\n",
            address.port()
        );
        for (name, value) in extra_headers {
            text.push_str(&format!("{name}: {value}\r\n"));
        }
        text.push_str(&format!(
            "Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
            body.len()
        ));
        let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
        stream.write_all(text.as_bytes()).await.unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await.unwrap();
        let response = String::from_utf8_lossy(&response).into_owned();
        let (head, body) = response.split_once("\r\n\r\n").unwrap();
        let status = head.split_whitespace().nth(1).unwrap().parse().unwrap();
        (status, serde_json::from_str(body).unwrap_or(Value::Null))
    }

    /// What an agent token may and may not do, over real HTTP against a booted core.
    /// `agent/launch` opens only with a shell's launcher and issues nothing it cannot verify: an
    /// agent token, a launcher naming another session or a provider Perch does not know, a launcher
    /// whose shell is not running, and a launcher presented anywhere else are all refused, and no
    /// identity is created by any of them.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn the_launch_route_fails_closed_and_a_launcher_opens_nothing_else() {
        use super::super::sub_sessions::tests::boot;
        let root = std::env::temp_dir().join(format!("perch-agent-launch-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let (address, db) = boot(&root).await;
        let tab = AgentKey::new("nest", "tab", "terminal").unwrap();
        let launcher = db.issue_launcher(&tab).unwrap();
        let agent = db
            .issue(&AgentKey::new("nest", "other", "claude").unwrap())
            .unwrap();
        let ask = |token: String, body: Value| async move {
            request(
                address,
                "POST",
                "/agent/launch",
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };
        let good = json!({"session": "tab", "provider": "pi", "pid": 4242});
        // An agent token is not a launcher.
        assert_eq!(ask(agent.token.clone(), good.clone()).await.0, 401);
        assert_eq!(
            ask("perch_agent_launch_unknown".into(), good.clone())
                .await
                .0,
            401
        );
        // Named wrongly: another session, an unknown provider, no or a reserved pid.
        for bad in [
            json!({"session": "other", "provider": "pi", "pid": 4242}),
            json!({"session": "tab", "provider": "rm", "pid": 4242}),
            json!({"session": "tab", "provider": "pi"}),
            json!({"session": "tab", "provider": "pi", "pid": 1}),
        ] {
            assert_eq!(ask(launcher.clone(), bad).await.0, 400);
        }
        // Well formed, but no running shell of Perch's started that process: refused.
        let (status, answer) = ask(launcher.clone(), good.clone()).await;
        assert_eq!(status, 403, "{answer}");
        assert!(db
            .active_agent_identities()
            .unwrap()
            .iter()
            .all(|i| i.session_id != "tab"));
        // The launcher opens nothing else: not an agent route, not any other.
        let whoami = json!({"session": "tab"}).to_string();
        let headers = [("Authorization", format!("Bearer {launcher}"))];
        let headers: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
        assert_eq!(
            request(address, "POST", "/agent/whoami", &headers, &whoami)
                .await
                .0,
            401
        );
        assert_ne!(
            request(address, "GET", "/pair", &headers, "").await.1["paired"],
            true
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_agent_token_opens_only_its_own_run_on_the_agent_routes() {
        let root = std::env::temp_dir().join(format!("perch-agent-http-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("history.sqlite");
        let db = Arc::new(HistoryDb::open(&db_path).unwrap());
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        let local_ui = crate::local_ui::LocalUi::in_process();
        let server = tokio::spawn(run(
            ServerOptions {
                port: 0,
                base_path: "/".into(),
                web_dist_dir: root.join("web"),
                db_path: Some(db_path),
                hosts_path: Some(root.join("hosts.json")),
                providers_path: None,
                devices_path: Some(root.join("devices.json")),
                ready_tx: Some(ready_tx),
                phone_access_port: None,
                local_ui: local_ui.clone(),
            },
            db.clone(),
            root.display().to_string(),
        ));
        let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
            .await
            .unwrap()
            .unwrap();
        let key = |session: &str| AgentKey::new("nest", session, "claude").unwrap();
        let alpha = db.issue(&key("alpha")).unwrap();
        let beta = db.issue(&key("beta")).unwrap();
        let auth = |token: &str| format!("Bearer {token}");
        let whoami = |token: String, session: &str| {
            let body = json!({ "session": session }).to_string();
            async move {
                request(
                    address,
                    "POST",
                    "/agent/whoami",
                    &[("Authorization", &token)],
                    &body,
                )
                .await
            }
        };

        // Its own run: answered with who it is.
        let (status, body) = whoami(auth(&alpha.token), "alpha").await;
        assert_eq!(status, 200, "{body}");
        assert_eq!(body["session"], "alpha");
        assert_eq!(body["workspace"], "nest");
        assert_eq!(body["provider"], "claude");
        assert_eq!(body["incarnation"], alpha.incarnation.as_str());
        assert!(
            !body.to_string().contains(&alpha.token),
            "the token is never echoed"
        );

        // Another run's name with this token, or this name with another's token: refused.
        assert_eq!(whoami(auth(&alpha.token), "beta").await.0, 403);
        assert_eq!(whoami(auth(&beta.token), "alpha").await.0, 403);
        assert_eq!(whoami(auth(&beta.token), "beta").await.0, 200);
        // No token, a malformed one and a stranger's are not agents.
        let body = json!({ "session": "alpha" }).to_string();
        assert_eq!(
            request(address, "POST", "/agent/whoami", &[], &body)
                .await
                .0,
            401
        );
        assert_eq!(whoami(auth("0123abcd"), "alpha").await.0, 401);
        assert_eq!(
            whoami(auth(&agent_identity::mint_token()), "alpha").await.0,
            401
        );
        // Agent routes are for this computer and not for a browser page or a proxy.
        let with = |name: &'static str, value: &'static str| {
            [
                ("Authorization", auth(&alpha.token)),
                (name, value.to_string()),
            ]
        };
        for (name, value) in [
            ("Origin", "http://127.0.0.1"),
            ("X-Forwarded-For", "203.0.113.9"),
        ] {
            let headers = with(name, value);
            let headers: Vec<(&str, &str)> =
                headers.iter().map(|(n, v)| (*n, v.as_str())).collect();
            assert_eq!(
                request(address, "POST", "/agent/whoami", &headers, &body)
                    .await
                    .0,
                403
            );
        }

        // The token is not general authority, even from loopback: other routes refuse it. A
        // loopback caller with no token has none either; only the local UI token opens them.
        let (_, anonymous) = request(address, "GET", "/pair", &[], "").await;
        assert_eq!(anonymous["paired"], false);
        let (_, local) = request(
            address,
            "GET",
            "/pair",
            &[("Authorization", &auth(local_ui.token()))],
            "",
        )
        .await;
        assert_eq!(local["paired"], true);
        // And the local UI token opens no agent route.
        assert_eq!(whoami(auth(local_ui.token()), "alpha").await.0, 401);
        let (_, agent) = request(
            address,
            "GET",
            "/pair",
            &[("Authorization", &auth(&alpha.token))],
            "",
        )
        .await;
        assert_eq!(agent["paired"], false);
        let (_, query) = request(
            address,
            "GET",
            &format!("/pair?token={}", alpha.token),
            &[],
            "",
        )
        .await;
        assert_eq!(query["paired"], false);
        // And a device cookie does not open the agent routes.
        let cookie = "perch_device=0123abcd";
        assert_eq!(
            request(
                address,
                "POST",
                "/agent/whoami",
                &[("Cookie", cookie)],
                &body
            )
            .await
            .0,
            401
        );

        // Reports: kept on the run, bounded, and only while the run lives.
        let report = |token: String, text: String| async move {
            let body = json!({ "session": "alpha", "text": text }).to_string();
            request(
                address,
                "POST",
                "/agent/report",
                &[("Authorization", &token)],
                &body,
            )
            .await
        };
        assert_eq!(
            report(auth(&alpha.token), "finished the parser".into())
                .await
                .0,
            200
        );
        assert_eq!(
            db.agent_report(&alpha.incarnation).unwrap().unwrap().0,
            "finished the parser"
        );
        assert_eq!(report(auth(&alpha.token), "  ".into()).await.0, 400);
        let too_long = "x".repeat(perchd::agent_cli::REPORT_MAX_CHARS + 1);
        assert_eq!(report(auth(&alpha.token), too_long).await.0, 400);
        assert_eq!(
            report(auth(&beta.token), "as someone else".into()).await.0,
            403
        );

        // A new launch of the session makes the old token stale; a confirmed exit ends the new.
        let relaunched = db.issue(&key("alpha")).unwrap();
        assert_eq!(
            whoami(auth(&alpha.token), "alpha").await.0,
            401,
            "stale incarnation"
        );
        assert_eq!(report(auth(&alpha.token), "late".into()).await.0, 401);
        assert_eq!(whoami(auth(&relaunched.token), "alpha").await.0, 200);
        db.revoke_session(&key("alpha")).unwrap();
        assert_eq!(
            whoami(auth(&relaunched.token), "alpha").await.0,
            401,
            "ended run"
        );
        assert_eq!(
            whoami(auth(&beta.token), "beta").await.0,
            200,
            "other runs are unaffected"
        );

        server.abort();
        let _ = server.await;
        let _ = std::fs::remove_dir_all(root);
    }

    /// The address file is what the `perch` command reads on every call: it names this core, and
    /// a stopped core withdraws it. (A private directory: parallel tests boot cores too.)
    #[test]
    fn a_core_publishes_its_address_and_withdraws_it() {
        let dir = std::env::temp_dir().join(format!("perch-core-file-{}", Uuid::new_v4()));
        let published = CoreFile::publish_in(dir.clone(), 4711, "/base/", None).unwrap();
        let address = perchd::agent_cli::read_core_file(&dir).unwrap();
        assert_eq!(
            (address.pid, address.port, address.base_path.as_str()),
            (std::process::id(), 4711, "/base/")
        );
        assert_eq!(
            address.local_token, None,
            "a desktop core publishes no token"
        );
        drop(published);
        // A headless core publishes its local token in the same private file, and its debug
        // form never shows it.
        let published =
            CoreFile::publish_in(dir.clone(), 4711, "/base/", Some("t".repeat(40).as_str()));
        let address = perchd::agent_cli::read_core_file(&dir).unwrap();
        assert_eq!(
            address.local_token.as_deref(),
            Some("t".repeat(40).as_str())
        );
        assert!(!format!("{address:?}").contains(&"t".repeat(40)));
        let published = published.unwrap();
        drop(published);
        assert!(perchd::agent_cli::read_core_file(&dir).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}
