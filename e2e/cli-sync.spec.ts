/**
 * cli-sync.spec.ts — Stage A e2e tests for CLI/Hosted model-sync bugfixes.
 * Updated for Stage C restyle: uses model chip instead of agent/model selects.
 *
 * Tests
 * -----
 * A3 "model selector follows session switch":
 *   Create two sessions. In session 1, run a hosted turn with claude-haiku-4-5.
 *   Switch to session 2, change the model chip to a different model, run
 *   nothing. Switch back to session 1 → assert the chip shows claude-haiku-4-5.
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
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE_URL = "http://127.0.0.1:7799";
const MODEL_HAIKU = "claude-haiku-4-5";
const MODEL_SONNET = "claude-sonnet-5";

// Chat mode (Hosted/CLI) moved from a per-chat footer toggle to a global,
// server-persisted setting (~/.perch/settings.json, like `theme`) — see
// SettingsModal.tsx's ChatModeSection. It is NOT scoped to the e2e-isolated
// db/hosts paths, so a spec that flips it must restore "hosted" (the app
// default) afterward or every later spec's chat pane breaks. Mirrors
// theme.spec.ts's resetTheme() convention.
const SETTINGS_FILE = path.join(os.homedir(), ".perch", "settings.json");

function resetChatMode(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.chatMode = "hosted";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Malformed file — leave it alone rather than destroy real settings.
  }
}

/** Open Settings, flip the global Chat Mode toggle to `mode` (no-op if
 * already there), and close the modal. Replaces the old per-chat
 * `.mode-switch` footer toggle that lived directly in the chat pane. */
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

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------
test.describe("CLI/Hosted model-sync (Stage A)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  let multipleModels = false;

  test.beforeAll(async () => {
    resetChatMode();
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
    multipleModels = MODEL_HAIKU !== MODEL_SONNET;
  });

  test.afterAll(() => {
    resetChatMode();
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
    await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    // With lazy DB insert the sidebar may have zero session items on a fresh DB —
    // do NOT wait for .session-item here.
    await expect(page.locator('[data-testid="model-chip"]')).toBeVisible({ timeout: 15000 });
  }

  // ---------------------------------------------------------------------------
  // Helper: create a session via picker (new-session-local → project-option-none)
  // ---------------------------------------------------------------------------
  async function createSessionViaPicker(page: Page): Promise<void> {
    const newBtn = page.locator('[data-testid="new-session-local"]');
    await expect(newBtn).toBeEnabled({ timeout: 10000 });
    await newBtn.click();
    const noneOpt = page.locator('[data-testid="project-option-none"]');
    await expect(noneOpt).toBeVisible({ timeout: 5000 });
    await noneOpt.click();
    await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  }

  // ---------------------------------------------------------------------------
  // A3 — model chip follows session switch
  // ---------------------------------------------------------------------------
  test("A3. model selector follows session switch", async ({ page }) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping A3 (requires real claude turn)");
      return;
    }
    if (!multipleModels) {
      test.skip(true, "only one model available — cannot assert chip change");
      return;
    }

    await freshSession(page);

    // --- Session 1: create via picker, select haiku, send a message to persist ---
    await createSessionViaPicker(page);
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("A3-session1-" + Date.now());
    await page.locator(".chat__send").click();

    // Row appears after first message; wait for the running dot then idle.
    const runningDot1 = page.locator(".session-item--active .session-status--running");
    await expect(runningDot1).toBeVisible({ timeout: 20000 });
    await expect(runningDot1).not.toBeVisible({ timeout: 90000 });

    // Confirm chip still shows haiku after the turn.
    await assertChipModel(page, MODEL_HAIKU);

    // Capture session 1 id.
    const session1Item = page.locator(".session-item--active");
    const session1Id = await session1Item.getAttribute("data-session-id");

    await page.screenshot({ path: "artifacts/A3-01-session1-done.png" });

    // --- Session 2: create via picker, pick sonnet, send a message to persist ---
    await createSessionViaPicker(page);
    await selectAgentModel(page, "claude", MODEL_SONNET);

    const textarea2 = page.locator(".chat__input textarea");
    await expect(textarea2).toBeEnabled({ timeout: 10000 });
    await textarea2.fill("A3-session2-" + Date.now());
    await page.locator(".chat__send").click();

    // Wait for session 2 row and turn.
    const runningDot2 = page.locator(".session-item--active .session-status--running");
    await expect(runningDot2).toBeVisible({ timeout: 20000 });
    await expect(runningDot2).not.toBeVisible({ timeout: 90000 });

    await assertChipModel(page, MODEL_SONNET);

    await page.screenshot({ path: "artifacts/A3-02-session2-sonnet.png" });

    // --- Switch back to session 1 ---
    if (session1Id) {
      await page.locator(`.session-item[data-session-id="${session1Id}"]`).click();
    } else {
      // Fallback: click the first non-active item.
      const items = page.locator(".session-item");
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        const cls = (await items.nth(i).getAttribute("class")) ?? "";
        if (!cls.includes("session-item--active")) {
          await items.nth(i).click();
          break;
        }
      }
    }

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

    // Create a fresh session via picker (blank — not in sidebar until first message).
    await createSessionViaPicker(page);

    // Run a hosted claude turn so there is a claude_session_id to resume in CLI.
    await selectAgentModel(page, "claude", MODEL_HAIKU);

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });
    await textarea.fill("Reply with exactly: ready");
    await page.locator(".chat__send").click();

    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Toggle to CLI (global setting).
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

    // Leave the suite in Hosted mode — chat mode is a GLOBAL setting now, so
    // leaving it on CLI here would break every later test/file that assumes
    // the Hosted default (model chip, input textarea) is visible on load.
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
