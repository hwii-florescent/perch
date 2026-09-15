/**
 * V-07 last-agent-turn review.
 *
 * The gate asks for "the current agent's last-turn changes" as a reviewable
 * diff base. The boundary is recorded by the server whenever a session moves
 * running -> idle (see `server/agent_history.rs`), so this drives a real CLI
 * agent turn in a real repository and then reviews it from the Git surface.
 *
 * The agent is a fixture provider (the pattern in provider-config.spec.ts): a
 * `/bin/sh` loop that edits a tracked file and creates an untracked one per
 * prompt. A real provider would add a quota dependency and a nondeterministic
 * edit to a test whose subject is the boundary, not the model. What is real
 * here is everything the boundary depends on: a pty-owned CLI process, the
 * running/idle transitions it produces, Git, SQLite, and the browser.
 *
 * Boots its own core on a free port with its own database, so it never
 * touches the shared hub or ~/.perch. Headless only.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";

const RELATIVE_FILE = "src/main.txt";
const BASE_TEXT = "BEFORE_TURN";

/** The fixture agent: one edit plus one new file per prompt line. */
const AGENT_SCRIPT = [
  "printf 'turnbot ready\\n'",
  "while IFS= read -r line; do",
  "  printf 'AGENT_EDIT %s\\n' \"$line\" > src/main.txt",
  "  printf 'AGENT_NEW %s\\n' \"$line\" > agent_new.txt",
  "  printf 'turnbot_done %s\\n' \"$line\"",
  "done",
].join("\n");

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

test("a real CLI agent turn becomes a reviewable diff base", async ({ page, context }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "perch-turn-home-"));
  // macOS /var -> /private/var: the server stores canonical paths, so every
  // path-keyed testid has to be canonical too.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-turn-repo-")));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(home, "hosts.json");
  const providers = path.join(home, "providers.json");
  const coreLog: string[] = [];
  const errors: string[] = [];
  let core: ChildProcess | null = null;

  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, RELATIVE_FILE), `${BASE_TEXT}\n`);
  // Two more tracked files so the rename and delete states SPEC.md V-07 names
  // can be exercised against a real index rather than asserted in the abstract.
  fs.writeFileSync(path.join(repo, "to_rename.txt"), "RENAME_ME\n");
  fs.writeFileSync(path.join(repo, "to_delete.txt"), "DELETE_ME\n");
  git("-c init.defaultBranch=main init -q", repo);
  git("add -A", repo);
  git('commit -q -m "initial"', repo);
  fs.writeFileSync(hosts, JSON.stringify({ hosts: [] }));
  fs.writeFileSync(providers, JSON.stringify({
    version: 1,
    providers: [{
      id: "turnbot",
      display_name: "Turnbot",
      launch: { executable: "/bin/sh", prefix_args: ["-c", AGENT_SCRIPT], prompt: "stdin", suffix_args: [], resume: "Unsupported" },
      supported_modes: ["cli"],
      resumability: "persistentProcess",
      capabilities: ["interactiveTerminal"],
      status_detection: "ExitStatus",
      environment: { inherit: true, allow: [], set: {}, unset: [] },
    }],
  }));

  await context.addInitScript((directory) => {
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory as string);
  }, repo);
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", path.join(home, "history.sqlite"), "--hosts-path", hosts, "--providers-path", providers, "--cwd", repo],
      { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", RUST_LOG: process.env.RUST_LOG ?? "warn" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(`fixture core exited: ${coreLog.join("")}`);
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);

    await page.goto(url, { waitUntil: "networkidle" });

    // 1. A durable project, so the session's workspace owns the turn history.
    await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(repo);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    const project = page.locator(".workspace-project").filter({ hasText: path.basename(repo) });
    await expect(project).toBeVisible({ timeout: 15000 });
    const gitButton = project.locator('[data-testid^="workspace-git-"]').first();
    await expect(gitButton).toBeVisible({ timeout: 15000 });
    const workspaceId = (await gitButton.getAttribute("data-testid"))!.slice("workspace-git-".length);

    // 2. A real CLI agent process in that repository.
    const mode = page.getByTestId("session-mode-toggle");
    await expect(mode).toBeEnabled({ timeout: 15000 });
    await page.getByTestId("session-mode-scope").selectOption("device");
    if (await mode.getAttribute("aria-checked") !== "true") await mode.click();
    await page.getByTestId("cli-start-agent-turnbot").click();
    await page.getByTestId("cli-start-browse").click();
    await page.getByRole("button", { name: "Use this folder", exact: true }).click();
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(terminal.locator(".xterm-rows")).toContainText("turnbot ready", { timeout: 30_000 });

    // 3. One turn: the agent edits a tracked file and adds an untracked one.
    //    The idle sweep closes the boundary ~700ms after the output stops.
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially("alpha", { delay: 10 });
    await input.press("Enter");
    await expect(terminal.locator(".xterm-rows")).toContainText("turnbot_done alpha", { timeout: 30_000 });
    await expect.poll(() => fs.readFileSync(path.join(repo, RELATIVE_FILE), "utf8"), { timeout: 15_000 })
      .toContain("AGENT_EDIT alpha");

    // 4. Open the Git surface and wait for the server to close the boundary.
    await project.locator(`[data-testid="workspace-git-${workspaceId}"]`).click();
    await expect(page.getByTestId("workspace-git-review")).toBeVisible({ timeout: 15000 });
    const selector = page.getByTestId("git-diff-target");
    const diff = page.getByTestId("git-diff");
    const option = selector.locator('option[value="lastAgentTurn"]');
    await expect.poll(async () => {
      await page.getByTestId("git-refresh").click();
      await page.waitForTimeout(400);
      return (await option.textContent()) ?? "";
    }, { timeout: 30_000 }).toBe("Last agent turn (turnbot)");
    await expect(option).not.toHaveAttribute("disabled", /.*/);

    // 5. A human edit *after* the recorded turn, which its diff must not claim.
    fs.writeFileSync(path.join(repo, "human_after_turn.txt"), "HUMAN_AFTER_TURN\n");
    await page.getByTestId("git-refresh").click();

    await selector.selectOption("lastAgentTurn");
    await expect(diff).toContainText("AGENT_EDIT alpha", { timeout: 15000 });
    // The summary answers "whose turn, how much" — a diff alone does not.
    await expect(page.getByTestId("git-turn-summary")).toContainText(/turnbot changed \d+ paths?/);
    await expect(diff).toContainText(BASE_TEXT);
    await expect(diff).toContainText("AGENT_NEW alpha");
    // Pinned to the turn, not to "whatever is dirty now".
    await expect(diff).not.toContainText("HUMAN_AFTER_TURN");
    await page.screenshot({ path: testInfo.outputPath("agent-turn-desktop.png"), fullPage: true });

    // 6. The remaining V-07 states, against the same real repository: a
    //    rename, a delete, and the empty comparison.
    git("mv to_rename.txt renamed.txt", repo);
    git("rm -q to_delete.txt", repo);
    await page.getByTestId("git-refresh").click();
    await selector.selectOption("head");
    const files = page.locator('[data-testid="git-diff-file"]');
    await expect(files.filter({ hasText: "renamed.txt" })).toContainText(/renamed|added/i, { timeout: 20000 });
    await expect(files.filter({ hasText: "to_delete.txt" })).toContainText(/deleted/i);
    await expect(page.getByTestId("git-status")).toContainText("to_delete.txt");
    // Staged-only comparison after committing the staged rename/delete: the
    // index matches HEAD, so the surface must say so rather than render blank.
    git('-c core.hooksPath=/dev/null commit -q -m "rename and delete"', repo);
    await page.getByTestId("git-refresh").click();
    await selector.selectOption("staged");
    await expect(page.getByTestId("git-diff-empty")).toBeVisible({ timeout: 20000 });

    // 7. Durable: the boundary survives a reload, and the working tree base
    //    still reports the human edit the turn correctly excluded.
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(`[data-testid="workspace-git-${workspaceId}"]`).first().click();
    await expect(page.getByTestId("workspace-git-review")).toBeVisible({ timeout: 15000 });
    await selector.selectOption("lastAgentTurn");
    await expect(diff).toContainText("AGENT_EDIT alpha", { timeout: 15000 });
    await selector.selectOption("workingTree");
    await expect(diff).toContainText("HUMAN_AFTER_TURN", { timeout: 15000 });

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
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
