import { expect, type Page } from "@playwright/test";

/** Sessions start only in a project listed in perch, or in Chats. Register
 * `dir` the way "+ Add project" does; resolves once the server replies. */
export async function addProject(page: Page, dir: string): Promise<void> {
  await page.evaluate((dir) => new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { ws.close(); reject(new Error("project.create timed out")); }, 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ type: "project.create", requestId, path: dir }));
    ws.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); }
      catch (error) { clearTimeout(timer); ws.close(); reject(error); return; }
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
  const option = page.locator('[data-testid^="project-option-"]').and(page.getByTitle(dir, { exact: true }));
  await expect(option.first()).toBeVisible({ timeout: 10_000 });
  await option.first().click();
}

/** Start `agent` through the sidebar's New session popover, in `dir` (added
 * as a project first) or else in Chats; wait for its terminal and return the
 * session id. The default `terminal` agent is a plain shell: no model turn,
 * so specs that only need a persisted session stay fast and free. */
export async function startChat(page: Page, agent = "terminal", dir?: string): Promise<string> {
  const before = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
  await page.getByTestId("new-session-local").click();
  const picker = page.getByTestId("new-session-popover-agent");
  await expect(picker).toBeEnabled({ timeout: 10_000 });
  await picker.selectOption(agent);
  if (dir) await pickProject(page, dir);
  else await page.getByTestId("project-option-none").click();
  await expect.poll(async () => {
    const id = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    return Boolean(id) && id !== before;
  }).toBe(true);
  const terminal = page.getByTestId("persistent-agent-terminal");
  await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
  return (await page.evaluate(() => localStorage.getItem("perch.sessionId")))!;
}

/** Split shell panes (the agent's own terminal is a `.terminal__surface` too). */
export const shellPanes = (page: Page) =>
  page.locator('.terminal--persistent:not([data-testid="persistent-agent-terminal"])');

export async function expectActive(page: Page, sessionId: string): Promise<void> {
  await expect(page.getByTestId(`tab-${sessionId}`)).toHaveClass(/tab-bar__tab--active/, { timeout: 15_000 });
}

export async function switchViaSidebar(page: Page, sessionId: string): Promise<void> {
  await page.getByTestId(`workspace-session-${sessionId}`).click();
  await expectActive(page, sessionId);
}

export async function switchViaTabBar(page: Page, sessionId: string): Promise<void> {
  await page.getByTestId(`tab-${sessionId}`).click();
  await expectActive(page, sessionId);
}
