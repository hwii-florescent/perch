// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TerminalOpenedMessage } from "@perch/shared";

const transport = vi.hoisted(() => ({ send: vi.fn(), connection: (_: boolean) => {} }));
vi.mock("./ws", () => ({ socket: { send: transport.send, onConnectionChange: (handler: (connected: boolean) => void) => { transport.connection = handler; } } }));
import { emitTerminalData, onTerminalData } from "./terminalBus";
import { handleWorkspaceTerminalMessage, openWorkspaceTerminal } from "./workspaceTerminals";

beforeEach(() => { transport.send.mockClear(); });
afterEach(() => { transport.connection(false); vi.useRealTimers(); });

function opened(index: number, id: string): TerminalOpenedMessage {
  const request = transport.send.mock.calls[index][0];
  return { type: "terminal.opened", requestId: request.requestId, replay: "replay", terminal: {
    id, sessionId: request.sessionId, paneId: request.paneId, workspaceId: "workspace", cwd: "/tmp", cols: 80, rows: 24, state: "running", backend: "process",
  } };
}

it("correlates reversed opens and subscribes before live data can overtake the reply", async () => {
  const first = vi.fn(); const second = vi.fn();
  const a = openWorkspaceTerminal("session", "first", 80, 24, (_, replay) => first(replay), first);
  const b = openWorkspaceTerminal("session", "second", 80, 24, (_, replay) => second(replay), second);
  handleWorkspaceTerminalMessage(opened(1, "terminal-b"));
  emitTerminalData("terminal-b", "immediate-b");
  handleWorkspaceTerminalMessage(opened(0, "terminal-a"));
  emitTerminalData("terminal-a", "immediate-a");
  await Promise.all([a.ready, b.ready]);
  expect(first.mock.calls.flat()).toEqual(["replay", "immediate-a"]);
  expect(second.mock.calls.flat()).toEqual(["replay", "immediate-b"]);
  a.release(); b.release();
  emitTerminalData("terminal-a", "after-release");
  expect(first).toHaveBeenCalledTimes(2);
  expect(transport.send.mock.calls.slice(2).every(([message]) => message.type === "terminal.release")).toBe(true);
});

it("releases a late open after its view has unmounted without killing the shell", async () => {
  const data = vi.fn(); const ready = vi.fn();
  const binding = openWorkspaceTerminal("session", "pane", 80, 24, ready, data);
  binding.release();
  handleWorkspaceTerminalMessage(opened(0, "terminal"));
  await binding.ready;
  expect(ready).not.toHaveBeenCalled(); expect(data).not.toHaveBeenCalled();
  expect(transport.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: "terminal.release", terminalId: "terminal" }));
});

it("retires timed out requests and releases their eventual subscriptions", async () => {
  vi.useFakeTimers();
  const binding = openWorkspaceTerminal("session", "pane", 80, 24, () => {}, () => {});
  const failure = expect(binding.ready).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(15_000);
  await failure;
  expect(handleWorkspaceTerminalMessage(opened(0, "terminal"))).toBe(true);
  expect(transport.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: "terminal.release", terminalId: "terminal" }));
});

it("repeated cleanup of an old listener cannot remove a newly attached view", () => {
  const old = onTerminalData("reattached", () => {});
  old();
  const received = vi.fn();
  const current = onTerminalData("reattached", received);
  old();
  emitTerminalData("reattached", "new-view-output");
  expect(received).toHaveBeenCalledWith("new-view-output");
  current();
});
