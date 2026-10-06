/**
 * status-glyphs.spec.ts — the herdr-parity status dots (static glyphs, with
 * unseen "done" tracking). See `packages/web/src/statusDot.ts` for the state
 * → glyph/color mapping and the server's `session_viewers`/`unseen_sessions`
 * for the "seen" tracking this exercises.
 */

import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

const SLOW_PROMPT = "Run the shell command `sleep 8`, then reply with exactly: pong";

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
}

/** Start Claude in Chats and send it a turn that lasts a few seconds. */
async function startSlowTurn(page: Page): Promise<string> {
  const sessionId = await startChat(page, "claude");
  const terminal = page.getByTestId("persistent-agent-terminal");
  await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
  const input = terminal.locator(".xterm-helper-textarea");
  await input.pressSequentially(SLOW_PROMPT);
  await input.press("Enter");
  return sessionId;
}

test.describe("Status glyph system", () => {
  test.describe.configure({ mode: "serial" });

  test("G1. a new session shows the idle dot", async ({ page }) => {
    await open(page);
    await startChat(page);
    const dot = page.locator(".status-bar .agent-status-dot");
    await expect(dot).toHaveClass(/agent-status-dot--idle/);
    await expect(dot).toHaveAttribute("data-provider", "terminal");
    await expect(dot.locator("svg")).toBeVisible();
    const color = await dot.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe("");
    expect(color.startsWith("var(")).toBeFalsy();
  });

  test("G2. a running turn shows a static working dot", async ({ page }) => {
    await open(page);
    const sessionId = await startSlowTurn(page);
    const working = page.getByTestId(`workspace-session-${sessionId}`).locator(".agent-status-dot--working");
    await expect(working).toBeVisible({ timeout: 15_000 });
    await expect(working).toHaveAttribute("data-provider", "claude");
    await expect(working.locator("svg")).toBeVisible();
    expect(await working.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expect(working).not.toBeVisible({ timeout: 90_000 });
  });

  test("G3. an unseen completion shows the done dot until viewed", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    try {
      const page1 = await ctx1.newPage();
      await open(page1);
      const sessionId = await startSlowTurn(page1);
      // Page1 moves on, so nobody is viewing the session when it finishes.
      await startChat(page1);

      const page2 = await ctx2.newPage();
      await open(page2);
      await startChat(page2);
      const row = page2.getByTestId(`workspace-session-${sessionId}`);
      const done = row.locator(".agent-status-dot--done");
      await expect(done).toBeVisible({ timeout: 90_000 });
      await expect(done.locator("svg")).toBeVisible();

      await row.click();
      await expect(row.locator(".agent-status-dot--idle")).toBeVisible({ timeout: 10_000 });
      await expect(done).toHaveCount(0);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
