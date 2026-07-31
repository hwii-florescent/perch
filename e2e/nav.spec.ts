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
    localStorage.removeItem("perch.sessionId");
    localStorage.removeItem("perch.activeHostId");
    localStorage.removeItem("perch.activeProject");
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

function projectRow(page: Page, cwd: string): Locator {
  return page.locator(`[data-testid="project-row"][data-project-cwd="${cwd}"]`);
}

/** Create a session whose cwd is `cwd` via the picker's "Type path" fallback,
 * then send a seed message so the server's lazy DB insert runs and the
 * project shows up in the nav. Returns the new session's id. */
async function createSessionInDir(page: Page, cwd: string, seed: string): Promise<string> {
  const newBtn = page.locator('[data-testid="new-session-local"]');
  await expect(newBtn).toBeEnabled({ timeout: 10000 });
  await newBtn.click();
  await page.locator('[data-testid="dir-browser-mode-toggle"]').click();
  const input = page.locator('[data-testid="project-path-input"]');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(cwd);
  await page.locator('[data-testid="dir-browser-use"]').click();
  await expect(input).not.toBeVisible({ timeout: 3000 });

  // Cheapest possible real turn — the row only needs the insert side effect.
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator('[data-testid="agent-option-claude"]').click();
  await page.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 10000 });
  await textarea.fill(seed);
  await page.locator(".chat__send").click();

  const active = page.locator(".session-item--active");
  await expect(active).toBeVisible({ timeout: 20000 });
  const id = await active.getAttribute("data-session-id");
  expect(id).toBeTruthy();
  return id as string;
}

/** Let any in-flight turn settle so it doesn't bleed into later specs. */
async function waitForIdle(page: Page): Promise<void> {
  await expect(page.locator(".session-status--running")).toHaveCount(0, { timeout: 120000 });
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

  let claudeAvailable = false;

  test.beforeAll(() => {
    setupFixtures();
    try {
      execSync("which claude || [ -x ~/.local/bin/claude ]", { encoding: "utf8", shell: "/bin/sh" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  test.afterAll(() => {
    rmrf(PROJ_A);
    rmrf(PROJ_B);
  });

  // -------------------------------------------------------------------------
  // N1 — two projects in the nav; tab bar is scoped to the active one
  // -------------------------------------------------------------------------
  test("N1. two project dirs appear in the nav; the tab bar follows the active project", async ({ page }) => {
    test.setTimeout(240000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — N1 needs two persisted sessions");
      return;
    }

    await freshPage(page);

    // --- Project A -----------------------------------------------------
    const sessionA = await createSessionInDir(page, PROJ_A, "nav-a seed " + Date.now());
    await expect(projectRow(page, PROJ_A)).toBeVisible({ timeout: 15000 });
    // Creating it also made it the active project, so its sessions are listed.
    await expect(
      page.locator(`.sidebar__project--active .session-item[data-session-id="${sessionA}"]`),
    ).toBeVisible({ timeout: 10000 });
    await waitForIdle(page);

    // --- Project B -----------------------------------------------------
    const sessionB = await createSessionInDir(page, PROJ_B, "nav-b seed " + Date.now());
    await expect(projectRow(page, PROJ_B)).toBeVisible({ timeout: 15000 });
    await waitForIdle(page);

    // Both projects are in the nav.
    await expect(projectRow(page, PROJ_A)).toBeVisible();
    await expect(projectRow(page, PROJ_B)).toBeVisible();

    // B is active (it was just created): its sessions are listed, A's are not.
    await expect(projectRow(page, PROJ_B)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(`.session-item[data-session-id="${sessionB}"]`)).toBeVisible();
    await expect(page.locator(`.session-item[data-session-id="${sessionA}"]`)).toHaveCount(0);

    // ...and the tab bar carries only B's tabs.
    await expect(page.locator(`[data-testid="tab-${sessionB}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-testid="tab-${sessionA}"]`)).toHaveCount(0);

    await page.screenshot({ path: "artifacts/n1-project-b-active.png" });

    // --- Click project A: sidebar + tab bar both re-point ---------------
    await projectRow(page, PROJ_A).click();
    await expect(projectRow(page, PROJ_A)).toHaveAttribute("aria-current", "true", { timeout: 5000 });
    await expect(page.locator(`.session-item[data-session-id="${sessionA}"]`)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(`.session-item[data-session-id="${sessionB}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="tab-${sessionA}"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="tab-${sessionB}"]`)).toHaveCount(0);

    // A is a git checkout, so its row's second line is the branch; B is not,
    // so its row falls back to a shortened cwd.
    await expect(projectRow(page, PROJ_A).locator('[data-testid="workspace-git-local"]')).toContainText(
      "nav-main",
      { timeout: 20000 },
    );
    await expect(projectRow(page, PROJ_B).locator(".sidebar__project-sub")).toBeVisible();

    await page.screenshot({ path: "artifacts/n1-project-a-active.png" });

    // Opening a session from the tab bar keeps the nav on its project.
    await page.locator(`[data-testid="tab-${sessionA}"]`).click();
    await expect(
      page.locator(`.session-item--active[data-session-id="${sessionA}"]`),
    ).toBeVisible({ timeout: 15000 });
    await expect(projectRow(page, PROJ_A)).toHaveAttribute("aria-current", "true");
  });

  // -------------------------------------------------------------------------
  // N2 — host switcher lists local + federated hosts and re-scopes the sidebar
  // -------------------------------------------------------------------------
  test("N2. host switcher lists local plus federated hosts and switches scope", async ({ page }) => {
    test.setTimeout(120000);

    await freshPage(page);

    // "local" is always present, and the popover keeps host management
    // reachable now that per-host sidebar sections are gone.
    let popover = await openHostSwitcher(page);
    await expect(popover.locator('[data-testid="host-option-local"]')).toBeVisible({ timeout: 5000 });
    await expect(popover.locator('[data-testid="host-switcher-manage"]')).toBeVisible();
    await expect(popover.locator('[data-testid="host-option-local"] .host-state--connected')).toBeVisible();
    await page.screenshot({ path: "artifacts/n2-switcher-local-only.png" });
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0, { timeout: 5000 });

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
      await expect(projectRow(page, PROJ_A)).toHaveCount(0);

      await page.screenshot({ path: "artifacts/n2-remote-host-active.png" });

      // ...and switching back to local restores the local nav.
      popover = await openHostSwitcher(page);
      await popover.locator('[data-testid="host-option-local"]').click();
      await expect(popover).toHaveCount(0, { timeout: 5000 });
      await expect(page.locator('[data-testid="new-session-local"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="project-list"] [data-testid="project-row"]').first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await deleteNavHost();
    }
  });
});
