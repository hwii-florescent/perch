// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ activate: vi.fn(), focus: vi.fn() }));
vi.mock("./workspaceTabs", () => ({ activateTab: mocks.activate }));
// The store connects a real socket on import; its failure lands mid-test, under load, and resets state.
vi.mock("./ws", () => ({ socket: { connect: () => {}, send: () => {}, onMessage: () => () => {}, onConnectionChange: () => () => {}, isOpen: () => false } }));
const nav = await import("./navHistory");
const { NavHistory, navBack, navForward, resetNavHistory, settleNavHistory } = nav;
const { usePerchStore } = await import("./store");
const { useFileTabs, fileTabKey } = await import("./fileTabs");

const place = (id: string) => ({ id, kind: "session" as const });
const all = () => true;

it("goes back and forward by visit order, and a new visit drops the forward trail", () => {
  const h = new NavHistory();
  for (const id of ["a", "b", "c"]) h.record(place(id));
  h.record(place("c")); // same place again is not a new visit
  expect(h.step(-1, all)?.id).toBe("b");
  expect(h.step(-1, all)?.id).toBe("a");
  expect(h.step(-1, all)).toBeUndefined();
  expect(h.step(1, all)?.id).toBe("b");
  h.record(place("d")); // visiting from the middle forgets c
  expect(h.step(1, all)).toBeUndefined();
  expect(h.step(-1, all)?.id).toBe("b");
});

it("skips places that closed and stays put when nothing is left", () => {
  const h = new NavHistory();
  for (const id of ["a", "gone", "c"]) h.record(place(id));
  expect(h.step(-1, (p) => p.id !== "gone")?.id).toBe("a");
  expect(h.step(1, (p) => p.id !== "gone")?.id).toBe("c");
  expect(h.step(-1, (p) => p.id === "c")).toBeUndefined();
  expect(h.current?.id).toBe("c");
});

it("keeps only the newest 50 places", () => {
  const h = new NavHistory();
  for (let i = 0; i < 60; i++) h.record(place(String(i)));
  let steps = 0;
  while (h.step(-1, all)) steps++;
  expect(steps).toBe(49);
  expect(h.current?.id).toBe("10");
});

const s = (id: string, workspaceId = "w") => ({ id, workspaceId, hostId: "local", status: "idle", createdAt: 1 }) as never;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  usePerchStore.setState({ sessions: [s("one"), s("two")], sessionId: "one", activeWorkspaceId: "w", workspaces: [{ id: "w", hostId: "local", path: "/w" }, { id: "x", hostId: "local", path: "/x" }] as never, focusWorkspace: mocks.focus });
  useFileTabs.setState({ tabs: [], active: null });
  resetNavHistory();
  settleNavHistory();
});
afterEach(() => vi.useRealTimers());

it("records what is on screen once a switch settles and jumps back through the tab activation", async () => {
  usePerchStore.setState({ sessionId: "two" });
  await vi.advanceTimersByTimeAsync(200);
  expect(nav.navHistory.current?.id).toBe("two");
  navBack();
  expect(mocks.activate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: "one", kind: "session" }));
  // The session loads later: landing on the target is not a new visit that would erase Forward.
  usePerchStore.setState({ sessionId: "one" });
  await vi.advanceTimersByTimeAsync(200);
  navForward();
  expect(mocks.activate).toHaveBeenLastCalledWith(expect.objectContaining({ id: "two" }));
});

it("focuses a file's nest first and never opens a file that was closed", async () => {
  const tab = { workspaceId: "x", path: "a.ts" };
  useFileTabs.setState({ tabs: [tab], active: fileTabKey(tab) });
  await vi.advanceTimersByTimeAsync(200);
  usePerchStore.setState({ sessionId: "two" }); useFileTabs.setState({ active: null });
  await vi.advanceTimersByTimeAsync(200);
  navBack();
  expect(mocks.focus).toHaveBeenCalledWith("x");
  expect(mocks.activate).toHaveBeenCalledWith(expect.objectContaining({ id: fileTabKey(tab), kind: "resource" }));
  mocks.activate.mockClear();
  useFileTabs.setState({ tabs: [], active: null });
  usePerchStore.setState({ sessionId: "two" });
  await vi.advanceTimersByTimeAsync(4000);
  navForward();
  navBack(); navBack(); navBack();
  expect(mocks.activate).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "resource" }));
});
