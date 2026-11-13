// main.tsx of Perch's stock screen "stock:tab-menu", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Tab menu, the stock screen `stock:tab-menu`: a tab's actions (rename, split with a new terminal, show beside
//! another open tab, full size, separate, stop agent, close), opened from the tab strip (`tab.menu`), a sidebar row
//! or a pane's "Show beside an open tab…", and a package's `TabMenu`/`SessionMenu` from `@perch/sdk`; or the person's
//! package chosen for it (`perch mod use stock:tab-menu <id>`) with the same props.
//!
//! What may be done is worked out by Perch (`canSplitNew`, `offered`, `inSplit`, `canStopAgent`) and each action runs
//! Perch's own (`actions`: the same split, close guard and stop as the keys). Where the menu sits, the rename form,
//! the order and wording of rows are this screen's. A press outside or Escape closes it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:tab-menu` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, menuDividerClass as menuDivider, menuItemClass as menuItem, menuPanel } from "@perch/sdk";
export default function TabMenu({ x, y, onClose, self, canSplitNew, canSplitMore, offered, inSplit, canStopAgent, extraItems, actions }) {
    const ref = useRef(null);
    const renameRef = useRef(null);
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState("");
    useEffect(() => {
        // A new press outside closes it; `pointerdown`, because lifting the finger that held a row open fires a
        // compatibility `mousedown` there, which would close the menu the hold just opened.
        const onDown = (e) => { if (!ref.current?.contains(e.target))
            onClose(); };
        const onKey = (e) => { if (e.key === "Escape")
            onClose(); };
        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);
    useEffect(() => {
        if (renaming) {
            renameRef.current?.focus();
            renameRef.current?.select();
        }
    }, [renaming]);
    const left = Math.max(8, Math.min(x, window.innerWidth - 288));
    const top = Math.max(8, Math.min(y, window.innerHeight - 48 - 36 * (offered.length + extraItems.length + 7)));
    const then = (run) => () => { run(); onClose(); };
    function commitRename() {
        if (self.kind === "session" && name.trim())
            actions.rename(name.trim());
        onClose();
    }
    return createPortal(_jsx("div", {
        ref: ref,
        className: `${menuPanel} overflow-y-auto max-[700px]:[&_button]:min-h-11`,
        "aria-label": "Tab actions",
        "data-testid": "tab-split-menu",
        style: { position: "fixed", top, left, zIndex: 9999, width: 280, maxWidth: "calc(100vw - 16px)", maxHeight: window.innerHeight - top - 8 },
        children: renaming ? _jsxs("form", {
            className: "flex gap-2 p-2",
            onSubmit: (event) => { event.preventDefault(); commitRename(); },
            children: [
                _jsx("input", {
                    ref: renameRef,
                    "aria-label": "Tab name",
                    "data-testid": "tab-menu-rename-input",
                    className: "min-w-0 flex-1 rounded-ui bg-surface-0 px-2 py-1 text-sm text-fg focus:[outline:1px_solid_var(--accent)]",
                    value: name,
                    onChange: (event) => setName(event.target.value)
                }),
                _jsx("button", {
                    type: "submit",
                    className: button({ size: "sm", variant: "primary" }),
                    children: "Save"
                })
            ]
        }) : _jsxs(_Fragment, { children: [self.kind === "session" && _jsx("button", {
                    type: "button",
                    className: menuItem(),
                    "data-testid": "tab-menu-rename",
                    onClick: () => { setName(self.title ?? ""); setRenaming(true); },
                    children: "Rename tab"
                }), ["right", "below"].map((direction) => _jsxs("button", {
                    type: "button",
                    className: menuItem(),
                    "data-testid": `tab-menu-split-${direction}`,
                    disabled: !canSplitNew || !canSplitMore,
                    onClick: then(() => actions.splitNew(direction)),
                    children: [
                        "Split ",
                        direction,
                        " with new terminal"
                    ]
                }, direction)), _jsx("div", { className: menuDivider }), offered.length > 0 && _jsx("p", {
                    className: "m-0 px-[0.9rem] py-1 text-xs text-subtext-0",
                    children: "Show an open tab beside this one"
                }), offered.map((entry) => (_jsx("button", {
                    type: "button",
                    className: menuItem(),
                    "data-testid": `tab-split-with-${entry.id}`,
                    onClick: then(() => actions.showBeside(entry.id)),
                    children: _jsxs("span", {
                        className: "block truncate",
                        children: [
                            "Show beside ",
                            entry.label
                        ]
                    })
                }, entry.id))), offered.length === 0 && !inSplit && _jsx("div", {
                    className: "px-[0.9rem] py-[0.45rem] text-[0.82rem] text-subtext-0",
                    children: "No other open tab available"
                }), inSplit && (_jsxs(_Fragment, { children: [offered.length > 0 && _jsx("div", { className: menuDivider }), _jsx("button", {
                            type: "button",
                            className: menuItem(),
                            "data-testid": "tab-unsplit",
                            onClick: then(actions.showFull),
                            children: "Show this tab full size"
                        }), _jsx("button", {
                            type: "button",
                            className: menuItem(),
                            "data-testid": "tab-untile-all",
                            onClick: then(actions.separateAll),
                            children: "Separate all tabs"
                        })] })), extraItems.length > 0 && _jsx("div", { className: menuDivider }), extraItems.map((item) => _jsx("button", {
                    type: "button",
                    className: menuItem(),
                    "data-testid": item.testId,
                    onClick: then(item.onSelect),
                    children: item.label
                }, item.testId)), canStopAgent && _jsx("button", {
                    type: "button",
                    className: menuItem({ danger: true }),
                    "data-testid": "pane-menu-stop-agent",
                    onClick: then(actions.stopAgent),
                    children: "Stop agent"
                }), _jsx("div", { className: menuDivider }), _jsx("button", {
                    type: "button",
                    className: menuItem({ danger: true }),
                    "data-testid": "tab-menu-close",
                    onClick: then(actions.close),
                    children: "Close tab"
                })] })
    }), document.body);
}
