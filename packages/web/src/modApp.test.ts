// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { SLOTS } from "./slots";

const store = vi.hoisted(() => ({
  state: { sessions: [{ id: "a" }], sessionId: "a", activeProjectId: "p", activeWorkspaceId: "w", workspaceProjects: [{ id: "p" }], workspaces: [{ id: "w" }], toasts: [] as unknown[] },
  listeners: new Set<() => void>(),
}));
vi.mock("./store", () => ({
  usePerchStore: {
    getState: () => store.state,
    setState: (patch: unknown) => Object.assign(store.state, typeof patch === "function" ? (patch as (s: unknown) => object)(store.state) : patch),
    subscribe: (fn: () => void) => (store.listeners.add(fn), () => store.listeners.delete(fn)),
  },
}));
vi.mock("./ws", () => ({ socket: {} }));
import { createSwapper, modApi, setCommandBridge, type ModApi, type ModMount } from "./modApp";

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
    expect(register).toHaveBeenCalledWith("mod.board.go", "Go", "cmd+shift+y", expect.any(Function));
    expect(() => api.command({ name: "bad name!", description: "", run })).toThrow();
    api.bind("tabs.new", "cmd+shift+y");
    expect(bind).toHaveBeenCalledWith("tabs.new", "cmd+shift+y");
    swapper.stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("gives mods Perch's data, shared state, richer toasts and the floating surfaces, all undone with the mod", async () => {
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    let api!: ModApi;
    await swapper.load("x", "m");

    expect(api.sessions()).toEqual([{ id: "a" }]);
    expect(api.focused()).toEqual({ sessionId: "a", projectId: "p", workspaceId: "w" });
    const changed = vi.fn();
    api.subscribe(changed);
    store.listeners.forEach((fn) => fn());
    expect(changed).toHaveBeenCalledTimes(1);

    const heard = vi.fn();
    api.onShared(heard);
    api.setShared("theme", { dark: true });
    expect(api.shared("theme")).toEqual({ dark: true });
    expect(heard).toHaveBeenCalledWith("theme", { dark: true });

    api.notify({ title: "Build", level: "error", action: { command: "session.open", args: { id: "a" } } });
    expect(store.state.toasts).toEqual([expect.objectContaining({ title: "Build", level: "error", action: { command: "session.open", args: { id: "a" } } })]);

    const anchor = document.createElement("button");
    document.body.append(anchor);
    api.popup(anchor, (box) => { box.textContent = "menu"; });
    expect(document.body.textContent).toContain("menu");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.body.textContent).not.toContain("menu"); // a click elsewhere closes it

    api.window({ key: "w", title: "T" }, (box) => { box.textContent = "first"; });
    api.window({ key: "w", title: "T" }, (box) => { box.textContent = "second"; }); // same key replaces
    expect(document.body.textContent).toContain("second");
    expect(document.body.textContent).not.toContain("first");

    // frame "none": no title bar or chrome, the mod's element is the window and a press it leaves alone drags it.
    api.window({ key: "bare", title: "NOT SHOWN", at: { x: 10, y: 20 }, frame: "none" }, (box) => { box.innerHTML = "<b>mine</b>"; });
    const bare = [...document.querySelectorAll<HTMLElement>("[data-testid^='mod-api-window']")].find((w) => w.textContent === "mine")!;
    expect(bare.textContent).not.toContain("NOT SHOWN");
    expect(bare.style.boxShadow).toBe("");

    swapper.stop();
    expect(document.body.textContent).not.toContain("second");
    api.setShared("theme", 1);
    expect(heard).toHaveBeenCalledTimes(1); // its listener went with it
    anchor.remove();
  });

  it("themes() lists every theme with its colors and appearance, and setAgentOrder() reorders agents for agent.next", async () => {
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    let api!: ModApi;
    await swapper.load("x", "m");
    const themes = api.themes();
    expect(themes.length).toBeGreaterThan(3);
    expect(new Set(themes.map((t) => t.name)).size).toBe(themes.length);
    for (const theme of themes) {
      expect(theme.colors.text, theme.name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.colors).not.toHaveProperty("colorScheme");
      expect(typeof theme.light).toBe("boolean");
    }
    expect(themes.some((t) => t.light) && themes.some((t) => !t.light)).toBe(true);

    const { inAgentOrder } = await import("./modApp");
    const agents = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(inAgentOrder(agents)).toBe(agents); // no order: the app's own
    api.setAgentOrder(["c", "zzz", "a"]);
    expect(inAgentOrder(agents).map((agent) => agent.id)).toEqual(["c", "a", "b"]);
    expect(() => api.setAgentOrder("a" as never)).toThrow(/list of session ids/);
    api.setAgentOrder([]);
    expect(inAgentOrder(agents)).toBe(agents);
  });

  it("runs programs and uses files through the core's person-only routes", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      calls.push({ url, body });
      return body.cmd === "boom"
        ? new Response(JSON.stringify({ error: "could not start boom" }), { status: 400 })
        : new Response(JSON.stringify({ code: 0, stdout: "hi\n", stderr: "", text: "contents" }), { status: 200 });
    }));
    let api!: ModApi;
    await createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; }).load("x", "m");
    expect((await api.exec("echo", ["hi"], { cwd: "~/" })).stdout).toBe("hi\n");
    expect(await api.readTextFile("~/a.txt")).toBe("contents");
    await api.writeTextFile("/tmp/x", "t");
    expect(calls.map((c) => [new URL(c.url).pathname.split("/").pop(), c.body.cmd ?? c.body.op])).toEqual([["exec", "echo"], ["fs", "read"], ["fs", "write"]]);
    await expect(api.exec("boom")).rejects.toThrow("could not start boom");
    // A host id rides along so the core runs it over ssh there.
    calls.length = 0;
    await api.exec("uname", [], { host: "vps" });
    await api.readTextFile("~/b", { host: "vps" });
    await api.listDir("/etc");
    expect(calls.map((c) => c.body.host)).toEqual(["vps", "vps", undefined]);
    // `expected` guards the write: a file that is not what the mod read is left alone.
    calls.length = 0;
    await expect(api.writeTextFile("/tmp/x", "t", { expected: "old" })).rejects.toThrow("changed since it was read");
    expect(calls.some((c) => c.body.op === "write")).toBe(false);
    await api.writeTextFile("/tmp/x", "t", { expected: null });
    expect(calls.at(-1)?.body.op).toBe("write");
    vi.unstubAllGlobals();
  });

  it("pickFolder walks folders with listDir and resolves with the chosen one; watchFolder reports a changed entry", async () => {
    let stamp = 1;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const { op, path } = JSON.parse(init.body) as { op: string; path: string };
      const body = op === "list" ? { entries: path === "/w" ? [{ name: "a", isDir: true }, { name: "f.txt", isDir: false }] : [] } : { exists: true, isDir: false, size: 1, modified: stamp };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    let api!: ModApi;
    await createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; }).load("x", "m");
    const picked = api.pickFolder({ start: "/w", prompt: "Pick" });
    await vi.waitFor(() => expect(document.body.textContent).toContain("a/"));
    expect(document.body.textContent).not.toContain("f.txt"); // folders only
    [...document.querySelectorAll("button")].find((b) => b.textContent === "a/")!.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain("Pick: /w/a"));
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Choose this folder")!.click();
    expect(await picked).toBe("/w/a");
    // In the desktop app this computer's picker is the system's.
    const invoke = vi.fn(async () => "/Users/me/proj");
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = { invoke };
    expect(await api.pickFolder({ prompt: "Pick", start: "/w" })).toBe("/Users/me/proj");
    expect(invoke).toHaveBeenCalledWith("plugin:dialog|open", { options: { directory: true, title: "Pick", defaultPath: "/w" } });
    invoke.mockResolvedValueOnce(null as never);
    expect(await api.pickFolder()).toBeNull();
    // And the window picture is the OS's own capture there, falling back to the page's drawing if that fails.
    invoke.mockResolvedValueOnce("data:image/png;base64,AAAA" as never);
    expect(await api.screenshot()).toBe("data:image/png;base64,AAAA");
    expect(invoke).toHaveBeenLastCalledWith("capture_window");
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.useFakeTimers();
    const changed = api.watchFolder("/w");
    await vi.advanceTimersByTimeAsync(10); // first scan is the baseline
    stamp = 2;
    await vi.advanceTimersByTimeAsync(2100);
    expect(await changed).toEqual(["/w/a", "/w/f.txt"]);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a command without run is delivered to nextCommand, queued if nobody waits", async () => {
    let api!: ModApi;
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    await swapper.load("x", "m");
    const registered: Record<string, (args?: unknown) => void> = {};
    setCommandBridge({ list: () => [], run: () => false, register: (id, _d, _k, run) => { registered[id] = run; return () => {}; }, bind: () => {} });
    api.command({ name: "go", description: "go" });
    registered["mod.m.go"]!({ n: 1 }); // nobody waiting yet: queued
    expect(await api.nextCommand()).toEqual({ name: "go", args: { n: 1 } });
    const waiting = api.nextCommand();
    registered["mod.m.go"]!();
    expect(await waiting).toEqual({ name: "go", args: undefined });
    const pending = api.nextCommand();
    swapper.stop();
    await expect(pending).rejects.toThrow("replaced");
  });

  it("loop calls a frame function at most fps times a second, with elapsed time, until the mod goes", async () => {
    let queued: ((now: number) => void) | undefined;
    vi.stubGlobal("requestAnimationFrame", (fn: (now: number) => void) => { queued = fn; return 1; });
    vi.stubGlobal("cancelAnimationFrame", () => { queued = undefined; });
    let api!: ModApi;
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    await swapper.load("x", "m");
    const frames: number[] = [];
    api.loop((ms) => frames.push(Math.round(ms)), { fps: 10 });
    const tick = (now: number) => queued?.(now);
    tick(1000); tick(1030); tick(1098); tick(1100); tick(1250);
    expect(frames).toEqual([0, 100, 250]); // the 30 ms and 98 ms ticks were too soon for 10 fps
    swapper.stop();
    expect(queued).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("gives a mod its props, theme, settings, keys and layout, and a notification its icon and time", async () => {
    document.documentElement.style.setProperty("--accent", "#ff8800");
    document.documentElement.style.setProperty("--text", "#eeeeee");
    let api!: ModApi;
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    await swapper.load("x", "m", undefined, { file: "a.md" });
    expect(api.props()).toEqual({ file: "a.md" });
    api.props().file = "changed"; // a copy: a mod cannot rewrite what the layout said
    expect(api.props()).toEqual({ file: "a.md" });
    expect(api.theme()).toMatchObject({ accent: "#ff8800", foreground: "#eeeeee", dark: expect.any(Boolean) });
    expect(api.settings()).toMatchObject({ zoom: 1, dark: expect.any(Boolean) });
    expect(Array.isArray(api.keys())).toBe(true);
    expect(api.layout()).toBeNull();
    expect(api.layouts()).toEqual([]);
    api.notify({ title: "hi", icon: "✓", timeout: 100 });
    api.notify({ title: "slow", timeout: 999_999 });
    const toasts = store.state.toasts as { icon?: string; timeout?: number }[];
    expect(toasts.slice(-2).map((t) => [t.icon, t.timeout])).toEqual([["✓", 1000], [undefined, 60000]]); // kept within 1 to 60 s
    swapper.stop();
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--text");
  });

  it("frames steps through a list on a schedule, calling show only when the item changes", async () => {
    let queued: ((now: number) => void) | undefined;
    vi.stubGlobal("requestAnimationFrame", (fn: (now: number) => void) => { queued = fn; return 1; });
    vi.stubGlobal("cancelAnimationFrame", () => { queued = undefined; });
    let api!: ModApi;
    const swapper = createSwapper(document.createElement("div"), vi.fn(), async () => (_el, a) => { api = a; });
    await swapper.load("x", "m");
    const shown: string[] = [];
    api.frames(["a", "b", "c"], 100, (item) => shown.push(item));
    for (const now of [0, 20, 110, 130, 215, 310, 420]) queued?.(now);
    expect(shown).toEqual(["a", "b", "c", "b"]); // the 310 ms tick came too soon after 215 for 10 fps
    swapper.stop();
    vi.unstubAllGlobals();
  });

  it("documents every member of the api in the types file `perch mod api` prints, and nothing else", () => {
    const types = readFileSync("../../crates/perch-core/src/mod_examples/perch-mod.d.ts", "utf8");
    const declared = [...types.matchAll(/^  (\w+)[(:?<]/gm)].map((m) => m[1]).sort();
    const { dispose: _dispose, ...api } = modApi("x");
    expect(declared).toEqual(Object.keys(api).sort());
    for (const name of Object.keys(SLOTS)) expect(types, name).toMatch(new RegExp(`^   \\*  ${name}\\s`, "m"));
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

  it("finds a persistent terminal by its session id as well as its terminal id", () => {
    const sendTerminalInput = vi.fn();
    const before = store.state.sessions;
    Object.assign(store.state, { sessions: [{ id: "sess" }, { id: "opening" }], cliTerminalIds: {}, terminals: {}, hostStates: {}, connected: true, sendTerminalInput });
    const host = document.createElement("div");
    host.innerHTML = '<div data-session-id="sess" data-terminal-id="term"></div><div data-session-id="opening"></div>';
    document.body.append(host);
    try {
      const api = modApi("m");
      api.sendText("sess", "ls\r");
      api.sendText("term", "pwd\r");
      expect(sendTerminalInput.mock.calls).toEqual([["term", "ls\r"], ["term", "pwd\r"]]);
      expect(() => api.sendText("opening", "x")).toThrow("Terminal opening is not open on this page.");
      expect(() => api.sendText("nowhere", "x")).toThrow("No terminal nowhere.");
    } finally {
      host.remove();
      store.state.sessions = before;
    }
  });
});

describe("queries over Perch's state, without a terminal on screen", () => {
  const sessions = [
    { id: "lead", title: "Lead", cwd: "/p", cliProviderId: "claude", workspaceId: "w" },
    { id: "child", title: "Sub", cwd: "/p", cliProviderId: "codex", parentSessionId: "lead", workspaceId: "w" },
    { id: "shell", title: "zsh", cwd: "/p", cliProviderId: "terminal" },
    { id: "same", title: "Here", cwd: "/a", cliProviderId: "terminal" },
    { id: "same", title: "There", cwd: "/b", cliProviderId: "terminal", hostId: "box" },
    { id: "far", title: "Far", cwd: "/c", cliProviderId: "claude", hostId: "box" },
  ];
  const setup = () => {
    const sendTerminalInput = vi.fn();
    const before = { ...store.state };
    Object.assign(store.state, {
      sessions, sessionId: "lead", activeHostId: "local", activeWorkspaceId: "w", connected: true,
      cliTerminalIds: { lead: "t-lead", child: "t-child" }, terminals: { "t-child": { exitCode: 0 } },
      hostStates: { box: { state: "disconnected" } }, sendTerminalInput,
    });
    return { sendTerminalInput, restore: () => { for (const key of Object.keys(store.state)) delete (store.state as Record<string, unknown>)[key]; Object.assign(store.state, before); } };
  };

  it("lists every session's terminal, hidden agents and sub-sessions included, and says what is unknown", () => {
    const { restore } = setup();
    try {
      const records = modApi("m").terminalRecords();
      expect(records.map((r) => r.target)).toEqual(["local/lead", "local/child", "local/shell", "local/same", "box/same", "box/far"]);
      expect(records[0]).toMatchObject({ kind: "agent", provider: "claude", terminalId: "t-lead", shown: false, focused: true, state: "running" });
      expect(records[1]).toMatchObject({ parentSessionId: "lead", terminalId: "t-child", state: "exited" });
      // Nothing on this page has opened the shell: no evidence is not "exited".
      expect(records[2]).toMatchObject({ kind: "terminal", terminalId: null, open: false, state: "unknown" });
      expect(records[5]).toMatchObject({ hostId: "box", state: "host-unavailable" });
      // The old projections are unchanged.
      expect(modApi("m").terminals().map((t) => t.id)).toEqual(["shell", "same", "same"]);
    } finally { restore(); }
  });

  it("sends to a hidden terminal by its host-qualified target, and refuses an id two computers share", () => {
    const { sendTerminalInput, restore } = setup();
    try {
      const api = modApi("m");
      api.sendText("local/lead", "hi\r");
      api.sendText("lead", "again\r");
      expect(sendTerminalInput.mock.calls).toEqual([["t-lead", "hi\r"], ["t-lead", "again\r"]]);
      expect(() => api.sendText("same", "x")).toThrow("Session same is on more than one computer: name it as <host>/same.");
      // The remote session with the colliding id is never reached through the local one's target, or vice versa.
      expect(() => api.sendText("box/lead", "x")).toThrow("No terminal lead on box.");
      expect(() => api.sendText("local/same", "x")).toThrow("Terminal local/same is not open on this page.");
      expect(() => api.sendText("local/child", "x")).toThrow("Terminal local/child has exited.");
      expect(() => api.readTerminal("local/shell")).toThrow(/is not open on this page/);
      expect(sendTerminalInput).toHaveBeenCalledTimes(2);
    } finally { restore(); }
  });

  it("fetches a terminal this page never opened from the core, by its host-qualified target, and never for another computer", async () => {
    const { restore } = setup();
    const fetch = vi.fn(async (_url: string, init: RequestInit) => new Response(JSON.stringify({ text: `screen of ${JSON.parse(String(init.body)).target}` })));
    vi.stubGlobal("fetch", fetch);
    try {
      const api = modApi("m");
      expect(await api.fetchTerminal("local/shell", 5)).toBe("screen of local/shell");
      expect(fetch.mock.calls[0]![0]).toMatch(/\/terminal\/read$/);
      expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toEqual({ target: "local/shell", lines: 5 });
      // A bare id two computers share is refused before anything is asked; a remote one goes as its own target.
      await expect(api.fetchTerminal("same")).rejects.toThrow(/more than one computer/);
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "that terminal runs on box; read it on that computer" }), { status: 501 }));
      await expect(api.fetchTerminal("box/far")).rejects.toThrow("that terminal runs on box; read it on that computer");
      expect(JSON.parse(String(fetch.mock.calls.at(-1)![1].body))).toEqual({ target: "box/far" });
    } finally { vi.unstubAllGlobals(); restore(); }
  });

  it("reports focus host-qualified and the shown layout as a tree with the person's choices", async () => {
    const { restore } = setup();
    const { setShownLayout, setHidden, setActive } = await import("./layoutState");
    try {
      expect(modApi("m").focus()).toMatchObject({ hostId: "local", workspaceId: "w", sessionId: "lead", terminalId: "t-lead" });
      setShownLayout({ type: "row", children: [
        { type: "block", id: "side", content: "sidebar" },
        { type: "stack", id: "main", children: [{ type: "block", id: "a", content: "canvas" }, { type: "block", id: "b", content: "mod:x", title: "X" }] },
      ] });
      setHidden("side", true);
      setActive("main", "b");
      expect(modApi("m").layoutTree().root).toEqual({ path: "", type: "row", hidden: false, children: [
        { path: "0", id: "side", type: "block", content: "sidebar", hidden: true },
        { path: "1", id: "main", type: "stack", hidden: false, active: "b", children: [
          { path: "1.0", id: "a", type: "block", content: "canvas", hidden: false },
          { path: "1.1", id: "b", type: "block", content: "mod:x", title: "X", hidden: false },
        ] },
      ] });
    } finally {
      setShownLayout(null);
      restore();
    }
  });
});

describe("one copy's API lifetime", () => {
  it("disposes once, runs every cleanup when one throws, and returns what they threw", () => {
    const api = modApi("m");
    const after = vi.fn();
    api.subscribe(() => {});
    api.watch("/tmp/x", () => {});
    const broken = new Error("cleanup broke");
    api.overlay(() => () => { throw broken; });
    api.overlay(() => after);
    expect(api.dispose()).toEqual([broken]);
    expect(after).toHaveBeenCalledTimes(1);
    expect(store.listeners.size).toBe(0);
    expect(api.dispose()).toEqual([]);
  });

  it("starts nothing after it is disposed: a late subscription stops at once and surfaces do not open", () => {
    const api = modApi("m");
    api.dispose();
    const changed = vi.fn();
    api.subscribe(changed);
    store.listeners.forEach((fn) => fn());
    expect(changed).not.toHaveBeenCalled();
    const draw = vi.fn();
    api.overlay(draw);
    expect(draw).not.toHaveBeenCalled();
    return expect(api.nextCommand()).rejects.toThrow("replaced");
  });

  it("drops a result that arrives after the copy was replaced", async () => {
    const fetch = vi.fn(() => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(JSON.stringify({ code: 0, stdout: "late", stderr: "" }))), 10)));
    vi.stubGlobal("fetch", fetch);
    try {
      const api = modApi("m");
      const seen = vi.fn();
      api.exec("ls").then(seen, seen);
      api.dispose(); // replaced while the program runs
      const live = modApi("n");
      expect((await live.exec("ls")).stdout).toBe("late");
      await new Promise((done) => setTimeout(done, 30));
      expect(seen).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2); // the program still ran: only the stale result is dropped
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sends a command's key to the newest copy on screen, never to a hidden one, and reports what it throws", () => {
    const registered: ((args?: unknown) => void)[] = [];
    const remove = vi.fn();
    setCommandBridge({ list: () => [], run: () => false, register: (_id, _d, _k, run) => (registered.push(run), remove), bind: () => {} });
    let shownA = true, shownB = false;
    const errors: unknown[] = [];
    const a = modApi("board", {}, { shown: () => shownA });
    const b = modApi("board", {}, { shown: () => shownB, onError: (_phase, error) => errors.push(error) });
    const ranA = vi.fn(), ranB = vi.fn(() => { throw new Error("b broke"); });
    a.command({ name: "go", description: "Go", run: ranA });
    b.command({ name: "go", description: "Go", run: ranB });
    const key = () => registered[registered.length - 1]!({ n: 1 });
    key();
    expect(ranA).toHaveBeenCalledWith({ n: 1 });
    expect(ranB).not.toHaveBeenCalled();
    shownB = true;
    key();
    expect(ranB).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([new Error("b broke")]);
    shownA = shownB = false;
    key();
    expect(ranA).toHaveBeenCalledTimes(1);
    a.dispose();
    expect(remove).toHaveBeenCalled();
    shownB = true;
    const removals = remove.mock.calls.length;
    key();
    expect(ranB).toHaveBeenCalledTimes(2);
    b.dispose();
    expect(remove.mock.calls.length).toBe(removals + 1);
  });
});
