/**
 * Live check of slice 9 (suggested tasks, sender cards, `perch read`): a Claude lead (haiku) that a person
 * has just spoken to runs `perch suggest`; with "Let leads start sub-sessions without asking" off (the
 * default) nothing starts and the chat shows a suggested-task card; the test presses Start; the child
 * (haiku) messages the lead; the lead's chat shows the message as a sender card, never as the envelope's
 * text; then the lead runs `perch read <child>` and what it got is the child's last turn, not a tool's
 * output. What the core recorded is read from its SQLite file, not from what any model said. Isolated core
 * and daemon, see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts suggestions.spec.ts --workers 1
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
  execFileSync("sqlite3", ["-readonly", "-cmd", ".timeout 10000", "-separator", "|", path.join(fixture, "history.sqlite"), query], { encoding: "utf8" }).trim();

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

test("a suggested task is started by the person's click, the child's message is a sender card, and perch read returns its last turn", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-suggest-"));
  const marker = `UP${Date.now().toString(36).toUpperCase()}`;
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
    // The product default: leads may not start sub-sessions without asking, so `perch suggest` is a card.
    pinReporterModels(fixture, false);
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

    // The person speaks. The lead suggests one task (it starts nothing) and goes idle.
    await send(
      "Use the shell and no other tools. Run exactly this one command, quoted as written, and nothing else: " +
      `perch suggest --agent claude --model ${CHEAP_CLAUDE_MODEL} --task 'Run the shell command perch send ${lead} ${marker} and then stop. Use no other tools.' ` +
      "The text inside the quotes is a task for the person to start later: you only suggest it, never carry it out yourself (a haiku that ran it would fail with 'you cannot message yourself'). " +
      "Then reply with the one word suggested and nothing else. Later, if a message headed Perch message or Perch status arrives, reply with the one word noted and run no tools.",
    );
    const card = ui.getByTestId("native-cli-suggestion-card");
    await expect(card).toBeVisible({ timeout: 120_000 });
    await expect(card.getByTestId("native-cli-suggestion-task")).toContainText(marker);
    expect(sql(fixture, `select count(*) from suggestions where lead_session_id = '${lead}' and state = 'pending'`)).toBe("1");
    expect(sql(fixture, `select count(*) from sub_sessions where parent_session_id = '${lead}'`), "a suggestion starts nothing").toBe("0");
    await untilReady(ui, 240_000);

    // Start is the person's click: it goes through the same limits and checks as `perch spawn`.
    await card.getByTestId("native-cli-suggestion-start").click();
    await expect.poll(() => sql(fixture, `select state from suggestions where lead_session_id = '${lead}'`), { timeout: 60_000, intervals: [1_000] }).toBe("started");
    const child = sql(fixture, `select child_session_id from sub_sessions where parent_session_id = '${lead}'`);
    expect(child, "one sub-session").toMatch(/^[0-9a-f-]{36}$/);
    await expect(card.getByTestId("native-cli-suggestion-started")).toBeVisible({ timeout: 30_000 });

    // The child messages the lead; once the lead is idle it arrives and its chat draws a sender card.
    await expect.poll(() => sql(fixture, `select state from agent_mail where kind = 'message' and sender_session_id = '${child}' and target_session_id = '${lead}'`), { timeout: 300_000, intervals: [2_000] }).toBe("delivered");
    const sender = ui.getByTestId("native-cli-sender-card").filter({ hasText: marker }).first();
    await expect(sender).toBeVisible({ timeout: 60_000 });
    await expect(sender).toHaveAttribute("data-from-session", child);
    await expect(sender.getByTestId("native-cli-sender-title")).toContainText("Message from claude");
    await expect(sender.getByTestId("native-cli-sender-open")).toBeVisible();
    // Never the envelope's own text.
    const shown = await ui.innerText();
    expect(shown).not.toContain("──── Perch message");
    expect(shown).not.toContain("not from a person");
    await untilReady(ui, 240_000);

    // `perch read`: the lead asks for the child's last two turns (a haiku lead may have answered the child's
    // message with one of its own, which opens a second child turn) and writes what it got to a file.
    const readFile = path.join(fixture, "read.txt");
    await send(`Run exactly: perch read ${child} --turns 2 > ${readFile}   Then reply with the one word read and nothing else.`);
    await expect.poll(() => fs.existsSync(readFile) && fs.readFileSync(readFile, "utf8"), { timeout: 240_000, intervals: [2_000] }).toContain("Turn 1/");
    const read = fs.readFileSync(readFile, "utf8");
    // Perch's first message to the child wraps the task; the task is what the person started.
    expect(read, "the child's own task opened its turn").toContain(`Task: Run the shell command perch send ${lead} ${marker}`);
    expect(read, "a sentence about the run of tool calls").toContain("Did: perch send");
    expect(read, "no raw envelope").not.toContain("────");
    expect(read).toContain("its own claim");
    expect(read.length).toBeLessThan(8_500);
    // Nothing was left half-handled and no token reached the chat, the process list or the core's log.
    expect(sql(fixture, "select count(*) from agent_mail where state in ('delivering', 'unconfirmed')")).toBe("0");
    await untilReady(ui, 180_000);
    const everywhere = [await ui.innerText(), execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }), fs.readFileSync(path.join(fixture, "core.log"), "utf8")].join("\n");
    expect(everywhere).not.toContain("perch_agent_");
  } catch (error) {
    await testInfo.attach("chat", { body: await ui.innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
    await testInfo.attach("suggestions", { body: sql(fixture, "select id, state, child_session_id, reason, substr(task, 1, 120) from suggestions").slice(0, 3000), contentType: "text/plain" });
    await testInfo.attach("agent_mail", { body: sql(fixture, "select id, kind, sender_session_id, target_session_id, state, reason, substr(body, 1, 160) from agent_mail").slice(0, 4000), contentType: "text/plain" });
    await setChatMode(page, "cli").catch(() => {});
    await page.waitForTimeout(4_000);
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
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
