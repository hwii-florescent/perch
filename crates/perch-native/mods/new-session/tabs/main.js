// main.tsx of Perch's stock screen "stock:tabs", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Tabs, the stock screen `stock:tabs`: the strip of the shown workspace (a project checkout or one of
//! its git worktrees; with no workspace records, the project). Sessions come first, then open files,
//! reviews, browser pages and mod tabs, in `useWorkspaceTabs()` order, which the tab keys and the
//! sidebar read too, so they never disagree.
//!
//! Click shows a tab (`tab.select`); double-click renames a session inline (Enter keeps, Escape
//! drops) or keeps a previewed file (`tab.pin`); right-click opens the tab menu (`tab.menu`: split,
//! zoom, rename, close). Dragging (`beginTabDrag`) reorders within the strip or splits the canvas
//! when dropped on a pane's side; the order is kept per workspace on this device. × closes the tab
//! it sits on (`tab.close {id}`: a session through the same guard as everywhere else, so its owner
//! decides whether the process stops). "+" (and Cmd+T) opens the agent launcher for this workspace,
//! with a new browser page and a new file after the agents. Only the focused pane's tab is filled;
//! the active tab scrolls into view, also when the strip narrows. A legacy mod can redraw a session's
//! tab through the `tab` slot.
//!
//! A lead and its sub-sessions are a stack, in the sidebar's order: folded, one tab (the lead, or the member on
//! screen) with a count of the others; open, its members side by side. The stack's only mark is a hairline bracket
//! under its members (muted, the accent while one has the keyboard): no fill of its own, the strip's separators.
//! The count folds and opens it, and folding is the sidebar's own (`perch.sidebar.foldedSessions`, per device), so
//! either place folds both. A folded stack drags as its lead, which moves the whole stack; a drop never lands inside
//! a stack (Perch puts a session or a file beside the whole stack), and a sub-session stays in its lead's stack.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the
//! app runs and `perch mod clone stock:tabs` copies. It may import only `react`, `react-dom`,
//! `@perch/sdk` and files beside it (docs/MOD-SDK.md). The strip's markers (`data-testid="tab-bar"`,
//! `data-tab-entry`, `.tab-bar__tab--active`) are what the tab drag and focus code look for.
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentIcon, beginTabDrag, cn, NewFilePrompt, NewSessionMenu, PageIcon, runCommand, segmentClass, Slot, startSession, TabDragLayer, TabMenu, tabStateClass, tip, openBrowserTab, openFileTab, useNewTabRequest, useWorkspaceTabs, } from "@perch/sdk";
import { BrowserIcon, FileIcon, ReviewIcon, TabCloseIcon } from "./icons.js";
// Every tab sits in a wrapper that reserves room for its x (pr-[1.6rem]).
// Operational text uses subtext-0: on surface-0 and panel-bg it contrasts at least as much as
// overlay-1 in every theme (themes.test.ts). The palettes set the absolute level.
// The strip scrolls (overflow-x-auto), which clips outlines, so focus rings sit inside (-2px).
const FOCUS = "focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]";
const TAB = `min-w-0 flex-1 gap-2 text-left px-3 pr-[1.6rem] text-[0.8rem] leading-[1.2] whitespace-nowrap ${FOCUS}`;
// Small gutters inset each tab from its neighbors and the strip edge, like a browser tab bar.
const TAB_SLOT = "relative flex min-w-[7rem] max-w-[16rem] flex-1 basis-0 items-stretch";
// A hairline in the gap between two unfocused tabs (no fill to tell them apart).
const SEPARATOR = "pointer-events-none absolute top-1/2 -left-[2px] h-4 w-px -translate-y-1/2 bg-overlay-0";
// "square" is the shell's soft corner (--radius-pane), not a literal square.
const TAB_SHAPE = (shape) => shape === "round" ? "rounded-full" : "rounded-ui";
const CLOSE = `absolute top-1/2 right-[0.25rem] grid h-[1.25rem] w-[1.25rem] cursor-pointer place-items-center rounded-ui bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [border:0] [font-family:inherit] [transform:translateY(-50%)] hover:text-fg ${FOCUS}`;
// The focused tab is filled, so its x hovers on panel-bg: fg is drawn against it in every theme
// (overlay-0 is fg-coloured in the terminal theme and hid the x).
const closeButton = (state) => cn(CLOSE, state === "focused" ? "text-fg hover:bg-panel-bg" : "hover:bg-surface-1");
// The stack's fold control: quiet text like the x, no fill at rest.
const COUNT = "absolute top-1/2 right-[1.6rem] grid h-[1.25rem] min-w-[1.25rem] cursor-pointer place-items-center rounded-ui bg-transparent px-1 text-[0.7rem] tabular-nums leading-none text-subtext-0 [border:0] [font-family:inherit] [transform:translateY(-50%)] hover:text-fg";
// A stack's mark: one hairline under its members, turning up at both ends. Between members it spans the strip's gap.
const BRACKET = "pointer-events-none absolute -bottom-[4px] h-[5px] border-0 border-b border-solid";
// Icons sit centred on the label's line, whatever box an icon's own SVG draws in.
const ICON = "flex shrink-0 items-center opacity-80";
const openMenu = (id, x, y) => runCommand("tab.menu", { id, x, y });
/** The sidebar's folded leads (its `foldedSessions`), shared with it: either place folds a stack in both. */
const FOLDED_KEY = "perch.sidebar.foldedSessions";
/** Sent on `window` when a sidebar setting changes, so the other screens read them again. */
const SETTINGS_EVENT = "perch:sidebar-settings";
function readFolded() {
    try {
        return JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]");
    }
    catch {
        return [];
    }
}
export function stacked(tabs) {
    const ids = new Set(tabs.map((tab) => tab.id));
    const leadOf = (tab) => (tab.kind === "session" && tab.parentId && tab.parentId !== tab.id && ids.has(tab.parentId) ? tab.parentId : undefined);
    const items = [];
    for (let at = 0; at < tabs.length; at++) {
        const tab = tabs[at];
        const members = [];
        while (tabs[at + 1] && leadOf(tabs[at + 1]) === tab.id)
            members.push(tabs[++at]);
        items.push(members.length ? { lead: tab, members } : { tab });
    }
    return items;
}
/** The bracket under a stack member: its ends turn up on the stack's first and last tab (both when folded). */
function stackMark(stack) {
    const start = !stack.open || stack.first;
    const end = !stack.open || stack.last;
    return cn(BRACKET, stack.active ? "border-accent" : "border-overlay-1", start ? "left-[3px] border-l rounded-bl-[3px]" : "-left-[3px]", end ? "right-[3px] border-r rounded-br-[3px]" : "right-0");
}
export default function TabBar() {
    const { tabs, activeId, hostId, cwd, workspace: ws, tabShape, draggingId } = useWorkspaceTabs();
    const [popoverAnchor, setPopoverAnchor] = useState(null);
    // The "+" menu's New file: the explorer's name prompt, creating in the workspace root.
    const [newFile, setNewFile] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const renameInputRef = useRef(null);
    const stripRef = useRef(null);
    const [folded, setFolded] = useState(readFolded);
    useEffect(() => {
        const reread = () => setFolded(readFolded());
        window.addEventListener(SETTINGS_EVENT, reread);
        return () => window.removeEventListener(SETTINGS_EVENT, reread);
    }, []);
    function toggleStack(lead) {
        const next = folded.includes(lead) ? folded.filter((id) => id !== lead) : [...folded, lead];
        try {
            localStorage.setItem(FOLDED_KEY, JSON.stringify(next));
        }
        catch { /* per-device convenience */ }
        setFolded(next);
        window.dispatchEvent(new Event(SETTINGS_EVENT));
    }
    useEffect(() => {
        if (renamingId)
            renameInputRef.current?.select();
    }, [renamingId]);
    // Cmd+T: open the harness picker as the "+" button would.
    useNewTabRequest(useCallback(() => {
        const button = stripRef.current?.querySelector('[data-testid="tab-new"]');
        if (button)
            setPopoverAnchor(button.getBoundingClientRect());
    }, []));
    // The strip scrolls when tabs overflow: keep the active one in view, also when the strip narrows.
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip)
            return;
        const reveal = () => strip.querySelector(".tab-bar__tab--active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
        reveal();
        const observer = new ResizeObserver(reveal);
        observer.observe(strip);
        return () => observer.disconnect();
    }, [activeId, tabs.length]);
    function commitRename() {
        if (renamingId) {
            const trimmed = renameValue.trim();
            if (trimmed)
                runCommand("tab.rename", { id: renamingId, name: trimmed });
        }
        setRenamingId(null);
    }
    function handleNewClick(e) {
        // The launcher always lets the user choose the CLI before starting it.
        setPopoverAnchor(e.currentTarget.getBoundingClientRect());
    }
    /** A session's tab. `entry` is the id it stands for in the strip (a folded stack's lead, which a drag moves). */
    function sessionTab(tab, separated, entry = tab.id, stack) {
        const { state } = tab;
        return (_jsxs("span", {
            className: cn(TAB_SLOT, stack && "tab-bar__stack-member"),
            "data-tab-entry": entry,
            "data-stack": stack?.lead,
            children: [
                separated && _jsx("span", {
                    className: SEPARATOR,
                    "aria-hidden": "true",
                    "data-testid": "tab-separator"
                }),
                stack && _jsx("span", {
                    className: stackMark(stack),
                    "aria-hidden": "true",
                    "data-testid": "tab-stack-mark",
                    "data-active": stack.active || undefined
                }),
                _jsx(Slot, {
                    name: "tab",
                    className: "flex min-w-0",
                    data: { id: tab.id, title: tab.title, label: tab.label, state, provider: tab.provider, blocked: tab.blocked, unseen: tab.unseen },
                    actions: {
                        open: () => runCommand("tab.select", { id: tab.id }),
                        rename: () => { setRenamingId(tab.id); setRenameValue(tab.title || ""); },
                        menu: (x, y) => openMenu(tab.id, Number(x), Number(y)),
                    },
                    children: _jsxs(TabBody, {
                        renaming: renamingId === tab.id,
                        className: cn("tab-bar__tab", segmentClass(), TAB, TAB_SHAPE(tabShape), tabStateClass[state], state === "focused" && "tab-bar__tab--active", tab.id === draggingId && "opacity-40"),
                        "data-pane-state": state,
                        "data-testid": `tab-${tab.id}`,
                        title: tab.title || "New session",
                        onPointerDown: (e) => beginTabDrag(e, entry, tab.label),
                        onClick: () => runCommand("tab.select", { id: tab.id }),
                        onContextMenu: (e) => {
                            e.preventDefault();
                            openMenu(tab.id, e.clientX, e.clientY);
                        },
                        onDoubleClick: () => {
                            setRenamingId(tab.id);
                            setRenameValue(tab.title || "");
                        },
                        children: [
                            _jsx("span", {
                                className: ICON,
                                "aria-hidden": "true",
                                children: _jsx(AgentIcon, {
                                    provider: tab.provider,
                                    size: 14
                                })
                            }),
                            renamingId === tab.id ? (_jsx("input", {
                                ref: renameInputRef,
                                type: "text",
                                className: "min-w-0 flex-1 bg-transparent p-0 text-inherit [font:inherit] outline-none",
                                "data-testid": "rename-input",
                                "aria-label": "Session name",
                                value: renameValue,
                                onChange: (e) => setRenameValue(e.target.value),
                                onBlur: commitRename,
                                onPointerDown: (e) => e.stopPropagation(),
                                onClick: (e) => e.stopPropagation(),
                                onKeyDown: (e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter")
                                        commitRename();
                                    if (e.key === "Escape")
                                        setRenamingId(null);
                                }
                            })) : (_jsx("span", {
                                className: "truncate",
                                children: tab.label
                            }))
                        ]
                    })
                }),
                stack && (!stack.open || stack.first) && (_jsx("button", {
                    type: "button",
                    className: cn(COUNT, state === "focused" ? "text-fg hover:bg-panel-bg" : "hover:bg-surface-1", FOCUS),
                    "data-testid": `tab-stack-count-${stack.lead}`,
                    title: stack.open ? "Fold the sub-sessions" : "Show the sub-sessions",
                    "aria-label": stack.open ? "Fold the sub-sessions" : `Show ${stack.others} sub-sessions`,
                    "aria-expanded": stack.open,
                    onClick: () => toggleStack(stack.lead),
                    children: stack.open ? "−" : `+${stack.others}`
                })),
                _jsx("button", {
                    type: "button",
                    className: closeButton(state),
                    "data-testid": `tab-close-${tab.id}`,
                    title: tip("Close session", "tabs.close"),
                    "aria-label": `Close ${tab.label}`,
                    onClick: () => runCommand("tab.close", { id: tab.id }),
                    children: _jsx(TabCloseIcon, {})
                })
            ]
        }, tab.id));
    }
    return (_jsxs("div", {
        ref: stripRef,
        className: "tab-bar flex min-w-0 flex-1 items-stretch gap-[3px] self-stretch overflow-x-auto px-2 py-[6px] max-[700px]:hidden",
        "data-testid": "tab-bar",
        "data-tauri-drag-region": true,
        children: [
            stacked(tabs).map((item, i, items) => {
                const prev = items[i - 1];
                const lastOf = (it) => ("tab" in it ? it.tab : it.members[it.members.length - 1]);
                const separated = (tab, before) => !!before && tab.state !== "focused" && before.state !== "focused";
                if ("tab" in item) {
                    const { tab } = item;
                    return tab.kind === "session" ? sessionTab(tab, separated(tab, prev && lastOf(prev))) : (_jsx(ResourceTab, {
                        tab: tab,
                        tabShape: tabShape,
                        dragging: tab.id === draggingId,
                        separated: separated(tab, prev && lastOf(prev))
                    }, tab.id));
                }
                const { lead, members } = item;
                const all = [lead, ...members];
                if (folded.includes(lead.id)) {
                    // Folded: the member on screen, else the lead, stands for the stack and drags as it.
                    const shown = members.find((member) => member.state !== "hidden" && lead.state === "hidden") ?? lead;
                    return sessionTab(shown, separated(shown, prev && lastOf(prev)), lead.id, { lead: lead.id, others: members.length, open: false, active: all.some((t) => t.state === "focused") });
                }
                // Open: the members side by side, separated as any tabs. They stay the strip's own children (no wrapper),
                // so a drag measures and slides each tab as any other.
                return all.map((tab, at) => sessionTab(tab, separated(tab, at > 0 ? all[at - 1] : prev && lastOf(prev)), tab.id, {
                    lead: lead.id, others: members.length, open: true, first: at === 0, last: at === all.length - 1, active: all.some((t) => t.state === "focused"),
                }));
            }),
            _jsx("button", {
                type: "button",
                className: cn(segmentClass(), `w-7 shrink-0 justify-center text-[0.8rem] leading-none ${FOCUS}`, TAB_SHAPE(tabShape)),
                "data-testid": "tab-new",
                title: tip("New session in this workspace", "tabs.new"),
                "aria-label": "New session in this workspace",
                onClick: handleNewClick,
                children: _jsx("svg", {
                    width: "12",
                    height: "12",
                    viewBox: "0 0 12 12",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "1.3",
                    strokeLinecap: "round",
                    "aria-hidden": "true",
                    children: _jsx("path", { d: "M6 2v8M2 6h8" })
                })
            }),
            _jsx(TabMenu, {}),
            _jsx(TabDragLayer, {}),
            popoverAnchor && (_jsx(NewSessionMenu, {
                hostId: hostId,
                cwd: cwd ?? "~",
                anchorRect: popoverAnchor,
                onClose: () => setPopoverAnchor(null),
                onSelect: (selectedCwd, provider) => startSession(hostId, selectedCwd, provider),
                extras: ws ? [
                    { id: "browser", label: "New browser", icon: _jsx(BrowserIcon, {}), onSelect: () => openBrowserTab(ws.id) },
                    { id: "file", label: "New file", icon: _jsx(FileIcon, {}), onSelect: () => setNewFile(true) },
                ] : undefined
            })),
            newFile && ws && (_jsx(NewFilePrompt, {
                workspaceId: ws.id,
                workspacePath: ws.path,
                onClose: () => setNewFile(false),
                onOpenFile: (path) => openFileTab(ws.id, path)
            }))
        ]
    }));
}
/** A file's, review's, browser page's or mod's tab: its name, a ● while a file has unsaved changes, and ×. */
/** A session tab's body: a button, or while it is renamed the same box holding the name field
 * (a field inside a button would lose its keys and clicks to the button). */
function TabBody({ renaming, children, onPointerDown, onClick, onDoubleClick, ...rest }) {
    if (!renaming)
        return _jsx("button", {
            type: "button",
            ...rest,
            onPointerDown: onPointerDown,
            onClick: onClick,
            onDoubleClick: onDoubleClick,
            children: children
        });
    const { type: _type, ...box } = rest;
    return _jsx("div", {
        ...box,
        children: children
    });
}
function ResourceTab({ tab, tabShape, dragging, separated }) {
    const { id, state, kind } = tab;
    const review = kind === "review";
    const browser = kind === "browser";
    const testId = review ? `review-tab-${tab.workspaceId}` : browser ? "browser-tab" : kind === "mod" ? `mod-tab-${tab.mod}` : `file-tab-${tab.path}`;
    return (_jsxs("span", {
        className: TAB_SLOT,
        "data-tab-entry": id,
        children: [
            separated && _jsx("span", {
                className: SEPARATOR,
                "aria-hidden": "true",
                "data-testid": "tab-separator"
            }),
            _jsxs("button", {
                type: "button",
                className: cn("tab-bar__tab", segmentClass(), TAB, TAB_SHAPE(tabShape), tabStateClass[state], state === "focused" && "tab-bar__tab--active", dragging && "opacity-40"),
                "data-pane-state": state,
                "data-testid": testId,
                title: review ? "Changes" : browser ? tab.url || (tab.blank ? "New browser" : tab.path) : tab.path,
                onPointerDown: (e) => beginTabDrag(e, id, tab.label),
                onClick: () => runCommand("tab.select", { id }),
                onDoubleClick: () => runCommand("tab.pin", { id }),
                onContextMenu: (e) => {
                    e.preventDefault();
                    openMenu(id, e.clientX, e.clientY);
                },
                children: [
                    _jsx("span", {
                        className: ICON,
                        "aria-hidden": "true",
                        children: browser ? _jsx(PageIcon, {
                            icon: tab.icon,
                            fallback: _jsx(BrowserIcon, {})
                        }) : review ? _jsx(ReviewIcon, {}) : _jsx(FileIcon, {})
                    }),
                    _jsx("span", {
                        className: cn("block truncate", tab.preview && "italic"),
                        children: tab.label
                    }),
                    tab.dirty && _jsx("span", {
                        className: "text-subtext-0",
                        "aria-label": "unsaved changes",
                        children: " \u25CF"
                    })
                ]
            }),
            _jsx("button", {
                type: "button",
                className: closeButton(state),
                "data-testid": review ? `review-tab-close-${tab.workspaceId}` : browser ? "browser-tab-close" : `file-tab-close-${tab.path}`,
                "aria-label": `Close ${tab.label}`,
                onClick: () => runCommand("tab.close", { id }),
                children: _jsx(TabCloseIcon, {})
            })
        ]
    }));
}
