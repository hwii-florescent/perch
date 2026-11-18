//! `DiffView` (`@perch/sdk` 1.11): the review's diff as `stock:review` draws it, a header per file, a header per hunk,
//! one row per line with both numbers, the marker and the code, the hover `＋`, the selected lines and the comment
//! threads under their lines and the new comment's field under the selected lines. It is its own vertical scroll
//! surface (`git-diff`); each file scrolls sideways on its own. The diff and its comments are read from `gitReviewStore` by `workspaceId`; the props
//! are view state and what the person does comes back through the callbacks. The native client draws the same rows
//! natively (`crates/perch-native/src/diff/`).
import { Fragment, useEffect, useRef, type KeyboardEvent } from "react";
import type { GitDiffFile, GitDiffLine, ReviewComment } from "@perch/shared";
import type * as Sdk from "@perch/sdk";
import { cn } from "../lib/cn";
import { EMPTY_GIT_REVIEW_STATE, useWorkspaceGitReviewStore } from "../gitReviewStore";
import { filePath, filePathForSide, isCommentOnLine, lineNumber, lineSide, statusSymbol } from "../gitReviewAnchors";
import type { ReviewSide } from "./gitReviewModels";

// The gutter (two line numbers and the +/- marker) is the only fixed width; the line's "+" floats over it on hover, so
// the code gets everything else. `ml-*` of a comment thread below must equal this gutter's width.
const DIFF_LINE_BASE = `group/line relative grid grid-cols-[2.5rem_2.5rem_0.9rem_minmax(0,1fr)] items-baseline text-fg [font-family:var(--font-mono)] text-[0.75rem] leading-[1.5] [@container(max-width:700px)]:grid-cols-[2.1rem_2.1rem_0.8rem_minmax(0,1fr)]`;
// Unwrapped, a line is as wide as its text and the diff scrolls sideways; wrapped, it breaks at the pane's width.
const DIFF_LINE = `${DIFF_LINE_BASE} min-w-max whitespace-pre`;
const DIFF_LINE_WRAPPED = `${DIFF_LINE_BASE} whitespace-pre-wrap [overflow-wrap:anywhere]`;
// A selected addition/deletion keeps its green/red tint (the legacy rule order); hover tints accent.
const DIFF_LINE_KIND: Record<string, string> = {
  addition: "bg-[color-mix(in_srgb,var(--green)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
  deletion: "bg-[color-mix(in_srgb,var(--red)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
};
const DIFF_LINE_CONTEXT = "hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const DIFF_LINE_SELECTED = "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const LINE_MARKER_TONE: Record<string, string> = { addition: "text-green", deletion: "text-red" };
const LINE_COMMENT_BUTTON = "absolute top-[0.1rem] left-[0.1rem] grid size-[1.2rem] place-items-center rounded-[999px] bg-panel-bg text-[0.8rem] leading-none text-accent opacity-0 group-hover/line:opacity-90 hover:opacity-100! focus-visible:opacity-100 [@media(hover:none)]:opacity-60";
const COMMENT = "workspace-git__comment mt-[0.3rem] rounded-ui bg-surface-0 px-[0.55rem] py-[0.45rem] whitespace-normal [font-family:inherit]";
const COMMENT_TONE: Record<string, string> = { resolved: "opacity-[0.72]", unresolved: "", stale: "", orphaned: "" };
const PILL_TONE: Record<string, string> = { resolved: "text-green", unresolved: "text-accent", stale: "text-yellow", orphaned: "text-yellow" };
const COMMENT_FIELD = "block min-h-[3.2rem] w-full resize-y rounded-ui bg-surface-1 p-[0.4rem] text-fg";
const CA_LINK = "[border:0] bg-transparent px-[0.3rem] py-[0.2rem] text-[0.66rem]! text-accent";
const CA_LINK_DANGER = `${CA_LINK} [&:hover:not(:disabled)]:text-red`;
const COMMENT_ACTIONS = "flex items-center justify-end gap-[0.3rem]";
const BTN_QUIET = "rounded-ui px-2 py-[0.3rem] whitespace-nowrap disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1 bg-transparent text-fg [&:hover:not(:disabled)]:text-accent";
const COMPOSER = "workspace-git__comment-composer sticky left-0 mt-[0.2rem] mr-[0.7rem] mb-[0.45rem] ml-[6.1rem] max-w-[min(42rem,calc(100cqi-6.9rem))] rounded-ui bg-surface-0 p-[0.65rem] whitespace-normal [@container(max-width:700px)]:ml-[5.2rem]";
const CA_BTN = "rounded-ui bg-transparent px-2 py-[0.3rem] text-[0.66rem]! whitespace-nowrap text-accent disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1";
const EMPTY = "flex min-h-[10rem] flex-col items-center justify-center gap-[0.35rem] p-6 text-center text-subtext-0 [&_strong]:text-fg";

/** A path with its directory dimmed and its name plain; the directory gives way first when the row is narrow. */
function PathLabel({ path }: { path: string }) {
  const cut = path.lastIndexOf("/") + 1;
  const [dir, name] = [path.slice(0, cut), path.slice(cut)];
  return (
    <span className="flex min-w-0 overflow-hidden whitespace-nowrap">
      {dir && <span className="min-w-0 overflow-hidden text-ellipsis text-subtext-0">{dir}</span>}
      <span className="min-w-0 shrink-[0.001] overflow-hidden text-ellipsis">{name}</span>
    </span>
  );
}

export function DiffView(props: Sdk.DiffViewProps) {
  const { workspaceId, path: selectedFile, wrap, selection, editingCommentId, editingBody } = props;
  const state = useWorkspaceGitReviewStore((current) => current.workspaces[workspaceId] ?? EMPTY_GIT_REVIEW_STATE);
  const { diff, comments } = state;
  const files = diff?.files ?? [];
  const displayed = selectedFile && files.some((file) => filePath(file) === selectedFile) ? files.filter((file) => filePath(file) === selectedFile) : files;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // `reveal` scrolls to the file's header, once the diff holds it.
  const revealed = useRef<number | null>(null);
  useEffect(() => {
    const reveal = props.reveal;
    if (!reveal || revealed.current === reveal.seq) return;
    const article = [...(rootRef.current?.querySelectorAll<HTMLElement>("article[data-file-path]") ?? [])].find((node) => node.dataset.filePath === reveal.path);
    if (!article) return;
    revealed.current = reveal.seq;
    article.scrollIntoView({ block: "start" });
  }, [props.reveal, displayed]);

  function select(path: string, line: GitDiffLine, extend: boolean) {
    const side = lineSide(line);
    const number = lineNumber(line, side);
    if (number !== undefined) props.onSelectLine(path, side, number, extend);
  }

  function onLineKeyDown(event: KeyboardEvent<HTMLDivElement>, path: string, line: GitDiffLine) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(path, line, event.shiftKey);
    }
  }

  function commentCard(comment: ReviewComment) {
    return (
      <article className={`${COMMENT} ${COMMENT_TONE[comment.status] ?? ""}`} data-testid="git-inline-comment" key={comment.id}>
        <div className="flex items-center justify-between gap-2 text-[0.66rem] text-subtext-0">
          <span>{`Lines ${comment.range.start}${comment.range.end !== comment.range.start ? `–${comment.range.end}` : ""}`}</span>
          <span className={`rounded-[999px] bg-surface-1 px-[0.3rem] py-[0.1rem] capitalize ${PILL_TONE[comment.status] ?? "text-subtext-0"}`}>
            {comment.status}
            {comment.anchorConfidence !== "exact" && ` · ${comment.anchorConfidence} anchor`}
          </span>
        </div>
        {editingCommentId === comment.id ? (
          <>
            <textarea className={COMMENT_FIELD} value={editingBody ?? ""} onChange={(event) => props.onEditBody(event.target.value)} aria-label="Edit review comment" />
            <div className={COMMENT_ACTIONS}>
              <button type="button" className={CA_LINK} onClick={() => props.onSaveEdit(comment)}>Save edit</button>
              <button type="button" className={CA_LINK} onClick={() => props.onCancelEdit()}>Cancel</button>
            </div>
          </>
        ) : <p className="mx-0 my-[0.28rem] whitespace-pre-wrap">{comment.body}</p>}
        {editingCommentId !== comment.id && (
          <div className={COMMENT_ACTIONS}>
            <button type="button" className={CA_LINK} onClick={() => props.onEditComment(comment)}>Edit</button>
            <button type="button" className={CA_LINK} onClick={() => props.onResolve(comment)}>{comment.status === "resolved" ? "Reopen" : "Resolve"}</button>
            <button type="button" className={CA_LINK_DANGER} onClick={() => props.onDelete(comment)}>Delete</button>
          </div>
        )}
      </article>
    );
  }

  function thread(path: string, side: ReviewSide, line: number) {
    const lineComments = comments.filter((comment) => isCommentOnLine(comment, path, side, line, diff));
    if (lineComments.length === 0) return null;
    return (
      <div className="workspace-git__line-comment-thread col-[1/-1] mt-[0.2rem] mr-[0.7rem] mb-[0.35rem] ml-[6.1rem] [@container(max-width:700px)]:ml-[5.2rem]" data-testid="git-line-comments">
        {lineComments.map(commentCard)}
      </div>
    );
  }

  /** The new comment's field, under the selection's last line. */
  function composer() {
    if (!selection) return null;
    return (
      <div className={COMPOSER} data-testid="git-comment-composer">
        <div className="mb-[0.4rem] flex justify-between gap-2 text-[0.68rem] text-subtext-0"><span>Comment on {selection.path}</span><span>{selection.side} {selection.start === selection.end ? `line ${selection.start}` : `lines ${selection.start}–${selection.end}`}</span></div>
        <textarea
          className={COMMENT_FIELD}
          data-testid="git-comment-body"
          value={props.commentBody ?? ""}
          onChange={(event) => props.onCommentBody?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && props.commentBody?.trim()) { event.preventDefault(); props.onSubmitComment?.(); }
            else if (event.key === "Escape") { event.preventDefault(); props.onCancelComment?.(); }
          }}
          placeholder="Leave a focused note for the agent…"
          aria-label="New review comment"
        />
        <div className={`${COMMENT_ACTIONS} mt-[0.4rem]`}>
          {props.onAskLines && <button type="button" className={CA_BTN} onClick={() => props.onAskLines?.()}>Ask agent about lines…</button>}
          <button type="button" className={CA_BTN} disabled={!props.commentBody?.trim()} onClick={() => props.onSubmitComment?.()}>{props.commentLabel ?? "Add comment"}</button>
          <button type="button" className={CA_BTN} onClick={() => props.onCancelComment?.()}>Cancel</button>
        </div>
      </div>
    );
  }

  function file(file: GitDiffFile) {
    const displayPath = filePath(file);
    const folded = props.collapsed?.includes(displayPath) ?? false;
    const viewed = props.viewed?.includes(displayPath) ?? false;
    return (
      <article key={displayPath} data-file-path={displayPath}>
        <header className="sticky top-0 left-0 z-[2] flex w-[100cqi] items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--surface-1)_70%,var(--panel-bg))] px-[0.7rem] py-[0.3rem]">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-[0.3rem] text-left text-fg [background:none] [font-family:var(--font-mono)] text-[0.75rem]" title={displayPath} aria-expanded={!folded} data-testid="git-file-fold" disabled={!props.onToggleCollapsed} onClick={() => props.onToggleCollapsed?.(displayPath)}>
            <span className="w-[0.9rem] shrink-0 text-[0.6rem] text-subtext-0" aria-hidden="true">{folded ? "▸" : "▾"}</span>
            <PathLabel path={displayPath} />
          </button>
          <span className="shrink-0 text-[0.68rem] text-subtext-0 capitalize">{file.status}{file.isBinary ? " · binary" : ""}</span>
          {props.onToggleViewed && <label className={`inline-flex shrink-0 items-center gap-[0.3rem] text-[0.68rem] ${viewed ? "text-accent" : "text-subtext-0"}`}><input type="checkbox" data-testid="git-file-viewed" checked={viewed} onChange={() => props.onToggleViewed?.(displayPath)} />Viewed</label>}
          {props.onAskAgent && <button type="button" className={`${BTN_QUIET} shrink-0`} disabled={file.isBinary || state.diffState !== "ready"} aria-label="Ask agent about diff…" title="Ask agent about this diff" onClick={() => props.onAskAgent?.(displayPath)}>Ask agent</button>}
        </header>
        {/* Each file scrolls sideways on its own, with its own scrollbar (as GitHub's Files changed). */}
        {folded ? null : file.isBinary ? <div className={EMPTY}>Binary content is not rendered. Status and path remain available for review.</div> : <div className={wrap ? "" : "overflow-x-auto overscroll-x-contain"} data-testid="git-diff-file-body"><div className={wrap ? "" : "min-w-max"}>{file.hunks.map((hunk, hunkIndex) => (
          <section key={`${displayPath}:${hunkIndex}`}>
            <div className="sticky left-0 w-[100cqi] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel-bg))] px-[0.7rem] py-[2px] text-accent [font-family:var(--font-mono)] text-[0.68rem]">{hunk.header || `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`}</div>
            {hunk.lines.map((line, lineIndex) => {
              const side = lineSide(line);
              const path = filePathForSide(file, side);
              const number = lineNumber(line, side);
              const selected = number !== undefined && selection?.path === path && selection.side === side && number >= selection.start && number <= selection.end;
              const composerHere = props.onSubmitComment && selected && number === selection?.end;
              return (
                <Fragment key={`${path}:${hunkIndex}:${lineIndex}`}>
                <div
                  className={`${wrap ? DIFF_LINE_WRAPPED : DIFF_LINE} ${DIFF_LINE_KIND[line.kind] ?? `${DIFF_LINE_CONTEXT}${selected ? ` ${DIFF_LINE_SELECTED}` : ""}`}`}
                  data-testid="git-diff-line"
                  data-path={path}
                  data-side={side}
                  data-old-line={line.oldLine ?? ""}
                  data-new-line={line.newLine ?? ""}
                  role="button"
                  tabIndex={number === undefined ? -1 : 0}
                  onClick={(event) => select(path, line, event.shiftKey)}
                  onKeyDown={(event) => onLineKeyDown(event, path, line)}
                >
                  <span className="min-h-[1.5em] pr-[0.35rem] text-right text-overlay-0 select-none" aria-label={`Old line ${line.oldLine ?? "none"}`}>{line.oldLine ?? ""}</span>
                  <span className="min-h-[1.5em] pr-[0.35rem] text-right text-overlay-0 select-none" aria-label={`New line ${line.newLine ?? "none"}`}>{line.newLine ?? ""}</span>
                  <span className={`text-center select-none ${LINE_MARKER_TONE[line.kind] ?? "text-subtext-0"}`} aria-hidden="true">{statusSymbol(line.kind)}</span>
                  <code className="min-w-0 overflow-visible text-inherit [font:inherit]">{line.content || " "}</code>
                  {number !== undefined && <button type="button" className={LINE_COMMENT_BUTTON} data-testid="git-comment-add" aria-label={`Comment on ${path} line ${number}`} onClick={(event) => { event.stopPropagation(); props.onAddComment(path, side, number); }}>＋</button>}
                  {number !== undefined && thread(path, side, number)}
                </div>
                {composerHere && composer()}
                </Fragment>
              );
            })}
          </section>
        ))}</div></div>}
      </article>
    );
  }

  return (
    <div ref={rootRef} className={cn("workspace-git__diff min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain", props.className)} data-testid="git-diff">
      {displayed.map(file)}
    </div>
  );
}
