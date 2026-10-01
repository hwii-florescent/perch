import { expect, type Locator, type Page } from "@playwright/test";

/** Desktop Files/Git live in the ›_ drawer, which follows the workspace you
 * click in the sidebar: select the workspace, open the drawer on `tab`. */
export async function openWorkspaceTool(page: Page, workspaceId: string, tab: "files" | "gitReview"): Promise<void> {
  await page.locator(`[data-testid="workspace-entry-${workspaceId}"] .workspace-entry__button`).first().click();
  if (!(await page.getByTestId("workspace-tools").count())) await page.getByTitle("Open terminal").click();
  await page.getByTestId(`workspace-tools-${tab}`).click();
  await expect(page.getByTestId(tab === "files" ? "workspace-files-view" : "workspace-git-review")).toBeVisible({ timeout: 20000 });
}

/** The id of the first workspace row inside `scope`. */
export async function firstWorkspaceId(scope: Locator): Promise<string> {
  const entry = scope.locator('xpath=descendant-or-self::*[starts-with(@data-testid, "workspace-entry-")]').first();
  await expect(entry).toBeVisible({ timeout: 20000 });
  return (await entry.getAttribute("data-testid"))!.slice("workspace-entry-".length);
}
