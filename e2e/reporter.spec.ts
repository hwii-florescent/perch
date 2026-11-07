/**
 * Live check of the cheap-model reporter (slice 8): a Claude lead (haiku) that a person has just spoken to
 * starts a Claude child (haiku) with a one-command task (no shell metacharacters: the lead's shell would act on them). The child finishes without running `perch report`;
 * Perch then asks haiku, through the claude command in one-shot mode, for a summary of that turn, keeps it as
 * the child's running notes and puts it in the lead's status note ("Summary by claude-haiku-4-5") and on the
 * family strip. What the core recorded is read from its SQLite file, not from what any model said. Isolated
 * core and daemon, see docs/TESTING.md. Three short haiku turns (lead, child, summary).
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts reporter.spec.ts --workers 1
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
import { cheapModelEnv, CHEAP_CLAUDE_MODEL } from "./cheapModel";

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
    if ((await ui.getByRole("status").first().innerText().catch(() => "")) === "Ready") return;
    const card = ui.getByTestId("native-cli-request");
    if (await card.isVisible().catch(() => false)) await card.getByTestId("native-cli-request-option-1").click().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("the lead did not become ready");
}

test("a child that finishes without reporting is summarised by haiku for its lead", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-reporter-"));
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  try {
    fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
    fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
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
    await expect(ui.locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);
    const lead = sql(fixture, "select id from sessions where parent_session_id is null and cli_provider_id = 'claude'");
    expect(lead, "one lead session").toMatch(/^[0-9a-f-]{36}$/);

    // The person speaks; the lead starts a child whose task is one command and a one-sentence answer.
    await box.fill(
      "Use the shell and no other tools. Run exactly one shell command, to start a helper session: the command is the `perch spawn` line below, whole. " +
      `The helper does the work in the text after --task, you do not: never run any part of that text yourself. perch spawn --agent claude --model ${CHEAP_CLAUDE_MODEL} --task Use only the shell tool. Run the shell command: echo gardenia. Then reply with one short sentence saying what that command printed.` +
      " That is the end of the command line. After that command, reply with the one word spawned and nothing else.",
    );
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => sql(fixture, `select count(*) from sub_sessions where parent_session_id = '${lead}'`), { timeout: 90_000, intervals: [2_000] }).toBe("1");
    const child = sql(fixture, `select child_session_id from sub_sessions where parent_session_id = '${lead}'`);
    expect(child, "one sub-session").toMatch(/^[0-9a-f-]{36}$/);
    await untilReady(ui, 240_000);

    // The child finishes its turn; Perch asks haiku for the summary and keeps it as the child's notes.
    await expect.poll(() => sql(fixture, `select source || '|' || coalesce(model, '') || '|' || status from session_summaries where session_id = '${child}'`), { timeout: 150_000, intervals: [2_000] })
      .toMatch(/^summary\|claude-haiku-4-5\|(done|blocked|needs_you|failed)$/);
    const text = sql(fixture, `select text from session_summaries where session_id = '${child}'`);
    expect(text.length, "a summary of at most 400 characters").toBeGreaterThan(5);
    expect(text.length).toBeLessThanOrEqual(400);
    expect(text.toLowerCase(), "it says what the child did").toContain("gardenia");
    // The child did not report; the summary stands in.
    expect(sql(fixture, `select count(*) from agent_identities where session_id = '${child}' and report is not null`)).toBe("0");
    // One call, priced by the CLI's own accounting.
    expect(sql(fixture, `select provider || '|' || model || '|' || (input > 0) from reporter_runs where session_id = '${child}'`)).toBe(`claude|${CHEAP_CLAUDE_MODEL}|1`);

    // The lead's note carries it, in Perch's words with the model named, and the strip shows it.
    await expect.poll(() => sql(fixture, `select count(*) from agent_mail where kind = 'note' and target_session_id = '${lead}' and body like '%Summary by ${CHEAP_CLAUDE_MODEL}%finished its turn%' or (kind = 'note' and target_session_id = '${lead}' and body like '%finished its turn%Summary by ${CHEAP_CLAUDE_MODEL}%')`), { timeout: 60_000, intervals: [2_000] }).not.toBe("0");
    const note = sql(fixture, `select body from agent_mail where kind = 'note' and target_session_id = '${lead}' and body like '%Summary by%' order by created_at desc limit 1`);
    expect(note).toContain(text.slice(0, 30));
    const row = page.locator(`[data-testid="native-cli-family-row"][data-session="${child}"]`);
    await expect(row.getByTestId("native-cli-family-report")).toContainText(`Summary by ${CHEAP_CLAUDE_MODEL}`, { timeout: 30_000 });
  } catch (error) {
    await testInfo.attach("family", { body: await page.getByTestId("native-cli-family").innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("chat", { body: await ui.innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
    await testInfo.attach("summaries", { body: sql(fixture, "select session_id, source, model, status, substr(text, 1, 200) from session_summaries").slice(0, 3000), contentType: "text/plain" });
    await testInfo.attach("agent_mail", { body: sql(fixture, "select id, kind, sender_session_id, target_session_id, state, reason, substr(body, 1, 240) from agent_mail").slice(0, 6000), contentType: "text/plain" });
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
