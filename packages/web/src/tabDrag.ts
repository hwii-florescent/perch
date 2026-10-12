import type { PointerEvent as ReactPointerEvent } from "react";
import { create } from "zustand";
import { usePerchStore } from "./store";
import { moveBeside, moveTab, saveTabOrder } from "./tabOrder";
import { planDrop, useSplitSets, type DropZone } from "./splitSets";
import { activateTab, currentTabs, tabOrderKey } from "./workspaceTabs";
import { acquirePassthrough } from "./browserNative";

/**
 * Dragging a tab, by pointer events rather than HTML5 drag and drop. The native
 * drag shows the OS "copy" (+) cursor over anything that takes text and a ghost
 * image of its own, and cannot be styled; this way the drag owns its cursor and
 * ghost. Like Orca's tab drag (dnd-kit's pointer sensor), the drop is decided by
 * where the pointer is:
 *   - on the tab strip: reorder, with an insertion bar; past the last tab is the end;
 *   - on a pane of the canvas: split on the side nearest the pointer
 *     (`resolveZone`); the middle of a pane does nothing.
 * `TabDragLayer` draws the ghost, the bar and the highlight from `useTabDrag`.
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
  /** A reorder drop: the bar's place and the index among the other tabs. */
  insert: { index: number; x: number; top: number; height: number } | null;
  /** A split drop on `targetId`'s pane; `zone` is null when that pane cannot take the tab. */
  drop: { targetId: string; pane: Box; zone: DropZone | null; blocked: boolean } | null;
}

export const useTabDrag = create<{ drag: TabDragState | null }>(() => ({ drag: null }));

/** Movement before a press becomes a drag, so a click never reorders. */
const DRAG_START_PX = 5;
/** The middle of a pane, as a fraction of each side, where a drop does nothing. */
const CENTER = 0.2;

/** The tab's slot among the others: how many of `mids` (centers, left to right) lie left of `x`. */
export function insertIndex(mids: number[], x: number): number {
  return mids.filter((mid) => mid < x).length;
}

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

function hit(drag: TabDragState, x: number, y: number): Pick<TabDragState, "insert" | "drop"> {
  const strip = document.querySelector<HTMLElement>('[data-testid="tab-bar"]');
  const stripBox = strip?.getBoundingClientRect();
  if (strip && stripBox && inside(stripBox, x, y)) {
    const slots = [...strip.querySelectorAll<HTMLElement>("[data-tab-entry]")]
      .filter((slot) => slot.dataset.tabEntry !== drag.id)
      .map((slot) => slot.getBoundingClientRect());
    const index = insertIndex(slots.map((r) => r.left + r.width / 2), x);
    const before = currentTabs().tabs.map((tab) => tab.id).indexOf(drag.id);
    // Where it already is: no bar, and a drop changes nothing.
    if (index === before) return { insert: null, drop: null };
    const edge = slots[index] ? slots[index]!.left - 1 : slots.length ? slots[slots.length - 1]!.right + 1 : stripBox.left + 2;
    const ref = slots[Math.min(index, slots.length - 1)] ?? stripBox;
    return { insert: { index, x: edge, top: ref.top + 2, height: ref.height - 4 }, drop: null };
  }
  const pane = [...document.querySelectorAll<HTMLElement>('[data-pane-id][data-pane-visible="true"]')]
    .find((el) => inside(el.getBoundingClientRect(), x, y));
  if (!pane || pane.dataset.paneId === drag.id) return { insert: null, drop: null };
  const rect = pane.getBoundingClientRect();
  const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  const zone = resolveZone(box, { x, y });
  if (!zone) return { insert: null, drop: null };
  const targetId = pane.dataset.paneId!;
  const ok = planDrop(useSplitSets.getState().sets, drag.id, targetId, zone) !== null;
  return { insert: null, drop: { targetId, pane: box, zone: ok ? zone : null, blocked: !ok } };
}

function commit(drag: TabDragState): void {
  const { tabs } = currentTabs();
  const ids = tabs.map((tab) => tab.id);
  const key = tabOrderKey(usePerchStore.getState());
  // The tab (or the target pane's) may have closed during the drag.
  if (!ids.includes(drag.id)) return;
  if (drag.insert && key) {
    saveTabOrder(key, moveTab(ids, drag.id, drag.insert.index));
    return;
  }
  const { drop } = drag;
  if (!drop?.zone || !key || !ids.includes(drop.targetId)) return;
  useSplitSets.getState().drop(drag.id, drop.targetId, drop.zone);
  // Left/up puts the tab before the pane's in the strip, right/down after: the strip order is the pane order.
  saveTabOrder(key, moveBeside(ids, drag.id, drop.targetId, drop.zone === "right" || drop.zone === "down"));
  const entry = currentTabs().tabs.find((tab) => tab.id === drag.id);
  if (entry) activateTab(entry);
}

/** Call from a tab's `onPointerDown`; the press turns into a drag after a few pixels. */
export function beginTabDrag(e: ReactPointerEvent, id: string, label: string): void {
  if (e.button !== 0 || useTabDrag.getState().drag) return;
  const start = { x: e.clientX, y: e.clientY };
  let started = false;
  let release = () => {};

  const finish = (apply: boolean) => {
    release();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", cancel);
    const drag = useTabDrag.getState().drag;
    useTabDrag.setState({ drag: null });
    if (!started) return;
    // The release also clicks the tab under the pointer: that click is not a selection.
    const swallow = (ev: Event) => ev.stopPropagation();
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    if (apply && drag) commit(drag);
  };
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_START_PX) return;
      started = true;
      release = acquirePassthrough();
    }
    const base: TabDragState = { id, label, x: ev.clientX, y: ev.clientY, insert: null, drop: null };
    useTabDrag.setState({ drag: { ...base, ...hit(base, ev.clientX, ev.clientY) } });
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    finish(false);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", cancel);
}
