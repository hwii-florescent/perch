//! Navigation as `@perch/sdk` gives it (1.3, `stock:sidebar` and its clones): the hosts, and the active host's
//! projects, workspaces and sessions with Perch's rules already applied. Which sessions are listed
//! (`listedInSidebar`, Quickchat lists all), the order (favourites, the core's `workspace.order`, each strip's
//! chat order, by attention on request), each session's status section (`statusView.ts`) including the chat held
//! in Done while it is read (`holdFinished`), the attention facts and the Quickchat project all live here, once,
//! so a screen and its clones arrange the same data instead of each carrying the rules. Owns no state but the
//! per-hook hold and the pending Add project request; the stores stay the owners. Actions are typed commands
//! (`modCommands.ts`), not functions here.
import type * as Sdk from "@perch/sdk";
import type { SessionSummary } from "@perch/shared";
import { useEffect, useRef } from "react";
import { ADD_PROJECT_EVENT } from "./appEvents";
import { certaintyNote, needsYou, reasonLabel, useAttention } from "./attention";
import { instructionsAvailable } from "./instructions";
import { useNestShortcutHints } from "./keybinds";
import { memoryAvailable } from "./memory";
import { isNestedIn, nestUnderLeads, orderBy, orderProjects } from "./sidebarOrder";
import { sessionDotState, type AgentDotState } from "./statusDot";
import { groupByStatus, holdFinished, listedInSidebar, sectionOf, STATUS_LABELS, STATUS_SECTIONS, topSection } from "./statusView";
import { canReorderHost, effectiveActiveProject, projectsForHost, usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "./store";
import { useTabOrderVersion } from "./tabOrder";
import { isChatsProject, orderedNests, sessionsForWorkspace, workspacesForProject } from "./workspaceNav";
import { chatsInStripOrder, workspaceTabs } from "./workspaceTabs";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}
const projectName = (project: WorkspaceProject) => (isChatsProject(project) ? "Quickchat" : project.name || basename(project.path));

export function useHosts(): Sdk.Hosts {
  const connected = usePerchStore((s) => s.connected);
  const serverInfo = usePerchStore((s) => s.serverInfo);
  const status = usePerchStore((s) => s.status);
  const hosts = usePerchStore((s) => s.hosts);
  const hostStates = usePerchStore((s) => s.hostStates);
  const activeId = usePerchStore((s) => s.activeHostId);
  const capabilities = usePerchStore((s) => (s.activeHostId === "local" ? s.workspaceCapabilities : s.workspaceCapabilitiesByHost[s.activeHostId] ?? []));
  const localState: Sdk.HostState = connected ? "connected" : "connecting";
  const list: Sdk.HostInfo[] = [
    { id: "local", name: serverInfo?.hostname ? `local (${serverInfo.hostname})` : "local", state: localState, detail: serverInfo?.platform, direct: false },
    ...hosts.map((h) => {
      const info = hostStates[h.id];
      return {
        id: h.id,
        name: h.name,
        state: info ? info.state : h.enabled ? "connecting" : "disabled",
        error: info?.error,
        detail: h.mode === "direct" ? `${h.sshHost} (direct)` : h.directUrl || `${h.sshHost}:${h.remotePort}`,
        address: h.directUrl ?? `${h.sshHost}:${h.remotePort}`,
        direct: h.mode === "direct",
        enabled: h.enabled,
      } satisfies Sdk.HostInfo;
    }),
  ];
  // A host removed from Settings while shown is still the active one until another is picked.
  const active = list.find((h) => h.id === activeId) ?? { id: activeId, name: activeId, state: hostStates[activeId]?.state ?? "disabled", error: hostStates[activeId]?.error, direct: false };
  return {
    activeId, active, list, connected,
    local: { hostname: serverInfo?.hostname, platform: serverInfo?.platform, isSsh: serverInfo?.isSsh, cwd: status?.cwd, branch: status?.branch },
    canCreate: connected && (activeId === "local" || active.state === "connected"),
    workspaces: capabilities.includes("workspace.snapshot"),
  };
}

/** The most urgent dot among `sessions` (a folder's aggregate, as herdr's per-space glyph). */
const DOT_URGENCY: AgentDotState[] = ["blocked", "working", "done", "idle", "unknown"];
function aggregateDotState(sessions: SessionSummary[]): AgentDotState {
  let best: AgentDotState = "unknown";
  for (const session of sessions) {
    const state = sessionDotState(session);
    if (DOT_URGENCY.indexOf(state) < DOT_URGENCY.indexOf(best)) best = state;
  }
  return best;
}

/** The needs-you facts and the chat held in Done while it is read, for one viewer. `sessions` are the listed ones. */
function useStatusFacts(sessions: SessionSummary[]) {
  const sessionId = usePerchStore((s) => s.sessionId);
  const events = useAttention((s) => s.events);
  const viewed = sessions.find((session) => session.id === sessionId);
  const viewedDot = viewed && sessionDotState(viewed);
  // A chat you are reading stays in Done until you leave it, so its row does not jump (`holdFinished`).
  const reading = useRef<{ id: string | null; held: string | null; dot?: AgentDotState }>({ id: null, held: null });
  const same = reading.current.id === sessionId;
  const held = holdFinished(same ? reading.current.held : null, sessionId, same ? reading.current.dot : undefined, viewedDot);
  reading.current = { id: sessionId, held, dot: viewedDot };
  const needs = new Map(needsYou(events).map((event) => [event.sessionId, event]));
  return { sessionId, held, needs, needIds: new Set(needs.keys()) as ReadonlySet<string> };
}

export function useNavigation(options?: { showTerminals?: boolean; sortByAttention?: boolean }): Sdk.Navigation {
  const showTerminals = !!options?.showTerminals;
  const sortByAttention = !!options?.sortByAttention;
  const hints = useNestShortcutHints();
  useTabOrderVersion(); // a strip's drag order is the sessions' order here too
  const hostId = usePerchStore((s) => s.activeHostId);
  const projects = usePerchStore((s) => s.workspaceProjects);
  const workspaces = usePerchStore((s) => s.workspaces);
  const allSessions = usePerchStore((s) => s.sessions);
  const remembered = usePerchStore((s) => s.cliAgentBySession);
  const jobs = usePerchStore((s) => s.worktreeJobs);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const snapshot = usePerchStore((s) => s.workspaceSnapshotByHost[s.activeHostId]);
  const hosts = usePerchStore((s) => s.hosts);
  const hostStates = usePerchStore((s) => s.hostStates);
  const connected = usePerchStore((s) => s.connected);
  const order = usePerchStore((s) => s.workspaceOrderByHost[s.activeHostId]);
  const canReorder = usePerchStore((s) => canReorderHost(s, s.activeHostId));
  usePerchStore((s) => s.serverInfo); // instructions and memory follow the core's capabilities

  // Project terminals stay tabs unless asked; Quickchat always lists every session.
  const quickchatIds = new Set(projects.filter(isChatsProject).map((project) => project.id));
  const sessions = allSessions.filter((session) => showTerminals || quickchatIds.has(session.projectId ?? "") || listedInSidebar(session, remembered[session.id]));
  const listed = new Set(sessions.map((session) => session.id));
  const { sessionId, held, needs, needIds } = useStatusFacts(sessions);
  const reachable = hostId === "local" ? connected : hostStates[hostId]?.state === "connected";

  const workspaceLabel = (session: SessionSummary): string | undefined => {
    const own = workspaces.find((candidate) => candidate.id === session.workspaceId);
    if (!own || workspacesForProject(workspaces, own.projectId).filter((w) => !w.hidden).length < 2) return undefined;
    return own.branch || own.name;
  };
  const infos = new Map<string, Sdk.SessionInfo>();
  const info = (session: SessionSummary): Sdk.SessionInfo => {
    const known = infos.get(session.id);
    if (known) return known;
    const section = sectionOf(session, needIds, held);
    const need = needs.get(session.id);
    const owner = projects.find((project) => project.id === session.projectId);
    const made: Sdk.SessionInfo = {
      id: session.id, title: session.title ?? "", hostId: session.hostId ?? "local", cwd: session.cwd, createdAt: session.createdAt,
      status: session.status, branch: session.currentBranch, projectId: session.projectId, projectName: owner && projectName(owner),
      workspaceId: session.workspaceId, workspaceLabel: workspaceLabel(session), parentId: session.parentSessionId,
      provider: session.currentProviderId ?? remembered[session.id] ?? session.cliProviderId, state: sessionDotState(session), section,
      needReason: section === "needs" ? (need ? [reasonLabel(need), certaintyNote(need)].filter(Boolean).join(" · ") : "Waiting for you") : undefined,
      blocked: !!session.blocked, unseen: !!session.unseen, active: session.id === sessionId,
    };
    infos.set(session.id, made);
    return made;
  };

  /** A workspace's listed sessions in its strip's order (the core's chat order and this viewer's drags are in it). */
  const stripSessions = (workspace: WorkspaceRecord): SessionSummary[] =>
    workspaceTabs({ ...usePerchStore.getState(), activeHostId: workspace.hostId, activeWorkspaceId: workspace.id }, [])
      .flatMap((entry) => (entry.kind === "session" && listed.has(entry.session.id) ? [entry.session] : []));
  /** Most urgent section of `list` as an index into STATUS_SECTIONS (Idle when nothing is known). */
  const urgency = (list: SessionSummary[]) => {
    const top = reachable ? topSection(list, needIds, held) : null;
    return top ? STATUS_SECTIONS.indexOf(top) : STATUS_SECTIONS.length - 1;
  };
  const hintFor = new Map(orderedNests().slice(0, hints.length).map((nest, at) => [nest.id, hints[at] ?? undefined]));

  const workspaceInfo = (workspace: WorkspaceRecord, children: Map<string, WorkspaceRecord[]>, depth: number): Sdk.WorkspaceInfo => ({
    id: workspace.id, projectId: workspace.projectId, name: workspace.name || basename(workspace.path), path: workspace.path, branch: workspace.branch || undefined,
    dirty: !!workspace.dirty, pinned: !!workspace.pinned, sleeping: workspace.state === "sleeping", linked: !!workspace.parentWorkspaceId,
    active: workspace.id === activeWorkspaceId, shortcut: hintFor.get(workspace.id) ?? undefined,
    sessions: stripSessions(workspace).map(info),
    // Eight levels, as deep as a worktree of a worktree ever reasonably goes.
    children: depth < 8 ? (children.get(workspace.id) ?? []).map((child) => workspaceInfo(child, children, depth + 1)) : [],
  });
  const projectInfo = (project: WorkspaceProject): Sdk.ProjectInfo => {
    const all = workspacesForProject(workspaces, project.id);
    const shown = all.filter((w) => !w.hidden);
    // Orca's parent nesting: a worktree whose parent is another linked worktree sits under it; children of the
    // primary checkout stay top level.
    const byId = new Map(shown.map((w) => [w.id, w]));
    const children = new Map<string, WorkspaceRecord[]>();
    const roots: WorkspaceRecord[] = [];
    for (const w of shown) {
      const parent = w.parentWorkspaceId ? byId.get(w.parentWorkspaceId) : undefined;
      if (parent?.parentWorkspaceId) children.set(parent.id, [...(children.get(parent.id) ?? []), w]);
      else roots.push(w);
    }
    const ordered = sortByAttention
      ? [...roots].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || urgency(sessionsForWorkspace(sessions, a)) - urgency(sessionsForWorkspace(sessions, b)))
      : roots;
    const own = all.flatMap(stripSessions);
    const local = project.hostId === "local";
    return {
      id: project.id, hostId: project.hostId, name: projectName(project), path: project.path, repoPath: project.repoPath || undefined,
      favorite: !!project.favorite, quickchat: isChatsProject(project),
      workspaces: ordered.map((w) => workspaceInfo(w, children, 0)),
      hidden: all.filter((w) => w.hidden).map((w) => workspaceInfo(w, new Map(), 0)),
      jobs: local
        ? jobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
          .map((job) => ({ id: job.jobId, branch: job.branch, path: job.path, status: job.status, phase: job.phase, error: job.error }))
        : [],
      sessions: own.map(info),
      hasChats: sessions.some((session) => session.projectId === project.id),
      top: reachable ? topSection(own, needIds, held) : null,
      instructions: local && instructionsAvailable(),
      memory: local && memoryAvailable(),
    };
  };

  // Favourites first, then the core's order; Quickchat is listed apart.
  const hostProjects = orderProjects(
    projects.filter((project) => project.hostId === hostId).sort((a, b) => (a.favorite !== b.favorite ? (a.favorite ? -1 : 1) : b.updatedAt - a.updatedAt)),
    order?.projects,
  );
  const chats = hostProjects.find(isChatsProject);
  const visible = hostProjects.filter((project) => !isChatsProject(project)).map((project) => ({ project, info: projectInfo(project) }));
  const quickchat = chats ? projectInfo(chats) : null;
  const shownProjects = visible
    .map((entry, at) => ({ ...entry, at, urgent: Math.min(STATUS_SECTIONS.length, ...workspacesForProject(workspaces, entry.project.id).map((w) => urgency(sessionsForWorkspace(sessions, w)))) }))
    .sort((a, b) => (sortByAttention ? Number(b.project.favorite) - Number(a.project.favorite) || a.urgent - b.urgent : 0) || a.at - b.at)
    .map((entry) => entry.info);

  // Every listed session of the host, newest first; the core's order does not apply to this list.
  const hostSessions = sessions.filter((session) => (session.hostId ?? "local") === hostId).sort((a, b) => b.createdAt - a.createdAt);
  // By status, newest first: the mirror of the strips' order (each workspace in its strip's order, then the core's
  // chat order), so a move mirrored back is a move in strip order. From reversed inputs, so chats the core has not
  // listed yet (new ones) sit on top.
  const statusChats = orderBy([...chatsInStripOrder(usePerchStore.getState(), hostSessions)].reverse(), order?.sessions && [...order.sessions].reverse(), (s) => s.id);
  const groups = groupByStatus(statusChats, needIds, held);
  const inOrder = [...visible.map((entry) => entry.info), ...(quickchat ? [quickchat] : [])];
  const known = new Set(inOrder.map((project) => project.id));
  /** `list` split by project, in the projects' order (Quickchat last); others under "Other". */
  const byProject = (list: SessionSummary[]) =>
    [...inOrder.map((project) => ({ id: project.id, name: project.name, project })), { id: "other", name: "Other", project: null }].flatMap((group) => {
      const rows = list.filter((session) => (session.projectId && known.has(session.projectId) ? session.projectId : "other") === group.id);
      return rows.length ? [{ ...group, sessions: rows.map(info) }] : [];
    });
  const status: Sdk.StatusGroup[] = reachable
    ? STATUS_SECTIONS.flatMap((key) => (groups[key].length ? [{ key, title: STATUS_LABELS[key], sessions: groups[key].map(info), projects: byProject(groups[key]) }] : []))
    // Not connected: what these chats were doing is unknown. Show them once, as last known, never as Working/Idle/Done.
    : hostSessions.length
      ? [{
        key: "offline", title: "Offline: last known",
        note: hostId === "local" ? "Reconnecting…" : `${hosts.find((h) => h.id === hostId)?.name ?? hostId}: ${hostStates[hostId]?.state ?? "connecting"}`,
        sessions: statusChats.map(info), projects: byProject(statusChats),
      }]
      : [];

  return {
    hostId, reachable,
    loading: snapshot?.state === "loading",
    error: snapshot?.state === "error" ? snapshot.error || "Workspace could not be loaded." : undefined,
    reorderable: canReorder && !sortByAttention,
    projects: shownProjects, quickchat,
    sessions: hostSessions.map(info),
    status,
    needsYou: reachable ? groups.needs.length : 0,
    activeWorkspaceId, activeSessionId: sessionId,
    shortcuts: hints.some(Boolean),
  };
}

export function nestSessions(list: Sdk.SessionInfo[]): { session: Sdk.SessionInfo; nested: boolean }[] {
  const items = list.map((session) => ({ id: session.id, parentSessionId: session.parentId, session }));
  return nestUnderLeads(items).map((item) => ({ session: item.session, nested: isNestedIn(item, items) }));
}

export function useSessionFolders(): { hostId: string; folders: Sdk.SessionFolder[] } {
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const hostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const git = usePerchStore((s) => s.workspaceGit);
  const registered = usePerchStore((s) => s.workspaceProjects);
  const remembered = usePerchStore((s) => s.cliAgentBySession);
  const review = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId])?.includes("git.status") === true);
  const needIds = new Set(needsYou(useAttention((s) => s.events)).map((event) => event.sessionId));
  const nav = { sessions, sessionId, activeHostId: hostId, activeProject };
  const active = effectiveActiveProject(nav);
  const info = (session: SessionSummary): Sdk.SessionInfo => {
    const section = sectionOf(session, needIds, null);
    return {
      id: session.id, title: session.title ?? "", hostId: session.hostId ?? "local", cwd: session.cwd, createdAt: session.createdAt, status: session.status,
      branch: session.currentBranch, projectId: session.projectId, workspaceId: session.workspaceId, parentId: session.parentSessionId,
      provider: session.currentProviderId ?? remembered[session.id] ?? session.cliProviderId, state: sessionDotState(session), section,
      blocked: !!session.blocked, unseen: !!session.unseen, active: session.id === sessionId,
    };
  };
  return {
    hostId,
    folders: projectsForHost(nav, hostId).map((group) => {
      const status = git[group.key];
      return {
        key: group.key, cwd: group.cwd, active: active?.cwd === group.cwd, state: aggregateDotState(group.sessions),
        sessions: group.sessions.map(info),
        git: status?.branch ? { branch: status.branch, ahead: status.ahead, behind: status.behind } : undefined,
        registered: registered.some((project) => project.hostId === hostId && project.repoPath === group.cwd),
        reviewWorkspaceId: review ? group.sessions.find((session) => session.workspaceId)?.workspaceId : undefined,
      };
    }),
  };
}

export function useAddProject(): Sdk.AddProject {
  const request = usePerchStore((s) => s.workspaceProjectCreate);
  return {
    status: request?.status ?? "idle",
    error: request?.status === "error" ? request.error || "Could not register this folder." : undefined,
    hostId: request?.hostId,
    add: (path, name, hostId) => {
      const state = usePerchStore.getState();
      if (!path.trim() || state.workspaceProjectCreate?.status === "pending") return;
      state.createWorkspaceProject(path, name, hostId ?? state.activeHostId);
    },
    clear: () => usePerchStore.getState().clearWorkspaceProjectCreate(),
  };
}

/** When Perch last asked for the Add project dialog, until a screen takes the request. A screen that mounts
 * shortly after (the sidebar shown by that same request) still gets it. */
let addProjectAskedAt = 0;
const ADD_PROJECT_LATE_MS = 3000;
window.addEventListener(ADD_PROJECT_EVENT, () => { addProjectAskedAt = Date.now(); }, true);

export function useAddProjectRequest(listener: () => void): void {
  useEffect(() => {
    const take = () => { addProjectAskedAt = 0; listener(); };
    if (addProjectAskedAt && Date.now() - addProjectAskedAt < ADD_PROJECT_LATE_MS) take();
    window.addEventListener(ADD_PROJECT_EVENT, take);
    return () => window.removeEventListener(ADD_PROJECT_EVENT, take);
  }, [listener]);
}

const tauriInvoke = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke;
/** The desktop app's folder dialog; a browser has none. */
export const pickFolder: typeof Sdk.pickFolder = tauriInvoke
  ? async (title) => {
    try {
      const picked = await tauriInvoke("plugin:dialog|open", { options: { directory: true, title } });
      return typeof picked === "string" ? picked : null;
    } catch {
      return null; // cancelled or unavailable: the folder browser still works
    }
  }
  : null;

