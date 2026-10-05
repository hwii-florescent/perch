/**
 * pane-splitting.spec.ts — e2e tests for Phase 5's pane context menu: the
 * right-click menu on dockview panel tabs (Split Right / Split Down / Zoom /
 * Rename / Close), routed through the same `DockviewController` the leader
 * keybindings (leader,v/z/x — see keybindings.spec.ts's K5) already use.
 *
 *   P1 — Ctrl+Space, v splits a new terminal pane into view (no context menu
 *        involved — sanity-checks the keybinding path still works alongside
 *        the new custom tab renderer).
 *   P2 — right-clicking a tab shows Split Right/Split Down/Zoom/Rename/Close;
 *        Close is disabled for the permanent "chat" panel; Split Right from
 *        the menu adds a terminal pane whose own tab's Close is enabled and
 *        removes it.
 *   P3 — zoom then un-zoom via the context menu round-trips correctly through
 *        Phase 3's per-session layout persistence: switching away to a
 *        sibling session and back still restores the (non-maximized) split,
 *        i.e. the zoom/un-zoom cycle doesn't corrupt or wedge persistence.
 *        Uses two plain shell sessions started in Chats.
 *   P4 — the pane header's `⋯` button (`pane-group-menu`, rendered in
 *        dockview's right-header-actions slot, distinct from P2's right-click
 *        tab menu) opens the same `PaneContextMenu` on a *plain* click. This
 *        is the regression guard for the stacking bug where the Hosted
 *        `.chat__list` won the hit-test over the header button, so the click
 *        landed on the chat content and the menu never opened (only a
 *        synthetic `dispatchEvent` reached it). The fix gives dockview's
 *        `.dv-tabs-and-actions-container` its own stacking context.
 *
 * All tests are headless (no --headed/--ui).
 */

import { test, expect, type Page } from "@playwright/test";
import { shellPanes, startChat, switchViaSidebar, switchViaTabBar } from "./projects";

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

/** Locator for a pane's tab that isn't the permanent "chat" panel — terminal
 * panel ids are randomly generated, so tests can't know them up front. */
function nonChatTab(page: Page) {
  return page.locator('[data-testid^="pane-tab-"]:not([data-testid="pane-tab-chat"])');
}

test.describe("Pane splitting/zoom/context-menu (Phase 5)", () => {
  test.describe.configure({ mode: "serial" });

  let sessionAId = "";
  let sessionBId = "";


  // -------------------------------------------------------------------------
  // P1 — leader,v splits a new terminal pane into view.
  // -------------------------------------------------------------------------
  test("P1. Ctrl+Space, v splits into two visible panels", async ({ page }) => {
    await freshPage(page);

    const chatTab = page.locator('[data-testid="pane-tab-chat"]');
    // One pane shows no pane header: the top row already names the session.
    await expect(chatTab).toBeHidden({ timeout: 10000 });
    await expect(page.locator(".terminal__surface")).toHaveCount(0);

    await leaderChord(page, "v");

    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });
    await expect(chatTab).toBeVisible();
    await expect(nonChatTab(page)).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/p1-split.png" });
  });

  // -------------------------------------------------------------------------
  // P2 — right-click a tab shows the context menu; Close is disabled for
  // "chat"; Split Right from the menu adds a closable terminal pane.
  // -------------------------------------------------------------------------
  test("P2. right-click shows Split/Close/Zoom menu; split + close a pane via it", async ({ page }) => {
    await freshPage(page);

    const chatTab = page.locator('[data-testid="pane-tab-chat"]');
    // Pane headers (and their tabs) appear once there is more than one pane.
    await leaderChord(page, "v");
    const newTab = nonChatTab(page);
    await expect(newTab).toBeVisible({ timeout: 10000 });
    await expect(chatTab).toBeVisible();

    await chatTab.click({ button: "right" });
    const menu = page.locator('[data-testid="pane-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pane-menu-split-right"]')).toBeVisible();
    await expect(page.locator('[data-testid="pane-menu-split-down"]')).toBeVisible();
    await expect(page.locator('[data-testid="pane-menu-zoom"]')).toHaveText("Zoom");
    await expect(page.locator('[data-testid="pane-menu-rename"]')).toBeVisible();
    // The permanent chat panel can never be closed.
    await expect(page.locator('[data-testid="pane-menu-close"]')).toBeDisabled();

    await page.screenshot({ path: "artifacts/p2-context-menu.png" });
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible({ timeout: 5000 });

    // Right-click the new terminal tab — its Close must be enabled this time.
    await newTab.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 5000 });
    const closeBtn = page.locator('[data-testid="pane-menu-close"]');
    await expect(closeBtn).toBeEnabled();

    await closeBtn.click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
    await expect(chatTab).toBeHidden();

    await page.screenshot({ path: "artifacts/p2-closed-via-menu.png" });
  });

  // -------------------------------------------------------------------------
  // P2b — closing a terminal pane (its menu, or its tab's ×) ends its shell:
  // a later pane's shell picker never lists it.
  // -------------------------------------------------------------------------
  test("P2b. closing a terminal pane ends its shell", async ({ page }) => {
    await freshPage(page);
    await startChat(page);
    const picker = page.getByRole("combobox", { name: "Shell pane" });
    async function splitWithOneShell(): Promise<void> {
      await leaderChord(page, "_");
      await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });
      await expect(picker.locator("option")).toHaveCount(1, { timeout: 10000 });
    }
    async function reload(): Promise<void> {
      await expect(shellPanes(page)).toHaveCount(0, { timeout: 10000 });
      await page.waitForTimeout(1500); // the debounced layout save
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByTestId("persistent-agent-terminal")).toBeVisible({ timeout: 15000 });
    }

    await splitWithOneShell();
    await nonChatTab(page).click({ button: "right" });
    await page.getByTestId("pane-menu-close").click();
    await reload();

    await splitWithOneShell();
    await nonChatTab(page).hover();
    await nonChatTab(page).locator(".dv-default-tab-action").click();
    await reload();

    await splitWithOneShell();
  });

  // -------------------------------------------------------------------------
  // P3 — zoom then un-zoom via the context menu round-trips through Phase 3's
  // layout persistence: the (non-maximized) split survives a switch away and
  // back to the session.
  // -------------------------------------------------------------------------
  test("P3. zoom then un-zoom round-trips through layout persistence", async ({ page }) => {
    await freshPage(page);
    sessionAId = await startChat(page);
    sessionBId = await startChat(page);

    // Land back on A and split it. Every session switch re-fetches that
    // session's layout from the server (DockviewShell invalidates any cached
    // entry before asking again — see its comments), so give that
    // session.layout.get round-trip time to land and apply before splitting;
    // otherwise the async apply can land *after* the split and wipe it via
    // its clear()+re-add fallback path.
    await switchViaSidebar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(0);
    await page.waitForTimeout(800);
    await leaderChord(page, "v");
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });

    const chat = page.locator(".chat");
    const terminalTab = nonChatTab(page);
    await expect(terminalTab).toBeVisible({ timeout: 5000 });

    // Zoom the terminal pane via the context menu — chat's group hides.
    await terminalTab.click({ button: "right" });
    const menu = page.locator('[data-testid="pane-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pane-menu-zoom"]')).toHaveText("Zoom");
    await page.locator('[data-testid="pane-menu-zoom"]').click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(chat).not.toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/p3-zoomed.png" });

    // Un-zoom (Restore) via the context menu — chat reappears alongside the
    // terminal pane again.
    await terminalTab.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="pane-menu-zoom"]')).toHaveText("Restore");
    await page.locator('[data-testid="pane-menu-zoom"]').click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(chat).toBeVisible({ timeout: 10000 });
    await expect(shellPanes(page)).toHaveCount(1);

    // Give the 500ms debounced session.layout.set time to fire and land.
    await page.waitForTimeout(1500);

    // Switch away to B (never split — default single-Chat layout)...
    await switchViaTabBar(page, sessionBId);
    await expect(shellPanes(page)).toHaveCount(0, { timeout: 10000 });

    await page.screenshot({ path: "artifacts/p3-on-b-no-terminal.png" });

    // ...and back to A: the split should be restored, NOT stuck maximized —
    // both chat and the terminal pane must be visible.
    await switchViaTabBar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });
    await expect(chat).toBeVisible();

    await page.screenshot({ path: "artifacts/p3-restored-on-a.png" });
  });

  // -------------------------------------------------------------------------
  // P4 — the header `⋯` button opens the pane menu on a PLAIN click (no
  // dispatchEvent). Regression guard for the `.chat__list` hit-test
  // interception fixed by the `.dv-tabs-and-actions-container` stacking rule.
  // -------------------------------------------------------------------------
  test("P4. header ⋯ button opens the pane menu on a plain click", async ({ page }) => {
    await freshPage(page);

    // The header (and its ⋯) shows once there is more than one pane.
    await leaderChord(page, "v");
    await expect(nonChatTab(page)).toBeVisible({ timeout: 10000 });

    // A plain locator click must reach the button — before the fix this timed
    // out with `.chat__list ... intercepts pointer events` and only a
    // synthetic dispatchEvent could open the menu.
    const headerMenuBtn = page.locator('[data-testid="pane-group-menu"]').first();
    await expect(headerMenuBtn).toBeVisible({ timeout: 10000 });
    await headerMenuBtn.click();

    const menu = page.locator('[data-testid="pane-context-menu"]');
    await expect(menu).toBeVisible({ timeout: 5000 });
    // Split Right / Split Down / Split with Session / Split with tab / Zoom / Rename / Close.
    await expect(page.locator(".pane-context-menu__item")).toHaveCount(7);

    await page.screenshot({ path: "artifacts/p4-header-menu.png" });

    // And the wiring works end-to-end: Split Right adds a terminal pane.
    await page.locator('[data-testid="pane-menu-split-right"]').click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".terminal__surface")).toHaveCount(2, { timeout: 10000 });
    await expect(nonChatTab(page)).toHaveCount(2, { timeout: 5000 });

    await page.screenshot({ path: "artifacts/p4-split-from-header-menu.png" });
  });
});
