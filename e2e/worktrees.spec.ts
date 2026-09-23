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

const BASE_URL = process.env.PERCH_E2E_BASE ?? "http://127.0.0.1:7799";

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

/** Register `cwd` as a workspace project (idempotent).
 *
 * Needed before any worktree assertion: the branch glyph hangs off a project
 * card, and a project row is only minted lazily — by a session that has actually
 * produced a message or CLI activity. Registering the folder explicitly through
 * the rail's own "+ Add" flow is the deterministic way in, and it needs no agent
 * turn. Without it, a first run against a clean DB finds no menu at all. */
async function registerProject(page: Page, cwd: string): Promise<void> {
  const rail = page.getByTestId("workspace-overview");
  await expect(rail).toBeVisible({ timeout: 15000 });
  const card = rail.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
  if ((await card.count()) > 0) return;
  await page.getByTestId("workspace-add-project").click();
  const pathInput = page.getByTestId("workspace-project-path");
  await expect(pathInput).toBeVisible({ timeout: 5000 });
  await pathInput.fill(cwd);
  await rail.locator('button[type="submit"]').click();
  await expect(card).toHaveCount(1, { timeout: 20000 });
}

/** Create a local session whose cwd is `cwd`, via the picker's "Type path"
 * fallback, and wait for it to become a visible sidebar project group.
 *
 * This used to send a seed chat message to force server.rs's lazy DB insert.
 * That no longer works and is no longer needed: every "New session" launcher
 * now passes an explicit `mode: "cli"` (Sidebar.tsx's picker `onSelect`), and a
 * CLI-owned session renders the native view (`native-cli-chat`), never the
 * Hosted `.chat__input textarea` the old seed typed into. It is also redundant —
 * `cli_activity` alone satisfies db.rs's `SESSION_VISIBILITY_FILTER`, so the
 * group appears as soon as the CLI starts. Dropping it also drops a real agent
 * turn from this spec.
 */
async function createSessionForCwd(page: Page, cwd: string): Promise<void> {
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
  const input = page.locator('[data-testid="project-path-input"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(cwd);
  await page.locator('[data-testid="dir-browser-use"]').click();
  await expect(input).not.toBeVisible({ timeout: 3000 });
  // The status bar carries the resolved session cwd — proof the create landed
  // on this checkout before any worktree assertion runs.
  await expect(page.locator(".status-bar")).toContainText(cwd, { timeout: 20000 });
}

/** Open the fixture project's worktree popover and return it. The branch-glyph
 * button only renders once `workspace.git` has reported a branch for the cwd
 * (the 5s background poll), hence the generous timeout. */
async function openWorktreeMenu(page: Page): Promise<Locator> {
  await registerProject(page, FIXTURE);
  const btn = page.locator(`[data-testid="worktree-menu-local-${FIXTURE}"]`).first();
  await expect(btn).toBeVisible({ timeout: 20000 });
  const popover = page.locator(`[data-testid="worktree-popover-local-${FIXTURE}"]`);
  // The glyph toggles, so clicking it while the popover is already open closes
  // it. Callers open the menu repeatedly (create, then open each checkout) —
  // make the helper idempotent rather than making every caller remember.
  if (!(await popover.isVisible())) await btn.click();
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
 * listed. On a host with background creates (`worktree.job`) the popover
 * closes on submit, so it is reopened to read the listing. */
async function createWorktree(popover: Locator, branch: string): Promise<string> {
  await popover.locator('[data-testid="worktree-new"]').click();
  const branchInput = popover.locator('[data-testid="worktree-branch-input"]');
  await expect(branchInput).toBeVisible({ timeout: 5000 });
  await branchInput.fill(branch);
  // Hosts with the start-from picker drop the "new branch" checkbox (an
  // existing branch is checked out anyway); older hosts default it on.
  const newBranch = popover.locator('[data-testid="worktree-new-branch"]');
  if (await newBranch.count()) await expect(newBranch).toBeChecked();
  // The custom-path field mirrors the default location for the typed branch.
  await expect(popover.locator('[data-testid="worktree-path-input"]')).toHaveValue(
    path.join(WORKTREES_ROOT, branch),
  );
  await popover.locator('[data-testid="worktree-create-submit"]').click();

  const page = popover.page();
  const entry = entryForBranch(popover, branch);
  await expect(async () => {
    if (!(await popover.isVisible())) await openWorktreeMenu(page);
    await expect(entry).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30000 });
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
    await registerProject(page, FIXTURE);
    await createSessionForCwd(page, FIXTURE);

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
    // `worktree.delete` hosts delete the checkout and its (merged) branch.
    await expect(page.locator('[data-testid="confirm-accept"]')).toHaveText("Delete");
    await page.locator('[data-testid="confirm-accept"]').click();

    await expect(entry).toHaveCount(0, { timeout: 30000 });
    expect(fs.existsSync(worktreePath)).toBe(false);
    expect(execSync("git branch", { cwd: FIXTURE, input: "" }).toString()).not.toContain("wt-feature");
    // Its workspace row is archived out of the sidebar too.
    const projectCard = page.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
    await expect(projectCard.locator(".workspace-entry").filter({ hasText: "wt-feature" })).toHaveCount(0, { timeout: 10000 });

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
    await expect(accept).toHaveText("Delete", { timeout: 5000 });
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

  // -------------------------------------------------------------------------
  // WT6 — SPEC.md V-02: two worktrees from one project, both open, with
  // separate paths, branches, sessions, tabs and file changes.
  //
  // This is also the acceptance for the registration work in
  // `server/workspace.rs::register_worktree_listing`: both checkouts must land
  // as workspaces of the SAME project. Before that landed, `worktree.create`
  // never registered the checkout at all, and creating a session inside one
  // minted a second standalone project at the checkout path.
  // -------------------------------------------------------------------------
  test("WT6. Two worktrees stay separate in paths, branches, sessions, tabs and files", async ({ page }) => {
    await freshPage(page);

    const popover = await openWorktreeMenu(page);
    const alphaPath = await createWorktree(popover, "wt-alpha");
    const betaPath = await createWorktree(popover, "wt-beta");

    // Separate paths and branches.
    expect(alphaPath).not.toBe(betaPath);
    expect(alphaPath).toBe(path.join(WORKTREES_ROOT, "wt-alpha"));
    expect(betaPath).toBe(path.join(WORKTREES_ROOT, "wt-beta"));
    expect(execSync("git rev-parse --abbrev-ref HEAD", { cwd: alphaPath }).toString().trim()).toBe("wt-alpha");
    expect(execSync("git rev-parse --abbrev-ref HEAD", { cwd: betaPath }).toString().trim()).toBe("wt-beta");

    // Both checkouts registered under exactly one project for this repo.
    const projectCard = page
      .locator('[data-testid^="workspace-project-"]')
      .filter({ hasText: FIXTURE_NAME });
    await expect(projectCard).toHaveCount(1, { timeout: 20000 });
    for (const branch of ["wt-alpha", "wt-beta"]) {
      await expect(
        projectCard.locator(".workspace-entry").filter({ hasText: branch }),
      ).toHaveCount(1, { timeout: 20000 });
    }

    // Separate sessions: open each checkout and keep its session id.
    async function openFrom(branch: string, expectedPath: string): Promise<string> {
      const menu = await openWorktreeMenu(page);
      const entry = entryForBranch(menu, branch);
      await expect(entry).toBeVisible({ timeout: 10000 });
      await entry.locator('[data-testid^="worktree-open-"]').click();
      await expect(menu).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator(".status-item--cwd")).toHaveText(expectedPath, { timeout: 20000 });
      const id = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      expect(id).toBeTruthy();
      return id as string;
    }
    const alphaSession = await openFrom("wt-alpha", alphaPath);
    const betaSession = await openFrom("wt-beta", betaPath);
    expect(alphaSession).not.toBe(betaSession);

    // Separate tabs. The tab bar is scoped to the active workspace, so the two
    // checkouts must never share a tab strip: standing in wt-beta, only beta's
    // tab exists, and navigating to wt-alpha's workspace row swaps the strip
    // and the resolved cwd together.
    const alphaTab = page.locator(`[data-testid="tab-${alphaSession}"]`);
    const betaTab = page.locator(`[data-testid="tab-${betaSession}"]`);
    await expect(betaTab).toBeVisible({ timeout: 10000 });
    await expect(alphaTab).toHaveCount(0);

    await projectCard
      .locator(".workspace-entry")
      .filter({ hasText: "wt-alpha" })
      .locator("button")
      .first()
      .click();
    await expect(page.locator(".status-item--cwd")).toHaveText(alphaPath, { timeout: 20000 });
    await expect(alphaTab).toBeVisible({ timeout: 15000 });
    await expect(betaTab).toHaveCount(0);

    // Separate file changes: a write in one checkout is invisible in the other,
    // and only its own row goes dirty.
    fs.writeFileSync(path.join(alphaPath, "sentinel.txt"), "alpha only\n");
    expect(fs.existsSync(path.join(betaPath, "sentinel.txt"))).toBe(false);
    expect(fs.readFileSync(path.join(FIXTURE, "README.md"), "utf8")).toBe("worktree fixture\n");

    await page.keyboard.press("Escape");
    const after = await openWorktreeMenu(page);
    await expect(
      entryForBranch(after, "wt-alpha").locator('[data-testid^="worktree-dirty-"]'),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      entryForBranch(after, "wt-beta").locator('[data-testid^="worktree-dirty-"]'),
    ).toHaveCount(0);

    await page.screenshot({ path: "artifacts/worktrees-wt6-two-worktrees.png" });
  });

  // -------------------------------------------------------------------------
  // WT7 — Orca's background create: the form closes at once, the project
  // shows a progress row with Cancel, and a failed create offers Retry.
  // -------------------------------------------------------------------------
  test("WT7. Background create shows progress, cancels cleanly, retries a failure", async ({ page }) => {
    await freshPage(page);
    const hook = path.join(FIXTURE, ".git", "hooks", "post-checkout");
    fs.writeFileSync(hook, "#!/bin/sh\nsleep 8\n", { mode: 0o755 });
    try {
      const popover = await openWorktreeMenu(page);
      await popover.locator('[data-testid="worktree-new"]').click();
      await popover.locator('[data-testid="worktree-branch-input"]').fill("wt-slow");
      await popover.locator('[data-testid="worktree-create-submit"]').click();
      await expect(popover).not.toBeVisible({ timeout: 5000 });

      const row = page.getByTestId("worktree-job-wt-slow");
      await expect(row).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId("worktree-job-phase-wt-slow")).toHaveText("Checking out…");
      await page.screenshot({ path: "artifacts/worktrees-wt7-progress.png" });
      await page.getByTestId("worktree-job-cancel-wt-slow").click();
      await expect(row).toHaveCount(0, { timeout: 5000 });
      expect(fs.existsSync(path.join(WORKTREES_ROOT, "wt-slow"))).toBe(false);
      expect(execSync("git branch", { cwd: FIXTURE, input: "" }).toString()).not.toContain("wt-slow");
    } finally {
      fs.rmSync(hook, { force: true });
    }

    // A non-empty directory at the target makes git refuse: the row fails,
    // keeps the user's file, and Retry succeeds once the path is free.
    const blocked = path.join(WORKTREES_ROOT, "wt-retry");
    fs.mkdirSync(blocked, { recursive: true });
    fs.writeFileSync(path.join(blocked, "mine.txt"), "x");
    const popover = await openWorktreeMenu(page);
    await popover.locator('[data-testid="worktree-new"]').click();
    await popover.locator('[data-testid="worktree-branch-input"]').fill("wt-retry");
    await popover.locator('[data-testid="worktree-create-submit"]').click();
    await expect(page.getByTestId("worktree-job-retry-wt-retry")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("worktree-job-error-wt-retry")).toContainText("already exists");
    expect(fs.existsSync(path.join(blocked, "mine.txt"))).toBe(true);
    await page.screenshot({ path: "artifacts/worktrees-wt7-failed.png" });
    fs.rmSync(path.join(blocked, "mine.txt"));
    await page.getByTestId("worktree-job-retry-wt-retry").click();
    await expect(page.getByTestId("worktree-job-wt-retry")).toHaveCount(0, { timeout: 20000 });
    const projectCard = page.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
    await expect(projectCard.locator(".workspace-entry").filter({ hasText: "wt-retry" })).toHaveCount(1, { timeout: 20000 });
    expect(fs.existsSync(path.join(blocked, "README.md"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // WT8 — task name → derived branch, start-from a local branch, and the
  // `-2` suffix when the derived name is taken.
  // -------------------------------------------------------------------------
  test("WT8. Task name derives the branch; start-from picks the base", async ({ page }) => {
    sh("git checkout -q -b wt-base", FIXTURE);
    sh('git commit -q --allow-empty -m "base work"', FIXTURE);
    const baseHead = execSync("git rev-parse HEAD", { cwd: FIXTURE, input: "" }).toString().trim();
    sh("git checkout -q main", FIXTURE);
    sh("git branch stack-on-base", FIXTURE); // taken → the derived name gets -2

    await freshPage(page);
    const popover = await openWorktreeMenu(page);
    await popover.locator('[data-testid="worktree-new"]').click();
    await popover.locator('[data-testid="worktree-name-input"]').fill("Stack on base!");
    await expect(popover.locator('[data-testid="worktree-branch-input"]')).toHaveAttribute(
      "placeholder", "branch: stack-on-base");
    await expect(popover.locator('datalist option[value="wt-base"]')).toHaveCount(1);
    await popover.locator('[data-testid="worktree-start-input"]').fill("wt-base");
    await page.screenshot({ path: "artifacts/worktrees-wt8-form.png" });
    await popover.locator('[data-testid="worktree-create-submit"]').click();

    const created = path.join(WORKTREES_ROOT, "stack-on-base-2");
    await expect.poll(() => fs.existsSync(path.join(created, ".git")), { timeout: 20000 }).toBe(true);
    await expect(page.locator('[data-testid^="worktree-job-"]')).toHaveCount(0, { timeout: 20000 });
    const projectCard = page.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
    await expect(projectCard.locator(".workspace-entry").filter({ hasText: "stack-on-base-2" })).toHaveCount(1, { timeout: 20000 });
    const git = (args: string) => execSync(`git ${args}`, { cwd: created, input: "" }).toString().trim();
    expect(git("branch --show-current")).toBe("stack-on-base-2");
    expect(git("rev-parse HEAD")).toBe(baseHead);
    expect(git("config branch.stack-on-base-2.base")).toBe("refs/heads/wt-base");
  });

  // -------------------------------------------------------------------------
  // WT9 — deleting a worktree whose branch has unmerged work keeps the
  // branch and reviews its commits before a force delete.
  // -------------------------------------------------------------------------
  test("WT9. Delete reviews a branch with unmerged commits", async ({ page }) => {
    await freshPage(page);
    const popover = await openWorktreeMenu(page);
    const wt = await createWorktree(popover, "wt-precious");
    sh('git commit -q --allow-empty -m "precious work"', wt);

    const menu = await openWorktreeMenu(page);
    await entryForBranch(menu, "wt-precious").locator('[data-testid^="worktree-remove-"]').click();
    await page.locator('[data-testid="confirm-accept"]').click();

    const review = page.locator(".confirm-dialog__message");
    await expect(review).toContainText("branch wt-precious was kept", { timeout: 20000 });
    await expect(review).toContainText("precious work");
    expect(fs.existsSync(wt)).toBe(false);
    expect(execSync("git branch", { cwd: FIXTURE, input: "" }).toString()).toContain("wt-precious");
    await page.screenshot({ path: "artifacts/worktrees-wt9-review.png" });
    await expect(page.locator('[data-testid="confirm-accept"]')).toHaveText("Delete branch");
    await page.locator('[data-testid="confirm-accept"]').click();
    await expect.poll(() => execSync("git branch", { cwd: FIXTURE, input: "" }).toString(), { timeout: 10000 })
      .not.toContain("wt-precious");
  });

  // -------------------------------------------------------------------------
  // WT10 — pin, rename and parent nesting in the sidebar.
  // -------------------------------------------------------------------------
  test("WT10. Pin, rename and nest worktree workspaces", async ({ page }) => {
    await freshPage(page);
    const projectCard = page.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
    const row = (text: string) => projectCard.locator(".workspace-entry").filter({ hasText: text });
    await createWorktree(await openWorktreeMenu(page), "wt-parent");
    await expect(row("wt-parent")).toHaveCount(1, { timeout: 20000 });
    const parentId = ((await row("wt-parent").first().getAttribute("data-testid")) ?? "").replace("workspace-entry-", "");

    // Create a child nested under wt-parent from the create form.
    const menu = await openWorktreeMenu(page);
    await menu.locator('[data-testid="worktree-new"]').click();
    await menu.locator('[data-testid="worktree-branch-input"]').fill("wt-child");
    await menu.locator('[data-testid="worktree-parent-select"]').selectOption(parentId);
    await menu.locator('[data-testid="worktree-create-submit"]').click();
    const nested = page.getByTestId(`workspace-children-${parentId}`);
    await expect(nested.locator(".workspace-entry").filter({ hasText: "wt-child" })).toHaveCount(1, { timeout: 20000 });

    // Pin moves wt-parent to the top of the project.
    await row("wt-parent").first().hover();
    await page.getByTestId(`workspace-pin-${parentId}`).click();
    const first = projectCard.locator(".workspace-project__workspaces > .workspace-entry").first();
    await expect(first).toContainText("pinned", { timeout: 10000 });
    await expect(first).toContainText("wt-parent");

    // Double-click renames the display name (the branch is untouched).
    await page.getByTestId(`workspace-entry-${parentId}`).locator("strong").first().dblclick();
    const input = page.getByTestId(`workspace-rename-${parentId}`);
    await input.fill("Parent task");
    await input.press("Enter");
    await expect(page.getByTestId(`workspace-entry-${parentId}`).locator("strong").first()).toHaveText("Parent task", { timeout: 10000 });
    await page.screenshot({ path: "artifacts/worktrees-wt10-nesting.png" });
  });

  // -------------------------------------------------------------------------
  // WT11 — a worktree made with plain `git worktree add` is discovered without
  // the menu open, starts hidden, can be shown and hidden again, keeps its row
  // across `git worktree move`, and is archived once `git worktree remove`
  // drops it.
  // -------------------------------------------------------------------------
  test("WT11. External worktrees start hidden, show, hide and clean up", async ({ page }) => {
    await freshPage(page);
    // Unique per run: a reused DB remembers a path it saw before (and its visibility).
    const external = `${FIXTURE}-external-${Date.now().toString(36)}`;
    fs.rmSync(external, { recursive: true, force: true });
    sh(`git worktree add -b wt-external '${external}'`, FIXTURE);
    const projectCard = page.locator('[data-testid^="workspace-project-"]').filter({ hasText: FIXTURE_NAME });
    const row = projectCard.locator(".workspace-entry").filter({ hasText: "wt-external" });
    const card = projectCard.locator('[data-testid^="workspace-hidden-"]');

    await expect(card).toHaveText("1 hidden worktree", { timeout: 20000 });
    await expect(row).toHaveCount(0);
    await card.click();
    await page.screenshot({ path: "artifacts/worktrees-wt11-hidden.png" });
    await projectCard.locator('[data-testid^="workspace-show-"]').click();
    await expect(row).toHaveCount(1, { timeout: 10000 });
    await expect(card).toHaveCount(0);

    const id = ((await row.getAttribute("data-testid")) ?? "").replace("workspace-entry-", "");
    await row.hover();
    await page.getByTestId(`workspace-hide-${id}`).click();
    await expect(row).toHaveCount(0, { timeout: 10000 });
    await expect(card).toHaveText("1 hidden worktree");
    await card.click();
    await page.getByTestId(`workspace-show-${id}`).click();
    await expect(row).toHaveCount(1, { timeout: 10000 });

    // `git worktree move` keeps the same row, now at the new path.
    const moved = `${external}-moved`;
    fs.rmSync(moved, { recursive: true, force: true });
    sh(`git worktree move '${external}' '${moved}'`, FIXTURE);
    await expect(row.locator("button").first()).toHaveAttribute("title", moved, { timeout: 20000 });
    await expect(row).toHaveCount(1);
    await expect(card).toHaveCount(0);

    sh(`git worktree remove '${moved}'`, FIXTURE);
    await expect(row).toHaveCount(0, { timeout: 20000 });
    await expect(card).toHaveCount(0);
  });
});
