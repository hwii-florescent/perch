//! Phone panes, the stock screen `stock:mobile-panes`: the phone's canvas. The session (`session`: the agent's own
//! terminal or chat) fills the main card and stays mounted. The header's drawer button opens a card over it from the
//! right, drawn like the desktop's drawer card (12px, the card color, a 44px head row, no rules): Files and Git (Git
//! only for a git checkout) as the desktop's own switch, the desktop's drawer glyph to close it, and `content` below
//! (Perch's Files explorer or the review). A tap outside the card closes it too. There is no bottom bar: the agent gets
//! the full height.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). Choosing a tab and closing are Perch's (`onSelect`: "chat" closes the drawer, dropping a stale Files/Git
//! request and uncovering the session). The slide-in and the dimmed backdrop are the `mobile-drawer*` classes of
//! Perch's stylesheet.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-panes` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { cn, ghostButton, segmentClass, tapButtonClass, type MobilePanesProps } from "@perch/sdk";

const TEST_IDS = { chat: "mobile-pane-chat", files: "mobile-pane-files", gitReview: "mobile-pane-git" } as const;

export default function MobilePanes({ panes, shown, session, content, onSelect }: MobilePanesProps) {
  const tools = panes.filter(({ kind }) => kind !== "chat");
  const open = shown !== "chat";
  return (
    <section className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col" data-testid="mobile-pane-shell" aria-label="Mobile workspace">
      <div className="mobile-pane-shell__content flex min-h-0 w-full min-w-0 flex-1 overflow-hidden" data-testid="mobile-active-pane-chat">
        {session}
      </div>
      {open && (
        <div
          className="mobile-drawer-backdrop fixed inset-0 z-[2000] flex justify-end bg-[rgba(0,0,0,0.5)] pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-2"
          onClick={() => onSelect("chat")}
        >
          <aside
            className="mobile-drawer mobile-drawer--right flex h-full w-[min(28rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)] [--radius:var(--radius-pane)]"
            data-testid="mobile-tools-drawer"
            aria-label="Files and Git"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="box-border flex h-11 shrink-0 items-center justify-between gap-2 px-2">
              <nav className="flex items-center gap-[2px]" aria-label="Files and Git" role="tablist">
                {tools.map(({ kind, label }) => (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    // The desktop's tab (`h-7`), with the hit area grown to the 44px a thumb needs.
                    className={cn(segmentClass({ active: shown === kind }), "relative h-7 self-center rounded-ui px-[0.8rem] text-[0.75rem] after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']")}
                    data-testid={TEST_IDS[kind]}
                    aria-selected={shown === kind}
                    onClick={() => onSelect(kind)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <button
                type="button"
                className={cn(ghostButton, tapButtonClass, "grid size-11 shrink-0 place-items-center p-0")}
                data-testid="mobile-tools-close"
                aria-label="Close Files and Git"
                onClick={() => onSelect("chat")}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M10 2.5v11" /></svg>
              </button>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-testid={`mobile-active-pane-${shown}`}>
              {content ?? <div className="grid flex-1 place-items-center p-6 text-center text-[0.78rem] text-subtext-0">Pick a workspace in the sidebar.</div>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
