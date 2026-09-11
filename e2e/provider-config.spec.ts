import { test, expect, type Page } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

function manifest(id: string, name: string, executable = "/bin/sh") {
  return {
    id, display_name: name,
    launch: {
      executable,
      prefix_args: ["-c", "printf 'ready_%s_pid_%s_home_%s\\n' \"$PERCH_PROVIDER_FIXTURE\" \"$$\" \"${HOME-unset}\"; while IFS= read -r line; do printf 'reply_%s_%s\\n' \"$PERCH_PROVIDER_FIXTURE\" \"$line\"; done"],
      prompt: "stdin", suffix_args: [], resume: "Unsupported",
    },
    supported_modes: ["cli"], resumability: "persistentProcess",
    capabilities: ["interactiveTerminal"], status_detection: "ExitStatus",
    environment: { inherit: false, allow: [], set: { PERCH_PROVIDER_FIXTURE: id }, unset: ["HOME"] },
  };
}

async function cliMode(page: Page) {
  const mode = page.getByTestId("session-mode-toggle");
  await expect(mode).toBeEnabled();
  await page.getByTestId("session-mode-scope").selectOption("device");
  if (await mode.getAttribute("aria-checked") !== "true") await mode.click();
  await expect(page.getByTestId("cli-start-panel")).toBeVisible();
}

test("configured providers retain identity and isolation across desktop and mobile reloads", async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-providers-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(selected));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(fixture, "hosts.json");
  const providers = path.join(fixture, "providers.json");
  const coreLog = path.join(fixture, "core.log");
  fs.writeFileSync(hosts, JSON.stringify({ hosts: [] }));
  fs.writeFileSync(providers, JSON.stringify({ version: 1, providers: [
    manifest("fixture-alpha", "Alpha CLI"),
    manifest("fixture-beta", "Beta CLI with a deliberately long provider name"),
    manifest("fixture-missing", "Unavailable fixture", "/nonexistent/perch-fixture-command"),
  ] }));
  const log = fs.openSync(coreLog, "a");
  let core: ChildProcess | undefined;
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  const errors: string[] = [];
  const keys = new Map<string, { workspaceId: string; sessionId: string; agentId: string }>();
  for (const current of [page, phone]) {
    current.on("pageerror", (error) => errors.push(error.message));
    current.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.terminal.opened") keys.set(message.terminalId, message.status.key);
    }));
  }
  const seed = (directory: string) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  };
  await context.addInitScript(seed, fixture);
  await phoneContext.addInitScript(seed, fixture);
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", hosts, "--providers-path", providers], {
      cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", log, log],
    });
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(`Fixture core exited: ${fs.readFileSync(coreLog, "utf8")}`);
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
    // Two blank views before either starts a process. Both choose this
    // temporary project through the visible directory picker.
    await page.goto(url, { waitUntil: "networkidle" });
    await phone.goto(url, { waitUntil: "networkidle" });
    await cliMode(page);
    await cliMode(phone);
    for (const current of [page, phone]) {
      await expect(current.getByTestId("cli-start-agent-fixture-missing")).toBeDisabled();
      await expect(current.getByTestId("cli-start-agent-fixture-missing")).toHaveAttribute("title", /not found|unavailable|executable/i);
    }
    const shots = path.join(root, ".impeccable/review");
    fs.mkdirSync(shots, { recursive: true });
    await phone.getByTestId("cli-start-agent-fixture-beta").click();
    await expect(phone.getByRole("heading", { name: /Start a Beta CLI/ })).toBeVisible();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    for (const button of await phone.locator(".cli-start__agent-btn").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await phone.screenshot({ path: path.join(shots, `provider-picker-mobile-${testInfo.project.name}.png`) });
    await page.getByTestId("cli-start-agent-fixture-alpha").click();
    for (const current of [page, phone]) {
      await current.getByTestId("cli-start-browse").click();
      await current.getByRole("button", { name: "Use this folder", exact: true }).click();
    }
    const desktopTerminal = page.getByTestId("persistent-agent-terminal");
    const mobileTerminal = phone.getByTestId("persistent-agent-terminal");
    await expect(desktopTerminal.locator(".xterm-rows")).toContainText(/ready_fixture-alpha_pid_\d+_home_unset/);
    await expect(mobileTerminal.locator(".xterm-rows")).toContainText(/ready_fixture-beta_pid_\d+_home_unset/);
    const alphaId = (await desktopTerminal.getAttribute("data-terminal-id"))!;
    const betaId = (await mobileTerminal.getAttribute("data-terminal-id"))!;
    expect(alphaId).not.toBe(betaId);
    const alphaPid = (await desktopTerminal.locator(".xterm-rows").innerText()).match(/ready_fixture-alpha_pid_(\d+)_home_unset/)![1];
    // A launch with no user input must already be durable and reattachable.
    await page.reload({ waitUntil: "networkidle" });
    await expect(desktopTerminal).toHaveAttribute("data-terminal-id", alphaId);
    await expect(desktopTerminal.locator(".xterm-rows")).toContainText(`ready_fixture-alpha_pid_${alphaPid}_home_unset`);
    await expect(desktopTerminal.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    await expect(mobileTerminal.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    await desktopTerminal.locator(".xterm-helper-textarea").pressSequentially("alpha_message");
    await desktopTerminal.locator(".xterm-helper-textarea").press("Enter");
    await mobileTerminal.locator(".xterm-helper-textarea").pressSequentially("beta_message");
    await mobileTerminal.locator(".xterm-helper-textarea").press("Enter");
    await expect(desktopTerminal.locator(".xterm-rows")).toContainText("reply_fixture-alpha_alpha_message");
    await expect(mobileTerminal.locator(".xterm-rows")).toContainText("reply_fixture-beta_beta_message");
    await expect(page.getByTestId("chat-tab-agent-badge")).toContainText("fixture-alpha");
    await expect(page.locator(".workspace-project").filter({ hasText: path.basename(fixture) }).getByText("alpha_message", { exact: true })).toBeVisible();
    await expect(desktopTerminal.locator(".xterm-rows")).not.toContainText("beta_message");
    await expect(mobileTerminal.locator(".xterm-rows")).not.toContainText("alpha_message");
    await phone.reload({ waitUntil: "networkidle" });
    await expect(mobileTerminal).toHaveAttribute("data-terminal-id", betaId);
    await expect(mobileTerminal.locator(".xterm-rows")).toContainText("reply_fixture-beta_beta_message");
    expect(keys.size).toBe(2);
    expect(new Set([...keys.values()].map((key) => key.workspaceId)).size).toBe(1);
    expect(new Set([...keys.values()].map((key) => key.sessionId)).size).toBe(2);
    expect(errors).toEqual([]);
    await phone.screenshot({ path: path.join(shots, `provider-terminal-mobile-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(shots, `provider-terminal-desktop-${testInfo.project.name}.png`) });
    for (const terminal of [desktopTerminal, mobileTerminal]) {
      await terminal.getByRole("button", { name: "Stop CLI", exact: true }).click();
      await expect(terminal.getByTestId("cli-exited")).toBeVisible();
    }
  } finally {
    await phoneContext.close();
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    // Recover from assertion failure without killing any unrelated tmux.
    for (const key of keys.values()) {
      const hash = createHash("sha256");
      for (const value of [key.workspaceId, key.sessionId, key.agentId]) {
        const bytes = Buffer.from(value);
        const length = Buffer.alloc(8);
        length.writeBigUInt64LE(BigInt(bytes.length));
        hash.update(length); hash.update(bytes);
      }
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-agent-${hash.digest("hex")}`], { stdio: "ignore" }); } catch { /* Already stopped through the UI. */ }
    }
    fs.closeSync(log);
    await testInfo.attach("fixture-core.log", { body: fs.readFileSync(coreLog), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
