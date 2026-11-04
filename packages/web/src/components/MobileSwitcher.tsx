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
import { CloseIcon } from "./ui/icons";

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

        <SidebarContent compact onNavigate={picked} onManageHosts={onClose} />

        <div className="shrink-0 overflow-x-auto px-[0.9rem] py-2 text-[0.78rem] whitespace-nowrap text-subtext-0">
          <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />
        </div>
      </div>
    </div>
  );
}
