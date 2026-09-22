import { test, expect, type Page } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { cheapModelEnv, CHEAP_CODEX_MODEL } from "./cheapModel";

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
  let activeSession: string | undefined;
  const backgroundReplies = new Set<string>();
  const replyTokens = { omp: `omp_split_${Date.now()}`, pi: `pi_split_${Date.now()}` };
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "session.subscribe") activeSession = message.sessionId;
    });
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.ui.snapshot" && !message.requestId && message.sessionId !== activeSession) {
        const token = replyTokens[message.providerId as keyof typeof replyTokens];
        if (token && message.snapshot.messages.some((entry: { role: string; text: string }) => entry.role === "assistant" && entry.text.includes(token))) backgroundReplies.add(message.providerId);
      }
    });
  });
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
    // Pi and OMP share the config-home variable but use different formats.
    // Give this fixture's Pi executable its own cheap-model overlay.
    const piEnv = cheapModelEnv("pi", fixture);
    expect(piEnv.PI_CODING_AGENT_DIR).toBeTruthy();
    const realPi = execFileSync("which", ["pi"], { encoding: "utf8" }).trim();
    const bin = path.join(fixture, "bin");
    fs.mkdirSync(bin);
    const quote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
    fs.writeFileSync(path.join(bin, "pi"), `#!/bin/sh\nexport PI_CODING_AGENT_DIR=${quote(piEnv.PI_CODING_AGENT_DIR!)}\nexec ${quote(realPi)} "$@"\n`, { mode: 0o700 });
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", hosts, "--providers-path", providers], {
      cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", RUST_LOG: "info", ...cheapModelEnv("omp", fixture), PATH: `${bin}:${process.env.PATH}` }, stdio: ["ignore", log, log],
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

    // Keep both native sessions mounted in one browser tab. A snapshot must
    // reach an observed pane even when another session owns the active view.
    for (const terminal of [omp, pi]) {
      await terminal.locator(".xterm-helper-textarea").press("Control+u");
      const group = page.locator(".dv-groupview").filter({ has: terminal });
      await group.getByTestId("session-mode-scope").selectOption("session");
      await group.getByTestId("session-mode-toggle").click();
    }
    const ompUi = page.locator('[data-testid="native-cli-chat"][data-provider="omp"]');
    const piUi = page.locator('[data-testid="native-cli-chat"][data-provider="pi"]');
    for (const ui of [ompUi, piUi]) {
      await expect(ui).toBeVisible();
      await expect(ui.locator(".native-cli-chat__model")).toContainText(CHEAP_CODEX_MODEL);
      await expect(ui.getByTestId("native-cli-composer")).toBeEnabled();
    }
    const pids = [await ompUi.getAttribute("data-native-pid"), await piUi.getAttribute("data-native-pid")];
    expect(pids[0]).not.toBe(pids[1]);
    await ompUi.getByTestId("native-cli-composer").fill(`Reply only ${replyTokens.omp}.`);
    await ompUi.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ompUi.getByRole("status")).toHaveText("Working");
    await piUi.getByTestId("native-cli-composer").fill(`Use your bash tool to run sleep 3, then reply only ${replyTokens.pi}.`);
    await piUi.getByRole("button", { name: "Send", exact: true }).click();
    await ompUi.getByTestId("native-cli-composer").click();
    // Dockview focus does not change the tab's single session subscription.
    await expect.poll(() => activeSession).toBe(ompKey[1].sessionId);
    for (const [ui, provider] of [[ompUi, "omp"], [piUi, "pi"]] as const) {
      await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(replyTokens[provider], { timeout: 90_000 });
      await expect(ui.getByRole("status")).toHaveText("Ready");
      await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1);
    }
    expect(backgroundReplies.has("pi"), "unrequested reply reached the secondary Pi session").toBe(true);
    await expect(ompUi.getByTestId("native-cli-composer")).toBeFocused();
    await expect(ompUi).toHaveAttribute("data-native-pid", pids[0]!);
    await expect(piUi).toHaveAttribute("data-native-pid", pids[1]!);
    await page.screenshot({ path: testInfo.outputPath("native-ui-two-panes.png"), fullPage: true });
    for (const ui of [ompUi, piUi]) await page.locator(".dv-groupview").filter({ has: ui }).getByTestId("session-mode-toggle").click();

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
    const ownedTmux = new Set([...fs.readFileSync(path.join(fixture, "core.log"), "utf8").matchAll(/tmux_session=(perch-cli-\S+)/g)].map((match) => match[1]));
    for (const name of ownedTmux) {
      try { execFileSync("tmux", ["kill-session", "-t", `=${name}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    for (const id of shellIds) {
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-shell-${id}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    fs.copyFileSync(path.join(fixture, "core.log"), testInfo.outputPath("core.log"));
    fs.closeSync(log);
    await testInfo.attach("fixture-core.log", { body: fs.readFileSync(path.join(fixture, "core.log")), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
