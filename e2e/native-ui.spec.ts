import { test, expect, type BrowserContext } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

for (const provider of ["pi", "omp"]) test(`${provider}: UI and CLI share native turns across a core crash`, async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-ui-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
  const token = `native_${provider}_${Date.now()}`;
  fs.writeFileSync(path.join(fixture, "sentinel.txt"), token);
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const url = `http://127.0.0.1:${port}`;
  let completed = false;
  let core: ChildProcess | undefined;
  let phoneContext: BrowserContext | undefined;
  let terminalId: string | undefined;
  const keys = new Map<string, { workspaceId: string; sessionId: string; agentId: string }>();
  const errors: string[] = [];
  const snapshots: Array<{ pid: number; revision: number; providerSessionId: string; cwd: string }> = [];
  const actions: Array<{ type: string; operationId?: string; text?: string }> = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.terminal.opened") { keys.set(message.terminalId, message.status.key); terminalId = message.terminalId; }
      if (message.type === "agent.ui.snapshot") { snapshots.push(message.snapshot); if (snapshots.length > 512) snapshots.shift(); }
    });
    socket.on("framesent", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "agent.ui.prompt") actions.push(message); });
  });
  await context.addInitScript((directory) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  }, fixture);
  const shots = path.join(root, ".impeccable/review");
  fs.mkdirSync(shots, { recursive: true });
  async function start() {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", log, log] });
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
  }
  async function stop() {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
  }
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const toggle = page.getByTestId("session-mode-toggle");
  try {
    await start();
    await page.goto(url, { waitUntil: "networkidle" });
    await expect(toggle).toBeEnabled();
    await page.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    await page.getByTestId(`cli-start-agent-${provider}`).click();
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    await expect(cli.locator(".xterm-rows")).toContainText(provider === "omp" ? /OMP|oh.my.pi|omp v/i : /pi v|pi \(|pi coding|pi update|pi\.dev|\.pi\/agent/i, { timeout: 30_000 });
    await page.getByTestId("session-mode-scope").selectOption("session");
    await toggle.click();
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(ui.getByTestId("native-cli-composer")).toBeEnabled();
    const pid = await ui.getAttribute("data-native-pid");
    const nativeId = await ui.getAttribute("data-native-session");
    expect(fs.realpathSync(snapshots.at(-1)!.cwd)).toBe(fs.realpathSync(fixture));
    const firstPrompt = "Read sentinel.txt with your file tool. Reply with its exact contents only.";
    await ui.getByTestId("native-cli-composer").fill(firstPrompt);
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(token, { timeout: 90_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 20_000 });
    expect(actions).toHaveLength(1);
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1);
    await expect(ui.locator('[data-native-role="toolResult"]')).not.toHaveCount(0);
    await page.screenshot({ path: path.join(shots, `native-ui-${provider}-${testInfo.project.name}.png`) });
    await toggle.click();
    await expect(cli).toHaveAttribute("data-terminal-id", terminalId!);
    await expect(cli.locator(".xterm-rows")).toContainText(token);
    await expect(cli.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    const beforeReload = snapshots.length;
    const beforeRevision = snapshots.at(-1)!.revision;
    await cli.locator(".xterm-helper-textarea").pressSequentially("/reload", { delay: 10 });
    await cli.locator(".xterm-helper-textarea").press("Enter");
    if (provider === "pi") {
      await expect.poll(() => snapshots.slice(beforeReload).some((value) => value.revision < beforeRevision), { timeout: 20_000 }).toBe(true);
    } else {
      // OMP's built-in /reload reloads plugins, retaining CLI extensions.
      await expect(cli.locator(".xterm-rows")).toContainText("Plugins reloaded.");
    }
    await cli.locator(".xterm-helper-textarea").pressSequentially("What exact token did you just read? Reply only with the token.", { delay: 10 });
    await cli.locator(".xterm-helper-textarea").press("Enter");
    await toggle.click();
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2, { timeout: 30_000 });
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(token, { timeout: 90_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 20_000 });
    await expect(ui).toHaveAttribute("data-native-pid", pid!);
    await expect(ui).toHaveAttribute("data-native-session", nativeId!);
    await ui.getByTestId("native-cli-composer").fill("unsent draft");
    await toggle.click(); await toggle.click();
    await expect(ui.getByTestId("native-cli-composer")).toHaveValue("unsent draft");
    await stop(); await start();
    await page.reload({ waitUntil: "networkidle" });
    await expect(ui).toHaveAttribute("data-native-pid", pid!, { timeout: 30_000 });
    await expect(ui).toHaveAttribute("data-native-session", nativeId!);
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2);
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(token);
    expect(new Set([...keys.values()].map((key) => JSON.stringify(key))).size).toBe(1); // The PTY attachment is recreated; the native process and logical identity survive.
    expect(actions).toHaveLength(1); // The CLI-typed turn bypasses Perch's composer.
    expect(new Set(snapshots.map((value) => value.pid)).size).toBe(1);
    expect(errors).toEqual([]);
    phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await phoneContext.addInitScript((sessionId) => {
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sessionId", sessionId);
    }, [...keys.values()][0].sessionId);
    const phone = await phoneContext.newPage();
    phone.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    await phone.goto(url, { waitUntil: "networkidle" });
    const mobile = phone.getByTestId("native-cli-chat");
    await expect(mobile).toHaveAttribute("data-native-pid", pid!);
    await expect(mobile.getByTestId("native-cli-composer")).toBeDisabled();
    await expect(mobile).toContainText("Another viewer has control");
    await ui.getByRole("button", { name: "Release control", exact: true }).click();
    await mobile.getByRole("button", { name: "Take control", exact: true }).click();
    await expect(mobile.getByTestId("native-cli-composer")).toBeEnabled();
    await expect(ui.getByTestId("native-cli-composer")).toBeDisabled();
    await mobile.getByTestId("native-cli-composer").fill("Reply with that same token once more, and nothing else.");
    await mobile.getByRole("button", { name: "Send", exact: true }).click();
    await expect(mobile.locator('[data-native-role="user"]')).toHaveCount(3);
    await expect(mobile.locator('[data-native-role="assistant"]').last()).toContainText(token, { timeout: 90_000 });
    await expect(mobile.getByRole("status")).toHaveText("Ready");
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(3);
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(token);
    await expect.poll(() => phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await phone.screenshot({ path: path.join(shots, `native-ui-${provider}-mobile-${testInfo.project.name}.png`) });
    await mobile.getByTestId("native-cli-composer").fill("Use your bash tool to run sleep 20. After it finishes, reply slow_turn_finished.");
    await mobile.getByRole("button", { name: "Send", exact: true }).click();
    await expect(mobile.locator('[data-native-role="user"]')).toHaveCount(4);
    await expect(mobile.locator('[data-native-role="assistant"] details').filter({ has: phone.locator("summary", { hasText: /^bash$/ }) }).last()).toContainText("sleep 20", { timeout: 90_000 });
    const cancelStarted = Date.now();
    await mobile.getByRole("button", { name: "Cancel turn", exact: true }).click();
    await expect(mobile.getByRole("status")).toHaveText("Ready", { timeout: 10_000 });
    expect(Date.now() - cancelStarted).toBeLessThan(15_000);
    await expect(mobile.locator(".message__markdown")).not.toContainText(["slow_turn_finished"]);
    await expect(ui.getByRole("status")).toHaveText("Ready");
    await mobile.getByRole("button", { name: "Release control", exact: true }).click();
    await ui.getByRole("button", { name: "Take control", exact: true }).click();
    expect(errors).toEqual([]);
    await phoneContext.close(); phoneContext = undefined;
    await toggle.click();
    await expect(cli.getByRole("button", { name: "Stop CLI", exact: true })).toBeEnabled();
    await cli.getByRole("button", { name: "Stop CLI", exact: true }).click();
    await expect(cli.getByTestId("cli-exited")).toBeVisible();
    completed = true;
  } finally {
    if (!completed) {
      await page.screenshot({ path: path.join(shots, `native-ui-${provider}-failure-${testInfo.project.name}.png`) }).catch(() => {});
      await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    }
    await phoneContext?.close();
    await stop();
    for (const key of keys.values()) {
      const hash = createHash("sha256");
      for (const value of [key.workspaceId, key.sessionId, key.agentId]) { const bytes = Buffer.from(value); const size = Buffer.alloc(8); size.writeBigUInt64LE(BigInt(bytes.length)); hash.update(size); hash.update(bytes); }
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-agent-${hash.digest("hex")}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    fs.closeSync(log);
    await testInfo.attach("core.log", { body: fs.readFileSync(path.join(fixture, "core.log")), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
