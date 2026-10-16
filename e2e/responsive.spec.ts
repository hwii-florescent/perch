/**
 * responsive.spec.ts — e2e tests for Phase 5's narrow-width collapse: below
 * `MOBILE_WIDTH_BREAKPOINT` (700px, see `responsive.ts`), `App.tsx` swaps the
 * desktop `<Sidebar/>`+`<TabBar/>`+`<StatusBar/>` chrome for `<MobileHeader/>`+
 * `<MobileSwitcher/>` and a canvas of one active pane over a bottom pane bar.
 *
 *   R1 — at <=700px, the sidebar and tab bar are hidden and the mobile
 *        header and one-pane canvas are shown instead.
 *   R2 — tapping the mobile header's "Switch" button opens the slide-over.
 *   R3 — selecting a session from the slide-over switches to it and closes
 *        the slide-over.
 *   R4 — at a normal desktop viewport, none of the mobile chrome renders and
 *        the existing Sidebar/TabBar look is unaffected.
 *   R5 — Settings is a section list with a back row, no Keyboard section.
 *   R6 — a controlled agent terminal gets a quick-key bar that types into it.
 *   R7 	a host added on the phone shows up in the switcher's host picker.
 *   R9 — holding a workspace row in the switcher opens its action menu.
 *   R10 — a phone that cannot reach its laptop says so, then recovers.
 *
 * All tests are headless; viewport changes use `page.setViewportSize` (never
 * a real device emulation reload) so the same page/context can flip between
 * mobile and desktop widths within a single test where useful.
 */

import { test, expect, type Page } from "@playwright/test";
import { restoreChatMode } from "./chatMode";
import { addProject, startChat } from "./projects";
import { firstWorkspaceId, holdRow } from "./workspaceTools";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:7799";
const MOBILE_VIEWPORT = { width: 375, height: 700 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
}

test.describe("Responsive narrow-width collapse (Phase 5)", () => {
  test.describe.configure({ mode: "serial" });



  test.afterAll(() => {
    restoreChatMode();
  });

  // -------------------------------------------------------------------------
  // R1 — sidebar + tab bar hidden, mobile header shown, at <=700px.
  // -------------------------------------------------------------------------
  test("R1. sidebar/tab bar hidden and mobile header shown at <=700px", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".sidebar")).not.toBeVisible();
    await expect(page.locator(".tab-bar")).not.toBeVisible();
    // The outer canvas remains (the status bar does not: the header carries
    // the session, the switcher the usage), while the multi-pane Dockview
    // tree is replaced by one mounted mobile pane.
    await expect(page.locator(".dock-area")).toBeVisible();
    await expect(page.locator(".status-bar")).toHaveCount(0);
    await expect(page.getByTestId("mobile-pane-chat")).toBeVisible();
    await expect(page.getByTestId("mobile-pane-shell")).toBeVisible();
    await expect(page.locator(".dockview-theme-perch")).toHaveCount(0);
    await expect(page.locator('[data-testid^="pane-tab-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
    await expect(page.locator(".chat")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "artifacts/r1-mobile-header.png" });
  });

  // -------------------------------------------------------------------------
  // R2 — "Switch" opens the slide-over.
  // -------------------------------------------------------------------------
  test("R2. mobile header 'Switch' button opens the slide-over", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    const switcher = page.locator('[data-testid="mobile-switcher"]');
    await expect(switcher).not.toBeVisible();

    await page.locator('[data-testid="mobile-switch"]').click();
    await expect(switcher).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "artifacts/r2-mobile-switcher-open.png" });

    // Closing it via its own close button dismisses it again.
    await page.locator('[data-testid="mobile-switcher-close"]').click();
    await expect(switcher).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // R2b — selecting another pane replaces the content component rather than
  // leaving all desktop pane/editor instances mounted underneath it.
  // -------------------------------------------------------------------------
  test("R2b. mobile pane switch keeps exactly one active mounted surface", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    await page.locator('[data-testid="mobile-pane-files"]').click();
    await expect(page.getByTestId("mobile-active-pane-files")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
    await expect(page.locator(".chat")).toHaveCount(0);
    await expect(page.locator(".dockview-theme-perch")).toHaveCount(0);

    await page.locator('[data-testid="mobile-pane-chat"]').click();
    await expect(page.getByTestId("mobile-active-pane-chat")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
    await expect(page.locator(".chat")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: "artifacts/r2b-mobile-single-pane.png" });
  });

  // -------------------------------------------------------------------------
  // R3 — selecting a session from the slide-over switches + closes it.
  // -------------------------------------------------------------------------
  test("R3. selecting a session in the slide-over switches to it and closes", async ({ page }) => {
    // Start two sessions at desktop width, where the New session picker lives.
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    const sessionAId = await startChat(page);
    await startChat(page);

    // Now shrink to mobile width — same page/context, no reload, so both
    // sessions are already known to the store (session.list already arrived).
    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible({ timeout: 10000 });

    // Currently on B (the last-created session). Open the switcher and pick A.
    await page.locator('[data-testid="mobile-switch"]').click();
    const switcher = page.locator('[data-testid="mobile-switcher"]');
    await expect(switcher).toBeVisible({ timeout: 5000 });
    const rowA = switcher.getByTestId(`workspace-session-${sessionAId}`);
    await rowA.scrollIntoViewIfNeeded();
    await rowA.click();

    // Selecting closes the slide-over...
    await expect(switcher).not.toBeVisible({ timeout: 5000 });
    // ...and actually switches the active session.
    await expect(async () => {
      const stored = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      expect(stored).toEqual(sessionAId);
    }).toPass({ timeout: 10000 });

  });

  // -------------------------------------------------------------------------
  // R4 — desktop viewport is unaffected: no mobile chrome renders.
  // -------------------------------------------------------------------------
  test("R4. desktop viewport shows the normal Sidebar/TabBar chrome only", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);

    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="mobile-header"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="mobile-switcher"]')).not.toBeVisible();

    await page.screenshot({ path: "artifacts/r4-desktop-unaffected.png" });
  });

  // -------------------------------------------------------------------------
  // R5: phone settings are a list, then one section with a back row.
  // -------------------------------------------------------------------------
  test("R5. phone settings list sections, open one and go back", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);

    await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("settings-nav-general")).toBeVisible();
    await expect(page.getByTestId("settings-nav-keyboard")).toHaveCount(0);
    await page.getByTestId("settings-nav-appearance").click();
    await expect(page.getByTestId("settings-nav-general")).toHaveCount(0);
    await page.getByTestId("settings-back").click();
    await expect(page.getByTestId("settings-nav-appearance")).toBeVisible();
    await page.getByTestId("settings-close").click();
    await expect(page.getByTestId("settings-modal")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // R6: the quick-key bar sends keys to the agent terminal being driven.
  // -------------------------------------------------------------------------
  test("R6. quick-key bar types into the controlled terminal", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    await startChat(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-controlling", "true", { timeout: 20000 });
    const bar = page.getByTestId("mobile-key-bar");
    await expect(bar).toBeVisible();
    await terminal.locator(".xterm").click();
    await page.keyboard.type("echo keybar_ok");
    await bar.getByRole("button", { name: "Enter", exact: true }).click();
    await expect(terminal.locator(".xterm-rows > div").filter({ hasText: /^keybar_ok$/ })).toHaveCount(1, { timeout: 10000 });
    await page.screenshot({ path: "artifacts/r6-mobile-key-bar.png" });

    // No bar on another pane, nor on the desktop layout.
    await page.getByTestId("mobile-pane-files").click();
    await expect(bar).toHaveCount(0);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await expect(bar).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // R8: Files and Git are the desktop drawer's own components and rules.
  // -------------------------------------------------------------------------
  test("R8. phone Files is the drawer's explorer; Git only for a git workspace", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    await startChat(page); // Chats: the scratch folder, not a git checkout
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.getByTestId("mobile-pane-files").click();
    await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Search files" })).toBeVisible();
    await expect(page.getByTestId("mobile-pane-git")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // R9: the desktop's right-click menu, as a long hold; no buttons on the row.
  // -------------------------------------------------------------------------
  test("R9. holding a workspace row opens its actions; the row has no buttons", async ({ page }) => {
    const repo = path.resolve(__dirname, "..");
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await freshPage(page);
    await addProject(page, repo);
    await startChat(page, "terminal", repo);
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.getByTestId("mobile-switch").click();
    const switcher = page.getByTestId("mobile-switcher");
    const id = await firstWorkspaceId(switcher.getByTestId("project-list"));
    await expect(switcher.getByTestId(`workspace-files-${id}`)).toHaveCount(0);
    await expect(switcher.getByTestId(`workspace-pin-${id}`)).toHaveCount(0);

    await holdRow(page, switcher.getByTestId(`workspace-entry-${id}`));
    await expect(page.getByTestId("row-menu")).toBeVisible();
    const pin = page.getByTestId(`workspace-pin-${id}`);
    expect((await pin.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId(`workspace-menu-files-${id}`).click();
    await expect(page.getByTestId("mobile-active-pane-files")).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // R10: no laptop, no app.
  // -------------------------------------------------------------------------
  test("R10. an unreachable laptop shows the connect screen, and the app returns once it answers", async ({ page }) => {
    // Point every socket at a closed port until the flag is cleared.
    await page.addInitScript(() => {
      const Real = window.WebSocket;
      (window as unknown as { __blockWs: boolean }).__blockWs = true;
      window.WebSocket = class extends Real {
        constructor(url: string | URL, protocols?: string | string[]) {
          super((window as unknown as { __blockWs: boolean }).__blockWs ? "ws://127.0.0.1:1/ws" : url, protocols);
        }
      } as typeof WebSocket;
    });
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("laptop-unreachable")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("laptop-unreachable")).toContainText("127.0.0.1:7799");
    await expect(page.getByTestId("mobile-header")).toHaveCount(0);

    await page.evaluate(() => { (window as unknown as { __blockWs: boolean }).__blockWs = false; });
    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 25000 });
    await expect(page.getByTestId("laptop-unreachable")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // R7: remote hosts are manageable and reachable from the phone.
  // -------------------------------------------------------------------------
  test("R7. a host added on the phone appears in the switcher's host picker", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await freshPage(page);
    await expect(page.getByTestId("mobile-switch")).toBeVisible({ timeout: 15000 });

    // The hub may have no host yet: the picker is then not offered at all.
    const name = `phone-host-${Date.now()}`;
    try {
      await page.getByTestId("settings-gear").click();
      await page.getByTestId("settings-nav-hosts").click();
      await page.getByTestId("host-name-input").fill(name);
      await page.getByTestId("host-ssh-input").fill("perch-e2e-nohost.invalid");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByTestId(`host-delete-${name}`)).toBeVisible({ timeout: 10000 });
      // Never leave a host retrying ssh against a name that does not exist.
      // (The box follows the server's reply, so click it and wait rather than uncheck().)
      const enabled = page.getByTestId(`host-delete-${name}`).locator("xpath=..").getByRole("checkbox");
      await enabled.click();
      await expect(enabled).not.toBeChecked({ timeout: 10000 });
      await page.getByTestId("settings-back").click();
      await page.getByTestId("settings-close").click();

      await page.getByTestId("mobile-switch").click();
      const picker = page.getByTestId("mobile-switcher").getByTestId("host-switcher");
      await expect(picker).toBeVisible({ timeout: 5000 });
      await picker.click();
      await expect(page.getByTestId("host-switcher-popover")).toBeVisible();
      await expect(page.getByTestId("host-switcher-popover")).toContainText(name);
      await page.screenshot({ path: "artifacts/r7-mobile-host-picker.png" });
    } finally {
      await page.keyboard.press("Escape");
      await page.evaluate(() => (document.querySelector('[data-testid="mobile-switcher-close"]') as HTMLElement | null)?.click());
      await page.getByTestId("settings-gear").click();
      await page.getByTestId("settings-nav-hosts").click();
      const del = page.getByTestId(`host-delete-${name}`);
      if (await del.count()) await del.click();
    }
  });
});
