/**
 * Live check of Project memory (`perch memory`): a Claude lead (haiku) writes a memory file with the CLI, and the core
 * records it under the Project with the lead as its author; a second turn reads it back, so the file outlives the turn
 * that wrote it. Two short haiku turns; isolated core and daemon, see docs/TESTING.md. What is stored is read from
 * the fixture's disk and SQLite file, not from what the model said. Run it outside a Perch shell.
 *
 *   cd e2e && env -u PERCH_SESSION -u PERCH_SHELL -u PERCH_TOKEN -u PERCH_USER_ZDOTDIR \
 *     npx playwright test -c native-composer.config.ts memory-live.spec.ts --workers 1
 */
import { test, expect, type Page } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { setChatMode } from "./chatMode";
import { addProject, startFromPanel } from "./projects";
import { cheapModelEnv, pinReporterModels, CHEAP_CLAUDE_MODEL } from "./cheapModel";

const root = path.resolve(__dirname, "..");

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
}

const sql = (fixture: string, query: string) =>
  execFileSync("sqlite3", ["-readonly", "-separator", "|", path.join(fixture, "history.sqlite"), query], { encoding: "utf8" }).trim();

/** Wait for the chat to be ready again, approving a command the lead asks leave to run. */
async function untilReady(ui: ReturnType<Page["getByTestId"]>, timeout: number) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await ui.getByRole("status").innerText().catch(() => "")) === "Ready") return;
    const card = ui.getByTestId("native-cli-request");
    if (await card.isVisible().catch(() => false)) await card.getByTestId("native-cli-request-option-1").click().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("the lead did not become ready");
}

test("a lead writes a Project memory file with perch memory and reads it back in a later turn", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-memory-live-"));
  const marker = `MEM${Date.now().toString(36).toUpperCase()}`;
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  const send = async (text: string) => {
    await box.fill(text);
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
  };
  try {
    fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
    fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
    pinReporterModels(fixture);
    log = fs.openSync(path.join(fixture, "core.log"), "a");
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], {
      cwd: root,
      env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...cheapModelEnv("claude", fixture) },
      stdio: ["ignore", log, log],
    });
    const url = `http://127.0.0.1:${port}`;
    await expect.poll(async () => { if (core!.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.context().addInitScript((directory) => {
      if (location.protocol !== "http:" || window !== window.top) return;
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sidebar.organize", "project");
      localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
    }, fixture);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    await startFromPanel(page, { agent: "claude", where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 30_000 });
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(box).toBeEnabled();
    // Fail before any paid turn if the cheap-model pin did not take.
    await expect(ui.locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);
    const lead = sql(fixture, "select id from sessions where parent_session_id is null and cli_provider_id = 'claude'");
    expect(lead, "one lead session").toMatch(/^[0-9a-f-]{36}$/);
    const project = sql(fixture, `select project_id from sessions where id = '${lead}'`);
    expect(project).not.toBe("");

    // Turn 1: write.
    await send(`Do this with the shell and no other tools. Run exactly: perch memory write live-check.md --text "${marker} was written by the lead". Then reply with the command's output and nothing else.`);
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    await untilReady(ui, 150_000);
    await testInfo.attach("write-reply", { body: await ui.locator('[data-native-role="assistant"]').last().innerText(), contentType: "text/plain" });

    // What the core stored: the file under this Project's folder, authored by the lead's session.
    const folder = path.join(fixture, "memory", project);
    expect(fs.readFileSync(path.join(folder, "live-check.md"), "utf8")).toContain(marker);
    const provenance = JSON.parse(fs.readFileSync(path.join(folder, ".provenance.json"), "utf8")) as Record<string, { author?: { kind?: string; session?: string } }>;
    const entry = JSON.stringify(provenance["live-check.md"] ?? provenance);
    expect(entry).toContain('"agent"');
    expect(entry).toContain(lead);

    // Turn 2: read it back; the file is what the reply quotes, not the lead's memory of turn 1.
    await send("Run exactly: perch memory read live-check.md   Then reply with its output and nothing else.");
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2, { timeout: 60_000 });
    await untilReady(ui, 150_000);
    const reply = await ui.locator('[data-native-role="assistant"]').last().innerText();
    await testInfo.attach("read-reply", { body: reply, contentType: "text/plain" });
    expect(reply).toContain(marker);
    // The token never reaches the chat or the core's log.
    const everywhere = [await ui.innerText(), fs.readFileSync(path.join(fixture, "core.log"), "utf8")].join("\n");
    expect(everywhere).not.toContain("perch_agent_");
  } catch (error) {
    await setChatMode(page, "cli").catch(() => {});
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    throw error;
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    await cleanupFixtureRuntime(root, fixture).catch(() => {
      const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((entry) => entry.includes(daemonDir))) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
    });
    if (log !== undefined) fs.closeSync(log);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
