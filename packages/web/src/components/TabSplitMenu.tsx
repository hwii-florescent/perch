/**
 * TabSplitMenu.tsx: a tab's actions for the horizontal strip and the sidebar, without selecting on right-click. The
 * screen is `stock:tab-menu` (`stock-ui/tab-menu/main.tsx`) or the person's package chosen for it; this file works out
 * what may be done (split room, the open tabs a split can take, a running agent) and binds each action to Perch's
 * own (`tiledPanes`, `splitSets`, the close guard, `agentTerminals`).
 */
import { MAX_SPLIT, useSplitSets, visibleSplit } from "../splitSets";
import { activateTab, entryLabel, type TabEntry } from "../workspaceTabs";
import { closeTab, exitSplit, splitActiveTab } from "../tiledPanes";
import { canStopAgent, stopAgent } from "../agentTerminals";
import { effectiveWorkspace, usePerchStore } from "../store";
import TabMenu from "../stock-ui/tab-menu/main";
import { StockRoute } from "./mod-root";

export function TabSplitMenu({ entries, menu, onClose = useSplitSets.getState().closeMenu, extraItems = [] }: {
  entries: TabEntry[];
  menu: { id: string; x: number; y: number };
  onClose?: () => void;
  extraItems?: { label: string; testId: string; onSelect: () => void }[];
}) {
  const sets = useSplitSets((s) => s.sets);
  const self = entries.find((entry) => entry.id === menu.id);
  if (!self) return null;
  const state = usePerchStore.getState();
  const canSplitNew = !!effectiveWorkspace(self.kind === "session"
    ? { ...state, sessionId: self.id, activeWorkspaceId: self.session.workspaceId ?? null }
    : state);
  const home = sets.find((set) => set.ids.includes(menu.id));
  // The group a split would make (see `joinSplit`) must fit `MAX_SPLIT`.
  const offered = entries.filter((entry) => {
    if (entry.id === menu.id || home?.ids.includes(entry.id)) return false;
    const group = home ? [...home.ids, entry.id] : [...(sets.find((set) => set.ids.includes(entry.id))?.ids ?? [entry.id]), menu.id];
    return group.length <= MAX_SPLIT;
  });
  const props = {
    id: menu.id, x: menu.x, y: menu.y, onClose,
    self: { id: self.id, kind: self.kind, label: entryLabel(self), title: self.kind === "session" ? self.session.title : undefined },
    canSplitNew,
    canSplitMore: (home?.ids.length ?? 1) < MAX_SPLIT,
    offered: offered.map((entry) => ({ id: entry.id, label: entryLabel(entry) })),
    inSplit: visibleSplit(sets, entries.map((entry) => entry.id), menu.id) !== null,
    canStopAgent: self.kind === "session" && canStopAgent(self.id),
    extraItems,
    actions: {
      rename: (name: string) => { if (self.kind === "session") usePerchStore.getState().renameSession(self.id, name); },
      splitNew: (direction: "right" | "below") => { activateTab(self); splitActiveTab(direction, self.id); },
      showBeside: (otherId: string) => { useSplitSets.getState().split(menu.id, otherId); activateTab(self); },
      showFull: () => { exitSplit(menu.id); activateTab(self); },
      separateAll: () => { useSplitSets.getState().untile(menu.id); activateTab(self); },
      stopAgent: () => stopAgent(self.id),
      close: () => closeTab(self.id),
    },
  };
  return <StockRoute name="tab-menu" props={props} stock={TabMenu} />;
}
