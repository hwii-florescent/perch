import type { PointerEvent as ReactPointerEvent } from "react";
import { create } from "zustand";
import { usePerchStore } from "./store";
import { moveBeside, moveTab } from "./tabOrder";
import { planDrop, useSplitSets, type DropZone } from "./splitSets";
import { activateTab, currentTabs, saveTabStrip, tabOrderKey } from "./workspaceTabs";
import { acquirePassthrough } from "./browserNative";
import { beginSlideDrag, type Slide } from "./slideDrag";

/**
 * Dragging a tab, by pointer events rather than HTML5 drag and drop. The native
 * drag shows the OS "copy" (+) cursor over anything that takes text and a ghost
 * image of its own, and cannot be styled; this way the drag owns its cursor and
 * ghost. Like Orca's tab drag (dnd-kit's pointer sensor), the drop is decided by
 * where the pointer is:
 *   - on the tab strip: reorder; the tab follows the pointer and the others slide
 *     aside (`slideDrag.ts`, shared with the sidebar); past the last tab is the end;
 *   - on a pane of the canvas: split on the side nearest the pointer
 *     (`resolveZone`); the middle of a pane does nothing.
 * `TabDragLayer` draws the ghost (off the strip) and the highlight from `useTabDrag`.
 *
 * A native child webview (the desktop Browser pane) sits above the web view and
 * swallows pointer events, so a drag holds `acquirePassthrough` (browserNative.ts):
 * the pages are hidden until it ends, however it ends.
 */

export interface Box { left: number; top: number; width: number; height: number }

export interface TabDragState {
  id: string;
  label: string;
  x: number;
  y: number;
  /** The pointer is on the tab strip: the tabs slide (`slideDrag.ts`) and the dragged one follows it. */
  overStrip: boolean;
  /** A reorder drop: the slot the tab lands in; null where it already is. */
  insert: { index: number } | null;
  /** A split drop on `targetId`'s pane; `zone` is null when that pane cannot take the tab. */
  drop: { targetId: string; pane: Box; zone: DropZone | null; blocked: boolean } | null;
}

export const useTabDrag = create<{ drag: TabDragState | null }>(() => ({ drag: null }));

/** The middle of a pane, as a fraction of each side, where a drop does nothing. */
const CENTER = 0.2;

/** The side of `box` nearest `point` (the diagonal quadrants), null in the middle. */
export function resolveZone(box: Box, point: { x: number; y: number }): DropZone | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const dx = (point.x - box.left) / box.width - 0.5;
  const dy = (point.y - box.top) / box.height - 0.5;
  if (Math.abs(dx) < CENTER && Math.abs(dy) < CENTER) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
}

/** The half of `box` a split on `zone` would take. */
export function zoneBox(box: Box, zone: DropZone): Box {
  const w = box.width / 2;
  const h = box.height / 2;
  if (zone === "left") return { ...box, width: w };
  if (zone === "right") return { ...box, left: box.left + w, width: w };
  if (zone === "up") return { ...box, height: h };
  return { ...box, top: box.top + h, height: h };
}

const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

const stripEl = () => document.querySelector<HTMLElement>('[data-testid="tab-bar"]');

/** What the pointer is over: the strip (reorder: slide the tabs) or a pane (split). */
function hit(drag: TabDragState, ev: PointerEvent, slide: Slide): Pick<TabDragState, "overStrip" | "insert" | "drop"> {
  const { clientX: x, clientY: y } = ev;
  const stripBox = stripEl()?.getBoundingClientRect();
  if (stripBox && slide.from >= 0 && inside(stripBox, x, y)) {
    const to = slide.slot(ev);
    slide.apply(to, ev);
    // Where it already is: a drop changes nothing.
    return { overStrip: true, insert: to === slide.from ? null : { index: to }, drop: null };
  }
  slide.rest();
  const none = { overStrip: false, insert: null, drop: null };
  const pane = [...document.querySelectorAll<HTMLElement>('[data-pane-id][data-pane-visible="true"]')]
    .find((el) => inside(el.getBoundingClientRect(), x, y));
  if (!pane || pane.dataset.paneId === drag.id) return none;
  const rect = pane.getBoundingClientRect();
  const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  const zone = resolveZone(box, { x, y });
  if (!zone) return none;
  const targetId = pane.dataset.paneId!;
  const ok = planDrop(useSplitSets.getState().sets, drag.id, targetId, zone) !== null;
  return { ...none, drop: { targetId, pane: box, zone: ok ? zone : null, blocked: !ok } };
}

function commit(drag: TabDragState): void {
  const { tabs } = currentTabs();
  const ids = tabs.map((tab) => tab.id);
  const key = tabOrderKey(usePerchStore.getState());
  // The tab (or the target pane's) may have closed during the drag.
  if (!ids.includes(drag.id)) return;
  if (drag.insert && key) {
    saveTabStrip(key, moveTab(ids, drag.id, drag.insert.index));
    return;
  }
  const { drop } = drag;
  if (drop?.zone) dropTab(drag.id, drop.targetId, drop.zone);
}

/** Split `dragged` onto the `zone` side of `target`: the one path for a drag, a shortcut and the menus. */
export function dropTab(dragged: string, target: string, zone: DropZone): void {
  const ids = currentTabs().tabs.map((tab) => tab.id);
  const key = tabOrderKey(usePerchStore.getState());
  if (!key || !ids.includes(dragged) || !ids.includes(target)) return;
  useSplitSets.getState().drop(dragged, target, zone);
  // Left/up puts the tab before the pane's in the strip, right/down after: the strip order is the pane order.
  saveTabStrip(key, moveBeside(ids, dragged, target, zone === "right" || zone === "down"));
  const entry = currentTabs().tabs.find((tab) => tab.id === dragged);
  if (entry) activateTab(entry);
}

/** Call from a tab's `onPointerDown`; the press turns into a drag after a few pixels. */
export function beginTabDrag(e: ReactPointerEvent, id: string, label: string): void {
  if (useTabDrag.getState().drag) return;
  beginSlideDrag(e, {
    axis: "x",
    items: () => [...(stripEl()?.querySelectorAll<HTMLElement>("[data-tab-entry]") ?? [])],
    from: (items) => items.findIndex((el) => el.dataset.tabEntry === id),
    onStart: acquirePassthrough,
    onMove: (ev, slide) => {
      const base: TabDragState = { id, label, x: ev.clientX, y: ev.clientY, overStrip: false, insert: null, drop: null };
      useTabDrag.setState({ drag: { ...base, ...hit(base, ev, slide) } });
    },
    onEnd: (apply) => {
      const drag = useTabDrag.getState().drag;
      useTabDrag.setState({ drag: null });
      if (apply && drag) commit(drag);
    },
  });
}
