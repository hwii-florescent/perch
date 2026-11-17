// review.tsx of Perch's stock screen "stock:review", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! The review's presentation: status list, diff, line selection and comments, the comment and commit composers,
//! discard/commit confirmations and the review packet. Everything it shows and does comes in as props from
//! `main.tsx` (Perch's `gitReviewStore` and Context Bridge through `@perch/sdk`); it owns no Git or review logic.
//! What must survive this code being reloaded or swapped (unsent comment and commit text, the line being
//! commented, the prepared packet and its send operation id, a send in flight) is kept by the host under the
//! workspace's key (`useResourceState`), so every copy of this screen for one workspace shares it. Only
//! transient UI (an open confirmation, a busy flag of a request this copy is awaiting) is the copy's own.
import { useEffect, useMemo, useRef, useState } from "react";
import { cn, DiffView, FileIcon, GitMarker, newId, Select, useResourceState, } from "@perch/sdk";
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
const TB_CHECK = "inline-flex items-center gap-[0.3rem] text-[0.68rem] whitespace-nowrap text-subtext-0";
const TB_GROUP = "flex max-w-full min-w-0 flex-wrap items-center gap-[0.45rem]";
const DIFF_FILE = "flex min-w-0 flex-col items-start gap-[0.1rem] rounded-ui px-[0.45rem] py-[0.42rem] text-left text-fg [background:none] hover:bg-surface-1";
const COMMENT = "workspace-git__comment mt-[0.3rem] rounded-ui bg-surface-0 px-[0.55rem] py-[0.45rem] whitespace-normal [font-family:inherit]";
const COMMENT_TONE = { resolved: "opacity-[0.72]", unresolved: "", stale: "", orphaned: "" };
const PILL_TONE = { resolved: "text-green", unresolved: "text-accent", stale: "text-yellow", orphaned: "text-yellow" };
const COMMENT_FIELD = "block min-h-[3.2rem] w-full resize-y rounded-ui bg-surface-1 p-[0.4rem] text-fg";
// The legacy `.workspace-git button { font: inherit }` out-ranked `__button`'s font-size, so these keep the inherited size
// (and `comment-actions` buttons need `!` to beat that unlayered reset, as the old later same-specificity rule did).
const BTN = "rounded-ui px-2 py-[0.3rem] whitespace-nowrap disabled:cursor-not-allowed! disabled:opacity-[0.45] [&:hover:not(:disabled)]:bg-surface-1";
const BTN_DEFAULT = `${BTN} bg-surface-1 text-fg [&:hover:not(:disabled)]:text-accent`;
const BTN_QUIET = `${BTN} bg-transparent text-fg [&:hover:not(:disabled)]:text-accent`;
const BTN_PRIMARY = `${BTN} bg-accent text-panel-bg`;
const BTN_DANGER = `${BTN} bg-surface-1 text-red [&:hover:not(:disabled)]:text-red`;
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
function targetKey(target) {
    return target.kind === "compare" ? `compare:${target.base}:${target.head ?? ""}` : target.kind;
}
function filePath(file) {
    return file.newPath ?? file.oldPath ?? "(unknown file)";
}
function filePathForSide(file, side) {
    if (side === "old")
        return file.oldPath ?? file.newPath ?? "(unknown file)";
    return file.newPath ?? file.oldPath ?? "(unknown file)";
}
function splitPath(path) {
    const cut = path.lastIndexOf("/") + 1;
    return [path.slice(0, cut), path.slice(cut)];
}
/** A path with its directory dimmed and its name plain; the directory gives way first when the row is narrow. */
function PathLabel({ path, className }) {
    const [dir, name] = splitPath(path);
    return (_jsxs("span", {
        className: cn("flex min-w-0 overflow-hidden whitespace-nowrap", className),
        children: [
            dir && _jsx("span", {
                className: "min-w-0 overflow-hidden text-ellipsis text-subtext-0",
                children: dir
            }),
            _jsx("span", {
                className: "min-w-0 shrink-[0.001] overflow-hidden text-ellipsis",
                children: name
            })
        ]
    }));
}
function shortHash(value) {
    return value ? value.slice(0, 8) : "—";
}
function lineNumber(line, side) {
    if (side === "old")
        return line.oldLine;
    if (side === "new")
        return line.newLine;
    return line.newLine ?? line.oldLine;
}
function lineSide(line) {
    if (line.kind === "deletion")
        return "old";
    return "new";
}
function statusSymbol(line) {
    if (line === "addition")
        return "+";
    if (line === "deletion")
        return "−";
    return " ";
}
function newOperationId() {
    return newId();
}
function sourceRevisionFor(diff, path, side) {
    if (!diff)
        return undefined;
    const revisions = diff.sourceRevisions;
    if (revisions) {
        return revisions[`${path}:${side}`] ?? revisions[`${side}:${path}`] ?? revisions[path] ?? diff.sourceRevision;
    }
    return diff.sourceRevision;
}
function sameRange(left, right) {
    return left.start === right.start && left.end === right.end;
}
function anchorMatchesComment(comment) {
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
function commentMatchesDiff(comment, diff) {
    if (!diff || comment.status === "stale" || comment.status === "orphaned" || comment.anchorConfidence === "none")
        return false;
    if (comment.side === "file")
        return false;
    if (targetKey(comment.base) !== targetKey(diff.target) || !anchorMatchesComment(comment))
        return false;
    const revision = sourceRevisionFor(diff, comment.path, comment.side);
    return Boolean(revision && comment.baseRevision === revision);
}
function diffContainsCommentLine(comment, diff) {
    if (!commentMatchesDiff(comment, diff) || !diff)
        return false;
    return diff.files.some((file) => {
        const path = filePathForSide(file, comment.side);
        if (path !== comment.path)
            return false;
        return file.hunks.some((hunk) => hunk.lines.some((line) => {
            if (lineSide(line) !== comment.side)
                return false;
            const number = lineNumber(line, comment.side);
            return number !== undefined && number >= comment.range.start && number <= comment.range.end;
        }));
    });
}
function targetLabel(target) {
    switch (target.kind) {
        case "workingTree": return "Working tree";
        case "staged": return "Staged";
        case "head": return "HEAD";
        case "compare": return `Compare ${target.base}${target.head ? `…${target.head}` : "…worktree"}`;
    }
}
function placementLabel(comment, diff) {
    if (comment.status === "stale" || comment.status === "orphaned")
        return `${comment.status} anchor`;
    if (!diff)
        return "Not shown in this diff";
    if (targetKey(comment.base) !== targetKey(diff.target))
        return `Different target · ${targetLabel(comment.base)}`;
    if (!anchorMatchesComment(comment))
        return "Anchor metadata needs review";
    const revision = sourceRevisionFor(diff, comment.path, comment.side);
    if (!revision)
        return "Source revision unavailable";
    if (comment.baseRevision !== revision)
        return "Source changed since comment";
    return "Outside visible lines";
}
function ReviewStatusPill({ comment }) {
    return (_jsxs("span", {
        className: `rounded-[999px] bg-surface-1 px-[0.3rem] py-[0.1rem] capitalize ${PILL_TONE[comment.status] ?? "text-subtext-0"}`,
        children: [
            comment.status,
            comment.anchorConfidence !== "exact" && ` · ${comment.anchorConfidence} anchor`
        ]
    }));
}
function EmptyDiffState({ state, error }) {
    if (state === "loading")
        return _jsx("div", {
            className: EMPTY,
            role: "status",
            children: "Loading workspace diff\u2026"
        });
    if (state === "error")
        return _jsx("div", {
            className: EMPTY_ERROR,
            role: "alert",
            children: error || "Diff could not be loaded."
        });
    return (_jsxs("div", {
        className: EMPTY,
        "data-testid": "git-diff-empty",
        children: [
            _jsx("strong", { children: "No changes in this comparison" }),
            _jsx("span", { children: "Choose another base or make a workspace edit to review it here." })
        ]
    }));
}
export function WorkspaceGitReview({ workspaceId, workspaceName, startSnapshot, lastAgentTurn, agentSessionId, status, statusState, statusError, actionError, diff, diffState, diffError, comments, refs = [], batchDelivery, sessions = [], currentRevision, actions, onAskAgent, }) {
    const [target, setTarget] = useResourceState(`review:${workspaceId}:target`, { kind: "workingTree" });
    // Which named preset produced a `compare` target, so the selector can tell
    // "Workspace start" from "Last agent turn" — both are compare targets.
    const [preset, setPreset] = useResourceState(`review:${workspaceId}:preset`, null);
    const [compareOpen, setCompareOpen] = useState(false);
    const [compareBase, setCompareBase] = useResourceState(`review:${workspaceId}:compareBase`, "");
    const [compareHead, setCompareHead] = useResourceState(`review:${workspaceId}:compareHead`, "");
    const [includeUntracked, setIncludeUntracked] = useResourceState(`review:${workspaceId}:includeUntracked`, true);
    const [wrapLines, setWrapLines] = useResourceState(`review:${workspaceId}:wrapLines`, false);
    const [ignoreWhitespace, setIgnoreWhitespace] = useResourceState(`review:${workspaceId}:ignoreWhitespace`, false);
    const [contextLines, setContextLines] = useResourceState(`review:${workspaceId}:contextLines`, 3);
    const [activeFile, setActiveFile] = useResourceState(`review:${workspaceId}:activeFile`, undefined);
    const [selectedPaths, setSelectedPaths] = useResourceState(`review:${workspaceId}:selectedPaths`, new Set());
    const [selection, setSelection] = useResourceState(`review:${workspaceId}:selection`, null);
    const [anchor, setAnchor] = useResourceState(`review:${workspaceId}:anchor`, null);
    const [commentBody, setCommentBody] = useResourceState(`review:${workspaceId}:commentBody`, "");
    const [editingCommentId, setEditingCommentId] = useResourceState(`review:${workspaceId}:editingCommentId`, null);
    const [editingBody, setEditingBody] = useResourceState(`review:${workspaceId}:editingBody`, "");
    const [commitMessage, setCommitMessage] = useResourceState(`review:${workspaceId}:commitMessage`, "");
    const [changesOpen, setChangesOpen] = useResourceState(`review:${workspaceId}:changesOpen`, true);
    const [railOpen, setRailOpen] = useResourceState(`review:${workspaceId}:railOpen`, true);
    const [diffLayout, setDiffLayout] = useResourceState(`review:${workspaceId}:diffLayout`, "auto");
    // Whether the host's diff can show a change side by side (the native client's can).
    const canChooseLayout = DiffView.splitLayout === true;
    // The narrow layout goes by the review's own width. A container query would do on the web, but the native
    // runtime matches those against the window, and its `ResizeObserver` never fires, so the box is read on a timer.
    const rootRef = useRef(null);
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        const read = () => {
            const width = rootRef.current?.getBoundingClientRect().width ?? 0;
            if (width > 0)
                setNarrow(width <= NARROW_WIDTH);
        };
        read();
        const timer = setInterval(read, 250);
        return () => clearInterval(timer);
    }, []);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [localActionError, setLocalActionError] = useState(null);
    const [selectedSessionId, setSelectedSessionId] = useResourceState(`review:${workspaceId}:selectedSessionId`, sessions[0]?.id);
    const [reviewInstruction, setReviewInstruction] = useResourceState(`review:${workspaceId}:reviewInstruction`, "Please address these review notes.");
    const [batchPreview, setBatchPreview] = useResourceState(`review:${workspaceId}:batchPreview`, null);
    const [batchBusy, setBatchBusy] = useState(false);
    const [batchSending, setBatchSending] = useResourceState(`review:${workspaceId}:batchSending`, false);
    const confirmButtonRef = useRef(null);
    const confirmCardRef = useRef(null);
    const confirmTitleId = `workspace-git-confirm-title-${workspaceId}`;
    const compareTarget = useMemo(() => (compareBase.trim()
        ? { kind: "compare", base: compareBase.trim(), ...(compareHead.trim() ? { head: compareHead.trim() } : {}) }
        : { kind: "head" }), [compareBase, compareHead]);
    useEffect(() => {
        actions.refreshStatus();
        actions.listRefs();
        actions.listComments();
    }, [actions, workspaceId]);
    useEffect(() => {
        if (actionError)
            setBatchSending(false);
    }, [actionError]);
    useEffect(() => {
        if (!confirmAction)
            return;
        confirmButtonRef.current?.focus();
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setConfirmAction(null);
                return;
            }
            if (event.key !== "Tab")
                return;
            const card = confirmCardRef.current;
            if (!card)
                return;
            const focusable = [...card.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last)
                return;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [confirmAction]);
    // A turn without a base ref is not a comparison, whatever else it says.
    const turnBase = lastAgentTurn && lastAgentTurn.state !== "unavailable" && lastAgentTurn.beforeRef
        ? { kind: "compare", base: lastAgentTurn.beforeRef, ...(lastAgentTurn.afterRef ? { head: lastAgentTurn.afterRef } : {}) }
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
        if (preset !== "lastAgentTurn")
            return;
        if (!turnBase) {
            setPreset(null);
            setTarget({ kind: "workingTree" });
            setActiveFile(undefined);
            setSelection(null);
            return;
        }
        setTarget((previous) => (previous.kind === "compare" && previous.base === turnBase.base && previous.head === turnBase.head
            ? previous
            : turnBase));
    }, [preset, turnBase?.base, turnBase?.head]);
    useEffect(() => {
        actions.loadDiff(compareOpen && compareBase.trim() ? compareTarget : target, activeFile, {
            includeUntracked,
            ignoreWhitespace,
            contextLines,
        });
    }, [actions, activeFile, compareBase, compareHead, compareOpen, contextLines, ignoreWhitespace, includeUntracked, target, workspaceId, compareTarget]);
    useEffect(() => {
        if (!status)
            return;
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
    const inlineCommentIds = useMemo(() => new Set(comments.filter((comment) => diffContainsCommentLine(comment, diff)).map((comment) => comment.id)), [comments, diff]);
    const unplacedComments = comments.filter((comment) => !inlineCommentIds.has(comment.id));
    const stagedCount = changedFiles.filter((entry) => entry.staged).length;
    function askAboutDiff(file, range) {
        if (!diff || !onAskAgent)
            return;
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
    function chooseTarget(value) {
        if (value === "compare") {
            setCompareOpen(true);
            setPreset(null);
            setTarget({ kind: "head" });
            return;
        }
        setCompareOpen(false);
        if (value === "workspaceStart") {
            if (!startSnapshot)
                return;
            setPreset("workspaceStart");
            setTarget({ kind: "compare", base: startSnapshot });
        }
        else if (value === "lastAgentTurn") {
            if (!turnBase)
                return;
            setPreset("lastAgentTurn");
            // The recorded after side pins the turn's own end. A turn still running
            // has none, so the working tree stands in and the diff grows as the
            // agent works. A turn whose after side will never arrive is not offered.
            setTarget(turnBase);
        }
        else {
            setPreset(null);
            setTarget({ kind: value });
        }
        setActiveFile(undefined);
        setSelection(null);
    }
    function selectPath(path) {
        setSelectedPaths((previous) => {
            const next = new Set(previous);
            if (next.has(path))
                next.delete(path);
            else
                next.add(path);
            return next;
        });
    }
    function selectAllPaths(checked) {
        setSelectedPaths(checked ? new Set(changedFiles.map((entry) => entry.path)) : new Set());
    }
    function selectLine(path, side, number, shiftKey) {
        if (shiftKey && anchor && anchor.path === path && anchor.side === side) {
            setSelection({ path, side, start: Math.min(anchor.line, number), end: Math.max(anchor.line, number) });
        }
        else {
            setAnchor({ path, side, line: number });
            setSelection({ path, side, start: number, end: number });
        }
        setLocalActionError(null);
    }
    function startComment() {
        if (!selection)
            return;
        setCommentBody("");
        setLocalActionError(null);
    }
    function submitComment() {
        if (!selection || !commentBody.trim())
            return;
        actions.createComment({ ...selection, body: commentBody.trim() });
        setCommentBody("");
        setSelection(null);
        setAnchor(null);
    }
    function beginEdit(comment) {
        setEditingCommentId(comment.id);
        setEditingBody(comment.body);
        setLocalActionError(null);
    }
    function saveEdit(comment) {
        if (!editingBody.trim())
            return;
        actions.updateComment(comment.id, editingBody.trim(), comment.version);
        setEditingCommentId(null);
    }
    async function requestDiscard(mode) {
        if (selectedCount === 0) {
            setLocalActionError("Select at least one changed path first.");
            return;
        }
        setLocalActionError(null);
        const receipt = await actions.discardPreview(mode, [...selectedPaths]);
        if (receipt)
            setConfirmAction({ kind: "discard", receipt });
        else
            setLocalActionError("The discard preview could not be created. Refresh status and try again.");
    }
    async function requestCommitPreview() {
        if (!commitMessage.trim()) {
            setLocalActionError("Enter a commit message first.");
            return;
        }
        setLocalActionError(null);
        const receipt = await actions.commitPreview(commitMessage.trim());
        if (receipt)
            setConfirmAction({ kind: "commit", receipt, message: commitMessage.trim() });
        else
            setLocalActionError("The commit preview could not be created. Refresh status and try again.");
    }
    async function requestBatchPreview() {
        if (unresolvedCount === 0)
            return;
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
        if (!preview)
            setLocalActionError("The review packet could not be prepared. Refresh comments and try again.");
    }
    async function sendBatch() {
        if (!batchPreview || batchSending)
            return;
        setLocalActionError(null);
        setBatchSending(true);
        try {
            await actions.sendBatch(batchPreview.packetId, batchPreview.sendOperationId);
        }
        catch (error) {
            setLocalActionError(error instanceof Error ? error.message : "Review send could not be confirmed.");
        }
        finally {
            setBatchSending(false);
        }
    }
    function renderCommentCard(comment, inline) {
        return (_jsxs("article", {
            className: `${COMMENT} ${COMMENT_TONE[comment.status] ?? ""}`,
            "data-testid": inline ? "git-inline-comment" : "git-review-list-comment",
            children: [
                _jsxs("div", {
                    className: "flex items-center justify-between gap-2 text-[0.66rem] text-subtext-0",
                    children: [
                        _jsx("span", { children: inline ? `Lines ${comment.range.start}${comment.range.end !== comment.range.start ? `–${comment.range.end}` : ""}` : `${comment.path} · ${comment.side} · ${targetLabel(comment.base)}` }),
                        _jsx(ReviewStatusPill, { comment: comment })
                    ]
                }),
                !inline && _jsx("span", {
                    className: "mt-[0.15rem] block text-[0.64rem] text-subtext-0",
                    children: placementLabel(comment, diff)
                }),
                editingCommentId === comment.id ? (_jsxs(_Fragment, { children: [_jsx("textarea", {
                            className: COMMENT_FIELD,
                            value: editingBody,
                            onChange: (event) => setEditingBody(event.target.value),
                            "aria-label": "Edit review comment"
                        }), _jsxs("div", {
                            className: COMMENT_ACTIONS,
                            children: [
                                _jsx("button", {
                                    type: "button",
                                    className: CA_LINK,
                                    onClick: () => saveEdit(comment),
                                    children: "Save edit"
                                }),
                                _jsx("button", {
                                    type: "button",
                                    className: CA_LINK,
                                    onClick: () => setEditingCommentId(null),
                                    children: "Cancel"
                                })
                            ]
                        })] })) : _jsx("p", {
                    className: "mx-0 my-[0.28rem] whitespace-pre-wrap",
                    children: comment.body
                }),
                editingCommentId !== comment.id && (_jsxs("div", {
                    className: COMMENT_ACTIONS,
                    children: [
                        _jsx("button", {
                            type: "button",
                            className: CA_LINK,
                            onClick: () => beginEdit(comment),
                            children: "Edit"
                        }),
                        _jsx("button", {
                            type: "button",
                            className: CA_LINK,
                            onClick: () => actions.resolveComment(comment.id, comment.status !== "resolved", comment.version),
                            children: comment.status === "resolved" ? "Reopen" : "Resolve"
                        }),
                        _jsx("button", {
                            type: "button",
                            className: CA_LINK_DANGER,
                            onClick: () => actions.deleteComment(comment.id, comment.version),
                            children: "Delete"
                        })
                    ]
                }))
            ]
        }, comment.id));
    }
    const optionsChanged = !includeUntracked || ignoreWhitespace || wrapLines || diffLayout !== "auto" || contextLines !== 3;
    return (_jsxs("section", {
        ref: rootRef,
        className: "workspace-git",
        "data-testid": "workspace-git-review",
        "aria-label": "Git and review",
        children: [
            _jsxs("header", {
                className: "flex shrink-0 items-center gap-2 px-[0.7rem] py-[0.4rem]",
                title: `${workspaceName || "Workspace"} · ${workspaceId}`,
                children: [
                    _jsxs("div", {
                        className: "flex min-w-0 flex-1 items-center gap-2",
                        title: status?.upstream ? `tracks ${status.upstream}` : status ? "No upstream configured" : undefined,
                        children: [
                            _jsx("strong", {
                                className: "min-w-0 overflow-hidden text-[0.8rem] text-ellipsis whitespace-nowrap",
                                children: status ? status.branch || "Detached HEAD" : workspaceName || "Changes"
                            }),
                            status && _jsx("span", {
                                className: "shrink-0 text-yellow [font-family:var(--font-mono)] text-[0.66rem]",
                                children: shortHash(status.head)
                            }),
                            (status?.ahead ?? 0) > 0 && _jsxs("span", {
                                className: "shrink-0 text-[0.68rem] text-green",
                                title: `${status?.ahead} ahead`,
                                children: [
                                    "\u2191",
                                    status?.ahead
                                ]
                            }),
                            (status?.behind ?? 0) > 0 && _jsxs("span", {
                                className: "shrink-0 text-[0.68rem] text-yellow",
                                title: `${status?.behind} behind`,
                                children: [
                                    "\u2193",
                                    status?.behind
                                ]
                            })
                        ]
                    }),
                    _jsx("span", {
                        className: cn(CONNECTION, statusState === "ready" ? CONNECTION_READY : statusState === "error" ? CONNECTION_ERROR : CONNECTION_IDLE),
                        role: "status",
                        children: statusState === "loading" ? "Updating…" : statusState === "error" ? "Status unavailable" : status?.dirty ? "Dirty" : "Clean"
                    }),
                    _jsx("button", {
                        type: "button",
                        className: BTN_DEFAULT,
                        "data-testid": "git-rail-toggle",
                        "aria-pressed": railOpen,
                        title: railOpen ? "Hide the changed files to give the diff the room" : "Show the changed files",
                        onClick: () => setRailOpen(!railOpen),
                        children: railOpen ? "Hide files" : "Show files"
                    }),
                    _jsx("button", {
                        type: "button",
                        className: BTN_DEFAULT,
                        "data-testid": "git-refresh",
                        onClick: () => { actions.refreshStatus(); actions.listComments(); },
                        children: "Refresh"
                    })
                ]
            }),
            _jsxs("div", {
                className: "flex min-h-0 min-w-0 flex-1 overflow-hidden",
                style: narrow ? { flexDirection: "column", overflow: "auto" } : undefined,
                children: [
                    railOpen && _jsxs("aside", {
                        className: "flex min-h-0 w-[15rem] min-w-[12rem] shrink-0 flex-col [border-right:1px_solid_var(--git-border)]",
                        style: narrow ? { width: "100%", minWidth: 0, flex: "0 0 auto", borderRight: "none", borderBottom: "1px solid var(--git-border)" } : undefined,
                        "data-testid": "git-status",
                        children: [
                            _jsxs("div", {
                                className: "flex items-center justify-between gap-[0.6rem] px-[0.7rem] py-[0.35rem]",
                                children: [
                                    _jsxs("button", {
                                        type: "button",
                                        className: "flex min-w-0 items-center gap-[0.35rem] text-left text-fg [background:none]",
                                        style: narrow ? undefined : { pointerEvents: "none" },
                                        "aria-expanded": changesOpen,
                                        onClick: () => setChangesOpen(!changesOpen),
                                        children: [
                                            _jsx("span", {
                                                className: "text-[0.6rem] text-subtext-0",
                                                style: narrow ? undefined : { display: "none" },
                                                "aria-hidden": "true",
                                                children: changesOpen ? "▾" : "▸"
                                            }),
                                            _jsx("strong", { children: changedFiles.length ? `${changedFiles.length} changed path${changedFiles.length === 1 ? "" : "s"}` : "No changes" })
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: "inline-flex items-center gap-[0.3rem] text-[0.68rem] whitespace-nowrap text-subtext-0",
                                        children: [
                                            _jsx("input", {
                                                type: "checkbox",
                                                checked: changedFiles.length > 0 && selectedCount === changedFiles.length,
                                                onChange: (event) => selectAllPaths(event.target.checked),
                                                "aria-label": "Select all changed paths"
                                            }),
                                            "All"
                                        ]
                                    })
                                ]
                            }),
                            _jsxs("div", {
                                className: "flex min-h-0 flex-1 flex-col",
                                style: narrow && !changesOpen ? { display: "none" } : undefined,
                                "data-open": changesOpen,
                                children: [
                                    statusState === "loading" && _jsx("div", {
                                        className: STATUS_NOTE,
                                        role: "status",
                                        children: "Reading Git status\u2026"
                                    }),
                                    statusState === "error" && _jsx("div", {
                                        className: cn(STATUS_NOTE, "text-red"),
                                        role: "alert",
                                        children: statusError || "Git status is unavailable."
                                    }),
                                    _jsxs("div", {
                                        className: "flex min-h-0 flex-1 flex-col gap-[1px] overflow-y-auto px-[3px] pb-[0.3rem]",
                                        style: narrow ? { maxHeight: "8.5rem", flex: "none" } : undefined,
                                        role: "list",
                                        "aria-label": "Changed paths",
                                        children: [
                                            changedFiles.map((entry) => (_jsxs("div", {
                                                className: "flex min-w-0 items-center gap-[0.3rem]",
                                                role: "listitem",
                                                children: [
                                                    _jsx("input", {
                                                        className: "shrink-0",
                                                        type: "checkbox",
                                                        checked: selectedPaths.has(entry.path),
                                                        onChange: () => selectPath(entry.path),
                                                        "aria-label": `Select ${entry.path}`
                                                    }),
                                                    _jsxs("button", {
                                                        type: "button",
                                                        className: `${PATH_BUTTON} ${activeFile === entry.path ? PATH_BUTTON_ACTIVE : PATH_BUTTON_IDLE}`,
                                                        onClick: () => { setActiveFile(activeFile === entry.path ? undefined : entry.path); setSelection(null); },
                                                        title: entry.originalPath ? `${entry.originalPath} → ${entry.path}` : entry.path,
                                                        children: [
                                                            _jsx(FileIcon, { name: entry.path.split("/").at(-1) ?? entry.path }),
                                                            _jsx(PathLabel, {
                                                                path: entry.path,
                                                                className: "flex-1"
                                                            }),
                                                            _jsx(GitMarker, { decoration: { entry } })
                                                        ]
                                                    })
                                                ]
                                            }, entry.path))),
                                            statusState !== "loading" && changedFiles.length === 0 && _jsx("div", {
                                                className: STATUS_NOTE,
                                                children: "Working tree is clean."
                                            })
                                        ]
                                    }),
                                    _jsxs("div", {
                                        className: "flex flex-col gap-[0.35rem] p-[0.5rem] [border-top:1px_solid_var(--git-border)]",
                                        children: [
                                            _jsxs("div", {
                                                className: "flex flex-wrap items-center gap-[0.3rem]",
                                                children: [
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: `${BTN_DEFAULT} min-w-fit flex-1`,
                                                        disabled: selectedCount === 0,
                                                        onClick: () => actions.stage([...selectedPaths]),
                                                        children: "Stage selected"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: `${BTN_DEFAULT} min-w-fit flex-1`,
                                                        disabled: selectedCount === 0,
                                                        onClick: () => actions.unstage([...selectedPaths]),
                                                        children: "Unstage"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: `${BTN_DANGER} min-w-fit flex-1`,
                                                        "data-testid": "git-discard-preview",
                                                        disabled: selectedCount === 0,
                                                        onClick: () => requestDiscard("worktree"),
                                                        children: "Discard selected"
                                                    })
                                                ]
                                            }),
                                            _jsxs("div", {
                                                className: "flex flex-col gap-[0.3rem]",
                                                style: narrow ? { flexDirection: "row" } : undefined,
                                                children: [
                                                    _jsx("input", {
                                                        className: `${TB_INPUT} min-w-0 flex-1`,
                                                        "aria-label": "Commit staged changes",
                                                        value: commitMessage,
                                                        onChange: (event) => setCommitMessage(event.target.value),
                                                        placeholder: "Describe the change"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: BTN_PRIMARY,
                                                        disabled: stagedCount === 0 || !commitMessage.trim(),
                                                        onClick: requestCommitPreview,
                                                        children: "Preview commit"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        ]
                    }),
                    _jsxs("div", {
                        className: "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                        style: narrow ? { minHeight: "18rem", flex: "auto" } : undefined,
                        children: [
                            _jsxs("div", {
                                className: "flex shrink-0 flex-wrap items-center gap-x-[0.7rem] gap-y-[0.3rem] px-[0.7rem] py-[0.4rem]",
                                children: [
                                    _jsxs("label", {
                                        className: TB_FIELD,
                                        children: [
                                            _jsx("span", { children: "Compare" }),
                                            _jsx(Select, {
                                                className: TB_INPUT,
                                                testId: "git-diff-target",
                                                ariaLabel: "Compare",
                                                value: compareOpen ? "compare" : target.kind === "compare" ? (preset ?? "compare") : target.kind,
                                                onChange: chooseTarget,
                                                options: [
                                                    { value: "workingTree", label: "Working tree" },
                                                    { value: "staged", label: "Staged" },
                                                    { value: "head", label: "HEAD" },
                                                    { value: "workspaceStart", label: startSnapshot ? "Workspace start" : "Workspace start (not recorded)", disabled: !startSnapshot },
                                                    { value: "lastAgentTurn", label: turnLabel, disabled: !turnBase },
                                                    { value: "compare", label: "Another ref…" },
                                                ]
                                            })
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: TB_FIELD,
                                        children: [
                                            _jsx("span", { children: "Session" }),
                                            _jsx(Select, {
                                                className: TB_INPUT,
                                                testId: "git-turn-session",
                                                ariaLabel: "Turn session",
                                                value: agentSessionId ?? "",
                                                onChange: (value) => {
                                                    chooseTarget("workingTree");
                                                    actions.selectAgentSession(value || undefined);
                                                },
                                                options: [
                                                    { value: "", label: "Latest in workspace" }, ...sessions.map((session) => ({ value: session.id, label: `${session.title} · ${session.agent ?? "agent"}` }))
                                                ]
                                            })
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: `${TB_FIELD} min-w-[12rem] flex-1`,
                                        children: [
                                            _jsx("span", { children: "File" }),
                                            _jsx(Select, {
                                                className: `${TB_INPUT} min-w-0 flex-1`,
                                                ariaLabel: "Diff file",
                                                testId: "git-diff-file-select",
                                                value: selectedFile ?? "",
                                                onChange: (value) => { setActiveFile(value || undefined); setSelection(null); },
                                                options: [
                                                    { value: "", label: `All files · ${diffFiles.length}` }, ...diffFiles.map((file) => { const path = filePath(file); return { value: path, label: `${file.status} · ${path}` }; })
                                                ]
                                            })
                                        ]
                                    }),
                                    compareOpen && (_jsxs(_Fragment, { children: [_jsxs("label", {
                                                className: TB_FIELD,
                                                children: [
                                                    _jsx("span", { children: "Base" }),
                                                    _jsx(Select, {
                                                        freeText: true,
                                                        className: TB_INPUT,
                                                        testId: "git-base-selector",
                                                        ariaLabel: "Base ref",
                                                        value: compareBase,
                                                        onChange: setCompareBase,
                                                        placeholder: "main",
                                                        options: [
                                                            ...new Map(refs.map((ref) => [ref.name, { value: ref.name, label: _jsxs(_Fragment, { children: [ref.name, " ", _jsx("span", {
                                                                                className: "text-subtext-0",
                                                                                children: ref.target.slice(0, 8)
                                                                            })] }), text: ref.name }])).values()
                                                        ]
                                                    })
                                                ]
                                            }), _jsxs("label", {
                                                className: TB_FIELD,
                                                children: [
                                                    _jsx("span", { children: "Head" }),
                                                    _jsx("input", {
                                                        className: `${TB_INPUT} w-[7rem]`,
                                                        "aria-label": "Head (optional)",
                                                        value: compareHead,
                                                        onChange: (event) => setCompareHead(event.target.value),
                                                        placeholder: "HEAD"
                                                    })
                                                ]
                                            }), _jsx("button", {
                                                type: "button",
                                                className: BTN_QUIET,
                                                onClick: () => { setCompareBase(""); setCompareHead(""); setCompareOpen(false); setTarget({ kind: "workingTree" }); },
                                                children: "Clear base"
                                            })] })),
                                    _jsxs("button", {
                                        type: "button",
                                        className: `${BTN_QUIET} ml-auto`,
                                        "aria-expanded": optionsOpen,
                                        onClick: () => setOptionsOpen(!optionsOpen),
                                        children: [
                                            "Options",
                                            optionsChanged ? " •" : ""
                                        ]
                                    })
                                ]
                            }),
                            optionsOpen && (_jsxs("div", {
                                className: "flex shrink-0 flex-wrap items-center gap-x-[0.9rem] gap-y-[0.3rem] px-[0.7rem] pb-[0.4rem]",
                                children: [
                                    _jsxs("label", {
                                        className: TB_CHECK,
                                        children: [
                                            _jsx("input", {
                                                type: "checkbox",
                                                checked: includeUntracked,
                                                onChange: (event) => setIncludeUntracked(event.target.checked)
                                            }),
                                            " Untracked"
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: TB_CHECK,
                                        children: [
                                            _jsx("input", {
                                                type: "checkbox",
                                                checked: wrapLines,
                                                onChange: (event) => setWrapLines(event.target.checked)
                                            }),
                                            " Wrap lines"
                                        ]
                                    }),
                                    canChooseLayout && _jsxs("label", {
                                        className: TB_FIELD,
                                        children: [
                                            _jsx("span", { children: "Layout" }),
                                            _jsx(Select, {
                                                className: `${TB_INPUT} w-[6rem]`,
                                                testId: "git-diff-layout",
                                                ariaLabel: "Diff layout",
                                                value: diffLayout,
                                                onChange: (value) => setDiffLayout(value),
                                                options: [
                                                    { value: "auto", label: "Auto" }, { value: "unified", label: "Unified" }, { value: "split", label: "Split" }
                                                ]
                                            })
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: TB_CHECK,
                                        children: [
                                            _jsx("input", {
                                                type: "checkbox",
                                                checked: ignoreWhitespace,
                                                onChange: (event) => setIgnoreWhitespace(event.target.checked)
                                            }),
                                            " Ignore whitespace"
                                        ]
                                    }),
                                    _jsxs("label", {
                                        className: TB_FIELD,
                                        children: [
                                            _jsx("span", { children: "Context" }),
                                            _jsx(Select, {
                                                className: `${TB_INPUT} w-[6rem]`,
                                                ariaLabel: "Context",
                                                value: String(contextLines),
                                                onChange: (value) => setContextLines(Number(value)),
                                                options: [
                                                    { value: "0", label: "0 lines" }, { value: "3", label: "3 lines" }, { value: "8", label: "8 lines" }
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })),
                            preset === "lastAgentTurn" && lastAgentTurn && (
                            /* The gate asks for the *agent's* changes, so say whose turn this
                               is and how much it touched — a diff alone does not answer that. */
                            _jsxs("p", {
                                className: TURN_SUMMARY,
                                "data-testid": "git-turn-summary",
                                children: [
                                    _jsx("strong", { children: lastAgentTurn.agent }),
                                    lastAgentTurn.state === "running"
                                        ? " · turn in progress, comparing against the working tree"
                                        : _jsxs(_Fragment, { children: [" changed ", lastAgentTurn.changedPathCount === undefined ? "at least " : "", lastAgentTurn.changedPathCount ?? lastAgentTurn.changedPaths.length, " ", (lastAgentTurn.changedPathCount ?? lastAgentTurn.changedPaths.length) === 1 ? "path" : "paths", lastAgentTurn.completedAt ? ` · ${new Date(lastAgentTurn.completedAt).toLocaleTimeString()}` : ""] })
                                ]
                            })),
                            lastAgentTurn?.state === "unavailable" && (
                            /* Never silently substitute an older turn for this one: the newest
                               turn is the one the label promises, and it was not captured. */
                            _jsx("p", {
                                className: STATUS_NOTE,
                                "data-testid": "git-turn-unavailable",
                                children: "This agent turn was not captured, so it cannot be compared. The next turn records a fresh baseline."
                            })),
                            _jsx("div", {
                                className: "flex min-h-0 min-w-0 flex-1 flex-col",
                                children: diffState === "loading" || diffFiles.length === 0 ? (_jsx("div", {
                                    className: "workspace-git__diff min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain",
                                    "data-testid": "git-diff",
                                    children: _jsx(EmptyDiffState, {
                                        state: diffState,
                                        error: diffError
                                    })
                                })) : (_jsxs(_Fragment, { children: [diff?.truncated && _jsx("div", {
                                            className: `${BANNER_WARNING} shrink-0`,
                                            role: "status",
                                            children: "This diff is truncated. Narrow the path or comparison before commenting."
                                        }), _jsx(DiffView, {
                                            workspaceId: workspaceId,
                                            path: selectedFile,
                                            wrap: wrapLines,
                                            layout: diffLayout,
                                            selection: selection,
                                            editingCommentId: editingCommentId,
                                            editingBody: editingBody,
                                            onSelectLine: selectLine,
                                            onAddComment: (path, side, line) => { selectLine(path, side, line, false); startComment(); },
                                            onAskAgent: onAskAgent ? (path) => { const file = diffFiles.find((candidate) => filePath(candidate) === path); if (file)
                                                askAboutDiff(file); } : undefined,
                                            onEditComment: beginEdit,
                                            onEditBody: setEditingBody,
                                            onSaveEdit: saveEdit,
                                            onCancelEdit: () => setEditingCommentId(null),
                                            onResolve: (comment) => actions.resolveComment(comment.id, comment.status !== "resolved", comment.version),
                                            onDelete: (comment) => actions.deleteComment(comment.id, comment.version)
                                        }), selection && (_jsxs("div", {
                                            className: "workspace-git__comment-composer m-[0.7rem] min-w-0 shrink-0 rounded-ui bg-surface-0 p-[0.65rem]",
                                            "data-testid": "git-comment-composer",
                                            children: [
                                                _jsxs("div", {
                                                    className: "mb-[0.4rem] flex justify-between gap-2",
                                                    children: [
                                                        _jsxs("strong", { children: ["Comment on ", selection.path] }),
                                                        _jsxs("span", {
                                                            className: "text-[0.68rem] text-subtext-0",
                                                            children: [
                                                                selection.side,
                                                                " lines ",
                                                                selection.start,
                                                                "\u2013",
                                                                selection.end
                                                            ]
                                                        })
                                                    ]
                                                }),
                                                _jsx("textarea", {
                                                    className: COMMENT_FIELD,
                                                    "data-testid": "git-comment-body",
                                                    value: commentBody,
                                                    onChange: (event) => setCommentBody(event.target.value),
                                                    placeholder: "Leave a focused note for the agent\u2026",
                                                    "aria-label": "New review comment"
                                                }),
                                                _jsxs("div", {
                                                    className: `${COMMENT_ACTIONS} mt-[0.4rem]`,
                                                    children: [
                                                        onAskAgent && _jsx("button", {
                                                            type: "button",
                                                            className: CA_BTN,
                                                            onClick: () => { const file = diffFiles.find((candidate) => filePathForSide(candidate, selection.side) === selection.path); if (file)
                                                                askAboutDiff(file, selection); },
                                                            children: "Ask agent about lines\u2026"
                                                        }),
                                                        _jsx("button", {
                                                            type: "button",
                                                            className: CA_BTN,
                                                            disabled: !commentBody.trim(),
                                                            onClick: submitComment,
                                                            children: "Add comment"
                                                        }),
                                                        _jsx("button", {
                                                            type: "button",
                                                            className: CA_BTN,
                                                            onClick: () => { setSelection(null); setAnchor(null); },
                                                            children: "Cancel"
                                                        })
                                                    ]
                                                })
                                            ]
                                        }))] }))
                            }),
                            _jsxs("section", {
                                className: "max-h-[40%] shrink-0 overflow-y-auto [border-top:1px_solid_var(--git-border)]",
                                "data-testid": "git-review-panel",
                                children: [
                                    _jsxs("div", {
                                        className: "flex items-center justify-between gap-[0.6rem] px-[0.7rem] py-[0.35rem]",
                                        children: [
                                            _jsx("strong", {
                                                title: "Comments stay attached to their path and core-derived anchor. Stale or orphaned anchors require an explicit correction before sending.",
                                                children: unresolvedCount ? `${unresolvedCount} unresolved note${unresolvedCount === 1 ? "" : "s"}` : "No unresolved notes"
                                            }),
                                            _jsx("button", {
                                                type: "button",
                                                className: BTN_DEFAULT,
                                                disabled: !unresolvedCount || batchBusy,
                                                onClick: requestBatchPreview,
                                                "data-testid": "git-review-preview",
                                                children: batchBusy ? "Preparing…" : "Preview packet"
                                            })
                                        ]
                                    }),
                                    unplacedComments.length > 0 && (_jsxs("div", {
                                        className: "mx-[0.7rem] mb-[0.55rem] rounded-ui bg-[color-mix(in_srgb,var(--surface-1)_42%,transparent)] p-2",
                                        "data-testid": "git-review-list",
                                        children: [
                                            _jsxs("div", {
                                                className: "flex items-center justify-between gap-2",
                                                children: [
                                                    _jsx("span", {
                                                        className: EYEBROW,
                                                        children: "Other review notes"
                                                    }),
                                                    _jsx("strong", { children: unplacedComments.length })
                                                ]
                                            }),
                                            _jsx("p", {
                                                className: `${SUMMARY} pt-[0.2rem] pb-[0.25rem]`,
                                                children: "These notes are kept with their server anchor and are not placed on the current diff."
                                            }),
                                            unplacedComments.map((comment) => renderCommentCard(comment, false))
                                        ]
                                    })),
                                    unresolvedCount > 0 && (_jsxs("div", {
                                        className: "flex items-end gap-[0.55rem] px-[0.7rem] pb-[0.55rem]",
                                        style: narrow ? { flexDirection: "column", alignItems: "stretch" } : undefined,
                                        children: [
                                            _jsxs("label", {
                                                className: `${TB_FIELD} flex-1`,
                                                children: [
                                                    _jsx("span", { children: "Send to agent session" }),
                                                    _jsx(Select, {
                                                        ariaLabel: "Send to agent session",
                                                        className: `${TB_INPUT} min-w-0 flex-1`,
                                                        value: selectedSessionId ?? "",
                                                        onChange: (value) => setSelectedSessionId(value || undefined),
                                                        options: [
                                                            { value: "", label: "Choose a session" }, ...sessions.map((session) => ({ value: session.id, label: `${session.title}${session.agent ? ` · ${session.agent}` : ""}` }))
                                                        ]
                                                    })
                                                ]
                                            }),
                                            _jsxs("label", {
                                                className: `${TB_FIELD} flex-[2]`,
                                                children: [
                                                    _jsx("span", { children: "Request" }),
                                                    _jsx("input", {
                                                        className: `${TB_INPUT} min-w-0 flex-1`,
                                                        value: reviewInstruction,
                                                        onChange: (event) => setReviewInstruction(event.target.value)
                                                    })
                                                ]
                                            })
                                        ]
                                    })),
                                    batchPreview && (_jsxs("div", {
                                        className: "mx-[0.7rem] mb-[0.7rem] rounded-ui bg-surface-0 p-[0.55rem]",
                                        "data-testid": "git-review-packet",
                                        children: [
                                            _jsxs("div", {
                                                className: "flex flex-wrap items-center gap-[0.55rem]",
                                                children: [
                                                    _jsx("strong", { children: "Packet ready" }),
                                                    _jsxs("span", {
                                                        className: "text-[0.7rem] text-subtext-0",
                                                        children: [
                                                            batchPreview.comments.length,
                                                            " anchored note",
                                                            batchPreview.comments.length === 1 ? "" : "s"
                                                        ]
                                                    }),
                                                    _jsx("code", {
                                                        className: "ml-auto text-[0.62rem] text-subtext-0",
                                                        children: batchPreview.packetId
                                                    })
                                                ]
                                            }),
                                            _jsx("pre", {
                                                className: "my-[0.45rem] max-h-[8rem] overflow-auto border p-[0.45rem] text-[0.68rem] text-fg whitespace-pre-wrap [font-family:var(--font-mono)]",
                                                children: batchPreview.markdown
                                            }),
                                            _jsxs("div", {
                                                className: COMMENT_ACTIONS,
                                                children: [
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: CA_BTN,
                                                        onClick: sendBatch,
                                                        disabled: batchSending,
                                                        "data-testid": "git-review-send",
                                                        children: batchSending ? "Sending…" : "Send one packet"
                                                    }),
                                                    _jsx("button", {
                                                        type: "button",
                                                        className: CA_BTN,
                                                        onClick: () => setBatchPreview(null),
                                                        disabled: batchSending,
                                                        children: "Close preview"
                                                    })
                                                ]
                                            })
                                        ]
                                    })),
                                    batchDelivery && batchDelivery.packetId === batchPreview?.packetId && _jsx("div", {
                                        className: BANNER_INFO,
                                        role: "status",
                                        "data-testid": "git-review-delivery",
                                        children: batchDelivery.delivery === "delivered" ? "Agent received the review packet."
                                            : batchDelivery.delivery === "unconfirmed" ? "Delivery could not be confirmed. Check the agent conversation before starting another review."
                                                : "Waiting for the agent to receive the review packet…"
                                    }),
                                    batchSending && (!batchDelivery || batchDelivery.packetId !== batchPreview?.packetId) && _jsx("div", {
                                        className: BANNER_INFO,
                                        role: "status",
                                        children: "Sending review packet\u2026 waiting for server confirmation."
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            (localActionError || actionError) && _jsxs("div", {
                className: "absolute right-[0.8rem] bottom-[0.8rem] z-[5] flex max-w-[min(30rem,calc(100%-1.6rem))] items-center gap-2 rounded-ui bg-panel-bg px-[0.65rem] py-[0.55rem] text-red shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
                role: "alert",
                children: [
                    localActionError || actionError,
                    _jsx("button", {
                        type: "button",
                        className: "[border:0] bg-transparent text-inherit",
                        "aria-label": "Dismiss",
                        onClick: () => setLocalActionError(null),
                        children: "\u00D7"
                    })
                ]
            }),
            confirmAction && (_jsx("div", {
                className: "absolute inset-0 z-10 grid place-items-center bg-[rgba(0,0,0,0.62)] p-4",
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": confirmTitleId,
                children: _jsxs("div", {
                    className: "max-h-[90%] w-[min(32rem,100%)] overflow-auto rounded-ui bg-panel-bg p-[0.9rem] shadow-[0_12px_32px_rgba(0,0,0,0.5)]",
                    ref: confirmCardRef,
                    children: [
                        _jsxs("span", {
                            className: EYEBROW,
                            children: [
                                "Confirm ",
                                confirmAction.kind
                            ]
                        }),
                        _jsx("h3", {
                            className: "my-[0.3rem]",
                            id: confirmTitleId,
                            children: confirmAction.kind === "commit" ? "Commit staged changes?" : "Discard selected changes?"
                        }),
                        _jsx("p", {
                            className: "text-subtext-0",
                            children: confirmAction.kind === "commit" ? `This will create “${confirmAction.message}” in ${workspaceName || workspaceId}.` : `This permanently changes ${confirmAction.receipt.paths.length} selected path${confirmAction.receipt.paths.length === 1 ? "" : "s"}.`
                        }),
                        _jsx("ul", {
                            className: "my-[0.55rem] max-h-[8rem] overflow-auto pl-[1.2rem] text-[0.7rem] [font-family:var(--font-mono)]",
                            children: confirmAction.receipt.paths.map((path) => _jsx("li", { children: path }, path))
                        }),
                        _jsxs("div", {
                            className: COMMENT_ACTIONS,
                            children: [
                                _jsxs("button", {
                                    ref: confirmButtonRef,
                                    type: "button",
                                    className: CA_BTN_DANGER,
                                    "data-testid": "git-confirm-action",
                                    onClick: () => { if (confirmAction.kind === "commit")
                                        actions.commit(confirmAction.receipt.previewId, confirmAction.message);
                                    else
                                        actions.discard(confirmAction.receipt.previewId); setConfirmAction(null); },
                                    children: [
                                        "Confirm ",
                                        confirmAction.kind
                                    ]
                                }),
                                _jsx("button", {
                                    type: "button",
                                    className: CA_BTN,
                                    "data-testid": "git-cancel-action",
                                    onClick: () => setConfirmAction(null),
                                    children: "Cancel"
                                })
                            ]
                        })
                    ]
                })
            }))
        ]
    }));
}
