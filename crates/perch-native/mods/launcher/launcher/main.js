// main.tsx of Perch's stock screen "stock:launcher", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Launcher, the stock screen `stock:launcher`: the centered, keyboard-only "New session" picker. Cmd+Shift+T (or the
//! sidebar's New session button) opens it on the project list; Enter picks a project, then the same filterable list
//! offers that project's agents and terminals, a browser and a new file. Type to filter, arrows and Enter, 1-9 jump,
//! Backspace on an empty filter goes back, Escape closes. Perch opens it; or the person's package chosen for it
//! (`perch mod use stock:launcher <id>`) with the same props.
//!
//! The host's projects (each with the workspace a new tab lands in) and the agents it can start (`useAgentChoices`)
//! are Perch's, and so is what each row does (`actions`: start a session, open a browser or a file, add a project).
//! The new file's name is `NewFilePrompt` from `@perch/sdk`, so a copy chosen for `stock:file-menu` asks it.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:launcher` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AgentIcon, cn, NewFilePrompt, useAgentChoices } from "@perch/sdk";
const ICON = { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const BrowserIcon = () => _jsxs("svg", {
    ...ICON,
    children: [
        _jsx("circle", {
            cx: "8",
            cy: "8",
            r: "6"
        }),
        _jsx("path", { d: "M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" })
    ]
});
const FileIcon = () => _jsx("svg", {
    ...ICON,
    children: _jsx("path", { d: "M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5zM9 2v3.5h3.5" })
});
export default function Launcher({ hostId, projects, activeProjectId, onClose, actions }) {
    const { connected, discovery, state: catalogState, error: catalogError, choices, rememberChoice, manage } = useAgentChoices(hostId);
    const agentsReady = connected && !(discovery && catalogState !== "ready");
    // `stage.target` is the chosen project, or null for "No project" (a quickchat in the home folder).
    const [stage, setStage] = useState(null);
    const [newFile, setNewFile] = useState(null);
    const [filter, setFilter] = useState("");
    const [active, setActive] = useState(() => Math.max(0, projects.findIndex((p) => p.id === activeProjectId)));
    // Dismissing returns focus to where it was (the terminal), not to <body>.
    useEffect(() => {
        const previous = document.activeElement;
        return () => { if (!document.activeElement || document.activeElement === document.body)
            previous?.focus?.(); };
    }, []);
    function pick(target) {
        setStage({ target });
        setFilter("");
        setActive(0);
    }
    let rows;
    let title;
    if (!stage) {
        title = "New session in…";
        rows = [
            ...projects.map((p) => ({ id: p.id, label: p.name || p.path, detail: p.path, run: () => pick(p) })),
            { id: "add", label: "Add project…", muted: true, run: () => { onClose(); actions.addProject(); } },
            { id: "none", label: "No project", detail: "Quickchat in ~", muted: true, run: () => pick(null) },
        ];
    }
    else {
        const { target } = stage;
        // The workspace the tab lands in (Perch's choice: the one on screen if it belongs to the project, else its first).
        const ws = target?.workspace ?? null;
        const cwd = target ? ws?.path ?? target.path : "~";
        title = `New in ${target ? target.name || target.path : "No project"}`;
        rows = [
            ...choices.map((choice) => ({
                id: choice.id, label: choice.label, icon: _jsx(AgentIcon, { provider: choice.id }), disabled: !agentsReady,
                run: () => {
                    rememberChoice(choice.id);
                    actions.start(cwd, choice.id);
                    onClose();
                },
            })),
            ...(ws ? [
                { id: "browser", label: "New browser", icon: _jsx(BrowserIcon, {}), run: () => { actions.openBrowser(ws.id); onClose(); } },
                { id: "file", label: "New file", icon: _jsx(FileIcon, {}), run: () => { actions.focusWorkspace(ws.id); setNewFile({ id: ws.id, path: ws.path }); } },
            ] : []),
            ...(discovery ? [{ id: "manage", label: "Manage agents…", muted: true, run: () => { onClose(); manage(); } }] : []),
        ];
    }
    const needle = filter.trim().toLowerCase();
    const visible = needle ? rows.filter((r) => `${r.label} ${r.detail ?? ""}`.toLowerCase().includes(needle)) : rows;
    const run = (row) => { if (row && !row.disabled)
        row.run(); };
    if (newFile) {
        return _jsx(NewFilePrompt, {
            workspaceId: newFile.id,
            workspacePath: newFile.path,
            onClose: onClose,
            onOpenFile: (path) => actions.openFile(newFile.id, path)
        });
    }
    return createPortal(_jsx("div", {
        className: "fixed inset-0 z-[2000] flex items-start justify-center bg-[rgba(0,0,0,0.55)] pt-[12vh]",
        onClick: onClose,
        children: _jsxs("div", {
            className: "flex w-[min(480px,calc(100vw_-_2rem))] max-h-[min(420px,calc(100dvh_-_16vh_-_2rem))] flex-col overflow-hidden rounded-ui bg-panel-bg shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "New session",
            "data-testid": "new-session-dialog",
            onClick: (e) => e.stopPropagation(),
            children: [
                _jsx("p", {
                    className: "m-0 shrink-0 px-4 pt-3 text-[0.72rem] text-subtext-0",
                    children: title
                }),
                _jsx("input", {
                    type: "text",
                    autoFocus: true,
                    role: "combobox",
                    "aria-expanded": "true",
                    "aria-controls": "new-session-list",
                    "aria-activedescendant": visible[active] ? `new-session-${visible[active].id}` : undefined,
                    "aria-label": "Filter",
                    placeholder: "Type to filter, \u2191\u2193 Enter, 1\u20139",
                    "data-testid": "new-session-filter",
                    className: "shrink-0 bg-panel-bg px-4 py-2 [font-family:inherit] text-[0.95rem] text-fg [outline:none] placeholder:text-subtext-0",
                    value: filter,
                    onChange: (e) => { setFilter(e.target.value); setActive(0); },
                    onKeyDown: (e) => {
                        if (e.key === "Escape") {
                            onClose();
                            return;
                        }
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            if (visible.length)
                                setActive((active + (e.key === "ArrowDown" ? 1 : visible.length - 1)) % visible.length);
                        }
                        else if (e.key === "Enter") {
                            e.preventDefault();
                            run(visible[active]);
                        }
                        else if (e.key === "Backspace" && !filter && stage) {
                            e.preventDefault();
                            setStage(null);
                            setActive(Math.max(0, projects.findIndex((p) => p.id === stage.target?.id)));
                        }
                        else if (!filter && /^[1-9]$/.test(e.key) && visible[Number(e.key) - 1]) {
                            e.preventDefault();
                            run(visible[Number(e.key) - 1]);
                        }
                    }
                }, stage ? "action" : "project"),
                _jsxs("div", {
                    id: "new-session-list",
                    role: "listbox",
                    className: "min-h-0 flex-1 overflow-y-auto py-1",
                    children: [
                        visible.map((row, i) => (_jsxs("button", {
                            type: "button",
                            role: "option",
                            "aria-selected": i === active,
                            tabIndex: -1,
                            id: `new-session-${row.id}`,
                            "data-testid": `new-session-row-${row.id}`,
                            title: row.detail,
                            disabled: row.disabled,
                            className: cn("flex w-full cursor-pointer items-center gap-2 px-4 py-[0.45rem] text-left [font-family:inherit] text-[0.85rem] text-fg disabled:cursor-not-allowed disabled:opacity-40", row.muted && "text-subtext-0", i === active ? "bg-surface-1" : "[background:none]"),
                            onMouseMove: () => setActive(i),
                            onClick: row.run,
                            children: [
                                row.icon,
                                _jsx("span", {
                                    className: "shrink-0",
                                    children: row.label
                                }),
                                row.detail && _jsx("span", {
                                    className: "ml-auto min-w-0 truncate text-[0.72rem] text-subtext-0",
                                    children: row.detail
                                }),
                                !filter && i < 9 && _jsx("kbd", {
                                    className: cn("text-[0.7rem] text-subtext-0 [font-family:inherit]", !row.detail && "ml-auto"),
                                    children: i + 1
                                })
                            ]
                        }, row.id))),
                        !visible.length && _jsx("p", {
                            className: "m-0 px-4 py-2 text-[0.75rem] text-subtext-0",
                            role: "status",
                            children: "No match."
                        }),
                        stage && discovery && catalogState === "loading" && _jsx("p", {
                            className: "m-0 px-4 py-2 text-[0.75rem] text-subtext-0",
                            role: "status",
                            children: "Checking agents\u2026"
                        }),
                        stage && discovery && catalogState === "error" && _jsx("p", {
                            className: "m-0 px-4 py-2 text-[0.75rem] text-red",
                            role: "alert",
                            children: catalogError
                        })
                    ]
                })
            ]
        })
    }), document.body);
}
