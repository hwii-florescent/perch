//! Settings > SSH hosts, under the add form: look at a computer over ssh before adding it, and put `perch-core` on it
//! from here. The core does the ssh (`crates/perch-core/src/machine.rs`) and Perch keeps what it found
//! (`machine`); this shows it and the next step. `onCore` runs when a check or install finds `perch-core` there. It
//! also offers the `~/.ssh/config` host names to the SSH host field through the `ssh-config-hosts` datalist.
import { settingsClass, type HostsSettingsProps, type MachineProbe } from "@perch/sdk";

export const SSH_CONFIG_HOSTS = "ssh-config-hosts";

export function MachineCheck({ sshHost, machine, actions, onCore }: {
  sshHost: string;
  machine: HostsSettingsProps["machine"];
  actions: Pick<HostsSettingsProps["actions"], "checkMachine" | "installCore" | "logIn">;
  onCore?: () => void;
}) {
  const { sshConfigHosts, pending, result } = machine;
  const target = sshHost.trim();
  const shown = result && result.sshHost === target ? result : null;

  return (
    <div className="mt-[0.5rem] flex flex-col gap-[0.35rem]" data-testid="machine-check">
      <datalist id={SSH_CONFIG_HOSTS}>{sshConfigHosts.map((host) => <option key={host} value={host} />)}</datalist>
      <div className="flex flex-wrap items-center gap-[0.4rem]">
        <button type="button" className={settingsClass.primary} data-testid="machine-check-run" disabled={!target || !!pending} onClick={() => actions.checkMachine(target, onCore)}>
          {pending === "check" ? "Checking…" : "Check machine"}
        </button>
        {shown?.probe && (
          <button type="button" className={settingsClass.primary} data-testid="machine-install" disabled={!!pending} onClick={() => actions.installCore(target, onCore)}>
            {pending === "install" ? "Installing…" : shown.probe.coreVersion ? "Reinstall perch-core" : "Install perch-core"}
          </button>
        )}
        {shown?.error?.kind === "needs_login" && shown.loginArgv && (
          <button type="button" className={settingsClass.primary} data-testid="machine-login" onClick={() => actions.logIn(shown.loginArgv!)}>
            Log in
          </button>
        )}
      </div>
      {shown?.error && (
        <p className={settingsClass.muted} role="alert" data-testid="machine-error">
          {shown.error.message}. {shown.error.hint}
        </p>
      )}
      {shown?.probe && (
        <p className={settingsClass.muted} data-testid="machine-summary">
          {describe(shown.probe)}
          {shown.installedPath ? ` Installed at ${shown.installedPath}.` : ""}
        </p>
      )}
    </div>
  );
}

/** One sentence about a computer a probe found. */
export function describe(probe: MachineProbe): string {
  const system = `${probe.os === "macos" ? "macOS" : "Linux"} ${probe.arch}`;
  const core = probe.coreVersion ? `${probe.coreVersion} is installed` : "perch-core is not installed";
  const tmux = probe.tmux ? "" : " tmux is missing: Perch starts its core there with tmux.";
  return `${system}. ${core}.${tmux}`;
}
