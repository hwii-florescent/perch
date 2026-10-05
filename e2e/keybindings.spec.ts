/**
 * keybindings.spec.ts — e2e tests for Phase 4 (Keybindings + Navigator):
 * the Ctrl+Space leader chord, Cmd+K + plain '?' shortcuts, the
 * Navigator fuzzy-finder, the KeybindHelp modal, sidebar collapse, and the
 * dockview pane keybindings (split/close/maximize).
 *
 *   K1 — Cmd+K opens the Navigator; typing filters the list; Enter
 *        switches to the selected session and closes the modal; Escape
 *        closes without switching.
 *   K2 — plain '?' opens KeybindHelp when focus is outside any input
 *        (and is searchable); '?' typed into a terminal goes to the PTY.
 *   K3 — leader (Ctrl+Space) + 'b' toggles the sidebar's collapsed rail; the
 *        footer's collapse-toggle button does the same thing via a click.
 *   K4 — leader + 'n' / leader + 'p' cycle between sibling sessions in the
 *        same project (same (hostId,cwd) grouping as the tab bar).
 *   K5 — leader + 'v' splits a new terminal pane; leader + 'z' maximizes the
 *        active pane (chat panel becomes hidden while a terminal pane is
 *        maximized, and reappears once toggled back); leader + 'x' closes
 *        the active terminal pane, leaving just chat.
 *
 * K1 and K4 share two plain shell sessions started in Chats.
 */

import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

async function openLocalPicker(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="new-session-local"]');
  await expect(btn).toBeEnabled({ timeout: 10000 });
  await btn.click();
  await expect(page.locator('[data-testid="project-option-none"]')).toBeVisible({ timeout: 5000 });
}

/** Start a plain shell session in Chats, named `title` through the tab's
 * rename so the Navigator can filter on it. */
async function namedChat(page: Page, title: string): Promise<string> {
  const id = await startChat(page);
  await page.getByTestId(`tab-${id}`).dblclick();
  await page.getByTestId("rename-input").fill(title);
  await page.getByTestId("rename-input").press("Enter");
  await expect(page.getByTestId(`workspace-session-${id}`)).toContainText(title);
  return id;
}

const isActive = (page: Page, id: string) =>
  expect(page.getByTestId(`workspace-session-${id}`)).toHaveClass(/workspace-entry__session--active/, { timeout: 10000 });

/** Fire the Ctrl+Space leader chord followed by `key`. Body must not have
 * focus inside an editable element for the leader to arm. */
async function leaderChord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

test.describe("Keybindings + Navigator (Phase 4)", () => {
  test.describe.configure({ mode: "serial" });

  /** Two sibling sessions in the same ("No project") project, created by K1
   * and reused by K4. */
  let sessionAId = "";
  let sessionBId = "";

  // -------------------------------------------------------------------------
  // K1 — Navigator: open via Cmd+K, filter by typing, Enter switches + closes,
  // Escape closes without switching.
  // -------------------------------------------------------------------------
  test("K1. Cmd+K opens Navigator; filtering + Enter switches session; Escape closes", async ({ page }) => {
    await freshPage(page);
    sessionAId = await namedChat(page, "KBNAV-ALPHA");
    sessionBId = await namedChat(page, "KBNAV-BETA");

    await page.keyboard.press("Meta+k");
    const navigator = page.locator('[data-testid="navigator"]');
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionAId}"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionBId}"]`)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(navigator).not.toBeVisible({ timeout: 5000 });
    await isActive(page, sessionBId);

    await page.keyboard.press("Meta+k");
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="navigator-input"]').fill("KBNAV-ALPHA");
    await expect(page.locator(`[data-testid="navigator-row-${sessionAId}"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionBId}"]`)).not.toBeVisible();
    await page.keyboard.press("Enter");
    await expect(navigator).not.toBeVisible({ timeout: 5000 });
    await isActive(page, sessionAId);
  });

  // -------------------------------------------------------------------------
  // K2 — KeybindHelp: plain '?' opens it outside inputs; '?' typed inside the
  // composer just inserts a character; Escape closes.
  // -------------------------------------------------------------------------
  test("K2. plain '?' opens KeybindHelp outside inputs; suppressed while typing", async ({ page }) => {
    await freshPage(page);

    await startChat(page);
    const helpModal = page.locator('[data-testid="keybind-help"]');

    // '?' typed into a focused terminal is the shell's, not perch's.
    const input = page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea");
    await input.press("Shift+Slash"); // '?' = Shift+/
    await expect(helpModal).not.toBeVisible();

    // Outside any input, plain '?' opens the modal.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Shift+Slash");
    await expect(helpModal).toBeVisible({ timeout: 5000 });

    // Searchable: typing narrows the list to matching entries only.
    await page.locator('[data-testid="keybind-help-search"]').fill("Navigator");
    await expect(helpModal.getByText("Open Navigator").first()).toBeVisible();
    await expect(helpModal.getByText("Toggle sidebar collapse")).not.toBeVisible();

    await page.screenshot({ path: "artifacts/k2-keybind-help.png" });

    await page.keyboard.press("Escape");
    await expect(helpModal).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // K3 — leader,b toggles sidebar collapse; the top-row button does the same.
  // Collapsed means the sidebar is not rendered at all.
  // -------------------------------------------------------------------------
  test("K3. leader,b and the top-row button toggle sidebar collapse", async ({ page }) => {
    await freshPage(page);

    const sidebar = page.locator("aside.sidebar");
    await expect(sidebar).toHaveCount(1);

    await leaderChord(page, "b");
    await expect(sidebar).toHaveCount(0, { timeout: 5000 });

    await page.screenshot({ path: "artifacts/k3-sidebar-collapsed.png" });

    // The same chord expands it back.
    await leaderChord(page, "b");
    await expect(sidebar).toHaveCount(1, { timeout: 5000 });

    // The top row's collapse-toggle button is an equivalent mouse control.
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click();
    await expect(sidebar).toHaveCount(0, { timeout: 5000 });
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click();
    await expect(sidebar).toHaveCount(1, { timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // K4 — leader,n / leader,p cycle sibling sessions within the active project.
  // -------------------------------------------------------------------------
  test("K4. leader,n / leader,p cycle sessions within the active project", async ({ page }) => {
    test.skip(!sessionAId || !sessionBId, "K1 did not produce two sessions");
    await freshPage(page);
    await page.getByTestId(`workspace-session-${sessionAId}`).click();
    await isActive(page, sessionAId);
    await leaderChord(page, "n");
    await isActive(page, sessionBId);
    await leaderChord(page, "p");
    await isActive(page, sessionAId);
  });

  // -------------------------------------------------------------------------
  // K5 — leader,v splits a terminal pane; leader,z maximizes/restores;
  // leader,x closes the active terminal pane.
  // -------------------------------------------------------------------------
  test("K5. leader,v / leader,z / leader,x drive the dockview panes", async ({ page }) => {
    await freshPage(page);

    const terminal = page.locator(".terminal__surface");
    const chat = page.locator(".chat");

    await expect(terminal).toHaveCount(0);
    await expect(chat).toBeVisible({ timeout: 10000 });

    // leader,v -> split a new terminal pane.
    await leaderChord(page, "v");
    await expect(terminal).toBeVisible({ timeout: 10000 });
    await expect(chat).toBeVisible();

    await page.screenshot({ path: "artifacts/k5-split.png" });

    // leader,z -> maximize the active (terminal) pane group; the sibling chat
    // panel's group is hidden while maximized.
    await leaderChord(page, "z");
    await expect(chat).not.toBeVisible({ timeout: 10000 });
    await expect(terminal).toBeVisible();

    await page.screenshot({ path: "artifacts/k5-maximized.png" });

    // leader,z again -> restore; chat reappears.
    await leaderChord(page, "z");
    await expect(chat).toBeVisible({ timeout: 10000 });
    await expect(terminal).toBeVisible();

    // leader,x -> close the active terminal pane, leaving just chat.
    await leaderChord(page, "x");
    await expect(terminal).toHaveCount(0, { timeout: 10000 });
    await expect(chat).toBeVisible();

    await page.screenshot({ path: "artifacts/k5-closed.png" });
  });
});
