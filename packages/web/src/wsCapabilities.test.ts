// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static OPEN = 1;
  static sockets: FakeWebSocket[] = [];
  static sent: Record<string, unknown>[] = [];
  readyState = 1;
  listeners: Record<string, ((event: unknown) => void)[]> = {};
  constructor() { FakeWebSocket.sockets.push(this); }
  addEventListener(type: string, fn: (event: unknown) => void) { (this.listeners[type] ??= []).push(fn); }
  send(raw: string) { FakeWebSocket.sent.push(JSON.parse(raw)); }
  close() {}
  emit(type: string, event: unknown = {}) { this.listeners[type]?.forEach((fn) => fn(event)); }
}
(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
vi.mock("./store", () => ({ usePerchStore: { getState: () => ({}), setState: () => {}, subscribe: () => () => {} } }));
vi.mock("./workspaceNav", () => ({}));

describe("capabilities the core announced before a lazy module loaded", () => {
  it("are still known: the socket hands the last server.info to a late subscriber, and mods asks for its list on load", async () => {
    const { socket } = await import("./ws");
    socket.connect();
    const ws = FakeWebSocket.sockets[0]!;
    ws.emit("open");
    ws.emit("message", { data: JSON.stringify({ type: "server.info", capabilities: ["mods.v1"] }) });
    FakeWebSocket.sent = [];

    // The lazy App chunk imports mods.ts only now, long after server.info.
    const { modsAvailable } = await import("./mods");
    await Promise.resolve();
    expect(modsAvailable()).toBe(true);
    expect(FakeWebSocket.sent.map((m) => m.type)).toContain("mods.list");

    // A new connection says it again; one that has dropped says nothing to a later subscriber.
    ws.emit("close");
    const heard: string[] = [];
    socket.onMessage((message) => heard.push(message.type));
    await Promise.resolve();
    expect(heard).toEqual([]);
  });
});
