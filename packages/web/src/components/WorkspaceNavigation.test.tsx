// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionSummary, WorkspaceSummary } from "@perch/shared";

vi.mock("../ws", () => ({ socket: { connect: vi.fn(), send: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("../dockview/DockviewShell", () => ({ openSessionPaneMenu: vi.fn() }));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
const { usePerchStore } = await import("../store");
const { jumpToNest, orderedNests, stepNest } = await import("../workspaceNav");
const { TabBar } = await import("./TabBar");
const { WorkspaceOverview } = await import("./WorkspaceOverview");
const { StatusDot } = await import("./StatusDot");
const { AgentIcon } = await import("./AgentIcon");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollIntoView = vi.fn();
let root: Root;
let host: HTMLDivElement;
const create = vi.fn();
const focus = vi.fn();
const switchSession = vi.fn();
const workspace: WorkspaceSummary = { id: "main", projectId: "project", hostId: "remote", path: "/repo", name: "perch", branch: "main", dirty: false, state: "active", createdAt: 1, updatedAt: 1 };
const worktree: WorkspaceSummary = { ...workspace, id: "tree", path: "/repo-tree", name: "feature", branch: "feature", parentWorkspaceId: "main" };
const session: SessionSummary = { id: "session", title: "My agent", cwd: worktree.path, hostId: "remote", workspaceId: "tree", status: "idle", createdAt: 1, cliProviderId: "pi" };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ connected: true, activeHostId: "remote", activeProject: { hostId: "remote", cwd: workspace.path }, activeWorkspaceId: "tree", sessionId: null,
    workspaces: [workspace, worktree], sessions: [session],
    workspaceProjects: [{ id: "project", hostId: "remote", name: "perch", path: "/repo", favorite: false, createdAt: 1, updatedAt: 1 }],
    workspaceSnapshotByHost: {}, workspaceCapabilitiesByHost: { remote: ["agent.manifest.list"] },
    agentManifestsByHost: { remote: { state: "ready", manifests: ["pi", "terminal"].map((id) => ({ id, displayName: id === "terminal" ? "Terminal" : "pi", available: true, supportedModes: ["cli"], capabilities: ["interactiveTerminal"], resumability: "persistentProcess", statusDetection: "exitStatus" })) } },
    cliAgentBySession: {}, worktreeJobs: [], hosts: [], workspaceProjectCreate: null,
    createSessionOnHost: create, fetchAgentManifests: vi.fn(), focusWorkspace: focus, switchSession,
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function render(node: ReactNode) { act(() => root.render(node)); }
function click(element: Element) { act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
function get(testId: string) { const element = document.querySelector(`[data-testid="${testId}"]`); expect(element).not.toBeNull(); return element!; }

it("tab + starts the chosen harness in the active worktree and on its host, without a project confirmation", () => {
  render(<TabBar />);
  click(get("tab-new"));
  expect(create).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid^="project-option-"]')).toBeNull();
  click(get("new-session-provider-terminal"));
  expect(create).toHaveBeenCalledExactlyOnceWith("remote", "/repo-tree", "terminal");
  expect(document.querySelector(".new-session-popover")).toBeNull();
});

it("tab + uses Chats with no selected project, and cannot launch while discovery is loading", () => {
  usePerchStore.setState({ workspaces: [], activeWorkspaceId: null, activeProject: null, sessions: [] });
  render(<TabBar />);
  click(get("tab-new"));
  click(get("new-session-provider-pi"));
  expect(create).toHaveBeenCalledExactlyOnceWith("remote", "~", "pi");
  create.mockClear();
  act(() => usePerchStore.setState({ agentManifestsByHost: { remote: { state: "loading", manifests: usePerchStore.getState().agentManifestsByHost.remote?.manifests ?? [] } } }));
  click(get("tab-new"));
  expect((get("new-session-provider-pi") as HTMLButtonElement).disabled).toBe(true);
  expect(create).not.toHaveBeenCalled();
});

it("workspace background picks it, while its badge and rename input keep their own actions", () => {
  render(<WorkspaceOverview />);
  click(get("workspace-entry-tree"));
  expect(focus).toHaveBeenCalledExactlyOnceWith("tree");
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  focus.mockClear(); switchSession.mockClear();
  click(get("workspace-entry-tree").querySelector('[data-testid="session-dots"]')!);
  expect(focus).not.toHaveBeenCalled();
  expect(switchSession).not.toHaveBeenCalled();
  click(get("workspace-session-session"));
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  expect(focus).not.toHaveBeenCalled();
  act(() => usePerchStore.setState({ sessionId: session.id }));
  const button = get("workspace-session-session");
  expect(button.classList.contains("rounded-full")).toBe(true);
  expect(button.classList.contains("bg-overlay-0")).toBe(false);
  expect(button.classList.contains("h-8")).toBe(true);
  expect(button.querySelector(".agent-status-dot")!.classList.contains("h-[18px]")).toBe(true);
  expect(get("session-dots").classList.contains("border-overlay-1")).toBe(true);
  expect(get("workspace-entry-tree").classList.contains("rounded-ui")).toBe(true);
  expect(get("workspace-entry-tree").classList.contains("bg-surface-1")).toBe(true);
  expect(button.querySelector(".agent-status-dot")!.classList.contains("outline-offset-1")).toBe(true);
  act(() => get("workspace-entry-tree").querySelector("strong")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  click(get("workspace-rename-tree"));
  expect(focus).not.toHaveBeenCalled();
  expect(get("workspace-entry-main").querySelector("strong")!.parentElement!.className).toContain("items-baseline");
});

it("keeps tree guides continuous and correctly terminated for visible workspaces", () => {
  const nested = { ...worktree, id: "nested-tree", path: "/repo-nested", name: "nested", parentWorkspaceId: "tree" };
  const laterSibling = { ...worktree, id: "later-tree", path: "/repo-later", name: "later" };
  const lastParent = { ...worktree, id: "last-parent", path: "/repo-last", name: "last", parentWorkspaceId: "main" };
  const lastNested = { ...worktree, id: "last-nested", path: "/repo-last-nested", name: "last nested", parentWorkspaceId: "last-parent" };
  // Hidden is deliberately last in the full sibling order; it must not extend the visible rail.
  const hidden = { ...worktree, id: "hidden-tree", path: "/repo-hidden", name: "hidden", hidden: true };
  usePerchStore.setState({ workspaces: [workspace, worktree, nested, laterSibling, lastParent, lastNested, hidden] });
  render(<WorkspaceOverview />);

  const project = get("workspace-project-project");
  const entries = [...project.querySelectorAll('[data-testid^="workspace-entry-"]')];
  expect(entries.map((entry) => entry.getAttribute("data-testid"))).toEqual([
    "workspace-entry-main",
    "workspace-entry-tree",
    "workspace-entry-nested-tree",
    "workspace-entry-later-tree",
    "workspace-entry-last-parent",
    "workspace-entry-last-nested",
  ]);
  expect(project.querySelector('[data-testid="workspace-node-hidden-tree"]')).toBeNull();
  expect(project.querySelector('[data-testid="workspace-tree-root"]')?.className).toContain("workspace-tree");
  expect(project.querySelector('[data-testid="workspace-children-tree"]')?.className).toContain("workspace-tree");
  expect(project.querySelector('[data-testid="workspace-children-last-parent"]')?.className).toContain("workspace-tree");
  const guides = [...project.querySelectorAll(".workspace-tree__guide")];
  expect(guides).toHaveLength(entries.length);
  expect(guides.every((guide) => ["absolute", "pointer-events-none"].every((name) => guide.classList.contains(name)))).toBe(true);
  const guideEnd = (id: string) => project.querySelector(`[data-testid="workspace-node-${id}"] > .workspace-tree__guide`)?.getAttribute("data-guide-end");
  expect(guideEnd("tree")).toBe("next-sibling");
  expect(guideEnd("last-parent")).toBe("row");
  expect(guideEnd("last-nested")).toBe("row");
  expect(entries.map((entry) => entry.querySelector("svg path")?.getAttribute("d"))).toEqual(entries.map(() => "M3 6h7"));
  expect(entries.every((entry) => entry.querySelector("strong")?.classList.contains("font-medium"))).toBe(true);
  expect(entries.every((entry) => !entry.querySelector("strong")?.classList.contains("font-bold"))).toBe(true);
  expect(project.querySelector(".workspace-project__workspaces")?.classList.contains("border-t")).toBe(false);
  expect(get("project-toggle-project").classList.contains("min-h-8")).toBe(true);
  expect(get("project-toggle-project").querySelector("strong")?.classList.contains("text-[14px]")).toBe(true);
  expect(entries.every((entry) => entry.querySelector(".workspace-entry__button")?.classList.contains("min-h-8"))).toBe(true);
  expect(entries.every((entry) => entry.querySelector("strong")?.classList.contains("text-[13px]"))).toBe(true);
  expect(orderedNests().map(({ id }) => id)).toEqual(["main", "tree", "nested-tree", "later-tree", "last-parent", "last-nested"]);

  const visibleWorkspaces = [workspace, worktree, nested, laterSibling, lastParent, lastNested];
  const navigationSessions = visibleWorkspaces.map((item) => ({ ...session, id: `session-${item.id}`, workspaceId: item.id, cwd: item.path }));
  act(() => usePerchStore.setState({ sessions: navigationSessions, activeWorkspaceId: "last-nested", sessionId: "session-last-nested" }));
  stepNest(1);
  expect(focus).toHaveBeenCalledExactlyOnceWith("main");
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session-main");
  act(() => usePerchStore.setState({ sessions: [session], activeWorkspaceId: "tree", sessionId: null }));
  focus.mockClear(); switchSession.mockClear();
});

it("a single-checkout project selects from its background, but not from its session bar", () => {
  usePerchStore.setState({ workspaces: [workspace], sessions: [{ ...session, workspaceId: workspace.id, cwd: workspace.path }], activeWorkspaceId: workspace.id });
  render(<WorkspaceOverview />);
  expect(orderedNests().map(({ id }) => id)).toEqual(["main"]);
  expect(document.querySelector('[data-testid="workspace-tree-root"]')).toBeNull();
  jumpToNest(1);
  expect(focus).toHaveBeenCalledExactlyOnceWith("main");
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  focus.mockClear(); switchSession.mockClear();
  stepNest(1);
  expect(focus).not.toHaveBeenCalled();
  click(get("workspace-entry-main"));
  expect(focus).toHaveBeenCalledExactlyOnceWith("main");
  focus.mockClear(); switchSession.mockClear();
  click(get("session-dots"));
  expect(focus).not.toHaveBeenCalled();
  expect(switchSession).not.toHaveBeenCalled();
  click(get("workspace-session-session"));
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  expect(focus).not.toHaveBeenCalled();
});

it("status rings retain every status and select the actual harness rather than a stale hosted agent", () => {
  for (const [overrides, state, color] of [
    [{}, "idle", "var(--green)"],
    [{ status: "running" }, "working", "var(--yellow)"],
    [{ blocked: true }, "blocked", "var(--red)"],
    [{ unseen: true }, "done", "var(--teal)"],
    [{ status: "running", stale: true }, "idle", "var(--green)"],
  ] as const) {
    render(<StatusDot session={{ ...session, ...overrides, lastAgent: "claude" }} />);
    const badge = host.querySelector<HTMLElement>(".agent-status-dot")!;
    expect(badge.classList.contains(`agent-status-dot--${state}`)).toBe(true);
    expect(badge.style.borderColor).toBe(color);
    expect(badge.dataset.provider).toBe("pi");
    expect(badge.classList.contains("h-5")).toBe(true);
    expect(badge.classList.contains("w-5")).toBe(true);
    expect(badge.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 800 800");
  }
  act(() => usePerchStore.setState({ cliAgentBySession: { session: "terminal" } }));
  expect(host.querySelector(".agent-status-dot")!.getAttribute("data-provider")).toBe("terminal");
});

it("observed foreground identity overrides the launcher without changing its saved choice", () => {
  usePerchStore.setState({ cliAgentBySession: { session: "terminal" } });
  render(<StatusDot session={{ ...session, cliProviderId: "terminal", currentProviderId: "pi" }} />);
  expect(host.querySelector(".agent-status-dot")!.getAttribute("data-provider")).toBe("pi");
  render(<StatusDot session={{ ...session, cliProviderId: "terminal", currentProviderId: "terminal" }} />);
  expect(host.querySelector(".agent-status-dot")!.getAttribute("data-provider")).toBe("terminal");
  expect(usePerchStore.getState().cliAgentBySession.session).toBe("terminal");
});

it("all catalog harnesses have bundled artwork; custom and unknown harnesses have honest fallbacks", () => {
  for (const provider of ["claude", "codex", "pi", "omp", "opencode", "copilot", "aider", "kilo", "droid", "terminal", "gemini", "cursor", "openclaude"]) {
    render(<AgentIcon provider={provider} />);
    expect(host.querySelector("img, svg")).not.toBeNull();
    expect(host.querySelector("text")).toBeNull();
  }
  render(<AgentIcon provider="custom" />);
  expect(host.textContent).toBe("C");
  render(<AgentIcon />);
  expect(host.textContent).toBe("?");
});
