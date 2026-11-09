/**
 * MobileHeader.tsx — the phone's one top row (≤700px), replacing the desktop sidebar, tab strip and brand row. The
 * screen is `stock:mobile-header` (`stock-ui/mobile-header/main.tsx`), or the person's copy once turned on for this
 * phone (`phoneMods.ts`); this file gathers what it shows and binds the taps.
 *
 * Mirrors the status bar's synthesized-session fallback: a brand-new session created via `session.create` has no DB
 * row (and so no entry in `sessions[]`) until its first message, but it's still the active session and trivially
 * idle/unblocked/seen.
 */
import type { MobileHeaderProps as Props } from "@perch/sdk";
import { effectiveWorkspace, usePerchStore } from "../store";
import { StatusDot } from "./StatusDot";
import { useNeedsYouCount } from "../attention";
import type { SessionSummary } from "@perch/shared";
import Header from "../stock-ui/mobile-header/main";
import { StockRoute } from "./mod-root";

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

  const cwd = activeSession?.cwd || workspace?.path || (activeHostId === "local" ? status?.cwd : undefined) || "";
  const projectName = workspace?.name || (cwd ? basename(cwd) : "No project");
  const branch = workspace?.branch ?? (activeHostId === "local" ? status?.branch : undefined);
  const props: Props = {
    dot: activeSession ? <StatusDot session={activeSession} className="mobile-header__dot" /> : null,
    sessionId: sessionId ?? null,
    title: activeSession?.title?.trim() || "New session",
    place: `${projectName}${branch ? ` · ${branch}` : ""}`,
    project: projectName,
    branch: branch ?? null,
    cwd,
    connected,
    needsYou,
    onOpenSwitcher,
    onOpenSettings: () => setSettingsOpen(true),
  };
  return <StockRoute name="mobile-header" props={props} stock={Header} />;
}
