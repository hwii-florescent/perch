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

use std::collections::hash_map::Entry;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicU64;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse};
use axum::routing::{get, post};
use axum::Router;
use futures::{SinkExt, StreamExt};
use regex::Regex;
use sha2::{Digest, Sha256};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tower_http::services::{ServeDir, ServeFile};
use uuid::Uuid;

use crate::agent::{
    AgentEvent, AgentRunner, ClaudeRunner, ClaudeRunnerOptions, CodexRunner, CodexRunnerOptions,
};
use crate::agent_fleet::{
    now_millis, AgentKey, AgentLifecycleRegistry, AgentMode, ClientIdentity, ClientKind,
    ControlChannel,
};
use crate::agent_persistence::{AgentPersistence, EffectiveModeScope};
use crate::agent_runtime::AgentRuntimeAdapter;
use crate::cli_title::CliTitleBuffer;
use crate::db::{
    FileBufferError, FileBufferMetadataRow, FileBufferObservation, FileBufferRow, FileBufferUpdate,
    FileSaveCompletion, FileSaveIntentRow, HistoryDb, ReviewDeleteResult, ReviewUpdateResult,
    MAX_FILE_BUFFERS_PER_WORKSPACE, MAX_FILE_BUFFER_BYTES, MAX_FILE_BUFFER_WATCHES,
};
use crate::detached::{DetachedManager, FinishedTurn, TurnRequest, TurnSink};
use crate::filesystem::{FileService, FsError, WriteResult};
use crate::hosts::HostsStore;
use crate::hub::{HubManager, PendingKey};
use crate::iterm_profile::TerminalProfile;
use crate::models::{self, ModelLists};
use crate::protocol::{
    AgentKind, ChatUsage, ClientMessage, CustomModelsData, FileBuffer, FileBufferSummary, FsEntry,
    ProjectSummary, ServerMessage, SessionMode as WireSessionMode, SessionModeScope, SessionStatus,
    SessionSummary, SettingsData, SshHostEntry, WorkspaceState, WorkspaceSummary, WorktreeEntry,
    PROTOCOL_VERSION,
};
use crate::registry::SessionRegistry;
use crate::review::{self, ReviewCommentDraft, ReviewSide};
use crate::settings::SettingsStore;
use crate::source_control::{
    self, ActionConfirmation, CommitRequest, DiffOptions, DiscardMode, GitConfig, GitError,
    GitService, WorkspaceTarget,
};
use crate::status::{get_server_info, get_status, LastUsage};
use crate::terminal::{
    AgentTerminalRegistry, AttachOutcome, TerminalManager, AGENT_QUIET_THRESHOLD,
};

mod config;
use config::{host_to_wire, settings_to_wire};
mod git;
use git::{git_error_response, resolve_git_target_or_fail};
mod reviews;
#[cfg(test)]
use reviews::settle_review_packet_from_db;
mod fs;
use fs::{filesystem_operation_lock, workspace_file_service};
mod workspace;
#[cfg(test)]
use workspace::effective_focus;
mod agent_history;
mod agents;
mod native_ui;
use agents::{connection_client_identity, lifecycle_status_to_wire};
mod terminal;
#[cfg(test)]
use terminal::claude_conversation_exists_in;
mod session;
use session::{
    agent_str, build_session_summary, local_sessions_snapshot, mark_unseen_if_unviewed,
    settle_prompt_dispatch, should_forward_to_viewer, status_message,
};
mod dispatch;
use dispatch::handle_message;

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
    /// Optional provider manifest file; defaults to ~/.perch/providers.json.
    pub providers_path: Option<PathBuf>,
    /// Override the devices.json path (default: `~/.perch/devices.json`).
    /// Can also be set via `PERCH_DEVICES`. Tests need it for the same reason
    /// they need `--hosts-path`: pairing must not touch the real machine.
    pub devices_path: Option<PathBuf>,
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
            providers_path: std::env::var_os("PERCH_PROVIDERS").map(PathBuf::from),
            devices_path: std::env::var_os("PERCH_DEVICES").map(PathBuf::from),
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
                "--providers-path" => {
                    i += 1;
                    if let Some(value) = argv.get(i) {
                        args.providers_path = Some(PathBuf::from(value));
                    }
                }
                "--hosts-path" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.hosts_path = Some(PathBuf::from(v));
                    }
                }
                "--devices-path" => {
                    i += 1;
                    if let Some(v) = argv.get(i) {
                        args.devices_path = Some(PathBuf::from(v));
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
    /// Override devices.json path (from `--devices-path` / `PERCH_DEVICES`).
    pub devices_path: Option<PathBuf>,
    /// Optional provider manifest file; defaults to ~/.perch/providers.json.
    pub providers_path: Option<PathBuf>,
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
    /// Running/blocked sessions silent for 30 minutes (`stale_sessions`).
    /// Recomputed every second by `spawn_agent_lifecycle_task`.
    stale_sessions: Arc<Mutex<HashSet<String>>>,
    /// Local session ids already `mark_cli_activity`'d in the DB this process
    /// lifetime — dedupes the DB write + `notify_session_updated` so a
    /// CLI-attached terminal's `terminal.input` (fires on every keystroke)
    /// only pays for either once per session, on the first keystroke. Never
    /// needs eviction: a session id is stable for the DB's lifetime and this
    /// set only ever mirrors "is `cli_activity` already 1", which is also
    /// monotonic (`mark_cli_activity` never unsets it), so the set can never
    /// go stale relative to the DB.
    cli_active_sessions: Arc<Mutex<HashSet<String>>>,
    /// Pending first-prompt reconstruction for CLI-attached sessions — see
    /// `cli_title.rs` and `maybe_capture_cli_title`, which documents what the
    /// three states (vacant / `Some` / `None`) mean. Keyed by session id;
    /// `None` is the settled state, so an established session's keystrokes
    /// cost exactly one map lookup.
    cli_title_buffers: Arc<Mutex<HashMap<String, Option<CliTitleBuffer>>>>,
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
    /// The user's terminal appearance, read once at startup so CLI panes can
    /// match their real terminal instead of perch's UI theme. `None` when
    /// unavailable — see `iterm_profile.rs`.
    terminal_profile: Option<TerminalProfile>,
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
    /// Number of currently-open WS connections, incremented/decremented in
    /// `handle_socket`. Lets `spawn_git_poll_task` skip its per-tick work
    /// (a `list_sessions()` call plus one `git` subprocess per distinct cwd)
    /// when nobody is around to see the result.
    connected_clients: Arc<std::sync::atomic::AtomicUsize>,
    /// Woken by `handle_socket` on every new connection so the git-poll task
    /// runs a prompt pass instead of waiting up to 5s for cold/stale data —
    /// see `spawn_git_poll_task`.
    git_poll_notify: Arc<tokio::sync::Notify>,
    /// Local agent-attached (CLI-mode) terminals, one PTY per session id
    /// shared across every viewing connection — see `AgentTerminalRegistry`'s
    /// doc comment. Lives in `AppState` (not `ConnState`) on purpose: it must
    /// outlive any single WS connection so a second tab/device can find and
    /// share what the first one started, exactly like `running_sessions`.
    agent_terminals: Arc<AgentTerminalRegistry>,
    /// Paired phones/devices and the live pairing code. perch binds
    /// `0.0.0.0`, so anything off the loopback interface must present a token
    /// this store issued — see `authorize_request`.
    devices: Arc<crate::devices::DeviceStore>,
    workspace_terminals: Arc<crate::workspace_terminals::WorkspaceTerminals>,
    /// Process-wide provider/lifecycle bridge used by local CLI attaches.
    /// Keeping this beside the shared terminal registry prevents a second WS
    /// connection from launching a duplicate provider for the same session.
    agent_runtime: Arc<AgentRuntimeAdapter>,
    native_ui: Arc<crate::native_ui::NativeUiRegistry>,
    // ponytail: lifecycle mutations serialize across local sessions; shard by
    // session if measured contention warrants it, preserving lock ordering.
    agent_operation_lock: Arc<Mutex<()>>,
    /// Durable lifecycle/provider identity and mode policy, backed by the same
    /// HistoryDb connection as sessions and messages.
    agent_persistence: Arc<AgentPersistence<Arc<HistoryDb>>>,
    /// Mode and its monotonic persisted revision for each restored agent.
    agent_modes: Arc<Mutex<HashMap<AgentKey, (AgentMode, u64)>>>,
    /// UUID for this process lifetime. Reconnects from a previous process
    /// cannot be mistaken for newer snapshots when their revisions overlap.
    snapshot_epoch: String,
    /// Monotonic metadata revision within `snapshot_epoch`.
    snapshot_revision: Arc<AtomicU64>,
    /// Serializes durable project/workspace mutations with their revision
    /// allocation and publication.  A single process-wide lock is required
    /// here because the SQLite mutex alone cannot keep a list/snapshot from
    /// observing a mutation between its DB reads and its revision number.
    foundation_lock: Arc<Mutex<()>>,
    /// One retained-descriptor service per durable workspace. The service
    /// contains only bounded limits and an open root handle; it never caches
    /// file contents. Keeping it in `AppState` prevents a root pathname swap
    /// between two requests from re-authorizing a different directory.
    filesystem_services: Arc<Mutex<HashMap<String, FileService>>>,
    /// Bounded per-workspace/path operation locks. Buffer edits, save intents,
    /// filesystem publication, and watcher observations for one file share a
    /// lock, while unrelated files remain responsive during slow I/O.
    filesystem_operation_locks: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
    /// Overflow lock used only after the bounded operation-lock table is full.
    filesystem_operation_overflow: Arc<Mutex<()>>,
    /// Shared bounded Git facade. Workspace roots are resolved per request
    /// from durable DB rows before this service is called.
    git: Arc<GitService>,
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
            self.app
                .running_sessions
                .lock()
                .unwrap()
                .insert(session_id.to_string());
        } else {
            self.app.running_sessions.lock().unwrap().remove(session_id);
            mark_unseen_if_unviewed(&self.app, session_id);
        }
        notify_session_updated(&self.app, session_id);
    }

    fn persist_turn(&self, session_id: &str, turn: FinishedTurn) {
        if !(turn.text.is_empty() && turn.thinking.is_empty()) {
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
        // A detached process can be spawned successfully while the provider
        // binary, credentials, or prompt launch fails. Settle the durable
        // operation from actual parsed provider progress, and preserve an
        // ambiguous launch as unconfirmed so a retry cannot duplicate it.
        if let Some(operation_id) = turn.operation_id.as_deref() {
            let outcome = if turn.accepted {
                "delivered"
            } else {
                "unconfirmed"
            };
            if let Err(error) = settle_prompt_dispatch(&self.app, operation_id, outcome) {
                tracing::error!(
                    session_id,
                    operation_id,
                    error = %error,
                    "failed to persist detached prompt dispatch outcome"
                );
                self.emit(
                    session_id,
                    ServerMessage::Error {
                        message: format!(
                            "prompt operation {operation_id} could not be settled: {error}"
                        ),
                        request_id: None,
                        code: Some("prompt_dispatch_persistence_failed".to_string()),
                        retryable: false,
                    },
                );
            }
        }
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
    let upload_path = format!("{base_path}upload");

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

    // Read the user's terminal appearance once (best-effort, see
    // `iterm_profile.rs`) so CLI panes render in their colours and font.
    let terminal_profile = crate::terminal_profile::load();
    match &terminal_profile {
        Some(p) => tracing::info!(
            "[perch] terminal profile: font {:?} {:?}, {} colour(s)",
            p.font_family,
            p.font_size,
            p.theme.len(),
        ),
        None => tracing::info!("[perch] no terminal profile found; using xterm defaults"),
    }

    // Load settings store.
    let settings = Arc::new(SettingsStore::load_default());
    tracing::info!(
        "[perch] settings loaded from {:?}",
        crate::settings::default_settings_path()
    );

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

    // Task 2: agent-attached (CLI-mode) terminals report PTY activity here.
    // Built with plain `Arc` clones (not the whole `AppState`, which doesn't
    // exist yet) — same deferred-wire-up shape as `DetachedSink` below, just
    // inline because the callback only needs two fields, not the full turn
    // sink interface.
    let running_sessions: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
    let agent_activity_running = running_sessions.clone();
    let agent_activity_events_tx = session_events_tx.clone();
    // This callback is the *only* place a CLI-origin turn is seen going
    // running, and it fires from a pty reader thread before `AppState`
    // exists — hence the same deferred wire-up `DetachedSink` uses, filled in
    // right after the state is built.
    let agent_activity_app: Arc<std::sync::OnceLock<AppState>> =
        Arc::new(std::sync::OnceLock::new());
    let agent_activity_state = agent_activity_app.clone();
    let mark_session_running: Arc<dyn Fn(&str) + Send + Sync> = Arc::new({
        let agent_activity_running = agent_activity_running.clone();
        let agent_activity_events_tx = agent_activity_events_tx.clone();
        let agent_activity_state = agent_activity_state.clone();
        move |session_id: &str| {
            if agent_activity_state
                .get()
                .is_some_and(|app| app.agent_runtime.has_native_status(session_id))
            {
                return;
            }
            // Only notify on the actual idle->running transition — PTY
            // output fires this on every read, often many times a second
            // under a repainting TUI, and re-broadcasting on every one of
            // those would be pure waste once the session is already marked
            // running.
            let became_running = agent_activity_running
                .lock()
                .unwrap()
                .insert(session_id.to_string());
            if became_running {
                if let Some(app) = agent_activity_state.get() {
                    agent_history::observe_session(app, session_id);
                }
                let _ = agent_activity_events_tx.send(SessionUpdatedEvent {
                    session_id: session_id.to_string(),
                });
            }
        }
    });
    let agent_terminals = Arc::new(AgentTerminalRegistry::new({
        let mark_session_running = mark_session_running.clone();
        Arc::new(move |session_id: &str| mark_session_running(session_id))
    }));

    // Agent lifecycle rows share the existing HistoryDb connection.  Restore
    // durable provider identities before accepting clients; transient process
    // states are converted to Reconnecting by the persistence facade and the
    // runtime adapter will only launch an explicit provider continuation when
    // a client attaches.
    let agent_persistence = Arc::new(AgentPersistence::new(db.clone()));
    agent_persistence.ensure_schema()?;
    let restored_agents = agent_persistence.load_snapshots(now_millis())?;
    let agent_modes = restored_agents
        .iter()
        .map(|record| {
            (
                record.snapshot.key.clone(),
                (record.mode, record.mode_revision),
            )
        })
        .collect::<HashMap<_, _>>();
    let agent_lifecycle = Arc::new(AgentLifecycleRegistry::restore(
        restored_agents.iter().map(|record| record.snapshot.clone()),
        now_millis(),
    )?);
    // Validate the built-in provider recipes before the server accepts any
    // clients.  This is fallible on purpose: a malformed mode-specific
    // recipe must fail boot with context rather than panic from a registry
    // constructor after other startup work has begun.
    let provider_registry =
        crate::provider_config::load_registry(options.providers_path.as_deref())?;
    // Managed providers publish lifecycle transitions; terminal repaints must
    // not create a second, conflicting source of turn completion.
    let runtime_terminals = Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {})));
    let agent_runtime = Arc::new(AgentRuntimeAdapter::new(
        Arc::new(provider_registry),
        agent_lifecycle.clone(),
        runtime_terminals.clone(),
    ));

    let workspace_terminals = Arc::new(crate::workspace_terminals::WorkspaceTerminals::new(
        db.clone(),
    )?);
    let state = AppState {
        registry,
        db,
        default_cwd: effective_cwd,
        running_sessions,
        session_viewers: Arc::new(Mutex::new(HashMap::new())),
        unseen_sessions: Arc::new(Mutex::new(HashSet::new())),
        blocked_sessions: Arc::new(Mutex::new(HashSet::new())),
        stale_sessions: Arc::new(Mutex::new(HashSet::new())),
        cli_active_sessions: Arc::new(Mutex::new(HashSet::new())),
        cli_title_buffers: Arc::new(Mutex::new(HashMap::new())),
        workspace_git: Arc::new(Mutex::new(HashMap::new())),
        session_events_tx,
        model_lists,
        terminal_profile,
        settings,
        hosts,
        hub,
        detached,
        connected_clients: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        git_poll_notify: Arc::new(tokio::sync::Notify::new()),
        devices: Arc::new(match options.devices_path {
            Some(path) => crate::devices::DeviceStore::load(path),
            None => crate::devices::DeviceStore::load_default(),
        }),
        agent_terminals,
        workspace_terminals,
        agent_runtime,
        native_ui: Arc::new(crate::native_ui::NativeUiRegistry::default()),
        agent_operation_lock: Arc::new(Mutex::new(())),
        agent_persistence,
        agent_modes: Arc::new(Mutex::new(agent_modes)),
        snapshot_epoch: Uuid::new_v4().to_string(),
        snapshot_revision: Arc::new(AtomicU64::new(0)),
        foundation_lock: Arc::new(Mutex::new(())),
        filesystem_services: Arc::new(Mutex::new(HashMap::new())),
        filesystem_operation_locks: Arc::new(Mutex::new(HashMap::new())),
        filesystem_operation_overflow: Arc::new(Mutex::new(())),
        git: Arc::new(GitService::new(GitConfig::default())),
    };

    // No AppState cycle: the recorder owns only the DB/Git services and this
    // core's runtime handle. PTY reader threads can use the same barrier.
    let turn_db = state.db.clone();
    let turn_git = state.git.clone();
    let turn_runtime = tokio::runtime::Handle::current();
    state
        .agent_runtime
        .set_turn_boundary_listener(Arc::new(move |key, before| {
            let capture = || {
                turn_runtime.block_on(agent_history::capture(
                    &turn_db,
                    &turn_git,
                    &key.session_id,
                    before,
                ))
            };
            if tokio::runtime::Handle::try_current().is_ok() {
                tokio::task::block_in_place(capture)
            } else {
                capture()
            }
        }))?;

    // Persist restart recovery's Reconnecting revision before any asynchronous
    // attach callback can race a delayed pre-restart snapshot write.
    for record in &restored_agents {
        if let Err(error) = state.agent_persistence.save_snapshot(record) {
            tracing::warn!(
                key = ?record.snapshot.key,
                %error,
                "could not persist recovered agent lifecycle snapshot"
            );
        }
    }

    // The detached manager needs `AppState` to report turn progress, and
    // `AppState` holds the manager — hence the deferred wire-up. Recovery is
    // kicked off immediately afterwards, before the listener starts accepting
    // connections, so a turn that survived a perch restart is already being
    // re-tailed by the time the first client asks for the session list.
    state
        .detached
        .attach_sink(Arc::new(DetachedSink { app: state.clone() }));
    // Turn boundaries are recorded from a pty reader thread as well as from
    // async handlers, so `agent_history` needs both this state and a runtime
    // handle it can spawn on.
    let _ = agent_activity_app.set(state.clone());
    agent_history::attach_runtime(tokio::runtime::Handle::current());
    // A claimed prompt or review packet may have crossed the dispatch barrier
    // immediately before a prior process exited. Preserve it as explicitly
    // unconfirmed so reconnect/reload paths cannot launch a duplicate.
    if let Err(error) = state.db.mark_claimed_prompt_operations_unconfirmed() {
        tracing::warn!("could not recover prompt operation states: {error}");
    }
    if let Err(error) = state.db.mark_claimed_review_packets_unconfirmed() {
        tracing::warn!("could not recover review packet states: {error}");
    }
    if let Err(error) = state.db.reconcile_review_packets_with_prompt_operations() {
        tracing::warn!("could not reconcile review packet states: {error}");
    }
    state.detached.recover_all();

    // Complete any save that reached the filesystem but not SQLite buffer
    // reconciliation before accepting clients. This is intentionally bounded
    // by the durable intent table and never scans the repository.
    recover_file_save_intents(&state);

    spawn_git_poll_task(state.clone());
    spawn_agent_idle_sweep_task(state.clone());
    spawn_agent_lifecycle_task(state.clone());
    spawn_agent_turn_state_task(state.clone());
    spawn_agent_hibernation_task(state.clone());
    spawn_filesystem_watch_task(state.clone());

    let pair_path = format!("{base_path}pair");
    let mut router = Router::new()
        .route(&ws_path, get(ws_upgrade))
        .route(&clipboard_image_path, post(clipboard_image_upload))
        .route(&upload_path, post(attachment_upload))
        .route(&pair_path, get(pair_status).post(pair_claim))
        .with_state(state);

    if options.web_dist_dir.is_dir() {
        let index = options.web_dist_dir.join("index.html");
        let serve_dir =
            ServeDir::new(&options.web_dist_dir).not_found_service(ServeFile::new(index));
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
    // `ConnectInfo` is what tells `authorize_request` whether a caller is on
    // the loopback interface; without it every request would look remote.
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

/// Background task (Phase 6): every 5s, recompute the git branch +
/// ahead/behind status for every distinct cwd among local sessions, and
/// broadcast `workspace.git` to all connections whenever a cwd's value
/// changes. Runs an initial pass immediately (before the first wait) so the
/// `workspace_git` cache is warm by the time the first client connects,
/// letting `handle_socket` push a snapshot without waiting up to 5s.
///
/// Ticks after the initial pass skip the `list_sessions()` + per-cwd `git`
/// subprocess work entirely when `connected_clients` is zero — nobody is
/// connected to see a `workspace.git` broadcast, and no `handle_socket` will
/// read `workspace_git` until a client shows up. `handle_socket` notifies
/// `git_poll_notify` on every new connection so a pass runs promptly right
/// then, rather than the new client waiting up to 5s for the next tick.
///
/// Uses `tokio::process::Command` (async) for the one `git rev-list`
/// subprocess per cwd per tick (see `status::get_ahead_behind`) so this never
/// blocks the async runtime.
/// Recover durable save intents left by a process interruption. A matching
/// on-disk hash proves that the rename completed; only then is the expected
/// buffer revision reconciled. A newer draft revision is left untouched and
/// becomes explicitly conflicted instead of being silently discarded.
fn recover_file_save_intents(state: &AppState) {
    const MAX_INTENTS: usize = 1_024;
    let intents = match state.db.list_file_save_intents(MAX_INTENTS) {
        Ok(intents) => intents,
        Err(error) => {
            tracing::warn!("[fs] save-intent recovery could not list intents: {error}");
            return;
        }
    };
    for intent in intents {
        let operation_lock = filesystem_operation_lock(state, &intent.workspace_id, &intent.path);
        let _operation_guard = operation_lock.lock().unwrap();
        let service = match workspace_file_service(state, &intent.workspace_id) {
            Ok(service) => service,
            Err(error) => {
                tracing::warn!(
                    "[fs] save-intent recovery deferred for unavailable workspace {}: {error}",
                    intent.workspace_id
                );
                continue;
            }
        };
        match recover_one_file_save_intent(state.db.as_ref(), &service, &intent) {
            Ok(Some(buffer)) => {
                let _ = state
                    .hub
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: intent.workspace_id.clone(),
                        path: intent.path.clone(),
                        version: buffer.external_version.clone(),
                        kind: "changed".to_string(),
                        metadata: None,
                        buffer_revision: Some(buffer.revision),
                        conflict: buffer.conflict,
                    }));
            }
            Ok(None) => {}
            Err(error) => tracing::warn!(
                "[fs] save-intent recovery failed for {:?}: {error}",
                intent.path
            ),
        }
    }
}

/// Recover one intent while its workspace/path operation lock is held. The
/// return value is the changed durable row, if any, for an invalidation event.
fn recover_one_file_save_intent(
    db: &HistoryDb,
    service: &FileService,
    intent: &FileSaveIntentRow,
) -> Result<Option<FileBufferRow>, String> {
    match service.read_file(&intent.path) {
        Ok(read) if read.version == intent.version => {
            // The read supplies enough bounded metadata to reconstruct the
            // original write response. `complete_file_save` performs the
            // reconciliation, receipt insert, and intent deletion in one
            // SQLite transaction and recognizes a row already reconciled by
            // a process that exited immediately before receipt insertion.
            let metadata_json = serde_json::to_string(&read.metadata)
                .map_err(|error| format!("saved metadata could not be recorded: {error}"))?;
            match db.complete_file_save(FileSaveCompletion {
                operation_id: &intent.operation_id,
                workspace_id: &intent.workspace_id,
                path: &intent.path,
                content: &intent.content,
                version: &intent.version,
                expected_revision: intent.expected_buffer_revision,
                bytes_written: read.content.len(),
                metadata_json: &metadata_json,
                max_receipts: 1_024,
            }) {
                Ok(buffer) => Ok(buffer),
                Err(error) => Err(error.to_string()),
            }
        }
        Ok(read) => {
            // A different disk hash does not prove whether the intended save
            // was published and then replaced. Preserve the draft and make
            // the external version explicit so the UI must choose a merge or
            // overwrite path.
            let Some(_current) = db
                .get_file_buffer(&intent.workspace_id, &intent.path)
                .map_err(|error| error.to_string())?
            else {
                // Without a durable row there is no safe draft to mark as
                // resolved. Keep the intent for a later recovery pass.
                return Ok(None);
            };
            let updated = db
                .observe_file_buffer(
                    &intent.workspace_id,
                    &intent.path,
                    FileBufferObservation {
                        content: None,
                        base_content: None,
                        base_version: None,
                        external_version: Some(&read.version),
                        dirty: true,
                        conflict: true,
                    },
                )
                .map_err(|error| error.to_string())?;
            let Some(updated) = updated else {
                return Ok(None);
            };
            db.clear_file_save_intent(
                &intent.operation_id,
                &intent.workspace_id,
                &intent.path,
                &intent.version,
                intent.expected_buffer_revision,
            )
            .map_err(|error| error.to_string())?;
            Ok(Some(updated))
        }
        Err(error) => {
            // Missing, binary, too-large, and transient I/O observations do
            // not prove whether publication happened. Keep both the intent
            // and the durable draft so a later recovery pass can retry.
            Err(error.to_string())
        }
    }
}

struct FsWatchObservation {
    workspace_id: String,
    path: String,
    version: Option<String>,
    metadata: Option<crate::filesystem::FileMetadata>,
    buffer_revision: u64,
    conflict: bool,
    kind: &'static str,
}

/// Refresh one watched buffer while its workspace/path operation lock is
/// held. The metadata row is only a queue item; the durable row is fetched
/// again here so a draft committed after the queue query cannot be replaced
/// using stale dirty/revision state.
fn observe_one_watched_file(
    db: &HistoryDb,
    service: &FileService,
    row: &FileBufferMetadataRow,
    metadata_cache: &mut HashMap<String, crate::filesystem::FileMetadata>,
    force_content_scan: bool,
) -> Option<FsWatchObservation> {
    let Ok(Some(current)) = db.get_file_buffer(&row.workspace_id, &row.path) else {
        return None;
    };
    let key = format!("{}\0{}", row.workspace_id, row.path);
    match service.stat_file(&row.path) {
        Ok(metadata) => {
            let metadata_changed = metadata_cache
                .get(&key)
                .is_none_or(|previous| previous != &metadata);
            metadata_cache.insert(key.clone(), metadata);
            if !force_content_scan && !metadata_changed && current.external_version.is_some() {
                return None;
            }
            let Ok(read) = service.read_file(&row.path) else {
                return None;
            };
            metadata_cache.insert(key, read.metadata.clone());
            if current.external_version.as_deref() == Some(read.version.as_str()) {
                return None;
            }
            let updated = if current.dirty {
                db.observe_file_buffer(
                    &row.workspace_id,
                    &row.path,
                    FileBufferObservation {
                        content: None,
                        base_content: None,
                        base_version: None,
                        external_version: Some(&read.version),
                        dirty: true,
                        conflict: true,
                    },
                )
            } else {
                db.observe_file_buffer(
                    &row.workspace_id,
                    &row.path,
                    FileBufferObservation {
                        content: Some(&read.content),
                        base_content: Some(&read.content),
                        base_version: Some(&read.version),
                        external_version: Some(&read.version),
                        dirty: false,
                        conflict: false,
                    },
                )
            };
            updated.ok().flatten().map(|updated| FsWatchObservation {
                workspace_id: row.workspace_id.clone(),
                path: row.path.clone(),
                version: Some(read.version),
                metadata: Some(read.metadata),
                buffer_revision: updated.revision,
                conflict: updated.conflict,
                kind: "changed",
            })
        }
        Err(FsError::NotFound { .. }) => {
            metadata_cache.remove(&key);
            current.external_version.as_ref()?;
            db.observe_file_buffer(
                &row.workspace_id,
                &row.path,
                FileBufferObservation {
                    content: None,
                    base_content: None,
                    base_version: None,
                    external_version: None,
                    dirty: true,
                    conflict: true,
                },
            )
            .ok()
            .flatten()
            .map(|updated| FsWatchObservation {
                workspace_id: row.workspace_id.clone(),
                path: row.path.clone(),
                version: None,
                metadata: None,
                buffer_revision: updated.revision,
                conflict: updated.conflict,
                kind: "deleted",
            })
        }
        Err(_) => {
            // A transient I/O/symlink/non-regular observation is not evidence
            // of a content change. Keep the prior metadata so a later pass
            // retries it.
            None
        }
    }
}

/// Poll only durable open buffers. This is deliberately a bounded watch set,
/// rather than a repository-wide scan, and uses the same per-path operation
/// locks as saves so a transient external edit cannot clear a newer draft.
fn spawn_filesystem_watch_task(state: AppState) {
    tokio::spawn(async move {
        // Metadata is cheap enough to inspect for every open buffer.  Keep a
        // local fingerprint cache so the common unchanged case does not hash
        // up to 4 MiB per row on every two-second tick.  A periodic full pass
        // still catches same-size edits on filesystems with coarse mtimes.
        const FULL_CONTENT_SCAN_EVERY_TICKS: u64 = 15;
        let mut tick = 0_u64;
        let mut metadata_cache: HashMap<String, crate::filesystem::FileMetadata> = HashMap::new();
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            tick = tick.wrapping_add(1);
            if state
                .connected_clients
                .load(std::sync::atomic::Ordering::SeqCst)
                == 0
            {
                // There are no subscribers to receive invalidation events.
                // Dropping the cache also bounds retained metadata if all
                // clients disconnect while a large set of tabs is open.
                metadata_cache.clear();
                continue;
            }
            let app = state.clone();
            let force_content_scan = tick.is_multiple_of(FULL_CONTENT_SCAN_EVERY_TICKS);
            let cache = std::mem::take(&mut metadata_cache);
            let result = tokio::task::spawn_blocking(move || {
                let rows = app
                    .db
                    .list_file_buffers_for_watch(MAX_FILE_BUFFER_WATCHES)
                    .unwrap_or_default();
                let active_keys: HashSet<String> = rows
                    .iter()
                    .map(|row| format!("{}\0{}", row.workspace_id, row.path))
                    .collect();
                let mut metadata_cache = cache;
                metadata_cache.retain(|key, _| active_keys.contains(key));
                let mut observations = Vec::new();
                for row in rows {
                    let lock = filesystem_operation_lock(&app, &row.workspace_id, &row.path);
                    let _guard = lock.lock().unwrap();
                    let Ok(service) = workspace_file_service(&app, &row.workspace_id) else {
                        continue;
                    };
                    if let Some(observation) = observe_one_watched_file(
                        app.db.as_ref(),
                        &service,
                        &row,
                        &mut metadata_cache,
                        force_content_scan,
                    ) {
                        observations.push(observation);
                    }
                }
                (observations, metadata_cache)
            })
            .await;
            let (observations, updated_cache) = match result {
                Ok(result) => result,
                Err(_) => continue,
            };
            metadata_cache = updated_cache;
            for observation in observations {
                let _ = state
                    .hub
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: observation.workspace_id,
                        path: observation.path,
                        version: observation.version,
                        kind: observation.kind.to_string(),
                        metadata: observation.metadata,
                        buffer_revision: Some(observation.buffer_revision),
                        conflict: observation.conflict,
                    }));
            }
        }
    });
}

fn spawn_git_poll_task(state: AppState) {
    tokio::spawn(async move {
        // Unconditional first pass: no client can possibly be connected yet
        // (this task is spawned before the router starts accepting
        // connections), so gating on `connected_clients` here would leave
        // the cache cold. This is what keeps the "warm by first connect"
        // property regardless of the zero-client gating below.
        run_git_poll_pass(&state).await;

        loop {
            tokio::select! {
                _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => {}
                _ = state.git_poll_notify.notified() => {}
            }

            if state
                .connected_clients
                .load(std::sync::atomic::Ordering::SeqCst)
                == 0
            {
                continue;
            }
            run_git_poll_pass(&state).await;
        }
    });
}

/// One pass of the git-poll task's work: recompute branch/ahead/behind for
/// every distinct cwd among local sessions and broadcast `workspace.git` for
/// whichever cwds changed. Factored out of [`spawn_git_poll_task`] so it can
/// be called both for the unconditional startup pass and for gated ticks.
async fn run_git_poll_pass(state: &AppState) {
    let cwds: HashSet<String> = state
        .db
        .list_sessions()
        .unwrap_or_default()
        .into_iter()
        .map(|row| row.cwd)
        .collect();

    for cwd in cwds {
        let branch = crate::status::get_branch(&cwd);
        let branch = if branch.is_empty() {
            None
        } else {
            Some(branch)
        };
        let (ahead, behind) = crate::status::get_ahead_behind(&cwd)
            .await
            .unwrap_or((0, 0));
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
            let _ = state
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::WorkspaceGit {
                    host_id: "local".to_string(),
                    cwd: cwd.clone(),
                    branch,
                    ahead,
                    behind,
                }));
        }
    }
}

/// Task 2: one shared sweep loop for every agent-attached (CLI-mode)
/// terminal's working→idle transition, instead of a timer per terminal (a
/// process with a dozen open CLI panes would otherwise leak a dozen sleeping
/// tasks). Ticks at a fraction of `AGENT_QUIET_THRESHOLD` so the debounce
/// still feels immediate while keeping the wakeup cheap (a `HashMap` scan of
/// however many agent terminals are currently live — typically single
/// digits). Exits only if the process exits; there is nothing to cancel it
/// early because, like `spawn_git_poll_task`, its lifetime is the server's.
/// A bounded pass checkpoints lifecycle changes independently of browser
/// viewers. Output remains on the PTY fast path; SQLite is never written for
/// every output chunk. Transient ownership is pushed but not persisted.
fn spawn_agent_lifecycle_task(state: AppState) {
    tokio::spawn(async move {
        let mut seen = HashMap::new();
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let _operation = state.agent_operation_lock.lock().unwrap();
            let snapshots = state.agent_runtime.lifecycle().list();
            refresh_stale_sessions(&state, &snapshots);
            seen.retain(|key, _| snapshots.iter().any(|snapshot| &snapshot.key == key));
            for snapshot in snapshots {
                if !state
                    .db
                    .session_exists(&snapshot.key.session_id)
                    .unwrap_or(false)
                {
                    continue;
                }
                let mode = state
                    .agent_modes
                    .lock()
                    .unwrap()
                    .get(&snapshot.key)
                    .copied()
                    .unwrap_or((AgentMode::Cli, 1));
                let version = (snapshot.revision, mode);
                if seen.get(&snapshot.key) == Some(&version) {
                    continue;
                }
                if let Err(error) = persist_agent_runtime(&state, &snapshot.key) {
                    tracing::warn!(%error, "could not checkpoint agent lifecycle");
                    continue;
                }
                seen.insert(snapshot.key.clone(), version);
                broadcast_foundation(
                    &state,
                    ServerMessage::AgentLifecycleChanged {
                        host_id: "local".to_string(),
                        status: lifecycle_status_to_wire(snapshot),
                    },
                );
            }
        }
    });
}

/// Apply the decay half of the reader policy and repaint what crossed it.
fn refresh_stale_sessions(state: &AppState, snapshots: &[crate::agent_fleet::AgentSnapshot]) {
    let next = {
        let running = state.running_sessions.lock().unwrap();
        let blocked = state.blocked_sessions.lock().unwrap();
        session::stale_sessions(
            snapshots,
            |id| running.contains(id) || blocked.contains(id),
            now_millis(),
        )
    };
    let previous = std::mem::replace(&mut *state.stale_sessions.lock().unwrap(), next.clone());
    for session_id in previous.symmetric_difference(&next) {
        notify_session_updated(state, session_id);
    }
}

/// Consume provider transitions in order, including a whole turn that fits
/// between lifecycle snapshot polls. Native and configured providers share it.
fn spawn_agent_turn_state_task(state: AppState) {
    let mut transitions = state
        .agent_runtime
        .lifecycle()
        .subscribe_provider_transitions();
    tokio::spawn(async move {
        loop {
            let (key, transition, starts_turn) = match transitions.recv().await {
                Ok(event) => event,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(count)) => {
                    tracing::error!(
                        count,
                        "provider turn transitions were lost; turn history is incomplete"
                    );
                    continue;
                }
            };
            use crate::agent_fleet::AgentState;
            let running = match transition.to {
                // Repainting a completed terminal is output, not a new turn.
                AgentState::Working if !starts_turn => continue,
                AgentState::Working | AgentState::Blocked => true,
                AgentState::Done | AgentState::Idle | AgentState::Exited | AgentState::Error => {
                    false
                }
                _ => continue, // Transport loss is not proof a turn finished.
            };
            let changed = {
                let mut sessions = state.running_sessions.lock().unwrap();
                if running {
                    sessions.insert(key.session_id.clone())
                } else {
                    sessions.remove(&key.session_id)
                }
            };
            // Structured evidence owns "needs you" in both directions; the
            // output-regex guess in `handle_socket` only fills in for agents
            // without it.
            let blocked_changed = {
                let mut blocked = state.blocked_sessions.lock().unwrap();
                if transition.to == AgentState::Blocked {
                    blocked.insert(key.session_id.clone())
                } else {
                    blocked.remove(&key.session_id)
                }
            };
            let changed = changed || blocked_changed;
            if changed {
                if !running {
                    mark_unseen_if_unviewed(&state, &key.session_id);
                }
                notify_session_updated(&state, &key.session_id);
            }
        }
    });
}

/// Default idle window before a safe agent is hibernated, overridable with
/// `PERCH_HIBERNATE_AFTER_SECS` (0 disables hibernation entirely). This is a
/// process-wide constant rather than a setting on purpose — every blocker in
/// `HibernationPolicy::evaluate` (a viewer, input ownership, an unfinished
/// state, a missing resume identity) already refuses the unsafe cases, so the
/// window is the only knob and nobody has asked to tune it per host yet.
///
/// ponytail: if that changes, it belongs in `~/.perch/settings.json` next to
/// the other device policies, which costs a protocol field in both files.
fn hibernate_after() -> Option<std::time::Duration> {
    let seconds = std::env::var("PERCH_HIBERNATE_AFTER_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(15 * 60);
    (seconds > 0).then(|| std::time::Duration::from_secs(seconds))
}

/// Hibernate safe idle agents: the pty is terminated but the lifecycle record
/// keeps the provider continuation identity, so the next attach resumes the
/// same conversation instead of starting a new one (see the `RequiresWake`
/// branch in `server/terminal.rs`). `HibernationPolicy::evaluate` owns every
/// safety rule; this task only supplies the clock.
fn spawn_agent_hibernation_task(state: AppState) {
    let Some(idle_after) = hibernate_after() else {
        tracing::info!("[perch] agent hibernation disabled (PERCH_HIBERNATE_AFTER_SECS=0)");
        return;
    };
    tokio::spawn(async move {
        let policy = crate::agent_fleet::HibernationPolicy::new(idle_after);
        // A quarter of the window, bounded so a short test window still ticks
        // promptly and a long one does not wake the process every second.
        let tick = (idle_after / 4).clamp(
            std::time::Duration::from_millis(500),
            std::time::Duration::from_secs(30),
        );
        loop {
            tokio::time::sleep(tick).await;
            let now = now_millis();
            let eligible: Vec<_> = {
                let _operation = state.agent_operation_lock.lock().unwrap();
                state
                    .agent_runtime
                    .lifecycle()
                    .list()
                    .into_iter()
                    .filter(|snapshot| policy.evaluate(snapshot, now).eligible)
                    .map(|snapshot| snapshot.key)
                    .collect()
            };
            for key in eligible {
                let _operation = state.agent_operation_lock.lock().unwrap();
                match state.agent_runtime.hibernate(&key, policy, now_millis()) {
                    Ok(transition) => {
                        tracing::info!(
                            session_id = %key.session_id,
                            agent = %key.agent_id,
                            "hibernated idle agent ({} -> {:?})",
                            transition.reason,
                            transition.to
                        );
                        if let Err(error) = persist_agent_runtime(&state, &key) {
                            tracing::warn!(%error, "could not checkpoint hibernated agent");
                        }
                        // The pty is gone, so the session is not mid-turn any
                        // more. The attached connection's exit listener would
                        // normally say so, but hibernation happens precisely
                        // when no connection is attached.
                        state
                            .running_sessions
                            .lock()
                            .unwrap()
                            .remove(&key.session_id);
                        notify_session_updated(&state, &key.session_id);
                    }
                    // A racing attach, focus, or prompt between the scan and
                    // the call is the common case, not an error.
                    Err(error) => tracing::debug!(
                        session_id = %key.session_id,
                        %error,
                        "agent was no longer eligible for hibernation"
                    ),
                }
            }
        }
    });
}

fn spawn_agent_idle_sweep_task(state: AppState) {
    tokio::spawn(async move {
        let tick = AGENT_QUIET_THRESHOLD / 4;
        loop {
            tokio::time::sleep(tick).await;
            // Silence is only a legacy terminal display heuristic. Managed
            // agents require provider completion evidence before becoming idle;
            // a quiet working or blocked process must never become sleepable.
            let quiet_sessions = state
                .agent_terminals
                .sessions_quiet_since(AGENT_QUIET_THRESHOLD);
            for session_id in quiet_sessions {
                // `running_sessions` already covers Hosted-mode turns and
                // detached turns; a CLI terminal that never went "running" in
                // the first place (a plain shell, or one that's already been
                // marked idle) is a no-op remove — cheap and side-effect-free.
                let was_running = state.running_sessions.lock().unwrap().remove(&session_id);
                if was_running {
                    // Mirror `DetachedSink::set_running(false)` exactly: a CLI
                    // turn finishing while nobody is viewing the session must
                    // mark it unseen, the same as a Hosted turn completing.
                    mark_unseen_if_unviewed(&state, &session_id);
                    notify_session_updated(&state, &session_id);
                }
            }
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

/// Browser credentials are valid only at this request's origin. Native
/// clients omit Origin; a browser cannot opt out of sending it on WebSockets.
fn same_origin(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(axum::http::header::ORIGIN) else {
        return true;
    };
    let Some(origin) = origin
        .to_str()
        .ok()
        .and_then(|s| s.parse::<axum::http::Uri>().ok())
    else {
        return false;
    };
    matches!(origin.scheme_str(), Some("http" | "https"))
        && origin
            .authority()
            .zip(
                headers
                    .get(axum::http::header::HOST)
                    .and_then(|h| h.to_str().ok()),
            )
            .is_some_and(|(origin, host)| origin.as_str().eq_ignore_ascii_case(host))
}

fn local_request(peer: &SocketAddr, headers: &HeaderMap) -> bool {
    let host = headers
        .get(axum::http::header::HOST)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.parse::<axum::http::uri::Authority>().ok());
    peer.ip().is_loopback()
        && !headers.contains_key("forwarded")
        && !headers.contains_key("x-forwarded-host")
        && !headers.contains_key("x-forwarded-for")
        && host.is_some_and(|host| {
            host.host().eq_ignore_ascii_case("localhost")
                || host
                    .host()
                    .trim_matches(['[', ']'])
                    .parse::<std::net::IpAddr>()
                    .is_ok_and(|ip| ip.is_loopback())
        })
}

/// Resolve authorization to a paired device identity, or a trusted local
/// client (None). Retain the identity for the lifetime of a WebSocket.
fn authorize_request(
    state: &AppState,
    peer: &SocketAddr,
    headers: &HeaderMap,
    params: &HashMap<String, String>,
) -> Result<Option<String>, StatusCode> {
    if !same_origin(headers) {
        return Err(StatusCode::FORBIDDEN);
    }
    let require_everywhere = std::env::var("PERCH_REQUIRE_PAIRING").as_deref() == Ok("1");
    if local_request(peer, headers) && !require_everywhere {
        return Ok(None);
    }
    let token = params
        .get("token")
        .cloned()
        .or_else(|| cookie_value(headers, "perch_device"));
    token
        .and_then(|token| state.devices.authenticate(&token, wall_clock_millis()))
        .map(|device| Some(device.id))
        .ok_or(StatusCode::UNAUTHORIZED)
}

fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(axum::http::header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| key.trim() == name)
        .map(|(_, value)| value.trim().to_string())
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    match authorize_request(&state, &peer, &headers, &params) {
        Ok(device_id) => ws
            .on_upgrade(move |socket| handle_socket(socket, state, device_id))
            .into_response(),
        Err(status) => (status, "device access denied").into_response(),
    }
}

/// `GET {base}pair` — does this caller already have data-plane access?
///
/// A browser cannot see the status of a failed WebSocket handshake, so it
/// cannot tell "not paired" from "host is down" on its own. This is the one
/// bit it needs to decide whether to show the pairing screen, and it says
/// nothing else.
async fn pair_status(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "paired": authorize_request(&state, &peer, &headers, &params).is_ok(),
    }))
}

/// `POST {base}pair` — exchange a pairing code for a device token.
///
/// Deliberately the only unauthenticated data route: it is how an unpaired
/// device becomes paired. The code is one-shot, expires in five minutes and
/// burns after a handful of wrong guesses (`devices.rs`), and the token comes
/// back both as a cookie (so the WS handshake carries it) and in the body.
async fn pair_claim(
    State(state): State<AppState>,
    headers: HeaderMap,
    axum::Json(body): axum::Json<serde_json::Value>,
) -> impl IntoResponse {
    if !same_origin(&headers) {
        return (StatusCode::FORBIDDEN, "origin is not allowed").into_response();
    }
    let code = body["code"].as_str().unwrap_or_default();
    let name = body["name"].as_str().unwrap_or_default();
    match state
        .devices
        .claim(code, name, std::time::Instant::now(), wall_clock_millis())
    {
        Ok(paired) => {
            // Push the new list to every open client: the host window is
            // usually showing the code when this lands, and a device that
            // appears only after a manual refresh reads as a failed pairing.
            // An empty request id marks it unsolicited.
            let _ = state
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::DeviceListResult {
                    request_id: String::new(),
                    devices: state
                        .devices
                        .list()
                        .into_iter()
                        .map(|device| crate::protocol::DeviceSummary {
                            id: device.id,
                            name: device.name,
                            created_at: device.created_at,
                            last_seen_at: device.last_seen_at,
                        })
                        .collect(),
                }));
            let mut response = axum::Json(serde_json::json!({
                "deviceId": paired.record.id,
                "name": paired.record.name,
                "token": paired.token,
            }))
            .into_response();
            if let Ok(cookie) = axum::http::HeaderValue::from_str(&format!(
                "perch_device={}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict",
                paired.token
            )) {
                response
                    .headers_mut()
                    .insert(axum::http::header::SET_COOKIE, cookie);
            }
            response
        }
        Err(error) => (StatusCode::FORBIDDEN, error.to_string()).into_response(),
    }
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
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    // Writes a file to `~/.perch/clipboard-images`, so it is as much a data
    // route as the WS is and gets the same gate.
    if let Err(status) = authorize_request(&state, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    const MAX_BYTES: usize = 10 * 1024 * 1024;
    if body.len() > MAX_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "image too large (max 10MB)").into_response();
    }
    let content_type = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !content_type.starts_with("image/") {
        return (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "expected an image/* content type",
        )
            .into_response();
    }
    let ext = params.get("ext").map(|s| s.as_str()).unwrap_or("");
    match crate::clipboard_image::stage(&body, ext) {
        Ok(path) => {
            axum::Json(serde_json::json!({ "path": path.to_string_lossy() })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("failed to stage clipboard image: {e}"),
        )
            .into_response(),
    }
}

/// `POST {base}upload?sessionId=…&name=…` — stage one composer attachment.
///
/// The body is the raw file bytes (the client sends the `File` object
/// directly; there is no multipart parser in the dependency set and none is
/// needed for one file per request). The reply is `{"path": "/abs/path"}`,
/// and that path is what the client echoes back in `chat.send`'s
/// `attachments`.
///
/// Staging is always **local**, exactly like `clipboard-image`: there is no
/// HTTP route from the browser to a remote host. For a direct-mode session
/// `detached.rs` copies the staged file into the turn's remote run directory
/// and rewrites the path before launching the CLI.
async fn attachment_upload(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
    body: Bytes,
) -> impl IntoResponse {
    if let Err(status) = authorize_request(&state, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    const MAX_BYTES: usize = 25 * 1024 * 1024;
    if body.len() > MAX_BYTES {
        return (StatusCode::PAYLOAD_TOO_LARGE, "file too large (max 25MB)").into_response();
    }
    if body.is_empty() {
        return (StatusCode::BAD_REQUEST, "empty upload").into_response();
    }
    let session_id = params
        .get("sessionId")
        .map(|s| s.as_str())
        .unwrap_or("unknown");
    let name = params
        .get("name")
        .map(|s| s.as_str())
        .unwrap_or("attachment");
    match crate::uploads::stage(session_id, name, &body) {
        Ok(path) => axum::Json(serde_json::json!({
            "path": path.to_string_lossy(),
            "name": crate::uploads::sanitize_filename(name),
        }))
        .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("failed to stage attachment: {e}"),
        )
            .into_response(),
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
    /// The durable operation that caused this turn. Keeping it beside the
    /// streaming accumulator lets completion settle a review outbox packet
    /// after a reconnect without relying on the initiating socket.
    operation_id: String,
    /// Provider errors still produce a terminal `chat.done` event in both
    /// runners. Remember the failure so that the later done event cannot
    /// falsely promote an unconfirmed operation to delivered.
    failed: bool,
    /// Set only after a non-empty provider output, tool result/use, or plan
    /// event arrives. A terminal `Done` by itself is not delivery evidence.
    accepted: bool,
    text: String,
    thinking: String,
}

/// Per-connection state shared across the read loop, the writer task, the
/// terminal reader/waiter threads, and spawned chat-turn tasks.
struct ConnState {
    app: AppState,
    /// Unique id for this WS connection — scopes unicast registrations in the
    /// hub so they can all be torn down atomically when the socket closes.
    conn_id: String,
    /// Authenticated pairing identity; local clients have no paired device.
    device_id: Option<String>,
    out_tx: UnboundedSender<ServerMessage>,
    runtimes: Mutex<HashMap<String, SessionRuntime>>,
    terminals: TerminalManager,
    /// The local session id this connection is currently viewing (its most
    /// recent `session.create`/`session.resume`/`session.subscribe` target).
    /// `None` before the first such message. Drives `session_viewers` /
    /// `unseen_sessions` bookkeeping in [`set_active_session`].
    active_session_id: Mutex<Option<String>>,
    /// Connection-local project/workspace focus. Persisted focus seeds a new
    /// connection, while navigation in one tab/device never mutates another
    /// connection's active selection.
    active_project_id: Mutex<Option<String>>,
    active_workspace_id: Mutex<Option<String>>,
    /// Maps CLI-attached terminal ids to the session they're attached to, so
    /// `TerminalInput` can clear that session's blocked state on user input,
    /// and the `on_data`/`on_exit` closures (created before this struct
    /// exists — see `handle_socket`) can scan output and clean up on exit.
    /// Shared (not owned) with those closures via the same `Arc`. Plain
    /// terminals (no `agentAttach`) never get an entry.
    terminal_agent_sessions: Arc<Mutex<HashMap<String, String>>>,
    /// Same `on_data`/`on_exit` callbacks passed to `terminals` above, kept as
    /// a second clone so a local `agentAttach` can register them as a viewer
    /// on `AppState::agent_terminals` too (Task 1's shared-terminal path) —
    /// they do the exact same blocked-state bookkeeping and `terminal.data`/
    /// `terminal.exit` forwarding either way, so there's no second
    /// implementation to keep in sync.
    agent_on_data: crate::terminal::TerminalDataListener,
    agent_on_exit: crate::terminal::TerminalExitListener,
    /// Lease checked by local shared-agent input/resize routes.  The protocol
    /// currently acquires lazily on the first explicit operation; once one
    /// client owns a channel, all other viewers are rejected until release or
    /// disconnect, so an observer cannot write by accident.
    agent_views: Mutex<HashMap<AgentKey, HashSet<String>>>,
    released_agent_views: Mutex<std::collections::VecDeque<String>>,
    agent_input_leases: Mutex<HashMap<String, crate::agent_fleet::ControlLease>>,
    agent_resize_leases: Mutex<HashMap<String, crate::agent_fleet::ControlLease>>,
}

/// RAII guard that decrements `AppState::connected_clients` on drop, so the
/// count stays correct no matter which path `handle_socket` exits through
/// (normal close, error, or a future early return/panic) — the decrement
/// can't be forgotten because it isn't spelled out at each exit point.
struct ConnCountGuard(Arc<std::sync::atomic::AtomicUsize>);

impl Drop for ConnCountGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);
    }
}

async fn handle_socket(socket: WebSocket, app: AppState, device_id: Option<String>) {
    let mut revoked = app.devices.subscribe_revocations();
    if device_id
        .as_ref()
        .is_some_and(|id| !app.devices.is_paired(id))
    {
        return;
    }
    // Counted for `spawn_git_poll_task`'s zero-client gate; notify it so a
    // fresh pass runs now instead of the client waiting up to 5s for the
    // next tick. The guard's `Drop` decrements on every exit path below.
    app.connected_clients
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    app.git_poll_notify.notify_one();
    let _conn_count_guard = ConnCountGuard(app.connected_clients.clone());

    let (mut sender, mut receiver) = socket.split();
    let (out_tx, mut out_rx) = unbounded_channel::<ServerMessage>();

    // Unique id for this browser connection — used to scope unicast registrations
    // so they can all be cleaned up atomically when the socket closes.
    let conn_id = Uuid::new_v4().to_string();

    let writer_devices = app.devices.clone();
    let writer_device_id = device_id.clone();
    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            if writer_device_id
                .as_ref()
                .is_some_and(|id| !writer_devices.is_paired(id))
            {
                break;
            }
            let Ok(text) = serde_json::to_string(&message) else {
                continue;
            };
            if sender.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    let terminal_tx = out_tx.clone();
    let terminal_agent_sessions: Arc<Mutex<HashMap<String, String>>> =
        Arc::new(Mutex::new(HashMap::new()));
    // Rolling ANSI-stripped output tail per CLI-attached terminal, used only
    // for blocked-state (approval-prompt) detection — see `blocked_patterns`.
    let terminal_tails: Arc<Mutex<HashMap<String, String>>> = Arc::new(Mutex::new(HashMap::new()));
    let on_data_app = app.clone();
    let on_data_agent_sessions = terminal_agent_sessions.clone();
    let on_data_tails = terminal_tails.clone();
    let on_data = Arc::new(move |terminal_id: String, data: String| {
        // Phase 6: blocked-state detection — only for terminals created via
        // `agentAttach` (real interactive CLI mode), never plain shells.
        if let Some(session_id) = on_data_agent_sessions
            .lock()
            .unwrap()
            .get(&terminal_id)
            .cloned()
        {
            let newly_blocked = {
                let mut tails = on_data_tails.lock().unwrap();
                let tail = tails.entry(terminal_id.clone()).or_default();
                append_tail(tail, &data);
                let already_blocked = on_data_app
                    .blocked_sessions
                    .lock()
                    .unwrap()
                    .contains(&session_id);
                !already_blocked
                    && !on_data_app.agent_runtime.has_native_status(&session_id)
                    && !on_data_app.agent_runtime.has_title_status(&session_id)
                    && blocked_patterns().iter().any(|re| re.is_match(tail))
            };
            if newly_blocked {
                on_data_app
                    .blocked_sessions
                    .lock()
                    .unwrap()
                    .insert(session_id.clone());
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
            let was_blocked = on_exit_app
                .blocked_sessions
                .lock()
                .unwrap()
                .remove(&session_id);
            if was_blocked {
                notify_session_updated(&on_exit_app, &session_id);
            }
        }
        let _ = terminal_tx.send(ServerMessage::TerminalExit { terminal_id, code });
    });

    let agent_on_data = on_data.clone();
    let agent_on_exit = on_exit.clone();
    // Persisted focus is a starting point only. Once this connection exists,
    // focus changes stay in its ConnState and do not move another browser or
    // device that is already connected.
    let (initial_project_id, initial_workspace_id) = {
        let _foundation_guard = app.foundation_lock.lock().unwrap();
        app.db.active_focus("local").unwrap_or((None, None))
    };
    let state = Arc::new(ConnState {
        app: app.clone(),
        conn_id: conn_id.clone(),
        device_id: device_id.clone(),
        out_tx,
        runtimes: Mutex::new(HashMap::new()),
        terminals: TerminalManager::new(on_data, on_exit),
        active_session_id: Mutex::new(None),
        active_project_id: Mutex::new(initial_project_id),
        active_workspace_id: Mutex::new(initial_workspace_id),
        terminal_agent_sessions,
        agent_on_data,
        agent_on_exit,
        agent_views: Mutex::new(HashMap::new()),
        released_agent_views: Mutex::new(std::collections::VecDeque::new()),
        agent_input_leases: Mutex::new(HashMap::new()),
        agent_resize_leases: Mutex::new(HashMap::new()),
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
        terminal_profile: state.app.terminal_profile.clone(),
        protocol_version: PROTOCOL_VERSION,
        capabilities: foundation_capabilities(),
        snapshot_epoch: state.app.snapshot_epoch.clone(),
        snapshot_revision: state
            .app
            .snapshot_revision
            .load(std::sync::atomic::Ordering::SeqCst),
    });

    // Send the current hosts list so the sidebar can render remote sections
    // without waiting for the Settings modal to call fetchHosts().
    // Bug fix (F3): previously hosts were only sent in response to hosts.list;
    // the sidebar would show no remote sections until Settings was opened.
    let _ = state.out_tx.send(ServerMessage::HostsList {
        hosts: state
            .app
            .hosts
            .list()
            .into_iter()
            .map(host_to_wire)
            .collect(),
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
    let event_stale = app.stale_sessions.clone();
    tokio::spawn(async move {
        loop {
            match events_rx.recv().await {
                Ok(evt) => {
                    // Look up the current DB row for this session, build a
                    // summary with the live running snapshot, and push it.
                    // `get_session_row` is the single-row counterpart of
                    // `list_sessions()` (shared SELECT body — see db.rs) so
                    // this can't ever disagree with what `session.list`
                    // would say about the same row.
                    let Some(row) = event_db.get_session_row(&evt.session_id).unwrap_or(None)
                    else {
                        continue;
                    };
                    let running = event_running.lock().unwrap();
                    let unseen = event_unseen.lock().unwrap();
                    let blocked = event_blocked.lock().unwrap();
                    let stale = event_stale.lock().unwrap();
                    let summary = build_session_summary(row, &running, &unseen, &blocked, &stale);
                    drop(running);
                    drop(unseen);
                    drop(blocked);
                    drop(stale);
                    if event_out_tx
                        .send(ServerMessage::SessionUpdated { session: summary })
                        .is_err()
                    {
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
    let hub_conn_id = conn_id.clone();
    tokio::spawn(async move {
        loop {
            match hub_rx.recv().await {
                Ok(msg) => {
                    // Session-scoped chat events (chat.chunk/thinking/tool_use/
                    // tool_result/done/plan) only go to connections currently
                    // viewing that session — a detached turn broadcasts to
                    // every connection (see `DetachedSink::emit`), so without
                    // this a client watching session A would also receive
                    // session B's live chat frames. Lock scope is just the
                    // lookup; released before any send (see
                    // `should_forward_to_viewer`'s doc comment).
                    let forward = {
                        let viewers = hub_app.session_viewers.lock().unwrap();
                        should_forward_to_viewer(&msg, &hub_conn_id, &viewers, |session, agent| {
                            hub_app
                                .agent_runtime
                                .lifecycle()
                                .observes(session, agent, &hub_conn_id)
                        })
                    };
                    if !forward {
                        continue;
                    }
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

    loop {
        let message = tokio::select! {
            biased;
            _ = revoked.changed() => {
                if device_id.as_ref().is_some_and(|id| !app.devices.is_paired(id)) {
                    break;
                }
                continue;
            }
            message = receiver.next() => message,
        };
        if device_id
            .as_ref()
            .is_some_and(|id| !app.devices.is_paired(id))
        {
            break;
        }
        let Some(Ok(msg)) = message else { break };
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
                    request_id: None,
                    code: None,
                    retryable: false,
                });
            }
        }
    }

    // Connection closed: tear down terminals, in-flight turns, and hub unicast
    // registrations so no sender leaks to this dead connection.
    state.terminals.dispose_all();
    state
        .app
        .workspace_terminals
        .release_connection(&state.conn_id);
    // Task 1: detach this connection as a viewer from every shared agent
    // terminal it holds — the terminal itself only dies once its *last*
    // viewer detaches (or the child exits on its own); a second viewer
    // elsewhere must not be torn down just because this tab/device closed.
    {
        let terminal_agent_sessions = state.terminal_agent_sessions.lock().unwrap().clone();
        for session_id in terminal_agent_sessions.values() {
            state.app.agent_terminals.detach(session_id, &state.conn_id);
        }
    }
    if let Ok(client) = connection_client_identity(&state) {
        let keys = state
            .agent_views
            .lock()
            .unwrap()
            .drain()
            .map(|(key, _)| key)
            .collect::<Vec<_>>();
        for key in keys {
            let _ = state.app.agent_runtime.detach(&key, &client);
        }
    }
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

/// Capabilities are intentionally limited to handlers implemented in this
/// slice. In particular, `workspace.sleep` is absent until the terminal and
/// agent ownership rules can make sleeping safe.
fn foundation_capabilities() -> Vec<String> {
    [
        "project.list",
        "project.create",
        "project.rename",
        "project.archive",
        "project.focus",
        "workspace.snapshot",
        "workspace.focus",
        "workspace.rename",
        "workspace.restore",
        "session.mode.get",
        "session.mode.set",
        "agent.manifest.list",
        "agent.provider.configure",
        "agent.ui.get",
        "agent.ui.prompt",
        "agent.ui.cancel",
        "agent.terminal.open",
        "agent.terminal.release",
        "agent.lifecycle.get",
        "agent.control.acquire",
        "agent.control.release",
        "terminal.open",
        "terminal.list",
        "terminal.release",
        "terminal.close",
        "fs.tree",
        "fs.read",
        "fs.preview",
        "fs.write",
        "fs.buffer.list",
        "fs.buffer.get",
        "fs.buffer.set",
        "fs.buffer.close",
        "git.status",
        "git.refs",
        "git.diff",
        "git.stage",
        "git.unstage",
        "git.discard.preview",
        "git.discard",
        "git.commit.preview",
        "git.commit",
        "review.list",
        "review.create",
        "review.update",
        "review.resolve",
        "review.delete",
        "review.batch.preview",
        "review.batch.send",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

fn request_error(
    request_id: impl Into<Option<String>>,
    code: impl Into<Option<String>>,
    message: impl Into<String>,
    retryable: bool,
) -> ServerMessage {
    ServerMessage::Error {
        message: message.into(),
        request_id: request_id.into(),
        code: code.into(),
        retryable,
    }
}

/// Send a `ServerMessage::Error` and ignore a closed channel, exactly like
/// the 101 call sites this replaces. Behavior must stay byte-identical to
/// each site's original `request_error(...)` call: same `code`, `message`,
/// `retryable`, and `request_id` optionality — do not normalize divergent
/// error codes or retryable flags.
fn fail(
    out_tx: &UnboundedSender<ServerMessage>,
    request_id: impl Into<Option<String>>,
    code: &str,
    message: impl Into<String>,
    retryable: bool,
) {
    let _ = out_tx.send(request_error(
        request_id,
        Some(code.to_string()),
        message,
        retryable,
    ));
}

/// Shared wall-clock helper (git preview expiry, review timestamps, prompt
/// dispatch settlement) — kept here rather than in any one domain module
/// since it's used well beyond git.rs/review.rs.
fn wall_clock_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0)
}

/// Forward a request to the remote host that owns `session_id`, if any.
/// Registers the unicast pending-request key before forwarding so the hub
/// can route the reply back to this exact connection, or fails with
/// `host_unavailable` when the owning host is known but not connected.
/// Returns `true` when the session is remote (handled or failed here) — the
/// caller must return immediately in that case; `false` means the session is
/// local and the caller should continue its own handling.
fn route_to_remote_host_or_fail(
    state: &Arc<ConnState>,
    session_id: &str,
    request_id: &str,
    raw_text: &str,
) -> bool {
    let Some(host_id) = state.app.hub.route_for_session(session_id) else {
        return false;
    };
    if !state.app.hub.is_connected(&host_id) {
        fail(
            &state.out_tx,
            request_id.to_string(),
            "host_unavailable",
            format!("host {host_id} is not connected"),
            true,
        );
        return true;
    }
    state.app.hub.register_unicast(
        PendingKey::Request(request_id.to_string()),
        state.conn_id.clone(),
        state.out_tx.clone(),
    );
    state.app.hub.forward(&host_id, raw_text);
    true
}

fn wire_session_mode(mode: AgentMode) -> WireSessionMode {
    match mode {
        AgentMode::Hosted => WireSessionMode::Hosted,
        AgentMode::Cli => WireSessionMode::Cli,
    }
}

fn fleet_session_mode(mode: WireSessionMode) -> AgentMode {
    match mode {
        WireSessionMode::Hosted => AgentMode::Hosted,
        WireSessionMode::Cli => AgentMode::Cli,
    }
}

/// Resolve a session's server-owned workspace id. A caller may echo the id
/// for routing, but it cannot select a different workspace by putting one in
/// the request. In-memory sessions have no durable workspace until their first
/// activity, so they may only use the session scope.
fn mode_workspace_for_session(
    state: &Arc<ConnState>,
    session_id: &str,
    requested_workspace_id: Option<&str>,
) -> Result<Option<String>, String> {
    let row = state
        .app
        .db
        .get_session(session_id)
        .map_err(|error| format!("could not read session mode target: {error}"))?;
    let workspace_id = if let Some(row) = row {
        row.workspace_id
    } else if state.runtimes.lock().unwrap().contains_key(session_id) {
        None
    } else {
        return Err(format!("unknown session {session_id}"));
    };
    if let Some(requested) = requested_workspace_id {
        if workspace_id.as_deref() != Some(requested) {
            return Err(
                "workspaceId does not match the session's server-owned workspace".to_string(),
            );
        }
    }
    Ok(workspace_id)
}

fn effective_session_mode(
    state: &Arc<ConnState>,
    device_id: &str,
    session_id: &str,
    workspace_id: Option<&str>,
) -> Result<(AgentMode, SessionModeScope, u64), String> {
    // Resolve both values in one SQLite read transaction. Independent reads
    // could straddle a concurrent mutation and label stale mode state current.
    let (mode, source, policy_revision) = state
        .app
        .agent_persistence
        .resolve_mode_with_revision(device_id, session_id, workspace_id)
        .map_err(|error| error.to_string())?;
    let source = match source {
        EffectiveModeScope::Session => SessionModeScope::Session,
        EffectiveModeScope::Workspace => SessionModeScope::Workspace,
        EffectiveModeScope::Device => SessionModeScope::Device,
        EffectiveModeScope::Default => SessionModeScope::Default,
    };
    Ok((mode, source, policy_revision))
}

fn project_mode_to_lifecycle(
    state: &Arc<ConnState>,
    session_id: &str,
    mode: AgentMode,
    revision: u64,
) {
    let keys = state
        .app
        .agent_runtime
        .lifecycle()
        .list()
        .into_iter()
        .filter(|snapshot| snapshot.key.session_id == session_id)
        .map(|snapshot| snapshot.key)
        .collect::<Vec<_>>();
    if keys.is_empty() {
        return;
    }
    let mut modes = state.app.agent_modes.lock().unwrap();
    for key in keys {
        modes.insert(key, (mode, revision.max(1)));
    }
}

fn persist_agent_runtime(app: &AppState, key: &AgentKey) -> anyhow::Result<()> {
    if !app.db.session_exists(&key.session_id)? {
        return Ok(());
    }
    let snapshot = app.agent_runtime.snapshot(key)?;
    let (mode, revision) = app
        .agent_modes
        .lock()
        .unwrap()
        .get(key)
        .copied()
        .unwrap_or((AgentMode::Cli, 1));
    app.agent_persistence.save_snapshot(
        &crate::agent_persistence::PersistedAgentSnapshot::new(snapshot, mode)
            .with_mode_revision(revision),
    )
}

/// Publish a foundation metadata row to every connected client. The caller
/// holds `foundation_lock` through this call and the corresponding DB
/// mutation, revision allocation, and local reply.
fn broadcast_foundation(app: &AppState, message: ServerMessage) {
    let _ = app.hub.hub_events_tx.send(Arc::new(message));
}

fn route_git_review_request(
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
        PendingKey::Request(request_id.to_string()),
        state.conn_id.clone(),
        state.out_tx.clone(),
    );
    state.app.hub.forward(target, &strip_host_id(raw_text));
    true
}

/// Insert `session_id` into the running set and fire the broadcast channel so
/// all connected clients receive a `session.updated` with `status: "running"`.
/// Errors are ignored — a missed broadcast is not fatal.
fn notify_session_updated(app: &AppState, session_id: &str) {
    // Every running/idle transition in the process reaches this function, so
    // it is where an agent turn's Git boundary is recorded (see
    // `agent_history`); the call is a no-op unless the flag actually moved.
    agent_history::observe_session(app, session_id);
    let _ = app.session_events_tx.send(SessionUpdatedEvent {
        session_id: session_id.to_string(),
    });
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

// ---------------------------------------------------------------------------
// Stage D: settings/hosts wire <-> store conversion helpers
// ---------------------------------------------------------------------------

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
        let start = (cutoff..=tail.len())
            .find(|&i| tail.is_char_boundary(i))
            .unwrap_or(0);
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
            Regex::new(
                r"(?i)allow command\?|action required|press enter to confirm or esc to cancel",
            )
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
        assert!(
            !tail.contains('\x1b'),
            "ANSI codes must be stripped: {tail:?}"
        );
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

    /// CLI-attach argv choice: `Some(true)`/`Some(false)` decide
    /// `--resume` vs `--session-id`, and a missing projects dir must stay
    /// "unknown" (`None`) so the conservative `--resume` path is kept.
    #[test]
    fn claude_conversation_probe_finds_transcripts_in_any_project_dir() {
        let root = std::env::temp_dir().join(format!("perch-probe-{}", Uuid::new_v4()));
        let projects = root.join("projects");
        assert_eq!(claude_conversation_exists_in(&projects, "abc"), None);

        std::fs::create_dir_all(projects.join("-tmp-one")).unwrap();
        std::fs::create_dir_all(projects.join("-tmp-two")).unwrap();
        assert_eq!(claude_conversation_exists_in(&projects, "abc"), Some(false));

        std::fs::write(projects.join("-tmp-two").join("abc.jsonl"), b"{}").unwrap();
        assert_eq!(claude_conversation_exists_in(&projects, "abc"), Some(true));
        assert_eq!(
            claude_conversation_exists_in(&projects, "other"),
            Some(false)
        );

        std::fs::remove_dir_all(&root).ok();
    }
}

#[cfg(test)]
mod session_viewer_filter_tests {
    use super::*;

    /// A connection that observes no agent at all — the default for the
    /// session-scoped variants, which never consult it.
    fn none(_session: &str, _agent: &str) -> bool {
        false
    }

    fn viewers_of(session_id: &str, conn_ids: &[&str]) -> HashMap<String, HashSet<String>> {
        let mut map = HashMap::new();
        map.insert(
            session_id.to_string(),
            conn_ids.iter().map(|c| c.to_string()).collect(),
        );
        map
    }

    #[test]
    fn native_transcripts_only_reach_viewers_of_their_session() {
        let msg: ServerMessage = serde_json::from_value(serde_json::json!({
            "type": "agent.ui.snapshot", "sessionId": "s1", "providerId": "pi",
            "snapshot": { "version": 1, "revision": 1, "pid": 123, "providerSessionId": "/native.jsonl", "cwd": "/workspace", "model": null, "running": false, "messages": [], "truncated": false }
        })).unwrap();
        let viewers = viewers_of("s1", &["conn-a"]);
        assert!(should_forward_to_viewer(&msg, "conn-a", &viewers, none));
        assert!(!should_forward_to_viewer(&msg, "conn-b", &viewers, none));
        assert!(!should_forward_to_viewer(
            &msg,
            "conn-a",
            &HashMap::new(),
            none
        ));
    }

    /// A browser tab can show two native chats at once, but a connection has
    /// only one active session, so viewer membership alone leaves the
    /// unfocused pane frozen. Observing that agent is enough.
    #[test]
    fn a_native_snapshot_reaches_a_connection_observing_that_agent_elsewhere() {
        let msg: ServerMessage = serde_json::from_value(serde_json::json!({
            "type": "agent.ui.snapshot", "sessionId": "s2", "providerId": "pi",
            "snapshot": { "version": 1, "revision": 1, "pid": 123, "providerSessionId": "/native.jsonl", "cwd": "/workspace", "model": null, "running": false, "messages": [], "truncated": false }
        })).unwrap();
        // conn-a is viewing a *different* session, s1.
        let viewers = viewers_of("s1", &["conn-a"]);
        let observes_s2_pi = |session: &str, agent: &str| session == "s2" && agent == "pi";
        assert!(should_forward_to_viewer(
            &msg,
            "conn-a",
            &viewers,
            observes_s2_pi
        ));
        // Observing a different provider in that session is not enough, and a
        // connection observing nothing still gets nothing.
        let observes_s2_codex = |session: &str, agent: &str| session == "s2" && agent == "codex";
        assert!(!should_forward_to_viewer(
            &msg,
            "conn-a",
            &viewers,
            observes_s2_codex
        ));
        assert!(!should_forward_to_viewer(&msg, "conn-a", &viewers, none));
        // The chat stream stays strictly session-scoped even for an observer.
        let chunk = ServerMessage::ChatChunk {
            session_id: "s2".to_string(),
            text: "hi".to_string(),
        };
        assert!(!should_forward_to_viewer(
            &chunk,
            "conn-a",
            &viewers,
            observes_s2_pi
        ));
    }

    #[test]
    fn chat_chunk_forwards_to_a_viewer_of_its_session() {
        let msg = ServerMessage::ChatChunk {
            session_id: "s1".to_string(),
            text: "hi".to_string(),
        };
        let viewers = viewers_of("s1", &["conn-a", "conn-b"]);
        assert!(should_forward_to_viewer(&msg, "conn-a", &viewers, none));
    }

    #[test]
    fn chat_chunk_drops_for_a_connection_not_viewing_that_session() {
        let msg = ServerMessage::ChatChunk {
            session_id: "s1".to_string(),
            text: "hi".to_string(),
        };
        let viewers = viewers_of("s1", &["conn-a"]);
        assert!(!should_forward_to_viewer(&msg, "conn-b", &viewers, none));
    }

    #[test]
    fn chat_done_drops_when_session_has_no_viewers_entry_at_all() {
        let msg = ServerMessage::ChatDone {
            session_id: "s1".to_string(),
            usage: None,
        };
        let viewers: HashMap<String, HashSet<String>> = HashMap::new();
        assert!(!should_forward_to_viewer(&msg, "conn-a", &viewers, none));
    }

    #[test]
    fn chat_thinking_tool_use_tool_result_and_plan_are_all_session_scoped() {
        let viewers = viewers_of("s1", &["conn-a"]);
        let thinking = ServerMessage::ChatThinking {
            session_id: "s1".to_string(),
            text: "thinking".to_string(),
        };
        let tool_use = ServerMessage::ChatToolUse {
            session_id: "s2".to_string(),
            name: "Bash".to_string(),
            input: serde_json::Value::Null,
        };
        let tool_result = ServerMessage::ChatToolResult {
            session_id: "s2".to_string(),
            name: "Bash".to_string(),
            result: serde_json::Value::Null,
        };
        let plan = ServerMessage::ChatPlan {
            session_id: "s2".to_string(),
            content: "plan".to_string(),
        };
        assert!(should_forward_to_viewer(
            &thinking, "conn-a", &viewers, none
        ));
        assert!(!should_forward_to_viewer(
            &tool_use, "conn-a", &viewers, none
        ));
        assert!(!should_forward_to_viewer(
            &tool_result,
            "conn-a",
            &viewers,
            none
        ));
        assert!(!should_forward_to_viewer(&plan, "conn-a", &viewers, none));
    }

    #[test]
    fn global_and_sidebar_messages_forward_regardless_of_viewer_state() {
        let viewers: HashMap<String, HashSet<String>> = HashMap::new();
        let session_updated = ServerMessage::SessionUpdated {
            session: SessionSummary {
                id: "s1".to_string(),
                title: "t".to_string(),
                cwd: "/tmp".to_string(),
                created_at: 0,
                last_agent: None,
                last_model: None,
                status: SessionStatus::Idle,
                host_id: "local".to_string(),
                cli_started: false,
                cli_provider_id: None,
                archived: false,
                unseen: false,
                blocked: false,
                stale: false,
                project_id: None,
                workspace_id: None,
            },
        };
        let workspace_git = ServerMessage::WorkspaceGit {
            host_id: "local".to_string(),
            cwd: "/tmp".to_string(),
            branch: None,
            ahead: 0,
            behind: 0,
        };
        let host_state = ServerMessage::HostInfo {
            host_id: "h1".to_string(),
            name: "host".to_string(),
            state: "connected".to_string(),
            error: None,
            hostname: None,
            platform: None,
            is_ssh: None,
            claude_models: None,
            codex_models: None,
        };
        let bare_error = ServerMessage::Error {
            message: "boom".to_string(),
            request_id: None,
            code: None,
            retryable: false,
        };
        assert!(should_forward_to_viewer(
            &session_updated,
            "conn-a",
            &viewers,
            none
        ));
        assert!(should_forward_to_viewer(
            &workspace_git,
            "conn-a",
            &viewers,
            none
        ));
        assert!(should_forward_to_viewer(
            &host_state,
            "conn-a",
            &viewers,
            none
        ));
        assert!(should_forward_to_viewer(
            &bare_error,
            "conn-a",
            &viewers,
            none
        ));
    }
}

#[cfg(test)]
mod foundation_focus_tests {
    use super::*;

    fn project(id: &str, archived: bool) -> crate::db::ProjectRow {
        crate::db::ProjectRow {
            id: id.to_string(),
            host_id: "local".to_string(),
            name: id.to_string(),
            path: format!("/tmp/{id}"),
            repo_path: None,
            default_branch: None,
            favorite: false,
            archived,
            settings: None,
            created_at: 0,
            updated_at: 0,
        }
    }

    fn workspace(id: &str, project_id: &str, state: &str) -> crate::db::WorkspaceRow {
        crate::db::WorkspaceRow {
            id: id.to_string(),
            project_id: project_id.to_string(),
            host_id: "local".to_string(),
            path: format!("/tmp/{project_id}"),
            name: id.to_string(),
            branch: None,
            base_branch: None,
            dirty: false,
            start_snapshot: None,
            parent_workspace_id: None,
            state: state.to_string(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn each_connection_keeps_its_own_focus_over_persisted_seed() {
        let projects = vec![project("p1", false), project("p2", false)];
        let workspaces = vec![
            workspace("w1", "p1", "active"),
            workspace("w2", "p2", "active"),
        ];

        let a = effective_focus(
            &projects,
            &workspaces,
            Some("p1"),
            Some("w1"),
            Some("p2"),
            Some("w2"),
        );
        let b = effective_focus(
            &projects,
            &workspaces,
            Some("p2"),
            Some("w2"),
            Some("p1"),
            Some("w1"),
        );
        assert_eq!(a, (Some("p1".to_string()), Some("w1".to_string())));
        assert_eq!(b, (Some("p2".to_string()), Some("w2".to_string())));
    }

    #[test]
    fn archived_connection_focus_falls_back_to_active_persisted_pair() {
        let projects = vec![project("p1", true), project("p2", false)];
        let workspaces = vec![
            workspace("w1", "p1", "archived"),
            workspace("w2", "p2", "active"),
        ];
        let selected = effective_focus(
            &projects,
            &workspaces,
            Some("p1"),
            Some("w1"),
            Some("p2"),
            Some("w2"),
        );
        assert_eq!(selected, (Some("p2".to_string()), Some("w2".to_string())));
    }
}

#[cfg(test)]
mod filesystem_buffer_tests {
    use super::*;
    use std::collections::HashMap;

    fn temp_db_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "perch-server-fs-test-{name}-{}.sqlite",
            Uuid::new_v4()
        ))
    }

    /// Shared setup for these tests: a temp project root with one file
    /// (`note.txt`), a fresh DB with that project's default workspace, and an
    /// initial (clean) file buffer seeded from the file's current content.
    #[allow(clippy::type_complexity)]
    fn fixture(
        name: &str,
    ) -> (
        PathBuf,
        PathBuf,
        HistoryDb,
        crate::db::WorkspaceRow,
        FileService,
        crate::filesystem::FileRead,
        FileBufferRow,
    ) {
        let db_path = temp_db_path(name);
        let root = std::env::temp_dir().join(format!("perch-server-fs-root-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("note.txt"), b"base").unwrap();
        let db = HistoryDb::open(&db_path).unwrap();
        let (_, workspace) = db
            .create_project("local", &root.to_string_lossy(), None, None)
            .unwrap();
        let service = FileService::new(&root).unwrap();
        let baseline = service.read_file("note.txt").unwrap();
        let initial = db
            .ensure_file_buffer(
                &workspace.id,
                "note.txt",
                FileBufferUpdate {
                    content: baseline.content.clone(),
                    base_content: baseline.content.clone(),
                    base_version: Some(baseline.version.clone()),
                    external_version: Some(baseline.version.clone()),
                    dirty: false,
                    conflict: false,
                },
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        (db_path, root, db, workspace, service, baseline, initial)
    }

    #[test]
    fn watcher_rereads_current_draft_after_metadata_queue_snapshot() {
        let (db_path, root, db, workspace, service, baseline, initial) =
            fixture("watch-current-row");
        let queued = db
            .list_file_buffers_for_watch(MAX_FILE_BUFFER_WATCHES)
            .unwrap()
            .into_iter()
            .find(|row| row.workspace_id == workspace.id && row.path == "note.txt")
            .unwrap();

        // The watcher has already taken its metadata queue snapshot. A draft
        // arrives before it takes the path lock, and the external file then
        // changes. The helper must use the current dirty row, preserving its
        // text; using `queued.dirty == false` would overwrite it with disk.
        let draft = db
            .set_file_buffer(
                &workspace.id,
                "note.txt",
                FileBufferUpdate {
                    content: "local draft".to_string(),
                    base_content: baseline.content.clone(),
                    base_version: Some(baseline.version.clone()),
                    external_version: Some(baseline.version.clone()),
                    dirty: true,
                    conflict: false,
                },
                Some(initial.revision),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        std::fs::write(root.join("note.txt"), b"external change").unwrap();

        let mut cache = HashMap::new();
        let observation = observe_one_watched_file(&db, &service, &queued, &mut cache, true)
            .expect("changed file should produce an observation");
        assert!(observation.conflict);
        let current = db
            .get_file_buffer(&workspace.id, "note.txt")
            .unwrap()
            .unwrap();
        assert_eq!(current.content, draft.content);
        assert_eq!(current.base_content, baseline.content);
        assert!(current.dirty);
        assert!(current.conflict);

        drop(db);
        std::fs::remove_dir_all(&root).ok();
        std::fs::remove_file(&db_path).ok();
    }

    #[test]
    fn save_intent_recovery_retains_unpublished_and_records_completed_receipts() {
        let (db_path, root, db, workspace, service, baseline, initial) = fixture("save-recovery");
        let file_path = root.join("note.txt");
        let draft = db
            .set_file_buffer(
                &workspace.id,
                "note.txt",
                FileBufferUpdate {
                    content: "draft".to_string(),
                    base_content: baseline.content.clone(),
                    base_version: Some(baseline.version.clone()),
                    external_version: Some(baseline.version.clone()),
                    dirty: true,
                    conflict: false,
                },
                Some(initial.revision),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        let draft_version = FileService::version_for_bytes(b"draft");

        // An interruption before publication leaves both the draft and the
        // intent for a future recovery pass.
        let unpublished = db
            .begin_file_save_intent(
                "op-unpublished",
                &workspace.id,
                "note.txt",
                "draft",
                &draft_version,
                Some(draft.revision),
            )
            .unwrap();
        std::fs::remove_file(&file_path).unwrap();
        assert!(recover_one_file_save_intent(&db, &service, &unpublished).is_err());
        assert!(db
            .list_file_save_intents(8)
            .unwrap()
            .iter()
            .any(|intent| intent.operation_id == "op-unpublished"));
        assert_eq!(
            db.get_file_buffer(&workspace.id, "note.txt")
                .unwrap()
                .unwrap()
                .content,
            "draft"
        );

        // Once the intended bytes are present, recovery reconciles the row
        // and records a receipt that a retried request can replay.
        std::fs::write(&file_path, b"draft").unwrap();
        let completed = recover_one_file_save_intent(&db, &service, &unpublished)
            .unwrap()
            .unwrap();
        assert!(!completed.dirty);
        assert!(!completed.conflict);
        assert!(db
            .get_file_save_operation("op-unpublished")
            .unwrap()
            .is_some());
        assert!(db
            .list_file_save_intents(8)
            .unwrap()
            .iter()
            .all(|intent| intent.operation_id != "op-unpublished"));

        // Crash after row reconciliation but before receipt insertion: the
        // exact content/base/version row is recognized and its revision is
        // not advanced a second time.
        let op_revision = completed.revision;
        let after_reconcile = db
            .begin_file_save_intent(
                "op-after-reconcile",
                &workspace.id,
                "note.txt",
                "draft",
                &draft_version,
                Some(op_revision),
            )
            .unwrap();
        let reconciled = db
            .reconcile_file_buffer_after_save(
                &workspace.id,
                "note.txt",
                "draft",
                &draft_version,
                Some(op_revision),
            )
            .unwrap()
            .unwrap();
        let recovered = recover_one_file_save_intent(&db, &service, &after_reconcile)
            .unwrap()
            .unwrap();
        assert_eq!(recovered.revision, reconciled.revision);
        assert!(db
            .get_file_save_operation("op-after-reconcile")
            .unwrap()
            .is_some());

        // A later editor revision survives recovery and is made explicitly
        // conflicted; it is never replaced by the older saved content.
        let newer_intent = db
            .begin_file_save_intent(
                "op-newer-draft",
                &workspace.id,
                "note.txt",
                "draft",
                &draft_version,
                Some(recovered.revision),
            )
            .unwrap();
        let newer = db
            .set_file_buffer(
                &workspace.id,
                "note.txt",
                FileBufferUpdate {
                    content: "newer draft".to_string(),
                    base_content: "draft".to_string(),
                    base_version: Some(draft_version.clone()),
                    external_version: Some(draft_version.clone()),
                    dirty: true,
                    conflict: false,
                },
                Some(recovered.revision),
                MAX_FILE_BUFFERS_PER_WORKSPACE,
            )
            .unwrap();
        let preserved = recover_one_file_save_intent(&db, &service, &newer_intent)
            .unwrap()
            .unwrap();
        assert_eq!(preserved.content, newer.content);
        assert!(preserved.dirty);
        assert!(preserved.conflict);
        assert!(db
            .get_file_save_operation("op-newer-draft")
            .unwrap()
            .is_some());

        drop(db);
        std::fs::remove_dir_all(&root).ok();
        std::fs::remove_file(&db_path).ok();
    }
}

#[cfg(test)]
mod review_delivery_tests {
    use super::*;

    fn temp_db_path() -> PathBuf {
        std::env::temp_dir().join(format!(
            "perch-review-delivery-{}-{}.sqlite",
            std::process::id(),
            Uuid::new_v4()
        ))
    }

    fn packet() -> crate::review::ReviewPacket {
        crate::review::ReviewPacket {
            packet_id: "packet-retry".to_string(),
            idempotency_key: "review-send:operation-retry".to_string(),
            send_operation_id: "operation-retry".to_string(),
            workspace_id: "workspace-retry".to_string(),
            target_session_id: Some("session-retry".to_string()),
            target_agent_id: Some("claude".to_string()),
            current_revision: "revision-retry".to_string(),
            comments: Vec::new(),
            markdown: "Please review the anchored note.".to_string(),
        }
    }

    #[test]
    fn live_retry_preserves_queued_and_claimed_delivery_states() {
        let db_path = temp_db_path();
        let db = HistoryDb::open(&db_path).unwrap();
        db.create_session("session-retry", "/tmp/perch-review-retry")
            .unwrap();
        db.reserve_prompt_operation(
            "operation-retry",
            "session-retry",
            Some("workspace-retry"),
            "digest-retry",
            "Please review the anchored note.",
            Some("claude"),
            None,
        )
        .unwrap();
        db.insert_review_packet(&packet(), 1).unwrap();

        // A retry can race the original sender between reservation and its
        // CAS claim. Observing the queued prompt must leave the packet
        // dispatchable so the original sender still owns the only launch.
        let queued = settle_review_packet_from_db(
            &db,
            "packet-retry",
            "operation-retry",
            "workspace-retry",
            "queued",
        )
        .unwrap();
        assert_eq!(queued.state, "queued");
        assert_eq!(
            db.get_prompt_operation("operation-retry")
                .unwrap()
                .unwrap()
                .state,
            "queued"
        );

        // Once the original sender has claimed both durable rows, a live
        // retry must observe the in-flight state and wait. It cannot mark the
        // packet unconfirmed or create a second provider turn.
        let (_, packet_won) = db
            .claim_review_packet("packet-retry", "operation-retry", "workspace-retry", 2)
            .unwrap()
            .unwrap();
        assert!(packet_won);
        assert!(
            db.claim_prompt_operation("operation-retry")
                .unwrap()
                .unwrap()
                .won_claim
        );
        let claimed = settle_review_packet_from_db(
            &db,
            "packet-retry",
            "operation-retry",
            "workspace-retry",
            "claimed",
        )
        .unwrap();
        assert_eq!(claimed.state, "claimed");
        assert_eq!(
            db.get_prompt_operation("operation-retry")
                .unwrap()
                .unwrap()
                .state,
            "claimed"
        );

        // Positive provider progress is the only terminal success signal;
        // the shared transaction settles both outbox rows together.
        let delivered = settle_review_packet_from_db(
            &db,
            "packet-retry",
            "operation-retry",
            "workspace-retry",
            "delivered",
        )
        .unwrap();
        assert_eq!(delivered.state, "delivered");
        assert_eq!(
            db.get_prompt_operation("operation-retry")
                .unwrap()
                .unwrap()
                .state,
            "delivered"
        );

        drop(db);
        std::fs::remove_file(db_path).ok();
    }
}

#[cfg(test)]
mod boot_smoke_tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn browser_origin_and_live_device_revocation_gate_the_socket() {
        use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message as WsMessage};
        let root = std::env::temp_dir().join(format!("perch-access-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let devices_path = root.join("devices.json");
        let devices = crate::devices::DeviceStore::load(&devices_path);
        let now = std::time::Instant::now();
        let code = devices.start_pairing(now);
        let paired = devices.claim(&code, "test phone", now, 1).unwrap();
        drop(devices);
        let db_path = root.join("history.sqlite");
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(run(
            ServerOptions {
                port: 0,
                base_path: "/".into(),
                web_dist_dir: root.join("web"),
                db_path: Some(db_path.clone()),
                hosts_path: Some(root.join("hosts.json")),
                providers_path: None,
                devices_path: Some(devices_path.clone()),
                ready_tx: Some(ready_tx),
            },
            Arc::new(SessionRegistry::new()),
            Arc::new(HistoryDb::open(&db_path).unwrap()),
            root.display().to_string(),
        ));
        let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
            .await
            .unwrap()
            .unwrap();
        let url = format!("ws://{address}/ws");
        let mut hostile = url.clone().into_client_request().unwrap();
        hostile
            .headers_mut()
            .insert("origin", "https://untrusted.example".parse().unwrap());
        let error = tokio_tungstenite::connect_async(hostile).await.unwrap_err();
        assert!(
            matches!(error, tokio_tungstenite::tungstenite::Error::Http(response) if response.status() == StatusCode::FORBIDDEN)
        );

        // A hostname pointing to loopback must not inherit local authority.
        let mut rebound = url.clone().into_client_request().unwrap();
        rebound
            .headers_mut()
            .insert("host", "phone.example".parse().unwrap());
        rebound
            .headers_mut()
            .insert("origin", "http://phone.example".parse().unwrap());
        let error = tokio_tungstenite::connect_async(rebound.clone())
            .await
            .unwrap_err();
        assert!(
            matches!(error, tokio_tungstenite::tungstenite::Error::Http(response) if response.status() == StatusCode::UNAUTHORIZED)
        );
        rebound.headers_mut().insert(
            "cookie",
            format!("perch_device={}", paired.token).parse().unwrap(),
        );
        let (mut phone, _) = tokio_tungstenite::connect_async(rebound.clone())
            .await
            .unwrap();
        let (mut host, _) = tokio_tungstenite::connect_async(&url).await.unwrap();
        host.send(WsMessage::Text(
            serde_json::json!({
                "type": "device.revoke", "requestId": "revoke", "deviceId": paired.record.id,
            })
            .to_string(),
        ))
        .await
        .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            while let Some(Ok(message)) = phone.next().await {
                if matches!(message, WsMessage::Close(_)) {
                    break;
                }
            }
        })
        .await
        .expect("revoked socket must close without another inbound message");
        assert!(crate::devices::DeviceStore::load(devices_path)
            .list()
            .is_empty());
        let error = tokio_tungstenite::connect_async(rebound).await.unwrap_err();
        assert!(
            matches!(error, tokio_tungstenite::tungstenite::Error::Http(response) if response.status() == StatusCode::UNAUTHORIZED)
        );
        host.close(None).await.ok();
        server.abort();
        let _ = server.await;
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn boot_validates_native_manifests_and_stays_bound() {
        let suffix = Uuid::new_v4();
        let db_path = std::env::temp_dir().join(format!("perch-boot-smoke-{suffix}.sqlite"));
        let hosts_path = std::env::temp_dir().join(format!("perch-boot-smoke-hosts-{suffix}.json"));
        let web_dist_dir = std::env::temp_dir().join(format!("perch-boot-smoke-web-{suffix}"));
        let db = Arc::new(HistoryDb::open(&db_path).expect("smoke database should open"));
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();

        let server = tokio::spawn(run(
            ServerOptions {
                // Port zero isolates this test from any user or CI service
                // and lets the OS choose a free loopback port.
                port: 0,
                base_path: "/".to_string(),
                web_dist_dir,
                db_path: Some(db_path.clone()),
                hosts_path: Some(hosts_path.clone()),
                providers_path: None,
                devices_path: Some(hosts_path.with_file_name("smoke-devices.json")),
                ready_tx: Some(ready_tx),
            },
            Arc::new(SessionRegistry::new()),
            db,
            std::env::temp_dir().display().to_string(),
        ));

        let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
            .await
            .expect("server should bind before the smoke timeout")
            .expect("server should report its bound address");
        assert!(address.ip().is_loopback());
        assert_ne!(address.port(), 0);

        // A successful ready signal proves initialization completed; a real
        // request also proves axum remained alive after the native registry
        // and persistence startup path ran.
        let mut stream = tokio::net::TcpStream::connect(address)
            .await
            .expect("bound server should accept a connection");
        stream
            .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            .await
            .expect("smoke request should write");
        let mut response = Vec::new();
        stream
            .read_to_end(&mut response)
            .await
            .expect("smoke response should read");
        let response = String::from_utf8_lossy(&response);
        assert!(
            response.starts_with("HTTP/1.1 200"),
            "unexpected response: {response}"
        );

        server.abort();
        let _ = server.await;
        std::fs::remove_file(db_path).ok();
        std::fs::remove_file(hosts_path).ok();
    }
}
