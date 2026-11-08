import type { SessionSummary } from "@perch/shared";
import { activeWorkspaceSessions, effectiveActiveProject, effectiveWorkspace, usePerchStore, type ProjectNavState } from "./store";
import { fileTabKey, isBlankBrowser, useFileTabs, type FileTab } from "./fileTabs";
import { applyStoredTabOrder, moveBeside, saveTabOrder, storedTabOrder } from "./tabOrder";
import { applySessionOrder, refillSlots, writeScope } from "./sidebarOrder";
import { useSplitSets } from "./splitSets";
import { parseUrl } from "./links";
import { useBrowserPages } from "./browserPages";
import { scopeSessionId } from "./terminalScope";

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
    // A scoped tab (a terminal's file) shows only while that terminal is on screen.
    ...(ws ? resources.filter((tab) => tab.workspaceId === ws.id && (!tab.scope || scopeSessionId(tab.scope) === nav.sessionId)) : [])
      .map((tab): TabEntry => ({ id: fileTabKey(tab), kind: "resource", tab })),
  ];
  const key = tabOrderKey(nav);
  const stored = key ? applyStoredTabOrder(key, entries) : entries;
  // Chats follow the core's order, so the strip, the sidebar and the phone agree.
  // File tabs keep this viewer's slots.
  const hostId = ws?.hostId ?? nav.activeHostId;
  return applySessionOrder(stored, (entry) => entry.kind === "session", nav.workspaceOrderByHost?.[hostId]?.sessions);
}

type NavState = ReturnType<typeof usePerchStore.getState>;

/** The workspace whose strip shows `session`. */
function workspaceOf(state: NavState, session: SessionSummary) {
  return state.workspaces?.find((workspace) => (session.workspaceId ? workspace.id === session.workspaceId : (session.hostId ?? "local") === workspace.hostId && session.cwd === workspace.path));
}

/** The chat ids of `workspace` in its strip order (this viewer's drag order and the core's order included). */
function chatStrip(state: NavState, workspace: NonNullable<ReturnType<typeof workspaceOf>>): string[] {
  return workspaceTabs({ ...state, activeWorkspaceId: workspace.id }, []).flatMap((entry) => (entry.kind === "session" ? [entry.id] : []));
}

/** `sessions` oldest first, each workspace's chats in the order its strip shows them:
 * the sidebar's default order, so a first move there changes nothing else in the strips. */
export function chatsInStripOrder(state: NavState, sessions: SessionSummary[]): SessionSummary[] {
  let out = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
  for (const workspace of state.workspaces ?? []) {
    const mine = out.filter((session) => workspaceOf(state, session)?.id === workspace.id);
    const shown = new Map(mine.map((session) => [session.id, session]));
    const strip = chatStrip(state, workspace).flatMap((id) => shown.get(id) ?? []);
    if (strip.length === mine.length) out = refillSlots(out, (session) => shown.has(session.id), strip);
  }
  return out;
}

/** Write `scope` (chats of the workspaces a move touched, in their new order) into
 * the core's chat order. Chats of other workspaces keep their place there. */
function writeChats(state: NavState, hostId: string, scope: string[]): void {
  const live = new Set(state.sessions.filter((session) => (session.hostId ?? "local") === hostId).map((session) => session.id));
  state.setWorkspaceOrder(hostId, { sessions: writeScope(state.workspaceOrderByHost[hostId]?.sessions, scope, live) });
}

/** Save the strip's new order. When it changes the chats' relative order that
 * is the core's chat order too, so every viewer follows. Only this strip's chats
 * are written, so other workspaces' strips do not change. */
export function saveTabStrip(key: string, ids: string[]): void {
  const state = usePerchStore.getState();
  const files = useFileTabs.getState();
  const sessionIds = new Set(state.sessions.map((session) => session.id));
  const before = workspaceTabs(state, files.tabs).filter((tab) => tab.kind === "session").map((tab) => tab.id);
  saveTabOrder(key, ids);
  const after = ids.filter((id) => sessionIds.has(id));
  if (before.join() === after.join()) return;
  writeChats(state, effectiveWorkspace(state)?.hostId ?? state.activeHostId, after);
}

/** A sidebar move: put chat `moved` beside `target`, as the sidebar shows them in
 * `shown`. The base order is each workspace's own strip order (this viewer's drag
 * order included), so only the moved chat changes place in its strip, and only the
 * workspaces of `moved` and `target` are written. */
export function moveChat(moved: string, target: string, after: boolean, shown: string[]): void {
  const state = usePerchStore.getState();
  const [from, to] = [moved, target].map((id) => state.sessions.find((session) => session.id === id));
  if (!from || !to) return;
  const strips = [...new Set([workspaceOf(state, from), workspaceOf(state, to)])].flatMap((workspace) => (workspace ? [chatStrip(state, workspace)] : []));
  const scope = new Set([moved, target, ...strips.flat()]);
  let base = [...shown.filter((id) => scope.has(id)), ...[...scope].filter((id) => !shown.includes(id))];
  for (const strip of strips) base = refillSlots(base, (id) => strip.includes(id), strip);
  writeChats(state, from.hostId ?? "local", moveBeside(base, moved, target, after));
}

/** A single click on a file in the explorer: show it in the workspace's preview tab, replacing
 * the previous preview in place (strip slot and drag order included), VS Code style. A preview
 * tab that was edited is already a regular tab, and one in a split set is kept. */
export function openFilePreview(workspaceId: string, path: string, scope?: string): void {
  const files = useFileTabs.getState();
  // Settings > "Preview files in tabs" off: every click is a regular tab.
  if (usePerchStore.getState().settings?.previewTabs === false) return files.open(workspaceId, path, undefined, scope);
  const sets = useSplitSets.getState().sets;
  const old = files.tabs.find((tab) => tab.workspaceId === workspaceId && tab.scope === scope && tab.preview && !tab.kind
    && !sets.some((set) => set.ids.includes(fileTabKey(tab))));
  const oldKey = old ? fileTabKey(old) : undefined;
  const newKey = fileTabKey({ workspaceId, path, scope });
  files.openPreview(workspaceId, path, oldKey, scope);
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

/** A resource tab's name: a file's basename, "Changes", or a page's title (else its host). */
export function tabName(tab: FileTab): string {
  if (tab.kind === "review") return "Changes";
  if (tab.kind === "mod") return tab.mod ?? tab.path;
  if (tab.kind === "browser") {
    const page = useBrowserPages.getState().pages[fileTabKey(tab)];
    const url = page?.url || (isBlankBrowser(tab) ? "" : tab.path);
    return page?.title.trim() || (url ? parseUrl(url)?.host || url : "New browser");
  }
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
    files.open(entry.tab.workspaceId, entry.tab.path, entry.tab.kind, entry.tab.scope);
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
