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
// One folder per test: the core remembers a project by path, so a deleted and
// recreated folder would reuse the first test's stale project.
let ROOT = "";
let fixtures = 0;

function prepareFixture(): void {
  ROOT = path.join(os.tmpdir(), `perch-e2e-mixed-tabs-${RUN_ID}-${++fixtures}`);
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

/** A project with a terminal session, README.md and the review open as tabs. */
async function openAll(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const sessionId = await startChat(page, "terminal", ROOT);
  const project = page.locator(".workspace-project").filter({ hasText: path.basename(ROOT) });
  const workspaceId = await firstWorkspaceId(project);
  const terminalTab = `tab-${sessionId}`;
  const fileTab = "file-tab-README.md";
  const reviewTab = `review-tab-${workspaceId}`;
  await openWorkspaceTool(page, workspaceId, "files");
  await page.getByTestId("workspace-file-entry-README.md").click();
  await expect(page.getByTestId(fileTab)).toBeVisible({ timeout: 15000 });
  await page.getByTestId("workspace-tools-gitReview").click();
  await page.getByTestId("workspace-tools-open-review").click();
  await expect(page.getByTestId(reviewTab)).toBeVisible({ timeout: 15000 });
  return { sessionId, workspaceId, terminalTab, fileTab, reviewTab };
}

test("a terminal, a file and the review share one ordered strip", async ({ page }) => {
  prepareFixture();
  try {
    const { workspaceId, terminalTab, fileTab, reviewTab } = await openAll(page);

    // A file and the review open as tabs after the terminal, with no agent started.
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

const box = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;

test("tabs split side by side under one strip", async ({ page }, testInfo) => {
  prepareFixture();
  try {
    const { sessionId, terminalTab, fileTab, reviewTab } = await openAll(page);
    const session = "split-pane-session";
    const readme = "split-pane-file-README.md";
    const canvas = page.getByTestId("split-canvas");
    await expect(canvas).toHaveAttribute("data-split", "0");

    // Split the file beside the terminal from the file tab's menu.
    await page.getByTestId(fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${sessionId}`).click();
    await expect(canvas).toHaveAttribute("data-split", "2");

    // The strip is still one row of the same tabs; only the content splits.
    expect(await strip(page)).toEqual([terminalTab, fileTab, reviewTab]);
    await expect(page.getByTestId("tab-bar")).toHaveCount(1);
    // Members share a rule under their labels; the unrelated review tab has none.
    await expect(page.getByTestId(terminalTab)).toHaveCSS("box-shadow", /inset/);
    await expect(page.getByTestId(fileTab)).toHaveCSS("box-shadow", /inset/);
    await expect(page.getByTestId(reviewTab)).toHaveCSS("box-shadow", "none");
    const terminal = await box(page, session);
    const file = await box(page, readme);
    expect(terminal.x).toBeLessThan(file.x);
    expect(Math.abs(terminal.width - file.width)).toBeLessThan(4);
    expect(terminal.y).toBe(file.y);

    // Add the review as a third pane, then drag the first divider.
    await page.getByTestId(reviewTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${sessionId}`).click();
    await expect(canvas).toHaveAttribute("data-split", "3");
    const divider = await box(page, "split-divider-0");
    const before = (await box(page, session)).width;
    await page.mouse.move(divider.x + 2, divider.y + 40);
    await page.mouse.down();
    await page.mouse.move(divider.x + 122, divider.y + 40, { steps: 6 });
    await page.mouse.up();
    expect((await box(page, session)).width).toBeGreaterThan(before + 60);
    await page.screenshot({ path: testInfo.outputPath("split-three-panes.png") });

    // A divider dragged all the way over leaves the pane barely visible, not gone.
    const edge = await box(page, "split-divider-0");
    await page.mouse.move(edge.x + 2, edge.y + 40);
    await page.mouse.down();
    await page.mouse.move(0, edge.y + 40, { steps: 8 });
    await page.mouse.up();
    const squeezed = (await box(page, session)).width;
    expect(squeezed).toBeGreaterThanOrEqual(47);
    expect(squeezed).toBeLessThan(60);

    // Members are marked in the strip; clicking any one keeps the set; focus follows a click in a pane.
    await page.getByTestId(terminalTab).click();
    await expect(canvas).toHaveAttribute("data-split", "3");
    await page.getByTestId(readme).click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId(fileTab)).toHaveClass(/tab-bar__tab--active/);

    // Order, set and widths survive a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(canvas).toHaveAttribute("data-split", "3", { timeout: 20000 });

    // Unsplit one member; the other two stay split, then the last pair dissolves.
    await page.getByTestId(reviewTab).click({ button: "right" });
    await page.getByTestId("tab-unsplit").click();
    await expect(canvas).toHaveAttribute("data-split", "2");
    await page.getByTestId(fileTab).click({ button: "right" });
    await page.getByTestId("tab-unsplit").click();
    await expect(canvas).toHaveAttribute("data-split", "0");
    expect(await strip(page)).toEqual([terminalTab, fileTab, reviewTab]);
  } finally {
    fs.rmSync(ROOT, { recursive: true, force: true });
  }
});
