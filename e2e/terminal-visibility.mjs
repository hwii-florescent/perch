#!/usr/bin/env node
/** node e2e/terminal-visibility.mjs
 * Real xterm hide/show regression in headless Chromium + WebKit, with and
 * without WebGL. No core, daemon, PTY, paid turns or installed app access.
 * Bundles the shared terminal factory in memory; screenshots go to /tmp.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(path.join(tmpdir(), "perch-terminal-visibility-"));
const bundle = await build({
  entryPoints: [path.join(root, "packages/web/src/xtermSetup.ts")],
  bundle: true, format: "esm", platform: "browser", write: false,
});
const script = `${bundle.outputFiles[0].text}\nwindow.createPerchTerminal = createPerchTerminal;`;
const css = readFileSync(path.join(root, "node_modules/@xterm/xterm/css/xterm.css"), "utf8")
  + readFileSync(path.join(root, "packages/web/src/styles/terminal.css"), "utf8");
const html = `<!doctype html><style>${css}
  body { margin: 0 } #mount { width: 900px; height: 600px }
  </style><div id="mount" class="terminal__surface"></div><script type="module" src="/terminal.js"></script>`;
const server = createServer((request, response) => {
  response.setHeader("Content-Type", request.url === "/terminal.js" ? "text/javascript" : "text/html");
  response.end(request.url === "/terminal.js" ? script : html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  for (const [engine, launcher] of [["webkit", webkit], ["chromium", chromium]]) {
    for (const renderer of ["webgl", "dom", "unavailable"]) {
      browser = await launcher.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((renderer) => {
        // xtermSetup imports the store, whose module initialization connects.
        // Stub before import so this fixture cannot reach any running core.
        globalThis.WebSocket = class {
          static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
          readyState = 0;
          addEventListener() {} removeEventListener() {} send() {} close() {}
        };
        if (renderer !== "dom") Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
        if (renderer === "unavailable") {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            return type === "webgl2" ? null : getContext.call(this, type, ...args);
          };
        }
      }, renderer);
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => !!window.createPerchTerminal);
      await page.evaluate(async () => {
        window.host = document.createElement("div");
        window.host.className = "terminal__host";
        document.getElementById("mount").append(window.host);
        window.resizes = [];
        window.ownsResize = true;
        window.view = window.createPerchTerminal(window.host, (cols, rows) => window.resizes.push([cols, rows]),
          { fontFamily: "Menlo", fontSize: 13 }, () => window.ownsResize);
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, 100));
        window.view.fit();
        await new Promise((resolve) => window.view.term.write("\x1b[?25l"
          + Array.from({ length: 35 }, (_, i) => `transcript ${i}`).join("\r\n") + "\r\nPROMPT\r\npi-lens footer", resolve));
        window.capture = () => {
          const term = window.view.term, buffer = term.buffer.active;
          return {
            cols: term.cols, rows: term.rows, baseY: buffer.baseY,
            cursorX: buffer.cursorX, cursorY: buffer.cursorY,
            lines: Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i)?.translateToString(true)),
            canvas: !!term.screenElement.querySelector("canvas"),
          };
        };
      });
      const baseline = await page.evaluate(() => window.capture());
      assert.equal(baseline.canvas, renderer === "webgl", `${engine}/${renderer}: expected renderer`);
      assert.equal(await page.evaluate(() => window.resizes.length), 1, "one initial grid, not DOM then WebGL");
      const pixels = async () => createHash("sha256").update(await page.locator(".xterm-screen").screenshot()).digest("hex");
      const before = await pixels();
      for (let cycle = 0; cycle < 20; cycle++) {
        // Exactly terminalKeeper.park/show: detach, append, immediately fit.
        await page.evaluate(() => window.host.remove());
        await page.waitForTimeout(40);
        await page.evaluate(() => { document.getElementById("mount").append(window.host); window.view.fit(); });
        await page.waitForTimeout(80);
        assert.deepEqual(await page.evaluate(() => window.capture()), baseline, `${engine}/${renderer}: cycle ${cycle}`);
      }
      assert.equal(await page.evaluate(() => window.resizes.length), 1, "same-size tab switches must not resize the PTY");
      assert.equal(await pixels(), before, "same buffer must paint the same pixels after WebGL restoration");
      await page.screenshot({ path: path.join(work, `${engine}-${renderer}.png`) });
      // A size change while parked must still fit once after renderer restoration.
      await page.evaluate(() => window.host.remove());
      await page.waitForTimeout(40);
      await page.evaluate(() => {
        document.getElementById("mount").style.width = "700px";
        window.view.fit();
        document.getElementById("mount").append(window.host);
        window.view.fit();
      });
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.resizes.length), 2, "parked size change must fit only the restored renderer");
      assert.equal(await page.evaluate(() => window.view.term.cols === Math.floor(700 / window.view.term.dimensions.css.cell.width)), true);
      // Passive views keep the authority's grid, even when their box changes.
      await page.evaluate(() => { window.ownsResize = false; window.view.follow(93, 31); window.host.remove(); });
      await page.waitForTimeout(40);
      await page.evaluate(() => { document.getElementById("mount").append(window.host); window.view.fit(); });
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(() => [window.view.term.cols, window.view.term.rows]), [93, 31]);
      assert.equal(await page.evaluate(() => window.resizes.length), 2, "passive view must not resize the PTY");
      assert.deepEqual(errors, [], `${engine}/${renderer}: page errors`);
      await page.evaluate(() => window.view.dispose());
      console.log(`ok ${engine}/${renderer}: stable grid and pixels through 20 switches; parked resize; passive view`);
      await browser.close();
      browser = null;
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(`Screenshots: ${work}`);
}
