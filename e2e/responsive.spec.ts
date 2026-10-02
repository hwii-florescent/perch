/**
 * responsive.spec.ts — e2e tests for Phase 5's narrow-width collapse: below
 * `MOBILE_WIDTH_BREAKPOINT` (700px, see `responsive.ts`), `App.tsx` swaps the
 * desktop `<Sidebar/>`+`<TabBar/>` chrome for `<MobileHeader/>`+
 * `<MobileSwitcher/>` while the `<StatusBar/>` stays mounted and the canvas
 * switches to one active pane.
 *
 *   R1 — at <=700px, the sidebar and tab bar are hidden and the mobile
 *        header and one-pane canvas are shown instead.
 *   R2 — tapping the mobile header's "Switch" button opens the slide-over.
 *   R3 — selecting a session from the slide-over switches to it and closes
 *        the slide-over.
 *   R4 — at a normal desktop viewport, none of the mobile chrome renders and
 *        the existing Sidebar/TabBar look is unaffected.
 *
 * All tests are headless; viewport changes use `page.setViewportSize` (never
 * a real device emulation reload) so the same page/context can flip between
 * mobile and desktop widths within a single test where useful.
 */

import { test, expect, type Page } from "@playwright/test";
import { restoreChatMode } from "./chatMode";
import { startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";
const MOBILE_VIEWPORT = { width: 375, height: 700 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
}

test.describe("Responsive narrow-width collapse (Phase 5)", () => {
  test.describe.configure({ mode: "serial" });



  test.afterAll(() => {
    restoreChatMode();
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
    // The outer canvas and status bar remain, while the multi-pane Dockview
    // tree is replaced by one mounted mobile pane.
    await expect(page.locator(".dock-area")).toBeVisible();
    await expect(page.getByTestId("mobile-pane-shell")).toBeVisible();
    await expect(page.locator(".dockview-theme-perch")).toHaveCount(0);
    await expect(page.locator('[data-testid^="pane-tab-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
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
  // R2b — selecting another pane replaces the content component rather than
  // leaving all desktop pane/editor instances mounted underneath it.
  // -------------------------------------------------------------------------
  test("R2b. mobile pane switch keeps exactly one active mounted surface", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    await page.locator('[data-testid="mobile-pane-files"]').click();
    await expect(page.getByTestId("mobile-active-pane-files")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
    await expect(page.locator(".chat")).toHaveCount(0);
    await expect(page.locator(".dockview-theme-perch")).toHaveCount(0);

    await page.locator('[data-testid="mobile-pane-chat"]').click();
    await expect(page.getByTestId("mobile-active-pane-chat")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
    await expect(page.locator(".chat")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "artifacts/r2b-mobile-single-pane.png" });
  });

  // -------------------------------------------------------------------------
  // R3 — selecting a session from the slide-over switches + closes it.
  // -------------------------------------------------------------------------
  test("R3. selecting a session in the slide-over switches to it and closes", async ({ page }) => {
    // Start two sessions at desktop width, where the New session picker lives.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    const sessionAId = await startChat(page);
    await startChat(page);

    // Now shrink to mobile width — same page/context, no reload, so both
    // sessions are already known to the store (session.list already arrived).
    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible({ timeout: 10000 });

    // Currently on B (the last-created session). Open the switcher and pick A.
    await page.locator('[data-testid="mobile-switch"]').click();
    const switcher = page.locator('[data-testid="mobile-switcher"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
    const rowA = switcher.getByTestId(`workspace-session-${sessionAId}`);
    await rowA.scrollIntoViewIfNeeded();
    await rowA.click();

    // Selecting closes the slide-over...
    await expect(switcher).not.toBeVisible({ timeout: 5000 });
    // ...and actually switches the active session.
    await expect(async () => {
      const stored = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      expect(stored).toEqual(sessionAId);
    }).toPass({ timeout: 10000 });

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
