// A phone browser reaching a real core through the real relay Worker (workerd, via
// `wrangler dev`). Nothing here touches ~/.perch: devices, relay identity and
// every runtime file live in a private temp dir. No paid provider turns.
//
//   npm run build && cargo build -p perch-core
//   (cd relay && npm install)
//   node --experimental-strip-types e2e/relay.check.mjs
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv } from "./fixtureRuntime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-relay-check-"));
const freePort = async () => {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
};
const [corePort, relayPort] = [await freePort(), await freePort()];
const relayOrigin = `http://127.0.0.1:${relayPort}`;
const logs = { core: "", relay: "" };
const children = [];
const start = (name, command, args, options) => {
  const child = spawn(command, args, options);
  children.push(child);
  child.stdout?.on("data", (d) => { logs[name] += d; });
  child.stderr?.on("data", (d) => { logs[name] += d; });
  return child;
};
async function until(check, what) {
  const end = Date.now() + 40_000;
  while (!(await check())) {
    assert(Date.now() < end, `timed out waiting for ${what}\n--- core ---\n${logs.core}\n--- relay ---\n${logs.relay}`);
    await setTimeout(50);
  }
}
const up = (url) => async () => { try { return (await fetch(url, { signal: AbortSignal.timeout(500) })).ok; } catch { return false; } };

let socket, browser;
try {
  start("relay", "npx", ["wrangler", "dev", "--ip", "127.0.0.1", "--port", String(relayPort), "--persist-to", path.join(dir, "wrangler")], { cwd: path.join(root, "relay"), stdio: ["ignore", "pipe", "pipe"] });
  start("core", process.execPath, ["--experimental-strip-types", path.join(root, "e2e/fixtureServer.ts"), "--port", String(corePort)], {
    env: { ...process.env, ...fixtureRuntimeEnv(dir), PERCH_DEVICES: path.join(dir, "devices.json"), PERCH_DEFAULT_RELAY: relayOrigin, PERCH_NO_LOGIN_PATH: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await until(up(`http://127.0.0.1:${corePort}`), "the core");
  await until(up(relayOrigin), "the relay");

  const messages = [];
  socket = new WebSocket(`ws://127.0.0.1:${corePort}/ws`);
  socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
  await once(socket, "open", { signal: AbortSignal.timeout(5000) });
  const send = (message) => socket.send(JSON.stringify(message));
  const wait = (match, what) => until(() => messages.some(match), what);

  send({ type: "settings.update", patch: { relayUrl: relayOrigin } });
  await wait((m) => m.type === "phone.access.status" && m.relay?.state === "online", "the core to reach the relay");
  const status = messages.findLast((m) => m.type === "phone.access.status" && m.relay?.state === "online");
  const link = status.addresses.find((a) => a.kind === "relay").url;
  assert(link.startsWith(`${relayOrigin}/#r=`), link);
  assert.equal(fs.statSync(path.join(dir, "relay.json")).mode & 0o077, 0, "relay.json must be owner-only");

  // Someone who knows only the room id cannot take the host's place.
  const room = /#r=([^.]+)\./.exec(link)[1];
  const impostor = new WebSocket(`ws://127.0.0.1:${relayPort}/r/${room}?role=host&auth=${"A".repeat(43)}`);
  const refused = await new Promise((resolve) => { impostor.onerror = () => resolve(true); impostor.onopen = () => resolve(false); });
  assert(refused, "the relay accepted a host without the secret");

  send({ type: "device.pair.start", requestId: "pair" });
  await wait((m) => m.type === "device.pair.code", "a pairing code");
  const code = messages.find((m) => m.type === "device.pair.code").code;

  const { chromium } = await import("@playwright/test");
  browser = await chromium.launch({ headless: true });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const seen = [];
  phone.on("request", (request) => seen.push(request.url()));
  phone.on("websocket", (socket) => seen.push(socket.url()));
  await phone.goto(`${link}&pair=${code}`);
  const dismiss = phone.getByTestId("onboarding-dismiss");
  await dismiss.click({ timeout: 20_000 }).catch(() => {});
  // The phone shell's bottom bar: only drawn once connected and paired.
  const inApp = () => phone.getByText("Files", { exact: true }).first().waitFor({ timeout: 30_000 });
  await inApp().catch(async (error) => {
    await phone.screenshot({ path: "/tmp/perch-relay-failed.png" });
    throw new Error(`the phone never reached the app (/tmp/perch-relay-failed.png): ${error.message}\n${logs.core}\n${logs.relay}`);
  });
  await phone.screenshot({ path: "/tmp/perch-relay-phone.png" });

  // The phone paired through the tunnel and the desktop sees it.
  send({ type: "device.list", requestId: "list" });
  await wait((m) => m.type === "device.list.result" && m.devices.length === 1, "the paired phone in the device list");
  // A file bigger than one frame arrives whole, byte for byte, in chunks.
  const project = path.join(dir, "project");
  fs.mkdirSync(project);
  const big = Buffer.alloc(300_000);
  for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 8)) & 0xff;
  fs.writeFileSync(path.join(project, "big.bin"), big);
  send({ type: "project.create", requestId: "project", path: project });
  await wait((m) => m.type === "workspace.snapshot" && m.requestId === "project", "the project");
  const workspace = messages.findLast((m) => m.type === "workspace.snapshot" && m.requestId === "project").workspaces.find((w) => w.path === fs.realpathSync(project));
  const got = await phone.evaluate(async (id) => {
    const response = await fetch(`/workspace-file?workspaceId=${encodeURIComponent(id)}&path=big.bin`);
    return { status: response.status, sum: [...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("") };
  }, workspace.id);
  assert.equal(got.status, 200);
  assert.equal(got.sum, createHash("sha256").update(big).digest("hex"));
  // Its data routes went through the sealed tunnel, not the relay's HTTP.
  const direct = seen.filter((url) => /\/(pair|ws|workspace-file|upload|clipboard-image)(\?|$)/.test(new URL(url).pathname));
  assert.deepEqual(direct, [], "data routes must not be fetched from the relay directly");
  assert(seen.some((url) => url.includes("/r/")), "the phone never opened the relay socket");
  // The address bar no longer holds the key or the code.
  assert(!phone.url().includes("pair=") && !phone.url().includes("r="), phone.url());

  // A reload keeps working: the link is remembered, the token is the same.
  await phone.goto(relayOrigin);
  await inApp();
  send({ type: "device.list", requestId: "list2" });
  await wait((m) => m.requestId === "list2" && m.devices.length === 1, "no second device after reload");

  // The desktop's Settings → Devices shows the relay, its state, and a pairing QR.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(`http://127.0.0.1:${corePort}`);
  await desktop.getByTestId("onboarding-dismiss").click({ timeout: 20_000 }).catch(() => {});
  await desktop.waitForFunction(() => window.usePerchStore !== undefined);
  await desktop.evaluate(() => window.usePerchStore.getState().setSettingsOpen(true));
  await desktop.getByTestId("settings-nav-devices").click();
  await desktop.getByTestId("relay-url").waitFor();
  assert.equal(await desktop.getByTestId("relay-url").inputValue(), relayOrigin);
  await desktop.locator('[data-testid="relay-status"]:has-text("Connected")').waitFor({ timeout: 10_000 }).catch(async (error) => {
    await desktop.screenshot({ path: "/tmp/perch-relay-settings-failed.png" });
    throw error;
  });
  await desktop.getByTestId("pair-start").click();
  await desktop.getByTestId("pair-qr").waitFor();
  assert(!((await desktop.locator("body").textContent()) ?? "").includes("#r="), "the key must not be shown on screen");
  await desktop.screenshot({ path: "/tmp/perch-relay-settings.png" });
  await desktop.close();

  // Turning the relay off drops the phone's way in.
  send({ type: "settings.update", patch: { relayUrl: "" } });
  await wait((m) => m.type === "phone.access.status" && !m.relay && !m.addresses.some((a) => a.kind === "relay"), "the relay to switch off");
  // A build that names a relay offers it behind one switch: on connects, off disconnects.
  const again = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await again.goto(`http://127.0.0.1:${corePort}`);
  await again.getByTestId("onboarding-dismiss").click({ timeout: 20_000 }).catch(() => {});
  await again.waitForFunction(() => window.usePerchStore !== undefined);
  await again.evaluate(() => window.usePerchStore.getState().setSettingsOpen(true));
  await again.getByTestId("settings-nav-devices").click();
  await again.getByTestId("remote-access-switch").click();
  await again.locator('[data-testid="relay-status"]:has-text("Connected")').waitFor({ timeout: 15_000 });
  await again.screenshot({ path: "/tmp/perch-remote-switch.png" });
  await again.getByTestId("remote-access-switch").click();
  await again.locator('[data-testid="relay-status"]').waitFor({ state: "detached", timeout: 15_000 });
  process.stdout.write("Relay check passed: sealed pairing and reload through a real Worker, host impersonation refused, relay off removes the address.\n");
} finally {
  await browser?.close();
  socket?.close();
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  await setTimeout(1500);
  fs.rmSync(dir, { recursive: true, force: true });
}
