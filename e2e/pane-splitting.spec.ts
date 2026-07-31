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
 *        Requires two real, persisted sibling sessions (`claudeAvailable`
 *        gate, same pattern as workspace-tabs.spec.ts's W2/W3) since Fix 3
 *        defers a session's DB row — and hence any `session.layout.set`
 *        actually landing — until its first message.
 *
 * All tests are headless (no --headed/--ui).
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
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

/** Switch to `sessionId` via its tab-bar pill and wait for it to become active. */
async function switchViaTabBar(page: Page, sessionId: string): Promise<void> {
  await page.locator(`[data-testid="tab-${sessionId}"]`).click();
  await expect(page.locator(`.session-item--active[data-session-id="${sessionId}"]`)).toBeVisible({
    timeout: 15000,
  });
}

/** Switch to `sessionId` via its sidebar row and wait for it to become active. */
async function switchViaSidebar(page: Page, sessionId: string): Promise<void> {
  await page.locator(`.session-item[data-session-id="${sessionId}"]`).click();
  await expect(page.locator(`.session-item--active[data-session-id="${sessionId}"]`)).toBeVisible({
    timeout: 15000,
  });
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
  // P1 — leader,v splits a new terminal pane into view.
  // -------------------------------------------------------------------------
  test("P1. Ctrl+Space, v splits into two visible panels", async ({ page }) => {
    await freshPage(page);

    const chatTab = page.locator('[data-testid="pane-tab-chat"]');
    await expect(chatTab).toBeVisible({ timeout: 10000 });
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
    await expect(chatTab).toBeVisible({ timeout: 10000 });

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

    await page.locator('[data-testid="pane-menu-split-right"]').click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    const newTab = nonChatTab(page);
    await expect(newTab).toBeVisible({ timeout: 5000 });

    // Right-click the new terminal tab — its Close must be enabled this time.
    await newTab.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 5000 });
    const closeBtn = page.locator('[data-testid="pane-menu-close"]');
    await expect(closeBtn).toBeEnabled();

    await closeBtn.click();
    await expect(menu).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
    await expect(chatTab).toBeVisible();

    await page.screenshot({ path: "artifacts/p2-closed-via-menu.png" });
  });

  // -------------------------------------------------------------------------
  // P3 — zoom then un-zoom via the context menu round-trips through Phase 3's
  // layout persistence: the (non-maximized) split survives a switch away and
  // back to the session.
  // -------------------------------------------------------------------------
  test("P3. zoom then un-zoom round-trips through layout persistence", async ({ page }) => {
    test.setTimeout(240000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping P3 (needs two real, persisted sessions)");
      return;
    }

    // Two sibling sessions in the same project (Fix 3: a session needs a
    // real message before it has a DB row / persists a layout at all).
    await freshPage(page);
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await sendAndWait(page, "Reply with exactly: PANE-ALPHA");
    sessionAId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionAId).toBeTruthy();

    // Wave 1 item 1: tab-bar "+" opens a directory-browser popover; the
    // current project's cwd is preselected as the first quick-pick option.
    await page.locator('[data-testid="tab-new"]').click();
    await expect(page.locator('[data-testid="dir-browser"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="project-option-0"]').click();
    await sendAndWait(page, "Reply with exactly: PANE-BETA");
    sessionBId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionBId).toBeTruthy();
    expect(sessionBId).not.toEqual(sessionAId);

    // Land back on A and split it. Every session switch re-fetches that
    // session's layout from the server (DockviewShell invalidates any cached
    // entry before asking again — see its comments), so give that
    // session.layout.get round-trip time to land and apply before splitting;
    // otherwise the async apply can land *after* the split and wipe it via
    // its clear()+re-add fallback path.
    await switchViaSidebar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toHaveCount(0);
    await page.waitForTimeout(800);
    await leaderChord(page, "v");
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

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
    await expect(page.locator(".terminal__surface")).toBeVisible();

    // Give the 500ms debounced session.layout.set time to fire and land.
    await page.waitForTimeout(1500);

    // Switch away to B (never split — default single-Chat layout)...
    await switchViaTabBar(page, sessionBId);
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });

    await page.screenshot({ path: "artifacts/p3-on-b-no-terminal.png" });

    // ...and back to A: the split should be restored, NOT stuck maximized —
    // both chat and the terminal pane must be visible.
    await switchViaTabBar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });
    await expect(chat).toBeVisible();

    await page.screenshot({ path: "artifacts/p3-restored-on-a.png" });
  });
});
