/**
 * needs-you.spec.ts — Needs You + Welcome Back against a real Claude turn
 * (claude-haiku-4-5; run the core with ANTHROPIC_MODEL=claude-haiku-4-5).
 *
 * A question asked while nobody watches lands in Needs You, survives a reload,
 * opens the exact agent, and leaves only when it is answered in the CLI.
 * See `server/attention.rs` and `packages/web/src/attention.ts`.
 */
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import { startChat } from "./projects";

const QUESTION = "Use the AskUserQuestion tool to ask me one question: red or blue? Offer exactly those two options. After I answer, reply with only the colour.";

async function open(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("needs-you-toggle")).toBeVisible({ timeout: 15_000 });
}

test.describe("Needs You", () => {
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

    const count = page.getByTestId("needs-you-count");
    await expect(count).toHaveText("1", { timeout: 90_000 });

    // Persistent: a reload (a new connection) still lists it.
    await page.reload({ waitUntil: "networkidle" });
    await expect(count).toHaveText("1", { timeout: 15_000 });

    if (!(await page.getByTestId("needs-you-panel").isVisible())) await page.getByTestId("needs-you-toggle").click();
    const row = page.getByTestId("needs-you-list").locator(`[data-session="${sessionId}"]`);
    await expect(row).toContainText("Waiting for you");
    // A live question has no Dismiss: reading is not resolving.
    await expect(row.getByTestId("attention-dismiss")).toHaveCount(0);
    await row.getByTestId("attention-open").click();
    await expect(page.getByTestId(`tab-${sessionId}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15_000 });
    await expect(count).toHaveText("1");

    // Answer in the CLI itself (first option), and the item leaves the queue.
    await page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea").press("Enter");
    await expect(count).toHaveCount(0, { timeout: 60_000 });
  });

  test("N2. Cmd/Alt+Shift+U with nothing waiting opens the panel and says so", async ({ page }) => {
    await open(page);
    await page.locator("body").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+U" : "Alt+Shift+U");
    await expect(page.getByTestId("needs-you-panel")).toBeVisible();
    await expect(page.getByTestId("needs-you-empty")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("needs-you-panel")).toHaveCount(0);
  });
});
