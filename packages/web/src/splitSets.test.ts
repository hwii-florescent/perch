import { describe, expect, it } from "vitest";
import { gapped, joinSplit, layout, leaveSplit, MAX_SPLIT, MIN_PANE_PX, PANE_GAP_PX, storeSizes, visibleSplit } from "./splitSets";

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

describe("gapped", () => {
  const box = { width: 1000, height: 600 };

  it("leaves a lone pane flush with the canvas", () => {
    expect(gapped({ x: 0, y: 0, w: 1000, h: 600 }, box)).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
  });

  it("puts the gap between two side-by-side panes and keeps the outer edges flush", () => {
    const { panes } = layout({ dir: "row", kids: ["a", "b"], sizes: [0.4, 0.6] }, { x: 0, y: 0, w: 1000, h: 600 }, { round: true });
    const a = gapped(panes.get("a")!, box);
    const b = gapped(panes.get("b")!, box);
    expect(a).toEqual({ x: 0, y: 0, w: 400 - PANE_GAP_PX / 2, h: 600 });
    expect(b.x - (a.x + a.w)).toBe(PANE_GAP_PX);
    expect(b.x + b.w).toBe(1000);
  });

  it("gaps every inner edge of a nested layout and never a canvas edge", () => {
    const tree = { dir: "row" as const, kids: ["a", { dir: "col" as const, kids: ["b", "c"], sizes: [0.5, 0.5] }], sizes: [0.5, 0.5] };
    const { panes } = layout(tree, { x: 0, y: 0, w: 1000, h: 600 }, { round: true });
    const [a, b, c] = ["a", "b", "c"].map((id) => gapped(panes.get(id)!, box));
    expect(a!.x).toBe(0);
    expect(a!.y).toBe(0);
    expect(a!.y + a!.h).toBe(600);
    expect(b!.y).toBe(0);
    expect(b!.x + b!.w).toBe(1000);
    expect(c!.y - (b!.y + b!.h)).toBe(PANE_GAP_PX);
    expect(c!.y + c!.h).toBe(600);
    expect(b!.x - (a!.x + a!.w)).toBe(PANE_GAP_PX);
  });

  it("keeps at least 48px of any pane visible at the dragged-to minimum", () => {
    const row = { dir: "row" as const, kids: ["a", "b", "c"], sizes: [1 / 3, 1 / 3, 1 / 3] };
    const { panes } = layout(row, { x: 0, y: 0, w: 1000, h: 600 }, { round: true });
    const middle = { ...panes.get("b")!, w: MIN_PANE_PX };
    expect(gapped(middle, box).w).toBeGreaterThanOrEqual(48);
  });

  it("never returns a negative size for a pane thinner than the gap", () => {
    expect(gapped({ x: 500, y: 0, w: 2, h: 600 }, box).w).toBe(0);
  });
});
