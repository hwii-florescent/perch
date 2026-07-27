//! axum HTTP + WS server, mirroring
//! `reference/node-server-spec/src/httpServer.ts` +
//! `reference/node-server-spec/src/wsHandler.ts`.
//!
//! One HTTP server: static files (or a placeholder page) under `base_path`,
//! and a WebSocket endpoint at `{base_path}ws`. Each WS connection gets its
//! own chat-session map + `TerminalManager`; a single writer task owns the
//! socket's send half so any task (message loop, chat-turn task, terminal
//! reader thread) can push `ServerMessage`s to the client via an mpsc
//! channel — mirroring Node's single-threaded-but-interleaved event loop.

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::{Html, IntoResponse};
use axum::routing::get;
use axum::Router;
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tower_http::services::{ServeDir, ServeFile};
use uuid::Uuid;

use crate::agent::{AgentEvent, AgentRunner, ClaudeRunner, ClaudeRunnerOptions, CodexRunner, CodexRunnerOptions};
use crate::db::{HistoryDb, SessionListRow};
use crate::hosts::HostsStore;
use crate::hub::{HubManager, PendingKey};
use crate::models::{self, ModelLists};
use crate::protocol::{AgentKind, ChatUsage, ClientMessage, CustomModelsData, ServerMessage, SessionStatus, SessionSummary, SettingsData, SshHostEntry};
use crate::registry::SessionRegistry;
use crate::settings::SettingsStore;
use crate::status::{get_server_info, get_status, LastUsage};
use crate::terminal::TerminalManager;

pub struct CliArgs {
    pub port: u16,
    pub headless: bool,
    pub base_path: String,
    pub public_base_url: Option<String>,
    /// Override the SQLite db path (default: `~/.perch/history.sqlite`).
    /// Can also be set via `PERCH_DB` env var.
    pub db_path: Option<PathBuf>,
    /// Override the hosts.json path (default: `~/.perch/hosts.json`).
    /// Can also be set via `PERCH_HOSTS` env var.
    pub hosts_path: Option<PathBuf>,
}

impl CliArgs {
    pub fn parse(argv: &[String]) -> Self {
        let mut args = CliArgs {
            port: std::env::var("PERCH_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(7788),
            headless: false,
            base_path: std::env::var("PERCH_BASE_PATH").unwrap_or_else(|_| "/".to_string()),
            public_base_url: std::env::var("PERCH_PUBLIC_BASE_URL").ok(),
            db_path: std::env::var("PERCH_DB").ok().map(PathBuf::from),
            hosts_path: std::env::var("PERCH_HOSTS").ok().map(PathBuf::from),
        };

        let mut i = 0;
        while i < argv.len() {
            match argv[i].as_str() {
                "--port" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        if let Ok(p) = v.parse() {
                            args.port = p;
                        }
                    }
                }
                "--headless" => args.headless = true,
                "--base-path" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.base_path = v.clone();
                    }
                }
                "--public-base-url" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.public_base_url = Some(v.clone());
                    }
                }
                "--db-path" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.db_path = Some(PathBuf::from(v));
                    }
                }
                "--hosts-path" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.hosts_path = Some(PathBuf::from(v));
                    }
                }
                _ => {}
            }
            i += 1;
        }
        args
    }
}

fn normalize_base_path(base_path: &str) -> String {
    let mut p = base_path.to_string();
    if !p.starts_with('/') {
        p = format!("/{p}");
    }
    if !p.ends_with('/') {
        p.push('/');
    }
    p
}

pub struct ServerOptions {
    pub port: u16,
    pub base_path: String,
    pub web_dist_dir: PathBuf,
    /// Override db path (from `--db-path` / `PERCH_DB`).
    pub db_path: Option<PathBuf>,
    /// Override hosts.json path (from `--hosts-path` / `PERCH_HOSTS`).
    pub hosts_path: Option<PathBuf>,
    /// If `Some`, fired with the bound `SocketAddr` right after the TCP
    /// listener is created (before `axum::serve` blocks).  Lets the Tauri
    /// shell learn the actual port when port 0 is used.  The headless binary
    /// passes `None`.
    pub ready_tx: Option<tokio::sync::oneshot::Sender<std::net::SocketAddr>>,
}

/// Fired on the broadcast channel whenever a session's running status changes
/// (turn starts, turn completes, cancel, create). Listeners convert this into
/// a `session.updated` wire message by looking up the current DB row + running
/// set at the time they process the event.
#[derive(Clone)]
struct SessionUpdatedEvent {
    session_id: String,
}

#[derive(Clone)]
struct AppState {
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
    /// Session ids that currently have an agent turn in flight.
    running_sessions: Arc<Mutex<HashSet<String>>>,
    /// Broadcast channel — one sender, many per-connection receivers. Capacity
    /// 64: if a slow receiver falls behind it gets `Lagged` and catches up on
    /// the next event rather than blocking the sender.
    session_events_tx: tokio::sync::broadcast::Sender<SessionUpdatedEvent>,
    /// Model lists discovered at startup — sent to each client in `server.info`.
    model_lists: Arc<ModelLists>,
    /// Persistent settings store (custom models, default cwd, …).
    settings: Arc<SettingsStore>,
    /// SSH hosts configuration store.
    hosts: Arc<HostsStore>,
    /// Hub manager: owns WS connections to remote perch instances.
    hub: Arc<HubManager>,
}

pub async fn run(
    options: ServerOptions,
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
) -> anyhow::Result<()> {
    let base_path = normalize_base_path(&options.base_path);
    let ws_path = format!("{base_path}ws");

    // Bind the TCP listener first so we know the actual port (important when
    // port 0 is requested — the OS assigns a free port).
    let bind_addr = if options.port == 0 {
        // Port 0: bind loopback only so the OS picks a free port.
        SocketAddr::from(([127, 0, 0, 1], 0))
    } else {
        SocketAddr::from(([0, 0, 0, 0], options.port))
    };
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    let bound_addr = listener.local_addr()?;

    let (session_events_tx, _) = tokio::sync::broadcast::channel(64);

    // Load the static model catalogue once at startup.
    let model_lists = Arc::new(models::catalogue());
    tracing::info!(
        "[perch] catalogue: {} claude model(s), {} codex model(s)",
        model_lists.claude.len(),
        model_lists.codex.len(),
    );

    // Load settings store.
    let settings = Arc::new(SettingsStore::load_default());
    tracing::info!("[perch] settings loaded from {:?}", crate::settings::default_settings_path());

    // Load hosts store (custom path or default).
    let hosts = Arc::new(if let Some(p) = options.hosts_path {
        HostsStore::load(p)
    } else {
        HostsStore::load_default()
    });

    // Prefer settings.default_cwd over the process cwd when set.
    let effective_cwd = settings.get().default_cwd.unwrap_or(default_cwd);

    // Construct the hub with the actual bound port and seed it with hosts.
    let hub = HubManager::new(bound_addr.port());
    let initial_hosts = hosts.list();
    hub.reload_hosts(&initial_hosts);

    let state = AppState {
        registry,
        db,
        default_cwd: effective_cwd,
        running_sessions: Arc::new(Mutex::new(HashSet::new())),
        session_events_tx,
        model_lists,
        settings,
        hosts,
        hub,
    };

    let mut router = Router::new().route(&ws_path, get(ws_upgrade)).with_state(state);

    if options.web_dist_dir.is_dir() {
        let index = options.web_dist_dir.join("index.html");
        let serve_dir = ServeDir::new(&options.web_dist_dir).not_found_service(ServeFile::new(index));
        let nest_at = if base_path == "/" {
            "/".to_string()
        } else {
            base_path.trim_end_matches('/').to_string()
        };
        router = router.nest_service(&nest_at, serve_dir);
    } else {
        let placeholder_base = base_path.clone();
        router = router.fallback(move |uri: axum::http::Uri| {
            let base_path = placeholder_base.clone();
            async move { placeholder_response(&base_path, uri.path()) }
        });
    }

    tracing::info!(
        "[perch] listening on port {} (base path {base_path}, ws at {ws_path})",
        bound_addr.port()
    );
    // Notify the Tauri shell (or any other caller) of the actual bound address
    // before we hand control to axum::serve.
    if let Some(tx) = options.ready_tx {
        let _ = tx.send(bound_addr);
    }
    axum::serve(listener, router).await?;
    Ok(())
}

fn placeholder_response(base_path: &str, url: &str) -> axum::response::Response {
    if !url.starts_with(base_path) {
        return (axum::http::StatusCode::NOT_FOUND, "not found").into_response();
    }
    Html(placeholder_html(base_path)).into_response()
}

fn placeholder_html(base_path: &str) -> String {
    format!(
        "<!doctype html>\n<html>\n  <head><meta charset=\"utf-8\"><title>perch</title></head>\n  <body>\n    <h1>perch</h1>\n    <p>Server is running. No web client build found at this path; the\n    WebSocket endpoint is at <code>{base_path}ws</code>.</p>\n  </body>\n</html>\n"
    )
}

async fn ws_upgrade(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

struct SessionRuntime {
    cwd: String,
    /// Persistent across turns so claude's `--resume` continuity survives
    /// multiple `chat.send`s in the same session (see `agent.rs`). The
    /// model to use is set per-turn via `ClaudeRunner::set_model`.
    claude_runner: Arc<ClaudeRunner>,
    /// The runner actually dispatched for the most recent turn (claude or a
    /// fresh, single-turn codex runner) — this is what `chat.cancel` kills.
    active_runner: Mutex<Option<Arc<dyn AgentRunner>>>,
    /// The concrete `CodexRunner` used for the most recent codex turn, if
    /// any, kept alongside `active_runner` (which is type-erased) so its
    /// `thread_id()` can be read and persisted once the turn completes.
    last_codex_runner: Mutex<Option<Arc<CodexRunner>>>,
    last_usage: LastUsage,
    /// Accumulates the streamed assistant reply for the in-flight turn (text
    /// + thinking) so it can be written to SQLite as one row on `chat.done`.
    /// `None` when no turn is in flight.
    pending_turn: Mutex<Option<PendingTurn>>,
}

/// The in-flight assistant turn being accumulated for a session, persisted
/// to `messages` as a single row once `chat.done` fires.
struct PendingTurn {
    agent: AgentKind,
    model: Option<String>,
    text: String,
    thinking: String,
}

fn agent_str(agent: AgentKind) -> &'static str {
    match agent {
        AgentKind::Claude => "claude",
        AgentKind::Codex => "codex",
    }
}

/// Per-connection state shared across the read loop, the writer task, the
/// terminal reader/waiter threads, and spawned chat-turn tasks.
struct ConnState {
    app: AppState,
    /// Unique id for this WS connection — scopes unicast registrations in the
    /// hub so they can all be torn down atomically when the socket closes.
    conn_id: String,
    out_tx: UnboundedSender<ServerMessage>,
    runtimes: Mutex<HashMap<String, SessionRuntime>>,
    terminals: TerminalManager,
}

async fn handle_socket(socket: WebSocket, app: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let (out_tx, mut out_rx) = unbounded_channel::<ServerMessage>();

    // Unique id for this browser connection — used to scope unicast registrations
    // so they can all be cleaned up atomically when the socket closes.
    let conn_id = Uuid::new_v4().to_string();

    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            let Ok(text) = serde_json::to_string(&message) else {
                continue;
            };
            if sender.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    let terminal_tx = out_tx.clone();
    let on_data = Arc::new(move |terminal_id: String, data: String| {
        let _ = terminal_tx.send(ServerMessage::TerminalData { terminal_id, data });
    });
    let terminal_tx = out_tx.clone();
    let on_exit = Arc::new(move |terminal_id: String, code: i32| {
        let _ = terminal_tx.send(ServerMessage::TerminalExit { terminal_id, code });
    });

    let state = Arc::new(ConnState {
        app: app.clone(),
        conn_id: conn_id.clone(),
        out_tx,
        runtimes: Mutex::new(HashMap::new()),
        terminals: TerminalManager::new(on_data, on_exit),
    });

    // Send initial status.update and server.info once per connection.
    let initial_status = get_status(&state.app.default_cwd, None);
    let _ = state.out_tx.send(status_message(initial_status));

    let server_info = get_server_info();
    let _ = state.out_tx.send(ServerMessage::ServerInfo {
        hostname: server_info.hostname,
        is_ssh: server_info.is_ssh,
        platform: server_info.platform.to_string(),
        claude_models: state.app.model_lists.claude.clone(),
        codex_models: state.app.model_lists.codex.clone(),
    });

    // Send the current hosts list so the sidebar can render remote sections
    // without waiting for the Settings modal to call fetchHosts().
    // Bug fix (F3): previously hosts were only sent in response to hosts.list;
    // the sidebar would show no remote sections until Settings was opened.
    let _ = state.out_tx.send(ServerMessage::HostsList {
        hosts: state.app.hosts.list().into_iter().map(|h| SshHostEntry {
            id: h.id,
            name: h.name,
            ssh_host: h.ssh_host,
            remote_port: h.remote_port,
            enabled: h.enabled,
            direct_url: h.direct_url,
            remote_cmd: h.remote_cmd,
        }).collect(),
    });

    // Send current hub host states so the browser knows connection status of
    // all configured remote hosts immediately on connect.
    for msg in state.app.hub.snapshot_host_states() {
        let _ = state.out_tx.send(msg);
    }

    // Spawn a task that forwards session-updated broadcast events to this
    // connection's out channel. The task exits when the broadcast sender
    // closes or when our out channel is closed (connection gone).
    let mut events_rx = app.session_events_tx.subscribe();
    let event_out_tx = state.out_tx.clone();
    let event_db = app.db.clone();
    let event_running = app.running_sessions.clone();
    tokio::spawn(async move {
        loop {
            match events_rx.recv().await {
                Ok(evt) => {
                    // Look up the current DB row for this session, build a
                    // summary with the live running snapshot, and push it.
                    let rows = event_db.list_sessions().unwrap_or_default();
                    let Some(row) = rows.into_iter().find(|r| r.id == evt.session_id) else {
                        continue;
                    };
                    let running = event_running.lock().unwrap();
                    let summary = build_session_summary(row, &running);
                    drop(running);
                    if event_out_tx.send(ServerMessage::SessionUpdated { session: summary }).is_err() {
                        // out channel closed — connection gone, stop leaking.
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    // Fell behind; skip missed events and continue.
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    // Spawn a task that forwards hub broadcast events (host.info, remote
    // session.list / session.updated, relayed chat frames, …) to this connection.
    let mut hub_rx = app.hub.subscribe_events();
    let hub_out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        loop {
            match hub_rx.recv().await {
                Ok(msg) => {
                    if hub_out_tx.send((*msg).clone()).is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        match serde_json::from_str::<ClientMessage>(&text) {
            Ok(client_msg) => handle_message(&state, client_msg, &text),
            Err(_) => {
                let _ = state.out_tx.send(ServerMessage::Error {
                    message: "invalid JSON".to_string(),
                });
            }
        }
    }

    // Connection closed: tear down terminals, in-flight turns, and hub unicast
    // registrations so no sender leaks to this dead connection.
    state.terminals.dispose_all();
    state.app.hub.unregister_all_for_connection(&conn_id);
    for runtime in state.runtimes.lock().unwrap().values() {
        if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
            runner.cancel();
        }
    }
    writer.abort();
}

fn status_message(status: crate::status::StatusInfo) -> ServerMessage {
    ServerMessage::StatusUpdate {
        cwd: status.cwd,
        branch: status.branch,
        context_tokens: status.context_tokens,
        cost_usd: status.cost_usd,
    }
}

/// Build a `SessionSummary` from a DB row and the current running set.
fn build_session_summary(row: SessionListRow, running: &HashSet<String>) -> SessionSummary {
    let status = if running.contains(&row.id) {
        SessionStatus::Running
    } else {
        SessionStatus::Idle
    };
    let last_agent = row.last_agent.as_deref().and_then(|a| match a {
        "claude" => Some(AgentKind::Claude),
        "codex" => Some(AgentKind::Codex),
        _ => None,
    });
    SessionSummary {
        id: row.id,
        title: row.title,
        cwd: row.cwd,
        created_at: row.created_at,
        last_agent,
        last_model: row.last_model,
        status,
        host_id: "local".to_string(),
    }
}

/// Insert `session_id` into the running set and fire the broadcast channel so
/// all connected clients receive a `session.updated` with `status: "running"`.
/// Errors are ignored — a missed broadcast is not fatal.
fn notify_session_updated(app: &AppState, session_id: &str) {
    let _ = app.session_events_tx.send(SessionUpdatedEvent {
        session_id: session_id.to_string(),
    });
}

fn emit(state: &Arc<ConnState>, session_id: &str, message: ServerMessage) {
    state.app.registry.record(session_id, message.clone());
    let _ = state.out_tx.send(message);
}

/// Build a fresh `ClaudeRunner` (optionally primed to `--resume` a known
/// claude session id) and register it as the session's runtime for this
/// connection. When `last_agent` is "claude" and `last_model` is Some, the
/// model is restored on the runner so that CLI-mode attach (which reads
/// `claude_runner.model()`) passes the correct `--model` flag even after a
/// server restart — without this, claude would fall back to the dated snapshot
/// id in its transcript (e.g. `claude-haiku-4-5-20251001`), which the GenAI
/// proxy rejects.
fn insert_runtime(
    state: &Arc<ConnState>,
    session_id: &str,
    cwd: &str,
    claude_session_id: Option<String>,
    last_agent: Option<&str>,
    last_model: Option<&str>,
) {
    let claude_runner = Arc::new(ClaudeRunner::new(ClaudeRunnerOptions {
        cwd: cwd.to_string(),
        claude_bin: None,
        permission_mode: None,
    }));
    if let Some(id) = claude_session_id {
        claude_runner.resume_session(id);
    }
    // Restore the model alias from the DB so that CLI attach after a server
    // restart passes `--model <alias>` rather than letting claude fall back to
    // the dated snapshot id in the transcript. Only applies when the last agent
    // was claude (model aliases are per-agent; codex model is on CodexRunner).
    if last_agent.map(|a| a == "claude").unwrap_or(false) {
        if let Some(model) = last_model {
            claude_runner.set_model(Some(model.to_string()));
        }
    }
    state.runtimes.lock().unwrap().insert(
        session_id.to_string(),
        SessionRuntime {
            cwd: cwd.to_string(),
            claude_runner,
            active_runner: Mutex::new(None),
            last_codex_runner: Mutex::new(None),
            last_usage: LastUsage::default(),
            pending_turn: Mutex::new(None),
        },
    );
}
fn handle_message(state: &Arc<ConnState>, msg: ClientMessage, raw_text: &str) {
    match msg {
        ClientMessage::SessionCreate { cwd, host_id } => {
            // Route to remote host if host_id is set and non-local.
            let target = host_id.as_deref().unwrap_or("local");
            if target != "local" && !target.is_empty() {
                // Forward a stripped message (no hostId) so the remote creates a
                // local session rather than trying to route further.
                let forward_json = match &cwd {
                    Some(c) => format!(r#"{{"type":"session.create","cwd":{}}}"#,
                        serde_json::to_string(c).unwrap_or_default()),
                    None => r#"{"type":"session.create"}"#.to_string(),
                };
                state.app.hub.forward(target, &forward_json);
                return;
            }
            // Local session creation.
            let session_id = Uuid::new_v4().to_string();
            let cwd = cwd.unwrap_or_else(|| state.app.default_cwd.clone());
            state.app.registry.create(&session_id, &cwd);
            let _ = state.app.db.create_session(&session_id, &cwd);
            insert_runtime(state, &session_id, &cwd, None, None, None);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let _ = state.out_tx.send(status_message(get_status(&cwd, None)));
            // Notify all connections that this session now exists.
            notify_session_updated(&state.app, &session_id);
        }
        ClientMessage::SessionResume { session_id } => {
            match state.app.db.get_session(&session_id) {
                Ok(Some(row)) => {
                    state.app.registry.create(&session_id, &row.cwd);
                    insert_runtime(
                        state,
                        &session_id,
                        &row.cwd,
                        row.claude_session_id.clone(),
                        row.last_agent.as_deref(),
                        row.last_model.as_deref(),
                    );
                    let _ = state.out_tx.send(ServerMessage::SessionCreated {
                        session_id: session_id.clone(),
                    });
                    let messages = state.app.db.load_messages(&session_id).unwrap_or_default();
                    let _ = state.out_tx.send(ServerMessage::SessionHistory {
                        session_id: session_id.clone(),
                        messages,
                    });
                    let _ = state.out_tx.send(status_message(get_status(&row.cwd, None)));
                    notify_session_updated(&state.app, &session_id);
                }
                _ => {
                    // Unknown/stale id (fresh machine, cleared DB, server
                    // restart lost it — shouldn't happen since we read from
                    // SQLite, but be defensive) — behave like session.create:
                    // mint a brand-new session with no history.
                    let new_id = Uuid::new_v4().to_string();
                    let cwd = state.app.default_cwd.clone();
                    state.app.registry.create(&new_id, &cwd);
                    let _ = state.app.db.create_session(&new_id, &cwd);
                    insert_runtime(state, &new_id, &cwd, None, None, None);
                    let _ = state.out_tx.send(ServerMessage::SessionCreated {
                        session_id: new_id.clone(),
                    });
                    let _ = state.out_tx.send(status_message(get_status(&cwd, None)));
                    notify_session_updated(&state.app, &new_id);
                }
            }
        }
        ClientMessage::SessionSubscribe { session_id } => {
            // If this is a remote session, forward to the remote.
            // Register a unicast BEFORE forwarding so the ring-buffer replay
            // that comes back as session.history hits our out_tx.
            if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
                state.app.hub.register_unicast(
                    PendingKey::Session(session_id.clone()),
                    state.conn_id.clone(),
                    state.out_tx.clone(),
                );
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            // If the session is currently mid-turn, skip ring-buffer replay —
            // replaying a half-streamed turn into a freshly-switched view would
            // produce a truncated, inconsistent rendering. History up to the
            // last *completed* turn is still accessible via session.resume.
            let is_running = state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .contains(&session_id);
            if !is_running {
                for event in state.app.registry.replay(&session_id) {
                    let _ = state.out_tx.send(event);
                }
            }
        }
        ClientMessage::SessionList {} => {
            let rows = state.app.db.list_sessions().unwrap_or_default();
            let running = state.app.running_sessions.lock().unwrap();
            let mut sessions: Vec<SessionSummary> = rows
                .into_iter()
                .map(|row| build_session_summary(row, &running))
                .collect();
            drop(running);
            // Append remote sessions (tagged with their host_id), sorted by
            // host then by createdAt desc within each host.
            let mut remote = state.app.hub.remote_sessions_snapshot();
            remote.sort_by(|a, b| {
                a.host_id.cmp(&b.host_id).then(b.created_at.cmp(&a.created_at))
            });
            sessions.extend(remote);
            // Direct send — not recorded into the ring buffer.
            let _ = state.out_tx.send(ServerMessage::SessionList { sessions });
        }
        ClientMessage::ChatSend {
            ref session_id,
            ref text,
            agent,
            ref model,
        } => {
            // Route remote sessions through the hub.
            if let Some(host_id) = state.app.hub.route_for_session(session_id) {
                // Register a unicast so chat.chunk/done/etc. come back to us.
                state.app.hub.register_unicast(
                    PendingKey::Session(session_id.clone()),
                    state.conn_id.clone(),
                    state.out_tx.clone(),
                );
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            // Local chat turn (original logic below).
            let session_id = session_id.clone();
            let text = text.clone();
            let model = model.clone();
            let runner = {
                let map = state.runtimes.lock().unwrap();
                let Some(runtime) = map.get(&session_id) else {
                    drop(map);
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("unknown session {session_id}"),
                    });
                    return;
                };
                let runner: Arc<dyn AgentRunner> = match agent {
                    AgentKind::Codex => {
                        let codex_runner = Arc::new(CodexRunner::new(CodexRunnerOptions {
                            cwd: runtime.cwd.clone(),
                            codex_bin: None,
                            model: model.clone(),
                        }));
                        *runtime.last_codex_runner.lock().unwrap() = Some(codex_runner.clone());
                        codex_runner
                    }
                    AgentKind::Claude => {
                        runtime.claude_runner.set_model(model.clone());
                        runtime.claude_runner.clone()
                    }
                };
                *runtime.active_runner.lock().unwrap() = Some(runner.clone());
                *runtime.pending_turn.lock().unwrap() = Some(PendingTurn {
                    agent,
                    model: model.clone(),
                    text: String::new(),
                    thinking: String::new(),
                });
                runner
            };
            let _ = state.app.db.add_message(
                &session_id,
                "user",
                &text,
                Some(agent_str(agent)),
                model.as_deref(),
                None,
            );

            // Mark running before spawning so the status is visible immediately.
            state.app.running_sessions.lock().unwrap().insert(session_id.clone());
            notify_session_updated(&state.app, &session_id);

            let state = state.clone();
            tokio::spawn(async move {
                let (tx, mut rx) = unbounded_channel::<AgentEvent>();
                let send_fut = runner.send(text, tx);
                let forward = async {
                    while let Some(event) = rx.recv().await {
                        handle_agent_event(&state, &session_id, event);
                    }
                };
                tokio::join!(send_fut, forward);
            });
        }
        ClientMessage::ChatCancel { session_id } => {
            // Route remote sessions through the hub.
            if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            if let Some(runtime) = state.runtimes.lock().unwrap().get(&session_id) {
                if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
                    runner.cancel();
                }
            }
            // Remove from running immediately on cancel — the agent may still
            // emit a trailing Done/Error, but remove here to be safe.
            state.app.running_sessions.lock().unwrap().remove(&session_id);
            notify_session_updated(&state.app, &session_id);
        }
        ClientMessage::TerminalCreate {
            cols,
            rows,
            cwd,
            ref agent_attach,
        } => {
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
                match state.terminals.create(cols, rows, cwd, None) {
                    Ok(terminal_id) => {
                        let _ = state.out_tx.send(ServerMessage::TerminalCreated { terminal_id });
                    }
                    Err(err) => {
                        let _ = state.out_tx.send(ServerMessage::Error {
                            message: format!("failed to create terminal: {err}"),
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
                    });
                    return;
                };
                runtime.cwd.clone()
            };

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
                        Some(id) => {
                            argv.push("--resume".to_string());
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
                                    r.last_codex_runner.lock().unwrap().as_ref().map(|r| r.model())
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

            match state.terminals.create(cols, rows, Some(runtime_cwd), Some(argv)) {
                Ok(terminal_id) => {
                    let _ = state.out_tx.send(ServerMessage::TerminalCreated { terminal_id });
                }
                Err(err) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("failed to create terminal: {err}"),
                    });
                }
            }
        }
        ClientMessage::TerminalInput { terminal_id, data } => {
            // Route remote terminals through the hub.
            if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            state.terminals.input(&terminal_id, &data);
        }
        ClientMessage::TerminalResize { terminal_id, cols, rows } => {
            // Route remote terminals through the hub.
            if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            state.terminals.resize(&terminal_id, cols, rows);
        }

        // -----------------------------------------------------------------------
        // Settings & hosts (Stage D)
        // -----------------------------------------------------------------------

        ClientMessage::SettingsGet {} => {
            let s = state.app.settings.get();
            let _ = state.out_tx.send(ServerMessage::SettingsCurrent {
                settings: settings_to_wire(&s),
            });
        }
        ClientMessage::SettingsUpdate { patch } => {
            // Convert protocol::SettingsPatch → settings::SettingsPatch.
            let store_patch = crate::settings::SettingsPatch {
                custom_models: patch.custom_models.map(custom_models_to_store),
                default_cwd: patch.default_cwd,
            };
            match state.app.settings.update(store_patch) {
                Ok(updated) => {
                    let _ = state.out_tx.send(ServerMessage::SettingsCurrent {
                        settings: settings_to_wire(&updated),
                    });
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("settings.update failed: {e}"),
                    });
                }
            }
        }
        ClientMessage::HostsList {} => {
            let hosts = state.app.hosts.list();
            let _ = state.out_tx.send(ServerMessage::HostsList {
                hosts: hosts.into_iter().map(host_to_wire).collect(),
            });
        }
        ClientMessage::HostsUpsert { host } => {
            let store_host = wire_to_host(host);
            match state.app.hosts.upsert(store_host) {
                Ok(all) => {
                    // Reload the hub with the updated host list (starts/stops tasks).
                    state.app.hub.reload_hosts(&all);
                    let wire: Vec<SshHostEntry> = all.into_iter().map(host_to_wire).collect();
                    // Broadcast hosts.updated to ALL connections via hub channel.
                    let _ = state.app.hub.hub_events_tx.send(std::sync::Arc::new(
                        ServerMessage::HostsUpdated { hosts: wire }
                    ));
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("hosts.upsert failed: {e}"),
                    });
                }
            }
        }
        ClientMessage::HostsDelete { id } => {
            match state.app.hosts.delete(&id) {
                Ok(all) => {
                    // Reload the hub (stops the deleted host's task).
                    state.app.hub.reload_hosts(&all);
                    let wire: Vec<SshHostEntry> = all.into_iter().map(host_to_wire).collect();
                    // Broadcast hosts.updated to ALL connections via hub channel.
                    let _ = state.app.hub.hub_events_tx.send(std::sync::Arc::new(
                        ServerMessage::HostsUpdated { hosts: wire }
                    ));
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("hosts.delete failed: {e}"),
                    });
                }
            }
        }
    }
}

fn handle_agent_event(state: &Arc<ConnState>, session_id: &str, event: AgentEvent) {
    match event {
        AgentEvent::Chunk(text) => {
            append_pending_text(state, session_id, &text);
            emit(
                state,
                session_id,
                ServerMessage::ChatChunk {
                    session_id: session_id.to_string(),
                    text,
                },
            );
        }
        AgentEvent::Thinking(text) => {
            append_pending_thinking(state, session_id, &text);
            emit(
                state,
                session_id,
                ServerMessage::ChatThinking {
                    session_id: session_id.to_string(),
                    text,
                },
            );
        }
        AgentEvent::ToolUse { name, input } => emit(
            state,
            session_id,
            ServerMessage::ChatToolUse {
                session_id: session_id.to_string(),
                name,
                input,
            },
        ),
        AgentEvent::ToolResult { name, result } => emit(
            state,
            session_id,
            ServerMessage::ChatToolResult {
                session_id: session_id.to_string(),
                name,
                result,
            },
        ),
        AgentEvent::Done(usage) => {
            update_last_usage(state, session_id, usage.as_ref());
            persist_turn(state, session_id);
            persist_claude_session_id(state, session_id);
            persist_codex_thread_id(state, session_id);
            emit(
                state,
                session_id,
                ServerMessage::ChatDone {
                    session_id: session_id.to_string(),
                    usage,
                },
            );
            let (cwd, last_usage) = {
                let map = state.runtimes.lock().unwrap();
                map.get(session_id)
                    .map(|r| (r.cwd.clone(), r.last_usage.clone()))
                    .unwrap_or_default()
            };
            emit(state, session_id, status_message(get_status(&cwd, Some(&last_usage))));
            // Turn complete — mark idle and broadcast to all connections.
            state.app.running_sessions.lock().unwrap().remove(session_id);
            notify_session_updated(&state.app, session_id);
        }
        AgentEvent::Error(message) => {
            // Error also ends the turn — ensure running status can't get stuck.
            state.app.running_sessions.lock().unwrap().remove(session_id);
            notify_session_updated(&state.app, session_id);
            emit(state, session_id, ServerMessage::Error { message });
        }
    }
}

/// Append a `chat.chunk`'s text to the in-flight turn being accumulated for
/// `session_id`, if any (a no-op once `persist_turn` has taken it — e.g.
/// stray events arriving after cancellation).
fn append_pending_text(state: &Arc<ConnState>, session_id: &str, text: &str) {
    if let Some(runtime) = state.runtimes.lock().unwrap().get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.text.push_str(text);
        }
    }
}

/// Same as [`append_pending_text`] but for `chat.thinking` deltas.
fn append_pending_thinking(state: &Arc<ConnState>, session_id: &str, text: &str) {
    if let Some(runtime) = state.runtimes.lock().unwrap().get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.thinking.push_str(text);
        }
    }
}

/// Write the accumulated assistant reply for the just-finished turn to
/// SQLite as one `messages` row, then clear the pending-turn slot. Turns
/// that produced no text and no thinking (e.g. an immediate spawn failure)
/// aren't persisted — there's nothing worth showing on resume.
fn persist_turn(state: &Arc<ConnState>, session_id: &str) {
    let turn = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id).and_then(|r| r.pending_turn.lock().unwrap().take())
    };
    let Some(turn) = turn else { return };
    if turn.text.is_empty() && turn.thinking.is_empty() {
        return;
    }
    let thinking = if turn.thinking.is_empty() {
        None
    } else {
        Some(turn.thinking.as_str())
    };
    let _ = state.app.db.add_message(
        session_id,
        "assistant",
        &turn.text,
        Some(agent_str(turn.agent)),
        turn.model.as_deref(),
        thinking,
    );
    // Persist the agent+model so that after a server restart, CLI-mode attach
    // can reconstruct `--model <alias>` from the DB row instead of letting
    // claude fall back to the dated snapshot id in its transcript.
    let _ = state.app.db.update_session_last_model(
        session_id,
        agent_str(turn.agent),
        turn.model.as_deref(),
    );
}

/// Mirror the claude runner's current internal session id into the `sessions`
/// row so a later `session.resume` (possibly after a server restart) can
/// pass it to `--resume`. Harmless no-op for codex-only turns (it just
/// re-writes whatever claude id, if any, this runtime already had).
fn persist_claude_session_id(state: &Arc<ConnState>, session_id: &str) {
    let claude_session_id = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id).and_then(|r| r.claude_runner.claude_session_id())
    };
    if let Some(id) = claude_session_id {
        let _ = state.app.db.set_claude_session_id(session_id, &id);
    }
}

/// Mirror the most recently used codex runner's `thread_id` (if any) into the
/// `sessions` row, so a later CLI-mode attach can `codex resume` it. No-op
/// for turns that didn't use codex, or haven't seen a `thread.started` event
/// yet.
fn persist_codex_thread_id(state: &Arc<ConnState>, session_id: &str) {
    let thread_id = {
        let map = state.runtimes.lock().unwrap();
        map.get(session_id)
            .and_then(|r| r.last_codex_runner.lock().unwrap().as_ref().and_then(|r| r.thread_id()))
    };
    if let Some(id) = thread_id {
        let _ = state.app.db.set_codex_thread_id(session_id, &id);
    }
}

fn update_last_usage(state: &Arc<ConnState>, session_id: &str, usage: Option<&ChatUsage>) {
    let Some(usage) = usage else { return };
    if let Some(runtime) = state.runtimes.lock().unwrap().get_mut(session_id) {
        runtime.last_usage = LastUsage {
            context_tokens: Some(usage.context_tokens),
            cost_usd: Some(usage.cost_usd),
        };
    }
}

// ---------------------------------------------------------------------------
// Stage D: settings/hosts wire <-> store conversion helpers
// ---------------------------------------------------------------------------

fn settings_to_wire(s: &crate::settings::Settings) -> SettingsData {
    SettingsData {
        custom_models: CustomModelsData {
            claude: s.custom_models.claude.clone(),
            codex: s.custom_models.codex.clone(),
        },
        default_cwd: s.default_cwd.clone(),
    }
}

fn custom_models_to_store(cm: CustomModelsData) -> crate::settings::CustomModelsData {
    crate::settings::CustomModelsData {
        claude: cm.claude,
        codex: cm.codex,
    }
}

fn host_to_wire(h: crate::hosts::SshHost) -> SshHostEntry {
    SshHostEntry {
        id: h.id,
        name: h.name,
        ssh_host: h.ssh_host,
        remote_port: h.remote_port,
        enabled: h.enabled,
        direct_url: h.direct_url,
        remote_cmd: h.remote_cmd,
    }
}

fn wire_to_host(h: SshHostEntry) -> crate::hosts::SshHost {
    crate::hosts::SshHost {
        id: h.id,
        name: h.name,
        ssh_host: h.ssh_host,
        remote_port: h.remote_port,
        enabled: h.enabled,
        direct_url: h.direct_url,
        remote_cmd: h.remote_cmd,
    }
}
