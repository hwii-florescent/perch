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

  test("2a. Compact sessions are dots on the row; Session list brings the rows back", async ({ page }) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-dots-"));
    try {
    const first = await startChat(page, "terminal", dir);
    const id = await startChat(page, "terminal", dir);
    const badges = page.getByTestId("session-dots").filter({ has: page.getByTestId(`workspace-session-${first}`) });
    const ids = () => badges.locator("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-testid")!.replace("workspace-session-", "")));
    expect(await ids()).toEqual([first, id]);
    await page.getByTestId(`tab-${id}`).dragTo(page.getByTestId(`tab-${first}`));
    await expect.poll(ids).toEqual([id, first]);
    await page.reload({ waitUntil: "networkidle" });
    await expect.poll(ids).toEqual([id, first]);
    const dot = page.getByTestId("session-dots").getByTestId(`workspace-session-${id}`);
    await expect(dot).toHaveClass(/workspace-entry__session--active/);
    await expect(page.locator(".workspace-entry__sessions")).toHaveCount(0);
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-sessions-list").click();
    await expect(page.getByTestId("session-dots")).toHaveCount(0);
    await expect(page.locator(".workspace-entry__sessions").getByTestId(`workspace-session-${id}`)).toBeVisible();
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-sessions-compact").click();
    await expect(page.getByTestId("session-dots").getByTestId(`workspace-session-${id}`)).toBeVisible();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("2b. held workspace shortcut modifiers reveal the matching numbers", async ({ page }, testInfo) => {
    const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-hints-")));
    const paths = [path.join(fixture, "first"), path.join(fixture, "second")];
    paths.forEach((dir) => fs.mkdirSync(dir));
    try {
      await open(page);
      for (const dir of paths) await addProject(page, dir);
      const entries = paths.map((dir) => page.locator(".workspace-entry").filter({ has: page.locator(`button[title="${dir}"]`) }));
      for (const entry of entries) await expect(entry).toBeVisible();
      const hints = page.locator('[data-testid^="workspace-shortcut-"]');
      await expect(hints).toHaveCount(0);
      const namesBefore = await Promise.all(entries.map((entry) => entry.locator("strong").boundingBox()));
      await page.keyboard.down("Control");
      await page.keyboard.down("Shift");
      for (const [index, entry] of entries.entries()) {
        const hint = entry.locator("kbd");
        await expect(hint).toBeVisible();
        await expect(hint).toHaveCSS("border-top-width", "0px");
        await expect(hint).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await expect(hint).toHaveCSS("color", "rgb(200, 200, 200)");
        const [rowBox, hintBox, nameBox] = await Promise.all([entry.boundingBox(), hint.boundingBox(), entry.locator("strong").boundingBox()]);
        expect(rowBox!.x + rowBox!.width - hintBox!.x - hintBox!.width).toBeCloseTo(12, 0);
        expect(nameBox).toEqual(namesBefore[index]); // hint does not shift/truncate the name
        await entry.hover();
        await expect(entry.getByTestId(/^workspace-project-new-session-/)).not.toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath("workspace-number-hints.png") });
      // Live palette changes must recolor already-visible hints without a remount.
      const originalAccent = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"));
      try {
        for (const [accent, color] of [["#bd93f9", "rgb(189, 147, 249)"], ["#076678", "rgb(7, 102, 120)"]]) {
          await page.evaluate((accent) => document.documentElement.style.setProperty("--accent", accent), accent);
          for (const entry of entries) await expect(entry.locator("kbd")).toHaveCSS("color", color);
        }
      } finally {
        await page.evaluate((accent) => document.documentElement.style.setProperty("--accent", accent), originalAccent);
      }
      const number = (await entries[0].locator("kbd").textContent())!;
      await page.keyboard.press(`Digit${number}`);
      await expect(entries[0].locator(".workspace-entry__button--active")).toBeVisible();
      await page.keyboard.up("Shift");
      await expect(hints).toHaveCount(0);
      await page.keyboard.up("Control");
      await page.keyboard.down("Shift"); // modifier order does not matter
      await page.keyboard.down("Control");
      await expect(entries[0].locator("kbd")).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(hints).toHaveCount(0);
      await page.keyboard.up("Control");
      await page.keyboard.up("Shift");
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("2b. returning to a workspace restores its last viewed tab", async ({ page }) => {
    const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-return-")));
    const paths = [path.join(fixture, "first"), path.join(fixture, "second")];
    paths.forEach((dir) => fs.mkdirSync(dir));
    try {
      await open(page);
      const older = await startChat(page, "terminal", paths[0]);
      const newer = await startChat(page, "terminal", paths[0]);
      await expect(page.getByTestId(`tab-${newer}`)).toHaveClass(/tab-bar__tab--active/);
      await page.getByTestId(`tab-${older}`).click();
      const other = await startChat(page, "terminal", paths[1]);
      await expect(page.getByTestId(`tab-${other}`)).toHaveClass(/tab-bar__tab--active/);
      const firstRow = page.locator(".workspace-entry").filter({ has: page.locator(`button[title="${paths[0]}"]`) });
      await firstRow.locator(".workspace-entry__button").click();
      await expect(page.getByTestId(`tab-${older}`)).toHaveClass(/tab-bar__tab--active/);
      await page.getByTestId(`workspace-session-${other}`).click();
      await page.keyboard.down("Control");
      await page.keyboard.down("Shift");
      const number = (await firstRow.locator("kbd").textContent())!;
      await page.keyboard.press(`Digit${number}`);
      await page.keyboard.up("Shift");
      await page.keyboard.up("Control");
      await expect(page.getByTestId(`tab-${older}`)).toHaveClass(/tab-bar__tab--active/);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
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
      const ring = tree.locator(".agent-status-dot");
      await expect(ring).toHaveAttribute("data-provider", "terminal");
      await expect(ring.locator("svg")).toBeVisible();
      // Navigation rows balance the session strip, without shrinking its hit targets.
      await expect(project.locator('[data-testid^="project-toggle-"] strong')).toHaveCSS("font-size", "14px");
      await expect(tree.locator("strong")).toHaveCSS("font-size", "13px");
      await expect(tree).toHaveCSS("border-radius", "6px");
      await expect(tree.getByTestId("workspace-checkout-icon")).toBeVisible();
      await expect(tree.getByTestId("workspace-checkout-icon").locator("circle")).toHaveCount(3);
      await expect(main.getByTestId("workspace-checkout-icon")).toBeVisible();
      await expect(main.getByTestId("workspace-checkout-icon").locator("circle")).toHaveCount(0);
      await expect(main.getByTestId("workspace-checkout-icon").locator("path")).toHaveAttribute("d", "M8 3l5 5-5 5-5-5z");
      await expect(project.getByTestId("project-folder-icon")).toBeVisible();
      await expect(project.locator(".workspace-tree__guide, [data-guide-end]")).toHaveCount(0);
      await expect(ring).toHaveCSS("width", "18px");
      await expect(ring).toHaveCSS("height", "18px");
      const target = tree.getByTestId(/^workspace-session-/);
      await expect(target).toHaveCSS("width", "32px");
      await expect(target).toHaveCSS("height", "32px");
      const nameRow = tree.locator(".workspace-entry__button");
      expect((await nameRow.boundingBox())!.height).toBeGreaterThanOrEqual(32);
      const strip = tree.getByTestId("session-dots");
      await expect(strip).toHaveCSS("border-top-color", "rgb(122, 122, 122)");
      await expect(strip).toHaveCSS("border-radius", "6px");
      // Selection still covers the strip's gutter, not just the name row.
      await expect(tree).toHaveCSS("background-color", "rgb(51, 51, 51)");
      const name = main.locator("strong");
      const branch = main.locator("span").filter({ hasText: /^main$/ }).last();
      const [nameBox, branchBox] = await Promise.all([name.boundingBox(), branch.boundingBox()]);
      const projectName = await project.locator('[data-testid^="project-toggle-"] strong').boundingBox();
      expect(Math.abs(nameBox!.x - projectName!.x)).toBeLessThanOrEqual(1);
      expect(branchBox!.x).toBeGreaterThan(nameBox!.x);
      expect(Math.abs(branchBox!.y - nameBox!.y)).toBeLessThan(8);
      // The centered session bar is a separate target; its border/blank space
      // does not navigate. The gutter alongside it still selects the workspace.
      const treeSession = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      const bar = main.getByTestId("session-dots");
      await bar.click({ position: { x: 120, y: 16 } });
      await expect(page.getByTestId(`tab-${treeSession}`)).toHaveClass(/tab-bar__tab--active/);
      await bar.click({ position: { x: 1, y: 1 } });
      await expect(page.getByTestId(`tab-${treeSession}`)).toHaveClass(/tab-bar__tab--active/);
      const [mainBox, barBox] = await Promise.all([main.boundingBox(), bar.boundingBox()]);
      expect(barBox!.width / mainBox!.width).toBeCloseTo(0.85, 1);
      expect(barBox!.x - mainBox!.x).toBeCloseTo((mainBox!.width - barBox!.width) / 2, 0);
      await main.click({ position: { x: 2, y: barBox!.y - mainBox!.y + 16 } });
      await expect(page.getByTestId(`tab-${mainSession}`)).toHaveClass(/tab-bar__tab--active/);
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
      const actions = mobileTree.getByTestId(/^workspace-pin-/).locator("..");
      const headerBox = await mobileTree.locator(".workspace-entry__button").boundingBox();
      const actionsBox = await actions.boundingBox();
      const sessionBox = await mobileSession.boundingBox();
      expect(actionsBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
      expect(sessionBox!.y).toBeGreaterThanOrEqual(actionsBox!.y + actionsBox!.height);
      await page.screenshot({ path: testInfo.outputPath("worktree-harness-rings-mobile.png") });
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("2d. Terminal badge follows manually launched Pi and keeps a tight circular highlight", async ({ page }, testInfo) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sidebar-manual-pi-"));
    try {
    const id = await startChat(page, "terminal", dir);
    const terminal = page.getByTestId("persistent-agent-terminal");
    const button = page.getByTestId(`workspace-session-${id}`);
    const ring = button.locator(".agent-status-dot");
    await expect(ring).toHaveAttribute("data-provider", "terminal");
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially("pi --provider anthropic --model claude-haiku-4-5 --no-extensions --no-skills --no-prompt-templates");
    await input.press("Enter");
    // No model prompt or turn. Check the banner/model before any input.
    await expect(terminal.locator(".xterm-rows")).toContainText("claude-haiku-4-5", { timeout: 30000 });
    await expect(ring).toHaveAttribute("data-provider", "pi", { timeout: 10000 });
    const style = await button.evaluate((element) => {
      const badge = element.querySelector(".agent-status-dot")!;
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
    expect(style.width).toBe(20);
    expect(style.height).toBe(20);
    expect(style.radius === "50%" || parseFloat(style.radius) >= 10).toBe(true);
    expect(style.outlineOffset).toBe("1px");
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

  test("2b. Organize sidebar: in one list shows every session flat", async ({ page }) => {
    await open(page);
    const id = await startChat(page);
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-organize-list").click();
    await expect(page.getByTestId("workspace-session-list").getByTestId(`workspace-session-${id}`)).toBeVisible();
    await expect(page.getByTestId("workspace-chats")).toHaveCount(0);
    await page.getByTestId("workspace-organize").click();
    await page.getByTestId("workspace-organize-project").click();
    await expect(page.getByTestId("workspace-session-list")).toHaveCount(0);
    await expect(page.getByTestId(`workspace-session-${id}`)).toBeVisible();
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
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
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
