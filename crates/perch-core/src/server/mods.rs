//! `perch mod` (`/agent/mod/*`): list, enable, disable and approve mods on this core (`crate::mods`
//! holds the rules and the files; the policy is `settings.mods`).
//!
//! Mods are global to this computer, so any session of this core may list them, and may turn one
//! off or back on: turning off is the safe direction, and turning on approves nothing. Approving is
//! a person's alone, exactly as `perch start`: it acts only when a client typed that exact line in
//! the caller's own terminal a moment ago, which an agent cannot do from inside its shell. The
//! policy itself is set through the settings route, which an agent token cannot reach.
use super::sub_sessions::{fail, internal, Failure};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::mods::{self, Error};
use crate::mods_run::{self, Spec};
use serde_json::{json, Value};

/// A short hash prefix is enough to name what was looked at; less than this is a guess.
const MIN_HASH_CHARS: usize = 6;

fn failure(error: Error) -> Failure {
    match error {
        Error::Invalid(text) => fail(StatusCode::BAD_REQUEST, text),
        Error::NotFound(text) => fail(StatusCode::NOT_FOUND, text),
        Error::Conflict(text) => fail(StatusCode::CONFLICT, text),
        Error::Io(error) => internal("use the mods folder", error),
    }
}

fn text_of<'a>(body: &'a Value, key: &str) -> Result<&'a str, Failure> {
    body[key]
        .as_str()
        .filter(|text| !text.is_empty() && !text.contains(char::is_whitespace))
        .ok_or_else(|| {
            fail(
                StatusCode::BAD_REQUEST,
                format!("a mod request needs `{key}`"),
            )
        })
}

pub(super) fn agent_list(app: &AppState) -> Result<Value, Failure> {
    let policy = app.settings.get().mods;
    let found = mods::scan(&app.memory_root, &policy).map_err(failure)?;
    Ok(json!({
        "mods": found,
        "safeMode": policy.is_off(),
        "policy": policy,
        "folder": app.memory_root.join("mods").display().to_string(),
    }))
}

pub(super) fn agent_set_enabled(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = text_of(body, "id")?;
    let enabled = body["enabled"].as_bool().unwrap_or(true);
    let policy = app.settings.get().mods;
    mods::set_enabled(&app.memory_root, &policy, id, enabled).map_err(failure)?;
    Ok(json!({ "id": id, "enabled": enabled }))
}

/// `perch mod run <id> <action>`: run one action of an Active mod and answer with what happened.
/// Approving the mod is what allows this; the caller needs no further permission.
pub(super) async fn agent_run(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let (id, action_id) = (text_of(body, "id")?, text_of(body, "action")?);
    let invoked = json!({ "invokedBy": caller.session_id });
    let session = Some(caller.session_id.as_str());
    Ok(json!(
        run_action(app, id, action_id, invoked, session).await?
    ))
}

/// `perch mod open <id> [panel]`: ask the person's screen to show an Active mod's panel now. It only
/// shows the sandboxed page the person already approved, so no further permission is needed.
pub(super) fn agent_open(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = text_of(body, "id")?;
    let policy = app.settings.get().mods;
    let (manifest, _) = mods::load_active(&app.memory_root, &policy, id).map_err(failure)?;
    let panel = match body["panel"].as_str() {
        Some(panel) => manifest.panels.iter().find(|p| p.id == panel),
        None => manifest.panels.first(),
    }
    .ok_or_else(|| {
        fail(
            StatusCode::BAD_REQUEST,
            format!("mod \"{id}\" has no such panel"),
        )
    })?;
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsOpen {
            mod_id: manifest.id.clone(),
            panel_id: panel.id.clone(),
        }));
    Ok(json!({ "id": id, "panel": panel.id }))
}

/// Tells every client when the mods folder or a mod's status changes, so a mod an agent just wrote
/// (or one a person just approved) shows up without anyone visiting Settings.
// ponytail: a 2 s rescan of small manifests, not a file watcher; the ceiling is a change taking
// up to 2 s to show, and the upgrade path is `notify` on the mods folder.
pub(super) fn spawn_watch(app: AppState) {
    tokio::spawn(async move {
        let mut seen: Option<Vec<mods::ModInfo>> = None;
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(2));
        loop {
            tick.tick().await;
            let (root, policy) = (app.memory_root.clone(), app.settings.get().mods);
            let Ok(Ok(now)) = tokio::task::spawn_blocking(move || mods::scan(&root, &policy)).await
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

/// Every mod token starts with this, so a route that must not take one recognises it at once.
pub(super) const TOKEN_PREFIX: &str = "perch_mod_";

/// What a mod's token stands for while its command runs: the mod, the session whose event or
/// invocation started it (if any), and what the person approved it to need.
#[derive(Clone, Debug)]
pub(super) struct ModCaller {
    pub mod_id: String,
    pub session: Option<String>,
    pub required: std::collections::BTreeSet<crate::mods::Capability>,
}

impl ModCaller {
    /// What the `perch` command sends as `session` and finds in `PERCH_SESSION`.
    pub fn subject(&self) -> String {
        self.session
            .clone()
            .unwrap_or_else(|| format!("mod:{}", self.mod_id))
    }
}

struct Grant {
    caller: ModCaller,
    expires: std::time::Instant,
}

// ponytail: in this process only, keyed by the token's hash; a core restart ends every run anyway.
static GRANTS: std::sync::LazyLock<std::sync::Mutex<HashMap<String, Grant>>> =
    std::sync::LazyLock::new(Default::default);

/// A token for one run. Dropping it (the run is over) revokes it.
pub(super) struct RunToken {
    pub token: String,
    pub subject: String,
    key: String,
}

impl Drop for RunToken {
    fn drop(&mut self) {
        GRANTS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&self.key);
    }
}

fn issue(caller: ModCaller, ttl: std::time::Duration) -> RunToken {
    let hex: String = [Uuid::new_v4(), Uuid::new_v4()]
        .iter()
        .flat_map(|id| id.as_bytes().iter().map(|byte| format!("{byte:02x}")))
        .collect();
    let token = format!("{TOKEN_PREFIX}{hex}");
    let key = crate::agent_identity::hash_token(&token);
    let subject = caller.subject();
    let expires = std::time::Instant::now() + ttl;
    let mut grants = GRANTS.lock().unwrap_or_else(|e| e.into_inner());
    grants.retain(|_, grant| grant.expires > std::time::Instant::now());
    grants.insert(key.clone(), Grant { caller, expires });
    RunToken {
        token,
        subject,
        key,
    }
}

/// Who a mod token stands for, if it is live.
pub(super) fn authenticate(token: &str) -> Option<ModCaller> {
    let key = crate::agent_identity::hash_token(token);
    let grants = GRANTS.lock().unwrap_or_else(|e| e.into_inner());
    grants
        .get(&key)
        .filter(|grant| grant.expires > std::time::Instant::now())
        .map(|grant| grant.caller.clone())
}

/// The environment of a mod's command: a scoped `perch` identity and the `perch` binary on `PATH`.
fn command_env(token: &RunToken) -> Vec<(String, String)> {
    let mut env = vec![
        (perchd::agent_cli::SESSION_ENV.into(), token.subject.clone()),
        (perchd::agent_cli::TOKEN_ENV.into(), token.token.clone()),
    ];
    if let Some(binary) = crate::agent_identity::cli_binary() {
        if let Some(dir) = binary.parent() {
            let path = std::env::var_os("PATH").unwrap_or_default();
            let mut paths = vec![dir.to_path_buf()];
            paths.extend(std::env::split_paths(&path));
            if let Ok(joined) = std::env::join_paths(paths) {
                env.push(("PATH".into(), joined.to_string_lossy().into_owned()));
            }
        }
        env.push(("PERCH_BIN".into(), binary.display().to_string()));
    }
    env
}

/// What the memory routes need to act for a mod: the session the run is about (so the Project),
/// and only if the person approved the mod for it. A mod reads memory with `read-project` and
/// changes it with `write-project`; a run with no session (a person's click) has no Project.
pub(super) fn memory_identity(
    app: &AppState,
    caller: &ModCaller,
    write: bool,
) -> Result<AgentIdentity, Failure> {
    let need = if write {
        mods::Capability::WriteProject
    } else {
        mods::Capability::ReadProject
    };
    if !caller.required.contains(&need) {
        let name = if write {
            "write-project"
        } else {
            "read-project"
        };
        return Err(fail(
            StatusCode::FORBIDDEN,
            format!("mod \"{}\" was not approved for {name}; its perch-mod.toml must list it in `capabilities`", caller.mod_id),
        ));
    }
    let Some(session) = caller.session.clone() else {
        return Err(fail(
            StatusCode::BAD_REQUEST,
            "this run is not about a session, so there is no Project memory for it to use",
        ));
    };
    let workspace_id = app
        .db
        .get_session(&session)
        .map_err(|error| internal("read the session", error))?
        .and_then(|row| row.workspace_id)
        .unwrap_or_default();
    Ok(AgentIdentity {
        workspace_id,
        session_id: session,
        provider_id: "mod".into(),
        incarnation: format!("mod:{}", caller.mod_id),
    })
}

/// A token for a run of `manifest`'s command, live for as long as the run may last.
fn run_token(
    manifest: &mods::Manifest,
    session: Option<&str>,
    timeout: std::time::Duration,
) -> RunToken {
    issue(
        ModCaller {
            mod_id: manifest.id.clone(),
            session: session.map(str::to_string),
            required: manifest.required(),
        },
        timeout + std::time::Duration::from_secs(5),
    )
}

async fn run_action(
    app: &AppState,
    id: &str,
    action_id: &str,
    context: Value,
    session: Option<&str>,
) -> Result<mods_run::RunRecord, Failure> {
    let policy = app.settings.get().mods;
    let (manifest, dir) = mods::load_active(&app.memory_root, &policy, id).map_err(failure)?;
    let action = manifest
        .actions
        .iter()
        .find(|action| action.id == action_id)
        .ok_or_else(|| {
            fail(
                StatusCode::NOT_FOUND,
                format!("mod \"{id}\" has no action \"{action_id}\""),
            )
        })?;
    let token = run_token(&manifest, session, mods_run::ACTION_TIMEOUT);
    let record = mods_run::run(Spec {
        mod_id: id.into(),
        what: format!("action:{action_id}"),
        data_dir: mods::data_dir(&app.memory_root, id),
        dir,
        command: action.command.clone(),
        context: context.to_string(),
        env: command_env(&token),
        timeout: mods_run::ACTION_TIMEOUT,
    })
    .await;
    drop(token);
    Ok(record)
}

/// `GET {base}mods/panel?id=&panel=`: one panel's HTML for an Active mod, for a sandboxed iframe.
/// Authorized like every page route (a person's token; an agent token is refused), and sent with a
/// header that gives the page no network, no frames and no origin (`mods::PANEL_CSP`).
pub(super) async fn panel(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> axum::response::Response {
    if let Err(status) = authorize_request(&app, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    let (Some(id), Some(panel)) = (params.get("id"), params.get("panel")) else {
        return (StatusCode::BAD_REQUEST, "id and panel are required").into_response();
    };
    let policy = app.settings.get().mods;
    match mods::panel_html(&app.memory_root, &policy, id, panel) {
        Ok((html, _)) => (
            [
                ("content-type", "text/html; charset=utf-8"),
                ("content-security-policy", mods::PANEL_CSP),
                ("x-content-type-options", "nosniff"),
                ("referrer-policy", "no-referrer"),
                ("cache-control", "no-store"),
            ],
            html,
        )
            .into_response(),
        Err(error) => {
            let (status, text) = failure(error);
            (status, text).into_response()
        }
    }
}

/// The reply to `mods.list` and `mods.set`.
fn state_message(
    app: &AppState,
    request_id: String,
    error: Option<String>,
    run: Option<mods_run::RunRecord>,
) -> ServerMessage {
    let policy = app.settings.get().mods;
    let (found, scan_error) = match mods::scan(&app.memory_root, &policy) {
        Ok(found) => (found, None),
        Err(error) => (Vec::new(), Some(error.to_string())),
    };
    ServerMessage::ModsState {
        request_id,
        mods: found,
        safe_mode: policy.is_off(),
        policy,
        folder: app.memory_root.join("mods").display().to_string(),
        run,
        error: error.or(scan_error),
    }
}

pub(super) fn handle_list(state: &Arc<ConnState>, request_id: String) {
    let _ = state
        .out_tx
        .send(state_message(&state.app, request_id, None, None));
}

/// A person's click: approve (naming the hash they looked at), turn off or on, or run an action.
/// This is the WebSocket plane, which an agent token cannot reach, so a click is the proof.
pub(super) fn handle_set(
    state: &Arc<ConnState>,
    request_id: String,
    id: String,
    op: String,
    hash: Option<String>,
    action: Option<String>,
) {
    let app = state.app.clone();
    let policy = app.settings.get().mods;
    let outcome = match (op.as_str(), hash, action) {
        ("approve", Some(hash), _) => mods::approve(&app.memory_root, &policy, &id, &hash),
        ("enable", ..) => mods::set_enabled(&app.memory_root, &policy, &id, true),
        ("disable", ..) => mods::set_enabled(&app.memory_root, &policy, &id, false),
        ("run", _, Some(action)) => {
            let out = state.out_tx.clone();
            tokio::spawn(async move {
                let context = json!({ "invokedBy": "person" });
                let message = match run_action(&app, &id, &action, context, None).await {
                    Ok(record) => state_message(&app, request_id, None, Some(record)),
                    Err((_, error)) => state_message(&app, request_id, Some(error), None),
                };
                let _ = out.send(message);
            });
            return;
        }
        _ => Err(Error::Invalid(
            "approve needs the hash, run needs the action; ops are approve, enable, disable, run"
                .into(),
        )),
    };
    let error = outcome.err().map(|error| error.to_string());
    let _ = state
        .out_tx
        .send(state_message(&app, request_id, error, None));
}

/// `perch mod runs`: the most recent runs of actions and events, newest last.
pub(super) fn agent_runs() -> Value {
    json!({ "runs": mods_run::recent() })
}

/// Runs every `[[events]]` hook of an Active mod for `event`, in the background. Never blocks or
/// fails the caller: a mod that is off, absent or broken just does not run.
pub(super) fn fire_event(app: &AppState, event: &'static str, session: &str, agent: &str) {
    let policy = app.settings.get().mods;
    if policy.is_off() || tokio::runtime::Handle::try_current().is_err() {
        return;
    }
    let root = app.memory_root.clone();
    let context = json!({ "event": event, "session": session, "agent": agent }).to_string();
    let session = session.to_string();
    tokio::spawn(async move {
        let Ok(active) = mods::active_all(&root, &policy) else {
            return;
        };
        for (manifest, dir) in active {
            for hook in manifest.events.iter().filter(|hook| hook.on == event) {
                let token = run_token(&manifest, Some(&session), mods_run::EVENT_TIMEOUT);
                let spec = Spec {
                    mod_id: manifest.id.clone(),
                    what: format!("event:{event}"),
                    dir: dir.clone(),
                    data_dir: mods::data_dir(&root, &manifest.id),
                    command: hook.command.clone(),
                    context: context.clone(),
                    env: command_env(&token),
                    timeout: mods_run::EVENT_TIMEOUT,
                };
                tokio::spawn(async move {
                    mods_run::run(spec).await;
                    drop(token); // the run is over: the token opens nothing now
                });
            }
        }
    });
}

pub(super) fn agent_approve(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = text_of(body, "id")?;
    let typed = text_of(body, "hash")?;
    let policy = app.settings.get().mods;
    let found = mods::scan(&app.memory_root, &policy).map_err(failure)?;
    let info = found
        .iter()
        .find(|info| info.id == id)
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, format!("no mod \"{id}\"")))?;
    if typed.len() < MIN_HASH_CHARS || !info.hash.starts_with(typed) {
        return Err(fail(
            StatusCode::CONFLICT,
            format!(
                "that is not the manifest `perch mod list` shows for \"{id}\" now. Look at it \
                 again and type its hash."
            ),
        ));
    }
    let line = format!("perch mod approve {id} {typed}");
    if !app.agent_runtime.person_typed(&caller.session_id, &line) {
        return Err(fail(
            StatusCode::FORBIDDEN,
            format!(
                "only a person can approve a mod. Nothing was done. A person types `{line}` \
                 themselves in this session's terminal (in Claude or Pi, as `!{line}`)."
            ),
        ));
    }
    mods::approve(&app.memory_root, &policy, id, &info.hash).map_err(failure)?;
    Ok(json!({ "id": id, "approved": true }))
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    const PANEL: &str = "id = \"plan\"\nname = \"Plan\"\nversion = \"0.1.0\"\n\
        [[panels]]\nid = \"board\"\ntitle = \"Plan\"\nentry = \"index.html\"\n";

    /// An agent's token cannot approve a mod; a line a person typed in its terminal can, once.
    /// Turning a mod off and on is open to the agent and approves nothing.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_agent_cannot_approve_a_mod_but_a_line_a_person_typed_does() {
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

        let (status, listed) = call("list", json!({})).await;
        assert_eq!(status, 200, "{listed}");
        assert!(listed["mods"].as_array().unwrap().is_empty());
        let folder = std::path::PathBuf::from(listed["folder"].as_str().unwrap()).join("plan");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join(crate::mods::MANIFEST), PANEL).unwrap();

        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["status"]["state"], "pending", "{listed}");
        let hash = listed["mods"][0]["hash"].as_str().unwrap().to_string();

        // The agent alone: refused, nothing changes. A wrong hash never reaches the proof.
        let (status, refused) = call("approve", json!({"id": "plan", "hash": hash})).await;
        assert_eq!(status, 403, "{refused}");
        assert!(refused["error"].as_str().unwrap().contains("only a person"));
        assert_eq!(
            call("approve", json!({"id": "plan", "hash": "ffffffff"}))
                .await
                .0,
            409
        );
        // Enabling approves nothing.
        assert_eq!(
            call("enable", json!({"id": "plan", "enabled": true}))
                .await
                .0,
            200
        );
        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["status"]["state"], "pending");

        // A person's typed line is accepted once, and only for the line as typed.
        app.agent_runtime
            .note_terminal_input("lead", &format!("!perch mod approve plan {hash}\r"));
        assert_eq!(
            call("approve", json!({"id": "plan", "hash": &hash[..8]}))
                .await
                .0,
            403
        );
        let (status, done) = call("approve", json!({"id": "plan", "hash": hash})).await;
        assert_eq!(status, 200, "{done}");
        assert_eq!(
            call("approve", json!({"id": "plan", "hash": hash})).await.0,
            403
        );
        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["status"]["state"], "active");
        assert_eq!(listed["mods"][0]["approvedBy"], "person");

        // Off and on again, by the agent.
        assert_eq!(
            call("enable", json!({"id": "plan", "enabled": false}))
                .await
                .0,
            200
        );
        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["status"]["state"], "disabled");
        assert_eq!(
            call("enable", json!({"id": "nope", "enabled": true}))
                .await
                .0,
            404
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    /// A raw GET: status, the header block (lower-cased) and the body.
    async fn get(address: SocketAddr, path: &str, extra: &[(&str, &str)]) -> (u16, String, String) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut text = format!(
            "GET {path} HTTP/1.0\r\nHost: 127.0.0.1:{}\r\n",
            address.port()
        );
        for (name, value) in extra {
            text.push_str(&format!("{name}: {value}\r\n"));
        }
        text.push_str("\r\n");
        let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
        stream.write_all(text.as_bytes()).await.unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await.unwrap();
        let response = String::from_utf8_lossy(&response).into_owned();
        let (head, body) = response.split_once("\r\n\r\n").unwrap();
        let status = head.split_whitespace().nth(1).unwrap().parse().unwrap();
        (status, head.to_lowercase(), body.to_string())
    }

    const HOLD: &str = r#"[[actions]]
id = "hold"
title = "Hold"
command = ["sh", "-c", "echo \"$PERCH_SESSION $PERCH_TOKEN\" > \"$PERCH_MOD_DATA/tok\"; sleep 3"]
"#;

    /// A mod's command gets a `perch` token for the length of its run: it opens `mod list`/`runs` and
    /// the memory of the session it was started for (only if approved for `read-project` /
    /// `write-project`), nothing else, and it dies with the run.
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn a_mods_token_is_scoped_to_its_run_its_approval_and_its_session() {
        let root = std::env::temp_dir().join(format!("perch-mods-token-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let local_ui = crate::local_ui::LocalUi::in_process();
        let person = local_ui.token().to_string();
        let (address, db) = super::super::sub_sessions::tests::boot_with(&root, local_ui).await;
        let app = super::super::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let agent = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let post = |route: String, token: String, body: Value| async move {
            request(
                address,
                "POST",
                &format!("/agent/{route}"),
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };
        let (_, listed) = post("mod/list".into(), agent.clone(), json!({"session": "lead"})).await;
        let folder = std::path::PathBuf::from(listed["folder"].as_str().unwrap());
        // Two mods: one approved for the Project's memory, one that asked for nothing.
        for (id, caps) in [
            (
                "scoped",
                "capabilities = [\"read-project\", \"write-project\"]\n",
            ),
            ("plain", ""),
        ] {
            let dir = folder.join(id);
            std::fs::create_dir_all(&dir).unwrap();
            let manifest = format!("id = \"{id}\"\nname = \"{id}\"\nversion = \"1\"\n{caps}{HOLD}");
            std::fs::write(dir.join(crate::mods::MANIFEST), manifest).unwrap();
        }
        let (_, listed) = post("mod/list".into(), agent.clone(), json!({"session": "lead"})).await;
        for item in listed["mods"].as_array().unwrap() {
            let (id, hash) = (item["id"].as_str().unwrap(), item["hash"].as_str().unwrap());
            app.agent_runtime
                .note_terminal_input("lead", &format!("!perch mod approve {id} {hash}\r"));
            let (status, done) = post(
                "mod/approve".into(),
                agent.clone(),
                json!({"session": "lead", "id": id, "hash": hash}),
            )
            .await;
            assert_eq!(status, 200, "{done}");
        }
        // Start both; each writes its subject and token where the test can read them, then waits.
        let runs: Vec<_> = ["scoped", "plain"]
            .into_iter()
            .map(|id| {
                tokio::spawn(post(
                    "mod/run".into(),
                    agent.clone(),
                    json!({"session": "lead", "id": id, "action": "hold"}),
                ))
            })
            .collect();
        let mut tokens = Vec::new();
        for id in ["scoped", "plain"] {
            let file = crate::mods::data_dir(&app.memory_root, id).join("tok");
            for _ in 0..60 {
                if file.exists() && std::fs::metadata(&file).unwrap().len() > 10 {
                    break;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            let text = std::fs::read_to_string(&file).expect("the command ran");
            let (subject, token) = text.trim().split_once(' ').unwrap();
            assert_eq!(
                subject, "lead",
                "an agent-started run is about that agent's session"
            );
            assert!(token.starts_with(TOKEN_PREFIX));
            tokens.push(token.to_string());
        }
        let (scoped, plain) = (tokens[0].clone(), tokens[1].clone());

        // What a mod token opens: the lists, and the memory its approval covers.
        let ses = json!({"session": "lead"});
        assert_eq!(
            post("mod/list".into(), scoped.clone(), ses.clone()).await.0,
            200
        );
        assert_eq!(
            post("mod/runs".into(), scoped.clone(), ses.clone()).await.0,
            200
        );
        let write = json!({"session": "lead", "name": "from-mod.md", "text": "a note"});
        let (status, wrote) = post("memory/write".into(), scoped.clone(), write.clone()).await;
        assert_eq!(status, 200, "{wrote}");
        assert_eq!(wrote["entry"]["author"]["kind"], "mod");
        assert_eq!(wrote["entry"]["author"]["label"], "mod scoped");
        assert_eq!(
            post(
                "memory/read".into(),
                scoped.clone(),
                json!({"session": "lead", "name": "from-mod.md"})
            )
            .await
            .0,
            200
        );
        // The session's own agent sees who wrote it.
        let (_, files) = post("memory/list".into(), agent.clone(), ses.clone()).await;
        assert_eq!(files["files"][0]["author"]["kind"], "mod");
        // A mod that asked for nothing gets nothing; it cannot even read.
        assert_eq!(
            post("memory/write".into(), plain.clone(), write.clone())
                .await
                .0,
            403
        );
        assert_eq!(
            post("memory/list".into(), plain.clone(), ses.clone())
                .await
                .0,
            403
        );
        assert_eq!(
            post("mod/list".into(), plain.clone(), ses.clone()).await.0,
            200
        );

        // What a mod token never opens: another run's subject, every other agent route, and the
        // person's routes (the panel page, even with a valid person's page request).
        assert_eq!(
            post(
                "mod/list".into(),
                scoped.clone(),
                json!({"session": "other"})
            )
            .await
            .0,
            403
        );
        for route in [
            "spawn",
            "suggest",
            "send",
            "stop",
            "steer",
            "interrupt",
            "read",
            "list",
            "whoami",
            "report",
            "mod/approve",
            "mod/enable",
            "mod/run",
        ] {
            let (status, _) = post(route.into(), scoped.clone(), json!({"session": "lead", "id": "scoped", "hash": "abcdef0", "action": "hold", "target": "child", "text": "x"})).await;
            assert_eq!(status, 401, "{route}");
        }
        assert_eq!(
            get(
                address,
                &format!("/mods/panel?id=scoped&panel=x&token={scoped}"),
                &[]
            )
            .await
            .0,
            403
        );
        assert_eq!(
            get(
                address,
                &format!("/mods/panel?id=scoped&panel=x&token={person}"),
                &[]
            )
            .await
            .0,
            404,
            "the person's own token still works there (an active mod, no such panel)"
        );

        // The run ends and the token dies with it.
        for run in runs {
            assert_eq!(run.await.unwrap().0, 200);
        }
        assert_eq!(post("mod/list".into(), scoped, ses.clone()).await.0, 401);
        assert_eq!(post("mod/list".into(), plain, ses).await.0, 401);
        let _ = std::fs::remove_dir_all(&root);
    }

    const WITH_PANEL: &str = "id = \"board\"\nname = \"Board\"\nversion = \"1\"\n\
        [[actions]]\nid = \"hi\"\ntitle = \"Hi\"\ncommand = [\"echo\", \"hi\"]\n\
        [[panels]]\nid = \"main\"\ntitle = \"Main\"\nentry = \"index.html\"\n";

    /// A person's clicks over the socket approve and run; the panel page needs a person's token and
    /// is sent locked down, and only while the mod is Active.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_person_approves_and_runs_over_the_socket_and_a_panel_is_served_locked_down() {
        use futures::{SinkExt, StreamExt};
        let root = std::env::temp_dir().join(format!("perch-mods-ui-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let local_ui = crate::local_ui::LocalUi::in_process();
        let person = local_ui.token().to_string();
        let (address, db) = super::super::sub_sessions::tests::boot_with(&root, local_ui).await;
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let agent = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let (mut socket, _) = tokio_tungstenite::connect_async(
            crate::hub::socket_request(&format!("ws://{address}/ws"), Some(&person)).unwrap(),
        )
        .await
        .unwrap();
        let mut ask = async |message: Value| -> Value {
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    message.to_string(),
                ))
                .await
                .unwrap();
            loop {
                let next = tokio::time::timeout(std::time::Duration::from_secs(10), socket.next())
                    .await
                    .unwrap()
                    .unwrap()
                    .unwrap();
                if let tokio_tungstenite::tungstenite::Message::Text(text) = next {
                    let value: Value = serde_json::from_str(&text).unwrap();
                    if value["type"] == "mods.state" {
                        return value;
                    }
                }
            }
        };
        let listed = ask(json!({"type": "mods.list", "requestId": "1"})).await;
        assert_eq!(listed["policy"]["mode"], "ask");
        let dir = std::path::PathBuf::from(listed["folder"].as_str().unwrap()).join("board");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(crate::mods::MANIFEST), WITH_PANEL).unwrap();
        std::fs::write(dir.join("index.html"), "<p>board</p>").unwrap();

        let listed = ask(json!({"type": "mods.list", "requestId": "2"})).await;
        let item = &listed["mods"][0];
        assert_eq!(item["status"]["state"], "pending");
        let preview: Vec<&str> = item["preview"]
            .as_array()
            .unwrap()
            .iter()
            .map(|l| l.as_str().unwrap())
            .collect();
        assert_eq!(preview, ["action hi: echo hi", "panel main: index.html"]);
        let hash = item["hash"].as_str().unwrap().to_string();
        let panel = "/mods/panel?id=board&panel=main";
        let with = |token: &str| format!("{panel}&token={token}");

        // Not approved: not served, even to a person.
        assert_eq!(get(address, &with(&person), &[]).await.0, 400);
        // A stale hash approves nothing; the right one does.
        let stale = ask(json!({"type": "mods.set", "requestId": "3", "id": "board", "op": "approve", "hash": "0000000000000000"})).await;
        assert!(
            stale["error"].as_str().unwrap().contains("changed"),
            "{stale}"
        );
        assert_eq!(stale["mods"][0]["status"]["state"], "pending");
        let done = ask(json!({"type": "mods.set", "requestId": "4", "id": "board", "op": "approve", "hash": hash})).await;
        assert_eq!(done["mods"][0]["status"]["state"], "active", "{done}");
        let ran = ask(json!({"type": "mods.set", "requestId": "5", "id": "board", "op": "run", "action": "hi"})).await;
        assert_eq!(ran["run"]["ok"], true, "{ran}");
        assert_eq!(ran["run"]["output"].as_str().unwrap().trim(), "hi");

        // The page: a person gets it with the lock-down header; no token or an agent's token do not.
        let (status, head, body) = get(address, &with(&person), &[]).await;
        assert_eq!((status, body.as_str()), (200, "<p>board</p>"));
        for needle in [
            "content-security-policy: sandbox allow-scripts; default-src 'none'",
            "x-content-type-options: nosniff",
            "cache-control: no-store",
        ] {
            assert!(head.contains(needle), "{needle}\n{head}");
        }
        assert_eq!(get(address, panel, &[]).await.0, 401);
        assert_eq!(get(address, &with(&agent), &[]).await.0, 403);
        assert_eq!(
            get(
                address,
                &format!("/mods/panel?id=board&panel=nope&token={person}"),
                &[]
            )
            .await
            .0,
            404
        );

        // Off, and the page is gone with it.
        let off =
            ask(json!({"type": "mods.set", "requestId": "6", "id": "board", "op": "disable"}))
                .await;
        assert_eq!(off["mods"][0]["status"]["state"], "disabled");
        assert_eq!(get(address, &with(&person), &[]).await.0, 400);
        let _ = std::fs::remove_dir_all(&root);
    }

    /// `perch mod open` reaches the person's screen only for an Active mod's own panel.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn open_shows_only_an_active_mods_own_panel() {
        let root = std::env::temp_dir().join(format!("perch-mods-open-{}", Uuid::new_v4()));
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
        let folder = std::path::PathBuf::from(listed["folder"].as_str().unwrap()).join("board");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("board.html"), "<p>hi</p>").unwrap();
        std::fs::write(
            folder.join(crate::mods::MANIFEST),
            "id = \"board\"\nname = \"Board\"\nversion = \"1\"\n\
             [[panels]]\nid = \"main\"\ntitle = \"Board\"\nentry = \"board.html\"\nplacement = \"dock\"\n",
        )
        .unwrap();
        let mut screen = app.hub.hub_events_tx.subscribe();

        // Waiting for approval: nothing is shown.
        let (status, _) = call("open", json!({"id": "board"})).await;
        assert_eq!(status, 400);
        assert!(screen.try_recv().is_err());

        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["panels"][0]["placement"], "dock");
        let hash = listed["mods"][0]["hash"].as_str().unwrap().to_string();
        app.agent_runtime
            .note_terminal_input("lead", &format!("!perch mod approve board {hash}\r"));
        assert_eq!(
            call("approve", json!({"id": "board", "hash": hash}))
                .await
                .0,
            200
        );
        assert_eq!(
            call("open", json!({"id": "board", "panel": "other"}))
                .await
                .0,
            400
        );
        let (status, opened) = call("open", json!({"id": "board"})).await;
        assert_eq!(status, 200, "{opened}");
        let shown = screen.try_recv().expect("the screen is told");
        assert!(matches!(
            &*shown,
            ServerMessage::ModsOpen { mod_id, panel_id } if mod_id == "board" && panel_id == "main"
        ));
        let _ = std::fs::remove_dir_all(&root);
    }

    const RUNNER: &str ="id = \"runner\"\nname = \"Runner\"\nversion = \"1\"\n\
        [[actions]]\nid = \"hello\"\ntitle = \"Hello\"\ncommand = [\"echo\", \"hello from a mod\"]\n\
        [[events]]\non = \"session.done\"\n\
        command = [\"sh\", \"-c\", \"echo $PERCH_MOD_CONTEXT > \\\"$PERCH_MOD_DATA/fired\\\"\"]\n";

    /// Nothing of a mod runs until it is approved; then its action runs, and an event reaches only the
    /// hooks for that event; a mod that is turned off again stops running.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn only_an_approved_enabled_mod_runs_and_events_reach_only_their_hooks() {
        let root = std::env::temp_dir().join(format!("perch-mods-run-{}", Uuid::new_v4()));
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
        let folder = std::path::PathBuf::from(listed["folder"].as_str().unwrap()).join("runner");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join(crate::mods::MANIFEST), RUNNER).unwrap();
        let fired = crate::mods::data_dir(&app.memory_root, "runner").join("fired");

        // Unapproved: the action is refused and an event does nothing.
        let (status, refused) = call("run", json!({"id": "runner", "action": "hello"})).await;
        assert_eq!(status, 400, "{refused}");
        assert!(refused["error"].as_str().unwrap().contains("not approved"));
        fire_event(&app, "session.done", "lead", "claude");
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        assert!(!fired.exists());

        // Approved (a person's typed line): the action runs; a different event does not fire the hook.
        let (_, listed) = call("list", json!({})).await;
        let hash = listed["mods"][0]["hash"].as_str().unwrap().to_string();
        app.agent_runtime
            .note_terminal_input("lead", &format!("!perch mod approve runner {hash}\r"));
        assert_eq!(
            call("approve", json!({"id": "runner", "hash": hash}))
                .await
                .0,
            200
        );
        let (status, ran) = call("run", json!({"id": "runner", "action": "hello"})).await;
        assert_eq!(status, 200, "{ran}");
        assert_eq!(ran["ok"], true);
        assert_eq!(ran["output"].as_str().unwrap().trim(), "hello from a mod");
        assert_eq!(
            call("run", json!({"id": "runner", "action": "nope"}))
                .await
                .0,
            404
        );
        fire_event(&app, "session.needs-you", "lead", "claude");
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        assert!(!fired.exists(), "another event's hook must not run");
        fire_event(&app, "session.done", "lead", "claude");
        for _ in 0..50 {
            if fired.exists() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        let context = std::fs::read_to_string(&fired).expect("the done hook ran");
        assert!(context.contains("\"event\":\"session.done\"") && context.contains("lead"));
        let (_, runs) = call("runs", json!({})).await;
        assert!(runs["runs"]
            .as_array()
            .unwrap()
            .iter()
            .any(|run| run["what"] == "event:session.done" && run["ok"] == true));

        // Turned off again: nothing runs.
        assert_eq!(
            call("enable", json!({"id": "runner", "enabled": false}))
                .await
                .0,
            200
        );
        assert_eq!(
            call("run", json!({"id": "runner", "action": "hello"}))
                .await
                .0,
            400
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}
