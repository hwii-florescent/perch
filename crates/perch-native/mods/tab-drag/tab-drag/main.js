// main.tsx of Perch's stock screen "stock:tab-drag", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
//! Tab drag, the stock screen `stock:tab-drag`: what a tab drag shows while it is in flight. The tab strip (a stock
//! or copied `stock:tabs`, or a package's `TabDragLayer` from `@perch/sdk`) places it; or the person's package chosen
//! for it (`perch mod use stock:tab-drag <id>`) draws it from the same `drag`.
//!
//! The drag itself (pointer tracking, where a drop lands, the split or move it makes) is Perch's (`beginTabDrag`);
//! this screen only draws it, and must not take pointer events from the drag.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:tab-drag` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { createPortal } from "react-dom";
import { cn } from "@perch/sdk";
const ZONE_LABEL = { left: "Split left", right: "Split right", up: "Split above", down: "Split below" };
/**
 * What a tab drag shows: over the strip nothing here (the tabs
 * slide, `slideDrag.ts`); off it a ghost of the tab under the pointer, and on a
 * pane the half a split would take.
 * The highlight slides between sides and pulses so the target stays easy to
 * see; a pane that cannot take the tab says why. A transparent sheet covers the
 * page so nothing underneath (terminals, iframes) reacts to the drag.
 */
export default function TabDragLayer({ drag }) {
    const { drop } = drag;
    const zone = drop?.zone ?? null;
    const box = drop?.box;
    return createPortal(_jsxs("div", {
        className: "fixed inset-0 z-[9998] cursor-grabbing select-none",
        "data-testid": "tab-drag-layer",
        "aria-hidden": "true",
        children: [
            drop && box && (_jsxs(_Fragment, { children: [_jsx("div", {
                        className: "pointer-events-none fixed rounded-ui bg-surface-1/30",
                        style: { left: drop.pane.left, top: drop.pane.top, width: drop.pane.width, height: drop.pane.height }
                    }), _jsx("div", {
                        className: cn("pointer-events-none fixed flex items-center justify-center rounded-ui transition-[left,top,width,height] duration-150 ease-out animate-drop-zone", zone ? "bg-accent/35 shadow-[inset_0_0_24px_var(--accent)]" : "bg-surface-1/60"),
                        style: { left: box.left, top: box.top, width: box.width, height: box.height },
                        "data-testid": "tab-drop-zone",
                        "data-zone": zone ?? "blocked",
                        children: _jsx("span", {
                            className: "rounded-ui bg-surface-0 px-2 py-[2px] text-[0.75rem] text-fg shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
                            children: zone ? ZONE_LABEL[zone] : "This split can't take that tab"
                        })
                    })] })),
            !drag.overStrip && drag.look && (_jsx("div", {
                className: "pointer-events-none fixed flex [filter:drop-shadow(0_6px_10px_rgba(0,0,0,0.45))]",
                style: { left: drag.x - drag.look.dx, top: drag.y - drag.look.dy, width: drag.look.width, height: drag.look.height },
                "data-testid": "tab-drag-ghost",
                "aria-label": drag.label,
                dangerouslySetInnerHTML: { __html: drag.look.html }
            }))
        ]
    }), document.body);
}
