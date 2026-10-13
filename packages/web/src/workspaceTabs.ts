import type { SessionSummary } from "@perch/shared";
import { activeWorkspaceSessions, effectiveActiveProject, effectiveWorkspace, usePerchStore, type ProjectNavState } from "./store";
import { fileTabKey, isBlankBrowser, useFileTabs, type FileTab } from "./fileTabs";
import { applyStoredTabOrder, saveTabOrder, storedTabOrder } from "./tabOrder";
import { useSplitSets } from "./splitSets";
import { parseUrl } from "./links";

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

/** A single click on a file in the explorer: show it in the workspace's preview tab, replacing
 * the previous preview in place (strip slot and drag order included), VS Code style. A preview
 * tab that was edited is already a regular tab, and one in a split set is kept. */
export function openFilePreview(workspaceId: string, path: string): void {
  const files = useFileTabs.getState();
  // Settings > "Preview files in tabs" off: every click is a regular tab.
  if (usePerchStore.getState().settings?.previewTabs === false) return files.open(workspaceId, path);
  const sets = useSplitSets.getState().sets;
  const old = files.tabs.find((tab) => tab.workspaceId === workspaceId && tab.preview && !tab.kind
    && !sets.some((set) => set.ids.includes(fileTabKey(tab))));
  const oldKey = old ? fileTabKey(old) : undefined;
  const newKey = fileTabKey({ workspaceId, path });
  files.openPreview(workspaceId, path, oldKey);
  if (!oldKey || oldKey === newKey || !useFileTabs.getState().tabs.some((tab) => fileTabKey(tab) === newKey)) return;
  const orderKey = tabOrderKey(usePerchStore.getState());
  const order = orderKey ? storedTabOrder(orderKey) : [];
  if (orderKey && order.includes(oldKey)) saveTabOrder(orderKey, order.map((id) => (id === oldKey ? newKey : id)));
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

/** A resource tab's name: a file's basename, "Changes", or a page's host. */
export function tabName(tab: FileTab): string {
  if (tab.kind === "review") return "Changes";
  if (tab.kind === "browser") return isBlankBrowser(tab) ? "New browser" : parseUrl(tab.path)?.host ?? tab.path;
  return tab.path.split("/").pop() || tab.path;
}

export function entryLabel(entry: TabEntry): string {
  if (entry.kind === "session") return sessionLabel(entry.session);
  return tabName(entry.tab);
}

export function activateTab(entry: TabEntry): void {
  const files = useFileTabs.getState();
  if (entry.kind === "resource") {
    // A split set shows its terminal beside the file: bring that session up first.
    const set = useSplitSets.getState().sets.find((candidate) => candidate.ids.includes(entry.id));
    const state = usePerchStore.getState();
    // (Not when the current session is already one of the set's.)
    const partner = set?.ids.includes(state.sessionId ?? "") ? undefined : set?.ids.find((id) => id !== entry.id && state.sessions.some((session) => session.id === id));
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
