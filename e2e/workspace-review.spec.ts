/**
 * Real Git/review surface evidence. The fixture has three distinct file
 * snapshots so each diff target can be checked independently:
 *
 *   HEAD       -> HEAD_ANCHOR
 *   index      -> INDEX_ANCHOR
 *   worktree   -> WORKTREE_ANCHOR
 *
 * The browser captures the server's `git.diff.result` frames and then checks
 * that `review.create` carries the same target and path/side source revision
 * that produced the visible line. The rest of the flow exercises comment
 * create, edit, resolve/reopen, and delete through the rendered UI.
 */

import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const BASE_URL = "http://127.0.0.1:7799";
const RUN_ID = `${Date.now()}-${process.pid}`;
let FIXTURE_ROOT: string;
let REVIEW_FILE: string;
let PROJECT_NAME: string;
const RELATIVE_FILE = "src/main.txt";
const HEAD_TEXT = "HEAD_ANCHOR";
const INDEX_TEXT = "INDEX_ANCHOR";
const WORKTREE_TEXT = "WORKTREE_ANCHOR";

function git(args: string[]): void {
  execFileSync("git", args, {
    cwd: FIXTURE_ROOT,
    stdio: "pipe",
    input: "",
    timeout: 15000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "perch e2e",
      GIT_AUTHOR_EMAIL: "e2e@perch.test",
      GIT_COMMITTER_NAME: "perch e2e",
      GIT_COMMITTER_EMAIL: "e2e@perch.test",
    },
  });
}

function prepareFixture(): void {
  // A new repository needs a new durable workspace identity. Recreating one
  // path across tests leaves the previous test's immutable start ref behind.
  FIXTURE_ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `perch-e2e-review-${RUN_ID}-`)));
  REVIEW_FILE = path.join(FIXTURE_ROOT, "src", "main.txt");
  PROJECT_NAME = `Review UI ${RUN_ID} ${path.basename(FIXTURE_ROOT).slice(-6)}`;
  fs.mkdirSync(path.dirname(REVIEW_FILE), { recursive: true });
  fs.writeFileSync(REVIEW_FILE, `${HEAD_TEXT}\n`);
  git(["-c", "core.hooksPath=/dev/null", "init", "-q", "-b", "main"]);
  git(["-c", "core.hooksPath=/dev/null", "config", "user.name", "perch e2e"]);
  git(["-c", "core.hooksPath=/dev/null", "config", "user.email", "e2e@perch.test"]);
  git(["add", RELATIVE_FILE]);
  git(["commit", "-q", "-m", "initial"]);

  // Stage one version, then leave a different version in the worktree. This
  // makes `git diff` (workingTree), `git diff --cached` (staged), and
  // `git diff HEAD` visibly distinct without relying on an upstream remote.
  fs.writeFileSync(REVIEW_FILE, `${INDEX_TEXT}\n`);
  git(["add", RELATIVE_FILE]);
  fs.writeFileSync(REVIEW_FILE, `${WORKTREE_TEXT}\n`);
}

function removeFixture(): void {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
}

async function dismissOnboarding(page: Page): Promise<void> {
  const dismiss = page.getByTestId("onboarding-dismiss");
  if (await dismiss.count()) await dismiss.click();
}

async function openReview(page: Page, creation: "project" | "session" = "project"): Promise<string> {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await dismissOnboarding(page);
  await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });

  if (creation === "session") {
    // Exercise the session-create protocol without launching a paid CLI turn.
    // All comparison/comment/reload/mobile steps below still use the real UI.
    PROJECT_NAME = path.basename(FIXTURE_ROOT);
    await page.evaluate(async (cwd) => {
      const sessionId = await new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
        const timer = setTimeout(() => { socket.close(); reject(new Error("session.create timed out")); }, 15000);
        socket.onopen = () => socket.send(JSON.stringify({ type: "session.create", cwd }));
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === "session.created" || message.type === "error") {
            clearTimeout(timer);
            socket.close();
            if (message.type === "error") reject(new Error(message.message));
            else resolve(message.sessionId);
          }
        };
      });
      localStorage.setItem("perch.sessionId", sessionId);
    }, FIXTURE_ROOT);
    await page.reload({ waitUntil: "networkidle" });
  } else {
    const emptyAdd = page.getByTestId("workspace-empty-add");
    if (await emptyAdd.count()) await emptyAdd.click();
    else await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(FIXTURE_ROOT);
    await page.getByTestId("workspace-project-name").fill(PROJECT_NAME);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
  }

  const project = page.locator(".workspace-project").filter({ hasText: PROJECT_NAME });
  await expect(project).toBeVisible({ timeout: 15000 });
  const gitButton = project.locator('[data-testid^="workspace-git-"]');
  await expect(gitButton).toBeVisible({ timeout: 15000 });
  const workspaceId = (await gitButton.getAttribute("data-testid"))!.slice("workspace-git-".length);
  await gitButton.click();
  await expect(page.getByTestId("workspace-git-review")).toBeVisible({ timeout: 15000 });
  return workspaceId;
}

interface WireMessage {
  type?: string;
  requestId?: string;
  workspaceId?: string;
  target?: { kind?: string; base?: string; head?: string };
  files?: Array<{ hunks?: Array<{ lines?: Array<{ content?: string }> }> }>;
  sourceRevision?: string;
  sourceRevisions?: Record<string, string>;
  base?: unknown;
  baseRevision?: string;
  body?: string;
}

async function installWireCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = window as Window & { __perchSent?: WireMessage[]; __perchReceived?: WireMessage[] };
    state.__perchSent = [];
    state.__perchReceived = [];
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function captureSend(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      try {
        state.__perchSent?.push(JSON.parse(String(data)) as WireMessage);
      } catch {
        // Ignore non-JSON frames while preserving the real transport call.
      }
      return originalSend.call(this, data);
    };
    const originalAddEventListener = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function captureMessage(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      if (type !== "message" || !listener) return originalAddEventListener.call(this, type, listener, options);
      const wrapped = (event: MessageEvent) => {
        try {
          state.__perchReceived?.push(JSON.parse(String(event.data)) as WireMessage);
        } catch {
          // Ignore malformed/non-JSON frames while preserving app handling.
        }
        if (typeof listener === "function") listener.call(this, event);
        else listener.handleEvent(event);
      };
      return originalAddEventListener.call(this, type, wrapped, options);
    };
  });
}

async function latestDiff(page: Page, target: string): Promise<WireMessage> {
  const result = await page.evaluate((kind) => {
    const received = (window as Window & { __perchReceived?: WireMessage[] }).__perchReceived ?? [];
    return [...received].reverse().find((message) => message.type === "git.diff.result" && message.target?.kind === kind);
  }, target);
  if (!result) throw new Error(`No git.diff.result for ${target}`);
  return result;
}

function diffLine(page: Page, text: string, side: "old" | "new") {
  return page.locator(`[data-testid="git-diff-line"][data-side="${side}"]`).filter({ hasText: text }).first();
}

async function addComment(page: Page, text: string, side: "old" | "new", body: string): Promise<void> {
  const line = diffLine(page, text, side);
  await expect(line).toBeVisible({ timeout: 10000 });
  await line.getByTestId("git-comment-add").click();
  await expect(page.getByTestId("git-comment-composer")).toBeVisible({ timeout: 5000 });
  await page.getByTestId("git-comment-body").fill(body);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.locator(".workspace-git__comment").filter({ hasText: body })).toBeVisible({ timeout: 15000 });
}

async function expectDiffSurfaceUsable(page: Page, text: string): Promise<void> {
  const status = page.getByTestId("git-status");
  await expect(status).toBeVisible();
  const statusBox = await status.boundingBox();
  expect(statusBox?.width ?? 0).toBeGreaterThanOrEqual(180);
  expect(statusBox?.height ?? 0).toBeGreaterThan(40);
  const diff = page.getByTestId("git-diff");
  const diffBox = await diff.boundingBox();
  expect(diffBox?.width ?? 0).toBeGreaterThanOrEqual(200);
  const line = diffLine(page, text, "new");
  await expect(line).toBeVisible({ timeout: 10000 });
  await expect(line).toContainText(text);
  await expect(line.locator('[aria-label^="Old line "]')).toBeVisible();
  await expect(line.locator('[aria-label^="New line "]')).toBeVisible();
  await expect(line.getByTestId("git-comment-add")).toBeVisible();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const lineBox = await line.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right };
  });
  expect(lineBox.left).toBeGreaterThanOrEqual(0);
  expect(lineBox.right).toBeLessThanOrEqual(viewportWidth + 1);
}

async function latestCreate(page: Page, body: string): Promise<WireMessage> {
  const result = await page.evaluate((commentBody) => {
    const sent = (window as Window & { __perchSent?: WireMessage[] }).__perchSent ?? [];
    return [...sent].reverse().find((message) => message.type === "review.create" && message.body === commentBody);
  }, body);
  if (!result) throw new Error(`No review.create for ${body}`);
  return result;
}

test.describe("Workspace Git/review UI", () => {
  test("sends two reviewed anchors as one packet to the selected real agent", async ({ page }, testInfo) => {
    test.setTimeout(180000);
    prepareFixture();
    try {
      await installWireCapture(page);
      const workspaceId = await openReview(page);
      const project = page.locator(".workspace-project").filter({ hasText: PROJECT_NAME });
      await project.locator(".workspace-entry__button").click();
      await page.getByTestId("tab-new").click();
      await expect(page.locator(".chat__input textarea")).toBeVisible();
      await page.getByTestId("model-chip").click();
      await page.getByTestId("agent-option-claude").click();
      await page.getByTestId("model-option-claude-haiku-4-5").click();
      const readyMarker = `REVIEW_READY_${RUN_ID}`;
      await page.locator(".chat__input textarea").fill(`Reply with exactly ${readyMarker}. Do not use tools or modify files.`);
      await page.locator(".chat__send").click();
      await expect(page.locator(".message--assistant").filter({ hasText: readyMarker })).toBeVisible({ timeout: 90000 });
      await expect(page.locator(".chat__stop")).toHaveCount(0, { timeout: 30000 });
      const targetSessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      expect(targetSessionId).toBeTruthy();

      await project.getByTestId(`workspace-git-${workspaceId}`).click();
      await expect(page.getByTestId("git-diff")).toContainText(WORKTREE_TEXT, { timeout: 15000 });
      const firstNote = `Keep the worktree sentinel readable ${RUN_ID}`;
      const secondNote = `Preserve the index sentinel ${RUN_ID}`;
      await addComment(page, WORKTREE_TEXT, "new", firstNote);
      await addComment(page, INDEX_TEXT, "old", secondNote);
      const first = page.getByTestId("git-inline-comment").filter({ hasText: firstNote });
      await first.getByRole("button", { name: "Edit", exact: true }).click();
      await first.getByLabel("Edit review comment").fill(`${firstNote} after review`);
      await first.getByRole("button", { name: "Save edit", exact: true }).click();
      await expect(first).toContainText("after review");
      await first.getByRole("button", { name: "Resolve", exact: true }).click();
      await first.getByRole("button", { name: "Reopen", exact: true }).click();
      await expect(first).toContainText("unresolved");
      await page.getByLabel("Send to agent session").selectOption(targetSessionId!);
      const receipt = `REVIEW_RECEIVED_${RUN_ID}`;
      await page.getByLabel("Request", { exact: true }).fill(`Do not modify files or use tools. If this packet includes both the worktree and index notes, reply with exactly ${receipt}.`);
      await page.getByTestId("git-review-preview").click();
      const packet = page.getByTestId("git-review-packet");
      await expect(packet).toContainText("2 anchored notes", { timeout: 15000 });
      await expect(packet).toContainText(`${firstNote} after review`);
      await expect(packet).toContainText(secondNote);
      await page.getByTestId("git-review-send").click();
      await expect(page.getByTestId("git-review-delivery")).toHaveText("Agent received the review packet.", { timeout: 90000 });
      await expect(page.locator(".message--assistant").filter({ hasText: receipt })).toBeVisible({ timeout: 90000 });

      // An explicit retry uses the same frozen packet and operation. The real
      // provider must have accepted only one review turn, even across retries.
      await page.getByTestId("git-review-send").click();
      await expect(page.getByTestId("git-review-delivery")).toHaveText("Agent received the review packet.", { timeout: 15000 });
      await expect.poll(() => page.evaluate((sessionId) => {
        const messages = (window as Window & { __perchReceived?: Array<Record<string, unknown>> }).__perchReceived ?? [];
        return messages.filter((message) => message.type === "chat.done" && message.sessionId === sessionId).length;
      }, targetSessionId)).toBe(2);
      const evidence = await page.evaluate(() => {
        const state = window as Window & { __perchSent?: Array<Record<string, unknown>>; __perchReceived?: Array<Record<string, unknown>> };
        return {
          sends: state.__perchSent?.filter((message) => message.type === "review.batch.send"),
          done: state.__perchReceived?.filter((message) => message.type === "chat.done"),
        };
      });
      expect(evidence.sends).toHaveLength(2);
      expect(evidence.sends![0].sendOperationId).toBe(evidence.sends![1].sendOperationId);
      expect(evidence.done?.filter((message) => message.sessionId === targetSessionId)).toHaveLength(2);
      await expect(page.getByTestId("git-review-send")).toBeEnabled();
      await page.getByTestId("git-review-delivery").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("git-review-delivery")).toBeVisible();
      expect(fs.readFileSync(REVIEW_FILE, "utf8")).toBe(`${WORKTREE_TEXT}\n`);
      await page.screenshot({ path: testInfo.outputPath("review-packet-delivered.png"), fullPage: true });
      const shots = path.resolve(__dirname, "../.impeccable/review");
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, "review-packet-delivered.png"), fullPage: true });
    } finally {
      removeFixture();
    }
  });

  test("reads distinct Git sources and performs anchored comment CRUD", async ({ page }, testInfo) => {
    prepareFixture();
    try {
      await installWireCapture(page);
      const workspaceId = await openReview(page);
      const status = page.getByTestId("git-status");
      const diff = page.getByTestId("git-diff");

      await expect(status).toContainText("1 changed path", { timeout: 15000 });
      await expect(status).toContainText("staged + modified");
      await expect(diff).toContainText(WORKTREE_TEXT, { timeout: 15000 });
      await expect(diff).toContainText(INDEX_TEXT);
      await expectDiffSurfaceUsable(page, WORKTREE_TEXT);

      // Working-tree diff: the old side is the index and the new side is the
      // worktree. Capture the exact server revision for the visible new line.
      const workingDiff = await latestDiff(page, "workingTree");
      expect(workingDiff.files?.flatMap((file) => file.hunks ?? []).flatMap((hunk) => hunk.lines ?? []).some((line) => line.content === WORKTREE_TEXT)).toBe(true);
      const workingRevision = workingDiff.sourceRevisions?.[`${RELATIVE_FILE}:new`];
      expect(workingRevision).toMatch(/^[0-9a-f]{64}$/);

      const workingBody = `working anchor ${RUN_ID}`;
      await addComment(page, WORKTREE_TEXT, "new", workingBody);
      await expect(page.getByTestId("git-inline-comment").filter({ hasText: workingBody })).toHaveCount(1);
      const workingCreate = await latestCreate(page, workingBody);
      expect(workingCreate.workspaceId).toBe(workspaceId);
      expect(workingCreate.base).toEqual({ kind: "workingTree" });
      expect(workingCreate.baseRevision).toBe(workingRevision);

      // Staged diff: HEAD is the old side and the index is the new side.
      await page.getByTestId("git-diff-target").selectOption("staged");
      await expect(diff).toContainText(HEAD_TEXT, { timeout: 15000 });
      await expect(diff).toContainText(INDEX_TEXT);
      const stagedDiff = await latestDiff(page, "staged");
      const stagedRevision = stagedDiff.sourceRevisions?.[`${RELATIVE_FILE}:new`];
      expect(stagedRevision).toMatch(/^[0-9a-f]{64}$/);
      expect(stagedRevision).not.toBe(workingRevision);
      await expect(page.getByTestId("git-inline-comment").filter({ hasText: workingBody })).toHaveCount(0);
      await expect(page.getByTestId("git-review-list-comment").filter({ hasText: workingBody })).toBeVisible();

      const stagedBody = `index anchor ${RUN_ID}`;
      await addComment(page, INDEX_TEXT, "new", stagedBody);
      await expect(page.getByTestId("git-inline-comment").filter({ hasText: stagedBody })).toHaveCount(1);
      const stagedCreate = await latestCreate(page, stagedBody);
      expect(stagedCreate.base).toEqual({ kind: "staged" });
      expect(stagedCreate.baseRevision).toBe(stagedRevision);

      // HEAD diff includes both staged and worktree edits, proving the three
      // server-owned source snapshots remain separate in the UI.
      await page.getByTestId("git-diff-target").selectOption("head");
      await expect(diff).toContainText(HEAD_TEXT, { timeout: 15000 });
      await expect(diff).toContainText(WORKTREE_TEXT);
      const headDiff = await latestDiff(page, "head");
      const headRevision = headDiff.sourceRevisions?.[`${RELATIVE_FILE}:new`];
      expect(headRevision).toMatch(/^[0-9a-f]{64}$/);
      expect(headRevision).not.toBe(stagedRevision);
      await expect(page.getByTestId("git-inline-comment").filter({ hasText: workingBody })).toHaveCount(0);
      await expect(page.getByTestId("git-inline-comment").filter({ hasText: stagedBody })).toHaveCount(0);
      await expect(page.getByTestId("git-review-list-comment").filter({ hasText: workingBody })).toBeVisible();
      await expect(page.getByTestId("git-review-list-comment").filter({ hasText: stagedBody })).toBeVisible();

      const headBody = `head anchor ${RUN_ID}`;
      await addComment(page, WORKTREE_TEXT, "new", headBody);
      const headCreate = await latestCreate(page, headBody);
      expect(headCreate.base).toEqual({ kind: "head" });
      expect(headCreate.baseRevision).toBe(headRevision);

      // Exercise the durable comment lifecycle through the rendered thread.
      const thread = page.getByTestId("git-inline-comment").filter({ hasText: headBody });
      await thread.getByRole("button", { name: "Edit", exact: true }).click();
      await thread.getByLabel("Edit review comment").fill(`${headBody} edited`);
      await thread.getByRole("button", { name: "Save edit", exact: true }).click();
      await expect(thread).toContainText(`${headBody} edited`, { timeout: 15000 });

      await thread.getByRole("button", { name: "Resolve", exact: true }).click();
      await expect(thread).toContainText("resolved", { timeout: 15000 });
      await thread.getByRole("button", { name: "Reopen", exact: true }).click();
      await expect(thread).toContainText("unresolved", { timeout: 15000 });

      await thread.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(thread).toHaveCount(0, { timeout: 15000 });

      await page.screenshot({ path: testInfo.outputPath("workspace-review-crud.png"), fullPage: true });
    } finally {
      removeFixture();
    }
  });

  for (const creation of ["project", "session"] as const) {
    test(`${creation} workspace start keeps its creation ref across commits, reload and mobile review`, async ({ page }, testInfo) => {
      prepareFixture();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await installWireCapture(page);
        const workspaceId = await openReview(page, creation);
        const selector = page.getByTestId("git-diff-target");
        const diff = page.getByTestId("git-diff");
        await expect(selector.locator('option[value="workspaceStart"]')).toBeEnabled();
        await selector.selectOption("workspaceStart");
        await expect(diff).toContainText(HEAD_TEXT);
        await expect(diff).toContainText(WORKTREE_TEXT);
        const initial = await latestDiff(page, "compare");
        expect(initial.target?.base).toMatch(/^[0-9a-f]{40,64}$/);
        expect(initial.target?.head).toBeUndefined();

        // Advance the real HEAD while preserving the unstaged edit. The start
        // comparison must remain pinned to registration, not the latest commit.
        git(["commit", "-q", "-m", "advance head"]);
        fs.writeFileSync(path.join(FIXTURE_ROOT, "new.txt"), "UNTRACKED_AFTER_START\n");
        if (creation === "session") {
          // A second session after HEAD moved must reuse the original workspace
          // and baseline rather than recording this later commit as its start.
          expect(await openReview(page, creation)).toBe(workspaceId);
        }
        await page.getByTestId("git-refresh").click();
        await selector.selectOption("head");
        await expect(diff).toContainText(INDEX_TEXT);
        await expect(diff).not.toContainText(HEAD_TEXT);
        await selector.selectOption("workspaceStart");
        await expect(diff).toContainText(HEAD_TEXT);
        await expect(diff).toContainText("UNTRACKED_AFTER_START");
        expect((await latestDiff(page, "compare")).target).toEqual(initial.target);
        const body = "Keep the workspace-start anchor";
        await addComment(page, WORKTREE_TEXT, "new", body);
        expect((await latestCreate(page, body)).base).toEqual(initial.target);
        await page.screenshot({ path: testInfo.outputPath("workspace-start-desktop.png"), fullPage: true });

        await page.reload({ waitUntil: "networkidle" });
        const project = page.locator(".workspace-project").filter({ hasText: PROJECT_NAME });
        await project.getByTestId(`workspace-git-${workspaceId}`).click();
        await selector.selectOption("workspaceStart");
        await expect(diff).toContainText(HEAD_TEXT);
        expect((await latestDiff(page, "compare")).target).toEqual(initial.target);
        await expect(page.getByTestId("git-inline-comment").filter({ hasText: body })).toBeVisible();

        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByTestId("mobile-switch").click();
        await page.getByTestId("mobile-switcher").getByTestId(`workspace-git-${workspaceId}`).click();
        await selector.selectOption("workspaceStart");
        await expect(diff).toContainText(HEAD_TEXT);
        await expect(diff).toContainText(WORKTREE_TEXT);
        await expectDiffSurfaceUsable(page, WORKTREE_TEXT);
        expect((await latestDiff(page, "compare")).target).toEqual(initial.target);
        await page.screenshot({ path: testInfo.outputPath("workspace-start-mobile.png"), fullPage: true });
        expect(errors).toEqual([]);
      } finally {
        removeFixture();
      }
    });

  }

  test("mobile Git pane renders a populated diff and reachable comment action", async ({ page }, testInfo) => {
    prepareFixture();
    try {
      await installWireCapture(page);
      // Register through the desktop workspace form, then use the real mobile
      // switcher to open the same workspace's Git pane.
      await page.setViewportSize({ width: 1280, height: 800 });
      const workspaceId = await openReview(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("mobile-switch").click();
      const switcher = page.getByTestId("mobile-switcher");
      const project = switcher.locator(".workspace-project").filter({ hasText: PROJECT_NAME });
      await expect(project).toBeVisible({ timeout: 10000 });
      await project.getByTestId(`workspace-git-${workspaceId}`).click();
      await expect(switcher).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId("mobile-active-pane-gitReview")).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
      await expect(page.locator(".dockview-theme-perch")).toHaveCount(0);
      await expect(page.getByTestId("git-status")).toContainText("1 changed path", { timeout: 15000 });
      await expect(page.getByTestId("git-diff")).toContainText(WORKTREE_TEXT, { timeout: 15000 });
      await expectDiffSurfaceUsable(page, WORKTREE_TEXT);

      const body = `mobile anchor ${RUN_ID}`;
      await addComment(page, WORKTREE_TEXT, "new", body);
      await expect(page.locator(".workspace-git__comment").filter({ hasText: body })).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: testInfo.outputPath("workspace-review-mobile-comment.png"), fullPage: true });
    } finally {
      removeFixture();
    }
  });
});
