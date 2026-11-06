// Packaged `perch` check (slice 3b): the `perch` shipped in a built package is found beside the core,
// and an agent session started by that core can run `perch whoami`. No paid turns, no browser.
//
//   cargo build --release -p perchd --bin perch && cargo build -p perch-core
//   (cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build --bundles app)
//   node --experimental-strip-types e2e/packaged-perch.check.mjs [path/to/perch.app | package-dir]
//
// The desktop app embeds its core and has no headless mode, so this takes the `perch` out of the
// package, puts it beside a headless `perch-core` (the same `binary_beside` lookup the app makes
// next to its own executable) and starts a terminal session in that core, under private state.
// It does not launch the app; a person still opens the real app once for a visual pass.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime.ts";
import { withLocalToken } from "./localAuth.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const given = path.resolve(process.argv[2] ?? path.join(root, "target/release/bundle/macos/perch.app"));
const executables = given.endsWith(".app") ? path.join(given, "Contents", "MacOS") : given;
const packaged = path.join(executables, "perch");
assert(fs.existsSync(path.join(executables, "perch-desktop")) || !given.endsWith(".app"), `no app executable in ${executables}`);
assert(fs.existsSync(packaged), `the package has no \`perch\` beside its executable: ${packaged}`);
assert(fs.statSync(packaged).mode & 0o111, `${packaged} is not executable`);

// Outside any session `perch` explains itself and fails; it must not hang or crash.
const outside = spawnSync(packaged, ["whoami"], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, timeout: 10_000 });
assert.equal(outside.status, 1, outside.stderr);
assert.match(outside.stderr, /PERCH_SESSION and PERCH_TOKEN are not set/);
assert.match(spawnSync(packaged, ["guide"], { encoding: "utf8", timeout: 10_000 }).stdout, /perch whoami/);

const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-packaged-")));
const pkg = path.join(scratch, "pkg");
fs.mkdirSync(pkg);
fs.copyFileSync(packaged, path.join(pkg, "perch"));
fs.chmodSync(path.join(pkg, "perch"), 0o755);
const core = path.join(pkg, "perch-core");
fs.copyFileSync(path.join(root, "target/debug/perch-core"), core);
fs.chmodSync(core, 0o755);
const project = path.join(scratch, "project");
fs.mkdirSync(project);

const listener = net.createServer();
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
let log = "", socket;
const server = spawn(core, ["--port", String(port), "--cwd", project], {
  env: { ...process.env, ...fixtureRuntimeEnv(scratch), PERCH_NO_LOGIN_PATH: "1" },
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", data => { log += data; });
const messages = [];
async function until(check, description) {
  const deadline = Date.now() + 20_000;
  while (!(await check())) {
    assert(server.exitCode === null, log);
    assert(Date.now() < deadline, `${description}\n${log}\n${JSON.stringify(messages.slice(-8))}`);
    await delay(25);
  }
}
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, "core ready");
  socket = new WebSocket(withLocalToken(`ws://127.0.0.1:${port}/ws`));
  socket.addEventListener("message", event => { try { messages.push(JSON.parse(String(event.data))); } catch { /* not a frame */ } });
  await once(socket, "open");
  const send = message => socket.send(JSON.stringify(message));
  send({ type: "project.create", requestId: "project", path: project });
  await until(() => messages.some(message => message.requestId === "project"), "project created");
  send({ type: "session.create", cwd: project, hostId: "local" });
  await until(() => messages.some(message => message.type === "session.created"), "session created");
  const sessionId = messages.findLast(message => message.type === "session.created").sessionId;
  send({ type: "agent.terminal.open", requestId: "shell", viewId: "shell", sessionId, providerId: "terminal", cols: 120, rows: 24 });
  await until(() => messages.some(message => message.type === "agent.terminal.opened"), "terminal opened");
  const terminalId = messages.findLast(message => message.type === "agent.terminal.opened").terminalId;
  const seen = () => messages.filter(message => message.type === "terminal.data" && message.terminalId === terminalId).map(message => message.data).join("");
  // The shell that follows `perch` is the person's; ask for the identity the agent's own tools see.
  send({ type: "terminal.input", terminalId, shared: true, data: "perch whoami\r" });
  await until(() => seen().includes(`session   ${sessionId}`), "`perch whoami` answered with this session");
  assert.match(seen(), /provider\s+terminal/);
  assert(!seen().includes("perch_agent_"), "the terminal must never echo the agent token");
  send({ type: "terminal.input", terminalId, shared: true, data: "exit\r" });
  console.log(`packaged perch (${packaged}): found beside the core, \`perch whoami\` answered for session ${sessionId}`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  socket?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit", { signal: AbortSignal.timeout(20_000) });
    server.kill("SIGTERM");
    await exited;
  }
  await cleanupFixtureRuntime(root, scratch);
  fs.rmSync(scratch, { recursive: true, force: true });
}
