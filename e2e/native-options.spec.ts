/**
 * Live check of the model, effort and permission-mode pickers (Row 10b) over a real Claude TUI, with
 * **no model turn**: Claude runs against a private config directory and a dummy API key, which is enough
 * for its TUI, its `/model` and `/effort` commands, its mode cycle and the hooks Perch reads, and
 * keeps Claude's "saved as your default" writes out of the user's own `~/.claude/settings.json`.
 * Only a picked value that Claude then shows (footer, hook or its own "Set … to" line) is displayed.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts native-options.spec.ts --workers 1
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
import { choose, optionStates } from "./select";

const root = path.resolve(__dirname, "..");
const DUMMY_KEY = "perch-e2e-not-a-real-key-0000000000000000";

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
}

test("claude: pickers change model, effort and mode and show only what the CLI read back", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-options-"));
  const project = fs.realpathSync(fixture);
  // A private Claude config: onboarding, the dummy key and this folder are pre-approved.
  const config = path.join(fixture, "claude-config");
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, ".claude.json"), JSON.stringify({
    hasCompletedOnboarding: true, theme: "dark",
    customApiKeyResponses: { approved: [DUMMY_KEY.slice(-20)], rejected: [] },
    projects: { [project]: { hasTrustDialogAccepted: true, allowedTools: [] } },
  }));
  fs.writeFileSync(path.join(config, "settings.json"), JSON.stringify({ skipDangerousModePermissionPrompt: true }));
  const realSettings = path.join(os.homedir(), ".claude", "settings.json");
  const realBefore = fs.existsSync(realSettings) ? fs.statSync(realSettings).mtimeMs : null;
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const logFd = fs.openSync(path.join(fixture, "core.log"), "a");
  const port = await freePort();
  const core: ChildProcess = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], {
    cwd: root,
    env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...cheapModelEnv("claude", fixture), CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: DUMMY_KEY },
    stdio: ["ignore", logFd, logFd],
  });
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const pick = (id: string) => ui.getByTestId(`native-cli-pick-${id}`);
  try {
    await expect.poll(async () => { if (core.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.context().addInitScript((directory) => {
      if (location.protocol !== "http:" || window !== window.top) return;
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sidebar.organize", "project");
      localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
    }, fixture);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    await startFromPanel(page, { agent: "claude", where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 30_000 });
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(ui.getByTestId("native-cli-composer")).toBeEnabled();

    // Haiku 4.5 has no effort control; Perch started Claude with approvals bypassed, so that is the mode read back.
    await expect(pick("model")).toHaveAttribute("data-value", "claude-haiku-4-5", { timeout: 20_000 });
    await expect(pick("mode")).toHaveAttribute("data-value", "full-access");
    await expect(pick("effort")).toHaveCount(0);
    expect((await optionStates(pick("model"))).map((option) => option.value)).toEqual(["fable", "opus", "sonnet", "haiku", "claude-haiku-4-5"]);

    // Mode: Claude's own Shift+Tab cycle, read from its footer after every step.
    for (const [mode, label] of [["plan", "Plan mode"], ["ask", "Ask for approval"], ["accept-edits", "Accept edits"], ["full-access", "Full access"]] as const) {
      await choose(pick("mode"), mode);
      // Full access asks first; the dialog is the person's own confirmation.
      if (mode === "full-access") await page.getByRole("button", { name: "Allow full access" }).click();
      await expect(pick("mode")).toHaveAttribute("data-value", mode, { timeout: 15_000 });
      await expect(pick("mode")).toContainText(label);
    }
    // The CLI itself shows the same mode.
    await setChatMode(page, "cli");
    await expect(cli.locator(".xterm-rows")).toContainText(/bypass permissions on/, { timeout: 10_000 });
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });

    // Model: `/model opus` typed at the idle prompt; the picker then shows the model Claude reports.
    await choose(pick("model"), "opus");
    await expect(pick("model")).toHaveAttribute("data-value", /^claude-opus/, { timeout: 20_000 });
    // Claude 2.1.319 draws no effort in its footer after a model switch until one is set, so there is
    // nothing to read back and no effort picker. The person sets it in CLI view; the footer then says so
    // and the picker appears with exactly that value.
    await expect(pick("effort")).toHaveCount(0);
    await setChatMode(page, "cli");
    await cli.locator(".xterm-helper-textarea").pressSequentially("/effort high", { delay: 20 });
    await cli.locator(".xterm-helper-textarea").press("Enter");
    await expect(cli.locator(".xterm-rows")).toContainText(/\u25cf high \u00b7 \/effort/, { timeout: 15_000 });
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(pick("effort")).toHaveAttribute("data-value", "high", { timeout: 15_000 });
    await choose(pick("effort"), "low");
    await expect(pick("effort")).toHaveAttribute("data-value", "low", { timeout: 15_000 });
    await choose(pick("model"), "sonnet");
    await expect(pick("model")).toHaveAttribute("data-value", /^claude-sonnet/, { timeout: 20_000 });

    // Claude saved those picks as *its* defaults, in the private config: the user's own file was not touched.
    const saved = JSON.parse(fs.readFileSync(path.join(config, "settings.json"), "utf8"));
    expect(saved.model).toBeTruthy();
    expect(realBefore === null ? !fs.existsSync(realSettings) : fs.statSync(realSettings).mtimeMs).toBe(realBefore === null ? true : realBefore);

    // A draft on the CLI's own line refuses the change and sends nothing.
    await setChatMode(page, "cli");
    await cli.locator(".xterm-helper-textarea").pressSequentially("half typed", { delay: 20 });
    await expect(cli.locator(".xterm-rows")).toContainText("half typed");
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await choose(pick("mode"), "plan");
    await expect(ui.getByRole("alert")).toContainText(/draft|dialog/i, { timeout: 15_000 });
    await expect(pick("mode")).toHaveAttribute("data-value", "full-access");
    await setChatMode(page, "cli");
    await expect(cli.locator(".xterm-rows")).toContainText(/bypass permissions on/);
  } catch (error) {
    // Read before switching views: the chat's notices go with the chat.
    await testInfo.attach("alerts", { body: (await ui.locator("[role=alert], .terminal__cli-error, [role=status]").allInnerTexts().catch(() => ["unavailable"])).join("\n"), contentType: "text/plain" });
    await setChatMode(page, "cli").catch(() => {});
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
    throw error;
  } finally {
    if (core.exitCode === null && core.signalCode === null) await new Promise<void>((resolve) => { core.once("exit", () => resolve()); core.kill("SIGKILL"); });
    await cleanupFixtureRuntime(root, fixture).catch((error) => {
      // The daemon and its agent belong to this fixture alone: stop them rather than leave a CLI running.
      const dir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((entry) => entry.includes(dir))) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
      console.warn(`fixture cleanup: ${error}`);
    });
    fs.closeSync(logFd);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
