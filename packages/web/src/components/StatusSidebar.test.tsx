// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionEvent, SessionSummary } from "@perch/shared";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("../Sidebar", () => ({ NewSessionPopover: () => null }));
vi.mock("../keybinds", () => ({ useNestShortcutHints: () => [] }));
vi.mock("../closeGuard", () => ({ requestCloseSession: vi.fn() }));
const { usePerchStore } = await import("../store");
const { useAttention } = await import("../attention");
const { WorkspaceOverview } = await import("./WorkspaceOverview");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
const project = { id: "p", hostId: "local", name: "Birdhouse", path: "/tmp/birdhouse", favorite: false, createdAt: 1, updatedAt: 1 };
const workspace = { id: "w", projectId: "p", hostId: "local", path: project.path, name: "main", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const chat = (id: string, init: Partial<SessionSummary> = {}) => ({ id, title: `${id} chat`, hostId: "local", workspaceId: "w", projectId: "p", cwd: project.path, cliProviderId: "terminal", createdAt: 1, status: "idle", ...init }) as SessionSummary;
const question: AttentionEvent = { id: "e", sessionId: "ask", agentId: "claude", kind: "question", requiresAction: true, certainty: "heuristic", summary: "", occurredAt: 1, count: 1, read: false };

beforeEach(() => {
  storage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({
    connected: true, activeHostId: "local", hostStates: {}, workspaceProjects: [project], workspaces: [workspace], sessionId: null, activeWorkspaceId: "w",
    worktreeJobs: [], workspaceSnapshotByHost: {}, workspaceOrderByHost: {},
    sessions: [chat("idle"), chat("work", { status: "running" }), chat("ask", { status: "running", blocked: true }), chat("fin", { unseen: true })],
  });
  useAttention.setState({ supported: true, events: [question] });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const get = (id: string) => host.querySelector(`[data-testid="${id}"]`);
const sectionIds = () => [...host.querySelectorAll('[data-testid^="status-section-title-"]')].map((el) => `${el.getAttribute("data-testid")!.replace("status-section-title-", "")}:${el.querySelector("[aria-label]")!.textContent}`);

it("is the default view, with sections in order, counts, and no empty section", () => {
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-status-view")).not.toBeNull();
  expect(sectionIds()).toEqual(["needs:1", "done:1", "working:1", "idle:1"]);
  act(() => usePerchStore.setState({ sessions: [chat("idle"), chat("work", { status: "running" })] }));
  expect(sectionIds()).toEqual(["working:1", "idle:1"]);
});

it("shows the project as secondary text and the core's reason and certainty on a Needs you row", () => {
  act(() => root.render(<WorkspaceOverview />));
  expect(get("status-section-needs")!.querySelector('[data-testid="status-row-detail"]')!.textContent).toBe("Birdhouse · Waiting for you · Guessed from terminal output");
  expect(get("status-section-idle")!.querySelector('[data-testid="status-row-detail"]')!.textContent).toBe("Birdhouse");
});

it("opens a chat on click and keeps the chat in view in Done while it is read", () => {
  const switchSession = vi.fn();
  usePerchStore.setState({ switchSession });
  act(() => root.render(<WorkspaceOverview />));
  act(() => get("workspace-session-fin")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(switchSession).toHaveBeenCalledWith("fin");
  // Opening it: now viewing and the core marks it seen, which would drop it to Idle.
  act(() => usePerchStore.setState({ sessionId: "fin" }));
  act(() => usePerchStore.setState({ sessions: usePerchStore.getState().sessions.map((s) => (s.id === "fin" ? { ...s, unseen: false } : s)) }));
  expect(get("status-section-done")!.querySelector('[data-testid="workspace-session-fin"]')).not.toBeNull();
  // Leaving it releases the row.
  act(() => usePerchStore.setState({ sessionId: "idle" }));
  expect(get("status-section-done")).toBeNull();
  expect(get("status-section-idle")!.querySelector('[data-testid="workspace-session-fin"]')).not.toBeNull();
});

it("does not state Working, Idle or Done for a host that is not connected: one last-known section", () => {
  usePerchStore.setState({ connected: false });
  act(() => root.render(<WorkspaceOverview />));
  expect(sectionIds()).toEqual(["offline:4"]);
  expect(get("status-section-title-offline")!.textContent).toContain("Offline: last known");
  expect(get("status-section-title-offline")!.textContent).toContain("Reconnecting…");
  expect(host.querySelector(".agent-status-dot")).toBeNull();
  expect(get("status-section-working")).toBeNull();
});

it("respects a saved Organize choice, and By status is one of the choices", () => {
  storage.set("perch.sidebar.organize", "project");
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-status-view")).toBeNull();
  expect(get(`workspace-project-p`)).not.toBeNull();
  act(() => get("workspace-organize")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => (document.querySelector('[data-testid="workspace-organize-status"]') as HTMLElement).click());
  expect(get("workspace-status-view")).not.toBeNull();
  expect(storage.get("perch.sidebar.organize")).toBe("status");
});

describe("reordering", () => {
  const setOrder = vi.fn();
  const rowIds = (section: string) => [...get(section)!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((el) => el.getAttribute("data-session") ?? el.getAttribute("data-testid")!.replace("workspace-session-", ""));
  const menuOf = (testId: string) => act(() => get(testId)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  beforeEach(() => {
    setOrder.mockClear();
    usePerchStore.setState({ sessions: [chat("a", { createdAt: 1 }), chat("b", { createdAt: 2 }), chat("c", { createdAt: 3 })], serverInfo: { protocolVersion: 1, capabilities: ["workspace.order.v1"] } as never, setWorkspaceOrder: setOrder });
    useAttention.setState({ supported: true, events: [] });
  });

  it("By status lists chats newest-first but writes strip order, so a first Move changes only the moved chat", () => {
    act(() => root.render(<WorkspaceOverview />));
    expect(rowIds("status-section-idle")).toEqual(["c", "b", "a"]);
    menuOf("workspace-session-c");
    act(() => (document.querySelector('[data-testid="workspace-session-move-down-c"]') as HTMLElement).click());
    expect(setOrder).toHaveBeenCalledWith("local", { sessions: ["a", "c", "b"] });
  });

  it("By status puts a chat the core has not listed yet on top", () => {
    usePerchStore.setState({ sessions: [chat("a", { createdAt: 1 }), chat("b", { createdAt: 2 }), chat("d", { createdAt: 4 })], workspaceOrderByHost: { local: { projects: [], sessions: ["a", "b"] } } });
    act(() => root.render(<WorkspaceOverview />));
    expect(rowIds("status-section-idle")).toEqual(["d", "b", "a"]);
  });

  it("In one list is chronological, ignores the core's order, and has no drag or Move", () => {
    storage.set("perch.sidebar.organize", "list");
    usePerchStore.setState({ workspaceOrderByHost: { local: { projects: [], sessions: ["a", "b", "c"] } } });
    act(() => root.render(<WorkspaceOverview />));
    const ids = [...get("workspace-session-list")!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((el) => el.getAttribute("data-testid")!.replace("workspace-session-", ""));
    expect(ids).toEqual(["c", "b", "a"]);
    expect(get("workspace-session-list")!.querySelector('[draggable="true"]')).toBeNull();
    menuOf("workspace-session-b");
    expect(document.querySelector('[data-testid^="workspace-session-move-"]')).toBeNull();
  });

  it("Quickchat shows newest first but writes strip order, so a first Move cannot flip the strips", () => {
    const scratch = { ...project, id: "s", name: "Chats", path: "/tmp/.perch/scratch" };
    const sw = { ...workspace, id: "sw", projectId: "s", path: scratch.path };
    const qc = (id: string, createdAt: number) => chat(id, { createdAt, workspaceId: "sw", projectId: "s", cwd: scratch.path });
    storage.set("perch.sidebar.organize", "project");
    usePerchStore.setState({ workspaceProjects: [scratch], workspaces: [sw], activeWorkspaceId: "sw", sessions: [qc("a", 1), qc("b", 2), qc("c", 3)] });
    act(() => root.render(<WorkspaceOverview />));
    const ids = () => [...get("workspace-chats")!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((el) => el.getAttribute("data-testid")!.replace("workspace-session-", ""));
    expect(ids()).toEqual(["c", "b", "a"]);
    // Move c down on screen (past b): in strip order b goes before c, a stays first.
    menuOf("workspace-session-c");
    act(() => (document.querySelector('[data-testid="workspace-session-move-down-c"]') as HTMLElement).click());
    expect(setOrder).toHaveBeenCalledWith("local", { sessions: ["a", "c", "b"] });
  });

  it("a project Move keeps the positions of projects this viewer does not list", () => {
    storage.set("perch.sidebar.organize", "project");
    usePerchStore.setState({
      workspaceProjects: [project, { ...project, id: "q", name: "Other", path: "/tmp/other", updatedAt: 0 }],
      workspaceOrderByHost: { local: { projects: ["p", "archived", "q"], sessions: [] } },
    });
    act(() => root.render(<WorkspaceOverview />));
    act(() => (get("workspace-project-menu-p") as HTMLElement).click());
    act(() => (document.querySelector('[data-testid="workspace-project-move-down-p"]') as HTMLElement).click());
    expect(setOrder).toHaveBeenCalledWith("local", { projects: ["q", "archived", "p"] });
  });
});

it("lists chats in the core's order inside a section", () => {
  usePerchStore.setState({ sessions: [chat("a"), chat("b"), chat("c")], workspaceOrderByHost: { local: { projects: [], sessions: ["c", "a", "b"] } } });
  act(() => root.render(<WorkspaceOverview />));
  const ids = [...get("status-section-idle")!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((el) => el.getAttribute("data-session"));
  expect(ids).toEqual(["b", "a", "c"]); // the core's order, mirrored: newest first on screen
});
