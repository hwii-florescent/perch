/**
 * workspace-git.spec.ts — a git workspace in the sidebar is labelled with
 * its branch. Uses a `/tmp` fixture repo, never the perch repo itself.
 */
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";
const GB1_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "perch-e2e-git-"));

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

async function waitForSidebar(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

test.describe("Workspace git status", () => {
  test.beforeAll(setupGb1Fixture);
  test.afterAll(() => rmrf(GB1_REPO));

  test("GB1. a git workspace shows its branch", async ({ page }) => {
    await waitForSidebar(page);
    const id = await startChat(page, "terminal", GB1_REPO);
    const workspace = page.locator(".workspace-entry", { has: page.getByTestId(`workspace-session-${id}`) });
    await expect(workspace).toContainText("main", { timeout: 15000 });
  });
});
