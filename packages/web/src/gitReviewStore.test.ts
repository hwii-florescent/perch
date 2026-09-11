// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import type { GitDiffSnapshot, GitDiffTarget } from "./components/gitReviewModels";

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

const { handleServerMessage, usePerchStore } = await import("./store");
const {
  handleGitReviewConnectionChange,
  handleGitReviewMessage,
  useWorkspaceGitReviewStore,
} = await import("./gitReviewStore");

function request(type: string, workspaceId = "workspace-test"): Record<string, unknown> {
  const found = [...FakeWebSocket.sent]
    .map((raw) => JSON.parse(raw) as Record<string, unknown>)
    .reverse()
    .find((message) => message.type === type && message.workspaceId === workspaceId);
  if (!found) throw new Error(`No outgoing ${type} request`);
  return found;
}

function configureTransport(): void {
  FakeWebSocket.sent = [];
  usePerchStore.setState({
    connected: true,
    activeHostId: "local",
    serverInfo: {
      hostname: "test",
      isSsh: false,
      platform: "test",
      protocolVersion: 2,
      capabilities: ["git.status", "git.refs", "git.diff", "review.list", "review.create"],
    },
    workspaces: [{ id: "workspace-test", projectId: "project-test", hostId: "local", path: "/tmp/review", name: "Review", state: "active" }] as never,
    sessionId: "session-test",
  });
  useWorkspaceGitReviewStore.setState({ workspaces: {} });
}

function statusSnapshot() {
  return {
    workspaceId: "workspace-test",
    root: "/tmp/review",
    branch: "main",
    head: "0123456789abcdef0123456789abcdef01234567",
    entries: [],
    dirty: false,
    conflicted: false,
  };
}

function diffSnapshot(target: GitDiffTarget, sourceRevision?: string): GitDiffSnapshot {
  return {
    workspaceId: "workspace-test",
    target,
    files: [],
    hunkCount: 0,
    truncated: false,
    ...(sourceRevision ? { sourceRevision } : {}),
  };
}

function seedReviewState(diff: GitDiffSnapshot | null = null): void {
  useWorkspaceGitReviewStore.setState({
    workspaces: {
      "workspace-test": {
        status: statusSnapshot(),
        statusState: "ready",
        diff,
        diffState: diff ? "ready" : "idle",
        comments: [],
        refs: [],
        actionState: "idle",
        batchDelivery: null,
      },
    },
  });
}

beforeEach(() => {
  configureTransport();
});

describe("Git/review request lifecycle", () => {
  it("surfaces a correlated Git error instead of dropping it", () => {
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    const requestId = actions.refreshStatus();
    expect(requestId).toBeTruthy();
    expect(handleGitReviewMessage({
      type: "error",
      requestId: requestId!,
      code: "git_not_repository",
      message: "workspace is not a Git repository",
    })).toBe(true);
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.statusState).toBe("error");
    expect(state?.statusError).toContain("not a Git repository");
  });

  it.each([
    [{ kind: "workingTree" }, "rev-working-tree"],
    [{ kind: "staged" }, "rev-index"],
    [{ kind: "head" }, "rev-head"],
    [{ kind: "compare", base: "main", head: "feature" }, "rev-compare"],
  ] as Array<[GitDiffTarget, string]>)
    ("sends the exact $0 diff target and server source revision when creating a comment", (target, sourceRevision) => {
    seedReviewState(diffSnapshot(target, sourceRevision));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.createComment({ path: "src/main.ts", side: "new", start: 2, end: 2, body: "Please handle this case." });
    const sent = request("review.create");
    expect(sent.base).toEqual(target);
    expect(sent.baseRevision).toBe(sourceRevision);
    expect(sent.path).toBe("src/main.ts");
    expect(sent.range).toEqual({ start: 2, end: 2 });
  });

  it("surfaces a correlated review error and resolves the action path", () => {
    seedReviewState(diffSnapshot({ kind: "workingTree" }, "rev-working-tree"));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.createComment({ path: "src/main.ts", side: "new", start: 2, end: 2, body: "Please handle this case." });
    const sent = request("review.create");
    expect(handleGitReviewMessage({
      type: "error",
      requestId: sent.requestId as string,
      code: "review_anchor_conflict",
      message: "the reviewed source changed",
    })).toBe(true);
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.actionState).toBe("error");
    expect(state?.actionError).toContain("reviewed source changed");
    // The status and diff states are independent and remain intact.
    expect(state?.statusState).toBe("ready");
    expect(state?.diffState).toBe("ready");
  });

  it("keeps a correlated Git error out of the generic chat transcript", () => {
    seedReviewState(diffSnapshot({ kind: "workingTree" }, "rev-working-tree"));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.createComment({ path: "src/main.ts", side: "new", start: 2, end: 2, body: "Pane-only failure." });
    const sent = request("review.create");
    const before = usePerchStore.getState().messagesBySession["session-test"]?.length ?? 0;

    // The generic subscriber runs before the Git subscriber in the real
    // socket fan-out. It must recognize the owned opaque id and leave chat
    // history untouched; the Git subscriber still receives the same error.
    handleServerMessage({
      type: "error",
      requestId: sent.requestId as string,
      code: "review_anchor_conflict",
      message: "the reviewed source changed",
    });
    expect(usePerchStore.getState().messagesBySession["session-test"]?.length ?? 0).toBe(before);
    expect(handleGitReviewMessage({
      type: "error",
      requestId: sent.requestId as string,
      code: "review_anchor_conflict",
      message: "the reviewed source changed",
    })).toBe(true);
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"]?.actionError)
      .toContain("the reviewed source changed");
  });

  it("refuses to create a comment when the diff has no server source revision", () => {
    seedReviewState(diffSnapshot({ kind: "workingTree" }));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.createComment({ path: "src/main.ts", side: "new", start: 2, end: 2, body: "Please handle this case." });
    expect(FakeWebSocket.sent.some((raw) => (JSON.parse(raw) as Record<string, unknown>).type === "review.create")).toBe(false);
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.actionState).toBe("error");
    expect(state?.actionError).toContain("server-issued source revision");
  });

  it("keeps action state intact while status requests and replies update status", () => {
    seedReviewState(diffSnapshot({ kind: "workingTree" }, "rev-working-tree"));
    useWorkspaceGitReviewStore.setState((state) => ({
      workspaces: {
        ...state.workspaces,
        "workspace-test": {
          ...state.workspaces["workspace-test"],
          actionState: "error",
          actionError: "keep this action error",
        },
      },
    }));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    const requestId = actions.refreshStatus();
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"]?.actionError).toBe("keep this action error");
    expect(handleGitReviewMessage({
      type: "git.status.result",
      requestId: requestId!,
      workspaceId: "workspace-test",
      status: statusSnapshot(),
    })).toBe(true);
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.statusState).toBe("ready");
    expect(state?.actionState).toBe("error");
    expect(state?.actionError).toBe("keep this action error");
  });

  it("loads server-provided refs without clearing an existing action error", () => {
    seedReviewState();
    useWorkspaceGitReviewStore.setState((state) => ({
      workspaces: {
        ...state.workspaces,
        "workspace-test": {
          ...state.workspaces["workspace-test"],
          actionState: "error",
          actionError: "keep this action error",
        },
      },
    }));
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    const requestId = actions.listRefs();
    expect(handleGitReviewMessage({
      type: "git.refs.result",
      requestId: requestId!,
      workspaceId: "workspace-test",
      refs: [{ name: "main", target: "abc123", remote: false }],
    })).toBe(true);
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.refs).toEqual([{ name: "main", target: "abc123", remote: false }]);
    expect(state?.actionError).toBe("keep this action error");
  });

  it("settles a superseded preview and ignores its late reply", async () => {
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    const first = actions.commitPreview("first message");
    const firstRequest = request("git.commit.preview");
    const second = actions.commitPreview("second message");
    const secondRequest = request("git.commit.preview");

    await expect(first).resolves.toBeNull();
    expect(handleGitReviewMessage({
      type: "error",
      requestId: firstRequest.requestId as string,
      message: "late first response",
    })).toBe(true);
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"]?.actionError ?? "").not.toContain("late first");

    const receipt = {
      previewId: "preview-2",
      operation: "commit",
      workspaceId: "workspace-test",
      paths: ["src/main.ts"],
      status: statusSnapshot(),
      expiresAt: Date.now() + 60_000,
      message: "second message",
    };
    expect(handleGitReviewMessage({ type: "git.preview.result", requestId: secondRequest.requestId as string, preview: receipt })).toBe(true);
    await expect(second).resolves.toEqual(receipt);
  });

  it("clears pending requests on disconnect without replaying a mutation", async () => {
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    const pending = actions.commitPreview("do not replay");
    const sentBeforeDisconnect = FakeWebSocket.sent.length;
    handleGitReviewConnectionChange(false);

    await expect(pending).resolves.toBeNull();
    const state = useWorkspaceGitReviewStore.getState().workspaces["workspace-test"];
    expect(state?.actionState).toBe("error");
    expect(state?.actionError).toContain("lost its connection");
    expect(FakeWebSocket.sent).toHaveLength(sentBeforeDisconnect);

    // A reply from the old transport cannot mutate the recovered state.
    const stale = request("git.commit.preview");
    expect(handleGitReviewMessage({ type: "error", requestId: stale.requestId as string, message: "stale" })).toBe(false);
  });

  it("publishes provider acceptance without another send and ignores a delayed claimed reply", () => {
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.sendBatch("packet-test", "operation-test");
    const sent = request("review.batch.send");
    const outcome = {
      workspaceId: "workspace-test", packetId: "packet-test", sendOperationId: "operation-test",
      delivery: "delivered" as const, targetSessionId: "session-test",
    };
    handleGitReviewMessage({ type: "review.batch.delivery", hostId: "local", ...outcome });
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"].batchDelivery?.delivery).toBe("delivered");
    handleGitReviewMessage({ type: "review.batch.send.result", requestId: sent.requestId as string, ...outcome, delivery: "claimed" });
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"].batchDelivery?.delivery).toBe("delivered");
    expect(FakeWebSocket.sent).toHaveLength(1);
  });

  it("keeps delivery events scoped to the owning host and current packet", () => {
    const actions = useWorkspaceGitReviewStore.getState().getWorkspaceActions("workspace-test");
    actions.sendBatch("current-packet", "current-operation");
    const sent = request("review.batch.send");
    const outcome = {
      workspaceId: "workspace-test", packetId: "current-packet", sendOperationId: "current-operation",
      delivery: "delivered" as const,
    };
    handleGitReviewMessage({ type: "review.batch.delivery", ...outcome, hostId: "another-host" });
    handleGitReviewMessage({ type: "review.batch.delivery", ...outcome, hostId: "local", packetId: "old-packet" });
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"].batchDelivery?.delivery).toBe("queued");
    handleGitReviewMessage({ type: "review.batch.send.result", requestId: sent.requestId as string, ...outcome, delivery: "unconfirmed" });
    handleGitReviewMessage({ type: "review.batch.delivery", ...outcome, hostId: "local", delivery: "claimed" });
    expect(useWorkspaceGitReviewStore.getState().workspaces["workspace-test"].batchDelivery?.delivery).toBe("unconfirmed");
  });
});
