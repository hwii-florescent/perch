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
import { GearIcon } from "./ui/icons";
import { GHOST_BUTTON } from "./ui/icon-button";
import { TAP_BUTTON, glass } from "./ui/glass";
import { useNeedsYouCount } from "../attention";
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
  const needsYou = useNeedsYouCount();

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
    <header className="shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-2 pl-[max(0.5rem,env(safe-area-inset-left))]" data-testid="mobile-header">
      <div className={cn(glass, "flex items-center gap-0.5 p-0.5")}>
      <button
        type="button"
        className={cn(GHOST_BUTTON, TAP_BUTTON, "flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 px-3 text-left")}
        data-testid="mobile-switch"
        aria-label={needsYou ? `Switch session, ${needsYou} ${needsYou === 1 ? "needs" : "need"} you` : "Switch session"}
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
        {needsYou > 0 && <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-[6px] bg-surface-1 px-1 text-[0.68rem] text-fg tabular-nums" data-testid="needs-you-count" aria-hidden="true">{needsYou}</span>}
        <Chevron open />
      </button>
      <button
        type="button"
        className={cn(GHOST_BUTTON, TAP_BUTTON, "grid size-[3.25rem] shrink-0 place-items-center p-0")}
        data-testid="settings-gear"
        title="Settings"
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <GearIcon size={20} />
      </button>
      </div>
    </header>
  );
}
