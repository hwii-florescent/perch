#!/usr/bin/env node
/**
 * Terminal memory and GPU check, in headless WebKit (the Mac app is a
 * WKWebView).
 *
 *   node e2e/memory/memory.mjs [--renderer webgl|dom]
 *
 * Boots an isolated core on :7792 serving packages/web/dist (`npm run build`
 * first), mocks 20 agent sessions in the page (no real agent) and checks:
 *  - the peak physical footprint (vmmap) of this run's renderer process
 *    through 120 repaints of a colourful full-screen TUI stays under 300 MB.
 *    The DOM renderer peaks at ~640-940 MB on the same frames.
 *  - a lost WebGL context is replaced, however many times, as long as the
 *    losses are spread out; a burst of them leaves the terminal on DOM.
 *  - only a shown terminal holds a live WebGL context.
 *  - visiting 20 sessions keeps at most KEEP + 1 terminals alive, and
 *    closing every session leaves none (counted by WeakRef after GC).
 *  - with WebGL2 unavailable, revisiting terminals adds no xterm addons.
 * `--renderer dom` keeps automation's DOM renderer, for comparison: it
 * only reports the footprint. Exits nonzero on any failure, page error or
 * missing measurement. Hidden Dockview tabs: workspace-tabs.spec.ts W6.
 *
 * Headless only; never touches ~/.perch.
 */
import { webkit } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = 7792;
const URL_ = `http://127.0.0.1:${PORT}/`;
const WORK = "/tmp/perch-memory";
const KEEP = 12; // terminalKeeper.ts
const webgl = !process.argv.includes("dom");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (ok, message) => { console.log(`${ok ? "ok  " : "FAIL"} ${message}`); if (!ok) failures.push(message); };

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
const logFile = fs.openSync(`${WORK}/core.log`, "a");
const core = spawn(`${root}/target/debug/perch-core`, ["--port", String(PORT), "--db-path", `${WORK}/history.sqlite`, "--hosts-path", `${WORK}/hosts.json`], {
  cwd: root, stdio: ["ignore", logFile, logFile],
  env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", PERCH_WEB_DIST: `${root}/packages/web/dist`, PERCH_SETTINGS: `${WORK}/settings.json`, PERCHD_DIR: `${WORK}/daemon` },
});

/** WebContent processes are launchd's children, not the browser's: this
 * run's is the one that appears while it loads its page. */
const contentPids = () => new Set(execFileSync("ps", ["-ww", "-axo", "pid,args"], { encoding: "utf8" }).split("\n")
  .filter((line) => /ms-playwright/.test(line) && /WebContent/.test(line)).map((line) => line.trim().split(/\s+/)[0]));

/** MB of physical footprint (what Activity Monitor shows), now and at its
 * peak. Not RSS: WebKit's allocator keeps freed pages resident but
 * reusable, so RSS stays high long after the memory is free. */
function footprint(pid) {
  const out = execFileSync("vmmap", ["-summary", pid], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const mb = (label) => {
    const [, size, unit] = out.match(new RegExp(`${label}:\\s+([\\d.]+)([KMG])`)) ?? [];
    if (!size) throw new Error(`vmmap printed no "${label}"`);
    return Math.round(Number(size) * { K: 1 / 1024, M: 1, G: 1024 }[unit]);
  };
  return { now: mb("Physical footprint"), peak: mb("Physical footprint \\(peak\\)") };
}

const MOCK = () => {
  const send = WebSocket.prototype.send;
  window.__mock = null;
  WebSocket.prototype.send = function (data) {
    const message = JSON.parse(data);
    if (!(message.sessionId ?? "").startsWith("memory-") && !(message.terminalId ?? "").startsWith("memory-")) return send.call(this, data);
    window.__mock = this;
    const reply = (body) => setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(body) })), 0);
    const status = { key: { workspaceId: "memory", sessionId: message.sessionId, agentId: "pi" }, providerId: "pi", resumable: true, state: "idle", reason: "", lastTransitionMs: 0, lastActivityMs: 0, revision: 1, transitionSequence: 1, inputOwner: { clientId: "watcher", deviceId: "watcher", generation: 1, acquiredAtMs: 0, lastActivityMs: 0 } };
    if (message.type === "agent.terminal.open") reply({ type: "agent.terminal.opened", requestId: message.requestId, terminalId: message.sessionId, status, replay: "\x1b[8;50;150t\x1b[2J\x1b[Hmemory check\r\n" });
    else if (message.type === "session.layout.get") reply({ type: "session.layout", sessionId: message.sessionId });
  };
  const state = window.usePerchStore.getState();
  const sessions = Array.from({ length: 20 }, (_, i) => ({ id: `memory-${i}`, title: `Memory ${i}`, cwd: "/tmp", cliProviderId: "pi", cliStarted: true, status: "idle", createdAt: 0 }));
  window.usePerchStore.setState({ sessions, sessionId: "memory-0", cliAgentBySession: Object.fromEntries(sessions.map((s) => [s.id, "pi"])), settings: { ...state.settings, chatMode: "cli" } });
};

/** A page on perch with the mocked sessions, `memory-0` shown. */
async function open(browser, { webgl, noWebgl2 = false }) {
  const page = await (await browser.newContext({ viewport: { width: 1512, height: 949 }, deviceScaleFactor: 2, serviceWorkers: "block" })).newPage();
  page.on("pageerror", (error) => check(false, `page error: ${error.message}`));
  await page.addInitScript(({ webgl, noWebgl2 }) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    // The app's renderer, not automation's (xtermSetup.ts).
    if (webgl) Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    // Every WebGL2 context, to count the live ones; or none at all.
    window.__contexts = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === "webgl2" && noWebgl2) return null;
      const context = getContext.call(this, type, ...rest);
      if (type === "webgl2" && context) window.__contexts.push(context);
      return context;
    };
    // Lets the check age the context-loss window without waiting a minute.
    window.__clockSkew = 0;
    const now = Date.now;
    Date.now = () => now() + window.__clockSkew;
    window.__terminals = [];
    window.__seen = new WeakSet();
  }, { webgl, noWebgl2 });
  await page.goto(URL_);
  await page.waitForFunction(() => window.usePerchStore?.getState().settings && window.usePerchStore.getState().connected);
  await page.evaluate(MOCK);
  await page.locator(".xterm").waitFor();
  if (!await waitFor(async () => { await collect(page); return page.evaluate(() => window.__terminals.length > 0); })) throw new Error("the first terminal never showed");
  return page;
}

// Every xterm the UI builds, held weakly: counted after GC, what's left is retained.
const collect = (page) => page.evaluate(() => {
  const container = document.getElementById("root");
  const fiber = container[Object.keys(container).find((key) => key.startsWith("__reactContainer$"))];
  const visited = new Set();
  const walk = (node) => {
    if (!node || visited.has(node)) return;
    visited.add(node);
    for (let hook = node.memoizedState; hook && typeof hook === "object" && "next" in hook; hook = hook.next) {
      const term = hook.memoizedState?.created?.term;
      if (term?._core && !window.__seen.has(term)) { window.__seen.add(term); window.__terminals.push(new WeakRef(term)); }
    }
    walk(node.child);
    walk(node.sibling);
  };
  walk(fiber.stateNode?.current ?? fiber); // the committed tree, not its alternate
});
const show = async (page, sessionId) => { await page.evaluate((id) => window.usePerchStore.setState({ sessionId: id }), sessionId); await sleep(100); await collect(page); };
const liveContexts = (page) => page.evaluate(() => window.__contexts.filter((gl) => !gl.isContextLost()).length);
const loseContext = (page) => page.evaluate(() => window.__contexts.find((gl) => !gl.isContextLost())?.getExtension("WEBGL_lose_context").loseContext());
async function waitFor(condition, ms = 10_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) if (await condition()) return true;
  return condition();
}

let browser;
try {
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(URL_)).ok) break; } catch {}
    if (core.exitCode !== null) throw new Error(`core exited; see ${WORK}/core.log`);
    await sleep(100);
  }
  const before = contentPids();
  browser = await webkit.launch({ headless: true });
  const page = await open(browser, { webgl });
  const ours = [...contentPids()].filter((pid) => !before.has(pid));
  if (ours.length !== 1) throw new Error(`expected one new WebContent process for this run, found ${ours.length}: is another WebKit run starting?`);
  const idle = footprint(ours[0]);

  // A pathological TUI: every cell its own colour, the whole screen redrawn.
  await page.evaluate(async () => {
    for (let n = 0; n < 120; n++) {
      const frame = "\x1b[?2026h\x1b[H" + Array.from({ length: 49 }, (_, row) => Array.from({ length: 145 }, (_, col) => `\x1b[38;5;${(row + col + n) % 256}m${String.fromCharCode(33 + (row * col + n) % 90)}`).join("")).join("\r\n") + "\x1b[0m\x1b[?2026l";
      window.__mock.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "terminal.data", terminalId: "memory-0", data: frame }) }));
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  });
  await sleep(1000);
  const repainted = footprint(ours[0]);
  const summary = `peak footprint through 120 colourful repaints: ${repainted.peak} MB (idle ${idle.now} MB, after ${repainted.now} MB)`;
  if (!webgl) console.log(`DOM renderer ${summary}`);
  else {
    check(repainted.peak < 300, `${summary}, under 300 MB`);

    check(await liveContexts(page) === 1, "the shown terminal renders with WebGL");
    // xterm waits 3 s for the browser to restore a context before giving up on it.
    let recovered = true;
    for (let loss = 1; loss <= 5 && recovered; loss++) {
      await page.evaluate(() => { window.__clockSkew += 61_000; });
      await loseContext(page);
      recovered = await waitFor(async () => await liveContexts(page) === 1);
    }
    check(recovered, "5 lost WebGL contexts a minute apart are each replaced");
    await page.evaluate(() => { window.__clockSkew += 61_000; });
    for (let loss = 1; loss <= 4; loss++) {
      await loseContext(page);
      if (loss < 4) await waitFor(async () => await liveContexts(page) === 1);
    }
    await sleep(4500);
    check(await liveContexts(page) === 0, "4 losses within a minute leave the terminal on DOM");
    await show(page, "memory-1");
    await show(page, "memory-0");
    check(await waitFor(async () => await liveContexts(page) === 1), "showing it again brings WebGL back");
  }

  for (let n = 0; n < 30; n++) await show(page, `memory-${n % 2}`);
  if (webgl) check(await liveContexts(page) === 1, "after 30 switches only the shown terminal holds a WebGL context");
  const alive = async () => {
    await page.requestGC();
    await sleep(300);
    await page.requestGC();
    return page.evaluate(() => window.__terminals.filter((ref) => ref.deref()).length);
  };
  check(await alive() === 2, "30 switches between two sessions reuse their two terminals");
  for (let n = 0; n < 20; n++) await show(page, `memory-${n}`);
  const visited = await alive();
  check(visited <= KEEP + 1, `after visiting 20 sessions ${visited} terminals are alive, at most ${KEEP + 1}`);
  await page.evaluate(() => window.usePerchStore.setState({ sessionId: null }));
  if (webgl) check(await waitFor(async () => await liveContexts(page) === 0), "parked terminals hold no WebGL context");
  await page.evaluate(() => window.usePerchStore.setState({ sessions: [] }));
  await sleep(300);
  const closed = await alive();
  check(closed === 0, `after closing every session ${closed} terminals are alive, none expected`);

  if (webgl) {
    const plain = await open(browser, { webgl, noWebgl2: true });
    const addons = () => plain.evaluate(() => window.__terminals.map((ref) => ref.deref()?._addonManager._addons.length));
    await show(plain, "memory-1");
    const first = await addons();
    for (let n = 0; n < 40; n++) await show(plain, `memory-${n % 2}`);
    const last = await addons();
    check(JSON.stringify(first) === JSON.stringify(last), `without WebGL2, 40 revisits keep each terminal's addons at ${first} (now ${last})`);
  }
} catch (error) {
  check(false, String(error?.stack ?? error));
} finally {
  await browser?.close();
  core.kill("SIGTERM");
  await sleep(300);
  try { execFileSync("pkill", ["-f", `__perchd serve --dir ${WORK}/daemon`]); } catch {}
}
process.exit(failures.length ? 1 : 0);
