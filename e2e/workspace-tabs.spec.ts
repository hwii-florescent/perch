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
 *   W4 — the toolbar button toggles the Files | Git drawer (no terminal),
 *        which is app-level, not part of a layout;
 *        the "+" action in a terminal group's own header adds a second
 *        terminal as a TAB in that SAME group, not a new split group.
 *
 * W1 starts two plain shell sessions in Chats; W2/W3 reuse them.
 *
 * Each test gets its own fresh Playwright browser context (default
 * behavior), so — unlike within a single test — localStorage does NOT carry
 * the active session id from one test to the next. Tests that need to land
 * back on a specific session explicitly click its sidebar row rather than
 * relying on session-resume-from-localStorage.
 */

import { test, expect, type Page } from "@playwright/test";
import { expectActive, shellPanes, startChat, switchViaSidebar, switchViaTabBar } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.sessionId"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

test.describe("Workspace tabs (Phase 3)", () => {
  test.describe.configure({ mode: "serial" });

  /** Two sibling sessions in the same ("No project" / home-dir) project,
   * created by W1 and reused by W2/W3. */
  let sessionAId = "";
  let sessionBId = "";

  // -------------------------------------------------------------------------
  // W1 — tab bar lists sessions in the active project; active tab is
  // visually distinct; clicking a tab switches sessions.
  // -------------------------------------------------------------------------
  test("W1. tab bar lists project sessions; active tab distinct; click switches", async ({ page }) => {
    await freshPage(page);
    sessionAId = await startChat(page);
    sessionBId = await startChat(page);
    const tabA = page.locator(`[data-testid="tab-${sessionAId}"]`);
    const tabB = page.locator(`[data-testid="tab-${sessionBId}"]`);
    await expect(tabA).toBeVisible({ timeout: 10000 });
    await expectActive(page, sessionBId);
    await expect(tabA).not.toHaveClass(/tab-bar__tab--active/);

    await tabA.click();
    await expectActive(page, sessionAId);
    await expect(page.getByTestId(`workspace-session-${sessionAId}`)).toHaveClass(/workspace-entry__session--active/);
    await expect(tabB).not.toHaveClass(/tab-bar__tab--active/);
  });

  // -------------------------------------------------------------------------
  // W2 — split layout persists across a tab-bar switch away and back.
  // -------------------------------------------------------------------------
  test("W2. split layout persists across a tab switch away and back", async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!sessionAId || !sessionBId, "W1 did not produce two sessions");

    await freshPage(page);
    // Fresh browser context: no session.resume from localStorage carries over
    // from W1. Explicitly land on A via the sidebar (a real persisted row).
    await switchViaSidebar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(0);

    // Split: open a terminal pane below chat.
    // One pane has no pane header; split with the leader chord (leader,_).
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("_");
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });

    // Give the 500ms debounced session.layout.set time to fire and round-trip.
    await page.waitForTimeout(1500);

    // Switch away to B via the tab bar.
    await switchViaTabBar(page, sessionBId);
    // B has never had a layout saved — default single-Chat-panel layout.
    await expect(shellPanes(page)).toHaveCount(0, { timeout: 10000 });

    // Switch back to A via the tab bar — the split layout should be restored.
    await switchViaTabBar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // W3 — tab bar vs sidebar switching reach the same session + layout.
  // -------------------------------------------------------------------------
  test("W3. tab bar vs sidebar switching reach the same session and layout", async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!sessionAId || !sessionBId, "W1 did not produce two sessions");

    await freshPage(page);
    // Land on A via the sidebar, in a brand-new browser context — this also
    // re-verifies the split layout saved in W2 round-trips through the
    // server (not just an in-memory artifact of W2's single page instance).
    await switchViaSidebar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });

    // Switch to B via the SIDEBAR this time.
    await switchViaSidebar(page, sessionBId);
    await expect(shellPanes(page)).toHaveCount(0, { timeout: 10000 });

    // Switch back to A via the TAB BAR — same target session, same restored
    // split layout, regardless of which UI path was used to leave it.
    await switchViaTabBar(page, sessionAId);
    await expect(shellPanes(page)).toHaveCount(1, { timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // W4 — toolbar workspace-tools toggle opens the terminal area open/closed; the
  // group header's "+" action adds a new terminal TAB in the same group
  // (Bug 3 fix — previously every click stacked a brand-new split panel).
  // -------------------------------------------------------------------------
  test("W4. the toolbar toggles the workspace tools drawer; + adds a tab to the same group", async ({ page }) => {
    test.setTimeout(60000);
    // No real agent turn needed — this runs regardless of claude availability.
    await freshPage(page);

    const openBtn = page.getByTestId("workspace-tools-toggle");
    const drawer = page.getByTestId("workspace-tools");
    const terminalGroupHeader = page.locator('.dv-tabs-and-actions-container:has([data-testid="terminal-add-tab"])');

    await expect(drawer).toHaveCount(0);
    await expect(openBtn).toHaveAttribute("aria-pressed", "false");
    await openBtn.click();
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await expect(openBtn).toHaveAttribute("aria-pressed", "true");
    // Files is the default tab, and the drawer has no terminal.
    await expect(drawer.getByTestId("workspace-tools-files")).toHaveAttribute("aria-pressed", "true");
    await expect(drawer.locator(".terminal__surface")).toHaveCount(0);
    // The drawer is not a dockview panel: the layout keeps just chat.
    await expect(page.locator(".dv-tabs-and-actions-container")).toHaveCount(1);
    await page.screenshot({ path: "artifacts/w4-01-opened.png" });
    // The toggle closes the drawer, and reopens it on the last tab.
    await openBtn.click();
    await expect(drawer).toHaveCount(0);
    await expect(openBtn).toHaveAttribute("aria-pressed", "false");
    await openBtn.click();
    await expect(drawer.getByTestId("workspace-tools-files")).toHaveAttribute("aria-pressed", "true");
    await openBtn.click();
    await expect(drawer).toHaveCount(0);

    // A terminal split from the pane menu is a dockview group with its own "+".
    // One pane has no pane header; split with the leader chord (leader,_).
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("_");
    await expect(terminalGroupHeader).toHaveCount(1, { timeout: 10000 });
    await expect(terminalGroupHeader.locator('[data-testid^="pane-tab-"]')).toHaveCount(1);

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
  // -------------------------------------------------------------------------
  // W5 — a full-screen TUI survives a tab switch: pi/omp paint once, then
  // redraw only changed rows, so the replay's byte tail soon holds just its
  // status line, and its startup modes (mouse reporting) are long gone.
  // -------------------------------------------------------------------------
  test("W5. a full-screen TUI's screen and mouse mode survive a tab switch", async ({ page }) => {
    test.setTimeout(90000);
    await freshPage(page);
    const tui = await startChat(page);
    const other = await startChat(page);
    await switchViaTabBar(page, tui);
    const agent = page.getByTestId("persistent-agent-terminal");
    await agent.locator(".xterm-helper-textarea").focus();
    // Split strings keep the shell's echo of this line from matching.
    await page.keyboard.type(`printf '\\033[?1049h\\033[?1000h\\033[1;1HTUI_''HEADER'; i=0; while [ $i -lt 4000 ]; do printf '\\033[3;1H\\033[2Kstatus %s ________________________________________' $i; i=$((i+1)); done; printf '\\033[3;1HTUI_''DONE'; sleep 600\n`);
    await expect(agent.locator(".xterm-rows")).toContainText("TUI_DONE", { timeout: 30000 });
    await expect(agent.locator(".xterm-rows")).toContainText("TUI_HEADER");

    await switchViaTabBar(page, other);
    await switchViaTabBar(page, tui);
    await expect(agent.locator(".xterm-rows")).toContainText("TUI_DONE", { timeout: 15000 });
    await expect(agent.locator(".xterm-rows")).toContainText("TUI_HEADER");
    await expect(agent.locator(".xterm")).toHaveClass(/enable-mouse-events/);
    await page.keyboard.press("Control+C");
  });
});
