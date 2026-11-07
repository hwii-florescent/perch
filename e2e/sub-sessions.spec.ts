/**
 * Live check of sub-sessions (`perch spawn`, `list`, `stop`): a Claude lead (haiku) that a person
 * has just spoken to starts a Codex child (luna) in the same Nest, the child reports, the lead reads
 * that report back with `perch list`, then stops the child and the core confirms it. One lead turn
 * to start and read, one to stop, one child turn; isolated core and daemon, see docs/TESTING.md.
 * What the core records is read from its SQLite file, not from what any model said.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts sub-sessions.spec.ts --workers 1
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
import { cheapModelEnv, CHEAP_CODEX_MODEL, CHEAP_CLAUDE_MODEL } from "./cheapModel";

const root = path.resolve(__dirname, "..");

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
}

/** The child's agent: `codex` (luna, the default) or `claude` (haiku), for when one provider's quota is spent. */
const CHILD_AGENT = process.env.PERCH_E2E_CHILD === "claude" ? "claude" : "codex";
const CHILD_MODEL = CHILD_AGENT === "claude" ? CHEAP_CLAUDE_MODEL : CHEAP_CODEX_MODEL;

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

test("a lead starts a child, reads its report, and stops it with the stop confirmed", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-subsessions-"));
  const stamp = Date.now().toString(36).toUpperCase();
  const marker = `DONE${stamp}`;
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
    log = fs.openSync(path.join(fixture, "core.log"), "a");
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], {
      cwd: root,
      env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...cheapModelEnv("claude", fixture), ...cheapModelEnv("codex", fixture) },
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

    // The person speaks; the lead may now start a child. The child's task is one command and a stop.
    await send(
      "Do these steps with the shell and no other tools. 1) Run exactly: " +
      `perch spawn --agent ${CHILD_AGENT} --model ${CHILD_MODEL} --task Run the shell command perch report ${marker} and then stop. Use no other tools. ` +
      "2) Run `perch list` and then `sleep 15`, again and again, at most 8 times, until the child's report appears in the output of `perch list`. " +
      "3) Reply with the one line of that output that starts with the word report, and nothing else. Never run `perch report` yourself.",
    );
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    await untilReady(ui, 300_000);
    const reply = await ui.locator('[data-native-role="assistant"]').last().innerText();
    await testInfo.attach("lead-reply", { body: reply, contentType: "text/plain" });

    // What the core recorded: one child, under this lead, in this Nest, started by the person's turn.
    const rows = sql(fixture, "select child_session_id, parent_session_id, workspace_id, provider_id, model, state from sub_sessions").split("\n").filter(Boolean);
    expect(rows, "exactly one sub-session").toHaveLength(1);
    const [child, parent, childNest, provider, model, state] = rows[0].split("|");
    expect(parent).toBe(lead);
    expect(provider).toBe(CHILD_AGENT);
    expect(model).toBe(CHILD_MODEL);
    expect(["running", "exited"]).toContain(state);
    expect(sql(fixture, `select workspace_id from sessions where id = '${lead}'`)).toBe(childNest);
    expect(sql(fixture, `select parent_session_id from sessions where id = '${child}'`)).toBe(lead);
    // The child's own report is on its run, and the lead read it back through `perch list`.
    expect(sql(fixture, `select report from agent_identities where session_id = '${child}' and report is not null`)).toContain(marker);
    expect(reply).toContain(marker);
    expect(reply.toLowerCase()).toContain("report");
    // The child was launched with its task as the last argument and the chosen model, and holds its own token.
    const processes = execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }).split("\n");
    expect(processes.some((line) => line.includes(`--model ${CHILD_MODEL}`) && line.includes("Perch started you as a sub-session"))).toBe(true);
    expect(Number(sql(fixture, `select count(*) from agent_identities where session_id in ('${lead}', '${child}') and revoked_at is null`))).toBe(2);

    // The lead stops the child, and the stop is reported only once the core confirms it.
    await send(`Run exactly: perch stop ${child}   Then reply with its output and nothing else.`);
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2, { timeout: 60_000 });
    await untilReady(ui, 150_000);
    const stopped = await ui.locator('[data-native-role="assistant"]').last().innerText();
    await testInfo.attach("stop-reply", { body: stopped, contentType: "text/plain" });
    expect(stopped).toContain(child);
    const after = sql(fixture, `select state from sub_sessions where child_session_id = '${child}'`);
    // "exited" is a child that ended before the stop reached it; both are confirmed absence.
    expect(["stopped", "exited"]).toContain(after);
    expect(sql(fixture, `select count(*) from agent_identities where session_id = '${child}' and revoked_at is null`)).toBe("0");
    // The token never reaches the chat, the process list or the core's log.
    const everywhere = [await ui.innerText(), execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }), fs.readFileSync(path.join(fixture, "core.log"), "utf8")].join("\n");
    expect(everywhere).not.toContain("perch_agent_");
  } catch (error) {
    await setChatMode(page, "cli").catch(() => {});
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("sub_sessions", { body: sql(fixture, "select * from sub_sessions").slice(0, 4000), contentType: "text/plain" });
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
