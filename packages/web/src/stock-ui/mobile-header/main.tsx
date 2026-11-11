//! Phone header, the stock screen `stock:mobile-header`: the phone's one top row, as a chat app has it. Left, the
//! sidebar button (every session, project and host, plus Settings); a count of sessions that need the person rides on
//! it. Middle, the session shown (its status dot, title, and `project · branch` under it, or "Reconnecting…" while the
//! connection is down). Right, the tools button: the Files and Git drawer of the shown session's workspace.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). What the row shows and what a tap does are Perch's (props); the arrangement is this file's.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-header` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { cn, ghostButton, tapButtonClass, type MobileHeaderProps } from "@perch/sdk";

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const iconButton = cn(ghostButton, tapButtonClass, "relative grid size-11 shrink-0 place-items-center p-0");

export default function MobileHeader({ dot, title, place, connected, needsYou, cwd, onOpenSwitcher, onOpenTools }: MobileHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center gap-1 border-b border-surface-1 pt-[max(0.25rem,env(safe-area-inset-top))] pr-[max(0.25rem,env(safe-area-inset-right))] pb-1 pl-[max(0.25rem,env(safe-area-inset-left))]"
      data-testid="mobile-header"
    >
      <button
        type="button"
        className={iconButton}
        data-testid="mobile-switch"
        aria-label={needsYou ? `Sessions, ${needsYou} ${needsYou === 1 ? "needs" : "need"} you` : "Sessions"}
        onClick={onOpenSwitcher}
      >
        <svg {...ICON}><path d="M4 8h16M4 16h10" /></svg>
        {needsYou > 0 && (
          <span className="absolute top-1.5 right-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-surface-1 px-1 text-[0.65rem] text-fg tabular-nums" data-testid="needs-you-count" aria-hidden="true">{needsYou}</span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1" data-testid="mobile-title">
        {dot}
        <span className="grid min-w-0 gap-[0.1rem] text-center">
          <span className="overflow-hidden text-[0.95rem] font-semibold text-ellipsis whitespace-nowrap text-fg">{title}</span>
          <span className="overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
            {!connected ? <span className="text-red" role="status">Reconnecting…</span> : place}
          </span>
        </span>
      </div>
      <button type="button" className={iconButton} data-testid="mobile-tools" aria-label="Files and Git" onClick={onOpenTools}>
        <svg {...ICON}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M14.5 4.5v15" /></svg>
      </button>
    </header>
  );
}
