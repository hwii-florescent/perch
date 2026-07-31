/**
 * keybindings.spec.ts — e2e tests for Phase 4 (Keybindings + Navigator):
 * the Ctrl+Space leader chord, Ctrl/Cmd+K + plain '?' shortcuts, the
 * Navigator fuzzy-finder, the KeybindHelp modal, sidebar collapse, and the
 * dockview pane keybindings (split/close/maximize).
 *
 *   K1 — Ctrl/Cmd+K opens the Navigator; typing filters the list; Enter
 *        switches to the selected session and closes the modal; Escape
 *        closes without switching.
 *   K2 — plain '?' opens KeybindHelp when focus is outside any input/textarea
 *        (and is searchable); '?' typed inside the composer textarea just
 *        inserts the character instead of opening the modal.
 *   K3 — leader (Ctrl+Space) + 'b' toggles the sidebar's collapsed rail; the
 *        footer's collapse-toggle button does the same thing via a click.
 *   K4 — leader + 'n' / leader + 'p' cycle between sibling sessions in the
 *        same project (same (hostId,cwd) grouping as the tab bar).
 *   K5 — leader + 'v' splits a new terminal pane; leader + 'z' maximizes the
 *        active pane (chat panel becomes hidden while a terminal pane is
 *        maximized, and reappears once toggled back); leader + 'x' closes
 *        the active terminal pane, leaving just chat.
 *
 * K1/K4/K5 need real, deterministic session titles/siblings, so (like
 * workspace-tabs.spec.ts) K1 and K4 drive two short real `claude` turns to
 * materialize two sibling sessions in the same ("no project") project —
 * Fix 3 defers a session's DB row (and hence its sidebar/Navigator
 * appearance) until its first message. Requires `claude` on PATH; skipped
 * otherwise. K2/K3/K5 don't need a persisted session and always run.
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

/** Fire the Ctrl+Space leader chord followed by `key`. Body must not have
 * focus inside an editable element for the leader to arm. */
async function leaderChord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

test.describe("Keybindings + Navigator (Phase 4)", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  /** Two sibling sessions in the same ("No project") project, created by K1
   * and reused by K4. */
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
  // K1 — Navigator: open via Ctrl+K, filter by typing, Enter switches + closes,
  // Escape closes without switching.
  // -------------------------------------------------------------------------
  test("K1. Ctrl+K opens Navigator; filtering + Enter switches session; Escape closes", async ({ page }) => {
    test.setTimeout(240000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — skipping keybindings suite (real turns required)");
      return;
    }

    await freshPage(page);

    // Session A.
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await sendAndWait(page, "Reply with exactly: KBNAV-ALPHA");
    sessionAId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionAId).toBeTruthy();

    // Session B, same project, via the tab bar's own "+" (Wave 1 item 1 —
    // this opens the same directory-browser popover as the sidebar's "+",
    // with the current project's cwd preselected as the first quick-pick
    // option, so an explicit click on it is required to actually create B).
    // The tab-bar "+" creates straight into the active project — no popover,
    // same destination the "project-option-0" quick-pick used to select.
    await page.locator('[data-testid="tab-new"]').click();
    await sendAndWait(page, "Reply with exactly: KBNAV-BETA");
    sessionBId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionBId).toBeTruthy();
    expect(sessionBId).not.toEqual(sessionAId);

    // Blur the composer so focus isn't inside an editable element.
    await page.locator(".chat__input textarea").blur();

    // Escape-without-switching path first: open, verify listing, close via Escape.
    await page.keyboard.press("Control+k");
    const navigator = page.locator('[data-testid="navigator"]');
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionAId}"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionBId}"]`)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(navigator).not.toBeVisible({ timeout: 5000 });
    // Still on session B — Escape must not have switched anything.
    await expect(page.locator(`.session-item--active[data-session-id="${sessionBId}"]`)).toBeVisible();

    await page.screenshot({ path: "artifacts/k1-navigator-open.png" });

    // Now filter down to A and switch via Enter.
    await page.keyboard.press("Control+k");
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="navigator-input"]').fill("KBNAV-ALPHA");
    await expect(page.locator(`[data-testid="navigator-row-${sessionAId}"]`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="navigator-row-${sessionBId}"]`)).not.toBeVisible();
    await page.keyboard.press("Enter");
    await expect(navigator).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`.session-item--active[data-session-id="${sessionAId}"]`)).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({ path: "artifacts/k1-switched-to-a.png" });
  });

  // -------------------------------------------------------------------------
  // K2 — KeybindHelp: plain '?' opens it outside inputs; '?' typed inside the
  // composer just inserts a character; Escape closes.
  // -------------------------------------------------------------------------
  test("K2. plain '?' opens KeybindHelp outside inputs; suppressed while typing", async ({ page }) => {
    await freshPage(page);

    const textarea = page.locator(".chat__input textarea");
    const helpModal = page.locator('[data-testid="keybind-help"]');

    // '?' typed while the composer has focus must NOT open the modal — it's
    // a normal character in the message. Use a real keypress (not .fill(),
    // which sets the value directly without dispatching keydown) so the
    // focus-guard in keybinds.ts is actually exercised.
    await textarea.click();
    await page.keyboard.type("what now");
    await page.keyboard.press("Shift+Slash"); // '?' = Shift+/
    await expect(helpModal).not.toBeVisible();
    await expect(textarea).toHaveValue("what now?");
    await textarea.fill("");

    // Blur, then plain '?' opens the modal.
    await textarea.blur();
    await page.keyboard.press("Shift+Slash"); // '?' = Shift+/
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
  // K3 — leader,b toggles sidebar collapse; the footer button does the same.
  // -------------------------------------------------------------------------
  test("K3. leader,b and the footer button toggle sidebar collapse", async ({ page }) => {
    await freshPage(page);

    const sidebar = page.locator(".sidebar");
    await expect(sidebar).not.toHaveClass(/sidebar--collapsed/);

    await leaderChord(page, "b");
    await expect(sidebar).toHaveClass(/sidebar--collapsed/, { timeout: 5000 });

    await page.screenshot({ path: "artifacts/k3-sidebar-collapsed.png" });

    // The same chord expands it back.
    await leaderChord(page, "b");
    await expect(sidebar).not.toHaveClass(/sidebar--collapsed/, { timeout: 5000 });

    // The footer's collapse-toggle button is an equivalent mouse control.
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click();
    await expect(sidebar).toHaveClass(/sidebar--collapsed/, { timeout: 5000 });
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click();
    await expect(sidebar).not.toHaveClass(/sidebar--collapsed/, { timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // K4 — leader,n / leader,p cycle sibling sessions within the active project.
  // -------------------------------------------------------------------------
  test("K4. leader,n / leader,p cycle sessions within the active project", async ({ page }) => {
    test.setTimeout(60000);
    if (!claudeAvailable || !sessionAId || !sessionBId) {
      test.skip(true, "K1 did not produce two sessions — skipping K4");
      return;
    }

    await freshPage(page);
    // Land on A via the sidebar (a real persisted row) in this fresh context.
    await page.locator(`.session-item[data-session-id="${sessionAId}"]`).click();
    await expect(page.locator(`.session-item--active[data-session-id="${sessionAId}"]`)).toBeVisible({
      timeout: 15000,
    });

    // leader,n -> next sibling (B).
    await leaderChord(page, "n");
    await expect(page.locator(`.session-item--active[data-session-id="${sessionBId}"]`)).toBeVisible({
      timeout: 10000,
    });

    // leader,p -> back to A.
    await leaderChord(page, "p");
    await expect(page.locator(`.session-item--active[data-session-id="${sessionAId}"]`)).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({ path: "artifacts/k4-cycled-back-to-a.png" });
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
