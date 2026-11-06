/**
 * Live check of Instructions: text saved on a Birdhouse reaches a new session of every harness
 * through the append flags (Claude `--append-system-prompt-file`, Pi and OMP `--append-system-prompt`,
 * Codex `-c developer_instructions` on its shared app-server), while the repository's own
 * AGENTS.md / CLAUDE.md still load. One cheap-model turn per harness against an isolated core;
 * see docs/TESTING.md. Also checks the Birdhouse menu's dialog (no model turn).
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts instructions.spec.ts --workers 1 [-g claude]
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

/** Ask the core directly, over a short-lived socket, as `addProject` does. */
async function request(page: Page, message: Record<string, unknown>, reply: string): Promise<any> {
  return page.evaluate(({ message, reply }) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { ws.close(); reject(new Error(`${reply} timed out`)); }, 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ ...message, requestId }));
    ws.onmessage = (event) => {
      const answer = JSON.parse(event.data);
      if (answer.requestId !== requestId || answer.type !== reply) return;
      clearTimeout(timer); ws.close(); resolve(answer);
    };
  }), { message, reply });
}

/** Start a core on a private port, with a cheap model pinned and every state path isolated. */
async function startCore(fixture: string, provider: string, port: number, extraPath?: string) {
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], {
    cwd: root,
    env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...(provider === "pi" ? {} : cheapModelEnv(provider, fixture)), PATH: extraPath ?? process.env.PATH },
    stdio: ["ignore", log, log],
  });
  const url = `http://127.0.0.1:${port}`;
  await expect.poll(async () => { if (core.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
  return { core, url, log };
}

async function stopCore(core: ChildProcess | undefined, fixture: string, log: number | undefined) {
  if (core && core.exitCode === null && core.signalCode === null) {
    const child = core;
    await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
  }
  await cleanupFixtureRuntime(root, fixture).catch(() => {
    // The daemon and its agent belong to this fixture alone: stop them rather than leave a paid CLI running.
    const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
    for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((entry) => entry.includes(daemonDir))) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
    }
  });
  if (log !== undefined) fs.closeSync(log);
  fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

const onboarding = (page: Page, fixture: string) => page.context().addInitScript((directory) => {
  if (location.protocol !== "http:" || window !== window.top) return;
  localStorage.setItem("perch.onboarding.seen", "1");
  localStorage.setItem("perch.sidebar.organize", "project");
  localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
}, fixture);

for (const provider of ["claude", "codex", "omp", "pi"]) test(`${provider}: Instructions reach a new session and the repository's own files still load`, async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const expectedModel = provider === "claude" ? CHEAP_CLAUDE_MODEL : CHEAP_CODEX_MODEL;
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-instructions-"));
  const stamp = Date.now().toString(36).toUpperCase();
  const instructionWord = `INSTR${stamp}`;
  const repoWord = `REPO${stamp}`;
  const referenceFolder = fs.mkdtempSync(path.join(os.tmpdir(), "perch-instructions-ref-"));
  // Each harness reads its own repository file; both carry the same marker.
  for (const name of ["AGENTS.md", "CLAUDE.md"]) fs.writeFileSync(path.join(fixture, name), `The repo marker word is ${repoWord}.\n`);
  const bin = path.join(fixture, "bin");
  const quote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
  const real = (name: string) => quote(execFileSync("which", [name], { encoding: "utf8" }).trim());
  let launchPath = process.env.PATH;
  if (provider === "pi") {
    // Pi's cheap-model overlay arrives through a launcher shim, as native-composer.spec.ts does.
    const piHome = cheapModelEnv("pi", fixture).PI_CODING_AGENT_DIR!;
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "pi"), `#!/bin/sh\nexport PI_CODING_AGENT_DIR=${quote(piHome)}\nexec ${real("pi")} "$@"\n`, { mode: 0o700 });
    launchPath = `${bin}:${process.env.PATH}`;
  }
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  try {
    ({ core, log } = await startCore(fixture, provider, port, launchPath));
    await onboarding(page, fixture);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    const snapshot = await request(page, { type: "workspace.snapshot" }, "workspace.snapshot");
    const project = snapshot.projects.find((entry: { path: string }) => fs.realpathSync(entry.path) === fs.realpathSync(fixture));
    expect(project, "the fixture project is listed").toBeTruthy();
    const saved = await request(page, {
      type: "instructions.set", scope: "project", id: project.id,
      text: `The instruction marker word is ${instructionWord}.`,
      folders: [referenceFolder, "/perch-no-such-folder"],
    }, "instructions.state");
    expect(saved.error).toBeUndefined();
    expect(saved.revision).toBe(1);
    expect(saved.folders).toEqual([referenceFolder, "/perch-no-such-folder"]);

    await startFromPanel(page, { agent: provider, where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(provider === "codex" ? /OpenAI Codex/ : provider === "claude" ? /Claude Code/ : provider === "omp" ? /OMP|oh.my.pi|omp v/i : /pi v|pi \(|pi coding|pi update|pi\.dev|\.pi\/agent/i, { timeout: 30_000 });
    if (provider === "codex") {
      await expect(cli.locator(".xterm-rows")).toContainText(/Do you trust the contents|To get started/i, { timeout: 30_000 });
      if ((await cli.locator(".xterm-rows").innerText()).includes("Do you trust the contents")) await cli.locator(".xterm-helper-textarea").press("Enter");
    }
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(box).toBeEnabled();
    // Fail before the paid turn if the cheap-model pin did not take.
    await expect(ui.locator(".native-cli-chat__model")).toHaveText(expectedModel);

    // What was passed: the flags name a private file (Claude, Pi, OMP) or the app-server's argument (Codex),
    // and never replace the base prompt or hide the repository's own instructions.
    // The process is found by its content: a file-based flag must name a file holding this run's marker.
    const lines = execFileSync("ps", ["-axo", "command"], { encoding: "utf8" }).split("\n");
    const holdsMarker = (line: string) => {
      const file = line.match(/(\/\S*instructions\.(?:claude|pi|omp)\.md)/)?.[1];
      return file !== undefined && fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(instructionWord);
    };
    const ours = lines.find(provider === "codex" ? (line) => line.includes(`developer_instructions="The instruction marker word is ${instructionWord}.`) : holdsMarker);
    expect(ours, "a process launched with this run's Instructions").toBeTruthy();
    if (provider === "codex") {
      // The app-server carries the text and the folder list; the TUI refuses --add-dir against it.
      expect(ours).toContain(`- ${referenceFolder}`);
      expect(lines.some((line) => line.includes("--remote") && line.includes("--add-dir"))).toBe(false);
    } else if (provider === "claude") {
      expect(ours).toContain("--append-system-prompt-file");
      expect(ours).toContain(`--add-dir=${referenceFolder}`);
    } else if (provider === "omp") {
      expect(ours).toContain(`--add-dir=${referenceFolder}`);
    }
    for (const line of ours ? [ours] : []) {
      expect(line).not.toContain("--system-prompt ");
      expect(line).not.toContain("--no-context-files");
      expect(line).not.toContain("perch-no-such-folder");
    }

    await box.fill("Reply with exactly two words separated by one space and nothing else: the instruction marker word, then the repo marker word. Use no tools.");
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
    const reply = await ui.locator('[data-native-role="assistant"]').last().innerText();
    await testInfo.attach("reply", { body: reply, contentType: "text/plain" });
    expect(reply).toContain(instructionWord);
    expect(reply).toContain(repoWord);

    // The message's Copy button puts its text on the clipboard.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://127.0.0.1:${port}` });
    const assistant = ui.locator('[data-native-role="assistant"]').last();
    await assistant.hover();
    await assistant.getByTestId("copy-message").click();
    await expect(assistant.getByTestId("copy-message")).toHaveAttribute("aria-label", "Copied");
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe(reply.trim());

    // A later edit reaches new sessions only: this one keeps what it started with.
    const edited = await request(page, { type: "instructions.set", scope: "project", id: project.id, text: "Changed after launch.", folders: [] }, "instructions.state");
    expect(edited.revision).toBe(2);
  } catch (error) {
    await setChatMode(page, "cli").catch(() => {});
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable"), contentType: "text/plain" });
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    throw error;
  } finally {
    await stopCore(core, fixture, log);
    fs.rmSync(referenceFolder, { recursive: true, force: true });
  }
});

test("the Birdhouse menu opens Instructions, saves them and shows them again", async ({ page }, testInfo) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-instructions-ui-"));
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  try {
    ({ core, log } = await startCore(fixture, "claude", port));
    await onboarding(page, fixture);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    const row = page.locator('[data-testid^="workspace-project-"]', { hasText: path.basename(fixture) }).first();
    await row.hover();
    await row.click({ button: "right" });
    await page.locator('[data-testid^="workspace-project-instructions-"]').click();
    const dialog = page.getByTestId("instructions-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("instructions-text")).toBeEnabled();
    await page.getByTestId("instructions-text").fill("Prefer small commits.");
    await page.getByTestId("instructions-folders").fill("/tmp");
    await page.getByTestId("instructions-save").click();
    await expect(dialog).toBeHidden();
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-testid^="workspace-project-"]', { hasText: path.basename(fixture) }).first().click({ button: "right" });
    await page.locator('[data-testid^="workspace-project-instructions-"]').click();
    await expect(page.getByTestId("instructions-text")).toHaveValue("Prefer small commits.");
    await expect(page.getByTestId("instructions-folders")).toHaveValue("/tmp");
    // The core refuses what it cannot keep and says why.
    await page.getByTestId("instructions-folders").fill("relative/path");
    await page.getByTestId("instructions-save").click();
    await expect(page.getByTestId("instructions-error")).toContainText("not an absolute folder path");
  } catch (error) {
    await testInfo.attach("core.log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-4000), contentType: "text/plain" });
    throw error;
  } finally {
    await stopCore(core, fixture, log);
  }
});
