/**
 * federation.spec.ts — Stage F3 e2e tests for hub federation.
 *
 * Two perch instances run in parallel:
 *   A (hub)    — :7799   default ~/.perch/history.sqlite + ~/.perch/hosts.json
 *   B (remote) — :7800   /tmp/perch-e2e-remote.sqlite + /tmp/perch-e2e-remote-hosts.json
 *
 * Raw WebSocket control uses the Node 22 built-in `WebSocket` global —
 * no external `ws` package needed.
 *
 * Tests (serial):
 *   E1 — sidebar shows "test-remote" section with connected dot
 *   E2 — "+" on remote section creates a session under that section
 *   E3 — remote hosted chat turn streams and completes (proves proxy chain)
 *   E4 — remote CLI mode: ModeSwitch → terminal renders → /exit → exited banner
 *   E5 — disable host in settings → disabled dot; re-enable → connected dot
 *
 * Screenshots saved to e2e/screenshots-federation/ (NOT under artifacts/ which
 * Playwright wipes on each run).
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const WS_URL_A = "ws://127.0.0.1:7799/ws";
const REMOTE_HOST_ID = "e2e-remote";
const REMOTE_HOST_NAME = "test-remote";
const SCREENSHOT_DIR = "screenshots-federation";

// ---------------------------------------------------------------------------
// Native-WebSocket helpers (Node 22 global WebSocket)
// ---------------------------------------------------------------------------

/** Open a raw WebSocket to the given URL and return it once OPEN. */
function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (ev) => reject(new Error(`WebSocket error connecting to ${url}: ${String(ev)}`));
  });
}

/** Send a JSON message on an open WebSocket. */
function wsSend(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

/**
 * Wait for a specific message `type` from the WS, optionally filtered by
 * `predicate`.  Rejects after `timeoutMs`.
 */
function waitForMessage(
  ws: WebSocket,
  type: string,
  predicate: (msg: Record<string, unknown>) => boolean = () => true,
  timeoutMs = 20000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for WS message type="${type}"`));
    }, timeoutMs);

    const prev = ws.onmessage;

    ws.onmessage = (ev) => {
      // Chain to any pre-existing handler.
      if (prev) (prev as EventListener)(ev as Event);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(ev.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (parsed.type === type && predicate(parsed)) {
        clearTimeout(timer);
        ws.onmessage = prev; // restore
        resolve(parsed);
      }
    };

    ws.onclose = () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket closed while waiting for type="${type}"`));
    };
  });
}

/**
 * Clean up any stale "e2e-remote" host entry from instance A so reruns are
 * deterministic.
 */
async function deleteRemoteHostIfPresent(): Promise<void> {
  const ws = await openWs(WS_URL_A);
  try {
    wsSend(ws, { type: "hosts.list" });
    const listMsg = await waitForMessage(ws, "hosts.list", () => true, 10000);
    const hosts = (listMsg.hosts ?? []) as Array<{ id: string }>;
    if (!hosts.some((h) => h.id === REMOTE_HOST_ID)) return;

    wsSend(ws, { type: "hosts.delete", id: REMOTE_HOST_ID });
    await waitForMessage(
      ws,
      "hosts.updated",
      (m) => {
        const hs = (m.hosts ?? []) as Array<{ id: string }>;
        return !hs.some((h) => h.id === REMOTE_HOST_ID);
      },
      10000,
    );
  } finally {
    ws.close();
  }
}

/**
 * Upsert the "e2e-remote" host on instance A and wait for hub to report
 * state:"connected" (timeout 20 s).
 */
async function upsertRemoteHost(): Promise<void> {
  const ws = await openWs(WS_URL_A);
  try {
    wsSend(ws, {
      type: "hosts.upsert",
      host: {
        id: REMOTE_HOST_ID,
        name: REMOTE_HOST_NAME,
        sshHost: "",
        remotePort: 7800,
        enabled: true,
        directUrl: "ws://127.0.0.1:7800/ws",
      },
    });

    await waitForMessage(
      ws,
      "host.info",
      (m) => m.hostId === REMOTE_HOST_ID && m.state === "connected",
      20000,
    );
  } finally {
    ws.close();
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Navigate with a fresh localStorage-cleared session. */
async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  // With Fix 3 (lazy DB insert) the sidebar may have zero items on a fresh DB.
  // Only wait for the sidebar wrapper itself, not for session items.
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Take a screenshot to the federation-specific directory. */
async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}` });
}

/** Select agent + model via the ModelChip popover. */
async function selectAgentModel(page: Page, agentId: string, modelId: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator(`[data-testid="agent-option-${agentId}"]`).click();
  await page.locator(`[data-testid="model-option-${modelId}"]`).click();
}

/**
 * Open the new-session picker for the given hostId and choose "No project".
 * This is the Fix 2 flow: clicking "+" opens a popover instead of directly
 * creating a session.
 */
async function createRemoteSessionViaPicker(page: Page, hostId: string): Promise<void> {
  const newBtn = page.locator(`[data-testid="new-session-${hostId}"]`);
  await expect(newBtn).toBeEnabled({ timeout: 5000 });
  await newBtn.click();
  const noneOpt = page.locator('[data-testid="project-option-none"]');
  await expect(noneOpt).toBeVisible({ timeout: 5000 });
  await noneOpt.click();
  await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
}

/** Open the settings modal via the gear button. */
async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Stage F3: federation e2e", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    // Check claude binary availability.
    const { execSync } = await import("child_process");
    try {
      execSync(
        '[ -x ~/.local/bin/claude ] && echo ok || which claude',
        { encoding: "utf8", shell: "/bin/sh" },
      );
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }

    // Clean stale entry from a previous run.
    await deleteRemoteHostIfPresent();

    // Register the remote host and wait for connection.
    await upsertRemoteHost();
  });

  test.afterAll(async () => {
    // Best-effort cleanup: remove test host entry.
    try {
      const ws = await openWs(WS_URL_A);
      try {
        wsSend(ws, { type: "hosts.delete", id: REMOTE_HOST_ID });
        await waitForMessage(
          ws,
          "hosts.updated",
          (m) => {
            const hs = (m.hosts ?? []) as Array<{ id: string }>;
            return !hs.some((h) => h.id === REMOTE_HOST_ID);
          },
          10000,
        );
      } finally {
        ws.close();
      }
    } catch {
      // Don't fail the suite on cleanup failure.
    }
  });

  // -------------------------------------------------------------------------
  // E1 — sidebar shows "test-remote" section with connected dot (≤15s)
  // -------------------------------------------------------------------------
  test("E1. sidebar shows test-remote section with connected dot", async ({ page }) => {
    await freshSession(page);

    const hostSection = page.locator(".sidebar__host-section", { hasText: REMOTE_HOST_NAME });
    await expect(hostSection).toBeVisible({ timeout: 15000 });

    const connectedDot = hostSection.locator(".host-state--connected");
    await expect(connectedDot).toBeVisible({ timeout: 15000 });

    await shot(page, "fed-e1-connected.png");
  });

  // -------------------------------------------------------------------------
  // E2 — "+" on remote section creates a session under test-remote
  // -------------------------------------------------------------------------
  test("E2. new-session picker creates remote session", async ({ page }) => {
    test.setTimeout(120000);
    await freshSession(page);

    const hostSection = page.locator(".sidebar__host-section", { hasText: REMOTE_HOST_NAME });
    await expect(hostSection).toBeVisible({ timeout: 15000 });
    await expect(hostSection.locator(".host-state--connected")).toBeVisible({ timeout: 15000 });

    // Capture session id before creating the remote session.
    const idBefore = await page.evaluate(() => localStorage.getItem("perch.sessionId"));

    // Open picker via the remote host's "+" button and choose "No project".
    // Fix 2: clicking "+" opens a popover (not direct creation).
    await createRemoteSessionViaPicker(page, REMOTE_HOST_ID);

    // The server sends back session.created — localStorage must be updated.
    await page.waitForFunction(
      (before: string | null) => localStorage.getItem("perch.sessionId") !== before,
      idBefore,
      { timeout: 10000 },
    );

    const newId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(newId).toBeTruthy();

    // Fix 3: blank remote session is NOT inserted into the remote DB yet, so
    // it does NOT appear in the sidebar.  We verify the active session belongs
    // to the remote host by checking the active session item when it does appear
    // (after a message is sent), OR simply verify the session.created handshake
    // completed (localStorage updated above).
    //
    // If claude is available, send a quick message so the session persists and
    // appears under the remote section.
    if (claudeAvailable) {
      const countBeforeMsg = await hostSection.locator(".session-item").count();
      await selectAgentModel(page, "claude", "claude-haiku-4-5");
      const textarea = page.locator(".chat__input textarea");
      await expect(textarea).toBeEnabled({ timeout: 8000 });
      await textarea.fill("Reply with exactly: e2-remote");
      await page.locator(".chat__send").click();

      // Wait for session to appear under the remote host section.
      const remoteItems = hostSection.locator(".session-item");
      await expect(remoteItems).toHaveCount(countBeforeMsg + 1, { timeout: 15000 });

      // Active session must be under the remote section.
      const activeInRemote = hostSection.locator(".session-item--active");
      await expect(activeInRemote).toBeVisible({ timeout: 10000 });

      const runningDot = hostSection.locator(".session-item--active .session-status--running");
      await expect(runningDot).toBeVisible({ timeout: 20000 });
      await expect(runningDot).not.toBeVisible({ timeout: 90000 });
    }

    await shot(page, "fed-e2-remote-session.png");
  });

  // -------------------------------------------------------------------------
  // E3 — remote hosted chat turn streams end-to-end (90 s timeout)
  // -------------------------------------------------------------------------
  test("E3. remote hosted chat turn relayed through hub", async ({ page }) => {
    test.setTimeout(120000);

    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping E3");
      return;
    }

    await freshSession(page);

    const hostSection = page.locator(".sidebar__host-section", { hasText: REMOTE_HOST_NAME });
    await expect(hostSection).toBeVisible({ timeout: 15000 });
    await expect(hostSection.locator(".host-state--connected")).toBeVisible({ timeout: 15000 });

    // Create a remote session via picker (Fix 2 flow).
    await createRemoteSessionViaPicker(page, REMOTE_HOST_ID);

    // Select claude-haiku-4-5.
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });

    // Capture count before sending — E2 may have already left a remote session row.
    const remoteItems = hostSection.locator(".session-item");
    const countBeforeE3 = await remoteItems.count();

    await textarea.fill("Reply with exactly: remote-pong");
    await page.locator(".chat__send").click();

    // Session persists after first message — count must increase by 1.
    await expect(remoteItems).toHaveCount(countBeforeE3 + 1, { timeout: 15000 });

    // Running dot appears on the remote session.
    const runningDot = hostSection.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });

    await shot(page, "fed-e3-remote-chat.png");

    // Turn completes.
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Assistant message contains "remote-pong".
    const assistantMsg = page.locator(".message--assistant").last();
    await expect(assistantMsg).toBeVisible({ timeout: 10000 });
    const msgText = await assistantMsg.textContent();
    expect(msgText).toMatch(/remote-pong/i);

    await shot(page, "fed-e3-remote-chat-done.png");
  });

  // -------------------------------------------------------------------------
  // E4 — remote CLI mode: ModeSwitch → terminal relay → /exit → exited banner
  // -------------------------------------------------------------------------
  test("E4. remote CLI terminal relay through hub", async ({ page }) => {
    test.setTimeout(120000);

    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping E4");
      return;
    }

    await freshSession(page);

    const hostSection = page.locator(".sidebar__host-section", { hasText: REMOTE_HOST_NAME });
    await expect(hostSection).toBeVisible({ timeout: 15000 });
    await expect(hostSection.locator(".host-state--connected")).toBeVisible({ timeout: 15000 });

    // Create a remote session via picker (Fix 2 flow) and run a hosted turn so
    // there's a claude session id for the CLI to attach to.
    await createRemoteSessionViaPicker(page, REMOTE_HOST_ID);

    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });

    // Capture count before sending — previous tests may have left remote session rows.
    const countBeforeE4 = await hostSection.locator(".session-item").count();

    await textarea.fill("Reply with exactly: cli-ready");
    await page.locator(".chat__send").click();

    // Wait for the session to appear in the remote section and the turn to complete.
    await expect(hostSection.locator(".session-item")).toHaveCount(countBeforeE4 + 1, { timeout: 15000 });
    const runningDot = hostSection.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Switch to CLI mode.
    const modeSwitch = page.locator(".mode-switch");
    await expect(modeSwitch).toBeVisible({ timeout: 5000 });
    await modeSwitch.click();
    await expect(modeSwitch).toHaveAttribute("aria-checked", "true", { timeout: 5000 });

    // Terminal surface must appear (proves terminal.created relay through hub).
    const termSurface = page.locator(".terminal__surface");
    await expect(termSurface).toBeVisible({ timeout: 20000 });

    // Brief pause for the remote CLI to start outputting data.
    await page.waitForTimeout(3000);

    await shot(page, "fed-e4-cli-relay.png");

    // xterm.js captures keyboard input via a hidden textarea (.xterm-helper-textarea).
    // Click it to focus, then interact with the CLI.
    const xtermInput = page.locator(".xterm-helper-textarea");
    await expect(xtermInput).toBeAttached({ timeout: 10000 });
    await xtermInput.click({ force: true });

    // The CLI may show a trust dialog on first attach — press Enter to accept
    // ("Yes, I trust this folder"), then wait for the interactive prompt.
    await page.waitForTimeout(1000);
    await xtermInput.press("Enter"); // dismiss trust dialog if present
    await page.waitForTimeout(2000); // let the CLI reach its interactive prompt

    // Send /exit — proves terminal.input relay.
    await xtermInput.click({ force: true });
    await page.keyboard.type("/exit");
    await page.keyboard.press("Enter");

    // Exited banner must appear — proves terminal.exit relay.
    const exitedBanner = page.locator(".terminal__exited");
    await expect(exitedBanner).toBeVisible({ timeout: 40000 });

    await shot(page, "fed-e4-cli-exited.png");

    // Return to Hosted mode.
    await modeSwitch.click();
    await expect(modeSwitch).toHaveAttribute("aria-checked", "false", { timeout: 5000 });
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // E5 — disable → disabled dot (≤10s); re-enable → connected dot (≤20s)
  // -------------------------------------------------------------------------
  test("E5. enable/disable host changes sidebar dot state", async ({ page }) => {
    await freshSession(page);

    const hostSection = page.locator(".sidebar__host-section", { hasText: REMOTE_HOST_NAME });
    await expect(hostSection).toBeVisible({ timeout: 15000 });
    await expect(hostSection.locator(".host-state--connected")).toBeVisible({ timeout: 15000 });

    // Open settings and locate the test-remote row.
    await openSettings(page);
    const modal = page.locator('[data-testid="settings-modal"]');
    const hostRow = modal.locator(".settings-modal__host-row", { hasText: REMOTE_HOST_NAME });
    await expect(hostRow).toBeVisible({ timeout: 5000 });

    // Uncheck enabled.
    const checkbox = hostRow.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked({ timeout: 3000 });
    await checkbox.click();
    await expect(checkbox).not.toBeChecked({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Sidebar dot becomes disabled.
    await expect(hostSection.locator(".host-state--disabled")).toBeVisible({ timeout: 10000 });

    await shot(page, "fed-e5-disabled.png");

    // Re-open settings and re-enable.
    await openSettings(page);
    const hostRowB = modal.locator(".settings-modal__host-row", { hasText: REMOTE_HOST_NAME });
    await expect(hostRowB).toBeVisible({ timeout: 5000 });

    const checkboxB = hostRowB.locator('input[type="checkbox"]');
    await expect(checkboxB).not.toBeChecked({ timeout: 3000 });
    await checkboxB.click();
    await expect(checkboxB).toBeChecked({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Sidebar dot reconnects to connected.
    await expect(hostSection.locator(".host-state--connected")).toBeVisible({ timeout: 20000 });

    await shot(page, "fed-e5-reconnected.png");
  });
});
