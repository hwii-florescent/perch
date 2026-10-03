import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type {
  AgentTurnSummary,
  GitDiffFile,
  GitDiffLine,
  GitDiffSnapshot,
  GitDiffTarget,
  GitPreviewReceipt,
  GitStatusEntry,
  GitStatusSnapshot,
  ReviewBatchDelivery,
  ReviewBatchPreview,
  ReviewComment,
  ReviewSide,
  ReviewTargetSession,
  WorkspaceGitReviewActions,
} from "./gitReviewModels";
import { newId } from "../ids";
import { cn } from "../lib/cn";

const EYEBROW = "text-accent text-[0.63rem] font-bold tracking-[0.09em] uppercase";
const CONNECTION = "rounded-[999px] border px-[0.42rem] py-[0.18rem] text-[0.7rem] whitespace-nowrap";
const CONNECTION_READY = "text-green border-[color:color-mix(in_srgb,var(--green)_45%,transparent)]";
const CONNECTION_ERROR = "text-red border-[color:color-mix(in_srgb,var(--red)_45%,transparent)]";
const CONNECTION_IDLE = "text-subtext-0 border-[color:var(--git-border)]";
const DIFF_LINE = `relative grid min-w-[44rem] grid-cols-[3.2rem_3.2rem_1.1rem_minmax(30rem,1fr)_auto] items-baseline text-fg [font-family:monospace] text-[0.72rem] leading-[1.45] whitespace-pre [@container(max-width:700px)]:min-w-0 [@container(max-width:700px)]:grid-cols-[2.6rem_2.6rem_1rem_minmax(0,1fr)_auto]`;
// A selected addition/deletion keeps its green/red tint (the legacy rule order); hover tints accent.
const DIFF_LINE_KIND: Record<string, string> = {
  addition: "bg-[color-mix(in_srgb,var(--green)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
  deletion: "bg-[color-mix(in_srgb,var(--red)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
};
const DIFF_LINE_CONTEXT = "hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const DIFF_LINE_SELECTED = "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const LINE_MARKER_TONE: Record<string, string> = { addition: "text-green", deletion: "text-red" };
const BRANCH_DETAIL = "block overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0";
const PATH_BUTTON = "workspace-git__path-button flex min-w-0 flex-1 flex-col items-start gap-[0.08rem] rounded-ui border px-[0.4rem] py-[0.3rem] text-left text-fg [background:none] hover:bg-surface-1";
const PATH_BUTTON_IDLE = "border-transparent";
const PATH_BUTTON_ACTIVE = "border-[color:color-mix(in_srgb,var(--accent)_65%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
// `conflict` keeps its legacy rule in git-review.css (no harness state yet).
const FILE_STATE_TONE: Record<string, string> = { staged: "text-green", untracked: "text-yellow", conflict: "workspace-git__file-state--conflict" };
const LINE_COMMENT_BUTTON = "min-h-[1.8rem] min-w-[1.8rem] self-center rounded-[999px] border border-transparent bg-transparent text-accent opacity-70 hover:border-accent hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:opacity-100";

export interface WorkspaceGitReviewProps {
  workspaceId: string;
  workspaceName?: string;
  startSnapshot?: string;
  agentSessionId?: string;
  /** Newest turn in the selected session or workspace, offered as a diff base. */
  lastAgentTurn?: AgentTurnSummary;
  status: GitStatusSnapshot | null;
  statusState: "idle" | "loading" | "ready" | "error";
  statusError?: string;
  actionError?: string;
  diff: GitDiffSnapshot | null;
  diffState: "idle" | "loading" | "ready" | "error";
  diffError?: string;
  comments: ReviewComment[];
  refs?: Array<{ name: string; target: string; upstream?: string; remote: boolean }>;
  batchDelivery?: ReviewBatchDelivery | null;
  sessions?: ReviewTargetSession[];
  currentRevision?: string;
  actions: WorkspaceGitReviewActions;
}

type ConfirmAction =
  | { kind: "discard"; receipt: GitPreviewReceipt }
  | { kind: "commit"; receipt: GitPreviewReceipt; message: string };

interface LineSelection {
  path: string;
  side: ReviewSide;
  start: number;
  end: number;
}

interface LineAnchor {
  path: string;
  side: ReviewSide;
  line: number;
}

function targetKey(target: GitDiffTarget): string {
  return target.kind === "compare" ? `compare:${target.base}:${target.head ?? ""}` : target.kind;
}

function filePath(file: GitDiffFile): string {
  return file.newPath ?? file.oldPath ?? "(unknown file)";
}

function filePathForSide(file: GitDiffFile, side: ReviewSide): string {
  if (side === "old") return file.oldPath ?? file.newPath ?? "(unknown file)";
  return file.newPath ?? file.oldPath ?? "(unknown file)";
}

function shortHash(value: string | undefined): string {
  return value ? value.slice(0, 8) : "—";
}

function stateLabel(state: GitStatusEntry["index"]): string {
  switch (state) {
    case "untracked": return "untracked";
    case "modified": return "modified";
    case "added": return "added";
    case "deleted": return "deleted";
    case "renamed": return "renamed";
    case "copied": return "copied";
    case "typeChanged": return "type changed";
    case "ignored": return "ignored";
    case "conflicted": return "conflicted";
    case "unmodified": return "clean";
    default: return "changed";
  }
}

function entryState(entry: GitStatusEntry): string {
  if (entry.index === "conflicted" || entry.worktree === "conflicted") return "conflicted";
  if (entry.index === "untracked" && entry.worktree === "untracked") return "untracked";
  if (entry.staged && entry.unstaged) return "staged + modified";
  if (entry.staged) return "staged";
  return stateLabel(entry.worktree === "unmodified" ? entry.index : entry.worktree);
}

function lineNumber(line: GitDiffLine, side: ReviewSide): number | undefined {
  if (side === "old") return line.oldLine;
  if (side === "new") return line.newLine;
  return line.newLine ?? line.oldLine;
}

function lineSide(line: GitDiffLine): ReviewSide {
  if (line.kind === "deletion") return "old";
  return "new";
}

function statusSymbol(line: GitDiffLine["kind"]): string {
  if (line === "addition") return "+";
  if (line === "deletion") return "−";
  return " ";
}

function statusTone(entry: GitStatusEntry): string {
  if (entry.index === "conflicted" || entry.worktree === "conflicted") return "conflict";
  if (entry.index === "untracked" && entry.worktree === "untracked") return "untracked";
  if (entry.staged) return "staged";
  return "changed";
}

function newOperationId(): string {
  return newId();
}

function sourceRevisionFor(diff: GitDiffSnapshot | null | undefined, path: string, side: ReviewSide): string | undefined {
  if (!diff) return undefined;
  const revisions = diff.sourceRevisions;
  if (revisions) {
    return revisions[`${path}:${side}`] ?? revisions[`${side}:${path}`] ?? revisions[path] ?? diff.sourceRevision;
  }
  return diff.sourceRevision;
}

function sameRange(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start === right.start && left.end === right.end;
}

function anchorMatchesComment(comment: ReviewComment): boolean {
  return comment.anchor.path === comment.path
    && comment.anchor.side === comment.side
    && targetKey(comment.anchor.base) === targetKey(comment.base)
    && comment.anchor.baseRevision === comment.baseRevision
    && sameRange(comment.anchor.range, comment.range);
}

/** A comment is eligible for inline rendering only when every server-owned
 * anchor coordinate still describes the selected diff. Path and line alone
 * are insufficient because the same line can exist in working-tree, staged,
 * HEAD, and compare snapshots at once. */
function commentMatchesDiff(comment: ReviewComment, diff: GitDiffSnapshot | null): boolean {
  if (!diff || comment.status === "stale" || comment.status === "orphaned" || comment.anchorConfidence === "none") return false;
  if (comment.side === "file") return false;
  if (targetKey(comment.base) !== targetKey(diff.target) || !anchorMatchesComment(comment)) return false;
  const revision = sourceRevisionFor(diff, comment.path, comment.side);
  return Boolean(revision && comment.baseRevision === revision);
}

function diffContainsCommentLine(comment: ReviewComment, diff: GitDiffSnapshot | null): boolean {
  if (!commentMatchesDiff(comment, diff) || !diff) return false;
  return diff.files.some((file) => {
    const path = filePathForSide(file, comment.side);
    if (path !== comment.path) return false;
    return file.hunks.some((hunk) => hunk.lines.some((line) => {
      if (lineSide(line) !== comment.side) return false;
      const number = lineNumber(line, comment.side);
      return number !== undefined && number >= comment.range.start && number <= comment.range.end;
    }));
  });
}

function isCommentOnLine(comment: ReviewComment, path: string, side: ReviewSide, line: number, diff: GitDiffSnapshot | null): boolean {
  return commentMatchesDiff(comment, diff)
    && comment.path === path
    && comment.side === side
    && line >= comment.range.start
    && line <= comment.range.end;
}

function targetLabel(target: GitDiffTarget): string {
  switch (target.kind) {
    case "workingTree": return "Working tree";
    case "staged": return "Staged";
    case "head": return "HEAD";
    case "compare": return `Compare ${target.base}${target.head ? `…${target.head}` : "…worktree"}`;
  }
}

function placementLabel(comment: ReviewComment, diff: GitDiffSnapshot | null): string {
  if (comment.status === "stale" || comment.status === "orphaned") return `${comment.status} anchor`;
  if (!diff) return "Not shown in this diff";
  if (targetKey(comment.base) !== targetKey(diff.target)) return `Different target · ${targetLabel(comment.base)}`;
  if (!anchorMatchesComment(comment)) return "Anchor metadata needs review";
  const revision = sourceRevisionFor(diff, comment.path, comment.side);
  if (!revision) return "Source revision unavailable";
  if (comment.baseRevision !== revision) return "Source changed since comment";
  return "Outside visible lines";
}

function ReviewStatusPill({ comment }: { comment: ReviewComment }) {
  return (
    <span className={`workspace-git__comment-status workspace-git__comment-status--${comment.status}`}>
      {comment.status}
      {comment.anchorConfidence !== "exact" && ` · ${comment.anchorConfidence} anchor`}
    </span>
  );
}

function EmptyDiffState({ state, error }: { state: WorkspaceGitReviewProps["diffState"]; error?: string }) {
  if (state === "loading") return <div className="workspace-git__empty" role="status">Loading workspace diff…</div>;
  if (state === "error") return <div className="workspace-git__empty workspace-git__empty--error" role="alert">{error || "Diff could not be loaded."}</div>;
  return (
    <div className="workspace-git__empty" data-testid="git-diff-empty">
      <strong>No changes in this comparison</strong>
      <span>Choose another base or make a workspace edit to review it here.</span>
    </div>
  );
}

export function WorkspaceGitReview({
  workspaceId,
  workspaceName,
  startSnapshot,
  lastAgentTurn,
  agentSessionId,
  status,
  statusState,
  statusError,
  actionError,
  diff,
  diffState,
  diffError,
  comments,
  refs = [],
  batchDelivery,
  sessions = [],
  currentRevision,
  actions,
}: WorkspaceGitReviewProps) {
  const [target, setTarget] = useState<GitDiffTarget>({ kind: "workingTree" });
  // Which named preset produced a `compare` target, so the selector can tell
  // "Workspace start" from "Last agent turn" — both are compare targets.
  const [preset, setPreset] = useState<"workspaceStart" | "lastAgentTurn" | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBase, setCompareBase] = useState("");
  const [compareHead, setCompareHead] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [contextLines, setContextLines] = useState(3);
  const [activeFile, setActiveFile] = useState<string | undefined>();
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<LineSelection | null>(null);
  const [anchor, setAnchor] = useState<LineAnchor | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(sessions[0]?.id);
  const [reviewInstruction, setReviewInstruction] = useState("Please address these review notes.");
  const [batchPreview, setBatchPreview] = useState<ReviewBatchPreview | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmCardRef = useRef<HTMLDivElement | null>(null);
  const confirmTitleId = `workspace-git-confirm-title-${workspaceId}`;

  const compareTarget: GitDiffTarget = useMemo(() => (
    compareBase.trim()
      ? { kind: "compare", base: compareBase.trim(), ...(compareHead.trim() ? { head: compareHead.trim() } : {}) }
      : { kind: "head" }
  ), [compareBase, compareHead]);

  useEffect(() => {
    actions.refreshStatus();
    actions.listRefs();
    actions.listComments();
  }, [actions, workspaceId]);

  useEffect(() => {
    if (actionError) setBatchSending(false);
  }, [actionError]);

  useEffect(() => {
    if (!confirmAction) return;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmAction(null);
        return;
      }
      if (event.key !== "Tab") return;
      const card = confirmCardRef.current;
      if (!card) return;
      const focusable = [...card.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmAction]);

  // A turn without a base ref is not a comparison, whatever else it says.
  const turnBase = lastAgentTurn && lastAgentTurn.state !== "unavailable" && lastAgentTurn.beforeRef
    ? { kind: "compare" as const, base: lastAgentTurn.beforeRef, ...(lastAgentTurn.afterRef ? { head: lastAgentTurn.afterRef } : {}) }
    : null;

  // Each state gets its own words. "(none recorded)" and "(not captured)" are
  // different facts and a reviewer acts differently on them.
  const turnLabel = !lastAgentTurn
    ? "Last agent turn (none recorded)"
    : lastAgentTurn.state === "unavailable" || !lastAgentTurn.beforeRef
      ? `Last agent turn (${lastAgentTurn.agent} · not captured)`
      : lastAgentTurn.state === "running"
        ? `Last agent turn (${lastAgentTurn.agent} · running)`
        : `Last agent turn (${lastAgentTurn.agent})`;

  // The preset names *whichever* turn is current, so when that turn changes or
  // stops being reviewable the loaded diff is stale. Re-point it, or fall back
  // to the working tree — otherwise the summary line and the diff below it
  // describe two different turns, which is the failure this preset must not have.
  useEffect(() => {
    if (preset !== "lastAgentTurn") return;
    if (!turnBase) {
      setPreset(null);
      setTarget({ kind: "workingTree" });
      setActiveFile(undefined);
      setSelection(null);
      return;
    }
    setTarget((previous) => (
      previous.kind === "compare" && previous.base === turnBase.base && previous.head === turnBase.head
        ? previous
        : turnBase
    ));
  }, [preset, turnBase?.base, turnBase?.head]);

  useEffect(() => {
    actions.loadDiff(compareOpen && compareBase.trim() ? compareTarget : target, activeFile, {
      includeUntracked,
      ignoreWhitespace,
      contextLines,
    });
  }, [actions, activeFile, compareBase, compareHead, compareOpen, contextLines, ignoreWhitespace, includeUntracked, target, workspaceId, compareTarget]);

  useEffect(() => {
    if (!status) return;
    setSelectedPaths((previous) => {
      const available = new Set(status.entries.map((entry) => entry.path));
      const next = new Set([...previous].filter((path) => available.has(path)));
      return next.size === previous.size ? previous : next;
    });
  }, [status]);

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(undefined);
      return;
    }
    if (!selectedSessionId || !sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0]?.id);
    }
  }, [selectedSessionId, sessions]);

  const changedFiles = status?.entries ?? [];
  const diffFiles = diff?.files ?? [];
  const unresolvedCount = comments.filter((comment) => comment.status === "unresolved").length;
  const inlineCommentIds = useMemo(
    () => new Set(comments.filter((comment) => diffContainsCommentLine(comment, diff)).map((comment) => comment.id)),
    [comments, diff],
  );
  const unplacedComments = comments.filter((comment) => !inlineCommentIds.has(comment.id));
  const stagedCount = changedFiles.filter((entry) => entry.staged).length;
  const selectedCount = selectedPaths.size;
  const selectedFile = activeFile && diffFiles.some((file) => filePath(file) === activeFile) ? activeFile : undefined;
  const displayedFiles = selectedFile ? diffFiles.filter((file) => filePath(file) === selectedFile) : diffFiles;

  function chooseTarget(value: string) {
    if (value === "compare") {
      setCompareOpen(true);
      setPreset(null);
      setTarget({ kind: "head" });
      return;
    }
    setCompareOpen(false);
    if (value === "workspaceStart") {
      if (!startSnapshot) return;
      setPreset("workspaceStart");
      setTarget({ kind: "compare", base: startSnapshot });
    } else if (value === "lastAgentTurn") {
      if (!turnBase) return;
      setPreset("lastAgentTurn");
      // The recorded after side pins the turn's own end. A turn still running
      // has none, so the working tree stands in and the diff grows as the
      // agent works. A turn whose after side will never arrive is not offered.
      setTarget(turnBase);
    } else {
      setPreset(null);
      setTarget({ kind: value as "workingTree" | "staged" | "head" });
    }
    setActiveFile(undefined);
    setSelection(null);
  }

  function selectPath(path: string) {
    setSelectedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllPaths(checked: boolean) {
    setSelectedPaths(checked ? new Set(changedFiles.map((entry) => entry.path)) : new Set());
  }

  function selectLine(path: string, line: GitDiffLine, shiftKey: boolean) {
    const number = lineNumber(line, lineSide(line));
    if (number === undefined) return;
    const side = lineSide(line);
    if (shiftKey && anchor && anchor.path === path && anchor.side === side) {
      setSelection({ path, side, start: Math.min(anchor.line, number), end: Math.max(anchor.line, number) });
    } else {
      setAnchor({ path, side, line: number });
      setSelection({ path, side, start: number, end: number });
    }
    setLocalActionError(null);
  }

  function onLineKeyDown(event: KeyboardEvent<HTMLDivElement>, path: string, line: GitDiffLine) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLine(path, line, event.shiftKey);
    }
  }

  function startComment() {
    if (!selection) return;
    setCommentBody("");
    setLocalActionError(null);
  }

  function submitComment() {
    if (!selection || !commentBody.trim()) return;
    actions.createComment({ ...selection, body: commentBody.trim() });
    setCommentBody("");
    setSelection(null);
    setAnchor(null);
  }

  function beginEdit(comment: ReviewComment) {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
    setLocalActionError(null);
  }

  function saveEdit(comment: ReviewComment) {
    if (!editingBody.trim()) return;
    actions.updateComment(comment.id, editingBody.trim(), comment.version);
    setEditingCommentId(null);
  }

  async function requestDiscard(mode: "worktree" | "staged" | "all") {
    if (selectedCount === 0) {
      setLocalActionError("Select at least one changed path first.");
      return;
    }
    setLocalActionError(null);
    const receipt = await actions.discardPreview(mode, [...selectedPaths]);
    if (receipt) setConfirmAction({ kind: "discard", receipt });
    else setLocalActionError("The discard preview could not be created. Refresh status and try again.");
  }

  async function requestCommitPreview() {
    if (!commitMessage.trim()) {
      setLocalActionError("Enter a commit message first.");
      return;
    }
    setLocalActionError(null);
    const receipt = await actions.commitPreview(commitMessage.trim());
    if (receipt) setConfirmAction({ kind: "commit", receipt, message: commitMessage.trim() });
    else setLocalActionError("The commit preview could not be created. Refresh status and try again.");
  }

  async function requestBatchPreview() {
    if (unresolvedCount === 0) return;
    if (!selectedSessionId) {
      setLocalActionError("Choose a target agent session before preparing the review packet.");
      return;
    }
    if (!currentRevision) {
      setLocalActionError("The diff has no server-issued source revision. Refresh the diff before preparing a packet.");
      return;
    }
    setBatchBusy(true);
    setBatchSending(false);
    setLocalActionError(null);
    const preview = await actions.previewBatch({
      sendOperationId: newOperationId(),
      ...(selectedSessionId ? { targetSessionId: selectedSessionId } : {}),
      currentRevision,
      instruction: reviewInstruction,
    });
    setBatchPreview(preview);
    setBatchBusy(false);
    if (!preview) setLocalActionError("The review packet could not be prepared. Refresh comments and try again.");
  }

  async function sendBatch() {
    if (!batchPreview || batchSending) return;
    setLocalActionError(null);
    setBatchSending(true);
    try {
      await actions.sendBatch(batchPreview.packetId, batchPreview.sendOperationId);
    } catch (error) {
      setLocalActionError(error instanceof Error ? error.message : "Review send could not be confirmed.");
    } finally {
      setBatchSending(false);
    }
  }

  function renderCommentCard(comment: ReviewComment, inline: boolean) {
    return (
      <article
        className={`workspace-git__comment workspace-git__comment--${comment.status}`}
        data-testid={inline ? "git-inline-comment" : "git-review-list-comment"}
        key={comment.id}
      >
        <div className="workspace-git__comment-meta">
          <span>{inline ? `Lines ${comment.range.start}${comment.range.end !== comment.range.start ? `–${comment.range.end}` : ""}` : `${comment.path} · ${comment.side} · ${targetLabel(comment.base)}`}</span>
          <ReviewStatusPill comment={comment} />
        </div>
        {!inline && <span className="workspace-git__comment-location">{placementLabel(comment, diff)}</span>}
        {editingCommentId === comment.id ? (
          <>
            <textarea
              className="workspace-git__comment-edit"
              value={editingBody}
              onChange={(event) => setEditingBody(event.target.value)}
              aria-label="Edit review comment"
            />
            <div className="workspace-git__comment-actions">
              <button type="button" onClick={() => saveEdit(comment)}>Save edit</button>
              <button type="button" className="workspace-git__button--quiet" onClick={() => setEditingCommentId(null)}>Cancel</button>
            </div>
          </>
        ) : <p>{comment.body}</p>}
        {editingCommentId !== comment.id && (
          <div className="workspace-git__comment-actions">
            <button type="button" onClick={() => beginEdit(comment)}>Edit</button>
            <button type="button" onClick={() => actions.resolveComment(comment.id, comment.status !== "resolved", comment.version)}>
              {comment.status === "resolved" ? "Reopen" : "Resolve"}
            </button>
            <button type="button" className="workspace-git__button--danger" onClick={() => actions.deleteComment(comment.id, comment.version)}>Delete</button>
          </div>
        )}
      </article>
    );
  }

  function renderCommentThread(path: string, side: ReviewSide, line: number) {
    const lineComments = comments.filter((comment) => isCommentOnLine(comment, path, side, line, diff));
    if (lineComments.length === 0) return null;
    return (
      <div className="workspace-git__line-comments" data-testid="git-line-comments">
        {lineComments.map((comment) => renderCommentCard(comment, true))}
      </div>
    );
  }

  return (
    <section className="workspace-git" data-testid="workspace-git-review" aria-label="Git and review">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-b-[color:var(--git-border)] px-[0.85rem] py-[0.65rem] [@container(max-width:700px)]:items-start [@container(max-width:700px)]:p-[0.55rem]">
        <div className="flex min-w-0 flex-col items-start gap-[0.08rem]">
          <span className={EYEBROW}>Source control</span>
          <h2 className="m-0 max-w-full overflow-hidden text-[1rem] font-[650] text-ellipsis whitespace-nowrap">{workspaceName || "Workspace changes"}</h2>
          <span className="text-[0.7rem] text-subtext-0" title={workspaceId}>Workspace {workspaceId.slice(0, 8)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-[0.55rem] [@container(max-width:700px)]:flex-col [@container(max-width:700px)]:items-end [@container(max-width:700px)]:gap-[0.3rem]">
          <button type="button" className="workspace-git__button" data-testid="git-refresh" onClick={() => { actions.refreshStatus(); actions.listComments(); }}>Refresh</button>
          <span className={cn(CONNECTION, statusState === "ready" ? CONNECTION_READY : statusState === "error" ? CONNECTION_ERROR : CONNECTION_IDLE)} role="status">
            {statusState === "loading" ? "Updating…" : statusState === "error" ? "Status unavailable" : status?.dirty ? "Dirty" : "Clean"}
          </span>
        </div>
      </header>

      <div className="workspace-git__body">
        <aside className="flex min-h-0 w-[17rem] min-w-[14rem] flex-col overflow-y-auto border-r border-r-[color:var(--git-border)] [@container(max-width:700px)]:w-full [@container(max-width:700px)]:min-w-0 [@container(max-width:700px)]:flex-[0_0_auto] [@container(max-width:700px)]:max-h-[12rem] [@container(max-width:700px)]:[border-right:none] [@container(max-width:700px)]:border-b [@container(max-width:700px)]:border-b-[color:var(--git-border)]" data-testid="git-status">
          <div className="workspace-git__section-heading">
            <div>
              <span className={EYEBROW}>Workspace status</span>
              <strong>{changedFiles.length ? `${changedFiles.length} changed path${changedFiles.length === 1 ? "" : "s"}` : "No changes"}</strong>
            </div>
            <label className="workspace-git__select-all">
              <input
                type="checkbox"
                checked={changedFiles.length > 0 && selectedCount === changedFiles.length}
                onChange={(event) => selectAllPaths(event.target.checked)}
                aria-label="Select all changed paths"
              />
              All
            </label>
          </div>

          {statusState === "loading" && <div className="workspace-git__status-note" role="status">Reading Git status…</div>}
          {statusState === "error" && <div className="workspace-git__status-note workspace-git__status-note--error" role="alert">{statusError || "Git status is unavailable."}</div>}
          {status && (
            <div className="mx-[0.7rem] mb-[0.55rem] rounded-ui border border-[color:var(--git-border)] bg-[color-mix(in_srgb,var(--surface-1)_75%,transparent)] px-[0.55rem] py-2">
              <div className="flex items-center justify-between gap-2"><strong className="overflow-hidden text-ellipsis whitespace-nowrap">{status.branch || "Detached HEAD"}</strong><span className="text-yellow [font-family:monospace] text-[0.66rem]">{shortHash(status.head)}</span></div>
              <div className={BRANCH_DETAIL}>{status.upstream ? `tracks ${status.upstream}` : "No upstream configured"}</div>
              {(status.ahead ?? 0) > 0 || (status.behind ?? 0) > 0 ? (
                <div className="mt-[0.35rem] flex items-center gap-[0.65rem] text-[0.68rem]">
                  {(status.ahead ?? 0) > 0 && <span className="text-green">↑ {status.ahead} ahead</span>}
                  {(status.behind ?? 0) > 0 && <span className="text-yellow">↓ {status.behind} behind</span>}
                </div>
              ) : <span className={BRANCH_DETAIL}>Up to date</span>}
            </div>
          )}

          <div className="flex flex-col gap-[0.12rem] px-[0.45rem] pt-0 pb-[0.55rem]" role="list" aria-label="Changed paths">
            {changedFiles.map((entry) => (
              <div className="flex min-w-0 items-center gap-[0.3rem]" key={entry.path} role="listitem">
                <input
                  className="shrink-0"
                  type="checkbox"
                  checked={selectedPaths.has(entry.path)}
                  onChange={() => selectPath(entry.path)}
                  aria-label={`Select ${entry.path}`}
                />
                <button
                  type="button"
                  className={`${PATH_BUTTON} ${activeFile === entry.path ? PATH_BUTTON_ACTIVE : PATH_BUTTON_IDLE}`}
                  onClick={() => { setActiveFile(entry.path); setSelection(null); }}
                  title={entry.originalPath ? `${entry.originalPath} → ${entry.path}` : entry.path}
                >
                  <span className={`text-[0.64rem] ${FILE_STATE_TONE[statusTone(entry)] ?? "text-subtext-0"}`}>{entryState(entry)}</span>
                  <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{entry.path}</span>
                </button>
              </div>
            ))}
            {statusState !== "loading" && changedFiles.length === 0 && <div className="workspace-git__status-note">Working tree is clean.</div>}
          </div>

          <div className="workspace-git__source-actions">
            <div className="workspace-git__action-row">
              <button type="button" className="workspace-git__button" disabled={selectedCount === 0} onClick={() => actions.stage([...selectedPaths])}>Stage selected</button>
              <button type="button" className="workspace-git__button" disabled={selectedCount === 0} onClick={() => actions.unstage([...selectedPaths])}>Unstage</button>
            </div>
            <div className="workspace-git__action-row">
              <button type="button" className="workspace-git__button workspace-git__button--danger" data-testid="git-discard-preview" disabled={selectedCount === 0} onClick={() => requestDiscard("worktree")}>Discard selected</button>
            </div>
            <label className="workspace-git__commit-field">
              <span>Commit staged changes</span>
              <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Describe the change" />
            </label>
            <button type="button" className="workspace-git__button workspace-git__button--primary" disabled={stagedCount === 0 || !commitMessage.trim()} onClick={requestCommitPreview}>Preview commit</button>
          </div>
        </aside>

        <div className="workspace-git__main">
          <div className="workspace-git__diff-toolbar">
            <div className="workspace-git__toolbar-group">
              <label className="workspace-git__field">
                <span>Compare</span>
                <select data-testid="git-diff-target" value={compareOpen ? "compare" : target.kind === "compare" ? (preset ?? "compare") : target.kind} onChange={(event) => chooseTarget(event.target.value)}>
                  <option value="workingTree">Working tree</option>
                  <option value="staged">Staged</option>
                  <option value="head">HEAD</option>
                  <option value="workspaceStart" disabled={!startSnapshot}>{startSnapshot ? "Workspace start" : "Workspace start (not recorded)"}</option>
                  <option value="lastAgentTurn" disabled={!turnBase}>{turnLabel}</option>
                  <option value="compare">Another ref…</option>
                </select>
              </label>
              <label className="workspace-git__field">
                <span>Turn session</span>
                <select data-testid="git-turn-session" value={agentSessionId ?? ""} onChange={(event) => {
                  chooseTarget("workingTree");
                  actions.selectAgentSession(event.target.value || undefined);
                }}>
                  <option value="">Latest in workspace</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.agent ?? "agent"}</option>)}
                </select>
              </label>
              {compareOpen && (
                <>
                  <label className="workspace-git__field"><span>Base ref</span>
                    <input list="git-review-refs" data-testid="git-base-selector" value={compareBase} onChange={(event) => setCompareBase(event.target.value)} placeholder="main" />
                    <datalist id="git-review-refs">{refs.map((ref) => <option value={ref.name} key={`${ref.remote ? "remote" : "local"}:${ref.name}`}>{ref.target.slice(0, 8)}</option>)}</datalist>
                  </label>
                  <label className="workspace-git__field"><span>Head <em>optional</em></span><input value={compareHead} onChange={(event) => setCompareHead(event.target.value)} placeholder="HEAD" /></label>
                  <button type="button" className="workspace-git__button workspace-git__button--quiet" onClick={() => { setCompareBase(""); setCompareHead(""); setCompareOpen(false); setTarget({ kind: "workingTree" }); }}>Clear base</button>
                </>
              )}
            </div>
            <div className="workspace-git__toolbar-group workspace-git__toolbar-group--secondary">
              <label className="workspace-git__check"><input type="checkbox" checked={includeUntracked} onChange={(event) => setIncludeUntracked(event.target.checked)} /> Untracked</label>
              <label className="workspace-git__check"><input type="checkbox" checked={ignoreWhitespace} onChange={(event) => setIgnoreWhitespace(event.target.checked)} /> Ignore whitespace</label>
              <label className="workspace-git__field workspace-git__field--compact"><span>Context</span><select value={contextLines} onChange={(event) => setContextLines(Number(event.target.value))}><option value={0}>0 lines</option><option value={3}>3 lines</option><option value={8}>8 lines</option></select></label>
            </div>
          </div>

          {preset === "lastAgentTurn" && lastAgentTurn && (
            /* The gate asks for the *agent's* changes, so say whose turn this
               is and how much it touched — a diff alone does not answer that. */
            <p className="workspace-git__turn-summary" data-testid="git-turn-summary">
              <strong>{lastAgentTurn.agent}</strong>
              {lastAgentTurn.state === "running"
                ? " · turn in progress, comparing against the working tree"
                : <>
                    {" changed "}
                    {lastAgentTurn.changedPathCount === undefined ? "at least " : ""}
                    {lastAgentTurn.changedPathCount ?? lastAgentTurn.changedPaths.length} {(lastAgentTurn.changedPathCount ?? lastAgentTurn.changedPaths.length) === 1 ? "path" : "paths"}
                    {lastAgentTurn.completedAt ? ` · ${new Date(lastAgentTurn.completedAt).toLocaleTimeString()}` : ""}
                  </>}
            </p>
          )}
          {lastAgentTurn?.state === "unavailable" && (
            /* Never silently substitute an older turn for this one: the newest
               turn is the one the label promises, and it was not captured. */
            <p className="workspace-git__status-note" data-testid="git-turn-unavailable">
              This agent turn was not captured, so it cannot be compared. The next turn records a fresh baseline.
            </p>
          )}

          <div className="workspace-git__diff-layout">
            <nav className="workspace-git__diff-files" aria-label="Changed files">
              <div className="workspace-git__section-heading"><span className={EYEBROW}>Diff files</span><strong>{diffFiles.length}</strong></div>
              {diffFiles.map((file) => {
                const path = filePath(file);
                return <button type="button" className={`workspace-git__diff-file${activeFile === path ? " workspace-git__diff-file--active" : ""}`} data-testid="git-diff-file" key={path} onClick={() => { setActiveFile(path); setSelection(null); }}><span>{file.status}</span><strong>{path}</strong><small>{file.hunks.length} hunk{file.hunks.length === 1 ? "" : "s"}</small></button>;
              })}
              {diffState !== "loading" && diffFiles.length === 0 && <div className="workspace-git__status-note">No files in this diff.</div>}
            </nav>

            <div className={`min-h-0 min-w-0 flex-1 overflow-auto [@container(max-width:700px)]:min-h-[12rem]`} data-testid="git-diff">
              {diffState === "loading" || diffFiles.length === 0 ? <EmptyDiffState state={diffState} error={diffError} /> : (
                <>
                  {diff?.truncated && <div className="workspace-git__banner workspace-git__banner--warning" role="status">This diff is truncated. Narrow the path or comparison before commenting.</div>}
                  {displayedFiles.map((file) => {
                    const displayPath = filePath(file);
                    return (
                      <article className={`min-w-[min-content] [@container(max-width:700px)]:min-w-0`} key={displayPath}>
                        <header className={`flex justify-between gap-4 border-b border-b-[color:var(--git-border)] px-[0.7rem] py-2 [@container(max-width:700px)]:min-w-0`}><strong className={`[font-family:monospace] text-[0.75rem] [@container(max-width:700px)]:min-w-0 [@container(max-width:700px)]:overflow-hidden [@container(max-width:700px)]:text-ellipsis [@container(max-width:700px)]:whitespace-nowrap`}>{displayPath}</strong><span className={`text-[0.68rem] text-subtext-0 [@container(max-width:700px)]:min-w-0 [@container(max-width:700px)]:overflow-hidden [@container(max-width:700px)]:text-ellipsis [@container(max-width:700px)]:whitespace-nowrap`}>{file.status}{file.isBinary ? " · binary" : ""}</span></header>
                        {file.isBinary ? <div className="workspace-git__binary">Binary content is not rendered. Status and path remain available for review.</div> : file.hunks.map((hunk, hunkIndex) => (
                          <section className="border-b border-b-[color:var(--git-border)]" key={`${displayPath}:${hunkIndex}`}>
                            <div className={`px-[0.7rem] py-1 text-accent [font-family:monospace] text-[0.68rem]`}>{hunk.header || `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`}</div>
                            {hunk.lines.map((line, lineIndex) => {
                              const side = lineSide(line);
                              const path = filePathForSide(file, side);
                              const number = lineNumber(line, side);
                              const selected = number !== undefined && selection?.path === path && selection.side === side && number >= selection.start && number <= selection.end;
                              return (
                                <div
                                  className={`${DIFF_LINE} ${DIFF_LINE_KIND[line.kind] ?? `${DIFF_LINE_CONTEXT}${selected ? ` ${DIFF_LINE_SELECTED}` : ""}`}`}
                                  data-testid="git-diff-line"
                                  data-path={path}
                                  data-side={side}
                                  data-old-line={line.oldLine ?? ""}
                                  data-new-line={line.newLine ?? ""}
                                  key={`${path}:${hunkIndex}:${lineIndex}`}
                                  role="button"
                                  tabIndex={number === undefined ? -1 : 0}
                                  onClick={(event) => selectLine(path, line, event.shiftKey)}
                                  onKeyDown={(event) => onLineKeyDown(event, path, line)}
                                >
                                  <span className="min-h-[1.45em] pr-[0.45rem] text-right text-overlay-0 select-none" aria-label={`Old line ${line.oldLine ?? "none"}`}>{line.oldLine ?? ""}</span>
                                  <span className="min-h-[1.45em] pr-[0.45rem] text-right text-overlay-0 select-none" aria-label={`New line ${line.newLine ?? "none"}`}>{line.newLine ?? ""}</span>
                                  <span className={`text-center select-none ${LINE_MARKER_TONE[line.kind] ?? "text-subtext-0"}`} aria-hidden="true">{statusSymbol(line.kind)}</span>
                                  <code className={`min-w-0 overflow-visible text-inherit [font:inherit] [@container(max-width:700px)]:overflow-x-auto`}>{line.content || " "}</code>
                                  {number !== undefined && <button type="button" className={LINE_COMMENT_BUTTON} data-testid="git-comment-add" aria-label={`Comment on ${path} line ${number}`} onClick={(event) => { event.stopPropagation(); selectLine(path, line, false); startComment(); }}>＋</button>}
                                  {number !== undefined && renderCommentThread(path, side, number)}
                                </div>
                              );
                            })}
                          </section>
                        ))}
                      </article>
                    );
                  })}
                  {selection && (
                    <div className="workspace-git__comment-composer" data-testid="git-comment-composer">
                      <div className="workspace-git__comment-composer-heading"><strong>Comment on {selection.path}</strong><span>{selection.side} lines {selection.start}–{selection.end}</span></div>
                      <textarea data-testid="git-comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave a focused note for the agent…" aria-label="New review comment" />
                      <div className="workspace-git__comment-actions"><button type="button" className="workspace-git__button workspace-git__button--primary" disabled={!commentBody.trim()} onClick={submitComment}>Add comment</button><button type="button" className="workspace-git__button workspace-git__button--quiet" onClick={() => { setSelection(null); setAnchor(null); }}>Cancel</button></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <section className="workspace-git__review-panel" data-testid="git-review-panel">
            <div className="workspace-git__review-heading"><div><span className={EYEBROW}>Inline review</span><strong>{unresolvedCount ? `${unresolvedCount} unresolved note${unresolvedCount === 1 ? "" : "s"}` : "No unresolved notes"}</strong></div><button type="button" className="workspace-git__button" disabled={!unresolvedCount || batchBusy} onClick={requestBatchPreview} data-testid="git-review-preview">{batchBusy ? "Preparing…" : "Preview packet"}</button></div>
            {comments.length > 0 && <div className="workspace-git__comment-summary">Comments stay attached to their path and core-derived anchor. Stale or orphaned anchors require an explicit correction before sending.</div>}
            {unplacedComments.length > 0 && (
              <div className="workspace-git__review-list" data-testid="git-review-list">
                <div className="workspace-git__review-list-heading"><span className={EYEBROW}>Other review notes</span><strong>{unplacedComments.length}</strong></div>
                <p className="workspace-git__comment-summary">These notes are kept with their server anchor and are not placed on the current diff.</p>
                {unplacedComments.map((comment) => renderCommentCard(comment, false))}
              </div>
            )}
            {unresolvedCount > 0 && (
              <div className="workspace-git__batch-form">
                <label className="workspace-git__field"><span>Send to agent session</span><select aria-label="Send to agent session" value={selectedSessionId ?? ""} onChange={(event) => setSelectedSessionId(event.target.value || undefined)}><option value="">Choose a session</option>{sessions.map((session) => <option value={session.id} key={session.id}>{session.title}{session.agent ? ` · ${session.agent}` : ""}</option>)}</select></label>
                <label className="workspace-git__field workspace-git__field--grow"><span>Request</span><input value={reviewInstruction} onChange={(event) => setReviewInstruction(event.target.value)} /></label>
              </div>
            )}
            {batchPreview && (
              <div className="workspace-git__packet" data-testid="git-review-packet"><div className="workspace-git__packet-meta"><strong>Packet ready</strong><span>{batchPreview.comments.length} anchored note{batchPreview.comments.length === 1 ? "" : "s"}</span><code>{batchPreview.packetId}</code></div><pre>{batchPreview.markdown}</pre><div className="workspace-git__comment-actions"><button type="button" className="workspace-git__button workspace-git__button--primary" onClick={sendBatch} disabled={batchSending} data-testid="git-review-send">{batchSending ? "Sending…" : "Send one packet"}</button><button type="button" className="workspace-git__button workspace-git__button--quiet" onClick={() => setBatchPreview(null)} disabled={batchSending}>Close preview</button></div></div>
            )}
            {batchDelivery && batchDelivery.packetId === batchPreview?.packetId && <div className="workspace-git__banner workspace-git__banner--info" role="status" data-testid="git-review-delivery">
              {batchDelivery.delivery === "delivered" ? "Agent received the review packet."
                : batchDelivery.delivery === "unconfirmed" ? "Delivery could not be confirmed. Check the agent conversation before starting another review."
                : "Waiting for the agent to receive the review packet…"}
            </div>}
            {batchSending && (!batchDelivery || batchDelivery.packetId !== batchPreview?.packetId) && <div className="workspace-git__banner workspace-git__banner--info" role="status">Sending review packet… waiting for server confirmation.</div>}
          </section>
        </div>
      </div>

      {(localActionError || actionError) && <div className="workspace-git__toast workspace-git__toast--error" role="alert">{localActionError || actionError}<button type="button" aria-label="Dismiss" onClick={() => setLocalActionError(null)}>×</button></div>}
      {confirmAction && (
        <div className="workspace-git__confirm" role="dialog" aria-modal="true" aria-labelledby={confirmTitleId}>
          <div className="workspace-git__confirm-card" ref={confirmCardRef}>
            <span className={EYEBROW}>Confirm {confirmAction.kind}</span>
            <h3 id={confirmTitleId}>{confirmAction.kind === "commit" ? "Commit staged changes?" : "Discard selected changes?"}</h3>
            <p>{confirmAction.kind === "commit" ? `This will create “${confirmAction.message}” in ${workspaceName || workspaceId}.` : `This permanently changes ${confirmAction.receipt.paths.length} selected path${confirmAction.receipt.paths.length === 1 ? "" : "s"}.`}</p>
            <ul>{confirmAction.receipt.paths.map((path) => <li key={path}>{path}</li>)}</ul>
            <div className="workspace-git__comment-actions"><button ref={confirmButtonRef} type="button" className="workspace-git__button workspace-git__button--danger" data-testid="git-confirm-action" onClick={() => { if (confirmAction.kind === "commit") actions.commit(confirmAction.receipt.previewId, confirmAction.message); else actions.discard(confirmAction.receipt.previewId); setConfirmAction(null); }}>Confirm {confirmAction.kind}</button><button type="button" className="workspace-git__button workspace-git__button--quiet" data-testid="git-cancel-action" onClick={() => setConfirmAction(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
