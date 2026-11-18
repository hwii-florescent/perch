// @vitest-environment jsdom
import { expect, it } from "vitest";
import type { GitDiffFile, GitDiffLine } from "@perch/sdk";
import { fileSignature } from "./review";

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
