// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

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

  it("runs the example mods Perch ships against the api they are written for", () => {
    const load = (name: string): ModMount =>
      new Function(readFileSync(`../../crates/perch-core/src/mod_examples/${name}/main.js`, "utf8").replace("export default", "return"))();
    const sessions = [{ id: "a", blocked: false }];
    const listeners: (() => void)[] = [];
    const run = vi.fn();
    const notify = vi.fn();
    const remove = vi.fn();
    const command = vi.fn(() => remove);
    const api = {
      store: { getState: () => ({ sessions }), subscribe: (fn: () => void) => (listeners.push(fn), () => {}) },
      commands: () => [{ id: "tabs.new", description: "New tab" }, { id: "x.y", description: "Other" }],
      run, notify, command, overlay: vi.fn(),
    } as unknown as ModApi;

    const count = document.createElement("div");
    load("session-count")(count, api);
    expect(count.textContent).toBe("1 sessions");
    sessions.push({ id: "b", blocked: true });
    listeners.forEach((fn) => fn());
    expect(count.textContent).toBe("2 sessions");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "A session needs you" }));

    const list = document.createElement("div");
    expect(load("command-list")(list, api)).toBe(remove);
    expect(list.querySelectorAll("button")).toHaveLength(2);
    (list.querySelector("button") as HTMLButtonElement).click();
    expect(run).toHaveBeenCalledWith("tabs.new");
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ name: "list", keys: "mod+shift+y" }));

    const draws: Record<string, (box: HTMLElement, props: unknown) => void> = {};
    const releaseSlot = vi.fn();
    const slotApi = { slot: (name: string, draw: (box: HTMLElement, props: unknown) => void) => ((draws[name] = draw), releaseSlot) } as unknown as ModApi;
    const undo = load("compact-rows")(document.createElement("div"), slotApi) as () => void;
    expect(Object.keys(draws).sort()).toEqual(["session-row", "toast"]);
    const open = vi.fn();
    const rowBox = document.createElement("div");
    draws["session-row"]!(rowBox, { data: { title: "fix bug", branch: "main", status: "idle", active: true }, actions: { open, remove: vi.fn() } });
    expect(rowBox.textContent).toContain("fix bug");
    (rowBox.firstElementChild as HTMLElement).click();
    expect(open).toHaveBeenCalledTimes(1);
    undo();
    expect(releaseSlot).toHaveBeenCalledTimes(2);
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
