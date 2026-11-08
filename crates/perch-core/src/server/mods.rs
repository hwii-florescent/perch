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

pub(super) fn agent_list(app: &AppState, _caller: &AgentIdentity) -> Result<Value, Failure> {
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
    let record = mods_run::run(Spec {
        mod_id: id.into(),
        what: format!("action:{action_id}"),
        data_dir: mods::data_dir(&app.memory_root, id),
        dir,
        command: action.command.clone(),
        context: json!({ "invokedBy": caller.session_id }).to_string(),
        timeout: mods_run::ACTION_TIMEOUT,
    })
    .await;
    Ok(json!(record))
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
    tokio::spawn(async move {
        let Ok(active) = mods::active_all(&root, &policy) else {
            return;
        };
        for (manifest, dir) in active {
            for hook in manifest.events.iter().filter(|hook| hook.on == event) {
                tokio::spawn(mods_run::run(Spec {
                    mod_id: manifest.id.clone(),
                    what: format!("event:{event}"),
                    dir: dir.clone(),
                    data_dir: mods::data_dir(&root, &manifest.id),
                    command: hook.command.clone(),
                    context: context.clone(),
                    timeout: mods_run::EVENT_TIMEOUT,
                }));
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

    const RUNNER: &str = "id = \"runner\"\nname = \"Runner\"\nversion = \"1\"\n\
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
