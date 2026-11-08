//! Mods on this core (`crate::mods` holds the rules and the files): `perch mod` (`/agent/mod/*`) lists,
//! turns one off or on and asks the person's screen to show one; the person's own screen does the
//! same over `mods.list`/`mods.set`, and loads a mod's code from `GET /mods/file`. There is no
//! approval: a mod is trusted code the person's page runs, so the code route is the person's alone
//! (an agent token cannot fetch it) and everything else here is list, off/on and show.
use super::sub_sessions::{fail, internal, Failure};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::layouts;
use crate::mods::{self, Error};
use serde_json::{json, Value};

fn failure(error: Error) -> Failure {
    match error {
        Error::Invalid(text) => fail(StatusCode::BAD_REQUEST, text),
        Error::NotFound(text) => fail(StatusCode::NOT_FOUND, text),
        Error::Io(error) => internal("use the mods folder", error),
    }
}

fn id_of(body: &Value) -> Result<&str, Failure> {
    body["id"]
        .as_str()
        .filter(|text| !text.is_empty())
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "a mod request needs `id`"))
}

pub(super) fn agent_list(app: &AppState) -> Result<Value, Failure> {
    let policy = app.settings.get().mods;
    Ok(json!({
        "mods": mods::scan(&app.memory_root, &policy),
        "layouts": layouts::scan(&app.memory_root, &policy),
        "layout": layouts::current(&app.memory_root),
        "off": policy.is_off(),
        "folder": app.memory_root.display().to_string(),
    }))
}

/// `perch mod layout <id|stock>`: choose the window layout; `stock` (or an empty id) is Perch as shipped.
pub(super) fn agent_set_layout(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = body["id"]
        .as_str()
        .filter(|id| !id.is_empty() && *id != "stock");
    let policy = app.settings.get().mods;
    layouts::set_current(&app.memory_root, &policy, id).map_err(failure)?;
    Ok(json!({ "layout": id }))
}

/// `perch mod enable|disable <id>`.
pub(super) fn agent_set_enabled(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let enabled = body["enabled"].as_bool().unwrap_or(true);
    let policy = app.settings.get().mods;
    mods::set_enabled(&app.memory_root, &policy, id, enabled).map_err(failure)?;
    Ok(json!({ "id": id, "enabled": enabled }))
}

/// `perch mod open <id>`: ask the person's screen to show an enabled mod now.
pub(super) fn agent_open(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let policy = app.settings.get().mods;
    if !mods::scan(&app.memory_root, &policy)
        .iter()
        .any(|m| m.id == id && m.enabled)
    {
        return Err(fail(
            StatusCode::BAD_REQUEST,
            format!("no enabled mod \"{id}\""),
        ));
    }
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsOpen {
            mod_id: id.to_string(),
        }));
    Ok(json!({ "id": id }))
}

/// `GET /mods/file?id=`: a mod's code for the person's own page to import. A person's token only.
pub(super) async fn file(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> axum::response::Response {
    if let Err(status) = authorize_request(&app, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    let Some(id) = params.get("id") else {
        return (StatusCode::BAD_REQUEST, "id is required").into_response();
    };
    let policy = app.settings.get().mods;
    match mods::source(&app.memory_root, &policy, id) {
        Ok(code) => (
            [
                ("content-type", "text/javascript; charset=utf-8"),
                ("x-content-type-options", "nosniff"),
                ("cache-control", "no-store"),
            ],
            code,
        )
            .into_response(),
        Err(error) => {
            let (status, text) = failure(error);
            (status, text).into_response()
        }
    }
}

fn state_message(app: &AppState, request_id: String, error: Option<String>) -> ServerMessage {
    let policy = app.settings.get().mods;
    ServerMessage::ModsState {
        request_id,
        mods: mods::scan(&app.memory_root, &policy),
        layouts: layouts::scan(&app.memory_root, &policy),
        layout: layouts::current(&app.memory_root),
        safe_mode: policy.is_off(),
        policy,
        folder: app.memory_root.join("mods").display().to_string(),
        error,
    }
}

pub(super) fn handle_list(state: &Arc<ConnState>, request_id: String) {
    let _ = state
        .out_tx
        .send(state_message(&state.app, request_id, None));
}

/// A person's click: turn one mod off or on.
pub(super) fn handle_set(state: &Arc<ConnState>, request_id: String, id: String, op: String) {
    let app = &state.app;
    let policy = app.settings.get().mods;
    let outcome = match op.as_str() {
        "enable" => mods::set_enabled(&app.memory_root, &policy, &id, true),
        "disable" => mods::set_enabled(&app.memory_root, &policy, &id, false),
        "layout" => layouts::set_current(
            &app.memory_root,
            &policy,
            Some(id.as_str()).filter(|id| !id.is_empty()),
        ),
        _ => Err(Error::Invalid("ops are enable, disable and layout".into())),
    };
    let error = outcome.err().map(|error| error.to_string());
    let _ = state.out_tx.send(state_message(app, request_id, error));
}

/// Tells every client when the mods folder or a mod's state changes, so a mod an agent just wrote
/// shows up without anyone visiting Settings.
// ponytail: a 2 s rescan of small folders, not a file watcher; the ceiling is a change taking up
// to 2 s to show, and the upgrade path is `notify` on the mods folder.
pub(super) fn spawn_watch(app: AppState) {
    tokio::spawn(async move {
        type Seen = (Vec<mods::ModInfo>, Vec<layouts::LayoutInfo>, Option<String>);
        let mut seen: Option<Seen> = None;
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(2));
        loop {
            tick.tick().await;
            let (root, policy) = (app.memory_root.clone(), app.settings.get().mods);
            let Ok(now) = tokio::task::spawn_blocking(move || {
                (
                    mods::scan(&root, &policy),
                    layouts::scan(&root, &policy),
                    layouts::current(&root),
                )
            })
            .await
            else {
                continue;
            };
            if seen.as_ref().is_some_and(|before| *before != now) {
                let _ = app
                    .hub
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::ModsChanged {}));
            }
            seen = Some(now);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    /// An agent lists, turns off and on, and opens a mod; opening reaches the person's screen only
    /// for an enabled one. A mod needs no approval: it is listed working the moment it is written.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_agent_lists_toggles_and_opens_a_mod_that_needed_no_approval() {
        let root = std::env::temp_dir().join(format!("perch-mods-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let token = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let call = |route: &'static str, body: Value| {
            let token = token.clone();
            async move {
                let mut full = json!({"session": "lead"});
                full.as_object_mut()
                    .unwrap()
                    .extend(body.as_object().unwrap().clone());
                request(
                    address,
                    "POST",
                    &format!("/agent/mod/{route}"),
                    &[("Authorization", &format!("Bearer {token}"))],
                    &full.to_string(),
                )
                .await
            }
        };
        let (_, listed) = call("list", json!({})).await;
        let home = std::path::PathBuf::from(listed["folder"].as_str().unwrap());
        let folder = home.join("mods").join("board");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("main.js"), "export default () => {}").unwrap();
        std::fs::create_dir_all(home.join("layouts")).unwrap();
        std::fs::write(
            home.join("layouts").join("solo.json"),
            r#"{"type":"block","content":"mod:board"}"#,
        )
        .unwrap();
        std::fs::write(home.join("layouts").join("bad.json"), "{").unwrap();
        let mut screen = app.hub.hub_events_tx.subscribe();

        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["id"], "board");
        assert_eq!(listed["mods"][0]["enabled"], true);
        assert_eq!(call("open", json!({"id": "board"})).await.0, 200);
        let shown = screen.try_recv().expect("the screen is told");
        assert!(matches!(&*shown, ServerMessage::ModsOpen { mod_id } if mod_id == "board"));

        assert_eq!(
            call("enable", json!({"id": "board", "enabled": false}))
                .await
                .0,
            200
        );
        assert_eq!(call("open", json!({"id": "board"})).await.0, 400);
        assert!(screen.try_recv().is_err());
        assert_eq!(
            call("enable", json!({"id": "nope", "enabled": false}))
                .await
                .0,
            404
        );

        // A layout is chosen only if it parses; `stock` goes back to Perch as shipped.
        assert_eq!(call("layout", json!({"id": "bad"})).await.0, 400);
        assert_eq!(call("layout", json!({"id": "solo"})).await.0, 200);
        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["layout"], "solo");
        assert_eq!(listed["layouts"].as_array().unwrap().len(), 2);
        assert_eq!(call("layout", json!({"id": "stock"})).await.0, 200);
        assert_eq!(call("list", json!({})).await.1["layout"], Value::Null);
        let _ = std::fs::remove_dir_all(&root);
    }
}
