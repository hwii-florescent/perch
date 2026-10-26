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
import { addProject, startChat } from "./projects";
import { expectDoc } from "./editor";
import { resolveTheme, THEME_NAMES } from "../packages/web/src/themes";

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

test("Files and Git share the drawer shell across every theme without making canvas panes transparent", async ({ page }, testInfo) => {
  const root = prepareFixture();
  fs.appendFileSync(path.join(root, "README.md"), Array.from({ length: 80 }, (_, i) => `\ndrawer surface regression ${i}`).join(""));
  try {
    const { fileTab, reviewTab } = await openAll(page, root);
    const drawer = page.getByTestId("workspace-tools");
    for (const glass of [false, true]) {
      await page.evaluate((glass) => document.documentElement.toggleAttribute("data-glass", glass), glass);
      for (const theme of THEME_NAMES) {
        await page.evaluate((theme) => window.usePerchStore.getState().updateSettings({ theme }), theme);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--panel-bg").trim())).toBe(resolveTheme(theme).panelBg);
        for (const tab of ["files", "gitReview"]) {
          await page.getByTestId(`workspace-tools-${tab}`).click();
          await expect(page.getByTestId(`workspace-tools-${tab}`)).toHaveAttribute("aria-pressed", "true");
          const surface = drawer.getByTestId(tab === "files" ? "workspace-files-view" : "workspace-git-review");
          await expect(surface).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
          // Every layer from content through the drawer must let the same shell show through.
          expect(await surface.evaluate((el) => {
            for (let node: Element | null = el; node; node = node.parentElement) {
              if (getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)") return false;
              if (node.getAttribute("data-testid") === "workspace-tools") return true;
            }
            return false;
          })).toBe(true);
          if (tab === "gitReview") await expect(surface.getByTestId("git-diff-line").first()).toBeVisible();
          if (["perch", "catppuccin", "catppuccin-latte"].includes(theme)) {
            await page.getByTestId(`workspace-tools-${tab}`).blur();
            await page.mouse.move(24, 44);
            if (tab === "gitReview") {
              const diff = surface.getByTestId("git-diff");
              await diff.evaluate((el) => { el.scrollTop = 200; });
              await expect.poll(() => diff.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
              // Only review comments/composers stick horizontally; compare/status controls are separate flex scroll regions.
              expect(await surface.evaluate((el) => [...el.querySelectorAll("*")].filter((node) => getComputedStyle(node).position === "sticky").every((node) => getComputedStyle(node).top === "auto"))).toBe(true);
            }
            await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`drawer-${theme}-${tab}-${glass ? "glass" : "opaque"}.png`) });
          }
        }
        await page.getByTestId(reviewTab).click();
        await expect(page.getByTestId("split-pane-review").getByTestId("workspace-git-review")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await page.getByTestId(fileTab).click();
        await expect(page.getByTestId("workspace-file-pane")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      }
    }
    // The surface slot belongs to the desktop drawer, not the shared phone panes.
    await page.evaluate(() => document.documentElement.removeAttribute("data-glass"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("mobile-pane-files").click();
    if (await page.getByTestId("mobile-files-back").count()) await page.getByTestId("mobile-files-back").click();
    await expect(page.getByTestId("workspace-files-view")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await page.getByTestId("mobile-pane-git").click();
    await expect(page.getByTestId("workspace-git-review")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  } finally {
    await page.evaluate(() => { document.documentElement.removeAttribute("data-glass"); window.usePerchStore.getState().updateSettings({ theme: "perch" }); }).catch(() => {});
    cleanup();
  }
});

test("browser chrome matches the study and keeps its address field distinct inside dark and light panes", async ({ page }) => {
  const root = prepareFixture();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startChat(page, "terminal", root);
    await page.getByTestId("tab-new").click();
    await page.getByText("New browser", { exact: true }).click();
    const toolbar = page.getByTestId("browser-toolbar");
    const address = page.getByTestId("browser-address");
    await expect(toolbar).toHaveCSS("height", "43px");
    await expect(toolbar).toHaveCSS("border-bottom-width", "0px");
    await expect(address.locator("..")).toHaveCSS("height", "28px");
    await expect(address.locator("..")).toHaveCSS("border-radius", "8px");
    await expect(page.locator("footer.status-bar")).toHaveCSS("height", "24px");
    await expect(page.getByTestId("browser-open-external")).toBeDisabled();
    for (const theme of ["perch", "catppuccin-latte"]) {
      await page.evaluate((theme) => window.usePerchStore.getState().updateSettings({ theme }), theme);
      await expect.poll(() => address.evaluate((input) => {
        const field = getComputedStyle(input.parentElement!).backgroundColor;
        const bar = getComputedStyle(input.closest('[data-testid="browser-toolbar"]')!).backgroundColor;
        return field !== bar && field !== "rgba(0, 0, 0, 0)";
      })).toBe(true);
    }
  } finally {
    await page.evaluate(() => window.usePerchStore.getState().updateSettings({ theme: "perch" })).catch(() => {});
    cleanup();
  }
});

test("a terminal, a file and the review share one ordered strip", async ({ page }) => {
  const root = prepareFixture();
  try {
    const { workspaceId, terminalTab, fileTab, reviewTab } = await openAll(page, root);

    // A file and the review open as tabs after the terminal, with no agent started.
    await expect(page.getByTestId("workspace-git-review").last()).toBeVisible({ timeout: 20000 });
    // The tab's pane is not blank: the review fills it (it once collapsed to zero width in the pane's flex row).
    const reviewBox = await page.getByTestId("split-pane-review").getByTestId("workspace-git-review").boundingBox();
    expect(reviewBox?.width ?? 0).toBeGreaterThan(300);
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
    await expect(page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea")).toBeFocused();
    await chord(page, "n");
    await expect.poll(() => activeTab(page)).toBe(fileTab);
    await expect(page.getByTestId("workspace-file-editor")).toBeFocused();
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

/** Presses on a tab and moves the pointer to `to`, leaving the button down (tab drags are pointer-based). */
async function holdTab(page: Page, testId: string, to: { x: number; y: number }): Promise<void> {
  const from = await box(page, testId);
  await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
}

test("a tab dropped past the last one goes last, and one dropped on a pane's side splits it that way", async ({ page }) => {
  const root = prepareFixture();
  try {
    const { terminalTab, fileTab, reviewTab } = await openAll(page, root);
    await expect(page.getByTestId("workspace-git-review").last()).toBeVisible({ timeout: 20000 });
    expect(await strip(page)).toEqual([terminalTab, fileTab, reviewTab]);

    // Past the last tab, in the strip's empty space: the bar shows, and the tab goes last.
    const bar = await box(page, "tab-bar");
    await holdTab(page, terminalTab, { x: bar.x + bar.width - 4, y: bar.y + bar.height / 2 });
    await expect(page.getByTestId("tab-drop-bar")).toBeVisible();
    await page.mouse.up();
    await expect.poll(() => strip(page)).toEqual([fileTab, reviewTab, terminalTab]);
    await expect(page.getByTestId("tab-drag-layer")).toHaveCount(0);

    // Over a pane's lower edge the highlight is its lower half; releasing stacks the tab below.
    const pane = await box(page, "split-pane-review");
    await holdTab(page, fileTab, { x: pane.x + pane.width / 2, y: pane.y + pane.height - 8 });
    await expect(page.getByTestId("tab-drop-zone")).toHaveAttribute("data-zone", "down");
    await page.mouse.up();
    const canvas = page.getByTestId("split-canvas");
    await expect(canvas).toHaveAttribute("data-split", "2");
    await expect(page.getByTestId("split-divider-0")).toHaveAttribute("aria-orientation", "horizontal");
    // Stacked, the file is below the review, and the strip's order follows.
    const stacked = [await box(page, "split-pane-review"), await box(page, "split-pane-file-README.md")];
    expect(stacked[0]!.y).toBeLessThan(stacked[1]!.y);
    expect(stacked[0]!.x).toBeCloseTo(stacked[1]!.x, 0);
    expect((await strip(page)).filter((id) => id !== terminalTab)).toEqual([reviewTab, fileTab]);

    // Escape drops nothing.
    const upper = await box(page, "split-pane-review");
    await holdTab(page, terminalTab, { x: upper.x + upper.width - 8, y: upper.y + upper.height / 2 });
    await expect(page.getByTestId("tab-drop-zone")).toHaveAttribute("data-zone", "right");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.getByTestId("tab-drag-layer")).toHaveCount(0);
    await expect(canvas).toHaveAttribute("data-split", "2");

    // A side across the stack's axis nests: the upper pane becomes a row of it and the new tab.
    await holdTab(page, terminalTab, { x: upper.x + upper.width - 8, y: upper.y + upper.height / 2 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute("data-split", "3");
    const [review, terminal, file] = [await box(page, "split-pane-review"), await box(page, "split-pane-session"), await box(page, "split-pane-file-README.md")];
    expect(review.x).toBeLessThan(terminal.x);
    expect(review.y).toBeCloseTo(terminal.y, 0);
    expect(file.y).toBeGreaterThan(review.y + review.height - 2);
    expect(file.width).toBeGreaterThan(review.width + terminal.width - 4);
    await expect(canvas.locator('[role="separator"][aria-orientation="vertical"]')).toHaveCount(1);
    await expect(canvas.locator('[role="separator"][aria-orientation="horizontal"]')).toHaveCount(1);
  } finally {
    cleanup();
  }
});

test("two terminals tile side by side, the strip stays one row, and the order survives a reload", async ({ page }) => {
  const root = prepareFixture();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const first = await startChat(page, "terminal", root);
    const second = await startChat(page, "terminal", root);
    const [t1, t2] = [`tab-${first}`, `tab-${second}`];
    expect(await strip(page)).toEqual([t1, t2]);

    // The first terminal dropped on the left of the (current) second one: both show, in that order.
    const pane = await box(page, "split-pane-session");
    await holdTab(page, t1, { x: pane.x + 12, y: pane.y + pane.height / 2 });
    await expect(page.getByTestId("tab-drop-zone")).toHaveAttribute("data-zone", "left");
    await page.mouse.up();
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2");
    const [left, right] = [await box(page, "split-pane-session"), await box(page, `split-pane-session-${second}`)];
    expect(left.x).toBeLessThan(right.x);
    await expect(page.getByTestId(`split-pane-session-${second}`).locator(".xterm")).toBeVisible({ timeout: 20000 });
    expect(await strip(page)).toEqual([t1, t2]);
    await expect(page.getByTestId("tab-bar")).toHaveCount(1);
    // Focus changes must preserve the terminal DOM node, not replace its renderer.
    const leftTerminal = await page.locator(`[data-pane-id="${first}"] .xterm`).elementHandle();
    const rightTerminal = await page.locator(`[data-pane-id="${second}"] .xterm`).elementHandle();
    await page.keyboard.press("Meta+Alt+ArrowRight");
    await expect.poll(() => activeTab(page)).toBe(t2);
    await page.keyboard.press("Meta+Alt+ArrowLeft");
    await expect.poll(() => activeTab(page)).toBe(t1);
    expect(await leftTerminal!.evaluate((el) => el.isConnected)).toBe(true);
    expect(await rightTerminal!.evaluate((el) => el.isConnected)).toBe(true);

    // Reordering the strip is remembered after a reload (the app's restart is the same: one origin).
    const bar = await box(page, "tab-bar");
    await holdTab(page, t1, { x: bar.x + bar.width - 4, y: bar.y + bar.height / 2 });
    await page.mouse.up();
    await expect.poll(() => strip(page)).toEqual([t2, t1]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => strip(page), { timeout: 20000 }).toEqual([t2, t1]);
    await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2");
  } finally {
    cleanup();
  }
});

test("tiled pane controls, tab menus and pane shortcuts all act on the visible tiles", async ({ page }, testInfo) => {
  const root = prepareFixture();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const first = await startChat(page, "terminal", root);
    const second = await startChat(page, "terminal", root);
    const canvas = page.getByTestId("split-canvas");
    const pane = await box(page, "split-pane-session");
    await holdTab(page, `tab-${first}`, { x: pane.x + 12, y: pane.y + pane.height / 2 });
    await page.mouse.up();
    await expect(canvas).toHaveAttribute("data-split", "2");
    await expect(page.getByTestId(`tile-expand-${first}`)).toBeVisible();
    await expect(page.getByTestId(`tile-close-${second}`)).toBeVisible();

    // The same actions listed in Settings: previous/next, zoom/restore and directional focus.
    await page.keyboard.press("Meta+]");
    await expect.poll(() => activeTab(page)).toBe(`tab-${second}`);
    await expect(page.locator(`[data-pane-id="${second}"] .xterm-helper-textarea`)).toBeFocused();
    await page.keyboard.press("Meta+Shift+Enter");
    await expect(page.getByTestId("split-divider-0")).toHaveCount(0);
    await page.keyboard.press("Meta+Shift+Enter");
    await expect(page.getByTestId("split-divider-0")).toBeVisible();
    await chord(page, "+");
    await expect.poll(async () => (await box(page, "split-pane-session")).width).toBeGreaterThan(pane.width / 2 + 30);
    await chord(page, "h");
    await expect.poll(() => activeTab(page)).toBe(`tab-${first}`);

    // The full-size button leaves the split, but neither tab closes.
    await page.getByTestId(`tile-expand-${first}`).click();
    await expect(canvas).toHaveAttribute("data-split", "0");
    expect(await strip(page)).toEqual([`tab-${first}`, `tab-${second}`]);
    await page.getByTestId(`tab-${first}`).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${second}`).click();
    await expect(canvas).toHaveAttribute("data-split", "2");
    await page.getByTestId(`tab-${second}`).click({ button: "right" });
    await page.getByTestId("tab-untile-all").click();
    await expect(canvas).toHaveAttribute("data-split", "0");

    // A split shortcut creates a real terminal tab in this nest, not a hidden shell.
    await page.getByTestId(`tab-${first}`).click({ button: "right" });
    await page.getByTestId(`tab-split-with-${second}`).click();
    await page.keyboard.press("Meta+Shift+d");
    await expect(canvas).toHaveAttribute("data-split", "3", { timeout: 20000 });
    // Split below across a row of two: the active pane nests as a column, so both axes have a divider.
    await expect(canvas.locator('[role="separator"][aria-orientation="horizontal"]')).toHaveCount(1);
    await expect(canvas.locator('[role="separator"][aria-orientation="vertical"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("tile-controls.png") });
    const third = (await strip(page)).find((id) => id !== `tab-${first}` && id !== `tab-${second}`)!.replace("tab-", "");
    await page.getByTestId(`tile-close-${third}`).click();
    await expect(canvas).toHaveAttribute("data-split", "2");
    await page.getByTestId(`tab-${first}`).click({ button: "right" });
    await page.getByTestId("tab-unsplit").click();
    await expect(canvas).toHaveAttribute("data-split", "0");
  } finally {
    cleanup();
  }
});

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
    // No split marker: members are told apart by fill (visible vs focused), the unrelated review tab is plain.
    const paneState = (id: string) => page.getByTestId(id).getAttribute("data-pane-state");
    await expect.poll(async () => [await paneState(terminalTab), await paneState(fileTab)].sort()).toEqual(["focused", "visible"]);
    await expect.poll(() => paneState(reviewTab)).toBe("hidden");
    for (const id of [terminalTab, fileTab, reviewTab]) await expect(page.getByTestId(id)).toHaveCSS("box-shadow", "none");
    await expect(page.getByTestId(reviewTab)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(page.locator(`[data-testid="tab-bar"] [data-pane-state="focused"]`)).toHaveCSS("font-weight", "600");
    await expect(page.locator(`[data-testid="tab-bar"] [data-pane-state="visible"]`)).toHaveCSS("font-weight", "400");
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
    await expect(page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea")).toBeFocused();
    await page.getByTestId(fileTab).click();
    await expect(page.getByTestId("workspace-file-editor")).toBeFocused();
    await page.getByTestId(readme).click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId(fileTab)).toHaveClass(/tab-bar__tab--active/);

    // Order, set and widths survive a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(canvas).toHaveAttribute("data-split", "3", { timeout: 20000 });

    // Unsplit one member; the other two stay split, then the last pair dissolves.
    await page.getByTestId(reviewTab).click({ button: "right" });
    await page.getByTestId("tab-unsplit").click();
    await expect(canvas).toHaveAttribute("data-split", "0"); // the removed tab becomes full size
    await page.getByTestId(terminalTab).click();
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
    await expectDoc(page.getByTestId("workspace-file-editor"), "an unsaved draft\n");
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

test("a restore that finishes late leaves a choice made through an empty workspace in front", async ({ page }) => {
  const root = prepareFixture();
  const empty = prepareFixture();
  try {
    const a = await openAll(page, root);
    const other = await startChat(page, "terminal", root);
    await addProject(page, empty);
    await page.getByTestId(a.terminalTab).click();
    await expect.poll(() => activeTab(page)).toBe(a.terminalTab);
    await page.waitForTimeout(1500);

    await page.routeWebSocket(/\/ws/, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (typeof message === "string" && message.includes('"surface.list.result"')) setTimeout(() => ws.send(message), 2500);
        else ws.send(message);
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const emptyWorkspace = await firstWorkspaceId(page.locator(".workspace-project").filter({ hasText: path.basename(empty) }));
    await page.locator(`[data-testid="workspace-entry-${emptyWorkspace}"] .workspace-entry__button`).first().click();
    await expect(page.getByTestId("no-session-panel")).toBeVisible({ timeout: 10000 });
    await page.getByTestId(`workspace-session-${other}`).click();
    await expect.poll(() => activeTab(page)).toBe(`tab-${other}`);
    await page.waitForTimeout(4000); // the late answer has arrived
    expect(await activeTab(page)).toBe(`tab-${other}`);
  } finally {
    cleanup();
  }
});
