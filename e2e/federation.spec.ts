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
 *   E4 — a remote claude terminal renders, takes /exit, shows the exited banner
 *   E5 — disable host in settings → disabled dot in the switcher; re-enable → connected
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
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
  // With Fix 3 (lazy DB insert) the sidebar may have zero items on a fresh DB.
  // Only wait for the sidebar wrapper itself, not for session items.
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

/** Take a screenshot to the federation-specific directory. */
async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}` });
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
 * Open the new-session picker for the *active* host, pick `agent`, and choose
 * "No project". Resolves with the new session id.
 */
async function createRemoteSessionViaPicker(page: Page, hostId: string, agent: string): Promise<string> {
  const before = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
  const newBtn = page.locator(`[data-testid="new-session-${hostId}"]`);
  await expect(newBtn).toBeEnabled({ timeout: 5000 });
  await newBtn.click();
  const picker = page.getByTestId("new-session-popover-agent");
  await expect(picker).toBeEnabled({ timeout: 10_000 });
  await picker.selectOption(agent);
  const noneOpt = page.locator('[data-testid="project-option-none"]');
  await expect(noneOpt).toBeVisible({ timeout: 5000 });
  await noneOpt.click();
  await expect(noneOpt).not.toBeVisible({ timeout: 3000 });
  await expect
    .poll(async () => {
      const id = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      return Boolean(id) && id !== before;
    })
    .toBe(true);
  return (await page.evaluate(() => localStorage.getItem("perch.sessionId")))!;
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

  test.beforeAll(async () => {
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
    test.setTimeout(60000);
    await freshSession(page);
    await switchToHost(page, REMOTE_HOST_ID, REMOTE_HOST_NAME);
    // A remote host relays no agent catalog, so its picker offers Claude/Codex.
    const id = await createRemoteSessionViaPicker(page, REMOTE_HOST_ID, "claude");
    // Active in the tab bar and the (remote-scoped, non-workspace) sidebar
    // list, and the terminal is live.
    await expect(page.getByTestId(`tab-${id}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15000 });
    await expect(page.locator(".session-item--active")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`[data-testid="new-session-${REMOTE_HOST_ID}"]`)).toBeVisible();
    await expect(page.locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
    await shot(page, "fed-e2-remote-session.png");
  });

  // -------------------------------------------------------------------------
  // E4 — a remote claude terminal: output, input and exit relay through the hub
  // -------------------------------------------------------------------------
  test("E4. remote CLI terminal relay through hub", async ({ page }) => {
    test.setTimeout(120000);
    await freshSession(page);
    await switchToHost(page, REMOTE_HOST_ID, REMOTE_HOST_NAME);
    const id = await createRemoteSessionViaPicker(page, REMOTE_HOST_ID, "claude");

    // Output relay: the CLI's banner renders. (A remote pane is the plain
    // terminal view, not the local persistent agent terminal.)
    const rows = page.locator(".xterm-rows");
    const input = page.locator(".xterm-helper-textarea");
    await expect(rows).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
    await shot(page, "fed-e4-cli-relay.png");

    // Input relay: /exit reaches the CLI. A remote pane runs the CLI bare (no
    // login shell around it), so its exit shows the exited banner (exit relay).
    await input.pressSequentially("/exit");
    await expect(rows).toContainText("Exit the CLI");
    await input.press("Enter");
    await expect(page.locator(".terminal__exited")).toBeVisible({ timeout: 30_000 });
    await shot(page, "fed-e4-cli-exited.png");
    await page.getByTestId("cli-close-session").click();
    await expect(page.getByTestId(`tab-${id}`)).toHaveCount(0, { timeout: 10_000 });
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
