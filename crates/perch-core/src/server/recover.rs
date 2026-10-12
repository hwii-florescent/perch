//! Boot-time recovery of agents that kept running in perchd while no core did.
//!
//! Without this, an agent's status, native-UI observation and turn tracking
//! start only when a view opens its session, so a sidebar full of agents that
//! worked through a quit looks idle until each is clicked. Here every restored
//! agent whose daemon process is alive gets its runtime back before the first
//! client connects; a view opened later just joins it.
//!
//! An agent that exited while no core ran (killed from Activity Monitor: pi
//! catches SIGTERM and exits 0, so the status says nothing) left a marker, see
//! `agent_runtime::in_shell`. Its pane is a plain shell by now; that shell is
//! replaced with the agent resumed on its recorded provider session.

use super::*;
use crate::agent_fleet::{AgentRegistration, AgentSnapshot, AgentState};
use crate::agent_runtime::terminal_key;
use terminal::claude_conversation_exists;

pub(super) fn recover_agents(app: &AppState) {
    for snapshot in app.agent_runtime.lifecycle().list() {
        if snapshot.provider_id == crate::agent_fleet::TERMINAL_PROVIDER
            || snapshot.state == AgentState::Sleeping
        {
            continue;
        }
        if let Err(error) = recover_one(app, &snapshot) {
            tracing::warn!(key = ?snapshot.key, %error, "could not recover agent");
        }
    }
}

fn recover_one(app: &AppState, snapshot: &AgentSnapshot) -> anyhow::Result<()> {
    let _operation = app.agent_operation_lock.lock().unwrap();
    let key = &snapshot.key;
    let provider_id = snapshot.provider_id.as_str();
    let tk = terminal_key(key);
    if app.agent_runtime.runtime(key).is_some() {
        return Ok(());
    }
    let marker = crate::daemon::exit_marker(&tk);
    // Consumed whatever happens: it describes the quit period only.
    let killed = std::fs::remove_file(&marker).is_ok();
    let Some(info) = crate::daemon::client()?
        .session(&tk)?
        .filter(|session| session.alive)
    else {
        return Ok(());
    };
    let Some(row) = app.db.get_session(&key.session_id)? else {
        return Ok(());
    };
    if !(row.host_id.is_empty() || row.host_id == "local") {
        return Ok(());
    }
    let mut extra = Vec::new();
    let mut resume = true;
    if killed && snapshot.resumable {
        // Replace the shell the killed agent left behind. A conversation the
        // CLI never wrote (killed before the first message) restarts fresh
        // under the same id, as `open_agent_terminal` does.
        resume = conversation_exists(snapshot);
        crate::daemon::discard(&tk);
        anyhow::ensure!(
            !crate::daemon::session_alive(&tk),
            "could not end the shell left by the killed agent"
        );
        extra = launch_args(key, provider_id, &row)?;
        if let (false, "claude", Some(id)) =
            (resume, provider_id, snapshot.provider_session_id.as_ref())
        {
            extra.extend(["--session-id".to_string(), id.clone()]);
        }
        tracing::info!(session = %key.session_id, provider_id, resume, "restarting agent killed while perch was closed");
    }
    // The attach resizes a live process to the size it is given: pass its own.
    let client = ClientIdentity::new("__perch_recover__", "local", ClientKind::Desktop)?;
    let on_data: crate::terminal::TerminalDataListener = Arc::new(|_, _| {});
    let on_exit: crate::terminal::TerminalExitListener = Arc::new(|_, _| {});
    app.agent_runtime.attach_cli_with_ready(
        AgentRegistration {
            key: key.clone(),
            provider_id: provider_id.to_string(),
            provider_session_id: snapshot.provider_session_id.clone(),
            resumable: snapshot.resumable,
            now_ms: now_millis(),
        },
        row.cwd,
        client.clone(),
        info.cols,
        info.rows,
        &extra,
        resume,
        on_data,
        on_exit,
        |_, _| {},
    )?;
    // The runtime keeps its own terminal attachment; this one was only ours.
    app.agent_runtime.detach(key, &client)?;
    if crate::native_ui::supported(provider_id) {
        if let Err(error) = native_ui::observe(app, key.clone()) {
            tracing::warn!(%error, "native UI observation unavailable for recovered agent");
        }
    }
    if let Err(error) = persist_agent_runtime(app, key) {
        tracing::warn!(%error, "could not checkpoint recovered agent");
    }
    Ok(())
}

/// Is there a conversation to resume under the recorded provider session?
fn conversation_exists(snapshot: &AgentSnapshot) -> bool {
    let Some(id) = snapshot.provider_session_id.as_deref() else {
        return false;
    };
    match snapshot.provider_id.as_str() {
        "claude" => claude_conversation_exists(id) != Some(false),
        // Pi reports its session file; a path that is gone resumes nothing.
        "pi" | "omp" if id.starts_with('/') => Path::new(id).exists(),
        _ => true,
    }
}

/// The same dynamic flags `open_agent_terminal` gives a fresh launch.
fn launch_args(
    key: &AgentKey,
    provider_id: &str,
    row: &crate::db::SessionRow,
) -> anyhow::Result<Vec<String>> {
    let mut extra = Vec::new();
    if !matches!(provider_id, "codex" | "opencode") {
        if let Some(model) = row
            .last_model
            .clone()
            .filter(|_| row.last_agent.as_deref() == Some(provider_id))
        {
            extra.extend(["--model".to_string(), model]);
        }
    }
    if crate::native_ui::supported(provider_id) {
        let paths = crate::native_ui::prepare(key, provider_id, true)?;
        if !matches!(provider_id, "codex" | "opencode") {
            extra.extend([
                if provider_id == "claude" {
                    "--settings"
                } else {
                    "--extension"
                }
                .into(),
                paths.extension.to_string_lossy().into_owned(),
            ]);
        }
    }
    Ok(extra)
}
