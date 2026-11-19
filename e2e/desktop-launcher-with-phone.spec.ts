/**
 * The desktop's New session launcher keeps working while a phone page is attached to the same core.
 *
 * The launcher subscribes to `effectiveActiveProject`; when that selector falls back to the host's newest project it
 * must return the same object each call, or React re-renders forever ("Maximum update depth exceeded"). The store
 * updates a phone's attach and switch send are what made React re-check it mid-launch. Uses the main config's core on :7799;
 * no agent runs.
 */
import { test, expect, type Page } from "@playwright/test";
import { startChat } from "./projects";

async function freshPage(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:7799", { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
}

test("the desktop starts a session while a phone is attached", async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await freshPage(page);
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15_000 });
  const first = await startChat(page);
  await startChat(page);
  const phoneContext = await browser.newContext({ ...testInfo.project.use, viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
  try {
    const phone = await phoneContext.newPage();
    await freshPage(phone);
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 15_000 });
    await phone.getByTestId("mobile-switch").click();
    await phone.getByTestId("mobile-switcher").getByTestId(`workspace-session-${first}`).click();
    await page.waitForTimeout(1_500);
    await startChat(page);
    expect(errors).toEqual([]);
  } finally {
    await phoneContext.close();
  }
});
