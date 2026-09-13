import { test, expect, type Page } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

test("installed OMP and Pi run in separate persistent panes", async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-clis-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(fixture, "hosts.json");
  const providers = path.join(fixture, "providers.json");
  fs.writeFileSync(hosts, '{"hosts":[]}');
  fs.writeFileSync(providers, '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  let core: ChildProcess | undefined;
  const secondContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const second = await secondContext.newPage();
  const keys = new Map<string, { workspaceId: string; sessionId: string; agentId: string }>();
  const shellIds = new Set<string>();
  const errors: string[] = [];
  for (const current of [page, second]) {
    current.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    current.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.terminal.opened") keys.set(message.terminalId, message.status.key);
      if (message.type === "terminal.opened") shellIds.add(message.terminal.id);
    }));
  }
  const seed = (directory: string) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  };
  await context.addInitScript(seed, fixture);
  await secondContext.addInitScript(seed, fixture);
  const shots = path.join(root, ".impeccable/review");
  fs.mkdirSync(shots, { recursive: true });
  async function prepare(current: Page) {
    await current.goto(url, { waitUntil: "networkidle" });
    const toggle = current.getByTestId("session-mode-toggle");
    await expect(toggle).toBeEnabled();
    await current.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    for (const provider of ["claude", "codex", "omp", "pi"]) {
      await expect(current.getByTestId(`cli-start-agent-${provider}`)).toBeVisible();
    }
  }
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", hosts, "--providers-path", providers], {
      cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", log, log],
    });
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error("Fixture core exited before readiness");
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
    await prepare(page);
    await prepare(second);
    for (const [current, provider] of [[page, "omp"], [second, "pi"]] as const) {
      await expect(current.getByTestId(`cli-start-agent-${provider}`)).toBeEnabled();
      if (provider === "pi") {
        await current.getByTestId("new-session-local").click();
        await current.getByTestId("new-session-popover-agent-pi").click();
      } else {
        await current.getByTestId(`cli-start-agent-${provider}`).click();
        await current.getByTestId("cli-start-browse").click();
      }
      await current.getByRole("button", { name: "Use this folder", exact: true }).click();
      const terminal = current.getByTestId("persistent-agent-terminal");
      await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
      await expect(terminal.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
      await expect(terminal.locator(".xterm-rows")).toContainText(provider === "omp" ? /OMP|oh.my.pi|omp v/i : /pi v|pi \(|pi coding|pi update|pi\.dev|\.pi\/agent/i, { timeout: 30_000 });
      await terminal.locator(".xterm-helper-textarea").pressSequentially(`perch_${provider}_draft`, { delay: 20 });
      await expect(terminal.locator(".xterm-rows")).toContainText(`perch_${provider}_draft`);
    }
    const ompKey = [...keys.entries()].find(([, key]) => key.agentId === "omp")!;
    const piKey = [...keys.entries()].find(([, key]) => key.agentId === "pi")!;
    expect(ompKey[1].workspaceId).toBe(piKey[1].workspaceId);
    expect(ompKey[1].sessionId).not.toBe(piKey[1].sessionId);
    await second.close();
    await page.getByTestId("pane-split-session").first().click();
    await page.getByTestId(`session-split-option-${piKey[1].sessionId}`).click();
    const omp = page.locator(`[data-testid="persistent-agent-terminal"][data-terminal-id="${ompKey[0]}"]`);
    const pi = page.locator(`[data-testid="persistent-agent-terminal"][data-terminal-id="${piKey[0]}"]`);
    await expect(omp).toBeVisible();
    await expect(pi).toBeVisible();
    await expect(pi.locator(".xterm-rows")).toContainText("perch_pi_draft");
    await expect(omp.locator(".xterm-rows")).not.toContainText("perch_pi_draft");
    await expect(pi.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    await pi.locator(".xterm-helper-textarea").pressSequentially("_split", { delay: 20 });
    await expect(pi.locator(".xterm-rows")).toContainText("perch_pi_draft_split");
    await expect(omp.locator(".xterm-rows")).not.toContainText("_split");
    await page.reload({ waitUntil: "networkidle" });
    await expect(omp.locator(".xterm-rows")).toContainText("perch_omp_draft");
    await expect(pi.locator(".xterm-rows")).toContainText("perch_pi_draft_split");
    expect(keys.size).toBe(2);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByTestId("navigator-command-omp")).toBeVisible();
    await expect(page.getByTestId("navigator-command-pi")).toBeVisible();
    await page.getByTestId("navigator-input").fill("new terminal");
    await page.getByTestId("navigator-command-terminal").click();
    const shell = page.locator(".terminal--persistent").filter({ has: page.getByRole("button", { name: "Close shell", exact: true }) });
    await expect(shell.getByText("Shell running", { exact: true })).toBeVisible();
    await shell.locator(".xterm-helper-textarea").pressSequentially("printf 'perch_shell_path_%s\\n' \"$PWD\"");
    await shell.locator(".xterm-helper-textarea").press("Enter");
    await expect(shell.locator(".xterm-rows")).toContainText(`perch_shell_path_${fixture}`);
    await shell.getByRole("button", { name: "Close shell", exact: true }).click();
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(shots, `native-omp-pi-split-${testInfo.project.name}.png`) });
    for (const terminal of [omp, pi]) {
      await terminal.getByRole("button", { name: "Stop CLI", exact: true }).click();
      await expect(terminal.getByTestId("cli-exited")).toBeVisible();
    }
  } finally {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: path.join(shots, `native-provider-failure-${testInfo.project.name}.png`) }).catch(() => {});
    }
    await secondContext.close();
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    for (const key of keys.values()) {
      const hash = createHash("sha256");
      for (const value of [key.workspaceId, key.sessionId, key.agentId]) {
        const bytes = Buffer.from(value);
        const length = Buffer.alloc(8);
        length.writeBigUInt64LE(BigInt(bytes.length));
        hash.update(length); hash.update(bytes);
      }
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-agent-${hash.digest("hex")}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    for (const id of shellIds) {
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-shell-${id}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    fs.closeSync(log);
    await testInfo.attach("fixture-core.log", { body: fs.readFileSync(path.join(fixture, "core.log")), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
