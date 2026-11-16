// main.tsx of Perch's stock screen "stock:settings-hosts", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! SSH hosts settings, the stock screen `stock:settings-hosts`: the computers Perch reaches over ssh, each one's
//! connection, mode and switch, and the form that adds one (with a check of the machine before adding it).
//! Settings > SSH hosts shows it (the phone keeps Perch's own); or the person's package chosen for it
//! (`perch mod use stock:settings-hosts <id>`) with the same props.
//!
//! The hosts, their connection state, adding, changing and deleting one, and the ssh check and install are Perch's
//! (`actions`, `machine`). The new-host form is the person's unsent work: Perch keeps each field under
//! `settings:hosts:new*`, so swapping this page for a copy (or leaving Settings) loses nothing, and nothing is added
//! until Add. The list uses `HostStateDot` and `Select` from `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-hosts` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { HostStateDot, Select, SettingsGroup, settingsClass, useResourceState } from "@perch/sdk";
import { MachineCheck, SSH_CONFIG_HOSTS } from "./machine-check.js";
export default function HostsSettings({ hosts, hostStates, machine, actions }) {
    const [newName, setNewName] = useResourceState("settings:hosts:newName", "");
    const [newSshHost, setNewSshHost] = useResourceState("settings:hosts:newSshHost", "");
    const [newPort, setNewPort] = useResourceState("settings:hosts:newPort", "7788");
    const [newDirectUrl, setNewDirectUrl] = useResourceState("settings:hosts:newDirectUrl", "");
    const [newRemoteCmd, setNewRemoteCmd] = useResourceState("settings:hosts:newRemoteCmd", "");
    // "perch" = classic federation (remote runs its own perch); "direct" = the remote has only claude/codex + tmux and
    // perch drives them over SSH with every turn detached. Defaults to "direct": most SSH targets don't have perch
    // installed, so direct is the normal case for a newly added host.
    const [newMode, setNewMode] = useResourceState("settings:hosts:newMode", "direct");
    const { select, selectHost, input, inputPort, addRow, list, hostRow, name, addr, empty, primary, danger } = settingsClass;
    const handleAdd = () => {
        // Perch checks the form (a name and an ssh host are needed) and says whether it added the host.
        if (!actions.addHost({ name: newName, sshHost: newSshHost, port: newPort, mode: newMode, directUrl: newDirectUrl, remoteCmd: newRemoteCmd }))
            return;
        setNewName("");
        setNewSshHost("");
        setNewPort("7788");
        setNewDirectUrl("");
        setNewRemoteCmd("");
        setNewMode("direct");
    };
    return (_jsx(SettingsGroup, { children: _jsxs("div", {
            className: "py-3",
            children: [
                hosts.length === 0 ? (_jsx("p", {
                    className: empty,
                    children: "No hosts configured."
                })) : (_jsx("ul", {
                    className: list,
                    children: hosts.map((h) => {
                        const info = hostStates[h.id];
                        // Derive display state: info.state if available, else infer.
                        const state = info
                            ? info.state
                            : h.enabled ? "connecting" : "disabled";
                        return (_jsxs("li", {
                            className: hostRow,
                            children: [
                                _jsx(HostStateDot, {
                                    state: state,
                                    error: info?.error
                                }),
                                _jsx("span", {
                                    className: name,
                                    children: h.name
                                }),
                                _jsxs("span", {
                                    className: addr,
                                    children: [
                                        h.sshHost,
                                        ":",
                                        h.remotePort
                                    ]
                                }),
                                _jsx(Select, {
                                    className: selectHost,
                                    testId: `host-mode-${h.name}`,
                                    ariaLabel: `${h.name} mode`,
                                    title: "perch = remote runs its own perch; direct = remote only needs claude/codex + tmux",
                                    value: h.mode ?? "perch",
                                    onChange: (value) => actions.upsertHost({ ...h, mode: value === "direct" ? "direct" : "perch" }),
                                    options: [
                                        { value: "perch", label: "perch" }, { value: "direct", label: "direct" }
                                    ]
                                }),
                                state === "error" && info?.error && (_jsx("span", {
                                    className: "min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-red max-[700px]:basis-full",
                                    title: info.error,
                                    children: info.error.length > 40 ? info.error.slice(0, 40) + "…" : info.error
                                })),
                                _jsxs("label", {
                                    className: "flex shrink-0 cursor-pointer items-center gap-[0.3rem] text-[0.78rem] text-subtext-0",
                                    title: "Enabled",
                                    children: [
                                        _jsx("input", {
                                            type: "checkbox",
                                            checked: h.enabled,
                                            onChange: () => actions.upsertHost({ ...h, enabled: !h.enabled })
                                        }),
                                        _jsx("span", { children: "enabled" })
                                    ]
                                }),
                                _jsx("button", {
                                    type: "button",
                                    className: danger,
                                    "data-testid": `host-delete-${h.name}`,
                                    onClick: () => actions.deleteHost(h.id),
                                    children: "Delete"
                                })
                            ]
                        }, h.id));
                    })
                })),
                _jsxs("div", {
                    className: addRow,
                    children: [
                        _jsx("input", {
                            type: "text",
                            className: input,
                            placeholder: "Name",
                            value: newName,
                            "data-testid": "host-name-input",
                            onChange: (e) => setNewName(e.target.value)
                        }),
                        _jsx("input", {
                            type: "text",
                            className: input,
                            placeholder: "SSH host",
                            list: SSH_CONFIG_HOSTS,
                            value: newSshHost,
                            "data-testid": "host-ssh-input",
                            onChange: (e) => setNewSshHost(e.target.value)
                        }),
                        _jsx("input", {
                            type: "number",
                            className: inputPort,
                            placeholder: "Port",
                            value: newPort,
                            onChange: (e) => setNewPort(e.target.value)
                        }),
                        _jsx(Select, {
                            className: select,
                            testId: "host-mode-input",
                            ariaLabel: "New host mode",
                            title: "direct = remote only needs claude/codex + tmux; perch = remote runs its own perch",
                            value: newMode,
                            onChange: (value) => setNewMode(value === "perch" ? "perch" : "direct"),
                            options: [
                                { value: "direct", label: "direct" }, { value: "perch", label: "perch" }
                            ]
                        }),
                        _jsx("button", {
                            type: "button",
                            className: primary,
                            "data-testid": "host-add",
                            onClick: handleAdd,
                            children: "Add"
                        })
                    ]
                }),
                _jsx(MachineCheck, {
                    sshHost: newSshHost,
                    machine: machine,
                    actions: actions,
                    onCore: () => setNewMode("perch")
                }),
                _jsxs("div", {
                    className: `${addRow} mt-[0.35rem] opacity-75`,
                    children: [
                        _jsx("input", {
                            type: "text",
                            className: input,
                            placeholder: "Direct URL (optional, e.g. ws://127.0.0.1:7800/ws)",
                            value: newDirectUrl,
                            "data-testid": "host-direct-url-input",
                            onChange: (e) => setNewDirectUrl(e.target.value)
                        }),
                        _jsx("input", {
                            type: "text",
                            className: input,
                            placeholder: "Remote start cmd (optional, {port} placeholder)",
                            value: newRemoteCmd,
                            "data-testid": "host-remote-cmd-input",
                            onChange: (e) => setNewRemoteCmd(e.target.value)
                        })
                    ]
                })
            ]
        }) }));
}
