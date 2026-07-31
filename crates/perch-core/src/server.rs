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
use std::sync::{Arc, Mutex, OnceLock};

use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse};
use axum::routing::{get, post};
use axum::Router;
use futures::{SinkExt, StreamExt};
use regex::Regex;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tower_http::services::{ServeDir, ServeFile};
use uuid::Uuid;

use crate::agent::{AgentEvent, AgentRunner, ClaudeRunner, ClaudeRunnerOptions, CodexRunner, CodexRunnerOptions};
use crate::db::HistoryDb;
use crate::detached::{DetachedManager, FinishedTurn, TurnRequest, TurnSink};
use crate::hosts::HostsStore;
use crate::hub::{HubManager, PendingKey};
use crate::models::{self, ModelLists};
use crate::protocol::{AgentKind, ChatUsage, ClientMessage, CustomModelsData, FsEntry, ServerMessage, SessionStatus, SessionSummary, SettingsData, SshHostEntry, WorktreeEntry};
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

/// `(branch, ahead, behind)` — cached last-known git status for one cwd.
type GitStatus = (Option<String>, u32, u32);

#[derive(Clone)]
struct AppState {
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
    /// Session ids that currently have an agent turn in flight.
    running_sessions: Arc<Mutex<HashSet<String>>>,
    /// For each local session id, the set of connection ids (`ConnState::conn_id`)
    /// currently viewing it (i.e. it's their `active_session_id`). A session
    /// with no entry, or an entry with an empty set, has no viewers.
    session_viewers: Arc<Mutex<HashMap<String, HashSet<String>>>>,
    /// Local session ids that finished a turn while unviewed (herdr's `done`
    /// state). Cleared the moment any connection views the session again.
    unseen_sessions: Arc<Mutex<HashSet<String>>>,
    /// Local session ids whose CLI-attached terminal output currently matches
    /// an approval-prompt pattern (see `blocked_patterns`). Cleared on the
    /// next `terminal.input` to that terminal, or when the terminal exits.
    blocked_sessions: Arc<Mutex<HashSet<String>>>,
    /// Last known git branch + ahead/behind for each local session cwd,
    /// populated by the background poll task spawned in `run()`. Keyed by
    /// cwd (local host only — "local" is implicit). Used both to detect
    /// changes worth broadcasting and to snapshot current values to
    /// newly-connected clients.
    workspace_git: Arc<Mutex<HashMap<String, GitStatus>>>,
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
    /// Detached-turn manager: owns turns running on `mode: "direct"` hosts,
    /// which have no perch of their own (see `detached.rs`). Lives in
    /// `AppState` rather than `ConnState` on purpose — a detached turn
    /// outlives the WS connection that started it, and must not be cancelled
    /// when that connection closes.
    detached: Arc<DetachedManager>,
}

/// `AppState`'s implementation of the detached-turn callback interface.
///
/// It exists so `detached.rs` can stream and finalize turns without owning any
/// of the server's session bookkeeping: every method here is the same code
/// path a local turn takes (`emit`-equivalent recording into the replay ring
/// buffer, `running_sessions` + unseen dots, `persist_turn`'s single
/// `messages` row), just reached from a task that has no `ConnState`.
struct DetachedSink {
    app: AppState,
}

impl TurnSink for DetachedSink {
    fn emit(&self, session_id: &str, msg: ServerMessage) {
        // Record for ring-buffer replay, exactly like the local `emit`, then
        // fan out to *every* connection rather than one. A detached turn has
        // no single "initiating connection" worth privileging — the whole
        // point is that it outlives whoever started it.
        self.app.registry.record(session_id, msg.clone());
        let _ = self.app.hub.hub_events_tx.send(Arc::new(msg));
    }

    fn set_running(&self, session_id: &str, running: bool) {
        if running {
            self.app.running_sessions.lock().unwrap().insert(session_id.to_string());
        } else {
            self.app.running_sessions.lock().unwrap().remove(session_id);
            mark_unseen_if_unviewed(&self.app, session_id);
        }
        notify_session_updated(&self.app, session_id);
    }

    fn persist_turn(&self, session_id: &str, turn: FinishedTurn) {
        if turn.text.is_empty() && turn.thinking.is_empty() {
            return;
        }
        let thinking = if turn.thinking.is_empty() {
            None
        } else {
            Some(turn.thinking.as_str())
        };
        let _ = self.app.db.add_message(
            session_id,
            "assistant",
            &turn.text,
            Some(agent_str(turn.agent)),
            turn.model.as_deref(),
            thinking,
        );
        let _ = self.app.db.update_session_last_model(
            session_id,
            agent_str(turn.agent),
            turn.model.as_deref(),
        );
    }
}

pub async fn run(
    options: ServerOptions,
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
) -> anyhow::Result<()> {
    let base_path = normalize_base_path(&options.base_path);
    let ws_path = format!("{base_path}ws");
    let clipboard_image_path = format!("{base_path}clipboard-image");

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

    let detached = DetachedManager::new(db.clone());

    let state = AppState {
        registry,
        db,
        default_cwd: effective_cwd,
        running_sessions: Arc::new(Mutex::new(HashSet::new())),
        session_viewers: Arc::new(Mutex::new(HashMap::new())),
        unseen_sessions: Arc::new(Mutex::new(HashSet::new())),
        blocked_sessions: Arc::new(Mutex::new(HashSet::new())),
        workspace_git: Arc::new(Mutex::new(HashMap::new())),
        session_events_tx,
        model_lists,
        settings,
        hosts,
        hub,
        detached,
    };

    // The detached manager needs `AppState` to report turn progress, and
    // `AppState` holds the manager — hence the deferred wire-up. Recovery is
    // kicked off immediately afterwards, before the listener starts accepting
    // connections, so a turn that survived a perch restart is already being
    // re-tailed by the time the first client asks for the session list.
    state
        .detached
        .attach_sink(Arc::new(DetachedSink { app: state.clone() }));
    state.detached.recover_all();

    spawn_git_poll_task(state.clone());

    let mut router = Router::new()
        .route(&ws_path, get(ws_upgrade))
        .route(&clipboard_image_path, post(clipboard_image_upload))
        .with_state(state);

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

/// Background task (Phase 6): every 5s, recompute the git branch +
/// ahead/behind status for every distinct cwd among local sessions, and
/// broadcast `workspace.git` to all connections whenever a cwd's value
/// changes. Runs an initial pass immediately (before the first sleep) so the
/// `workspace_git` cache is warm by the time the first client connects,
/// letting `handle_socket` push a snapshot without waiting up to 5s.
///
/// Uses `tokio::process::Command` (async) for the one `git rev-list`
/// subprocess per cwd per tick (see `status::get_ahead_behind`) so this never
/// blocks the async runtime.
fn spawn_git_poll_task(state: AppState) {
    tokio::spawn(async move {
        loop {
            let cwds: HashSet<String> = state
                .db
                .list_sessions()
                .unwrap_or_default()
                .into_iter()
                .map(|row| row.cwd)
                .collect();

            for cwd in cwds {
                let branch = crate::status::get_branch(&cwd);
                let branch = if branch.is_empty() { None } else { Some(branch) };
                let (ahead, behind) = crate::status::get_ahead_behind(&cwd).await.unwrap_or((0, 0));
                let fingerprint = (branch.clone(), ahead, behind);

                let changed = {
                    let mut cache = state.workspace_git.lock().unwrap();
                    if cache.get(&cwd) == Some(&fingerprint) {
                        false
                    } else {
                        cache.insert(cwd.clone(), fingerprint.clone());
                        true
                    }
                };

                if changed {
                    let _ = state.hub.hub_events_tx.send(Arc::new(ServerMessage::WorkspaceGit {
                        host_id: "local".to_string(),
                        cwd: cwd.clone(),
                        branch,
                        ahead,
                        behind,
                    }));
                }
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
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

/// `POST {base}clipboard-image?ext=png` — Wave 2 item 9: stages a pasted
/// clipboard image so the client can paste its on-disk path into a
/// terminal/CLI pane's PTY (most CLI agents accept a file path for image
/// input). No `AppState` needed — this is a pure filesystem operation
/// against `~/.perch/clipboard-images/` (see `clipboard_image.rs`).
///
/// v1 scope: local host only. There is no HTTP route from the browser to a
/// *remote* (federated) perch instance — only its WS traffic is tunneled
/// through the hub — so this endpoint only ever stages to the local
/// machine's `~/.perch/`; pasting into a remote terminal pane is a
/// documented no-op on the client side for now.
async fn clipboard_image_upload(
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    const MAX_BYTES: usize = 10 * 1024 * 1024;
    if body.len() > MAX_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "image too large (max 10MB)").into_response();
    }
    let content_type = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.starts_with("image/") {
        return (StatusCode::UNSUPPORTED_MEDIA_TYPE, "expected an image/* content type").into_response();
    }
    let ext = params.get("ext").map(|s| s.as_str()).unwrap_or("");
    match crate::clipboard_image::stage(&body, ext) {
        Ok(path) => axum::Json(serde_json::json!({ "path": path.to_string_lossy() })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("failed to stage clipboard image: {e}")).into_response(),
    }
}

struct SessionRuntime {
    cwd: String,
    /// `"local"`, or the id of the `mode: "direct"` host this session runs on.
    /// Direct sessions never touch `claude_runner`/`active_runner`: their turns
    /// are launched detached over ssh by `detached.rs` and deliberately are
    /// *not* cancelled when this connection closes.
    host_id: String,
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
    /// The local session id this connection is currently viewing (its most
    /// recent `session.create`/`session.resume`/`session.subscribe` target).
    /// `None` before the first such message. Drives `session_viewers` /
    /// `unseen_sessions` bookkeeping in [`set_active_session`].
    active_session_id: Mutex<Option<String>>,
    /// Maps CLI-attached terminal ids to the session they're attached to, so
    /// `TerminalInput` can clear that session's blocked state on user input,
    /// and the `on_data`/`on_exit` closures (created before this struct
    /// exists — see `handle_socket`) can scan output and clean up on exit.
    /// Shared (not owned) with those closures via the same `Arc`. Plain
    /// terminals (no `agentAttach`) never get an entry.
    terminal_agent_sessions: Arc<Mutex<HashMap<String, String>>>,
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
    let terminal_agent_sessions: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    // Rolling ANSI-stripped output tail per CLI-attached terminal, used only
    // for blocked-state (approval-prompt) detection — see `blocked_patterns`.
    let terminal_tails: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    let on_data_app = app.clone();
    let on_data_agent_sessions = terminal_agent_sessions.clone();
    let on_data_tails = terminal_tails.clone();
    let on_data = Arc::new(move |terminal_id: String, data: String| {
        // Phase 6: blocked-state detection — only for terminals created via
        // `agentAttach` (real interactive CLI mode), never plain shells.
        if let Some(session_id) = on_data_agent_sessions.lock().unwrap().get(&terminal_id).cloned() {
            let newly_blocked = {
                let mut tails = on_data_tails.lock().unwrap();
                let tail = tails.entry(terminal_id.clone()).or_default();
                append_tail(tail, &data);
                let already_blocked = on_data_app.blocked_sessions.lock().unwrap().contains(&session_id);
                !already_blocked && blocked_patterns().iter().any(|re| re.is_match(tail))
            };
            if newly_blocked {
                on_data_app.blocked_sessions.lock().unwrap().insert(session_id.clone());
                notify_session_updated(&on_data_app, &session_id);
            }
        }
        let _ = terminal_tx.send(ServerMessage::TerminalData { terminal_id, data });
    });
    let terminal_tx = out_tx.clone();
    let on_exit_app = app.clone();
    let on_exit_agent_sessions = terminal_agent_sessions.clone();
    let on_exit_tails = terminal_tails.clone();
    let on_exit = Arc::new(move |terminal_id: String, code: i32| {
        on_exit_tails.lock().unwrap().remove(&terminal_id);
        // PTY end clears any blocked flag for the session it was attached to
        // — there's no longer a live prompt to answer.
        if let Some(session_id) = on_exit_agent_sessions.lock().unwrap().remove(&terminal_id) {
            let was_blocked = on_exit_app.blocked_sessions.lock().unwrap().remove(&session_id);
            if was_blocked {
                notify_session_updated(&on_exit_app, &session_id);
            }
        }
        let _ = terminal_tx.send(ServerMessage::TerminalExit { terminal_id, code });
    });

    let state = Arc::new(ConnState {
        app: app.clone(),
        conn_id: conn_id.clone(),
        out_tx,
        runtimes: Mutex::new(HashMap::new()),
        terminals: TerminalManager::new(on_data, on_exit),
        active_session_id: Mutex::new(None),
        terminal_agent_sessions,
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
        hosts: state.app.hosts.list().into_iter().map(host_to_wire).collect(),
    });

    // Send current settings (including the selected theme) immediately on
    // connect — same rationale as the HostsList fix above: without this the
    // page would render with the default "perch" palette until the user
    // opened the Settings modal (which is the only other place fetchSettings
    // is called), even if they'd previously picked a different theme.
    let _ = state.out_tx.send(ServerMessage::SettingsCurrent {
        settings: settings_to_wire(&state.app.settings.get()),
    });

    // Send current hub host states so the browser knows connection status of
    // all configured remote hosts immediately on connect.
    for msg in state.app.hub.snapshot_host_states() {
        let _ = state.out_tx.send(msg);
    }

    // Send the currently-known git branch/ahead-behind for every local cwd
    // already polled by `spawn_git_poll_task`, so a newly-connected client
    // doesn't wait up to 5s for the first broadcast (Phase 6).
    {
        let cache = state.app.workspace_git.lock().unwrap();
        for (cwd, (branch, ahead, behind)) in cache.iter() {
            let _ = state.out_tx.send(ServerMessage::WorkspaceGit {
                host_id: "local".to_string(),
                cwd: cwd.clone(),
                branch: branch.clone(),
                ahead: *ahead,
                behind: *behind,
            });
        }
    }

    // Spawn a task that forwards session-updated broadcast events to this
    // connection's out channel. The task exits when the broadcast sender
    // closes or when our out channel is closed (connection gone).
    let mut events_rx = app.session_events_tx.subscribe();
    let event_out_tx = state.out_tx.clone();
    let event_db = app.db.clone();
    let event_running = app.running_sessions.clone();
    let event_unseen = app.unseen_sessions.clone();
    let event_blocked = app.blocked_sessions.clone();
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
                    let unseen = event_unseen.lock().unwrap();
                    let blocked = event_blocked.lock().unwrap();
                    let summary = build_session_summary(row, &running, &unseen, &blocked);
                    drop(running);
                    drop(unseen);
                    drop(blocked);
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
    let hub_app = app.clone();
    tokio::spawn(async move {
        loop {
            match hub_rx.recv().await {
                Ok(msg) => {
                    // `session.list` from the hub is the *remote-only*
                    // snapshot (the hub has no DB handle — see
                    // `broadcast_merged_session_list`). Forwarding it verbatim
                    // would make the browser drop every local session from its
                    // list until the next client-initiated `session.list`, so
                    // merge the local rows back on top here.
                    let out = match &*msg {
                        ServerMessage::SessionList { sessions } => {
                            let mut merged = local_sessions_snapshot(&hub_app);
                            merged.extend(sessions.iter().cloned());
                            ServerMessage::SessionList { sessions: merged }
                        }
                        other => other.clone(),
                    };
                    if hub_out_tx.send(out).is_err() {
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
    // Remove this connection from whichever session's viewer set it was in —
    // otherwise a stale conn_id would keep that session looking "viewed"
    // forever, and it would never become eligible for the unseen/"done" dot.
    if let Some(active) = state.active_session_id.lock().unwrap().take() {
        let mut viewers = state.app.session_viewers.lock().unwrap();
        if let Some(set) = viewers.get_mut(&active) {
            set.remove(&conn_id);
            if set.is_empty() {
                viewers.remove(&active);
            }
        }
    }
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

/// Every local (this-host) session as a `SessionSummary`, newest-first — the
/// same rows `session.list` replies with before the hub's remote sessions are
/// appended. Factored out because the hub's own `session.list` broadcast
/// carries *only* the remote portion (`hub.rs::broadcast_merged_session_list`
/// has no DB handle), so the per-connection hub forwarder has to merge the
/// local rows back in before the message reaches a browser.
fn local_sessions_snapshot(app: &AppState) -> Vec<SessionSummary> {
    let rows = app.db.list_sessions().unwrap_or_default();
    let running = app.running_sessions.lock().unwrap();
    let unseen = app.unseen_sessions.lock().unwrap();
    let blocked = app.blocked_sessions.lock().unwrap();
    rows.into_iter()
        .map(|row| build_session_summary(row, &running, &unseen, &blocked))
        .collect()
}

/// Build a `SessionSummary` from a DB row and the current running/unseen/
/// blocked snapshots. `unseen`/`blocked` are only meaningful for local
/// sessions — remote summaries are built elsewhere (`hub.rs`) and always
/// report `false` unless the remote itself set them.
fn build_session_summary(
    row: crate::db::SessionListRow,
    running: &std::collections::HashSet<String>,
    unseen: &std::collections::HashSet<String>,
    blocked: &std::collections::HashSet<String>,
) -> SessionSummary {
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
        id: row.id.clone(),
        title: row.title,
        cwd: row.cwd,
        created_at: row.created_at,
        last_agent,
        last_model: row.last_model,
        status,
        // Local *storage*, but not necessarily the local *host*: a direct-mode
        // session's row lives here while its cwd and agent live on a remote
        // with no perch of its own, and the sidebar must group it under that
        // host (see `db.rs`'s `sessions.host_id`).
        host_id: row.host_id,
        archived: row.archived,
        unseen: unseen.contains(&row.id),
        blocked: blocked.contains(&row.id),
    }
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
        viewers.entry(session_id.to_string()).or_default().insert(state.conn_id.clone());
    }
    let was_unseen = state.app.unseen_sessions.lock().unwrap().remove(session_id);
    if was_unseen {
        notify_session_updated(&state.app, session_id);
    }
}

/// Called when a turn finishes (`chat.done` or a terminal error) and
/// `session_id` is removed from `running_sessions`. If no connection is
/// currently viewing the session, mark it unseen (herdr's `done` state) so
/// `build_session_summary` reports it on the next broadcast. Callers already
/// broadcast `session.updated` right after removing from `running_sessions`,
/// so this doesn't need to trigger its own notify.
fn mark_unseen_if_unviewed(app: &AppState, session_id: &str) {
    let has_viewer = app
        .session_viewers
        .lock()
        .unwrap()
        .get(session_id)
        .map(|set| !set.is_empty())
        .unwrap_or(false);
    if !has_viewer {
        app.unseen_sessions.lock().unwrap().insert(session_id.to_string());
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
    insert_runtime_on_host(state, session_id, cwd, "local", claude_session_id, last_agent, last_model)
}

#[allow(clippy::too_many_arguments)]
fn insert_runtime_on_host(
    state: &Arc<ConnState>,
    session_id: &str,
    cwd: &str,
    host_id: &str,
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
            host_id: host_id.to_string(),
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
                    Some(c) => format!(r#"{{"type":"session.create","cwd":{}}}"#,
                        serde_json::to_string(c).unwrap_or_default()),
                    None => r#"{"type":"session.create"}"#.to_string(),
                };
                state.app.hub.forward(target, &forward_json);
                return;
            }
            // Local session creation — Fix 2: validate the requested cwd.
            let resolved_cwd = if let Some(raw_cwd) = cwd {
                // Expand a leading `~` to the user's home directory.
                let expanded = if raw_cwd == "~" || raw_cwd.starts_with("~/") {
                    let home = std::env::var("HOME").unwrap_or_default();
                    if raw_cwd == "~" {
                        home
                    } else {
                        format!("{home}{}", &raw_cwd[1..])
                    }
                } else {
                    raw_cwd
                };
                // Validate that it's an existing directory.
                if !std::path::Path::new(&expanded).is_dir() {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("cwd is not an existing directory: {expanded}"),
                    });
                    return;
                }
                expanded
            } else {
                state.app.default_cwd.clone()
            };
            let session_id = Uuid::new_v4().to_string();
            // Fix 3: register in-memory only; DB row is deferred until first message.
            state.app.registry.create(&session_id, &resolved_cwd);
            insert_runtime(state, &session_id, &resolved_cwd, None, None, None);
            set_active_session(state, &session_id);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let _ = state.out_tx.send(status_message(get_status(&resolved_cwd, None)));
            // Do NOT broadcast session.updated yet — session has no messages,
            // so it won't appear in list_sessions(). It lives only in memory
            // until the first chat.send or terminal.create agentAttach.
        }
        ClientMessage::SessionResume { session_id } => {
            match state.app.db.get_session(&session_id) {
                Ok(Some(row)) => {
                    state.app.registry.create(&session_id, &row.cwd);
                    insert_runtime_on_host(
                        state,
                        &session_id,
                        &row.cwd,
                        &row.host_id,
                        row.claude_session_id.clone(),
                        row.last_agent.as_deref(),
                        row.last_model.as_deref(),
                    );
                    set_active_session(state, &session_id);
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
                    set_active_session(state, &new_id);
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
            set_active_session(state, &session_id);
            if !is_running {
                for event in state.app.registry.replay(&session_id) {
                    let _ = state.out_tx.send(event);
                }
            }
        }
        ClientMessage::SessionList {} => {
            let mut sessions = local_sessions_snapshot(&state.app);
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

            // Direct-mode host: launch the turn detached over ssh instead of
            // spawning a local child. Everything after this point (persisting
            // the user row, marking the session running) is identical — only
            // the runner differs, and it lives in `AppState` so the turn
            // survives this connection going away.
            let session_host = {
                let map = state.runtimes.lock().unwrap();
                map.get(&session_id).map(|r| (r.host_id.clone(), r.cwd.clone()))
            };
            if let Some((host_id, cwd)) = session_host {
                if host_id != "local" {
                    let Some(host) = direct_host(state, &host_id) else {
                        let _ = state.out_tx.send(ServerMessage::Error {
                            message: format!("host {host_id} is no longer configured"),
                        });
                        return;
                    };
                    let _ = state.app.db.create_session_on_host(&session_id, &cwd, &host_id);
                    let _ = state.app.db.add_message(
                        &session_id,
                        "user",
                        &text,
                        Some(agent_str(agent)),
                        model.as_deref(),
                        None,
                    );
                    let row = state.app.db.get_session(&session_id).ok().flatten();
                    state.app.running_sessions.lock().unwrap().insert(session_id.clone());
                    notify_session_updated(&state.app, &session_id);
                    state.app.detached.start_turn(TurnRequest {
                        session_id,
                        host_id,
                        ssh_host: host.ssh_host,
                        cwd,
                        agent,
                        model,
                        prompt: text,
                        claude_session_id: row.as_ref().and_then(|r| r.claude_session_id.clone()),
                        codex_thread_id: row.as_ref().and_then(|r| r.codex_thread_id.clone()),
                    });
                    return;
                }
            }

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
            // Fix 3: lazily insert the sessions row on first user message.
            // If the row already exists (e.g. resumed session), INSERT OR IGNORE is a no-op.
            let cwd_for_insert = {
                state.runtimes.lock().unwrap()
                    .get(&session_id)
                    .map(|r| r.cwd.clone())
                    .unwrap_or_else(|| state.app.default_cwd.clone())
            };
            let _ = state.app.db.create_session(&session_id, &cwd_for_insert);
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
            // Direct-mode host: the turn is a detached remote process group,
            // so cancel is `kill -TERM -<pgid>` over ssh (see `detached.rs`).
            // Unconditional — the manager is a no-op when this session has no
            // running detached run, and queues the cancel when the launch
            // round trip is still in flight.
            state.app.detached.cancel(&session_id);
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

            // Direct-mode host (CLI mode over ssh): the local pty's child is
            // `ssh -tt <host> tmux new-session -A …` rather than the CLI
            // itself. tmux keeps the TUI (and its scrollback) alive across a
            // dropped connection, and `terminal.resize` still works because
            // ssh propagates SIGWINCH from the local pty.
            let runtime_host = {
                let map = state.runtimes.lock().unwrap();
                map.get(&attach.session_id).map(|r| r.host_id.clone()).unwrap_or_default()
            };
            if runtime_host != "local" && !runtime_host.is_empty() {
                let Some(host) = direct_host(state, &runtime_host) else {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("host {runtime_host} is no longer configured"),
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
                match state.terminals.create(cols, rows, None, Some(argv)) {
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
                        let _ = state.out_tx.send(ServerMessage::TerminalCreated { terminal_id });
                    }
                    Err(err) => {
                        let _ = state.out_tx.send(ServerMessage::Error {
                            message: format!("failed to create terminal: {err}"),
                        });
                    }
                }
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

            match state.terminals.create(cols, rows, Some(runtime_cwd.clone()), Some(argv)) {
                Ok(terminal_id) => {
                    // Fix 3: lazily insert the sessions row on first terminal activity
                    // (same as on first chat.send). INSERT OR IGNORE is a no-op if the
                    // row already exists.
                    let _ = state.app.db.create_session(&attach.session_id, &runtime_cwd);
                    // Phase 6: remember this is a CLI-attached (agentAttach)
                    // terminal so the on_data/on_exit closures and
                    // TerminalInput below can do blocked-state bookkeeping.
                    state
                        .terminal_agent_sessions
                        .lock()
                        .unwrap()
                        .insert(terminal_id.clone(), attach.session_id.clone());
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
            // Phase 6: user input to a CLI-attached terminal is treated as an
            // answer to whatever prompt it was showing — clear blocked state
            // (if set) so the dot flips back before the next poll/output.
            if let Some(session_id) = state.terminal_agent_sessions.lock().unwrap().get(&terminal_id).cloned() {
                let was_blocked = state.app.blocked_sessions.lock().unwrap().remove(&session_id);
                if was_blocked {
                    notify_session_updated(&state.app, &session_id);
                }
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

        ClientMessage::TerminalKill { terminal_id } => {
            // Route remote terminals through the hub.
            if let Some(host_id) = state.app.hub.route_for_terminal(&terminal_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            // Best-effort: clear any blocked-state bookkeeping tied to this
            // terminal up front. `on_exit` (fired once the killed process
            // actually dies) does this too, but doing it here as well means a
            // fast follow-up session.delete doesn't race a still-in-flight
            // kill.
            if let Some(session_id) = state.terminal_agent_sessions.lock().unwrap().remove(&terminal_id) {
                let was_blocked = state.app.blocked_sessions.lock().unwrap().remove(&session_id);
                if was_blocked {
                    notify_session_updated(&state.app, &session_id);
                }
            }
            state.terminals.kill(&terminal_id);
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
                theme: patch.theme,
                sound_enabled: patch.sound_enabled,
                toast_delivery: patch.toast_delivery,
                chat_mode: patch.chat_mode,
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

        // Fix 4: Archive / unarchive a session.
        ClientMessage::SessionArchive { session_id, archived } => {
            // Route remote sessions through the hub.
            if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            match state.app.db.set_archived(&session_id, archived) {
                Ok(()) => {
                    // Broadcast a session.updated so all tabs update immediately.
                    notify_session_updated(&state.app, &session_id);
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("session.archive failed: {e}"),
                    });
                }
            }
        }

        // Permanently delete a session: cancel any in-flight turn, kill any
        // CLI-attached terminal, drop it from every in-memory bookkeeping
        // structure, delete its DB rows, then fan the deletion out to every
        // connection (not just this one — there is no DB row left for the
        // usual session.updated broadcast path to look up).
        ClientMessage::SessionDelete { session_id } => {
            // Route remote sessions through the hub.
            if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }

            // Cancel any in-flight turn and drop this connection's runtime
            // for the session (claude_runner, pending_turn, etc.).
            if let Some(runtime) = state.runtimes.lock().unwrap().remove(&session_id) {
                if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
                    runner.cancel();
                }
                // Direct-mode session: kill the detached remote turn and the
                // remote CLI-mode tmux session too, or they would outlive the
                // session they belong to — which is exactly the property that
                // makes detached mode useful, and exactly the wrong one here.
                if runtime.host_id != "local" {
                    state.app.detached.cancel(&session_id);
                    if let Some(host) = direct_host(state, &runtime.host_id) {
                        let sid = session_id.clone();
                        tokio::spawn(async move {
                            crate::detached::kill_cli_session(&host.ssh_host, &sid).await;
                        });
                    }
                }
            }

            // Kill any CLI-attached (agentAttach) terminal(s) for this
            // session on this connection — a dangling `claude --resume`
            // process would otherwise keep running (and fighting a future
            // fresh attach) after the session it belongs to is gone.
            let attached_terminal_ids: Vec<String> = {
                let map = state.terminal_agent_sessions.lock().unwrap();
                map.iter()
                    .filter(|(_, sid)| **sid == session_id)
                    .map(|(tid, _)| tid.clone())
                    .collect()
            };
            for terminal_id in attached_terminal_ids {
                state.terminal_agent_sessions.lock().unwrap().remove(&terminal_id);
                state.terminals.kill(&terminal_id);
            }

            // Drop every other piece of in-memory bookkeeping keyed by this
            // session id.
            state.app.registry.remove(&session_id);
            state.app.running_sessions.lock().unwrap().remove(&session_id);
            state.app.unseen_sessions.lock().unwrap().remove(&session_id);
            state.app.blocked_sessions.lock().unwrap().remove(&session_id);
            state.app.session_viewers.lock().unwrap().remove(&session_id);
            if state.active_session_id.lock().unwrap().as_deref() == Some(session_id.as_str()) {
                *state.active_session_id.lock().unwrap() = None;
            }

            match state.app.db.delete_session(&session_id) {
                Ok(()) => {
                    // Fan out to every connection (this one included) via the
                    // same broadcast channel hosts.upsert/delete use, since
                    // the row a normal session.updated event looks up is gone.
                    let _ = state.app.hub.hub_events_tx.send(Arc::new(ServerMessage::SessionDeleted {
                        session_id: session_id.clone(),
                    }));
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("session.delete failed: {e}"),
                    });
                }
            }
        }

        // Phase 3: Workspace → Tab → Pane model — per-session dockview layout
        // persistence. The layout blob is opaque JSON; the server only stores
        // and echoes it.
        ClientMessage::SessionLayoutGet { session_id } => {
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
            let _ = state.out_tx.send(ServerMessage::SessionLayout { session_id, layout });
        }

        ClientMessage::SessionLayoutSet { session_id, layout } => {
            // Route remote sessions through the hub — fire-and-forget, same
            // as session.archive (no reply is expected by the caller).
            if let Some(host_id) = state.app.hub.route_for_session(&session_id) {
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            // A layout can be saved for a brand-new session before its first
            // chat message (Fix 3 defers the `sessions` row insert until then)
            // — materialize the row here too so the UPDATE below isn't a
            // silent no-op. INSERT OR IGNORE, same as chat.send's lazy insert.
            if let Some(cwd) = state.runtimes.lock().unwrap().get(&session_id).map(|r| r.cwd.clone()) {
                let _ = state.app.db.create_session(&session_id, &cwd);
            }
            let layout_str = serde_json::to_string(&layout).unwrap_or_default();
            if let Err(e) = state.app.db.set_session_layout(&session_id, &layout_str) {
                let _ = state.out_tx.send(ServerMessage::Error {
                    message: format!("session.layout.set failed: {e}"),
                });
            }
        }

        // User-set title override (item 2: session rename). Persists across
        // the auto-title-from-first-message logic — see db.rs::list_sessions.
        ClientMessage::SessionRename { session_id, title } => {
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
                    });
                }
            }
        }

        // Item 1: directory browser for new-session cwd picker.
        ClientMessage::FsBrowse { request_id, host_id, path } => {
            let target = host_id.as_deref().unwrap_or("local");
            if target != "local" && !target.is_empty() {
                // Direct-mode host: no perch to forward to — list over ssh.
                // Bounded and on a spawned task, so a slow devpod can't block
                // this connection's message loop.
                if let Some(host) = direct_host(state, target) {
                    let out_tx = state.out_tx.clone();
                    let target = target.to_string();
                    tokio::spawn(async move {
                        match crate::detached::browse_remote(&host.ssh_host, path.as_deref(), 30).await {
                            Ok((resolved, parent, home, entries)) => {
                                let _ = out_tx.send(ServerMessage::FsBrowseResult {
                                    request_id,
                                    host_id: target,
                                    path: resolved,
                                    parent,
                                    home,
                                    entries,
                                });
                            }
                            Err(e) => {
                                let _ = out_tx.send(ServerMessage::Error {
                                    message: format!("browse failed on {target}: {e}"),
                                });
                            }
                        }
                    });
                    return;
                }
                state.app.hub.register_unicast(
                    PendingKey::Browse(request_id.clone()),
                    state.conn_id.clone(),
                    state.out_tx.clone(),
                );
                state.app.hub.forward(target, &strip_host_id(raw_text));
                return;
            }
            let home = std::env::var("HOME").unwrap_or_default();
            let requested = path.unwrap_or_else(|| home.clone());
            let expanded = if requested == "~" || requested.starts_with("~/") {
                if requested == "~" {
                    home.clone()
                } else {
                    format!("{home}{}", &requested[1..])
                }
            } else {
                requested
            };
            // Never hard-fail: fall back to home on any invalid/inaccessible
            // path so the browser always has something to show.
            let resolved = if std::path::Path::new(&expanded).is_dir() {
                expanded
            } else {
                home.clone()
            };
            let resolved_path = std::path::Path::new(&resolved);
            let parent = resolved_path
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
                .map(|p| p.to_string_lossy().to_string());
            let mut entries: Vec<FsEntry> = Vec::new();
            if let Ok(read_dir) = std::fs::read_dir(resolved_path) {
                for entry in read_dir.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with('.') {
                        continue; // skip hidden dotdirs
                    }
                    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    if !is_dir {
                        continue;
                    }
                    let full_path = entry.path();
                    let is_git_repo = full_path.join(".git").exists();
                    entries.push(FsEntry {
                        name,
                        path: full_path.to_string_lossy().to_string(),
                        is_git_repo,
                    });
                }
            }
            entries.sort_by(|a, b| a.name.cmp(&b.name));
            let _ = state.out_tx.send(ServerMessage::FsBrowseResult {
                request_id,
                host_id: "local".to_string(),
                path: resolved,
                parent,
                home,
                entries,
            });
        }

        // -------------------------------------------------------------------
        // Wave 2: git worktree management (ported from herdr — see
        // `worktree.rs` for the git plumbing and the herdr provenance).
        //
        // All three arms share the same shape:
        //   1. hub-route to the owning host when `hostId` is non-local,
        //      registering a single-shot `PendingKey::Worktree(requestId)`
        //      slot so the reply comes back to *this* connection only;
        //   2. otherwise run the (async, timeout-bounded) git operation on a
        //      spawned task so the connection's message loop never blocks on
        //      a subprocess;
        //   3. reply with exactly one message — `worktree.list.result` /
        //      `worktree.done` / `worktree.error` — always echoing requestId.
        // -------------------------------------------------------------------
        ClientMessage::WorktreeList { request_id, host_id, repo_path } => {
            if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            let out_tx = state.out_tx.clone();
            tokio::spawn(async move {
                match crate::worktree::list(&repo_path).await {
                    Ok(listing) => {
                        let _ = out_tx.send(ServerMessage::WorktreeListResult {
                            request_id,
                            host_id: "local".to_string(),
                            repo_path,
                            default_root: listing.default_root,
                            worktrees: listing
                                .worktrees
                                .into_iter()
                                .map(|w| WorktreeEntry {
                                    path: w.path,
                                    branch: w.branch,
                                    head: w.head,
                                    is_primary: w.is_primary,
                                    is_dirty: w.is_dirty,
                                })
                                .collect(),
                        });
                    }
                    Err(message) => {
                        let _ = out_tx.send(ServerMessage::WorktreeError {
                            request_id,
                            host_id: "local".to_string(),
                            message,
                            dirty: false,
                        });
                    }
                }
            });
        }

        ClientMessage::WorktreeCreate {
            request_id,
            host_id,
            repo_path,
            branch,
            new_branch,
            path,
        } => {
            if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            let out_tx = state.out_tx.clone();
            tokio::spawn(async move {
                let result =
                    crate::worktree::create(&repo_path, &branch, new_branch, path.as_deref()).await;
                let _ = out_tx.send(match result {
                    Ok(created) => ServerMessage::WorktreeDone {
                        request_id,
                        host_id: "local".to_string(),
                        action: "create".to_string(),
                        path: created,
                    },
                    Err(err) => ServerMessage::WorktreeError {
                        request_id,
                        host_id: "local".to_string(),
                        message: err.message,
                        dirty: err.dirty,
                    },
                });
            });
        }

        ClientMessage::WorktreeRemove {
            request_id,
            host_id,
            repo_path,
            path,
            force,
        } => {
            if route_worktree_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            let out_tx = state.out_tx.clone();
            tokio::spawn(async move {
                let result = crate::worktree::remove(&repo_path, &path, force).await;
                let _ = out_tx.send(match result {
                    Ok(()) => ServerMessage::WorktreeDone {
                        request_id,
                        host_id: "local".to_string(),
                        action: "remove".to_string(),
                        path,
                    },
                    Err(err) => ServerMessage::WorktreeError {
                        request_id,
                        host_id: "local".to_string(),
                        message: err.message,
                        dirty: err.dirty,
                    },
                });
            });
        }
    }
}

/// Look up a configured host and return it only if it is a `mode: "direct"`
/// host. Every direct-mode branch in `handle_message` funnels through this, so
/// a host whose mode is `"perch"` (or that has been deleted) always falls
/// through to the pre-existing hub path unchanged.
fn direct_host(state: &Arc<ConnState>, host_id: &str) -> Option<crate::hosts::SshHost> {
    state
        .app
        .hosts
        .get(host_id)
        .filter(|h| h.is_direct() && !h.ssh_host.is_empty())
}

/// Create a session that lives in *this* DB but runs on a direct host.
///
/// Deliberately does **not** validate the cwd: doing so would cost an ssh
/// round trip on the message loop for every new session, and the cwd is
/// already chosen from the remote directory browser (`fs.browse` over ssh).
/// A bad path fails on the first turn with the remote shell's own message.
fn create_direct_session(state: &Arc<ConnState>, host: &crate::hosts::SshHost, cwd: Option<String>) {
    let Some(cwd) = cwd.filter(|c| !c.trim().is_empty()) else {
        let _ = state.out_tx.send(ServerMessage::Error {
            message: format!("pick a directory on {} to start a session there", host.name),
        });
        return;
    };
    let session_id = Uuid::new_v4().to_string();
    state.app.registry.create(&session_id, &cwd);
    insert_runtime_on_host(state, &session_id, &cwd, &host.id, None, None, None);
    set_active_session(state, &session_id);
    let _ = state.out_tx.send(ServerMessage::SessionCreated {
        session_id: session_id.clone(),
    });
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

/// Strip the `hostId` field from a raw client-message JSON before forwarding
/// it to the owning remote, so the remote handles the request *locally*
/// instead of trying to route it onward to a host id it has never heard of.
/// Same reasoning as the hand-built forward JSON in the `SessionCreate` arm,
/// generalized so any request-correlated `hostId`-carrying message can reuse
/// it (`fs.browse`, `worktree.*`).
fn strip_host_id(raw_text: &str) -> String {
    match serde_json::from_str::<serde_json::Value>(raw_text) {
        Ok(serde_json::Value::Object(mut map)) => {
            map.remove("hostId");
            serde_json::to_string(&serde_json::Value::Object(map))
                .unwrap_or_else(|_| raw_text.to_string())
        }
        _ => raw_text.to_string(),
    }
}

/// Hub-routing preamble shared by the request-correlated `worktree.*` family.
/// Registers a single-shot unicast slot keyed by `requestId` (so the remote's
/// one reply reaches only the connection that asked) and forwards the
/// host-stripped request. Returns `true` when the message was routed — the
/// caller must return immediately in that case.
fn route_worktree_request(
    state: &Arc<ConnState>,
    host_id: Option<&str>,
    request_id: &str,
    raw_text: &str,
) -> bool {
    let target = host_id.unwrap_or("local");
    if target == "local" || target.is_empty() {
        return false;
    }
    state.app.hub.register_unicast(
        PendingKey::Worktree(request_id.to_string()),
        state.conn_id.clone(),
        state.out_tx.clone(),
    );
    state.app.hub.forward(target, &strip_host_id(raw_text));
    true
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
            // Turn complete — mark idle, mark unseen if no one is watching
            // (herdr's `done` state), and broadcast to all connections.
            state.app.running_sessions.lock().unwrap().remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
            notify_session_updated(&state.app, session_id);
        }
        AgentEvent::Error(message) => {
            // Error also ends the turn — ensure running status can't get stuck.
            state.app.running_sessions.lock().unwrap().remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
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
        theme: s.theme.clone(),
        sound_enabled: s.sound_enabled,
        toast_delivery: s.toast_delivery.clone(),
        chat_mode: s.chat_mode.clone(),
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
        mode: h.mode,
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
        // An unrecognised value from a client degrades to `"perch"` rather
        // than being stored verbatim, so a typo can't leave a host in a mode
        // nothing handles (see `hosts::HostMode`).
        mode: if h.mode == "direct" { h.mode } else { "perch".to_string() },
        direct_url: h.direct_url,
        remote_cmd: h.remote_cmd,
    }
}

// ---------------------------------------------------------------------------
// Phase 6: CLI-attached terminal blocked-state (approval-prompt) detection
// ---------------------------------------------------------------------------

/// Strips ANSI escape sequences from `input` so `blocked_patterns` can match
/// on plain text regardless of the CLI's cursor movement / color codes.
///
/// CSI sequences (cursor moves, colors) and short two-byte escapes carry no
/// text signal, so they're deleted outright. OSC sequences are handled
/// differently: their *payload* (e.g. a window-title string) can carry real
/// signal — Codex flips its title to "Action Required" while waiting on
/// approval — so only the `ESC ] ... BEL/ST` framing is stripped and the
/// payload text is kept, appearing in the tail as plain text.
fn strip_ansi(input: &str) -> String {
    static OSC_RE: OnceLock<Regex> = OnceLock::new();
    static REST_RE: OnceLock<Regex> = OnceLock::new();
    let osc_re = OSC_RE.get_or_init(|| {
        Regex::new(r"\x1b\]([^\x07\x1b]*)(?:\x07|\x1b\\)")
            .expect("static ANSI OSC-strip regex must compile")
    });
    let rest_re = REST_RE.get_or_init(|| {
        Regex::new(r"\x1b(?:\[[0-9;?]*[ -/]*[@-~]|[@-Z\\-_])")
            .expect("static ANSI-strip regex must compile")
    });
    let payload_kept = osc_re.replace_all(input, "$1");
    rest_re.replace_all(&payload_kept, "").into_owned()
}

/// Appends `data` (ANSI-stripped) to `tail`, capping it at a few KB so
/// blocked-state matching stays cheap and unbounded PTY chatter can't grow
/// the buffer forever. Only the trailing bytes matter for prompt detection.
fn append_tail(tail: &mut String, data: &str) {
    tail.push_str(&strip_ansi(data));
    const MAX_TAIL: usize = 4096;
    if tail.len() > MAX_TAIL {
        let cutoff = tail.len() - MAX_TAIL;
        let start = (cutoff..=tail.len()).find(|&i| tail.is_char_boundary(i)).unwrap_or(0);
        tail.drain(..start);
    }
}

/// Approval-prompt detection patterns for CLI-attached terminals (Phase 6,
/// "keep simple" per the herdr-parity plan). Adapted down from herdr's much
/// larger per-agent manifests (`detect/manifests/{claude,codex}.toml`, which
/// use dozens of `contains`/`line_regex` rules per agent) into a handful of
/// substring/regex checks run case-insensitively against the terminal's
/// recent ANSI-stripped output tail (`append_tail`):
///
/// 1. Claude's bash/tool permission prompt: "Do you want to proceed?"
///    followed by a numbered/arrow-highlighted "Yes" option.
/// 2. Claude's older/generic "Do you want to…" / "Would you like to…" prompts
///    with a "yes" option or `❯` selection cursor nearby (herdr's
///    `legacy_no_prompt_blocker` fallback).
/// 3. Codex's exec-approval prompt ("Allow command?"), its OSC-title
///    "Action Required" flag, or its enter-to-confirm footer.
///
/// Not exhaustive — herdr's manifests cover many more edge cases (MCP tool
/// prompts, plan-mode confirmations, etc.) that were deliberately left out to
/// keep this a "2-3 regex" detector rather than a full rule engine.
fn blocked_patterns() -> &'static [Regex] {
    static PATTERNS: OnceLock<Vec<Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        vec![
            Regex::new(r"(?is)do you want to proceed\?.{0,400}(?:\byes\b|❯)")
                .expect("static blocked-pattern regex must compile"),
            Regex::new(r"(?is)(?:do you want to|would you like to)\b.{0,200}(?:\byes\b|❯)")
                .expect("static blocked-pattern regex must compile"),
            Regex::new(r"(?i)allow command\?|action required|press enter to confirm or esc to cancel")
                .expect("static blocked-pattern regex must compile"),
        ]
    })
}

// ---------------------------------------------------------------------------
// Manual verification: blocked_patterns/strip_ansi against realistic,
// ANSI-laden approval-prompt output. These are the samples used to hand-check
// the regexes chosen above (no e2e spec triggers a real CLI approval prompt —
// too flaky/slow to script reliably — so this unit test is the documented
// verification method; see the Phase 6 final report).
// ---------------------------------------------------------------------------
#[cfg(test)]
mod blocked_pattern_tests {
    use super::*;

    fn matches_any(tail: &str) -> bool {
        blocked_patterns().iter().any(|re| re.is_match(tail))
    }

    /// Claude's real bash-tool permission box: a boxed prompt drawn with
    /// cursor-position/color ANSI codes, "Do you want to proceed?" followed by
    /// a `❯ 1. Yes` / `2. No` menu — adapted from herdr's
    /// `bash_permission_prompt` / `generic_permission_prompt` rules.
    #[test]
    fn claude_bash_permission_prompt_is_blocked() {
        let raw = "\x1b[2K\x1b[1A\x1b[2K\r\x1b[36mBash command\x1b[0m\r\n\
            \x1b[1mDo you want to proceed?\x1b[0m\r\n\
            \x1b[32m❯ 1. Yes\x1b[0m\r\n\
            \x1b[90m  2. No, and tell Claude what to do differently\x1b[0m\r\n\
            \x1b[2m(esc to cancel)\x1b[0m\r\n";
        let tail = strip_ansi(raw);
        assert!(!tail.contains('\x1b'), "ANSI codes must be stripped: {tail:?}");
        assert!(matches_any(&tail), "expected a match on: {tail:?}");
    }

    /// Claude's older/generic "Do you want to make this edit…" prompt, no
    /// boxed menu — adapted from herdr's `legacy_no_prompt_blocker` fallback.
    #[test]
    fn claude_legacy_edit_prompt_is_blocked() {
        let raw = "\x1b[1mDo you want to make this edit to main.rs?\x1b[0m\r\n\
            \x1b[32m❯ Yes\x1b[0m\r\n  No\r\n";
        let tail = strip_ansi(raw);
        assert!(matches_any(&tail), "expected a match on: {tail:?}");
    }

    /// Codex's exec-approval prompt — adapted from herdr's `live_strong_blocker`.
    #[test]
    fn codex_allow_command_prompt_is_blocked() {
        let raw = "\x1b[1mAllow command?\x1b[0m\r\n  $ rm -rf build/\r\n\
            \x1b[2mpress enter to confirm or esc to cancel\x1b[0m\r\n";
        let tail = strip_ansi(raw);
        assert!(matches_any(&tail), "expected a match on: {tail:?}");
    }

    /// Codex's OSC window-title flag ("Action Required") — a title-bar signal
    /// rather than visible transcript text, but perch scans raw PTY output
    /// (which includes the OSC sequence's payload once ANSI-stripped) so this
    /// still lands in the tail buffer verbatim.
    #[test]
    fn codex_action_required_osc_title_is_blocked() {
        let raw = "\x1b]0;Action Required\x07\r\nWaiting on your input…\r\n";
        let tail = strip_ansi(raw);
        assert!(matches_any(&tail), "expected a match on: {tail:?}");
    }

    /// Ordinary streaming output (no prompt) must never match — otherwise
    /// every session would flip to "blocked" spuriously.
    #[test]
    fn ordinary_output_is_not_blocked() {
        let raw = "\x1b[32mRunning tests...\x1b[0m\r\n\
            \x1b[1m3 passed, 0 failed\x1b[0m\r\n\
            Do you want a summary? Not really a prompt, just chatter about it.\r\n";
        let tail = strip_ansi(raw);
        assert!(!matches_any(&tail), "did not expect a match on: {tail:?}");
    }

    /// `append_tail` must cap growth and never panic on a UTF-8 boundary
    /// while trimming (multi-byte glyphs like ❯/⠋ are common in this output).
    #[test]
    fn append_tail_caps_length_without_panicking() {
        let mut tail = String::new();
        for _ in 0..2000 {
            append_tail(&mut tail, "chunk-❯-chunk ");
        }
        assert!(tail.len() <= 4096 + "chunk-❯-chunk ".len());
    }
}
