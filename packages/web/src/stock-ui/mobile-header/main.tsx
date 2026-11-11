//! Phone header, the stock screen `stock:mobile-header`: the head row of the phone's main card, as the desktop's main
//! card has its tab row (44px, no rules). Left, the sidebar button, the desktop's own sidebar glyph (every session,
//! project and host, plus Settings); a count of sessions that need the person rides on it as on the desktop's. Middle,
//! the session shown (its status dot, title, and `project · branch` under it, or "Reconnecting…" while the connection
//! is down). Right, the desktop's drawer glyph: the Files and Git drawer of the shown session's workspace.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). What the row shows and what a tap does are Perch's (props); the arrangement is this file's. The card
//! around it, its radius, color and the safe-area insets are Perch's too (theme tokens), so a theme change reaches it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-header` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { cn, ghostButton, tapButtonClass, type MobileHeaderProps } from "@perch/sdk";

// The desktop's panel glyphs (StockWindow's sidebar and drawer toggles): a window with its divider on one side.
const GLYPH = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true } as const;
// 44px to the thumb; the fill appears on press (a finger leaves no hover).
const TOGGLE = cn(ghostButton, tapButtonClass, "relative grid size-11 shrink-0 place-items-center p-0");

export default function MobileHeader({ dot, title, place, connected, needsYou, cwd, onOpenSwitcher, onOpenTools }: MobileHeaderProps) {
  return (
    <header className="box-border flex h-11 shrink-0 items-center px-1" data-testid="mobile-header">
      <button
        type="button"
        className={TOGGLE}
        data-testid="mobile-switch"
        aria-label={needsYou ? `Sessions, ${needsYou} ${needsYou === 1 ? "chat needs" : "chats need"} you` : "Sessions"}
        onClick={onOpenSwitcher}
      >
        <svg {...GLYPH}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M6 2.5v11" /></svg>
        {needsYou > 0 && (
          <span className="absolute top-1 right-1 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-yellow px-[3px] text-[9px] leading-none font-semibold text-panel-bg tabular-nums" data-testid="needs-you-count" aria-hidden="true">{needsYou}</span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1" data-testid="mobile-title">
        {dot}
        <span className="grid min-w-0 gap-[0.05rem] text-center leading-tight">
          <span className="overflow-hidden text-[0.85rem] font-semibold text-ellipsis whitespace-nowrap text-fg">{title}</span>
          <span className="overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
            {!connected ? <span className="text-red" role="status">Reconnecting…</span> : place}
          </span>
        </span>
      </div>
      <button type="button" className={TOGGLE} data-testid="mobile-tools" aria-label="Files and Git" onClick={onOpenTools}>
        <svg {...GLYPH}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M10 2.5v11" /></svg>
      </button>
    </header>
  );
}
