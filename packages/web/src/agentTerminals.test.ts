// @vitest-environment jsdom
import v8 from "node:v8";
import vm from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentControlLease, AgentLifecycleStatus, AgentTerminalOpenedMessage } from "@perch/shared";
const transport = vi.hoisted(() => ({ send: vi.fn(), connection: (_: boolean) => {} }));
vi.mock("./ws", () => ({ socket: { send: transport.send, onConnectionChange: (handler: (connected: boolean) => void) => { transport.connection = handler; } } }));
import { emitTerminalData } from "./terminalBus";
import { handleAgentTerminalMessage, openAgentTerminal, sendAgentTerminalInput, resizeAgentTerminal, canStopAgent, RESIZE_QUIET_MS } from "./agentTerminals";

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
  await vi.waitFor(() => expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.resize", terminalId: "controlled", cols: 130, rows: 33, generation: 8 }));
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: snapshot("claude", 1) });
  sendAgentTerminalInput("controlled", "still-owned");
  expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.input", terminalId: "controlled", data: "still-owned", generation: 7 });
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: { ...snapshot("claude", 4), inputOwner: { ...input, clientId: "phone", generation: 9 } } });
  const count = transport.send.mock.calls.length;
  expect(sendAgentTerminalInput("controlled", "must-not-send")).toBe(true);
  expect(transport.send).toHaveBeenCalledTimes(count);
  binding.release();
});

it("shared views type without a lease, including after reload, without resizing or gaining stop authority", async () => {
  const owner: AgentControlLease = { clientId: "desktop", deviceId: "local", generation: 7, acquiredAtMs: 0, lastActivityMs: 0 };
  const attach = async () => {
    const index = transport.send.mock.calls.length;
    const binding = openAgentTerminal("session", "claude", 80, 24, () => {}, () => {}, () => {}, undefined, true);
    handleAgentTerminalMessage({ ...opened(index, "shared"), status: { ...snapshot("claude"), inputOwner: owner, resizeOwner: owner } });
    await binding.ready;
    return binding;
  };
  let binding = await attach();
  for (const data of ["phone", "\x1b[200~\x1b[1;2R\x1b[201~"]) {
    expect(sendAgentTerminalInput("shared", data)).toBe(true);
    expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.input", terminalId: "shared", data, shared: true });
  }
  const count = transport.send.mock.calls.length;
  resizeAgentTerminal("shared", 40, 20);
  expect(transport.send).toHaveBeenCalledTimes(count);
  expect(canStopAgent("session")).toBe(false);
  binding.release();
  transport.connection(false);
  binding = await attach(); // Old connection still appears as owner in the open reply.
  sendAgentTerminalInput("shared", "after-reload");
  expect(transport.send).toHaveBeenLastCalledWith({ type: "terminal.input", terminalId: "shared", data: "after-reload", shared: true });
  binding.release();
  expect(sendAgentTerminalInput("shared", "late")).toBe(false);
});

it("automatic resize recovery cannot steal an occupied lease or resize without one", async () => {
  const binding = openAgentTerminal("session", "claude", 80, 24, () => {}, () => {}, () => {}, undefined, true);
  handleAgentTerminalMessage(opened(0, "auto-resize"));
  await binding.ready;
  const claiming = binding.takeResize(true);
  const message = transport.send.mock.calls.at(-1)![0];
  expect(message).toMatchObject({ type: "agent.control.acquire", channel: "resize", ifUnowned: true });
  const owner: AgentControlLease = { clientId: "other-view", deviceId: "local", generation: 7, acquiredAtMs: 0, lastActivityMs: 0 };
  handleAgentTerminalMessage({ type: "agent.control", requestId: message.requestId, sessionId: "session", agentId: "claude", channel: "resize", status: { ...snapshot("claude", 2), resizeOwner: owner } });
  await claiming;
  expect(transport.send).toHaveBeenLastCalledWith(message); // No terminal.resize.
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

it("the size moves to the view a person types into, once, and a drag resizes the PTY once", async () => {
  const size = { cols: 80, rows: 24 };
  const binding = openAgentTerminal("session", "claude", 80, 24, () => {}, () => {}, () => {}, () => size, true);
  handleAgentTerminalMessage(opened(0, "typed"));
  await binding.ready;
  // Another window holds the size; this one is merely shown: nothing is asked.
  const other: AgentControlLease = { clientId: "other-window", deviceId: "local", generation: 3, acquiredAtMs: 0, lastActivityMs: 0 };
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: { ...snapshot("claude", 2), resizeOwner: other } });
  const acquires = () => transport.send.mock.calls.filter(([m]) => m.type === "agent.control.acquire" && m.channel === "resize");
  expect(acquires()).toHaveLength(0);
  // Typing takes it from whoever holds it, once while the answer is on its way.
  const first = binding.typed();
  void binding.typed();
  expect(acquires()).toHaveLength(1);
  expect(acquires()[0][0].ifUnowned).toBeUndefined();
  const lease = { ...other, clientId: "this-window", generation: 4 };
  handleAgentTerminalMessage({ type: "agent.control", requestId: acquires()[0][0].requestId, sessionId: "session", agentId: "claude", channel: "resize", lease, status: { ...snapshot("claude", 3), resizeOwner: lease } });
  await first;
  await binding.typed();
  expect(acquires()).toHaveLength(1);

  // A 20-step drag, a frame every 10 ms: one resize, at the size it settled on.
  vi.useFakeTimers();
  await vi.advanceTimersByTimeAsync(RESIZE_QUIET_MS);
  transport.send.mockClear();
  for (let step = 1; step <= 20; step++) {
    resizeAgentTerminal("typed", 80 + step, 24);
    await vi.advanceTimersByTimeAsync(10);
  }
  await vi.advanceTimersByTimeAsync(RESIZE_QUIET_MS);
  const resizes = transport.send.mock.calls.filter(([m]) => m.type === "terminal.resize");
  expect(resizes).toEqual([[{ type: "terminal.resize", terminalId: "typed", cols: 100, rows: 24, generation: 4 }]]);
  binding.release();
});

it("a phone takes the size of the tab it shows, once, and gives it back when it leaves it or goes to the background", async () => {
  let hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  const size = { cols: 40, rows: 20 };
  const binding = openAgentTerminal("session", "claude", 40, 20, () => {}, () => {}, () => {}, () => size, true);
  const sent = (type: string) => transport.send.mock.calls.map(([m]) => m).filter((m) => m.type === type && m.channel === "resize");
  const answer = (message: { requestId: string }, lease?: AgentControlLease) => handleAgentTerminalMessage({ type: "agent.control", requestId: message.requestId, sessionId: "session", agentId: "claude", channel: "resize", ...(lease ? { lease } : {}) });
  const leave = binding.showOnPhone();
  handleAgentTerminalMessage(opened(0, "phone-tab"));
  await binding.ready;
  // Shown: it takes the size from the desktop that holds it, with no typing and no Take control.
  await vi.waitFor(() => expect(sent("agent.control.acquire")).toHaveLength(1));
  expect(sent("agent.control.acquire")[0].ifUnowned).toBeUndefined();
  const lease: AgentControlLease = { clientId: "phone", deviceId: "local", generation: 5, acquiredAtMs: 0, lastActivityMs: 0 };
  answer(sent("agent.control.acquire")[0], lease);
  // To the background: given back, by its generation.
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(sent("agent.control.release")).toHaveLength(1));
  expect(sent("agent.control.release")[0].generation).toBe(5);
  answer(sent("agent.control.release")[0]);
  // Back to the foreground on this tab: taken again, once.
  hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(sent("agent.control.acquire")).toHaveLength(2));
  answer(sent("agent.control.acquire")[1], { ...lease, generation: 7 });
  // Another tab is shown: this one gives its size back, and is not taken again while hidden.
  await vi.waitFor(() => expect(transport.send.mock.calls.some(([m]) => m.type === "terminal.resize")).toBe(true), { timeout: 200 });
  leave();
  await vi.waitFor(() => expect(sent("agent.control.release")).toHaveLength(2));
  expect(sent("agent.control.release")[1].generation).toBe(7);
  answer(sent("agent.control.release")[1]);
  hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  hidden = false; document.dispatchEvent(new Event("visibilitychange"));
  expect(sent("agent.control.acquire")).toHaveLength(2);
  binding.release();
});

it("a desktop view sizes the PTY again when the core gives it back the size a phone took", async () => {
  const size = { cols: 132, rows: 40 };
  const onStatus = vi.fn();
  const binding = openAgentTerminal("session", "claude", 132, 40, () => {}, () => {}, onStatus, () => size, true);
  handleAgentTerminalMessage(opened(0, "laptop-tab"));
  await binding.ready;
  const taking = binding.takeResize();
  const acquire = transport.send.mock.calls.at(-1)![0];
  const mine: AgentControlLease = { clientId: "laptop", deviceId: "local", generation: 4, acquiredAtMs: 0, lastActivityMs: 0 };
  handleAgentTerminalMessage({ type: "agent.control", requestId: acquire.requestId, sessionId: "session", agentId: "claude", channel: "resize", lease: mine });
  await taking;
  // The phone shows this tab: the size is its.
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: { ...snapshot("claude", 2), resizeOwner: { ...mine, clientId: "phone", generation: 5 } } });
  expect(onStatus).toHaveBeenLastCalledWith(expect.anything(), false, false);
  // The phone left it: the core hands this connection a new lease, which it uses at once.
  handleAgentTerminalMessage({ type: "agent.lifecycle.changed", hostId: "local", status: { ...snapshot("claude", 3), resizeOwner: { ...mine, generation: 6 } } });
  expect(onStatus).toHaveBeenLastCalledWith(expect.anything(), false, true);
  vi.useFakeTimers();
  transport.send.mockClear();
  resizeAgentTerminal("laptop-tab", 120, 40);
  await vi.advanceTimersByTimeAsync(RESIZE_QUIET_MS);
  expect(transport.send).toHaveBeenCalledExactlyOnceWith({ type: "terminal.resize", terminalId: "laptop-tab", cols: 120, rows: 40, generation: 6 });
  binding.release();
});
