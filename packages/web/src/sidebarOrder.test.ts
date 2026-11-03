import { describe, expect, it } from "vitest";
import { applySessionOrder, orderBy, orderProjects, refillSlots, stepTarget, writeScope } from "./sidebarOrder";

const row = (id: string, favorite = false) => ({ id, favorite });
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("orderBy", () => {
  it("is the identity without a list", () => {
    const items = [row("a"), row("b")];
    expect(orderBy(items, undefined, (item) => item.id)).toBe(items);
    expect(orderBy(items, [], (item) => item.id)).toBe(items);
  });

  it("puts unknown ids first in the given order, then listed ones in list order, ignoring stale ids", () => {
    const items = [row("new1"), row("a"), row("new2"), row("b"), row("c")];
    expect(ids(orderBy(items, ["c", "gone", "a", "b"], (item) => item.id))).toEqual(["new1", "new2", "c", "a", "b"]);
  });
});

describe("orderProjects", () => {
  it("keeps favourites first and orders inside each group", () => {
    const projects = [row("f1", true), row("f2", true), row("p1"), row("p2")];
    expect(ids(orderProjects(projects, ["p2", "f2", "p1", "f1"]))).toEqual(["f2", "f1", "p2", "p1"]);
  });
});

describe("writeScope", () => {
  it("lists a scope that was unlisted at the end, leaving the rest where it is", () => {
    expect(writeScope(undefined, ["a", "b"])).toEqual(["a", "b"]);
    expect(writeScope(["x", "y"], ["b", "a"])).toEqual(["x", "y", "b", "a"]);
  });

  it("rewrites the listed scope in its own slots; other listed ids keep their place", () => {
    expect(writeScope(["a", "x", "b", "y", "c"], ["c", "a", "b"])).toEqual(["c", "x", "a", "y", "b"]);
  });

  it("puts the scope ids that overflow the old slots right after the last slot, in order", () => {
    expect(writeScope(["a", "x", "b", "y"], ["a", "new", "b"])).toEqual(["a", "x", "new", "b", "y"]);
  });

  it("keeps ids it does not know (a partial view) until the list is long, then drops only dead ones", () => {
    expect(writeScope(["a", "ghost", "b"], ["b", "a"], new Set(["a", "b"]))).toEqual(["b", "ghost", "a"]);
    const long = Array.from({ length: 300 }, (_, i) => `s${i}`);
    const live = new Set(["s0", "s1", "s299", "a"]);
    expect(writeScope(long, ["a"], live)).toEqual(["s0", "s1", "s299", "a"]);
  });

  it("is the identity for a scope already in place", () => {
    expect(writeScope(["a", "x", "b"], ["a", "b"])).toEqual(["a", "x", "b"]);
  });
});

describe("stepTarget", () => {
  it("steps beside the neighbour and stops at the ends", () => {
    expect(stepTarget(["a", "b", "c"], "b", -1)).toEqual({ target: "a", after: false });
    expect(stepTarget(["a", "b", "c"], "b", 1)).toEqual({ target: "c", after: true });
    expect(stepTarget(["a", "b", "c"], "a", -1)).toBeNull();
    expect(stepTarget(["a", "b", "c"], "c", 1)).toBeNull();
    expect(stepTarget(["a"], "x", 1)).toBeNull();
  });
});

describe("refillSlots / applySessionOrder", () => {
  const strip = [{ id: "s1", kind: "session" }, { id: "f", kind: "file" }, { id: "s2", kind: "session" }, { id: "s3", kind: "session" }];
  const isSession = (entry: { kind: string }) => entry.kind === "session";

  it("refills session slots in core order and leaves file tabs where they are", () => {
    expect(ids(applySessionOrder(strip, isSession, ["s3", "s1", "s2"]))).toEqual(["s3", "f", "s1", "s2"]);
  });

  it("is exactly today's strip with no core order", () => {
    expect(applySessionOrder(strip, isSession, undefined)).toBe(strip);
    expect(applySessionOrder(strip, isSession, [])).toBe(strip);
  });

  it("leaves sessions the core does not know in their own slots", () => {
    // s2 is new: it keeps slot 2 while s3 and s1 swap.
    expect(ids(applySessionOrder(strip, isSession, ["s3", "s1"]))).toEqual(["s3", "f", "s2", "s1"]);
  });

  it("refills by an explicit replacement list", () => {
    expect(refillSlots(["x", "a", "y", "b"], (id) => id === "a" || id === "b", ["b", "a"])).toEqual(["x", "b", "y", "a"]);
  });
});
