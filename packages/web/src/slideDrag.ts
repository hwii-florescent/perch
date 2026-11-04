import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * One reorder drag for every list (the tab strip on x, the sidebar on y), the
 * way a browser's tabs behave: the dragged item follows the pointer, the others
 * slide out of its way, and releasing hands the final slot to the caller, which
 * writes the order exactly as it always did. Nothing here knows what an item is.
 *
 * Pointer events, not native drag and drop: native drag draws the OS copy "+"
 * cursor, its own ghost, and freezes hover on whatever was under the pointer.
 *
 * `slideOffsets` and `slotIndex` are pure so the geometry is testable; the rest
 * is DOM. Every inline style the drag sets is restored by `end`, on every exit.
 */

export type Axis = "x" | "y";
export interface Span { start: number; end: number }

/** The slot (0..n-1 in the final list) the item at `from` lands in when its
 * center is at `point`: how many of the other items' centers lie before it. */
export function slotIndex(spans: Span[], from: number, point: number): number {
  return spans.filter((span, i) => i !== from && (span.start + span.end) / 2 < point).length;
}

/** Each item's offset along the axis while the item at `from` is dragged to slot
 * `to` by `delta`. The items it passes shift by its size plus the gap, toward
 * the slot it leaves; the dragged one follows the pointer, kept inside the list. */
export function slideOffsets(spans: Span[], from: number, to: number, delta: number): number[] {
  const out = spans.map(() => 0);
  const dragged = spans[from];
  if (!dragged) return out;
  const next = spans[from + 1];
  const prev = spans[from - 1];
  const shift = dragged.end - dragged.start + (next ? next.start - dragged.end : prev ? dragged.start - prev.end : 0);
  spans.forEach((_, i) => {
    if (from < to && i > from && i <= to) out[i] = -shift;
    else if (to < from && i >= to && i < from) out[i] = shift;
  });
  out[from] = Math.min(Math.max(delta, spans[0]!.start - dragged.start), spans[spans.length - 1]!.end - dragged.end);
  return out;
}

const STYLED = ["transform", "transition", "zIndex", "boxShadow", "pointerEvents", "position", "backgroundColor", "borderRadius"] as const;

export interface Slide {
  readonly from: number;
  /** The slot last applied; `from` when nothing moved or the pointer left the list. */
  readonly to: number;
  /** Slot under the pointer. */
  slot(ev: PointerEvent): number;
  /** Slide the others aside and move the dragged item to the pointer. */
  apply(to: number, ev: PointerEvent): void;
  /** Everything back where it was (the pointer is not over the list). */
  rest(): void;
  /** Restore every inline style, instantly. Safe to call twice. */
  end(): void;
}

function scrollParent(el: HTMLElement, axis: Axis): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node)[axis === "x" ? "overflowX" : "overflowY"];
    if ((overflow === "auto" || overflow === "scroll") && (axis === "x" ? node.scrollWidth > node.clientWidth : node.scrollHeight > node.clientHeight)) return node;
  }
  return null;
}

/** Measure `items` (in order) once, before anything moves; every later hit
 * test uses these spans, because a transformed item's live rect would feed back.
 * The sidebar scrolls, so spans and the pointer are in content coordinates. */
function createSlide(items: HTMLElement[], from: number, axis: Axis, startEvent: { clientX: number; clientY: number }): Slide {
  const scroller = items[from] ? scrollParent(items[from]!, axis) : null;
  const scrolled = () => (scroller ? (axis === "x" ? scroller.scrollLeft : scroller.scrollTop) : 0);
  const along = (p: { clientX: number; clientY: number }) => (axis === "x" ? p.clientX : p.clientY) + scrolled();
  const origin = along(startEvent);
  const base = scrolled();
  const spans = items.map((el): Span => {
    const r = el.getBoundingClientRect();
    return axis === "x" ? { start: r.left + base, end: r.right + base } : { start: r.top + base, end: r.bottom + base };
  });
  const saved = items.map((el) => STYLED.map((key) => el.style[key]));
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = axis === "x" ? "translateX" : "translateY";
  let ended = false;
  const state = { to: from };

  items.forEach((el, i) => {
    el.style.pointerEvents = "none";
    if (i !== from) {
      if (!reduced) el.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      return;
    }
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.zIndex = "30";
    el.style.backgroundColor = "var(--surface-1)";
    el.style.borderRadius = "var(--radius-ui, 6px)";
    el.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.45)";
  });

  const place = (to: number, delta: number) => {
    state.to = to;
    slideOffsets(spans, from, to, delta).forEach((px, i) => { items[i]!.style.transform = px ? `${move}(${px}px)` : ""; });
  };
  return {
    from,
    get to() { return state.to; },
    slot: (ev) => slotIndex(spans, from, along(ev)),
    apply: (to, ev) => { if (!ended) place(to, along(ev) - origin); },
    rest: () => { if (!ended) place(from, 0); },
    end: () => {
      if (ended) return;
      ended = true;
      // Detached items (a row that left its group mid-drag) are restored too.
      items.forEach((el, i) => STYLED.forEach((key, k) => { el.style[key] = saved[i]![k]!; }));
    },
  };
}

export interface SlideDragConfig {
  axis: Axis;
  /** The items in their current order, read when the press becomes a drag. */
  items: () => HTMLElement[];
  /** Index of the dragged item in `items`; -1 means nothing can slide. */
  from: (items: HTMLElement[]) => number;
  /** Runs once the press becomes a drag; the returned function runs when it ends. */
  onStart?: () => (() => void) | void;
  /** On every pointer move: decide where the pointer is, then `slide.apply` or `slide.rest`. */
  onMove: (ev: PointerEvent, slide: Slide) => void;
  /** After the styles are restored. `apply` is false for Escape, blur or a lost pointer. */
  onEnd: (apply: boolean, slide: Slide) => void;
}

/** Movement before a press becomes a drag, so a click never reorders. */
const DRAG_START_PX = 5;
let busy = false;

/** Call from `onPointerDown`. The press becomes a drag after a few pixels. One
 * `finish` handles every way out: release, cancel, lost capture, blur, Escape. */
export function beginSlideDrag(e: ReactPointerEvent, cfg: SlideDragConfig): void {
  if (e.button !== 0 || busy) return;
  const start = { clientX: e.clientX, clientY: e.clientY };
  const target = e.currentTarget as HTMLElement;
  const pointerId = e.pointerId;
  let slide: Slide | null = null;
  let leave: (() => void) | undefined;
  let done = false;
  const bodyStyle = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };

  const finish = (apply: boolean) => {
    if (done) return;
    done = true;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", cancel);
    target.removeEventListener("lostpointercapture", cancel);
    try { target.releasePointerCapture(pointerId); } catch { /* already released */ }
    if (!slide) return;
    busy = false;
    document.body.style.cursor = bodyStyle.cursor;
    document.body.style.userSelect = bodyStyle.userSelect;
    slide.end();
    // The release also clicks what is under the pointer: that click is not a selection.
    const swallow = (ev: Event) => ev.stopPropagation();
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    leave?.();
    cfg.onEnd(apply, slide);
  };
  const move = (ev: PointerEvent) => {
    if (!slide) {
      if (Math.hypot(ev.clientX - start.clientX, ev.clientY - start.clientY) < DRAG_START_PX) return;
      const items = cfg.items();
      slide = createSlide(items, cfg.from(items), cfg.axis, start);
      busy = true;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      // Capture so the release is delivered wherever the pointer is, even over an iframe.
      try { target.setPointerCapture(pointerId); } catch { /* the press already ended */ }
      target.addEventListener("lostpointercapture", cancel);
      const entered = cfg.onStart?.();
      leave = typeof entered === "function" ? entered : undefined;
    }
    cfg.onMove(ev, slide);
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
