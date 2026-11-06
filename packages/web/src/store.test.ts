// @vitest-environment jsdom
//
// store.ts is not side-effect-free at import time: at module scope it calls
// `applyTheme("perch")` (touches `document.documentElement`) and
// `socket.connect()` (constructs a real `new WebSocket(...)`) so the app
// paints its default theme and opens the wire before any component mounts.
// Both need a DOM global, hence jsdom just for this file (every other test
// file here stays on the fast default "node" environment). jsdom has no
// WebSocket implementation, so a minimal stub is installed before import —
// we are only after the pure selector exports below, not the socket.
import { describe, it, expect, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  addEventListener(): void {}
  removeEventListener(): void {}
  static sent: string[] = [];
  send(message: string): void { FakeWebSocket.sent.push(message); }
  close(): void {}
}
// Must be installed before `./store` is evaluated — its module-scope
// `socket.connect()` call runs at import time, not inside any test/hook.
(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;

const {
  projectsForHost,
  effectiveActiveProject,
  activeWorkspaceSessions,
  sessionIdsForProject,
  omitKey,
  readLastAgentChoiceStored,
  usePerchStore,
  handleServerMessage,
} = await import("./store");
type ProjectNavState = import("./store").ProjectNavState;

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "id",
    title: "t",
    cwd: "/proj",
    createdAt: 0,
    status: "idle",
    ...overrides,
  } as SessionSummary;
}

function state(overrides: Partial<ProjectNavState> = {}): ProjectNavState {
  return {
    sessions: [],
    sessionId: null,
    activeHostId: "local",
    activeProject: null,
    ...overrides,
  };
}

describe("projectsForHost", () => {
  it("groups sessions by cwd within one host, newest project first", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", createdAt: 100 }),
      session({ id: "b", cwd: "/proj2", createdAt: 300 }),
      session({ id: "c", cwd: "/proj1", createdAt: 200 }),
    ];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups.map((g) => g.cwd)).toEqual(["/proj2", "/proj1"]);
    expect(groups[1]!.sessions.map((s) => s.id)).toEqual(["c", "a"]); // newest first within the group
  });

  it("excludes sessions belonging to a different host", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", hostId: "local" }),
      session({ id: "b", cwd: "/proj1", hostId: "remote1" }),
    ];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups.length).toBe(1);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(["a"]);
  });

  it("treats an absent hostId as 'local'", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", hostId: undefined })];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups.length).toBe(1);
  });

  it("groups sessions with no cwd under '(unknown)'", () => {
    const sessions = [session({ id: "a", cwd: undefined as unknown as string })];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups[0]!.cwd).toBe("(unknown)");
  });
});

describe("effectiveActiveProject", () => {
  it("returns the pinned project when it still has sessions", () => {
    const sessions = [session({ id: "a", cwd: "/proj1" })];
    const s = state({ sessions, activeProject: { hostId: "local", cwd: "/proj1" } });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/proj1" });
  });

  it("falls back to the host's most recent project when the pin's host differs", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", createdAt: 5 })];
    const s = state({ sessions, activeProject: { hostId: "remote1", cwd: "/other" } });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/proj1" });
  });

  it("KEEPS a pin pointing at a project with no sessions when the active session is unpersisted", () => {
    // Documented fallback: right after "+ New session" in a fresh cwd, the
    // DB row doesn't exist until the first message is sent, so the pinned
    // project legitimately has zero sessions yet. sessionId is set but does
    // not (yet) appear in `sessions` — "unpersisted".
    const sessions = [session({ id: "other", cwd: "/other-proj" })];
    const s = state({
      sessions,
      sessionId: "brand-new-unsaved",
      activeProject: { hostId: "local", cwd: "/fresh-dir" },
    });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/fresh-dir" });
  });

  it("falls back to the most recent project when the pin is empty and the active session IS persisted", () => {
    // Same "pin points at an empty project" shape, but this time sessionId
    // corresponds to a real row in `sessions` — so the project genuinely
    // disappeared (deleted) rather than being pending creation.
    const sessions = [
      session({ id: "real-session", cwd: "/other-proj", createdAt: 5 }),
    ];
    const s = state({
      sessions,
      sessionId: "real-session",
      activeProject: { hostId: "local", cwd: "/gone" },
    });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/other-proj" });
  });

  it("falls back to the most recent project when there is no active session at all", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", createdAt: 5 })];
    const s = state({ sessions, sessionId: null, activeProject: { hostId: "local", cwd: "/gone" } });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/proj1" });
  });

  it("returns null when the host has no projects at all", () => {
    expect(effectiveActiveProject(state())).toBeNull();
  });

  it("picks the host's newest project when there is no pin", () => {
    const sessions = [
      session({ id: "a", cwd: "/old", createdAt: 1 }),
      session({ id: "b", cwd: "/new", createdAt: 99 }),
    ];
    const s = state({ sessions, activeProject: null });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/new" });
  });
});

describe("activeWorkspaceSessions", () => {
  it("returns the effective project's sessions, oldest first", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", createdAt: 200 }),
      session({ id: "b", cwd: "/proj1", createdAt: 100 }),
    ];
    const s = state({ sessions, activeProject: { hostId: "local", cwd: "/proj1" } });
    expect(activeWorkspaceSessions(s).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("falls back to just the active session when there's no effective project", () => {
    const sessions = [session({ id: "solo", cwd: "/x" })];
    const s = state({ sessions, sessionId: "solo" });
    expect(activeWorkspaceSessions(s).map((x) => x.id)).toEqual(["solo"]);
  });

  it("returns empty when there's no effective project and no active session", () => {
    expect(activeWorkspaceSessions(state())).toEqual([]);
  });
});

describe("sessionIdsForProject", () => {
  it("returns ids of every session matching host + cwd", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1" }),
      session({ id: "b", cwd: "/proj1" }),
      session({ id: "c", cwd: "/proj2" }),
    ];
    expect(sessionIdsForProject(sessions, "local", "/proj1")).toEqual(["a", "b"]);
  });

  it("excludes sessions on a different host, even with a matching cwd", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", hostId: "local" }),
      session({ id: "b", cwd: "/proj1", hostId: "remote1" }),
    ];
    expect(sessionIdsForProject(sessions, "local", "/proj1")).toEqual(["a"]);
  });

  it("treats an absent hostId as 'local'", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", hostId: undefined })];
    expect(sessionIdsForProject(sessions, "local", "/proj1")).toEqual(["a"]);
  });

  it("matches the '(unknown)' fallback projectsForHost uses for a missing cwd", () => {
    const sessions = [session({ id: "a", cwd: undefined as unknown as string })];
    expect(sessionIdsForProject(sessions, "local", "(unknown)")).toEqual(["a"]);
  });

  it("returns empty for a project with no matching sessions", () => {
    expect(sessionIdsForProject([session({ id: "a", cwd: "/proj1" })], "local", "/proj2")).toEqual([]);
  });
});

describe("omitKey (per-session map cleanup on session.deleted)", () => {
  it("drops exactly the given key, immutably", () => {
    const map = { a: "claude", b: "codex" };
    const result = omitKey(map, "a");
    expect(result).toEqual({ b: "codex" });
    expect(map).toEqual({ a: "claude", b: "codex" }); // original untouched
  });

  it("is a no-op (new object, same contents) when the key is absent", () => {
    const map = { a: "claude" };
    expect(omitKey(map, "missing")).toEqual({ a: "claude" });
  });

  it("mirrors across every per-session map session.deleted cleans up", () => {
    // session.deleted's handler calls omitKey once per map with the same
    // deleted id, so all of them use the identical, tested cleanup rule.
    const deletedId = "gone";
    const sessionLayouts = { [deletedId]: {}, keep: {} };
    const cliTerminalIds = { [deletedId]: "term-1", keep: "term-2" };
    const cliAgentBySession = { [deletedId]: "codex", keep: "claude" };
    expect(omitKey(sessionLayouts, deletedId)).toEqual({ keep: {} });
    expect(omitKey(cliTerminalIds, deletedId)).toEqual({ keep: "term-2" });
    expect(omitKey(cliAgentBySession, deletedId)).toEqual({ keep: "claude" });
  });
});

// NOTE: this repo's vitest setup has no working `localStorage` even under
// `@vitest-environment jsdom` (verified: `typeof window.localStorage` is
// "undefined" here on this Node/jsdom combination) — the same reason none of
// `readActiveHostStored`/`readActiveProjectStored` above are round-trip
// tested either. `readLastAgentChoiceStored`/`writeLastAgentChoiceStored`
// wrap every access in try/catch for exactly this "unavailable" case, so the
// tests below exercise that fallback path rather than a real round-trip.
describe("readLastAgentChoiceStored / setLastAgentChoice (persisted create-flow default)", () => {
  it("never throws and defaults to 'claude' when localStorage is unavailable", () => {
    expect(readLastAgentChoiceStored()).toBe("claude");
  });

  it("setLastAgentChoice updates the store's lastAgentChoice regardless of localStorage availability", () => {
    usePerchStore.getState().setLastAgentChoice("codex");
    expect(usePerchStore.getState().lastAgentChoice).toBe("codex");
    // Restore so this doesn't leak into other tests in this file.
    usePerchStore.getState().setLastAgentChoice("claude");
    expect(usePerchStore.getState().lastAgentChoice).toBe("claude");
  });
});

describe("durable workspace navigation", () => {
  const project = (id: string, hostId = "local", path = `/projects/${id}`) => ({
    id,
    hostId,
    name: id,
    path,
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
  });
  const workspace = (id: string, projectId: string, hostId = "local", path = `/projects/${projectId}`) => ({
    id,
    projectId,
    hostId,
    path,
    name: id,
    dirty: false,
    state: "active" as const,
    createdAt: 1,
    updatedAt: 1,
  });

  it("keeps a scoped project snapshot from dropping another project", () => {
    FakeWebSocket.sent = [];
    usePerchStore.setState({
      connected: true,
      activeHostId: "local",
      serverInfo: {
        hostname: "test",
        isSsh: false,
        platform: "test",
        protocolVersion: 1,
        capabilities: ["workspace.snapshot"],
      },
      workspaceCapabilities: ["workspace.snapshot"],
      workspaceCapabilitiesByHost: { local: ["workspace.snapshot"] },
      workspaceProjects: [project("one"), project("two")],
      workspaces: [workspace("one-w", "one"), workspace("two-w", "two")],
      workspaceSnapshotByHost: { local: { state: "ready", snapshotEpoch: "epoch", revision: 3 } },
    });

    usePerchStore.getState().fetchWorkspaceSnapshot("local", "one");
    const request = JSON.parse(FakeWebSocket.sent.at(-1)!) as { requestId: string };
    handleServerMessage({
      type: "workspace.snapshot",
      requestId: request.requestId,
      hostId: "local",
      snapshotEpoch: "epoch",
      snapshotRevision: 4,
      projects: [project("one", "local", "/projects/one-renamed")],
      workspaces: [workspace("one-w", "one", "local", "/projects/one-renamed")],
      activeProjectId: "one",
      activeWorkspaceId: "one-w",
    });

    expect(usePerchStore.getState().workspaceProjects.map((item) => item.id)).toEqual(["two", "one"]);
    expect(usePerchStore.getState().workspaces.map((item) => item.id)).toEqual(["two-w", "one-w"]);
  });

  it("ignores an older frame from the same snapshot epoch", () => {
    usePerchStore.setState({
      workspaceProjects: [project("current")],
      workspaceSnapshotByHost: { local: { state: "ready", snapshotEpoch: "epoch", revision: 8 } },
    });
    handleServerMessage({
      type: "project.updated",
      requestId: "late",
      project: project("stale", "local", "/projects/stale"),
      snapshotEpoch: "epoch",
      snapshotRevision: 7,
    });
    expect(usePerchStore.getState().workspaceProjects.map((item) => item.id)).toEqual(["current"]);
  });

  it("does not let a delayed host A focus reply steal focus from host B", () => {
    usePerchStore.setState({
      connected: true,
      activeHostId: "host-a",
      activeProject: { hostId: "host-a", cwd: "/projects/a" },
      activeProjectId: "a",
      activeWorkspaceId: "a-w",
      workspaceProjects: [project("a", "host-a", "/projects/a"), project("b", "host-b", "/projects/b")],
      workspaces: [workspace("a-w", "a", "host-a", "/projects/a"), workspace("b-w", "b", "host-b", "/projects/b")],
      workspaceCapabilitiesByHost: {
        "host-a": ["workspace.snapshot", "workspace.focus"],
        "host-b": ["workspace.snapshot", "workspace.focus"],
      },
      workspaceSnapshotByHost: {
        "host-a": { state: "ready", snapshotEpoch: "epoch-a", revision: 2 },
      },
    });
    usePerchStore.getState().focusWorkspace("a-w");
    const request = JSON.parse(FakeWebSocket.sent.at(-1)!) as { requestId: string };
    usePerchStore.setState({ activeHostId: "host-b" });

    handleServerMessage({
      type: "workspace.focus",
      requestId: request.requestId,
      hostId: "host-a",
      snapshotEpoch: "epoch-a",
      snapshotRevision: 3,
      activeProjectId: "a",
      activeWorkspaceId: "a-w",
    });
    expect(usePerchStore.getState().activeHostId).toBe("host-b");
  });

  it("retains stale remote inventory and refreshes it once when the host reconnects", () => {
    const remoteProject = project('remote:["host-a","p"]', "host-a", "/remote");
    const remoteWorkspace = workspace('remote:["host-a","w"]', remoteProject.id, "host-a", "/remote");
    usePerchStore.setState({
      connected: true, hostStates: {}, workspaceProjects: [remoteProject], workspaces: [remoteWorkspace],
      workspaceSnapshotByHost: { "host-a": { state: "ready", revision: 5, snapshotEpoch: "old" } },
    });
    FakeWebSocket.sent = [];
    handleServerMessage({ type: "host.info", hostId: "host-a", name: "test", state: "error" });
    expect(usePerchStore.getState().workspaces).toEqual([remoteWorkspace]);
    expect(usePerchStore.getState().workspaceSnapshotByHost["host-a"]).toMatchObject({ state: "error", revision: 5 });
    const connected = { type: "host.info" as const, hostId: "host-a", name: "test", state: "connected" as const, capabilities: ["workspace.snapshot"] };
    handleServerMessage(connected);
    handleServerMessage(connected);
    const requests = FakeWebSocket.sent.map((raw) => JSON.parse(raw)).filter((message) => message.type === "workspace.snapshot");
    expect(requests).toHaveLength(1);
    expect(requests[0].hostId).toBe("host-a");
  });

  it("keeps a failed registration editable and accepts a corrected retry", () => {
    FakeWebSocket.sent = [];
    usePerchStore.setState({
      connected: true,
      activeHostId: "local",
      serverInfo: {
        hostname: "test",
        isSsh: false,
        platform: "test",
        protocolVersion: 1,
        capabilities: ["project.create"],
      },
      workspaceCapabilities: ["project.create"],
      workspaceCapabilitiesByHost: { local: ["project.create"] },
      workspaceProjectCreate: null,
    });

    usePerchStore.getState().createWorkspaceProject("/missing", "Demo");
    const first = JSON.parse(FakeWebSocket.sent.at(-1)!) as { requestId: string };
    handleServerMessage({ type: "error", requestId: first.requestId, message: "invalid_path" });
    expect(usePerchStore.getState().workspaceProjectCreate).toMatchObject({
      path: "/missing",
      name: "Demo",
      status: "error",
    });

    usePerchStore.getState().createWorkspaceProject("/valid", "Demo");
    expect(usePerchStore.getState().workspaceProjectCreate).toMatchObject({
      path: "/valid",
      name: "Demo",
      status: "pending",
    });
  });
});

// Catalog updates are host-owned: a refresh can race another device changing
// preferences, and its older snapshot must not bring disabled agents back.
describe("agent catalog revisions", () => {
  it("keeps a newer broadcast when an earlier refresh completes", () => {
    const { serverInfo } = usePerchStore.getState();
    usePerchStore.setState({ connected: true, activeHostId: "local", serverInfo: {
      ...serverInfo!, hostname: "test", isSsh: false, platform: "test", capabilities: ["agent.manifest.list", "agent.provider.configure"],
    }, agentManifestsByHost: {} });
    FakeWebSocket.sent = [];
    usePerchStore.getState().fetchAgentManifests("local");
    const request = JSON.parse(FakeWebSocket.sent.at(-1)!) as { requestId: string };
    const manifest = { id: "pi", displayName: "Pi", supportedModes: ["cli" as const], capabilities: ["interactiveTerminal"], resumability: "providerSession", statusDetection: "exitStatus", available: true, enabled: false };
    handleServerMessage({ type: "agent.manifest.list", requestId: "", hostId: "local", manifests: [manifest], revision: 2 });
    handleServerMessage({ type: "agent.manifest.list", requestId: request.requestId, hostId: "local", manifests: [{ ...manifest, enabled: true }], revision: 1 });
    expect(usePerchStore.getState().agentManifestsByHost.local).toMatchObject({ revision: 2, state: "ready", manifests: [{ enabled: false }] });
    handleServerMessage({ type: "agent.manifest.list", requestId: "", hostId: "remote", manifests: [{ ...manifest, enabled: true }], revision: 10 });
    expect(usePerchStore.getState().agentManifestsByHost.local.manifests[0].enabled).toBe(false);
    expect(usePerchStore.getState().agentManifestsByHost.remote.manifests[0].enabled).toBe(true);
  });
});

describe("usage.alert", () => {
  const alert = { type: "usage.alert" as const, kind: "limit", title: "Claude 5h limit at 82%", body: "Resets in 2h 10m" };

  it("toasts in a focused window and shows nothing when delivery is off", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const settings = usePerchStore.getState().settings;
    try {
      usePerchStore.setState({ toasts: [], settings: { toastDelivery: "app" } as never });
      handleServerMessage(alert);
      expect(usePerchStore.getState().toasts).toMatchObject([{ title: alert.title, text: "Claude 5h limit at 82% · Resets in 2h 10m" }]);

      usePerchStore.setState({ toasts: [], settings: { toastDelivery: "off" } as never });
      handleServerMessage(alert);
      expect(usePerchStore.getState().toasts).toEqual([]);
    } finally {
      vi.restoreAllMocks();
      usePerchStore.setState({ toasts: [], settings });
    }
  });
});

describe("desktop notification delivery", () => {
  it("keeps sound independent and preserves newer toasts when native sends fail asynchronously", async () => {
    const before = usePerchStore.getState();
    const rejects: ((error: Error) => void)[] = [];
    const invoke = vi.fn((_command: string) => new Promise((_, reject) => rejects.push(reject)));
    const sound = await import("./sound");
    const tone = vi.spyOn(sound, "playDoneTone").mockImplementation(() => {});
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
    try {
      usePerchStore.setState({ sessions: [session({ status: "running" })], sessionId: "id", toasts: [], settings: { theme: "perch", soundEnabled: true, toastDelivery: "system" } as never });
      handleServerMessage({ type: "session.updated", session: session() });
      expect(tone).toHaveBeenCalledTimes(1);
      handleServerMessage({ type: "usage.alert", kind: "reset", title: "Usage reset", body: "Ready again" });
      usePerchStore.setState({ toasts: [{ id: "newer", sessionId: "other", title: "Newer alert" }] });
      expect(invoke.mock.calls).toHaveLength(2);
      for (const reject of rejects) reject(new Error("macOS rejected the notification"));
      await vi.waitFor(() => expect(usePerchStore.getState().toasts).toHaveLength(3));
      expect(usePerchStore.getState().toasts.map((toast) => toast.title)).toEqual(["Newer alert", "t", "Usage reset"]);
      expect(invoke.mock.calls.every(([command]) => command === "notify_session")).toBe(true);
    } finally {
      vi.restoreAllMocks(); vi.unstubAllGlobals();
      usePerchStore.setState(before);
    }
  });

  it("never requests notification consent just because settings arrived", () => {
    const before = usePerchStore.getState();
    const invoke = vi.fn();
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
    try {
      handleServerMessage({ type: "settings.current", settings: { theme: "perch", toastDelivery: "system" } as never });
      expect(invoke).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); usePerchStore.setState(before); }
  });
});

describe("deleteSession (tab close)", () => {
  it("worktree deletion refuses a local draft before debounce, including force", async () => {
    const { useWorkspaceFilesStore } = await import("./filesystemStore");
    const before = usePerchStore.getState().workspaces;
    const documents = useWorkspaceFilesStore.getState().documents;
    try {
      usePerchStore.setState({ workspaces: [{ id: "draft-ws", hostId: "local", path: "/draft-checkout" } as never] });
      useWorkspaceFilesStore.setState({ documents: { "draft-ws": { "note.txt": {
        workspaceId: "draft-ws", path: "note.txt", content: "new unsaved work",
        savedContent: "old text", persistedContent: "old text", state: "ready",
      } } } });
      FakeWebSocket.sent.length = 0;
      const reply = await usePerchStore.getState().removeWorktree("local", "/repo", "/draft-checkout", true, true);
      expect(reply).toMatchObject({ type: "worktree.error", dirty: false });
      expect("message" in reply && reply.message).toContain("note.txt");
      expect(FakeWebSocket.sent).toEqual([]);
      expect(useWorkspaceFilesStore.getState().documents["draft-ws"]["note.txt"].content).toBe("new unsaved work");
    } finally {
      usePerchStore.setState({ workspaces: before });
      useWorkspaceFilesStore.setState({ documents });
    }
  });

  it("keeps each core's sidebar order and sends moves only to a reachable core that has the capability", () => {
    const base = usePerchStore.getState();
    try {
      handleServerMessage({ type: "workspace.order", hostId: "local", projects: ["p2", "p1"], sessions: ["s1"] });
      handleServerMessage({ type: "workspace.order", hostId: "box", projects: ["remote:p"], sessions: [] });
      expect(usePerchStore.getState().workspaceOrderByHost).toEqual({
        local: { projects: ["p2", "p1"], sessions: ["s1"] },
        box: { projects: ["remote:p"], sessions: [] },
      });

      // Local core without the capability (older peer): nothing sent, nothing changed.
      usePerchStore.setState({ connected: true, serverInfo: { type: "server.info", hostname: "h", isSsh: false, platform: "linux", claudeModels: [], codexModels: [], protocolVersion: 1, capabilities: [] } as never });
      FakeWebSocket.sent = [];
      usePerchStore.getState().setWorkspaceOrder("local", { sessions: ["s2", "s1"] });
      expect(FakeWebSocket.sent).toEqual([]);
      expect(usePerchStore.getState().workspaceOrderByHost.local!.sessions).toEqual(["s1"]);

      // With it: applied at once, and only the lists given are sent.
      usePerchStore.setState({ serverInfo: { ...usePerchStore.getState().serverInfo!, capabilities: ["workspace.order.v1"] } });
      usePerchStore.getState().setWorkspaceOrder("local", { sessions: ["s2", "s1"] });
      expect(usePerchStore.getState().workspaceOrderByHost.local).toEqual({ projects: ["p2", "p1"], sessions: ["s2", "s1"] });
      expect(JSON.parse(FakeWebSocket.sent.at(-1)!)).toMatchObject({ type: "workspace.order.set", sessions: ["s2", "s1"] });
      expect(JSON.parse(FakeWebSocket.sent.at(-1)!)).not.toHaveProperty("projects");

      // A remote host needs its own capability and a live connection: no local fallback.
      FakeWebSocket.sent = [];
      usePerchStore.getState().setWorkspaceOrder("box", { projects: [] });
      expect(FakeWebSocket.sent).toEqual([]);
      usePerchStore.setState({
        hostStates: { box: { type: "host.info", hostId: "box", name: "box", state: "connected" } as never },
        workspaceCapabilitiesByHost: { box: ["workspace.order.v1"] },
      });
      usePerchStore.getState().setWorkspaceOrder("box", { projects: ["remote:q"] });
      expect(JSON.parse(FakeWebSocket.sent.at(-1)!)).toMatchObject({ type: "workspace.order.set", hostId: "box", projects: ["remote:q"] });
    } finally {
      usePerchStore.setState({ workspaceOrderByHost: {}, serverInfo: base.serverInfo, hostStates: base.hostStates, workspaceCapabilitiesByHost: base.workspaceCapabilitiesByHost, connected: base.connected });
    }
  });

  it("closing the active tab lands on a sibling in the same project, not the newest session elsewhere", () => {
    usePerchStore.setState({
      sessionId: "A",
      activeHostId: "local",
      activeProject: { hostId: "local", cwd: "/p" },
      // No workspace records: tabs fall back to the project (host + cwd).
      activeWorkspaceId: null,
      workspaces: [],
      sessions: [
        session({ id: "A", cwd: "/p", createdAt: 1 }),
        session({ id: "B", cwd: "/p", createdAt: 2 }),
        session({ id: "C", cwd: "/q", createdAt: 3 }),
      ],
    });
    FakeWebSocket.sent.length = 0;
    usePerchStore.getState().deleteSession("A");
    const sent = FakeWebSocket.sent.map((frame) => JSON.parse(frame) as { type: string; sessionId?: string });
    expect(sent[0]).toMatchObject({ type: "session.delete", sessionId: "A" });
    expect(sent.at(-1)).toMatchObject({ sessionId: "B" });
  });
});
