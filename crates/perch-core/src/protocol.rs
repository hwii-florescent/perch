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

use crate::iterm_profile::TerminalProfile;

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
    /// Selected theme name (key into the client's `THEMES` table). Defaults
    /// to `"catppuccin"` — herdr's own default theme (Catppuccin Mocha; see
    /// `reference/herdr/src/app/state.rs::Palette::catppuccin()` and
    /// `AppState`'s default `theme_name`), so perch matches herdr's look out
    /// of the box. `"perch"` (perch's original hardcoded look) remains a
    /// selectable theme, just no longer the default.
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Play a short WebAudio-generated tone when a session finishes a turn
    /// unseen (done) or becomes blocked on an approval prompt (request).
    /// Defaults to `false` (opt-in).
    #[serde(default)]
    pub sound_enabled: bool,
    /// How toast notifications are delivered: `"off"` (none), `"app"`
    /// (in-app toast stack, the original behavior), or `"system"` (OS
    /// notifications via the Web Notifications API, falling back to `"app"`
    /// when permission is denied). Defaults to `"app"`.
    #[serde(default = "default_toast_delivery")]
    pub toast_delivery: String,
    /// Global chat rendering mode: `"hosted"` (structured chat UI) or
    /// `"cli"` (xterm attached to the real interactive CLI PTY). Used to be
    /// per-chat client state (a footer toggle); now a single global setting
    /// so every open chat pane renders the same way. Defaults to `"hosted"`.
    #[serde(default = "default_chat_mode")]
    pub chat_mode: String,
}

fn default_theme() -> String {
    "catppuccin".to_string()
}

fn default_toast_delivery() -> String {
    "app".to_string()
}

fn default_chat_mode() -> String {
    "hosted".to_string()
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
    /// Absent = unchanged; present = set. No "clear" case needed — a theme
    /// name is never nullable, unlike `default_cwd`.
    pub theme: Option<String>,
    /// Absent = unchanged; present = set.
    pub sound_enabled: Option<bool>,
    /// Absent = unchanged; present = set. No "clear" case needed.
    pub toast_delivery: Option<String>,
    /// Absent = unchanged; present = set. No "clear" case needed — a chat
    /// mode is never nullable, unlike `default_cwd`.
    pub chat_mode: Option<String>,
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
    /// `"perch"` (default) or `"direct"`.
    ///
    /// `"perch"` is classic federation: the remote runs its own perch, reached
    /// through an ssh tunnel. `"direct"` requires **only** `claude`/`codex` +
    /// `tmux` on the remote — perch drives the CLIs over ssh with each hosted
    /// turn detached (so it survives both the laptop closing and perch
    /// quitting), and the sessions live in the *local* DB tagged with this
    /// host's id. Absent on the wire ⇒ `"perch"`, so older clients and older
    /// `hosts.json` files keep their exact current behaviour.
    #[serde(default = "default_mode")]
    pub mode: String,
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
            mode: default_mode(),
            direct_url: None,
            remote_cmd: None,
        }
    }
}

fn default_remote_port() -> u16 {
    7788
}
fn default_enabled() -> bool {
    true
}
fn default_mode() -> String {
    "perch".to_string()
}

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
    /// The model this machine's CLI is configured to use by default (e.g.
    /// codex's `model =` in `~/.codex/config.toml`). Lists stay in the
    /// catalogue's own best-first order; clients preselect the flagged entry
    /// (falling back to index 0 when no entry is flagged). At most one entry
    /// per list carries it. Omitted on the wire when false.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub is_default: bool,
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
    /// Whether this session has been archived.  Defaults to `false` when the
    /// field is absent on the wire (older remote perch instances).
    #[serde(default)]
    pub archived: bool,
    /// Whether this session finished a turn while no connected client was
    /// actively viewing it (herdr's `done` state = `Idle && !seen`). Cleared
    /// as soon as any client subscribes/switches to the session. Defaults to
    /// `false` when absent (older remote perch instances).
    #[serde(default)]
    pub unseen: bool,
    /// Whether this session has ever been typed into in CLI mode (the
    /// `cli_activity` column). The web client uses it to decide whether CLI
    /// mode may respawn the agent PTY unattended: a session with prior CLI
    /// activity is resumed automatically, one without it waits for an
    /// explicit "New chat". Defaulted for backward federation-compat with
    /// older remotes.
    #[serde(default)]
    pub cli_started: bool,
    /// Whether the session's agent is blocked on an approval prompt, detected
    /// by scanning recent CLI-attached terminal output for known approval-
    /// prompt patterns (see `blocked_patterns` in `server.rs`). Only
    /// meaningful for sessions with a live CLI-attached terminal; otherwise
    /// always `false`. Defaulted for backward federation-compat with older
    /// remotes.
    #[serde(default)]
    pub blocked: bool,
}

fn default_local_host_id() -> String {
    "local".to_string()
}

/// A single directory entry returned by `fs.browse`. Directories only — the
/// browser is for picking a session's cwd, never individual files.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    /// True when `path/.git` exists (one bounded `Path::exists()` check per
    /// visible entry at the current level — never recursive).
    pub is_git_repo: bool,
}

/// One git worktree of a repo, as reported by `worktree.list.result`.
/// Mirrors `worktree::WorktreeInfo` (see that module for the git plumbing).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeEntry {
    pub path: String,
    /// Short branch name; absent for a detached HEAD.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    /// Commit sha at the worktree's HEAD.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,
    /// The repo's main checkout (never removable — git refuses).
    pub is_primary: bool,
    /// Has uncommitted or untracked files (drives the remove guard).
    pub is_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost_usd: f64,
    pub context_tokens: u64,
}

/// One invocable command/skill offered by an agent CLI in a given cwd, as
/// scraped by `commands.rs` and served in `commands.list`. `name` is bare (no
/// `/` or `$` sigil) — the client prepends whichever sigil the active agent
/// uses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEntry {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
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
        /// Run this turn in *plan mode*: claude gets
        /// `--permission-mode plan` instead of `bypassPermissions`, codex gets
        /// `--sandbox read-only`. Absent ⇒ `false` (the pre-existing
        /// behaviour), so older clients are unaffected.
        #[serde(default)]
        plan_mode: bool,
        /// Reasoning-effort level for this turn. `None` (or `"default"`) omits
        /// the flag entirely and lets the CLI use its own default. claude:
        /// `--effort <level>`; codex: `-c model_reasoning_effort="<level>"`.
        #[serde(default)]
        effort: Option<String>,
        /// Absolute, server-side paths of files staged via `POST {base}upload`
        /// to attach to this turn. Images are passed to codex with `-i`; every
        /// other file (and every file for claude) is named in a trailing
        /// `[Attached files: …]` note appended to the turn text, which the CLI
        /// then reads itself.
        #[serde(default)]
        attachments: Option<Vec<String>>,
    },

    #[serde(rename = "chat.cancel", rename_all = "camelCase")]
    ChatCancel { session_id: String },

    /// Ask the server which slash commands / skills the agent CLIs know about
    /// in this session's cwd, for composer autocomplete. The server probes the
    /// CLIs (cached per host+cwd for a few minutes) and answers with
    /// `commands.list`. Both probes are offline and cost zero tokens — see
    /// `commands.rs`.
    #[serde(rename = "commands.list", rename_all = "camelCase")]
    CommandsList { session_id: String },

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

    /// Force-terminate a single terminal's backing PTY/process. Used when a
    /// CLI-mode (`agentAttach`) terminal is torn down — e.g. leaving CLI mode
    /// for Hosted, or deleting the session it's attached to — so the spawned
    /// `claude --resume`/`codex resume` process doesn't keep running (and
    /// blocking a fresh attach) after the view that owned it is gone.
    #[serde(rename = "terminal.kill", rename_all = "camelCase")]
    TerminalKill { terminal_id: String },

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

    #[serde(rename = "session.archive", rename_all = "camelCase")]
    SessionArchive { session_id: String, archived: bool },

    /// Permanently delete a session: its messages, its DB row, any in-flight
    /// turn, and any CLI-attached terminal. Irreversible — unlike
    /// `session.archive`, there is no `deleted: bool` toggle.
    #[serde(rename = "session.delete", rename_all = "camelCase")]
    SessionDelete { session_id: String },

    /// Request the persisted dockview layout blob for a session (Phase 3:
    /// Workspace → Tab → Pane model). The server never interprets the JSON —
    /// it's an opaque `dockview` `api.toJSON()` snapshot, only persisted and
    /// echoed back.
    #[serde(rename = "session.layout.get", rename_all = "camelCase")]
    SessionLayoutGet { session_id: String },

    /// Persist a session's dockview layout blob. Debounced client-side.
    #[serde(rename = "session.layout.set", rename_all = "camelCase")]
    SessionLayoutSet { session_id: String, layout: Value },

    /// User-set title override for a session (see `db::title_override`).
    /// Persists across the auto-title-from-first-message logic — once set,
    /// the user title always wins.
    #[serde(rename = "session.rename", rename_all = "camelCase")]
    SessionRename { session_id: String, title: String },

    /// List directories at `path` (or the user's home directory when absent)
    /// on the given host (local when absent/`"local"`), for the new-session
    /// cwd picker. `requestId` is echoed back on `fs.browse.result` so the
    /// client can match replies to in-flight requests (also relayed as a
    /// single-shot unicast through the hub for federated hosts).
    #[serde(rename = "fs.browse", rename_all = "camelCase")]
    FsBrowse {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        path: Option<String>,
    },

    /// List every git worktree of the repo containing `repoPath` (Wave 2 —
    /// ported from herdr, see `worktree.rs`). Request-correlated exactly like
    /// `fs.browse`: `requestId` comes back on `worktree.list.result`, and the
    /// hub relays the single reply to the originating connection via
    /// `PendingKey::Worktree`.
    #[serde(rename = "worktree.list", rename_all = "camelCase")]
    WorktreeList {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        repo_path: String,
    },

    /// Create a linked worktree for `branch`. `newBranch` is a hint: when the
    /// branch already exists locally the existing-branch form is used anyway
    /// (herdr's `run_worktree_add_command` behavior). `path` overrides the
    /// default `~/.perch/worktrees/<repo-name>/<branch-slug>` location.
    /// Replies with `worktree.done` or `worktree.error`.
    #[serde(rename = "worktree.create", rename_all = "camelCase")]
    WorktreeCreate {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        repo_path: String,
        branch: String,
        #[serde(default)]
        new_branch: bool,
        #[serde(default)]
        path: Option<String>,
    },

    /// Remove the worktree checked out at `path`. Refused with
    /// `worktree.error { dirty: true }` when the checkout has uncommitted or
    /// untracked files and `force` is false (herdr's dirty guard). `repoPath`
    /// identifies the owning repo (`git -C <repoPath> worktree remove …`).
    #[serde(rename = "worktree.remove", rename_all = "camelCase")]
    WorktreeRemove {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        repo_path: String,
        path: String,
        #[serde(default)]
        force: bool,
    },
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

    /// Broadcast to every connection (mirrors `hosts.updated`'s fan-out via
    /// `hub_events_tx`) when a session is permanently deleted, since the row
    /// backing a normal `session.updated` no longer exists to look up. Client
    /// state removes the session from its local list on receipt regardless
    /// of which tab/connection issued the `session.delete`.
    #[serde(rename = "session.deleted", rename_all = "camelCase")]
    SessionDeleted { session_id: String },

    #[serde(rename = "server.info", rename_all = "camelCase")]
    ServerInfo {
        hostname: String,
        is_ssh: bool,
        platform: String,
        claude_models: Vec<ModelEntry>,
        codex_models: Vec<ModelEntry>,
        /// The user's real terminal appearance — their iTerm2 default
        /// profile's font and full ANSI palette — so CLI-mode panes look like
        /// their terminal instead of like perch's UI theme. Absent when it
        /// couldn't be read; the client then uses xterm's stock defaults,
        /// never perch's palette. See `iterm_profile.rs`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        terminal_profile: Option<TerminalProfile>,
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

    /// A plan produced by a plan-mode claude turn. claude 2.1.x has no
    /// `ExitPlanMode` tool; the plan arrives as an ordinary `Write` tool_use
    /// whose `input.file_path` lands under `.claude/plans/`, and `agent.rs`
    /// lifts its `input.content` into this message (see
    /// `ClaudeStreamParser::plan_content_of`). Codex plan mode (`--sandbox
    /// read-only`) produces no such artifact, so this is claude-only.
    #[serde(rename = "chat.plan", rename_all = "camelCase")]
    ChatPlan { session_id: String, content: String },

    /// Reply to `commands.list` — the slash commands / skills each CLI knows
    /// about in this session's cwd. Either list may be empty (probe failed,
    /// CLI not installed, …); the client just shows fewer suggestions.
    #[serde(rename = "commands.list", rename_all = "camelCase")]
    CommandsList {
        session_id: String,
        claude: Vec<CommandEntry>,
        codex: Vec<CommandEntry>,
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

    /// Reply to `session.layout.get` (and echoed to the requester when
    /// forwarded through the hub for a remote session). `layout` is `None`
    /// when the session has never had a layout saved — the client falls back
    /// to its default single-Chat-panel layout in that case.
    #[serde(rename = "session.layout", rename_all = "camelCase")]
    SessionLayout {
        session_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        layout: Option<Value>,
    },

    /// Git branch + ahead/behind status for a project (host, cwd) pair.
    /// Pushed by the background poll task in `server.rs` whenever the
    /// computed value changes for a local session's cwd, and once to every
    /// newly-connected client per known cwd (cached snapshot). For federated
    /// hosts, the remote perch instance emits this with `hostId: "local"`
    /// from its own point of view; the hub rewrites `hostId` to the
    /// federated host's id before fanning it out (see `hub.rs`).
    #[serde(rename = "workspace.git", rename_all = "camelCase")]
    WorkspaceGit {
        host_id: String,
        cwd: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        branch: Option<String>,
        ahead: u32,
        behind: u32,
    },

    /// Reply to `fs.browse`. `parent` is absent when `path` is already the
    /// filesystem root. `home` is always the resolved home directory for the
    /// target host, so the client can offer a "home" shortcut regardless of
    /// where the current listing is.
    #[serde(rename = "fs.browse.result", rename_all = "camelCase")]
    FsBrowseResult {
        request_id: String,
        host_id: String,
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        parent: Option<String>,
        home: String,
        entries: Vec<FsEntry>,
    },

    /// Reply to `worktree.list`. `repoPath` echoes the request so the client
    /// can key its cache by `${hostId}:${repoPath}`. `defaultRoot` is
    /// `~/.perch/worktrees/<repo-name>` on the *target* host, letting the
    /// create form prefill a sensible custom-path default.
    #[serde(rename = "worktree.list.result", rename_all = "camelCase")]
    WorktreeListResult {
        request_id: String,
        host_id: String,
        repo_path: String,
        default_root: String,
        worktrees: Vec<WorktreeEntry>,
    },

    /// Success reply to `worktree.create` / `worktree.remove`. `path` is the
    /// created checkout (create) or the removed checkout (remove).
    #[serde(rename = "worktree.done", rename_all = "camelCase")]
    WorktreeDone {
        request_id: String,
        host_id: String,
        /// `"create"` | `"remove"`.
        action: String,
        path: String,
    },

    /// Failure reply to any `worktree.*` request. `dirty` is true only when
    /// the operation was refused by the dirty-checkout guard — the client
    /// escalates that into a "force remove?" confirmation rather than showing
    /// it as a hard error (herdr's `force_confirmation` two-step).
    #[serde(rename = "worktree.error", rename_all = "camelCase")]
    WorktreeError {
        request_id: String,
        host_id: String,
        message: String,
        #[serde(default)]
        dirty: bool,
    },
}
