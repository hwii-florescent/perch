/**
 * cli-sync.spec.ts — a CLI agent runs inside a login shell, so leaving the
 * agent leaves a shell in the same pane; leaving that shell too closes the
 * session like its tab's ×.
 */

import { test, expect } from "@playwright/test";
import { startChat } from "./projects";

test("A2. exiting the CLI and its shell closes the session", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "claude");
  const rows = page.getByTestId("persistent-agent-terminal").locator(".xterm-rows");
  const input = page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea");
  await expect(rows).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });

  await input.pressSequentially("/exit");
  await expect(rows).toContainText("Exit the CLI"); // the slash menu caught up
  await input.press("Enter");
  await page.waitForTimeout(3000); // claude exiting, the login shell starting
  await input.pressSequentially("exit");
  await input.press("Enter");

  await expect(page.getByTestId(`tab-${sessionId}`)).toHaveCount(0, { timeout: 30_000 });
});
