import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_SPLIT, useSplitSets, visibleSplit } from "../splitSets";
import { activateTab, entryLabel, type TabEntry } from "../workspaceTabs";
import { closeTab, exitSplit, splitActiveTab } from "../tiledPanes";
import { canStopAgent, stopAgent } from "../agentTerminals";
import { effectiveWorkspace, usePerchStore } from "../store";
import { button } from "./ui/button";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";

/** Shared tab actions for the horizontal strip and sidebar, without selecting on right-click. */
export function TabSplitMenu({ entries, menu, onClose = useSplitSets.getState().closeMenu, extraItems = [] }: {
  entries: TabEntry[];
  menu: { id: string; x: number; y: number };
  onClose?: () => void;
  extraItems?: { label: string; testId: string; onSelect: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const { split, untile } = useSplitSets.getState();
  const closeMenu = onClose;
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

  useEffect(() => {
    if (renaming) { renameRef.current?.focus(); renameRef.current?.select(); }
  }, [renaming]);

  if (!self) return null;
  const state = usePerchStore.getState();
  const canSplitNew = !!effectiveWorkspace(self.kind === "session"
    ? { ...state, sessionId: self.id, activeWorkspaceId: self.session.workspaceId ?? null }
    : state);
  const inSet = visibleSplit(sets, entries.map((entry) => entry.id), menu.id) !== null;
  const home = sets.find((set) => set.ids.includes(menu.id));
  // The group a split would make (see `joinSplit`) must fit `MAX_SPLIT`.
  const offered = entries.filter((entry) => {
    if (entry.id === menu.id || home?.ids.includes(entry.id)) return false;
    const group = home ? [...home.ids, entry.id] : [...(sets.find((set) => set.ids.includes(entry.id))?.ids ?? [entry.id]), menu.id];
    return group.length <= MAX_SPLIT;
  });

  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 288));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 48 - 36 * (offered.length + extraItems.length + 7)));
  function commitRename() {
    if (self?.kind === "session" && name.trim()) usePerchStore.getState().renameSession(self.id, name.trim());
    closeMenu();
  }
  return createPortal(
    <div ref={ref} className={`${menuPanel} overflow-y-auto max-[700px]:[&_button]:min-h-11`} aria-label="Tab actions" data-testid="tab-split-menu" style={{ position: "fixed", top, left, zIndex: 9999, width: 280, maxWidth: "calc(100vw - 16px)", maxHeight: window.innerHeight - top - 8 }}>
      {renaming ? <form className="flex gap-2 p-2" onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
        <input ref={renameRef} aria-label="Tab name" data-testid="tab-menu-rename-input" className="min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-sm text-fg focus:[outline:1px_solid_var(--accent)]" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit" className={button({ size: "sm", variant: "primary" })}>Save</button>
      </form> : <>
      {self.kind === "session" && <button type="button" className={menuItem()} data-testid="tab-menu-rename" onClick={() => { setName(self.session.title); setRenaming(true); }}>Rename tab</button>}
      {(["right", "below"] as const).map((direction) => <button key={direction} type="button" className={menuItem()} data-testid={`tab-menu-split-${direction}`} disabled={!canSplitNew || (home?.ids.length ?? 1) >= MAX_SPLIT} onClick={() => { activateTab(self); splitActiveTab(direction, self.id); closeMenu(); }}>Split {direction} with new terminal</button>)}
      <div className={menuDivider} />
      {offered.length > 0 && <p className="m-0 px-[0.9rem] py-1 text-xs text-subtext-0">Show an open tab beside this one</p>}
      {offered.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={menuItem()}
          data-testid={`tab-split-with-${entry.id}`}
          onClick={() => { split(menu.id, entry.id); closeMenu(); activateTab(self); }}
        >
          <span className="block truncate">Show beside {entryLabel(entry)}</span>
        </button>
      ))}
      {offered.length === 0 && !inSet && <div className="px-[0.9rem] py-[0.45rem] text-[0.82rem] text-subtext-0">No other open tab available</div>}
      {inSet && (
        <>
          {offered.length > 0 && <div className={menuDivider} />}
          <button type="button" className={menuItem()} data-testid="tab-unsplit" onClick={() => { exitSplit(menu.id); activateTab(self); closeMenu(); }}>
            Show this tab full size
          </button>
          <button type="button" className={menuItem()} data-testid="tab-untile-all" onClick={() => { untile(menu.id); activateTab(self); closeMenu(); }}>
            Separate all tabs
          </button>
        </>
      )}
      {extraItems.length > 0 && <div className={menuDivider} />}
      {extraItems.map((item) => <button key={item.testId} type="button" className={menuItem()} data-testid={item.testId} onClick={() => { item.onSelect(); closeMenu(); }}>{item.label}</button>)}
      {self.kind === "session" && canStopAgent(self.id) && <button type="button" className={menuItem({ danger: true })} data-testid="pane-menu-stop-agent" onClick={() => { stopAgent(self.id); closeMenu(); }}>Stop agent</button>}
      <div className={menuDivider} />
      <button type="button" className={menuItem({ danger: true })} data-testid="tab-menu-close" onClick={() => { closeTab(self.id); closeMenu(); }}>
        Close tab
      </button>
      </>}
    </div>,
    document.body,
  );
}
