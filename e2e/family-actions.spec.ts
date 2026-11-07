/**
 * Live check of the family strip's actions on a child (slice 7): a Claude lead (haiku) that a person has
 * just spoken to starts a Claude child (haiku) with a slow task; from the lead's open chat the person
 * steers it mid-turn (confirmed through Claude's own queue and its transcript), messages it once it is idle
 * (the slice 5 queue), interrupts a second slow turn (the session stays), and stops it with a confirm step.
 * What the core recorded is read from its SQLite file, not from what any model said. Isolated core and
 * daemon, see docs/TESTING.md. Four short haiku turns in all.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts family-actions.spec.ts --workers 1
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
    if ((await ui.getByRole("status").first().innerText().catch(() => "")) === "Ready") return;
    const card = ui.getByTestId("native-cli-request");
    if (await card.isVisible().catch(() => false)) await card.getByTestId("native-cli-request-option-1").click().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("the lead did not become ready");
}

test("a person steers, messages, interrupts and stops a child from the family strip", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-famact-"));
  const stamp = Date.now().toString(36).toUpperCase();
  const steerMarker = `STEER${stamp}`;
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
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

    // The person speaks; the lead starts a child with a slow, four-step task and goes idle.
    await box.fill(
      "Use the shell and no other tools. Run exactly one shell command, to start a helper session: the command is the `perch spawn` line below, whole. " +
      `The helper does the work in the text after --task, you do not: never run any part of that text yourself. perch spawn --agent claude --model ${CHEAP_CLAUDE_MODEL} --task Use only the shell tool. Make four separate foreground shell calls, never in the background, one after the other: sleep 12 then echo A, sleep 12 then echo B, sleep 12 then echo C, sleep 12 then echo D. After the fourth reply with the one word finished.` +
      " That is the end of the command line. After that command, reply with the one word spawned and nothing else.",
    );
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => sql(fixture, `select count(*) from sub_sessions where parent_session_id = '${lead}'`), { timeout: 90_000, intervals: [2_000] }).toBe("1");
    const child = sql(fixture, `select child_session_id from sub_sessions where parent_session_id = '${lead}'`);
    expect(child, "one sub-session").toMatch(/^[0-9a-f-]{36}$/);
    await untilReady(ui, 240_000);

    const row = page.locator(`[data-testid="native-cli-family-row"][data-session="${child}"]`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    const more = row.getByTestId("native-cli-family-more");
    const receipt = row.getByTestId("native-cli-family-receipt");
    const openMenu = async () => { if (!(await row.getByRole("menu").isVisible())) await more.click(); };

    // STEER: while the child's turn runs, Steer is offered; the text joins that turn.
    await expect(row.getByTestId("native-cli-family-state")).toHaveText("Working", { timeout: 60_000 });
    await expect.poll(async () => { await openMenu(); return row.getByTestId("native-cli-family-steer").isEnabled(); }, { timeout: 30_000, intervals: [1_000] }).toBe(true);
    await row.getByTestId("native-cli-family-steer").click();
    await row.getByTestId("native-cli-family-compose").locator("textarea").fill(`Before you finish, also run the shell command perch report ${steerMarker} and then reply with the one word finished.`);
    await row.getByTestId("native-cli-family-send").click();
    // Not "confirmed" until Claude's own transcript shows its queue took the text into the running turn.
    await expect(receipt).toHaveText(/^Steer (confirmed|sent, not confirmed)/, { timeout: 40_000 });
    const steerReceipt = await receipt.innerText();
    await testInfo.attach("steer-receipt", { body: steerReceipt, contentType: "text/plain" });
    expect(steerReceipt, "Claude's queue should feed text submitted mid-turn into the turn").toMatch(/^Steer confirmed/);
    expect(sql(fixture, `select kind || '|' || sender_session_id || '|' || state from agent_mail where target_session_id = '${child}' and kind = 'steer'`)).toBe("steer|person|delivered");
    // It took effect: the child's own report carries the marker the steer asked for.
    await expect.poll(() => sql(fixture, `select report from agent_identities where session_id = '${child}' and report is not null`), { timeout: 180_000, intervals: [2_000] }).toContain(steerMarker);
    await expect(row.getByTestId("native-cli-family-state")).toHaveText(/^(Idle|Finished its turn)$/, { timeout: 120_000 });
    // Idle: Steer is disabled, with the reason that points at Message.
    await openMenu();
    await expect(row.getByTestId("native-cli-family-steer")).toBeDisabled();
    await expect(row.getByTestId("native-cli-family-steer-reason")).toContainText("use Message");
    await more.click();

    // MESSAGE: a person's message is queued and delivered once the child is idle, as the person's.
    await row.getByTestId("native-cli-family-message").click();
    await row.getByTestId("native-cli-family-compose").locator("textarea").fill("Run the shell command sleep 90 as a foreground call, never in the background, and then stop. Use no other tools.");
    await row.getByTestId("native-cli-family-send").click();
    await expect(receipt).toContainText("Message queued", { timeout: 20_000 });
    await expect.poll(() => sql(fixture, `select sender_session_id || '|' || state from agent_mail where kind = 'message' and target_session_id = '${child}' order by created_at desc limit 1`), { timeout: 120_000, intervals: [2_000] }).toBe("person|delivered");
    // It is not an automatic wake of the lead.
    expect(sql(fixture, `select count(*) from agent_mail_wakes where lead_session_id = '${child}'`)).toBe("0");

    // INTERRUPT: that turn runs for a while; the interrupt stops it and the session stays.
    await expect(row.getByTestId("native-cli-family-state")).toHaveText("Working", { timeout: 60_000 });
    await expect.poll(async () => { await openMenu(); return row.getByTestId("native-cli-family-interrupt").isEnabled(); }, { timeout: 30_000, intervals: [1_000] }).toBe(true);
    await row.getByTestId("native-cli-family-interrupt").click();
    await expect(receipt).toHaveText(/^Interrupt (confirmed|sent, not confirmed)/, { timeout: 40_000 });
    expect(await receipt.innerText(), "the provider should report the turn over").toMatch(/^Interrupt confirmed/);
    await expect(row.getByTestId("native-cli-family-state")).toHaveText(/^(Idle|Finished its turn)$/, { timeout: 30_000 });
    expect(sql(fixture, `select state from sub_sessions where child_session_id = '${child}'`), "an interrupt keeps the session").toBe("running");

    // STOP: confirmed only after a confirm step, and only when perchd shows the process gone.
    await openMenu();
    await row.getByTestId("native-cli-family-stop").click();
    await expect(row.getByTestId("native-cli-family-confirm-stop")).toBeVisible();
    await row.getByTestId("native-cli-family-confirm").click();
    await expect(receipt).toHaveText("Stopped", { timeout: 40_000 });
    expect(sql(fixture, `select state from sub_sessions where child_session_id = '${child}'`)).toBe("stopped");
    // Nothing a person sent is left half-handled (a status note to the lead may still be in flight).
    expect(sql(fixture, "select count(*) from agent_mail where sender_session_id = 'person' and state in ('queued', 'delivering', 'unconfirmed')")).toBe("0");
  } catch (error) {
    await testInfo.attach("family", { body: await page.getByTestId("native-cli-family").innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("chat", { body: await ui.innerText({ timeout: 5_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
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
