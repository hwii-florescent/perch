import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "node:fs";
import { setChatMode } from "./chatMode";
import { startFromPanel } from "./projects";
import * as path from "node:path";

test("agent runtime survives view changes and control transfers between desktop and phone", async ({ page, context, browser }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  let phone: Page | undefined;
  let phoneContext: BrowserContext | undefined;
  try {
    await startFromPanel(page);
    const desktop = page.getByTestId("persistent-agent-terminal");
    await expect(desktop).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(desktop).toHaveAttribute("data-controlling", "true");
    const id = (await desktop.getAttribute("data-terminal-id"))!;
    const marker = `persist_${Date.now()}`;
    await expect(desktop.locator(".xterm-rows")).toContainText("Claude Code", { timeout: 20_000 });
    await expect(desktop.locator(".xterm-rows")).toContainText("❯");
    await desktop.locator(".xterm-helper-textarea").pressSequentially(marker, { delay: 15 });
    await expect(desktop.locator(".xterm-rows")).toContainText(marker);
    const sessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await phoneContext.addInitScript((sessionId) => {
      localStorage.setItem("perch.onboarding.seen", "1");
      if (sessionId) localStorage.setItem("perch.sessionId", sessionId);
    }, sessionId);
    phone = await phoneContext.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    await phone.goto("http://127.0.0.1:7799", { waitUntil: "networkidle" });
    const mobile = phone.getByTestId("persistent-agent-terminal");
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await expect(mobile).toHaveAttribute("data-writable", "true");
    await expect(mobile.locator(".xterm-rows")).toContainText(marker);
    // A guessed terminal id on an unrelated connection cannot write, even
    // though this connection is authorized to inspect the same local core.
    const refused = await phone.evaluate(({ terminalId, sessionId }) => new Promise<string[]>((resolve, reject) => {
      const codes: string[] = [];
      const ws = new WebSocket(`ws://${location.host}/ws`);
      const timer = setTimeout(() => { ws.close(); reject(new Error("Missing ownership refusal " + JSON.stringify(codes))); }, 5000);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "terminal.input", terminalId, data: "UNAUTHORIZED_SENTINEL", generation: 1 }));
        ws.send(JSON.stringify({ type: "terminal.input", terminalId, data: "UNAUTHORIZED_SENTINEL", shared: true }));
        ws.send(JSON.stringify({ type: "session.delete", sessionId }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "error") {
          codes.push(message.code);
          if (codes.length === 3) { clearTimeout(timer); ws.close(); resolve(codes); }
        }
      };
    }), { terminalId: id, sessionId });
    expect(refused).toEqual(["agent_control_required", "agent_view_required", "agent_control_required"]);
    await expect(desktop.locator(".xterm-rows")).not.toContainText("UNAUTHORIZED_SENTINEL");

    // Typing needs no takeover. Fit here explicitly moves size/stop authority.
    await mobile.getByRole("button", { name: "Fit here", exact: true }).click();
    await expect(mobile).toHaveAttribute("data-controlling", "true");
    await expect(desktop).toHaveAttribute("data-writable", "true");
    await mobile.locator(".xterm-helper-textarea").pressSequentially("_phone", { delay: 15 });
    await expect(desktop.locator(".xterm-rows")).toContainText(`${marker}_phone`);

    // Chat mode is one global setting: switching to UI and back swaps every
    // view, preserving the same process.
    await setChatMode(page, "hosted");
    await expect(phone.locator(".chat__input textarea")).toBeVisible();
    await expect(mobile).toHaveCount(0);
    await setChatMode(page, "cli");
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await expect(mobile.locator(".xterm-rows")).toContainText(`${marker}_phone`);

    await phone.getByTestId("mobile-pane-files").click();
    await expect(phone.locator(".xterm")).toHaveCount(0);
    await phone.getByTestId("mobile-pane-chat").click();
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await expect(mobile.locator(".xterm-rows")).toContainText(`${marker}_phone`);
    await phone.reload({ waitUntil: "networkidle" });
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await expect(mobile.locator(".xterm-rows")).toContainText(`${marker}_phone`);
    await expect(mobile).toHaveAttribute("data-writable", "true");
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect((await desktop.getByRole("button", { name: "Fit here", exact: true }).boundingBox())!.height).toBeGreaterThan(0);
    const shots = path.resolve(__dirname, "../.impeccable/review");
    fs.mkdirSync(shots, { recursive: true });
    await phone.screenshot({ path: path.join(shots, `agent-mobile-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(shots, `agent-desktop-${testInfo.project.name}.png`) });
    // A watcher's tab close dismisses observation, never the phone's work.
    await page.getByTestId(`tab-close-${sessionId}`).click();
    await expect(desktop).toHaveCount(0);
    await expect(mobile).toHaveAttribute("data-writable", "true");
    await expect(mobile.locator(".xterm-rows")).toContainText(`${marker}_phone`);
    await page.getByTestId(`tab-${sessionId}`).click();
    await expect(desktop).toHaveAttribute("data-terminal-id", id);

    // Owners can also choose observation-only dismissal in the close dialog.
    await desktop.getByRole("button", { name: "Fit here", exact: true }).click();
    await expect(desktop).toHaveAttribute("data-controlling", "true");
    await page.getByTestId(`tab-close-${sessionId}`).click();
    await page.getByRole("button", { name: "Keep running and dismiss this view", exact: true }).click();
    await expect(desktop).toHaveCount(0);
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await page.getByTestId(`tab-${sessionId}`).click();
    await expect(desktop).toHaveAttribute("data-terminal-id", id);
    await expect(desktop.locator(".xterm-rows")).toContainText(`${marker}_phone`);
    await expect(desktop).toHaveAttribute("data-controlling", "true");
    // The session's pane menu opens from its top-row tab. A stopped agent
    // has exited, so its session closes on every view.
    await page.locator(".tab-bar__tab--active").click({ button: "right" });
    await page.getByTestId("pane-menu-stop-agent").click();
    await expect(mobile).toHaveCount(0);
    await expect(desktop).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await setChatMode(page, "cli").catch(() => {});
    // Close only the session created by this isolated browser context. A
    // timeout closes the page; cleanup must not hide the original failure.
    if (!page.isClosed()) await page.evaluate(() => new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://${location.host}/ws`);
      const timer = setTimeout(() => { ws.close(); resolve(); }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "session.delete", sessionId: localStorage.getItem("perch.sessionId") }));
      ws.onmessage = (event) => { if (JSON.parse(event.data).type === "session.deleted") { clearTimeout(timer); ws.close(); resolve(); } };
    })).catch(() => {});
    await phoneContext?.close();
  }
});
