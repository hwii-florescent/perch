/**
 * mods.spec.ts — a mod and a layout written into the core's folder show up in the running app,
 * draw (a mod block, a slot, the layout's look), and go away again from Settings.
 *
 * The suite's core keeps its mods beside its database (`<state>/hub/mods`, `<state>/hub/layouts`).
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const HOME = path.join(process.env.PERCH_E2E_STATE ?? "", "hub");
const MOD = path.join(HOME, "mods", "e2e-hello");
const LAYOUT = path.join(HOME, "layouts", "e2e-look.json");
const STACK = path.join(HOME, "layouts", "e2e-stack.json");
const THEME = path.join(HOME, "themes", "e2e-dusk.json");
const FLOAT = path.join(HOME, "layouts", "e2e-float.json");

test.afterEach(() => {
  fs.rmSync(MOD, { recursive: true, force: true });
  fs.rmSync(LAYOUT, { force: true });
  fs.rmSync(STACK, { force: true });
  fs.rmSync(FLOAT, { force: true });
  fs.rmSync(THEME, { force: true });
  fs.rmSync(path.join(HOME, "layout-state.json"), { force: true });
  fs.rmSync(path.join(HOME, "mods-removed"), { recursive: true, force: true });
});

async function openMods(page: Page) {
  // A bundle that throws while loading (a module cycle) leaves a blank page, so say why.
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="settings-gear"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="settings-gear"]').click();
  await page.locator('[data-testid="settings-nav-mods"]').click();
}

test("a mod and a layout written to the folder appear, draw, and are removed from Settings", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), "export default (el, api) => { el.textContent = 'hello from a mod'; el.dataset.sessions = String(api.sessions().length); }");
  fs.writeFileSync(LAYOUT, JSON.stringify({
    name: "E2E look", type: "row", theme: "nord", terminalPadding: 12, terminalOpacity: 0.9, paneRadius: 2, shadow: "md",
    children: [
      { type: "block", content: "sidebar", size: { px: 240, min: 120, max: 400 } },
      { type: "block", content: "canvas" },
      { type: "block", content: "mod:e2e-hello", size: { px: 200 }, float: { x: 0, y: 0, width: 220, height: 80, edge: "right", align: "start", peek: 40 } },
    ],
  }));

  await openMods(page);
  // The core rescans every 2 s and tells the page.
  await expect(page.locator('[data-testid="mod-e2e-hello"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="mod-e2e-hello-status"]')).toHaveText("On");
  const layout = page.locator('[data-testid="layout-e2e-look"]');
  await expect(layout).toBeVisible();
  await layout.getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");

  const block = page.locator('[data-testid="layout-mod:e2e-hello"]');
  await expect(block).toContainText("hello from a mod", { timeout: 10000 });
  await expect(block).toHaveClass(/layout-drawer/);
  await expect(page.locator('[data-testid="layout-root"]')).toBeVisible();
  const vars = await page.evaluate(() => {
    const style = document.documentElement.style;
    return ["--terminal-padding", "--terminal-opacity", "--radius-pane", "--card-shadow"].map((name) => style.getPropertyValue(name));
  });
  expect(vars[0]).toBe("12px");
  expect(vars[1]).toBe("0.9");
  expect(vars[2]).toBe("2px");
  expect(vars[3]).toContain("rgb(0 0 0");

  // Remove both from Settings: they leave the folders (to the trash folder) and the window goes back to stock.
  await page.locator('[data-testid="settings-gear"]').click();
  await page.locator('[data-testid="settings-nav-mods"]').click();
  await page.locator('[data-testid="mod-e2e-hello-remove"]').click();
  await expect(page.locator('[data-testid="mod-e2e-hello"]')).toHaveCount(0, { timeout: 10000 });
  await page.locator('[data-testid="layout-e2e-look-remove"]').click();
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toHaveCount(0, { timeout: 10000 });
  expect(fs.existsSync(MOD)).toBe(false);
  expect(fs.existsSync(LAYOUT)).toBe(false);
  expect(fs.readdirSync(path.join(HOME, "mods-removed")).length).toBe(2);
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="layout-root"]')).toHaveCount(0);
});

test("a stack, a divider, a theme file and a draggable boundary work in the running app", async ({ page }) => {
  fs.mkdirSync(path.dirname(STACK), { recursive: true });
  fs.mkdirSync(path.dirname(THEME), { recursive: true });
  const ansi = Array.from({ length: 16 }, (_, i) => `#${(i * 15).toString(16).padStart(2, "0").repeat(3)}`);
  fs.writeFileSync(THEME, JSON.stringify({ name: "E2E Dusk", background: "#101820", foreground: "#e8e8e8", ansi }));
  fs.writeFileSync(STACK, JSON.stringify({
    name: "E2E stack", type: "row", theme: "e2e-dusk", divider: { width: 2, color: "#445566" },
    children: [
      { type: "block", id: "side", content: "sidebar", size: { px: 240 } },
      { type: "stack", id: "work", header: "tabs", children: [
        { type: "block", id: "main", title: "Canvas", content: "canvas" },
        { type: "block", id: "tools", title: "Files", content: "files" },
      ] },
    ],
  }));

  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-stack"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-stack"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");

  // The theme file by name styled the window, the stack shows its first child under a tab strip.
  await expect(page.locator('[data-testid="stack-tabs-work"]')).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--panel-bg"))).toBe("#101820");
  await expect(page.locator('[data-testid="layout-canvas"]')).toBeVisible();
  await expect(page.locator('[data-testid="layout-files"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Files" }).click();
  await expect(page.locator('[data-testid="layout-files"]')).toBeVisible();
  await expect(page.locator('[data-testid="layout-canvas"]')).toHaveCount(0);

  // The boundary drags and the new width is kept.
  const side = page.locator('[data-testid="layout-sidebar"]');
  const before = (await side.boundingBox())!.width;
  const grip = page.locator('[data-testid="layout-boundary"] > div').first();
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = (await side.boundingBox())!.width;
  expect(after).toBeGreaterThan(before + 40);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="layout-sidebar"]')).toBeVisible({ timeout: 15000 });
  expect(Math.abs((await page.locator('[data-testid="layout-sidebar"]').boundingBox())!.width - after)).toBeLessThan(2);
});

test("a floating block is dragged by its grip, springs to the nearest edge and keeps the spot", async ({ page }) => {
  fs.mkdirSync(path.dirname(FLOAT), { recursive: true });
  fs.writeFileSync(FLOAT, JSON.stringify({
    name: "E2E float", type: "row",
    children: [
      { type: "block", content: "sidebar", size: { px: 240 } },
      { type: "block", content: "canvas" },
      { type: "block", id: "board", content: "git", float: { x: 300, y: 200, width: 260, height: 120 } },
    ],
  }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-float"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-float"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");

  const board = page.locator('[data-testid="layout-git"]');
  await expect(board).toBeVisible({ timeout: 10000 });
  const grip = board.locator('[data-testid="float-grip"]');
  const box = (await grip.boundingBox())!;
  const view = page.viewportSize()!;
  await page.mouse.move(box.x + box.width / 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(view.width / 2, view.height - 80, { steps: 8 });
  await page.mouse.up();

  // Dropped near the bottom, over the middle: it docks to the bottom edge, centred.
  await expect(board).toHaveCSS("bottom", "12px");
  const placed = (await board.boundingBox())!;
  expect(Math.abs(placed.x + placed.width / 2 - view.width / 2)).toBeLessThan(2);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="layout-git"]')).toHaveCSS("bottom", "12px", { timeout: 15000 });
});

test("api.screenshot draws the running app into a PNG", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), "export default (el, api) => { el.textContent = 'shot me'; api.screenshot().then((png) => { el.dataset.shot = png.slice(0, 22) + '|' + png.length; }, (e) => { el.dataset.shot = 'ERR ' + e.message; }); }");
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-shot]');
  await expect(holder).toHaveAttribute("data-shot", /^data:image\/png;base64,\|\d+$|^data:image\/png;base64,.*\|\d+$/, { timeout: 20000 });
  const size = Number((await holder.getAttribute("data-shot"))!.split("|")[1]);
  expect(size).toBeGreaterThan(3000); // a picture with content, not a blank pixel
});

test("a block's props, theme() and layout() reach the mod in the running app", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), "export default (el, api) => { el.dataset.seen = JSON.stringify({ props: api.props(), accent: api.theme().accent, layout: api.layout(), layouts: api.layouts().includes('e2e-look'), home: api.home().length > 1, appHome: api.appHome().endsWith('hub'), placement: api.placement() }); el.textContent = 'props'; }");
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", colors: { accent: "#ff8800" }, children: [
    { type: "block", content: "canvas" },
    { type: "block", id: "pb", content: "mod:e2e-hello", size: { px: 200 }, props: { file: "notes.md", n: 3 }, float: { x: 0, y: 0, width: 220, height: 80, edge: "bottom", align: "end" } },
    { type: "block", content: "agent:focused", size: { px: 100 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-seen]');
  await expect(holder).toHaveAttribute("data-seen", /./, { timeout: 15000 });
  expect(JSON.parse((await holder.getAttribute("data-seen"))!)).toEqual({ props: { file: "notes.md", n: 3 }, accent: "#ff8800", layout: "e2e-look", layouts: true, home: true, appHome: true, placement: { edge: "bottom", align: "end", vertical: false, dragging: false } });
  await expect(page.locator('[data-testid="layout-agent:focused"]')).toBeVisible();
});
