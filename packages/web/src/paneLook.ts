/** The layout's say over the split canvas that CSS variables cannot carry: the space between panes and
 * whether a tab's only pane is framed too. `LayoutRoot` sets it while a layout is shown. */
import { useSyncExternalStore } from "react";
import { PANE_GAP_PX } from "./splitSets";

export interface PaneLook { gap: number; lone: boolean; background?: string; headerAt: "top" | "bottom"; headerReveal: "always" | "hover"; headerHeight: number }
export const STOCK_PANE_LOOK: PaneLook = { gap: PANE_GAP_PX, lone: false, headerAt: "top", headerReveal: "always", headerHeight: 28 };
let look = STOCK_PANE_LOOK;
const watchers = new Set<() => void>();

export function setPaneLook(next: Partial<PaneLook> | null): void {
  // An unset field (undefined) is the stock value, not "keep the last one".
  const merged = { ...STOCK_PANE_LOOK, ...Object.fromEntries(Object.entries(next ?? {}).filter(([, v]) => v !== undefined)) };
  if (JSON.stringify(merged) === JSON.stringify(look)) return;
  look = merged;
  watchers.forEach((watch) => watch());
}

export const getPaneLook = () => look;
export const usePaneLook = () =>
  useSyncExternalStore((watch) => (watchers.add(watch), () => void watchers.delete(watch)), () => look);
