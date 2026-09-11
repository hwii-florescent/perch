import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

test("agent runtime survives view changes and control transfers between desktop and phone", async ({ page, context, browser }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  let phone: Page | undefined;
  let phoneContext: BrowserContext | undefined;
  try {
    const mode = page.getByTestId("session-mode-toggle");
    await expect(mode).toBeEnabled();
    await page.getByTestId("session-mode-scope").selectOption("device");
    if (await mode.getAttribute("aria-checked") !== "true") await mode.click();
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
    const desktop = page.getByTestId("persistent-agent-terminal");
    await expect(desktop).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(desktop.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
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
    const phoneMode = phone.getByTestId("session-mode-toggle");
    await expect(phoneMode).toBeEnabled();
    await phone.getByTestId("session-mode-scope").selectOption("device");
    if (await phoneMode.getAttribute("aria-checked") !== "true") await phoneMode.click();
    const mobile = phone.getByTestId("persistent-agent-terminal");
    await expect(mobile).toHaveAttribute("data-terminal-id", id);
    await expect(mobile).toContainText("Another viewer has control");
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

    await desktop.getByRole("button", { name: "Release control", exact: true }).click();
    await expect(mobile).toContainText("Viewing agent");
    await mobile.getByRole("button", { name: "Take control", exact: true }).click();
    await expect(mobile.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    await expect(desktop).toContainText("Another viewer has control");
    await mobile.locator(".xterm-helper-textarea").pressSequentially("_phone", { delay: 15 });
    await expect(desktop.locator(".xterm-rows")).toContainText(`${marker}_phone`);

    // Changing the phone's device mode changes only its view, preserving the
    // same process and the desktop's independent CLI view.
    await phoneMode.click();
    await expect(phone.locator(".chat__input textarea")).toBeVisible();
    await expect(mobile).toHaveCount(0);
    await expect(desktop).toHaveAttribute("data-terminal-id", id);
    await phoneMode.click();
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
    await expect(mobile.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const name of ["Release control", "Stop CLI"]) expect((await mobile.getByRole("button", { name, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const shots = path.resolve(__dirname, "../.impeccable/review");
    fs.mkdirSync(shots, { recursive: true });
    await phone.screenshot({ path: path.join(shots, `agent-mobile-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(shots, `agent-desktop-${testInfo.project.name}.png`) });
    await mobile.getByRole("button", { name: "Stop CLI", exact: true }).click();
    await expect(mobile.getByTestId("cli-exited")).toBeVisible();
    await expect(desktop.getByTestId("cli-exited")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
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
