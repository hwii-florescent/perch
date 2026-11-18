/**
 * A workspace's open tabs, shared by every device through the core (capability
 * `workspace.tabs.v1`, `crates/perch-core/src/shared_tabs.rs`): the strip's tab ids in order and
 * its split sets. A tab opened, moved or closed here shows on the desktop, the phone and the
 * native app; which tab each one shows stays its own (`surfaceSync.ts` keeps that per viewer).
 *
 * Shared ids are a session id or a `fileTabKey` of the workspace itself (file, review, browser).
 * A mod tab and a terminal-scoped tab stay on this device, in their places.
 *
 * Each workspace keeps the last core state applied here (`base`). A newer one (a broadcast, or
 * the core refusing a write made against an older revision) is merged with this device's changes
 * since `base` ({@link mergeTabs}), and what differs from the core is written back. Before the
 * first state of a connection `base` is this device's own projection, so the core's tabs win.
 * Remote-host workspaces are not shared yet.
 */
import type { ServerMessage } from "@perch/shared";
import { socket } from "./ws";
import { newId } from "./ids";
import { effectiveWorkspace, usePerchStore } from "./store";
import { fileTabKey, useFileTabs, type FileTab } from "./fileTabs";
import { useSplitSets, type SplitSet } from "./splitSets";
import { saveTabOrder, storedTabOrder, TAB_ORDER_EVENT } from "./tabOrder";
import { tabOrderKey, workspaceTabs } from "./workspaceTabs";

const MIRROR_DELAY_MS = 400;

export interface TabState {
  strip: string[];
  sets: SplitSet[];
}

/** Whether tab `id` of workspace `workspaceId` can be shown on another device (the core's rule). */
export function shareable(workspaceId: string, id: string): boolean {
  const at = id.indexOf("\n");
  if (at < 0) return id.length > 0;
  return id.slice(0, at) === workspaceId && !id.slice(at + 1).startsWith("\0mod\n");
}

/** The tab a shared id opens, if this device can open it. */
export function tabOf(workspaceId: string, id: string): FileTab | undefined {
  const at = id.indexOf("\n");
  if (at < 0 || id.slice(0, at) !== workspaceId) return undefined;
  const rest = id.slice(at + 1);
  if (rest === "\0review") return { workspaceId, path: "", kind: "review" };
  if (rest.startsWith("\0browser\n")) return { workspaceId, path: rest.slice("\0browser\n".length), kind: "browser" };
  return rest.startsWith("\0") ? undefined : { workspaceId, path: rest };
}

const json = (value: unknown) => JSON.stringify(value);

const isSession = (id: string) => !id.includes("\n");

/** `next` with `id` inserted after the tab it follows in `from` (else first). */
function insertAfter(next: string[], from: string[], id: string): void {
  const at = from.indexOf(id);
  const before = from.slice(0, at).reverse().find((other) => next.includes(other));
  next.splice(before === undefined ? 0 : next.indexOf(before) + 1, 0, id);
}

/** `state` as the core keeps it: shared ids only, sets made only of them. */
export function project(state: TabState, shared: (id: string) => boolean): TabState {
  const strip = state.strip.filter(shared);
  return { strip, sets: state.sets.filter((set) => set.ids.every((id) => strip.includes(id))) };
}

/** What this device writes: its shared tabs, and the sessions of `base` it does not show where
 * they were. A session's tab comes and goes with the session (the core drops an ended one),
 * never with a device's view of it. */
export function outgoing(local: TabState, base: TabState, shared: (id: string) => boolean): TabState {
  const mine = project(local, shared);
  for (const id of base.strip) if (isSession(id) && !mine.strip.includes(id)) insertAfter(mine.strip, base.strip, id);
  return mine;
}

/**
 * Three-way merge of this device's tabs (`local`) and the core's (`remote`), both changed since
 * `base`. Removals on either side stay removed; additions on either side are kept, after the tab
 * they followed. Order is the core's unless this device reordered what it shares with `base`.
 * Sets are this device's if it changed its shared ones, else the core's (plus this device's own
 * sets of unshared tabs); a set whose members are not all open goes.
 */
export function mergeTabs(base: TabState, local: TabState, remote: TabState, shared: (id: string) => boolean): TabState {
  const inBase = new Set(base.strip);
  // A session missing here is one this device does not show, not one closed (see `outgoing`).
  const localRemoved = new Set(base.strip.filter((id) => !isSession(id) && !local.strip.includes(id)));
  const remoteRemoved = new Set(base.strip.filter((id) => !remote.strip.includes(id)));
  const keep = (id: string) => !localRemoved.has(id) && !remoteRemoved.has(id);
  const reordered = json(local.strip.filter((id) => inBase.has(id))) !== json(base.strip.filter((id) => local.strip.includes(id)));
  const [primary, secondary] = reordered ? [local.strip, remote.strip] : [remote.strip, local.strip];
  const strip = primary.filter(keep);
  for (const id of secondary) if (!inBase.has(id) && !strip.includes(id) && keep(id)) insertAfter(strip, secondary, id);
  const ownSets = project(local, shared).sets;
  const changed = json(ownSets) !== json(base.sets);
  const candidates = changed ? local.sets : [...remote.sets, ...local.sets.filter((set) => !ownSets.includes(set))];
  const placed = new Set<string>();
  const sets = candidates.filter((set) => {
    const fits = set.ids.length >= 2 && set.ids.every((id) => strip.includes(id) && !placed.has(id));
    if (fits) set.ids.forEach((id) => placed.add(id));
    return fits;
  });
  return { strip, sets };
}

type Nav = ReturnType<typeof usePerchStore.getState>;

function supported(state: Nav, workspaceId: string): boolean {
  const host = state.workspaces.find((workspace) => workspace.id === workspaceId)?.hostId;
  return host === "local" && socket.connected && state.serverInfo?.capabilities?.includes("workspace.tabs.v1") === true;
}

/** Whether `workspaceId`'s tabs come from the core (then a per-viewer presentation restores only the selection). */
export const sharesTabs = (workspaceId: string): boolean => supported(usePerchStore.getState(), workspaceId);

/** This device's strip and sets of `workspaceId`; null when the workspace is unknown here. */
function localTabs(state: Nav, workspaceId: string): (TabState & { key: string }) | null {
  const nav = { ...state, activeWorkspaceId: workspaceId };
  const key = tabOrderKey(nav);
  if (!key || effectiveWorkspace(nav)?.id !== workspaceId) return null;
  const strip = workspaceTabs(nav, useFileTabs.getState().tabs).map((entry) => entry.id);
  const sets = useSplitSets.getState().sets.filter((set) => set.ids.some((id) => strip.includes(id)));
  return { key, strip, sets };
}

/** Make this device show `next` for `workspaceId`: open and close its tabs, order the strip, replace its sets. */
export function applyTabs(workspaceId: string, next: TabState): void {
  const state = usePerchStore.getState();
  const local = localTabs(state, workspaceId);
  if (!local) return;
  const files = useFileTabs.getState();
  const open = new Set(files.tabs.map(fileTabKey));
  const missing = next.strip.flatMap((id) => (open.has(id) ? [] : tabOf(workspaceId, id) ?? []));
  if (missing.length) useFileTabs.setState((current) => ({ tabs: [...current.tabs, ...missing] }));
  const wanted = new Set(next.strip);
  for (const tab of files.tabs) {
    const key = fileTabKey(tab);
    if (tab.workspaceId === workspaceId && !tab.scope && shareable(workspaceId, key) && !wanted.has(key)) useFileTabs.getState().close(key);
  }
  // A tab out of sight now (a terminal's file while another terminal is shown) keeps its stored place.
  const hidden = storedTabOrder(local.key).filter((id) => !wanted.has(id) && !shareable(workspaceId, id));
  saveTabOrder(local.key, [...next.strip, ...hidden]);
  const mine = new Set([...local.strip, ...next.strip]);
  useSplitSets.setState((current) => ({
    sets: [...current.sets.filter((set) => !set.ids.some((id) => mine.has(id))), ...next.sets],
  }));
}

/** The core's latest state per workspace, and the one this device last merged (`base`). */
const latest = new Map<string, TabState & { revision: number }>();
const bases = new Map<string, TabState & { revision: number }>();
/** What was last written per workspace, so a repeat is not sent while its answer is on the way. */
const sent = new Map<string, string>();
let applying = false;

function reconcile(workspaceId: string): void {
  const remote = latest.get(workspaceId);
  const state = usePerchStore.getState();
  if (!remote || bases.get(workspaceId)?.revision === remote.revision || !supported(state, workspaceId)) return;
  const local = localTabs(state, workspaceId);
  if (!local) return; // the workspace is not listed yet: tried again when it is
  const shared = (id: string) => shareable(workspaceId, id);
  const base = bases.get(workspaceId) ?? project(local, shared);
  applying = true;
  try {
    applyTabs(workspaceId, mergeTabs(base, local, remote, shared));
  } finally {
    applying = false;
  }
  bases.set(workspaceId, remote);
  scheduleMirror(workspaceId);
}

function mirror(workspaceId: string): void {
  const state = usePerchStore.getState();
  if (!supported(state, workspaceId)) return;
  const local = localTabs(state, workspaceId);
  if (!local) return;
  const base = bases.get(workspaceId);
  if (!base && latest.has(workspaceId)) return reconcile(workspaceId);
  const shared = (id: string) => shareable(workspaceId, id);
  const mine = base ? outgoing(local, base, shared) : project(local, shared);
  if (base && json(mine) === json({ strip: base.strip, sets: base.sets })) return;
  const baseRevision = base?.revision ?? 0;
  const body = json({ baseRevision, ...mine });
  if (sent.get(workspaceId) === body) return;
  sent.set(workspaceId, body);
  socket.send({ type: "workspace.tabs.set", requestId: newId(), workspaceId, baseRevision, strip: mine.strip, sets: mine.sets });
}

let timer: ReturnType<typeof setTimeout> | undefined;
const due = new Set<string>();

function scheduleMirror(workspaceId?: string): void {
  if (applying) return;
  const ids = workspaceId ? [workspaceId] : [effectiveWorkspace(usePerchStore.getState())?.id ?? ""];
  ids.filter(Boolean).forEach((id) => due.add(id));
  clearTimeout(timer);
  timer = setTimeout(() => {
    const ids = [...due];
    due.clear();
    ids.forEach(mirror);
  }, MIRROR_DELAY_MS);
}

socket.onMessage((message: ServerMessage) => {
  if (message.type !== "workspace.tabs") return;
  latest.set(message.workspaceId, { revision: message.revision, strip: message.strip, sets: message.sets as SplitSet[] });
  sent.delete(message.workspaceId);
  reconcile(message.workspaceId);
});

socket.onConnectionChange((connected) => {
  if (connected) return;
  // The core may change while this device is away: its next state wins over what this device had.
  latest.clear();
  bases.clear();
  sent.clear();
});

useFileTabs.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return;
  for (const tab of [...state.tabs, ...previous.tabs]) if (!(state.tabs.includes(tab) && previous.tabs.includes(tab))) scheduleMirror(tab.workspaceId);
});
useSplitSets.subscribe(() => scheduleMirror());
usePerchStore.subscribe((state, previous) => {
  if (state.workspaces !== previous.workspaces || state.serverInfo !== previous.serverInfo) latest.forEach((_, id) => reconcile(id));
  if (state.sessions !== previous.sessions || state.workspaceOrderByHost !== previous.workspaceOrderByHost) scheduleMirror();
});
if (typeof window !== "undefined") {
  window.addEventListener(TAB_ORDER_EVENT, () => scheduleMirror());
  window.addEventListener("pagehide", () => {
    clearTimeout(timer);
    [...due].forEach(mirror);
    due.clear();
  });
}
