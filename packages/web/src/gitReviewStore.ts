import { create } from "zustand";
import type {
  AgentTurnSummary,
  ClientMessage,
  ErrorMessage,
  GitActionResultMessage,
  GitDiffResultMessage,
  GitDiffTarget,
  GitPreviewReceipt,
  GitPreviewResultMessage,
  GitStatusResultMessage,
  ReviewBatchPreviewResultMessage,
  ReviewBatchSendResultMessage,
  ReviewComment,
  ReviewCommentResultMessage,
  ReviewDeleteResultMessage,
  ReviewListResultMessage,
  ServerMessage,
} from "@perch/shared";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import { registerGitReviewRequest, retireGitReviewRequest } from "./requestOwnership";
import type {
  GitDiffSnapshot,
  GitStatusSnapshot,
  ReviewBatchDelivery,
  ReviewBatchPreview,
  ReviewSide,
  WorkspaceGitReviewActions,
} from "./components/gitReviewModels";
import { newId } from "./ids";

export interface WorkspaceGitReviewState {
  status: GitStatusSnapshot | null;
  statusState: "idle" | "loading" | "ready" | "error";
  statusError?: string;
  diff: GitDiffSnapshot | null;
  diffState: "idle" | "loading" | "ready" | "error";
  diffError?: string;
  comments: ReviewComment[];
  refs: Array<{ name: string; target: string; upstream?: string; remote: boolean }>;
  actionState: "idle" | "loading" | "error";
  actionError?: string;
  batchDelivery: ReviewBatchDelivery | null;
  /** Session whose latest turn is reviewed; absent means latest across the workspace. */
  agentSessionId?: string;
  /** Newest turn in the selected scope, including running/unavailable captures. */
  lastAgentTurn: AgentTurnSummary | null;
}

const EMPTY_WORKSPACE_STATE: WorkspaceGitReviewState = Object.freeze({
  status: null,
  statusState: "idle",
  diff: null,
  diffState: "idle",
  comments: [],
  refs: [],
  actionState: "idle",
  batchDelivery: null,
  lastAgentTurn: null,
});

export const EMPTY_GIT_REVIEW_STATE = EMPTY_WORKSPACE_STATE;

interface PendingRequest {
  workspaceId: string;
  kind: "status" | "refs" | "diff" | "action" | "preview" | "comments" | "comment" | "delete" | "batchPreview" | "batchSend";
  resolve?: (value: GitPreviewReceipt | ReviewBatchPreview | ReviewBatchDelivery | null) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface LastDiffRequest {
  target: GitDiffTarget;
  path?: string;
  includeUntracked: boolean;
  ignoreWhitespace: boolean;
  contextLines: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const latestRequestByKey = new Map<string, string>();
const lastDiffByWorkspace = new Map<string, LastDiffRequest>();
/** IDs retired because a newer request superseded them. A late response for
 * one of these IDs still belongs to this protocol family and is consumed;
 * disconnect-retired IDs are deliberately forgotten across reconnects. */
const supersededRequestIds = new Set<string>();
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PENDING_REQUESTS = 64;

function newRequestId(): string {
  return newId();
}

function workspaceStateFor(state: GitReviewStoreState, workspaceId: string): WorkspaceGitReviewState {
  return state.workspaces[workspaceId] ?? EMPTY_WORKSPACE_STATE;
}

function hostForWorkspace(workspaceId: string): string {
  const workspace = usePerchStore.getState().workspaces.find((candidate) => candidate.id === workspaceId);
  return workspace?.hostId ?? usePerchStore.getState().activeHostId;
}

function gitCapabilityForWorkspace(workspaceId: string): boolean {
  const perch = usePerchStore.getState();
  const hostId = hostForWorkspace(workspaceId);
  const capabilities = hostId === "local" ? perch.serverInfo?.capabilities : perch.workspaceCapabilitiesByHost[hostId];
  // A missing server.info/capability list means a legacy peer. Do not send a
  // new request until negotiation explicitly advertises the Git family.
  return perch.connected && capabilities?.includes("git.status") === true;
}

function withHost<T extends ClientMessage>(message: T, hostId: string): T {
  // Every Git/review request has an optional hostId in the shared union. The
  // generic keeps the concrete request discriminant and payload intact while
  // adding the routing field for a remote workspace.
  return hostId !== "local" ? { ...message, hostId } as T : message;
}

function begin(
  workspaceId: string,
  kind: PendingRequest["kind"],
  message: ClientMessage,
  resolve?: PendingRequest["resolve"],
): string | null {
  if (!workspaceId) {
    resolve?.(null);
    return null;
  }
  if (!socket.connected || !gitCapabilityForWorkspace(workspaceId)) {
    markRequestError(workspaceId, kind, "Git and review are unavailable until this host reconnects and advertises the Git protocol.");
    resolve?.(null);
    return null;
  }
  const requestId = "requestId" in message && typeof message.requestId === "string" ? message.requestId : null;
  if (!requestId) {
    resolve?.(null);
    return null;
  }

  // A newer request for the same view supersedes an older one. Resolve any
  // promise owned by the older request so a stale preview can never hang
  // forever after its reply is intentionally ignored.
  const key = `${kind}:${workspaceId}`;
  const previousRequestId = latestRequestByKey.get(key);
  if (previousRequestId && previousRequestId !== requestId) {
    settlePending(previousRequestId);
  }
  // A disconnected or incompatible peer may leave requests without replies.
  // Bound the map even if many different workspaces/kinds are opened before
  // the per-request timeout fires.
  while (pendingRequests.size >= MAX_PENDING_REQUESTS) {
    const oldestRequestId = pendingRequests.keys().next().value as string | undefined;
    if (!oldestRequestId) break;
    settlePending(oldestRequestId);
  }
  const timeoutId = setTimeout(() => expirePending(requestId), REQUEST_TIMEOUT_MS);
  pendingRequests.set(requestId, { workspaceId, kind, resolve, timeoutId });
  latestRequestByKey.set(key, requestId);
  registerGitReviewRequest(requestId);
  socket.send(message);
  return requestId;
}

function setWorkspace(workspaceId: string, value: Partial<WorkspaceGitReviewState>): void {
  useWorkspaceGitReviewStore.setState((state) => ({
    workspaces: {
      ...state.workspaces,
      [workspaceId]: { ...workspaceStateFor(state, workspaceId), ...value },
    },
  }));
}

function finish(requestId: string): PendingRequest | undefined {
  const pending = pendingRequests.get(requestId);
  if (!pending) return undefined;
  clearTimeout(pending.timeoutId);
  pendingRequests.delete(requestId);
  retireGitReviewRequest(requestId);
  const key = `${pending.kind}:${pending.workspaceId}`;
  if (latestRequestByKey.get(key) === requestId) latestRequestByKey.delete(key);
  return pending;
}

/** Remove a request without changing the visible state. Used when a newer
 * request supersedes it or when a late reply arrives for an already-settled
 * request. Promise based actions still receive a null result. */
function settlePending(requestId: string): PendingRequest | undefined {
  const pending = finish(requestId);
  if (pending) {
    supersededRequestIds.add(requestId);
    while (supersededRequestIds.size > MAX_PENDING_REQUESTS) {
      const oldest = supersededRequestIds.values().next().value as string | undefined;
      if (!oldest) break;
      supersededRequestIds.delete(oldest);
    }
  }
  pending?.resolve?.(null);
  return pending;
}

function expirePending(requestId: string): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) return;
  const latest = isLatest(requestId, pending);
  const finished = finish(requestId);
  finished?.resolve?.(null);
  if (latest) markRequestError(pending.workspaceId, pending.kind, "The Git request timed out. Check the host connection and try again.");
}

function isLatest(requestId: string, pending: PendingRequest): boolean {
  return latestRequestByKey.get(`${pending.kind}:${pending.workspaceId}`) === requestId;
}

function updateStatusFromWire(message: GitStatusResultMessage): GitStatusSnapshot {
  const status = message.status;
  return {
    ...status,
    dirty: status.entries.length > 0,
    conflicted: status.entries.some((entry) => entry.index === "conflicted" || entry.worktree === "conflicted"),
  };
}

function markRequestError(workspaceId: string, kind: PendingRequest["kind"], message: string): void {
  const value: Partial<WorkspaceGitReviewState> = {};
  if (kind === "status") {
    value.statusState = "error";
    value.statusError = message;
  } else if (kind === "refs") {
    value.actionState = "error";
    value.actionError = message;
  } else if (kind === "diff") {
    value.diffState = "error";
    value.diffError = message;
  } else {
    value.actionState = "error";
    value.actionError = message;
  }
  setWorkspace(workspaceId, value);
}

export interface GitReviewStoreState {
  workspaces: Record<string, WorkspaceGitReviewState>;
  getWorkspaceActions: (workspaceId: string) => WorkspaceGitReviewActions;
  refreshStatus: (workspaceId: string) => string | null;
  loadDiff: (workspaceId: string, target: GitDiffTarget, path?: string, options?: { includeUntracked?: boolean; ignoreWhitespace?: boolean; contextLines?: number }) => string | null;
  listComments: (workspaceId: string) => string | null;
  listRefs: (workspaceId: string) => string | null;
}

export const useWorkspaceGitReviewStore = create<GitReviewStoreState>((set, get) => ({
  workspaces: {},

  getWorkspaceActions: (workspaceId) => ({
    refreshStatus: () => get().refreshStatus(workspaceId),
    selectAgentSession: (sessionId) => {
      setWorkspace(workspaceId, { agentSessionId: sessionId, lastAgentTurn: null });
      get().refreshStatus(workspaceId);
    },
    loadDiff: (target, path, options) => {
      return get().loadDiff(workspaceId, target, path, options);
    },
    stage: (paths) => {
      sendPathAction(workspaceId, "git.stage", paths);
    },
    unstage: (paths) => {
      sendPathAction(workspaceId, "git.unstage", paths);
    },
    discardPreview: (mode, paths) => requestDiscardPreview(workspaceId, mode, paths),
    discard: (previewId) => sendPreviewAction(workspaceId, "git.discard", previewId),
    commitPreview: (message) => requestCommitPreview(workspaceId, message),
    commit: (previewId, message) => sendCommit(workspaceId, previewId, message),
    listComments: () => get().listComments(workspaceId),
    listRefs: () => get().listRefs(workspaceId),
    createComment: (input) => sendCreateComment(workspaceId, input),
    updateComment: (commentId, body, expectedVersion) => sendCommentUpdate(workspaceId, commentId, body, expectedVersion),
    resolveComment: (commentId, resolved, expectedVersion) => sendCommentResolve(workspaceId, commentId, resolved, expectedVersion),
    deleteComment: (commentId, expectedVersion) => sendCommentDelete(workspaceId, commentId, expectedVersion),
    previewBatch: (input) => requestBatchPreview(workspaceId, input),
    sendBatch: (packetId, sendOperationId) => sendBatchPacket(workspaceId, packetId, sendOperationId),
  }),

  refreshStatus: (workspaceId) => {
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const sessionId = get().workspaces[workspaceId]?.agentSessionId;
    const message = withHost({ type: "git.status" as const, requestId, workspaceId, ...(sessionId ? { sessionId } : {}), includeIgnored: false }, hostId);
    setWorkspace(workspaceId, { statusState: "loading", statusError: undefined });
    return begin(workspaceId, "status", message);
  },

  loadDiff: (workspaceId, target, path, options) => {
    const normalized = {
      includeUntracked: options?.includeUntracked ?? true,
      ignoreWhitespace: options?.ignoreWhitespace ?? false,
      contextLines: options?.contextLines ?? 3,
    };
    lastDiffByWorkspace.set(workspaceId, { target, path, ...normalized });
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const message = withHost({
      type: "git.diff" as const,
      requestId,
      workspaceId,
      target,
      ...normalized,
      ...(path ? { path } : {}),
    }, hostId);
    setWorkspace(workspaceId, { diffState: "loading", diffError: undefined });
    return begin(workspaceId, "diff", message);
  },

  listComments: (workspaceId) => {
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const message = withHost({ type: "review.list" as const, requestId, workspaceId }, hostId);
    return begin(workspaceId, "comments", message);
  },

  listRefs: (workspaceId) => {
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const message = withHost({ type: "git.refs" as const, requestId, workspaceId }, hostId);
    return begin(workspaceId, "refs", message);
  },
}));

function refreshAfterAction(workspaceId: string): void {
  useWorkspaceGitReviewStore.getState().refreshStatus(workspaceId);
  const lastDiff = lastDiffByWorkspace.get(workspaceId);
  if (lastDiff) useWorkspaceGitReviewStore.getState().loadDiff(workspaceId, lastDiff.target, lastDiff.path, lastDiff);
}

function setPendingAction(workspaceId: string): void {
  setWorkspace(workspaceId, { actionState: "loading", actionError: undefined });
}

function sendPathAction(workspaceId: string, type: "git.stage" | "git.unstage", paths: string[]): void {
  if (paths.length === 0) return;
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const message = withHost({ type, requestId, workspaceId, paths }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "action", message);
}

function sendPreviewAction(workspaceId: string, type: "git.discard", previewId: string): void {
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const message = withHost({ type, requestId, workspaceId, previewId }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "action", message);
}

function sendCommit(workspaceId: string, previewId: string, message: string): void {
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const wire = withHost({ type: "git.commit" as const, requestId, workspaceId, previewId, message }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "action", wire);
}

function requestDiscardPreview(workspaceId: string, mode: "worktree" | "staged" | "all", paths: string[]): Promise<GitPreviewReceipt | null> {
  return new Promise((resolve) => {
    if (paths.length === 0) { resolve(null); return; }
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const message = withHost({ type: "git.discard.preview" as const, requestId, workspaceId, mode, paths }, hostId);
    setPendingAction(workspaceId);
    if (!begin(workspaceId, "preview", message, (value) => resolve(value as GitPreviewReceipt | null))) resolve(null);
  });
}

function requestCommitPreview(workspaceId: string, messageText: string): Promise<GitPreviewReceipt | null> {
  return new Promise((resolve) => {
    const message = messageText.trim();
    if (!message) { resolve(null); return; }
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const wire = withHost({ type: "git.commit.preview" as const, requestId, workspaceId, message }, hostId);
    setPendingAction(workspaceId);
    if (!begin(workspaceId, "preview", wire, (value) => resolve(value as GitPreviewReceipt | null))) resolve(null);
  });
}

type GitDiffRevisionFields = {
  sourceRevision?: string;
  sourceRevisions?: Record<string, string>;
};

function sourceRevisionFor(diff: GitDiffSnapshot | null | undefined, path: string, side: ReviewSide): string | undefined {
  if (!diff) return undefined;
  const revisions = diff.sourceRevisions;
  if (revisions) {
    // Accept both explicit path/side keys and a path-only key while keeping
    // the server-issued value opaque to the client.
    return revisions[`${path}:${side}`] ?? revisions[`${side}:${path}`] ?? revisions[path];
  }
  return diff.sourceRevision;
}

function sendCreateComment(workspaceId: string, input: { path: string; side: ReviewSide; start: number; end: number; body: string }): void {
  const requestId = newRequestId();
  const workspace = useWorkspaceGitReviewStore.getState().workspaces[workspaceId];
  const diff = workspace?.diff;
  const base = diff?.target;
  const turn = workspace?.lastAgentTurn;
  const sessionId = turn && base?.kind === "compare" && base.base === turn.beforeRef && base.head === turn.afterRef
    ? turn.sessionId
    : usePerchStore.getState().sessionId ?? undefined;
  const baseRevision = sourceRevisionFor(diff, input.path, input.side);
  if (!base || !baseRevision) {
    setWorkspace(workspaceId, {
      actionState: "error",
      actionError: "The diff has no server-issued source revision. Refresh the diff before commenting.",
    });
    return;
  }
  const hostId = hostForWorkspace(workspaceId);
  // `base` and `baseRevision` are both required by the shared/Rust review
  // contract. The target and opaque revision come from the exact diff that
  // produced the selected line; GitStatus.head is never a substitute.
  const wire = withHost({
    type: "review.create" as const,
    requestId,
    workspaceId,
    id: `comment-${newRequestId()}`,
    ...(sessionId ? { sessionId } : {}),
    path: input.path,
    base,
    baseRevision,
    side: input.side,
    range: { start: input.start, end: input.end },
    body: input.body,
  }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "comment", wire);
}

function sendCommentUpdate(workspaceId: string, commentId: string, body: string, expectedVersion: number): void {
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const wire = withHost({ type: "review.update" as const, requestId, workspaceId, commentId, body, expectedVersion }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "comment", wire);
}

function sendCommentResolve(workspaceId: string, commentId: string, resolved: boolean, expectedVersion: number): void {
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const wire = withHost({ type: "review.resolve" as const, requestId, workspaceId, commentId, resolved, expectedVersion }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "comment", wire);
}

function sendCommentDelete(workspaceId: string, commentId: string, expectedVersion: number): void {
  const requestId = newRequestId();
  const hostId = hostForWorkspace(workspaceId);
  const wire = withHost({ type: "review.delete" as const, requestId, workspaceId, commentId, expectedVersion }, hostId);
  setPendingAction(workspaceId);
  begin(workspaceId, "delete", wire);
}

function requestBatchPreview(workspaceId: string, input: { sendOperationId: string; targetSessionId?: string; targetAgentId?: string; currentRevision: string; instruction: string }): Promise<ReviewBatchPreview | null> {
  return new Promise((resolve) => {
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const wire = withHost({ type: "review.batch.preview" as const, requestId, workspaceId, sendOperationId: input.sendOperationId, ...(input.targetSessionId ? { targetSessionId: input.targetSessionId } : {}), ...(input.targetAgentId ? { targetAgentId: input.targetAgentId } : {}), currentRevision: input.currentRevision, ...(input.instruction ? { instruction: input.instruction } : {}) }, hostId);
    setPendingAction(workspaceId);
    if (!begin(workspaceId, "batchPreview", wire, (value) => resolve(value as ReviewBatchPreview | null))) resolve(null);
  });
}

function sendBatchPacket(workspaceId: string, packetId: string, sendOperationId: string): Promise<ReviewBatchDelivery | null> {
  return new Promise((resolve) => {
    const requestId = newRequestId();
    const hostId = hostForWorkspace(workspaceId);
    const wire = withHost({ type: "review.batch.send" as const, requestId, workspaceId, packetId, sendOperationId }, hostId);
    const current = workspaceStateFor(useWorkspaceGitReviewStore.getState(), workspaceId).batchDelivery;
    setWorkspace(workspaceId, { batchDelivery: mergeBatchDelivery(current, { packetId, sendOperationId, delivery: "queued" }) });
    setPendingAction(workspaceId);
    if (!begin(workspaceId, "batchSend", wire, (value) => resolve(value as ReviewBatchDelivery | null))) resolve(null);
  });
}

/** A delayed claimed reply cannot undo an earlier provider confirmation. */
function mergeBatchDelivery(current: ReviewBatchDelivery | null, next: ReviewBatchDelivery): ReviewBatchDelivery {
  if (current?.packetId !== next.packetId || current.sendOperationId !== next.sendOperationId) return next;
  if (current.delivery === "delivered") return current;
  if (current.delivery === "unconfirmed" && next.delivery !== "delivered") return current;
  if (current.delivery === "claimed" && next.delivery === "queued") return current;
  return next;
}

function commentListFor(state: GitReviewStoreState, workspaceId: string): ReviewComment[] {
  return workspaceStateFor(state, workspaceId).comments;
}

function handleError(message: ErrorMessage): boolean {
  if (!message.requestId) return false;
  const pending = pendingRequests.get(message.requestId);
  if (!pending) {
    // A superseded request has already resolved its owner. Consume its late
    // error so the generic chat error path cannot turn it into a visible
    // assistant error. Disconnect-retired ids are intentionally absent here.
    if (supersededRequestIds.delete(message.requestId)) return true;
    return false;
  }
  const latest = isLatest(message.requestId, pending);
  const finished = finish(message.requestId);
  if (!finished) return false;
  // A superseded request is still settled, but cannot overwrite the newer
  // request's loading/ready state with its late error.
  if (!latest) {
    finished.resolve?.(null);
    return true;
  }
  markRequestError(finished.workspaceId, finished.kind, message.message);
  finished.resolve?.(null);
  return true;
}

/** Invalidate all request correlation state when the transport closes. Git
 * requests are read/action operations, so they must not be replayed against a
 * potentially different repository state on reconnect. The visible snapshot
 * stays intact while in-flight indicators become actionable errors. */
export function handleGitReviewConnectionChange(connected: boolean): void {
  if (connected) return;
  const affected = new Map<string, Set<PendingRequest["kind"]>>();
  for (const requestId of [...pendingRequests.keys()]) {
    const pending = pendingRequests.get(requestId);
    if (!pending) continue;
    const latest = isLatest(requestId, pending);
    const finished = finish(requestId);
    finished?.resolve?.(null);
    if (latest) {
      const kinds = affected.get(pending.workspaceId) ?? new Set<PendingRequest["kind"]>();
      kinds.add(pending.kind);
      affected.set(pending.workspaceId, kinds);
    }
  }
  latestRequestByKey.clear();
  for (const [workspaceId, kinds] of affected) {
    const value: Partial<WorkspaceGitReviewState> = {};
    if (kinds.has("status")) {
      value.statusState = "error";
      value.statusError = "Git status lost its connection. Refresh after the host reconnects.";
    }
    if (kinds.has("refs")) {
      value.actionState = "error";
      value.actionError = "Git refs lost their connection. Refresh after the host reconnects.";
    }
    if (kinds.has("diff")) {
      value.diffState = "error";
      value.diffError = "The diff lost its connection. Refresh after the host reconnects.";
    }
    if (["action", "preview", "comment", "delete", "batchPreview", "batchSend"].some((kind) => kinds.has(kind as PendingRequest["kind"]))) {
      value.actionState = "error";
      value.actionError = "The Git action lost its connection. Refresh before trying again.";
    }
    setWorkspace(workspaceId, value);
  }
}

export function handleGitReviewMessage(message: ServerMessage): boolean {
  if (message.type === "error") return handleError(message);
  if (!message.type.startsWith("git.") && !message.type.startsWith("review.")) return false;

  if (message.type === "review.batch.delivery") {
    const current = useWorkspaceGitReviewStore.getState().workspaces[message.workspaceId]?.batchDelivery;
    if (!current || (message.hostId ?? "local") !== hostForWorkspace(message.workspaceId)) return true;
    if (current.packetId !== message.packetId || current.sendOperationId !== message.sendOperationId) return true;
    setWorkspace(message.workspaceId, { batchDelivery: mergeBatchDelivery(current, message) });
    return true;
  }

  const requestId = "requestId" in message && typeof message.requestId === "string" ? message.requestId : undefined;
  if (!requestId) return true;
  const pending = pendingRequests.get(requestId);
  if (!pending) return true;
  if (!isLatest(requestId, pending)) {
    settlePending(requestId);
    return true;
  }
  const finished = finish(requestId);
  if (!finished) return true;

  if (message.type === "git.status.result") {
    const result = message as GitStatusResultMessage;
    const sessionId = useWorkspaceGitReviewStore.getState().workspaces[result.workspaceId]?.agentSessionId;
    // Older peers may ignore the session filter. Never label another session
    // as the selected one, even when that peer still returns a valid turn.
    const lastAgentTurn = !sessionId || result.lastAgentTurn?.sessionId === sessionId
      ? result.lastAgentTurn ?? null
      : null;
    // Only a real `git.status.result` reports the turn, and the action reply
    // below rebuilds this message *without the key*, so an absent key still
    // keeps the last summary we were told about. An explicit `null` is the
    // server saying it has none — that must clear a cached one, or a browser
    // left open across a failed capture keeps offering a stale comparison.
    setWorkspace(result.workspaceId, {
      status: updateStatusFromWire(result),
      statusState: "ready",
      statusError: undefined,
      ...("lastAgentTurn" in result ? { lastAgentTurn } : {}),
    });
    return true;
  }
  if (message.type === "git.diff.result") {
    const result = message as GitDiffResultMessage;
    const revisionFields = result as GitDiffResultMessage & GitDiffRevisionFields;
    const diff: GitDiffSnapshot = {
      ...result,
      ...(revisionFields.sourceRevision ? { sourceRevision: revisionFields.sourceRevision } : {}),
      ...(revisionFields.sourceRevisions ? { sourceRevisions: revisionFields.sourceRevisions } : {}),
    };
    setWorkspace(result.workspaceId, { diff, diffState: "ready", diffError: undefined });
    return true;
  }
  if (message.type === "git.refs.result") {
    const result = message as Extract<ServerMessage, { type: "git.refs.result" }>;
    setWorkspace(result.workspaceId, { refs: result.refs, actionState: "idle" });
    return true;
  }
  if (message.type === "git.action.result") {
    const result = message as GitActionResultMessage;
    setWorkspace(result.workspaceId, { status: updateStatusFromWire({ type: "git.status.result", requestId, workspaceId: result.workspaceId, status: result.receipt.status }), statusState: "ready", actionState: "idle", actionError: undefined });
    refreshAfterAction(result.workspaceId);
    return true;
  }
  if (message.type === "git.preview.result") {
    const result = message as GitPreviewResultMessage;
    finished.resolve?.(result.preview);
    setWorkspace(result.preview.workspaceId, { actionState: "idle", actionError: undefined });
    return true;
  }
  if (message.type === "review.list.result") {
    const result = message as ReviewListResultMessage;
    setWorkspace(result.workspaceId, { comments: result.comments, actionState: "idle", actionError: undefined });
    return true;
  }
  if (message.type === "review.comment.result") {
    const result = message as ReviewCommentResultMessage;
    setWorkspace(result.workspaceId, { comments: mergeComment(commentListFor(useWorkspaceGitReviewStore.getState(), result.workspaceId), result.comment), actionState: "idle", actionError: undefined });
    return true;
  }
  if (message.type === "review.delete.result") {
    const result = message as ReviewDeleteResultMessage;
    if (result.deleted) setWorkspace(result.workspaceId, { comments: commentListFor(useWorkspaceGitReviewStore.getState(), result.workspaceId).filter((comment) => comment.id !== result.commentId), actionState: "idle", actionError: undefined });
    return true;
  }
  if (message.type === "review.batch.preview.result") {
    const result = message as ReviewBatchPreviewResultMessage;
    finished.resolve?.(result.packet);
    setWorkspace(result.packet.workspaceId, { actionState: "idle", actionError: undefined });
    return true;
  }
  if (message.type === "review.batch.send.result") {
    const result = message as ReviewBatchSendResultMessage;
    const delivery: ReviewBatchDelivery = { packetId: result.packetId, sendOperationId: result.sendOperationId, delivery: result.delivery, ...(result.targetSessionId ? { targetSessionId: result.targetSessionId } : {}), ...(result.targetAgentId ? { targetAgentId: result.targetAgentId } : {}) };
    const current = workspaceStateFor(useWorkspaceGitReviewStore.getState(), result.workspaceId).batchDelivery;
    setWorkspace(result.workspaceId, { batchDelivery: mergeBatchDelivery(current, delivery), actionState: "idle", actionError: undefined });
    finished.resolve?.(delivery);
    return true;
  }
  return true;
}

function mergeComment(comments: ReviewComment[], comment: ReviewComment): ReviewComment[] {
  const index = comments.findIndex((candidate) => candidate.id === comment.id);
  if (index < 0) return [...comments, comment];
  const next = [...comments];
  next[index] = comment;
  return next;
}

socket.onMessage(handleGitReviewMessage);
socket.onConnectionChange(handleGitReviewConnectionChange);
