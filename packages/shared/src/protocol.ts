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
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  contextTokens: number;
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
   * Defaults to `"perch"` — perch's own look. */
  theme: string;
}

/**
 * Patch for `settings.update`. Absent fields = no change.
 * - `customModels` absent → unchanged; present → replace whole struct.
 * - `defaultCwd` absent → unchanged; `null` → clear; string → set.
 * - `theme` absent → unchanged; string → set (no "clear" case).
 */
export interface SettingsPatch {
  customModels?: CustomModelsData;
  defaultCwd?: string | null;
  theme?: string;
}

export interface SshHostEntry {
  id: string;
  name: string;
  sshHost: string;
  /** Defaults to 7788 when omitted. */
  remotePort: number;
  /** Defaults to true when omitted. */
  enabled: boolean;
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
  /** Whether the session's agent is blocked on an approval prompt, detected
   * by scanning recent CLI-attached terminal output for known approval-
   * prompt patterns. Only meaningful for sessions with a live CLI-attached
   * terminal; otherwise always false. Defaults to false when absent. */
  blocked?: boolean;
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

export type ClientMessage =
  | SessionCreateMessage
  | SessionSubscribeMessage
  | SessionResumeMessage
  | SessionListMessage
  | ChatSendMessage
  | ChatCancelMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | SettingsGetMessage
  | SettingsUpdateMessage
  | HostsListMessage
  | HostsUpsertMessage
  | HostsDeleteMessage
  | SessionArchiveMessage
  | SessionLayoutGetMessage
  | SessionLayoutSetMessage;

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

/** Sent once per connection after the WS handshake so the client knows
 * where it is connected and can display the correct environment badge.
 * Also carries the server-discovered model lists — clients must populate
 * their model dropdowns from these rather than any hardcoded catalogue. */
export interface ServerInfoMessage {
  type: "server.info";
  hostname: string;
  isSsh: boolean;
  platform: string;
  claudeModels: ModelEntry[];
  codexModels: ModelEntry[];
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

export type ServerMessage =
  | SessionCreatedMessage
  | SessionHistoryMessage
  | SessionListResponseMessage
  | SessionUpdatedMessage
  | ServerInfoMessage
  | ChatChunkMessage
  | ChatThinkingMessage
  | ChatToolUseMessage
  | ChatToolResultMessage
  | ChatDoneMessage
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
  | WorkspaceGitMessage;
