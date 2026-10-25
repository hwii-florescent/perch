import { visibleSplit, type SplitSet } from "./splitSets";

/** How a tab relates to the canvas: its pane has focus, is shown beside the focused one, or is not shown. */
export type TabPaneState = "focused" | "visible" | "hidden";

/**
 * The state of every tab in the strip (`ids`, strip order). A split is shown by
 * the fills alone: the focused tab is the active one, the other members of its
 * visible split are `visible`, the rest `hidden`. A zoomed pane shows alone, so
 * only its tab is lit.
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

// Fills mix the theme's text color into panel-bg, so they stay visible in dark and
// light themes alike (a fixed surface token can sit within 5% of panel-bg: tokyo-night-day,
// rose-pine-dawn). The percentages keep text readable on them in all 19 themes
// (tabPaneState.test.ts). Focus is also heavier text, never color alone.
export const TAB_PANE_CLASS: Record<TabPaneState, string> = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-[color-mix(in_srgb,var(--text)_6%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_6%,var(--panel-bg))] text-subtext-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
};
