import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { localStorageState } from "./localAuth";

// Real desktop/mobile views with a fake native IPC seam: never request consent,
// open System Settings, run an agent or send a real OS notification.
test("notification permission, banner status and explicit actions on desktop and mobile", async ({ browser }, testInfo) => {
  const repo = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-notification-ui-"));
  fs.writeFileSync(path.join(fixture, "hosts.json"), JSON.stringify({ hosts: [] }));
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = (socket.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  let core: ChildProcess | undefined;
  try {
    core = spawn(path.join(repo, "target/debug/perch-core"), ["--port", String(port)], {
      cwd: repo, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", log, log],
    });
    const url = `http://127.0.0.1:${port}`;
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(fs.readFileSync(path.join(fixture, "core.log"), "utf8"));
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
    const shots = path.join(repo, ".impeccable/review"); fs.mkdirSync(shots, { recursive: true });
    for (const [size, viewport] of [["desktop", { width: 1400, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
      const context = await browser.newContext({ viewport, storageState: localStorageState() });
      try {
        await context.addInitScript(() => {
          if (location.origin === "null") return;
          localStorage.setItem("perch.onboarding.seen", "1");
          Object.defineProperty(navigator, "platform", { configurable: true, value: "MacIntel" });
          const target = window as unknown as {
            notificationProbe: { permission: string; alerts: boolean; alertStyle: string; calls: string[] };
            __TAURI_INTERNALS__: { invoke(command: string): Promise<unknown> };
          };
          target.notificationProbe = { permission: "default", alerts: false, alertStyle: "none", calls: [] };
          target.__TAURI_INTERNALS__ = { invoke: async (command) => {
            const state = target.notificationProbe;
            state.calls.push(command);
            if (command === "notification_request_permission") { state.permission = "granted"; state.alerts = true; state.alertStyle = "banner"; }
            if (command.startsWith("notification_")) return { permission: state.permission, alerts: state.alerts, alertStyle: state.alertStyle };
            return null;
          } };
        });
        const page = await context.newPage();
        const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(url, { waitUntil: "networkidle" });
        if (size === "desktop") await page.getByRole("button", { name: "Not now", exact: true }).click();
        await page.getByTestId("settings-gear").click();
        await page.getByTestId("settings-nav-notifications").click();
        await expect(page.getByTestId("notification-permission-status")).toContainText("Not requested");
        expect(await page.evaluate("window.notificationProbe.calls.includes('notification_request_permission')")).toBe(false);
        await page.screenshot({ path: path.join(shots, `notifications-${size}-${testInfo.project.name}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole("button", { name: "Allow notifications", exact: true }).click();
        await expect(page.getByTestId("notification-permission-status")).toContainText("Allowed.");
        await page.getByRole("button", { name: "Send test", exact: true }).click();
        await expect(page.getByText("Test submitted.", { exact: false })).toBeVisible();
        expect(await page.evaluate("window.notificationProbe.calls.includes('notify_session')")).toBe(true);
        await page.evaluate("window.notificationProbe.alerts = false; window.notificationProbe.alertStyle = 'none'");
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await expect(page.getByTestId("notification-permission-status")).toContainText("banners are off");
        await page.getByRole("button", { name: "Open macOS Settings", exact: true }).click();
        expect(await page.evaluate("window.notificationProbe.calls.includes('notification_open_settings')")).toBe(true);
        expect(errors).toEqual([]);
      } finally { await context.close(); }
    }
  } finally {
    if (core && core.exitCode === null) { const exit = once(core, "exit"); core.kill("SIGTERM"); await exit; }
    await cleanupFixtureRuntime(repo, fixture);
    fs.closeSync(log); fs.rmSync(fixture, { recursive: true, force: true });
  }
});
