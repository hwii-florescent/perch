//! Web UI transport for the same native interactive CLI session.
use super::*;
use crate::agent_fleet::AgentState;
use sha2::{Digest, Sha256};
use std::time::Duration;

pub(super) fn observe(app: &AppState, key: AgentKey) -> anyhow::Result<()> {
    let runtime = app.agent_runtime.clone();
    let alive_key = key.clone();
    let event_app = app.clone();
    let event_key = key.clone();
    let provider_session_id = app
        .agent_runtime
        .runtime(&key)
        .and_then(|runtime| runtime.provider_session_id);
    app.native_ui.start(
        key,
        provider_session_id,
        Arc::new(move || runtime.runtime(&alive_key).is_some()),
        Arc::new(move |snapshot| {
            let app = &event_app;
            let key = &event_key;
            let _operation = app.agent_operation_lock.lock().unwrap();
            if !app.db.session_exists(&key.session_id).unwrap_or(false) {
                return;
            }
            if let Err(error) = app.agent_runtime.observe_native_turn(key, snapshot.running) {
                tracing::error!(%error, "could not persist completed native turn");
                return;
            }
            let old = app.agent_runtime.snapshot(key).ok();
            let state = if snapshot.running {
                AgentState::Working
            } else if snapshot.messages.is_empty() {
                AgentState::Idle
            } else {
                AgentState::Done
            };
            // OpenCode's home view has no conversation yet. Keep the last real
            // continuation until the TUI itself creates/selects another session.
            let session_changed = !snapshot.provider_session_id.is_empty()
                && old.as_ref().is_none_or(|old| {
                    old.provider_session_id.as_deref() != Some(&snapshot.provider_session_id)
                });
            if session_changed {
                if key.agent_id == "claude" {
                    let _ = app
                        .db
                        .set_claude_session_id(&key.session_id, &snapshot.provider_session_id);
                } else if key.agent_id == "codex" {
                    let _ = app
                        .db
                        .set_codex_thread_id(&key.session_id, &snapshot.provider_session_id);
                } else if key.agent_id == "opencode" {
                    let _ = app
                        .db
                        .set_opencode_session_id(&key.session_id, &snapshot.provider_session_id);
                }
            }
            // Also establish native authority after resuming an already-known
            // identity; terminal repaints must not override these events.
            if !snapshot.provider_session_id.is_empty() {
                let _ = app
                    .agent_runtime
                    .record_provider_session_id(key, snapshot.provider_session_id.clone());
            }
            if session_changed || old.as_ref().is_none_or(|old| old.state != state) {
                let _ = app.agent_runtime.lifecycle().transition(
                    key,
                    state,
                    "native CLI session event",
                    now_millis(),
                );
                let _ = persist_agent_runtime(app, key);
            }
            let _ = app
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::AgentUiSnapshot {
                    request_id: None,
                    session_id: key.session_id.clone(),
                    provider_id: key.agent_id.clone(),
                    snapshot,
                }));
        }),
    )
}

fn resolve(
    state: &Arc<ConnState>,
    session_id: &str,
    provider_id: &str,
) -> anyhow::Result<AgentKey> {
    anyhow::ensure!(
        crate::native_ui::supported(provider_id),
        "This CLI does not yet expose a structured UI connection"
    );
    let row = state
        .app
        .db
        .get_session(session_id)?
        .ok_or_else(|| anyhow::anyhow!("unknown session"))?;
    anyhow::ensure!(
        row.cli_provider_id.as_deref() == Some(provider_id),
        "provider does not own this session"
    );
    let key = AgentKey::new(
        row.workspace_id
            .as_deref()
            .unwrap_or(&format!("session-{session_id}")),
        session_id,
        provider_id,
    )?;
    anyhow::ensure!(
        state.app.agent_runtime.runtime_alive(&key),
        "Open this CLI session before using its web view"
    );
    Ok(key)
}

pub(super) fn get(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let result = resolve(state, &session_id, &provider_id).and_then(|key| {
        observe(&state.app, key.clone())?;
        state
            .app
            .native_ui
            .get(&key)
            .ok_or_else(|| anyhow::anyhow!("Native UI is starting. Retry shortly."))
    });
    let bridge = match result {
        Ok(bridge) => bridge,
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "native_ui_unavailable",
                error.to_string(),
                true,
            );
            return;
        }
    };
    let tx = state.out_tx.clone();
    tokio::spawn(async move {
        match bridge.snapshot().await {
            Ok(snapshot) => { let _ = tx.send(ServerMessage::AgentUiSnapshot { request_id: Some(request_id), session_id, provider_id, snapshot }); }
            Err(error) => fail(&tx, request_id, "native_ui_unavailable", format!("{error}. Open CLI view to finish any startup prompts, then reconnect UI. A CLI opened before this update needs an explicit restart to load its web connection."), true),
        }
    });
}

#[allow(clippy::too_many_arguments)]
pub(super) fn control(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
    generation: u64,
    prompt: Option<(String, String)>,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let operation_id = prompt.as_ref().map(|(id, _)| id.clone());
    let prepared =
        (|| -> anyhow::Result<Option<tokio::sync::oneshot::Receiver<Result<bool, String>>>> {
            anyhow::ensure!(
                !request_id.is_empty() && request_id.len() <= 128,
                "invalid request id"
            );
            let key = resolve(state, &session_id, &provider_id)?;
            let lease_key = agents::lifecycle_control_key(&key, ControlChannel::Input);
            let lease = state
                .agent_input_leases
                .lock()
                .unwrap()
                .get(&lease_key)
                .cloned()
                .ok_or_else(|| {
                    anyhow::anyhow!("Take control of this agent before sending input")
                })?;
            anyhow::ensure!(
                lease.generation == generation,
                "Input control changed; take control again"
            );
            let bridge = state
                .app
                .native_ui
                .get(&key)
                .ok_or_else(|| anyhow::anyhow!("native CLI UI is unavailable"))?;
            state.app.agent_runtime.dispatch_native_control(&key, &lease, |write| {
            if let Some((operation, text)) = &prompt {
                anyhow::ensure!(!operation.is_empty() && operation.len() <= 128 && !text.trim().is_empty() && text.len() <= 64 * 1024, "invalid prompt");
                let digest = format!("{:x}", Sha256::digest(format!("{provider_id}\0{text}").as_bytes()));
                let (existing, _) = state.app.db.reserve_prompt_operation(operation, &session_id, Some(&key.workspace_id), &digest, text, Some(&provider_id), None)?;
                if existing.state == "delivered" { return Ok(None); }
                let input = crate::native_ui::claude::prepare_input(&key, Some(text))?;
                let claim = state.app.db.claim_prompt_operation(operation)?.ok_or_else(|| anyhow::anyhow!("missing prompt operation"))?;
                anyhow::ensure!(claim.won_claim, "This prompt was already dispatched; delivery is still unconfirmed. It will not be sent twice.");
                // Persist uncertainty before any bytes cross to the native CLI.
                state.app.db.set_prompt_operation_state(operation, "unconfirmed")?;
                state.app.agent_runtime.record_turn_boundary(&key, true)?;
                let reply = bridge.enqueue(operation, Some(text))?;
                if let Some(input) = input { write(&input)?; }
                let _ = state.app.db.set_cli_title(&session_id, text);
                Ok(Some(reply))
            } else {
                let input = crate::native_ui::claude::prepare_input(&key, None)?;
                let reply = bridge.enqueue(&request_id, None)?;
                if let Some(input) = input { write(&input)?; }
                Ok(Some(reply))
            }
        })
        })();
    match prepared {
        Ok(None) => {
            let _ = state.out_tx.send(ServerMessage::AgentUiResult {
                request_id,
                session_id,
                accepted: true,
            });
        }
        Ok(Some(reply)) => {
            let state = state.clone();
            tokio::spawn(async move {
                let result = tokio::time::timeout(Duration::from_secs(10), reply).await;
                match result {
                    Ok(Ok(Ok(true))) => {
                        if let Some(operation) = operation_id {
                            if let Err(error) = session::settle_prompt_dispatch(&state.app, &operation, "delivered") {
                                fail(&state.out_tx, request_id, "native_ui_delivery_unconfirmed", error, false); return;
                            }
                        }
                        notify_session_updated(&state.app, &session_id);
                        let _ = state.out_tx.send(ServerMessage::AgentUiResult { request_id, session_id, accepted: true });
                    }
                    other => fail(&state.out_tx, request_id, "native_ui_delivery_unconfirmed", format!("The CLI did not confirm this action ({other:?}). Reconnect to inspect its transcript before sending again."), false),
                }
            });
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "native_ui_control_failed",
            error.to_string(),
            false,
        ),
    }
}

/// A review is one explicit user-input operation. Git views may have no
/// terminal view (especially on mobile), so borrow input only when unowned.
/// Existing owners are preserved; another client's lease is never displaced.
pub(super) async fn send_review(
    state: &Arc<ConnState>,
    request_id: String,
    packet: crate::db::ReviewPacketRow,
    session_id: &str,
    provider_id: &str,
) {
    let prepared = async {
        let key = resolve(state, session_id, provider_id)?;
        observe(&state.app, key.clone())?;
        let bridge = state.app.native_ui.get(&key).ok_or_else(|| anyhow::anyhow!("Native CLI UI is unavailable"))?;
        // Readiness precedes reservation: an unavailable CLI leaves the
        // frozen packet retryable and does not consume its operation id.
        bridge.snapshot().await?;
        let _operation = state.app.agent_operation_lock.lock().unwrap();
        anyhow::ensure!(!state.out_tx.is_closed(), "Review sender disconnected");
        let key = resolve(state, session_id, provider_id)?;
        let client = connection_client_identity(state).map_err(anyhow::Error::msg)?;
        let before = state.app.agent_runtime.snapshot(&key)?;
        let had_observer = before.observers.contains(&client.id);
        let borrowed = before.input_owner.is_none();
        let lease = state.app.agent_runtime.acquire_control(&key, ControlChannel::Input, client.clone(), now_millis())
            .map_err(|error| anyhow::anyhow!("Release this agent's control in the other view before sending review notes: {error}"))?;
        let result = state.app.agent_runtime.dispatch_native_control(&key, &lease, |write| {
            let operation = &packet.packet.send_operation_id;
            let text = &packet.packet.markdown;
            anyhow::ensure!(!text.trim().is_empty() && text.len() <= 64 * 1024, "Invalid review packet size");
            let digest = format!("{:x}", Sha256::digest(format!("{provider_id}\0{text}").as_bytes()));
            let (existing, _) = state.app.db.reserve_prompt_operation(operation, session_id, Some(&key.workspace_id), &digest, text, Some(provider_id), None)?;
            if existing.state == "delivered" { return Ok(None); }
            let input = crate::native_ui::claude::prepare_input(&key, Some(text))?;
            let (_, won) = state.app.db.claim_review_packet(&packet.packet.packet_id, operation, &key.workspace_id, wall_clock_millis())?
                .ok_or_else(|| anyhow::anyhow!("Review packet disappeared"))?;
            if !won { return Ok(None); }
            let claim = state.app.db.claim_prompt_operation(operation)?.ok_or_else(|| anyhow::anyhow!("Prompt operation disappeared"))?;
            anyhow::ensure!(claim.won_claim, "Review delivery is already in progress or unconfirmed; it will not be sent twice");
            session::settle_prompt_dispatch(&state.app, operation, "unconfirmed")
                .map_err(anyhow::Error::msg)?;
            state.app.agent_runtime.record_turn_boundary(&key, true)?;
            let reply = bridge.enqueue(operation, Some(text))?;
            if let Some(input) = input { write(&input)?; }
            Ok(Some(reply))
        });
        if borrowed {
            let _ = state.app.agent_runtime.release_control(&key, ControlChannel::Input, &client, lease.generation);
            if !had_observer {
                let _ = state.app.agent_runtime.lifecycle().detach_observer(&key, &client.id);
            }
        }
        result
    }.await;
    match prepared {
        Ok(Some(reply)) => {
            let accepted = matches!(
                tokio::time::timeout(Duration::from_secs(10), reply).await,
                Ok(Ok(Ok(true)))
            );
            let outcome = if accepted { "delivered" } else { "unconfirmed" };
            if let Err(error) = session::settle_prompt_dispatch(
                &state.app,
                &packet.packet.send_operation_id,
                outcome,
            ) {
                fail(
                    &state.out_tx,
                    request_id,
                    "review_delivery_persistence_failed",
                    error,
                    false,
                );
                return;
            }
            notify_session_updated(&state.app, session_id);
        }
        Ok(None) => {}
        Err(error) => {
            fail(
                &state.out_tx,
                request_id,
                "review_native_dispatch_failed",
                error.to_string(),
                true,
            );
            return;
        }
    }
    match state.app.db.get_review_packet(&packet.packet.packet_id) {
        Ok(Some(row)) => {
            let _ = state
                .out_tx
                .send(reviews::review_delivery_result(request_id, row));
        }
        _ => fail(
            &state.out_tx,
            request_id,
            "review_packet_missing",
            "Review packet could not be read after dispatch",
            false,
        ),
    }
}
