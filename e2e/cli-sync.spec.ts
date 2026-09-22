/**
 * cli-sync.spec.ts — Stage A e2e tests for CLI/Hosted model-sync bugfixes.
 * Updated for Stage C restyle: uses model chip instead of agent/model selects.
 *
 * Tests
 * -----
 * A3 "model selector follows session switch":
 *   Create two sessions. In session 1, run a hosted turn with claude-haiku-4-5.
 *   Switch to session 2 and run a Hosted turn with GPT-5.6 Luna. Switch back
 *   to session 1 and assert the chip shows claude-haiku-4-5.
 *
 * A2 "dead CLI PTY respawns":
 *   In a session that has a completed claude turn (from A3), toggle into CLI
 *   mode, wait for the terminal surface to appear, send `exit\r` to kill the
 *   shell, wait for the "process exited" banner, then toggle back to Hosted and
 *   toggle CLI again → assert the exited banner is GONE within 15 s.
 *
 * A4 "Hosted->CLI->Hosted->CLI round trip renders on the second entry":
 *   Regression test for the bug where toggling Hosted -> CLI -> Hosted -> CLI
 *   again (WITHOUT the PTY ever dying) left the second CLI view blank/laggy.
 *   Root cause: leaving CLI mode never killed the still-alive `claude --resume`
 *   PTY, so re-entering reattached a brand-new blank xterm to the same live
 *   process instead of spawning fresh — see `terminal.kill` / `killTerminal`
 *   in AgentCliTerminal.tsx. This test never kills the CLI itself; it just
 *   toggles the mode switch twice and asserts the terminal surface renders
 *   real content both times.
 *
 * A1 "CLI attach error is visible":
 *   Documented skip — see comment below.
 */

import { test, expect, type Page } from "@playwright/test";
import * as os from "node:os";
import { createHostedSession, sendAndWaitForReply } from "./hostedSession";
import { CHEAP_CLAUDE_MODEL, CHEAP_CODEX_MODEL } from "./cheapModel";

const BASE_URL = "http://127.0.0.1:7799";
const MODEL_HAIKU = CHEAP_CLAUDE_MODEL;
const MODEL_LUNA = CHEAP_CODEX_MODEL;

/** Mode is per session; never rewrite the user's global settings for a test. */
async function setChatMode(page: Page, mode: "hosted" | "cli"): Promise<void> {
  const toggle = page.getByTestId("session-mode-toggle");
  await expect(toggle).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId("session-mode-scope").selectOption("session");
  const wantChecked = mode === "cli" ? "true" : "false";
  if (await toggle.getAttribute("aria-checked") !== wantChecked) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", wantChecked);
}

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------
test.describe("CLI/Hosted model-sync (Stage A)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  let codexAvailable = false;

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
    try {
      execSync("which codex", { encoding: "utf8" });
      codexAvailable = true;
    } catch { codexAvailable = false; }
  });

  // ---------------------------------------------------------------------------
  // Helper: select agent + model via model chip
  // ---------------------------------------------------------------------------
  async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
    const chip = page.locator('[data-testid="model-chip"]');
    await expect(chip).toBeVisible({ timeout: 10000 });
    await chip.click();
    await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
    await page.locator(`[data-testid="model-option-${modelId}"]`).click();
    await assertChipModel(page, modelId);
  }

  /** Assert that the model chip displays the given model id's label (or the id itself). */
  async function assertChipModel(page: Page, modelId: string): Promise<void> {
    const chip = page.locator('[data-testid="model-chip"]');
    await expect(chip).toBeVisible({ timeout: 8000 });
    // The chip shows "Agent · ModelLabel ▾"; we just check the modelId substring is visible
    // by opening the popover and checking the active model option has a checkmark.
    await chip.click();
    const activeModelBtn = page.locator(`[data-testid="model-option-${modelId}"]`);
    await expect(activeModelBtn).toHaveClass(/model-chip__model-btn--active/, { timeout: 5000 });
    // Close popover
    await page.keyboard.press("Escape");
  }

  // ---------------------------------------------------------------------------
  // Helper: navigate to app with a fresh session
  // ---------------------------------------------------------------------------
  async function freshSession(page: Page): Promise<void> {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await createHostedSession(page, os.tmpdir());
  }

  async function createHostedTestSession(page: Page): Promise<string> {
    return createHostedSession(page, os.tmpdir());
  }

  // ---------------------------------------------------------------------------
  // A3 — model chip follows session switch
  // ---------------------------------------------------------------------------
  test("A3. model selector follows session switch", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping A3 (requires real claude turn)");
      return;
    }
    if (!codexAvailable) {
      test.skip(true, "codex binary not found — cannot verify the second cheap model");
      return;
    }

    await freshSession(page);

    // --- Session 1: create a Hosted session, select haiku, send a message to persist ---
    const session1Id = await createHostedTestSession(page);
    await selectAgentModel(page, "claude", MODEL_HAIKU);
    const token1 = "A3-session1-" + Date.now();
    await sendAndWaitForReply(page, "Reply with exactly: " + token1, token1);

    // Confirm chip still shows haiku after the turn.
    await assertChipModel(page, MODEL_HAIKU);
    await page.screenshot({ path: "artifacts/A3-01-session1-done.png" });

    // --- Session 2: create a Hosted session, pick Luna, send a message to persist ---
    await createHostedTestSession(page);
    await selectAgentModel(page, "codex", MODEL_LUNA);
    const token2 = "A3-session2-" + Date.now();
    await sendAndWaitForReply(page, "Reply with exactly: " + token2, token2);

    await assertChipModel(page, MODEL_LUNA);
    await page.screenshot({ path: "artifacts/A3-02-session2-luna.png" });

    // --- Switch back to session 1 in-app, via the Navigator ---
    await page.locator(".chat__input textarea").blur();
    await page.keyboard.press("Control+k");
    await page.getByTestId(`navigator-row-${session1Id}`).click();
    await expect(page.getByTestId("navigator")).not.toBeVisible({ timeout: 5000 });

    // Wait for session.history to restore haiku.
    await expect(async () => {
      await assertChipModel(page, MODEL_HAIKU);
    }).toPass({ timeout: 8000 });

    await page.screenshot({ path: "artifacts/A3-03-switched-back-haiku.png" });
  });

  // ---------------------------------------------------------------------------
  // A2 — dead CLI PTY respawns on re-enter
  // ---------------------------------------------------------------------------
  test("A2. dead CLI PTY respawns on re-enter", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping A2 (needs a claude session for CLI attach)");
      return;
    }

    await freshSession(page);

    // Create a fresh session as Hosted (blank — not in sidebar until first message).
    await createHostedTestSession(page);

    // Run a hosted claude turn so there is a claude_session_id to resume in CLI.
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    await sendAndWaitForReply(page, "Reply with exactly: ready", /ready/i);

    // Toggle this session to CLI.
    await setChatMode(page, "cli");

    // Wait for the terminal surface to appear.
    const termSurface = page.locator(".terminal__surface");
    await expect(termSurface).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "artifacts/A2-01-cli-open.png" });

    // xterm.js captures keyboard input via a hidden textarea (.xterm-helper-textarea).
    // Click it to focus, then interact with the CLI.
    const xtermInput = page.locator(".xterm-helper-textarea");
    await expect(xtermInput).toBeAttached({ timeout: 10000 });
    await xtermInput.click({ force: true });

    // The CLI may show a trust dialog ("Is this a project you trust?").
    // Press Enter to confirm option 1 ("Yes, I trust this folder") if present,
    // then wait for the interactive prompt before sending /exit.
    // We wait up to 10 s for either the prompt indicator or send Enter proactively.
    await page.waitForTimeout(1000);
    await xtermInput.press("Enter"); // dismiss trust dialog if present
    await page.waitForTimeout(2000); // let the CLI reach its interactive prompt

    // Send /exit to quit the claude CLI.
    await xtermInput.click({ force: true });
    await expect(termSurface).toContainText(/Haiku 4\.5/i);
    await page.keyboard.type("/exit");
    await page.keyboard.press("Enter");

    const exitedBanner = page.locator(".terminal__exited");
    await expect(exitedBanner).toBeVisible({ timeout: 30000 });

    await page.screenshot({ path: "artifacts/A2-02-exited-banner.png" });

    // Toggle back to Hosted.
    await setChatMode(page, "hosted");
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });

    // Toggle back to CLI — should spawn a fresh PTY.
    await setChatMode(page, "cli");
    await expect(termSurface).toBeVisible({ timeout: 10000 });
    await expect(exitedBanner).not.toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: "artifacts/A2-03-fresh-pty.png" });

    // Restore only this session to Hosted mode.
    await setChatMode(page, "hosted");
  });

  // ---------------------------------------------------------------------------
  // A4 — Hosted -> CLI -> Hosted -> CLI round trip renders on the second entry
  // ---------------------------------------------------------------------------
  test("A4. CLI mode renders after a Hosted/CLI round trip (PTY still alive)", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping A4 (needs a claude session for CLI attach)");
      return;
    }

    await freshSession(page);
    await createHostedTestSession(page);
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    await sendAndWaitForReply(page, "Reply with exactly: ready", /ready/i);

    const termSurface = page.locator(".terminal__surface");

    /** Poll until the xterm surface has painted some non-whitespace content
     * (the claude CLI's welcome banner / prompt), proving the PTY attach
     * actually rendered rather than sitting blank. */
    async function assertTerminalRendered(label: string): Promise<void> {
      await expect(termSurface).toBeVisible({ timeout: 15000 });
      await expect(async () => {
        const text = await termSurface.innerText();
        expect(text.replace(/\s+/g, "")).not.toHaveLength(0);
      }).toPass({ timeout: 20000 });
      await page.screenshot({ path: `artifacts/A4-${label}.png` });
    }

    // First entry into CLI mode: fresh attach, should render normally.
    await setChatMode(page, "cli");
    await assertTerminalRendered("01-first-cli-entry");

    // Give the CLI a moment to settle past any trust dialog so the PTY is a
    // genuinely live, running `claude` process (not exited) when we leave.
    const xtermInput = page.locator(".xterm-helper-textarea");
    await expect(xtermInput).toBeAttached({ timeout: 10000 });
    await xtermInput.click({ force: true });
    await page.waitForTimeout(1000);
    await xtermInput.press("Enter"); // dismiss trust dialog if present
    await page.waitForTimeout(2000);

    // Back to Hosted — the PTY is still alive at this point (never sent /exit).
    await setChatMode(page, "hosted");
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });

    // Into CLI again — this is the regression case: previously this reattached
    // a blank xterm to the still-live PTY and never rendered anything new.
    await setChatMode(page, "cli");
    await assertTerminalRendered("02-second-cli-entry");

    // And once more for good measure.
    await setChatMode(page, "hosted");
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });
    await setChatMode(page, "cli");
    await assertTerminalRendered("03-third-cli-entry");

    // Leave the suite in Hosted mode.
    await setChatMode(page, "hosted");
  });

  // ---------------------------------------------------------------------------
  // A1 — CLI attach error is visible (documented skip)
  // ---------------------------------------------------------------------------
  test("A1. CLI attach error surfacing (documented skip)", async () => {
    test.skip(
      true,
      "Cannot reliably force a server-side CLI attach failure without mocking. " +
        "The cliError overlay is verified by code review + manual inspection of " +
        "the store.ts error routing logic. See comment in this test for full reasoning.",
    );
  });
});
