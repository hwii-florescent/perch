/**
 * wave2.features.spec.ts — e2e coverage for Phase 15 (Wave 2) features:
 *   T1 — configurable terminal scrollback (Settings → Terminal): hydrates
 *        from the server, accepts an in-range value, persists across reload,
 *        and an out-of-range value is silently NOT persisted (see
 *        `clampScrollback` / the range-guard in `SettingsModal.tsx`'s
 *        `TerminalSection`).
 *   T2 — login-shell toggle for plain terminal panes: hydrates, toggles,
 *        persists across reload.
 *   T3 — a project's ⋯ → "Close all sessions" deletes every session in it.
 *   T4 — closing a workspace's last tab shows the home screen
 *        (`no-session-panel`), whose New session gets you out again.
 *
 * All tests are headless (no --headed / --ui) and use plain shell sessions.
 *
 * SETTINGS SAFETY: `~/.perch/settings.json` is GLOBAL (no `--settings-path`),
 * shared by every perch instance including the developer's own. T1/T2 read
 * the original values in `beforeAll`, change them only through the UI (so
 * server memory and disk stay in sync — the server never re-reads the file),
 * restore through the UI in a `finally`, and keep a disk-level restore in
 * `afterAll` purely as a crash backstop. This mirrors wave1.spec.ts's F3+F4
 * test — see the comment on `readNotificationSettings` there for the full
 * rationale (a previous version of that pattern wrote settings.json directly
 * and silently clobbered the developer's real preferences).
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { startChat } from "./projects";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const SETTINGS_FILE = process.env.PERCH_SETTINGS ?? path.join(os.homedir(), ".perch", "settings.json");
// Mirrors xtermSetup.ts's MIN_SCROLLBACK / MAX_SCROLLBACK.
const MIN_SCROLLBACK = 100;
const MAX_SCROLLBACK = 200000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
}

async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
}

interface TerminalSettings {
  terminalScrollback: number;
  terminalLoginShell: boolean;
}

/** Same rationale as wave1.spec.ts's readNotificationSettings: read the
 * developer's real values before touching anything, restore through the UI,
 * and only fall back to a disk write in `afterAll` as a crash backstop. */
function readTerminalSettings(): TerminalSettings | null {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    return {
      terminalScrollback: typeof data.terminalScrollback === "number" ? data.terminalScrollback : 10000,
      terminalLoginShell: data.terminalLoginShell === true,
    };
  } catch {
    return null;
  }
}

/** Last-resort restore — see wave1.spec.ts's restoreNotificationSettingsOnDisk
 * for why this is only safe once the server (which holds the live in-memory
 * copy) is being torn down, i.e. from `afterAll`. */
function restoreTerminalSettingsOnDisk(original: TerminalSettings | null): void {
  if (!original) return;
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    if (
      data.terminalScrollback === original.terminalScrollback &&
      data.terminalLoginShell === original.terminalLoginShell
    ) {
      return; // already correct — the UI restore worked
    }
    data.terminalScrollback = original.terminalScrollback;
    data.terminalLoginShell = original.terminalLoginShell;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Wave 2 (Phase 15) features", () => {
  test.describe.configure({ mode: "serial" });

  /** Captured before any test runs; restored by T1/T2 through the UI and by
   * `afterAll` on disk as a backstop. */
  let originalTerminalSettings: TerminalSettings | null = null;

  test.beforeAll(async () => {
    originalTerminalSettings = readTerminalSettings();
  });

  test.afterAll(() => {
    restoreTerminalSettingsOnDisk(originalTerminalSettings);
  });

  // -------------------------------------------------------------------------
  // T1 — configurable terminal scrollback
  // -------------------------------------------------------------------------
  test("T1. Terminal scrollback: hydrates, accepts in-range, persists, rejects out-of-range", async ({ page }) => {
    await freshPage(page);
    await openSettings(page);

    const scrollbackInput = page.locator('[data-testid="settings-terminal-scrollback"]');
    const originalValue = originalTerminalSettings?.terminalScrollback ?? 10000;

    // Wait for the real, hydrated value before touching anything — the input
    // renders its own local-state default before settings.current lands.
    await expect(scrollbackInput).toHaveValue(String(originalValue), { timeout: 8000 });

    // Pick an in-range value that's guaranteed different from the original.
    const inRangeValue = originalValue === 5000 ? 12345 : 5000;
    // An out-of-range value: comfortably above MAX_SCROLLBACK.
    const outOfRangeValue = MAX_SCROLLBACK + 50000;

    try {
      // --- In-range value: accepted and persists across reload -------------
      await scrollbackInput.fill(String(inRangeValue));
      await expect(scrollbackInput).toHaveValue(String(inRangeValue));

      await closeSettings(page);
      await page.reload({ waitUntil: "networkidle" });
      await openSettings(page);
      await expect(page.locator('[data-testid="settings-terminal-scrollback"]')).toHaveValue(
        String(inRangeValue),
        { timeout: 8000 }
      );

      await page.screenshot({ path: "artifacts/wave2-t1-scrollback-in-range.png" });

      // --- Out-of-range value: the box shows exactly what was typed (the
      // handler never fights mid-keystroke input)... -----------------------
      const liveInput = page.locator('[data-testid="settings-terminal-scrollback"]');
      await liveInput.fill(String(outOfRangeValue));
      await expect(liveInput).toHaveValue(String(outOfRangeValue));

      // ...but it must NOT have been persisted: after a reload the control
      // hydrates back to the last value that *was* actually in range
      // (inRangeValue), not the out-of-range string.
      await closeSettings(page);
      await page.reload({ waitUntil: "networkidle" });
      await openSettings(page);
      await expect(page.locator('[data-testid="settings-terminal-scrollback"]')).toHaveValue(
        String(inRangeValue),
        { timeout: 8000 }
      );

      await page.screenshot({ path: "artifacts/wave2-t1-scrollback-out-of-range-rejected.png" });
    } finally {
      try {
        await page.reload({ waitUntil: "networkidle" });
        await openSettings(page);
        await page.locator('[data-testid="settings-terminal-scrollback"]').fill(String(originalValue));
        await expect(page.locator('[data-testid="settings-terminal-scrollback"]')).toHaveValue(
          String(originalValue)
        );
        await closeSettings(page);
      } catch {
        // swallow — afterAll's disk-level restore is the backstop
      }
    }
  });

  // -------------------------------------------------------------------------
  // T2 — login-shell toggle
  // -------------------------------------------------------------------------
  test("T2. Terminal login-shell toggle: hydrates, toggles, persists across reload", async ({ page }) => {
    await freshPage(page);
    await openSettings(page);

    const loginShellToggle = page.locator('[data-testid="settings-terminal-login-shell"]');
    const originalChecked = originalTerminalSettings?.terminalLoginShell ?? false;

    await expect(loginShellToggle).toBeChecked({ checked: originalChecked, timeout: 8000 });

    try {
      await loginShellToggle.setChecked(!originalChecked);
      await expect(loginShellToggle).toBeChecked({ checked: !originalChecked });

      await closeSettings(page);
      await page.reload({ waitUntil: "networkidle" });
      await openSettings(page);
      await expect(page.locator('[data-testid="settings-terminal-login-shell"]')).toBeChecked({
        checked: !originalChecked,
      });

      await page.screenshot({ path: "artifacts/wave2-t2-login-shell.png" });
    } finally {
      try {
        await page.reload({ waitUntil: "networkidle" });
        await openSettings(page);
        await page.locator('[data-testid="settings-terminal-login-shell"]').setChecked(originalChecked);
        await closeSettings(page);
      } catch {
        // swallow — afterAll's disk-level restore is the backstop
      }
    }
  });

  // -------------------------------------------------------------------------
  // T3 — close every session in a project
  // -------------------------------------------------------------------------
  test("T3. Close all sessions deletes every session in the project", async ({ page }) => {
    await freshPage(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-wave2-closeall-"));
    try {
      const ids = [
        await startChat(page, "terminal", dir),
        await startChat(page, "terminal", dir),
        await startChat(page, "terminal", dir),
      ];
      for (const id of ids) await expect(page.getByTestId(`workspace-session-${id}`)).toBeVisible();

      const project = page.locator(".workspace-project").filter({ hasText: path.basename(dir) });
      await project.locator('[data-testid^="workspace-project-menu-"]').click();
      await page.locator('[data-testid^="workspace-project-close-all-"]').click();
      for (const id of ids) await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
      for (const id of ids) await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // T4 — closing a workspace's last tab shows the home screen
  // -------------------------------------------------------------------------
  test("T4. closing a workspace's last tab shows the home screen", async ({ page }) => {
    await freshPage(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-wave2-nosession-"));
    try {
      const id = await startChat(page, "terminal", dir);
      const panel = page.locator('[data-testid="no-session-panel"]');
      await expect(panel).toHaveCount(0);

      await page.getByTestId(`tab-${id}`).hover();
      await page.getByTestId(`tab-close-${id}`).click();
      await expect(panel).toBeVisible({ timeout: 10000 });

      await page.locator('[data-testid="no-session-create"]').click();
      await page.getByTestId("project-option-none").click();
      await expect(panel).not.toBeVisible({ timeout: 10000 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
