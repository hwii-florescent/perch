/**
 * theme.spec.ts — Phase 1 (herdr-parity) e2e tests for the theme system.
 *
 * T1 "default theme is perch on first load":
 *   Fresh session, no theme override in ~/.perch/settings.json — assert
 *   `getComputedStyle(document.documentElement).getPropertyValue("--accent")`
 *   matches perch's default accent (#58e6a8).
 *
 * T2 "switching theme in Settings persists across reload":
 *   Open Settings, click the "dracula" theme option, assert the ✓ marker and
 *   the live `--accent` token update; reload; reopen Settings and assert the
 *   ✓ marker (and token) survived the round-trip via ~/.perch/settings.json.
 *
 * T3 "spot-check themes render without console errors":
 *   For catppuccin, dracula, one-light: select the theme, assert `--accent`
 *   matches that theme's value, and assert no new console errors appeared.
 *
 * Resets `theme` back to "perch" in ~/.perch/settings.json at start and end
 * so this spec — and any spec that runs after it — sees perch's default
 * look, matching settings.spec.ts's cleanup convention for other fields.
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

// Known accent values for the themes this spec exercises, transcribed from
// packages/web/src/themes.ts (must stay in sync with that table).
const ACCENT = {
  perch: "#58e6a8",
  catppuccin: "#89b4fa",
  dracula: "#bd93f9",
  "one-light": "#4078f2",
} as const;

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

/** Force `theme` back to "perch" in ~/.perch/settings.json, leaving every
 * other field untouched. Safe to call even if the file doesn't exist yet. */
function resetTheme(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.theme = "perch";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Malformed file — leave it alone rather than destroy real settings.
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Navigate to the app with a fresh session (localStorage cleared). */
async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".session-item").first()).toBeVisible({ timeout: 15000 });
}

/** Open the settings modal via the gear button and wait for it to appear. */
async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
}

/** Close the settings modal by pressing Escape. */
async function closeSettingsEsc(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
}

/** Read the live `--accent` custom property off `<html>`. */
async function getAccent(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
  );
}

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------

test.describe("Phase 1: theme system", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    resetTheme();
  });

  test.afterAll(() => {
    resetTheme();
  });

  // ---------------------------------------------------------------------------
  // T1 — default theme is "perch" on first load
  // ---------------------------------------------------------------------------
  test("T1. default theme is perch on first load", async ({ page }) => {
    await freshSession(page);

    const accent = await getAccent(page);
    expect(accent.toLowerCase()).toBe(ACCENT.perch);

    await page.screenshot({ path: "artifacts/T1-default-theme-perch.png" });
  });

  // ---------------------------------------------------------------------------
  // T2 — switching theme persists across reload
  // ---------------------------------------------------------------------------
  test("T2. switching theme persists across reload", async ({ page }) => {
    await freshSession(page);
    await openSettings(page);

    const modal = page.locator('[data-testid="settings-modal"]');
    const draculaOption = modal.locator('[data-testid="theme-option-dracula"]');
    await expect(draculaOption).toBeVisible({ timeout: 5000 });
    await draculaOption.click();

    // Live preview applies immediately.
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.dracula);

    // Checkmark moves to the newly-selected option.
    await expect(draculaOption).toHaveClass(/settings-modal__theme-option--active/);

    await page.screenshot({ path: "artifacts/T2-theme-dracula-selected.png" });

    // Close, reload, reopen — the persisted theme should survive.
    await closeSettingsEsc(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });

    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 8000 })
      .toBe(ACCENT.dracula);

    await openSettings(page);
    const draculaOptionAfter = modal.locator('[data-testid="theme-option-dracula"]');
    await expect(draculaOptionAfter).toHaveClass(/settings-modal__theme-option--active/, {
      timeout: 5000,
    });

    await page.screenshot({ path: "artifacts/T2-theme-persisted-after-reload.png" });

    // Restore to perch for subsequent tests/specs.
    const perchOption = modal.locator('[data-testid="theme-option-perch"]');
    await perchOption.click();
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.perch);
    await closeSettingsEsc(page);
  });

  // ---------------------------------------------------------------------------
  // T3 — spot-check themes render without console errors
  // ---------------------------------------------------------------------------
  test("T3. spot-check themes render without console errors", async ({ page }) => {
    await freshSession(page);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await openSettings(page);
    const modal = page.locator('[data-testid="settings-modal"]');

    for (const name of ["catppuccin", "dracula", "one-light"] as const) {
      const option = modal.locator(`[data-testid="theme-option-${name}"]`);
      await expect(option).toBeVisible({ timeout: 5000 });
      await option.click();

      await expect
        .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
        .toBe(ACCENT[name]);

      await page.screenshot({ path: `artifacts/T3-theme-${name}.png` });
    }

    expect(consoleErrors, `console errors while spot-checking themes: ${consoleErrors.join("; ")}`)
      .toHaveLength(0);

    // Restore to perch so this spec leaves no visible side effect.
    const perchOption = modal.locator('[data-testid="theme-option-perch"]');
    await perchOption.click();
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.perch);
    await closeSettingsEsc(page);
  });
});
