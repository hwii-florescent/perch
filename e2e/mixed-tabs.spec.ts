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
// One folder per project: the core remembers a project by path, so a deleted and
// recreated folder would reuse an earlier test's stale project.
const roots: string[] = [];
let fixtures = 0;

/** A git repo with a README; removed by `cleanup`. */
function prepareFixture(): string {
  const ROOT = path.join(os.tmpdir(), `perch-e2e-mixed-tabs-${RUN_ID}-${++fixtures}`);
  roots.push(ROOT);
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
  return ROOT;
}

function cleanup(): void {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}

/** data-testids of the strip's tabs, left to right. */
const strip = (page: Page) => page.locator('[data-testid="tab-bar"] .tab-bar__tab').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
const activeTab = (page: Page) => page.locator('[data-testid="tab-bar"] .tab-bar__tab--active').getAttribute("data-testid");

/** The leader chord: Ctrl+Space, then `key`. */
async function chord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

/** `ROOT` as a project with a terminal session, README.md and the review open as tabs. */
async function openAll(page: Page, ROOT: string) {
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
  const root = prepareFixture();
  try {
    const { workspaceId, terminalTab, fileTab, reviewTab } = await openAll(page, root);

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
    cleanup();
  }
});

const box = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;

test("tabs split side by side under one strip", async ({ page }, testInfo) => {
  const root = prepareFixture();
  try {
    const { sessionId, terminalTab, fileTab, reviewTab } = await openAll(page, root);
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
    cleanup();
  }
});

test("returning to a project restores its selected resource and split", async ({ page }) => {
  const rootA = prepareFixture();
  const rootB = prepareFixture();
  try {
    const a = await openAll(page, rootA);
    const canvas = page.getByTestId("split-canvas");
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    await expect(canvas).toHaveAttribute("data-split", "2");
    expect(await activeTab(page)).toBe(a.fileTab);

    // Another project has its own strip.
    const sessionB = await startChat(page, "terminal", rootB);
    await expect.poll(() => strip(page)).toEqual([`tab-${sessionB}`]);
    await expect(canvas).toHaveAttribute("data-split", "0");

    // Back by the workspace row: the same file is selected and the split is back.
    await page.locator(`[data-testid="workspace-entry-${a.workspaceId}"] .workspace-entry__button`).first().click();
    await expect.poll(() => strip(page)).toEqual([a.terminalTab, a.fileTab, a.reviewTab]);
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
    await expect(canvas).toHaveAttribute("data-split", "2");

    // Back by the session row too (a plain session switch across projects).
    await page.getByTestId(`workspace-session-${sessionB}`).click();
    await expect.poll(() => strip(page)).toEqual([`tab-${sessionB}`]);
    await page.getByTestId(`workspace-session-${a.sessionId}`).click();
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
    await expect(canvas).toHaveAttribute("data-split", "2");
  } finally {
    cleanup();
  }
});

test("closing the last tab shows the home screen, never another project's tab", async ({ page }) => {
  const rootA = prepareFixture();
  const rootB = prepareFixture();
  try {
    const a = await openAll(page, rootA);
    const sessionB = await startChat(page, "terminal", rootB);
    await page.locator(`[data-testid="workspace-entry-${a.workspaceId}"] .workspace-entry__button`).first().click();
    await expect.poll(() => strip(page)).toEqual([a.terminalTab, a.fileTab, a.reviewTab]);

    await page.getByTestId(`review-tab-close-${a.workspaceId}`).click();
    await page.getByTestId(`file-tab-close-README.md`).click();
    await page.getByTestId(`tab-close-${a.sessionId}`).click();

    // No tabs left in A, and B's session was not shown instead.
    await expect.poll(() => strip(page)).toEqual([]);
    await expect(page.getByTestId("no-session-panel")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`workspace-session-${sessionB}`)).toBeVisible();
  } finally {
    cleanup();
  }
});

test("a viewer with no local tabs gets its strip and split back from the core", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    const canvas = page.getByTestId("split-canvas");
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    await expect(canvas).toHaveAttribute("data-split", "2");
    await page.getByTestId(a.reviewTab).dragTo(page.getByTestId(a.terminalTab));
    await expect.poll(() => strip(page)).toEqual([a.reviewTab, a.terminalTab, a.fileTab]);
    await page.waitForTimeout(1500); // the presentation is saved shortly after the last change

    // Lose this browser's tab state but keep its viewer identity, as a cleared cache would.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (/^perch\.(fileTabs|splitSets|tabOrder\.)/.test(key)) localStorage.removeItem(key);
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => strip(page), { timeout: 20000 }).toEqual([a.reviewTab, a.terminalTab, a.fileTab]);
    await expect(canvas).toHaveAttribute("data-split", "2");
  } finally {
    cleanup();
  }
});

test("a file with an unsaved draft keeps its tab when closed", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(a.fileTab).click();
    await page.getByTestId("workspace-file-editor").fill("an unsaved draft\n");
    await page.waitForTimeout(1500); // the draft reaches the core
    await page.getByTestId("file-tab-close-README.md").click();
    await page.waitForTimeout(1000);
    expect(await strip(page)).toContain(a.fileTab);
    await page.getByTestId(a.fileTab).click();
    await expect(page.getByTestId("workspace-file-editor")).toHaveValue("an unsaved draft\n");
  } finally {
    cleanup();
  }
});

test("closing the only terminal keeps the open file, and closing the last tab keeps the workspace", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(`tab-close-${a.sessionId}`).click();
    await expect.poll(() => strip(page)).toEqual([a.fileTab, a.reviewTab]);
    await expect.poll(() => activeTab(page)).toBe(a.reviewTab); // the newest resource
    await page.getByTestId(`review-tab-close-${a.workspaceId}`).click();
    await page.getByTestId("file-tab-close-README.md").click();
    await expect(page.getByTestId("no-session-panel")).toBeVisible({ timeout: 15000 });
    // The empty context is still this workspace (its start picker), not the generic home.
    await expect(page.getByTestId("home-add-project")).toHaveCount(0);
  } finally {
    cleanup();
  }
});

test("switching workspace inside the save delay still saves the split left behind", async ({ page }) => {
  const rootA = prepareFixture();
  const rootB = prepareFixture();
  try {
    const a = await openAll(page, rootA);
    await startChat(page, "terminal", rootB);
    await page.locator(`[data-testid="workspace-entry-${a.workspaceId}"] .workspace-entry__button`).first().click();
    await expect.poll(() => strip(page)).toEqual([a.terminalTab, a.fileTab, a.reviewTab]);
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    // Leave A at once, before the 400 ms debounce fires.
    await page.locator(`[data-testid^="workspace-entry-"]:not([data-testid="workspace-entry-${a.workspaceId}"]) .workspace-entry__button`).first().click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (/^perch\.(fileTabs|splitSets|tabOrder\.)/.test(key)) localStorage.removeItem(key);
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(`[data-testid="workspace-entry-${a.workspaceId}"] .workspace-entry__button`).first().click();
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2", { timeout: 20000 });
  } finally {
    cleanup();
  }
});

const viewerOf = (p: Page) => p.evaluate(() => sessionStorage.getItem("perch.viewerId"));

test("two windows of one browser are two viewers with their own layouts", async ({ page, context }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2");
    await page.getByTestId(a.terminalTab).click(); // the terminal, not the file, is what is selected
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
    await page.waitForTimeout(1500);

    const second = await context.newPage();
    await second.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => viewerOf(second)).toBeTruthy();
    expect(await viewerOf(second)).not.toBe(await viewerOf(page));
    // The other window has none of A's tabs or splits, and what it does leaves A alone.
    await expect(second.getByTestId(a.fileTab)).toHaveCount(0);
    await expect(second.getByTestId("split-canvas")).toHaveAttribute("data-split", "0");

    const before = await viewerOf(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2", { timeout: 20000 });
    await expect(page.getByTestId(a.fileTab)).toBeVisible();
    expect(await viewerOf(page)).toBe(before); // a reload keeps the window's viewer
  } finally {
    cleanup();
  }
});

test("a window opened by another window is its own viewer", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => viewerOf(page)).toBeTruthy();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.evaluate(() => { window.open("/", "_blank"); })]);
  await popup.waitForLoadState("domcontentloaded");
  // The popup starts with a copy of the opener's sessionStorage; it must move off that id.
  await expect.poll(() => viewerOf(popup), { timeout: 10000 }).not.toBe(await viewerOf(page));
  expect(await viewerOf(popup)).toBeTruthy();
});

test("a restart without sessionStorage gets the selected file back", async ({ page, browser }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(a.fileTab).click();
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
    await page.waitForTimeout(1500);
    const state = await page.context().storageState(); // localStorage only, as after quitting the app
    await page.close();

    const restarted = await browser.newContext({ storageState: state });
    try {
      const again = await restarted.newPage();
      await again.goto("/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => strip(again), { timeout: 20000 }).toEqual([a.terminalTab, a.fileTab, a.reviewTab]);
      await expect.poll(() => activeTab(again), { timeout: 20000 }).toBe(a.fileTab);
    } finally {
      await restarted.close();
    }
  } finally {
    cleanup();
  }
});

test("a reload restores the selected file, and keyboard focus selects a split pane", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(a.fileTab).click();
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
    await page.waitForTimeout(1500); // the selection is saved with the presentation
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => activeTab(page), { timeout: 20000 }).toBe(a.fileTab);

    // Split the file beside the terminal; focus moved by keyboard (no click) selects that pane.
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2");
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
    await page.getByTestId("split-pane-session").locator("textarea").first().focus();
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
    await page.getByTestId("workspace-file-editor").focus();
    await expect.poll(() => activeTab(page)).toBe(a.fileTab);
  } finally {
    cleanup();
  }
});

test("a restore interrupted by a dropped connection finishes after the reconnect", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    await page.getByTestId(a.fileTab).click();
    await page.waitForTimeout(1500); // the presentation is saved
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) if (/^perch\.(fileTabs|splitSets|tabOrder\.)/.test(key)) localStorage.removeItem(key);
      sessionStorage.setItem("dropFirstList", "1");
    });
    // The next load loses its connection on the first surface.list.
    await page.addInitScript(() => {
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        if (typeof data === "string" && data.includes('"surface.list"') && sessionStorage.getItem("dropFirstList") === "1") {
          sessionStorage.removeItem("dropFirstList");
          this.close();
          return;
        }
        return send.call(this, data);
      };
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => strip(page), { timeout: 20000 }).toEqual([a.terminalTab, a.fileTab, a.reviewTab]);
    await expect.poll(() => activeTab(page), { timeout: 20000 }).toBe(a.fileTab);
  } finally {
    cleanup();
  }
});

test("a window resumes its own terminal, not the one another window chose last", async ({ page, context }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    const other = await startChat(page, "terminal", root);
    await page.getByTestId(a.terminalTab).click();
    await page.getByTestId(a.fileTab).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${a.sessionId}`).click();
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2");
    await page.getByTestId(a.terminalTab).click(); // the terminal, not the file, is what is selected
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
    await page.waitForTimeout(1500);

    const second = await context.newPage();
    await second.goto("/", { waitUntil: "domcontentloaded" });
    await second.locator(`[data-testid="workspace-entry-${a.workspaceId}"] .workspace-entry__button`).first().click();
    await second.getByTestId(`workspace-session-${other}`).click();
    await expect.poll(() => second.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(other);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2", { timeout: 20000 });
    expect(await page.evaluate(() => window.usePerchStore.getState().sessionId)).toBe(a.sessionId);
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
  } finally {
    cleanup();
  }
});

test("a restore that finishes late leaves a terminal chosen meanwhile in front", async ({ page }) => {
  const root = prepareFixture();
  try {
    const a = await openAll(page, root);
    const other = await startChat(page, "terminal", root);
    await page.getByTestId(a.terminalTab).click();
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
    await page.waitForTimeout(1500); // terminal A is saved as selected

    // The saved presentation's restore (surface.list) answers 1.5 s late.
    await page.routeWebSocket(/\/ws/, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (typeof message === "string" && message.includes('"surface.list.result"')) setTimeout(() => ws.send(message), 1500);
        else ws.send(message);
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`tab-${other}`)).toBeVisible({ timeout: 20000 });
    await page.getByTestId(`tab-${other}`).click();
    await expect.poll(() => activeTab(page)).toBe(`tab-${other}`);
    await page.waitForTimeout(3000); // the late answer has arrived
    expect(await activeTab(page)).toBe(`tab-${other}`);
  } finally {
    cleanup();
  }
});
