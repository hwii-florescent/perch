import { describe, expect, it } from "vitest";
import { joinSplit, leaveSplit, MAX_SPLIT, storeSizes, visibleSplit } from "./splitSets";

const ids = (sets: { ids: string[] }[]) => sets.map((set) => set.ids);

describe("joinSplit", () => {
  it("makes a two-pane set with equal sizes", () => {
    const sets = joinSplit([], "a", "b");
    expect(ids(sets)).toEqual([["a", "b"]]);
    expect(sets[0]!.sizes).toEqual([0.5, 0.5]);
  });

  it("adds to the anchor's set and re-equalizes", () => {
    const sets = joinSplit(joinSplit([], "a", "b"), "a", "c");
    expect(ids(sets)).toEqual([["a", "b", "c"]]);
    expect(sets[0]!.sizes.every((size) => Math.abs(size - 1 / 3) < 1e-9)).toBe(true);
  });

  it("joins the partner's set when the anchor has none", () => {
    const sets = joinSplit(joinSplit([], "a", "b"), "c", "a");
    expect(ids(sets)).toEqual([["a", "b", "c"]]);
  });

  it("moves a tab out of its old set, dissolving a set left with one", () => {
    const sets = joinSplit(joinSplit(joinSplit([], "a", "b"), "c", "d"), "c", "b");
    expect(ids(sets)).toEqual([["c", "d", "b"]]);
  });

  it("stops at the maximum", () => {
    let sets = joinSplit([], "a", "b");
    for (const id of ["c", "d", "e"]) sets = joinSplit(sets, "a", id);
    expect(sets[0]!.ids).toHaveLength(MAX_SPLIT);
  });
});

describe("leaveSplit", () => {
  it("dissolves a pair and shrinks a bigger set", () => {
    expect(leaveSplit(joinSplit([], "a", "b"), "a")).toEqual([]);
    const three = joinSplit(joinSplit([], "a", "b"), "a", "c");
    expect(ids(leaveSplit(three, "b"))).toEqual([["a", "c"]]);
  });
});

describe("visibleSplit", () => {
  const sets = joinSplit(joinSplit([], "a", "b"), "a", "c");

  it("is the active tab's set", () => {
    expect(visibleSplit(sets, ["a", "b", "c"], "c")?.ids).toEqual(["a", "b", "c"]);
    expect(visibleSplit(sets, ["a", "b", "c", "z"], "z")).toBeNull();
  });

  it("lays members out in the strip's order, not the order they were split in", () => {
    expect(visibleSplit(sets, ["c", "b", "a"], "a")?.ids).toEqual(["c", "b", "a"]);
  });

  it("drops members that no longer exist and renormalizes", () => {
    const split = visibleSplit(sets, ["a", "c"], "a")!;
    expect(split.ids).toEqual(["a", "c"]);
    expect(split.sizes[0]! + split.sizes[1]!).toBeCloseTo(1);
  });

  it("shows a lone survivor alone", () => {
    expect(visibleSplit(sets, ["a"], "a")).toBeNull();
  });
});

describe("storeSizes", () => {
  it("keeps dragged widths for a fully visible set", () => {
    const sets = storeSizes(joinSplit([], "a", "b"), ["a", "b"], [0.3, 0.7]);
    expect(sets[0]!.sizes).toEqual([0.3, 0.7]);
  });
});
