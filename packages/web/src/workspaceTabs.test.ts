// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { fileTabKey } from "./fileTabs";
import { saveTabOrder, storedTabOrder } from "./tabOrder";
import { usePerchStore } from "./store";
import { saveTabStrip, tabOrderKey, workspaceTabs } from "./workspaceTabs";

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, value); }
  removeItem(key: string) { this.store.delete(key); }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
});

const session = (id: string, createdAt: number) => ({ id, title: id, cwd: "/p", createdAt, status: "idle", workspaceId: "w1" }) as SessionSummary;
const workspace = (id: string) => ({ id, projectId: "p", hostId: "local", path: "/p", name: id, dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 });
const nav = (sessionId = "a") => ({
  sessions: [session("a", 1), session("b", 2)],
  sessionId,
  activeHostId: "local",
  activeProject: null,
  activeWorkspaceId: "w1",
  workspaces: [workspace("w1")],
});
const file = { workspaceId: "w1", path: "src/x.rs" };
const review = { workspaceId: "w1", path: "", kind: "review" as const };

describe("workspaceTabs", () => {
  it("lists sessions by creation, then resources by opening", () => {
    expect(workspaceTabs(nav(), [file, review]).map((e) => e.id)).toEqual(["a", "b", fileTabKey(file), fileTabKey(review)]);
  });

  it("applies one stored order across sessions and resources", () => {
    saveTabOrder(tabOrderKey(nav())!, [fileTabKey(file), "b", "a"]);
    expect(workspaceTabs(nav(), [file, review]).map((e) => e.id)).toEqual([fileTabKey(file), "b", "a", fileTabKey(review)]);
  });

  it("leaves out another workspace's resources", () => {
    expect(workspaceTabs(nav(), [{ workspaceId: "w2", path: "y" }]).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("never collides a review with a file of the same workspace", () => {
    expect(fileTabKey(review)).not.toBe(fileTabKey({ workspaceId: "w1", path: "" }));
  });

  describe("with the core's chat order", () => {
    const withCore = (sessions: string[]) => ({ ...nav(), workspaceOrderByHost: { local: { projects: [], sessions } } });

    it("refills the session slots in core order and leaves file tabs in place", () => {
      expect(workspaceTabs(withCore(["b", "a"]), [file, review]).map((e) => e.id)).toEqual(["b", "a", fileTabKey(file), fileTabKey(review)]);
      saveTabOrder(tabOrderKey(nav())!, [fileTabKey(file), "a", "b"]);
      expect(workspaceTabs(withCore(["b", "a"]), [file, review]).map((e) => e.id)).toEqual([fileTabKey(file), "b", "a", fileTabKey(review)]);
    });

    it("is exactly today's strip when the core has no order for this host", () => {
      const other = { ...nav(), workspaceOrderByHost: { remote: { projects: [], sessions: ["b", "a"] } } };
      expect(workspaceTabs(other, [file]).map((e) => e.id)).toEqual(["a", "b", fileTabKey(file)]);
    });
  });
});

describe("saveTabStrip", () => {
  const setOrder = vi.fn();
  beforeEach(() => {
    setOrder.mockClear();
    usePerchStore.setState({ ...nav(), sessions: [session("a", 1), session("b", 2), session("c", 3)], setWorkspaceOrder: setOrder, workspaceOrderByHost: {} });
  });
  const key = () => tabOrderKey(usePerchStore.getState())!;

  it("sends the core a new chat order when a strip drag reorders chats", () => {
    saveTabStrip(key(), ["c", "a", "b"]);
    expect(storedTabOrder(key())).toEqual(["c", "a", "b"]);
    expect(setOrder).toHaveBeenCalledWith("local", { sessions: ["c", "a", "b"] });
  });

  it("leaves the other chats' places alone when only some move", () => {
    usePerchStore.setState({ workspaceOrderByHost: { local: { projects: [], sessions: ["c", "x", "b", "a"] } } });
    // Strip shows c, b, a (core order); swap b and a.
    saveTabStrip(key(), ["c", "a", "b"]);
    expect(setOrder).toHaveBeenCalledWith("local", { sessions: ["c", "a", "b"] });
  });

  it("does not touch the core when only a file tab moved", () => {
    saveTabStrip(key(), [fileTabKey(file), "a", "b", "c"]);
    expect(setOrder).not.toHaveBeenCalled();
    expect(storedTabOrder(key())).toEqual([fileTabKey(file), "a", "b", "c"]);
  });
});
