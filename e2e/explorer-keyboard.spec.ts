/** File explorer: preview tabs, keyboard navigation, Keep Open. Local only; no agent/model calls. */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { addProject } from "./projects";
import { firstWorkspaceId, openWorkspaceTool } from "./workspaceTools";

const tab = (page: Page, file: string) => page.getByTestId(`file-tab-${file}`);
const treeFocused = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "workspace-file-tree-scroll");
const isPreview = async (page: Page, file: string) => (await tab(page, file).locator("span.italic").count()) === 1;

test("single click previews, the keyboard walks the tree, Enter and Keep Open make tabs permanent", async ({ page }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "perch-explorer-keys-"));
  try {
    fs.mkdirSync(path.join(root, "dir"));
    fs.writeFileSync(path.join(root, "dir/c.txt"), "c\n");
    fs.writeFileSync(path.join(root, "a.txt"), "a\n");
    fs.writeFileSync(path.join(root, "b.txt"), "b\n");
    await page.goto("/");
    await addProject(page, root);
    const workspaceId = await firstWorkspaceId(page.locator(".workspace-project").filter({ hasText: path.basename(root) }));
    await openWorkspaceTool(page, workspaceId, "files");

    // A click previews; the next click replaces it.
    await page.getByTestId("workspace-file-entry-a.txt").click();
    await expect(tab(page, "a.txt")).toBeVisible();
    expect(await isPreview(page, "a.txt")).toBe(true);
    await page.getByTestId("workspace-file-entry-b.txt").click();
    await expect(tab(page, "b.txt")).toBeVisible();
    await expect(tab(page, "a.txt")).toHaveCount(0);

    // Arrows only move the cursor: no tab opens or changes. The list keeps focus.
    await page.getByTestId("workspace-file-entry-a.txt").click();
    // A click hands focus to the editor once the file has loaded; only then go back to the list.
    await expect(page.getByTestId("workspace-file-editor")).toBeFocused();
    await page.getByTestId("workspace-file-tree-scroll").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("workspace-file-entry-a.txt")).toHaveClass(/bg-surface-1/);
    await expect(tab(page, "b.txt")).toHaveCount(0);

    // Right expands a folder, Down walks into it, Left goes back up to the folder and folds it.
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("workspace-file-entry-dir/c.txt")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("workspace-file-entry-dir/c.txt")).toHaveCount(0);

    // Space previews the file under the cursor and keeps focus in the list.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(tab(page, "a.txt")).toBeVisible();
    expect(await isPreview(page, "a.txt")).toBe(true);
    expect(await treeFocused(page)).toBe(true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(tab(page, "b.txt")).toBeVisible();
    await expect(tab(page, "a.txt")).toHaveCount(0);

    // Enter opens a regular tab and hands focus to the editor.
    await page.keyboard.press("Enter");
    await expect.poll(() => isPreview(page, "b.txt")).toBe(false);
    await expect(page.getByTestId("workspace-file-editor")).toBeFocused();

    // Keep Open pins a previewed tab.
    await page.getByTestId("workspace-file-entry-a.txt").click();
    await expect(tab(page, "a.txt")).toBeVisible();
    expect(await isPreview(page, "a.txt")).toBe(true);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Alt+Enter" : "Control+Alt+Enter");
    await expect.poll(() => isPreview(page, "a.txt")).toBe(false);
    await expect(tab(page, "b.txt")).toBeVisible();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
