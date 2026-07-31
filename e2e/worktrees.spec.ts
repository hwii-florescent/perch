/**
 * worktrees.spec.ts — Wave 2 e2e: git worktree management (ported from herdr).
 *
 * Server: `crates/perch-core/src/worktree.rs` (git plumbing, dirty guard,
 * `~/.perch/worktrees/<repo>/<slug>` default location) + the `worktree.list` /
 * `worktree.create` / `worktree.remove` arms in `server.rs`.
 * Client: `packages/web/src/components/WorktreeMenu.tsx`, mounted from the
 * sidebar project header via `ProjectWorktrees` in `Sidebar.tsx`.
 *
 *   WT1 — the menu lists the repo's primary checkout
 *   WT2 — create a worktree on a new branch → listed + on disk under the
 *         default `~/.perch/worktrees/<repo>/<branch-slug>` location
 *   WT3 — "Open" creates a session whose cwd is that worktree
 *   WT4 — removing a clean worktree drops it from the list and from disk
 *   WT5 — removing a *dirty* worktree is refused by the guard; the
 *         force-flavored confirmation then succeeds
 *
 * Every git operation targets the throwaway fixture repo under the OS temp
 * dir — never the perch repo, never `reference/herdr`. The only thing written
 * outside the temp dir is `~/.perch/worktrees/<fixture-name>/`, which is the
 * feature's own default checkout root and is wiped in `afterAll`.
 *
 * Headless only (no --headed / --ui), serial, one real agent turn (the WT1
 * seed message that forces the session's lazy DB insert — see the same idiom
 * in sessions.spec.ts / workspace-git.spec.ts).
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BASE_URL = "http://127.0.0.1:7799";

const FIXTURE_NAME = "perch-e2e-worktree-fixture";
/** Resolved (symlink-free) fixture path — assigned in `beforeAll`. macOS's
 * temp dir lives under `/var` → `/private/var`, and `git worktree list`
 * always reports canonical paths, so the session cwd must be canonical too or
 * the sidebar group and the git listing would disagree. */
let FIXTURE = path.join(os.tmpdir(), FIXTURE_NAME);
/** Where `worktree.create` puts checkouts by default for this repo. */
const WORKTREES_ROOT = path.join(os.homedir(), ".perch", "worktrees", FIXTURE_NAME);

function sh(cmd: string, cwd: string): void {
  execSync(cmd, {
    cwd,
    stdio: "pipe",
    // Close stdin immediately and bound the call — see the long explanation in
    // workspace-git.spec.ts: this machine has a global githooks-middleware
    // that reads stdin and would otherwise hang the synchronous execSync (and
    // with it the whole Playwright worker).
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

function setupFixture(): void {
  rmrf(FIXTURE);
  rmrf(WORKTREES_ROOT);
  fs.mkdirSync(FIXTURE, { recursive: true });
  sh("git -c init.defaultBranch=main init -q", FIXTURE);
  fs.writeFileSync(path.join(FIXTURE, "README.md"), "worktree fixture\n");
  sh("git add README.md", FIXTURE);
  sh('git commit -q -m "initial"', FIXTURE);
  FIXTURE = fs.realpathSync(FIXTURE);
}

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Create a local session with `cwd` via the picker's "Type path" fallback,
 * then send a seed message so server.rs's lazy DB insert runs and the session
 * (and therefore its sidebar project group) becomes visible. We never wait for
 * the agent's reply — only for the insert side effect. */
async function createSeededSession(page: Page, cwd: string): Promise<void> {
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
  const input = page.locator('[data-testid="project-path-input"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(cwd);
  await page.locator('[data-testid="dir-browser-use"]').click();
  await expect(input).not.toBeVisible({ timeout: 3000 });

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill("worktree e2e seed " + Date.now());
  await page.locator(".chat__send").click();
}

/** Open the fixture project's worktree popover and return it. The branch-glyph
 * button only renders once `workspace.git` has reported a branch for the cwd
 * (the 5s background poll), hence the generous timeout. */
async function openWorktreeMenu(page: Page): Promise<Locator> {
  const btn = page.locator(`[data-testid="worktree-menu-local-${FIXTURE}"]`);
  await expect(btn).toBeVisible({ timeout: 20000 });
  await btn.click();
  const popover = page.locator(`[data-testid="worktree-popover-local-${FIXTURE}"]`);
  await expect(popover).toBeVisible({ timeout: 5000 });
  return popover;
}

/** The list row for a branch. Matched on rendered branch text rather than a
 * path-derived testid so the assertions never depend on how git canonicalizes
 * the checkout path. */
function entryForBranch(popover: Locator, branch: string): Locator {
  return popover
    .locator(".worktree-menu__entry")
    .filter({ has: popover.page().locator(".worktree-menu__entry-branch", { hasText: branch }) });
}

async function pathOfEntry(entry: Locator): Promise<string> {
  return ((await entry.locator(".worktree-menu__entry-path").textContent()) ?? "").trim();
}

/** Fill the "New worktree…" form and submit; resolves once the new branch is
 * listed. */
async function createWorktree(popover: Locator, branch: string): Promise<string> {
  await popover.locator('[data-testid="worktree-new"]').click();
  const branchInput = popover.locator('[data-testid="worktree-branch-input"]');
  await expect(branchInput).toBeVisible({ timeout: 5000 });
  await branchInput.fill(branch);
  // "new branch" is checked by default — assert rather than set it.
  await expect(popover.locator('[data-testid="worktree-new-branch"]')).toBeChecked();
  // The custom-path field mirrors the default location for the typed branch.
  await expect(popover.locator('[data-testid="worktree-path-input"]')).toHaveValue(
    path.join(WORKTREES_ROOT, branch),
  );
  await popover.locator('[data-testid="worktree-create-submit"]').click();

  const entry = entryForBranch(popover, branch);
  await expect(entry).toBeVisible({ timeout: 30000 });
  return pathOfEntry(entry);
}

test.describe("Git worktrees", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    setupFixture();
  });

  test.afterAll(() => {
    // Best-effort: unregister any surviving worktrees before deleting their
    // directories so the fixture repo never leaves stale admin entries behind
    // (it is deleted immediately afterwards anyway).
    try {
      sh("git worktree prune", FIXTURE);
    } catch {
      /* fixture may already be gone */
    }
    rmrf(WORKTREES_ROOT);
    rmrf(FIXTURE);
  });

  // -------------------------------------------------------------------------
  // WT1 — the menu lists the repo's primary checkout.
  // -------------------------------------------------------------------------
  test("WT1. Worktree menu lists the primary checkout", async ({ page }) => {
    await freshPage(page);
    await createSeededSession(page, FIXTURE);

    const popover = await openWorktreeMenu(page);
    const mainEntry = entryForBranch(popover, "main");
    await expect(mainEntry).toBeVisible({ timeout: 10000 });
    await expect(mainEntry.locator('[data-testid^="worktree-primary-"]')).toBeVisible();
    expect(await pathOfEntry(mainEntry)).toBe(FIXTURE);
    // The primary checkout is never removable (git refuses anyway).
    await expect(mainEntry.locator('[data-testid^="worktree-remove-"]')).toHaveCount(0);

    await page.screenshot({ path: "artifacts/worktrees-wt1-list.png" });
  });

  // -------------------------------------------------------------------------
  // WT2 — create a worktree on a new branch.
  // -------------------------------------------------------------------------
  test("WT2. Creating a new-branch worktree lists it and writes it to disk", async ({ page }) => {
    await freshPage(page);
    const popover = await openWorktreeMenu(page);

    const created = await createWorktree(popover, "wt-feature");
    expect(created).toBe(path.join(WORKTREES_ROOT, "wt-feature"));
    expect(fs.existsSync(path.join(created, "README.md"))).toBe(true);

    // The branch really is checked out there (not just a directory copy).
    const branch = execSync("git branch --show-current", {
      cwd: created,
      encoding: "utf8",
      input: "",
      timeout: 15000,
    }).trim();
    expect(branch).toBe("wt-feature");

    await page.screenshot({ path: "artifacts/worktrees-wt2-created.png" });
  });

  // -------------------------------------------------------------------------
  // WT3 — "Open" starts a session in the worktree.
  // -------------------------------------------------------------------------
  test("WT3. Open creates a session whose cwd is the worktree", async ({ page }) => {
    await freshPage(page);
    const popover = await openWorktreeMenu(page);

    const entry = entryForBranch(popover, "wt-feature");
    await expect(entry).toBeVisible({ timeout: 10000 });
    const worktreePath = await pathOfEntry(entry);

    await entry.locator('[data-testid^="worktree-open-"]').click();
    await expect(popover).not.toBeVisible({ timeout: 5000 });

    // session.create replies with a status.update carrying the resolved cwd.
    await expect(page.locator(".status-item--cwd")).toHaveText(worktreePath, { timeout: 15000 });

    await page.screenshot({ path: "artifacts/worktrees-wt3-open.png" });
  });

  // -------------------------------------------------------------------------
  // WT4 — remove a clean worktree.
  // -------------------------------------------------------------------------
  test("WT4. Removing a clean worktree drops it from the list and disk", async ({ page }) => {
    await freshPage(page);
    const popover = await openWorktreeMenu(page);

    const entry = entryForBranch(popover, "wt-feature");
    await expect(entry).toBeVisible({ timeout: 10000 });
    const worktreePath = await pathOfEntry(entry);
    await expect(entry.locator('[data-testid^="worktree-dirty-"]')).toHaveCount(0);

    await entry.locator('[data-testid^="worktree-remove-"]').click();
    const dialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="confirm-accept"]')).toHaveText("Remove");
    await page.locator('[data-testid="confirm-accept"]').click();

    await expect(entry).toHaveCount(0, { timeout: 30000 });
    expect(fs.existsSync(worktreePath)).toBe(false);

    await page.screenshot({ path: "artifacts/worktrees-wt4-removed.png" });
  });

  // -------------------------------------------------------------------------
  // WT5 — the dirty guard refuses, then force succeeds (herdr's
  // `force_confirmation` escalation).
  // -------------------------------------------------------------------------
  test("WT5. A dirty worktree is guarded, then force-removed", async ({ page }) => {
    await freshPage(page);
    const popover = await openWorktreeMenu(page);

    const worktreePath = await createWorktree(popover, "wt-dirty");
    // Make it dirty with an untracked file (git status --untracked-files=all).
    fs.writeFileSync(path.join(worktreePath, "scratch.txt"), "uncommitted\n");

    // Re-list so the row shows the dirty marker.
    await page.keyboard.press("Escape");
    const popover2 = await openWorktreeMenu(page);
    const entry = entryForBranch(popover2, "wt-dirty");
    await expect(entry).toBeVisible({ timeout: 10000 });
    await expect(entry.locator('[data-testid^="worktree-dirty-"]')).toBeVisible({ timeout: 15000 });

    // First attempt: plain remove → refused by the guard, which re-opens the
    // confirmation in its force flavor carrying the guard message.
    await entry.locator('[data-testid^="worktree-remove-"]').click();
    const accept = page.locator('[data-testid="confirm-accept"]');
    await expect(accept).toHaveText("Remove", { timeout: 5000 });
    await accept.click();

    await expect(accept).toHaveText("Force remove", { timeout: 20000 });
    const guardText = await page.locator(".confirm-dialog__message").textContent();
    expect(guardText ?? "").toContain("modified or untracked files");
    expect(fs.existsSync(worktreePath)).toBe(true);

    await page.screenshot({ path: "artifacts/worktrees-wt5-guard.png" });

    // Second attempt: forced → succeeds.
    await accept.click();
    await expect(entry).toHaveCount(0, { timeout: 30000 });
    expect(fs.existsSync(worktreePath)).toBe(false);

    await page.screenshot({ path: "artifacts/worktrees-wt5-forced.png" });
  });
});
