//! Phone header, the stock screen `stock:mobile-header`: the phone's one top row. Left, the session shown (its status
//! dot, title, and `project · branch` under it, or "Reconnecting…" while the connection is down); tapping it opens the
//! switcher. Right, Settings. The count of sessions that need the person rides on the switch button.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). What the row shows and what a tap does are Perch's (props); the arrangement is this file's.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-header` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { Chevron, cn, GearIcon, ghostButton, glassClass, tapButtonClass, type MobileHeaderProps } from "@perch/sdk";

export default function MobileHeader({ dot, title, place, connected, needsYou, cwd, onOpenSwitcher, onOpenSettings }: MobileHeaderProps) {
  return (
    <header className="shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-2 pl-[max(0.5rem,env(safe-area-inset-left))]" data-testid="mobile-header">
      <div className={cn(glassClass, "flex items-center gap-0.5 p-0.5")}>
        <button
          type="button"
          className={cn(ghostButton, tapButtonClass, "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 px-3 text-left")}
          data-testid="mobile-switch"
          aria-label={needsYou ? `Switch session, ${needsYou} ${needsYou === 1 ? "needs" : "need"} you` : "Switch session"}
          onClick={onOpenSwitcher}
        >
          {dot}
          <span className="grid min-w-0 flex-1 gap-[0.1rem]">
            <span className="overflow-hidden text-[0.95rem] font-semibold text-ellipsis whitespace-nowrap text-fg">{title}</span>
            <span className="overflow-hidden text-[0.75rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
              {!connected ? <span className="text-red" role="status">Reconnecting…</span> : place}
            </span>
          </span>
          {needsYou > 0 && <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-[6px] bg-surface-1 px-1 text-[0.68rem] text-fg tabular-nums" data-testid="needs-you-count" aria-hidden="true">{needsYou}</span>}
          <Chevron open />
        </button>
        <button
          type="button"
          className={cn(ghostButton, tapButtonClass, "grid size-[3.25rem] shrink-0 place-items-center p-0")}
          data-testid="settings-gear"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <GearIcon size={20} />
        </button>
      </div>
    </header>
  );
}
