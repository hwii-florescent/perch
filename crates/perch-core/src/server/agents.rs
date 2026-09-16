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
    preference: &crate::db::ProviderPreference,
) -> crate::protocol::AgentManifestSummary {
    let cli_executable = manifest
        .launch
        .mode_overrides
        .get(&AgentMode::Cli)
        .map(|recipe| &recipe.executable)
        .unwrap_or(&manifest.launch.executable);
    let executable = crate::agent_catalog::resolve_executable(&manifest.id, cli_executable)
        .ok()
        .map(|path| path.to_string_lossy().into_owned());
    let reason = executable
        .is_none()
        .then(|| format!("executable `{}` was not found on this host", cli_executable));
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
        homepage_url: crate::agent_catalog::lookup(&manifest.id)
            .map(|entry| entry.homepage_url.clone()),
        // Only publish the catalog's public command, never configured argv or
        // environment values (a custom provider may carry credentials there).
        launch_command: Some(
            crate::agent_catalog::lookup(&manifest.id)
                .map(|entry| {
                    std::iter::once(entry.executable.as_str())
                        .chain(entry.prefix_args.iter().map(String::as_str))
                        .chain(entry.default_args.iter().map(String::as_str))
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_else(|| cli_executable.clone()),
        ),
        enabled: Some(preference.enabled),
        is_default: Some(preference.is_default),
        native_ui: Some(crate::native_ui::supported(&manifest.id)),
    }
}

fn catalog_response(state: &Arc<ConnState>, request_id: String) -> anyhow::Result<ServerMessage> {
    let (revision, preferences) = state.app.db.provider_preferences()?;
    let manifests = state
        .app
        .agent_runtime
        .providers()
        .list()
        .iter()
        .map(|manifest| {
            provider_manifest_summary(
                manifest,
                preferences
                    .get(&manifest.id)
                    .unwrap_or(&crate::db::ProviderPreference::default()),
            )
        })
        .collect();
    Ok(ServerMessage::AgentManifestList {
        request_id,
        host_id: Some("local".into()),
        manifests,
        revision: Some(revision),
    })
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_agent_provider_configure(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    provider_id: String,
    enabled: Option<bool>,
    is_default: Option<bool>,
) {
    if request_id.trim().is_empty() || (enabled.is_none() && is_default.is_none()) {
        fail(
            &state.out_tx,
            request_id,
            "invalid_request",
            "Choose an agent preference to change",
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
            PendingKey::Request(request_id),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(target, &strip_host_id(raw_text));
        return;
    }
    let result = (|| -> anyhow::Result<ServerMessage> {
        let _operation = state.app.agent_operation_lock.lock().unwrap();
        let manifest = state
            .app
            .agent_runtime
            .providers()
            .get(&provider_id)
            .ok_or_else(|| anyhow::anyhow!("unknown provider {provider_id}"))?;
        if is_default == Some(true) {
            anyhow::ensure!(
                provider_manifest_summary(&manifest, &crate::db::ProviderPreference::default())
                    .available,
                "Install this agent before making it the default"
            );
        }
        state
            .app
            .db
            .configure_provider(&provider_id, enabled, is_default)?;
        catalog_response(state, request_id.clone())
    })();
    match result {
        Ok(reply) => {
            let _ = state.out_tx.send(reply.clone());
            // An empty request id denotes a host-wide snapshot push. Revision
            // guards prevent an older concurrent refresh replacing this state.
            if let ServerMessage::AgentManifestList {
                manifests,
                revision,
                ..
            } = reply
            {
                let _ =
                    state
                        .app
                        .hub
                        .hub_events_tx
                        .send(Arc::new(ServerMessage::AgentManifestList {
                            request_id: String::new(),
                            host_id: Some("local".into()),
                            manifests,
                            revision,
                        }));
            }
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "provider_configure_failed",
            error.to_string(),
            false,
        ),
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
    ClientIdentity::new(
        state.conn_id.clone(),
        state.device_id.as_deref().unwrap_or("local"),
        ClientKind::Desktop,
    )
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
    match catalog_response(state, request_id.clone()) {
        Ok(reply) => {
            let _ = state.out_tx.send(reply);
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "provider_catalog_failed",
            error.to_string(),
            true,
        ),
    }
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
