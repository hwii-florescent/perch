import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Tunnel } from "./tunnel";
import type { RelayDiagnostics } from "./diagnostics";

const wire = vi.hoisted(() => ({ importKey: vi.fn(), seal: vi.fn(), open: vi.fn() }));
vi.mock("./wire", async (original) => ({ ...await original<typeof import("./wire")>(), ...wire }));

class Socket {
  static instances: Socket[] = [];
  binaryType = "blob";
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.({ code: 1000, reason: "untrusted-close-secret" }));
  constructor() { Socket.instances.push(this); }
}
let tunnel: Tunnel | undefined;
let updates: Partial<RelayDiagnostics>[];
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
async function start() {
  const { Tunnel } = await import("./tunnel");
  tunnel = new Tunnel(key, "wss://relay.example/r/private-room?role=guest", (update) => updates.push(update));
  await Promise.resolve();
  await Promise.resolve();
  return Socket.instances[0]!;
}

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.stubGlobal("WebSocket", Socket);
  Socket.instances = []; updates = [];
  wire.importKey.mockReset().mockResolvedValue({});
  wire.seal.mockReset().mockResolvedValue(new Uint8Array(32));
  wire.open.mockReset();
});
afterEach(() => { tunnel?.fail("test teardown"); tunnel = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

it("reports relay, encrypted hello and tunnel-ready as separate stages", async () => {
  const socket = await start();
  expect(updates.map((update) => update.stage)).toEqual(["preparing-encryption", "connecting-relay"]);
  socket.onopen?.();
  expect(updates.at(-1)?.stage).toBe("waiting-for-computer");
  const { frame, HELLO_HOST } = await import("./wire");
  wire.open.mockResolvedValue(frame(HELLO_HOST, 0, new Uint8Array(16)));
  socket.onmessage?.({ data: new ArrayBuffer(32) });
  await tunnel!.ready;
  expect(updates.at(-1)?.stage).toBe("tunnel-ready");
});

it("retains the hello timeout when closing the failed socket", async () => {
  const socket = await start(); socket.onopen?.();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(tunnel!.closed).toBe(true);
  expect(updates.filter((update) => update.error).at(-1)?.error).toBe("the computer did not answer");
  expect(updates.at(-1)?.closeCode).toBe(1000);
});

it("records the peer's numeric close code but never its supplied reason or URL", async () => {
  const socket = await start();
  socket.onerror?.();
  socket.onclose?.({ code: 4004, reason: `untrusted-close-secret ${key}` });
  expect(updates.at(-1)).toMatchObject({ closeCode: 4004, error: "the computer is not connected to the relay" });
  const report = JSON.stringify(updates);
  for (const secret of [key, "untrusted-close-secret", "private-room", "wss://"]) expect(report).not.toContain(secret);
});

it("turns rejected browser encryption into a safe diagnostic, not an unhandled rejection", async () => {
  wire.importKey.mockRejectedValue(new Error("private-browser-error-secret"));
  await start();
  await expect(tunnel!.ready).rejects.toThrow("the browser could not start the encrypted relay connection");
  expect(JSON.stringify(updates)).not.toContain("private-browser-error-secret");
});
