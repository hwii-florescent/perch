// main.tsx of Perch's stock screen "stock:status", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Status bar, the stock screen `stock:status`: the bottom row of the desktop window (and a layout's
//! `status` block). Left: connection dot, host, folder and branch of the focused session (else the
//! workspace; while a file or review tab is on screen, that tab's folder). Middle: zoom (click resets), context tokens and cost of the focused agent. Right: plan
//! usage (`usage.tsx`) and the connection check. A legacy mod can redraw it through the
//! `status-bar` slot.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS
//! the app runs and `perch mod clone stock:status` copies. It may import only `react`, `react-dom`,
//! `@perch/sdk` and files beside it (docs/MOD-SDK.md).
import { cn, ghostButton, isMac, keyLabel, resetZoom, Slot, usePlanUsage, useStatusLine, useZoom } from "@perch/sdk";
import { formatTokens, UsageSummary } from "./usage.js";
export default function StatusBar() {
    const line = useStatusLine();
    const { usage, updatedAt } = usePlanUsage({ keepFresh: true });
    const zoom = useZoom();
    const { hostId, hostName, sessionId, cwd, branch, contextTokens, costUsd } = line;
    const online = line.connected && (hostId === "local" || line.hostState === "connected");
    const connectionLabel = online ? "Connected" : "Reconnecting…";
    const host = hostId === "local" ? "Local" : hostName ?? hostId;
    const data = { online, host, cwd, branch, sessionId, contextTokens, costUsd, zoom };
    return (_jsx(Slot, {
        name: "status-bar",
        data: data,
        actions: { resetZoom },
        children: _jsxs("footer", {
            className: "status-bar box-border flex h-6 shrink-0 items-center gap-3 overflow-hidden px-3 text-[10px] leading-none whitespace-nowrap text-subtext-0 [--radius:var(--radius-pane)]",
            children: [
                _jsxs("div", {
                    className: "status-bar__location flex min-w-0 flex-1 items-center gap-[13px] overflow-hidden",
                    children: [
                        _jsx("span", {
                            className: cn("size-1 shrink-0 rounded-full", online ? "bg-green" : "bg-yellow"),
                            title: connectionLabel
                        }),
                        _jsx("span", {
                            className: "max-w-24 shrink-0 truncate",
                            title: `${hostName ?? hostId} · ${connectionLabel}`,
                            "data-testid": "status-host",
                            children: host
                        }),
                        _jsx("span", {
                            className: "status-item--cwd min-w-0 truncate",
                            title: cwd,
                            children: cwd
                        }),
                        branch && _jsxs("span", {
                            className: "status-bar__branch flex min-w-0 max-w-[45%] shrink-0 items-center gap-1.5",
                            title: branch,
                            children: [
                                _jsxs("svg", {
                                    width: "12",
                                    height: "12",
                                    className: "shrink-0",
                                    viewBox: "0 0 20 20",
                                    fill: "none",
                                    stroke: "currentColor",
                                    strokeWidth: "1.3",
                                    "aria-hidden": "true",
                                    children: [
                                        _jsx("circle", {
                                            cx: "6",
                                            cy: "4",
                                            r: "2"
                                        }),
                                        _jsx("circle", {
                                            cx: "14",
                                            cy: "5",
                                            r: "2"
                                        }),
                                        _jsx("circle", {
                                            cx: "6",
                                            cy: "16",
                                            r: "2"
                                        }),
                                        _jsx("path", { d: "M6 6v8m0-3c8 0 8-2 8-4" })
                                    ]
                                }),
                                _jsx("span", {
                                    className: "min-w-0 truncate",
                                    children: branch
                                })
                            ]
                        })
                    ]
                }),
                _jsxs("div", {
                    className: "status-bar__details flex min-w-0 max-w-[25%] shrink-[2] items-center justify-end gap-3 overflow-hidden max-[900px]:hidden",
                    children: [
                        zoom !== 1 && (_jsxs("button", {
                            type: "button",
                            "data-testid": "zoom-indicator",
                            className: cn(ghostButton, "px-1 tabular-nums text-fg"),
                            title: `Zoom ${Math.round(zoom * 100)}%. Click to reset (${keyLabel(isMac ? "cmd+0" : "ctrl+0")})`,
                            onClick: resetZoom,
                            children: [
                                Math.round(zoom * 100),
                                "%"
                            ]
                        })),
                        contextTokens !== undefined && _jsxs("span", {
                            className: "shrink-0",
                            children: [
                                "ctx ",
                                formatTokens(contextTokens)
                            ]
                        }),
                        costUsd !== undefined && _jsxs("span", {
                            className: "shrink-0",
                            children: [
                                "$",
                                costUsd.toFixed(3)
                            ]
                        })
                    ]
                }),
                _jsx("div", {
                    className: "status-bar__usage -ml-2 flex h-5 min-w-0 max-w-[38%] shrink items-center overflow-hidden",
                    children: _jsx(UsageSummary, {
                        usage: usage,
                        updatedAt: updatedAt
                    })
                }),
                _jsx("span", {
                    className: "shrink-0",
                    role: "img",
                    "aria-label": connectionLabel,
                    title: `${hostId === "local" ? "Local core" : hostName ?? hostId}: ${connectionLabel}`,
                    "data-testid": "status-connection",
                    children: _jsx("svg", {
                        width: "12",
                        height: "12",
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "1.3",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        "aria-hidden": "true",
                        children: _jsx("path", { d: online ? "m4 10 4 4 8-8" : "M10 4v7m0 4v1" })
                    })
                })
            ]
        })
    }));
}
