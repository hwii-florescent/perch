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

/** Captures are frozen view excerpts, never promises about current disk/Git. */
export type ContextSource =
  | { kind: "file"; path: string }
  | { kind: "editor"; path: string; text: string; startLine: number; endLine: number; dirty: boolean }
  | { kind: "diff"; path: string; text: string; revision: string; comparison: string }
  | { kind: "terminal"; sessionId: string; text: string };

export interface ContextPacket {
  workspaceId: string;
  markdown: string;
  digest: string;
}
export interface ContextAgent {
  sessionId: string;
  title: string;
  providerId: string;
  canSend: boolean;
  reason: string;
}
export interface ContextPreviewMessage {
  type: "context.preview";
  requestId: string;
  workspaceId: string;
  source: ContextSource;
  instruction: string;
}
export interface ContextSendMessage {
  type: "context.send";
  requestId: string;
  workspaceId: string;
  source: ContextSource;
  instruction: string;
  digest: string;
  targetSessionId: string;
  operationId: string;
}
export interface ContextPreviewResultMessage {
  type: "context.preview.result";
  requestId: string;
  packet: ContextPacket;
  agents: ContextAgent[];
}

export interface NativeUiTool {
  name: string;
  input: string;
  /** The provider's id for this call; its result names it in `toolCallId`. */
  id?: string;
  /** What the provider says about the call; absent when it says nothing. */
  state?: "running" | "completed" | "failed";
}
export interface NativeUiMessage {
  id: string;
  role: string;
  text: string;
  thinking: string;
  tools: NativeUiTool[];
  toolName?: string;
  model?: string;
  error?: string;
  /** On a `toolResult`: the `NativeUiTool.id` it answers. */
  toolCallId?: string;
  /** On a `toolResult`: the tool reported failure. */
  isError?: boolean;
  /** On a `toolResult` of a file edit: the provider's resolved hunks (Claude's `structuredPatch`). */
  editPatch?: NativeUiEditPatch;
}
export interface NativeUiEditPatch {
  filePath?: string;
  hunks: NativeUiEditHunk[];
}
/** One unified-diff hunk; `lines` keep their leading `+`, `-` or space. */
export interface NativeUiEditHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** What the chat draws, derived in Rust from `NativeUiSnapshot.messages` (`native_ui/transcript.rs`). */
export interface NativeUiTranscript {
  blocks: NativeUiBlock[];
  /** The live activity line while a turn runs and nothing waits on the person. */
  working?: string;
  /** The agent's own to-do list as of its latest plan call, docked above the composer; absent without one. */
  tasks?: NativeUiTaskList;
  /** What each turn's landed edits changed, once per file; drawn after the block named in `after`. */
  turnDiffs?: NativeUiTurnDiff[];
  /** The subagents each spawning turn started, one roster per turn, drawn after the block named in `after`. */
  subagents?: NativeUiSubagentGroup[];
}
/** One spawning turn's roster (`native_ui/subagents.rs`). */
export interface NativeUiSubagentGroup {
  /** The user message that opened the spawning turn; empty when its spawn call is not in the loaded history. */
  turn: string;
  /** The block this is drawn after. */
  after: string;
  working: boolean;
  /** "Kicked off 2 subagents" while any child works, else "Ran 2 subagents". */
  headline: string;
  verdictState: string;
  verdict: string;
  /** An adverse outcome already recorded while siblings still work. */
  alertState?: string;
  alert?: string;
  /** How long the settled group ran. */
  durationMs?: number;
  agents: NativeUiSubagentRow[];
}
export interface NativeUiSubagentRow {
  id: string;
  label: string;
  state: string;
  stateLabel: string;
  agentType?: string;
}
export interface NativeUiTurnDiff {
  /** The user message that opened the turn. */
  turn: string;
  /** The block this is drawn after: the last one of the turn. */
  after: string;
  files: NativeUiTurnDiffFile[];
  added: number;
  removed: number;
  truncated?: boolean;
}
export interface NativeUiTurnDiffFile {
  path: string;
  added: number;
  removed: number;
  truncated?: boolean;
  /** In the order the edits ran: the step that holds each card, and which of its cards. */
  edits: { step: string; fileIndex: number }[];
}
export interface NativeUiTaskList {
  tasks: NativeUiTask[];
  explanation?: string;
}
export interface NativeUiTask {
  content: string;
  status: "pending" | "in_progress" | "completed";
  /** Present-tense phrasing; shown only while the task is in progress. */
  activeForm?: string;
}
export type NativeUiBlock =
  /** `id` is the `NativeUiMessage` it draws. */
  | { kind: "message"; id: string; turn: string; live?: boolean; sender?: NativeUiEnvelope }
  | { kind: "run"; id: string; turn: string; live?: boolean; summary: string; calls: number; failed: number; steps: NativeUiStep[] };
/** A user row that is a banner Perch delivered; the chat draws a card from it instead of the row's text
 * (`agent_mail.rs::parse_envelope`). `sender`: `session` (another agent: `provider`, `label`, `session`),
 * `person` (the person, through the family strip) or `perch` (a roster of status notes). */
export interface NativeUiEnvelope {
  kind: "message" | "steer" | "note" | "status";
  sender: "session" | "person" | "perch";
  provider?: string;
  label?: string;
  session?: string;
  /** The header's `HH:MM UTC`. */
  at: string;
  /** The text that was sent, unquoted; for a body that went to a file, its preview. */
  body: string;
  fullTextPath?: string;
  chars?: number;
  messageId?: string;
}
export interface NativeUiStep {
  id: string;
  kind: "thinking" | "tool" | "result";
  label: string;
  body: string;
  tool?: {
    category: string;
    state: "running" | "completed" | "failed" | "unfinished";
    output?: string;
    /** What a landed file edit changed, one card per file (`native_ui/edits.rs`). */
    edit?: NativeUiEditFile[];
  };
}
export interface NativeUiEditFile {
  path: string;
  /** Set only when the change moved the file. */
  oldPath?: string;
  changeKind: "added" | "deleted" | "edited" | "renamed";
  lines: NativeUiEditLine[];
  added: number;
  removed: number;
  /** False when positions are snippet-relative: the rows then carry no numbers. */
  lineNumbersKnown: boolean;
  truncated?: boolean;
}
/** A removed row has no `newLineNumber`, an added one no `oldLineNumber`; a gap carries neither nor text. */
export interface NativeUiEditLine {
  kind: "context" | "add" | "del" | "gap";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}
export interface NativeUiSnapshot {
  version: number;
  revision: number;
  pid: number;
  /** Empty on OpenCode's home view until the native TUI creates a conversation. */
  providerSessionId: string;
  cwd: string;
  model: string | null;
  /** The reasoning effort the provider reports, as it writes it (`high`). Codex only. */
  effort?: string;
  /** `ask`, `accept-edits`, `auto`, `full-access` or `plan`: Claude's last hook event, Codex's thread settings. */
  permissionMode?: string;
  running: boolean;
  /** The turn is paused on a human: a permission prompt or a question. Implies `running`. */
  blocked?: boolean;
  /** The numbered choices the CLI is waiting on, when its screen shows them. */
  request?: NativeUiRequest;
  /** How full the model's context is, when the provider reports it. */
  context?: NativeUiContext;
  messages: NativeUiMessage[];
  truncated: boolean;
  /** Older messages than `messages` hold can be loaded (`agent.ui.older`). Absent from older cores. */
  canLoadOlder?: boolean;
  /** Absent from older cores. */
  transcript?: NativeUiTranscript;
  /** The model, effort and mode worded for the toolbar, read-only. Absent from older cores. */
  options?: NativeUiOptions;
  /** The subagents the session started (raw; the transcript groups and words them). Claude only. */
  subagents?: NativeUiSubagent[];
}

export interface NativeUiSubagent {
  id: string;
  label: string;
  agentType?: string;
  /** The lead's spawn call, which places the row in the transcript. */
  toolUseId?: string;
  /** `working`, `completed` or `unverifiable`. */
  state: string;
  startedAt?: number;
  settledAt?: number;
}

/** Display text for the toolbar (`native_ui/session_options.rs`); never an instruction to change anything. */
export interface NativeUiOptions {
  /** "Haiku 4.5". */
  model?: string;
  /** "High". */
  effort?: string;
  /** "Accept edits". */
  permissionMode?: string;
  /** What the chat may change in the running CLI, each with the value last read back from it. */
  pickers?: NativeUiPicker[];
}

/** One option the chat can change: `model`, `effort` or `mode` (`native_ui/option_pickers.rs`). */
export interface NativeUiPicker {
  id: string;
  label: string;
  /** The choice value the CLI was last seen running with, never what was merely sent. */
  current?: string;
  choices: NativeUiPickerChoice[];
  /** False while a turn runs or the CLI waits on a person. */
  settable: boolean;
  /** A consequence worth knowing before choosing. */
  note?: string;
}
export interface NativeUiPickerChoice {
  value: string;
  label: string;
  description?: string;
}

/** Context use from the last model response. Never a cost or a quota. */
export interface NativeUiContext {
  usedTokens: number;
  windowTokens: number;
  /** The window size is a guess from the model name (Claude does not report it). */
  estimated?: boolean;
}

/** A permission prompt or question, answered by `agent.ui.answer` with an option key. */
export interface NativeUiRequest {
  /** Fingerprint of the prompt text; an answer only applies to this exact prompt. */
  id: string;
  title: string;
  detail: string;
  options: NativeUiRequestOption[];
}

export interface NativeUiRequestOption {
  key: string;
  label: string;
  detail?: string;
}

export interface AgentUiGetMessage {
  type: "agent.ui.get";
  requestId: string;
  sessionId: string;
  providerId: string;
}
export interface AgentUiFindMessage {
  type: "agent.ui.find";
  requestId: string;
  sessionId: string;
  providerId: string;
  query: string;
}
export interface AgentUiFoundMessage {
  type: "agent.ui.found";
  requestId: string;
  sessionId: string;
  /** Ids of the blocks that match, in transcript order. */
  blocks: string[];
}
/** The text half-typed on the CLI's own input line, if readable whole; answered by `agent.ui.drafted`. */
export interface AgentUiDraftMessage {
  type: "agent.ui.draft";
  requestId: string;
  sessionId: string;
  providerId: string;
}
/** Read one page further back; the longer snapshot follows as usual and `agent.ui.older.result` says what happened. */
export interface AgentUiOlderMessage {
  type: "agent.ui.older";
  requestId: string;
  sessionId: string;
  providerId: string;
}
export interface AgentUiOlderResultMessage {
  type: "agent.ui.older.result";
  requestId: string;
  sessionId: string;
  /** `applied`: more is loaded. `exhausted`: nothing older, or Perch will not load more. `unchanged`: the read added nothing. `failed`: it did not finish. */
  outcome: "applied" | "exhausted" | "unchanged" | "failed";
}
/** Change one option of the running CLI (capability `agent.ui.options`): typed or keyed at an idle, verified-empty prompt under the input lease. */
export interface AgentUiOptionMessage {
  type: "agent.ui.option";
  requestId: string;
  sessionId: string;
  providerId: string;
  generation: number;
  /** `NativeUiPicker.id`. */
  option: string;
  /** A `NativeUiPickerChoice.value`. */
  value: string;
}
export interface AgentUiOptionResultMessage {
  type: "agent.ui.option.result";
  requestId: string;
  sessionId: string;
  option: string;
  /** `unconfirmed`: the CLI never showed the change; the picker keeps the value read back before. */
  outcome: "applied" | "unconfirmed";
  /** The value read back from the CLI. */
  value?: string;
}
export interface AgentUiDraftedMessage {
  type: "agent.ui.drafted";
  requestId: string;
  sessionId: string;
  /** Absent when the line is empty or cannot be read whole. */
  text?: string;
}
export interface AgentUiPromptMessage {
  type: "agent.ui.prompt";
  requestId: string;
  sessionId: string;
  providerId: string;
  operationId: string;
  generation: number;
  text: string;
  /** The terminal draft this composer picked up: the core clears the CLI's line (if it still holds exactly this) before sending. */
  replaces?: string;
  /** How a message sent while a turn runs is delivered: "steer" into the running turn, or "queue" behind it. Absent is "queue". */
  delivery?: "steer" | "queue";
}
export interface AgentUiAnswerMessage {
  type: "agent.ui.answer";
  requestId: string;
  sessionId: string;
  providerId: string;
  generation: number;
  /** `NativeUiRequest.id` the user was looking at. */
  promptId: string;
  /** `NativeUiRequestOption.key` they chose. */
  key: string;
}
export interface AgentUiCancelMessage {
  type: "agent.ui.cancel";
  requestId: string;
  sessionId: string;
  providerId: string;
  generation: number;
}
export interface AgentUiSnapshotMessage {
  type: "agent.ui.snapshot";
  requestId?: string;
  sessionId: string;
  providerId: string;
  snapshot: NativeUiSnapshot;
}
export interface AgentUiResultMessage {
  type: "agent.ui.result";
  requestId: string;
  sessionId: string;
  accepted: boolean;
  /** The text was a built-in slash command, run in the CLI's terminal instead of sent as a message.
   * Its effect shows there, not in the transcript. */
  command?: boolean;
}

/** One invocable command/skill offered by an agent CLI in a given cwd, as
 * scraped by `commands.rs` and served in `commands.list`. `name` is bare (no
 * `/` or `$` sigil) — the client prepends whichever sigil the active agent
 * uses. Mirrors `CommandEntry` in `crates/perch-core/src/protocol.rs`. */
export interface CommandEntry {
  name: string;
  description?: string;
  /** Provider-authored argument sketch, e.g. `<provider/model>`. */
  argumentHint?: string;
  /** `builtin`, `skill`, `command` (a user's or plugin's), `extension` or `prompt`. */
  kind?: string;
}

// ---------------------------------------------------------------------------
// Stage D: Settings & SSH hosts value types
// ---------------------------------------------------------------------------

export type BrowserSearchEngine = "google" | "duckduckgo" | "bing" | "brave";

/** `off`: every mod is off (same as starting Perch with PERCH_MODS=off). */
export interface ModsPolicy {
  off: boolean;
}

export interface SettingsData {
  /** `null` means no default set (use process cwd). */
  defaultCwd: string | null;
  /** Selected theme name (key into the client's `THEMES` table).
   * Defaults to `"perch"`, perch's monotone look. */
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
  /** One global view for every agent session: `"cli"` (xterm attached to the
   * agent's terminal) or `"ui"` (the native chat over the same process).
   * Defaults to `"cli"`. A core older than 2026-11-05 may still send
   * `"hosted"`; it means `"ui"`. */
  chatMode: "ui" | "cli";
  /** Lines of scrollback each terminal pane retains. Defaults to 10000 — the
   * value that used to be hardcoded in `xtermSetup.ts`, so an existing
   * settings file behaves exactly as before. Clamped client-side: xterm.js
   * allocates eagerly, so a pathological value is a browser OOM. */
  terminalScrollback: number;
  /** Spawn plain terminal panes as a **login** shell (`-l`) rather than a bare
   * interactive one. Off by default: it changes which rc files run, which can
   * visibly change the user's prompt and PATH. Does not affect agent-attach
   * (CLI-mode) panes, which spawn the CLI directly. */
  terminalLoginShell: boolean;
  /** Shell-escaped double quotes for dropped paths. Absent = off (single quotes). */
  droppedPathDoubleQuotes?: boolean;
  /** Provider id a click on a workspace with no sessions starts (e.g.
   * `"terminal"`). Empty (the default, and absent from older peers) shows
   * the start picker instead. */
  emptyWorkspaceAgent?: string;
  /** Shortcut overrides: action id → key combo (`"cmd+shift+t"`), `""` = no
   * shortcut; an absent id keeps the default. Absent from older peers. */
  keybindings?: Record<string, string>;
  /** Ask before closing a tab that runs an agent. Absent = true. */
  warnCloseAgent?: boolean;
  /** A single-clicked file opens as a replaceable preview tab. Absent = true. */
  previewTabs?: boolean;
  /** Tab corner style. Absent = "square" for older peers. */
  tabShape?: "square" | "round";
  /** The desktop app also listens on the LAN for paired phones. Absent = off. */
  phoneAccess?: boolean;
  /** Relay address for phones on any network; empty or absent = off. */
  relayUrl?: string;
  /** Setup completed or skipped, not an OS grant. Absent = false. */
  permissionsSetupDismissed?: boolean;
  /** Address-bar search engine. Absent on older peers means Google. */
  browserSearchEngine?: BrowserSearchEngine;
  /** Address-bar suggestions from the search engine (what is typed is sent to it). Absent = off. */
  browserSearchSuggestions?: boolean;
  /** Plan-usage alert threshold in percent; 0 = off. Absent = 80. */
  usageLimitAlert?: number;
  /** Daily API-equivalent spend alert in dollars; 0 or absent = off. */
  usageDailyBudgetUsd?: number;
  /** A cheap model summarises a sub-session's finished turn. Absent = on. */
  reporterEnabled?: boolean;
  reporterClaudeModel?: string;
  reporterCodexModel?: string;
  /** Leads may start sub-sessions with `perch spawn` without a person's click. Absent = off: `perch spawn` becomes a suggested-task card. */
  leadsStartWithoutAsking?: boolean;
  /** How a new or changed mod is approved. Absent = `ask`. Its own policy, separate from sub-session permissions. */
  mods?: ModsPolicy;
  /** Pi's and OMP's reporter models (`provider/id`); absent or empty = that harness has none. */
  reporterPiModel?: string;
  reporterOmpModel?: string;
  /**
   * Per-run sub-session limits (Settings > Sub-sessions). Absent from an older core = today's defaults:
   * 4 live, 8 total, 50 messages, 10 automatic lead wakes, 3 interrupts per sub-session, 10 waiting cards.
   */
  maxLiveSubSessions?: number;
  maxSubSessions?: number;
  maxMessagesPerRun?: number;
  maxLeadWakesPerRun?: number;
  maxInterruptsPerSubSession?: number;
  maxWaitingSuggestions?: number;
}

/**
 * Patch for `settings.update`. Absent fields = no change.
 * - `defaultCwd` absent → unchanged; `null` → clear; string → set.
 * - `theme` absent → unchanged; string → set (no "clear" case).
 * - `soundEnabled` absent → unchanged; boolean → set.
 * - `toastDelivery` absent → unchanged; string → set.
 * - `chatMode` absent → unchanged; string → set (no "clear" case).
 */
export interface SettingsPatch {
  defaultCwd?: string | null;
  theme?: string;
  soundEnabled?: boolean;
  toastDelivery?: "off" | "app" | "system";
  chatMode?: "ui" | "cli";
  terminalScrollback?: number;
  terminalLoginShell?: boolean;
  droppedPathDoubleQuotes?: boolean;
  emptyWorkspaceAgent?: string;
  /** Replaces the whole override map. */
  keybindings?: Record<string, string>;
  warnCloseAgent?: boolean;
  previewTabs?: boolean;
  tabShape?: "square" | "round";
  phoneAccess?: boolean;
  relayUrl?: string;
  permissionsSetupDismissed?: boolean;
  browserSearchEngine?: BrowserSearchEngine;
  browserSearchSuggestions?: boolean;
  usageLimitAlert?: number;
  usageDailyBudgetUsd?: number;
  reporterEnabled?: boolean;
  reporterClaudeModel?: string;
  reporterCodexModel?: string;
  leadsStartWithoutAsking?: boolean;
  mods?: ModsPolicy;
  reporterPiModel?: string;
  reporterOmpModel?: string;
  maxLiveSubSessions?: number;
  maxSubSessions?: number;
  maxMessagesPerRun?: number;
  maxLeadWakesPerRun?: number;
  maxInterruptsPerSubSession?: number;
  maxWaitingSuggestions?: number;
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
 * and again on every state change.  The `hostname`, `platform`, `isSsh` fields are only present when the host
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
  /** The remote's capabilities that the hub relays (`hub::RELAYED_CAPABILITIES`). */
  capabilities?: string[];
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
 * the same id) if the session still exists in
 * the database, or `session.created` with a brand-new id if it doesn't. */
export interface SessionResumeMessage {
  type: "session.resume";
  sessionId: string;
}

/** Agents with a direct-host attach path. */
export type AgentKind = "claude" | "codex";

export interface AgentLifecycleKey {
  workspaceId: string;
  sessionId: string;
  agentId: string;
}

export interface AgentManifestSummary {
  id: string;
  displayName: string;
  supportedModes: string[];
  resumability: string;
  capabilities: string[];
  statusDetection: string;
  available: boolean;
  executable?: string;
  reason?: string;
  homepageUrl?: string;
  launchCommand?: string;
  enabled?: boolean;
  isDefault?: boolean;
  nativeUi?: boolean;
}

/** Connection-authenticated lease returned by the Rust runtime. */
export interface AgentControlLease {
  clientId: string;
  deviceId: string;
  generation: number;
  acquiredAtMs: number;
  lastActivityMs: number;
}

export interface AgentLifecycleStatus {
  key: AgentLifecycleKey;
  providerId: string;
  providerSessionId?: string;
  resumable: boolean;
  state: "working" | "blocked" | "done" | "idle" | "sleeping" | "exited" | "error" | "reconnecting";
  reason: string;
  lastTransitionMs: number;
  lastActivityMs: number;
  revision: number;
  transitionSequence: number;
  inputOwner?: AgentControlLease;
  resizeOwner?: AgentControlLease;
}

// ---------------------------------------------------------------------------
// Session list / host info value types
// ---------------------------------------------------------------------------

export type SessionStatus = "running" | "idle";

export interface SessionSummary {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  status: SessionStatus;
  /** Which hub host owns this session.  "local" (or absent) means the
   * session lives on the directly-connected server instance. */
  hostId?: string;
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
  /** Last explicitly selected CLI provider, independent of the Chat runner. */
  cliProviderId?: string;
  /** Observed foreground CLI identity, or "terminal" for a shell/other job.
   * Display only; never replaces the saved launch/resume provider. */
  currentProviderId?: string;
  /** The native-chat agent running in this terminal tab (started via Perch's
   * command shims); present only while it runs. The chat view follows it. */
  chatProviderId?: string;
  /** The lead this session is a sub-session of (local only). The sidebar nests it under that lead. */
  parentSessionId?: string;
  /** What this session does with messages from other sessions: `hold` (keep each for its person) or `refuse`; absent = accept. */
  inboundMode?: "hold" | "refuse";
  /** Where a local terminal's shell is now (follows `cd`) and that directory's
   * git branch (absent outside a repo). the Files/Git drawer follows these. */
  currentCwd?: string;
  currentBranch?: string;
  /** Whether the session's agent is waiting on the human (a permission
   * prompt or a question), from native CLI events, the OSC title, or as a
   * last resort an output pattern. Defaults to false when absent. */
  blocked?: boolean;
  /** Running or blocked, but with no status evidence for 30 minutes: read it
   * as idle. Display only; the turn is not over, so a later completion still
   * notifies. Defaults to false when absent. */
  stale?: boolean;
  /** Stable durable project association, absent for old remote peers. */
  projectId?: string;
  /** Stable durable workspace association, absent for old remote peers. */
  workspaceId?: string;
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

/** Entry kinds used by the workspace file tree. Symbolic links are reported
 * as metadata and are never followed by the Rust filesystem service. */
export type FileEntryKind = "directory" | "file" | "symlink" | "other";

export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  modifiedAtMs?: number;
  readonly: boolean;
  executable: boolean;
  kind: FileEntryKind;
  mediaType?: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: FileEntryKind;
  size: number;
  modifiedAtMs?: number;
  readonly: boolean;
  executable: boolean;
  mediaType?: string;
}

export interface FileRead {
  metadata: FileMetadata;
  content: string;
  version: string;
}

export interface WriteResult {
  metadata: FileMetadata;
  bytesWritten: number;
  version: string;
}

export type PreviewKind =
  | "text"
  | "markdown"
  | "json"
  | "html"
  | "image"
  | "binary"
  | "tooLarge";

export interface FilePreview {
  metadata: FileMetadata;
  version?: string;
  kind: PreviewKind;
  content?: string;
  mediaType?: string;
  requiresSandbox: boolean;
  truncated: boolean;
  message?: string;
}

/** Durable server-owned editor draft. `baseContent` stays available for a
 * compare/merge after an external edit or process restart. */
export interface FileBuffer {
  workspaceId: string;
  path: string;
  content: string;
  baseContent: string;
  baseVersion?: string;
  externalVersion?: string;
  revision: number;
  dirty: boolean;
  conflict: boolean;
  updatedAt: number;
}

/** Metadata-only form returned by the bounded buffer listing. */
export interface FileBufferSummary {
  workspaceId: string;
  path: string;
  baseVersion?: string;
  externalVersion?: string;
  revision: number;
  dirty: boolean;
  conflict: boolean;
  updatedAt: number;
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

/** A branch kept by `worktree.remove { deleteBranch }` because git would not
 * prove it merged. Review `commits`, then `worktree.branch.delete` succeeds
 * only while the branch is still at `head`. */
export interface WorktreePreservedBranch {
  name: string;
  head: string;
  /** Up to 20 "<short sha> <subject>" lines on no other branch or remote. */
  commits: string[];
  /** Total number of such commits. */
  unmerged: number;
}

/** One background worktree create (`worktree.job.start`), as broadcast in
 * `worktree.jobs`. Mirrors `WorktreeJob` in `protocol.rs`. A job leaves the
 * list when it succeeds or once a cancel has cleaned up; a failed job stays,
 * with `error`, until retried or dismissed. */
export interface WorktreeJob {
  jobId: string;
  repoPath: string;
  branch: string;
  /** Where the checkout is being created. */
  path: string;
  status: "running" | "cancelling" | "failed";
  /** Human-readable step, e.g. "Checking out". */
  phase: string;
  error?: string;
  startedAt: number;
}

/** Git status state for one server-authorized workspace path. */
export type GitFileState =
  | "unmodified"
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "typeChanged"
  | "untracked"
  | "ignored"
  | "conflicted"
  | { unknown: string };

export interface GitStatusEntry {
  path: string;
  originalPath?: string;
  index: GitFileState;
  worktree: GitFileState;
  staged: boolean;
  unstaged: boolean;
}

export interface GitStatus {
  workspaceId: string;
  root: string;
  branch?: string;
  head?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  entries: GitStatusEntry[];
}

export interface GitBranchRef {
  name: string;
  target: string;
  upstream?: string;
  remote: boolean;
}

/** Tagged diff target. Branch names are carried only by `compare`. */
export type GitDiffTarget =
  | { kind: "workingTree" }
  | { kind: "staged" }
  | { kind: "head" }
  | { kind: "compare"; base: string; head?: string };

export type GitDiffFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "typeChanged"
  | "binary";

export type GitDiffLineKind = "context" | "addition" | "deletion";

export interface GitDiffLine {
  kind: GitDiffLineKind;
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface GitDiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: GitDiffLine[];
}

export interface GitDiffFile {
  oldPath?: string;
  newPath?: string;
  status: GitDiffFileStatus;
  hunks: GitDiffHunk[];
  isBinary: boolean;
}

export interface GitActionReceipt {
  workspaceId: string;
  action: "stage" | "unstage" | "discard" | "commit";
  paths: string[];
  status: GitStatus;
  commitId?: string;
}

export interface GitPreviewReceipt {
  previewId: string;
  operation: string;
  workspaceId: string;
  paths: string[];
  status: GitStatus;
  message?: string;
  expiresAt: number;
}

export type GitDiscardMode = "worktree" | "staged" | "all";

export type ReviewSide = "old" | "new" | "file";

export interface ReviewLineRange {
  start: number;
  end: number;
}

export type ReviewAnchorConfidence = "none" | "low" | "medium" | "high" | "exact";
export type ReviewStatus = "unresolved" | "resolved" | "stale" | "orphaned";

export interface ReviewAnchor {
  path: string;
  side: ReviewSide;
  base: GitDiffTarget;
  baseRevision: string;
  range: ReviewLineRange;
  before: string[];
  selected: string[];
  after: string[];
}

export interface ReviewComment {
  id: string;
  workspaceId: string;
  sessionId?: string;
  agentId?: string;
  path: string;
  base: GitDiffTarget;
  baseRevision: string;
  side: ReviewSide;
  range: ReviewLineRange;
  body: string;
  anchor: ReviewAnchor;
  status: ReviewStatus;
  anchorConfidence: ReviewAnchorConfidence;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface ReviewPacketComment {
  commentId: string;
  version: number;
  path: string;
  side: ReviewSide;
  range: ReviewLineRange;
  body: string;
  snippetBefore: string[];
  snippet: string[];
  snippetAfter: string[];
  anchorConfidence: ReviewAnchorConfidence;
}

export interface ReviewPacket {
  packetId: string;
  idempotencyKey: string;
  sendOperationId: string;
  workspaceId: string;
  targetSessionId?: string;
  targetAgentId?: string;
  currentRevision: string;
  comments: ReviewPacketComment[];
  markdown: string;
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

/** Ask the server which slash commands / skills the agent CLIs know about in
 * this session's cwd, for composer autocomplete. The server probes the CLIs
 * (cached per host+cwd for a few minutes) and answers with the server-side
 * `commands.list` (`CommandsListResponseMessage`). Note: "commands.list"
 * appears in both directions — the union context disambiguates. */
export interface CommandsListMessage {
  type: "commands.list";
  sessionId: string;
}

/** Server-owned shell identity; no client mount starts a replacement process. */
export interface WorkspaceTerminal {
  id: string;
  sessionId: string;
  workspaceId: string;
  paneId: string;
  cwd: string;
  cols: number;
  rows: number;
  backend: string;
  state: string;
  exitCode?: number;
}
export interface TerminalOpenMessage {
  type: "terminal.open";
  requestId: string;
  sessionId: string;
  paneId: string;
  viewId: string;
  cols: number;
  rows: number;
}
export interface TerminalListMessage {
  type: "terminal.list";
  requestId: string;
  sessionId: string;
}
export interface TerminalReleaseMessage {
  type: "terminal.release";
  terminalId: string;
  viewId: string;
}
export interface TerminalCloseMessage {
  type: "terminal.close";
  requestId: string;
  sessionId: string;
  terminalId: string;
}
export interface TerminalOpenedMessage {
  type: "terminal.opened";
  requestId: string;
  terminal: WorkspaceTerminal;
  replay: string;
}
export interface TerminalListResultMessage {
  type: "terminal.list.result";
  requestId: string;
  sessionId: string;
  terminals: WorkspaceTerminal[];
}
export interface TerminalClosedMessage {
  type: "terminal.closed";
  requestId: string;
  sessionId: string;
  terminalId: string;
}

/** Canonical open resources (capability `surface.v1`). Identity is
 * host + workspace + kind + locator; files and diffs need no chat session.
 * Opening a file/diff adds a tab only for the opening viewer; terminals are
 * global runtimes that exist by being started (and are closed with
 * `terminal.close`). Nothing here starts a process or drops a draft. */
export type SurfaceKind = "terminal" | "file" | "diff";
/** File: `path` (workspace-relative). Diff: `diff`. Terminal: `sessionId`,
 * plus `paneId` for a shell pane (absent = the session's agent terminal). */
export interface SurfaceLocator {
  path?: string;
  sessionId?: string;
  paneId?: string;
  diff?: GitDiffTarget;
}
export interface SurfaceDescriptor {
  id: string;
  hostId: string;
  workspaceId: string;
  kind: SurfaceKind;
  locator: SurfaceLocator;
  /** Shell panes only: the pane's runtime and lifecycle (`starting`, `running`,
   * `exited`, `lost`). A view shows exited/lost as such and never relaunches.
   * An agent terminal carries none: its liveness is the lifecycle registry's. */
  runtime?: { id: string; state: string };
  createdAt: number;
}
/** One viewer's arrangement of one workspace. `order` already holds exactly
 * the existing resources; `layout` is the client's own versioned blob. */
export interface ViewerPresentation {
  viewerId: string;
  workspaceId: string;
  revision: number;
  order: string[];
  activeResourceId?: string;
  layout?: unknown;
  /** Verbatim pre-migration per-session layouts, by session id. */
  legacyLayouts?: Record<string, unknown>;
}
export interface PresentationUpdate {
  /** The `revision` this was made against; a stale one fails with `surface_conflict`. */
  baseRevision?: number;
  order: string[];
  activeResourceId?: string;
  layout?: unknown;
}
export interface SurfaceOpenMessage {
  type: "surface.open";
  requestId: string;
  viewerId: string;
  workspaceId: string;
  kind: SurfaceKind;
  locator?: SurfaceLocator;
}
export interface SurfaceListMessage {
  type: "surface.list";
  requestId: string;
  workspaceId: string;
}
export interface SurfaceCloseMessage {
  type: "surface.close";
  requestId: string;
  viewerId: string;
  workspaceId: string;
  resourceId: string;
}
export interface ViewerPresentationGetMessage {
  type: "viewer.presentation.get";
  requestId: string;
  viewerId: string;
  workspaceId: string;
}
export interface ViewerPresentationSetMessage {
  type: "viewer.presentation.set";
  requestId: string;
  viewerId: string;
  workspaceId: string;
  presentation: PresentationUpdate;
}
/** One-time import of this viewer's legacy file tabs / tab order; repeating it changes nothing. */
export interface SurfaceImportMessage {
  type: "surface.import";
  requestId: string;
  viewerId: string;
  workspaceId: string;
  files?: string[];
  sessionOrder?: string[];
}
export interface SurfaceOpenedMessage {
  type: "surface.opened";
  requestId: string;
  surface: SurfaceDescriptor;
}
export interface SurfaceListResultMessage {
  type: "surface.list.result";
  requestId: string;
  workspaceId: string;
  surfaces: SurfaceDescriptor[];
}
export interface SurfaceClosedMessage {
  type: "surface.closed";
  requestId: string;
  workspaceId: string;
  resourceId: string;
}
/** Reply to `viewer.presentation.get|set` and `surface.import`. */
export interface ViewerPresentationMessage {
  type: "viewer.presentation";
  requestId: string;
  presentation: ViewerPresentation;
}

/** Explicit confirmed launch, never PTY input. Local-only; `workspace.run.v1`. */
export interface WorkspaceRunMessage {
  type: "workspace.run";
  /** UUID; the core durably refuses to execute the same request twice. */
  requestId: string;
  workspaceId: string;
  command: string;
}
export interface WorkspaceRunStartedMessage {
  type: "workspace.run.started";
  requestId: string;
  sessionId: string;
}

export interface AgentTerminalOpenMessage {
  type: "agent.terminal.open";
  requestId: string;
  sessionId: string;
  providerId: string;
  viewId: string;
  cols: number;
  rows: number;
}
export interface AgentTerminalReleaseMessage {
  type: "agent.terminal.release";
  sessionId: string;
  providerId: string;
  viewId: string;
}
export interface AgentTerminalOpenedMessage {
  type: "agent.terminal.opened";
  requestId: string;
  terminalId: string;
  status: AgentLifecycleStatus;
  replay: string;
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
  /** Generation token when this terminal has explicit input ownership. */
  generation?: number;
  /** With terminal.sharedInput, type from a live attached view without taking the resize/stop lease. */
  shared?: boolean;
}

export interface TerminalResizeMessage {
  type: "terminal.resize";
  terminalId: string;
  cols: number;
  rows: number;
  /** Generation token when this terminal has explicit resize ownership. */
  generation?: number;
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

export interface AgentManifestListMessage {
  type: "agent.manifest.list";
  requestId: string;
  /** Omit for this Perch instance; set to a configured hub host id to query it. */
  hostId?: string;
}

/** The models each installed harness on this machine offers. Gated by `agent.models.list`. */
export interface AgentModelsListMessage {
  type: "agent.models.list";
  requestId: string;
}

/** One model a harness offers: `id` is what its `--model` takes. */
export interface HarnessModel {
  id: string;
  label: string;
}

/** An installed harness (`claude`, `codex`, `pi`, `omp`); `models` is empty when it could not be listed. */
export interface HarnessModels {
  id: string;
  models: HarnessModel[];
}

export interface AgentProviderConfigureMessage {
  type: "agent.provider.configure";
  requestId: string;
  hostId?: string;
  providerId: string;
  enabled?: boolean;
  isDefault?: boolean;
}

export interface AgentLifecycleGetMessage {
  type: "agent.lifecycle.get";
  requestId: string;
  sessionId: string;
  workspaceId?: string;
  agentId?: string;
}

export type AgentControlChannel = "input" | "resize";

export interface AgentControlAcquireMessage {
  type: "agent.control.acquire";
  requestId: string;
  sessionId: string;
  workspaceId?: string;
  agentId: string;
  channel: AgentControlChannel;
  /** With terminal.sharedInput, automatic recovery must not steal a lease. */
  ifUnowned?: boolean;
}

export interface AgentControlReleaseMessage {
  type: "agent.control.release";
  requestId: string;
  sessionId: string;
  workspaceId?: string;
  agentId: string;
  channel: AgentControlChannel;
  generation: number;
}

/** Request the server to push a fresh `session.list` response.
 * Note: "session.list" appears in both directions — as a client request here
 * and as a server response (SessionListResponseMessage). The union context
 * disambiguates which direction is intended. */
export interface SessionListMessage {
  type: "session.list";
}

/** Ask for the current `attention.snapshot` (capability `attention.v1`). */
export interface AttentionListMessage {
  type: "attention.list";
}

/** Mark attention events read, or (`dismiss`) hide them. A live question is
 * never dismissed: it clears when the agent is answered. */
export interface AttentionUpdateMessage {
  type: "attention.update";
  ids: string[];
  dismiss?: boolean;
}

/** Note a page shown in the built-in browser (capability `browser.history.v1`). `visit`
 * counts a new visit; otherwise only a non-empty `title` refreshes the entry. The core keeps
 * plain http(s) addresses only, without fragments. */
export interface BrowserHistoryRecordMessage {
  type: "browser.history.record";
  url: string;
  title?: string;
  visit?: boolean;
}

/** Address-bar suggestions: pages matching `query` (every word in the address or title), best
 * first; the most recent pages when `query` is empty. Answered with `browser.history.result`. */
export interface BrowserHistorySearchMessage {
  type: "browser.history.search";
  requestId: string;
  query?: string;
  limit?: number;
}

/** Address-bar search suggestions from the user's search engine, fetched by the core
 * (capability `browser.suggest.v1`). Answered with `browser.suggest.result`, empty unless the
 * `browserSearchSuggestions` setting is on and `query` is not an address. */
export interface BrowserSuggestMessage {
  type: "browser.suggest";
  requestId: string;
  query: string;
}

/** The family of a session: the other members of its run and what each is doing (capability
 * `crew.v1`). Answered with `crew.state`; a session outside any run gets no rows. */
export interface CrewGetMessage {
  type: "crew.get";
  requestId: string;
  sessionId: string;
}

/** The suggested-task cards of a lead's chat (capability `suggestions.v1`). Answered with `suggestions.state`. */
export interface SuggestionsGetMessage {
  type: "suggestions.get";
  requestId: string;
  sessionId: string;
}

/** A person's action on a suggested task (capability `suggestions.v1`): `start` (one task, with optional
 * `agent`, `model` and `worktree` chosen in Options), `start_all` (every waiting task of the card),
 * `handed` (the chat sent the task to the lead as the person's own message; this only records it) or
 * `dismiss` (one task, or the whole card without `suggestionId`). `generation` is the chat's input
 * lease, as for typing in it. Answered with `suggestion.act.result`. */
export interface SuggestionActMessage {
  type: "suggestion.act";
  requestId: string;
  sessionId: string;
  action: string;
  cardId: string;
  suggestionId?: string;
  generation: number;
  agent?: string;
  model?: string;
  worktree?: boolean;
}

/** One task of a suggested-task card. `state` is `pending`, `starting`, `started` (then `childSessionId` and
 * `dispatch` say where its sub-session is), `handed` or `dismissed`; `reason` is why Start did not start it. */
export interface SuggestionItem {
  id: string;
  task: string;
  agent: string;
  model?: string;
  worktree: boolean;
  state: string;
  childSessionId?: string;
  dispatch?: string;
  reason?: string;
}

/** The tasks one `perch suggest` put in front of the person. */
export interface SuggestionCard {
  id: string;
  items: SuggestionItem[];
}

/** What a `suggestion.act` did to one task: `started`, `refused`, `handed` or `dismissed`. */
export interface SuggestionResult {
  suggestionId: string;
  outcome: string;
  reason?: string;
  childSessionId?: string;
}

/** Reply to `suggestions.get`: the cards still worth showing, oldest first. */
export interface SuggestionsStateMessage {
  type: "suggestions.state";
  requestId: string;
  sessionId: string;
  cards: SuggestionCard[];
  error?: string;
}

/** Reply to `suggestion.act`. `outcome`: `started` (every task asked for was started), `partial` (some were;
 * `results` says which and why not), `refused` (nothing was done; `reason` says why), `handed` or `dismissed`. */
export interface SuggestionActResultMessage {
  type: "suggestion.act.result";
  requestId: string;
  sessionId: string;
  action: string;
  outcome: string;
  reason?: string;
  results?: SuggestionResult[];
}

/** Broadcast when a lead's suggested-task cards changed; clients showing that chat ask again. */
export interface SuggestionsChangedMessage {
  type: "suggestions.changed";
  sessionId: string;
}

/** What a session does with messages from other sessions, and what it holds for its person (capability
 * `inbound.v1`). Answered with `inbound.state`. */
export interface InboundGetMessage {
  type: "inbound.get";
  requestId: string;
  sessionId: string;
}

/** A person's action on a session's inbound control: `set_mode` (with `mode`: `accept`, `hold` or `refuse`),
 * `deliver` or `discard` (one held message, `messageId`), `deliver_all` or `discard_all`. Delivering and
 * discarding need the chat's input lease (`generation`), as typing in it does; the mode does not. Answered
 * with `inbound.act.result`. */
export interface InboundActMessage {
  type: "inbound.act";
  requestId: string;
  sessionId: string;
  action: string;
  mode?: string;
  messageId?: string;
  generation?: number;
}

/** A message another session sent that this session's person has not answered. `text` is cut to a preview
 * when the message was long (`truncated`). */
export interface HeldMessage {
  id: string;
  fromSessionId: string;
  fromProvider: string;
  fromLabel: string;
  text: string;
  truncated?: boolean;
  at: number;
}

/** Reply to `inbound.get`: the session's mode (`accept`, `hold`, `refuse`) and what it holds, oldest first. */
export interface InboundStateMessage {
  type: "inbound.state";
  requestId: string;
  sessionId: string;
  mode: string;
  held: HeldMessage[];
  error?: string;
}

/** Reply to `inbound.act`. `outcome`: `done` or `refused` (nothing changed; `reason` says why); `count` is
 * how many messages the action moved. */
export interface InboundActResultMessage {
  type: "inbound.act.result";
  requestId: string;
  sessionId: string;
  action: string;
  outcome: string;
  reason?: string;
  count?: number;
}

/** Broadcast when a session's inbound mode or held messages changed; clients showing it ask again. */
export interface InboundChangedMessage {
  type: "inbound.changed";
  sessionId: string;
}

/** One member of a session's run for the family strip. What it is doing is four records, never one
 * status word: `lifecycle` (Perch's runtime), `needsYou` (a pending approval or question),
 * `latest.receipt` (the delivery state of the last message) and `report` (the agent's own claim). */
export interface CrewRow {
  sessionId: string;
  /** `manager`, `worker` or `peer`: how it relates to the session asked about. */
  role: string;
  title: string;
  provider: string;
  /** `working`, `idle`, `done`, `blocked`, `exited`, … or `unknown` (not idle). */
  lifecycle: string;
  /** A child's dispatch record: `running`, `stopped`, `exited`, `start_unknown`, … */
  dispatch?: string;
  /** What a child was asked to do. */
  task?: string;
  needsYou?: CrewNeedsYou;
  report?: CrewReport;
  latest?: CrewLatest;
  /** A message to it would be accepted now. */
  canMessage: boolean;
  /** What a person may do to this child from the strip, each with the reason it is not offered
   * (capability `crew.actions.v1`). Only a lead's `worker` rows have it. */
  actions?: CrewActions;
}

/** The four family-strip actions on a child and whether each is available now. */
export interface CrewActions {
  message: CrewActionState;
  steer: CrewActionState;
  interrupt: CrewActionState;
  stop: CrewActionState;
}

export interface CrewActionState {
  ok: boolean;
  /** Why it is not available; absent when it is. */
  reason?: string;
}

export interface CrewNeedsYou {
  preview: string;
  at: number;
}

/** An agent's own claim, never proof. `source` is `report` (its `perch report`) or `last-message`
 * (a fallback: the start of its last message). */
export interface CrewReport {
  text: string;
  /** `report` (its own), `summary` (a cheap model's, named in `model`) or `last-message`. */
  source: string;
  at: number;
  model?: string;
}

/** The newest message between the two, with its receipt (`queued`, `delivering`, `delivered`,
 * `unconfirmed`, `undelivered` and, when it waits or failed, why). */
export interface CrewLatest {
  /** `to` when the asked-about session sent it, `from` when it received it. */
  direction: string;
  preview: string;
  at: number;
  receipt: string;
  reason: string;
  /** How a delivered message reached the agent: `queued_in_agent` (in its CLI's follow-up queue) or
   * `steered`; absent when it started a turn, and from an older core. */
  handoff?: string;
  /** `message` or `steer`; absent from an older core, which means `message`. */
  kind?: string;
}

/** Act on one of a lead's sub-sessions from its family strip (capability `crew.actions.v1`):
 * `message` (handed over at once: an idle agent starts a turn, a busy one's follow-up queue takes it),
 * `steer` (into its running turn), `interrupt` (stop its current
 * turn) or `stop` (confirmed). `sessionId` is the lead whose chat shows the strip and `generation`
 * that chat's input lease, as for typing in it. Answered with `crew.act.result` (a `sent` result may
 * precede the final one). Nothing here is ever retried. */
export interface CrewActMessage {
  type: "crew.act";
  requestId: string;
  sessionId: string;
  childSessionId: string;
  action: string;
  generation: number;
  text?: string;
}

/** Reply to `crew.act`. `outcome`: `queued`, `sent` (handed to the provider, its answer awaited, not
 * final), `confirmed`, `not_confirmed` (it may have taken effect; never retried) or `refused`
 * (nothing was done; `reason` says why). `done` is false only for `sent`. */
export interface CrewActResultMessage {
  type: "crew.act.result";
  requestId: string;
  sessionId: string;
  childSessionId: string;
  action: string;
  outcome: string;
  reason?: string;
  done: boolean;
}

/** Reply to `crew.get`: the session's family, newest traffic first. */
export interface CrewStateMessage {
  type: "crew.state";
  requestId: string;
  sessionId: string;
  rows: CrewRow[];
  error?: string;
}

/** Who wrote a memory file: `person`, `agent` (`session` is its session id) or `outside` (the
 * content on disk is not what Perch recorded: edited outside Perch). */
export interface MemoryAuthor {
  kind: "person" | "agent" | "mod" | "outside";
  session?: string;
  label: string;
}

/** One file in a Project's memory index. `revision` is a short content hash; `updatedAt` is in
 * milliseconds; `summary` is the first non-empty line, cut short. */
export interface MemoryEntry {
  name: string;
  size: number;
  revision: string;
  author: MemoryAuthor;
  updatedAt: number;
  summary: string;
}

export interface MemoryFile {
  entry: MemoryEntry;
  text: string;
}

/** The mods on this core (capability `mods.v1`). Answered with `mods.state`. */
export interface ModsListMessage {
  type: "mods.list";
  requestId: string;
}

/** A person's change to one mod: `enable` or `disable`; `layout` chooses the layout named `id` (an
 * empty `id` goes back to stock Perch). Answered with `mods.state`. */
export interface ModsSetMessage {
  type: "mods.set";
  requestId: string;
  id: string;
  op: "enable" | "disable" | "layout";
}

/** The person's page says whether it loaded a mod's `revision` (capability `mods.report.v1`);
 * `error` is why not. No reply: `perch mod check` reads it. */
export interface ModsReportMessage {
  type: "mods.report";
  id: string;
  revision: string;
  error?: string | null;
}

/** The index of a Project's memory files on this core (capability `memory.v1`). Answered with
 * `memory.state`. */
export interface MemoryListMessage {
  type: "memory.list";
  requestId: string;
  projectId: string;
}

/** One memory file's text. Answered with `memory.file`. */
export interface MemoryGetMessage {
  type: "memory.get";
  requestId: string;
  projectId: string;
  name: string;
}

/** Create or replace one memory file as a person. `baseRevision` is the revision that was read;
 * absent means the file must not exist yet. A stale base is refused with `conflict`, never
 * overwritten. Answered with `memory.state`. */
export interface MemorySetMessage {
  type: "memory.set";
  requestId: string;
  projectId: string;
  name: string;
  text: string;
  baseRevision?: string;
}

/** Delete one memory file as a person, only if it is still at `baseRevision`. Answered with
 * `memory.state`. */
export interface MemoryDeleteMessage {
  type: "memory.delete";
  requestId: string;
  projectId: string;
  name: string;
  baseRevision: string;
}

/** Read the Instructions of a Project (`scope: "project"`) or Workspace (`"workspace"`) on this core
 * (capability `instructions.v1`). Answered with `instructions.state`. */
export interface InstructionsGetMessage {
  type: "instructions.get";
  requestId: string;
  scope: string;
  id: string;
}

/** Save a Project's or Workspace's Instructions (text and reference folders). New sessions there
 * launch with them; running sessions keep what they started with. Answered with
 * `instructions.state`, which carries `error` and the unchanged content when refused. */
export interface InstructionsSetMessage {
  type: "instructions.set";
  requestId: string;
  scope: string;
  id: string;
  text: string;
  folders?: string[];
}

/** Forget one page. */
export interface BrowserHistoryRemoveMessage {
  type: "browser.history.remove";
  url: string;
}

/** Forget every page. */
export interface BrowserHistoryClearMessage {
  type: "browser.history.clear";
}

// Stage D — settings & hosts client messages

/**
 * One device paired with this host. Only the token's hash is ever stored, so
 * this summary is safe to show to any authorized client.
 */
export interface DeviceSummary {
  id: string;
  name: string;
  createdAt: number;
  lastSeenAt: number;
}

/** Offer a pairing code another device can claim at `POST {base}pair`. */
export interface DevicePairStartMessage {
  type: "device.pair.start";
  requestId: string;
}
export interface DevicePairCancelMessage {
  type: "device.pair.cancel";
  requestId: string;
}
export interface DeviceListMessage {
  type: "device.list";
  requestId: string;
}
/** Ask whether phones can reach this host, and where. */
export interface PhoneAccessGetMessage {
  type: "phone.access.get";
  requestId: string;
}
/** One URL a phone can open to reach this host: the same Wi-Fi (`lan`), the
 * tailnet, or the relay (`relay`: carries a #fragment key, so a pairing code is
 * appended with `&pair=`, not `#pair=`). */
export interface PhoneAddress {
  kind: "lan" | "tailscale" | "relay";
  url: string;
}
/** The relay connection; absent while no relay address is set. */
export interface RelayInfo {
  state: "connecting" | "online" | "error";
  message?: string;
}
/** Whether phones can reach this host and where. `alwaysOn`: the main
 * listener already serves the LAN (headless), so there is no switch.
 * `addresses` is empty while access is off; an empty `requestId` is a push
 * after the setting changed. */
export interface PhoneAccessStatusMessage {
  type: "phone.access.status";
  requestId: string;
  enabled: boolean;
  alwaysOn: boolean;
  addresses: PhoneAddress[];
  /** This machine's Tailscale; absent while access is off (and from older cores). */
  tailscale?: "missing" | "needsLogin" | "stopped" | "running";
  /** The relay, when an address is set; its link is also in `addresses`. Absent from older cores. */
  relay?: RelayInfo;
  /** The relay this build offers behind one switch; absent when it has none. */
  defaultRelay?: string;
  error?: string;
}
/** Revoke one paired device; its token stops working immediately. */
export interface DeviceRevokeMessage {
  type: "device.revoke";
  requestId: string;
  deviceId: string;
}
export interface DevicePairCodeMessage {
  type: "device.pair.code";
  requestId: string;
  code: string;
  expiresInMs: number;
}
export interface DeviceListResultMessage {
  type: "device.list.result";
  requestId: string;
  devices: DeviceSummary[];
}

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

/** Permanently delete a session: its messages, its DB row, any in-flight
 * turn, its agent and its shells. Closing a tab sends this. */
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

/** Ask the local server for plan usage; reply is `usage.result`.
 * `force` bypasses the short server cache for a user-requested refresh. */
export interface UsageGetMessage {
  type: "usage.get";
  force?: boolean;
}

/** Spend one banked Codex reset on the account with this `accountId`; reply
 * is `usage.redeemResult`. Refused for paired phones. */
export interface UsageRedeemResetMessage {
  type: "usage.redeemReset";
  accountId: string;
}

/** One rolling rate-limit window. `label` is derived from the duration
 * ("5h", "7d"). `resetsAt` is an ISO string (Claude) or epoch seconds
 * (Codex), as the provider reported it. */
export interface UsageWindow {
  label: string;
  usedPercent: number;
  windowMinutes: number;
  resetsAt?: string | number;
  /** What a narrower limit applies to (a model name); absent for the
   * account-wide window. */
  scope?: string;
}

/** One provider login. `label` tells accounts apart (email, dir suffix, or
 * configured in `~/.perch/usage-accounts.json`). */
export interface AccountUsage {
  provider: string;
  label?: string;
  /** Subscription tier, e.g. "Max 5×" or "Plus". */
  plan?: string;
  /** The plan's monthly price in US dollars, when the price list knows it. */
  planMonthlyUsd?: number;
  windows: UsageWindow[];
  /** Banked Codex rate-limit resets still redeemable. */
  resetCredits?: number;
  /** Stable id of the account (`codex:<12 hex>`); what `usage.redeemReset` names. */
  accountId?: string;
  error?: string;
}

/** A provider, model or project's part of the spend in a period. */
export interface SpendShare {
  name: string;
  /** Set on model shares. */
  provider?: string;
  costUsd: number;
  tokens: number;
}

/** API-equivalent spend over the last `days` local calendar days (today included). */
export interface SpendPeriod {
  days: number;
  costUsd: number;
  /** Dollars the cache reads avoided versus plain input rates. */
  savedUsd: number;
  /** Input, cache and output tokens (reasoning not added). */
  tokens: number;
  /** Records with neither a list price nor a recorded cost. */
  unpriced: number;
  providers: SpendShare[];
  /** Top 5. */
  models: SpendShare[];
  /** Top 5. */
  projects: SpendShare[];
}

/** The Claude 5-hour block still open; epoch seconds. */
export interface SpendBlock {
  start: number;
  end: number;
  costUsd: number;
  tokens: number;
}

/** What local agent logs say was used, priced at API list prices. */
export interface SpendSummary {
  periods: SpendPeriod[];
  block?: SpendBlock;
  /** API-equivalent dollars per hour at the last 30 minutes' pace. */
  burnPerHourUsd?: number;
  /** `updated` day of the price list used. */
  pricesUpdated: string;
}

/** Reply to `usage.get`; a provider whose fetch failed carries an account error. */
export interface UsageResultMessage {
  type: "usage.result";
  accounts: AccountUsage[];
  /** Absent from older cores. */
  spend?: SpendSummary;
}

/** A usage threshold event, broadcast once to every client (capability
 * `usage.alert.v1`). `kind`: `limit`, `reset` or `budget`. */
export interface UsageAlertMessage {
  type: "usage.alert";
  kind: string;
  title: string;
  body: string;
}

/** Reply to `usage.redeemReset`: `reset`, `nothingToReset`, `noCredit`,
 * `alreadyRedeemed`, else `error` with an optional explanation. */
export interface UsageRedeemResultMessage {
  type: "usage.redeemResult";
  accountId: string;
  outcome: string;
  message?: string;
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

/** List one lazy level of an already-authorized durable workspace. `path` is
 * always relative to that workspace; callers never provide a filesystem root. */
export interface FsTreeMessage {
  type: "fs.tree";
  requestId: string;
  workspaceId: string;
  path?: string;
}

export interface FsSearchMessage {
  type: "fs.search";
  requestId: string;
  workspaceId: string;
  query: string;
}

export interface FsExtractMessage {
  type: "fs.extract";
  requestId: string;
  workspaceId: string;
  path: string;
}

export type FsMutateOp = "createFile" | "createDir" | "rename" | "copy" | "delete";

/** Create / rename / delete one workspace entry; never overwrites. `to` is the
 * new path of a `rename` or `copy`. Failures come back as `fs.error`. */
export interface FsMutateMessage {
  type: "fs.mutate";
  requestId: string;
  workspaceId: string;
  op: FsMutateOp;
  path: string;
  to?: string;
}

export interface FsReadMessage {
  type: "fs.read";
  requestId: string;
  workspaceId: string;
  path: string;
}

export interface FsPreviewMessage {
  type: "fs.preview";
  requestId: string;
  workspaceId: string;
  path: string;
}

/** Which of a chat message's link targets (`hrefs`, as written) name an existing regular file inside
 * the workspace (capability `fs.links`). Answered with `fs.links.result`. */
export interface FsLinksMessage {
  type: "fs.links";
  requestId: string;
  workspaceId: string;
  hrefs: string[];
}

/** Save bounded text only when `expectedVersion` still names the bytes the
 * editor opened. Omitting it is create-only and cannot clobber an existing file. */
export interface FsWriteMessage {
  type: "fs.write";
  requestId: string;
  workspaceId: string;
  path: string;
  content: string;
  expectedVersion?: string;
  expectedBufferRevision?: number;
}

export interface FsBufferListMessage {
  type: "fs.buffer.list";
  requestId: string;
  workspaceId: string;
}

export interface FsBufferGetMessage {
  type: "fs.buffer.get";
  requestId: string;
  workspaceId: string;
  path: string;
}

export interface FsBufferSetMessage {
  type: "fs.buffer.set";
  requestId: string;
  workspaceId: string;
  path: string;
  content: string;
  baseContent?: string;
  expectedBufferRevision?: number;
}

export interface FsBufferCloseMessage {
  type: "fs.buffer.close";
  requestId: string;
  workspaceId: string;
  path: string;
  expectedBufferRevision?: number;
  discard?: boolean;
}

export interface GitStatusMessage {
  type: "git.status";
  requestId: string;
  workspaceId: string;
  /** Restrict lastAgentTurn to this session within the workspace. */
  sessionId?: string;
  hostId?: string;
  includeIgnored?: boolean;
}

export interface GitRefsMessage {
  type: "git.refs";
  requestId: string;
  workspaceId: string;
  hostId?: string;
}

export interface GitDiffMessage {
  type: "git.diff";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  target: GitDiffTarget;
  includeUntracked?: boolean;
  ignoreWhitespace?: boolean;
  contextLines?: number;
  path?: string;
}

export interface GitStageMessage {
  type: "git.stage";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  paths?: string[];
  patch?: string;
}

export interface GitUnstageMessage {
  type: "git.unstage";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  paths?: string[];
  patch?: string;
}

export interface GitDiscardPreviewMessage {
  type: "git.discard.preview";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  mode: GitDiscardMode;
  paths: string[];
}

export interface GitDiscardMessage {
  type: "git.discard";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  previewId: string;
}

export interface GitCommitPreviewMessage {
  type: "git.commit.preview";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  message: string;
}

export interface GitCommitMessage {
  type: "git.commit";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  previewId: string;
  message: string;
}

export interface ReviewListMessage {
  type: "review.list";
  requestId: string;
  workspaceId: string;
  hostId?: string;
}

export interface ReviewCreateMessage {
  type: "review.create";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  id: string;
  sessionId?: string;
  agentId?: string;
  path: string;
  base: GitDiffTarget;
  baseRevision: string;
  side: ReviewSide;
  range: ReviewLineRange;
  body: string;
}

export interface ReviewUpdateMessage {
  type: "review.update";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  commentId: string;
  body: string;
  expectedVersion: number;
}

export interface ReviewResolveMessage {
  type: "review.resolve";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  commentId: string;
  resolved: boolean;
  expectedVersion: number;
}

export interface ReviewDeleteMessage {
  type: "review.delete";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  commentId: string;
  expectedVersion: number;
}

export interface ReviewBatchPreviewMessage {
  type: "review.batch.preview";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  sendOperationId: string;
  targetSessionId?: string;
  targetAgentId?: string;
  currentRevision?: string;
  instruction?: string;
}

export interface ReviewBatchSendMessage {
  type: "review.batch.send";
  requestId: string;
  workspaceId: string;
  hostId?: string;
  packetId: string;
  sendOperationId: string;
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

/** Create a linked worktree for `branch`. Capability `worktree.startFrom`
 * adds: an empty `branch` derived from `name` (the task name, suffixed `-2`…
 * on conflict), and `startFrom`, the new branch's start point (local branch,
 * `remote/branch` — fetched first — or commit; absent = the repo's base ref).
 * `newBranch` is a hint: when the
 * branch already exists locally the existing-branch form is used anyway.
 * `path` overrides the default `~/.perch/worktrees/<repo-name>/<branch-slug>`
 * location. Replies with `worktree.done` or `worktree.error`. */
export interface WorktreeCreateMessage {
  type: "worktree.create";
  requestId: string;
  hostId?: string;
  repoPath: string;
  branch?: string;
  newBranch?: boolean;
  path?: string;
  name?: string;
  startFrom?: string;
  /** Nest the new workspace under this one (capability `workspace.nest`). */
  parentWorkspaceId?: string;
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
  /** Also delete the checkout's branch (capability `worktree.delete`);
   * unmerged work comes back as `preservedBranch`. */
  deleteBranch?: boolean;
}

/** Force-delete a branch a delete preserved, after review. Refused when the
 * branch moved off `expectedHead` or is checked out. */
export interface WorktreeBranchDeleteMessage {
  type: "worktree.branch.delete";
  requestId: string;
  hostId?: string;
  repoPath: string;
  branch: string;
  expectedHead: string;
}

/** Start a background create (capability `worktree.job`, local host only).
 * Same inputs as `worktree.create`; replies at once with
 * `worktree.job.started` or `worktree.error`, then progress arrives as
 * `worktree.jobs` broadcasts. */
export interface WorktreeJobStartMessage {
  type: "worktree.job.start";
  requestId: string;
  repoPath: string;
  branch?: string;
  newBranch?: boolean;
  path?: string;
  name?: string;
  startFrom?: string;
  parentWorkspaceId?: string;
}

/** Cancel a running job: git is killed and anything the job created is removed. */
export interface WorktreeJobCancelMessage {
  type: "worktree.job.cancel";
  jobId: string;
}

/** Re-run a failed job with the same inputs. */
export interface WorktreeJobRetryMessage {
  type: "worktree.job.retry";
  jobId: string;
}

/** Drop a failed job from the list. */
export interface WorktreeJobDismissMessage {
  type: "worktree.job.dismiss";
  jobId: string;
}

// ---------------------------------------------------------------------------
// Project/workspace foundation
// ---------------------------------------------------------------------------

/** Durable project identity, scoped by host and canonical filesystem path. */
export interface ProjectSummary {
  id: string;
  hostId: string;
  name: string;
  path: string;
  repoPath?: string;
  defaultBranch?: string;
  favorite: boolean;
  settings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Durable workspace identity. The initial slice creates one workspace per
 * imported project path; worktree/editor work can add more later. */
export interface WorkspaceSummary {
  id: string;
  projectId: string;
  hostId: string;
  path: string;
  name: string;
  branch?: string;
  baseBranch?: string;
  dirty: boolean;
  startSnapshot?: string;
  parentWorkspaceId?: string;
  state: "active" | "sleeping" | "archived";
  createdAt: number;
  updatedAt: number;
  /** Kept at the top of its project (`workspace.pin`). */
  pinned?: boolean;
  /** A worktree perch discovered but did not create, left out of the
   * sidebar until shown (`workspace.visibility`). */
  hidden?: boolean;
}

export interface ProjectListMessage {
  type: "project.list";
  requestId: string;
  hostId?: string;
}

export interface ProjectCreateMessage {
  type: "project.create";
  requestId: string;
  hostId?: string;
  path: string;
  name?: string;
}

export interface ProjectRenameMessage {
  type: "project.rename";
  requestId: string;
  projectId: string;
  name: string;
}

/** Delete a project and its sessions; the folder stays on disk. */
export interface ProjectRemoveMessage {
  type: "project.remove";
  requestId: string;
  projectId: string;
}

export interface ProjectFocusMessage {
  type: "project.focus";
  requestId: string;
  projectId: string;
}

export interface WorkspaceSnapshotMessage {
  type: "workspace.snapshot";
  requestId: string;
  hostId?: string;
  projectId?: string;
}

export interface WorkspaceFocusMessage {
  type: "workspace.focus";
  requestId: string;
  workspaceId: string;
}

export interface WorkspaceRenameMessage {
  type: "workspace.rename";
  requestId: string;
  workspaceId: string;
  name: string;
}

/** Pin a workspace to the top of its project, or unpin it. */
export interface WorkspacePinMessage {
  type: "workspace.pin";
  requestId: string;
  workspaceId: string;
  pinned: boolean;
}

/** Show or hide a linked worktree's workspace in the sidebar. */
export interface WorkspaceVisibilityMessage {
  type: "workspace.visibility";
  requestId: string;
  workspaceId: string;
  hidden: boolean;
}

/** Nest a linked worktree's workspace under another of the same project
 * (sidebar grouping only); absent `parentWorkspaceId` = top level. */
export interface WorkspaceNestMessage {
  type: "workspace.nest";
  requestId: string;
  workspaceId: string;
  parentWorkspaceId?: string;
}

/** Replace the core's sidebar order (capability `workspace.order.v1`). Each
 * list that is present replaces the stored one (last write wins); absent
 * lists are untouched. Answered by a `workspace.order` broadcast. */
export interface WorkspaceOrderSetMessage {
  type: "workspace.order.set";
  requestId: string;
  hostId?: string;
  projects?: string[];
  sessions?: string[];
}

export interface WorkspaceRestoreMessage {
  type: "workspace.restore";
  requestId: string;
  workspaceId: string;
}

export type ClientMessage =
  | ContextPreviewMessage
  | ContextSendMessage
  | SessionCreateMessage
  | SessionSubscribeMessage
  | SessionResumeMessage
  | SessionListMessage
  | AttentionListMessage
  | BrowserHistoryRecordMessage
  | BrowserHistorySearchMessage
  | BrowserSuggestMessage
  | InstructionsGetMessage
  | ModsListMessage
  | ModsSetMessage
  | ModsReportMessage
  | ModsSnapshotMessage
  | MemoryListMessage
  | MemoryGetMessage
  | CrewGetMessage
  | CrewActMessage
  | SuggestionsGetMessage
  | SuggestionActMessage
  | InboundGetMessage
  | InboundActMessage
  | InstructionsSetMessage
  | MemorySetMessage
  | MemoryDeleteMessage
  | BrowserHistoryRemoveMessage
  | BrowserHistoryClearMessage
  | AttentionUpdateMessage
  | CommandsListMessage
  | TerminalOpenMessage
  | TerminalListMessage
  | TerminalReleaseMessage
  | TerminalCloseMessage
  | SurfaceOpenMessage
  | SurfaceListMessage
  | SurfaceCloseMessage
  | ViewerPresentationGetMessage
  | ViewerPresentationSetMessage
  | SurfaceImportMessage
  | AgentTerminalOpenMessage
  | AgentTerminalReleaseMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalKillMessage
  | AgentManifestListMessage
  | AgentModelsListMessage
  | AgentProviderConfigureMessage
  | AgentUiGetMessage
  | AgentUiFindMessage
  | AgentUiDraftMessage
  | AgentUiOlderMessage
  | AgentUiOptionMessage
  | AgentUiPromptMessage
  | AgentUiAnswerMessage
  | AgentUiCancelMessage
  | AgentLifecycleGetMessage
  | AgentControlAcquireMessage
  | AgentControlReleaseMessage
  | DevicePairStartMessage
  | DevicePairCancelMessage
  | DeviceListMessage
  | PhoneAccessGetMessage
  | DeviceRevokeMessage
  | SettingsGetMessage
  | SettingsUpdateMessage
  | HostsListMessage
  | HostsUpsertMessage
  | HostsDeleteMessage
  | SessionDeleteMessage
  | SessionLayoutGetMessage
  | SessionLayoutSetMessage
  | SessionRenameMessage
  | FsBrowseMessage
  | UsageGetMessage
  | UsageRedeemResetMessage
  | FsTreeMessage
  | WorkspaceRunMessage
  | FsSearchMessage
  | FsExtractMessage
  | FsMutateMessage
  | FsReadMessage
  | FsPreviewMessage
  | FsLinksMessage
  | FsWriteMessage
  | FsBufferListMessage
  | FsBufferGetMessage
  | FsBufferSetMessage
  | FsBufferCloseMessage
  | GitStatusMessage
  | GitRefsMessage
  | GitDiffMessage
  | GitStageMessage
  | GitUnstageMessage
  | GitDiscardPreviewMessage
  | GitDiscardMessage
  | GitCommitPreviewMessage
  | GitCommitMessage
  | ReviewListMessage
  | ReviewCreateMessage
  | ReviewUpdateMessage
  | ReviewResolveMessage
  | ReviewDeleteMessage
  | ReviewBatchPreviewMessage
  | ReviewBatchSendMessage
  | WorktreeListMessage
  | WorktreeCreateMessage
  | WorktreeRemoveMessage
  | WorktreeJobStartMessage
  | WorktreeBranchDeleteMessage
  | WorkspacePinMessage
  | WorkspaceVisibilityMessage
  | WorkspaceNestMessage
  | WorkspaceOrderSetMessage
  | WorktreeJobCancelMessage
  | WorktreeJobRetryMessage
  | WorktreeJobDismissMessage
  | ProjectListMessage
  | ProjectCreateMessage
  | ProjectRenameMessage
  | ProjectRemoveMessage
  | ProjectFocusMessage
  | WorkspaceSnapshotMessage
  | WorkspaceFocusMessage
  | WorkspaceRenameMessage
  | WorkspaceRestoreMessage;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface SessionCreatedMessage {
  type: "session.created";
  sessionId: string;
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
  /** Read from the running CLI, so built-ins only until it is up. Absent from older cores. */
  pi?: CommandEntry[];
  omp?: CommandEntry[];
}

export interface AgentManifestListResponseMessage {
  type: "agent.manifest.list";
  requestId: string;
  /** Authenticated origin host; local replies use `local`. */
  hostId?: string;
  manifests: AgentManifestSummary[];
  revision?: number;
}

export interface AgentModelsListResponseMessage {
  type: "agent.models.list";
  requestId: string;
  harnesses: HarnessModels[];
}

export interface AgentLifecycleMessage {
  type: "agent.lifecycle";
  requestId: string;
  status: AgentLifecycleStatus;
}

export interface AgentLifecycleChangedMessage {
  type: "agent.lifecycle.changed";
  hostId: string;
  status: AgentLifecycleStatus;
}

export interface AgentControlMessage {
  type: "agent.control";
  requestId: string;
  sessionId: string;
  agentId: string;
  channel: AgentControlChannel;
  lease?: AgentControlLease;
  status?: AgentLifecycleStatus;
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
  requestId?: string;
  code?: string;
  retryable?: boolean;
}

/** Server response to a client `session.list` request — carries the full
 * list of sessions known to the server. Note: "session.list" appears in
 * both directions; here it is the server response form. */
export interface SessionListResponseMessage {
  type: "session.list";
  sessions: SessionSummary[];
}

/** Pushed by the server whenever a session's metadata changes (e.g. status
 * transitions idle→running). Also sent after session.created. */
export interface SessionUpdatedMessage {
  type: "session.updated";
  session: SessionSummary;
}

/** One durable attention event (`server/attention.rs`). `kind`: `question`
 * (Needs You until answered), `failed` (Needs You until the next turn),
 * `finished` / `exited` (Recent updates). `certainty`: `verified`,
 * `heuristic` (title/output guess) or `unconfirmed` (evidence predates a
 * restart). Read is not resolved. */
export interface AttentionEvent {
  id: string;
  sessionId: string;
  workspaceId?: string;
  projectId?: string;
  agentId: string;
  kind: "question" | "failed" | "finished" | "exited" | (string & {});
  requiresAction: boolean;
  certainty: "verified" | "heuristic" | "unconfirmed" | (string & {});
  summary: string;
  occurredAt: number;
  /** Unread turns folded into this row. */
  count: number;
  read: boolean;
  /** Files the agent's last recorded turn changed (finished events only). */
  changedPathCount?: number;
  changedPaths?: string[];
}

/** One remembered page of the built-in browser. */
export interface BrowserHistoryEntry {
  url: string;
  title: string;
}

/** Reply to `browser.suggest`: the engine's completions, best first. */
export interface BrowserSuggestResultMessage {
  type: "browser.suggest.result";
  requestId: string;
  suggestions: string[];
}

/** A mod: a folder with a `main.js` that Perch's own page runs with the person's full access. */
export interface ModInfo {
  id: string;
  name: string;
  description: string;
  /** Where it shows: docked as a pane, over the app, or nowhere (it only runs). */
  place: "dock" | "overlay" | "none";
  enabled: boolean;
  /** Changes whenever the mod's files do, so an open mod reloads when it is edited. */
  revision: string;
  /** Why the folder cannot be loaded, if it cannot. */
  error: string | null;
}

/** `{px}` (fixed) or `{weight}` (a share of what fixed siblings leave; default 1). */
export interface LayoutSize {
  px?: number;
  weight?: number;
}

/** A window layout, as in herdr's desktop app: a tree of rows, columns and blocks. A block's
 * `content` is `sidebar`, `tabs`, `canvas`, `files`, `git`, `status`, `mod:<id>` or `terminal:<session id>`. */
export type LayoutNode =
  | (LayoutLook & { type: "row" | "column"; size?: LayoutSize | null; hidden?: boolean; gap?: number; padding?: number; children: LayoutNode[] })
  | (LayoutLook & { type: "block"; size?: LayoutSize | null; hidden?: boolean; padding?: number; content: string });

/** A node's look; the nearest one up the tree wins (the root's restyles the whole app). `theme` is a
 * name from the app's themes, `colors` overrides palette tokens (`accent`, `panelBg`, `surface0`,
 * `surface1`, `surfaceDim`, `overlay0`, `overlay1`, `text`, `subtext0`, `mauve`, `green`, `yellow`,
 * `red`, `blue`, `teal`, `peach`, and the window `backdrop`) with `#rrggbb`, `font` is a CSS
 * font-family, `radius` rounds cards and `border` outlines them (px). */
export interface LayoutLook {
  theme?: string;
  colors?: Record<string, string>;
  font?: string;
  radius?: number;
  border?: number;
  /** A CSS color or gradient behind the node (no `url()`). */
  background?: string;
  /** Takes the node out of the flow and draws it over the window at this place and size (px). */
  float?: { x: number; y: number; width: number; height: number };
}

export interface LayoutInfo {
  id: string;
  name: string;
  root: LayoutNode | null;
  /** Why the file cannot be used, if it cannot. */
  error: string | null;
}

/** Broadcast when the mods folder or a mod's state changed; clients ask again with `mods.list`. */
export interface ModsChangedMessage {
  type: "mods.changed";
}

/** Broadcast when `perch mod dom` wants to see what a mod (or `app`, the whole page) drew; the
 * page answers with `mods.snapshot` (capability `mods.snapshot.v1`). */
export interface ModsSnapshotRequestMessage {
  type: "mods.snapshot.request";
  requestId: string;
  /** A mod's id, or `app` for the whole page. */
  modId: string;
}

/** The page's answer to `mods.snapshot.request` (capability `mods.snapshot.v1`). */
export interface ModsSnapshotMessage {
  type: "mods.snapshot";
  requestId: string;
  html?: string;
  text?: string;
  error?: string | null;
}

/** Broadcast when `perch mod open` asks this screen to show a mod. */
export interface ModsOpenMessage {
  type: "mods.open";
  modId: string;
}

/** Reply to `mods.list` and `mods.set`: every mod, the setting, whether mods are off, and the mods
 * folder. `error` explains a refusal. */
export interface ModsStateMessage {
  type: "mods.state";
  requestId: string;
  mods: ModInfo[];
  /** The layouts in `layouts/`, and the one chosen (absent: stock Perch). */
  layouts?: LayoutInfo[];
  layout?: string;
  policy: ModsPolicy;
  safeMode: boolean;
  folder: string;
  error?: string;
}

/** Reply to `memory.list`, `memory.set` and `memory.delete`: the Project's memory index, by name,
 * after the request. `name` repeats the file a set or delete was about; `conflict` is true when
 * it was refused because the file is not at the base revision (read it again); `error` explains
 * any refusal. */
export interface MemoryStateMessage {
  type: "memory.state";
  requestId: string;
  projectId: string;
  files: MemoryEntry[];
  maxFiles: number;
  maxChars: number;
  name?: string;
  conflict?: boolean;
  error?: string;
}

/** Reply to `memory.get`: the file, or `error` (no such file, or the Project is not here). */
export interface MemoryFileMessage {
  type: "memory.file";
  requestId: string;
  projectId: string;
  name: string;
  file?: MemoryFile;
  error?: string;
}

/** Reply to `instructions.get` and `instructions.set`: what is stored for the scope.
 * `revision` is 0 until something was saved; `error` explains a refused request. */
export interface InstructionsStateMessage {
  type: "instructions.state";
  requestId: string;
  scope: string;
  id: string;
  text: string;
  folders: string[];
  revision: number;
  maxChars: number;
  error?: string;
}

/** Reply to `browser.history.search`, best match first. */
export interface BrowserHistoryResultMessage {
  type: "browser.history.result";
  requestId: string;
  entries: BrowserHistoryEntry[];
}

/** Every unresolved, undismissed attention event of the last week, newest
 * first (at most 100). Broadcast on change and in reply to `attention.list`. */
export interface AttentionSnapshotMessage {
  type: "attention.snapshot";
  events: AttentionEvent[];
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
  /** Appearance-specific palettes, when the source terminal defines them
   * (iTerm2's `… (Light)`/`… (Dark)` key variants, Ghostty's light/dark theme
   * pair). Absent when the terminal has a single palette — the common case,
   * which is why `theme` stays the unconditional fallback. Clients pick by
   * `prefers-color-scheme` and fall back to `theme`. */
  themeLight?: Record<string, string>;
  themeDark?: Record<string, string>;
  /** Cursor shape, in xterm.js's own vocabulary. Absent → xterm's default
   * (`block`); perch never picks a shape of its own, same rule as the palette. */
  cursorStyle?: "block" | "underline" | "bar";
  /** Whether the cursor blinks. Absent → xterm's default (`false`). */
  cursorBlink?: boolean;
}

export interface ServerInfoMessage {
  type: "server.info";
  hostname: string;
  isSsh: boolean;
  platform: string;
  /** Absent when the server couldn't read one. */
  terminalProfile?: TerminalProfile;
  /** Additive protocol capability discovery for newer clients. */
  protocolVersion?: number;
  capabilities?: string[];
  snapshotEpoch?: string;
  snapshotRevision?: number;
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

/**
 * How much of a recorded turn is actually reviewable. A turn's boundary is two
 * separate writes, so the newest row is often not a finished comparison.
 *
 * - `"complete"` — `beforeRef`..`afterRef` is the turn.
 * - `"running"` — the agent is still working; `afterRef` is absent on purpose,
 *   so compare `beforeRef` against the working tree.
 * - `"unavailable"` — the after side will never arrive (a failed capture, or a
 *   core restart mid-turn). There is no comparison here; say so rather than
 *   offering an older turn under this turn's name.
 */
export type AgentTurnState = "complete" | "running" | "unavailable";

/**
 * The newest recorded agent turn for a workspace — not necessarily a finished
 * one, see `state`. `beforeRef` / `afterRef` are server-recorded content
 * commits (they include uncommitted and untracked work, so they are not
 * necessarily branch HEADs); use them as a `compare` diff target and do not
 * interpret them otherwise. `beforeRef` is empty exactly when `state` is
 * `"unavailable"` and even the before side was never recorded.
 */
export interface AgentTurnSummary {
  snapshotId: string;
  sessionId: string;
  agent: string;
  beforeRef: string;
  afterRef?: string;
  changedPaths: string[];
  /** Exact total; absent when only the bounded list's lower bound is known. */
  changedPathCount?: number;
  completedAt?: number;
  /** Absent from a peer predating this field; treat that as `"complete"`. */
  state?: AgentTurnState;
}

export interface GitStatusResultMessage {
  type: "git.status.result";
  requestId: string;
  workspaceId: string;
  status: GitStatus;
  /**
   * The newest recorded turn in the workspace, restricted to the requested
   * session when supplied. **Always present**, including as `null`:
   * a client caches this between statuses, and only an explicit `null` can
   * tell it the server no longer has a turn to offer. Absent only from a peer
   * predating that guarantee, which must leave any cached summary alone.
   */
  lastAgentTurn?: AgentTurnSummary | null;
}

export interface GitRefsResultMessage {
  type: "git.refs.result";
  requestId: string;
  workspaceId: string;
  refs: GitBranchRef[];
}

export interface GitDiffResultMessage {
  type: "git.diff.result";
  requestId: string;
  workspaceId: string;
  target: GitDiffTarget;
  files: GitDiffFile[];
  hunkCount: number;
  truncated: boolean;
  /** Revision of all visible diff sources, for a batch review snapshot. */
  sourceRevision?: string;
  /** Exact server-issued revision per `<path>:<side>` source. */
  sourceRevisions?: Record<string, string>;
}

export interface GitActionResultMessage {
  type: "git.action.result";
  requestId: string;
  workspaceId: string;
  receipt: GitActionReceipt;
}

export interface GitPreviewResultMessage {
  type: "git.preview.result";
  requestId: string;
  preview: GitPreviewReceipt;
}

export interface ReviewListResultMessage {
  type: "review.list.result";
  requestId: string;
  workspaceId: string;
  comments: ReviewComment[];
}

export interface ReviewCommentResultMessage {
  type: "review.comment.result";
  requestId: string;
  workspaceId: string;
  comment: ReviewComment;
}

export interface ReviewDeleteResultMessage {
  type: "review.delete.result";
  requestId: string;
  workspaceId: string;
  commentId: string;
  deleted: boolean;
}

export interface ReviewBatchPreviewResultMessage {
  type: "review.batch.preview.result";
  requestId: string;
  packet: ReviewPacket;
}

export type ReviewDelivery = "queued" | "claimed" | "delivered" | "unconfirmed";

export interface ReviewBatchSendResultMessage {
  type: "review.batch.send.result";
  requestId: string;
  workspaceId: string;
  packetId: string;
  sendOperationId: string;
  delivery: ReviewDelivery;
  targetSessionId?: string;
  targetAgentId?: string;
}

/** Durable provider acceptance, pushed without requiring another send. */
export interface ReviewBatchDeliveryMessage {
  type: "review.batch.delivery";
  workspaceId: string;
  packetId: string;
  sendOperationId: string;
  delivery: ReviewDelivery;
  hostId?: string;
  targetSessionId?: string;
  targetAgentId?: string;
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

export interface FsTreeResultMessage {
  type: "fs.tree.result";
  requestId: string;
  workspaceId: string;
  path: string;
  entries: DirectoryEntry[];
  truncated: boolean;
}

export interface FsSearchResultMessage {
  type: "fs.search.result";
  requestId: string;
  workspaceId: string;
  query: string;
  entries: DirectoryEntry[];
  truncated: boolean;
}

export interface FsExtractResultMessage {
  type: "fs.extract.result";
  requestId: string;
  workspaceId: string;
  path: string;
  destination: string;
}

export interface FsMutateResultMessage {
  type: "fs.mutate.result";
  requestId: string;
  workspaceId: string;
  op: FsMutateOp;
  path: string;
  to?: string;
}

export interface FsReadResultMessage {
  type: "fs.read.result";
  requestId: string;
  workspaceId: string;
  metadata: FileMetadata;
  content: string;
  version: string;
}

/** A chat link target that names an existing file in the workspace. */
export interface FsLink {
  /** The target exactly as the message wrote it. */
  href: string;
  /** The file's workspace-relative path. */
  path: string;
  line?: number;
  column?: number;
}

/** Reply to `fs.links`: only the targets that resolved to an existing file in the workspace. */
export interface FsLinksResultMessage {
  type: "fs.links.result";
  requestId: string;
  workspaceId: string;
  links: FsLink[];
}

export interface FsPreviewResultMessage {
  type: "fs.preview.result";
  requestId: string;
  workspaceId: string;
  metadata: FileMetadata;
  version?: string;
  kind: PreviewKind;
  content?: string;
  mediaType?: string;
  requiresSandbox: boolean;
  truncated: boolean;
  message?: string;
}

export interface FsWriteResultMessage {
  type: "fs.write.result";
  requestId: string;
  workspaceId: string;
  metadata: FileMetadata;
  bytesWritten: number;
  version: string;
  bufferRevision?: number;
}

export interface FsBufferListResultMessage {
  type: "fs.buffer.list.result";
  requestId: string;
  workspaceId: string;
  buffers: FileBufferSummary[];
  truncated: boolean;
}

export interface FsBufferResultMessage {
  type: "fs.buffer.result";
  requestId: string;
  workspaceId: string;
  buffer: FileBuffer;
}

export interface FsBufferCloseResultMessage {
  type: "fs.buffer.close.result";
  requestId: string;
  workspaceId: string;
  path: string;
  removed: boolean;
}

export interface FsChangedMessage {
  type: "fs.changed";
  workspaceId: string;
  path: string;
  version?: string;
  kind: string;
  metadata?: FileMetadata;
  bufferRevision?: number;
  conflict?: boolean;
}

/** Structured filesystem failure. Conflicts include the current version and
 * metadata so the editor can compare/reload before an explicit overwrite. */
export interface FsErrorMessage {
  type: "fs.error";
  requestId: string;
  workspaceId: string;
  code: string;
  message: string;
  path?: string;
  metadata?: FileMetadata;
  expectedVersion?: string;
  actualVersion?: string;
  current?: FileMetadata;
  expectedBufferRevision?: number;
  actualBufferRevision?: number;
  currentBuffer?: FileBuffer;
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
  /** The repo's base ref (`origin/main`) when `origin/HEAD` is set. */
  baseRef?: string;
  /** Local and remote branch names for the start-from picker. */
  refs?: string[];
}

/** Success reply to `worktree.create` / `worktree.remove`. `path` is the
 * created checkout (create) or the removed checkout (remove). */
export interface WorktreeDoneMessage {
  type: "worktree.done";
  requestId: string;
  hostId: string;
  action: "create" | "remove" | "branchDelete";
  path: string;
  /** Durable workspace created for a linked checkout, when available. */
  workspace?: WorkspaceSummary;
  /** Remove with `deleteBranch`: the branch git would not delete. */
  preservedBranch?: WorktreePreservedBranch;
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

/** Reply to `worktree.job.start`: the job was accepted. */
export interface WorktreeJobStartedMessage {
  type: "worktree.job.started";
  requestId: string;
  job: WorktreeJob;
}

/** Every background worktree job on this host. Sent on connect and after
 * every change; the list replaces the previous one. */
export interface WorktreeJobsMessage {
  type: "worktree.jobs";
  jobs: WorktreeJob[];
}

/** The core's sidebar order: project ids and session ids, first to last.
 * Sent on connect and broadcast to every viewer after each change (the
 * requester's copy echoes `requestId`). Ids may be stale or unknown. Through
 * a hub, `hostId` names the owning remote and project ids are host-qualified. */
export interface WorkspaceOrderMessage {
  type: "workspace.order";
  requestId?: string;
  hostId: string;
  projects: string[];
  sessions: string[];
}

export interface ProjectListResponseMessage {
  type: "project.list";
  requestId: string;
  hostId: string;
  snapshotEpoch: string;
  snapshotRevision: number;
  projects: ProjectSummary[];
}

export interface ProjectUpdatedMessage {
  type: "project.updated";
  requestId?: string;
  project: ProjectSummary;
  snapshotEpoch: string;
  snapshotRevision: number;
}

export interface ProjectDeletedMessage {
  type: "project.deleted";
  requestId?: string;
  projectId: string;
  hostId: string;
  snapshotEpoch: string;
  snapshotRevision: number;
}

export interface WorkspaceSnapshotResponseMessage {
  type: "workspace.snapshot";
  requestId: string;
  hostId: string;
  snapshotEpoch: string;
  snapshotRevision: number;
  projects: ProjectSummary[];
  workspaces: WorkspaceSummary[];
  activeProjectId?: string;
  activeWorkspaceId?: string;
}

export interface WorkspaceUpdatedMessage {
  type: "workspace.updated";
  requestId?: string;
  workspace: WorkspaceSummary;
  snapshotEpoch: string;
  snapshotRevision: number;
}

export interface WorkspaceFocusResponseMessage {
  type: "workspace.focus";
  requestId: string;
  hostId: string;
  snapshotEpoch: string;
  snapshotRevision: number;
  activeProjectId?: string;
  activeWorkspaceId?: string;
}

export type ServerMessage =
  | ContextPreviewResultMessage
  | WorkspaceRunStartedMessage
  | SessionCreatedMessage
  | SessionListResponseMessage
  | SessionUpdatedMessage
  | AttentionSnapshotMessage
  | BrowserHistoryResultMessage
  | BrowserSuggestResultMessage
  | InstructionsStateMessage
  | MemoryStateMessage
  | ModsStateMessage
  | ModsChangedMessage
  | ModsOpenMessage
  | ModsSnapshotRequestMessage
  | MemoryFileMessage
  | CrewStateMessage
  | CrewActResultMessage
  | SuggestionsStateMessage
  | SuggestionActResultMessage
  | SuggestionsChangedMessage
  | InboundStateMessage
  | InboundActResultMessage
  | InboundChangedMessage
  | SessionDeletedMessage
  | ServerInfoMessage
  | CommandsListResponseMessage
  | AgentManifestListResponseMessage
  | AgentModelsListResponseMessage
  | AgentUiSnapshotMessage
  | AgentUiResultMessage
  | AgentUiFoundMessage
  | AgentUiDraftedMessage
  | AgentUiOlderResultMessage
  | AgentUiOptionResultMessage
  | AgentLifecycleMessage
  | AgentLifecycleChangedMessage
  | AgentControlMessage
  | TerminalOpenedMessage
  | TerminalListResultMessage
  | TerminalClosedMessage
  | SurfaceOpenedMessage
  | SurfaceListResultMessage
  | SurfaceClosedMessage
  | ViewerPresentationMessage
  | AgentTerminalOpenedMessage
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
  | DevicePairCodeMessage
  | DeviceListResultMessage
  | PhoneAccessStatusMessage
  | GitStatusResultMessage
  | GitRefsResultMessage
  | GitDiffResultMessage
  | GitActionResultMessage
  | GitPreviewResultMessage
  | ReviewListResultMessage
  | ReviewCommentResultMessage
  | ReviewDeleteResultMessage
  | ReviewBatchPreviewResultMessage
  | ReviewBatchSendResultMessage
  | ReviewBatchDeliveryMessage
  | FsBrowseResultMessage
  | UsageResultMessage
  | UsageAlertMessage
  | UsageRedeemResultMessage
  | FsTreeResultMessage
  | FsSearchResultMessage
  | FsExtractResultMessage
  | FsMutateResultMessage
  | FsReadResultMessage
  | FsPreviewResultMessage
  | FsLinksResultMessage
  | FsWriteResultMessage
  | FsBufferListResultMessage
  | FsBufferResultMessage
  | FsBufferCloseResultMessage
  | FsChangedMessage
  | FsErrorMessage
  | WorktreeListResultMessage
  | WorktreeDoneMessage
  | WorktreeErrorMessage
  | WorktreeJobStartedMessage
  | WorktreeJobsMessage
  | WorkspaceOrderMessage
  | ProjectListResponseMessage
  | ProjectUpdatedMessage
  | ProjectDeletedMessage
  | WorkspaceSnapshotResponseMessage
  | WorkspaceUpdatedMessage
  | WorkspaceFocusResponseMessage;
