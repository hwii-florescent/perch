/**
 * shared-tabs-phone.spec.ts — the phone's tab row (decision D): a desktop page and a phone-sized page on the same
 * core. A tab the desktop opens shows in the phone's row; tapping a tab on the phone shows it there and leaves the
 * desktop's active tab where it was. Headless, plain shell sessions only (no agent turns).
 *
 * Known: starting a desktop session while a phone is attached sometimes crashes the desktop page with React's
 * "Maximum update depth exceeded" (about 2 runs in 5 here). It happens with the shared tabs and this row turned off too,
 * so it is not theirs; the page errors are logged to show it when it does.
 */
import { test, expect, type Page } from "@playwright/test";
import { expectActive, startChat } from "./projects";

const BASE_URL = "http://127.0.0.1:7799";

async function freshPage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
}

test("the phone's row shows the desktop's tabs, and a tap there leaves the desktop's tab alone", async ({ page, browser }, testInfo) => {
  page.on("pageerror", (error) => console.log("DESKTOP pageerror", error.message, error.stack?.split("\n").slice(0, 6).join(" | ")));
  page.on("console", (m) => { if (m.type() === "error") console.log("DESKTOP console", m.text().slice(0, 300)); });
  await freshPage(page);
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
  const first = await startChat(page);
  const second = await startChat(page);
  await expectActive(page, second);

  const phoneContext = await browser.newContext({ ...testInfo.project.use, viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage();
  try {
    await freshPage(phone);
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 15000 });
    // A phone with no choice of its own starts at the workspace the desktop last showed.
    const row = phone.getByTestId("mobile-tabs");
    await expect(row.locator(`[data-tab="${first}"]`)).toBeVisible({ timeout: 15000 });
    await expect(row.locator(`[data-tab="${second}"]`)).toBeVisible();

    // Tapping a tab on the phone shows it there only: the desktop keeps its own.
    await row.locator(`[data-tab="${first}"]`).tap();
    await expect(row.locator(`[data-tab="${first}"]`)).toHaveAttribute("aria-current", "page");
    await phone.waitForTimeout(1000);
    await expectActive(page, second);

    // A tab opened on the desktop shows in the phone's row, and the phone stays where it was.
    const third = await startChat(page);
    await expect(row.locator(`[data-tab="${third}"]`)).toBeVisible({ timeout: 15000 });
    await expect(row.locator(`[data-tab="${first}"]`)).toHaveAttribute("aria-current", "page");
  } finally {
    await phoneContext.close();
  }
});
