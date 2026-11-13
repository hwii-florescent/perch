// usage.tsx of Perch's stock screen "stock:status", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Plan usage, the status bar's right block: one button lists every provider window's use and opens
//! the details (each window's reset time, banked Codex resets with a confirm, 1/7/30-day spend, top
//! models, the Claude 5h block and burn rate). Refresh asks the core once and waits for a newer
//! `updatedAt`, giving up after 30 s; a reset is sent once and its result is matched by account id.
//! The phone's switcher shows the same block.
//!
//! Part of the stock screen `stock:status`; imports only React and `@perch/sdk` (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anchoredPopoverStyle, cn, ghostButton, menuPanel, redeemUsageReset, refreshUsage, useDismissOnOutsideClick, usePlanUsage, } from "@perch/sdk";
export function formatTokens(n) {
    if (n >= 1e6)
        return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
/** Two decimals; whole dollars from $100 up. */
function formatUsd(n) {
    return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}
function usageTone(pct) {
    return pct >= 90 ? "text-red" : pct >= 70 ? "text-yellow" : "";
}
function providerName(provider) {
    return provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : provider;
}
const REDEEM_TEXT = {
    reset: "Limits reset.",
    nothingToReset: "Nothing to reset; no credit spent.",
    noCredit: "No banked reset available.",
    alreadyRedeemed: "That reset was already used.",
};
function resetTitle(w) {
    if (w.resetsAt === undefined)
        return "Reset time unavailable";
    const at = new Date(typeof w.resetsAt === "number" ? w.resetsAt * 1000 : w.resetsAt);
    return isNaN(at.getTime()) ? "Reset time unavailable" : at.toLocaleString();
}
/** One clickable status-bar block opens all provider windows and reset times. */
export function UsageSummary({ usage, updatedAt, }) {
    const { spend, redeemResult } = usePlanUsage();
    const [confirming, setConfirming] = useState(null);
    const [redeeming, setRedeeming] = useState(null);
    const [redeemNotice, setRedeemNotice] = useState(null);
    const [open, setOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshNotice, setRefreshNotice] = useState("");
    const [popoverStyle, setPopoverStyle] = useState({});
    const previousUpdatedAt = useRef(updatedAt);
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);
    useDismissOnOutsideClick(open, setOpen, buttonRef, popoverRef);
    useEffect(() => {
        if (open)
            popoverRef.current?.querySelector("button")?.focus();
    }, [open]);
    useEffect(() => {
        if (updatedAt !== previousUpdatedAt.current && refreshing) {
            setRefreshing(false);
            setRefreshNotice("Plan usage refreshed.");
        }
        previousUpdatedAt.current = updatedAt;
    }, [updatedAt, refreshing]);
    useEffect(() => {
        if (!redeeming || redeemResult?.accountId !== redeeming)
            return;
        setRedeeming(null);
        const known = REDEEM_TEXT[redeemResult.outcome];
        setRedeemNotice({ accountId: redeeming, text: known ?? redeemResult.message ?? "Could not reach Codex. Try again." });
        if (known)
            refreshUsage();
    }, [redeemResult, redeeming]);
    useEffect(() => {
        if (!refreshing)
            return;
        const timeout = window.setTimeout(() => setRefreshing(false), 30_000);
        return () => window.clearTimeout(timeout);
    }, [refreshing]);
    const accountCount = (provider) => usage.filter((item) => item.provider === provider).length;
    const updatedText = updatedAt
        ? new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "Not refreshed yet";
    const month = spend?.periods.find((p) => p.days === 30);
    const topModels = month?.models.slice(0, 3) ?? [];
    return (_jsxs(_Fragment, { children: [_jsx("button", {
                type: "button",
                ref: buttonRef,
                "data-testid": "usage-summary",
                "aria-haspopup": "dialog",
                "aria-expanded": open,
                "aria-controls": "usage-details-popover",
                className: cn(ghostButton, "flex h-5 min-w-0 items-center gap-3 px-1.5 py-0 text-[9px] leading-none focus-visible:[outline:1px_solid_var(--overlay-1)]"),
                title: "Open plan usage details",
                onClick: () => {
                    if (open) {
                        setOpen(false);
                        return;
                    }
                    if (buttonRef.current) {
                        setPopoverStyle(anchoredPopoverStyle(buttonRef.current, { minWidth: 300, align: "right" }));
                    }
                    setOpen(true);
                },
                children: usage.length === 0 ? (_jsx("span", { children: "Usage unavailable" })) : usage.map((account, i) => {
                    const several = accountCount(account.provider) > 1;
                    const provider = providerName(account.provider);
                    const name = several && account.label ? `${provider} ${account.label}` : provider;
                    return (_jsxs("span", {
                        className: "flex items-center gap-1.5 text-[9px]",
                        children: [
                            _jsx("span", { children: name }),
                            account.windows.filter((w) => !w.scope).map((w, index) => (_jsxs("span", {
                                className: cn("tabular-nums", index === 0 && "text-fg", usageTone(w.usedPercent)),
                                children: [
                                    w.label,
                                    " ",
                                    Math.round(w.usedPercent),
                                    "%"
                                ]
                            }, w.label)))
                        ]
                    }, `${account.provider}:${account.label ?? i}`));
                })
            }), open && createPortal(_jsxs("div", {
                id: "usage-details-popover",
                ref: popoverRef,
                role: "dialog",
                "aria-label": "Plan usage details",
                "data-testid": "usage-details",
                className: cn(menuPanel, "fixed z-[3100] w-[min(340px,calc(100vw-16px))] overflow-y-auto p-3 text-fg"),
                style: popoverStyle,
                onKeyDown: (event) => {
                    if (event.key === "Escape") {
                        setOpen(false);
                        buttonRef.current?.focus();
                    }
                },
                children: [
                    _jsxs("div", {
                        className: "mb-2 flex items-center justify-between gap-3",
                        children: [
                            _jsx("h2", {
                                className: "m-0 text-[0.85rem] font-semibold",
                                children: "Plan usage"
                            }),
                            _jsx("button", {
                                type: "button",
                                "data-testid": "usage-refresh",
                                disabled: refreshing,
                                "aria-busy": refreshing,
                                className: cn(ghostButton, "px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]"),
                                onClick: () => {
                                    setRefreshing(true);
                                    setRefreshNotice("");
                                    refreshUsage();
                                },
                                children: refreshing ? "Refreshing…" : "Refresh"
                            })
                        ]
                    }),
                    _jsxs("p", {
                        className: "mb-3 text-[0.72rem] text-subtext-0",
                        "data-testid": "usage-updated",
                        children: [
                            "Last fetched ",
                            updatedText
                        ]
                    }),
                    _jsx("span", {
                        className: "sr-only",
                        role: "status",
                        "aria-live": "polite",
                        children: refreshNotice
                    }),
                    usage.length === 0 ? (_jsx("p", {
                        className: "mb-1 text-[0.8rem] text-subtext-0",
                        "data-testid": "usage-empty",
                        children: "No usage available. Check Claude Code's sign-in, then refresh."
                    })) : (_jsx("div", {
                        className: "grid gap-3",
                        children: usage.map((account, i) => {
                            const several = accountCount(account.provider) > 1;
                            const provider = providerName(account.provider);
                            const base = several && account.label ? `${provider} ${account.label}` : provider;
                            const name = account.plan ? `${base} ${account.plan}` : base;
                            return (_jsxs("section", {
                                className: "grid gap-1.5",
                                children: [
                                    _jsx("h3", {
                                        className: "m-0 text-[0.78rem] font-medium",
                                        children: name
                                    }),
                                    account.error && _jsx("p", {
                                        className: "m-0 text-[0.78rem] text-red",
                                        role: "status",
                                        children: account.error
                                    }),
                                    account.windows.map((w) => (_jsxs("div", {
                                        className: "flex items-baseline justify-between gap-3 text-[0.78rem]",
                                        children: [
                                            _jsxs("span", {
                                                className: "text-subtext-0",
                                                children: [
                                                    w.label,
                                                    " ",
                                                    w.scope ? `${w.scope} ` : "",
                                                    "window"
                                                ]
                                            }),
                                            _jsxs("span", {
                                                className: "text-right tabular-nums",
                                                children: [
                                                    _jsxs("span", {
                                                        className: usageTone(w.usedPercent),
                                                        children: [
                                                            Math.round(w.usedPercent),
                                                            "% used"
                                                        ]
                                                    }),
                                                    _jsxs("span", {
                                                        className: "ml-2 text-subtext-0",
                                                        children: [
                                                            "Resets ",
                                                            resetTitle(w)
                                                        ]
                                                    })
                                                ]
                                            })
                                        ]
                                    }, `${w.label}:${w.scope ?? ""}`))),
                                    (() => {
                                        const share = account.planMonthlyUsd !== undefined && accountCount(account.provider) === 1
                                            ? month?.providers.find((s) => s.name === account.provider)
                                            : undefined;
                                        return share && (_jsxs("p", {
                                            className: "m-0 text-[0.72rem] text-subtext-0",
                                            "data-testid": "usage-plan-value",
                                            children: [
                                                "30 days: ",
                                                formatUsd(share.costUsd),
                                                " API-equivalent on a $",
                                                account.planMonthlyUsd,
                                                "/mo plan"
                                            ]
                                        }));
                                    })(),
                                    account.resetCredits !== undefined && (_jsxs("p", {
                                        className: "m-0 text-[0.72rem] text-subtext-0",
                                        "data-testid": "usage-reset-credits",
                                        children: [
                                            account.resetCredits,
                                            " rate-limit ",
                                            account.resetCredits === 1 ? "reset" : "resets",
                                            " banked"
                                        ]
                                    })),
                                    (() => {
                                        const id = account.accountId;
                                        const credits = account.resetCredits ?? 0;
                                        if (!id)
                                            return null;
                                        return (_jsxs(_Fragment, { children: [credits === 0 ? null : confirming === id ? (_jsxs("div", {
                                                    className: "grid gap-1.5",
                                                    children: [
                                                        _jsxs("p", {
                                                            className: "m-0 text-[0.72rem]",
                                                            children: [
                                                                "Reset this Codex account's 5h and weekly limits now? This spends 1 of ",
                                                                credits,
                                                                " banked ",
                                                                credits === 1 ? "reset" : "resets",
                                                                "."
                                                            ]
                                                        }),
                                                        _jsxs("div", {
                                                            className: "flex gap-2",
                                                            children: [
                                                                _jsx("button", {
                                                                    type: "button",
                                                                    "data-testid": "usage-redeem-confirm",
                                                                    className: cn(ghostButton, "px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 focus-visible:[outline:1px_solid_var(--overlay-1)]"),
                                                                    onClick: () => {
                                                                        setConfirming(null);
                                                                        setRedeeming(id);
                                                                        redeemUsageReset(id);
                                                                    },
                                                                    children: "Reset limits"
                                                                }),
                                                                _jsx("button", {
                                                                    type: "button",
                                                                    className: cn(ghostButton, "px-2 py-1 text-[0.78rem] text-subtext-0 hover:bg-surface-0 focus-visible:[outline:1px_solid_var(--overlay-1)]"),
                                                                    onClick: () => setConfirming(null),
                                                                    children: "Cancel"
                                                                })
                                                            ]
                                                        })
                                                    ]
                                                })) : (_jsx("button", {
                                                    type: "button",
                                                    "data-testid": "usage-redeem-reset",
                                                    disabled: redeeming === id,
                                                    "aria-busy": redeeming === id,
                                                    className: cn(ghostButton, "justify-self-start px-2 py-1 text-[0.78rem] text-fg hover:bg-surface-0 disabled:cursor-wait disabled:opacity-50 focus-visible:[outline:1px_solid_var(--overlay-1)]"),
                                                    onClick: () => {
                                                        setRedeemNotice(null);
                                                        setConfirming(id);
                                                    },
                                                    children: redeeming === id ? "Resetting…" : "Use one"
                                                })), redeemNotice?.accountId === id && (_jsx("p", {
                                                    className: "m-0 text-[0.72rem]",
                                                    role: "status",
                                                    "data-testid": "usage-redeem-status",
                                                    children: redeemNotice.text
                                                }))] }));
                                    })()
                                ]
                            }, `${account.provider}:${account.label ?? i}`));
                        })
                    })),
                    spend && spend.periods.length > 0 && (_jsxs("section", {
                        "data-testid": "usage-spend",
                        className: "mt-3 grid gap-1.5",
                        children: [
                            _jsx("h3", {
                                className: "m-0 text-[0.78rem] font-medium",
                                children: "API-equivalent spend"
                            }),
                            _jsxs("p", {
                                className: "m-0 text-[0.72rem] text-subtext-0",
                                children: [
                                    "Estimated from local agent logs at list prices (",
                                    spend.pricesUpdated,
                                    ")."
                                ]
                            }),
                            [[1, "Today"], [7, "7 days"], [30, "30 days"]].map(([days, label]) => {
                                const period = spend.periods.find((p) => p.days === days);
                                return period && (_jsxs("div", {
                                    "data-testid": `usage-spend-${days}`,
                                    className: "flex items-baseline justify-between gap-3 text-[0.78rem]",
                                    children: [
                                        _jsx("span", {
                                            className: "text-subtext-0",
                                            children: label
                                        }),
                                        _jsxs("span", {
                                            className: "text-right tabular-nums",
                                            children: [
                                                formatUsd(period.costUsd),
                                                _jsxs("span", {
                                                    className: "ml-2 text-subtext-0",
                                                    children: [
                                                        formatTokens(period.tokens),
                                                        " tokens",
                                                        period.unpriced > 0 && ` · ${period.unpriced} unpriced`
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }, days));
                            }),
                            topModels.length > 0 && (_jsxs("div", {
                                "data-testid": "usage-spend-models",
                                className: "mt-1 grid gap-1.5",
                                children: [
                                    _jsx("span", {
                                        className: "text-[0.72rem] text-subtext-0",
                                        children: "Top models, 30 days"
                                    }),
                                    topModels.map((m) => (_jsxs("div", {
                                        className: "flex items-baseline justify-between gap-3 text-[0.78rem]",
                                        children: [
                                            _jsx("span", {
                                                className: "min-w-0 truncate",
                                                children: m.name
                                            }),
                                            _jsx("span", {
                                                className: "tabular-nums",
                                                children: formatUsd(m.costUsd)
                                            })
                                        ]
                                    }, `${m.provider ?? ""}:${m.name}`)))
                                ]
                            })),
                            spend.block && (_jsxs("p", {
                                className: "m-0 text-[0.78rem] tabular-nums",
                                "data-testid": "usage-spend-block",
                                children: [
                                    "Claude 5h block ",
                                    formatUsd(spend.block.costUsd),
                                    ", ends",
                                    " ",
                                    new Date(spend.block.end * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                                ]
                            })),
                            spend.burnPerHourUsd !== undefined && (_jsxs("p", {
                                className: "m-0 text-[0.78rem] tabular-nums",
                                "data-testid": "usage-spend-burn",
                                children: [
                                    "Burning ",
                                    formatUsd(spend.burnPerHourUsd),
                                    "/h"
                                ]
                            }))
                        ]
                    }))
                ]
            }), document.body)] }));
}
