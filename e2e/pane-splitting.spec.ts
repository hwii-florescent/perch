/**
 * pane-splitting.spec.ts — tiling terminals in the top-row tab strip: the leader chord
 * (Ctrl+Space, v) and the tab's right-click menu (`tab-split-menu`) split, show full size
 * and close tiles. The shell is a first-class tab; there are no chat/Dockview panes here.
 *
 *   P1 — Ctrl+Space, v tiles a new terminal beside the active one.
 *   P2 — the tab menu offers split/rename/close; Split right adds a tile, Close removes it.
 *   P3 — "Show this tab full size" leaves the split without closing the other tab.
 *
 * All tests are headless (no --headed/--ui).
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Fire the Ctrl+Space leader chord followed by `key`. */
async function leaderChord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

test.describe("Pane splitting (tiled terminals)", () => {
  test.describe.configure({ mode: "serial" });

  const terminals = (page: Page) => page.locator(".terminal__surface");
  const tabs = (page: Page) => page.locator("[data-tab-entry] button.tab-bar__tab");

  /** Make sure two terminals are tiled (earlier runs may have left sessions behind). */
  async function tiledPair(page: Page): Promise<void> {
    await freshPage(page);
    if ((await terminals(page).count()) === 0) {
      await leaderChord(page, "v");
      await expect(terminals(page)).not.toHaveCount(0, { timeout: 10000 });
      await expect.poll(() => page.evaluate(() => window.usePerchStore.getState().sessions.length)).toBeGreaterThan(0);
    }
    const before = await terminals(page).count();
    await leaderChord(page, "v");
    await expect(terminals(page)).toHaveCount(before + 1, { timeout: 15000 });
  }

  // P1 — leader,v tiles a new terminal beside the active one.
  test("P1. Ctrl+Space, v splits into two visible panels", async ({ page }) => {
    await tiledPair(page);
    const tiles = page.locator("[data-pane-id]");
    await expect(tiles.first()).toHaveAttribute("data-pane-visible", "true");
    await expect(tiles.last()).toHaveAttribute("data-pane-visible", "true");
    await page.screenshot({ path: "artifacts/p1-split.png" });
  });

  // P2 — the tab menu offers split/rename/close; Split right adds a tile, Close removes it.
  test("P2. right-click a tab: split right adds a terminal, close removes it", async ({ page }) => {
    await tiledPair(page);
    const before = await terminals(page).count();
    await tabs(page).last().click({ button: "right" });
    const menu = page.locator('[data-testid="tab-split-menu"]');
    await expect(menu).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="tab-menu-split-right"]')).toBeEnabled();
    await expect(page.locator('[data-testid="tab-menu-split-below"]')).toBeEnabled();
    await expect(page.locator('[data-testid="tab-menu-rename"]')).toBeVisible();
    await page.screenshot({ path: "artifacts/p2-context-menu.png" });
    await page.locator('[data-testid="tab-menu-split-right"]').click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(terminals(page)).toHaveCount(before + 1, { timeout: 15000 });

    await tabs(page).last().click({ button: "right" });
    await page.locator('[data-testid="tab-menu-close"]').click();
    await expect(terminals(page)).toHaveCount(before, { timeout: 10000 });
  });

  // P3 — "Show this tab full size" leaves the split; the other tab stays open.
  test("P3. show a tab full size leaves the split without closing the other", async ({ page }) => {
    await tiledPair(page);
    const tiles = page.locator("[data-pane-id]");
    const open = await tabs(page).count();
    await tabs(page).last().click({ button: "right" });
    await page.locator('[data-testid="tab-unsplit"]').click();
    await expect(page.locator('[data-testid="tab-split-menu"]')).not.toBeVisible({ timeout: 5000 });
    await expect(tabs(page)).toHaveCount(open);
    await expect(tiles.filter({ has: page.locator(".terminal__surface") })).toHaveCount(1, { timeout: 10000 });
    await page.screenshot({ path: "artifacts/p3-full-size.png" });
  });
});
