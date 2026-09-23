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
use std::collections::BTreeMap;

use crate::filesystem::{DirectoryEntry, FileMetadata, PreviewKind};
use crate::iterm_profile::TerminalProfile;
use crate::review::{ReviewComment, ReviewPacket};
use crate::source_control::{
    BranchRef, DiffFile, DiffTarget, DiscardMode, GitActionReceipt, GitStatus,
};

/// Version of the additive project/workspace wire contract.  Existing
/// clients can continue using the legacy message families; clients that
/// understand the new families gate them on `server.info.capabilities`.
pub const PROTOCOL_VERSION: u32 = 1;

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
    /// Lines of scrollback each terminal pane retains. Defaults to 10000 —
    /// the value that used to be hardcoded in `xtermSetup.ts`, so an existing
    /// settings file behaves exactly as before. Clamped client-side, because
    /// xterm.js allocates eagerly and a pathological value is a browser OOM,
    /// not a server problem.
    #[serde(default = "default_terminal_scrollback")]
    pub terminal_scrollback: u32,
    /// Spawn plain terminal panes as a **login** shell (`-l`) rather than a
    /// bare interactive one. Off by default: it changes which rc files run,
    /// which can visibly change the user's prompt and PATH. Does not affect
    /// agent-attach (CLI-mode) panes, which spawn the CLI directly.
    #[serde(default)]
    pub terminal_login_shell: bool,
}

fn default_theme() -> String {
    "catppuccin".to_string()
}

fn default_terminal_scrollback() -> u32 {
    10_000
}

fn default_toast_delivery() -> String {
    "app".to_string()
}

fn default_chat_mode() -> String {
    "hosted".to_string()
}

fn default_true() -> bool {
    true
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
    /// Absent = unchanged; present = set. No "clear" case needed.
    pub terminal_scrollback: Option<u32>,
    /// Absent = unchanged; present = set. No "clear" case needed.
    pub terminal_login_shell: Option<bool>,
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
    /// Whether this session has explicitly started a persistent CLI or has
    /// been typed into through the legacy CLI transport (the
    /// `cli_activity` column). The web client uses it to decide whether CLI
    /// mode may respawn the agent PTY unattended: a session with prior CLI
    /// activity is resumed automatically, one without it waits for an
    /// explicit "New chat". Defaulted for backward federation-compat with
    /// older remotes.
    #[serde(default)]
    pub cli_started: bool,
    /// Whether the session's agent is waiting on the human (a permission
    /// prompt or a question), from native CLI events, the OSC title, or as a
    /// last resort an output pattern (see `blocked_patterns` in `server.rs`).
    /// Defaulted for backward federation-compat with older remotes.
    #[serde(default)]
    pub blocked: bool,
    /// Running or blocked, but with no status evidence for 30 minutes: read
    /// it as idle. Display only; the turn is not over, so a later completion
    /// still notifies (see `stale_sessions` in `server/session.rs`).
    /// Defaulted for older remotes.
    #[serde(default)]
    pub stale: bool,
    /// Stable project metadata association, populated after the database
    /// migration. Optional so old remote peers and pre-migration rows remain
    /// readable during rolling upgrades.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    /// Stable workspace metadata association, populated after the database
    /// migration. Optional for federation compatibility with older peers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    /// Last explicitly selected CLI provider, including configured providers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cli_provider_id: Option<String>,
}

/// Durable editor draft returned by the workspace buffer endpoints. Both the
/// draft and its original bounded baseline are server-owned so a reconnect
/// can offer compare/merge after an external change.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBuffer {
    pub workspace_id: String,
    pub path: String,
    pub content: String,
    pub base_content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub updated_at: i64,
}

/// Metadata-only listing form for durable editor tabs. Clients fetch the full
/// bounded content through `fs.buffer.get` when they need to render a tab.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileBufferSummary {
    pub workspace_id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub updated_at: i64,
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

/// Durable project identity. A project is scoped by `host_id` and its
/// canonical `path`; the id is generated once and survives server restarts.
/// `settings` is intentionally opaque in this first slice so later feature
/// work can add project-scoped preferences without another migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub host_id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    pub favorite: bool,
    pub archived: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Lifecycle state accepted on the wire. Keeping this as an enum prevents a
/// malformed DB value from silently becoming a client-only state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceState {
    Active,
    Sleeping,
    Archived,
}

/// Durable workspace identity. The initial implementation creates one
/// workspace for each imported project path. Later worktree/editor slices can
/// add more rows without changing the project identity contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub id: String,
    pub project_id: String,
    pub host_id: String,
    pub path: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_branch: Option<String>,
    pub dirty: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_snapshot: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_workspace_id: Option<String>,
    pub state: WorkspaceState,
    pub created_at: i64,
    pub updated_at: i64,
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

/// One background worktree create (`worktree.job.start`), as broadcast in
/// `worktree.jobs`. A job leaves the list when it succeeds (its workspace
/// arrives as `workspace.updated`) or once a cancel has cleaned up; a failed
/// job stays, with `error`, until it is retried or dismissed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeJob {
    pub job_id: String,
    pub repo_path: String,
    pub branch: String,
    /// Where the checkout is being created.
    pub path: String,
    /// `"running"` | `"cancelling"` | `"failed"`.
    pub status: String,
    /// Human-readable step, e.g. `"Checking out"`.
    pub phase: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub started_at: i64,
}

/// A request-scoped, persisted approval receipt for a destructive Git action.
/// The opaque id is bound by the server to the workspace, operation, canonical
/// paths, current content fingerprint, and expiry; clients must not synthesize
/// or reinterpret it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPreviewReceipt {
    pub preview_id: String,
    pub operation: String,
    pub workspace_id: String,
    pub paths: Vec<String>,
    pub status: GitStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub expires_at: i64,
}

/// One device that has been paired with this host. The token itself is never
/// on the wire or on disk in the clear — only its hash is stored, so this
/// summary is safe to broadcast to any authorized client.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub last_seen_at: i64,
}

/// How much of a recorded turn is actually reviewable. A turn's boundary is
/// two separate writes, so the newest row is often not a finished comparison.
/// `completed = false` alone cannot say why, so the server resolves this
/// against the live runtime before reporting it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentTurnState {
    /// Both endpoints recorded: `beforeRef`..`afterRef` is the turn.
    #[default]
    Complete,
    /// The agent is still working. `afterRef` is absent on purpose — compare
    /// `beforeRef` against the working tree to watch the turn as it lands.
    Running,
    /// The after side will never arrive (a failed capture, or a core restart
    /// mid-turn). There is no comparison here; clients must say so rather
    /// than offer an older turn under this turn's name.
    Unavailable,
}

/// The newest recorded agent turn for a workspace — not necessarily a
/// finished one, see `state`. `beforeRef` / `afterRef` are server-recorded
/// content commits (they include uncommitted and untracked work, so they are
/// not necessarily branch HEADs); a client uses them as a `compare` diff
/// target and must not interpret them otherwise. `beforeRef` is empty exactly
/// when `state` is `unavailable` and even the before side was never recorded.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTurnSummary {
    pub snapshot_id: String,
    pub session_id: String,
    pub agent: String,
    pub before_ref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after_ref: Option<String>,
    pub changed_paths: Vec<String>,
    /// Exact total, independent of the bounded path list. Missing for older
    /// capped records: the list length is only a lower bound in that case.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub changed_path_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
    /// Defaulted so a peer predating this field still parses as a finished
    /// turn, which is the only kind it could have sent.
    #[serde(default)]
    pub state: AgentTurnState,
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

/// Structured Chat/UI versus interactive CLI view.  This wire enum is kept
/// separate from the runtime's internal `agent_fleet::AgentMode` so protocol
/// clients do not need to depend on lifecycle implementation details.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionMode {
    Hosted,
    Cli,
}

/// Scope reported by `session.mode`; `default` means no session/workspace
/// override exists and the device default (or Hosted fallback) won.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionModeScope {
    Session,
    Workspace,
    Device,
    Default,
}

/// Stable identity fields exposed by the lifecycle endpoint.  The runtime
/// keeps the provider continuation opaque; clients only use it to label the
/// same agent and never synthesize one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLifecycleKey {
    pub workspace_id: String,
    pub session_id: String,
    pub agent_id: String,
}

/// A bounded provider descriptor and executable availability result.  The
/// `reason` field explains an unavailable executable without exposing a shell
/// command or environment value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentManifestSummary {
    pub id: String,
    pub display_name: String,
    pub supported_modes: Vec<SessionMode>,
    pub resumability: String,
    pub capabilities: Vec<String>,
    pub status_detection: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launch_command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ui: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiTool {
    pub name: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    pub thinking: String,
    pub tools: Vec<NativeUiTool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiSnapshot {
    pub version: u32,
    pub revision: u64,
    pub pid: u32,
    /// Empty on OpenCode's home view until the native TUI creates a conversation.
    pub provider_session_id: String,
    pub cwd: String,
    pub model: Option<String>,
    pub running: bool,
    /// The turn is paused on a human: a permission prompt or a question.
    /// Implies `running`. Absent from older peers and bridges.
    #[serde(default)]
    pub blocked: bool,
    pub messages: Vec<NativeUiMessage>,
    pub truncated: bool,
}

/// Connection-authenticated ownership token returned by the control endpoint.
/// The server never accepts a client-supplied identity in its place.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentControlLease {
    pub client_id: String,
    pub device_id: String,
    pub generation: u64,
    pub acquired_at_ms: u64,
    pub last_activity_ms: u64,
}

/// Lifecycle status returned for one workspace/session/provider key.  Owner
/// identities are optional because read-only observers need not hold either
/// control channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLifecycleStatus {
    pub key: AgentLifecycleKey,
    pub provider_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_session_id: Option<String>,
    pub resumable: bool,
    pub state: crate::agent_fleet::AgentState,
    pub reason: String,
    pub last_transition_ms: u64,
    pub last_activity_ms: u64,
    pub revision: u64,
    pub transition_sequence: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_owner: Option<AgentControlLease>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resize_owner: Option<AgentControlLease>,
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

    /// Read the effective mode after applying session/workspace/device
    /// precedence.  `device_id` is an opaque client-stable identifier; the
    /// server validates it as a key but authenticates control identities from
    /// the connection itself.
    #[serde(rename = "session.mode.get", rename_all = "camelCase")]
    SessionModeGet {
        request_id: String,
        session_id: String,
        device_id: String,
        #[serde(default)]
        workspace_id: Option<String>,
    },

    /// Set or clear a mode override.  `scope: "device"` changes the supplied
    /// device default; session/workspace scopes require the corresponding id.
    /// Omitting `mode` (or setting `clear_override`) clears the selected
    /// session/workspace override and reveals lower-precedence policy.
    #[serde(rename = "session.mode.set", rename_all = "camelCase")]
    SessionModeSet {
        request_id: String,
        session_id: String,
        device_id: String,
        scope: SessionModeScope,
        #[serde(default)]
        workspace_id: Option<String>,
        #[serde(default)]
        mode: Option<SessionMode>,
        #[serde(default)]
        clear_override: bool,
    },

    #[serde(rename = "chat.send", rename_all = "camelCase")]
    ChatSend {
        session_id: String,
        text: String,
        /// Stable client supplied id used to make prompt insertion and
        /// runner dispatch idempotent across reconnects.
        #[serde(default)]
        operation_id: Option<String>,
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

    /// Persistent shell pane operations. Closing a view only releases its subscription.
    #[serde(rename = "terminal.open", rename_all = "camelCase")]
    TerminalOpen {
        request_id: String,
        session_id: String,
        pane_id: String,
        view_id: String,
        cols: u16,
        rows: u16,
    },
    #[serde(rename = "terminal.list", rename_all = "camelCase")]
    TerminalList {
        request_id: String,
        session_id: String,
    },
    #[serde(rename = "terminal.release", rename_all = "camelCase")]
    TerminalRelease {
        terminal_id: String,
        view_id: String,
    },
    #[serde(rename = "terminal.close", rename_all = "camelCase")]
    TerminalClose {
        request_id: String,
        session_id: String,
        terminal_id: String,
    },

    /// Observe the host-owned provider process. A view release never stops it.
    #[serde(rename = "agent.terminal.open", rename_all = "camelCase")]
    AgentTerminalOpen {
        request_id: String,
        session_id: String,
        provider_id: String,
        view_id: String,
        cols: u16,
        rows: u16,
    },
    #[serde(rename = "agent.terminal.release", rename_all = "camelCase")]
    AgentTerminalRelease {
        session_id: String,
        provider_id: String,
        view_id: String,
    },

    #[serde(rename = "terminal.create", rename_all = "camelCase")]
    TerminalCreate {
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        #[serde(default)]
        agent_attach: Option<AgentAttach>,
    },

    #[serde(rename = "terminal.input", rename_all = "camelCase")]
    TerminalInput {
        terminal_id: String,
        data: String,
        /// Optional generation-bound lease.  Omitted is retained for legacy
        /// unowned terminals; once a shared agent has an owner, omission is
        /// rejected rather than bypassing the lease.
        #[serde(default)]
        generation: Option<u64>,
    },

    #[serde(rename = "terminal.resize", rename_all = "camelCase")]
    TerminalResize {
        terminal_id: String,
        cols: u16,
        rows: u16,
        /// Optional generation-bound resize lease; see `TerminalInput`.
        #[serde(default)]
        generation: Option<u64>,
    },

    /// Return the configured provider manifests and executable availability.
    #[serde(rename = "agent.manifest.list", rename_all = "camelCase")]
    AgentManifestList {
        /// Required for request/reply correlation. `host_id` is omitted for
        /// the local provider registry and selects a configured remote host
        /// when present.
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
    },

    /// Configure the host's launcher. Existing sessions remain attachable.
    #[serde(rename = "agent.provider.configure", rename_all = "camelCase")]
    AgentProviderConfigure {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        provider_id: String,
        #[serde(default)]
        enabled: Option<bool>,
        #[serde(default)]
        is_default: Option<bool>,
    },

    #[serde(rename = "agent.ui.get", rename_all = "camelCase")]
    AgentUiGet {
        request_id: String,
        session_id: String,
        provider_id: String,
    },
    #[serde(rename = "agent.ui.prompt", rename_all = "camelCase")]
    AgentUiPrompt {
        request_id: String,
        session_id: String,
        provider_id: String,
        operation_id: String,
        generation: u64,
        text: String,
    },
    #[serde(rename = "agent.ui.cancel", rename_all = "camelCase")]
    AgentUiCancel {
        request_id: String,
        session_id: String,
        provider_id: String,
        generation: u64,
    },

    /// Read one provider lifecycle snapshot.  When `agent_id` is omitted the
    /// server resolves the session's last provider or returns a typed error.
    #[serde(rename = "agent.lifecycle.get", rename_all = "camelCase")]
    AgentLifecycleGet {
        request_id: String,
        session_id: String,
        #[serde(default)]
        workspace_id: Option<String>,
        #[serde(default)]
        agent_id: Option<String>,
    },

    /// Acquire input or resize authority for a shared local agent terminal.
    /// Client/device identity is derived from the authenticated WS connection.
    #[serde(rename = "agent.control.acquire", rename_all = "camelCase")]
    AgentControlAcquire {
        request_id: String,
        session_id: String,
        #[serde(default)]
        workspace_id: Option<String>,
        agent_id: String,
        channel: crate::agent_fleet::ControlChannel,
    },

    /// Release the exact generation returned by `agent.control.acquire`.
    #[serde(rename = "agent.control.release", rename_all = "camelCase")]
    AgentControlRelease {
        request_id: String,
        session_id: String,
        #[serde(default)]
        workspace_id: Option<String>,
        agent_id: String,
        channel: crate::agent_fleet::ControlChannel,
        generation: u64,
    },

    /// Force-terminate a single terminal's backing PTY/process. Used when a
    /// CLI-mode (`agentAttach`) terminal is torn down — e.g. leaving CLI mode
    /// for Hosted, or deleting the session it's attached to — so the spawned
    /// `claude --resume`/`codex resume` process doesn't keep running (and
    /// blocking a fresh attach) after the view that owned it is gone.
    #[serde(rename = "terminal.kill", rename_all = "camelCase")]
    TerminalKill { terminal_id: String },

    /// Offer a pairing code so another device can claim a token from
    /// `POST {base}pair`. Only an already-authorized client can ask.
    #[serde(rename = "device.pair.start", rename_all = "camelCase")]
    DevicePairStart { request_id: String },

    #[serde(rename = "device.pair.cancel", rename_all = "camelCase")]
    DevicePairCancel { request_id: String },

    #[serde(rename = "device.list", rename_all = "camelCase")]
    DeviceList { request_id: String },

    /// Revoke one paired device. Its token stops working immediately.
    #[serde(rename = "device.revoke", rename_all = "camelCase")]
    DeviceRevoke {
        request_id: String,
        device_id: String,
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

    /// List one lazy level of an already-authorized durable workspace. The
    /// path is always workspace-relative; the server resolves the root from
    /// `workspaceId` and never accepts a caller-supplied filesystem root.
    #[serde(rename = "fs.tree", rename_all = "camelCase")]
    FsTree {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        path: Option<String>,
    },

    /// Read one bounded UTF-8 text file from a durable workspace.
    #[serde(rename = "fs.read", rename_all = "camelCase")]
    FsRead {
        request_id: String,
        workspace_id: String,
        path: String,
    },

    /// Return a bounded, classified preview. Binary/image results contain
    /// metadata only; HTML results carry an explicit sandbox requirement.
    #[serde(rename = "fs.preview", rename_all = "camelCase")]
    FsPreview {
        request_id: String,
        workspace_id: String,
        path: String,
    },

    /// Atomically save bounded text with optimistic version checking. An
    /// omitted version means create-only and never permits clobbering a file.
    #[serde(rename = "fs.write", rename_all = "camelCase")]
    FsWrite {
        request_id: String,
        workspace_id: String,
        path: String,
        content: String,
        #[serde(default)]
        expected_version: Option<String>,
        /// Revision of the durable draft being saved. The server checks this
        /// before writing and reconciles the same revision after publication.
        #[serde(default)]
        expected_buffer_revision: Option<u64>,
    },

    /// List the bounded set of durable editor buffers for a workspace.
    #[serde(rename = "fs.buffer.list", rename_all = "camelCase")]
    FsBufferList {
        request_id: String,
        workspace_id: String,
    },

    /// Fetch one durable editor buffer, creating a clean baseline row when
    /// this is the first open of the path.
    #[serde(rename = "fs.buffer.get", rename_all = "camelCase")]
    FsBufferGet {
        request_id: String,
        workspace_id: String,
        path: String,
    },

    /// Persist a bounded draft with optimistic revision checking. When
    /// supplied, `baseContent` is the original bounded text used for merge
    /// and compare after external changes.
    #[serde(rename = "fs.buffer.set", rename_all = "camelCase")]
    FsBufferSet {
        request_id: String,
        workspace_id: String,
        path: String,
        content: String,
        #[serde(default)]
        base_content: Option<String>,
        #[serde(default)]
        expected_buffer_revision: Option<u64>,
    },

    /// Close a durable editor buffer. Dirty/conflicted drafts require an
    /// explicit discard flag and the current buffer revision.
    #[serde(rename = "fs.buffer.close", rename_all = "camelCase")]
    FsBufferClose {
        request_id: String,
        workspace_id: String,
        path: String,
        #[serde(default)]
        expected_buffer_revision: Option<u64>,
        #[serde(default)]
        discard: bool,
    },

    /// Request the complete Git status for an already-authorized workspace.
    /// `hostId` is present for federated routing; the owning host resolves the
    /// workspace root and never accepts a caller-supplied filesystem path.
    #[serde(rename = "git.status", rename_all = "camelCase")]
    GitStatus {
        request_id: String,
        workspace_id: String,
        /// Restrict lastAgentTurn to this session within the workspace.
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        include_ignored: bool,
    },

    /// List local and remote refs that are valid bases for `git.diff` and
    /// review anchoring. Ref names are returned by the owning workspace.
    #[serde(rename = "git.refs", rename_all = "camelCase")]
    GitRefs {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
    },

    /// Compare one workspace against a selected Git base. Compare targets are
    /// tagged objects (`{"kind":"compare","base":"main"}`) so a branch
    /// name can never be confused with a mode keyword.
    #[serde(rename = "git.diff", rename_all = "camelCase")]
    GitDiff {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        target: DiffTarget,
        #[serde(default = "default_true")]
        include_untracked: bool,
        #[serde(default)]
        ignore_whitespace: bool,
        #[serde(default)]
        context_lines: Option<u32>,
        #[serde(default)]
        path: Option<String>,
    },

    /// Stage exact authorized paths or one validated patch. Exactly one of
    /// `paths` and `patch` must be supplied.
    #[serde(rename = "git.stage", rename_all = "camelCase")]
    GitStage {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        paths: Option<Vec<String>>,
        #[serde(default)]
        patch: Option<String>,
    },

    #[serde(rename = "git.unstage", rename_all = "camelCase")]
    GitUnstage {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        paths: Option<Vec<String>>,
        #[serde(default)]
        patch: Option<String>,
    },

    /// Capture a durable, path-bound confirmation receipt before discard.
    #[serde(rename = "git.discard.preview", rename_all = "camelCase")]
    GitDiscardPreview {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        mode: DiscardMode,
        paths: Vec<String>,
    },

    /// Execute a previously previewed discard. The server looks up and
    /// invalidates the receipt atomically after rechecking its fingerprint.
    #[serde(rename = "git.discard", rename_all = "camelCase")]
    GitDiscard {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        preview_id: String,
    },

    #[serde(rename = "git.commit.preview", rename_all = "camelCase")]
    GitCommitPreview {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        message: String,
    },

    #[serde(rename = "git.commit", rename_all = "camelCase")]
    GitCommit {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        preview_id: String,
        message: String,
    },

    /// Durable inline review comment lifecycle. The server reads the
    /// authorized file/diff at `baseRevision` and derives the stored anchor.
    #[serde(rename = "review.list", rename_all = "camelCase")]
    ReviewList {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
    },

    #[serde(rename = "review.create", rename_all = "camelCase")]
    ReviewCreate {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        id: String,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        agent_id: Option<String>,
        path: String,
        /// Diff/file base selector used to derive the anchor source. The
        /// server re-reads this target and rejects a stale `baseRevision`.
        base: DiffTarget,
        base_revision: String,
        side: crate::review::ReviewSide,
        range: crate::review::LineRange,
        body: String,
    },

    #[serde(rename = "review.update", rename_all = "camelCase")]
    ReviewUpdate {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        comment_id: String,
        body: String,
        expected_version: u64,
    },

    #[serde(rename = "review.resolve", rename_all = "camelCase")]
    ReviewResolve {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        comment_id: String,
        resolved: bool,
        expected_version: u64,
    },

    #[serde(rename = "review.delete", rename_all = "camelCase")]
    ReviewDelete {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        comment_id: String,
        expected_version: u64,
    },

    #[serde(rename = "review.batch.preview", rename_all = "camelCase")]
    ReviewBatchPreview {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        send_operation_id: String,
        #[serde(default)]
        target_session_id: Option<String>,
        #[serde(default)]
        target_agent_id: Option<String>,
        /// Revision of the source snapshot shown to the user. Older clients
        /// may omit it; the server then rejects the preview unless it can
        /// derive an exact revision from the selected comments.
        #[serde(default)]
        current_revision: String,
        #[serde(default)]
        instruction: String,
    },

    #[serde(rename = "review.batch.send", rename_all = "camelCase")]
    ReviewBatchSend {
        request_id: String,
        workspace_id: String,
        #[serde(default)]
        host_id: Option<String>,
        packet_id: String,
        send_operation_id: String,
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
    ///
    /// Capability `worktree.startFrom` adds: an empty `branch` derived from
    /// `name` (the task name, suffixed `-2`… on conflict), and `startFrom`,
    /// the new branch's start point (local branch, `remote/branch` — fetched
    /// first — or commit; absent = the repo's base ref).
    #[serde(rename = "worktree.create", rename_all = "camelCase")]
    WorktreeCreate {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        repo_path: String,
        #[serde(default)]
        branch: String,
        #[serde(default)]
        new_branch: bool,
        #[serde(default)]
        path: Option<String>,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        start_from: Option<String>,
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

    /// Start a background create (capability `worktree.job`, local host
    /// only). Same inputs as `worktree.create`; replies at once with
    /// `worktree.job.started` or `worktree.error`, then progress arrives as
    /// `worktree.jobs` broadcasts.
    #[serde(rename = "worktree.job.start", rename_all = "camelCase")]
    WorktreeJobStart {
        request_id: String,
        repo_path: String,
        #[serde(default)]
        branch: String,
        #[serde(default)]
        new_branch: bool,
        #[serde(default)]
        path: Option<String>,
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        start_from: Option<String>,
    },

    /// Cancel a running job: git is killed and anything the job created (the
    /// checkout, its admin entry, a new branch) is removed.
    #[serde(rename = "worktree.job.cancel", rename_all = "camelCase")]
    WorktreeJobCancel { job_id: String },

    /// Re-run a failed job with the same inputs.
    #[serde(rename = "worktree.job.retry", rename_all = "camelCase")]
    WorktreeJobRetry { job_id: String },

    /// Drop a failed job from the list.
    #[serde(rename = "worktree.job.dismiss", rename_all = "camelCase")]
    WorktreeJobDismiss { job_id: String },

    /// List durable projects on one host.  The request id is echoed by the
    /// response so concurrent sidebar refreshes cannot race each other.
    #[serde(rename = "project.list", rename_all = "camelCase")]
    ProjectList {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        include_archived: bool,
    },

    /// Create (or idempotently look up) a project for a canonical local path.
    #[serde(rename = "project.create", rename_all = "camelCase")]
    ProjectCreate {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        path: String,
        #[serde(default)]
        name: Option<String>,
    },

    #[serde(rename = "project.rename", rename_all = "camelCase")]
    ProjectRename {
        request_id: String,
        project_id: String,
        name: String,
    },

    #[serde(rename = "project.archive", rename_all = "camelCase")]
    ProjectArchive {
        request_id: String,
        project_id: String,
        archived: bool,
    },

    #[serde(rename = "project.focus", rename_all = "camelCase")]
    ProjectFocus {
        request_id: String,
        project_id: String,
    },

    /// Return a coherent projects/workspaces/active selection snapshot.  A
    /// boot epoch plus revision lets a reconnecting client discard stale
    /// frames from a previous process lifetime.
    #[serde(rename = "workspace.snapshot", rename_all = "camelCase")]
    WorkspaceSnapshot {
        request_id: String,
        #[serde(default)]
        host_id: Option<String>,
        #[serde(default)]
        project_id: Option<String>,
    },

    #[serde(rename = "workspace.focus", rename_all = "camelCase")]
    WorkspaceFocus {
        request_id: String,
        workspace_id: String,
    },

    #[serde(rename = "workspace.rename", rename_all = "camelCase")]
    WorkspaceRename {
        request_id: String,
        workspace_id: String,
        name: String,
    },

    /// Restore a sleeping workspace's metadata state. This first slice does
    /// not advertise sleep itself and never starts an agent as a side effect.
    #[serde(rename = "workspace.restore", rename_all = "camelCase")]
    WorkspaceRestore {
        request_id: String,
        workspace_id: String,
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

    /// Effective session mode after session/workspace/device precedence.
    #[serde(rename = "session.mode", rename_all = "camelCase")]
    SessionMode {
        request_id: String,
        session_id: String,
        device_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        workspace_id: Option<String>,
        mode: SessionMode,
        scope: SessionModeScope,
        revision: u64,
    },

    /// Broadcast when a mode policy changes. It carries no effective mode:
    /// each connected client must refetch for its own device and precedence
    /// chain instead of applying another client's result.
    #[serde(rename = "session.mode.invalidated", rename_all = "camelCase")]
    SessionModeInvalidated {
        session_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        workspace_id: Option<String>,
        /// Set only for a device-default mutation; `None` means all devices.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        device_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        host_id: Option<String>,
        /// Monotonic persisted policy revision at the time of the mutation.
        revision: u64,
    },

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
        /// Additive protocol version and capability discovery. New clients
        /// must gate project/workspace calls on these fields.
        #[serde(default)]
        protocol_version: u32,
        #[serde(default)]
        capabilities: Vec<String>,
        #[serde(default)]
        snapshot_epoch: String,
        #[serde(default)]
        snapshot_revision: u64,
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

    /// Provider manifests plus best-effort executable availability.  The
    /// response is additive and safe for older federation peers to ignore.
    #[serde(rename = "agent.manifest.list", rename_all = "camelCase")]
    AgentManifestList {
        request_id: String,
        /// The authenticated origin host. Hub responses always stamp this
        /// field; local responses use `"local"`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        host_id: Option<String>,
        manifests: Vec<AgentManifestSummary>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        revision: Option<u64>,
    },

    #[serde(rename = "agent.ui.snapshot", rename_all = "camelCase")]
    AgentUiSnapshot {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        session_id: String,
        provider_id: String,
        snapshot: NativeUiSnapshot,
    },
    #[serde(rename = "agent.ui.result", rename_all = "camelCase")]
    AgentUiResult {
        request_id: String,
        session_id: String,
        accepted: bool,
    },

    #[serde(rename = "agent.lifecycle", rename_all = "camelCase")]
    AgentLifecycle {
        request_id: String,
        status: AgentLifecycleStatus,
    },

    #[serde(rename = "agent.lifecycle.changed", rename_all = "camelCase")]
    AgentLifecycleChanged {
        host_id: String,
        status: AgentLifecycleStatus,
    },

    #[serde(rename = "agent.control", rename_all = "camelCase")]
    AgentControl {
        request_id: String,
        session_id: String,
        agent_id: String,
        channel: crate::agent_fleet::ControlChannel,
        #[serde(skip_serializing_if = "Option::is_none")]
        lease: Option<AgentControlLease>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        status: Option<AgentLifecycleStatus>,
    },

    #[serde(rename = "agent.terminal.opened", rename_all = "camelCase")]
    AgentTerminalOpened {
        request_id: String,
        terminal_id: String,
        status: AgentLifecycleStatus,
        replay: String,
    },

    #[serde(rename = "terminal.opened", rename_all = "camelCase")]
    TerminalOpened {
        request_id: String,
        terminal: crate::workspace_terminals::WorkspaceTerminal,
        replay: String,
    },
    #[serde(rename = "terminal.list.result", rename_all = "camelCase")]
    TerminalListResult {
        request_id: String,
        session_id: String,
        terminals: Vec<crate::workspace_terminals::WorkspaceTerminal>,
    },
    #[serde(rename = "terminal.closed", rename_all = "camelCase")]
    TerminalClosed {
        request_id: String,
        session_id: String,
        terminal_id: String,
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

    #[serde(rename = "error", rename_all = "camelCase")]
    Error {
        message: String,
        #[serde(default, skip_serializing_if = "Option::is_none", alias = "request_id")]
        request_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        code: Option<String>,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        retryable: bool,
    },

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

    /// A live pairing code and how long it has left. Shown to the user, typed
    /// into the device being paired; never persisted.
    #[serde(rename = "device.pair.code", rename_all = "camelCase")]
    DevicePairCode {
        request_id: String,
        code: String,
        expires_in_ms: i64,
    },

    #[serde(rename = "device.list.result", rename_all = "camelCase")]
    DeviceListResult {
        request_id: String,
        devices: Vec<DeviceSummary>,
    },

    /// Request-correlated Git status for a durable workspace. The workspace
    /// root is server-owned and is included only inside the status snapshot
    /// for display/debugging; clients never supply it.
    #[serde(rename = "git.status.result", rename_all = "camelCase")]
    GitStatusResult {
        request_id: String,
        workspace_id: String,
        status: GitStatus,
        /// The newest recorded agent turn in this workspace (restricted to
        /// the requested session when supplied), so the review
        /// surface can offer its boundary as a diff base without a second
        /// request family. **Always serialized**, including as `null`: a
        /// client caches this between statuses, and only an explicit `null`
        /// can tell it the server no longer has a turn to offer.
        last_agent_turn: Option<AgentTurnSummary>,
    },

    /// Branch refs available for selecting a diff/review base.
    #[serde(rename = "git.refs.result", rename_all = "camelCase")]
    GitRefsResult {
        request_id: String,
        workspace_id: String,
        refs: Vec<BranchRef>,
    },

    /// Request-correlated bounded diff. Every path and line number comes from
    /// the server-owned Git target selected by the request.
    #[serde(rename = "git.diff.result", rename_all = "camelCase")]
    GitDiffResult {
        request_id: String,
        workspace_id: String,
        target: DiffTarget,
        files: Vec<DiffFile>,
        hunk_count: usize,
        truncated: bool,
        /// Content revisions for the exact path/side sources represented by
        /// this diff. Keys are `<path>:old` / `<path>:new`; the scalar is an
        /// aggregate snapshot revision for batch review operations.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        source_revision: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        source_revisions: Option<BTreeMap<String, String>>,
    },

    /// Result of a non-destructive stage/unstage action or a confirmed
    /// destructive action.
    #[serde(rename = "git.action.result", rename_all = "camelCase")]
    GitActionResult {
        request_id: String,
        workspace_id: String,
        receipt: GitActionReceipt,
    },

    /// Durable preview receipt. The opaque `previewId` is persisted and is
    /// the only valid authorization for the corresponding destructive call.
    #[serde(rename = "git.preview.result", rename_all = "camelCase")]
    GitPreviewResult {
        request_id: String,
        preview: GitPreviewReceipt,
    },

    #[serde(rename = "review.list.result", rename_all = "camelCase")]
    ReviewListResult {
        request_id: String,
        workspace_id: String,
        comments: Vec<ReviewComment>,
    },

    #[serde(rename = "review.comment.result", rename_all = "camelCase")]
    ReviewCommentResult {
        request_id: String,
        workspace_id: String,
        comment: ReviewComment,
    },

    #[serde(rename = "review.delete.result", rename_all = "camelCase")]
    ReviewDeleteResult {
        request_id: String,
        workspace_id: String,
        comment_id: String,
        deleted: bool,
    },

    #[serde(rename = "review.batch.preview.result", rename_all = "camelCase")]
    ReviewBatchPreviewResult {
        request_id: String,
        packet: ReviewPacket,
    },

    /// Delivery is explicit: `queued`, `claimed`, `delivered`, or
    /// `unconfirmed`. An unconfirmed operation retains its packet and must
    /// never be silently retried because the provider may already have it.
    #[serde(rename = "review.batch.send.result", rename_all = "camelCase")]
    ReviewBatchSendResult {
        request_id: String,
        workspace_id: String,
        packet_id: String,
        send_operation_id: String,
        delivery: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        target_session_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        target_agent_id: Option<String>,
    },

    /// Provider acceptance updates the visible outbox without another send.
    #[serde(rename = "review.batch.delivery", rename_all = "camelCase")]
    ReviewBatchDelivery {
        workspace_id: String,
        packet_id: String,
        send_operation_id: String,
        delivery: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        host_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target_session_id: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        target_agent_id: Option<String>,
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

    /// Reply to `fs.tree` with one bounded directory level.
    #[serde(rename = "fs.tree.result", rename_all = "camelCase")]
    FsTreeResult {
        request_id: String,
        workspace_id: String,
        path: String,
        entries: Vec<DirectoryEntry>,
        truncated: bool,
    },

    /// Reply to `fs.read` with bounded text and its exact content version.
    #[serde(rename = "fs.read.result", rename_all = "camelCase")]
    FsReadResult {
        request_id: String,
        workspace_id: String,
        metadata: FileMetadata,
        content: String,
        version: String,
    },

    /// Reply to `fs.preview` with bounded safe-format content or metadata-only
    /// information for binary/unsupported content.
    #[serde(rename = "fs.preview.result", rename_all = "camelCase")]
    FsPreviewResult {
        request_id: String,
        workspace_id: String,
        metadata: FileMetadata,
        #[serde(skip_serializing_if = "Option::is_none")]
        version: Option<String>,
        kind: PreviewKind,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        media_type: Option<String>,
        requires_sandbox: bool,
        truncated: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },

    /// Reply to `fs.write` after the durable atomic publication.
    #[serde(rename = "fs.write.result", rename_all = "camelCase")]
    FsWriteResult {
        request_id: String,
        workspace_id: String,
        metadata: FileMetadata,
        bytes_written: usize,
        version: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        buffer_revision: Option<u64>,
    },

    /// Bounded durable-buffer listing. The content itself is fetched only by
    /// `fs.buffer.get` so reconnects do not eagerly load every open tab.
    #[serde(rename = "fs.buffer.list.result", rename_all = "camelCase")]
    FsBufferListResult {
        request_id: String,
        workspace_id: String,
        buffers: Vec<FileBufferSummary>,
        truncated: bool,
    },

    /// Full bounded durable draft returned by `fs.buffer.get` or `.set`.
    #[serde(rename = "fs.buffer.result", rename_all = "camelCase")]
    FsBufferResult {
        request_id: String,
        workspace_id: String,
        buffer: FileBuffer,
    },

    /// A durable buffer row was removed after an explicit close/discard.
    #[serde(rename = "fs.buffer.close.result", rename_all = "camelCase")]
    FsBufferCloseResult {
        request_id: String,
        workspace_id: String,
        path: String,
        removed: bool,
    },

    /// Invalidation emitted after an external or server-owned filesystem
    /// change. Dirty buffers remain durable and are fetched through
    /// `fs.buffer.get` to expose their conflict/base content.
    #[serde(rename = "fs.changed", rename_all = "camelCase")]
    FsChanged {
        workspace_id: String,
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        version: Option<String>,
        kind: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        metadata: Option<FileMetadata>,
        #[serde(skip_serializing_if = "Option::is_none")]
        buffer_revision: Option<u64>,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        conflict: bool,
    },

    /// Structured filesystem failure. Conflicts include both versions and
    /// current metadata so the client can offer reload/compare/explicit
    /// overwrite without opening an unbounded file.
    #[serde(rename = "fs.error", rename_all = "camelCase")]
    FsError {
        request_id: String,
        workspace_id: String,
        code: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        path: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        metadata: Option<FileMetadata>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expected_version: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        actual_version: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        current: Option<FileMetadata>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expected_buffer_revision: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        actual_buffer_revision: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        current_buffer: Option<Box<FileBuffer>>,
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
        /// The repo's base ref (`origin/main`), when `origin/HEAD` is set —
        /// the start-from picker's default.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        base_ref: Option<String>,
        /// Local and remote branch names (`main`, `origin/feature`) for the
        /// start-from picker.
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        refs: Vec<String>,
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
        /// Durable workspace created for a linked checkout. Older peers may
        /// omit this field; remove operations can still use the path-only
        /// form.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        workspace: Option<WorkspaceSummary>,
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

    /// Reply to `worktree.job.start`: the job was accepted.
    #[serde(rename = "worktree.job.started", rename_all = "camelCase")]
    WorktreeJobStarted {
        request_id: String,
        job: WorktreeJob,
    },

    /// Every background worktree job on this host. Sent on connect and after
    /// every change; the list replaces the previous one.
    #[serde(rename = "worktree.jobs", rename_all = "camelCase")]
    WorktreeJobs { jobs: Vec<WorktreeJob> },

    #[serde(rename = "project.list", rename_all = "camelCase")]
    ProjectList {
        request_id: String,
        host_id: String,
        snapshot_epoch: String,
        snapshot_revision: u64,
        projects: Vec<ProjectSummary>,
    },

    #[serde(rename = "project.updated", rename_all = "camelCase")]
    ProjectUpdated {
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        project: ProjectSummary,
        snapshot_epoch: String,
        snapshot_revision: u64,
    },

    #[serde(rename = "project.deleted", rename_all = "camelCase")]
    ProjectDeleted {
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        project_id: String,
        host_id: String,
        snapshot_epoch: String,
        snapshot_revision: u64,
    },

    #[serde(rename = "workspace.snapshot", rename_all = "camelCase")]
    WorkspaceSnapshot {
        request_id: String,
        host_id: String,
        snapshot_epoch: String,
        snapshot_revision: u64,
        projects: Vec<ProjectSummary>,
        workspaces: Vec<WorkspaceSummary>,
        #[serde(skip_serializing_if = "Option::is_none")]
        active_project_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        active_workspace_id: Option<String>,
    },

    #[serde(rename = "workspace.updated", rename_all = "camelCase")]
    WorkspaceUpdated {
        #[serde(skip_serializing_if = "Option::is_none")]
        request_id: Option<String>,
        workspace: WorkspaceSummary,
        snapshot_epoch: String,
        snapshot_revision: u64,
    },

    #[serde(rename = "workspace.focus", rename_all = "camelCase")]
    WorkspaceFocus {
        request_id: String,
        host_id: String,
        snapshot_epoch: String,
        snapshot_revision: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        active_project_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        active_workspace_id: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_request_id_uses_wire_camel_case() {
        let value = serde_json::to_value(ServerMessage::Error {
            message: "conflict".to_string(),
            request_id: Some("req-1".to_string()),
            code: Some("conflict".to_string()),
            retryable: false,
        })
        .expect("error serializes");
        assert_eq!(value.get("type").and_then(Value::as_str), Some("error"));
        assert_eq!(
            value.get("requestId").and_then(Value::as_str),
            Some("req-1")
        );
        assert!(value.get("request_id").is_none());

        let legacy: ServerMessage = serde_json::from_value(serde_json::json!({
            "type": "error",
            "message": "legacy",
            "request_id": "old-req"
        }))
        .expect("legacy snake_case error still deserializes");
        match legacy {
            ServerMessage::Error { request_id, .. } => {
                assert_eq!(request_id.as_deref(), Some("old-req"));
            }
            other => panic!("expected error, got {other:?}"),
        }
    }

    #[test]
    fn filesystem_wire_variants_use_camel_case_request_fields() {
        let value = serde_json::to_value(ServerMessage::FsError {
            request_id: "req-2".to_string(),
            workspace_id: "ws-1".to_string(),
            code: "conflict".to_string(),
            message: "changed".to_string(),
            path: Some("src/main.rs".to_string()),
            metadata: None,
            expected_version: Some("old".to_string()),
            actual_version: Some("new".to_string()),
            current: None,
            expected_buffer_revision: None,
            actual_buffer_revision: None,
            current_buffer: None,
        })
        .expect("filesystem error serializes");
        assert_eq!(value.get("type").and_then(Value::as_str), Some("fs.error"));
        assert_eq!(
            value.get("requestId").and_then(Value::as_str),
            Some("req-2")
        );
        assert_eq!(
            value.get("workspaceId").and_then(Value::as_str),
            Some("ws-1")
        );
        assert_eq!(
            value.get("expectedVersion").and_then(Value::as_str),
            Some("old")
        );
        assert!(value.get("request_id").is_none());
        assert!(value.get("workspace_id").is_none());
    }

    #[test]
    fn durable_buffer_wire_uses_camel_case_and_preserves_base_content() {
        let request: ClientMessage = serde_json::from_value(serde_json::json!({
            "type": "fs.buffer.set",
            "requestId": "req-buffer",
            "workspaceId": "ws-1",
            "path": "src/main.rs",
            "content": "draft",
            "baseContent": "base",
            "expectedBufferRevision": 7
        }))
        .expect("buffer request deserializes");
        match request {
            ClientMessage::FsBufferSet {
                request_id,
                workspace_id,
                base_content,
                expected_buffer_revision,
                ..
            } => {
                assert_eq!(request_id, "req-buffer");
                assert_eq!(workspace_id, "ws-1");
                assert_eq!(base_content.as_deref(), Some("base"));
                assert_eq!(expected_buffer_revision, Some(7));
            }
            other => panic!("expected fs.buffer.set, got {other:?}"),
        }

        let response = serde_json::to_value(ServerMessage::FsBufferResult {
            request_id: "req-buffer".to_string(),
            workspace_id: "ws-1".to_string(),
            buffer: FileBuffer {
                workspace_id: "ws-1".to_string(),
                path: "src/main.rs".to_string(),
                content: "draft".to_string(),
                base_content: "base".to_string(),
                base_version: Some("base-hash".to_string()),
                external_version: Some("disk-hash".to_string()),
                revision: 7,
                dirty: true,
                conflict: true,
                updated_at: 123,
            },
        })
        .expect("buffer response serializes");
        assert_eq!(response["type"], "fs.buffer.result");
        assert_eq!(response["buffer"]["baseContent"], "base");
        assert_eq!(response["buffer"]["revision"], 7);
        assert!(response["buffer"].get("base_content").is_none());
    }
}
