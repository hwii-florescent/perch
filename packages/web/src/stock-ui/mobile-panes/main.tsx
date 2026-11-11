//! Phone panes, the stock screen `stock:mobile-panes`: the phone's canvas. The session (`session`: the agent's own
//! terminal or chat) fills the screen and stays mounted. The tools button in the header opens a drawer from the right
//! over it with the workspace's Files and Git (Git only for a git checkout): tabs at its top, `content` below (Perch's
//! Files explorer or the review), and a × and a tap outside to close it. There is no bottom bar: the agent gets the
//! full height.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). Choosing a tab and closing are Perch's (`onSelect`: "chat" closes the drawer, dropping a stale Files/Git
//! request and uncovering the session).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-panes` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { CloseIcon, cn, ghostButton, tapButtonClass, type MobilePanesProps } from "@perch/sdk";

const TEST_IDS = { chat: "mobile-pane-chat", files: "mobile-pane-files", gitReview: "mobile-pane-git" } as const;

export default function MobilePanes({ panes, shown, session, content, onSelect }: MobilePanesProps) {
  const tools = panes.filter(({ kind }) => kind !== "chat");
  const open = shown !== "chat";
  return (
    <section className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-panel-bg" data-testid="mobile-pane-shell" aria-label="Mobile workspace">
      <div className="mobile-pane-shell__content flex min-h-0 w-full min-w-0 flex-1 overflow-hidden" data-testid="mobile-active-pane-chat">
        {session}
      </div>
      {open && (
        <div
          className="mobile-drawer-backdrop fixed inset-0 z-[2000] flex justify-end bg-[rgba(0,0,0,0.5)] pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-2"
          onClick={() => onSelect("chat")}
        >
          <aside
            className="mobile-drawer mobile-drawer--right flex h-full w-[min(28rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-soft bg-surface-0 [--radius:var(--radius-pane)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            data-testid="mobile-tools-drawer"
            aria-label="Files and Git"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-1 px-2 py-1" role="tablist" aria-label="Workspace tools">
              {tools.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  className={cn(
                    ghostButton,
                    tapButtonClass,
                    "min-h-11 px-3 text-[0.9rem]",
                    shown === kind && "bg-surface-1 text-fg hover:bg-surface-1 hover:text-fg",
                  )}
                  data-testid={TEST_IDS[kind]}
                  aria-selected={shown === kind}
                  onClick={() => onSelect(kind)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={cn(ghostButton, tapButtonClass, "ml-auto grid size-11 place-items-center p-0")}
                data-testid="mobile-tools-close"
                aria-label="Close"
                onClick={() => onSelect("chat")}
              >
                <CloseIcon size={16} />
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
