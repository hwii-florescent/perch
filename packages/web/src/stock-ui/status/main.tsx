//! Status bar, the stock screen `stock:status`: the bottom row of the desktop window (and a layout's
//! `status` block). Left: connection dot, host, folder and branch of the focused session (else the
//! workspace). Middle: zoom (click resets), context tokens and cost of the focused agent. Right: plan
//! usage (`usage.tsx`) and the connection check. A legacy mod can redraw it through the
//! `status-bar` slot.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS
//! the app runs and `perch mod clone stock:status` copies. It may import only `react`, `react-dom`,
//! `@perch/sdk` and files beside it (docs/MOD-SDK.md).
import { cn, ghostButton, isMac, keyLabel, resetZoom, Slot, usePlanUsage, useStatusLine, useZoom } from "@perch/sdk";
import { formatTokens, UsageSummary } from "./usage";

export default function StatusBar() {
  const line = useStatusLine();
  const { usage, updatedAt } = usePlanUsage({ keepFresh: true });
  const zoom = useZoom();
  const { hostId, hostName, sessionId, cwd, branch, contextTokens, costUsd } = line;
  const online = line.connected && (hostId === "local" || line.hostState === "connected");
  const connectionLabel = online ? "Connected" : "Reconnecting…";
  const host = hostId === "local" ? "Local" : hostName ?? hostId;

  const data = { online, host, cwd, branch, sessionId, contextTokens, costUsd, zoom };
  return (
    <Slot name="status-bar" data={data} actions={{ resetZoom }}>
    {/* v4 mock: host, path and branch left; optional session details in the middle;
        Needs You, usage and the connection check right. Identity stays in tabs/sidebar. */}
    <footer className="status-bar box-border flex h-6 shrink-0 items-center gap-3 overflow-hidden px-3 text-[10px] leading-none whitespace-nowrap text-subtext-0 [--radius:var(--radius-pane)]">
      <div className="status-bar__location flex min-w-0 flex-1 items-center gap-[13px] overflow-hidden">
        <span className={cn("size-1 shrink-0 rounded-full", online ? "bg-green" : "bg-yellow")} title={connectionLabel} />
        <span className="max-w-24 shrink-0 truncate" title={`${hostName ?? hostId} · ${connectionLabel}`} data-testid="status-host">{host}</span>
        <span className="status-item--cwd min-w-0 truncate" title={cwd}>{cwd}</span>
        {branch && <span className="status-bar__branch flex min-w-0 max-w-[45%] shrink-0 items-center gap-1.5" title={branch}>
          <svg width="12" height="12" className="shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="6" cy="4" r="2" /><circle cx="14" cy="5" r="2" /><circle cx="6" cy="16" r="2" /><path d="M6 6v8m0-3c8 0 8-2 8-4" /></svg>
          <span className="min-w-0 truncate">{branch}</span>
        </span>}
      </div>
      <div className="status-bar__details flex min-w-0 max-w-[25%] shrink-[2] items-center justify-end gap-3 overflow-hidden max-[900px]:hidden">
        {zoom !== 1 && (
          <button type="button" data-testid="zoom-indicator" className={cn(ghostButton, "px-1 tabular-nums text-fg")} title={`Zoom ${Math.round(zoom * 100)}%. Click to reset (${keyLabel(isMac ? "cmd+0" : "ctrl+0")})`} onClick={resetZoom}>
            {Math.round(zoom * 100)}%
          </button>
        )}
        {contextTokens !== undefined && <span className="shrink-0">ctx {formatTokens(contextTokens)}</span>}
        {costUsd !== undefined && <span className="shrink-0">${costUsd.toFixed(3)}</span>}
      </div>
      <div className="status-bar__usage -ml-2 flex h-5 min-w-0 max-w-[38%] shrink items-center overflow-hidden">
        <UsageSummary usage={usage} updatedAt={updatedAt} />
      </div>
      <span className="shrink-0" role="img" aria-label={connectionLabel} title={`${hostId === "local" ? "Local core" : hostName ?? hostId}: ${connectionLabel}`} data-testid="status-connection">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={online ? "m4 10 4 4 8-8" : "M10 4v7m0 4v1"} /></svg>
      </span>
    </footer>
    </Slot>
  );
}
