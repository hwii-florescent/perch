// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceGitReview, type WorkspaceGitReviewProps } from "../stock-ui/review/review";
import { chooseDropdown } from "./ui/selectTesting";
import { resetResourceStateForTest } from "../resourceState";
import type {
  GitDiffSnapshot,
  GitStatusSnapshot,
  ReviewBatchPreview,
  ReviewComment,
  WorkspaceGitReviewActions,
} from "./gitReviewModels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const status: GitStatusSnapshot = {
  workspaceId: "workspace-test",
  root: "/tmp/review",
  branch: "main",
  head: "head-revision",
  entries: [{ path: "src/main.ts", index: "modified", worktree: "modified", staged: false, unstaged: true }],
  dirty: true,
  conflicted: false,
};

const diff: GitDiffSnapshot = {
  workspaceId: "workspace-test",
  target: { kind: "workingTree" },
  sourceRevision: "source-revision",
  files: [{
    oldPath: "src/main.ts",
    newPath: "src/main.ts",
    status: "modified",
    isBinary: false,
    hunks: [{
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      header: "@@ -1 +1 @@",
      lines: [{ kind: "addition", content: "new anchor", newLine: 1 }],
    }],
  }],
  hunkCount: 1,
  truncated: false,
};

const receipt = {
  previewId: "preview-1",
  operation: "discard",
  workspaceId: "workspace-test",
  paths: ["src/main.ts"],
  status,
  expiresAt: Date.now() + 60_000,
};

const comment: ReviewComment = {
  id: "comment-1",
  workspaceId: "workspace-test",
  path: "src/main.ts",
  base: { kind: "workingTree" },
  baseRevision: "source-revision",
  side: "new",
  range: { start: 1, end: 1 },
  body: "Please keep this anchor stable.",
  anchor: {
    path: "src/main.ts",
    side: "new",
    base: { kind: "workingTree" },
    baseRevision: "source-revision",
    range: { start: 1, end: 1 },
    before: [],
    selected: ["new anchor"],
    after: [],
  },
  status: "unresolved",
  anchorConfidence: "exact",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
};

const packet: ReviewBatchPreview = {
  packetId: "packet-1",
  idempotencyKey: "packet-key",
  sendOperationId: "send-1",
  workspaceId: "workspace-test",
  targetSessionId: "session-target",
  currentRevision: "source-revision",
  comments: [{
    commentId: comment.id,
    version: comment.version,
    path: comment.path,
    side: comment.side,
    range: comment.range,
    body: comment.body,
    snippetBefore: [],
    snippet: ["new anchor"],
    snippetAfter: [],
    anchorConfidence: "exact",
  }],
  markdown: "# Review packet\n",
};

function actions(overrides: Partial<WorkspaceGitReviewActions> = {}): WorkspaceGitReviewActions {
  return {
    refreshStatus: vi.fn(() => "status-request"),
    selectAgentSession: vi.fn(),
    loadDiff: vi.fn(() => "diff-request"),
    stage: vi.fn(),
    unstage: vi.fn(),
    discardPreview: vi.fn(async () => receipt),
    discard: vi.fn(),
    commitPreview: vi.fn(async () => null),
    commit: vi.fn(),
    listComments: vi.fn(() => "comments-request"),
    listRefs: vi.fn(() => "refs-request"),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    resolveComment: vi.fn(),
    deleteComment: vi.fn(),
    previewBatch: vi.fn(async () => packet),
    sendBatch: vi.fn(async () => null),
    ...overrides,
  };
}

function props(actionSet: WorkspaceGitReviewActions): WorkspaceGitReviewProps {
  return {
    workspaceId: "workspace-test",
    workspaceName: "Review",
    status,
    statusState: "ready",
    diff,
    diffState: "ready",
    comments: [],
    sessions: [{ id: "session-target", title: "Target session", agent: "claude" }],
    currentRevision: "source-revision",
    actions: actionSet,
  };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(nextProps: WorkspaceGitReviewProps): Promise<void> {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
  }
  if (!root) root = createRoot(host);
  await act(async () => {
    root?.render(<WorkspaceGitReview {...nextProps} />);
  });
}

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  host?.remove();
  host = null;
  document.body.innerHTML = "";
  resetResourceStateForTest();
});

/** Replaces the view, as a code reload, a swap to a clone, a released hidden copy or the phone/desktop breakpoint do. */
async function replaceView(nextProps: WorkspaceGitReviewProps): Promise<void> {
  await act(async () => root?.unmount());
  root = null;
  await render(nextProps);
}

describe("review state the host keeps for the workspace", () => {
  it("keeps the commit message, the comment draft and a prepared packet when the view is replaced", async () => {
    const actionSet = actions();
    await render({ ...props(actionSet), comments: [comment] });
    const commit = document.querySelector<HTMLInputElement>('input[placeholder="Describe the change"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(commit, "Fix the anchor");
      commit.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      (document.querySelector('[data-testid="git-review-preview"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="git-review-packet"]')).not.toBeNull();
    await replaceView({ ...props(actionSet), comments: [comment] });
    expect(document.querySelector<HTMLInputElement>('input[placeholder="Describe the change"]')!.value).toBe("Fix the anchor");
    expect(document.querySelector('[data-testid="git-review-packet"]')?.textContent).toContain(packet.packetId);
    expect(actionSet.previewBatch).toHaveBeenCalledTimes(1);
  });

  it("does not send a packet twice when the view is replaced while it is in flight", async () => {
    let settle!: (value: null) => void;
    const actionSet = actions({ sendBatch: vi.fn(() => new Promise<null>((resolve) => { settle = resolve; })) });
    await render({ ...props(actionSet), comments: [comment] });
    await act(async () => {
      (document.querySelector('[data-testid="git-review-preview"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => (document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement).click());
    await replaceView({ ...props(actionSet), comments: [comment] });
    const send = document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await act(async () => send.click());
    expect(actionSet.sendBatch).toHaveBeenCalledTimes(1);
    // The answer reaches the replaced view: the shared state, not the view that sent it, settles.
    await act(async () => { settle(null); });
    expect((document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement).disabled).toBe(false);
    expect(actionSet.sendBatch).toHaveBeenCalledWith(packet.packetId, packet.sendOperationId);
  });
});

describe("WorkspaceGitReview interaction truthfulness", () => {
  it("selects one file while keeping horizontal scrolling at the diff surface", async () => {
    const actionSet = actions();
    const twoFileDiff: GitDiffSnapshot = {
      ...diff,
      files: [
        ...diff.files,
        { ...diff.files[0]!, oldPath: "src/other.ts", newPath: "src/other.ts" },
      ],
    };
    await render({ ...props(actionSet), diff: twoFileDiff });

    const picker = document.querySelector('[data-testid="git-diff-file-select"]');
    expect(picker).not.toBeNull();
    if (!picker) throw new Error("missing narrow diff file picker");
    await chooseDropdown(picker, "src/other.ts");

    const editor = document.querySelector('[data-testid="git-diff"]');
    expect(editor?.className).toContain("overflow-auto");
    expect(editor?.querySelectorAll("article")).toHaveLength(1);
    expect(editor?.textContent).toContain("src/other.ts");
    expect(editor?.textContent).not.toContain("src/main.ts");
    const line = editor?.querySelector<HTMLElement>('[data-testid="git-diff-line"]');
    expect(line?.className).toContain("min-w-max");
    expect(line?.querySelector("code")?.className).toContain("overflow-visible");
    expect(line?.querySelector("code")?.className).not.toContain("overflow-x-auto");
  });

  it("folds the changes list away and clicking the open file again shows every file", async () => {
    const actionSet = actions();
    await render(props(actionSet));

    const list = document.querySelector('[data-testid="git-status"] [data-open]');
    const fold = document.querySelector<HTMLButtonElement>('[data-testid="git-status"] button[aria-expanded]');
    expect(list?.getAttribute("data-open")).toBe("true");
    await act(async () => fold?.click());
    expect(list?.getAttribute("data-open")).toBe("false");
    expect(fold?.getAttribute("aria-expanded")).toBe("false");

    const file = document.querySelector<HTMLButtonElement>('[data-testid="git-status"] [role="listitem"] button:not([aria-expanded])');
    await act(async () => file?.click());
    expect(actionSet.loadDiff).toHaveBeenLastCalledWith(expect.anything(), "src/main.ts", expect.anything());
    await act(async () => file?.click());
    expect(actionSet.loadDiff).toHaveBeenLastCalledWith(expect.anything(), undefined, expect.anything());
  });

  it("focuses the destructive confirmation and closes it with Escape", async () => {
    const actionSet = actions();
    await render(props(actionSet));

    const checkbox = document.querySelector('input[aria-label="Select src/main.ts"]') as HTMLInputElement;
    await act(async () => checkbox.click());
    await act(async () => {
      (document.querySelector('[data-testid="git-discard-preview"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const confirm = document.querySelector('[data-testid="git-confirm-action"]') as HTMLButtonElement | null;
    expect(confirm).not.toBeNull();
    if (!confirm) throw new Error("missing confirm action");
    expect(document.activeElement).toBe(confirm);

    const cancel = document.querySelector('[data-testid="git-cancel-action"]') as HTMLButtonElement;
    cancel.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(confirm);
    confirm.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, shiftKey: true }));
    });
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows pending send until the server delivery result arrives", async () => {
    let settle!: (value: null) => void;
    const pending = new Promise<null>((resolve) => { settle = resolve; });
    const actionSet = actions({ sendBatch: vi.fn(() => pending) });
    await render({ ...props(actionSet), comments: [comment] });

    await act(async () => {
      (document.querySelector('[data-testid="git-review-preview"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(document.querySelector('[data-testid="git-review-packet"]')).not.toBeNull();

    await act(async () => {
      (document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement).click();
    });
    expect(document.body.textContent).toContain("Sending review packet");
    expect(document.body.textContent).not.toContain("Review send is");
    expect(actionSet.sendBatch).toHaveBeenCalledWith(packet.packetId, packet.sendOperationId);
    expect((document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement).disabled).toBe(true);

    await render({
      ...props(actionSet),
      comments: [comment],
      batchDelivery: {
        packetId: packet.packetId,
        sendOperationId: packet.sendOperationId,
        delivery: "queued",
        targetSessionId: packet.targetSessionId,
      },
    });
    expect(document.body.textContent).toContain("Waiting for the agent to receive the review packet…");
    expect(document.body.textContent).not.toContain("Sending review packet");
    await act(async () => { settle(null); });
    expect((document.querySelector('[data-testid="git-review-send"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps comments from other diff targets out of inline placement", async () => {
    const actionSet = actions();
    const stagedComment: ReviewComment = {
      ...comment,
      id: "comment-staged",
      body: "This belongs to the staged source.",
      base: { kind: "staged" },
      baseRevision: "staged-revision",
      anchor: {
        ...comment.anchor,
        base: { kind: "staged" },
        baseRevision: "staged-revision",
      },
    };
    await render({ ...props(actionSet), comments: [comment, stagedComment] });

    expect(document.querySelectorAll('[data-testid="git-inline-comment"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="git-inline-comment"]')?.textContent).toContain(comment.body);
    const list = document.querySelector('[data-testid="git-review-list"]');
    expect(list?.textContent).toContain(stagedComment.body);
    expect(list?.textContent).toContain("Different target");
    expect(list?.querySelectorAll('[data-testid="git-review-list-comment"]')).toHaveLength(1);
  });

  it("keeps stale comments in the review list with their state", async () => {
    const actionSet = actions();
    const staleComment: ReviewComment = {
      ...comment,
      id: "comment-stale",
      status: "stale",
      anchorConfidence: "none",
      body: "This needs a deliberate reanchor.",
    };
    await render({ ...props(actionSet), comments: [staleComment] });

    expect(document.querySelectorAll('[data-testid="git-inline-comment"]')).toHaveLength(0);
    const list = document.querySelector('[data-testid="git-review-list"]');
    expect(list?.textContent).toContain(staleComment.body);
    expect(list?.textContent).toContain("stale anchor");
    expect(list?.querySelector('[data-testid="git-review-list-comment"]')).not.toBeNull();
  });
});
