// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { ServerMessage } from "@perch/shared";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const handlers = new Set<(message: ServerMessage) => void>();
const sent: Record<string, unknown>[] = [];
vi.mock("../ws", () => ({
  socket: {
    onMessage: (handler: (message: ServerMessage) => void) => { handlers.add(handler); return () => handlers.delete(handler); },
    send: (message: Record<string, unknown>) => { sent.push(message); },
  },
}));
const runCommand = vi.fn();
// The view draws with the SDK's class strings only; the rest of the SDK is the whole app.
vi.mock("@perch/sdk", () => ({ settingsClass: { primary: "primary", muted: "muted" } }));
vi.mock("../modApp", () => ({ runCommand: (...args: unknown[]) => runCommand(...args) }));

import { useMachineCheck } from "./MachineCheck";
import { MachineCheck as MachineCheckView, describe } from "../stock-ui/settings-hosts/machine-check";

/** The host's engine (`useMachineCheck`) behind the screen's view, as the SSH hosts page wires them. */
function MachineCheck({ sshHost, onCore }: { sshHost: string; onCore?: () => void }) {
  const machine = useMachineCheck();
  return <MachineCheckView sshHost={sshHost} machine={machine.state} onCore={onCore} actions={{
    checkMachine: machine.check, installCore: machine.install, logIn: (argv) => { runCommand("tab.new", { argv }); },
  }} />;
}

const reply = (message: unknown) => act(() => handlers.forEach((handler) => handler(message as ServerMessage)));
afterEach(() => { handlers.clear(); sent.length = 0; runCommand.mockReset(); document.body.innerHTML = ""; });

function mount(sshHost: string, onCore = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<MachineCheck sshHost={sshHost} onCore={onCore} />));
  const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid=${id}]`);
  return { host, byId, onCore, show: (next: string) => act(() => root.render(<MachineCheck sshHost={next} onCore={onCore} />)) };
}

it("offers the ssh config's hosts, checks a machine, and installs the core on request", () => {
  const view = mount(" box ");
  const hostsAsk = sent[0]!;
  expect(hostsAsk).toMatchObject({ type: "machine.hosts" });
  reply({ type: "machine.hosts", requestId: "someone-else", hosts: ["nope"] });
  reply({ type: "machine.hosts", requestId: hostsAsk.requestId, hosts: ["box", "devpod"] });
  expect(Array.from(view.host.querySelectorAll("datalist option")).map((o) => o.getAttribute("value"))).toEqual(["box", "devpod"]);

  act(() => view.byId("machine-check-run")!.click());
  const probe = sent.at(-1)!;
  expect(probe).toMatchObject({ type: "machine.probe", sshHost: "box" });
  expect(view.byId("machine-check-run")!.textContent).toBe("Checking…");
  reply({ type: "machine.result", requestId: probe.requestId, sshHost: "box", probe: { os: "linux", arch: "x86_64", home: "/home/u", tmux: true } });
  expect(view.byId("machine-summary")!.textContent).toBe("Linux x86_64. perch-core is not installed.");
  expect(view.onCore).not.toHaveBeenCalled();

  act(() => view.byId("machine-install")!.click());
  const install = sent.at(-1)!;
  expect(install).toMatchObject({ type: "machine.install", sshHost: "box" });
  reply({ type: "machine.result", requestId: install.requestId, sshHost: "box", installedPath: "/home/u/.local/bin/perch-core", probe: { os: "linux", arch: "x86_64", home: "/home/u", tmux: true, corePath: "/home/u/.local/bin/perch-core", coreVersion: "perch-core 0.0.1" } });
  expect(view.byId("machine-summary")!.textContent).toBe("Linux x86_64. perch-core 0.0.1 is installed. Installed at /home/u/.local/bin/perch-core.");
  expect(view.onCore).toHaveBeenCalledOnce();
  expect(view.byId("machine-install")!.textContent).toBe("Reinstall perch-core");
});

it("shows the next step for a failure, and Log in runs ssh in a terminal when ssh wants a person", () => {
  const view = mount("box");
  act(() => view.byId("machine-check-run")!.click());
  const probe = sent.at(-1)!;
  reply({ type: "machine.result", requestId: probe.requestId, sshHost: "box", error: { kind: "needs_login", message: "ssh needs a person to log in to this machine", hint: "Use Log in." }, loginArgv: ["ssh", "-o", "ControlMaster=auto", "box", "exit"] });
  expect(view.byId("machine-error")!.textContent).toBe("ssh needs a person to log in to this machine. Use Log in.");
  act(() => view.byId("machine-login")!.click());
  expect(runCommand).toHaveBeenCalledWith("tab.new", { argv: ["ssh", "-o", "ControlMaster=auto", "box", "exit"] });
  expect(view.byId("machine-install")).toBeNull();
  view.show("other-box"); // an answer about one machine is not shown for another
  expect(view.byId("machine-error")).toBeNull();
  expect(view.byId("machine-login")).toBeNull();
});

it("does not check an empty target, and describes a bare Mac", () => {
  const empty = mount("  ");
  expect(empty.byId("machine-check-run")!.hasAttribute("disabled")).toBe(true);
  expect(describe({ os: "macos", arch: "aarch64", home: "/h", tmux: false })).toBe("macOS aarch64. perch-core is not installed. tmux is missing: Perch starts its core there with tmux.");
});
