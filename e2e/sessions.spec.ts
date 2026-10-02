/**
 * sessions.spec.ts — session lifecycle:
 *   S1 — "New session" opens a picker of listed projects plus "No project",
 *         with no folder browser; "No project" starts the session in Chats.
 *   S4 — a row's × archives the session: it leaves the sidebar and is listed
 *         in Settings → Archived sessions, where Restore brings it back and
 *         Delete removes it for good.
 */
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

  test("S4. × archives; Settings restores or deletes", async ({ page }) => {
    await open(page);
    const id = await startChat(page);
    const row = page.getByTestId(`workspace-session-${id}`);
    const archived = page.getByTestId(`archived-row-${id}`);

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

    await page.getByTestId(`workspace-session-close-${id}`).click();
    await expect(row).toHaveCount(0);
    await openArchivedPanel();
    await expect(archived).toBeVisible();
    await page.getByTestId(`archived-restore-${id}`).click();
    await expect(archived).toHaveCount(0);
    await closeSettings();
    await expect(row).toBeVisible();

    await page.getByTestId(`workspace-session-close-${id}`).click();
    await expect(row).toHaveCount(0);
    await openArchivedPanel();
    await page.getByTestId(`archived-delete-${id}`).click();
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    await expect(archived).toHaveCount(0);
    await closeSettings();

    await page.reload({ waitUntil: "networkidle" });
    await expect(row).toHaveCount(0);
    await openArchivedPanel();
    await expect(archived).toHaveCount(0);
  });
});
