// main.tsx of Perch's stock screen "stock:toast", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Notifications, the stock screen `stock:toast`: in-app alerts for sessions you are not looking at, usage alerts
//! and a mod's `notify`, while Perch is focused (an unfocused window gets a system notification instead). Top-right
//! on desktop, full-width under the status bar on a phone. The list, what each says and what a click does are
//! Perch's (`useNotifications`); how long one stays, pausing on hover or focus, and how many stack are this screen's.
//! Each card is also the legacy `toast` slot a mod can draw (`api.slot`).
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:toast` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { CloseIcon, cn, iconButton, menuPanel, SessionDot, Slot, useNotifications } from "@perch/sdk";
/** Older notifications stay listed but are not stacked past this many. */
const MAX_VISIBLE = 4;
/** One card: the session's status mark (or a ring), what happened, and to what. The card opens it; × only dismisses. */
function Card({ item, open, dismiss }) {
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (paused)
            return;
        const timer = window.setTimeout(() => dismiss(item.id), item.timeout);
        return () => window.clearTimeout(timer);
    }, [item.id, item.timeout, paused, dismiss]);
    const usage = item.kind === "usage";
    const ring = item.level === "error" ? "border-red" : item.level === "warning" || usage ? "border-yellow" : item.kind === "blocked" ? "border-red" : "border-teal";
    const data = { id: item.id, kind: item.kind, level: item.level, title: item.title, body: item.body, sessionId: item.sessionId, sessionTitle: item.sessionTitle };
    return (_jsx(Slot, {
        name: "toast",
        data: data,
        actions: { open: () => open(item.id), dismiss: () => dismiss(item.id) },
        className: "pointer-events-auto",
        children: _jsxs("div", {
            className: cn(menuPanel, "pointer-events-auto flex items-stretch py-0 animate-toast-in motion-reduce:animate-none"),
            onMouseEnter: () => setPaused(true),
            onMouseLeave: () => setPaused(false),
            onFocus: () => setPaused(true),
            onBlur: () => setPaused(false),
            children: [
                _jsxs("button", {
                    type: "button",
                    className: "flex min-w-0 flex-1 cursor-pointer items-center gap-[0.65rem] bg-transparent px-[0.8rem] py-[0.65rem] text-left text-fg [border:none] [font-family:inherit] hover:bg-surface-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]",
                    "data-testid": `toast-${item.sessionId}`,
                    onClick: () => open(item.id),
                    children: [
                        item.icon ? (_jsx("span", {
                            className: "inline-flex h-5 w-5 shrink-0 items-center justify-center text-[0.95rem] leading-none",
                            "aria-hidden": "true",
                            children: item.icon
                        })) : item.hasSession ? (_jsx(SessionDot, { id: item.sessionId })) : (_jsx("span", {
                            className: cn("inline-flex h-5 w-5 shrink-0 rounded-full border-[1.5px]", ring),
                            "aria-hidden": "true"
                        })),
                        _jsxs("span", {
                            className: "min-w-0",
                            children: [
                                _jsx("span", {
                                    className: "block overflow-hidden text-[0.82rem] font-semibold text-ellipsis whitespace-nowrap",
                                    children: item.heading
                                }),
                                item.detail && _jsx("span", {
                                    className: "block overflow-hidden text-[0.75rem] text-ellipsis whitespace-nowrap text-subtext-0",
                                    children: item.detail
                                })
                            ]
                        })
                    ]
                }),
                _jsx("button", {
                    type: "button",
                    className: cn(iconButton, "my-1 mr-1 self-start px-[0.35rem] py-[0.35rem] max-[700px]:min-h-11 max-[700px]:min-w-11"),
                    "aria-label": "Dismiss notification",
                    "data-testid": `toast-dismiss-${item.sessionId}`,
                    onClick: () => dismiss(item.id),
                    children: _jsx(CloseIcon, { size: 12 })
                })
            ]
        })
    }));
}
export default function Notifications() {
    const { items, open, dismiss } = useNotifications();
    if (items.length === 0)
        return null;
    return (_jsx("div", {
        className: "pointer-events-none fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] z-[4000] flex flex-col gap-2 min-[701px]:left-auto min-[701px]:w-80",
        role: "status",
        "aria-live": "polite",
        "data-testid": "toast",
        children: items.slice(-MAX_VISIBLE).reverse().map((item) => _jsx(Card, {
            item: item,
            open: open,
            dismiss: dismiss
        }, item.id))
    }));
}
