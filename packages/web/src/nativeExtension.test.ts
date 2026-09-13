import { afterEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ connect: undefined as undefined | ((client: any) => void) }));
vi.mock("node:net", () => ({ default: { createServer: (connect: (client: any) => void) => {
  transport.connect = connect;
  return { on: vi.fn(), unref: vi.fn(), listen: (_: string, ready: () => void) => ready(), close: (done: () => void) => done() };
} } }));
vi.mock("node:fs", () => ({ default: { chmodSync: vi.fn() } }));
import extension from "../../../crates/perch-core/src/native_ui/pi-extension";
afterEach(() => vi.useRealTimers());

it("keeps native hidden messages hidden, bounds tool data, and deduplicates prompt delivery", async () => {
  vi.useFakeTimers();
  const handlers = new Map<string, (event: any, context: any) => unknown>();
  const pi = { on: (name: string, fn: (event: any, context: any) => unknown) => handlers.set(name, fn), appendEntry: vi.fn(), sendUserMessage: vi.fn() };
  const ctx = { cwd: "/workspace", model: { id: "native-model" }, isIdle: () => true, hasPendingMessages: () => false, sessionManager: {
    getSessionFile: () => "/native/session.jsonl", getSessionId: () => "native-id", getBranch: () => [
      { id: "hidden", type: "custom_message", customType: "internal", content: "private extension instructions", display: false },
      { id: "visible", type: "custom_message", customType: "notice", content: "Visible native notice", display: true },
      { id: "tools", type: "message", message: { role: "assistant", timestamp: 1, content: Array.from({ length: 32 }, () => ({ type: "toolCall", name: "read", arguments: { value: "x".repeat(30_000) } })) } },
    ],
  } };
  extension(pi);
  await handlers.get("session_start")!({}, ctx);
  const data = new Map<string, (...args: any[]) => void>();
  const frames: any[] = [];
  const client = { writableLength: 0, setEncoding: vi.fn(), on: (name: string, callback: (...args: any[]) => void) => data.set(name, callback), write: (line: string) => frames.push(JSON.parse(line)), destroy: vi.fn() };
  transport.connect!(client);
  expect(JSON.stringify(frames[0])).not.toContain("private extension instructions");
  expect(frames[0].messages.map((message: any) => message.id)).toEqual(["visible", "assistant:1:"]);
  expect(frames[0].messages[0].text).toBe("Visible native notice");
  expect(frames[0].truncated).toBe(false);
  expect(Buffer.byteLength(JSON.stringify(frames[0]))).toBeLessThan(20_000);
  const request = JSON.stringify({ type: "prompt", requestId: "one-operation", text: "native prompt" }) + "\n";
  data.get("data")!(request); data.get("data")!(request);
  expect(pi.sendUserMessage).toHaveBeenCalledTimes(1);
  expect(pi.sendUserMessage).toHaveBeenCalledWith("native prompt", { expandPromptTemplates: true });
  expect(frames.filter((frame) => frame.type === "ack")).toHaveLength(2);
  await handlers.get("message_end")!({ message: { role: "custom", display: false, content: "hidden live message" } }, ctx);
  await vi.advanceTimersByTimeAsync(101);
  expect(JSON.stringify(frames.at(-1))).not.toContain("hidden live message");
  await handlers.get("session_shutdown")!({}, ctx);
});
