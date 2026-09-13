// @vitest-environment jsdom
//
// store.ts is not side-effect-free at import time: at module scope it calls
// `applyTheme("catppuccin")` (touches `document.documentElement`) and
// `socket.connect()` (constructs a real `new WebSocket(...)`) so the app
// paints its default theme and opens the wire before any component mounts.
// Both need a DOM global, hence jsdom just for this file (every other test
// file here stays on the fast default "node" environment). jsdom has no
// WebSocket implementation, so a minimal stub is installed before import —
// we are only after the pure selector exports below, not the socket.
import { describe, it, expect } from "vitest";
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

// jsdom (this file's environment) has no requestAnimationFrame/
// cancelAnimationFrame implementation, and store.ts's chunk-coalescing
// buffer (see `scheduleChunkFlush`/`flushChunkBuffer`) calls both. The tests
// below never rely on a real frame actually firing — they force a
// synchronous flush via the exported `flushChunkBuffer()` — so a minimal
// stub that never invokes its callback is enough to keep `scheduleChunkFlush`
// from throwing.
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = () => 0;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = () => {};

const {
  projectsForHost,
  effectiveActiveProject,
  activeProjectSessions,
  archivedSessions,
  sessionIdsForProject,
  shouldReuseCurrentSession,
  resolveSessionAgent,
  agentRuntimeCapabilitiesKnown,
  resolveSessionModeForView,
  omitKey,
  readLastAgentChoiceStored,
  usePerchStore,
  handleServerMessage,
  flushChunkBuffer,
} = await import("./store");
type ProjectNavState = import("./store").ProjectNavState;
type ChatMessage = import("./store").ChatMessage;

/** Reset the store's per-session chat state between tests in this file's new
 * describe block — these tests mutate `messagesBySession`/
 * `streamingMessageIdBySession`/`sessionId` directly (there's no `reset()`
 * action, so this mirrors what a fresh page load's initial state looks
 * like). Declared here so a `beforeEach` throughout the multiplexing suite
 * can call it without repeating the shape. */
function resetChatState(overrides: Partial<{
  sessionId: string | null;
  messagesBySession: Record<string, ChatMessage[]>;
  streamingMessageIdBySession: Record<string, string | null>;
}> = {}): void {
  const sessionId = overrides.sessionId ?? null;
  const messagesBySession = overrides.messagesBySession ?? {};
  const streamingMessageIdBySession = overrides.streamingMessageIdBySession ?? {};
  usePerchStore.setState({
    sessionId,
    messagesBySession,
    streamingMessageIdBySession,
    messages: sessionId ? (messagesBySession[sessionId] ?? []) : [],
    streamingMessageId: sessionId ? (streamingMessageIdBySession[sessionId] ?? null) : null,
  });
}

function assistantMsg(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    role: "assistant",
    text: "",
    thinking: "",
    tools: [],
    streaming: true,
    ...overrides,
  };
}

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

  it("excludes archived sessions entirely", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", archived: true }),
      session({ id: "b", cwd: "/proj1", archived: false }),
    ];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups.length).toBe(1);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(["b"]);
  });

  it("drops a project entirely once every one of its sessions is archived", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", archived: true })];
    const groups = projectsForHost(state({ sessions }), "local");
    expect(groups).toEqual([]);
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
    // disappeared (deleted/archived) rather than being pending creation.
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

describe("activeProjectSessions", () => {
  it("returns the effective project's sessions, oldest first", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", createdAt: 200 }),
      session({ id: "b", cwd: "/proj1", createdAt: 100 }),
    ];
    const s = state({ sessions, activeProject: { hostId: "local", cwd: "/proj1" } });
    expect(activeProjectSessions(s).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("excludes archived sessions from the project's list", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", archived: true }),
      session({ id: "b", cwd: "/proj1" }),
    ];
    const s = state({ sessions, activeProject: { hostId: "local", cwd: "/proj1" } });
    expect(activeProjectSessions(s).map((x) => x.id)).toEqual(["b"]);
  });

  it("falls back to just the active session when there's no effective project", () => {
    const sessions = [session({ id: "solo", cwd: "/x" })];
    const s = state({ sessions, sessionId: "solo" });
    expect(activeProjectSessions(s).map((x) => x.id)).toEqual(["solo"]);
  });

  it("returns empty when there's no effective project and no active session", () => {
    expect(activeProjectSessions(state())).toEqual([]);
  });
});

describe("archivedSessions", () => {
  it("returns only archived sessions, newest first", () => {
    const sessions = [
      session({ id: "a", archived: true, createdAt: 100 }),
      session({ id: "b", archived: false, createdAt: 300 }),
      session({ id: "c", archived: true, createdAt: 300 }),
    ];
    expect(archivedSessions(sessions).map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("spans all hosts, unlike projectsForHost", () => {
    const sessions = [
      session({ id: "a", archived: true, hostId: "local" }),
      session({ id: "b", archived: true, hostId: "remote1" }),
    ];
    expect(archivedSessions(sessions).map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("returns empty when nothing is archived", () => {
    expect(archivedSessions([session({ id: "a" })])).toEqual([]);
  });
});

describe("sessionIdsForProject", () => {
  it("returns ids of every non-archived session matching host + cwd", () => {
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

  it("excludes already-archived sessions (bulk action should not double-archive)", () => {
    const sessions = [
      session({ id: "a", cwd: "/proj1", archived: true }),
      session({ id: "b", cwd: "/proj1", archived: false }),
    ];
    expect(sessionIdsForProject(sessions, "local", "/proj1")).toEqual(["b"]);
  });

  it("matches the '(unknown)' fallback projectsForHost uses for a missing cwd", () => {
    const sessions = [session({ id: "a", cwd: undefined as unknown as string })];
    expect(sessionIdsForProject(sessions, "local", "(unknown)")).toEqual(["a"]);
  });

  it("returns empty for a project with no matching sessions", () => {
    expect(sessionIdsForProject([session({ id: "a", cwd: "/proj1" })], "local", "/proj2")).toEqual([]);
  });
});

describe("shouldReuseCurrentSession (Bug 1: '+ New session' silently no-oping)", () => {
  it("does NOT reuse (i.e. lets a create proceed) when there is no active session at all", () => {
    // The exact repro: every session was deleted (or never created), so
    // sessionId is null. The old `currentHostId = currentSession?.hostId ??
    // "local"` fallback made this case look like a same-host match and the
    // guard fired, silently no-opping the button.
    const s = state({ sessions: [], sessionId: null });
    expect(shouldReuseCurrentSession(s, "local", undefined, false, true)).toBe(false);
  });

  it("does not reuse when sessionId is null even if other sessions exist on the host", () => {
    const sessions = [session({ id: "other", cwd: "/proj1" })];
    const s = state({ sessions, sessionId: null });
    expect(shouldReuseCurrentSession(s, "local", undefined, false, true)).toBe(false);
  });

  it("reuses (focuses the composer) when the current session is empty, same host, no cwd requested", () => {
    const sessions = [session({ id: "cur", cwd: "/proj1", hostId: "local" })];
    const s = state({ sessions, sessionId: "cur" });
    expect(shouldReuseCurrentSession(s, "local", undefined, false, true)).toBe(true);
  });

  it("does not reuse when the current session belongs to a different host", () => {
    const sessions = [session({ id: "cur", cwd: "/proj1", hostId: "remote1" })];
    const s = state({ sessions, sessionId: "cur" });
    expect(shouldReuseCurrentSession(s, "local", undefined, false, true)).toBe(false);
  });

  it("does not reuse when an explicit cwd is requested", () => {
    const sessions = [session({ id: "cur", cwd: "/proj1", hostId: "local" })];
    const s = state({ sessions, sessionId: "cur" });
    expect(shouldReuseCurrentSession(s, "local", "/other", false, true)).toBe(false);
  });

  it("does not reuse when the current session already has messages", () => {
    const sessions = [session({ id: "cur", cwd: "/proj1", hostId: "local" })];
    const s = state({ sessions, sessionId: "cur" });
    expect(shouldReuseCurrentSession(s, "local", undefined, false, false)).toBe(false);
  });

  it("CLI mode is exempt — always creates even on a matching empty session", () => {
    const sessions = [session({ id: "cur", cwd: "/proj1", hostId: "local" })];
    const s = state({ sessions, sessionId: "cur" });
    expect(shouldReuseCurrentSession(s, "local", undefined, true, true)).toBe(false);
  });
});

describe("resolveSessionAgent", () => {
  it("prefers the server-confirmed lastAgent when present", () => {
    const s = session({ id: "a", lastAgent: "codex" });
    expect(resolveSessionAgent(s, { a: "claude" }, "a")).toBe("codex");
  });

  it("falls back to hostedAgentBySession when the session has no lastAgent yet", () => {
    // The Bug 2/3 shape: a brand-new session created as codex, never sent a
    // turn yet, switched away from and back to.
    const s = session({ id: "a" });
    expect(resolveSessionAgent(s, { a: "codex" }, "a")).toBe("codex");
  });

  it("falls back to 'claude' when neither is available", () => {
    expect(resolveSessionAgent(undefined, {}, "a")).toBe("claude");
    expect(resolveSessionAgent(session({ id: "a" }), {}, "a")).toBe("claude");
  });

  it("handles a null sessionId (no active session) without throwing", () => {
    expect(resolveSessionAgent(undefined, { a: "codex" }, null)).toBe("claude");
  });
});

describe("session mode capability handshake safety", () => {
  it("treats a missing local server.info as unknown, while an empty list is a known legacy peer", () => {
    const pendingHandshake = {
      serverInfo: null,
      workspaceCapabilitiesByHost: {},
    };
    expect(agentRuntimeCapabilitiesKnown(pendingHandshake, "local")).toBe(false);
    expect(resolveSessionModeForView(false, false, undefined, "cli")).toEqual({
      mode: "hosted",
      pending: true,
    });

    const legacyPeer = {
      serverInfo: {
        hostname: "legacy",
        isSsh: false,
        platform: "test",
        capabilities: [],
      },
      workspaceCapabilitiesByHost: {},
    };
    expect(agentRuntimeCapabilitiesKnown(legacyPeer, "local")).toBe(true);
    expect(resolveSessionModeForView(true, false, undefined, "cli")).toEqual({
      mode: "cli",
      pending: false,
    });
  });

  it("keeps a server-confirmed CLI mode mounted safely during an invalidation refetch", () => {
    const modeState = {
      mode: "cli" as const,
      scope: "session" as const,
      revision: 12,
      deviceId: "device",
      authoritative: true,
      state: "loading" as const,
    };
    expect(resolveSessionModeForView(true, true, modeState, "hosted")).toEqual({
      mode: "cli",
      pending: false,
    });
  });

  it("marks a mode reply authoritative so a later read cannot fall back to the global setting", () => {
    FakeWebSocket.sent = [];
    usePerchStore.setState({
      connected: true,
      sessionId: "mode-session",
      activeHostId: "local",
      deviceId: "mode-device",
      sessions: [session({ id: "mode-session", hostId: "local" })],
      serverInfo: {
        hostname: "modern",
        isSsh: false,
        platform: "test",
        protocolVersion: 1,
        capabilities: ["session.mode.get", "session.mode.set"],
      },
      sessionModes: {},
      settings: {
        customModels: { claude: [], codex: [] },
        defaultCwd: null,
        theme: "catppuccin",
        soundEnabled: false,
        toastDelivery: "off",
        chatMode: "cli",
        terminalScrollback: 10000,
        terminalLoginShell: false,
      },
    });

    const requestId = usePerchStore.getState().fetchSessionMode("mode-session");
    expect(requestId).toBeTruthy();
    handleServerMessage({
      type: "session.mode",
      requestId: requestId!,
      sessionId: "mode-session",
      deviceId: "mode-device",
      mode: "hosted",
      scope: "session",
      revision: 12,
    });

    expect(usePerchStore.getState().sessionModes["mode-session"]).toMatchObject({
      mode: "hosted",
      authoritative: true,
      state: "ready",
    });

    usePerchStore.getState().fetchSessionMode("mode-session");
    expect(usePerchStore.getState().sessionModes["mode-session"]).toMatchObject({
      mode: "hosted",
      authoritative: true,
      state: "loading",
    });
  });
});

describe("mode policy invalidation across observed sessions", () => {
  function prepare(ids: string[], workspaces: string[], hosts = ids.map(() => "local")) {
    FakeWebSocket.sent = [];
    usePerchStore.setState({
      connected: true,
      sessionId: ids[0],
      activeHostId: "local",
      activeWorkspaceId: workspaces[0],
      deviceId: "invalidation-device",
      sessions: ids.map((id, i) => session({ id, workspaceId: workspaces[i], hostId: hosts[i] })),
      serverInfo: {
        hostname: "modern", isSsh: false, platform: "test",
        capabilities: ["session.mode.get", "session.mode.set"],
      },
      sessionModes: Object.fromEntries(ids.map((id) => [id, {
        mode: "hosted", scope: "default", revision: 1,
        deviceId: "invalidation-device", authoritative: true, state: "ready",
      }])),
    });
  }

  function reads(): Array<{ requestId: string; sessionId: string }> {
    return FakeWebSocket.sent.map((frame) => JSON.parse(frame))
      .filter((frame) => frame.type === "session.mode.get");
  }

  function reply(request: { requestId: string; sessionId: string }, revision: number) {
    handleServerMessage({
      type: "session.mode", requestId: request.requestId, sessionId: request.sessionId,
      deviceId: "invalidation-device",
      mode: "cli", scope: "workspace", revision,
    });
  }

  it("uses the session's server association instead of another browsed host or workspace", () => {
    prepare(["association-mode"], ["unused"]);
    usePerchStore.setState({
      activeHostId: "remote",
      activeWorkspaceId: "unrelated-navigation",
      sessions: [session({ id: "association-mode", hostId: undefined, workspaceId: undefined })],
    });
    usePerchStore.getState().fetchSessionMode("association-mode");
    expect(reads()).toHaveLength(1);
    expect(reads()[0]).not.toHaveProperty("workspaceId");
    handleServerMessage({
      type: "session.mode", requestId: reads()[0].requestId, sessionId: "association-mode", deviceId: "invalidation-device",
      workspaceId: "server-workspace", mode: "hosted", scope: "default", revision: 2,
    });
    usePerchStore.getState().setSessionMode("association-mode", "workspace", "cli");
    const write = FakeWebSocket.sent.map((frame) => JSON.parse(frame)).find((frame) => frame.type === "session.mode.set");
    expect(write).toMatchObject({ sessionId: "association-mode", workspaceId: "server-workspace", scope: "workspace" });
    reply(write, 3);
  });

  it("refreshes every observed session in the workspace without loading unrelated sessions or hosts", () => {
    prepare(["workspace-a", "workspace-b", "workspace-c", "workspace-remote"],
      ["shared", "shared", "other", "shared"], ["local", "local", "local", "remote"]);
    handleServerMessage({
      type: "session.mode.invalidated", sessionId: "workspace-a", workspaceId: "shared",
      hostId: "local", revision: 2,
    });
    expect(reads().map((request) => request.sessionId)).toEqual(["workspace-a", "workspace-b"]);
    for (const request of reads()) reply(request, 2);
    expect(usePerchStore.getState().sessionModes["workspace-b"].mode).toBe("cli");
    expect(usePerchStore.getState().sessionModes["workspace-c"].mode).toBe("hosted");
  });

  it("applies device invalidations across workspaces only for this device and host", () => {
    prepare(["device-a", "device-b", "device-remote"], ["first", "second", "third"],
      ["local", "local", "remote"]);
    handleServerMessage({
      type: "session.mode.invalidated", sessionId: "device-a", workspaceId: "first",
      deviceId: "another-device", hostId: "local", revision: 2,
    });
    expect(reads()).toEqual([]);
    handleServerMessage({
      type: "session.mode.invalidated", sessionId: "device-a", workspaceId: "first",
      deviceId: "invalidation-device", hostId: "local", revision: 2,
    });
    expect(reads().map((request) => request.sessionId)).toEqual(["device-a", "device-b"]);
    for (const request of reads()) reply(request, 2);
  });

  it("refetches when an invalidation races an older read instead of losing the policy update", () => {
    prepare(["race-mode"], ["race-workspace"]);
    usePerchStore.getState().fetchSessionMode("race-mode");
    const original = reads()[0];
    handleServerMessage({
      type: "session.mode.invalidated", sessionId: "race-mode", workspaceId: "race-workspace",
      hostId: "local", revision: 3,
    });
    expect(reads()).toHaveLength(1);
    reply(original, 2);
    expect(reads()).toHaveLength(2);
    expect(usePerchStore.getState().sessionModes["race-mode"].revision).toBe(1);
    reply(reads()[1], 3);
    expect(usePerchStore.getState().sessionModes["race-mode"]).toMatchObject({
      mode: "cli", revision: 3, authoritative: true, state: "ready",
    });
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

  it("mirrors across every per-session map session.deleted cleans up, including hostedAgentBySession", () => {
    // hostedAgentBySession is the new map added alongside cliAgentBySession /
    // cliTerminalIds / sessionLayouts — session.deleted's handler calls
    // omitKey once per map with the same deleted id, so this documents that
    // all four use the identical, tested cleanup rule.
    const deletedId = "gone";
    const sessionLayouts = { [deletedId]: {}, keep: {} };
    const cliTerminalIds = { [deletedId]: "term-1", keep: "term-2" };
    const cliAgentBySession = { [deletedId]: "codex", keep: "claude" };
    const hostedAgentBySession = { [deletedId]: "codex", keep: "claude" };
    expect(omitKey(sessionLayouts, deletedId)).toEqual({ keep: {} });
    expect(omitKey(cliTerminalIds, deletedId)).toEqual({ keep: "term-2" });
    expect(omitKey(cliAgentBySession, deletedId)).toEqual({ keep: "claude" });
    expect(omitKey(hostedAgentBySession, deletedId)).toEqual({ keep: "claude" });
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

describe("bulk-archive fallback (archiving every session in the active project)", () => {
  it("effectiveActiveProject falls back to another project once the active one is archived away", () => {
    // Simulates the sidebar's "archive all" bulk action: every session in
    // the pinned project gets archived (one `session.updated` per id, same
    // as the single-session archive path), leaving the pin dangling —
    // exactly the same shape `projectsForHost` already handles for a single
    // archived/deleted session (see the "falls back" cases above), just
    // reached via the bulk path instead of one row's archive button.
    const sessions = [
      session({ id: "a", cwd: "/proj1", archived: true, createdAt: 200 }),
      session({ id: "b", cwd: "/proj1", archived: true, createdAt: 100 }),
      session({ id: "c", cwd: "/other-proj", createdAt: 5 }),
    ];
    const s = state({
      sessions,
      sessionId: "a",
      activeProject: { hostId: "local", cwd: "/proj1" },
    });
    expect(effectiveActiveProject(s)).toEqual({ hostId: "local", cwd: "/other-proj" });
    expect(activeProjectSessions(s).map((x) => x.id)).toEqual(["c"]);
  });

  it("returns null (nav goes to the empty state) when the archived project was the host's only one", () => {
    const sessions = [session({ id: "a", cwd: "/proj1", archived: true })];
    const s = state({
      sessions,
      sessionId: "a",
      activeProject: { hostId: "local", cwd: "/proj1" },
    });
    expect(effectiveActiveProject(s)).toBeNull();
  });
});

describe("per-session chat multiplexing (messagesBySession / streamingMessageIdBySession)", () => {
  it("routes chat.chunk for a background (non-active) session into its own bucket, not the active session's", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")], B: [assistantMsg("b1")] },
      streamingMessageIdBySession: { A: "a1", B: "b1" },
    });

    handleServerMessage({ type: "chat.chunk", sessionId: "B", text: "hello" });
    flushChunkBuffer();

    const state = usePerchStore.getState();
    expect(state.messagesBySession.B![0]!.text).toBe("hello");
    expect(state.messagesBySession.A![0]!.text).toBe(""); // untouched
    // The active-session mirror tracks A only — B's text must not leak into it.
    expect(state.messages).toEqual(state.messagesBySession.A);
  });

  it("keeps interleaved chunks for two concurrently-streaming sessions separate (no cross-session buffering)", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")], B: [assistantMsg("b1")] },
      streamingMessageIdBySession: { A: "a1", B: "b1" },
    });

    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "foo" });
    handleServerMessage({ type: "chat.chunk", sessionId: "B", text: "bar" });
    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "baz" });
    handleServerMessage({ type: "chat.chunk", sessionId: "B", text: "qux" });
    flushChunkBuffer();

    const state = usePerchStore.getState();
    expect(state.messagesBySession.A![0]!.text).toBe("foobaz");
    expect(state.messagesBySession.B![0]!.text).toBe("barqux");
  });

  it("chat.done for a background session does not clear the active session's streaming state", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")], B: [assistantMsg("b1")] },
      streamingMessageIdBySession: { A: "a1", B: "b1" },
    });

    handleServerMessage({ type: "chat.done", sessionId: "B" });

    const state = usePerchStore.getState();
    // B is done.
    expect(state.streamingMessageIdBySession.B).toBeNull();
    expect(state.messagesBySession.B![0]!.streaming).toBe(false);
    // A (active, still streaming) must be completely untouched, including
    // the active-session mirror fields.
    expect(state.streamingMessageIdBySession.A).toBe("a1");
    expect(state.messagesBySession.A![0]!.streaming).toBe(true);
    expect(state.streamingMessageId).toBe("a1");
    expect(state.messages[0]!.streaming).toBe(true);
  });

  it("chat.done for the active session DOES clear its streaming state and mirror", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")] },
      streamingMessageIdBySession: { A: "a1" },
    });

    handleServerMessage({ type: "chat.done", sessionId: "A" });

    const state = usePerchStore.getState();
    expect(state.streamingMessageIdBySession.A).toBeNull();
    expect(state.streamingMessageId).toBeNull();
    expect(state.messages[0]!.streaming).toBe(false);
  });

  it("a synchronous flush before reading messages applies buffered chunk text rather than dropping it", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")] },
      streamingMessageIdBySession: { A: "a1" },
    });

    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "partial" });
    // Every real call site that reads/replaces messages (switchSession,
    // createSessionOnHost, the disconnect handler, ...) calls this
    // synchronously first, precisely so a still-pending animation frame can
    // never cause the text below to go missing.
    flushChunkBuffer();

    expect(usePerchStore.getState().messagesBySession.A![0]!.text).toBe("partial");
  });

  it("handleServerMessage flushes pending chunks before processing any non-chunk message, so a chat.done right after a burst of chunks doesn't drop them", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")] },
      streamingMessageIdBySession: { A: "a1" },
    });

    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "hi " });
    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "there" });
    // No explicit flush call here — chat.done itself must flush first.
    handleServerMessage({ type: "chat.done", sessionId: "A" });

    const state = usePerchStore.getState();
    expect(state.messagesBySession.A![0]!.text).toBe("hi there");
    expect(state.messagesBySession.A![0]!.streaming).toBe(false);
  });

  it("flushChunkBuffer() with no argument flushes every pending session, not just the active one", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")], B: [assistantMsg("b1")] },
      streamingMessageIdBySession: { A: "a1", B: "b1" },
    });

    handleServerMessage({ type: "chat.chunk", sessionId: "A", text: "aaa" });
    handleServerMessage({ type: "chat.chunk", sessionId: "B", text: "bbb" });
    flushChunkBuffer(); // no sessionId argument

    const state = usePerchStore.getState();
    expect(state.messagesBySession.A![0]!.text).toBe("aaa");
    expect(state.messagesBySession.B![0]!.text).toBe("bbb");
  });

  it("drops chat.chunk for a session this client has never loaded (not the active session, no bucket) instead of spawning state for it", () => {
    resetChatState({ sessionId: "A", messagesBySession: { A: [] }, streamingMessageIdBySession: {} });

    handleServerMessage({ type: "chat.chunk", sessionId: "stranger", text: "should not appear" });
    flushChunkBuffer();

    expect(usePerchStore.getState().messagesBySession.stranger).toBeUndefined();
  });

  it("session.deleted cleans up messagesBySession/streamingMessageIdBySession for exactly the deleted session", () => {
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1")], B: [assistantMsg("b1")] },
      streamingMessageIdBySession: { A: "a1", B: "b1" },
    });
    usePerchStore.setState({
      sessions: [session({ id: "A" }), session({ id: "B" })],
    });

    // B is not the active session, so this doesn't also trigger
    // switchAwayFromActiveSession's session-switch machinery.
    handleServerMessage({ type: "session.deleted", sessionId: "B" });

    const state = usePerchStore.getState();
    expect(state.messagesBySession).toEqual({ A: [assistantMsg("a1")] });
    expect(state.streamingMessageIdBySession).toEqual({ A: "a1" });
  });

  it("session.history preserves an in-flight streaming message that hasn't been persisted yet, instead of wiping it", () => {
    // Simulates switching into (or a split pane loading) a session whose
    // turn is still streaming: the DB-backed history reply can't include the
    // not-yet-persisted assistant reply, so the handler must splice the
    // locally-accumulated streaming message back in rather than dropping it.
    resetChatState({
      sessionId: "A",
      messagesBySession: { A: [assistantMsg("a1", { text: "still typing", streaming: true })] },
      streamingMessageIdBySession: { A: "a1" },
    });

    handleServerMessage({
      type: "session.history",
      sessionId: "A",
      messages: [{ id: "u1", role: "user", text: "hi" }],
    });

    const state = usePerchStore.getState();
    expect(state.messagesBySession.A!.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(state.messagesBySession.A![1]!.text).toBe("still typing");
    expect(state.streamingMessageIdBySession.A).toBe("a1");
  });
});

describe("durable workspace navigation", () => {
  const project = (id: string, hostId = "local", path = `/projects/${id}`) => ({
    id,
    hostId,
    name: id,
    path,
    favorite: false,
    archived: false,
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

it("a CLI launch preserves an inherited CLI mode and only overrides Hosted", () => {
  usePerchStore.setState({ connected: true, sessionId: null, sessions: [], messages: [], sessionModes: {}, activeHostId: "local", serverInfo: {
    hostname: "test", isSsh: false, platform: "test", capabilities: ["session.mode.get", "session.mode.set"],
  } });
  const deviceId = usePerchStore.getState().deviceId;
  for (const [sessionId, inheritedMode] of [["launch-inherits", "cli"], ["launch-overrides", "hosted"]] as const) {
    FakeWebSocket.sent = [];
    usePerchStore.getState().createSessionOnHost("local", "/tmp/launch-mode", "pi", "cli");
    handleServerMessage({ type: "session.created", sessionId });
    const get = FakeWebSocket.sent.map((text) => JSON.parse(text)).find((message) => message.type === "session.mode.get");
    expect(get).toBeDefined();
    handleServerMessage({ type: "session.mode", requestId: get.requestId, sessionId, deviceId, mode: inheritedMode, scope: "device", revision: 1 });
    const set = FakeWebSocket.sent.map((text) => JSON.parse(text)).find((message) => message.type === "session.mode.set");
    if (inheritedMode === "cli") {
      expect(set).toBeUndefined();
      expect(usePerchStore.getState().sessionModes[sessionId]).toMatchObject({ mode: "cli", scope: "device", state: "ready" });
    } else {
      expect(set).toMatchObject({ mode: "cli", scope: "session", sessionId });
      handleServerMessage({ type: "session.mode", requestId: set.requestId, sessionId, deviceId, mode: "cli", scope: "session", revision: 2 });
      expect(usePerchStore.getState().sessionModes[sessionId]).toMatchObject({ mode: "cli", scope: "session", state: "ready" });
    }
  }
});
