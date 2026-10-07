import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import { cn } from "./lib/cn";
import { StatusDot } from "./components/StatusDot";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "./components/popoverPosition";
import type { AccountUsage, SessionSummary, UsageWindow } from "@perch/shared";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function usageTone(pct: number): string {
  return pct >= 90 ? "text-red" : pct >= 70 ? "text-yellow" : "";
}

function resetTitle(w: UsageWindow): string {
  if (w.resetsAt === undefined) return "Reset time unavailable";
  const at = new Date(typeof w.resetsAt === "number" ? w.resetsAt * 1000 : w.resetsAt);
  return isNaN(at.getTime()) ? "Reset time unavailable" : at.toLocaleString();
}

/** One clickable status-bar block opens all provider windows and reset times. */
function UsageSummary({
  usage,
  updatedAt,
}: {
  usage: AccountUsage[];
  updatedAt: number;
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const previousUpdatedAt = useRef(updatedAt);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(open, setOpen, buttonRef, popoverRef);
  useEffect(() => {
    if (open) popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);

  useEffect(() => {
    if (updatedAt !== previousUpdatedAt.current && refreshing) {
      setRefreshing(false);
      setRefreshNotice("Plan usage refreshed.");
    }
    previousUpdatedAt.current = updatedAt;
  }, [updatedAt, refreshing]);
  useEffect(() => {
    if (!refreshing) return;
    const timeout = window.setTimeout(() => setRefreshing(false), 30_000);
    return () => window.clearTimeout(timeout);
  }, [refreshing]);

  const accountCount = (provider: string) => usage.filter((item) => item.provider === provider).length;
  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not refreshed yet";

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        data-testid="usage-summary"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="usage-details-popover"
        className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-sm bg-transparent p-0 text-subtext-0 hover:text-fg focus-visible:[outline:1px_solid_var(--overlay-1)]"
        title="Open plan usage details"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          if (buttonRef.current) {
            setPopoverStyle(computeAnchoredPopoverStyle(buttonRef.current, { minWidth: 300, align: "right" }));
          }
          setOpen(true);
        }}
      >
        {usage.length === 0 ? (
          <span>Usage unavailable</span>
        ) : usage.map((account, i) => {
          const several = accountCount(account.provider) > 1;
          const name = several && account.label ? `${account.provider} ${account.label}` : account.provider;
          return (
            <span key={`${account.provider}:${account.label ?? i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="h-3 w-px shrink-0 bg-overlay-0" />}
              <span className="font-medium">{name}</span>
              {account.windows.map((w) => (
                <span key={w.label} className={cn("tabular-nums", usageTone(w.usedPercent))}>
                  {w.label} {Math.round(w.usedPercent)}%
                </span>
              ))}
            </span>
          );
        })}
      </button>
      {open && createPortal(
        <div
          id="usage-details-popover"
          ref={popoverRef}
          role="dialog"
          aria-label="Plan usage details"
          data-testid="usage-details"
          className="fixed z-[2100] w-[min(340px,calc(100vw-16px))] overflow-y-auto rounded-ui bg-surface-1 p-3 text-fg shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={popoverStyle}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              buttonRef.current?.focus();
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[0.85rem] font-semibold">Plan usage</h2>
            <button
              type="button"
              data-testid="usage-refresh"
              disabled={refreshing}
              aria-busy={refreshing}
              className="rounded-sm px-2 py-1 text-[0.78rem] text-fg hover:bg-overlay-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]"
              onClick={() => {
                setRefreshing(true);
                setRefreshNotice("");
                socket.send({ type: "usage.get", force: true });
              }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="mb-3 text-[0.72rem] text-subtext-0" data-testid="usage-updated">
            Last fetched {updatedText}
          </p>
          <span className="sr-only" role="status" aria-live="polite">{refreshNotice}</span>
          {usage.length === 0 ? (
            <p className="mb-1 text-[0.8rem] text-subtext-0" data-testid="usage-empty">
              No usage available. Check Claude Code&apos;s sign-in, then refresh.
            </p>
          ) : (
            <div className="grid gap-3">
              {usage.map((account, i) => {
                const several = accountCount(account.provider) > 1;
                const name = several && account.label ? `${account.provider} ${account.label}` : account.provider;
                return (
                  <section key={`${account.provider}:${account.label ?? i}`} className="grid gap-1.5">
                    <h3 className="m-0 text-[0.78rem] font-medium">{name}</h3>
                    {account.error && <p className="m-0 text-[0.78rem] text-red" role="status">{account.error}</p>}
                    {account.windows.map((w) => (
                      <div key={w.label} className="flex items-baseline justify-between gap-3 text-[0.78rem]">
                        <span className="text-subtext-0">{w.label} window</span>
                        <span className="text-right tabular-nums">
                          <span className={usageTone(w.usedPercent)}>{Math.round(w.usedPercent)}% used</span>
                          <span className="ml-2 text-subtext-0">Resets {resetTitle(w)}</span>
                        </span>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export function StatusBar() {
  const connected = usePerchStore((s) => s.connected);
  const usage = usePerchStore((s) => s.usage);
  const usageUpdatedAt = usePerchStore((s) => s.usageUpdatedAt);
  // The server caches for 3 min; ask on connect, then at that pace.
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
  // A session created via session.create has no DB row until its first message.
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
      <span className="status-item--cwd min-w-0 flex-1 basis-0 overflow-hidden text-ellipsis" title={status?.cwd}>
        {status?.cwd ?? "-"}
      </span>
      <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-3">
        <span>{status?.branch ?? ""}</span>
        {status?.contextTokens !== undefined && <span>ctx {formatTokens(status.contextTokens)}</span>}
        {status?.costUsd !== undefined && <span>${status.costUsd.toFixed(3)}</span>}
      </div>
    </footer>
  );
}
