/**
 * responsive.spec.ts — e2e tests for Phase 5's narrow-width collapse: below
 * `MOBILE_WIDTH_BREAKPOINT` (700px, see `responsive.ts`), `App.tsx` swaps the
 * desktop `<Sidebar/>`+`<TabBar/>` chrome for `<MobileHeader/>`+
 * `<MobileSwitcher/>` while the dockview area and `<StatusBar/>` stay
 * mounted unchanged.
 *
 *   R1 — at <=700px, the sidebar and tab bar are hidden and the mobile
 *        header is shown instead.
 *   R2 — tapping the mobile header's "Switch" button opens the slide-over.
 *   R3 — selecting a session from the slide-over switches to it and closes
 *        the slide-over (requires two real, persisted sessions — see
 *        `claudeAvailable` gate below, same pattern as workspace-tabs.spec.ts).
 *   R4 — at a normal desktop viewport, none of the mobile chrome renders and
 *        the existing Sidebar/TabBar look is unaffected.
 *
 * All tests are headless; viewport changes use `page.setViewportSize` (never
 * a real device emulation reload) so the same page/context can flip between
 * mobile and desktop widths within a single test where useful.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";
const MOBILE_VIEWPORT = { width: 375, height: 700 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
}

async function openLocalPicker(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="new-session-local"]');
  await expect(btn).toBeEnabled({ timeout: 10000 });
  await btn.click();
  await expect(page.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
}

/** Select claude-haiku-4-5, send `text`, and wait for the turn to finish. */
async function sendAndWait(page: Page, text: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator('[data-testid="agent-option-claude"]').click();
  await page.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill(text);
  await page.locator(".chat__send").click();

  const runningDot = page.locator(".session-item--active .session-status--running");
  await expect(runningDot).toBeVisible({ timeout: 20000 });
  await expect(runningDot).not.toBeVisible({ timeout: 90000 });
}

test.describe("Responsive narrow-width collapse (Phase 5)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  let sessionAId = "";
  let sessionBId = "";

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
  // R1 — sidebar + tab bar hidden, mobile header shown, at <=700px.
  // -------------------------------------------------------------------------
  test("R1. sidebar/tab bar hidden and mobile header shown at <=700px", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".sidebar")).not.toBeVisible();
    await expect(page.locator(".tab-bar")).not.toBeVisible();
    // Dockview area and status bar remain mounted at narrow widths.
    await expect(page.locator(".dock-area")).toBeVisible();
    await expect(page.locator(".chat")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/r1-mobile-header.png" });
  });

  // -------------------------------------------------------------------------
  // R2 — "Switch" opens the slide-over.
  // -------------------------------------------------------------------------
  test("R2. mobile header 'Switch' button opens the slide-over", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    const switcher = page.locator('[data-testid="mobile-switcher"]');
    await expect(switcher).not.toBeVisible();

    await page.locator('[data-testid="mobile-switch"]').click();
    await expect(switcher).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/r2-mobile-switcher-open.png" });

    // Closing it via its own close button dismisses it again.
    await page.locator('[data-testid="mobile-switcher-close"]').click();
    await expect(switcher).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // R3 — selecting a session from the slide-over switches + closes it.
  // -------------------------------------------------------------------------
  test("R3. selecting a session in the slide-over switches to it and closes", async ({ page }) => {
    test.setTimeout(240000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping R3 (needs two real, persisted sessions)");
      return;
    }

    // Materialize two sibling sessions at a normal desktop viewport first —
    // the "+ New session" picker and model chip live in desktop-only chrome
    // (Sidebar), and Fix 3 defers a session's DB row (hence its appearance
    // in session.list, which MobileSwitcher's list is built from) until its
    // first message.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });

    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await sendAndWait(page, "Reply with exactly: RESP-ALPHA");
    sessionAId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionAId).toBeTruthy();

    // Wave 1 item 1: tab-bar "+" opens a directory-browser popover; the
    // current project's cwd is preselected as the first quick-pick option.
    // The tab-bar "+" creates straight into the active project — no popover,
    // same destination the "project-option-0" quick-pick used to select.
    await page.locator('[data-testid="tab-new"]').click();
    await sendAndWait(page, "Reply with exactly: RESP-BETA");
    sessionBId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionBId).toBeTruthy();
    expect(sessionBId).not.toEqual(sessionAId);

    // Now shrink to mobile width — same page/context, no reload, so both
    // sessions are already known to the store (session.list already arrived).
    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible({ timeout: 10000 });

    // Currently on B (the last-created session). Open the switcher and pick A.
    await page.locator('[data-testid="mobile-switch"]').click();
    const switcher = page.locator('[data-testid="mobile-switcher"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="mobile-switcher-session-${sessionAId}"]`)).toBeVisible({
      timeout: 5000,
    });

    await page.locator(`[data-testid="mobile-switcher-session-${sessionAId}"]`).click();

    // Selecting closes the slide-over...
    await expect(switcher).not.toBeVisible({ timeout: 5000 });
    // ...and actually switches the active session.
    await expect(async () => {
      const stored = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      expect(stored).toEqual(sessionAId);
    }).toPass({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/r3-switched-and-closed.png" });
  });

  // -------------------------------------------------------------------------
  // R4 — desktop viewport is unaffected: no mobile chrome renders.
  // -------------------------------------------------------------------------
  test("R4. desktop viewport shows the normal Sidebar/TabBar chrome only", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);

    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="mobile-header"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="mobile-switcher"]')).not.toBeVisible();

    await page.screenshot({ path: "artifacts/r4-desktop-unaffected.png" });
  });
});
