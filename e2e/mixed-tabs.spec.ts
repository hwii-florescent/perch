/**
 * PER-7: a terminal, a file and the review are peers in one ordered tab strip.
 * Run with `npx playwright test mixed-tabs`.
 *
 * The strip's DOM order is the order the Nth-tab and next/previous chords
 * follow, and it survives a reload.
 */
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { firstWorkspaceId, openWorkspaceTool } from "./workspaceTools";
import { startChat } from "./projects";

const RUN_ID = `${Date.now()}-${process.pid}`;
const ROOT = path.join(os.tmpdir(), `perch-e2e-mixed-tabs-${RUN_ID}`);
const NAME = `Mixed ${RUN_ID}`;

function prepareFixture(): void {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, "README.md"), "mixed tabs fixture\n");
  // `input: ""` + timeout: githooks middleware on this machine reads stdin.
  const run = (args: string) => execSync(`git ${args}`, {
    cwd: ROOT, stdio: "pipe", input: "", timeout: 15000,
    env: { ...process.env, GIT_AUTHOR_NAME: "perch e2e", GIT_AUTHOR_EMAIL: "e2e@perch.test", GIT_COMMITTER_NAME: "perch e2e", GIT_COMMITTER_EMAIL: "e2e@perch.test" },
  });
  run("-c init.defaultBranch=main init -q");
  run("add -A");
  run('commit -q -m "initial"');
}

/** data-testids of the strip's tabs, left to right. */
const strip = (page: Page) => page.locator('[data-testid="tab-bar"] .tab-bar__tab').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
const activeTab = (page: Page) => page.locator('[data-testid="tab-bar"] .tab-bar__tab--active').getAttribute("data-testid");

/** The leader chord: Ctrl+Space, then `key`. */
async function chord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

test("a terminal, a file and the review share one ordered strip", async ({ page }) => {
  prepareFixture();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const sessionId = await startChat(page, "terminal", ROOT);
    const project = page.locator(".workspace-project").filter({ hasText: NAME.split(" ")[0] });
    const workspaceId = await firstWorkspaceId(project);

    const terminalTab = `tab-${sessionId}`;
    const fileTab = "file-tab-README.md";
    const reviewTab = `review-tab-${workspaceId}`;

    // A file opens as a tab after the terminal; the review does too, with no agent started.
    await openWorkspaceTool(page, workspaceId, "files");
    await page.getByTestId("workspace-file-entry-README.md").click();
    await expect(page.getByTestId(fileTab)).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-tools-gitReview").click();
    await page.getByTestId("workspace-tools-open-review").click();
    await expect(page.getByTestId(reviewTab)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("workspace-git-review").last()).toBeVisible({ timeout: 20000 });
    expect(await strip(page)).toEqual([terminalTab, fileTab, reviewTab]);
    expect(await activeTab(page)).toBe(reviewTab);

    // Dragging the review onto the terminal reorders across types.
    await page.getByTestId(reviewTab).dragTo(page.getByTestId(terminalTab));
    await expect.poll(() => strip(page)).toEqual([reviewTab, terminalTab, fileTab]);

    // The chords follow the strip's order, not creation order.
    await chord(page, "1");
    expect(await activeTab(page)).toBe(reviewTab);
    await chord(page, "n");
    await expect.poll(() => activeTab(page)).toBe(terminalTab);
    await chord(page, "n");
    await expect.poll(() => activeTab(page)).toBe(fileTab);
    await chord(page, "n");
    await expect.poll(() => activeTab(page)).toBe(reviewTab);
    await chord(page, "p");
    await expect.poll(() => activeTab(page)).toBe(fileTab);

    // Order and open resources survive a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => strip(page), { timeout: 20000 }).toEqual([reviewTab, terminalTab, fileTab]);

    // Closing a resource leaves the others in place.
    await page.getByTestId(`review-tab-close-${workspaceId}`).click();
    await expect.poll(() => strip(page)).toEqual([terminalTab, fileTab]);
  } finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});
