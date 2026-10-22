//! Context Bridge adapter. Only durable local workspace ids are accepted.
//! Preparing/copying never takes a lease, saves a draft or starts a process.
//! Sending is an explicit, idempotent native prompt, never arbitrary PTY input.
use super::*;
use crate::context_bridge::{self as bridge, ContextAgent, ContextPacket, ContextSource};
use std::time::Duration;

async fn prepare(
    app: &AppState,
    workspace_id: &str,
    source: &ContextSource,
    instruction: &str,
) -> anyhow::Result<ContextPacket> {
    let workspace = app.db.resolve_workspace(workspace_id)?;
    anyhow::ensure!(
        workspace.host_id == "local",
        "Context Bridge currently supports local nests only"
    );
    if let ContextSource::Terminal { session_id, .. } = source {
        let row = app
            .db
            .get_session(session_id)?
            .ok_or_else(|| anyhow::anyhow!("The source terminal was closed"))?;
        check_scope(row.workspace_id.as_deref(), &row.host_id, workspace_id)?;
    }
    let disk = if let ContextSource::File { path } = source {
        bridge::validate_path(path)?;
        let service = workspace_file_service(app, workspace_id)
            .map_err(|err| anyhow::anyhow!(err.to_string()))?;
        let path = path.clone();
        Some(
            tokio::task::spawn_blocking(move || service.read_file(path))
                .await??
                .content,
        )
    } else {
        None
    };
    bridge::prepare(
        workspace_id,
        &workspace.path,
        source,
        disk.as_deref(),
        instruction,
    )
}

fn check_scope(actual: Option<&str>, host: &str, workspace: &str) -> anyhow::Result<()> {
    anyhow::ensure!(
        actual == Some(workspace) && (host.is_empty() || host == "local"),
        "Choose an agent or terminal in this exact nest and host"
    );
    Ok(())
}

fn send_policy(provider: &str, state: AgentState) -> anyhow::Result<()> {
    // Only Claude currently has a fail-closed empty-input check. Other native
    // transports can submit while their TUI has a draft; keep them Copy-only.
    anyhow::ensure!(
        provider == "claude",
        "Copy context for this agent; safe direct sending currently supports Claude only"
    );
    anyhow::ensure!(
        matches!(state, AgentState::Idle | AgentState::Done),
        "This agent is busy, blocked or unavailable. Wait, or copy the context"
    );
    Ok(())
}

fn agents(app: &AppState, workspace: &str) -> anyhow::Result<Vec<ContextAgent>> {
    Ok(app
        .db
        .list_sessions()?
        .into_iter()
        .filter(|row| {
            row.workspace_id.as_deref() == Some(workspace)
                && (row.host_id.is_empty() || row.host_id == "local")
        })
        .filter_map(|row| {
            let provider = row.cli_provider_id?;
            if provider == "terminal" {
                return None;
            }
            let policy = AgentKey::new(workspace, &row.id, &provider)
                .map_err(anyhow::Error::from)
                .and_then(|key| {
                    anyhow::ensure!(
                        app.agent_runtime.runtime_alive(&key),
                        "Open this agent's CLI first; nothing will be started here"
                    );
                    let snapshot = app.agent_runtime.snapshot(&key)?;
                    send_policy(&provider, snapshot.state)?;
                    // The sidebar's ps/name heuristic misses versioned native
                    // executables. Authorization uses Claude's real PID and
                    // empty-prompt check instead; this only reads the screen.
                    crate::native_ui::claude::prepare_input(&key, Some(""))?;
                    Ok(())
                });
            Some(ContextAgent {
                session_id: row.id,
                title: if row.title.is_empty() {
                    provider.clone()
                } else {
                    row.title
                },
                provider_id: provider,
                can_send: policy.is_ok(),
                reason: policy.err().map(|err| err.to_string()).unwrap_or_default(),
            })
        })
        .collect())
}

pub(super) fn preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    source: ContextSource,
    instruction: String,
) {
    let state = state.clone();
    tokio::spawn(async move {
        let result = async {
            let packet = prepare(&state.app, &workspace_id, &source, &instruction).await?;
            let agents = agents(&state.app, &workspace_id)?;
            Ok::<_, anyhow::Error>((packet, agents))
        }
        .await;
        match result {
            Ok((packet, agents)) => {
                let _ = state.out_tx.send(ServerMessage::ContextPreviewResult {
                    request_id,
                    packet,
                    agents,
                });
            }
            Err(err) => fail(
                &state.out_tx,
                request_id,
                "context_preview_failed",
                err.to_string(),
                false,
            ),
        }
    });
}

#[allow(clippy::too_many_arguments)]
pub(super) fn send(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    source: ContextSource,
    instruction: String,
    digest: String,
    target_session_id: String,
    operation_id: String,
) {
    let state = state.clone();
    tokio::spawn(async move {
        let prepared = async {
            anyhow::ensure!(!operation_id.is_empty() && operation_id.len() <= 128, "Invalid send identity");
            let packet = prepare(&state.app, &workspace_id, &source, &instruction).await?;
            anyhow::ensure!(packet.digest == digest, "The file changed since preview. Preview it again before sending");
            let row = state.app.db.get_session(&target_session_id)?.ok_or_else(|| anyhow::anyhow!("This agent was closed"))?;
            check_scope(row.workspace_id.as_deref(), &row.host_id, &workspace_id)?;
            let provider = row.cli_provider_id.as_deref().unwrap_or_default();
            let key = AgentKey::new(&workspace_id, &target_session_id, provider)?;
            let native = state.app.native_ui.get(&key).ok_or_else(|| anyhow::anyhow!("Open the agent's CLI first"))?;
            let live = native.snapshot().await?;
            anyhow::ensure!(!live.running && !live.blocked, "This agent is busy or waiting for you; finish that first");
            let _operation = state.app.agent_operation_lock.lock().unwrap();
            anyhow::ensure!(!state.out_tx.is_closed(), "Context sender disconnected");
            // Re-resolve under the destructive-operation lock: no deleted,
            // reparented or replaced session may receive a reviewed packet.
            let row = state.app.db.get_session(&target_session_id)?.ok_or_else(|| anyhow::anyhow!("This agent was closed"))?;
            check_scope(row.workspace_id.as_deref(), &row.host_id, &workspace_id)?;
            anyhow::ensure!(row.cli_provider_id.as_deref() == Some(provider) && state.app.agent_runtime.runtime_alive(&key), "Agent identity changed; preview again");
            let client = connection_client_identity(&state).map_err(anyhow::Error::msg)?;
            let before = state.app.agent_runtime.snapshot(&key)?;
            let lease = state.app.agent_runtime.acquire_control_if_unowned(&key, ControlChannel::Input, client.clone(), now_millis())?
                .ok_or_else(|| anyhow::anyhow!("Another view owns input. Use Copy context, or explicitly take control in the CLI first"))?;
            let result = state.app.agent_runtime.dispatch_native_control(&key, &lease, |write| {
                let snapshot = state.app.agent_runtime.snapshot(&key)?;
                send_policy(provider, snapshot.state)?;
                let text = &packet.markdown;
                let payload = format!("{:x}", Sha256::digest(format!("{provider}\0{text}").as_bytes()));
                // Preflight before reservation: reservation also adds a user
                // history row. A rejected draft/dialog must leave no ghost turn.
                let input = crate::native_ui::claude::prepare_input(&key, Some(text))?;
                let (existing, _) = state.app.db.reserve_prompt_operation(&operation_id, &target_session_id, Some(&workspace_id), &payload, text, Some(provider), None)?;
                if existing.state == "delivered" { return Ok(None); }
                let claim = state.app.db.claim_prompt_operation(&operation_id)?.ok_or_else(|| anyhow::anyhow!("Missing send operation"))?;
                anyhow::ensure!(claim.won_claim, "Delivery is already in progress or unconfirmed. Inspect the CLI; this context will not be sent twice");
                state.app.db.set_prompt_operation_state(&operation_id, "unconfirmed")?;
                state.app.agent_runtime.record_turn_boundary(&key, true)?;
                let reply = native.enqueue(&operation_id, Some(text))?;
                if let Some(input) = input { write(&input)?; }
                Ok(Some(reply))
            });
            if before.input_owner.is_none() {
                let _ = state.app.agent_runtime.release_control(&key, ControlChannel::Input, &client, lease.generation);
                if !before.observers.contains(&client.id) { let _ = state.app.agent_runtime.lifecycle().detach_observer(&key, &client.id); }
            }
            result
        }.await;
        let outcome = match prepared {
            Ok(None) => Ok(()),
            Ok(Some(reply)) => {
                if matches!(
                    tokio::time::timeout(Duration::from_secs(10), reply).await,
                    Ok(Ok(Ok(true)))
                ) {
                    session::settle_prompt_dispatch(&state.app, &operation_id, "delivered")
                        .map_err(anyhow::Error::msg)
                } else {
                    Err(anyhow::anyhow!("Delivery could not be confirmed. Inspect the CLI before doing anything else; Perch will not retry this send"))
                }
            }
            Err(error) => Err(error),
        };
        match outcome {
            Ok(()) => {
                notify_session_updated(&state.app, &target_session_id);
                let _ = state.out_tx.send(ServerMessage::AgentUiResult {
                    request_id,
                    session_id: target_session_id,
                    accepted: true,
                });
            }
            Err(err) => fail(
                &state.out_tx,
                request_id,
                "context_send_failed",
                err.to_string(),
                false,
            ),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scope_and_state_are_fail_closed_not_cwd_based() {
        assert!(check_scope(Some("w"), "local", "w").is_ok());
        for (workspace, host) in [
            (Some("other"), "local"),
            (None, "local"),
            (Some("w"), "remote"),
        ] {
            assert!(check_scope(workspace, host, "w").is_err());
        }
        assert!(send_policy("claude", AgentState::Idle).is_ok());
        for state in [
            AgentState::Working,
            AgentState::Blocked,
            AgentState::Sleeping,
            AgentState::Exited,
            AgentState::Error,
            AgentState::Reconnecting,
        ] {
            assert!(send_policy("claude", state).is_err());
        }
        assert!(send_policy("pi", AgentState::Idle).is_err());
    }
}
