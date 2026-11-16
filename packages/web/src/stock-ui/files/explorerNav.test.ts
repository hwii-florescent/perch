import { describe, expect, it } from "vitest";
import type { DirectoryEntry } from "@perch/shared";
import { explorerKey, flattenTree, treeItems, treeWindow } from "./explorerNav";

const entry = (path: string, kind: "file" | "directory" = "file"): DirectoryEntry =>
  ({ name: path.split("/").pop()!, path, kind, size: 0, readonly: false, executable: false }) as DirectoryEntry;
const trees = {
  "": { state: "ready", entries: [entry("src", "directory"), entry("a.txt"), entry("z", "directory")] },
  src: { state: "ready", entries: [entry("src/b.ts"), entry("src/lib", "directory")] },
  z: { state: "loading", entries: [] },
};
const open = new Set(["src", "z"]);

describe("explorer keyboard", () => {
  it("lists expanded, loaded folders in place", () => {
    expect(flattenTree(trees, open).map((row) => row.path)).toEqual(["src", "src/b.ts", "src/lib", "a.txt", "z"]);
    expect(flattenTree(trees, new Set()).map((row) => row.path)).toEqual(["src", "a.txt", "z"]);
  });

  it("arrows move the cursor, never open", () => {
    const rows = flattenTree(trees, open);
    expect(explorerKey(rows, null, "ArrowDown", open)).toEqual({ cursor: "src" });
    expect(explorerKey(rows, "src", "ArrowDown", open)).toEqual({ cursor: "src/b.ts" });
    expect(explorerKey(rows, "src", "ArrowUp", open)).toBeNull();
    expect(explorerKey(rows, "z", "ArrowDown", open)).toBeNull();
    expect(explorerKey(rows, "a.txt", "End", open)).toEqual({ cursor: "z" });
  });

  it("left and right fold and walk the tree", () => {
    const rows = flattenTree(trees, open);
    expect(explorerKey(rows, "src", "ArrowLeft", open)).toEqual({ toggle: "src" });
    expect(explorerKey(rows, "src/b.ts", "ArrowLeft", open)).toEqual({ cursor: "src" });
    expect(explorerKey(rows, "src", "ArrowRight", open)).toEqual({ cursor: "src/b.ts" });
    const closed = new Set<string>();
    expect(explorerKey(flattenTree(trees, closed), "src", "ArrowRight", closed)).toEqual({ toggle: "src" });
    expect(explorerKey(rows, "a.txt", "ArrowRight", open)).toBeNull();
  });

  it("space previews, enter pins, folders toggle", () => {
    const rows = flattenTree(trees, open);
    expect(explorerKey(rows, "a.txt", " ", open)).toEqual({ open: { path: "a.txt", pin: false } });
    expect(explorerKey(rows, "a.txt", "Enter", open)).toEqual({ open: { path: "a.txt", pin: true } });
    expect(explorerKey(rows, "src", "Enter", open)).toEqual({ toggle: "src" });
    expect(explorerKey(rows, "a.txt", "x", open)).toBeNull();
  });

  it("draws the tree's rows flat at their depth, with each folder's state line", () => {
    const rows = treeItems(trees, open).map((item) => `${item.level}:${item.kind}:${item.kind === "entry" ? item.entry.path : item.path}`);
    expect(rows).toEqual(["0:entry:src", "1:entry:src/b.ts", "1:entry:src/lib", "0:entry:a.txt", "0:entry:z", "1:loading:z"]);
    expect(treeItems({ "": { state: "ready", entries: [], truncated: true } }, open).map((item) => item.kind)).toEqual(["truncated", "empty"]);
  });

  it("windows a long tree around the view in chunks", () => {
    expect(treeWindow(30, 0, 36, 16)).toEqual({ start: 0, end: 30 });
    expect(treeWindow(1000, 0, 36, 16)).toEqual({ start: 0, end: 64 });
    expect(treeWindow(1000, 15, 36, 16)).toEqual({ start: 0, end: 80 });
    expect(treeWindow(1000, 120, 36, 16)).toEqual({ start: 96, end: 176 });
    // Every row in view is drawn, wherever the view is.
    for (const top of [0, 7, 15, 16, 100, 500, 963]) {
      const { start, end } = treeWindow(1000, top, 36, 16);
      expect(start <= top && Math.min(1000, top + 36) <= end).toBe(true);
    }
    expect(treeWindow(1000, 5000, 36, 16)).toEqual({ start: 984, end: 1000 });
  });
});
