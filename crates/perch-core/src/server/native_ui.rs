//! Web UI transport for the same native interactive CLI session.
use super::*;
use crate::agent_fleet::AgentState;
use anyhow::Context as _;
use sha2::{Digest, Sha256};
use std::time::Duration;

pub(super) fn observe(app: &AppState, key: AgentKey) -> anyhow::Result<()> {
    observe_runtime(app, key.clone(), key, None)
}

pub(super) fn observe_shell(
    app: &AppState,
    key: AgentKey,
    agent: crate::shell_integration::ShellAgent,
) -> anyhow::Result<()> {
    observe_runtime(app, key, agent.key.clone(), Some(agent))
}

fn observe_runtime(
    app: &AppState,
    key: AgentKey,
    bridge_key: AgentKey,
    shell: Option<crate::shell_integration::ShellAgent>,
) -> anyhow::Result<()> {
    let runtime = app.agent_runtime.clone();
    let alive_key = key.clone();
    let event_app = app.clone();
    let event_key = key.clone();
    let provider = bridge_key.agent_id.clone();
    let alive_shell = shell.clone();
    let screen_key = bridge_key.clone();
    let provider_session_id = if shell.is_some() {
        None
    } else {
        app.agent_runtime
            .runtime(&key)
            .and_then(|runtime| runtime.provider_session_id)
    };
    app.native_ui.start(
        bridge_key,
        provider_session_id,
        Arc::new(move || {
            alive_shell.as_ref().map_or_else(
                || runtime.native_owner_is_current(&alive_key),
                |agent| runtime.shell_agent_is_current(&alive_key, agent),
            )
        }),
        Arc::new(move |snapshot| {
            let app = &event_app;
            let key = &event_key;
            let _operation = app.agent_operation_lock.lock().unwrap();
            if let Some(agent) = &shell {
                if !app.agent_runtime.shell_agent_is_current(key, agent)
                    || !crate::shell_integration::snapshot_matches(agent, snapshot.pid)
                {
                    return;
                }
                app.agent_runtime.set_native_status(key);
            } else if !app.agent_runtime.native_owner_is_current(key) {
                return;
            }
            // A deleted session has nothing left to publish. A *failed* read is
            // not a deletion: treating it as one would silently drop the live
            // transcript of a session that still exists.
            if matches!(app.db.session_exists(&key.session_id), Ok(false)) {
                return;
            }
            // Turn history, provider identity and lifecycle state are
            // bookkeeping *about* this snapshot. None of them may suppress the
            // snapshot itself: the web view renders only what it receives, so
            // one swallowed frame leaves the transcript frozen mid-stream on
            // "Working" while the CLI has already answered.
            let starts_turn = match app.agent_runtime.observe_native_turn(key, snapshot.running) {
                Ok(started) => started,
                Err(error) => {
                    tracing::error!(%error, "could not persist completed native turn");
                    false
                }
            };
            // Started/output may already have made the lifecycle Working. A
            // real native turn still needs its explicit event for the sidebar.
            if starts_turn {
                let _ = app.agent_runtime.signal(
                    key,
                    crate::agent_fleet::ProviderSignal::TurnStarted,
                    now_millis(),
                );
            }
            let old = app.agent_runtime.snapshot(key).ok();
            let state = if snapshot.blocked {
                AgentState::Blocked
            } else if snapshot.running {
                AgentState::Working
            } else if snapshot.messages.is_empty() {
                AgentState::Idle
            } else {
                AgentState::Done
            };
            // OpenCode's home view has no conversation yet. Keep the last real
            // continuation until the TUI itself creates/selects another session.
            let session_changed = shell.is_none()
                && !snapshot.provider_session_id.is_empty()
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
            if shell.is_none() && !snapshot.provider_session_id.is_empty() {
                let _ = app
                    .agent_runtime
                    .record_provider_session_id(key, snapshot.provider_session_id.clone());
            }
            if session_changed || old.as_ref().is_none_or(|old| old.state != state) {
                // A prompt and its permission request can land in one poll.
                // Blocked is a pause *inside* a turn, so start the turn first
                // (Done → Blocked is not a legal edge, and the turn boundary
                // hangs off entering Working).
                if state == AgentState::Blocked
                    && old.as_ref().is_some_and(|old| {
                        !matches!(old.state, AgentState::Working | AgentState::Blocked)
                    })
                {
                    let _ = app.agent_runtime.lifecycle().transition(
                        key,
                        AgentState::Working,
                        "native CLI session event",
                        now_millis(),
                    );
                }
                let _ = app.agent_runtime.lifecycle().transition(
                    key,
                    state,
                    "native CLI session event",
                    now_millis(),
                );
                let _ = persist_agent_runtime(app, key);
            }
            // Every snapshot is fresh status evidence (see `stale_sessions`).
            let _ = app
                .agent_runtime
                .lifecycle()
                .record_activity(key, now_millis());
            let _ = app
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::AgentUiSnapshot {
                    request_id: None,
                    session_id: key.session_id.clone(),
                    provider_id: provider.clone(),
                    snapshot: with_transcript(snapshot, &screen_key),
                }));
        }),
    )
}

/// `key` owns the PTY, leases and lifecycle; `bridge` owns the native connection. They are the
/// same agent for a picker launch. For an agent typed into a Terminal tab the tab (provider
/// `terminal`) is `key` and the shim-launched agent is `bridge`/`shell`.
struct Target {
    key: AgentKey,
    bridge: AgentKey,
    shell: Option<crate::shell_integration::ShellAgent>,
}

fn resolve(state: &Arc<ConnState>, session_id: &str, provider_id: &str) -> anyhow::Result<Target> {
    anyhow::ensure!(
        crate::native_ui::supported(provider_id),
        "This CLI does not yet expose a structured UI connection"
    );
    let row = state
        .app
        .db
        .get_session(session_id)?
        .ok_or_else(|| anyhow::anyhow!("unknown session"))?;
    let workspace = row
        .workspace_id
        .clone()
        .unwrap_or_else(|| format!("session-{session_id}"));
    if row.cli_provider_id.as_deref() == Some(crate::agent_fleet::TERMINAL_PROVIDER) {
        let key = AgentKey::new(
            &workspace,
            session_id,
            crate::agent_fleet::TERMINAL_PROVIDER,
        )?;
        let shell = state
            .app
            .agent_runtime
            .shell_agents()
            .into_iter()
            .find_map(|(owner, agent)| {
                (owner == key && agent.key.agent_id == provider_id).then_some(agent)
            })
            .ok_or_else(|| anyhow::anyhow!("{provider_id} is not running in this terminal"))?;
        anyhow::ensure!(
            state.app.agent_runtime.shell_agent_is_current(&key, &shell),
            "{provider_id} is not running in this terminal"
        );
        return Ok(Target {
            bridge: shell.key.clone(),
            key,
            shell: Some(shell),
        });
    }
    anyhow::ensure!(
        row.cli_provider_id.as_deref() == Some(provider_id),
        "provider does not own this session"
    );
    let key = AgentKey::new(&workspace, session_id, provider_id)?;
    anyhow::ensure!(
        state.app.agent_runtime.runtime_alive(&key),
        "Open this CLI session before using its web view"
    );
    Ok(Target {
        bridge: key.clone(),
        key,
        shell: None,
    })
}

/// What the running `provider` CLI reports after `/` for this session, or nothing when it is not
/// running here (the caller adds the built-ins either way).
pub(super) fn live_commands(
    state: &Arc<ConnState>,
    session_id: &str,
    provider_id: &str,
) -> Vec<crate::protocol::CommandEntry> {
    resolve(state, session_id, provider_id)
        .ok()
        .and_then(|target| state.app.native_ui.get(&target.bridge))
        .map_or_else(Vec::new, |bridge| bridge.slash_commands())
}

/// The snapshot as viewers receive it: the bridge's raw messages plus what the chat draws and the
/// toolbar's read-only option labels.
/// ponytail: the projection repeats tool inputs and outputs, so a snapshot can be about twice the
/// bridge's 192 KB message cap (each step body is capped at 4000 chars). Drop `messages` text the
/// projection carries once no older web can be talking to this core.
fn with_transcript(
    mut snapshot: crate::protocol::NativeUiSnapshot,
    bridge: &AgentKey,
) -> crate::protocol::NativeUiSnapshot {
    snapshot.transcript = Some(Box::new(crate::native_ui::transcript::project(&snapshot)));
    let options = crate::native_ui::session_options::options_of(&snapshot);
    let screen = pickers_screen(bridge, &snapshot);
    snapshot.options = crate::native_ui::option_pickers::with_pickers(
        &bridge.agent_id,
        &snapshot,
        options,
        screen.as_deref(),
    );
    snapshot
}

/// The CLI's screen, for the pickers' read-back, and only for a CLI that has pickers. While a turn or a
/// prompt owns the keys the pickers are locked and the screen is not read again: the last one read
/// stands in, so the controls do not come and go with every turn.
fn pickers_screen(
    bridge: &AgentKey,
    snapshot: &crate::protocol::NativeUiSnapshot,
) -> Option<String> {
    static LAST: Mutex<BTreeMap<String, String>> = Mutex::new(BTreeMap::new());
    if bridge.agent_id != "claude" {
        return None;
    }
    let pty = crate::shell_integration::pty_key(bridge);
    if snapshot.running || snapshot.blocked {
        return LAST.lock().unwrap().get(&pty).cloned();
    }
    let text = crate::daemon::client()
        .ok()?
        .snapshot(&pty)
        .ok()
        .map(|screen| screen.text)?;
    let mut last = LAST.lock().unwrap();
    if last.len() > 256 {
        last.clear();
    }
    last.insert(pty, text.clone());
    Some(text)
}

/// Blocks of the session's latest snapshot that contain `query`. Answers from what the bridge
/// last reported, so it never starts or waits on a bridge.
pub(super) fn find(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
    query: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let latest = resolve(state, &session_id, &provider_id).and_then(|target| {
        state
            .app
            .native_ui
            .get(&target.bridge)
            .and_then(|bridge| bridge.latest())
            .ok_or_else(|| anyhow::anyhow!("Native UI is starting. Retry shortly."))
    });
    match latest {
        Ok(snapshot) => {
            let transcript = crate::native_ui::transcript::project(&snapshot);
            let blocks = crate::native_ui::transcript::find(&snapshot, &transcript, &query);
            let _ = state.out_tx.send(ServerMessage::AgentUiFound {
                request_id,
                session_id,
                blocks,
            });
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "native_ui_unavailable",
            error.to_string(),
            true,
        ),
    }
}

/// The text half-typed on the CLI's own input line, for the composer to pick up. Read-only: no lease, no keys.
pub(super) fn draft(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    match resolve(state, &session_id, &provider_id)
        .and_then(|target| crate::native_ui::typed::pickup(&target.key))
    {
        Ok(text) => {
            let _ = state.out_tx.send(ServerMessage::AgentUiDrafted {
                request_id,
                session_id,
                text,
            });
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "native_ui_unavailable",
            error.to_string(),
            true,
        ),
    }
}

/// One page further back. The longer snapshot reaches viewers the usual way; the reply says whether
/// the page changed anything.
pub(super) fn older(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let bridge = resolve(state, &session_id, &provider_id).and_then(|target| {
        state
            .app
            .native_ui
            .get(&target.bridge)
            .ok_or_else(|| anyhow::anyhow!("Native UI is starting. Retry shortly."))
    });
    let bridge = match bridge {
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
        let outcome = bridge.load_older().await;
        let _ = tx.send(ServerMessage::AgentUiOlderResult {
            request_id,
            session_id,
            outcome,
        });
    });
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
    let result = resolve(state, &session_id, &provider_id).and_then(|target| {
        match target.shell {
            Some(agent) => observe_shell(&state.app, target.key, agent)?,
            None => observe(&state.app, target.key)?,
        }
        state
            .app
            .native_ui
            .get(&target.bridge)
            .map(|bridge| (bridge, target.bridge.clone()))
            .ok_or_else(|| anyhow::anyhow!("Native UI is starting. Retry shortly."))
    });
    let (bridge, bridge_key) = match result {
        Ok(found) => found,
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
            Ok(snapshot) => { let snapshot = with_transcript(snapshot, &bridge_key); let _ = tx.send(ServerMessage::AgentUiSnapshot { request_id: Some(request_id), session_id, provider_id, snapshot }); }
            Err(error) => fail(&tx, request_id, "native_ui_unavailable", format!("{error}. Open CLI view to finish any startup prompts, then reconnect UI. A CLI opened before this update needs an explicit restart to load its web connection."), true),
        }
    });
}

/// Stop the current turn without ending the session: Claude's Esc into a verified process, the other
/// providers' own cancel through the bridge (Codex `turn/interrupt`, Pi and OMP abort). Called with the
/// runtime's authority held, by the chat's Stop and by the family strip's Interrupt alike. The reply
/// is the provider's answer, never proof the turn ended.
pub(super) fn queue_cancel(
    bridge_key: &AgentKey,
    bridge: &crate::native_ui::NativeBridge,
    id: &str,
    write: &dyn Fn(&str) -> anyhow::Result<()>,
) -> anyhow::Result<tokio::sync::oneshot::Receiver<Result<bool, String>>> {
    let input = crate::native_ui::claude::prepare_input(bridge_key, None)?;
    let reply = bridge.enqueue(id, None)?;
    if let Some(input) = input {
        crate::native_ui::claude::write_input(&input, write)?;
    }
    Ok(reply)
}

#[allow(clippy::too_many_arguments)]
pub(super) fn control(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
    generation: u64,
    prompt: Option<(String, String, Option<String>)>,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let operation_id = prompt.as_ref().map(|(id, _, _)| id.clone());
    let command = std::cell::Cell::new(false);
    let prepared =
        (|| -> anyhow::Result<Option<tokio::sync::oneshot::Receiver<Result<bool, String>>>> {
            anyhow::ensure!(
                !request_id.is_empty() && request_id.len() <= 128,
                "invalid request id"
            );
            let Target {
                key,
                bridge: bridge_key,
                ..
            } = resolve(state, &session_id, &provider_id)?;
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
                .get(&bridge_key)
                .ok_or_else(|| anyhow::anyhow!("native CLI UI is unavailable"))?;
            state.app.agent_runtime.dispatch_native_control(&key, &lease, |write| {
            if let Some((operation, text, replaces)) = &prompt {
                anyhow::ensure!(!operation.is_empty() && operation.len() <= 128 && !text.trim().is_empty() && text.len() <= 64 * 1024, "invalid prompt");
                let digest = format!("{:x}", Sha256::digest(format!("{provider_id}\0{text}").as_bytes()));
                let (existing, _) = state.app.db.reserve_prompt_operation(operation, &session_id, Some(&key.workspace_id), &digest, text, Some(&provider_id), None)?;
                if existing.state == "delivered" { return Ok(None); }
                // The composer showed what was typed on the CLI's own line: this message replaces it. Cleared
                // only if it is still exactly that, and verified, before any byte of the message is written.
                if let Some(picked) = replaces {
                    crate::native_ui::typed::clear_pickup(&bridge_key, picked, bridge.latest().as_ref(), write)?;
                }
                // A built-in slash command is a TUI control, not a message: it runs in the terminal, has no
                // turn and nothing to confirm, and must never reach the model as prose.
                if crate::native_ui::typed::route(&provider_id, text, bridge.slash_commands()) == crate::native_ui::typed::Route::Terminal {
                    crate::native_ui::typed::prepare(&bridge_key, text, bridge.latest().as_ref())?;
                    let input = crate::native_ui::claude::prepare_input(&bridge_key, Some(text))?;
                    let claim = state.app.db.claim_prompt_operation(operation)?.ok_or_else(|| anyhow::anyhow!("missing prompt operation"))?;
                    anyhow::ensure!(claim.won_claim, "This command was already dispatched. It will not be sent twice.");
                    state.app.db.set_prompt_operation_state(operation, "unconfirmed")?;
                    match input {
                        // Claude's paste path is the one it already confirms an empty prompt for.
                        Some(input) => crate::native_ui::claude::write_input(&input, write)?,
                        None => crate::native_ui::typed::type_command(text, write)?,
                    }
                    session::settle_prompt_dispatch(&state.app, operation, "delivered").map_err(anyhow::Error::msg)?;
                    command.set(true);
                    return Ok(None);
                }
                let input = crate::native_ui::claude::prepare_input(&bridge_key, Some(text))?;
                let claim = state.app.db.claim_prompt_operation(operation)?.ok_or_else(|| anyhow::anyhow!("missing prompt operation"))?;
                anyhow::ensure!(claim.won_claim, "This prompt was already dispatched; delivery is still unconfirmed. It will not be sent twice.");
                // Persist uncertainty before any bytes cross to the native CLI.
                state.app.db.set_prompt_operation_state(operation, "unconfirmed")?;
                state.app.agent_runtime.record_turn_boundary(&key, true)?;
                let reply = bridge.enqueue(operation, Some(text))?;
                if let Some(input) = input { crate::native_ui::claude::write_input(&input, write)?; }
                let _ = state.app.db.set_cli_title(&session_id, text);
                Ok(Some(reply))
            } else {
                Ok(Some(queue_cancel(&bridge_key, &bridge, &request_id, write)?))
            }
        })
        })();
    match prepared {
        Ok(None) => {
            let _ = state.out_tx.send(ServerMessage::AgentUiResult {
                request_id,
                session_id,
                accepted: true,
                command: command.get(),
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
                        let _ = state.out_tx.send(ServerMessage::AgentUiResult { request_id, session_id, accepted: true, command: false });
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

/// Answer the numbered permission prompt or question the CLI is showing: one
/// digit, written under the input lease, and only if the screen still shows
/// the exact prompt (`prompt_id`) the user answered. Never retried or replayed.
#[allow(clippy::too_many_arguments)]
pub(super) fn answer(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
    generation: u64,
    prompt_id: String,
    choice: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let written = (|| -> anyhow::Result<()> {
        let Target {
            key,
            bridge: bridge_key,
            ..
        } = resolve(state, &session_id, &provider_id)?;
        let lease_key = agents::lifecycle_control_key(&key, ControlChannel::Input);
        let lease = state
            .agent_input_leases
            .lock()
            .unwrap()
            .get(&lease_key)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Take control of this agent before answering"))?;
        anyhow::ensure!(
            lease.generation == generation,
            "Input control changed; take control again"
        );
        state
            .app
            .agent_runtime
            .dispatch_native_control(&key, &lease, |write| {
                let shown = crate::native_ui::dialog::read_dialog(&bridge_key)
                    .ok_or_else(|| anyhow::anyhow!("The prompt is no longer on screen"))?;
                anyhow::ensure!(
                    shown.request.id == prompt_id,
                    "The CLI is showing a different prompt now. Review it and answer again."
                );
                let writes = shown
                    .writes(&choice)
                    .ok_or_else(|| anyhow::anyhow!("That choice is not available"))?;
                // A highlight move must render before Enter commits it.
                for (index, data) in writes.iter().enumerate() {
                    if index > 0 {
                        std::thread::sleep(Duration::from_millis(150));
                    }
                    write(data)?;
                }
                Ok(())
            })
    })();
    match written {
        Ok(()) => {
            let _ = state.out_tx.send(ServerMessage::AgentUiResult {
                request_id,
                session_id,
                accepted: true,
                command: false,
            });
        }
        Err(error) => fail(
            &state.out_tx,
            request_id,
            "native_ui_answer_failed",
            error.to_string(),
            false,
        ),
    }
}

/// Change the model, effort or permission mode of the running CLI from the chat (`agent.ui.option`).
/// Only at an idle, verified-empty prompt under the input lease; the CLI's own command or key is the
/// write, and the answer is whatever the CLI then shows: a change it never showed is `unconfirmed`,
/// never assumed. Runs on a blocking thread because it waits for the read-back between writes.
#[allow(clippy::too_many_arguments)]
pub(super) fn option(
    state: &Arc<ConnState>,
    raw: &str,
    request_id: String,
    session_id: String,
    provider_id: String,
    generation: u64,
    option: String,
    value: String,
) {
    if route_to_remote_host_or_fail(state, &session_id, &request_id, raw) {
        return;
    }
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let applied = apply_option(
            &state,
            &session_id,
            &provider_id,
            generation,
            &option,
            &value,
        );
        match applied {
            Ok((outcome, value)) => {
                let _ = state.out_tx.send(ServerMessage::AgentUiOptionResult {
                    request_id,
                    session_id,
                    option,
                    outcome,
                    value,
                });
            }
            Err(error) => fail(
                &state.out_tx,
                request_id,
                "native_ui_option_failed",
                error.to_string(),
                false,
            ),
        }
    });
}

/// How long the CLI gets to show a change, and how often the screen and hooks are read meanwhile.
const OPTION_READ_BACK: Duration = Duration::from_secs(8);
const OPTION_POLL: Duration = Duration::from_millis(250);

fn apply_option(
    state: &Arc<ConnState>,
    session_id: &str,
    provider_id: &str,
    generation: u64,
    option: &str,
    value: &str,
) -> anyhow::Result<(crate::protocol::OptionOutcome, Option<String>)> {
    use crate::native_ui::option_pickers as pickers;
    use crate::protocol::OptionOutcome;
    // One change at a time: a second click would type over the first one's read-back.
    static ONE_AT_A_TIME: Mutex<()> = Mutex::new(());
    let _serial = ONE_AT_A_TIME.lock().unwrap();
    anyhow::ensure!(
        provider_id == "claude",
        "This CLI has no picker for that option"
    );
    anyhow::ensure!(
        pickers::valid_choice(option, value),
        "That is not a choice this picker offers"
    );
    let Target {
        key,
        bridge: bridge_key,
        ..
    } = resolve(state, session_id, provider_id)?;
    let bridge = state
        .app
        .native_ui
        .get(&bridge_key)
        .ok_or_else(|| anyhow::anyhow!("native CLI UI is unavailable"))?;
    let lease_key = agents::lifecycle_control_key(&key, ControlChannel::Input);
    // The lease is looked up again for every write: another viewer taking input ends this change.
    type PtyWrite<'a> = &'a dyn Fn(&str) -> anyhow::Result<()>;
    let write_once = |action: &dyn Fn(PtyWrite) -> anyhow::Result<()>| -> anyhow::Result<()> {
        let lease = state
            .agent_input_leases
            .lock()
            .unwrap()
            .get(&lease_key)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Take control of this agent before changing it"))?;
        anyhow::ensure!(
            lease.generation == generation,
            "Input control changed; take control again"
        );
        state
            .app
            .agent_runtime
            .dispatch_native_control(&key, &lease, |write| action(write))
    };
    let screen = || -> anyhow::Result<String> {
        Ok(crate::daemon::client()
            .context("CLI terminal is unavailable")?
            .snapshot(&crate::shell_integration::pty_key(&bridge_key))
            .context("CLI terminal is unavailable")?
            .text)
    };
    let idle = || -> anyhow::Result<crate::protocol::NativeUiSnapshot> {
        let latest = bridge
            .latest()
            .ok_or_else(|| anyhow::anyhow!("The CLI has not reported its state yet"))?;
        anyhow::ensure!(
            !latest.blocked,
            "The CLI is waiting for you. Answer it first."
        );
        anyhow::ensure!(
            !latest.running,
            "A turn is running. Wait for it to finish before changing this."
        );
        Ok(latest)
    };
    let before = idle()?;
    let before_screen = screen()?;
    let footer = pickers::claude_footer(&before_screen);

    if option == pickers::MODE {
        if footer.mode == Some(value) {
            return Ok((OptionOutcome::Applied, Some(value.to_string())));
        }
        let start = footer.mode.ok_or_else(|| {
            anyhow::anyhow!("The permission mode is not on screen. Check CLI view.")
        })?;
        for _ in 0..pickers::CLAUDE_MODE_STEPS {
            idle()?;
            write_once(&|write| {
                // Verifies the empty prompt and that the pane is this Claude; the bytes it returns are for a
                // prompt and are not used.
                crate::native_ui::claude::prepare_input(&bridge_key, Some("x"))?;
                write(pickers::CLAUDE_MODE_STEP)
            })?;
            std::thread::sleep(OPTION_POLL);
            let shown = pickers::claude_footer(&screen()?).mode.ok_or_else(|| {
                anyhow::anyhow!("The permission mode went off screen. Check CLI view.")
            })?;
            if shown == value {
                publish_latest(state, session_id, provider_id, &bridge_key, &bridge);
                return Ok((OptionOutcome::Applied, Some(shown.to_string())));
            }
            if shown == start {
                break;
            }
        }
        publish_latest(state, session_id, provider_id, &bridge_key, &bridge);
        anyhow::bail!("This session's mode cycle does not include that mode");
    }

    if option == pickers::EFFORT && footer.effort == Some(value) {
        return Ok((OptionOutcome::Applied, Some(value.to_string())));
    }
    if option == pickers::MODEL && before.model.as_deref() == Some(value) {
        return Ok((OptionOutcome::Applied, Some(value.to_string())));
    }
    let command = pickers::claude_command(option, value)
        .ok_or_else(|| anyhow::anyhow!("That is not a choice this picker offers"))?;
    let notices_before = if option == pickers::MODEL {
        pickers::model_notices(&before_screen, value)
    } else {
        pickers::effort_notices(&before_screen, value)
    };
    write_once(&|write| {
        crate::native_ui::typed::prepare(&bridge_key, &command, bridge.latest().as_ref())?;
        let input = crate::native_ui::claude::prepare_input(&bridge_key, Some(&command))?
            .ok_or_else(|| anyhow::anyhow!("CLI prompt is unavailable"))?;
        crate::native_ui::claude::write_input(&input, write)
    })?;
    let started = std::time::Instant::now();
    let mut confirmed_by_screen = false;
    while started.elapsed() < OPTION_READ_BACK {
        std::thread::sleep(OPTION_POLL);
        let shown = screen()?;
        let reported = bridge.latest().and_then(|latest| latest.model);
        let read_back = if option == pickers::MODEL {
            // The CLI's hook names the model it now runs; its own "Set model to" line says the same.
            let hook = reported.as_deref().filter(|reported| {
                pickers::model_satisfies(reported, value)
                    && (before.model.as_deref() != Some(reported)
                        || pickers::model_notices(&shown, value) > notices_before)
            });
            confirmed_by_screen = pickers::model_notices(&shown, value) > notices_before;
            hook.map(str::to_string)
        } else {
            let footer = pickers::claude_footer(&shown).effort;
            let said = pickers::effort_notices(&shown, value) > notices_before;
            (footer == Some(value) || said).then(|| value.to_string())
        };
        if let Some(read_back) = read_back {
            publish_latest(state, session_id, provider_id, &bridge_key, &bridge);
            return Ok((OptionOutcome::Applied, Some(read_back)));
        }
    }
    publish_latest(state, session_id, provider_id, &bridge_key, &bridge);
    // The CLI said it set the model but no hook named it: still applied, as far as the screen shows.
    if confirmed_by_screen {
        return Ok((OptionOutcome::Applied, Some(value.to_string())));
    }
    Ok((OptionOutcome::Unconfirmed, None))
}

/// Send viewers a snapshot made now, so a change shows without waiting for the next hook.
fn publish_latest(
    state: &Arc<ConnState>,
    session_id: &str,
    provider_id: &str,
    bridge_key: &AgentKey,
    bridge: &crate::native_ui::NativeBridge,
) {
    if let Some(snapshot) = bridge.latest() {
        let _ = state
            .app
            .hub
            .hub_events_tx
            .send(Arc::new(ServerMessage::AgentUiSnapshot {
                request_id: None,
                session_id: session_id.to_string(),
                provider_id: provider_id.to_string(),
                snapshot: with_transcript(snapshot, bridge_key),
            }));
    }
}

/// A review is one explicit user-input operation. Git views may have no
/// terminal view (especially on mobile), so the sender borrows input for the
/// send — taking it over from another view, like any explicit action — and
/// releases it afterwards unless it already held it.
pub(super) async fn send_review(
    state: &Arc<ConnState>,
    request_id: String,
    packet: crate::db::ReviewPacketRow,
    session_id: &str,
    provider_id: &str,
) {
    let prepared = async {
        let target = resolve(state, session_id, provider_id)?;
        match target.shell {
            Some(agent) => observe_shell(&state.app, target.key, agent)?,
            None => observe(&state.app, target.key)?,
        }
        let bridge = state.app.native_ui.get(&target.bridge).ok_or_else(|| anyhow::anyhow!("Native CLI UI is unavailable"))?;
        // Readiness precedes reservation: an unavailable CLI leaves the
        // frozen packet retryable and does not consume its operation id.
        bridge.snapshot().await?;
        let _operation = state.app.agent_operation_lock.lock().unwrap();
        anyhow::ensure!(!state.out_tx.is_closed(), "Review sender disconnected");
        let Target { key, bridge: bridge_key, .. } = resolve(state, session_id, provider_id)?;
        let client = connection_client_identity(state).map_err(anyhow::Error::msg)?;
        let before = state.app.agent_runtime.snapshot(&key)?;
        let had_observer = before.observers.contains(&client.id);
        let borrowed = before.input_owner.as_ref().is_none_or(|owner| owner.client != client);
        let lease = state.app.agent_runtime.acquire_control(&key, ControlChannel::Input, client.clone(), now_millis())?;
        let result = state.app.agent_runtime.dispatch_native_control(&key, &lease, |write| {
            let operation = &packet.packet.send_operation_id;
            let text = &packet.packet.markdown;
            anyhow::ensure!(!text.trim().is_empty() && text.len() <= 64 * 1024, "Invalid review packet size");
            let digest = format!("{:x}", Sha256::digest(format!("{provider_id}\0{text}").as_bytes()));
            let (existing, _) = state.app.db.reserve_prompt_operation(operation, session_id, Some(&key.workspace_id), &digest, text, Some(provider_id), None)?;
            if existing.state == "delivered" { return Ok(None); }
            let input = crate::native_ui::claude::prepare_input(&bridge_key, Some(text))?;
            let (_, won) = state.app.db.claim_review_packet(&packet.packet.packet_id, operation, &key.workspace_id, wall_clock_millis())?
                .ok_or_else(|| anyhow::anyhow!("Review packet disappeared"))?;
            if !won { return Ok(None); }
            let claim = state.app.db.claim_prompt_operation(operation)?.ok_or_else(|| anyhow::anyhow!("Prompt operation disappeared"))?;
            anyhow::ensure!(claim.won_claim, "Review delivery is already in progress or unconfirmed; it will not be sent twice");
            session::settle_prompt_dispatch(&state.app, operation, "unconfirmed")
                .map_err(anyhow::Error::msg)?;
            state.app.agent_runtime.record_turn_boundary(&key, true)?;
            let reply = bridge.enqueue(operation, Some(text))?;
            if let Some(input) = input { crate::native_ui::claude::write_input(&input, write)?; }
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
