import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

for (const provider of ["pi", "omp", "claude"]) test(`${provider}: phone review respects control and reaches the native CLI exactly once`, async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-review-"));
  const fixture = path.join(scratch, "workspace"); fs.mkdirSync(fixture);
  // Git commands apply only to this disposable test fixture, never the repo.
  const git = (args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: fixture, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "Perch fixture", GIT_AUTHOR_EMAIL: "fixture@perch.test", GIT_COMMITTER_NAME: "Perch fixture", GIT_COMMITTER_EMAIL: "fixture@perch.test" } });
  fs.writeFileSync(path.join(fixture, "notes.txt"), "before_one\nbefore_two\n");
  git(["init", "-q", "-b", "main"]); git(["add", "notes.txt"]); git(["commit", "-q", "-m", "fixture"]);
  fs.writeFileSync(path.join(fixture, "notes.txt"), "review_first\nreview_second\n");
  fs.writeFileSync(path.join(scratch, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(scratch, "providers.json"), '{"version":1,"providers":[]}');
  const port = await new Promise<number>((resolve) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); }); });
  const url = `http://127.0.0.1:${port}`;
  const token = `review_${provider}_${Date.now()}`;
  const log = fs.openSync(path.join(scratch, "core.log"), "a");
  const shots = path.join(root, ".impeccable/review"); fs.mkdirSync(shots, { recursive: true });
  let core: ChildProcess | undefined;
  let phoneContext: BrowserContext | undefined;
  let completed = false;
  let nativeKey: { workspaceId: string; sessionId: string; agentId: string } | undefined;
  const errors: string[] = [];
  const sends: Array<{ requestId: string; packetId: string; sendOperationId: string }> = [];
  const receipts: Array<{ requestId: string; delivery: string }> = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "agent.terminal.opened") nativeKey = message.status.key; }));
  await context.addInitScript((directory) => { if (location.protocol !== "http:" || window !== window.top) return; localStorage.setItem("perch.onboarding.seen", "1"); localStorage.setItem("perch.dirBrowser.lastPath.local", directory); }, fixture);
  async function addComment(current: Page, line: string, body: string) {
    await current.locator('[data-testid="git-diff-line"][data-side="new"]').filter({ hasText: line }).first().getByTestId("git-comment-add").click();
    await current.getByTestId("git-comment-body").fill(body);
    await current.getByRole("button", { name: "Add comment", exact: true }).click();
    await expect(current.locator(".workspace-git__comment").filter({ hasText: body })).toBeVisible();
  }
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(scratch, "history.sqlite"), "--hosts-path", path.join(scratch, "hosts.json"), "--providers-path", path.join(scratch, "providers.json")], { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", ...(provider === "claude" ? { ANTHROPIC_MODEL: "claude-haiku-4-5" } : {}) }, stdio: ["ignore", log, log] });
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(fixture);
    await page.getByTestId("workspace-project-name").fill(token);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    const project = page.locator(".workspace-project").filter({ hasText: token });
    await expect(project).toBeVisible();
    const gitButton = project.locator('[data-testid^="workspace-git-"]');
    const workspaceId = (await gitButton.getAttribute("data-testid"))!.slice("workspace-git-".length);
    const toggle = page.getByTestId("session-mode-toggle");
    await expect(toggle).toBeEnabled();
    await page.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    await page.getByTestId(`cli-start-agent-${provider}`).click();
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal.getByRole("button", { name: "Release control", exact: true })).toBeEnabled();
    if (provider === "claude") {
      await expect(terminal.locator(".xterm-rows")).toContainText(/bypass permissions on|Yes, I trust this folder/, { timeout: 30_000 });
      // Claude 2.1.270 rejects early confirmations and remounts this native
      // dialog after 150 ms. Wait for its cooldown before choosing an option.
      await page.waitForTimeout(300);
      const startup = await terminal.locator(".xterm-rows").innerText();
      if (startup.includes("Yes, I trust this folder")) {
        // Trust only the disposable workspace created by this test, using
        // Claude's own dialog, without bypassing its workspace trust check.
        if (startup.includes("❯ No, exit")) await terminal.locator(".xterm-helper-textarea").press("ArrowDown");
        await expect(terminal.locator(".xterm-rows")).toContainText("❯ Yes, I trust this folder");
        await terminal.locator(".xterm-helper-textarea").press("Enter");
      }
      await expect(terminal.locator(".xterm-rows")).toContainText("bypass permissions on", { timeout: 30_000 });
      await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4.5/i);
    }
    await page.getByTestId("session-mode-scope").selectOption("session");
    await toggle.click();
    const ui = page.getByTestId("native-cli-chat");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    const pid = await ui.getAttribute("data-native-pid");
    const nativeId = await ui.getAttribute("data-native-session");
    expect(nativeKey!.workspaceId).toBe(workspaceId);
    await ui.getByTestId("native-cli-composer").fill("Reply READY only. Do not use tools or modify files.");
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText("READY", { timeout: 90_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready");
    await gitButton.click();
    await expect(page.getByTestId("workspace-git-review")).toBeVisible();
    await page.locator('.workspace-git__path-button[title="notes.txt"]').click();
    await expect(page.getByTestId("git-diff")).toContainText("review_first");
    await addComment(page, "review_first", `First note ${token}`);
    await addComment(page, "review_second", `Second note ${token}`);

    phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    phoneContext.setDefaultTimeout(15_000);
    phoneContext.setDefaultNavigationTimeout(20_000);
    await phoneContext.addInitScript((id) => { if (location.protocol !== "http:" || window !== window.top) return; localStorage.setItem("perch.onboarding.seen", "1"); localStorage.setItem("perch.sessionId", id); }, nativeKey!.sessionId);
    const phone = await phoneContext.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    phone.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "review.batch.send") sends.push(message); });
      socket.on("framereceived", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "review.batch.send.result") receipts.push(message); });
    });
    await phone.goto(url, { waitUntil: "networkidle" });
    await expect(phone.getByTestId("native-cli-chat")).toHaveAttribute("data-native-pid", pid!);
    await phone.getByTestId("mobile-switch").click();
    await phone.getByTestId("mobile-switcher").getByTestId(`workspace-git-${workspaceId}`).click();
    await expect(phone.getByTestId("workspace-git-review")).toBeVisible();
    await phone.locator('.workspace-git__path-button[title="notes.txt"]').click();
    await expect(phone.getByTestId("git-diff")).toContainText("review_first");
    await expect(phone.locator(".workspace-git__comment").filter({ hasText: `First note ${token}` })).toBeVisible();
    await phone.getByLabel("Send to agent session", { exact: true }).selectOption(nativeKey!.sessionId);
    await expect(phone.getByLabel("Send to agent session", { exact: true }).locator("option:checked")).toContainText(provider);
    await phone.getByLabel("Request", { exact: true }).fill(`Do not modify files or use tools. If both First note and Second note are present, reply exactly ACCEPTED_${token}.`);
    await phone.getByTestId("git-review-preview").click();
    await expect(phone.getByTestId("git-review-packet")).toContainText("2 anchored notes");
    await phone.getByTestId("git-review-send").click();
    await expect(phone.getByRole("alert")).toContainText("Release this agent's control", { timeout: 15_000 });
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1);
    await ui.getByRole("button", { name: "Release control", exact: true }).click();
    await phone.getByTestId("git-review-send").click();
    await expect(phone.getByTestId("git-review-delivery")).toHaveText("Agent received the review packet.", { timeout: 20_000 });
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(`ACCEPTED_${token}`, { timeout: 90_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready");
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2);
    await phone.getByTestId("git-review-send").click();
    await expect(phone.getByTestId("git-review-delivery")).toHaveText("Agent received the review packet.");
    await expect.poll(() => receipts.filter((receipt) => receipt.delivery === "delivered").map((receipt) => receipt.requestId)).toEqual(sends.slice(1).map((send) => send.requestId));
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(2);
    expect(sends).toHaveLength(3);
    expect(new Set(sends.map((send) => send.sendOperationId)).size).toBe(1);
    expect(new Set(sends.map((send) => send.packetId)).size).toBe(1);
    await expect(ui).toHaveAttribute("data-native-pid", pid!);
    await expect(ui).toHaveAttribute("data-native-session", nativeId!);
    expect(fs.readFileSync(path.join(fixture, "notes.txt"), "utf8")).toBe("review_first\nreview_second\n");
    await phone.getByTestId("git-review-delivery").scrollIntoViewIfNeeded();
    await phone.screenshot({ path: path.join(shots, `native-review-${provider}-mobile-${testInfo.project.name}.png`) });
    await page.screenshot({ path: path.join(shots, `native-review-${provider}-desktop-${testInfo.project.name}.png`) });
    await ui.getByRole("button", { name: "Take control", exact: true }).click();
    await expect(ui.getByTestId("native-cli-composer")).toBeEnabled();
    expect(errors).toEqual([]);
    completed = true;
  } finally {
    if (!completed) {
      await page.screenshot({ path: path.join(shots, `native-review-${provider}-failure-${testInfo.project.name}.png`) }).catch(() => {});
      await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
      const phone = phoneContext?.pages()[0];
      if (phone) {
        await phone.screenshot({ path: path.join(shots, `native-review-${provider}-phone-failure-${testInfo.project.name}.png`), timeout: 5000 }).catch(() => {});
        await testInfo.attach("phone-state", { body: await phone.locator("body").innerText({ timeout: 5000 }).catch(() => "unavailable"), contentType: "text/plain" });
      }
    }
    await phoneContext?.close().catch(() => {});
    if (core && core.exitCode === null && core.signalCode === null) { const child = core; await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); }); }
    if (nativeKey) {
      const hash = createHash("sha256");
      for (const value of [nativeKey.workspaceId, nativeKey.sessionId, nativeKey.agentId]) { const bytes = Buffer.from(value); const size = Buffer.alloc(8); size.writeBigUInt64LE(BigInt(bytes.length)); hash.update(size); hash.update(bytes); }
      try { execFileSync("tmux", ["kill-session", "-t", `perch-cli-agent-${hash.digest("hex")}`], { stdio: "ignore" }); } catch { /* Already stopped. */ }
    }
    fs.closeSync(log);
    await testInfo.attach("core.log", { body: fs.readFileSync(path.join(scratch, "core.log")), contentType: "text/plain" });
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
