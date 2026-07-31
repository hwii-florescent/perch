/**
 * wave2.spec.ts — e2e coverage for Wave 2 (herdr functionality gaps, batch 2):
 *
 *   X1 — leader,h/j/k/l focus adjacent panes; leader,o cycles focus. Asserted
 *        via dockview-core's own `dv-active-group` class on the `.dv-groupview`
 *        container (toggled by `dockviewGroupPanelModel.js` whenever a group
 *        becomes/stops being the active group).
 *   X2 — leader,+ grows the focused (split) pane; leader,- shrinks it —
 *        asserted via the group's bounding box width changing.
 *   X3 — dragging a TabBar tab reorders the strip; the new order persists
 *        across a reload (client-side only, via `tabOrder.ts`'s localStorage
 *        key — no protocol field). TabBar's drag handlers are plain React
 *        state (`draggingId`), not `DataTransfer`-payload-driven, but they're
 *        wired to native HTML5 `dragstart`/`dragover`/`drop`/`dragend`
 *        events, so a real `DataTransfer` still has to be dispatched for the
 *        events to fire as `DragEvent`s at all (Playwright's built-in
 *        `dragTo()` only simulates mouse movement, which native HTML5
 *        `draggable` elements ignore — see Playwright's documented
 *        workaround for testing HTML5 drag-and-drop).
 *   X4 — first-run onboarding modal appears on a genuinely fresh browser
 *        profile and dismissing it marks it seen (never shown again). Every
 *        *other* test in this suite (and the rest of the e2e suite) runs
 *        against a profile that's pre-seeded as "already seen" via
 *        `playwright.config.ts`'s global `storageState` — this test alone
 *        overrides that back to empty storage.
 *   X5 — the "pane labels" settings toggle shows/hides the active-agent
 *        badge on the chat pane's tab (default ON).
 *
 * Clipboard image paste (item 9) has no dedicated Playwright test here:
 * synthesizing a real OS clipboard paste event carrying `image/*` data is not
 * reliably headless-automatable (`ClipboardEvent.clipboardData` with binary
 * image items requires either real OS clipboard access, which headless
 * Chromium doesn't grant deterministically, or constructing a `DataTransfer`
 * with a `File` in-page, which never round-trips through the same "paste"
 * event path the production code listens on). It was instead verified
 * manually:
 *   1. `curl -sS -X POST 'http://127.0.0.1:7799/clipboard-image?ext=png'
 *      -H 'Content-Type: image/png' --data-binary @some.png` returns
 *      `{"path":"/Users/.../.perch/clipboard-images/<uuid>.png"}`, and the
 *      file exists on disk afterward with `0600` permissions in a `0700`
 *      directory.
 *   2. A `terminal.input` WS message containing that quoted path is
 *      indistinguishable, from the PTY's point of view, from any other typed
 *      text — `clipboardImagePaste.ts`'s `uploadAndInsertPath` funnels
 *      through the exact same `sendTerminalInput` store action the keyboard
 *      path already uses (verified by reading the code, not re-testing
 *      `terminal.input` itself, which is already covered elsewhere).
 *
 * All tests are headless (no --headed/--ui).
 */

import { test, expect, type Page, type Locator } from "@playwright/test";

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

/** Fire the Ctrl+Space leader chord followed by `key`. */
async function leaderChord(page: Page, key: string): Promise<void> {
  await page.keyboard.press("Control+Space");
  await page.keyboard.press(key);
}

/** Locator for a pane's tab that isn't the permanent "chat" panel — terminal
 * panel ids are randomly generated (mirrors pane-splitting.spec.ts). */
function nonChatTab(page: Page): Locator {
  return page.locator('[data-testid^="pane-tab-"]:not([data-testid="pane-tab-chat"])');
}

/** The `.dv-groupview` container ancestor of a given tab locator — dockview
 * toggles `dv-active-group` on this element (see
 * `dockviewGroupPanelModel.js`'s `setActive`). */
function groupOfTab(tab: Locator): Locator {
  return tab
    .locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' dv-groupview ')]")
    .first();
}

async function isGroupActive(group: Locator): Promise<boolean> {
  const cls = (await group.getAttribute("class")) ?? "";
  return cls.split(/\s+/).includes("dv-active-group");
}

/** Simulates a native HTML5 drag-and-drop of `source` onto `target`.
 * Playwright's built-in `dragTo()` only replays mouse movement, which real
 * `draggable` elements ignore — dispatching the actual `DragEvent` sequence
 * (with a real in-page `DataTransfer`) is Playwright's documented workaround
 * for testing HTML5 drag-and-drop. */
async function htmlDragAndDrop(page: Page, source: Locator, target: Locator): Promise<void> {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
}

test.describe("Wave 2 functionality gaps", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;

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
  // X1 — directional pane focus (leader,h/j/k/l) and cycle (leader,o)
  // -------------------------------------------------------------------------
  test("X1. leader,h/l focus adjacent panes; leader,o cycles focus", async ({ page }) => {
    await freshPage(page);

    const chatTab = page.locator('[data-testid="pane-tab-chat"]');
    await expect(chatTab).toBeVisible({ timeout: 10000 });

    // Split a terminal to the right of chat — two groups now exist.
    await leaderChord(page, "v");
    const terminalTab = nonChatTab(page);
    await expect(terminalTab).toBeVisible({ timeout: 10000 });

    const chatGroup = groupOfTab(chatTab);
    const terminalGroup = groupOfTab(terminalTab);

    // The newly-added panel becomes active.
    await expect.poll(() => isGroupActive(terminalGroup)).toBe(true);
    expect(await isGroupActive(chatGroup)).toBe(false);

    // leader,h -> focus moves left, to the chat group.
    await leaderChord(page, "h");
    await expect.poll(() => isGroupActive(chatGroup)).toBe(true);
    expect(await isGroupActive(terminalGroup)).toBe(false);

    // leader,l -> focus moves right, back to the terminal group.
    await leaderChord(page, "l");
    await expect.poll(() => isGroupActive(terminalGroup)).toBe(true);
    expect(await isGroupActive(chatGroup)).toBe(false);

    await page.screenshot({ path: "artifacts/x1-focus-terminal.png" });

    // leader,o -> cycles focus; with exactly two groups, that's the other one.
    await leaderChord(page, "o");
    await expect.poll(() => isGroupActive(chatGroup)).toBe(true);
    expect(await isGroupActive(terminalGroup)).toBe(false);

    await page.screenshot({ path: "artifacts/x1-cycled.png" });
  });

  // -------------------------------------------------------------------------
  // X2 — grow/shrink the focused pane (leader,+ / leader,-)
  // -------------------------------------------------------------------------
  test("X2. leader,+ grows the focused pane; leader,- shrinks it", async ({ page }) => {
    await freshPage(page);

    await leaderChord(page, "v");
    const terminalTab = nonChatTab(page);
    await expect(terminalTab).toBeVisible({ timeout: 10000 });
    const terminalGroup = groupOfTab(terminalTab);
    await expect.poll(() => isGroupActive(terminalGroup)).toBe(true);

    const before = await terminalGroup.boundingBox();
    expect(before).toBeTruthy();

    await leaderChord(page, "+");
    await expect
      .poll(async () => (await terminalGroup.boundingBox())?.width ?? 0)
      .toBeGreaterThan(before!.width + 10);

    const grown = await terminalGroup.boundingBox();

    await page.screenshot({ path: "artifacts/x2-grown.png" });

    // Shrink twice — comfortably past the growth above, back below the
    // original width.
    await leaderChord(page, "-");
    await leaderChord(page, "-");
    await expect
      .poll(async () => (await terminalGroup.boundingBox())?.width ?? 0)
      .toBeLessThan(grown!.width - 10);

    await page.screenshot({ path: "artifacts/x2-shrunk.png" });
  });

  // -------------------------------------------------------------------------
  // X3 — drag-to-reorder tabs, persisted across reload
  // -------------------------------------------------------------------------
  test("X3. dragging a tab reorders the strip and persists across reload", async ({ page }) => {
    test.setTimeout(180000);
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found — X3 needs two persisted sibling sessions");
      return;
    }

    await freshPage(page);

    // Session A.
    await openLocalPicker(page);
    await page.locator('[data-testid="project-option-none"]').click();
    await sendAndWait(page, "Reply with exactly: WAVE2-TAB-A");
    const sessionAId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionAId).toBeTruthy();

    // Session B, same project, via the tab bar's own "+" (Wave 1 item 1 —
    // this opens the same directory-browser popover as the sidebar's "+",
    // with the current project's cwd preselected as the first quick-pick
    // option, so an explicit click on it is required to actually create B).
    await page.locator('[data-testid="tab-new"]').click();
    await expect(page.locator('[data-testid="dir-browser"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="project-option-0"]').click();
    await sendAndWait(page, "Reply with exactly: WAVE2-TAB-B");
    const sessionBId = (await page.locator(".session-item--active").getAttribute("data-session-id")) ?? "";
    expect(sessionBId).toBeTruthy();
    expect(sessionBId).not.toEqual(sessionAId);

    const tabA = page.locator(`[data-testid="tab-${sessionAId}"]`);
    const tabB = page.locator(`[data-testid="tab-${sessionBId}"]`);
    await expect(tabA).toBeVisible({ timeout: 10000 });
    await expect(tabB).toBeVisible({ timeout: 10000 });

    // The "no project" (cwd `~`) bucket accumulates sessions across the
    // *entire* e2e run (real sessions in the real local history db, not
    // reset between tests) — A/B are not necessarily at absolute indices
    // 0/1 in the strip. Check their order *relative to each other* instead.
    async function orderOfAB(): Promise<string[]> {
      const allIds = await page
        .locator('[data-testid="tab-bar"] .tab-bar__tab')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid") ?? ""));
      const wanted = new Set([`tab-${sessionAId}`, `tab-${sessionBId}`]);
      return allIds.filter((id) => wanted.has(id));
    }

    // Default order is creation order: A, B.
    expect(await orderOfAB()).toEqual([`tab-${sessionAId}`, `tab-${sessionBId}`]);

    // Drag B onto A -> B moves before A.
    await htmlDragAndDrop(page, tabB, tabA);
    await expect.poll(orderOfAB, { timeout: 5000 }).toEqual([`tab-${sessionBId}`, `tab-${sessionAId}`]);

    await page.screenshot({ path: "artifacts/x3-reordered.png" });

    // Persists across reload (client-side only — localStorage, not the WS
    // protocol).
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(`[data-testid="tab-${sessionAId}"]`)).toBeVisible({ timeout: 10000 });
    expect(await orderOfAB()).toEqual([`tab-${sessionBId}`, `tab-${sessionAId}`]);

    await page.screenshot({ path: "artifacts/x3-persisted-after-reload.png" });
  });

  // -------------------------------------------------------------------------
  // X4 — first-run onboarding modal
  // -------------------------------------------------------------------------
  test.describe("X4 onboarding (needs a genuinely empty profile)", () => {
    // Overrides the suite-wide "already seen" storageState set in
    // playwright.config.ts (which every other test — in this file and the
    // rest of the e2e suite — relies on to avoid the modal blocking
    // interaction) back to a truly empty profile, just for this test.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("X4. onboarding shows on first visit; dismiss persists across reload", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });

      const onboarding = page.locator('[data-testid="onboarding"]');
      await expect(onboarding).toBeVisible({ timeout: 10000 });
      await expect(onboarding).toContainText("perch");
      await expect(onboarding).toContainText("Ctrl+Space");

      await page.screenshot({ path: "artifacts/x4-onboarding-shown.png" });

      await page.locator('[data-testid="onboarding-dismiss"]').click();
      await expect(onboarding).not.toBeVisible({ timeout: 5000 });

      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("perch.onboarding.seen")))
        .toBe("1");

      // Never shown again on this profile.
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
      await expect(onboarding).not.toBeVisible();

      await page.screenshot({ path: "artifacts/x4-not-shown-after-reload.png" });
    });
  });

  // -------------------------------------------------------------------------
  // X5 — pane-labels settings toggle (active-agent badge on the chat tab)
  // -------------------------------------------------------------------------
  test("X5. pane-labels toggle shows/hides the chat tab's agent badge", async ({ page }) => {
    await freshPage(page);

    const badge = page.locator('[data-testid="chat-tab-agent-badge"]');

    // Default ON.
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toContainText("claude");

    await page.locator('[data-testid="settings-gear"]').click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });

    const toggle = page.locator('[data-testid="settings-pane-labels"]');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });

    await expect(badge).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/x5-badge-hidden.png" });

    // Toggle back on.
    await page.locator('[data-testid="settings-gear"]').click();
    await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="settings-pane-labels"]').check();
    await page.keyboard.press("Escape");

    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toContainText("claude");

    await page.screenshot({ path: "artifacts/x5-badge-shown.png" });
  });
});
