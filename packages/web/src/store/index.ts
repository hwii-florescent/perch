import { handleContextBridgeMessage } from "../contextBridge";
import { handleNativeUiMessage } from "../nativeUi";
import { handleAgentTerminalMessage, sendAgentTerminalInput, resizeAgentTerminal } from "../agentTerminals";
import { create } from "zustand";
import type { AgentAttach, AgentControlChannel, AgentControlLease, AgentKind, AgentLifecycleStatus, AgentManifestListMessage, AgentManifestSummary, AccountUsage, SpendSummary, UsageRedeemResultMessage, ClientMessage, CommandEntry, FsBrowseResultMessage, ProjectSummary, ServerInfoMessage, ServerMessage, SessionSummary, SettingsData, SettingsPatch, SshHostEntry, TerminalProfile, HostInfoMessage, WorktreeEntry, WorktreeListMessage, WorktreeCreateMessage, WorktreeRemoveMessage, WorktreeListResultMessage, WorktreeDoneMessage, WorktreeErrorMessage, WorktreeJob, WorktreeJobStartMessage, WorktreeJobStartedMessage, WorktreeBranchDeleteMessage, WorkspaceSummary } from "@perch/shared";
import { socket } from "../ws";
import { resyncPendingBuffersAfterReconnect, useWorkspaceFilesStore } from "../filesystemStore";
import { forgetClosedTabs, recordClosedTab } from "../closedTabs";
import { emitTerminalData } from "../terminalBus";
import { handleWorkspaceTerminalMessage } from "../workspaceTerminals";
import { applyTheme } from "../themes";
import { playBlockedTone, playDoneTone } from "../sound";
import { hasNativeNotifications, OPEN_SESSION_EVENT, planNotification, sendSystemNotification, USAGE_NOTIFICATION_ID, windowFocused } from "../notifications";
import { ownsAgentRuntimeRequest, ownsGitReviewRequest, ownsSurfaceRequest, registerAgentRuntimeRequest, retireAgentRuntimeRequest } from "../requestOwnership";
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
import { activeWorkspaceSessions, effectiveWorkspace, omitKey } from "./selectors";
export {
  activeWorkspaceSessions,
  effectiveActiveProject,
  effectiveWorkspace,
  omitKey,
  projectsForHost,
  sessionIdsForProject,
} from "./selectors";
export type { ProjectGroup, ProjectNavState } from "./selectors";
import { newId } from "../ids";
import type { WorkspaceOrder } from "../sidebarOrder";
import { writeSessionId } from "../viewer";

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
  /** A usage alert's full text; such a toast opens no session. */
  text?: string;
  /** What happened; absent on older entries (treated as finished). */
  kind?: "done" | "blocked" | "usage";
  /** A usage alert's detail line. */
  body?: string;
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
  /** All sessions known to the server, refreshed via session.list pushes. */
  sessions: SessionSummary[];
  /** Stable browser/device identity used by the session-mode policy. It is
   * opaque to the UI and is sent back unchanged on mode reads/writes. */
  deviceId: string;
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
  /** Claude/Codex plan usage for the status bar (`usage.result`). */
  usage: AccountUsage[];
  /** API-equivalent spend from local agent logs (`usage.result`), when the core reports it. */
  spend: SpendSummary | null;
  /** Local receipt time for the latest usage response; drives refresh feedback. */
  usageUpdatedAt: number;
  /** The latest `usage.redeemResult`, shown in the usage popover. */
  usageRedeemResult: UsageRedeemResultMessage | null;
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
  /** Each core's sidebar order (`workspace.order`), by host. Absent until the
   * core sends it; an older core never does and keeps today's sort. */
  workspaceOrderByHost: Record<string, WorkspaceOrder>;
  /** Replace the lists given on `hostId`'s core (last write wins). Applies at
   * once and is then confirmed by the core's broadcast; a no-op without the capability. */
  setWorkspaceOrder: (hostId: string, order: Partial<WorkspaceOrder>) => void;
  workspaceProjectCreate: WorkspaceProjectCreateState | null;
  activeProjectId: string | null;
  activeWorkspaceId: string | null;
  fetchWorkspaceSnapshot: (hostId?: string, projectId?: string) => void;
  createWorkspaceProject: (path: string, name?: string, hostId?: string) => string | null;
  clearWorkspaceProjectCreate: () => void;
  focusWorkspaceProject: (projectId: string) => void;
  focusWorkspace: (workspaceId: string) => void;
  renameWorkspaceProject: (projectId: string, name: string) => void;
  /** Delete a project and its sessions (their agents and shells end); the
   * folder stays on disk. */
  removeWorkspaceProject: (projectId: string) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  pinWorkspace: (workspaceId: string, pinned: boolean) => void;
  setWorkspaceHidden: (workspaceId: string, hidden: boolean) => void;
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
   * cleared by that instance once consumed. With `remove`, the menu skips
   * its popover and asks to delete that checkout instead. */
  worktreeMenuRequest: { projectKey: string; nonce: number; remove?: { path: string; branch?: string }; create?: boolean } | null;
  /** Background worktree creates on the local host, replaced wholesale by
   * each `worktree.jobs` broadcast (see `server/worktree_jobs.rs`). */
  worktreeJobs: WorktreeJob[];
  /** "Session finished" toasts (Phase 6), derived client-side from
   * `session.updated` running→idle transitions on non-active sessions.
   * Rendered by `components/Toast.tsx`; dismissed on click or timeout. */
  toasts: ToastEntry[];
  /** Dismiss a toast by id (click or auto-dismiss timeout). */
  dismissToast: (id: string) => void;

  sessionCommands: Record<string, { claude: CommandEntry[]; codex: CommandEntry[]; pi: CommandEntry[]; omp: CommandEntry[] }>;
  fetchCommands: (sessionId: string) => void;
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
   * If `cwd` is provided it is sent to the server for validation.
   * `agentChoice`, when passed, is the provider `CliStartPanel`/the sidebar's
   * "+ New session" popover/`NoSessionPanel` picked for this not-yet-created
   * session. It is threaded through to the `session.created` handler, since
   * the new session's id isn't known until that reply arrives, and recorded
   * in `cliAgentBySession`. */
  createSessionOnHost: (hostId: string, cwd?: string, agentChoice?: string) => void;
  /** Close the session view and keep the workspace focus: the main area shows
   * the focused workspace's start picker (`NoSessionPanel`). What clicking a
   * workspace with no sessions does. The session itself keeps running. */
  showWorkspaceHome: () => void;
  /** Permanently delete a session: what a tab's ×, the session row's × and
   * exiting its terminal do. Irreversible. The server stops its agent and shells and drops its rows, then
   * broadcasts `session.deleted`, which drives the local cleanup. Leaving the
   * active session lands on a neighbouring tab of the same workspace, or the
   * home screen. */
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
  requestWorktreeMenu: (projectKey: string, remove?: { path: string; branch?: string }, create?: boolean) => void;
  /** Clear a consumed `worktreeMenuRequest`. */
  clearWorktreeMenuRequest: () => void;
  /** Request the persisted dockview layout blob for a session. Reply lands
   * in `sessionLayouts[sessionId]` via the `session.layout` server message. */
  fetchSessionLayout: (sessionId: string) => void;
  /** Persist a session's dockview layout blob. Callers (DockviewShell) are
   * responsible for debouncing — this sends immediately. */
  saveSessionLayout: (sessionId: string, layout: unknown) => void;
  /** Show or hide the sidebar entirely (top-row toggle, leader,b). */
  toggleSidebar: () => void;
  /** Switch to the next (`dir=1`) or previous (`dir=-1`) session within the
   * *active workspace* — the same list `TabBar` shows. Wraps
   * around; no-op if the active workspace has no other sessions. Used by
   * leader,n / leader,p (Phase 4). */
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
 * `cliAgentBySession` once `session.created` reveals
 * the new session's id (the panel's agent choice has to survive that round
 * trip). Armed right before a `createSessionOnHost` call that carried an
 * explicit `agentChoice`, consumed (and cleared) alongside `expectCliStart`
 * in the `session.created` handler — same one-shot request/reply discipline
 * as `expectProjectFromStatus`.
 */
let pendingAgentForNewSession: string | null = null;
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

type AgentRuntimeRequestKind = "manifests" | "lifecycle" | "control";

interface PendingAgentRuntimeRequest {
  kind: AgentRuntimeRequestKind;
  key: string;
  sessionId?: string;
  hostId?: string;
  agentId?: string;
  channel?: AgentControlChannel;
  timeoutId: ReturnType<typeof setTimeout>;
}

const pendingAgentRuntimeRequests = new Map<string, PendingAgentRuntimeRequest>();
const latestAgentRuntimeRequestByKey = new Map<string, string>();
const AGENT_RUNTIME_REQUEST_TIMEOUT_MS = 30_000;
const MAX_AGENT_RUNTIME_REQUESTS = 64;

function markAgentRuntimeError(request: PendingAgentRuntimeRequest, message: string): void {
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

function agentLifecycleKeyFor(workspaceId: string | undefined, sessionId: string, agentId: string): string {
  return `${workspaceId ?? ""}:${sessionId}:${agentId}`;
}

const WORKSPACE_CAPABILITIES = {
  snapshot: "workspace.snapshot",
  projectList: "project.list",
  projectCreate: "project.create",
  projectFocus: "project.focus",
  projectRename: "project.rename",
  projectRemove: "project.remove",
  workspaceFocus: "workspace.focus",
  workspaceRename: "workspace.rename",
  workspaceRestore: "workspace.restore",
  workspacePin: "workspace.pin",
  workspaceNest: "workspace.nest",
  workspaceVisibility: "workspace.visibility",
  workspaceOrder: "workspace.order.v1",
} as const;

const AGENT_RUNTIME_CAPABILITIES = {
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

/** Whether the sidebar can reorder `hostId`'s projects and chats: its core has
 * `workspace.order.v1` and is reachable. There is no local-only fallback; a
 * host without it keeps its default sort and no drag. */
export function canReorderHost(
  state: Pick<PerchState, "connected" | "serverInfo" | "workspaceCapabilitiesByHost" | "hostStates">,
  hostId: string,
): boolean {
  const reachable = hostId === "local" ? state.connected : state.hostStates[hostId]?.state === "connected";
  return reachable && hasWorkspaceCapability(state, hostId, WORKSPACE_CAPABILITIES.workspaceOrder);
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
  state: Pick<PerchState, "sessions">,
  sessionId: string,
  workspaceId?: string,
): string | undefined {
  if (workspaceId) return workspaceId;
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  // Browsing another workspace does not move this session into it. Only
  // echo an actual session association, never the navigation focus.
  return session?.workspaceId;
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
  terminals: {},
  cliTerminalIds: {},
  cliStartedSessions: {},
  cliAgentBySession: {},
  sessions: [],
  deviceId: readDeviceIdStored(),
  agentManifestsByHost: {},
  agentLifecycleByKey: {},
  agentControlBySession: {},
  serverInfo: null,
  terminalProfile: null,
  usage: [],
  spend: null,
  usageUpdatedAt: 0,
  usageRedeemResult: null,
  attachingCliForSession: null,
  cliError: null,
  settingsOpen: false,
  settingsPage: "main",
  settings: null,
  hosts: [],
  hostStates: {},
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
  workspaceOrderByHost: {},
  setWorkspaceOrder: (hostId, order) => {
    const state = get();
    if (!canReorderHost(state, hostId)) return;
    const next = { projects: [], sessions: [], ...state.workspaceOrderByHost[hostId], ...order };
    set({ workspaceOrderByHost: { ...state.workspaceOrderByHost, [hostId]: next } });
    sendWorkspaceMessage(
      { type: "workspace.order.set", requestId: newId(), ...(hostId === "local" ? {} : { hostId }), ...order },
      hostId,
      WORKSPACE_CAPABILITIES.workspaceOrder,
    );
  },
  workspaceProjectCreate: null,
  activeProjectId: readStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY),
  activeWorkspaceId: readStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY),
  worktrees: {},
  worktreeMenuRequest: null,
  worktreeJobs: [],
  toasts: [],
  sessionCommands: {},

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  fetchCommands: (sessionId) => {
    if (!sessionId || requestedCommands.has(sessionId)) return;
    requestedCommands.add(sessionId);
    socket.send({ type: "commands.list", sessionId });
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
    const agentId = agentIdParam ?? state.cliAgentBySession[sessionId] ?? "claude";
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

  listSessions: () => {
    socket.send({ type: "session.list" });
  },

  createSession: () => {
    get().createSessionOnHost("local");
  },

  switchSession: (sessionId) => {
    if (get().sessionId === sessionId) return;
    const s = get().sessions.find((s) => s.id === sessionId);
    const newHostId = s?.hostId ?? "local";
    // Opening a session from *anywhere* (sidebar row, tab, Navigator, mobile
    // switcher, toast) re-scopes the nav onto that session's host + project.
    const newProject = s?.cwd ? { hostId: newHostId, cwd: s.cwd } : get().activeProject;
    const stableProjectId = s?.projectId ?? get().workspaceProjects.find(
      (project) => project.hostId === newHostId && project.path === s?.cwd,
    )?.id ?? null;
    const stableWorkspaceId = s?.workspaceId ?? (stableProjectId
      ? get().workspaces.find((workspace) => workspace.projectId === stableProjectId && workspace.state !== "archived")?.id ?? null
      : null);
    writeActiveHostStored(newHostId);
    writeActiveProjectStored(newProject);
    writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, stableProjectId);
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, stableWorkspaceId);
    set({
      cliError: null,
      activeHostId: newHostId,
      activeProject: newProject,
      activeProjectId: stableProjectId,
      activeWorkspaceId: stableWorkspaceId,
    });
    // A removed worktree's workspace is archived; there is nothing to focus
    // then, and asking would only surface "workspace is archived".
    const focusWorkspace = get().workspaces.find((workspace) => workspace.id === stableWorkspaceId);
    const focusable = focusWorkspace && focusWorkspace.state !== "archived";
    if (focusable && hasWorkspaceCapability(get(), newHostId, WORKSPACE_CAPABILITIES.workspaceFocus)) {
      const requestId = newId();
      sendWorkspaceMessage(
        { type: "workspace.focus", requestId, workspaceId: focusWorkspace.id },
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
      (project) => project.hostId === hostId && project.path === cwd,
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
    if (!project) return;
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
    if (!workspace || !project || workspace.state === "archived") return;
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

  removeWorkspaceProject: (projectId) => {
    const state = get();
    const project = state.workspaceProjects.find((candidate) => candidate.id === projectId);
    if (!project || !state.connected || !hasWorkspaceCapability(state, project.hostId, WORKSPACE_CAPABILITIES.projectRemove)) return;
    const requestId = newId();
    sendWorkspaceMessage(
      { type: "project.remove", requestId, projectId },
      project.hostId,
      WORKSPACE_CAPABILITIES.projectRemove,
    );
    forgetClosedTabs(projectId);
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

  setWorkspaceHidden: (workspaceId, hidden) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace || !state.connected || !hasWorkspaceCapability(state, workspace.hostId, WORKSPACE_CAPABILITIES.workspaceVisibility)) return;
    sendWorkspaceMessage(
      { type: "workspace.visibility", requestId: newId(), workspaceId, hidden },
      workspace.hostId,
      WORKSPACE_CAPABILITIES.workspaceVisibility,
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

  createSessionOnHost: (hostId, cwd, agentChoice) => {
    // Re-scope the nav onto the requested project. An absolute cwd can be
    // pinned right away; "~" (the "No project" quick-pick) and an omitted cwd
    // only resolve server-side, so arm `expectProjectFromStatus` instead and
    // let the `status.update` that always follows `session.create` supply the
    // resolved path. The flag is deliberately NOT armed by every
    // `session.created` — the transport mints a blank session on every
    // connect (see ws.ts), and that housekeeping create must not drag the
    // sidebar off whatever project the user was last looking at.
    writeActiveHostStored(hostId);
    // The user asked for this session, so an agent may launch into it as soon
    // as its id comes back — unlike the blank session the transport mints on
    // every connect. See `expectCliStart`.
    expectCliStart = true;
    // Carry the provider choice (if any) through the same round trip — see
    // `pendingAgentForNewSession`. Always (re)armed, including to `null`, so
    // a stale choice from an earlier call can never leak onto an unrelated
    // create.
    pendingAgentForNewSession = agentChoice ?? null;
    if (cwd && cwd.startsWith("/")) {
      writeActiveProjectStored({ hostId, cwd });
      set({ activeHostId: hostId, activeProject: { hostId, cwd } });
    } else {
      expectProjectFromStatus = hostId;
      set({ activeHostId: hostId });
    }
    if (hostId === "local") {
      // Clear stored session id so a mid-flight reconnect doesn't resume the
      // old session before session.created arrives (same as socket.newSession()).
      writeSessionId(null);
      const msg: { type: "session.create"; cwd?: string } = { type: "session.create" };
      if (cwd) msg.cwd = cwd;
      socket.send(msg);
    } else {
      // Clear the stored sessionId so a mid-flight reconnect doesn't try
      // to resume the old session before session.created arrives.
      writeSessionId(null);
      const msg: { type: "session.create"; hostId: string; cwd?: string } = {
        type: "session.create",
        hostId,
      };
      if (cwd) msg.cwd = cwd;
      socket.send(msg);
    }
  },

  showWorkspaceHome: () => {
    writeSessionId(null);
    set({ sessionId: null, cliError: null });
  },

  deleteSession: (sessionId) => {
    const closing = get().sessions.find((session) => session.id === sessionId);
    if (closing) recordClosedTab(closing);
    socket.send({ type: "session.delete", sessionId });
    leaveSession(get(), sessionId);
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
    // The editor may be ahead of its debounced durable draft. Refuse locally
    // before sending; force only applies to Git's on-disk dirty guard.
    const files = useWorkspaceFilesStore.getState();
    const root = path.replace(/\/$/, "");
    for (const workspace of get().workspaces) {
      if (workspace.hostId !== hostId || (workspace.path !== root && !workspace.path.startsWith(root + "/"))) continue;
      const draft = Object.values(files.documents[workspace.id] ?? {}).find((doc) =>
        doc.content !== doc.savedContent || doc.conflict || doc.state === "saving" || doc.bufferState === "saving");
      if (draft) return Promise.resolve({ type: "worktree.error" as const, requestId: newId(),
        hostId, message: `Save or discard the unsaved draft '${draft.path}' before deleting this worktree`, dirty: false });
    }
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

  requestWorktreeMenu: (projectKey, remove, create) => {
    set((state) => ({
      worktreeMenuRequest: {
        projectKey,
        nonce: (state.worktreeMenuRequest?.nonce ?? 0) + 1,
        ...(remove ? { remove } : {}),
        ...(create ? { create } : {}),
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

/** Leaving the active session lands on a neighbouring session of the same
 * workspace, like a browser; leaving its last session keeps the workspace
 * (its open files and reviews stay tabs, `fileTabs.ts` selects one) and
 * shows its home screen, never another workspace's session. */
function leaveSession(state: PerchState, sessionId: string): void {
  if (state.sessionId !== sessionId) return;
  const siblings = activeWorkspaceSessions(state).filter((s) => s.id !== sessionId);
  switchAwayFromActiveSession(siblings, state.activeHostId, effectiveWorkspace(state)?.id);
}

/**
 * The active session just went away. Switch to the most recent of
 * `candidates` (which already exclude the departing session) on the same
 * host, else the most recent on any host, else the home screen, keeping
 * `keepWorkspaceId` as the workspace on screen when there is one.
 */
function switchAwayFromActiveSession(candidates: SessionSummary[], activeHostId: string, keepWorkspaceId?: string): void {
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
  if (keepWorkspaceId) {
    // Set before the session clears, so the one change a subscriber sees keeps its workspace.
    usePerchStore.setState({ activeWorkspaceId: keepWorkspaceId });
    writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, keepWorkspaceId);
    usePerchStore.getState().showWorkspaceHome();
    return;
  }
  usePerchStore.getState().showWorkspaceHome();
  writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, null);
  writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, null);
  usePerchStore.setState({ activeProjectId: null, activeWorkspaceId: null });
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

/** Resuming a session (page reload, WS reconnect) counts as opening it, so
 * re-scope the nav onto its host and project. A brand-new session has no row
 * in `sessions` yet and is left alone. */
function scopeNavToSession(sessionId: string): void {
  const state = usePerchStore.getState();
  const entry = state.sessions.find((s) => s.id === sessionId);
  if (!entry?.hostId && !entry?.cwd) return;
  const hostId = entry.hostId ?? "local";
  writeActiveHostStored(hostId);
  if (!entry.cwd) {
    usePerchStore.setState({ activeHostId: hostId });
    return;
  }
  writeActiveProjectStored({ hostId, cwd: entry.cwd });
  const projectId = entry.projectId ?? state.workspaceProjects.find(
    (project) => project.hostId === hostId && project.path === entry.cwd,
  )?.id ?? null;
  const workspaceId = entry.workspaceId ?? (projectId
    ? state.workspaces.find((workspace) => workspace.projectId === projectId && workspace.state !== "archived")?.id ?? null
    : null);
  writeStoredId(ACTIVE_PROJECT_ID_STORAGE_KEY, projectId);
  writeStoredId(ACTIVE_WORKSPACE_ID_STORAGE_KEY, workspaceId);
  usePerchStore.setState({
    activeHostId: hostId,
    activeProject: { hostId, cwd: entry.cwd },
    activeProjectId: projectId,
    activeWorkspaceId: workspaceId,
  });
}

/** Exported for `store.test.ts` only — everything else drives this
 * indirectly via `socket.onMessage`. */
export function handleServerMessage(msg: ServerMessage): void {
  if (handleContextBridgeMessage(msg) || handleNativeUiMessage(msg) || handleAgentTerminalMessage(msg) || handleWorkspaceTerminalMessage(msg)) return;
  if (handleWorkspaceMessage(msg)) return;
  switch (msg.type) {
    case "session.created": {
      // A user-initiated create is an explicit "start working here", so the
      // agent may launch straight away (see `expectCliStart`).
      if (expectCliStart) {
        expectCliStart = false;
        const agentChoice = pendingAgentForNewSession;
        pendingAgentForNewSession = null;
        usePerchStore.setState((state) => {
          const next: Partial<PerchState> = {
            cliStartedSessions: { ...state.cliStartedSessions, [msg.sessionId]: true },
          };
          if (agentChoice) next.cliAgentBySession = { ...state.cliAgentBySession, [msg.sessionId]: agentChoice };
          return next;
        });
      }
      usePerchStore.setState({ sessionId: msg.sessionId });
      scopeNavToSession(msg.sessionId);
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
        // An unfocused window also alerts for the session being viewed, and
        // escalates to an OS notification (see notifications.ts).
        const focused = windowFocused();
        const viewed = msg.session.id === state.sessionId;
        const becameDone = !!prev && prev.status === "running" && msg.session.status === "idle";
        const becameBlocked = !!prev && !prev.blocked && !!msg.session.blocked;
        const hasEvent = becameDone || becameBlocked;

        if (state.settings?.soundEnabled && hasEvent && (!viewed || !focused)) {
          if (becameBlocked) playBlockedTone();
          else playDoneTone();
        }

        let toasts = state.toasts;
        const toast = { id: newId(), sessionId: msg.session.id, title: msg.session.title, kind: becameBlocked ? ("blocked" as const) : ("done" as const) };
        const channel = planNotification({
          event: hasEvent,
          viewed,
          focused,
          delivery: state.settings?.toastDelivery ?? "app",
          permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
          native: hasNativeNotifications(),
        });
        if (channel === "system") {
          // Native authorization/enqueue can fail asynchronously. Preserve the
          // alert as a toast, without overwriting newer alerts in the meantime.
          void sendSystemNotification(
            becameBlocked ? "Session needs attention" : "Session finished",
            msg.session.title || "(untitled session)",
            msg.session.id,
            () => usePerchStore.getState().switchSession(msg.session.id),
          ).catch(() => usePerchStore.setState((current) => ({ toasts: [...current.toasts, toast] })));
        } else if (channel === "toast") {
          toasts = [...toasts, toast];
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
            (project) => project.hostId === activeHostId && project.path === msg.session.cwd,
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
      break;
    }
    case "session.deleted": {
      const state = usePerchStore.getState();
      // Deleted elsewhere (this client already left its own deletes).
      leaveSession(state, msg.sessionId);
      const remainingSessions = state.sessions.filter((s) => s.id !== msg.sessionId);
      usePerchStore.setState({
        sessions: remainingSessions,
        sessionLayouts: omitKey(state.sessionLayouts, msg.sessionId),
        cliTerminalIds: omitKey(state.cliTerminalIds, msg.sessionId),
        cliAgentBySession: omitKey(state.cliAgentBySession, msg.sessionId),
        agentControlBySession: omitKey(state.agentControlBySession, msg.sessionId),
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
      break;
    }
    case "server.info": {
      const info = msg as ServerInfoMessage;
      const capabilities = Array.isArray(info.capabilities) ? info.capabilities : [];
      usePerchStore.setState({
        serverInfo: {
          hostname: info.hostname,
          isSsh: info.isSsh,
          platform: info.platform,
          protocolVersion: info.protocolVersion,
          capabilities,
          snapshotEpoch: info.snapshotEpoch,
          snapshotRevision: info.snapshotRevision,
        },
        // Absent when the server couldn't read one; `null` then means
        // "use xterm's own defaults" (see xtermSetup.ts).
        terminalProfile: info.terminalProfile ?? null,
        workspaceCapabilities: capabilities,
      });
      if (capabilities.includes(WORKSPACE_CAPABILITIES.snapshot)) {
        // The server.info frame establishes the capability gate and the
        // connection is already marked live by the transport callback.
        usePerchStore.getState().fetchWorkspaceSnapshot();
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
    case "commands.list": {
      usePerchStore.setState((state) => ({
        sessionCommands: {
          ...state.sessionCommands,
          [msg.sessionId]: { claude: msg.claude, codex: msg.codex, pi: msg.pi ?? [], omp: msg.omp ?? [] },
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
        if (ownsSurfaceRequest(msg.requestId)) break;
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
      // An error that arrives while an agent PTY attach is in flight is shown
      // on that pane; any other unattributed error has no surface to land on.
      if (usePerchStore.getState().attachingCliForSession != null) {
        usePerchStore.setState({ cliError: msg.message, attachingCliForSession: null });
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
      const previousHostState = usePerchStore.getState().hostStates[msg.hostId]?.state;
      // Upsert into hostStates. Retain inventory and drafts while offline,
      // but mark the last snapshot stale rather than claiming it is current.
      usePerchStore.setState((state) => ({
        hostStates: { ...state.hostStates, [msg.hostId]: msg },
        ...(msg.state !== "connected" ? {
          workspaceSnapshotByHost: {
            ...state.workspaceSnapshotByHost,
            [msg.hostId]: {
              ...state.workspaceSnapshotByHost[msg.hostId],
              state: "error" as const,
              error: "Remote disconnected. Showing the last known workspace inventory.",
            },
          },
        } : {}),
        workspaceCapabilitiesByHost: {
          ...state.workspaceCapabilitiesByHost,
          [msg.hostId]: Array.isArray(workspaceHostInfo.capabilities)
            ? workspaceHostInfo.capabilities
            : [],
        },
      }));
      if (msg.state === "connected" && previousHostState !== "connected") {
        const state = usePerchStore.getState();
        state.fetchWorkspaceSnapshot(msg.hostId);
        const workspaceIds = new Set(state.workspaces
          .filter((workspace) => workspace.hostId === msg.hostId)
          .map((workspace) => workspace.id));
        resyncPendingBuffersAfterReconnect(workspaceIds);
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
    case "usage.result":
      usePerchStore.setState({ usage: msg.accounts, spend: msg.spend ?? null, usageUpdatedAt: Date.now() });
      break;
    case "usage.redeemResult":
      usePerchStore.setState({ usageRedeemResult: msg });
      break;
    case "usage.alert": {
      // Same delivery rules as a finished session, but not session-scoped.
      const state = usePerchStore.getState();
      const focused = windowFocused();
      if (state.settings?.soundEnabled && msg.kind !== "reset") playBlockedTone();
      const channel = planNotification({
        event: true,
        viewed: false,
        focused,
        delivery: state.settings?.toastDelivery ?? "app",
        permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
        native: hasNativeNotifications(),
      });
      const toast = { id: newId(), sessionId: USAGE_NOTIFICATION_ID, title: msg.title, text: msg.body ? `${msg.title} · ${msg.body}` : msg.title, kind: "usage" as const, body: msg.body };
      if (channel === "system") {
        void sendSystemNotification(msg.title, msg.body, USAGE_NOTIFICATION_ID, () => undefined)
          .catch(() => usePerchStore.setState((current) => ({ toasts: [...current.toasts, toast] })));
      } else if (channel === "toast") {
        usePerchStore.setState({ toasts: [...state.toasts, toast] });
      }
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
    case "workspace.order": {
      if (msg.requestId) pendingWorkspaceRequests.delete(msg.requestId);
      usePerchStore.setState((state) => ({
        workspaceOrderByHost: { ...state.workspaceOrderByHost, [msg.hostId]: { projects: msg.projects, sessions: msg.sessions } },
      }));
      break;
    }
  }
}

socket.onMessage(handleServerMessage);
socket.onConnectionChange((connected) => {
  // Dropping the transport also invalidates the session; a fresh
  // session.create/subscribe handshake runs on reconnect (see ws.ts).
  if (!connected) {
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
// Apply the default look immediately so there's no flash of unstyled content
// before the server's settings.current (the persisted theme) arrives.
applyTheme("perch");
// The desktop shell raises this when an OS notification is clicked (notify.rs).
window.addEventListener(OPEN_SESSION_EVENT, (event) => {
  const id = (event as CustomEvent<unknown>).detail;
  if (typeof id === "string" && id && id !== USAGE_NOTIFICATION_ID) usePerchStore.getState().switchSession(id);
});
socket.connect();
