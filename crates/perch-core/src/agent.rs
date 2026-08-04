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

use std::collections::{HashMap, HashSet};
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
    ToolUse {
        name: String,
        input: Value,
    },
    ToolResult {
        name: String,
        result: Value,
    },
    /// A plan-mode plan (claude only — see [`ClaudeStreamParser::plan_content_of`]).
    Plan {
        content: String,
    },
    Done(Option<ChatUsage>),
    Error(String),
}

// ---------------------------------------------------------------------------
// Per-turn knobs shared by every runner (local and detached)
// ---------------------------------------------------------------------------

/// Reasoning-effort level a client asked for, normalized. `"default"`, `""`
/// and `None` all mean "omit the flag entirely and let the CLI decide".
pub fn normalized_effort(effort: Option<&str>) -> Option<String> {
    let e = effort?.trim();
    if e.is_empty() || e.eq_ignore_ascii_case("default") {
        return None;
    }
    Some(e.to_ascii_lowercase())
}

/// Extensions codex can take as a real image attachment (`-i <path>`).
/// Everything else is named in the text note instead, which is the only route
/// claude has for *any* attachment.
pub fn is_image_path(path: &str) -> bool {
    let ext = path.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase());
    matches!(
        ext.as_deref(),
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp")
    )
}

/// Append the `[Attached files: …]` note the CLIs act on. This is the whole
/// attachment mechanism for claude (it `Read`s the paths itself, images
/// included) and the non-image half of it for codex.
pub fn append_attachment_note(text: &str, paths: &[String]) -> String {
    if paths.is_empty() {
        return text.to_string();
    }
    format!("{text}\n\n[Attached files: {}]", paths.join(", "))
}

/// The flag set every claude turn perch launches shares — local
/// ([`ClaudeRunner::run_once`]) and detached
/// ([`crate::detached::claude_command`]) alike — *excluding* the `-p` prompt
/// and the `--resume`/`--session-id` continuity pair.
///
/// `plan_mode` overrides `base_permission_mode` with `plan` rather than
/// sitting alongside it: they are the same CLI flag.
pub fn claude_turn_flags(
    base_permission_mode: &str,
    plan_mode: bool,
    model: Option<&str>,
    effort: Option<&str>,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--include-partial-messages".to_string(),
        "--permission-mode".to_string(),
        if plan_mode {
            "plan".to_string()
        } else {
            base_permission_mode.to_string()
        },
    ];
    if let Some(m) = model {
        args.push("--model".to_string());
        args.push(m.to_string());
    }
    if let Some(e) = normalized_effort(effort) {
        args.push("--effort".to_string());
        args.push(e);
    }
    args
}

/// `effort: "none"` is not one of `--effort`'s levels (the flag warns and
/// ignores it); what actually disables thinking on every model is
/// `MAX_THINKING_TOKENS=0` in the child's environment. Returns the env pair
/// to set, if any.
pub fn claude_effort_env(effort: Option<&str>) -> Option<(&'static str, &'static str)> {
    match normalized_effort(effort).as_deref() {
        Some("none") => Some(("MAX_THINKING_TOKENS", "0")),
        _ => None,
    }
}

/// The codex `exec` argv perch runs for one turn, *excluding* the binary
/// name and the trailing prompt (local passes `-- <text>`; detached passes a
/// bare `-` positional and pipes the prompt on stdin).
///
/// Argv order matters: `-i/--image` is variadic, so every image path must be
/// followed by another flag or an explicit separator before the positional
/// prompt — otherwise codex swallows the prompt as one more image filename.
pub fn codex_exec_flags(
    model: &str,
    plan_mode: bool,
    effort: Option<&str>,
    image_paths: &[String],
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "exec".to_string(),
        "--json".to_string(),
        "--skip-git-repo-check".to_string(),
        "-m".to_string(),
        model.to_string(),
    ];
    if let Some(e) = normalized_effort(effort) {
        args.push("-c".to_string());
        args.push(format!("model_reasoning_effort=\"{e}\""));
    }
    if plan_mode {
        args.push("--sandbox".to_string());
        args.push("read-only".to_string());
    }
    for p in image_paths {
        args.push("-i".to_string());
        args.push(p.clone());
    }
    args
}

/// Replace base64 `image` blocks inside a claude `tool_result` payload with a
/// short text placeholder.
///
/// **Why this exists:** when claude `Read`s an image (which is exactly what an
/// image attachment makes it do) the tool_result content carries the file back
/// as an inline base64 `image` block — hundreds of kilobytes for a small PNG.
/// That value used to be forwarded verbatim into `AgentEvent::ToolResult`,
/// i.e. straight onto the WebSocket and into the SQLite transcript. Stripping
/// it here — at the single point every runner's tool_result flows through —
/// keeps the wire and the DB small while leaving the model's own view of the
/// image completely untouched (this is perch's copy of the event, not
/// claude's).
pub fn strip_image_blocks(value: Value) -> Value {
    fn is_image(block: &Value) -> bool {
        block.get("type").and_then(Value::as_str) == Some("image")
    }
    fn placeholder() -> Value {
        serde_json::json!({ "type": "text", "text": "[image]" })
    }
    match value {
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|b| if is_image(&b) { placeholder() } else { b })
                .collect(),
        ),
        other if is_image(&other) => placeholder(),
        other => other,
    }
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

// ---------------------------------------------------------------------------
// Shared stream-json line parsers
// ---------------------------------------------------------------------------
//
// Both the *local* runners below and the *detached* (remote, over-ssh) runner
// in `detached.rs` consume byte-for-byte identical NDJSON: the same
// `claude -p --output-format stream-json` shapes and the same
// `codex exec --json` shapes. The parsers therefore live here as standalone,
// reusable state machines rather than as private methods on the runners —
// that shared parse layer is precisely what makes a detached remote turn
// render the same as a local one.
//
// Each parser owns only *stream* state (in-flight tool-use blocks, ids seen)
// and exposes the provider-side continuity id it scraped, so the caller can
// mirror it into its own state (`RunnerState`, or a DB row for detached runs).

/// Incremental parser for `claude --output-format stream-json
/// --include-partial-messages` NDJSON.
pub struct ClaudeStreamParser {
    tool_name_by_id: HashMap<String, String>,
    pending_tool_uses: HashMap<i64, PendingToolUse>,
    /// tool_use ids that were recognized as plan writes and reported as
    /// [`AgentEvent::Plan`] instead of a `Write` tool card. Their eventual
    /// `tool_result` is suppressed too, so the transcript shows one plan card
    /// rather than a plan card plus an orphaned "Write succeeded".
    plan_tool_use_ids: HashSet<String>,
    /// Claude's own session id, scraped from `system/init` or `result`.
    /// Recovery uses this to keep a turn that finished while perch was gone
    /// attached to its conversation.
    pub session_id: Option<String>,
    /// Set once a `{"type":"result"}` line has been seen — the in-band
    /// terminal marker.
    pub saw_terminal: bool,
}

impl Default for ClaudeStreamParser {
    fn default() -> Self {
        Self::new()
    }
}

impl ClaudeStreamParser {
    pub fn new() -> Self {
        Self {
            tool_name_by_id: HashMap::new(),
            pending_tool_uses: HashMap::new(),
            plan_tool_use_ids: HashSet::new(),
            session_id: None,
            saw_terminal: false,
        }
    }

    /// If this completed tool_use is really a **plan-mode plan**, return its
    /// markdown body.
    ///
    /// claude 2.1.220 has no `ExitPlanMode` tool: under
    /// `--permission-mode plan` the model writes the plan out as an ordinary
    /// `Write` whose `file_path` lands in the CLI's own plans directory. The
    /// match is on the `/.claude/plans/` **substring** deliberately — on a
    /// direct-mode host the path is absolute *on the remote*, so anchoring it
    /// to the local `$HOME` would silently never fire there.
    pub fn plan_content_of(name: &str, input: &Value) -> Option<String> {
        if name != "Write" {
            return None;
        }
        let path = input.get("file_path").and_then(Value::as_str)?;
        if !path.contains("/.claude/plans/") {
            return None;
        }
        let content = input.get("content").and_then(Value::as_str)?;
        if content.trim().is_empty() {
            None
        } else {
            Some(content.to_string())
        }
    }

    pub fn handle_line(&mut self, line: &str, tx: &UnboundedSender<AgentEvent>) {
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
                        self.session_id = Some(id.to_string());
                    }
                }
            }
            Some("stream_event") => {
                if let Some(event) = evt.get("event") {
                    self.handle_stream_event(event, tx);
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
                            let id = block.get("tool_use_id").and_then(Value::as_str);
                            // A plan write was reported as AgentEvent::Plan;
                            // don't also emit its "file written" result.
                            if id.is_some_and(|id| self.plan_tool_use_ids.contains(id)) {
                                continue;
                            }
                            let name = id
                                .and_then(|id| self.tool_name_by_id.get(id))
                                .cloned()
                                .unwrap_or_else(|| "unknown".to_string());
                            let result = block.get("content").cloned().unwrap_or(Value::Null);
                            let _ = tx.send(AgentEvent::ToolResult {
                                name,
                                result: strip_image_blocks(result),
                            });
                        }
                    }
                }
            }
            Some("result") => {
                self.saw_terminal = true;
                if let Some(id) = evt.get("session_id").and_then(Value::as_str) {
                    self.session_id = Some(id.to_string());
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
                        output_tokens: raw
                            .get("output_tokens")
                            .and_then(Value::as_u64)
                            .unwrap_or(0),
                        cost_usd: evt
                            .get("total_cost_usd")
                            .and_then(Value::as_f64)
                            .unwrap_or(0.0),
                        context_tokens: input_tokens + cache_read + cache_creation,
                    }
                });
                if evt
                    .get("is_error")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
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

    fn handle_stream_event(&mut self, event: &Value, tx: &UnboundedSender<AgentEvent>) {
        let index = event.get("index").and_then(Value::as_i64).unwrap_or(-1);
        match event.get("type").and_then(Value::as_str) {
            Some("content_block_start") => {
                if let Some(block) = event.get("content_block") {
                    if block.get("type").and_then(Value::as_str) == Some("tool_use") {
                        self.pending_tool_uses.insert(
                            index,
                            PendingToolUse {
                                id: block
                                    .get("id")
                                    .and_then(Value::as_str)
                                    .unwrap_or("")
                                    .to_string(),
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
                            let text = delta
                                .get("text")
                                .and_then(Value::as_str)
                                .unwrap_or("")
                                .to_string();
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
                            if let Some(pending) = self.pending_tool_uses.get_mut(&index) {
                                pending.json.push_str(
                                    delta
                                        .get("partial_json")
                                        .and_then(Value::as_str)
                                        .unwrap_or(""),
                                );
                            }
                        }
                        _ => {} // signature_delta etc. — not surfaced
                    }
                }
            }
            Some("content_block_stop") => {
                if let Some(pending) = self.pending_tool_uses.remove(&index) {
                    self.tool_name_by_id
                        .insert(pending.id.clone(), pending.name.clone());
                    let input = if pending.json.is_empty() {
                        Value::Object(Default::default())
                    } else {
                        serde_json::from_str(&pending.json).unwrap_or(Value::String(pending.json))
                    };
                    if let Some(content) = Self::plan_content_of(&pending.name, &input) {
                        self.plan_tool_use_ids.insert(pending.id);
                        let _ = tx.send(AgentEvent::Plan { content });
                        return;
                    }
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

/// Incremental parser for `codex exec --json` NDJSON. See the `CodexRunner`
/// doc comment below for the event shapes.
#[derive(Default)]
pub struct CodexStreamParser {
    /// Codex's own `thread_id`, scraped from `thread.started`.
    pub thread_id: Option<String>,
    /// Set once a terminal event (`turn.completed`/`turn.failed`/`error`) has
    /// been seen.
    pub saw_terminal: bool,
}

impl CodexStreamParser {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn handle_line(&mut self, line: &str, tx: &UnboundedSender<AgentEvent>) {
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
                        let text = item
                            .get("text")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string();
                        let _ = tx.send(AgentEvent::Chunk(text));
                    }
                    Some("reasoning") => {
                        let text = item
                            .get("text")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string();
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
                self.saw_terminal = true;
                let usage = evt.get("usage").map(|raw| {
                    let input_tokens = raw.get("input_tokens").and_then(Value::as_u64).unwrap_or(0);
                    ChatUsage {
                        input_tokens,
                        output_tokens: raw
                            .get("output_tokens")
                            .and_then(Value::as_u64)
                            .unwrap_or(0),
                        // codex reports no cost; ChatUsage has no optional cost field.
                        cost_usd: 0.0,
                        context_tokens: input_tokens,
                    }
                });
                let _ = tx.send(AgentEvent::Done(usage));
            }
            Some("turn.failed") => {
                self.saw_terminal = true;
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
                self.saw_terminal = true;
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
                    self.thread_id = Some(id.to_string());
                }
            }
            _ => {} // turn.started, item.started/updated — nothing new to report
        }
    }
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
    /// Run the next turn under `--permission-mode plan`. Per-turn for the
    /// same reason `model` is: permission modes can be changed freely between
    /// turns of one `--resume`d claude session (validated on 2.1.220).
    plan_mode: bool,
    /// `--effort <level>` for the next turn, already normalized (see
    /// [`normalized_effort`]); `None` omits the flag.
    effort: Option<String>,
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
                plan_mode: false,
                effort: None,
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

    /// Set plan mode + reasoning effort for the *next* turn. Both are reset
    /// on every `chat.send`, so a turn never inherits the previous turn's
    /// knobs.
    pub fn set_turn_options(&self, plan_mode: bool, effort: Option<&str>) {
        let mut s = self.state.lock().unwrap();
        s.plan_mode = plan_mode;
        s.effort = normalized_effort(effort);
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

/// The per-turn knobs snapshotted out of `RunnerState` at the top of `send`,
/// so the retry-as-new-session path uses exactly the same ones.
struct TurnKnobs {
    plan_mode: bool,
    effort: Option<String>,
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
        turn: &TurnKnobs,
        text: &str,
        state: &Arc<Mutex<RunnerState>>,
        tx: &UnboundedSender<AgentEvent>,
        mode: RunMode,
        session_id: &str,
    ) -> TurnOutcome {
        let mut args: Vec<String> = vec!["-p".to_string(), text.to_string()];
        args.extend(claude_turn_flags(
            permission_mode,
            turn.plan_mode,
            model.as_deref(),
            turn.effort.as_deref(),
        ));
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
        if let Some((k, v)) = claude_effort_env(turn.effort.as_deref()) {
            cmd.env(k, v);
        }

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

        let mut parser = ClaudeStreamParser::new();

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
                    parser.handle_line(&line, tx);
                    // Mirror whatever provider session id the parser scraped
                    // into the runner's own state, so `--resume` continuity
                    // and DB persistence keep working exactly as before the
                    // parser was factored out.
                    if let Some(id) = &parser.session_id {
                        let mut s = state.lock().unwrap();
                        if s.claude_session_id.as_deref() != Some(id.as_str()) {
                            s.claude_session_id = Some(id.clone());
                        }
                    }
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
                    format!(
                        "claude exited with code {}: {tail}",
                        status.code().unwrap_or(-1)
                    )
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
            let turn = {
                let s = state.lock().unwrap();
                TurnKnobs {
                    plan_mode: s.plan_mode,
                    effort: s.effort.clone(),
                }
            };
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
                &turn,
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
                    &turn,
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
    /// Plan mode for this turn → `--sandbox read-only`. Codex has no plan
    /// *artifact* (nothing like claude's plan file), so this is purely a
    /// safety mode: the turn can read and reason but not write.
    pub plan_mode: bool,
    /// Reasoning effort → `-c model_reasoning_effort="<level>"`.
    pub effort: Option<String>,
    /// Image attachments, passed with a repeated `-i`. Non-image attachments
    /// are appended to the prompt text by the caller instead.
    pub image_paths: Vec<String>,
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
    plan_mode: bool,
    effort: Option<String>,
    image_paths: Vec<String>,
    state: Arc<Mutex<CodexState>>,
}

impl CodexRunner {
    pub fn new(options: CodexRunnerOptions) -> Self {
        Self {
            cwd: options.cwd,
            codex_bin: options.codex_bin.unwrap_or_else(|| "codex".to_string()),
            model: options.model.unwrap_or_else(|| "gpt-5.4-mini".to_string()),
            plan_mode: options.plan_mode,
            effort: options.effort,
            image_paths: options.image_paths,
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
}

impl AgentRunner for CodexRunner {
    fn send(&self, text: String, tx: UnboundedSender<AgentEvent>) -> BoxFuture<'static, ()> {
        let cwd = self.cwd.clone();
        let codex_bin = self.codex_bin.clone();
        let model = self.model.clone();
        let plan_mode = self.plan_mode;
        let effort = self.effort.clone();
        let image_paths = self.image_paths.clone();
        let state = self.state.clone();

        async move {
            {
                let mut s = state.lock().unwrap();
                s.cancelled = false;
                s.child_pid = None;
            }

            // `--` before the prompt is load-bearing whenever `-i` is present:
            // `-i/--image` is variadic, so without the separator codex would
            // read the prompt as one more image filename. It is harmless (and
            // kept unconditional) otherwise, and additionally protects a
            // prompt that happens to start with `-`.
            let mut args = codex_exec_flags(&model, plan_mode, effort.as_deref(), &image_paths);
            args.push("--".to_string());
            args.push(text);

            let mut cmd = Command::new(&codex_bin);
            cmd.args(&args)
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
            let mut parser = CodexStreamParser::new();
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
                    Ok(Some(line)) => {
                        parser.handle_line(&line, &tx);
                        if let Some(id) = &parser.thread_id {
                            let mut s = state.lock().unwrap();
                            if s.thread_id.as_deref() != Some(id.as_str()) {
                                s.thread_id = Some(id.clone());
                            }
                        }
                    }
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
                        format!(
                            "codex exited with code {}: {tail}",
                            status.code().unwrap_or(-1)
                        )
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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc::unbounded_channel;

    fn drain(rx: &mut tokio::sync::mpsc::UnboundedReceiver<AgentEvent>) -> Vec<AgentEvent> {
        let mut out = Vec::new();
        while let Ok(e) = rx.try_recv() {
            out.push(e);
        }
        out
    }

    // -- F2: plan detection ------------------------------------------------

    #[test]
    fn plan_write_is_detected_by_the_plans_path_substring() {
        let input = serde_json::json!({
            "file_path": "/home/user/.claude/plans/2026-07-31-hello.md",
            "content": "## Plan\n1. touch hello.txt",
        });
        assert_eq!(
            ClaudeStreamParser::plan_content_of("Write", &input).as_deref(),
            Some("## Plan\n1. touch hello.txt"),
        );
        // Remote-side absolute paths must match too — the check is on the
        // substring, never on the local $HOME.
        let remote = serde_json::json!({
            "file_path": "/mnt/devpod/home/other/.claude/plans/p.md",
            "content": "remote plan",
        });
        assert!(ClaudeStreamParser::plan_content_of("Write", &remote).is_some());
    }

    #[test]
    fn ordinary_writes_and_other_tools_are_not_plans() {
        let ordinary = serde_json::json!({ "file_path": "/repo/hello.txt", "content": "hi" });
        assert!(ClaudeStreamParser::plan_content_of("Write", &ordinary).is_none());
        let plan_path = serde_json::json!({
            "file_path": "/home/u/.claude/plans/p.md",
            "content": "x",
        });
        assert!(ClaudeStreamParser::plan_content_of("Edit", &plan_path).is_none());
        let empty = serde_json::json!({
            "file_path": "/home/u/.claude/plans/p.md",
            "content": "   ",
        });
        assert!(ClaudeStreamParser::plan_content_of("Write", &empty).is_none());
    }

    #[test]
    fn plan_write_streams_as_plan_and_suppresses_its_tool_result() {
        let (tx, mut rx) = unbounded_channel();
        let mut p = ClaudeStreamParser::new();
        let json = serde_json::json!({
            "file_path": "/home/u/.claude/plans/p.md",
            "content": "the plan"
        })
        .to_string();
        p.handle_line(
            &serde_json::json!({"type":"stream_event","event":{"type":"content_block_start","index":0,
                "content_block":{"type":"tool_use","id":"tu_1","name":"Write"}}})
            .to_string(),
            &tx,
        );
        p.handle_line(
            &serde_json::json!({"type":"stream_event","event":{"type":"content_block_delta","index":0,
                "delta":{"type":"input_json_delta","partial_json":json}}})
            .to_string(),
            &tx,
        );
        p.handle_line(
            &serde_json::json!({"type":"stream_event","event":{"type":"content_block_stop","index":0}})
                .to_string(),
            &tx,
        );
        p.handle_line(
            &serde_json::json!({"type":"user","message":{"content":[
                {"type":"tool_result","tool_use_id":"tu_1","content":"File created"}]}})
            .to_string(),
            &tx,
        );
        let events = drain(&mut rx);
        assert_eq!(events.len(), 1, "expected only the plan event: {events:?}");
        match &events[0] {
            AgentEvent::Plan { content } => assert_eq!(content, "the plan"),
            other => panic!("expected Plan, got {other:?}"),
        }
    }

    // -- F3: image-block stripping ----------------------------------------

    #[test]
    fn strip_image_blocks_replaces_base64_images_with_a_placeholder() {
        let result = serde_json::json!([
            {"type": "text", "text": "Read 1 image"},
            {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                          "data": "iVBORw0KGgoAAAANS..."}},
        ]);
        let stripped = strip_image_blocks(result);
        assert_eq!(
            stripped,
            serde_json::json!([
                {"type": "text", "text": "Read 1 image"},
                {"type": "text", "text": "[image]"},
            ])
        );
        // A bare image object (not in an array) is handled too.
        assert_eq!(
            strip_image_blocks(serde_json::json!({"type":"image","source":{"data":"AAAA"}})),
            serde_json::json!({"type":"text","text":"[image]"})
        );
        // Everything else passes through untouched.
        let plain = serde_json::json!("ok");
        assert_eq!(strip_image_blocks(plain.clone()), plain);
    }

    #[test]
    fn tool_result_events_are_stripped_before_they_reach_the_wire() {
        let (tx, mut rx) = unbounded_channel();
        let mut p = ClaudeStreamParser::new();
        let big = "A".repeat(5000);
        p.handle_line(
            &serde_json::json!({"type":"user","message":{"content":[
                {"type":"tool_result","tool_use_id":"tu_x","content":[
                    {"type":"image","source":{"type":"base64","data": big}}]}]}})
            .to_string(),
            &tx,
        );
        let events = drain(&mut rx);
        match &events[0] {
            AgentEvent::ToolResult { result, .. } => {
                let s = result.to_string();
                assert!(s.contains("[image]"), "{s}");
                assert!(
                    s.len() < 200,
                    "payload should be tiny, got {} bytes",
                    s.len()
                );
            }
            other => panic!("expected ToolResult, got {other:?}"),
        }
    }

    // -- F4 / F2: argv construction ---------------------------------------

    #[test]
    fn claude_argv_defaults_match_the_pre_existing_flag_set() {
        assert_eq!(
            claude_turn_flags("bypassPermissions", false, Some("claude-haiku-4-5"), None),
            vec![
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--permission-mode",
                "bypassPermissions",
                "--model",
                "claude-haiku-4-5",
            ]
        );
    }

    #[test]
    fn claude_argv_swaps_the_permission_mode_in_plan_mode_and_appends_effort() {
        let args = claude_turn_flags("bypassPermissions", true, None, Some("high"));
        assert_eq!(
            args,
            vec![
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--permission-mode",
                "plan",
                "--effort",
                "high",
            ]
        );
        assert!(!args.contains(&"bypassPermissions".to_string()));
    }

    #[test]
    fn effort_default_is_omitted_and_none_also_sets_the_thinking_env() {
        for omitted in [None, Some(""), Some("default"), Some("DEFAULT")] {
            let args = claude_turn_flags("bypassPermissions", false, None, omitted);
            assert!(!args.contains(&"--effort".to_string()), "{omitted:?}");
            assert!(claude_effort_env(omitted).is_none(), "{omitted:?}");
        }
        assert_eq!(
            claude_effort_env(Some("none")),
            Some(("MAX_THINKING_TOKENS", "0"))
        );
        assert_eq!(claude_effort_env(Some("low")), None);
    }

    #[test]
    fn codex_argv_orders_effort_sandbox_and_images_before_the_prompt_separator() {
        let images = vec!["/tmp/a.png".to_string(), "/tmp/b.jpg".to_string()];
        let args = codex_exec_flags("gpt-5.4-mini", true, Some("low"), &images);
        assert_eq!(
            args,
            vec![
                "exec",
                "--json",
                "--skip-git-repo-check",
                "-m",
                "gpt-5.4-mini",
                "-c",
                "model_reasoning_effort=\"low\"",
                "--sandbox",
                "read-only",
                "-i",
                "/tmp/a.png",
                "-i",
                "/tmp/b.jpg",
            ]
        );
        // `-i` is variadic: the last flag must be an image path, so the caller
        // has to insert a separator before the positional prompt.
        assert_eq!(args.last().unwrap(), "/tmp/b.jpg");
    }

    #[test]
    fn codex_argv_without_knobs_is_the_original_invocation() {
        assert_eq!(
            codex_exec_flags("gpt-5.4-mini", false, None, &[]),
            vec![
                "exec",
                "--json",
                "--skip-git-repo-check",
                "-m",
                "gpt-5.4-mini"
            ]
        );
    }

    // -- F3: attachment routing -------------------------------------------

    #[test]
    fn image_paths_are_recognized_case_insensitively() {
        assert!(is_image_path("/tmp/a.PNG"));
        assert!(is_image_path("/tmp/a.jpeg"));
        assert!(!is_image_path("/tmp/a.pdf"));
        assert!(!is_image_path("/tmp/noext"));
    }

    #[test]
    fn attachment_note_is_appended_only_when_there_are_attachments() {
        assert_eq!(append_attachment_note("hi", &[]), "hi");
        assert_eq!(
            append_attachment_note("hi", &["/a/b.png".to_string(), "/c/d.pdf".to_string()]),
            "hi\n\n[Attached files: /a/b.png, /c/d.pdf]"
        );
    }
}
