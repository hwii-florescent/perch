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
use axum::extract::{Query, State};
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
    workspace_terminals: Arc<crate::workspace_terminals::WorkspaceTerminals>,
    /// Process-wide provider/lifecycle bridge used by local CLI attaches.
    /// Keeping this beside the shared terminal registry prevents a second WS
    /// connection from launching a duplicate provider for the same session.
    agent_runtime: Arc<AgentRuntimeAdapter>,
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
    let agent_terminals = Arc::new(AgentTerminalRegistry::new(Arc::new(
        move |session_id: &str| {
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
                let _ = agent_activity_events_tx.send(SessionUpdatedEvent {
                    session_id: session_id.to_string(),
                });
            }
        },
    )));

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
    let agent_runtime = Arc::new(AgentRuntimeAdapter::new(
        Arc::new(provider_registry),
        agent_lifecycle,
        Arc::new(AgentTerminalRegistry::new(Arc::new(|_| {}))),
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
        agent_terminals,
        workspace_terminals,
        agent_runtime,
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
    spawn_filesystem_watch_task(state.clone());

    let mut router = Router::new()
        .route(&ws_path, get(ws_upgrade))
        .route(&clipboard_image_path, post(clipboard_image_upload))
        .route(&upload_path, post(attachment_upload))
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
    axum::serve(listener, router).await?;
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

fn spawn_agent_idle_sweep_task(state: AppState) {
    tokio::spawn(async move {
        let tick = AGENT_QUIET_THRESHOLD / 4;
        loop {
            tokio::time::sleep(tick).await;
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
    Query(params): Query<HashMap<String, String>>,
    body: Bytes,
) -> impl IntoResponse {
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

fn agent_str(agent: AgentKind) -> &'static str {
    match agent {
        AgentKind::Claude => "claude",
        AgentKind::Codex => "codex",
    }
}

fn operation_id_or_new(operation_id: Option<String>) -> String {
    operation_id
        .filter(|operation_id| !operation_id.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

/// Digest every input that can change the provider turn. The digest is stored
/// with the operation id so a reconnect cannot reuse an id for a different
/// session, provider, model, mode, or attachment set.
#[allow(clippy::too_many_arguments)]
fn prompt_payload_digest(
    session_id: &str,
    workspace_id: Option<&str>,
    host_id: &str,
    cwd: &str,
    text: &str,
    agent: AgentKind,
    model: Option<&str>,
    plan_mode: bool,
    effort: Option<&str>,
    attachments: &[String],
) -> String {
    let payload = (
        session_id,
        workspace_id,
        host_id,
        cwd,
        text,
        agent_str(agent),
        model,
        plan_mode,
        effort,
        attachments,
    );
    let encoded = serde_json::to_vec(&payload).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Reserve and claim one prompt before any provider process is started. A
/// duplicate operation in a terminal or unconfirmed state returns `None` and
/// must never launch another provider process.
#[allow(clippy::too_many_arguments)]
fn reserve_and_claim_prompt(
    app: &AppState,
    operation_id: &str,
    session_id: &str,
    workspace_id: Option<&str>,
    payload_digest: &str,
    text: &str,
    agent: AgentKind,
    model: Option<&str>,
) -> Result<Option<crate::db::PromptClaim>, String> {
    let (reserved, _) = app
        .db
        .reserve_prompt_operation(
            operation_id,
            session_id,
            workspace_id,
            payload_digest,
            text,
            Some(agent_str(agent)),
            model,
        )
        .map_err(|error| error.to_string())?;
    if reserved.state != "queued" {
        return Ok(None);
    }
    let claim = app
        .db
        .claim_prompt_operation(operation_id)
        .map_err(|error| error.to_string())?;
    Ok(claim.filter(|claim| claim.won_claim))
}

/// Settle a prompt dispatch and, when the operation belongs to a review
/// packet, settle the packet from that same durable outcome. The packet state
/// is never inferred from a socket call returning; it follows the persisted
/// prompt operation instead.
fn settle_prompt_dispatch(app: &AppState, operation_id: &str, state: &str) -> Result<(), String> {
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

fn report_settlement_failure(
    state: &Arc<ConnState>,
    session_id: &str,
    operation_id: &str,
    error: String,
) {
    tracing::error!(
        session_id,
        operation_id,
        error = %error,
        "failed to persist prompt dispatch outcome"
    );
    emit(
        state,
        session_id,
        ServerMessage::Error {
            message: format!("prompt operation {operation_id} could not be settled: {error}"),
            request_id: None,
            code: Some("prompt_dispatch_persistence_failed".to_string()),
            retryable: false,
        },
    );
}

/// Resolve the session and provider named by a review packet. A missing
/// provider is an error instead of silently selecting Claude, because a
/// packet sent to the wrong CLI cannot be recovered by retrying it.
fn resolve_review_target(
    app: &AppState,
    workspace_id: &str,
    target_session_id: Option<&str>,
    target_agent_id: Option<&str>,
) -> Result<(String, AgentKind), String> {
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
    let provider = target_agent_id
        .or(session.last_agent.as_deref())
        .ok_or_else(|| {
            "choose a target provider before sending review notes to a new session".to_string()
        })?;
    let agent = match provider {
        "claude" => AgentKind::Claude,
        "codex" => AgentKind::Codex,
        other => return Err(format!("unsupported target provider {other:?}")),
    };
    Ok((session_id.to_string(), agent))
}

/// Produce a stable aggregate for the exact source selected for each comment.
/// The comment id and target are included so two different source selections
/// cannot collapse to the same review snapshot by accident.
fn review_snapshot_revision(mut entries: Vec<(String, String, String, String, String)>) -> String {
    entries.sort();
    let encoded = serde_json::to_vec(&entries).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
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

fn claude_conversation_exists_in(projects: &Path, session_id: &str) -> Option<bool> {
    let file = format!("{session_id}.jsonl");
    let entries = std::fs::read_dir(projects).ok()?;
    for entry in entries.flatten() {
        if entry.path().join(&file).exists() {
            return Some(true);
        }
    }
    Some(false)
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

async fn handle_socket(socket: WebSocket, app: AppState) {
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
                !already_blocked && blocked_patterns().iter().any(|re| re.is_match(tail))
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
                    let summary = build_session_summary(row, &running, &unseen, &blocked);
                    drop(running);
                    drop(unseen);
                    drop(blocked);
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
                        should_forward_to_viewer(&msg, &hub_conn_id, &viewers)
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

fn status_message(status: crate::status::StatusInfo) -> ServerMessage {
    ServerMessage::StatusUpdate {
        cwd: status.cwd,
        branch: status.branch,
        context_tokens: status.context_tokens,
        cost_usd: status.cost_usd,
    }
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

/// Allocate a metadata revision. Callers must hold `foundation_lock` while
/// mutating the DB, allocating this value, and publishing the corresponding
/// event/snapshot; keeping the lock outside this helper makes nested snapshot
/// builders safe.
fn next_snapshot_revision_locked(app: &AppState) -> u64 {
    app.snapshot_revision
        .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        + 1
}

fn project_to_wire(row: crate::db::ProjectRow) -> ProjectSummary {
    ProjectSummary {
        id: row.id,
        host_id: row.host_id,
        name: row.name,
        path: row.path,
        repo_path: row.repo_path,
        default_branch: row.default_branch,
        favorite: row.favorite,
        archived: row.archived,
        settings: row
            .settings
            .and_then(|settings| serde_json::from_str(&settings).ok()),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn workspace_to_wire(row: crate::db::WorkspaceRow) -> WorkspaceSummary {
    WorkspaceSummary {
        id: row.id,
        project_id: row.project_id,
        host_id: row.host_id,
        path: row.path,
        name: row.name,
        branch: row.branch,
        base_branch: row.base_branch,
        dirty: row.dirty,
        start_snapshot: row.start_snapshot,
        parent_workspace_id: row.parent_workspace_id,
        state: match row.state.as_str() {
            "sleeping" => WorkspaceState::Sleeping,
            "archived" => WorkspaceState::Archived,
            _ => WorkspaceState::Active,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
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

fn lifecycle_control_key(key: &AgentKey, channel: ControlChannel) -> String {
    format!(
        "{}:{}:{}:{channel:?}",
        key.workspace_id, key.session_id, key.agent_id
    )
}

fn connection_client_identity(state: &Arc<ConnState>) -> Result<ClientIdentity, String> {
    ClientIdentity::new(state.conn_id.clone(), "local", ClientKind::Desktop)
        .map_err(|error| format!("connection identity is invalid: {error}"))
}

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

fn lifecycle_status_to_wire(
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

fn current_snapshot_revision_locked(app: &AppState) -> u64 {
    app.snapshot_revision
        .load(std::sync::atomic::Ordering::SeqCst)
}

/// Foundation requests never fall through to a local DB when a caller names
/// another host. Direct hosts have no project metadata service in this slice;
/// a later remote-capability path can replace this explicit refusal.
fn reject_non_local_foundation_host(
    host_id: Option<&str>,
    request_id: &str,
) -> Option<ServerMessage> {
    let host_id = host_id.unwrap_or("local").trim();
    if host_id.is_empty() || host_id == "local" {
        None
    } else {
        Some(request_error(
            Some(request_id.to_string()),
            Some("unsupported_remote".to_string()),
            format!("project/workspace metadata is not available on host {host_id}"),
            false,
        ))
    }
}

fn local_project(app: &AppState, project_id: &str) -> Option<crate::db::ProjectRow> {
    app.db
        .get_project(project_id)
        .ok()
        .flatten()
        .filter(|project| project.host_id == "local")
}

fn local_workspace(app: &AppState, workspace_id: &str) -> Option<crate::db::WorkspaceRow> {
    app.db
        .get_workspace(workspace_id)
        .ok()
        .flatten()
        .filter(|workspace| workspace.host_id == "local")
}

/// Choose a coherent active project/workspace pair from one connection's
/// local focus, then the persisted seed. Rows may have changed between two
/// requests (for example, another client archived the selected project), so
/// neither stored pair is trusted until both ids are present and active in the
/// snapshot being built.
fn effective_focus(
    projects: &[crate::db::ProjectRow],
    workspaces: &[crate::db::WorkspaceRow],
    connection_project_id: Option<&str>,
    connection_workspace_id: Option<&str>,
    persisted_project_id: Option<&str>,
    persisted_workspace_id: Option<&str>,
) -> (Option<String>, Option<String>) {
    let project_is_active = |project_id: &str| {
        projects
            .iter()
            .any(|project| project.id == project_id && !project.archived)
    };
    let workspace_is_active_for = |project_id: &str, workspace_id: &str| {
        workspaces.iter().any(|workspace| {
            workspace.id == workspace_id
                && workspace.project_id == project_id
                && workspace.state != "archived"
        })
    };
    let choose_for_project = |project_id: &str, preferred_workspace_id: Option<&str>| {
        if !project_is_active(project_id) {
            return None;
        }
        let workspace_id = preferred_workspace_id
            .filter(|workspace_id| workspace_is_active_for(project_id, workspace_id))
            .map(str::to_string)
            .or_else(|| {
                workspaces
                    .iter()
                    .find(|workspace| {
                        workspace.project_id == project_id && workspace.state != "archived"
                    })
                    .map(|workspace| workspace.id.clone())
            })?;
        Some((project_id.to_string(), workspace_id))
    };

    // A connection's own selection always wins over the persisted default,
    // but only while it still names a visible active pair.
    if let (Some(project_id), Some(workspace_id)) = (connection_project_id, connection_workspace_id)
    {
        if let Some(pair) = choose_for_project(project_id, Some(workspace_id)) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let Some(project_id) = connection_project_id {
        if let Some(pair) = choose_for_project(project_id, None) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let (Some(project_id), Some(workspace_id)) = (persisted_project_id, persisted_workspace_id) {
        if let Some(pair) = choose_for_project(project_id, Some(workspace_id)) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    if let Some(project_id) = persisted_project_id {
        if let Some(pair) = choose_for_project(project_id, None) {
            return (Some(pair.0), Some(pair.1));
        }
    }
    projects
        .iter()
        .filter(|project| !project.archived)
        .find_map(|project| choose_for_project(&project.id, None))
        .map(|(project_id, workspace_id)| (Some(project_id), Some(workspace_id)))
        .unwrap_or((None, None))
}

/// Build a workspace snapshot while `foundation_lock` is held. The DB's
/// persisted focus is only the fallback for a connection that has not
/// navigated yet; an established connection's local focus wins so one client
/// cannot steal another client's selection.
fn workspace_snapshot_locked(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: Option<String>,
) -> ServerMessage {
    if let Some(project_id) = project_id.as_deref() {
        let Some(project) = local_project(&state.app, project_id) else {
            return request_error(
                Some(request_id),
                Some("project_not_found".to_string()),
                "project is not present on the local host",
                false,
            );
        };
        if project.archived {
            return request_error(
                Some(request_id),
                Some("project_archived".to_string()),
                "project is archived",
                false,
            );
        }
    }
    match state
        .app
        .db
        .workspace_snapshot("local", project_id.as_deref())
    {
        Ok((projects, workspaces, active_project_id, active_workspace_id)) => {
            let connection_project_id = state.active_project_id.lock().unwrap().clone();
            let connection_workspace_id = state.active_workspace_id.lock().unwrap().clone();
            let (active_project_id, active_workspace_id) = effective_focus(
                &projects,
                &workspaces,
                connection_project_id.as_deref(),
                connection_workspace_id.as_deref(),
                active_project_id.as_deref(),
                active_workspace_id.as_deref(),
            );
            ServerMessage::WorkspaceSnapshot {
                request_id,
                host_id: "local".to_string(),
                snapshot_epoch: state.app.snapshot_epoch.clone(),
                snapshot_revision: current_snapshot_revision_locked(&state.app),
                projects: projects.into_iter().map(project_to_wire).collect(),
                workspaces: workspaces.into_iter().map(workspace_to_wire).collect(),
                active_project_id,
                active_workspace_id,
            }
        }
        Err(err) => request_error(
            Some(request_id),
            Some("workspace_snapshot_failed".to_string()),
            format!("workspace.snapshot failed: {err}"),
            true,
        ),
    }
}

/// Send a snapshot to one connection while `foundation_lock` is held. Focus
/// replies are intentionally unicast; metadata row events use
/// `broadcast_foundation` and reach the other clients without changing their
/// connection-local focus.
fn send_workspace_snapshot_locked(
    state: &Arc<ConnState>,
    request_id: String,
    project_id: Option<String>,
) {
    let message = workspace_snapshot_locked(state, request_id, project_id);
    let _ = state.out_tx.send(message);
}

fn send_workspace_snapshot(state: &Arc<ConnState>, request_id: String, project_id: Option<String>) {
    let _foundation_guard = state.app.foundation_lock.lock().unwrap();
    send_workspace_snapshot_locked(state, request_id, project_id);
}

/// Publish a foundation metadata row to every connected client. The caller
/// holds `foundation_lock` through this call and the corresponding DB
/// mutation, revision allocation, and local reply.
fn broadcast_foundation(app: &AppState, message: ServerMessage) {
    let _ = app.hub.hub_events_tx.send(Arc::new(message));
}

/// Errors raised before a workspace service exists are kept separate from
/// filesystem errors so the client can distinguish an expired/unknown durable
/// workspace from a path or file error inside a valid workspace.
#[derive(Debug)]
enum FsAdapterFailure {
    Workspace { code: &'static str, message: String },
    Filesystem(FsError),
    Buffer(FileBufferError),
    Task(String),
}

impl std::fmt::Display for FsAdapterFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Workspace { message, .. } | Self::Task(message) => f.write_str(message),
            Self::Filesystem(error) => error.fmt(f),
            Self::Buffer(error) => error.fmt(f),
        }
    }
}

const MAX_FILESYSTEM_OPERATION_LOCKS: usize = 1_024;

/// Return a bounded lock for one workspace/path operation. The overflow lock
/// keeps correctness when an attacker presents more distinct paths than the
/// lock table can retain, without allowing the table itself to grow without
/// bound.
fn filesystem_operation_lock(app: &AppState, workspace_id: &str, path: &str) -> Arc<Mutex<()>> {
    let key = format!("{workspace_id}\0{path}");
    let mut locks = app.filesystem_operation_locks.lock().unwrap();
    if let Some(lock) = locks.get(&key) {
        return lock.clone();
    }
    if locks.len() < MAX_FILESYSTEM_OPERATION_LOCKS {
        let lock = Arc::new(Mutex::new(()));
        locks.insert(key, lock.clone());
        lock
    } else {
        app.filesystem_operation_overflow.clone()
    }
}

fn file_buffer_to_wire(row: FileBufferRow) -> FileBuffer {
    FileBuffer {
        workspace_id: row.workspace_id,
        path: row.path,
        content: row.content,
        base_content: row.base_content,
        base_version: row.base_version,
        external_version: row.external_version,
        revision: row.revision,
        dirty: row.dirty,
        conflict: row.conflict,
        updated_at: row.updated_at,
    }
}

fn file_buffer_summary_to_wire(row: FileBufferMetadataRow) -> FileBufferSummary {
    FileBufferSummary {
        workspace_id: row.workspace_id,
        path: row.path,
        base_version: row.base_version,
        external_version: row.external_version,
        revision: row.revision,
        dirty: row.dirty,
        conflict: row.conflict,
        updated_at: row.updated_at,
    }
}

/// Resolve a durable local workspace id into a retained-descriptor filesystem
/// service. The caller never supplies a root path to an fs.* operation. Remote
/// workspace ids are rejected in this slice rather than accidentally opening
/// a same-looking path on the local host.
fn workspace_file_service(
    app: &AppState,
    workspace_id: &str,
) -> Result<FileService, FsAdapterFailure> {
    let workspace =
        app.db
            .resolve_workspace(workspace_id)
            .map_err(|error| FsAdapterFailure::Workspace {
                code: "workspace_unavailable",
                message: format!("workspace {workspace_id:?} is unavailable: {error}"),
            })?;
    if workspace.host_id != "local" {
        return Err(FsAdapterFailure::Workspace {
            code: "unsupported_remote",
            message: format!(
                "filesystem access is not available on workspace host {}",
                workspace.host_id
            ),
        });
    }
    let mut services = app.filesystem_services.lock().unwrap();
    if let Some(service) = services.get(workspace_id) {
        if service.root() != Path::new(&workspace.path) {
            return Err(FsAdapterFailure::Workspace {
                code: "workspace_path_changed",
                message: format!("workspace {workspace_id:?} path changed after authorization"),
            });
        }
        return Ok(service.clone());
    }
    let service = FileService::new(&workspace.path).map_err(FsAdapterFailure::Filesystem)?;
    services.insert(workspace_id.to_string(), service.clone());
    Ok(service)
}

/// Convert a bounded service error into the structured fs.error response. In
/// particular, conflicts preserve both hashes and current metadata so the UI
/// can compare/reload before an explicit overwrite.
fn fs_error_response(
    request_id: String,
    workspace_id: String,
    failure: FsAdapterFailure,
) -> ServerMessage {
    match failure {
        FsAdapterFailure::Workspace { code, message } => ServerMessage::FsError {
            request_id,
            workspace_id,
            code: code.to_string(),
            message,
            path: None,
            metadata: None,
            expected_version: None,
            actual_version: None,
            current: None,
            expected_buffer_revision: None,
            actual_buffer_revision: None,
            current_buffer: None,
        },
        FsAdapterFailure::Buffer(error) => {
            let message = error.to_string();
            match error {
                FileBufferError::Conflict { expected, current } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_conflict".to_string(),
                    message,
                    path: current.as_ref().map(|row| row.path.clone()),
                    metadata: None,
                    expected_version: None,
                    actual_version: current
                        .as_ref()
                        .and_then(|row| row.external_version.clone()),
                    current: None,
                    expected_buffer_revision: expected,
                    actual_buffer_revision: current.as_ref().map(|row| row.revision),
                    current_buffer: current.map(|row| Box::new(file_buffer_to_wire(*row))),
                },
                FileBufferError::Dirty { current } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "dirty_buffer".to_string(),
                    message,
                    path: Some(current.path.clone()),
                    metadata: None,
                    expected_version: None,
                    actual_version: current.external_version.clone(),
                    current: None,
                    expected_buffer_revision: Some(current.revision),
                    actual_buffer_revision: Some(current.revision),
                    current_buffer: Some(Box::new(file_buffer_to_wire(*current))),
                },
                FileBufferError::Limit { limit } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_limit".to_string(),
                    message: format!("workspace file buffer limit reached ({limit})"),
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                FileBufferError::ContentTooLarge { limit } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_too_large".to_string(),
                    message: format!("file buffer content exceeds the {limit}-byte limit"),
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                FileBufferError::Database { message } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_database_error".to_string(),
                    message,
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
            }
        }
        FsAdapterFailure::Task(message) => ServerMessage::FsError {
            request_id,
            workspace_id,
            code: "filesystem_task_failed".to_string(),
            message,
            path: None,
            metadata: None,
            expected_version: None,
            actual_version: None,
            current: None,
            expected_buffer_revision: None,
            actual_buffer_revision: None,
            current_buffer: None,
        },
        FsAdapterFailure::Filesystem(error) => {
            let message = error.to_string();
            match error {
                FsError::Conflict {
                    path,
                    expected,
                    actual,
                    current,
                } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "conflict".to_string(),
                    message,
                    path: Some(path),
                    metadata: None,
                    expected_version: expected,
                    actual_version: actual,
                    current: current.map(|metadata| *metadata),
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                error => {
                    let (code, path, metadata) = match &error {
                        FsError::InvalidConfig { .. } => ("invalid_config", None, None),
                        FsError::InvalidPath { path, .. } => {
                            ("invalid_path", Some(path.clone()), None)
                        }
                        FsError::Traversal { path } => {
                            ("traversal_refused", Some(path.clone()), None)
                        }
                        FsError::NotFound { path } => ("not_found", Some(path.clone()), None),
                        FsError::Symlink { path } => ("symlink_refused", Some(path.clone()), None),
                        FsError::NotRegularFile { path } => {
                            ("not_regular_file", Some(path.clone()), None)
                        }
                        FsError::TooLarge { path, metadata, .. } => {
                            ("too_large", Some(path.clone()), Some((**metadata).clone()))
                        }
                        FsError::Binary { path, metadata } => {
                            ("binary", Some(path.clone()), Some((**metadata).clone()))
                        }
                        FsError::Unsupported { path, .. } => {
                            ("unsupported", Some(path.clone()), None)
                        }
                        FsError::ChangedDuringRead { path } => {
                            ("changed_during_read", Some(path.clone()), None)
                        }
                        FsError::Io { path, .. } => ("filesystem_error", Some(path.clone()), None),
                        FsError::Conflict { .. } => unreachable!("conflict handled above"),
                    };
                    ServerMessage::FsError {
                        request_id,
                        workspace_id,
                        code: code.to_string(),
                        message,
                        path,
                        metadata,
                        expected_version: None,
                        actual_version: None,
                        current: None,
                        expected_buffer_revision: None,
                        actual_buffer_revision: None,
                        current_buffer: None,
                    }
                }
            }
        }
    }
}

/// Resolve a durable local workspace for a Git operation. Git callers never
/// receive a root path from the client: the DB row is authoritative and the
/// target canonicalizes that row before opening a subprocess.
fn git_workspace_target(app: &AppState, workspace_id: &str) -> Result<WorkspaceTarget, String> {
    let workspace = app
        .db
        .resolve_workspace(workspace_id)
        .map_err(|error| format!("workspace {workspace_id:?} is unavailable: {error}"))?;
    if workspace.host_id != "local" {
        return Err(format!(
            "Git access is not available on workspace host {}",
            workspace.host_id
        ));
    }
    WorkspaceTarget::new(workspace.id, workspace.path)
        .map_err(|error| format!("workspace {workspace_id:?} is not a valid Git target: {error}"))
}

fn git_error_response(request_id: String, error: GitError) -> ServerMessage {
    let code = match error {
        GitError::InvalidTarget(_) | GitError::InvalidPath(_) => "invalid_target",
        GitError::CommandFailed { .. } => "git_command_failed",
        GitError::TimedOut => "git_timeout",
        GitError::OutputLimit => "git_output_limit",
        GitError::InvalidRef(_) => "invalid_ref",
        GitError::InvalidPatch(_) => "invalid_patch",
        GitError::NoStagedChanges => "no_staged_changes",
        GitError::ConfirmationRequired => "confirmation_required",
        GitError::ConfirmationMismatch(_) => "confirmation_mismatch",
        GitError::Io(_) => "git_io_error",
        GitError::Parse(_) => "git_parse_error",
    };
    request_error(
        Some(request_id),
        Some(code.to_string()),
        error.to_string(),
        false,
    )
}

fn git_workspace_error(request_id: String, message: String) -> ServerMessage {
    request_error(
        Some(request_id),
        Some("workspace_unavailable".to_string()),
        message,
        false,
    )
}

/// Resolve `workspace_id` to a `WorkspaceTarget`, or send a
/// `git_workspace_error` reply and return `None`. This is the
/// `git_workspace_target(&app, &workspace_id)` resolve-or-send-error prelude
/// used at the top of every git.* arm; callers keep the original
/// `let target = match ... { Some(target) => target, None => return };`
/// shape.
fn resolve_git_target_or_fail(
    app: &AppState,
    workspace_id: &str,
    request_id: &str,
    out_tx: &UnboundedSender<ServerMessage>,
) -> Option<WorkspaceTarget> {
    match git_workspace_target(app, workspace_id) {
        Ok(target) => Some(target),
        Err(message) => {
            let _ = out_tx.send(git_workspace_error(request_id.to_string(), message));
            None
        }
    }
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

fn spawn_git_status(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    include_ignored: bool,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app
            .git
            .status(&target, source_control::StatusOptions { include_ignored })
            .await
        {
            Ok(status) => {
                let _ = out_tx.send(ServerMessage::GitStatusResult {
                    request_id,
                    workspace_id,
                    status,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_refs(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.branch_refs(&target).await {
            Ok(refs) => {
                let _ = out_tx.send(ServerMessage::GitRefsResult {
                    request_id,
                    workspace_id,
                    refs,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_git_diff(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    target: crate::source_control::DiffTarget,
    include_untracked: bool,
    ignore_whitespace: bool,
    context_lines: Option<u32>,
    path: Option<String>,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let workspace_target =
            match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
                Some(target) => target,
                None => return,
            };
        let options = DiffOptions {
            target,
            include_untracked,
            ignore_whitespace,
            context_lines: context_lines.unwrap_or(3),
            path,
        };
        match app.git.diff(&workspace_target, options).await {
            Ok(diff) => {
                let mut source_revisions = BTreeMap::new();
                for file in &diff.files {
                    if let Some(path) = file.old_path.as_deref() {
                        if let Ok(source) = app
                            .git
                            .review_source(&workspace_target, &diff.target, path, "old")
                            .await
                        {
                            source_revisions.insert(format!("{path}:old"), source.revision);
                        }
                    }
                    if let Some(path) = file.new_path.as_deref() {
                        if let Ok(source) = app
                            .git
                            .review_source(&workspace_target, &diff.target, path, "new")
                            .await
                        {
                            source_revisions.insert(format!("{path}:new"), source.revision);
                        }
                    }
                }
                let source_revisions = (!source_revisions.is_empty()).then_some(source_revisions);
                let source_revision = source_revisions.as_ref().map(|revisions| {
                    let encoded = serde_json::to_vec(revisions).unwrap_or_default();
                    let digest = Sha256::digest(encoded);
                    digest.iter().map(|byte| format!("{byte:02x}")).collect()
                });
                let _ = out_tx.send(ServerMessage::GitDiffResult {
                    request_id,
                    workspace_id,
                    target: diff.target,
                    files: diff.files,
                    hunk_count: diff.hunk_count,
                    truncated: diff.truncated,
                    source_revision,
                    source_revisions,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

const GIT_PREVIEW_TTL_MS: i64 = 60_000;

fn wall_clock_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0)
}

fn git_operation_name(operation: source_control::DestructiveOperation) -> String {
    match operation {
        source_control::DestructiveOperation::Commit => "commit".to_string(),
        source_control::DestructiveOperation::Discard(mode) => {
            format!(
                "discard:{}",
                serde_json::to_string(&mode).unwrap_or_default()
            )
        }
    }
}

fn git_preview_wire(
    preview_id: String,
    operation: String,
    workspace_id: String,
    paths: Vec<String>,
    status: source_control::GitStatus,
    message: Option<String>,
    expires_at: i64,
) -> crate::protocol::GitPreviewReceipt {
    crate::protocol::GitPreviewReceipt {
        preview_id,
        operation,
        workspace_id,
        paths,
        status,
        message,
        expires_at,
    }
}

fn send_git_action_error(
    out_tx: &UnboundedSender<ServerMessage>,
    request_id: String,
    message: impl Into<String>,
) {
    fail(out_tx, request_id, "git_action_failed", message, false);
}

fn spawn_git_path_action(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    paths: Option<Vec<String>>,
    patch: Option<String>,
    stage: bool,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let result = match (paths, patch) {
            (Some(paths), None) if !paths.is_empty() => {
                if stage {
                    app.git.stage_paths(&target, &paths).await
                } else {
                    app.git.unstage_paths(&target, &paths).await
                }
            }
            (None, Some(patch)) if !patch.is_empty() => {
                if stage {
                    app.git.stage_patch(&target, &patch).await
                } else {
                    app.git.unstage_patch(&target, &patch).await
                }
            }
            _ => Err(GitError::InvalidPatch(
                "exactly one non-empty paths or patch value is required".to_string(),
            )),
        };
        match result {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_discard_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    mode: DiscardMode,
    paths: Vec<String>,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.preview_discard(&target, mode, &paths).await {
            Ok(preview) => {
                let preview_id = Uuid::new_v4().to_string();
                let expires_at = wall_clock_millis().saturating_add(GIT_PREVIEW_TTL_MS);
                let operation = git_operation_name(preview.operation);
                let paths_json = match serde_json::to_string(&preview.paths) {
                    Ok(json) => json,
                    Err(error) => {
                        send_git_action_error(&out_tx, request_id, error.to_string());
                        return;
                    }
                };
                if let Err(error) = app.db.insert_git_preview(
                    &preview_id,
                    &operation,
                    &workspace_id,
                    &paths_json,
                    &preview.status_fingerprint,
                    None,
                    None,
                    expires_at,
                ) {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
                let wire = git_preview_wire(
                    preview_id,
                    operation,
                    workspace_id,
                    preview.paths,
                    preview.status,
                    None,
                    expires_at,
                );
                let _ = out_tx.send(ServerMessage::GitPreviewResult {
                    request_id,
                    preview: wire,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_discard(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    preview_id: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let Some(row) =
            (match app
                .db
                .consume_git_preview(&preview_id, &workspace_id, wall_clock_millis())
            {
                Ok(row) => row,
                Err(error) => {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
            })
        else {
            send_git_action_error(
                &out_tx,
                request_id,
                "preview is unknown, expired, consumed, or belongs to another workspace",
            );
            return;
        };
        let Some(mode) = row
            .operation
            .strip_prefix("discard:")
            .and_then(parse_discard_mode)
        else {
            send_git_action_error(&out_tx, request_id, "preview is not a discard operation");
            return;
        };
        let paths: Vec<String> = match serde_json::from_str(&row.paths_json) {
            Ok(paths) => paths,
            Err(error) => {
                send_git_action_error(&out_tx, request_id, error.to_string());
                return;
            }
        };
        let confirmation = ActionConfirmation::from_verified_parts(
            workspace_id.clone(),
            source_control::DestructiveOperation::Discard(mode),
            paths,
            row.status_fingerprint,
            row.message_digest,
        );
        match app.git.discard(&target, confirmation).await {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn parse_discard_mode(value: &str) -> Option<DiscardMode> {
    serde_json::from_str(value).ok()
}

fn spawn_git_commit_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    message: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        match app.git.preview_commit(&target, &message).await {
            Ok(preview) => {
                let preview_id = Uuid::new_v4().to_string();
                let expires_at = wall_clock_millis().saturating_add(GIT_PREVIEW_TTL_MS);
                let operation = git_operation_name(preview.preview.operation);
                let paths_json = match serde_json::to_string(&preview.preview.paths) {
                    Ok(json) => json,
                    Err(error) => {
                        send_git_action_error(&out_tx, request_id, error.to_string());
                        return;
                    }
                };
                if let Err(error) = app.db.insert_git_preview(
                    &preview_id,
                    &operation,
                    &workspace_id,
                    &paths_json,
                    &preview.preview.status_fingerprint,
                    preview.preview.message_digest.as_deref(),
                    Some(&preview.message),
                    expires_at,
                ) {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
                let wire = git_preview_wire(
                    preview_id,
                    operation,
                    workspace_id,
                    preview.preview.paths,
                    preview.preview.status,
                    Some(preview.message),
                    expires_at,
                );
                let _ = out_tx.send(ServerMessage::GitPreviewResult {
                    request_id,
                    preview: wire,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn spawn_git_commit(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    preview_id: String,
    message: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let Some(row) =
            (match app
                .db
                .consume_git_preview(&preview_id, &workspace_id, wall_clock_millis())
            {
                Ok(row) => row,
                Err(error) => {
                    send_git_action_error(&out_tx, request_id, error.to_string());
                    return;
                }
            })
        else {
            send_git_action_error(
                &out_tx,
                request_id,
                "preview is unknown, expired, consumed, or belongs to another workspace",
            );
            return;
        };
        if row.operation != "commit" {
            send_git_action_error(&out_tx, request_id, "preview is not a commit operation");
            return;
        }
        if row.message.as_deref() != Some(message.as_str()) {
            send_git_action_error(
                &out_tx,
                request_id,
                "commit message differs from the preview",
            );
            return;
        }
        let paths: Vec<String> = match serde_json::from_str(&row.paths_json) {
            Ok(paths) => paths,
            Err(error) => {
                send_git_action_error(&out_tx, request_id, error.to_string());
                return;
            }
        };
        let confirmation = ActionConfirmation::from_verified_parts(
            workspace_id.clone(),
            source_control::DestructiveOperation::Commit,
            paths,
            row.status_fingerprint,
            row.message_digest,
        );
        match app
            .git
            .commit(
                &target,
                CommitRequest {
                    message,
                    confirmation,
                },
            )
            .await
        {
            Ok(receipt) => {
                let _ = out_tx.send(ServerMessage::GitActionResult {
                    request_id,
                    workspace_id,
                    receipt,
                });
            }
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
            }
        }
    });
}

fn review_error_response(request_id: String, error: review::ReviewError) -> ServerMessage {
    request_error(
        Some(request_id),
        Some("review_invalid".to_string()),
        error.to_string(),
        false,
    )
}

fn spawn_review_list(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        match app.db.list_review_comments(&workspace_id, 4096) {
            Ok(comments) => {
                let _ = out_tx.send(ServerMessage::ReviewListResult {
                    request_id,
                    workspace_id,
                    comments,
                });
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_list_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_review_create(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    id: String,
    session_id: Option<String>,
    agent_id: Option<String>,
    path: String,
    base: source_control::DiffTarget,
    base_revision: String,
    side: ReviewSide,
    range: review::LineRange,
    body: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let source = match app
            .git
            .review_source(&target, &base, &path, side.label())
            .await
        {
            Ok(source) => source,
            Err(error) => {
                let _ = out_tx.send(git_error_response(request_id, error));
                return;
            }
        };
        if source.revision != base_revision {
            fail(
                &out_tx,
                request_id,
                "review_stale_source",
                "the source changed since this line was shown; refresh the diff before commenting",
                true,
            );
            return;
        }
        let draft = ReviewCommentDraft {
            id,
            workspace_id: workspace_id.clone(),
            session_id,
            agent_id,
            path,
            base,
            base_revision,
            side,
            range,
            body,
        };
        let comment = match review::create_comment(draft, &source.lines, wall_clock_millis()) {
            Ok(comment) => comment,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        if let Err(error) = app.db.insert_review_comment(&comment) {
            fail(
                &out_tx,
                request_id,
                "review_create_failed",
                error.to_string(),
                true,
            );
            return;
        }
        let _ = out_tx.send(ServerMessage::ReviewCommentResult {
            request_id,
            workspace_id,
            comment,
        });
    });
}

fn spawn_review_update(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    body: String,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let Some(comment) = (match app.db.get_review_comment(&workspace_id, &comment_id) {
            Ok(comment) => comment,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_get_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_not_found",
                "review comment was not found",
                false,
            );
            return;
        };
        if comment.version != expected_version {
            fail(
                &out_tx,
                request_id,
                "review_conflict",
                "review comment changed; refresh before editing",
                true,
            );
            return;
        }
        let next = match review::edit_comment(&comment, body, wall_clock_millis()) {
            Ok(next) => next,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        match app
            .db
            .update_review_comment(&workspace_id, &comment_id, expected_version, &next)
        {
            Ok(ReviewUpdateResult::Updated(comment)) => {
                let _ = out_tx.send(ServerMessage::ReviewCommentResult {
                    request_id,
                    workspace_id,
                    comment,
                });
            }
            Ok(ReviewUpdateResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before editing",
                    true,
                );
            }
            Ok(ReviewUpdateResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_update_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

fn spawn_review_resolve(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    resolved: bool,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        let Some(comment) = (match app.db.get_review_comment(&workspace_id, &comment_id) {
            Ok(comment) => comment,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_get_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_not_found",
                "review comment was not found",
                false,
            );
            return;
        };
        if comment.version != expected_version {
            fail(
                &out_tx,
                request_id,
                "review_conflict",
                "review comment changed; refresh before updating",
                true,
            );
            return;
        }
        let next = review::set_comment_resolved(&comment, resolved, wall_clock_millis());
        match app
            .db
            .update_review_comment(&workspace_id, &comment_id, expected_version, &next)
        {
            Ok(ReviewUpdateResult::Updated(comment)) => {
                let _ = out_tx.send(ServerMessage::ReviewCommentResult {
                    request_id,
                    workspace_id,
                    comment,
                });
            }
            Ok(ReviewUpdateResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before updating",
                    true,
                );
            }
            Ok(ReviewUpdateResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_update_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

fn spawn_review_delete(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    comment_id: String,
    expected_version: u64,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        match app
            .db
            .delete_review_comment(&workspace_id, &comment_id, expected_version)
        {
            Ok(ReviewDeleteResult::Deleted) => {
                let _ = out_tx.send(ServerMessage::ReviewDeleteResult {
                    request_id,
                    workspace_id,
                    comment_id,
                    deleted: true,
                });
            }
            Ok(ReviewDeleteResult::Conflict(_)) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_conflict",
                    "review comment changed; refresh before deleting",
                    true,
                );
            }
            Ok(ReviewDeleteResult::NotFound) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_not_found",
                    "review comment was not found",
                    false,
                );
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delete_failed",
                    error.to_string(),
                    true,
                );
            }
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn spawn_review_batch_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    send_operation_id: String,
    target_session_id: Option<String>,
    target_agent_id: Option<String>,
    current_revision: String,
    instruction: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        // Resolve the Git target and the destination before reading or
        // inserting any packet row. A packet for a missing/mismatched session
        // is not useful durable work and must never become an orphaned send.
        let target = match resolve_git_target_or_fail(&app, &workspace_id, &request_id, &out_tx) {
            Some(target) => target,
            None => return,
        };
        let (target_session_id, target_agent) = match resolve_review_target(
            &app,
            &workspace_id,
            target_session_id.as_deref(),
            target_agent_id.as_deref(),
        ) {
            Ok(target) => target,
            Err(message) => {
                fail(&out_tx, request_id, "review_target_invalid", message, false);
                return;
            }
        };
        let comments = match app.db.list_review_comments(&workspace_id, 4096) {
            Ok(comments) => comments,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_list_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        };
        let unresolved = comments
            .iter()
            .filter(|comment| matches!(comment.status, review::ReviewStatus::Unresolved))
            .count();
        if unresolved == 0 {
            let _ = out_tx.send(review_error_response(
                request_id,
                review::ReviewError::NoUnresolvedComments,
            ));
            return;
        }

        // Re-read every source represented by an unresolved comment. The
        // caller's revision is only an expectation: it can never authorize a
        // stale anchor or substitute for the server-owned bytes.
        let mut refreshed_comments = Vec::with_capacity(unresolved);
        let mut source_entries = Vec::with_capacity(unresolved);
        for comment in comments
            .into_iter()
            .filter(|comment| matches!(comment.status, review::ReviewStatus::Unresolved))
        {
            let source = match app
                .git
                .review_source(&target, &comment.base, &comment.path, comment.side.label())
                .await
            {
                Ok(source) => source,
                Err(error) => {
                    let _ = out_tx.send(git_error_response(request_id, error));
                    return;
                }
            };
            let refreshed = if source.revision == comment.base_revision {
                comment
            } else {
                let (candidate, result) = match review::reanchor_comment(
                    &comment,
                    &source.lines,
                    &source.revision,
                    wall_clock_millis(),
                ) {
                    Ok(result) => result,
                    Err(error) => {
                        let _ = out_tx.send(review_error_response(request_id, error));
                        return;
                    }
                };
                match result.state {
                    review::ReanchorState::Exact | review::ReanchorState::Reanchored => {
                        match app.db.update_review_comment(
                            &comment.workspace_id,
                            &comment.id,
                            comment.version,
                            &candidate,
                        ) {
                            Ok(crate::db::ReviewUpdateResult::Updated(_)) => candidate,
                            Ok(crate::db::ReviewUpdateResult::Conflict(_)) => {
                                fail(&out_tx, request_id, "review_conflict", "review comment changed while preparing the packet; refresh and try again", true);
                                return;
                            }
                            Ok(crate::db::ReviewUpdateResult::NotFound) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_not_found",
                                    "review comment was removed while preparing the packet",
                                    false,
                                );
                                return;
                            }
                            Err(error) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_reanchor_failed",
                                    error.to_string(),
                                    true,
                                );
                                return;
                            }
                        }
                    }
                    review::ReanchorState::Ambiguous
                    | review::ReanchorState::Stale
                    | review::ReanchorState::Orphaned => {
                        // Persist the explicit stale/orphaned state so every
                        // reconnect shows the same safe decision. It is never
                        // silently folded into a packet at an unrelated line.
                        match app.db.update_review_comment(
                            &comment.workspace_id,
                            &comment.id,
                            comment.version,
                            &candidate,
                        ) {
                            Ok(ReviewUpdateResult::Updated(_)) => {}
                            Ok(ReviewUpdateResult::Conflict(_)) => {
                                fail(&out_tx, request_id, "review_conflict", "review comment changed while recording its stale anchor; refresh and try again", true);
                                return;
                            }
                            Ok(ReviewUpdateResult::NotFound) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_not_found",
                                    "review comment was removed while recording its stale anchor",
                                    false,
                                );
                                return;
                            }
                            Err(error) => {
                                fail(
                                    &out_tx,
                                    request_id,
                                    "review_reanchor_failed",
                                    error.to_string(),
                                    true,
                                );
                                return;
                            }
                        }
                        fail(&out_tx, request_id, "review_stale_anchor", "a review anchor no longer identifies the same source; refresh the diff and move the comment deliberately", true);
                        return;
                    }
                }
            };
            let base = serde_json::to_string(&refreshed.base).unwrap_or_default();
            source_entries.push((
                refreshed.id.clone(),
                base,
                refreshed.path.clone(),
                refreshed.side.label().to_string(),
                refreshed.base_revision.clone(),
            ));
            refreshed_comments.push(refreshed);
        }
        // `git.diff.result.sourceRevision` is the digest of every visible
        // source in that diff, while this packet revision is the digest of
        // the exact comment sources (including their ids and target metadata).
        // They intentionally have different domains: a diff may contain more
        // files/sides than the unresolved comments, and comments may retain
        // anchors from more than one selected target. The source re-read above
        // already verifies each comment's server-owned revision and performs
        // safe re-anchoring when it changed, so comparing the two digests here
        // would reject an otherwise valid packet on every normal UI flow.
        let _ = current_revision;
        let canonical_revision = review_snapshot_revision(source_entries);
        let packet = match review::build_batch_packet(review::ReviewBatchRequest {
            send_operation_id,
            workspace_id,
            target_session_id: Some(target_session_id),
            target_agent_id: Some(agent_str(target_agent).to_string()),
            current_revision: canonical_revision,
            instruction,
            comments: refreshed_comments,
        }) {
            Ok(packet) => packet,
            Err(error) => {
                let _ = out_tx.send(review_error_response(request_id, error));
                return;
            }
        };
        if let Err(error) = app.db.insert_review_packet(&packet, wall_clock_millis()) {
            fail(
                &out_tx,
                request_id,
                "review_packet_failed",
                error.to_string(),
                true,
            );
            return;
        }
        let _ = out_tx.send(ServerMessage::ReviewBatchPreviewResult { request_id, packet });
    });
}

fn review_delivery_result(request_id: String, row: crate::db::ReviewPacketRow) -> ServerMessage {
    ServerMessage::ReviewBatchSendResult {
        request_id,
        workspace_id: row.packet.workspace_id.clone(),
        packet_id: row.packet.packet_id.clone(),
        send_operation_id: row.packet.send_operation_id.clone(),
        delivery: row.state,
        target_session_id: row.packet.target_session_id.clone(),
        target_agent_id: row.packet.target_agent_id.clone(),
    }
}

/// Apply a durable prompt outcome to its review packet and return the packet
/// row. The database method updates both rows in one transaction; this helper
/// keeps the server from ever reporting a packet state based on a failed or
/// partial write.
fn settle_review_packet_from_prompt(
    app: &AppState,
    packet_id: &str,
    send_operation_id: &str,
    workspace_id: &str,
    prompt_state: &str,
) -> Result<crate::db::ReviewPacketRow, String> {
    settle_review_packet_from_db(
        &app.db,
        packet_id,
        send_operation_id,
        workspace_id,
        prompt_state,
    )
}

/// Testable DB-only half of [`settle_review_packet_from_prompt`]. Keeping the
/// state decision independent from the connection/runtime lets the retry race
/// be exercised with a temporary SQLite fixture, without constructing a live
/// WebSocket application state or starting a provider process.
fn settle_review_packet_from_db(
    db: &HistoryDb,
    packet_id: &str,
    send_operation_id: &str,
    workspace_id: &str,
    prompt_state: &str,
) -> Result<crate::db::ReviewPacketRow, String> {
    let settlement = match prompt_state {
        "delivered" => "delivered",
        // A claimed prompt crossed the launch boundary, but a caller cannot
        // prove provider acceptance from the row alone. Preserve it as an
        // unconfirmed outbox item until the owning dispatch settles it.
        "unconfirmed" => "unconfirmed",
        "claimed" => {
            // A live retry may observe the original sender after it has
            // claimed the operation but before provider acceptance. Leave
            // that in-flight state untouched; only startup recovery or a
            // verified launch failure may convert it to unconfirmed.
            return db
                .get_review_packet(packet_id)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "review packet disappeared while settling delivery".to_string());
        }
        // Queued is a live pre-claim state. A normal retry can observe it
        // between reserve and claim, so changing it to unconfirmed here
        // could steal the only dispatch winner from the original caller.
        "queued" => {
            return db
                .get_review_packet(packet_id)
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "review packet disappeared while settling delivery".to_string());
        }
        other => return Err(format!("invalid prompt operation state {other:?}")),
    };
    db.settle_prompt_dispatch(send_operation_id, settlement, wall_clock_millis())
        .map_err(|error| error.to_string())?;
    let packet = db
        .get_review_packet(packet_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "review packet disappeared while settling delivery".to_string())?;
    if packet.packet.send_operation_id != send_operation_id
        || packet.packet.workspace_id != workspace_id
    {
        return Err(
            "review packet changed workspace or operation while settling delivery".to_string(),
        );
    }
    Ok(packet)
}

fn spawn_review_batch_send(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    packet_id: String,
    send_operation_id: String,
) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    let state = state.clone();
    tokio::spawn(async move {
        let Some(row) = (match app.db.get_review_packet(&packet_id) {
            Ok(row) => row,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_packet_not_found",
                "review packet was not found",
                false,
            );
            return;
        };
        if row.packet.workspace_id != workspace_id
            || row.packet.send_operation_id != send_operation_id
        {
            fail(
                &out_tx,
                request_id,
                "review_packet_mismatch",
                "review packet does not belong to this workspace or operation",
                false,
            );
            return;
        }

        // A prompt operation may have settled before the packet update (for
        // example, a process died between those two durable writes). Repair
        // the packet from that source of truth before deciding whether to
        // dispatch anything.
        match app.db.get_prompt_operation(&send_operation_id) {
            Ok(Some(prompt)) if matches!(prompt.state.as_str(), "delivered" | "unconfirmed") => {
                match settle_review_packet_from_prompt(
                    &app,
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    &prompt.state,
                ) {
                    Ok(row) if matches!(row.state.as_str(), "delivered" | "unconfirmed") => {
                        let _ = out_tx.send(review_delivery_result(request_id, row));
                        return;
                    }
                    Ok(_) => {}
                    Err(error) => {
                        fail(
                            &out_tx,
                            request_id,
                            "review_delivery_persistence_failed",
                            error,
                            false,
                        );
                        return;
                    }
                }
            }
            Ok(Some(_)) | Ok(None) => {}
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delivery_persistence_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }
        let row = match app.db.get_review_packet(&packet_id) {
            Ok(Some(row)) => row,
            Ok(None) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_not_found",
                    "review packet was not found",
                    false,
                );
                return;
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        };
        if matches!(row.state.as_str(), "delivered" | "unconfirmed") {
            let _ = out_tx.send(review_delivery_result(request_id, row));
            return;
        }
        if row.state == "claimed" {
            // A claimed packet without a settled prompt is the crash window
            // between the two durable reservations. It cannot be safely
            // replayed, even if the prompt row is still queued.
            let result = match app.db.get_prompt_operation(&send_operation_id) {
                Ok(Some(prompt)) if prompt.state == "queued" || prompt.state == "claimed" => {
                    // The prompt may still be between reservation and its
                    // CAS claim on the original sender. Leave both rows
                    // untouched; the winner must retain the right to launch.
                    match app.db.get_review_packet(&packet_id) {
                        Ok(Some(row)) => Ok(row),
                        Ok(None) => {
                            Err("review packet disappeared while settling delivery".to_string())
                        }
                        Err(error) => Err(error.to_string()),
                    }
                }
                Ok(Some(prompt)) => settle_review_packet_from_prompt(
                    &app,
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    &prompt.state,
                ),
                Ok(None) => match app.db.set_review_packet_state(
                    &packet_id,
                    &send_operation_id,
                    &workspace_id,
                    "unconfirmed",
                    wall_clock_millis(),
                ) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => {
                        Err("review packet disappeared while settling delivery".to_string())
                    }
                    Err(error) => Err(error.to_string()),
                },
                Err(error) => Err(error.to_string()),
            };
            match result {
                Ok(row) => {
                    let _ = out_tx.send(review_delivery_result(request_id, row));
                }
                Err(error) => {
                    fail(
                        &out_tx,
                        request_id,
                        "review_delivery_persistence_failed",
                        error,
                        false,
                    );
                }
            }
            return;
        }

        let (session_id, agent) = match resolve_review_target(
            &app,
            &workspace_id,
            row.packet.target_session_id.as_deref(),
            row.packet.target_agent_id.as_deref(),
        ) {
            Ok(target) => target,
            Err(message) => {
                fail(&out_tx, request_id, "review_target_invalid", message, false);
                return;
            }
        };
        let Some(session) = (match app.db.get_session(&session_id) {
            Ok(session) => session,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_target_invalid",
                    error.to_string(),
                    false,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_target_invalid",
                "target session was not found",
                false,
            );
            return;
        };
        let payload_digest = prompt_payload_digest(
            &session_id,
            Some(&workspace_id),
            &session.host_id,
            &session.cwd,
            &row.packet.markdown,
            agent,
            None,
            false,
            None,
            &[],
        );
        let (prompt, _) = match app.db.reserve_prompt_operation(
            &send_operation_id,
            &session_id,
            Some(&workspace_id),
            &payload_digest,
            &row.packet.markdown,
            Some(agent_str(agent)),
            None,
        ) {
            Ok(result) => result,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_prompt_rejected",
                    error.to_string(),
                    false,
                );
                return;
            }
        };
        if matches!(prompt.state.as_str(), "delivered" | "unconfirmed") {
            match settle_review_packet_from_prompt(
                &app,
                &packet_id,
                &send_operation_id,
                &workspace_id,
                &prompt.state,
            ) {
                Ok(row) => {
                    let _ = out_tx.send(review_delivery_result(request_id, row));
                }
                Err(error) => {
                    fail(
                        &out_tx,
                        request_id,
                        "review_delivery_persistence_failed",
                        error,
                        false,
                    );
                }
            }
            return;
        }

        // Reserve the prompt first. If the process exits after the packet is
        // claimed but before the normal chat path claims this operation,
        // startup reconciliation marks both rows unconfirmed and a retry can
        // never launch a duplicate provider turn.
        let Some((claimed, won)) = (match app.db.claim_review_packet(
            &packet_id,
            &send_operation_id,
            &workspace_id,
            wall_clock_millis(),
        ) {
            Ok(result) => result,
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_packet_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
        }) else {
            fail(
                &out_tx,
                request_id,
                "review_packet_not_found",
                "review packet was not found",
                false,
            );
            return;
        };
        if !won {
            let _ = out_tx.send(review_delivery_result(request_id, claimed));
            return;
        }
        let chat_session_id = session_id.clone();
        let chat_text = claimed.packet.markdown.clone();
        // The normal chat path owns prompt reservation, provider launch, and
        // session routing. Reuse it with the packet's send operation id so a
        // retry cannot create a second user message or provider turn.
        let chat = ClientMessage::ChatSend {
            session_id,
            text: claimed.packet.markdown.clone(),
            operation_id: Some(claimed.packet.send_operation_id.clone()),
            agent,
            model: None,
            plan_mode: false,
            effort: None,
            attachments: None,
        };
        // `handle_message` only needs the raw JSON for hub routing. Supplying
        // the complete wire payload keeps a remote session from receiving an
        // empty prompt while preserving the typed local path.
        let raw_chat = serde_json::json!({
            "type": "chat.send",
            "sessionId": chat_session_id,
            "text": chat_text,
            "operationId": send_operation_id,
            "agent": agent_str(agent),
        })
        .to_string();
        handle_message(&state, chat, &raw_chat);
        tokio::task::yield_now().await;
        // The normal path settles the prompt when its dispatch task is
        // accepted. Until that durable outcome is visible, report the packet
        // as claimed; a later retry will observe the same row and never start
        // another provider process. A queued prompt here means the typed path
        // rejected the target before claiming it, so preserve uncertainty
        // rather than claiming delivery.
        let result = match app.db.get_prompt_operation(&send_operation_id) {
            Ok(Some(prompt)) if prompt.state == "claimed" => {
                match app.db.get_review_packet(&packet_id) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => Err("review packet disappeared while dispatching".to_string()),
                    Err(error) => Err(error.to_string()),
                }
            }
            Ok(Some(prompt)) if prompt.state == "queued" => {
                // A queued operation is provably pre-dispatch. It can be
                // claimed by the original sender after this retry observes
                // it, so do not convert it into a terminal state.
                match app.db.get_review_packet(&packet_id) {
                    Ok(Some(row)) => Ok(row),
                    Ok(None) => {
                        Err("review packet disappeared while dispatching review packet".to_string())
                    }
                    Err(error) => Err(error.to_string()),
                }
            }
            Ok(Some(prompt)) => settle_review_packet_from_prompt(
                &app,
                &packet_id,
                &send_operation_id,
                &workspace_id,
                &prompt.state,
            ),
            Ok(None) => {
                Err("prompt operation disappeared while dispatching review packet".to_string())
            }
            Err(error) => Err(error.to_string()),
        };
        match result {
            Ok(row) => {
                let _ = out_tx.send(review_delivery_result(request_id, row));
            }
            Err(error) => {
                fail(
                    &out_tx,
                    request_id,
                    "review_delivery_persistence_failed",
                    error,
                    false,
                );
            }
        }
    });
}

fn spawn_fs_tree(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: Option<String>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service
                .list_dir(path.as_deref().unwrap_or(""))
                .map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(listing)) => ServerMessage::FsTreeResult {
                request_id,
                workspace_id,
                path: listing.path,
                entries: listing.entries,
                truncated: listing.truncated,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

fn spawn_fs_read(state: &Arc<ConnState>, request_id: String, workspace_id: String, path: String) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service
                .read_file(&path)
                .map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(read)) => ServerMessage::FsReadResult {
                request_id,
                workspace_id,
                metadata: read.metadata,
                content: read.content,
                version: read.version,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

fn spawn_fs_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service.preview(&path).map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(preview)) => ServerMessage::FsPreviewResult {
                request_id,
                workspace_id,
                metadata: preview.metadata,
                version: preview.version,
                kind: preview.kind,
                content: preview.content,
                media_type: preview.media_type,
                requires_sandbox: preview.requires_sandbox,
                truncated: preview.truncated,
                message: preview.message,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

struct FsWriteExecution {
    result: WriteResult,
    buffer_revision: Option<u64>,
    buffer_conflict: bool,
    /// Retries of a completed request return the saved result but must not
    /// emit another invalidation event.
    replayed: bool,
}

fn spawn_fs_write(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    content: String,
    expected_version: Option<String>,
    expected_buffer_revision: Option<u64>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_id = request_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    let event_workspace_id = workspace_id.clone();
    let event_path = path.clone();
    let events_tx = app.hub.hub_events_tx.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            let content_version = FileService::version_for_bytes(content.as_bytes());

            // A retried request id returns the original publication result,
            // even if an external process changed the pathname afterwards.
            // Reusing an id for different content/workspace/path is refused.
            if let Some(receipt) =
                app.db
                    .get_file_save_operation(&operation_id)
                    .map_err(|error| {
                        FsAdapterFailure::Buffer(FileBufferError::Database {
                            message: error.to_string(),
                        })
                    })?
            {
                if receipt.workspace_id != task_workspace_id
                    || receipt.path != path
                    || receipt.content_version != content_version
                    || receipt.expected_buffer_revision != expected_buffer_revision
                {
                    return Err(FsAdapterFailure::Workspace {
                        code: "operation_id_reused",
                        message: "save request id was already used for different content"
                            .to_string(),
                    });
                }
                let metadata = serde_json::from_str(&receipt.metadata_json).map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: format!("saved metadata receipt is invalid: {error}"),
                    })
                })?;
                let current_buffer =
                    app.db
                        .get_file_buffer(&task_workspace_id, &path)
                        .map_err(|error| {
                            FsAdapterFailure::Buffer(FileBufferError::Database {
                                message: error.to_string(),
                            })
                        })?;
                return Ok(FsWriteExecution {
                    result: WriteResult {
                        metadata,
                        bytes_written: receipt.bytes_written,
                        version: receipt.content_version,
                    },
                    buffer_revision: current_buffer.as_ref().map(|row| row.revision),
                    buffer_conflict: current_buffer.as_ref().is_some_and(|row| row.conflict),
                    replayed: true,
                });
            }

            app.db
                .begin_file_save_intent(
                    &operation_id,
                    &task_workspace_id,
                    &path,
                    &content,
                    &content_version,
                    expected_buffer_revision,
                )
                .map_err(FsAdapterFailure::Buffer)?;

            let write = match service.write_text(&path, &content, expected_version.as_deref()) {
                Ok(result) => result,
                // An I/O error after publication is not distinguishable from
                // an error before it. Keep the intent so startup recovery can
                // inspect the durable pathname before deciding anything.
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            let metadata_json = serde_json::to_string(&write.metadata).map_err(|error| {
                FsAdapterFailure::Buffer(FileBufferError::Database {
                    message: format!("saved metadata could not be recorded: {error}"),
                })
            })?;
            let reconciled = app
                .db
                .complete_file_save(FileSaveCompletion {
                    operation_id: &operation_id,
                    workspace_id: &task_workspace_id,
                    path: &path,
                    content: &content,
                    version: &write.version,
                    expected_revision: expected_buffer_revision,
                    bytes_written: write.bytes_written,
                    metadata_json: &metadata_json,
                    max_receipts: 1_024,
                })
                .map_err(FsAdapterFailure::Buffer)?;
            Ok(FsWriteExecution {
                result: write,
                buffer_revision: reconciled.as_ref().map(|row| row.revision),
                buffer_conflict: reconciled.as_ref().is_some_and(|row| row.conflict),
                replayed: false,
            })
        })
        .await;
        let message = match result {
            Ok(Ok(execution)) => {
                if !execution.replayed {
                    let _ = events_tx.send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: event_workspace_id.clone(),
                        path: event_path.clone(),
                        version: Some(execution.result.version.clone()),
                        kind: "changed".to_string(),
                        metadata: Some(execution.result.metadata.clone()),
                        buffer_revision: execution.buffer_revision,
                        conflict: execution.buffer_conflict,
                    }));
                }
                ServerMessage::FsWriteResult {
                    request_id,
                    workspace_id,
                    metadata: execution.result.metadata,
                    bytes_written: execution.result.bytes_written,
                    version: execution.result.version,
                    buffer_revision: execution.buffer_revision,
                }
            }
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

fn spawn_fs_buffer_list(state: &Arc<ConnState>, request_id: String, workspace_id: String) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            // Resolve the retained service even for a metadata-only list so
            // archived/remote/path-swapped workspaces cannot expose rows.
            let _service = workspace_file_service(&app, &task_workspace_id)?;
            let mut buffers = app
                .db
                .list_file_buffer_metadata(&task_workspace_id, MAX_FILE_BUFFERS_PER_WORKSPACE + 1)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let truncated = buffers.len() > MAX_FILE_BUFFERS_PER_WORKSPACE;
            buffers.truncate(MAX_FILE_BUFFERS_PER_WORKSPACE);
            Ok((buffers, truncated))
        })
        .await;
        let message = match result {
            Ok(Ok((buffers, truncated))) => ServerMessage::FsBufferListResult {
                request_id,
                workspace_id,
                buffers: buffers
                    .into_iter()
                    .map(file_buffer_summary_to_wire)
                    .collect(),
                truncated,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

/// Read the disk baseline and reconcile a durable buffer's external version.
/// Clean buffers follow the disk automatically; dirty buffers retain their
/// draft/base and become conflicted so the client can compare or merge.
fn spawn_fs_buffer_get(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    let events_tx = app.hub.hub_events_tx.clone();
    tokio::spawn(async move {
        let event_workspace_id = workspace_id.clone();
        let event_path = path.clone();
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            let existing = app
                .db
                .get_file_buffer(&task_workspace_id, &path)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let (buffer, changed) = match service.read_file(&path) {
                Ok(read) => {
                    let current = if let Some(row) = existing.clone() {
                        if row.external_version.as_deref() == Some(read.version.as_str()) {
                            row
                        } else if row.dirty {
                            app.db
                                .observe_file_buffer(
                                    &task_workspace_id,
                                    &path,
                                    FileBufferObservation {
                                        content: None,
                                        base_content: None,
                                        base_version: None,
                                        external_version: Some(&read.version),
                                        dirty: true,
                                        conflict: true,
                                    },
                                )
                                .map_err(|error| {
                                    FsAdapterFailure::Buffer(FileBufferError::Database {
                                        message: error.to_string(),
                                    })
                                })?
                                .ok_or_else(|| {
                                    FsAdapterFailure::Task("buffer disappeared".to_string())
                                })?
                        } else {
                            app.db
                                .observe_file_buffer(
                                    &task_workspace_id,
                                    &path,
                                    FileBufferObservation {
                                        content: Some(&read.content),
                                        base_content: Some(&read.content),
                                        base_version: Some(&read.version),
                                        external_version: Some(&read.version),
                                        dirty: false,
                                        conflict: false,
                                    },
                                )
                                .map_err(|error| {
                                    FsAdapterFailure::Buffer(FileBufferError::Database {
                                        message: error.to_string(),
                                    })
                                })?
                                .ok_or_else(|| {
                                    FsAdapterFailure::Task("buffer disappeared".to_string())
                                })?
                        }
                    } else {
                        app.db
                            .ensure_file_buffer(
                                &task_workspace_id,
                                &path,
                                FileBufferUpdate {
                                    content: read.content.clone(),
                                    base_content: read.content.clone(),
                                    base_version: Some(read.version.clone()),
                                    external_version: Some(read.version.clone()),
                                    dirty: false,
                                    conflict: false,
                                },
                                MAX_FILE_BUFFERS_PER_WORKSPACE,
                            )
                            .map_err(FsAdapterFailure::Buffer)?
                    };
                    let changed = existing
                        .as_ref()
                        .is_some_and(|row| row.revision != current.revision)
                        || existing.is_none();
                    (current, changed)
                }
                Err(FsError::NotFound { .. }) => {
                    let Some(row) = existing else {
                        return Err(FsAdapterFailure::Filesystem(FsError::NotFound {
                            path: path.clone(),
                        }));
                    };
                    let current = app
                        .db
                        .observe_file_buffer(
                            &task_workspace_id,
                            &path,
                            FileBufferObservation {
                                content: None,
                                base_content: None,
                                base_version: None,
                                external_version: None,
                                dirty: row.dirty,
                                conflict: true,
                            },
                        )
                        .map_err(|error| {
                            FsAdapterFailure::Buffer(FileBufferError::Database {
                                message: error.to_string(),
                            })
                        })?
                        .ok_or_else(|| FsAdapterFailure::Task("buffer disappeared".to_string()))?;
                    (current, row.external_version.is_some() || !row.conflict)
                }
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            Ok((buffer, changed))
        })
        .await;
        let message = match result {
            Ok(Ok((buffer, changed))) => {
                if changed {
                    let version = buffer.external_version.clone();
                    let _ = events_tx.send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: event_workspace_id,
                        path: event_path,
                        version,
                        kind: "changed".to_string(),
                        metadata: None,
                        buffer_revision: Some(buffer.revision),
                        conflict: buffer.conflict,
                    }));
                }
                ServerMessage::FsBufferResult {
                    request_id,
                    workspace_id,
                    buffer: file_buffer_to_wire(buffer),
                }
            }
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

fn spawn_fs_buffer_set(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    content: String,
    base_content: Option<String>,
    expected_buffer_revision: Option<u64>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            if content.len() > service.config().max_read_bytes
                || content.len() > service.config().max_write_bytes
                || content.len() > MAX_FILE_BUFFER_BYTES
            {
                return Err(FsAdapterFailure::Buffer(FileBufferError::ContentTooLarge {
                    limit: service
                        .config()
                        .max_read_bytes
                        .min(service.config().max_write_bytes)
                        .min(MAX_FILE_BUFFER_BYTES),
                }));
            }
            let existing = app
                .db
                .get_file_buffer(&task_workspace_id, &path)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let disk = match service.read_file(&path) {
                Ok(read) => Some(read),
                Err(FsError::NotFound { .. }) => None,
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            let (disk_version, disk_content) = disk
                .as_ref()
                .map(|read| (Some(read.version.clone()), Some(read.content.clone())))
                .unwrap_or((None, None));
            let supplied_base_content = base_content.is_some();
            let base_content = base_content
                .or_else(|| existing.as_ref().map(|row| row.base_content.clone()))
                .or(disk_content.clone())
                .unwrap_or_default();
            let base_version = if base_content.is_empty() && disk_version.is_none() {
                None
            } else if supplied_base_content {
                // A client may send a merged/reloaded base after resolving a
                // conflict. Its hash must travel with that exact content;
                // retaining an older row's base_version would compare the
                // new draft against the wrong baseline after a restart.
                Some(FileService::version_for_bytes(base_content.as_bytes()))
            } else if let Some(existing) = &existing {
                existing
                    .base_version
                    .clone()
                    .or_else(|| Some(FileService::version_for_bytes(base_content.as_bytes())))
            } else {
                Some(FileService::version_for_bytes(base_content.as_bytes()))
            };
            let draft_version = FileService::version_for_bytes(content.as_bytes());
            let conflict = match (base_version.as_deref(), disk_version.as_deref()) {
                (None, None) => false,
                (Some(base), Some(disk)) => base != disk,
                _ => true,
            };
            let row = app
                .db
                .set_file_buffer(
                    &task_workspace_id,
                    &path,
                    FileBufferUpdate {
                        content,
                        base_content,
                        base_version,
                        external_version: disk_version,
                        dirty: disk
                            .as_ref()
                            .is_none_or(|read| read.version != draft_version),
                        conflict,
                    },
                    expected_buffer_revision,
                    MAX_FILE_BUFFERS_PER_WORKSPACE,
                )
                .map_err(FsAdapterFailure::Buffer)?;
            Ok(row)
        })
        .await;
        let message = match result {
            Ok(Ok(buffer)) => ServerMessage::FsBufferResult {
                request_id,
                workspace_id,
                buffer: file_buffer_to_wire(buffer),
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

fn spawn_fs_buffer_close(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    expected_buffer_revision: Option<u64>,
    discard: bool,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let result_path = path.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let _service = workspace_file_service(&app, &task_workspace_id)?;
            app.db
                .close_file_buffer(&task_workspace_id, &path, expected_buffer_revision, discard)
                .map_err(FsAdapterFailure::Buffer)
        })
        .await;
        let message = match result {
            Ok(Ok(removed)) => ServerMessage::FsBufferCloseResult {
                request_id,
                workspace_id,
                path: result_path,
                removed,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
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
        cli_started: row.cli_started,
        cli_provider_id: row.cli_provider_id,
        archived: row.archived,
        unseen: unseen.contains(&row.id),
        blocked: blocked.contains(&row.id),
        project_id: row.project_id,
        workspace_id: row.workspace_id,
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
        viewers
            .entry(session_id.to_string())
            .or_default()
            .insert(state.conn_id.clone());
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
fn should_forward_to_viewer(
    msg: &ServerMessage,
    conn_id: &str,
    viewers: &HashMap<String, HashSet<String>>,
) -> bool {
    let session_id = match msg {
        ServerMessage::ChatChunk { session_id, .. }
        | ServerMessage::ChatThinking { session_id, .. }
        | ServerMessage::ChatToolUse { session_id, .. }
        | ServerMessage::ChatToolResult { session_id, .. }
        | ServerMessage::ChatDone { session_id, .. }
        | ServerMessage::ChatPlan { session_id, .. } => session_id,
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

/// Insert `session_id` into the running set and fire the broadcast channel so
/// all connected clients receive a `session.updated` with `status: "running"`.
/// Errors are ignored — a missed broadcast is not fatal.
fn notify_session_updated(app: &AppState, session_id: &str) {
    let _ = app.session_events_tx.send(SessionUpdatedEvent {
        session_id: session_id.to_string(),
    });
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
    insert_runtime_on_host(
        state,
        session_id,
        cwd,
        "local",
        claude_session_id,
        last_agent,
        last_model,
    )
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
                    Some(c) => format!(
                        r#"{{"type":"session.create","cwd":{}}}"#,
                        serde_json::to_string(c).unwrap_or_default()
                    ),
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
                        request_id: None,
                        code: None,
                        retryable: false,
                    });
                    return;
                }
                expanded
            } else {
                state.app.default_cwd.clone()
            };
            let session_id = Uuid::new_v4().to_string();
            // Persist the identity before publishing it. Empty sessions stay
            // out of navigation via SESSION_VISIBILITY_FILTER, but their mode
            // overrides and a second viewer must survive reconnect/restart.
            if let Err(error) = state.app.db.create_session(&session_id, &resolved_cwd) {
                fail(
                    &state.out_tx,
                    None,
                    "session_create_failed",
                    format!("could not persist session: {error}"),
                    true,
                );
                return;
            }
            state.app.registry.create(&session_id, &resolved_cwd);
            insert_runtime(state, &session_id, &resolved_cwd, None, None, None);
            set_active_session(state, &session_id);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let _ = state
                .out_tx
                .send(status_message(get_status(&resolved_cwd, None)));
            // Do NOT broadcast session.updated yet — session has no messages,
            // so it won't appear in list_sessions() until the first
            // chat.send or terminal.create agentAttach.
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
        ClientMessage::SessionModeGet {
            request_id,
            session_id,
            device_id,
            workspace_id,
        } => {
            // A remote session owns its mode policy on the remote perch. The
            // request id is registered before forwarding so the hub can route
            // the response back to this exact connection.
            if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
                return;
            }
            let workspace_id =
                match mode_workspace_for_session(state, &session_id, workspace_id.as_deref()) {
                    Ok(workspace_id) => workspace_id,
                    Err(error) => {
                        fail(&state.out_tx, request_id, "unknown_session", error, false);
                        return;
                    }
                };
            match effective_session_mode(state, &device_id, &session_id, workspace_id.as_deref()) {
                Ok((mode, scope, revision)) => {
                    let _ = state.out_tx.send(ServerMessage::SessionMode {
                        request_id,
                        session_id,
                        device_id,
                        workspace_id,
                        mode: wire_session_mode(mode),
                        scope,
                        revision,
                    });
                }
                Err(error) => {
                    fail(&state.out_tx, request_id, "mode_read_failed", error, true);
                }
            }
        }
        ClientMessage::SessionModeSet {
            request_id,
            session_id,
            device_id,
            scope,
            workspace_id,
            mode,
            clear_override,
        } => {
            if route_to_remote_host_or_fail(state, &session_id, &request_id, raw_text) {
                return;
            }
            let workspace_id =
                match mode_workspace_for_session(state, &session_id, workspace_id.as_deref()) {
                    Ok(workspace_id) => workspace_id,
                    Err(error) => {
                        fail(&state.out_tx, request_id, "unknown_session", error, false);
                        return;
                    }
                };
            let mutation_revision = match scope {
                SessionModeScope::Session => state.app.agent_persistence.set_session_override(
                    &session_id,
                    if clear_override {
                        None
                    } else {
                        mode.map(fleet_session_mode)
                    },
                    now_millis(),
                ),
                SessionModeScope::Workspace => {
                    let Some(workspace_id) = workspace_id.as_deref() else {
                        fail(
                            &state.out_tx,
                            request_id,
                            "workspace_required",
                            "the session has no server-owned workspace override",
                            false,
                        );
                        return;
                    };
                    state.app.agent_persistence.set_workspace_override(
                        workspace_id,
                        if clear_override {
                            None
                        } else {
                            mode.map(fleet_session_mode)
                        },
                        now_millis(),
                    )
                }
                SessionModeScope::Device => match mode.filter(|_| !clear_override) {
                    Some(mode) => state.app.agent_persistence.set_device_default(
                        &device_id,
                        fleet_session_mode(mode),
                        now_millis(),
                    ),
                    None => state.app.agent_persistence.clear_device_default(&device_id),
                },
                SessionModeScope::Default => Err(anyhow::anyhow!(
                    "session.mode.set cannot target the default scope"
                )),
            };
            let mutation_revision = match mutation_revision {
                Ok(revision) => revision,
                Err(error) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "mode_write_failed",
                        error.to_string(),
                        true,
                    );
                    return;
                }
            };
            // The direct result above is device-specific and remains
            // request-correlated. Every other connected client receives only
            // this invalidation and must refetch using its own device id and
            // server-owned precedence chain.
            let _ =
                state
                    .app
                    .hub
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::SessionModeInvalidated {
                        session_id: session_id.clone(),
                        workspace_id: workspace_id.clone(),
                        device_id: (scope == SessionModeScope::Device).then_some(device_id.clone()),
                        host_id: Some("local".to_string()),
                        revision: mutation_revision,
                    }));
            let (effective, effective_scope, revision) = match effective_session_mode(
                state,
                &device_id,
                &session_id,
                workspace_id.as_deref(),
            ) {
                Ok(result) => result,
                Err(error) => {
                    fail(&state.out_tx, request_id, "mode_read_failed", error, true);
                    return;
                }
            };
            project_mode_to_lifecycle(state, &session_id, effective, revision);
            let _ = state.out_tx.send(ServerMessage::SessionMode {
                request_id,
                session_id,
                device_id,
                workspace_id,
                mode: wire_session_mode(effective),
                scope: effective_scope,
                revision,
            });
        }
        ClientMessage::AgentManifestList {
            request_id,
            host_id,
        } => {
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
        ClientMessage::AgentLifecycleGet {
            request_id,
            session_id,
            workspace_id,
            agent_id,
        } => {
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
        ClientMessage::AgentControlAcquire {
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
        } => {
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
        ClientMessage::AgentControlRelease {
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
            generation,
        } => {
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
                a.host_id
                    .cmp(&b.host_id)
                    .then(b.created_at.cmp(&a.created_at))
            });
            sessions.extend(remote);
            // Direct send — not recorded into the ring buffer.
            let _ = state.out_tx.send(ServerMessage::SessionList { sessions });
        }
        ClientMessage::ChatSend {
            ref session_id,
            ref text,
            ref operation_id,
            agent,
            ref model,
            plan_mode,
            ref effort,
            ref attachments,
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
            let _agent_operation = state.app.agent_operation_lock.lock().unwrap();
            if state
                .app
                .agent_runtime
                .lifecycle()
                .list()
                .iter()
                .any(|snapshot| {
                    snapshot.key.session_id == *session_id
                        && state.app.agent_runtime.runtime_alive(&snapshot.key)
                })
            {
                fail(&state.out_tx, None, "agent_cli_active", "This agent is still running in CLI. Use its terminal, or stop the CLI before starting a Chat turn.".to_string(), false);
                return;
            }
            // Local chat turn. Resolve the runtime before reserving anything:
            // a guessed session id must not consume an operation id or leave
            // a durable prompt that can never be launched.
            let session_id = session_id.clone();
            let text = text.clone();
            let operation_id = operation_id_or_new(operation_id.clone());
            let model = model.clone();
            let effort = effort.clone();
            let attachments: Vec<String> = attachments.clone().unwrap_or_default();

            let Some((host_id, cwd)) = ({
                let map = state.runtimes.lock().unwrap();
                map.get(&session_id)
                    .map(|runtime| (runtime.host_id.clone(), runtime.cwd.clone()))
            }) else {
                fail(
                    &state.out_tx,
                    None,
                    "unknown_session",
                    format!("unknown session {session_id}"),
                    false,
                );
                return;
            };

            // Direct-mode host: launch the turn detached over ssh instead of
            // spawning a local child. Everything after this point (persisting
            // the user row, marking the session running) is identical — only
            // the runner differs, and it lives in `AppState` so the turn
            // survives this connection going away.
            if host_id != "local" {
                let Some(host) = direct_host(state, &host_id) else {
                    fail(
                        &state.out_tx,
                        None,
                        "host_unavailable",
                        format!("host {host_id} is no longer configured"),
                        false,
                    );
                    return;
                };
                if let Err(error) = state
                    .app
                    .db
                    .create_session_on_host(&session_id, &cwd, &host_id)
                {
                    fail(
                        &state.out_tx,
                        None,
                        "prompt_reservation_failed",
                        error.to_string(),
                        true,
                    );
                    return;
                }
                let Some(row) = state.app.db.get_session(&session_id).ok().flatten() else {
                    fail(
                        &state.out_tx,
                        None,
                        "unknown_session",
                        format!("unknown session {session_id}"),
                        false,
                    );
                    return;
                };
                let payload_digest = prompt_payload_digest(
                    &session_id,
                    row.workspace_id.as_deref(),
                    &host_id,
                    &cwd,
                    &text,
                    agent,
                    model.as_deref(),
                    plan_mode,
                    effort.as_deref(),
                    &attachments,
                );
                let claim = match reserve_and_claim_prompt(
                    &state.app,
                    &operation_id,
                    &session_id,
                    row.workspace_id.as_deref(),
                    &payload_digest,
                    &text,
                    agent,
                    model.as_deref(),
                ) {
                    Ok(claim) => claim,
                    Err(error) => {
                        fail(
                            &state.out_tx,
                            None,
                            "prompt_operation_rejected",
                            error,
                            false,
                        );
                        return;
                    }
                };
                if claim.is_none() {
                    // A reconnect replayed a queued/claimed/terminal
                    // operation. The durable row already owns the prompt;
                    // only its original winner may launch it.
                    return;
                }
                state
                    .app
                    .running_sessions
                    .lock()
                    .unwrap()
                    .insert(session_id.clone());
                notify_session_updated(&state.app, &session_id);
                state.app.detached.start_turn(TurnRequest {
                    session_id,
                    operation_id: Some(operation_id.clone()),
                    host_id,
                    ssh_host: host.ssh_host,
                    cwd,
                    agent,
                    model,
                    // The attachment note is appended remote-side: the
                    // paths it has to name only exist once the run
                    // directory is known (see `launch_and_tail`).
                    prompt: text,
                    claude_session_id: row.claude_session_id,
                    codex_thread_id: row.codex_thread_id,
                    plan_mode,
                    effort,
                    attachments,
                });
                // Keep the operation `claimed` until the detached tail sees
                // real provider progress. `start_turn` only scheduled an SSH
                // launch; a missing binary, rejected credentials, or a crash
                // before the first provider event must remain `unconfirmed`
                // and must never be reported as delivered.
                return;
            }

            // Local turn: claude reads every attachment off the text note;
            // codex takes images through `-i` and the rest off the note.
            let (image_paths, note_paths): (Vec<String>, Vec<String>) = match agent {
                AgentKind::Claude => (Vec::new(), attachments.clone()),
                AgentKind::Codex => attachments
                    .iter()
                    .cloned()
                    .partition(|p| crate::agent::is_image_path(p)),
            };
            let prompt = crate::agent::append_attachment_note(&text, &note_paths);

            if let Err(error) = state.app.db.create_session(&session_id, &cwd) {
                fail(
                    &state.out_tx,
                    None,
                    "prompt_reservation_failed",
                    error.to_string(),
                    true,
                );
                return;
            }
            let Some(row) = state.app.db.get_session(&session_id).ok().flatten() else {
                fail(
                    &state.out_tx,
                    None,
                    "unknown_session",
                    format!("unknown session {session_id}"),
                    false,
                );
                return;
            };
            let payload_digest = prompt_payload_digest(
                &session_id,
                row.workspace_id.as_deref(),
                &host_id,
                &cwd,
                &text,
                agent,
                model.as_deref(),
                plan_mode,
                effort.as_deref(),
                &attachments,
            );
            let claim = match reserve_and_claim_prompt(
                &state.app,
                &operation_id,
                &session_id,
                row.workspace_id.as_deref(),
                &payload_digest,
                &text,
                agent,
                model.as_deref(),
            ) {
                Ok(claim) => claim,
                Err(error) => {
                    fail(
                        &state.out_tx,
                        None,
                        "prompt_operation_rejected",
                        error,
                        false,
                    );
                    return;
                }
            };
            if claim.is_none() {
                return;
            }

            let runner = {
                let map = state.runtimes.lock().unwrap();
                let Some(runtime) = map.get(&session_id) else {
                    drop(map);
                    if let Err(error) =
                        settle_prompt_dispatch(&state.app, &operation_id, "unconfirmed")
                    {
                        report_settlement_failure(state, &session_id, &operation_id, error);
                    }
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("unknown session {session_id}"),
                        request_id: None,
                        code: None,
                        retryable: false,
                    });
                    return;
                };
                let runner: Arc<dyn AgentRunner> = match agent {
                    AgentKind::Codex => {
                        let codex_runner = Arc::new(CodexRunner::new(CodexRunnerOptions {
                            cwd: runtime.cwd.clone(),
                            codex_bin: None,
                            model: model.clone(),
                            plan_mode,
                            effort: effort.clone(),
                            image_paths,
                        }));
                        *runtime.last_codex_runner.lock().unwrap() = Some(codex_runner.clone());
                        codex_runner
                    }
                    AgentKind::Claude => {
                        runtime.claude_runner.set_model(model.clone());
                        runtime
                            .claude_runner
                            .set_turn_options(plan_mode, effort.as_deref());
                        runtime.claude_runner.clone()
                    }
                };
                *runtime.active_runner.lock().unwrap() = Some(runner.clone());
                *runtime.pending_turn.lock().unwrap() = Some(PendingTurn {
                    agent,
                    model: model.clone(),
                    operation_id: operation_id.clone(),
                    failed: false,
                    accepted: false,
                    text: String::new(),
                    thinking: String::new(),
                });
                runner
            };

            // Mark running before spawning so the status is visible immediately.
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .insert(session_id.clone());
            notify_session_updated(&state.app, &session_id);

            let state = state.clone();
            let operation_id_for_task = operation_id.clone();
            let session_id_for_task = session_id.clone();
            tokio::spawn(async move {
                let (tx, mut rx) = unbounded_channel::<AgentEvent>();
                let send_fut = runner.send(prompt, tx);
                let state_for_forward = state.clone();
                let operation_for_forward = operation_id_for_task.clone();
                let session_for_forward = session_id_for_task.clone();
                let forward = async move {
                    let mut accepted = false;
                    let mut provider_error = false;
                    while let Some(event) = rx.recv().await {
                        // A provider stream event is the first positive
                        // evidence that the launched process accepted this
                        // turn. Spawn/task scheduling alone is insufficient:
                        // a missing binary or auth failure can occur after
                        // the task was queued but before any provider event.
                        if matches!(&event, AgentEvent::Error(_)) {
                            provider_error = true;
                        } else if !accepted && !provider_error && event.is_provider_progress() {
                            accepted = true;
                            mark_pending_prompt_accepted(&state_for_forward, &session_for_forward);
                            if let Err(error) = settle_prompt_dispatch(
                                &state_for_forward.app,
                                &operation_for_forward,
                                "delivered",
                            ) {
                                report_settlement_failure(
                                    &state_for_forward,
                                    &session_for_forward,
                                    &operation_for_forward,
                                    error,
                                );
                            }
                        }
                        handle_agent_event(&state_for_forward, &session_for_forward, event);
                    }
                    accepted
                };
                let (_, accepted) = tokio::join!(send_fut, forward);
                if !accepted {
                    // No provider event arrived. The runner may have failed
                    // before spawn, exited before producing output, or lost
                    // its stream; all are ambiguous and must remain safe to
                    // inspect without falsely claiming delivery.
                    if let Err(error) =
                        settle_prompt_dispatch(&state.app, &operation_id_for_task, "unconfirmed")
                    {
                        report_settlement_failure(
                            &state,
                            &session_id_for_task,
                            &operation_id_for_task,
                            error,
                        );
                    }
                }
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
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(&session_id);
            notify_session_updated(&state.app, &session_id);
        }
        ClientMessage::CommandsList { ref session_id } => {
            // Remote (perch-mode) sessions: the remote instance knows its own
            // cwd and CLIs, so ask it and unicast the reply back.
            if let Some(host_id) = state.app.hub.route_for_session(session_id) {
                state.app.hub.register_unicast(
                    PendingKey::Session(session_id.clone()),
                    state.conn_id.clone(),
                    state.out_tx.clone(),
                );
                state.app.hub.forward(&host_id, raw_text);
                return;
            }
            let session_id = session_id.clone();
            let Some((host_id, cwd)) = ({
                let map = state.runtimes.lock().unwrap();
                map.get(&session_id)
                    .map(|r| (r.host_id.clone(), r.cwd.clone()))
            }) else {
                let _ = state.out_tx.send(ServerMessage::CommandsList {
                    session_id,
                    claude: Vec::new(),
                    codex: Vec::new(),
                });
                return;
            };
            // Direct-mode host: probe the same two commands over ssh.
            let ssh_host = if host_id == "local" {
                None
            } else {
                direct_host(state, &host_id).map(|h| h.ssh_host)
            };
            let out_tx = state.out_tx.clone();
            tokio::spawn(async move {
                let lists = crate::commands::list_for(&host_id, ssh_host.as_deref(), &cwd).await;
                let _ = out_tx.send(ServerMessage::CommandsList {
                    session_id,
                    claude: lists.claude,
                    codex: lists.codex,
                });
            });
        }
        ClientMessage::TerminalOpen {
            request_id,
            session_id,
            pane_id,
            view_id,
            cols,
            rows,
        } => {
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
        ClientMessage::TerminalList {
            request_id,
            session_id,
        } => {
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
        ClientMessage::TerminalRelease {
            terminal_id,
            view_id,
        } => {
            state
                .app
                .workspace_terminals
                .release(&terminal_id, &format!("{}:{view_id}", state.conn_id));
        }
        ClientMessage::TerminalClose {
            request_id,
            session_id,
            terminal_id,
        } => {
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
        ClientMessage::AgentTerminalOpen {
            request_id,
            session_id,
            provider_id,
            view_id,
            cols,
            rows,
        } => {
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
        ClientMessage::AgentTerminalRelease {
            session_id,
            provider_id,
            view_id,
        } => {
            let state = state.clone();
            tokio::task::spawn_blocking(move || {
                release_agent_terminal(&state, &session_id, &provider_id, &view_id)
            });
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
                    "This session has a persistent CLI; reload this client to attach to it"
                        .to_string(),
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
                Ok(AttachOutcome::Created(terminal_id))
                | Ok(AttachOutcome::Reused(terminal_id)) => {
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
        ClientMessage::TerminalInput {
            terminal_id,
            data,
            generation,
        } => {
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
        ClientMessage::TerminalResize {
            terminal_id,
            cols,
            rows,
            generation,
        } => {
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
                let _ =
                    state
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

        ClientMessage::TerminalKill { terminal_id } => {
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

        // -----------------------------------------------------------------------
        // Settings & hosts (Stage D)
        // -----------------------------------------------------------------------
        ClientMessage::SettingsGet {} => config::handle_settings_get(state),
        ClientMessage::SettingsUpdate { patch } => config::handle_settings_update(state, patch),
        ClientMessage::HostsList {} => config::handle_hosts_list(state),
        ClientMessage::HostsUpsert { host } => config::handle_hosts_upsert(state, host),
        ClientMessage::HostsDelete { id } => config::handle_hosts_delete(state, id),

        // Fix 4: Archive / unarchive a session.
        ClientMessage::SessionArchive {
            session_id,
            archived,
        } => {
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
                        request_id: None,
                        code: None,
                        retryable: false,
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

            let _agent_operation = state.app.agent_operation_lock.lock().unwrap();
            let agent_keys = state
                .app
                .agent_runtime
                .lifecycle()
                .list()
                .into_iter()
                .filter(|snapshot| snapshot.key.session_id == session_id)
                .map(|snapshot| snapshot.key)
                .collect::<Vec<_>>();
            for key in &agent_keys {
                if let Err(error) = state.app.agent_runtime.remove(key) {
                    fail(
                        &state.out_tx,
                        None,
                        "agent_stop_failed",
                        error.to_string(),
                        true,
                    );
                    return;
                }
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
            state.app.agent_terminals.kill(&session_id);

            // Drop every other piece of in-memory bookkeeping keyed by this
            // session id.
            state.app.registry.remove(&session_id);
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(&session_id);
            state
                .app
                .unseen_sessions
                .lock()
                .unwrap()
                .remove(&session_id);
            state
                .app
                .blocked_sessions
                .lock()
                .unwrap()
                .remove(&session_id);
            state
                .app
                .session_viewers
                .lock()
                .unwrap()
                .remove(&session_id);
            if state.active_session_id.lock().unwrap().as_deref() == Some(session_id.as_str()) {
                *state.active_session_id.lock().unwrap() = None;
            }

            match state.app.workspace_terminals.delete_session(&session_id) {
                Ok(()) => {
                    for key in &agent_keys {
                        let _ = state.app.agent_persistence.delete_snapshot(key);
                        state.app.agent_modes.lock().unwrap().remove(key);
                    }
                    state
                        .app
                        .cli_active_sessions
                        .lock()
                        .unwrap()
                        .remove(&session_id);

                    // Fan out to every connection (this one included) via the
                    // same broadcast channel hosts.upsert/delete use, since
                    // the row a normal session.updated event looks up is gone.
                    let _ =
                        state
                            .app
                            .hub
                            .hub_events_tx
                            .send(Arc::new(ServerMessage::SessionDeleted {
                                session_id: session_id.clone(),
                            }));
                }
                Err(e) => {
                    let _ = state.out_tx.send(ServerMessage::Error {
                        message: format!("session.delete failed: {e}"),
                        request_id: None,
                        code: None,
                        retryable: false,
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
            let _ = state
                .out_tx
                .send(ServerMessage::SessionLayout { session_id, layout });
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
                        request_id: None,
                        code: None,
                        retryable: false,
                    });
                }
            }
        }

        // Item 1: directory browser for new-session cwd picker.
        ClientMessage::FsBrowse {
            request_id,
            host_id,
            path,
        } => {
            let target = host_id.as_deref().unwrap_or("local");
            if target != "local" && !target.is_empty() {
                // Direct-mode host: no perch to forward to — list over ssh.
                // Bounded and on a spawned task, so a slow devpod can't block
                // this connection's message loop.
                if let Some(host) = direct_host(state, target) {
                    let out_tx = state.out_tx.clone();
                    let target = target.to_string();
                    tokio::spawn(async move {
                        match crate::detached::browse_remote(&host.ssh_host, path.as_deref(), 30)
                            .await
                        {
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
                                    request_id: None,
                                    code: None,
                                    retryable: false,
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

        // Durable workspace filesystem operations. These requests carry only
        // a workspace id plus a workspace-relative path. The service resolves
        // the authorized root from the DB and all blocking descriptor/hash/
        // atomic-write work runs off the WebSocket message loop.
        ClientMessage::FsTree {
            request_id,
            workspace_id,
            path,
        } => {
            spawn_fs_tree(state, request_id, workspace_id, path);
        }
        ClientMessage::FsRead {
            request_id,
            workspace_id,
            path,
        } => {
            spawn_fs_read(state, request_id, workspace_id, path);
        }
        ClientMessage::FsPreview {
            request_id,
            workspace_id,
            path,
        } => {
            spawn_fs_preview(state, request_id, workspace_id, path);
        }
        ClientMessage::FsWrite {
            request_id,
            workspace_id,
            path,
            content,
            expected_version,
            expected_buffer_revision,
        } => {
            spawn_fs_write(
                state,
                request_id,
                workspace_id,
                path,
                content,
                expected_version,
                expected_buffer_revision,
            );
        }
        ClientMessage::FsBufferList {
            request_id,
            workspace_id,
        } => {
            spawn_fs_buffer_list(state, request_id, workspace_id);
        }
        ClientMessage::FsBufferGet {
            request_id,
            workspace_id,
            path,
        } => {
            spawn_fs_buffer_get(state, request_id, workspace_id, path);
        }
        ClientMessage::FsBufferSet {
            request_id,
            workspace_id,
            path,
            content,
            base_content,
            expected_buffer_revision,
        } => {
            spawn_fs_buffer_set(
                state,
                request_id,
                workspace_id,
                path,
                content,
                base_content,
                expected_buffer_revision,
            );
        }
        ClientMessage::FsBufferClose {
            request_id,
            workspace_id,
            path,
            expected_buffer_revision,
            discard,
        } => {
            spawn_fs_buffer_close(
                state,
                request_id,
                workspace_id,
                path,
                expected_buffer_revision,
                discard,
            );
        }

        ClientMessage::GitStatus {
            request_id,
            workspace_id,
            host_id,
            include_ignored,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_status(state, request_id, workspace_id, include_ignored);
        }
        ClientMessage::GitRefs {
            request_id,
            workspace_id,
            host_id,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_refs(state, request_id, workspace_id);
        }
        ClientMessage::GitDiff {
            request_id,
            workspace_id,
            host_id,
            target,
            include_untracked,
            ignore_whitespace,
            context_lines,
            path,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_diff(
                state,
                request_id,
                workspace_id,
                target,
                include_untracked,
                ignore_whitespace,
                context_lines,
                path,
            );
        }
        ClientMessage::GitStage {
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_path_action(state, request_id, workspace_id, paths, patch, true);
        }
        ClientMessage::GitUnstage {
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_path_action(state, request_id, workspace_id, paths, patch, false);
        }
        ClientMessage::GitDiscardPreview {
            request_id,
            workspace_id,
            host_id,
            mode,
            paths,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_discard_preview(state, request_id, workspace_id, mode, paths);
        }
        ClientMessage::GitDiscard {
            request_id,
            workspace_id,
            host_id,
            preview_id,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_discard(state, request_id, workspace_id, preview_id);
        }
        ClientMessage::GitCommitPreview {
            request_id,
            workspace_id,
            host_id,
            message,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_commit_preview(state, request_id, workspace_id, message);
        }
        ClientMessage::GitCommit {
            request_id,
            workspace_id,
            host_id,
            preview_id,
            message,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_git_commit(state, request_id, workspace_id, preview_id, message);
        }
        ClientMessage::ReviewList {
            request_id,
            workspace_id,
            host_id,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_list(state, request_id, workspace_id);
        }
        ClientMessage::ReviewCreate {
            request_id,
            workspace_id,
            host_id,
            id,
            session_id,
            agent_id,
            path,
            base,
            base_revision,
            side,
            range,
            body,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_create(
                state,
                request_id,
                workspace_id,
                id,
                session_id,
                agent_id,
                path,
                base,
                base_revision,
                side,
                range,
                body,
            );
        }
        ClientMessage::ReviewUpdate {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            body,
            expected_version,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_update(
                state,
                request_id,
                workspace_id,
                comment_id,
                body,
                expected_version,
            );
        }
        ClientMessage::ReviewResolve {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            resolved,
            expected_version,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_resolve(
                state,
                request_id,
                workspace_id,
                comment_id,
                resolved,
                expected_version,
            );
        }
        ClientMessage::ReviewDelete {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            expected_version,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_delete(
                state,
                request_id,
                workspace_id,
                comment_id,
                expected_version,
            );
        }
        ClientMessage::ReviewBatchPreview {
            request_id,
            workspace_id,
            host_id,
            send_operation_id,
            target_session_id,
            target_agent_id,
            current_revision,
            instruction,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_batch_preview(
                state,
                request_id,
                workspace_id,
                send_operation_id,
                target_session_id,
                target_agent_id,
                current_revision,
                instruction,
            );
        }
        ClientMessage::ReviewBatchSend {
            request_id,
            workspace_id,
            host_id,
            packet_id,
            send_operation_id,
        } => {
            if route_git_review_request(state, host_id.as_deref(), &request_id, raw_text) {
                return;
            }
            spawn_review_batch_send(
                state,
                request_id,
                workspace_id,
                packet_id,
                send_operation_id,
            );
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
        ClientMessage::WorktreeList {
            request_id,
            host_id,
            repo_path,
        } => {
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
                        workspace: None,
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
                        workspace: None,
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

        // -------------------------------------------------------------------
        // Durable project/workspace foundation. This first slice is local
        // only. A configured remote perch can advertise its own capability in
        // a later protocol revision; direct-mode hosts have no metadata
        // service, so returning an explicit unsupported error is safer than
        // accidentally reading a same-looking local path.
        // -------------------------------------------------------------------
        ClientMessage::ProjectList {
            request_id,
            host_id,
            include_archived,
        } => {
            if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id)
            {
                let _ = state.out_tx.send(message);
                return;
            }
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            match state.app.db.list_projects("local", include_archived) {
                Ok(projects) => {
                    let _ = state.out_tx.send(ServerMessage::ProjectList {
                        request_id,
                        host_id: "local".to_string(),
                        snapshot_epoch: state.app.snapshot_epoch.clone(),
                        snapshot_revision: current_snapshot_revision_locked(&state.app),
                        projects: projects.into_iter().map(project_to_wire).collect(),
                    });
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "project_list_failed",
                        format!("project.list failed: {err}"),
                        true,
                    );
                }
            }
        }

        ClientMessage::ProjectCreate {
            request_id,
            host_id,
            path,
            name,
        } => {
            if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id)
            {
                let _ = state.out_tx.send(message);
                return;
            }
            let canonical = crate::db::canonical_path_for_host("local", &path);
            if !Path::new(&canonical).is_dir() {
                fail(
                    &state.out_tx,
                    request_id,
                    "invalid_path",
                    format!("project path is not an existing directory: {canonical}"),
                    false,
                );
                return;
            }
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            match state
                .app
                .db
                .create_project("local", &canonical, name.as_deref())
            {
                Ok((project, workspace)) => {
                    let revision = next_snapshot_revision_locked(&state.app);
                    let project = project_to_wire(project);
                    let workspace = workspace_to_wire(workspace);
                    // Publish the row event while the mutation's revision is
                    // still protected by foundation_lock. The initiating
                    // connection also receives the complete correlated
                    // snapshot below, including the default workspace.
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::ProjectUpdated {
                            request_id: Some(request_id.clone()),
                            project,
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                    // Project creation also inserts its default workspace.
                    // Publish that row at the same serialized revision so
                    // already-connected clients can materialize the complete
                    // project/workspace pair without waiting for a refresh.
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::WorkspaceUpdated {
                            request_id: Some(request_id.clone()),
                            workspace,
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                    // The default workspace is part of project creation. A
                    // correlated snapshot gives the client its stable id and
                    // active selection in one coherent payload.
                    let snapshot = workspace_snapshot_locked(state, request_id.clone(), None);
                    let _ = state.out_tx.send(snapshot);
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "project_create_failed",
                        format!("project.create failed: {err}"),
                        true,
                    );
                }
            }
        }

        ClientMessage::ProjectRename {
            request_id,
            project_id,
            name,
        } => {
            let name = name.trim().to_string();
            if name.is_empty() {
                fail(
                    &state.out_tx,
                    request_id,
                    "invalid_name",
                    "project name cannot be empty",
                    false,
                );
                return;
            }
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(project) = local_project(&state.app, &project_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "project_not_found",
                    "project is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.rename_project(&project.id, &name) {
                Ok(project) => {
                    let revision = next_snapshot_revision_locked(&state.app);
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::ProjectUpdated {
                            request_id: Some(request_id),
                            project: project_to_wire(project),
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "project_rename_failed",
                        format!("project.rename failed: {err}"),
                        true,
                    );
                }
            }
        }

        ClientMessage::ProjectArchive {
            request_id,
            project_id,
            archived,
        } => {
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(project) = local_project(&state.app, &project_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "project_not_found",
                    "project is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.set_project_archived(&project.id, archived) {
                Ok(project) => {
                    let revision = next_snapshot_revision_locked(&state.app);
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::ProjectUpdated {
                            request_id: Some(request_id.clone()),
                            project: project_to_wire(project),
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                    send_workspace_snapshot_locked(state, request_id, None);
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "project_archive_failed",
                        format!("project.archive failed: {err}"),
                        true,
                    );
                }
            }
        }

        ClientMessage::ProjectFocus {
            request_id,
            project_id,
        } => {
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(project) = local_project(&state.app, &project_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "project_not_found",
                    "project is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.focus_project(&project.id) {
                Ok((_project, workspace)) => {
                    // Persisted focus seeds future connections. The active
                    // selection for this established connection is kept in
                    // ConnState, so a focus action in one tab/device cannot
                    // move another client's selection.
                    *state.active_project_id.lock().unwrap() = Some(project.id.clone());
                    *state.active_workspace_id.lock().unwrap() = Some(workspace.id.clone());
                    let revision = next_snapshot_revision_locked(&state.app);
                    let _ = state.out_tx.send(ServerMessage::WorkspaceFocus {
                        request_id: request_id.clone(),
                        host_id: "local".to_string(),
                        snapshot_epoch: state.app.snapshot_epoch.clone(),
                        snapshot_revision: revision,
                        active_project_id: Some(project.id),
                        active_workspace_id: Some(workspace.id),
                    });
                    send_workspace_snapshot_locked(state, request_id, None);
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "project_focus_failed",
                        format!("project.focus failed: {err}"),
                        false,
                    );
                }
            }
        }

        ClientMessage::WorkspaceSnapshot {
            request_id,
            host_id,
            project_id,
        } => {
            if let Some(message) = reject_non_local_foundation_host(host_id.as_deref(), &request_id)
            {
                let _ = state.out_tx.send(message);
                return;
            }
            send_workspace_snapshot(state, request_id, project_id);
        }

        ClientMessage::WorkspaceFocus {
            request_id,
            workspace_id,
        } => {
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "workspace_not_found",
                    "workspace is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.focus_workspace(&workspace.id) {
                Ok(workspace) => {
                    *state.active_project_id.lock().unwrap() = Some(workspace.project_id.clone());
                    *state.active_workspace_id.lock().unwrap() = Some(workspace.id.clone());
                    let revision = next_snapshot_revision_locked(&state.app);
                    let _ = state.out_tx.send(ServerMessage::WorkspaceFocus {
                        request_id,
                        host_id: "local".to_string(),
                        snapshot_epoch: state.app.snapshot_epoch.clone(),
                        snapshot_revision: revision,
                        active_project_id: Some(workspace.project_id),
                        active_workspace_id: Some(workspace.id),
                    });
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "workspace_focus_failed",
                        format!("workspace.focus failed: {err}"),
                        false,
                    );
                }
            }
        }

        ClientMessage::WorkspaceRename {
            request_id,
            workspace_id,
            name,
        } => {
            let name = name.trim().to_string();
            if name.is_empty() {
                fail(
                    &state.out_tx,
                    request_id,
                    "invalid_name",
                    "workspace name cannot be empty",
                    false,
                );
                return;
            }
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "workspace_not_found",
                    "workspace is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.rename_workspace(&workspace.id, &name) {
                Ok(workspace) => {
                    let revision = next_snapshot_revision_locked(&state.app);
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::WorkspaceUpdated {
                            request_id: Some(request_id),
                            workspace: workspace_to_wire(workspace),
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "workspace_rename_failed",
                        format!("workspace.rename failed: {err}"),
                        true,
                    );
                }
            }
        }

        ClientMessage::WorkspaceRestore {
            request_id,
            workspace_id,
        } => {
            let _foundation_guard = state.app.foundation_lock.lock().unwrap();
            let Some(workspace) = local_workspace(&state.app, &workspace_id) else {
                fail(
                    &state.out_tx,
                    request_id,
                    "workspace_not_found",
                    "workspace is not present on the local host",
                    false,
                );
                return;
            };
            match state.app.db.restore_workspace(&workspace.id) {
                Ok(workspace) => {
                    let revision = next_snapshot_revision_locked(&state.app);
                    broadcast_foundation(
                        &state.app,
                        ServerMessage::WorkspaceUpdated {
                            request_id: Some(request_id),
                            workspace: workspace_to_wire(workspace),
                            snapshot_epoch: state.app.snapshot_epoch.clone(),
                            snapshot_revision: revision,
                        },
                    );
                }
                Err(err) => {
                    fail(
                        &state.out_tx,
                        request_id,
                        "workspace_restore_failed",
                        format!("workspace.restore failed: {err}"),
                        false,
                    );
                }
            }
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
        AgentEvent::Plan { content } => emit(
            state,
            session_id,
            ServerMessage::ChatPlan {
                session_id: session_id.to_string(),
                content,
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
            emit(
                state,
                session_id,
                status_message(get_status(&cwd, Some(&last_usage))),
            );
            // Turn complete — mark idle, mark unseen if no one is watching
            // (herdr's `done` state), and broadcast to all connections.
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
            notify_session_updated(&state.app, session_id);
        }
        AgentEvent::Error(message) => {
            // Error also ends the turn — ensure running status can't get stuck.
            mark_pending_prompt_failed(state, session_id);
            state
                .app
                .running_sessions
                .lock()
                .unwrap()
                .remove(session_id);
            mark_unseen_if_unviewed(&state.app, session_id);
            notify_session_updated(&state.app, session_id);
            emit(
                state,
                session_id,
                ServerMessage::Error {
                    message,
                    request_id: None,
                    code: None,
                    retryable: false,
                },
            );
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

/// Record a provider failure on the in-flight operation before the runner's
/// terminal `chat.done` event arrives. This keeps an error from being mistaken
/// for a successful completion when a provider emits both events.
fn mark_pending_prompt_failed(state: &Arc<ConnState>, session_id: &str) {
    let operation_id = {
        let map = state.runtimes.lock().unwrap();
        let Some(runtime) = map.get(session_id) else {
            return;
        };
        let mut pending = runtime.pending_turn.lock().unwrap();
        let Some(turn) = pending.as_mut() else {
            return;
        };
        turn.failed = true;
        turn.operation_id.clone()
    };
    if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, "unconfirmed") {
        report_settlement_failure(state, session_id, &operation_id, error);
    }
}

/// Record positive provider progress on the local in-flight turn. This is
/// separate from the durable settlement call because a tool-only turn can
/// have no assistant text when its terminal `Done` event arrives.
fn mark_pending_prompt_accepted(state: &Arc<ConnState>, session_id: &str) {
    let map = state.runtimes.lock().unwrap();
    if let Some(runtime) = map.get(session_id) {
        if let Some(turn) = runtime.pending_turn.lock().unwrap().as_mut() {
            turn.accepted = true;
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
        map.get(session_id)
            .and_then(|r| r.pending_turn.lock().unwrap().take())
    };
    let Some(turn) = turn else { return };
    let operation_id = turn.operation_id.clone();
    let outcome = if turn.accepted && !turn.failed {
        "delivered"
    } else {
        "unconfirmed"
    };
    if turn.text.is_empty() && turn.thinking.is_empty() {
        if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, outcome) {
            tracing::error!(
                session_id,
                operation_id,
                error = %error,
                "failed to persist prompt dispatch outcome"
            );
        }
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
    if let Err(error) = settle_prompt_dispatch(&state.app, &operation_id, outcome) {
        tracing::error!(
            session_id,
            operation_id,
            error = %error,
            "failed to persist prompt dispatch outcome"
        );
    }
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
        map.get(session_id)
            .and_then(|r| r.claude_runner.claude_session_id())
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
        map.get(session_id).and_then(|r| {
            r.last_codex_runner
                .lock()
                .unwrap()
                .as_ref()
                .and_then(|r| r.thread_id())
        })
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

    fn viewers_of(session_id: &str, conn_ids: &[&str]) -> HashMap<String, HashSet<String>> {
        let mut map = HashMap::new();
        map.insert(
            session_id.to_string(),
            conn_ids.iter().map(|c| c.to_string()).collect(),
        );
        map
    }

    #[test]
    fn chat_chunk_forwards_to_a_viewer_of_its_session() {
        let msg = ServerMessage::ChatChunk {
            session_id: "s1".to_string(),
            text: "hi".to_string(),
        };
        let viewers = viewers_of("s1", &["conn-a", "conn-b"]);
        assert!(should_forward_to_viewer(&msg, "conn-a", &viewers));
    }

    #[test]
    fn chat_chunk_drops_for_a_connection_not_viewing_that_session() {
        let msg = ServerMessage::ChatChunk {
            session_id: "s1".to_string(),
            text: "hi".to_string(),
        };
        let viewers = viewers_of("s1", &["conn-a"]);
        assert!(!should_forward_to_viewer(&msg, "conn-b", &viewers));
    }

    #[test]
    fn chat_done_drops_when_session_has_no_viewers_entry_at_all() {
        let msg = ServerMessage::ChatDone {
            session_id: "s1".to_string(),
            usage: None,
        };
        let viewers: HashMap<String, HashSet<String>> = HashMap::new();
        assert!(!should_forward_to_viewer(&msg, "conn-a", &viewers));
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
        assert!(should_forward_to_viewer(&thinking, "conn-a", &viewers));
        assert!(!should_forward_to_viewer(&tool_use, "conn-a", &viewers));
        assert!(!should_forward_to_viewer(&tool_result, "conn-a", &viewers));
        assert!(!should_forward_to_viewer(&plan, "conn-a", &viewers));
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
            &viewers
        ));
        assert!(should_forward_to_viewer(&workspace_git, "conn-a", &viewers));
        assert!(should_forward_to_viewer(&host_state, "conn-a", &viewers));
        assert!(should_forward_to_viewer(&bare_error, "conn-a", &viewers));
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
            .create_project("local", &root.to_string_lossy(), None)
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
