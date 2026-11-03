import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { groupByStatus, holdFinished, nextNeeding, sectionOf, sessionsNeedingYou } from "./statusView";

const session = (id: string, init: Partial<SessionSummary> = {}) => ({ id, title: id, cwd: "/p", createdAt: 0, status: "idle", ...init }) as SessionSummary;
const none = new Set<string>();

describe("sectionOf / groupByStatus", () => {
  const blocked = session("blocked", { status: "running", blocked: true });
  const working = session("working", { status: "running" });
  const done = session("done", { unseen: true });
  const idle = session("idle");
  const stale = session("stale", { status: "running", stale: true });

  it("puts each chat in one section and keeps the given order inside it", () => {
    const groups = groupByStatus([idle, working, done, blocked, session("idle2"), session("working2", { status: "running" })], none, null);
    expect(Object.fromEntries(Object.entries(groups).map(([key, list]) => [key, list.map((s) => s.id)]))).toEqual({
      needs: ["blocked"], done: ["done"], working: ["working", "working2"], idle: ["idle", "idle2"],
    });
  });

  it("a chat silent for a long time is idle, never gone or finished", () => {
    expect(sectionOf(stale, none, null)).toBe("idle");
  });

  it("a core attention fact puts the chat in Needs you even when its dot is quiet", () => {
    expect(sectionOf(idle, new Set(["idle"]), null)).toBe("needs");
  });

  it("holds the chat being read in Done, but Needs you and Working win", () => {
    expect(sectionOf(idle, none, "idle")).toBe("done");
    expect(sectionOf(working, none, "working")).toBe("working");
    expect(sectionOf(idle, new Set(["idle"]), "idle")).toBe("needs");
  });
});

describe("holdFinished", () => {
  it("holds a finished chat on screen until you leave it", () => {
    // Opened while Done: reading marks it seen (idle) but the row stays in Done.
    let held = holdFinished(null, "a", undefined, "done");
    expect(held).toBe("a");
    held = holdFinished(held, "a", "done", "idle");
    expect(held).toBe("a");
    // Leaving releases it.
    expect(holdFinished(held, "b", undefined, "idle")).toBeNull();
  });

  it("holds a chat that finishes while you watch, not one that was always idle", () => {
    expect(holdFinished(null, "a", "working", "idle")).toBe("a");
    expect(holdFinished(null, "a", "blocked", "idle")).toBe("a");
    expect(holdFinished(null, "a", "idle", "idle")).toBeNull();
    expect(holdFinished(null, "a", undefined, "idle")).toBeNull();
  });

  it("lets go when the chat starts working again or nothing is open", () => {
    expect(holdFinished("a", "a", "idle", "working")).toBeNull();
    expect(holdFinished("a", null, "idle", undefined)).toBeNull();
    expect(holdFinished("a", "a", "idle", undefined)).toBeNull();
  });
});

describe("sessionsNeedingYou / nextNeeding", () => {
  it("counts only reachable hosts: an offline host's last known state is not an alert", () => {
    const sessions = [session("l", { blocked: true, status: "running" }), session("r", { blocked: true, status: "running", hostId: "box" }), session("q", { hostId: "box" })];
    const needs = new Set(["q"]);
    expect(sessionsNeedingYou(sessions, needs, (host) => host === "local").map((s) => s.id)).toEqual(["l"]);
    expect(sessionsNeedingYou(sessions, needs, () => true).map((s) => s.id)).toEqual(["l", "r", "q"]);
  });

  it("goes to the next one after the open chat, wrapping, and to nothing harmful when there is none", () => {
    expect(nextNeeding([], "a")).toBeNull();
    expect(nextNeeding(["a", "b", "c"], null)).toBe("a");
    expect(nextNeeding(["a", "b", "c"], "a")).toBe("b");
    expect(nextNeeding(["a", "b", "c"], "c")).toBe("a");
    expect(nextNeeding(["a", "b"], "x")).toBe("a");
    expect(nextNeeding(["a"], "a")).toBeNull();
  });
});
