import { create } from "zustand";
import type {
  ClientMessage,
  DirectoryEntry,
  FileMetadata,
  FileBufferSummary,
  FsErrorMessage,
  FsBufferCloseResultMessage,
  FsBufferListResultMessage,
  FsBufferResultMessage,
  FsChangedMessage,
  FsPreviewResultMessage,
  FsReadResultMessage,
  FsTreeResultMessage,
  FsWriteResultMessage,
  ServerMessage,
} from "@perch/shared";
import { socket } from "./ws";
import { newId } from "./ids";

/** The loading/error state for one lazy directory level. Entries are kept
 * while a refresh is in flight so expanding a folder never flashes an empty
 * tree or loses the last useful result. */
export interface WorkspaceTreeState {
  workspaceId: string;
  path: string;
  entries: DirectoryEntry[];
  truncated: boolean;
  state: "idle" | "loading" | "ready" | "error";
  requestId?: string;
  error?: string;
}

/** One open text buffer. `content` is the draft currently shown in the
 * editor; `savedContent` is the exact content returned by the last successful
 * read/write. Keeping both makes dirty state deterministic and lets a
 * conflict preserve the user's draft while offering explicit recovery. */
export interface WorkspaceDocumentState {
  workspaceId: string;
  path: string;
  metadata?: FileMetadata;
  content: string;
  savedContent: string;
  version?: string;
  /** Server-owned draft state. `content` can remain newer than
   * `persistedContent` while a debounced buffer.set or a filesystem write is
   * in flight. */
  persistedContent?: string;
  baseContent?: string;
  baseVersion?: string;
  externalVersion?: string;
  bufferRevision?: number;
  bufferState?: "idle" | "loading" | "saving" | "ready" | "conflict" | "error";
  readRequestId?: string;
  bufferRequestId?: string;
  state: "idle" | "loading" | "ready" | "saving" | "conflict" | "error";
  requestId?: string;
  error?: string;
  conflict?: {
    message: string;
    expectedVersion?: string;
    actualVersion?: string;
    expectedBufferRevision?: number;
    actualBufferRevision?: number;
    current?: FileMetadata;
  };
}

export interface WorkspacePreviewState {
  workspaceId: string;
  path: string;
  metadata?: FileMetadata;
  version?: string;
  kind?: FsPreviewResultMessage["kind"];
  content?: string;
  mediaType?: string;
  requiresSandbox: boolean;
  truncated: boolean;
  message?: string;
  state: "idle" | "loading" | "ready" | "error";
  requestId?: string;
  error?: string;
}

interface PendingFilesystemRequest {
  workspaceId: string;
  kind: "tree" | "read" | "preview" | "write" | "bufferList" | "bufferGet" | "bufferSet" | "bufferClose";
  path: string;
  transportGeneration?: number;
  reconnect?: boolean;
  afterSave?: { expectedVersion?: string };
  content?: string;
  baseContent?: string;
  expectedVersion?: string;
  expectedBufferRevision?: number;
  /** Content visible when a read began. If the user types before the reply,
   * the reply updates savedContent/version while leaving that newer draft in
   * place. */
  baselineContent?: string;
}

export interface WorkspaceFilesState {
  trees: Record<string, Record<string, WorkspaceTreeState>>;
  documents: Record<string, Record<string, WorkspaceDocumentState>>;
  previews: Record<string, Record<string, WorkspacePreviewState>>;
  bufferSummaries: Record<string, FileBufferSummary[]>;
  bufferListState: Record<string, { state: "idle" | "loading" | "ready" | "error"; error?: string; requestId?: string }>;
  requestTree: (workspaceId: string, path?: string) => string | null;
  requestBufferList: (workspaceId: string) => string | null;
  openFile: (workspaceId: string, path: string, force?: boolean) => string | null;
  reloadFile: (workspaceId: string, path: string) => string | null;
  requestPreview: (workspaceId: string, path: string) => string | null;
  updateDraft: (workspaceId: string, path: string, content: string) => void;
  saveFile: (workspaceId: string, path: string, expectedVersion?: string) => string | null;
  overwriteFile: (workspaceId: string, path: string) => string | null;
  clearWorkspace: (workspaceId: string) => void;
}

const pendingRequests = new Map<string, PendingFilesystemRequest>();
const latestRequestByKey = new Map<string, string>();
const pendingReloads = new Map<string, { workspaceId: string; path: string }>();
const pendingSaveAfterBuffer = new Map<string, { workspaceId: string; path: string; content: string; expectedVersion?: string }>();
const pendingSaveAfterReconnect = new Map<string, { workspaceId: string; path: string; content: string; expectedVersion?: string }>();
const bufferTimers = new Map<string, ReturnType<typeof setTimeout>>();
const BUFFER_SAVE_DEBOUNCE_MS = 350;
let transportGeneration = 0;
/** Keep normal browsing bounded without ever evicting an unsaved/conflicted
 * draft. A workspace with more than this many dirty files is allowed to grow
 * temporarily so a user's work is never discarded silently. */
export const MAX_CACHED_DOCUMENTS = 32;
type FilesystemRequestKind = PendingFilesystemRequest["kind"];

function newRequestId(): string {
  return newId();
}

/** Paths in the tree are already workspace-relative and server-normalized.
 * This only removes UI punctuation; traversal components remain intact so a
 * malformed caller still reaches the server's confinement checks. */
export function normalizeWorkspacePath(path: string | undefined): string {
  if (!path || path === ".") return "";
  return path.trim().replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function requestKey(kind: PendingFilesystemRequest["kind"], workspaceId: string, path: string): string {
  return `${kind}:${workspaceId}:${path}`;
}

function hasWorkspaceRequest(requestId: string, kind: PendingFilesystemRequest["kind"], workspaceId: string, path: string): boolean {
  const pending = pendingRequests.get(requestId);
  if (!pending || pending.kind !== kind || pending.workspaceId !== workspaceId || pending.path !== path) {
    return false;
  }
  return latestRequestByKey.get(requestKey(kind, workspaceId, path)) === requestId;
}

function beginRequest(
  workspaceId: string,
  kind: PendingFilesystemRequest["kind"],
  path: string,
  context: Omit<PendingFilesystemRequest, "workspaceId" | "kind" | "path"> = {},
): string | null {
  if (!workspaceId || !socket.connected) return null;
  const requestId = newRequestId();
  pendingRequests.set(requestId, { workspaceId, kind, path, transportGeneration, ...context });
  latestRequestByKey.set(requestKey(kind, workspaceId, path), requestId);
  return requestId;
}

function finishRequest(requestId: string, pending: PendingFilesystemRequest): void {
  pendingRequests.delete(requestId);
  const key = requestKey(pending.kind, pending.workspaceId, pending.path);
  if (latestRequestByKey.get(key) === requestId) latestRequestByKey.delete(key);
}

function updateNested<T>(
  records: Record<string, Record<string, T>>,
  workspaceId: string,
  path: string,
  value: T,
): Record<string, Record<string, T>> {
  return {
    ...records,
    [workspaceId]: {
      ...(records[workspaceId] ?? {}),
      [path]: value,
    },
  };
}

function updateDocuments(
  records: Record<string, Record<string, WorkspaceDocumentState>>,
  workspaceId: string,
  path: string,
  value: WorkspaceDocumentState,
): Record<string, Record<string, WorkspaceDocumentState>> {
  const updated = updateNested(records, workspaceId, path, value);
  const workspaceRecords = updated[workspaceId];
  if (!workspaceRecords || Object.keys(workspaceRecords).length <= MAX_CACHED_DOCUMENTS) return updated;

  // Object insertion order is a useful, allocation-free least-recently-used
  // approximation here: every read/write replaces the same key in place, so
  // evict only clean entries that have been idle longest. Dirty, conflicted,
  // loading, and saving buffers remain addressable until explicitly resolved.
  const evictable = Object.entries(workspaceRecords).filter(([candidatePath, document]) => (
    candidatePath !== path &&
    document.content === document.savedContent &&
    (document.state === "ready" || document.state === "idle" || document.state === "error")
  ));
  const removeCount = Math.min(
    evictable.length,
    Object.keys(workspaceRecords).length - MAX_CACHED_DOCUMENTS,
  );
  if (removeCount === 0) return updated;
  const nextWorkspace = { ...workspaceRecords };
  for (const [candidatePath] of evictable.slice(0, removeCount)) delete nextWorkspace[candidatePath];
  return { ...updated, [workspaceId]: nextWorkspace };
}

function removeNested<T>(
  records: Record<string, Record<string, T>>,
  workspaceId: string,
  path: string,
): Record<string, Record<string, T>> {
  const workspaceRecords = records[workspaceId];
  if (!workspaceRecords || !(path in workspaceRecords)) return records;
  const nextWorkspace = { ...workspaceRecords };
  delete nextWorkspace[path];
  return { ...records, [workspaceId]: nextWorkspace };
}

function treeFor(state: WorkspaceFilesState, workspaceId: string, path: string): WorkspaceTreeState {
  return state.trees[workspaceId]?.[path] ?? {
    workspaceId,
    path,
    entries: [],
    truncated: false,
    state: "idle",
  };
}

function documentFor(state: WorkspaceFilesState, workspaceId: string, path: string): WorkspaceDocumentState {
  return state.documents[workspaceId]?.[path] ?? {
    workspaceId,
    path,
    content: "",
    savedContent: "",
    state: "idle",
  };
}

function previewFor(state: WorkspaceFilesState, workspaceId: string, path: string): WorkspacePreviewState {
  return state.previews[workspaceId]?.[path] ?? {
    workspaceId,
    path,
    requiresSandbox: false,
    truncated: false,
    state: "idle",
  };
}

function documentKey(workspaceId: string, path: string): string {
  return `${workspaceId}:${path}`;
}

function sendFilesystemWrite(
  workspaceId: string,
  path: string,
  content: string,
  expectedVersion?: string,
  expectedBufferRevision?: number,
): string | null {
  const requestId = beginRequest(workspaceId, "write", path, {
    content,
    ...(expectedVersion ? { expectedVersion } : {}),
    ...(expectedBufferRevision !== undefined ? { expectedBufferRevision } : {}),
  });
  if (!requestId) return null;
  useWorkspaceFilesStore.setState((state) => ({
    documents: updateDocuments(state.documents, workspaceId, path, {
      ...documentFor(state, workspaceId, path),
      state: "saving",
      requestId,
      error: undefined,
      conflict: undefined,
    }),
  }));
  const message: ClientMessage = {
    type: "fs.write",
    requestId,
    workspaceId,
    path,
    content,
    ...(expectedVersion ? { expectedVersion } : {}),
    ...(expectedBufferRevision !== undefined ? { expectedBufferRevision } : {}),
  };
  socket.send(message);
  return requestId;
}

/** Persist a draft to the server-owned buffer. This is intentionally a
 * separate operation from fs.write: closing a pane or reconnecting can still
 * recover the draft, while an explicit Save later publishes it to disk. */
function sendBufferSet(
  workspaceId: string,
  path: string,
  afterSave?: { expectedVersion?: string },
): string | null {
  const current = useWorkspaceFilesStore.getState().documents[workspaceId]?.[path];
  if (!current || !socket.connected) return null;
  const inFlight = current.bufferRequestId ? pendingRequests.get(current.bufferRequestId) : undefined;
  if (inFlight?.kind === "bufferSet") return current.bufferRequestId!;
  const requestId = beginRequest(workspaceId, "bufferSet", path, {
    content: current.content,
    baseContent: current.baseContent ?? current.savedContent,
    ...(current.bufferRevision !== undefined ? { expectedBufferRevision: current.bufferRevision } : {}),
  });
  if (!requestId) return null;
  if (afterSave) {
    pendingSaveAfterBuffer.set(requestId, {
      workspaceId,
      path,
      content: current.content,
      ...(afterSave.expectedVersion ? { expectedVersion: afterSave.expectedVersion } : {}),
    });
  }
  useWorkspaceFilesStore.setState((state) => ({
    documents: updateDocuments(state.documents, workspaceId, path, {
      ...documentFor(state, workspaceId, path),
      state: afterSave ? "saving" : (documentFor(state, workspaceId, path).state === "conflict" ? "conflict" : "ready"),
      requestId: afterSave ? requestId : documentFor(state, workspaceId, path).requestId,
      bufferState: "saving",
      bufferRequestId: requestId,
      error: undefined,
    }),
  }));
  const message: ClientMessage = {
    type: "fs.buffer.set",
    requestId,
    workspaceId,
    path,
    content: current.content,
    baseContent: current.baseContent ?? current.savedContent,
    ...(current.bufferRevision !== undefined ? { expectedBufferRevision: current.bufferRevision } : {}),
  };
  socket.send(message);
  return requestId;
}

function scheduleBufferSet(workspaceId: string, path: string): void {
  const key = documentKey(workspaceId, path);
  const existing = bufferTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    bufferTimers.delete(key);
    sendBufferSet(workspaceId, path);
  }, BUFFER_SAVE_DEBOUNCE_MS);
  bufferTimers.set(key, timer);
}

/** Ask the server for the latest durable row before retrying after a dropped
 * connection. A request may have committed immediately before the socket
 * closed, so blindly replaying the old expected revision would turn a lost
 * acknowledgement into a false conflict. */
function requestBufferResync(
  workspaceId: string,
  path: string,
  afterSave?: { expectedVersion?: string },
): string | null {
  const current = useWorkspaceFilesStore.getState().documents[workspaceId]?.[path];
  if (!current || !socket.connected) return null;
  const requestId = beginRequest(workspaceId, "bufferGet", path, {
    baselineContent: current.content,
    reconnect: true,
    ...(afterSave ? { afterSave } : {}),
  });
  if (!requestId) return null;
  useWorkspaceFilesStore.setState((state) => ({
    documents: updateDocuments(state.documents, workspaceId, path, {
      ...documentFor(state, workspaceId, path),
      state: afterSave ? "saving" : "loading",
      requestId,
      bufferRequestId: requestId,
      bufferState: "loading",
      error: undefined,
    }),
  }));
  socket.send({ type: "fs.buffer.get", requestId, workspaceId, path });
  return requestId;
}

export const useWorkspaceFilesStore = create<WorkspaceFilesState>((set, get) => ({
  trees: {},
  documents: {},
  previews: {},
  bufferSummaries: {},
  bufferListState: {},

  requestTree: (workspaceId, pathParam) => {
    const path = normalizeWorkspacePath(pathParam);
    const requestId = beginRequest(workspaceId, "tree", path);
    if (!requestId) return null;
    const current = treeFor(get(), workspaceId, path);
    set((state) => ({
      trees: updateNested(state.trees, workspaceId, path, {
        ...current,
        state: "loading",
        requestId,
        error: undefined,
      }),
    }));
    socket.send({ type: "fs.tree", requestId, workspaceId, ...(path ? { path } : {}) });
    return requestId;
  },

  requestBufferList: (workspaceId) => {
    const requestId = beginRequest(workspaceId, "bufferList", "");
    if (!requestId) return null;
    set((state) => ({
      bufferListState: {
        ...state.bufferListState,
        [workspaceId]: { state: "loading", requestId, error: undefined },
      },
    }));
    socket.send({ type: "fs.buffer.list", requestId, workspaceId });
    return requestId;
  },

  openFile: (workspaceId, pathParam, force = false) => {
    const path = normalizeWorkspacePath(pathParam);
    if (!path) return null;
    const current = get().documents[workspaceId]?.[path];
    if (current?.state === "saving") return null;
    if (!force && current && current.content !== current.savedContent) return null;
    const baselineContent = current?.content ?? "";
    const bufferRequestId = beginRequest(workspaceId, "bufferGet", path, {
      baselineContent,
    });
    const readRequestId = beginRequest(workspaceId, "read", path, {
      baselineContent,
    });
    if (!bufferRequestId && !readRequestId) return null;
    const requestId = bufferRequestId ?? readRequestId!;
    set((state) => ({
      documents: updateDocuments(state.documents, workspaceId, path, {
        ...documentFor(state, workspaceId, path),
        state: "loading",
        requestId,
        readRequestId: readRequestId ?? undefined,
        bufferRequestId: bufferRequestId ?? undefined,
        bufferState: bufferRequestId ? "loading" : "error",
        error: undefined,
        conflict: undefined,
      }),
    }));
    if (bufferRequestId) {
      socket.send({ type: "fs.buffer.get", requestId: bufferRequestId, workspaceId, path });
    }
    if (readRequestId) {
      // Metadata still comes from the bounded read endpoint. Its response is
      // merged with the durable buffer and never replaces a newer draft.
      socket.send({ type: "fs.read", requestId: readRequestId, workspaceId, path });
    }
    return requestId;
  },

  reloadFile: (workspaceId, pathParam) => {
    const path = normalizeWorkspacePath(pathParam);
    if (!path) return null;
    const current = get().documents[workspaceId]?.[path];
    // A debounced buffer.set owns the latest revision. Wait for its reply
    // instead of issuing fs.buffer.close against an older revision.
    if (current?.bufferState === "saving") return null;
    if (current?.bufferRevision !== undefined && socket.connected) {
      const requestId = beginRequest(workspaceId, "bufferClose", path, {
        expectedBufferRevision: current.bufferRevision,
      });
      if (!requestId) return null;
      pendingReloads.set(requestId, { workspaceId, path });
      set((state) => ({
        documents: updateDocuments(state.documents, workspaceId, path, {
          ...documentFor(state, workspaceId, path),
          state: "loading",
          requestId,
          bufferRequestId: requestId,
          bufferState: "saving",
          error: undefined,
          conflict: undefined,
        }),
      }));
      socket.send({
        type: "fs.buffer.close",
        requestId,
        workspaceId,
        path,
        expectedBufferRevision: current.bufferRevision,
        discard: true,
      });
      return requestId;
    }
    return get().openFile(workspaceId, path, true);
  },

  requestPreview: (workspaceId, pathParam) => {
    const path = normalizeWorkspacePath(pathParam);
    if (!path) return null;
    const requestId = beginRequest(workspaceId, "preview", path);
    if (!requestId) return null;
    set((state) => ({
      previews: updateNested(state.previews, workspaceId, path, {
        ...previewFor(state, workspaceId, path),
        state: "loading",
        requestId,
        error: undefined,
      }),
    }));
    socket.send({ type: "fs.preview", requestId, workspaceId, path });
    return requestId;
  },

  updateDraft: (workspaceId, pathParam, content) => {
    const path = normalizeWorkspacePath(pathParam);
    if (!path) return;
    set((state) => {
      const current = documentFor(state, workspaceId, path);
      return {
        documents: updateDocuments(state.documents, workspaceId, path, {
          ...current,
          content,
          bufferState: current.bufferState === "conflict" ? "conflict" : "saving",
          error: undefined,
        }),
      };
    });
    // Draft persistence is best effort while connected. The timer is kept
    // separate from React state so rapid typing coalesces into one bounded
    // request without ever dropping the newest local text.
    scheduleBufferSet(workspaceId, path);
  },

  saveFile: (workspaceId, pathParam, expectedVersionParam) => {
    const path = normalizeWorkspacePath(pathParam);
    const current = get().documents[workspaceId]?.[path];
    if (!current || current.state === "saving" || !socket.connected) return null;
    const expectedVersion = expectedVersionParam ?? current.baseVersion ?? current.version;
    const pendingBufferRequest = current.bufferRequestId
      ? pendingRequests.get(current.bufferRequestId)
      : undefined;
    if (pendingBufferRequest?.kind === "bufferSet") {
      // The explicit save is chained after the in-flight draft persistence so
      // disk receives exactly the revision the user saw when clicking Save.
      pendingSaveAfterBuffer.set(current.bufferRequestId!, {
        workspaceId,
        path,
        content: current.content,
        ...(expectedVersion ? { expectedVersion } : {}),
      });
      set((state) => ({
        documents: updateDocuments(state.documents, workspaceId, path, {
          ...documentFor(state, workspaceId, path),
          state: "saving",
          requestId: current.bufferRequestId,
          error: undefined,
          conflict: undefined,
        }),
      }));
      return current.bufferRequestId!;
    }

    const timer = bufferTimers.get(documentKey(workspaceId, path));
    if (timer) {
      clearTimeout(timer);
      bufferTimers.delete(documentKey(workspaceId, path));
    }
    if (current.bufferState !== "error" && current.bufferRevision !== undefined) {
      return sendBufferSet(workspaceId, path, { expectedVersion });
    }
    return sendFilesystemWrite(workspaceId, path, current.content, expectedVersion, current.bufferRevision);
  },

  overwriteFile: (workspaceId, path) => {
    const normalizedPath = normalizeWorkspacePath(path);
    const current = get().documents[workspaceId]?.[normalizedPath];
    if (!current || current.state === "saving" || !socket.connected) return null;
    const actualVersion = current?.conflict?.actualVersion;
    const timer = bufferTimers.get(documentKey(workspaceId, normalizedPath));
    if (timer) {
      clearTimeout(timer);
      bufferTimers.delete(documentKey(workspaceId, normalizedPath));
    }
    return sendFilesystemWrite(
      workspaceId,
      normalizedPath,
      current.content,
      actualVersion ?? current.baseVersion ?? current.version,
      current.bufferRevision,
    );
  },

  clearWorkspace: (workspaceId) => {
    set((state) => {
      const trees = { ...state.trees };
      const documents = { ...state.documents };
      const previews = { ...state.previews };
      const bufferSummaries = { ...state.bufferSummaries };
      const bufferListState = { ...state.bufferListState };
      delete trees[workspaceId];
      delete documents[workspaceId];
      delete previews[workspaceId];
      delete bufferSummaries[workspaceId];
      delete bufferListState[workspaceId];
      for (const [key, timer] of bufferTimers) {
        if (key.startsWith(`${workspaceId}:`)) {
          clearTimeout(timer);
          bufferTimers.delete(key);
        }
      }
      for (const [requestId, reload] of pendingReloads) {
        if (reload.workspaceId === workspaceId) pendingReloads.delete(requestId);
      }
      for (const [requestId, save] of pendingSaveAfterBuffer) {
        if (save.workspaceId === workspaceId) pendingSaveAfterBuffer.delete(requestId);
      }
      for (const [key, save] of pendingSaveAfterReconnect) {
        if (save.workspaceId === workspaceId) pendingSaveAfterReconnect.delete(key);
      }
      for (const [requestId, pending] of pendingRequests) {
        if (pending.workspaceId === workspaceId) {
          pendingRequests.delete(requestId);
          latestRequestByKey.delete(requestKey(pending.kind, pending.workspaceId, pending.path));
        }
      }
      return { trees, documents, previews, bufferSummaries, bufferListState };
    });
  },
}));

function handleFsMessage(raw: ServerMessage): boolean {
  // File watchers and the save adapter publish this without a request id.
  // Treat it as invalidation only: a dirty/in-flight draft remains the source
  // of truth until the user explicitly compares, reloads, or overwrites.
  if (raw.type === "fs.changed") {
    const message = raw as FsChangedMessage;
    const path = normalizeWorkspacePath(message.path);
    useWorkspaceFilesStore.setState((state) => {
      const current = state.documents[message.workspaceId]?.[path];
      if (!current) return state;
      const dirty = current.content !== current.savedContent
        || current.bufferState === "saving"
        || current.bufferState === "conflict";
      if (!dirty && !message.conflict) {
        return {
          documents: updateDocuments(state.documents, message.workspaceId, path, {
            ...current,
            externalVersion: message.version ?? current.externalVersion,
            version: message.version ?? current.version,
            metadata: message.metadata ?? current.metadata,
          }),
        };
      }
      return {
        documents: updateDocuments(state.documents, message.workspaceId, path, {
          ...current,
          metadata: message.metadata ?? current.metadata,
          externalVersion: message.version ?? current.externalVersion,
          bufferRevision: message.bufferRevision ?? current.bufferRevision,
          bufferState: "conflict",
          state: current.state === "saving" ? "saving" : "conflict",
          conflict: {
            message: "File changed on disk.",
            expectedVersion: current.baseVersion ?? current.version,
            actualVersion: message.version ?? current.externalVersion,
            current: message.metadata,
          },
        }),
      };
    });
    return true;
  }

  if (
    raw.type !== "fs.tree.result" &&
    raw.type !== "fs.read.result" &&
    raw.type !== "fs.preview.result" &&
    raw.type !== "fs.write.result" &&
    raw.type !== "fs.buffer.list.result" &&
    raw.type !== "fs.buffer.result" &&
    raw.type !== "fs.buffer.close.result" &&
    raw.type !== "fs.error"
  ) return false;

  const message = raw as
    | FsTreeResultMessage
    | FsReadResultMessage
    | FsPreviewResultMessage
    | FsWriteResultMessage
    | FsBufferListResultMessage
    | FsBufferResultMessage
    | FsBufferCloseResultMessage
    | FsErrorMessage;
  const pending = pendingRequests.get(message.requestId);
  if (!pending || pending.workspaceId !== message.workspaceId) return true;
  const messagePath = message.type === "fs.buffer.result"
    ? normalizeWorkspacePath(message.buffer.path)
    : message.type === "fs.buffer.list.result"
      ? ""
      : "path" in message && typeof message.path === "string"
        ? normalizeWorkspacePath(message.path)
        : pending.path;
  if (pending.path !== messagePath || !hasWorkspaceRequest(message.requestId, pending.kind, pending.workspaceId, pending.path)) {
    pendingRequests.delete(message.requestId);
    return true;
  }
  finishRequest(message.requestId, pending);

  if (message.type === "fs.tree.result") {
    useWorkspaceFilesStore.setState((state) => ({
      trees: updateNested(state.trees, pending.workspaceId, pending.path, {
        ...treeFor(state, pending.workspaceId, pending.path),
        path: normalizeWorkspacePath(message.path),
        entries: message.entries,
        truncated: message.truncated,
        state: "ready",
        requestId: undefined,
        error: undefined,
      }),
    }));
    return true;
  }

  if (message.type === "fs.buffer.list.result") {
    useWorkspaceFilesStore.setState((state) => ({
      bufferSummaries: {
        ...state.bufferSummaries,
        [pending.workspaceId]: message.buffers,
      },
      bufferListState: {
        ...state.bufferListState,
        [pending.workspaceId]: { state: "ready", requestId: undefined },
      },
    }));
    return true;
  }

  if (message.type === "fs.buffer.result") {
    const buffer = message.buffer;
    const pendingSave = pending.kind === "bufferSet"
      ? pendingSaveAfterBuffer.get(message.requestId)
      : pending.reconnect
        ? pending.afterSave
        : undefined;
    const shouldScheduleDraft = { value: false };
    const shouldRetryAfterResync = { value: false };
    const shouldChainSave = { value: false };
    useWorkspaceFilesStore.setState((state) => {
      const current = documentFor(state, pending.workspaceId, pending.path);
      const requestStillOwnsBuffer = current.bufferRequestId === message.requestId;
      const preserveDraft = pending.kind === "bufferGet"
        && (pending.reconnect === true
          // fs.read and fs.buffer.get are intentionally concurrent. A clean
          // fs.read reply is not user input; only content that is still dirty
          // or explicitly marked as a pending local edit may outrank the
          // durable buffer response.
          || current.bufferState === "saving"
          || current.content !== current.savedContent);
      const reconnectRevisionChanged = pending.reconnect === true
        && current.bufferRevision !== undefined
        && current.bufferRevision !== buffer.revision;
      const reconnectConflict = reconnectRevisionChanged && current.content !== buffer.content;
      const bufferConflict = buffer.conflict || reconnectConflict;
      // A buffer.set response with `conflict: true` is still allowed to chain
      // an explicit Save into fs.write; the disk version check then returns
      // the normal compare/overwrite error. A reconnect resync, however, must
      // stop at a true revision conflict rather than silently replacing a
      // different client's durable draft.
      shouldChainSave.value = pending.kind === "bufferSet" && Boolean(pendingSave);
      if (shouldChainSave.value && pending.kind === "bufferSet") pendingSaveAfterBuffer.delete(message.requestId);
      const baseContent = buffer.baseContent;
      const baseVersion = buffer.baseVersion;
      const content = preserveDraft ? current.content : buffer.content;
      const conflict = bufferConflict
        ? {
            message: "File changed on disk.",
            expectedVersion: baseVersion,
            actualVersion: buffer.externalVersion,
            expectedBufferRevision: current.bufferRevision,
            actualBufferRevision: buffer.revision,
          }
        : undefined;
      const latestDraftDiffers = pending.kind === "bufferSet"
        && pending.content !== undefined
        && current.content !== pending.content;
      shouldScheduleDraft.value = !shouldChainSave.value && !bufferConflict && (preserveDraft || latestDraftDiffers);
      shouldRetryAfterResync.value = pending.reconnect === true
        && !reconnectConflict
        && (Boolean(pendingSave) || current.content !== buffer.content);
      const nextState: WorkspaceDocumentState["state"] = bufferConflict
        ? "conflict"
        : shouldChainSave.value
          ? "saving"
          : current.state === "saving" && current.requestId !== message.requestId
            ? "saving"
            : "ready";
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          workspaceId: pending.workspaceId,
          path: buffer.path,
          content,
          savedContent: baseContent,
          persistedContent: buffer.content,
          baseContent,
          baseVersion,
          externalVersion: buffer.externalVersion,
          bufferRevision: buffer.revision,
          bufferState: bufferConflict ? "conflict" : "ready",
          // A metadata read may still be in flight. Keep its id so that its
          // reply can merge metadata without replacing this durable draft.
          requestId: shouldChainSave.value
            ? undefined
            : current.readRequestId ?? (requestStillOwnsBuffer ? undefined : current.requestId),
          readRequestId: current.readRequestId,
          bufferRequestId: requestStillOwnsBuffer ? undefined : current.bufferRequestId,
          version: baseVersion ?? buffer.externalVersion ?? current.version,
          state: nextState,
          error: undefined,
          conflict,
        }),
      };
    });
    if (shouldRetryAfterResync.value) {
      sendBufferSet(
        pending.workspaceId,
        pending.path,
        pendingSave ? { expectedVersion: pendingSave.expectedVersion } : undefined,
      );
    } else if (shouldScheduleDraft.value) {
      scheduleBufferSet(pending.workspaceId, pending.path);
    }
    if (shouldChainSave.value && pendingSave && pending.kind === "bufferSet") {
      sendFilesystemWrite(
        pending.workspaceId,
        pending.path,
        pending.content!,
        pendingSave.expectedVersion,
        buffer.revision,
      );
    }
    return true;
  }

  if (message.type === "fs.buffer.close.result") {
    const reload = pendingReloads.get(message.requestId);
    if (reload) pendingReloads.delete(message.requestId);
    if (reload) {
      useWorkspaceFilesStore.setState((state) => ({
        documents: updateDocuments(state.documents, reload.workspaceId, reload.path, {
          ...documentFor(state, reload.workspaceId, reload.path),
          // The close request carried an explicit discard decision. Clear the
          // old draft/base before issuing the fresh read so the late durable
          // response is treated as a new disk baseline rather than mistaken
          // for user typing that must be preserved.
          content: "",
          savedContent: "",
          persistedContent: undefined,
          baseContent: undefined,
          baseVersion: undefined,
          externalVersion: undefined,
          bufferRevision: undefined,
          state: "loading",
          requestId: undefined,
          bufferRequestId: undefined,
          bufferState: "loading",
          error: undefined,
          conflict: undefined,
        }),
      }));
      useWorkspaceFilesStore.getState().openFile(reload.workspaceId, reload.path, true);
    }
    return true;
  }

  if (message.type === "fs.read.result") {
    useWorkspaceFilesStore.setState((state) => {
      const current = documentFor(state, pending.workspaceId, pending.path);
      // A durable buffer is authoritative for editor content. The read still
      // contributes current disk metadata/version, but never replaces draft,
      // saved baseline, or buffer revision.
      if (current.bufferRevision !== undefined) {
        return {
          documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
            ...current,
            workspaceId: pending.workspaceId,
            path: message.metadata.path,
            metadata: message.metadata,
            externalVersion: message.version,
            version: current.baseVersion ?? current.version ?? message.version,
            state: current.state === "loading" ? "ready" : current.state,
            readRequestId: current.readRequestId === message.requestId ? undefined : current.readRequestId,
            requestId: current.bufferRequestId ?? undefined,
            error: undefined,
          }),
        };
      }
      const preserveDraft = pending.baselineContent !== undefined && current.content !== pending.baselineContent;
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          workspaceId: pending.workspaceId,
          path: message.metadata.path,
          metadata: message.metadata,
          content: preserveDraft ? current.content : message.content,
          savedContent: message.content,
          persistedContent: undefined,
          baseContent: message.content,
          baseVersion: message.version,
          externalVersion: message.version,
          version: message.version,
          state: current.bufferRequestId ? "ready" : "ready",
          requestId: current.bufferRequestId ?? undefined,
          readRequestId: current.readRequestId === message.requestId ? undefined : current.readRequestId,
          error: undefined,
          conflict: undefined,
        }),
      };
    });
    return true;
  }

  if (message.type === "fs.preview.result") {
    useWorkspaceFilesStore.setState((state) => ({
      previews: updateNested(state.previews, pending.workspaceId, pending.path, {
        workspaceId: pending.workspaceId,
        path: message.metadata.path,
        metadata: message.metadata,
        version: message.version,
        kind: message.kind,
        content: message.content,
        mediaType: message.mediaType,
        requiresSandbox: message.requiresSandbox,
        truncated: message.truncated,
        message: message.message,
        state: "ready",
        requestId: undefined,
        error: undefined,
      }),
    }));
    return true;
  }

  if (message.type === "fs.write.result") {
    const shouldScheduleDraft = { value: false };
    useWorkspaceFilesStore.setState((state) => {
      const current = documentFor(state, pending.workspaceId, pending.path);
      const savedContent = pending.content ?? current.content;
      const bufferStillInFlight = current.bufferRequestId
        ? pendingRequests.get(current.bufferRequestId)?.kind === "bufferSet"
        : false;
      shouldScheduleDraft.value = current.content !== savedContent && !bufferStillInFlight;
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          path: message.metadata.path,
          metadata: message.metadata,
          savedContent,
          persistedContent: savedContent,
          baseContent: savedContent,
          baseVersion: message.version,
          externalVersion: message.version,
          version: message.version,
          bufferRevision: message.bufferRevision ?? current.bufferRevision,
          bufferState: bufferStillInFlight ? "saving" : "ready",
          // Preserve a keystroke made while the save was in flight. It stays
          // visibly dirty and can be saved again against the new version.
          state: bufferStillInFlight ? "saving" : "ready",
          requestId: current.requestId === message.requestId ? undefined : current.requestId,
          readRequestId: current.readRequestId,
          error: undefined,
          conflict: undefined,
        }),
      };
    });
    if (shouldScheduleDraft.value) scheduleBufferSet(pending.workspaceId, pending.path);
    return true;
  }

  const error = message as FsErrorMessage;
  useWorkspaceFilesStore.setState((state) => {
    if (pending.kind === "tree") {
      return {
        trees: updateNested(state.trees, pending.workspaceId, pending.path, {
          ...treeFor(state, pending.workspaceId, pending.path),
          state: "error",
          requestId: undefined,
          error: error.message,
        }),
      };
    }
    if (pending.kind === "bufferList") {
      return {
        bufferListState: {
          ...state.bufferListState,
          [pending.workspaceId]: { state: "error", requestId: undefined, error: error.message },
        },
      };
    }
    if (pending.kind === "bufferGet") {
      const current = documentFor(state, pending.workspaceId, pending.path);
      const readStillInFlight = current.readRequestId !== undefined;
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          bufferState: "error",
          bufferRequestId: current.bufferRequestId === message.requestId ? undefined : current.bufferRequestId,
          state: readStillInFlight ? "loading" : current.state === "loading" ? "error" : current.state,
          requestId: current.readRequestId ?? undefined,
          // An old peer may reject the durable extension. Let the successful
          // fs.read fallback clear any transient error on its own.
          error: readStillInFlight ? undefined : current.state === "ready" ? undefined : error.message,
        }),
      };
    }
    if (pending.kind === "bufferSet") {
      const current = documentFor(state, pending.workspaceId, pending.path);
      const isConflict = error.code === "buffer_conflict"
        || error.code === "conflict"
        || error.actualBufferRevision !== undefined;
      if (pendingSaveAfterBuffer.has(message.requestId)) pendingSaveAfterBuffer.delete(message.requestId);
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          state: isConflict ? "conflict" : "error",
          bufferState: isConflict ? "conflict" : "error",
          bufferRequestId: current.bufferRequestId === message.requestId ? undefined : current.bufferRequestId,
          requestId: current.requestId === message.requestId ? undefined : current.requestId,
          bufferRevision: error.actualBufferRevision ?? current.bufferRevision,
          error: error.message,
          ...(isConflict
            ? {
                conflict: {
                  message: error.message,
                  expectedVersion: current.baseVersion ?? current.version,
                  actualVersion: error.actualVersion,
                  current: error.current,
                },
              }
            : {}),
        }),
      };
    }
    if (pending.kind === "bufferClose") {
      const reload = pendingReloads.get(message.requestId);
      if (reload) pendingReloads.delete(message.requestId);
      const current = documentFor(state, pending.workspaceId, pending.path);
      const isConflict = error.code === "buffer_conflict" || error.code === "dirty_buffer" || error.actualBufferRevision !== undefined;
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          state: isConflict ? "conflict" : "error",
          bufferState: isConflict ? "conflict" : "error",
          bufferRequestId: undefined,
          requestId: undefined,
          error: error.message,
          ...(isConflict
            ? {
                conflict: {
                  message: error.message,
                  expectedVersion: current.baseVersion ?? current.version,
                  actualVersion: error.actualVersion,
                  current: error.current,
                },
              }
            : {}),
        }),
      };
    }
    if (pending.kind === "read" || pending.kind === "write") {
      const current = documentFor(state, pending.workspaceId, pending.path);
      const isConflict = error.code === "conflict";
      return {
        documents: updateDocuments(state.documents, pending.workspaceId, pending.path, {
          ...current,
          state: isConflict ? "conflict" : "error",
          requestId: current.requestId === message.requestId ? undefined : current.requestId,
          readRequestId: current.readRequestId === message.requestId ? undefined : current.readRequestId,
          error: error.message,
          ...(isConflict
            ? {
                conflict: {
                  message: error.message,
                  expectedVersion: error.expectedVersion ?? pending.expectedVersion,
                  actualVersion: error.actualVersion,
                  current: error.current,
                },
              }
            : {}),
        }),
      };
    }
    return {
      previews: updateNested(state.previews, pending.workspaceId, pending.path, {
        ...previewFor(state, pending.workspaceId, pending.path),
        state: "error",
        requestId: undefined,
        error: error.message,
      }),
    };
  });
  return true;
}

/** Exported for focused tests and for the socket registration below. */
export function handleWorkspaceFilesMessage(message: ServerMessage): boolean {
  return handleFsMessage(message);
}

socket.onMessage(handleFsMessage);

function documentNeedsBufferSync(document: WorkspaceDocumentState): boolean {
  const differsFromDisk = document.content !== document.savedContent;
  const differsFromPersisted = document.persistedContent !== undefined
    && document.content !== document.persistedContent;
  return differsFromDisk || differsFromPersisted || document.bufferState === "saving";
}

/** Drop replies that the browser can no longer receive after a transport
 * close. Keeping those request ids would make the next flush believe a dead
 * buffer.set is still in flight forever. The document text and server base
 * are deliberately retained; reconnect resubmits the newest local content
 * with the last known revision, and a server conflict remains visible. */
function invalidateFilesystemRequestsOnDisconnect(): void {
  transportGeneration += 1;
  for (const [requestId, save] of pendingSaveAfterBuffer) {
    pendingSaveAfterReconnect.set(documentKey(save.workspaceId, save.path), save);
    pendingSaveAfterBuffer.delete(requestId);
  }
  pendingReloads.clear();
  pendingRequests.clear();
  latestRequestByKey.clear();
  useWorkspaceFilesStore.setState((state) => {
    let documents = state.documents;
    for (const [workspaceId, workspaceDocuments] of Object.entries(state.documents)) {
      for (const [path, document] of Object.entries(workspaceDocuments)) {
        const next: WorkspaceDocumentState = {
          ...document,
          ...(document.requestId ? { requestId: undefined } : {}),
          ...(document.readRequestId ? { readRequestId: undefined } : {}),
          ...(document.bufferRequestId ? { bufferRequestId: undefined } : {}),
        };
        if (document.state === "loading" || document.state === "saving") {
          next.state = document.state === "loading" && !document.content ? "idle" : "ready";
        }
        if (document.bufferState === "saving") {
          next.bufferState = "idle";
        }
        if (next.state !== document.state || next.requestId !== document.requestId || next.readRequestId !== document.readRequestId || next.bufferRequestId !== document.bufferRequestId || next.bufferState !== document.bufferState) {
          documents = updateDocuments(documents, workspaceId, path, next);
        }
      }
    }
    return documents === state.documents ? state : { documents };
  });
}

/** Flush local drafts after a reconnect. Timers are intentionally not
 * sufficient here: a disconnect can happen after the debounce callback has
 * already observed a closed socket, so the callback must be replayed when the
 * transport becomes writable again. Returns whether any unsynced draft was
 * observed, which the beforeunload guard uses to request a user decision. */
export function flushPendingBuffers(): boolean {
  if (!socket.connected) return false;
  let hadUnsyncedDraft = false;
  for (const [key, save] of pendingSaveAfterReconnect) {
    const document = useWorkspaceFilesStore.getState().documents[save.workspaceId]?.[save.path];
    if (!document) {
      pendingSaveAfterReconnect.delete(key);
      continue;
    }
    if (documentNeedsBufferSync(document)) hadUnsyncedDraft = true;
    const requestId = sendBufferSet(save.workspaceId, save.path, { expectedVersion: save.expectedVersion });
    if (requestId) pendingSaveAfterReconnect.delete(key);
  }
  const documents = useWorkspaceFilesStore.getState().documents;
  for (const [workspaceId, workspaceDocuments] of Object.entries(documents)) {
    for (const [path, document] of Object.entries(workspaceDocuments)) {
      if (!documentNeedsBufferSync(document)) continue;
      hadUnsyncedDraft = true;
      sendBufferSet(workspaceId, path);
    }
  }
  return hadUnsyncedDraft;
}

/** Reconnect recovery must read first. The last buffer.set may have committed
 * just before the socket dropped, so its acknowledgement and revision can be
 * missing locally. `fs.buffer.get` distinguishes that safe lost-ack case from
 * a real concurrent revision/content change before any retry is sent. */
function resyncPendingBuffersAfterReconnect(): void {
  if (!socket.connected) return;
  const documents = useWorkspaceFilesStore.getState().documents;
  for (const [workspaceId, workspaceDocuments] of Object.entries(documents)) {
    for (const [path, document] of Object.entries(workspaceDocuments)) {
      const key = documentKey(workspaceId, path);
      const pendingSave = pendingSaveAfterReconnect.get(key);
      if (!pendingSave && !documentNeedsBufferSync(document)) continue;
      const requestId = requestBufferResync(workspaceId, path, pendingSave ? { expectedVersion: pendingSave.expectedVersion } : undefined);
      if (requestId && pendingSave) pendingSaveAfterReconnect.delete(key);
    }
  }
}

/** Exported for focused transport tests. A reconnect starts from a clean
 * request map, then replays unsynced buffers against the server's latest
 * durable revision. */
export function handleFilesystemConnectionChange(connected: boolean): void {
  if (!connected) {
    invalidateFilesystemRequestsOnDisconnect();
    return;
  }
  resyncPendingBuffersAfterReconnect();
}

socket.onConnectionChange(handleFilesystemConnectionChange);

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  const documents = useWorkspaceFilesStore.getState().documents;
  const hasUnsyncedDraft = Object.values(documents).some((workspaceDocuments) => (
    Object.values(workspaceDocuments).some(documentNeedsBufferSync)
  ));
  if (!hasUnsyncedDraft) return;
  // A WebSocket send during beforeunload is best effort. Warn the user so the
  // browser does not silently discard a draft whose server acknowledgement
  // has not arrived; the send below still helps when the socket remains open.
  flushPendingBuffers();
  event.preventDefault();
  event.returnValue = "";
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", handleBeforeUnload);
}
