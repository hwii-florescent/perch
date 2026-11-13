// card.tsx of Perch's stock screen "stock:start", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { buttonClass, cn, Select } from "@perch/sdk";
export const START_PANEL = "flex min-h-0 min-w-0 flex-1 justify-center overflow-y-auto bg-panel-bg px-4 py-8";
export const START_NAME = "m-0 text-[2.4rem] font-bold tracking-[-0.02em] text-fg";
export const START_HINT = "m-0 text-center text-[0.85rem] text-subtext-0";
/** A start button (called while rendering: an SDK call at module top level would run inside the SDK's import cycle). */
export const startAction = () => buttonClass({ variant: "soft", size: "lg", className: "text-fg" });
export const START_LINK = "cursor-pointer bg-transparent p-0 text-[0.75rem] text-subtext-0 [border:0] [font-family:inherit] [font-weight:inherit] [line-height:inherit] hover:text-fg hover:underline focus-visible:text-fg focus-visible:underline";
const PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full rounded-ui py-[0.3rem] pr-[0.55rem] pl-[0.45rem] text-fg bg-[var(--picker-bg,var(--panel-bg))] [font-family:inherit] focus-visible:[outline:1px_solid_var(--accent)] max-w-full text-[0.8rem] [--picker-bg:var(--surface-0)]";
const ADD = "\0add-project";
/** The folder chip (Codex's project chip): the targets, then "Add project…", which is never a target itself. */
export function FolderPicker({ targets, value, onChange, onAdd, testId = "cli-start-target" }) {
    return _jsx(Select, {
        className: PICKER,
        ariaLabel: "Where to open",
        testId: testId,
        value: value,
        onChange: (key) => (key === ADD ? onAdd() : onChange(key)),
        options: [
            ...targets.map((target) => ({ value: target.key, label: target.label })), { value: ADD, text: "Add project", label: _jsx("span", {
                    className: "text-accent",
                    children: "Add project\u2026"
                }) }
        ]
    });
}
export function StartCard({ name, path, choices, idPrefix, testId, disabled, onPick, target, status, extraLinks, openSettings }) {
    return (_jsx("div", {
        className: cn(START_PANEL, "items-center"),
        "data-testid": testId,
        children: _jsxs("div", {
            className: "flex w-full max-w-[24rem] flex-col items-center gap-4",
            children: [
                _jsx("h1", {
                    className: cn(START_NAME, "max-w-full overflow-hidden text-[1.6rem] text-ellipsis whitespace-nowrap"),
                    children: name
                }),
                _jsx("p", {
                    className: START_HINT,
                    title: path,
                    children: path
                }),
                target,
                _jsx("p", {
                    className: START_HINT,
                    children: "What do you want to open?"
                }),
                status,
                _jsx("div", {
                    className: "flex flex-wrap justify-center gap-[0.6rem]",
                    children: choices.map((choice) => (_jsx("button", {
                        type: "button",
                        className: cn(startAction(), "max-[700px]:min-h-11"),
                        disabled: disabled,
                        "data-testid": `${idPrefix}-${choice.id}`,
                        onClick: () => onPick(choice.id),
                        children: choice.label
                    }, choice.id)))
                }),
                _jsxs("div", {
                    className: "flex flex-wrap justify-center gap-x-4 gap-y-1",
                    children: [
                        extraLinks,
                        _jsx("button", {
                            type: "button",
                            className: START_LINK,
                            onClick: openSettings,
                            children: "Open one automatically: Settings \u2192 Empty workspace opens"
                        })
                    ]
                })
            ]
        })
    }));
}
