/**
 * sessions.spec.ts — session lifecycle:
 *   S1 — "New session" opens a picker of listed projects plus "No project",
 *         with no folder browser; "No project" starts the session in Chats,
 *         a flat chat list after the projects with no scratch-folder row.
 *   S4 — a row's × deletes the session, and so does exiting its terminal:
 *         it leaves the sidebar for good.
 *   S5 — a project's "Close all sessions" and "Remove project" delete its
 *         sessions and end what they run; the removed project is gone.
 *   S6 — clicking a workspace with no sessions never keeps showing another
 *         workspace's session: it shows that workspace's start picker, or
 *         starts the Settings default ("Empty workspace opens") directly.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { addProject, startChat } from "./projects";

/** Set Settings → "Empty workspace opens" through the real modal. */
async function setEmptyWorkspaceAgent(page: Page, agent: string): Promise<void> {
  await page.getByTestId("settings-gear").click();
  const select = page.getByTestId("settings-empty-workspace-agent");
  if (agent) await expect(select.locator(`option[value="${agent}"]`)).toHaveCount(1, { timeout: 10_000 });
  await select.selectOption(agent);
  await expect(select).toHaveValue(agent);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings-modal")).toHaveCount(0);
}

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
    const chats = page.getByTestId("workspace-chats");
    await expect(chats.getByTestId(`workspace-session-${id}`)).toBeVisible();
    await expect(page.getByTestId("project-list")).not.toContainText("scratch");
    await expect(chats).not.toContainText("scratch");
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

  test("S6. An empty workspace shows its start picker, or opens the Settings default", async ({ page }) => {
    const picked = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-empty-a-")));
    const auto = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-empty-b-")));
    try {
      await open(page);
      await setEmptyWorkspaceAgent(page, "");
      const chat = await startChat(page);
      await addProject(page, picked);
      await page.locator(`.workspace-entry__button[title="${picked}"]`).click();
      await expect(page.getByTestId("persistent-agent-terminal")).toHaveCount(0);
      await expect(page.getByTestId(`tab-${chat}`)).toHaveCount(0);
      await page.getByTestId("workspace-start-terminal").click();
      await expect(page.getByTestId("persistent-agent-terminal")).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
      await expect.poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId"))).not.toBe(chat);

      const first = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
      await setEmptyWorkspaceAgent(page, "terminal");
      await addProject(page, auto);
      await page.locator(`.workspace-entry__button[title="${auto}"]`).click();
      await expect(page.getByTestId("workspace-start-terminal")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId")), { timeout: 15_000 }).not.toBe(first);
      await expect(page.getByTestId(`tab-${first}`)).toHaveCount(0);
      await expect(page.getByTestId("persistent-agent-terminal")).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    } finally {
      await page.keyboard.press("Escape");
      await setEmptyWorkspaceAgent(page, "").catch(() => {});
      fs.rmSync(picked, { recursive: true, force: true });
      fs.rmSync(auto, { recursive: true, force: true });
    }
  });
});
