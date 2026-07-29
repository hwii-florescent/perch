import { usePerchStore } from "./store";
import { StatusDot } from "./components/StatusDot";
import type { SessionSummary } from "@perch/shared";

function formatTokens(n: number | undefined): string {
  if (n === undefined) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number | undefined): string {
  if (n === undefined) return "-";
  return `$${n.toFixed(3)}`;
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
    <footer className="status-bar">
      <span
        className={connected ? "status-dot status-dot--ok" : "status-dot status-dot--off"}
        title={connected ? "connected" : "reconnecting..."}
      />
      {activeSession && <StatusDot session={activeSession} />}
      <span className="status-item status-item--cwd" title={status?.cwd}>
        {status?.cwd ?? "-"}
      </span>
      <span className="status-item">{status?.branch ?? ""}</span>
      <span className="status-item">ctx {formatTokens(status?.contextTokens)}</span>
      <span className="status-item">{formatCost(status?.costUsd)}</span>
    </footer>
  );
}
