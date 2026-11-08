// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionSummary, WorkspaceSummary } from "@perch/shared";

vi.mock("../ws", () => ({ socket: { connect: vi.fn(), send: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
const { usePerchStore } = await import("../store");
const { jumpToNest, orderedNests, stepNest } = await import("../workspaceNav");
const { TabBar } = await import("./TabBar");
const { WorkspaceOverview } = await import("./WorkspaceOverview");
const { StatusDot } = await import("./StatusDot");
const { AgentIcon } = await import("./AgentIcon");
const { saveTabOrder } = await import("../tabOrder");
const { useSplitSets } = await import("../splitSets");
const { useFileTabs } = await import("../fileTabs");
const { useCloseGuard } = await import("../closeGuard");

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
  // These cover the project tree; By status is the default view.
  localStorage.setItem("perch.sidebar.organize", "project");
  vi.clearAllMocks();
  useSplitSets.setState({ sets: [], menu: null, zoomedId: null });
  useFileTabs.setState({ tabs: [], active: null });
  useCloseGuard.setState({ pending: null });
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

it.each(["project", "status", "list"])("%s sidebar and horizontal tabs share direct tab actions without selecting on right-click", (organize) => {
  localStorage.setItem("perch.sidebar.organize", organize);
  usePerchStore.setState({ sessions: [session, { ...session, id: "other", title: "Other chat" }], sessionId: "other" });
  render(<><WorkspaceOverview /><TabBar /></>);
  const open = (id: string) => act(() => get(id).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  const labels = () => [...get("tab-split-menu").querySelectorAll("button")].map((button) => button.textContent);
  open("workspace-session-session");
  const sidebar = labels();
  expect(sidebar).toContain("Rename tab");
  expect(sidebar).toContain("Close tab");
  expect(sidebar).toContain("Split right with new terminal");
  expect(sidebar).toContain("Show beside Other chat");
  expect(sidebar.join()).not.toContain("Session pane actions");
  expect(switchSession).not.toHaveBeenCalled();
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  open("tab-session");
  expect(labels()).toEqual(sidebar);
  expect(switchSession).not.toHaveBeenCalled();
});

it("renames and closes a background workspace's tab directly, without touching the active session or its pane title", () => {
  const renameSession = vi.fn();
  usePerchStore.setState({ activeWorkspaceId: "main", sessionId: "foreground", renameSession, sessions: [session, { ...session, id: "foreground", workspaceId: "main", cwd: workspace.path }] });
  render(<><WorkspaceOverview /><TabBar /></>);
  const open = () => act(() => get("workspace-session-session").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  open();
  click(get("tab-menu-rename"));
  const input = get("tab-menu-rename-input") as HTMLInputElement;
  expect(document.activeElement).toBe(input);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "  Renamed chat  ");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(renameSession).toHaveBeenCalledExactlyOnceWith("session", "Renamed chat");
  expect(switchSession).not.toHaveBeenCalled();
  open();
  click(get("tab-menu-close"));
  expect(useCloseGuard.getState().pending?.id).toBe("session");
  expect(usePerchStore.getState().sessionId).toBe("foreground");
});

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
  click(get("workspace-session-session"));
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  expect(focus).not.toHaveBeenCalled();
  act(() => usePerchStore.setState({ sessionId: session.id }));
  const button = get("workspace-session-session");
  expect(button.getAttribute("aria-current")).toBe("page");
  expect(button.parentElement!.classList.contains("bg-surface-1")).toBe(true);
  expect(button.querySelector(".agent-mark")!.classList.contains("h-[18px]")).toBe(true);
  expect(button.querySelector(".agent-status-dot")).toBeNull(); // the tree's rows show state as a badge, not a ring
  expect(get("workspace-entry-tree").classList.contains("rounded-ui")).toBe(true);
  expect(get("workspace-entry-tree").classList.contains("bg-surface-1")).toBe(false);
  act(() => get("workspace-entry-tree").querySelector("strong")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  click(get("workspace-rename-tree"));
  expect(focus).not.toHaveBeenCalled();
  expect(get("workspace-entry-main").querySelector("strong")!.parentElement!.className).toContain("items-baseline");
});

it("identifies visible workspaces with checkout icons and workspaces without connecting rails", () => {
  const nested = { ...worktree, id: "nested-tree", path: "/repo-nested", name: "nested", parentWorkspaceId: "tree" };
  const laterSibling = { ...worktree, id: "later-tree", path: "/repo-later", name: "later" };
  const lastParent = { ...worktree, id: "last-parent", path: "/repo-last", name: "last", parentWorkspaceId: "main" };
  const lastNested = { ...worktree, id: "last-nested", path: "/repo-last-nested", name: "last nested", parentWorkspaceId: "last-parent" };
  // A hidden final sibling must stay out of both the rendered and keyboard order.
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
  expect(project.querySelector(".workspace-tree__guide, [data-guide-end]")).toBeNull();
  expect(entries.every((entry) => entry.querySelector('[data-testid="workspace-checkout-icon"]')?.getAttribute("aria-hidden") === "true")).toBe(true);
  // Projects are folders, the primary checkout is a diamond, and worktrees branch.
  expect(get("project-folder-icon").querySelector("path")?.getAttribute("d")).toContain("h3l2 2h5");
  expect(get("workspace-entry-main").querySelector('[data-testid="workspace-checkout-icon"] path')?.getAttribute("d")).toBe("M8 3l5 5-5 5-5-5z");
  expect(get("project-folder-icon").getAttribute("fill")).toBe("none");
  act(() => usePerchStore.setState({ workspaceProjects: usePerchStore.getState().workspaceProjects.map((project) => ({ ...project, favorite: true })) }));
  expect(get("project-folder-icon").getAttribute("fill")).toBe("currentColor");
  expect(entries.map((entry) => entry.querySelectorAll('[data-testid="workspace-checkout-icon"] circle').length)).toEqual([0, 3, 3, 3, 3, 3]);
  expect(get("workspace-children-tree").classList.contains("ml-[0.9rem]")).toBe(true);
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

it("a single-checkout project selects from its background, but not from its session rows", () => {
  usePerchStore.setState({ workspaces: [workspace], sessions: [{ ...session, workspaceId: workspace.id, cwd: workspace.path }], activeWorkspaceId: workspace.id });
  render(<WorkspaceOverview />);
  expect(orderedNests().map(({ id }) => id)).toEqual(["main"]);
  expect(document.querySelector('[data-testid="workspace-tree-root"]')).toBeNull();
  expect(document.querySelector('[data-testid="workspace-checkout-icon"]')).toBeNull();
  jumpToNest(1);
  expect(focus).toHaveBeenCalledExactlyOnceWith("main");
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  focus.mockClear(); switchSession.mockClear();
  stepNest(1);
  expect(focus).not.toHaveBeenCalled();
  click(get("workspace-entry-main"));
  expect(focus).toHaveBeenCalledExactlyOnceWith("main");
  focus.mockClear(); switchSession.mockClear();
  click(get("workspace-session-session"));
  expect(switchSession).toHaveBeenCalledExactlyOnceWith("session");
  expect(focus).not.toHaveBeenCalled();
});

it.each(["single", "worktree"])("%s workspace session rows follow the strip, including live drag reordering", (kind) => {
  const owner = kind === "single" ? workspace : worktree;
  const older = { ...session, workspaceId: owner.id, cwd: owner.path };
  const newer = { ...older, id: "newer", createdAt: 2 };
  usePerchStore.setState({ workspaces: kind === "single" ? [workspace] : [workspace, worktree], sessions: [newer, older], sessionId: newer.id, activeWorkspaceId: owner.id });
  render(<><WorkspaceOverview /><TabBar /></>);
  const badgeIds = () => [...host.querySelectorAll<HTMLElement>('.workspace-entry__sessions [data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((button) => button.dataset.testid!.replace("workspace-session-", ""));
  const tabIds = () => [...host.querySelectorAll('.tab-bar__tab[data-testid^="tab-"]')].map((tab) => tab.getAttribute("data-testid")!.replace("tab-", ""));
  expect(badgeIds()).toEqual([older.id, newer.id]);
  expect(badgeIds()).toEqual(tabIds());
  act(() => saveTabOrder(`remote:ws:${owner.id}`, [newer.id, "closed-tab", older.id]));
  expect(badgeIds()).toEqual([newer.id, older.id]); // updates without remount or switching
});

it("workspace hints match jump targets and temporarily reveal collapsed projects", () => {
  const hidden = { ...worktree, id: "hidden", hidden: true };
  usePerchStore.setState({ workspaces: [workspace, worktree, hidden], settings: { keybindings: { "nests.jump1": "ctrl+shift+1", "nests.jump2": "ctrl+shift+2" } } as never });
  render(<WorkspaceOverview />);
  click(get("project-toggle-project"));
  expect(document.querySelector('[data-testid="workspace-entry-tree"]')).toBeNull();
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", ctrlKey: true, shiftKey: true })));
  expect(get("workspace-shortcut-main").textContent).toBe("1");
  expect(get("workspace-shortcut-tree").textContent).toBe("2");
  expect(document.querySelector('[data-testid="workspace-shortcut-hidden"]')).toBeNull();
  jumpToNest(Number(get("workspace-shortcut-tree").textContent));
  expect(focus).toHaveBeenCalledExactlyOnceWith("tree");
  act(() => document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", ctrlKey: true })));
  expect(document.querySelector("kbd")).toBeNull();
  expect(document.querySelector('[data-testid="workspace-entry-tree"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem("perch.sidebar.collapsedProjects")!)).toEqual(["project"]);
});

it.each([false, true])("workspace navigation restores the last viewed session, not the newest (legacy=%s)", (legacy) => {
  const older = { ...session, id: "last-viewed", workspaceId: legacy ? undefined : worktree.id };
  const newer = { ...session, id: "newest", createdAt: 2 };
  const other = { ...session, id: "other-workspace", workspaceId: workspace.id, cwd: workspace.path };
  usePerchStore.setState({ sessions: [older, newer, other], activeWorkspaceId: worktree.id, sessionId: older.id });
  usePerchStore.setState({ activeWorkspaceId: workspace.id, sessionId: other.id });
  jumpToNest(2);
  expect(focus).toHaveBeenCalledExactlyOnceWith(worktree.id);
  expect(switchSession).toHaveBeenCalledExactlyOnceWith(older.id);
  switchSession.mockClear();
  // A closed remembered tab cannot reopen itself or select another workspace's tab.
  usePerchStore.setState({ sessions: [newer, other] });
  jumpToNest(2);
  expect(switchSession).toHaveBeenCalledExactlyOnceWith(newer.id);
});

it("status rings retain every status and select the actual harness rather than a stale hosted agent", () => {
  for (const [overrides, state, color] of [
    [{}, "idle", "var(--green)"],
    [{ status: "running" }, "working", "var(--yellow)"],
    [{ blocked: true }, "blocked", "var(--red)"],
    [{ unseen: true }, "done", "var(--teal)"],
    [{ status: "running", stale: true }, "idle", "var(--green)"],
  ] as const) {
    render(<StatusDot session={{ ...session, ...overrides }} />);
    const badge = host.querySelector<HTMLElement>(".agent-status-dot")!;
    expect(badge.classList.contains(`agent-status-dot--${state}`)).toBe(true);
    expect(badge.style.borderColor).toBe(color);
    expect(badge.dataset.provider).toBe("pi");
    expect(badge.classList.contains("h-5")).toBe(true);
    expect(badge.classList.contains("w-5")).toBe(true);
    expect(badge.classList.contains("bg-panel-bg")).toBe(true);
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

it("badges retain original brand colors on a contrast-safe backing; monochrome marks follow the theme", () => {
  for (const provider of ["claude", "claude-agent-teams", "omp"]) {
    render(<StatusDot session={{ ...session, currentProviderId: provider }} />);
    const path = host.querySelector("path")!;
    expect(path.getAttribute("fill")).toMatch(provider === "omp" ? /^url\(#/ : /^#D97757$/);
    expect(path.closest("svg")!.parentElement!.classList.contains("bg-[#161616]")).toBe(true);
    render(<AgentIcon provider={provider} />);
    expect(host.querySelector("path")?.getAttribute("fill")).toMatch(provider === "omp" ? /^url\(#/ : /^#D97757$/);
  }
  render(<StatusDot session={{ ...session, currentProviderId: "pi" }} />);
  expect(host.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
  expect(host.querySelector("svg")!.parentElement!.classList.contains("bg-[#161616]")).toBe(false);
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

it("Quickchat is the last nest: the nest keys reach it, wrap past it, and leave project numbers alone", () => {
  const chats = { ...workspace, id: "chats", projectId: "chats-project", path: "/home/.perch/scratch", name: "Quickchat" };
  const chat = (id: string, createdAt: number): SessionSummary => ({ ...session, id, workspaceId: "chats", cwd: chats.path, createdAt });
  usePerchStore.setState({
    workspaces: [workspace, chats], activeWorkspaceId: "main", sessionId: "project-chat",
    sessions: [{ ...session, id: "project-chat", workspaceId: "main", cwd: workspace.path }, chat("old", 1), chat("mid", 2), chat("new", 3)],
    workspaceProjects: [...usePerchStore.getState().workspaceProjects, { id: "chats-project", hostId: "remote", name: "Quickchat", path: chats.path, favorite: false, createdAt: 1, updatedAt: 1 }],
  });
  expect(orderedNests().map(({ id }) => id)).toEqual(["main", "chats"]);
  jumpToNest(1);
  expect(focus).toHaveBeenLastCalledWith("main"); // projects keep their numbers
  stepNest(1);
  expect(focus).toHaveBeenLastCalledWith("chats");
  expect(switchSession).toHaveBeenLastCalledWith("new"); // its newest chat, as the sidebar lists first
  act(() => usePerchStore.setState({ activeWorkspaceId: "chats", sessionId: "new" }));
  stepNest(1); // wraps back to the first project
  expect(focus).toHaveBeenLastCalledWith("main");
  stepNest(-1);
  expect(focus).toHaveBeenLastCalledWith("main");
  jumpToNest(2);
  expect(focus).toHaveBeenLastCalledWith("chats");
});
