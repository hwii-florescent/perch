// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";
const transport = vi.hoisted(() => ({ send: vi.fn(), connected: true, connection: (_: boolean) => {} }));
const state = vi.hoisted(() => ({ serverInfo: { capabilities: ["context.bridge.v1"] }, workspaces: [{ id: "w", hostId: "local" }, { id: "r", hostId: "remote" }], sessions: [{ id: "s", workspaceId: "w" }], documents: {} as Record<string, Record<string, { content: string; savedContent: string }>> }));
vi.mock("./ws", () => ({ socket: { send: transport.send, get connected() { return transport.connected; }, onConnectionChange: (handler: (connected: boolean) => void) => { transport.connection = handler; } } }));
vi.mock("./store", () => ({ usePerchStore: { getState: () => state } }));
vi.mock("./filesystemStore", () => ({ useWorkspaceFilesStore: { getState: () => state } }));
import { askAgent, askAgentAboutFile, attachTerminalContext, contextBridgeAvailable, handleContextBridgeMessage, requestContext, useContextBridge } from "./contextBridge";

beforeEach(() => { transport.send.mockClear(); transport.connected = true; state.documents = {}; useContextBridge.setState({ capture: null, menu: null }); });
afterEach(() => { transport.connection(false); vi.useRealTimers(); });

it("uses the latest unsaved view draft and requires an exact local workspace", () => {
  state.documents = { w: { "a.ts": { content: "unsaved\nline", savedContent: "disk" } } };
  askAgentAboutFile("w", "a.ts");
  expect(useContextBridge.getState().capture?.source).toEqual({ kind: "editor", path: "a.ts", text: "unsaved\nline", startLine: 1, endLine: 2, dirty: true });
  askAgent("r", { kind: "file", path: "a.ts" });
  expect(useContextBridge.getState().capture?.workspaceId).toBe("w");
  expect(contextBridgeAvailable("unknown")).toBe(false);
  expect(contextBridgeAvailable("r")).toBe(false);
  state.documents = {};
  askAgentAboutFile("w", "a.ts");
  expect(useContextBridge.getState().capture?.source).toEqual({ kind: "file", path: "a.ts" });
  expect(transport.send).not.toHaveBeenCalled();
});

it("captures rendered terminal selection from its owning session, not the active nest", () => {
  const container = document.createElement("div");
  const term = { getSelection: () => "FAILED test_one" } as unknown as Terminal;
  const stop = attachTerminalContext(container, term, "s");
  const event = new MouseEvent("contextmenu", { cancelable: true, clientX: 5, clientY: 8 });
  container.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(useContextBridge.getState().menu).toEqual({ x: 5, y: 8, workspaceId: "w", source: { kind: "terminal", sessionId: "s", text: "FAILED test_one" } });
  expect(transport.send).not.toHaveBeenCalled();
  stop();
  expect(useContextBridge.getState().menu).toBeNull();
  container.dispatchEvent(new MouseEvent("contextmenu"));
  expect(useContextBridge.getState().menu).toBeNull();
});

it("correlates context responses and consumes late failures without global errors", async () => {
  const promise = requestContext({ type: "context.preview", requestId: "preview", workspaceId: "w", source: { kind: "file", path: "a" }, instruction: "" });
  expect(handleContextBridgeMessage({ type: "error", requestId: "unrelated", message: "other" })).toBe(false);
  const packet = { workspaceId: "w", markdown: "prepared", digest: "hash" };
  expect(handleContextBridgeMessage({ type: "context.preview.result", requestId: "preview", packet, agents: [] })).toBe(true);
  await expect(promise).resolves.toMatchObject({ packet });
  expect(handleContextBridgeMessage({ type: "error", requestId: "preview", message: "late" })).toBe(true);
});

it("rejects a reply for another workspace or agent instead of accepting the wrong context", async () => {
  const preview = requestContext({ type: "context.preview", requestId: "crossed-preview", workspaceId: "w", source: { kind: "file", path: "a" }, instruction: "" });
  handleContextBridgeMessage({ type: "context.preview.result", requestId: "crossed-preview", packet: { workspaceId: "other", markdown: "other", digest: "hash" }, agents: [] });
  await expect(preview).rejects.toThrow("Unexpected context response");
  const send = requestContext({ type: "context.send", requestId: "crossed-send", workspaceId: "w", source: { kind: "file", path: "a" }, instruction: "", digest: "hash", targetSessionId: "s", operationId: "crossed" });
  handleContextBridgeMessage({ type: "agent.ui.result", requestId: "crossed-send", sessionId: "other", accepted: true });
  await expect(send).rejects.toThrow("Unexpected context response");
  // The request was retired, so a late valid reply cannot resurrect it.
  expect(handleContextBridgeMessage({ type: "agent.ui.result", requestId: "crossed-send", sessionId: "s", accepted: true })).toBe(true);
});

it("never replays a send after timeout or disconnect", async () => {
  vi.useFakeTimers();
  const request = { type: "context.send" as const, requestId: "send", workspaceId: "w", source: { kind: "file" as const, path: "a" }, instruction: "", digest: "digest", targetSessionId: "s", operationId: "once" };
  const promise = requestContext(request);
  const rejected = expect(promise).rejects.toThrow("not confirmed");
  await vi.advanceTimersByTimeAsync(15_001); await rejected;
  transport.connection(false); transport.connection(true);
  expect(transport.send).toHaveBeenCalledTimes(1);
  const lost = requestContext({ ...request, requestId: "lost" });
  const disconnected = expect(lost).rejects.toThrow("Nothing will be retried");
  transport.connection(false); await disconnected;
  expect(transport.send).toHaveBeenCalledTimes(2);
  transport.connected = false;
  await expect(requestContext({ ...request, requestId: "offline" })).rejects.toThrow("Reconnect");
  expect(transport.send).toHaveBeenCalledTimes(2);
});
