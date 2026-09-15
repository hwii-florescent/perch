/**
 * V-10 secure pairing and phone-sized remote operation.
 *
 * perch's host binds `0.0.0.0`, so "the phone" here is a real second origin:
 * the browser context loads perch over the machine's LAN address while the
 * host's own window uses loopback. That is what makes the gate meaningful —
 * loopback is exempt by design, everything else needs a token issued by
 * `devices.rs` — and it is why the phone context has its own cookie jar.
 *
 * The run covers what SPEC.md V-10 names: pair, see status, switch to the
 * agent view, send a prompt, read scrollback back after a reload, open the
 * file tree and the Git surface, survive a host restart, and lose access again
 * when the device is revoked.
 *
 * The agent is a `/bin/sh` fixture provider (the `provider-config.spec.ts`
 * pattern) so the phone drives a real pty without spending model quota.
 *
 * Boots its own core with its own database, hosts and devices files. Headless.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";

const AGENT_SCRIPT = [
  "printf 'phonebot ready\\n'",
  "while IFS= read -r line; do",
  "  printf 'phonebot_reply %s\\n' \"$line\"",
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

/** A real non-loopback address for this machine, or null if it has none. */
function lanAddress(): string | null {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

test("a phone pairs over the network, drives the session, and loses access when revoked", async ({ page, context, browser }, testInfo) => {
  const lan = lanAddress();
  // Recorded rather than silently passed: without a second address there is no
  // honest way to exercise a gate whose whole job is to tell them apart.
  test.skip(!lan, "no non-loopback IPv4 address on this machine");

  const root = path.resolve(__dirname, "..");
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-pairing-")));
  const repo = path.join(fixture, "repo");
  const port = await freePort();
  const hostUrl = `http://127.0.0.1:${port}`;
  const phoneUrl = `http://${lan}:${port}`;
  const coreLog: string[] = [];
  let core: ChildProcess | null = null;

  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "main.txt"), "committed line\n");
  git("-c init.defaultBranch=main init -q", repo);
  git("add -A", repo);
  git('commit -q -m "initial"', repo);
  fs.writeFileSync(path.join(repo, "src", "main.txt"), "PHONE_SEES_THIS\n");
  fs.writeFileSync(path.join(fixture, "hosts.json"), JSON.stringify({ hosts: [] }));
  fs.writeFileSync(path.join(fixture, "providers.json"), JSON.stringify({
    version: 1,
    providers: [{
      id: "phonebot",
      display_name: "Phonebot",
      launch: { executable: "/bin/sh", prefix_args: ["-c", AGENT_SCRIPT], prompt: "stdin", suffix_args: [], resume: "Unsupported" },
      supported_modes: ["cli"],
      resumability: "persistentProcess",
      capabilities: ["interactiveTerminal"],
      status_detection: "ExitStatus",
      environment: { inherit: true, allow: [], set: {}, unset: [] },
    }],
  }));

  const devicesPath = path.join(fixture, "devices.json");
  async function boot(): Promise<void> {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json"), "--devices-path", devicesPath, "--cwd", repo],
      { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(`fixture core exited: ${coreLog.join("")}`);
      try { return (await fetch(hostUrl)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
  }
  async function stop(): Promise<void> {
    if (!core || core.exitCode !== null) return;
    const child = core;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGKILL");
    });
    core = null;
  }

  // The phone is a phone-sized context with its own storage and cookie jar,
  // pointed at the LAN origin.
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await phoneContext.addInitScript((directory) => {
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
    // The agent (and therefore the workspace the Git pane opens) must land in
    // the repository, not the fixture root that contains it.
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory as string);
  }, repo);
  // The suite's shared storageState only covers the hub's origin, and this
  // core runs on its own port, so the host window needs the same seed.
  await context.addInitScript(() => {
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
  });
  const phone = await phoneContext.newPage();
  const phoneErrors: string[] = [];
  phone.on("pageerror", (error) => phoneErrors.push(error.message));

  try {
    await boot();

    // 1. Unpaired: the phone gets the pairing gate, not the app.
    await phone.goto(phoneUrl, { waitUntil: "domcontentloaded" });
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 20_000 });
    await expect(phone.getByTestId("workspace-overview")).toHaveCount(0);
    await phone.screenshot({ path: testInfo.outputPath("pairing-gate-phone.png"), fullPage: true });

    // A wrong code is refused, and no data route opens for it.
    await phone.getByTestId("pairing-code").fill("22222222");
    await phone.getByTestId("pairing-submit").click();
    await expect(phone.getByTestId("pairing-error")).toContainText(/not valid|no pairing/i, { timeout: 10_000 });

    // 2. The host issues a code from Settings → Devices.
    await page.goto(hostUrl, { waitUntil: "networkidle" });
    await page.getByTestId("settings-gear").click();
    const devices = page.getByTestId("settings-devices");
    await expect(devices).toBeVisible({ timeout: 10_000 });
    await devices.getByTestId("pair-start").click();
    const code = ((await page.getByTestId("pair-code").locator("strong").textContent()) ?? "").trim();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);

    // 3. The phone pairs and the app appears.
    await phone.getByTestId("pairing-code").fill(code);
    await phone.getByTestId("pairing-name").fill("e2e phone");
    await phone.getByTestId("pairing-submit").click();
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0, { timeout: 20_000 });
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 20_000 });

    // The host sees the paired device by name.
    await expect(page.getByTestId("paired-devices")).toContainText("e2e phone", { timeout: 15_000 });
    await page.keyboard.press("Escape");

    // 4. The phone drives a real agent: start it, prompt it, read the reply.
    const toggle = phone.getByTestId("session-mode-toggle");
    await expect(toggle).toBeEnabled({ timeout: 20_000 });
    await phone.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    await phone.getByTestId("cli-start-agent-phonebot").click();
    await phone.getByTestId("cli-start-browse").click();
    await phone.getByRole("button", { name: "Use this folder", exact: true }).click();
    const terminal = phone.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(terminal.locator(".xterm-rows")).toContainText("phonebot ready", { timeout: 30_000 });
    const input = terminal.locator(".xterm-helper-textarea");
    await input.pressSequentially("from-the-phone", { delay: 10 });
    await input.press("Enter");
    await expect(terminal.locator(".xterm-rows")).toContainText("phonebot_reply from-the-phone", { timeout: 30_000 });
    await phone.screenshot({ path: testInfo.outputPath("pairing-phone-agent.png"), fullPage: true });

    // 5. Scrollback survives a reload on the phone.
    await phone.reload({ waitUntil: "networkidle" });
    await expect(phone.getByTestId("persistent-agent-terminal").locator(".xterm-rows"))
      .toContainText("phonebot_reply from-the-phone", { timeout: 30_000 });

    // 6. Files and Git from the phone-sized surface.
    await phone.getByTestId("mobile-switch").click();
    const switcher = phone.getByTestId("mobile-switcher");
    const gitButton = switcher.locator('[data-testid^="workspace-git-"]').first();
    await expect(gitButton).toBeVisible({ timeout: 20_000 });
    const workspaceId = (await gitButton.getAttribute("data-testid"))!.slice("workspace-git-".length);
    await gitButton.click();
    await expect(phone.getByTestId("git-diff")).toContainText("PHONE_SEES_THIS", { timeout: 20_000 });
    // This workspace was never registered by hand — the session minted it —
    // so it also covers the implicit creation ref: the server records HEAD for
    // a freshly created workspace, and "Workspace start" is therefore usable.
    await expect(phone.getByTestId("git-diff-target").locator('option[value="workspaceStart"]'))
      .toHaveText("Workspace start");
    await phone.getByTestId("mobile-switch").click();
    await phone.getByTestId("mobile-switcher").locator(`[data-testid="workspace-files-${workspaceId}"]`).click();
    await expect(phone.getByTestId("workspace-files-view")).toBeVisible({ timeout: 20_000 });
    await expect(phone.getByTestId("workspace-file-entry-src")).toBeVisible({ timeout: 20_000 });
    await phone.screenshot({ path: testInfo.outputPath("pairing-phone-files.png"), fullPage: true });

    // 7. The host restarts; the phone reconnects on its stored token alone.
    await stop();
    await boot();
    await phone.reload({ waitUntil: "networkidle" });
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0, { timeout: 30_000 });
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 30_000 });

    // 8. Revoking from the host takes the access back.
    await page.goto(hostUrl, { waitUntil: "networkidle" });
    await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("paired-devices")).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid^="device-revoke-"]').first().click();
    await expect(page.getByTestId("paired-devices")).toHaveCount(0, { timeout: 10_000 });
    expect(JSON.parse(fs.readFileSync(devicesPath, "utf8")).devices).toEqual([]);
    await phone.reload({ waitUntil: "domcontentloaded" });
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 30_000 });

    expect(phoneErrors).toEqual([]);
  } finally {
    fs.writeFileSync(testInfo.outputPath("core.log"), coreLog.join(""));
    await stop();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
