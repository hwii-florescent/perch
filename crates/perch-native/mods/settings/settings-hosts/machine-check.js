// machine-check.tsx of Perch's stock screen "stock:settings-hosts", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
//! Settings > SSH hosts, under the add form: look at a computer over ssh before adding it, and put `perch-core` on it
//! from here. The core does the ssh (`crates/perch-core/src/machine.rs`) and Perch keeps what it found
//! (`machine`); this shows it and the next step. `onCore` runs when a check or install finds `perch-core` there. It
//! also offers the `~/.ssh/config` host names to the SSH host field through the `ssh-config-hosts` datalist.
import { settingsClass } from "@perch/sdk";
export const SSH_CONFIG_HOSTS = "ssh-config-hosts";
export function MachineCheck({ sshHost, machine, actions, onCore }) {
    const { sshConfigHosts, pending, result } = machine;
    const target = sshHost.trim();
    const shown = result && result.sshHost === target ? result : null;
    return (_jsxs("div", {
        className: "mt-[0.5rem] flex flex-col gap-[0.35rem]",
        "data-testid": "machine-check",
        children: [
            _jsx("datalist", {
                id: SSH_CONFIG_HOSTS,
                children: sshConfigHosts.map((host) => _jsx("option", { value: host }, host))
            }),
            _jsxs("div", {
                className: "flex flex-wrap items-center gap-[0.4rem]",
                children: [
                    _jsx("button", {
                        type: "button",
                        className: settingsClass.primary,
                        "data-testid": "machine-check-run",
                        disabled: !target || !!pending,
                        onClick: () => actions.checkMachine(target, onCore),
                        children: pending === "check" ? "Checking…" : "Check machine"
                    }),
                    shown?.probe && (_jsx("button", {
                        type: "button",
                        className: settingsClass.primary,
                        "data-testid": "machine-install",
                        disabled: !!pending,
                        onClick: () => actions.installCore(target, onCore),
                        children: pending === "install" ? "Installing…" : shown.probe.coreVersion ? "Reinstall perch-core" : "Install perch-core"
                    })),
                    shown?.error?.kind === "needs_login" && shown.loginArgv && (_jsx("button", {
                        type: "button",
                        className: settingsClass.primary,
                        "data-testid": "machine-login",
                        onClick: () => actions.logIn(shown.loginArgv),
                        children: "Log in"
                    }))
                ]
            }),
            shown?.error && (_jsxs("p", {
                className: settingsClass.muted,
                role: "alert",
                "data-testid": "machine-error",
                children: [
                    shown.error.message,
                    ". ",
                    shown.error.hint
                ]
            })),
            shown?.probe && (_jsxs("p", {
                className: settingsClass.muted,
                "data-testid": "machine-summary",
                children: [
                    describe(shown.probe),
                    shown.installedPath ? ` Installed at ${shown.installedPath}.` : ""
                ]
            }))
        ]
    }));
}
/** One sentence about a computer a probe found. */
export function describe(probe) {
    const system = `${probe.os === "macos" ? "macOS" : "Linux"} ${probe.arch}`;
    const core = probe.coreVersion ? `${probe.coreVersion} is installed` : "perch-core is not installed";
    const tmux = probe.tmux ? "" : " tmux is missing: Perch starts its core there with tmux.";
    return `${system}. ${core}.${tmux}`;
}
