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
// Settings & hosts value types (Stage D)
// ---------------------------------------------------------------------------

/// Mirrored from `settings::CustomModelsData` for the wire protocol.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct CustomModelsData {
    pub claude: Vec<ModelEntry>,
    pub codex: Vec<ModelEntry>,
}

/// Settings sent to / received from the client over the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsData {
    pub custom_models: CustomModelsData,
    pub default_cwd: Option<String>,
}

/// Patch applied via `settings.update`. Fields absent from JSON → no change.
/// `defaultCwd: null` → clear; `defaultCwd: "path"` → set.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub custom_models: Option<CustomModelsData>,
    /// Outer `None` = field absent (no change).
    /// `Some(None)` = field present as `null` (clear).
    /// `Some(Some(_))` = field present with a value (set).
    #[serde(default, deserialize_with = "deserialize_some")]
    pub default_cwd: Option<Option<String>>,
}

/// Deserialize a JSON field where absent, null, and a value are all distinct.
/// Used for `SettingsPatch::default_cwd`.
fn deserialize_some<'de, T, D>(deserializer: D) -> Result<Option<T>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Deserialize::deserialize(deserializer).map(Some)
}

/// A single SSH host entry on the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SshHostEntry {
    pub id: String,
    pub name: String,
    pub ssh_host: String,
    #[serde(default = "default_remote_port")]
    pub remote_port: u16,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Skip SSH tunnel; connect directly to this WS URL (e.g. `ws://127.0.0.1:7800/ws`).
    /// Used in e2e tests and LAN scenarios where an SSH tunnel is unnecessary.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direct_url: Option<String>,
    /// Command used to auto-start the remote perch binary when it's not already
    /// running.  The literal `{port}` is replaced with the remote port.
    /// Default: `~/perch/target/debug/perch-core --port {port}`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_cmd: Option<String>,
}

impl Default for SshHostEntry {
    fn default() -> Self {
        SshHostEntry {
            id: String::new(),
            name: String::new(),
            ssh_host: String::new(),
            remote_port: default_remote_port(),
            enabled: default_enabled(),
            direct_url: None,
            remote_cmd: None,
        }
    }
}

fn default_remote_port() -> u16 { 7788 }
fn default_enabled() -> bool { true }

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/// A single model entry sent from server to client as part of `server.info`.
/// The server discovers the available models at startup; clients must not
/// maintain their own hardcoded lists — this struct is the single source of
/// truth for what models are available on any given machine.
///
/// Stage D will replace the ad-hoc `~/.perch/settings.json` custom-model
/// reader in `models.rs` with a formal settings module that also emits these.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub id: String,
    pub label: String,
}

/// Running/idle indicator for a session, broadcast to all connected clients
/// whenever a turn starts or completes. Mirrors the TS `SessionStatus` union.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Running,
    Idle,
}

/// Summary of a persisted session, used in `session.list` and
/// `session.updated` broadcasts. Mirrors the TS `SessionSummary` interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    /// First user-message snippet (up to 40 chars), or empty string if no
    /// messages yet.
    pub title: String,
    pub cwd: String,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_agent: Option<AgentKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_model: Option<String>,
    pub status: SessionStatus,
    /// Which host this session belongs to.  `"local"` for the local perch
    /// instance; a host `id` for any federated remote.
    #[serde(default = "default_local_host_id")]
    pub host_id: String,
}

fn default_local_host_id() -> String {
    "local".to_string()
}

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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    SessionCreate {
        cwd: Option<String>,
        /// Optional target host.  `None` / `"local"` = this instance.
        /// A non-local id routes the request through the hub to that remote.
        #[serde(default)]
        host_id: Option<String>,
    },

    #[serde(rename = "session.list")]
    SessionList {},

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

    #[serde(rename = "settings.get")]
    SettingsGet {},

    #[serde(rename = "settings.update", rename_all = "camelCase")]
    SettingsUpdate { patch: SettingsPatch },

    #[serde(rename = "hosts.list")]
    HostsList {},

    #[serde(rename = "hosts.upsert", rename_all = "camelCase")]
    HostsUpsert { host: SshHostEntry },

    #[serde(rename = "hosts.delete", rename_all = "camelCase")]
    HostsDelete { id: String },
}

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "session.created", rename_all = "camelCase")]
    SessionCreated { session_id: String },

    #[serde(rename = "session.list", rename_all = "camelCase")]
    SessionList { sessions: Vec<SessionSummary> },

    #[serde(rename = "session.updated", rename_all = "camelCase")]
    SessionUpdated { session: SessionSummary },

    #[serde(rename = "server.info", rename_all = "camelCase")]
    ServerInfo {
        hostname: String,
        is_ssh: bool,
        platform: String,
        claude_models: Vec<ModelEntry>,
        codex_models: Vec<ModelEntry>,
    },

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

    #[serde(rename = "settings.current", rename_all = "camelCase")]
    SettingsCurrent { settings: SettingsData },

    #[serde(rename = "hosts.list", rename_all = "camelCase")]
    HostsList { hosts: Vec<SshHostEntry> },

    #[serde(rename = "hosts.updated", rename_all = "camelCase")]
    HostsUpdated { hosts: Vec<SshHostEntry> },

    /// Pushed to all connections when a hub-managed remote host changes state
    /// (connecting → connected → error → disabled).  Connected-only fields
    /// (`hostname`, `platform`, `isSsh`, `claudeModels`, `codexModels`) are
    /// omitted when the host is not connected.
    #[serde(rename = "host.info", rename_all = "camelCase")]
    HostInfo {
        host_id: String,
        name: String,
        /// `"connecting"` | `"connected"` | `"error"` | `"disabled"`
        state: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        // Connected-only fields:
        #[serde(skip_serializing_if = "Option::is_none")]
        hostname: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        platform: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_ssh: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        claude_models: Option<Vec<ModelEntry>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        codex_models: Option<Vec<ModelEntry>>,
    },
}
