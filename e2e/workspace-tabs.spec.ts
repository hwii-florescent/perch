/**
 * workspace-tabs.spec.ts — e2e tests for Phase 3 (Workspace → Tab → Pane
 * model): the tab strip above the dockview area, and per-session dockview
 * layout persistence (`session.layout.get`/`session.layout.set`).
 *
 *   W1 — the tab bar shows the sessions belonging to the active project
 *        ((hostId, cwd) of the active session); the active tab is visually
 *        distinct; clicking a tab switches sessions (sidebar + tab bar agree).
 *   W2 — split a terminal pane into a session's layout, switch away (via the
 *        tab bar) and back → the same split layout is restored.
 *   W3 — switching via the tab bar vs. the sidebar reach the same target
 *        session and restore the same layout.
 *   W4 — the toolbar "Open terminal" button toggles the terminal area (first
 *        click opens, second click closes); the "+" action in the terminal
 *        group's own header adds a second terminal as a TAB in that SAME
 *        group, not a new split group.
 *
 * All tests are headless. Two real (short, cheap) `claude` turns are used to
 * materialize two sibling sessions in the same project: Fix 3 defers a
 * session's DB row until its first message, so a session doesn't show up in
 * the sidebar/tab bar (or survive across a fresh browser context) until it
 * has at least one. Requires `claude` on PATH — skipped otherwise, same
 * pattern as sessions.spec.ts.
 *
 * Each test gets its own fresh Playwright browser context (default
 * behavior), so — unlike within a single test — localStorage does NOT carry
 * the active session id from one test to the next. Tests that need to land
 * back on a specific session explicitly click its sidebar row rather than
 * relying on session-resume-from-localStorage.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function openLocalPicker(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="new-session-local"]');
  await expect(btn).toBeEnabled({ timeout: 10000 });
  await btn.click();
  await expect(page.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
}

/** Select claude-haiku-4-5, send `text`, and wait for the turn to finish. */
async function sendAndWait(page: Page, text: string): Promise<void> {
  const chip = page.locator('[data-testid="model-chip"]');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
  await page.locator('[data-testid="agent-option-claude"]').click();
  await page.locator('[data-testid="model-option-claude-haiku-4-5"]').click();

  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 8000 });
  await textarea.fill(text);
  await page.locator(".chat__send").click();

  const runningDot = page.locator(".session-item--active .session-status--running");
  await expect(runningDot).toBeVisible({ timeout: 20000 });
  await expect(runningDot).not.toBeVisible({ timeout: 90000 });
}

/** Switch to `sessionId` via its sidebar row and wait for it to become active. */
async function switchViaSidebar(page: Page, sessionId: string): Promise<void> {
  await page.locator(`.session-item[data-session-id="${sessionId}"]`).click();
  await expect(page.locator(`.session-item--active[data-session-id="${sessionId}"]`)).toBeVisible({
    timeout: 15000,
  });
}

/** Switch to `sessionId` via its tab-bar pill and wait for it to become active. */
async function switchViaTabBar(page: Page, sessionId: string): Promise<void> {
  await page.locator(`[data-testid="tab-${sessionId}"]`).click();
  await expect(page.locator(`.session-item--active[data-session-id="${sessionId}"]`)).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Workspace tabs (Phase 3)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  /** Two sibling sessions in the same ("No project" / home-dir) project,
   * created by W1 and reused by W2/W3. */
  let sessionAId = "";
  let sessionBId = "";

  test.beforeAll(async () => {
    const { execSync } = await import("child_process");
    try {
      execSync("which claude || [ -x ~/.local/bin/claude ]", {
        encoding: "utf8",
        shell: "/bin/sh",
      });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  // -------------------------------------------------------------------------
  // W1 — tab bar lists sessions in the active project; active tab is
  // visually distinct; clicking a tab switches sessions.
  // -------------------------------------------------------------------------
  test("W1. tab bar lists project sessions; active tab distinct; click switches", async ({ page }) => {
    test.setTimeout(240000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping workspace-tabs suite (real turns required)");
      return;
    }

    await freshPage(page);

    // Session A: blank "No project" session + a real turn so it materializes
    // in the DB and shows up in the sidebar/tab bar (Fix 3).
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await sendAndWait(page, "Reply with exactly: A");
    sessionAId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionAId).toBeTruthy();

    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible({ timeout: 10000 });
    const tabA = page.locator(`[data-testid="tab-${sessionAId}"]`);
    await expect(tabA).toBeVisible({ timeout: 10000 });
    await expect(tabA).toHaveClass(/tab-bar__tab--active/);

    // Session B: created via the tab bar's own "+" (Wave 1 item 1 — this
    // opens the same directory-browser popover as the sidebar's "+", with
    // the current project's cwd preselected as the first quick-pick option)
    // — clicking it exercises createSessionOnHost with A's hostId/cwd, so B
    // lands in the SAME project.
    await page.locator('[data-testid="tab-new"]').click();
    await expect(page.locator('[data-testid="dir-browser"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="project-option-0"]').click();
    await sendAndWait(page, "Reply with exactly: B");
    sessionBId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionBId).toBeTruthy();
    expect(sessionBId).not.toEqual(sessionAId);

    const tabB = page.locator(`[data-testid="tab-${sessionBId}"]`);
    await expect(tabA).toBeVisible({ timeout: 10000 });
    await expect(tabB).toBeVisible({ timeout: 10000 });
    await expect(tabB).toHaveClass(/tab-bar__tab--active/);
    await expect(tabA).not.toHaveClass(/tab-bar__tab--active/);

    await page.screenshot({ path: "artifacts/w1-two-tabs.png" });

    // Clicking tab A switches the active session — sidebar and tab bar agree.
    await tabA.click();
    await expect(page.locator(`.session-item--active[data-session-id="${sessionAId}"]`)).toBeVisible({
      timeout: 10000,
    });
    await expect(tabA).toHaveClass(/tab-bar__tab--active/, { timeout: 10000 });
    await expect(tabB).not.toHaveClass(/tab-bar__tab--active/);

    await page.screenshot({ path: "artifacts/w1-switched-to-a.png" });
  });

  // -------------------------------------------------------------------------
  // W2 — split layout persists across a tab-bar switch away and back.
  // -------------------------------------------------------------------------
  test("W2. split layout persists across a tab switch away and back", async ({ page }) => {
    test.setTimeout(60000);
    if (!claudeAvailable || !sessionAId || !sessionBId) {
      test.skip(true, "W1 did not produce two sessions — skipping W2");
      return;
    }

    await freshPage(page);
    // Fresh browser context: no session.resume from localStorage carries over
    // from W1. Explicitly land on A via the sidebar (a real persisted row).
    await switchViaSidebar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toHaveCount(0);

    // Split: open a terminal pane below chat.
    await page.getByTitle("Open terminal").click();
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    // Give the 500ms debounced session.layout.set time to fire and round-trip.
    await page.waitForTimeout(1500);

    // Switch away to B via the tab bar.
    await switchViaTabBar(page, sessionBId);
    // B has never had a layout saved — default single-Chat-panel layout.
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });

    await page.screenshot({ path: "artifacts/w2-on-b-no-terminal.png" });

    // Switch back to A via the tab bar — the split layout should be restored.
    await switchViaTabBar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/w2-restored-on-a.png" });
  });

  // -------------------------------------------------------------------------
  // W3 — tab bar vs sidebar switching reach the same session + layout.
  // -------------------------------------------------------------------------
  test("W3. tab bar vs sidebar switching reach the same session and layout", async ({ page }) => {
    test.setTimeout(60000);
    if (!claudeAvailable || !sessionAId || !sessionBId) {
      test.skip(true, "W1 did not produce two sessions — skipping W3");
      return;
    }

    await freshPage(page);
    // Land on A via the sidebar, in a brand-new browser context — this also
    // re-verifies the split layout saved in W2 round-trips through the
    // server (not just an in-memory artifact of W2's single page instance).
    await switchViaSidebar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    // Switch to B via the SIDEBAR this time.
    await switchViaSidebar(page, sessionBId);
    await expect(page.locator(`[data-testid="tab-${sessionBId}"]`)).toHaveClass(/tab-bar__tab--active/, {
      timeout: 10000,
    });
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });

    // Switch back to A via the TAB BAR — same target session, same restored
    // split layout, regardless of which UI path was used to leave it.
    await switchViaTabBar(page, sessionAId);
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/w3-converged-on-a.png" });
  });

  // -------------------------------------------------------------------------
  // W4 — toolbar "Open terminal" toggles the terminal area open/closed; the
  // group header's "+" action adds a new terminal TAB in the same group
  // (Bug 3 fix — previously every click stacked a brand-new split panel).
  // -------------------------------------------------------------------------
  test("W4. terminal toggle open/close; + adds a tab to the same group", async ({ page }) => {
    test.setTimeout(60000);
    // No real agent turn needed — this only exercises dockview panel wiring
    // against the always-present default Chat panel, so it runs regardless
    // of claude availability.
    await freshPage(page);

    const openBtn = page.getByTitle("Open terminal");
    const terminalGroupHeader = page.locator('.dv-tabs-and-actions-container:has([data-testid="terminal-add-tab"])');

    // Closed by default.
    await expect(page.locator(".terminal__surface")).toHaveCount(0);
    await expect(openBtn).toHaveAttribute("aria-pressed", "false");

    // First click: opens the terminal area.
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });
    await expect(openBtn).toHaveAttribute("aria-pressed", "true");
    // Exactly one group qualifies as "a terminal group" so far.
    await expect(terminalGroupHeader).toHaveCount(1);
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(1);

    await page.screenshot({ path: "artifacts/w4-01-opened.png" });

    // Second click: closes the terminal area entirely (toggle, not another split).
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toHaveCount(0, { timeout: 10000 });
    await expect(openBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[data-testid="terminal-add-tab"]')).toHaveCount(0);

    await page.screenshot({ path: "artifacts/w4-02-closed.png" });

    // Third click: re-opens (confirms the toggle isn't a one-shot).
    await openBtn.click();
    await expect(page.locator(".terminal__surface")).toBeVisible({ timeout: 10000 });
    await expect(openBtn).toHaveAttribute("aria-pressed", "true");

    // "+" in the terminal group's own header adds a second terminal as a TAB
    // in that SAME group — still exactly one qualifying group, now with two
    // tabs in it (not two separate terminal groups).
    const addTabBtn = page.locator('[data-testid="terminal-add-tab"]');
    await expect(addTabBtn).toHaveCount(1);
    await addTabBtn.click();

    await expect(terminalGroupHeader).toHaveCount(1);
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(2, { timeout: 10000 });
    // Total groups in the whole shell: chat's + the one terminal group — never
    // three, which would indicate "+" wrongly split off a new group.
    await expect(page.locator(".dv-tabs-and-actions-container")).toHaveCount(2);

    await page.screenshot({ path: "artifacts/w4-03-second-tab-same-group.png" });
  });
});
