/**
 * mods.spec.ts — a mod and a layout written into the core's folder show up in the running app,
 * draw (a mod block, a slot, the layout's look), and go away again from Settings.
 *
 * The suite's core keeps its mods beside its database (`<state>/hub/mods`, `<state>/hub/layouts`).
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
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
  fs.rmSync(path.join(HOME, "keys.json"), { force: true });
  fs.rmSync(path.join(HOME, "programs.json"), { force: true });
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

test("pane.split {mod, props} tiles a mod beside the tab, and panes()/agents()/machines() answer", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    if (api.props().pane) { el.dataset.pane = JSON.stringify(api.props()); el.textContent = 'pane copy'; return; }
    el.textContent = 'launcher';
    const t = setTimeout(() => {
      el.dataset.ran = String(api.run('pane.split', { direction: 'right', mod: 'e2e-hello', props: { pane: 1 } }));
      el.dataset.data = JSON.stringify({ machines: api.machines().map((m) => m.id), agents: Array.isArray(api.agents()), terminals: Array.isArray(api.terminals()), panes: api.panes().length });
    }, 800);
    return () => clearTimeout(t);
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const launcher = page.locator('[data-testid="layout-mod:e2e-hello"] [data-ran]');
  await expect(launcher).toHaveAttribute("data-ran", "true", { timeout: 15000 });
  const data = JSON.parse((await launcher.getAttribute("data-data"))!);
  expect(data.machines[0]).toBe("local");
  expect(data.agents && data.terminals).toBe(true);
  await expect(page.locator('[data-testid="split-pane-mod-e2e-hello"] [data-pane]')).toHaveAttribute("data-pane", '{"pane":1}', { timeout: 15000 });
});

test("a mod drives the app's own terminals through api.perch, like herdr's hc ls/send/read", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    el.textContent = 'hc';
    let live = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await sleep(800);
      api.run('pane.split', { direction: 'right' });
      let session;
      for (let i = 0; i < 40 && !session; i++) {
        await sleep(500);
        const ls = JSON.parse((await api.perch(['daemon', 'ls', '--json'])).stdout || '[]');
        session = ls.find((s) => s.alive);
      }
      if (!session) { el.dataset.read = 'NO SESSION'; return; }
      await api.perch(['daemon', 'send', session.id, 'echo PERCH_MOD_$((6*7))', '--enter']);
      for (let i = 0; i < 20 && live; i++) {
        await sleep(500);
        const out = (await api.perch(['daemon', 'read', session.id])).stdout;
        if (out.includes('PERCH_MOD_42')) { el.dataset.read = out; return; }
      }
      el.dataset.read = 'NOT SEEN';
    })().catch((e) => { el.dataset.read = 'ERR ' + e.message; });
    return () => { live = false; };
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-read]');
  await expect(holder).toHaveAttribute("data-read", /PERCH_MOD_42/, { timeout: 40000 });
});

test("herdr's tab, pane, terminal and agent commands run against Perch's tabs and terminals", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    el.textContent = 'cmds';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const seen = {};
      // The page restores the viewer's saved selection once after load (and treats the first session change as the connection resuming); act after both, as a person would.
      for (let i = 0; i < 40 && !api.focused().sessionId; i++) await sleep(250);
      await sleep(2000);
      const before = new Set(api.terminals().map((t) => t.id));
      api.run('tab.new', { argv: ['sh', '-c', 'echo ARGV_$((6*7)); sleep 60'] });
      let id;
      for (let i = 0; i < 40 && !id; i++) {
        await sleep(500);
        // The new terminal is listed at once; the page may move focus elsewhere meanwhile (a resumed session), so show it by name.
        const made = api.terminals().find((t) => !before.has(t.id) && t.title.startsWith("Run: 'sh'"));
        if (!made) continue;
        api.run('session.open', { id: made.id });
        await sleep(300);
        try { if ((await api.readTerminal(made.id, 10)).includes('ARGV_42')) id = made.id; } catch {}
      }
      seen.started = !!id;
      if (id) {
        api.run('tab.rename', { id, name: 'Renamed by mod' });
        await sleep(500);
        seen.title = api.panes().find((p) => p.id === id)?.title;
        api.run('terminal.pin', { terminal: id });
        seen.pinned = api.terminals().find((t) => t.id === id)?.pinned;
        api.run('terminal.pin', { terminal: id, pinned: false });
        seen.unpinned = api.terminals().find((t) => t.id === id)?.pinned;
        seen.peeked = api.run('terminal.peek', { id });
        api.run('terminal.scroll', { to: 'top' });
        api.run('terminal.scroll', { pages: 1 });
        seen.selected = api.run('tab.select', { index: 1 });
        for (const bad of [{ to: 'middle' }, {}]) { try { api.run('terminal.scroll', bad); } catch (e) { (seen.bad ??= []).push(e.message); } }
        seen.names = ['tab.select', 'tab.rename', 'tab.move', 'pane.close', 'pane.focus', 'terminal.kill', 'terminal.scroll', 'terminal.pin', 'terminal.show', 'terminal.peek', 'terminal.keep', 'agent.next', 'agent.prev', 'agent.focus', 'app.settings', 'app.help', 'app.palette'].filter((n) => api.commands().some((c) => c.id === n));
        api.run('terminal.kill', { terminal: id });
      }
      el.dataset.seen = JSON.stringify(seen);
    })().catch((e) => { el.dataset.seen = JSON.stringify({ error: e.message }); });
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-seen]');
  await expect(holder).toHaveAttribute("data-seen", /./, { timeout: 40000 });
  const seen = JSON.parse((await holder.getAttribute("data-seen"))!);
  expect(seen).toEqual({
    started: true,
    title: "Renamed by mod",
    pinned: true,
    unpinned: false,
    peeked: true,
    selected: true,
    bad: ['{to} is "top" or "bottom".', "This command needs {lines}, {pages} or {to}."],
    names: ['tab.select', 'tab.rename', 'tab.move', 'pane.close', 'pane.focus', 'terminal.kill', 'terminal.scroll', 'terminal.pin', 'terminal.show', 'terminal.peek', 'terminal.keep', 'agent.next', 'agent.prev', 'agent.focus', 'app.settings', 'app.help', 'app.palette'],
  });
});

test("project.new {folder, argv} adds the project, then runs the program in it", async ({ page }) => {
  const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-pnew-")));
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    el.textContent = 'pnew';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i < 40 && !api.focused().sessionId; i++) await sleep(250);
      await sleep(2000);
      const seen = {};
      const before = new Set(api.terminals().map((t) => t.id));
      api.run('project.new', { folder: ${JSON.stringify(folder)}, argv: ['sh', '-c', 'echo PNEW_$((6*7)); sleep 30'] });
      for (let i = 0; i < 60 && !seen.read; i++) {
        await sleep(500);
        const made = api.terminals().find((t) => !before.has(t.id) && t.title.startsWith("Run: 'sh'"));
        seen.cwd = made?.cwd;
        if (!made) continue;
        api.run('session.open', { id: made.id });
        await sleep(300);
        try { if ((await api.readTerminal(made.id, 10)).includes('PNEW_42')) { seen.read = true; api.run('terminal.kill', { terminal: made.id }); } } catch {}
      }
      el.dataset.seen = JSON.stringify(seen);
    })().catch((e) => { el.dataset.seen = JSON.stringify({ error: e.message }); });
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-seen]');
  await expect(holder).toHaveAttribute("data-seen", /./, { timeout: 50000 });
  expect(JSON.parse((await holder.getAttribute("data-seen"))!)).toEqual({ read: true, cwd: folder });
});

test("overlay.close closes the top dialog a mod opened and layout.set rewrites the shown layout's file", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    el.textContent = 'ovl';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await sleep(1500);
      const seen = {};
      api.overlay((box) => { box.textContent = 'dialog one'; });
      api.overlay((box) => { box.textContent = 'dialog two'; });
      const count = () => document.querySelectorAll('[data-testid="mod-api-overlay-e2e-hello"]').length;
      seen.open = count();
      api.run('overlay.close');
      seen.afterOne = count();
      seen.topIsFirst = document.querySelector('[data-testid="mod-api-overlay-e2e-hello"]')?.textContent;
      api.run('overlay.close');
      api.run('overlay.close');
      seen.afterAll = count();
      try { api.run('layout.set', { layout: 'nope' }); } catch (e) { seen.bad = e.message; }
      api.run('layout.set', { layout: { name: 'E2E set', type: 'row', children: [{ type: 'block', content: 'canvas' }, { type: 'block', content: 'mod:e2e-hello', size: { px: 222 } }] } });
      el.dataset.seen = JSON.stringify(seen);
    })().catch((e) => { el.dataset.seen = JSON.stringify({ error: e.message }); });
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-seen]');
  await expect(holder).toHaveAttribute("data-seen", /./, { timeout: 30000 });
  expect(JSON.parse((await holder.getAttribute("data-seen"))!)).toEqual({
    open: 2, afterOne: 1, topIsFirst: "dialog one", afterAll: 0, bad: "This command needs {layout: {type: \"column\" | \"row\" | …, …}}.",
  });
  await expect.poll(() => JSON.parse(fs.readFileSync(LAYOUT, "utf8")).children[1].size, { timeout: 10000 }).toEqual({ px: 222 });
});

test("keys.json binds a key to a mod's command and programs.json reaches api.program()", async ({ page }) => {
  fs.mkdirSync(MOD, { recursive: true });
  fs.writeFileSync(path.join(MOD, "main.js"), `export default (el, api) => {
    el.textContent = 'keys';
    api.command({ name: 'hit', description: 'hit' }); // no run: delivered to nextCommand()
    api.nextCommand().then((c) => { el.dataset.hit = c.name; });
    const show = () => { el.dataset.program = JSON.stringify({ vitest: api.program('npx vitest run').id, shell: api.program('/bin/zsh -l').id, mine: api.program('mytool-dev').name, count: api.programs().length > 40 }); };
    show();
    const timer = setInterval(show, 500);
    return () => clearInterval(timer);
  };`);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E look", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-hello", size: { px: 200 } },
  ] }));
  fs.writeFileSync(path.join(HOME, "keys.json"), JSON.stringify({ global: { "ctrl-shift-y": "e2e-hello.hit" } }));
  fs.writeFileSync(path.join(HOME, "programs.json"), JSON.stringify({ programs: { mytool: { name: "My Tool", match: ["mytool-dev"] } } }));
  await openMods(page);
  await expect(page.locator('[data-testid="layout-e2e-look"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="layout-e2e-look"]').getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");
  const holder = page.locator('[data-testid="layout-mod:e2e-hello"] [data-program]');
  await expect(holder).toHaveAttribute("data-program", /My Tool/, { timeout: 20000 });
  expect(JSON.parse((await holder.getAttribute("data-program"))!)).toEqual({ vitest: "vitest", shell: "shell", mine: "My Tool", count: true });
  await page.keyboard.press("Control+Shift+Y");
  await expect(holder).toHaveAttribute("data-hit", "hit", { timeout: 5000 });
});
