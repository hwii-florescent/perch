import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "node:fs";
import { setChatMode } from "./chatMode";
import * as path from "node:path";

test("agent runtime survives view changes and control transfers between desktop and phone", async ({ page, context, browser }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  let phone: Page | undefined;
  let phoneContext: BrowserContext | undefined;
  try {
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
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
    await expect(mobile).toContainText("Another view is typing in this agent");
    await expect(mobile.locator(".xterm-rows")).toContainText(marker);
    // A guessed terminal id on an unrelated connection cannot write, even
    // though this connection is authorized to inspect the same local core.
    const refused = await phone.evaluate((terminalId) => new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(`ws://${location.host}/ws`);
      const timer = setTimeout(() => { ws.close(); reject(new Error("Missing ownership refusal")); }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "terminal.input", terminalId, data: "UNAUTHORIZED_SENTINEL", generation: 1 }));
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "error") { clearTimeout(timer); ws.close(); resolve(message.code); }
      };
    }), id);
    expect(refused).toBe("agent_control_required");
    await expect(desktop.locator(".xterm-rows")).not.toContainText("UNAUTHORIZED_SENTINEL");

    // Taking control moves it from the desktop without a release step.
    await mobile.getByRole("button", { name: "Take control", exact: true }).click();
    await expect(mobile).toHaveAttribute("data-controlling", "true");
    await expect(desktop).toContainText("Another view is typing in this agent");
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
    await expect(mobile).toHaveAttribute("data-controlling", "true");
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect((await desktop.getByRole("button", { name: "Take control", exact: true }).boundingBox())!.height).toBeGreaterThan(0);
    const shots = path.resolve(__dirname, "../.impeccable/review");
    fs.mkdirSync(shots, { recursive: true });
    await phone.screenshot({ path: path.join(shots, `agent-mobile-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(shots, `agent-desktop-${testInfo.project.name}.png`) });
    // Only the view holding input can stop the agent (pane menu → Stop agent).
    await desktop.getByRole("button", { name: "Take control", exact: true }).click();
    await expect(desktop).toHaveAttribute("data-controlling", "true");
    await page.getByTestId("pane-tab-chat").click({ button: "right" });
    await page.getByTestId("pane-menu-stop-agent").click();
    await expect(mobile.getByTestId("cli-exited")).toBeVisible();
    await expect(desktop.getByTestId("cli-exited")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await setChatMode(page, "cli").catch(() => {});
    // Close only the session created by this isolated browser context.
    await page.evaluate(() => new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://${location.host}/ws`);
      const timer = setTimeout(() => { ws.close(); resolve(); }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "session.delete", sessionId: localStorage.getItem("perch.sessionId") }));
      ws.onmessage = (event) => { if (JSON.parse(event.data).type === "session.deleted") { clearTimeout(timer); ws.close(); resolve(); } };
    }));
    await phoneContext?.close();
  }
});
