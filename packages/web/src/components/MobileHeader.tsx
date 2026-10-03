/**
 * MobileHeader.tsx — Phase 5 narrow-width (≤700px) replacement for the
 * desktop `<Sidebar/>`+`<TabBar/>` chrome (herdr §5.14 parity). Two rows:
 * top row is the active session's `StatusDot` + title + a right-aligned
 * "Switch" button that opens `<MobileSwitcher/>`; bottom row is the active
 * project's (workspace's) name.
 *
 * Mirrors `StatusBar.tsx`'s synthesized-session fallback: a brand-new
 * session created via `session.create` has no DB row (and so no entry in
 * `sessions[]`) until its first message (Fix 3's lazy insert), but it's
 * still the active session and trivially idle/unblocked/seen.
 */
import { usePerchStore } from "../store";
import { StatusDot } from "./StatusDot";
import type { SessionSummary } from "@perch/shared";

function basename(cwd: string): string {
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || cwd;
}

export interface MobileHeaderProps {
  onOpenSwitcher: () => void;
}

export function MobileHeader({ onOpenSwitcher }: MobileHeaderProps) {
  const sessionId = usePerchStore((s) => s.sessionId);
  // Settings used to live only in the desktop `<Sidebar/>`, which this header
  // replaces below 700px — so chat mode, themes, agents, hosts and paired
  // devices were unreachable from a phone. Same testid as the desktop control:
  // it opens the same modal.
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const knownSession = usePerchStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const status = usePerchStore((s) => s.status);
  const activeHostId = usePerchStore((s) => s.activeHostId);

  const activeSession: SessionSummary | undefined =
    knownSession ??
    (sessionId
      ? { id: sessionId, title: "", cwd: "", createdAt: 0, status: "idle" }
      : undefined);

  const title = activeSession?.title?.trim() || "New session";
  const cwd = activeSession?.cwd || (activeHostId === "local" ? status?.cwd : undefined) || "";
  const projectName = cwd ? basename(cwd) : "No project";

  return (
    <header className="flex shrink-0 flex-col gap-[0.15rem] border-b border-b-overlay-0 bg-surface-0 px-[0.6rem] pt-[calc(0.4rem_+_env(safe-area-inset-top))] pb-[0.4rem]" data-testid="mobile-header">
      <div className="flex items-center gap-[0.4rem]">
        {activeSession && <StatusDot session={activeSession} className="mobile-header__dot" />}
        <span className="min-w-0 flex-1 overflow-hidden text-[0.95rem] font-semibold text-ellipsis whitespace-nowrap text-fg">{title}</span>
        <button
          type="button"
          className="ml-auto min-h-[2.75rem] min-w-[2.75rem] cursor-pointer rounded-ui border border-transparent text-[1rem] text-subtext-0 [background:none] hover:border-overlay-0 hover:text-fg focus-visible:border-overlay-0 focus-visible:text-fg"
          data-testid="settings-gear"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
        <button
          type="button"
          className="ml-[0.4rem] min-h-[44px] shrink-0 cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.7rem] py-[0.3rem] text-[0.8rem] text-fg [font-family:inherit] hover:border-accent"
          data-testid="mobile-switch"
          onClick={onOpenSwitcher}
        >
          Switch
        </button>
      </div>
      <div className="pl-[calc(0.9rem_+_0.4rem)]">
        <span className="block overflow-hidden text-[0.75rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
          {projectName}
        </span>
      </div>
    </header>
  );
}
