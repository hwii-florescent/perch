// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionEvent, SessionSummary } from "@perch/shared";
import { certaintyNote, handleAttentionMessage, needsYou, openNextAttention, reasonLabel, useAttention } from "./attention";
import { usePerchStore } from "./store";
import { socket } from "./ws";

const event = (init: Partial<AttentionEvent>): AttentionEvent => ({
  id: init.kind ?? "e", sessionId: "s", agentId: "claude", kind: "finished", requiresAction: false,
  certainty: "verified", summary: "Finished", occurredAt: 0, count: 1, read: false, ...init,
});
const session = (init: Partial<SessionSummary>): SessionSummary => ({
  id: "s", title: "t", cwd: "/p", createdAt: 0, status: "idle", ...init,
}) as SessionSummary;

beforeEach(() => {
  useAttention.setState({ events: [], supported: false });
  vi.restoreAllMocks();
});

describe("Needs You", () => {
  it("lists questions before failures, oldest first, and keeps completions out", () => {
    const events = [
      event({ id: "f", kind: "failed", requiresAction: true, occurredAt: 1 }),
      event({ id: "q2", kind: "question", requiresAction: true, occurredAt: 5 }),
      event({ id: "q1", kind: "question", requiresAction: true, occurredAt: 3 }),
      event({ id: "done", occurredAt: 9 }),
      event({ id: "exit", kind: "exited", occurredAt: 7 }),
    ];
    expect(needsYou(events).map((e) => e.id)).toEqual(["q1", "q2", "f"]);
  });

  it("states the reason and says how sure the core is only when it is not certain", () => {
    expect(reasonLabel(event({ kind: "question", requiresAction: true }))).toBe("Waiting for you");
    expect(reasonLabel(event({ kind: "question", requiresAction: true, certainty: "unconfirmed" }))).toBe("Was waiting for you before restart");
    expect(certaintyNote(event({ certainty: "verified" }))).toBeNull();
    expect(certaintyNote(event({ certainty: "heuristic" }))).toBe("Guessed from terminal output");
  });

  it("asks for a snapshot only from a capable host, and keeps the snapshot's events", () => {
    const send = vi.spyOn(socket, "send").mockImplementation(() => {});
    handleAttentionMessage({ type: "server.info", capabilities: [] } as never);
    expect(send).not.toHaveBeenCalled();
    handleAttentionMessage({ type: "server.info", capabilities: ["attention.v1"] } as never);
    expect(send).toHaveBeenCalledWith({ type: "attention.list" });
    const events = [event({ kind: "question", requiresAction: true })];
    handleAttentionMessage({ type: "attention.snapshot", events });
    expect(useAttention.getState()).toMatchObject({ supported: true, events });
  });

  it("Cmd-Shift-U shows the sidebar and opens the oldest waiting chat, then the next; with none it opens nothing", () => {
    const switchSession = vi.fn();
    usePerchStore.setState({
      switchSession, connected: true, sidebarCollapsed: false, sessionId: "x", hostStates: {},
      sessions: [session({ id: "a" }), session({ id: "b" }), session({ id: "x" })],
    } as never);
    openNextAttention();
    expect(switchSession).not.toHaveBeenCalled();

    useAttention.setState({ events: [event({ id: "late", sessionId: "b", kind: "question", requiresAction: true, occurredAt: 9 }), event({ id: "early", sessionId: "a", kind: "question", requiresAction: true, occurredAt: 1 })] });
    openNextAttention();
    expect(switchSession).toHaveBeenLastCalledWith("a");
    usePerchStore.setState({ sessionId: "a" });
    openNextAttention();
    expect(switchSession).toHaveBeenLastCalledWith("b");
  });

  it("Cmd-Shift-U expands a collapsed sidebar and ignores a chat on an offline host", () => {
    vi.useFakeTimers();
    try {
      const switchSession = vi.fn();
      usePerchStore.setState({
        switchSession, connected: true, sidebarCollapsed: true, sessionId: null,
        hostStates: { box: { type: "host.info", hostId: "box", name: "box", state: "error" } },
        sessions: [session({ id: "r", hostId: "box", status: "running", blocked: true })],
      } as never);
      openNextAttention();
      expect(usePerchStore.getState().sidebarCollapsed).toBe(false);
      expect(switchSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
