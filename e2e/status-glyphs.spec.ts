/**
 * status-glyphs.spec.ts — Playwright e2e suite for the herdr-parity status
 * glyph system (Phase 2: unseen/blocked tracking + static dots).
 *
 * See `packages/web/src/statusDot.ts` for the state → glyph/color mapping and
 * `crates/perch-core/src/server.rs` (`session_viewers`/`unseen_sessions`) for
 * the server-side "seen" tracking this exercises.
 *
 * Follows the conventions of sidebar.spec.ts: single chromium worker, serial
 * describe block, real HOME so the `claude` CLI can authenticate, tests
 * skipped when the `claude` binary is unavailable.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";
const PROMPT_TEXT = "Reply with exactly: pong";

async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
}

test.describe("Status glyph system", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  async function waitForSidebar(page: Page): Promise<void> {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
  }

  async function createSessionViaPicker(page: Page): Promise<void> {
    const newBtn = page.locator('[data-testid="new-session-local"]');
    await expect(newBtn).toBeEnabled({ timeout: 10000 });
    await newBtn.click();
    const noneOpt = page.locator('[data-testid="project-option-none"]');
    await expect(noneOpt).toBeVisible({ timeout: 5000 });
    await noneOpt.click();
    await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  }

  // ---------------------------------------------------------------------------
  // G1 — a blank/new session shows the idle (hollow green) dot correctly.
  // ---------------------------------------------------------------------------
  test("G1. Blank session shows idle dot", async ({ page }) => {
    await waitForSidebar(page);
    await createSessionViaPicker(page);

    // Blank session isn't in the sidebar list yet (lazy DB insert), but it is
    // the active session, so the status bar must render its dot as idle.
    const dot = page.locator(".status-bar .agent-status-dot");
    await expect(dot).toBeVisible({ timeout: 5000 });
    await expect(dot).toHaveClass(/agent-status-dot--idle/);
    await expect(dot).toContainText("○");

    const color = await dot.evaluate((el) => getComputedStyle(el).color);
    // var(--green) — just assert it resolved to *some* concrete color, not
    // the raw custom-property string (i.e. the token actually applied).
    expect(color).not.toBe("");
    expect(color.startsWith("var(")).toBeFalsy();

    await page.screenshot({ path: "artifacts/status-glyphs-g1-idle.png" });
  });

  // ---------------------------------------------------------------------------
  // G2 — sending a message flips the dot to a static yellow "working" glyph
  // (no animation — herdr's dots never pulse).
  // ---------------------------------------------------------------------------
  test("G2. Running turn shows static working dot", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found on PATH — skipping real chat turn test");
      return;
    }

    await waitForSidebar(page);
    await createSessionViaPicker(page);
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 8000 });
    await textarea.fill(PROMPT_TEXT);
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .agent-status-dot--working");
    await expect(runningDot).toBeVisible({ timeout: 15000 });
    await expect(runningDot).toContainText("●");

    // Hard requirement: static, not pulsing.
    const animationName = await runningDot.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe("none");

    // Legacy alias class must still be present for older selectors.
    await expect(page.locator(".session-item--active .session-status--running")).toBeVisible();

    await page.screenshot({ path: "artifacts/status-glyphs-g2-working.png" });

    // Let the turn finish so it doesn't bleed into later tests/specs.
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });
  });

  // ---------------------------------------------------------------------------
  // G3 — two-tab test: a session finishes its turn while unseen (no client is
  // actively viewing it) → shows the teal "done" dot to an observer on another
  // tab, until that observer clicks into it, at which point it flips to the
  // hollow green "idle" dot.
  // ---------------------------------------------------------------------------
  test("G3. Unseen completion shows done dot until viewed", async ({ browser }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping (depends on a real chat turn)");
      return;
    }

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // Page1: create session A and kick off a turn.
      await page1.goto(BASE_URL, { waitUntil: "networkidle" });
      await page1.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page1.reload({ waitUntil: "networkidle" });
      await expect(page1.locator(".sidebar")).toBeVisible({ timeout: 15000 });

      const newBtn1 = page1.locator('[data-testid="new-session-local"]');
      await expect(newBtn1).toBeEnabled({ timeout: 10000 });
      await newBtn1.click();
      const noneOpt1 = page1.locator('[data-testid="project-option-none"]');
      await expect(noneOpt1).toBeVisible({ timeout: 5000 });
      await noneOpt1.click();
      await expect(noneOpt1).not.toBeVisible({ timeout: 3000 });

      const countOnPage1Before = await page1.locator(".session-item").count();

      const chip1 = page1.locator('[data-testid="model-chip"]');
      await expect(chip1).toBeVisible({ timeout: 10000 });
      await chip1.click();
      await page1.locator('[data-testid="agent-option-claude"]').click();
      await page1.locator('[data-testid="model-option-claude-haiku-4-5"]').click();
      const textarea1 = page1.locator(".chat__input textarea");
      await textarea1.fill(PROMPT_TEXT);
      await page1.locator(".chat__send").click();

      // Session A now has a message → appears in page1's sidebar.
      await expect(page1.locator(".session-item")).toHaveCount(countOnPage1Before + 1, { timeout: 10000 });
      await expect(page1.locator(".session-item--active .agent-status-dot--working")).toBeVisible({
        timeout: 15000,
      });
      const sessionAId = await page1.locator(".session-item--active").getAttribute("data-session-id");
      expect(sessionAId).toBeTruthy();

      // Page1 switches away from session A to a brand-new blank session B —
      // nobody is now actively viewing A on any connection.
      await page1.locator('[data-testid="new-session-local"]').click();
      await expect(page1.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
      await page1.locator('[data-testid="project-option-none"]').click();
      await expect(page1.locator('[data-testid="project-option-none"]')).not.toBeVisible({ timeout: 3000 });

      // Page2: a different tab/connection with a different session (C) active.
      await page2.goto(BASE_URL, { waitUntil: "networkidle" });
      await page2.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page2.reload({ waitUntil: "networkidle" });
      await expect(page2.locator(".sidebar")).toBeVisible({ timeout: 15000 });
      await createSessionViaPicker(page2);

      // Wait for session A's turn to complete. Page2 observes the broadcast
      // and, since nobody viewed A while it finished, must render it "done"
      // (teal, filled) rather than plain idle (green, hollow).
      const rowOnPage2 = page2.locator(`.session-item[data-session-id="${sessionAId}"]`);
      await expect(rowOnPage2).toBeVisible({ timeout: 15000 });
      const doneDot = rowOnPage2.locator(".agent-status-dot--done");
      await expect(doneDot).toBeVisible({ timeout: 90000 });
      await expect(doneDot).toContainText("●");
      // Still must not be idle yet.
      await expect(rowOnPage2.locator(".agent-status-dot--idle")).toHaveCount(0);

      await page2.screenshot({ path: "artifacts/status-glyphs-g3-done.png" });

      // Click into session A on page2 — this "views" it, clearing unseen.
      await rowOnPage2.click();
      await expect(rowOnPage2).toHaveClass(/session-item--active/, { timeout: 5000 });
      await expect(rowOnPage2.locator(".agent-status-dot--idle")).toBeVisible({ timeout: 10000 });
      await expect(rowOnPage2.locator(".agent-status-dot--done")).toHaveCount(0);

      await page2.screenshot({ path: "artifacts/status-glyphs-g3-idle-after-view.png" });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
