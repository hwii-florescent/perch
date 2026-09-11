// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static sent: string[] = [];
  readyState = FakeWebSocket.OPEN;
  addEventListener(): void {}
  removeEventListener(): void {}
  send(message: string): void { FakeWebSocket.sent.push(message); }
  close(): void {}
}

(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = () => 0;
(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = () => {};

// The production app imports store.ts before filesystemStore.ts; store's
// module-level socket.connect() is what makes `socket.connected` true for
// requests. Mirror that order here while keeping the test transport fake.
await import("./store");
const {
  flushPendingBuffers,
  handleFilesystemConnectionChange,
  handleWorkspaceFilesMessage,
  MAX_CACHED_DOCUMENTS,
  useWorkspaceFilesStore,
} = await import("./filesystemStore");
type ServerMessage = import("@perch/shared").ServerMessage;

function outgoing(type: string, workspaceId?: string, path?: string): Record<string, unknown> {
  const message = [...FakeWebSocket.sent]
    .map((raw) => JSON.parse(raw) as Record<string, unknown>)
    .reverse()
    .find((candidate) => (
      candidate.type === type
      && (workspaceId === undefined || candidate.workspaceId === workspaceId)
      && (path === undefined || candidate.path === path)
    ));
  if (!message) throw new Error(`No outgoing ${type} message`);
  return message;
}

function metadata(workspaceId: string, path: string, size = 4) {
  return {
    workspaceId,
    path,
    name: path.split("/").pop() ?? path,
    size,
    readonly: false,
    executable: false,
    kind: "file" as const,
  };
}

function bufferResult(
  requestId: string,
  workspaceId: string,
  path: string,
  content: string,
  baseContent: string,
  revision: number,
  baseVersion = "v1",
  externalVersion = baseVersion,
  dirty = content !== baseContent,
  conflict = false,
): ServerMessage {
  return {
    type: "fs.buffer.result",
    requestId,
    workspaceId,
    buffer: {
      workspaceId,
      path,
      content,
      baseContent,
      baseVersion,
      externalVersion,
      revision,
      dirty,
      conflict,
      updatedAt: Date.now(),
    },
  };
}

function respond(message: ServerMessage): void {
  expect(handleWorkspaceFilesMessage(message)).toBe(true);
}

function openAndLoad(workspaceId: string, path = "README.md", content = "original"): void {
  const requestId = useWorkspaceFilesStore.getState().openFile(workspaceId, path);
  expect(requestId).toBeTruthy();
  const readRequest = outgoing("fs.read", workspaceId, path);
  const bufferRequest = outgoing("fs.buffer.get", workspaceId, path);
  respond({
    type: "fs.read.result",
    requestId: readRequest.requestId as string,
    workspaceId,
    metadata: metadata(workspaceId, path, content.length),
    content,
    version: "v1",
  });
  respond(bufferResult(bufferRequest.requestId as string, workspaceId, path, content, content, 0));
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.sent = [];
  useWorkspaceFilesStore.setState({
    trees: {},
    documents: {},
    previews: {},
    bufferSummaries: {},
    bufferListState: {},
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("workspace filesystem store", () => {
  it("keeps lazy tree replies scoped to their workspace", () => {
    const firstRequest = useWorkspaceFilesStore.getState().requestTree("workspace-a", "");
    const secondRequest = useWorkspaceFilesStore.getState().requestTree("workspace-b", "");
    expect(firstRequest).toBeTruthy();
    expect(secondRequest).toBeTruthy();

    respond({
      type: "fs.tree.result",
      requestId: secondRequest!,
      workspaceId: "workspace-b",
      path: "",
      entries: [{ name: "b.md", path: "b.md", kind: "file", size: 1, readonly: false, executable: false }],
      truncated: false,
    });
    respond({
      type: "fs.tree.result",
      requestId: firstRequest!,
      workspaceId: "workspace-a",
      path: "",
      entries: [{ name: "a.md", path: "a.md", kind: "file", size: 1, readonly: false, executable: false }],
      truncated: false,
    });

    const state = useWorkspaceFilesStore.getState();
    expect(state.trees["workspace-a"]?.[""].entries.map((entry) => entry.path)).toEqual(["a.md"]);
    expect(state.trees["workspace-b"]?.[""].entries.map((entry) => entry.path)).toEqual(["b.md"]);
  });

  it("loads and exposes a bounded durable buffer list", () => {
    const requestId = useWorkspaceFilesStore.getState().requestBufferList("workspace-buffers");
    expect(requestId).toBeTruthy();
    respond({
      type: "fs.buffer.list.result",
      requestId: requestId!,
      workspaceId: "workspace-buffers",
      buffers: [{
        workspaceId: "workspace-buffers",
        path: "src/main.ts",
        baseVersion: "v1",
        externalVersion: "v1",
        revision: 2,
        dirty: true,
        conflict: false,
        updatedAt: Date.now(),
      }],
      truncated: false,
    });
    const state = useWorkspaceFilesStore.getState();
    expect(state.bufferListState["workspace-buffers"]?.state).toBe("ready");
    expect(state.bufferSummaries["workspace-buffers"]?.[0]?.path).toBe("src/main.ts");
  });

  it("does not overwrite a newer draft when read and buffer replies arrive late", () => {
    const requestId = useWorkspaceFilesStore.getState().openFile("workspace-late-read", "README.md");
    expect(requestId).toBeTruthy();
    const readRequest = outgoing("fs.read", "workspace-late-read", "README.md");
    const bufferRequest = outgoing("fs.buffer.get", "workspace-late-read", "README.md");
    useWorkspaceFilesStore.getState().updateDraft("workspace-late-read", "README.md", "typed before disk replied");

    respond({
      type: "fs.read.result",
      requestId: readRequest.requestId as string,
      workspaceId: "workspace-late-read",
      metadata: metadata("workspace-late-read", "README.md", 4),
      content: "disk",
      version: "disk-v1",
    });
    respond(bufferResult(
      bufferRequest.requestId as string,
      "workspace-late-read",
      "README.md",
      "disk",
      "disk",
      1,
      "disk-v1",
    ));

    const document = useWorkspaceFilesStore.getState().documents["workspace-late-read"]?.["README.md"];
    expect(document?.content).toBe("typed before disk replied");
    expect(document?.savedContent).toBe("disk");
    expect(document?.persistedContent).toBe("disk");
    expect(document?.baseVersion).toBe("disk-v1");
    expect(document?.content).not.toBe(document?.savedContent);
  });

  it("restores the durable draft when the metadata read wins the response race", () => {
    const requestId = useWorkspaceFilesStore.getState().openFile("workspace-reload-race", "README.md");
    expect(requestId).toBeTruthy();
    const readRequest = outgoing("fs.read", "workspace-reload-race", "README.md");
    const bufferRequest = outgoing("fs.buffer.get", "workspace-reload-race", "README.md");
    respond({
      type: "fs.read.result",
      requestId: readRequest.requestId as string,
      workspaceId: "workspace-reload-race",
      metadata: metadata("workspace-reload-race", "README.md"),
      content: "disk baseline",
      version: "v2",
    });
    respond(bufferResult(
      bufferRequest.requestId as string,
      "workspace-reload-race",
      "README.md",
      "durable draft",
      "disk baseline",
      7,
      "v2",
    ));
    const document = useWorkspaceFilesStore.getState().documents["workspace-reload-race"]?.["README.md"];
    expect(document?.content).toBe("durable draft");
    expect(document?.savedContent).toBe("disk baseline");
    expect(document?.bufferRevision).toBe(7);
  });

  it("marks a dirty open buffer conflicted on an unsolicited disk change without clobbering it", () => {
    openAndLoad("workspace-watcher", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-watcher", "README.md", "local draft");
    respond({
      type: "fs.changed",
      workspaceId: "workspace-watcher",
      path: "README.md",
      version: "v2",
      kind: "changed",
      conflict: true,
    });
    const document = useWorkspaceFilesStore.getState().documents["workspace-watcher"]?.["README.md"];
    expect(document?.content).toBe("local draft");
    expect(document?.state).toBe("conflict");
    expect(document?.bufferState).toBe("conflict");
    expect(document?.conflict?.actualVersion).toBe("v2");
  });

  it("serializes a buffer flush before disk save and preserves typing during save", () => {
    openAndLoad("workspace-save", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-save", "README.md", "first draft");
    const bufferSetRequest = useWorkspaceFilesStore.getState().saveFile("workspace-save", "README.md");
    expect(bufferSetRequest).toBeTruthy();
    const bufferSet = outgoing("fs.buffer.set", "workspace-save", "README.md");
    expect(bufferSet.content).toBe("first draft");
    expect(bufferSet.expectedBufferRevision).toBe(0);

    respond(bufferResult(
      bufferSet.requestId as string,
      "workspace-save",
      "README.md",
      "first draft",
      "original",
      1,
      "v1",
    ));
    const writeRequest = outgoing("fs.write", "workspace-save", "README.md");
    expect(writeRequest.content).toBe("first draft");
    expect(writeRequest.expectedVersion).toBe("v1");
    expect(writeRequest.expectedBufferRevision).toBe(1);

    useWorkspaceFilesStore.getState().updateDraft("workspace-save", "README.md", "newer local typing");
    respond({
      type: "fs.write.result",
      requestId: writeRequest.requestId as string,
      workspaceId: "workspace-save",
      metadata: metadata("workspace-save", "README.md", 11),
      bytesWritten: 11,
      version: "v2",
      bufferRevision: 2,
    });

    const document = useWorkspaceFilesStore.getState().documents["workspace-save"]?.["README.md"];
    expect(document?.content).toBe("newer local typing");
    expect(document?.savedContent).toBe("first draft");
    expect(document?.persistedContent).toBe("first draft");
    expect(document?.baseVersion).toBe("v2");
    expect(document?.state).toBe("ready");
  });

  it("keeps a draft on optimistic concurrency conflict and retries overwrite with disk version", () => {
    openAndLoad("workspace-conflict", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-conflict", "README.md", "my draft");
    const bufferSetRequest = useWorkspaceFilesStore.getState().saveFile("workspace-conflict", "README.md");
    expect(bufferSetRequest).toBeTruthy();
    const bufferSet = outgoing("fs.buffer.set", "workspace-conflict", "README.md");
    respond(bufferResult(
      bufferSet.requestId as string,
      "workspace-conflict",
      "README.md",
      "my draft",
      "original",
      1,
      "v1",
    ));
    const writeRequest = outgoing("fs.write", "workspace-conflict", "README.md");

    respond({
      type: "fs.error",
      requestId: writeRequest.requestId as string,
      workspaceId: "workspace-conflict",
      code: "conflict",
      message: "File changed on disk",
      path: "README.md",
      expectedVersion: "v1",
      actualVersion: "v2",
      current: metadata("workspace-conflict", "README.md", 8),
    });

    const conflicted = useWorkspaceFilesStore.getState().documents["workspace-conflict"]?.["README.md"];
    expect(conflicted?.state).toBe("conflict");
    expect(conflicted?.content).toBe("my draft");
    expect(conflicted?.conflict?.actualVersion).toBe("v2");

    const overwriteRequest = useWorkspaceFilesStore.getState().overwriteFile("workspace-conflict", "README.md");
    expect(overwriteRequest).toBeTruthy();
    const overwrite = outgoing("fs.write", "workspace-conflict", "README.md");
    expect(overwrite.requestId).toBe(overwriteRequest);
    expect(overwrite.expectedVersion).toBe("v2");
    expect(overwrite.expectedBufferRevision).toBe(1);
    expect(overwrite.content).toBe("my draft");
  });

  it("flushes unsent drafts immediately when reconnect handling runs", () => {
    openAndLoad("workspace-reconnect", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-reconnect", "README.md", "offline draft");
    flushPendingBuffers();
    const bufferSet = outgoing("fs.buffer.set", "workspace-reconnect", "README.md");
    expect(bufferSet.content).toBe("offline draft");
    expect(bufferSet.expectedBufferRevision).toBe(0);
  });

  it("invalidates a dead buffer request and retransmits the newest draft after reconnect", () => {
    openAndLoad("workspace-disconnect", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-disconnect", "README.md", "draft before drop");
    flushPendingBuffers();
    const firstSet = outgoing("fs.buffer.set", "workspace-disconnect", "README.md");

    handleFilesystemConnectionChange(false);
    expect(useWorkspaceFilesStore.getState().documents["workspace-disconnect"]?.["README.md"]?.bufferRequestId).toBeUndefined();
    handleFilesystemConnectionChange(true);
    const resync = outgoing("fs.buffer.get", "workspace-disconnect", "README.md");
    // The server accepted the first set but its response was lost. A matching
    // latest row must be adopted without a duplicate write or false conflict.
    respond(bufferResult(
      resync.requestId as string,
      "workspace-disconnect",
      "README.md",
      "draft before drop",
      "original",
      1,
      "v1",
    ));
    const setRequests = FakeWebSocket.sent
      .map((raw) => JSON.parse(raw) as Record<string, unknown>)
      .filter((message) => message.type === "fs.buffer.set");
    expect(setRequests).toHaveLength(1);
    expect(useWorkspaceFilesStore.getState().documents["workspace-disconnect"]?.["README.md"]?.state).toBe("ready");

    // If the server did not accept the original set, resync returns the old
    // row and the client retries against that still-current revision.
    openAndLoad("workspace-disconnect-retry", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-disconnect-retry", "README.md", "retry draft");
    flushPendingBuffers();
    handleFilesystemConnectionChange(false);
    handleFilesystemConnectionChange(true);
    const retryResync = outgoing("fs.buffer.get", "workspace-disconnect-retry", "README.md");
    respond(bufferResult(
      retryResync.requestId as string,
      "workspace-disconnect-retry",
      "README.md",
      "original",
      "original",
      0,
      "v1",
    ));
    const secondSet = [...FakeWebSocket.sent]
      .map((raw) => JSON.parse(raw) as Record<string, unknown>)
      .reverse()
      .find((message) => message.type === "fs.buffer.set" && message.workspaceId === "workspace-disconnect-retry");
    expect(secondSet?.requestId).toBeTruthy();
    expect(secondSet?.content).toBe("retry draft");
    expect(secondSet?.expectedBufferRevision).toBe(0);
    expect(firstSet.content).toBe("draft before drop");
  });

  it("warns before unload while a pending local draft still lacks an acknowledgement", () => {
    openAndLoad("workspace-beforeunload", "README.md", "original");
    useWorkspaceFilesStore.getState().updateDraft("workspace-beforeunload", "README.md", "draft before refresh");
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(outgoing("fs.buffer.set", "workspace-beforeunload", "README.md").content).toBe("draft before refresh");
  });

  it("bounds clean document buffers while retaining the active draft", () => {
    for (let index = 0; index < MAX_CACHED_DOCUMENTS + 5; index += 1) {
      const path = `file-${index}.md`;
      const requestId = useWorkspaceFilesStore.getState().openFile("workspace-bounded", path);
      expect(requestId).toBeTruthy();
      const readRequest = outgoing("fs.read", "workspace-bounded", path);
      respond({
        type: "fs.read.result",
        requestId: readRequest.requestId as string,
        workspaceId: "workspace-bounded",
        metadata: metadata("workspace-bounded", path),
        content: `disk-${index}`,
        version: `v-${index}`,
      });
    }
    const documents = useWorkspaceFilesStore.getState().documents["workspace-bounded"] ?? {};
    expect(Object.keys(documents).length).toBeLessThanOrEqual(MAX_CACHED_DOCUMENTS);
    expect(documents[`file-${MAX_CACHED_DOCUMENTS + 4}.md`]).toBeDefined();
    expect(documents["file-0.md"]).toBeUndefined();
  });
});
