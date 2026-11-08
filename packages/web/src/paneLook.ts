/** The layout's say over the split canvas that CSS variables cannot carry: the space between panes and
 * whether a tab's only pane is framed too. `LayoutRoot` sets it while a layout is shown. */
import { useSyncExternalStore } from "react";
import { PANE_GAP_PX } from "./splitSets";

export interface PaneLook { gap: number; lone: boolean }
export const STOCK_PANE_LOOK: PaneLook = { gap: PANE_GAP_PX, lone: false };
let look = STOCK_PANE_LOOK;
const watchers = new Set<() => void>();

export function setPaneLook(next: Partial<PaneLook> | null): void {
  const merged = { ...STOCK_PANE_LOOK, ...next };
  if (merged.gap === look.gap && merged.lone === look.lone) return;
  look = merged;
  watchers.forEach((watch) => watch());
}

export const usePaneLook = () =>
  useSyncExternalStore((watch) => (watchers.add(watch), () => void watchers.delete(watch)), () => look);
