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
const project = { id: "p", hostId: "local", name: "Project", path: "/tmp/project", favorite: false, createdAt: 1, updatedAt: 1 };
const workspace = { id: "w", projectId: "p", hostId: "local", path: project.path, name: "main", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const chat = (id: string, init: Partial<SessionSummary> = {}) => ({ id, title: `${id} chat`, hostId: "local", workspaceId: "w", projectId: "p", cwd: project.path, cliProviderId: "claude", createdAt: 1, status: "idle", ...init }) as SessionSummary;
const question: AttentionEvent = { id: "e", sessionId: "ask", agentId: "claude", kind: "question", requiresAction: true, certainty: "heuristic", summary: "", occurredAt: 1, count: 1, read: false };

beforeEach(() => {
  storage.clear();
  // The tree is the default view; most of these cover the flat By status view.
  storage.set("perch.sidebar.organize", "status");
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
const rowsIn = (testId: string) => [...get(testId)!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])')].map((el) => el.getAttribute("data-testid")!.replace("workspace-session-", ""));
const sectionIds = () => [...host.querySelectorAll('[data-testid^="status-section-title-"]')].map((el) => `${el.getAttribute("data-testid")!.replace("status-section-title-", "")}:${el.querySelector("[aria-label]")!.textContent}`);

it("By status has sections in order, counts, and no empty section", () => {
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-status-view")).not.toBeNull();
  expect(sectionIds()).toEqual(["needs:1", "done:1", "working:1", "idle:1"]);
  act(() => usePerchStore.setState({ sessions: [chat("idle"), chat("work", { status: "running" })] }));
  expect(sectionIds()).toEqual(["working:1", "idle:1"]);
});

it("nests a sub-session under its lead within a section, and leaves one alone when its lead is in another", () => {
  usePerchStore.setState({ sessions: [chat("idle"), chat("other"), chat("kid2", { parentSessionId: "idle" }), chat("kid1", { parentSessionId: "idle" }), chat("ask", { status: "running", blocked: true, parentSessionId: "idle" })] });
  act(() => root.render(<WorkspaceOverview />));
  const idleRows = [...get("status-section-idle")!.querySelectorAll('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close"])')];
  expect(idleRows.map((el) => el.getAttribute("data-testid")!.replace("workspace-session-", ""))).toEqual(["other", "idle", "kid1", "kid2"]);
  const nested = (id: string) => get(`workspace-session-${id}`)!.parentElement!.hasAttribute("data-sub-session");
  expect([nested("idle"), nested("kid1"), nested("kid2")]).toEqual([false, true, true]);
  // Its lead is Idle but it is waiting on a person: it shows in Needs you, not nested there.
  expect(nested("ask")).toBe(false);
  expect(get("status-section-needs")!.querySelector('[data-testid="workspace-session-ask"]')).not.toBeNull();
});

it("shows the core's reason and certainty on a Needs you row, under its project", () => {
  act(() => root.render(<WorkspaceOverview />));
  expect(get("status-section-needs")!.querySelector('[data-testid="status-row-detail"]')!.textContent).toBe("Waiting for you · Guessed from terminal output");
  expect(get("status-section-needs")!.querySelector('[data-testid="status-project-title"]')!.textContent).toBe("Project");
  expect(get("status-section-idle")!.querySelector('[data-testid="status-row-detail"]')).toBeNull();
});

it("By status keeps each section's chats under their project, in the sidebar's project order, Quickchat last", () => {
  const other = { ...project, id: "q", name: "Other", path: "/tmp/other", updatedAt: 0 };
  const scratch = { ...project, id: "s", name: "Chats", path: "/tmp/.perch/scratch", updatedAt: 5 };
  const ow = { ...workspace, id: "ow", projectId: "q", path: other.path };
  const sw = { ...workspace, id: "sw", projectId: "s", path: scratch.path };
  usePerchStore.setState({ workspaceProjects: [scratch, other, project], workspaces: [workspace, ow, sw], sessions: [
    chat("q1", { workspaceId: "ow", projectId: "q", cwd: other.path, createdAt: 9 }),
    chat("s1", { workspaceId: "sw", projectId: "s", cwd: scratch.path, createdAt: 8 }),
    chat("p1", { createdAt: 1 }),
    chat("p2", { createdAt: 2 }),
  ] });
  act(() => root.render(<WorkspaceOverview />));
  const titles = [...get("status-section-idle")!.querySelectorAll('[data-testid="status-project-title"]')].map((el) => el.textContent);
  expect(titles).toEqual(["Project", "Other", "Quickchat"]);
  expect(rowsIn("status-project-idle-p")).toEqual(["p2", "p1"]);
});

it("By status rows are the harness mark and the name, with no state ring (the section says the state)", () => {
  act(() => root.render(<WorkspaceOverview />));
  const row = get("workspace-session-work")!;
  expect(row.querySelector(".agent-mark")).not.toBeNull();
  expect(host.querySelector('[data-testid="workspace-status-view"] .agent-status-dot')).toBeNull();
  expect(row.querySelector(".agent-mark")!.getAttribute("title")).toBe("claude");
});

it("By status ends with the projects that have no agent chat, each with a + and a way in", () => {
  const other = { ...project, id: "q", name: "Other", path: "/tmp/other", updatedAt: 0 };
  const ow = { ...workspace, id: "ow", projectId: "q", path: other.path };
  const focus = vi.fn();
  usePerchStore.setState({ workspaceProjects: [project, other], workspaces: [workspace, ow], focusWorkspace: focus });
  act(() => root.render(<WorkspaceOverview />));
  expect(get("status-no-sessions-title")!.textContent).toBe("No sessions1");
  expect(get("status-empty-project-p")).toBeNull();
  const row = get("status-empty-project-q")!;
  expect(row.textContent).toBe("Other");
  expect(row.querySelector('[data-testid="workspace-project-new-session-q"]')).not.toBeNull();
  act(() => (row.querySelector("button") as HTMLElement).click());
  expect(focus).toHaveBeenCalledWith("ow");
  // A shell does not count as a chat, and once every project has one the section is gone.
  act(() => usePerchStore.setState({ sessions: [...usePerchStore.getState().sessions, chat("o1", { workspaceId: "ow", projectId: "q", cwd: other.path })] }));
  expect(get("status-no-sessions")).toBeNull();
});

it("a project heading in By status carries a + to start work in it", () => {
  act(() => root.render(<WorkspaceOverview />));
  expect(get("status-project-needs-p")!.querySelector('[data-testid="workspace-project-new-session-p"]')).not.toBeNull();
});

it("lists agents only: a plain terminal stays a tab, one running an agent is listed", () => {
  usePerchStore.setState({ sessions: [chat("agent"), chat("shell", { cliProviderId: "terminal" }), chat("hand", { cliProviderId: "terminal", currentProviderId: "pi" }), chat("gone", { cliProviderId: "claude", currentProviderId: "terminal" })] });
  act(() => root.render(<WorkspaceOverview />));
  expect(rowsIn("status-section-idle")).toEqual(["hand", "agent"]);
  storage.set("perch.sidebar.organize", "project");
  act(() => { root.unmount(); root = createRoot(host); });
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-session-shell")).toBeNull();
  expect(get("workspace-session-agent")).not.toBeNull();
  // Asked for, terminals are listed too, and the choice is kept.
  act(() => get("workspace-organize")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => (document.querySelector('[data-testid="workspace-show-terminals"]') as HTMLElement).click());
  expect(get("workspace-session-shell")).not.toBeNull();
  expect(storage.get("perch.sidebar.showTerminals")).toBe("1");
});

it.each(["project", "status", "list"])("%s always lists Quickchat terminals, regardless of Show terminals", (mode) => {
  storage.set("perch.sidebar.organize", mode);
  storage.set("perch.sidebar.showTerminals", "0");
  const scratch = { ...project, id: "s", name: "Chats", path: "/tmp/.perch/scratch" };
  const sw = { ...workspace, id: "sw", projectId: "s", path: scratch.path };
  usePerchStore.setState({ workspaceProjects: [project, scratch], workspaces: [workspace, sw], sessions: [
    chat("project-shell", { cliProviderId: "terminal", createdAt: 1 }),
    chat("project-agent", { createdAt: 2 }),
    chat("quick-shell", { workspaceId: "sw", projectId: "s", cwd: "/tmp", cliProviderId: "terminal", createdAt: 3 }),
    chat("quick-agent", { workspaceId: "sw", projectId: "s", cwd: "/home", createdAt: 4, status: "running" }),
  ] });
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-session-project-shell")).toBeNull();
  expect(get("workspace-session-project-agent")).not.toBeNull();
  expect(get("workspace-session-quick-shell")).not.toBeNull();
  expect(get("workspace-session-quick-agent")).not.toBeNull();
  if (mode === "project") expect(rowsIn("workspace-chats")).toEqual(["quick-agent", "quick-shell"]);
  if (mode === "status") {
    expect(rowsIn("status-project-idle-s")).toEqual(["quick-shell"]);
    expect(rowsIn("status-project-working-s")).toEqual(["quick-agent"]);
    expect(get("workspace-chats")).toBeNull();
  }
  if (mode === "list") {
    expect(rowsIn("workspace-session-list")).toEqual(["quick-agent", "quick-shell", "project-agent"]);
    expect(get("workspace-session-quick-shell")!.textContent).toContain("Quickchat");
    expect(get("workspace-chats")).toBeNull();
  }
  for (const enabled of [true, false]) {
    act(() => get("workspace-organize")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => (document.querySelector('[data-testid="workspace-show-terminals"]') as HTMLElement).click());
    expect(!!get("workspace-session-project-shell")).toBe(enabled);
    expect(get("workspace-session-quick-shell")).not.toBeNull();
  }
});

it("In one list uses plain harness marks and the tree's state badges, with no state claims offline", () => {
  storage.set("perch.sidebar.organize", "list");
  act(() => root.render(<WorkspaceOverview />));
  expect(host.querySelectorAll(".agent-mark")).toHaveLength(4);
  expect(host.querySelector(".agent-status-dot")).toBeNull();
  expect(get("session-state-ask")!.textContent).toBe("Needs you");
  expect(get("session-state-fin")!.textContent).toBe("Done");
  expect(get("session-state-work")!.textContent).toBe("Working");
  expect(get("session-state-idle")).toBeNull();
  expect(get("workspace-session-idle")!.textContent).toContain("Project");
  act(() => usePerchStore.setState({ connected: false }));
  expect(host.querySelector('[data-testid^="session-state-"]')).toBeNull();
  expect(rowsIn("workspace-session-list")).toHaveLength(4);
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

it("opens on the project tree, and By status is one of the choices", () => {
  storage.delete("perch.sidebar.organize");
  act(() => root.render(<WorkspaceOverview />));
  expect(get("workspace-status-view")).toBeNull();
  expect(get(`workspace-project-p`)).not.toBeNull();
  act(() => get("workspace-organize")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  act(() => (document.querySelector('[data-testid="workspace-organize-status"]') as HTMLElement).click());
  expect(get("workspace-status-view")).not.toBeNull();
  expect(storage.get("perch.sidebar.organize")).toBe("status");
});

describe("project tree", () => {
  const click = (el: Element | null) => act(() => el!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const two = () => {
    const other = { ...project, id: "q", name: "Other", path: "/tmp/other", updatedAt: 0 };
    const ow = { ...workspace, id: "ow", projectId: "q", path: other.path };
    usePerchStore.setState({ workspaceProjects: [project, other], workspaces: [workspace, ow], activeWorkspaceId: null,
      sessions: [chat("idle"), chat("z", { workspaceId: "ow", projectId: "q", cwd: other.path, status: "running", blocked: true })] });
  };
  const order = () => [...host.querySelectorAll('[data-testid^="workspace-project-"][data-reorder-id], [data-testid^="workspace-project-"].workspace-project')].map((el) => el.getAttribute("data-testid"));
  beforeEach(() => { storage.delete("perch.sidebar.organize"); });

  it("keeps every session visible in a background workspace, including one that becomes idle", () => {
    usePerchStore.setState({ activeWorkspaceId: null });
    act(() => root.render(<WorkspaceOverview />));
    for (const id of ["idle", "work", "ask", "fin"]) expect(get(`workspace-session-${id}`)).not.toBeNull();
    expect(get("workspace-idle-w")).toBeNull();
    act(() => usePerchStore.setState({ sessions: usePerchStore.getState().sessions.map((s) => s.id === "work" ? { ...s, status: "idle" } : s) }));
    expect(get("workspace-session-work")).not.toBeNull();
    expect(get("session-state-work")).toBeNull();
  });

  it("says Needs you, Done and Working in visible words at the end of a row, nothing for Idle, with no state ring", () => {
    act(() => root.render(<WorkspaceOverview />));
    expect(get("session-state-ask")!.textContent).toBe("Needs you");
    expect(get("session-state-ask")!.getAttribute("data-state")).toBe("needs");
    expect(get("session-state-fin")!.textContent).toBe("Done");
    expect(get("session-state-work")!.getAttribute("data-state")).toBe("working");
    expect(get("session-state-work")!.textContent).toBe("Working");
    expect(get("session-state-work")!.className).toContain("text-[11px]");
    expect(get("session-state-idle")).toBeNull();
    expect(host.querySelector(".agent-status-dot")).toBeNull();
    // A host that is not reachable states nothing.
    act(() => usePerchStore.setState({ connected: false }));
    expect(host.querySelector('[data-testid^="session-state-"]')).toBeNull();
  });

  it("the open workspace lists all of its chats", () => {
    act(() => root.render(<WorkspaceOverview />));
    expect(get("workspace-session-idle")).not.toBeNull();
    expect(get("workspace-idle-w")).toBeNull();
  });

  it.each(["needs", "working"])("a folded project says %s in visible words", (section) => {
    storage.set("perch.sidebar.collapsedProjects", JSON.stringify(["p"]));
    usePerchStore.setState({ activeWorkspaceId: null });
    if (section === "working") {
      usePerchStore.setState({ sessions: [chat("work", { status: "running" })] });
      useAttention.setState({ events: [] });
    }
    act(() => root.render(<WorkspaceOverview />));
    expect(get("workspace-session-work")).toBeNull();
    expect(get("project-rollup-p")!.getAttribute("data-section")).toBe(section);
    expect(get("project-rollup-p")!.textContent).toBe(section === "needs" ? "Needs you" : "Working");
  });

  it("the header counts the chats that need you, and is absent when none do", () => {
    act(() => root.render(<WorkspaceOverview />));
    expect(get("workspace-needs-you")!.textContent).toBe("1 needs you");
    act(() => usePerchStore.setState({ sessions: [chat("idle")] }));
    act(() => useAttention.setState({ events: [] }));
    expect(get("workspace-needs-you")).toBeNull();
  });

  it("sorts by attention on request, keeping favourites first, and then has no drag", () => {
    two();
    usePerchStore.setState({ serverInfo: { protocolVersion: 1, capabilities: ["workspace.order.v1"] } as never });
    act(() => root.render(<WorkspaceOverview />));
    expect(order()).toEqual(["workspace-project-p", "workspace-project-q"]);
    expect(host.querySelector("[data-reorder-id]")).not.toBeNull();
    act(() => root.unmount());
    storage.set("perch.sidebar.sort", "attention");
    root = createRoot(host);
    act(() => root.render(<WorkspaceOverview />));
    expect(order()).toEqual(["workspace-project-q", "workspace-project-p"]);
    expect(host.querySelector("[data-reorder-id]")).toBeNull();
  });

  it("ignores the retired active-only preference and offers no idle-hiding control", () => {
    two();
    storage.set("perch.sidebar.activeOnly", "1");
    act(() => root.render(<WorkspaceOverview />));
    expect(get("workspace-project-p")).not.toBeNull();
    expect(get("workspace-session-idle")).not.toBeNull();
    expect(get("workspace-project-q")).not.toBeNull();
    click(get("workspace-organize"));
    expect(document.querySelector('[data-testid="workspace-active-only"]')).toBeNull();
  });
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
