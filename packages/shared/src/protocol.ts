/**
 * Wire protocol between the perch server and its clients (web/desktop).
 *
 * This file is a frozen contract: the web client depends on these exact
 * shapes. Every message carries a `type` discriminant so both unions can be
 * narrowed with a simple `switch (msg.type)`.
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** A single model entry from the server's discovered model list.
 * Clients must use these server-provided lists rather than any hardcoded
 * catalogue — different machines expose different model sets. */
export interface ModelEntry {
  id: string;
  label: string;
  /** The model this machine's CLI is configured to use by default (e.g.
   * codex's `model =` in config.toml). Lists stay in the catalogue's own
   * best-first order — clients preselect the flagged entry rather than
   * reordering; at most one entry per list carries it. Omitted when false. */
  isDefault?: boolean;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  contextTokens: number;
}

/** One invocable command/skill offered by an agent CLI in a given cwd, as
 * scraped by `commands.rs` and served in `commands.list`. `name` is bare (no
 * `/` or `$` sigil) — the client prepends whichever sigil the active agent
 * uses. Mirrors `CommandEntry` in `crates/perch-core/src/protocol.rs`. */
export interface CommandEntry {
  name: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Stage D: Settings & SSH hosts value types
// ---------------------------------------------------------------------------

export interface CustomModelsData {
  claude: ModelEntry[];
  codex: ModelEntry[];
}

export interface SettingsData {
  customModels: CustomModelsData;
  /** `null` means no default set (use process cwd). */
  defaultCwd: string | null;
  /** Selected theme name (key into the client's `THEMES` table).
   * Defaults to `"catppuccin"` — herdr's own default theme. `"perch"`
   * (perch's original hardcoded look) remains a selectable theme. */
  theme: string;
  /** Play a short WebAudio-generated tone when a session finishes a turn
   * unseen (done) or becomes blocked on an approval prompt (request).
   * Defaults to `false` (opt-in). */
  soundEnabled: boolean;
  /** How toast notifications are delivered: `"off"` (none), `"app"` (in-app
   * toast stack, the original behavior), or `"system"` (OS notifications via
   * the Web Notifications API, falling back to `"app"` when permission is
   * denied). Defaults to `"app"`. */
  toastDelivery: "off" | "app" | "system";
  /** Global chat rendering mode: `"hosted"` (structured chat UI) or `"cli"`
   * (xterm attached to the real interactive CLI PTY). Used to be per-chat
   * client state (a footer toggle in the chat pane); now a single global
   * setting controlled from Settings, applying to every open chat pane.
   * Defaults to `"hosted"`. */
  chatMode: "hosted" | "cli";
}

/**
 * Patch for `settings.update`. Absent fields = no change.
 * - `customModels` absent → unchanged; present → replace whole struct.
 * - `defaultCwd` absent → unchanged; `null` → clear; string → set.
 * - `theme` absent → unchanged; string → set (no "clear" case).
 * - `soundEnabled` absent → unchanged; boolean → set.
 * - `toastDelivery` absent → unchanged; string → set.
 * - `chatMode` absent → unchanged; string → set (no "clear" case).
 */
export interface SettingsPatch {
  customModels?: CustomModelsData;
  defaultCwd?: string | null;
  theme?: string;
  soundEnabled?: boolean;
  toastDelivery?: "off" | "app" | "system";
  chatMode?: "hosted" | "cli";
}

export type HostMode = "perch" | "direct";

export interface SshHostEntry {
  id: string;
  name: string;
  sshHost: string;
  /** Defaults to 7788 when omitted. */
  remotePort: number;
  /** Defaults to true when omitted. */
  enabled: boolean;
  /**
   * How perch talks to this host. Defaults to `"perch"` when omitted, so
   * every pre-existing host entry keeps its exact current behaviour.
   *
   * - `"perch"` — classic federation: the remote runs its own perch instance,
   *   reached through an SSH tunnel; its sessions live in *its* database.
   * - `"direct"` — the remote has no perch at all, only `claude`/`codex` +
   *   `tmux`. perch drives the CLIs over SSH and runs every hosted turn
   *   detached, so work survives closing the laptop *and* quitting perch;
   *   the sessions live in the *local* database, tagged with this host's id.
   */
  mode: HostMode;
  /** If set, skip SSH tunnelling and connect directly to this WebSocket URL
   * (e.g. "ws://127.0.0.1:7800/ws").  Useful for LAN peers and e2e tests. */
  directUrl?: string;
  /** Shell command to auto-start the remote perch instance over SSH when it
   * is not already running.  The placeholder `{port}` is substituted with
   * the remote port.  Defaults to `~/perch/target/debug/perch-core --port {port}`. */
  remoteCmd?: string;
}

// ---------------------------------------------------------------------------
// Stage F: Hub federation value types
// ---------------------------------------------------------------------------

/** Live connection state for a remote host managed by the hub. */
export type HostConnectionState = "connecting" | "connected" | "error" | "disabled";

/** Pushed by the server once per known host after `server.info` on connect,
 * and again on every state change.  The `hostname`, `platform`, `isSsh`,
 * `claudeModels`, and `codexModels` fields are only present when the host
 * is in the `connected` state. */
export interface HostInfoMessage {
  type: "host.info";
  hostId: string;
  name: string;
  state: HostConnectionState;
  error?: string;
  hostname?: string;
  platform?: string;
  isSsh?: boolean;
  claudeModels?: ModelEntry[];
  codexModels?: ModelEntry[];
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface SessionCreateMessage {
  type: "session.create";
  cwd?: string;
  /** If set to a non-"local" host id, create the session on that remote host.
   * Omit or set to "local" for the local instance. */
  hostId?: string;
}

export interface SessionSubscribeMessage {
  type: "session.subscribe";
  sessionId: string;
}

/** Resume a previously-known session (e.g. from `localStorage`) after a page
 * reload or PWA reopen. The server replies with `session.created` (echoing
 * the same id) followed by `session.history` if the session still exists in
 * the database, or `session.created` with a brand-new id if it doesn't. */
export interface SessionResumeMessage {
  type: "session.resume";
  sessionId: string;
}

/** Which backend a `chat.send` should be routed to. Defaults to "claude". */
export type AgentKind = "claude" | "codex";

// ---------------------------------------------------------------------------
// Session list / host info value types
// ---------------------------------------------------------------------------

export type SessionStatus = "running" | "idle";

export interface SessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  /** Omitted when no agent has been used in this session yet. */
  lastAgent?: AgentKind;
  /** Omitted when no model has been recorded for this session yet. */
  lastModel?: string;
  status: SessionStatus;
  /** Which hub host owns this session.  "local" (or absent) means the
   * session lives on the directly-connected server instance. */
  hostId?: string;
  /** Whether this session has been archived.  Defaults to false when absent. */
  archived?: boolean;
  /** Whether this session finished a turn while no connected client was
   * actively viewing it (herdr's `done` state = `Idle && !seen`). Cleared as
   * soon as any client subscribes/switches to the session. Defaults to false
   * when absent. */
  unseen?: boolean;
  /** Whether this session has ever been typed into in CLI mode (the server's
   * `cli_activity` flag). CLI mode uses it to decide whether to respawn the
   * agent PTY on its own: a session with prior CLI activity is resumed
   * automatically, while one without it waits for the user to pick a project
   * and press "New chat" rather than silently launching an agent. Defaults to
   * false when absent. */
  cliStarted?: boolean;
  /** Whether the session's agent is blocked on an approval prompt, detected
   * by scanning recent CLI-attached terminal output for known approval-
   * prompt patterns. Only meaningful for sessions with a live CLI-attached
   * terminal; otherwise always false. Defaults to false when absent. */
  blocked?: boolean;
}

/** A single directory entry returned by `fs.browse`. Directories only — the
 * browser is for picking a session's cwd, never individual files. */
export interface FsEntry {
  name: string;
  path: string;
  /** True when `path/.git` exists (one bounded check per visible entry at
   * the current level — never recursive). */
  isGitRepo: boolean;
}

/** One git worktree of a repo, as reported by `worktree.list.result`.
 * Mirrors `WorktreeEntry` in `crates/perch-core/src/protocol.rs`. */
export interface WorktreeEntry {
  path: string;
  /** Short branch name; absent for a detached HEAD. */
  branch?: string;
  /** Commit sha at the worktree's HEAD. */
  head?: string;
  /** The repo's main checkout (never removable — git refuses). */
  isPrimary: boolean;
  /** Has uncommitted or untracked files (drives the remove guard). */
  isDirty: boolean;
}

/** Requests that `terminal.create` spawn the given session's *interactive*
 * agent CLI (resumed from whatever conversation state that session already
 * has) instead of a plain shell. The client only names the session + agent;
 * the server alone resolves the provider-internal resume id (claude session
 * id / codex thread id) — that state never crosses the wire. */
export interface AgentAttach {
  sessionId: string;
  agent: AgentKind;
}

export interface ChatSendMessage {
  type: "chat.send";
  sessionId: string;
  text: string;
  agent?: AgentKind;
  model?: string;
  /** Run this turn in *plan mode*: claude gets `--permission-mode plan`
   * instead of `bypassPermissions`, codex gets `--sandbox read-only`. Absent
   * ⇒ `false` (the pre-existing behaviour), so older clients are unaffected. */
  planMode?: boolean;
  /** Reasoning-effort level for this turn. Absent (or `"default"`) omits the
   * flag entirely and lets the CLI use its own default. claude:
   * `--effort <level>`; codex: `-c model_reasoning_effort="<level>"`.
   * Legal values — claude: `low|medium|high|xhigh|max|none`;
   * codex: `none|low|medium|high|xhigh`. */
  effort?: string;
  /** Absolute, server-side paths of files staged via `POST {base}upload` to
   * attach to this turn. Images are passed to codex with `-i`; every other
   * file (and every file for claude) is named in a trailing
   * `[Attached files: …]` note appended to the turn text, which the CLI then
   * reads itself. */
  attachments?: string[];
}

/** Ask the server which slash commands / skills the agent CLIs know about in
 * this session's cwd, for composer autocomplete. The server probes the CLIs
 * (cached per host+cwd for a few minutes) and answers with the server-side
 * `commands.list` (`CommandsListResponseMessage`). Note: "commands.list"
 * appears in both directions — the union context disambiguates. */
export interface CommandsListMessage {
  type: "commands.list";
  sessionId: string;
}

export interface ChatCancelMessage {
  type: "chat.cancel";
  sessionId: string;
}

export interface TerminalCreateMessage {
  type: "terminal.create";
  cols: number;
  rows: number;
  cwd?: string;
  agentAttach?: AgentAttach;
}

export interface TerminalInputMessage {
  type: "terminal.input";
  terminalId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: "terminal.resize";
  terminalId: string;
  cols: number;
  rows: number;
}

/** Force-terminate a single terminal's backing PTY/process. Used when a
 * CLI-mode (agentAttach) terminal is torn down — e.g. leaving CLI mode for
 * Hosted, or deleting the session it's attached to — so the spawned
 * `claude --resume`/`codex resume` process doesn't keep running (and
 * blocking a fresh attach) after the view that owned it is gone. */
export interface TerminalKillMessage {
  type: "terminal.kill";
  terminalId: string;
}

/** Request the server to push a fresh `session.list` response.
 * Note: "session.list" appears in both directions — as a client request here
 * and as a server response (SessionListResponseMessage). The union context
 * disambiguates which direction is intended. */
export interface SessionListMessage {
  type: "session.list";
}

// Stage D — settings & hosts client messages

export interface SettingsGetMessage {
  type: "settings.get";
}

export interface SettingsUpdateMessage {
  type: "settings.update";
  patch: SettingsPatch;
}

export interface HostsListMessage {
  type: "hosts.list";
}

export interface HostsUpsertMessage {
  type: "hosts.upsert";
  host: SshHostEntry;
}

export interface HostsDeleteMessage {
  type: "hosts.delete";
  id: string;
}

export interface SessionArchiveMessage {
  type: "session.archive";
  sessionId: string;
  archived: boolean;
}

/** Permanently delete a session: its messages, its DB row, any in-flight
 * turn, and any CLI-attached terminal. Irreversible — unlike
 * SessionArchiveMessage, there is no `deleted: boolean` toggle. */
export interface SessionDeleteMessage {
  type: "session.delete";
  sessionId: string;
}

/** Request the persisted dockview layout blob for a session (Phase 3:
 * Workspace → Tab → Pane model). The server never interprets this JSON — it
 * is an opaque `dockview` `api.toJSON()` snapshot, only persisted/echoed. */
export interface SessionLayoutGetMessage {
  type: "session.layout.get";
  sessionId: string;
}

/** Persist a session's dockview layout blob. Callers should debounce (see
 * `store.ts`'s `saveSessionLayout`). */
export interface SessionLayoutSetMessage {
  type: "session.layout.set";
  sessionId: string;
  layout: unknown;
}

/** User-set title override for a session (see `db.rs`'s `title_override`
 * column). Persists across the auto-title-from-first-message logic — once
 * set, the user title always wins. */
export interface SessionRenameMessage {
  type: "session.rename";
  sessionId: string;
  title: string;
}

/** List directories at `path` (or the user's home directory when absent) on
 * the given host (local when absent/`"local"`), for the new-session cwd
 * picker. `requestId` is echoed back on `FsBrowseResultMessage` so the client
 * can match replies to in-flight requests. */
export interface FsBrowseMessage {
  type: "fs.browse";
  requestId: string;
  hostId?: string;
  path?: string;
}

/** List every git worktree of the repo containing `repoPath` (Wave 2 — ported
 * from herdr, see `crates/perch-core/src/worktree.rs`). Request-correlated
 * exactly like `fs.browse`: `requestId` comes back on
 * `WorktreeListResultMessage`, hub-relayed for federated hosts. */
export interface WorktreeListMessage {
  type: "worktree.list";
  requestId: string;
  hostId?: string;
  repoPath: string;
}

/** Create a linked worktree for `branch`. `newBranch` is a hint: when the
 * branch already exists locally the existing-branch form is used anyway.
 * `path` overrides the default `~/.perch/worktrees/<repo-name>/<branch-slug>`
 * location. Replies with `worktree.done` or `worktree.error`. */
export interface WorktreeCreateMessage {
  type: "worktree.create";
  requestId: string;
  hostId?: string;
  repoPath: string;
  branch: string;
  newBranch?: boolean;
  path?: string;
}

/** Remove the worktree checked out at `path`. Refused with
 * `worktree.error { dirty: true }` when the checkout has uncommitted or
 * untracked files and `force` is false (herdr's dirty guard). */
export interface WorktreeRemoveMessage {
  type: "worktree.remove";
  requestId: string;
  hostId?: string;
  repoPath: string;
  path: string;
  force?: boolean;
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionSubscribeMessage
  | SessionResumeMessage
  | SessionListMessage
  | ChatSendMessage
  | ChatCancelMessage
  | CommandsListMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalKillMessage
  | SettingsGetMessage
  | SettingsUpdateMessage
  | HostsListMessage
  | HostsUpsertMessage
  | HostsDeleteMessage
  | SessionArchiveMessage
  | SessionDeleteMessage
  | SessionLayoutGetMessage
  | SessionLayoutSetMessage
  | SessionRenameMessage
  | FsBrowseMessage
  | WorktreeListMessage
  | WorktreeCreateMessage
  | WorktreeRemoveMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface SessionCreatedMessage {
  type: "session.created";
  sessionId: string;
}

/** A single persisted turn, replayed to a resuming client. */
export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  agent?: AgentKind;
  model?: string;
  thinking?: string;
  createdAt?: number;
}

/** Sent after `session.created` in response to `session.resume`, when the
 * session already existed in the database. Carries the full prior transcript
 * so the client can rebuild its message list before live events resume. */
export interface SessionHistoryMessage {
  type: "session.history";
  sessionId: string;
  messages: HistoryMessage[];
}

export interface ChatChunkMessage {
  type: "chat.chunk";
  sessionId: string;
  text: string;
}

export interface ChatThinkingMessage {
  type: "chat.thinking";
  sessionId: string;
  text: string;
}

export interface ChatToolUseMessage {
  type: "chat.tool_use";
  sessionId: string;
  name: string;
  input: unknown;
}

export interface ChatToolResultMessage {
  type: "chat.tool_result";
  sessionId: string;
  name: string;
  result: unknown;
}

export interface ChatDoneMessage {
  type: "chat.done";
  sessionId: string;
  usage?: ChatUsage;
}

/** A plan produced by a plan-mode claude turn. claude 2.1.x has no
 * `ExitPlanMode` tool; the plan arrives as an ordinary `Write` tool_use whose
 * `input.file_path` lands under `.claude/plans/`, and `agent.rs` lifts its
 * `input.content` into this message. Codex plan mode (`--sandbox read-only`)
 * produces no such artifact, so this is claude-only. */
export interface ChatPlanMessage {
  type: "chat.plan";
  sessionId: string;
  content: string;
}

/** Reply to the client `commands.list` — the slash commands / skills each CLI
 * knows about in this session's cwd. Either list may be empty (probe failed,
 * CLI not installed, …); the client just shows fewer suggestions. Note:
 * "commands.list" appears in both directions; here it is the server response
 * form. */
export interface CommandsListResponseMessage {
  type: "commands.list";
  sessionId: string;
  claude: CommandEntry[];
  codex: CommandEntry[];
}

export interface TerminalCreatedMessage {
  type: "terminal.created";
  terminalId: string;
}

export interface TerminalDataMessage {
  type: "terminal.data";
  terminalId: string;
  data: string;
}

export interface TerminalExitMessage {
  type: "terminal.exit";
  terminalId: string;
  code: number;
}

export interface StatusUpdateMessage {
  type: "status.update";
  cwd: string;
  branch: string;
  contextTokens?: number;
  costUsd?: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

/** Server response to a client `session.list` request — carries the full
 * list of sessions known to the server. Note: "session.list" appears in
 * both directions; here it is the server response form. */
export interface SessionListResponseMessage {
  type: "session.list";
  sessions: SessionSummary[];
}

/** Pushed by the server whenever a session's metadata changes (e.g. status
 * transitions idle→running on first chat.send, or lastAgent/lastModel is
 * recorded after a turn completes). Also sent after session.created. */
export interface SessionUpdatedMessage {
  type: "session.updated";
  session: SessionSummary;
}

/** Broadcast to every connection (mirrors HostsUpdatedMessage's fan-out) when
 * a session is permanently deleted, since the row backing a normal
 * `session.updated` no longer exists to look up. Client state removes the
 * session from its local list on receipt regardless of which tab/connection
 * issued the `session.delete`. */
export interface SessionDeletedMessage {
  type: "session.deleted";
  sessionId: string;
}

/** Sent once per connection after the WS handshake so the client knows
 * where it is connected and can display the correct environment badge.
 * Also carries the server-discovered model lists — clients must populate
 * their model dropdowns from these rather than any hardcoded catalogue. */
/** The user's real terminal appearance, read from their iTerm2 default
 * profile (see `iterm_profile.rs`). CLI-mode panes render with this so the
 * agent CLIs look exactly as they do in the user's own terminal, instead of
 * being restyled by perch's UI theme. Every field is optional: whatever is
 * absent falls through to xterm.js's stock default — never to a perch token. */
export interface TerminalProfile {
  /** CSS font family, e.g. `MesloLGS NF`. */
  fontFamily?: string;
  fontSize?: number;
  /** xterm `ITheme` keys (`background`, `red`, `brightBlue`, …) to `#rrggbb`. */
  theme?: Record<string, string>;
}

export interface ServerInfoMessage {
  type: "server.info";
  hostname: string;
  isSsh: boolean;
  platform: string;
  claudeModels: ModelEntry[];
  codexModels: ModelEntry[];
  /** Absent when the server couldn't read one. */
  terminalProfile?: TerminalProfile;
}

// Stage D — settings & hosts server messages

/** Sent in response to `settings.get` and `settings.update`. */
export interface SettingsCurrentMessage {
  type: "settings.current";
  settings: SettingsData;
}

/** Sent in response to `hosts.list`. */
export interface HostsListResponseMessage {
  type: "hosts.list";
  hosts: SshHostEntry[];
}

/** Sent after `hosts.upsert` or `hosts.delete` — contains the full updated list. */
export interface HostsUpdatedMessage {
  type: "hosts.updated";
  hosts: SshHostEntry[];
}

/** Reply to `session.layout.get`. `layout` is absent when the session has
 * never had a layout saved — the client falls back to its default
 * single-Chat-panel layout in that case. */
export interface SessionLayoutMessage {
  type: "session.layout";
  sessionId: string;
  layout?: unknown;
}

/** Git branch + ahead/behind status for a project (host, cwd) pair. Pushed
 * whenever the computed value changes for a local session's cwd, and once to
 * every newly-connected client per known cwd (cached snapshot). For
 * federated hosts, `hostId` is rewritten by the hub to the federated host's
 * id before this reaches the browser. */
export interface WorkspaceGitMessage {
  type: "workspace.git";
  hostId: string;
  cwd: string;
  branch?: string;
  ahead: number;
  behind: number;
}

/** Reply to `fs.browse`. `parent` is absent when `path` is already the
 * filesystem root. `home` is always the resolved home directory for the
 * target host, so the client can offer a "home" shortcut regardless of where
 * the current listing is. */
export interface FsBrowseResultMessage {
  type: "fs.browse.result";
  requestId: string;
  hostId: string;
  path: string;
  parent?: string;
  home: string;
  entries: FsEntry[];
}

/** Reply to `worktree.list`. `repoPath` echoes the request so the client can
 * key its cache by `${hostId}:${repoPath}`. `defaultRoot` is
 * `~/.perch/worktrees/<repo-name>` on the *target* host, letting the create
 * form prefill a sensible custom-path default. */
export interface WorktreeListResultMessage {
  type: "worktree.list.result";
  requestId: string;
  hostId: string;
  repoPath: string;
  defaultRoot: string;
  worktrees: WorktreeEntry[];
}

/** Success reply to `worktree.create` / `worktree.remove`. `path` is the
 * created checkout (create) or the removed checkout (remove). */
export interface WorktreeDoneMessage {
  type: "worktree.done";
  requestId: string;
  hostId: string;
  action: "create" | "remove";
  path: string;
}

/** Failure reply to any `worktree.*` request. `dirty` is true only when the
 * operation was refused by the dirty-checkout guard — the client escalates
 * that into a "force remove?" confirmation rather than showing it as a hard
 * error (herdr's `force_confirmation` two-step). */
export interface WorktreeErrorMessage {
  type: "worktree.error";
  requestId: string;
  hostId: string;
  message: string;
  dirty?: boolean;
}

export type ServerMessage =
  | SessionCreatedMessage
  | SessionHistoryMessage
  | SessionListResponseMessage
  | SessionUpdatedMessage
  | SessionDeletedMessage
  | ServerInfoMessage
  | ChatChunkMessage
  | ChatThinkingMessage
  | ChatToolUseMessage
  | ChatToolResultMessage
  | ChatDoneMessage
  | ChatPlanMessage
  | CommandsListResponseMessage
  | TerminalCreatedMessage
  | TerminalDataMessage
  | TerminalExitMessage
  | StatusUpdateMessage
  | ErrorMessage
  | SettingsCurrentMessage
  | HostsListResponseMessage
  | HostsUpdatedMessage
  | HostInfoMessage
  | SessionLayoutMessage
  | WorkspaceGitMessage
  | FsBrowseResultMessage
  | WorktreeListResultMessage
  | WorktreeDoneMessage
  | WorktreeErrorMessage;
