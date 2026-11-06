import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { scopeSessionId, terminalScopeId, workspaceRecord } from "./terminalScope";

const state = {
  workspaces: [
    { id: "w-chats", projectId: "p-chats", hostId: "local", path: "/home/u/.perch/scratch" },
    { id: "w-proj", projectId: "p-proj", hostId: "local", path: "/work/proj" },
  ],
  sessions: [] as SessionSummary[],
} as never as Parameters<typeof terminalScopeId>[0] & Parameters<typeof workspaceRecord>[0];

const session = (over: Partial<SessionSummary>) =>
  ({ id: "s1", workspaceId: "w-chats", hostId: "local", currentCwd: "/home/u/café", currentBranch: "main", createdAt: 1, ...over }) as SessionSummary;

describe("terminalScope", () => {
  it("scopes a terminal only once its shell is known to be outside its workspace's folder", () => {
    expect(terminalScopeId(state, session({ workspaceId: "w-proj", currentCwd: "/work/proj" }))).toBeNull();
    expect(terminalScopeId(state, session({ workspaceId: "w-proj", currentCwd: "/work/proj/src" }))).toMatch(/^term:s1:/);
    expect(terminalScopeId(state, session({ currentCwd: undefined }))).toBeNull();
    expect(terminalScopeId(state, session({ hostId: "box" }))).toBeNull();
    const id = terminalScopeId(state, session({}));
    expect(id).toMatch(/^term:s1:[A-Za-z0-9_-]+$/);
    expect(scopeSessionId(id!)).toBe("s1");
    expect(scopeSessionId("w-chats")).toBeNull();
  });

  it("gives a scope its own row and follows cd to a new scope", () => {
    const first = session({});
    const withSession = { ...state, sessions: [first] };
    const id = terminalScopeId(withSession, first)!;
    const row = workspaceRecord(withSession, id)!;
    expect(row).toMatchObject({ path: "/home/u/café", name: "café", branch: "main", hostId: "local" });
    expect(workspaceRecord(withSession, id)).toBe(row); // stable for selectors
    expect(terminalScopeId(withSession, session({ currentCwd: "/tmp" }))).not.toBe(id);
    expect(workspaceRecord(withSession, "w-proj")?.id).toBe("w-proj");
    expect(workspaceRecord({ ...state, sessions: [] }, id)).toBeUndefined();
  });
});
