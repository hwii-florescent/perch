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
}
