//! `session.*`/`commands.*` arm bodies and the session bookkeeping they share
//! (prompt dispatch settlement, runtime cwd/host, viewer and unseen tracking).
//! There is no Perch-run turn loop: an agent is always the real CLI, driven
//! through its terminal or native UI bridge.
//!
//! `SessionRuntime` stays in mod.rs: `ConnState` holds the map and terminal.rs
//! reads `.cwd`/`.host_id` directly.

use super::*;

/// Resolve the session and provider named by a review packet. A missing
/// provider is an error instead of silently selecting Claude, because a
/// packet sent to the wrong CLI cannot be recovered by retrying it.
pub(super) fn resolve_review_target(
    app: &AppState,
    workspace_id: &str,
    target_session_id: Option<&str>,
    target_agent_id: Option<&str>,
) -> Result<(String, String), String> {
    let session_id = target_session_id
        .filter(|session_id| !session_id.trim().is_empty())
        .ok_or_else(|| "a target session is required to send review notes".to_string())?;
    let session = app
        .db
        .get_session(session_id)
        .map_err(|error| format!("could not read target session: {error}"))?
        .ok_or_else(|| "target session was not found".to_string())?;
    if session.workspace_id.as_deref() != Some(workspace_id) {
        return Err("target session does not belong to this workspace".to_string());
    }
    let provider = review_provider_choice(
        target_agent_id,
        session.cli_provider_id.as_deref(),
        session.last_agent.as_deref(),
    )?;
    if session.cli_provider_id.is_some() && !crate::native_ui::supported(provider) {
        return Err(format!("{provider}'s native review connection is not available yet. Use its CLI to send these notes."));
    }
    if !matches!(provider, "claude" | "codex") && !crate::native_ui::supported(provider) {
        return Err(format!(
            "{provider} does not yet expose native review controls"
        ));
    }
    Ok((session_id.to_string(), provider.to_string()))
}

fn review_provider_choice<'a>(
    requested: Option<&'a str>,
    cli: Option<&'a str>,
    last: Option<&'a str>,
) -> Result<&'a str, String> {
    if let (Some(requested), Some(owner)) = (requested, cli) {
        if requested != owner {
            return Err(format!(
                "This session is owned by {owner}; choose its session to send review notes."
            ));
        }
    }
    requested.or(cli).or(last).ok_or_else(|| {
        "choose a target provider before sending review notes to a new session".to_string()
    })
}

/// Produce a stable aggregate for the exact source selected for each comment.
/// The comment id and target are included so two different source selections
/// cannot collapse to the same review snapshot by accident.
pub(super) fn review_snapshot_revision(
    mut entries: Vec<(String, String, String, String, String)>,
) -> String {
    entries.sort();
    let encoded = serde_json::to_vec(&entries).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Move `state`'s connection to viewing `session_id`: remove it from
/// whichever session it was previously viewing (if different), add it to the
/// new session's viewer set, and clear `unseen_sessions` for the newly-viewed
/// session — a connection actively viewing a session has, by definition,
/// "seen" it. Broadcasts `session.updated` when that clears a real unseen
/// flag so all clients repaint the dot immediately (a no-op broadcast is
/// avoided when there was nothing to clear, e.g. a brand-new blank session).
fn set_active_session(state: &Arc<ConnState>, session_id: &str) {
    let previous = {
        let mut active = state.active_session_id.lock().unwrap();
        let previous = active.clone();
        *active = Some(session_id.to_string());
        previous
    };
    {
        let mut viewers = state.app.session_viewers.lock().unwrap();
        if let Some(prev_id) = previous.as_deref() {
            if prev_id != session_id {
                if let Some(set) = viewers.get_mut(prev_id) {
                    set.remove(&state.conn_id);
                    if set.is_empty() {
                        viewers.remove(prev_id);
                    }
                }
            }
        }
        viewers
            .entry(session_id.to_string())
            .or_default()
            .insert(state.conn_id.clone());
    }
    let was_unseen = state.app.unseen_sessions.lock().unwrap().remove(session_id);
    if was_unseen {
        notify_session_updated(&state.app, session_id);
    }
    super::attention::viewed_session(&state.app, session_id);
}

/// Register the session's cwd and host as this connection's runtime for it.
pub(super) fn insert_runtime(state: &Arc<ConnState>, session_id: &str, cwd: &str) {
    insert_runtime_on_host(state, session_id, cwd, "local");
}

fn insert_runtime_on_host(state: &Arc<ConnState>, session_id: &str, cwd: &str, host_id: &str) {
    state.runtimes.lock().unwrap().insert(
        session_id.to_string(),
        SessionRuntime {
            cwd: cwd.to_string(),
            host_id: host_id.to_string(),
        },
    );
}

/// Create a session that lives in *this* DB but runs on a direct host.
///
/// Deliberately does **not** validate the cwd: doing so would cost an ssh
/// round trip on the message loop for every new session, and the cwd is
/// already chosen from the remote directory browser (`fs.browse` over ssh).
/// A bad path fails on the first turn with the remote shell's own message.
fn create_direct_session(
    state: &Arc<ConnState>,
    host: &crate::hosts::SshHost,
    cwd: Option<String>,
) {
    let Some(cwd) = cwd.filter(|c| !c.trim().is_empty()) else {
        let _ = state.out_tx.send(ServerMessage::Error {
            message: format!("pick a directory on {} to start a session there", host.name),
            request_id: None,
            code: None,
            retryable: false,
        });
        return;
    };
    let session_id = Uuid::new_v4().to_string();
    insert_runtime_on_host(state, &session_id, &cwd, &host.id);
    set_active_session(state, &session_id);
    let _ = state.out_tx.send(ServerMessage::SessionCreated {
        session_id: session_id.clone(),
    });
}

/// Settle a prompt dispatch and, when the operation belongs to a review
/// packet, settle the packet from that same durable outcome. The packet state
/// is never inferred from a socket call returning; it follows the persisted
/// prompt operation instead.
pub(super) fn settle_prompt_dispatch(
    app: &AppState,
    operation_id: &str,
    state: &str,
) -> Result<(), String> {
    app.db
        .settle_prompt_dispatch(operation_id, state, wall_clock_millis())
        .map_err(|error| error.to_string())?;
    if let Some(row) = app
        .db
        .get_review_packet_for_operation(operation_id)
        .map_err(|error| error.to_string())?
    {
        let _ = app
            .hub
            .hub_events_tx
            .send(Arc::new(ServerMessage::ReviewBatchDelivery {
                workspace_id: row.packet.workspace_id,
                packet_id: row.packet.packet_id,
                send_operation_id: row.packet.send_operation_id,
                delivery: row.state,
                host_id: Some("local".to_string()),
                target_session_id: row.packet.target_session_id,
                target_agent_id: row.packet.target_agent_id,
            }));
    }
    Ok(())
}

pub(super) fn local_sessions_snapshot(app: &AppState) -> Vec<SessionSummary> {
    let rows = app.db.list_sessions().unwrap_or_default();
    let running = app.running_sessions.lock().unwrap();
    let unseen = app.unseen_sessions.lock().unwrap();
    let blocked = app.blocked_sessions.lock().unwrap();
    let stale = app.stale_sessions.lock().unwrap();
    rows.into_iter()
        .map(|row| {
            build_session_summary(row, &running, &unseen, &blocked, &stale, &app.agent_runtime)
        })
        .collect()
}

/// Build a `SessionSummary` from a DB row and the current running/unseen/
/// blocked snapshots. `unseen`/`blocked` are only meaningful for local
/// sessions — remote summaries are built elsewhere (`hub.rs`) and always
/// report `false` unless the remote itself set them.
pub(super) fn build_session_summary(
    row: crate::db::SessionListRow,
    running: &std::collections::HashSet<String>,
    unseen: &std::collections::HashSet<String>,
    blocked: &std::collections::HashSet<String>,
    stale: &std::collections::HashSet<String>,
    runtime: &crate::agent_runtime::AgentRuntimeAdapter,
) -> SessionSummary {
    let status = if running.contains(&row.id) {
        SessionStatus::Running
    } else {
        SessionStatus::Idle
    };
    SessionSummary {
        current_provider_id: runtime.current_provider(&row.id),
        chat_provider_id: runtime.shell_chat_provider(&row.id),
        current_cwd: runtime.current_cwd(&row.id),
        current_branch: runtime
            .current_cwd(&row.id)
            .map(|cwd| crate::status::get_branch(&cwd))
            .filter(|branch| !branch.is_empty()),
        id: row.id.clone(),
        title: row.title,
        cwd: row.cwd,
        created_at: row.created_at,
        status,
        // Local *storage*, but not necessarily the local *host*: a direct-mode
        // session's row lives here while its cwd and agent live on a remote
        // with no perch of its own, and the sidebar must group it under that
        // host (see `db.rs`'s `sessions.host_id`).
        host_id: row.host_id,
        cli_started: row.cli_started,
        cli_provider_id: row.cli_provider_id,
        unseen: unseen.contains(&row.id),
        blocked: blocked.contains(&row.id),
        stale: stale.contains(&row.id),
        project_id: row.project_id,
        workspace_id: row.workspace_id,
    }
}

// The attention (reader) policy, in one place, after Orca's
// `agent-attention-policy.ts` and `agent-status-freshness.ts`:
// - Unread (`unseen`): a turn settles (done, idle, exit, error) while no
//   connection views the session (`mark_unseen_if_unviewed`). Any connection
//   viewing it clears it (`set_active_session`). Blocked is not unread: it
//   stays lit until answered.
// - Decay (`stale`): running or blocked with no status evidence for 30
//   minutes reads as idle. Evidence is lifecycle activity or a transition:
//   native snapshots, title changes, provider output. Display only, never a
//   completion, so no unread and no notification, and a later real
//   completion still fires. Orca splits the decayed state into idle and
//   "unverifiable" (PTY still alive); perch shows both as idle.
pub(super) const STATUS_STALE_AFTER_MS: u64 = 30 * 60 * 1000;

/// Sessions shown running or blocked whose every busy agent has been silent
/// for [`STATUS_STALE_AFTER_MS`].
pub(super) fn stale_sessions(
    snapshots: &[crate::agent_fleet::AgentSnapshot],
    shown_busy: impl Fn(&str) -> bool,
    now_ms: u64,
) -> std::collections::HashSet<String> {
    use crate::agent_fleet::AgentState;
    let (mut stale, mut fresh) = (
        std::collections::HashSet::new(),
        std::collections::HashSet::new(),
    );
    for snapshot in snapshots
        .iter()
        .filter(|snapshot| matches!(snapshot.state, AgentState::Working | AgentState::Blocked))
    {
        let evidence = snapshot.last_activity_ms.max(snapshot.last_transition_ms);
        if now_ms.saturating_sub(evidence) >= STATUS_STALE_AFTER_MS {
            stale.insert(snapshot.key.session_id.clone());
        } else {
            fresh.insert(snapshot.key.session_id.clone());
        }
    }
    stale.retain(|id| !fresh.contains(id) && shown_busy(id));
    stale
}

/// Called when a turn finishes (`chat.done` or a terminal error) and
/// `session_id` is removed from `running_sessions`. If no connection is
/// currently viewing the session, mark it unseen (herdr's `done` state) so
/// `build_session_summary` reports it on the next broadcast. Callers already
/// broadcast `session.updated` right after removing from `running_sessions`,
/// so this doesn't need to trigger its own notify.
pub(super) fn mark_unseen_if_unviewed(app: &AppState, session_id: &str) {
    let has_viewer = app
        .session_viewers
        .lock()
        .unwrap()
        .get(session_id)
        .map(|set| !set.is_empty())
        .unwrap_or(false);
    if !has_viewer {
        app.unseen_sessions
            .lock()
            .unwrap()
            .insert(session_id.to_string());
    }
}

/// Decide whether a hub-broadcast `ServerMessage` should be forwarded to one
/// particular connection (`conn_id`). Only the per-session *streaming* chat
/// events are session-scoped — everything else (sidebar/host/global state)
/// must reach every connection regardless of what it's viewing, so this
/// defaults to `true` (forward) for any variant not explicitly listed as
/// session-scoped below. A detached (direct-mode) turn broadcasts on
/// `hub_events_tx` to every connection (see `DetachedSink::emit`'s doc
/// comment) because it has no single initiating connection to unicast to;
/// this is the filter that keeps a client watching session A from also
/// receiving session B's live chat frames.
///
/// `viewers` mirrors `AppState::session_viewers`: for each local session id,
/// the set of connection ids currently viewing it. A session with no entry,
/// or an entry with an empty set, has no viewers, so the event is dropped for
/// every connection until someone subscribes — at which point the ring-buffer
/// replay (`SessionRegistry::replay`, see `ClientMessage::SessionSubscribe`)
/// catches the new viewer up on anything already recorded.
///
/// `observes(session_id, agent_id)` reports whether this connection is watching
/// that agent, and it is what lets a *second* native chat pane keep updating.
/// A connection has exactly one active session (`set_active_session` removes it
/// from the previous one), so viewer membership alone would freeze every native
/// pane but the focused one — which is precisely the "several agents working in
/// parallel" the product is for. Only `agent.ui.snapshot` gets this widening:
/// the chat stream stays strictly session-scoped, and failing *open* instead
/// would send a paired phone the transcripts of sessions it never opened.
pub(super) fn should_forward_to_viewer(
    msg: &ServerMessage,
    conn_id: &str,
    viewers: &HashMap<String, HashSet<String>>,
    observes: impl Fn(&str, &str) -> bool,
) -> bool {
    if let ServerMessage::AgentUiSnapshot {
        session_id,
        provider_id,
        ..
    } = msg
    {
        if observes(session_id, provider_id) {
            return true;
        }
    }
    let session_id = match msg {
        ServerMessage::AgentUiSnapshot { session_id, .. } => session_id,
        // `error` (the bare `ServerMessage::Error` variant) carries no
        // session id at all, so it can't be session-scoped-filtered — always
        // forward it. Everything else (session.list/updated/created/deleted,
        // host.info, workspace.git, server.info, terminal.*, settings,
        // hosts.*, commands.list, session.history/layout, fs/worktree
        // replies, …) is global or drives the sidebar, and must reach every
        // connection: fail open by forwarding.
        _ => return true,
    };
    viewers
        .get(session_id)
        .is_some_and(|set| set.contains(conn_id))
}

pub(super) fn status_message(status: crate::status::StatusInfo) -> ServerMessage {
    ServerMessage::StatusUpdate {
        cwd: status.cwd,
        branch: status.branch,
        context_tokens: status.context_tokens,
        cost_usd: status.cost_usd,
    }
}

/// "No project" sessions (cwd `~` or none, including the blank one minted on
/// connect) belong to one scratch workspace listed as "Chats", so perch never
/// turns $HOME into a project. New sessions execute in HOME instead of that
/// bookkeeping folder. Callers hold `foundation_lock`.
pub(super) fn chats_pair(
    app: &AppState,
) -> anyhow::Result<(crate::db::ProjectRow, crate::db::WorkspaceRow)> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let scratch = std::path::Path::new(&home).join(".perch").join("scratch");
    std::fs::create_dir_all(&scratch)?;
    app.db
        .create_project("local", &scratch.display().to_string(), Some("Chats"), None)
}

fn is_chats_workspace(workspace: &crate::db::WorkspaceRow) -> bool {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let scratch = std::path::Path::new(&home).join(".perch").join("scratch");
    workspace.host_id == "local"
        && workspace.path == crate::db::canonical_path_for_host("local", &scratch.to_string_lossy())
}

/// Files/Git follow the terminal, not just the workspace: the id
/// `term:<session id>:<base64url directory>` names one local terminal and a
/// directory its shell has actually been in (the client uses it only once the
/// shell has left the workspace's own folder). The client never picks a root:
/// anything the terminal has not visited is refused. Other ids are plain
/// workspaces.
pub(super) fn resolve_tool_workspace(
    app: &AppState,
    id: &str,
) -> anyhow::Result<crate::db::WorkspaceRow> {
    resolve_scoped_workspace(&app.db, id, |session, path| {
        app.agent_runtime.cwd_seen(session, path)
    })
}

fn resolve_scoped_workspace(
    db: &crate::db::HistoryDb,
    id: &str,
    cwd_seen: impl Fn(&str, &str) -> bool,
) -> anyhow::Result<crate::db::WorkspaceRow> {
    use base64::Engine;
    let Some((session_id, encoded)) = id
        .strip_prefix("term:")
        .and_then(|rest| rest.split_once(':'))
    else {
        return db.resolve_workspace(id);
    };
    let path = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| anyhow::anyhow!("malformed terminal scope"))?;
    let session = db
        .get_session(session_id)?
        .ok_or_else(|| anyhow::anyhow!("session not found: {session_id}"))?;
    let workspace = db.resolve_workspace(session.workspace_id.as_deref().unwrap_or_default())?;
    anyhow::ensure!(
        workspace.host_id == "local" && session.host_id == "local",
        "terminal Files and Git are local only"
    );
    anyhow::ensure!(
        path == session.cwd || cwd_seen(session_id, &path),
        "the terminal has not been in {path}"
    );
    anyhow::ensure!(
        std::path::Path::new(&path).is_dir(),
        "{path} is not a directory"
    );
    Ok(crate::db::WorkspaceRow {
        id: id.to_string(),
        name: path
            .rsplit('/')
            .find(|part| !part.is_empty())
            .unwrap_or("/")
            .to_string(),
        path,
        branch: None,
        base_branch: None,
        dirty: false,
        start_snapshot: None,
        parent_workspace_id: None,
        pinned: false,
        hidden: true,
        ..workspace
    })
}

pub(super) fn create_workspace_session(
    db: &crate::db::HistoryDb,
    session_id: &str,
    workspace: &crate::db::WorkspaceRow,
) -> anyhow::Result<String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let cwd = if is_chats_workspace(workspace) {
        home
    } else {
        workspace.path.clone()
    };
    db.create_session_in_workspace(session_id, workspace, &cwd)?;
    Ok(cwd)
}

pub(super) fn handle_session_create(
    state: &Arc<ConnState>,
    cwd: Option<String>,
    host_id: Option<String>,
) {
    // Route to remote host if host_id is set and non-local.
    let target = host_id.as_deref().unwrap_or("local");
    if target != "local" && !target.is_empty() {
        // Direct-mode host: there is no perch on the other end to
        // forward to. The session row lives *here*, tagged with the
        // host id; only the cwd, the agent process and the transcript
        // are remote.
        if let Some(host) = direct_host(state, target) {
            create_direct_session(state, &host, cwd);
            return;
        }
        // Forward a stripped message (no hostId) so the remote creates a
        // local session rather than trying to route further.
        let forward_json = match &cwd {
            Some(c) => format!(
                r#"{{"type":"session.create","cwd":{}}}"#,
                serde_json::to_string(c).unwrap_or_default()
            ),
            None => r#"{"type":"session.create"}"#.to_string(),
        };
        state.app.hub.forward(target, &forward_json);
        return;
    }
    // Local session creation: a session starts in a project listed in perch
    // or in Chats, never in a folder perch hasn't been given ("+ Add" is how
    // a folder becomes a project). Once started, the session stays in that
    // project whatever the terminal later cd's into.
    let requested = if let Some(cwd) = cwd.filter(|cwd| cwd != "~") {
        let listed = state.app.db.listed_workspace_at("local", &cwd);
        if !matches!(listed, Ok(Some(_))) || !std::path::Path::new(&cwd).is_dir() {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("{cwd} is not a project in perch; add it first or start in Chats"),
                request_id: None,
                code: None,
                retryable: false,
            });
            return;
        }
        listed.unwrap()
    } else {
        None
    };
    let state = state.clone();
    tokio::spawn(async move {
        let session_id = Uuid::new_v4().to_string();
        let persisted = match requested {
            Some(workspace) => create_workspace_session(&state.app.db, &session_id, &workspace),
            None => {
                let _foundation_guard = state.app.foundation_lock.lock().unwrap();
                chats_pair(&state.app).and_then(|(project, workspace)| {
                    let cwd = create_workspace_session(&state.app.db, &session_id, &workspace)?;
                    // Push the pair so Chats shows in the sidebar right away.
                    super::workspace::publish_project_pair(&state.app, project, workspace);
                    Ok(cwd)
                })
            }
        };
        let resolved_cwd = match persisted {
            Ok(cwd) => cwd,
            Err(error) => {
                fail(
                    &state.out_tx,
                    None,
                    "session_create_failed",
                    format!("could not persist session: {error}"),
                    true,
                );
                return;
            }
        };
        insert_runtime(&state, &session_id, &resolved_cwd);
        set_active_session(&state, &session_id);
        let _ = state.out_tx.send(ServerMessage::SessionCreated {
            session_id: session_id.clone(),
        });
        let _ = state
            .out_tx
            .send(status_message(get_status(&resolved_cwd, None)));
        // Empty sessions stay out of navigation until their first activity.
    });
}

pub(super) fn handle_session_resume(state: &Arc<ConnState>, session_id: String) {
    match state.app.db.get_session(&session_id) {
        Ok(Some(row)) => {
            insert_runtime_on_host(state, &session_id, &row.cwd, &row.host_id);
            set_active_session(state, &session_id);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let _ = state
                .out_tx
                .send(status_message(get_status(&row.cwd, None)));
            notify_session_updated(&state.app, &session_id);
        }
        _ => {
            // Unknown/stale id (fresh machine, cleared DB, server
            // restart lost it — shouldn't happen since we read from
            // SQLite, but be defensive) — behave like session.create:
            // mint a brand-new session with no history.
            handle_session_create(state, None, None);
        }
    }
}

pub(super) fn handle_session_subscribe(state: &Arc<ConnState>, raw_text: &str, session_id: String) {
    // If this is a remote session, forward to the remote.
    // Register a unicast BEFORE forwarding so the reply hits our out_tx.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    set_active_session(state, &session_id);
}

pub(super) fn handle_session_list(state: &Arc<ConnState>) {
    let mut sessions = local_sessions_snapshot(&state.app);
    // Append remote sessions (tagged with their host_id), sorted by
    // host then by createdAt desc within each host.
    let mut remote = state.app.hub.remote_sessions_snapshot();
    remote.sort_by(|a, b| {
        a.host_id
            .cmp(&b.host_id)
            .then(b.created_at.cmp(&a.created_at))
    });
    sessions.extend(remote);
    // Direct send — not recorded into the ring buffer.
    let _ = state.out_tx.send(ServerMessage::SessionList { sessions });
}

pub(super) fn handle_commands_list(state: &Arc<ConnState>, raw_text: &str, session_id: &str) {
    // Remote (perch-mode) sessions: the remote instance knows its own
    // cwd and CLIs, so ask it and unicast the reply back.
    if let Some(host_id) = state.app.hub.route_for_session(session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.to_string()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    let session_id = session_id.to_string();
    let Some((host_id, cwd)) = ({
        let map = state.runtimes.lock().unwrap();
        map.get(&session_id)
            .map(|r| (r.host_id.clone(), r.cwd.clone()))
    }) else {
        let _ = state.out_tx.send(ServerMessage::CommandsList {
            session_id,
            claude: Vec::new(),
            codex: Vec::new(),
            pi: Vec::new(),
            omp: Vec::new(),
        });
        return;
    };
    // Direct-mode host: probe the same two commands over ssh.
    let ssh_host = if host_id == "local" {
        None
    } else {
        direct_host(state, &host_id).map(|h| h.ssh_host)
    };
    // Pi and OMP list their own commands from inside the running CLI; the built-ins are known
    // without it, so the menu is not empty while the CLI starts.
    let pi = super::native_ui::live_commands(state, &session_id, "pi");
    let omp = super::native_ui::live_commands(state, &session_id, "omp");
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let lists = crate::commands::list_for(&host_id, ssh_host.as_deref(), &cwd).await;
        let _ = out_tx.send(ServerMessage::CommandsList {
            session_id,
            claude: lists.claude,
            codex: lists.codex,
            pi: crate::native_ui::catalog::with_builtins("pi", pi),
            omp: crate::native_ui::catalog::with_builtins("omp", omp),
        });
    });
}

pub(super) fn handle_session_delete(state: &Arc<ConnState>, raw_text: &str, session_id: String) {
    // Route remote sessions through the hub.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }

    // A watcher must not turn its local close into a global stop. Recheck
    // here as control can transfer after a close dialog opens.
    let client = match connection_client_identity(state) {
        Ok(client) => client,
        Err(error) => {
            fail(&state.out_tx, None, "agent_control_required", error, false);
            return;
        }
    };
    if state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .iter()
        .any(|snapshot| {
            snapshot.key.session_id == session_id
                && snapshot
                    .input_owner
                    .as_ref()
                    .is_some_and(|owner| owner.client.id != client.id)
        })
    {
        fail(&state.out_tx, None, "agent_control_required",
            "Another view controls this session. Dismiss your view, or take control before stopping it for everyone", false);
        return;
    }

    // Drop this connection's runtime for the session.
    if let Some(runtime) = state.runtimes.lock().unwrap().remove(&session_id) {
        // Direct-mode session: kill the remote CLI-mode tmux session too, or
        // it would outlive the session it belongs to.
        if runtime.host_id != "local" {
            if let Some(host) = direct_host(state, &runtime.host_id) {
                let sid = session_id.clone();
                tokio::spawn(async move {
                    crate::direct_host::kill_cli_session(&host.ssh_host, &sid).await;
                });
            }
        }
    }

    // Kill any CLI-attached (agentAttach) terminal(s) for this
    // session — a dangling `claude --resume` process would otherwise
    // keep running (and fighting a future fresh attach) after the
    // session it belongs to is gone. Deleting a session must kill it
    // for every viewer sharing it, not just this connection, so this
    // goes through `agent_terminals.kill` (app-wide) rather than only
    // clearing this connection's own bookkeeping.
    let attached_terminal_ids: Vec<String> = {
        let map = state.terminal_agent_sessions.lock().unwrap();
        map.iter()
            .filter(|(_, sid)| **sid == session_id)
            .map(|(tid, _)| tid.clone())
            .collect()
    };
    for terminal_id in attached_terminal_ids {
        state
            .terminal_agent_sessions
            .lock()
            .unwrap()
            .remove(&terminal_id);
        // Direct-mode (ssh/tmux) attach still lives only in this
        // connection's `TerminalManager`; a local shared agent
        // terminal lives in the app-wide registry.
        state.terminals.kill(&terminal_id);
    }
    if state.active_session_id.lock().unwrap().as_deref() == Some(session_id.as_str()) {
        *state.active_session_id.lock().unwrap() = None;
    }
    if let Err(error) = delete_session(&state.app, &session_id) {
        fail(
            &state.out_tx,
            None,
            "session_delete_failed",
            format!("session.delete failed: {error}"),
            true,
        );
    }
}

/// Delete a local session for every viewer: its agents and shells end, then
/// its row goes. The project folder and the agent's own transcript stay on
/// disk; resuming is the CLI's (`claude --resume <id>`).
pub(super) fn delete_session(app: &AppState, session_id: &str) -> anyhow::Result<()> {
    let _agent_operation = app.agent_operation_lock.lock().unwrap();
    let agent_keys = app
        .agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .filter(|snapshot| snapshot.key.session_id == session_id)
        .map(|snapshot| snapshot.key)
        .collect::<Vec<_>>();
    for key in &agent_keys {
        app.agent_runtime
            .remove(key)
            .map_err(|error| anyhow::anyhow!("could not stop its agent: {error}"))?;
    }
    if !crate::daemon::terminate(session_id) {
        anyhow::bail!("could not confirm legacy terminal stopped; session retained");
    }
    // Close shells before forgetting any session bookkeeping.
    app.workspace_terminals.delete_session(session_id)?;
    super::agent_history::forget_session(session_id);
    super::attention::forget_session(app, session_id);
    for set in [
        &app.running_sessions,
        &app.unseen_sessions,
        &app.blocked_sessions,
    ] {
        set.lock().unwrap().remove(session_id);
    }
    app.session_viewers.lock().unwrap().remove(session_id);
    for key in &agent_keys {
        let _ = app.agent_persistence.delete_snapshot(key);
    }
    app.cli_active_sessions.lock().unwrap().remove(session_id);
    // Fan out to every connection: the row a session.updated would look up
    // is gone.
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::SessionDeleted {
            session_id: session_id.to_string(),
        }));
    Ok(())
}

pub(super) fn handle_session_layout_get(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
) {
    // Route remote sessions through the hub. Register a unicast
    // BEFORE forwarding (same pattern as chat.send / session.subscribe)
    // so the session.layout reply routes back to this connection.
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.register_unicast(
            PendingKey::Session(session_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    let layout = state
        .app
        .db
        .get_session_layout(&session_id)
        .unwrap_or(None)
        .and_then(|raw| serde_json::from_str(&raw).ok());
    let _ = state
        .out_tx
        .send(ServerMessage::SessionLayout { session_id, layout });
}

pub(super) fn handle_session_layout_set(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
    layout: serde_json::Value,
) {
    // Route remote sessions through the hub — fire-and-forget (no reply
    // is expected by the caller).
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    // A layout can be saved for a brand-new session before its first
    // chat message (Fix 3 defers the `sessions` row insert until then)
    // — materialize the row here too so the UPDATE below isn't a
    // silent no-op. INSERT OR IGNORE, same as chat.send's lazy insert.
    if let Some(cwd) = state
        .runtimes
        .lock()
        .unwrap()
        .get(&session_id)
        .map(|r| r.cwd.clone())
    {
        let _ = state.app.db.create_session(&session_id, &cwd);
    }
    let layout_str = serde_json::to_string(&layout).unwrap_or_default();
    if let Err(e) = state.app.db.set_session_layout(&session_id, &layout_str) {
        let _ = state.out_tx.send(ServerMessage::Error {
            message: format!("session.layout.set failed: {e}"),
            request_id: None,
            code: None,
            retryable: false,
        });
    }
}

pub(super) fn handle_session_rename(
    state: &Arc<ConnState>,
    raw_text: &str,
    session_id: String,
    title: String,
) {
    if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
        state.app.hub.forward(&host_id, raw_text);
        return;
    }
    match state.app.db.set_title_override(&session_id, title.trim()) {
        Ok(()) => {
            notify_session_updated(&state.app, &session_id);
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("session.rename failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

#[cfg(test)]
mod scratchpad_tests {
    use super::*;

    #[test]
    fn scratchpad_starts_in_home_without_moving_existing_sessions_or_registering_home() {
        let path = std::env::temp_dir().join(format!("perch-scratchpad-{}.sqlite", Uuid::new_v4()));
        let db = crate::db::HistoryDb::open(&path).unwrap();
        let home = std::env::var("HOME").unwrap();
        let scratch = std::path::Path::new(&home).join(".perch/scratch");
        let scratch = scratch.to_string_lossy();
        let (project, workspace) = db
            .create_project("local", &scratch, Some("Chats"), None)
            .unwrap();
        db.create_session("old", &scratch).unwrap();
        db.set_claude_session_id("old", "existing-conversation")
            .unwrap();

        assert_eq!(
            create_workspace_session(&db, "new", &workspace).unwrap(),
            home
        );
        let row = db.get_session("new").unwrap().unwrap();
        assert_eq!(row.cwd, home);
        assert_eq!(row.project_id.as_deref(), Some(project.id.as_str()));
        assert_eq!(row.workspace_id.as_deref(), Some(workspace.id.as_str()));
        // Lazy persistence from terminal/chat/layout paths must not mint a HOME project.
        db.create_session("new", &home).unwrap();
        // Nor may a repeated create move an old conversation to HOME.
        db.create_session_in_workspace("old", &workspace, &home)
            .unwrap_err();
        drop(db);

        // Startup's legacy import must preserve explicit associations without
        // creating a project from the execution cwd.
        let db = crate::db::HistoryDb::open(&path).unwrap();
        let row = db.get_session("new").unwrap().unwrap();
        assert_eq!(row.cwd, home);
        assert_eq!(row.workspace_id.as_deref(), Some(workspace.id.as_str()));
        assert_eq!(db.list_projects("local", true).unwrap().len(), 1);
        assert!(db.listed_workspace_at("local", &home).unwrap().is_none());
        let old = db.get_session("old").unwrap().unwrap();
        assert_eq!(old.cwd, scratch);
        assert_eq!(
            old.claude_session_id.as_deref(),
            Some("existing-conversation")
        );
        let ids = db.local_session_ids(Some(&project.id)).unwrap();
        assert!(ids.contains(&"new".to_string()) && ids.contains(&"old".to_string()));

        let (_, ordinary) = db
            .create_project("local", "/tmp/perch-ordinary", None, None)
            .unwrap();
        assert_eq!(
            create_workspace_session(&db, "ordinary", &ordinary).unwrap(),
            ordinary.path
        );
        let (_, remote) = db.create_project("remote", &scratch, None, None).unwrap();
        assert_eq!(
            create_workspace_session(&db, "remote", &remote).unwrap(),
            remote.path
        );
        drop(db);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn terminal_scope_is_per_session_and_only_for_visited_directories() {
        use base64::Engine;
        let path = std::env::temp_dir().join(format!("perch-scope-{}.sqlite", Uuid::new_v4()));
        let db = crate::db::HistoryDb::open(&path).unwrap();
        let home = std::env::var("HOME").unwrap();
        let scratch = std::path::Path::new(&home).join(".perch/scratch");
        let (_, chats) = db
            .create_project("local", &scratch.to_string_lossy(), Some("Chats"), None)
            .unwrap();
        create_workspace_session(&db, "chat", &chats).unwrap();
        let dir = std::env::temp_dir();
        let dir = dir.to_string_lossy().trim_end_matches('/').to_string();
        let scope = |session: &str, dir: &str| {
            let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(dir);
            format!("term:{session}:{encoded}")
        };
        let seen = |session: &str, path: &str| session == "chat" && path == dir;

        let row = resolve_scoped_workspace(&db, &scope("chat", &dir), seen).unwrap();
        assert_eq!(
            (row.path.as_str(), row.host_id.as_str()),
            (dir.as_str(), "local")
        );
        assert_eq!(row.project_id, chats.project_id);
        // The terminal's start directory is always allowed.
        resolve_scoped_workspace(&db, &scope("chat", &home), |_, _| false).unwrap();
        // A directory the terminal never visited, and a session that is not there, are refused.
        resolve_scoped_workspace(&db, &scope("chat", "/etc"), seen).unwrap_err();
        resolve_scoped_workspace(&db, &scope("gone", &dir), seen).unwrap_err();
        // A project terminal scopes too, but only to directories it has been in; plain ids still resolve as workspaces.
        let (_, project) = db.create_project("local", &dir, None, None).unwrap();
        db.create_session_in_workspace("proj", &project, &dir)
            .unwrap();
        let sub = format!("{dir}/sub");
        std::fs::create_dir_all(&sub).unwrap();
        resolve_scoped_workspace(&db, &scope("proj", &sub), |s, p| s == "proj" && p == sub)
            .unwrap();
        resolve_scoped_workspace(&db, &scope("proj", &sub), |_, _| false).unwrap_err();
        std::fs::remove_dir(&sub).unwrap();
        assert_eq!(
            resolve_scoped_workspace(&db, &project.id, seen).unwrap().id,
            project.id
        );
        drop(db);
        std::fs::remove_file(path).unwrap();
    }
}

#[cfg(test)]
mod native_review_target_tests {
    use super::review_provider_choice;
    #[test]
    fn native_owner_wins_over_legacy_history_and_cannot_be_replaced_by_a_packet() {
        assert_eq!(
            review_provider_choice(None, Some("pi"), Some("claude")).unwrap(),
            "pi"
        );
        assert!(review_provider_choice(Some("claude"), Some("pi"), Some("claude")).is_err());
        assert_eq!(
            review_provider_choice(Some("omp"), Some("omp"), None).unwrap(),
            "omp"
        );
        assert_eq!(
            review_provider_choice(None, None, Some("codex")).unwrap(),
            "codex"
        );
        assert!(review_provider_choice(None, None, None).is_err());
    }
}

#[cfg(test)]
mod stale_status_tests {
    use super::{stale_sessions, STATUS_STALE_AFTER_MS};
    use crate::agent_fleet::{AgentKey, AgentLifecycleRegistry, AgentRegistration, ProviderSignal};

    #[test]
    fn busy_sessions_decay_after_thirty_silent_minutes_unless_an_agent_is_fresh() {
        let lifecycle = AgentLifecycleRegistry::new();
        let key = |session: &str, agent: &str| AgentKey::new("w", session, agent).unwrap();
        for (session, agent, state_at) in [
            ("silent", "claude", 0),
            ("fresh", "claude", 0),
            ("mixed", "claude", 0),
            ("mixed", "codex", STATUS_STALE_AFTER_MS),
            ("unshown", "claude", 0),
            ("done", "claude", 0),
        ] {
            lifecycle
                .register(AgentRegistration {
                    key: key(session, agent),
                    provider_id: agent.into(),
                    provider_session_id: None,
                    resumable: false,
                    now_ms: 0,
                })
                .unwrap();
            lifecycle
                .signal(&key(session, agent), ProviderSignal::TurnStarted, state_at)
                .unwrap();
        }
        lifecycle
            .signal(
                &key("silent", "claude"),
                ProviderSignal::InputRequested {
                    reason: "ask".into(),
                },
                1,
            )
            .unwrap();
        lifecycle
            .record_activity(&key("fresh", "claude"), STATUS_STALE_AFTER_MS)
            .unwrap();
        lifecycle
            .signal(
                &key("done", "claude"),
                ProviderSignal::Completed {
                    reason: "done".into(),
                },
                2,
            )
            .unwrap();
        let now = STATUS_STALE_AFTER_MS + 1;
        let stale = stale_sessions(&lifecycle.list(), |id| id != "unshown", now);
        assert_eq!(stale, ["silent".to_string()].into_iter().collect());
        assert!(stale_sessions(&lifecycle.list(), |_| true, STATUS_STALE_AFTER_MS - 1).is_empty());
    }
}
