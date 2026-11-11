//! Phone switcher, the stock screen `stock:mobile-switcher`: the phone's sidebar, a card sliding over from the left,
//! drawn like the desktop's sidebar card (12px, the card color, a 44px head row, no rules). Its head holds the
//! desktop's sidebar glyph, which closes it; then every host, project, workspace and session (`body`, the sidebar's
//! own list as Perch draws it on a phone); at the foot Settings, the phone's own UI/CLI switch and plan usage (the
//! phone has no status bar). A tap outside the card or the glyph closes it; choosing a session in the list closes it
//! too (Perch's `body` does that), and so does opening Settings.
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). A copy may draw its own list from `useNavigation`/`runCommand` instead of `body`. The slide-in and the
//! dimmed backdrop are the `mobile-drawer*` classes of Perch's stylesheet.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-switcher` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { GearIcon, ModeSwitch, cn, ghostButton, tapButtonClass, type MobileSwitcherProps } from "@perch/sdk";

export default function MobileSwitcher({ body, usage, chatMode, onChatMode, onOpenSettings, onClose }: MobileSwitcherProps) {
  return (
    <div className="mobile-drawer-backdrop fixed inset-0 z-[3000] flex justify-start bg-[rgba(0,0,0,0.5)] pt-[max(0.5rem,env(safe-area-inset-top))] pr-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))]" onClick={onClose}>
      <div
        className="mobile-drawer mobile-drawer--left flex h-full w-[min(22rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-[12px] bg-[var(--card-bg)] [--radius:var(--radius-pane)]"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="box-border flex h-11 shrink-0 items-center px-1">
          <button
            type="button"
            className={cn(ghostButton, tapButtonClass, "grid size-11 shrink-0 place-items-center p-0")}
            data-testid="mobile-switcher-close"
            aria-label="Close sidebar"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M6 2.5v11" /></svg>
          </button>
        </div>

        {body}

        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1">
          <button
            type="button"
            className={cn(ghostButton, tapButtonClass, "flex min-h-11 items-center gap-2 px-3 text-[0.8rem]")}
            data-testid="settings-gear"
            aria-label="Settings"
            onClick={onOpenSettings}
          >
            <GearIcon size={16} />
            Settings
          </button>
          <span className="pr-2"><ModeSwitch mode={chatMode} onChange={onChatMode} testId="mobile-chat-mode" /></span>
        </div>
        <div className="shrink-0 overflow-x-auto px-4 pb-3 text-[0.75rem] whitespace-nowrap text-subtext-0">
          {usage}
        </div>
      </div>
    </div>
  );
}
