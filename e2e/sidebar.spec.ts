/**
 * sidebar.spec.ts — Playwright e2e suite for the perch session sidebar.
 *
 * Stages A (Rust core: session.list / session.updated / server.info) and
 * B (web sidebar UI) are assumed done and built.  This file covers Stage C.
 *
 * Strategy
 * --------
 * - Single chromium worker, serial describe block (test.describe.configure).
 * - Real HOME so the claude CLI can authenticate.  Pre-existing sessions are
 *   accepted — tests assert on *relative* count changes and *specific* new
 *   items, never on absolute counts.
 * - localStorage "perch.sessionId" is cleared + page reloaded at the start
 *   to force a deterministic new session from the server.
 * - Test 4 (chat turn) requires a working `claude` binary on PATH.  If it is
 *   absent the test is skipped.  Tests 5-7 that depend on test 4 are also
 *   skipped in that case.
 *
 * Stage C note: agent/model selects replaced by ModelChip. Tests 4/5/7 now
 * drive the chip (click model-chip, click agent-option-claude, click
 * model-option-claude-haiku-4-5) instead of using [aria-label] selects.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BASE_URL = "http://127.0.0.1:7799";
const PROMPT_TEXT = "Reply with exactly: pong";

// ---------------------------------------------------------------------------
// Helper: select agent + model via the ModelChip popover (Stage C)
// ---------------------------------------------------------------------------
async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
  // Popover closes automatically on model select
}

// ---------------------------------------------------------------------------
// Serial block — all tests share execution order guarantees.
// ---------------------------------------------------------------------------
test.describe("Perch sidebar", () => {
  test.describe.configure({ mode: "serial" });

  // Shared state across the serial block
  let claudeAvailable = false;

  // ---------------------------------------------------------------------------
  // Setup: fresh session before the suite runs
  // ---------------------------------------------------------------------------
  test.beforeAll(async () => {
    // Check claude binary availability once.
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Helper: wait for sidebar + WS connection
  // ---------------------------------------------------------------------------
  async function waitForSidebar(page: Page): Promise<void> {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    // Clear stored session so we always start fresh
    await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
    await page.reload({ waitUntil: "networkidle" });
    // Wait until the sidebar is in the DOM and connected.
    // NOTE: With Fix 3 (lazy DB insert) the sidebar may have zero session items
    // on a fresh DB — do NOT wait for .session-item here.
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
  }

  // ---------------------------------------------------------------------------
  // Helper: open the local picker and choose "No project"
  // ---------------------------------------------------------------------------
  async function createSessionViaPicker(page: Page): Promise<void> {
    const newBtn = page.locator('[data-testid="new-session-local"]');
    await expect(newBtn).toBeEnabled({ timeout: 10000 });
    await newBtn.click();
    const noneOpt = page.locator('[data-testid="project-option-none"]');
    await expect(noneOpt).toBeVisible({ timeout: 5000 });
    await noneOpt.click();
    // Popover closes; active session is now blank (not in sidebar list yet)
    await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  }

  // ---------------------------------------------------------------------------
  // Test 1 — Load + env header
  // ---------------------------------------------------------------------------
  test("1. Load + env header", async ({ page }) => {
    await waitForSidebar(page);

    // Sidebar visible
    await expect(page.locator(".sidebar")).toBeVisible();

    // Env badge must be LOCAL — baseURL is 127.0.0.1 and there's no SSH_CONNECTION
    const badge = page.locator(".sidebar__env-badge");
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toHaveText("LOCAL", { timeout: 5000 });

    // Hostname must be non-empty
    const host = page.locator(".sidebar__env-host");
    await expect(host).toBeVisible({ timeout: 5000 });
    const hostText = await host.textContent();
    expect(hostText?.trim().length).toBeGreaterThan(0);

    // CWD shown
    const cwd = page.locator(".sidebar__env-cwd");
    await expect(cwd).toBeVisible({ timeout: 5000 });
    const cwdText = await cwd.textContent();
    expect(cwdText?.trim().length).toBeGreaterThan(0);

    await page.screenshot({ path: "artifacts/01-load-env-header.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 2 — First session listed + active
  // ---------------------------------------------------------------------------
  test("2. First session listed + active", async ({ page }) => {
    await waitForSidebar(page);

    // New design (lazy DB insert): fresh page load may show zero .session-item
    // rows if the DB has no persisted sessions.  The composer must still be
    // usable.  Assert the empty-sidebar state first, then seed a session via
    // picker + message and confirm the row appears and is --active.

    // Composer must be available (model chip visible → hosted mode active).
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 15000 });

    // Seed a persisted session so we can verify the sidebar row behaviour.
    await createSessionViaPicker(page);

    // Blank session is NOT in the sidebar yet.
    await page.waitForTimeout(500);
    const countAfterCreate = await page.locator(".session-item").count();

    // Now send a message to trigger the lazy DB insert.
    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 8000 });
    await textarea.fill("sidebar-test2-seed-" + Date.now());
    await page.locator(".chat__send").click();

    // Row must appear after first message.
    await expect(page.locator(".session-item")).toHaveCount(countAfterCreate + 1, { timeout: 10000 });

    // Exactly one active item.
    const active = page.locator(".session-item--active");
    await expect(active).toBeVisible({ timeout: 5000 });
    const activeCount = await active.count();
    expect(activeCount).toBe(1);

    await page.screenshot({ path: "artifacts/02-first-session.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 3 — New session (via picker)
  // ---------------------------------------------------------------------------
  test("3. New session via picker", async ({ page }) => {
    await waitForSidebar(page);

    const countBefore = await page.locator(".session-item").count();

    // Open picker and choose "No project" — Fix 3: blank session is NOT inserted
    // into the DB yet, so the sidebar count must NOT increase immediately.
    await createSessionViaPicker(page);

    // Brief settle — count must stay ≤ countBefore (blank session not in list).
    await page.waitForTimeout(800);
    const countAfterCreate = await page.locator(".session-item").count();
    expect(countAfterCreate).toBeLessThanOrEqual(countBefore);

    // The composer must be ready (active in-memory session assigned).
    const storedId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(storedId).toBeTruthy();

    await page.screenshot({ path: "artifacts/03-new-session.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Chat turn → running → idle indicator
  // ---------------------------------------------------------------------------
  test("4. Chat turn → running → idle", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found on PATH — skipping real chat turn tests");
      return;
    }

    await waitForSidebar(page);

    // Create a fresh session via picker (blank — not in sidebar until first message).
    await createSessionViaPicker(page);

    const countBeforeMsg = await page.locator(".session-item").count();

    // Select agent: claude, model: claude-haiku-4-5 via ModelChip
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    // Type prompt
    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 8000 });
    await textarea.fill(PROMPT_TEXT);

    // Send — this triggers the lazy DB insert.
    await page.locator(".chat__send").click();

    // Session now has a message → should appear in sidebar.
    await expect(page.locator(".session-item")).toHaveCount(countBeforeMsg + 1, { timeout: 10000 });

    // Expect running indicator to appear on the active session item
    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: "artifacts/04-running.png" });

    // Expect it to disappear (idle) and a non-empty assistant message to appear
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    const assistantMsg = page.locator(".message--assistant").last();
    await expect(assistantMsg).toBeVisible({ timeout: 10000 });
    const msgText = await assistantMsg.textContent();
    expect(msgText?.trim().length).toBeGreaterThan(0);

    await page.screenshot({ path: "artifacts/05-done.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 5 — Title snippet
  // ---------------------------------------------------------------------------
  test("5. Title snippet after chat turn", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping (depends on test 4)");
      return;
    }

    await waitForSidebar(page);

    // Create a fresh session via picker, then send a message to trigger DB insert.
    await createSessionViaPicker(page);
    const countBeforeMsg = await page.locator(".session-item").count();

    // Select claude + haiku via ModelChip for session 5
    await selectAgentModel(page, "claude", "claude-haiku-4-5");
    const textarea = page.locator(".chat__input textarea");
    await textarea.fill(PROMPT_TEXT);
    await page.locator(".chat__send").click();

    // Session appears in sidebar after first message.
    await expect(page.locator(".session-item")).toHaveCount(countBeforeMsg + 1, { timeout: 10000 });

    // Wait for the turn to complete (running dot disappears)
    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 15000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // The active session's title should now be a prefix of the prompt text
    const activeTitle = page.locator(".session-item--active .session-item__title");
    await expect(activeTitle).not.toHaveText("(new session)", { timeout: 10000 });
    const titleText = await activeTitle.textContent();
    // Server truncates to 40 chars; the title is taken from the first user message
    // PROMPT_TEXT.length is 24, so it should appear in full
    expect(PROMPT_TEXT.startsWith(titleText?.trim() ?? "X")).toBeTruthy();
    await page.screenshot({ path: "artifacts/05b-title-snippet.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 6 — Switch session
  // ---------------------------------------------------------------------------
  test("6. Switch session", async ({ page }) => {
    await waitForSidebar(page);

    // Count persisted sessions (only those with messages appear — Fix 3).
    let countBefore = await page.locator(".session-item").count();

    // If there's only one (or zero) visible session we need another persisted one.
    // Create a session via picker and send a short message so it persists.
    if (countBefore < 2) {
      await createSessionViaPicker(page);
      if (!claudeAvailable) {
        test.skip(true, "claude binary not found — need 2 persisted sessions to switch");
        return;
      }
      await selectAgentModel(page, "claude", "claude-haiku-4-5");
      const ta = page.locator(".chat__input textarea");
      await ta.fill("Reply with exactly: switch-ready");
      await page.locator(".chat__send").click();
      // Wait for the new session to appear in the sidebar.
      await expect(page.locator(".session-item")).toHaveCount(countBefore + 1, { timeout: 10000 });
      const runningDot = page.locator(".session-item--active .session-status--running");
      await expect(runningDot).toBeVisible({ timeout: 15000 });
      await expect(runningDot).not.toBeVisible({ timeout: 90000 });
      countBefore = await page.locator(".session-item").count();
    }

    const allItems = page.locator(".session-item");
    const total = await allItems.count();
    expect(total).toBeGreaterThanOrEqual(2);

    // After a fresh page load without a stored session ID there may be no --active
    // item. Click the first row to establish an active session.
    let activeItem = page.locator(".session-item--active");
    const hasActive = await activeItem.count();
    if (hasActive === 0) {
      await allItems.nth(0).click();
      await expect(allItems.nth(0)).toHaveClass(/session-item--active/, { timeout: 5000 });
    }

    // Now find a non-active item to switch to.
    const firstItem = allItems.nth(0);
    const firstItemClass = await firstItem.getAttribute("class") ?? "";
    const targetIndex = firstItemClass.includes("session-item--active") ? 1 : 0;
    const targetItem = allItems.nth(targetIndex);

    await targetItem.click();

    // Active class moves to the clicked item
    await expect(targetItem).toHaveClass(/session-item--active/, { timeout: 5000 });
    // Exactly one active item
    const newActiveCount = await page.locator(".session-item--active").count();
    expect(newActiveCount).toBe(1);

    await page.screenshot({ path: "artifacts/06-switched.png" });

    // Switch back to original active
    const originalActiveIndex = targetIndex === 0 ? 1 : 0;
    const originalItem = page.locator(".session-item").nth(originalActiveIndex);
    await originalItem.click();
    await expect(originalItem).toHaveClass(/session-item--active/, { timeout: 5000 });

    await page.screenshot({ path: "artifacts/07-switched-back.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 7 — Live update across connections (broadcast path)
  // ---------------------------------------------------------------------------
  test("7. Live update across connections", async ({ browser }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping live-update test (depends on test 4)");
      return;
    }

    // Open two independent contexts (two browser tabs)
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // Bring up page1 and start a fresh session via picker.
      await page1.goto(BASE_URL, { waitUntil: "networkidle" });
      await page1.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page1.reload({ waitUntil: "networkidle" });
      await expect(page1.locator(".sidebar")).toBeVisible({ timeout: 15000 });

      // Create a blank session via picker (not in sidebar until message sent).
      const newBtn1 = page1.locator('[data-testid="new-session-local"]');
      await expect(newBtn1).toBeEnabled({ timeout: 10000 });
      await newBtn1.click();
      const noneOpt1 = page1.locator('[data-testid="project-option-none"]');
      await expect(noneOpt1).toBeVisible({ timeout: 5000 });
      await noneOpt1.click();
      await expect(noneOpt1).not.toBeVisible({ timeout: 3000 });

      const countOnPage1Before = await page1.locator(".session-item").count();

      // Bring up page2 (different session, fresh context).
      await page2.goto(BASE_URL, { waitUntil: "networkidle" });
      await page2.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page2.reload({ waitUntil: "networkidle" });
      await expect(page2.locator(".sidebar")).toBeVisible({ timeout: 15000 });

      // Both pages are now observing the session list via the broadcast channel.
      // Record current session count on page2.
      const countOnPage2Before = await page2.locator(".session-item").count();

      // Send a chat turn from page1 — select via ModelChip.
      const chip1 = page1.locator('[data-testid="model-chip"]');
      await expect(chip1).toBeVisible({ timeout: 10000 });
      await chip1.click();
      await page1.locator('[data-testid="agent-option-claude"]').click();
      await page1.locator('[data-testid="model-option-claude-haiku-4-5"]').click();
      const textarea = page1.locator(".chat__input textarea");
      await textarea.fill("Reply with exactly: ping");
      await page1.locator(".chat__send").click();

      // After first message the session appears in page1's sidebar.
      await expect(page1.locator(".session-item")).toHaveCount(countOnPage1Before + 1, { timeout: 10000 });

      // Wait for the running dot to appear on page1's active session.
      await expect(page1.locator(".session-item--active .session-status--running")).toBeVisible({
        timeout: 15000,
      });

      // Capture the new session's id so we can scope page2's locator precisely.
      const newSessionId = await page1.locator(".session-item--active").getAttribute("data-session-id");

      // Page2 should see the same session in a running state (via broadcast).
      await expect(page2.locator(".session-item")).toHaveCount(countOnPage2Before + 1, { timeout: 15000 });
      const sessionOnPage2 = newSessionId
        ? page2.locator(`.session-item[data-session-id="${newSessionId}"]`)
        : page2.locator(".session-item").last();
      const runningOnPage2 = sessionOnPage2.locator(".session-status--running");
      await expect(runningOnPage2).toBeVisible({ timeout: 15000 });

      await page2.screenshot({ path: "artifacts/08-second-tab-live.png" });

      // Wait for the turn to finish on both pages.
      await expect(page1.locator(".session-item--active .session-status--running")).not.toBeVisible({
        timeout: 90000,
      });
      await expect(runningOnPage2).not.toBeVisible({ timeout: 90000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
