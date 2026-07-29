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

const BASE_URL = "http://127.0.0.1:7799";
const PROMPT_TEXT = "Reply with exactly: pong";

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

/** Creates session A, kicks off a real chat turn, then switches away to a
 * brand-new session B before the turn completes — so this connection is no
 * longer viewing A when it finishes. Returns session A's id. */
async function startTurnThenSwitchAway(page: Page): Promise<string> {
  await createSessionViaPicker(page);

  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator('[data-testid="agent-option-claude"]').click();
  await page.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill(PROMPT_TEXT);
  await page.locator(".chat__send").click();

  await expect(page.locator(".session-item--active .agent-status-dot--working")).toBeVisible({
    timeout: 15000,
  });
  const sessionAId = await page.locator(".session-item--active").getAttribute("data-session-id");
  expect(sessionAId).toBeTruthy();

  // Switch away to a fresh session B — this connection no longer views A.
  await createSessionViaPicker(page);
  // Note: session B is a freshly created, message-less session, so (per
  // server.rs's ChatSend "Fix 3" lazy-DB-insert design) it won't render its
  // own `.session-item` row until a message is sent to it — meaning
  // `.session-item--active` may legitimately match ZERO elements right after
  // the switch. `expect(locator).not.toHaveAttribute(...)` requires an
  // element to inspect and fails with "element(s) not found" in that case,
  // so scope the locator to A's id specifically and assert its count is 0 —
  // that correctly treats "no active row at all" and "a different row is
  // active" as both passing, and only "A's row is still active" as failing.
  await expect(
    page.locator(`.session-item--active[data-session-id="${sessionAId}"]`),
  ).toHaveCount(0);

  return sessionAId!;
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
    await expect(page.locator(".session-item--active")).toHaveAttribute(
      "data-session-id",
      sessionAId,
    );
    // ...and dismisses the toast immediately.
    await expect(toast).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "artifacts/toasts-tn2-clicked.png" });
  });
});
