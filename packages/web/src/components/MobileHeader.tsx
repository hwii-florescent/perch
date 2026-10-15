/**
 * MobileHeader.tsx — the phone's one top row (≤700px), replacing the desktop
 * `<Sidebar/>`+`<TabBar/>`+brand row. Left: the active session (status ring,
 * title, and `project · branch` under it); tapping it opens `<MobileSwitcher/>`
 * (every project, workspace and session). Right: Settings. The connection
 * state shows only when it needs attention, in place of the branch.
 *
 * Mirrors `StatusBar.tsx`'s synthesized-session fallback: a brand-new
 * session created via `session.create` has no DB row (and so no entry in
 * `sessions[]`) until its first message, but it's still the active session
 * and trivially idle/unblocked/seen.
 */
import { effectiveWorkspace, usePerchStore } from "../store";
import { cn } from "../lib/cn";
import { StatusDot } from "./StatusDot";
import { Chevron } from "./ui/chevron";
import { GHOST_BUTTON } from "./ui/icon-button";
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
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const knownSession = usePerchStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const workspace = usePerchStore(effectiveWorkspace);
  const status = usePerchStore((s) => s.status);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const connected = usePerchStore((s) => s.connected);

  const activeSession: SessionSummary | undefined =
    knownSession ??
    (sessionId
      ? { id: sessionId, title: "", cwd: "", createdAt: 0, status: "idle" }
      : undefined);

  const title = activeSession?.title?.trim() || "New session";
  const cwd = activeSession?.cwd || workspace?.path || (activeHostId === "local" ? status?.cwd : undefined) || "";
  const projectName = workspace?.name || (cwd ? basename(cwd) : "No project");
  const branch = workspace?.branch ?? (activeHostId === "local" ? status?.branch : undefined);

  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-b-overlay-0 bg-surface-0 pt-[env(safe-area-inset-top)] pr-[max(0.4rem,env(safe-area-inset-right))] pl-[max(0.4rem,env(safe-area-inset-left))]" data-testid="mobile-header">
      <button
        type="button"
        className={cn(GHOST_BUTTON, "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-[0.55rem] px-[0.4rem] text-left")}
        data-testid="mobile-switch"
        aria-label="Switch session"
        onClick={onOpenSwitcher}
      >
        {activeSession && <StatusDot session={activeSession} className="mobile-header__dot" />}
        <span className="grid min-w-0 flex-1 gap-[0.1rem]">
          <span className="overflow-hidden text-[0.95rem] font-semibold text-ellipsis whitespace-nowrap text-fg">{title}</span>
          <span className="overflow-hidden text-[0.75rem] text-ellipsis whitespace-nowrap text-subtext-0" title={cwd}>
            {!connected
              ? <span className="text-red" role="status">Reconnecting…</span>
              : <>{projectName}{branch ? ` · ${branch}` : ""}</>}
          </span>
        </span>
        <Chevron open />
      </button>
      <button
        type="button"
        className={cn(GHOST_BUTTON, "grid size-11 shrink-0 place-items-center p-0 text-[1.1rem]")}
        data-testid="settings-gear"
        title="Settings"
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        ⚙
      </button>
    </header>
  );
}
