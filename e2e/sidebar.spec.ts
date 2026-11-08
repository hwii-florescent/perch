/**
 * sidebar.spec.ts — the sidebar's env header and its workspace session rows
 * (`WorkspaceOverview`): a started session is listed and active, is titled
 * after its first prompt, switches on click, and appears live on another
 * connection.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { addProject, startChat } from "./projects";
import { execFileSync } from "node:child_process";
import { localStorageState } from "./localAuth";

// A fresh context is the core's own UI with no saved sidebar choices; terminals are shown, as in the config.
const terminalsShown = () => localStorageState([{ origin: "http://127.0.0.1:7799", localStorage: [{ name: "perch.sidebar.showTerminals", value: "1" }] }]);

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

test.describe("Perch sidebar", () => {
  test("1. Load: a local-only install shows no host card", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("new-session-local")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("host-switcher")).toHaveCount(0);
  });

  test("2. a started session is listed and active", async ({ page }) => {
    await open(page);
    const id = await startChat(page);
    await expect(page.getByTestId(`workspace-session-${id}`)).toHaveClass(/workspace-entry__session--active/);
  });

  test("2a. The open workspace lists its chats as rows, in the tab strip's order", async ({ page }) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-rows-"));
    try {
    const first = await startChat(page, "terminal", dir);
    const id = await startChat(page, "terminal", dir);
    const rows = page.locator(".workspace-entry__sessions").filter({ has: page.getByTestId(`workspace-session-${first}`) });
    const ids = () => rows.locator('[data-testid^="workspace-session-"]:not([data-testid^="workspace-session-close-"])').evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-testid")!.replace("workspace-session-", "")));
    expect(await ids()).toEqual([first, id]);
    await page.getByTestId(`tab-${id}`).dragTo(page.getByTestId(`tab-${first}`));
    await expect.poll(ids).toEqual([id, first]);
    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(ids).toEqual([id, first]);
    await expect(page.getByTestId(`workspace-session-${id}`)).toHaveClass(/workspace-entry__session--active/);
    await expect(page.getByTestId("session-dots")).toHaveCount(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });


  test("2h. explicit state labels and background idle chats stay visible on desktop and phone", async ({ page }, testInfo) => {
    // Only the incoming display facts are fixtures; real isolated shells/projects provide the rows.
    // No agent/model calls are needed to verify the sidebar's presentation.
    const states = new Map<string, { status: "idle" | "running"; blocked?: boolean }>();
    await page.routeWebSocket("**/ws", (ws) => {
      const server = ws.connectToServer();
      server.onMessage((raw) => {
        const frame = JSON.parse(String(raw));
        const decorate = (session: { id: string }) => states.has(session.id)
          ? { ...session, unseen: false, stale: false, blocked: false, ...states.get(session.id) }
          : session;
        if (frame.type === "session.list") frame.sessions = frame.sessions.map(decorate);
        if (frame.type === "session.updated") frame.session = decorate(frame.session);
        ws.send(JSON.stringify(frame));
      });
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-labels-"));
    const other = path.join(dir, "other");
    fs.mkdirSync(other);
    try {
      await open(page);
      const work = await startChat(page, "terminal", dir);
      const ask = await startChat(page, "terminal", dir);
      const idle = await startChat(page, "terminal", dir);
      states.set(work, { status: "running" });
      states.set(ask, { status: "running", blocked: true });
      states.set(idle, { status: "idle" });
      await startChat(page, "terminal", other); // The populated workspace is now in the background.
      await page.evaluate(() => localStorage.setItem("perch.sidebar.activeOnly", "1"));
      await page.reload({ waitUntil: "networkidle" });
      const check = async () => {
        for (const [id, text] of [[work, "Working"], [ask, "Needs you"]]) {
          const badge = page.getByTestId(`session-state-${id}`);
          await expect(badge).toBeVisible();
          await expect(badge).toHaveText(text);
          expect(await badge.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
          const row = page.getByTestId(`workspace-session-${id}`);
          expect((await badge.boundingBox())!.x).toBeGreaterThan((await row.boundingBox())!.x);
        }
        await expect(page.getByTestId(`workspace-session-${idle}`)).toBeVisible();
        await expect(page.locator('[data-testid^="workspace-idle-"]')).toHaveCount(0);
      };
      await check();
      await page.screenshot({ path: testInfo.outputPath("project-labels-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("mobile-switch").click();
      await check();
      await page.screenshot({ path: testInfo.outputPath("project-labels-phone.png") });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("2c. scoped +, harness rings and whole worktree rows", async ({ page }, testInfo) => {
    const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-harness-")));
    const repo = path.join(fixture, "perch");
    const treePath = path.join(fixture, "feature");
    fs.mkdirSync(repo);
    const git = (args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: repo, input: "", timeout: 15000 });
    git(["init", "-q", "-b", "main"]);
    git(["-c", "user.name=perch e2e", "-c", "user.email=e2e@perch.test", "commit", "--allow-empty", "-qm", "fixture"]);
    try {
      await open(page);
      const mainSession = await startChat(page, "terminal", repo);
      await page.getByTestId(`worktree-menu-local-${repo}`).click();
      await page.getByTestId("worktree-branch-input").fill("feature");
      await page.getByTestId("worktree-path-input").fill(treePath);
      await page.getByTestId("worktree-create-submit").click();
      const project = page.locator(".workspace-project").filter({ has: page.locator(`button[title="${repo}"]`) }).first();
      const main = project.locator(".workspace-entry").filter({ has: page.locator(`button[title="${repo}"]`) });
      const tree = project.locator(".workspace-entry").filter({ has: page.locator(`button[title="${treePath}"]`) });
      await expect(tree).toBeVisible({ timeout: 30000 });
      await tree.click({ position: { x: 8, y: 8 } });
      await expect(tree.locator(".workspace-entry__button--active")).toBeVisible();
      await page.getByTestId("tab-new").click();
      await expect(page.locator('[data-testid^="project-option-"]')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("scoped-harness-picker.png") });
      await page.getByTestId("new-session-provider-terminal").click();
      const terminal = page.getByTestId("persistent-agent-terminal");
      await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30000 });
      const ring = tree.locator(".agent-mark");
      await expect(ring).toHaveAttribute("data-provider", "terminal");
      await expect(ring.locator("svg")).toBeVisible();
      // Desktop: Workspaces sit inside the Project; the open one lists its chats as rows under its name.
      await expect(tree).toHaveCSS("border-radius", "8px");
      await expect(tree.getByTestId("workspace-checkout-icon")).toBeVisible();
      await expect(tree.getByTestId("workspace-checkout-icon").locator("circle")).toHaveCount(3);
      await expect(main.getByTestId("workspace-checkout-icon")).toBeVisible();
      await expect(main.getByTestId("workspace-checkout-icon").locator("circle")).toHaveCount(0);
      await expect(main.getByTestId("workspace-checkout-icon").locator("path")).toHaveAttribute("d", "M8 3l5 5-5 5-5-5z");
      await expect(project.getByTestId("project-folder-icon")).toBeVisible();
      await expect(project.locator(".workspace-tree__guide, [data-guide-end]")).toHaveCount(0);
      await expect(ring).toHaveCSS("width", "18px");
      await expect(ring).toHaveCSS("height", "18px");
      const nameRow = tree.locator(".workspace-entry__button");
      expect((await nameRow.boundingBox())!.height).toBeGreaterThanOrEqual(28);
      const name = main.locator("strong");
      const branch = main.locator("span").filter({ hasText: /^main$/ }).last();
      const [nameBox, branchBox] = await Promise.all([name.boundingBox(), branch.boundingBox()]);
      expect(branchBox!.x).toBeGreaterThan(nameBox!.x);
      expect(Math.abs(branchBox!.y - nameBox!.y)).toBeLessThan(8);
      // Clicking a row selects its workspace; even background idle chats stay listed and selectable.
      const treeSession = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      await main.click({ position: { x: 2, y: 8 } });
      await expect(page.getByTestId(`tab-${mainSession}`)).toHaveClass(/tab-bar__tab--active/);
      await expect(tree.locator('[data-testid^="workspace-idle-"]')).toHaveCount(0);
      await page.getByTestId(`workspace-session-${treeSession}`).click();
      await expect(page.getByTestId(`tab-${treeSession}`)).toHaveClass(/tab-bar__tab--active/);
      await page.keyboard.down("Control");
      await page.keyboard.down("Shift");
      for (const entry of [main, tree]) {
        const hint = entry.locator("kbd");
        await expect(hint).toBeVisible();
        const [rowBox, hintBox] = await Promise.all([entry.boundingBox(), hint.boundingBox()]);
        expect(rowBox!.x + rowBox!.width - hintBox!.x - hintBox!.width).toBeCloseTo(12, 0);
      }
      await page.screenshot({ path: testInfo.outputPath("worktree-number-hints-desktop.png") });
      await page.keyboard.up("Shift");
      await page.keyboard.up("Control");
      await page.screenshot({ path: testInfo.outputPath("worktree-harness-rings-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("mobile-switch").click();
      const mobileSession = page.getByTestId(`workspace-session-${treeSession}`);
      await expect(mobileSession).toBeVisible();
      const mobileTree = page.locator(".workspace-entry").filter({ has: mobileSession });
      // The phone lists the rows on their own lines under the name.
      const headerBox = await mobileTree.locator(".workspace-entry__button").boundingBox();
      const sessionBox = await mobileSession.boundingBox();
      expect(sessionBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      await page.screenshot({ path: testInfo.outputPath("worktree-harness-rings-mobile.png") });
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("2d. Terminal badge follows manually launched Pi and keeps a circular badge", async ({ page }, testInfo) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-manual-pi-"));
    try {
    const id = await startChat(page, "terminal", dir);
    const terminal = page.getByTestId("persistent-agent-terminal");
    const button = page.getByTestId(`workspace-session-${id}`);
    const ring = button.locator(".agent-mark");
    await expect(ring).toHaveAttribute("data-provider", "terminal");
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially("pi --provider anthropic --model claude-haiku-4-5 --no-extensions --no-skills --no-prompt-templates");
    await input.press("Enter");
    // No model prompt or turn. Check the banner/model before any input.
    await expect(terminal.locator(".xterm-rows")).toContainText("claude-haiku-4-5", { timeout: 30000 });
    await expect(ring).toHaveAttribute("data-provider", "pi", { timeout: 10000 });
    const style = await button.evaluate((element) => {
      const badge = element.querySelector(".agent-mark")!;
      const mark = badge.querySelector("svg")!;
      return {
        button: getComputedStyle(element).backgroundColor,
        width: badge.getBoundingClientRect().width,
        height: badge.getBoundingClientRect().height,
        radius: getComputedStyle(badge).borderRadius,
        outlineOffset: getComputedStyle(badge).outlineOffset,
        icon: mark.getBoundingClientRect().width,
      };
    });
    expect(style.button).toBe("rgba(0, 0, 0, 0)");
    expect(style.width).toBe(18);
    expect(style.height).toBe(18);
    expect(style.radius === "50%" || parseFloat(style.radius) >= 9).toBe(true);
    expect(style.icon).toBe(14);
    await page.screenshot({ path: testInfo.outputPath("manual-pi-badge-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("mobile-switch").click();
    await expect(button).toBeVisible();
    await expect(ring).toHaveAttribute("data-provider", "pi");
    await page.screenshot({ path: testInfo.outputPath("manual-pi-badge-mobile.png") });
    await button.click();
    await page.setViewportSize({ width: 1280, height: 820 });
    await input.press("Control+d");
    await expect(ring).toHaveAttribute("data-provider", "terminal", { timeout: 15000 });
    // Refresh retains Terminal as the launcher, not Pi as a replacement recipe.
    await page.reload({ waitUntil: "networkidle" });
    await expect(ring).toHaveAttribute("data-provider", "terminal");
    await page.getByTestId(`tab-close-${id}`).click();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("2g. Plain terminals stay out of the sidebar unless Show terminals is on", async ({ page }) => {
    await open(page);
    const id = await startChat(page, "terminal");
    await expect(page.getByTestId(`workspace-session-${id}`)).toBeVisible();
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-show-terminals").click();
    await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
    await expect(page.getByTestId(`tab-${id}`)).toBeVisible(); // still a tab
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-show-terminals").click();
    await expect(page.getByTestId(`workspace-session-${id}`)).toBeVisible();
  });

  test("2b. Organize sidebar: in one list shows every session flat", async ({ page }) => {
    await open(page);
    const id = await startChat(page);
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-organize-list").click();
    await expect(page.getByTestId("workspace-session-list").getByTestId(`workspace-session-${id}`)).toBeVisible();
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-organize-project").click();
    await expect(page.getByTestId("workspace-session-list")).toHaveCount(0);
    await expect(page.getByTestId(`workspace-session-${id}`)).toBeVisible();
  });

  test("2e. The project tree is the default Organize view; By status groups by what each chat needs and a saved choice wins", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: terminalsShown() }); // no saved choice (the config pins By project)
    try {
      const page = await ctx.newPage();
      await open(page);
      const id = await startChat(page);
      await expect(page.getByTestId("workspace-status-view")).toHaveCount(0);
      await expect(page.getByTestId("workspace-chats")).toBeVisible();
      await page.getByTestId("workspace-organize").click();
      await page.getByTestId("workspace-organize-status").click();
      await expect(page.getByTestId("status-section-idle").getByTestId(`workspace-session-${id}`)).toBeVisible();
      await expect(page.getByTestId("status-section-title-idle")).toContainText("Idle");
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByTestId("workspace-status-view")).toBeVisible();
      await page.getByTestId("workspace-organize").click();
      await page.getByTestId("workspace-organize-project").click();
      await expect(page.getByTestId("workspace-status-view")).toHaveCount(0);
      await expect(page.getByTestId("workspace-chats")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("2f. Projects reorder by drag and Move down, and the core keeps the order across a reload", async ({ page }) => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-projects-")));
    const dirs = ["alpha", "beta"].map((name) => path.join(root, name));
    dirs.forEach((dir) => fs.mkdirSync(dir));
    try {
      await open(page);
      for (const dir of dirs) await addProject(page, dir);
      const toggle = (dir: string) => page.locator(`[data-testid^="project-toggle-"][title="${dir}"]`);
      for (const dir of dirs) await expect(toggle(dir)).toBeVisible({ timeout: 10_000 });
      const shown = () => page.locator("[data-testid='project-list'] > .workspace-project").evaluateAll(
        (rows, mine) => rows.map((row) => row.querySelector("[data-testid^='project-toggle-']")?.getAttribute("title") ?? "").filter((title) => mine.includes(title)),
        dirs,
      );
      const [alpha, beta] = dirs as [string, string];
      // Newest first until someone reorders.
      await expect.poll(shown).toEqual([beta, alpha]);
      await toggle(alpha).dragTo(toggle(beta), { targetPosition: { x: 40, y: 2 } });
      await expect.poll(shown).toEqual([alpha, beta]);
      await page.reload({ waitUntil: "networkidle" });
      await expect.poll(shown).toEqual([alpha, beta]);
      // Move down from the row menu (the keyboard and phone path).
      const id = (await toggle(alpha).getAttribute("data-testid"))!.replace("project-toggle-", "");
      await page.getByTestId(`workspace-project-menu-${id}`).click();
      await page.getByTestId(`workspace-project-move-down-${id}`).click();
      await expect.poll(shown).toEqual([beta, alpha]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("2c. Chats reorder by drag, Move and tab drag; the core keeps one order for every viewer", async ({ browser }) => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-order-")));
    const ctx1 = await browser.newContext({ storageState: terminalsShown() });
    const ctx2 = await browser.newContext({ storageState: terminalsShown() });
    try {
      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();
      await open(page1);
      await open(page2);
      const a = await startChat(page1, "terminal", dir);
      const b = await startChat(page1, "terminal", dir);
      const c = await startChat(page1, "terminal", dir);
      for (const page of [page1, page2]) {
        await page.getByTestId("workspace-organize").click();
        await page.getByTestId("workspace-organize-status").click();
      }
      const shown = (page: Page) => page.getByTestId("workspace-status-view").locator("[data-testid^='workspace-session-']").evaluateAll(
        (rows, mine) => rows.map((row) => row.getAttribute("data-testid")!.replace("workspace-session-", "")).filter((id) => mine.includes(id)),
        [a, b, c],
      );
      // A chat is also a dot under its project; these steps mean its By status row.
      const row = (page: Page, id: string) => page.getByTestId("workspace-status-view").getByTestId(`workspace-session-${id}`);
      const strip = (page: Page) => page.locator("[data-testid^='tab-']").evaluateAll(
        (tabs, mine) => tabs.map((tab) => tab.getAttribute("data-testid")!.replace("tab-", "")).filter((id) => mine.includes(id)),
        [a, b, c],
      );
      // The strip is oldest first and By status shows it mirrored, newest first, until someone reorders.
      await expect.poll(() => shown(page2)).toEqual([c, b, a]);
      await expect.poll(() => strip(page1)).toEqual([a, b, c]);

      // Drag a above c: no click fires, so c stays the open chat; the other viewer follows,
      // and only a moved: b and c keep their order in the strip.
      await row(page1, a).dragTo(row(page1, c), { targetPosition: { x: 40, y: 2 } });
      await expect.poll(() => shown(page1)).toEqual([a, c, b]);
      await expect.poll(() => shown(page2)).toEqual([a, c, b]);
      await expect.poll(() => strip(page1)).toEqual([b, c, a]);
      await expect(row(page1, c)).toHaveClass(/workspace-entry__session--active/);
      // Nothing is left displaced or lifted once it lands.
      for (const id of [a, b, c]) {
        const wrapper = row(page1, id).locator("xpath=..");
        await expect(wrapper).toHaveCSS("transform", "none");
        await expect(wrapper).toHaveCSS("z-index", "auto");
      }

      // Move down from the other viewer's row menu: a goes below c.
      await row(page2, a).click({ button: "right" });
      await page2.getByTestId(`workspace-session-move-down-${a}`).click();
      await expect.poll(() => shown(page1)).toEqual([c, a, b]);
      await row(page2, a).click({ button: "right" });
      await expect(page2.getByTestId(`workspace-session-move-up-${a}`)).toBeVisible();
      await expect(page2.getByTestId(`workspace-session-move-down-${a}`)).toBeVisible();
      await page2.keyboard.press("Escape");

      // The tab strip shows the mirror of that, and dragging a tab reorders the core's list too.
      await expect.poll(() => strip(page1)).toEqual([b, a, c]);
      await page1.getByTestId(`tab-${c}`).dragTo(page1.getByTestId(`tab-${b}`), { targetPosition: { x: 4, y: 8 } });
      await expect.poll(() => shown(page2)).toEqual([a, b, c]);

      await page1.reload({ waitUntil: "networkidle" });
      await expect.poll(() => shown(page1)).toEqual([a, b, c]);
    } finally {
      await ctx1.close();
      await ctx2.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("3. a session is titled after its first prompt", async ({ page }) => {
    await open(page);
    const id = await startChat(page, "claude");
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially("Reply with exactly: pong");
    await input.press("Enter");
    await expect(page.getByTestId(`workspace-session-${id}`)).toContainText("Reply with exactly", { timeout: 30_000 });
  });

  test("4. clicking a row switches session", async ({ page }) => {
    await open(page);
    const first = await startChat(page);
    const second = await startChat(page);
    await expect(page.getByTestId(`workspace-session-${second}`)).toHaveClass(/workspace-entry__session--active/);
    await page.getByTestId(`workspace-session-${first}`).click();
    await expect(page.getByTestId(`workspace-session-${first}`)).toHaveClass(/workspace-entry__session--active/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(first);
  });

  test("5. a new session appears live on another connection", async ({ browser }) => {
    const ctx1 = await browser.newContext({ storageState: terminalsShown() });
    const ctx2 = await browser.newContext({ storageState: terminalsShown() });
    try {
      const page1 = await ctx1.newPage();
      const page2 = await ctx2.newPage();
      await open(page1);
      await open(page2);
      const id = await startChat(page1);
      await expect(page2.getByTestId(`workspace-session-${id}`)).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
