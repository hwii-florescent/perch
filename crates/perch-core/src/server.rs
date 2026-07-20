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

use std::collections::HashMap;
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
use crate::db::HistoryDb;
use crate::protocol::{AgentKind, ChatUsage, ClientMessage, ServerMessage};
use crate::registry::SessionRegistry;
use crate::status::{get_status, LastUsage};
use crate::terminal::TerminalManager;

pub struct CliArgs {
    pub port: u16,
    pub headless: bool,
    pub base_path: String,
    pub public_base_url: Option<String>,
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
}

#[derive(Clone)]
struct AppState {
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
}

pub async fn run(
    options: ServerOptions,
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
) -> anyhow::Result<()> {
    let base_path = normalize_base_path(&options.base_path);
    let ws_path = format!("{base_path}ws");

    let state = AppState {
        registry,
        db,
        default_cwd,
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

    let addr = SocketAddr::from(([0, 0, 0, 0], options.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(
        "[perch] listening on port {} (base path {base_path}, ws at {ws_path})",
        options.port
    );
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
    registry: Arc<SessionRegistry>,
    db: Arc<HistoryDb>,
    default_cwd: String,
    out_tx: UnboundedSender<ServerMessage>,
    runtimes: Mutex<HashMap<String, SessionRuntime>>,
    terminals: TerminalManager,
}

async fn handle_socket(socket: WebSocket, app: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let (out_tx, mut out_rx) = unbounded_channel::<ServerMessage>();

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
        registry: app.registry.clone(),
        db: app.db.clone(),
        default_cwd: app.default_cwd.clone(),
        out_tx,
        runtimes: Mutex::new(HashMap::new()),
        terminals: TerminalManager::new(on_data, on_exit),
    });

    let initial_status = get_status(&state.default_cwd, None);
    let _ = state.out_tx.send(status_message(initial_status));

    while let Some(Ok(msg)) = receiver.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        match serde_json::from_str::<ClientMessage>(&text) {
            Ok(client_msg) => handle_message(&state, client_msg),
            Err(_) => {
                let _ = state.out_tx.send(ServerMessage::Error {
                    message: "invalid JSON".to_string(),
                });
            }
        }
    }

    // Connection closed: tear down terminals + in-flight agent turns.
    state.terminals.dispose_all();
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

fn emit(state: &Arc<ConnState>, session_id: &str, message: ServerMessage) {
    state.registry.record(session_id, message.clone());
    let _ = state.out_tx.send(message);
}

/// Build a fresh `ClaudeRunner` (optionally primed to `--resume` a known
/// claude session id) and register it as the session's runtime for this
/// connection.
fn insert_runtime(state: &Arc<ConnState>, session_id: &str, cwd: &str, claude_session_id: Option<String>) {
    let claude_runner = Arc::new(ClaudeRunner::new(ClaudeRunnerOptions {
        cwd: cwd.to_string(),
        claude_bin: None,
        permission_mode: None,
    }));
    if let Some(id) = claude_session_id {
        claude_runner.resume_session(id);
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

fn handle_message(state: &Arc<ConnState>, msg: ClientMessage) {
    match msg {
        ClientMessage::SessionCreate { cwd } => {
            let session_id = Uuid::new_v4().to_string();
            let cwd = cwd.unwrap_or_else(|| state.default_cwd.clone());
            state.registry.create(&session_id, &cwd);
            let _ = state.db.create_session(&session_id, &cwd);
            insert_runtime(state, &session_id, &cwd, None);
            let _ = state.out_tx.send(ServerMessage::SessionCreated {
                session_id: session_id.clone(),
            });
            let _ = state.out_tx.send(status_message(get_status(&cwd, None)));
        }
        ClientMessage::SessionResume { session_id } => {
            match state.db.get_session(&session_id) {
                Ok(Some(row)) => {
                    state.registry.create(&session_id, &row.cwd);
                    insert_runtime(state, &session_id, &row.cwd, row.claude_session_id.clone());
                    let _ = state.out_tx.send(ServerMessage::SessionCreated {
                        session_id: session_id.clone(),
                    });
                    let messages = state.db.load_messages(&session_id).unwrap_or_default();
                    let _ = state.out_tx.send(ServerMessage::SessionHistory {
                        session_id: session_id.clone(),
                        messages,
                    });
                    let _ = state.out_tx.send(status_message(get_status(&row.cwd, None)));
                }
                _ => {
                    // Unknown/stale id (fresh machine, cleared DB, server
                    // restart lost it — shouldn't happen since we read from
                    // SQLite, but be defensive) — behave like session.create:
                    // mint a brand-new session with no history.
                    let new_id = Uuid::new_v4().to_string();
                    let cwd = state.default_cwd.clone();
                    state.registry.create(&new_id, &cwd);
                    let _ = state.db.create_session(&new_id, &cwd);
                    insert_runtime(state, &new_id, &cwd, None);
                    let _ = state.out_tx.send(ServerMessage::SessionCreated {
                        session_id: new_id.clone(),
                    });
                    let _ = state.out_tx.send(status_message(get_status(&cwd, None)));
                }
            }
        }
        ClientMessage::SessionSubscribe { session_id } => {
            for event in state.registry.replay(&session_id) {
                let _ = state.out_tx.send(event);
            }
        }
        ClientMessage::ChatSend {
            session_id,
            text,
            agent,
            model,
        } => {
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
            let _ = state.db.add_message(
                &session_id,
                "user",
                &text,
                Some(agent_str(agent)),
                model.as_deref(),
                None,
            );

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
            if let Some(runtime) = state.runtimes.lock().unwrap().get(&session_id) {
                if let Some(runner) = runtime.active_runner.lock().unwrap().as_ref() {
                    runner.cancel();
                }
            }
        }
        ClientMessage::TerminalCreate {
            cols,
            rows,
            cwd,
            agent_attach,
        } => {
            let Some(attach) = agent_attach else {
                let cwd = Some(cwd.unwrap_or_else(|| state.default_cwd.clone()));
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
                            let _ = state.db.set_claude_session_id(&attach.session_id, &id);
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
                        .db
                        .get_session(&attach.session_id)
                        .ok()
                        .flatten()
                        .and_then(|row| row.codex_thread_id);
                    match codex_thread_id {
                        Some(id) => {
                            let codex_model = {
                                let map = state.runtimes.lock().unwrap();
                                map.get(&attach.session_id).and_then(|r| {
                                    r.last_codex_runner.lock().unwrap().as_ref().map(|r| r.model())
                                })
                            };
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
            state.terminals.input(&terminal_id, &data);
        }
        ClientMessage::TerminalResize { terminal_id, cols, rows } => {
            state.terminals.resize(&terminal_id, cols, rows);
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
        }
        AgentEvent::Error(message) => emit(state, session_id, ServerMessage::Error { message }),
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
    let _ = state.db.add_message(
        session_id,
        "assistant",
        &turn.text,
        Some(agent_str(turn.agent)),
        turn.model.as_deref(),
        thinking,
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
        let _ = state.db.set_claude_session_id(session_id, &id);
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
        let _ = state.db.set_codex_thread_id(session_id, &id);
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
