// Deterministic native status adapters in a real shell/core/private daemon.
// No installed app state, browser, provider calls or paid turns.
// cargo build -p perch-core && node --experimental-strip-types e2e/shell-agent-status.check.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime.ts";
import { withLocalToken } from "./localAuth.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "perch-shell-status-"));
const env = fixtureRuntimeEnv(scratch);
const bin = path.join(scratch, "bin");
fs.mkdirSync(bin);
fs.writeFileSync(path.join(scratch, ".bash_profile"), `export PATH=${JSON.stringify(bin)}:/usr/bin:/bin\n`);
const fake = `#!${process.execPath}
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const provider = path.basename(process.argv[1]);
let running = false, blocked = false, revision = 0;
const id = randomUUID();
const handlers = new Map();
const history = [];
const ctx = { cwd: process.cwd(), model: null, isIdle: () => !running, hasPendingMessages: () => false,
  sessionManager: { getBranch: () => history, getSessionFile: () => id, getSessionId: () => id } };
let server, publish = () => {}, shutdown = async () => {};
if (provider === 'pi' || provider === 'omp') {
  const extension = process.argv[process.argv.indexOf('--extension') + 1];
  if (!extension) throw Error('missing automatic extension');
  (await import(pathToFileURL(extension))).default({ on: (name, fn) => handlers.set(name, fn), appendEntry() {} });
  await handlers.get('session_start')({}, ctx);
  publish = (name) => handlers.get(name)?.({}, ctx);
  shutdown = () => handlers.get('session_shutdown')?.();
} else if (provider === 'claude') {
  const config = JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--settings') + 1], 'utf8'));
  const transcript = path.join(process.cwd(), id + '.jsonl');
  fs.writeFileSync(transcript, '');
  const event = name => {
    const result = spawnSync('/bin/sh', ['-c', config.hooks[name][0].hooks[0].command], {
      input: JSON.stringify({ hook_event_name: name, session_id: id, transcript_path: transcript, cwd: process.cwd() })
    });
    if (result.status !== 0) throw Error('hook failed');
  };
  event('SessionStart');
  publish = name => event(({ agent_start: 'UserPromptSubmit', ask: 'PermissionRequest', answer: 'PostToolUse', agent_end: 'Stop' })[name]);
} else if (provider === 'aider') {
  publish = name => process.stdout.write('\\x1b]0;' + ({ agent_start: '⠋ aider', ask: 'aider - action required', answer: '⠋ aider', agent_end: 'aider ready' })[name] + '\\x07');
} else {
  const config = JSON.parse(fs.readFileSync(process.env.OPENCODE_TUI_CONFIG, 'utf8'));
  const plugin = fs.readFileSync(config.plugin[0], 'utf8');
  const socket = JSON.parse(plugin.match(/const SOCKET_PATH = ("[^"\\n]+")/)[1]);
  const clients = new Set();
  publish = () => {
    const snapshot = { type: 'snapshot', version: 1, revision: ++revision, pid: process.pid, providerSessionId: id,
      cwd: process.cwd(), running, blocked, messages: [], truncated: false };
    for (const client of clients) client.write(JSON.stringify(snapshot) + '\\n');
  };
  server = net.createServer(client => { clients.add(client); client.on('error', () => {}); client.on('close', () => clients.delete(client)); publish(); });
  server.listen(socket);
  shutdown = async () => { for (const client of clients) client.destroy(); server.close(); };
}
// The unchanged title is intentionally the one Perch used to misread as idle.
process.stdout.write('\\x1b]0;' + (provider === 'aider' ? 'aider ready' : 'π - shell fixture') + '\\x07fixture-ready\\n');
for await (const line of readline.createInterface({ input: process.stdin })) {
  if (line === 'exit') { await shutdown(); process.exit(0); }
  if (line === 'work') { running = true; blocked = false; publish('agent_start'); }
  if (line === 'ask') {
    blocked = true;
    if (provider === 'pi' || provider === 'omp') handlers.get('tool_execution_start')({ toolCallId: 'ask', toolName: provider === 'pi' ? 'AskUserQuestion' : 'ask' }, ctx);
    else publish('ask');
  }
  if (line === 'answer') {
    blocked = false;
    if (provider === 'pi' || provider === 'omp') handlers.get('tool_execution_end')({ toolCallId: 'ask', toolName: provider === 'pi' ? 'AskUserQuestion' : 'ask' }, ctx);
    else publish('answer');
  }
  if (line === 'done') { running = false; blocked = false; publish('agent_end'); }
}
`;
for (const provider of ["pi", "omp", "claude", "opencode", "aider"]) fs.writeFileSync(path.join(bin, provider), fake, { mode: 0o700 });
const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
let log = "", socket;
function startCore() {
  const child = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port)], {
    env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}`, SHELL: "/bin/bash", HOME: scratch, PERCH_NO_LOGIN_PATH: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", data => { log += data; });
  return child;
}
let server = startCore();
const messages = [], summaries = new Map();
async function connect() {
  socket = new WebSocket(withLocalToken(`ws://127.0.0.1:${port}/ws`));
  socket.addEventListener("message", event => {
    try {
      const message = JSON.parse(String(event.data));
      messages.push(message);
      if (message.type === "session.updated") summaries.set(message.session.id, message.session);
      if (message.type === "session.list") for (const session of message.sessions) summaries.set(session.id, session);
    } catch (error) {
      messages.push({ type: "error", message: `Invalid fixture frame: ${error}` });
    }
  });
  await once(socket, "open");
}
async function until(check, description) {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    assert(server.exitCode === null, log);
    assert(Date.now() < deadline, `${description}\n${log}\n${JSON.stringify(messages.slice(-12))}`);
    await delay(25);
  }
}
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, "core ready");
  await connect();
  const send = message => socket.send(JSON.stringify(message));
  send({ type: "project.create", requestId: "project", path: fs.realpathSync(scratch) });
  await until(() => messages.some(message => message.requestId === "project"), "project created");
  send({ type: "session.create", cwd: fs.realpathSync(scratch), hostId: "local" });
  await until(() => messages.some(message => message.type === "session.created"), "session created");
  const sessionId = messages.findLast(message => message.type === "session.created").sessionId;
  send({ type: "agent.terminal.open", requestId: "shell", viewId: "shell", sessionId, providerId: "terminal", cols: 80, rows: 24 });
  await until(() => messages.some(message => message.type === "agent.terminal.opened"), "shell opened");
  let terminalId = messages.findLast(message => message.type === "agent.terminal.opened").terminalId;
  const input = data => send({ type: "terminal.input", terminalId, shared: true, data: data + "\r" });
  const summary = () => summaries.get(sessionId);
  const state = (status, blocked = false) => summary()?.status === status && Boolean(summary()?.blocked) === blocked;
  let restarted = false;
  for (const provider of ["pi", "omp", "claude", "opencode", "aider", "pi"]) {
    messages.length = 0;
    input(provider);
    await until(() => messages.some(message => provider === "aider"
      ? message.type === "terminal.data" && message.data.includes("fixture-ready")
      : message.type === "agent.ui.snapshot" && message.providerId === provider), `${provider} automatically observed`);
    await until(() => state("idle"), `${provider} starts idle`);
    input("work");
    await until(() => state("running"), `${provider} running`);
    await delay(1600); // well past the old quiet-to-idle debounce
    assert(state("running"), `${provider} must remain running while silent`);
    if (!restarted) {
      const pid = messages.findLast(message => message.type === "agent.ui.snapshot").snapshot.pid;
      socket.close();
      await once(socket, "close");
      const stopped = once(server, "exit");
      server.kill("SIGTERM");
      await stopped; // Keep the private daemon and its still-working Pi.
      server = startCore();
      messages.length = 0; summaries.clear();
      await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, "restarted core ready");
      await connect();
      send({ type: "session.subscribe", sessionId });
      send({ type: "session.list" });
      // Recovery must work before anyone opens the terminal's view.
      await until(() => state("running"), "background shell status recovered after core restart");
      send({ type: "agent.terminal.open", requestId: "shell-restart", viewId: "shell-restart", sessionId, providerId: "terminal", cols: 80, rows: 24 });
      await until(() => messages.some(message => message.type === "agent.terminal.opened"), "reattached shell");
      terminalId = messages.findLast(message => message.type === "agent.terminal.opened").terminalId;
      input("ask");
      await until(() => messages.some(message => message.type === "agent.ui.snapshot" && message.snapshot.pid === pid && message.snapshot.blocked), "same Pi still alive after restart");
      restarted = true;
      console.log("core restart: working shell agent recovered without opening its terminal or relaunching its process");
    } else input("ask");
    await until(() => state("running", true), `${provider} needs you`);
    input("answer");
    await until(() => state("running"), `${provider} unblocked`);
    input("done");
    await until(() => state("idle"), `${provider} completed`);
    input("exit");
    await until(() => summary()?.currentProviderId === "terminal", `${provider} returned to same shell`);
    console.log(`${provider}: shell launch → idle → working (including silence) → needs you → working → idle → shell`);
  }
  input("exit");
  await until(() => messages.some(message => message.type === "terminal.exit"), "fixture shell exited");
  assert(!messages.some(message => message.type === "error"), JSON.stringify(messages.filter(message => message.type === "error")));
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
  if (fs.existsSync(scratch)) {
    await cleanupFixtureRuntime(root, scratch);
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
