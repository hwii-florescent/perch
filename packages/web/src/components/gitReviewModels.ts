/** View-facing aliases for the Rust-owned source-control and review models.
 * The adapter derives only presentation state such as dirty/conflicted
 * counts; paths, line numbers, targets, anchors, and revisions come directly
 * from the shared protocol. */
import type {
  AgentTurnSummary,
  GitDiffFile,
  GitDiffHunk,
  GitDiffLine,
  GitDiffTarget,
  GitFileState,
  GitPreviewReceipt,
  GitStatus,
  GitStatusEntry,
  ReviewAnchor,
  ReviewComment,
  ReviewLineRange,
  ReviewPacket,
  ReviewPacketComment,
  ReviewSide,
  ReviewStatus,
  ReviewDelivery,
} from "@perch/shared";

export type {
  AgentTurnSummary,
  GitDiffFile,
  GitDiffHunk,
  GitDiffLine,
  GitDiffTarget,
  GitFileState,
  GitPreviewReceipt,
  GitStatusEntry,
  ReviewAnchor,
  ReviewComment,
  ReviewLineRange,
  ReviewPacketComment,
  ReviewSide,
  ReviewStatus,
  ReviewDelivery,
};

export interface GitStatusSnapshot extends GitStatus {
  dirty: boolean;
  conflicted: boolean;
}

export interface GitDiffSnapshot {
  workspaceId: string;
  target: GitDiffTarget;
  files: GitDiffFile[];
  hunkCount: number;
  truncated: boolean;
  /** Server-issued content revision for the selected diff source.  This is
   * intentionally separate from GitStatus.head: a review anchor must be
   * checked against the exact target/path bytes that the user saw. */
  sourceRevision?: string;
  /** Some protocol revisions issue one revision per path/side. Keep the
   * adapter forward-compatible while the scalar form remains the common case. */
  sourceRevisions?: Record<string, string>;
}

export type ReviewBatchPreview = ReviewPacket;

export interface ReviewBatchDelivery {
  packetId: string;
  sendOperationId: string;
  delivery: ReviewDelivery;
  targetSessionId?: string;
  targetAgentId?: string;
}

export interface ReviewTargetSession {
  id: string;
  title: string;
  agent?: string;
}

export interface WorkspaceGitReviewActions {
  refreshStatus: () => string | null;
  selectAgentSession: (sessionId?: string) => void;
  loadDiff: (target: GitDiffTarget, path?: string, options?: { includeUntracked: boolean; ignoreWhitespace: boolean; contextLines: number }) => string | null;
  stage: (paths: string[]) => void;
  unstage: (paths: string[]) => void;
  discardPreview: (mode: "worktree" | "staged" | "all", paths: string[]) => Promise<GitPreviewReceipt | null>;
  discard: (previewId: string) => void;
  commitPreview: (message: string) => Promise<GitPreviewReceipt | null>;
  commit: (previewId: string, message: string) => void;
  listComments: () => string | null;
  listRefs: () => string | null;
  createComment: (input: { path: string; side: ReviewSide; start: number; end: number; body: string }) => void;
  updateComment: (commentId: string, body: string, expectedVersion: number) => void;
  resolveComment: (commentId: string, resolved: boolean, expectedVersion: number) => void;
  deleteComment: (commentId: string, expectedVersion: number) => void;
  previewBatch: (input: { sendOperationId: string; targetSessionId?: string; targetAgentId?: string; currentRevision: string; instruction: string }) => Promise<ReviewBatchPreview | null>;
  sendBatch: (packetId: string, sendOperationId: string) => Promise<ReviewBatchDelivery | null>;
}
