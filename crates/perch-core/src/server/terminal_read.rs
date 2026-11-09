//! Reading a session's terminal screen without a page having opened it (herdr's `pane read`): the
//! daemon's own snapshot of the terminal, by an explicit host-qualified target `<host>/<session>`.
//!
//! Two callers, two rules. The person's page (`POST {base}terminal/read`, a person's or paired
//! device's token, as every data route) may read any session of this core. An agent
//! (`POST {base}agent/terminal/read`, its own token) reads only its own session's terminal: the
//! identity the token was issued to, never a target it names. Neither starts, attaches, resizes or
//! types into anything: a missing terminal is "none", an unreachable daemon is "unknown", and a
//! session on another computer is refused (read it on that computer; nothing falls back to here).
use super::*;
use crate::agent_fleet::AgentKey;
use axum::Json;
use serde_json::{json, Value};

/// The most lines one read returns (default 50, as `perch daemon read`).
pub(super) const MAX_LINES: u64 = 2000;
const DEFAULT_LINES: u64 = 50;

pub(super) type ReadFailure = (StatusCode, String);

/// `<host>/<session>` (or a bare session id, meaning this core's) as `(host, session)`.
pub(super) fn parse_target(target: &str) -> Result<(&str, &str), ReadFailure> {
    let (host, session) = target.split_once('/').unwrap_or(("local", target));
    let plain = |s: &str| {
        !s.is_empty()
            && s.len() <= 128
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'))
    };
    if !plain(host) || !plain(session) {
        return Err((
            StatusCode::BAD_REQUEST,
            "a terminal target is <host>/<session>".into(),
        ));
    }
    Ok((host, session))
}

pub(super) fn lines_of(body: &Value) -> Result<usize, ReadFailure> {
    match body.get("lines") {
        None | Some(Value::Null) => Ok(DEFAULT_LINES as usize),
        Some(lines) => match lines.as_u64() {
            Some(n) if (1..=MAX_LINES).contains(&n) => Ok(n as usize),
            _ => Err((
                StatusCode::BAD_REQUEST,
                format!("lines is 1 to {MAX_LINES}"),
            )),
        },
    }
}

/// The last `lines` lines of a screen, without the empty rows under its last output.
fn last_lines(text: &str, lines: usize) -> String {
    let all: Vec<&str> = text.trim_end().lines().collect();
    all[all.len().saturating_sub(lines.max(1))..].join("\n")
}

/// The daemon key of `session`'s terminal on this core: the running agent's own key when the
/// lifecycle has exactly one for the session, else the one its row names.
fn key_of(app: &AppState, session: &str) -> Result<AgentKey, ReadFailure> {
    let row = app
        .db
        .get_session(session)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("no session {session}")))?;
    if !(row.host_id.is_empty() || row.host_id == "local")
        || app.hub.route_for_session(session).is_some()
    {
        return Err(remote(&row.host_id));
    }
    let running: Vec<AgentKey> = app
        .agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .map(|snapshot| snapshot.key)
        .filter(|key| key.session_id == session)
        .collect();
    if let [only] = running.as_slice() {
        return Ok(only.clone());
    }
    let provider = row.cli_provider_id.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            format!("session {session} has no terminal"),
        )
    })?;
    let workspace = row
        .workspace_id
        .unwrap_or_else(|| format!("session-{session}"));
    AgentKey::new(&workspace, session, &provider)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

fn remote(host: &str) -> ReadFailure {
    (
        StatusCode::NOT_IMPLEMENTED,
        format!(
            "that terminal runs on {}; read it on that computer (nothing is read from here instead)",
            if host.is_empty() { "another computer" } else { host }
        ),
    )
}

/// What the daemon shows for `key` now, as the read's answer.
fn snapshot(target: &str, key: &AgentKey, lines: usize) -> Result<Value, ReadFailure> {
    let id = crate::agent_runtime::terminal_key(key);
    let unknown = |error: String| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("the terminal daemon did not answer, so its state is unknown: {error}"),
        )
    };
    let client = crate::daemon::client().map_err(|e| unknown(e.to_string()))?;
    let session = client
        .session(&id)
        .map_err(|e| unknown(e.to_string()))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("{target} has no terminal running or kept (never started here, or closed)"),
            )
        })?;
    let screen = client.snapshot(&id).map_err(|e| unknown(e.to_string()))?;
    Ok(json!({
        "target": target,
        "text": last_lines(&screen.text, lines),
        "title": screen.title,
        "alive": session.alive,
    }))
}

/// One read for `target`, already authorised for it.
pub(super) async fn read(app: &AppState, target: &str, lines: usize) -> Result<Value, ReadFailure> {
    let (host, session) = parse_target(target)?;
    if host != "local" {
        return Err(remote(host));
    }
    let key = key_of(app, session)?;
    let target = format!("local/{session}");
    tokio::task::spawn_blocking(move || snapshot(&target, &key, lines))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
}

/// An agent's read: its own session's terminal and nothing else. The key is the token's identity
/// (the terminal it was launched in), not looked up from a target.
pub(super) async fn read_own(
    identity: &crate::agent_identity::AgentIdentity,
    body: &Value,
) -> Result<Value, ReadFailure> {
    if let Some(target) = body["target"].as_str() {
        let (host, session) = parse_target(target)?;
        if host != "local" || session != identity.session_id {
            return Err((
                StatusCode::FORBIDDEN,
                "an agent reads only its own session's terminal".into(),
            ));
        }
    }
    let lines = lines_of(body)?;
    let key = AgentKey::new(
        &identity.workspace_id,
        &identity.session_id,
        &identity.provider_id,
    )
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let target = format!("local/{}", identity.session_id);
    tokio::task::spawn_blocking(move || snapshot(&target, &key, lines))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
}

/// `POST {base}terminal/read {target, lines?}`: the person's page reads any terminal of this core.
pub(super) async fn person_read(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> axum::response::Response {
    if let Err(status) = authorize_request(&app, &peer, &headers, &HashMap::new()) {
        return (status, "device access denied").into_response();
    }
    let outcome = match lines_of(&body) {
        Ok(lines) => read(&app, body["target"].as_str().unwrap_or_default(), lines).await,
        Err(failure) => Err(failure),
    };
    match outcome {
        Ok(value) => Json(value).into_response(),
        Err((status, error)) => (status, Json(json!({ "error": error }))).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::boot;
    use super::*;
    use crate::agent_identity::IdentityStore;

    /// A person reads any session's screen without opening it; an agent reads only its own, whatever
    /// target it names; nothing is started for a session with no terminal, and a remote target or
    /// a malformed one is refused.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_person_reads_any_terminal_and_an_agent_only_its_own() {
        let root = std::env::temp_dir().join(format!("perch-terminal-read-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let (_, workspace) = db
            .create_project("local", &nest.to_string_lossy(), Some("nest"), None)
            .unwrap();
        let cwd = nest.to_string_lossy().into_owned();
        for id in ["shown", "other", "idle"] {
            db.create_session_in_workspace(id, &workspace, &cwd)
                .unwrap();
            db.set_cli_provider(id, "terminal").unwrap();
        }
        // Two real terminals in the test daemon, as a launch makes them (keyed by session).
        let client = crate::daemon::client().unwrap();
        for (id, word) in [("shown", "first-screen"), ("other", "second-screen")] {
            let key = AgentKey::new(&workspace.id, id, "terminal").unwrap();
            client
                .create(
                    &crate::agent_runtime::terminal_key(&key),
                    vec![
                        "/bin/sh".into(),
                        "-c".into(),
                        format!("echo {word}; sleep 30"),
                    ],
                    Some(cwd.clone()),
                    vec![],
                    80,
                    24,
                )
                .unwrap();
        }
        let agent = db
            .issue(&AgentKey::new(&workspace.id, "shown", "terminal").unwrap())
            .unwrap()
            .token;
        let person = format!("Bearer {}", app.local_ui.token());
        let post = |path: &'static str, auth: String, body: Value| async move {
            request(
                address,
                "POST",
                path,
                &[("Authorization", auth.as_str())],
                &body.to_string(),
            )
            .await
        };
        let wait_for = |target: &'static str, word: &'static str| {
            let person = person.clone();
            async move {
                for _ in 0..100 {
                    let (status, body) = post(
                        "/terminal/read",
                        person.clone(),
                        json!({ "target": target }),
                    )
                    .await;
                    if status == 200 && body["text"].as_str().unwrap_or("").contains(word) {
                        return body;
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                }
                panic!("{target} never showed {word}");
            }
        };
        let read = wait_for("local/shown", "first-screen").await;
        assert_eq!(read["alive"], true);
        wait_for("local/other", "second-screen").await;
        // A bare id means this core's.
        assert_eq!(
            post("/terminal/read", person.clone(), json!({"target": "other"}))
                .await
                .0,
            200
        );
        for (body, status) in [
            (json!({"target": "local/idle"}), 404),
            (json!({"target": "local/missing"}), 404),
            (json!({"target": "elsewhere/shown"}), 501),
            (json!({"target": "local/../x"}), 400),
            (json!({"target": ""}), 400),
            (json!({"target": "local/shown", "lines": 0}), 400),
        ] {
            assert_eq!(
                post("/terminal/read", person.clone(), body.clone()).await.0,
                status,
                "{body}"
            );
        }
        // An agent token: refused on the person's route, its own terminal only on its route.
        let as_agent = format!("Bearer {agent}");
        assert_eq!(
            post(
                "/terminal/read",
                as_agent.clone(),
                json!({"target": "local/shown"})
            )
            .await
            .0,
            403
        );
        let own = post(
            "/agent/terminal/read",
            as_agent.clone(),
            json!({"session": "shown", "lines": 5}),
        )
        .await;
        assert_eq!(own.0, 200, "{:?}", own.1);
        assert!(own.1["text"].as_str().unwrap().contains("first-screen"));
        for target in ["local/other", "other", "elsewhere/shown"] {
            let (status, _) = post(
                "/agent/terminal/read",
                as_agent.clone(),
                json!({"session": "shown", "target": target}),
            )
            .await;
            assert_eq!(status, 403, "{target}");
        }
        // Naming another session as the caller is the token rule every agent route has.
        assert_eq!(
            post(
                "/agent/terminal/read",
                as_agent,
                json!({"session": "other"})
            )
            .await
            .0,
            403
        );
        for id in ["shown", "other"] {
            let key = AgentKey::new(&workspace.id, id, "terminal").unwrap();
            crate::daemon::discard(&crate::agent_runtime::terminal_key(&key));
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn targets_are_host_qualified_and_plain() {
        assert_eq!(parse_target("local/a").unwrap(), ("local", "a"));
        assert_eq!(parse_target("a").unwrap(), ("local", "a"));
        assert_eq!(parse_target("box/a").unwrap(), ("box", "a"));
        for bad in ["", "/a", "a/", "a/b/c", "a b", "local/../x"] {
            assert!(parse_target(bad).is_err(), "{bad:?}");
        }
        assert_eq!(last_lines("a\nb\nc\n\n\n", 2), "b\nc");
    }
}
