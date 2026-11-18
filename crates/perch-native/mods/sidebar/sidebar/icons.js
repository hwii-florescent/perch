// icons.tsx of Perch's stock screen "stock:sidebar", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export const PlusIcon = ({ size = 14, className }) => (_jsx("svg", {
    className: className,
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    "aria-hidden": "true",
    children: _jsx("path", { d: "M8 2.5v11M2.5 8h11" })
}));
export const EllipsisIcon = ({ size = 14, className }) => (_jsxs("svg", {
    className: className,
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "currentColor",
    "aria-hidden": "true",
    children: [
        _jsx("circle", {
            cx: "3.5",
            cy: "8",
            r: "1.1"
        }),
        _jsx("circle", {
            cx: "8",
            cy: "8",
            r: "1.1"
        }),
        _jsx("circle", {
            cx: "12.5",
            cy: "8",
            r: "1.1"
        })
    ]
}));
/** Settings: a cog outline, so it draws the same on every platform. */
export const GearIcon = ({ size = 16, className }) => (_jsxs("svg", {
    className: className,
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: [
        _jsx("path", { d: "M6.6 1.8h2.8l.4 1.6 1.1.6 1.5-.6 1.4 2.4-1.2 1.1v1.3l1.2 1.1-1.4 2.4-1.5-.6-1.1.6-.4 1.6H6.6l-.4-1.6-1.1-.6-1.5.6-1.4-2.4 1.2-1.1V7.3L2.2 6.2l1.4-2.4 1.5.6 1.1-.6z" }),
        _jsx("circle", {
            cx: "8",
            cy: "8",
            r: "2"
        })
    ]
}));
/** The disclosure arrow: down when open, right when folded. */
export const Chevron = ({ open, size = 12, className }) => (_jsx("svg", {
    className: className,
    width: size,
    height: size,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: _jsx("path", { d: open ? "M2.5 4.5 6 8l3.5-3.5" : "M4.5 2.5 8 6l-3.5 3.5" })
}));
/** The mark that says a line is a project (a folder; filled for a favourite). */
export const FolderMark = ({ className = "mr-1.5 h-3 w-3 shrink-0 text-subtext-0", filled = false, testId }) => (_jsx("svg", {
    className: className,
    "data-testid": testId,
    viewBox: "0 0 16 16",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    children: _jsx("path", { d: "M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" })
}));
/** New chat: a pencil over a page. */
export const NewChatIcon = () => (_jsx("svg", {
    className: "mx-auto",
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: _jsx("path", { d: "M8 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V8M11.2 2.8a1.2 1.2 0 0 1 1.7 1.7L8.5 8.9 6 9.5l.6-2.5z" })
}));
/** A checkout: a diamond for a project's main folder, a branch for a worktree. */
export const CheckoutIcon = ({ linked }) => (_jsx("svg", {
    className: "h-3 w-3 shrink-0 text-subtext-0",
    "data-testid": "workspace-checkout-icon",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    children: linked ? _jsxs(_Fragment, { children: [_jsx("circle", {
                cx: "4",
                cy: "3",
                r: "1.5"
            }), _jsx("circle", {
                cx: "4",
                cy: "13",
                r: "1.5"
            }), _jsx("circle", {
                cx: "12",
                cy: "3",
                r: "1.5"
            }), _jsx("path", { d: "M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5" })] }) : _jsx("path", { d: "M8 3l5 5-5 5-5-5z" })
}));
/** The organize menu's button: three shortening lines. */
export const OrganizeIcon = () => (_jsx("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: _jsx("path", { d: "M2.5 4.5h11M4.5 8h7M6.5 11.5h3" })
}));
