// parts.tsx of Perch's stock screen "stock:sidebar", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Pieces the sidebar's views share: the row menu, the phone's hold-for-menu, state words and section headings,
//! hidden worktrees and worktree progress rows. Part of the stock screen `stock:sidebar`.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { agentStateColor, buttonClass, cn, menuItemClass, menuPanel, runCommand } from "@perch/sdk";
export function basename(path) {
    const parts = path.replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || path;
}
export function copyText(text) {
    void navigator.clipboard?.writeText(text).catch(() => { });
}
/** A per-viewer choice kept on this device. */
export function readFlag(key, on) {
    try {
        return localStorage.getItem(key) === on;
    }
    catch {
        return false;
    }
}
export function saveFlag(key, value) {
    try {
        localStorage.setItem(key, value);
    }
    catch { /* per-viewer convenience */ }
}
// A few tokens stay as hooks: e2e and the harness select on `workspace-project`, `workspace-entry`,
// `workspace-entry__button(--active)`, `workspace-project__workspaces`, `workspace-entry__sessions` and
// `workspace-overview__add-form`.
export const FOCUS = "focus-visible:[outline:1px_solid_var(--overlay-1)] focus-visible:[outline-offset:-1px]";
export const ROW_BTN = "flex w-full min-w-0 items-center text-left [border:0] [font-family:inherit]";
export const SESSION = `${ROW_BTN} min-h-8 flex-1 cursor-pointer gap-2 rounded-ui bg-transparent px-[0.65rem] py-1 text-[13px] min-[701px]:text-[12px] ${FOCUS}`;
export const SESSION_TITLE = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap";
export const RENAME = "mx-[0.3rem] my-1 w-[calc(100%_-_0.6rem)] rounded-ui bg-surface-0 px-[0.3rem] focus:[outline:1px_solid_var(--accent)] py-[0.2rem] text-[0.76rem] text-fg [font-family:inherit] [font-weight:inherit] [line-height:inherit]";
export const DOT = "shrink-0 text-[0.58rem] text-subtext-0";
export const ENTRY_BTN = `workspace-entry__button ${ROW_BTN} min-h-8 cursor-pointer gap-[0.45rem] rounded-ui py-[3px] pr-3 pl-3 text-fg ${FOCUS}`;
export const STRONG = "overflow-hidden text-[14px] font-semibold text-ellipsis whitespace-nowrap text-fg min-[701px]:text-[12.5px] min-[701px]:font-medium";
export const WORKSPACE_TITLE = "min-w-0 overflow-hidden text-[13px] font-medium text-ellipsis whitespace-nowrap min-[701px]:text-[12px]";
export const WORKSPACE_TREE = "workspace-tree flex flex-col gap-[2px]";
export const SPAN = "overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-subtext-0";
export const BODY = "grid min-w-0 flex-1 gap-[0.1rem]";
export const JOB_ACTION = buttonClass({ size: "xs" });
export const RESTORE = buttonClass({ size: "xs", tone: "warn", className: "mt-0 mr-[0.3rem] mb-[0.3rem] ml-[0.5rem]" });
/** Stops iOS from selecting text / showing its callout while a row is held. */
export const HOLDABLE = "select-none [-webkit-touch-callout:none]";
/** Right-click / ⋯ menu for a project or workspace row (Orca's sidebar context menu, trimmed to what perch does). */
export function RowMenu({ x, y, label, items, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        // A new press outside closes it. `pointerdown`, not `mousedown`: lifting the finger that held a row open fires
        // a compatibility `mousedown` on the row, which would close the menu the hold just opened.
        const click = (event) => { if (!ref.current?.contains(event.target))
            onClose(); };
        const key = (event) => { if (event.key === "Escape")
            onClose(); };
        document.addEventListener("pointerdown", click, true);
        document.addEventListener("keydown", key);
        return () => {
            document.removeEventListener("pointerdown", click, true);
            document.removeEventListener("keydown", key);
        };
    }, [onClose]);
    const height = items.length * (window.innerWidth <= 700 ? 44 : 30);
    return createPortal(_jsx("div", {
        className: menuPanel,
        role: "menu",
        "aria-label": label,
        "data-testid": "row-menu",
        ref: ref,
        style: { position: "fixed", zIndex: 9999, minWidth: 180, left: Math.min(x, window.innerWidth - 188), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) },
        children: items.map((item, index) => item === "divider" ? (_jsx("div", { className: "my-1 h-px bg-overlay-0" }, index)) : (_jsx("button", {
            type: "button",
            role: "menuitem",
            className: cn(menuItemClass({ danger: !!item.danger }), "max-[700px]:min-h-11"),
            "data-testid": item.testId,
            onClick: () => { onClose(); item.onSelect(); },
            children: item.label
        }, item.testId)))
    }), document.body);
}
/** The phone's right-click: hold a row for half a second. Spread the result on the row. Touch/pen only, a mouse
 * keeps its real contextmenu. Scrolling cancels it (pointercancel), as does moving more than a few pixels.
 *
 * The click that ends the hold is swallowed wherever it lands: on the row it would navigate, and the menu the hold
 * opened sits under the finger, so on a menu item it would choose that item (a browser that sends a click after a
 * long press does). Only that click: the next new press clears the guard, so a browser that sends none never loses
 * the person's next tap. */
let heldTimer;
function swallowReleaseClick() {
    const swallow = (event) => { event.stopPropagation(); event.preventDefault(); done(); };
    const done = () => {
        window.removeEventListener("click", swallow, true);
        window.removeEventListener("pointerdown", done, true);
    };
    window.addEventListener("click", swallow, true);
    window.addEventListener("pointerdown", done, true);
}
export function longPress(open) {
    const cancel = () => window.clearTimeout(heldTimer);
    let from = { x: 0, y: 0 };
    return {
        onPointerDown: (event) => {
            if (event.pointerType === "mouse")
                return;
            cancel();
            from = { x: event.clientX, y: event.clientY };
            heldTimer = window.setTimeout(() => { swallowReleaseClick(); open(from.x, from.y); }, 450);
        },
        onPointerMove: (event) => {
            if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10)
                cancel();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
    };
}
/** The words for a section, so colour is never the only signal. */
export const SECTION_WORDS = { needs: "Needs you", done: "Done", working: "Working", idle: "Idle" };
/** The ring colours the rest of the app uses for a state, so a section reads the same as a dot elsewhere. */
const SECTION_STATE = { needs: "blocked", done: "done", working: "working", idle: "idle" };
export const sectionColor = (section) => agentStateColor(SECTION_STATE[section]);
/** A section's heading in By status: the state's colour as a dot (hollow for Idle, as its ring is) before the
 * label, which stays in full text colour so contrast never depends on the hue. */
export function SectionHeading({ section, title, count, note, countLabel, testId }) {
    const color = section ? sectionColor(section) : undefined;
    return (_jsxs("div", {
        className: "mt-3 mb-0.5 flex items-center gap-2 px-3 py-[3px] text-[13px] font-semibold text-fg min-[701px]:text-[12px]",
        "data-testid": testId,
        children: [
            _jsx("span", {
                className: cn("size-2 shrink-0 rounded-full", (!color || section === "idle") && "border-[1.5px] border-overlay-1 bg-transparent"),
                style: color ? (section === "idle" ? { borderColor: color } : { backgroundColor: color }) : undefined,
                "aria-hidden": "true"
            }),
            _jsx("span", { children: title }),
            _jsx("span", {
                className: "font-medium text-subtext-0 tabular-nums",
                "aria-label": countLabel,
                children: count
            }),
            note && _jsx("span", {
                className: "min-w-0 truncate text-[0.62rem] font-normal text-subtext-0",
                children: note
            })
        ]
    }));
}
/** The state at the end of a chat row, in words. Idle says nothing; the harness mark stays plain. `count` is for
 * a folded project. */
export function StateBadge({ section, count = 1, testId }) {
    if (section === "idle")
        return null;
    const n = count > 1 ? _jsx("span", {
        className: "ml-1 tabular-nums",
        children: count
    }) : null;
    return (_jsxs("span", {
        className: "shrink-0 rounded-full px-1.5 py-px text-[11px] leading-4 font-medium text-fg",
        style: { backgroundColor: `color-mix(in srgb, ${sectionColor(section)} 22%, transparent)` },
        "data-state": section,
        "data-testid": testId,
        children: [
            SECTION_WORDS[section],
            n
        ]
    }));
}
/** A folded project's most urgent state, and how many chats are in it. */
export function Rollup({ count, section, testId }) {
    if (!count)
        return null;
    return (_jsx("span", {
        className: "inline-flex shrink-0 items-center",
        "data-testid": testId,
        "data-section": section,
        title: `${count} ${SECTION_WORDS[section].toLowerCase()}`,
        children: _jsx(StateBadge, {
            section: section,
            count: count
        })
    }));
}
/** Orca's hidden-worktrees card: worktrees perch discovered but did not create (or that were hidden) stay out of
 * the tree until shown here. */
export function HiddenWorktrees({ workspaces, projectId }) {
    const [open, setOpen] = useState(false);
    const count = workspaces.length;
    return (_jsxs("div", { children: [_jsxs("button", {
                type: "button",
                className: "w-full cursor-pointer pt-1 pr-[0.45rem] pb-1 pl-[1.45rem] text-left text-[0.62rem] text-overlay-1 [background:none] [border:0] [font-family:inherit] hover:text-accent focus-visible:text-accent",
                "aria-expanded": open,
                "data-testid": `workspace-hidden-${projectId}`,
                onClick: () => setOpen(!open),
                children: [
                    count,
                    " hidden worktree",
                    count === 1 ? "" : "s"
                ]
            }), open && workspaces.map((workspace) => (_jsxs("div", {
                className: "flex items-center gap-[0.35rem] py-[3px] pr-3 pl-[1.45rem]",
                title: workspace.path,
                children: [
                    _jsxs("span", {
                        className: BODY,
                        children: [
                            _jsx("strong", {
                                className: STRONG,
                                children: workspace.branch || basename(workspace.path)
                            }),
                            _jsx("span", {
                                className: SPAN,
                                children: workspace.path
                            })
                        ]
                    }),
                    _jsx("button", {
                        type: "button",
                        className: JOB_ACTION,
                        "data-testid": `workspace-show-${workspace.id}`,
                        onClick: () => runCommand("workspace.hide", { id: workspace.id, hidden: false }),
                        children: "Show"
                    })
                ]
            }, workspace.id)))] }));
}
/** Background worktree creates for one project: Orca's sidebar progress row, with Cancel while running and
 * Retry / Dismiss once a create failed. */
export function WorktreeJobRows({ jobs }) {
    return (_jsx(_Fragment, { children: jobs.map((job) => {
            const failed = job.status === "failed";
            return (_jsxs("div", {
                className: "workspace-entry relative",
                "data-testid": `worktree-job-${job.branch}`,
                role: "status",
                children: [
                    _jsxs("div", {
                        className: cn(ENTRY_BTN, "cursor-default bg-transparent"),
                        title: job.path,
                        children: [
                            _jsx("span", {
                                className: cn(DOT, failed && "text-red"),
                                "aria-hidden": "true",
                                children: failed ? "✕" : "◌"
                            }),
                            _jsxs("span", {
                                className: BODY,
                                children: [
                                    _jsx("strong", {
                                        className: STRONG,
                                        children: job.branch
                                    }),
                                    _jsx("span", {
                                        className: cn(SPAN, failed && "text-red"),
                                        "data-testid": `worktree-job-phase-${job.branch}`,
                                        children: failed ? "Create failed" : `${job.phase}…`
                                    })
                                ]
                            }),
                            job.status === "running" && (_jsx("button", {
                                type: "button",
                                className: JOB_ACTION,
                                "data-testid": `worktree-job-cancel-${job.branch}`,
                                onClick: () => runCommand("worktree.cancel", { id: job.id }),
                                children: "Cancel"
                            })),
                            failed && (_jsxs(_Fragment, { children: [_jsx("button", {
                                        type: "button",
                                        className: JOB_ACTION,
                                        "data-testid": `worktree-job-retry-${job.branch}`,
                                        onClick: () => runCommand("worktree.retry", { id: job.id }),
                                        children: "Retry"
                                    }), _jsx("button", {
                                        type: "button",
                                        className: JOB_ACTION,
                                        "data-testid": `worktree-job-dismiss-${job.branch}`,
                                        onClick: () => runCommand("worktree.dismiss", { id: job.id }),
                                        children: "Dismiss"
                                    })] }))
                        ]
                    }),
                    failed && (_jsx("div", {
                        className: "mt-0 mr-[0.3rem] mb-[0.3rem] ml-[1.45rem] overflow-hidden text-[0.6rem] text-red [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]",
                        "data-testid": `worktree-job-error-${job.branch}`,
                        title: job.error,
                        children: job.error
                    }))
                ]
            }, job.id));
        }) }));
}
