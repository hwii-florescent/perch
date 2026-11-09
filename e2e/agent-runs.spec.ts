/**
 * Live check of conversation-scoped runs and launch parity (haiku only; isolated core and daemon, see
 * docs/TESTING.md). A picker-launched Claude lead starts a haiku child; `/clear` in the lead begins a
 * fresh run, and the new lead cannot list or stop that child; the person exits Claude and types
 * `claude --resume <first conversation>` into the same shell, which is issued its own identity through the
 * shell's launcher and gets the first run (and the child) back. What the core records is read from its
 * SQLite file; three lead turns and one short child turn, all haiku.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts agent-runs.spec.ts --workers 1
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

/** Poll the database until `query` returns a value `ok` accepts. */
async function until(fixture: string, query: string, ok: (value: string) => boolean, what: string, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let last = "";
  while (Date.now() < deadline) {
    last = sql(fixture, query);
    if (ok(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${what}: still "${last}"`);
}

test("a fresh conversation owns a fresh run, and resuming the first one restores it", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-runs-"));
  const marker = `DONE${Date.now().toString(36).toUpperCase()}`;
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  const send = async (text: string) => {
    const before = await ui.locator('[data-native-role="user"]').count();
    await box.fill(text);
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(before + 1, { timeout: 60_000 });
    await untilReady(ui, 300_000);
    return ui.locator('[data-native-role="assistant"]').last().innerText();
  };
  const type = async (text: string) => {
    await cli.locator(".xterm-helper-textarea").pressSequentially(text, { delay: 15 });
    await page.keyboard.press("Enter");
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
    await expect(ui.locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);
    const lead = sql(fixture, "select id from sessions where parent_session_id is null and cli_provider_id = 'claude'");
    expect(lead).toMatch(/^[0-9a-f-]{36}$/);

    // The launch began a run of its own, and the first conversation joined it.
    const run1 = await until(fixture, `select coalesce(run_id, '') from sessions where id = '${lead}'`, (v) => v !== "" && v !== lead, "a launch begins a run");
    const conversation1 = await until(fixture, `select conversation_id from agent_conversations where session_id = '${lead}'`, (v) => v !== "", "the first conversation is seen");
    expect(sql(fixture, `select run_id from agent_conversations where conversation_id = '${conversation1}'`)).toBe(run1);

    // Turn 1: the lead starts a haiku child, which reports.
    const first = await send(
      `Do these steps with the shell and no other tools. 1) Run exactly: perch spawn --agent claude --model ${CHEAP_CLAUDE_MODEL} --task Run the shell command perch report ${marker} and then stop. Use no other tools. ` +
      "2) Run `perch list` and then `sleep 15`, again and again, at most 8 times, until the child's report appears in the output of `perch list`. 3) Reply with the one line of that output that starts with the word report, and nothing else.",
    );
    await testInfo.attach("turn-1", { body: first, contentType: "text/plain" });
    const child = sql(fixture, "select child_session_id from sub_sessions");
    expect(child).toMatch(/^[0-9a-f-]{36}$/);
    expect(sql(fixture, `select parent_run_id from sub_sessions where child_session_id = '${child}'`)).toBe(run1);

    // `/clear` in the lead: the provider's new conversation id begins a fresh run; nothing else moves.
    await setChatMode(page, "cli");
    await type("/clear");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await page.keyboard.press("Enter");
    const run2 = await until(fixture, `select coalesce(run_id, '') from sessions where id = '${lead}'`, (v) => v !== run1, "/clear begins a run");
    expect(sql(fixture, `select count(*) from agent_conversations where session_id = '${lead}'`)).toBe("2");
    expect(sql(fixture, `select parent_run_id from sub_sessions where child_session_id = '${child}'`)).toBe(run1);
    expect(sql(fixture, `select count(*) from agent_runs where session_id = '${lead}'`)).toBe("2");

    // Turn 2, as the new lead: the earlier child is not listed and cannot be stopped.
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    const second = await send(`Run \`perch list --json\`, then run exactly: perch stop ${child}   Then reply with the output of both, verbatim.`);
    await testInfo.attach("turn-2", { body: second, contentType: "text/plain" });
    expect(second).toContain("not one of your sub-sessions");
    expect(sql(fixture, `select state from sub_sessions where child_session_id = '${child}'`)).not.toBe("stopped");
    expect(sql(fixture, `select count(*) from agent_mail where target_session_id = '${lead}' and run_id = '${run2}'`)).toBe("0");

    // Exit Claude, back to the shell, and type the resume yourself. The picker agent's identity is replaced
    // (not merely forgotten) by the one the next agent is issued.
    await setChatMode(page, "cli");
    await type("/exit");
    // Typed only once the shell that follows Claude is showing its prompt.
    await expect.poll(async () => (await cli.locator(".xterm-rows").innerText()).trimEnd().endsWith("%"), { timeout: 40_000 }).toBe(true);
    await type(`claude --model ${CHEAP_CLAUDE_MODEL} --resume ${conversation1}`);
    await until(fixture, `select count(*) from agent_identities where session_id = '${lead}' and revoked_at is null and launch_pid is not null`, (v) => v === "1", "the typed agent is issued its own identity", 90_000);
    expect(sql(fixture, `select count(*) from agent_identities where session_id = '${lead}' and revoked_at is null`)).toBe("1");
    expect(sql(fixture, `select provider_id || '/' || owner_provider_id from agent_identities where session_id = '${lead}' and launch_pid is not null`)).toBe("claude/claude");
    // The known conversation restored its run, and nothing new was counted.
    await until(fixture, `select coalesce(run_id, '') from sessions where id = '${lead}'`, (v) => v === run1, "resume restores the first run", 60_000);
    expect(sql(fixture, `select count(*) from agent_conversations where session_id = '${lead}'`)).toBe("2");

    // Turn 3, from the typed agent: its token works, and the first run's child is its own again.
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 40_000 });
    const third = await send("Run `perch whoami --json` and then `perch list --json`. Reply with both outputs, verbatim.");
    await testInfo.attach("turn-3", { body: third, contentType: "text/plain" });
    const incarnation = sql(fixture, `select incarnation from agent_identities where session_id = '${lead}' and revoked_at is null`);
    expect(third).toContain(incarnation);
    expect(third).toContain(child);

    // Neither the agent token nor the launcher reaches the chat, the process list or the core's log.
    const everywhere = [await ui.innerText(), execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }), fs.readFileSync(path.join(fixture, "core.log"), "utf8")].join("\n");
    expect(everywhere).not.toContain("perch_agent_");
  } catch (error) {
    await setChatMode(page, "cli").catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
    fs.copyFileSync(path.join(fixture, "core.log"), path.join(os.tmpdir(), "perch-runs-core.log"));
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-3000), contentType: "text/plain" }).catch(() => {});
    fs.writeFileSync(path.join(os.tmpdir(), "perch-runs-terminal.txt"), await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"));
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    for (const table of ["sessions", "sub_sessions", "agent_runs", "agent_conversations", "agent_identities", "agent_launchers"]) {
      await testInfo.attach(table, { body: sql(fixture, `select * from ${table}`).slice(0, 4000), contentType: "text/plain" }).catch(() => {});
    }
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
