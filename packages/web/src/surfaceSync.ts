/**
 * Mirrors this viewer's tabs to the core's canonical surfaces (capability
 * `surface.v1`, PER-13). The local stores (`fileTabs`, `splitSets`, the tab
 * order) stay the live source; this adds what the core can keep for them:
 *
 * - a file or review that opens/closes is a canonical resource; a file with an
 *   unsaved draft refuses its last close, and the tab comes back;
 * - the strip order, the split sets and the resource order are saved as this
 *   viewer's presentation of the workspace (`viewer.presentation.set`);
 * - a viewer gets its saved tabs, order, splits and selection back (see below).
 *
 * A viewer is one window (`viewer.ts`), and its local tab state is keyed to it too. On the
 * first sync of a page load its saved presentation is restored over whatever the local
 * state holds, so a window that lost or never had local state still gets its tabs, order,
 * splits and selection back.
 *
 * Local workspaces only (the core refuses a remote workspace's resources), and
 * an older core without the capability is left exactly as before.
 */
import type { ClientMessage, ServerMessage, SurfaceDescriptor, ViewerPresentation } from "@perch/shared";
import { socket } from "./ws";
import { newId } from "./ids";
import { viewerId } from "./viewer";
import { activeWorkspaceSessions, effectiveWorkspace, usePerchStore } from "./store";
import { fileTabKey, selectedKey, selectResource, useFileTabs, type FileTab } from "./fileTabs";
import { useSplitSets, type SplitSet } from "./splitSets";
import { saveTabOrder, storedTabOrder, TAB_ORDER_EVENT } from "./tabOrder";
import { tabOrderKey, workspaceTabs } from "./workspaceTabs";
import { registerSurfaceRequest, retireSurfaceRequest } from "./requestOwnership";

const LAYOUT_VERSION = 1;
const MIRROR_DELAY_MS = 400;

/** The layout blob the core stores for us without reading it. */
interface Layout {
  v: number;
  /** The whole strip, sessions and resources, by entry id. */
  strip: string[];
  sets: SplitSet[];
  /** The session (terminal) this viewer had selected in the workspace. */
  session?: string;
}

const waiting = new Map<string, (msg: ServerMessage) => void>();

/** Send a request and resolve with its reply (or the correlated error). */
function ask(build: (requestId: string) => ClientMessage): Promise<ServerMessage> {
  const requestId = newId();
  registerSurfaceRequest(requestId);
  return new Promise((resolve) => {
    waiting.set(requestId, resolve);
    socket.send(build(requestId));
  });
}

socket.onMessage((msg) => {
  const requestId = (msg as { requestId?: string }).requestId;
  const resolve = requestId ? waiting.get(requestId) : undefined;
  if (!requestId || !resolve) return;
  waiting.delete(requestId);
  retireSurfaceRequest(requestId);
  resolve(msg);
});

socket.onConnectionChange((connected) => {
  if (connected) return;
  // A reply that never comes would hold its caller; a reconnect resyncs from scratch.
  for (const [requestId, resolve] of waiting) resolve({ type: "error", message: "disconnected", requestId } as ServerMessage);
  waiting.clear();
  synced.clear();
  resourceIds.clear();
  lastSent.clear(); // what was changed while offline never arrived
});

/** Entry key -> the core's resource id, for the files and reviews it has opened. */
const resourceIds = new Map<string, string>();
const synced = new Set<string>();

function supported(): boolean {
  return usePerchStore.getState().serverInfo?.capabilities?.includes("surface.v1") === true;
}

const isLocal = (workspaceId: string) =>
  usePerchStore.getState().workspaces?.find((workspace) => workspace.id === workspaceId)?.hostId === "local";

async function openTab(tab: FileTab): Promise<void> {
  if (!supported() || !isLocal(tab.workspaceId)) return;
  const review = tab.kind === "review";
  const reply = await ask((requestId) => ({
    type: "surface.open",
    requestId,
    viewerId: viewerId(),
    workspaceId: tab.workspaceId,
    kind: review ? "diff" : "file",
    locator: review ? { diff: { kind: "workingTree" } } : { path: tab.path },
  }));
  if (reply.type !== "surface.opened") return;
  resourceIds.set(fileTabKey(tab), reply.surface.id);
  scheduleMirror(tab.workspaceId);
}

async function closeTab(tab: FileTab): Promise<void> {
  const key = fileTabKey(tab);
  const resourceId = resourceIds.get(key);
  if (!resourceId) return;
  resourceIds.delete(key);
  const reply = await ask((requestId) => ({
    type: "surface.close",
    requestId,
    viewerId: viewerId(),
    workspaceId: tab.workspaceId,
    resourceId,
  }));
  // An unsaved draft keeps its tab: put it back (no activation) rather than hide the draft.
  if (reply.type === "error" && reply.code === "surface_dirty") {
    useFileTabs.setState((state) => ({ tabs: [...state.tabs, tab] }));
  }
}

/** Tabs opened or closed here are opened or closed in the core. */
useFileTabs.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  for (const tab of state.tabs) if (!previous.tabs.includes(tab)) void openTab(tab);
  for (const tab of previous.tabs) if (!state.tabs.includes(tab)) void closeTab(tab);
});

/** The session each workspace last showed in this window, for workspaces no longer on screen. */
const lastSession = new Map<string, string>();

function trackSession(state: ReturnType<typeof usePerchStore.getState>): void {
  const workspace = effectiveWorkspace(state);
  if (!workspace || !state.sessionId || lastSession.get(workspace.id) === state.sessionId) return;
  if (state.sessions.find((session) => session.id === state.sessionId)?.workspaceId !== workspace.id) return;
  lastSession.set(workspace.id, state.sessionId);
  scheduleMirror(workspace.id);
}

/** `workspaceId`'s presentation, whether or not it is the workspace on screen. */
function buildLayout(workspaceId: string): { order: string[]; layout: Layout; active?: string } | null {
  const state = { ...usePerchStore.getState(), activeWorkspaceId: workspaceId };
  if (effectiveWorkspace(state)?.id !== workspaceId) return null;
  const entries = workspaceTabs(state, useFileTabs.getState().tabs);
  const ids = new Set(entries.map((entry) => entry.id));
  const selected = selectedKey(workspaceId);
  const session = lastSession.get(workspaceId);
  return {
    active: selected && ids.has(selected) ? resourceIds.get(selected) : undefined,
    order: entries.flatMap((entry) => (entry.kind === "resource" ? resourceIds.get(entry.id) ?? [] : [])),
    layout: {
      v: LAYOUT_VERSION,
      strip: entries.map((entry) => entry.id),
      sets: useSplitSets.getState().sets.filter((set) => set.ids.some((id) => ids.has(id))),
      session: session && ids.has(session) ? session : undefined,
    },
  };
}

let mirrorTimer: ReturnType<typeof setTimeout> | undefined;
/** Workspaces changed since the last send: a switch inside the debounce must not drop the one left. */
const pending = new Set<string>();
const lastSent = new Map<string, string>();

function scheduleMirror(workspaceId = effectiveWorkspace(usePerchStore.getState())?.id): void {
  if (workspaceId) pending.add(workspaceId);
  clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    const due = [...pending];
    pending.clear();
    due.forEach(mirror);
  }, MIRROR_DELAY_MS);
}

function mirror(workspaceId: string): void {
  // Until the saved presentation is back, local state may be incomplete and must not replace it.
  if (!synced.has(workspaceId) || !restored.has(workspaceId)) return;
  const built = buildLayout(workspaceId);
  if (!built) return;
  const json = JSON.stringify(built);
  if (lastSent.get(workspaceId) === json) return;
  lastSent.set(workspaceId, json);
  void ask((requestId) => ({
    type: "viewer.presentation.set",
    requestId,
    viewerId: viewerId(),
    workspaceId,
    presentation: { order: built.order, activeResourceId: built.active, layout: built.layout },
  }));
}

useFileTabs.subscribe((state, previous) => {
  for (const tab of [...state.tabs, ...previous.tabs]) if (!(state.tabs.includes(tab) && previous.tabs.includes(tab))) scheduleMirror(tab.workspaceId);
  scheduleMirror();
});
useSplitSets.subscribe(() => scheduleMirror());
if (typeof window !== "undefined") {
  window.addEventListener(TAB_ORDER_EVENT, () => scheduleMirror());
  // Closing the window inside the delay still sends the last change.
  window.addEventListener("pagehide", () => {
    clearTimeout(mirrorTimer);
    [...pending].forEach(mirror);
    pending.clear();
  });
}

/** Workspaces whose saved presentation this page load has already restored (a reconnect must not undo newer local changes). */
const restored = new Set<string>();

/** Put the saved tabs, strip order and split sets back; what exists only locally is kept. */
/** False when it could not finish (a dropped connection), so a later sync tries again. */
async function hydrate(workspaceId: string, presentation: ViewerPresentation): Promise<boolean> {
  const layout = presentation.layout as Layout | undefined;
  if (!layout || layout.v !== LAYOUT_VERSION || presentation.order.length === 0) return true;
  const listed = await ask((requestId) => ({ type: "surface.list", requestId, workspaceId }));
  if (listed.type !== "surface.list.result") return false;
  const byId = new Map<string, SurfaceDescriptor>(listed.surfaces.map((surface) => [surface.id, surface]));
  const tabs: FileTab[] = presentation.order.flatMap((id): FileTab[] => {
    const surface = byId.get(id);
    const tab: FileTab | undefined = surface?.kind === "file" && surface.locator.path ? { workspaceId, path: surface.locator.path }
      : surface?.kind === "diff" ? { workspaceId, path: "", kind: "review" }
      : undefined;
    if (!tab) return [];
    resourceIds.set(fileTabKey(tab), id);
    return [tab];
  });
  const have = new Set(useFileTabs.getState().tabs.map(fileTabKey));
  const missing = tabs.filter((tab) => !have.has(fileTabKey(tab)));
  if (missing.length) useFileTabs.setState((state) => ({ tabs: [...state.tabs, ...missing] }));
  const key = tabOrderKey({ ...usePerchStore.getState(), activeWorkspaceId: workspaceId });
  if (key && layout.strip.length) saveTabOrder(key, layout.strip);
  const saved = new Set(layout.sets.flatMap((set) => set.ids));
  useSplitSets.setState((state) => ({
    sets: [...state.sets.filter((set) => !set.ids.some((id) => saved.has(id))), ...layout.sets],
  }));
  return true;
}

/** Show the session this viewer had selected, if it is still in the workspace on screen. */
function restoreSession(workspaceId: string, presentation: ViewerPresentation): void {
  const id = (presentation.layout as Layout | undefined)?.session;
  const state = usePerchStore.getState();
  if (!id || state.sessionId === id || effectiveWorkspace(state)?.id !== workspaceId) return;
  if (activeWorkspaceSessions(state).some((session) => session.id === id)) state.switchSession(id);
}

/** Reselect the file or review this viewer had selected, unless it has already chosen this load. */
function restoreSelected(workspaceId: string, presentation: ViewerPresentation): void {
  if (!presentation.activeResourceId || selectedKey(workspaceId) !== undefined) return;
  const key = [...resourceIds].find(([, id]) => id === presentation.activeResourceId)?.[0];
  if (key && useFileTabs.getState().tabs.some((tab) => fileTabKey(tab) === key)) selectResource(workspaceId, key);
}

/** First time this workspace is shown (per connection): import legacy state, open what is already here, restore. */
async function sync(workspaceId: string): Promise<void> {
  if (synced.has(workspaceId) || !supported() || !isLocal(workspaceId)) return;
  synced.add(workspaceId);
  const tabs = useFileTabs.getState().tabs.filter((tab) => tab.workspaceId === workspaceId);
  const key = tabOrderKey(usePerchStore.getState());
  const imported = await ask((requestId) => ({
    type: "surface.import",
    requestId,
    viewerId: viewerId(),
    workspaceId,
    files: tabs.filter((tab) => tab.kind !== "review").map((tab) => tab.path),
    sessionOrder: key ? storedTabOrder(key).filter((id) => !id.includes("\n")) : [],
  }));
  await Promise.all(tabs.map(openTab));
  if (imported.type === "viewer.presentation" && !restored.has(workspaceId)) {
    if (await hydrate(workspaceId, imported.presentation)) {
      restored.add(workspaceId);
      restoreSession(workspaceId, imported.presentation);
      restoreSelected(workspaceId, imported.presentation);
    }
  }
  scheduleMirror();
}

function syncShown(state = usePerchStore.getState()): void {
  const workspace = effectiveWorkspace(state);
  if (workspace) void sync(workspace.id);
}

usePerchStore.subscribe((state, previous) => {
  if (state.sessions !== previous.sessions || state.sessionId !== previous.sessionId) trackSession(state);
  if (state.activeWorkspaceId === previous.activeWorkspaceId && state.sessionId === previous.sessionId
    && state.serverInfo === previous.serverInfo && state.workspaces === previous.workspaces) return;
  syncShown(state);
});
trackSession(usePerchStore.getState());
syncShown(); // state that arrived before this module loaded changes nothing to subscribe to
