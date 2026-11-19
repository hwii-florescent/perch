// @vitest-environment jsdom
import { expect, it } from "vitest";
import type { GitDiffFile, GitDiffLine } from "@perch/sdk";
import { fileSignature, treeWindow } from "./review";

/** A 50,000-line file whose lines count every read of their text. */
function bigFile(): { file: GitDiffFile; reads: () => number } {
  let reads = 0;
  const lines: GitDiffLine[] = Array.from({ length: 50_000 }, (_, i) => ({
    kind: "addition",
    newLine: i + 1,
    get content() { reads += 1; return `line ${i} of a vendored lockfile, about sixty characters long`; },
  }));
  const file: GitDiffFile = {
    oldPath: "Cargo.lock",
    newPath: "Cargo.lock",
    status: "modified",
    isBinary: false,
    hunks: [{ oldStart: 1, oldCount: 0, newStart: 1, newCount: lines.length, header: "@@ -1,0 +1,50000 @@", lines }],
  };
  return { file, reads: () => reads };
}

it("signs a big file from the core's source revisions without reading its lines", () => {
  const { file, reads } = bigFile();
  const revisions = { "Cargo.lock:old": "r1", "Cargo.lock:new": "r2" };
  const signature = fileSignature(file, revisions);
  expect(reads()).toBe(0);
  expect(fileSignature(file, { ...revisions, "Cargo.lock:new": "r3" })).not.toBe(signature);
});

it("falls back to hashing the diff's text when a side has no revision", () => {
  const { file, reads } = bigFile();
  const signature = fileSignature(file, { "Cargo.lock:old": "r1" });
  expect(reads()).toBe(50_000);
  expect(fileSignature(file)).toBe(signature);
});

it("draws a long changes tree only around the view, so a first draw stays inside the native render budget", () => {
  // About half a millisecond of the native client's 50 ms render budget per row: a first draw of 162 changed files
  // (the 24-row guess before measuring) must draw a few dozen rows, not all of them.
  expect(treeWindow(162, 0, 24, 8)).toEqual({ start: 0, end: 40 });
  // A tall drawer, measured: still a bounded window that covers the view.
  const { start, end } = treeWindow(1000, 500, 40, 8);
  expect(start).toBeLessThanOrEqual(500);
  expect(end).toBeGreaterThanOrEqual(540);
  expect(end - start).toBeLessThanOrEqual(64);
  // A short list is drawn whole.
  expect(treeWindow(5, 0, 24, 8)).toEqual({ start: 0, end: 5 });
});
