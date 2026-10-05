/**
 * Mirrors this viewer's tabs to the core's canonical surfaces (capability
 * `surface.v1`, PER-13). The local stores (`fileTabs`, `splitSets`, the tab
 * order) stay the live source; this adds what the core can keep for them:
 *
 * - a file or review that opens/closes is a canonical resource; a file with an
 *   unsaved draft refuses its last close, and the tab comes back;
 * - the strip order, the split sets and the resource order are saved as this
 *   viewer's presentation of the workspace (`viewer.presentation.set`);
 * - a viewer with no local tabs for a workspace (cleared storage) gets them back.
 *
 * A viewer is one window: its id lives in `sessionStorage`, so a reload keeps it and a
 * second window of the same browser gets its own presentation rows. (A new window, or a
 * restarted app, starts a fresh viewer; the local tab state still carries over.)
 *
 * Local workspaces only (the core refuses a remote workspace's resources), and
 * an older core without the capability is left exactly as before.
 */
import type { ClientMessage, ServerMessage, SurfaceDescriptor, ViewerPresentation } from "@perch/shared";
import { socket } from "./ws";
import { newId } from "./ids";
import { effectiveWorkspace, usePerchStore } from "./store";
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
}

function viewerId(): string {
  try {
    let id = sessionStorage.getItem("perch.viewerId");
    if (!id) sessionStorage.setItem("perch.viewerId", (id = newId()));
    return id;
  } catch {
    return (memoryViewerId ??= newId());
  }
}
let memoryViewerId: string | undefined;

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

/** `workspaceId`'s presentation, whether or not it is the workspace on screen. */
function buildLayout(workspaceId: string): { order: string[]; layout: Layout; active?: string } | null {
  const state = { ...usePerchStore.getState(), activeWorkspaceId: workspaceId };
  if (effectiveWorkspace(state)?.id !== workspaceId) return null;
  const entries = workspaceTabs(state, useFileTabs.getState().tabs);
  const ids = new Set(entries.map((entry) => entry.id));
  const selected = selectedKey(workspaceId);
  return {
    active: selected && ids.has(selected) ? resourceIds.get(selected) : undefined,
    order: entries.flatMap((entry) => (entry.kind === "resource" ? resourceIds.get(entry.id) ?? [] : [])),
    layout: {
      v: LAYOUT_VERSION,
      strip: entries.map((entry) => entry.id),
      sets: useSplitSets.getState().sets.filter((set) => set.ids.some((id) => ids.has(id))),
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
  if (!synced.has(workspaceId)) return;
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
if (typeof window !== "undefined") window.addEventListener(TAB_ORDER_EVENT, () => scheduleMirror());

/** A viewer with no local tabs for the workspace gets its saved ones back. */
async function hydrate(workspaceId: string, presentation: ViewerPresentation): Promise<void> {
  const layout = presentation.layout as Layout | undefined;
  if (!layout || layout.v !== LAYOUT_VERSION || presentation.order.length === 0) return;
  if (useFileTabs.getState().tabs.some((tab) => tab.workspaceId === workspaceId)) return;
  const listed = await ask((requestId) => ({ type: "surface.list", requestId, workspaceId }));
  if (listed.type !== "surface.list.result") return;
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
  if (tabs.length === 0) return;
  useFileTabs.setState((state) => ({ tabs: [...state.tabs, ...tabs] }));
  const key = tabOrderKey(usePerchStore.getState());
  if (key && layout.strip.length) saveTabOrder(key, layout.strip);
  const known = new Set(useSplitSets.getState().sets.flatMap((set) => set.ids));
  const restored = layout.sets.filter((set) => !set.ids.some((id) => known.has(id)));
  if (restored.length) useSplitSets.setState((state) => ({ sets: [...state.sets, ...restored] }));
}

/** Reselect the file or review this viewer had selected, unless it has already chosen this load. */
function restoreSelected(workspaceId: string, presentation: ViewerPresentation): void {
  if (!presentation.activeResourceId || selectedKey(workspaceId) !== undefined) return;
  const key = [...resourceIds].find(([, id]) => id === presentation.activeResourceId)?.[0];
  if (key && useFileTabs.getState().tabs.some((tab) => fileTabKey(tab) === key)) selectResource(workspaceId, key);
}

/** First time this workspace is shown (per connection): import legacy state, open what is already here, hydrate. */
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
  if (imported.type === "viewer.presentation") {
    await hydrate(workspaceId, imported.presentation);
    restoreSelected(workspaceId, imported.presentation);
  }
  scheduleMirror();
}

usePerchStore.subscribe((state, previous) => {
  if (state.activeWorkspaceId === previous.activeWorkspaceId && state.sessionId === previous.sessionId
    && state.serverInfo === previous.serverInfo && state.workspaces === previous.workspaces) return;
  const workspace = effectiveWorkspace(state);
  if (workspace) void sync(workspace.id);
});
