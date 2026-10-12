/** Pane actions for the layout actually on screen. Dockview owns session-internal
 * panes; a drag-created split tiles top-row tabs. Both use the same keymap. */
import { getDockviewController, type PaneDirection } from "./dockview/dockviewController";
import { activateTab, currentTabs, tabOrderKey } from "./workspaceTabs";
import { layout, MAX_SPLIT, MIN_PANE_PX, useSplitSets, visibleSplit, type SplitNode } from "./splitSets";
import { saveTabOrder } from "./tabOrder";
import { usePerchStore, effectiveWorkspace } from "./store";
import { useFileTabs } from "./fileTabs";
import { requestCloseSession } from "./closeGuard";

export function focusedSplit() {
  const { tabs, activeId } = currentTabs();
  const split = visibleSplit(useSplitSets.getState().sets, tabs.map((entry) => entry.id), activeId);
  return split && activeId ? { ...split, activeId, index: split.ids.indexOf(activeId) } : null;
}

export function closeTab(id: string): void {
  const entry = currentTabs().tabs.find((tab) => tab.id === id);
  if (entry?.kind === "session") requestCloseSession(id);
  else if (entry) useFileTabs.getState().close(id);
}

/** Unlike zoom/restore, leaving a tile is permanent; other tabs remain open. */
export function exitSplit(id: string): void {
  const entry = currentTabs().tabs.find((tab) => tab.id === id);
  useSplitSets.getState().unsplit(id);
  useSplitSets.getState().zoom(null);
  if (entry) activateTab(entry);
}

function select(id: string) {
  const entry = currentTabs().tabs.find((tab) => tab.id === id);
  if (!entry) return;
  useSplitSets.getState().zoom(null);
  activateTab(entry);
}

/** The pane next to the active one in `direction`, by the layout's geometry (nested splits included). */
function neighbor(direction: PaneDirection) {
  const split = focusedSplit();
  if (!split) return null;
  const { panes } = layout(split.tree, { x: 0, y: 0, w: 1, h: 1 });
  const a = panes.get(split.activeId);
  if (!a) return null;
  const horizontal = direction === "left" || direction === "right";
  let best: { id: string; gap: number; overlap: number } | null = null;
  for (const [id, r] of panes) {
    if (id === split.activeId) continue;
    const gap = direction === "right" ? r.x - (a.x + a.w) : direction === "left" ? a.x - (r.x + r.w) : direction === "down" ? r.y - (a.y + a.h) : a.y - (r.y + r.h);
    const overlap = horizontal ? Math.min(a.y + a.h, r.y + r.h) - Math.max(a.y, r.y) : Math.min(a.x + a.w, r.x + r.w) - Math.max(a.x, r.x);
    if (gap < -1e-6 || overlap <= 1e-6) continue;
    if (!best || gap < best.gap - 1e-6 || (Math.abs(gap - best.gap) <= 1e-6 && overlap > best.overlap)) best = { id, gap, overlap };
  }
  return best?.id ?? null;
}

function pathTo(node: SplitNode, id: string): number[] | null {
  if (typeof node === "string") return node === id ? [] : null;
  for (let i = 0; i < node.kids.length; i++) {
    const rest = pathTo(node.kids[i]!, id);
    if (rest) return [i, ...rest];
  }
  return null;
}

function cycle(delta: number) {
  const split = focusedSplit();
  if (split) select(split.ids[(split.index + delta + split.ids.length) % split.ids.length]!);
}

function swap(other: string | null) {
  const split = focusedSplit();
  const key = tabOrderKey(usePerchStore.getState());
  if (!split || !other) return;
  // A nested layout is its own order; a flat set follows the strip.
  if (split.nested) return useSplitSets.getState().swap(split.activeId, other);
  if (!key) return;
  const ids = currentTabs().tabs.map((tab) => tab.id);
  const a = ids.indexOf(split.activeId), b = ids.indexOf(other);
  if (a < 0 || b < 0) return;
  [ids[a], ids[b]] = [ids[b]!, ids[a]!];
  saveTabOrder(key, ids);
}

function resize(delta: number) {
  const split = focusedSplit();
  const rect = document.querySelector('[data-testid="split-canvas"]')?.getBoundingClientRect();
  const path = split && pathTo(split.tree, split.activeId);
  if (!split || !rect || !path) return;
  // The innermost row/column holding the active pane.
  const strip = layout(split.tree, { x: 0, y: 0, w: rect.width, h: rect.height }).strips.find((candidate) => candidate.path.join() === path.slice(0, -1).join());
  if (!strip) return;
  const extent = strip.dir === "col" ? strip.rect.h : strip.rect.w;
  if (extent <= 0) return;
  const at = path[path.length - 1]!;
  const other = at < strip.sizes.length - 1 ? at + 1 : at - 1;
  const sizes = strip.sizes.slice();
  const min = MIN_PANE_PX / extent;
  const change = Math.max(min - sizes[at]!, Math.min(delta / extent, sizes[other]! - min));
  sizes[at]! += change;
  sizes[other]! -= change;
  useSplitSets.getState().resize(split.ids, sizes, strip.path);
}

let pendingSplit = false;
/** A split shortcut in a tiled canvas creates a normal Terminal tab, not a
 * hidden Dockview shell. Match the new session to the captured nest/host. */
function addTerminal(direction: "right" | "below") {
  const split = focusedSplit();
  const state = usePerchStore.getState();
  const workspace = effectiveWorkspace(state);
  if (!split || !workspace || pendingSplit || split.ids.length >= MAX_SPLIT) return;
  const known = new Set(state.sessions.map((session) => session.id));
  pendingSplit = true;
  const cleanup = () => { stop(); clearTimeout(timer); pendingSplit = false; };
  let started: string | null = null;
  const stop = usePerchStore.subscribe((next) => {
    // `session.created` of an earlier switch's resume can consume the store's
    // one-shot "start the CLI" flag, so start this terminal explicitly. The
    // server lists a session only once its terminal runs; tile it then.
    if (!started && next.sessionId && !known.has(next.sessionId)) {
      started = next.sessionId;
      next.startCli(started, "terminal");
    }
    const created = next.sessions.find((session) => session.id === next.sessionId && !known.has(session.id) && session.workspaceId === workspace.id && (session.hostId ?? "local") === workspace.hostId);
    if (!created) return;
    cleanup();
    const zone = direction === "right" ? "right" : "down";
    // Across the set's direction this nests: the active pane becomes a row/column of the two.
    useSplitSets.getState().drop(created.id, split.activeId, zone);
    useSplitSets.getState().zoom(null);
  });
  const timer = setTimeout(cleanup, 20_000);
  state.createSessionOnHost(workspace.hostId, workspace.path, "terminal");
}

/** Keybindings resolve this at invocation time, so user overrides and leader
 * chords share the same routing, with no hardcoded extra shortcuts. */
export function getPaneController() {
  const dock = getDockviewController();
  if (!dock || !focusedSplit()) return dock;
  return {
    ...dock,
    addTerminalPanel: addTerminal,
    closeActiveTerminalPanel: () => { const split = focusedSplit(); if (!split) return false; closeTab(split.activeId); return true; },
    toggleMaximizeActive: () => {
      const split = focusedSplit();
      if (split) useSplitSets.getState().zoom(useSplitSets.getState().zoomedId === split.activeId ? null : split.activeId);
    },
    focusPaneDirection: (direction: PaneDirection) => { const id = neighbor(direction); if (id) select(id); },
    cycleToNextPane: () => cycle(1),
    cycleToPreviousPane: () => cycle(-1),
    swapActivePaneWithNext: () => { const split = focusedSplit(); if (split) swap(split.ids[(split.index + 1) % split.ids.length]!); },
    swapPaneDirection: (direction: PaneDirection) => swap(neighbor(direction)),
    growActivePane: () => resize(60),
    shrinkActivePane: () => resize(-60),
  };
}
