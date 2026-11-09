//! `perch spawn`, `list` and `stop` on the core: the routes in `server/agent.rs` call these
//! with the caller already authenticated as an agent (`agent_identity`). Own design, slice 4;
//! the rules are `crate::sub_sessions`, the records `db/sub_sessions.rs`.
//!
//! A spawn is admitted and recorded in one transaction before anything is started. The child
//! is an ordinary session of the lead's Workspace, launched like one a person opens (same
//! registration, Instructions pin, identity and native bridge), except that nobody views it
//! and its first message is its task, passed on the agent's command line so no input lease
//! and no typing into a prompt is involved. A launch that cannot be shown to have started or
//! failed stays `start_unknown`; a stop that is not confirmed stays `stop_unknown`. Unknown
//! is not exit: both keep counting against the limits.
use super::*;
use crate::agent_fleet::{
    AgentRegistration, AgentState, ClientIdentity, ClientKind, ProviderCapability,
};
use crate::agent_identity::AgentIdentity;
use crate::db::{Reserved, SubSessionRow, SubSessionSpec};
use crate::sub_sessions::{self, Report, ReportSource, SubState};
use serde_json::{json, Value};

/// An error for the agent: the status to answer with and the text it reads.
pub(super) type Failure = (StatusCode, String);

pub(super) fn fail(status: StatusCode, text: impl Into<String>) -> Failure {
    (status, text.into())
}

pub(super) fn internal(context: &str, error: impl std::fmt::Display) -> Failure {
    tracing::error!(%error, "{context}");
    fail(
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Perch could not {context}"),
    )
}

/// The agents a lead may start.
pub(super) const AGENTS: [&str; 4] = ["claude", "codex", "pi", "omp"];

fn service_client() -> Result<ClientIdentity, Failure> {
    ClientIdentity::new("sub-session-launcher", "perch-core", ClientKind::Service)
        .map_err(|error| internal("name the launcher", error))
}

pub(super) fn key_of(
    app: &AppState,
    session_id: &str,
    provider: &str,
) -> Result<AgentKey, Failure> {
    let row = app
        .db
        .get_session(session_id)
        .map_err(|error| internal("read the session", error))?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "that session no longer exists"))?;
    let workspace = row
        .workspace_id
        .unwrap_or_else(|| format!("session-{session_id}"));
    AgentKey::new(&workspace, session_id, provider)
        .map_err(|error| internal("name the session", error))
}

/// Bring a record that says "may be running" up to what perchd confirms. Only a confirmed
/// exit changes it; an unreachable daemon changes nothing.
pub(super) fn reconcile(app: &AppState, row: &SubSessionRow) -> SubState {
    if !matches!(
        row.state,
        SubState::Running | SubState::StartUnknown | SubState::StopUnknown
    ) {
        return row.state;
    }
    let Ok(key) = key_of(app, &row.child_session_id, &row.provider_id) else {
        return row.state;
    };
    if crate::daemon::session_state(&crate::agent_runtime::terminal_key(&key))
        != crate::daemon::RuntimeState::Exited
    {
        return row.state;
    }
    let settled = if row.state == SubState::StopUnknown {
        SubState::Stopped
    } else {
        SubState::Exited
    };
    match app
        .db
        .move_sub_session(&row.child_session_id, &[row.state], settled)
    {
        Ok(_) => settled,
        Err(_) => row.state,
    }
}

pub(super) struct SpawnRequest {
    pub agent: String,
    pub model: Option<String>,
    pub task: String,
    pub key: String,
    pub worktree: bool,
}

impl SpawnRequest {
    pub fn parse(body: &Value) -> Result<Self, Failure> {
        let bad = |text: String| fail(StatusCode::BAD_REQUEST, text);
        let agent = body["agent"].as_str().unwrap_or_default();
        if !AGENTS.contains(&agent) {
            return Err(bad(format!(
                "choose the agent with --agent: {}",
                AGENTS.join(", ")
            )));
        }
        let task = sub_sessions::check_task(body["task"].as_str().unwrap_or_default())
            .map_err(bad)?
            .to_string();
        let model = match body["model"].as_str() {
            Some(model) => Some(sub_sessions::check_model(model).map_err(bad)?.to_string()),
            None => None,
        };
        let key = sub_sessions::check_key(body["key"].as_str().unwrap_or_default())
            .map_err(bad)?
            .to_string();
        Ok(Self {
            agent: agent.to_string(),
            model,
            task,
            key,
            worktree: body["worktree"].as_bool().unwrap_or(false),
        })
    }
}

fn child_json(row: &SubSessionRow, state: SubState, duplicate: bool) -> Value {
    json!({
        "session": row.child_session_id,
        "agent": row.provider_id,
        "model": row.model,
        "dispatch": state.as_str(),
        "duplicate": duplicate,
    })
}

/// `perch spawn`, with the lead allowed to start without asking. Any turn may spawn (owner decision
/// 2026-11-08); the run's limits bound it.
pub(super) async fn spawn(
    app: &AppState,
    caller: &AgentIdentity,
    request: SpawnRequest,
) -> Result<Value, Failure> {
    start(app, caller, request).await
}

/// Start a sub-session of `caller`: depth, the run's limits, the key and the launch, the same for
/// `perch spawn` and a person's Start on a suggested task.
pub(super) async fn start(
    app: &AppState,
    caller: &AgentIdentity,
    request: SpawnRequest,
) -> Result<Value, Failure> {
    let lead = app
        .db
        .get_session(&caller.session_id)
        .map_err(|error| internal("read the session", error))?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "your session no longer exists"))?;
    if !(lead.host_id.is_empty() || lead.host_id == "local") {
        return Err(fail(
            StatusCode::FORBIDDEN,
            "sub-sessions can be started only from a session on this computer",
        ));
    }
    let workspace = {
        let id = lead
            .workspace_id
            .as_deref()
            .ok_or_else(|| fail(StatusCode::FORBIDDEN, "this session is not in a Workspace"))?;
        app.db
            .resolve_workspace(id)
            .map_err(|error| fail(StatusCode::FORBIDDEN, error.to_string()))?
    };
    let (_, preferences) = app
        .db
        .provider_preferences()
        .map_err(|error| internal("read the agent settings", error))?;
    if preferences
        .get(&request.agent)
        .is_some_and(|preference| !preference.enabled)
    {
        return Err(fail(
            StatusCode::FORBIDDEN,
            format!("{} is disabled in Perch's Agents settings", request.agent),
        ));
    }
    let child_id = Uuid::new_v4().to_string();
    let spec = SubSessionSpec {
        child_session_id: &child_id,
        parent_session_id: &caller.session_id,
        parent_incarnation: &caller.incarnation,
        workspace: &workspace,
        cwd: &lead.cwd,
        provider_id: &request.agent,
        model: request.model.as_deref(),
        spawn_key: &request.key,
        task: &request.task,
    };
    let row = match app
        .db
        .reserve_sub_session(&spec)
        .map_err(|error| internal("record the sub-session", error))?
    {
        Reserved::Refused(refusal) => {
            use sub_sessions::Refusal;
            let status = match refusal {
                Refusal::Concurrent(_) | Refusal::Descendants(_) => StatusCode::CONFLICT,
                Refusal::Depth => StatusCode::FORBIDDEN,
            };
            return Err(fail(status, refusal.message()));
        }
        Reserved::Existing(row) => {
            let state = reconcile(app, &row);
            return Ok(child_json(&row, state, true));
        }
        Reserved::New(row) => row,
    };

    let mut cwd = lead.cwd.clone();
    if request.worktree {
        cwd = place_in_worktree(app, &row, &workspace, &request.task, None).await?;
    }

    let launch_app = app.clone();
    let launch_row = row.clone();
    let launched = tokio::task::spawn_blocking(move || launch(&launch_app, &launch_row, &cwd))
        .await
        .map_err(|error| internal("start the sub-session", error))?;
    match launched {
        Ok(()) => {
            let _ = app
                .db
                .move_sub_session(&child_id, &[SubState::Starting], SubState::Running);
            Ok(child_json(&row, SubState::Running, false))
        }
        Err(launch_error) => {
            if launch_error.confirmed_absent {
                discard(app, &row);
            } else {
                let _ = app.db.move_sub_session(
                    &child_id,
                    &[SubState::Starting],
                    SubState::StartUnknown,
                );
            }
            Err(fail(StatusCode::BAD_GATEWAY, launch_error.message))
        }
    }
}

/// A child that was recorded and then confirmed never to have started leaves nothing behind.
fn discard(app: &AppState, row: &SubSessionRow) {
    if let Ok(key) = key_of(app, &row.child_session_id, &row.provider_id) {
        let _ = app.agent_runtime.remove(&key);
    }
    if let Err(error) = app.db.delete_session(&row.child_session_id) {
        tracing::warn!(%error, "could not remove a sub-session that never started");
    }
}

/// `perch spawn --worktree`: make the child a checkout of the lead's repository, registered under
/// the lead's Workspace, and move its session and record there. Returns the directory it starts in. A
/// failure at any step discards the child, which has not started. `path` is the checkout's
/// location; `None` is Perch's default (`~/.perch/worktrees/<repo>/<branch>`).
async fn place_in_worktree(
    app: &AppState,
    row: &SubSessionRow,
    lead_workspace: &crate::db::WorkspaceRow,
    task: &str,
    path: Option<String>,
) -> Result<String, Failure> {
    match make_worktree(app, lead_workspace, task, path).await {
        Ok((checkout, created)) => {
            if let Err(error) =
                app.db
                    .move_child_to_workspace(&row.child_session_id, &checkout, &created)
            {
                discard(app, row);
                return Err(internal("place the sub-session in its checkout", error));
            }
            Ok(created)
        }
        Err(message) => {
            discard(app, row);
            Err(fail(StatusCode::BAD_GATEWAY, message))
        }
    }
}

/// A checkout of the lead's repository for the child, registered under the lead's Workspace.
async fn make_worktree(
    app: &AppState,
    parent: &crate::db::WorkspaceRow,
    task: &str,
    path: Option<String>,
) -> Result<(crate::db::WorkspaceRow, String), String> {
    let name: String = task
        .lines()
        .next()
        .unwrap_or_default()
        .chars()
        .take(60)
        .collect();
    let created = crate::worktree::create(&crate::worktree::CreateRequest {
        repo_path: parent.path.clone(),
        name: Some(name),
        new_branch: true,
        path,
        ..Default::default()
    })
    .await
    .map_err(|error| error.message)?;
    let summary = workspace::register_created(app, &parent.path, &created, Some(&parent.id))
        .await
        .map_err(|error| error.to_string())?;
    let checkout = app
        .db
        .resolve_workspace(&summary.id)
        .map_err(|error| error.to_string())?;
    let path = checkout.path.clone();
    Ok((checkout, path))
}

struct LaunchFailure {
    message: String,
    /// perchd confirms no process exists for the child.
    confirmed_absent: bool,
}

/// Start the child's agent. Blocking: it talks to perchd.
fn launch(app: &AppState, row: &SubSessionRow, cwd: &str) -> Result<(), LaunchFailure> {
    let key = key_of(app, &row.child_session_id, &row.provider_id).map_err(|(_, message)| {
        LaunchFailure {
            message,
            confirmed_absent: true,
        }
    })?;
    let terminal = crate::agent_runtime::terminal_key(&key);
    let failure = |message: String| LaunchFailure {
        message,
        confirmed_absent: crate::daemon::session_state(&terminal)
            == crate::daemon::RuntimeState::Exited
            && !app.agent_runtime.runtime_alive(&key),
    };
    let provider = row.provider_id.as_str();
    let manifest = app
        .agent_runtime
        .providers()
        .get(provider)
        .ok_or_else(|| failure(format!("unknown agent {provider}")))?;

    let mut extra: Vec<String> = Vec::new();
    if let Some(model) = &row.model {
        extra.extend(["--model".into(), model.clone()]);
    }
    let provider_session_id = if provider == "claude" {
        let id = Uuid::new_v4().to_string();
        app.db
            .set_claude_session_id(&row.child_session_id, &id)
            .map_err(|error| failure(error.to_string()))?;
        extra.extend(["--session-id".into(), id.clone()]);
        Some(id)
    } else {
        None
    };
    let paths = crate::native_ui::prepare(&key, provider, true)
        .map_err(|error| failure(error.to_string()))?;
    if provider != "codex" {
        extra.extend([
            if provider == "claude" {
                "--settings"
            } else {
                "--extension"
            }
            .into(),
            paths.extension.to_string_lossy().into_owned(),
        ]);
    }
    // The task is the last argument: the agent reads it as its first message.
    extra.push(sub_sessions::first_message(
        &row.parent_session_id,
        &row.task,
    ));

    let registration = AgentRegistration {
        key: key.clone(),
        provider_id: provider.to_string(),
        provider_session_id,
        resumable: manifest.supports_capability(
            crate::agent_fleet::AgentMode::Cli,
            ProviderCapability::Resume,
        ),
        now_ms: now_millis(),
    };
    {
        let _guard = app.foundation_lock.lock().unwrap();
        app.agent_runtime
            .lifecycle()
            .register(registration.clone())
            .map_err(|error| failure(error.to_string()))?;
        app.db
            .set_cli_provider(&row.child_session_id, provider)
            .map_err(|error| failure(error.to_string()))?;
        persist_agent_runtime(app, &key).map_err(|error| failure(error.to_string()))?;
    }
    // The change record of the child's first turn starts before the agent can touch a file.
    if let Err(error) = app.agent_runtime.record_turn_boundary(&key, true) {
        tracing::warn!(%error, "could not record the first turn boundary of a sub-session");
    }
    let client = service_client().map_err(|(_, message)| failure(message))?;
    let on_data: crate::terminal::TerminalDataListener = Arc::new(|_, _| {});
    let on_exit: crate::terminal::TerminalExitListener = Arc::new(|_, _| {});
    app.agent_runtime
        .attach_cli_with_ready(
            registration,
            cwd,
            client.clone(),
            120,
            32,
            &extra,
            false,
            on_data,
            on_exit,
            |_, _| {},
        )
        .map_err(|error| failure(error.to_string()))?;
    // Nobody views a child; the agent keeps running in perchd without the launcher.
    let _ = app.agent_runtime.detach(&key, &client);
    if let Err(error) = native_ui::observe(app, key.clone()) {
        tracing::warn!(%error, "native UI observation unavailable for a sub-session");
    }
    if let Err(error) = app.db.mark_cli_activity(&row.child_session_id) {
        tracing::warn!(%error, "could not make a sub-session visible");
    } else {
        app.cli_active_sessions
            .lock()
            .unwrap()
            .insert(row.child_session_id.clone());
    }
    if let Err(error) = persist_agent_runtime(app, &key) {
        tracing::warn!(%error, "could not checkpoint a sub-session");
    }
    notify_session_updated(app, &row.child_session_id);
    Ok(())
}

/// A member's report, always a claim: its own `perch report` of the latest turn, else (for a child
/// only) the running summary a cheap model wrote, else nothing.
pub(super) fn member_report(app: &AppState, session_id: &str, is_child: bool) -> Option<Report> {
    let own = app.db.latest_session_report(session_id).ok().flatten();
    if !is_child {
        return own.map(|(text, at)| Report {
            text,
            source: ReportSource::Reported,
            at,
            model: None,
        });
    }
    resolve_child_report(app, session_id)
}

/// A child's report from what is recorded: its own, else the running summary.
pub(super) fn resolve_child_report(app: &AppState, child_session_id: &str) -> Option<Report> {
    sub_sessions::choose_report(
        app.db
            .latest_session_report(child_session_id)
            .ok()
            .flatten(),
        app.db.session_summary(child_session_id).ok().flatten(),
        app.settings.get().reporter_enabled,
    )
}

/// What one member of the run looks like, from Perch's own records. `needsYou` is a pending
/// approval or question, never something the agent said.
fn member_json(
    app: &AppState,
    caller: &AgentIdentity,
    session_id: &str,
    provider: &str,
    child: Option<(&SubSessionRow, SubState)>,
) -> Value {
    let title = app
        .db
        .list_sessions()
        .ok()
        .and_then(|rows| rows.into_iter().find(|row| row.id == session_id))
        .map(|row| row.title)
        .unwrap_or_default();
    let key = key_of(app, session_id, provider).ok();
    let snapshot = key
        .as_ref()
        .and_then(|key| app.agent_runtime.snapshot(key).ok());
    let lifecycle = snapshot.as_ref().map(|snapshot| snapshot.state);
    let quiet = snapshot.as_ref().and_then(|snapshot| {
        sub_sessions::quiet_minutes(
            child.is_some() && snapshot.state == AgentState::Working,
            snapshot.last_activity_ms.max(snapshot.last_transition_ms),
            now_millis(),
        )
    });
    let report = member_report(app, session_id, child.is_some());
    json!({
        "session": session_id,
        "role": if child.is_some() { "child" } else { "lead" },
        "you": session_id == caller.session_id,
        "agent": provider,
        "model": child.and_then(|(row, _)| row.model.clone()),
        "title": title,
        "dispatch": child.map(|(_, state)| state.as_str()),
        "state": lifecycle.map_or(Value::String("unknown".into()), |state| json!(state)),
        "needsYou": lifecycle == Some(AgentState::Blocked),
        "quietMinutes": quiet,
        "task": child.map(|(row, _)| row.task.clone()),
        "report": report.map(|report| json!({
            "text": report.text,
            "source": report.source.as_str(),
            "model": report.model,
            "at": report.at,
        })),
    })
}

/// `perch list`: the caller's run, its lead and the lead's children.
pub(super) async fn list(app: &AppState, caller: &AgentIdentity) -> Result<Value, Failure> {
    let app = app.clone();
    let caller = caller.clone();
    tokio::task::spawn_blocking(move || {
        let lead_id = app
            .db
            .parent_of(&caller.session_id)
            .map_err(|error| internal("read the session", error))?
            .unwrap_or_else(|| caller.session_id.clone());
        let lead_provider = if lead_id == caller.session_id {
            caller.provider_id.clone()
        } else {
            app.db
                .get_session(&lead_id)
                .ok()
                .flatten()
                .and_then(|row| row.cli_provider_id)
                .unwrap_or_default()
        };
        let mut members = vec![member_json(&app, &caller, &lead_id, &lead_provider, None)];
        for row in app
            .db
            .sub_sessions_of(&lead_id)
            .map_err(|error| internal("read the sub-sessions", error))?
        {
            let state = reconcile(&app, &row);
            members.push(member_json(
                &app,
                &caller,
                &row.child_session_id,
                &row.provider_id,
                Some((&row, state)),
            ));
        }
        let suggested = super::suggestions::listed(&app, &lead_id);
        Ok(json!({ "lead": lead_id, "members": members, "suggested": suggested }))
    })
    .await
    .map_err(|error| internal("list the run", error))?
}

/// `perch stop <session>`: stop one of the caller's own children, and say it stopped only once
/// perchd confirms the process is gone.
/// `perch read`: a bounded tail of one of the caller's own sub-sessions' transcript
/// (`child_read.rs`), read from the snapshot its native bridge holds. Another session, and a
/// sub-session asking, are refused; a child whose conversation Perch cannot reach says so.
pub(super) async fn read(
    app: &AppState,
    caller: &AgentIdentity,
    target: &str,
    turns: usize,
) -> Result<Value, Failure> {
    let app = app.clone();
    let caller = caller.clone();
    let target = target.to_string();
    tokio::task::spawn_blocking(move || {
        if app
            .db
            .parent_of(&caller.session_id)
            .map_err(|error| internal("read the session", error))?
            .is_some()
        {
            return Err(fail(
                StatusCode::FORBIDDEN,
                "a sub-session cannot read another session; only a lead can, and only its own sub-sessions",
            ));
        }
        let row = app
            .db
            .sub_session(&target)
            .map_err(|error| internal("read the sub-session", error))?
            .filter(|row| row.parent_session_id == caller.session_id)
            .ok_or_else(|| {
                fail(
                    StatusCode::NOT_FOUND,
                    "that is not one of your sub-sessions",
                )
            })?;
        let state = reconcile(&app, &row);
        let key = key_of(&app, &row.child_session_id, &row.provider_id)?;
        let snapshot = app
            .native_bridge(&key)
            .and_then(|bridge| bridge.latest())
            .ok_or_else(|| {
                fail(
                    StatusCode::CONFLICT,
                    "Perch cannot read that sub-session's conversation right now (its chat is not \
                     connected); `perch list` shows its last report",
                )
            })?;
        let tail = crate::child_read::tail(&snapshot, turns);
        Ok(json!({
            "session": row.child_session_id,
            "agent": row.provider_id,
            "dispatch": state.as_str(),
            "turns": tail.turns,
            "cut": tail.cut,
            "text": tail.text,
        }))
    })
    .await
    .map_err(|error| internal("read the sub-session", error))?
}

pub(super) async fn stop(
    app: &AppState,
    caller: &AgentIdentity,
    target: &str,
) -> Result<Value, Failure> {
    let app = app.clone();
    let caller = caller.clone();
    let target = target.to_string();
    tokio::task::spawn_blocking(move || {
        let row = app
            .db
            .sub_session(&target)
            .map_err(|error| internal("read the sub-session", error))?
            .filter(|row| row.parent_session_id == caller.session_id)
            .ok_or_else(|| {
                fail(
                    StatusCode::NOT_FOUND,
                    "that is not one of your sub-sessions",
                )
            })?;
        let state = reconcile(&app, &row);
        let state = stop_child(
            &app,
            &SubSessionRow {
                state,
                ..row.clone()
            },
        )?;
        Ok(json!({ "session": row.child_session_id, "dispatch": state.as_str() }))
    })
    .await
    .map_err(|error| internal("stop the sub-session", error))?
}

/// Move a child toward `stopped`. `Ok` carries a settled state; an unconfirmed stop is an
/// error and leaves `stop_unknown`.
pub(super) fn stop_child(app: &AppState, row: &SubSessionRow) -> Result<SubState, Failure> {
    if matches!(
        row.state,
        SubState::Stopped | SubState::Exited | SubState::Failed
    ) {
        return Ok(row.state);
    }
    if !row.state.can_begin_stop() {
        return Err(fail(
            StatusCode::CONFLICT,
            "that sub-session is still starting; try again in a moment",
        ));
    }
    let key = key_of(app, &row.child_session_id, &row.provider_id)?;
    if !app
        .db
        .move_sub_session(&row.child_session_id, &[row.state], SubState::Stopping)
        .map_err(|error| internal("record the stop", error))?
    {
        return Err(fail(
            StatusCode::CONFLICT,
            "that sub-session changed; list it and try again",
        ));
    }
    let outcome = {
        let _operation = app.agent_operation_lock.lock().unwrap();
        app.agent_runtime.stop_confirmed(&key)
    };
    match outcome {
        Ok(()) => {
            let _ = app.db.move_sub_session(
                &row.child_session_id,
                &[SubState::Stopping],
                SubState::Stopped,
            );
            if let Err(error) = persist_agent_runtime(app, &key) {
                tracing::warn!(%error, "could not checkpoint a stopped sub-session");
            }
            notify_session_updated(app, &row.child_session_id);
            Ok(SubState::Stopped)
        }
        Err(error) => {
            let _ = app.db.move_sub_session(
                &row.child_session_id,
                &[SubState::Stopping],
                SubState::StopUnknown,
            );
            tracing::warn!(%error, "a sub-session stop was not confirmed");
            Err(fail(
                StatusCode::BAD_GATEWAY,
                "Perch could not confirm that the sub-session stopped; it still counts as running. \
                 Try `perch stop` again.",
            ))
        }
    }
}

/// A person stopped or deleted a lead: stop every live child of it too. Each stop is confirmed on
/// its own; one that is not stays `stop_unknown` and the rest still proceed. `Err` says how many
/// children may still be running (a stop not confirmed, a launch still in flight, an unreadable
/// record), so a caller about to forget the lead can refuse instead.
pub(super) fn stop_children_of(app: &AppState, lead_session_id: &str) -> Result<(), String> {
    let children = app
        .db
        .sub_sessions_of(lead_session_id)
        .map_err(|error| format!("could not read its sub-sessions: {error}"))?;
    let mut unconfirmed = 0;
    for row in children {
        let state = reconcile(app, &row);
        if !state.is_live() {
            continue;
        }
        if state == SubState::Starting || stop_child(app, &SubSessionRow { state, ..row }).is_err()
        {
            unconfirmed += 1;
        }
    }
    match unconfirmed {
        0 => Ok(()),
        count => Err(format!(
            "{count} of its sub-sessions could not be confirmed stopped"
        )),
    }
}

#[cfg(test)]
pub(super) mod tests {
    use super::super::agent::tests::request;
    use super::*;
    use crate::agent_identity::IdentityStore;

    /// A core booted over HTTP with its state, on a database under `root`.
    pub(in crate::server) async fn boot(root: &std::path::Path) -> (SocketAddr, Arc<HistoryDb>) {
        boot_with(root, crate::local_ui::LocalUi::in_process()).await
    }

    /// [`boot`] with a local UI the test holds, so it can present that token as a person.
    pub(in crate::server) async fn boot_with(
        root: &std::path::Path,
        local_ui: Arc<crate::local_ui::LocalUi>,
    ) -> (SocketAddr, Arc<HistoryDb>) {
        let db_path = root.join("history.sqlite");
        let db = Arc::new(HistoryDb::open(&db_path).unwrap());
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        tokio::spawn(run(
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
                local_ui,
            },
            db.clone(),
            root.display().to_string(),
        ));
        let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
            .await
            .unwrap()
            .unwrap();
        (address, db)
    }

    /// The spawn, list and stop routes over real HTTP against a booted core, up to the point of
    /// starting an agent: what is refused, what is recorded, what a retry returns.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn spawn_list_and_stop_enforce_their_rules_over_http() {
        let root = std::env::temp_dir().join(format!("perch-sub-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        // Leads may start without asking, so `perch spawn` is admitted by the limits, not made a card.
        super::super::booted_state(address)
            .settings
            .update(crate::settings::SettingsPatch {
                leads_start_without_asking: Some(true),
                ..Default::default()
            })
            .unwrap();
        let (_, workspace) = db
            .create_project("local", &nest.to_string_lossy(), Some("nest"), None)
            .unwrap();
        db.create_session_in_workspace("lead", &workspace, &nest.to_string_lossy())
            .unwrap();
        db.set_cli_provider("lead", "claude").unwrap();
        let lead = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
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
        let spawn_body = |key: &str, session: &str| {
            json!({"session": session, "agent": "codex", "model": "gpt-5.6-luna",
                   "task": "fix the parser", "key": key})
        };

        // Bad requests are refused before anything is recorded.
        for (change, expect) in [
            (json!({"agent": "gemini"}), "choose the agent"),
            (json!({"task": "  "}), "needs a task"),
            (json!({"task": "x".repeat(3001)}), "limited to 3000"),
            (json!({"model": "--help"}), "not a model"),
            (json!({"key": "a b"}), "spawn key"),
        ] {
            let mut body = spawn_body("k0", "lead");
            body.as_object_mut()
                .unwrap()
                .extend(change.as_object().unwrap().clone());
            let (status, answer) = call("spawn", lead.token.clone(), body).await;
            assert_eq!(status, 400, "{answer}");
            assert!(
                answer["error"].as_str().unwrap().contains(expect),
                "{answer}"
            );
        }
        assert!(db.sub_sessions_of("lead").unwrap().is_empty());

        // A child the lead started earlier, recorded as the core would have.
        let nest_path = nest.to_string_lossy().into_owned();
        let spec = |child: &'static str, key: &'static str| crate::db::SubSessionSpec {
            child_session_id: child,
            parent_session_id: "lead",
            parent_incarnation: &lead.incarnation,
            workspace: &workspace,
            cwd: &nest_path,
            provider_id: "codex",
            model: Some("gpt-5.6-luna"),
            spawn_key: key,
            task: "fix the parser",
        };
        let Reserved::New(child) = db.reserve_sub_session(&spec("child", "k1")).unwrap() else {
            panic!("the child should have been recorded");
        };
        db.move_sub_session(
            &child.child_session_id,
            &[SubState::Starting],
            SubState::Running,
        )
        .unwrap();
        db.set_cli_provider("child", "codex").unwrap();
        let child_token = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();

        // Any turn may spawn (owner decision 2026-11-08), so what refuses it is the run's limits, which
        // are the person's settings; the refusal says so and records nothing. (A spawn that was admitted
        // would launch a real agent, which a test must not do.)
        db.set_limits(crate::sub_sessions::RunLimits {
            live: 1,
            total: 1,
            ..Default::default()
        });
        let (status, answer) = call("spawn", lead.token.clone(), spawn_body("k9", "lead")).await;
        assert_eq!(status, 409, "{answer}");
        let error = answer["error"].as_str().unwrap();
        assert!(
            error.contains("already have 1 sub-sessions running"),
            "{error}"
        );
        assert!(error.contains("Settings > Sub-sessions"), "{error}");
        assert_eq!(db.sub_sessions_of("lead").unwrap().len(), 1);
        db.set_limits(Default::default());

        // The same key again returns that child and starts nothing.
        let (status, answer) = call("spawn", lead.token.clone(), spawn_body("k1", "lead")).await;
        assert_eq!(status, 200, "{answer}");
        assert_eq!(answer["session"], "child");
        assert_eq!(answer["duplicate"], true);
        assert_eq!(db.sub_sessions_of("lead").unwrap().len(), 1);

        // A child may not spawn, whatever its turn: the depth refusal tells it to do the work.
        let (status, answer) = call(
            "spawn",
            child_token.token.clone(),
            spawn_body("k2", "child"),
        )
        .await;
        assert_eq!(status, 403, "{answer}");
        assert!(answer["error"]
            .as_str()
            .unwrap()
            .contains("Complete this task yourself"));

        // `list` is the run, from the lead's side or the child's. The child's process is not in
        // perchd (a fresh isolated daemon), which confirms it gone: the record says exited.
        for (token, session) in [(&lead.token, "lead"), (&child_token.token, "child")] {
            let (status, answer) = call("list", token.clone(), json!({"session": session})).await;
            assert_eq!(status, 200, "{answer}");
            assert_eq!(answer["lead"], "lead");
            let members = answer["members"].as_array().unwrap();
            assert_eq!(members.len(), 2, "{answer}");
            assert_eq!(
                (members[0]["role"].as_str(), members[0]["session"].as_str()),
                (Some("lead"), Some("lead"))
            );
            assert_eq!(members[1]["session"], "child");
            assert_eq!(members[1]["dispatch"], "exited", "{answer}");
            assert_eq!(members[1]["you"], session == "child");
            assert_eq!(
                members[1]["state"], "unknown",
                "Perch has no lifecycle record of it"
            );
            assert_eq!(members[1]["needsYou"], false);
            assert_eq!(
                members[1]["report"],
                Value::Null,
                "nothing reported, nothing said"
            );
        }

        // A report is kept per session, outlives its run and is labelled as the agent's claim.
        let (status, _) = call(
            "report",
            child_token.token.clone(),
            json!({"session": "child", "text": "parser fixed"}),
        )
        .await;
        assert_eq!(status, 200);
        let (_, answer) = call("list", lead.token.clone(), json!({"session": "lead"})).await;
        assert_eq!(answer["members"][1]["report"]["text"], "parser fixed");
        assert_eq!(answer["members"][1]["report"]["source"], "report");

        // `stop` reaches only the caller's own children, and a settled child is just reported.
        let (status, answer) = call(
            "stop",
            child_token.token.clone(),
            json!({"session": "child", "target": "lead"}),
        )
        .await;
        assert_eq!(status, 404, "{answer}");
        let (status, _) = call("stop", lead.token.clone(), json!({"session": "lead"})).await;
        assert_eq!(status, 400);
        let (status, answer) = call(
            "stop",
            lead.token.clone(),
            json!({"session": "lead", "target": "child"}),
        )
        .await;
        assert_eq!(status, 200, "{answer}");
        assert_eq!(answer["dispatch"], "exited");
        // Another lead's child is not this lead's.
        db.create_session_in_workspace("other", &workspace, &nest.to_string_lossy())
            .unwrap();
        let other = db
            .issue(&AgentKey::new(&workspace.id, "other", "claude").unwrap())
            .unwrap();
        let (status, _) = call(
            "stop",
            other.token.clone(),
            json!({"session": "other", "target": "child"}),
        )
        .await;
        assert_eq!(status, 404);
        let _ = std::fs::remove_dir_all(root);
    }

    /// A lead and one recorded child, as the core would have left them after a spawn.
    pub(in crate::server) fn lead_with_child(
        db: &HistoryDb,
        nest: &std::path::Path,
        child_state: SubState,
    ) -> (crate::db::WorkspaceRow, SubSessionRow) {
        lead_with_child_of(db, nest, child_state, "codex")
    }

    /// The same, with the child on another agent.
    pub(in crate::server) fn lead_with_child_of(
        db: &HistoryDb,
        nest: &std::path::Path,
        child_state: SubState,
        child_provider: &str,
    ) -> (crate::db::WorkspaceRow, SubSessionRow) {
        let (_, workspace) = db
            .create_project("local", &nest.to_string_lossy(), Some("nest"), None)
            .unwrap();
        let cwd = nest.to_string_lossy().into_owned();
        db.create_session_in_workspace("lead", &workspace, &cwd)
            .unwrap();
        db.set_cli_provider("lead", "claude").unwrap();
        let lead = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let Reserved::New(child) = db
            .reserve_sub_session(&crate::db::SubSessionSpec {
                child_session_id: "child",
                parent_session_id: "lead",
                parent_incarnation: &lead.incarnation,
                workspace: &workspace,
                cwd: &cwd,
                provider_id: child_provider,
                model: None,
                spawn_key: "k",
                task: "fix the parser",
            })
            .unwrap()
        else {
            panic!("the child should have been recorded");
        };
        db.set_cli_provider("child", child_provider).unwrap();
        if child_state != SubState::Starting {
            db.move_sub_session("child", &[SubState::Starting], child_state)
                .unwrap();
        }
        (workspace, child)
    }

    /// Deleting a lead (also what archiving its Workspace does) ends its live children first, each
    /// confirmed gone by perchd, and leaves them as ordinary sessions; a child that cannot be shown
    /// stopped keeps the lead.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn deleting_a_lead_stops_its_live_children_first_and_keeps_it_when_one_is_unconfirmed() {
        let root = std::env::temp_dir().join(format!("perch-sub-delete-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = crate::server::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        let terminal = crate::agent_runtime::terminal_key(
            &AgentKey::new(&workspace.id, "child", "codex").unwrap(),
        );
        let daemon = crate::daemon::client().unwrap();
        daemon
            .create(
                &terminal,
                vec!["/bin/sh".into(), "-c".into(), "sleep 60".into()],
                None,
                vec![],
                80,
                24,
            )
            .unwrap();
        assert_eq!(
            crate::daemon::session_state(&terminal),
            crate::daemon::RuntimeState::Alive
        );

        // A child still starting cannot be shown stopped: the lead stays, with its record.
        db.move_sub_session("child", &[SubState::Running], SubState::Starting)
            .unwrap();
        let refused = super::super::session::delete_session(&app, "lead").unwrap_err();
        assert!(
            refused.to_string().contains("session retained"),
            "{refused}"
        );
        assert!(db.get_session("lead").unwrap().is_some());
        assert_eq!(
            crate::daemon::session_state(&terminal),
            crate::daemon::RuntimeState::Alive,
            "nothing was stopped on a refusal that cannot name the child"
        );

        // A running child is stopped, and only then is the lead forgotten.
        db.move_sub_session("child", &[SubState::Starting], SubState::Running)
            .unwrap();
        super::super::session::delete_session(&app, "lead").unwrap();
        assert_eq!(
            crate::daemon::session_state(&terminal),
            crate::daemon::RuntimeState::Exited
        );
        // The record goes with the lead (the stop itself was recorded and confirmed before that).
        assert!(db.sub_session("child").unwrap().is_none());
        assert_eq!(db.parent_of("child").unwrap(), None);
        assert!(db.get_session("lead").unwrap().is_none());
        assert!(
            db.get_session("child").unwrap().is_some(),
            "a child becomes an ordinary session"
        );
        let _ = std::fs::remove_dir_all(root);
    }

    fn git(directory: &std::path::Path, args: &[&str]) {
        let status = std::process::Command::new("git")
            .args(args)
            .current_dir(directory)
            .env("GIT_AUTHOR_NAME", "perch test")
            .env("GIT_AUTHOR_EMAIL", "test@example.invalid")
            .env("GIT_COMMITTER_NAME", "perch test")
            .env("GIT_COMMITTER_EMAIL", "test@example.invalid")
            .status()
            .unwrap();
        assert!(status.success(), "git {args:?}");
    }

    /// `perch spawn --worktree`: the child gets a new checkout of the lead's repository, registered
    /// under the lead's Workspace in the same Project, and its session and record move there; a repository
    /// that cannot make one discards the child.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn spawn_worktree_places_the_child_in_a_checkout_under_the_leads_nest() {
        let root = std::env::temp_dir().join(format!("perch-sub-worktree-{}", Uuid::new_v4()));
        let repo = root.join("repo");
        std::fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-q", "-b", "main"]);
        std::fs::write(repo.join("a.txt"), "a").unwrap();
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-q", "-m", "first"]);
        let repo = std::fs::canonicalize(&repo).unwrap();
        let (address, db) = boot(&root).await;
        let app = crate::server::booted_state(address);
        let (lead_nest, child) = lead_with_child(&db, &repo, SubState::Starting);

        let checkout_path = root.join("checkouts").join("fix-the-parser");
        let cwd = place_in_worktree(
            &app,
            &child,
            &lead_nest,
            "fix the parser\nmore detail",
            Some(checkout_path.to_string_lossy().into_owned()),
        )
        .await
        .unwrap();

        // The checkout exists, is a linked worktree of the lead's repository, and is where the child starts.
        let checkout_path = std::fs::canonicalize(&checkout_path).unwrap();
        assert_eq!(std::fs::canonicalize(&cwd).unwrap(), checkout_path);
        assert!(checkout_path.join("a.txt").exists());
        assert!(checkout_path.join(".git").is_file(), "a linked worktree");
        let listing = crate::worktree::list(&repo.to_string_lossy())
            .await
            .unwrap();
        assert!(listing
            .worktrees
            .iter()
            .any(
                |entry| std::fs::canonicalize(&entry.path).ok().as_deref() == Some(&checkout_path)
            ));
        // Registered under the lead's Workspace, in the lead's Project, and the child lives in it.
        let session = db.get_session("child").unwrap().unwrap();
        assert_eq!(session.cwd, cwd);
        let checkout = db
            .resolve_workspace(session.workspace_id.as_deref().unwrap())
            .unwrap();
        assert_ne!(checkout.id, lead_nest.id);
        assert_eq!(checkout.project_id, lead_nest.project_id);
        assert_eq!(
            checkout.parent_workspace_id.as_deref(),
            Some(lead_nest.id.as_str())
        );
        assert_eq!(
            std::fs::canonicalize(&checkout.path).unwrap(),
            checkout_path
        );
        assert_eq!(
            db.sub_session("child").unwrap().unwrap().workspace_id,
            checkout.id
        );
        // The lead stays where it was.
        assert_eq!(
            db.get_session("lead")
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(lead_nest.id.as_str())
        );

        // A folder that is not a repository cannot make a checkout: the failure is the caller's to
        // read, and the child that was recorded is discarded.
        let plain = root.join("plain");
        std::fs::create_dir_all(&plain).unwrap();
        let (_, plain_nest) = db
            .create_project("local", &plain.to_string_lossy(), Some("plain"), None)
            .unwrap();
        let Reserved::New(second) = db
            .reserve_sub_session(&crate::db::SubSessionSpec {
                child_session_id: "child-two",
                parent_session_id: "lead",
                parent_incarnation: &child.parent_incarnation,
                workspace: &plain_nest,
                cwd: &plain.to_string_lossy(),
                provider_id: "codex",
                model: None,
                spawn_key: "k2",
                task: "again",
            })
            .unwrap()
        else {
            panic!("the second child should have been recorded");
        };
        let (status, _) = place_in_worktree(&app, &second, &plain_nest, "again", None)
            .await
            .unwrap_err();
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert!(db.get_session("child-two").unwrap().is_none());
        assert!(db.sub_session("child-two").unwrap().is_none());
        let _ = std::fs::remove_dir_all(root);
    }

    /// `perch read`: a lead reads its own child's tail from the snapshot its bridge holds, with the
    /// run sentences and the last words but never a tool's output; anyone else is refused.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_lead_reads_its_own_child_s_tail_and_nobody_else_s() {
        use tokio::io::AsyncWriteExt;
        let root = std::env::temp_dir().join(format!("perch-sub-read-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = crate::server::booted_state(address);
        // A Pi child: its bridge is a plain socket, which this test can stand in for.
        let (workspace, _) = lead_with_child_of(&db, &nest, SubState::Running, "pi");
        let lead = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "pi").unwrap())
            .unwrap();
        let read = |token: String, body: Value| async move {
            request(
                address,
                "POST",
                "/agent/read",
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };

        // No bridge yet: Perch cannot read its conversation, and says so rather than guessing.
        let (status, answer) = read(
            lead.token.clone(),
            json!({"session": "lead", "target": "child"}),
        )
        .await;
        assert_eq!(status, 409, "{answer}");
        assert!(answer["error"].as_str().unwrap().contains("not connected"));

        // The child's bridge reports a conversation.
        let key = AgentKey::new(&workspace.id, "child", "pi").unwrap();
        let socket = crate::native_ui::paths(&key).unwrap().socket;
        let listener = tokio::net::UnixListener::bind(&socket).unwrap();
        app.native_ui
            .start(key.clone(), None, Arc::new(|| true), Arc::new(|_| {}))
            .unwrap();
        let (mut peer, _) = listener.accept().await.unwrap();
        let message = |id: &str, role: &str, text: &str| json!({"id": id, "role": role, "text": text, "thinking": "", "tools": []});
        let mut call = message("a1", "assistant", "");
        call["tools"] =
            json!([{"name": "Read", "input": "{\"file_path\":\"/w/a.rs\"}", "id": "c1"}]);
        let mut output = message("r1", "toolResult", "SECRET FILE CONTENTS");
        output["toolCallId"] = json!("c1");
        let snapshot = json!({"type": "snapshot", "version": 1, "revision": 1, "pid": 1,
        "providerSessionId": "/n", "cwd": "/n", "model": null, "running": false,
        "truncated": false, "messages": [
            message("u1", "user", "fix the parser"), call, output,
            message("a2", "assistant", "Fixed it in a.rs"),
        ]})
        .to_string()
            + "\n";
        peer.write_all(snapshot.as_bytes()).await.unwrap();
        for _ in 0..100 {
            if app.native_ui.get(&key).and_then(|b| b.latest()).is_some() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        let (status, answer) = read(
            lead.token.clone(),
            json!({"session": "lead", "target": "child", "turns": 1}),
        )
        .await;
        assert_eq!(status, 200, "{answer}");
        let text = answer["text"].as_str().unwrap();
        assert!(text.contains("Asked: fix the parser"), "{text}");
        assert!(text.contains("Did: Read"), "{text}");
        assert!(text.contains("Fixed it in a.rs"), "{text}");
        assert!(!text.contains("SECRET FILE CONTENTS"), "{text}");
        assert_eq!(
            (answer["turns"].as_u64(), answer["agent"].as_str()),
            (Some(1), Some("pi"))
        );

        // Refusals: a bad count, a session that is not the caller's child, and a sub-session asking.
        for (token, body, status, expect) in [
            (
                &lead.token,
                json!({"target": "child", "turns": 0}),
                400,
                "1 to 5",
            ),
            (
                &lead.token,
                json!({"target": "child", "turns": 6}),
                400,
                "1 to 5",
            ),
            (&lead.token, json!({"target": ""}), 400, "say which"),
            (
                &lead.token,
                json!({"target": "lead"}),
                404,
                "not one of your",
            ),
            (
                &lead.token,
                json!({"target": "nobody"}),
                404,
                "not one of your",
            ),
            (&child.token, json!({"target": "child"}), 403, "cannot read"),
            (&child.token, json!({"target": "lead"}), 403, "cannot read"),
        ] {
            let mut full = json!({"session": if *token == lead.token { "lead" } else { "child" }});
            full.as_object_mut()
                .unwrap()
                .extend(body.as_object().unwrap().clone());
            let (got, answer) = read(token.clone(), full).await;
            assert_eq!(got, status, "{answer}");
            assert!(
                answer["error"].as_str().unwrap().contains(expect),
                "{answer}"
            );
        }
        let _ = std::fs::remove_dir_all(root);
    }
}
