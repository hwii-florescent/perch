//! Wire protocol between perch-core and its clients (web/desktop).
//!
//! Mirrors `packages/shared/src/protocol.ts` exactly — same `type` strings,
//! same field names (camelCase on the wire). Both enums are internally
//! tagged by `type` so a client/server can dispatch with a single match.
//!
//! Note: `rename_all` on an enum only affects variant-name casing, not the
//! field names inside struct variants — so each variant below repeats
//! `rename_all = "camelCase"` to get its fields onto the wire correctly.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost_usd: f64,
    pub context_tokens: u64,
}

/// Which backend a `chat.send` should be routed to. Mirrors the TS union
/// `"claude" | "codex"`; defaults to `Claude` when the field is omitted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentKind {
    Claude,
    Codex,
}

impl Default for AgentKind {
    fn default() -> Self {
        AgentKind::Claude
    }
}

/// Requests that `terminal.create` spawn the given session's *interactive*
/// agent CLI (resumed from whatever conversation state that session already
/// has) instead of a plain shell. The client only names the session + agent;
/// the server alone resolves the provider-internal resume id (claude session
/// id / codex thread id) — that state never crosses the wire.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAttach {
    pub session_id: String,
    pub agent: AgentKind,
}

/// A single persisted turn, replayed to a resuming client. Mirrors the TS
/// `HistoryMessage` interface.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<AgentKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "session.create", rename_all = "camelCase")]
    SessionCreate { cwd: Option<String> },

    #[serde(rename = "session.subscribe", rename_all = "camelCase")]
    SessionSubscribe { session_id: String },

    #[serde(rename = "session.resume", rename_all = "camelCase")]
    SessionResume { session_id: String },

    #[serde(rename = "chat.send", rename_all = "camelCase")]
    ChatSend {
        session_id: String,
        text: String,
        #[serde(default)]
        agent: AgentKind,
        model: Option<String>,
    },

    #[serde(rename = "chat.cancel", rename_all = "camelCase")]
    ChatCancel { session_id: String },

    #[serde(rename = "terminal.create", rename_all = "camelCase")]
    TerminalCreate {
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        #[serde(default)]
        agent_attach: Option<AgentAttach>,
    },

    #[serde(rename = "terminal.input", rename_all = "camelCase")]
    TerminalInput { terminal_id: String, data: String },

    #[serde(rename = "terminal.resize", rename_all = "camelCase")]
    TerminalResize {
        terminal_id: String,
        cols: u16,
        rows: u16,
    },
}

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "session.created", rename_all = "camelCase")]
    SessionCreated { session_id: String },

    #[serde(rename = "session.history", rename_all = "camelCase")]
    SessionHistory {
        session_id: String,
        messages: Vec<HistoryMessage>,
    },

    #[serde(rename = "chat.chunk", rename_all = "camelCase")]
    ChatChunk { session_id: String, text: String },

    #[serde(rename = "chat.thinking", rename_all = "camelCase")]
    ChatThinking { session_id: String, text: String },

    #[serde(rename = "chat.tool_use", rename_all = "camelCase")]
    ChatToolUse {
        session_id: String,
        name: String,
        input: Value,
    },

    #[serde(rename = "chat.tool_result", rename_all = "camelCase")]
    ChatToolResult {
        session_id: String,
        name: String,
        result: Value,
    },

    #[serde(rename = "chat.done", rename_all = "camelCase")]
    ChatDone {
        session_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        usage: Option<ChatUsage>,
    },

    #[serde(rename = "terminal.created", rename_all = "camelCase")]
    TerminalCreated { terminal_id: String },

    #[serde(rename = "terminal.data", rename_all = "camelCase")]
    TerminalData { terminal_id: String, data: String },

    #[serde(rename = "terminal.exit", rename_all = "camelCase")]
    TerminalExit { terminal_id: String, code: i32 },

    #[serde(rename = "status.update", rename_all = "camelCase")]
    StatusUpdate {
        cwd: String,
        branch: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        context_tokens: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cost_usd: Option<f64>,
    },

    #[serde(rename = "error")]
    Error { message: String },
}
