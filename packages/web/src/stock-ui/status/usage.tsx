//! Plan usage, the status bar's right block: one button lists every provider window's use and opens
//! the details (each window's reset time, banked Codex resets with a confirm, 1/7/30-day spend, top
//! models, the Claude 5h block and burn rate). Refresh asks the core once and waits for a newer
//! `updatedAt`, giving up after 30 s; a reset is sent once and its result is matched by account id.
//! The phone's switcher shows the same block.
//!
//! Part of the stock screen `stock:status`; imports only React and `@perch/sdk` (docs/MOD-SDK.md).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  anchoredPopoverStyle, cn, ghostButton, menuPanel, redeemUsageReset, refreshUsage, useDismissOnOutsideClick, usePlanUsage,
  type AccountUsage, type UsageWindow,
} from "@perch/sdk";

export function formatTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Two decimals; whole dollars from $100 up. */
function formatUsd(n: number): string {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

function usageTone(pct: number): string {
  return pct >= 90 ? "text-red" : pct >= 70 ? "text-yellow" : "";
}

function providerName(provider: string): string {
  return provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : provider;
}

const REDEEM_TEXT: Record<string, string> = {
  reset: "Limits reset.",
  nothingToReset: "Nothing to reset; no credit spent.",
  noCredit: "No banked reset available.",
  alreadyRedeemed: "That reset was already used.",
};

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
  const { spend, redeemResult } = usePlanUsage();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemNotice, setRedeemNotice] = useState<{ accountId: string; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
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
    if (!redeeming || redeemResult?.accountId !== redeeming) return;
    setRedeeming(null);
    const known = REDEEM_TEXT[redeemResult.outcome];
    setRedeemNotice({ accountId: redeeming, text: known ?? redeemResult.message ?? "Could not reach Codex. Try again." });
    if (known) refreshUsage();
  }, [redeemResult, redeeming]);
  useEffect(() => {
    if (!refreshing) return;
    const timeout = window.setTimeout(() => setRefreshing(false), 30_000);
    return () => window.clearTimeout(timeout);
  }, [refreshing]);

  const accountCount = (provider: string) => usage.filter((item) => item.provider === provider).length;
  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not refreshed yet";
  const month = spend?.periods.find((p) => p.days === 30);
  const topModels = month?.models.slice(0, 3) ?? [];

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        data-testid="usage-summary"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="usage-details-popover"
        className={cn(ghostButton, "flex h-5 min-w-0 items-center gap-3 px-1.5 py-0 text-[9px] leading-none focus-visible:[outline:1px_solid_var(--overlay-1)]")}
        title="Open plan usage details"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          if (buttonRef.current) {
            setPopoverStyle(anchoredPopoverStyle(buttonRef.current, { minWidth: 300, align: "right" }));
          }
          setOpen(true);
        }}
      >
        {usage.length === 0 ? (
          <span>Usage unavailable</span>
        ) : usage.map((account, i) => {
          const several = accountCount(account.provider) > 1;
          const provider = providerName(account.provider);
          const name = several && account.label ? `${provider} ${account.label}` : provider;
          return (
            <span key={`${account.provider}:${account.label ?? i}`} className="flex items-center gap-1.5 text-[9px]">
              <span>{name}</span>
              {account.windows.filter((w) => !w.scope).map((w, index) => (
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
              className={cn(ghostButton, "px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]")}
              onClick={() => {
                setRefreshing(true);
                setRefreshNotice("");
                refreshUsage();
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
                const provider = providerName(account.provider);
                const base = several && account.label ? `${provider} ${account.label}` : provider;
                const name = account.plan ? `${base} ${account.plan}` : base;
                return (
                  <section key={`${account.provider}:${account.label ?? i}`} className="grid gap-1.5">
                    <h3 className="m-0 text-[0.78rem] font-medium">{name}</h3>
                    {account.error && <p className="m-0 text-[0.78rem] text-red" role="status">{account.error}</p>}
                    {account.windows.map((w) => (
                      <div key={`${w.label}:${w.scope ?? ""}`} className="flex items-baseline justify-between gap-3 text-[0.78rem]">
                        <span className="text-subtext-0">{w.label} {w.scope ? `${w.scope} ` : ""}window</span>
                        <span className="text-right tabular-nums">
                          <span className={usageTone(w.usedPercent)}>{Math.round(w.usedPercent)}% used</span>
                          <span className="ml-2 text-subtext-0">Resets {resetTitle(w)}</span>
                        </span>
                      </div>
                    ))}
                    {(() => {
                      const share = account.planMonthlyUsd !== undefined && accountCount(account.provider) === 1
                        ? month?.providers.find((s) => s.name === account.provider)
                        : undefined;
                      return share && (
                        <p className="m-0 text-[0.72rem] text-subtext-0" data-testid="usage-plan-value">
                          30 days: {formatUsd(share.costUsd)} API-equivalent on a ${account.planMonthlyUsd}/mo plan
                        </p>
                      );
                    })()}
                    {account.resetCredits !== undefined && (
                      <p className="m-0 text-[0.72rem] text-subtext-0" data-testid="usage-reset-credits">
                        {account.resetCredits} rate-limit {account.resetCredits === 1 ? "reset" : "resets"} banked
                      </p>
                    )}
                    {(() => {
                      const id = account.accountId;
                      const credits = account.resetCredits ?? 0;
                      if (!id) return null;
                      return (
                        <>
                          {credits === 0 ? null : confirming === id ? (
                            <div className="grid gap-1.5">
                              <p className="m-0 text-[0.72rem]">
                                Reset this Codex account&apos;s 5h and weekly limits now? This spends 1 of {credits} banked {credits === 1 ? "reset" : "resets"}.
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  data-testid="usage-redeem-confirm"
                                  className={cn(ghostButton, "px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 focus-visible:[outline:1px_solid_var(--overlay-1)]")}
                                  onClick={() => {
                                    setConfirming(null);
                                    setRedeeming(id);
                                    redeemUsageReset(id);
                                  }}
                                >
                                  Reset limits
                                </button>
                                <button
                                  type="button"
                                  className={cn(ghostButton, "px-2 py-1 text-[0.78rem] text-subtext-0 hover:bg-surface-0 focus-visible:[outline:1px_solid_var(--overlay-1)]")}
                                  onClick={() => setConfirming(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-testid="usage-redeem-reset"
                              disabled={redeeming === id}
                              aria-busy={redeeming === id}
                              className={cn(ghostButton, "justify-self-start px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]")}
                              onClick={() => {
                                setRedeemNotice(null);
                                setConfirming(id);
                              }}
                            >
                              {redeeming === id ? "Resetting…" : "Use one"}
                            </button>
                          )}
                          {redeemNotice?.accountId === id && (
                            <p className="m-0 text-[0.72rem]" role="status" data-testid="usage-redeem-status">{redeemNotice.text}</p>
                          )}
                        </>
                      );
                    })()}
                  </section>
                );
              })}
            </div>
          )}
          {spend && spend.periods.length > 0 && (
            <section data-testid="usage-spend" className="mt-3 grid gap-1.5">
              <h3 className="m-0 text-[0.78rem] font-medium">API-equivalent spend</h3>
              <p className="m-0 text-[0.72rem] text-subtext-0">
                Estimated from local agent logs at list prices ({spend.pricesUpdated}).
              </p>
              {([[1, "Today"], [7, "7 days"], [30, "30 days"]] as const).map(([days, label]) => {
                const period = spend.periods.find((p) => p.days === days);
                return period && (
                  <div key={days} data-testid={`usage-spend-${days}`} className="flex items-baseline justify-between gap-3 text-[0.78rem]">
                    <span className="text-subtext-0">{label}</span>
                    <span className="text-right tabular-nums">
                      {formatUsd(period.costUsd)}
                      <span className="ml-2 text-subtext-0">
                        {formatTokens(period.tokens)} tokens{period.unpriced > 0 && ` · ${period.unpriced} unpriced`}
                      </span>
                    </span>
                  </div>
                );
              })}
              {topModels.length > 0 && (
                <div data-testid="usage-spend-models" className="mt-1 grid gap-1.5">
                  <span className="text-[0.72rem] text-subtext-0">Top models, 30 days</span>
                  {topModels.map((m) => (
                    <div key={`${m.provider ?? ""}:${m.name}`} className="flex items-baseline justify-between gap-3 text-[0.78rem]">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <span className="tabular-nums">{formatUsd(m.costUsd)}</span>
                    </div>
                  ))}
                </div>
              )}
              {spend.block && (
                <p className="m-0 text-[0.78rem] tabular-nums" data-testid="usage-spend-block">
                  Claude 5h block {formatUsd(spend.block.costUsd)}, ends{" "}
                  {new Date(spend.block.end * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
              {spend.burnPerHourUsd !== undefined && (
                <p className="m-0 text-[0.78rem] tabular-nums" data-testid="usage-spend-burn">
                  Burning {formatUsd(spend.burnPerHourUsd)}/h
                </p>
              )}
            </section>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
