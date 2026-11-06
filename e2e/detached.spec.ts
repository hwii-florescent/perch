/**
 * detached.spec.ts — e2e coverage for `mode: "direct"` hosts (detached mode).
 *
 * A direct host is one with **no perch on it** — only `claude`/`codex` +
 * `tmux`. perch attaches to the CLIs over ssh in a tmux session
 * (`crates/perch-core/src/direct_host.rs`). The host-configuration surface
 * needs no remote at all, so these tests always run against the hub on :7799.
 *
 * Tests (serial):
 *   D1 — Settings hosts editor exposes the perch/direct mode select
 *   D2 — a direct host shows the "direct" badge in the host switcher
 *   D3 — an unreachable direct host reports an actionable error, not "connecting"
 */

import { test, expect, type Page } from "@playwright/test";
import { choose, expectChoice } from "./select";
import { withLocalToken } from "./localAuth";

const BASE_URL = "http://127.0.0.1:7799";
const WS_URL = "ws://127.0.0.1:7799/ws";

const DIRECT_HOST_ID = "e2e-direct";
const DIRECT_HOST_NAME = "test-direct";
// Unresolvable on purpose: there is no sshd in this environment, so an
// invalid hostname is how the suite already models "unreachable" (see
// federation.spec.ts's BROKEN_SSH_HOST).
const UNREACHABLE_SSH_HOST = "e2e-direct-unreachable.invalid";

// ---------------------------------------------------------------------------
// WS helpers (Node 22 global WebSocket — no `ws` package)
// ---------------------------------------------------------------------------

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(withLocalToken(url));
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`WebSocket error connecting to ${url}`));
  });
}

function wsSend(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

function waitForMessage(
  ws: WebSocket,
  type: string,
  predicate: (msg: Record<string, unknown>) => boolean = () => true,
  timeoutMs = 20000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout (${timeoutMs}ms) waiting for WS message type="${type}"`)),
      timeoutMs,
    );
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
        clearTimeout(timer);
        ws.onmessage = prev;
        resolve(parsed);
      }
    };
  });
}

/** Add (or replace) the direct-mode host used by these tests. */
async function upsertDirectHost(sshHost: string): Promise<void> {
  const ws = await openWs(WS_URL);
  try {
    wsSend(ws, {
      type: "hosts.upsert",
      host: {
        id: DIRECT_HOST_ID,
        name: DIRECT_HOST_NAME,
        sshHost,
        remotePort: 7788,
        enabled: true,
        mode: "direct",
      },
    });
    await waitForMessage(
      ws,
      "hosts.updated",
      (m) => {
        const hosts = (m.hosts ?? []) as Array<{ id: string; mode?: string }>;
        return hosts.some((h) => h.id === DIRECT_HOST_ID && h.mode === "direct");
      },
      10000,
    );
  } finally {
    ws.close();
  }
}

async function deleteDirectHost(): Promise<void> {
  const ws = await openWs(WS_URL);
  try {
    wsSend(ws, { type: "hosts.delete", id: DIRECT_HOST_ID });
    await waitForMessage(ws, "hosts.updated", () => true, 10000);
  } finally {
    ws.close();
  }
}

async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function openHostSwitcher(page: Page) {
  await page.locator('[data-testid="host-switcher"]').click();
  const popover = page.locator('[data-testid="host-switcher-popover"]');
  await expect(popover).toBeVisible({ timeout: 5000 });
  return popover;
}

// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await upsertDirectHost(UNREACHABLE_SSH_HOST);
});

test.afterAll(async () => {
  await deleteDirectHost();
});

test("D1. hosts editor exposes the perch/direct mode select", async ({ page }) => {
  await freshSession(page);
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="settings-nav-hosts"]').click(); // Settings is paged: hosts live under SSH hosts

  // The add-host form's mode select defaults to "direct" — most SSH targets
  // don't have perch installed, so direct is the normal case for a new host.
  const addMode = page.locator('[data-testid="host-mode-input"]');
  await expect(addMode).toBeVisible({ timeout: 10000 });
  await expectChoice(addMode, "direct");

  // Choosing "perch" from the add form still works (opt-in classic
  // federation for hosts that do run their own perch).
  await choose(addMode, "perch");
  await expectChoice(addMode, "perch");
  await choose(addMode, "direct");
  await expectChoice(addMode, "direct");

  // The existing direct host's row select reflects (and can change) its mode.
  const rowMode = page.locator(`[data-testid="host-mode-${DIRECT_HOST_NAME}"]`);
  await expect(rowMode).toBeVisible({ timeout: 10000 });
  await expectChoice(rowMode, "direct");
});

test("D2. a direct host is badged in the host switcher", async ({ page }) => {
  await freshSession(page);
  const popover = await openHostSwitcher(page);
  await expect(popover.locator(`[data-testid="host-option-${DIRECT_HOST_ID}"]`)).toBeVisible();
  const badge = popover.locator(`[data-testid="host-direct-badge-${DIRECT_HOST_ID}"]`);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/direct/i);
});

test("D3. an unreachable direct host reports an actionable error", async ({ page }) => {
  await freshSession(page);
  const popover = await openHostSwitcher(page);
  const errorEl = popover.locator(`[data-testid="host-error-${DIRECT_HOST_ID}"]`);
  // The direct path is probe-only (no tunnel, no auto-start), so it fails
  // fast — but ssh's own connect timeout still applies.
  await expect(errorEl).toBeVisible({ timeout: 60000 });
  const text = (await errorEl.textContent()) ?? "";
  // Actionable = it names what failed, not a bare "error".
  expect(text.length).toBeGreaterThan(0);
  expect(text).toMatch(/ssh|resolve|host|timed out|probe|command failed/i);
});
