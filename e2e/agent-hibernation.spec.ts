/**
 * V-12 safe hibernation and resume.
 *
 * Hibernation only counts if it is observable and reversible: an idle agent
 * nobody is watching must lose its process, keep its conversation identity,
 * and come back on the *same* provider session when someone returns. The
 * machinery (`HibernationPolicy`, `hibernate`, `wake_cli`) existed with no
 * runtime caller; this exercises the wiring added in `server/mod.rs`
 * (`spawn_agent_hibernation_task`) and `server/terminal.rs` (the
 * `RequiresWake` branch).
 *
 * Real Claude CLI, because the safety rules require a real resume identity —
 * including an initial response and a post-resume recall turn. The idle
 * window is set to 2s through `PERCH_HIBERNATE_AFTER_SECS`; every other
 * blocker (a viewer, input ownership, an unfinished state) is the product's.
 *
 * Boots its own core with its own database. Headless only.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

interface AgentStatusFrame {
  state: string;
  providerSessionId?: string;
  key: { workspaceId: string; sessionId: string; agentId: string };
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(selected));
    });
  });
}

test("an unwatched idle CLI agent hibernates and resumes the same session", async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-hibernate-")));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const coreLog: string[] = [];
  const statuses: AgentStatusFrame[] = [];
  const errors: string[] = [];
  let core: ChildProcess | null = null;

  fs.writeFileSync(path.join(fixture, "hosts.json"), JSON.stringify({ hosts: [] }));
  fs.writeFileSync(path.join(fixture, "providers.json"), JSON.stringify({ version: 1, providers: [] }));
  fs.writeFileSync(path.join(fixture, "README.md"), "hibernation fixture\n");

  await context.addInitScript((directory) => {
    // This page visits about:blank to drop its connection; storage is not
    // reachable there and the attempt would look like an application error.
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory as string);
  }, fixture);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push("console: " + message.text().slice(0, 300)); });
  const watchFrames = (target: typeof page) => target.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.lifecycle.changed") statuses.push(message.status);
      if (message.type === "agent.terminal.opened") statuses.push(message.status);
      if (message.type === "error") errors.push("wire: " + JSON.stringify(message).slice(0, 300));
    }),
  );
  watchFrames(page);

  try {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json"), "--cwd", fixture],
      {
        cwd: root,
        env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", ANTHROPIC_MODEL: "claude-haiku-4-5", PERCH_HIBERNATE_AFTER_SECS: "2" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(`fixture core exited: ${coreLog.join("")}`);
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);

    // 1. Start a real CLI agent and complete a conversation turn.
    await page.goto(url, { waitUntil: "networkidle" });
    const toggle = page.getByTestId("session-mode-toggle");
    await expect(toggle).toBeEnabled({ timeout: 15000 });
    await page.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    await page.getByTestId("cli-start-agent-claude").click();
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
    const cli = page.getByTestId("persistent-agent-terminal");
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 60_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 60_000 });
    // One real (tiny) turn: `claude --resume` needs a conversation to resume,
    // and an agent that has never been prompted has none. This is also what
    // makes the resume claim meaningful — there is something to come back to.
    await expect(cli.locator(".xterm-rows")).toContainText(/Haiku 4\.5/);
    const input = cli.locator(".xterm-helper-textarea");
    await input.pressSequentially("Reply with exactly: PERCH_READY", { delay: 10 });
    await input.press("Enter");
    await page.getByTestId("session-mode-scope").selectOption("session");
    await toggle.click();
    const ui = page.getByTestId("native-cli-chat");
    // An assistant-only row and Ready status cannot match the echoed prompt.
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText("PERCH_READY", { timeout: 90_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 30_000 });
    const originalPid = await ui.getAttribute("data-native-pid");
    expect(originalPid).toMatch(/^\d+$/);
    const tmuxNames = [...new Set([...coreLog.join("").matchAll(/tmux_session=(perch-cli-\S+)/g)].map((match) => match[1]))];
    expect(tmuxNames, "one concrete runtime was launched").toHaveLength(1);
    const tmuxName = tmuxNames[0];
    execFileSync("tmux", ["has-session", "-t", `=${tmuxName}`], { stdio: "ignore" });
    await toggle.click();

    const sessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(sessionId).toBeTruthy();
    const started = statuses.filter((status) => status.key.sessionId === sessionId).at(-1);
    expect(started?.providerSessionId, "a resume identity is recorded before hibernation").toBeTruthy();
    const providerSessionId = started!.providerSessionId!;
    await page.screenshot({ path: testInfo.outputPath("hibernation-before.png"), fullPage: true });

    // 2. Nobody is watching. A viewer, input ownership or an unfinished state
    //    each block hibernation by policy, so the page has to go away.
    await page.goto("about:blank");

    // 3. The server hibernates it on its own. Observe from a second client
    //    rather than from the process log — in its own context, because a page
    //    sharing this one's localStorage would reopen the very session under
    //    test and become the viewer that (correctly) blocks hibernation.
    const observerContext = await browser.newContext();
    await observerContext.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
    const observer = await observerContext.newPage();
    watchFrames(observer);
    await observer.goto(url, { waitUntil: "networkidle" });
    await expect.poll(
      () => statuses.filter((status) => status.key.sessionId === sessionId).at(-1)?.state,
      { timeout: 90_000, message: "the idle agent never reached the sleeping state" },
    ).toBe("sleeping");
    const asleep = statuses.filter((status) => status.key.sessionId === sessionId).at(-1)!;
    expect(asleep.providerSessionId, "hibernation keeps the resume identity").toBe(providerSessionId);
    // The process is really gone: its tmux session is not listed any more.
    expect(() => execFileSync("tmux", ["has-session", "-t", `=${tmuxName}`], { stdio: "ignore" })).toThrow();
    await expect.poll(() => {
      try { process.kill(Number(originalPid), 0); return true; } catch { return false; }
    }, { timeout: 5_000, message: "the original native process must exit after tmux termination" }).toBe(false);

    // 4. The original client returns. Its session reopens, which resumes the
    //    recorded conversation — wake never falls back to a fresh session, so
    //    a failure here is loud rather than a silently restarted agent.
    await page.goto(url, { waitUntil: "networkidle" });
    const resumed = page.getByTestId("persistent-agent-terminal");
    const resumeButton = page.getByTestId("cli-resume");
    if (await resumeButton.isVisible().catch(() => false)) await resumeButton.click();
    await expect(resumed).toHaveAttribute("data-terminal-id", /.+/, { timeout: 60_000 });
    await expect(resumed.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 60_000 });
    // Claude's resume SessionStart hook omits `model`; verify the live CLI's
    // selected model before the recall prompt instead of trusting old history.
    await expect(resumed.locator(".xterm-rows")).toContainText(/Haiku 4\.5/);
    const awake = statuses.filter((status) => status.key.sessionId === sessionId).at(-1)!;
    expect(awake.state, "a woken agent is not still sleeping").not.toBe("sleeping");
    expect(awake.providerSessionId, "wake resumed the same provider session").toBe(providerSessionId);
    await toggle.click();
    await expect(ui).toHaveAttribute("data-native-session", providerSessionId, { timeout: 30_000 });
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/);
    expect(await ui.getAttribute("data-native-pid")).not.toBe(originalPid);
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText("PERCH_READY");
    const beforeAnswers = await ui.locator('[data-native-role="assistant"]').count();
    const beforeRecall = await ui.locator('[data-native-role="user"]').count();
    await ui.getByTestId("native-cli-composer").fill("Repeat the exact token from your previous reply, with no other text.");
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(beforeRecall + 1);
    await expect.poll(() => ui.locator('[data-native-role="assistant"]').count(), { timeout: 90_000 }).toBeGreaterThan(beforeAnswers);
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 90_000 });
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText("PERCH_READY");
    await page.screenshot({ path: testInfo.outputPath("hibernation-resumed.png"), fullPage: true });
    await observerContext.close();

    expect(errors).toEqual([]);
  } finally {
    fs.writeFileSync(testInfo.outputPath("core.log"), coreLog.join(""));
    if (core && core.exitCode === null) {
      const child = core;
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGKILL");
      });
    }
    const ownedTmux = new Set([...coreLog.join("").matchAll(/tmux_session=(perch-cli-\S+)/g)].map((match) => match[1]));
    for (const name of ownedTmux) {
      try { execFileSync("tmux", ["kill-session", "-t", `=${name}`], { stdio: "ignore" }); } catch { /* already stopped */ }
    }
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
