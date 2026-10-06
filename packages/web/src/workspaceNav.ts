/**
 * workspaceNav.ts — navigation between workspaces ("nests") outside React:
 * the sidebar and the keyboard shortcuts (`keybinds.ts`) share it, so a
 * keystroke lands exactly where a click would.
 */
import type { SessionSummary } from "@perch/shared";
import { takeClosedTab } from "./closedTabs";
import { usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "./store";

/** A project's live workspaces: pinned first, then active, then most recent. */
export function workspacesForProject(workspaces: WorkspaceRecord[], projectId: string): WorkspaceRecord[] {
  return workspaces
    .filter((workspace) => workspace.projectId === projectId && workspace.state !== "archived")
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (a.state !== b.state) return a.state === "active" ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

/** The Chats project: the scratch folder "No project" sessions run in
 * (`session::chats_pair`). Listed as a flat chat list after the projects. */
export function isChatsProject(project: WorkspaceProject): boolean {
  return project.path.endsWith("/.perch/scratch");
}

export function sessionsForWorkspace(sessions: SessionSummary[], workspace: WorkspaceRecord): SessionSummary[] {
  return sessions
    .filter((session) => {
      if (session.workspaceId) return session.workspaceId === workspace.id;
      return (session.hostId ?? "local") === workspace.hostId && session.cwd === workspace.path;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** A clicked workspace with no sessions never keeps showing another
 * workspace's session: it starts the agent set in Settings → "Empty
 * workspace opens", else shows its start picker (`NoSessionPanel`). */
export function openEmptyWorkspace(hostId: string, path: string): void {
  const state = usePerchStore.getState();
  const agent = state.settings?.emptyWorkspaceAgent;
  if (agent) state.createSessionOnHost(hostId, path, agent);
  else state.showWorkspaceHome();
}

export function navigateToWorkspace(workspaceId: string): void {
  const before = usePerchStore.getState();
  before.focusWorkspace(workspaceId);
  const workspace = before.workspaces.find((candidate) => candidate.id === workspaceId);
  if (!workspace) return;
  const own = sessionsForWorkspace(before.sessions, workspace);
  if (own.some((candidate) => candidate.id === before.sessionId)) return;
  if (own[0]) before.switchSession(own[0].id);
  else openEmptyWorkspace(workspace.hostId, workspace.path);
}

/** The active host's nests in the sidebar's order: favourite projects first,
 * then by recent activity; Chats and hidden worktrees left out.
 * ponytail: a worktree nested under another renders under it in the sidebar
 * but sorts flat here; port the sidebar's parent grouping if that matters. */
export function orderedNests(): WorkspaceRecord[] {
  const state = usePerchStore.getState();
  return state.workspaceProjects
    .filter((project) => project.hostId === state.activeHostId && !isChatsProject(project))
    .sort((a, b) => (a.favorite !== b.favorite ? (a.favorite ? -1 : 1) : b.updatedAt - a.updatedAt))
    .flatMap((project) => workspacesForProject(state.workspaces, project.id).filter((workspace) => !workspace.hidden));
}

/** Previous/next nest, wrapping. */
export function stepNest(dir: 1 | -1): void {
  const nests = orderedNests();
  if (nests.length < 2) return;
  const idx = nests.findIndex((nest) => nest.id === usePerchStore.getState().activeWorkspaceId);
  const next = nests[idx === -1 ? (dir > 0 ? 0 : nests.length - 1) : (idx + dir + nests.length) % nests.length];
  if (next) navigateToWorkspace(next.id);
}

/** The Nth (1-indexed) nest. No-op out of range. */
export function jumpToNest(n: number): void {
  const nest = orderedNests()[n - 1];
  if (nest) navigateToWorkspace(nest.id);
}

/** A new chat in Chats (the Scratchpad): its start picker, or the empty-workspace agent. */
export function newScratchpad(): void {
  const state = usePerchStore.getState();
  const chats = state.workspaceProjects.find((project) => project.hostId === state.activeHostId && isChatsProject(project));
  if (!chats) return;
  const workspace = workspacesForProject(state.workspaces, chats.id)[0];
  if (workspace) state.focusWorkspace(workspace.id);
  else state.focusWorkspaceProject(chats.id);
  openEmptyWorkspace(chats.hostId, workspace?.path ?? chats.path);
}

/** Cmd+Shift+T: start the harness of the most recently closed tab again, in its nest.
 * A tab whose nest is gone is skipped. */
export function reopenClosedTab(): void {
  const state = usePerchStore.getState();
  const nests = new Set(state.workspaces.filter((workspace) => workspace.state !== "archived").map((workspace) => workspace.id));
  const tab = takeClosedTab((candidate) => !candidate.workspaceId || nests.has(candidate.workspaceId));
  if (!tab) return;
  if (tab.workspaceId) state.focusWorkspace(tab.workspaceId);
  state.createSessionOnHost(tab.hostId, tab.cwd, tab.providerId);
}
