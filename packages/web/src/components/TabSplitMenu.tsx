import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MAX_SPLIT, useSplitSets, visibleSplit } from "../splitSets";
import { activateTab, entryLabel, type TabEntry } from "../workspaceTabs";
import { closeTab, exitSplit } from "../tiledPanes";
import { canStopAgent, stopAgent } from "../agentTerminals";
import { openSessionPaneMenu } from "../dockview/DockviewShell";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";

/**
 * Right-click menu of a tab for split sets: show it beside another open tab,
 * or take it out of its set. Any tabs can share a set, terminals included, up
 * to `MAX_SPLIT`.
 */
export function TabSplitMenu({ entries, menu }: { entries: TabEntry[]; menu: { id: string; x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const { split, untile, closeMenu } = useSplitSets.getState();
  const sets = useSplitSets((s) => s.sets);
  const self = entries.find((entry) => entry.id === menu.id);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) closeMenu(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [closeMenu]);

  if (!self) return null;
  const inSet = visibleSplit(sets, entries.map((entry) => entry.id), menu.id) !== null;
  const home = sets.find((set) => set.ids.includes(menu.id));
  // The group a split would make (see `joinSplit`) must fit `MAX_SPLIT`.
  const offered = entries.filter((entry) => {
    if (entry.id === menu.id || home?.ids.includes(entry.id)) return false;
    const group = home ? [...home.ids, entry.id] : [...(sets.find((set) => set.ids.includes(entry.id))?.ids ?? [entry.id]), menu.id];
    return group.length <= MAX_SPLIT;
  });

  const left = Math.min(menu.x, window.innerWidth - 220);
  const top = Math.min(menu.y, window.innerHeight - 40 - 30 * (offered.length + 2));
  return createPortal(
    <div ref={ref} className={menuPanel} data-testid="tab-split-menu" style={{ position: "fixed", top, left, zIndex: 9999, minWidth: 200 }}>
      {offered.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={menuItem()}
          data-testid={`tab-split-with-${entry.id}`}
          onClick={() => { split(menu.id, entry.id); closeMenu(); activateTab(self); }}
        >
          Split with {entryLabel(entry)}
        </button>
      ))}
      {offered.length === 0 && !inSet && <div className="px-[0.9rem] py-[0.45rem] text-[0.82rem] text-subtext-0">No other tab to split with</div>}
      {inSet && (
        <>
          {offered.length > 0 && <div className={menuDivider} />}
          <button type="button" className={menuItem()} data-testid="tab-unsplit" onClick={() => { exitSplit(menu.id); closeMenu(); }}>
            Unsplit this tab
          </button>
          <button type="button" className={menuItem()} data-testid="tab-untile-all" onClick={() => { untile(menu.id); activateTab(self); closeMenu(); }}>
            Unsplit all tabs
          </button>
        </>
      )}
      {self.kind === "session" && (
        <>
          <div className={menuDivider} />
          <button type="button" className={menuItem()} onClick={() => { activateTab(self); closeMenu(); openSessionPaneMenu(menu.x, menu.y); }}>
            Session pane actions…
          </button>
          {canStopAgent(self.id) && <button type="button" className={menuItem({ danger: true })} data-testid="pane-menu-stop-agent" onClick={() => { stopAgent(self.id); closeMenu(); }}>Stop agent</button>}
        </>
      )}
      <div className={menuDivider} />
      <button type="button" className={menuItem({ danger: true })} data-testid="tab-menu-close" onClick={() => { closeTab(self.id); closeMenu(); }}>
        Close tab
      </button>
    </div>,
    document.body,
  );
}
