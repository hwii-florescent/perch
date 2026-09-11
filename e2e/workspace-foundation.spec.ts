/** V-01 evidence for the durable project/workspace navigation foundation.
 *
 * This is deliberately an ordinary browser interaction test: it registers
 * folders through the visible form, exercises the failed-path correction, and
 * reloads the page before checking the same rendered project id. The fixture
 * directories are outside the repository and the test never touches the
 * user's configured database because playwright.config.ts starts the core
 * with isolated /tmp paths.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const BASE_URL = "http://127.0.0.1:7799";
const RUN_ID = `${Date.now()}-${process.pid}`;
const FIRST_PATH = path.join(os.tmpdir(), `perch-e2e-v01-a-${RUN_ID}`);
const SECOND_PATH = path.join(os.tmpdir(), `perch-e2e-v01-b-${RUN_ID}`);
const FIRST_NAME = `V-01 First ${RUN_ID}`;
const SECOND_NAME = `V-01 Second ${RUN_ID}`;

function prepareFixtures(): void {
  fs.rmSync(FIRST_PATH, { recursive: true, force: true });
  fs.rmSync(SECOND_PATH, { recursive: true, force: true });
  fs.mkdirSync(FIRST_PATH, { recursive: true });
  fs.mkdirSync(SECOND_PATH, { recursive: true });
  fs.writeFileSync(path.join(FIRST_PATH, "README.md"), "v01 first fixture\n");
  fs.writeFileSync(path.join(SECOND_PATH, "README.md"), "v01 second fixture\n");
}

function removeFixtures(): void {
  fs.rmSync(FIRST_PATH, { recursive: true, force: true });
  fs.rmSync(SECOND_PATH, { recursive: true, force: true });
}

async function dismissOnboarding(page: Page): Promise<void> {
  const dismiss = page.getByTestId("onboarding-dismiss");
  if (await dismiss.count()) await dismiss.click();
}

async function addProject(page: Page, folder: string, name: string): Promise<string> {
  await page.getByTestId("workspace-add-project").click();
  await page.getByTestId("workspace-project-path").fill(folder);
  await page.getByTestId("workspace-project-name").fill(name);
  await page.getByRole("button", { name: "Register project", exact: true }).click();
  const project = page.locator(".workspace-project").filter({ hasText: name });
  await expect(project).toBeVisible({ timeout: 15000 });
  const testId = await project.getAttribute("data-testid");
  expect(testId).toMatch(/^workspace-project-/);
  return testId!.slice("workspace-project-".length);
}

test.describe("V-01 project/workspace registration", () => {
  test("registers, focuses, and restores a project through the real UI", async ({ page }, testInfo) => {
    prepareFixtures();
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await dismissOnboarding(page);
      await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });

      // The form keeps both values visible after a correlated server error,
      // allowing the user to correct the path without restarting the flow.
      const emptyAdd = page.getByTestId("workspace-empty-add");
      if (await emptyAdd.count()) await emptyAdd.click();
      else await page.getByTestId("workspace-add-project").click();
      await page.getByTestId("workspace-project-path").fill(`${FIRST_PATH}-missing`);
      await page.getByTestId("workspace-project-name").fill(FIRST_NAME);
      await page.getByRole("button", { name: "Register project", exact: true }).click();
      const error = page.locator(".workspace-overview__add-form").getByRole("alert").filter({ hasText: "project path is not an existing directory" });
      await expect(error).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("workspace-project-path")).toHaveValue(`${FIRST_PATH}-missing`);
      await expect(page.getByTestId("workspace-project-name")).toHaveValue(FIRST_NAME);

      await page.getByTestId("workspace-project-path").fill(FIRST_PATH);
      await page.getByRole("button", { name: "Register project", exact: true }).click();
      const firstId = await (async () => {
        const project = page.locator(".workspace-project").filter({ hasText: FIRST_NAME });
        await expect(project).toBeVisible({ timeout: 15000 });
        return (await project.getAttribute("data-testid"))!.slice("workspace-project-".length);
      })();
      const first = page.getByTestId(`workspace-project-${firstId}`);
      await expect(page.locator(`[data-testid^="workspace-entry-"]`).first()).toBeVisible();
      await first.getByRole("button").first().click();
      await expect(first.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".workspace-entry__button--active")).toHaveCount(1);

      const secondId = await addProject(page, SECOND_PATH, SECOND_NAME);
      await expect(page.getByTestId(`workspace-project-${firstId}`)).toBeVisible();
      await expect(page.getByTestId(`workspace-project-${secondId}`)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("v01-desktop-two-projects.png"), fullPage: true });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await dismissOnboarding(page);
      await expect(page.getByTestId(`workspace-project-${firstId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`workspace-project-${secondId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`workspace-project-${firstId}`).getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".workspace-entry__button--active")).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath("v01-desktop-reload.png"), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("mobile-switch").click();
      await expect(page.getByTestId("mobile-switcher")).toBeVisible();
      await expect(page.getByTestId(`workspace-project-${firstId}`)).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: testInfo.outputPath("v01-mobile-reload.png"), fullPage: true });
    } finally {
      removeFixtures();
    }
  });
});
