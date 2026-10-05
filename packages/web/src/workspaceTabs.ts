import type { SessionSummary } from "@perch/shared";
import { activeWorkspaceSessions, effectiveActiveProject, effectiveWorkspace, usePerchStore, type ProjectNavState } from "./store";
import { fileTabKey, useFileTabs, type FileTab } from "./fileTabs";
import { applyStoredTabOrder } from "./tabOrder";
import { useSplitSets } from "./splitSets";

/** One entry of the strip: a session (a terminal or agent) or an open resource.
 * `id` is the session id or `fileTabKey`, so one stored order covers both. */
export type TabEntry =
  | { id: string; kind: "session"; session: SessionSummary }
  | { id: string; kind: "resource"; tab: FileTab };

/** Where the strip's drag order is stored: the workspace on screen, else its project. */
export function tabOrderKey(nav: ProjectNavState): string | null {
  const ws = effectiveWorkspace(nav);
  if (ws) return `${ws.hostId}:ws:${ws.id}`;
  const project = effectiveActiveProject(nav);
  return project ? `${project.hostId}:${project.cwd}` : null;
}

/** The strip's tabs in order: sessions by creation, then resources by opening,
 * then any drag order on top. TabBar, the Nth-tab chord and next/previous all
 * read this, so they cannot disagree. */
export function workspaceTabs(nav: ProjectNavState, resources: FileTab[]): TabEntry[] {
  const ws = effectiveWorkspace(nav);
  const entries: TabEntry[] = [
    ...activeWorkspaceSessions(nav).map((session): TabEntry => ({ id: session.id, kind: "session", session })),
    ...(ws ? resources.filter((tab) => tab.workspaceId === ws.id) : [])
      .map((tab): TabEntry => ({ id: fileTabKey(tab), kind: "resource", tab })),
  ];
  const key = tabOrderKey(nav);
  return key ? applyStoredTabOrder(key, entries) : entries;
}

/** The entry on screen: the open file if one covers the session, else the session. */
export function activeTabId(sessionId: string | null, activeFile: string | null): string | null {
  return activeFile ?? sessionId;
}

const MAX_TAB_LABEL = 24;

/** Short pill label for a session. Falls back to "New session" for a session
 * with no user messages yet (title is "" until the first chat.send). */
export function sessionLabel(session: SessionSummary): string {
  const title = session.title.trim();
  if (!title) return "New session";
  return title.length > MAX_TAB_LABEL ? `${title.slice(0, MAX_TAB_LABEL - 1)}…` : title;
}

export function entryLabel(entry: TabEntry): string {
  if (entry.kind === "session") return sessionLabel(entry.session);
  return entry.tab.kind === "review" ? "Changes" : entry.tab.path.split("/").pop() || entry.tab.path;
}

export function activateTab(entry: TabEntry): void {
  const files = useFileTabs.getState();
  if (entry.kind === "resource") {
    // A split set shows its terminal beside the file: bring that session up first.
    const set = useSplitSets.getState().sets.find((candidate) => candidate.ids.includes(entry.id));
    const state = usePerchStore.getState();
    const partner = set?.ids.find((id) => id !== entry.id && state.sessions.some((session) => session.id === id));
    if (partner && partner !== state.sessionId) state.switchSession(partner);
    files.open(entry.tab.workspaceId, entry.tab.path, entry.tab.kind);
    return;
  }
  files.showSession();
  usePerchStore.getState().switchSession(entry.session.id);
}

/** Current strip, read outside React (chords). */
export function currentTabs(): { tabs: TabEntry[]; activeId: string | null } {
  const state = usePerchStore.getState();
  const files = useFileTabs.getState();
  return { tabs: workspaceTabs(state, files.tabs), activeId: activeTabId(state.sessionId, files.active) };
}
