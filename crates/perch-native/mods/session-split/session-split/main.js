// main.tsx of Perch's stock screen "stock:session-split", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Split with session, the stock screen `stock:session-split`: the picker a docked pane group's ⛶ button opens. It
//! lists the other sessions of the workspace; each row is clickable (split that session in to the right of the group
//! it was opened from) and draggable (drop it on any edge, or the centre for a tab, of any group: the dock draws the
//! drop target and makes the split). Perch shows it, or the person's package chosen for it (`perch mod use
//! stock:session-split <id>`), with the same props.
//!
//! The split is Perch's: `onPick` opens the session's panel (an already open one is shown again, never duplicated),
//! and `beginDrag` puts the session on the drag so the dock can read it back.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:session-split` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
const MENU_W = 260;
const MENU_MAX_H = 320;
export default function SessionSplit({ sessions, x, y, onPick, beginDrag, onClose }) {
    const menuRef = useRef(null);
    useEffect(() => {
        function handleClick(e) {
            if (menuRef.current?.contains(e.target))
                return;
            onClose();
        }
        function handleKeyDown(e) {
            if (e.key === "Escape")
                onClose();
        }
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);
    const left = Math.min(x, window.innerWidth - MENU_W - 8);
    const top = Math.min(y, window.innerHeight - MENU_MAX_H - 8);
    return createPortal(_jsxs("div", {
        className: "session-split-popover",
        "data-testid": "session-split-popover",
        ref: menuRef,
        style: { position: "fixed", top, left, zIndex: 9999, width: MENU_W, maxHeight: MENU_MAX_H },
        children: [
            _jsx("div", {
                className: "session-split-popover__header",
                children: "Split with session"
            }),
            sessions.length === 0 ? (_jsx("div", {
                className: "session-split-popover__empty",
                children: "No other sessions yet"
            })) : (_jsx("div", {
                className: "session-split-popover__list",
                children: sessions.map((s) => (_jsxs("button", {
                    type: "button",
                    className: "session-split-popover__item",
                    "data-testid": `session-split-option-${s.id}`,
                    draggable: true,
                    onDragStart: (e) => {
                        beginDrag(e, s.id);
                        // The drag carries on; close so this picker does not sit over the drop target.
                        onClose();
                    },
                    onClick: () => {
                        onPick(s.id);
                        onClose();
                    },
                    title: s.cwd,
                    children: [
                        _jsx("span", {
                            className: "session-split-popover__item-title",
                            children: s.title || "Untitled session"
                        }),
                        _jsx("span", {
                            className: "session-split-popover__item-cwd",
                            children: s.cwd
                        }),
                        s.open && _jsx("span", {
                            className: "session-split-popover__item-badge",
                            children: "open"
                        })
                    ]
                }, s.id)))
            }))
        ]
    }), document.body);
}
