// main.tsx of Perch's stock screen "stock:folder-browser", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Folder browser, the stock screen `stock:folder-browser`: picks a folder on a host (a new project, a session's
//! folder). The sidebar's Add project and a package's `FolderBrowser` from `@perch/sdk` place it; or the person's
//! package chosen for it (`perch mod use stock:folder-browser <id>`) with the same props.
//!
//! Browse (default): breadcrumb path, folders only (a small git badge), a live filter, Enter or a click to go in,
//! Backspace on an empty filter to go up, and "Use this folder" (also the `directory.use` keys). Type path: a plain
//! input for paths browsing cannot reach. `browse(path?)` lists a folder through the host (the core routes a remote
//! host's listing); the last folder per host is remembered in this browser's localStorage.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:folder-browser` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { buttonClass as button, shortcutFor, shortcutLabel, useKeybindings } from "@perch/sdk";
function lastPathKey(hostId) {
    return `perch.dirBrowser.lastPath.${hostId}`;
}
function getLastPath(hostId) {
    try {
        return localStorage.getItem(lastPathKey(hostId)) ?? undefined;
    }
    catch {
        return undefined;
    }
}
function setLastPath(hostId, path) {
    try {
        localStorage.setItem(lastPathKey(hostId), path);
    }
    catch {
        // ignore (private browsing / quota)
    }
}
const EMPTY = "px-3 py-[0.4rem] text-[0.76rem] text-subtext-0";
// A function, not a constant: `@perch/sdk` may still be loading while this module runs.
const useButton = () => button({ variant: "primary", size: "sm", className: "px-[0.65rem] py-[0.32rem] text-[0.78rem]" });
export default function FolderBrowser({ hostId, onUseFolder, browse }) {
    // Re-drawn when the person changes a binding.
    useKeybindings();
    const folderKeys = [shortcutLabel("directory.use"), shortcutLabel("directory.useAlt")].filter(Boolean).join(" / ");
    const [mode, setMode] = useState("browse");
    const [typedPath, setTypedPath] = useState("");
    const [currentPath, setCurrentPath] = useState(null);
    const [parent, setParent] = useState(undefined);
    const [entries, setEntries] = useState([]);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(false);
    const requestSeq = useRef(0);
    const filterInputRef = useRef(null);
    function load(path) {
        const seq = ++requestSeq.current;
        setLoading(true);
        browse(path).then((result) => {
            if (requestSeq.current !== seq)
                return; // stale reply, a newer nav happened
            setCurrentPath(result.path);
            setParent(result.parent);
            setEntries(result.entries);
            setFilter("");
            setLoading(false);
            setLastPath(hostId, result.path);
        });
    }
    // Load the initial listing once, at the last-used path for this host (else
    // the server defaults to $HOME).
    useEffect(() => {
        load(getLastPath(hostId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostId]);
    useEffect(() => {
        if (mode === "browse")
            filterInputRef.current?.focus();
    }, [mode, currentPath]);
    const filteredEntries = filter.trim()
        ? entries.filter((e) => e.name.toLowerCase().includes(filter.trim().toLowerCase()))
        : entries;
    function goUp() {
        if (parent)
            load(parent);
    }
    function descend(entry) {
        load(entry.path);
    }
    function confirmCurrent() {
        if (currentPath) {
            setLastPath(hostId, currentPath);
            onUseFolder(currentPath);
        }
    }
    function handleFilterKeyDown(e) {
        if (e.isDefaultPrevented() || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)
            return;
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            const first = filteredEntries[0];
            if (first)
                descend(first);
            return;
        }
        if (e.key === "Backspace" && filter === "") {
            e.preventDefault();
            goUp();
        }
    }
    // Breadcrumb segments for the current path, each clickable to jump there.
    const segments = (currentPath ?? "").split("/").filter(Boolean);
    const isAbsolute = (currentPath ?? "").startsWith("/");
    return (_jsxs("div", {
        className: "flex min-h-[13rem] w-full flex-1 flex-col",
        "data-testid": "dir-browser",
        onKeyDown: (e) => {
            if (shortcutFor(e.nativeEvent, "directory")?.scope !== "directory")
                return;
            e.preventDefault();
            e.stopPropagation();
            if (mode === "type") {
                if (typedPath.trim())
                    onUseFolder(typedPath.trim());
            }
            else
                confirmCurrent();
        },
        children: [
            _jsx("div", {
                className: "flex shrink-0 justify-end px-2 py-[0.2rem]",
                children: _jsx("button", {
                    type: "button",
                    className: button({ size: "sm" }),
                    "data-testid": "dir-browser-mode-toggle",
                    onClick: () => setMode(mode === "browse" ? "type" : "browse"),
                    children: mode === "browse" ? "Type path" : "Browse"
                })
            }),
            mode === "browse" ? (_jsxs(_Fragment, { children: [_jsxs("div", {
                        className: "flex shrink-0 items-center gap-[0.3rem] overflow-hidden px-2 py-[0.15rem]",
                        title: currentPath ?? "",
                        children: [
                            _jsx("button", {
                                type: "button",
                                className: button({ size: "sm", className: "leading-none text-fg" }),
                                "data-testid": "dir-browser-up",
                                disabled: !parent,
                                onClick: goUp,
                                title: "Go up one level",
                                children: "\u2191"
                            }),
                            _jsxs("span", {
                                className: "min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-subtext-0",
                                children: [
                                    isAbsolute ? "/" : "",
                                    segments.map((seg, i) => {
                                        const segPath = "/" + segments.slice(0, i + 1).join("/");
                                        const isLast = i === segments.length - 1;
                                        return (_jsxs("span", { children: [_jsx("button", {
                                                    type: "button",
                                                    className: "cursor-pointer bg-transparent p-0 text-[0.72rem] text-subtext-0 [font-family:inherit] [border:none] [&:hover:not(:disabled)]:text-accent disabled:cursor-default disabled:text-fg",
                                                    disabled: isLast,
                                                    onClick: () => load(segPath),
                                                    children: seg
                                                }), !isLast && "/"] }, segPath));
                                    })
                                ]
                            })
                        ]
                    }), _jsx("input", {
                        type: "text",
                        ref: filterInputRef,
                        className: "mx-2 my-[0.2rem] shrink-0 rounded-ui bg-surface-1 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]",
                        "data-testid": "dir-browser-filter",
                        placeholder: "Filter\u2026",
                        value: filter,
                        onChange: (e) => setFilter(e.target.value),
                        onKeyDown: handleFilterKeyDown
                    }), _jsx("div", {
                        className: "max-h-[260px] min-h-[60px] flex-1 overflow-y-auto py-[0.1rem]",
                        children: loading ? (_jsx("div", {
                            className: EMPTY,
                            children: "Loading\u2026"
                        })) : filteredEntries.length === 0 ? (_jsx("div", {
                            className: EMPTY,
                            children: "No subfolders"
                        })) : (filteredEntries.map((entry) => (_jsxs("button", {
                            type: "button",
                            className: "flex w-full cursor-pointer items-center justify-between bg-transparent px-3 py-[0.32rem] text-left text-[0.8rem] text-fg [font-family:inherit] [border:none] hover:bg-surface-1",
                            "data-testid": `dir-browser-entry-${entry.name}`,
                            onClick: () => descend(entry),
                            title: entry.path,
                            children: [
                                _jsx("span", {
                                    className: "overflow-hidden text-ellipsis whitespace-nowrap",
                                    children: entry.name
                                }),
                                entry.isGitRepo && (_jsx("span", {
                                    className: "ml-[0.4rem] shrink-0 rounded-ui bg-surface-1 px-[0.3rem] py-0 text-[0.62rem] text-accent",
                                    title: "Git repository",
                                    children: "git"
                                }))
                            ]
                        }, entry.path))))
                    }), _jsx("div", {
                        className: "flex shrink-0 justify-end px-2 py-[0.4rem]",
                        children: _jsx("button", {
                            type: "button",
                            className: useButton(),
                            "data-testid": "dir-browser-use",
                            disabled: !currentPath,
                            onClick: confirmCurrent,
                            title: folderKeys ? `Use this folder (${folderKeys})` : "Use this folder",
                            children: "Use this folder"
                        })
                    })] })) : (_jsxs("div", {
                className: "flex shrink-0 items-center gap-[0.35rem] px-2 py-[0.4rem]",
                children: [
                    _jsx("input", {
                        type: "text",
                        className: "min-w-0 flex-1 rounded-ui bg-surface-1 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]",
                        "data-testid": "project-path-input",
                        placeholder: "/path/to/project",
                        value: typedPath,
                        onChange: (e) => setTypedPath(e.target.value),
                        onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.nativeEvent.isComposing && typedPath.trim())
                                onUseFolder(typedPath.trim());
                        }
                    }),
                    _jsx("button", {
                        type: "button",
                        className: useButton(),
                        "data-testid": "dir-browser-use",
                        disabled: !typedPath.trim(),
                        onClick: () => {
                            if (typedPath.trim())
                                onUseFolder(typedPath.trim());
                        },
                        children: "Use this path"
                    })
                ]
            }))
        ]
    }));
}
