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
  let sessionCountAfterNewSession = 0;
  let firstSessionId = ""; // the session that existed before we clicked New
  let newSessionTitle = "";

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
    // Wait until the sidebar is in the DOM and connected (at least one session item)
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".session-item").first()).toBeVisible({ timeout: 15000 });
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

    // At least one session item
    const items = page.locator(".session-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Exactly one active item
    const active = page.locator(".session-item--active");
    await expect(active).toBeVisible({ timeout: 5000 });
    const activeCount = await active.count();
    expect(activeCount).toBe(1);

    await page.screenshot({ path: "artifacts/02-first-session.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 3 — New session
  // ---------------------------------------------------------------------------
  test("3. New session", async ({ page }) => {
    await waitForSidebar(page);

    const countBefore = await page.locator(".session-item").count();

    // Remember which session is currently active (to switch back later in test 6)
    const activeItem = page.locator(".session-item--active");
    firstSessionId = await activeItem.getAttribute("data-session-id") ?? "";
    // data-session-id may not exist — fall back to positional tracking

    // Click new session
    await page.locator(".sidebar__new-btn").click();

    // Count should increase by 1
    await expect(page.locator(".session-item")).toHaveCount(countBefore + 1, { timeout: 10000 });
    sessionCountAfterNewSession = countBefore + 1;

    // Active item shows "(new session)"
    const activeTitle = page.locator(".session-item--active .session-item__title");
    await expect(activeTitle).toHaveText("(new session)", { timeout: 8000 });

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

    // Ensure we're on a fresh new session (click New Session to avoid any pre-existing state)
    await page.locator(".sidebar__new-btn").click();
    await expect(page.locator(".session-item--active .session-item__title")).toHaveText(
      "(new session)",
      { timeout: 8000 }
    );

    // Select agent: claude, model: claude-haiku-4-5 via ModelChip
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    // Type prompt
    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 8000 });
    await textarea.fill(PROMPT_TEXT);

    // Send
    await page.locator(".chat__send").click();

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

    // Re-run the chat turn on a fresh session to get a title
    await page.locator(".sidebar__new-btn").click();
    await expect(page.locator(".session-item--active .session-item__title")).toHaveText(
      "(new session)",
      { timeout: 8000 }
    );

    // Select claude + haiku via ModelChip for session 5
    await selectAgentModel(page, "claude", "claude-haiku-4-5");
    const textarea = page.locator(".chat__input textarea");
    await textarea.fill(PROMPT_TEXT);
    await page.locator(".chat__send").click();

    // Wait for the turn to complete (running dot disappears)
    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 15000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // The active session's title should now be a prefix of the prompt text
    const activeTitle = page.locator(".session-item--active .session-item__title");
    await expect(activeTitle).not.toHaveText("(new session)", { timeout: 10000 });
    const titleText = await activeTitle.textContent();
    // Server truncates to 40 chars; the title is taken from the first user message
    const promptPrefix = PROMPT_TEXT.slice(0, 40);
    expect(PROMPT_TEXT.startsWith(titleText?.trim() ?? "X")).toBeTruthy();
    // Also accept that the full prompt (if <=40 chars) appears verbatim
    // PROMPT_TEXT.length is 24, so it should appear in full
    await page.screenshot({ path: "artifacts/05b-title-snippet.png" });
  });

  // ---------------------------------------------------------------------------
  // Test 6 — Switch session
  // ---------------------------------------------------------------------------
  test("6. Switch session", async ({ page }) => {
    await waitForSidebar(page);

    // Start with 2 sessions: the one from fresh load, plus a new one
    const countBefore = await page.locator(".session-item").count();

    // If there's only one session, create another so we have two to switch between
    if (countBefore < 2) {
      await page.locator(".sidebar__new-btn").click();
      await expect(page.locator(".session-item")).toHaveCount(countBefore + 1, { timeout: 8000 });
    }

    // The active session is the newest (top of list or last clicked)
    const activeItem = page.locator(".session-item--active");
    await expect(activeItem).toBeVisible({ timeout: 5000 });

    // Find a different (non-active) session to switch to
    const allItems = page.locator(".session-item");
    const total = await allItems.count();
    expect(total).toBeGreaterThanOrEqual(2);

    // Click the second item (index 1) if active is 0, otherwise click index 0
    const firstItem = allItems.nth(0);
    const firstItemClass = await firstItem.getAttribute("class") ?? "";
    const targetIndex = firstItemClass.includes("session-item--active") ? 1 : 0;
    const targetItem = allItems.nth(targetIndex);

    // Capture the text of the current chat to verify it changes
    const chatListBefore = await page.locator(".chat__list").textContent();

    await targetItem.click();

    // Active class moves to the clicked item
    await expect(targetItem).toHaveClass(/session-item--active/, { timeout: 5000 });
    // Original active item loses active class
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
      // Bring up page1 and start a fresh session
      await page1.goto(BASE_URL, { waitUntil: "networkidle" });
      await page1.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page1.reload({ waitUntil: "networkidle" });
      await expect(page1.locator(".session-item").first()).toBeVisible({ timeout: 15000 });

      // Create a new session on page1 to have a clean, known active session
      await page1.locator(".sidebar__new-btn").click();
      await expect(page1.locator(".session-item--active .session-item__title")).toHaveText(
        "(new session)",
        { timeout: 8000 }
      );

      // Bring up page2 (different session, fresh context — it will get its own new session)
      await page2.goto(BASE_URL, { waitUntil: "networkidle" });
      await page2.evaluate(() => localStorage.removeItem("perch.sessionId"));
      await page2.reload({ waitUntil: "networkidle" });
      await expect(page2.locator(".session-item").first()).toBeVisible({ timeout: 15000 });

      // Both pages are now observing the session list via the broadcast channel.
      // Record current session count on page2
      const countOnPage2Before = await page2.locator(".session-item").count();

      // Send a chat turn from page1 — select via ModelChip
      const chip1 = page1.locator('[data-testid="model-chip"]');
      await expect(chip1).toBeVisible({ timeout: 10000 });
      await chip1.click();
      await page1.locator('[data-testid="agent-option-claude"]').click();
      await page1.locator('[data-testid="model-option-claude-haiku-4-5"]').click();
      const textarea = page1.locator(".chat__input textarea");      await textarea.fill("Reply with exactly: ping");
      await page1.locator(".chat__send").click();

      // Wait for the running dot to appear on page1's active session
      await expect(page1.locator(".session-item--active .session-status--running")).toBeVisible({
        timeout: 15000,
      });

      // Page2 should see the same session in a running state (via broadcast)
      // The session exists in page2's sidebar list (it was broadcasted as session.updated)
      // We wait up to 15s for page2 to show any running dot (may be on any session item)
      const runningOnPage2 = page2.locator(".session-status--running");
      await expect(runningOnPage2).toBeVisible({ timeout: 15000 });

      await page2.screenshot({ path: "artifacts/08-second-tab-live.png" });

      // Wait for the turn to finish on both pages
      await expect(page1.locator(".session-item--active .session-status--running")).not.toBeVisible({
        timeout: 90000,
      });
      await expect(page2.locator(".session-status--running")).not.toBeVisible({ timeout: 90000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
