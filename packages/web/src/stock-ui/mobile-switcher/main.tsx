//! Phone switcher, the stock screen `stock:mobile-switcher`: the phone's sidebar, a slide-over from the right with
//! every host, project, workspace and session (`body`, the sidebar's own list as Perch draws it on a phone) and plan
//! usage at the foot (the phone has no status bar). A tap outside the panel or the × closes it; choosing a session in
//! the list closes it too (Perch's `body` does that).
//!
//! A phone screen: drawn only on a phone, and a person's copy runs there only once turned on for that phone (Settings
//! > Mods). A copy may draw its own list from `useNavigation`/`runCommand` instead of `body`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:mobile-switcher` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { CloseIcon, type MobileSwitcherProps } from "@perch/sdk";

export default function MobileSwitcher({ body, usage, onClose }: MobileSwitcherProps) {
  return (
    <div className="fixed inset-0 z-[3000] flex justify-end bg-[rgba(0,0,0,0.5)] pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-2" onClick={onClose}>
      <div
        className="flex h-full w-[min(360px,92vw)] flex-col overflow-hidden rounded-soft bg-surface-0 [--radius:var(--radius-pane)] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-[0.9rem] py-[0.7rem]">
          <span className="text-[0.95rem] font-semibold text-fg">Sessions</span>
          <button
            type="button"
            className="-my-2 -mr-2 grid size-11 cursor-pointer place-items-center rounded-ui leading-none text-subtext-0 [background:none] hover:bg-surface-1 hover:text-fg"
            data-testid="mobile-switcher-close"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {body}

        <div className="shrink-0 overflow-x-auto px-[0.9rem] py-2 text-[0.78rem] whitespace-nowrap text-subtext-0">
          {usage}
        </div>
      </div>
    </div>
  );
}
