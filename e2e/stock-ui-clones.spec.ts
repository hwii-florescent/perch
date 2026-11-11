/**
 * stock-ui-clones.spec.ts — a mod written as a package of ES modules loads through the real core and the real
 * shared React: nested, lazy and circular imports run, one revision's files stay together, and a broken edit
 * keeps the last working view. Perch's own keybind help runs from its exported stock package on @perch/sdk; an
 * untouched clone of it passes the same checks, and an edit to the clone changes the clone only. The status bar, the
 * tab strip and the split panes' headers run from their stock packages too; `mods.set use` (`perch mod use`) puts a
 * person's clone in their place, the untouched clone passes the same checks, and deep edits (a reversed strip, a new
 * header action on a shared command) change only the clone. The sidebar runs from `stock:sidebar` on the SDK's
 * navigation surface: an untouched clone in its place behaves the same, a deep edit changes only the clone, and the
 * phone's switcher keeps its own screen. The Git review runs from `stock:review` on the SDK's resource surface: an
 * untouched clone in its place shows and acts on the same review, an unsent commit message survives the swap
 * (host-kept resource state), a deep edit changes only the clone, and the phone keeps its own review. The Files
 * explorer and file editor run from `stock:files`: a clone in their place lists and opens the same files, an unsaved
 * draft survives the swap (Perch's own buffer), a deep edit changes only the clone, and the phone keeps its own.
 * The drawer's browser strip runs from `stock:browser`: a clone in its place shows the same pages (Perch's own), and a
 * deep edit changes only the clone. The confirmation and the notifications run from `stock:confirm` and `stock:toast`
 * wherever Perch (or a package, through the SDK) opens them: an untouched clone in their place behaves the same and an
 * edit changes only the clone. The menus, pickers and dialogs (the tab menu, the new-tab menu, the launcher, the
 * Navigator, the folder browser, onboarding, the tab drag layer, Instructions, Memory, the worktree form and the file
 * menu) run from their stock packages; untouched clones in their place behave the same, edits change only the clones,
 * and a clone of the dialog shell or the dropdown is used inside both the stock and the cloned parent. A scripted agent with only `perch` (its guide and CLI) clones the status bar, puts it in
 * place, edits it and verifies it with `perch mod check/dom/do`. A clone that stops the page while starting is turned
 * off on the next load and Perch's own screen comes back. A live terminal composes into a peek and into a package's `Layout` and back: the same process, xterm and input owner,
 * never a second copy, and nothing stops when the surface closes. The start screen, the editor menu, the terminal's
 * find bar, the phone-size notice, Split with session and the slash popover run from their stock packages too: an
 * untouched clone in their place does the same thing through Perch's own actions (a session starts, an undo reverts
 * the draft, a find leaves the shell's input alone, a phone's size is taken back, a session is split in, a slash pick
 * only rewrites the composer), and an edit changes only the clone. The shell toolbar, the dock's tabs and group
 * buttons, the browser toolbar and the agent terminal's chip run from stock packages the same way. A phone runs a
 * person's copy only for one of its own screens (`stock:mobile-*`) and only once turned on there; off, and a revoked
 * pairing, put Perch's own back. A customized copy survives a newer catalog, a copy needing a newer SDK shows Perch's
 * own with the reason, a core in safe mode (`PERCH_MODS=off`) runs Perch's own, and 100 edits of a package are
 * measured for what the page keeps. Faults injected into the real loader and core (missing and malformed files, CSS
 * naming a missing asset, a revision the core dropped while the page loaded it, an expired revision, a core restart in
 * the middle of a swap, throwing cleanups, blocked storage, corrupt and oversized mod data) each keep the last good view
 * or stock, say why, never report success, and lose no draft or terminal; 100 edit cycles of a package holding a live
 * terminal, a draft, a command, timers and tracked operations are counted for what stays live.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { expectActive, startChat } from "./projects";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { cleanupFixtureRuntime, fixtureRuntimeEnv } from "./fixtureRuntime";
import { pathToFileURL } from "node:url";
import { firstWorkspaceId, holdRow, openWorkspaceTool } from "./workspaceTools";
import { expectDoc, MOD as EDITOR_MOD } from "./editor";
import { localStorageState, withLocalToken } from "./localAuth";
import { setChatMode } from "./chatMode";

const HOME = path.join(process.env.PERCH_E2E_STATE ?? "", "hub");
const MOD = path.join(HOME, "mods", "e2e-esm");
const LAYOUT = path.join(HOME, "layouts", "e2e-esm-look.json");
const CLONE = path.join(HOME, "mods", "e2e-my-keys");
const CLONE_LAYOUT = path.join(HOME, "layouts", "e2e-my-keys-look.json");
const CHROME_CLONES = ["e2e-my-status", "e2e-my-tabs", "e2e-my-pane", "e2e-my-sidebar", "e2e-my-review", "e2e-my-files", "e2e-my-browser", "e2e-my-confirm", "e2e-my-toast", "e2e-agent-status", "e2e-stuck-status",
  "e2e-my-tab-menu", "e2e-my-new-session", "e2e-my-launcher", "e2e-my-navigator", "e2e-my-folder-browser", "e2e-my-onboarding", "e2e-my-tab-drag",
  "e2e-my-dialog", "e2e-my-select", "e2e-my-instructions", "e2e-my-memory", "e2e-my-worktree", "e2e-my-file-menu", "e2e-my-settings-hosts", "e2e-my-pane-menu", "e2e-my-close-guard",
  "e2e-my-start", "e2e-my-editor-menu", "e2e-my-terminal-search", "e2e-my-phone-size", "e2e-my-session-split", "e2e-my-slash-popover",
  "e2e-my-terminal-toolbar", "e2e-my-dock-tab", "e2e-my-dock-actions", "e2e-my-browser-toolbar", "e2e-my-agent-control",
  "e2e-my-mobile-header", "e2e-my-mobile-switcher", "e2e-my-mobile-panes", "e2e-my-mobile-files", "e2e-my-mobile-keys"].map((id) => path.join(HOME, "mods", id));

const write = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(MOD, file)), { recursive: true });
  fs.writeFileSync(path.join(MOD, file), text);
};
const block = (page: Page) => page.locator('[data-testid="layout-mod:e2e-esm"]');

test.afterEach(() => {
  fs.rmSync(MOD, { recursive: true, force: true });
  fs.rmSync(LAYOUT, { force: true });
  fs.rmSync(CLONE, { recursive: true, force: true });
  fs.rmSync(CLONE_LAYOUT, { force: true });
  for (const clone of CHROME_CLONES) fs.rmSync(clone, { recursive: true, force: true });
  fs.rmSync(path.join(HOME, "layout-state.json"), { force: true });
  fs.rmSync(path.join(HOME, "mod-data", "e2e-esm"), { recursive: true, force: true });
  for (const name of fs.existsSync(path.join(HOME, "layouts")) ? fs.readdirSync(path.join(HOME, "layouts")) : []) {
    if (/^my-window(-\d+)?\.json$/.test(name)) fs.rmSync(path.join(HOME, "layouts", name), { force: true });
  }
});

test("a package of ES modules runs on the shared React, and a broken edit keeps the last good view", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  write("mod.json", JSON.stringify({ name: "ESM", format: "esm", api: "^1" }));
  write("main.js", [
    'import { useState } from "react";',
    'import { jsx } from "react/jsx-runtime";',
    'import { label } from "./lib/dep.js";',
    'import { ping } from "./a.js";',
    "export default function Panel() {",
    "  const [n, setN] = useState(0);",
    '  const [lazy, setLazy] = useState("");',
    '  return jsx("button", { "data-testid": "esm-button", onClick: () => { setN(n + 1); import("./lazy.js").then((m) => setLazy(m.value)); }, children: label + ":" + n + ":" + ping() + ":" + lazy });',
    "}",
  ].join("\n"));
  write("lib/dep.js", 'export const label = "one";');
  write("a.js", 'import { pong } from "./b.js";\nexport const ping = () => "ping" + (typeof pong);\n');
  write("b.js", 'import { ping } from "./a.js";\nexport const pong = () => typeof ping;\n');
  write("lazy.js", 'export const value = "lazy-ok";');
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({
    name: "E2E ESM", type: "row",
    children: [
      { type: "block", content: "sidebar", size: { px: 240, min: 120, max: 400 } },
      { type: "block", content: "canvas" },
      { type: "block", content: "mod:e2e-esm", size: { px: 200 }, float: { x: 0, y: 0, width: 260, height: 80, edge: "right", align: "start", peek: 40 } },
    ],
  }));

  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-testid="settings-gear"]').click();
  await page.locator('[data-testid="settings-nav-mods"]').click();
  const layout = page.locator('[data-testid="layout-e2e-esm-look"]');
  await expect(layout).toBeVisible({ timeout: 15000 });
  await layout.getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");

  const button = block(page).locator('[data-testid="esm-button"]');
  await expect(button).toHaveText("one:0:pingfunction:", { timeout: 15000 });
  // Real hooks from the one shared React, and a lazy import from the same revision.
  await button.click();
  await expect(button).toHaveText("one:1:pingfunction:lazy-ok");

  // An edit to a nested file is a new revision and replaces the view.
  write("lib/dep.js", 'export const label = "two";');
  await expect(button).toHaveText(/^two:0:/, { timeout: 15000 });

  // A broken edit keeps the last working view and says why.
  write("lib/dep.js", "export const label = ;");
  await expect(block(page).locator('[data-testid="mod-error"]')).toBeVisible({ timeout: 15000 });
  await expect(button).toHaveText(/^two:/);
});

test("a package's CSS and assets come from its revision, and an edit retires the old styles", async ({ page }) => {
  const DOT = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4"/></svg>';
  write("mod.json", JSON.stringify({ name: "ESM", format: "esm", api: "^1.1" }));
  write("main.js", [
    'import { jsx, jsxs } from "react/jsx-runtime";',
    'import { assetUrl } from "@perch/sdk";',
    'import "./look.css";',
    'export default function Panel() {',
    '  return jsxs("div", { "data-testid": "esm-look", className: "e2e-esm-dot", children: [jsx("img", { "data-testid": "esm-img", src: assetUrl("art/dot.svg"), alt: "" }), "styled"] });',
    "}",
  ].join("\n"));
  write("look.css", '/* url(nope.png) */ .e2e-esm-dot { background-image: url( "art/dot.svg" ); color: rgb(1, 2, 3); }\n');
  write("art/dot.svg", DOT);
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({
    name: "E2E ESM", type: "row",
    children: [{ type: "block", content: "sidebar", size: { px: 240 } }, { type: "block", content: "mod:e2e-esm", id: "look" }],
  }));

  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-testid="settings-gear"]').click();
  await page.locator('[data-testid="settings-nav-mods"]').click();
  const layout = page.locator('[data-testid="layout-e2e-esm-look"]');
  await expect(layout).toBeVisible({ timeout: 15000 });
  await layout.getByRole("button", { name: "Use" }).click();
  await page.keyboard.press("Escape");

  const look = block(page).locator('[data-testid="esm-look"]');
  await expect(look).toHaveCSS("color", "rgb(1, 2, 3)", { timeout: 15000 });
  await expect(look).toHaveCSS("background-image", /^url\("blob:/);
  const img = block(page).locator('[data-testid="esm-img"]');
  await expect(img).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(8);
  const styles = page.locator('style[data-mod-package="e2e-esm"]');
  await expect(styles).toHaveCount(1);
  const first = await styles.getAttribute("data-mod-revision");

  // A new revision brings its own stylesheet; the old one leaves the page.
  write("look.css", '.e2e-esm-dot { background-image: url(art/dot.svg); color: rgb(4, 5, 6); }\n');
  await expect(look).toHaveCSS("color", "rgb(4, 5, 6)", { timeout: 15000 });
  await expect(styles).toHaveCount(1);
  expect(await styles.getAttribute("data-mod-revision")).not.toBe(first);
  await expect(look).toHaveCSS("background-image", /^url\("blob:/);
});

/** `mods.set` over a short-lived socket of the page's own (signed-in) origin; resolves with the reply's error. */
const modsSet = (page: Page, body: Record<string, unknown>) => page.evaluate((body) => new Promise<string | null>((resolve, reject) => {
  const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
  const requestId = crypto.randomUUID();
  const timer = setTimeout(() => { ws.close(); reject(new Error("mods.set timed out")); }, 10_000);
  ws.onopen = () => ws.send(JSON.stringify({ type: "mods.set", requestId, ...body }));
  ws.onmessage = (event) => {
    const answer = JSON.parse(event.data);
    if (answer.type !== "mods.state" || answer.requestId !== requestId) return;
    clearTimeout(timer); ws.close(); resolve(answer.error ?? null);
  };
}), body);

/** What the keybind help must do, whoever's copy is showing: one dialog, its title, a search that narrows the
 * list to matching bindings and says when nothing matches, and the whole list again when cleared. */
async function keybindHelpWorks(page: Page) {
  const help = page.getByTestId("keybind-help");
  await expect(help).toBeVisible({ timeout: 15000 });
  await expect(help).toHaveCount(1);
  await expect(help.getByRole("heading", { name: "Keybindings", exact: true })).toBeVisible();
  const search = help.getByTestId("keybind-help-search");
  await search.fill("Navigator");
  await expect(help.getByText("Open Navigator").first()).toBeVisible();
  await expect(help.getByText("Toggle sidebar", { exact: true })).toHaveCount(0);
  await search.fill("no such binding anywhere");
  await expect(help.getByText("No matching keybindings")).toBeVisible();
  await search.fill("");
  await expect(help.getByText("Toggle sidebar", { exact: true }).first()).toBeVisible();
  await expect(help.getByText("No matching keybindings")).toHaveCount(0);
}

test("stock keybind help runs from its package; an untouched clone passes the same checks and an edit changes only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  const fetched: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/stock-ui/")) fetched.push(new URL(request.url()).pathname); });
  const stockSource = async () => (await page.request.get("/stock-ui/keybind-help/main.js")).text();
  await page.goto("/", { waitUntil: "networkidle" });
  const shipped = await stockSource();
  expect(shipped).toContain('from "@perch/sdk"');
  expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds)/);

  // Stock: opened by its key, drawn by the exported package (not the app bundle), closed by Esc.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Shift+Slash");
  await keybindHelpWorks(page);
  await expect(page.locator('[data-testid="mod-view-stock:keybind-help"]')).toBeAttached();
  expect(fetched).toEqual(expect.arrayContaining(["/stock-ui/catalog.json", "/stock-ui/keybind-help/main.js"]));
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("keybind-help")).toHaveCount(0);

  // A clone takes a new plain id, never a stock one, and records where it came from.
  expect(await modsSet(page, { id: "stock:keybind-help", op: "clone", as: "stock:keybind-help" })).toMatch(/not a plain id/);
  expect(await modsSet(page, { id: "stock:keybind-help", op: "clone", as: "e2e-my-keys" })).toBeNull();
  const manifest = JSON.parse(fs.readFileSync(path.join(CLONE, "mod.json"), "utf8"));
  expect(manifest).toMatchObject({ format: "esm", api: "^1", place: "layout", origin: "clone", clonedFrom: { id: "stock:keybind-help", version: "1.0.0" } });
  expect(fs.readFileSync(path.join(CLONE, "main.js"), "utf8")).toBe(shipped);
  expect(fs.existsSync(path.join(CLONE, "perch-sdk.d.ts"))).toBe(true);

  // The untouched clone, where a layout puts it, passes exactly the stock checks.
  fs.mkdirSync(path.dirname(CLONE_LAYOUT), { recursive: true });
  fs.writeFileSync(CLONE_LAYOUT, JSON.stringify({
    name: "E2E my keys", type: "row",
    children: [{ type: "block", content: "canvas" }, { type: "block", content: "mod:e2e-my-keys", props: { open: true }, size: { px: 10 } }],
  }));
  await expect.poll(() => modsSet(page, { id: "e2e-my-keys-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  await expect(page.locator('[data-testid="mod-view-e2e-my-keys"]')).toBeAttached({ timeout: 15000 });
  await keybindHelpWorks(page);

  // An edit to the clone's own file shows at once; stock is untouched.
  const main = path.join(CLONE, "main.js");
  fs.writeFileSync(main, fs.readFileSync(main, "utf8").replace('children: "Keybindings"', 'children: "My keybindings"'));
  await expect(page.getByTestId("keybind-help").getByRole("heading", { name: "My keybindings" })).toBeVisible({ timeout: 15000 });
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  await expect(page.locator('[data-testid="mod-view-e2e-my-keys"]')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId("keybind-help")).toHaveCount(0);
  expect(await stockSource()).toBe(shipped);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Shift+Slash");
  await keybindHelpWorks(page);
  await page.keyboard.press("Escape");
});

/** The status bar, whoever's copy is showing: one footer in `owner`'s view, the connection, and the usage details
 * whose Refresh sends exactly one forced `usage.get`. */
async function statusWorks(page: Page, owner: string, sent: string[], label = "Connected") {
  const view = page.locator(`[data-testid="mod-view-${owner}"]`);
  await expect(view.locator("footer.status-bar")).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator("footer.status-bar")).toHaveCount(1);
  await expect(view.getByTestId("status-connection")).toHaveAttribute("aria-label", label);
  await expect(view.getByTestId("status-host")).toHaveText("Local");
  await view.getByTestId("usage-summary").click();
  const details = page.getByTestId("usage-details");
  await expect(details).toBeVisible();
  const forced = () => sent.filter((frame) => frame.includes('"usage.get"') && frame.includes('"force":true')).length;
  const before = forced();
  await details.getByTestId("usage-refresh").click();
  await expect.poll(forced).toBe(before + 1);
  await page.waitForTimeout(300);
  expect(forced()).toBe(before + 1);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
}

/** The tab strip, whoever's copy is showing: both sessions' tabs, click to switch, rename inline, the tab menu and the
 * launcher; returns the strip's tab order. */
async function tabsWork(page: Page, owner: string, a: string, b: string, name: string): Promise<string[]> {
  const view = page.locator(`[data-testid="mod-view-${owner}"]`);
  const strip = view.getByTestId("tab-bar");
  await expect(strip).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByTestId("tab-bar")).toHaveCount(1);
  await strip.getByTestId(`tab-${b}`).click();
  await expectActive(page, b);
  await strip.getByTestId(`tab-${a}`).click();
  await expectActive(page, a);
  await strip.getByTestId(`tab-${a}`).dblclick();
  await strip.getByTestId("rename-input").fill(name);
  await page.keyboard.press("Enter");
  await expect(strip.getByTestId(`tab-${a}`)).toContainText(name, { timeout: 10000 });
  await strip.getByTestId(`tab-${b}`).click({ button: "right" });
  await expect(page.getByTestId("tab-split-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tab-split-menu")).toHaveCount(0);
  await expectActive(page, a);
  await strip.getByTestId("tab-new").click();
  await expect(page.getByTestId("new-session-provider-terminal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("new-session-provider-terminal")).toHaveCount(0);
  return strip.locator("[data-tab-entry]").evaluateAll((els) => els.map((el) => el.getAttribute("data-tab-entry")!));
}

/** Two sessions shown side by side: each tiled pane has a header from `owner`'s copy, and its expand leaves the split. */
async function paneHeadersWork(page: Page, owner: string, a: string, b: string) {
  await page.getByTestId(`tab-${b}`).click({ button: "right" });
  await page.getByTestId(`tab-split-with-${a}`).click();
  await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "2", { timeout: 15000 });
  for (const id of [a, b]) await expect(page.locator(`[data-testid="mod-view-${owner}"] [data-testid="pane-header-${id}"]`)).toBeVisible({ timeout: 15000 });
  await page.getByTestId(`tile-expand-${b}`).click();
  await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "0", { timeout: 15000 });
}

test("the status bar, tabs and pane headers run from stock packages; a clone chosen in their place passes the same checks, and deep edits change only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  const sent: string[] = [];
  page.on("websocket", (ws) => ws.on("framesent", (frame) => { if (typeof frame.payload === "string") sent.push(frame.payload); }));
  await page.goto("/", { waitUntil: "networkidle" });
  const a = await startChat(page);
  const b = await startChat(page);

  // Stock, from the build's packages.
  await statusWorks(page, "stock:status", sent);
  const stockOrder = await tabsWork(page, "stock:tabs", a, b, "stock-renamed");
  expect(stockOrder.indexOf(a)).toBeLessThan(stockOrder.indexOf(b));
  await paneHeadersWork(page, "stock:pane-header", a, b);
  for (const screen of ["status", "tabs", "pane-header"]) {
    const shipped = await (await page.request.get(`/stock-ui/${screen}/main.js`)).text();
    expect(shipped).toContain('from "@perch/sdk"');
    expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds|Sidebar|tabDrag|splitSets)/);
  }

  // Only a stock screen of this build can be replaced, and only by one of the person's packages.
  expect(await modsSet(page, { id: "stock:nope", op: "use", target: "x" })).toMatch(/no stock screen/);
  expect(await modsSet(page, { id: "stock:status", op: "use", target: "e2e-my-status" })).toMatch(/no mod/);

  // Untouched clones, chosen for those screens, pass exactly the stock checks in the same places.
  for (const [screen, id] of [["status", "e2e-my-status"], ["tabs", "e2e-my-tabs"], ["pane-header", "e2e-my-pane"]]) {
    expect(await modsSet(page, { id: `stock:${screen}`, op: "clone", as: id })).toBeNull();
    await expect.poll(() => modsSet(page, { id: `stock:${screen}`, op: "use", target: id }), { timeout: 15000 }).toBeNull();
  }
  await expect(page.locator('[data-testid="mod-view-e2e-my-status"]')).toBeAttached({ timeout: 15000 });
  await expect(page.locator('[data-testid="mod-view-stock:status"]')).toHaveCount(0);
  await statusWorks(page, "e2e-my-status", sent);
  const cloneOrder = await tabsWork(page, "e2e-my-tabs", a, b, "clone-renamed");
  expect(cloneOrder).toEqual(stockOrder);
  await paneHeadersWork(page, "e2e-my-pane", a, b);

  // Deep edits: the clone's strip lists its tabs in reverse and its pane header gains a Menu button on a shared
  // command; the status bar says something else. Stock's files are untouched.
  const edit = (id: string, from: string, to: string) => {
    const file = path.join(HOME, "mods", id, "main.js");
    const text = fs.readFileSync(file, "utf8");
    expect(text).toContain(from);
    fs.writeFileSync(file, text.replace(from, to));
  };
  edit("e2e-my-tabs", "tabs.map((tab, i) => {", "[...tabs].reverse().map((tab, i) => {");
  edit("e2e-my-status", '"Connected"', '"Linked"');
  edit("e2e-my-pane", "export default function PaneHeader({ id, corner }) {", [
    "function MenuButton({ id }) {",
    '  return _jsx("button", { type: "button", "data-testid": `e2e-pane-menu-${id}`, onClick: (e) => runCommand("tab.menu", { id, x: e.clientX, y: e.clientY }), children: "Menu" });',
    "}",
    "export default function PaneHeader({ id, corner }) {",
  ].join("\n"));
  edit("e2e-my-pane", "            _jsx(Controls, { tab: tab })\n        ]\n    }));", "            _jsx(MenuButton, { id: id }),\n            _jsx(Controls, { tab: tab })\n        ]\n    }));");
  await expect.poll(async () => page.locator('[data-testid="mod-view-e2e-my-tabs"] [data-tab-entry]').evaluateAll((els) => els.map((el) => el.getAttribute("data-tab-entry"))), { timeout: 15000 })
    .toEqual([...stockOrder].reverse());
  await expect(page.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-connection")).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
  await page.getByTestId(`tab-${b}`).click({ button: "right" });
  await page.getByTestId(`tab-split-with-${a}`).click();
  await page.getByTestId(`e2e-pane-menu-${a}`).click();
  await expect(page.getByTestId("tab-split-menu")).toBeVisible();
  // Under load the menu's Escape listener (an effect) may attach after the key: press until it closes.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tab-split-menu")).toHaveCount(0, { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await page.getByTestId(`tile-expand-${a}`).click();
  await expect(page.getByTestId("split-canvas")).toHaveAttribute("data-split", "0", { timeout: 15000 });

  // `use` back to stock: Perch's own screens return, unchanged.
  for (const screen of ["status", "tabs", "pane-header"]) expect(await modsSet(page, { id: `stock:${screen}`, op: "use", target: "" })).toBeNull();
  await statusWorks(page, "stock:status", sent);
  expect(await tabsWork(page, "stock:tabs", a, b, "stock-again")).toEqual(stockOrder);
});

/** The sidebar, whoever's copy is showing: one list in `owner`'s view; a click on a chat shows it; By status lists
 * both; a chat's menu opens and closes; Add project opens its dialog. Returns the chat rows' order. */
async function sidebarWorks(page: Page, owner: string, a: string, b: string): Promise<string[]> {
  const view = page.locator(`[data-testid="mod-view-${owner}"]`);
  const list = view.getByTestId("workspace-overview");
  await expect(list).toHaveCount(1, { timeout: 15000 });
  await expect(page.getByTestId("workspace-overview")).toHaveCount(1);
  await expect(view.getByTestId("settings-gear")).toBeVisible();
  await list.getByTestId(`workspace-session-${b}`).click();
  await expectActive(page, b);
  await list.getByTestId(`workspace-session-${a}`).click();
  await expectActive(page, a);
  await list.getByTestId("workspace-organize").click();
  await page.getByTestId("workspace-organize-status").click();
  const status = list.getByTestId("workspace-status-view");
  for (const id of [a, b]) await expect(status.getByTestId(`workspace-session-${id}`)).toBeVisible();
  await list.getByTestId("workspace-organize").click();
  await page.getByTestId("workspace-organize-project").click();
  await expect(status).toHaveCount(0);
  await list.getByTestId(`workspace-session-${b}`).click({ button: "right" });
  await expect(page.getByTestId("tab-split-menu")).toBeVisible();
  // The menu listens for Escape once it has painted (its effect), so press until it has.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tab-split-menu")).toHaveCount(0, { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await expectActive(page, a);
  await list.getByTestId("workspace-add-project").click();
  await expect(page.getByTestId("workspace-add-form")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("workspace-add-form")).toHaveCount(0);
  // Only this test's chats: other specs may leave theirs in Quickchat.
  const ours = new Set([`workspace-session-${a}`, `workspace-session-${b}`]);
  return (await list.locator('[data-testid^="workspace-session-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!))).filter((id) => ours.has(id));
}

test("the sidebar runs from its stock package; a clone in its place behaves the same, a deep edit changes only the clone, and the phone keeps its own", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const a = await startChat(page);
  const b = await startChat(page);

  // Stock, from the build's package, on the SDK alone.
  await expect(page.locator('[data-testid="mod-view-stock:sidebar"]')).toBeAttached({ timeout: 15000 });
  const stockOrder = await sidebarWorks(page, "stock:sidebar", a, b);
  expect(stockOrder).toEqual([`workspace-session-${b}`, `workspace-session-${a}`]);
  const files = ["main", "content", "overview", "folders", "hosts", "parts", "icons"];
  const shipped = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await (await page.request.get(`/stock-ui/sidebar/${file}.js`)).text()] as const)));
  for (const text of Object.values(shipped)) expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds|navigation|modCommands|components)/);
  expect(shipped.overview).toContain('from "@perch/sdk"');

  // The untouched clone, chosen in its place, passes exactly the stock checks.
  expect(await modsSet(page, { id: "stock:sidebar", op: "clone", as: "e2e-my-sidebar" })).toBeNull();
  await expect.poll(() => modsSet(page, { id: "stock:sidebar", op: "use", target: "e2e-my-sidebar" }), { timeout: 15000 }).toBeNull();
  await expect(page.locator('[data-testid="mod-view-e2e-my-sidebar"]')).toBeAttached({ timeout: 15000 });
  await expect(page.locator('[data-testid="mod-view-stock:sidebar"]')).toHaveCount(0);
  expect(await sidebarWorks(page, "e2e-my-sidebar", a, b)).toEqual(stockOrder);

  // Deep edits: the clone's list says "My projects", and its body gains a button on a shared command.
  const edit = (file: string, from: string, to: string) => {
    const at = path.join(HOME, "mods", "e2e-my-sidebar", file);
    const text = fs.readFileSync(at, "utf8");
    expect(text).toContain(from);
    fs.writeFileSync(at, text.replace(from, to));
  };
  edit("overview.js", '"Projects" : "Sessions"', '"My projects" : "Sessions"');
  edit("main.js", "_jsx(SidebarContent, {})", `_jsx("button", { type: "button", "data-testid": "e2e-sidebar-open", onClick: () => runCommand("session.open", { id: ${JSON.stringify(b)} }), children: "Open b" }), _jsx(SidebarContent, {})`);
  const clone = page.locator('[data-testid="mod-view-e2e-my-sidebar"]');
  await expect(clone.getByText("My projects", { exact: true })).toBeVisible({ timeout: 15000 });
  await clone.getByTestId("e2e-sidebar-open").click();
  await expectActive(page, b);
  for (const file of files) expect(await (await page.request.get(`/stock-ui/sidebar/${file}.js`)).text()).toBe(shipped[file]);

  // The phone's switcher keeps its own screen: the stock body, not the clone.
  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 375, height: 700 });
  await page.getByTestId("mobile-switch").click();
  const switcher = page.getByTestId("mobile-switcher");
  await expect(switcher).toBeVisible({ timeout: 5000 });
  await expect(switcher.getByText("Projects", { exact: true })).toBeVisible();
  await expect(switcher.getByText("My projects", { exact: true })).toHaveCount(0);
  await expect(switcher.getByTestId("e2e-sidebar-open")).toHaveCount(0);
  await expect(switcher.getByTestId(`workspace-session-${a}`)).toBeVisible();
  await page.getByTestId("mobile-switcher-close").click();
  await expect(switcher).not.toBeVisible({ timeout: 5000 });
  await page.setViewportSize(desktop);

  // `use` back to stock: Perch's own sidebar returns, unchanged.
  expect(await modsSet(page, { id: "stock:sidebar", op: "use", target: "" })).toBeNull();
  await expect(page.locator('[data-testid="mod-view-stock:sidebar"]')).toBeAttached({ timeout: 15000 });
  expect(await sidebarWorks(page, "stock:sidebar", a, b)).toEqual(stockOrder);
  await expect(page.getByText("My projects", { exact: true })).toHaveCount(0);
});

/** A sidebar copy's own grouping, written into the copy as a person would: "By agent" lists the host's sessions as
 * agent → project → session (Perch's tree is project → workspace → session), pins first in each agent, sub-sessions
 * under their lead (`nestSessions`), arrows moving through the rows in this order, a Pin button on the shared
 * `terminal.pin` command, and each session still Perch's own row (`sessionRow`: its dot, state, menu, hold, close). */
const AGENT_GROUPS = `// By agent: agent -> project -> session, pins first, sub-sessions under their lead; Up/Down walk the rows.
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { nestSessions, runCommand, useTerminals } from "@perch/sdk";

export function AgentGroups({ sessions, row }) {
  const pinned = new Set(useTerminals().filter((record) => record.pinned).map((record) => record.sessionId));
  const box = useRef(null);
  const groups = new Map();
  for (const session of sessions) {
    const agent = session.provider || "terminal";
    groups.set(agent, [...(groups.get(agent) ?? []), session]);
  }
  const onKeyDown = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = [...box.current.querySelectorAll("[data-agent-row] > div > button:first-child")];
    const next = rows[rows.indexOf(document.activeElement) + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) { event.preventDefault(); next.focus(); }
  };
  return _jsx("div", { ref: box, "data-testid": "e2e-agent-view", onKeyDown, children: [...groups.keys()].sort().map((agent) => {
    const list = [...groups.get(agent)].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    const byProject = new Map();
    for (const session of list) byProject.set(session.projectName || "Other", [...(byProject.get(session.projectName || "Other") ?? []), session]);
    return _jsxs("div", { "data-testid": "e2e-agent-group-" + agent, children: [
      _jsx("div", { className: "px-3 pt-2 text-[12px] font-semibold text-fg", "data-testid": "e2e-agent-title", children: agent }),
      ...[...byProject].map(([project, rows]) => _jsxs("div", { "data-testid": "e2e-agent-project", "data-project": project, children: [
        _jsx("div", { className: "pl-5 text-[11px] text-subtext-0", children: project }),
        ...nestSessions(rows).map(({ session, nested }) => _jsxs("div", { className: "flex items-center", "data-agent-row": session.id, "data-pinned": pinned.has(session.id) ? "1" : undefined, children: [
          row(session, nested),
          _jsx("button", { type: "button", "data-testid": "e2e-agent-pin-" + session.id, onClick: () => runCommand("terminal.pin", { terminal: session.id, pinned: !pinned.has(session.id) }), children: pinned.has(session.id) ? "Unpin" : "Pin" }),
        ] }, session.id)),
      ] }, project)),
    ] }, agent);
  }) });
}
`;

test("a sidebar copy regroups the sessions by agent, then project, with pins first and its own key order, and every row stays Perch's own; stock is unchanged", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  // The config's storage shows terminals (Show terminals), so the project's shell is listed in every grouping.
  await page.goto("/", { waitUntil: "networkidle" });
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-regroup-")));
  const a = await startChat(page);
  const b = await startChat(page);
  const c = await startChat(page, "claude");
  // The approved cheap model, by its own banner; no prompt is ever sent.
  await expect(page.getByTestId("persistent-agent-terminal").locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
  const d = await startChat(page, "terminal", repo);
  const ours = [a, b, c, d];
  try {
    // An untouched copy in Perch's place is the same sidebar.
    const stockOrder = await sidebarWorks(page, "stock:sidebar", a, b);
    expect(await modsSet(page, { id: "stock:sidebar", op: "clone", as: "e2e-my-sidebar" })).toBeNull();
    await expect.poll(() => modsSet(page, { id: "stock:sidebar", op: "use", target: "e2e-my-sidebar" }), { timeout: 15000 }).toBeNull();
    const view = page.locator('[data-testid="mod-view-e2e-my-sidebar"]');
    await expect(view).toBeAttached({ timeout: 15000 });
    expect(await sidebarWorks(page, "e2e-my-sidebar", a, b)).toEqual(stockOrder);
    const shipped = await (await page.request.get("/stock-ui/sidebar/overview.js")).text();

    // The person's change: a new file and four edits to the copy's overview.js.
    const copy = path.join(HOME, "mods", "e2e-my-sidebar");
    fs.writeFileSync(path.join(copy, "agents.js"), AGENT_GROUPS);
    const overview = path.join(copy, "overview.js");
    let text = fs.readFileSync(overview, "utf8");
    for (const [from, to] of [
      ['from "./icons.js";', 'from "./icons.js";\nimport { AgentGroups } from "./agents.js";'],
      ['list: "In one list" };', 'list: "In one list", agent: "By agent" };'],
      ['saved === "status" || saved === "list" ? saved', 'saved === "status" || saved === "list" || saved === "agent" ? saved'],
      ['(organize === "list" ? listView : statusView)', '(organize === "agent" ? _jsx(AgentGroups, { sessions: nav.sessions, row: (session, nested) => sessionRow(session, [], "list", nested, "list") }) : organize === "list" ? listView : statusView)'],
    ]) {
      expect(text).toContain(from);
      text = text.replace(from, to);
    }
    fs.writeFileSync(overview, text);
    const list = view.getByTestId("workspace-overview");
    await expect(async () => {
      await list.getByTestId("workspace-organize").click();
      await expect(page.getByTestId("workspace-organize-agent")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.getByTestId("workspace-organize-agent").click();

    // The new hierarchy: agents, then the projects inside each, then the sessions; Perch's data on every row.
    const agents = view.getByTestId("e2e-agent-view");
    await expect(agents).toBeVisible({ timeout: 15000 });
    const claude = agents.getByTestId("e2e-agent-group-claude");
    const shells = agents.getByTestId("e2e-agent-group-terminal");
    await expect(claude.getByTestId(`workspace-session-${c}`)).toBeVisible({ timeout: 15000 });
    for (const id of [a, b, d]) await expect(shells.getByTestId(`workspace-session-${id}`)).toBeVisible();
    await expect(shells.locator(`[data-project="Quickchat"] [data-agent-row="${a}"]`)).toHaveCount(1);
    await expect(shells.locator(`[data-project="${path.basename(repo)}"] [data-agent-row="${d}"]`)).toHaveCount(1);
    // Each row keeps Perch's own status dot, which names the same agent the copy grouped it under.
    await expect(claude.locator(`[data-agent-row="${c}"] [data-provider]`)).toHaveAttribute("data-provider", "claude");
    for (const id of [a, b, d]) await expect(shells.locator(`[data-agent-row="${id}"] [data-provider]`)).toHaveAttribute("data-provider", "terminal");
    const shellOrder = () => shells.locator("[data-agent-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-agent-row")));

    // Rows still act through Perch: a click shows the session, a right-click and a touch hold open its menu.
    await shells.getByTestId(`workspace-session-${b}`).click();
    await expectActive(page, b);
    await shells.getByTestId(`workspace-session-${a}`).click();
    await expectActive(page, a);
    await shells.getByTestId(`workspace-session-${b}`).click({ button: "right" });
    await expect(page.getByTestId("tab-split-menu")).toBeVisible();
    await escapeUntilGone(page, "tab-split-menu");
    await holdRow(page, shells.getByTestId(`workspace-session-${b}`));
    await expect(page.getByTestId("tab-split-menu")).toBeVisible();
    await escapeUntilGone(page, "tab-split-menu");
    await expectActive(page, a);

    // The copy's own key order: Down walks the rows as grouped here (claude's, then each shell project's).
    const keyOrder = await agents.locator("[data-agent-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-agent-row")));
    expect(keyOrder[0]).toBe(c);
    // The session switch above hands the keyboard to its terminal a moment later: start again if that lands mid-walk.
    await expect(async () => {
      await agents.getByTestId(`workspace-session-${c}`).focus();
      for (const id of keyOrder.slice(1)) {
        await page.keyboard.press("ArrowDown");
        await expect(agents.getByTestId(`workspace-session-${id}`)).toBeFocused({ timeout: 1000 });
      }
    }).toPass({ timeout: 15000 });
    await page.keyboard.press("ArrowUp");
    await expect(agents.getByTestId(`workspace-session-${keyOrder[keyOrder.length - 2]}`)).toBeFocused();

    // Pins, through the shared command, put a session first in its agent and are what terminals() reports.
    const before = await shellOrder();
    const last = before[before.length - 1]!;
    await agents.getByTestId(`e2e-agent-pin-${last}`).click();
    // First in its agent (its project's block comes first with it); the same rows, none lost.
    await expect.poll(async () => (await shellOrder())[0]).toBe(last);
    expect([...(await shellOrder())].sort()).toEqual([...before].sort());
    await expect(shells.locator(`[data-agent-row="${last}"]`)).toHaveAttribute("data-pinned", "1");
    expect(await page.evaluate((id) => (JSON.parse(localStorage.getItem("perch.pinnedTerminals") ?? "[]") as string[]).includes(id), last)).toBe(true);
    await agents.getByTestId(`e2e-agent-pin-${last}`).click();
    await expect.poll(shellOrder).toEqual(before);

    // Perch's own sidebar never changed: its file is as shipped, and back in place it has no "By agent" and shows
    // its tree (the saved "agent" choice reads as the default there).
    expect(await (await page.request.get("/stock-ui/sidebar/overview.js")).text()).toBe(shipped);
    expect(await modsSet(page, { id: "stock:sidebar", op: "use", target: "" })).toBeNull();
    const stock = page.locator('[data-testid="mod-view-stock:sidebar"]');
    await expect(stock).toBeAttached({ timeout: 15000 });
    await expect(stock.getByTestId("e2e-agent-view")).toHaveCount(0);
    await stock.getByTestId("workspace-organize").click();
    await expect(page.getByTestId("workspace-organize-agent")).toHaveCount(0);
    await expect(page.getByTestId("workspace-organize-project")).toContainText("✓");
    await page.keyboard.press("Escape");
  } finally {
    await deleteSessions(page, [c, d]);
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

/** A Git repository with one committed file changed in the worktree, as a new project; returns its workspace id. */
async function reviewProject(page: Page): Promise<{ workspaceId: string; root: string }> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-e2e-stock-review-")));
  const git = (args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root, stdio: "pipe", input: "", timeout: 15000,
    env: { ...process.env, GIT_AUTHOR_NAME: "perch e2e", GIT_AUTHOR_EMAIL: "e2e@perch.test", GIT_COMMITTER_NAME: "perch e2e", GIT_COMMITTER_EMAIL: "e2e@perch.test" },
  });
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "main.txt"), "HEAD_ANCHOR\n");
  git(["init", "-q", "-b", "main"]);
  git(["add", "src/main.txt"]);
  git(["commit", "-q", "-m", "initial"]);
  fs.writeFileSync(path.join(root, "src", "main.txt"), "WORKTREE_ANCHOR\n");
  const name = `Stock review ${path.basename(root).slice(-6)}`;
  const emptyAdd = page.getByTestId("workspace-empty-add");
  if (await emptyAdd.count()) await emptyAdd.click();
  else await page.getByTestId("workspace-add-project").click();
  const form = page.getByTestId("workspace-add-form");
  await form.getByTestId("dir-browser-mode-toggle").click();
  await form.getByTestId("project-path-input").fill(root);
  await page.getByTestId("workspace-project-name").fill(name);
  await form.getByTestId("dir-browser-use").click();
  const project = page.locator(".workspace-project").filter({ hasText: name });
  await expect(project).toBeVisible({ timeout: 15000 });
  return { workspaceId: await firstWorkspaceId(project), root };
}

/** The review, whoever's copy is showing: one review in `owner`'s view, the changed file and its worktree line, and a
 * line comment that the core keeps (created through the rendered composer). Returns the changed files' list. */
async function reviewWorks(page: Page, owner: string, body: string): Promise<string[]> {
  const view = page.locator(`[data-testid="mod-view-${owner}"]`);
  await expect(view.getByTestId("workspace-git-review")).toHaveCount(1, { timeout: 20000 });
  await expect(page.getByTestId("workspace-git-review")).toHaveCount(1);
  await expect(view.getByTestId("git-status")).toBeVisible();
  const line = view.locator('[data-testid="git-diff-line"][data-side="new"]').filter({ hasText: "WORKTREE_ANCHOR" }).first();
  await expect(line).toBeVisible({ timeout: 15000 });
  await line.getByTestId("git-comment-add").click();
  await view.getByTestId("git-comment-body").fill(body);
  await view.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(view.locator(".workspace-git__comment").filter({ hasText: body }).first()).toBeVisible({ timeout: 15000 });
  return view.locator(".workspace-git__path-button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title") ?? ""));
}

test("the review runs from its stock package; a clone in its place shows the same review, keeps the unsent commit message, a deep edit changes only the clone, and the phone keeps its own", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  try {
    await openWorkspaceTool(page, workspaceId, "gitReview");

    // Stock, from the build's package, on the SDK alone.
    await expect(page.locator('[data-testid="mod-view-stock:review"]')).toBeAttached({ timeout: 15000 });
    const stockFiles = await reviewWorks(page, "stock:review", "stock note");
    expect(stockFiles).toEqual(["src/main.txt"]);
    const files = ["main", "review"];
    const shipped = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await (await page.request.get(`/stock-ui/review/${file}.js`)).text()] as const)));
    for (const text of Object.values(shipped)) {
      expect(text).toContain('from "@perch/sdk"');
      expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|gitReviewStore|contextBridge|components|ids)/);
    }

    // An unsent commit message, typed in the stock copy.
    const commit = (owner: string) => page.locator(`[data-testid="mod-view-${owner}"] input[placeholder="Describe the change"]`);
    await commit("stock:review").fill("Fix the anchor, not yet sent");

    // The untouched clone, chosen in its place, shows the same review and the same unsent message.
    expect(await modsSet(page, { id: "stock:review", op: "clone", as: "e2e-my-review" })).toBeNull();
    await expect.poll(() => modsSet(page, { id: "stock:review", op: "use", target: "e2e-my-review" }), { timeout: 15000 }).toBeNull();
    await expect(page.locator('[data-testid="mod-view-e2e-my-review"]')).toBeAttached({ timeout: 15000 });
    await expect(page.locator('[data-testid="mod-view-stock:review"]')).toHaveCount(0);
    await expect(commit("e2e-my-review")).toHaveValue("Fix the anchor, not yet sent");
    expect(await reviewWorks(page, "e2e-my-review", "clone note")).toEqual(stockFiles);

    // Deep edits: the clone's entry puts a summary above the review from the same shared data, and its commit field
    // asks differently. Stock's files are untouched.
    const edit = (file: string, from: string, to: string) => {
      const at = path.join(HOME, "mods", "e2e-my-review", file);
      const text = fs.readFileSync(at, "utf8");
      expect(text).toContain(from);
      fs.writeFileSync(at, text.replace(from, to));
    };
    edit("review.js", 'placeholder: "Describe the change"', 'placeholder: "Say what changed"');
    edit("main.js", "    return (_jsx(WorkspaceGitReview, {", '    return _jsx("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", children: [_jsx("p", { "data-testid": "e2e-review-summary", children: `${review.comments.length} notes on ${review.status?.entries.length ?? 0} changed` }, "summary"), _jsx(WorkspaceGitReview, {');
    edit("main.js", "        onAskAgent: review.askAgent\n    }));\n}", "        onAskAgent: review.askAgent\n    }, \"review\")] });\n}");
    const clone = page.locator('[data-testid="mod-view-e2e-my-review"]');
    await expect(clone.getByTestId("e2e-review-summary")).toHaveText(/^\d+ notes on 1 changed$/, { timeout: 15000 });
    await expect(clone.locator('input[placeholder="Say what changed"]')).toHaveValue("Fix the anchor, not yet sent");
    for (const file of files) expect(await (await page.request.get(`/stock-ui/review/${file}.js`)).text()).toBe(shipped[file]);

    // The phone keeps its own review: the stock source, not the clone.
    const desktop = page.viewportSize()!;
    await page.setViewportSize({ width: 375, height: 700 });
    await page.getByTestId("mobile-tools").click();
    await page.getByTestId("mobile-pane-git").click();
    const phone = page.getByTestId("mobile-pane-shell");
    await expect(phone.getByTestId("workspace-git-review")).toBeVisible({ timeout: 15000 });
    await expect(phone.getByTestId("e2e-review-summary")).toHaveCount(0);
    await expect(phone.locator('input[placeholder="Describe the change"]')).toHaveValue("Fix the anchor, not yet sent");
    await page.setViewportSize(desktop);

    // `use` back to stock: Perch's own review returns, unchanged, with the same unsent message.
    expect(await modsSet(page, { id: "stock:review", op: "use", target: "" })).toBeNull();
    await expect(page.locator('[data-testid="mod-view-stock:review"]')).toBeAttached({ timeout: 15000 });
    await expect(page.getByTestId("e2e-review-summary")).toHaveCount(0);
    await expect(commit("stock:review")).toHaveValue("Fix the anchor, not yet sent");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** The files surface, whoever's copy is showing: the explorer in `owner`'s view lists `src/main.txt`, and the file's
 * editor (a file tab, also `owner`'s) shows `doc`. */
async function filesWork(page: Page, owner: string, doc: string) {
  const views = page.locator(`[data-testid="mod-view-${owner}"]`);
  const explorer = views.filter({ has: page.locator("[aria-label$='file tree']") }).first();
  await expect(explorer.getByTestId("workspace-file-entry-src")).toBeVisible({ timeout: 20000 });
  if (!(await explorer.getByTestId("workspace-file-entry-src/main.txt").count())) await explorer.getByTestId("workspace-file-entry-src").click();
  await explorer.getByTestId("workspace-file-entry-src/main.txt").click();
  const editor = views.getByTestId("workspace-file-editor");
  await expect(editor).toHaveCount(1, { timeout: 15000 });
  await expectDoc(editor, doc, { timeout: 15000 });
  await expect(page.getByTestId("workspace-file-editor")).toHaveCount(1);
  return editor;
}

test("the files surface runs from its stock package; a clone in its place opens the same files, keeps an unsaved draft, a deep edit changes only the clone, and the phone keeps its own", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  try {
    await openWorkspaceTool(page, workspaceId, "files");

    // Stock, from the build's package, on the SDK alone: the drawer's explorer and the file tab's editor.
    const editor = await filesWork(page, "stock:files", "WORKTREE_ANCHOR\n");
    const files = ["main", "files", "explorerNav"];
    const shipped = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await (await page.request.get(`/stock-ui/files/${file}.js`)).text()] as const)));
    expect(shipped.files).toContain('from "@perch/sdk"');
    for (const text of Object.values(shipped)) expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|filesystemStore|fileTabs|components|markdown)/);

    // An unsaved draft, typed in the stock editor.
    await editor.fill("UNSAVED_DRAFT\n");
    await expectDoc(editor, "UNSAVED_DRAFT\n");

    // The untouched clone, chosen in its place, lists and opens the same files, and shows the same unsaved draft.
    expect(await modsSet(page, { id: "stock:files", op: "clone", as: "e2e-my-files" })).toBeNull();
    await expect.poll(() => modsSet(page, { id: "stock:files", op: "use", target: "e2e-my-files" }), { timeout: 15000 }).toBeNull();
    await expect(page.locator('[data-testid="mod-view-e2e-my-files"]')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('[data-testid="mod-view-stock:files"]')).toHaveCount(0);
    await filesWork(page, "e2e-my-files", "UNSAVED_DRAFT\n");

    // A deep edit (not the entry file): the clone's explorer names its tree differently. Stock's files are untouched.
    const at = path.join(HOME, "mods", "e2e-my-files", "files.js");
    const text = fs.readFileSync(at, "utf8");
    expect(text).toContain('"aria-label": "Workspace file tree"');
    fs.writeFileSync(at, text.replace('"aria-label": "Workspace file tree"', '"aria-label": "My file tree"'));
    const clone = page.locator('[data-testid="mod-view-e2e-my-files"]');
    await expect(clone.getByLabel("My file tree", { exact: true })).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByLabel("Workspace file tree", { exact: true })).toHaveCount(0);
    await expectDoc(page.getByTestId("workspace-file-editor"), "UNSAVED_DRAFT\n");
    for (const file of files) expect(await (await page.request.get(`/stock-ui/files/${file}.js`)).text()).toBe(shipped[file]);

    // The phone keeps its own files pane: the stock source, not the clone.
    const desktop = page.viewportSize()!;
    await page.setViewportSize({ width: 375, height: 700 });
    await page.getByTestId("mobile-tools").click();
    await expect(page.getByTestId("mobile-active-pane-files")).toBeVisible({ timeout: 10000 });
    // It opens on the tree, which is the stock one; the file opens as a sheet with the same draft.
    await expect(page.getByLabel("Workspace file tree", { exact: true })).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByTestId("mobile-file-sheet")).toHaveCount(0);
    await page.getByTestId("workspace-file-entry-src/main.txt").click();
    await expectDoc(page.getByTestId("workspace-file-editor"), "UNSAVED_DRAFT\n", { timeout: 15000 });
    await page.getByTestId("mobile-files-back").click();
    await expect(page.getByTestId("mobile-file-sheet")).toHaveCount(0);
    await expect(page.getByLabel("Workspace file tree", { exact: true })).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByLabel("My file tree", { exact: true })).toHaveCount(0);
    await page.setViewportSize(desktop);

    // `use` back to stock: Perch's own files surface returns, unchanged, with the same unsaved draft.
    expect(await modsSet(page, { id: "stock:files", op: "use", target: "" })).toBeNull();
    await expect(page.locator('[data-testid="mod-view-e2e-my-files"]')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByLabel("My file tree", { exact: true })).toHaveCount(0);
    // The phone's back closed the open file; its tab is still there and opens on the same draft.
    await page.getByTestId("file-tab-src/main.txt").click({ timeout: 15000 });
    await expect(page.locator('[data-testid="mod-view-stock:files"]').getByTestId("workspace-file-editor")).toHaveCount(1, { timeout: 15000 });
    await expectDoc(page.getByTestId("workspace-file-editor"), "UNSAVED_DRAFT\n", { timeout: 15000 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** The terminal elements on the page (each `KeptTerminal` has one host), and the text of the one in `scope`. */
const terminalHosts = (page: Page) => page.locator(".terminal__host");
const screenText = (scope: ReturnType<Page["locator"]>) => scope.locator(".xterm-rows").innerText();

test("a live terminal moves into a peek and a package's Layout and back: the same process and input owner, never a second copy, and closing stops nothing", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  const canvas = page.locator(`.dock-area [data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
  const terminalId = await canvas.getAttribute("data-terminal-id");
  expect(terminalId).toBeTruthy();
  await canvas.locator(".xterm").click();
  await page.keyboard.type("echo BEFORE_$((20+1))\n");
  await expect.poll(() => screenText(canvas), { timeout: 15000 }).toContain("BEFORE_21");
  await expect(terminalHosts(page)).toHaveCount(1);

  // A package that peeks the session and composes it beside its own text, through the SDK only.
  write("mod.json", JSON.stringify({ name: "Compose", format: "esm", api: "^1.5" }));
  write("main.js", [
    'import { useState } from "react";',
    'import { jsx, jsxs } from "react/jsx-runtime";',
    'import { Layout, runCommand } from "@perch/sdk";',
    "export default function Compose({ session }) {",
    "  const [shown, setShown] = useState(false);",
    '  return jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [',
    '    jsx("button", { "data-testid": "compose-peek", onClick: () => runCommand("terminal.peek", { id: session }), children: "peek" }),',
    '    jsx("button", { "data-testid": "compose-toggle", onClick: () => setShown(!shown), children: "compose" }),',
    '    shown && jsx("div", { "data-testid": "compose-area", style: { flex: 1, minHeight: 200, display: "flex" }, children: jsx(Layout, { node: { type: "row", children: [',
    '      { type: "block", content: "session:" + session },',
    "    ] } }) }),",
    "  ] });",
    "}",
  ].join("\n"));
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E compose", type: "row", children: [
    { type: "block", content: "canvas" },
    { type: "block", content: "mod:e2e-esm", props: { session: sessionId }, size: { px: 420 } },
  ] }));
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  await expect(block(page).getByTestId("compose-peek")).toBeVisible({ timeout: 15000 });

  // Peek: the same terminal over the app, with its history; typing reaches the same shell.
  await block(page).getByTestId("compose-peek").click();
  const peek = page.getByTestId("mod-api-overlay-terminal-peek");
  const peeked = peek.locator(`[data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
  await expect(peeked.locator(".terminal__host")).toHaveCount(1, { timeout: 15000 });
  await expect(terminalHosts(page)).toHaveCount(1);
  await expect(peeked).toHaveAttribute("data-terminal-id", terminalId!);
  await expect.poll(() => screenText(peeked)).toContain("BEFORE_21");
  await peeked.locator(".xterm").click();
  await page.keyboard.type("echo PEEK_$((40+2))\n");
  await expect.poll(() => screenText(peeked), { timeout: 15000 }).toContain("PEEK_42");
  // Esc is the shell's while the terminal has the keyboard; a click outside puts the peek away.
  await peek.click({ position: { x: 4, y: 4 } });
  await expect(peek).toHaveCount(0);
  await expect(canvas.locator(".terminal__host")).toHaveCount(1);
  await expect(terminalHosts(page)).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-terminal-id", terminalId!);
  await expect.poll(() => screenText(canvas)).toContain("PEEK_42");

  // The package's Layout: the terminal sits beside the package's own buttons, then goes back when it unmounts.
  await block(page).getByTestId("compose-toggle").click();
  const composed = block(page).locator(`[data-testid="compose-area"] [data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
  await expect(composed.locator(".terminal__host")).toHaveCount(1, { timeout: 15000 });
  await expect(terminalHosts(page)).toHaveCount(1);
  await composed.locator(".xterm").click();
  await page.keyboard.type("echo LAYOUT_$((50+5))\n");
  await expect.poll(() => screenText(composed), { timeout: 15000 }).toContain("LAYOUT_55");
  await block(page).getByTestId("compose-toggle").click();
  await expect(canvas.locator(".terminal__host")).toHaveCount(1, { timeout: 15000 });
  await expect(terminalHosts(page)).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-terminal-id", terminalId!);
  await canvas.locator(".xterm").click();
  await page.keyboard.type("echo AFTER_$((60+6))\n");
  await expect.poll(() => screenText(canvas), { timeout: 15000 }).toContain("AFTER_66");
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

test("the drawer's browser runs from its stock package; a clone in its place shows the same pages, and an edit changes only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  try {
    await page.locator(`[data-testid="workspace-entry-${workspaceId}"] .workspace-entry__button`).first().click();
    if (!(await page.getByTestId("workspace-tools").count())) await page.getByTestId("workspace-tools-toggle").click();
    await page.getByTestId("workspace-tools-browser").click();
    const strip = (owner: string) => page.locator(`[data-testid="mod-view-${owner}"] [data-testid="drawer-browser"]`);

    // Stock, from the build's package, on the SDK alone: two pages opened through Perch's store.
    await expect(strip("stock:browser")).toBeVisible({ timeout: 15000 });
    const shipped = await (await page.request.get("/stock-ui/browser/main.js")).text();
    expect(shipped).toContain('from "@perch/sdk"');
    expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|drawerBrowsers|browserNative|components)/);
    await strip("stock:browser").getByTestId("drawer-browser-open").click();
    await strip("stock:browser").getByTestId("drawer-browser-new").click();
    await expect(strip("stock:browser").getByTestId("drawer-browser-page")).toHaveText(["New page", "New page"]);

    // The untouched clone, chosen in its place, shows the same pages.
    expect(await modsSet(page, { id: "stock:browser", op: "clone", as: "e2e-my-browser" })).toBeNull();
    await expect.poll(() => modsSet(page, { id: "stock:browser", op: "use", target: "e2e-my-browser" }), { timeout: 15000 }).toBeNull();
    await expect(strip("e2e-my-browser").getByTestId("drawer-browser-page")).toHaveText(["New page", "New page"], { timeout: 15000 });
    await expect(page.locator('[data-testid="mod-view-stock:browser"]')).toHaveCount(0);

    // An edit to the clone names an empty page differently; closing a page from it closes Perch's page.
    const at = path.join(HOME, "mods", "e2e-my-browser", "main.js");
    const text = fs.readFileSync(at, "utf8");
    expect(text).toContain(': "New page")');
    fs.writeFileSync(at, text.replace(': "New page")', ': "Blank page")'));
    await expect(strip("e2e-my-browser").getByTestId("drawer-browser-page")).toHaveText(["Blank page", "Blank page"], { timeout: 15000 });
    await strip("e2e-my-browser").getByTestId("drawer-browser-page-close").first().click();
    await expect(strip("e2e-my-browser").getByTestId("drawer-browser-page")).toHaveCount(1);
    expect(await (await page.request.get("/stock-ui/browser/main.js")).text()).toBe(shipped);

    // `use` back to stock: Perch's own strip, unchanged, with the page that is left.
    expect(await modsSet(page, { id: "stock:browser", op: "use", target: "" })).toBeNull();
    await expect(strip("stock:browser").getByTestId("drawer-browser-page")).toHaveText(["New page"], { timeout: 15000 });
    await strip("stock:browser").getByTestId("drawer-browser-close-all").click();
    await expect(strip("stock:browser").getByTestId("drawer-browser-page")).toHaveCount(0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** The confirmation and a notification, opened by a package through the SDK, whoever's copy is showing: one dialog with
 * the caller's words, Escape and a click outside cancel, the confirm button confirms; one notification card that its
 * close button dismisses. */
async function confirmAndToastWork(page: Page, cancel: string, dismiss: string, clones: boolean) {
  const answer = block(page).getByTestId("esm-answer");
  const dialog = page.getByTestId("confirm-dialog");
  await block(page).getByTestId("esm-ask").click();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog).toHaveCount(1);
  await expect(dialog.locator(".confirm-dialog__message")).toHaveText("Really?");
  await expect(dialog.getByTestId("confirm-accept")).toHaveText("Yes");
  await expect(dialog.getByTestId("confirm-cancel")).toHaveText(cancel);
  await expect(dialog.getByTestId("confirm-accept")).toBeFocused();
  await expect(page.locator('[data-testid="mod-view-e2e-my-confirm"]')).toHaveCount(clones ? 1 : 0);
  await page.keyboard.press("Escape");
  await expect(answer).toHaveText("no:1");
  await expect(dialog).toHaveCount(0);
  await block(page).getByTestId("esm-ask").click();
  await dialog.getByTestId("confirm-accept").click();
  await expect(answer).toHaveText("yes:2");
  await block(page).getByTestId("esm-ask").click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(answer).toHaveText("no:3");
  await expect(dialog).toHaveCount(0);

  await block(page).getByTestId("esm-note").click();
  const card = page.getByTestId("toast-mod:e2e-esm");
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await expect(card).toContainText("E2E note");
  await expect(card).toContainText("from a mod");
  await expect(page.locator('[data-testid="mod-view-e2e-my-toast"] [data-testid="toast"]')).toHaveCount(clones ? 1 : 0);
  await expect(page.getByTestId("toast-dismiss-mod:e2e-esm")).toHaveAttribute("aria-label", dismiss);
  await page.getByTestId("toast-dismiss-mod:e2e-esm").click();
  await expect(card).toHaveCount(0);
}

test("the confirmation and the notifications run from their stock packages; an untouched clone in their place behaves the same, and an edit changes only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  write("mod.json", JSON.stringify({ name: "ESM", format: "esm", api: "^1.6" }));
  write("main.js", [
    'import { useState } from "react";',
    'import { jsx, jsxs } from "react/jsx-runtime";',
    'import { ConfirmDialog } from "@perch/sdk";',
    "export default function Panel({ api }) {",
    "  const [asking, setAsking] = useState(false);",
    '  const [answer, setAnswer] = useState({ text: "none", n: 0 });',
    "  const end = (text) => { setAsking(false); setAnswer((a) => ({ text, n: a.n + 1 })); };",
    '  return jsxs("div", { children: [',
    '    jsx("button", { "data-testid": "esm-ask", onClick: () => setAsking(true), children: "ask" }),',
    '    jsx("button", { "data-testid": "esm-note", onClick: () => api.notify({ title: "E2E note", body: "from a mod", timeout: 60000 }), children: "note" }),',
    '    jsx("span", { "data-testid": "esm-answer", children: answer.text + ":" + answer.n }),',
    '    asking ? jsx(ConfirmDialog, { message: "Really?", confirmLabel: "Yes", onConfirm: () => end("yes"), onCancel: () => end("no") }) : null,',
    "  ] });",
    "}",
  ].join("\n"));
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({
    name: "E2E ESM", type: "row",
    children: [{ type: "block", content: "canvas" }, { type: "block", content: "mod:e2e-esm", size: { px: 200 } }],
  }));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  await expect(block(page).getByTestId("esm-answer")).toHaveText("none:0", { timeout: 15000 });

  // Stock: Perch's own dialog and card, compiled from the same source as the exported packages.
  for (const name of ["confirm", "toast"]) {
    const shipped = await (await page.request.get(`/stock-ui/${name}/main.js`)).text();
    expect(shipped).toContain('from "@perch/sdk"');
    expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|components|sdk)/);
  }
  await confirmAndToastWork(page, "Cancel", "Dismiss notification", false);

  // Untouched clones, chosen in their place, behave the same and are the ones drawing.
  for (const name of ["confirm", "toast"]) {
    expect(await modsSet(page, { id: `stock:${name}`, op: "clone", as: `e2e-my-${name}` })).toBeNull();
    await expect.poll(() => modsSet(page, { id: `stock:${name}`, op: "use", target: `e2e-my-${name}` }), { timeout: 15000 }).toBeNull();
  }
  await page.reload({ waitUntil: "networkidle" });
  await expect(block(page).getByTestId("esm-answer")).toHaveText("none:0", { timeout: 15000 });
  await expect(page.locator('[data-testid="mod-view-e2e-my-toast"]')).toBeAttached({ timeout: 15000 });
  await confirmAndToastWork(page, "Cancel", "Dismiss notification", true);

  // Edits to the clones' own files change the clones; stock packages stay as shipped.
  const edit = (id: string, from: string, to: string) => {
    const at = path.join(HOME, "mods", id, "main.js");
    const text = fs.readFileSync(at, "utf8");
    expect(text).toContain(from);
    fs.writeFileSync(at, text.replace(from, to));
  };
  edit("e2e-my-confirm", 'cancelLabel = "Cancel"', 'cancelLabel = "Keep"');
  edit("e2e-my-toast", '"aria-label": "Dismiss notification"', '"aria-label": "Close note"');
  await page.reload({ waitUntil: "networkidle" });
  await expect(block(page).getByTestId("esm-answer")).toHaveText("none:0", { timeout: 15000 });
  await confirmAndToastWork(page, "Keep", "Close note", true);

  // Back to Perch's own: as shipped.
  for (const name of ["confirm", "toast"]) expect(await modsSet(page, { id: `stock:${name}`, op: "use", target: "" })).toBeNull();
  await page.reload({ waitUntil: "networkidle" });
  await expect(block(page).getByTestId("esm-answer")).toHaveText("none:0", { timeout: 15000 });
  await confirmAndToastWork(page, "Cancel", "Dismiss notification", false);
  expect(await (await page.request.get("/stock-ui/confirm/main.js")).text()).toContain('cancelLabel = "Cancel"');
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

/** A stock screen opened where Perch opens it. `root` is the test id of the element the edit marks; `open` shows it,
 * `close` puts it away again. */
interface Surface { name: string; root: string; open: (page: Page) => Promise<void>; close: (page: Page) => Promise<void> }

/** Press Escape until `gone` has left: a menu listens for the key once its effect has run. */
const escapeUntilGone = async (page: Page, gone: string) => expect(async () => {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(gone)).toHaveCount(0, { timeout: 500 });
}).toPass({ timeout: 10000 });

/** Mark the element whose test id is the JS expression `testId` in a package's own `file` (`data-e2e-copy="edited"`). */
function markRoot(id: string, testId: string, attribute = "data-e2e-copy", file = "main.js") {
  const at = path.join(HOME, "mods", id, file);
  const text = fs.readFileSync(at, "utf8");
  const from = `"data-testid": ${testId}`;
  expect(text).toContain(from);
  fs.writeFileSync(at, text.replace(from, `${from}, "${attribute}": "edited"`));
}

/** Whoever's copy is showing: `surface` opens once, as the copy of `owner` (a clone id, or stock), carries the edit
 * mark only when `edited`, and closes. */
async function surfaceWorks(page: Page, surface: Surface, owner: "stock" | "clone", edited: boolean) {
  await surface.open(page);
  const shown = page.getByTestId(surface.root);
  await expect(shown).toBeVisible({ timeout: 15000 });
  await expect(shown).toHaveCount(1);
  const view = page.locator(`[data-testid="mod-view-e2e-my-${surface.name}"]`);
  if (owner === "clone") await expect(view.first()).toBeAttached({ timeout: 15000 });
  else await expect(view).toHaveCount(0);
  if (edited) await expect(shown).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  else await expect(shown).not.toHaveAttribute("data-e2e-copy");
  await surface.close(page);
  await expect(shown).toHaveCount(0, { timeout: 10000 });
}

/** Clone `stock:<name>` as `e2e-my-<name>` and choose it in stock's place. */
async function cloneInPlace(page: Page, names: string[]) {
  for (const name of names) {
    expect(await modsSet(page, { id: `stock:${name}`, op: "clone", as: `e2e-my-${name}` })).toBeNull();
    await expect.poll(() => modsSet(page, { id: `stock:${name}`, op: "use", target: `e2e-my-${name}` }), { timeout: 15000 }).toBeNull();
  }
}

test("the menus, pickers, launcher, Navigator, folder browser, onboarding and tab drag run from stock packages; untouched clones behave the same, and edits change only the clones", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const a = await startChat(page);
  const b = await startChat(page);
  const surfaces: Surface[] = [
    { name: "tab-menu", root: "tab-split-menu", open: (p) => p.getByTestId(`tab-${b}`).click({ button: "right" }), close: (p) => escapeUntilGone(p, "tab-split-menu") },
    { name: "new-session", root: "new-tab-filter", open: (p) => p.getByTestId("tab-new").click(), close: (p) => escapeUntilGone(p, "new-tab-filter") },
    { name: "launcher", root: "new-session-dialog", open: (p) => p.getByTestId("new-session-local").click(), close: (p) => escapeUntilGone(p, "new-session-dialog") },
    {
      name: "navigator", root: "navigator",
      open: async (p) => { await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await p.keyboard.press("Meta+p"); await expect(p.getByTestId(`navigator-row-${a}`)).toBeVisible({ timeout: 15000 }); },
      close: (p) => escapeUntilGone(p, "navigator"),
    },
    { name: "folder-browser", root: "dir-browser", open: (p) => p.getByTestId("workspace-add-project").click(), close: (p) => escapeUntilGone(p, "workspace-add-form") },
    {
      name: "onboarding", root: "onboarding",
      open: async (p) => { await p.evaluate(() => localStorage.removeItem("perch.onboarding.seen")); await p.reload({ waitUntil: "networkidle" }); },
      close: (p) => p.getByTestId("onboarding-dismiss").click(),
    },
    {
      name: "tab-drag", root: "tab-drag-layer",
      open: async (p) => {
        const box = (await p.getByTestId(`tab-${a}`).boundingBox())!;
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        for (let step = 1; step <= 6; step++) await p.mouse.move(box.x + box.width / 2 + step * 8, box.y + box.height / 2 + step * 12);
      },
      close: async (p) => {
        await p.keyboard.press("Escape");
        await p.mouse.up();
      },
    },
  ];
  const names = surfaces.map((surface) => surface.name);
  const shipped = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await (await page.request.get(`/stock-ui/${name}/main.js`)).text()] as const)));
  for (const text of Object.values(shipped)) {
    expect(text).toContain('from "@perch/sdk"');
    expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds|components|sdk|contextBridge|fileOps)/);
  }

  // Stock: Perch's own screens, from the same sources as the exported packages.
  for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);

  // Untouched clones, chosen in their place, behave the same and are the ones drawing.
  await cloneInPlace(page, names);
  await page.reload({ waitUntil: "networkidle" });
  for (const surface of surfaces) await surfaceWorks(page, surface, "clone", false);

  // An edit to each clone's own file shows in the clone only; stock's files stay as shipped.
  for (const surface of surfaces) markRoot(`e2e-my-${surface.name}`, JSON.stringify(surface.root));
  await page.reload({ waitUntil: "networkidle" });
  for (const surface of surfaces) await surfaceWorks(page, surface, "clone", true);
  for (const name of names) expect(await (await page.request.get(`/stock-ui/${name}/main.js`)).text()).toBe(shipped[name]);

  // Back to Perch's own: as shipped.
  for (const name of names) expect(await modsSet(page, { id: `stock:${name}`, op: "use", target: "" })).toBeNull();
  await page.reload({ waitUntil: "networkidle" });
  for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);
});

test("Instructions, Memory, the worktree form and the file menu run from stock packages; a cloned dialog shell or dropdown is used inside stock and cloned parents alike, and edits change only the clones", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  const name = `Stock review ${path.basename(root).slice(-6)}`;
  try {
    const projectMenu = async (p: Page, item: string) => {
      const row = p.locator('[data-testid^="workspace-project-"]', { hasText: name }).first();
      await row.hover();
      await row.click({ button: "right" });
      await p.locator(`[data-testid^="workspace-project-${item}-"]`).first().click();
    };
    const worktreeButton = (p: Page) => p.getByTestId(`worktree-menu-local-${root}`).first();
    const surfaces: Surface[] = [
      {
        name: "instructions", root: "instructions-text",
        open: (p) => projectMenu(p, "instructions"),
        close: (p) => p.getByTestId("instructions-dialog").getByRole("button", { name: "Cancel", exact: true }).click(),
      },
      {
        name: "memory", root: "memory-new",
        open: (p) => projectMenu(p, "memory"),
        close: (p) => p.getByTestId("memory-dialog").getByRole("button", { name: "Close", exact: true }).click(),
      },
      {
        name: "worktree", root: "worktree-branch-input",
        open: async (p) => {
          await expect(worktreeButton(p)).toBeVisible({ timeout: 30000 });
          await worktreeButton(p).click();
          const fresh = p.getByTestId("worktree-new");
          await expect(fresh.or(p.getByTestId("worktree-branch-input"))).toBeVisible({ timeout: 10000 });
          if (await fresh.isVisible()) await fresh.click();
        },
        close: async (p) => { await worktreeButton(p).click(); },
      },
      {
        name: "file-menu", root: "file-entry-menu",
        open: async (p) => {
          await openWorkspaceTool(p, workspaceId, "files");
          const entry = p.getByTestId("workspace-file-entry-src").first();
          await expect(entry).toBeVisible({ timeout: 20000 });
          await entry.click({ button: "right" });
        },
        close: (p) => escapeUntilGone(p, "file-entry-menu"),
      },
    ];
    // Where the dialog shell and the dropdown show: the shell around Instructions and Memory, the dropdown in the
    // worktree form.
    const nestedWork = async (p: Page, marked: boolean) => {
      await projectMenu(p, "instructions");
      const shell = p.getByTestId("instructions-dialog");
      await expect(shell).toBeVisible({ timeout: 15000 });
      if (marked) await expect(shell).toHaveAttribute("data-e2e-shell", "edited");
      else await expect(shell).not.toHaveAttribute("data-e2e-shell");
      await shell.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(shell).toHaveCount(0);
      await surfaces[2].open(p);
      const select = p.getByTestId("worktree-agent-select");
      await expect(select).toBeVisible({ timeout: 15000 });
      if (marked) await expect(select).toHaveAttribute("data-e2e-select", "edited");
      else await expect(select).not.toHaveAttribute("data-e2e-select");
      await surfaces[2].close(p);
      await expect(select).toHaveCount(0);
    };
    const names = [...surfaces.map((surface) => surface.name), "dialog", "select"];
    const shipped = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await (await page.request.get(`/stock-ui/${n}/main.js`)).text()] as const)));
    for (const [n, text] of Object.entries(shipped)) {
      if (n !== "dialog") expect(text).toContain('from "@perch/sdk"');
      expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds|components|sdk|contextBridge|fileOps|instructions|memory)/);
    }

    // Stock.
    for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);
    await nestedWork(page, false);

    // A clone of the shell and of the dropdown, each edited, chosen in their place: the stock parents use them.
    await cloneInPlace(page, ["dialog", "select"]);
    markRoot("e2e-my-dialog", "testId", "data-e2e-shell");
    markRoot("e2e-my-select", "testId", "data-e2e-select");
    await page.reload({ waitUntil: "networkidle" });
    await nestedWork(page, true);
    for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);

    // Untouched clones of the parents behave the same, and use the person's shell and dropdown too.
    await cloneInPlace(page, surfaces.map((surface) => surface.name));
    await page.reload({ waitUntil: "networkidle" });
    for (const surface of surfaces) await surfaceWorks(page, surface, "clone", false);
    await nestedWork(page, true);

    // Edits to the parents' own files show in the clones only; stock's files stay as shipped.
    for (const surface of surfaces) markRoot(`e2e-my-${surface.name}`, JSON.stringify(surface.root));
    await page.reload({ waitUntil: "networkidle" });
    for (const surface of surfaces) await surfaceWorks(page, surface, "clone", true);
    for (const n of names) expect(await (await page.request.get(`/stock-ui/${n}/main.js`)).text()).toBe(shipped[n]);

    // Back to Perch's own, all of them: as shipped.
    for (const n of names) expect(await modsSet(page, { id: `stock:${n}`, op: "use", target: "" })).toBeNull();
    await page.reload({ waitUntil: "networkidle" });
    for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);
    await nestedWork(page, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Settings > Mods never runs the person's copy, and on a phone it puts Perch's own screen back", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  // The person's dropdown, marked, chosen for every dropdown in Perch.
  await cloneInPlace(page, ["select"]);
  markRoot("e2e-my-select", "testId", "data-e2e-select");
  await page.reload({ waitUntil: "networkidle" });
  const settings = async (section: string) => {
    if (!(await page.getByTestId("settings-modal").count())) await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 10000 });
    if (await page.getByTestId("settings-back").isVisible()) await page.getByTestId("settings-back").click();
    await page.getByTestId(`settings-nav-${section}`).click();
  };
  const use = page.getByTestId("screen-stock:select-use");
  const status = page.getByTestId("screen-stock:select-status");

  // Desktop: Settings' other dropdowns are the copy; the screen chooser is Perch's own.
  await settings("appearance");
  await expect(page.getByTestId("settings-chat-text-size")).toHaveAttribute("data-e2e-select", "edited", { timeout: 15000 });
  await settings("mods");
  await expect(use).toBeVisible({ timeout: 15000 });
  await expect(use).not.toHaveAttribute("data-e2e-select");
  await expect(status).toContainText("Showing your");
  await page.getByTestId("settings-close").click();

  // A phone reaches the same page, still Perch's own, and puts Perch's own screen back.
  await page.setViewportSize({ width: 375, height: 700 });
  await page.reload({ waitUntil: "networkidle" });
  await settings("mods");
  await expect(use).toBeVisible({ timeout: 15000 });
  await expect(use).not.toHaveAttribute("data-e2e-select");
  await expect(page.locator('[data-testid="settings-modal"] [data-testid="mod-view-e2e-my-select"]')).toHaveCount(0);
  // A desktop screen's copy never runs on a phone: the row says so before anything is picked.
  await expect(status).toContainText("chosen for the computer; this phone shows Perch's own");
  // Chosen by keys: the list closes when the page scrolls (as a click on a far option or a focus that scrolls does,
  // and WebKit's scroll lands late), and WebKit does not focus a clicked button. So each try opens the list, moves to
  // "Perch's own" and presses Enter only once the trigger names that row as active; a list a late scroll closed is
  // simply opened again on the next try.
  const own = page.getByRole("option", { name: "Perch's own", exact: true });
  await expect(async () => {
    await use.focus();
    if (!(await own.count())) await use.press("ArrowDown");
    await expect(own).toBeAttached({ timeout: 1000 });
    await use.press("Home");
    await expect(use).toHaveAttribute("aria-activedescendant", (await own.getAttribute("id", { timeout: 1000 }))!, { timeout: 1000 });
    await use.press("Enter");
    await expect(status).not.toContainText("Your", { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(status).toContainText("Perch's own");
  await settings("appearance");
  await expect(page.getByTestId("settings-chat-text-size")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("settings-chat-text-size")).not.toHaveAttribute("data-e2e-select");
  await expect(page.locator('[data-e2e-select="edited"]')).toHaveCount(0);
  await page.getByTestId("settings-back").click();
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("settings-modal")).toHaveCount(0);
});

test("an agent with only the perch command clones the status bar, puts it in place, edits it and verifies it", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  // The agent's tools: the `perch` binary the core puts beside it (a core without one gives agents no identity).
  execFileSync("cargo", ["build", "-q", "-p", "perchd", "--bin", "perch"], { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-agent-mod-")));
  // The scripted agent: it reads the guide, then does what it says with the CLI and a text edit, nothing else.
  fs.writeFileSync(path.join(work, "agent.sh"), [
    "set -e",
    `cd '${work}'`,
    "perch mod guide > guide.txt",
    "grep -q 'perch mod clone stock:status' guide.txt",
    "perch mod examples | grep -q '^stock:status '",
    "perch mod clone stock:status --as e2e-agent-status > clone.txt",
    'dir=$(tail -n 1 clone.txt)',
    "perch mod use stock:status e2e-agent-status",
    "perch mod check e2e-agent-status > check-1.txt",
    "perch mod dom e2e-agent-status > dom-1.txt",
    `sed 's/? "Local" :/? "Home" :/' "$dir/main.js" > edited.js`,
    'cp edited.js "$dir/main.js"',
    "perch mod check e2e-agent-status > check-2.txt",
    "perch mod dom e2e-agent-status > dom-2.txt",
    "perch mod do app.settings",
  ].join("\n") + "\n");
  try {
    await page.goto("/", { waitUntil: "networkidle" });
    await startChat(page, "terminal");
    await expect(page.locator('[data-testid="mod-view-stock:status"]').getByTestId("status-host")).toHaveText("Local", { timeout: 15000 });
    await page.getByTestId("persistent-agent-terminal").locator(".xterm-helper-textarea")
      .pressSequentially(`sh '${work}/agent.sh' > '${work}/out.txt' 2>&1; echo $? > '${work}/exit.txt'\n`);
    await expect.poll(() => fs.existsSync(path.join(work, "exit.txt")), { timeout: 120_000 }).toBe(true);
    const read = (file: string) => fs.readFileSync(path.join(work, file), "utf8");
    expect(read("exit.txt").trim(), read("out.txt")).toBe("0");

    // What the agent saw is what the person's window drew: its untouched copy, then its edit.
    expect(read("check-1.txt")).toContain("e2e-agent-status loaded without errors");
    expect(read("dom-1.txt")).toContain("Local");
    expect(read("dom-2.txt")).toContain("Home");
    expect(read("dom-2.txt")).not.toMatch(/>Local</);
    await expect(page.locator('[data-testid="mod-view-e2e-agent-status"]').getByTestId("status-host")).toHaveText("Home", { timeout: 15000 });
    await expect(page.locator('[data-testid="mod-view-stock:status"]')).toHaveCount(0);
    await expect(page.getByTestId("settings-nav-mods")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await (await page.request.get("/stock-ui/status/main.js")).text()).toContain('? "Local" :');
  } finally {
    await modsSet(page, { id: "stock:status", op: "use", target: "" }).catch(() => {});
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test("a clone that stops the page while starting is turned off on the next load, and Perch's own screen comes back", async ({ page, browserName }) => {
  // ponytail: WebKit's driver cannot close a page whose main thread never yields; the guard is plain storage code
  // (bootGuard.ts, its vitest) and runs the same there.
  test.skip(browserName === "webkit", "closing a frozen page is Chromium-only in Playwright");
  const context = page.context();
  await page.goto("/", { waitUntil: "networkidle" });
  await startChat(page);
  await expect(page.locator('[data-testid="mod-view-stock:status"]').getByTestId("status-host")).toHaveText("Local", { timeout: 15000 });
  expect(await modsSet(page, { id: "stock:status", op: "clone", as: "e2e-stuck-status" })).toBeNull();
  const main = path.join(HOME, "mods", "e2e-stuck-status", "main.js");
  fs.writeFileSync(main, "for (;;) {}\n" + fs.readFileSync(main, "utf8"));
  // Not awaited: the page freezes as soon as it starts the clone, perhaps before this reply arrives.
  void modsSet(page, { id: "stock:status", op: "use", target: "e2e-stuck-status" }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 4000));
  await page.close({ runBeforeUnload: false });

  const next = await context.newPage();
  try {
    await next.goto("/", { waitUntil: "networkidle" });
    await expect(next.getByTestId("toast-mod:e2e-stuck-status")).toContainText("Perch turned off", { timeout: 15000 });
    await expect(next.locator('[data-testid="mod-view-stock:status"]').getByTestId("status-host")).toHaveText("Local", { timeout: 15000 });
    await expect(next.locator('[data-testid="mod-view-e2e-stuck-status"]')).toHaveCount(0);
    // Turned off for real (Settings > Mods shows it, on any device), its files and the choice kept.
    await next.locator('[data-testid="settings-gear"]').click();
    await next.locator('[data-testid="settings-nav-mods"]').click();
    await expect(next.getByTestId("mod-e2e-stuck-status-status")).toHaveText("Off", { timeout: 15000 });
    expect(fs.existsSync(main)).toBe(true);
    await next.keyboard.press("Escape");
  } finally {
    await modsSet(next, { id: "stock:status", op: "use", target: "" }).catch(() => {});
    await next.close();
  }
});

/** The window's cards, left to right on screen. */
const windowOrder = (page: Page) => page.evaluate(() => ["sidebar-card", "main-card", "tools-card"]
  .map((id) => [id, document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().x] as const)
  .filter((entry): entry is readonly [string, number] => entry[1] !== undefined)
  .sort((a, b) => a[1] - b[1]).map(([id]) => id));

test("Perch's window is the editable layout stock:main: a copy made in Settings is used at once, an edit rearranges it live, a broken edit falls back to Perch as shipped, and an unsaved draft survives every switch", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  const copy = path.join(HOME, "layouts", "my-window.json");
  const drawn = page.locator('[data-testid="layout-window:main"]');
  try {
    await openWorkspaceTool(page, workspaceId, "files");
    const editor = await filesWork(page, "stock:files", "WORKTREE_ANCHOR\n");
    await editor.fill("UNSAVED_DRAFT\n");
    const draftKept = () => expectDoc(page.getByTestId("workspace-file-editor"), "UNSAVED_DRAFT\n", { timeout: 15000 });
    // Perch as shipped is the recovery shell, drawn from the same parts; `stock:main` chosen by name is the same.
    await expect(drawn).toHaveCount(0);
    const shell = await windowOrder(page);
    expect(shell).toEqual(["sidebar-card", "main-card", "tools-card"]);
    expect(await modsSet(page, { id: "stock:main", op: "layout" })).toBeNull();
    await expect(drawn).toHaveCount(0);
    const shipped = await (await page.request.get("/stock-ui/layouts/main.json")).json();

    // Settings > Mods > Window layout: Make my copy writes an ordinary layout file that says where it came from, and uses it.
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-nav-mods").click();
    await page.getByTestId("layout-stock-copy").click();
    await expect(page.getByTestId("layout-my-window-from")).toHaveText("copy of stock:main 1.0.0", { timeout: 15000 });
    await page.getByTestId("settings-close").click();
    const { clonedFrom, ...copied } = JSON.parse(fs.readFileSync(copy, "utf8"));
    const { version, ...shippedTree } = shipped;
    expect(clonedFrom).toEqual({ id: "stock:main", version });
    expect(copied).toEqual(shippedTree);
    await expect(drawn).toHaveCount(1, { timeout: 15000 });
    await expect.poll(() => windowOrder(page)).toEqual(shell);
    await draftKept();

    // An edit to the copy shows at once: the drawer moves left of the main card.
    const tree = JSON.parse(fs.readFileSync(copy, "utf8"));
    const row = tree.children[0];
    row.children = [row.children[0], row.children[2], row.children[1]];
    fs.writeFileSync(copy, JSON.stringify(tree, null, 2));
    await expect.poll(() => windowOrder(page), { timeout: 15000 }).toEqual(["sidebar-card", "tools-card", "main-card"]);
    await draftKept();

    // A broken edit: Perch as shipped comes back, and Settings says why.
    fs.writeFileSync(copy, "{ not a layout");
    await expect(drawn).toHaveCount(0, { timeout: 15000 });
    await expect.poll(() => windowOrder(page)).toEqual(shell);
    await draftKept();
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-nav-mods").click();
    await expect(page.getByTestId("layout-my-window")).toContainText("Perch as shipped is shown", { timeout: 15000 });
    await page.getByTestId("settings-close").click();

    // Fixed, it is used again; choosing Perch as shipped puts the shell back.
    fs.writeFileSync(copy, JSON.stringify(tree));
    await expect(drawn).toHaveCount(1, { timeout: 15000 });
    await expect.poll(() => windowOrder(page)).toEqual(["sidebar-card", "tools-card", "main-card"]);
    expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
    await expect(drawn).toHaveCount(0, { timeout: 15000 });
    await draftKept();
    expect(await (await page.request.get("/stock-ui/layouts/main.json")).json()).toEqual(shipped);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A package that opens a kept window (layout content) and a keyed one it draws itself, and registers a command that
 * asks for a key Perch already uses. */
function windowsAndCommandPackage() {
  write("mod.json", JSON.stringify({ name: "E2E windows", format: "esm", api: "^1" }));
  write("main.js", [
    'import { useEffect, useState } from "react";',
    'import { jsx, jsxs } from "react/jsx-runtime";',
    "export default function Panel({ api }) {",
    "  const [ran, setRan] = useState(0);",
    '  useEffect(() => api.command({ name: "go", description: "E2E go", keys: "mod+b", run: () => setRan((n) => n + 1) }), [api]);',
    "  const open = () => {",
    '    api.window({ key: "kept", title: "E2E kept", keep: true, width: 320, height: 200, at: { x: 300, y: 200 } }, { layout: { type: "block", content: "status" } });',
    '    api.window({ key: "spot", title: "E2E spot", width: 260, height: 160, at: { x: 700, y: 200 } }, (el) => { el.textContent = "spot body"; });',
    "  };",
    '  return jsxs("div", { children: [jsx("button", { "data-testid": "esm-open", onClick: open, children: "open" }), jsx("span", { "data-testid": "esm-ran", children: String(ran) })] });',
    "}",
  ].join("\n"));
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({
    name: "E2E windows", type: "row",
    children: [{ type: "block", content: "sidebar", size: { px: 240 } }, { type: "block", content: "canvas" }, { type: "block", content: "mod:e2e-esm", size: { px: 160 } }],
  }));
}
const modWindow = (page: Page, key: string) => page.locator(`[data-testid="mod-api-window-e2e-esm"][data-window-key="${key}"]`);
type Geometry = { x: number; y: number; width: number; height: number };
const savedWindow = (page: Page, name: string) => page.evaluate((name) => (JSON.parse(localStorage.getItem("perch.modWindows") ?? "{}").windows ?? {})[name] ?? null, name) as Promise<(Geometry & { kept?: { owner: string } }) | null>;
const inlineGeometry = (scope: ReturnType<Page["locator"]>) => scope.evaluate((el: HTMLElement) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height) }));

test("a package's keyed window comes back where it was put and as big as it was made, and a kept window belongs to its layout across reloads and switches until its x", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  windowsAndCommandPackage();
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("perch.modWindows"));
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  await block(page).getByTestId("esm-open").click({ timeout: 15000 });
  const kept = modWindow(page, "kept"), spot = modWindow(page, "spot");
  await expect(kept).toBeVisible();
  await expect(kept.getByRole("contentinfo")).toBeVisible({ timeout: 15000 });
  await expect(spot).toContainText("spot body");

  // Moved by its title bar and sized by its corner, by the mouse.
  const start = (await spot.boundingBox())!;
  await page.mouse.move(start.x + 40, start.y + 8);
  await page.mouse.down();
  await page.mouse.move(start.x + 140, start.y + 68, { steps: 5 });
  await page.mouse.up();
  const moved = (await spot.boundingBox())!;
  expect([moved.x, moved.y]).toEqual([start.x + 100, start.y + 60]);
  await page.mouse.move(moved.x + moved.width - 3, moved.y + moved.height - 3);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width + 77, moved.y + moved.height + 37, { steps: 5 });
  await page.mouse.up();
  const placed = await inlineGeometry(spot);
  expect(placed.width).toBeGreaterThan(moved.width + 40);
  await expect.poll(() => savedWindow(page, "e2e-esm:spot")).toMatchObject(placed);

  // After a reload the kept window is back on its own; the keyed one comes back where it was when the package opens it.
  await page.reload({ waitUntil: "networkidle" });
  await expect(kept).toBeVisible({ timeout: 15000 });
  await expect(kept.getByRole("contentinfo")).toBeVisible({ timeout: 15000 });
  await expect(spot).toHaveCount(0);
  await block(page).getByTestId("esm-open").click({ timeout: 15000 });
  expect(await inlineGeometry(spot)).toEqual(placed);
  await expect(kept).toHaveCount(1);

  // It belongs to the layout: gone while Perch as shipped is shown, back with the layout; an edit to the package
  // (a new copy of it) leaves it open.
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  await expect(kept).toHaveCount(0, { timeout: 15000 });
  expect((await savedWindow(page, "e2e-esm:kept"))?.kept?.owner).toBe("e2e-esm-look");
  expect(await modsSet(page, { id: "e2e-esm-look", op: "layout" })).toBeNull();
  await expect(kept).toBeVisible({ timeout: 15000 });
  write("main.js", fs.readFileSync(path.join(MOD, "main.js"), "utf8").replace('children: "open"', 'children: "open again"'));
  await expect(block(page).getByTestId("esm-open")).toHaveText("open again", { timeout: 15000 });
  await expect(kept).toBeVisible();

  // Its x forgets it: not back after a reload.
  await kept.getByTestId("mod-api-window-close").click();
  await expect(kept).toHaveCount(0);
  await expect.poll(async () => (await savedWindow(page, "e2e-esm:kept"))?.kept).toBeUndefined();
  await page.reload({ waitUntil: "networkidle" });
  await expect(block(page).getByTestId("esm-open")).toBeVisible({ timeout: 15000 });
  await expect(kept).toHaveCount(0);
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

test("a package's command shows in Settings > Keyboard: a taken key leaves it unbound with the reason, a key the person gives it runs it, and it goes with the package", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  windowsAndCommandPackage();
  await page.goto("/", { waitUntil: "networkidle" });
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  await expect(block(page).getByTestId("esm-ran")).toHaveText("0", { timeout: 15000 });

  await page.getByTestId("settings-gear").click();
  await page.getByTestId("settings-nav-keyboard").click();
  const group = page.getByTestId("keybindings-mods");
  const chip = page.getByTestId("keybinding-mod.e2e-esm.go");
  await expect(group).toContainText("E2E go", { timeout: 15000 });
  await expect(chip).toHaveText("Not set");
  await expect(page.getByTestId("keybinding-conflict-mod.e2e-esm.go")).toContainText('is taken by "Toggle sidebar"');
  // The built-in keeps its key.
  await expect(page.getByTestId("keybinding-global.sidebar")).not.toHaveText("Not set");

  await chip.click();
  await expect(chip).toHaveText("Press keys…");
  await page.keyboard.press("Control+Alt+Shift+KeyY");
  await expect(chip).not.toHaveText(/Not set|Press keys/, { timeout: 10000 });
  await expect(page.getByTestId("keybinding-conflict-mod.e2e-esm.go")).toHaveCount(0);
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("settings-modal")).toHaveCount(0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+Alt+Shift+KeyY");
  await expect(block(page).getByTestId("esm-ran")).toHaveText("1", { timeout: 10000 });

  // Removing the package removes its command; the key the person gave stays in their settings, unused.
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  expect(await modsSet(page, { id: "e2e-esm", op: "remove-mod" })).toBeNull();
  await page.getByTestId("settings-gear").click();
  await page.getByTestId("settings-nav-keyboard").click();
  await expect(page.getByTestId("keybinding-global.sidebar")).toBeVisible({ timeout: 15000 });
  await expect(chip).toHaveCount(0, { timeout: 15000 });
  await expect(group).toHaveCount(0);
  await page.getByTestId("settings-close").click();
});

test("a Settings page runs from its stock package; a clone in its place keeps the unsaved form, an edit changes only the clone, and the phone keeps Perch's own", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const settings = async (section: string) => {
    if (!(await page.getByTestId("settings-modal").count())) await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 10000 });
    if (await page.getByTestId("settings-back").isVisible()) await page.getByTestId("settings-back").click();
    await page.getByTestId(`settings-nav-${section}`).click();
  };
  const name = page.getByTestId("host-name-input");
  const copy = page.locator('[data-testid="mod-view-e2e-my-settings-hosts"]');
  const shipped = await (await page.request.get("/stock-ui/settings-hosts/main.js")).text();
  expect(shipped).toContain('from "@perch/sdk"');
  expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|ws|components|keybinds)/);

  // Stock: an unsaved new host's name, typed and not added.
  await settings("hosts");
  await name.fill("e2e-draft-host");
  await expect(copy).toHaveCount(0);

  // The untouched clone, chosen in its place while the page is open, shows the same unsaved name.
  await cloneInPlace(page, ["settings-hosts"]);
  await expect(copy).toHaveCount(1, { timeout: 15000 });
  await expect(copy.getByTestId("host-name-input")).toHaveValue("e2e-draft-host");
  // An edit to the clone shows at once and keeps the draft; Perch's own files are untouched.
  markRoot("e2e-my-settings-hosts", '"host-name-input"');
  await expect(name).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  await expect(name).toHaveValue("e2e-draft-host");
  expect(await (await page.request.get("/stock-ui/settings-hosts/main.js")).text()).toBe(shipped);
  await page.getByTestId("settings-close").click();

  // Back to stock: Perch's own page, the draft still there, and nothing was ever saved.
  expect(await modsSet(page, { id: "stock:settings-hosts", op: "use", target: "" })).toBeNull();
  await settings("hosts");
  await expect(copy).toHaveCount(0, { timeout: 15000 });
  await expect(name).toHaveValue("e2e-draft-host", { timeout: 15000 });
  await expect(name).not.toHaveAttribute("data-e2e-copy");
  await expect(page.getByTestId("host-delete-e2e-draft-host")).toHaveCount(0);
  await name.fill("");
  await page.getByTestId("settings-close").click();

  // The phone keeps Perch's own page while the clone is chosen.
  expect(await modsSet(page, { id: "stock:settings-hosts", op: "use", target: "e2e-my-settings-hosts" })).toBeNull();
  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 375, height: 700 });
  await page.reload({ waitUntil: "networkidle" });
  await settings("hosts");
  await expect(name).toBeVisible({ timeout: 15000 });
  await expect(name).not.toHaveAttribute("data-e2e-copy");
  await expect(copy).toHaveCount(0);
  await page.getByTestId("settings-back").click();
  await page.getByTestId("settings-close").click();
  await page.setViewportSize(desktop);
});

/** A docked layout of two panes for `sessionId`: its chat and a terminal pane (`term-e2e`), as Dockview saves one. */
const twoPaneDock = {
  grid: {
    root: { type: "branch", size: 800, data: [
      { type: "leaf", size: 700, data: { id: "g-chat", views: ["chat"], activeView: "chat" } },
      { type: "leaf", size: 500, data: { id: "g-term", views: ["term-e2e"], activeView: "term-e2e" } },
    ] },
    width: 1200, height: 800, orientation: "HORIZONTAL",
  },
  panels: {
    chat: { id: "chat", contentComponent: "chat", title: "Chat" },
    "term-e2e": { id: "term-e2e", contentComponent: "terminal", title: "Terminal" },
  },
  activeGroup: "g-chat",
};

/** The docked pane menu, whoever's copy is showing: it opens on the terminal pane's tab with that pane's actions, and
 * Rename renames the pane. */
async function paneMenuWorks(page: Page, name: string) {
  const tab = page.getByTestId("pane-tab-term-e2e");
  await tab.click({ button: "right" });
  const menu = page.getByTestId("pane-context-menu");
  await expect(menu).toHaveCount(1, { timeout: 15000 });
  for (const item of ["split-right", "split-down", "zoom", "rename"]) await expect(menu.getByTestId(`pane-menu-${item}`)).toBeVisible();
  await menu.getByTestId("pane-menu-rename").click();
  await menu.getByTestId("pane-menu-rename-input").fill(name);
  await menu.getByTestId("pane-menu-rename-confirm").click();
  await expect(menu).toHaveCount(0);
  await expect(tab).toContainText(name);
}

test("the docked pane menu runs from its stock package; a clone in its place acts on the same pane, and an edit changes only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  // The fixture: the session's dock saved with two panes, as a person's split leaves it.
  await page.evaluate(([id, layout]) => (window as unknown as { usePerchStore: { getState(): { saveSessionLayout(id: string, layout: unknown): void } } }).usePerchStore.getState().saveSessionLayout(id as string, layout), [sessionId, twoPaneDock] as const);
  await page.reload({ waitUntil: "networkidle" });
  await expectActive(page, sessionId);
  await expect(page.getByTestId("pane-tab-term-e2e")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("pane-tab-chat")).toBeVisible();
  try {
    const shipped = await (await page.request.get("/stock-ui/pane-menu/main.js")).text();
    await paneMenuWorks(page, "Stock pane");
    await expect(page.locator('[data-testid="mod-view-e2e-my-pane-menu"]')).toHaveCount(0);

    await cloneInPlace(page, ["pane-menu"]);
    await paneMenuWorks(page, "Clone pane");
    markRoot("e2e-my-pane-menu", '"pane-context-menu"');
    await expect(async () => {
      await page.getByTestId("pane-tab-term-e2e").click({ button: "right" });
      await expect(page.getByTestId("pane-context-menu")).toHaveAttribute("data-e2e-copy", "edited", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await escapeUntilGone(page, "pane-context-menu");
    expect(await (await page.request.get("/stock-ui/pane-menu/main.js")).text()).toBe(shipped);

    expect(await modsSet(page, { id: "stock:pane-menu", op: "use", target: "" })).toBeNull();
    await expect(async () => {
      await page.getByTestId("pane-tab-term-e2e").click({ button: "right" });
      await expect(page.getByTestId("pane-context-menu")).not.toHaveAttribute("data-e2e-copy", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await escapeUntilGone(page, "pane-context-menu");
    await paneMenuWorks(page, "Stock again");
  } finally {
    await page.evaluate((id) => (window as unknown as { usePerchStore: { getState(): { deleteSession(id: string): void } } }).usePerchStore.getState().deleteSession(id), sessionId);
  }
});

test("the close-agent warning runs from its stock package; a clone in its place guards the same real agent, and only its Stop ends it", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "claude");
  const rows = page.getByTestId("persistent-agent-terminal").locator(".xterm-rows");
  // The approved cheap model, by its own banner; no prompt is ever sent.
  await expect(rows).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
  const close = page.getByTestId(`tab-close-${sessionId}`);
  const dialog = page.getByTestId("confirm-dialog");
  const view = page.locator('[data-testid="mod-view-e2e-my-close-guard"]');
  try {
    // Stock: the warning names the agent; Cancel keeps it running.
    await page.getByTestId(`tab-${sessionId}`).hover();
    await close.click();
    await expect(dialog).toContainText("stops its agent and shells for everyone");
    await expect(view).toHaveCount(0);
    await page.getByTestId("confirm-cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId(`tab-${sessionId}`)).toBeVisible();

    // The untouched clone, in its place: the same warning for the same session, and Cancel keeps it.
    await cloneInPlace(page, ["close-guard"]);
    await page.getByTestId(`tab-${sessionId}`).hover();
    await close.click();
    await expect(dialog).toContainText("stops its agent and shells for everyone", { timeout: 15000 });
    await expect(view).toHaveCount(1);
    await page.getByTestId("confirm-cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId(`tab-${sessionId}`)).toBeVisible();

    // An edit to the clone shows the next time; its Stop ends the session for everyone, as Perch's own does.
    markRoot("e2e-my-close-guard", '"close-agent-never"');
    await expect(async () => {
      if (!(await dialog.count())) { await page.getByTestId(`tab-${sessionId}`).hover(); await close.click(); }
      await expect(page.getByTestId("close-agent-never")).toHaveAttribute("data-e2e-copy", "edited", { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.getByTestId("confirm-accept").click();
    await expect(page.getByTestId(`tab-${sessionId}`)).toHaveCount(0, { timeout: 15000 });
    await expect.poll(() => page.evaluate((id) => (window as unknown as { usePerchStore: { getState(): { sessions: { id: string }[] } } }).usePerchStore.getState().sessions.some((s) => s.id === id), sessionId), { timeout: 15000 }).toBe(false);
    // The warning stays on: "Don't show this again" was not ticked.
    expect(await page.evaluate(() => (window as unknown as { usePerchStore: { getState(): { settings?: { warnCloseAgent?: boolean } } } }).usePerchStore.getState().settings?.warnCloseAgent)).not.toBe(false);
  } finally {
    await page.evaluate((id) => {
      const store = (window as unknown as { usePerchStore: { getState(): { sessions: { id: string }[]; deleteSession(id: string): void } } }).usePerchStore.getState();
      if (store.sessions.some((s) => s.id === id)) store.deleteSession(id);
    }, sessionId);
  }
});

/** Stock, then untouched clones chosen in place, then the clones edited by `edit`, then stock again: in every round
 * each surface opens where Perch opens it and does its job (its `open`/`close`); only the edited clones carry the mark,
 * and stock's exported files (`files`, default `main`) stay as shipped. */
async function stockThenClones(page: Page, surfaces: Surface[], edit: () => void, files: Record<string, string[]> = {}) {
  const names = surfaces.map((surface) => surface.name);
  const paths = names.flatMap((name) => (files[name] ?? ["main"]).map((file) => `${name}/${file}.js`));
  const shipped = Object.fromEntries(await Promise.all(paths.map(async (at) => [at, await (await page.request.get(`/stock-ui/${at}`)).text()] as const)));
  for (const text of Object.values(shipped)) {
    expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|keybinds|components|sdk|terminalSearch|editorSearchPanel|dockview)/);
    expect(text).not.toMatch(/from "@(codemirror|xterm)\//);
  }
  for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);
  await cloneInPlace(page, names);
  for (const surface of surfaces) await surfaceWorks(page, surface, "clone", false);
  edit();
  for (const surface of surfaces) await surfaceWorks(page, surface, "clone", true);
  for (const at of paths) expect(await (await page.request.get(`/stock-ui/${at}`)).text()).toBe(shipped[at]);
  for (const name of names) expect(await modsSet(page, { id: `stock:${name}`, op: "use", target: "" })).toBeNull();
  for (const surface of surfaces) await surfaceWorks(page, surface, "stock", false);
}

const sessionNow = (page: Page) => page.evaluate(() => (window as unknown as { usePerchStore: { getState(): { sessionId: string | null } } }).usePerchStore.getState().sessionId);
const deleteSessions = (page: Page, ids: string[]) => page.evaluate((ids) => {
  const store = (window as unknown as { usePerchStore: { getState(): { sessions: { id: string }[]; deleteSession(id: string): void } } }).usePerchStore.getState();
  for (const id of ids) if (store.sessions.some((s) => s.id === id)) store.deleteSession(id);
}, ids);

test("the start screen, the editor menu and the terminal's find bar run from stock packages; clones in their place start, edit and find through Perch, the find bar leaves the shell's input alone, and edits change only the clones", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const { workspaceId, root } = await reviewProject(page);
  const started: string[] = [await startChat(page, "terminal", root)];
  const terminal = page.getByTestId("persistent-agent-terminal");
  const editor = page.getByTestId("workspace-file-editor");
  try {
    await openWorkspaceTool(page, workspaceId, "files");
    const surfaces: Surface[] = [
      {
        // The workspace's start picker, after its last tab closes; its terminal button starts one in the same folder.
        name: "start", root: "no-session-panel",
        open: async (p) => {
          const id = (await sessionNow(p))!;
          await p.getByTestId(`tab-${id}`).hover();
          await p.getByTestId(`tab-close-${id}`).click();
          await expect(p.getByTestId("workspace-start-terminal")).toBeVisible({ timeout: 15000 });
        },
        close: async (p) => {
          const before = await sessionNow(p);
          await p.getByTestId("workspace-start-terminal").click();
          await expect.poll(() => sessionNow(p), { timeout: 15000 }).not.toBe(before);
          started.push((await sessionNow(p))!);
          await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30000 });
          // The new session is selected before the session list carries it, so wait for its row.
          await expect.poll(() => p.evaluate((id) => (window as unknown as { usePerchStore: { getState(): { sessions: { id: string; cwd: string }[] } } }).usePerchStore.getState().sessions.find((s) => s.id === id)?.cwd, started.at(-1)), { timeout: 15000 }).toBe(root);
        },
      },
      {
        // Find in the terminal: the bar's input is its own; Escape gives the shell its focus back and typing reaches it.
        name: "terminal-search", root: "term-search",
        open: async (p) => {
          await terminal.locator(".xterm").click();
          await p.keyboard.press(`${EDITOR_MOD}+f`);
          const input = p.getByTestId("term-search-input");
          await expect(input).toBeFocused({ timeout: 10000 });
          await input.pressSequentially("nowhere_q");
          await expect(input).toHaveValue("nowhere_q");
          await input.press("Enter");
        },
        close: async (p) => {
          await p.getByTestId("term-search-input").press("Escape");
          await expect(terminal.locator(".xterm-helper-textarea")).toBeFocused();
          const marker = `after_find_${Date.now()}`;
          await terminal.locator(".xterm-helper-textarea").pressSequentially(`echo ${marker}`, { delay: 10 });
          await p.keyboard.press("Enter");
          // The shell echoes the command and prints its output: two lines with the marker.
          await expect.poll(async () => (await terminal.locator(".xterm-rows").innerText()).split(marker).length - 1, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
          await expect(terminal.locator(".xterm-rows")).not.toContainText("nowhere_q");
        },
      },
      {
        // The editor's right-click menu: Undo reverts the typed draft on Perch's editor (whose content element is
        // `workspace-file-editor`), which gets its focus back.
        name: "editor-menu", root: "editor-context-menu",
        open: async (p) => {
          const file = p.getByTestId("workspace-file-entry-src/main.txt").first();
          if (!(await file.count())) await p.getByTestId("workspace-file-entry-src").first().click();
          await file.click({ timeout: 10000 });
          await expectDoc(editor, "WORKTREE_ANCHOR\n", { timeout: 15000 });
          await editor.click({ timeout: 10000 });
          await p.keyboard.type("Z");
          await expect.poll(async () => (await editor.evaluate((e) => (e as HTMLElement & { __doc: () => string }).__doc())).includes("Z")).toBe(true);
          await editor.click({ button: "right", timeout: 10000 });
          await expect(p.getByTestId("editor-menu-undo")).toBeEnabled();
        },
        close: async (p) => {
          await p.getByTestId("editor-menu-undo").click();
          await expectDoc(editor, "WORKTREE_ANCHOR\n");
          await expect(editor).toBeFocused();
          await p.getByTestId("file-tab-close-src/main.txt").click();
          await expect(editor).toHaveCount(0, { timeout: 10000 });
        },
      },
    ];
    await stockThenClones(page, surfaces, () => {
      markRoot("e2e-my-start", "testId", "data-e2e-copy", "card.js");
      markRoot("e2e-my-terminal-search", '"term-search"');
      markRoot("e2e-my-editor-menu", '"editor-context-menu"');
    }, { start: ["main", "card"] });
  } finally {
    await deleteSessions(page, started);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** Settings > Devices, as the person opens it. */
async function openDevices(page: Page) {
  await page.getByTestId("settings-gear").click();
  await page.getByTestId("settings-nav-devices").click();
  await expect(page.getByTestId("settings-devices")).toBeVisible({ timeout: 10000 });
}

/** A phone paired from `page`'s Settings > Devices: a phone-sized context with no local cookie, past its pairing gate. */
async function pairPhone(page: Page, browser: Browser, name: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  const phone = await context.newPage();
  phone.on("pageerror", (error) => console.log("PHONE PAGEERROR", error.message));
  await phone.goto(new URL("/", page.url()).href, { waitUntil: "domcontentloaded" });
  await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 20000 });
  await openDevices(page);
  await page.getByTestId("pair-start").click();
  const code = ((await page.getByTestId("pair-code").locator("strong").textContent()) ?? "").trim();
  await phone.getByTestId("pairing-code").fill(code);
  await phone.getByTestId("pairing-name").fill(name);
  await phone.getByTestId("pairing-submit").click();
  await expect(phone.getByTestId("pairing-gate")).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId("paired-devices")).toContainText(name, { timeout: 15000 });
  await page.keyboard.press("Escape");
  return { context, phone };
}

/** The paired `phone` reloads into session `id`. Its window may already have chosen "no session" for itself
 * (`perch.sessionId@<viewer>`, viewer.ts), which a reload keeps over the shared key: that choice is cleared. */
async function showOnPhone(phone: Page, id: string) {
  await phone.evaluate((id) => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("perch.sessionId@")) localStorage.removeItem(key);
    localStorage.setItem("perch.sessionId", id);
  }, id);
  await phone.reload({ waitUntil: "networkidle" });
}

/** Revoke the phone named `name` in Settings > Devices, if it is still paired: the fixture core's devices are shared.
 * With `paired`, the phone must be listed (the list loads after the page opens, so a bare count can miss it). */
async function unpairPhone(page: Page, name: string, paired = false) {
  if (paired) await openDevices(page);
  else await openDevices(page).catch(() => {});
  const row = page.getByTestId("paired-devices").locator("li").filter({ hasText: name });
  if (paired) await expect(row).toHaveCount(1, { timeout: 15000 });
  if (await row.count()) {
    await row.locator('[data-testid^="device-revoke-"]').click();
    await expect(row).toHaveCount(0, { timeout: 10000 });
  }
  await page.keyboard.press("Escape");
}

test("the phone-size notice runs from its stock package; a clone in its place takes the terminal's size back from a paired phone, and an edit changes only the clone", async ({ page, browser }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  const desktop = page.getByTestId("persistent-agent-terminal");
  const terminalId = (await desktop.getAttribute("data-terminal-id"))!;
  // A phone is a paired device (no local cookie): only another device's size gets the notice.
  const phoneName = `e2e phone-size ${Date.now() % 100000}`;
  const { context: phoneContext, phone } = await pairPhone(page, browser, phoneName);
  try {
    await showOnPhone(phone, sessionId);
    const mobile = phone.getByTestId("persistent-agent-terminal");
    await expect(mobile).toHaveAttribute("data-terminal-id", terminalId, { timeout: 30000 });
    await stockThenClones(page, [{
      name: "phone-size", root: "phone-size-notice",
      open: async () => {
        // The phone fits the terminal to itself on opening; after a take-back, with Fit here.
        await expect(async () => {
          if (!(await mobile.getAttribute("data-controlling"))) await mobile.getByRole("button", { name: "Fit here", exact: true }).click({ timeout: 2000 });
          await expect(mobile).toHaveAttribute("data-controlling", "true", { timeout: 2000 });
        }).toPass({ timeout: 20000 });
      },
      close: async (p) => {
        await p.getByTestId("phone-size-notice").getByRole("button", { name: "Take back this tab", exact: true }).click();
        await expect(desktop).toHaveAttribute("data-controlling", "true", { timeout: 15000 });
        await expect(desktop).toHaveAttribute("data-terminal-id", terminalId);
        await expect(mobile).not.toHaveAttribute("data-controlling", "true");
      },
    }], () => markRoot("e2e-my-phone-size", '"phone-size-notice"'));
  } finally {
    await phoneContext.close();
    await deleteSessions(page, [sessionId]);
    await unpairPhone(page, phoneName);
  }
});

test("Split with session runs from its stock package; a clone in its place offers the same sessions and splits one in, and an edit changes only the clone", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const other = await startChat(page, "terminal");
  const sessionId = await startChat(page, "terminal");
  await page.evaluate(([id, layout]) => (window as unknown as { usePerchStore: { getState(): { saveSessionLayout(id: string, layout: unknown): void } } }).usePerchStore.getState().saveSessionLayout(id as string, layout), [sessionId, twoPaneDock] as const);
  await page.reload({ waitUntil: "networkidle" });
  await expectActive(page, sessionId);
  await expect(page.getByTestId("pane-tab-term-e2e")).toBeVisible({ timeout: 15000 });
  try {
    const surface: Surface = {
      name: "session-split", root: "session-split-popover",
      open: async (p) => {
        await p.getByTestId("pane-split-session").first().click();
        await expect(p.getByTestId(`session-split-option-${other}`)).toBeVisible({ timeout: 15000 });
        await expect(p.getByTestId(`session-split-option-${sessionId}`)).toHaveCount(0);
      },
      close: (p) => escapeUntilGone(p, "session-split-popover"),
    };
    await stockThenClones(page, [surface], () => markRoot("e2e-my-session-split", '"session-split-popover"'));

    // Through the edited clone, a pick splits the other session in beside: its pane joins this dock.
    expect(await modsSet(page, { id: "stock:session-split", op: "use", target: "e2e-my-session-split" })).toBeNull();
    await page.getByTestId("pane-split-session").first().click();
    await expect(page.getByTestId("session-split-popover")).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
    await page.getByTestId(`session-split-option-${other}`).click();
    await expect(page.getByTestId("session-split-popover")).toHaveCount(0);
    await expect(page.getByTestId(`pane-tab-session-chat-${other}`)).toBeVisible({ timeout: 15000 });
    expect(await modsSet(page, { id: "stock:session-split", op: "use", target: "" })).toBeNull();
  } finally {
    await deleteSessions(page, [sessionId, other]);
  }
});

test("the slash popover runs from its stock package inside the chat; a clone in its place lists the same commands, the composer keeps its focus and keys, a pick only rewrites the draft, and an edit changes only the clone", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "claude");
  // The approved cheap model, by its own banner; no prompt is ever sent.
  await expect(page.getByTestId("persistent-agent-terminal").locator(".xterm-rows")).toContainText(/Haiku 4\.5/i, { timeout: 30_000 });
  try {
    await setChatMode(page, "ui");
    const composer = page.getByTestId("native-cli-composer");
    await expect(composer).toBeEnabled({ timeout: 60_000 });
    let first: string[] = [];
    await stockThenClones(page, [{
      name: "slash-popover", root: "native-cli-menu",
      open: async (p) => {
        await composer.click();
        await composer.fill("/");
        const options = p.getByTestId("native-cli-menu").getByRole("option");
        await expect(options.first()).toBeVisible({ timeout: 20000 });
        const labels = await options.locator("span:first-child").allTextContents();
        if (first.length) expect(labels).toEqual(first);
        else first = labels;
        // The composer keeps its focus and its keys: the arrows move the active row it names.
        await expect(composer).toBeFocused();
        await expect(composer).toHaveAttribute("aria-activedescendant", "native-menu-option-0");
        if (labels.length > 1) {
          await composer.press("ArrowDown");
          await expect(composer).toHaveAttribute("aria-activedescendant", "native-menu-option-1");
          await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
          await composer.press("ArrowUp");
        }
        await expect(composer).toBeFocused();
      },
      close: async (p) => {
        // A press on a row picks it: the draft becomes the command, the composer keeps its focus, nothing is sent.
        await p.getByTestId("native-cli-menu").getByRole("option").first().click();
        await expect(composer).toHaveValue(`${first[0]} `);
        await expect(composer).toBeFocused();
        await composer.fill("");
      },
    }], () => markRoot("e2e-my-slash-popover", '"native-cli-menu"'));
  } finally {
    await setChatMode(page, "cli").catch(() => {});
    await deleteSessions(page, [sessionId]);
  }
});

type StoreWindow = { usePerchStore: { getState(): { setSettingsOpen(open: boolean): void } } };
const settingsOpen = (page: Page, open: boolean) => page.evaluate((open) => (window as unknown as StoreWindow).usePerchStore.getState().setSettingsOpen(open), open);

test("a phone runs the person's copy only on its own screens and only once turned on there; off and a revoked pairing put Perch's own back", async ({ page, browser }) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const { root } = await reviewProject(page);
  const sessionId = await startChat(page, "terminal", root);
  // Edited copies of all five phone screens and of a computer screen (the status bar), each chosen in place.
  const PHONE = ["mobile-header", "mobile-switcher", "mobile-panes", "mobile-files", "mobile-keys"];
  const phoneName = `e2e phone-mods ${Date.now() % 100000}`;
  let context: Awaited<ReturnType<typeof pairPhone>>["context"] | undefined;
  try {
    await cloneInPlace(page, [...PHONE, "status"]);
    markRoot("e2e-my-mobile-header", '"mobile-header"');
    markRoot("e2e-my-mobile-switcher", '"mobile-switcher"');
    markRoot("e2e-my-mobile-panes", '"mobile-pane-shell"');
    markRoot("e2e-my-mobile-files", '"mobile-files-back"');
    markRoot("e2e-my-mobile-keys", '"mobile-key-bar"');
    markRoot("e2e-my-status", '"status-host"');
    // The computer runs its own screen's copy, and says the phone screens are for phones that turned them on.
    await expect(page.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-host")).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
    await settingsOpen(page, true);
    await page.getByTestId("settings-nav-mods").click();
    await expect(page.getByTestId("screen-stock:mobile-header-status")).toContainText("chosen for phones that turned on phone screens from your packages", { timeout: 15000 });
    await expect(page.getByTestId("settings-phone-mods")).toHaveCount(0);
    await settingsOpen(page, false);

    const paired = await pairPhone(page, browser, phoneName);
    context = paired.context;
    const phone = paired.phone;
    await showOnPhone(phone, sessionId);
    await expect(phone.getByTestId("persistent-agent-terminal")).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30000 });
    // The person's source as the phone gets it: never stored by the browser or the service worker.
    const packages: { url: string; cacheControl: string }[] = [];
    phone.on("response", (response) => {
      if (response.url().includes("mods/package")) packages.push({ url: response.url(), cacheControl: response.headers()["cache-control"] ?? "" });
    });
    const cachedSource = () => phone.evaluate(async () => {
      if (!("caches" in window)) return [];
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      return urls.filter((url) => url.includes("mods/package") || url.includes("mods/data"));
    });
    const marked = phone.locator('[data-e2e-copy="edited"]');
    /** Every phone screen as the phone shows it: each one's own copy when `copies`, else Perch's own; never the
     * computer's status bar copy. */
    const phoneScreens = async (copies: boolean) => {
      const check = async (testId: string, name: string) => {
        const shown = phone.getByTestId(testId);
        await expect(shown).toBeVisible({ timeout: 15000 });
        if (copies) await expect(shown).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
        else await expect(shown).not.toHaveAttribute("data-e2e-copy");
        await expect(phone.locator(`[data-testid="mod-view-e2e-my-${name}"]`)).toHaveCount(copies ? 1 : 0);
      };
      await check("mobile-header", "mobile-header");
      await check("mobile-pane-shell", "mobile-panes");
      await check("mobile-key-bar", "mobile-keys");
      await phone.getByTestId("mobile-switch").click();
      await check("mobile-switcher", "mobile-switcher");
      await phone.getByTestId("mobile-switcher-close").click();
      await expect(phone.getByTestId("mobile-switcher")).toHaveCount(0);
      await phone.getByTestId("mobile-tools").click();
      const entry = phone.getByTestId("workspace-file-entry-src/main.txt").first();
      if (!(await entry.count())) await phone.getByTestId("workspace-file-entry-src").first().click();
      await entry.click({ timeout: 15000 });
      await check("mobile-files-back", "mobile-files");
      await phone.getByTestId("mobile-files-back").click();
      await phone.getByTestId("mobile-tools-close").click();
      await expect(phone.locator('[data-testid="mod-view-e2e-my-status"]')).toHaveCount(0);
      if (!copies) await expect(marked).toHaveCount(0);
    };
    const phoneSwitch = async (on: boolean, status: string) => {
      await settingsOpen(phone, true);
      await phone.getByTestId("settings-nav-mods").click();
      const toggle = phone.getByTestId("settings-phone-mods");
      await expect(toggle).toBeAttached({ timeout: 15000 });
      if ((await toggle.isChecked()) !== on) await toggle.click();
      await expect(toggle).toBeChecked({ checked: on });
      await expect(phone.getByTestId("screen-stock:mobile-header-status")).toContainText(status);
      await expect(phone.getByTestId("screen-stock:status-status")).toContainText("chosen for the computer; this phone shows Perch's own");
      await settingsOpen(phone, false);
    };

    // Paired, not turned on: Perch's own phone screens.
    await phoneScreens(false);
    expect(await phone.evaluate(() => localStorage.getItem("perch.phoneMods"))).toBeNull();
    // Turned on for this phone: the copies of its own screens, never the computer's.
    await phoneSwitch(true, "Showing your");
    await phoneScreens(true);
    // It is this phone's choice: a reload keeps it.
    await phone.reload({ waitUntil: "networkidle" });
    await phoneScreens(true);
    expect(packages.length).toBeGreaterThan(0);
    for (const fetched of packages) expect(fetched.cacheControl, fetched.url).toContain("no-store");
    expect(await cachedSource()).toEqual([]);
    // Off: Perch's own at once, no reload.
    await phoneSwitch(false, "until phone screens from your packages are on");
    await phoneScreens(false);

    // Revoked on the computer: the phone forgets the choice and asks to pair again.
    await phoneSwitch(true, "Showing your");
    await unpairPhone(page, phoneName, true);
    await phone.reload({ waitUntil: "domcontentloaded" });
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 20000 });
    await expect.poll(() => phone.evaluate(() => localStorage.getItem("perch.phoneMods")), { timeout: 10000 }).toBeNull();
    await expect(marked).toHaveCount(0);
    // Nothing of the person's source stays on the phone, and the core no longer gives it out.
    expect(await cachedSource()).toEqual([]);
    expect([401, 403]).toContain(await phone.evaluate((url) => fetch(url, { cache: "no-store" }).then((response) => response.status), packages[0].url));
  } finally {
    await context?.close();
    for (const name of [...PHONE, "status"]) await modsSet(page, { id: `stock:${name}`, op: "use", target: "" }).catch(() => {});
    await deleteSessions(page, [sessionId]);
    await unpairPhone(page, phoneName);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** The docked shell pane, whoever's copies show: its tab's menu renames it (the tab shows dockview's title), its
 * toolbar says the shell runs and New shell opens another as a tab of the group, and the group's + does the same.
 * Each of `stock:terminal-toolbar`, `stock:dock-tab` and `stock:dock-actions` is `owner`'s, marked only when `edited`. */
async function dockWorks(page: Page, owner: "stock" | "clone", edited: boolean, label: string) {
  for (const name of ["terminal-toolbar", "dock-tab", "dock-actions"]) {
    const view = page.locator(`[data-testid="mod-view-e2e-my-${name}"]`);
    if (owner === "clone") await expect(view.first()).toBeAttached({ timeout: 15000 });
    else await expect(view).toHaveCount(0);
  }
  const mark = async (shown: ReturnType<Page["locator"]>) => {
    if (edited) await expect(shown).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
    else await expect(shown).not.toHaveAttribute("data-e2e-copy");
  };
  await mark(page.getByTestId("pane-tab-term-e2e"));
  await paneMenuWorks(page, label);
  await page.getByTestId("pane-tab-term-e2e").click();
  const toolbar = page.getByTestId("terminal-toolbar").locator("visible=true");
  await expect(toolbar).toHaveCount(1, { timeout: 15000 });
  await expect(toolbar).toContainText("Shell running", { timeout: 30000 });
  await mark(toolbar);
  const tabs = page.locator('[data-testid^="pane-tab-"]');
  const before = await tabs.count();
  await toolbar.getByTestId("terminal-new-shell").click();
  await expect(tabs).toHaveCount(before + 1, { timeout: 15000 });
  const add = page.getByTestId("terminal-add-tab").last();
  await mark(add);
  await add.click();
  await expect(tabs).toHaveCount(before + 2, { timeout: 15000 });
}

test("the shell toolbar and the dock's tabs and group buttons run from stock packages; clones in their place open shells and act on panes through Perch, and edits change only the clones", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  await page.evaluate(([id, layout]) => (window as unknown as { usePerchStore: { getState(): { saveSessionLayout(id: string, layout: unknown): void } } }).usePerchStore.getState().saveSessionLayout(id as string, layout), [sessionId, twoPaneDock] as const);
  await page.reload({ waitUntil: "networkidle" });
  await expectActive(page, sessionId);
  await expect(page.getByTestId("pane-tab-term-e2e")).toBeVisible({ timeout: 15000 });
  const names = ["terminal-toolbar", "dock-tab", "dock-actions"];
  try {
    const shipped = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await (await page.request.get(`/stock-ui/${name}/main.js`)).text()] as const)));
    // Plain modules on what a package may import, nothing of Perch's internals or engines.
    for (const text of Object.values(shipped)) for (const [, specifier] of text.matchAll(/\bfrom\s+"([^"]+)"/g)) expect(specifier).toMatch(/^(react|react\/jsx-runtime|react-dom|@perch\/sdk|\.\/[\w./-]+\.js)$/);
    await dockWorks(page, "stock", false, "Stock pane");
    await cloneInPlace(page, names);
    await dockWorks(page, "clone", false, "Clone pane");
    markRoot("e2e-my-terminal-toolbar", '"terminal-toolbar"');
    markRoot("e2e-my-dock-tab", "`pane-tab-${id}`");
    markRoot("e2e-my-dock-actions", '"terminal-add-tab"');
    await dockWorks(page, "clone", true, "Edited pane");
    for (const name of names) expect(await (await page.request.get(`/stock-ui/${name}/main.js`)).text()).toBe(shipped[name]);
    for (const name of names) expect(await modsSet(page, { id: `stock:${name}`, op: "use", target: "" })).toBeNull();
    await dockWorks(page, "stock", false, "Stock again");
  } finally {
    await deleteSessions(page, [sessionId]);
  }
});

test("the browser toolbar runs from its stock package; a clone in its place keeps the typed address and its suggestions, and an edit changes only the clone", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  try {
    await page.getByTestId("tab-new").click();
    await page.getByText("New browser", { exact: true }).click();
    const address = page.getByTestId("browser-address");
    await expect(address).toBeFocused({ timeout: 15000 });
    const shipped = await (await page.request.get("/stock-ui/browser-toolbar/main.js")).text();
    expect(shipped).toContain('from "@perch/sdk"');
    expect(shipped).not.toMatch(/from "\.\.?\/[^"]*(store|browserNative|browserHistory|links|components)/);
    const view = page.locator('[data-testid="mod-view-e2e-my-browser-toolbar"]');
    /** Whoever's toolbar shows: the address holds what was typed, typing more lists a search for it, and Escape
     * closes the list but keeps the words (Perch's draft). */
    const works = async (owner: "stock" | "clone", edited: boolean, kept: string, more: string) => {
      if (owner === "clone") await expect(view).toBeAttached({ timeout: 15000 });
      else await expect(view).toHaveCount(0);
      const toolbar = page.getByTestId("browser-toolbar");
      if (edited) await expect(toolbar).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
      else await expect(toolbar).not.toHaveAttribute("data-e2e-copy");
      await expect(address).toHaveValue(kept, { timeout: 15000 });
      // Typing goes through the copy's input to Perch's draft (focusing selects the whole address, as browsers do).
      await address.fill(`${kept}${more}`);
      const suggestions = page.getByTestId("browser-suggestions");
      await expect(suggestions).toContainText(`Search for “${kept}${more}”`, { timeout: 10000 });
      await address.press("Escape");
      await expect(suggestions).toHaveCount(0);
      await expect(address).toHaveValue(`${kept}${more}`);
      return `${kept}${more}`;
    };
    let typed = await works("stock", false, "", "perch e2e");
    await cloneInPlace(page, ["browser-toolbar"]);
    typed = await works("clone", false, typed, " clone");
    markRoot("e2e-my-browser-toolbar", '"browser-toolbar"');
    typed = await works("clone", true, typed, " edited");
    expect(await (await page.request.get("/stock-ui/browser-toolbar/main.js")).text()).toBe(shipped);
    expect(await modsSet(page, { id: "stock:browser-toolbar", op: "use", target: "" })).toBeNull();
    await works("stock", false, typed, " again");
  } finally {
    await deleteSessions(page, [sessionId]);
  }
});

test("the agent terminal's chip runs from its stock package; a clone in its place says how each view stands and moves control through Perch, and an edit changes only the clone", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  // Without shared typing (as an older terminal host gives), one view types at a time and the others are offered
  // Take control: what the chip is for. Each page forgets the capability before it shows the terminal.
  type CapsWindow = { usePerchStore?: { getState(): { serverInfo?: { capabilities?: string[] } }; setState(patch: object): void } };
  const withoutSharedTyping = (p: Page) => p.waitForFunction(() => {
    const store = (window as unknown as CapsWindow).usePerchStore;
    const info = store?.getState().serverInfo;
    if (!store || !info?.capabilities) return false;
    if (info.capabilities.includes("terminal.sharedInput")) store.setState({ serverInfo: { ...info, capabilities: info.capabilities.filter((c) => c !== "terminal.sharedInput") } });
    return true;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await withoutSharedTyping(page);
  const sessionId = await startChat(page, "terminal");
  const other = await page.context().newPage();
  other.on("pageerror", (error) => console.log("OTHER PAGEERROR", error.message));
  try {
    await other.addInitScript(() => localStorage.removeItem("perch.sessionId"));
    await other.goto("/", { waitUntil: "networkidle" });
    await withoutSharedTyping(other);
    await other.getByTestId(`tab-${sessionId}`).click();
    await expectActive(other, sessionId);
    const views = [page, other];
    /** `here` takes control from the chip, whoever's copy draws it: Perch moves typing here, the chip leaves, and the
     * other view's chip says another view is typing. */
    const takeIn = async (here: Page, there: Page, owner: "stock" | "clone", edited: boolean) => {
      const chip = here.getByTestId("agent-control-chip");
      await expect(chip).toBeVisible({ timeout: 30000 });
      await expect(chip).toContainText(/Another view is typing in this agent|Viewing agent/);
      if (edited) await expect(chip).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
      else await expect(chip).not.toHaveAttribute("data-e2e-copy");
      const view = here.locator('[data-testid="mod-view-e2e-my-agent-control"]');
      if (owner === "clone") await expect(view.first()).toBeAttached();
      else await expect(view).toHaveCount(0);
      await chip.getByTestId("agent-take-control").click();
      await expect(here.getByTestId("persistent-agent-terminal")).toHaveAttribute("data-controlling", "true", { timeout: 15000 });
      await expect(chip).toHaveCount(0);
      await expect(there.getByTestId("agent-control-chip")).toContainText("Another view is typing in this agent", { timeout: 15000 });
      await expect(there.getByTestId("persistent-agent-terminal")).not.toHaveAttribute("data-controlling", "true");
    };
    const round = async (owner: "stock" | "clone", edited: boolean) => {
      // Whichever view typed last, each takes control once.
      const first = (await page.getByTestId("persistent-agent-terminal").getAttribute("data-controlling")) === "true" ? 1 : 0;
      await takeIn(views[first]!, views[1 - first]!, owner, edited);
      await takeIn(views[1 - first]!, views[first]!, owner, edited);
    };
    const shipped = await (await page.request.get("/stock-ui/agent-control/main.js")).text();
    await round("stock", false);
    await cloneInPlace(page, ["agent-control"]);
    await round("clone", false);
    markRoot("e2e-my-agent-control", '"agent-control-chip"');
    await round("clone", true);
    expect(await (await page.request.get("/stock-ui/agent-control/main.js")).text()).toBe(shipped);
    expect(await modsSet(page, { id: "stock:agent-control", op: "use", target: "" })).toBeNull();
    await round("stock", false);
  } finally {
    await other.close();
    await deleteSessions(page, [sessionId]);
  }
});

/** A second core on private state (`fixtureRuntimeEnv`) holding a copy of the person's `ids` packages and their
 * `use` choices, started with `env` (a web build, safe mode, a base path), and a signed-in page on it at `base`. */
async function secondCore(browser: Browser, ids: string[], env: Record<string, string>, base = "/") {
  const state = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-second-core-")));
  for (const id of ids) fs.cpSync(path.join(HOME, "mods", id), path.join(state, "mods", id), { recursive: true });
  fs.copyFileSync(path.join(HOME, "layout-state.json"), path.join(state, "layout-state.json"));
  const listener = net.createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise((resolve) => listener.close(resolve));
  // fixtureServer.ts stops the core's runtimes and removes `state` when it exits.
  const core = spawn(process.execPath, ["--experimental-strip-types", path.resolve(__dirname, "fixtureServer.ts"), "--port", String(port)], {
    cwd: path.resolve(__dirname, ".."), env: { ...process.env, ...fixtureRuntimeEnv(state), PERCH_NO_LOGIN_PATH: "1", ...env }, stdio: "inherit",
  });
  const exited = once(core, "exit");
  const origin = `http://127.0.0.1:${port}`;
  const page = await browser.newPage({ storageState: localStorageState() });
  page.on("pageerror", (error) => console.log("SECOND CORE PAGEERROR", error.message));
  const stop = async () => { await page.close().catch(() => {}); core.kill("SIGTERM"); await exited; };
  try {
    await expect.poll(async () => (await fetch(`${origin}${base}`).catch(() => null))?.ok ?? false, { timeout: 30000 }).toBe(true);
    await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
    await page.goto(`${origin}${base}`, { waitUntil: "networkidle" });
  } catch (error) {
    await stop();
    throw error;
  }
  return { page, state, origin, stop };
}

/** A copy of this web build (`packages/web/dist`) to change as a newer Perch would be. */
function copyWebBuild() {
  const web = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-newer-web-")));
  fs.cpSync(path.resolve(__dirname, "..", "packages", "web", "dist"), web, { recursive: true });
  return web;
}

/** Changes stock screen `name` in the web build `web` as a newer build would have it: `change` edits its files, and
 * its catalog entry is rewritten to match (the revision as the exporter and the core compute it). */
function restampStock(web: string, name: string, change: (dir: string) => void) {
  const dir = path.join(web, "stock-ui", name);
  change(dir);
  // The exporter's own revision hash (an ES module, so in a child Node), so the catalog is one the core accepts.
  const exporter = pathToFileURL(path.resolve(__dirname, "..", "packages", "web", "scripts", "export-stock-ui.mjs")).href;
  const revision = execFileSync(process.execPath, ["--input-type=module", "-e", [
    `import { packageDigest } from ${JSON.stringify(exporter)};`,
    'import * as fs from "node:fs"; import * as path from "node:path";',
    "const files = new Map();",
    "const walk = (at, prefix) => { for (const e of fs.readdirSync(at, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(at, e.name), prefix + e.name + '/'); else files.set(prefix + e.name, fs.readFileSync(path.join(at, e.name))); } };",
    "walk(process.argv[1], ''); console.log(packageDigest(files));",
  ].join("\n"), dir], { encoding: "utf8" }).trim();
  const catalogFile = path.join(web, "stock-ui", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8")) as { packages: { id: string; version: string; revision: string }[] };
  const entry = catalog.packages.find((candidate) => candidate.id === name)!;
  entry.version = (JSON.parse(fs.readFileSync(path.join(dir, "mod.json"), "utf8")) as { version: string }).version;
  entry.revision = revision;
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + "\n");
  return revision;
}

/** A newer Perch's web build whose stock `name` screen says it is `version`. */
function newerWebBuild(name: string, version: string) {
  const web = copyWebBuild();
  restampStock(web, name, (dir) => {
    const manifest = path.join(dir, "mod.json");
    fs.writeFileSync(manifest, JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest, "utf8")), version }, null, 2) + "\n");
  });
  return web;
}

test("a customized copy survives a newer Perch: the newer stock version is named and the copy kept; a copy that needs a newer @perch/sdk shows Perch's own and says why", async ({ page, browser }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await startChat(page);
  await cloneInPlace(page, ["status"]);
  const shippedVersion = (JSON.parse(await (await page.request.get("/stock-ui/status/mod.json")).text()) as { version: string }).version;
  const main = path.join(HOME, "mods", "e2e-my-status", "main.js");
  fs.writeFileSync(main, fs.readFileSync(main, "utf8").replace('"Connected"', '"Linked"'));
  await expect(page.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-connection")).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
  // Perch is updated: the same person's files under a core serving a newer web build, whose status bar is 9.1.0.
  const web = newerWebBuild("status", "9.1.0");
  const newer = await secondCore(browser, ["e2e-my-status"], { PERCH_WEB_DIST: web });
  try {
    const next = newer.page;
    const copy = path.join(newer.state, "mods", "e2e-my-status");
    const manifest = path.join(copy, "mod.json");
    const recorded = JSON.parse(fs.readFileSync(manifest, "utf8")) as { api: string; clonedFrom: { id: string; version?: string } };
    expect(recorded.clonedFrom).toMatchObject({ id: "stock:status", version: shippedVersion });
    const edited = fs.readFileSync(path.join(copy, "main.js"));
    const connection = (owner: string) => next.locator(`[data-testid="mod-view-${owner}"]`).getByTestId("status-connection");
    await startChat(next);
    // The copy still runs, as the person left it, and Settings > Mods names the newer stock version.
    await expect(connection("e2e-my-status")).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
    await settingsOpen(next, true);
    await next.getByTestId("settings-nav-mods").click();
    const note = next.getByTestId("mod-e2e-my-status-upgrade");
    await expect(note).toHaveText("Perch now ships stock:status 9.1.0; your copy is unchanged", { timeout: 15000 });
    await expect(next.getByTestId("screen-stock:status-status")).toContainText("Showing your");
    expect(fs.readFileSync(path.join(copy, "main.js")).equals(edited)).toBe(true);

    // A copy that needs an SDK this Perch does not have: it does not run, Perch's own shows, and both places say why.
    fs.writeFileSync(manifest, JSON.stringify({ ...recorded, api: "^2" }, null, 2));
    await expect(note).toContainText("needs @perch/sdk ^2, but this Perch has", { timeout: 15000 });
    await expect(note).toContainText("Perch's own stock:status is shown");
    await expect(next.getByTestId("screen-stock:status-status")).toContainText("needs @perch/sdk ^2");
    await settingsOpen(next, false);
    await expect(connection("stock:status")).toHaveAttribute("aria-label", "Connected", { timeout: 15000 });
    await expect(next.locator('[data-testid="mod-view-e2e-my-status"]')).toHaveCount(0);
    await expect(next.getByTestId("stock-fallback-status")).toContainText("it needs @perch/sdk ^2; this Perch has");
    expect(fs.readFileSync(path.join(copy, "main.js")).equals(edited)).toBe(true);

    // Its range fixed by the person: the copy runs again, untouched.
    fs.writeFileSync(manifest, JSON.stringify(recorded, null, 2));
    await expect(connection("e2e-my-status")).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
  } finally {
    await newer.stop();
    fs.rmSync(web, { recursive: true, force: true });
    await modsSet(page, { id: "stock:status", op: "use", target: "" }).catch(() => {});
  }
});

test("a core started with PERCH_MODS=off runs Perch's own screens though a copy is chosen, and refuses to choose one", async ({ page, browser }) => {
  test.setTimeout(120_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await cloneInPlace(page, ["status"]);
  markRoot("e2e-my-status", '"status-host"');
  // The person's copy and choice, as files, under a second core started in safe mode.
  const safeCore = await secondCore(browser, ["e2e-my-status"], { PERCH_MODS: "off" });
  try {
    const safe = safeCore.page;
    await startChat(safe);
    await expect(safe.locator('[data-testid="mod-view-stock:status"]').getByTestId("status-host")).toHaveText("Local", { timeout: 15000 });
    await expect(safe.locator('[data-testid="mod-view-e2e-my-status"]')).toHaveCount(0);
    await expect(safe.locator('[data-e2e-copy="edited"]')).toHaveCount(0);
    expect(await modsSet(safe, { id: "stock:status", op: "use", target: "e2e-my-status" })).toMatch(/mods are off/);
    // Settings > Mods says why, though its own switch is not on.
    await settingsOpen(safe, true);
    await safe.getByTestId("settings-nav-mods").click();
    await expect(safe.getByTestId("mods-safe-mode")).toContainText("PERCH_MODS=off", { timeout: 15000 });
    await expect(safe.getByTestId("settings-mods-off")).not.toBeChecked();
    await settingsOpen(safe, false);
    // The same files on the normal core still run the copy: safe mode changed nothing on disk.
    await expect(page.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-host")).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  } finally {
    await safeCore.stop();
    await modsSet(page, { id: "stock:status", op: "use", target: "" }).catch(() => {});
  }
});

/** The service worker's precache entries `files` (paths under the web root) get a new revision, as a newer build's
 * worker would list them: the browser then installs it, and autoUpdate reloads the page into it. */
function bumpPrecache(web: string, files: string[]) {
  const sw = path.join(web, "sw.js");
  let text = fs.readFileSync(sw, "utf8");
  for (const file of files) {
    const entry = new RegExp(`\\{[^{}]*"?url"?:\\s*"${file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"[^{}]*\\}`);
    const found = text.match(entry);
    if (!found) throw new Error(`sw.js does not precache ${file}`);
    text = text.replace(found[0], found[0].replace(/("?revision"?:\s*")[^"]*"/, `$1e2e-${Date.now()}"`));
  }
  fs.writeFileSync(sw, text);
}

test("under a proxy base path the stock screens and a person's copy load from that path; the service worker precaches the shell with its build's stock screens, never a person's package, and a newer build replaces both", async ({ page, browser, browserName }) => {
  test.setTimeout(180_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await cloneInPlace(page, ["status"]);
  const BASE = "/proxy/e2e/7799/";
  const web = copyWebBuild();
  const proxied = await secondCore(browser, ["e2e-my-status"], { PERCH_WEB_DIST: web, PERCH_BASE_PATH: BASE }, BASE);
  try {
    const next = proxied.page;
    const root = `${proxied.origin}${BASE}`;
    const fetched: string[] = [];
    next.on("request", (request) => {
      const url = request.url();
      if (url.includes("stock-ui/") || url.includes("mods/package")) fetched.push(url);
    });
    const sidebar = next.locator('[data-testid="mod-view-stock:sidebar"]');
    const connection = next.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-connection");
    const workerOn = await next.evaluate(() => "serviceWorker" in navigator);
    if (workerOn) {
      // The worker installs (its precache complete) for the base path, and controls the page after a reload.
      expect(await next.evaluate(() => navigator.serviceWorker.ready.then((registration) => registration.scope))).toBe(root);
      await next.reload({ waitUntil: "networkidle" });
      await expect.poll(() => next.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000 }).toBe(true);
    } else {
      await next.reload({ waitUntil: "networkidle" });
    }
    await startChat(next);
    await expect(sidebar).toBeAttached({ timeout: 15000 });
    await expect(connection).toHaveAttribute("aria-label", "Connected", { timeout: 15000 });
    // Every stock file and the person's package came from under the base path.
    expect(fetched.some((url) => url.includes("stock-ui/sidebar/"))).toBe(true);
    expect(fetched.some((url) => url.includes("mods/package"))).toBe(true);
    for (const url of fetched) expect(url.startsWith(root), url).toBe(true);
    // A copy's edit shows live, and a reload runs the edited revision: the person's package is never served stale.
    const main = path.join(proxied.state, "mods", "e2e-my-status", "main.js");
    fs.writeFileSync(main, fs.readFileSync(main, "utf8").replace('"Connected"', '"Linked"'));
    await expect(connection).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
    await next.reload({ waitUntil: "networkidle" });
    await expect(connection).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
    if (!workerOn) return;

    // What the worker keeps: the shell with this build's stock screens, never a person's package or data.
    const cached = () => next.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url.replace(/\?__WB_REVISION__=.*$/, ""));
      return urls;
    });
    const kept = await cached();
    expect(kept).toContain(`${root}stock-ui/catalog.json`);
    expect(kept).toContain(`${root}stock-ui/sidebar/overview.js`);
    expect(kept.filter((url) => url.includes("mods/package") || url.includes("mods/data"))).toEqual([]);
    // Offline, the stock screens still come from the worker; the person's package does not. Playwright's WebKit
    // fails a page's fetches offline even where the worker would answer from its cache, so there the cache is read.
    const packageUrl = fetched.find((url) => url.includes("mods/package"))!;
    if (browserName === "chromium") {
      await next.context().setOffline(true);
      try {
        expect(await next.evaluate(() => fetch("stock-ui/catalog.json").then((response) => response.ok, () => false))).toBe(true);
        expect(await next.evaluate((url) => fetch(url).then(() => "fetched", () => "failed"), packageUrl)).toBe("failed");
      } finally {
        await next.context().setOffline(false);
      }
    } else {
      expect(await next.evaluate(() => caches.match("stock-ui/catalog.json", { ignoreSearch: true }).then((response) => !!response?.ok))).toBe(true);
      expect(await next.evaluate((url) => caches.match(url).then((response) => !!response), packageUrl)).toBe(false);
    }

    // A newer build: its sidebar differs, and its worker lists the changed files with new revisions. The open page
    // moves to it on the worker's update, stock screen and catalog together.
    const revision = restampStock(web, "sidebar", (dir) => {
      const overview = path.join(dir, "overview.js");
      fs.writeFileSync(overview, fs.readFileSync(overview, "utf8").replace('"Projects and workspaces"', '"Deployed projects and workspaces"'));
    });
    bumpPrecache(web, ["stock-ui/sidebar/overview.js", "stock-ui/catalog.json"]);
    await next.evaluate(() => navigator.serviceWorker.getRegistration().then((registration) => registration?.update()));
    await expect(next.locator('[aria-label="Deployed projects and workspaces"]')).toBeAttached({ timeout: 30000 });
    const catalog = await next.evaluate(() => fetch("stock-ui/catalog.json").then((response) => response.json())) as { packages: { id: string; revision: string }[] };
    expect(catalog.packages.find((entry) => entry.id === "sidebar")?.revision).toBe(revision);
    await expect(connection).toHaveAttribute("aria-label", "Linked", { timeout: 15000 });
  } finally {
    await proxied.stop();
    fs.rmSync(web, { recursive: true, force: true });
    await modsSet(page, { id: "stock:status", op: "use", target: "" }).catch(() => {});
  }
});

test("100 edits of a package keep one stylesheet and one view, and what the module loader keeps grows by one revision's files per edit", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  const EDITS = 100;
  write("mod.json", JSON.stringify({ name: "ESM", format: "esm", api: "^1.1" }));
  write("main.js", 'import { jsx } from "react/jsx-runtime";\nimport { label } from "./lib/dep.js";\nimport "./look.css";\nexport default function Panel() { return jsx("div", { "data-testid": "esm-cycle", className: "e2e-cycle", children: label }); }\n');
  write("look.css", ".e2e-cycle { color: rgb(0, 0, 0); }\n");
  write("lib/dep.js", 'export const label = "v0";');
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E ESM", type: "row", children: [{ type: "block", content: "sidebar", size: { px: 240 } }, { type: "block", content: "mod:e2e-esm" }] }));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
  const shown = block(page).getByTestId("esm-cycle");
  await expect(shown).toHaveText("v0", { timeout: 15000 });
  // What the page keeps: es-module-shims' registry (its `_r`, when it exposes one), the package's stylesheets and
  // the JS heap (Chromium only).
  const measure = () => page.evaluate(() => {
    const shim = (globalThis as unknown as { importShim?: { _r?: Record<string, unknown> } }).importShim;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    return { modules: shim?._r ? Object.keys(shim._r).filter((url) => url.includes("/e2e-esm/")).length : null, styles: document.querySelectorAll('style[data-mod-package="e2e-esm"]').length, heap };
  });
  const before = await measure();
  for (let n = 1; n <= EDITS; n++) {
    write("lib/dep.js", `export const label = "v${n}";`);
    write("look.css", `.e2e-cycle { color: rgb(${n}, 0, 0); }\n`);
    await expect(shown).toHaveText(`v${n}`, { timeout: 15000 });
    await expect(shown).toHaveCSS("color", `rgb(${n}, 0, 0)`);
  }
  const after = await measure();
  testInfo.annotations.push({ type: "module-cache", description: JSON.stringify({ edits: EDITS, before, after }) });
  console.log("MODULE-CACHE", JSON.stringify({ edits: EDITS, before, after }));
  await expect(shown).toHaveCount(1);
  expect(after.styles).toBe(1);
  // Each revision is a new set of module URLs (main.js, lib/dep.js and the CSS stub module): the registry keeps them
  // all, linear in the edits and never more. A reload starts it from the newest revision only.
  if (before.modules !== null && after.modules !== null) {
    expect(after.modules - before.modules).toBeGreaterThan(0);
    expect(after.modules - before.modules).toBeLessThanOrEqual(EDITS * 3);
    await page.reload({ waitUntil: "networkidle" });
    await expect(shown).toHaveText(`v${EDITS}`, { timeout: 15000 });
    expect((await measure()).modules).toBeLessThanOrEqual(before.modules);
  }
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// Faults and long runs. Nothing here stands in for the loader, the core or the socket: faults are injected at the
// network (a held or refused request, a socket message kept back), on disk (a file changed, removed or corrupted) or
// in the browser (storage that refuses writes), and the page's own reports are read off its socket.

/** What a page tells the core about loading a package (`mods.report`), read off its socket as it sends it. */
type LoadReport = { id: string; revision: string; error: string | null; phase?: string; instance?: string };
const isReport = (payload: unknown): payload is string => typeof payload === "string" && payload.includes('"mods.report"');
function watchReports(page: Page): LoadReport[] {
  const sent: LoadReport[] = [];
  page.on("websocket", (socket) => socket.on("framesent", ({ payload }) => { if (isReport(payload)) sent.push(JSON.parse(payload)); }));
  return sent;
}

/** From before the page's own code runs: the object URLs it holds (made and not yet revoked) and its live intervals
 * by period, read with `liveCounts`. */
const countLive = (page: Page) => page.addInitScript(() => {
  const blobs = new Set<string>();
  const intervals = new Map<number, number>();
  const make = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (object: Blob | MediaSource) => { const url = make(object); blobs.add(url); return url; };
  URL.revokeObjectURL = (url: string) => { blobs.delete(url); revoke(url); };
  const every = window.setInterval.bind(window);
  const stop = window.clearInterval.bind(window);
  window.setInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => { const id = every(handler, ms, ...args); intervals.set(id, Number(ms ?? 0)); return id; }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => { if (id !== undefined) intervals.delete(id); stop(id); }) as typeof window.clearInterval;
  (window as unknown as { __e2eLive(): { blobs: number; intervals: number[] } }).__e2eLive = () => ({ blobs: blobs.size, intervals: [...intervals.values()] });
});
type Live = { blobs: number; intervals: number[]; styles: number };
const liveCounts = (page: Page, id = "e2e-esm") => page.evaluate((id) => ({
  ...(window as unknown as { __e2eLive(): { blobs: number; intervals: number[] } }).__e2eLive(),
  styles: document.querySelectorAll(`style[data-mod-package="${id}"]`).length,
}), id) as Promise<Live>;
const intervalsOf = (live: Live, ms: number) => live.intervals.filter((every) => every === ms).length;

/** The core's current revision of package `id`, listed now (so snapshotted and retained by the core) over a socket of
 * the test's own: the page hears nothing of it. */
async function coreRevision(id: string, origin = "http://127.0.0.1:7799"): Promise<string | undefined> {
  const ws = new WebSocket(withLocalToken(`${origin.replace(/^http/, "ws")}/ws`));
  try {
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("the core's socket did not open")); });
    const requestId = crypto.randomUUID();
    const state = await new Promise<{ mods: { id: string; revision: string }[] }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("mods.list timed out")), 10_000);
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "mods.state" && message.requestId === requestId) { clearTimeout(timer); resolve(message); }
      };
      ws.send(JSON.stringify({ type: "mods.list", requestId, accepts: ["esm"] }));
    });
    return state.mods.find((mod) => mod.id === id)?.revision;
  } finally {
    ws.close();
  }
}

/** Writes `files` into package `dir` and returns the revision the core now lists for it. */
async function edit(files: Record<string, string>, dir = MOD, origin?: string): Promise<string> {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  const revision = await coreRevision(path.basename(dir), origin);
  if (!revision) throw new Error(`the core lists no ${path.basename(dir)}`);
  return revision;
}

/** A package with a label from a helper, a stylesheet naming its own image, the image, and a draft the copy keeps
 * (`useInstanceState`). `imports` are extra import lines of main.js. */
const faultPackage = (imports: string[] = []) => ({
  "mod.json": JSON.stringify({ name: "Faults", format: "esm", api: "^1.4", place: "layout" }),
  "main.js": [
    'import { jsx, jsxs } from "react/jsx-runtime";',
    'import { assetUrl, useInstanceState } from "@perch/sdk";',
    'import { label } from "./lib/dep.js";',
    'import "./look.css";',
    ...imports,
    "export default function Panel() {",
    '  const [draft, setDraft] = useInstanceState("draft", "");',
    '  return jsxs("div", { className: "e2e-fault", children: [',
    '    jsx("span", { "data-testid": "esm-label", children: label }),',
    '    jsx("img", { "data-testid": "esm-img", src: assetUrl("art/dot.svg"), alt: "" }),',
    '    jsx("input", { "data-testid": "esm-draft", "aria-label": "draft", value: draft, onChange: (event) => setDraft(event.target.value) }),',
    "  ] });",
    "}",
  ].join("\n"),
  "look.css": ".e2e-fault { background-image: url(art/dot.svg); color: rgb(7, 8, 9); }\n",
  "art/dot.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4"/></svg>',
});
const useBlockLayout = async (page: Page, extra: Record<string, unknown>[] = [], blockProps?: Record<string, unknown>) => {
  fs.mkdirSync(path.dirname(LAYOUT), { recursive: true });
  fs.writeFileSync(LAYOUT, JSON.stringify({ name: "E2E faults", type: "row", children: [
    ...extra,
    { type: "block", content: "mod:e2e-esm", size: { px: 420 }, ...(blockProps ? { props: blockProps } : {}) },
  ] }));
  await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
};

// These hold package requests with `page.route`, which in WebKit cannot see requests the service worker makes; the
// worker only passes packages through (the base-path test), so it is left out here.
test.describe(() => {
  test.use({ serviceWorkers: "block" });
  test("a package that cannot load keeps its last good view, says why and leaks nothing: a missing module, CSS naming a file it lacks, malformed JSON, and a revision the core dropped while the page was loading it", async ({ page }) => {
    test.setTimeout(180_000);
    page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
    await countLive(page);
    // The page's own socket, passed through untouched, except that while `behind` the core's "mods changed" news is
    // kept from the page (a page that has not heard of the newest edits yet). What it reports is read on the way out.
    let behind = false;
    let keptBack = 0;
    const reports: LoadReport[] = [];
    await page.routeWebSocket(/\/ws(\?|$)/, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((message) => { if (isReport(message)) reports.push(JSON.parse(message)); server.send(message); });
      server.onMessage((message) => {
        if (behind && typeof message === "string" && message.includes('"type":"mods.changed"')) keptBack++;
        else ws.send(message);
      });
    });
    const good = await edit({ ...faultPackage(), "lib/dep.js": 'export const label = "a";' });
    await page.goto("/", { waitUntil: "networkidle" });
    await useBlockLayout(page, [{ type: "block", content: "sidebar", size: { px: 240 } }]);
    const label = block(page).getByTestId("esm-label");
    const draft = block(page).getByTestId("esm-draft");
    const error = block(page).getByTestId("mod-error");
    await expect(label).toHaveText("a", { timeout: 15000 });
    await expect(block(page).getByTestId("esm-img")).toHaveAttribute("src", /^blob:/);
    await draft.fill("unsent words");
    const baseline = await liveCounts(page);
    expect(baseline.styles).toBe(1);
    /** After a bad edit: the error names `file`, the last good view and the draft are still there, and the page never
     * reported the bad revision as working. */
    const keptLastGood = async (bad: string, file: RegExp) => {
      await expect(error).toContainText(file, { timeout: 15000 });
      await expect(error).toContainText("The last working version is still showing.");
      await expect(label).toHaveText("a");
      await expect(draft).toHaveValue("unsent words");
      await expect.poll(() => reports.some((r) => r.revision === bad && r.phase === "load" && r.error && file.test(r.error))).toBe(true);
      expect(reports.filter((r) => r.revision === bad && r.error === null)).toEqual([]);
      expect((await liveCounts(page)).styles).toBe(1);
    };
    /** The good files again: the same revision as before, so nothing reloads and the error goes. */
    const undo = async () => {
      expect(await edit({ ...faultPackage(), "lib/dep.js": 'export const label = "a";' })).toBe(good);
      await expect(error).toHaveCount(0, { timeout: 15000 });
      await expect(label).toHaveText("a");
      await expect(draft).toHaveValue("unsent words");
    };

    // A module main.js imports is not in the package.
    await keptLastGood(await edit({ "main.js": faultPackage(['import { nope } from "./nope.js";'])["main.js"] }), /nope\.js: could not load it \(404\)/);
    await undo();
    // The stylesheet names an image the package does not have.
    await keptLastGood(await edit({ "look.css": ".e2e-fault { background-image: url(art/gone.svg); }\n" }), /look\.css: url\(art\/gone\.svg\) names no file of this package/);
    await undo();
    // A JSON module that is not JSON.
    fs.writeFileSync(path.join(MOD, "data.json"), '{ "label": ');
    await keptLastGood(await edit({ "main.js": faultPackage(['import data from "./data.json" with { type: "json" };'])["main.js"] }), /data\.json: not valid JSON/);
    fs.rmSync(path.join(MOD, "data.json"));
    await undo();
    // Every failed revision's assets were revoked and its styles never shown: what the page holds is what it held.
    expect(await liveCounts(page)).toEqual(baseline);

    // A revision dropped while the page was loading it: the page hears of B and starts loading it (its files held on
    // the way), then falls behind while the core takes four newer revisions (C-F), so B is no longer kept.
    const held: { release(): Promise<void> }[] = [];
    let holding = true;
    await page.route(/\/mods\/package\?/, async (route) => {
      if (!holding || new URL(route.request().url()).searchParams.get("rev") === good) return route.continue();
      held.push({ release: () => route.continue().catch(() => {}) });
    });
    const b = await edit({ "lib/dep.js": 'export const label = "b";' });
    await expect.poll(() => held.length, { timeout: 15000 }).toBeGreaterThan(0);
    behind = true;
    let newest = b;
    for (const name of ["c", "d", "e", "f"]) newest = await edit({ "lib/dep.js": `export const label = "${name}";` });
    // The core's own 2 s look has noticed the last edit too (and that news was kept back), so only the page itself can
    // ask for the newest list now.
    const seen = keptBack;
    await expect.poll(() => keptBack, { timeout: 15000 }).toBeGreaterThan(seen);
    behind = false;
    holding = false;
    for (const request of held.splice(0)) await request.release();
    // The page says why B failed, asks for the newest list itself, and loads F; B never showed.
    await expect.poll(() => reports.some((r) => r.revision === b && r.phase === "load" && /this revision is no longer kept/.test(r.error ?? "")), { timeout: 15000 }).toBe(true);
    await expect(label).toHaveText("f", { timeout: 15000 });
    await expect(error).toHaveCount(0);
    expect(reports.filter((r) => r.revision === b && r.error === null)).toEqual([]);
    await expect.poll(() => reports.some((r) => r.revision === newest && r.error === null && r.phase === "render")).toBe(true);
    await expect(draft).toHaveValue("unsent words");
    expect(await liveCounts(page)).toEqual(baseline);
    expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  });
});

test("a package's throwing cleanups are reported when it is replaced or closed, and never take Perch down", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  const reports = watchReports(page);
  const leaky = {
    "mod.json": JSON.stringify({ name: "Leaky", format: "esm", api: "^1" }),
    "main.js": [
      'import { useEffect } from "react";',
      'import { jsx } from "react/jsx-runtime";',
      'import { label } from "./lib/dep.js";',
      "export default function Panel({ api }) {",
      '  useEffect(() => () => { throw new Error("effect cleanup of " + label); }, []);',
      // An overlay the package leaves open, whose own cleanup throws when Perch closes it with the copy.
      '  useEffect(() => { api.overlay((el) => { el.textContent = "overlay of " + label; return () => { throw new Error("overlay cleanup of " + label); }; }); }, [api]);',
      '  return jsx("span", { "data-testid": "esm-label", children: label });',
      "}",
    ].join("\n"),
  };
  const a = await edit({ ...leaky, "lib/dep.js": 'export const label = "a";' });
  await page.goto("/", { waitUntil: "networkidle" });
  await useBlockLayout(page, [{ type: "block", content: "sidebar", size: { px: 240 } }]);
  const label = block(page).getByTestId("esm-label");
  await expect(label).toHaveText("a", { timeout: 15000 });
  await expect(page.getByText("overlay of a")).toBeVisible();
  const perch = page.locator('[data-testid="mod-view-stock:sidebar"]');
  await expect(perch).toBeAttached();

  // Replaced: the new revision shows, both of the old one's cleanups threw and are reported, its overlay is gone.
  const b = await edit({ "lib/dep.js": 'export const label = "b";' });
  await expect(label).toHaveText("b", { timeout: 15000 });
  await expect(page.getByText("overlay of a")).toHaveCount(0);
  await expect(page.getByText("overlay of b")).toBeVisible();
  for (const what of ["effect cleanup of a", "overlay cleanup of a"]) {
    await expect.poll(() => reports.some((r) => r.revision === a && r.phase === "disposal" && r.error === what), { timeout: 10000 }).toBe(true);
  }
  await expect(perch).toBeAttached();
  await expect(block(page).getByTestId("mod-error")).toHaveCount(0);

  // Closed (Perch as shipped again): the same, and Perch's window is whole.
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  await expect(block(page)).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText("overlay of b")).toHaveCount(0);
  for (const what of ["effect cleanup of b", "overlay cleanup of b"]) {
    await expect.poll(() => reports.some((r) => r.revision === b && r.phase === "disposal" && r.error === what), { timeout: 10000 }).toBe(true);
  }
  await expect(page.locator('[data-testid="mod-view-stock:sidebar"]')).toBeVisible();
  await expect(page.getByTestId("new-session-local")).toBeVisible();
});

test("an expired revision says so: code still showing an old revision the core no longer keeps gets a readable error for its lazy import, and the newest shows once its work is done", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  const reports = watchReports(page);
  const files = (name: string) => ({
    "mod.json": JSON.stringify({ name: "Expiring", format: "esm", api: "^1.4" }),
    "main.js": [
      'import { useState } from "react";',
      'import { jsx, jsxs } from "react/jsx-runtime";',
      'import { useInstance } from "@perch/sdk";',
      'import { label } from "./lib/dep.js";',
      "export default function Panel() {",
      "  const instance = useInstance();",
      '  const [lazy, setLazy] = useState("");',
      // Below Perch's "a newer version is waiting" line, which sits over the copy's top edge.
      '  return jsxs("div", { style: { paddingTop: "4em" }, children: [',
      '    jsx("span", { "data-testid": "esm-label", children: label }),',
      // Work in flight (a send): a newer revision waits for it before it replaces this one.
      '    jsx("button", { "data-testid": "esm-hold", onClick: () => instance.trackOperation(new Promise((done) => { window.__e2eFinish = done; })), children: "hold" }),',
      '    jsx("button", { "data-testid": "esm-lazy", onClick: () => import("./lazy.js").then((m) => setLazy(m.value), (error) => setLazy("failed: " + error.message)), children: "lazy" }),',
      '    jsx("span", { "data-testid": "esm-lazy-result", children: lazy }),',
      "  ] });",
      "}",
    ].join("\n"),
    "lazy.js": 'export const value = "lazy-ok";',
    "lib/dep.js": `export const label = "${name}";`,
  });
  const a = await edit(files("a"));
  await page.goto("/", { waitUntil: "networkidle" });
  await useBlockLayout(page);
  const label = block(page).getByTestId("esm-label");
  await expect(label).toHaveText("a", { timeout: 15000 });
  await block(page).getByTestId("esm-hold").click();
  // Four newer revisions: the core keeps four (`RETAINED_SNAPSHOTS`), so A is gone; the page waits to swap.
  let newest = a;
  for (const name of ["b", "c", "d", "e"]) newest = await edit({ "lib/dep.js": `export const label = "${name}";` });
  await expect(block(page).getByTestId("mod-update-waiting")).toBeVisible({ timeout: 15000 });
  await expect(label).toHaveText("a");
  await block(page).getByTestId("esm-lazy").click();
  await expect(block(page).getByTestId("esm-lazy-result")).toHaveText(/^failed: .*lazy\.js: this revision is no longer kept; it loads again from the newest/, { timeout: 15000 });
  // The work finishes: the newest revision shows, not reported as a swap made over pending work.
  await page.evaluate(() => (window as unknown as { __e2eFinish(): void }).__e2eFinish());
  await expect(label).toHaveText("e", { timeout: 15000 });
  await expect(block(page).getByTestId("mod-update-waiting")).toHaveCount(0);
  await expect.poll(() => reports.some((r) => r.revision === newest && r.phase === "render" && r.error === null)).toBe(true);
  expect(reports.filter((r) => r.phase === "swap" && r.error)).toEqual([]);
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

/** A core on private state that can be stopped and started again on the same port and state, as an update or a crash
 * would; the test removes its runtimes and state at the end (`stop`). */
async function restartableCore(browser: Browser) {
  const state = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-restart-core-")));
  const listener = net.createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise((resolve) => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const root = path.resolve(__dirname, "..");
  let core: ChildProcess | null = null;
  const start = async () => {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port)], {
      cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(state), PERCH_NO_LOGIN_PATH: "1" }, stdio: "inherit",
    });
    await expect.poll(async () => (await fetch(origin).catch(() => null))?.ok ?? false, { timeout: 30000 }).toBe(true);
  };
  const halt = async () => {
    const running = core;
    core = null;
    if (!running || running.exitCode !== null || running.signalCode !== null) return;
    const exited = once(running, "exit");
    running.kill("SIGTERM");
    await exited;
  };
  // Without the service worker: the restart test holds package requests with `page.route`, which in WebKit cannot
  // see requests the worker makes (it only passes packages through, as the base-path test shows).
  const page = await browser.newPage({ storageState: localStorageState(), serviceWorkers: "block" });
  page.on("pageerror", (error) => console.log("RESTART CORE PAGEERROR", error.message));
  await page.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  const stop = async () => {
    await page.close().catch(() => {});
    await halt();
    try {
      await cleanupFixtureRuntime(root, state);
      fs.rmSync(state, { recursive: true, force: true });
    } catch (error) {
      console.log(`RESTART CORE: runtimes not confirmed stopped, ${state} kept for review: ${error}`);
    }
  };
  try {
    await start();
  } catch (error) {
    await stop();
    throw error;
  }
  return { state, origin, page, start, halt, stop };
}

test("a core restart in the middle of a swap keeps the last good view and the draft, says why, then loads the new revision; the terminal is the same process", async ({ browser }) => {
  test.setTimeout(150_000);
  const core = await restartableCore(browser);
  try {
    const { page, origin, state } = core;
    const reports = watchReports(page);
    const dir = path.join(state, "mods", "e2e-esm");
    const good = await edit({ ...faultPackage(), "lib/dep.js": 'export const label = "a";' }, dir, origin);
    await page.goto(origin, { waitUntil: "networkidle" });
    const sessionId = await startChat(page, "terminal");
    const terminal = page.locator(`[data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
    const terminalId = await terminal.getAttribute("data-terminal-id");
    await terminal.locator(".xterm").click();
    await page.keyboard.type("echo PID_$$\n");
    await expect.poll(() => screenText(terminal), { timeout: 15000 }).toMatch(/PID_\d+/);
    const pid = /PID_(\d+)/.exec(await screenText(terminal))![1];
    fs.mkdirSync(path.join(state, "layouts"), { recursive: true });
    fs.writeFileSync(path.join(state, "layouts", "e2e-esm-look.json"), JSON.stringify({ name: "E2E restart", type: "row", children: [
      { type: "block", content: "canvas" }, { type: "block", content: "mod:e2e-esm", size: { px: 320 } },
    ] }));
    await expect.poll(() => modsSet(page, { id: "e2e-esm-look", op: "layout" }), { timeout: 15000 }).toBeNull();
    const label = block(page).getByTestId("esm-label");
    const draft = block(page).getByTestId("esm-draft");
    await expect(label).toHaveText("a", { timeout: 15000 });
    await draft.fill("typed before the restart");

    // B's files are held on the way while the core stops; then they go to a core that is not there.
    const held: { release(): Promise<void> }[] = [];
    let holding = true;
    await page.route(/\/mods\/package\?/, async (route) => {
      if (!holding || new URL(route.request().url()).searchParams.get("rev") === good) return route.continue();
      held.push({ release: () => route.continue().catch(() => {}) });
    });
    const b = await edit({ "lib/dep.js": 'export const label = "b";' }, dir, origin);
    await expect.poll(() => held.length, { timeout: 15000 }).toBeGreaterThan(0);
    await core.halt();
    holding = false;
    for (const request of held.splice(0)) await request.release();
    const error = block(page).getByTestId("mod-error");
    await expect(error).toContainText("Perch could not be reached", { timeout: 15000 });
    await expect(error).toContainText("The last working version is still showing.");
    await expect(label).toHaveText("a");
    await expect(draft).toHaveValue("typed before the restart");

    // Perch is back: the page reconnects, hears the mods again and loads B; the draft and the terminal are the same.
    await core.start();
    await expect(label).toHaveText("b", { timeout: 45000 });
    await expect(error).toHaveCount(0);
    await expect(draft).toHaveValue("typed before the restart");
    await expect.poll(() => reports.some((r) => r.revision === b && r.phase === "render" && r.error === null)).toBe(true);
    // The restarted core attaches its own terminal record to the shell the daemon kept: the same process, its
    // history, one view of it.
    console.log("RESTART TERMINAL", terminalId, "->", await terminal.getAttribute("data-terminal-id"));
    await expect(page.locator(".terminal__host")).toHaveCount(1);
    await terminal.locator(".xterm").click();
    await page.keyboard.type("echo AGAIN_$$\n");
    await expect.poll(() => screenText(terminal), { timeout: 30000 }).toContain(`AGAIN_${pid}`);
    expect(await screenText(terminal)).toContain(`PID_${pid}`);
  } finally {
    await core.stop();
  }
});

test("blocked storage and bad mod data: a page whose storage refuses writes still runs the chosen copy and says the phone choice was not saved; corrupt, conflicting and oversized data are refused with the reason and nothing is lost", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  // Storage that refuses every write (full, or turned off for the site) from before the page's code runs, once the
  // session and the chosen copy are set up.
  await page.addInitScript(() => {
    if (localStorage.getItem("e2e.blockWrites") !== "1") return;
    Storage.prototype.setItem = function setItem() { throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); };
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await startChat(page);
  await cloneInPlace(page, ["status"]);
  markRoot("e2e-my-status", '"status-host"');
  const copy = page.locator('[data-testid="mod-view-e2e-my-status"]').getByTestId("status-host");
  await expect(copy).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  await page.evaluate(() => localStorage.setItem("e2e.blockWrites", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(copy).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  expect(await page.evaluate(() => { try { localStorage.setItem("e2e.probe", "1"); return "written"; } catch (error) { return (error as Error).name; } })).toBe("QuotaExceededError");
  // Nothing could be written to mark it starting, so a reload runs it again rather than turning it off.
  await page.reload({ waitUntil: "networkidle" });
  await expect(copy).toHaveAttribute("data-e2e-copy", "edited", { timeout: 15000 });
  expect(await page.evaluate(() => { try { return localStorage.getItem("perch.mods.booting"); } catch { return "unreadable"; } })).toBeNull();
  // At phone width, turning on the phone's own copies cannot be saved: it says so and stays off.
  await page.setViewportSize({ width: 390, height: 844 });
  await settingsOpen(page, true);
  await page.getByTestId("settings-nav-mods").click();
  const toggle = page.getByTestId("settings-phone-mods");
  await toggle.click();
  await expect(page.getByText("This browser would not save the choice (site storage is off), so Perch's own phone screens stay.")).toBeVisible({ timeout: 10000 });
  await expect(toggle).not.toBeChecked();
  await settingsOpen(page, false);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await modsSet(page, { id: "stock:status", op: "use", target: "" })).toBeNull();

  // A package's durable data: a value cut short on disk reads as corrupt (with its revision), a write expecting no
  // value is a conflict, one too big is refused; the bad bytes stay until a write naming them replaces them, and then
  // they are kept aside.
  const store = path.join(HOME, "mod-data", "e2e-esm");
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(path.join(store, "notes.json"), '{"cut short');
  await edit({
    "mod.json": JSON.stringify({ name: "Data", format: "esm", api: "^1.6" }),
    "main.js": [
      'import { useEffect, useState } from "react";',
      'import { jsx, jsxs } from "react/jsx-runtime";',
      'import { useModData } from "@perch/sdk";',
      "export default function Panel() {",
      "  const data = useModData();",
      '  const [said, setSaid] = useState("reading");',
      "  const [bad, setBad] = useState(null);",
      '  const show = (promise) => promise.then((v) => setSaid("value " + JSON.stringify(v && v.value !== undefined ? v.value : v)), (e) => { if (e.code === "corrupt") setBad(e.revision); setSaid((e.code || "error") + ": " + e.message); });',
      '  useEffect(() => { show(data.read("notes")); }, [data]);',
      '  const button = (id, run) => jsx("button", { "data-testid": id, onClick: run, children: id });',
      '  return jsxs("div", { children: [jsx("span", { "data-testid": "esm-data", children: said }),',
      '    button("as-new", () => show(data.write("notes", { fresh: true }, { expected: null }))),',
      '    button("too-big", () => show(data.write("notes", "x".repeat(1100000)))),',
      '    button("replace", () => show(data.write("notes", { fixed: true }, { expected: bad }).then(() => data.read("notes")))),',
      "  ] });",
      "}",
    ].join("\n"),
  });
  await useBlockLayout(page);
  const said = block(page).getByTestId("esm-data");
  await expect(said).toHaveText(/^corrupt: /, { timeout: 15000 });
  await block(page).getByTestId("as-new").click();
  await expect(said).toHaveText(/^conflict: /);
  await block(page).getByTestId("too-big").click();
  await expect(said).toHaveText(/^error: a value is at most \d+ KiB as JSON/);
  expect(fs.readFileSync(path.join(store, "notes.json"), "utf8")).toBe('{"cut short');
  await block(page).getByTestId("replace").click();
  await expect(said).toHaveText('value {"fixed":true}');
  const aside = fs.readdirSync(path.join(store, ".corrupt"));
  expect(aside).toHaveLength(1);
  expect(fs.readFileSync(path.join(store, ".corrupt", aside[0]!), "utf8")).toBe('{"cut short');
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
});

test("100 edit cycles of a package that holds a live terminal, a draft, a command, timers, a data watch and tracked work: one of each stays live, the draft and the shell's process stay, and every tracked operation runs once", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  await countLive(page);
  const reports = watchReports(page);
  await page.goto("/", { waitUntil: "networkidle" });
  const sessionId = await startChat(page, "terminal");
  const canvas = page.locator(`.dock-area [data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
  const terminalId = await canvas.getAttribute("data-terminal-id");
  await canvas.locator(".xterm").click();
  await page.keyboard.type("echo PID_$$\n");
  await expect.poll(() => screenText(canvas), { timeout: 15000 }).toMatch(/PID_\d+/);
  const pid = /PID_(\d+)/.exec(await screenText(canvas))![1];
  // Distinct periods, so each kind of interval can be counted: the package's own (1234 ms) and its data watch's (60 s).
  const OWN_TIMER = 1234, WATCH_TIMER = 60_000;
  // Perch itself may run a 60 s interval too; the package's watch adds one to that.
  const appWatchTimers = intervalsOf(await liveCounts(page), WATCH_TIMER);
  const cycle = (n: number) => ({
    "lib/dep.js": `export const label = "v${n}";`,
    "look.css": `.e2e-cycle { color: rgb(${n % 256}, 0, 0); background-image: url(art/dot.svg); }\n`,
  });
  await edit({
    // Only the layout block shows it (with no `place` it is also a dock panel, and `none` runs a hidden copy).
    "mod.json": JSON.stringify({ name: "Cycles", format: "esm", api: "^1.6", place: "layout" }),
    "main.js": [
      'import { useEffect } from "react";',
      'import { jsx, jsxs } from "react/jsx-runtime";',
      'import { assetUrl, Layout, useInstance, useInstanceState, useModData } from "@perch/sdk";',
      'import { label } from "./lib/dep.js";',
      'import "./look.css";',
      "export default function Panel({ api, session }) {",
      '  const [draft, setDraft] = useInstanceState("draft", "");',
      "  const instance = useInstance();",
      "  const data = useModData();",
      "  useEffect(() => {",
      "    const live = (globalThis.__e2eCycle ??= { mounted: 0, ticks: 0 });",
      "    live.mounted++;",
      `    const timer = setInterval(() => { live.ticks++; }, ${OWN_TIMER});`,
      "    return () => { live.mounted--; clearInterval(timer); };",
      "  }, []);",
      '  useEffect(() => api.command({ name: "e2e-cycle-ping", description: "Ping the cycling package", run: () => {} }), [api]);',
      `  useEffect(() => data.watch(() => {}, ${WATCH_TIMER}), [data]);`,
      "  useEffect(() => api.subscribe(() => {}), [api]);",
      "  useEffect(() => { globalThis.__e2eCommands = () => api.commands().filter((c) => c.id.includes(\"e2e-cycle-ping\")).length; }, [api]);",
      // Tracked work: append this revision's label to a list, expecting the list as read (a replay would conflict or duplicate).
      '  const work = () => instance.trackOperation(() => data.read("ops").then((v) => data.write("ops", [...(v ? v.value : []), label], { expected: v ? v.revision : null })));',
      '  return jsxs("div", { className: "e2e-cycle", style: { display: "flex", flexDirection: "column", height: "100%" }, children: [',
      '    jsx("span", { "data-testid": "esm-cycle", children: label }),',
      '    jsx("img", { src: assetUrl("art/dot.svg"), alt: "" }),',
      '    jsx("input", { "data-testid": "esm-draft", "aria-label": "draft", value: draft, onChange: (event) => setDraft(event.target.value) }),',
      '    jsx("button", { "data-testid": "esm-op", onClick: () => { void work(); }, children: "op" }),',
      '    jsx("div", { "data-testid": "esm-terminal", style: { flex: 1, minHeight: 200, display: "flex" }, children: jsx(Layout, { node: { type: "row", children: [{ type: "block", content: "session:" + session }] } }) }),',
      "  ] });",
      "}",
    ].join("\n"),
    "art/dot.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
    ...cycle(0),
  });
  await useBlockLayout(page, [{ type: "block", content: "canvas" }], { session: sessionId });
  const shown = block(page).getByTestId("esm-cycle");
  const draft = block(page).getByTestId("esm-draft");
  const composed = block(page).locator(`[data-testid="esm-terminal"] [data-testid="persistent-agent-terminal"][data-session-id="${sessionId}"]`);
  await expect(shown).toHaveText("v0", { timeout: 15000 });
  await expect(composed.locator(".terminal__host")).toHaveCount(1, { timeout: 15000 });
  await draft.fill("a draft through every edit");
  const measure = async () => {
    const live = await liveCounts(page);
    const own = await page.evaluate(() => {
      const scope = globalThis as unknown as { __e2eCycle?: { mounted: number }; __e2eCommands?: () => number; importShim?: { _r?: Record<string, unknown> } };
      return {
        mounted: scope.__e2eCycle?.mounted ?? 0,
        commands: scope.__e2eCommands?.() ?? 0,
        modules: scope.importShim?._r ? Object.keys(scope.importShim._r).filter((url) => url.includes("/e2e-esm/")).length : null,
        heap: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      };
    });
    return {
      ...own, blobs: live.blobs, intervals: live.intervals.length, ownTimers: intervalsOf(live, OWN_TIMER), watchTimers: intervalsOf(live, WATCH_TIMER),
      styles: live.styles, terminals: await page.locator(".terminal__host").count(), xterms: await page.locator(".xterm").count(),
      waiting: await block(page).getByTestId("mod-update-waiting").count(),
    };
  };
  const before = await measure();
  const checkpoints: Record<number, Awaited<ReturnType<typeof measure>>> = { 0: before };
  const ops: string[] = [];
  const CYCLES = 100;
  for (let n = 1; n <= CYCLES; n++) {
    // Tracked work started in this revision, every 20 cycles, then the edit that replaces it.
    if (n % 20 === 0) { await block(page).getByTestId("esm-op").click(); ops.push(`v${n - 1}`); }
    await edit(cycle(n));
    await expect(shown).toHaveText(`v${n}`, { timeout: 15000 });
    if (n % 25 === 0) checkpoints[n] = await measure();
  }
  const after = checkpoints[CYCLES]!;
  testInfo.annotations.push({ type: "edit-cycles", description: JSON.stringify(checkpoints) });
  console.log("EDIT-CYCLES", JSON.stringify(checkpoints));
  // One of everything the package holds, as at the start.
  for (const at of Object.values(checkpoints)) {
    expect(at).toMatchObject({ mounted: 1, commands: 1, ownTimers: 1, watchTimers: appWatchTimers + 1, styles: 1, terminals: 1, xterms: 1 });
    expect(at.blobs).toBe(before.blobs);
  }
  expect(after.intervals).toBeLessThanOrEqual(before.intervals);
  await expect(draft).toHaveValue("a draft through every edit");
  // Every tracked operation ran once, in its own revision, none replayed by a later one.
  const store = path.join(HOME, "mod-data", "e2e-esm", "ops.json");
  await expect.poll(() => (fs.existsSync(store) ? JSON.parse(fs.readFileSync(store, "utf8")) : null), { timeout: 15000 }).toEqual(ops);
  // Each revision reported once as rendered, none as failed; no swap was forced over pending work.
  expect(reports.filter((r) => r.id === "e2e-esm" && r.error)).toEqual([]);
  expect(new Set(reports.filter((r) => r.id === "e2e-esm" && r.phase === "render" && r.error === null).map((r) => r.revision)).size).toBe(CYCLES + 1);
  // The same terminal and shell process, and its input still reaches it.
  await expect(composed).toHaveAttribute("data-terminal-id", terminalId!);
  await composed.locator(".xterm").click();
  await page.keyboard.type("echo AFTER_$$\n");
  await expect.poll(() => screenText(composed), { timeout: 15000 }).toContain(`AFTER_${pid}`);
  expect(await modsSet(page, { id: "", op: "layout" })).toBeNull();
  await expect(canvas.locator(".terminal__host")).toHaveCount(1, { timeout: 15000 });
});
