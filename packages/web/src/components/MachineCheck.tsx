/**
 * Settings > SSH hosts, under the add form: look at a computer over ssh before adding it, and put
 * `perch-core` on it from here (herdr's `machine add`). The core does the ssh
 * (`crates/perch-core/src/machine.rs`); this is the host's side of it: the socket traffic, what is running and what
 * the last answer was. The words and buttons are the screen `stock:settings-hosts`
 * (`stock-ui/settings-hosts/machine-check.tsx`).
 */
import { useEffect, useState } from "react";
import type { MachineResultMessage } from "@perch/shared";
import { socket } from "../ws";
import { newId } from "../ids";

type Result = Pick<MachineResultMessage, "probe" | "installedPath" | "error" | "loginArgv"> & { sshHost: string };

/** `check` and `install` ask over ssh; `onCore` runs when the answer finds `perch-core` on the machine. */
export function useMachineCheck() {
  const [sshConfigHosts, setConfigHosts] = useState<string[]>([]);
  const [pending, setPending] = useState<{ id: string; install: boolean; onCore?: () => void } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

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
      if (message.probe?.coreVersion) pending.onCore?.();
    });
  }, [pending]);

  const ask = (install: boolean, sshHost: string, onCore?: () => void) => {
    const id = newId();
    setPending({ id, install, onCore });
    setResult(null);
    socket.send({ type: install ? "machine.install" : "machine.probe", requestId: id, sshHost: sshHost.trim() });
  };
  return {
    state: { sshConfigHosts, pending: pending ? (pending.install ? "install" : "check") as "install" | "check" : null, result },
    check: (sshHost: string, onCore?: () => void) => ask(false, sshHost, onCore),
    install: (sshHost: string, onCore?: () => void) => ask(true, sshHost, onCore),
  };
}
