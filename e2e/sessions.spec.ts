/**
 * sessions.spec.ts — session lifecycle:
 *   S1 — "New session" opens a picker of listed projects plus "No project",
 *         with no folder browser; "No project" starts the session in Chats.
 *   S4 — a row's × deletes the session, and so does exiting its terminal:
 *         it leaves the sidebar for good and is not listed as archived.
 *   S5 — "Archive chats" archives instead: Settings → Archived sessions
 *         restores or deletes it.
 */
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
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-archived-open").click();
    await expect(page.getByTestId("settings-archived-panel")).toBeVisible();
    for (const id of [closed, exited]) {
      await expect(page.getByTestId(`workspace-session-${id}`)).toHaveCount(0);
      await expect(page.getByTestId(`archived-row-${id}`)).toHaveCount(0);
    }
  });

  test("S5. Archive chats archives; Settings restores or deletes", async ({ page }) => {
    await open(page);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-sessions-archive-"));
    try {
      const id = await startChat(page, "terminal", dir);
      const row = page.getByTestId(`workspace-session-${id}`);
      const archived = page.getByTestId(`archived-row-${id}`);
      const project = page.locator(".workspace-project").filter({ hasText: path.basename(dir) });

      async function archive(): Promise<void> {
        await project.locator('[data-testid^="workspace-project-menu-"]').click();
        await page.locator('[data-testid^="workspace-project-archive-chats-"]').click();
        await expect(row).toHaveCount(0);
      }
      async function openArchivedPanel(): Promise<void> {
        await page.getByTestId("settings-gear").click();
        await page.getByTestId("settings-archived-open").click();
        await expect(page.getByTestId("settings-archived-panel")).toBeVisible();
      }
      async function closeSettings(): Promise<void> {
        await page.keyboard.press("Escape"); // the subpage
        await page.keyboard.press("Escape"); // the modal
        await expect(page.getByTestId("settings-modal")).not.toBeVisible();
      }

      await archive();
      await openArchivedPanel();
      await page.getByTestId(`archived-restore-${id}`).click();
      await expect(archived).toHaveCount(0);
      await closeSettings();
      await expect(row).toBeVisible();

      await archive();
      await openArchivedPanel();
      await page.getByTestId(`archived-delete-${id}`).click();
      await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
      await expect(archived).toHaveCount(0);
      await closeSettings();

      await page.reload({ waitUntil: "networkidle" });
      await expect(row).toHaveCount(0);
      await openArchivedPanel();
      await expect(archived).toHaveCount(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
