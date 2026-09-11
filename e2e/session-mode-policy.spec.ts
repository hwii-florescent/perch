import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = "http://127.0.0.1:7799";

async function expectMode(page: Page, mode: "hosted" | "cli", scope: string) {
  const toggle = page.getByTestId("session-mode-toggle");
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute("aria-checked", mode === "cli" ? "true" : "false");
  await expect(page.getByTestId("session-mode-effective-scope")).toHaveText(scope);
  if (mode === "cli") await expect(page.getByTestId("cli-start-panel")).toBeVisible();
  else await expect(page.locator(".chat__input textarea")).toBeVisible();
}

test("mode overrides persist and synchronize two views without starting a blank agent", async ({ page, context, browser }) => {
  // This uses real mode storage and WS broadcasts. A fresh browser device
  // keeps defaults isolated from both the user's settings and other tests.
  const terminalCreates: unknown[] = [];
  const pageErrors: string[] = [];
  function observe(target: Page) {
    target.on("pageerror", (error) => pageErrors.push(error.message));
    target.on("websocket", (socket) => socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "terminal.create") terminalCreates.push(message);
    }));
  }
  observe(page);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  expect(pageErrors).toEqual([]);
  await expectMode(page, "hosted", "Inherited");
  const sessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
  expect(sessionId).toBeTruthy();

  const phone = await context.newPage();
  observe(phone);
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(BASE_URL, { waitUntil: "networkidle" });
  await expectMode(phone, "hosted", "Inherited");
  expect(await phone.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(sessionId);

  // A second device opens a different blank session in the same workspace.
  const otherContext = await browser.newContext();
  await otherContext.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  const other = await otherContext.newPage();
  observe(other);
  await other.goto(BASE_URL, { waitUntil: "networkidle" });
  await expectMode(other, "hosted", "Inherited");
  expect(await other.evaluate(() => localStorage.getItem("perch.sessionId"))).not.toBe(sessionId);

  await page.getByTestId("session-mode-scope").selectOption("device");
  await page.getByTestId("session-mode-toggle").click();
  await expectMode(page, "cli", "Device");
  await expectMode(phone, "cli", "Device");
  await expectMode(other, "hosted", "Inherited");

  await page.getByTestId("session-mode-scope").selectOption("workspace");
  await page.getByTestId("session-mode-toggle").click();
  await expectMode(page, "hosted", "Workspace");
  await expectMode(phone, "hosted", "Workspace");
  await expectMode(other, "hosted", "Workspace");

  // Session wins over workspace, which wins over the device default.
  await phone.getByTestId("session-mode-scope").selectOption("session");
  await phone.getByTestId("session-mode-toggle").click();
  await expectMode(phone, "cli", "Session");
  await expectMode(page, "cli", "Session");
  await expectMode(other, "hosted", "Workspace");
  await page.reload({ waitUntil: "networkidle" });
  await expectMode(page, "cli", "Session");
  expect(await page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(sessionId);

  await page.getByTestId("session-mode-clear").click();
  await expectMode(page, "hosted", "Workspace");
  await expectMode(phone, "hosted", "Workspace");
  await page.getByTestId("session-mode-clear").click();
  await expectMode(page, "cli", "Device");
  await expectMode(phone, "cli", "Device");
  await expectMode(other, "hosted", "Inherited");
  await phone.reload({ waitUntil: "networkidle" });
  await expectMode(phone, "cli", "Device");
  await expect(phone.locator('[data-testid^="mobile-active-pane-"]')).toHaveCount(1);
  await expect(phone.locator(".dockview-theme-perch")).toHaveCount(0);
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(terminalCreates).toEqual([]);
  expect(pageErrors).toEqual([]);
  for (const id of ["session-mode-toggle", "session-mode-scope", "session-mode-clear", "mobile-pane-chat", "mobile-switch"]) {
    expect((await phone.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }

  const shots = path.resolve(__dirname, "../.impeccable/review");
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, "mode-policy-desktop.png") });
  await phone.screenshot({ path: path.join(shots, "mode-policy-mobile.png") });

  await phone.getByTestId("session-mode-clear").click();
  await expectMode(phone, "hosted", "Inherited");
  await expectMode(page, "hosted", "Inherited");
  await phone.close();
  await otherContext.close();
});
