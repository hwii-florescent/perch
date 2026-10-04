import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSplitSets, visibleSplit } from "../splitSets";
import { activateTab, entryLabel, type TabEntry } from "../workspaceTabs";
import { useFileTabs } from "../fileTabs";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";

/**
 * Right-click menu of a tab for split sets: show it beside another open tab,
 * or take it out of its set. A set holds one terminal at most (the terminal's
 * own panes live in its Dockview), so two terminals are never offered.
 */
export function TabSplitMenu({ entries, menu }: { entries: TabEntry[]; menu: { id: string; x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const { split, unsplit, closeMenu } = useSplitSets.getState();
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
  const terminals = (ids: string[]) => entries.filter((entry) => entry.kind === "session" && ids.includes(entry.id)).length;
  // The group a split would make (see `joinSplit`) must keep at most one terminal.
  const offered = entries.filter((entry) => {
    if (entry.id === menu.id || home?.ids.includes(entry.id)) return false;
    const group = home ? [...home.ids, entry.id] : [...(sets.find((set) => set.ids.includes(entry.id))?.ids ?? [entry.id]), menu.id];
    return terminals(group) <= 1;
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
          <button type="button" className={menuItem()} data-testid="tab-unsplit" onClick={() => { unsplit(menu.id); closeMenu(); }}>
            Unsplit this tab
          </button>
        </>
      )}
      {self.kind === "resource" && (
        <>
          <div className={menuDivider} />
          <button type="button" className={menuItem({ danger: true })} onClick={() => { useFileTabs.getState().close(self.id); closeMenu(); }}>
            Close
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
