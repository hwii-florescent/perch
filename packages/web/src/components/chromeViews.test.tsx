// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("../Sidebar", () => ({ NewSessionPopover: () => null }));
vi.mock("../keybinds", () => ({ useNestShortcutHints: () => [] }));
vi.mock("../closeGuard", () => ({ requestCloseSession: vi.fn() }));
const { requestCloseSession } = await import("../closeGuard");
const { usePerchStore } = await import("../store");
const { WorkspaceOverview } = await import("./WorkspaceOverview");
const { WorkspaceBrowser } = await import("./WorkspaceBrowser");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
const select = vi.fn();
const project = { id: "p", hostId: "local", name: "Birdhouse", path: "/tmp/birdhouse", favorite: false, createdAt: 1, updatedAt: 1 };
const workspace = { id: "w", projectId: "p", hostId: "local", path: project.path, name: "Original", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const sessions = ["first", "second"].map((id) => ({ id, title: `${id} session`, hostId: "local", workspaceId: "w", projectId: "p", cwd: project.path, cliProviderId: "terminal", createdAt: 1, status: "idle" as const }));
beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  storage.set("perch.sidebar.sessionView", "list");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ activeHostId: "local", workspaceProjects: [project], workspaces: [workspace], sessions, sessionId: "first", activeWorkspaceId: "w", switchSession: select, worktreeJobs: [], workspaceSnapshotByHost: {} });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const get = (id: string) => host.querySelector(`[data-testid="${id}"]`)!;

it.each(["project", "list", "scratchpad"])("%s sessions have one full-row selection and sibling close actions", (mode) => {
  if (mode === "list") storage.set("perch.sidebar.organize", "list");
  if (mode === "scratchpad") usePerchStore.setState({ workspaceProjects: [{ ...project, path: "/tmp/.perch/scratch" }] });
  act(() => root.render(<WorkspaceOverview />));
  const selected = get("workspace-session-first");
  const other = get("workspace-session-second");
  const close = get("workspace-session-close-first");
  expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(selected.getAttribute("aria-current")).toBe("page");
  expect(selected.className).not.toContain("bg-surface-1");
  expect(selected.parentElement!.className).toContain("bg-surface-1");
  expect(other.parentElement!.className).not.toMatch(/(^|\s)bg-surface-1/);
  expect(close.parentElement).toBe(selected.parentElement);
  expect(close.className).toContain("group-focus-within/row:opacity-100");
  expect(close.className).toContain("[@media(hover:none)]:opacity-100");
  expect(get("workspace-entry-w")?.className ?? "").not.toMatch(/(^|\s)bg-surface-1/);
  act(() => close.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(requestCloseSession).toHaveBeenCalledWith("first");
  expect(select).not.toHaveBeenCalled();
  act(() => other.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(select).toHaveBeenCalledWith("second");
});

it("browser chrome uses SVG controls and only opens a page after an HTTP(S) address is submitted", () => {
  act(() => root.render(<WorkspaceBrowser tabId="browser" initialUrl="" />));
  const toolbar = get("browser-toolbar");
  expect(toolbar.className).toContain("h-[43px]");
  expect(toolbar.className).not.toContain("border-b");
  // --bg resolves on :root; nested pane --panel-bg overrides must not erase the address field.
  expect(get("browser-address").parentElement!.className).toContain("bg-[var(--bg)]");
  for (const name of ["Back", "Forward", "Reload", "Open externally"]) {
    const button = toolbar.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.disabled).toBe(true);
  }
  const input = get("browser-address") as HTMLInputElement;
  const type = (value: string) => {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  };
  type("javascript:alert(1)");
  expect(host.querySelector("iframe")).toBeNull();
  type("https://example.com/notes");
  expect(host.querySelector("iframe")!.getAttribute("src")).toBe("https://example.com/notes");
  expect((get("browser-open-external") as HTMLButtonElement).disabled).toBe(false);
  type(location.origin);
  expect(host.querySelector("iframe")).toBeNull();
  expect(host.textContent).toContain("own address can't be shown");
});
