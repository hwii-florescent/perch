// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { fileTabKey } from "./fileTabs";
import { saveTabOrder, storedTabOrder } from "./tabOrder";
import { usePerchStore } from "./store";
import { moveChat, saveTabStrip, tabOrderKey, workspaceTabs } from "./workspaceTabs";

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
    // Strip shows c, b, a (core order); swap b and a. x (a chat this viewer does not know) keeps its place.
    saveTabStrip(key(), ["c", "a", "b"]);
    expect(setOrder).toHaveBeenCalledWith("local", { sessions: ["c", "x", "a", "b"] });
  });

  it("does not touch the core when only a file tab moved", () => {
    saveTabStrip(key(), [fileTabKey(file), "a", "b", "c"]);
    expect(setOrder).not.toHaveBeenCalled();
    expect(storedTabOrder(key())).toEqual([fileTabKey(file), "a", "b", "c"]);
  });
});

describe("scoped writes: a move only touches the workspaces it involves", () => {
  const chat = (id: string, createdAt: number, workspaceId: string) => ({ ...session(id, createdAt), workspaceId }) as SessionSummary;
  const sessions = [chat("a1", 1, "w1"), chat("a2", 2, "w1"), chat("a3", 3, "w1"), chat("b1", 4, "w2"), chat("b2", 5, "w2"), chat("b3", 6, "w2")];
  const strip = (workspaceId: string) => workspaceTabs({ ...usePerchStore.getState(), activeWorkspaceId: workspaceId }, []).map((entry) => entry.id);
  const core = () => usePerchStore.getState().workspaceOrderByHost.local?.sessions;
  const key = (workspaceId: string) => tabOrderKey({ ...usePerchStore.getState(), activeWorkspaceId: workspaceId })!;
  beforeEach(() => {
    // The store applies the write as the real one does, so strips can be read back.
    const setWorkspaceOrder = vi.fn((hostId: string, order: { sessions?: string[] }) => usePerchStore.setState({ workspaceOrderByHost: { [hostId]: { projects: [], sessions: order.sessions ?? [] } } }));
    usePerchStore.setState({ ...nav("a1"), sessions, workspaces: [workspace("w1"), workspace("w2")], workspaceOrderByHost: {}, setWorkspaceOrder });
  });

  it("a strip drag in one workspace leaves the other strip identical, custom per-viewer order included", () => {
    saveTabOrder(key("w2"), ["b3", "b1", "b2"]);
    expect(strip("w2")).toEqual(["b3", "b1", "b2"]);
    saveTabStrip(key("w1"), ["a3", "a1", "a2"]);
    expect(strip("w1")).toEqual(["a3", "a1", "a2"]);
    expect(strip("w2")).toEqual(["b3", "b1", "b2"]);
    expect(core()).toEqual(["a3", "a1", "a2"]); // the other workspace stays unlisted
  });

  it("a second strip drag keeps the first workspace's listed place", () => {
    saveTabStrip(key("w1"), ["a3", "a1", "a2"]);
    saveTabStrip(key("w2"), ["b2", "b1", "b3"]);
    expect(strip("w1")).toEqual(["a3", "a1", "a2"]);
    expect(strip("w2")).toEqual(["b2", "b1", "b3"]);
  });

  it("a sidebar move changes only that chat's position in its strip, whatever order the view shows", () => {
    // Shown newest-first (the order that used to reverse every strip); the strip is oldest-first.
    moveChat("a3", "a2", false, ["b3", "b2", "b1", "a3", "a2", "a1"]);
    expect(strip("w1")).toEqual(["a1", "a3", "a2"]);
    expect(strip("w2")).toEqual(["b1", "b2", "b3"]);
    expect(core()).toEqual(["a1", "a3", "a2"]);
  });

  it("starts from the workspace's custom strip order and leaves a listed sibling workspace alone", () => {
    saveTabOrder(key("w1"), ["a2", "a3", "a1"]);
    usePerchStore.setState({ workspaceOrderByHost: { local: { projects: [], sessions: ["b3", "b1", "b2"] } } });
    moveChat("a1", "a2", false, ["a2", "a3", "a1"]);
    expect(strip("w1")).toEqual(["a1", "a2", "a3"]);
    expect(strip("w2")).toEqual(["b3", "b1", "b2"]);
    expect(core()).toEqual(["b3", "b1", "b2", "a1", "a2", "a3"]);
  });

  it("a move across two workspaces changes only those two strips", () => {
    usePerchStore.setState({ sessions: [...sessions, chat("c1", 7, "w3")], workspaces: [workspace("w1"), workspace("w2"), workspace("w3")] });
    moveChat("a2", "b2", true, ["a1", "a2", "a3", "b1", "b2", "b3"]);
    expect(strip("w3")).toEqual(["c1"]);
    expect(strip("w1")).toEqual(["a1", "a3", "a2"]);
    expect(strip("w2")).toEqual(["b1", "b2", "b3"]);
    expect(core()!.indexOf("a2")).toBeGreaterThan(core()!.indexOf("b2"));
    expect(core()).not.toContain("c1");
  });
});
