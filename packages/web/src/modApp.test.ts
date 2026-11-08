// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({ usePerchStore: { getState: () => ({}) } }));
vi.mock("./ws", () => ({ socket: {} }));
import { createSwapper, type ModMount } from "./modApp";

const drawing = (text: string, cleanup = vi.fn()): ModMount => (el) => { el.textContent = text; return cleanup; };

describe("an app module's versions", () => {
  it("replaces the old version only once the new one has mounted, and cleans the old one up", async () => {
    const host = document.createElement("div");
    const undoOne = vi.fn();
    const versions: Record<string, ModMount> = { one: drawing("one", undoOne), two: drawing("two") };
    const report = vi.fn();
    const swapper = createSwapper(host, report, async (src) => versions[src]);
    await swapper.load("one", "m");
    expect(host.textContent).toBe("one");
    await swapper.load("two", "m");
    expect(host.textContent).toBe("two");
    expect(host.children).toHaveLength(1);
    expect(undoOne).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith(null);
  });

  it("keeps the last good version showing when a new one fails to load or throws", async () => {
    const host = document.createElement("div");
    const undoOne = vi.fn();
    const versions: Record<string, () => Promise<ModMount>> = {
      one: async () => drawing("one", undoOne),
      broken: async () => { throw new Error("syntax error"); },
      throws: async () => () => { throw new Error("boom"); },
    };
    const report = vi.fn();
    const swapper = createSwapper(host, report, (src) => versions[src]());
    const done = vi.fn(); // what `perch mod check` is told
    await swapper.load("one", "m", done);
    expect(done).toHaveBeenLastCalledWith(null);
    await swapper.load("broken", "m", done);
    expect(done).toHaveBeenLastCalledWith("syntax error");
    expect(host.textContent).toBe("one");
    expect(report).toHaveBeenLastCalledWith("syntax error");
    await swapper.load("throws", "m");
    expect(host.textContent).toBe("one");
    expect(host.children).toHaveLength(1);
    expect(report).toHaveBeenLastCalledWith("boom");
    expect(undoOne).not.toHaveBeenCalled();
    swapper.stop();
    expect(undoOne).toHaveBeenCalledTimes(1);
  });

  it("undoes a version that finishes loading after the pane was closed", async () => {
    const host = document.createElement("div");
    const undo = vi.fn();
    const swapper = createSwapper(host, vi.fn(), async () => drawing("late", undo));
    const loading = swapper.load("x", "m");
    swapper.stop();
    await loading;
    expect(undo).toHaveBeenCalledTimes(1);
    expect(host.children).toHaveLength(0);
  });
});
