/** Isolated, headless Context Bridge workflow. One real Haiku turn per engine. */
import { test, expect } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { addProject } from "./projects";
import { firstWorkspaceId, openWorkspaceTool } from "./workspaceTools";
import { MOD, expectDoc } from "./editor";
import { CHEAP_CLAUDE_MODEL } from "./cheapModel";

test("editor, file, diff and terminal captures reach the same ready agent only on explicit send", async ({ page, context }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "perch-context-"));
  const fixture = path.join(scratch, "workspace"); fs.mkdirSync(fixture);
  const git = (args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: fixture, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "Perch fixture", GIT_AUTHOR_EMAIL: "fixture@perch.test", GIT_COMMITTER_NAME: "Perch fixture", GIT_COMMITTER_EMAIL: "fixture@perch.test" } });
  fs.writeFileSync(path.join(fixture, "notes.txt"), "original line\n");
  fs.writeFileSync(path.join(fixture, "disk.txt"), "disk context\n");
  git(["init", "-q", "-b", "main"]); git(["add", "."]); git(["commit", "-q", "-m", "fixture"]);
  fs.writeFileSync(path.join(fixture, "notes.txt"), "changed on disk\n");
  fs.writeFileSync(path.join(scratch, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(scratch, "providers.json"), '{"version":1,"providers":[]}');
  fs.writeFileSync(path.join(scratch, "settings.json"), JSON.stringify({ chatMode: "cli", permissionsSetupDismissed: true }));
  const port = await new Promise<number>((resolve) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); }); });
  const url = `http://127.0.0.1:${port}`;
  const log = fs.openSync(path.join(scratch, "core.log"), "a");
  let core: ChildProcess | undefined;
  const sent: any[] = [], received: any[] = [], errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => sent.push(JSON.parse(String(payload))));
    socket.on("framereceived", ({ payload }) => received.push(JSON.parse(String(payload))));
  });
  await context.addInitScript(() => {
    if (location.protocol !== "http:" || window !== window.top) return;
    localStorage.setItem("perch.onboarding.seen", "1");
    // Test-only access to the existing app connection, so replay/scope tests
    // exercise exactly the same connection and authority as the visible UI.
    const Native = window.WebSocket;
    const sockets: WebSocket[] = [];
    (window as unknown as { contextSockets: WebSocket[] }).contextSockets = sockets;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        sockets.push(this);
      }
    };
  });
  async function rpc(message: Record<string, unknown>) {
    return page.evaluate((message) => new Promise<any>((resolve, reject) => {
      const socket = (window as unknown as { contextSockets: WebSocket[] }).contextSockets.find((candidate) => candidate.readyState === WebSocket.OPEN)!;
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { socket.removeEventListener("message", listener); reject(new Error("RPC timed out")); }, 15_000);
      function listener(event: MessageEvent) {
        const reply = JSON.parse(String(event.data));
        if (reply.requestId !== requestId) return;
        clearTimeout(timer); socket.removeEventListener("message", listener); resolve(reply);
      }
      socket.addEventListener("message", listener);
      socket.send(JSON.stringify({ ...message, requestId }));
    }), message);
  }
  const dialog = page.getByTestId("context-bridge");
  const prepared = dialog.getByLabel("Prepared context", { exact: true });
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(scratch, "history.sqlite"), "--hosts-path", path.join(scratch, "hosts.json"), "--providers-path", path.join(scratch, "providers.json")], { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", PERCH_DB: path.join(scratch, "history.sqlite"), PERCH_HOSTS: path.join(scratch, "hosts.json"), PERCHD_DIR: path.join(scratch, "daemon"), PERCH_SETTINGS: path.join(scratch, "settings.json"), ANTHROPIC_MODEL: CHEAP_CLAUDE_MODEL, RUST_LOG: "info" }, stdio: ["ignore", log, log] });
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    const project = page.locator(".workspace-project").filter({ hasText: "workspace" });
    const workspaceId = await firstWorkspaceId(project);
    await openWorkspaceTool(page, workspaceId, "files");
    await page.getByTestId("workspace-file-entry-notes.txt").click();
    const editor = page.getByTestId("workspace-file-editor");
    await expectDoc(editor, "changed on disk\n");
    await editor.click(); await editor.press(`${MOD}+a`); await editor.pressSequentially("unsaved bridge selection");
    await editor.press(`${MOD}+a`);
    await editor.click({ button: "right" });
    await page.getByTestId("editor-menu-ask-agent").click();
    await expect(prepared).toHaveValue(/UNSAVED draft.*[\s\S]*unsaved bridge selection/);
    await expect(prepared).toHaveValue(/notes.txt:1-1/);
    expect(fs.readFileSync(path.join(fixture, "notes.txt"), "utf8")).toBe("changed on disk\n");
    await expect(dialog.getByRole("button", { name: "Send to agent", exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("context-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const targets = await dialog.locator("button, select, textarea").evaluateAll((controls) => controls.map((control) => ({ label: control.getAttribute("aria-label") ?? control.textContent, height: control.getBoundingClientRect().height })));
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((target) => target.height < 44)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("context-mobile.png") });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1400, height: 900 });
    expect(sent.filter((message) => message.type === "context.send")).toHaveLength(0);

    // Explorer reuses the unsaved draft rather than silently reading disk.
    await openWorkspaceTool(page, workspaceId, "files");
    await page.getByTestId("workspace-file-entry-notes.txt").click({ button: "right" });
    await page.getByTestId("file-menu-ask-agent").click();
    await expect(prepared).toHaveValue(/UNSAVED draft.*[\s\S]*unsaved bridge selection/);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await openWorkspaceTool(page, workspaceId, "gitReview");
    await page.locator('.workspace-git__path-button[title="notes.txt"]').click();
    await page.getByRole("button", { name: "Ask agent about diff…", exact: true }).first().click();
    await expect(prepared).toHaveValue(/Captured Git diff: notes.txt[\s\S]*changed on disk/);
    await expect(prepared).not.toHaveValue(/unsaved bridge selection/);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const line = page.locator('[data-testid="git-diff-line"][data-side="new"]').filter({ hasText: "changed on disk" }).first();
    await line.click();
    await page.getByRole("button", { name: "Ask agent about lines…", exact: true }).click();
    await expect(prepared).toHaveValue(/Selected new lines 1–1/);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    // The disk packet is read through the workspace service and checked again
    // on send, before any target control or native input is touched.
    const diskPreview = await rpc({ type: "context.preview", workspaceId, source: { kind: "file", path: "disk.txt" }, instruction: "" });
    fs.writeFileSync(path.join(fixture, "disk.txt"), "new disk context\n");
    const stale = await rpc({ type: "context.send", workspaceId, source: { kind: "file", path: "disk.txt" }, instruction: "", digest: diskPreview.packet.digest, targetSessionId: "not-an-agent", operationId: crypto.randomUUID() });
    expect(stale.message).toContain("changed since preview");
    const escaped = await rpc({ type: "context.preview", workspaceId, source: { kind: "file", path: "../hosts.json" }, instruction: "" });
    expect(escaped.type).toBe("error");
    const crossed = await rpc({ type: "context.preview", workspaceId, source: { kind: "terminal", sessionId: "missing", text: "failure" }, instruction: "" });
    expect(crossed.type).toBe("error");

    // Explicitly start one cheap Claude CLI, then check its banner before the
    // first and only model prompt. The bridge itself never creates a session.
    await page.getByTestId("workspace-tools-toggle").click();
    await page.getByTestId("tab-new").click();
    await page.getByTestId("new-session-provider-claude").click();
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-controlling", "true");
    await expect(terminal.locator(".xterm-rows")).toContainText(/bypass permissions on|Yes, I trust this folder/, { timeout: 30_000 });
    await page.waitForTimeout(300);
    const startup = await terminal.locator(".xterm-rows").innerText();
    if (startup.includes("Yes, I trust this folder")) {
      if (startup.includes("❯ No, exit")) await terminal.locator(".xterm-helper-textarea").press("ArrowDown");
      await expect(terminal.locator(".xterm-rows")).toContainText("❯ Yes, I trust this folder");
      await terminal.locator(".xterm-helper-textarea").press("Enter");
    }
    await expect(terminal.locator(".xterm-rows")).toContainText("bypass permissions on", { timeout: 30_000 });
    await expect(terminal.locator(".xterm-rows")).toContainText(/Haiku 4.5/i);
    const opened = received.findLast((message) => message.type === "agent.terminal.opened");
    const targetSessionId = opened.status.key.sessionId;
    expect(opened.status.key.workspaceId).toBe(workspaceId);
    await page.getByTestId(`tab-${targetSessionId}`).click();
    await expect(terminal).toBeVisible();

    // A rendered selection is captured without parsing raw ANSI or taking
    // input control. Real pointer selection exercises xterm's selection model.
    const screen = (await terminal.locator(".xterm-screen").boundingBox())!;
    await page.mouse.move(screen.x + 5, screen.y + 5);
    await page.mouse.down();
    await page.mouse.move(screen.x + Math.min(500, screen.width - 10), screen.y + 80, { steps: 12 });
    await page.mouse.up();
    await page.mouse.click(screen.x + 50, screen.y + 40, { button: "right" });
    await page.getByRole("button", { name: "Ask agent about selection…", exact: true }).click();
    await expect(prepared).toHaveValue(/Captured terminal selection/);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    // A failed send must preserve a typed CLI draft and release any input
    // lease it borrowed. Shared typing and the resize lease remain untouched.
    const probeSource = { kind: "editor", path: "notes.txt", text: "context probe", startLine: 1, endLine: 1, dirty: true };
    const probe = await rpc({ type: "context.preview", workspaceId, source: probeSource, instruction: "" });
    const lifecycle = { sessionId: targetSessionId, workspaceId, agentId: "claude" };
    const before = await rpc({ type: "agent.lifecycle.get", ...lifecycle });
    if (before.status.inputOwner) await rpc({ type: "agent.control.release", ...lifecycle, channel: "input", generation: before.status.inputOwner.generation });
    await terminal.locator(".xterm-helper-textarea").pressSequentially("bridge_unsent_draft");
    await expect(terminal.locator(".xterm-rows")).toContainText("bridge_unsent_draft");
    const draftRejected = await rpc({ type: "context.send", workspaceId, source: probeSource, instruction: "", digest: probe.packet.digest, targetSessionId, operationId: crypto.randomUUID() });
    expect(draftRejected.type).toBe("error");
    expect(draftRejected.message).toContain("draft or dialog");
    expect(execFileSync("sqlite3", [path.join(scratch, "history.sqlite"), "SELECT count(*) FROM prompt_operations"], { encoding: "utf8" }).trim()).toBe("0");
    const after = await rpc({ type: "agent.lifecycle.get", ...lifecycle });
    expect(after.status.inputOwner).toBeUndefined();
    expect(after.status.resizeOwner).toEqual(before.status.resizeOwner);
    await expect(terminal.locator(".xterm-rows")).toContainText("bridge_unsent_draft");
    await terminal.locator(".xterm-helper-textarea").press("Control+u");

    // A valid source from another nest must not authorize this target.
    const other = path.join(scratch, "other"); fs.mkdirSync(other); fs.writeFileSync(path.join(other, "note.txt"), "other nest");
    await addProject(page, other);
    const otherId = await firstWorkspaceId(page.locator(".workspace-project").filter({ hasText: "other" }));
    const otherPreview = await rpc({ type: "context.preview", workspaceId: otherId, source: { kind: "file", path: "note.txt" }, instruction: "" });
    const wrongNest = await rpc({ type: "context.send", workspaceId: otherId, source: { kind: "file", path: "note.txt" }, instruction: "", digest: otherPreview.packet.digest, targetSessionId, operationId: crypto.randomUUID() });
    expect(wrongNest.message).toContain("this exact nest");

    // Actual integrated send from an unsaved editor selection.
    await openWorkspaceTool(page, workspaceId, "files");
    await page.getByTestId("workspace-file-entry-notes.txt").click();
    await expectDoc(editor, "unsaved bridge selection");
    await page.getByRole("button", { name: "Ask agent…", exact: true }).click();
    const marker = `BRIDGE_OK_${Date.now()}`;
    await dialog.getByLabel("Question for agent", { exact: true }).fill(`Do not use tools, execute commands, or modify files. If the excerpt contains unsaved bridge selection, reply exactly ${marker}.`);
    await expect(prepared).toHaveValue(new RegExp(marker));
    await dialog.getByLabel("Agent in this nest", { exact: true }).selectOption(targetSessionId);
    await expect(dialog.getByRole("button", { name: "Send to agent", exact: true })).toBeEnabled();
    const sendsBefore = sent.filter((message) => message.type === "context.send").length;
    await dialog.getByRole("button", { name: "Send to agent", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Context delivered", { timeout: 20_000 });
    const submitted = sent.filter((message) => message.type === "context.send").at(-1);
    expect(sent.filter((message) => message.type === "context.send")).toHaveLength(sendsBefore + 1);
    await dialog.getByRole("button", { name: "Open agent", exact: true }).click();
    await expect(page.getByTestId(`tab-${targetSessionId}`)).toHaveClass(/tab-bar__tab--active/);
    await expect(terminal.locator(".xterm-helper-textarea")).toBeFocused();
    await expect(terminal.locator(".xterm-rows")).toContainText(marker, { timeout: 90_000 });
    await expect.poll(() => received.filter((message) => message.type === "agent.ui.snapshot").some((message) => message.snapshot.messages.some((item: any) => item.role === "assistant" && item.text.includes(marker))), { timeout: 90_000 }).toBe(true);
    await expect.poll(() => received.findLast((message) => message.type === "agent.ui.snapshot")?.snapshot.running, { timeout: 20_000 }).toBe(false);
    // A replay of the exact operation is acknowledged, never dispatched twice.
    const replay = await rpc(submitted);
    expect(replay.type).toBe("agent.ui.result");
    expect(replay.accepted).toBe(true);
    expect(execFileSync("sqlite3", [path.join(scratch, "history.sqlite"), "SELECT count(*) FROM prompt_operations WHERE state = 'delivered'"], { encoding: "utf8" }).trim()).toBe("1");
    const snapshots = received.filter((message) => message.type === "agent.ui.snapshot");
    expect(snapshots.at(-1).snapshot.messages.filter((item: any) => item.role === "user" && item.text.includes(marker))).toHaveLength(1);
    expect(fs.readFileSync(path.join(fixture, "notes.txt"), "utf8")).toBe("changed on disk\n");
    // Claude exits into its existing login shell. Never dispatch a packet
    // to that shell just because the saved launcher still says "claude".
    await terminal.locator(".xterm-helper-textarea").pressSequentially("/exit");
    await terminal.locator(".xterm-helper-textarea").press("Enter");
    await expect.poll(async () => {
      const result = await rpc({ type: "context.preview", workspaceId, source: probeSource, instruction: "" });
      return result.agents.find((agent: any) => agent.sessionId === targetSessionId)?.canSend;
    }).toBe(false);
    const shellRejected = await rpc({ type: "context.send", workspaceId, source: probeSource, instruction: "", digest: probe.packet.digest, targetSessionId, operationId: crypto.randomUUID() });
    expect(shellRejected.type).toBe("error");
    expect(fs.readFileSync(path.join(fixture, "notes.txt"), "utf8")).toBe("changed on disk\n");
    expect(errors).toEqual([]);
  } finally {
    await page.screenshot({ path: testInfo.outputPath("final-state.png") }).catch(() => {});
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    if (core && core.exitCode === null && core.signalCode === null) { const child = core; await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); }); }
    try { execFileSync("pkill", ["-TERM", "-f", `__perchd serve --dir ${scratch}/daemon`], { stdio: "ignore" }); } catch { /* no surviving probe daemon */ }
    fs.closeSync(log);
    await testInfo.attach("core.log", { body: fs.readFileSync(path.join(scratch, "core.log")), contentType: "text/plain" });
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
