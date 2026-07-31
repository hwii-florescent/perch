/**
 * federation.spec.ts — Stage F3 e2e tests for hub federation.
 *
 * Two perch instances run in parallel:
 *   A (hub)    — :7799   /tmp/perch-e2e-hub.sqlite + /tmp/perch-e2e-hub-hosts.json
 *   B (remote) — :7800   /tmp/perch-e2e-remote.sqlite + /tmp/perch-e2e-remote-hosts.json
 *
 * Raw WebSocket control uses the Node 22 built-in `WebSocket` global —
 * no external `ws` package needed.
 *
 * Since the nav redesign the sidebar shows ONE host at a time: remote hosts
 * live in the host-switcher popover (the environment chip is a button), and
 * selecting one re-scopes the whole sidebar — and the tab bar — to it. These
 * tests therefore switch to "test-remote" first and then assert against the
 * plain, now host-scoped, sidebar session list.
 *
 * Tests (serial):
 *   E1 — host switcher lists "test-remote" with a connected dot
 *   E2 — "+ New session" on the remote host creates a session under it
 *   E3 — remote hosted chat turn streams and completes (proves proxy chain)
 *   E4 — remote CLI mode: ModeSwitch → terminal renders → /exit → exited banner
 *   E5 — disable host in settings → disabled dot in the switcher; re-enable → connected
 *
 * Screenshots saved to e2e/screenshots-federation/ (NOT under artifacts/ which
 * Playwright wipes on each run).
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://127.0.0.1:7799";
const WS_URL_A = "ws://127.0.0.1:7799/ws";
const REMOTE_HOST_ID = "e2e-remote";
const REMOTE_HOST_NAME = "test-remote";
const SCREENSHOT_DIR = "screenshots-federation";

// Deliberately-unreachable ssh target for the "actionable error, not stuck
// connecting" test below. There's no local sshd in this environment (ssh
// localhost fails with "Connection refused"), so per the runbook we use an
// unresolvable hostname instead of pointing sshHost at the local machine.
const BROKEN_HOST_ID = "e2e-broken";
const BROKEN_HOST_NAME = "test-broken";
const BROKEN_SSH_HOST = "e2e-unreachable-host.invalid";

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
 * Collect every message of `type` matching `predicate` received during a
 * fixed `windowMs` window, then resolve with the whole list. Used where we
 * need to observe a *sequence* of state transitions (e.g. proving a host
 * keeps cycling error → connecting → error instead of getting stuck), rather
 * than just the first matching message.
 */
function collectMessages(
  ws: WebSocket,
  type: string,
  predicate: (msg: Record<string, unknown>) => boolean,
  windowMs: number,
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve) => {
    const collected: Record<string, unknown>[] = [];
    const prev = ws.onmessage;

    ws.onmessage = (ev) => {
      if (prev) (prev as EventListener)(ev as Event);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(ev.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (parsed.type === type && predicate(parsed)) {
        collected.push(parsed);
      }
    };

    setTimeout(() => {
      ws.onmessage = prev;
      resolve(collected);
    }, windowMs);
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
 * Open the sidebar's host-switcher popover (the environment chip is the
 * button). Returns the popover locator.
 */
async function openHostSwitcher(page: Page) {
  await page.locator('[data-testid="host-switcher"]').click();
  const popover = page.locator('[data-testid="host-switcher-popover"]');
  await expect(popover).toBeVisible({ timeout: 8000 });
  return popover;
}

/** The switcher-popover row for a host, scoped so its state dot is queryable. */
function hostRow(popover: ReturnType<Page["locator"]>, name: string) {
  return popover.locator(".host-switcher-popover__row", { hasText: name });
}

/** Switch the sidebar (and tab bar) to `hostId` and wait for the chip to
 * reflect it. */
async function switchToHost(page: Page, hostId: string, name: string): Promise<void> {
  const popover = await openHostSwitcher(page);
  await expect(hostRow(popover, name).locator(".host-state--connected")).toBeVisible({ timeout: 20000 });
  await page.locator(`[data-testid="host-option-${hostId}"]`).click();
  await expect(popover).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('[data-testid="host-switcher"] .sidebar__env-host')).toHaveText(name, {
    timeout: 5000,
  });
  // The "+ New session" button is per-active-host, so its testid is the proof
  // the sidebar really re-scoped.
  await expect(page.locator(`[data-testid="new-session-${hostId}"]`)).toBeVisible({ timeout: 5000 });
}

/**
 * Open the new-session picker for the *active* host and choose "No project".
 * This is the Fix 2 flow: clicking "+ New session" opens a popover instead of
 * directly creating a session.
 */
async function createRemoteSessionViaPicker(page: Page, hostId: string): Promise<void> {
  const newBtn = page.locator(`[data-testid="new-session-${hostId}"]`);
  await expect(newBtn).toBeEnabled({ timeout: 5000 });
  await newBtn.click();
  const noneOpt = page.locator('[data-testid="project-option-none"]');
  await expect(noneOpt).toBeVisible({ timeout: 5000 });
  await noneOpt.click();
  await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  // Let session.created → session.list settle before any caller snapshots the
  // (host-scoped) sidebar list length.
  await page.waitForTimeout(800);
}

/** Open the settings modal via the gear button. */
async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Chat mode settings helpers (global setting lives in ~/.perch/settings.json,
// not isolated per e2e server — must reset so later specs see Hosted default)
// ---------------------------------------------------------------------------

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

/** Flip the global chat mode via the Settings modal and wait for it to apply. */
async function setChatMode(page: Page, mode: "hosted" | "cli"): Promise<void> {
  await openSettings(page);
  const toggle = page.locator('[data-testid="settings-chat-mode"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  const wantChecked = mode === "cli" ? "true" : "false";
  const current = await toggle.getAttribute("aria-checked");
  if (current !== wantChecked) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", wantChecked, { timeout: 5000 });
  }
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Stage F3: federation e2e", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

  test.beforeAll(async () => {
    resetChatMode();
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
    resetChatMode();
  });

  // -------------------------------------------------------------------------
  // E1 — host switcher lists "test-remote" with a connected dot (≤15s)
  // -------------------------------------------------------------------------
  test("E1. host switcher lists test-remote with connected dot", async ({ page }) => {
    await freshSession(page);

    const popover = await openHostSwitcher(page);
    // "local" is always the first entry; the federated host follows.
    await expect(popover.locator('[data-testid="host-option-local"]')).toBeVisible({ timeout: 5000 });

    const row = hostRow(popover, REMOTE_HOST_NAME);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.locator(".host-state--connected")).toBeVisible({ timeout: 15000 });

    await shot(page, "fed-e1-connected.png");
  });

  // -------------------------------------------------------------------------
  // E2 — "+ New session" on the remote host creates a session under it
  // -------------------------------------------------------------------------
  test("E2. new-session picker creates remote session", async ({ page }) => {
    test.setTimeout(120000);
    await freshSession(page);

    await switchToHost(page, REMOTE_HOST_ID, REMOTE_HOST_NAME);

    // Capture session id before creating the remote session.
    const idBefore = await page.evaluate(() => localStorage.getItem("perch.sessionId"));

    // Open picker via the active host's "+ New session" and choose "No project".
    // Fix 2: clicking it opens a popover (not direct creation).
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
    // appears in the (now remote-scoped) sidebar list.
    if (claudeAvailable) {
      const remoteItems = page.locator(".sidebar__list .session-item");
      const countBeforeMsg = await remoteItems.count();
      await selectAgentModel(page, "claude", "claude-haiku-4-5");
      const textarea = page.locator(".chat__input textarea");
      await expect(textarea).toBeEnabled({ timeout: 8000 });
      await textarea.fill("Reply with exactly: e2-remote");
      await page.locator(".chat__send").click();

      // Wait for the session to appear in the remote-scoped sidebar list.
      await expect(remoteItems).toHaveCount(countBeforeMsg + 1, { timeout: 15000 });

      // Active session must be the remote one, and the sidebar must still be
      // scoped to the remote host.
      await expect(page.locator(".session-item--active")).toBeVisible({ timeout: 10000 });
      await expect(page.locator(`[data-testid="new-session-${REMOTE_HOST_ID}"]`)).toBeVisible();

      const runningDot = page.locator(".session-item--active .session-status--running");
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
    await switchToHost(page, REMOTE_HOST_ID, REMOTE_HOST_NAME);

    // Create a remote session via picker (Fix 2 flow).
    await createRemoteSessionViaPicker(page, REMOTE_HOST_ID);

    // Select claude-haiku-4-5.
    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });

    // Capture count before sending — E2 may have already left a remote session row.
    const remoteItems = page.locator(".sidebar__list .session-item");
    const countBeforeE3 = await remoteItems.count();

    await textarea.fill("Reply with exactly: remote-pong");
    await page.locator(".chat__send").click();

    // Session persists after first message — count must increase by 1.
    await expect(remoteItems).toHaveCount(countBeforeE3 + 1, { timeout: 15000 });

    // Running dot appears on the remote session.
    const runningDot = page.locator(".session-item--active .session-status--running");
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
    await switchToHost(page, REMOTE_HOST_ID, REMOTE_HOST_NAME);

    // Create a remote session via picker (Fix 2 flow) and run a hosted turn so
    // there's a claude session id for the CLI to attach to.
    await createRemoteSessionViaPicker(page, REMOTE_HOST_ID);

    await selectAgentModel(page, "claude", "claude-haiku-4-5");

    const textarea = page.locator(".chat__input textarea");
    await expect(textarea).toBeEnabled({ timeout: 10000 });

    // Capture count before sending — previous tests may have left remote session rows.
    const remoteItems = page.locator(".sidebar__list .session-item");
    const countBeforeE4 = await remoteItems.count();

    await textarea.fill("Reply with exactly: cli-ready");
    await page.locator(".chat__send").click();

    // Wait for the session to appear in the remote list and the turn to complete.
    await expect(remoteItems).toHaveCount(countBeforeE4 + 1, { timeout: 15000 });
    const runningDot = page.locator(".session-item--active .session-status--running");
    await expect(runningDot).toBeVisible({ timeout: 20000 });
    await expect(runningDot).not.toBeVisible({ timeout: 90000 });

    // Switch to CLI mode via the global Settings toggle.
    await setChatMode(page, "cli");

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
    await setChatMode(page, "hosted");
    await expect(termSurface).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // E5 — disable → disabled dot in the host switcher (≤10s); re-enable →
  //      connected dot (≤20s)
  // -------------------------------------------------------------------------
  test("E5. enable/disable host changes the host-switcher dot state", async ({ page }) => {
    await freshSession(page);

    let popover = await openHostSwitcher(page);
    await expect(hostRow(popover, REMOTE_HOST_NAME).locator(".host-state--connected")).toBeVisible({
      timeout: 15000,
    });
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0, { timeout: 5000 });

    // Open settings and locate the test-remote row.
    await openSettings(page);
    const modal = page.locator('[data-testid="settings-modal"]');
    const hostRowSettings = modal.locator(".settings-modal__host-row", { hasText: REMOTE_HOST_NAME });
    await expect(hostRowSettings).toBeVisible({ timeout: 5000 });

    // Uncheck enabled.
    const checkbox = hostRowSettings.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked({ timeout: 3000 });
    await checkbox.click();
    await expect(checkbox).not.toBeChecked({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // The switcher's dot for that host becomes disabled. The popover is a
    // portal fed by live store state, so it re-renders in place as the
    // host.info push lands — no need to reopen it.
    popover = await openHostSwitcher(page);
    await expect(hostRow(popover, REMOTE_HOST_NAME).locator(".host-state--disabled")).toBeVisible({
      timeout: 15000,
    });

    await shot(page, "fed-e5-disabled.png");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0, { timeout: 5000 });

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

    // Host reconnects — the switcher dot goes back to connected.
    popover = await openHostSwitcher(page);
    await expect(hostRow(popover, REMOTE_HOST_NAME).locator(".host-state--connected")).toBeVisible({
      timeout: 25000,
    });

    await shot(page, "fed-e5-reconnected.png");
  });

  // -------------------------------------------------------------------------
  // E6 — a host whose ssh target is unreachable must reach an actionable
  //      "error" state and keep cycling error → connecting → error on retry,
  //      never getting permanently stuck showing "connecting" (the incident
  //      this fix addresses: a devpod host with no perch checkout used to
  //      time out silently and loop right back to "connecting" forever).
  // -------------------------------------------------------------------------
  test("E6. unreachable host reaches actionable error, does not get stuck connecting", async () => {
    test.setTimeout(60000);

    const ws = await openWs(WS_URL_A);
    try {
      // Clean up any stale entry from a previous failed run.
      wsSend(ws, { type: "hosts.list" });
      const listMsg = await waitForMessage(ws, "hosts.list", () => true, 10000);
      const existingHosts = (listMsg.hosts ?? []) as Array<{ id: string }>;
      if (existingHosts.some((h) => h.id === BROKEN_HOST_ID)) {
        wsSend(ws, { type: "hosts.delete", id: BROKEN_HOST_ID });
        await waitForMessage(
          ws,
          "hosts.updated",
          (m) => {
            const hs = (m.hosts ?? []) as Array<{ id: string }>;
            return !hs.some((h) => h.id === BROKEN_HOST_ID);
          },
          10000,
        ).catch(() => {});
      }

      wsSend(ws, {
        type: "hosts.upsert",
        host: {
          id: BROKEN_HOST_ID,
          name: BROKEN_HOST_NAME,
          sshHost: BROKEN_SSH_HOST,
          remotePort: 7801,
          enabled: true,
        },
      });

      // Must reach "error" with a non-empty, actionable message within 30s.
      const firstError = await waitForMessage(
        ws,
        "host.info",
        (m) => m.hostId === BROKEN_HOST_ID && m.state === "error",
        30000,
      );
      expect(typeof firstError.error).toBe("string");
      expect((firstError.error as string).length).toBeGreaterThan(0);

      // Collect the state transitions over the next backoff+retry cycle (the
      // fix starts backoff at 5s). The state machine must cycle back to
      // "error" again — proving the retry loop keeps running with the error
      // surfaced — rather than sitting on "connecting" indefinitely.
      const events = await collectMessages(
        ws,
        "host.info",
        (m) => m.hostId === BROKEN_HOST_ID,
        15000,
      );
      const errorEvents = events.filter((e) => e.state === "error");
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      for (const e of errorEvents) {
        expect(typeof e.error).toBe("string");
        expect((e.error as string).length).toBeGreaterThan(0);
      }
    } finally {
      wsSend(ws, { type: "hosts.delete", id: BROKEN_HOST_ID });
      await waitForMessage(
        ws,
        "hosts.updated",
        (m) => {
          const hs = (m.hosts ?? []) as Array<{ id: string }>;
          return !hs.some((h) => h.id === BROKEN_HOST_ID);
        },
        10000,
      ).catch(() => {});
      ws.close();
    }
  });
});
