/**
 * V-05/V-06 file workflow evidence.
 *
 * The fixture is outside the repository and the configured Playwright server
 * uses isolated /tmp database and host files. The test checks the visible
 * tree/editor flow and also reads the durable buffer through a separate
 * WebSocket so a passing reload assertion cannot be explained by React state
 * alone.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const BASE_URL = "http://127.0.0.1:7799";
const WS_URL = "ws://127.0.0.1:7799/ws";
const RUN_ID = `${Date.now()}-${process.pid}`;
const FIXTURE_ROOT = path.join(os.tmpdir(), `perch-e2e-files-${RUN_ID}`);
const PROJECT_NAME = `V-05 Files ${RUN_ID}`;
const FILE_PATH = path.join(FIXTURE_ROOT, "src", "main.txt");
const RELATIVE_FILE = "src/main.txt";

interface DurableBuffer {
  content: string;
  baseContent: string;
  baseVersion: string;
  externalVersion: string;
  revision: number;
  dirty: boolean;
  conflict: boolean;
}

function prepareFixture(): void {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_ROOT, "README.md"), "files fixture\n");
  fs.writeFileSync(FILE_PATH, "initial sentinel\n");
}

function removeFixture(): void {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
}

function readDurableBuffer(workspaceId: string, filePath: string): Promise<DurableBuffer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new Error(`timed out reading durable buffer ${workspaceId}/${filePath}`));
    }, 15000);
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      reject(new Error(message));
    };
    ws.onerror = () => fail(`buffer WebSocket failed for ${workspaceId}/${filePath}`);
    ws.onopen = () => ws.send(JSON.stringify({
      type: "fs.buffer.get",
      requestId: `e2e-buffer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      workspaceId,
      path: filePath,
    }));
    ws.onmessage = (event) => {
      let message: { type?: string; buffer?: DurableBuffer; code?: string; message?: string };
      try {
        message = JSON.parse(String(event.data)) as typeof message;
      } catch {
        return;
      }
      if (message.type === "fs.error") {
        fail(`${message.code ?? "fs.error"}: ${message.message ?? "unknown error"}`);
        return;
      }
      if (message.type !== "fs.buffer.result" || !message.buffer) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      resolve(message.buffer);
    };
  });
}

async function dismissOnboarding(page: Page): Promise<void> {
  const dismiss = page.getByTestId("onboarding-dismiss");
  if (await dismiss.count()) await dismiss.click();
}

async function waitForDraftSync(page: Page): Promise<void> {
  const indicator = page.getByText("Draft syncing…", { exact: true });
  try {
    await indicator.waitFor({ state: "visible", timeout: 5000 });
    await indicator.waitFor({ state: "hidden", timeout: 15000 });
  } catch {
    // A browser leave-warning check can spend the debounce interval while
    // its dialog is being dismissed. The buffer probe below remains the
    // source of truth in that case.
    await page.waitForTimeout(500);
  }
}

test.describe("V-05/V-06 durable file workflow", () => {
  test("refreshes the tree, recovers a draft, and exposes external conflict choices", async ({ page }, testInfo) => {
    prepareFixture();
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await dismissOnboarding(page);
      await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });

      await page.getByTestId("workspace-add-project").click();
      await page.getByTestId("workspace-project-path").fill(FIXTURE_ROOT);
      await page.getByTestId("workspace-project-name").fill(PROJECT_NAME);
      await page.getByRole("button", { name: "Register project", exact: true }).click();
      const project = page.locator(".workspace-project").filter({ hasText: PROJECT_NAME });
      await expect(project).toBeVisible({ timeout: 15000 });
      const filesButton = project.locator('[data-testid^="workspace-files-"]');
      await expect(filesButton).toBeVisible({ timeout: 15000 });
      const workspaceId = (await filesButton.getAttribute("data-testid"))!.slice("workspace-files-".length);
      await filesButton.click();
      await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 15000 });

      // Repeated root requests are part of the regression for retained
      // descriptor offsets. README and src must remain visible every time.
      const readmeEntry = page.getByTestId("workspace-file-entry-README.md");
      const srcEntry = page.getByTestId("workspace-file-entry-src");
      await expect(readmeEntry).toBeVisible({ timeout: 15000 });
      await expect(srcEntry).toBeVisible({ timeout: 15000 });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await page.getByRole("button", { name: "Refresh file tree", exact: true }).click();
        await expect(readmeEntry).toBeVisible({ timeout: 10000 });
        await expect(srcEntry).toBeVisible({ timeout: 10000 });
      }

      await srcEntry.click();
      await expect(page.getByTestId("workspace-file-entry-src/main.txt")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("workspace-file-entry-src/main.txt").click();
      const editor = page.getByTestId("workspace-file-editor");
      await expect(editor).toHaveValue("initial sentinel\n", { timeout: 15000 });

      await editor.fill("draft survives page reload\n");
      await waitForDraftSync(page);
      const persisted = await readDurableBuffer(workspaceId, RELATIVE_FILE);
      expect(persisted.content).toBe("draft survives page reload\n");
      expect(persisted.baseContent).toBe("initial sentinel\n");
      expect(persisted.dirty).toBe(true);
      expect(persisted.conflict).toBe(false);
      await page.screenshot({ path: testInfo.outputPath("files-durable-desktop.png"), fullPage: true });

      // A new local edit must warn before an immediate browser leave, while
      // the debounce still gets an opportunity to persist the latest draft.
      await editor.fill("draft survives beforeunload\n");
      const unloadPrevented = await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(unloadPrevented).toBe(true);
      const beforeUnloadDialogs: string[] = [];
      const dismissBeforeUnload = async (dialog: import("@playwright/test").Dialog) => {
        beforeUnloadDialogs.push(dialog.type());
        await dialog.dismiss();
      };
      page.on("dialog", dismissBeforeUnload);
      try {
        // Exercise Chromium's actual leave-warning path. Dismissing the
        // dialog keeps the page in place; the normal reload below then runs
        // only after the debounced durable update has settled.
        await page.reload({ waitUntil: "domcontentloaded", timeout: 5000 });
      } catch {
        // A canceled beforeunload navigation may report as an interrupted
        // reload even though the dialog was delivered and dismissed.
      } finally {
        page.off("dialog", dismissBeforeUnload);
      }
      expect(beforeUnloadDialogs).toContain("beforeunload");
      await waitForDraftSync(page);

      await page.waitForTimeout(900);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 20000 });
      const restoredEditor = page.getByTestId("workspace-file-editor");
      await expect(restoredEditor).toHaveValue("draft survives beforeunload\n", { timeout: 20000 });
      await expect(page.locator(".workspace-files__file-title strong")).toHaveText("main.txt");
      const restored = await readDurableBuffer(workspaceId, RELATIVE_FILE);
      expect(restored.content).toBe("draft survives beforeunload\n");
      expect(restored.dirty).toBe(true);

      // Save the sentinel and verify the actual fixture bytes changed.
      await restoredEditor.fill("saved sentinel\n");
      await waitForDraftSync(page);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect.poll(() => fs.readFileSync(FILE_PATH, "utf8"), { timeout: 15000 }).toBe("saved sentinel\n");
      await expect(restoredEditor).toHaveValue("saved sentinel\n");

      // An external write must preserve the editor draft and offer explicit
      // compare/reload/overwrite actions rather than silently replacing it.
      await restoredEditor.fill("local draft after save\n");
      await waitForDraftSync(page);
      fs.writeFileSync(FILE_PATH, "external sentinel\n");
      await expect(page.getByTestId("workspace-file-conflict")).toBeVisible({ timeout: 15000 });
      await expect(restoredEditor).toHaveValue("local draft after save\n");
      const conflict = await readDurableBuffer(workspaceId, RELATIVE_FILE);
      expect(conflict.content).toBe("local draft after save\n");
      expect(conflict.conflict).toBe(true);
      await page.getByRole("button", { name: "Compare", exact: true }).click();
      await expect(page.getByTestId("workspace-file-compare")).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: testInfo.outputPath("files-durable-conflict.png"), fullPage: true });

      await page.getByRole("button", { name: "Reload disk", exact: true }).click();
      await expect(page.getByTestId("workspace-file-reload-confirm")).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: "Keep draft", exact: true }).click();
      await expect(restoredEditor).toHaveValue("local draft after save\n");
      await page.getByRole("button", { name: "Reload disk", exact: true }).click();
      await page.getByRole("button", { name: "Discard and reload", exact: true }).click();
      await expect(restoredEditor).toHaveValue("external sentinel\n", { timeout: 15000 });
      const reloaded = await readDurableBuffer(workspaceId, RELATIVE_FILE);
      expect(reloaded.content).toBe("external sentinel\n");
      expect(reloaded.dirty).toBe(false);
      expect(reloaded.conflict).toBe(false);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: testInfo.outputPath("files-durable-mobile.png"), fullPage: true });
      const mobileBounds = await page.evaluate(() => {
        const save = document.querySelector(".workspace-files__save")?.getBoundingClientRect();
        return {
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          editorVisible: Boolean(document.querySelector('[data-testid="workspace-file-editor"]')),
          saveReachable: Boolean(save && save.left >= 0 && save.right <= window.innerWidth && save.bottom <= window.innerHeight),
        };
      });
      expect(mobileBounds.scrollWidth).toBeLessThanOrEqual(mobileBounds.innerWidth);
      expect(mobileBounds.editorVisible).toBe(true);
      expect(mobileBounds.saveReachable).toBe(true);
    } finally {
      removeFixture();
    }
  });
});
