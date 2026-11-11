//! `memory.list` / `memory.get` / `memory.set` / `memory.delete` for people, and `perch memory`
//! (`/agent/memory/*`) for agents: a Project's memory files on this core (capability
//! `memory.v1`). Rules and storage are `crate::memory`; this only resolves the Project and the
//! author. Only a Project on this computer has memory here; a remote Project keeps its own on the
//! owning core, and asking for it here is an error, never a fallback to something else.
//!
//! An agent can reach only the memory of the Project its own session belongs to.

use super::sub_sessions::{fail, internal, Failure};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::memory::{self, Author, Error};
use serde_json::{json, Value};

fn check_local(app: &AppState, project_id: &str) -> Result<(), Error> {
    match app.db.get_project(project_id) {
        Ok(Some(project)) if project.host_id == "local" => Ok(()),
        Ok(Some(_)) => Err(Error::Invalid(
            "This Project is not on this computer; its memory is kept on the computer that owns it."
                .into(),
        )),
        Ok(None) => Err(Error::NotFound("This Project does not exist.".into())),
        Err(error) => Err(Error::Io(std::io::Error::other(error))),
    }
}

/// The index after `outcome`, with the refusal (and whether it was a conflict) when there was one.
fn state_message(
    app: &AppState,
    request_id: String,
    project_id: String,
    name: Option<String>,
    outcome: Result<(), Error>,
) -> ServerMessage {
    let conflict = matches!(outcome, Err(Error::Conflict(_)));
    let off = !memory::enabled(&app.memory_root, &project_id).unwrap_or(true);
    let listed = memory::list(&app.memory_root, &project_id);
    let error = outcome
        .err()
        .map(|error| error.to_string())
        .or_else(|| listed.as_ref().err().map(ToString::to_string));
    ServerMessage::MemoryState {
        request_id,
        project_id,
        files: listed.unwrap_or_default(),
        max_files: memory::MAX_FILES as u32,
        max_chars: crate::instructions::MAX_CHARS as u32,
        name,
        conflict,
        off,
        error,
    }
}

fn file_message(
    app: &AppState,
    request_id: String,
    project_id: String,
    name: String,
) -> ServerMessage {
    let result = check_local(app, &project_id)
        .and_then(|()| memory::read(&app.memory_root, &project_id, &name));
    let (file, error) = match result {
        Ok(file) => (Some(file), None),
        Err(error) => (None, Some(error.to_string())),
    };
    ServerMessage::MemoryFileState {
        request_id,
        project_id,
        name,
        file,
        error,
    }
}

fn set_message(
    app: &AppState,
    request_id: String,
    project_id: String,
    name: String,
    text: &str,
    base_revision: Option<&str>,
) -> ServerMessage {
    let outcome = check_local(app, &project_id).and_then(|()| {
        memory::write(
            &app.memory_root,
            &project_id,
            &name,
            text,
            base_revision.filter(|base| !base.is_empty()),
            &Author::person(),
        )
        .map(drop)
    });
    state_message(app, request_id, project_id, Some(name), outcome)
}

fn delete_message(
    app: &AppState,
    request_id: String,
    project_id: String,
    name: String,
    base_revision: &str,
) -> ServerMessage {
    let outcome = check_local(app, &project_id)
        .and_then(|()| memory::delete(&app.memory_root, &project_id, &name, base_revision));
    state_message(app, request_id, project_id, Some(name), outcome)
}

/// Switch the Project's agents' use of memory (`memory.enable`). The files stay and people keep
/// editing them; the answer is the index, with `off` set accordingly.
pub(super) fn handle_enable(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    enabled: bool,
) {
    let outcome = check_local(&state.app, &project_id)
        .and_then(|()| memory::set_enabled(&state.app.memory_root, &project_id, enabled));
    let _ = state.out_tx.send(state_message(
        &state.app, request_id, project_id, None, outcome,
    ));
}

pub(super) fn handle_list(state: &Arc<ConnState>, request_id: String, project_id: String) {
    let outcome = check_local(&state.app, &project_id);
    let _ = state.out_tx.send(state_message(
        &state.app, request_id, project_id, None, outcome,
    ));
}

pub(super) fn handle_get(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    name: String,
) {
    let _ = state
        .out_tx
        .send(file_message(&state.app, request_id, project_id, name));
}

pub(super) fn handle_set(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    name: String,
    text: String,
    base_revision: Option<String>,
) {
    let _ = state.out_tx.send(set_message(
        &state.app,
        request_id,
        project_id,
        name,
        &text,
        base_revision.as_deref(),
    ));
}

pub(super) fn handle_delete(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: String,
    name: String,
    base_revision: String,
) {
    let _ = state.out_tx.send(delete_message(
        &state.app,
        request_id,
        project_id,
        name,
        &base_revision,
    ));
}

/// The Project the caller's session belongs to, on this computer.
fn caller_project(app: &AppState, caller: &AgentIdentity) -> Result<String, Failure> {
    let session = app
        .db
        .get_session(&caller.session_id)
        .map_err(|error| internal("read the session", error))?;
    let from_session = session
        .as_ref()
        .and_then(|row| row.project_id.clone())
        .filter(|id| !id.is_empty());
    let project_id = match from_session {
        Some(id) => Some(id),
        None => {
            let workspace = session
                .and_then(|row| row.workspace_id)
                .filter(|id| !id.is_empty())
                .unwrap_or_else(|| caller.workspace_id.clone());
            app.db
                .get_workspace(&workspace)
                .map_err(|error| internal("read the workspace", error))?
                .map(|row| row.project_id)
        }
    };
    let project_id = project_id.ok_or_else(|| {
        fail(
            StatusCode::NOT_FOUND,
            "this session is not in a Project, so there is no project memory for it",
        )
    })?;
    check_local(app, &project_id).map_err(failure)?;
    if !memory::enabled(&app.memory_root, &project_id).map_err(failure)? {
        return Err(fail(
            StatusCode::FORBIDDEN,
            "project memory is turned off for this Project; the person can turn it on in the Project's Memory",
        ));
    }
    Ok(project_id)
}

fn failure(error: Error) -> Failure {
    match error {
        Error::Invalid(text) => fail(StatusCode::BAD_REQUEST, text),
        Error::NotFound(text) => fail(StatusCode::NOT_FOUND, text),
        Error::Conflict(text) => fail(StatusCode::CONFLICT, text),
        Error::Io(error) => internal("use the memory folder", error),
    }
}

/// Where the caller's Project keeps its memory, for `perch whoami`; `None` when it has no local
/// Project.
pub(super) fn agent_folder(app: &AppState, caller: &AgentIdentity) -> Option<String> {
    let project_id = caller_project(app, caller).ok()?;
    let folder = memory::folder(&app.memory_root, &project_id).ok()?;
    Some(folder.display().to_string())
}

fn name_of(body: &Value) -> Result<&str, Failure> {
    body["name"]
        .as_str()
        .filter(|name| !name.is_empty())
        .ok_or_else(|| {
            fail(
                StatusCode::BAD_REQUEST,
                "say which file: perch memory read <name>",
            )
        })
}

pub(super) fn agent_list(app: &AppState, caller: &AgentIdentity) -> Result<Value, Failure> {
    let project_id = caller_project(app, caller)?;
    let files = memory::list(&app.memory_root, &project_id).map_err(failure)?;
    let folder = memory::folder(&app.memory_root, &project_id).map_err(failure)?;
    Ok(json!({
        "files": files,
        "folder": folder.display().to_string(),
        "maxFiles": memory::MAX_FILES,
        "maxChars": crate::instructions::MAX_CHARS,
    }))
}

pub(super) fn agent_read(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let project_id = caller_project(app, caller)?;
    let file = memory::read(&app.memory_root, &project_id, name_of(body)?).map_err(failure)?;
    Ok(json!(file))
}

pub(super) fn agent_write(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let project_id = caller_project(app, caller)?;
    let label = super::agent_mail::sender_label(app, &caller.session_id, &caller.provider_id);
    let entry = memory::write(
        &app.memory_root,
        &project_id,
        name_of(body)?,
        body["text"].as_str().unwrap_or_default(),
        body["base"].as_str().filter(|base| !base.is_empty()),
        &Author::agent(&caller.session_id, &label),
    )
    .map_err(failure)?;
    Ok(json!({ "entry": entry }))
}

pub(super) fn agent_delete(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let project_id = caller_project(app, caller)?;
    let base = body["base"]
        .as_str()
        .filter(|base| !base.is_empty())
        .ok_or_else(|| {
            fail(
                StatusCode::BAD_REQUEST,
                "a delete names the revision you read: perch memory delete <name> --base <revision>",
            )
        })?;
    memory::delete(&app.memory_root, &project_id, name_of(body)?, base).map_err(failure)?;
    Ok(json!({ "ok": true }))
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::boot;
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    /// Memory over real HTTP against a booted core (its memory root is the temp database's
    /// folder): an agent reaches only its own Project's files, conflicts are refused with the
    /// current revision, a person's writes carry a person as author, and a remote Project has
    /// no memory here.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn memory_is_scoped_to_the_callers_project_and_never_overwrites() {
        let root = std::env::temp_dir().join(format!("perch-memory-http-{}", Uuid::new_v4()));
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let mut projects = Vec::new();
        for name in ["alpha", "beta"] {
            let path = root.join(name);
            std::fs::create_dir_all(&path).unwrap();
            let (project, workspace) = db
                .create_project("local", &path.to_string_lossy(), Some(name), None)
                .unwrap();
            for suffix in ["a", "b"] {
                let session = format!("{name}-{suffix}");
                db.create_session_in_workspace(&session, &workspace, &path.to_string_lossy())
                    .unwrap();
                db.set_cli_provider(&session, "claude").unwrap();
            }
            let token = db
                .issue(&AgentKey::new(&workspace.id, format!("{name}-a"), "claude").unwrap())
                .unwrap()
                .token;
            let other = db
                .issue(&AgentKey::new(&workspace.id, format!("{name}-b"), "claude").unwrap())
                .unwrap()
                .token;
            projects.push((
                project.id,
                format!("{name}-a"),
                token,
                format!("{name}-b"),
                other,
            ));
        }
        let call = |route: &'static str, token: String, body: Value| async move {
            request(
                address,
                "POST",
                &format!("/agent/{route}"),
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };
        let (alpha_id, alpha_session, alpha_token, other_session, other_token) =
            projects[0].clone();
        let (_, beta_session, beta_token, ..) = projects[1].clone();

        // whoami names the Project's folder; the index starts empty.
        let (status, who) = call(
            "whoami",
            alpha_token.clone(),
            json!({"session": alpha_session}),
        )
        .await;
        assert_eq!(status, 200, "{who}");
        let folder = root.join("memory").join(&alpha_id);
        assert_eq!(who["memory"].as_str(), Some(folder.to_str().unwrap()));
        let (_, listed) = call(
            "memory/list",
            alpha_token.clone(),
            json!({"session": alpha_session}),
        )
        .await;
        assert_eq!(listed["files"], json!([]));

        // A create, then the same create again (it exists), then a read.
        let write = |token: &str, session: &str, base: Option<&str>, text: &str| {
            let mut body = json!({"session": session, "name": "plan.md", "text": text});
            if let Some(base) = base {
                body["base"] = json!(base);
            }
            call("memory/write", token.to_string(), body)
        };
        let (status, created) = write(&alpha_token, &alpha_session, None, "# Plan\nfirst").await;
        assert_eq!(status, 200, "{created}");
        let revision = created["entry"]["revision"].as_str().unwrap().to_string();
        assert_eq!(created["entry"]["author"]["kind"], "agent");
        assert_eq!(
            created["entry"]["author"]["session"],
            alpha_session.as_str()
        );
        let (status, exists) = write(&alpha_token, &alpha_session, None, "again").await;
        assert_eq!(status, 409, "{exists}");
        assert!(exists["error"].as_str().unwrap().contains(&revision));
        let (_, read) = call(
            "memory/read",
            alpha_token.clone(),
            json!({"session": alpha_session, "name": "plan.md"}),
        )
        .await;
        assert_eq!(read["text"], "# Plan\nfirst");

        // Another session of the same Project shares it; a different Project sees nothing.
        let (_, shared) = call(
            "memory/list",
            other_token.clone(),
            json!({"session": other_session}),
        )
        .await;
        assert_eq!(shared["files"][0]["name"], "plan.md");
        let (_, apart) = call(
            "memory/list",
            beta_token.clone(),
            json!({"session": beta_session}),
        )
        .await;
        assert_eq!(apart["files"], json!([]));
        let (status, _) = call(
            "memory/read",
            beta_token.clone(),
            json!({"session": beta_session, "name": "plan.md"}),
        )
        .await;
        assert_eq!(status, 404);
        // A name that climbs out is refused before any file is touched.
        let (status, _) = call(
            "memory/read",
            alpha_token.clone(),
            json!({"session": alpha_session, "name": "../../history.sqlite"}),
        )
        .await;
        assert_eq!(status, 400);

        // A person edits the file; the agent's next write on the old revision conflicts.
        let ServerMessage::MemoryState {
            files,
            error,
            conflict,
            ..
        } = set_message(
            &app,
            "r1".into(),
            alpha_id.clone(),
            "plan.md".into(),
            "# Plan\nedited",
            Some(&revision),
        )
        else {
            panic!("a state reply")
        };
        assert!(error.is_none() && !conflict);
        assert_eq!(files[0].author, Author::person());
        let (status, stale) = write(&other_token, &other_session, Some(&revision), "mine").await;
        assert_eq!(status, 409, "{stale}");
        assert!(stale["error"]
            .as_str()
            .unwrap()
            .contains(&files[0].revision));
        // The person's stale write conflicts too and the reply says so.
        let ServerMessage::MemoryState {
            conflict, error, ..
        } = set_message(
            &app,
            "r2".into(),
            alpha_id.clone(),
            "plan.md".into(),
            "x",
            Some(&revision),
        )
        else {
            panic!("a state reply")
        };
        assert!(conflict && error.is_some());

        // Delete needs the current revision, from an agent and from a person.
        let (status, _) = call(
            "memory/delete",
            alpha_token.clone(),
            json!({"session": alpha_session, "name": "plan.md"}),
        )
        .await;
        assert_eq!(status, 400);
        let (status, _) = call(
            "memory/delete",
            alpha_token.clone(),
            json!({"session": alpha_session, "name": "plan.md", "base": revision}),
        )
        .await;
        assert_eq!(status, 409);
        let ServerMessage::MemoryState {
            files: after,
            error,
            ..
        } = delete_message(
            &app,
            "r3".into(),
            alpha_id.clone(),
            "plan.md".into(),
            &files[0].revision,
        )
        else {
            panic!("a state reply")
        };
        assert!(error.is_none() && after.is_empty());

        // A person reading: missing file and unknown or remote Projects are errors, not fallbacks.
        let ServerMessage::MemoryFileState { file, error, .. } =
            file_message(&app, "r4".into(), alpha_id.clone(), "plan.md".into())
        else {
            panic!("a file reply")
        };
        assert!(file.is_none() && error.is_some());
        // Off: every agent of the Project is refused and whoami names no folder, while a person
        // still lists and edits the files and the reply says `off`. On again restores access.
        memory::set_enabled(&app.memory_root, &alpha_id, false).unwrap();
        for route in ["memory/list", "memory/read"] {
            let (status, refused) = call(
                route,
                other_token.clone(),
                json!({"session": other_session, "name": "plan.md"}),
            )
            .await;
            assert_eq!(status, 403, "{route}: {refused}");
        }
        let (status, _) = write(&other_token, &other_session, Some(&revision), "x").await;
        assert_eq!(status, 403);
        let (_, who) = call(
            "whoami",
            alpha_token.clone(),
            json!({"session": alpha_session}),
        )
        .await;
        assert!(who["memory"].is_null(), "{who}");
        let ServerMessage::MemoryState {
            files, off, error, ..
        } = set_message(
            &app,
            "r4".into(),
            alpha_id.clone(),
            "mine.md".into(),
            "x",
            None,
        )
        else {
            panic!("a state reply")
        };
        assert!(off && error.is_none() && files.len() == 1, "{error:?}");
        memory::set_enabled(&app.memory_root, &alpha_id, true).unwrap();
        let (status, _) = call(
            "memory/list",
            other_token.clone(),
            json!({"session": other_session}),
        )
        .await;
        assert_eq!(status, 200);

        let remote = db
            .create_project("host-b", "/srv/remote", Some("remote"), None)
            .unwrap()
            .0;
        for project in [remote.id, "no-such-project".to_string()] {
            let ServerMessage::MemoryState { files, error, .. } =
                set_message(&app, "r5".into(), project.clone(), "a.md".into(), "x", None)
            else {
                panic!("a state reply")
            };
            assert!(files.is_empty() && error.is_some(), "{project}");
            assert!(!root.join("memory").join(&project).exists());
        }
        let _ = std::fs::remove_dir_all(root);
    }
}
