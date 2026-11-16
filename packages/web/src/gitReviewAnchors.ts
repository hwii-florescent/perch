//! Where a review comment sits on a diff, as `stock:review` places it: the path of a file on a side, a line's side and
//! number, and whether every server-owned anchor coordinate of a comment (path, side, target, revision, range)
//! still describes the diff on show. Used by the web `DiffView` (`components/GitDiffView.tsx`); the native client
//! ports the same rules (`crates/perch-native/src/diff/rows.rs`). `review.tsx` keeps its own copies, as a stock
//! screen imports only the SDK.
import type { GitDiffFile, GitDiffLine, GitDiffTarget, ReviewComment } from "@perch/shared";
import type { GitDiffSnapshot, ReviewSide } from "./components/gitReviewModels";

export function targetKey(target: GitDiffTarget): string {
  return target.kind === "compare" ? `compare:${target.base}:${target.head ?? ""}` : target.kind;
}

export function filePath(file: GitDiffFile): string {
  return file.newPath ?? file.oldPath ?? "(unknown file)";
}

export function filePathForSide(file: GitDiffFile, side: ReviewSide): string {
  if (side === "old") return file.oldPath ?? file.newPath ?? "(unknown file)";
  return file.newPath ?? file.oldPath ?? "(unknown file)";
}

export function lineNumber(line: GitDiffLine, side: ReviewSide): number | undefined {
  if (side === "old") return line.oldLine;
  if (side === "new") return line.newLine;
  return line.newLine ?? line.oldLine;
}

export function lineSide(line: GitDiffLine): ReviewSide {
  return line.kind === "deletion" ? "old" : "new";
}

export function statusSymbol(kind: GitDiffLine["kind"]): string {
  if (kind === "addition") return "+";
  if (kind === "deletion") return "−";
  return " ";
}

function sourceRevisionFor(diff: GitDiffSnapshot, path: string, side: ReviewSide): string | undefined {
  const revisions = diff.sourceRevisions;
  if (revisions) return revisions[`${path}:${side}`] ?? revisions[`${side}:${path}`] ?? revisions[path] ?? diff.sourceRevision;
  return diff.sourceRevision;
}

function anchorMatchesComment(comment: ReviewComment): boolean {
  return comment.anchor.path === comment.path
    && comment.anchor.side === comment.side
    && targetKey(comment.anchor.base) === targetKey(comment.base)
    && comment.anchor.baseRevision === comment.baseRevision
    && comment.anchor.range.start === comment.range.start
    && comment.anchor.range.end === comment.range.end;
}

/** Every server-owned anchor coordinate of `comment` still describes `diff` (path and line alone are not enough:
 * the same line can exist in working-tree, staged, HEAD and compare snapshots at once). */
export function commentMatchesDiff(comment: ReviewComment, diff: GitDiffSnapshot | null): boolean {
  if (!diff || comment.status === "stale" || comment.status === "orphaned" || comment.anchorConfidence === "none") return false;
  if (comment.side === "file") return false;
  if (targetKey(comment.base) !== targetKey(diff.target) || !anchorMatchesComment(comment)) return false;
  const revision = sourceRevisionFor(diff, comment.path, comment.side);
  return Boolean(revision && comment.baseRevision === revision);
}

/** `comment` is drawn under line `line` of `path` on `side` (a comment over several lines under each of them). */
export function isCommentOnLine(comment: ReviewComment, path: string, side: ReviewSide, line: number, diff: GitDiffSnapshot | null): boolean {
  return commentMatchesDiff(comment, diff)
    && comment.path === path
    && comment.side === side
    && line >= comment.range.start
    && line <= comment.range.end;
}
