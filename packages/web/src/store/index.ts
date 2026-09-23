import { handleNativeUiMessage } from "../nativeUi";
import { handleAgentTerminalMessage, sendAgentTerminalInput, resizeAgentTerminal } from "../agentTerminals";
import { create } from "zustand";
import type { AgentAttach, AgentControlChannel, AgentControlLease, AgentKind, AgentLifecycleStatus, AgentManifestListMessage, AgentManifestSummary, ChatUsage, ClientMessage, CommandEntry, FsBrowseResultMessage, ModelEntry, ProjectSummary, ServerInfoMessage, ServerMessage, SessionMode, SessionModeScope, SessionSummary, SettingsData, SettingsPatch, SshHostEntry, TerminalProfile, HostInfoMessage, WorktreeEntry, WorktreeListMessage, WorktreeCreateMessage, WorktreeRemoveMessage, WorktreeListResultMessage, WorktreeDoneMessage, WorktreeErrorMessage, WorktreeJob, WorktreeJobStartMessage, WorktreeJobStartedMessage, WorktreeBranchDeleteMessage, WorkspaceSummary } from "@perch/shared";
import { socket } from "../ws";
import { emitTerminalData } from "../terminalBus";
import { handleWorkspaceTerminalMessage } from "../workspaceTerminals";
import { defaultModel } from "../models";
import { applyTheme } from "../themes";
import { playBlockedTone, playDoneTone } from "../sound";
import { ownsAgentRuntimeRequest, ownsGitReviewRequest, registerAgentRuntimeRequest, retireAgentRuntimeRequest } from "../requestOwnership";
import {
  ACTIVE_PROJECT_ID_STORAGE_KEY,
  ACTIVE_WORKSPACE_ID_STORAGE_KEY,
  navSeedPending,
  readActiveHostStored,
  readActiveProjectStored,
  readDeviceIdStored,
  readLastAgentChoiceStored,
  readStoredId,
  writeActiveHostStored,
  writeActiveProjectStored,
  writeLastAgentChoiceStored,
  writeStoredId,
} from "./persistence";
export { readLastAgentChoiceStored } from "./persistence";
import { activeProjectSessions, omitKey, resolveSessionAgent, shouldReuseCurrentSession } from "./selectors";
export {
  activeProjectSessions,
  archivedSessions,
  effectiveActiveProject,
  omitKey,
  projectsForHost,
  resolveSessionAgent,
  resolveSessionModeForView,
  sessionIdsForProject,
  shouldReuseCurrentSession,
} from "./selectors";
export type { ProjectGroup, ProjectNavState, SessionModeViewResolution } from "./selectors";
import { newId } from "../ids";

export interface ToolCallEntry {
  name: string;
  input?: unknown;
  result?: unknown;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking: string;
  tools: ToolCallEntry[];
  streaming: boolean;
  error?: string;
  usage?: ChatUsage;
  /** Which backend answered this message — stamped at send time so the UI
   * can label a reply even though the wire protocol doesn't echo it back. */
  agent?: AgentKind;
  model?: string;
  /** Unix ms when the first streaming chunk/thinking/tool_use arrived for
   * this assistant message. Used to compute the "Worked for Xs" display. */
  turnStartedAt?: number;
  /** Wall-clock seconds the turn took, set on chat.done. */
  elapsedSec?: number;
  /** Discriminates the entry's rendering. Absent (the default, and what every
   * pre-existing constructor produces) means an ordinary chat turn;
   * `"plan"` is a plan-mode artifact delivered by `chat.plan`, rendered as a
   * distinct card with an "Approve & run" action instead of a bubble. Kept in
   * the same list rather than a parallel one so plans stay interleaved in
   * transcript order. */
  kind?: "plan";
  /** Plan cards only: the user already pressed "Approve & run", so the button
   * is spent (a plan can only be handed off once). */
  planApproved?: boolean;
}

/** Per-agent effort levels offered by the composer's Effort chip. `"default"`
 * is a client-side sentinel meaning "send no `effort` field at all and let the
 * CLI use its own default" — it is never put on the wire. Mirrors what the
 * runners in `agent.rs`/`detached.rs` accept. */
export const EFFORT_OPTIONS: Record<AgentKind, string[]> = {
  claude: ["default", "low", "medium", "high", "xhigh", "max", "none"],
  codex: ["default", "none", "low", "medium", "high", "xhigh"],
};

/** Text sent when the user approves a plan card — a plain chat turn (with
 * plan mode off) telling the agent to execute what it just planned. */
export const PLAN_APPROVAL_TEXT = "Approved. Proceed with the plan now.";

export interface TerminalMeta {
  id: string;
  cols: number;
  rows: number;
  exitCode: number | null;
}

export interface StatusInfo {
  cwd: string;
  branch: string;
  contextTokens?: number;
  costUsd?: number;
}

/** Stable project identity returned by the foundation workspace protocol.
 * Kept as a client-side view type until the shared protocol's first project
 * family lands; all wire messages are still sent and received through the
 * request-correlated helpers below. */
export type WorkspaceProject = ProjectSummary;

export type WorkspaceLifecycle = WorkspaceSummary["state"];

/** A visible checkout/folder belonging to one stable project. */
export type WorkspaceRecord = WorkspaceSummary;

export interface WorkspaceSnapshotStatus {
  state: "idle" | "loading" | "ready" | "error";
  revision?: number;
  snapshotEpoch?: string;
  error?: string;
}

export interface WorkspaceProjectCreateState {
  requestId: string;
  hostId: string;
  path: string;
  name?: string;
  status: "pending" | "success" | "error";
  error?: string;
}

/** Server-authoritative mode for one session. The previous mode is retained
 * while a write is pending so switching modes never flashes the wrong pane. */
export interface SessionModeState {
  mode: SessionMode;
  scope: SessionModeScope;
  revision: number;
  deviceId: string;
  workspaceId?: string;
  /** True once a server result has established this session's mode. It stays
   * true while a later read/write is pending so the last known mode remains
   * safe to render during invalidation/refetch. */
  authoritative?: boolean;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
}

/** Whether the owning host has completed the capability handshake needed to
 * decide between the modern session-mode policy and the legacy global
 * setting. An empty capability list is authoritative (it describes a legacy
 * peer); a missing entry still means that the peer has not answered. */
export function agentRuntimeCapabilitiesKnown(
  state: Pick<PerchState, "serverInfo" | "workspaceCapabilitiesByHost">,
  hostId: string,
): boolean {
  return hostId === "local"
    ? state.serverInfo !== null
    : Object.prototype.hasOwnProperty.call(state.workspaceCapabilitiesByHost, hostId);
}

/** Manifest discovery is host-scoped: a remote provider list must never
 * replace the local host's availability. */
export interface AgentManifestHostState {
  manifests: AgentManifestSummary[];
  revision?: number;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
}

export interface AgentLifecycleState {
  status?: AgentLifecycleStatus;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
}

export interface AgentControlState {
  agentId: string;
  input?: AgentControlLease;
  resize?: AgentControlLease;
  inputOwner?: AgentControlLease;
  resizeOwner?: AgentControlLease;
  state: "idle" | "loading" | "ready" | "error";
  error?: string;
}

/** A single "session finished" toast (Phase 6). Created client-side when a
 * `session.updated` push shows a running→idle transition for a session that
 * isn't the one currently being viewed. */
export interface ToastEntry {
  id: string;
  sessionId: string;
  title: string;
}

interface PendingTerminal {
  cols: number;
  rows: number;
  resolve: (id: string) => void;
}

export interface PerchState {
  connected: boolean;
  sessionId: string | null;
  status: StatusInfo | null;
  /** Hosted-mode chat transcripts, keyed by sessionId — the source of truth
   * for every session's messages, not just the globally active one. Split
   * panes (`dockview/DockviewShell.tsx`'s `SessionChatPanel`) read a
   * specific session's bucket via `ChatView`'s `sessionId` prop, so two (or
   * more) sessions can stream concurrently without clobbering each other.
   * Populated lazily — a session gains an entry only once it has actually
   * been loaded (via `switchSession`, `sendChat`, or `ensureSessionLive`),
   * so a session nobody has opened this page load costs nothing here.
   * Cleaned up on `session.deleted` via `omitKey`, same as every other
   * per-session map. */
  messagesBySession: Record<string, ChatMessage[]>;
  /** Per-session counterpart to `messagesBySession` — which message id (if
   * any) in that session's bucket is still streaming. */
  streamingMessageIdBySession: Record<string, string | null>;
  /** Mirror of `messagesBySession[sessionId]` for the globally *active*
   * session only — kept in sync by every action/handler that touches the
   * active session's bucket. Exists so call sites that only ever cared about
   * "the current conversation" (e.g. `PlanCard.tsx`'s `streamingMessageId`
   * read, and every pre-existing `ChatView` caller) keep working unchanged;
   * `ChatView` itself now reads a specific session's bucket directly (see
   * `sessionId` prop) rather than this mirror, so a split pane bound to a
   * non-active session is not limited to it. */
  messages: ChatMessage[];
  streamingMessageId: string | null;
  terminals: Record<string, TerminalMeta>;
  /** Per-session CLI terminal id, so toggling back into CLI mode reattaches
   * the existing PTY instead of spawning a new one. Keyed by sessionId.
   * Evicted when the cached terminal's exitCode is non-null (dead PTY), so
   * the next attach spawns a fresh one. */
  cliTerminalIds: Record<string, string>;
  /** Sessions this client has explicitly started a CLI in during this app run
   * — either by creating them ("+ New session", the CLI start panel) or by
   * pressing "Start" on one. CLI mode only mounts its terminal for a session
   * that is in here *or* already carries `cliStarted` from the server, so a
   * blank auto-minted session never silently spawns an agent process. Not
   * persisted: the server's `cliStarted` is the durable half. */
  cliStartedSessions: Record<string, boolean>;
  /** Per-session CLI provider choice (Bug 1 fix): which agent binary
   * CLI mode launches for a given session, recorded when
   * the user picks one in `CliStartPanel`. This is *provider* selection only
   * — which CLI to spawn — not model/effort chrome; AGENTS.md's "zero model
   * chrome in CLI mode" product decision stands, and providers/model pickers
   * still never render in CLI mode. Keyed by sessionId, same shape as
   * `cliStartedSessions`/`cliTerminalIds`/`effortBySession`. A session with no
   * entry here uses the server's persisted `cliProviderId`, then the global
   * `agent` field for sessions that predate provider selection. */
  cliAgentBySession: Record<string, string>;
  /** Per-session Hosted-mode provider choice, keyed by sessionId — the Hosted
   * counterpart to `cliAgentBySession`. A brand-new session created with an
   * explicit agent choice (the sidebar's "+ New session" popover or
   * `NoSessionPanel`, both via `createSessionOnHost`'s `agentChoice` param)
   * records it here immediately, and `switchSession` prefers it over the
   * hardcoded "claude" fallback whenever the session has no server-confirmed
   * `lastAgent` yet (i.e. no turn has been sent) — see `resolveSessionAgent`.
   * Once a turn lands, the server-derived `lastAgent`/`session.history` takes
   * over, same as before. `setAgent` also stamps the current session's entry
   * here so a manual switch survives a switch-away/switch-back within this
   * page load. Not persisted server-side — client-only, like
   * `cliAgentBySession`; cleaned up on `session.deleted` so ids can't leak. */
  hostedAgentBySession: Record<string, AgentKind>;
  agent: AgentKind;
  model: string;
  /** Server-discovered model lists, keyed by agent. Populated from server.info
   * on connect; empty arrays until the first server.info arrives. Clients must
   * not maintain their own hardcoded lists — different machines expose different
   * model sets depending on which CLI versions are installed. */
  availableModels: Record<AgentKind, ModelEntry[]>;
  /** All sessions known to the server, refreshed via session.list pushes. */
  sessions: SessionSummary[];
  /** Stable browser/device identity used by the session-mode policy. It is
   * opaque to the UI and is sent back unchanged on mode reads/writes. */
  deviceId: string;
  /** Effective, server-confirmed mode keyed by session id. A missing entry
   * means the peer has not answered yet and callers should use the legacy
   * settings fallback. */
  sessionModes: Record<string, SessionModeState>;
  fetchSessionMode: (sessionId: string, workspaceId?: string) => string | null;
  setSessionMode: (
    sessionId: string,
    scope: Exclude<SessionModeScope, "default">,
    mode?: SessionMode,
    workspaceId?: string,
    clearOverride?: boolean,
  ) => string | null;
  /** Provider availability, kept per owning host because federated hosts can
   * expose different binaries and capabilities. */
  agentManifestsByHost: Record<string, AgentManifestHostState>;
  fetchAgentManifests: (hostId?: string, update?: { providerId: string; enabled?: boolean; isDefault?: boolean }) => string | null;
  /** Lifecycle is keyed by the durable workspace/session/provider tuple. */
  agentLifecycleByKey: Record<string, AgentLifecycleState>;
  fetchAgentLifecycle: (sessionId: string, workspaceId?: string, agentId?: string) => string | null;
  /** Control leases are retained only in this connection's view. The server
   * remains authoritative and requires the exact returned generation for
   * terminal input/resize and release. */
  agentControlBySession: Record<string, AgentControlState>;
  acquireAgentControl: (
    sessionId: string,
    agentId: string,
    channel: AgentControlChannel,
    workspaceId?: string,
  ) => string | null;
  releaseAgentControl: (
    sessionId: string,
    agentId: string,
    channel: AgentControlChannel,
    generation: number,
    workspaceId?: string,
  ) => string | null;
  /** Host info sent once per connection by the server after WS handshake. */
  serverInfo: {
    hostname: string;
    isSsh: boolean;
    platform: string;
    /** Newer peers advertise the workspace foundation. Older peers omit all
     * of these fields and continue to use the legacy session navigation. */
    protocolVersion?: number;
    capabilities?: string[];
    snapshotEpoch?: string;
    snapshotRevision?: number;
  } | null;
  /** The user's real terminal appearance (font + ANSI palette from their
   * iTerm2 profile), sent in `server.info`. Every PTY-backed pane renders
   * with this so the agent CLIs look the way they do in the user's own
   * terminal. `null` = server had nothing to report, so xterm's stock
   * defaults apply — perch's UI theme is deliberately never substituted. */
  terminalProfile: TerminalProfile | null;
  /** Set while a CLI PTY is being attached for a given session, cleared on
   * success or error. Used to route ServerMessage::Error to cliError instead
   * of the chat message list when the error arrives during attach. */
  attachingCliForSession: string | null;
  /** Last error surfaced from a CLI attach attempt. Rendered as an overlay
   * inside AgentCliTerminal instead of the hidden chat list. Cleared on
   * successful attach, mode switch away from CLI, and session switch. */
  cliError: string | null;
  /** Controls whether the settings panel is open. Stage D renders the modal;
   * Stage C only wires up the open action from the sidebar gear button. */
  settingsOpen: boolean;
  settingsPage: "main" | "agents";
  openAgentCatalog: () => void;
  /** Current settings from the server, populated after fetchSettings(). */
  settings: SettingsData | null;
  /** Current SSH hosts from the server, populated after fetchHosts(). */
  hosts: SshHostEntry[];
  /** Live connection state for each hub host, keyed by hostId. Populated
   * from `host.info` messages pushed by the server. */
  hostStates: Record<string, HostInfoMessage>;
  /** Model lists for each hub host, keyed by hostId.  "local" is seeded
   * from `server.info` on connect; remote hosts are seeded from the
   * `claudeModels`/`codexModels` fields of their `host.info` message. */
  hostModels: Record<string, { claude: ModelEntry[]; codex: ModelEntry[] }>;
  /** Which host the sidebar/tab bar are currently scoped to. "local" until a
   * remote session is switched to or created, or the sidebar's host switcher
   * picks another one. Updated by switchSession, session.history (via the
   * session's hostId) and `setActiveHost`. Persisted in localStorage. */
  activeHostId: string;
  /** Which project (a distinct `(hostId, cwd)` pair — the same grouping the
   * sidebar has always used) the sidebar and tab bar are scoped to. This is
   * an explicit *pin*: it follows the active session whenever one is opened,
   * but the sidebar's project list can also set it on its own so the user can
   * browse another project's sessions without leaving the current one.
   * Persisted in localStorage; `null` means "no pin yet — fall back to the
   * most recent project on the active host" (see `effectiveActiveProject`). */
  activeProject: ActiveProject | null;
  /** The user's last agent choice made in a session-*create* picker (the
   * sidebar's "+ New session" popover, `NoSessionPanel`) — persisted in
   * localStorage so a reload/new tab defaults to whichever provider was
   * picked last, same durability convention as `activeHostId`/`activeProject`.
   * This is distinct from `agent` (the *current session's* live provider) and
   * from `cliAgentBySession` (CLI mode's per-session record) — it is only the
   * default a fresh picker opens with. */
  lastAgentChoice: AgentKind;
  /** Persist a new default agent choice (localStorage) and update the store. */
  setLastAgentChoice: (agent: AgentKind) => void;
  /** Switch the sidebar to another host. Clears the project pin so the new
   * host resolves to its own most recent project. */
  setActiveHost: (hostId: string) => void;
  /** Pin the sidebar/tab bar to a project (also makes its host active). */
  setActiveProject: (hostId: string, cwd: string) => void;
  /** Stable project/workspace navigation. These ids are persisted locally and
   * focused on the server when the peer advertises the matching capability. */
  workspaceProjects: WorkspaceProject[];
  workspaces: WorkspaceRecord[];
  workspaceSnapshotByHost: Record<string, WorkspaceSnapshotStatus>;
  workspaceCapabilities: string[];
  workspaceCapabilitiesByHost: Record<string, string[]>;
  workspaceProjectCreate: WorkspaceProjectCreateState | null;
  activeProjectId: string | null;
  activeWorkspaceId: string | null;
  fetchWorkspaceSnapshot: (hostId?: string, projectId?: string) => void;
  createWorkspaceProject: (path: string, name?: string, hostId?: string) => string | null;
  clearWorkspaceProjectCreate: () => void;
  focusWorkspaceProject: (projectId: string) => void;
  focusWorkspace: (workspaceId: string) => void;
  renameWorkspaceProject: (projectId: string, name: string) => void;
  archiveWorkspaceProject: (projectId: string, archived: boolean) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  pinWorkspace: (workspaceId: string, pinned: boolean) => void;
  /** Nest under `parentWorkspaceId`, or back to the top level when absent. */
  nestWorkspace: (workspaceId: string, parentWorkspaceId?: string) => void;
  restoreWorkspace: (workspaceId: string) => void;
  /** Workspace-relative file surface currently shown over the dock. The
   * filesystem store owns tree/buffer wire state; this id only coordinates
   * the navigation entry point with App's main canvas. */
  workspaceFilesWorkspaceId: string | null;
  openWorkspaceFiles: (workspaceId: string) => void;
  closeWorkspaceFiles: () => void;
  /** Workspace-scoped Git/status/diff/review surface currently requested by
   * the navigation rail. Dockview consumes and clears this intent so the
   * review view joins the same persisted mixed-pane layout as files. */
  workspaceGitReviewWorkspaceId: string | null;
  openWorkspaceGitReview: (workspaceId: string) => void;
  closeWorkspaceGitReview: () => void;
  /** Cache of persisted dockview layout blobs, keyed by sessionId. Populated
   * from `session.layout` server replies (Phase 3: Workspace → Tab → Pane
   * model). A key mapped to `null` means the server has confirmed there is
   * no saved layout for that session (as opposed to "not fetched yet",
   * i.e. the key being absent entirely). */
  sessionLayouts: Record<string, unknown | null>;
  /** Whether the sidebar is collapsed to a compact icon rail (Phase 4:
   * Keybindings + Navigator, leader,b). */
  sidebarCollapsed: boolean;
  /** Last known git branch + ahead/behind for each (hostId,cwd) project,
   * populated from `workspace.git` server pushes. Keyed by
   * `${hostId}:${cwd}` — the same key `Sidebar.tsx`'s `ProjectGroup` uses. */
  workspaceGit: Record<string, { branch?: string; ahead: number; behind: number }>;
  /** Wave 2: git worktrees per repo, keyed by `${hostId}:${repoPath}` — the
   * same key shape `workspaceGit` uses. Populated by `worktree.list.result`
   * (request-correlated like `fs.browse`); the sidebar's `WorktreeMenu`
   * renders straight from this cache so a create/remove round-trip followed
   * by a re-list refreshes every open menu for that repo. */
  worktrees: Record<string, { worktrees: WorktreeEntry[]; defaultRoot: string; baseRef?: string; refs?: string[] }>;
  /** Which project's worktree popover an external trigger (the leader,W
   * keybind) wants opened, as `${hostId}:${cwd}` plus a monotonically
   * increasing nonce so pressing the same binding twice re-opens it. The
   * matching `WorktreeMenu` instance self-opens against its own button rect;
   * cleared by that instance once consumed. */
  worktreeMenuRequest: { projectKey: string; nonce: number } | null;
  /** Background worktree creates on the local host, replaced wholesale by
   * each `worktree.jobs` broadcast (see `server/worktree_jobs.rs`). */
  worktreeJobs: WorktreeJob[];
  /** "Session finished" toasts (Phase 6), derived client-side from
   * `session.updated` running→idle transitions on non-active sessions.
   * Rendered by `components/Toast.tsx`; dismissed on click or timeout. */
  toasts: ToastEntry[];
  /** Dismiss a toast by id (click or auto-dismiss timeout). */
  dismissToast: (id: string) => void;

  /** Slash-command / skill lists per session, from `commands.list` replies.
   * Keyed by sessionId because the server probes the session's *cwd* (a
   * project can define its own commands). Absent = never fetched. */
  sessionCommands: Record<string, { claude: CommandEntry[]; codex: CommandEntry[] }>;
  /** Request the command lists for a session, at most once per session per
   * page load (the server caches per host+cwd for minutes anyway, and the
   * composer would otherwise re-ask on every "/" keystroke). Safe to call
   * unconditionally — it self-dedupes. */
  fetchCommands: (sessionId: string) => void;
  /** Reasoning-effort selection per session (Effort chip). Values come from
   * `EFFORT_OPTIONS`; `"default"`/absent means "send no effort field".
   * Client-side only — nothing about effort is persisted server-side. */
  effortBySession: Record<string, string>;
  setEffort: (sessionId: string, effort: string) => void;
  /** Mark a plan card's "Approve & run" button as spent. */
  approvePlan: (messageId: string) => void;

  /** Send a chat turn. `options.planMode` runs it in plan mode (claude:
   * `--permission-mode plan`; codex: `--sandbox read-only`), and
   * `options.attachments` carries server-side paths from `POST {base}upload`.
   * The per-session effort selection is read from the store, so callers never
   * pass it. */
  sendChat: (
    text: string,
    options?: { planMode?: boolean; attachments?: string[] },
    sessionId?: string,
  ) => void;
  cancelChat: (sessionId?: string) => void;
  /** Load a session's history into `messagesBySession` without disturbing
   * whichever session is actually active/foreground — used by a split pane
   * (`Chat.tsx`) bound to a session this connection has never resumed
   * before. No-ops once the session is already known (it's the active
   * session, or was previously loaded this page load): `session.resume` is
   * the *only* wire message that hands back a session's full history, and
   * this connection's runtime map only gains an entry for a session via
   * create/resume/subscribe — but that registration, once made, persists
   * for the life of the connection regardless of which session later
   * becomes "active", so this dance only ever has to run once per session
   * per connection. See the `session.created`/`session.history` handlers
   * for how the reply is kept from clobbering the real foreground session. */
  ensureSessionLive: (sessionId: string) => void;
  setAgent: (agent: AgentKind) => void;
  setModel: (model: string) => void;
  /** Ask the server for a fresh session list push. */
  listSessions: () => void;
  /** Create a brand-new session (clears local message/streaming state so
   * the UI is ready for the incoming session.created + session.history). */
  createSession: () => void;
  /** Switch to an existing session by id. No-op if already the active one. */
  switchSession: (sessionId: string) => void;
  /** Open/close the settings panel. Stage D renders content; Stage C wires
   * up the open trigger from the sidebar gear icon. */
  setSettingsOpen: (open: boolean) => void;
  /** Fetch current settings from the server. */
  fetchSettings: () => void;
  /** Apply a settings patch on the server. */
  updateSettings: (patch: SettingsPatch) => void;
  /** Fetch the SSH hosts list from the server. */
  fetchHosts: () => void;
  /** Upsert (create or update) an SSH host. */
  upsertHost: (host: SshHostEntry) => void;
  /** Delete an SSH host by id. */
  deleteHost: (id: string) => void;
  /** Create a new session on a specific hub host.  Passes hostId in the
   * session.create message; "local" omits the field (backward-compatible).
   * If `cwd` is provided it is sent to the server for validation. If the
   * active session on that host is already empty (no messages) and no
   * different cwd is requested, just focuses the composer instead — see
   * `shouldReuseCurrentSession`.
   * `agentChoice`, when passed, is the provider `CliStartPanel`/the sidebar's
   * "+ New session" popover/`NoSessionPanel` picked for this not-yet-created
   * session — see `cliAgentBySession`/`hostedAgentBySession`; it's threaded
   * through to the `session.created` handler since the new session's id isn't
   * known until that reply arrives, and applied to whichever of the two maps
   * matches the current global chat mode (plus, in Hosted mode, the live
   * `agent`/`model` fields so the pane header and the next `chat.send`
   * reflect it immediately). */
  createSessionOnHost: (hostId: string, cwd?: string, agentChoice?: string, mode?: SessionMode) => void;
  /** Archive or unarchive a session. Archiving hides it everywhere in the
   * nav (sidebar, tab bar, navigator) immediately; the only place archived
   * sessions are listed is Settings → Archived sessions, which is also where
   * they are restored (`archived: false`) or permanently deleted from. */
  archiveSession: (sessionId: string, archived: boolean) => void;
  /** Permanently delete a session. Irreversible — unlike archiveSession there
   * is no undo. Server-side cleanup (DB rows, in-flight turn, CLI-attached
   * terminal) happens on receipt of `session.deleted`, which also drives the
   * local sessions[]/sessionLayouts/cliTerminalIds cleanup and — if the
   * deleted session was the active one — switching to the most recent
   * remaining session (or a blank/empty state if none remain). */
  deleteSession: (sessionId: string) => void;
  /** Rename a session (Wave 1 item 2). Sets a persistent user title override
   * that wins over the auto-derived first-message title once non-empty. */
  renameSession: (sessionId: string, title: string) => void;
  /** Request a directory listing for the new-session cwd picker (Wave 1 item
   * 1). Resolves with the `fs.browse.result` reply matching this call's
   * generated requestId. `hostId` omitted/undefined means "local"; `path`
   * omitted means "start at $HOME". */
  browseDirectory: (hostId: string | undefined, path?: string) => Promise<FsBrowseResultMessage>;
  /** Wave 2 worktrees — list every git worktree of the repo containing
   * `repoPath` on `hostId`. Also caches the result under
   * `worktrees["${hostId}:${repoPath}"]`. */
  listWorktrees: (hostId: string, repoPath: string) => Promise<WorktreeReply>;
  /** Create a linked worktree. `newBranch` is a hint — the server falls back
   * to checking out an existing branch when one already exists (herdr's
   * `run_worktree_add_command` behavior). Resolves with `worktree.done` or
   * `worktree.error`. */
  createWorktree: (
    hostId: string,
    repoPath: string,
    branch: string,
    newBranch: boolean,
    path?: string,
    extra?: WorktreeCreateExtra,
  ) => Promise<WorktreeReply>;
  /** Remove a worktree. Without `force`, a dirty checkout comes back as
   * `worktree.error { dirty: true }` — the caller escalates that into a
   * force confirmation rather than reporting a hard failure. */
  removeWorktree: (
    hostId: string,
    repoPath: string,
    path: string,
    force: boolean,
    deleteBranch?: boolean,
  ) => Promise<WorktreeReply>;
  /** Force-delete a branch a delete preserved, after review; refused if the
   * branch moved off `expectedHead`. */
  deleteWorktreeBranch: (
    hostId: string,
    repoPath: string,
    branch: string,
    expectedHead: string,
  ) => Promise<WorktreeReply>;
  /** Start a background create on the local host (capability
   * `worktree.job`). Resolves with `worktree.job.started` or `worktree.error`;
   * progress then arrives in `worktreeJobs`. */
  startWorktreeJob: (
    repoPath: string,
    branch: string,
    newBranch: boolean,
    path?: string,
    extra?: WorktreeCreateExtra,
  ) => Promise<WorktreeReply>;
  cancelWorktreeJob: (jobId: string) => void;
  retryWorktreeJob: (jobId: string) => void;
  dismissWorktreeJob: (jobId: string) => void;
  /** Ask the `WorktreeMenu` for `${hostId}:${cwd}` to open itself (leader,W). */
  requestWorktreeMenu: (projectKey: string) => void;
  /** Clear a consumed `worktreeMenuRequest`. */
  clearWorktreeMenuRequest: () => void;
  /** Request the persisted dockview layout blob for a session. Reply lands
   * in `sessionLayouts[sessionId]` via the `session.layout` server message. */
  fetchSessionLayout: (sessionId: string) => void;
  /** Persist a session's dockview layout blob. Callers (DockviewShell) are
   * responsible for debouncing — this sends immediately. */
  saveSessionLayout: (sessionId: string, layout: unknown) => void;
  /** Toggle the sidebar between full and compact-rail (`.sidebar--collapsed`)
   * display (Phase 4, leader,b). */
  toggleSidebar: () => void;
  /** Switch to the next (`dir=1`) or previous (`dir=-1`) session within the
   * *active project* — the same (hostId,cwd) grouping `TabBar` uses. Wraps
   * around; no-op if the active project has no other sessions. Used by
   * leader,n / leader,p (Phase 4). */
  switchSessionRelative: (dir: 1 | -1) => void;
  createTerminal: (
    cols: number,
    rows: number,
    options?: { cwd?: string; agentAttach?: AgentAttach },
  ) => Promise<string>;
  /** Mark a session as CLI-started, which is what actually mounts the
   * terminal (see `cliStartedSessions`). Used by the CLI start panel's
   * "Start" affordance for a session that already exists but has never had a
   * CLI launched in it. `agent`, when passed, also records the CLI provider
   * choice for this session in `cliAgentBySession` (see there). */
  startCli: (sessionId: string, agent?: string) => void;
  /** Attach (or reattach) the real interactive agent CLI for a session.
   * `cols`/`rows` should be the pane's *actual* measured grid so the CLI
   * paints its first frame at the final width — see AgentCliTerminal. */
  attachAgentCli: (
    sessionId: string,
    agent: AgentKind,
    cols?: number,
    rows?: number,
  ) => Promise<string>;
  sendTerminalInput: (terminalId: string, data: string) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
  /** Force-terminate a terminal's backing PTY/process and drop it from local
   * state (terminals + any cliTerminalIds entry pointing at it). Used to kill
   * a CLI-attached terminal on unmount (leaving CLI mode, switching session,
   * or the component tearing down before attach even resolves) so a stale
   * still-alive `claude --resume` process never lingers to be silently
   * reattached to a fresh, blank xterm instance later — see
   * views/AgentCliTerminal.tsx. Also used by plain terminal panes on unmount
   * (views/Terminal.tsx) so closing a terminal tab doesn't leak a shell
   * process. Safe to call on an already-dead or unknown terminal id (no-op
   * server-side). */
  killTerminal: (terminalId: string) => void;
}

const pendingTerminals: PendingTerminal[] = [];

/**
 * Host id of a user-initiated `session.create` whose cwd the server still has
 * to resolve ("~" or "use the default"), or `null` when nothing is pending.
 * The `status.update` that `session.create` always replies with carries the
 * resolved path, and the `"status.update"` handler consumes this flag to pin
 * `activeProject` on it. Only local creates can be resolved this way — the
 * hub does not relay remote `status.update`s (see `hub.rs`), so a remote
 * project is picked up later from the `session.updated` that lands when the
 * session gets its first message.
 */
let expectProjectFromStatus: string | null = null;

/**
 * Set when a `session.create` was initiated *by the user* (sidebar/tab-bar
 * "+", the CLI start panel) rather than by the transport's housekeeping
 * create on connect (see ws.ts). Consumed by the `session.created` handler,
 * which marks the new id in `cliStartedSessions`.
 *
 * This is what stops CLI mode from launching an agent nobody asked for: every
 * fresh connect mints a blank session, and CLI mode used to spawn
 * `claude --resume` into it immediately — in whatever the server's default
 * cwd happened to be. Now only an explicitly-created session (which therefore
 * has a project the user chose) auto-starts its PTY.
 *
 * A plain module-level flag is enough for the same reason
 * `expectProjectFromStatus` is: `session.create` is answered by exactly one
 * `session.created`, and the UI has no way to issue two creates before the
 * first reply lands.
 */
let expectCliStart = false;

/**
 * The provider (`claude`/`codex`) picked in a create-flow picker
 * (`CliStartPanel`, the sidebar's "+ New session" popover, `NoSessionPanel`)
 * for a not-yet-created session, so it can be recorded in
 * `cliAgentBySession`/`hostedAgentBySession` once `session.created` reveals
 * the new session's id (the panel's agent choice has to survive that round
 * trip). Armed right before a `createSessionOnHost` call that carried an
 * explicit `agentChoice`, consumed (and cleared) alongside `expectCliStart`
 * in the `session.created` handler — same one-shot request/reply discipline
 * as `expectProjectFromStatus`.
 */
let pendingAgentForNewSession: string | null = null;
let pendingModeForNewSession: SessionMode | null = null;
// A launch request selects an initial view, but must not pin a session that
// already inherits that view from its workspace/device. Resolve first.
const initialLaunchModes = new Map<string, SessionMode>();

/** Resolvers for in-flight `fs.browse` requests, keyed by requestId. See
 * `browseDirectory` and the `"fs.browse.result"` case in
 * `handleServerMessage`. Single-shot: each entry is deleted as soon as its
 * matching reply arrives (mirrors the hub's `PendingKey::Browse` semantics
 * on the server side). */
const pendingBrowses = new Map<string, (msg: FsBrowseResultMessage) => void>();

/** Capability `worktree.startFrom`: a task name to derive the branch from
 * (when `branch` is empty) and the new branch's start point. */
export interface WorktreeCreateExtra {
  name?: string;
  startFrom?: string;
  /** Capability `workspace.nest`: nest the new workspace under this one. */
  parentWorkspaceId?: string;
}

/** Any of the three replies a `worktree.*` request can produce. */
export type WorktreeReply =
  | WorktreeListResultMessage
  | WorktreeDoneMessage
  | WorktreeErrorMessage
  | WorktreeJobStartedMessage;

/** Resolvers for in-flight `worktree.*` requests, keyed by requestId — the
 * exact same single-shot request/response discipline as `pendingBrowses`
 * above (and as the server's `PendingKey::Worktree` hub slot). Every request
 * gets exactly one reply: `worktree.list.result`, `worktree.done`, or
 * `worktree.error`. */
const pendingWorktrees = new Map<string, (msg: WorktreeReply) => void>();

/** Request ids for the first durable project/workspace slice. Keeping the
 * originating host beside each id lets a late reply be ignored after a host
 * switch while still allowing unrelated session traffic to continue. */
const pendingWorkspaceRequests = new Map<string, {
  hostId: string;
  kind: string;
  projectId?: string;
  previousFocus?: { projectId: string | null; workspaceId: string | null; legacy: ActiveProject | null };
}>();
const latestWorkspaceFocusRequestByHost = new Map<string, string>();

type AgentRuntimeRequestKind = "mode" | "manifests" | "lifecycle" | "control";

interface PendingAgentRuntimeRequest {
  kind: AgentRuntimeRequestKind;
  key: string;
  sessionId?: string;
  hostId?: string;
  agentId?: string;
  channel?: AgentControlChannel;
  /** Highest policy revision observed while this mode request was in flight. */
  minimumModeRevision?: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

const pendingAgentRuntimeRequests = new Map<string, PendingAgentRuntimeRequest>();
const latestAgentRuntimeRequestByKey = new Map<string, string>();
const AGENT_RUNTIME_REQUEST_TIMEOUT_MS = 30_000;
const MAX_AGENT_RUNTIME_REQUESTS = 64;

function markAgentRuntimeError(request: PendingAgentRuntimeRequest, message: string): void {
  if (request.kind === "mode" && request.sessionId) {
    usePerchStore.setState((state) => {
      const current = state.sessionModes[request.sessionId!];
      return {
        sessionModes: {
          ...state.sessionModes,
          [request.sessionId!]: {
            ...(current ?? {
              mode: state.settings?.chatMode ?? "hosted",
              scope: "default" as const,
              revision: 0,
              deviceId: state.deviceId,
            }),
            state: "error",
            error: message,
          },
        },
      };
    });
    return;
  }
  if (request.kind === "manifests" && request.hostId) {
    usePerchStore.setState((state) => ({
      agentManifestsByHost: {
        ...state.agentManifestsByHost,
        [request.hostId!]: {
          ...(state.agentManifestsByHost[request.hostId!] ?? { manifests: [] }),
          state: "error",
          error: message,
        },
      },
    }));
    return;
  }
  if (request.kind === "lifecycle" && request.key) {
    usePerchStore.setState((state) => ({
      agentLifecycleByKey: {
        ...state.agentLifecycleByKey,
        [request.key]: {
          ...(state.agentLifecycleByKey[request.key] ?? { state: "idle" }),
          state: "error",
          error: message,
        },
      },
    }));
    return;
  }
  if (request.kind === "control" && request.sessionId) {
    usePerchStore.setState((state) => ({
      agentControlBySession: {
        ...state.agentControlBySession,
        [request.sessionId!]: {
          ...(state.agentControlBySession[request.sessionId!] ?? {
            agentId: request.agentId ?? "",
          }),
          state: "error",
          error: message,
        },
      },
    }));
  }
}

function finishAgentRuntimeRequest(requestId: string): PendingAgentRuntimeRequest | undefined {
  const pending = pendingAgentRuntimeRequests.get(requestId);
  if (!pending) return undefined;
  clearTimeout(pending.timeoutId);
  pendingAgentRuntimeRequests.delete(requestId);
  retireAgentRuntimeRequest(requestId);
  if (latestAgentRuntimeRequestByKey.get(pending.key) === requestId) {
    latestAgentRuntimeRequestByKey.delete(pending.key);
  }
  return pending;
}

function settleAgentRuntimeRequest(requestId: string): PendingAgentRuntimeRequest | undefined {
  return finishAgentRuntimeRequest(requestId);
}

function expireAgentRuntimeRequest(requestId: string): void {
  const pending = pendingAgentRuntimeRequests.get(requestId);
  if (!pending) return;
  const isLatest = latestAgentRuntimeRequestByKey.get(pending.key) === requestId;
  const finished = finishAgentRuntimeRequest(requestId);
  if (isLatest && finished) {
    markAgentRuntimeError(finished, "The agent runtime request timed out. Check the host connection and try again.");
  }
}

function beginAgentRuntimeRequest(
  requestId: string,
  request: Omit<PendingAgentRuntimeRequest, "timeoutId">,
): void {
  const previous = latestAgentRuntimeRequestByKey.get(request.key);
  if (previous && previous !== requestId) settleAgentRuntimeRequest(previous);
  while (pendingAgentRuntimeRequests.size >= MAX_AGENT_RUNTIME_REQUESTS) {
    const oldest = pendingAgentRuntimeRequests.keys().next().value as string | undefined;
    if (!oldest) break;
    settleAgentRuntimeRequest(oldest);
  }
  const timeoutId = setTimeout(() => expireAgentRuntimeRequest(requestId), AGENT_RUNTIME_REQUEST_TIMEOUT_MS);
  pendingAgentRuntimeRequests.set(requestId, { ...request, timeoutId });
  latestAgentRuntimeRequestByKey.set(request.key, requestId);
  registerAgentRuntimeRequest(requestId);
}

/**
 * Shared prelude for `acquireAgentControl`/`releaseAgentControl`: if a
 * control request for `key` is already in flight, return its request id so
 * the caller can reuse it; otherwise set `agentControlBySession[sessionId]`
 * to "loading" and return `null` so the caller proceeds to send its message.
 */
function beginAgentControlOptimisticUpdate(key: string, sessionId: string, agentId: string): string | null {
  const existing = latestAgentRuntimeRequestByKey.get(key);
  if (existing && pendingAgentRuntimeRequests.has(existing)) return existing;
  usePerchStore.setState((currentState) => ({
    agentControlBySession: {
      ...currentState.agentControlBySession,
      [sessionId]: {
        ...(currentState.agentControlBySession[sessionId] ?? { agentId }),
        agentId,
        state: "loading",
        error: undefined,
      },
    },
  }));
  return null;
}

function sessionModeStateFor(state: Pick<PerchState, "sessionModes" | "settings">, sessionId: string | null): SessionMode {
  if (sessionId) {
    const mode = state.sessionModes[sessionId];
    if (mode?.state === "ready" || mode?.authoritative === true) return mode.mode;
  }
  return state.settings?.chatMode ?? "hosted";
}

function agentLifecycleKeyFor(workspaceId: string | undefined, sessionId: string, agentId: string): string {
  return `${workspaceId ?? ""}:${sessionId}:${agentId}`;
}

const WORKSPACE_CAPABILITIES = {
  snapshot: "workspace.snapshot",
  projectList: "project.list",
  projectCreate: "project.create",
  projectFocus: "project.focus",
  projectRename: "project.rename",
  projectArchive: "project.archive",
  workspaceFocus: "workspace.focus",
  workspaceRename: "workspace.rename",
  workspaceRestore: "workspace.restore",
  workspacePin: "workspace.pin",
  workspaceNest: "workspace.nest",
} as const;

const AGENT_RUNTIME_CAPABILITIES = {
  modeGet: "session.mode.get",
  modeSet: "session.mode.set",
  manifests: "agent.manifest.list",
  lifecycle: "agent.lifecycle.get",
  acquire: "agent.control.acquire",
  release: "agent.control.release",
} as const;

function hasWorkspaceCapability(
  state: Pick<PerchState, "serverInfo" | "workspaceCapabilitiesByHost">,
  hostId: string,
  capability: string,
): boolean {
  // An absent capability list means an older peer. Do not optimistically send
  // new messages: legacy hosts must stay on the session/cwd navigation path.
  const capabilities = hostId === "local"
    ? state.serverInfo?.capabilities
    : state.workspaceCapabilitiesByHost[hostId];
  return (hostId === "local" ? state.serverInfo?.protocolVersion : capabilities != null) != null &&
    capabilities?.includes(capability) === true;
}

function hasAgentRuntimeCapability(
  state: Pick<PerchState, "serverInfo" | "workspaceCapabilitiesByHost">,
  hostId: string,
  capability: string,
): boolean {
  const capabilities = hostId === "local"
    ? state.serverInfo?.capabilities
    : state.workspaceCapabilitiesByHost[hostId];
  return capabilities?.includes(capability) === true;
}

function hostForSession(
  state: Pick<PerchState, "sessions" | "activeHostId">,
  sessionId: string,
): string {
  const session = state.sessions.find((session) => session.id === sessionId);
  return session ? session.hostId ?? "local" : state.activeHostId;
}

function workspaceForSession(
  state: Pick<PerchState, "sessions" | "sessionModes">,
  sessionId: string,
  workspaceId?: string,
): string | undefined {
  if (workspaceId) return workspaceId;
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  // Browsing another workspace does not move this session into it. Only
  // echo an actual session association, never the navigation focus.
  return session?.workspaceId ?? state.sessionModes[sessionId]?.workspaceId;
}

function sendWorkspaceMessage(
  message: ClientMessage,
  hostId: string,
  kind: string,
  context?: { projectId?: string; previousFocus?: { projectId: string | null; workspaceId: string | null; legacy: ActiveProject | null } },
): void {
  const requestId = "requestId" in message && typeof message.requestId === "string" ? message.requestId : null;
  if (requestId) pendingWorkspaceRequests.set(requestId, { hostId, kind, ...context });
  socket.send(message);
}

/**
 * Sessions currently being loaded in the background — a split pane bound to
 * a session this connection has never resumed before (see
 * `ensureSessionLive`) — mapped to the session id that was actually
 * active/foreground when the background load was kicked off (or `null` if
 * none). A `session.resume` for the background id is indistinguishable on
 * the wire from a real user switch (same `session.created` +
 * `session.history` reply shape), so the `"session.created"`/
 * `"session.history"` handlers consult this map by the reply's `sessionId`
 * to keep `sessionId`/`activeHostId`/`activeProject`/`agent`/`model`
 * untouched for a background load, and to send exactly one restoring
 * `session.resume` for the captured foreground id afterward — otherwise the
 * background load would silently steal this connection's server-side
 * "active session" (used for direct-mode broadcast filtering and the unseen
 * dot) out from under whatever the user is actually looking at.
 *
 * Doubles as an in-flight guard: `ensureSessionLive` no-ops while a session
 * already has an entry here, and `switchSession` deletes the entry for
 * whatever it's switching to before sending its own resume — promoting an
 * in-flight background load to an ordinary switch reply instead of racing a
 * second resume against it. See both call sites for the full reasoning.
 */
const pendingBackgroundLoads = new Map<string, string | null>();

/** Sessions whose `commands.list` has already been requested this page load.
 * The composer calls `fetchCommands` on every "/" it sees, so the dedupe has
 * to live outside React; the server caches per host+cwd on its side too, but
 * there is no reason to make it answer the same question repeatedly. */
const requestedCommands = new Set<string>();

function resolveWorktreeRequest(requestId: string, msg: WorktreeReply): void {
  const resolve = pendingWorktrees.get(requestId);
  if (resolve) {
    pendingWorktrees.delete(requestId);
    resolve(msg);
  }
}

/** Mint a requestId, register the resolver, and send. `hostId: "local"` is
 * dropped from the wire message (absent == local, same convention as
 * `browseDirectory`) so a local request never hits the hub-routing branch. */
function sendWorktreeRequest(
  msg: (WorktreeListMessage | WorktreeCreateMessage | WorktreeRemoveMessage | WorktreeJobStartMessage | WorktreeBranchDeleteMessage) & { hostId: string },
): Promise<WorktreeReply> {
  return new Promise<WorktreeReply>((resolve) => {
    const requestId = newId();
    pendingWorktrees.set(requestId, resolve);
    const { hostId, ...rest } = msg;
    socket.send({
      ...rest,
      requestId,
      ...(hostId && hostId !== "local" ? { hostId } : {}),
    } as WorktreeListMessage | WorktreeCreateMessage | WorktreeRemoveMessage | WorktreeJobStartMessage | WorktreeBranchDeleteMessage);
  });
}


/** Re-exported so the store's existing importers keep working; the one
 * implementation lives in `ids.ts` (its guard has to be `typeof ... ===
 * "function"`, because outside a secure context the property exists but is
 * not callable). */
export { newId };

/** The sidebar/tab-bar "active project" pin — a `(hostId, cwd)` pair. */
export interface ActiveProject {
  hostId: string;
  cwd: string;
}

export const usePerchStore = create<PerchState>((set, get) => ({
  connected: false,
  sessionId: null,
  status: null,
  messagesBySession: {},
  streamingMessageIdBySession: {},
  messages: [],
  streamingMessageId: null,
  terminals: {},
  cliTerminalIds: {},
  cliStartedSessions: {},
  cliAgentBySession: {},
  hostedAgentBySession: {},
  agent: "claude",
  model: "",
  availableModels: { claude: [], codex: [] },
  sessions: [],
  deviceId: readDeviceIdStored(),
  sessionModes: {},
  agentManifestsByHost: {},
  agentLifecycleByKey: {},
  agentControlBySession: {},
  serverInfo: null,
  terminalProfile: null,
  attachingCliForSession: null,
  cliError: null,
  settingsOpen: false,
  settingsPage: "main",
  settings: null,
  hosts: [],
  hostStates: {},
  hostModels: { local: { claude: [], codex: [] } },
  activeHostId: readActiveHostStored(),
  activeProject: readActiveProjectStored(),
  lastAgentChoice: readLastAgentChoiceStored(),
  setLastAgentChoice: (agent) => {
    writeLastAgentChoiceStored(agent);
    set({ lastAgentChoice: agent });
  },
  sessionLayouts: {},
  sidebarCollapsed: false,
  workspaceGit: {},
  workspaceProjects: [],
  workspaces: [],
  workspaceSnapshotByHost: {},
  workspaceCapabilities: [],
  workspaceCapabilitiesByHost: {},
  workspaceProjectCreate: null,
  activeProjectId: readStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY),
  activeWorkspaceId: readStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY),
  worktrees: {},
  worktreeMenuRequest: null,
  worktreeJobs: [],
  toasts: [],
  sessionCommands: {},
  effortBySession: {},

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  fetchCommands: (sessionId) => {
    if (!sessionId || requestedCommands.has(sessionId)) return;
    requestedCommands.add(sessionId);
    socket.send({ type: "commands.list", sessionId });
  },

  setEffort: (sessionId, effort) => {
    set((state) => ({ effortBySession: { ...state.effortBySession, [sessionId]: effort } }));
  },

  fetchSessionMode: (sessionId, workspaceIdParam) => {
    const state = get();
    if (!sessionId) return null;
    const hostId = hostForSession(state, sessionId);
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.modeGet)) return null;
    const key = `mode:${sessionId}`;
    const existing = latestAgentRuntimeRequestByKey.get(key);
    if (existing && pendingAgentRuntimeRequests.has(existing)) return existing;
    const workspaceId = workspaceForSession(state, sessionId, workspaceIdParam);
    const requestId = newId();
    const current = state.sessionModes[sessionId];
    set((currentState) => ({
      sessionModes: {
        ...currentState.sessionModes,
        [sessionId]: {
          ...(current ?? {
            mode: currentState.settings?.chatMode ?? "hosted",
            scope: "default" as const,
            revision: 0,
            deviceId: currentState.deviceId,
          }),
          state: "loading",
          error: undefined,
        },
      },
    }));
    beginAgentRuntimeRequest(requestId, {
      kind: "mode",
      key,
      sessionId,
    });
    socket.send({
      type: "session.mode.get",
      requestId,
      sessionId,
      deviceId: state.deviceId,
      ...(workspaceId ? { workspaceId } : {}),
    });
    return requestId;
  },

  setSessionMode: (sessionId, scope, mode, workspaceIdParam, clearOverride = false) => {
    const state = get();
    if (!sessionId) return null;
    const hostId = hostForSession(state, sessionId);
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.modeSet)) return null;
    if (scope === "workspace" && !workspaceForSession(state, sessionId, workspaceIdParam)) return null;
    if (!clearOverride && !mode) return null;
    const key = `mode:${sessionId}`;
    const existing = latestAgentRuntimeRequestByKey.get(key);
    if (existing && pendingAgentRuntimeRequests.has(existing)) return existing;
    const workspaceId = workspaceForSession(state, sessionId, workspaceIdParam);
    const requestId = newId();
    set((currentState) => {
      const current = currentState.sessionModes[sessionId];
      return {
        sessionModes: {
          ...currentState.sessionModes,
          [sessionId]: {
            ...(current ?? {
              mode: currentState.settings?.chatMode ?? "hosted",
              scope: "default" as const,
              revision: 0,
              deviceId: currentState.deviceId,
            }),
            state: "loading",
            error: undefined,
          },
        },
      };
    });
    beginAgentRuntimeRequest(requestId, {
      kind: "mode",
      key,
      sessionId,
    });
    socket.send({
      type: "session.mode.set",
      requestId,
      sessionId,
      deviceId: state.deviceId,
      scope,
      ...(workspaceId ? { workspaceId } : {}),
      ...(mode ? { mode } : {}),
      ...(clearOverride ? { clearOverride: true } : {}),
    });
    return requestId;
  },

  fetchAgentManifests: (hostIdParam, update) => {
    const state = get();
    const hostId = hostIdParam ?? state.activeHostId;
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.manifests)) return null;
    if (update && !hasAgentRuntimeCapability(state, hostId, "agent.provider.configure")) return null;
    const key = `manifests:${hostId}`;
    const existing = latestAgentRuntimeRequestByKey.get(key);
    if (existing && pendingAgentRuntimeRequests.has(existing)) return existing;
    const requestId = newId();
    set((currentState) => ({
      agentManifestsByHost: {
        ...currentState.agentManifestsByHost,
        [hostId]: {
          ...(currentState.agentManifestsByHost[hostId] ?? { manifests: [] }),
          state: "loading",
          error: undefined,
        },
      },
    }));
    beginAgentRuntimeRequest(requestId, {
      kind: "manifests",
      key,
      hostId,
    });
    const message: AgentManifestListMessage = {
      type: "agent.manifest.list",
      requestId,
      ...(hostId !== "local" ? { hostId } : {}),
    };
    socket.send(update ? { ...message, ...update, type: "agent.provider.configure" } : message);
    return requestId;
  },

  fetchAgentLifecycle: (sessionId, workspaceIdParam, agentIdParam) => {
    const state = get();
    if (!sessionId) return null;
    const hostId = hostForSession(state, sessionId);
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.lifecycle)) return null;
    const workspaceId = workspaceForSession(state, sessionId, workspaceIdParam);
    const agentId = agentIdParam ?? state.cliAgentBySession[sessionId] ?? state.hostedAgentBySession[sessionId] ?? state.agent;
    const key = `lifecycle:${workspaceId ?? ""}:${sessionId}:${agentId}`;
    const existing = latestAgentRuntimeRequestByKey.get(key);
    if (existing && pendingAgentRuntimeRequests.has(existing)) return existing;
    const requestId = newId();
    const current = state.agentLifecycleByKey[key];
    set((currentState) => ({
      agentLifecycleByKey: {
        ...currentState.agentLifecycleByKey,
        [key]: {
          ...(current ?? { state: "idle" as const }),
          state: "loading",
          error: undefined,
        },
      },
    }));
    beginAgentRuntimeRequest(requestId, {
      kind: "lifecycle",
      key,
      sessionId,
      agentId,
    });
    socket.send({
      type: "agent.lifecycle.get",
      requestId,
      sessionId,
      ...(workspaceId ? { workspaceId } : {}),
      ...(agentId ? { agentId } : {}),
    });
    return requestId;
  },

  acquireAgentControl: (sessionId, agentId, channel, workspaceIdParam) => {
    const state = get();
    if (!sessionId || !agentId) return null;
    const hostId = hostForSession(state, sessionId);
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.acquire)) return null;
    const workspaceId = workspaceForSession(state, sessionId, workspaceIdParam);
    const key = `control:${sessionId}:${agentId}:${channel}`;
    const inFlight = beginAgentControlOptimisticUpdate(key, sessionId, agentId);
    if (inFlight) return inFlight;
    const requestId = newId();
    beginAgentRuntimeRequest(requestId, {
      kind: "control",
      key,
      sessionId,
      agentId,
      channel,
    });
    socket.send({
      type: "agent.control.acquire",
      requestId,
      sessionId,
      ...(workspaceId ? { workspaceId } : {}),
      agentId,
      channel,
    });
    return requestId;
  },

  releaseAgentControl: (sessionId, agentId, channel, generation, workspaceIdParam) => {
    const state = get();
    if (!sessionId || !agentId || !Number.isSafeInteger(generation) || generation < 1) return null;
    const hostId = hostForSession(state, sessionId);
    if (!state.connected || !hasAgentRuntimeCapability(state, hostId, AGENT_RUNTIME_CAPABILITIES.release)) return null;
    const workspaceId = workspaceForSession(state, sessionId, workspaceIdParam);
    const key = `control:${sessionId}:${agentId}:${channel}`;
    const inFlight = beginAgentControlOptimisticUpdate(key, sessionId, agentId);
    if (inFlight) return inFlight;
    const requestId = newId();
    beginAgentRuntimeRequest(requestId, {
      kind: "control",
      key,
      sessionId,
      agentId,
      channel,
    });
    socket.send({
      type: "agent.control.release",
      requestId,
      sessionId,
      ...(workspaceId ? { workspaceId } : {}),
      agentId,
      channel,
      generation,
    });
    return requestId;
  },

  approvePlan: (messageId) => {
    // The card can live in any session's bucket, not just the active one
    // (a plan card in a background split pane) — search all of them rather
    // than assuming `messages` (the active-session mirror) has it.
    set((state) => {
      for (const [sid, msgs] of Object.entries(state.messagesBySession)) {
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx === -1) continue;
        const updated = msgs.map((m) => (m.id === messageId ? { ...m, planApproved: true } : m));
        return {
          messagesBySession: { ...state.messagesBySession, [sid]: updated },
          ...(state.sessionId === sid ? { messages: updated } : {}),
        };
      }
      return {};
    });
  },

  sendChat: (text, options, sessionIdParam) => {
    const state = get();
    const sessionId = sessionIdParam ?? state.sessionId;
    if (!sessionId || !text.trim()) return;
    const { agent, model, effortBySession } = state;
    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      text,
      thinking: "",
      tools: [],
      streaming: false,
    };
    const assistantMessage = makeAssistantMessage(agent, model);
    setSessionMessages(sessionId, [...sessionMessages(sessionId), userMessage, assistantMessage]);
    setSessionStreamingId(sessionId, assistantMessage.id);
    // "default" is a client-side sentinel — omit the field entirely so the
    // CLI keeps its own default (see EFFORT_OPTIONS).
    const effort = effortBySession[sessionId];
    socket.send({
      type: "chat.send",
      sessionId,
      text,
      agent,
      model,
      ...(options?.planMode ? { planMode: true } : {}),
      ...(effort && effort !== "default" ? { effort } : {}),
      ...(options?.attachments?.length ? { attachments: options.attachments } : {}),
    });
  },

  cancelChat: (sessionIdParam) => {
    const sessionId = sessionIdParam ?? get().sessionId;
    if (!sessionId) return;
    socket.send({ type: "chat.cancel", sessionId });
  },

  ensureSessionLive: (sessionId) => {
    const state = get();
    if (sessionId === state.sessionId) return;
    if (sessionId in state.messagesBySession) return;
    if (pendingBackgroundLoads.has(sessionId)) return; // already loading
    pendingBackgroundLoads.set(sessionId, state.sessionId);
    socket.send({ type: "session.resume", sessionId });
  },

  setAgent: (agent) => {
    const state = get();
    // Prefer the active host's model list; fall back to server.info-derived list.
    const hostModelEntry = state.hostModels[state.activeHostId];
    const available = (hostModelEntry ? hostModelEntry[agent] : undefined) ?? state.availableModels[agent];
    set((s) => ({
      agent,
      model: defaultModel(agent, available),
      // A manual switch mid-session is remembered too, so switching away and
      // back (before any further turn changes `lastAgent` server-side) keeps
      // showing this provider rather than falling back to "claude" — see
      // `resolveSessionAgent`.
      hostedAgentBySession: s.sessionId
        ? { ...s.hostedAgentBySession, [s.sessionId]: agent }
        : s.hostedAgentBySession,
    }));
  },

  setModel: (model) => {
    set({ model });
  },

  listSessions: () => {
    socket.send({ type: "session.list" });
  },

  createSession: () => {
    // Delegate to createSessionOnHost("local") — it applies the Fix 3 smart-
    // create guard (no duplicate blank sessions) and uses the unified path.
    get().createSessionOnHost("local");
  },

  switchSession: (sessionId) => {
    if (get().sessionId === sessionId) return;
    // Look up last agent/model from the sessions list and update the dropdowns
    // so they reflect the session being switched to, not the one left behind.
    const s = get().sessions.find((s) => s.id === sessionId);
    const newAgent: AgentKind = resolveSessionAgent(s, get().hostedAgentBySession, sessionId);
    const newHostId = s?.hostId ?? "local";
    // Use the active host's model list for reconciliation; fall back to
    // local availableModels when the host has no model info yet.
    const hostModelEntry = get().hostModels[newHostId];
    const available = hostModelEntry?.[newAgent] ?? get().availableModels[newAgent];
    const newModel = s?.lastModel ?? defaultModel(newAgent, available);
    // Opening a session from *anywhere* (sidebar row, tab, Navigator, mobile
    // switcher, toast) re-scopes the nav onto that session's host + project.
    const newProject = s?.cwd ? { hostId: newHostId, cwd: s.cwd } : get().activeProject;
    const stableProjectId = s?.projectId ?? get().workspaceProjects.find(
      (project) => project.hostId === newHostId && project.path === s?.cwd && !project.archived,
    )?.id ?? null;
    const stableWorkspaceId = s?.workspaceId ?? (stableProjectId
      ? get().workspaces.find((workspace) => workspace.projectId === stableProjectId && workspace.state !== "archived")?.id ?? null
      : null);
    writeActiveHostStored(newHostId);
    writeActiveProjectStored(newProject);
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, stableProjectId);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, stableWorkspaceId);
    flushChunkBuffer();
    // If a background load for this session is already in flight (a split
    // pane mounted it before this switch), promote it to an ordinary switch
    // instead of racing a second resume against it — see
    // `pendingBackgroundLoads`'s doc comment.
    pendingBackgroundLoads.delete(sessionId);
    set((state) => ({
      // Show whatever this session's bucket already holds (cached from an
      // earlier load this page session) instead of flashing blank — the
      // fresh session.history reply that's about to arrive will reconcile
      // it, and the merge in that handler preserves any live streaming text
      // already accumulated here rather than dropping it.
      messages: state.messagesBySession[sessionId] ?? [],
      streamingMessageId: state.streamingMessageIdBySession[sessionId] ?? null,
      agent: newAgent,
      model: newModel,
      cliError: null,
      activeHostId: newHostId,
      activeProject: newProject,
      activeProjectId: stableProjectId,
      activeWorkspaceId: stableWorkspaceId,
    }));
    if (stableWorkspaceId && hasWorkspaceCapability(get(), newHostId, WORKSPACE_CAPABILITIES.workspaceFocus)) {
      const requestId = newId();
      sendWorkspaceMessage(
        { type: "workspace.focus", requestId, workspaceId: stableWorkspaceId },
        newHostId,
        WORKSPACE_CAPABILITIES.workspaceFocus,
      );
    }
    socket.switchSession(sessionId);
  },

  setActiveHost: (hostId) => {
    // Always persist, even when the host is unchanged: writing closes the
    // one-shot `navSeedPending` latch, so an explicit "stay on this host"
    // click is as binding as a switch.
    writeActiveHostStored(hostId);
    if (get().activeHostId === hostId) return;
    writeActiveProjectStored(null);
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, null);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, null);
    set({
      activeHostId: hostId,
      activeProject: null,
      activeProjectId: null,
      activeWorkspaceId: null,
    });
    if (get().connected) get().fetchWorkspaceSnapshot(hostId);
  },

  setActiveProject: (hostId, cwd) => {
    const stableProject = get().workspaceProjects.find(
      (project) => project.hostId === hostId && project.path === cwd && !project.archived,
    );
    if (stableProject && hasWorkspaceCapability(get(), hostId, WORKSPACE_CAPABILITIES.projectFocus)) {
      get().focusWorkspaceProject(stableProject.id);
      return;
    }
    writeActiveHostStored(hostId);
    writeActiveProjectStored({ hostId, cwd });
    const stableWorkspace = stableProject
      ? get().workspaces.find((workspace) => workspace.projectId === stableProject.id)
      : undefined;
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, stableProject?.id ?? null);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, stableWorkspace?.id ?? null);
    set({
      activeHostId: hostId,
      activeProject: { hostId, cwd },
      activeProjectId: stableProject?.id ?? null,
      activeWorkspaceId: stableWorkspace?.id ?? null,
    });
  },

  fetchWorkspaceSnapshot: (hostIdParam, projectId) => {
    const state = get();
    const hostId = hostIdParam ?? state.activeHostId;
    if (!state.connected || !hasWorkspaceCapability(state, hostId, WORKSPACE_CAPABILITIES.snapshot)) return;
    const requestId = newId();
    set((current) => ({
      workspaceSnapshotByHost: {
        ...current.workspaceSnapshotByHost,
        [hostId]: { ...current.workspaceSnapshotByHost[hostId], state: "loading", error: undefined },
      },
    }));
    const message = {
      type: "workspace.snapshot" as const,
      requestId,
      ...(hostId !== "local" ? { hostId } : {}),
      ...(projectId ? { projectId } : {}),
    };
    sendWorkspaceMessage(message, hostId, WORKSPACE_CAPABILITIES.snapshot, { projectId });
  },

  createWorkspaceProject: (path, name, hostIdParam) => {
    const state = get();
    const hostId = hostIdParam ?? state.activeHostId;
    const trimmedPath = path.trim();
    if (!trimmedPath || !state.connected || !hasWorkspaceCapability(state, hostId, WORKSPACE_CAPABILITIES.projectCreate)) return null;
    if (state.workspaceProjectCreate?.status === "pending") return null;
    const requestId = newId();
    set({
      workspaceProjectCreate: {
        requestId,
        hostId,
        path: trimmedPath,
        ...(name?.trim() ? { name: name.trim() } : {}),
        status: "pending",
      },
    });
    sendWorkspaceMessage(
      {
        type: "project.create",
        requestId,
        ...(hostId !== "local" ? { hostId } : {}),
        path: trimmedPath,
        ...(name?.trim() ? { name: name.trim() } : {}),
      },
      hostId,
      WORKSPACE_CAPABILITIES.projectCreate,
    );
    return requestId;
  },

  clearWorkspaceProjectCreate: () => {
    set({ workspaceProjectCreate: null });
  },

  focusWorkspaceProject: (projectId) => {
    const state = get();
    const project = state.workspaceProjects.find((candidate) => candidate.id === projectId);
    if (!project || project.archived) return;
    if (!state.connected) return;
    const previousFocus = {
      projectId: state.activeProjectId,
      workspaceId: state.activeWorkspaceId,
      legacy: state.activeProject,
    };
    writeActiveHostStored(project.hostId);
    writeActiveProjectStored({ hostId: project.hostId, cwd: project.path });
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, project.id);
    const workspace = state.workspaces.find((candidate) => candidate.projectId === project.id && candidate.state !== "archived");
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspace?.id ?? null);
    set({
      activeHostId: project.hostId,
      activeProject: { hostId: project.hostId, cwd: project.path },
      activeProjectId: project.id,
      activeWorkspaceId: workspace?.id ?? null,
    });
    if (state.connected && hasWorkspaceCapability(state, project.hostId, WORKSPACE_CAPABILITIES.projectFocus)) {
      const requestId = newId();
      latestWorkspaceFocusRequestByHost.set(project.hostId, requestId);
      sendWorkspaceMessage(
        { type: "project.focus", requestId, projectId },
        project.hostId,
        WORKSPACE_CAPABILITIES.projectFocus,
        { previousFocus },
      );
    }
  },

  focusWorkspace: (workspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const project = workspace && state.workspaceProjects.find((candidate) => candidate.id === workspace.projectId);
    if (!workspace || !project || workspace.state === "archived" || project.archived) return;
    if (!state.connected) return;
    const previousFocus = {
      projectId: state.activeProjectId,
      workspaceId: state.activeWorkspaceId,
      legacy: state.activeProject,
    };
    writeActiveHostStored(workspace.hostId);
    writeActiveProjectStored({ hostId: workspace.hostId, cwd: workspace.path });
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, project.id);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspace.id);
    set({
      activeHostId: workspace.hostId,
      activeProject: { hostId: workspace.hostId, cwd: workspace.path },
      activeProjectId: project.id,
      activeWorkspaceId: workspace.id,
    });
    if (state.connected && hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspaceFocus)) {
      const requestId = newId();
      latestWorkspaceFocusRequestByHost.set(workspace.hostId, requestId);
      sendWorkspaceMessage(
        { type: "workspace.focus", requestId, workspaceId },
        workspace.hostId,
        WORKSPACE_CAPABILITIES.workspaceFocus,
        { previousFocus },
      );
    }
  },

  renameWorkspaceProject: (projectId, name) => {
    const state = get();
    const trimmedName = name.trim();
    const project = state.workspaceProjects.find((candidate) => candidate.id === projectId);
    if (!trimmedName || !project || !state.connected || !hasWorkspaceCapability(state, project.hostId, WORKSPACE_CAPABILITIES.projectRename)) return;
    const requestId = newId();
    sendWorkspaceMessage(
      { type: "project.rename", requestId, projectId, name: trimmedName },
      project.hostId,
      WORKSPACE_CAPABILITIES.projectRename,
    );
  },

  archiveWorkspaceProject: (projectId, archived) => {
    const state = get();
    const project = state.workspaceProjects.find((candidate) => candidate.id === projectId);
    if (!project || !state.connected || !hasWorkspaceCapability(state, project.hostId, WORKSPACE_CAPABILITIES.projectArchive)) return;
    const requestId = newId();
    sendWorkspaceMessage(
      { type: "project.archive", requestId, projectId, archived },
      project.hostId,
      WORKSPACE_CAPABILITIES.projectArchive,
    );
  },

  renameWorkspace: (workspaceId, name) => {
    const state = get();
    const trimmedName = name.trim();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!trimmedName || !workspace || !state.connected || !hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspaceRename)) return;
    const requestId = newId();
    sendWorkspaceMessage(
      { type: "workspace.rename", requestId, workspaceId, name: trimmedName },
      workspace.hostId,
      WORKSPACE_CAPABILITIES.workspaceRename,
    );
  },

  pinWorkspace: (workspaceId, pinned) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace || !state.connected || !hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspacePin)) return;
    sendWorkspaceMessage(
      { type: "workspace.pin", requestId: newId(), workspaceId, pinned },
      workspace.hostId,
      WORKSPACE_CAPABILITIES.workspacePin,
    );
  },

  nestWorkspace: (workspaceId, parentWorkspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace || !state.connected || !hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspaceNest)) return;
    sendWorkspaceMessage(
      { type: "workspace.nest", requestId: newId(), workspaceId, ...(parentWorkspaceId ? { parentWorkspaceId } : {}) },
      workspace.hostId,
      WORKSPACE_CAPABILITIES.workspaceNest,
    );
  },

  restoreWorkspace: (workspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace || !state.connected || !hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspaceRestore)) return;
    const requestId = newId();
    sendWorkspaceMessage(
      { type: "workspace.restore", requestId, workspaceId },
      workspace.hostId,
      WORKSPACE_CAPABILITIES.workspaceRestore,
    );
  },

  workspaceFilesWorkspaceId: null,
  openWorkspaceFiles: (workspaceId) => {
    if (workspaceId) set({ workspaceFilesWorkspaceId: workspaceId });
  },
  closeWorkspaceFiles: () => {
    set({ workspaceFilesWorkspaceId: null });
  },

  workspaceGitReviewWorkspaceId: null,
  openWorkspaceGitReview: (workspaceId) => {
    if (workspaceId) set({ workspaceGitReviewWorkspaceId: workspaceId });
  },
  closeWorkspaceGitReview: () => {
    set({ workspaceGitReviewWorkspaceId: null });
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open, settingsPage: "main" });
  },
  openAgentCatalog: () => set({ settingsOpen: true, settingsPage: "agents" }),

  fetchSettings: () => {
    socket.send({ type: "settings.get" });
  },

  updateSettings: (patch) => {
    socket.send({ type: "settings.update", patch });
  },

  fetchHosts: () => {
    socket.send({ type: "hosts.list" });
  },

  upsertHost: (host) => {
    socket.send({ type: "hosts.upsert", host });
  },

  deleteHost: (id) => {
    socket.send({ type: "hosts.delete", id });
  },

  createSessionOnHost: (hostId, cwd, agentChoice, mode) => {
    // Fix 3: If the active session on this host has no messages (empty) and
    // no different cwd is requested, just focus the composer — don't create
    // another blank session.
    //
    // CLI mode is deliberately exempt: the PTY conversation is never recorded
    // as hosted messages, so `messages.length === 0` is true for *every* CLI
    // session — including one whose `claude`/`codex` process has already
    // exited (e.g. the user typed `/exit`). Reusing it would turn "New
    // session" into a silent no-op on a dead pane. In CLI mode emptiness
    // proves nothing, so always create.
    //
    // Bug 1: the guard requires an actual `currentSession` to exist — see
    // `shouldReuseCurrentSession`. With `sessionId: null` (no session open at
    // all) there is nothing to focus, so it must not fire.
    const state = get();
    // A runtime-capable peer stores mode policy per session. Fall back to the
    // legacy global setting only when this session has no mode result yet.
    const cliMode = (mode ?? sessionModeStateFor(state, state.sessionId)) === "cli";
    if (shouldReuseCurrentSession(state, hostId, cwd, cliMode, state.messages.length === 0)) {
      // Already on an empty session for this host — just focus the composer.
      return;
    }
    // Clear local UI state so the view is blank while waiting for
    // session.created + session.history.
    //
    // Re-scope the nav onto the requested project. An absolute cwd can be
    // pinned right away; "~" (the "No project" quick-pick) and an omitted cwd
    // only resolve server-side, so arm `expectProjectFromStatus` instead and
    // let the `status.update` that always follows `session.create` supply the
    // resolved path. The flag is deliberately NOT armed by every
    // `session.created` — the transport mints a blank session on every
    // connect (see ws.ts), and that housekeeping create must not drag the
    // sidebar off whatever project the user was last looking at.
    writeActiveHostStored(hostId);
    flushChunkBuffer();
    // The user asked for this session, so CLI mode is allowed to launch into
    // it as soon as its id comes back — unlike the blank session the
    // transport mints on every connect. See `expectCliStart`.
    expectCliStart = true;
    // Carry the provider choice (if any) through the same round trip — see
    // `pendingAgentForNewSession`. Always (re)armed, including to `null`, so
    // a stale choice from an earlier call can never leak onto an unrelated
    // create.
    pendingAgentForNewSession = agentChoice ?? null;
    // `undefined` means "no session-scoped override": the new session takes
    // the device default, which is what goals.md asks for ("a device default
    // and a per-session override"). Only a launcher whose whole purpose is a
    // CLI start (`CliStartPanel`) passes an explicit mode — the ordinary
    // "New session" launchers used to hardcode "cli", which made the device
    // default dead on arrival for every session a user creates.
    pendingModeForNewSession = mode ?? null;
    if (cwd && cwd.startsWith("/")) {
      writeActiveProjectStored({ hostId, cwd });
      set({ messages: [], streamingMessageId: null, activeHostId: hostId, activeProject: { hostId, cwd } });
    } else {
      expectProjectFromStatus = hostId;
      set({ messages: [], streamingMessageId: null, activeHostId: hostId });
    }
    if (hostId === "local") {
      // Clear stored session id so a mid-flight reconnect doesn't resume the
      // old session before session.created arrives (same as socket.newSession()).
      try { localStorage.removeItem("perch.sessionId"); } catch { /* ignore */ }
      const msg: { type: "session.create"; cwd?: string } = { type: "session.create" };
      if (cwd) msg.cwd = cwd;
      socket.send(msg);
    } else {
      // Clear the stored sessionId so a mid-flight reconnect doesn't try
      // to resume the old session before session.created arrives.
      try { localStorage.removeItem("perch.sessionId"); } catch { /* ignore */ }
      const msg: { type: "session.create"; hostId: string; cwd?: string } = {
        type: "session.create",
        hostId,
      };
      if (cwd) msg.cwd = cwd;
      socket.send(msg);
    }
  },

  archiveSession: (sessionId, archived) => {
    socket.send({ type: "session.archive", sessionId, archived });
  },

  deleteSession: (sessionId) => {
    socket.send({ type: "session.delete", sessionId });
  },

  renameSession: (sessionId, title) => {
    socket.send({ type: "session.rename", sessionId, title });
  },

  browseDirectory: (hostId, path) => {
    return new Promise<FsBrowseResultMessage>((resolve) => {
      const requestId = newId();
      pendingBrowses.set(requestId, resolve);
      const msg: { type: "fs.browse"; requestId: string; hostId?: string; path?: string } = {
        type: "fs.browse",
        requestId,
      };
      if (hostId && hostId !== "local") msg.hostId = hostId;
      if (path) msg.path = path;
      socket.send(msg);
    });
  },

  listWorktrees: (hostId, repoPath) => {
    return sendWorktreeRequest({ type: "worktree.list", requestId: "", hostId, repoPath });
  },

  createWorktree: (hostId, repoPath, branch, newBranch, path, extra) => {
    return sendWorktreeRequest({
      type: "worktree.create",
      requestId: "",
      hostId,
      repoPath,
      branch,
      newBranch,
      ...(path ? { path } : {}),
      ...(extra?.name ? { name: extra.name } : {}),
      ...(extra?.startFrom ? { startFrom: extra.startFrom } : {}),
      ...(extra?.parentWorkspaceId ? { parentWorkspaceId: extra.parentWorkspaceId } : {}),
    });
  },

  removeWorktree: (hostId, repoPath, path, force, deleteBranch) => {
    return sendWorktreeRequest({
      type: "worktree.remove",
      requestId: "",
      hostId,
      repoPath,
      path,
      force,
      ...(deleteBranch ? { deleteBranch } : {}),
    });
  },

  deleteWorktreeBranch: (hostId, repoPath, branch, expectedHead) => {
    return sendWorktreeRequest({
      type: "worktree.branch.delete",
      requestId: "",
      hostId,
      repoPath,
      branch,
      expectedHead,
    });
  },

  startWorktreeJob: (repoPath, branch, newBranch, path, extra) => {
    return sendWorktreeRequest({
      type: "worktree.job.start",
      requestId: "",
      hostId: "local",
      repoPath,
      branch,
      newBranch,
      ...(path ? { path } : {}),
      ...(extra?.name ? { name: extra.name } : {}),
      ...(extra?.startFrom ? { startFrom: extra.startFrom } : {}),
      ...(extra?.parentWorkspaceId ? { parentWorkspaceId: extra.parentWorkspaceId } : {}),
    });
  },
  cancelWorktreeJob: (jobId) => socket.send({ type: "worktree.job.cancel", jobId }),
  retryWorktreeJob: (jobId) => socket.send({ type: "worktree.job.retry", jobId }),
  dismissWorktreeJob: (jobId) => socket.send({ type: "worktree.job.dismiss", jobId }),

  requestWorktreeMenu: (projectKey) => {
    set((state) => ({
      worktreeMenuRequest: {
        projectKey,
        nonce: (state.worktreeMenuRequest?.nonce ?? 0) + 1,
      },
    }));
  },

  clearWorktreeMenuRequest: () => set({ worktreeMenuRequest: null }),

  fetchSessionLayout: (sessionId) => {
    socket.send({ type: "session.layout.get", sessionId });
  },
  saveSessionLayout: (sessionId, layout) => {
    socket.send({ type: "session.layout.set", sessionId, layout });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  switchSessionRelative: (dir) => {
    const state = get();
    const projectSessions = activeProjectSessions(state);
    if (projectSessions.length < 2) return;
    const idx = projectSessions.findIndex((s) => s.id === state.sessionId);
    const base = idx === -1 ? 0 : idx;
    const next = projectSessions[(base + dir + projectSessions.length) % projectSessions.length];
    if (next && next.id !== state.sessionId) get().switchSession(next.id);
  },

  createTerminal: (cols, rows, options) => {
    return new Promise<string>((resolve) => {
      pendingTerminals.push({ cols, rows, resolve });
      socket.send({
        type: "terminal.create",
        cols,
        rows,
        cwd: options?.cwd,
        agentAttach: options?.agentAttach,
      });
    });
  },

  startCli: (sessionId, agent) => {
    set((state) => ({
      cliStartedSessions: { ...state.cliStartedSessions, [sessionId]: true },
      cliAgentBySession: agent
        ? { ...state.cliAgentBySession, [sessionId]: agent }
        : state.cliAgentBySession,
    }));
  },

  attachAgentCli: (sessionId, agent, cols = 80, rows = 24) => {
    const existing = get().cliTerminalIds[sessionId];
    // Evict stale cache entry if the cached terminal has already exited, so we
    // fall through and spawn a fresh PTY instead of reattaching the dead one.
    if (existing) {
      const exitCode = get().terminals[existing]?.exitCode ?? null;
      if (exitCode == null) {
        // Still alive — reattach.
        return Promise.resolve(existing);
      }
      // Dead — remove from cache (and the stale terminals entry) and fall through.
      set((state) => {
        const { [sessionId]: _removed, ...restCli } = state.cliTerminalIds;
        const { [existing]: _dead, ...restTerminals } = state.terminals;
        return { cliTerminalIds: restCli, terminals: restTerminals };
      });
    }
    set({ attachingCliForSession: sessionId, cliError: null });
    return get()
      .createTerminal(cols, rows, { agentAttach: { sessionId, agent } })
      .then((id) => {
        set((state) => ({
          cliTerminalIds: { ...state.cliTerminalIds, [sessionId]: id },
          attachingCliForSession: null,
        }));
        return id;
      });
  },

  sendTerminalInput: (terminalId, data) => {
    if (sendAgentTerminalInput(terminalId, data)) return;
    const state = get();
    const sessionId = Object.entries(state.cliTerminalIds).find(([, id]) => id === terminalId)?.[0];
    const control = sessionId ? state.agentControlBySession[sessionId] : undefined;
    const generation = control?.input?.generation;
    socket.send({
      type: "terminal.input",
      terminalId,
      data,
      ...(generation != null ? { generation } : {}),
    });
  },

  resizeTerminal: (terminalId, cols, rows) => {
    if (resizeAgentTerminal(terminalId, cols, rows)) return;
    const state = get();
    const sessionId = Object.entries(state.cliTerminalIds).find(([, id]) => id === terminalId)?.[0];
    const control = sessionId ? state.agentControlBySession[sessionId] : undefined;
    const generation = control?.resize?.generation;
    socket.send({
      type: "terminal.resize",
      terminalId,
      cols,
      rows,
      ...(generation != null ? { generation } : {}),
    });
    set((state) => {
      const existing = state.terminals[terminalId];
      if (!existing) return state;
      return {
        terminals: { ...state.terminals, [terminalId]: { ...existing, cols, rows } },
      };
    });
  },

  killTerminal: (terminalId) => {
    socket.send({ type: "terminal.kill", terminalId });
    set((state) => {
      const { [terminalId]: _dead, ...terminals } = state.terminals;
      let cliTerminalIds = state.cliTerminalIds;
      for (const [sid, tid] of Object.entries(state.cliTerminalIds)) {
        if (tid === terminalId) {
          if (cliTerminalIds === state.cliTerminalIds) cliTerminalIds = { ...state.cliTerminalIds };
          delete cliTerminalIds[sid];
        }
      }
      return { terminals, cliTerminalIds };
    });
  },
}));

/** Build a fresh streaming-assistant placeholder. Shared by `sendChat` (the
 * initiating client) and `adoptStreamingMessage` (any other client that
 * observes a turn it didn't start) so the two can never drift apart. */
function makeAssistantMessage(agent?: AgentKind, model?: string): ChatMessage {
  return {
    id: newId(),
    role: "assistant",
    text: "",
    thinking: "",
    tools: [],
    streaming: true,
    agent,
    model,
  };
}

/** Read one session's message bucket (empty array if it has none yet). */
function sessionMessages(sessionId: string): ChatMessage[] {
  return usePerchStore.getState().messagesBySession[sessionId] ?? [];
}

/** Replace one session's message bucket, keeping the `messages` mirror field
 * in sync whenever that session happens to be the globally active one — see
 * `PerchState.messages`'s doc comment for why the mirror exists. */
function setSessionMessages(sessionId: string, messages: ChatMessage[]): void {
  usePerchStore.setState((state) => ({
    messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    ...(state.sessionId === sessionId ? { messages } : {}),
  }));
}

/** Read one session's streaming-message id (`null` if it has none). */
function sessionStreamingId(sessionId: string): string | null {
  return usePerchStore.getState().streamingMessageIdBySession[sessionId] ?? null;
}

/** Set one session's streaming-message id, keeping the `streamingMessageId`
 * mirror in sync for the active session — same convention as
 * `setSessionMessages`. */
function setSessionStreamingId(sessionId: string, streamingMessageId: string | null): void {
  usePerchStore.setState((state) => ({
    streamingMessageIdBySession: { ...state.streamingMessageIdBySession, [sessionId]: streamingMessageId },
    ...(state.sessionId === sessionId ? { streamingMessageId } : {}),
  }));
}

/** Immutably patch `sessionId`'s currently-streaming assistant message, if
 * it has one. */
function updateStreamingMessage(sessionId: string, update: (msg: ChatMessage) => ChatMessage): void {
  const streamingId = sessionStreamingId(sessionId);
  if (!streamingId) return;
  setSessionMessages(sessionId, sessionMessages(sessionId).map((m) => (m.id === streamingId ? update(m) : m)));
}

/**
 * There is no `chat.start` message on the wire — the streaming assistant
 * bubble is normally minted client-side by whichever page called `sendChat`.
 * Any *other* client watching the same session (a second tab, or any client
 * live during detached-turn recovery, which re-emits a whole turn's worth of
 * `chat.*` events to every connection) never had a `streamingMessageId` to
 * begin with, so `updateStreamingMessage`'s `if (!streamingId) return` would
 * silently drop the entire turn.
 *
 * Called at the top of every `chat.chunk`/`chat.thinking`/`chat.tool_use`/
 * `chat.tool_result` handler: if this client is already tracking a streaming
 * message for `sessionId`, it's a no-op. Otherwise, only when the session is
 * *known* to this client — the active session, or any session whose bucket
 * already exists in `messagesBySession` (loaded at least once this page
 * load, e.g. by an open split pane) — does it adopt by minting a placeholder
 * and wiring up that session's `streamingMessageIdBySession` entry.
 *
 * The `false` return is load-bearing and not merely an optimisation: the
 * server's hub forwarder relays detached-turn events to *every* connection
 * with no session filtering (the `DetachedSink` broadcast in server.rs), so a
 * client with session A open really does receive session B's chunks. Callers
 * MUST ignore the event entirely when this returns false — otherwise a
 * session nobody has ever opened in this client would spring into existence
 * in `messagesBySession`, unboundedly, from mere broadcast traffic.
 */
function adoptStreamingMessage(sessionId: string): boolean {
  const state = usePerchStore.getState();
  const known = sessionId === state.sessionId || sessionId in state.messagesBySession;
  if (!known) return false;
  if (sessionStreamingId(sessionId)) return true;
  // Prefer this session's own recorded provider choice over the globally
  // active agent/model — meaningful once a background pane's session
  // differs from whatever the foreground currently has selected.
  const agent = state.hostedAgentBySession[sessionId] ?? state.agent;
  const assistantMessage = makeAssistantMessage(agent, state.model);
  setSessionMessages(sessionId, [...sessionMessages(sessionId), assistantMessage]);
  setSessionStreamingId(sessionId, assistantMessage.id);
  return true;
}

/**
 * `chat.chunk` arrives token-by-token and, unbuffered, drove one full
 * `messages` array copy (+ full-transcript re-render) per token. Coalesce a
 * burst of chunks into a single store write per animation frame instead —
 * one buffer + one scheduled frame *per session*, so two sessions streaming
 * concurrently (two split panes) accumulate independently rather than
 * interleaving into whichever session flushes first.
 *
 * Correctness-critical: any code path that can read or replace a session's
 * messages must flush that session's buffer (or call `flushChunkBuffer()`
 * with no argument to flush every pending session) synchronously first, or
 * trailing tokens can be silently dropped (the buffer applies via
 * `updateStreamingMessage`, which itself no-ops once that session's
 * streaming id is cleared/changed — so a flush that arrives "too late" loses
 * text rather than misapplying it). Every `handleServerMessage` case other
 * than "chat.chunk" flushes (all sessions) up front, and every store action
 * that resets `messages`/`streamingMessageId` does the same.
 */
const chunkBuffers = new Map<string, string>();
const chunkRafs = new Map<string, number>();

/** Exported for `store.test.ts` only. */
export function flushChunkBuffer(sessionId?: string): void {
  const ids = sessionId != null ? [sessionId] : [...chunkBuffers.keys()];
  for (const id of ids) {
    const raf = chunkRafs.get(id);
    if (raf != null) {
      cancelAnimationFrame(raf);
      chunkRafs.delete(id);
    }
    const text = chunkBuffers.get(id);
    if (!text) {
      chunkBuffers.delete(id);
      continue;
    }
    chunkBuffers.delete(id);
    updateStreamingMessage(id, (m) => ({
      ...m,
      text: m.text + text,
      turnStartedAt: m.turnStartedAt ?? Date.now(),
    }));
  }
}

function scheduleChunkFlush(sessionId: string): void {
  if (chunkRafs.has(sessionId)) return;
  const raf = requestAnimationFrame(() => {
    chunkRafs.delete(sessionId);
    flushChunkBuffer(sessionId);
  });
  chunkRafs.set(sessionId, raf);
}

/**
 * The active session just went away — it was deleted, or archived (archiving
 * hides a session everywhere, so an open archived chat must be closed exactly
 * the way a deleted one is). Switch to the most recent remaining session on
 * the same host, else the most recent on any host, else fall back to a
 * blank/empty state. `candidates` must already exclude the departing session
 * (and any other session that is no longer selectable, i.e. archived ones).
 */
function switchAwayFromActiveSession(candidates: SessionSummary[], activeHostId: string): void {
  const byRecency = (a: SessionSummary, b: SessionSummary) => b.createdAt - a.createdAt;
  const sameHost = candidates
    .filter((s) => (s.hostId ?? "local") === activeHostId)
    .sort(byRecency);
  const anyHost = candidates.slice().sort(byRecency);
  const next = sameHost[0] ?? anyHost[0];
  if (next) {
    usePerchStore.getState().switchSession(next.id);
    return;
  }
  try {
    localStorage.removeItem("perch.sessionId");
  } catch {
    // ignore
  }
  flushChunkBuffer();
  writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, null);
  writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, null);
  usePerchStore.setState({
    sessionId: null,
    messages: [],
    streamingMessageId: null,
    cliError: null,
    activeProjectId: null,
    activeWorkspaceId: null,
  });
}

type WorkspaceWireMessage = {
  type: string;
  requestId?: string;
  hostId?: string;
  snapshotEpoch?: string;
  snapshotRevision?: number;
  project?: WorkspaceProject;
  projectId?: string;
  projects?: WorkspaceProject[];
  workspace?: WorkspaceRecord;
  workspaceId?: string;
  workspaces?: WorkspaceRecord[];
  activeProjectId?: string;
  activeWorkspaceId?: string;
};

function replaceHostRecords<T extends { hostId: string }>(
  current: T[],
  incoming: T[],
  hostId: string,
): T[] {
  return [...current.filter((record) => record.hostId !== hostId), ...incoming];
}

function mergeHostRecordsScoped<T extends { hostId: string; id: string }>(
  current: T[],
  incoming: T[],
  hostId: string,
  projectId?: string,
): T[] {
  const incomingIds = new Set(incoming.filter((record) => record.hostId === hostId).map((record) => record.id));
  return [
    ...current.filter((record) =>
      record.hostId !== hostId && !incomingIds.has(record.id) ||
      record.hostId === hostId && !incomingIds.has(record.id) &&
        (!("projectId" in record) || !projectId || (record as { projectId?: string }).projectId !== projectId),
    ),
    ...incoming,
  ];
}

function stableLegacyProject(
  project: WorkspaceProject | undefined,
  workspace: WorkspaceRecord | undefined,
): ActiveProject | null {
  const path = workspace?.path ?? project?.path;
  if (!path) return null;
  return { hostId: workspace?.hostId ?? project?.hostId ?? "local", cwd: path };
}

function staleWorkspaceFrame(
  state: Pick<PerchState, "workspaceSnapshotByHost">,
  hostId: string,
  epoch: string | undefined,
  revision: number | undefined,
): boolean {
  const previous = state.workspaceSnapshotByHost[hostId];
  return previous != null && previous.snapshotEpoch === epoch &&
    previous.revision != null &&
    revision != null &&
    revision < previous.revision;
}

function workspaceRevisionStatus(
  current: Record<string, WorkspaceSnapshotStatus>,
  hostId: string,
  epoch: string | undefined,
  revision: number | undefined,
): WorkspaceSnapshotStatus {
  const previous = current[hostId];
  return {
    ...previous,
    state: "ready",
    ...(epoch !== undefined ? { snapshotEpoch: epoch } : {}),
    ...(revision !== undefined ? { revision } : {}),
    error: undefined,
  };
}

/** Apply the additive project/workspace messages before the legacy switch. A
 * boolean return keeps this handler tolerant of older peers and lets the
 * existing `error`/session cases continue to own their messages. */
function handleWorkspaceMessage(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const msg = raw as WorkspaceWireMessage;
  const hostId = msg.hostId || msg.project?.hostId || msg.workspace?.hostId || "local";
  const state = usePerchStore.getState();

  if (msg.type === "workspace.snapshot" && Array.isArray(msg.projects) && Array.isArray(msg.workspaces)) {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : 0;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    const activeProject = msg.activeProjectId
      ? msg.projects.find((project) => project.id === msg.activeProjectId)
      : undefined;
    const activeWorkspace = msg.activeWorkspaceId
      ? msg.workspaces.find((workspace) => workspace.id === msg.activeWorkspaceId)
      : undefined;
    const useServerFocus = state.activeHostId === hostId &&
      (!state.activeProjectId || !state.workspaceProjects.some((project) => project.id === state.activeProjectId));
    const nextProjectId = useServerFocus ? msg.activeProjectId ?? null : state.activeProjectId;
    const nextWorkspaceId = useServerFocus ? msg.activeWorkspaceId ?? null : state.activeWorkspaceId;
    const focusedProject = nextProjectId
      ? msg.projects.find((project) => project.id === nextProjectId) ?? state.workspaceProjects.find((project) => project.id === nextProjectId)
      : activeProject;
    const focusedWorkspace = nextWorkspaceId
      ? msg.workspaces.find((workspace) => workspace.id === nextWorkspaceId) ?? state.workspaces.find((workspace) => workspace.id === nextWorkspaceId)
      : activeWorkspace;
    const requestContext = msg.requestId ? pendingWorkspaceRequests.get(msg.requestId) : undefined;
    const scopedProjectId = requestContext?.projectId;
    const createAck = msg.requestId != null && state.workspaceProjectCreate?.requestId === msg.requestId;
    const legacy = state.activeHostId === hostId
      ? stableLegacyProject(focusedProject, focusedWorkspace) ?? state.activeProject
      : state.activeProject;

    if (state.activeHostId === hostId) {
      writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, nextProjectId);
      writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, nextWorkspaceId);
      if (legacy) writeActiveProjectStored(legacy);
    }
    usePerchStore.setState((current) => ({
      workspaceProjects: scopedProjectId
        ? mergeHostRecordsScoped(current.workspaceProjects, msg.projects ?? [], hostId, scopedProjectId)
        : replaceHostRecords(current.workspaceProjects, msg.projects ?? [], hostId),
      workspaces: scopedProjectId
        ? mergeHostRecordsScoped(current.workspaces, msg.workspaces ?? [], hostId, scopedProjectId)
        : replaceHostRecords(current.workspaces, msg.workspaces ?? [], hostId),
      workspaceSnapshotByHost: {
        ...current.workspaceSnapshotByHost,
        [hostId]: { state: "ready", revision, snapshotEpoch: epoch },
      },
      ...(createAck && current.workspaceProjectCreate
        ? { workspaceProjectCreate: { ...current.workspaceProjectCreate, status: "success", error: undefined } }
        : {}),
      ...(state.activeHostId === hostId
        ? {
            activeProjectId: nextProjectId,
            activeWorkspaceId: nextWorkspaceId,
            activeProject: legacy,
          }
        : {}),
    }));
    if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
    return true;
  }

  if (msg.type === "project.list" && Array.isArray(msg.projects)) {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : 0;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    usePerchStore.setState((current) => ({
      workspaceProjects: replaceHostRecords(current.workspaceProjects, msg.projects ?? [], hostId),
      workspaceSnapshotByHost: {
        ...current.workspaceSnapshotByHost,
        [hostId]: { state: "ready", revision, snapshotEpoch: epoch },
      },
    }));
    if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
    return true;
  }

  if (msg.type === "project.updated" && msg.project) {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : undefined;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    const createAck = msg.requestId != null && state.workspaceProjectCreate?.requestId === msg.requestId;
    usePerchStore.setState((current) => {
      const projects = current.workspaceProjects.some((project) => project.id === msg.project?.id)
        ? current.workspaceProjects.map((project) => project.id === msg.project?.id ? msg.project! : project)
        : [...current.workspaceProjects, msg.project!];
      const active = current.activeProjectId === msg.project!.id && current.activeHostId === msg.project!.hostId;
      const legacy = active
        ? stableLegacyProject(msg.project, current.workspaces.find((workspace) => workspace.projectId === msg.project!.id))
        : current.activeProject;
      if (active && legacy) writeActiveProjectStored(legacy);
      return {
        workspaceProjects: projects,
        workspaceSnapshotByHost: {
          ...current.workspaceSnapshotByHost,
          [hostId]: workspaceRevisionStatus(current.workspaceSnapshotByHost, hostId, epoch, revision),
        },
        ...(createAck && current.workspaceProjectCreate
          ? { workspaceProjectCreate: { ...current.workspaceProjectCreate, status: "success", error: undefined } }
          : {}),
        ...(active && legacy ? { activeProject: legacy } : {}),
      };
    });
    if (msg.requestId) {
      const pending = pendingWorkspaceRequests.get(msg.requestId);
      // project.create is answered by a project.updated followed by a
      // workspace.snapshot using the same request id. Keep the context so a
      // filtered snapshot cannot erase the other projects in the navigator.
      if (pending?.kind === WORKSPACE_CAPABILITIES.projectCreate) {
        pendingWorkspaceRequests.set(msg.requestId, { ...pending, projectId: msg.project.id });
      } else {
        pendingWorkspaceRequests.delete(msg.requestId);
      }
    }
    return true;
  }

  if (msg.type === "project.deleted" && msg.projectId) {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : undefined;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    usePerchStore.setState((current) => {
      const active = current.activeProjectId === msg.projectId;
      if (active) {
        writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, null);
        writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, null);
        writeActiveProjectStored(null);
      }
      return {
        workspaceProjects: current.workspaceProjects.filter((project) => project.id !== msg.projectId),
        workspaces: current.workspaces.filter((workspace) => workspace.projectId !== msg.projectId),
        workspaceSnapshotByHost: {
          ...current.workspaceSnapshotByHost,
          [hostId]: workspaceRevisionStatus(current.workspaceSnapshotByHost, hostId, epoch, revision),
        },
        ...(active ? { activeProjectId: null, activeWorkspaceId: null, activeProject: null } : {}),
      };
    });
    if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
    return true;
  }

  if (msg.type === "workspace.updated" && msg.workspace) {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : undefined;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    usePerchStore.setState((current) => {
      const workspaces = current.workspaces.some((workspace) => workspace.id === msg.workspace?.id)
        ? current.workspaces.map((workspace) => workspace.id === msg.workspace?.id ? msg.workspace! : workspace)
        : [...current.workspaces, msg.workspace!];
      const active = current.activeWorkspaceId === msg.workspace!.id && current.activeHostId === msg.workspace!.hostId;
      const project = current.workspaceProjects.find((candidate) => candidate.id === msg.workspace!.projectId);
      const legacy = active ? stableLegacyProject(project, msg.workspace) : current.activeProject;
      if (active && legacy) writeActiveProjectStored(legacy);
      return {
        workspaces,
        workspaceSnapshotByHost: {
          ...current.workspaceSnapshotByHost,
          [hostId]: workspaceRevisionStatus(current.workspaceSnapshotByHost, hostId, epoch, revision),
        },
        ...(active && legacy ? { activeProject: legacy } : {}),
      };
    });
    if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
    return true;
  }

  if (msg.type === "workspace.focus" && typeof msg.activeWorkspaceId === "string") {
    const revision = typeof msg.snapshotRevision === "number" ? msg.snapshotRevision : undefined;
    const epoch = typeof msg.snapshotEpoch === "string" ? msg.snapshotEpoch : undefined;
    if (staleWorkspaceFrame(state, hostId, epoch, revision)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    const focusRequest = msg.requestId ? pendingWorkspaceRequests.get(msg.requestId) : undefined;
    const latestRequestId = latestWorkspaceFocusRequestByHost.get(hostId);
    // A focus reply belongs to a host and a request. A delayed reply from a
    // previous host must never move the current navigation scope back.
    if (state.activeHostId !== hostId || (msg.requestId && latestRequestId !== msg.requestId)) {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      return true;
    }
    const projectId = msg.activeProjectId;
    const workspaceId = msg.activeWorkspaceId;
    const project = state.workspaceProjects.find((candidate) => candidate.id === projectId);
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const legacy = stableLegacyProject(project, workspace);
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId ?? null);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspaceId);
    if (legacy) {
      writeActiveHostStored(hostId);
      writeActiveProjectStored(legacy);
    }
    usePerchStore.setState({
      activeHostId: hostId,
      activeProjectId: projectId ?? null,
      activeWorkspaceId: workspaceId,
      workspaceSnapshotByHost: {
        ...state.workspaceSnapshotByHost,
        [hostId]: workspaceRevisionStatus(state.workspaceSnapshotByHost, hostId, epoch, revision),
      },
      ...(legacy ? { activeProject: legacy } : {}),
    });
    if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
    return true;
  }

  return false;
}

/** Exported for `store.test.ts` only — everything else drives this
 * indirectly via `socket.onMessage`. */
export function handleServerMessage(msg: ServerMessage): void {
  // Flush any rAF-buffered chat.chunk text before processing anything else,
  // so e.g. chat.done/error see the fully up-to-date message text instead of
  // racing a still-pending animation frame (see flushChunkBuffer above).
  if (msg.type !== "chat.chunk") flushChunkBuffer();
  if (handleNativeUiMessage(msg) || handleAgentTerminalMessage(msg) || handleWorkspaceTerminalMessage(msg)) return;
  if (handleWorkspaceMessage(msg)) return;
  switch (msg.type) {
    case "session.created": {
      // A background-load resume (see `ensureSessionLive`) echoes back
      // through this exact same message shape — indistinguishable from a
      // real switch except by checking `pendingBackgroundLoads`. Its
      // `session.history` reply (which always follows) does the real work
      // and restores the true foreground session; this must NOT touch
      // `sessionId`/`expectCliStart`/`listSessions` or it would yank the
      // foreground pane onto the session a background pane just loaded.
      if (pendingBackgroundLoads.has(msg.sessionId)) break;
      // A user-initiated create is an explicit "start working here", so CLI
      // mode may spawn its PTY straight away (see `expectCliStart`).
      if (expectCliStart) {
        expectCliStart = false;
        const agentChoice = pendingAgentForNewSession;
        pendingAgentForNewSession = null;
        usePerchStore.setState((state) => {
          const next: Partial<PerchState> = {
            cliStartedSessions: { ...state.cliStartedSessions, [msg.sessionId]: true },
          };
          if (agentChoice) {
            // Record the choice in both per-session maps — whichever mode
            // this session ends up viewed in (CLI or Hosted) finds it. Bug
            // 2/3 fix: in Hosted mode, also drive the live `agent`/`model`
            // fields immediately, since `sendChat` reads them straight off
            // the store and Chat.tsx's pane header renders `agent` directly —
            // without this the new session kept whatever provider the
            // *previous* session happened to leave behind.
            next.cliAgentBySession = { ...state.cliAgentBySession, [msg.sessionId]: agentChoice };
            if (agentChoice === "claude" || agentChoice === "codex") {
              next.hostedAgentBySession = { ...state.hostedAgentBySession, [msg.sessionId]: agentChoice };
              const cliMode = (state.settings?.chatMode ?? "hosted") === "cli";
              if (!cliMode) {
                const hostModelEntry = state.hostModels[state.activeHostId];
                const available = (hostModelEntry ? hostModelEntry[agentChoice] : undefined) ?? state.availableModels[agentChoice];
                next.agent = agentChoice;
                next.model = defaultModel(agentChoice, available);
              }
            }
          }
          return next;
        });
      }
      usePerchStore.setState({ sessionId: msg.sessionId });
      if (pendingModeForNewSession) {
        if (initialLaunchModes.size >= 128) initialLaunchModes.delete(initialLaunchModes.keys().next().value!);
        initialLaunchModes.set(msg.sessionId, pendingModeForNewSession);
        pendingModeForNewSession = null;
        if (!usePerchStore.getState().fetchSessionMode(msg.sessionId)) initialLaunchModes.delete(msg.sessionId);
      }
      // Refresh the session list so the sidebar shows the new entry.
      usePerchStore.getState().listSessions();
      break;
    }
    case "session.list": {
      usePerchStore.setState((state) => {
        // First list seen by a profile that has never picked a scope: default
        // the nav to the most recent session's host + project. Afterwards the
        // latch is closed and only explicit actions move the scope.
        if (!navSeedPending || msg.sessions.length === 0) {
          return { sessions: msg.sessions };
        }
        const newest = [...msg.sessions].sort((a, b) => b.createdAt - a.createdAt)[0];
        if (!newest?.cwd) return { sessions: msg.sessions };
        const hostId = newest.hostId ?? "local";
        // Never seed onto a host this client can't render: a session may
        // outlive the host entry that owned it (federation e2e deletes its
        // test host while its sessions stay in the remote's DB), and the
        // `hosts.list` reconciliation below has already run by the time a
        // session list arrives.
        if (hostId !== "local" && !state.hosts.some((h) => h.id === hostId)) {
          return { sessions: msg.sessions };
        }
        writeActiveHostStored(hostId); // also closes the latch
        writeActiveProjectStored({ hostId, cwd: newest.cwd });
        const projectId = newest.projectId ?? null;
        const workspaceId = newest.workspaceId ?? null;
        writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId);
        writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspaceId);
        return {
          sessions: msg.sessions,
          activeHostId: hostId,
          activeProject: { hostId, cwd: newest.cwd },
          activeProjectId: projectId,
          activeWorkspaceId: workspaceId,
        };
      });
      break;
    }
    case "session.updated": {
      usePerchStore.setState((state) => {
        const prev = state.sessions.find((s) => s.id === msg.session.id);
        const sessions = prev
          ? state.sessions.map((s) => (s.id === msg.session.id ? msg.session : s))
          : [msg.session, ...state.sessions];

        // Phase 6 / Wave 1 items 3-4: a turn finished (running→idle) on a
        // session that isn't the one currently being viewed, or the session
        // just became blocked on an approval prompt — surface a dismissible
        // toast (gated on toastDelivery) and/or play a notification tone
        // (gated on soundEnabled) rather than relying on the user to notice
        // the sidebar dot.
        const becameDone =
          !!prev &&
          prev.status === "running" &&
          msg.session.status === "idle" &&
          msg.session.id !== state.sessionId;
        const becameBlocked =
          !!prev && !prev.blocked && !!msg.session.blocked && msg.session.id !== state.sessionId;

        if (state.settings?.soundEnabled) {
          if (becameBlocked) playBlockedTone();
          else if (becameDone) playDoneTone();
        }

        let toasts = state.toasts;
        const toastDelivery = state.settings?.toastDelivery ?? "app";
        if ((becameDone || becameBlocked) && toastDelivery !== "off") {
          if (toastDelivery === "system" && typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const sessionIdForClick = msg.session.id;
              const notification = new Notification(
                becameBlocked ? "Session needs attention" : "Session finished",
                {
                  body: msg.session.title || "(untitled session)",
                  // Same id -> the OS replaces the prior notification instead
                  // of stacking a queue of them for a repeatedly-firing session.
                  tag: sessionIdForClick,
                },
              );
              // Reuse the exact same action the in-app Toast's onClick uses
              // (see components/Toast.tsx) so the two click-to-switch paths
              // cannot diverge; switchSession already re-scopes host/project
              // for remote sessions the same way the toast path does.
              notification.onclick = () => {
                window.focus();
                usePerchStore.getState().switchSession(sessionIdForClick);
                notification.close();
              };
            } catch {
              // Fall through to the in-app toast as a best-effort fallback.
              toasts = [...toasts, { id: newId(), sessionId: msg.session.id, title: msg.session.title }];
            }
          } else {
            toasts = [
              ...toasts,
              { id: newId(), sessionId: msg.session.id, title: msg.session.title },
            ];
          }
        }
        // The moment a brand-new session gets its DB row (Fix 3's lazy insert
        // fires on the first message) is the first time its cwd is known to
        // the client for a *remote* session — the hub never relays
        // `status.update`, so this is the only chance to pin the nav onto the
        // project it actually landed in. Local sessions were already pinned
        // from `status.update`, and re-pinning to the same value is a no-op.
        let activeProject = state.activeProject;
        let activeHostId = state.activeHostId;
        let activeProjectId = state.activeProjectId;
        let activeWorkspaceId = state.activeWorkspaceId;
        if (msg.session.id === state.sessionId && msg.session.cwd) {
          activeHostId = msg.session.hostId ?? "local";
          activeProject = { hostId: activeHostId, cwd: msg.session.cwd };
          activeProjectId = msg.session.projectId ?? state.workspaceProjects.find(
            (project) => project.hostId === activeHostId && project.path === msg.session.cwd && !project.archived,
          )?.id ?? null;
          activeWorkspaceId = msg.session.workspaceId ?? (activeProjectId
            ? state.workspaces.find((workspace) => workspace.projectId === activeProjectId && workspace.state !== "archived")?.id ?? null
            : null);
          writeActiveHostStored(activeHostId);
          writeActiveProjectStored(activeProject);
          writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, activeProjectId);
          writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, activeWorkspaceId);
        }

        return { sessions, toasts, activeProject, activeHostId, activeProjectId, activeWorkspaceId };
      });
      // Archiving hides a session everywhere, so archiving the *open* one has
      // to close it exactly the way deleting it does — otherwise the chat
      // stays mounted on a session with no row anywhere in the nav. The check
      // lives here (rather than in `archiveSession`) so it also fires when the
      // archive came from another tab or from the Settings panel.
      if (msg.session.archived && usePerchStore.getState().sessionId === msg.session.id) {
        const state = usePerchStore.getState();
        switchAwayFromActiveSession(
          state.sessions.filter((s) => s.id !== msg.session.id && !s.archived),
          state.activeHostId
        );
      }
      break;
    }
    case "session.mode.invalidated": {
      const state = usePerchStore.getState();
      if (msg.deviceId && msg.deviceId !== state.deviceId) break;
      const hostId = msg.hostId ?? hostForSession(state, msg.sessionId);
      // Refresh only observed sessions. Unmounted sessions read their policy
      // on demand; changing a device default must not eagerly load all history.
      const observed = new Set(Object.keys(state.sessionModes));
      if (state.sessionId) observed.add(state.sessionId);
      for (const sessionId of observed) {
        if (hostForSession(state, sessionId) !== hostId) continue;
        const workspaceId = workspaceForSession(state, sessionId);
        const affected = Boolean(msg.deviceId)
          || sessionId === msg.sessionId
          || Boolean(msg.workspaceId && workspaceId === msg.workspaceId);
        if (!affected) continue;
        const current = state.sessionModes[sessionId];
        if (current?.authoritative && current.revision >= msg.revision) continue;
        const inFlight = latestAgentRuntimeRequestByKey.get(`mode:${sessionId}`);
        const pending = inFlight ? pendingAgentRuntimeRequests.get(inFlight) : undefined;
        if (pending) {
          // A read may have sampled the DB before this invalidation. Do not
          // lose the event, or replay an in-flight write; refetch after its
          // reply only if that reply predates the required policy revision.
          pending.minimumModeRevision = Math.max(pending.minimumModeRevision ?? 0, msg.revision);
          continue;
        }
        usePerchStore.getState().fetchSessionMode(sessionId, workspaceId);
      }
      break;
    }
    case "session.mode": {
      // A mode reply is scoped to the opaque device id. A different browser
      // may legitimately receive a broadcast for the same session, but its
      // device policy must never move this client to another mode.
      const state = usePerchStore.getState();
      if (msg.deviceId !== state.deviceId) break;
      const pending = pendingAgentRuntimeRequests.get(msg.requestId);
      if (pending && pending.kind !== "mode") break;
      if (pending && pending.sessionId !== msg.sessionId) break;
      // A retired request was superseded/timed out; do not let its equal or
      // older revision roll a newer local choice back.
      if (!pending && ownsAgentRuntimeRequest(msg.requestId)) break;
      const current = state.sessionModes[msg.sessionId];
      if (pending) finishAgentRuntimeRequest(msg.requestId);
      if ((pending?.minimumModeRevision ?? 0) > msg.revision) {
        usePerchStore.getState().fetchSessionMode(msg.sessionId);
        break;
      }
      if (current && current.revision > msg.revision) break;
      const launchMode = initialLaunchModes.get(msg.sessionId);
      initialLaunchModes.delete(msg.sessionId);
      if (launchMode && launchMode !== msg.mode) {
        usePerchStore.getState().setSessionMode(msg.sessionId, "session", launchMode, msg.workspaceId);
        break;
      }
      usePerchStore.setState((currentState) => ({
        sessionModes: {
          ...currentState.sessionModes,
          [msg.sessionId]: {
            mode: msg.mode,
            scope: msg.scope,
            revision: msg.revision,
            deviceId: msg.deviceId,
            workspaceId: msg.workspaceId,
            authoritative: true,
            state: "ready",
            error: undefined,
          },
        },
      }));
      break;
    }
    case "session.deleted": {
      const state = usePerchStore.getState();
      const wasActive = state.sessionId === msg.sessionId;
      const remainingSessions = state.sessions.filter((s) => s.id !== msg.sessionId);
      usePerchStore.setState({
        sessions: remainingSessions,
        sessionLayouts: omitKey(state.sessionLayouts, msg.sessionId),
        cliTerminalIds: omitKey(state.cliTerminalIds, msg.sessionId),
        cliAgentBySession: omitKey(state.cliAgentBySession, msg.sessionId),
        hostedAgentBySession: omitKey(state.hostedAgentBySession, msg.sessionId),
        sessionModes: omitKey(state.sessionModes, msg.sessionId),
        agentControlBySession: omitKey(state.agentControlBySession, msg.sessionId),
        messagesBySession: omitKey(state.messagesBySession, msg.sessionId),
        streamingMessageIdBySession: omitKey(state.streamingMessageIdBySession, msg.sessionId),
      });
      for (const [requestId, pending] of pendingAgentRuntimeRequests) {
        if (pending.sessionId !== msg.sessionId) continue;
        finishAgentRuntimeRequest(requestId);
      }
      for (const key of Object.keys(usePerchStore.getState().agentLifecycleByKey)) {
        if (key.includes(`:${msg.sessionId}:`)) {
          usePerchStore.setState((current) => ({
            agentLifecycleByKey: omitKey(current.agentLifecycleByKey, key),
          }));
        }
      }
      pendingBackgroundLoads.delete(msg.sessionId);
      if (wasActive) {
        switchAwayFromActiveSession(
          remainingSessions.filter((s) => !s.archived),
          state.activeHostId
        );
      }
      break;
    }
    case "server.info": {
      const info = msg as ServerInfoMessage;
      const availableModels: Record<AgentKind, ModelEntry[]> = {
        claude: info.claudeModels,
        codex: info.codexModels,
      };
      const capabilities = Array.isArray(info.capabilities) ? info.capabilities : [];
      usePerchStore.setState((state) => {
        // Seed hostModels["local"] from server.info so the ModelChip can use
        // the active host's model list when activeHostId is "local".
        const newHostModels = {
          ...state.hostModels,
          local: { claude: info.claudeModels, codex: info.codexModels },
        };
        // Reconcile the current model against the newly-arrived list.
        // Only reset if the current model is genuinely absent — don't fight
        // the history-derived model from session.history (which arrives after
        // server.info and is the higher-authority source).
        const currentList = availableModels[state.agent];
        const modelStillValid =
          state.model === "" || currentList.some((m) => m.id === state.model);
        const reconciledModel = modelStillValid
          ? state.model || defaultModel(state.agent, currentList)
          : defaultModel(state.agent, currentList);
        return {
          serverInfo: {
            hostname: info.hostname,
            isSsh: info.isSsh,
            platform: info.platform,
            protocolVersion: info.protocolVersion,
            capabilities,
            snapshotEpoch: info.snapshotEpoch,
            snapshotRevision: info.snapshotRevision,
          },
          availableModels,
          hostModels: newHostModels,
          model: reconciledModel,
          // Absent when the server couldn't read one; `null` then means
          // "use xterm's own defaults" (see xtermSetup.ts).
          terminalProfile: info.terminalProfile ?? null,
          workspaceCapabilities: capabilities,
        };
      });
      if (capabilities.includes(WORKSPACE_CAPABILITIES.snapshot)) {
        // The server.info frame establishes the capability gate and the
        // connection is already marked live by the transport callback.
        usePerchStore.getState().fetchWorkspaceSnapshot();
      }
      break;
    }
    case "session.history": {
      const incoming: ChatMessage[] = msg.messages.map((h) => ({
        id: h.id,
        role: h.role,
        text: h.text,
        thinking: h.thinking ?? "",
        tools: [],
        streaming: false,
        agent: h.agent,
        model: h.model,
      }));

      // The DB-persisted history this reply carries never includes a turn
      // still in flight (it's only written on chat.done) — if this session
      // already has a live streaming message accumulated locally (this
      // client's own background pane keeping it warm, or a switch back into
      // a session that started streaming while backgrounded), splice it back
      // in after the persisted history rather than letting it get dropped.
      const preState = usePerchStore.getState();
      const existingStreamId = preState.streamingMessageIdBySession[msg.sessionId];
      let messages = incoming;
      let streamingMessageId: string | null = null;
      if (existingStreamId) {
        const streamingMsg = (preState.messagesBySession[msg.sessionId] ?? []).find(
          (m) => m.id === existingStreamId,
        );
        if (streamingMsg) {
          messages = [...incoming, streamingMsg];
          streamingMessageId = existingStreamId;
        }
      }
      setSessionMessages(msg.sessionId, messages);
      setSessionStreamingId(msg.sessionId, streamingMessageId);

      // A background load (see `ensureSessionLive`/`pendingBackgroundLoads`)
      // must not touch anything foreground-only below — the bucket write
      // above is the entire point of the fetch. Once done, restore whichever
      // session was actually active/foreground when the load started, so
      // this connection's server-side "active session" (viewer status) moves
      // back off the session we just background-loaded — unless the real
      // foreground has already changed since (e.g. the user switched there
      // directly while this load was in flight), in which case that switch's
      // own resume already re-established it and nothing further is needed.
      if (pendingBackgroundLoads.has(msg.sessionId)) {
        const restoreId = pendingBackgroundLoads.get(msg.sessionId) ?? null;
        pendingBackgroundLoads.delete(msg.sessionId);
        if (restoreId && restoreId !== msg.sessionId && usePerchStore.getState().sessionId === restoreId) {
          socket.send({ type: "session.resume", sessionId: restoreId });
        }
        break;
      }

      // Derive agent/model from the last assistant message in history — this
      // is the most reliable source since it arrives after switchSession's
      // optimistic update (which reads from sessions[] list metadata).
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.agent);
      if (lastAssistant?.agent) {
        const a = lastAssistant.agent as AgentKind;
        // Use the active host's model list for reconciliation.
        const state = usePerchStore.getState();
        const activeHostId = state.activeHostId;
        const hostModelEntry = state.hostModels[activeHostId];
        const available = hostModelEntry?.[a] ?? state.availableModels[a];
        const m = lastAssistant.model ?? defaultModel(a, available);
        usePerchStore.setState({ agent: a, model: m });
      }
      // Update activeHostId/activeProject from the session's known row if
      // available — this is the resume path (page reload, WS reconnect), and
      // resuming a session counts as "opening" it for nav-scoping purposes.
      // session.history carries sessionId; look it up in sessions[].
      const sessionEntry = usePerchStore.getState().sessions.find((s) => s.id === msg.sessionId);
      if (sessionEntry?.hostId || sessionEntry?.cwd) {
        const hostId = sessionEntry.hostId ?? "local";
        writeActiveHostStored(hostId);
        if (sessionEntry.cwd) {
          writeActiveProjectStored({ hostId, cwd: sessionEntry.cwd });
          const projectId = sessionEntry.projectId ?? usePerchStore.getState().workspaceProjects.find(
            (project) => project.hostId === hostId && project.path === sessionEntry.cwd && !project.archived,
          )?.id ?? null;
          const workspaceId = sessionEntry.workspaceId ?? (projectId
            ? usePerchStore.getState().workspaces.find((workspace) => workspace.projectId === projectId && workspace.state !== "archived")?.id ?? null
            : null);
          writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId);
          writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspaceId);
          usePerchStore.setState({
            activeHostId: hostId,
            activeProject: { hostId, cwd: sessionEntry.cwd },
            activeProjectId: projectId,
            activeWorkspaceId: workspaceId,
          });
        } else {
          usePerchStore.setState({ activeHostId: hostId });
        }
      }
      break;
    }
    case "status.update": {
      usePerchStore.setState({
        status: {
          cwd: msg.cwd,
          branch: msg.branch,
          contextTokens: msg.contextTokens,
          costUsd: msg.costUsd,
        },
      });
      // Resolve a pending user-initiated create (see `expectProjectFromStatus`).
      if (expectProjectFromStatus != null) {
        const hostId = expectProjectFromStatus;
        expectProjectFromStatus = null;
        if (hostId === "local" && msg.cwd) {
          writeActiveHostStored(hostId);
          writeActiveProjectStored({ hostId, cwd: msg.cwd });
          usePerchStore.setState({ activeHostId: hostId, activeProject: { hostId, cwd: msg.cwd } });
        }
      }
      break;
    }
    case "chat.chunk": {
      // Adopt-or-create must happen here, before buffering — the buffer's
      // flush applies via updateStreamingMessage, which itself no-ops when
      // that session's streaming id is null, so buffering first would
      // discard the chunk on any client that didn't initiate this turn. The
      // guard also keeps an unknown session's broadcast chunks from spawning
      // a bucket for a session nobody has opened in this client.
      if (!adoptStreamingMessage(msg.sessionId)) break;
      chunkBuffers.set(msg.sessionId, (chunkBuffers.get(msg.sessionId) ?? "") + msg.text);
      scheduleChunkFlush(msg.sessionId);
      break;
    }
    case "chat.thinking": {
      if (!adoptStreamingMessage(msg.sessionId)) break;
      updateStreamingMessage(msg.sessionId, (m) => ({
        ...m,
        thinking: m.thinking + msg.text,
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_use": {
      if (!adoptStreamingMessage(msg.sessionId)) break;
      updateStreamingMessage(msg.sessionId, (m) => ({
        ...m,
        tools: [...m.tools, { name: msg.name, input: msg.input, done: false }],
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_result": {
      if (!adoptStreamingMessage(msg.sessionId)) break;
      updateStreamingMessage(msg.sessionId, (m) => {
        const idx = [...m.tools].reverse().findIndex((t) => t.name === msg.name && !t.done);
        if (idx === -1) {
          return { ...m, tools: [...m.tools, { name: msg.name, result: msg.result, done: true }] };
        }
        const realIdx = m.tools.length - 1 - idx;
        const tools = m.tools.slice();
        tools[realIdx] = { ...tools[realIdx], name: msg.name, result: msg.result, done: true };
        return { ...m, tools };
      });
      break;
    }
    case "chat.done": {
      // Unlike the old single-active-session model, a `chat.done` for a
      // session this client knows about (active, or a background pane's
      // session) is applied to exactly that session's bucket — it must NOT
      // require `sessionId === state.sessionId`, or a background pane's turn
      // would never be marked done. Deliberately does NOT call
      // `adoptStreamingMessage` (which mints a placeholder): a done with no
      // prior streaming id for a known session should stay a no-op, exactly
      // like `updateStreamingMessage` already does — not spawn an empty
      // "done" bubble. Still guards against an entirely unknown session
      // reacting to broadcast traffic.
      const knownDone = msg.sessionId === usePerchStore.getState().sessionId || msg.sessionId in usePerchStore.getState().messagesBySession;
      if (!knownDone) break;
      updateStreamingMessage(msg.sessionId, (m) => ({
        ...m,
        streaming: false,
        usage: msg.usage,
        elapsedSec: m.turnStartedAt != null
          ? Math.round((Date.now() - m.turnStartedAt) / 1000)
          : undefined,
      }));
      setSessionStreamingId(msg.sessionId, null);
      break;
    }
    case "chat.plan": {
      // The plan lands mid-turn, before the assistant's closing summary, so
      // insert the card *ahead* of the still-streaming message rather than
      // appending after it — that keeps the transcript in the order things
      // actually happened and leaves the streaming bubble last.
      const known = msg.sessionId === usePerchStore.getState().sessionId || msg.sessionId in usePerchStore.getState().messagesBySession;
      if (!known) break;
      const card: ChatMessage = {
        id: newId(),
        role: "assistant",
        kind: "plan",
        text: msg.content,
        thinking: "",
        tools: [],
        streaming: false,
      };
      const existing = sessionMessages(msg.sessionId);
      const streamId = sessionStreamingId(msg.sessionId);
      const idx = streamId ? existing.findIndex((m) => m.id === streamId) : -1;
      setSessionMessages(
        msg.sessionId,
        idx === -1 ? [...existing, card] : [...existing.slice(0, idx), card, ...existing.slice(idx)],
      );
      break;
    }
    case "commands.list": {
      usePerchStore.setState((state) => ({
        sessionCommands: {
          ...state.sessionCommands,
          [msg.sessionId]: { claude: msg.claude, codex: msg.codex },
        },
      }));
      break;
    }
    case "agent.manifest.list": {
      const runtimeMessage = msg as typeof msg & { hostId?: string };
      const pending = msg.requestId ? pendingAgentRuntimeRequests.get(msg.requestId) : undefined;
      if (pending && pending.kind !== "manifests") break;
      if (msg.requestId && !pending && ownsAgentRuntimeRequest(msg.requestId)) break;
      const hostId = runtimeMessage.hostId ?? pending?.hostId ?? "local";
      if (pending && msg.requestId) finishAgentRuntimeRequest(msg.requestId);
      const current = usePerchStore.getState().agentManifestsByHost[hostId];
      if ((current?.revision ?? 0) > (msg.revision ?? 0)) {
        if (pending) usePerchStore.setState((state) => ({ agentManifestsByHost: {
          ...state.agentManifestsByHost, [hostId]: { ...current!, state: "ready" },
        } }));
        break;
      }
      usePerchStore.setState((state) => ({
        agentManifestsByHost: {
          ...state.agentManifestsByHost,
          [hostId]: {
            manifests: msg.manifests,
            revision: msg.revision,
            state: "ready",
            error: undefined,
          },
        },
      }));
      break;
    }
    case "agent.lifecycle": {
      const status = msg.status;
      const key = agentLifecycleKeyFor(status.key.workspaceId, status.key.sessionId, status.key.agentId);
      const pending = pendingAgentRuntimeRequests.get(msg.requestId);
      if (pending && pending.kind !== "lifecycle") break;
      if (!pending && ownsAgentRuntimeRequest(msg.requestId)) break;
      const current = usePerchStore.getState().agentLifecycleByKey[key];
      if (current?.status && current.status.revision > status.revision) break;
      if (pending) finishAgentRuntimeRequest(msg.requestId);
      usePerchStore.setState((state) => ({
        agentLifecycleByKey: {
          ...state.agentLifecycleByKey,
          [key]: {
            status,
            state: "ready",
            error: undefined,
          },
        },
        agentControlBySession: {
          ...state.agentControlBySession,
          [status.key.sessionId]: {
            ...(state.agentControlBySession[status.key.sessionId] ?? { agentId: status.key.agentId, state: "idle" as const }),
            agentId: status.key.agentId,
            state: state.agentControlBySession[status.key.sessionId]?.state ?? "idle",
            inputOwner: status.inputOwner,
            resizeOwner: status.resizeOwner,
          },
        },
      }));
      break;
    }
    case "agent.control": {
      // Control replies are unicast to the request owner. Ignore an unknown
      // request id rather than clearing a lease acquired by this tab when a
      // stale release response from another client arrives.
      const pending = pendingAgentRuntimeRequests.get(msg.requestId);
      if (!pending || pending.kind !== "control" || !pending.sessionId || !pending.agentId || !pending.channel) {
        break;
      }
      finishAgentRuntimeRequest(msg.requestId);
      usePerchStore.setState((state) => {
        const current = state.agentControlBySession[pending.sessionId!];
        const next: AgentControlState = {
          ...(current ?? { agentId: pending.agentId! }),
          agentId: pending.agentId!,
          state: "ready",
          error: undefined,
        };
        if (msg.lease) {
          if (pending.channel === "input") {
            next.input = msg.lease;
            next.inputOwner = msg.lease;
          } else {
            next.resize = msg.lease;
            next.resizeOwner = msg.lease;
          }
        } else if (pending.channel === "input") {
          next.input = undefined;
          next.inputOwner = undefined;
        } else {
          next.resize = undefined;
          next.resizeOwner = undefined;
        }
        return { agentControlBySession: { ...state.agentControlBySession, [pending.sessionId!]: next } };
      });
      break;
    }
    case "error": {
      if (msg.requestId) {
        // Feature stores subscribe after this generic store. Git/review owns
        // its opaque request ids in a dependency-free registry so a
        // correlated failure is rendered by that pane instead of becoming a
        // misleading assistant error in the active chat transcript.
        if (ownsGitReviewRequest(msg.requestId) || ownsAgentRuntimeRequest(msg.requestId)) {
          const runtime = pendingAgentRuntimeRequests.get(msg.requestId);
          if (runtime) {
            finishAgentRuntimeRequest(msg.requestId);
            markAgentRuntimeError(runtime, msg.message);
          }
          break;
        }
        const pending = pendingWorkspaceRequests.get(msg.requestId);
        if (pending) {
          pendingWorkspaceRequests.delete(msg.requestId);
          if (pending.kind === WORKSPACE_CAPABILITIES.projectFocus || pending.kind === WORKSPACE_CAPABILITIES.workspaceFocus) {
            if (latestWorkspaceFocusRequestByHost.get(pending.hostId) === msg.requestId) {
              latestWorkspaceFocusRequestByHost.delete(pending.hostId);
            }
            const previous = pending.previousFocus;
            const current = usePerchStore.getState();
            if (previous && current.activeHostId === pending.hostId) {
              writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, previous.projectId);
              writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, previous.workspaceId);
              if (previous.legacy) writeActiveProjectStored(previous.legacy);
              else writeActiveProjectStored(null);
              usePerchStore.setState({
                activeProjectId: previous.projectId,
                activeWorkspaceId: previous.workspaceId,
                activeProject: previous.legacy,
              });
            }
          }
          usePerchStore.setState((state) => {
            const creation = state.workspaceProjectCreate;
            return {
            workspaceSnapshotByHost: {
              ...state.workspaceSnapshotByHost,
              [pending.hostId]: { state: "error", error: msg.message },
            },
            ...(pending.kind === WORKSPACE_CAPABILITIES.projectCreate &&
            creation != null && creation.requestId === msg.requestId
              ? {
                  workspaceProjectCreate: {
                    ...creation,
                    status: "error",
                    error: msg.message,
                  },
                }
              : {}),
            };
          });
          break;
        }
      }
      // ErrorMessage carries no sessionId on the wire — it is inherently
      // attributed to whatever this connection currently considers active,
      // same as before this refactor.
      const { sessionId: activeSessionId, attachingCliForSession } = usePerchStore.getState();
      const streamingId = activeSessionId ? sessionStreamingId(activeSessionId) : null;
      if (activeSessionId && streamingId) {
        updateStreamingMessage(activeSessionId, (m) => ({ ...m, streaming: false, error: msg.message }));
        setSessionStreamingId(activeSessionId, null);
      } else if (attachingCliForSession != null) {
        // Error arrived while a CLI PTY attach was in flight — surface it as
        // the cliError overlay (visible in CLI mode) instead of pushing it
        // into the chat message list which is hidden in CLI mode.
        usePerchStore.setState({ cliError: msg.message, attachingCliForSession: null });
      } else if (activeSessionId) {
        setSessionMessages(activeSessionId, [
          ...sessionMessages(activeSessionId),
          {
            id: newId(),
            role: "assistant",
            text: "",
            thinking: "",
            tools: [],
            streaming: false,
            error: msg.message,
          },
        ]);
      }
      break;
    }
    case "terminal.created": {
      const pending = pendingTerminals.shift();
      usePerchStore.setState((state) => ({
        terminals: {
          ...state.terminals,
          [msg.terminalId]: {
            id: msg.terminalId,
            cols: pending?.cols ?? 80,
            rows: pending?.rows ?? 24,
            exitCode: null,
          },
        },
      }));
      pending?.resolve(msg.terminalId);
      break;
    }
    case "terminal.data": {
      // Bypass zustand entirely - see terminalBus.ts.
      emitTerminalData(msg.terminalId, msg.data);
      break;
    }
    case "terminal.exit": {
      usePerchStore.setState((state) => {
        const existing = state.terminals[msg.terminalId];
        if (!existing) return state;
        return {
          terminals: {
            ...state.terminals,
            [msg.terminalId]: { ...existing, exitCode: msg.code },
          },
        };
      });
      break;
    }
    case "settings.current": {
      usePerchStore.setState({ settings: msg.settings });
      applyTheme(msg.settings.theme);
      break;
    }
    case "hosts.list":
    case "hosts.updated": {
      // Reconcile the persisted nav scope: a host that was removed (or that
      // never existed on this machine) must not leave the sidebar pointing at
      // a host it can no longer render.
      usePerchStore.setState((state) => {
        const stale =
          state.activeHostId !== "local" && !msg.hosts.some((h) => h.id === state.activeHostId);
        if (!stale) return { hosts: msg.hosts };
        writeActiveHostStored("local");
        writeActiveProjectStored(null);
        writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, null);
        writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, null);
        return {
          hosts: msg.hosts,
          activeHostId: "local",
          activeProject: null,
          activeProjectId: null,
          activeWorkspaceId: null,
        };
      });
      break;
    }
    case "host.info": {
      const workspaceHostInfo = msg as HostInfoMessage & {
        protocolVersion?: number;
        capabilities?: string[];
      };
      // Upsert into hostStates.
      usePerchStore.setState((state) => ({
        hostStates: { ...state.hostStates, [msg.hostId]: msg },
        workspaceCapabilitiesByHost: {
          ...state.workspaceCapabilitiesByHost,
          [msg.hostId]: Array.isArray(workspaceHostInfo.capabilities)
            ? workspaceHostInfo.capabilities
            : [],
        },
      }));
      // When the host transitions to connected and carries model lists,
      // update hostModels so the ModelChip can show the correct list when
      // this host is active.
      if (msg.state === "connected" && (msg.claudeModels || msg.codexModels)) {
        usePerchStore.setState((state) => ({
          hostModels: {
            ...state.hostModels,
            [msg.hostId]: {
              claude: msg.claudeModels ?? state.hostModels[msg.hostId]?.claude ?? [],
              codex: msg.codexModels ?? state.hostModels[msg.hostId]?.codex ?? [],
            },
          },
        }));
      }
      break;
    }
    case "session.layout": {
      usePerchStore.setState((state) => ({
        sessionLayouts: { ...state.sessionLayouts, [msg.sessionId]: msg.layout ?? null },
      }));
      break;
    }
    case "workspace.git": {
      const key = `${msg.hostId}:${msg.cwd}`;
      usePerchStore.setState((state) => ({
        workspaceGit: {
          ...state.workspaceGit,
          [key]: { branch: msg.branch, ahead: msg.ahead, behind: msg.behind },
        },
      }));
      break;
    }
    case "fs.browse.result": {
      const resolve = pendingBrowses.get(msg.requestId);
      if (resolve) {
        pendingBrowses.delete(msg.requestId);
        resolve(msg);
      }
      break;
    }
    // Wave 2 worktrees: all three reply shapes resolve the same single-shot
    // promise registered by listWorktrees/createWorktree/removeWorktree.
    // `worktree.list.result` additionally refreshes the per-repo cache so an
    // already-open menu re-renders without holding the result itself.
    case "worktree.list.result": {
      const key = `${msg.hostId}:${msg.repoPath}`;
      usePerchStore.setState((state) => ({
        worktrees: {
          ...state.worktrees,
          [key]: { worktrees: msg.worktrees, defaultRoot: msg.defaultRoot, baseRef: msg.baseRef, refs: msg.refs },
        },
      }));
      resolveWorktreeRequest(msg.requestId, msg);
      break;
    }
    case "worktree.done":
    case "worktree.error":
    case "worktree.job.started": {
      resolveWorktreeRequest(msg.requestId, msg);
      break;
    }
    case "worktree.jobs": {
      usePerchStore.setState({ worktreeJobs: msg.jobs });
      break;
    }
  }
}

socket.onMessage(handleServerMessage);
socket.onConnectionChange((connected) => {
  // Dropping the transport also invalidates the session; a fresh
  // session.create/subscribe handshake runs on reconnect (see ws.ts).
  if (!connected) {
    flushChunkBuffer();
    // Any background load in flight will never get its reply now — clear
    // the tracking so a reconnect's `ensureSessionLive` retries instead of
    // finding a permanently-stuck "already loading" guard.
    pendingBackgroundLoads.clear();
    pendingWorkspaceRequests.clear();
    for (const requestId of [...pendingAgentRuntimeRequests.keys()]) {
      const pending = finishAgentRuntimeRequest(requestId);
      if (pending) markAgentRuntimeError(pending, "Connection lost. Reconnect and try again.");
    }
    usePerchStore.setState((state) => state.workspaceProjectCreate?.status === "pending"
      ? {
          workspaceProjectCreate: {
            ...state.workspaceProjectCreate,
            status: "error",
            error: "Connection lost. Check the server and retry.",
          },
        }
      : {});
  }
  usePerchStore.setState(connected ? { connected } : { connected, sessionId: null });
});
// Apply herdr's default look (catppuccin) immediately so there's no flash of
// unstyled (or browser-default) content before the server's settings.current
// message (holding the actual persisted theme, if not "catppuccin") arrives.
applyTheme("catppuccin");
socket.connect();
