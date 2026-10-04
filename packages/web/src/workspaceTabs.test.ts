// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { SessionSummary } from "@perch/shared";
import { fileTabKey } from "./fileTabs";
import { saveTabOrder } from "./tabOrder";
import { tabOrderKey, workspaceTabs } from "./workspaceTabs";

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
});
