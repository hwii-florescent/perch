import { visibleSplit, type SplitSet } from "./splitSets";

/** How a tab relates to the canvas: its pane has focus, is shown beside the focused one, or is not shown. */
export type TabPaneState = "focused" | "visible" | "hidden";

/**
 * The state of every tab in the strip (`ids`, strip order). The focused tab is
 * the active one, the other members of its visible split are `visible`, the
 * rest `hidden`. Only the focused tab is highlighted.
 */
export function tabPaneStates(sets: SplitSet[], ids: readonly string[], activeId: string | null, zoomedId: string | null): Map<string, TabPaneState> {
  const states = new Map<string, TabPaneState>(ids.map((id) => [id, "hidden"]));
  if (activeId === null || !states.has(activeId)) return states;
  states.set(activeId, "focused");
  if (zoomedId === activeId) return states;
  for (const id of visibleSplit(sets, ids, activeId)?.ids ?? []) {
    if (id !== activeId && states.has(id)) states.set(id, "visible");
  }
  return states;
}

// The focused fill mixes text into panel-bg to stay readable in all themes
// (tabPaneState.test.ts). Focus is also heavier text, never color alone.
// Unfocused split panes use the same plain tab style as hidden panes.
export const TAB_PANE_CLASS: Record<TabPaneState, string> = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
};
