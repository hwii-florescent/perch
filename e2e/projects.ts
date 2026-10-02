import { expect, type Page } from "@playwright/test";
import * as path from "node:path";

/** Sessions start only in a project listed in perch, or in Chats. Register
 * `dir` the way "+ Add project" does; resolves once the server replies. */
export async function addProject(page: Page, dir: string): Promise<void> {
  await page.evaluate((dir) => new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { ws.close(); reject(new Error("project.create timed out")); }, 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "project.create", requestId, path: dir }));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.requestId !== requestId) return;
      clearTimeout(timer);
      ws.close();
      if (message.type === "error") reject(new Error(message.message));
      else resolve();
    };
  }), dir);
}

/** With the new-session picker open, add `dir` as a project and start the
 * session in it. */
export async function pickProject(page: Page, dir: string): Promise<void> {
  await addProject(page, dir);
  const option = page.locator('[data-testid^="project-option-"]').filter({ hasText: path.basename(dir) });
  await expect(option.first()).toBeVisible({ timeout: 10_000 });
  await option.first().click();
}
