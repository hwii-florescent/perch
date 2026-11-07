/**
 * Live check of messages between sessions of a run (`perch send`, `inbox`, status notes): a Claude
 * lead (haiku) that a person has just spoken to starts a child (Codex luna by default) whose task
 * is to report and message the lead; the message and the child's status note reach the lead only
 * once it is idle (the Claude path: input lease and a verified empty prompt, confirmed by its own
 * hook); then the lead messages the idle child (the Codex path: a bridge turn, never into a busy
 * turn) and the child acts on it. What the core recorded is read from its SQLite file, not from what
 * any model said. Isolated core and daemon, see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts agent-mail.spec.ts --workers 1
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

test("a child's message and status reach an idle lead, and the lead's message reaches the idle child", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-agentmail-"));
  const stamp = Date.now().toString(36).toUpperCase();
  const upMarker = `UP${stamp}`;
  const downMarker = `DOWN${stamp}`;
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

    // The person speaks. The lead starts a child whose whole task is two commands, then goes idle.
    await send(
      "Use the shell and no other tools. Run exactly: " +
      `perch spawn --agent ${CHILD_AGENT} --model ${CHILD_MODEL} --task Run the shell command perch send ${lead} ${upMarker} and then stop. Use no other tools. ` +
      "Then reply with the one word spawned and nothing else. Later, if a message headed Perch message or Perch status arrives, reply with the one word noted and run no tools.",
    );
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    // The status reads Ready for a moment after the prompt is sent: wait for what the turn does, then for the end of it.
    await expect.poll(() => sql(fixture, `select count(*) from sub_sessions where parent_session_id = '${lead}'`), { timeout: 90_000, intervals: [2_000] }).toBe("1");
    await untilReady(ui, 240_000);
    const child = sql(fixture, `select child_session_id from sub_sessions where parent_session_id = '${lead}'`);
    expect(child, "one sub-session").toMatch(/^[0-9a-f-]{36}$/);

    // The window stays open on the lead, so its view holds the input lease: delivery rides that lease, leaves it
    // as it is, and waits for a quiet PTY (ARCHITECTURE, "Lease contention").
    // The child's message reaches the lead once the lead is idle, and the lead's own hook confirmed it.
    await expect.poll(() => sql(fixture, `select state from agent_mail where kind = 'message' and sender_session_id = '${child}' and target_session_id = '${lead}'`), { timeout: 240_000, intervals: [2_000] }).toBe("delivered");
    expect(sql(fixture, `select body from agent_mail where kind = 'message' and sender_session_id = '${child}'`)).toContain(upMarker);
    // A delivery to a lead spends one automatic wake; no person spoke in between.
    expect(Number(sql(fixture, `select wakes from agent_mail_wakes where lead_session_id = '${lead}'`))).toBeGreaterThanOrEqual(1);
    // The child finished its turn: the lead is told so in Perch's words, once the lead is idle and no child works.
    await expect.poll(() => sql(fixture, `select state from agent_mail where kind = 'note' and sender_session_id = '${child}' order by created_at desc limit 1`), { timeout: 240_000, intervals: [2_000] }).toBe("delivered");
    expect(sql(fixture, `select body from agent_mail where kind = 'note' and sender_session_id = '${child}' order by created_at desc limit 1`)).toContain("finished its turn");
    // The lead saw both as Perch's quoted text, not as something a person typed, and its view still holds control.
    await expect(box).toBeEnabled();
    await expect(ui.locator('[data-native-role="user"]').filter({ hasText: "Perch message from" }).first()).toBeVisible({ timeout: 60_000 });
    await expect(ui.locator('[data-native-role="user"]').filter({ hasText: "Perch status from" }).first()).toBeVisible({ timeout: 60_000 });
    await untilReady(ui, 180_000);

    // The lead messages the idle child: a Codex or Claude receiver takes it only when idle, and acts on it.
    await send(`Run exactly: perch send ${child} Run the shell command perch report ${downMarker} and then stop. Use no other tools.   Then reply with the one word sent and nothing else.`);
    await expect.poll(() => sql(fixture, `select state from agent_mail where kind = 'message' and sender_session_id = '${lead}' and target_session_id = '${child}'`), { timeout: 240_000, intervals: [2_000] }).toBe("delivered");
    await expect.poll(() => sql(fixture, `select report from agent_identities where session_id = '${child}' and report is not null`), { timeout: 240_000, intervals: [2_000] }).toContain(downMarker);
    // The turn that message opened is an agent's, so the child still cannot spawn (covered without models in the core's tests).
    await untilReady(ui, 180_000);
    // In the sidebar the child sits with its lead's family: its dot (compact) or row (list) is marked a sub-session.
    await expect(page.locator(`[data-testid="workspace-session-${child}"][data-sub-session], [data-sub-session] > [data-testid="workspace-session-${child}"]`)).toHaveCount(1);
    // The family strip above the composer names the child with four separate lines: Perch's own state, what
    // the lead wrote and its receipt, and the child's own report labelled as its claim.
    const family = page.locator(`[data-testid="native-cli-family-row"][data-session="${child}"]`);
    await expect(family).toBeVisible({ timeout: 30_000 });
    await expect(family.getByTestId("native-cli-family-state")).toHaveText(/^(Idle|Finished its turn)$/, { timeout: 30_000 });
    await expect(family.getByTestId("native-cli-family-report")).toContainText(`Reported: ${downMarker}`);
    await expect(family.getByTestId("native-cli-family-latest")).toContainText("You wrote");
    // No message was written twice and none was left half-handled.
    expect(sql(fixture, "select count(*) from agent_mail where state in ('delivering', 'unconfirmed')")).toBe("0");
    const everywhere = [await ui.innerText(), execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }), fs.readFileSync(path.join(fixture, "core.log"), "utf8")].join("\n");
    expect(everywhere).not.toContain("perch_agent_");
  } catch (error) {
    await testInfo.attach("chat", { body: await ui.innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
    await setChatMode(page, "cli").catch(() => {});
    await page.waitForTimeout(4_000);
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("agent_mail", { body: sql(fixture, "select id, kind, sender_session_id, target_session_id, state, reason, substr(body, 1, 160) from agent_mail").slice(0, 6000), contentType: "text/plain" });
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
