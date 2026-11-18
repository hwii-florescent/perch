// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage, SessionSummary } from "@perch/shared";

const transport = vi.hoisted(() => ({ sent: [] as unknown[], handlers: [] as ((message: ServerMessage) => void)[] }));
vi.mock("./ws", () => ({
  socket: {
    connected: true,
    connect: () => {},
    send: (message: unknown) => transport.sent.push(message),
    onMessage: (handler: (message: ServerMessage) => void) => { transport.handlers.push(handler); return () => {}; },
    onConnectionChange: () => () => {},
  },
}));

import { usePerchStore } from "./store";
import { useFileTabs } from "./fileTabs";
import { useSplitSets } from "./splitSets";
import { workspaceTabs } from "./workspaceTabs";
import { mergeTabs, shareable } from "./sharedTabs";

const session = (id: string, createdAt: number) => ({ id, title: id, cwd: "/p", createdAt, status: "idle", workspaceId: "w1" }) as SessionSummary;
const workspace = { id: "w1", projectId: "p", hostId: "local", path: "/p", name: "w1", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
const fileX = "w1\nsrc/x.rs";
const fileY = "w1\nsrc/y.rs";
const review = "w1\n\0review";
const strip = () => workspaceTabs(usePerchStore.getState(), useFileTabs.getState().tabs).map((entry) => entry.id);
const tabs = (revision: number, ids: string[], sets: unknown[] = [], conflict = false) =>
  transport.handlers.forEach((handle) => handle({ type: "workspace.tabs", workspaceId: "w1", revision, strip: ids, sets, ...(conflict ? { conflict } : {}) } as ServerMessage));

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
  transport.sent = [];
  useFileTabs.setState({ tabs: [{ workspaceId: "w1", path: "old.rs" }], active: null });
  useSplitSets.setState({ sets: [] });
  usePerchStore.setState({
    sessions: [session("a", 1), session("b", 2)],
    sessionId: "a",
    activeHostId: "local",
    activeWorkspaceId: "w1",
    workspaces: [workspace],
    serverInfo: { capabilities: ["workspace.tabs.v1"] } as never,
  });
});
afterEach(() => vi.useRealTimers());

describe("shared tabs", () => {
  it("draws the core's tabs, writes this device's changes and merges a change made elsewhere", () => {
    // The core's tabs replace what this device had from before.
    tabs(1, ["a", fileX, "b"], [{ ids: ["a", fileX], sizes: [0.5, 0.5] }]);
    expect(strip()).toEqual(["a", fileX, "b"]);
    expect(useSplitSets.getState().sets).toEqual([{ ids: ["a", fileX], sizes: [0.5, 0.5] }]);
    vi.advanceTimersByTime(1000);
    expect(transport.sent).toEqual([]); // nothing differs from the core

    // A tab opened here is written against the revision this device saw.
    useFileTabs.getState().open("w1", "", "review");
    vi.advanceTimersByTime(1000);
    expect(transport.sent).toMatchObject([{ type: "workspace.tabs.set", workspaceId: "w1", baseRevision: 1, strip: ["a", fileX, "b", review] }]);

    // Meanwhile the phone closed x and opened y: both changes survive the merge, and it is written again.
    tabs(2, ["a", "b", fileY], [], true);
    expect(strip()).toEqual(["a", "b", review, fileY]); // the review stays after the tab it followed here
    expect(useSplitSets.getState().sets).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(transport.sent.at(-1)).toMatchObject({ baseRevision: 2, strip: ["a", "b", review, fileY] });
  });

  it("keeps a mod tab and a terminal's tab on this device", () => {
    expect(shareable("w1", fileX)).toBe(true);
    expect(shareable("w1", "w1\n\0mod\nnotes:1")).toBe(false);
    expect(shareable("w1", "term:a:L3RtcA\nx")).toBe(false);
    const local = { strip: ["a", "w1\n\0mod\nnotes:1", fileX], sets: [] };
    const remote = { strip: ["a", fileY], sets: [] };
    const shared = (id: string) => shareable("w1", id);
    // First state of a connection: the core wins, the mod tab keeps its place.
    expect(mergeTabs({ strip: ["a", fileX], sets: [] }, local, remote, shared).strip).toEqual(["a", "w1\n\0mod\nnotes:1", fileY]);
  });

  it("takes this device's order when it moved tabs, and the core's additions after their neighbour", () => {
    const base = { strip: ["a", "b", fileX], sets: [] };
    const local = { strip: [fileX, "a", "b"], sets: [] };
    const remote = { strip: ["a", fileY, "b", fileX], sets: [] };
    expect(mergeTabs(base, local, remote, () => true).strip).toEqual([fileX, "a", fileY, "b"]);
  });
});
