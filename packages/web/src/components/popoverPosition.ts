/**
 * Shared positioning for the composer's portal-rendered popovers.
 *
 * Every popover in the chat input row (ModelChip, EffortChip, the slash-command
 * autocomplete) has the same problem: it must escape the `overflow:hidden`
 * ancestors dockview puts around a pane, so it is rendered into `document.body`
 * with `position: fixed` and positioned from its anchor's bounding rect. This
 * module is the one copy of that arithmetic.
 */

import { useEffect, type RefObject } from "react";

const GAP = 6;
const EDGE = 8;

export interface AnchoredPopoverOptions {
  /** Minimum width in px. */
  minWidth?: number;
  /** Which edge of the anchor the popover lines up with. `"right"` matches the
   * chips (which sit at the right end of the controls row); `"left"` matches
   * the slash popover (anchored to the textarea's left edge). */
  align?: "left" | "right";
  /** Below this much free space above the anchor, flip and render below it. */
  minSpaceAbove?: number;
}

/**
 * Fixed-position style placing a popover directly above `anchor` (or below it
 * when there isn't room), clamped to the viewport so it always scrolls rather
 * than overflowing off-screen.
 */
export function computeAnchoredPopoverStyle(
  anchor: HTMLElement,
  options: AnchoredPopoverOptions = {},
): React.CSSProperties {
  const { minWidth = 220, align = "right", minSpaceAbove = 100 } = options;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const edge =
    align === "right"
      ? { right: Math.max(0, vw - rect.right) }
      : { left: Math.max(0, rect.left) };

  const spaceAbove = rect.top - GAP - EDGE;
  const spaceBelow = vh - rect.bottom - GAP - EDGE;

  if (spaceAbove >= minSpaceAbove) {
    return {
      position: "fixed",
      bottom: vh - rect.top + GAP,
      ...edge,
      minWidth,
      maxHeight: Math.min(spaceAbove, vh * 0.75),
      overflowY: "auto",
    };
  }
  return {
    position: "fixed",
    top: rect.bottom + GAP,
    ...edge,
    minWidth,
    maxHeight: Math.min(spaceBelow, vh * 0.75),
    overflowY: "auto",
  };
}

/**
 * Close an anchored popover on an outside click or Escape. Byte-identical
 * effect body shared by EffortChip and ModelChip (mousedown outside both the
 * pill and the popover closes it; Escape always closes it).
 */
export function useDismissOnOutsideClick(
  open: boolean,
  setOpen: (open: boolean) => void,
  pillRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inPill = pillRef.current?.contains(target) ?? false;
      const inPopover = popoverRef.current?.contains(target) ?? false;
      if (!inPill && !inPopover) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
}
