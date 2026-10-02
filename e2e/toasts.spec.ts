/**
 * toasts.spec.ts — Playwright e2e suite for Phase 6's "session finished"
 * toast notifications.
 *
 * See `packages/web/src/store.ts` (`session.updated` handler, `toasts` state)
 * and `packages/web/src/components/Toast.tsx` for the client-side logic: a
 * toast is derived purely from observing a running→idle transition on a
 * session that isn't the one currently being viewed by *this* connection —
 * no native OS `Notification` API is involved (out of scope for Phase 6).
 *
 * Follows the conventions of status-glyphs.spec.ts: single chromium worker,
 * serial describe block, real HOME so the `claude` CLI can authenticate,
 * tests skipped when the `claude` binary is unavailable.
 */

import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";
const PROMPT_TEXT = "Run the shell command `sleep 8`, then reply with exactly: pong";

async function waitForSidebar(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Starts a real Claude turn in session A, then switches away to a new
 * session B before the turn completes, so this connection is no longer
 * viewing A when it finishes. Returns session A's id. */
async function startTurnThenSwitchAway(page: Page): Promise<string> {
  const sessionAId = await startChat(page, "claude");
  const terminal = page.getByTestId("persistent-agent-terminal");
  await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
  const input = terminal.locator(".xterm-helper-textarea");
  await input.pressSequentially(PROMPT_TEXT);
  await input.press("Enter");
  await startChat(page);
  return sessionAId;
}

test.describe("Session-finished toasts", () => {
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

  // ---------------------------------------------------------------------------
  // TN1 — finishing a turn in a non-active session shows a toast.
  // ---------------------------------------------------------------------------
  test("TN1. Finishing a turn in a non-active session shows a toast", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping (depends on a real chat turn)");
      return;
    }

    await waitForSidebar(page);
    const sessionAId = await startTurnThenSwitchAway(page);

    const toastStack = page.locator('[data-testid="toast"]');
    const toast = page.locator(`[data-testid="toast-${sessionAId}"]`);
    await expect(toastStack).toBeVisible({ timeout: 90000 });
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText("finished");

    await page.screenshot({ path: "artifacts/toasts-tn1-shown.png" });
  });

  // ---------------------------------------------------------------------------
  // TN2 — clicking a toast switches to that session and dismisses the toast.
  // ---------------------------------------------------------------------------
  test("TN2. Clicking a toast switches session and dismisses it", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping (depends on a real chat turn)");
      return;
    }

    await waitForSidebar(page);
    const sessionAId = await startTurnThenSwitchAway(page);

    const toast = page.locator(`[data-testid="toast-${sessionAId}"]`);
    await expect(toast).toBeVisible({ timeout: 90000 });

    await toast.click();

    // Clicking switches to session A...
    await expect.poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(sessionAId);
    // ...and dismisses the toast immediately.
    await expect(toast).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "artifacts/toasts-tn2-clicked.png" });
  });
});
