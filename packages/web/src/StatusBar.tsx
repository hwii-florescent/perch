import { usePerchStore } from "./store";
import { cn } from "./lib/cn";
import { StatusDot } from "./components/StatusDot";
import type { SessionSummary } from "@perch/shared";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StatusBar() {
  const connected = usePerchStore((s) => s.connected);
  const status = usePerchStore((s) => s.status);
  const sessionId = usePerchStore((s) => s.sessionId);
  const knownSession = usePerchStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  // A session created via session.create has no DB row (and so no entry in
  // `sessions[]`) until its first message — but it's still the "active"
  // session and, being brand new, is trivially idle/unblocked/seen. Synthesize
  // a minimal summary so the dot renders correctly from the moment a session
  // is created, not just once it's persisted.
  const activeSession: SessionSummary | undefined =
    knownSession ??
    (sessionId
      ? { id: sessionId, title: "", cwd: "", createdAt: 0, status: "idle" }
      : undefined);

  return (
    <footer className="status-bar flex shrink-0 items-center gap-3 overflow-x-auto border-t border-t-overlay-0 bg-surface-0 px-3 pt-[0.4rem] pb-[calc(0.4rem+env(safe-area-inset-bottom))] text-[0.78rem] whitespace-nowrap text-subtext-0">
      <span
        className={cn("size-2 shrink-0 rounded-[50%]", connected ? "bg-accent" : "bg-red")}
        title={connected ? "connected" : "reconnecting..."}
      />
      {activeSession && <StatusDot session={activeSession} />}
      <span className="status-item--cwd min-w-0 flex-1 overflow-hidden text-ellipsis" title={status?.cwd}>
        {status?.cwd ?? "-"}
      </span>
      <span>{status?.branch ?? ""}</span>
      {/* Only Hosted turns report these; a CLI session would show "- -". */}
      {status?.contextTokens !== undefined && <span>ctx {formatTokens(status.contextTokens)}</span>}
      {status?.costUsd !== undefined && <span>${status.costUsd.toFixed(3)}</span>}
    </footer>
  );
}
