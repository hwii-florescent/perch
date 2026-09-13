// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { NativeUiSnapshot } from "@perch/shared";
const transport = vi.hoisted(() => ({ send: vi.fn(), connection: (_: boolean) => {} }));
vi.mock("./ws", () => ({ socket: { send: transport.send, onConnectionChange: (handler: (connected: boolean) => void) => { transport.connection = handler; } } }));
import { handleNativeUiMessage, requestNativeUi, subscribeNativeUi } from "./nativeUi";
afterEach(() => { transport.connection(false); transport.send.mockClear(); vi.useRealTimers(); });
const snapshot: NativeUiSnapshot = { version: 1, revision: 1, pid: 2, providerSessionId: "/native.jsonl", cwd: "/workspace", model: null, running: false, messages: [], truncated: false };
it("scopes transcript events to the owning session and provider", () => {
  const a = vi.fn(), b = vi.fn(), c = vi.fn();
  const release = [subscribeNativeUi("a", "pi", a), subscribeNativeUi("a", "omp", b), subscribeNativeUi("b", "pi", c)];
  handleNativeUiMessage({ type: "agent.ui.snapshot", sessionId: "a", providerId: "pi", snapshot });
  expect(a).toHaveBeenCalledWith(snapshot); expect(b).not.toHaveBeenCalled(); expect(c).not.toHaveBeenCalled();
  release.forEach((stop) => stop());
  handleNativeUiMessage({ type: "agent.ui.snapshot", sessionId: "a", providerId: "pi", snapshot });
  expect(a).toHaveBeenCalledTimes(1);
});
it("rejects cross-session replies instead of acknowledging the wrong prompt", async () => {
  const result = requestNativeUi({ type: "agent.ui.prompt", requestId: "wrong", sessionId: "a", providerId: "pi", operationId: "operation", text: "hello", generation: 2 });
  handleNativeUiMessage({ type: "agent.ui.result", requestId: "wrong", sessionId: "b", accepted: true });
  await expect(result).rejects.toThrow("Unexpected native CLI response");
});
it("does not resend an uncertain action after disconnect or timeout", async () => {
  vi.useFakeTimers();
  const result = requestNativeUi({ type: "agent.ui.prompt", requestId: "lost", sessionId: "a", providerId: "pi", operationId: "operation", text: "hello", generation: 2 });
  const rejected = expect(result).rejects.toThrow("not confirmed");
  await vi.advanceTimersByTimeAsync(15_001); await rejected;
  transport.connection(false); transport.connection(true);
  expect(transport.send).toHaveBeenCalledTimes(1);
  expect(handleNativeUiMessage({ type: "error", requestId: "lost", message: "late error" })).toBe(true);
});
