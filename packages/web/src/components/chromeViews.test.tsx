// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("./NewSessionPopover", () => ({ NewSessionPopover: () => null }));
vi.mock("../keybinds", () => ({ useNestShortcutHints: () => [] }));
vi.mock("../closeGuard", () => ({ requestCloseSession: vi.fn() }));
const { requestCloseSession } = await import("../closeGuard");
const { usePerchStore } = await import("../store");
const { WorkspaceOverview } = await import("../stock-ui/sidebar/overview");
const { WorkspaceBrowser } = await import("./WorkspaceBrowser");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
const select = vi.fn();
const project = { id: "p", hostId: "local", name: "Project", path: "/tmp/project", favorite: false, createdAt: 1, updatedAt: 1 };
const workspace = { id: "w", projectId: "p", hostId: "local", path: project.path, name: "Original", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const sessions = ["first", "second"].map((id) => ({ id, title: `${id} session`, hostId: "local", workspaceId: "w", projectId: "p", cwd: project.path, cliProviderId: "claude", createdAt: 1, status: "idle" as const }));
beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ activeHostId: "local", workspaceProjects: [project], workspaces: [workspace], sessions, sessionId: "first", activeWorkspaceId: "w", switchSession: select, worktreeJobs: [], workspaceSnapshotByHost: {} });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
// On the desktop a chat also shows under its project; with a Sessions section these tests mean its row.
const scope = () => host.querySelector('[data-testid="session-list"]') ?? host;
const get = (id: string) => (id.startsWith("workspace-session-") ? scope().querySelector(`[data-testid="${id}"]`) : null) ?? host.querySelector(`[data-testid="${id}"]`)!;

it.each(["status", "project", "list", "scratchpad"])("%s sessions have one full-row selection and a sibling menu button", (mode) => {
  if (mode !== "status") storage.set("perch.sidebar.organize", mode === "list" ? "list" : "project");
  if (mode === "scratchpad") usePerchStore.setState({ workspaceProjects: [{ ...project, path: "/tmp/.perch/scratch" }] });
  act(() => root.render(<WorkspaceOverview />));
  const selected = get("workspace-session-first");
  const other = get("workspace-session-second");
  const more = get("session-menu-button-first");
  expect(scope().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(selected.getAttribute("aria-current")).toBe("page");
  expect(selected.className).not.toContain("bg-surface-1");
  expect(selected.parentElement!.className).toContain("bg-surface-1");
  expect(other.parentElement!.className).not.toMatch(/(^|\s)bg-surface-1/);
  expect(more.parentElement).toBe(selected.parentElement);
  expect(more.className).toContain("group-focus-within/row:opacity-100");
  expect(more.className).toContain("[@media(hover:none)]:opacity-100");
  expect(more.className).toMatch(/(^|\s)opacity-100/);
  expect(host.querySelector('[data-testid^="workspace-session-close-"]')).toBeNull();
  expect(get("workspace-entry-w")?.className ?? "").not.toMatch(/(^|\s)bg-surface-1/);
  // The button opens the row's own menu, where Close lives; it does not select the row.
  act(() => more.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(document.querySelector('[data-testid="tab-menu-close"]')).not.toBeNull();
  expect(select).not.toHaveBeenCalled();
  act(() => other.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(select).toHaveBeenCalledWith("second");
});

it("a lead folds its sub-sessions behind a chevron, keeps what needs you on show and remembers the fold", () => {
  const family = [{ ...sessions[0]!, id: "lead" }, { ...sessions[1]!, id: "kid-a", parentSessionId: "lead" }, { ...sessions[1]!, id: "kid-b", parentSessionId: "lead", blocked: true }];
  act(() => usePerchStore.setState({ sessions: family, sessionId: "lead" }));
  act(() => root.render(<WorkspaceOverview />));
  const row = (id: string) => get(`workspace-session-${id}`) as HTMLElement | null;
  // Unfolded: the sub-sessions are filled cards with an elbow each, the lead is filled and carries the chevron.
  expect(row("kid-a")!.parentElement!.hasAttribute("data-sub-session")).toBe(true);
  expect(host.querySelectorAll('[data-testid^="session-elbow-"]')).toHaveLength(2);
  expect(row("lead")!.parentElement!.className).toContain("bg-surface-1");
  expect(row("kid-a")!.parentElement!.className).toContain("bg-surface-0");
  const fold = get("session-fold-lead")!;
  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(get("session-fold-kid-a")).toBeNull();
  act(() => fold.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(row("kid-a")).toBeNull();
  expect(row("kid-b")).toBeNull();
  expect(get("session-fold-lead")!.getAttribute("aria-expanded")).toBe("false");
  expect(get("session-rollup-lead")!.getAttribute("data-section")).toBe("needs");
  expect(JSON.parse(storage.get("perch.sidebar.foldedSessions")!)).toEqual(["lead"]);
  act(() => get("session-fold-lead")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(row("kid-b")).not.toBeNull();
  expect(JSON.parse(storage.get("perch.sidebar.foldedSessions")!)).toEqual([]);
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
