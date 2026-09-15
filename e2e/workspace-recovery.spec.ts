/**
 * V-09 mixed workspace and agent recovery.
 *
 * The already-recorded V-09 evidence covers each surface on its own: file
 * draft/path recovery, a real tmux shell across a core crash, and native
 * Claude/Pi/OMP/OpenCode same-PID recovery. What was never exercised is the
 * *mixed* case the gate actually names — sessions, terminals, comments, file
 * conflict state and project/worktree identity all surviving one restart
 * together.
 *
 * This boots its own core on a free port with its own database (the pattern in
 * workspace-terminals.spec.ts), so it never touches the shared hub instance or
 * the developer's ~/.perch state, then SIGKILLs it mid-flight and re-boots.
 *
 * Headless only. No real agent turn: the native per-provider recovery already
 * has its own dedicated evidence, and repeating it here would add a startup
 * dialog and a quota dependency to a structural test.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execSync, execFileSync, spawn, type ChildProcess } from "node:child_process";

const RELATIVE_FILE = "src/main.txt";

function git(args: string, cwd: string): void {
  execSync(`git ${args}`, {
    cwd,
    stdio: "pipe",
    // See worktrees.spec.ts: githooks middleware on this machine reads stdin.
    input: "",
    timeout: 15000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "perch e2e",
      GIT_AUTHOR_EMAIL: "e2e@perch.test",
      GIT_COMMITTER_NAME: "perch e2e",
      GIT_COMMITTER_EMAIL: "e2e@perch.test",
    },
  });
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

async function shellCommand(page: Page, text: string): Promise<void> {
  const input = page.locator(".terminal--persistent[data-pane-id]:visible .xterm-helper-textarea");
  await input.pressSequentially(text, { delay: 1 });
  await input.press("Enter");
}

test("mixed workspaces, sessions, terminal, draft conflict and comments recover after a core kill", async ({ page, context }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "perch-recovery-home-"));
  // macOS's temp dir is a symlink (/var → /private/var) and the server stores
  // canonical paths, so every testid keyed on the repo path must be canonical
  // too — same reason worktrees.spec.ts realpaths its fixture.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-recovery-repo-")));
  const filePath = path.join(repo, RELATIVE_FILE);
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(home, "hosts.json");
  const dbPath = path.join(home, "history.sqlite");
  let core: ChildProcess | null = null;
  let restarting = false;
  let terminalId: string | null = null;
  const errors: string[] = [];
  const coreLog: string[] = [];
  let shellPid = "";
  let originalTerminalId = "";

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(path.join(repo, "README.md"), "recovery fixture\n");
  fs.writeFileSync(filePath, "initial sentinel\n");
  fs.writeFileSync(hosts, JSON.stringify({ hosts: [] }));
  git("-c init.defaultBranch=main init -q", repo);
  git("add -A", repo);
  git('commit -q -m "initial"', repo);

  async function boot(): Promise<void> {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", dbPath, "--hosts-path", hosts, "--cwd", repo],
      { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect
      .poll(async () => {
        if (core?.exitCode !== null) throw new Error("fixture core exited before readiness");
        try {
          return (await fetch(url)).ok;
        } catch {
          return false;
        }
      }, { timeout: 20_000 })
      .toBe(true);
  }

  async function stop(): Promise<void> {
    if (!core || core.exitCode !== null || core.signalCode !== null) return;
    const child = core;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGKILL");
    });
    core = null;
  }

  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  page.on("pageerror", (error) => errors.push(error.message + "\n" + (error.stack ?? "")));
  page.on("console", (message) => {
    // WebKit reports the socket severed by our deliberate SIGKILL as a
    // console error. Keep every application error, including React warnings.
    if (restarting && message.text().startsWith(`WebSocket connection to 'ws://127.0.0.1:${port}/ws' failed:`)) return;
    // With the host down, the client's pairing probe (`pairing.ts`, which is
    // how it tells "not paired" from "host unreachable") also fails, and
    // Chromium logs every failed fetch. Same deliberate-disconnect noise.
    if (restarting && message.text().includes("ERR_CONNECTION_REFUSED")) return;
    if (message.type() === "error") errors.push("console: " + message.text().slice(0, 2000));
  });
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "terminal.opened") terminalId = message.terminal.id;
    }),
  );

  try {
    await boot();
    await page.goto(url, { waitUntil: "networkidle" });

    // --- build the mixed state -------------------------------------------
    // 1. Project + a second workspace from a real git worktree.
    await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(repo);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    const project = page.locator(".workspace-project").filter({ hasText: path.basename(repo) });
    await expect(project).toBeVisible({ timeout: 15000 });

    const worktreeButton = page.locator(`[data-testid="worktree-menu-local-${repo}"]`).first();
    await expect(worktreeButton).toBeVisible({ timeout: 20000 });
    await worktreeButton.click();
    const popover = page.locator(`[data-testid="worktree-popover-local-${repo}"]`);
    await expect(popover).toBeVisible({ timeout: 5000 });
    await popover.getByTestId("worktree-new").click();
    await popover.getByTestId("worktree-branch-input").fill("wt-recover");
    await popover.getByTestId("worktree-create-submit").click();
    const worktreeEntry = popover
      .locator(".worktree-menu__entry")
      .filter({ has: page.locator(".worktree-menu__entry-branch", { hasText: "wt-recover" }) });
    await expect(worktreeEntry).toBeVisible({ timeout: 30000 });
    const worktreePath = ((await worktreeEntry.locator(".worktree-menu__entry-path").textContent()) ?? "").trim();
    expect(worktreePath).toBeTruthy();

    // 2. A session that lives in the linked checkout.
    await worktreeEntry.locator('[data-testid^="worktree-open-"]').click();
    await expect(popover).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".status-item--cwd")).toHaveText(worktreePath, { timeout: 20000 });
    const worktreeSession = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(worktreeSession).toBeTruthy();

    // 3. A persistent shell terminal with observable process state.
    await page.getByRole("button", { name: "Open terminal", exact: true }).click();
    const shell = page.locator(".terminal--persistent[data-pane-id]:visible");
    await expect(shell).toHaveAttribute("data-terminal-id", /.+/, { timeout: 20000 });
    await shellCommand(page, `PERCH_MIX=survived; printf 'before_%s_PID_%s_END\\n' "$PERCH_MIX" "$$"`);
    await expect(shell.locator(".xterm-rows")).toContainText(/before_survived_PID_\d+_END/, { timeout: 20000 });
    shellPid = (await shell.locator(".xterm-rows").innerText()).match(/before_survived_PID_(\d+)_END/)![1];
    originalTerminalId = (await shell.getAttribute("data-terminal-id"))!;

    // 4. An unsaved editor draft on the primary checkout, then an external
    //    write so the buffer is in the conflict state at kill time.
    const primaryEntry = project.locator(".workspace-entry").filter({ hasText: "main" }).first();
    const filesButton = primaryEntry.locator('[data-testid^="workspace-files-"]');
    await expect(filesButton).toBeVisible({ timeout: 15000 });
    const primaryWorkspaceId = (await filesButton.getAttribute("data-testid"))!.slice("workspace-files-".length);
    await filesButton.click();
    await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-file-entry-src").click();
    await page.getByTestId(`workspace-file-entry-${RELATIVE_FILE}`).click();
    const editor = page.getByTestId("workspace-file-editor");
    await expect(editor).toHaveValue("initial sentinel\n", { timeout: 15000 });
    await editor.fill("draft that must survive the kill\n");
    await page.waitForTimeout(1200); // let the durable-buffer debounce settle
    fs.writeFileSync(filePath, "external sentinel\n");
    await expect(page.getByTestId("workspace-file-conflict")).toBeVisible({ timeout: 15000 });

    // 5. An anchored review comment on the same workspace.
    await primaryEntry.locator('[data-testid^="workspace-git-"]').click();
    await expect(page.getByTestId("workspace-git-review")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("git-refresh").click();
    const diffLine = page
      .locator('[data-testid="git-diff-line"][data-side="new"]')
      .filter({ hasText: "external sentinel" })
      .first();
    await expect(diffLine).toBeVisible({ timeout: 20000 });
    await diffLine.getByTestId("git-comment-add").click();
    await expect(page.getByTestId("git-comment-composer")).toBeVisible({ timeout: 5000 });
    const commentBody = "note that must survive the kill";
    await page.getByTestId("git-comment-body").fill(commentBody);
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    await expect(page.locator(".workspace-git__comment").filter({ hasText: commentBody })).toBeVisible({ timeout: 15000 });
    const paneIds = await page.locator('[data-testid^="pane-tab-"]').evaluateAll((tabs) =>
      tabs.map((tab) => tab.getAttribute("data-testid")).sort());
    await page.screenshot({ path: testInfo.outputPath("recovery-before-kill.png"), fullPage: true });

    // --- kill and recover -------------------------------------------------
    restarting = true;
    await stop();
    // Exercise the disconnected fallback before restoring the client. Its
    // derived project selector previously returned an uncached object and
    // crashed React while sessionId was null but listed sessions remained.
    await expect(page.getByTestId("no-session-panel")).toContainText("Connecting");
    expect(errors, "disconnected page must not raise React errors").toEqual([]);
    await boot();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 25000 });
    restarting = false;
    expect(errors, "recovered page must not raise React errors").toEqual([]);

    // Project/worktree identity: still ONE project, still both checkouts.
    const recoveredProject = page.locator(".workspace-project").filter({ hasText: path.basename(repo) });
    await expect(recoveredProject).toHaveCount(1, { timeout: 20000 });
    await expect(recoveredProject.locator(".workspace-entry").filter({ hasText: "wt-recover" })).toHaveCount(1, { timeout: 20000 });
    await expect(recoveredProject.locator(".workspace-entry").filter({ hasText: "main" })).not.toHaveCount(0);

    // Session identity survives the restart.
    expect(await page.evaluate(() => localStorage.getItem("perch.sessionId"))).toBe(worktreeSession);

    // Terminal: same id, same underlying process.
    const recoveredShell = page.locator(".terminal--persistent[data-pane-id]:visible");
    await expect(recoveredShell).toHaveAttribute("data-terminal-id", originalTerminalId, { timeout: 25_000 });
    await expect.poll(() => page.locator('[data-testid^="pane-tab-"]').evaluateAll((tabs) =>
      tabs.map((tab) => tab.getAttribute("data-testid")).sort())).toEqual(paneIds);
    await shellCommand(page, `printf 'after_%s_PID_%s_END\\n' "$PERCH_MIX" "$$"`);
    await expect(recoveredShell.locator(".xterm-rows")).toContainText(`after_survived_PID_${shellPid}_END`, { timeout: 20000 });

    // File draft and its conflict state are both durable.
    await recoveredProject
      .locator(`[data-testid="workspace-files-${primaryWorkspaceId}"]`)
      .click();
    await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 20000 });
    const recoveredEditor = page.getByTestId("workspace-file-editor");
    await expect(recoveredEditor).toHaveValue("draft that must survive the kill\n", { timeout: 25000 });
    await expect(page.getByTestId("workspace-file-conflict")).toBeVisible({ timeout: 20000 });

    // The anchored comment is still on the review list.
    await recoveredProject.locator(`[data-testid="workspace-git-${primaryWorkspaceId}"]`).click();
    await expect(page.getByTestId("workspace-git-review")).toBeVisible({ timeout: 20000 });
    expect(errors, "recovered page must not raise React errors").toEqual([]);
    // A recovered comment renders inline when its anchor still resolves against
    // the current source, and drops to the review list when it does not — accept
    // either, since V-09 only asks that the note survived.
    await expect(
      page.locator(".workspace-git__comment").filter({ hasText: commentBody }),
    ).toBeVisible({ timeout: 25000 });

    await page.screenshot({ path: testInfo.outputPath("recovery-after-restart.png"), fullPage: true });
    expect(errors).toEqual([]);
  } catch (error) {
    // The fixture core's own log is the only place a server-side cause would
    // show up; stdio is piped purely so a failure can print it.
    console.log("fixture core log >>>\n" + coreLog.join("").slice(-2000));
    throw error;
  } finally {
    await stop();
    // A worktree launcher also starts its configured CLI. Reap every tmux
    // process this isolated core actually launched, not only the plain shell.
    const ownedTmux = new Set([...coreLog.join("").matchAll(/tmux_session=(perch-cli-\S+)/g)].map((match) => match[1]));
    if (terminalId) ownedTmux.add(`perch-cli-shell-${terminalId}`);
    for (const name of ownedTmux) {
      try {
        execFileSync("tmux", ["kill-session", "-t", name], { stdio: "ignore" });
      } catch {
        /* already gone */
      }
    }
    try {
      git("worktree prune", repo);
    } catch {
      /* fixture may already be gone */
    }
    fs.rmSync(path.join(os.homedir(), ".perch", "worktrees", path.basename(repo)), { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
