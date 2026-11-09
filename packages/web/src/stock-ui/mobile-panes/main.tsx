//! Phone panes, the stock screen `stock:mobile-panes`: the phone's canvas, the one pane shown over a bottom bar (thumb
//! reach; the agent gets the full height above it). The bar has Session, Files and Git (Git only for a git checkout);
//! the pane is Perch's (`content`: the session's own terminal or chat, the Files pane, the review), or a hint when no
//! workspace is picked. Exactly one pane is mounted: a phone keeps memory, focus and the terminal's lifecycle bounded to
//! what is in front of the person.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). Choosing a pane is Perch's (`onSelect` drops a stale Files/Git request and uncovers the session).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-panes` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import type { ReactNode } from "react";
import { cn, ghostButton, glassClass, tapButtonClass, type MobilePaneKind, type MobilePanesProps } from "@perch/sdk";

const ICON = { width: 20, height: 20, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

// The same glyphs as the desktop chrome where one exists (Files/Git drawer tabs).
const ICONS: Record<MobilePaneKind, ReactNode> = {
  chat: <svg {...ICON}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="m4.5 6 2 2-2 2M8 10.5h3" /></svg>,
  files: <svg {...ICON}><path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /></svg>,
  gitReview: <svg {...ICON}><circle cx="4.5" cy="3.5" r="1.5" /><circle cx="4.5" cy="12.5" r="1.5" /><circle cx="11.5" cy="6" r="1.5" /><path d="M4.5 5v6M11.5 7.5c0 2-3 2-7 3.5" /></svg>,
};
const TEST_IDS: Record<MobilePaneKind, string> = { chat: "mobile-pane-chat", files: "mobile-pane-files", gitReview: "mobile-pane-git" };

export default function MobilePanes({ panes, shown, content, onSelect }: MobilePanesProps) {
  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-panel-bg" data-testid="mobile-pane-shell" aria-label="Mobile workspace pane">
      <div className="mobile-pane-shell__content flex min-h-0 w-full min-w-0 flex-1 overflow-hidden" data-testid={`mobile-active-pane-${shown}`}>
        {content ?? <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Pick a workspace in the switcher.</div>}
      </div>
      <nav className="mobile-pane-nav shrink-0 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" aria-label="Mobile panes">
        <div className={cn(glassClass, "flex gap-0.5 p-0.5")}>
          {panes.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              className={cn(
                ghostButton,
                tapButtonClass,
                "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-[0.15rem] p-0 text-[0.68rem]",
                shown === kind && "bg-surface-1 text-fg hover:bg-surface-1 hover:text-fg",
              )}
              data-testid={TEST_IDS[kind]}
              aria-pressed={shown === kind}
              onClick={() => onSelect(kind)}
            >
              {ICONS[kind]}
              {label}
            </button>
          ))}
        </div>
      </nav>
    </section>
  );
}
