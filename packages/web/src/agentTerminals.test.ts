// @vitest-environment jsdom
import v8 from "node:v8";
import vm from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentControlLease, AgentLifecycleStatus, AgentTerminalOpenedMessage } from "@perch/shared";
const transport = vi.hoisted(() => ({ send: vi.fn(), connection: (_: boolean) => {} }));
vi.mock("./ws", () => ({ socket: { send: transport.send, onConnectionChange: (handler: (connected: boolean) => void) => { transport.connection = handler; } } }));
import { emitTerminalData } from "./terminalBus";
import { handleAgentTerminalMessage, openAgentTerminal, sendAgentTerminalInput } from "./agentTerminals";

beforeEach(() => transport.send.mockClear());
afterEach(() => { transport.connection(false); vi.useRealTimers(); });
const snapshot = (agentId: string, revision = 1): AgentLifecycleStatus => ({
  key: { workspaceId: "workspace", sessionId: "session", agentId }, providerId: agentId,
  resumable: true, state: "idle", reason: "started", lastActivityMs: 0, lastTransitionMs: 0, revision, transitionSequence: 0,
});
function opened(index: number, terminalId: string): AgentTerminalOpenedMessage {
  const message = transport.send.mock.calls[index][0];
  return { type: "agent.terminal.opened", requestId: message.requestId, terminalId, status: snapshot(message.providerId), replay: "replay" };
}

it("keeps provider replies and immediate live output attached to the correct view", async () => {
  const a = vi.fn(); const b = vi.fn();
  const first = openAgentTerminal("session", "claude", 80, 24, (_, __, replay) => a(replay), a, () => {});
  const second = openAgentTerminal("session", "codex", 80, 24, (_, __, replay) => b(replay), b, () => {});
  handleAgentTerminalMessage(opened(1, "codex-terminal"));
  emitTerminalData("codex-terminal", "codex-live");
  handleAgentTerminalMessage(opened(0, "claude-terminal"));
  emitTerminalData("claude-terminal", "claude-live");
  await Promise.all([first.ready, second.ready]);
  expect(a.mock.calls.flat()).toEqual(["replay", "claude-live"]);
  expect(b.mock.calls.flat()).toEqual(["replay", "codex-live"]);
  first.release(); second.release();
});

it("does not kill or activate a process when its open reply arrives after unmount", async () => {
  const ready = vi.fn();
  const binding = openAgentTerminal("session", "claude", 80, 24, ready, () => {}, () => {});
  binding.release();
  handleAgentTerminalMessage(opened(0, "late-terminal"));
  await binding.ready;
  expect(ready).not.toHaveBeenCalled();
  expect(transport.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: "agent.terminal.release", providerId: "claude" }));
  expect(transport.send.mock.calls.some(([message]) => message.type === "terminal.kill")).toBe(false);
});

it("keeps new lease replies ahead of old status pushes, then revokes input on transfer", async () => {
  const size = { cols: 80, rows: 24 };
  const binding = openAgentTerminal("session", "claude", 80, 24, () => {}, () => {}, () => {}, () => size);
  handleAgentTerminalMessage(opened(0, "controlled"));
  await binding.ready;
  const input: AgentControlLease = { clientId: "local-viewer", deviceId: "local", generation: 7, acquiredAtMs: 0, lastActivityMs: 0 };
  const resize = { ...input, generation: 8 };
  const taking = binding.takeControl();
  const reply = (lease: AgentControlLease, status: AgentLifecycleStatus) => {
    const message = transport.send.mock.calls.at(-1)![0];
    handleAgentTerminalMessage({ type: "agent.control", requestId: message.requestId, sessionId: "session", agentId: "claude", channel: message.channel, lease, status });
  };
  reply(input, { ...snapshot("claude", 2), inputOwner: input });
  await vi.waitFor(() => expect(transport.send.mock.calls.at(-1)![0].channel).toBe("resize"));
  size.cols = 130;
  size.rows = 33;
  reply(resize, { ...snapshot("claude", 3), inputOwner: input, resizeOwner: resize });
  await taking;
  expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.resize", terminalId: "controlled", cols: 130, rows: 33, generation: 8 });
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: snapshot("claude", 1) });
  sendAgentTerminalInput("controlled", "still-owned");
  expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.input", terminalId: "controlled", data: "still-owned", generation: 7 });
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: { ...snapshot("claude", 4), inputOwner: { ...input, clientId: "phone", generation: 9 } } });
  const count = transport.send.mock.calls.length;
  expect(sendAgentTerminalInput("controlled", "must-not-send")).toBe(true);
  expect(transport.send).toHaveBeenCalledTimes(count);
  binding.release();
});

it("a released view's terminal is collectable once its request is retired", async () => {
  v8.setFlagsFromString("--expose-gc");
  const gc = vm.runInNewContext("gc") as () => void;
  let terminal!: WeakRef<object>;
  await (async () => {
    const xterm = { buffer: new Uint8Array(1 << 20) };
    terminal = new WeakRef(xterm);
    const binding = openAgentTerminal("session", "claude", 80, 24, () => xterm.buffer, () => xterm.buffer, () => xterm.buffer);
    handleAgentTerminalMessage(opened(0, "collected"));
    await binding.ready;
    binding.release();
  })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  gc();
  expect(terminal.deref()).toBeUndefined();
});

it("releases a view whose open timed out, again when its reply turns up late", async () => {
  vi.useFakeTimers();
  const binding = openAgentTerminal("session", "claude", 80, 24, () => {}, () => {}, () => {});
  const late = opened(0, "late-terminal");
  vi.advanceTimersByTime(15_000);
  await expect(binding.ready).rejects.toThrow(/timed out/);
  const release = expect.objectContaining({ type: "agent.terminal.release", providerId: "claude" });
  expect(transport.send).toHaveBeenLastCalledWith(release);
  transport.send.mockClear();
  expect(handleAgentTerminalMessage(late)).toBe(true);
  expect(transport.send).toHaveBeenCalledExactlyOnceWith(release);
});
