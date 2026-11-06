/**
 * Live check: an agent typed into a Terminal tab gets the native chat view (UI mode) with working
 * send, and the tab returns to its terminal when the agent exits. Real cheap-model turns against an
 * isolated core; see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts native-terminal [-g pi]
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
import { cheapModelEnv, CHEAP_CODEX_MODEL, CHEAP_CLAUDE_MODEL } from "./cheapModel";

const COMMANDS: Record<string, string> = { pi: "pi", claude: "claude --dangerously-skip-permissions", codex: "codex" };

for (const provider of ["pi", "claude"]) test(`${provider}: typed in a Terminal tab opens as chat`, async ({ page, context }) => {
  test.setTimeout(300_000);
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-terminal-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
  const token = `terminal_${provider}_${Date.now()}`;
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const url = `http://127.0.0.1:${port}`;
  let core: ChildProcess | undefined;
  await context.addInitScript((directory) => {
    if (location.protocol !== "http:" || window !== window.top) return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  }, fixture);
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    const keep = (direction: string, payload: string | Buffer) => {
      const text = String(payload);
      if (/agent\.ui\.(prompt|result)|"type":"error"|agent\.control/.test(text)) frames.push(`${new Date().toISOString().slice(11, 23)} ${direction} ${text.slice(0, 300)}`);
    };
    socket.on("framesent", ({ payload }) => keep("->", payload));
    socket.on("framereceived", ({ payload }) => keep("<-", payload));
  });
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], { cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", RUST_LOG: "info", ...cheapModelEnv(provider, fixture) }, stdio: ["ignore", log, log] });
    core.once("exit", (code, signal) => fs.appendFileSync("/tmp/nt-exit.txt", `${provider} core exit code=${code} signal=${signal} ${new Date().toISOString()}\n`));
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    // A plain Terminal tab: no agent chosen. UI mode must not change what a shell looks like.
    await setChatMode(page, "ui");
    await startFromPanel(page, { agent: "terminal", where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(ui).toHaveCount(0);
    // Now the user types the agent's command. Perch notices and switches this tab to chat.
    await cli.locator(".xterm-helper-textarea").pressSequentially(COMMANDS[provider]!, { delay: 10 });
    await cli.locator(".xterm-helper-textarea").press("Enter");
    await expect(ui).toHaveAttribute("data-provider", provider, { timeout: 60_000 });
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 30_000 });
    await expect(ui.locator(".native-cli-chat__model")).toHaveText(provider === "claude" ? CHEAP_CLAUDE_MODEL : CHEAP_CODEX_MODEL);
    const box = ui.getByTestId("native-cli-composer");
    await expect(box).toBeEnabled();
    await box.fill(`Reply with exactly ${token} and nothing else.`);
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    // On failure, record what the page was told and what the real terminal shows (the PTY is the ground truth).
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 30_000 }).catch(async (error) => {
      const chat = await ui.innerText().catch(() => "(no chat view)");
      await setChatMode(page, "cli").catch(() => {});
      const screen = await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "(terminal not mounted)");
      fs.writeFileSync(`/tmp/nt-fail-${provider}.txt`, `FRAMES\n${frames.join("\n")}\n\nCHAT\n${chat}\n\nTERMINAL\n${screen}\n`);
      throw error;
    });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
    expect(await ui.locator('[data-native-role="assistant"]').last().innerText()).toContain(token);
    // Same shell, same agent: CLI view shows the real TUI the chat was driving.
    await setChatMode(page, "cli");
    await expect(cli).toBeVisible();
    await expect(cli.locator(".xterm-rows")).toContainText(token, { timeout: 15_000 });
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
    fs.copyFileSync(path.join(fixture, "core.log"), `/tmp/nt-core-${provider}.log`);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
