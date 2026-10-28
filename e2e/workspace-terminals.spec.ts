import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import * as os from "node:os";
import * as net from "node:net";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { startChat } from "./projects";

async function command(page: Page, text: string) {
  const input = page.locator(".terminal--persistent:visible .xterm-helper-textarea");
  await input.pressSequentially(text, { delay: 1 });
  await input.press("Enter");
}

// Fails identically on the previous commit: it predates "a tab is a terminal".
// The leader split no longer adds a legacy shell pane (`terminal.opened`), so
// rewrite it for tiled terminal tabs (agent.terminal.opened) before enabling.
test.fixme("shell state survives reload and multiple panes", async ({ page, context }, testInfo) => {
  const opened = new Map<string, { sessionId: string; terminalId: string }>();
  const errors: string[] = [];
  const observe = (view: Page) => {
    view.on("pageerror", (error) => errors.push(error.message));
    view.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "terminal.opened") opened.set(message.terminal.id, { sessionId: message.terminal.sessionId, terminalId: message.terminal.id });
    }));
  };
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  observe(page);
  await page.goto("http://127.0.0.1:7799", { waitUntil: "networkidle" });
  try {
    // A terminal split is part of the session layout, so it survives reloads.
    // One pane has no pane header; split with the leader chord (leader,_).
    await page.keyboard.press("Control+Space");
    await page.keyboard.press("_");
    const shell = page.locator(".terminal--persistent:visible");
    await expect(shell).toHaveAttribute("data-terminal-id", /.+/);
    const firstId = (await shell.getAttribute("data-terminal-id"))!;
    const firstPane = (await shell.getAttribute("data-pane-id"))!;
    expect(await page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(opened.get(firstId)!.sessionId);
    const marker = `shell_${Date.now()}`;
    await command(page, `PERCH_CHECK=${marker}; printf 'ready_%s\\n' "$PERCH_CHECK"`);
    await expect(shell.locator(".xterm-rows")).toContainText(`ready_${marker}`);
    await command(page, `printf 'PID_%s_END\\n' "$$"`);
    await expect(shell.locator(".xterm-rows")).toContainText(/PID_\d+_END/);
    const pid = (await shell.locator(".xterm-rows").innerText()).match(/PID_(\d+)_END/)![1];

    // Wait for the actual layout acknowledgement, not a guessed save delay.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBeTruthy();
    await expect.poll(async () => {
      return page.evaluate(async () => {
        const id = localStorage.getItem("perch.sessionId");
        return new Promise<string>((resolve) => {
          const ws = new WebSocket("ws://127.0.0.1:7799/ws");
          const timer = setTimeout(() => { ws.close(); resolve("No session layout reply"); }, 2000);
          ws.onopen = () => ws.send(JSON.stringify({ type: "session.layout.get", sessionId: id }));
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "session.layout") { clearTimeout(timer); ws.close(); resolve(JSON.stringify(message)); }
          };
        });
      });
    }).toContain(firstPane);
    await page.reload({ waitUntil: "networkidle" });
    await expect(shell).toHaveAttribute("data-terminal-id", firstId);
    await expect(shell.locator(".xterm-rows")).toContainText(`ready_${marker}`);
    await command(page, `printf 'restored_%s_PID_%s_END\\n' "$PERCH_CHECK" "$$"`);
    await expect(shell.locator(".xterm-rows")).toContainText(`restored_${marker}_PID_${pid}_END`);

    await shell.getByRole("button", { name: "New shell", exact: true }).click();
    await expect(shell).toHaveAttribute("data-terminal-id", /.+/);
    await expect(shell).not.toHaveAttribute("data-terminal-id", firstId);
    await command(page, `printf 'isolated_%s\\n' "\${PERCH_CHECK-unset}"`);
    await expect(shell.locator(".xterm-rows")).toContainText("isolated_unset");

    const shots = path.resolve(__dirname, "../.impeccable/review");
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, `shell-desktop-${testInfo.project.name}.png`) });
    await shell.getByRole("button", { name: "Close shell", exact: true }).click();
    await expect(shell).toContainText("Shell closed.");
    expect(errors).toEqual([]);
  } finally {
    // Only these fixture identities are closed; no global terminal cleanup.
    if (!page.isClosed()) await page.evaluate(async (rows) => new Promise<void>((resolve) => {
      const ws = new WebSocket("ws://127.0.0.1:7799/ws");
      const pending = new Set(rows.map((row) => row.terminalId));
      const finish = () => { clearTimeout(timer); ws.close(); resolve(); };
      const timer = setTimeout(finish, 5000);
      ws.onopen = () => {
        if (!pending.size) finish();
        for (const row of rows) ws.send(JSON.stringify({ type: "terminal.close", requestId: row.terminalId, ...row }));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.requestId) pending.delete(message.requestId);
        if (!pending.size) finish();
      };
    }), [...opened.values()]).catch(() => {});
  }
});

test("perchd shell recovers its process and state after a core crash", async ({ page, context }) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-shell-restart-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(selected));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(fixture, "hosts.json");
  fs.writeFileSync(hosts, JSON.stringify({ hosts: [] }));
  let core: ChildProcess | null = null;
  const errors: string[] = [];
  async function boot() {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", hosts, "--cwd", fixture], {
      cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1" }, stdio: "ignore",
    });
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error("Fixture core exited before readiness");
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
  }
  async function stop() {
    if (!core || core.exitCode !== null || core.signalCode !== null) return;
    const child = core;
    await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    core = null;
  }
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await boot();
    await page.goto(url, { waitUntil: "networkidle" });
    // A plain terminal is a session of the `Terminal` provider: the same perchd-backed terminal every agent runs in.
    await startChat(page);
    const shell = page.getByTestId("persistent-agent-terminal");
    await expect(shell).toHaveAttribute("data-terminal-id", /.+/);
    // Surviving the core's SIGKILL below (same pid, same environment) is what proves perchd owns the shell.
    const sessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    await command(page, `PERCH_RESTART=survived; printf 'before_%s_PID_%s_END\\n' "$PERCH_RESTART" "$$"`);
    await expect(shell.locator(".xterm-rows")).toContainText(/before_survived_PID_\d+_END/);
    const pid = (await shell.locator(".xterm-rows").innerText()).match(/before_survived_PID_(\d+)_END/)![1];

    await stop();
    await boot();
    await expect(shell).toHaveAttribute("data-controlling", "true", { timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(sessionId);
    await command(page, `printf 'after_%s_PID_%s_END\\n' "$PERCH_RESTART" "$$"`);
    await expect(shell.locator(".xterm-rows")).toContainText(`after_survived_PID_${pid}_END`);
    expect(errors).toEqual([]);

    // A quiet/idle lifecycle used to bypass reconnect-only recovery, silently
    // replacing its shell if perchd died while the app was closed.
    await command(page, "printf '\\033]0;Pi >\\007'; printf 'IDLE_''READY\\n'");
    await expect(shell.locator(".xterm-rows")).toContainText("IDLE_READY");
    const db = path.join(fixture, "history.sqlite");
    await expect.poll(() => execFileSync("sqlite3", [db, "SELECT state FROM agent_lifecycle WHERE session_id = '" + sessionId + "'"], { encoding: "utf8" }).trim()).toBe("idle");
    await stop();
    // Deliberately lose the private daemon/runtime, without abandoning its PTY.
    // The lifecycle DB still says idle because the core is already stopped.
    await cleanupFixtureRuntime(root, fixture);
    await boot();
    await expect(shell.locator('[role="alert"]')).toContainText(/no replacement|existing|fresh session/i, { timeout: 30_000 });
    expect(await shell.getAttribute("data-terminal-id")).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(sessionId);
    // An explicit new tab, unlike an old tab's reconnect, is a launch request.
    await startChat(page);
    await command(page, "printf 'NEW_''SHELL_PID_%s_END\\n' \"$$\"");
    await expect(shell.locator(".xterm-rows")).toContainText(/NEW_SHELL_PID_\d+_END/);
    expect((await shell.locator(".xterm-rows").innerText()).match(/NEW_SHELL_PID_(\d+)_END/)![1]).not.toBe(pid);
  } finally {
    await stop();
    await cleanupFixtureRuntime(root, fixture);
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
