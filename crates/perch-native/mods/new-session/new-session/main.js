// main.tsx of Perch's stock screen "stock:new-session", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! New session menu, the stock screen `stock:new-session`: Perch's agent launcher at a button. Scoped (the tab strip's
//! "+" and Cmd+T): a filterable list of the host's agents, then the strip's extras (a browser, a file). Unscoped (the
//! home screen, a folder project's "+"): an agent, then one of `projectCwds` or Quickchat. Placed by the tab strip,
//! the home screen and a package's `NewSessionMenu` from `@perch/sdk`; or the person's package chosen for it
//! (`perch mod use stock:new-session <id>`) with the same props.
//!
//! The agents the host can start and the last one picked are Perch's (`useAgentChoices`); `onSelect` starts the
//! session. The list, its keys (type to filter, arrows and Enter, 1-9) and the look are this screen's. A press
//! outside or Escape closes it, and focus goes back where it was.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:new-session` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AgentIcon, cn, menuItemClass as menuItem, menuPanel, useAgentChoices } from "@perch/sdk";
import { AgentPicker } from "./agent-picker.js";
/** Extract the last path segment as a project display name. */
function basename(cwd) {
    const parts = cwd.replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || cwd;
}
const POPOVER_PICK = "flex w-full cursor-pointer flex-col bg-transparent px-[0.9rem] py-[0.4rem] text-left text-[12.5px] font-medium text-fg [font-family:inherit] [border:none] [transition:background_0.1s_ease] hover:bg-surface-0";
const POPOVER_PICK_CWD = "mt-[0.1rem] overflow-hidden text-[11px] font-normal text-ellipsis whitespace-nowrap text-subtext-0";
export default function NewSessionMenu({ hostId, projectCwds, fixedCwd, anchorRect, onClose, onSelect, extras }) {
    const popoverRef = useRef(null);
    const { connected, discovery, state: catalogState, error: catalogError, choices, lastChoice, rememberChoice, manage } = useAgentChoices(hostId);
    const [selectedAgent, setSelectedAgent] = useState(lastChoice);
    // Keyboard launcher (scoped branch): a filterable list the user drives without the mouse.
    const [filter, setFilter] = useState("");
    const [active, setActive] = useState(0);
    const agentsReady = connected && !(discovery && catalogState !== "ready");
    const items = fixedCwd === undefined ? [] : [
        ...choices.map((choice) => ({
            id: choice.id, label: choice.label, icon: _jsx(AgentIcon, { provider: choice.id }),
            testId: `new-session-provider-${choice.id}`, disabled: !agentsReady,
            run: () => {
                if (!agentsReady)
                    return;
                rememberChoice(choice.id);
                onSelect(fixedCwd, choice.id);
                onClose();
            },
        })),
        ...(extras ?? []).map((extra) => ({
            id: extra.id, label: extra.label, icon: extra.icon, testId: `new-tab-${extra.id}`,
            run: () => { onClose(); extra.onSelect(); },
        })),
        ...(discovery ? [{ id: "manage", label: "Manage agents…", muted: true, testId: "new-tab-manage", run: () => { onClose(); manage(); } }] : []),
    ];
    const needle = filter.trim().toLowerCase();
    const visible = needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
    // Dismissing returns focus to where it was (the terminal), not to <body>.
    useEffect(() => {
        const previous = document.activeElement;
        return () => { if (!document.activeElement || document.activeElement === document.body)
            previous?.focus?.(); };
    }, []);
    // Position: open below the anchor button, left-aligned. Clamped to the
    // viewport: the project list grows one row per listed project.
    // `.new-session-popover` is a flex column (see styles/session-picker.css); this cap makes
    // the `__projects` list scroll internally.
    const top = anchorRect.bottom + 4;
    const style = {
        position: "fixed",
        top,
        left: Math.max(12, Math.min(anchorRect.left, window.innerWidth - 344)),
        zIndex: 9999,
        minWidth: 200,
        maxHeight: `min(70vh, calc(100vh - ${top}px - 12px))`,
    };
    useEffect(() => {
        function handleClick(e) {
            if (popoverRef.current?.contains(e.target))
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
    return createPortal(_jsx("div", {
        className: cn(menuPanel, "new-session-popover flex max-w-[min(320px,calc(100vw_-_24px))] min-w-[200px] flex-col py-1"),
        ref: popoverRef,
        style: style,
        children: fixedCwd !== undefined ? (_jsxs("div", {
            className: "min-h-0 overflow-y-auto py-1",
            children: [
                _jsx("input", {
                    type: "text",
                    autoFocus: true,
                    role: "combobox",
                    "aria-expanded": "true",
                    "aria-controls": "new-tab-launcher-list",
                    "aria-activedescendant": visible[active] ? `new-tab-launcher-${visible[active].id}` : undefined,
                    "aria-label": "Filter new tab options",
                    placeholder: "Type to filter, \u2191\u2193 Enter, 1\u20139",
                    "data-testid": "new-tab-filter",
                    className: "mx-2 mb-1 w-[calc(100%_-_1rem)] rounded-ui border-0 bg-surface-0 px-2 py-1 text-[0.8rem] text-fg [font-family:inherit] [outline:none] placeholder:text-subtext-0",
                    value: filter,
                    onChange: (e) => { setFilter(e.target.value); setActive(0); },
                    onKeyDown: (e) => {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            if (visible.length)
                                setActive((active + (e.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
                        }
                        else if (e.key === "Enter") {
                            e.preventDefault();
                            visible[active]?.run();
                        }
                        else if (!filter && /^[1-9]$/.test(e.key) && visible[Number(e.key) - 1]) {
                            e.preventDefault();
                            visible[Number(e.key) - 1].run();
                        }
                    }
                }),
                _jsx("div", {
                    id: "new-tab-launcher-list",
                    role: "listbox",
                    children: visible.map((item, i) => (_jsxs("button", {
                        type: "button",
                        role: "option",
                        "aria-selected": i === active,
                        tabIndex: -1,
                        id: `new-tab-launcher-${item.id}`,
                        className: cn(menuItem(), "flex items-center gap-2", item.muted && "text-subtext-0", i === active && "bg-surface-0"),
                        "data-testid": item.testId,
                        disabled: item.disabled,
                        onMouseMove: () => setActive(i),
                        onClick: item.run,
                        children: [
                            item.icon,
                            _jsx("span", {
                                className: "flex-1",
                                children: item.label
                            }),
                            !filter && i < 9 && _jsx("kbd", {
                                className: "text-[0.7rem] text-subtext-0 [font-family:inherit]",
                                children: i + 1
                            })
                        ]
                    }, item.id)))
                }),
                !visible.length && _jsx("p", {
                    className: "mx-3 text-[0.75rem] text-subtext-0",
                    role: "status",
                    children: "No match."
                }),
                discovery && catalogState === "loading" && _jsx("p", {
                    className: "mx-3 text-[0.75rem] text-subtext-0",
                    role: "status",
                    children: "Checking agents\u2026"
                }),
                discovery && catalogState === "error" && _jsx("p", {
                    className: "mx-3 text-[0.75rem] text-red",
                    role: "alert",
                    children: catalogError
                }),
                discovery && catalogState === "ready" && !choices.length && _jsx("p", {
                    className: "mx-3 text-[0.75rem] text-subtext-0",
                    role: "status",
                    children: "Enable or install an agent in Manage agents."
                })
            ]
        })) : _jsxs(_Fragment, { children: [_jsx(AgentPicker, {
                    hostId: hostId,
                    onManage: onClose,
                    value: selectedAgent,
                    onChange: (a) => {
                        setSelectedAgent(a);
                        rememberChoice(a);
                    },
                    testIdPrefix: "new-session-popover-agent",
                    className: "m-2 mb-1 w-[calc(100%_-_1rem)] [--picker-bg:var(--surface-0)]",
                    wrapClassName: "max-h-[35vh] shrink-0 overflow-y-auto"
                }), projectCwds.length > 0 && (_jsx("div", {
                    className: "max-h-[190px] min-h-0 shrink overflow-y-auto",
                    children: projectCwds.map((cwd, i) => (_jsxs("button", {
                        type: "button",
                        className: POPOVER_PICK,
                        "data-testid": `project-option-${i}`,
                        onClick: () => { onSelect(cwd, selectedAgent); onClose(); },
                        title: cwd,
                        children: [
                            basename(cwd),
                            _jsx("span", {
                                className: POPOVER_PICK_CWD,
                                children: cwd
                            })
                        ]
                    }, cwd)))
                })), _jsxs("button", {
                    type: "button",
                    className: cn(POPOVER_PICK, "shrink-0 font-normal text-subtext-0"),
                    "data-testid": "project-option-none",
                    onClick: () => { onSelect("~", selectedAgent); onClose(); },
                    children: [
                        "No project",
                        _jsx("span", {
                            className: POPOVER_PICK_CWD,
                            children: "Quickchat"
                        })
                    ]
                })] })
    }), document.body);
}
