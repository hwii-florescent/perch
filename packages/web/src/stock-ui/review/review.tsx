//! The review's presentation: status list, diff, line selection and comments, the comment and commit composers,
//! discard/commit confirmations and the review packet. Everything it shows and does comes in as props from
//! `main.tsx` (Perch's `gitReviewStore` and Context Bridge through `@perch/sdk`); it owns no Git or review logic.
//! What must survive this code being reloaded or swapped (unsent comment and commit text, the line being
//! commented, the prepared packet and its send operation id, a send in flight) is kept by the host under the
//! workspace's key (`useResourceState`), so every copy of this screen for one workspace shares it. Only
//! transient UI (an open confirmation, a busy flag of a request this copy is awaiting) is the copy's own.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cn,
  DiffView,
  FileIcon,
  GitMarker,
  newId,
  Select,
  useResourceState,
  type AgentTurnSummary,
  type ContextSource,
  type GitDiffFile,
  type GitDiffLine,
  type GitDiffSnapshot,
  type GitDiffTarget,
  type GitPreviewReceipt,
  type GitStatusEntry,
  type GitStatusSnapshot,
  type ReviewBatchDelivery,
  type ReviewBatchPreview,
  type ReviewComment,
  type ReviewSide,
  type ReviewTargetSession,
  type WorkspaceGitReviewActions,
} from "@perch/sdk";

/** The narrow layout applies at or under this width of the review itself. */
const NARROW_WIDTH = 700;
const EYEBROW = "text-accent text-[0.63rem] font-bold tracking-[0.09em] uppercase";
const CONNECTION = "rounded-[999px] bg-surface-1 px-[0.42rem] py-[0.18rem] text-[0.7rem] whitespace-nowrap";
const CONNECTION_READY = "text-green";
const CONNECTION_ERROR = "text-red";
const CONNECTION_IDLE = "text-subtext-0";
const BRANCH_DETAIL = "block overflow-hidden text-[0.7rem] text-ellipsis whitespace-nowrap text-subtext-0";
const PATH_BUTTON = "workspace-git__path-button flex min-w-0 flex-1 items-center justify-between gap-[0.4rem] rounded-ui px-3 py-[3px] text-left text-fg [background:none] hover:bg-surface-1";
const PATH_BUTTON_IDLE = "";
const PATH_BUTTON_ACTIVE = "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const TB_FIELD = "flex min-w-0 max-w-full items-center gap-[0.35rem] text-[0.68rem] text-subtext-0";
const TB_INPUT = "min-w-0 max-w-full rounded-ui bg-surface-1 px-[0.4rem] py-[0.3rem] text-fg";
/** Line icons (24-unit grid, `|` between the strokes of one icon), drawn in `currentColor`. */
const ICONS = {
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8|M21 3v5h-5",
  files: "M3 6.75A2.25 2.25 0 0 1 5.25 4.5h3.9l2.1 2.25h7.5A2.25 2.25 0 0 1 21 9v8.25a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25z",
  untracked: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z|M14 2v6h6|M12 18v-6|M9 15h6",
  wrap: "M3 6h18|M3 12h15a3 3 0 1 1 0 6h-4|M16 16l-2 2 2 2|M3 18h7",
  whitespace: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1",
  stage: "M5 12h14|M12 5v14",
  unstage: "M5 12h14",
  discard: "M9 14L4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  commit: "M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0|M3 12h6|M15 12h6",
  clear: "M18 6L6 18|M6 6l12 12",
};
const ICON_BTN = "inline-flex shrink-0 items-center justify-center rounded-ui p-[0.35rem] disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1";
const ICON_TONE = {
  default: "bg-transparent text-subtext-0 [&:hover:not(:disabled)]:text-fg",
  on: "bg-transparent text-accent",
  primary: "bg-transparent text-accent",
  danger: "bg-transparent text-red",
};
/** A button that is only an icon: its name is the `label` (the accessible name and the tooltip). `pressed` makes it a
 * toggle that shows when it is on. */
function IconButton({ icon, label, pressed, tone = "default", disabled, onClick, testId }: { icon: keyof typeof ICONS; label: string; pressed?: boolean; tone?: keyof typeof ICON_TONE; disabled?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className={cn(ICON_BTN, ICON_TONE[pressed ? "on" : tone])} aria-label={label} title={label} aria-pressed={pressed} data-testid={testId} disabled={disabled} onClick={onClick}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon].split("|").map((d) => <path key={d} d={d} />)}
      </svg>
    </button>
  );
}
const TB_GROUP = "flex max-w-full min-w-0 flex-wrap items-center gap-[0.45rem]";
const DIFF_FILE = "flex min-w-0 flex-col items-start gap-[0.1rem] rounded-ui px-[0.45rem] py-[0.42rem] text-left text-fg [background:none] hover:bg-surface-1";
const COMMENT = "workspace-git__comment mt-[0.3rem] rounded-ui bg-surface-0 px-[0.55rem] py-[0.45rem] whitespace-normal [font-family:inherit]";
const COMMENT_TONE: Record<string, string> = { resolved: "opacity-[0.72]", unresolved: "", stale: "", orphaned: "" };
const PILL_TONE: Record<string, string> = { resolved: "text-green", unresolved: "text-accent", stale: "text-yellow", orphaned: "text-yellow" };
const COMMENT_FIELD = "block min-h-[3.2rem] w-full resize-y rounded-ui bg-surface-1 p-[0.4rem] text-fg";
// The legacy `.workspace-git button { font: inherit }` out-ranked `__button`'s font-size, so these keep the inherited size
// (and `comment-actions` buttons need `!` to beat that unlayered reset, as the old later same-specificity rule did).
const BTN = "rounded-ui px-2 py-[0.3rem] whitespace-nowrap disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1";
const BTN_DEFAULT = `${BTN} bg-surface-1 text-fg [&:hover:not(:disabled)]:text-accent`;
// Inside `comment-actions` every button is a transparent accent link; a `__button` there keeps its frame.
const CA_BTN_BASE = "rounded-ui bg-transparent px-2 py-[0.3rem] text-[0.66rem]! whitespace-nowrap text-accent disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1";
const CA_BTN = `${CA_BTN_BASE} [&:hover:not(:disabled)]:text-accent`;
const CA_BTN_DANGER = `${CA_BTN_BASE} [&:hover:not(:disabled)]:text-red`;
const CA_LINK = "[border:0] bg-transparent px-[0.3rem] py-[0.2rem] text-[0.66rem]! text-accent";
const CA_LINK_DANGER = `${CA_LINK} [&:hover:not(:disabled)]:text-red`;
const COMMENT_ACTIONS = "flex items-center justify-end gap-[0.3rem]";
const SUMMARY = "text-[0.7rem] text-subtext-0";
const EMPTY_BASE = "flex min-h-[10rem] flex-col items-center justify-center gap-[0.35rem] p-6 text-center";
const EMPTY = `${EMPTY_BASE} text-subtext-0 [&_strong]:text-fg`;
// The original `.empty--error` only turned the text red; a later selector edit had wrongly boxed it like a banner.
const EMPTY_ERROR = `${EMPTY_BASE} text-red`;
const BOXED_NOTE = "mx-[0.7rem] my-[0.55rem] rounded-ui bg-surface-0 px-2 py-[0.4rem] text-[0.7rem]";
const BANNER_INFO = `${BOXED_NOTE} text-accent`;
const BANNER_WARNING = `${BOXED_NOTE} text-yellow`;
const TURN_SUMMARY = "m-0 px-[0.7rem] py-[0.4rem] text-[0.72rem] text-[color:var(--git-muted)]";
const STATUS_NOTE = "px-[0.7rem] py-[0.55rem] text-[0.7rem] text-subtext-0";

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
  onAskAgent?: (source: ContextSource) => void;
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

function splitPath(path: string): [string, string] {
  const cut = path.lastIndexOf("/") + 1;
  return [path.slice(0, cut), path.slice(cut)];
}

/** One line of the changed-files tree: a folder, or a file with its status entry. */
type TreeRow =
  | { kind: "dir"; key: string; depth: number; name: string; open: boolean }
  | { kind: "file"; key: string; depth: number; name: string; entry: GitStatusEntry };

interface DirNode {
  dirs: Map<string, DirNode>;
  files: GitStatusEntry[];
}

/** The changed paths as a tree, folders before files, each sorted by name. A folder in `collapsed` hides its
 * contents, unless a filter is typed: then every folder holding a match stays open. */
function treeRows(entries: GitStatusEntry[], collapsed: Set<string>, query: string): TreeRow[] {
  const needle = query.trim().toLowerCase();
  const root: DirNode = { dirs: new Map(), files: [] };
  for (const entry of entries) {
    if (needle && !entry.path.toLowerCase().includes(needle)) continue;
    let node = root;
    for (const part of entry.path.split("/").slice(0, -1)) {
      let next = node.dirs.get(part);
      if (!next) node.dirs.set(part, (next = { dirs: new Map(), files: [] }));
      node = next;
    }
    node.files.push(entry);
  }
  const rows: TreeRow[] = [];
  const walk = (node: DirNode, prefix: string, depth: number) => {
    for (const [name, child] of [...node.dirs].sort(([a], [b]) => a.localeCompare(b))) {
      const key = `${prefix}${name}/`;
      const open = needle !== "" || !collapsed.has(key);
      rows.push({ kind: "dir", key, depth, name, open });
      if (open) walk(child, key, depth + 1);
    }
    const named = node.files.map((entry) => ({ entry, name: entry.path.slice(entry.path.lastIndexOf("/") + 1) }));
    for (const { entry, name } of named.sort((a, b) => a.name.localeCompare(b.name))) rows.push({ kind: "file", key: entry.path, depth, name, entry });
  };
  walk(root, "", 0);
  return rows;
}

/** A path with its directory dimmed and its name plain; the directory gives way first when the row is narrow. */
function PathLabel({ path, className }: { path: string; className?: string }) {
  const [dir, name] = splitPath(path);
  return (
    <span className={cn("flex min-w-0 overflow-hidden whitespace-nowrap", className)}>
      {dir && <span className="min-w-0 overflow-hidden text-ellipsis text-subtext-0">{dir}</span>}
      <span className="min-w-0 shrink-[0.001] overflow-hidden text-ellipsis">{name}</span>
    </span>
  );
}

function shortHash(value: string | undefined): string {
  return value ? value.slice(0, 8) : "—";
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
    <span className={`rounded-[999px] bg-surface-1 px-[0.3rem] py-[0.1rem] capitalize ${PILL_TONE[comment.status] ?? "text-subtext-0"}`}>
      {comment.status}
      {comment.anchorConfidence !== "exact" && ` · ${comment.anchorConfidence} anchor`}
    </span>
  );
}

function EmptyDiffState({ state, error }: { state: WorkspaceGitReviewProps["diffState"]; error?: string }) {
  if (state === "loading") return <div className={EMPTY} role="status">Loading workspace diff…</div>;
  if (state === "error") return <div className={EMPTY_ERROR} role="alert">{error || "Diff could not be loaded."}</div>;
  return (
    <div className={EMPTY} data-testid="git-diff-empty">
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
  onAskAgent,
}: WorkspaceGitReviewProps) {
  const [target, setTarget] = useResourceState<GitDiffTarget>(`review:${workspaceId}:target`, { kind: "workingTree" });
  // Which named preset produced a `compare` target, so the selector can tell
  // "Workspace start" from "Last agent turn" — both are compare targets.
  const [preset, setPreset] = useResourceState<"workspaceStart" | "lastAgentTurn" | null>(`review:${workspaceId}:preset`, null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBase, setCompareBase] = useResourceState(`review:${workspaceId}:compareBase`, "");
  const [compareHead, setCompareHead] = useResourceState(`review:${workspaceId}:compareHead`, "");
  const [includeUntracked, setIncludeUntracked] = useResourceState(`review:${workspaceId}:includeUntracked`, true);
  const [wrapLines, setWrapLines] = useResourceState(`review:${workspaceId}:wrapLines`, false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useResourceState(`review:${workspaceId}:ignoreWhitespace`, false);
  const [contextLines, setContextLines] = useResourceState(`review:${workspaceId}:contextLines`, 3);
  const [activeFile, setActiveFile] = useResourceState<string | undefined>(`review:${workspaceId}:activeFile`, undefined);
  const [selectedPaths, setSelectedPaths] = useResourceState<Set<string>>(`review:${workspaceId}:selectedPaths`, new Set());
  const [selection, setSelection] = useResourceState<LineSelection | null>(`review:${workspaceId}:selection`, null);
  const [anchor, setAnchor] = useResourceState<LineAnchor | null>(`review:${workspaceId}:anchor`, null);
  const [commentBody, setCommentBody] = useResourceState(`review:${workspaceId}:commentBody`, "");
  const [editingCommentId, setEditingCommentId] = useResourceState<string | null>(`review:${workspaceId}:editingCommentId`, null);
  const [editingBody, setEditingBody] = useResourceState(`review:${workspaceId}:editingBody`, "");
  const [commitMessage, setCommitMessage] = useResourceState(`review:${workspaceId}:commitMessage`, "");
  const [changesOpen, setChangesOpen] = useResourceState(`review:${workspaceId}:changesOpen`, true);
  const [railOpen, setRailOpen] = useResourceState(`review:${workspaceId}:railOpen`, true);
  const [collapsedDirs, setCollapsedDirs] = useResourceState<Set<string>>(`review:${workspaceId}:collapsedDirs`, new Set());
  const [fileFilter, setFileFilter] = useState("");
  const [diffLayout, setDiffLayout] = useResourceState<"auto" | "unified" | "split">(`review:${workspaceId}:diffLayout`, "auto");
  // Whether the host's diff can show a change side by side (the native client's can).
  const canChooseLayout = (DiffView as { splitLayout?: boolean }).splitLayout === true;
  // The narrow layout goes by the review's own width. A container query would do on the web, but the native
  // runtime matches those against the window, and its `ResizeObserver` never fires, so the box is read on a timer.
  const rootRef = useRef<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const read = () => {
      const width = rootRef.current?.getBoundingClientRect().width ?? 0;
      if (width > 0) setNarrow(width <= NARROW_WIDTH);
    };
    read();
    const timer = setInterval(read, 250);
    return () => clearInterval(timer);
  }, []);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useResourceState<string | undefined>(`review:${workspaceId}:selectedSessionId`, sessions[0]?.id);
  const [reviewInstruction, setReviewInstruction] = useResourceState(`review:${workspaceId}:reviewInstruction`, "Please address these review notes.");
  const [batchPreview, setBatchPreview] = useResourceState<ReviewBatchPreview | null>(`review:${workspaceId}:batchPreview`, null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchSending, setBatchSending] = useResourceState(`review:${workspaceId}:batchSending`, false);
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
  // Added and removed lines per path, from the diffs shown for this comparison: a diff of one file adds that file's
  // counts to the ones already known, so choosing a file does not blank the others.
  const countCache = useRef({ key: "", counts: new Map<string, { added: number; removed: number }>() });
  const lineCounts = useMemo(() => {
    const key = diff ? targetKey(diff.target) : "";
    if (diff && countCache.current.key !== key) countCache.current = { key, counts: new Map() };
    for (const file of diff?.files ?? []) {
      let added = 0;
      let removed = 0;
      for (const hunk of file.hunks) for (const line of hunk.lines) { if (line.kind === "addition") added += 1; else if (line.kind === "deletion") removed += 1; }
      countCache.current.counts.set(filePath(file), { added, removed });
    }
    return new Map(countCache.current.counts);
  }, [diff]);
  const treeShown = useMemo(() => treeRows(changedFiles, collapsedDirs, fileFilter), [changedFiles, collapsedDirs, fileFilter]);
  function toggleDir(key: string) {
    setCollapsedDirs((current) => { const next = new Set(current); if (!next.delete(key)) next.add(key); return next; });
  }
  const unresolvedCount = comments.filter((comment) => comment.status === "unresolved").length;
  const inlineCommentIds = useMemo(
    () => new Set(comments.filter((comment) => diffContainsCommentLine(comment, diff)).map((comment) => comment.id)),
    [comments, diff],
  );
  const unplacedComments = comments.filter((comment) => !inlineCommentIds.has(comment.id));
  const stagedCount = changedFiles.filter((entry) => entry.staged).length;
  function askAboutDiff(file: GitDiffFile, range?: LineSelection | null) {
    if (!diff || !onAskAgent) return;
    const text = [
      `--- ${file.oldPath ?? "/dev/null"}`,
      `+++ ${file.newPath ?? "/dev/null"}`,
      ...(range ? [`Selected ${range.side} lines ${range.start}–${range.end}`] : []),
      ...(diff.truncated ? ["WARNING: this displayed diff is truncated."] : []),
      ...file.hunks.flatMap((hunk) => {
        const lines = hunk.lines.filter((line) => {
          const number = range ? lineNumber(line, range.side) : undefined;
          return !range || (number !== undefined && number >= range.start && number <= range.end);
        });
        return lines.length ? [hunk.header, ...lines.map((line) => `${line.oldLine ?? "-"}:${line.newLine ?? "-"} ${statusSymbol(line.kind)}${line.content}`)] : [];
      }),
    ].join("\n");
    onAskAgent({ kind: "diff", path: range?.path ?? filePath(file), text, comparison: targetLabel(diff.target), revision: diff.sourceRevision ?? "unversioned displayed snapshot" });
  }

  const selectedCount = selectedPaths.size;
  const selectedFile = activeFile && diffFiles.some((file) => filePath(file) === activeFile) ? activeFile : undefined;

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

  function selectLine(path: string, side: ReviewSide, number: number, shiftKey: boolean) {
    if (shiftKey && anchor && anchor.path === path && anchor.side === side) {
      setSelection({ path, side, start: Math.min(anchor.line, number), end: Math.max(anchor.line, number) });
    } else {
      setAnchor({ path, side, line: number });
      setSelection({ path, side, start: number, end: number });
    }
    setLocalActionError(null);
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
        className={`${COMMENT} ${COMMENT_TONE[comment.status] ?? ""}`}
        data-testid={inline ? "git-inline-comment" : "git-review-list-comment"}
        key={comment.id}
      >
        <div className="flex items-center justify-between gap-2 text-[0.66rem] text-subtext-0">
          <span>{inline ? `Lines ${comment.range.start}${comment.range.end !== comment.range.start ? `–${comment.range.end}` : ""}` : `${comment.path} · ${comment.side} · ${targetLabel(comment.base)}`}</span>
          <ReviewStatusPill comment={comment} />
        </div>
        {!inline && <span className="mt-[0.15rem] block text-[0.64rem] text-subtext-0">{placementLabel(comment, diff)}</span>}
        {editingCommentId === comment.id ? (
          <>
            <textarea
              className={COMMENT_FIELD}
              value={editingBody}
              onChange={(event) => setEditingBody(event.target.value)}
              aria-label="Edit review comment"
            />
            <div className={COMMENT_ACTIONS}>
              <button type="button" className={CA_LINK} onClick={() => saveEdit(comment)}>Save edit</button>
              <button type="button" className={CA_LINK} onClick={() => setEditingCommentId(null)}>Cancel</button>
            </div>
          </>
        ) : <p className="mx-0 my-[0.28rem] whitespace-pre-wrap">{comment.body}</p>}
        {editingCommentId !== comment.id && (
          <div className={COMMENT_ACTIONS}>
            <button type="button" className={CA_LINK} onClick={() => beginEdit(comment)}>Edit</button>
            <button type="button" className={CA_LINK} onClick={() => actions.resolveComment(comment.id, comment.status !== "resolved", comment.version)}>
              {comment.status === "resolved" ? "Reopen" : "Resolve"}
            </button>
            <button type="button" className={CA_LINK_DANGER} onClick={() => actions.deleteComment(comment.id, comment.version)}>Delete</button>
          </div>
        )}
      </article>
    );
  }

  const rail = railOpen ? (
    <aside className="flex min-h-0 w-[17rem] min-w-[13rem] shrink-0 flex-col [border-left:1px_solid_var(--git-border)]" style={narrow ? { width: "100%", minWidth: 0, flex: "0 0 auto", borderLeft: "none", borderBottom: "1px solid var(--git-border)" } : undefined} data-testid="git-status">
      <div className="flex items-center justify-between gap-[0.6rem] px-[0.7rem] py-[0.35rem]">
        <button
          type="button"
          className="flex min-w-0 items-center gap-[0.35rem] text-left text-fg [background:none]" style={narrow ? undefined : { pointerEvents: "none" }}
          aria-expanded={changesOpen}
          onClick={() => setChangesOpen(!changesOpen)}
        >
          <span className="text-[0.6rem] text-subtext-0" style={narrow ? undefined : { display: "none" }} aria-hidden="true">{changesOpen ? "▾" : "▸"}</span>
          <strong>{changedFiles.length ? `${changedFiles.length} changed path${changedFiles.length === 1 ? "" : "s"}` : "No changes"}</strong>
        </button>
        <label className="inline-flex items-center gap-[0.3rem] text-[0.68rem] whitespace-nowrap text-subtext-0">
          <input
            type="checkbox"
            checked={changedFiles.length > 0 && selectedCount === changedFiles.length}
            onChange={(event) => selectAllPaths(event.target.checked)}
            aria-label="Select all changed paths"
          />
          All
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col" style={narrow && !changesOpen ? { display: "none" } : undefined} data-open={changesOpen}>
        {statusState === "loading" && <div className={STATUS_NOTE} role="status">Reading Git status…</div>}
        {statusState === "error" && <div className={cn(STATUS_NOTE, "text-red")} role="alert">{statusError || "Git status is unavailable."}</div>}
        {changedFiles.length > 0 && (
          <div className="px-[0.5rem] pb-[0.35rem]">
            <input className={`${TB_INPUT} w-full`} aria-label="Filter changed files" value={fileFilter} onChange={(event) => setFileFilter(event.target.value)} placeholder="Filter files…" />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-[1px] overflow-y-auto px-[3px] pb-[0.3rem]" style={narrow ? { maxHeight: "16rem", flex: "none" } : undefined} role="tree" aria-label="Changed paths">
          {treeShown.map((row) => row.kind === "dir" ? (
            <button
              type="button"
              key={`dir:${row.key}`}
              className="flex min-w-0 items-center gap-[0.35rem] rounded-ui py-[3px] pr-3 text-left text-subtext-0 [background:none] hover:bg-surface-1"
              style={{ paddingLeft: `${0.55 + row.depth * 0.8}rem` }}
              role="treeitem"
              aria-expanded={row.open}
              onClick={() => toggleDir(row.key)}
            >
              <span className="w-[0.7rem] shrink-0 text-[0.6rem]" aria-hidden="true">{row.open ? "▾" : "▸"}</span>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{row.name}</span>
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-[0.3rem]" key={`file:${row.key}`} role="treeitem">
              <input
                className="shrink-0"
                type="checkbox"
                checked={selectedPaths.has(row.entry.path)}
                onChange={() => selectPath(row.entry.path)}
                aria-label={`Select ${row.entry.path}`}
              />
              <button
                type="button"
                className={`${PATH_BUTTON} ${activeFile === row.entry.path ? PATH_BUTTON_ACTIVE : PATH_BUTTON_IDLE}`}
                style={{ paddingLeft: `${0.1 + row.depth * 0.8}rem` }}
                onClick={() => { setActiveFile(activeFile === row.entry.path ? undefined : row.entry.path); setSelection(null); }}
                title={row.entry.originalPath ? `${row.entry.originalPath} → ${row.entry.path}` : row.entry.path}
              >
                <FileIcon name={row.name} />
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{row.name}</span>
                {lineCounts.has(row.entry.path) && (
                  <span className="shrink-0 whitespace-nowrap text-[0.66rem] [font-family:var(--font-mono)]">
                    {(lineCounts.get(row.entry.path)?.added ?? 0) > 0 && <span className="text-green">+{lineCounts.get(row.entry.path)?.added}</span>}
                    {(lineCounts.get(row.entry.path)?.removed ?? 0) > 0 && <span className="ml-[0.3rem] text-red">−{lineCounts.get(row.entry.path)?.removed}</span>}
                  </span>
                )}
                <GitMarker decoration={{ entry: row.entry }} />
              </button>
            </div>
          ))}
          {statusState !== "loading" && changedFiles.length === 0 && <div className={STATUS_NOTE}>Working tree is clean.</div>}
          {changedFiles.length > 0 && treeShown.length === 0 && <div className={STATUS_NOTE}>No changed file matches.</div>}
        </div>

        <div className="flex flex-col gap-[0.35rem] p-[0.5rem] [border-top:1px_solid_var(--git-border)]">
          <div className="flex items-center gap-[0.2rem]">
            <IconButton icon="stage" label="Stage selected" disabled={selectedCount === 0} onClick={() => actions.stage([...selectedPaths])} />
            <IconButton icon="unstage" label="Unstage" disabled={selectedCount === 0} onClick={() => actions.unstage([...selectedPaths])} />
            <IconButton icon="discard" label="Discard selected" tone="danger" testId="git-discard-preview" disabled={selectedCount === 0} onClick={() => requestDiscard("worktree")} />
            {selectedCount > 0 && <span className="ml-auto text-[0.68rem] text-subtext-0">{selectedCount} selected</span>}
          </div>
          <div className="flex items-center gap-[0.3rem]">
            <input className={`${TB_INPUT} min-w-0 flex-1`} aria-label="Commit staged changes" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Describe the change" />
            <IconButton icon="commit" label="Preview commit" tone="primary" disabled={stagedCount === 0 || !commitMessage.trim()} onClick={requestCommitPreview} />
          </div>
        </div>
      </div>
    </aside>
  ) : null;

  return (
    <section ref={rootRef} className="workspace-git" data-testid="workspace-git-review" aria-label="Git and review">
      <header className="flex shrink-0 items-center gap-2 px-[0.7rem] py-[0.4rem]" title={`${workspaceName || "Workspace"} · ${workspaceId}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2" title={status?.upstream ? `tracks ${status.upstream}` : status ? "No upstream configured" : undefined}>
          <strong className="min-w-0 overflow-hidden text-[0.8rem] text-ellipsis whitespace-nowrap">{status ? status.branch || "Detached HEAD" : workspaceName || "Changes"}</strong>
          {status && <span className="shrink-0 text-yellow [font-family:var(--font-mono)] text-[0.66rem]">{shortHash(status.head)}</span>}
          {(status?.ahead ?? 0) > 0 && <span className="shrink-0 text-[0.68rem] text-green" title={`${status?.ahead} ahead`}>↑{status?.ahead}</span>}
          {(status?.behind ?? 0) > 0 && <span className="shrink-0 text-[0.68rem] text-yellow" title={`${status?.behind} behind`}>↓{status?.behind}</span>}
        </div>
        <span className={cn(CONNECTION, statusState === "ready" ? CONNECTION_READY : statusState === "error" ? CONNECTION_ERROR : CONNECTION_IDLE)} role="status">
          {statusState === "loading" ? "Updating…" : statusState === "error" ? "Status unavailable" : status?.dirty ? "Dirty" : "Clean"}
        </span>
        <IconButton icon="files" label={railOpen ? "Hide files" : "Show files"} testId="git-rail-toggle" pressed={railOpen} onClick={() => setRailOpen(!railOpen)} />
        <IconButton icon="refresh" label="Refresh" testId="git-refresh" onClick={() => { actions.refreshStatus(); actions.listComments(); }} />
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" style={narrow ? { flexDirection: "column", overflow: "auto" } : undefined}>
        {narrow && rail}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={narrow ? { minHeight: "18rem", flex: "auto" } : undefined}>
          <div className="flex shrink-0 flex-wrap items-center gap-x-[0.4rem] gap-y-[0.3rem] px-[0.7rem] py-[0.4rem]">
            <label className={TB_FIELD} title="Compare">
              <Select className={TB_INPUT} testId="git-diff-target" ariaLabel="Compare" value={compareOpen ? "compare" : target.kind === "compare" ? (preset ?? "compare") : target.kind} onChange={chooseTarget}
                options={[
                  { value: "workingTree", label: "Working tree" },
                  { value: "staged", label: "Staged" },
                  { value: "head", label: "HEAD" },
                  { value: "workspaceStart", label: startSnapshot ? "Workspace start" : "Workspace start (not recorded)", disabled: !startSnapshot },
                  { value: "lastAgentTurn", label: turnLabel, disabled: !turnBase },
                  { value: "compare", label: "Another ref…" },
                ]} />
            </label>
            <label className={TB_FIELD} title="Session">
              <Select className={TB_INPUT} testId="git-turn-session" ariaLabel="Turn session" value={agentSessionId ?? ""} onChange={(value) => {
                chooseTarget("workingTree");
                actions.selectAgentSession(value || undefined);
              }}
                options={[{ value: "", label: "Latest in workspace" }, ...sessions.map((session) => ({ value: session.id, label: `${session.title} · ${session.agent ?? "agent"}` }))]} />
            </label>
            <label className={`${TB_FIELD} min-w-[8rem] flex-1`} title="File">
              <Select
                className={`${TB_INPUT} min-w-0 flex-1`}
                ariaLabel="Diff file"
                testId="git-diff-file-select"
                value={selectedFile ?? ""}
                onChange={(value) => { setActiveFile(value || undefined); setSelection(null); }}
                options={[{ value: "", label: `All files · ${diffFiles.length}` }, ...diffFiles.map((file) => { const path = filePath(file); return { value: path, label: `${file.status} · ${path}` }; })]}
              />
            </label>
            {compareOpen && (
              <>
                <label className={TB_FIELD} title="Base">
                  <Select freeText className={TB_INPUT} testId="git-base-selector" ariaLabel="Base ref" value={compareBase} onChange={setCompareBase} placeholder="main"
                    options={[...new Map(refs.map((ref) => [ref.name, { value: ref.name, label: <>{ref.name} <span className="text-subtext-0">{ref.target.slice(0, 8)}</span></>, text: ref.name }])).values()]} />
                </label>
                <label className={TB_FIELD} title="Head (optional)"><input className={`${TB_INPUT} w-[6rem]`} aria-label="Head (optional)" value={compareHead} onChange={(event) => setCompareHead(event.target.value)} placeholder="HEAD" /></label>
                <IconButton icon="clear" label="Clear base" onClick={() => { setCompareBase(""); setCompareHead(""); setCompareOpen(false); setTarget({ kind: "workingTree" }); }} />
              </>
            )}
            <div className="flex shrink-0 items-center gap-[0.15rem]">
              <IconButton icon="untracked" label="Untracked files" pressed={includeUntracked} onClick={() => setIncludeUntracked(!includeUntracked)} />
              <IconButton icon="wrap" label="Wrap lines" pressed={wrapLines} onClick={() => setWrapLines(!wrapLines)} />
              <IconButton icon="whitespace" label="Ignore whitespace" pressed={ignoreWhitespace} onClick={() => setIgnoreWhitespace(!ignoreWhitespace)} />
              {canChooseLayout && <label className={TB_FIELD} title="Diff layout"><Select className={`${TB_INPUT} w-[5.2rem]`} testId="git-diff-layout" ariaLabel="Diff layout" value={diffLayout} onChange={(value) => setDiffLayout(value as "auto" | "unified" | "split")} options={[{ value: "auto", label: "Auto" }, { value: "unified", label: "Unified" }, { value: "split", label: "Split" }]} /></label>}
              <label className={TB_FIELD} title="Context lines"><Select className={`${TB_INPUT} w-[3.6rem]`} ariaLabel="Context" value={String(contextLines)} onChange={(value) => setContextLines(Number(value))} options={[{ value: "0", label: "±0" }, { value: "3", label: "±3" }, { value: "8", label: "±8" }]} /></label>
            </div>
          </div>

          {preset === "lastAgentTurn" && lastAgentTurn && (
            /* The gate asks for the *agent's* changes, so say whose turn this
               is and how much it touched — a diff alone does not answer that. */
            <p className={TURN_SUMMARY} data-testid="git-turn-summary">
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
            <p className={STATUS_NOTE} data-testid="git-turn-unavailable">
              This agent turn was not captured, so it cannot be compared. The next turn records a fresh baseline.
            </p>
          )}

          {/* The diff scrolls itself; the truncation note sits above it and the comment composer below, always in view. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {diffState === "loading" || diffFiles.length === 0 ? (
              <div className="workspace-git__diff min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain" data-testid="git-diff"><EmptyDiffState state={diffState} error={diffError} /></div>
            ) : (
              <>
                {diff?.truncated && <div className={`${BANNER_WARNING} shrink-0`} role="status">This diff is truncated. Narrow the path or comparison before commenting.</div>}
                <DiffView
                  workspaceId={workspaceId}
                  path={selectedFile}
                  wrap={wrapLines}
                  layout={diffLayout}
                  selection={selection}
                  editingCommentId={editingCommentId}
                  editingBody={editingBody}
                  onSelectLine={selectLine}
                  onAddComment={(path, side, line) => { selectLine(path, side, line, false); startComment(); }}
                  onAskAgent={onAskAgent ? (path) => { const file = diffFiles.find((candidate) => filePath(candidate) === path); if (file) askAboutDiff(file); } : undefined}
                  onEditComment={beginEdit}
                  onEditBody={setEditingBody}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingCommentId(null)}
                  onResolve={(comment) => actions.resolveComment(comment.id, comment.status !== "resolved", comment.version)}
                  onDelete={(comment) => actions.deleteComment(comment.id, comment.version)}
                />
                {selection && (
                  <div className="workspace-git__comment-composer m-[0.7rem] min-w-0 shrink-0 rounded-ui bg-surface-0 p-[0.65rem]" data-testid="git-comment-composer">
                    <div className="mb-[0.4rem] flex justify-between gap-2"><strong>Comment on {selection.path}</strong><span className="text-[0.68rem] text-subtext-0">{selection.side} lines {selection.start}–{selection.end}</span></div>
                    <textarea className={COMMENT_FIELD} data-testid="git-comment-body" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave a focused note for the agent…" aria-label="New review comment" />
                    <div className={`${COMMENT_ACTIONS} mt-[0.4rem]`}>{onAskAgent && <button type="button" className={CA_BTN} onClick={() => { const file = diffFiles.find((candidate) => filePathForSide(candidate, selection.side) === selection.path); if (file) askAboutDiff(file, selection); }}>Ask agent about lines…</button>}<button type="button" className={CA_BTN} disabled={!commentBody.trim()} onClick={submitComment}>Add comment</button><button type="button" className={CA_BTN} onClick={() => { setSelection(null); setAnchor(null); }}>Cancel</button></div>
                  </div>
                )}
              </>
            )}
          </div>

          <section className="max-h-[40%] shrink-0 overflow-y-auto [border-top:1px_solid_var(--git-border)]" data-testid="git-review-panel">
            <div className="flex items-center justify-between gap-[0.6rem] px-[0.7rem] py-[0.35rem]"><strong title="Comments stay attached to their path and core-derived anchor. Stale or orphaned anchors require an explicit correction before sending.">{unresolvedCount ? `${unresolvedCount} unresolved note${unresolvedCount === 1 ? "" : "s"}` : "No unresolved notes"}</strong><button type="button" className={BTN_DEFAULT} disabled={!unresolvedCount || batchBusy} onClick={requestBatchPreview} data-testid="git-review-preview">{batchBusy ? "Preparing…" : "Preview packet"}</button></div>
            {unplacedComments.length > 0 && (
              <div className="mx-[0.7rem] mb-[0.55rem] rounded-ui bg-[color-mix(in_srgb,var(--surface-1)_42%,transparent)] p-2" data-testid="git-review-list">
                <div className="flex items-center justify-between gap-2"><span className={EYEBROW}>Other review notes</span><strong>{unplacedComments.length}</strong></div>
                <p className={`${SUMMARY} pt-[0.2rem] pb-[0.25rem]`}>These notes are kept with their server anchor and are not placed on the current diff.</p>
                {unplacedComments.map((comment) => renderCommentCard(comment, false))}
              </div>
            )}
            {unresolvedCount > 0 && (
              <div className="flex items-end gap-[0.55rem] px-[0.7rem] pb-[0.55rem]" style={narrow ? { flexDirection: "column", alignItems: "stretch" } : undefined}>
                <label className={`${TB_FIELD} flex-1`}><span>Send to agent session</span><Select ariaLabel="Send to agent session" className={`${TB_INPUT} min-w-0 flex-1`} value={selectedSessionId ?? ""} onChange={(value) => setSelectedSessionId(value || undefined)} options={[{ value: "", label: "Choose a session" }, ...sessions.map((session) => ({ value: session.id, label: `${session.title}${session.agent ? ` · ${session.agent}` : ""}` }))]} /></label>
                <label className={`${TB_FIELD} flex-[2]`}><span>Request</span><input className={`${TB_INPUT} min-w-0 flex-1`} value={reviewInstruction} onChange={(event) => setReviewInstruction(event.target.value)} /></label>
              </div>
            )}
            {batchPreview && (
              <div className="mx-[0.7rem] mb-[0.7rem] rounded-ui bg-surface-0 p-[0.55rem]" data-testid="git-review-packet"><div className="flex flex-wrap items-center gap-[0.55rem]"><strong>Packet ready</strong><span className="text-[0.7rem] text-subtext-0">{batchPreview.comments.length} anchored note{batchPreview.comments.length === 1 ? "" : "s"}</span><code className="ml-auto text-[0.62rem] text-subtext-0">{batchPreview.packetId}</code></div><pre className="my-[0.45rem] max-h-[8rem] overflow-auto border p-[0.45rem] text-[0.68rem] text-fg whitespace-pre-wrap [font-family:var(--font-mono)]">{batchPreview.markdown}</pre><div className={COMMENT_ACTIONS}><button type="button" className={CA_BTN} onClick={sendBatch} disabled={batchSending} data-testid="git-review-send">{batchSending ? "Sending…" : "Send one packet"}</button><button type="button" className={CA_BTN} onClick={() => setBatchPreview(null)} disabled={batchSending}>Close preview</button></div></div>
            )}
            {batchDelivery && batchDelivery.packetId === batchPreview?.packetId && <div className={BANNER_INFO} role="status" data-testid="git-review-delivery">
              {batchDelivery.delivery === "delivered" ? "Agent received the review packet."
                : batchDelivery.delivery === "unconfirmed" ? "Delivery could not be confirmed. Check the agent conversation before starting another review."
                : "Waiting for the agent to receive the review packet…"}
            </div>}
            {batchSending && (!batchDelivery || batchDelivery.packetId !== batchPreview?.packetId) && <div className={BANNER_INFO} role="status">Sending review packet… waiting for server confirmation.</div>}
          </section>
        </div>
        {!narrow && rail}
      </div>

      {(localActionError || actionError) && <div className="absolute right-[0.8rem] bottom-[0.8rem] z-[5] flex max-w-[min(30rem,calc(100%-1.6rem))] items-center gap-2 rounded-ui bg-panel-bg px-[0.65rem] py-[0.55rem] text-red shadow-[0_8px_24px_rgba(0,0,0,0.35)]" role="alert">{localActionError || actionError}<button type="button" className="[border:0] bg-transparent text-inherit" aria-label="Dismiss" onClick={() => setLocalActionError(null)}>×</button></div>}
      {confirmAction && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[rgba(0,0,0,0.62)] p-4" role="dialog" aria-modal="true" aria-labelledby={confirmTitleId}>
          <div className="max-h-[90%] w-[min(32rem,100%)] overflow-auto rounded-ui bg-panel-bg p-[0.9rem] shadow-[0_12px_32px_rgba(0,0,0,0.5)]" ref={confirmCardRef}>
            <span className={EYEBROW}>Confirm {confirmAction.kind}</span>
            <h3 className="my-[0.3rem]" id={confirmTitleId}>{confirmAction.kind === "commit" ? "Commit staged changes?" : "Discard selected changes?"}</h3>
            <p className="text-subtext-0">{confirmAction.kind === "commit" ? `This will create “${confirmAction.message}” in ${workspaceName || workspaceId}.` : `This permanently changes ${confirmAction.receipt.paths.length} selected path${confirmAction.receipt.paths.length === 1 ? "" : "s"}.`}</p>
            <ul className="my-[0.55rem] max-h-[8rem] overflow-auto pl-[1.2rem] text-[0.7rem] [font-family:var(--font-mono)]">{confirmAction.receipt.paths.map((path) => <li key={path}>{path}</li>)}</ul>
            <div className={COMMENT_ACTIONS}><button ref={confirmButtonRef} type="button" className={CA_BTN_DANGER} data-testid="git-confirm-action" onClick={() => { if (confirmAction.kind === "commit") actions.commit(confirmAction.receipt.previewId, confirmAction.message); else actions.discard(confirmAction.receipt.previewId); setConfirmAction(null); }}>Confirm {confirmAction.kind}</button><button type="button" className={CA_BTN} data-testid="git-cancel-action" onClick={() => setConfirmAction(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
