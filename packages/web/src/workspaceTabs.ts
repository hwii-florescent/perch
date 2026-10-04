import type { SessionSummary } from "@perch/shared";
import { activeWorkspaceSessions, effectiveActiveProject, effectiveWorkspace, usePerchStore, type ProjectNavState } from "./store";
import { fileTabKey, useFileTabs, type FileTab } from "./fileTabs";
import { applyStoredTabOrder } from "./tabOrder";

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

export function activateTab(entry: TabEntry): void {
  const files = useFileTabs.getState();
  if (entry.kind === "resource") {
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
