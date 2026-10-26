/** File explorer: preview tabs, keyboard navigation, Keep Open. Local only; no agent/model calls. */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveTheme, THEME_NAMES } from "../packages/web/src/themes";
import { addProject } from "./projects";
import { firstWorkspaceId, openWorkspaceTool } from "./workspaceTools";

const tab = (page: Page, file: string) => page.getByTestId(`file-tab-${file}`);
const treeFocused = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "workspace-file-tree-scroll");
const isPreview = async (page: Page, file: string) => (await tab(page, file).locator("span.italic").count()) === 1;

test("file icons and Git snapshots stay honest across themes, with centered icon-only attention and usage", async ({ page }, testInfo) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "perch-explorer-status-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  let failGit = false;
  const sockets: { send: (message: string) => void }[] = [];
  await page.routeWebSocket(/\/ws/, (ws) => {
    sockets.push(ws);
    const server = ws.connectToServer();
    // Usage is a fixed presentation fixture below. A real provider refresh can
    // otherwise move the compact bell out from under the pointer mid-hover.
    server.onMessage((raw) => { if (JSON.parse(String(raw)).type !== "usage.result") ws.send(raw); });
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (failGit && message.type === "git.status") ws.send(JSON.stringify({ type: "error", requestId: message.requestId, message: "Fixture Git unavailable" }));
      else server.send(raw);
    });
  });
  try {
    fs.mkdirSync(path.join(root, "src")); fs.mkdirSync(path.join(root, "lib"));
    fs.writeFileSync(path.join(root, "src/App.tsx"), "export const App = () => null;\n");
    fs.writeFileSync(path.join(root, "src/dual.ts"), "export const staged = 1;\n");
    fs.writeFileSync(path.join(root, "src/deleted.ts"), "export const removed = true;\n");
    fs.writeFileSync(path.join(root, "src/old.ts"), "export const renamed = 'keep identity';\n");
    fs.writeFileSync(path.join(root, "package.json"), '{"name":"explorer-fixture"}\n');
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    git("init", "-q"); git("config", "user.email", "perch-test@example.invalid"); git("config", "user.name", "Perch test"); git("add", "."); git("commit", "-qm", "fixture");
    fs.appendFileSync(path.join(root, "src/App.tsx"), "export const changed = true;\n");
    fs.appendFileSync(path.join(root, "src/dual.ts"), "export const inIndex = 2;\n"); git("add", "src/dual.ts");
    fs.appendFileSync(path.join(root, "src/dual.ts"), "export const inWorktree = 3;\n");
    fs.writeFileSync(path.join(root, "src/New.tsx"), "export const New = () => null;\n");
    fs.writeFileSync(path.join(root, "lib/new.ts"), "export const added = true;\n"); git("add", "lib/new.ts");
    fs.rmSync(path.join(root, "src/deleted.ts")); git("mv", "src/old.ts", "lib/renamed.ts");
    fs.mkdirSync(path.join(root, "node_modules")); fs.writeFileSync(path.join(root, "node_modules/ignored.js"), "ignored\n");
    await page.setViewportSize({ width: 1240, height: 824 });
    await page.goto("/"); await addProject(page, root);
    const workspaceId = await firstWorkspaceId(page.locator(".workspace-project").filter({ hasText: path.basename(root) }));
    await openWorkspaceTool(page, workspaceId, "files");
    const row = (file: string) => page.getByTestId(`workspace-file-entry-${file}`);
    await expect(page.getByTestId("explorer-git-state")).toHaveText("Git snapshot");
    await expect(row("src").getByTestId("file-git-summary")).toBeVisible();
    await row("src").click(); await row("lib").click();
    const markers = { "src/App.tsx": "M", "src/dual.ts": "M/M", "src/New.tsx": "U", "lib/new.ts": "A", "lib/renamed.ts": "R" };
    for (const [file, label] of Object.entries(markers)) await expect(row(file).getByTestId("file-git-marker")).toHaveText(label);
    await expect(row("src/deleted.ts")).toHaveCount(0); await expect(row("src/old.ts")).toHaveCount(0);
    await expect(row("node_modules").getByTestId("file-git-marker")).toHaveCount(0);
    await expect(row("package.json").locator('[data-file-icon="package"]')).toBeVisible();
    await expect(row("pnpm-lock.yaml").locator('[data-file-icon="config"]')).toBeVisible();
    for (const ws of sockets) ws.send(JSON.stringify({ type: "attention.snapshot", events: ["a", "b"].map((id) => ({ id, sessionId: "fixture", agentId: "pi", kind: "question", requiresAction: true, certainty: "verified", summary: "", occurredAt: Date.now(), count: 1, read: false })) }));
    await page.evaluate(() => window.usePerchStore.setState({ usage: [{ provider: "claude", windows: [{ label: "5h", usedPercent: 42, windowMinutes: 300 }, { label: "7d", usedPercent: 19, windowMinutes: 10080 }] }, { provider: "codex", windows: [{ label: "5h", usedPercent: 8, windowMinutes: 300 }] }] }));
    const attention = page.getByTestId("needs-you-toggle");
    await expect(attention).toHaveAccessibleName("Needs You: 2");
    await expect(attention).toHaveText("2");
    for (const theme of THEME_NAMES) {
      await page.evaluate((theme) => window.usePerchStore.getState().updateSettings({ theme }), theme);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--panel-bg").trim())).toBe(resolveTheme(theme).panelBg);
      const geometry = await page.evaluate(() => {
        const center = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return r.y + r.height / 2; };
        return { footer: center("footer.status-bar"), bell: center('[data-testid="needs-you-toggle"] svg'), count: center('[data-testid="needs-you-count"]'), usage: center('[data-testid="usage-summary"]'), text: center('[data-testid="usage-summary"] > span'), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      for (const center of [geometry.bell, geometry.count, geometry.usage, geometry.text]) expect(Math.abs(center - geometry.footer)).toBeLessThanOrEqual(0.5);
      expect(geometry.overflow).toBe(false);
      const birdhouse = page.getByTestId(`workspace-entry-${workspaceId}`);
      const surface = await birdhouse.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.backgroundColor = "var(--surface-1)";
        element.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      });
      await expect(birdhouse).toHaveCSS("background-color", surface);
      await birdhouse.hover();
      await expect(birdhouse).toHaveCSS("background-color", surface);
      await page.mouse.move(0, 0);
      await expect(attention).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await attention.hover();
      await expect(attention).toHaveCSS("background-color", surface);
      await page.mouse.move(0, 0);
      await expect(attention).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      expect(await row("src/App.tsx").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(12);
      expect((await row("src/App.tsx").boundingBox())!.height).toBeLessThanOrEqual(22);
      await expect(row("src/dual.ts").getByTestId("file-git-marker")).toHaveText("M/M");
      if (["perch", "catppuccin", "catppuccin-latte"].includes(theme)) await page.screenshot({ animations: "disabled", path: testInfo.outputPath(`explorer-${theme}.png`) });
    }
    await attention.click(); await expect(page.getByTestId("needs-you-panel")).toBeVisible(); await page.keyboard.press("Escape");
    await expect(attention).toBeFocused();
    await page.getByTestId("workspace-tools-gitReview").click();
    const changed = page.getByTestId("git-status").getByRole("listitem");
    await expect(changed.filter({ hasText: "src/dual.ts" }).getByTestId("file-git-marker")).toHaveText("M/M");
    await expect(changed.filter({ hasText: "src/deleted.ts" }).getByTestId("file-git-marker")).toHaveText("D");
    await expect(page.getByTestId("git-diff-line").first()).toBeVisible();
    await expect(page.getByText("Reading Git status…", { exact: true })).toHaveCount(0);
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath("git-rows.png") });
    await page.getByTestId("workspace-tools-files").click();
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByTestId("mobile-pane-files").click();
    await row("src").click();
    expect((await row("src/App.tsx").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await page.getByTestId("needs-you-toggle").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ animations: "disabled", path: testInfo.outputPath("explorer-phone.png") });
    failGit = true;
    await page.getByRole("button", { name: "Refresh file tree", exact: true }).click();
    await expect(page.getByTestId("explorer-git-state")).toHaveText("Git unavailable");
    await expect(page.getByTestId("file-git-marker")).toHaveCount(0);
    await expect(row("package.json").locator('[data-file-icon="package"]')).toBeVisible();
  } finally {
    await page.evaluate(() => window.usePerchStore.getState().updateSettings({ theme: "perch" })).catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
  }
});

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
