import { create } from "zustand";
import type { AgentAttach, AgentKind, ChatUsage, FsBrowseResultMessage, ModelEntry, ServerMessage, SessionSummary, SettingsData, SettingsPatch, SshHostEntry, HostInfoMessage, WorktreeEntry, WorktreeListMessage, WorktreeCreateMessage, WorktreeRemoveMessage, WorktreeListResultMessage, WorktreeDoneMessage, WorktreeErrorMessage } from "@perch/shared";
import { socket } from "./ws";
import { emitTerminalData } from "./terminalBus";
import { defaultModel } from "./models";
import { applyTheme } from "./themes";
import { playBlockedTone, playDoneTone } from "./sound";

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
}

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

interface PerchState {
  connected: boolean;
  sessionId: string | null;
  status: StatusInfo | null;
  messages: ChatMessage[];
  streamingMessageId: string | null;
  terminals: Record<string, TerminalMeta>;
  /** Per-session CLI terminal id, so toggling back into CLI mode reattaches
   * the existing PTY instead of spawning a new one. Keyed by sessionId.
   * Evicted when the cached terminal's exitCode is non-null (dead PTY), so
   * the next attach spawns a fresh one. */
  cliTerminalIds: Record<string, string>;
  agent: AgentKind;
  model: string;
  /** Server-discovered model lists, keyed by agent. Populated from server.info
   * on connect; empty arrays until the first server.info arrives. Clients must
   * not maintain their own hardcoded lists — different machines expose different
   * model sets depending on which CLI versions are installed. */
  availableModels: Record<AgentKind, ModelEntry[]>;
  /** All sessions known to the server, refreshed via session.list pushes. */
  sessions: SessionSummary[];
  /** Host info sent once per connection by the server after WS handshake. */
  serverInfo: { hostname: string; isSsh: boolean; platform: string } | null;
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
  /** Switch the sidebar to another host. Clears the project pin so the new
   * host resolves to its own most recent project. */
  setActiveHost: (hostId: string) => void;
  /** Pin the sidebar/tab bar to a project (also makes its host active). */
  setActiveProject: (hostId: string, cwd: string) => void;
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
  worktrees: Record<string, { worktrees: WorktreeEntry[]; defaultRoot: string }>;
  /** Which project's worktree popover an external trigger (the leader,W
   * keybind) wants opened, as `${hostId}:${cwd}` plus a monotonically
   * increasing nonce so pressing the same binding twice re-opens it. The
   * matching `WorktreeMenu` instance self-opens against its own button rect;
   * cleared by that instance once consumed. */
  worktreeMenuRequest: { projectKey: string; nonce: number } | null;
  /** "Session finished" toasts (Phase 6), derived client-side from
   * `session.updated` running→idle transitions on non-active sessions.
   * Rendered by `components/Toast.tsx`; dismissed on click or timeout. */
  toasts: ToastEntry[];
  /** Dismiss a toast by id (click or auto-dismiss timeout). */
  dismissToast: (id: string) => void;

  sendChat: (text: string) => void;
  cancelChat: () => void;
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
   * different cwd is requested, just focuses the composer instead. */
  createSessionOnHost: (hostId: string, cwd?: string) => void;
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
  ) => Promise<WorktreeReply>;
  /** Remove a worktree. Without `force`, a dirty checkout comes back as
   * `worktree.error { dirty: true }` — the caller escalates that into a
   * force confirmation rather than reporting a hard failure. */
  removeWorktree: (
    hostId: string,
    repoPath: string,
    path: string,
    force: boolean,
  ) => Promise<WorktreeReply>;
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
  attachAgentCli: (sessionId: string, agent: AgentKind) => Promise<string>;
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

/** Resolvers for in-flight `fs.browse` requests, keyed by requestId. See
 * `browseDirectory` and the `"fs.browse.result"` case in
 * `handleServerMessage`. Single-shot: each entry is deleted as soon as its
 * matching reply arrives (mirrors the hub's `PendingKey::Browse` semantics
 * on the server side). */
const pendingBrowses = new Map<string, (msg: FsBrowseResultMessage) => void>();

/** Any of the three replies a `worktree.*` request can produce. */
export type WorktreeReply =
  | WorktreeListResultMessage
  | WorktreeDoneMessage
  | WorktreeErrorMessage;

/** Resolvers for in-flight `worktree.*` requests, keyed by requestId — the
 * exact same single-shot request/response discipline as `pendingBrowses`
 * above (and as the server's `PendingKey::Worktree` hub slot). Every request
 * gets exactly one reply: `worktree.list.result`, `worktree.done`, or
 * `worktree.error`. */
const pendingWorktrees = new Map<string, (msg: WorktreeReply) => void>();

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
  msg: (WorktreeListMessage | WorktreeCreateMessage | WorktreeRemoveMessage) & { hostId: string },
): Promise<WorktreeReply> {
  return new Promise<WorktreeReply>((resolve) => {
    const requestId = newId();
    pendingWorktrees.set(requestId, resolve);
    const { hostId, ...rest } = msg;
    socket.send({
      ...rest,
      requestId,
      ...(hostId && hostId !== "local" ? { hostId } : {}),
    } as WorktreeListMessage | WorktreeCreateMessage | WorktreeRemoveMessage);
  });
}


function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The sidebar/tab-bar "active project" pin — a `(hostId, cwd)` pair. */
export interface ActiveProject {
  hostId: string;
  cwd: string;
}

/** localStorage keys backing `activeHostId` / `activeProject`. These are
 * client-only preferences: the navigation scope is pure view state, so it
 * never round-trips the protocol. */
const ACTIVE_HOST_STORAGE_KEY = "perch.activeHostId";
const ACTIVE_PROJECT_STORAGE_KEY = "perch.activeProject";

function readActiveHostStored(): string {
  try {
    return localStorage.getItem(ACTIVE_HOST_STORAGE_KEY) || "local";
  } catch {
    return "local";
  }
}

/**
 * True until the nav scope has been established for this profile. Only a
 * profile that has never picked a host/project gets its host *and* project
 * seeded from the most recent session (see the `"session.list"` handler).
 * Once anything has set the scope — a persisted value, a host switch, a
 * project click, opening a session — later `session.list` pushes must never
 * move the sidebar off the host the user is looking at. That matters
 * concretely with federation: the hub re-broadcasts `session.list` whenever a
 * remote host's list changes, and without this latch the newest session
 * (usually a local one) would yank the sidebar back to "local" moments after
 * the user switched to a remote host.
 */
let navSeedPending = (() => {
  try {
    return (
      localStorage.getItem(ACTIVE_HOST_STORAGE_KEY) == null &&
      localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) == null
    );
  } catch {
    return false;
  }
})();

function writeActiveHostStored(hostId: string): void {
  navSeedPending = false;
  try {
    localStorage.setItem(ACTIVE_HOST_STORAGE_KEY, hostId);
  } catch {
    // ignore — worst case the scope doesn't survive a reload
  }
}

function readActiveProjectStored(): ActiveProject | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const { hostId, cwd } = parsed as Partial<ActiveProject>;
      if (typeof hostId === "string" && typeof cwd === "string") return { hostId, cwd };
    }
    return null;
  } catch {
    return null;
  }
}

function writeActiveProjectStored(project: ActiveProject | null): void {
  try {
    if (project) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, JSON.stringify(project));
    else localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** A project = every session sharing one `(hostId, cwd)`. The sidebar has
 * always grouped this way; the nav redesign just promotes the grouping to a
 * first-class, selectable navigation level. */
export interface ProjectGroup {
  /** `${hostId}:${cwd}` — also the `workspaceGit` / `tabOrder` cache key. */
  key: string;
  hostId: string;
  cwd: string;
  /** Sessions in the project, newest-first. */
  sessions: SessionSummary[];
  /** Newest session's createdAt — used to order projects newest-first. */
  newestAt: number;
}

/** The slice of store state every project-navigation helper below reads. */
export type ProjectNavState = Pick<
  PerchState,
  "sessions" | "sessionId" | "activeHostId" | "activeProject"
>;

/**
 * Projects belonging to `hostId`, newest-first. Archived sessions are always
 * excluded — archiving is the "make it disappear" action, so a project whose
 * sessions were all archived drops out of the nav entirely. Archived sessions
 * are only reachable from Settings → Archived sessions (restore / delete).
 */
export function projectsForHost(state: ProjectNavState, hostId: string): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const s of state.sessions) {
    if ((s.hostId ?? "local") !== hostId) continue;
    if (s.archived) continue;
    const cwd = s.cwd ?? "(unknown)";
    const key = `${hostId}:${cwd}`;
    let group = map.get(key);
    if (!group) {
      group = { key, hostId, cwd, sessions: [], newestAt: 0 };
      map.set(key, group);
    }
    group.sessions.push(s);
    if (s.createdAt > group.newestAt) group.newestAt = s.createdAt;
  }
  for (const group of map.values()) group.sessions.sort((a, b) => b.createdAt - a.createdAt);
  return [...map.values()].sort((a, b) => b.newestAt - a.newestAt);
}

/**
 * Resolve the project the sidebar and tab bar are scoped to.
 *
 * Normally this is just `activeProject`, but two cases need a fallback:
 *  - the pin points at a project with no listed sessions. That happens
 *    legitimately right after "+ New session" in a fresh directory (Fix 3
 *    defers the DB row until the first message, so the project has no
 *    sessions yet) — detected by the active session having no row — in which
 *    case the pin is kept so the new project doesn't blink out of the nav;
 *  - otherwise the project genuinely disappeared (its last session was
 *    deleted or archived), so fall back to the host's most recent project.
 * `null` means the active host has no projects at all.
 */
export function effectiveActiveProject(state: ProjectNavState): ActiveProject | null {
  const hostId = state.activeHostId;
  const projects = projectsForHost(state, hostId);
  const pinned = state.activeProject;
  if (pinned && pinned.hostId === hostId) {
    if (projects.some((p) => p.cwd === pinned.cwd)) return pinned;
    const activeIsUnpersisted =
      state.sessionId != null && !state.sessions.some((s) => s.id === state.sessionId);
    if (activeIsUnpersisted) return pinned;
  }
  const first = projects[0];
  return first ? { hostId, cwd: first.cwd } : null;
}

/** Sessions of the effective active project, sorted oldest-first — the
 * ordering `TabBar` renders (before any stored drag order) and the one
 * `keybinds.ts` (leader,n/p/1-9) cycles through, so both always agree.
 * Archived sessions are always omitted. */
export function activeProjectSessions(state: ProjectNavState): SessionSummary[] {
  const project = effectiveActiveProject(state);
  if (!project) {
    const current = state.sessions.find((s) => s.id === state.sessionId);
    return current && !current.archived ? [current] : [];
  }
  return state.sessions
    .filter((s) => (s.hostId ?? "local") === project.hostId && s.cwd === project.cwd)
    .filter((s) => !s.archived)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Every archived session known to the client, newest-first. The one place
 * archived sessions surface in the UI is Settings → Archived sessions, which
 * renders straight from this. Spans all hosts (the sidebar's host/project
 * scoping deliberately does not apply — the panel is a global recycle bin). */
export function archivedSessions(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.filter((s) => s.archived).sort((a, b) => b.createdAt - a.createdAt);
}

export const usePerchStore = create<PerchState>((set, get) => ({
  connected: false,
  sessionId: null,
  status: null,
  messages: [],
  streamingMessageId: null,
  terminals: {},
  cliTerminalIds: {},
  agent: "claude",
  model: "",
  availableModels: { claude: [], codex: [] },
  sessions: [],
  serverInfo: null,
  attachingCliForSession: null,
  cliError: null,
  settingsOpen: false,
  settings: null,
  hosts: [],
  hostStates: {},
  hostModels: { local: { claude: [], codex: [] } },
  activeHostId: readActiveHostStored(),
  activeProject: readActiveProjectStored(),
  sessionLayouts: {},
  sidebarCollapsed: false,
  workspaceGit: {},
  worktrees: {},
  worktreeMenuRequest: null,
  toasts: [],

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  sendChat: (text) => {
    const { sessionId, agent, model } = get();
    if (!sessionId || !text.trim()) return;
    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      text,
      thinking: "",
      tools: [],
      streaming: false,
    };
    const assistantMessage: ChatMessage = {
      id: newId(),
      role: "assistant",
      text: "",
      thinking: "",
      tools: [],
      streaming: true,
      agent,
      model,
    };
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      streamingMessageId: assistantMessage.id,
    }));
    socket.send({ type: "chat.send", sessionId, text, agent, model });
  },

  cancelChat: () => {
    const { sessionId } = get();
    if (!sessionId) return;
    socket.send({ type: "chat.cancel", sessionId });
  },

  setAgent: (agent) => {
    const state = get();
    // Prefer the active host's model list; fall back to server.info-derived list.
    const hostModelEntry = state.hostModels[state.activeHostId];
    const available = (hostModelEntry ? hostModelEntry[agent] : undefined) ?? state.availableModels[agent];
    set({ agent, model: defaultModel(agent, available) });
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
    const newAgent: AgentKind = (s?.lastAgent as AgentKind | undefined) ?? "claude";
    const newHostId = s?.hostId ?? "local";
    // Use the active host's model list for reconciliation; fall back to
    // local availableModels when the host has no model info yet.
    const hostModelEntry = get().hostModels[newHostId];
    const available = hostModelEntry?.[newAgent] ?? get().availableModels[newAgent];
    const newModel = s?.lastModel ?? defaultModel(newAgent, available);
    // Opening a session from *anywhere* (sidebar row, tab, Navigator, mobile
    // switcher, toast) re-scopes the nav onto that session's host + project.
    const newProject = s?.cwd ? { hostId: newHostId, cwd: s.cwd } : get().activeProject;
    writeActiveHostStored(newHostId);
    writeActiveProjectStored(newProject);
    set({
      messages: [],
      streamingMessageId: null,
      agent: newAgent,
      model: newModel,
      cliError: null,
      activeHostId: newHostId,
      activeProject: newProject,
    });
    socket.switchSession(sessionId);
  },

  setActiveHost: (hostId) => {
    // Always persist, even when the host is unchanged: writing closes the
    // one-shot `navSeedPending` latch, so an explicit "stay on this host"
    // click is as binding as a switch.
    writeActiveHostStored(hostId);
    if (get().activeHostId === hostId) return;
    writeActiveProjectStored(null);
    set({ activeHostId: hostId, activeProject: null });
  },

  setActiveProject: (hostId, cwd) => {
    writeActiveHostStored(hostId);
    writeActiveProjectStored({ hostId, cwd });
    set({ activeHostId: hostId, activeProject: { hostId, cwd } });
  },

  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
  },

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

  createSessionOnHost: (hostId, cwd) => {
    // Fix 3: If the active session on this host has no messages (empty) and
    // no different cwd is requested, just focus the composer — don't create
    // another blank session.
    const state = get();
    const currentSession = state.sessions.find((s) => s.id === state.sessionId);
    const currentHostId = currentSession?.hostId ?? "local";
    const isCurrentHostMatch = currentHostId === hostId || (hostId === "local" && currentHostId === "local");
    if (isCurrentHostMatch && state.messages.length === 0 && !cwd) {
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

  createWorktree: (hostId, repoPath, branch, newBranch, path) => {
    return sendWorktreeRequest({
      type: "worktree.create",
      requestId: "",
      hostId,
      repoPath,
      branch,
      newBranch,
      ...(path ? { path } : {}),
    });
  },

  removeWorktree: (hostId, repoPath, path, force) => {
    return sendWorktreeRequest({
      type: "worktree.remove",
      requestId: "",
      hostId,
      repoPath,
      path,
      force,
    });
  },

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

  attachAgentCli: (sessionId, agent) => {
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
      .createTerminal(80, 24, { agentAttach: { sessionId, agent } })
      .then((id) => {
        set((state) => ({
          cliTerminalIds: { ...state.cliTerminalIds, [sessionId]: id },
          attachingCliForSession: null,
        }));
        return id;
      });
  },

  sendTerminalInput: (terminalId, data) => {
    socket.send({ type: "terminal.input", terminalId, data });
  },

  resizeTerminal: (terminalId, cols, rows) => {
    socket.send({ type: "terminal.resize", terminalId, cols, rows });
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

/** Immutably patch the currently-streaming assistant message, if any. */
function updateStreamingMessage(update: (msg: ChatMessage) => ChatMessage): void {
  const { streamingMessageId, messages } = usePerchStore.getState();
  if (!streamingMessageId) return;
  usePerchStore.setState({
    messages: messages.map((m) => (m.id === streamingMessageId ? update(m) : m)),
  });
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
  usePerchStore.setState({
    sessionId: null,
    messages: [],
    streamingMessageId: null,
    cliError: null,
  });
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case "session.created": {
      usePerchStore.setState({ sessionId: msg.sessionId });
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
        return {
          sessions: msg.sessions,
          activeHostId: hostId,
          activeProject: { hostId, cwd: newest.cwd },
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
              new Notification(becameBlocked ? "Session needs attention" : "Session finished", {
                body: msg.session.title || "(untitled session)",
              });
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
        if (!prev && msg.session.id === state.sessionId && msg.session.cwd) {
          activeHostId = msg.session.hostId ?? "local";
          activeProject = { hostId: activeHostId, cwd: msg.session.cwd };
          writeActiveHostStored(activeHostId);
          writeActiveProjectStored(activeProject);
        }

        return { sessions, toasts, activeProject, activeHostId };
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
    case "session.deleted": {
      const state = usePerchStore.getState();
      const wasActive = state.sessionId === msg.sessionId;
      const { [msg.sessionId]: _removedLayout, ...restLayouts } = state.sessionLayouts;
      const { [msg.sessionId]: _removedCli, ...restCli } = state.cliTerminalIds;
      const remainingSessions = state.sessions.filter((s) => s.id !== msg.sessionId);
      usePerchStore.setState({
        sessions: remainingSessions,
        sessionLayouts: restLayouts,
        cliTerminalIds: restCli,
      });
      if (wasActive) {
        switchAwayFromActiveSession(
          remainingSessions.filter((s) => !s.archived),
          state.activeHostId
        );
      }
      break;
    }
    case "server.info": {
      const availableModels: Record<AgentKind, ModelEntry[]> = {
        claude: msg.claudeModels,
        codex: msg.codexModels,
      };
      usePerchStore.setState((state) => {
        // Seed hostModels["local"] from server.info so the ModelChip can use
        // the active host's model list when activeHostId is "local".
        const newHostModels = {
          ...state.hostModels,
          local: { claude: msg.claudeModels, codex: msg.codexModels },
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
            hostname: msg.hostname,
            isSsh: msg.isSsh,
            platform: msg.platform,
          },
          availableModels,
          hostModels: newHostModels,
          model: reconciledModel,
        };
      });
      break;
    }
    case "session.history": {
      const messages: ChatMessage[] = msg.messages.map((h) => ({
        id: h.id,
        role: h.role,
        text: h.text,
        thinking: h.thinking ?? "",
        tools: [],
        streaming: false,
        agent: h.agent,
        model: h.model,
      }));
      usePerchStore.setState({ messages, streamingMessageId: null });
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
          usePerchStore.setState({ activeHostId: hostId, activeProject: { hostId, cwd: sessionEntry.cwd } });
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
      updateStreamingMessage((m) => ({
        ...m,
        text: m.text + msg.text,
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.thinking": {
      updateStreamingMessage((m) => ({
        ...m,
        thinking: m.thinking + msg.text,
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_use": {
      updateStreamingMessage((m) => ({
        ...m,
        tools: [...m.tools, { name: msg.name, input: msg.input, done: false }],
        turnStartedAt: m.turnStartedAt ?? Date.now(),
      }));
      break;
    }
    case "chat.tool_result": {
      updateStreamingMessage((m) => {
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
      updateStreamingMessage((m) => ({
        ...m,
        streaming: false,
        usage: msg.usage,
        elapsedSec: m.turnStartedAt != null
          ? Math.round((Date.now() - m.turnStartedAt) / 1000)
          : undefined,
      }));
      usePerchStore.setState({ streamingMessageId: null });
      break;
    }
    case "error": {
      const { streamingMessageId, attachingCliForSession } = usePerchStore.getState();
      if (streamingMessageId) {
        updateStreamingMessage((m) => ({ ...m, streaming: false, error: msg.message }));
        usePerchStore.setState({ streamingMessageId: null });
      } else if (attachingCliForSession != null) {
        // Error arrived while a CLI PTY attach was in flight — surface it as
        // the cliError overlay (visible in CLI mode) instead of pushing it
        // into the chat message list which is hidden in CLI mode.
        usePerchStore.setState({ cliError: msg.message, attachingCliForSession: null });
      } else {
        usePerchStore.setState((state) => ({
          messages: [
            ...state.messages,
            {
              id: newId(),
              role: "assistant",
              text: "",
              thinking: "",
              tools: [],
              streaming: false,
              error: msg.message,
            },
          ],
        }));
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
        return { hosts: msg.hosts, activeHostId: "local", activeProject: null };
      });
      break;
    }
    case "host.info": {
      // Upsert into hostStates.
      usePerchStore.setState((state) => ({
        hostStates: { ...state.hostStates, [msg.hostId]: msg },
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
          [key]: { worktrees: msg.worktrees, defaultRoot: msg.defaultRoot },
        },
      }));
      resolveWorktreeRequest(msg.requestId, msg);
      break;
    }
    case "worktree.done":
    case "worktree.error": {
      resolveWorktreeRequest(msg.requestId, msg);
      break;
    }
  }
}

socket.onMessage(handleServerMessage);
socket.onConnectionChange((connected) => {
  // Dropping the transport also invalidates the session; a fresh
  // session.create/subscribe handshake runs on reconnect (see ws.ts).
  usePerchStore.setState(connected ? { connected } : { connected, sessionId: null });
});
// Apply herdr's default look (catppuccin) immediately so there's no flash of
// unstyled (or browser-default) content before the server's settings.current
// message (holding the actual persisted theme, if not "catppuccin") arrives.
applyTheme("catppuccin");
socket.connect();
