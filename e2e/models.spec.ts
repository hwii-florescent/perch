/**
 * models.spec.ts — Stage B e2e tests, updated for Stage C restyle.
 *
 * B1 "model chip populated from server":
 *   In Hosted mode, the model chip (data-testid="model-chip") is visible and
 *   its popover lists at least 7 models for the claude agent, including
 *   "claude-fable-5" and "claude-haiku-4-5".
 *
 * B2 "model chip absent in CLI mode, present in Hosted":
 *   Run a quick hosted turn so there is a claude_session_id for CLI attach.
 *   Toggle ModeSwitch to CLI — assert model chip is NOT visible.
 *   Toggle back to Hosted — assert model chip IS visible again.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the model chip popover, click the claude agent tab, and collect all
 * model option text values. Closes the popover after. */
async function collectClaudeModels(page: Page): Promise<string[]> {
  // Open chip
  await page.locator('[data-testid="model-chip"]').click();
  // Ensure claude agent tab is selected
  await page.locator('[data-testid="agent-option-claude"]').click();
  // Collect all model option testids
  const buttons = page.locator('[data-testid^="model-option-"]');
  await expect(buttons.first()).toBeVisible({ timeout: 5000 });
  const count = await buttons.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const testid = await buttons.nth(i).getAttribute("data-testid") ?? "";
    ids.push(testid.replace("model-option-", ""));
  }
  // Close popover by pressing Escape (click-outside simulation via Escape)
  await page.keyboard.press("Escape");
  return ids;
}

/** Select agent + model via the model chip popover. */
async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
  // Popover closes automatically on model select
}

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------
test.describe("Stage B: model catalogue + agent-bar", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Helper: navigate to app with a fresh session
  // ---------------------------------------------------------------------------
  async function freshSession(page: Page): Promise<void> {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".session-item").first()).toBeVisible({ timeout: 15000 });
    // Wait for the model chip to appear (hosted mode, server.info received)
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 15000 });
  }

  // ---------------------------------------------------------------------------
  // B1 — model chip populated from server
  // ---------------------------------------------------------------------------
  test("B1. model chip populated from server", async ({ page }) => {
    await freshSession(page);

    // Open chip and switch to claude agent, collect models
    const modelIds = await collectClaudeModels(page);

    expect(modelIds.length).toBeGreaterThanOrEqual(7);
    expect(modelIds).toContain("claude-fable-5");
    expect(modelIds).toContain("claude-haiku-4-5");

    await page.screenshot({ path: "artifacts/B1-model-selector.png" });
  });

  // ---------------------------------------------------------------------------
  // B2 — model chip absent in CLI mode, present in Hosted mode
  // ---------------------------------------------------------------------------
  test("B2. model chip absent in CLI mode, present in Hosted", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping B2 (needs CLI attach)");
      return;
    }

    await freshSession(page);

    // Select claude + haiku via chip, run a quick hosted turn.
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Reply with exactly: ok");
    await page.locator(".chat__send").click();

    // Wait for the turn to complete.
    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Model chip must be visible in Hosted mode.
    const chip = page.locator('[data-testid="model-chip"]');
    await expect(chip).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/B2-01-hosted-bar-visible.png" });

    // Toggle to CLI mode.
    const modeSwitch = page.locator(".mode-switch");
    await expect(modeSwitch).toBeVisible({ timeout: 5000 });
    await modeSwitch.click();
    await expect(modeSwitch).toHaveAttribute("aria-checked", "true", { timeout: 5000 });

    // Model chip must be hidden/absent in CLI mode.
    await expect(chip).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/B2-02-cli-bar-hidden.png" });

    // Toggle back to Hosted mode.
    await modeSwitch.click();
    await expect(modeSwitch).toHaveAttribute("aria-checked", "false", { timeout: 5000 });

    // Model chip must be visible again.
    await expect(chip).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/B2-03-hosted-bar-back.png" });
  });
});
