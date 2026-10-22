// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionEvent, SessionSummary } from "@perch/shared";
import { handleAttentionMessage, needsYou, openNextAttention, recentUpdates, useAttention, welcomeLine, welcomeSummary } from "./attention";
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
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  useAttention.setState({ events: [], supported: false, open: false, welcome: null });
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
    expect(recentUpdates(events).map((e) => e.id)).toEqual(["done", "exit"]);
  });

  it("summarizes what happened while away without calling silence completion", () => {
    const events = [
      event({ id: "a", count: 3, occurredAt: 100 }),
      event({ id: "old", occurredAt: 10 }),
      event({ id: "seen", occurredAt: 200, read: true }),
      event({ id: "x", kind: "exited", occurredAt: 150 }),
      event({ id: "q", kind: "question", requiresAction: true, occurredAt: 5 }),
    ];
    const sessions = [
      session({ id: "w", status: "running" }),
      session({ id: "stale", status: "running", stale: true }),
      session({ id: "blocked", status: "running", blocked: true }),
    ];
    const hosts = { box: { type: "host.info", hostId: "box", name: "devbox", state: "error" } } as never;
    const summary = welcomeSummary(events, sessions, hosts, 50);
    expect(summary).toEqual({ finished: 3, exited: 1, needsYou: 1, working: 1, unknown: 1, offlineHosts: ["devbox"] });
    expect(welcomeLine(summary)).toBe("3 turns finished · 1 agent exited · 1 still working · 1 status not confirmed · devbox offline");
    expect(welcomeLine(welcomeSummary([], [], {}, 0))).toBeNull();
  });

  it("asks for a snapshot only from a capable host and welcomes on the first one", () => {
    const send = vi.spyOn(socket, "send").mockImplementation(() => {});
    handleAttentionMessage({ type: "server.info", capabilities: [] } as never);
    expect(send).not.toHaveBeenCalled();
    handleAttentionMessage({ type: "server.info", capabilities: ["attention.v1"] } as never);
    expect(send).toHaveBeenCalledWith({ type: "attention.list" });
    // This browser last looked at t=100: only what happened after reopens it.
    localStorage.setItem("perch.attention.seenAt", "100");
    handleAttentionMessage({ type: "attention.snapshot", events: [event({ kind: "question", requiresAction: true, occurredAt: 150 })] });
    expect(useAttention.getState()).toMatchObject({ open: true, welcome: { since: 100 } });
  });

  it("Cmd-Shift-U opens the oldest waiting agent, else the panel", () => {
    const switchSession = vi.fn();
    usePerchStore.setState({ switchSession } as never);
    openNextAttention();
    expect(useAttention.getState().open).toBe(true);
    useAttention.setState({ open: false, events: [event({ id: "late", sessionId: "b", kind: "question", requiresAction: true, occurredAt: 9 }), event({ id: "early", sessionId: "a", kind: "question", requiresAction: true, occurredAt: 1 })] });
    openNextAttention();
    expect(switchSession).toHaveBeenCalledWith("a");
    expect(useAttention.getState().open).toBe(false);
  });
});
