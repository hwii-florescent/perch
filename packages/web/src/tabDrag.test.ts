// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { dropSplit, layout, leaveSplit, planDrop, storeSizes, swapPanes, visibleSplit, MAX_SPLIT, type SplitSet } from "./splitSets";
import { moveBeside, moveTab } from "./tabOrder";
import { insertIndex, resolveZone, zoneBox } from "./tabDrag";

const box = { left: 100, top: 50, width: 400, height: 200 };

describe("resolveZone", () => {
  it("picks the nearest side and leaves the middle alone", () => {
    expect(resolveZone(box, { x: 110, y: 150 })).toBe("left");
    expect(resolveZone(box, { x: 490, y: 150 })).toBe("right");
    expect(resolveZone(box, { x: 300, y: 55 })).toBe("up");
    expect(resolveZone(box, { x: 300, y: 245 })).toBe("down");
    expect(resolveZone(box, { x: 300, y: 150 })).toBeNull();
  });

  it("a zone's box is the half on that side", () => {
    expect(zoneBox(box, "left")).toEqual({ left: 100, top: 50, width: 200, height: 200 });
    expect(zoneBox(box, "down")).toEqual({ left: 100, top: 150, width: 400, height: 100 });
  });
});

describe("tab order moves", () => {
  it("insertIndex counts the tabs left of the pointer, so past the last tab is the end", () => {
    expect(insertIndex([50, 150, 250], 10)).toBe(0);
    expect(insertIndex([50, 150, 250], 200)).toBe(2);
    expect(insertIndex([50, 150, 250], 900)).toBe(3);
  });

  it("moveTab moves to an index of the others; moveBeside lands next to the target", () => {
    expect(moveTab(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(moveTab(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveBeside(["a", "b", "c"], "a", "c", false)).toEqual(["b", "a", "c"]);
    expect(moveBeside(["a", "b", "c"], "c", "a", true)).toEqual(["a", "c", "b"]);
  });
});

describe("dropSplit", () => {
  it("splits a lone pane toward the side dropped on, in either direction", () => {
    expect(planDrop([], "b", "a", "left")).toMatchObject({ ids: ["b", "a"], dir: "row" });
    expect(planDrop([], "b", "a", "down")).toMatchObject({ ids: ["a", "b"], dir: "col" });
    expect(dropSplit([], "b", "a", "up")[0]).toMatchObject({ ids: ["b", "a"], dir: "col" });
  });

  it("moving a member across the axis turns a pair; along it, the set stays flat", () => {
    const pair: SplitSet[] = [{ ids: ["a", "b"], sizes: [0.5, 0.5] }];
    expect(dropSplit(pair, "b", "a", "down")[0]).toMatchObject({ ids: ["a", "b"], dir: "col" });
    const three: SplitSet[] = [{ ids: ["a", "b", "c"], sizes: [], dir: "row" }];
    expect(planDrop(three, "d", "a", "right")).toMatchObject({ ids: ["a", "d", "b", "c"], dir: "row" });
    expect(planDrop(three, "d", "a", "right")?.tree).toBeUndefined();
  });

  it("a side across the set's axis nests: split side by side, then stack one pane", () => {
    const pair: SplitSet[] = [{ ids: ["a", "b"], sizes: [0.5, 0.5], dir: "row" }];
    const [set] = dropSplit(pair, "c", "b", "down");
    expect(set).toMatchObject({ ids: ["a", "b", "c"], dir: "row" });
    expect(set!.tree).toEqual({ dir: "row", kids: ["a", { dir: "col", kids: ["b", "c"], sizes: [0.5, 0.5] }], sizes: [0.5, 0.5] });
    // The nested layout is laid out by the tree, not the strip.
    const split = visibleSplit([set!], ["c", "b", "a"], "a")!;
    expect(split).toMatchObject({ ids: ["a", "b", "c"], nested: true });
    const { panes } = layout(split.tree, { x: 0, y: 0, w: 100, h: 60 });
    expect(panes.get("a")).toEqual({ x: 0, y: 0, w: 50, h: 60 });
    expect(panes.get("b")).toEqual({ x: 50, y: 0, w: 50, h: 30 });
    expect(panes.get("c")).toEqual({ x: 50, y: 30, w: 50, h: 30 });
  });

  it("nests inside a nested set, merges same-direction siblings, and unwinds when a pane leaves", () => {
    const nested = dropSplit([{ ids: ["a", "b"], sizes: [0.5, 0.5], dir: "row" }], "c", "b", "down");
    // Along the inner column: a sibling of b, not another level.
    const four = dropSplit(nested, "d", "c", "down")[0]!;
    expect(four.tree).toMatchObject({ kids: ["a", { dir: "col", kids: ["b", "c", "d"] }] });
    // Across it, beside c: a row inside the column.
    const deeper = dropSplit(nested, "d", "c", "right")[0]!;
    expect(deeper.tree).toMatchObject({ kids: ["a", { dir: "col", kids: ["b", { dir: "row", kids: ["c", "d"] }] }] });
    // Leaving collapses what is left alone, and a set of one dissolves.
    expect(leaveSplit(nested, "c")[0]).toMatchObject({ ids: ["a", "b"], dir: "row" });
    expect(leaveSplit(nested, "c")[0]!.tree).toBeUndefined();
    expect(leaveSplit(leaveSplit(nested, "c"), "a")).toEqual([]);
    // Dragging a member of a nested set to a side of another keeps one set.
    expect(dropSplit(nested, "a", "c", "down")[0]).toMatchObject({ ids: ["b", "c", "a"], dir: "col" });
  });

  it("swaps two panes in a nested layout, and resizes the strip at a path", () => {
    const nested = dropSplit([{ ids: ["a", "b"], sizes: [0.5, 0.5], dir: "row" }], "c", "b", "down");
    expect(swapPanes(nested, "a", "c")[0]!.tree).toMatchObject({ kids: ["c", { kids: ["b", "a"] }] });
    const resized = storeSizes(nested, ["a", "b", "c"], [0.25, 0.75], [1])[0]!;
    expect(resized.tree).toMatchObject({ sizes: [0.5, 0.5], kids: ["a", { sizes: [0.25, 0.75] }] });
  });

  it("a hidden member's pane collapses with the others keeping their share", () => {
    const nested = dropSplit([{ ids: ["a", "b"], sizes: [0.5, 0.5], dir: "row" }], "c", "b", "down");
    expect(visibleSplit(nested, ["a", "b"], "a")).toMatchObject({ ids: ["a", "b"], dir: "row", nested: false });
  });

  it("refuses a full set and itself, but any two tabs (two terminals too) can share a split", () => {
    const full: SplitSet[] = [{ ids: Array.from({ length: MAX_SPLIT }, (_, i) => `t${i}`), sizes: [] }];
    expect(planDrop(full, "x", "t0", "right")).toBeNull();
    expect(planDrop([], "a", "a", "right")).toBeNull();
    expect(planDrop([], "session-2", "session-1", "right")).toMatchObject({ ids: ["session-1", "session-2"], dir: "row" });
  });

  it("takes the tab out of the set it was in", () => {
    const sets: SplitSet[] = [{ ids: ["a", "b", "c"], sizes: [] }, { ids: ["x", "y"], sizes: [] }];
    const next = dropSplit(sets, "b", "x", "right");
    expect(next.map((set) => set.ids)).toEqual([["a", "c"], ["x", "b", "y"]]);
  });

  it("a stacked set lays out top to bottom in strip order", () => {
    const sets = dropSplit([], "b", "a", "down");
    expect(visibleSplit(sets, ["a", "b"], "a")).toMatchObject({ ids: ["a", "b"], dir: "col" });
  });
});
