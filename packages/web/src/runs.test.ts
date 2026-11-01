// @vitest-environment jsdom
import type { ServerMessage } from "@perch/shared";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sent: Record<string, unknown>[] = [];
const handlers = new Set<(m: ServerMessage) => void>();
const connections = new Set<(on: boolean) => void>();
const fake = {
  connected: true,
  send: (m: Record<string, unknown>) => sent.push(m),
  onMessage: (fn: (m: ServerMessage) => void) => { handlers.add(fn); return () => handlers.delete(fn); },
  onConnectionChange: (fn: (on: boolean) => void) => { connections.add(fn); return () => connections.delete(fn); },
};
vi.mock("./ws", () => ({ socket: fake }));
vi.mock("./store", () => ({ usePerchStore: { getState: () => ({ workspaces: [{ id: "w", hostId: "local" }, { id: "remote", hostId: "other" }], serverInfo: { capabilities: ["workspace.run.v1"] } }) } }));
const { runInWorkspace } = await import("./runs");
beforeEach(() => { vi.useFakeTimers(); sent.length = 0; handlers.clear(); connections.clear(); fake.connected = true; });
afterEach(() => vi.useRealTimers());
it("correlates its response and removes listeners", async () => {
  const result = runInWorkspace("w", "printf hello");
  expect(sent[0]).toMatchObject({ type: "workspace.run", workspaceId: "w", command: "printf hello" });
  for (const fn of handlers) fn({ type: "workspace.run.started", requestId: sent[0].requestId, sessionId: "s" } as ServerMessage);
  expect(await result).toBe("s"); expect(handlers.size + connections.size).toBe(0);
});
it("never queues or retries on a drop, timeout or unsupported remote", async () => {
  const result = runInWorkspace("w", "echo hello");
  const rejected = expect(result).rejects.toThrow("unknown");
  for (const fn of connections) fn(false);
  await rejected;
  expect(sent).toHaveLength(1);
  const timeout = expect(runInWorkspace("w", "echo again")).rejects.toThrow("unknown");
  await vi.advanceTimersByTimeAsync(20_001); await timeout;
  expect(sent).toHaveLength(2); expect(handlers.size + connections.size).toBe(0);
  await expect(runInWorkspace("remote", "echo nope")).rejects.toThrow("local workspace");
  fake.connected = false;
  await expect(runInWorkspace("w", "echo nope")).rejects.toThrow("connected");
  expect(sent).toHaveLength(2);
});
