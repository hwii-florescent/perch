import { describe, expect, it } from "vitest";
import type { DirectoryEntry } from "@perch/shared";
import { explorerKey, flattenTree } from "./explorerNav";

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
});
