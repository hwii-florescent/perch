// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { forgetClosedTabs, recordClosedTab, takeClosedTab } from "./closedTabs";
import { isAgentSession, requestCloseSession, useCloseGuard } from "./closeGuard";
import { usePerchStore } from "./store";

const session = (init: Partial<SessionSummary>): SessionSummary => ({
  id: "s", title: "t", cwd: "/p", createdAt: 0, status: "idle", cliProviderId: "claude", ...init,
}) as SessionSummary;

class FakeStorage {
  private store = new Map<string, string>();
  getItem = (key: string) => this.store.get(key) ?? null;
  setItem = (key: string, value: string) => void this.store.set(key, value);
  removeItem = (key: string) => void this.store.delete(key);
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new FakeStorage()); vi.useRealTimers(); useCloseGuard.setState({ pending: null }); });

describe("closed tabs (Cmd+Shift+T)", () => {
  it("returns the newest first, keeps 20 and drops entries older than 7 days", () => {
    for (let i = 0; i < 25; i++) recordClosedTab(session({ cwd: `/p${i}` }));
    expect(takeClosedTab(() => true)?.cwd).toBe("/p24");
    let count = 1;
    while (takeClosedTab(() => true)) count++;
    expect(count).toBe(20);

    vi.useFakeTimers();
    vi.setSystemTime(0);
    recordClosedTab(session({}));
    vi.setSystemTime(8 * 24 * 3_600_000);
    expect(takeClosedTab(() => true)).toBeUndefined();
  });

  it("skips a blank session, skips unusable entries, and forgets a removed birdhouse", () => {
    recordClosedTab(session({ cliProviderId: undefined, cliStarted: false }));
    expect(takeClosedTab(() => true)).toBeUndefined();
    recordClosedTab(session({ cwd: "/keep", projectId: "a" }));
    recordClosedTab(session({ cwd: "/gone", projectId: "b" }));
    forgetClosedTabs("b");
    expect(takeClosedTab((tab) => tab.cwd === "/keep")?.projectId).toBe("a");
  });
});

describe("close warning", () => {
  it("warns for agents, not terminals, and can be switched off", () => {
    expect(isAgentSession(session({ cliProviderId: "claude" }))).toBe(true);
    expect(isAgentSession(session({ cliProviderId: "terminal" }))).toBe(false);
    expect(isAgentSession(session({ cliProviderId: "claude", currentProviderId: "terminal" }))).toBe(false); // the agent has exited

    const deleted: string[] = [];
    usePerchStore.setState({ sessions: [session({ id: "a" }), session({ id: "t", cliProviderId: "terminal" })], deleteSession: (id: string) => { deleted.push(id); } });
    requestCloseSession("t");
    expect(deleted).toEqual(["t"]);
    requestCloseSession("a");
    expect(deleted).toEqual(["t"]);
    expect(useCloseGuard.getState().pending?.id).toBe("a");

    useCloseGuard.setState({ pending: null });
    usePerchStore.setState({ settings: { warnCloseAgent: false } as never });
    requestCloseSession("a");
    expect(deleted).toEqual(["t", "a"]);
  });
});
