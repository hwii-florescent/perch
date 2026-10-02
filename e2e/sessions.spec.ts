/**
 * sessions.spec.ts — session lifecycle:
 *   S1 — "New session" opens a picker of listed projects plus "No project",
 *         with no folder browser; "No project" starts the session in Chats.
 *   S4 — a row's × deletes the session, and so does exiting its terminal:
 *         it leaves the sidebar for good.
 *   S5 — a project's "Close all sessions" and "Remove project" delete its
 *         sessions and end what they run; the removed project is gone.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
}

test.describe("Session lifecycle", () => {
  test("S1. New session offers projects and Chats, never a folder browser", async ({ page }) => {
    await open(page);
    await page.getByTestId("new-session-local").click();
    await expect(page.getByTestId("project-option-none")).toBeVisible();
    await expect(page.locator('[data-testid="dir-browser"]')).toHaveCount(0);
    await page.keyboard.press("Escape");

    const id = await startChat(page);
    await expect(page.locator(".workspace-entry", { has: page.getByTestId(`workspace-session-${id}`) })).toContainText(".perch/scratch");
  });

  test("S4. × and exiting the terminal delete the session", async ({ page }) => {
    await open(page);
    const closed = await startChat(page);
    await page.getByTestId(`workspace-session-close-${closed}`).click();
    await expect(page.getByTestId(`workspace-session-${closed}`)).toHaveCount(0);

    const exited = await startChat(page);
    await page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea").pressSequentially("exit\n");
    await expect(page.getByTestId(`workspace-session-${exited}`)).toHaveCount(0, { timeout: 15000 });

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
    for (const id of [closed, exited]) await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
  });

  test("S5. Close all sessions and Remove project delete sessions and end what they run", async ({ page }) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sessions-remove-"));
    const project = page.locator(".workspace-project").filter({ hasText: path.basename(dir) });
    /** Start a shell session in `dir` running a uniquely named `sleep`;
     * returns its id and whether that sleep is still running. */
    async function busySession(): Promise<[string, () => boolean]> {
      const id = await startChat(page, "terminal", dir);
      const marker = `sleep ${40000 + Math.floor(Math.random() * 9999)}`;
      await page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea").pressSequentially(`${marker}\n`);
      const running = () => spawnSync("pgrep", ["-f", marker]).status === 0;
      await expect.poll(running).toBe(true);
      return [id, running];
    }
    async function projectMenu(item: string): Promise<void> {
      await project.locator('[data-testid^="workspace-project-menu-"]').click();
      await page.locator(`[data-testid^="workspace-project-${item}-"]`).click();
    }
    try {
      const [closed, closedRunning] = await busySession();
      await projectMenu("close-all");
      await expect(page.getByTestId(`workspace-session-${closed}`)).toHaveCount(0);
      await expect.poll(closedRunning).toBe(false);

      const [removed, removedRunning] = await busySession();
      await projectMenu("remove");
      await page.getByTestId("confirm-accept").click();
      await expect(project).toHaveCount(0);
      await expect(page.getByTestId(`workspace-session-${removed}`)).toHaveCount(0);
      await expect.poll(removedRunning).toBe(false);

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
      await expect(project).toHaveCount(0);
      for (const id of [closed, removed]) await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
