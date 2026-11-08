// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("./store", () => ({ usePerchStore: { getState: () => ({}) } }));
vi.mock("./ws", () => ({ socket: {} }));
import { createSwapper, setCommandBridge, type ModApi, type ModMount } from "./modApp";

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

  it("runs app commands through the bridge and closes a mod's overlays when it is replaced", async () => {
    const run = vi.fn((id: string) => id === "tabs.new");
    setCommandBridge({ list: () => [{ id: "tabs.new", description: "New tab" }], run });
    const host = document.createElement("div");
    let api!: ModApi;
    const cleanup = vi.fn();
    const mod: ModMount = (_el, a) => {
      api = a;
      a.overlay((el) => { el.textContent = "dialog"; return cleanup; });
    };
    const swapper = createSwapper(host, vi.fn(), async () => mod);
    await swapper.load("x", "m");
    expect(api.commands()).toEqual([{ id: "tabs.new", description: "New tab" }]);
    expect(api.run("tabs.new")).toBe(true);
    expect(api.run("nope")).toBe(false);
    expect(document.body.textContent).toContain("dialog");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.textContent).not.toContain("dialog");
    expect(cleanup).toHaveBeenCalledTimes(1);
    api.overlay(() => cleanup);
    swapper.stop(); // the mod going away takes its open overlay with it
    expect(document.body.textContent).not.toContain("dialog");
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("registers a mod's commands under its own name and removes them with the mod", async () => {
    const remove = vi.fn();
    const register = vi.fn(() => remove);
    const bind = vi.fn();
    setCommandBridge({ list: () => [], run: () => false, register, bind });
    let api!: ModApi;
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    await swapper.load("x", "board");
    const run = () => {};
    api.command({ name: "go", description: "Go", keys: "cmd+shift+y", run });
    expect(register).toHaveBeenCalledWith("mod.board.go", "Go", "cmd+shift+y", run);
    expect(() => api.command({ name: "bad name!", description: "", run })).toThrow();
    api.bind("tabs.new", "cmd+shift+y");
    expect(bind).toHaveBeenCalledWith("tabs.new", "cmd+shift+y");
    swapper.stop();
    expect(remove).toHaveBeenCalledTimes(1);
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
