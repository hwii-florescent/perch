import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import { cn } from "./lib/cn";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "./components/popoverPosition";
import { GHOST_BUTTON } from "./components/ui/icon-button";
import { menuPanel } from "./components/ui/menu";
import { NeedsYouButton } from "./components/NeedsYou";
import { useZoom, zoomReset } from "./zoom";
import { IS_MAC, formatCombo } from "./keyCombo";
import type { AccountUsage, UsageWindow } from "@perch/shared";

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
export function UsageSummary({
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
        className={cn(GHOST_BUTTON, "flex min-w-0 items-center gap-3 p-0 text-[9px] focus-visible:[outline:1px_solid_var(--overlay-1)]")}
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
          const provider = account.provider === "claude" ? "Claude" : account.provider === "codex" ? "Codex" : account.provider;
          const name = several && account.label ? `${provider} ${account.label}` : provider;
          return (
            <span key={`${account.provider}:${account.label ?? i}`} className="flex items-center gap-1.5 text-[9px]">
              <span>{name}</span>
              {account.windows.map((w, index) => (
                <span key={w.label} className={cn("tabular-nums", index === 0 && "text-fg", usageTone(w.usedPercent))}>
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
          className={cn(menuPanel, "fixed z-[3100] w-[min(340px,calc(100vw-16px))] overflow-y-auto p-3 text-fg")}
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
              className={cn(GHOST_BUTTON, "px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]")}
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

/** Plan usage from the store, kept fresh while the caller is mounted. */
export function useUsage() {
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
  return { usage, usageUpdatedAt };
}

export function StatusBar() {
  const connected = usePerchStore((s) => s.connected);
  const { usage, usageUpdatedAt } = useUsage();
  const zoom = useZoom();
  const status = usePerchStore((s) => s.status);
  const sessionId = usePerchStore((s) => s.sessionId);
  const knownSession = usePerchStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hostId = knownSession?.hostId ?? activeHostId;
  const host = usePerchStore((s) => s.hosts.find((h) => h.id === hostId));
  const hostState = usePerchStore((s) => s.hostStates[hostId]?.state);
  const workspace = usePerchStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const online = connected && (hostId === "local" || hostState === "connected");
  const connectionLabel = online ? "Connected" : "Reconnecting…";
  const cwd = status?.cwd || knownSession?.cwd || workspace?.path || "";
  const branch = status?.branch ?? workspace?.branch;

  return (
    // v4 mock: host, path and branch left; optional session details in the middle;
    // Needs You, usage and the connection check right. Identity stays in tabs/sidebar.
    <footer className="status-bar box-border flex h-[26px] shrink-0 items-center gap-3 overflow-hidden px-3 text-[10px] whitespace-nowrap text-subtext-0 [--radius:var(--radius-pane)]">
      <div className="status-bar__location flex min-w-0 flex-1 items-center gap-[13px] overflow-hidden">
        <span className={cn("size-1 shrink-0 rounded-full", online ? "bg-green" : "bg-yellow")} title={connectionLabel} />
        <span className="max-w-24 shrink-0 truncate" title={`${host?.name ?? hostId} · ${connectionLabel}`} data-testid="status-host">{hostId === "local" ? "Local" : host?.name ?? hostId}</span>
        <span className="status-item--cwd min-w-0 truncate" title={cwd}>{cwd}</span>
        {branch && <span className="status-bar__branch flex min-w-0 max-w-[45%] shrink-0 items-center gap-1.5" title={branch}>
          <svg width="12" height="12" className="shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="6" cy="4" r="2" /><circle cx="14" cy="5" r="2" /><circle cx="6" cy="16" r="2" /><path d="M6 6v8m0-3c8 0 8-2 8-4" /></svg>
          <span className="min-w-0 truncate">{branch}</span>
        </span>}
      </div>
      <div className="status-bar__details flex min-w-0 max-w-[25%] shrink-[2] items-center justify-end gap-3 overflow-hidden max-[900px]:hidden">
        {zoom !== 1 && (
          <button type="button" data-testid="zoom-indicator" className={cn(GHOST_BUTTON, "px-1 tabular-nums text-fg")} title={`Zoom ${Math.round(zoom * 100)}%. Click to reset (${formatCombo(IS_MAC ? "cmd+0" : "ctrl+0")})`} onClick={zoomReset}>
            {Math.round(zoom * 100)}%
          </button>
        )}
        {status?.contextTokens !== undefined && <span className="shrink-0">ctx {formatTokens(status.contextTokens)}</span>}
        {status?.costUsd !== undefined && <span className="shrink-0">${status.costUsd.toFixed(3)}</span>}
      </div>
      <NeedsYouButton variant="status" className="inline-flex h-6 w-[7.75rem] shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-ui bg-surface-0 px-2 text-[11px] text-fg [border:0] [font-family:inherit] hover:bg-surface-1 aria-expanded:bg-surface-1" />
      <div className="status-bar__usage min-w-0 max-w-[38%] shrink overflow-hidden">
        <UsageSummary usage={usage} updatedAt={usageUpdatedAt} />
      </div>
      <span className="shrink-0" role="img" aria-label={connectionLabel} title={`${hostId === "local" ? "Local core" : host?.name ?? hostId}: ${connectionLabel}`} data-testid="status-connection">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={online ? "m4 10 4 4 8-8" : "M10 4v7m0 4v1"} /></svg>
      </span>
    </footer>
  );
}
