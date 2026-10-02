/**
 * wave1.spec.ts — e2e coverage for Wave 1 (herdr functionality gaps):
 *   F1 — the new-session picker offers only listed projects and Chats
 *   F2 — session rename via double-click on a TabBar tab
 *   F3/F4 — Notifications settings section: soundEnabled toggle and
 *        toastDelivery selector (off/app/system), persisted across reload
 *   F5 — in-terminal search (Cmd+F find-bar overlay, Escape closes)
 *
 * All tests are headless (no --headed / --ui).
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pickProject, startChat } from "./projects";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const SETTINGS_FILE = process.env.PERCH_SETTINGS ?? path.join(os.homedir(), ".perch", "settings.json");

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
  await expect(page.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
}

/** The notification settings as they were before this spec touched anything.
 *
 * `~/.perch/settings.json` is GLOBAL — every instance shares it, there is no
 * `--settings-path` — so it holds the *developer's own* preferences, not test
 * fixtures. This spec must therefore put back exactly what it found.
 *
 * The previous version of this helper instead hard-wrote `toastDelivery:"app"`
 * / `soundEnabled:false` into the file in `beforeAll` and `afterAll`. That was
 * wrong twice over:
 *  - the running perch server has already loaded settings into memory and does
 *    not re-read the file, so writing behind its back changed nothing the UI
 *    would show — the assertion then compared the value it had just written to
 *    disk against the different value the server still had in memory, and the
 *    test failed on any machine whose owner had picked something non-default;
 *  - `afterAll` then made that clobber permanent, silently replacing the
 *    developer's real preference with the factory default.
 * Read here, and restore through the UI (which goes through the server, so
 * memory and file stay in sync). */
interface NotificationSettings {
  soundEnabled: boolean;
  toastDelivery: string;
}

function readNotificationSettings(): NotificationSettings | null {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    return {
      soundEnabled: data.soundEnabled === true,
      toastDelivery: typeof data.toastDelivery === "string" ? data.toastDelivery : "app",
    };
  } catch {
    // Malformed/missing file — leave it alone rather than destroying real settings.
    return null;
  }
}

/** Last-resort restore for the case where the UI path could not run (the test
 * crashed, the browser died). The server is being torn down at `afterAll`
 * time, so writing the file directly is safe *here* specifically — there is no
 * longer a live in-memory copy to disagree with it. */
function restoreNotificationSettingsOnDisk(original: NotificationSettings | null): void {
  if (!original) return;
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    if (data.soundEnabled === original.soundEnabled && data.toastDelivery === original.toastDelivery) {
      return; // already correct — the UI restore worked
    }
    data.soundEnabled = original.soundEnabled;
    data.toastDelivery = original.toastDelivery;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Wave 1 functionality gaps", () => {
  test.describe.configure({ mode: "serial" });

  /** Captured before any test runs; restored by F3/F4 through the UI and by
   * `afterAll` on disk as a backstop. */
  let originalNotifications: NotificationSettings | null = null;

  test.beforeAll(async () => {
    originalNotifications = readNotificationSettings();
  });

  test.afterAll(() => {
    restoreNotificationSettingsOnDisk(originalNotifications);
  });

  // -------------------------------------------------------------------------
  // F1 — the new-session picker offers listed projects and Chats only
  // -------------------------------------------------------------------------
  test("F1. new-session picker offers only listed projects and Chats", async ({ page }) => {
    await freshPage(page);
    await openLocalPicker(page);

    // No folder browser: a session never starts in a folder perch wasn't given.
    await expect(page.locator('[data-testid="dir-browser"]')).toHaveCount(0);
    const chats = page.locator('[data-testid="project-option-none"]');
    await expect(chats).toContainText("Chats");

    // The popover closes synchronously (before the session.create round-trip
    // resolves), so poll localStorage rather than reading it right away.
    await chats.click();
    await expect(chats).not.toBeVisible({ timeout: 3000 });
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId")), { timeout: 5000 })
      .toBeTruthy();
  });

  test("F2. rename via double-click on a TabBar tab", async ({ page }) => {
    await freshPage(page);
    const id = await startChat(page);
    const tab = page.locator(`[data-testid="tab-${id}"]`);
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.dblclick();

    const tabRenameInput = page.locator('[data-testid="rename-input"]');
    await expect(tabRenameInput).toBeVisible({ timeout: 5000 });
    await tabRenameInput.fill("Renamed via tab");
    await tabRenameInput.press("Enter");

    await expect(page.getByTestId(`workspace-session-${id}`)).toContainText("Renamed via tab", { timeout: 5000 });
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
    const toastSelect = page.locator('[data-testid="settings-toast-delivery"]');

    // Originals come from the file captured in `beforeAll`, NOT from reading
    // the DOM here: the <select> renders with its own default before the
    // server's `settings.current` lands over the WS, so an immediate
    // `inputValue()` can capture "app" on a machine whose real setting is
    // "system" — and then faithfully "restore" the wrong value at the end.
    const originalSound = originalNotifications?.soundEnabled ?? false;
    const originalToast = originalNotifications?.toastDelivery ?? "app";
    const flippedToast = originalToast === "app" ? "system" : "app";

    // Wait for the real values to arrive before touching anything, so the
    // flips below act on hydrated state rather than the pre-hydration default.
    await expect(toastSelect).toHaveValue(originalToast, { timeout: 8000 });
    await expect(soundToggle).toBeChecked({ checked: originalSound });

    try {
      await soundToggle.setChecked(!originalSound);
      await expect(soundToggle).toBeChecked({ checked: !originalSound });

      await toastSelect.selectOption(flippedToast);
      await expect(toastSelect).toHaveValue(flippedToast);

      // Close and reopen — settings persist server-side (settings.json).
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
      await page.reload({ waitUntil: "networkidle" });
      await page.locator('[data-testid="settings-gear"]').click();
      await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
      await expect(page.locator('[data-testid="settings-sound-enabled"]')).toBeChecked({
        checked: !originalSound,
      });
      await expect(page.locator('[data-testid="settings-toast-delivery"]')).toHaveValue(flippedToast);

      await page.screenshot({ path: "artifacts/wave1-f3f4-settings.png" });
    } finally {
      // Restore what was actually there, on the failure path too — AGENTS.md
      // requires it, and without it one failed run leaves the developer's real
      // settings flipped. Best-effort: a restore that itself fails must not
      // mask the original assertion failure.
      try {
        await page.reload({ waitUntil: "networkidle" });
        await page.locator('[data-testid="settings-gear"]').click();
        await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
        await page.locator('[data-testid="settings-sound-enabled"]').setChecked(originalSound);
        await page.locator('[data-testid="settings-toast-delivery"]').selectOption(originalToast);
        await page.keyboard.press("Escape");
      } catch {
        // swallow — see above
      }
    }
  });

  // -------------------------------------------------------------------------
  // F5 — in-terminal search
  // -------------------------------------------------------------------------
  test("F5. Cmd+F opens the in-terminal find bar; Escape closes it", async ({ page }) => {
    await freshPage(page);

    // A terminal split from the pane menu (the drawer has no terminal).
    // One pane has no pane header; split with the leader chord (leader,_).
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("_");
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    // Focus the terminal pane, then fire the find shortcut. Ctrl+F belongs
    // to the PTY, as in Ghostty.
    await page.locator(".terminal__surface").click();
    await page.keyboard.press("Meta+F");

    const searchBar = page.locator('[data-testid="term-search"]');
    await expect(searchBar).toBeVisible({ timeout: 5000 });
    const searchInput = page.locator('[data-testid="term-search-input"]');
    await expect(searchInput).toBeFocused();

    await searchInput.fill("test");
    await page.keyboard.press("Escape");
    await expect(searchBar).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: "artifacts/wave1-f5-terminal-search.png" });
  });
});
