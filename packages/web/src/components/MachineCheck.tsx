/**
 * Settings > Hosts, under the add form: look at a computer over ssh before adding it, and put
 * `perch-core` on it from here (herdr's `machine add`). The core does the ssh
 * (`crates/perch-core/src/machine.rs`); this shows what it found and the next step. It also offers
 * the `~/.ssh/config` host names to the SSH host field through the `ssh-config-hosts` datalist.
 */
import { useEffect, useState } from "react";
import type { MachineProbe, MachineResultMessage } from "@perch/shared";
import { socket } from "../ws";
import { newId } from "../ids";
import { runCommand } from "../modApp";
import { BTN_PRIMARY, MUTED } from "./ui/settings";

export const SSH_CONFIG_HOSTS = "ssh-config-hosts";

type Result = Pick<MachineResultMessage, "probe" | "installedPath" | "error" | "loginArgv">;

export function MachineCheck({ sshHost, onCore }: { sshHost: string; onCore?: () => void }) {
  const [configHosts, setConfigHosts] = useState<string[]>([]);
  const [pending, setPending] = useState<{ id: string; install: boolean } | null>(null);
  const [result, setResult] = useState<(Result & { sshHost: string }) | null>(null);

  useEffect(() => {
    const asked = newId();
    const off = socket.onMessage((message) => {
      if (message.type === "machine.hosts" && message.requestId === asked) setConfigHosts(message.hosts);
    });
    socket.send({ type: "machine.hosts", requestId: asked });
    return off;
  }, []);

  useEffect(() => {
    if (!pending) return;
    return socket.onMessage((message) => {
      if (message.type !== "machine.result" || message.requestId !== pending.id) return;
      setPending(null);
      setResult({ sshHost: message.sshHost, probe: message.probe, installedPath: message.installedPath, error: message.error, loginArgv: message.loginArgv });
      if (message.probe?.coreVersion) onCore?.();
    });
  }, [pending, onCore]);

  const ask = (install: boolean) => {
    const id = newId();
    setPending({ id, install });
    setResult(null);
    socket.send({ type: install ? "machine.install" : "machine.probe", requestId: id, sshHost: sshHost.trim() });
  };
  const target = sshHost.trim();
  const shown = result && result.sshHost === target ? result : null;

  return (
    <div className="mt-[0.5rem] flex flex-col gap-[0.35rem]" data-testid="machine-check">
      <datalist id={SSH_CONFIG_HOSTS}>{configHosts.map((host) => <option key={host} value={host} />)}</datalist>
      <div className="flex flex-wrap items-center gap-[0.4rem]">
        <button type="button" className={BTN_PRIMARY} data-testid="machine-check-run" disabled={!target || !!pending} onClick={() => ask(false)}>
          {pending && !pending.install ? "Checking…" : "Check machine"}
        </button>
        {shown?.probe && (
          <button type="button" className={BTN_PRIMARY} data-testid="machine-install" disabled={!!pending} onClick={() => ask(true)}>
            {pending?.install ? "Installing…" : shown.probe.coreVersion ? "Reinstall perch-core" : "Install perch-core"}
          </button>
        )}
        {shown?.error?.kind === "needs_login" && shown.loginArgv && (
          <button type="button" className={BTN_PRIMARY} data-testid="machine-login" onClick={() => runCommand("tab.new", { argv: shown.loginArgv })}>
            Log in
          </button>
        )}
      </div>
      {shown?.error && (
        <p className={MUTED} role="alert" data-testid="machine-error">
          {shown.error.message}. {shown.error.hint}
        </p>
      )}
      {shown?.probe && (
        <p className={MUTED} data-testid="machine-summary">
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
