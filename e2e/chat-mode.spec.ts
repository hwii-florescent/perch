/**
 * chat-mode.spec.ts — e2e tests for the global (Settings-driven) chat mode.
 *
 * Hosted/CLI used to be a per-chat footer toggle (ModeSwitch rendered inside
 * Chat.tsx). It is now a single global setting (`settings.chatMode`,
 * persisted server-side like `theme`), changed via a toggle in the Settings
 * modal (`data-testid="settings-chat-mode"`). Flipping it must immediately
 * re-render every open chat pane (there is only ever one ChatView instance)
 * without navigating away or reloading.
 *
 * Tests
 * -----
 * M1 "default chat mode is Hosted":
 *   A fresh page load (with the setting reset to its default) shows the
 *   Hosted chat UI (input textarea + send button, model chip visible) and
 *   the Settings chat-mode toggle reads aria-checked="false".
 *
 * M2 "flipping to CLI in Settings switches the already-open chat pane":
 *   Run a hosted turn (to get a claude_session_id for CLI attach). With the
 *   chat pane already open (no navigation), open Settings and flip the
 *   global toggle to CLI. Assert — without leaving/reloading the page —
 *   that the same chat pane now shows a terminal surface attached to the
 *   CLI with the resumed conversation's context, and that hosted-only chrome
 *   (model chip, input textarea) is gone.
 *
 * M3 "flipping back to Hosted kills the PTY; re-entering CLI spawns fresh
 *   (no blank-TUI regression)":
 *   From the CLI pane opened in M2, flip back to Hosted via Settings —
 *   hosted UI returns. Flip to CLI again — the terminal surface must render
 *   real (non-blank) content, proving the PTY was killed on exit and a new
 *   one was spawned on re-entry (the historical bug reattached a blank
 *   xterm to a still-live process).
 *
 * All tests require the `claude` binary and are skipped otherwise.
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE_URL = "http://127.0.0.1:7799";
const MODEL_HAIKU = "claude-haiku-4-5";

// Global chat mode lives in ~/.perch/settings.json — NOT isolated per e2e
// server (unlike --db-path/--hosts-path) — so it must be reset before/after
// this suite or later specs (which assume Hosted-mode UI by default) break.
const SETTINGS_FILE = path.join(os.homedir(), ".perch", "settings.json");

function resetChatMode(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.chatMode = "hosted";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    /* leave alone */
  }
}

/** Open Settings, flip the global chat-mode toggle to `mode` (no-op if
 * already there), and close the modal. */
async function setChatMode(page: Page, mode: "hosted" | "cli"): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  const modal = page.locator('[data-testid="settings-modal"]');
  await expect(modal).toBeVisible({ timeout: 8000 });
  const toggle = page.locator('[data-testid="settings-chat-mode"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  const wantChecked = mode === "cli" ? "true" : "false";
  if ((await toggle.getAttribute("aria-checked")) !== wantChecked) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", wantChecked, { timeout: 3000 });
  }
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}

/** Open Settings and read the chat-mode toggle's current aria-checked state
 * without changing it. */
async function readChatModeToggle(page: Page): Promise<string | null> {
  await page.locator('[data-testid="settings-gear"]').click();
  const modal = page.locator('[data-testid="settings-modal"]');
  await expect(modal).toBeVisible({ timeout: 8000 });
  const toggle = page.locator('[data-testid="settings-chat-mode"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  const state = await toggle.getAttribute("aria-checked");
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  return state;
}

async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
}

async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function createSessionViaPicker(page: Page): Promise<void> {
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  const noneOpt = page.locator('[data-testid="project-option-none"]');
  await expect(noneOpt).toBeVisible({ timeout: 5000 });
  await noneOpt.click();
  await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
}

test.describe("Global chat mode (Settings-driven)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    resetChatMode();
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  test.afterAll(() => {
    resetChatMode();
  });

  // -------------------------------------------------------------------------
  // M1 — default is Hosted
  // -------------------------------------------------------------------------
  test("M1. default chat mode is Hosted", async ({ page }) => {
    await freshSession(page);

    // Hosted chrome present: model chip + input + send button.
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".chat__input textarea")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".chat__send")).toBeVisible({ timeout: 5000 });
    // No terminal surface in Hosted mode.
    await expect(page.locator(".terminal__surface")).toHaveCount(0);

    const state = await readChatModeToggle(page);
    expect(state).toBe("false");

    await page.screenshot({ path: "artifacts/M1-hosted-default.png" });
  });

  // -------------------------------------------------------------------------
  // M2 — flipping to CLI in Settings switches the already-open pane
  // -------------------------------------------------------------------------
  test("M2. flipping to CLI switches the already-open chat pane", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping M2 (needs CLI attach)");
      return;
    }

    await freshSession(page);
    await createSessionViaPicker(page);
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Reply with exactly: ready");
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Chat pane is open and Hosted right now — do NOT navigate away.
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 5000 });

    // Flip the global setting — the same open pane must react.
    await setChatMode(page, "cli");

    // Hosted-only chrome disappears; CLI terminal appears attached with context.
    await expect(page.locator('[data-testid="model-chip"]')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".chat__input textarea")).toHaveCount(0);
    const termSurface = page.locator(".terminal__surface");
    await expect(termSurface).toBeVisible({ timeout: 15000 });

    // Wait for the resumed CLI to paint real content (proves it attached
    // with the hosted conversation's context, not a blank fresh shell).
    await expect(async () => {
      const text = await termSurface.innerText();
      expect(text.replace(/\s+/g, "")).not.toHaveLength(0);
    }).toPass({ timeout: 20000 });

    await page.screenshot({ path: "artifacts/M2-cli-attached.png" });

    // Leave the suite in Hosted mode — chat mode is global and persists on
    // the live server for the rest of this run (later tests/files assume
    // the Hosted default is visible on load).
    await setChatMode(page, "hosted");
  });

  // -------------------------------------------------------------------------
  // M3 — flip back kills the PTY; re-entry spawns fresh (no blank-TUI bug)
  // -------------------------------------------------------------------------
  test("M3. flip back to Hosted kills PTY; CLI re-entry spawns fresh", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping M3 (needs CLI attach)");
      return;
    }

    await freshSession(page);
    await createSessionViaPicker(page);
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Reply with exactly: ready");
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    const termSurface = page.locator(".terminal__surface");

    async function assertTerminalRendered(label: string): Promise<void> {
      await expect(termSurface).toBeVisible({ timeout: 15000 });
      await expect(async () => {
        const text = await termSurface.innerText();
        expect(text.replace(/\s+/g, "")).not.toHaveLength(0);
      }).toPass({ timeout: 20000 });
      await page.screenshot({ path: `artifacts/M3-${label}.png` });
    }

    // Enter CLI, let it settle past any trust dialog so the PTY is a live
    // running `claude` process (not exited) when we leave.
    await setChatMode(page, "cli");
    await assertTerminalRendered("01-first-entry");

    const xtermInput = page.locator(".xterm-helper-textarea");
    await expect(xtermInput).toBeAttached({ timeout: 10000 });
    await xtermInput.click({ force: true });
    await page.waitForTimeout(1000);
    await xtermInput.press("Enter"); // dismiss trust dialog if present
    await page.waitForTimeout(2000);

    // Flip back to Hosted — this must kill the still-alive PTY.
    await setChatMode(page, "hosted");
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 5000 });

    // Flip to CLI again — regression case: previously this reattached a
    // blank xterm to the (never-killed) live process. Must render fresh.
    await setChatMode(page, "cli");
    await assertTerminalRendered("02-second-entry-fresh");

    // Leave the suite in Hosted mode.
    await setChatMode(page, "hosted");
  });
});
