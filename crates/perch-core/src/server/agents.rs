//! `agent.manifest.*`/`agent.lifecycle.*`/`agent.control.*` arm bodies
//! and the lifecycle key helpers they share. Pure move from `server.rs` —
//! see the refactor plan's Phase 3. No logic changed.
//!
//! `lifecycle_status_to_wire`, `connection_client_identity`, and
//! `lifecycle_control_key` are pub(super): mod.rs's still-resident
//! `open_agent_terminal`/`release_agent_terminal` (terminal.rs's future
//! domain) and `spawn_agent_lifecycle_task` call them directly.
//! `lifecycle_workspace_for_session` calls mod.rs's
//! `mode_workspace_for_session` (also used directly by the still-resident
//! session.mode.* arms) via `super::`.

use super::*;

fn provider_manifest_summary(
    manifest: &crate::agent_fleet::ProviderManifest,
) -> crate::protocol::AgentManifestSummary {
    let cli_executable = manifest
        .launch
        .mode_overrides
        .get(&AgentMode::Cli)
        .map(|recipe| &recipe.executable)
        .unwrap_or(&manifest.launch.executable);
    let executable = crate::agent_fleet::resolve_executable(cli_executable, None)
        .ok()
        .map(|path| path.to_string_lossy().into_owned());
    let reason = executable.is_none().then(|| {
        format!(
            "executable `{}` is not available on the configured PATH",
            cli_executable
        )
    });
    let capabilities = manifest
        .capabilities
        .iter()
        .map(|capability| match capability {
            crate::agent_fleet::ProviderCapability::Streaming => "streaming",
            crate::agent_fleet::ProviderCapability::InteractiveTerminal => "interactiveTerminal",
            crate::agent_fleet::ProviderCapability::Resume => "resume",
            crate::agent_fleet::ProviderCapability::PlanMode => "planMode",
            crate::agent_fleet::ProviderCapability::Attachments => "attachments",
            crate::agent_fleet::ProviderCapability::ReadOnly => "readOnly",
            crate::agent_fleet::ProviderCapability::StatusEvents => "statusEvents",
        })
        .map(str::to_string)
        .collect();
    let status_detection = match &manifest.status_detection {
        crate::agent_fleet::StatusDetection::EventStream => "eventStream".to_string(),
        crate::agent_fleet::StatusDetection::ExitStatus => "exitStatus".to_string(),
        crate::agent_fleet::StatusDetection::OutputPatterns { .. } => "outputPatterns".to_string(),
    };
    let resumability = match manifest.resumability {
        crate::agent_fleet::Resumability::Unsupported => "unsupported",
        crate::agent_fleet::Resumability::ProviderSession => "providerSession",
        crate::agent_fleet::Resumability::PersistentProcess => "persistentProcess",
    };
    crate::protocol::AgentManifestSummary {
        id: manifest.id.clone(),
        display_name: manifest.display_name.clone(),
        supported_modes: manifest
            .supported_modes
            .iter()
            .copied()
            .map(wire_session_mode)
            .collect(),
        resumability: resumability.to_string(),
        capabilities,
        status_detection,
        available: executable.is_some(),
        executable,
        reason,
    }
}

fn control_lease_to_wire(
    lease: &crate::agent_fleet::ControlLease,
) -> crate::protocol::AgentControlLease {
    crate::protocol::AgentControlLease {
        client_id: lease.client.id.clone(),
        device_id: lease.client.device_id.clone(),
        generation: lease.generation,
        acquired_at_ms: lease.acquired_at_ms,
        last_activity_ms: lease.last_activity_ms,
    }
}

fn lifecycle_workspace_for_session(
    state: &Arc<ConnState>,
    session_id: &str,
    requested_workspace_id: Option<&str>,
) -> Result<String, String> {
    Ok(
        mode_workspace_for_session(state, session_id, requested_workspace_id)?
            .unwrap_or_else(|| format!("session-{session_id}")),
    )
}

fn lifecycle_key_for_request(
    state: &Arc<ConnState>,
    session_id: &str,
    requested_workspace_id: Option<&str>,
    requested_agent_id: Option<&str>,
) -> Result<AgentKey, String> {
    let workspace_id = lifecycle_workspace_for_session(state, session_id, requested_workspace_id)?;
    if let Some(agent_id) = requested_agent_id {
        let key = AgentKey::new(&workspace_id, session_id, agent_id)
            .map_err(|error| format!("invalid lifecycle key: {error}"))?;
        state
            .app
            .agent_runtime
            .lifecycle()
            .get(&key)
            .map_err(|error| format!("agent lifecycle is unavailable: {error}"))?;
        return Ok(key);
    }

    let candidates = state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .filter(|snapshot| {
            snapshot.key.session_id == session_id && snapshot.key.workspace_id == workspace_id
        })
        .collect::<Vec<_>>();
    if candidates.len() == 1 {
        return Ok(candidates[0].key.clone());
    }
    if candidates.len() > 1 {
        return Err(
            "agentId is required when a session has multiple provider lifecycles".to_string(),
        );
    }
    Err("no provider lifecycle exists for this session".to_string())
}

pub(super) fn lifecycle_status_to_wire(
    snapshot: crate::agent_fleet::AgentSnapshot,
) -> crate::protocol::AgentLifecycleStatus {
    crate::protocol::AgentLifecycleStatus {
        key: crate::protocol::AgentLifecycleKey {
            workspace_id: snapshot.key.workspace_id,
            session_id: snapshot.key.session_id,
            agent_id: snapshot.key.agent_id,
        },
        provider_id: snapshot.provider_id,
        provider_session_id: snapshot.provider_session_id,
        resumable: snapshot.resumable,
        state: snapshot.state,
        reason: snapshot.reason,
        last_transition_ms: snapshot.last_transition_ms,
        last_activity_ms: snapshot.last_activity_ms,
        revision: snapshot.revision,
        transition_sequence: snapshot.transition_sequence,
        input_owner: snapshot.input_owner.as_ref().map(control_lease_to_wire),
        resize_owner: snapshot.resize_owner.as_ref().map(control_lease_to_wire),
    }
}

pub(super) fn connection_client_identity(state: &Arc<ConnState>) -> Result<ClientIdentity, String> {
    ClientIdentity::new(state.conn_id.clone(), "local", ClientKind::Desktop)
        .map_err(|error| format!("connection identity is invalid: {error}"))
}

pub(super) fn lifecycle_control_key(key: &AgentKey, channel: ControlChannel) -> String {
    format!(
        "{}:{}:{}:{channel:?}",
        key.workspace_id, key.session_id, key.agent_id
    )
}

pub(super) fn handle_agent_manifest_list(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
) {
    if request_id.trim().is_empty() {
        fail(
            &state.out_tx,
            request_id,
            "invalid_request_id",
            "agent.manifest.list requires a non-empty requestId",
            false,
        );
        return;
    }
    let target = host_id.as_deref().unwrap_or("local").trim();
    if !target.is_empty() && target != "local" {
        if !state.app.hub.is_connected(target) {
            fail(
                &state.out_tx,
                request_id,
                "host_unavailable",
                format!("host {target} is not connected"),
                true,
            );
            return;
        }
        state.app.hub.register_unicast(
            PendingKey::Request(request_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        // The selected host is a hub concern. Remove it before the
        // remote sees the request so it cannot route the request a
        // second time using an id meaningful only on this hub.
        state.app.hub.forward(target, &strip_host_id(raw_text));
        return;
    }
    let manifests = state
        .app
        .agent_runtime
        .providers()
        .list()
        .iter()
        .map(provider_manifest_summary)
        .collect();
    let _ = state.out_tx.send(ServerMessage::AgentManifestList {
        request_id,
        host_id: Some("local".to_string()),
        manifests,
    });
}

pub(super) fn handle_agent_lifecycle_get(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    session_id: String,
    workspace_id: Option<String>,
    agent_id: Option<String>,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
        return;
    }
    let key = match lifecycle_key_for_request(
        state,
        &session_id,
        workspace_id.as_deref(),
        agent_id.as_deref(),
    ) {
        Ok(key) => key,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_lifecycle_not_found",
                error,
                false,
            );
            return;
        }
    };
    match state.app.agent_runtime.snapshot(&key) {
        Ok(snapshot) => {
            let _ = state.out_tx.send(ServerMessage::AgentLifecycle {
                request_id,
                status: lifecycle_status_to_wire(snapshot),
            });
        }
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_lifecycle_read_failed",
                error.to_string(),
                true,
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_agent_control_acquire(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    session_id: String,
    workspace_id: Option<String>,
    agent_id: String,
    channel: ControlChannel,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
        return;
    }
    let key = match lifecycle_key_for_request(
        state,
        &session_id,
        workspace_id.as_deref(),
        Some(&agent_id),
    ) {
        Ok(key) => key,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_lifecycle_not_found",
                error,
                false,
            );
            return;
        }
    };
    let client = match connection_client_identity(state) {
        Ok(client) => client,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "connection_identity_invalid",
                error,
                false,
            );
            return;
        }
    };
    let _views_guard = state.agent_views.lock().unwrap();
    if !_views_guard.contains_key(&key) {
        fail(
            &state.out_tx,
            request_id,
            "agent_view_required",
            "Open this agent before taking control".to_string(),
            false,
        );
        return;
    }
    match state
        .app
        .agent_runtime
        .acquire_control(&key, channel, client, now_millis())
    {
        Ok(lease) => {
            let key_name = lifecycle_control_key(&key, channel);
            match channel {
                ControlChannel::Input => state
                    .agent_input_leases
                    .lock()
                    .unwrap()
                    .insert(key_name, lease.clone()),
                ControlChannel::Resize => state
                    .agent_resize_leases
                    .lock()
                    .unwrap()
                    .insert(key_name, lease.clone()),
            };
            let _ = state.out_tx.send(ServerMessage::AgentControl {
                request_id,
                session_id,
                agent_id,
                channel,
                lease: Some(control_lease_to_wire(&lease)),
                status: state
                    .app
                    .agent_runtime
                    .snapshot(&key)
                    .ok()
                    .map(lifecycle_status_to_wire),
            });
        }
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_control_acquire_failed",
                if matches!(
                    error,
                    crate::agent_runtime::RuntimeAdapterError::Ownership(
                        crate::agent_fleet::OwnershipError::AlreadyOwned { .. }
                    )
                ) {
                    "Another viewer has control. Release it there, then take control here."
                        .to_string()
                } else {
                    error.to_string()
                },
                true,
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_agent_control_release(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    session_id: String,
    workspace_id: Option<String>,
    agent_id: String,
    channel: ControlChannel,
    generation: u64,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
        return;
    }
    let key = match lifecycle_key_for_request(
        state,
        &session_id,
        workspace_id.as_deref(),
        Some(&agent_id),
    ) {
        Ok(key) => key,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_lifecycle_not_found",
                error,
                false,
            );
            return;
        }
    };
    let client = match connection_client_identity(state) {
        Ok(client) => client,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "connection_identity_invalid",
                error,
                false,
            );
            return;
        }
    };
    match state
        .app
        .agent_runtime
        .release_control(&key, channel, &client, generation)
    {
        Ok(_) => {
            let key_name = lifecycle_control_key(&key, channel);
            match channel {
                ControlChannel::Input => {
                    state.agent_input_leases.lock().unwrap().remove(&key_name);
                }
                ControlChannel::Resize => {
                    state.agent_resize_leases.lock().unwrap().remove(&key_name);
                }
            }
            let _ = state.out_tx.send(ServerMessage::AgentControl {
                request_id,
                session_id,
                agent_id,
                channel,
                lease: None,
                status: state
                    .app
                    .agent_runtime
                    .snapshot(&key)
                    .ok()
                    .map(lifecycle_status_to_wire),
            });
        }
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "agent_control_release_failed",
                error.to_string(),
                false,
            );
        }
    }
}
