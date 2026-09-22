import { expect, type Page } from "@playwright/test";

/**
 * Create a session in `cwd` over the wire and make it this page's active one.
 *
 * Not the tab-bar `+`: that launcher only creates *CLI-owned* sessions, which
 * render the native UI surface for the CLI — no Hosted composer and no model
 * chip, because model chrome belongs to the CLI there. A plain `session.create`
 * is the Hosted path, and it also costs nothing until a prompt is sent.
 */
export async function createHostedSession(page: Page, cwd: string): Promise<string> {
  const sessionId = await page.evaluate(async (target) => {
    const id = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
      const timer = setTimeout(() => { socket.close(); reject(new Error("session.create timed out")); }, 15000);
      socket.onopen = () => socket.send(JSON.stringify({ type: "session.create", cwd: target }));
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "session.created" || message.type === "error") {
          clearTimeout(timer);
          socket.close();
          if (message.type === "error") reject(new Error(message.message));
          else resolve(message.sessionId);
        }
      };
    });
    localStorage.setItem("perch.sessionId", id);
    return id;
  }, cwd);
  await page.reload({ waitUntil: "networkidle" });
  const dismiss = page.getByTestId("onboarding-dismiss");
  if (await dismiss.count()) await dismiss.click();
  const mode = page.getByTestId("session-mode-toggle");
  await expect(mode).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId("session-mode-scope").selectOption("session");
  if (await mode.getAttribute("aria-checked") === "true") await mode.click();
  await expect(page.getByTestId("model-chip")).toBeVisible({ timeout: 15_000 });
  return sessionId;
}


/**
 * Send one Hosted prompt and wait for the turn to finish: the last assistant
 * bubble contains `reply` and the composer is back to Send (Stop is shown only
 * while a message is streaming). Replaces the retired sidebar running dot.
 */
export async function sendAndWaitForReply(page: Page, prompt: string, reply: string | RegExp, timeout = 90_000): Promise<void> {
  const textarea = page.locator(".chat__input textarea");
  await expect(textarea).toBeEnabled({ timeout: 10_000 });
  await textarea.fill(prompt);
  await page.locator(".chat__send").click();
  await expect(page.locator(".message--assistant").last()).toContainText(reply, { timeout });
  await expect(page.locator(".chat__cancel")).toHaveCount(0, { timeout });
  await expect(page.locator(".chat__send")).toBeVisible();
}
