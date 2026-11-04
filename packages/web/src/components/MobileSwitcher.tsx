/**
 * MobileSwitcher.tsx — the phone's `<Sidebar/>`: a slide-over around the sidebar's own body
 * (`SidebarContent`: host picker, "New session", projects and sessions), plus plan usage in
 * the footer (the phone has no status bar). Settings is in the header. Choosing a session or
 * workspace closes the panel; `onPicked` fires for that (not on a plain close), so the shell
 * can show the session pane.
 *
 * Follows `SettingsModal.tsx`'s non-portal `position: fixed` overlay pattern
 * (not a portal like `ModelChip`/`Navigator`) since it's a full-panel
 * slide-over rather than an anchored popover.
 */
import { UsageSummary, useUsage } from "../StatusBar";
import { SidebarContent } from "../Sidebar";

export interface MobileSwitcherProps {
  open: boolean;
  onClose: () => void;
  onPicked?: () => void;
}

export function MobileSwitcher({ open, onClose, onPicked }: MobileSwitcherProps) {
  // Mounted for the whole phone session and the status bar is not, so this is the one usage poller there.
  const { usage, usageUpdatedAt } = useUsage();

  if (!open) return null;

  function picked() {
    onClose();
    onPicked?.();
  }

  return (
    <div className="fixed inset-0 z-[3000] flex justify-end bg-[rgba(0,0,0,0.5)]" onClick={onClose}>
      <div
        className="flex h-full w-[min(360px,92vw)] flex-col overflow-hidden border-l border-l-overlay-0 bg-surface-0 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]"
        data-testid="mobile-switcher"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-b-overlay-0 px-[0.9rem] pt-[calc(0.7rem_+_env(safe-area-inset-top))] pb-[0.7rem]">
          <span className="text-[0.95rem] font-semibold text-fg">Sessions</span>
          <button
            type="button"
            className="-my-2 -mr-2 grid size-11 cursor-pointer place-items-center text-[1.3rem] leading-none text-subtext-0 [background:none] [border:none] hover:text-fg"
            data-testid="mobile-switcher-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <SidebarContent compact onNavigate={picked} onManageHosts={onClose} />

        <div className="shrink-0 overflow-x-auto border-t border-t-overlay-0 px-[0.9rem] pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] text-[0.78rem] whitespace-nowrap text-subtext-0">
          <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />
        </div>
      </div>
    </div>
  );
}
