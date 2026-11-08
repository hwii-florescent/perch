// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { useSplitSets } from "./splitSets";
import { registerDockviewController, type DockviewController } from "./dockview/dockviewController";
import { SHORTCUTS } from "./keybinds";
import { getPaneController, exitSplit, openModTab, splitActiveTab } from "./tiledPanes";

const dock = { focusPaneDirection: vi.fn(), toggleMaximizeActive: vi.fn() } as unknown as DockviewController;
const session = (id: string, createdAt: number) => ({ id, title: id, cwd: "/p", createdAt, status: "idle", workspaceId: "w", cliProviderId: "terminal" }) as SessionSummary;
const handlers = { openNavigator() {}, openKeybindHelp() {}, toggleDrawer() {} };
const run = (id: string) => SHORTCUTS.find((shortcut) => shortcut.id === id)!.run(handlers);

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.clearAllMocks();
  useFileTabs.setState({ tabs: [], active: null });
  usePerchStore.setState({
    sessions: [session("a", 1), session("b", 2)], sessionId: "a", activeHostId: "local", activeWorkspaceId: "w", activeProject: null,
    workspaces: [{ id: "w", projectId: "p", hostId: "local", path: "/p", name: "w", dirty: false, state: "active", createdAt: 1, updatedAt: 1 }],
    switchSession: (id) => usePerchStore.setState({ sessionId: id }),
    deleteSession: vi.fn(),
  });
  useSplitSets.setState({ sets: [{ ids: ["a", "b"], sizes: [0.5, 0.5] }], zoomedId: null });
  registerDockviewController(dock);
});
afterEach(() => { registerDockviewController(null); document.body.replaceChildren(); vi.unstubAllGlobals(); });

it("the Settings actions focus and cycle tiled panes, rather than the hidden Dockview", () => {
  run("panes.focus.right");
  expect(usePerchStore.getState().sessionId).toBe("b");
  run("panes.next");
  expect(usePerchStore.getState().sessionId).toBe("a");
  run("panes.prev");
  expect(usePerchStore.getState().sessionId).toBe("b");
  expect(dock.focusPaneDirection).not.toHaveBeenCalled();
});

it("up/down focus uses the stacked axis; a wrong-axis key is a no-op", () => {
  useSplitSets.setState({ sets: [{ ids: ["a", "b"], sizes: [0.5, 0.5], dir: "col" }] });
  run("panes.focus.right");
  expect(usePerchStore.getState().sessionId).toBe("a");
  run("panes.focus.down");
  expect(usePerchStore.getState().sessionId).toBe("b");
});

it("zoom restores the split; exit split makes the tab solo without deleting anything", () => {
  run("panes.zoom");
  expect(useSplitSets.getState().zoomedId).toBe("a");
  run("panes.zoom");
  expect(useSplitSets.getState().zoomedId).toBeNull();
  exitSplit("b");
  expect(useSplitSets.getState().sets).toEqual([]);
  expect(usePerchStore.getState().sessionId).toBe("b");
  expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
});

it("grow/shrink and swap operate on the tiled set", () => {
  const canvas = document.createElement("div");
  canvas.dataset.testid = "split-canvas";
  canvas.getBoundingClientRect = () => ({ width: 1000, height: 600 }) as DOMRect;
  document.body.appendChild(canvas);
  getPaneController()!.growActivePane();
  expect(useSplitSets.getState().sets[0]!.sizes[0]).toBeCloseTo(0.56);
  getPaneController()!.shrinkActivePane();
  expect(useSplitSets.getState().sets[0]!.sizes[0]).toBeCloseTo(0.5);
  getPaneController()!.swapPaneDirection("right");
  run("panes.focus.left"); // a is now the right pane
  expect(usePerchStore.getState().sessionId).toBe("b");
});

it("a menu split targets the right-clicked tab, even before the session switch reply arrives", () => {
  const create = vi.fn();
  usePerchStore.setState({ createSessionOnHost: create, startCli: vi.fn() });
  useSplitSets.setState({ sets: [] });
  splitActiveTab("below", "b");
  expect(create).toHaveBeenCalledExactlyOnceWith("local", "/p", "terminal");
  // The active id still names a, but the menu was opened on b.
  expect(usePerchStore.getState().sessionId).toBe("a");
  usePerchStore.setState({ sessions: [...usePerchStore.getState().sessions, session("new", 3)], sessionId: "new" });
  expect(useSplitSets.getState().sets[0]?.ids).toEqual(["b", "new"]);
  expect(useSplitSets.getState().sets[0]?.dir).toBe("col");
});

it("falls back to Dockview for session-internal panes outside tiling", () => {
  useSplitSets.setState({ sets: [] });
  run("panes.focus.left");
  expect(dock.focusPaneDirection).toHaveBeenCalledWith("left");
});

it("a mod opens as a tab, or tiles beside the active tab, and closing it leaves no closed-tab record", () => {
  useSplitSets.setState({ sets: [] });
  expect(openModTab("clock", { zone: "utc" })).toBe(true);
  const [tab] = useFileTabs.getState().tabs;
  expect(tab).toMatchObject({ kind: "mod", mod: "clock", props: { zone: "utc" }, workspaceId: "w" });
  expect(openModTab("clock", undefined, "right")).toBe(true);
  const [, tiled] = useFileTabs.getState().tabs;
  expect(useSplitSets.getState().sets[0]?.ids).toContain(`w\n\0mod\n${tiled!.path}`);
  expect(localStorage.getItem("perch.closedTabs")).toBeNull();
  useFileTabs.getState().close(`w\n\0mod\n${tab!.path}`);
  expect(useFileTabs.getState().tabs).toHaveLength(1);
  expect(localStorage.getItem("perch.closedTabs") ?? "[]").toBe("[]");
});
