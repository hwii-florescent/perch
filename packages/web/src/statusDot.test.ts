import { describe, it, expect } from "vitest";
import { sessionDotState } from "./statusDot";
import type { SessionSummary } from "@perch/shared";

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s1",
    title: "session",
    cwd: "/tmp",
    createdAt: 0,
    archived: false,
    blocked: false,
    unseen: false,
    status: "idle",
    ...overrides,
  } as SessionSummary;
}

describe("sessionDotState", () => {
  it("is idle when seen and idle", () => {
    expect(sessionDotState(summary())).toBe("idle");
  });

  it("is done when unseen but not running or blocked", () => {
    expect(sessionDotState(summary({ unseen: true }))).toBe("done");
  });

  it("is working when status is running", () => {
    expect(sessionDotState(summary({ status: "running" }))).toBe("working");
  });

  it("is blocked when blocked, regardless of anything else", () => {
    expect(sessionDotState(summary({ blocked: true }))).toBe("blocked");
  });

  // Precedence: blocked > working > done > idle.
  it("blocked wins over running", () => {
    expect(sessionDotState(summary({ blocked: true, status: "running" }))).toBe("blocked");
  });

  it("blocked wins over unseen", () => {
    expect(sessionDotState(summary({ blocked: true, unseen: true }))).toBe("blocked");
  });

  it("running wins over unseen", () => {
    expect(sessionDotState(summary({ status: "running", unseen: true }))).toBe("working");
  });

  it("blocked wins over both running and unseen simultaneously", () => {
    expect(
      sessionDotState(summary({ blocked: true, status: "running", unseen: true })),
    ).toBe("blocked");
  });

  it("a stale busy session reads as idle, or done if unseen", () => {
    expect(sessionDotState(summary({ status: "running", stale: true }))).toBe("idle");
    expect(sessionDotState(summary({ blocked: true, status: "running", stale: true }))).toBe("idle");
    expect(sessionDotState(summary({ status: "running", stale: true, unseen: true }))).toBe("done");
  });
});
