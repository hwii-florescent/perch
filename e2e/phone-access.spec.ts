/**
 * Phone access: the desktop app listens on loopback only, and Settings → Devices
 * opens (and closes) a LAN listener for paired phones.
 *
 * The desktop shell is simulated by `--port 0`, which binds loopback only the
 * way the in-process desktop core does. The phone is a separate phone-sized
 * context pointed at this machine's LAN address.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(selected));
    });
  });
}

function hasLan(): boolean {
  return Object.values(os.networkInterfaces()).some((entries) => (entries ?? []).some((e) => e.family === "IPv4" && !e.internal));
}

const reachable = (url: string) => fetch(url, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

test("Phone access opens the LAN for a QR-paired phone and closes it again", async ({ page, context, browser }, testInfo) => {
  test.skip(!hasLan(), "no non-loopback IPv4 address on this machine");
  const root = path.resolve(__dirname, "..");
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-phone-access-")));
  const phonePort = await freePort();
  const coreLog: string[] = [];
  let core: ChildProcess | null = null;
  let hostUrl = "";
  fs.writeFileSync(path.join(fixture, "hosts.json"), JSON.stringify({ hosts: [] }));

  async function boot(): Promise<void> {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", "0", "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--devices-path", path.join(fixture, "devices.json"), "--cwd", fixture],
      {
        cwd: root,
        env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", RUST_LOG: "info", PERCH_SETTINGS: path.join(fixture, "settings.json"), PERCH_PHONE_PORT: String(phonePort), PERCHD_DIR: path.join(fixture, "d") },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect.poll(() => {
      if (core?.exitCode !== null) throw new Error(`fixture core exited: ${coreLog.join("")}`);
      return /listening on port (\d+)/.exec(coreLog.join("").replace(/\x1b\[[0-9;]*m/g, ""))?.[1] ?? null;
    }, { timeout: 20_000 }).not.toBeNull();
    hostUrl = `http://127.0.0.1:${/listening on port (\d+)/.exec(coreLog.join("").replace(/\x1b\[[0-9;]*m/g, ""))![1]}`;
  }

  const seed = () => {
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
  };
  await context.addInitScript(seed);
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await phoneContext.addInitScript(seed);
  const phone = await phoneContext.newPage();

  try {
    await boot();
    await page.goto(hostUrl, { waitUntil: "networkidle" });
    await page.getByTestId("settings-gear").click();
    await page.getByTestId("settings-nav-devices").click();

    // 1. Off by default: nothing to pair with, and the LAN port is closed.
    const toggle = page.getByTestId("phone-access-switch");
    await expect(toggle).not.toBeChecked({ timeout: 10_000 });
    await expect(page.getByTestId("pair-needs-access")).toBeVisible();
    await expect(page.getByTestId("pair-start")).toHaveCount(0);
    expect(await reachable(`http://127.0.0.1:${phonePort}/`)).toBe(false);

    // 2. On: an address appears, and a pairing code comes with a QR.
    // The switch shows the host's state, so it follows the click rather than flipping at once.
    await toggle.click();
    await expect(toggle).toBeChecked({ timeout: 15_000 });
    const addressText = page.getByTestId("phone-address-url");
    await expect(addressText).toContainText(`:${phonePort}`, { timeout: 15_000 });
    const address = (await addressText.textContent())!.trim();
    await page.getByTestId("pair-start").click();
    await expect(page.getByTestId("pair-qr")).toBeVisible();
    const code = ((await page.getByTestId("pair-code").locator("strong").textContent()) ?? "").trim();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    await page.screenshot({ path: testInfo.outputPath("phone-access-host.png") });

    // 3a. Reaching the port is not enough: an unpaired device on the LAN gets the
    // pairing gate and no socket.
    const wsUrl = `${address.replace(/^http/, "ws")}ws`;
    await phone.goto(address, { waitUntil: "domcontentloaded" });
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 25_000 });
    const stranger = await phone.evaluate((url) => new Promise<boolean>((resolve) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(true);
      ws.onclose = () => resolve(false);
    }), wsUrl);
    expect(stranger, "an unpaired LAN client must not get a socket").toBe(false);

    // 3b. The phone opens the link the QR carries and is paired without typing.
    await phone.goto(`${address}#pair=${code}`, { waitUntil: "domcontentloaded" });
    // The code leaves the address bar as it is claimed, then the page reloads paired.
    await expect.poll(() => new URL(phone.url()).hash, { timeout: 25_000 }).toBe("");
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 25_000 });
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0);
    await expect(page.getByTestId("paired-devices")).toContainText("Browser", { timeout: 15_000 }); // the default name; the context has no phone user agent

    // A paired phone cannot switch Phone access off (or on) for itself.
    const refusal = await phone.evaluate((url) => new Promise<string>((resolve) => {
      const ws = new WebSocket(url);
      ws.onopen = () => ws.send(JSON.stringify({ type: "settings.update", patch: { phoneAccess: false } }));
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "phone.access.status" && message.error) resolve(message.error);
      };
      setTimeout(() => resolve("no reply"), 8000);
    }), wsUrl);
    expect(refusal).toContain("only be changed on the computer itself");
    expect(await reachable(address)).toBe(true);

    // 4. Off: the port closes and the phone loses its connection.
    await toggle.click();
    await expect(toggle).not.toBeChecked({ timeout: 15_000 });
    await expect.poll(() => reachable(address), { timeout: 15_000 }).toBe(false);
    await expect(phone.getByText("Reconnecting…")).toBeVisible({ timeout: 20_000 });

    // 5. On again: the phone's stored token still works, no second pairing.
    await toggle.click();
    await expect(toggle).toBeChecked({ timeout: 15_000 });
    await expect(phone.getByText("Reconnecting…")).toHaveCount(0, { timeout: 30_000 });
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0);
  } finally {
    await phoneContext.close();
    if (core && (core as ChildProcess).exitCode === null) {
      const child = core as ChildProcess;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    try { execFileSync("pkill", ["-f", `__perchd serve --dir ${path.join(fixture, "d")}`]); } catch { /* none running */ }
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
