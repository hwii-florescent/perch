// overview.tsx of Perch's stock screen "stock:sidebar", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! The sidebar's project list (`WorkspaceOverview`), part of the stock screen `stock:sidebar`. Three ways to see
//! the active host's work, chosen in the organize menu and kept per device: the tree (Project, its workspaces,
//! their sessions; the default), By status (sections by what each chat asks of you, each split by project) and
//! In one list (every chat, newest first). Quickchat sits after the projects. Data and rules come from
//! `useNavigation` (which sessions are listed, order, attention, the chat held in Done while read); actions are
//! typed commands. Everything here is arrangement: folding, menus, drag and keys.
//!
//! Reorder: one operation, move X before/after Y within a group (a project's chats, the favourites). A pointer
//! drag with the mouse (`beginReorderDrag`: the row follows the pointer, the others slide aside); Move up/down in
//! the row menus serves the keyboard and the phone. The core keeps the order, so every screen shows it.
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { beginReorderDrag, buttonClass, cn, ConfirmDialog, Dialog, FolderBrowser, ghostButton, InstructionsDialog, MemoryDialog, nestSessions, NewSessionMenu, pickFolder, rowActionClass, runCommand, segmentClass, Select, SessionDot, SessionMenu, startSession, tip, useAddProject, useAddProjectRequest, useHosts, useNavigation, WorktreeMenu, } from "@perch/sdk";
import { Chevron, CheckoutIcon, EllipsisIcon, FolderMark, NewChatIcon, OrganizeIcon, PlusIcon } from "./icons.js";
import { BODY, copyText, DOT, ENTRY_BTN, FOCUS, HiddenWorktrees, HOLDABLE, longPress, readFlag, RENAME, RESTORE, Rollup, ROW_BTN, RowMenu, saveFlag, SECTION_WORDS, SectionHeading, SESSION, SESSION_TITLE, SPAN, StateBadge, STRONG, WORKSPACE_TITLE, WORKSPACE_TREE, WorktreeJobRows, } from "./parts.js";
// Glyph buttons at the end of a row.
const PROJECT_ICON = rowActionClass({ reveal: "project" });
const SESSION_MENU = rowActionClass({ reveal: "session" });
const FOLD = rowActionClass({ className: "-ml-0.5" });
/** Folded projects, and folded sessions (a lead hiding its sub-sessions), each a list of ids kept per device. */
const COLLAPSED_KEY = "perch.sidebar.collapsedProjects";
const FOLDED_SESSIONS_KEY = "perch.sidebar.foldedSessions";
function readIds(key) {
    try {
        return JSON.parse(localStorage.getItem(key) ?? "[]");
    }
    catch {
        return [];
    }
}
const toggledId = (ids, id) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]);
const ORGANIZE_KEY = "perch.sidebar.organize";
const ORGANIZE_LABELS = { project: "By project", status: "By status", list: "In one list" };
function readOrganize() {
    try {
        const saved = localStorage.getItem(ORGANIZE_KEY);
        return saved === "status" || saved === "list" ? saved : "project";
    }
    catch {
        return "project";
    }
}
/** The tree's order: the core's (manual, with drag and favourites) or by what needs you (no drag). */
const SORT_KEY = "perch.sidebar.sort";
const SHOW_TERMINALS_KEY = "perch.sidebar.showTerminals";
/** Sent on `window` by a host that keeps these settings itself (the native window) when they change elsewhere: the
 * sidebar reads them again rather than being mounted again. The web never sends it. */
export const SIDEBAR_SETTINGS_EVENT = "perch:sidebar-settings";
export function WorkspaceOverview({ compact = false, onNavigate }) {
    const [showTerminals, setShowTerminals] = useState(() => readFlag(SHOW_TERMINALS_KEY, "1"));
    const [organize, setOrganize] = useState(readOrganize);
    // Sorting by attention is a view of the core's order, not a new order: no drag or Move while it is on.
    const [attentionSort, setAttentionSort] = useState(() => readFlag(SORT_KEY, "attention"));
    const nav = useNavigation({ showTerminals, sortByAttention: attentionSort });
    const hosts = useHosts();
    const adding = useAddProject();
    const { hostId: activeHostId, reachable, reorderable, projects: shownProjects, quickchat, activeWorkspaceId, activeSessionId: sessionId } = nav;
    const showNestHints = nav.shortcuts;
    // Which host the Add project dialog registers on; starts as the active one.
    const [addHostId, setAddHostId] = useState(activeHostId);
    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState("");
    const [renamingId, setRenamingId] = useState(null);
    const [renamingProjectId, setRenamingProjectId] = useState(null);
    const [removingProject, setRemovingProject] = useState(null);
    const [memoryFor, setMemoryFor] = useState(null);
    const [instructionsFor, setInstructionsFor] = useState(null);
    const [menu, setMenu] = useState(null);
    const [sessionMenu, setSessionMenu] = useState(null);
    // A folder that isn't a git repo has no worktrees, so its "+" starts a session there.
    const [newSession, setNewSession] = useState(null);
    // Folded projects hide their workspaces and sessions (per viewer).
    const [collapsed, setCollapsed] = useState(() => readIds(COLLAPSED_KEY));
    const [foldedSessions, setFoldedSessions] = useState(() => readIds(FOLDED_SESSIONS_KEY));
    useEffect(() => {
        const reread = () => {
            setShowTerminals(readFlag(SHOW_TERMINALS_KEY, "1"));
            setOrganize(readOrganize());
            setAttentionSort(readFlag(SORT_KEY, "attention"));
            setCollapsed(readIds(COLLAPSED_KEY));
            setFoldedSessions(readIds(FOLDED_SESSIONS_KEY));
        };
        window.addEventListener(SIDEBAR_SETTINGS_EVENT, reread);
        return () => window.removeEventListener(SIDEBAR_SETTINGS_EVENT, reread);
    }, []);
    const idToggler = (key, set) => (id) => set((current) => {
        const next = toggledId(current, id);
        saveFlag(key, JSON.stringify(next));
        return next;
    });
    const toggleCollapsed = idToggler(COLLAPSED_KEY, setCollapsed);
    const toggleFolded = idToggler(FOLDED_SESSIONS_KEY, setFoldedSessions);
    function nestHint(workspace) {
        const label = workspace.shortcut;
        return label ? _jsx("kbd", {
            className: "pointer-events-none absolute top-[7px] right-3 w-8 text-right text-[11px] leading-[18px] font-semibold text-accent tabular-nums [font-family:inherit]",
            "data-testid": `workspace-shortcut-${workspace.id}`,
            "aria-label": `Jump to workspace: ${label}`,
            children: label
        }) : null;
    }
    // A move writes only what it touches. `shown` is the row's siblings as listed; `flip`: the group shows its
    // strip order reversed (Quickchat and By status, newest first), so a move is mirrored back into strip order
    // before it is written and the first drag cannot flip the strips.
    function moveRow(kind, id, target, after, shown, flip = false) {
        if (kind === "project")
            runCommand("project.move", { id, target, after });
        else
            runCommand("session.move", { id, target, after: flip ? !after : after, siblings: flip ? [...shown].reverse() : shown });
    }
    const moveRowNow = useRef(moveRow);
    moveRowNow.current = moveRow;
    /** `zone` marks the item that moves (a chat row, a project's whole block) and its group; `handle.onPointerDown`
     * starts the drag from it (a project's header). On release the slot it landed in is written. */
    function dnd(kind, id, group, shown = [], flip = false) {
        if (!reorderable || compact)
            return { handle: {}, zone: {} };
        return {
            zone: { "data-reorder-group": group, "data-reorder-id": id },
            handle: {
                onPointerDown: (event) => {
                    if (event.pointerType === "touch" || event.target.closest("input, textarea"))
                        return;
                    const row = event.currentTarget.closest("[data-reorder-id]");
                    const list = row?.parentElement;
                    if (!row || !list)
                        return;
                    let ids = [];
                    beginReorderDrag(event, {
                        axis: "y",
                        items: () => {
                            const items = [...list.children].filter((el) => el instanceof HTMLElement && el.dataset.reorderGroup === group);
                            ids = items.map((el) => el.dataset.reorderId);
                            return items;
                        },
                        from: (items) => items.indexOf(row),
                        onMove: (ev, slide) => {
                            const box = list.getBoundingClientRect();
                            // Off the sidebar sideways, the row goes home and a release changes nothing.
                            if (ev.clientX < box.left - 12 || ev.clientX > box.right + 12)
                                slide.rest();
                            else
                                slide.apply(slide.slot(ev), ev);
                        },
                        onEnd: (apply, slide) => {
                            if (!apply || slide.to === slide.from)
                                return;
                            const others = ids.filter((other) => other !== id);
                            const target = others[slide.to] ?? others[others.length - 1];
                            if (target)
                                moveRowNow.current(kind, id, target, slide.to >= others.length, shown, flip);
                        },
                    });
                },
            },
        };
    }
    /** The row's own press handlers plus its drag, which both need `onPointerDown`. */
    function withDrag(press, handle) {
        return { ...press, onPointerDown: (event) => { press.onPointerDown(event); handle.onPointerDown?.(event); } };
    }
    function moveItems(kind, id, siblings, flip = false) {
        if (!reorderable)
            return [];
        const at = siblings.indexOf(id);
        return [["up", "Move up", -1], ["down", "Move down", 1]].flatMap(([key, label, step]) => {
            const target = at < 0 ? undefined : siblings[at + step];
            return target ? [{ label, testId: `workspace-${kind}-move-${key}-${id}`, onSelect: () => moveRow(kind, id, target, step > 0, siblings, flip) }] : [];
        });
    }
    function openSessionMenu(session, x, y, siblings, flip = false) {
        setSessionMenu({ id: session.id, x, y, extraItems: moveItems("session", session.id, siblings, flip) });
    }
    function pickSession(id) {
        runCommand("session.open", { id });
        onNavigate?.();
    }
    function navigateToWorkspace(id) {
        runCommand("workspace.open", { id });
        onNavigate?.();
    }
    // What a row's handlers do, read when they run: rows are memoised (`SessionRow`) and keep the props they drew with.
    const rowActions = useRef(null);
    rowActions.current = {
        pick: pickSession,
        menu: openSessionMenu,
        fold: toggleFolded,
        drag: (event, id, group, shown, flip) => dnd("session", id, group, shown, flip).handle.onPointerDown?.(event),
    };
    /** One chat row (`SessionRow`) of `group`, among `siblings` as listed. */
    function sessionRow(session, siblings, group, variant, detail = "", family = {}) {
        const { kids = [], folded = false, nested = false, last = false } = family;
        const active = session.id === sessionId;
        // Folded away, a lead still says what needs you among its sub-sessions.
        const hidden = folded ? Object.keys(SECTION_WORDS).filter((key) => key !== "idle").map((key) => ({ key, count: kids.filter((kid) => kid.section === key).length })).find((one) => one.count > 0) : undefined;
        return (_jsx(SessionRow, {
            session: session,
            siblings: siblings.map((other) => other.id).join("\n"),
            group: group,
            variant: variant,
            detail: detail,
            lead: kids.length > 0,
            folded: folded,
            nested: nested,
            last: last,
            active: active,
            lit: active || (folded && kids.some((kid) => kid.id === sessionId)),
            hiddenKey: hidden?.key,
            hiddenCount: hidden?.count ?? 0,
            reachable: reachable,
            draggable: !!reorderable && !compact && group !== "list",
            actions: rowActions
        }, session.id));
    }
    /** The rows of a list of chats, each lead followed by its sub-sessions unless it is folded. */
    function sessionList(list, group, variant, detailOf) {
        const items = nestSessions(list);
        const rows = [];
        let folded = false;
        items.forEach(({ session, nested }, at) => {
            if (!nested) {
                const kids = [];
                for (let next = at + 1; items[next]?.nested; next++)
                    kids.push(items[next].session);
                folded = kids.length > 0 && foldedSessions.includes(session.id);
                rows.push(sessionRow(session, list, group, variant, detailOf?.(session), { kids, folded }));
            }
            else if (!folded) {
                rows.push(sessionRow(session, list, group, variant, detailOf?.(session), { nested: true, last: !items[at + 1]?.nested }));
            }
        });
        return rows;
    }
    function sessionRows(list, group) {
        return (_jsx("div", {
            className: "workspace-entry__sessions flex flex-col gap-[2px] pt-[2px]",
            children: sessionList(list, group, "tree")
        }));
    }
    /** Instructions live on the core that owns the folder; a remote project keeps its own there. */
    function instructionsItem(project, scope, id, name, testId) {
        return project.instructions ? [{ label: "Instructions…", testId, onSelect: () => setInstructionsFor({ scope, id, name }) }] : [];
    }
    /** A project with one checkout has no row of its own for it (the project row stands in), so Files and Git for
     * that checkout live on the project menu. */
    function singleWorkspaceOf(project) {
        if (compact)
            return undefined;
        const [only] = project.workspaces;
        return only && project.workspaces.length === 1 && !only.children.length && !only.linked ? only : undefined;
    }
    function openTool(workspace, tool) {
        runCommand("workspace.focus", { id: workspace.id });
        runCommand(tool === "files" ? "workspace.files" : "workspace.git", { id: workspace.id });
    }
    function projectMenu(project) {
        const single = singleWorkspaceOf(project);
        return [
            { label: "Rename", testId: `workspace-project-rename-${project.id}`, onSelect: () => setRenamingProjectId(project.id) },
            { label: "Copy path", testId: `workspace-project-copy-${project.id}`, onSelect: () => copyText(project.path) },
            ...instructionsItem(project, "project", project.id, project.name, `workspace-project-instructions-${project.id}`),
            ...(project.memory ? [{ label: "Project home", testId: `workspace-project-home-${project.id}`, onSelect: () => runCommand("project.home", { projectId: project.id, name: project.name }) }] : []),
            ...(project.memory ? [{ label: "Memory…", testId: `workspace-project-memory-${project.id}`, onSelect: () => setMemoryFor({ projectId: project.id, name: project.name }) }] : []),
            ...moveItems("project", project.id, nav.projects.filter((other) => other.favorite === project.favorite).map((other) => other.id)),
            ...(project.sessions.length > 0
                ? [{ label: "Close all sessions", testId: `workspace-project-close-all-${project.id}`, onSelect: () => { for (const session of project.sessions)
                            runCommand("session.close", { id: session.id }); } }]
                : []),
            ...(single ? [
                "divider",
                { label: "Files", testId: `workspace-menu-files-${single.id}`, onSelect: () => openTool(single, "files") },
                ...(single.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${single.id}`, onSelect: () => openTool(single, "git") }] : []),
            ] : []),
            "divider",
            { label: "Remove project", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
        ];
    }
    function workspaceMenu(project, workspace) {
        const open = (tool) => {
            openTool(workspace, tool);
            onNavigate?.();
        };
        return [
            { label: "Rename", testId: `workspace-rename-item-${workspace.id}`, onSelect: () => setRenamingId(workspace.id) },
            { label: "Copy path", testId: `workspace-copy-${workspace.id}`, onSelect: () => copyText(workspace.path) },
            ...(workspace.branch ? [{ label: "Copy branch name", testId: `workspace-copy-branch-${workspace.id}`, onSelect: () => copyText(workspace.branch) }] : []),
            { label: workspace.pinned ? "Unpin" : "Pin", testId: `workspace-pin-${workspace.id}`, onSelect: () => runCommand("workspace.pin", { id: workspace.id, pinned: !workspace.pinned }) },
            ...instructionsItem(project, "workspace", workspace.id, workspace.name, `workspace-instructions-${workspace.id}`),
            "divider",
            { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
            ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
            ...(workspace.linked ? ["divider", { label: "Hide from sidebar", testId: `workspace-hide-${workspace.id}`, onSelect: () => runCommand("workspace.hide", { id: workspace.id, hidden: true }) }] : []),
            ...(workspace.linked && project.repoPath
                ? [{ label: "Delete worktree", testId: `workspace-delete-${workspace.id}`, danger: true, onSelect: () => runCommand("worktree.remove", { id: workspace.id }) }]
                : []),
        ];
    }
    function chooseOrganize(next) {
        setOrganize(next);
        saveFlag(ORGANIZE_KEY, next);
    }
    // The home screen's "Add project" and its key start the same flow.
    const activeHostIdRef = useRef(activeHostId);
    activeHostIdRef.current = activeHostId;
    useAddProjectRequest(useCallback(() => { setAddHostId(activeHostIdRef.current); setAddOpen(true); }, []));
    useEffect(() => {
        if (adding.status !== "success")
            return;
        // The sidebar lists one host at a time: follow the project to its host.
        if (adding.hostId && adding.hostId !== activeHostId)
            runCommand("host.select", { id: adding.hostId });
        setName("");
        setAddOpen(false);
        adding.clear();
    }, [adding.status]); // eslint-disable-line react-hooks/exhaustive-deps
    function submitProject(path) {
        adding.add(path, name, addHostId);
    }
    async function browseNative() {
        const picked = await pickFolder?.("Add project");
        if (picked)
            submitProject(picked);
    }
    /** The "+" at the end of a project line: a worktree menu for a git project, else a new session in its folder. */
    function projectPlus(project, className) {
        return project.repoPath ? _jsx(WorktreeMenu, {
            hostId: project.hostId,
            path: project.repoPath,
            className: className
        }) : (_jsx("button", {
            type: "button",
            className: cn("worktree-menu__btn", className),
            "data-testid": `workspace-project-new-session-${project.id}`,
            title: "New session in this folder",
            "aria-label": "New session",
            onClick: (event) => setNewSession({ project, rect: event.currentTarget.getBoundingClientRect() }),
            children: _jsx(PlusIcon, {})
        }));
    }
    function openProject(project) {
        const first = project.workspaces[0];
        if (first)
            navigateToWorkspace(first.id);
    }
    // "In one list": every session on this host, projects and Quickchat alike, newest first. Purely chronological:
    // the core's order does not apply, and there is no drag.
    const listView = (_jsxs("div", {
        className: "flex flex-col gap-[2px] py-[0.2rem]",
        "data-testid": "workspace-session-list",
        children: [
            nav.sessions.length === 0 && _jsx("div", {
                className: "px-[0.3rem] py-2 text-[0.7rem] text-subtext-0",
                children: "No sessions yet."
            }),
            nav.sessions.map((session) => sessionRow(session, [], "list", "list"))
        ]
    }));
    // Projects with no agent chat yet, listed last in By status so none goes missing.
    const emptyProjects = nav.projects.filter((project) => !project.hasChats);
    const statusView = (_jsxs("div", {
        className: "flex flex-col gap-[2px] py-[0.2rem]",
        "data-testid": "workspace-status-view",
        children: [
            nav.sessions.length === 0 && _jsx("div", {
                className: "px-[0.3rem] py-2 text-[0.7rem] text-subtext-0",
                children: "No chats yet."
            }),
            nav.status.map((section) => (_jsxs("div", {
                className: "flex flex-col gap-[2px]",
                "data-testid": `status-section-${section.key}`,
                children: [
                    _jsx(SectionHeading, {
                        section: section.key === "offline" ? undefined : section.key,
                        title: section.title,
                        count: section.sessions.length,
                        note: section.note,
                        countLabel: `${section.sessions.length} chats`,
                        testId: `status-section-title-${section.key}`
                    }),
                    section.projects.map((cluster) => (_jsxs("div", {
                        className: "flex flex-col gap-[2px]",
                        "data-testid": `status-project-${section.key}-${cluster.id}`,
                        children: [
                            _jsxs("div", {
                                className: "group/ph flex items-center pr-1 pl-3",
                                children: [
                                    cluster.project && !cluster.project.quickchat ? _jsx(FolderMark, {}) : _jsx("span", {
                                        className: "mr-1.5 w-3 shrink-0",
                                        "aria-hidden": "true"
                                    }),
                                    _jsx("span", {
                                        className: "min-w-0 flex-1 truncate py-[3px] text-[12.5px] font-medium text-fg",
                                        "data-testid": "status-project-title",
                                        children: cluster.name
                                    }),
                                    cluster.project && !cluster.project.quickchat && projectPlus(cluster.project, cn(PROJECT_ICON, "size-5"))
                                ]
                            }),
                            sessionList(cluster.sessions, `status:${section.key}:${cluster.id}`, "status", (session) => [session.workspaceLabel, section.key === "needs" ? session.needReason : null].filter(Boolean).join(" · "))
                        ]
                    }, cluster.id)))
                ]
            }, section.key))),
            emptyProjects.length > 0 && (_jsxs("div", {
                className: "flex flex-col",
                "data-testid": "status-no-sessions",
                children: [
                    _jsx(SectionHeading, {
                        title: "No sessions",
                        count: emptyProjects.length,
                        countLabel: `${emptyProjects.length} projects`,
                        testId: "status-no-sessions-title"
                    }),
                    emptyProjects.map((project) => (_jsxs("div", {
                        className: "group/ph flex min-w-0 items-center rounded-ui hover:bg-surface-1",
                        "data-testid": `status-empty-project-${project.id}`,
                        children: [
                            _jsxs("button", {
                                type: "button",
                                className: cn(SESSION, "min-h-9 gap-0 py-0 pl-3 text-fg min-[701px]:min-h-6"),
                                title: project.path,
                                onClick: () => openProject(project),
                                children: [
                                    _jsx(FolderMark, {}),
                                    _jsx("span", {
                                        className: cn(SESSION_TITLE, "text-[12.5px] font-medium"),
                                        children: project.name
                                    })
                                ]
                            }),
                            projectPlus(project, cn(PROJECT_ICON, "size-5"))
                        ]
                    }, project.id)))
                ]
            }))
        ]
    }));
    // After the projects, inside their scrolling list.
    const chatsSection = quickchat && (() => {
        const chats = quickchat.sessions;
        // Newest first on screen; the strip (oldest first) stays the stored order.
        const shownChats = [...chats].reverse();
        const chatsCollapsed = collapsed.includes(quickchat.id);
        return (_jsxs("div", {
            className: "flex flex-col gap-[2px]",
            "data-testid": "workspace-chats",
            children: [
                _jsxs("div", {
                    className: "group/ph flex items-stretch rounded-ui hover:bg-surface-1",
                    children: [
                        _jsxs("button", {
                            type: "button",
                            className: "flex min-h-8 flex-1 cursor-pointer items-center gap-[0.35rem] rounded-ui py-1 pr-[0.55rem] pl-[0.75rem] text-left text-[14px] font-semibold text-subtext-0 [background:none] [border:0] [font-family:inherit] [line-height:inherit] hover:text-fg focus-visible:text-fg min-[701px]:pl-4 min-[701px]:text-[0.62rem] min-[701px]:tracking-[0.045em] min-[701px]:uppercase",
                            "data-testid": "workspace-chats-collapse",
                            "aria-expanded": !chatsCollapsed,
                            onClick: () => toggleCollapsed(quickchat.id),
                            children: [
                                "Quickchat",
                                _jsx(Chevron, { open: !chatsCollapsed })
                            ]
                        }),
                        chats.length > 0 && (_jsx("button", {
                            type: "button",
                            className: PROJECT_ICON,
                            "data-testid": "workspace-chats-menu",
                            title: "Quickchat actions",
                            "aria-label": "Quickchat actions",
                            "aria-haspopup": "menu",
                            onClick: (event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                setMenu({ x: rect.left, y: rect.bottom + 4, label: "Quickchat actions", items: [
                                        { label: "Close all chats", testId: "workspace-chats-close-all", danger: true, onSelect: () => { for (const chat of chats)
                                                runCommand("session.close", { id: chat.id }); } },
                                    ] });
                            },
                            children: _jsx(EllipsisIcon, {})
                        })),
                        _jsx("button", {
                            type: "button",
                            className: rowActionClass(),
                            "data-testid": "workspace-chats-new",
                            title: "New chat",
                            "aria-label": "New chat",
                            onClick: () => {
                                runCommand("quickchat.new");
                                onNavigate?.();
                            },
                            children: _jsx(NewChatIcon, {})
                        })
                    ]
                }),
                !chatsCollapsed && chats.length > 0 && (_jsx("div", {
                    className: "flex flex-col gap-[2px] pt-[2px] pr-[0.3rem] pl-[0.4rem]",
                    children: sessionList(shownChats, "chats", "tree")
                }))
            ]
        }));
    })();
    function renderWorkspace(project, workspace) {
        const workspaceActive = workspace.id === activeWorkspaceId;
        return (_jsxs("div", {
            className: "flex flex-col gap-[2px]",
            "data-testid": `workspace-node-${workspace.id}`,
            children: [
                _jsxs("div", {
                    ...longPress((x, y) => setMenu({ x, y, label: "Workspace actions", items: workspaceMenu(project, workspace) })),
                    className: cn("workspace-entry group/entry relative cursor-pointer rounded-ui", HOLDABLE),
                    "data-testid": `workspace-entry-${workspace.id}`,
                    onClick: (event) => {
                        if (renamingId === workspace.id || event.target.closest("button, input, a"))
                            return;
                        navigateToWorkspace(workspace.id);
                    },
                    onContextMenu: (event) => {
                        if (event.target.closest(".workspace-entry__sessions"))
                            return;
                        event.preventDefault();
                        setMenu({ x: event.clientX, y: event.clientY, label: "Workspace actions", items: workspaceMenu(project, workspace) });
                    },
                    children: [
                        renamingId === workspace.id ? (_jsx("input", {
                            className: RENAME,
                            "data-testid": `workspace-rename-${workspace.id}`,
                            "aria-label": "Workspace name",
                            autoFocus: true,
                            defaultValue: workspace.name,
                            onKeyDown: (event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") {
                                    runCommand("workspace.rename", { id: workspace.id, name: event.currentTarget.value });
                                    setRenamingId(null);
                                }
                                else if (event.key === "Escape") {
                                    setRenamingId(null);
                                }
                            },
                            onBlur: () => setRenamingId(null)
                        })) : (_jsx("div", {
                            className: cn("flex flex-wrap items-stretch rounded-ui hover:bg-surface-1", workspaceActive && workspace.sessions.length === 0 && "bg-surface-1"),
                            children: _jsxs("button", {
                                type: "button",
                                className: cn(ENTRY_BTN, "flex-1 bg-transparent pr-12", workspaceActive && "workspace-entry__button--active"),
                                "aria-pressed": workspaceActive,
                                onClick: () => navigateToWorkspace(workspace.id),
                                title: workspace.path,
                                children: [
                                    _jsx(CheckoutIcon, { linked: workspace.linked }),
                                    _jsxs("span", {
                                        className: cn(BODY, "flex items-baseline gap-[0.35rem]"),
                                        children: [
                                            _jsx("strong", {
                                                className: cn(WORKSPACE_TITLE, workspaceActive ? "text-fg" : "text-subtext-0"),
                                                title: "Double-click to rename",
                                                onDoubleClick: (event) => {
                                                    event.stopPropagation();
                                                    setRenamingId(workspace.id);
                                                },
                                                children: workspace.name
                                            }),
                                            workspace.branch && workspace.branch !== workspace.name && _jsx("span", {
                                                className: cn(SPAN, "min-w-0 shrink-[3]"),
                                                children: workspace.branch
                                            })
                                        ]
                                    }),
                                    workspace.dirty && _jsx("span", {
                                        className: DOT,
                                        title: "Uncommitted changes",
                                        "aria-label": "Uncommitted changes",
                                        children: "\u25CF"
                                    }),
                                    nestHint(workspace),
                                    (workspace.pinned || workspace.sleeping) && (_jsx("span", {
                                        className: "shrink-0 text-[0.58rem] text-subtext-0",
                                        children: [workspace.pinned && "pinned", workspace.sleeping && "sleeping"].filter(Boolean).join(" · ")
                                    }))
                                ]
                            })
                        })),
                        workspace.sleeping && (_jsx("button", {
                            type: "button",
                            className: RESTORE,
                            onClick: () => runCommand("workspace.restore", { id: workspace.id }),
                            children: "Restore"
                        })),
                        workspace.sessions.length > 0 && sessionRows(workspace.sessions, workspace.id)
                    ]
                }),
                workspace.children.length > 0 && (_jsx("div", {
                    className: `${WORKSPACE_TREE} ml-[0.9rem]`,
                    "data-testid": `workspace-children-${workspace.id}`,
                    children: workspace.children.map((child) => renderWorkspace(project, child))
                }))
            ]
        }, workspace.id));
    }
    function renderProject(project) {
        const projectCollapsed = collapsed.includes(project.id) && !showNestHints;
        const single = singleWorkspaceOf(project);
        const shortcutHint = single ? nestHint(single) : null;
        // With nothing to fold away, the header opens the checkout instead.
        const collapsible = !single;
        // Folded, a project still says what needs you.
        const foldedTop = projectCollapsed ? project.top : null;
        const foldedCount = foldedTop && foldedTop !== "idle" ? project.sessions.filter((s) => s.section === foldedTop).length : 0;
        const onHeaderClick = () => (single ? navigateToWorkspace(single.id) : toggleCollapsed(project.id));
        // Reorder inside the favourites or the rest; the whole project is the drop target.
        const projectDnd = dnd("project", project.id, project.favorite ? "favorites" : "projects");
        return (_createElement("div", { ...projectDnd.zone, className: "workspace-project flex flex-col gap-[2px]", key: project.id, "data-testid": `workspace-project-${project.id}` },
            _jsxs("div", {
                ...withDrag(longPress((x, y) => setMenu({ x, y, label: "Project actions", items: projectMenu(project) })), renamingProjectId === project.id ? {} : projectDnd.handle),
                className: cn("group/ph relative flex cursor-pointer flex-wrap items-stretch rounded-ui hover:bg-surface-1", HOLDABLE, single && "workspace-entry", single && single.id === activeWorkspaceId && (projectCollapsed || project.sessions.length === 0) && "bg-surface-1"),
                "data-testid": single ? `workspace-entry-${single.id}` : undefined,
                onClick: (event) => {
                    if (renamingProjectId === project.id || event.target.closest("button, input, a"))
                        return;
                    onHeaderClick();
                },
                onContextMenu: (event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, label: "Project actions", items: projectMenu(project) });
                },
                children: [
                    renamingProjectId === project.id ? (_jsx("input", {
                        className: RENAME,
                        "data-testid": `workspace-project-rename-input-${project.id}`,
                        "aria-label": "Project name",
                        autoFocus: true,
                        defaultValue: project.name,
                        onKeyDown: (event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") {
                                runCommand("project.rename", { id: project.id, name: event.currentTarget.value });
                                setRenamingProjectId(null);
                            }
                            else if (event.key === "Escape") {
                                setRenamingProjectId(null);
                            }
                        },
                        onBlur: () => setRenamingProjectId(null)
                    })) : (_jsxs("button", {
                        type: "button",
                        className: cn(ROW_BTN, "min-h-8 flex-1 cursor-pointer gap-[0.45rem] rounded-ui bg-transparent py-[3px] pr-3 pl-1.5 text-fg", single && "workspace-entry__button", single && single.id === activeWorkspaceId && "workspace-entry__button--active", FOCUS),
                        "data-testid": `project-toggle-${project.id}`,
                        "aria-expanded": collapsible ? !projectCollapsed : undefined,
                        onClick: onHeaderClick,
                        title: project.path,
                        children: [
                            collapsible && _jsx(Chevron, {
                                open: !projectCollapsed,
                                size: 10,
                                className: "-ml-1 hidden shrink-0 text-subtext-0 min-[701px]:block"
                            }),
                            _jsx(FolderMark, {
                                className: "h-3 w-3 shrink-0 text-subtext-0",
                                filled: project.favorite,
                                testId: "project-folder-icon"
                            }),
                            _jsx("span", {
                                className: "grid min-w-0 gap-[0.1rem]",
                                children: _jsx("strong", {
                                    className: STRONG,
                                    children: project.name
                                })
                            }),
                            single?.branch && single.branch !== project.name && _jsx("span", {
                                className: cn(SPAN, "min-w-0 shrink-[3]"),
                                children: single.branch
                            }),
                            single?.dirty && _jsx("span", {
                                className: DOT,
                                title: "Uncommitted changes",
                                "aria-label": "Uncommitted changes",
                                children: "\u25CF"
                            }),
                            collapsible && _jsx(Chevron, {
                                open: !projectCollapsed,
                                className: "shrink-0 text-subtext-0 min-[701px]:hidden"
                            }),
                            shortcutHint
                        ]
                    })),
                    foldedTop && foldedCount > 0 && (_jsx("span", {
                        className: "flex items-center self-center pr-1",
                        children: _jsx(Rollup, {
                            count: foldedCount,
                            section: foldedTop,
                            testId: `project-rollup-${project.id}`
                        })
                    })),
                    _jsx("button", {
                        type: "button",
                        className: cn(PROJECT_ICON, shortcutHint && "invisible"),
                        "data-testid": `workspace-project-menu-${project.id}`,
                        title: "Project actions",
                        "aria-label": "Project actions",
                        "aria-haspopup": "menu",
                        onClick: (event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setMenu({ x: rect.left, y: rect.bottom + 4, label: "Project actions", items: projectMenu(project) });
                        },
                        children: _jsx(EllipsisIcon, {})
                    }),
                    projectPlus(project, cn(PROJECT_ICON, shortcutHint && "invisible"))
                ]
            }),
            (!projectCollapsed || single) && (project.workspaces.length + project.hidden.length > 0 || project.jobs.length > 0) && (_jsxs("div", {
                className: "workspace-project__workspaces flex flex-col gap-[2px]",
                children: [
                    single ? (_jsxs(_Fragment, { children: [single.sleeping && (_jsx("button", {
                                type: "button",
                                className: RESTORE,
                                onClick: () => runCommand("workspace.restore", { id: single.id }),
                                children: "Restore"
                            })), !projectCollapsed && single.sessions.length > 0 && sessionRows(single.sessions, single.id)] })) : (_jsx("div", {
                        className: WORKSPACE_TREE,
                        "data-testid": "workspace-tree-root",
                        children: project.workspaces.map((workspace) => renderWorkspace(project, workspace))
                    })),
                    _jsx(WorktreeJobRows, { jobs: project.jobs }),
                    project.hidden.length > 0 && _jsx(HiddenWorktrees, {
                        workspaces: project.hidden,
                        projectId: project.id
                    })
                ]
            }))));
    }
    const organizeButton = (_jsx("button", {
        type: "button",
        className: cn(segmentClass(), "grid w-9 place-items-center p-0 min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:h-[2.75rem] [@media(max-width:700px)]:w-[2.75rem] [@media(max-width:700px)]:min-w-[2.75rem]"),
        title: "Organize sidebar",
        "aria-label": "Organize sidebar",
        "aria-haspopup": "menu",
        "data-testid": "workspace-organize",
        onClick: (event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const tick = (on) => (on ? "✓ " : "   ");
            setMenu({ x: rect.left, y: rect.bottom + 4, label: "Organize sidebar", items: [
                    ...Object.keys(ORGANIZE_LABELS).map((key) => ({ label: `${tick(organize === key)}${ORGANIZE_LABELS[key]}`, testId: `workspace-organize-${key}`, onSelect: () => chooseOrganize(key) })),
                    "divider",
                    { label: `${tick(showTerminals)}Show terminals`, testId: "workspace-show-terminals", onSelect: () => { setShowTerminals(!showTerminals); saveFlag(SHOW_TERMINALS_KEY, showTerminals ? "0" : "1"); } },
                    ...(organize === "project" ? [
                        "divider",
                        { label: `${tick(attentionSort)}Sort by attention`, testId: "workspace-sort-attention", onSelect: () => { setAttentionSort(!attentionSort); saveFlag(SORT_KEY, attentionSort ? "manual" : "attention"); } },
                    ] : []),
                ] });
        },
        children: _jsx(OrganizeIcon, {})
    }));
    const projectCount = nav.projects.length;
    return (_jsxs("section", {
        className: cn("workspace-overview flex flex-col overflow-hidden", 
        // compact = the phone switcher, where the panel owns the bottom edge
        compact ? "min-h-full flex-1" : "min-h-0 flex-1"),
        "data-testid": "workspace-overview",
        "aria-label": "Projects and workspaces",
        children: [
            _jsxs("div", {
                className: "flex shrink-0 items-stretch justify-between gap-[0.45rem] pl-[0.75rem] min-[701px]:pr-[3px] min-[701px]:pl-4",
                children: [
                    _jsxs("div", {
                        className: "flex min-w-0 items-center gap-[0.45rem] py-[0.55rem]",
                        children: [
                            _jsx("span", {
                                className: "text-[0.72rem] font-bold tracking-[0.08em] text-fg uppercase min-[701px]:text-[0.62rem] min-[701px]:font-semibold min-[701px]:tracking-[0.045em] min-[701px]:text-subtext-0",
                                children: organize === "project" ? "Projects" : "Sessions"
                            }),
                            _jsx("span", {
                                className: "text-[0.65rem] whitespace-nowrap text-subtext-0 min-[701px]:hidden",
                                children: organize !== "project"
                                    ? `${nav.sessions.length} session${nav.sessions.length === 1 ? "" : "s"}`
                                    : projectCount ? `${projectCount} project${projectCount === 1 ? "" : "s"}` : "No projects"
                            })
                        ]
                    }),
                    _jsxs("div", {
                        className: "flex shrink-0 items-stretch",
                        children: [
                            nav.needsYou > 0 && (_jsxs("button", {
                                type: "button",
                                className: cn("my-[3px] cursor-pointer self-center rounded-ui bg-transparent px-2 py-[0.15rem] text-[0.68rem] font-medium text-accent [border:0] [font-family:inherit] hover:bg-surface-1 [@media(max-width:700px)]:min-h-[2.75rem]", FOCUS),
                                "data-testid": "workspace-needs-you",
                                title: tip("Open the next chat that needs you", "global.needsYou"),
                                onClick: () => { runCommand("global.needsYou"); onNavigate?.(); },
                                children: [
                                    nav.needsYou,
                                    " need",
                                    nav.needsYou === 1 ? "s" : "",
                                    " you"
                                ]
                            })),
                            organizeButton,
                            _jsxs("button", {
                                type: "button",
                                className: cn(segmentClass(), "gap-1 px-[0.6rem] text-[0.72rem] font-medium min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.65rem]"),
                                "data-testid": "workspace-add-project",
                                title: "Add project",
                                "aria-label": "Add project",
                                onClick: () => { setAddHostId(activeHostId); setAddOpen((open) => !open); },
                                children: [
                                    _jsx(PlusIcon, { size: 12 }),
                                    "Add"
                                ]
                            })
                        ]
                    })
                ]
            }),
            addOpen && (_jsxs(Dialog, {
                title: "Add project",
                onClose: () => setAddOpen(false),
                testId: "workspace-add-form",
                children: [
                    _jsxs("label", {
                        className: "grid gap-[0.16rem] text-[0.7rem] text-subtext-0",
                        children: [
                            _jsxs("span", { children: ["Name ", _jsx("em", {
                                        className: "text-overlay-1 not-italic",
                                        children: "optional"
                                    })] }),
                            _jsx("input", {
                                className: "w-full min-w-0 rounded-ui bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:[outline:1px_solid_var(--accent)]",
                                value: name,
                                onChange: (event) => setName(event.target.value),
                                placeholder: "Project name",
                                "data-testid": "workspace-project-name"
                            })
                        ]
                    }),
                    hosts.list.length > 1 && (_jsxs("label", {
                        className: "grid gap-[0.16rem] text-[0.7rem] text-subtext-0",
                        children: [
                            _jsx("span", { children: "Host" }),
                            _jsx(Select, {
                                testId: "workspace-add-host",
                                ariaLabel: "Host",
                                value: addHostId,
                                onChange: setAddHostId,
                                options: [
                                    { value: "local", label: "This machine" }, ...hosts.list.filter((host) => host.id !== "local" && host.enabled).map((host) => {
                                        // A host the core has not reported on yet is still connecting.
                                        const state = host.state === "disabled" ? "connecting" : host.state;
                                        return { value: host.id, label: `${host.name}${state === "connected" ? "" : ` (${state})`}`, disabled: state !== "connected" };
                                    })
                                ]
                            })
                        ]
                    })),
                    pickFolder && addHostId === "local" && (_jsx("button", {
                        type: "button",
                        className: cn(ghostButton, "px-[0.6rem] py-[0.4rem] text-left text-[0.8rem] text-fg"),
                        "data-testid": "workspace-add-browse-native",
                        onClick: () => void browseNative(),
                        children: "Browse folder\u2026"
                    })),
                    _jsx(FolderBrowser, {
                        hostId: addHostId,
                        onUseFolder: submitProject
                    }, addHostId),
                    adding.status === "pending" && _jsx("span", {
                        className: "text-[0.7rem] text-subtext-0",
                        role: "status",
                        children: "Registering folder\u2026"
                    }),
                    adding.status === "error" && _jsx("span", {
                        className: "text-[0.7rem] text-red",
                        role: "alert",
                        children: adding.error
                    }),
                    _jsx("div", {
                        className: "flex justify-end",
                        children: _jsx("button", {
                            type: "button",
                            className: cn(ghostButton, "px-[0.6rem] py-[0.3rem] text-[0.75rem]", FOCUS),
                            disabled: adding.status === "pending",
                            onClick: () => setAddOpen(false),
                            children: "Cancel"
                        })
                    })
                ]
            })),
            nav.loading && (_jsx("div", {
                className: "shrink-0 px-[0.65rem] py-[0.55rem] text-[0.7rem] text-subtext-0",
                role: "status",
                children: "Loading workspace\u2026"
            })),
            nav.error && (_jsxs("div", {
                className: "flex shrink-0 items-center gap-[0.45rem] px-[0.65rem] py-[0.55rem] text-[0.7rem] text-red",
                role: "alert",
                children: [
                    nav.error,
                    _jsx("button", {
                        type: "button",
                        className: buttonClass({ size: "sm", className: "ml-auto text-inherit hover:text-inherit" }),
                        onClick: () => runCommand("host.refresh", { id: activeHostId }),
                        children: "Retry"
                    })
                ]
            })),
            organize === "project" && projectCount === 0 && !nav.loading && (_jsxs("div", {
                className: "grid justify-items-start gap-[0.32rem] px-3 py-4 text-[0.68rem] text-subtext-0 min-[701px]:px-4",
                children: [
                    _jsx(FolderMark, { className: "mb-[0.15rem] size-5 text-accent" }),
                    _jsx("strong", {
                        className: "text-[0.77rem] font-semibold text-fg",
                        children: "Add a project"
                    }),
                    _jsx("span", { children: "A project keeps its workspaces, sessions and files together." }),
                    !addOpen && (_jsxs("button", {
                        type: "button",
                        className: buttonClass({ variant: "soft", size: "sm", className: "mt-[0.35rem] inline-flex items-center gap-1 rounded-ui text-fg" }),
                        onClick: () => setAddOpen(true),
                        "data-testid": "workspace-empty-add",
                        children: [
                            _jsx(PlusIcon, { size: 12 }),
                            "Register folder"
                        ]
                    }))
                ]
            })),
            _jsx("div", {
                className: "flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[3px] py-[3px] [&>*]:shrink-0",
                "data-testid": "project-list",
                children: organize !== "project" && !showNestHints ? (organize === "list" ? listView : statusView) : _jsxs(_Fragment, { children: [shownProjects.map(renderProject), chatsSection] })
            }),
            menu && _jsx(RowMenu, {
                ...menu,
                onClose: () => setMenu(null)
            }),
            sessionMenu && _jsx(SessionMenu, {
                ...sessionMenu,
                onClose: () => setSessionMenu(null)
            }, sessionMenu.id),
            newSession && (_jsx(NewSessionMenu, {
                hostId: newSession.project.hostId,
                cwd: null,
                projects: [
                    newSession.project.path
                ],
                anchorRect: newSession.rect,
                onClose: () => setNewSession(null),
                onSelect: (cwd, agent) => startSession(newSession.project.hostId, cwd, agent)
            })),
            removingProject && (_jsx(ConfirmDialog, {
                message: `Remove "${removingProject.name}" from perch? Its sessions close (their agents and shells end); the folder and the agents' transcripts stay on disk.`,
                confirmLabel: "Remove",
                onConfirm: () => {
                    runCommand("project.close", { id: removingProject.id, confirmed: true });
                    setRemovingProject(null);
                },
                onCancel: () => setRemovingProject(null)
            })),
            instructionsFor && _jsx(InstructionsDialog, {
                ...instructionsFor,
                onClose: () => setInstructionsFor(null)
            }),
            memoryFor && _jsx(MemoryDialog, {
                ...memoryFor,
                onClose: () => setMemoryFor(null)
            })
        ]
    }));
}
/** One chat row. `variant`: the tree's and Quickchat's (state badge), By status's (one line with `detail`), or
 * the flat list's (its project's name, then the badge). No row is filled at rest, only the
 * active and the hovered one; each sub-session hangs off an elbow connector, and the lead carries the fold chevron. Memoised: a row whose
 * session and place are unchanged is not rendered again when another row changes. */
const SessionRow = memo(function SessionRow({ session, siblings: siblingIds, group, variant, detail, lead, folded, nested, last, active, lit, hiddenKey, hiddenCount, reachable, draggable, actions }) {
    const siblings = siblingIds ? siblingIds.split("\n") : [];
    const flip = group === "chats" || group.startsWith("status:"); // groups shown newest first
    const title = session.title || (variant === "tree" && group !== "chats" ? "New session" : "New chat");
    const badge = reachable && session.provider !== "terminal" && variant !== "status" && _jsx(StateBadge, {
        section: session.section,
        testId: `session-state-${session.id}`
    });
    const pick = () => actions.current.pick(session.id);
    const openMenu = (x, y) => actions.current.menu(session, x, y, siblings, flip);
    const press = longPress(openMenu);
    // A chat row's wrapper props: drag within `group`, and a menu (right-click or hold) with Move up/down.
    const zone = draggable ? { "data-reorder-group": group, "data-reorder-id": session.id } : {};
    const button = (_jsx("button", {
        type: "button",
        className: cn(SESSION, lead && "w-auto min-w-0 flex-initial pr-1", variant === "status" && "min-h-9 py-0 min-[701px]:min-h-6", variant === "status" && !nested && "pl-[1.875rem]", variant === "tree" && group !== "chats" && !nested && "pl-[1.525rem]", nested && "pl-1", active ? "workspace-entry__session--active text-fg" : "text-subtext-0"),
        "aria-current": active ? "page" : undefined,
        title: variant === "tree" ? title : session.cwd,
        "data-testid": `workspace-session-${session.id}`,
        "data-session": variant === "status" ? session.id : undefined,
        onClick: pick,
        children: variant === "status" ? _jsxs(_Fragment, { children: [_jsx(SessionDot, {
                    plain: true,
                    id: session.id,
                    className: "h-4 w-4"
                }), _jsxs("span", {
                    className: "flex min-w-0 flex-1 items-baseline gap-2",
                    children: [
                        _jsx("span", {
                            className: "min-w-0 shrink-[2] truncate",
                            children: title
                        }),
                        detail && _jsx("span", {
                            className: "min-w-0 flex-1 truncate text-[0.62rem] text-subtext-0",
                            "data-testid": "status-row-detail",
                            children: detail
                        })
                    ]
                })] }) : _jsxs(_Fragment, { children: [_jsx(SessionDot, {
                    plain: true,
                    id: session.id,
                    className: "h-[18px] w-[18px]"
                }), _jsx("span", {
                    className: cn(SESSION_TITLE, lead && "flex-initial"),
                    children: title
                }), session.checkout && _jsxs("span", {
                    className: "flex min-w-0 max-w-[40%] shrink items-center gap-1 text-[0.62rem] text-subtext-0",
                    title: `Worktree ${session.checkout}`,
                    "data-testid": `session-checkout-${session.id}`,
                    children: [
                        _jsx(CheckoutIcon, { linked: true }),
                        _jsx("span", {
                            className: "min-w-0 truncate",
                            children: session.checkout
                        })
                    ]
                }), variant === "list" && session.projectName && _jsx("span", {
                    className: "min-w-0 max-w-[35%] truncate text-[0.62rem] text-subtext-0",
                    title: session.projectName,
                    children: session.projectName
                }), !lead && badge] })
    }));
    return (_jsxs("div", {
        className: cn("group/row flex min-w-0 items-stretch rounded-ui", lit ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1"),
        "data-sub-session": nested || undefined,
        ...zone,
        ...press,
        onPointerDown: (event) => {
            press.onPointerDown(event);
            if (draggable)
                actions.current.drag(event, session.id, group, siblings, flip);
        },
        onContextMenu: (event) => {
            event.preventDefault();
            openMenu(event.clientX, event.clientY);
        },
        children: [
            nested && (_jsxs("span", {
                className: cn("-mt-[2px] flex w-2.5 shrink-0 flex-col", variant === "status" ? "ml-[2.375rem]" : group === "chats" ? "ml-[1.15rem]" : "ml-[2.025rem]"),
                "aria-hidden": "true",
                "data-testid": `session-elbow-${session.id}`,
                children: [
                    _jsx("span", { className: "flex-1 rounded-bl-[6px] border-b border-l border-overlay-1" }),
                    _jsx("span", { className: cn("flex-1", !last && "border-l border-overlay-1") })
                ]
            })),
            button,
            lead && _jsxs(_Fragment, { children: [_jsx("button", {
                        type: "button",
                        className: FOLD,
                        "data-testid": `session-fold-${session.id}`,
                        title: folded ? "Show sub-sessions" : "Hide sub-sessions",
                        "aria-label": `${folded ? "Show" : "Hide"} sub-sessions of ${title}`,
                        "aria-expanded": !folded,
                        onClick: () => actions.current.fold(session.id),
                        children: _jsx(Chevron, {
                            open: !folded,
                            size: 10
                        })
                    }), _jsx("div", {
                        role: "presentation",
                        className: "flex flex-1 cursor-pointer items-center justify-end gap-1 px-1 whitespace-nowrap",
                        onClick: (event) => { event.stopPropagation(); pick(); },
                        children: hiddenKey ? _jsx(Rollup, {
                            count: hiddenCount,
                            section: hiddenKey,
                            testId: `session-rollup-${session.id}`
                        }) : badge
                    })] }),
            _jsx("button", {
                type: "button",
                className: cn(SESSION_MENU, active && "opacity-100"),
                "data-testid": `session-menu-button-${session.id}`,
                title: "More",
                "aria-label": `More for ${session.title || (variant === "tree" && group !== "chats" ? "session" : "chat")}`,
                "aria-haspopup": "menu",
                onClick: (event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    openMenu(rect.left, rect.bottom + 4);
                },
                children: _jsx(EllipsisIcon, {})
            })
        ]
    }));
});
