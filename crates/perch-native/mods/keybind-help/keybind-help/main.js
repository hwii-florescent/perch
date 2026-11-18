// main.tsx of Perch's stock screen "stock:keybind-help", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Keybind help, the stock screen `stock:keybind-help`: a searchable modal listing every key
//! binding (`useKeybindings()`, with the person's overrides), grouped by `KeybindGroup`. Perch opens
//! it on Cmd+/, plain `?` (outside inputs) or the leader chord `Ctrl+Space, ?`, and closes it on Esc
//! or a click outside.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS
//! the app runs and `perch mod clone stock:keybind-help` copies. It may import only `react`,
//! `react-dom`, `@perch/sdk` and files beside it (docs/MOD-SDK.md).
//!
//! Portal-rendered into `document.body`, same structural pattern as `Navigator.tsx` (backdrop +
//! centered panel).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, useKeybindings } from "@perch/sdk";
const GROUP_LABELS = {
    global: "Global",
    tabs: "Tabs",
    nests: "Workspaces and projects",
    panes: "Splits and panes",
    terminal: "Terminal",
    leader: "Leader and follow-up keys",
    resize: "Resize mode",
    editor: "File editor",
    navigator: "Navigator",
    directory: "Folder picker",
    mods: "Package commands",
};
const GROUP_ORDER = ["global", "tabs", "nests", "panes", "terminal", "editor", "navigator", "directory", "leader", "resize", "mods"];
export default function KeybindHelp({ open, onClose }) {
    const [query, setQuery] = useState("");
    useEffect(() => {
        if (open)
            setQuery("");
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        function handleKeyDown(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);
    const keybindings = useKeybindings();
    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = keybindings.filter((k) => !q || k.keys.toLowerCase().includes(q) || k.description.toLowerCase().includes(q));
        return GROUP_ORDER.map((group) => ({
            group,
            entries: filtered.filter((k) => k.group === group),
        })).filter((g) => g.entries.length > 0);
    }, [query, keybindings]);
    if (!open)
        return null;
    const modal = (_jsx("div", {
        className: "fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(0,0,0,0.55)]",
        onClick: onClose,
        children: _jsxs("div", {
            className: "flex w-[min(560px,calc(100vw_-_2rem))] max-h-[calc(100dvh_-_4rem)] flex-col overflow-hidden rounded-ui bg-panel-bg shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Keybindings",
            "data-testid": "keybind-help",
            onClick: (e) => e.stopPropagation(),
            children: [
                _jsxs("div", {
                    className: "flex shrink-0 items-center justify-between px-4 pt-[0.85rem] pb-3",
                    children: [
                        _jsx("h2", {
                            className: "m-0 text-[1rem] font-semibold text-fg",
                            children: "Keybindings"
                        }),
                        _jsx("button", {
                            type: "button",
                            className: "cursor-pointer rounded-ui bg-transparent px-[0.35rem] py-[0.2rem] text-[1rem] leading-none text-subtext-0 [transition:color_0.12s_ease,background_0.12s_ease] [border:none] hover:bg-surface-1 hover:text-fg",
                            "aria-label": "Close keybind help",
                            onClick: onClose,
                            children: _jsx(CloseIcon, {})
                        })
                    ]
                }),
                _jsx("input", {
                    type: "text",
                    className: "shrink-0 bg-surface-1 px-4 py-[0.6rem] [font-family:inherit] text-[0.85rem] text-fg [outline:none]",
                    "data-testid": "keybind-help-search",
                    placeholder: "Search keybindings\u2026",
                    value: query,
                    onChange: (e) => setQuery(e.target.value),
                    autoFocus: true
                }),
                _jsxs("div", {
                    className: "flex-1 overflow-y-auto py-2",
                    children: [
                        grouped.length === 0 && _jsx("div", {
                            className: "p-4 text-center text-[0.82rem] text-subtext-0",
                            children: "No matching keybindings"
                        }),
                        grouped.map(({ group, entries }) => (_jsxs("section", {
                            className: "px-4 py-2",
                            children: [
                                _jsx("h3", {
                                    className: "mx-0 mt-0 mb-[0.4rem] text-[0.78rem] font-semibold tracking-[0.04em] text-subtext-0 uppercase",
                                    children: GROUP_LABELS[group]
                                }),
                                _jsx("ul", {
                                    className: "m-0 list-none p-0",
                                    children: entries.map((entry) => (_jsxs("li", {
                                        className: "flex items-center gap-3 py-[0.3rem]",
                                        children: [
                                            _jsx("kbd", {
                                                className: "min-w-36 shrink-0 rounded-ui bg-surface-1 px-[0.45rem] py-[0.1rem] text-center [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[0.72rem] text-accent",
                                                children: entry.keys
                                            }),
                                            _jsx("span", {
                                                className: "text-[0.8rem] text-fg",
                                                children: entry.description
                                            })
                                        ]
                                    }, `${group}-${entry.keys}`)))
                                })
                            ]
                        }, group)))
                    ]
                })
            ]
        })
    }));
    return createPortal(modal, document.body);
}
