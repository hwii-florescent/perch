// content.tsx of Perch's stock screen "stock:sidebar", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! The sidebar's body, part of the stock screen `stock:sidebar`: the host chip (only once there is more than this
//! machine), New session, then the active host's projects (`WorkspaceOverview`) or, for a host without projects,
//! its sessions by folder (`FolderList`). The phone's switcher shows this same body (`compact`: no drag, no key
//! hint; `onNavigate` once something is chosen, so the panel can close).
import { useState } from "react";
import { cn, keyLabel, runCommand, segmentClass, useHosts } from "@perch/sdk";
import { FolderList } from "./folders.js";
import { HostChip, HostSwitcherPopover } from "./hosts.js";
import { PlusIcon } from "./icons.js";
import { WorkspaceOverview } from "./overview.js";
export function SidebarContent({ compact = false, onNavigate, onManageHosts }) {
    const hosts = useHosts();
    const [hostAnchor, setHostAnchor] = useState(null);
    return (_jsxs(_Fragment, { children: [_jsxs("div", {
                className: "flex min-h-0 flex-1 flex-col overflow-y-auto",
                children: [
                    (hosts.list.length > 1 || hosts.activeId !== "local") && (_jsxs("button", {
                        type: "button",
                        className: "flex w-full shrink-0 cursor-pointer items-start gap-[0.3rem] bg-transparent text-left text-fg [font-family:inherit] [transition:background_0.12s_ease] hover:bg-surface-1",
                        "data-testid": "host-switcher",
                        title: "Switch host",
                        "aria-haspopup": "true",
                        "aria-expanded": hostAnchor != null,
                        onClick: (e) => setHostAnchor(e.currentTarget.getBoundingClientRect()),
                        children: [
                            _jsx(HostChip, { hosts: hosts }),
                            _jsx("span", {
                                className: "shrink-0 pt-[0.6rem] pr-2 text-[0.7rem] text-subtext-0",
                                "aria-hidden": "true",
                                children: "\u25BE"
                            })
                        ]
                    })),
                    _jsx("div", {
                        className: "flex shrink-0 flex-col items-stretch px-[3px]",
                        children: _jsxs("button", {
                            type: "button",
                            className: cn(segmentClass(), "w-full shrink-0 gap-2 rounded-ui px-[0.9rem] py-[0.55rem] text-left text-[0.82rem] font-semibold text-fg min-[701px]:px-3 min-[701px]:text-[12.5px] min-[701px]:font-medium"),
                            "data-testid": `new-session-${hosts.activeId}`,
                            disabled: !hosts.canCreate,
                            onClick: () => { runCommand("sessions.new"); onNavigate?.(); },
                            children: [
                                _jsx(PlusIcon, { className: "shrink-0 text-subtext-0" }),
                                "New session",
                                !compact && _jsx("span", {
                                    className: "ml-auto text-[0.7rem] font-normal text-subtext-0",
                                    children: keyLabel("cmd+shift+t")
                                })
                            ]
                        })
                    }),
                    hosts.workspaces ? _jsx(WorkspaceOverview, {
                        compact: compact,
                        onNavigate: onNavigate
                    }) : _jsx(FolderList, {})
                ]
            }), hostAnchor && (_jsx(HostSwitcherPopover, {
                hosts: hosts,
                anchorRect: hostAnchor,
                onClose: () => setHostAnchor(null),
                onManage: () => { runCommand("app.settings"); onManageHosts?.(); }
            }))] }));
}
