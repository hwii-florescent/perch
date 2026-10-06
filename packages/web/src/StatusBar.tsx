import { Fragment, useEffect } from "react";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import { cn } from "./lib/cn";
import { StatusDot } from "./components/StatusDot";
import type { AccountUsage, SessionSummary, UsageWindow } from "@perch/shared";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function usageTone(pct: number): string {
  return pct >= 90 ? "text-red" : pct >= 70 ? "text-yellow" : "";
}

function resetTitle(w: UsageWindow): string {
  if (w.resetsAt === undefined) return "";
  const at = new Date(typeof w.resetsAt === "number" ? w.resetsAt * 1000 : w.resetsAt);
  return isNaN(at.getTime()) ? "" : ` · resets ${at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

/** Plan usage per account: `claude 5h 54% 7d 0%`, coloured as a window
 * fills. The account label shows only when a provider has several. */
function UsageSummary({ usage }: { usage: AccountUsage[] }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5" data-testid="usage-summary">
      {usage.map((a, i) => {
        const several = usage.filter((o) => o.provider === a.provider).length > 1;
        const name = several && a.label ? `${a.provider} ${a.label}` : a.provider;
        return (
          <Fragment key={`${a.provider}:${a.label ?? i}`}>
            {i > 0 && <span aria-hidden className="h-3 w-px shrink-0 bg-overlay-0" />}
            <span className="flex gap-1.5">
              <span className="font-medium" title={a.label}>{name}</span>
              {a.windows.map((w) => (
                <span
                  key={w.label}
                  className={usageTone(w.usedPercent)}
                  title={`${name} ${w.label} window: ${Math.round(w.usedPercent)}% used${resetTitle(w)}`}
                >
                  {w.label} {Math.round(w.usedPercent)}%
                </span>
              ))}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

export function StatusBar() {
  const connected = usePerchStore((s) => s.connected);
  const usage = usePerchStore((s) => s.usage);
  // The server caches for 3 min (usage.rs); ask on connect, then at that pace.
  useEffect(() => {
    if (!connected) return;
    const ask = () => socket.send({ type: "usage.get" });
    ask();
    const id = setInterval(ask, 180_000);
    return () => clearInterval(id);
  }, [connected]);
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
      {/* Two equal flex-basis-0 sides keep the usage block centred. */}
      <span className="status-item--cwd min-w-0 flex-1 basis-0 overflow-hidden text-ellipsis" title={status?.cwd}>
        {status?.cwd ?? "-"}
      </span>
      {usage.length > 0 && <UsageSummary usage={usage} />}
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-3">
        <span>{status?.branch ?? ""}</span>
        {/* Only Hosted turns report these; a CLI session would show "- -". */}
        {status?.contextTokens !== undefined && <span>ctx {formatTokens(status.contextTokens)}</span>}
        {status?.costUsd !== undefined && <span>${status.costUsd.toFixed(3)}</span>}
      </div>
    </footer>
  );
}
