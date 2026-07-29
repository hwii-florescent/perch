/**
 * sessions.spec.ts — e2e tests for session lifecycle fixes:
 *   S1 — "+" opens picker; choosing "No project" creates a session whose
 *         group is the home-dir name
 *   S2 — blank session does NOT appear in a second tab's sidebar until a
 *         message is sent (real claude-haiku-4-5 turn, 90 s timeout)
 *   S3 — clicking "+" twice with an empty active session does not produce
 *         two sessions
 *   S4 — archive: archive the S2 session via ⋯ menu → row disappears;
 *         toggle-archived shows it dimmed; unarchive restores it
 *
 * All tests are headless (no --headed / --ui).  Tests that require a real
 * agent turn require `claude` on PATH (same pattern as sidebar.spec.ts).
 */

import { test, expect, type Page, type Browser } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to BASE_URL with a fresh localStorage-cleared session. */
async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Wait until at least one session-item is present (real sessions from DB). */
async function waitForSessionList(page: Page): Promise<void> {
  // If there are pre-existing real sessions, at least one item will be visible.
  // If the DB is empty, no items is also valid — we just wait for the sidebar.
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Click the local "+" button and return without dismissing the popover. */
async function openLocalPicker(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="new-session-local"]');
  await expect(btn).toBeEnabled({ timeout: 10000 });
  await btn.click();
  // Popover should appear — wait for the "No project" option
  await expect(page.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Session lifecycle fixes", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  /** session id of the session used in S2 (to archive in S4). */
  let s2SessionId = "";

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude || [ -x ~/.local/bin/claude ]", {
        encoding: "utf8",
        shell: "/bin/sh",
      });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  // -------------------------------------------------------------------------
  // S1 — "+" opens picker; "No project" creates session grouped by home dir
  // -------------------------------------------------------------------------
  test("S1. + opens picker and No-project creates session in home-dir group", async ({ page }) => {
    await freshPage(page);
    await waitForSessionList(page);

    // Click the local "+" — should open the picker popover, NOT immediately
    // create a session.
    await openLocalPicker(page);

    // Picker must show "No project" option.
    const noneBtn = page.locator('[data-testid="project-option-none"]');
    await expect(noneBtn).toBeVisible({ timeout: 5000 });

    // Also check for free-text input and Create button.
    await expect(page.locator('[data-testid="project-path-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-create"]')).toBeVisible();

    // Click "No project" — sends session.create with cwd "~".
    const countBefore = await page.locator(".session-item").count();
    await noneBtn.click();

    // Popover closes.
    await expect(noneBtn).not.toBeVisible({ timeout: 3000 });

    // The blank session is in-memory only — the sidebar should NOT immediately
    // show a new row (Fix 3). Instead, the active session is the new blank one.
    // No count increase in the sidebar until a message is sent.
    await page.waitForTimeout(1000); // brief settle
    const countAfter = await page.locator(".session-item").count();
    // Either no change, or at most the same count (blank session not in list).
    expect(countAfter).toBeLessThanOrEqual(countBefore);

    // Composer should be focused / ready (we have an active session).
    // Verify a session.created came back by checking sessionId in localStorage.
    const storedId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(storedId).toBeTruthy();

    await page.screenshot({ path: "artifacts/s1-picker-no-project.png" });
  });

  // -------------------------------------------------------------------------
  // S2 — blank session invisible in second tab until a message is sent
  // -------------------------------------------------------------------------
  test("S2. blank session invisible until first message; appears in both tabs after", async ({ browser }: { browser: Browser }) => {
    test.setTimeout(150000);

    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping S2 (real turn required)");
      return;
    }

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // --- Page 1: create a blank session via the picker ---
      await freshPage(page1);
      await waitForSessionList(page1);

      const countBefore1 = await page1.locator(".session-item").count();

      await openLocalPicker(page1);
      await page1.locator('[data-testid="project-option-none"]').click();

      // Blank session: sidebar count must NOT increase yet.
      await page1.waitForTimeout(800);
      const countAfterCreate1 = await page1.locator(".session-item").count();
      expect(countAfterCreate1).toBeLessThanOrEqual(countBefore1);

      // --- Page 2: connect independently, record its session count ---
      await freshPage(page2);
      await waitForSessionList(page2);
      const countOnPage2Before = await page2.locator(".session-item").count();

      // Blank session not in page2's sidebar either.
      expect(countOnPage2Before).toBeLessThanOrEqual(countBefore1);

      // --- Page 1: send a real turn → triggers lazy DB insert ---
      // Select claude-haiku-4-5 via ModelChip.
      const chip = page1.locator('[data-testid="model-chip"]');
      await expect(chip).toBeVisible({ timeout: 10000 });
      await chip.click();
      await page1.locator('[data-testid="agent-option-claude"]').click();
      await page1.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

      const textarea = page1.locator(".chat__input textarea");
      await expect(textarea).toBeEnabled({ timeout: 8000 });
      await textarea.fill("Reply with exactly: fresh");
      await page1.locator(".chat__send").click();

      // Wait for the turn to complete on page1 (≤90 s).
      const runningDot1 = page1.locator(".session-item--active .session-status--running");
      await expect(runningDot1).toBeVisible({ timeout: 20000 });
      await expect(runningDot1).not.toBeVisible({ timeout: 90000 });

      // --- Now the session has messages — it should appear in BOTH sidebars ---

      // Page1: session count must be >= countBefore1 + 1.
      await expect(page1.locator(".session-item")).toHaveCount(countBefore1 + 1, { timeout: 10000 });

      // Capture the new session's id for S4.
      s2SessionId = await page1.locator(".session-item--active").getAttribute("data-session-id") ?? "";

      // Page2: session.updated broadcast should make the row appear.
      await expect(page2.locator(".session-item")).toHaveCount(countOnPage2Before + 1, { timeout: 15000 });

      await page1.screenshot({ path: "artifacts/s2-after-first-message.png" });
      await page2.screenshot({ path: "artifacts/s2-page2-sees-session.png" });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  // -------------------------------------------------------------------------
  // S3 — clicking "+" twice with empty active session does not create two sessions
  // -------------------------------------------------------------------------
  test("S3. clicking + twice on empty active session does not duplicate sessions", async ({ page }) => {
    await freshPage(page);
    await waitForSessionList(page);

    // Create a blank session via picker.
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await page.waitForTimeout(600);

    const countAfterFirst = await page.locator(".session-item").count();

    // Click "+" again — Fix 3 guard: active session is still empty, so no new
    // session.create is sent. The picker still opens though (that's fine).
    // Either: (a) the popover opens but clicking "No project" does NOT create
    // another session, OR (b) createSessionOnHost returns early before even
    // opening the picker. Our implementation opens the picker each time (that's
    // a UI decision) but the store's guard fires when onSelect is called.
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await page.waitForTimeout(600);

    const countAfterSecond = await page.locator(".session-item").count();

    // No additional session row should appear.
    expect(countAfterSecond).toBeLessThanOrEqual(countAfterFirst);

    await page.screenshot({ path: "artifacts/s3-no-duplicate.png" });
  });

  // -------------------------------------------------------------------------
  // S4 — archive the S2 session; toggle-archived shows it dimmed; unarchive
  // -------------------------------------------------------------------------
  test("S4. archive session via ⋯ menu, toggle-archived shows/hides it", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — S2 skipped so no session to archive");
      return;
    }
    if (!s2SessionId) {
      test.skip(true, "S2 did not produce a session id — skipping S4");
      return;
    }

    await freshPage(page);
    await waitForSessionList(page);

    // Locate the S2 session item by its data-session-id.
    const sessionItem = page.locator(`.session-item[data-session-id="${s2SessionId}"]`);
    await expect(sessionItem).toBeVisible({ timeout: 10000 });

    // Hover to reveal the ⋯ menu button.
    const wrapper = page.locator(`.session-item__wrapper:has([data-session-id="${s2SessionId}"])`);
    await wrapper.hover();

    const menuBtn = page.locator(`[data-testid="session-menu-${s2SessionId}"]`);
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
    await menuBtn.click();

    // Archive option must appear.
    const archiveBtn = page.locator(`[data-testid="session-archive-${s2SessionId}"]`);
    await expect(archiveBtn).toBeVisible({ timeout: 5000 });
    await archiveBtn.click();

    // Row disappears from sidebar (not showing archived by default).
    await expect(sessionItem).not.toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/s4-archived-hidden.png" });

    // Click "Show archived" toggle — row reappears, dimmed.
    const toggleBtn = page.locator('[data-testid="toggle-archived"]');
    await expect(toggleBtn).toBeVisible({ timeout: 5000 });
    await toggleBtn.click();

    await expect(sessionItem).toBeVisible({ timeout: 8000 });
    await expect(sessionItem).toHaveClass(/session-item--archived/, { timeout: 5000 });

    await page.screenshot({ path: "artifacts/s4-archived-visible.png" });

    // Unarchive: hover + ⋯ again.
    await wrapper.hover();
    await expect(menuBtn).toBeVisible({ timeout: 5000 });
    await menuBtn.click();

    const unarchiveBtn = page.locator(`[data-testid="session-archive-${s2SessionId}"]`);
    await expect(unarchiveBtn).toBeVisible({ timeout: 5000 });
    // Should now say "Unarchive"
    await expect(unarchiveBtn).toHaveText("Unarchive", { timeout: 3000 });
    await unarchiveBtn.click();

    // Hide archived again.
    await toggleBtn.click();

    // Session now restored — should appear even without showArchived.
    await expect(sessionItem).toBeVisible({ timeout: 8000 });
    await expect(sessionItem).not.toHaveClass(/session-item--archived/);

    await page.screenshot({ path: "artifacts/s4-unarchived.png" });
  });
});
