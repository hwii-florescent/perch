/**
 * needs-you.spec.ts — the sidebar's By status view (it replaced the Needs You
 * button and panel). N1 is a real Claude turn (claude-haiku-4-5; run the core
 * with ANTHROPIC_MODEL=claude-haiku-4-5): a question asked while nobody watches
 * lands in the Needs you section, survives a reload, opens the exact agent, and
 * leaves only when it is answered in the CLI. N2 and N3 spend nothing.
 * See `server/attention.rs`, `packages/web/src/attention.ts`, `statusView.ts`.
 */
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import { startChat } from "./projects";

const QUESTION = "Use the AskUserQuestion tool to ask me one question: red or blue? Offer exactly those two options. After I answer, reply with only the colour.";
const SHORTCUT = process.platform === "darwin" ? "Meta+Shift+U" : "Alt+Shift+U";

async function open(page: Page): Promise<void> {
  // These cover the By status view; the project tree is the default, so choose it.
  await page.addInitScript(() => localStorage.setItem("perch.sidebar.organize", "status"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15_000 });
}

/** Show `id` as blocked, as the core reports a chat waiting on a question. */
async function block(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => window.usePerchStore.setState((state) => ({
    sessions: state.sessions.map((session) => (session.id === id ? { ...session, status: "running" as const, blocked: true } : session)),
  })), id);
}

test.describe("Needs you (By status)", () => {
  test.describe.configure({ mode: "serial" });

  test("N1. a question asked unseen is queued, survives reload, and clears only when answered", async ({ page }) => {
    try { execSync("which claude"); } catch { test.skip(true, "claude is not installed"); }
    await open(page);
    const sessionId = await startChat(page, "claude");
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially(QUESTION);
    await input.press("Enter");
    // Look away: the question is asked while this viewer watches another session.
    await startChat(page);

    const row = page.getByTestId("status-section-needs").locator(`[data-session="${sessionId}"]`);
    await expect(row).toBeVisible({ timeout: 90_000 });
    await expect(row).toContainText("Waiting for you");

    // Persistent: a reload (a new connection) still lists it.
    await page.reload({ waitUntil: "networkidle" });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.click();
    await expect(page.getByTestId(`tab-${sessionId}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15_000 });
    // Reading is not resolving.
    await expect(row).toBeVisible();

    // Answer in the CLI itself (first option), and the chat leaves Needs you.
    // Keys typed before the reopened view attaches are dropped: wait for it.
    await expect(terminal).toHaveAttribute("data-writable", "true", { timeout: 15_000 });
    await terminal.locator(".xterm-helper-textarea").press("Enter");
    await expect(page.getByTestId("status-section-needs").locator(`[data-session="${sessionId}"]`)).toHaveCount(0, { timeout: 60_000 });
  });

  test("N2. Cmd/Alt+Shift+U goes to the next chat that needs you, and does nothing harmful with none", async ({ page }) => {
    await open(page);
    const waiting = await startChat(page);
    const reading = await startChat(page);
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-writable", "true", { timeout: 15_000 });
    await terminal.locator(".xterm-helper-textarea").focus();

    // With nothing waiting, from inside a focused terminal: the chat stays open and writable.
    await page.keyboard.press(SHORTCUT);
    await expect(page.getByTestId(`tab-${reading}`)).toHaveClass(/tab-bar__tab--active/);
    await expect(terminal).toHaveAttribute("data-writable", "true");
    await expect(page.getByTestId("needs-you-panel")).toHaveCount(0);

    await block(page, waiting);
    await expect(page.getByTestId("status-section-needs").locator(`[data-session="${waiting}"]`)).toBeVisible();
    await page.keyboard.press(SHORTCUT);
    await expect(page.getByTestId(`tab-${waiting}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15_000 });
  });

  test("N3. with the sidebar collapsed a count shows on its control, and the shortcut reveals the sidebar", async ({ page }) => {
    await open(page);
    const waiting = await startChat(page);
    await startChat(page);
    await block(page, waiting);
    const toggle = page.getByTestId("sidebar-collapse-toggle");
    await expect(toggle).toHaveAccessibleName("Collapse sidebar");
    await toggle.click();
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(page.getByTestId("needs-you-count")).toHaveText("1");
    await expect(toggle).toHaveAccessibleName(/Expand sidebar, 1 chat needs you/);
    await page.keyboard.press(SHORTCUT);
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.getByTestId(`tab-${waiting}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15_000 });
    await expect(page.getByTestId("needs-you-count")).toHaveCount(0);
  });

  test("N4. on the phone the switcher button carries the count, with a 44px target", async ({ page }) => {
    await open(page);
    const waiting = await startChat(page);
    await startChat(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const switcher = page.getByTestId("mobile-switch");
    // A late session update from the core can overwrite the injected state: set it again until it shows.
    await expect(async () => {
      await block(page, waiting);
      await expect(page.getByTestId("needs-you-count")).toHaveText("1", { timeout: 1000 });
    }).toPass();
    await expect(switcher).toHaveAccessibleName(/1 needs you/);
    expect((await switcher.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await switcher.click();
    await expect(page.getByTestId("mobile-switcher").getByTestId("status-section-needs").locator(`[data-session="${waiting}"]`)).toBeVisible();
  });
});
