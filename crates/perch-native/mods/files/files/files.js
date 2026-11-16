// files.tsx of Perch's stock screen "stock:files", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Files, the stock screen `stock:files`'s presentation: the explorer (tree, search, keyboard cursor, the entry
//! menu) and a file's editor pane (title, Markdown Source/Preview, wrap, preview, reload, save, conflict and reload
//! confirmations, the status line). Everything it shows and does comes from `useWorkspaceFiles` (Perch's
//! `filesystemStore`: directory listings, server-owned draft buffers, expected versions, truncated-preview
//! protection, save intents and external-change conflicts), so a clone changes how files look and are used, never
//! how a draft is kept or saved. The editor (CodeMirror), media/PDF viewer and Markdown renderer are Perch's
//! engines, placed here as `CodeEditor`, `FileAsset` and `MarkdownPreview`; the Markdown sanitizer is fixed.
//! Tree expansion, the search box and the cursor are this view's own and start over when it is remounted, as
//! before; a draft never does.
import { memo, Suspense, useEffect, useRef, useState } from "react";
import { assetKind, Chevron, cn, CodeEditor, FileAsset, FileEntryMenu, FileIcon, GitMarker, ghostButton as GHOST_BUTTON, MarkdownPreview, shortcutLabel, useWorkspaceFiles, useZoom, } from "@perch/sdk";
import { explorerKey, flattenTree, treeItems, treeWindow } from "./explorerNav.js";
/** A workspace-relative path as the store keys it: no `./`, no leading or trailing slash. */
function normalizePath(path) {
    if (!path || path === ".")
        return "";
    return path.trim().replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
}
/** The row under the keyboard cursor, ringed while the tree has focus. */
const CURSOR_RING = "group-focus/tree:ring-1 group-focus/tree:ring-inset group-focus/tree:ring-overlay-1";
// The legacy rules set `font:` shorthands with an undefined variable and with `inherit`
// inside the shorthand (invalid), so text here inherits the page font and buttons keep the browser's default:
// `[font:inherit]` only where an element would otherwise fall back to its UA font.
// The pane's own width, not the viewport's, decides the narrow layout (`@container` below).
// Tokens kept for e2e/CSS: `workspace-files`, `__mobile-explorer`, `__file-title`, `__save`.
const SECTION = "workspace-files relative flex h-full min-h-0 w-full min-w-0 flex-col bg-[var(--workspace-tools-bg,var(--panel-bg))] text-fg [box-shadow:none] [container-type:inline-size]";
const EMPTY = "grid min-h-full content-center justify-items-start gap-[0.35rem] p-5 text-[0.72rem] text-subtext-0";
const PREVIEW_STATE = "shrink-0 px-[0.7rem] py-[0.55rem] text-[0.68rem] text-subtext-0";
const COMPARE_LABEL = "mb-[0.2rem] block text-subtext-0 uppercase";
const BTN = "min-h-[1.8rem] cursor-pointer rounded-ui bg-surface-0 px-[0.48rem] py-[0.28rem] text-subtext-0";
const BTN_HOVER = "hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg";
const DANGER = "text-red!";
const ACTIONS = "flex shrink-0 items-center gap-[0.35rem]";
const TREE_STATE = "px-[0.65rem] py-[0.45rem] text-[0.68rem] text-subtext-0";
const TREE_BUTTON = "ml-[0.35rem] cursor-pointer rounded-ui bg-surface-1 px-[0.26rem] py-[0.12rem] text-inherit [font:inherit]";
const CODE = "text-overlay-1 [font:inherit]";
const PRE = "m-0 overflow-auto bg-surface-0 p-[0.55rem] text-fg whitespace-pre-wrap [font:inherit] [overflow-wrap:anywhere]";
const BANNER = "shrink-0 bg-[color-mix(in_srgb,var(--yellow)_8%,transparent)] text-[0.66rem] text-yellow";
// Match VS Code's explorer balance: 22px rows, 13px text, an 8px indent per level,
// and a 16px twistie cell holding a 10px chevron.
// Only phone viewports get 44px targets: a narrow desktop drawer must stay compact.
const ROW_FONT = "text-[length:calc(13px*var(--zoom,1))]";
const ROW_MIN_H = "min-h-[calc(22px*var(--zoom,1))]";
const HEADER_ICON = cn(GHOST_BUTTON, "grid size-6 place-items-center p-0");
function HeaderIcon({ label, onClick, active, children }) {
    return (_jsx("button", {
        type: "button",
        className: cn(HEADER_ICON, active && "text-fg"),
        "aria-label": label,
        title: label,
        onClick: onClick,
        children: _jsx("svg", {
            viewBox: "0 0 16 16",
            width: "16",
            height: "16",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            children: children
        })
    }));
}
function basename(path) {
    const parts = path.replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || path;
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatModifiedAt(metadata) {
    if (!metadata?.modifiedAtMs)
        return "";
    const date = new Date(metadata.modifiedAtMs);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
/** A folder's state line. */
const TREE_LINES = { loading: "Loading…", truncated: "Large folder · narrow the view to load more", empty: "Empty folder" };
/** A long tree draws the rows in view and a chunk of this many more on each side (`treeWindow`). */
const TREE_CHUNK = 16;
/** The workspace's tree as one flat list of rows, each indented by its depth as the nested folders were; a long one
 * draws only the rows around the view, with room kept above and below for the rest. */
function FileTree({ expanded, selectedPath, cursor, trees, decorations, scroller, onScroll, onToggle, onOpenFile, onMenu, }) {
    const zoom = useZoom();
    const listRef = useRef(null);
    // The latest handlers, behind one ref the rows keep: a row draws again only when what it shows changes.
    const act = useRef({ onToggle, onOpenFile, onMenu });
    act.current = { onToggle, onOpenFile, onMenu };
    const items = treeItems(trees, expanded);
    // Where the view is, in rows: the first row in it and how many it shows (a tall drawer's worth until measured).
    const [view, setView] = useState({ top: 0, shown: 48 });
    const rowHeight = () => listRef.current?.querySelector("[data-path]")?.getBoundingClientRect().height || 22 * zoom;
    const rows = (at) => treeWindow(items.length, at.top, at.shown, TREE_CHUNK);
    const { start, end } = rows(view);
    // The view measured against the list in its scroll area; the tree draws again only when that changes its rows.
    onScroll.current = () => {
        const area = scroller.current?.getBoundingClientRect();
        const list = listRef.current?.getBoundingClientRect();
        if (!area || !list)
            return;
        const height = rowHeight();
        const now = { top: Math.max(0, (area.top - list.top) / height), shown: Math.ceil(area.height / height) };
        const next = rows(now);
        if (next.start !== start || next.end !== end)
            setView(now);
    };
    // The cursor's row is drawn wherever the keyboard took it.
    useEffect(() => {
        const at = cursor ? items.findIndex((item) => item.kind === "entry" && item.entry.path === cursor) : -1;
        if (at >= 0 && (at < start || at >= end))
            setView({ ...view, top: at });
    }, [cursor]);
    if (!trees[""])
        return null;
    const height = rowHeight();
    // One box per chunk, always there: those in view hold their rows, the rest only their height. A move fills one box
    // and empties another, so the rows that stay are not drawn again (in Perch's own runtime a list that gains or loses
    // a child is described again whole).
    const chunks = Array.from({ length: Math.ceil(items.length / TREE_CHUNK) }, (_, at) => at * TREE_CHUNK);
    return (_jsx("div", {
        ref: listRef,
        className: "min-w-0",
        "data-testid": "workspace-file-tree-root",
        children: chunks.map((first) => {
            const last = Math.min(items.length, first + TREE_CHUNK);
            if (first >= end || last <= start)
                return _jsx("div", {
                    "aria-hidden": true,
                    style: { height: (last - first) * height }
                }, first);
            return _jsx("div", {
                className: "min-w-0",
                children: items.slice(first, last).map(row)
            }, first);
        })
    }));
    function row(item) {
        const indent = item.level ? { marginLeft: `${item.level * 0.5}rem` } : undefined;
        if (item.kind === "error") {
            return (_jsxs("div", {
                className: cn(TREE_STATE, "text-red"),
                style: indent,
                children: [
                    item.error || "Could not load folder.",
                    _jsx("button", {
                        type: "button",
                        className: TREE_BUTTON,
                        onClick: () => onToggle(item.entry),
                        children: "Retry"
                    })
                ]
            }, `${item.path}\0error`));
        }
        if (item.kind !== "entry")
            return _jsx("div", {
                className: TREE_STATE,
                style: indent,
                children: TREE_LINES[item.kind]
            }, `${item.path}\0${item.kind}`);
        const entry = item.entry;
        const button = (_jsx(TreeRow, {
            entry: entry,
            open: expanded.has(entry.path),
            selected: selectedPath === entry.path,
            cursor: cursor === entry.path,
            decoration: decorations.get(entry.path),
            zoom: zoom,
            act: act
        }, entry.path));
        // A nested row sits in a box indented by its depth, as the nested folders were.
        return indent ? _jsx("div", {
            className: "min-w-0",
            style: indent,
            children: button
        }, entry.path) : button;
    }
}
/** One entry's row in the tree. */
const TreeRow = memo(function TreeRow({ entry, open, selected, cursor, decoration, zoom, act }) {
    const isDirectory = entry.kind === "directory";
    return (_jsxs("button", {
        type: "button",
        className: cn(cn(ROW_MIN_H, ROW_FONT), "flex w-full cursor-pointer items-center gap-1 rounded-ui py-0 pr-3 text-left leading-none [border:0] [font-family:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg max-[700px]:min-h-11", selected || cursor ? "bg-surface-1 text-fg" : "bg-transparent text-subtext-0", cursor && CURSOR_RING),
        style: { paddingLeft: "0.75rem" },
        role: "treeitem",
        "aria-selected": selected,
        "aria-expanded": isDirectory ? open : undefined,
        tabIndex: -1,
        "data-path": entry.path,
        "data-testid": `workspace-file-entry-${entry.path}`,
        title: entry.path,
        onClick: () => (isDirectory ? act.current.onToggle(entry) : act.current.onOpenFile(entry)),
        onDoubleClick: () => { if (!isDirectory)
            act.current.onOpenFile(entry, true); },
        // VS Code pins on a middle click too.
        onAuxClick: (event) => { if (event.button === 1 && !isDirectory) {
            event.preventDefault();
            act.current.onOpenFile(entry, true);
        } },
        onContextMenu: (event) => { event.preventDefault(); event.stopPropagation(); act.current.onMenu(entry, event.clientX, event.clientY); },
        children: [
            isDirectory ? (_jsx(Chevron, {
                open: open,
                size: Math.round(10 * zoom),
                className: "mx-[3px] shrink-0 text-overlay-1"
            })) : (
            // A file has no chevron, only its room (cheaper than a hidden one in a long tree).
            _jsx("span", {
                "aria-hidden": true,
                className: "mx-[3px] shrink-0",
                style: { width: Math.round(10 * zoom), height: Math.round(10 * zoom) }
            })),
            _jsx(FileIcon, {
                name: entry.name,
                directory: isDirectory,
                open: open
            }),
            _jsx("span", {
                className: "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
                children: entry.name
            }),
            entry.kind === "symlink" && _jsx("svg", {
                className: "size-3 shrink-0 text-subtext-0",
                viewBox: "0 0 16 16",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "1.2",
                role: "img",
                "aria-label": "symlink",
                children: _jsx("path", { d: "M6 10 10 6M6 5l2-2a3 3 0 0 1 4 4l-2 2M10 11l-2 2a3 3 0 0 1-4-4l2-2" })
            }),
            entry.readonly && _jsx("span", {
                className: "shrink-0 text-[0.54rem] text-yellow",
                children: "RO"
            }),
            _jsx(GitMarker, {
                decoration: decoration,
                directory: isDirectory
            })
        ]
    }));
});
function metadataSummary(metadata) {
    if (!metadata)
        return "";
    const parts = [formatBytes(metadata.size)];
    const modified = formatModifiedAt(metadata);
    if (modified)
        parts.push(modified);
    if (metadata.executable)
        parts.push("executable");
    return parts.join(" · ");
}
function PreviewPanel({ preview }) {
    if (preview.state === "loading")
        return _jsx("div", {
            className: PREVIEW_STATE,
            children: "Loading preview\u2026"
        });
    if (preview.state === "error")
        return _jsx("div", {
            className: cn(PREVIEW_STATE, "text-red"),
            role: "alert",
            children: preview.error || "Preview unavailable."
        });
    if (preview.state !== "ready")
        return null;
    if (preview.kind === "html" && preview.content) {
        return (_jsxs("div", {
            className: "flex min-h-[8rem] flex-[0_1_40%] flex-col",
            children: [
                _jsx("div", {
                    className: cn(PREVIEW_STATE, "py-[0.3rem] text-yellow"),
                    children: "HTML is isolated in a sandboxed preview."
                }),
                _jsx("iframe", {
                    className: "min-h-[8rem] w-full flex-1 bg-[#fff] [border:0]",
                    sandbox: "",
                    title: "Sandboxed file preview",
                    srcDoc: preview.content
                })
            ]
        }));
    }
    if (preview.kind === "image" || preview.kind === "binary" || preview.kind === "tooLarge") {
        return _jsx("div", {
            className: PREVIEW_STATE,
            children: preview.message || "This file is not rendered in the editor."
        });
    }
    return (_jsx("pre", {
        className: cn(PRE, "max-h-[30%]"),
        "data-testid": "workspace-file-preview-content",
        children: preview.content || preview.message || "No preview content."
    }));
}
function ConflictPanel({ document, preview, onCompare, onReload, onOverwrite, }) {
    const [compareOpen, setCompareOpen] = useState(false);
    const conflict = document.conflict;
    return (_jsxs("div", {
        className: "grid shrink-0 gap-[0.3rem] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] px-[0.65rem] py-[0.55rem] text-[0.68rem] text-subtext-0",
        role: "alert",
        "data-testid": "workspace-file-conflict",
        children: [
            _jsx("strong", {
                className: "text-red",
                children: "File changed on disk."
            }),
            _jsx("span", { children: "Your draft is preserved. Choose how to reconcile it." }),
            _jsxs("div", {
                className: "flex gap-[0.65rem]",
                children: [
                    conflict?.expectedVersion && _jsxs("code", {
                        className: CODE,
                        children: [
                            "opened ",
                            conflict.expectedVersion.slice(0, 10)
                        ]
                    }),
                    conflict?.actualVersion && _jsxs("code", {
                        className: CODE,
                        children: [
                            "disk ",
                            conflict.actualVersion.slice(0, 10)
                        ]
                    })
                ]
            }),
            _jsxs("div", {
                className: cn(ACTIONS, "justify-end"),
                children: [
                    _jsx("button", {
                        type: "button",
                        className: cn(BTN, BTN_HOVER),
                        onClick: () => { onCompare(); setCompareOpen(true); },
                        children: "Compare"
                    }),
                    _jsx("button", {
                        type: "button",
                        className: cn(BTN, BTN_HOVER),
                        onClick: onReload,
                        children: "Reload disk"
                    }),
                    _jsx("button", {
                        type: "button",
                        className: cn(BTN, BTN_HOVER, DANGER),
                        onClick: onOverwrite,
                        children: "Overwrite disk"
                    })
                ]
            }),
            compareOpen && preview?.state === "ready" && preview.content && (_jsxs("div", {
                className: "grid max-h-[13rem] min-h-[6rem] grid-cols-[repeat(2,minmax(0,1fr))] gap-[0.45rem] overflow-auto [@container(max-width:460px)]:grid-cols-[1fr]",
                "data-testid": "workspace-file-compare",
                children: [
                    _jsxs("div", {
                        className: "min-w-0",
                        children: [
                            _jsx("span", {
                                className: COMPARE_LABEL,
                                children: "Draft"
                            }),
                            _jsx("pre", {
                                className: PRE,
                                children: document.content
                            })
                        ]
                    }),
                    _jsxs("div", {
                        className: "min-w-0",
                        children: [
                            _jsx("span", {
                                className: COMPARE_LABEL,
                                children: "Disk preview"
                            }),
                            _jsx("pre", {
                                className: PRE,
                                children: preview.content
                            })
                        ]
                    })
                ]
            })),
            compareOpen && (!preview || preview.state === "loading") && _jsx("div", {
                className: TREE_STATE,
                children: "Loading the current disk content\u2026"
            })
        ]
    }));
}
function SearchResults({ result, query, selectedPath, cursor, decorations, onOpenFile, onMenu, onRetry }) {
    if (result?.query !== query || result.state === "loading") {
        return _jsx("div", {
            className: TREE_STATE,
            role: "status",
            children: "Searching\u2026"
        });
    }
    if (result.state === "error") {
        return (_jsxs("div", {
            className: cn(TREE_STATE, "text-red"),
            role: "alert",
            children: [
                result.error,
                _jsx("button", {
                    type: "button",
                    className: TREE_BUTTON,
                    onClick: onRetry,
                    children: "Retry"
                })
            ]
        }));
    }
    const count = result.entries.length;
    return (_jsxs(_Fragment, { children: [_jsx("div", {
                className: TREE_STATE,
                children: count ? `${count} file${count === 1 ? "" : "s"}` : "No matching files"
            }), result.entries.map((entry) => _jsxs("button", {
                type: "button",
                className: cn(GHOST_BUTTON, "flex min-h-10 w-full flex-col justify-center gap-0.5 px-3 py-1.5 text-left", ROW_FONT, (selectedPath === entry.path || cursor === entry.path) && "bg-surface-1 text-fg", cursor === entry.path && CURSOR_RING),
                role: "treeitem",
                "aria-selected": selectedPath === entry.path,
                tabIndex: -1,
                "data-path": entry.path,
                title: entry.path,
                onClick: () => onOpenFile(entry),
                onContextMenu: (event) => { event.preventDefault(); event.stopPropagation(); onMenu(entry, event.clientX, event.clientY); },
                "data-testid": `workspace-file-entry-${entry.path}`,
                children: [
                    _jsxs("span", {
                        className: "flex w-full min-w-0 items-center gap-1.5 text-fg",
                        children: [
                            _jsx(FileIcon, { name: entry.name }),
                            _jsx("span", {
                                className: "min-w-0 flex-1 truncate",
                                children: entry.name
                            }),
                            _jsx(GitMarker, { decoration: decorations.get(entry.path) })
                        ]
                    }),
                    _jsx("span", {
                        className: "w-full truncate text-[0.7rem] text-subtext-0",
                        children: entry.path
                    })
                ]
            }, entry.path)), result.truncated && _jsx("div", {
                className: TREE_STATE,
                children: "Search limited for this workspace. Narrow the filename or path to see more."
            })] }));
}
/** Bounded workspace file surface. Directory levels are fetched on demand;
 * files are read only after an explicit click. Text drafts are persisted in
 * server-owned buffers; media uses a descriptor-confined HTTP stream. */
export function WorkspaceFilesView({ workspaceId, initialPath, onPathChange, layout, onOpenFile }) {
    const files = useWorkspaceFiles(workspaceId, { git: layout === "explorer" });
    const { workspace, trees, documents, previews, connected, wrap, git } = files;
    const searchResult = files.search;
    const { requestTree, searchFiles, openFile, reloadFile, requestPreview, updateDraft, saveFile, overwriteFile, setWrap } = files.actions;
    const [expanded, setExpanded] = useState(() => new Set());
    const [selectedPath, setSelectedPath] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [markdownPreviewPath, setMarkdownPreviewPath] = useState(null);
    const [fileQuery, setFileQuery] = useState("");
    // The header's search icon reveals the search box; closing it clears the query.
    const [searchOpen, setSearchOpen] = useState(false);
    const query = fileQuery.trim();
    // Word wrap is a preference of the editor, not of one mount (the host keeps it): it survives tab switches.
    // The caret for the status bar; find/replace/go-to-line live inside the editor (CodeEditor.tsx).
    const [caret, setCaret] = useState({ line: 1, col: 1 });
    const [notice, setNotice] = useState(null);
    const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
    // The explorer's right-click menu: the entry (null = the empty space, i.e. the root) and where.
    const [menu, setMenu] = useState(null);
    // The keyboard cursor over the explorer's rows (`explorerNav.ts`); `treeRef` is the focusable list.
    const [cursor, setCursor] = useState(null);
    const treeRef = useRef(null);
    const treeScrolled = useRef(null);
    const editorRef = useRef(null);
    const restoredPath = normalizePath(initialPath);
    useEffect(() => {
        setExpanded(new Set());
        setSelectedPath(restoredPath || null);
        setPreviewOpen(false);
        setFileQuery("");
        setSearchOpen(false);
        setNotice(null);
        setReloadConfirmOpen(false);
        if (workspaceId && layout !== "editor")
            requestTree("");
        if (workspaceId && restoredPath && layout !== "explorer")
            openFile(restoredPath, true);
    }, [layout, openFile, requestTree, restoredPath, workspaceId]);
    useEffect(() => {
        if (layout === "editor" || !query)
            return;
        const timer = setTimeout(() => searchFiles(query), 200);
        return () => clearTimeout(timer);
    }, [connected, layout, query, searchFiles, workspaceId]);
    const rootTree = trees[""];
    const { isGit, decorations } = git;
    const document = selectedPath ? documents[selectedPath] : undefined;
    const preview = selectedPath ? previews[selectedPath] : undefined;
    const dirty = document != null && document.content !== document.savedContent;
    // Markdown has a Source/Preview toggle (per file, kept while this view is mounted). The editor
    // stays mounted behind the rendered view, so a draft, caret and conflict state are never touched.
    const isMarkdown = selectedPath != null && /\.(?:md|markdown)$/i.test(selectedPath);
    const markdownPreview = isMarkdown && markdownPreviewPath === selectedPath;
    const canEdit = document != null && !document.metadata?.readonly && document.state !== "loading" && document.state !== "error";
    const canSave = document != null && !document.metadata?.readonly && dirty && document.state !== "saving" && document.state !== "loading" && document.state !== "error";
    function handleReload() {
        if (!selectedPath || !document || document.state === "saving" || document.bufferState === "saving")
            return;
        if (dirty) {
            setReloadConfirmOpen(true);
            setNotice(null);
            return;
        }
        reloadFile(selectedPath);
    }
    function confirmReload() {
        if (!selectedPath)
            return;
        setReloadConfirmOpen(false);
        setNotice(null);
        reloadFile(selectedPath);
    }
    function handleToggle(entry) {
        if (entry.kind !== "directory")
            return;
        setCursor(entry.path);
        const next = new Set(expanded);
        if (next.has(entry.path)) {
            next.delete(entry.path);
            setExpanded(next);
            return;
        }
        next.add(entry.path);
        setExpanded(next);
        if (!trees[entry.path] || trees[entry.path]?.state === "error")
            requestTree(entry.path);
    }
    function handleOpenFile(entry, pinned = false) {
        setCursor(entry.path);
        if (entry.kind !== "file") {
            setNotice(entry.kind === "symlink" ? "Symlinks are metadata-only and cannot be opened." : "This entry cannot be opened.");
            return;
        }
        if (layout === "explorer") {
            setNotice(null);
            setSelectedPath(entry.path);
            onOpenFile?.(entry.path, pinned);
            return;
        }
        const existing = documents[entry.path];
        if (existing && existing.content !== existing.savedContent) {
            setNotice(`Unsaved draft kept for ${basename(entry.path)}.`);
            setSelectedPath(entry.path);
            onPathChange?.(entry.path);
            return;
        }
        setNotice(null);
        setSelectedPath(entry.path);
        onPathChange?.(entry.path);
        if (!existing || existing.state === "error")
            openFile(entry.path);
    }
    // What the cursor can reach: the search results while searching, else the expanded tree.
    const searchRows = searchResult?.query === query && searchResult.state === "ready" ? searchResult.entries : [];
    const rows = query ? searchRows : flattenTree(trees, expanded);
    // Keep the cursor row on screen.
    useEffect(() => {
        if (!cursor)
            return;
        [...(treeRef.current?.querySelectorAll("[data-path]") ?? [])].find((row) => row.dataset.path === cursor)?.scrollIntoView({ block: "nearest" });
    }, [cursor]);
    /** Arrows move, Left/Right fold, Space previews (focus stays here), Enter opens a regular tab
     * (focus goes to the editor). Chords with Ctrl/Option/Cmd belong to the app. */
    function handleTreeKey(event) {
        if (event.ctrlKey || event.altKey || event.metaKey || menu)
            return;
        const result = explorerKey(rows, cursor, event.key, expanded);
        if (!result)
            return;
        event.preventDefault();
        const byPath = (path) => rows.find((row) => row.path === path);
        if (result.cursor)
            setCursor(result.cursor);
        const folder = result.toggle ? byPath(result.toggle) : undefined;
        if (folder)
            handleToggle(folder);
        const file = result.open ? byPath(result.open.path) : undefined;
        if (file && result.open) {
            // A preview keeps focus in the list (the editor must not grab it); a regular open hands it over.
            if (treeRef.current)
                treeRef.current.dataset.keynav = result.open.pin ? "false" : "true";
            handleOpenFile(file, result.open.pin);
        }
    }
    function saveCurrent() {
        if (selectedPath && canSave)
            saveFile(selectedPath);
    }
    // Media, archives and binary files (a failed text read) open in the asset viewer.
    const showAsset = !dirty && document?.metadata != null
        && (document.state === "error" || assetKind(document.metadata.mediaType) !== undefined);
    function refreshTree() {
        requestTree("");
        for (const path of expanded)
            requestTree(path);
        if (query)
            searchFiles(query);
    }
    if (!workspace) {
        return (_jsx("section", {
            className: SECTION,
            "data-testid": "workspace-files-view",
            children: _jsx("div", {
                className: EMPTY,
                children: "Workspace is no longer available."
            })
        }));
    }
    return (_jsxs("section", {
        className: cn(SECTION, layout === "editor" ? "z-auto bg-panel-bg" : "z-[3]"),
        "data-testid": layout === "editor" ? "workspace-file-pane" : "workspace-files-view",
        "aria-label": `Files for ${workspace.name}`,
        children: [
            layout === "explorer" && notice && _jsx("div", {
                className: cn(BANNER, "px-[0.65rem] py-[0.3rem]"),
                role: "status",
                children: notice
            }),
            _jsxs("div", {
                className: "flex min-h-0 min-w-0 flex-1",
                children: [
                    layout !== "editor" && _jsxs("aside", {
                        className: cn("flex min-h-0 flex-col overflow-hidden [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:[border-right:none]", "flex-[1_1_100%]"),
                        "aria-label": "Workspace file tree",
                        children: [
                            _jsxs("div", {
                                className: "flex shrink-0 items-center gap-1 px-3 py-[3px]",
                                children: [
                                    !searchOpen && _jsxs(_Fragment, { children: [_jsxs(HeaderIcon, {
                                                label: "Search files",
                                                onClick: () => setSearchOpen(true),
                                                children: [
                                                    _jsx("circle", {
                                                        cx: "6.5",
                                                        cy: "6.5",
                                                        r: "4"
                                                    }),
                                                    _jsx("path", { d: "m9.5 9.5 4 4" })
                                                ]
                                            }), _jsx(HeaderIcon, {
                                                label: "New file",
                                                onClick: () => setMenu({ entry: null, x: 0, y: 0, stage: "newFile" }),
                                                children: _jsx("path", { d: "M9 2H4.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.5zM9 2v3.5h3.5M8 7.5v4M6 9.5h4" })
                                            }), _jsx(HeaderIcon, {
                                                label: "New folder",
                                                onClick: () => setMenu({ entry: null, x: 0, y: 0, stage: "newFolder" }),
                                                children: _jsx("path", { d: "M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM8 7v3.5M6.25 8.75h3.5" })
                                            })] }),
                                    searchOpen && _jsx("input", {
                                        autoFocus: true,
                                        type: "search",
                                        className: cn(ROW_FONT, "min-h-8 min-w-0 flex-1 rounded-ui bg-panel-bg px-2 text-fg placeholder:text-subtext-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg"),
                                        "aria-label": "Search workspace files",
                                        placeholder: "Search files in workspace\u2026",
                                        maxLength: 256,
                                        value: fileQuery,
                                        onChange: (event) => setFileQuery(event.target.value),
                                        onKeyDown: (event) => {
                                            if (event.key === "Escape") {
                                                setFileQuery("");
                                                setSearchOpen(false);
                                            }
                                            // Down from the search box walks its results (or the tree) with the keyboard.
                                            if (event.key === "ArrowDown" && rows.length > 0) {
                                                event.preventDefault();
                                                setCursor(rows[0].path);
                                                treeRef.current?.focus();
                                            }
                                        },
                                        "data-testid": "workspace-files-search"
                                    }),
                                    searchOpen && _jsx("button", {
                                        type: "button",
                                        className: cn(GHOST_BUTTON, "min-h-8 px-2 text-[0.75rem]"),
                                        onClick: () => { setFileQuery(""); setSearchOpen(false); },
                                        children: "Close"
                                    })
                                ]
                            }),
                            _jsxs("div", {
                                className: "flex shrink-0 items-center justify-between py-[3px] pr-3 pl-3 text-[length:calc(11px*var(--zoom,1))] font-semibold tracking-[0.06em] text-subtext-0 uppercase",
                                children: [
                                    _jsx("span", { children: "Explorer" }),
                                    _jsxs("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            isGit && _jsx("span", {
                                                className: "text-[10px] font-normal tracking-normal normal-case",
                                                "data-testid": "explorer-git-state",
                                                title: git.statusError,
                                                role: "status",
                                                children: !git.ready || git.statusState === "error" ? "Git unavailable" : git.statusState === "ready" ? "Git snapshot" : "Updating Git…"
                                            }),
                                            _jsx(HeaderIcon, {
                                                label: "Refresh file tree",
                                                onClick: refreshTree,
                                                children: _jsx("path", { d: "M13 5a5.5 5.5 0 1 0 0 6M13 2v3H10" })
                                            })
                                        ]
                                    })
                                ]
                            }),
                            _jsx("div", {
                                ref: treeRef,
                                role: "tree",
                                tabIndex: 0,
                                "aria-label": "Files",
                                "data-explorer-keynav": "false",
                                className: "group/tree min-h-0 flex-1 overflow-y-auto px-1 outline-none",
                                "data-testid": "workspace-file-tree-scroll",
                                onScroll: () => treeScrolled.current?.(),
                                onKeyDown: handleTreeKey,
                                onMouseDown: (event) => {
                                    // WebKit does not focus a clicked button: take focus here so the arrows work after a click.
                                    if (treeRef.current)
                                        treeRef.current.dataset.keynav = "false";
                                    if (event.target === event.currentTarget || event.target.closest("[data-path]"))
                                        treeRef.current?.focus({ preventScroll: true });
                                },
                                onContextMenu: (event) => { event.preventDefault(); if (!query)
                                    setMenu({ entry: null, x: event.clientX, y: event.clientY }); },
                                children: query ? _jsx("div", {
                                    "aria-live": "polite",
                                    children: _jsx(SearchResults, {
                                        result: searchResult,
                                        query: query,
                                        selectedPath: selectedPath,
                                        cursor: cursor,
                                        decorations: decorations,
                                        onOpenFile: handleOpenFile,
                                        onMenu: (entry, x, y) => setMenu({ entry, x, y }),
                                        onRetry: () => searchFiles(query)
                                    })
                                }) : _jsxs(_Fragment, { children: [rootTree?.state === "loading" && _jsx("div", {
                                            className: TREE_STATE,
                                            role: "status",
                                            children: "Loading tree\u2026"
                                        }), rootTree?.state === "error" && (_jsxs("div", {
                                            className: cn(TREE_STATE, "text-red"),
                                            role: "alert",
                                            children: [
                                                rootTree.error || "Could not load file tree.",
                                                _jsx("button", {
                                                    type: "button",
                                                    className: TREE_BUTTON,
                                                    onClick: () => requestTree(""),
                                                    children: "Retry"
                                                })
                                            ]
                                        })), rootTree?.state === "ready" && (_jsx(FileTree, {
                                            workspaceId: workspaceId,
                                            expanded: expanded,
                                            selectedPath: selectedPath,
                                            cursor: cursor,
                                            trees: trees,
                                            decorations: decorations,
                                            scroller: treeRef,
                                            onScroll: treeScrolled,
                                            onToggle: handleToggle,
                                            onOpenFile: handleOpenFile,
                                            onMenu: (entry, x, y) => setMenu({ entry, x, y })
                                        }))] })
                            })
                        ]
                    }),
                    layout !== "explorer" && _jsxs("div", {
                        className: "flex min-h-0 min-w-0 flex-1 flex-col bg-panel-bg",
                        children: [
                            (!selectedPath || !document) && (_jsxs("div", {
                                className: EMPTY,
                                children: [
                                    _jsx("span", {
                                        className: "text-accent",
                                        children: "\u2318"
                                    }),
                                    _jsx("strong", {
                                        className: "text-[0.9rem] text-fg",
                                        children: "Open a file to edit"
                                    }),
                                    _jsx("span", { children: "Folders load one level at a time. Files stay inside this workspace." })
                                ]
                            })),
                            selectedPath && document && showAsset && (_jsx(FileAsset, {
                                workspaceId: workspaceId,
                                metadata: document.metadata
                            }, selectedPath)),
                            selectedPath && document && !showAsset && (_jsxs(_Fragment, { children: [_jsxs("div", {
                                        className: "flex shrink-0 items-center justify-between gap-2 px-3 py-[0.2rem] text-[0.72rem] [@container(max-width:460px)]:flex-wrap",
                                        children: [
                                            _jsxs("div", {
                                                className: "workspace-files__file-title flex min-w-0 items-center gap-[0.4rem] text-subtext-0 [@container(max-width:460px)]:flex-[1_1_9rem]",
                                                title: `${selectedPath}\n${metadataSummary(document.metadata)}${document.version ? ` · v ${document.version.slice(0, 12)}` : ""}`,
                                                children: [
                                                    _jsx("span", {
                                                        className: "overflow-hidden text-ellipsis whitespace-nowrap",
                                                        children: selectedPath
                                                    }),
                                                    dirty && _jsx("span", {
                                                        className: "text-[0.65rem] text-fg",
                                                        title: "Unsaved changes",
                                                        children: "\u25CF"
                                                    })
                                                ]
                                            }),
                                            _jsxs("div", {
                                                className: cn(ACTIONS, "gap-[0.1rem] [@container(max-width:460px)]:max-w-full [@container(max-width:460px)]:min-w-0 [@container(max-width:460px)]:flex-[1_1_100%] [@container(max-width:460px)]:flex-wrap"),
                                                children: [
                                                    files.askAgent && _jsx("button", {
                                                        type: "button",
                                                        className: cn(GHOST_BUTTON, "min-h-7 px-2 max-[700px]:min-h-11"),
                                                        disabled: document.state !== "ready" && document.state !== "conflict",
                                                        onClick: () => editorRef.current?.askAgent(),
                                                        children: "Ask agent\u2026"
                                                    }),
                                                    isMarkdown && (_jsx("div", {
                                                        className: "flex items-center",
                                                        role: "group",
                                                        "aria-label": "Markdown view",
                                                        children: ["Source", "Preview"].map((view) => {
                                                            const active = (view === "Preview") === markdownPreview;
                                                            return _jsx("button", {
                                                                type: "button",
                                                                className: cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-11", active && "bg-surface-1 text-fg"),
                                                                "aria-pressed": active,
                                                                onClick: () => setMarkdownPreviewPath(view === "Preview" ? selectedPath : null),
                                                                children: view
                                                            }, view);
                                                        })
                                                    })),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", wrap && "text-fg"),
                                                        onClick: () => setWrap(!wrap),
                                                        title: "Toggle word wrap",
                                                        children: "Wrap"
                                                    }),
                                                    !isMarkdown && _jsx("button", {
                                                        type: "button",
                                                        className: cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", previewOpen && "text-fg"),
                                                        onClick: () => { setPreviewOpen((value) => !value); if (!preview || preview.state === "error")
                                                            requestPreview(selectedPath); },
                                                        children: "Preview"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: cn(GHOST_BUTTON, "px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]"),
                                                        onClick: handleReload,
                                                        disabled: document.state === "saving" || document.bufferState === "saving",
                                                        title: "Reload from disk",
                                                        children: "Reload"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: cn(GHOST_BUTTON, "workspace-files__save px-[0.4rem] py-[0.15rem] [@container(max-width:460px)]:min-h-[2.5rem]", canSave && "text-fg"),
                                                        onClick: () => saveFile(selectedPath),
                                                        disabled: !canSave,
                                                        title: shortcutLabel("editor.save") ? `Save (${shortcutLabel("editor.save")})` : "Save",
                                                        children: document.state === "saving" ? "Saving…" : "Save"
                                                    })
                                                ]
                                            })
                                        ]
                                    }), document.state === "conflict" && (_jsx(ConflictPanel, {
                                        document: document,
                                        preview: preview,
                                        onCompare: () => { if (!preview || preview.state === "error")
                                            requestPreview(selectedPath); },
                                        onReload: handleReload,
                                        onOverwrite: () => overwriteFile(selectedPath)
                                    })), notice && _jsx("div", {
                                        className: cn(BANNER, "px-[0.65rem] py-[0.3rem]"),
                                        role: "status",
                                        children: notice
                                    }), reloadConfirmOpen && (_jsxs("div", {
                                        className: cn(BANNER, "flex items-center justify-between gap-[0.6rem] px-[0.65rem] py-[0.42rem] [@container(max-width:460px)]:flex-col [@container(max-width:460px)]:items-start"),
                                        role: "status",
                                        "data-testid": "workspace-file-reload-confirm",
                                        children: [
                                            _jsx("span", {
                                                className: "min-w-0",
                                                children: "Discard this unsaved draft and reload from disk?"
                                            }),
                                            _jsxs("div", {
                                                className: cn(ACTIONS, "justify-end"),
                                                children: [
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: cn(BTN, BTN_HOVER),
                                                        onClick: () => setReloadConfirmOpen(false),
                                                        children: "Keep draft"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: cn(BTN, BTN_HOVER, DANGER),
                                                        onClick: confirmReload,
                                                        children: "Discard and reload"
                                                    })
                                                ]
                                            })
                                        ]
                                    })), markdownPreview && _jsx(MarkdownPreview, {
                                        workspaceId: workspaceId,
                                        path: selectedPath,
                                        content: document.content,
                                        local: workspace.hostId === "local"
                                    }), _jsx("div", {
                                        className: cn("relative flex min-h-[12rem] min-w-0 flex-1 flex-col overflow-hidden", markdownPreview && "hidden"),
                                        children: _jsx(Suspense, {
                                            fallback: _jsx("div", {
                                                className: PREVIEW_STATE,
                                                role: "status",
                                                children: "Loading editor\u2026"
                                            }),
                                            children: _jsx(CodeEditor, {
                                                path: selectedPath,
                                                docKey: `${workspaceId}\0${selectedPath}\0${document.reloadEpoch ?? 0}`,
                                                ref: editorRef,
                                                value: document.content,
                                                onChange: (content) => updateDraft(selectedPath, content),
                                                onSave: saveCurrent,
                                                onCaret: setCaret,
                                                onAskAgent: files.askAgent ? (text, startLine, endLine) => files.askAgent?.({ kind: "editor", path: selectedPath, text, startLine, endLine }) : undefined,
                                                readOnly: !canEdit,
                                                wrap: wrap,
                                                label: `${document.metadata?.readonly ? "Viewing" : "Editing"} ${selectedPath}`
                                            }, `${selectedPath}\0${document.reloadEpoch ?? 0}`)
                                        })
                                    }), previewOpen && _jsx(PreviewPanel, { preview: preview ?? { workspaceId, path: selectedPath, requiresSandbox: false, truncated: false, state: "loading" } }), _jsxs("div", {
                                        className: "flex shrink-0 items-center justify-between gap-3 px-3 py-[0.15rem] text-[0.68rem] whitespace-nowrap text-subtext-0",
                                        children: [
                                            _jsxs("span", {
                                                className: "flex min-w-0 gap-[0.65rem] overflow-hidden",
                                                children: [
                                                    document.bufferState === "saving" && _jsx("span", {
                                                        role: "status",
                                                        children: "Draft syncing\u2026"
                                                    }),
                                                    document.bufferState === "error" && _jsx("span", {
                                                        className: "text-red",
                                                        role: "alert",
                                                        children: "Draft recovery unavailable"
                                                    }),
                                                    document.error && document.state !== "conflict" && _jsx("span", {
                                                        className: "overflow-hidden text-ellipsis text-red",
                                                        role: "alert",
                                                        children: document.error
                                                    }),
                                                    document.metadata?.readonly && _jsx("span", { children: "Read-only" })
                                                ]
                                            }),
                                            _jsxs("button", {
                                                type: "button",
                                                className: cn(GHOST_BUTTON, "shrink-0 px-[0.3rem]"),
                                                onClick: () => editorRef.current?.openGoto(),
                                                title: shortcutLabel("editor.gotoLine") ? `Go to line (${shortcutLabel("editor.gotoLine")})` : "Go to line",
                                                children: [
                                                    "Ln ",
                                                    caret.line,
                                                    ", Col ",
                                                    caret.col
                                                ]
                                            })
                                        ]
                                    })] }))
                        ]
                    })
                ]
            }),
            menu && (_jsx(FileEntryMenu, {
                workspaceId: workspaceId,
                workspacePath: workspace.path,
                target: menu.entry,
                x: menu.x,
                y: menu.y,
                initialStage: menu.stage,
                onClose: () => setMenu(null),
                onOpenFile: (path) => handleOpenFile({ name: basename(path), path, kind: "file" }, true),
                onExpand: (path) => {
                    setExpanded((current) => new Set(current).add(path));
                    if (!trees[path])
                        requestTree(path);
                },
                onRefresh: refreshTree
            }))
        ]
    }));
}
