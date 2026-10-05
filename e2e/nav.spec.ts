/**
 * nav.spec.ts — e2e for the herdr-style navigation redesign.
 *
 * The sidebar is scoped to ONE host at a time (picked in the host-switcher
 * popover behind the environment chip) and, within that host, to ONE active
 * project (a distinct session cwd). The tab bar mirrors the active project.
 *
 *   N1 — two sessions in two different /tmp project dirs → both projects show
 *        in the nav, only the active one lists its sessions, and the tab bar
 *        carries exactly that project's tabs; clicking the other project row
 *        re-points both.
 *   N2 — the host switcher lists "local"; with a federated host registered it
 *        lists that too, selecting it re-scopes the sidebar, and selecting
 *        "local" comes back.
 *
 * N1 sends one real (cheap) `claude` turn per project because Fix 3 defers a
 * session's DB row — and therefore its project row — until the first message.
 * Requires `claude` on PATH; skipped otherwise, same pattern as the rest of
 * the suite. N2 needs no agent turn and always runs.
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import * as fs from "fs";
import { execSync } from "child_process";
import { startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";
const WS_URL = "ws://127.0.0.1:7799/ws";

/** Two throwaway project dirs. A is a git checkout (so its project row's
 * second line renders the branch), B is plain (so it falls back to the
 * shortened cwd) — both variants of the subline get exercised. */
const PROJ_A = "/tmp/perch-e2e-nav-a";
const PROJ_B = "/tmp/perch-e2e-nav-b";

const NAV_HOST_ID = "e2e-nav-remote";
const NAV_HOST_NAME = "nav-remote";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function rmrf(p: string): void {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

function setupFixtures(): void {
  rmrf(PROJ_A);
  rmrf(PROJ_B);
  fs.mkdirSync(PROJ_A, { recursive: true });
  fs.mkdirSync(PROJ_B, { recursive: true });
  fs.writeFileSync(`${PROJ_A}/README.md`, "nav-a\n");
  const sh = (cmd: string) => execSync(cmd, { cwd: PROJ_A, encoding: "utf8", timeout: 20000 });
  sh("git init -q -b nav-main .");
  sh("git add -A");
  sh('git -c user.email=e2e@perch -c user.name=e2e commit -qm init');
}

// ---------------------------------------------------------------------------
// Raw-WebSocket host control (same approach as federation.spec.ts)
// ---------------------------------------------------------------------------

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = (ev) => reject(new Error(`WebSocket error connecting to ${url}: ${String(ev)}`));
  });
}

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
    ws.onclose = () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket closed while waiting for type="${type}"`));
    };
  });
}

async function upsertNavHost(): Promise<void> {
  const ws = await openWs(WS_URL);
  try {
    ws.send(
      JSON.stringify({
        type: "hosts.upsert",
        host: {
          id: NAV_HOST_ID,
          name: NAV_HOST_NAME,
          sshHost: "",
          remotePort: 7800,
          enabled: true,
          directUrl: "ws://127.0.0.1:7800/ws",
        },
      }),
    );
    await waitForMessage(
      ws,
      "host.info",
      (m) => m.hostId === NAV_HOST_ID && m.state === "connected",
      25000,
    );
  } finally {
    ws.close();
  }
}

async function deleteNavHost(): Promise<void> {
  const ws = await openWs(WS_URL);
  try {
    ws.send(JSON.stringify({ type: "hosts.delete", id: NAV_HOST_ID }));
    await waitForMessage(
      ws,
      "hosts.updated",
      (m) => !((m.hosts ?? []) as Array<{ id: string }>).some((h) => h.id === NAV_HOST_ID),
      10000,
    );
  } finally {
    ws.close();
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k));
    for (const k of Object.keys(localStorage)) if (k.startsWith("perch.activeHostId")) localStorage.removeItem(k);
    for (const k of Object.keys(localStorage)) if (k.startsWith("perch.activeProject@")) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function openHostSwitcher(page: Page): Promise<Locator> {
  await page.locator('[data-testid="host-switcher"]').click();
  const popover = page.locator('[data-testid="host-switcher-popover"]');
  await expect(popover).toBeVisible({ timeout: 8000 });
  return popover;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Navigation redesign (host switcher + project nav)", () => {
  test.describe.configure({ mode: "serial" });


  test.beforeAll(() => {
    setupFixtures();
  });

  test.afterAll(() => {
    rmrf(PROJ_A);
    rmrf(PROJ_B);
  });

  // -------------------------------------------------------------------------
  // N1 — two projects in the nav; tab bar is scoped to the active one
  // -------------------------------------------------------------------------
  test("N1. the tab bar follows the active project", async ({ page }) => {
    await freshPage(page);
    const sessionA = await startChat(page, "terminal", PROJ_A);
    const sessionB = await startChat(page, "terminal", PROJ_B);

    // B is active: the tab bar carries only B's tabs.
    await expect(page.getByTestId(`tab-${sessionB}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`tab-${sessionA}`)).toHaveCount(0);

    // Opening A's session from the sidebar re-points the tab bar.
    await page.getByTestId(`workspace-session-${sessionA}`).click();
    await expect(page.getByTestId(`tab-${sessionA}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(`tab-${sessionB}`)).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // N2 — host switcher lists local + federated hosts and re-scopes the sidebar
  // -------------------------------------------------------------------------
  test("N2. host switcher lists local plus federated hosts and switches scope", async ({ page }) => {
    test.setTimeout(120000);

    await freshPage(page);

    // A local-only install has nothing to switch between: no host card
    // (UI-UX-DIRECTION.md §11). It appears once a remote host is added.
    await expect(page.locator('[data-testid="host-switcher"]')).toHaveCount(0);
    let popover: Locator;

    // Register a federated host and confirm it joins the list.
    await upsertNavHost();
    try {
      popover = await openHostSwitcher(page);
      const remoteOption = popover.locator(`[data-testid="host-option-${NAV_HOST_ID}"]`);
      await expect(remoteOption).toBeVisible({ timeout: 20000 });
      await expect(remoteOption).toContainText(NAV_HOST_NAME);
      await expect(remoteOption.locator(".host-state--connected")).toBeVisible({ timeout: 20000 });
      // The inline enabled checkbox keeps the enable/disable affordance in reach.
      await expect(popover.locator(`[data-testid="host-toggle-${NAV_HOST_ID}"]`)).toBeChecked();

      await page.screenshot({ path: "artifacts/n2-switcher-with-remote.png" });

      // Selecting it re-scopes the sidebar to that host.
      await remoteOption.click();
      await expect(popover).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('[data-testid="host-switcher"] .sidebar__env-host')).toHaveText(
        NAV_HOST_NAME,
        { timeout: 5000 },
      );
      await expect(page.locator(`[data-testid="new-session-${NAV_HOST_ID}"]`)).toBeVisible();
      await expect(page.locator('[data-testid="new-session-local"]')).toHaveCount(0);
      // Local projects are no longer listed while a remote host is active.
      const projectA = page.locator(".workspace-project").filter({ hasText: "perch-e2e-nav-a" });
      await expect(projectA).toHaveCount(0);

      await page.screenshot({ path: "artifacts/n2-remote-host-active.png" });

      // ...and switching back to local restores the local nav.
      popover = await openHostSwitcher(page);
      await popover.locator('[data-testid="host-option-local"]').click();
      await expect(popover).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('[data-testid="new-session-local"]')).toBeVisible({ timeout: 5000 });
      await expect(projectA.first()).toBeVisible({ timeout: 10000 });
    } finally {
      await deleteNavHost();
    }
  });
});
