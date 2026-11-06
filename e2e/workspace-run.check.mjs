// No paid provider turns or installed app state. Build perch-core/web first.
// node --experimental-strip-types e2e/workspace-run.check.mjs [--browser]
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv } from "./fixtureRuntime.ts";
import { withLocalToken } from "./localAuth.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-run-check-"));
const project = path.join(dir, "project"); fs.mkdirSync(project);
fs.writeFileSync(path.join(project, "Example.txt"), "hello Quick Open\n");
const env = fixtureRuntimeEnv(dir);
const listener = net.createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
const server = spawn(process.execPath, ["--experimental-strip-types", path.join(root, "e2e/fixtureServer.ts"), "--port", String(port)], { env: { ...process.env, ...env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", "ignore", "pipe"] });
let log = ""; server.stderr.on("data", (data) => { log += data; });
let socket, browser;
const messages = [];
async function until(check) {
  const end = Date.now() + 20_000;
  while (!(await check())) { assert(server.exitCode === null, log); assert(Date.now() < end, "check timed out: " + log); await setTimeout(25); }
}
const send = (message) => socket.send(JSON.stringify(message));
try {
  await until(async () => { try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) }); return true; } catch { return false; } });
  socket = new WebSocket(withLocalToken(`ws://127.0.0.1:${port}/ws`));
  socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
  await once(socket, "open", { signal: AbortSignal.timeout(5000) });
  send({ type: "project.create", requestId: "project", path: project });
  await until(() => messages.some((m) => m.type === "workspace.snapshot" && m.requestId === "project"));
  const workspace = messages.findLast((m) => m.type === "workspace.snapshot" && m.requestId === "project").workspaces.find((w) => w.path === fs.realpathSync(project));
  assert(workspace);
  const requestId = randomUUID();
  const command = "printf '%s' 'quoted $HOME ; spaces' >> run-count; exit 7";
  const run = { type: "workspace.run", requestId, workspaceId: workspace.id, command };
  send(run);
  await until(() => messages.some((m) => m.requestId === requestId && m.type === "workspace.run.started"));
  const { sessionId } = messages.find((m) => m.type === "workspace.run.started" && m.requestId === requestId);
  await until(() => fs.existsSync(path.join(project, "run-count")));
  assert.equal(fs.readFileSync(path.join(project, "run-count"), "utf8"), "quoted $HOME ; spaces");
  send(run); // lost acknowledgement / duplicate command: must not execute again
  await until(() => messages.some((m) => m.requestId === requestId && m.type === "error"));
  assert.match(messages.find((m) => m.requestId === requestId && m.type === "error").message, /already admitted/);
  const viewId = randomUUID();
  send({ type: "agent.terminal.open", requestId: viewId, viewId, sessionId, providerId: "terminal", cols: 80, rows: 24 });
  await until(() => messages.some((m) => m.requestId === viewId && m.type === "agent.terminal.opened"));
  assert.match(messages.find((m) => m.requestId === viewId && m.type === "agent.terminal.opened").replay, /exit 7/);
  assert.equal(fs.readFileSync(path.join(project, "run-count"), "utf8"), "quoted $HOME ; spaces");
  // A remote-qualified id can never execute the same-looking folder locally.
  const bad = randomUUID(); send({ ...run, requestId: bad, workspaceId: 'remote:["other","' + workspace.id + '"]' });
  await until(() => messages.some((m) => m.requestId === bad && m.type === "error"));
  const invalid = randomUUID(); send({ ...run, requestId: invalid, command: "echo\nno" });
  await until(() => messages.some((m) => m.requestId === invalid && m.type === "error"));
  if (process.argv.includes("--browser")) {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByTestId("onboarding-dismiss").click();
    await page.waitForSelector('[data-testid="tab-bar"]', { timeout: 15_000 });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+p" : "Control+Shift+p");
    await page.getByTestId("navigator-input").fill("Example");
    await page.locator('[data-testid="navigator-command-file:Example.txt"]').waitFor();
    await page.screenshot({ path: "/tmp/perch-navigator-desktop.png" });
    await page.keyboard.press("Enter");
    await page.getByText("hello Quick Open", { exact: false }).first().waitFor();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+p" : "Control+Shift+p"); await page.getByTestId("navigator-input").fill("> printf 'hello run'");
    await page.keyboard.press("Enter");
    await page.getByTestId("confirm-dialog").waitFor();
    await page.screenshot({ path: "/tmp/perch-run-desktop.png" });
    await page.getByTestId("confirm-cancel").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("navigator-input").fill("Example");
    await page.locator('[data-testid="navigator-command-file:Example.txt"]').waitFor();
    await page.screenshot({ path: "/tmp/perch-navigator-mobile.png" });
  }
  console.log("Run check passed: quoted command, exit status, normal owned reattach, durable duplicate refusal, remote and invalid-input refusal.");
} finally {
  await browser?.close(); socket?.close();
  if (server.exitCode === null && server.signalCode === null) { const done = once(server, "exit", { signal: AbortSignal.timeout(20_000) }); server.kill("SIGTERM"); await done; }
}
