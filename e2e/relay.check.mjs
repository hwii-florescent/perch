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
import { withLocalToken, localStorageState } from "./localAuth.ts";

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
// PERCH_RELAY_CHECK_URL=https://… tests an already deployed relay instead of a local one.
const deployed = process.env.PERCH_RELAY_CHECK_URL?.replace(/\/$/, "");
const relayOrigin = deployed ?? `http://127.0.0.1:${relayPort}`;
const relayWs = relayOrigin.replace(/^http/, "ws");
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
  if (!deployed) start("relay", "npx", ["wrangler", "dev", "--ip", "127.0.0.1", "--port", String(relayPort), "--persist-to", path.join(dir, "wrangler")], { cwd: path.join(root, "relay"), stdio: ["ignore", "pipe", "pipe"] });
  start("core", process.execPath, ["--experimental-strip-types", path.join(root, "e2e/fixtureServer.ts"), "--port", String(corePort)], {
    env: { ...process.env, ...fixtureRuntimeEnv(dir), PERCH_DEVICES: path.join(dir, "devices.json"), PERCH_DEFAULT_RELAY: relayOrigin, PERCH_NO_LOGIN_PATH: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await until(up(`http://127.0.0.1:${corePort}`), "the core");
  await until(up(relayOrigin), "the relay");

  const messages = [];
  socket = new WebSocket(withLocalToken(`ws://127.0.0.1:${corePort}/ws`));
  socket.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
  await once(socket, "open", { signal: AbortSignal.timeout(5000) });
  const send = (message) => socket.send(JSON.stringify(message));
  const lastStatus = () => JSON.stringify(messages.findLast((m) => m.type === "phone.access.status"));
  const wait = (match, what) => until(() => messages.some(match), `${what} (last relay status: ${lastStatus()})`);

  send({ type: "settings.update", patch: { relayUrl: relayOrigin } });
  await wait((m) => m.type === "phone.access.status" && m.relay?.state === "online", "the core to reach the relay");
  const status = messages.findLast((m) => m.type === "phone.access.status" && m.relay?.state === "online");
  const link = status.addresses.find((a) => a.kind === "relay").url;
  assert(link.startsWith(`${relayOrigin}/#r=`), link);
  assert.equal(fs.statSync(path.join(dir, "relay.json")).mode & 0o077, 0, "relay.json must be owner-only");

  // Someone who knows only the room id cannot take the host's place.
  const room = /#r=([^.]+)\./.exec(link)[1];
  const impostor = new WebSocket(`${relayWs}/r/${room}?role=host&auth=${"A".repeat(43)}`);
  const refused = await new Promise((resolve) => { impostor.onerror = () => resolve(true); impostor.onopen = () => resolve(false); });
  assert(refused, "the relay accepted a host without the secret");

  send({ type: "device.pair.start", requestId: "pair" });
  await wait((m) => m.type === "device.pair.code", "a pairing code");
  const code = messages.find((m) => m.type === "device.pair.code").code;

  const { chromium, webkit } = await import("@playwright/test");
  browser = await (process.env.PERCH_E2E_WEBKIT === "1" ? webkit : chromium).launch({ headless: true });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const seen = [];
  phone.on("request", (request) => seen.push(request.url()));
  phone.on("websocket", (socket) => seen.push(socket.url()));
  phone.on("pageerror", (error) => { logs.core += `\nPHONE PAGEERROR ${error.stack}`; });
  phone.on("console", (message) => { if (message.type() === "error") logs.core += `\nPHONE CONSOLE ${message.text()}`; });
  // The phone's relay socket, passed through as it is (sealed frames, both ways, closes included), so the check can
  // cut it at a chosen frame: `relayCut.at` frames after it is armed, the socket drops as a lost network would.
  const relayCut = { at: 0, sent: 0, cut: 0 };
  await phone.routeWebSocket(/\/r\/[^/?]+\?role=guest/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      server.send(message);
      if (relayCut.at && ++relayCut.sent === relayCut.at) {
        relayCut.at = 0;
        relayCut.cut++;
        server.close();
        ws.close();
      }
    });
    server.onMessage((message) => ws.send(message));
  });
  await phone.goto(`${link}&pair=${code}`);
  const dismiss = phone.getByTestId("onboarding-dismiss");
  await dismiss.click({ timeout: 20_000 }).catch(() => {});
  // The shell can render while disconnected: require the actual data socket too.
  const inApp = async () => {
    await phone.waitForFunction(() => window.usePerchStore?.getState().connected === true, undefined, { timeout: 30_000 });
    await phone.getByText("Files", { exact: true }).first().waitFor({ timeout: 30_000 });
  };
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
  // One WebSocket message larger than the Worker's 1 MiB frame limit (a terminal replay is the real case).
  const hugeText = "perch relay frame limit\n".repeat(90_000);
  fs.writeFileSync(path.join(project, "huge.txt"), hugeText);
  send({ type: "project.create", requestId: "project", path: project });
  await wait((m) => m.type === "workspace.snapshot" && m.requestId === "project", "the project");
  const workspace = messages.findLast((m) => m.type === "workspace.snapshot" && m.requestId === "project").workspaces.find((w) => w.path === fs.realpathSync(project));
  // A freshly installed service worker may reload the page once (autoUpdate); try again after it.
  const inPage = async (fn, arg) => {
    for (let attempt = 0; ; attempt++) {
      try {
        // The app sets this after main.tsx ran, i.e. after the transport was installed.
        await phone.waitForFunction(() => window.usePerchStore !== undefined);
        return await phone.evaluate(fn, arg);
      } catch (error) {
        if (attempt >= 3 || !/context was destroyed|navigation/.test(String(error))) throw error;
        await phone.waitForLoadState("load");
        await inApp();
      }
    }
  };
  const got = await inPage(async (id) => {
    const response = await fetch(`/workspace-file?workspaceId=${encodeURIComponent(id)}&path=big.bin`);
    const body = await response.clone().arrayBuffer();
    return { status: response.status, length: body.byteLength, head: [...new Uint8Array(body).slice(0, 8)], sum: [...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("") };
  }, workspace.id);
  assert.equal(got.status, 200);
  assert.equal(got.length, big.length, `length ${got.length}, starts ${got.head}`);
  assert.equal(got.sum, createHash("sha256").update(big).digest("hex"));
  // A single WebSocket message over 1 MiB must arrive whole and must not drop the computer's relay link.
  const huge = await inPage(async (id) => {
    const ws = new WebSocket(`${location.origin}${location.pathname.replace(/[^/]*$/, "")}ws`);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onclose = () => reject(new Error("data socket closed")); setTimeout(() => reject(new Error("data socket did not open")), 15_000); });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("fs.read result never arrived")), 30_000);
      ws.onclose = () => { clearTimeout(timer); reject(new Error("data socket closed before the large message")); };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type !== "fs.read.result" || message.requestId !== "huge") return;
        clearTimeout(timer); ws.onclose = null; ws.close();
        resolve({ frameBytes: event.data.length, contentBytes: message.content.length });
      };
      ws.send(JSON.stringify({ type: "fs.read", requestId: "huge", workspaceId: id, path: "huge.txt" }));
    });
  }, workspace.id);
  assert.equal(huge.contentBytes, hugeText.length);
  assert(huge.frameBytes > 1 << 20, `fixture must exceed the relay frame limit, got ${huge.frameBytes}`);
  assert.equal(await inPage(() => window.usePerchStore.getState().connected), true, "a large message dropped the phone's main session");
  const modsState = (requestId, body) => { send({ type: "mods.set", requestId, ...body }); return wait((m) => m.type === "mods.state" && m.requestId === requestId, `mods.set ${body.op}`).then(() => messages.findLast((m) => m.requestId === requestId)); };
  const statusOf = (screen) => inPage((screen) => document.querySelector(`[data-testid="screen-${screen}-status"]`)?.textContent ?? "", screen);
  // A phone runs a person's package only on one of its own screens (`stock:mobile-*`), and only once that was turned
  // on for this phone: its device token is in this page's storage, readable by any code on the page. Then the
  // package loads: every file of one revision (its modules, its CSS and the asset that CSS and assetUrl name) crosses
  // the sealed tunnel and runs on the app's own React. More files than the host takes pending requests (16) at once:
  // the loader sends at most MAX_RELAY_FETCHES (8) and the session survives.
  {
    const pkg = path.join(dir, "mods", "relay-esm");
    const HELPERS = 20;
    fs.mkdirSync(path.join(pkg, "lib"), { recursive: true });
    fs.mkdirSync(path.join(pkg, "art"), { recursive: true });
    fs.writeFileSync(path.join(pkg, "mod.json"), JSON.stringify({ name: "Relay ESM", format: "esm", api: "^1.6", place: "none" }));
    for (let i = 0; i < HELPERS; i++) fs.writeFileSync(path.join(pkg, "lib", `h${i}.js`), `export const n = ${i};\n`);
    fs.writeFileSync(path.join(pkg, "main.js"), [
      'import { useEffect } from "react";',
      'import { assetUrl, useModData } from "@perch/sdk";',
      'import "./look.css";',
      'import { label } from "./lib/dep.js";',
      ...Array.from({ length: HELPERS }, (_, i) => `import { n as n${i} } from "./lib/h${i}.js";`),
      `const sum = ${Array.from({ length: HELPERS }, (_, i) => `n${i}`).join(" + ")};`,
      // Its durable data (`mods/data`) makes a round trip through the tunnel: a write, then a read of what was written.
      "export default function Probe() { const data = useModData(); useEffect(() => { const root = document.documentElement.dataset; root.esmProof = label + ':' + sum; root.esmAsset = assetUrl('art/dot.svg');",
      "  data.write('trip', { sum }).then(() => data.read('trip')).then((got) => { root.modData = JSON.stringify(got && got.value); }, (error) => { root.modData = 'error: ' + error.message; }); }, [data]); return null; }",
    ].join("\n"));
    fs.writeFileSync(path.join(pkg, "lib", "dep.js"), 'export const label = "relay-esm-ok";');
    fs.writeFileSync(path.join(pkg, "look.css"), ".relay-esm-dot { background-image: url(art/dot.svg); }\n");
    fs.writeFileSync(path.join(pkg, "art", "dot.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
    const expected = `relay-esm-ok:${(HELPERS * (HELPERS - 1)) / 2}`;
    // Chosen for the phone's header: still Perch's own until this phone turns on phone screens from packages.
    await until(async () => ((await modsState(`use-header-${Date.now()}`, { id: "stock:mobile-header", op: "use", target: "relay-esm" })).error ?? null) === null, "the package to be chosen for the phone's header");
    await inPage(() => window.usePerchStore.getState().setSettingsOpen(true));
    await phone.getByTestId("settings-nav-mods").click({ timeout: 15_000 });
    await until(async () => (await statusOf("stock:mobile-header")).includes("until phone screens from your packages are on"), "the header row to say the phone has not turned it on");
    assert.equal(await inPage(() => document.documentElement.dataset.esmProof ?? null), null, "a package ran on a phone that never turned phone screens on");
    assert.equal(await phone.getByTestId("mobile-header").count(), 1, "the phone must keep Perch's own header");
    const toggle = phone.getByTestId("settings-phone-mods");
    await toggle.click();
    await until(async () => toggle.isChecked(), "the phone's switch to turn on");
    assert.equal(await inPage(() => localStorage.getItem("perch.phoneMods")), "on");
    await inPage(() => window.usePerchStore.getState().setSettingsOpen(false));
    await phone.waitForFunction((expected) => document.documentElement.dataset.esmProof === expected, expected, { timeout: 30_000 }).catch(() => { throw new Error("the ES-module package never ran on the phone"); });
    const loaded = await inPage(async () => {
      const asset = document.documentElement.dataset.esmAsset ?? "";
      const style = document.querySelector('style[data-mod-package="relay-esm"]')?.textContent ?? "";
      const svg = asset.startsWith("blob:") ? await (await fetch(asset)).text() : "";
      return { asset, style, svg };
    });
    assert.match(loaded.asset, /^blob:/, "assetUrl must name the tunnel's copy of the file");
    assert(loaded.style.includes(`url("${loaded.asset}")`), `the package CSS must point at the same object URL: ${loaded.style}`);
    assert(loaded.svg.includes("<svg"), "the asset must arrive whole");
    assert.equal(await inPage(() => window.usePerchStore.getState().connected), true, "more package files than the tunnel's request limit ended the phone's session");
    const stored = await phone.waitForFunction(() => document.documentElement.dataset.modData, undefined, { timeout: 30_000 })
      .then((handle) => handle.jsonValue()).catch(() => { throw new Error("the package's data never came back on the phone"); });
    assert.equal(stored, JSON.stringify({ sum: (HELPERS * (HELPERS - 1)) / 2 }), "the package's data must cross the tunnel both ways");
    // The relay drops while the phone fetches a new revision's files: the copy keeps what it shows and says why, and
    // once the phone is back through the relay the same revision loads. The new revision also asks for a capability
    // the relay does not carry (running a program): a readable refusal, never a request to the relay's own origin.
    {
      const BIG = 60;
      for (let i = 0; i < BIG; i++) fs.writeFileSync(path.join(pkg, "lib", `big${i}.js`), `export const b = ${i}; // ${"x".repeat(16_000)}\n`);
      // Let the phone take the revision with the new files (main.js unchanged) before the one that imports them.
      await setTimeout(2500);
      const proof = `relay-esm-2:${(BIG * (BIG - 1)) / 2}`;
      fs.writeFileSync(path.join(pkg, "main.js"), [
        'import { useEffect } from "react";',
        ...Array.from({ length: BIG }, (_, i) => `import { b as b${i} } from "./lib/big${i}.js";`),
        `const sum = ${Array.from({ length: BIG }, (_, i) => `b${i}`).join(" + ")};`,
        "export default function Probe({ api }) { useEffect(() => { const root = document.documentElement.dataset; root.esmProof = 'relay-esm-2:' + sum;",
        "  api.exec('echo', ['hi']).then(() => { root.execResult = 'ran'; }, (error) => { root.execResult = error.message; }); }, [api]); return null; }",
      ].join("\n"));
      relayCut.sent = 0;
      relayCut.at = 12;
      await phone.waitForFunction(() => [...document.querySelectorAll('[data-testid="mod-error"]')].some((el) => el.textContent.includes("Perch could not be reached")), undefined, { timeout: 30_000 })
        .catch(() => { throw new Error(`no readable error after the relay dropped mid-fetch (cut ${relayCut.cut} time(s))`); });
      assert.equal(relayCut.cut, 1, "the relay must have been cut once, mid-fetch");
      assert.equal(await phone.evaluate(() => document.documentElement.dataset.esmProof), expected, "the last good revision must stay while the new one cannot load");
      await inApp();
      await phone.waitForFunction((proof) => document.documentElement.dataset.esmProof === proof, proof, { timeout: 60_000 })
        .catch(() => { throw new Error("the new revision never loaded once the phone was back through the relay"); });
      await phone.waitForFunction(() => !document.querySelector('[data-testid="mod-error"]'), undefined, { timeout: 15_000 });
      await phone.waitForFunction(() => document.documentElement.dataset.execResult, undefined, { timeout: 15_000 });
      assert.equal(await phone.evaluate(() => document.documentElement.dataset.execResult), "This is not available over the relay: open Perch on the computer that runs the core.");
      assert.equal(await inPage(() => window.usePerchStore.getState().connected), true, "the phone must be connected again");
    }
    // Perch's own header again, for the rest of the check.
    assert.equal((await modsState("use-header-off", { id: "stock:mobile-header", op: "use", target: "" })).error ?? null, null);
    await phone.getByTestId("mobile-header").waitFor({ timeout: 15_000 });
  }
  // A stock screen comes from the Worker's own copy of this web build (no tunnel), on the same React and @perch/sdk.
  {
    await phone.evaluate(() => document.activeElement?.blur());
    await phone.keyboard.press("Shift+Slash");
    await phone.getByTestId("keybind-help").getByRole("heading", { name: "Keybindings", exact: true }).waitFor({ timeout: 30_000 })
      .catch(() => { throw new Error("the stock keybind help never showed on the phone"); });
    assert(seen.some((url) => url.startsWith(`${relayOrigin}/stock-ui/keybind-help/main.js`)), "stock files must come from the relay's own assets");
    await phone.keyboard.press("Escape");
    await phone.getByTestId("keybind-help").waitFor({ state: "detached", timeout: 10_000 });
  }
  // Settings > Mods is the phone's way back from a person's copy, through the tunnel: with a copy of the dropdown
  // chosen for every dropdown (a computer's screen, so it never runs on the phone, even turned on), the page is
  // Perch's own, the row says so, and choosing "Perch's own" there reaches the core.
  {
    assert.equal((await modsState("clone-select", { id: "stock:select", op: "clone", as: "relay-my-select" })).error ?? null, null);
    const main = path.join(dir, "mods", "relay-my-select", "main.js");
    const source = fs.readFileSync(main, "utf8");
    assert(source.includes('"data-testid": testId'), "the dropdown's root must carry its test id");
    fs.writeFileSync(main, source.replace('"data-testid": testId', '"data-testid": testId, "data-relay-copy": "edited"'));
    await until(async () => ((await modsState(`use-select-${Date.now()}`, { id: "stock:select", op: "use", target: "relay-my-select" })).error ?? null) === null, "the copy to be chosen");
    await phone.reload();
    await inApp();
    await inPage(() => window.usePerchStore.getState().setSettingsOpen(true));
    await phone.getByTestId("settings-nav-mods").click({ timeout: 15_000 });
    const use = phone.getByTestId("screen-stock:select-use");
    const status = phone.getByTestId("screen-stock:select-status");
    await use.waitFor({ timeout: 30_000 });
    assert.equal(await use.getAttribute("data-relay-copy"), null, "Settings > Mods must never run the person's copy");
    await until(async () => (await statusOf("stock:select")).includes("chosen for the computer; this phone shows Perch's own"), "the dropdown row to say the copy is the computer's");
    assert.equal(await phone.locator('[data-relay-copy="edited"]').count(), 0, "a computer's copy ran on the phone");
    // Chosen by keys, as on the desktop recovery check: each try opens the list, goes to "Perch's own" and takes it
    // only once the trigger names that row active (a list a late scroll closed is opened again).
    const option = phone.getByRole("option", { name: "Perch's own", exact: true });
    await until(async () => {
      await use.focus();
      if (!(await option.count())) await use.press("ArrowDown");
      if (!(await option.count())) return false;
      await use.press("Home");
      const id = await option.getAttribute("id").catch(() => null);
      if (!id || (await use.getAttribute("aria-activedescendant")) !== id) return false;
      await use.press("Enter");
      await setTimeout(300);
      return !(await statusOf("stock:select")).includes("Your");
    }, "the phone to put Perch's own dropdown back");
    await phone.waitForFunction(() => { const text = document.querySelector('[data-testid="screen-stock:select-status"]')?.textContent ?? ""; return text.includes("Perch's own") && !text.includes("Your"); }, undefined, { timeout: 15_000 })
      .catch(async (error) => { await phone.screenshot({ path: "/tmp/perch-relay-mods-failed.png" }); throw new Error(`the phone could not put Perch's own dropdown back (/tmp/perch-relay-mods-failed.png): ${error.message} (status: ${await status.textContent()})`); });
    send({ type: "mods.list", requestId: "mods-after-list" });
    await wait((m) => m.type === "mods.state" && m.requestId === "mods-after-list", "the mods list");
    assert.equal(messages.findLast((m) => m.requestId === "mods-after-list").uses?.["stock:select"], undefined, "the core still uses the copy");
    await phone.screenshot({ path: "/tmp/perch-relay-mods.png" });
    await inPage(() => window.usePerchStore.getState().setSettingsOpen(false));
  }
  // Its data routes went through the sealed tunnel, not the relay's HTTP.
  const direct = seen.filter((url) => /\/(pair|ws|workspace-file|upload|clipboard-image|mods\/package|mods\/data|mods\/exec|mods\/fs|terminal\/read)(\?|$)/.test(new URL(url).pathname));
  assert.deepEqual(direct, [], "data routes must not be fetched from the relay directly");
  assert(seen.some((url) => url.includes("/r/")), "the phone never opened the relay socket");
  // The address bar no longer holds the key or the code.
  assert(!phone.url().includes("pair=") && !phone.url().includes("r="), phone.url());

  // The desktop controls a shell; the phone opens it through the relay, fits the PTY to itself and types.
  {
  const desktop = await browser.newPage({ viewport: { width: 1272, height: 820 }, storageState: localStorageState() });
  await desktop.goto(`http://127.0.0.1:${corePort}/`);
  await desktop.getByTestId("onboarding-dismiss").click({ timeout: 5000 }).catch(() => {});
  await desktop.getByTestId("new-session-local").click();
  await desktop.locator('[data-testid="new-session-row-none"]').first().click();
  await desktop.getByTestId("new-session-row-terminal").click();
  await desktop.locator('[data-testid="persistent-agent-terminal"][data-controlling="true"]').waitFor({ timeout: 30_000 });
  await phone.reload();
  await inApp();
  await phone.getByText("New session").first().click();
  await phone.locator('[data-testid^="workspace-session-"]:not([data-testid*="close"])').first().click();
  const phoneTerminal = phone.locator('[data-testid="persistent-agent-terminal"][data-writable="true"][data-controlling="true"]');
  await phoneTerminal.waitFor({ timeout: 30_000 });
  // A tap must focus the terminal's input, or a phone never opens its keyboard.
  const surface = await phoneTerminal.locator(".terminal__surface").boundingBox();
  await phone.touchscreen.tap(surface.x + surface.width / 2, surface.y + surface.height / 2);
  await phone.waitForFunction(() => document.activeElement?.classList.contains("xterm-helper-textarea"), undefined, { timeout: 5000 })
    .catch(() => { throw new Error("tapping the phone terminal did not focus its input, so no keyboard would open"); });
  await phone.keyboard.type("echo PHONE_TYPED_OK");
  await phone.keyboard.press("Enter");
  await desktop.waitForFunction(() => document.querySelector(".xterm-rows")?.textContent.includes("PHONE_TYPED_OK"), undefined, { timeout: 15_000 });
  const phoneCols = await phone.evaluate(() => document.querySelector(".xterm-rows").children[0].textContent.length);
  // The desktop surface is ~150 columns wide; a phone left following it would show that many.
  assert(phoneCols <= 100, `the phone terminal did not fit the phone: ${phoneCols} columns`);
  // The desktop is told a phone holds the size, and can take it back.
  await desktop.getByTestId("phone-size-notice").waitFor({ timeout: 10_000 });
  await desktop.screenshot({ path: "/tmp/perch-phone-notice-desktop.png" });
  await phone.screenshot({ path: "/tmp/perch-phone-terminal.png" });
  await desktop.getByRole("button", { name: "Take back this tab" }).click();
  await desktop.getByTestId("phone-size-notice").waitFor({ state: "detached", timeout: 10_000 });
  // The PTY is the desktop's size again, and the phone follows it.
  await phone.waitForFunction(() => document.querySelector(".xterm-screen")?.getBoundingClientRect().width > innerWidth, undefined, { timeout: 10_000 });
  await desktop.close();
  }

  // A reload keeps working: the link is remembered, the token is the same.
  await phone.goto(relayOrigin);
  await inApp();
  send({ type: "device.list", requestId: "list2" });
  await wait((m) => m.requestId === "list2" && m.devices.length === 1, "no second device after reload");

  const soakMs = Number(process.env.PERCH_RELAY_CHECK_SOAK_MS ?? 0);
  assert(Number.isSafeInteger(soakMs) && soakMs >= 0 && soakMs <= 600_000, "soak duration must be 0–600000 ms");
  if (soakMs) {
    const drops = await inPage(async (ms) => {
      const store = window.usePerchStore;
      let drops = 0;
      const off = store.subscribe((state, previous) => { if (previous.connected && !state.connected) drops++; });
      await new Promise((resolve) => setTimeout(resolve, ms));
      off();
      return drops;
    }, soakMs);
    assert.equal(drops, 0, "relay disconnected during the idle soak");
    const paired = await inPage(async () => { const response = await fetch("/pair"); return (await response.json()).paired; });
    assert.equal(paired, true, "the sealed session stopped answering after the idle soak");
  }

  // A replaced host loses its sealed sessions. Guests must reconnect too,
  // rather than keep an apparently open socket to a session that no longer exists.
  const { hostSecret } = JSON.parse(fs.readFileSync(path.join(dir, "relay.json"), "utf8"));
  const replacement = new WebSocket(`${relayWs}/r/${room}?role=host&auth=${hostSecret}`);
  await once(replacement, "open", { signal: AbortSignal.timeout(5000) });
  replacement.close();
  await phone.waitForFunction(() => window.usePerchStore?.getState().connected === false, undefined, { timeout: 10_000 });
  await inApp();

  // The desktop's Settings → Devices shows the relay, its state, and a pairing QR.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, storageState: localStorageState() });
  await desktop.goto(`http://127.0.0.1:${corePort}`);
  await desktop.getByTestId("onboarding-dismiss").click({ timeout: 20_000 }).catch(() => {});
  await desktop.waitForFunction(() => window.usePerchStore !== undefined);
  await desktop.evaluate(() => window.usePerchStore.getState().setSettingsOpen(true));
  await desktop.getByTestId("settings-nav-devices").click();
  // The build names this relay, so it is the "Remote access" switch, already on.
  await desktop.getByTestId("remote-access-switch").waitFor();
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
  await phone.waitForFunction(() => window.usePerchStore?.getState().connected === false, undefined, { timeout: 10_000 });
  // A fresh phone can inspect its failed handshake without developer tools.
  const lostPhone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await lostPhone.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  await lostPhone.goto(link);
  await lostPhone.getByTestId("laptop-unreachable").waitFor({ timeout: 20_000 });
  await lostPhone.getByTestId("connection-details").locator("summary").click();
  const reportText = await lostPhone.getByLabel("Connection diagnostic report").textContent();
  const report = JSON.parse(reportText);
  assert.equal(report.mode, "relay");
  assert.equal(report.perchConnected, false);
  assert.equal(report.linkPresent, true);
  assert.equal(report.roomFingerprint, createHash("sha256").update(room).digest("hex").slice(0, 12));
  assert.equal(report.closeCode, 4004);
  for (const secret of [room, link.split(".").at(-1), code, hostSecret]) assert(!reportText.includes(secret), "diagnostic report leaked a secret");
  assert(!((await lostPhone.locator("body").textContent()) ?? "").includes("this phone is on the same Wi-Fi"), "relay failures must not require Wi-Fi or Tailscale");
  await lostPhone.screenshot({ path: "/tmp/perch-connection-phone.png" });
  await lostPhone.setViewportSize({ width: 1280, height: 800 });
  await lostPhone.getByTestId("connection-details").locator("summary").click();
  await lostPhone.screenshot({ path: "/tmp/perch-connection-desktop.png" });
  await lostPhone.close();
  // A build that names a relay offers it behind one switch: on connects, off disconnects.
  const again = await browser.newPage({ viewport: { width: 1280, height: 800 }, storageState: localStorageState() });
  await again.goto(`http://127.0.0.1:${corePort}`);
  await again.getByTestId("onboarding-dismiss").click({ timeout: 20_000 }).catch(() => {});
  await again.waitForFunction(() => window.usePerchStore !== undefined);
  await again.evaluate(() => window.usePerchStore.getState().setSettingsOpen(true));
  await again.getByTestId("settings-nav-devices").click();
  await again.getByTestId("remote-access-switch").click();
  await again.locator('[data-testid="relay-status"]:has-text("Connected")').waitFor({ timeout: 15_000 });
  await inApp(); // The existing phone must establish a fresh sealed session without reloading.
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
