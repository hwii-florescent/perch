/**
 * sidebar.spec.ts — the sidebar's env header and its workspace session rows
 * (`WorkspaceOverview`): a started session is listed and active, is titled
 * after its first prompt, switches on click, and appears live on another
 * connection.
 */
import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

test.describe("Perch sidebar", () => {
  test("1. Load + env header", async ({ page }) => {
    await open(page);
    await expect(page.locator(".sidebar__env-badge")).toHaveText("LOCAL", { timeout: 10000 });
    expect((await page.locator(".sidebar__env-host").textContent())?.trim()).toBeTruthy();
    expect((await page.locator(".sidebar__env-cwd").textContent())?.trim()).toBeTruthy();
  });

  test("2. a started session is listed and active", async ({ page }) => {
    await open(page);
    const id = await startChat(page);
    await expect(page.getByTestId(`workspace-session-${id}`)).toHaveClass(/workspace-entry__session--active/);
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
