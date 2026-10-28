// No browser, provider, installed daemon or paid turns. Build perch-core first.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-fixture-check-"));
const sibling = fs.mkdtempSync(path.join(os.tmpdir(), "perch-fixture-sibling-"));
const env = fixtureRuntimeEnv(fixture);
const binary = path.join(root, "target/debug/perch-core");
const cli = (dir, ...args) => {
  try { return JSON.parse(execFileSync(binary, ["__perchd", ...args, "--dir", dir, "--json"], { encoding: "utf8" })); }
  catch (error) { throw new Error(`Fixture RPC failed: ${error}`); }
};
async function until(check) {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    assert(Date.now() < deadline, "fixture check did not settle");
    await setTimeout(25);
  }
}
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const server = spawn(process.execPath, ["--experimental-strip-types", path.join(root, "e2e/fixtureServer.ts"), "--port", String(port)], { env: { ...process.env, ...env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", "ignore", "pipe"] });
let log = "";
server.stderr.on("data", (data) => { log += data; });
let socket;
try {
  assert.throws(() => fixtureRuntimeEnv(os.tmpdir()), /private directory/);
  for (const name of ["PERCH_DB", "PERCH_HOSTS", "PERCH_SETTINGS", "PERCHD_DIR"]) assert(env[name].startsWith(fs.realpathSync(fixture) + path.sep));
  await until(async () => {
    assert.equal(server.exitCode, null, log);
    try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) }); return true; } catch { return false; }
  });
  console.log("fixture core ready");
  socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages = [];
  socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
  await once(socket, "open", { signal: AbortSignal.timeout(5000) });
  console.log("fixture WebSocket open");
  socket.send(JSON.stringify({ type: "project.create", requestId: "project", path: fixture }));
  await until(() => messages.some((message) => message.requestId === "project"));
  socket.send(JSON.stringify({ type: "session.create", cwd: fs.realpathSync(fixture), hostId: "local" }));
  await until(() => {
    const error = messages.find((message) => message.type === "error");
    assert(!error, JSON.stringify(error));
    return messages.some((message) => message.type === "session.created");
  });
  const sessionId = messages.findLast((message) => message.type === "session.created").sessionId;
  socket.send(JSON.stringify({ type: "terminal.open", requestId: "shell", sessionId, paneId: "pane", viewId: "fixture-view", cols: 80, rows: 24 }));
  await until(() => {
    const error = messages.find((message) => message.type === "error");
    assert(!error, JSON.stringify(error));
    return messages.some((message) => message.type === "terminal.opened");
  });
  console.log("fixture shell opened");
  const sessions = cli(env.PERCHD_DIR, "ps");
  const shell = sessions.find((session) => session.alive);
  assert(shell, "core did not create a persistent shell");
  assert.equal(shell.cleanup.owner, env.PERCH_CLEANUP_OWNER, "core startup must capture ownership before provider environment filtering");
  assert.equal(shell.cleanup.retention, "retained");
  assert.deepEqual(cli(env.PERCHD_DIR, "cleanup", "--dry-run").candidates, []);
  // Legacy metadata must not turn a leader-only exit into confirmed teardown.
  const legacy = fs.mkdtempSync(path.join(os.tmpdir(), "perch-fixture-legacy-"));
  const legacyEnv = fixtureRuntimeEnv(legacy);
  const history = path.join(legacyEnv.PERCHD_DIR, "history");
  fs.mkdirSync(history, { recursive: true });
  for (const name of fs.readdirSync(path.join(env.PERCHD_DIR, "history"))) {
    fs.copyFileSync(path.join(env.PERCHD_DIR, "history", name), path.join(history, name));
  }
  const old = spawn(binary, ["__perchd", "serve", "--no-idle-exit", "--dir", legacyEnv.PERCHD_DIR], { env: { ...process.env, ...legacyEnv }, stdio: "ignore" });
  try {
    await until(() => fs.existsSync(path.join(legacyEnv.PERCHD_DIR, "daemon-v1.pid")));
    await assert.rejects(cleanupFixtureRuntime(root, legacy), /process-group shutdown unconfirmed/);
    assert.equal(old.exitCode, null);
    assert(fs.existsSync(legacy), "refused cleanup deleted legacy state");
    assert(cli(env.PERCHD_DIR, "ps").find((session) => session.id === shell.id).alive);
  } finally {
    const gone = once(old, "exit", { signal: AbortSignal.timeout(5000) });
    old.kill("SIGTERM"); // this test owns the daemon handle; it has no PTYs
    await gone;
    fs.rmSync(legacy, { recursive: true, force: true });
  }
  socket.close();
  await once(socket, "close", { signal: AbortSignal.timeout(5000) });
  // A watcher disconnect alone must not release anything.
  assert.equal(cli(env.PERCHD_DIR, "ps").find((session) => session.id === shell.id).cleanup.retention, "retained");
  console.log("checking final wrapper teardown");
  const exited = once(server, "exit", { signal: AbortSignal.timeout(20_000) });
  const crash = process.argv.includes("--crash-core");
  if (crash) {
    const markers = fs.readdirSync(path.join(env.PERCHD_DIR, "cores")).filter((name) => /^\d+$/.test(name));
    assert.equal(markers.length, 1);
    const pid = Number(markers[0]);
    assert.equal(Number(execFileSync("ps", ["-p", String(pid), "-o", "ppid="], { encoding: "utf8" }).trim()), server.pid);
    process.kill(pid, "SIGKILL"); // exact private core child, not its daemon
  } else {
    server.kill("SIGTERM");
  }
  const [code] = await exited;
  assert.equal(code, crash ? 1 : 0, log);
  assert(!fs.existsSync(fixture), "confirmed teardown should remove only its own fixture");
  assert(fs.existsSync(sibling), "sibling state was removed");
  console.log("fixture runtime check passed: retained shell, watcher disconnect, explicit final cleanup, sibling state protected");
} finally {
  socket?.close();
  if (server.exitCode === null && server.signalCode === null) { const done = once(server, "exit", { signal: AbortSignal.timeout(20_000) }); server.kill("SIGTERM"); await done; }
  await cleanupFixtureRuntime(root, sibling);
  fs.rmSync(sibling, { recursive: true, force: true });
}
