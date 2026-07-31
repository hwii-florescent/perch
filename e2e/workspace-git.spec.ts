/**
 * workspace-git.spec.ts — Playwright e2e suite for Phase 6's git
 * branch/ahead-behind sidebar decoration.
 *
 * See `crates/perch-core/src/status.rs` (`get_branch`/`get_ahead_behind`) and
 * the background poll task in `crates/perch-core/src/server.rs`
 * (`spawn_git_poll_task`) for the server side; `Sidebar.tsx`'s
 * `ProjectGitStatus` for the client rendering (`data-testid="workspace-git-{hostId}"`).
 *
 * Uses real `/tmp` fixture git repos (never touches the perch repo itself)
 * for deterministic branch/ahead/behind state, following the "prefer a /tmp
 * fixture repo for determinism" guidance for GB2.
 */

import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BASE_URL = "http://127.0.0.1:7799";

const GB1_REPO = path.join(os.tmpdir(), "perch-e2e-git-fixture-b1");
const GB2_REPO = path.join(os.tmpdir(), "perch-e2e-git-fixture-b2");
const GB2_ORIGIN = path.join(os.tmpdir(), "perch-e2e-git-fixture-b2-origin.git");
const GB2_OTHER_CLONE = path.join(os.tmpdir(), "perch-e2e-git-fixture-b2-other");

function sh(cmd: string, cwd: string): void {
  execSync(cmd, {
    cwd,
    stdio: "pipe",
    // `input: ""` writes zero bytes to the child's stdin and then closes it
    // (immediate EOF). Without this, execSync's piped stdin stays open
    // indefinitely, and on this machine every git push/clone/fetch — even to
    // a throwaway /tmp bare repo — runs corp's global githooks-middleware
    // (`core.hookspath=/opt/corp/etc/hooks`, applies machine-wide, not just
    // to real corp repos). That hook chain reads from stdin and blocks
    // forever waiting for EOF that never arrives, hanging the whole
    // Playwright worker (a synchronous execSync call blocks the Node event
    // loop, so Playwright's own test/hook timeout can never preempt it).
    // `timeout` is a second, defense-in-depth bound so a genuinely stuck
    // command fails the fixture setup loudly instead of hanging the suite.
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

function rmrf(p: string): void {
  fs.rmSync(p, { recursive: true, force: true });
}

/** Builds a plain single-commit repo with no upstream (branch-only, no
 * ahead/behind glyphs expected). */
function setupGb1Fixture(): void {
  rmrf(GB1_REPO);
  fs.mkdirSync(GB1_REPO, { recursive: true });
  sh("git -c init.defaultBranch=main init -q", GB1_REPO);
  fs.writeFileSync(path.join(GB1_REPO, "README.md"), "gb1 fixture\n");
  sh("git add README.md", GB1_REPO);
  sh('git commit -q -m "initial"', GB1_REPO);
}

/** Builds a repo with an upstream that is both ahead and behind by one
 * commit each:
 *   1. repo + bare origin, pushed (0 ahead, 0 behind).
 *   2. a second clone pushes a commit to origin (repo is now 1 behind, once fetched).
 *   3. `git fetch` updates the remote-tracking ref (no merge) → 1 behind.
 *   4. a new local-only commit in repo → 1 ahead.
 * Final: `git rev-list --left-right --count @{u}...HEAD` → "1 1" (behind ahead). */
function setupGb2Fixture(): void {
  rmrf(GB2_REPO);
  rmrf(GB2_ORIGIN);
  rmrf(GB2_OTHER_CLONE);

  fs.mkdirSync(GB2_ORIGIN, { recursive: true });
  sh("git init -q --bare -b main", GB2_ORIGIN);

  fs.mkdirSync(GB2_REPO, { recursive: true });
  sh("git -c init.defaultBranch=main init -q", GB2_REPO);
  fs.writeFileSync(path.join(GB2_REPO, "README.md"), "gb2 fixture\n");
  sh("git add README.md", GB2_REPO);
  sh('git commit -q -m "initial"', GB2_REPO);
  sh(`git remote add origin ${GB2_ORIGIN}`, GB2_REPO);
  sh("git push -q -u origin main", GB2_REPO);

  // Someone else pushes a commit to origin — repo will be "behind" once fetched.
  sh(`git clone -q ${GB2_ORIGIN} ${GB2_OTHER_CLONE}`, os.tmpdir());
  fs.writeFileSync(path.join(GB2_OTHER_CLONE, "other.txt"), "from another clone\n");
  sh("git add other.txt", GB2_OTHER_CLONE);
  sh('git commit -q -m "remote-only commit"', GB2_OTHER_CLONE);
  sh("git push -q origin main", GB2_OTHER_CLONE);

  // Fetch (not merge) so origin/main advances but local HEAD does not — behind=1.
  sh("git fetch -q origin", GB2_REPO);

  // A local-only commit that's never pushed — ahead=1.
  fs.writeFileSync(path.join(GB2_REPO, "local-only.txt"), "not pushed\n");
  sh("git add local-only.txt", GB2_REPO);
  sh('git commit -q -m "local-only commit"', GB2_REPO);
}

async function waitForSidebar(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Creates a new local session with a custom cwd via the "+" picker's free-text
 * path input (see `NewSessionPopover` in Sidebar.tsx).
 *
 * A freshly created session lives only in memory until its first message —
 * server.rs's `ChatSend` handler lazily inserts the DB row and only then
 * calls `notify_session_updated` ("Fix 3", see comment at the `SessionCreate`
 * handler: "Do NOT broadcast session.updated yet"). Until that happens the
 * session is invisible to `list_sessions()` and thus never renders as a
 * sidebar project group — so a git-status assertion against its project
 * header would hang forever. Send a lightweight seed message (mirroring
 * sidebar.spec.ts's "Test 2" pattern) to trigger the lazy insert; we don't
 * wait for the agent's reply, only for the DB-insert side effect. */
async function createSessionWithCwd(page: Page, cwd: string): Promise<void> {
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  // Wave 1: the picker now opens in "Browse" mode by default — switch to the
  // "Type path" fallback to enter an arbitrary cwd directly (same as before).
  await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
  const input = page.locator('[data-testid="project-path-input"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(cwd);
  await page.locator('[data-testid="dir-browser-use"]').click();
  await expect(input).not.toBeVisible({ timeout: 3000 });

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill("workspace-git e2e seed " + Date.now());
  await page.locator(".chat__send").click();
}

/** Locates the sidebar project header for a given cwd (matched by the
 * project-name `title` attribute, which Sidebar.tsx sets to the raw cwd). */
function projectHeaderFor(page: Page, cwd: string) {
  return page.locator(".sidebar__project-header", {
    has: page.locator(`.sidebar__project-name[title="${cwd}"]`),
  });
}

test.describe("Workspace git status", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    setupGb1Fixture();
    setupGb2Fixture();
  });

  test.afterAll(() => {
    rmrf(GB1_REPO);
    rmrf(GB2_REPO);
    rmrf(GB2_ORIGIN);
    rmrf(GB2_OTHER_CLONE);
  });

  // ---------------------------------------------------------------------------
  // GB1 — sidebar shows the branch name for a project whose cwd is a git repo.
  // ---------------------------------------------------------------------------
  test("GB1. Sidebar shows branch for a git cwd", async ({ page }) => {
    await waitForSidebar(page);
    await createSessionWithCwd(page, GB1_REPO);

    const header = projectHeaderFor(page, GB1_REPO);
    await expect(header).toBeVisible({ timeout: 10000 });

    const gitStatus = header.locator('[data-testid="workspace-git-local"]');
    // The 5s background poll needs at least one tick after the session (and
    // thus its cwd) becomes known to the server.
    await expect(gitStatus).toBeVisible({ timeout: 15000 });
    await expect(gitStatus).toContainText("main");

    // No upstream configured — no ahead/behind glyphs.
    await expect(gitStatus.locator(".sidebar__project-ahead")).toHaveCount(0);
    await expect(gitStatus.locator(".sidebar__project-behind")).toHaveCount(0);

    await page.screenshot({ path: "artifacts/workspace-git-gb1-branch.png" });
  });

  // ---------------------------------------------------------------------------
  // GB2 — ahead/behind glyphs appear once the repo has diverged from its
  // upstream (fixture pre-built with exactly 1 ahead + 1 behind).
  // ---------------------------------------------------------------------------
  test("GB2. Ahead/behind glyphs appear after scripted commits", async ({ page }) => {
    await waitForSidebar(page);
    await createSessionWithCwd(page, GB2_REPO);

    const header = projectHeaderFor(page, GB2_REPO);
    await expect(header).toBeVisible({ timeout: 10000 });

    const gitStatus = header.locator('[data-testid="workspace-git-local"]');
    await expect(gitStatus).toBeVisible({ timeout: 15000 });
    await expect(gitStatus).toContainText("main");

    const ahead = gitStatus.locator(".sidebar__project-ahead");
    const behind = gitStatus.locator(".sidebar__project-behind");
    await expect(ahead).toBeVisible({ timeout: 15000 });
    await expect(behind).toBeVisible({ timeout: 15000 });
    await expect(ahead).toContainText("↑1");
    await expect(behind).toContainText("↓1");

    const aheadColor = await ahead.evaluate((el) => getComputedStyle(el).color);
    const behindColor = await behind.evaluate((el) => getComputedStyle(el).color);
    expect(aheadColor).not.toBe(behindColor);

    await page.screenshot({ path: "artifacts/workspace-git-gb2-ahead-behind.png" });
  });
});
