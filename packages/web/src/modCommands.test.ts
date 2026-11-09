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

it("terminal.show, peek and keep open the session they name", async () => {
  const { usePerchStore } = await import("./store");
  const { TYPED_COMMANDS } = await import("./modCommands");
  const open = vi.fn();
  usePerchStore.setState({ switchSession: open as never });
  for (const verb of ["show", "peek", "keep"]) TYPED_COMMANDS[`terminal.${verb}`]!.run({ id: `s-${verb}` });
  expect(open.mock.calls.map(([id]) => id)).toEqual(["s-show", "s-peek", "s-keep"]);
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
