/**
 * wave1.spec.ts — e2e coverage for Wave 1 (herdr functionality gaps):
 *   F1 — directory browser for the new-session cwd picker (Browse default,
 *        filter, up/breadcrumb navigation, Type-path fallback, and the
 *        tab-bar "+" creating straight into the active project)
 *   F2 — session rename via double-click on a TabBar tab
 *   F3/F4 — Notifications settings section: soundEnabled toggle and
 *        toastDelivery selector (off/app/system), persisted across reload
 *   F5 — in-terminal search (Ctrl/Cmd+F find-bar overlay, Escape closes)
 *   F6 — close confirmation: closing a terminal group holding more than one
 *        terminal tab (single-terminal close stays unconfirmed); deleting a
 *        session via the row's trash icon is immediate, no confirmation
 *
 * All tests are headless (no --headed / --ui). Tests needing a persisted
 * session (F2's tab-rename, F6b's session-delete) require a real `claude`
 * turn and are skipped when the CLI isn't available, matching the pattern in
 * sessions.spec.ts / toasts.spec.ts.
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const SETTINGS_FILE = path.join(os.homedir(), ".perch", "settings.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  await expect(page.locator('[data-testid="dir-browser"]')).toBeVisible({ timeout: 5000 });
}

/** Create a session via the "No project" quick-pick, send one message, and
 * wait for the turn to finish so the row is persisted and visible in the
 * sidebar (mirrors sessions.spec.ts's createAndFinishSession). Returns the
 * new session's id. */
async function createAndFinishSession(page: Page, label: string): Promise<string> {
  await openLocalPicker(page);
  await page.locator('[data-testid="project-option-none"]').click();

  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator('[data-testid="agent-option-claude"]').click();
  await page.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill(`wave1-${label}-${Date.now()}`);
  await page.locator(".chat__send").click();

  const runningDot = page.locator(".session-item--active .session-status--running");
  await expect(runningDot).toBeVisible({ timeout: 20000 });
  await expect(runningDot).not.toBeVisible({ timeout: 90000 });

  const id = await page.locator(".session-item--active").getAttribute("data-session-id");
  expect(id).toBeTruthy();
  return id as string;
}

/** Reset the sound/toast notification settings to their defaults so this
 * spec never leaks state into sibling specs (toasts.spec.ts assumes the
 * default "app" toast delivery). Belt-and-suspenders alongside resetting
 * through the UI at the end of the F3/F4 test itself. */
function resetNotificationSettings(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.soundEnabled = false;
    data.toastDelivery = "app";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Malformed/missing file — leave it alone rather than destroying real settings.
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Wave 1 functionality gaps", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    resetNotificationSettings();
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

  test.afterAll(() => {
    resetNotificationSettings();
  });

  // -------------------------------------------------------------------------
  // F1 — directory browser
  // -------------------------------------------------------------------------
  test("F1. directory browser: browse/filter/up, type-path fallback, and cwd selection", async ({ page }) => {
    await freshPage(page);
    await openLocalPicker(page);

    const browser = page.locator('[data-testid="dir-browser"]');
    await expect(browser).toBeVisible();
    await expect(page.locator('[data-testid="dir-browser-filter"]')).toBeVisible();

    // Filtering narrows the list live; an unmatchable filter empties it.
    const filterInput = page.locator('[data-testid="dir-browser-filter"]');
    await filterInput.fill("zzzz-no-such-entry-zzzz");
    await expect(page.locator(".dir-browser__empty")).toBeVisible({ timeout: 3000 });
    await filterInput.fill("");

    // Descend into the first available entry (if any — home dirs vary) and
    // come back up via the explicit "up" button; breadcrumb round-trips.
    const firstEntry = page.locator('[data-testid^="dir-browser-entry-"]').first();
    if ((await firstEntry.count()) > 0) {
      await firstEntry.click();
      await expect(page.locator('[data-testid="dir-browser-up"]')).toBeEnabled({ timeout: 5000 });
      await page.locator('[data-testid="dir-browser-up"]').click();
      await expect(page.locator('[data-testid="dir-browser-filter"]')).toBeVisible({ timeout: 5000 });
    }

    // "Type path" toggle reveals the manual fallback input and toggles back.
    await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
    const pathInput = page.locator('[data-testid="project-path-input"]');
    await expect(pathInput).toBeVisible();
    await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
    await expect(pathInput).not.toBeVisible();

    // Regression guard: with many known-project quick-pick rows (real
    // ~/.perch DB accumulates one per distinct cwd across e2e runs), the
    // popover used to grow past the viewport bottom and strand this button
    // out of reach (231 click retries, "element is outside of the
    // viewport"). It must always be within the 1280x720 viewport.
    const useBtn = page.locator('[data-testid="dir-browser-use"]');
    await expect(useBtn).toBeVisible();
    const viewport = page.viewportSize();
    const box = await useBtn.boundingBox();
    expect(viewport).toBeTruthy();
    expect(box).toBeTruthy();
    if (viewport && box) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }

    // "Use this folder" confirms the current path and creates a session. The
    // popover closes synchronously (before the session.create round-trip
    // resolves), so poll localStorage rather than reading it right away.
    await useBtn.click();
    await expect(browser).not.toBeVisible({ timeout: 3000 });
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId")), { timeout: 5000 })
      .toBeTruthy();

    await page.screenshot({ path: "artifacts/wave1-f1-dir-browser.png" });
  });

  test("F1b. tab-bar + creates a session in the active project (no popover)", async ({ page }) => {
    await freshPage(page);

    // Pin an active project by creating a session in a known folder through
    // the sidebar's picker (which keeps the directory browser).
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-tabplus-"));
    await openLocalPicker(page);
    await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
    await page.locator('[data-testid="project-path-input"]').fill(dir);
    await page.locator('[data-testid="dir-browser-use"]').click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId")), { timeout: 8000 })
      .toBeTruthy();
    const firstId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));

    // The tab-bar "+" is the zero-click fast path: it must create straight
    // into the active project, never open the directory browser.
    const tabNew = page.locator('[data-testid="tab-new"]');
    await expect(tabNew).toBeVisible({ timeout: 10000 });
    await tabNew.click();
    await expect(page.locator('[data-testid="dir-browser"]')).not.toBeVisible({ timeout: 2000 });
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId")), { timeout: 8000 })
      .not.toBe(firstId);

    // ...and the nav stays scoped to that same project.
    const pinned = await page.evaluate(() => localStorage.getItem("perch.activeProject"));
    expect(pinned).toContain(dir);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // F2 — session rename
  // -------------------------------------------------------------------------
  test("F2. rename via double-click on a TabBar tab", async ({ page }) => {
    test.setTimeout(150000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — F2 needs a persisted session");
      return;
    }

    await freshPage(page);
    const id = await createAndFinishSession(page, "rename");
    const row = page.locator(`.session-item[data-session-id="${id}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // --- Rename via double-click on the TabBar tab for the same session ---
    const tab = page.locator(`[data-testid="tab-${id}"]`);
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.dblclick();

    const tabRenameInput = page.locator('[data-testid="rename-input"]');
    await expect(tabRenameInput).toBeVisible({ timeout: 5000 });
    await tabRenameInput.fill("Renamed via tab");
    await tabRenameInput.press("Enter");

    await expect(row.locator(".session-item__title")).toHaveText("Renamed via tab", { timeout: 5000 });

    await page.screenshot({ path: "artifacts/wave1-f2-tab-renamed.png" });
  });

  // -------------------------------------------------------------------------
  // F3/F4 — Notifications settings (sound + toast delivery)
  // -------------------------------------------------------------------------
  test("F3+F4. Notifications settings: sound toggle and toast delivery persist", async ({ page, context }) => {
    await context.grantPermissions(["notifications"], { origin: BASE_URL });
    await freshPage(page);

    await page.locator('[data-testid="settings-gear"]').click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });

    const soundToggle = page.locator('[data-testid="settings-sound-enabled"]');
    await expect(soundToggle).not.toBeChecked();
    await soundToggle.check();
    await expect(soundToggle).toBeChecked();

    const toastSelect = page.locator('[data-testid="settings-toast-delivery"]');
    await expect(toastSelect).toHaveValue("app");
    await toastSelect.selectOption("system");
    await expect(toastSelect).toHaveValue("system");

    // Close and reopen — settings persist server-side (settings.json).
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid="settings-gear"]').click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="settings-sound-enabled"]')).toBeChecked();
    await expect(page.locator('[data-testid="settings-toast-delivery"]')).toHaveValue("system");

    await page.screenshot({ path: "artifacts/wave1-f3f4-settings.png" });

    // Reset to defaults so this doesn't affect toasts.spec.ts / other specs.
    await page.locator('[data-testid="settings-sound-enabled"]').uncheck();
    await page.locator('[data-testid="settings-toast-delivery"]').selectOption("app");
    await page.keyboard.press("Escape");
  });

  // -------------------------------------------------------------------------
  // F5 — in-terminal search
  // -------------------------------------------------------------------------
  test("F5. Ctrl/Cmd+F opens the in-terminal find bar; Escape closes it", async ({ page }) => {
    await freshPage(page);

    const openBtn = page.getByTitle("Open terminal");
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    // Focus the terminal pane, then fire the find shortcut. Our handler
    // accepts either Ctrl or Cmd, so Control+F works cross-platform here.
    await page.locator(".terminal__surface").click();
    await page.keyboard.press("Control+F");

    const searchBar = page.locator('[data-testid="term-search"]');
    await expect(searchBar).toBeVisible({ timeout: 5000 });
    const searchInput = page.locator('[data-testid="term-search-input"]');
    await expect(searchInput).toBeFocused();

    await searchInput.fill("test");
    await page.keyboard.press("Escape");
    await expect(searchBar).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "artifacts/wave1-f5-terminal-search.png" });

    // Single terminal — closing needs no confirmation (Wave 1 item 6).
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // F6 — close confirmation
  // -------------------------------------------------------------------------
  test("F6a. closing a multi-tab terminal group prompts confirm; single terminal does not", async ({ page }) => {
    await freshPage(page);
    const openBtn = page.getByTitle("Open terminal");

    // Single terminal: toggling closed needs no confirmation.
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toHaveCount(1, { timeout: 10000 });
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('[data-testid="confirm-dialog"]')).toHaveCount(0);

    // Two terminals in the same group: toggling closed now prompts. Dockview
    // only mounts the *active* tab's content within a group (matching
    // workspace-tabs.spec.ts's W4 test), so adding a second tab keeps
    // `.terminal__surface` at 1 — assert on the tab bar (`pane-tab-*`)
    // instead, which reflects panel count regardless of which is active.
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toHaveCount(1, { timeout: 10000 });
    const terminalGroupHeader = page.locator(
      '.dv-tabs-and-actions-container:has([data-testid="terminal-add-tab"])',
    );
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(1);
    await page.locator('[data-testid="terminal-add-tab"]').click();
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(2, { timeout: 10000 });

    await openBtn.click();
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await expect(confirmDialog).toContainText("2");

    // Cancel — terminals remain open.
    await page.locator('[data-testid="confirm-cancel"]').click();
    await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(2);

    await page.screenshot({ path: "artifacts/wave1-f6a-confirm-shown.png" });

    // Accept — both close.
    await openBtn.click();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="confirm-accept"]').click();
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
  });

  test("F6b. deleting a session via the trash icon is immediate — no confirmation", async ({ page }) => {
    test.setTimeout(150000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — F6b needs a persisted session");
      return;
    }

    await freshPage(page);
    const id = await createAndFinishSession(page, "f6b");
    const row = page.locator(`.session-item[data-session-id="${id}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });

    const wrapper = page.locator(`.session-item__wrapper:has([data-session-id="${id}"])`);

    await wrapper.hover();
    await page.locator(`[data-testid="session-delete-icon-${id}"]`).click();

    // No confirm dialog — the session is deleted immediately.
    await expect(page.locator('[data-testid="confirm-dialog"]')).toHaveCount(0);
    await expect(page.locator(`.session-item[data-session-id="${id}"]`)).toHaveCount(0, { timeout: 10000 });

    await page.screenshot({ path: "artifacts/wave1-f6b-deleted.png" });
  });
});
