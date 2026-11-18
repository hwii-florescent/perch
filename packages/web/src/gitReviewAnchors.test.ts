import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@perch/shared";
import type { GitDiffSnapshot } from "./components/gitReviewModels";
import { commentMatchesDiff, isCommentOnLine, lineSide } from "./gitReviewAnchors";

const diff = { workspaceId: "w", target: { kind: "workingTree" }, files: [], hunkCount: 0, truncated: false, sourceRevision: "rev" } as unknown as GitDiffSnapshot;

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
  const range = { start: 2, end: 4 };
  return {
    id: "c", workspaceId: "w", path: "a.rs", base: { kind: "workingTree" }, baseRevision: "rev", side: "new", range, body: "b",
    anchor: { path: "a.rs", side: "new", base: { kind: "workingTree" }, baseRevision: "rev", range, before: [], selected: [], after: [] },
    status: "unresolved", anchorConfidence: "exact", createdAt: 0, updatedAt: 0, version: 1, ...over,
  } as ReviewComment;
}

describe("review comment placement", () => {
  it("places a comment under every line of its range on its side", () => {
    expect([1, 2, 3, 4, 5].map((n) => isCommentOnLine(comment(), "a.rs", "new", n, diff))).toEqual([false, true, true, true, false]);
    expect(isCommentOnLine(comment(), "a.rs", "old", 2, diff)).toBe(false);
  });
  it("needs every anchor coordinate to describe the diff", () => {
    expect(commentMatchesDiff(comment(), diff)).toBe(true);
    expect(commentMatchesDiff(comment({ status: "stale" }), diff)).toBe(false);
    expect(commentMatchesDiff(comment({ baseRevision: "older" }), diff)).toBe(false);
    expect(commentMatchesDiff(comment({ base: { kind: "staged" } } as Partial<ReviewComment>), diff)).toBe(false);
    expect(commentMatchesDiff(comment(), { ...diff, sourceRevisions: { "a.rs:new": "rev" }, sourceRevision: "other" })).toBe(true);
    expect(commentMatchesDiff(comment(), null)).toBe(false);
  });
  it("puts a deletion on the old side", () => {
    expect(lineSide({ kind: "deletion", content: "", oldLine: 1 } as never)).toBe("old");
    expect(lineSide({ kind: "context", content: "", oldLine: 1, newLine: 1 } as never)).toBe("new");
  });
});
