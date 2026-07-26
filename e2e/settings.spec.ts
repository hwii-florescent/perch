/**
 * settings.spec.ts — Stage D e2e tests for the Settings modal + SSH hosts CRUD.
 *
 * D1 "gear opens settings modal":
 *   Click [data-testid="settings-gear"], assert [data-testid="settings-modal"]
 *   visible; close via backdrop click (Escape also tested), assert hidden.
 *
 * D2 "SSH host CRUD round-trip":
 *   Open modal, add host (name "test-pod", ssh "test.devpod-us-or", port 7788),
 *   assert row appears; toggle enabled off; reopen modal, assert persisted;
 *   delete, assert gone.
 *   Cleans up only test-* entries from ~/.perch/hosts.json at start so reruns
 *   are deterministic while preserving real host entries.
 *
 * D3 "settings persist across reload":
 *   Add custom claude model {id:"claude-test-custom", label:"Test Custom"},
 *   reload page, reopen modal, assert present; then remove and assert gone.
 *   Cleans up test entries from ~/.perch/settings.json at start AND end.
 *
 * D4 "input pinned to bottom":
 *   In Hosted mode with an empty/new session, assert the input row's bounding
 *   box bottom is within ~80px of the chat pane bottom.
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const HOSTS_FILE = path.join(os.homedir(), ".perch", "hosts.json");
const SETTINGS_FILE = path.join(os.homedir(), ".perch", "settings.json");

// ---------------------------------------------------------------------------
// Filesystem helpers — conservative: only touch test-* entries
// ---------------------------------------------------------------------------

/** Remove hosts whose name starts with "test-" from ~/.perch/hosts.json.
 * Creates the file with an empty array if it doesn't exist. */
function cleanTestHosts(): void {
  try {
    if (!fs.existsSync(HOSTS_FILE)) {
      fs.mkdirSync(path.dirname(HOSTS_FILE), { recursive: true });
      fs.writeFileSync(HOSTS_FILE, JSON.stringify({ hosts: [] }, null, 2));
      return;
    }
    const raw = fs.readFileSync(HOSTS_FILE, "utf8");
    const data = JSON.parse(raw) as { hosts: Array<{ name?: string }> };
    data.hosts = (data.hosts ?? []).filter(
      (h) => !String(h.name ?? "").startsWith("test-"),
    );
    fs.writeFileSync(HOSTS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // If the file is malformed just reset it to empty
    fs.mkdirSync(path.dirname(HOSTS_FILE), { recursive: true });
    fs.writeFileSync(HOSTS_FILE, JSON.stringify({ hosts: [] }, null, 2));
  }
}

/** Remove custom claude models whose id starts with "claude-test-" from
 * ~/.perch/settings.json.  Other settings are left intact. */
function cleanTestModels(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as {
      customModels?: {
        claude?: Array<{ id?: string }>;
        codex?: Array<{ id?: string }>;
      };
    };
    if (data.customModels?.claude) {
      data.customModels.claude = data.customModels.claude.filter(
        (m) => !String(m.id ?? "").startsWith("claude-test-"),
      );
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // If malformed, leave it alone — don't destroy real settings
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

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------

test.describe("Stage D: settings modal + SSH hosts CRUD", () => {
  test.describe.configure({ mode: "serial" });

  // ---------------------------------------------------------------------------
  // D1 — Gear opens settings modal; Escape closes it; backdrop closes it
  // ---------------------------------------------------------------------------
  test("D1. gear opens settings modal", async ({ page }) => {
    await freshSession(page);

    // Gear button visible
    const gear = page.locator('[data-testid="settings-gear"]');
    await expect(gear).toBeVisible({ timeout: 5000 });

    // Click gear → modal appears
    await gear.click();
    const modal = page.locator('[data-testid="settings-modal"]');
    await expect(modal).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: "artifacts/D1-settings-modal-open.png" });

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Reopen and close via backdrop click
    await gear.click();
    await expect(modal).toBeVisible({ timeout: 8000 });

    // Click the backdrop (outside the panel)
    await page.locator(".settings-modal__backdrop").click({ position: { x: 10, y: 10 } });
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D1-settings-modal-closed.png" });
  });

  // ---------------------------------------------------------------------------
  // D2 — SSH host CRUD round-trip
  // ---------------------------------------------------------------------------
  test("D2. SSH host CRUD round-trip", async ({ page }) => {
    // Remove any stale test-* host entries so reruns are deterministic.
    cleanTestHosts();

    await freshSession(page);
    await openSettings(page);

    const modal = page.locator('[data-testid="settings-modal"]');

    // Fill the add-host form
    await modal.locator('[data-testid="host-name-input"]').fill("test-pod");
    await modal.locator('[data-testid="host-ssh-input"]').fill("test.devpod-us-or");
    // Port field has a default of 7788 — leave it as-is
    await modal.locator('[data-testid="host-add"]').click();

    // Row appears with the host name
    await expect(modal.locator('text="test-pod"')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D2-host-added.png" });

    // Toggle enabled off — find the checkbox in the row containing "test-pod"
    const hostRow = modal.locator('.settings-modal__host-row', { hasText: "test-pod" });
    const enabledCheckbox = hostRow.locator('input[type="checkbox"]');
    await expect(enabledCheckbox).toBeChecked({ timeout: 3000 });
    await enabledCheckbox.click();
    await expect(enabledCheckbox).not.toBeChecked({ timeout: 3000 });

    await page.screenshot({ path: "artifacts/D2-host-disabled.png" });

    // Close and reopen — persisted state should survive
    await closeSettingsEsc(page);
    await openSettings(page);

    const hostRowAfter = modal.locator('.settings-modal__host-row', { hasText: "test-pod" });
    const checkboxAfter = hostRowAfter.locator('input[type="checkbox"]');
    await expect(checkboxAfter).not.toBeChecked({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D2-host-persisted.png" });

    // Delete the host
    await modal.locator('[data-testid="host-delete-test-pod"]').click();

    // Row should disappear
    await expect(modal.locator('text="test-pod"')).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D2-host-deleted.png" });
  });

  // ---------------------------------------------------------------------------
  // D3 — Custom model persists across reload
  // ---------------------------------------------------------------------------
  test("D3. settings persist across reload", async ({ page }) => {
    // Remove test model entries before starting so reruns are clean.
    cleanTestModels();

    await freshSession(page);
    await openSettings(page);

    const modal = page.locator('[data-testid="settings-modal"]');

    // Find the claude custom-models add row — locate inputs within the
    // agent block labelled "claude"
    const claudeBlock = modal.locator('.settings-modal__agent-block', { hasText: "claude" });
    await claudeBlock.locator('input[placeholder="Model ID"]').fill("claude-test-custom");
    await claudeBlock.locator('input[placeholder="Label (optional)"]').fill("Test Custom");
    await claudeBlock.locator('button', { hasText: "Add" }).click();

    // Entry appears in the list
    await expect(modal.locator('text="claude-test-custom"')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D3-model-added.png" });

    // Close modal and reload the page
    await closeSettingsEsc(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".session-item").first()).toBeVisible({ timeout: 15000 });

    // Reopen modal — entry should still be there
    await openSettings(page);
    await expect(modal.locator('text="claude-test-custom"')).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: "artifacts/D3-model-persisted.png" });

    // Remove the entry and verify it disappears
    const claudeBlockAfter = modal.locator('.settings-modal__agent-block', { hasText: "claude" });
    const testRow = claudeBlockAfter.locator('.settings-modal__model-row', { hasText: "claude-test-custom" });
    await testRow.locator('button', { hasText: "Remove" }).click();
    await expect(modal.locator('text="claude-test-custom"')).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/D3-model-removed.png" });

    // Cleanup: remove any remaining test models from disk
    await closeSettingsEsc(page);
    cleanTestModels();
  });

  // ---------------------------------------------------------------------------
  // D4 — Input row pinned to bottom of chat pane
  // ---------------------------------------------------------------------------
  test("D4. input pinned to bottom", async ({ page }) => {
    await freshSession(page);

    // Make sure we're in Hosted mode (default) with a fresh session.
    // No messages yet so the input should be at the pane bottom.
    const chatPane = page.locator(".chat");
    const inputRow = page.locator(".chat__input");

    await expect(chatPane).toBeVisible({ timeout: 10000 });
    await expect(inputRow).toBeVisible({ timeout: 10000 });

    const chatBox = await chatPane.boundingBox();
    const inputBox = await inputRow.boundingBox();

    expect(chatBox).not.toBeNull();
    expect(inputBox).not.toBeNull();

    if (chatBox && inputBox) {
      const chatBottom = chatBox.y + chatBox.height;
      const inputBottom = inputBox.y + inputBox.height;
      // Input bottom should be within 80px of the chat pane bottom.
      const delta = Math.abs(chatBottom - inputBottom);
      expect(delta).toBeLessThanOrEqual(80);
    }

    await page.screenshot({ path: "artifacts/D4-input-pinned.png" });
  });
});
