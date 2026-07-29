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
    <header className="mobile-header" data-testid="mobile-header">
      <div className="mobile-header__row mobile-header__row--top">
        {activeSession && <StatusDot session={activeSession} className="mobile-header__dot" />}
        <span className="mobile-header__title">{title}</span>
        <button
          type="button"
          className="mobile-header__switch"
          data-testid="mobile-switch"
          onClick={onOpenSwitcher}
        >
          Switch
        </button>
      </div>
      <div className="mobile-header__row mobile-header__row--bottom">
        <span className="mobile-header__project" title={cwd}>
          {projectName}
        </span>
      </div>
    </header>
  );
}
