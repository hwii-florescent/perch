// agent-picker.tsx of Perch's stock screen "stock:new-session", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! The agent dropdown of the unscoped new-session menu: the host's agents (`useAgentChoices`), the host's default
//! picked once its list arrives, "Manage agents…" when the host lists its agents. Part of `stock:new-session`.
import { useEffect, useRef } from "react";
import { cn, menuItemClass as menuItem, Select, useAgentChoices } from "@perch/sdk";
/** Trigger look for an agent `Select`. Phones lift the min-height to a 44px touch target. */
const AGENT_PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full rounded-ui py-[0.3rem] pr-[0.55rem] pl-[0.45rem] text-[0.8rem] text-fg bg-[var(--picker-bg,var(--panel-bg))] [font-family:inherit] focus-visible:[outline:1px_solid_var(--accent)]";
export function AgentPicker({ value, onChange, onManage, hostId, testIdPrefix, className, wrapClassName }) {
    const { connected, discovery, state, error, choices, manage } = useAgentChoices(hostId);
    const seededHost = useRef(null);
    const preferred = choices.find((entry) => entry.isDefault)?.id;
    const first = choices[0]?.id;
    const valid = choices.some((entry) => entry.id === value);
    useEffect(() => {
        if (!discovery || state !== "ready")
            return;
        if (seededHost.current !== hostId) {
            seededHost.current = hostId;
            if (preferred && preferred !== value) {
                onChange(preferred);
                return;
            }
        }
        if (!valid && first)
            onChange(first);
    }, [state, discovery, first, hostId, onChange, preferred, valid, value]);
    return _jsxs("div", {
        className: wrapClassName,
        children: [
            _jsx(Select, {
                className: cn(AGENT_PICKER, className),
                ariaLabel: "Agent",
                testId: testIdPrefix,
                value: valid ? value : "",
                disabled: !connected || (discovery && state !== "ready") || !choices.length,
                onChange: onChange,
                options: choices.map((entry) => ({ value: entry.id, label: entry.label }))
            }),
            discovery && _jsx("button", {
                type: "button",
                className: cn(menuItem(), "text-subtext-0"),
                onClick: () => { onManage?.(); manage(); },
                children: "Manage agents\u2026"
            }),
            discovery && state === "error" && _jsx("p", {
                role: "alert",
                children: error
            }),
            discovery && state === "ready" && !choices.length && _jsx("p", {
                role: "status",
                children: "Enable or install an agent in Manage agents."
            })
        ]
    });
}
