//! Tab menu, the stock screen `stock:tab-menu`: a tab's actions (rename, split with a new terminal, show beside
//! another open tab, full size, separate, stop agent, close), opened from the tab strip (`tab.menu`), a sidebar row
//! or a pane's "Show beside an open tab…", and a package's `TabMenu`/`SessionMenu` from `@perch/sdk`; or the person's
//! package chosen for it (`perch mod use stock:tab-menu <id>`) with the same props.
//!
//! What may be done is worked out by Perch (`canSplitNew`, `offered`, `inSplit`, `canStopAgent`) and each action runs
//! Perch's own (`actions`: the same split, close guard and stop as the keys). Where the menu sits, the rename form,
//! the order and wording of rows are this screen's. A press outside or Escape closes it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:tab-menu` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, menuDividerClass as menuDivider, menuItemClass as menuItem, menuPanel, type TabMenuScreenProps } from "@perch/sdk";

export default function TabMenu({ x, y, onClose, self, canSplitNew, canSplitMore, offered, inSplit, canStopAgent, extraItems, actions }: TabMenuScreenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    // A new press outside closes it; `pointerdown`, because lifting the finger that held a row open fires a
    // compatibility `mousedown` there, which would close the menu the hold just opened.
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (renaming) { renameRef.current?.focus(); renameRef.current?.select(); }
  }, [renaming]);

  const left = Math.max(8, Math.min(x, window.innerWidth - 288));
  const top = Math.max(8, Math.min(y, window.innerHeight - 48 - 36 * (offered.length + extraItems.length + 7)));
  const then = (run: () => void) => () => { run(); onClose(); };
  function commitRename() {
    if (self.kind === "session" && name.trim()) actions.rename(name.trim());
    onClose();
  }
  return createPortal(
    <div ref={ref} className={`${menuPanel} overflow-y-auto max-[700px]:[&_button]:min-h-11`} aria-label="Tab actions" data-testid="tab-split-menu" style={{ position: "fixed", top, left, zIndex: 9999, width: 280, maxWidth: "calc(100vw - 16px)", maxHeight: window.innerHeight - top - 8 }}>
      {renaming ? <form className="flex gap-2 p-2" onSubmit={(event) => { event.preventDefault(); commitRename(); }}>
        <input ref={renameRef} aria-label="Tab name" data-testid="tab-menu-rename-input" className="min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-sm text-fg focus:[outline:1px_solid_var(--accent)]" value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit" className={button({ size: "sm", variant: "primary" })}>Save</button>
      </form> : <>
      {self.kind === "session" && <button type="button" className={menuItem()} data-testid="tab-menu-rename" onClick={() => { setName(self.title ?? ""); setRenaming(true); }}>Rename tab</button>}
      {(["right", "below"] as const).map((direction) => <button key={direction} type="button" className={menuItem()} data-testid={`tab-menu-split-${direction}`} disabled={!canSplitNew || !canSplitMore} onClick={then(() => actions.splitNew(direction))}>Split {direction} with new terminal</button>)}
      <div className={menuDivider} />
      {offered.length > 0 && <p className="m-0 px-[0.9rem] py-1 text-xs text-subtext-0">Show an open tab beside this one</p>}
      {offered.map((entry) => (
        <button key={entry.id} type="button" className={menuItem()} data-testid={`tab-split-with-${entry.id}`} onClick={then(() => actions.showBeside(entry.id))}>
          <span className="block truncate">Show beside {entry.label}</span>
        </button>
      ))}
      {offered.length === 0 && !inSplit && <div className="px-[0.9rem] py-[0.45rem] text-[0.82rem] text-subtext-0">No other open tab available</div>}
      {inSplit && (
        <>
          {offered.length > 0 && <div className={menuDivider} />}
          <button type="button" className={menuItem()} data-testid="tab-unsplit" onClick={then(actions.showFull)}>Show this tab full size</button>
          <button type="button" className={menuItem()} data-testid="tab-untile-all" onClick={then(actions.separateAll)}>Separate all tabs</button>
        </>
      )}
      {extraItems.length > 0 && <div className={menuDivider} />}
      {extraItems.map((item) => <button key={item.testId} type="button" className={menuItem()} data-testid={item.testId} onClick={then(item.onSelect)}>{item.label}</button>)}
      {canStopAgent && <button type="button" className={menuItem({ danger: true })} data-testid="pane-menu-stop-agent" onClick={then(actions.stopAgent)}>Stop agent</button>}
      <div className={menuDivider} />
      <button type="button" className={menuItem({ danger: true })} data-testid="tab-menu-close" onClick={then(actions.close)}>Close tab</button>
      </>}
    </div>,
    document.body,
  );
}
