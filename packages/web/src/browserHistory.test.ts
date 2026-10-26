// @vitest-environment jsdom
import type { ServerMessage } from "@perch/shared";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sent: Record<string, unknown>[] = [];
let handlers: Array<(message: ServerMessage) => void> = [];
let connection: Array<(connected: boolean) => void> = [];
const fake = {
  connected: true,
  connect: () => {},
  send: (message: Record<string, unknown>) => void sent.push(message),
  onMessage: (handler: (message: ServerMessage) => void) => { handlers.push(handler); return () => {}; },
  onConnectionChange: (handler: (connected: boolean) => void) => { connection.push(handler); return () => {}; },
};
vi.mock("./ws", () => ({ socket: fake }));
const { recordPage, searchHistory, removePage, clearHistory } = await import("./browserHistory");

// browserHistory registers last (its imports, the real store included, register first).
const ours = () => handlers.at(-1)!;
const info = (capabilities: string[]) => ours()({ type: "server.info", capabilities } as ServerMessage);

beforeEach(() => { vi.useFakeTimers(); sent.length = 0; fake.connected = true; info(["browser.history.v1"]); });
afterEach(() => vi.useRealTimers());

it("sends nothing and finds nothing without the capability or a connection", async () => {
  info([]);
  recordPage("https://a.test/", "A", true);
  removePage("https://a.test/");
  clearHistory();
  expect(await searchHistory("a")).toEqual([]);
  info(["browser.history.v1"]);
  fake.connected = false;
  expect(await searchHistory("a")).toEqual([]);
  expect(sent).toEqual([]);
});

it("answers a search from the matching result, and ends empty on a drop or a silent core", async () => {
  const found = searchHistory("git");
  const request = sent[0] as { requestId: string; query: string };
  expect(request).toMatchObject({ type: "browser.history.search", query: "git" });
  ours()({ type: "browser.history.result", requestId: "someone-else", entries: [] } as ServerMessage);
  ours()({ type: "browser.history.result", requestId: request.requestId, entries: [{ url: "https://github.com/", title: "GitHub" }] } as ServerMessage);
  expect(await found).toEqual([{ url: "https://github.com/", title: "GitHub" }]);

  const dropped = searchHistory("x");
  connection.at(-1)!(false);
  expect(await dropped).toEqual([]);

  const silent = searchHistory("y");
  await vi.advanceTimersByTimeAsync(3100);
  expect(await silent).toEqual([]);
});

it("never records perch's own address", () => {
  recordPage(window.location.href, "perch", true);
  recordPage("https://a.test/", "A", true);
  expect(sent).toEqual([{ type: "browser.history.record", url: "https://a.test/", title: "A", visit: true }]);
});
