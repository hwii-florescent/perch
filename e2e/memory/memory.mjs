#!/usr/bin/env node
/**
 * Terminal memory check, in headless WebKit (the Mac app is a WKWebView).
 *
 *   node e2e/memory/memory.mjs [--renderer webgl|dom]
 *
 * Boots an isolated core on :7792 serving packages/web/dist (`npm run build`
 * first), mocks 20 agent sessions in the page (no real agent) and checks:
 *  - a colourful full-screen TUI repainting 120 times keeps the renderer's
 *    physical footprint (vmmap) under 300 MB. The DOM renderer reaches
 *    ~940 MB on the same frames, WebGL stays under 100 MB.
 *  - visiting 20 sessions keeps at most KEEP + 1 terminals alive, and
 *    closing every session leaves none (counted by WeakRef after GC).
 *  - a lost WebGL context is replaced by a new one.
 * `--renderer dom` keeps automation's DOM renderer, for comparison: it
 * only reports the footprint. Exits nonzero on any failure or page error.
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

/** MB of physical footprint (what Activity Monitor shows), not RSS: WebKit's
 * allocator keeps freed pages resident but reusable, so RSS stays high long
 * after the memory is free. */
function footprintMB() {
  const content = execFileSync("ps", ["-ww", "-axo", "pid,args"], { encoding: "utf8" }).split("\n")
    .find((line) => /ms-playwright/.test(line) && /WebContent/.test(line));
  if (!content) return null;
  try {
    const out = execFileSync("vmmap", ["-summary", content.trim().split(/\s+/)[0]], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const [, size, unit] = out.match(/Physical footprint:\s+([\d.]+)([KMG])/) ?? [];
    return size ? Math.round(Number(size) * { K: 1 / 1024, M: 1, G: 1024 }[unit]) : null;
  } catch { return null; }
}

let browser;
try {
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {}
    if (core.exitCode !== null) throw new Error(`core exited; see ${WORK}/core.log`);
    await sleep(100);
  }
  browser = await webkit.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1512, height: 949 }, deviceScaleFactor: 2, serviceWorkers: "block" })).newPage();
  page.on("pageerror", (error) => check(false, `page error: ${error.message}`));
  await page.addInitScript((webgl) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    // The app's renderer, not automation's (xtermSetup.ts).
    if (webgl) Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    window.__terminals = [];
    window.__seen = new WeakSet();
  }, webgl);
  // Every xterm the UI builds, held weakly: counted after GC, what's left is retained.
  const collect = () => page.evaluate(() => {
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
    walk(fiber);
  });
  const alive = async () => {
    await page.requestGC();
    await sleep(300);
    await page.requestGC();
    return page.evaluate(() => window.__terminals.filter((ref) => ref.deref()).length);
  };
  const show = async (sessionId) => { await page.evaluate((id) => window.usePerchStore.setState({ sessionId: id }), sessionId); await sleep(100); await collect(); };

  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.usePerchStore?.getState().settings && window.usePerchStore.getState().connected);
  await page.evaluate(() => {
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
  });
  await page.locator(".xterm").waitFor();
  await collect();
  const idle = footprintMB();

  // A pathological TUI: every cell its own colour, the whole screen redrawn.
  await page.evaluate(async () => {
    for (let n = 0; n < 120; n++) {
      const frame = "\x1b[?2026h\x1b[H" + Array.from({ length: 49 }, (_, row) => Array.from({ length: 145 }, (_, col) => `\x1b[38;5;${(row + col + n) % 256}m${String.fromCharCode(33 + (row * col + n) % 90)}`).join("")).join("\r\n") + "\x1b[0m\x1b[?2026l";
      window.__mock.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "terminal.data", terminalId: "memory-0", data: frame }) }));
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  });
  await sleep(1000);
  const repainted = footprintMB();
  if (repainted === null) console.log("skip footprint: vmmap unavailable");
  else if (webgl) check(repainted < 300, `footprint after 120 colourful repaints: ${repainted} MB (idle ${idle} MB), under 300 MB`);
  else console.log(`DOM renderer footprint after 120 colourful repaints: ${repainted} MB (idle ${idle} MB)`);

  if (webgl) {
    const live = () => page.evaluate(() => [...document.querySelectorAll(".xterm-screen canvas")].map((canvas) => canvas.getContext("webgl2")).filter((gl) => gl && !gl.isContextLost()).length);
    check(await live() === 1, "the shown terminal renders with WebGL");
    await page.evaluate(() => [...document.querySelectorAll(".xterm-screen canvas")].map((canvas) => canvas.getContext("webgl2")).find(Boolean).getExtension("WEBGL_lose_context").loseContext());
    // xterm waits 3 s for the browser to restore a context before giving up on it.
    let restored = false;
    for (let i = 0; i < 40 && !restored; i++) { await sleep(250); restored = await live() === 1; }
    check(restored, "a lost WebGL context is replaced");
  }

  for (let n = 0; n < 30; n++) await show(`memory-${n % 2}`);
  check(await alive() === 2, "30 switches between two sessions reuse their two terminals");
  for (let n = 0; n < 20; n++) await show(`memory-${n}`);
  const visited = await alive();
  check(visited <= KEEP + 1, `after visiting 20 sessions ${visited} terminals are alive, at most ${KEEP + 1}`);
  await page.evaluate(() => window.usePerchStore.setState({ sessions: [], sessionId: null }));
  await sleep(300);
  const closed = await alive();
  check(closed === 0, `after closing every session ${closed} terminals are alive, none expected`);
} catch (error) {
  check(false, String(error?.stack ?? error));
} finally {
  await browser?.close();
  core.kill("SIGTERM");
  await sleep(300);
  try { execFileSync("pkill", ["-f", `__perchd serve --dir ${WORK}/daemon`]); } catch {}
}
process.exit(failures.length ? 1 : 0);
