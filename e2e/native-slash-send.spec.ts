/**
 * Live check: a built-in slash command sent from the native chat composer runs in the CLI's terminal and
 * is never sent to the model as a message. Before this, Codex `/status` and Pi `/session` each started a
 * model turn that ran shell tools. Zero-token commands only. On failure /tmp/sp-<provider>.txt holds the
 * snapshots the page received, the chat as rendered and the real terminal screen.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts native-slash-send [-g claude]
 */
import { test, expect } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { setChatMode } from "./chatMode";
import { addProject, startFromPanel } from "./projects";
import { cheapModelEnv } from "./cheapModel";

/** Each command, what its output looks like in the terminal, and the key that closes it (Codex's pager takes `q`). */
const COMMANDS: Record<string, { command: string; shows: RegExp; close?: string }[]> = {
  claude: [{ command: "/context", shows: /Context Usage|tokens/ }, { command: "/help", shows: /For more help/ }],
  codex: [{ command: "/status", shows: /5h limit|Session:/ }, { command: "/diff", shows: /not inside a git repository/, close: "q" }],
  pi: [{ command: "/session", shows: /Session Info/ }, { command: "/hotkeys", shows: /Toggle thinking block visibility/ }],
  omp: [{ command: "/hotkeys", shows: /Keyboard Shortcuts/ }, { command: "/tools", shows: /./ }],
};

for (const provider of Object.keys(COMMANDS)) test(`${provider}: built-in slash commands run in the terminal, not as messages`, async ({ page, context }) => {
  test.setTimeout(240_000);
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-probe-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const url = `http://127.0.0.1:${port}`;
  let core: ChildProcess | undefined;
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    const keep = (direction: string, payload: string | Buffer) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.ui.snapshot") frames.push(`${new Date().toISOString().slice(11, 23)} <- snapshot running=${message.snapshot.running} blocked=${message.snapshot.blocked} messages=${JSON.stringify(message.snapshot.messages.map((m: { role: string; text: string }) => `${m.role}:${m.text.slice(0, 80)}`))}`);
      else if (/^agent\.ui\.(prompt|result)$/.test(message.type) || message.type === "error") frames.push(`${new Date().toISOString().slice(11, 23)} ${direction} ${JSON.stringify(message).slice(0, 300)}`);
    };
    socket.on("framesent", ({ payload }) => keep("->", payload));
    socket.on("framereceived", ({ payload }) => keep("<-", payload));
  });
  await context.addInitScript((directory) => {
    if (location.protocol !== "http:" || window !== window.top) return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  }, fixture);
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  try {
    let launchPath = process.env.PATH;
    if (provider === "codex") {
      // Same read-only/ask sandbox as the composer spec, so nothing can write.
      const bin = path.join(fixture, "bin");
      fs.mkdirSync(bin);
      const real = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\nfor arg; do shift; if [ "$arg" = --dangerously-bypass-approvals-and-sandbox ]; then set -- "$@" -a on-request -s read-only -c approvals_reviewer=user; else set -- "$@" "$arg"; fi; done\nexec '${real}' "$@"\n`, { mode: 0o700 });
      launchPath = `${bin}:${process.env.PATH}`;
    }
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], { cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", RUST_LOG: "info,perch_core::native_ui::typed=debug", ...cheapModelEnv(provider, fixture), PATH: launchPath }, stdio: ["ignore", log, log] });
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    await startFromPanel(page, { agent: provider, where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(provider === "codex" ? /OpenAI Codex/ : provider === "claude" ? /Claude Code/ : provider === "omp" ? /OMP|oh.my.pi|omp v|▄▀▀▄|████/i : /pi v|pi \(|pi coding|pi update|pi\.dev|\.pi\/agent/i, { timeout: 30_000 });
    if (provider === "codex") {
      await expect(cli.locator(".xterm-rows")).toContainText(/Do you trust the contents|To get started/i, { timeout: 30_000 });
      if ((await cli.locator(".xterm-rows").innerText()).includes("Do you trust the contents")) await cli.locator(".xterm-helper-textarea").press("Enter");
    }
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(box).toBeEnabled();
    for (const { command, shows, close } of COMMANDS[provider]!) {
      frames.length = 0;
      await box.fill(command);
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      // The reply says "command": it ran in the terminal. No bubble, no turn, nothing for the model.
      await expect(ui.getByTestId("native-cli-command-ran")).toContainText(command, { timeout: 15_000 });
      await expect(box).toHaveValue("");
      await expect(ui.locator("[data-native-role], [data-native-outbox]")).toHaveCount(0);
      await expect(ui.getByRole("status").first()).toHaveText("Ready");
      await setChatMode(page, "cli");
      await expect(cli).toBeVisible();
      // The real terminal is the proof the command ran, and the CLI was never made to answer it.
      await expect(cli.locator(".xterm-rows")).toContainText(shows, { timeout: 10_000 });
      await setChatMode(page, "ui");
      await expect(ui.locator("[data-native-role]")).toHaveCount(0);
      // An open overlay or pager would swallow the next command: close it where it is visible.
      await setChatMode(page, "cli");
      await cli.locator(".xterm-helper-textarea").press(close ?? "Escape");
      await page.waitForTimeout(500);
      await setChatMode(page, "ui");
      await expect(box).toBeEnabled({ timeout: 20_000 });
    }
  } catch (error) {
    const screen = await cli.locator(".xterm-rows").innerText({ timeout: 3_000 }).catch(() => "(terminal not mounted)");
    fs.writeFileSync(`/tmp/sp-${provider}.txt`, `FRAMES\n${frames.join("\n")}\n\nCHAT\n${await ui.innerText().catch(() => "(no chat view)")}\n\nTERMINAL\n${screen}\n`);
    throw error;
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    await cleanupFixtureRuntime(root, fixture).catch(() => {
      const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((line) => line.includes(daemonDir))) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
    });
    fs.closeSync(log);
    fs.copyFileSync(path.join(fixture, "core.log"), `/tmp/ss-core-${provider}.log`);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
