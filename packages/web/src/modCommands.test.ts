// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

it("project.new checks argv before it adds the folder, and runs the program only once the project is added", async () => {
  const started = vi.fn(() => Promise.resolve("run-1"));
  vi.doMock("./runs", () => ({ runInWorkspace: started }));
  vi.resetModules();
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const create = vi.fn(() => "req-1");
  usePerchStore.setState({ createWorkspaceProject: create as never, toasts: [] });
  const run = (args: object) => TYPED_COMMANDS["project.new"]!.run({ folder: "/p", ...args });
  expect(() => run({ argv: [] })).toThrow(/argv is a list of strings/);
  expect(() => run({ argv: ["ok", 3] })).toThrow(/argv is a list of strings/);
  expect(create).not.toHaveBeenCalled();
  const made = (status: "pending" | "success" | "error", extra: object = {}) =>
    usePerchStore.setState({ workspaceProjectCreate: { requestId: "req-1", hostId: "local", path: "/p", status, ...extra }, ...extra });

  run({ argv: ["claude"], task: "hi" });
  expect(create).toHaveBeenCalledWith("/p", undefined);
  made("pending");
  expect(started).not.toHaveBeenCalled();
  // The add does not move focus: the new project is found in the list, then shown.
  usePerchStore.setState({ workspaceProjects: [{ id: "p-new", hostId: "local", path: "/p" }] as never, workspaces: [{ id: "ws-new", projectId: "p-new", state: "active" }] as never, connected: true });
  made("success");
  await vi.waitFor(() => expect(started).toHaveBeenCalledWith("ws-new", "'claude' 'hi'"));

  expect(usePerchStore.getState().activeProjectId).toBe("p-new");

  // Without argv the project is still shown once it is added.
  usePerchStore.setState({ activeProjectId: null, workspaceProjectCreate: null });
  run({});
  made("success");
  await vi.waitFor(() => expect(usePerchStore.getState().activeProjectId).toBe("p-new"));
  expect(started).toHaveBeenCalledTimes(1);

  // A failed add runs nothing and says so.
  run({ argv: ["claude"] });
  made("error", { error: "no such folder" });
  await vi.waitFor(() => expect(usePerchStore.getState().toasts.map((t) => t.title)).toEqual(["no such folder: /p was not started."]));
  expect(started).toHaveBeenCalledTimes(1);

  // A refused add is an error to the caller, not a silent no-op.
  create.mockReturnValueOnce(null as never);
  expect(() => run({})).toThrow(/Cannot add \/p/);
});

it("terminal.show and keep go to the session; peek shows it over the app without going there; park puts the peek away", async () => {
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const open = vi.fn();
  usePerchStore.setState({ switchSession: open as never, sessions: [{ id: "s1" }, { id: "s2" }] as never });
  const peek = () => document.querySelectorAll("[data-testid=mod-api-overlay-terminal-peek]");
  const run = (name: string, args: object) => TYPED_COMMANDS[name]!.run(args);

  run("terminal.show", { id: "s1" });
  expect(open.mock.calls).toEqual([["s1"]]);

  // Peek: an overlay of the session's own view; focus and the shown session do not move.
  run("terminal.peek", { terminal: "s2" });
  expect(peek()).toHaveLength(1);
  expect(open).toHaveBeenCalledTimes(1);
  run("terminal.peek", { terminal: "s2" }); // again: closes it
  expect(peek()).toHaveLength(0);

  // Park puts a peek away and nothing else; with no peek it says so instead of pretending.
  run("terminal.peek", { id: "s2" });
  run("terminal.park", { id: "s2" });
  expect(peek()).toHaveLength(0);
  expect(() => run("terminal.unkeep", { id: "s2" })).toThrow(/no peek to put away/);

  // Keep adopts it: the peek closes and its tab is shown.
  run("terminal.peek", { id: "s2" });
  run("terminal.keep", { id: "s2" });
  expect(peek()).toHaveLength(0);
  expect(open.mock.calls).toEqual([["s1"], ["s2"]]);

  // Only sessions this page knows; nothing is started for another id.
  for (const name of ["terminal.peek", "terminal.keep", "terminal.park"]) expect(() => run(name, { id: "nope" })).toThrow(/no session nope/);
  expect(open).toHaveBeenCalledTimes(2);
});

it("terminal.order keeps an order on this device that agents() and the terminal records report", async () => {
  const kept = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) });
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const { inAgentOrder, terminalRecords } = await import("./modApp");
  usePerchStore.setState({ sessions: [{ id: "a", cliProviderId: "claude" }, { id: "b", cliProviderId: "claude" }, { id: "c", cliProviderId: "terminal" }] as never });
  expect(() => TYPED_COMMANDS["terminal.order"]!.run({ ids: "b" })).toThrow(/list of session ids/);
  expect(() => TYPED_COMMANDS["terminal.order"]!.run({ ids: ["b", 3] })).toThrow(/list of session ids/);
  TYPED_COMMANDS["terminal.order"]!.run({ ids: ["c", "b", "b"] });
  expect(JSON.parse(kept.get("perch.terminalOrder")!)).toEqual(["c", "b"]);
  expect(inAgentOrder([{ id: "a" }, { id: "b" }, { id: "c" }]).map((s) => s.id)).toEqual(["c", "b", "a"]);
  expect(Object.fromEntries(terminalRecords().map((r) => [r.sessionId, r.order]))).toEqual({ a: null, b: 1, c: 0 });
  TYPED_COMMANDS["terminal.order"]!.run({ ids: [] });
  expect(inAgentOrder([{ id: "a" }, { id: "b" }]).map((s) => s.id)).toEqual(["a", "b"]);
  vi.unstubAllGlobals();
});

it("terminal.pin pins a listed session that is not on screen", async () => {
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const { isPinned } = await import("./pinnedTerminals");
  const kept = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) });
  usePerchStore.setState({ sessions: [{ id: "s-off" }] as never });
  // Nothing is on screen, so only the listed id can work.
  expect(() => TYPED_COMMANDS["terminal.pin"]!.run({ terminal: "unknown" })).toThrow(/not on screen/);
  expect(() => TYPED_COMMANDS["terminal.pin"]!.run({ terminal: "s-off", pinned: "yes" })).toThrow(/true or false/);
  expect(isPinned("s-off")).toBe(false);
  TYPED_COMMANDS["terminal.pin"]!.run({ terminal: "s-off" });
  expect(isPinned("s-off")).toBe(true);
  TYPED_COMMANDS["terminal.pin"]!.run({ terminal: "s-off" });
  expect(isPinned("s-off")).toBe(false);
});

it("project.select, next, prev and close follow the sidebar order and ask before ending a project", async () => {
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const focus = vi.fn();
  const remove = vi.fn();
  const mine = (id: string) => ({ id, hostId: "local", path: `/${id}`, name: id });
  usePerchStore.setState({
    activeHostId: "local",
    activeProjectId: "b",
    workspaceProjects: [mine("a"), mine("b"), mine("c"), { ...mine("z"), hostId: "other" }] as never,
    workspaceOrderByHost: { local: { projects: ["c", "a", "b"], sessions: [] } },
    focusWorkspaceProject: focus as never,
    removeWorkspaceProject: remove as never,
  });
  const run = (name: string, args: object = {}) => TYPED_COMMANDS[name]!.run(args);
  // Sidebar order is c, a, b; b is shown, so next wraps to c and prev is a.
  run("project.next");
  run("project.prev");
  run("project.select", { index: 1 });
  run("project.select", { id: "b" });
  expect(focus.mock.calls.map(([id]) => id)).toEqual(["c", "a", "c", "b"]);
  expect(() => run("project.select", { index: 9 })).toThrow(/no project 9/);
  expect(() => run("project.select")).toThrow(/needs/);
  expect(() => run("project.close", { id: "a" })).toThrow(/confirmed: true/);
  expect(() => run("project.close", { id: "nope", confirmed: true })).toThrow(/no project nope/);
  expect(remove).not.toHaveBeenCalled();
  run("project.close", { id: "a", confirmed: true });
  expect(remove).toHaveBeenCalledWith("a");
  expect(() => run("terminal.open", { place: "up" })).toThrow(/"tab", "right" or "down"/);
});

it("navigation commands act on the row they name and refuse a missing or wrong target", async () => {
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const setOrder = vi.fn();
  const upsert = vi.fn();
  const pin = vi.fn();
  const dismiss = vi.fn();
  const worktreeMenu = vi.fn();
  const mine = (id: string) => ({ id, hostId: "local", path: `/${id}`, name: id, favorite: false, updatedAt: 1 });
  usePerchStore.setState({
    activeHostId: "local",
    workspaceProjects: [mine("a"), mine("b"), { ...mine("c"), repoPath: "/c" }] as never,
    workspaceOrderByHost: { local: { projects: ["c", "a", "b"], sessions: [] } },
    workspaces: [{ id: "main", projectId: "c", path: "/c", state: "active" }, { id: "wt", projectId: "c", path: "/c-wt", branch: "feature", parentWorkspaceId: "main", state: "active" }] as never,
    worktreeJobs: [{ jobId: "job-1" }] as never,
    hosts: [{ id: "box", name: "box", enabled: true }] as never,
    sessions: [],
    setWorkspaceOrder: setOrder as never,
    upsertHost: upsert as never,
    pinWorkspace: pin as never,
    dismissWorktreeJob: dismiss as never,
    requestWorktreeMenu: worktreeMenu as never,
  });
  const run = (name: string, args: object = {}) => TYPED_COMMANDS[name]!.run(args);
  // b moves before c in the core's order c, a, b.
  run("project.move", { id: "b", target: "c", after: false });
  expect(setOrder).toHaveBeenCalledWith("local", { projects: ["b", "c", "a"] });
  expect(() => run("project.move", { id: "b", target: "nope" })).toThrow(/no project nope/);
  run("workspace.pin", { id: "wt", pinned: true });
  expect(pin).toHaveBeenCalledWith("wt", true);
  expect(() => run("workspace.pin", { id: "gone", pinned: true })).toThrow(/no workspace gone/);
  // Only a linked worktree of a git project goes through its worktree menu's guarded delete.
  expect(() => run("worktree.remove", { id: "main" })).toThrow(/linked worktree/);
  run("worktree.remove", { id: "wt" });
  expect(worktreeMenu).toHaveBeenCalledWith("local:/c", { path: "/c-wt", branch: "feature" });
  expect(() => run("worktree.dismiss", { id: "job-9" })).toThrow(/no worktree job job-9/);
  run("worktree.dismiss", { id: "job-1" });
  expect(dismiss).toHaveBeenCalledWith("job-1");
  run("host.enable", { id: "box", enabled: false });
  expect(upsert).toHaveBeenCalledWith({ id: "box", name: "box", enabled: false });
  expect(() => run("host.enable", { id: "local", enabled: false })).toThrow(/cannot be turned off/);
  expect(() => run("host.select", { id: "elsewhere" })).toThrow(/no host elsewhere/);
  expect(() => run("session.open", {})).toThrow(/needs/);
  expect(() => run("session.request_close", { id: "ghost" })).toThrow(/no session ghost/);
  expect(() => run("session.move", { id: "ghost", target: "x", siblings: [] })).toThrow(/no session ghost/);
  expect(() => run("folder.select", {})).toThrow(/cwd/);
});

it("tab and pane commands act on the tab they name, shown or not, through the owners' own paths", async () => {
  const closeSession = vi.fn();
  vi.doMock("./closeGuard", () => ({ requestCloseSession: closeSession }));
  const file = { workspaceId: "w", path: "a.ts", preview: true };
  vi.doMock("./workspaceTabs", async (actual) => ({
    ...(await actual<typeof import("./workspaceTabs")>()),
    currentTabs: () => ({ activeId: "shown", tabs: [{ id: "shown", kind: "session", session: { id: "shown" } }, { id: "bg", kind: "session", session: { id: "bg" } }, { id: "w\na.ts", kind: "resource", tab: file }] }),
  }));
  vi.resetModules();
  const { usePerchStore } = await import("./store");
  const { useFileTabs } = await import("./fileTabs");
  const { useSplitSets } = await import("./splitSets");
  const { TYPED_COMMANDS } = await import("./modCommands");
  usePerchStore.setState({ sessions: [{ id: "shown" }, { id: "bg" }] as never });
  useFileTabs.setState({ tabs: [file], active: null });
  const run = (id: string, args: object) => TYPED_COMMANDS[id]!.run(args);

  // A background session closes through the close guard (its owner decides), the shown one is untouched.
  run("tab.close", { id: "bg" });
  expect(closeSession).toHaveBeenCalledWith("bg");
  expect(closeSession).toHaveBeenCalledTimes(1);
  run("pane.close", { id: "bg" });
  expect(closeSession).toHaveBeenCalledTimes(2);
  // A previewed file is kept, then closed by its id.
  run("tab.pin", { id: "w\na.ts" });
  expect(useFileTabs.getState().tabs[0]?.preview).toBeFalsy();
  run("tab.menu", { id: "bg", x: 10, y: 20 });
  expect(useSplitSets.getState().menu).toEqual({ id: "bg", x: 10, y: 20 });
  expect(() => run("tab.menu", { id: "bg" })).toThrow(/needs \{id, x, y\}/);
  run("tab.close", { id: "w\na.ts" });
  expect(useFileTabs.getState().tabs).toEqual([]);
  // A tab that is not in the strip is an error, never another tab.
  expect(() => run("tab.close", { id: "gone" })).toThrow(/No tab gone/);
  expect(() => run("pane.unsplit", { id: "gone" })).toThrow(/No tab gone/);
  expect(closeSession).toHaveBeenCalledTimes(2);
  vi.doUnmock("./closeGuard");
  vi.doUnmock("./workspaceTabs");
});
