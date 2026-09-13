//! `terminal.*` and `agent.terminal.*` arm bodies, plus
//! `open_agent_terminal`/`release_agent_terminal` and the small helpers
//! they use. Pure move from `server.rs` — see the refactor plan's
//! Phase 3. No logic changed.
//!
//! `claude_conversation_exists_in` is pub(super): the still-resident
//! `blocked_pattern_tests` module calls it directly.
//! `lifecycle_control_key` lives in agents.rs (already pub(super) there);
//! imported by name below. `persist_agent_runtime`, `notify_session_updated`,
//! `direct_host`, and `connection_client_identity`/`now_millis` stay in
//! mod.rs/agents.rs — shared with the not-yet-extracted session domain and
//! the agent-lifecycle background task — and are reached via `super::`.

use super::*;
use agents::lifecycle_control_key;

/// Resolve the durable session and provider identity before touching a PTY.
/// Serialize first allocation across connections; a live process always keeps
/// its existing continuation identity, even if another view has stale state.
fn open_agent_terminal(
    state: &Arc<ConnState>,
    request_id: &str,
    session_id: &str,
    provider_id: &str,
    view_id: &str,
    cols: u16,
    rows: u16,
) -> anyhow::Result<()> {
    let _operation = state.app.agent_operation_lock.lock().unwrap();
    anyhow::ensure!(
        request_id == view_id && !view_id.is_empty() && view_id.len() <= 128,
        "invalid terminal view identity"
    );
    anyhow::ensure!(
        cols > 0 && rows > 0 && cols <= 1000 && rows <= 1000,
        "invalid terminal size"
    );
    anyhow::ensure!(
        state.app.hub.route_for_session(session_id).is_none(),
        "persistent agent views are not supported by this remote host"
    );
    let client = connection_client_identity(state).map_err(anyhow::Error::msg)?;
    let (registration, cwd, extra_args, resume_existing) = {
        let _guard = state.app.foundation_lock.lock().unwrap();
        let row = state
            .app
            .db
            .get_session(session_id)?
            .ok_or_else(|| anyhow::anyhow!("unknown session"))?;
        anyhow::ensure!(
            row.host_id.is_empty() || row.host_id == "local",
            "persistent agent views are not supported by this direct host"
        );
        let key = AgentKey::new(
            row.workspace_id
                .as_deref()
                .unwrap_or(&format!("session-{session_id}")),
            session_id,
            provider_id,
        )?;
        let manifest = state
            .app
            .agent_runtime
            .providers()
            .get(provider_id)
            .ok_or_else(|| anyhow::anyhow!("unknown provider {provider_id}"))?;
        let live = state.app.agent_runtime.runtime(&key);
        if live.is_none() && row.cli_provider_id.as_deref() != Some(provider_id) {
            let (_, preferences) = state.app.db.provider_preferences()?;
            anyhow::ensure!(
                preferences
                    .get(provider_id)
                    .is_none_or(|preference| preference.enabled),
                "This agent is disabled. Enable it in Agents before starting a new session."
            );
        }
        anyhow::ensure!(
            state.app.agent_terminals.runtime_identity(session_id).is_none()
                && !crate::agent_tmux::tmux_session_exists(&crate::agent_tmux::tmux_session_name(session_id)),
            "a previous CLI process is still open; close its existing view before opening this agent"
        );
        if live.is_none() {
            anyhow::ensure!(
                !state
                    .app
                    .running_sessions
                    .lock()
                    .unwrap()
                    .contains(session_id),
                "a Chat turn is still running in this session"
            );
        }
        let mut extra = Vec::new();
        let mut resume = true;
        let mut provider_session_id = live
            .as_ref()
            .and_then(|runtime| runtime.provider_session_id.clone());
        if live.is_none() {
            provider_session_id = match provider_id {
                "claude" => {
                    let id = row
                        .claude_session_id
                        .clone()
                        .unwrap_or_else(|| Uuid::new_v4().to_string());
                    state.app.db.set_claude_session_id(session_id, &id)?;
                    if let Some(runtime) = state.runtimes.lock().unwrap().get(session_id) {
                        runtime.claude_runner.resume_session(id.clone());
                    }
                    if row.claude_session_id.is_none()
                        || claude_conversation_exists(&id) == Some(false)
                    {
                        resume = false;
                        extra.extend(["--session-id".to_string(), id.clone()]);
                    }
                    Some(id)
                }
                "codex" => row.codex_thread_id.clone(),
                _ => state
                    .app
                    .agent_runtime
                    .snapshot(&key)
                    .ok()
                    .and_then(|snapshot| snapshot.provider_session_id),
            };
        }
        let model = {
            let runtimes = state.runtimes.lock().unwrap();
            runtimes
                .get(session_id)
                .and_then(|runtime| match provider_id {
                    "claude" => runtime.claude_runner.model(),
                    "codex" => runtime
                        .last_codex_runner
                        .lock()
                        .unwrap()
                        .as_ref()
                        .map(|runner| runner.model()),
                    _ => None,
                })
        }
        .or_else(|| {
            (row.last_agent.as_deref() == Some(provider_id))
                .then_some(row.last_model)
                .flatten()
        });
        if let Some(model) = model {
            extra.extend(["--model".to_string(), model]);
        }
        if crate::native_ui::supported(provider_id) {
            let fresh = live.is_none()
                && !crate::agent_tmux::tmux_session_exists(&crate::agent_tmux::tmux_session_name(
                    &crate::agent_runtime::terminal_key(&key),
                ));
            let paths = crate::native_ui::prepare(&key, provider_id, fresh)?;
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
        let registration = crate::agent_fleet::AgentRegistration {
            key: key.clone(),
            provider_id: provider_id.to_string(),
            provider_session_id,
            resumable: manifest.supports_capability(
                AgentMode::Cli,
                crate::agent_fleet::ProviderCapability::Resume,
            ),
            now_ms: now_millis(),
        };
        match state.app.agent_runtime.snapshot(&key) {
            Ok(snapshot) => {
                anyhow::ensure!(
                    snapshot.provider_id == provider_id,
                    "provider identity changed"
                );
                if live.is_none() {
                    state
                        .app
                        .agent_runtime
                        .lifecycle()
                        .set_provider_session_id(&key, registration.provider_session_id.clone())?;
                }
            }
            Err(_) => {
                state
                    .app
                    .agent_runtime
                    .lifecycle()
                    .register(registration.clone())?;
            }
        }
        state.app.db.set_cli_provider(session_id, provider_id)?;
        persist_agent_runtime(&state.app, &key)?;
        (registration, row.cwd, extra, resume)
    };
    let key = registration.key.clone();
    // Serializes opens/releases on this connection. The host spawn reservation
    // independently serializes the same process across different connections.
    let mut views = state.agent_views.lock().unwrap();
    if state
        .released_agent_views
        .lock()
        .unwrap()
        .iter()
        .any(|id| id == view_id)
    {
        return Ok(());
    }
    anyhow::ensure!(
        views.values().map(HashSet::len).sum::<usize>() < 64,
        "too many agent views"
    );
    let tx = state.out_tx.clone();
    let on_data = Arc::new(move |terminal_id, data| {
        let _ = tx.send(ServerMessage::TerminalData { terminal_id, data });
    });
    let tx = state.out_tx.clone();
    let on_exit = Arc::new(move |terminal_id, code| {
        let _ = tx.send(ServerMessage::TerminalExit { terminal_id, code });
    });
    let result = state.app.agent_runtime.attach_cli_with_ready(
        registration,
        cwd,
        client.clone(),
        cols,
        rows,
        &extra_args,
        resume_existing,
        on_data,
        on_exit,
        |handle, replay| {
            if let Ok(snapshot) = state.app.agent_runtime.snapshot(&key) {
                let _ = state.out_tx.send(ServerMessage::AgentTerminalOpened {
                    request_id: request_id.to_string(),
                    terminal_id: handle.terminal.terminal_id.clone(),
                    status: lifecycle_status_to_wire(snapshot),
                    replay: replay.to_string(),
                });
            }
        },
    );
    match result {
        Ok(_) if !state.out_tx.is_closed() => {
            if crate::native_ui::supported(provider_id) {
                if let Err(error) = native_ui::observe(&state.app, key.clone()) {
                    tracing::warn!(%error, "native UI observation unavailable; terminal remains attached");
                }
            }
            views
                .entry(key.clone())
                .or_default()
                .insert(view_id.to_string());
        }
        Ok(_) => {
            let _ = state.app.agent_runtime.detach(&key, &client);
        }
        Err(error) => return Err(error.into()),
    }
    // This protocol is gated by an explicit CLI start in the view. Keep the
    // opened session and its selected provider discoverable even before the
    // first keystroke, so a reload cannot strand a running custom provider.
    if let Err(error) = state.app.db.mark_cli_activity(session_id) {
        tracing::warn!(%error, "could not persist opened CLI session visibility");
    } else {
        state
            .app
            .cli_active_sessions
            .lock()
            .unwrap()
            .insert(session_id.to_string());
        notify_session_updated(&state.app, session_id);
    }
    if let Err(error) = persist_agent_runtime(&state.app, &key) {
        tracing::warn!(%error, "could not checkpoint opened agent; periodic checkpoint will retry");
    }
    Ok(())
}

fn release_agent_terminal(
    state: &Arc<ConnState>,
    session_id: &str,
    provider_id: &str,
    view_id: &str,
) {
    if view_id.is_empty() || view_id.len() > 128 {
        return;
    }
    let mut views = state.agent_views.lock().unwrap();
    {
        let mut released = state.released_agent_views.lock().unwrap();
        released.push_back(view_id.to_string());
        if released.len() > 128 {
            released.pop_front();
        }
    }
    let key = views
        .keys()
        .find(|key| key.session_id == session_id && key.agent_id == provider_id)
        .cloned();
    let Some(key) = key else {
        return;
    };
    let Some(ids) = views.get_mut(&key) else {
        return;
    };
    if !ids.remove(view_id) || !ids.is_empty() {
        return;
    }
    views.remove(&key);
    if let Ok(client) = connection_client_identity(state) {
        let _ = state.app.agent_runtime.detach(&key, &client);
    }
    state
        .agent_input_leases
        .lock()
        .unwrap()
        .remove(&lifecycle_control_key(&key, ControlChannel::Input));
    state
        .agent_resize_leases
        .lock()
        .unwrap()
        .remove(&lifecycle_control_key(&key, ControlChannel::Resize));
}

/// Feed one CLI keystroke payload into this session's first-prompt
/// reconstruction, and persist the result as the session title once the user
/// submits a line. See `cli_title.rs` for what "reconstruction" means and
/// `db.rs::set_cli_title` for the write-once rule.
///
/// The `Option<CliTitleBuffer>` slot encodes three states in one map lookup,
/// which is what keeps this cheap on the per-keystroke hot path:
///   - vacant: first keystroke this process lifetime; consult the DB once.
///   - `Some`: actively buffering an untitled session.
///   - `None`: settled (already titled, or we just titled it) — every later
///     keystroke returns immediately.
fn maybe_capture_cli_title(app: &AppState, session_id: &str, data: &str) {
    let submitted = {
        let mut buffers = app.cli_title_buffers.lock().unwrap();
        let slot = match buffers.entry(session_id.to_string()) {
            Entry::Occupied(occupied) => occupied.into_mut(),
            Entry::Vacant(vacant) => {
                // Seeding from the DB (not just from "have we seen this
                // session yet") is what makes a perch restart mid-session
                // safe: the buffer map is empty after a restart, and without
                // this check the session's *next* prompt would look like its
                // first. It also keeps us off sessions that already have a
                // title from Hosted mode or a user rename.
                let already_titled = match app.db.get_session_row(session_id) {
                    Ok(Some(row)) => !row.title.trim().is_empty(),
                    // No row (or a DB error): stay out of the way rather than
                    // risk titling something we can't see.
                    Ok(None) => true,
                    Err(err) => {
                        tracing::warn!(%session_id, %err, "cli title: session lookup failed");
                        true
                    }
                };
                vacant.insert(if already_titled {
                    None
                } else {
                    Some(CliTitleBuffer::new())
                })
            }
        };
        match slot {
            None => return,
            Some(buffer) => buffer.feed(data),
        }
    };

    let Some(title) = submitted else { return };
    match app.db.set_cli_title(session_id, &title) {
        Ok(wrote) => {
            // Settle the slot either way: `Ok(false)` means another writer
            // beat us to it, which is just as final as writing it ourselves.
            app.cli_title_buffers
                .lock()
                .unwrap()
                .insert(session_id.to_string(), None);
            if wrote {
                notify_session_updated(app, session_id);
            }
        }
        // Leave the buffer in place so the next submitted line retries.
        Err(err) => tracing::warn!(%session_id, %err, "failed to set cli_title"),
    }
}

/// Model alias to pass on a claude CLI attach, from the session's last
/// completed turn — only meaningful when that turn *was* claude (aliases are
/// per-agent). Without it claude falls back to the dated snapshot id in its
/// transcript, which the GenAI proxy rejects.
fn claude_model_of(row: &crate::db::SessionRow) -> Option<String> {
    if row.last_agent.as_deref() == Some("claude") {
        row.last_model.clone()
    } else {
        None
    }
}

/// Codex counterpart of [`claude_model_of`].
fn codex_model_of(row: &crate::db::SessionRow) -> Option<String> {
    if row.last_agent.as_deref() == Some("codex") {
        row.last_model.clone()
    } else {
        None
    }
}

/// Does the claude CLI actually have a conversation for `session_id`?
///
/// perch mints the claude session id *optimistically* — the id is recorded on
/// the runtime (and in the DB) when CLI mode first attaches, but claude only
/// writes the transcript once the conversation has a first message. A session
/// whose CLI was opened and closed again (`/exit` before typing anything)
/// therefore has a known id and **no** conversation, and `claude --resume
/// <id>` on the next attach dies instantly with "No conversation found with
/// session ID" — a dead pane the user cannot get out of. Passing
/// `--session-id <id>` instead creates the conversation under the *same* id,
/// so hosted and CLI mode still share one conversation either way.
///
/// The probe deliberately searches every `~/.claude/projects/*/` dir for
/// `<session_id>.jsonl` rather than re-deriving claude's cwd→directory slug,
/// so it cannot be broken by that (undocumented) naming scheme. `None` means
/// "can't tell" (no `~/.claude/projects` at all) — callers keep the
/// conservative `--resume` behaviour in that case.
fn claude_conversation_exists(session_id: &str) -> Option<bool> {
    let home = std::env::var("HOME").ok()?;
    claude_conversation_exists_in(
        &Path::new(&home).join(".claude").join("projects"),
        session_id,
    )
}

pub(super) fn claude_conversation_exists_in(projects: &Path, session_id: &str) -> Option<bool> {
    let file = format!("{session_id}.jsonl");
    let entries = std::fs::read_dir(projects).ok()?;
    for entry in entries.flatten() {
        if entry.path().join(&file).exists() {
            return Some(true);
        }
    }
    Some(false)
}

pub(super) fn handle_terminal_open(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    pane_id: String,
    view_id: String,
    cols: u16,
    rows: u16,
) {
    // Persistent shell forwarding needs a multicast subscription on the
    // hub. Until then, reject remote ownership instead of opening locally.
    if state.app.hub.route_for_session(&session_id).is_some() {
        fail(
            &state.out_tx,
            request_id,
            "terminal_remote_unsupported",
            "Persistent shells on this remote host are not available yet",
            false,
        );
        return;
    }
    if view_id.is_empty() || view_id.len() > 128 || view_id.contains(':') {
        fail(
            &state.out_tx,
            request_id,
            "terminal_invalid_view",
            "Invalid terminal view",
            false,
        );
        return;
    }
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let data_tx = state.out_tx.clone();
        let exit_tx = state.out_tx.clone();
        let viewer = format!("{}:{view_id}", state.conn_id);
        let result = state.app.workspace_terminals.open(
            &session_id,
            &pane_id,
            &viewer,
            cols,
            rows,
            state.app.settings.get().terminal_login_shell,
            Arc::new(move |terminal_id, data| {
                let _ = data_tx.send(ServerMessage::TerminalData { terminal_id, data });
            }),
            Arc::new(move |terminal_id, code| {
                let _ = exit_tx.send(ServerMessage::TerminalExit { terminal_id, code });
            }),
            |terminal, replay| {
                let _ = state.out_tx.send(ServerMessage::TerminalOpened {
                    request_id: request_id.clone(),
                    terminal: terminal.clone(),
                    replay,
                });
            },
        );
        if let Err(error) = result {
            fail(
                &state.out_tx,
                request_id,
                "terminal_open_failed",
                error.to_string(),
                false,
            );
        }
        if state.out_tx.is_closed() {
            state
                .app
                .workspace_terminals
                .release_connection(&state.conn_id);
        }
    });
}

pub(super) fn handle_terminal_list(state: &Arc<ConnState>, request_id: String, session_id: String) {
    let result = state.app.workspace_terminals.list(&session_id);
    let message = match result {
        Ok(terminals) => ServerMessage::TerminalListResult {
            request_id,
            session_id,
            terminals,
        },
        Err(error) => request_error(
            Some(request_id),
            Some("terminal_list_failed".into()),
            error.to_string(),
            true,
        ),
    };
    let _ = state.out_tx.send(message);
}

pub(super) fn handle_terminal_release(
    state: &Arc<ConnState>,
    terminal_id: String,
    view_id: String,
) {
    state
        .app
        .workspace_terminals
        .release(&terminal_id, &format!("{}:{view_id}", state.conn_id));
}

pub(super) fn handle_terminal_close(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    terminal_id: String,
) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let message = match state
            .app
            .workspace_terminals
            .close(&session_id, &terminal_id)
        {
            Ok(()) => ServerMessage::TerminalClosed {
                request_id,
                session_id,
                terminal_id,
            },
            Err(error) => request_error(
                Some(request_id),
                Some("terminal_close_failed".into()),
                error.to_string(),
                false,
            ),
        };
        let _ = state.out_tx.send(message);
    });
}

#[allow(clippy::too_many_arguments)]
pub(super) fn handle_agent_terminal_open(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    provider_id: String,
    view_id: String,
    cols: u16,
    rows: u16,
) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        if let Err(error) = open_agent_terminal(
            &state,
            &request_id,
            &session_id,
            &provider_id,
            &view_id,
            cols,
            rows,
        ) {
            fail(
                &state.out_tx,
                request_id,
                "agent_terminal_open_failed",
                error.to_string(),
                true,
            );
        }
    });
}

pub(super) fn handle_agent_terminal_release(
    state: &Arc<ConnState>,
    session_id: String,
    provider_id: String,
    view_id: String,
) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        release_agent_terminal(&state, &session_id, &provider_id, &view_id)
    });
}

pub(super) fn handle_terminal_create(
    state: &Arc<ConnState>,
    raw_text: &str,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    agent_attach: &Option<crate::protocol::AgentAttach>,
) {
    // If this terminal is an agentAttach for a remote session, forward.
    if let Some(attach) = agent_attach {
        if let Some(host_id) = state.app.hub.route_for_session(&attach.session_id) {
            // Register a Terminal unicast using the session_id as a
            // placeholder key.  The hub swaps it to Terminal(terminal_id)
            // when terminal.created arrives from the remote.
            state.app.hub.register_unicast(
                PendingKey::Terminal(attach.session_id.clone()),
                state.conn_id.clone(),
                state.out_tx.clone(),
            );
            state.app.hub.forward(&host_id, raw_text);
            return;
        }
    }

    let agent_attach = agent_attach.clone();
    let Some(attach) = agent_attach else {
        let cwd = Some(cwd.unwrap_or_else(|| state.app.default_cwd.clone()));
        // Read the flag per-create rather than caching it: settings
        // are live-editable, and the next pane the user opens should
        // honour what the toggle says now.
        let login_shell = state.app.settings.get().terminal_login_shell;
        match state.terminals.create(cols, rows, cwd, None, login_shell) {
            Ok(terminal_id) => {
                let _ = state
                    .out_tx
                    .send(ServerMessage::TerminalCreated { terminal_id });
            }
            Err(err) => {
                let _ = state.out_tx.send(ServerMessage::Error {
                    message: format!("failed to create terminal: {err}"),
                    request_id: None,
                    code: None,
                    retryable: false,
                });
            }
        }
        return;
    };

    let runtime_cwd = {
        let map = state.runtimes.lock().unwrap();
        let Some(runtime) = map.get(&attach.session_id) else {
            drop(map);
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("unknown session {}", attach.session_id),
                request_id: None,
                code: None,
                retryable: false,
            });
            return;
        };
        runtime.cwd.clone()
    };

    // Direct-mode host (CLI mode over ssh): the local pty's child is
    // `ssh -tt <host> tmux new-session -A …` rather than the CLI
    // itself. tmux keeps the TUI (and its scrollback) alive across a
    // dropped connection, and `terminal.resize` still works because
    // ssh propagates SIGWINCH from the local pty.
    let runtime_host = {
        let map = state.runtimes.lock().unwrap();
        map.get(&attach.session_id)
            .map(|r| r.host_id.clone())
            .unwrap_or_default()
    };
    if runtime_host != "local" && !runtime_host.is_empty() {
        let Some(host) = direct_host(state, &runtime_host) else {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("host {runtime_host} is no longer configured"),
                request_id: None,
                code: None,
                retryable: false,
            });
            return;
        };
        let row = state.app.db.get_session(&attach.session_id).ok().flatten();
        let (provider_id, model) = match attach.agent {
            AgentKind::Claude => {
                // Mint the claude session id up front when the session
                // has never run a turn, so CLI mode and a later hosted
                // turn share one conversation.
                let id = row.as_ref().and_then(|r| r.claude_session_id.clone());
                let id = match id {
                    Some(id) => id,
                    None => {
                        let fresh = Uuid::new_v4().to_string();
                        let _ = state.app.db.create_session_on_host(
                            &attach.session_id,
                            &runtime_cwd,
                            &runtime_host,
                        );
                        let _ = state
                            .app
                            .db
                            .set_claude_session_id(&attach.session_id, &fresh);
                        fresh
                    }
                };
                (Some(id), row.as_ref().and_then(claude_model_of))
            }
            AgentKind::Codex => (
                row.as_ref().and_then(|r| r.codex_thread_id.clone()),
                row.as_ref().and_then(codex_model_of),
            ),
        };
        let argv = crate::detached::cli_attach_argv(
            &host.ssh_host,
            &attach.session_id,
            &runtime_cwd,
            attach.agent,
            provider_id.as_deref(),
            model.as_deref(),
        );
        // cwd is `None`: the *local* pty just runs ssh, and the remote
        // cd happens inside the tmux command.
        match state.terminals.create(cols, rows, None, Some(argv), false) {
            Ok(terminal_id) => {
                let _ = state.app.db.create_session_on_host(
                    &attach.session_id,
                    &runtime_cwd,
                    &runtime_host,
                );
                state
                    .terminal_agent_sessions
                    .lock()
                    .unwrap()
                    .insert(terminal_id.clone(), attach.session_id.clone());
                let _ = state
                    .out_tx
                    .send(ServerMessage::TerminalCreated { terminal_id });
            }
            Err(err) => {
                let _ = state.out_tx.send(ServerMessage::Error {
                    message: format!("failed to create terminal: {err}"),
                    request_id: None,
                    code: None,
                    retryable: false,
                });
            }
        }
        return;
    }

    let _agent_operation = state.app.agent_operation_lock.lock().unwrap();
    if state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .iter()
        .any(|snapshot| {
            snapshot.key.session_id == attach.session_id
                && state.app.agent_runtime.runtime_alive(&snapshot.key)
        })
    {
        fail(
            &state.out_tx,
            None,
            "agent_runtime_already_open",
            "This session has a persistent CLI; reload this client to attach to it".to_string(),
            false,
        );
        return;
    }
    let argv = match attach.agent {
        AgentKind::Claude => {
            let (claude_session_id, claude_model) = {
                let map = state.runtimes.lock().unwrap();
                map.get(&attach.session_id)
                    .map(|r| (r.claude_runner.claude_session_id(), r.claude_runner.model()))
                    .unwrap_or((None, None))
            };
            let mut argv = vec!["claude".to_string()];
            match claude_session_id {
                // Known id *and* claude has (or might have) the
                // conversation on disk → resume it.
                Some(id) if claude_conversation_exists(&id) != Some(false) => {
                    argv.push("--resume".to_string());
                    argv.push(id);
                }
                // Known id but claude never created the conversation
                // (CLI opened and closed without a single message).
                // `--resume` would fail instantly; create it under the
                // same id so hosted/CLI continuity is preserved.
                Some(id) => {
                    argv.push("--session-id".to_string());
                    argv.push(id);
                }
                None => {
                    let id = Uuid::new_v4().to_string();
                    {
                        let map = state.runtimes.lock().unwrap();
                        if let Some(runtime) = map.get(&attach.session_id) {
                            runtime.claude_runner.resume_session(id.clone());
                        }
                    }
                    // The sessions row is normally inserted lazily
                    // further down (once the pty actually spawned),
                    // but `set_claude_session_id` is an UPDATE — on a
                    // session whose first activity is this CLI attach
                    // there is no row yet, so it would silently affect
                    // 0 rows and the claude session id would never be
                    // persisted (CLI-mode context lost on reconnect /
                    // restart). Insert first, exactly like the
                    // direct-mode branch above does.
                    let _ = state
                        .app
                        .db
                        .create_session(&attach.session_id, &runtime_cwd);
                    let _ = state.app.db.set_claude_session_id(&attach.session_id, &id);
                    argv.push("--session-id".to_string());
                    argv.push(id);
                }
            }
            // Without an explicit --model, claude falls back to the
            // dated snapshot id recorded in the transcript (e.g.
            // claude-haiku-4-5-20251001), which the GenAI proxy
            // rejects — only the bare alias works. Match whatever
            // Hosted mode last used, same as every headless turn does.
            if let Some(model) = claude_model {
                argv.push("--model".to_string());
                argv.push(model);
            }
            argv
        }
        AgentKind::Codex => {
            let codex_thread_id = state
                .app
                .db
                .get_session(&attach.session_id)
                .ok()
                .flatten()
                .and_then(|row| row.codex_thread_id);
            match codex_thread_id {
                Some(id) => {
                    // Prefer the in-memory runner's model (most accurate
                    // for the current process lifetime). Fall back to the
                    // DB's last_model for the case where the server was
                    // restarted and last_codex_runner is None.
                    let codex_model = {
                        let map = state.runtimes.lock().unwrap();
                        map.get(&attach.session_id).and_then(|r| {
                            r.last_codex_runner
                                .lock()
                                .unwrap()
                                .as_ref()
                                .map(|r| r.model())
                        })
                    };
                    let codex_model = codex_model.or_else(|| {
                        state
                            .app
                            .db
                            .get_session(&attach.session_id)
                            .ok()
                            .flatten()
                            .and_then(|row| {
                                // Only use last_model when the last agent was codex.
                                if row.last_agent.as_deref() == Some("codex") {
                                    row.last_model
                                } else {
                                    None
                                }
                            })
                    });
                    let mut argv = vec!["codex".to_string(), "resume".to_string(), id];
                    if let Some(model) = codex_model {
                        argv.push("-m".to_string());
                        argv.push(model);
                    }
                    argv
                }
                None => vec!["codex".to_string()],
            }
        }
    };

    // Task 1: an agent-attached terminal is a per-session singleton,
    // not a per-connection one — a second attach (another tab,
    // another device) must share the one live `claude --resume` /
    // `codex resume` process rather than spawning a second one
    // against the same on-disk conversation (which corrupts it).
    // `AgentTerminalRegistry::attach` lives on `AppState`, so it's the
    // same registry no matter which connection asks.
    match state.app.agent_terminals.attach(
        &attach.session_id,
        &state.conn_id,
        cols,
        rows,
        Some(runtime_cwd.clone()),
        argv,
        state.agent_on_data.clone(),
        state.agent_on_exit.clone(),
    ) {
        Ok(AttachOutcome::Created(terminal_id)) | Ok(AttachOutcome::Reused(terminal_id)) => {
            // Fix 3: lazily insert the sessions row on first terminal activity
            // (same as on first chat.send). INSERT OR IGNORE is a no-op if the
            // row already exists.
            let _ = state
                .app
                .db
                .create_session(&attach.session_id, &runtime_cwd);
            // Phase 6: remember this is a CLI-attached (agentAttach)
            // terminal so the on_data/on_exit closures and
            // TerminalInput below can do blocked-state bookkeeping.
            // Every viewer connection gets its own entry here (this
            // map is per-connection), whether it created the terminal
            // or reused it.
            state
                .terminal_agent_sessions
                .lock()
                .unwrap()
                .insert(terminal_id.clone(), attach.session_id.clone());
            let _ = state
                .out_tx
                .send(ServerMessage::TerminalCreated { terminal_id });
        }
        Err(err) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("failed to create terminal: {err}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

pub(super) fn handle_terminal_input(
    state: &Arc<ConnState>,
    raw_text: &str,
    terminal_id: String,
    data: String,
    generation: Option<u64>,
) {
    // Route remote terminals through the hub.
    if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    if let Some(key) = state.app.agent_runtime.key_for_terminal(&terminal_id) {
        let lease = state
            .agent_input_leases
            .lock()
            .unwrap()
            .get(&lifecycle_control_key(&key, ControlChannel::Input))
            .cloned();
        if let Some(lease) = lease.filter(|lease| Some(lease.generation) == generation) {
            if state
                .app
                .agent_runtime
                .input(
                    &key,
                    &lease,
                    &data,
                    now_millis(),
                    std::time::Duration::from_secs(2),
                )
                .is_ok()
            {
                if state
                    .app
                    .cli_active_sessions
                    .lock()
                    .unwrap()
                    .insert(key.session_id.clone())
                {
                    if let Err(error) = state.app.db.mark_cli_activity(&key.session_id) {
                        state
                            .app
                            .cli_active_sessions
                            .lock()
                            .unwrap()
                            .remove(&key.session_id);
                        tracing::warn!(%error, "could not mark CLI activity");
                    } else {
                        notify_session_updated(&state.app, &key.session_id);
                    }
                }
                maybe_capture_cli_title(&state.app, &key.session_id, &data);
            }
        } else {
            fail(
                &state.out_tx,
                None,
                "agent_control_required",
                "Take control of this agent before typing".to_string(),
                false,
            );
        }
        return;
    }
    if state.app.workspace_terminals.contains(&terminal_id) {
        let _ = state
            .app
            .workspace_terminals
            .input(&terminal_id, &state.conn_id, &data);
        return;
    }
    // Phase 6: user input to a CLI-attached terminal is treated as an
    // answer to whatever prompt it was showing — clear blocked state
    // (if set) so the dot flips back before the next poll/output.
    if let Some(session_id) = state
        .terminal_agent_sessions
        .lock()
        .unwrap()
        .get(&terminal_id)
        .cloned()
    {
        let was_blocked = state
            .app
            .blocked_sessions
            .lock()
            .unwrap()
            .remove(&session_id);
        if was_blocked {
            notify_session_updated(&state.app, &session_id);
        }
        // First keystroke into an agent-attached CLI terminal makes
        // its session nav-visible (mirrors Hosted mode's
        // first-user-message rule) — see the `cli_activity` column's
        // migration comment in db.rs for why this can't be done on
        // terminal *attach* instead. Deduped via `cli_active_sessions`
        // so the per-keystroke hot path only pays for the DB write +
        // broadcast once per session.
        let newly_active = state
            .app
            .cli_active_sessions
            .lock()
            .unwrap()
            .insert(session_id.clone());
        if newly_active {
            if let Err(err) = state.app.db.mark_cli_activity(&session_id) {
                tracing::warn!(%session_id, %err, "failed to mark_cli_activity");
            }
            notify_session_updated(&state.app, &session_id);
        }

        // Reconstruct this session's first submitted prompt from the
        // keystrokes and use it as the nav title (CLI mode's stand-in
        // for Hosted mode's first-user-message title — see
        // `cli_title.rs` and `db.rs::set_cli_title`).
        //
        // Gated on the session having no title yet so an established
        // session's keystrokes cost one map lookup and nothing else:
        // `set_cli_title` refuses to overwrite, and we drop the buffer
        // as soon as it succeeds.
        maybe_capture_cli_title(&state.app, &session_id, &data);
    }
    // Task 1: a shared local agent terminal lives in the app-wide
    // registry, not this connection's own `TerminalManager` — route
    // there instead. A plain shell or a direct-mode (ssh/tmux)
    // terminal isn't registered there at all, so this correctly
    // falls through to the per-connection manager for those. Any
    // viewer may send input (shared-terminal semantics, like `tmux
    // attach` — see `AgentTerminalRegistry::input`'s doc comment).
    if let Some(session_id) = state.app.agent_terminals.session_for_terminal(&terminal_id) {
        state.app.agent_terminals.input(&session_id, &data);
    } else {
        state.terminals.input(&terminal_id, &data);
    }
}

pub(super) fn handle_terminal_resize(
    state: &Arc<ConnState>,
    raw_text: &str,
    terminal_id: String,
    cols: u16,
    rows: u16,
    generation: Option<u64>,
) {
    // Route remote terminals through the hub.
    if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    if let Some(key) = state.app.agent_runtime.key_for_terminal(&terminal_id) {
        let lease = state
            .agent_resize_leases
            .lock()
            .unwrap()
            .get(&lifecycle_control_key(&key, ControlChannel::Resize))
            .cloned();
        if let Some(lease) = lease.filter(|lease| Some(lease.generation) == generation) {
            let _ = state
                .app
                .agent_runtime
                .resize(&key, &lease, cols, rows, now_millis());
        }
        return;
    }
    if state.app.workspace_terminals.contains(&terminal_id) {
        let _ = state
            .app
            .workspace_terminals
            .resize(&terminal_id, &state.conn_id, cols, rows);
        return;
    }
    if let Some(session_id) = state.app.agent_terminals.session_for_terminal(&terminal_id) {
        state.app.agent_terminals.resize(&session_id, cols, rows);
    } else {
        state.terminals.resize(&terminal_id, cols, rows);
    }
}

pub(super) fn handle_terminal_kill(state: &Arc<ConnState>, raw_text: &str, terminal_id: String) {
    // Route remote terminals through the hub.
    if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    if let Some(key) = state.app.agent_runtime.key_for_terminal(&terminal_id) {
        let lease = state
            .agent_input_leases
            .lock()
            .unwrap()
            .get(&lifecycle_control_key(&key, ControlChannel::Input))
            .cloned();
        if let Some(lease) = lease {
            let _ = state.app.agent_runtime.stop(&key, &lease, now_millis());
        }
        return;
    }
    // Best-effort: clear any blocked-state bookkeeping tied to this
    // terminal up front. `on_exit` (fired once the killed process
    // actually dies) does this too, but doing it here as well means a
    // fast follow-up session.delete doesn't race a still-in-flight
    // kill.
    if let Some(session_id) = state
        .terminal_agent_sessions
        .lock()
        .unwrap()
        .remove(&terminal_id)
    {
        let was_blocked = state
            .app
            .blocked_sessions
            .lock()
            .unwrap()
            .remove(&session_id);
        if was_blocked {
            notify_session_updated(&state.app, &session_id);
        }
    }
    // An explicit kill (e.g. "Restart CLI") means kill it for
    // *everyone* sharing this terminal, not just detach the caller —
    // see `AgentTerminalRegistry::kill`'s doc comment.
    if let Some(session_id) = state.app.agent_terminals.session_for_terminal(&terminal_id) {
        state.app.agent_terminals.kill(&session_id);
    } else {
        state.terminals.kill(&terminal_id);
    }
}
