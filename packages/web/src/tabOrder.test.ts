import { describe, it, expect, beforeEach } from "vitest";
import { applyStoredTabOrder, saveTabOrder } from "./tabOrder";

// No jsdom: a minimal in-memory localStorage stub is enough to exercise the
// real read/write path (rather than only ever hitting the try/catch
// fallback that fires when localStorage is unavailable).
class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new FakeStorage();
});

interface Item {
  id: string;
}

describe("applyStoredTabOrder", () => {
  it("returns sessions unchanged (in createdAt order) when nothing is stored", () => {
    const sessions: Item[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(applyStoredTabOrder("proj1", sessions)).toEqual(sessions);
  });

  it("reorders sessions according to a saved order", () => {
    saveTabOrder("proj1", ["c", "a", "b"]);
    const sessions: Item[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const result = applyStoredTabOrder("proj1", sessions);
    expect(result.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("appends new sessions (not in the stored order) after the ordered ones, in their given order", () => {
    saveTabOrder("proj1", ["b", "a"]);
    const sessions: Item[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const result = applyStoredTabOrder("proj1", sessions);
    expect(result.map((s) => s.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("silently drops stored ids for sessions that no longer exist", () => {
    saveTabOrder("proj1", ["z", "a", "y", "b"]);
    const sessions: Item[] = [{ id: "a" }, { id: "b" }];
    const result = applyStoredTabOrder("proj1", sessions);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("keys storage per project — one project's order doesn't leak into another's", () => {
    saveTabOrder("projA", ["b", "a"]);
    const sessions: Item[] = [{ id: "a" }, { id: "b" }];
    expect(applyStoredTabOrder("projB", sessions)).toEqual(sessions);
    expect(applyStoredTabOrder("projA", sessions).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("falls back to given order when localStorage is unavailable", () => {
    (globalThis as { localStorage?: unknown }).localStorage = undefined;
    const sessions: Item[] = [{ id: "a" }, { id: "b" }];
    expect(applyStoredTabOrder("proj1", sessions)).toEqual(sessions);
  });

  it("falls back to given order when the stored value is corrupt JSON", () => {
    (globalThis.localStorage as unknown as FakeStorage).setItem("perch.tabOrder.proj1", "{not json");
    const sessions: Item[] = [{ id: "a" }, { id: "b" }];
    expect(applyStoredTabOrder("proj1", sessions)).toEqual(sessions);
  });

  it("falls back to given order when the stored value is valid JSON but not an array of strings", () => {
    (globalThis.localStorage as unknown as FakeStorage).setItem(
      "perch.tabOrder.proj1",
      JSON.stringify({ not: "an array" }),
    );
    const sessions: Item[] = [{ id: "a" }, { id: "b" }];
    expect(applyStoredTabOrder("proj1", sessions)).toEqual(sessions);
  });
});
