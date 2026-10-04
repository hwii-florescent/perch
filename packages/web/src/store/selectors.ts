/**
 * Pure, already-side-effect-free selectors over `PerchState` (or a `Pick` of
 * it). Pure move from store.ts — see the refactor plan's Phase 6. No logic
 * changed.
 */
import type { AgentKind, SessionSummary } from "@perch/shared";
import type { ActiveProject, PerchState, WorkspaceRecord } from "./index";

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
> & {
  /** Optional so project-only callers keep working; the full store state has both. */
  activeWorkspaceId?: string | null;
  workspaces?: WorkspaceRecord[];
};

/** Projects belonging to `hostId`, newest-first. */
export function projectsForHost(state: ProjectNavState, hostId: string): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const s of state.sessions) {
    if ((s.hostId ?? "local") !== hostId) continue;
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
 *    deleted), so fall back to the host's most recent project.
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

/** The workspace the tab strip is scoped to: `activeWorkspaceId`, else the
 * active session's `workspaceId`, resolved against `state.workspaces`. `null`
 * when nothing resolves (hosts without workspace support). */
export function effectiveWorkspace(state: ProjectNavState): WorkspaceRecord | null {
  const id =
    state.activeWorkspaceId ??
    state.sessions.find((s) => s.id === state.sessionId)?.workspaceId ??
    null;
  return (id && state.workspaces?.find((w) => w.id === id)) || null;
}

/** Sessions of the effective workspace (a project checkout or one of its git
 * worktrees), sorted oldest-first — the ordering `TabBar` renders (before any
 * stored drag order) and the one `keybinds.ts` (leader,n/p/1-9) cycles
 * through, so both always agree. A session with no `workspaceId` belongs to
 * the workspace whose `(hostId, path)` matches its `(hostId, cwd)`. With no
 * effective workspace it falls back to the whole project `(hostId, cwd)`. */
export function activeWorkspaceSessions(state: ProjectNavState): SessionSummary[] {
  const ws = effectiveWorkspace(state);
  if (ws) {
    return state.sessions
      .filter(
        (s) =>
          s.workspaceId === ws.id ||
          (!s.workspaceId && (s.hostId ?? "local") === ws.hostId && s.cwd === ws.path),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  // The home screen (no session, no workspace) has no tabs; the project fallback below
  // would show the first project's sessions instead.
  if (state.sessionId == null && state.workspaces?.length) return [];
  const project = effectiveActiveProject(state);
  if (!project) {
    const current = state.sessions.find((s) => s.id === state.sessionId);
    return current ? [current] : [];
  }
  return state.sessions
    .filter((s) => (s.hostId ?? "local") === project.hostId && s.cwd === project.cwd)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Ids of the sessions belonging to one project (host + cwd), using the
 * exact same membership rule as `projectsForHost` (absent hostId treated as
 * "local"). Backs the sidebar's "close all sessions in this project" bulk
 * action — kept as a
 * pure function so the bulk action's selection can be unit-tested without
 * mounting `Sidebar.tsx`. */
export function sessionIdsForProject(
  sessions: SessionSummary[],
  hostId: string,
  cwd: string
): string[] {
  return sessions
    .filter((s) => (s.hostId ?? "local") === hostId && (s.cwd ?? "(unknown)") === cwd)
    .map((s) => s.id);
}

/**
 * Which provider a session should resolve to when it becomes active, absent
 * any live turn already in flight. The server-confirmed `lastAgent` (present
 * once at least one turn has been sent, carried on the session summary) wins
 * whenever it exists — it reflects the actual conversation history. Before
 * that, `hostedAgentBySession` carries the client's create-time choice (Bug
 * 2/3 fix: without this, switching away from and back to a freshly-created,
 * still-empty session would silently reset the picker to "claude", since
 * `lastAgent` doesn't exist yet). `"claude"` is the final fallback, matching
 * every pre-existing session and pre-fix code path.
 */
export function resolveSessionAgent(
  session: Pick<SessionSummary, "lastAgent"> | undefined,
  hostedAgentBySession: Record<string, AgentKind>,
  sessionId: string | null,
): AgentKind {
  const lastAgent = session?.lastAgent as AgentKind | undefined;
  if (lastAgent) return lastAgent;
  if (sessionId && hostedAgentBySession[sessionId]) return hostedAgentBySession[sessionId];
  return "claude";
}

/** Drop one key from a `Record`, immutably. Shared by every per-session map
 * (`sessionLayouts`, `cliTerminalIds`, `cliAgentBySession`,
 * `hostedAgentBySession`) that has to evict its entry for a deleted session —
 * kept as one pure helper so the four cleanups can't drift out of sync. */
export function omitKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _omitted, ...rest } = map;
  return rest;
}

/**
 * Bug 1: whether `createSessionOnHost` should skip creating a new session and
 * just focus the composer on the current one instead. The guard exists so
 * "+ New session" doesn't mint a second blank session when the user is
 * already sitting on an empty one for this host — but that reuse is only
 * possible when there IS a current session to reuse. With `sessionId: null`
 * (no session open at all — e.g. every session was just deleted, or a fresh
 * profile that hasn't created one yet) there is nothing to focus, so the old
 * `currentHostId = currentSession?.hostId ?? "local"` fallback made this
 * guard fire anyway (an absent session "matched" a `hostId` of `"local"`) and
 * silently no-op the button. Requiring an actual `currentSession` fixes that.
 *
 * CLI mode stays exempt regardless: the PTY conversation is never recorded as
 * hosted messages, so `messages.length === 0` is true for *every* CLI
 * session, including a dead one — reusing it would turn "New session" into a
 * silent no-op on an exited pane.
 */
export function shouldReuseCurrentSession(
  state: Pick<ProjectNavState, "sessions" | "sessionId">,
  hostId: string,
  cwd: string | undefined,
  cliMode: boolean,
  messagesEmpty: boolean,
): boolean {
  const currentSession = state.sessions.find((s) => s.id === state.sessionId);
  if (!currentSession) return false;
  const currentHostId = currentSession.hostId ?? "local";
  const isCurrentHostMatch = currentHostId === hostId || (hostId === "local" && currentHostId === "local");
  return isCurrentHostMatch && !cliMode && messagesEmpty && !cwd;
}
