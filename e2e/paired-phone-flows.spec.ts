/**
 * V-10 remaining phone flows: Chat/UI ↔ CLI and the review-note packet, both
 * performed by a *paired* phone at a second origin.
 *
 * `device-pairing.spec.ts` already covers pair, status, prompt, scrollback,
 * file tree, diff, host restart and revocation. Two items SPEC.md V-10 names
 * were not covered there, and neither can be:
 *
 * - **Chat/UI ↔ CLI.** Native UI is a per-provider bridge (Claude hooks and
 *   transcripts, Pi/OMP extension sockets, the codex app-server). A `/bin/sh`
 *   fixture cannot speak any of them, so that spec's `phonebot` only ever has
 *   a CLI mode to be in.
 * - **The review note.** `server/session.rs::resolve_review_target` refuses a
 *   provider without native review controls, so a fixture provider cannot be
 *   the target of a packet.
 *
 * So this runs a real Claude CLI, pinned to the cheapest model by
 * `cheapModel.ts`, and asserts the model chip **before** either of its two
 * turns — an unexpected model stops the run rather than spending quota.
 * Two real turns total: one UI prompt and one review packet.
 *
 * Boots its own core with its own database, hosts and devices files, and
 * skips with a recorded reason if this machine has no non-loopback IPv4.
 * Headless.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execFileSync, execSync, spawn, type ChildProcess } from "node:child_process";
import { cheapModelEnv } from "./cheapModel";

const RUN_ID = Math.random().toString(36).slice(2, 8);
const WORKTREE_TEXT = `PHONE_REVIEWS_THIS_${RUN_ID}`;

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

/** Clear Claude's first-run folder-trust dialog if this launch shows one. */
async function clearTrustPrompt(terminal: ReturnType<Page["getByTestId"]>): Promise<void> {
  const rows = terminal.locator(".xterm-rows");
  await expect(rows).toContainText(/Yes, I trust this folder|bypass permissions on/, { timeout: 40_000 });
  for (let attempt = 0; attempt < 3 && (await rows.innerText()).includes("Yes, I trust this folder"); attempt++) {
    // This is the exact temporary repository created below by this test.
    const input = terminal.locator(".xterm-helper-textarea");
    await input.press("ArrowDown");
    await expect(rows).toContainText(/❯\s*Yes, I trust this folder/);
    await input.press("Enter");
    await expect(rows).toContainText(/❯\s*No, exit|bypass permissions on/, { timeout: 15_000 });
  }
  await expect(rows).toContainText("bypass permissions on", { timeout: 40_000 });
}

test("a paired phone switches Chat/UI ↔ CLI and sends a review packet from the diff", async ({ page, context, browser }, testInfo) => {
  const lan = lanAddress();
  // Recorded rather than silently passed: without a second address there is no
  // honest way to exercise a gate whose whole job is to tell them apart.
  test.skip(!lan, "no non-loopback IPv4 address on this machine");
  test.setTimeout(300_000);

  const root = path.resolve(__dirname, "..");
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-phone-flows-")));
  // Uniquely named: the core also registers the checkout it was launched
  // from, so a generic name makes the switcher's project card ambiguous.
  const repoName = `phonerepo-${RUN_ID}`;
  const repo = path.join(fixture, repoName);
  const port = await freePort();
  const hostUrl = `http://127.0.0.1:${port}`;
  const phoneUrl = `http://${lan}:${port}`;
  const devicesPath = path.join(fixture, "devices.json");
  const coreLog: string[] = [];
  let core: ChildProcess | null = null;

  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "main.txt"), "committed line\n");
  git("-c init.defaultBranch=main init -q", repo);
  git("add -A", repo);
  git('commit -q -m "initial"', repo);
  // An uncommitted change the phone can anchor its notes to.
  fs.writeFileSync(path.join(repo, "src", "main.txt"), `${WORKTREE_TEXT}\n`);
  fs.writeFileSync(path.join(fixture, "hosts.json"), JSON.stringify({ hosts: [] }));
  // Claude is a built-in provider; this file only has to exist and be valid.
  fs.writeFileSync(path.join(fixture, "providers.json"), JSON.stringify({ version: 1, providers: [] }));

  async function boot(): Promise<void> {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json"), "--devices-path", devicesPath, "--cwd", repo],
      { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1", RUST_LOG: process.env.RUST_LOG ?? "info", ...cheapModelEnv("claude", fixture) }, stdio: ["ignore", "pipe", "pipe"] },
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

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await phoneContext.addInitScript((directory) => {
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory as string);
  }, repo);
  await context.addInitScript(() => {
    if (location.protocol !== "http:") return;
    localStorage.setItem("perch.onboarding.seen", "1");
  });
  const phone = await phoneContext.newPage();
  const phoneErrors: string[] = [];
  const wire: Array<Record<string, unknown>> = [];
  const snapshots: Array<{ messages?: Array<{ role: string; text: string }> }> = [];
  phone.on("pageerror", (error) => phoneErrors.push(error.message));
  phone.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const frame = JSON.parse(String(payload));
      if (frame.type === "review.batch.send") wire.push({ sent: frame.type, packetId: frame.packetId, sendOperationId: frame.sendOperationId });
    });
    socket.on("framereceived", ({ payload }) => {
      const frame = JSON.parse(String(payload));
      if (frame.type === "agent.ui.snapshot") snapshots.push(frame.snapshot);
      if (String(frame.type).startsWith("review.batch")) wire.push({ received: frame.type, delivery: frame.delivery, state: frame.state });
      if (frame.type === "error") wire.push({ error: frame.message, code: frame.code });
    });
  });

  const ui = phone.getByTestId("native-cli-chat");
  const cli = phone.getByTestId("persistent-agent-terminal");
  const toggle = phone.getByTestId("session-mode-toggle");

  try {
    await boot();

    // 1. Pair the phone, exactly as device-pairing.spec.ts does.
    await phone.goto(phoneUrl, { waitUntil: "domcontentloaded" });
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 20_000 });
    await page.goto(hostUrl, { waitUntil: "networkidle" });

    // The host registers the project explicitly, the way a user opens one.
    // Starting a CLI in a folder alone does not put a project card in the
    // phone's switcher, and the core also registers its own checkout, so
    // without this the phone's Git pane opens the wrong repository.
    await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(repo);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    await expect(page.locator(".workspace-project").filter({ hasText: repoName })).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("settings-gear").click();
    const devices = page.getByTestId("settings-devices");
    await expect(devices).toBeVisible({ timeout: 10_000 });
    await devices.getByTestId("pair-start").click();
    const code = ((await page.getByTestId("pair-code").locator("strong").textContent()) ?? "").trim();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    await phone.getByTestId("pairing-code").fill(code);
    await phone.getByTestId("pairing-name").fill("e2e review phone");
    await phone.getByTestId("pairing-submit").click();
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0, { timeout: 20_000 });
    await expect(phone.getByTestId("mobile-header")).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("Escape");

    // 2. The phone starts a real Claude CLI in the repository.
    await expect(toggle).toBeEnabled({ timeout: 20_000 });
    await phone.getByTestId("session-mode-scope").selectOption("device");
    if (await toggle.getAttribute("aria-checked") !== "true") await toggle.click();
    await phone.getByTestId("cli-start-agent-claude").click();
    await phone.getByTestId("cli-start-browse").click();
    await phone.getByRole("button", { name: "Use this folder", exact: true }).click();
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 40_000 });
    const terminalId = await cli.getAttribute("data-terminal-id");
    await expect(cli.locator(".xterm-rows")).toContainText("Claude Code", { timeout: 40_000 });
    await clearTrustPrompt(cli);

    // 3. CLI → Chat/UI on the phone, for the *same* session.
    await phone.getByTestId("session-mode-scope").selectOption("session");
    await toggle.click();
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 40_000 });
    await expect(ui.getByTestId("native-cli-composer")).toBeEnabled({ timeout: 20_000 });
    // Stop here, before any real turn, if the cheap-model pin did not take.
    await expect(ui.locator(".native-cli-chat__model")).toContainText("haiku");
    const nativePid = await ui.getAttribute("data-native-pid");
    expect(nativePid).toBeTruthy();
    await phone.screenshot({ path: testInfo.outputPath("phone-ui-mode.png"), fullPage: true });

    // 4. One real turn from the phone's UI mode (turn 1 of 2).
    const token = `PHONE_UI_${RUN_ID}`;
    await ui.getByTestId("native-cli-composer").fill(`Reply with exactly ${token}. Do not use tools or modify files.`);
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(token, { timeout: 120_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 30_000 });

    // 5. Back to CLI: same terminal, same conversation, no second process.
    await toggle.click();
    await expect(cli).toHaveAttribute("data-terminal-id", terminalId!);
    await expect(cli.locator(".xterm-rows")).toContainText(token, { timeout: 30_000 });
    await toggle.click();
    await expect(ui).toHaveAttribute("data-native-pid", nativePid!, { timeout: 30_000 });
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1);
    const sessionId = await phone.evaluate(() => localStorage.getItem("perch.sessionId"));
    expect(sessionId).toBeTruthy();

    // 6. The Git surface from the phone, and two anchored notes on real lines.
    await phone.getByTestId("mobile-switch").click();
    const switcher = phone.getByTestId("mobile-switcher");
    const project = switcher.locator(".workspace-project").filter({ hasText: repoName });
    await expect(project).toBeVisible({ timeout: 20_000 });
    const gitButton = project.locator('[data-testid^="workspace-git-"]').first();
    await expect(gitButton).toBeVisible({ timeout: 20_000 });
    await gitButton.click();
    await expect(phone.getByTestId("git-diff")).toContainText(WORKTREE_TEXT, { timeout: 30_000 });
    const firstNote = `Keep the sentinel readable ${RUN_ID}`;
    const secondNote = `And explain the committed line ${RUN_ID}`;
    await addComment(phone, WORKTREE_TEXT, "new", firstNote);
    await addComment(phone, "committed line", "old", secondNote);

    // 7. One packet to the session the phone is already driving (turn 2 of 2).
    const receipt = `PHONE_REVIEW_OK_${RUN_ID}`;
    await phone.getByLabel("Send to agent session").selectOption(sessionId!);
    await phone.getByLabel("Request", { exact: true }).fill(`Do not modify files or use tools. If this packet includes both notes, reply with exactly ${receipt}.`);
    await phone.getByTestId("git-review-preview").click();
    const packet = phone.getByTestId("git-review-packet");
    await expect(packet).toContainText("2 anchored notes", { timeout: 20_000 });
    await expect(packet).toContainText(firstNote);
    await expect(packet).toContainText(secondNote);
    await phone.screenshot({ path: testInfo.outputPath("phone-review-packet.png"), fullPage: true });
    await phone.getByTestId("git-review-send").click();
    // `unconfirmed` is a real transient: the row is settled before the write
    // and only becomes `delivered` once the CLI reports the submission back.
    const delivery = phone.getByTestId("git-review-delivery");
    await expect(delivery).toHaveText("Agent received the review packet.", { timeout: 60_000 });

    // 8. The agent the phone is driving actually received the packet. The
    //    banner is a claim about delivery; the conversation is the evidence.
    //    Read it from the native snapshots the phone is already subscribed to
    //    rather than navigating panes — the conversation is server state, and
    //    the pane the phone happens to be showing is not part of this gate.
    fs.writeFileSync(testInfo.outputPath("wire.json"), JSON.stringify(wire, null, 2));
    const roleTexts = (role: string) =>
      (snapshots.at(-1)?.messages ?? []).filter((message) => message.role === role).map((message) => message.text);
    // The packet enters the conversation as a second user message before any
    // reply exists, so this separates "never arrived" from "arrived, slow".
    await expect.poll(() => roleTexts("user").length, { timeout: 60_000 }).toBe(2);
    expect(roleTexts("user").at(-1), "the packet's own notes must be what was submitted").toContain(firstNote);
    await expect.poll(() => roleTexts("assistant").join("\n"), { timeout: 120_000 }).toContain(receipt);
    await phone.screenshot({ path: testInfo.outputPath("phone-review-answered.png"), fullPage: true });

    // 9. A reload keeps the pairing, the conversation and the notes.
    await phone.reload({ waitUntil: "networkidle" });
    await expect(phone.getByTestId("pairing-gate")).toHaveCount(0, { timeout: 30_000 });
    await expect(ui.locator('[data-native-role="assistant"]').last()).toContainText(receipt, { timeout: 60_000 });

    // 10. Revoking from the host takes the access back, mid-session.
    await page.goto(hostUrl, { waitUntil: "networkidle" });
    await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("paired-devices")).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid^="device-revoke-"]').first().click();
    await expect(phone.getByTestId("pairing-gate")).toBeVisible({ timeout: 30_000 });

    expect(phoneErrors).toEqual([]);
  } finally {
    fs.writeFileSync(testInfo.outputPath("core.log"), coreLog.join(""));
    fs.writeFileSync(testInfo.outputPath("wire.json"), JSON.stringify(wire, null, 2));
    await phone.screenshot({ path: testInfo.outputPath("phone-final.png"), fullPage: true }).catch(() => {});
    await phoneContext.close();
    await stop();
    const ownedTmux = new Set([...coreLog.join("").matchAll(/tmux_session=(perch-cli-\S+)/g)].map((match) => match[1]));
    for (const name of ownedTmux) {
      try { execFileSync("tmux", ["kill-session", "-t", `=${name}`], { stdio: "ignore" }); } catch { /* already exited */ }
    }
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

/** Anchor a note on the diff line containing `text`, as the mobile UI does. */
async function addComment(page: Page, text: string, side: "old" | "new", body: string): Promise<void> {
  const line = page.locator(`[data-testid="git-diff-line"][data-side="${side}"]`).filter({ hasText: text }).first();
  await expect(line).toBeVisible({ timeout: 20_000 });
  await line.getByTestId("git-comment-add").click();
  await expect(page.getByTestId("git-comment-composer")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("git-comment-body").fill(body);
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(page.locator(".workspace-git__comment").filter({ hasText: body })).toBeVisible({ timeout: 20_000 });
}
