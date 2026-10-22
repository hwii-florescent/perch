//! Boot-time recovery of agents that kept running in perchd while no core did.
//!
//! Without this, an agent's status, native-UI observation and turn tracking
//! start only when a view opens its session, so a sidebar full of agents that
//! worked through a quit looks idle until each is clicked. Here every restored
//! agent whose daemon process is alive gets its runtime back before the first
//! client connects; a view opened later just joins it.
//!
//! Recovery only observes existing processes. If an agent ended while Perch
//! was closed, its wrapper's shell is preserved; boot never replaces it or
//! resumes a conversation behind the user's back.

use super::*;
use crate::agent_fleet::{AgentRegistration, AgentSnapshot, AgentState};
use crate::agent_runtime::terminal_key;

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
    let exited_while_closed = std::fs::remove_file(&marker).is_ok();
    let Some(info) = crate::daemon::client()?
        .session(&tk)?
        .filter(|session| session.alive)
    else {
        // Welcome Back: say what happened while Perch was closed, without
        // claiming the turn finished. A marker is the wrapper's own record.
        let was_working = snapshot.state == AgentState::Reconnecting
            && snapshot.reason.starts_with("runtime restarted");
        if exited_while_closed || was_working {
            super::attention::gone_while_closed(app, key, exited_while_closed);
        }
        return Ok(());
    };
    let Some(row) = app.db.get_session(&key.session_id)? else {
        return Ok(());
    };
    if !(row.host_id.is_empty() || row.host_id == "local") {
        return Ok(());
    }
    // Even if the process ends between this lookup and attach, boot must not
    // replace it. Reconnecting only permits an existing-process attachment.
    app.agent_runtime.signal(
        key,
        crate::agent_fleet::ProviderSignal::TransportLost {
            reason: "reattaching existing process after core restart".into(),
        },
        now_millis(),
    )?;
    // Reattach at the process's existing size without taking a resize lease.
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
        &[],
        true,
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
