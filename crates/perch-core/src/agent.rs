//! Drives Claude Code headlessly, mirroring
//! `reference/node-server-spec/src/claudeRunner.ts` (the verified Node spec)
//! exactly:
//!
//! `claude -p "<text>" --output-format stream-json --verbose
//! --include-partial-messages --permission-mode bypassPermissions`, parsing
//! the NDJSON stream on stdout into [`AgentEvent`]s. One process is spawned
//! per turn; multi-turn continuity is achieved via `--session-id` on the
//! first turn and `--resume <id>` on subsequent turns.
//!
//! Observed event shapes (from `claude --output-format stream-json
//! --include-partial-messages`):
//!   - `{type:"system", subtype:"init", session_id, cwd, ...}`
//!   - `{type:"stream_event", event:{type:"message_start"|"content_block_start"
//!     |"content_block_delta"|"content_block_stop"|"message_delta"|"message_stop", ...}}`
//!     content_block_start.content_block.type: "text" | "thinking" | "tool_use"
//!     content_block_delta.delta.type: "text_delta" | "thinking_delta"
//!       | "signature_delta" | "input_json_delta"
//!   - `{type:"assistant", message:{...}}` — full snapshot, redundant with the
//!     accumulated stream_events above; ignored.
//!   - `{type:"user", message:{content:[{type:"tool_result", tool_use_id, content, is_error}]}}`
//!   - `{type:"result", subtype, is_error, result, session_id, total_cost_usd, usage:{...}}`

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use futures::future::BoxFuture;
use futures::FutureExt;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc::UnboundedSender;

use crate::protocol::ChatUsage;

/// Events streamed back from an in-flight turn, one per protocol-level
/// callback in the Node `AgentRunnerEvents` interface.
#[derive(Debug, Clone)]
pub enum AgentEvent {
    Chunk(String),
    Thinking(String),
    ToolUse { name: String, input: Value },
    ToolResult { name: String, result: Value },
    Done(Option<ChatUsage>),
    Error(String),
}

/// A pluggable chat backend for a single perch session. One instance is
/// created per session and reused across turns so it can carry whatever
/// continuation state the backend needs (e.g. a provider-side session id).
///
/// Methods take `&self`: implementations use interior mutability so `cancel`
/// can be called concurrently with an in-flight `send` (matching the Node
/// design, where `cancel()` just calls `child.kill()` on the live process).
pub trait AgentRunner: Send + Sync {
    /// Start (or continue) a turn, streaming events to `tx` until the turn
    /// finishes (normally, on error, or because `cancel` was called).
    fn send(&self, text: String, tx: UnboundedSender<AgentEvent>) -> BoxFuture<'static, ()>;

    /// Abort the in-flight turn, if any. Safe to call when idle.
    fn cancel(&self);
}

pub struct ClaudeRunnerOptions {
    pub cwd: String,
    /// Path/name of the claude binary. Defaults to "claude" (resolved via PATH).
    pub claude_bin: Option<String>,
    /// Permission mode passed to claude. Defaults to "bypassPermissions"
    /// since there is no TTY to answer interactive prompts headlessly.
    pub permission_mode: Option<String>,
}

struct RunnerState {
    claude_session_id: Option<String>,
    /// Model alias for the *next* turn (e.g. "claude-haiku-4-5"). `None`
    /// means omit `--model` and let claude use its own default. Held in the
    /// same interior-mutable state as the session id so it can be changed
    /// per-turn (via `set_model`) without disturbing multi-turn `--resume`
    /// continuity, which lives on this same `ClaudeRunner` instance.
    model: Option<String>,
    cancelled: bool,
    child_pid: Option<u32>,
}

pub struct ClaudeRunner {
    cwd: String,
    claude_bin: String,
    permission_mode: String,
    state: Arc<Mutex<RunnerState>>,
}

struct PendingToolUse {
    id: String,
    name: String,
    json: String,
}

impl ClaudeRunner {
    pub fn new(options: ClaudeRunnerOptions) -> Self {
        Self {
            cwd: options.cwd,
            claude_bin: options.claude_bin.unwrap_or_else(|| "claude".to_string()),
            permission_mode: options
                .permission_mode
                .unwrap_or_else(|| "bypassPermissions".to_string()),
            state: Arc::new(Mutex::new(RunnerState {
                claude_session_id: None,
                model: None,
                cancelled: false,
                child_pid: None,
            })),
        }
    }

    /// Set the model alias to use for the *next* turn. Pass `None` to fall
    /// back to claude's own default.
    pub fn set_model(&self, model: Option<String>) {
        self.state.lock().unwrap().model = model;
    }

    /// Prime this runner to `--resume` an existing claude session (e.g. one
    /// loaded from the perch DB after a `session.resume`), rather than
    /// starting a fresh one on the next turn.
    pub fn resume_session(&self, claude_session_id: String) {
        self.state.lock().unwrap().claude_session_id = Some(claude_session_id);
    }

    /// The claude CLI's own session id currently tracked by this runner (set
    /// from the `system init`/`result` events after the first turn), if any.
    /// Persisted to the perch DB so a later `session.resume` can pass it to
    /// `--resume`.
    pub fn claude_session_id(&self) -> Option<String> {
        self.state.lock().unwrap().claude_session_id.clone()
    }

    /// The model alias currently set on this runner (via `set_model`), if
    /// any. Used by CLI-mode terminal attach to pass the same `--model`
    /// explicitly on `--resume`/`--session-id` — without it, claude falls
    /// back to the dated snapshot id recorded in the transcript (e.g.
    /// `claude-haiku-4-5-20251001`), which the GenAI proxy rejects; only the
    /// bare alias (`claude-haiku-4-5`) works.
    pub fn model(&self) -> Option<String> {
        self.state.lock().unwrap().model.clone()
    }

    fn handle_line(
        line: &str,
        tx: &UnboundedSender<AgentEvent>,
        state: &Mutex<RunnerState>,
        tool_name_by_id: &mut HashMap<String, String>,
        pending_tool_uses: &mut HashMap<i64, PendingToolUse>,
    ) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }
        let evt: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => return, // ignore malformed / partial lines
        };

        match evt.get("type").and_then(Value::as_str) {
            Some("system") => {
                if evt.get("subtype").and_then(Value::as_str) == Some("init") {
                    if let Some(id) = evt.get("session_id").and_then(Value::as_str) {
                        state.lock().unwrap().claude_session_id = Some(id.to_string());
                    }
                }
            }
            Some("stream_event") => {
                if let Some(event) = evt.get("event") {
                    Self::handle_stream_event(event, tx, tool_name_by_id, pending_tool_uses);
                }
            }
            Some("user") => {
                if let Some(content) = evt
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(Value::as_array)
                {
                    for block in content {
                        if block.get("type").and_then(Value::as_str) == Some("tool_result") {
                            let name = block
                                .get("tool_use_id")
                                .and_then(Value::as_str)
                                .and_then(|id| tool_name_by_id.get(id))
                                .cloned()
                                .unwrap_or_else(|| "unknown".to_string());
                            let result = block.get("content").cloned().unwrap_or(Value::Null);
                            let _ = tx.send(AgentEvent::ToolResult { name, result });
                        }
                    }
                }
            }
            Some("result") => {
                if let Some(id) = evt.get("session_id").and_then(Value::as_str) {
                    state.lock().unwrap().claude_session_id = Some(id.to_string());
                }
                let usage = evt.get("usage").map(|raw| {
                    let input_tokens = raw.get("input_tokens").and_then(Value::as_u64).unwrap_or(0);
                    let cache_read = raw
                        .get("cache_read_input_tokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0);
                    let cache_creation = raw
                        .get("cache_creation_input_tokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0);
                    ChatUsage {
                        input_tokens,
                        output_tokens: raw.get("output_tokens").and_then(Value::as_u64).unwrap_or(0),
                        cost_usd: evt.get("total_cost_usd").and_then(Value::as_f64).unwrap_or(0.0),
                        context_tokens: input_tokens + cache_read + cache_creation,
                    }
                });
                if evt.get("is_error").and_then(Value::as_bool).unwrap_or(false) {
                    let message = evt
                        .get("result")
                        .and_then(Value::as_str)
                        .unwrap_or("claude reported an error")
                        .to_string();
                    let _ = tx.send(AgentEvent::Error(message));
                }
                let _ = tx.send(AgentEvent::Done(usage));
            }
            _ => {} // assistant snapshots, hook events, etc. — nothing new to report
        }
    }

    fn handle_stream_event(
        event: &Value,
        tx: &UnboundedSender<AgentEvent>,
        tool_name_by_id: &mut HashMap<String, String>,
        pending_tool_uses: &mut HashMap<i64, PendingToolUse>,
    ) {
        let index = event.get("index").and_then(Value::as_i64).unwrap_or(-1);
        match event.get("type").and_then(Value::as_str) {
            Some("content_block_start") => {
                if let Some(block) = event.get("content_block") {
                    if block.get("type").and_then(Value::as_str) == Some("tool_use") {
                        pending_tool_uses.insert(
                            index,
                            PendingToolUse {
                                id: block.get("id").and_then(Value::as_str).unwrap_or("").to_string(),
                                name: block
                                    .get("name")
                                    .and_then(Value::as_str)
                                    .unwrap_or("unknown")
                                    .to_string(),
                                json: String::new(),
                            },
                        );
                    }
                }
            }
            Some("content_block_delta") => {
                if let Some(delta) = event.get("delta") {
                    match delta.get("type").and_then(Value::as_str) {
                        Some("text_delta") => {
                            let text = delta.get("text").and_then(Value::as_str).unwrap_or("").to_string();
                            let _ = tx.send(AgentEvent::Chunk(text));
                        }
                        Some("thinking_delta") => {
                            let thinking = delta
                                .get("thinking")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
                            let _ = tx.send(AgentEvent::Thinking(thinking));
                        }
                        Some("input_json_delta") => {
                            if let Some(pending) = pending_tool_uses.get_mut(&index) {
                                pending
                                    .json
                                    .push_str(delta.get("partial_json").and_then(Value::as_str).unwrap_or(""));
                            }
                        }
                        _ => {} // signature_delta etc. — not surfaced
                    }
                }
            }
            Some("content_block_stop") => {
                if let Some(pending) = pending_tool_uses.remove(&index) {
                    tool_name_by_id.insert(pending.id, pending.name.clone());
                    let input = if pending.json.is_empty() {
                        Value::Object(Default::default())
                    } else {
                        serde_json::from_str(&pending.json).unwrap_or(Value::String(pending.json))
                    };
                    let _ = tx.send(AgentEvent::ToolUse {
                        name: pending.name,
                        input,
                    });
                }
            }
            _ => {} // message_start/delta/stop — usage is read off the final "result" event instead
        }
    }
}

/// Whether a `run_once` attempt used `--resume <id>` or `--session-id <id>`
/// (fresh transcript).
#[derive(Clone, Copy, PartialEq, Eq)]
enum RunMode {
    Resume,
    New,
}

/// Outcome of a single claude process run, used to decide whether `send`
/// should retry.
enum TurnOutcome {
    /// The turn ran to completion (successfully or with a genuine error) and
    /// all events were already forwarded to `tx`.
    Completed,
    /// `--resume <id>` failed immediately because claude has no transcript
    /// for that id (fresh machine, pruned history, etc.) — no events were
    /// forwarded, and the caller should retry as a new session.
    ResumeNotFound,
}

impl ClaudeRunner {
    /// True if `line` is claude's immediate failure response to a
    /// `--resume <id>` for an id it doesn't recognize, e.g.:
    /// `{"type":"result","subtype":"error_during_execution","is_error":true,
    /// "errors":["No conversation found with session ID: ..."],...}`.
    fn is_resume_not_found(line: &str) -> bool {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return false;
        }
        let Ok(evt) = serde_json::from_str::<Value>(trimmed) else {
            return false;
        };
        if evt.get("type").and_then(Value::as_str) != Some("result") {
            return false;
        }
        if evt.get("subtype").and_then(Value::as_str) != Some("error_during_execution") {
            return false;
        }
        evt.get("errors")
            .and_then(Value::as_array)
            .map(|errors| {
                errors
                    .iter()
                    .filter_map(Value::as_str)
                    .any(|e| e.contains("No conversation found"))
            })
            .unwrap_or(false)
    }

    /// Spawn one claude process for this turn and stream its NDJSON output
    /// as [`AgentEvent`]s, mirroring the loop that used to live inline in
    /// `send`. Split out so `send` can retry once (as a fresh session) if
    /// `--resume` reports it has no transcript for `session_id`.
    #[allow(clippy::too_many_arguments)]
    async fn run_once(
        cwd: &str,
        claude_bin: &str,
        permission_mode: &str,
        model: &Option<String>,
        text: &str,
        state: &Arc<Mutex<RunnerState>>,
        tx: &UnboundedSender<AgentEvent>,
        mode: RunMode,
        session_id: &str,
    ) -> TurnOutcome {
        let mut args: Vec<String> = vec![
            "-p".to_string(),
            text.to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--include-partial-messages".to_string(),
            "--permission-mode".to_string(),
            permission_mode.to_string(),
        ];
        if let Some(model) = model {
            args.push("--model".to_string());
            args.push(model.clone());
        }
        match mode {
            RunMode::Resume => {
                args.push("--resume".to_string());
                args.push(session_id.to_string());
            }
            RunMode::New => {
                args.push("--session-id".to_string());
                args.push(session_id.to_string());
            }
        }

        let mut cmd = Command::new(claude_bin);
        cmd.args(&args)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(err) => {
                let _ = tx.send(AgentEvent::Error(format!("failed to spawn claude: {err}")));
                return TurnOutcome::Completed;
            }
        };
        state.lock().unwrap().child_pid = child.id();

        let stdout = child.stdout.take().expect("piped stdout");
        let stderr = child.stderr.take().expect("piped stderr");

        let mut tool_name_by_id: HashMap<String, String> = HashMap::new();
        let mut pending_tool_uses: HashMap<i64, PendingToolUse> = HashMap::new();

        let mut stdout_lines = BufReader::new(stdout).lines();
        let stderr_task = tokio::spawn(async move {
            let mut buf = String::new();
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                buf.push_str(&line);
                buf.push('\n');
            }
            buf
        });

        let mut resume_not_found = false;
        loop {
            match stdout_lines.next_line().await {
                Ok(Some(line)) => {
                    if mode == RunMode::Resume && Self::is_resume_not_found(&line) {
                        // Don't forward this line: it's not a real turn
                        // result, just claude telling us the id is unknown.
                        // The caller retries as a fresh session instead.
                        resume_not_found = true;
                        break;
                    }
                    Self::handle_line(&line, tx, state, &mut tool_name_by_id, &mut pending_tool_uses);
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        let status = child.wait().await;
        let stderr_tail = stderr_task.await.unwrap_or_default();
        let cancelled = state.lock().unwrap().cancelled;
        state.lock().unwrap().child_pid = None;

        if resume_not_found {
            return TurnOutcome::ResumeNotFound;
        }

        match status {
            Ok(status) if !cancelled && !status.success() => {
                let tail: String = stderr_tail.trim().chars().take(2000).collect();
                let message = if tail.is_empty() {
                    format!("claude exited with code {}", status.code().unwrap_or(-1))
                } else {
                    format!("claude exited with code {}: {tail}", status.code().unwrap_or(-1))
                };
                let _ = tx.send(AgentEvent::Error(message));
            }
            Err(err) if !cancelled => {
                let _ = tx.send(AgentEvent::Error(format!("failed to spawn claude: {err}")));
            }
            _ => {}
        }
        TurnOutcome::Completed
    }
}

impl AgentRunner for ClaudeRunner {
    fn send(&self, text: String, tx: UnboundedSender<AgentEvent>) -> BoxFuture<'static, ()> {
        let cwd = self.cwd.clone();
        let claude_bin = self.claude_bin.clone();
        let permission_mode = self.permission_mode.clone();
        let state = self.state.clone();

        async move {
            {
                let mut s = state.lock().unwrap();
                s.cancelled = false;
                s.child_pid = None;
            }

            let model = state.lock().unwrap().model.clone();
            let resume_id = state.lock().unwrap().claude_session_id.clone();
            let (mode, session_id) = match resume_id {
                Some(id) => (RunMode::Resume, id),
                None => {
                    let id = uuid::Uuid::new_v4().to_string();
                    state.lock().unwrap().claude_session_id = Some(id.clone());
                    (RunMode::New, id)
                }
            };

            let outcome = Self::run_once(
                &cwd,
                &claude_bin,
                &permission_mode,
                &model,
                &text,
                &state,
                &tx,
                mode,
                &session_id,
            )
            .await;

            if matches!(outcome, TurnOutcome::ResumeNotFound) {
                // claude has no transcript for this id (fresh machine, or
                // history was pruned) — fall back to starting a session
                // fresh under the *same* id, so this and future perch
                // sessions stay aligned with what claude actually knows
                // about, and later resumes succeed.
                tracing::warn!(
                    "claude --resume {session_id} found no transcript; retrying as a new session with the same id"
                );
                state.lock().unwrap().cancelled = false;
                Self::run_once(
                    &cwd,
                    &claude_bin,
                    &permission_mode,
                    &model,
                    &text,
                    &state,
                    &tx,
                    RunMode::New,
                    &session_id,
                )
                .await;
            }
        }
        .boxed()
    }

    fn cancel(&self) {
        let mut s = self.state.lock().unwrap();
        s.cancelled = true;
        if let Some(pid) = s.child_pid {
            // Best-effort SIGTERM; matches Node's `child.kill("SIGTERM")`.
            #[cfg(unix)]
            unsafe {
                raw_kill(pid as i32, 15);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

/// Drives `codex exec` headlessly:
///
/// `codex exec --json --skip-git-repo-check -m <model> "<text>"`, with stdin
/// closed (otherwise codex waits on "Reading additional input from
/// stdin..." and hangs). `--json` emits one JSON object per line:
///   - `{"type":"thread.started","thread_id":"..."}` / `{"type":"turn.started"}` — ignored
///   - `{"type":"item.completed","item":{"type":"agent_message","text":"..."}}` -> chat.chunk
///   - `{"type":"item.completed","item":{"type":"reasoning","text":"..."}}` -> chat.thinking
///   - `{"type":"item.completed","item":{"type":"command_execution"|...}}` -> best-effort
///     chat.tool_use/chat.tool_result
///   - `{"type":"turn.completed","usage":{"input_tokens":N,"output_tokens":M}}` -> chat.done
///   - `{"type":"turn.failed","error":{"message":"..."}}` / `{"type":"error","message":"..."}`
///     -> error + chat.done
///
/// Unlike `ClaudeRunner`, each turn is a fresh, independent process — no
/// `--resume`/session-id continuity (not required yet).
pub struct CodexRunnerOptions {
    pub cwd: String,
    /// Path/name of the codex binary. Defaults to "codex" (resolved via PATH).
    pub codex_bin: Option<String>,
    /// Model alias, e.g. "gpt-5.4-mini". Defaults to "gpt-5.4-mini".
    pub model: Option<String>,
}

struct CodexState {
    cancelled: bool,
    child_pid: Option<u32>,
    /// The codex CLI's own `thread_id` for this runner's turn (from the
    /// `thread.started` event), if seen yet. Persisted to the perch DB so a
    /// later CLI-mode attach can pass it to `codex resume`.
    thread_id: Option<String>,
}

pub struct CodexRunner {
    cwd: String,
    codex_bin: String,
    model: String,
    state: Arc<Mutex<CodexState>>,
}

impl CodexRunner {
    pub fn new(options: CodexRunnerOptions) -> Self {
        Self {
            cwd: options.cwd,
            codex_bin: options.codex_bin.unwrap_or_else(|| "codex".to_string()),
            model: options.model.unwrap_or_else(|| "gpt-5.4-mini".to_string()),
            state: Arc::new(Mutex::new(CodexState {
                cancelled: false,
                child_pid: None,
                thread_id: None,
            })),
        }
    }

    /// The codex CLI's own `thread_id` currently tracked by this runner (set
    /// from the `thread.started` event), if any.
    pub fn thread_id(&self) -> Option<String> {
        self.state.lock().unwrap().thread_id.clone()
    }

    /// The model alias this runner was constructed with — used by CLI-mode
    /// terminal attach to pass the same `--model` explicitly on `resume`,
    /// for the same reason claude needs it (see `ClaudeRunner::model`).
    pub fn model(&self) -> String {
        self.model.clone()
    }

    fn handle_line(line: &str, tx: &UnboundedSender<AgentEvent>, state: &Mutex<CodexState>) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return;
        }
        let evt: Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => return, // ignore malformed / partial lines
        };

        match evt.get("type").and_then(Value::as_str) {
            Some("item.completed") => {
                let Some(item) = evt.get("item") else { return };
                match item.get("type").and_then(Value::as_str) {
                    Some("agent_message") => {
                        let text = item.get("text").and_then(Value::as_str).unwrap_or("").to_string();
                        let _ = tx.send(AgentEvent::Chunk(text));
                    }
                    Some("reasoning") => {
                        let text = item.get("text").and_then(Value::as_str).unwrap_or("").to_string();
                        let _ = tx.send(AgentEvent::Thinking(text));
                    }
                    Some(kind) => {
                        // Best-effort: surface command/tool executions as a
                        // paired tool_use/tool_result (codex reports these
                        // as already-completed, so there's no separate
                        // "started" event to key off of).
                        let name = item
                            .get("command")
                            .and_then(Value::as_str)
                            .unwrap_or(kind)
                            .to_string();
                        let _ = tx.send(AgentEvent::ToolUse {
                            name: name.clone(),
                            input: item.clone(),
                        });
                        let result = item
                            .get("aggregated_output")
                            .or_else(|| item.get("output"))
                            .cloned()
                            .unwrap_or(Value::Null);
                        let _ = tx.send(AgentEvent::ToolResult { name, result });
                    }
                    None => {}
                }
            }
            Some("turn.completed") => {
                let usage = evt.get("usage").map(|raw| {
                    let input_tokens = raw.get("input_tokens").and_then(Value::as_u64).unwrap_or(0);
                    ChatUsage {
                        input_tokens,
                        output_tokens: raw.get("output_tokens").and_then(Value::as_u64).unwrap_or(0),
                        // codex reports no cost; ChatUsage has no optional cost field.
                        cost_usd: 0.0,
                        context_tokens: input_tokens,
                    }
                });
                let _ = tx.send(AgentEvent::Done(usage));
            }
            Some("turn.failed") => {
                let message = evt
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(Value::as_str)
                    .unwrap_or("codex turn failed")
                    .to_string();
                let _ = tx.send(AgentEvent::Error(message));
                let _ = tx.send(AgentEvent::Done(None));
            }
            Some("error") => {
                let message = evt
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("codex reported an error")
                    .to_string();
                let _ = tx.send(AgentEvent::Error(message));
                let _ = tx.send(AgentEvent::Done(None));
            }
            Some("thread.started") => {
                if let Some(id) = evt.get("thread_id").and_then(Value::as_str) {
                    state.lock().unwrap().thread_id = Some(id.to_string());
                }
            }
            _ => {} // turn.started, item.started/updated — nothing new to report
        }
    }
}

impl AgentRunner for CodexRunner {
    fn send(&self, text: String, tx: UnboundedSender<AgentEvent>) -> BoxFuture<'static, ()> {
        let cwd = self.cwd.clone();
        let codex_bin = self.codex_bin.clone();
        let model = self.model.clone();
        let state = self.state.clone();

        async move {
            {
                let mut s = state.lock().unwrap();
                s.cancelled = false;
                s.child_pid = None;
            }

            let mut cmd = Command::new(&codex_bin);
            cmd.args(["exec", "--json", "--skip-git-repo-check", "-m", &model, &text])
                .current_dir(&cwd)
                // Must be closed: codex otherwise prints "Reading additional
                // input from stdin..." and hangs waiting for EOF.
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(err) => {
                    let _ = tx.send(AgentEvent::Error(format!("failed to spawn codex: {err}")));
                    return;
                }
            };
            state.lock().unwrap().child_pid = child.id();

            let stdout = child.stdout.take().expect("piped stdout");
            let stderr = child.stderr.take().expect("piped stderr");

            let mut stdout_lines = BufReader::new(stdout).lines();
            let stderr_task = tokio::spawn(async move {
                let mut buf = String::new();
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    buf.push_str(&line);
                    buf.push('\n');
                }
                buf
            });

            loop {
                match stdout_lines.next_line().await {
                    Ok(Some(line)) => Self::handle_line(&line, &tx, &state),
                    Ok(None) => break,
                    Err(_) => break,
                }
            }

            let status = child.wait().await;
            let stderr_tail = stderr_task.await.unwrap_or_default();
            let cancelled = state.lock().unwrap().cancelled;
            state.lock().unwrap().child_pid = None;

            match status {
                Ok(status) if !cancelled && !status.success() => {
                    let tail: String = stderr_tail.trim().chars().take(2000).collect();
                    let message = if tail.is_empty() {
                        format!("codex exited with code {}", status.code().unwrap_or(-1))
                    } else {
                        format!("codex exited with code {}: {tail}", status.code().unwrap_or(-1))
                    };
                    let _ = tx.send(AgentEvent::Error(message));
                }
                Err(err) if !cancelled => {
                    let _ = tx.send(AgentEvent::Error(format!("failed to spawn codex: {err}")));
                }
                _ => {}
            }
        }
        .boxed()
    }

    fn cancel(&self) {
        let mut s = self.state.lock().unwrap();
        s.cancelled = true;
        if let Some(pid) = s.child_pid {
            // Best-effort SIGTERM; matches Node's `child.kill("SIGTERM")`.
            #[cfg(unix)]
            unsafe {
                raw_kill(pid as i32, 15);
            }
        }
    }
}

// Minimal libc::kill shim so we don't need to pull in the `libc` or `nix`
// crates just for one syscall (the C runtime is always linked for std
// binaries on Unix; we declare the FFI signature ourselves).
#[cfg(unix)]
extern "C" {
    fn kill(pid: i32, sig: i32) -> i32;
}

#[cfg(unix)]
unsafe fn raw_kill(pid: i32, sig: i32) {
    kill(pid, sig);
}
