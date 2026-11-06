/**
 * Live check of the native chat composer against every installed harness: `@file` mentions,
 * `/command` / `$skill` menus, and image attachments must reach the real agent, not just the UI.
 * Real (cheap-model) turns against an isolated core; see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts [-g claude]
 *
 * Staged uploads land under $HOME/.perch/uploads/<session id>; the spec removes its own session's folder.
 */
import { test, expect } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { setChatMode } from "./chatMode";
import { addProject, startFromPanel } from "./projects";
import { cheapModelEnv, CHEAP_CODEX_MODEL, CHEAP_CLAUDE_MODEL } from "./cheapModel";

/** A solid red PNG, built by hand so the spec needs no image library. */
function redPng(size = 32): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = ~0; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => (i % 3 === 0 ? 255 : 0))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

for (const provider of ["claude", "codex", "omp", "pi"]) test(`${provider}: @file, command menu and image attachment reach the agent`, async ({ page, context }, testInfo) => {
  test.setTimeout(420_000);
  const expectedModel = provider === "claude" ? CHEAP_CLAUDE_MODEL : CHEAP_CODEX_MODEL;
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-native-composer-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
  const token = `composer_${provider}_${Date.now()}`;
  fs.writeFileSync(path.join(fixture, "sentinel.txt"), token);
  fs.writeFileSync(path.join(fixture, "red.png"), redPng());
  // A project command (Claude) and skill (Codex) whose only job is to answer with a fixed word.
  // Only for the harnesses that list them; Pi asks to trust a project folder that carries agent resources.
  if (provider === "claude") {
    fs.mkdirSync(path.join(fixture, ".claude/commands"), { recursive: true });
    fs.writeFileSync(path.join(fixture, ".claude/commands/perchping.md"), "---\ndescription: Perch composer check\n---\nReply with exactly PERCH_PING_OK and nothing else.\n");
  }
  // OMP reads the same project folder and does not ask to trust it (Pi does, so its skill lives in its agent home).
  if (provider === "codex" || provider === "omp") {
    fs.mkdirSync(path.join(fixture, ".agents/skills/perchping"), { recursive: true });
    fs.writeFileSync(path.join(fixture, ".agents/skills/perchping/SKILL.md"), "---\nname: perchping\ndescription: Perch composer check. Reply with exactly PERCH_PING_OK and nothing else.\n---\nWhen invoked, reply with exactly PERCH_PING_OK and nothing else.\n");
  }
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const url = `http://127.0.0.1:${port}`;
  let core: ChildProcess | undefined;
  /** A failed send leaves its message pending in the transcript; clear it so the next check starts clean. */
  const dismissUnconfirmed = async () => {
    const dismiss = ui.getByRole("button", { name: "Dismiss" });
    if (await dismiss.count()) await dismiss.click();
    await box.fill("");
  };
  let sessionId: string | undefined;
  // Each check reports its own failure so one broken path does not hide the others.
  const failures: string[] = [];
  const check = async (name: string, run: () => Promise<void>) => {
    try { await run(); } catch (error) { failures.push(`${name}: ${String(error).replace(/\u001b\[\d+m/g, "").split("\n").slice(0, 14).join(" ")}`); }
  };
  const errors: string[] = [];
  const prompts: string[] = [];
  const snapshots: string[] = [];
  const consoleLines: string[] = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) consoleLines.push(message.text().slice(0, 300)); });
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "agent.terminal.opened") sessionId = message.status.key.sessionId;
      if (message.type === "agent.ui.snapshot") snapshots.push(`${new Date().toISOString().slice(11, 23)} running=${message.snapshot.running} blocked=${message.snapshot.blocked} request=${message.snapshot.request?.title ?? "-"} messages=${message.snapshot.messages.length}`);
    });
    socket.on("framesent", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "agent.ui.prompt") prompts.push(message.text); });
  });
  await context.addInitScript((directory) => {
    if (location.protocol !== "http:" || window !== window.top) return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  }, fixture);
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  /** Send what is in the composer and wait for the agent's turn to finish; returns the final reply. */
  async function sendAndWait(): Promise<string> {
    const before = await ui.locator('[data-native-role="user"]').count();
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(before + 1, { timeout: 60_000 });
    await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
    return (await ui.locator('[data-native-role="assistant"]').last().innerText());
  }
  try {
    // Pi and OMP share one config-home variable but different formats: Pi gets its own cheap-model overlay
    // through a launcher shim (as native-providers.spec.ts does) instead of the core's environment.
    let launchPath = process.env.PATH;
    const bin = path.join(fixture, "bin");
    const quote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
    const real = (name: string) => quote(execFileSync("which", [name], { encoding: "utf8" }).trim());
    if (provider === "pi") {
      const piHome = cheapModelEnv("pi", fixture).PI_CODING_AGENT_DIR!;
      fs.mkdirSync(path.join(piHome, "skills/perchping"), { recursive: true });
      fs.writeFileSync(path.join(piHome, "skills/perchping/SKILL.md"), "---\nname: perchping\ndescription: Perch composer check. Reply with exactly PERCH_PING_OK and nothing else.\n---\nWhen invoked, reply with exactly PERCH_PING_OK and nothing else.\n");
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, "pi"), `#!/bin/sh\nexport PI_CODING_AGENT_DIR=${quote(piHome)}\nexec ${real("pi")} "$@"\n`, { mode: 0o700 });
      launchPath = `${bin}:${process.env.PATH}`;
    }
    if (provider === "codex") {
      // Perch launches Codex with approvals bypassed. Swap that flag for a read-only sandbox that asks the user,
      // so a command approval actually appears.
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\nfor arg; do shift; if [ "$arg" = --dangerously-bypass-approvals-and-sandbox ]; then set -- "$@" -a on-request -s read-only -c approvals_reviewer=user; else set -- "$@" "$arg"; fi; done\nexec ${real("codex")} "$@"\n`, { mode: 0o700 });
      launchPath = `${bin}:${process.env.PATH}`;
    }
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], { cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", RUST_LOG: "info,perch_core::commands=debug", ...(provider === "pi" ? {} : cheapModelEnv(provider, fixture)), PATH: launchPath }, stdio: ["ignore", log, log] });
    core.once("exit", (code, signal) => consoleLines.push(`CORE EXIT code=${code} signal=${signal} at ${new Date().toISOString()}`));
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    await startFromPanel(page, { agent: provider, where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli).toHaveAttribute("data-controlling", "true");
    await expect(cli.locator(".xterm-rows")).toContainText(provider === "codex" ? /OpenAI Codex/ : provider === "claude" ? /Claude Code/ : provider === "omp" ? /OMP|oh.my.pi|omp v/i : /pi v|pi \(|pi coding|pi update|pi\.dev|\.pi\/agent/i, { timeout: 30_000 });
    if (provider === "claude") await expect(cli.locator(".xterm-rows")).toContainText("bypass permissions on", { timeout: 30_000 });
    if (provider === "codex") {
      await expect(cli.locator(".xterm-rows")).toContainText(/Do you trust the contents|To get started/i, { timeout: 30_000 });
      if ((await cli.locator(".xterm-rows").innerText()).includes("Do you trust the contents")) await cli.locator(".xterm-helper-textarea").press("Enter");
    }
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(box).toBeEnabled();
    // Fail before any paid turn if the cheap-model pin did not take.
    await expect(ui.locator(".native-cli-chat__model")).toHaveText(expectedModel);

    // 1. `@file`: pick the mention from the menu, the agent reads the file it names.
    await check("@file", async () => {
      await box.pressSequentially("What is inside @senti", { delay: 15 });
      await ui.getByRole("option", { name: "sentinel.txt" }).click();
      await expect(box).toHaveValue("What is inside @sentinel.txt ");
      await box.pressSequentially("? Reply with its exact contents only.", { delay: 5 });
      expect(await sendAndWait()).toContain(token);
    });

    // 2. Image: staged through the real upload endpoint, shown as a chip, handed to the agent as an attachment.
    await check("image", async () => {
      await ui.getByTestId("native-cli-file-input").setInputFiles(path.join(fixture, "red.png"));
      await expect(ui.getByTestId("native-cli-attachments").getByText("red.png")).toBeVisible({ timeout: 15_000 });
      await box.fill("What single colour fills the attached image? Reply with only the colour name.");
      const reply = await sendAndWait();
      await testInfo.attach("image-reply", { body: reply, contentType: "text/plain" });
      expect(reply.toLowerCase()).toContain("red");
    });
    await dismissUnconfirmed();

    // 3. Commands. Every provider offers its built-ins after `/` (Claude's terminal-only `/rewind` is not in its
    // headless list, so seeing it proves the catalog); what the CLI itself reports is merged in: Claude's project
    // command, Codex's `$skill`, and the Pi/OMP session's own skills.
    await check("command menu", async () => {
      const builtin = { claude: "rewind", codex: "compact", pi: "compact", omp: "compact" }[provider];
      await box.pressSequentially(`/${builtin.slice(0, 4)}`, { delay: 15 });
      await expect(ui.getByRole("option", { name: `/${builtin}` })).toBeVisible({ timeout: 30_000 });
      if (provider === "codex") {
        // `/` lists Codex's built-ins and `$` its skills, never the other's.
        await box.fill("/perchp");
        await expect(ui.getByRole("option", { name: "/perchping" })).toHaveCount(0);
      }
      await box.fill("");
      if (provider === "pi" || provider === "omp") {
        await box.pressSequentially("/skill:perchp", { delay: 15 });
        await expect(ui.getByRole("option", { name: "/skill:perchping" })).toBeVisible({ timeout: 30_000 });
        await box.fill("");
      }
      if (provider === "claude" || provider === "codex") {
        const sigil = provider === "claude" ? "/" : "$";
        await box.pressSequentially(`${sigil}perchp`, { delay: 15 });
        await ui.getByRole("option", { name: `${sigil}perchping` }).waitFor({ timeout: 30_000 }).catch(async (error) => {
          const lists = await page.evaluate(({ id, kind }) => JSON.stringify((window as unknown as { usePerchStore?: { getState(): { sessionCommands: Record<string, Record<string, { name: string }[]>> } } }).usePerchStore?.getState().sessionCommands[id]?.[kind]?.map((entry: { name: string }) => entry.name).slice(0, 60)), { id: sessionId, kind: provider });
          await testInfo.attach("command-list", { body: String(lists), contentType: "text/plain" });
          throw error;
        });
        await box.press("Enter");
        await expect(box).toHaveValue(`${sigil}perchping `);
        expect(await sendAndWait()).toContain("PERCH_PING_OK");
        // Claude records the skill as a command envelope; the transcript shows what the person typed.
        if (provider === "claude") {
          await expect(ui.locator('[data-native-role="user"]').last()).toHaveText("/perchping");
          await expect(ui.locator('[data-native-role="user"]').filter({ hasText: "<command-" })).toHaveCount(0);
        }
      }
    });
    // 4. Questions and approvals, answered from the card: Claude's AskUserQuestion (number key), a Codex
    // command approval (button), OMP's `ask` tool (arrow keys under the hood) and Pi's `ask_user_question`
    // extension tool, which exists only if the user installed it.
    const piHasAsk = provider === "pi" && /ask-user-question/.test(fs.readFileSync(path.join(os.homedir(), ".pi/agent/settings.json"), "utf8"));
    if (provider === "pi" && !piHasAsk) testInfo.annotations.push({ type: "skipped", description: "Pi: no ask-user-question extension installed" });
    if (provider !== "pi" || piHasAsk) await check("request card", async () => {
      const card = ui.getByTestId("native-cli-request");
      const tool = { claude: "AskUserQuestion", omp: "ask", pi: "ask user question" }[provider];
      await box.fill(provider === "codex"
        ? "Run the shell command: touch approved.txt . Then say done."
        : `Use the ${tool} tool to ask me which colour I like, with options Red, Blue and Green. Then reply with only my choice.`);
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      await expect(card).toBeVisible({ timeout: 90_000 });
      await expect(ui.getByRole("status")).toHaveText("Waiting for you");
      if (provider === "codex") {
        await expect(card.getByTestId("native-cli-request-detail")).toContainText("touch approved.txt");
        await card.getByTestId("native-cli-request-option-1").click();
      } else {
        await expect(card.getByTestId("native-cli-request-option-2")).toContainText("Blue");
        if (provider === "omp") { await card.getByTestId("native-cli-request-option-2").click(); }
        else { await expect(card).toBeFocused(); await page.keyboard.press("2"); }
      }
      await expect(card).toHaveCount(0, { timeout: 30_000 });
      await expect(ui.getByTestId("native-cli-receipts")).toContainText("Answered");
      await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
      if (provider === "codex") expect(fs.existsSync(path.join(fixture, "approved.txt"))).toBe(true);
      else expect((await ui.locator('[data-native-role="assistant"]').last().innerText()).toLowerCase()).toContain("blue");
    });
    // 5. The files the agent changed in its turn, with the diff one click away. Codex runs here in a read-only
    // sandbox that asks first, so its approval card is answered along the way.
    await check("changed files", async () => {
      // A repository only now: agents ask to trust a new Git folder at launch, which this run does not exercise.
      // Perch's own state lives in the same directory in this fixture; it is not the agent's work.
      fs.writeFileSync(path.join(fixture, ".gitignore"), "history.sqlite*\ndaemon/\n*.log\nhosts.json\nproviders.json\nsettings.json\nbin/\n");
      execFileSync("git", ["init", "-q"], { cwd: fixture });
      execFileSync("git", ["-c", "user.name=perch", "-c", "user.email=perch@example.invalid", "commit", "--allow-empty", "-m", "init", "-q"], { cwd: fixture });
      await box.fill("Create a file named changed.txt containing exactly: hello perch. Do nothing else, then reply done.");
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      // The projection's live line (a Codex approval hides it; its card is the answer to "what now").
      await expect(ui.getByTestId("native-cli-working").or(ui.getByTestId("native-cli-request"))).toBeVisible({ timeout: 60_000 });
      const changed = ui.getByTestId("native-cli-changed-files");
      await expect(async () => {
        const card = ui.getByTestId("native-cli-request-option-1");
        if (await card.count()) await card.click();
        await expect(changed).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 150_000, intervals: [1_000] });
      await expect(changed).toContainText("changed.txt");
      await changed.locator("summary", { hasText: "changed.txt" }).click();
      await expect(changed.getByTestId("native-cli-turn-diff")).toContainText("hello perch");
      await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
      // The core's projection of that turn: one run whose call names the file, settled and paired with
      // its output, in the turn the prompt opened; and nothing left on the live line.
      const run = ui.getByTestId("native-cli-run").last();
      const step = run.locator("[data-native-step]").filter({ hasText: /changed\.txt/ }).first();
      await expect(step).toHaveAttribute("data-native-step", "completed");
      console.log(`[${provider}] run: ${await run.locator(":scope > summary").textContent()} | ${(await run.locator("[data-native-step] > summary").evaluateAll((nodes) => nodes.map((node) => node.textContent))).join(" | ")}`);
      await expect(run.getByTestId("native-cli-run-failed")).toHaveCount(0);
      const prompt = ui.locator('[data-native-role="user"]').last();
      await expect(run).toHaveAttribute("data-native-turn", (await prompt.getAttribute("data-block-id"))!);
      await expect(ui.getByTestId("native-cli-working")).toHaveCount(0);
      // Find asks the core, which looks inside runs.
      await ui.press("Control+f");
      await ui.getByLabel("Find in chat").fill("hello perch");
      await expect(ui.getByTestId("native-cli-find-count")).toHaveText(/^1 of \d+$/, { timeout: 10_000 });
      await ui.getByLabel("Close find").click();
    });
    // An edit card: the file the agent edited, with its rows. Claude only: it is the provider whose call and
    // result Perch reads as an edit in every run (Codex file changes and Pi/OMP edits get no card).
    if (provider === "claude") await check("edit card", async () => {
      await box.fill("Edit changed.txt so that it reads exactly: hello cards (replace the old text). Do nothing else, then reply done.");
      await sendAndWait();
      const run = ui.getByTestId("native-cli-run").last();
      await run.locator(":scope > summary").click();
      const card = run.getByTestId("native-cli-diff-card").last();
      await expect(card).toContainText("Edited");
      await expect(card).toContainText("changed.txt");
      await card.getByRole("button", { expanded: false }).click();
      const rows = card.getByTestId("native-cli-diff-rows");
      await expect(rows).toContainText("hello perch");
      await expect(rows).toContainText("hello cards");
      // The turn that created the file keeps a rollup from its own edit calls; the newest turn has Git's card instead.
      const rollup = ui.getByTestId("native-cli-turn-rollup");
      await expect(rollup).toHaveCount(1);
      await expect(rollup).toContainText("1 changed file");
      await expect(rollup).toContainText("+1");
      await rollup.getByRole("button", { name: /changed\.txt/ }).click();
      await expect(rollup.getByTestId("native-cli-diff-card")).toContainText("Added");
    });
    // The agent's own to-do list is docked above the composer. Claude 2.1.319 keeps it with TaskCreate and
    // TaskUpdate calls (it offers no TodoWrite); Codex's plan updates do not reach the bridge as calls.
    if (provider === "claude") await check("task list", async () => {
      await box.fill("Use your task-tracking tools to record two tasks: 'Read the notes' as completed and 'Write the summary' as in_progress. Then reply with only the word ok.");
      await sendAndWait();
      const tasks = ui.getByTestId("native-cli-tasks");
      await expect(tasks).toBeVisible({ timeout: 15_000 });
      await expect(tasks).toContainText("1 of 2 completed");
      await expect(tasks.getByRole("listitem")).toHaveCount(2);
      await expect(tasks.getByRole("listitem").first()).toContainText("Read the notes");
      // The call itself reads as what it changed, not as raw input.
      const run = ui.getByTestId("native-cli-run").last();
      await run.locator(":scope > summary").click();
      await expect(run).toContainText("Added Read the notes");
    });
    // 6. After real turns the provider has reported how full the context is (OpenCode has no source).
    await check("context ring", async () => {
      const ring = ui.getByTestId("native-cli-context");
      await expect(ring).toBeVisible({ timeout: 15_000 });
      expect(Number(await ring.getAttribute("data-percent"))).toBeGreaterThan(0);
    });
    // 7. Text half-typed on the CLI's own line is picked up when the chat opens, and the next send replaces it:
    // the transcript's message is exactly the composer's text, not the terminal draft with it appended.
    await check("terminal draft pickup", async () => {
      await setChatMode(page, "cli");
      await cli.locator(".xterm-helper-textarea").pressSequentially("half typed in terminal", { delay: 10 });
      await expect(cli.locator(".xterm-rows")).toContainText("half typed in terminal", { timeout: 10_000 });
      await setChatMode(page, "ui");
      await expect(box).toHaveValue("half typed in terminal", { timeout: 30_000 });
      await box.fill("Reply with only the word ok.");
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      await expect(ui.locator('[data-native-role="user"]').last()).toHaveText("Reply with only the word ok.", { timeout: 60_000 });
      await expect(ui.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
      await setChatMode(page, "cli");
      expect(await cli.locator(".xterm-rows").innerText()).not.toContain("half typed in terminal");
      await setChatMode(page, "ui");
    });
    // 8. Composer: Up recalls the prompts sent from the transcript (newest first), Down walks back to empty,
    // and a half-typed draft survives a reload.
    await check("recall and draft", async () => {
      await box.fill("");
      await box.press("ArrowUp");
      await expect(box).toHaveValue("Reply with only the word ok.");
      await box.press("ArrowDown");
      await expect(box).toHaveValue("");
      await box.fill("half a thought");
      await page.reload({ waitUntil: "networkidle" });
      await expect(box).toHaveValue("half a thought", { timeout: 30_000 });
      await box.fill("");
    });
    // 9. Stopping a turn leaves one quiet "Conversation interrupted" row, not a user bubble holding Claude's
    // boilerplate, and the chat settles to Ready.
    if (provider === "claude") await check("interrupted row", async () => {
      await box.fill("Run the shell command `sleep 60` and then reply with only the word done.");
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      const stop = ui.getByRole("button", { name: "Cancel turn" });
      await expect(stop).toBeEnabled({ timeout: 90_000 });
      await expect(ui.getByTestId("native-cli-run").last()).toContainText(/sleep/, { timeout: 60_000 });
      await stop.click();
      await expect(ui.getByTestId("native-cli-status-row").last()).toHaveText("Conversation interrupted", { timeout: 30_000 });
      await expect(ui.locator('span[role="status"]')).toHaveText("Ready", { timeout: 30_000 });
      await expect(ui.locator('[data-native-role="user"]').filter({ hasText: "Request interrupted" })).toHaveCount(0);
    });
    // 10. A plan review, last because the `/plan` command leaves user rows of its own (which would change what Up
    // recalls). Claude's turn ends in its "ready to execute" dialog, shown as a card with the plan and the two
    // choices that need no typed feedback. Approving by hand lets the turn finish.
    if (provider === "claude") await check("plan review", async () => {
      await box.fill("/plan Create a file named planned.txt containing exactly: hello plan. Keep the plan to one line, then call the ExitPlanMode tool to ask for my approval.");
      await ui.getByRole("button", { name: "Send", exact: true }).click();
      // `/plan` is Claude's own command: it is typed into the CLI, and its rows in the transcript are hidden.
      await expect(ui.getByTestId("native-cli-command-ran")).toContainText("/plan", { timeout: 30_000 });
      await expect(ui.locator('[data-native-role="user"]').filter({ hasText: "command-" })).toHaveCount(0);
      const card = ui.getByTestId("native-cli-request");
      await expect(card).toBeVisible({ timeout: 120_000 });
      await expect(card.getByTestId("native-cli-request-detail")).toContainText(/planned\.txt/);
      // Option 1 is worded by the session's permission mode (this one runs with bypass permissions).
      await expect(card.getByTestId("native-cli-request-option-1")).toContainText(/^1Yes, /);
      await expect(card.getByTestId("native-cli-request-option-2")).toContainText("manually approve");
      await expect(card.getByTestId("native-cli-request-option-3")).toHaveCount(0);
      await card.getByTestId("native-cli-request-option-2").click();
      // Manual approval asks again before the write; the command's own notice is also a status, so name the span.
      await expect(async () => {
        // Never the plan card again: its option 1 would pick the other approval.
        const next = ui.locator('[data-testid="native-cli-request"]:not([aria-label*="ready to execute"]) [data-testid="native-cli-request-option-1"]');
        if (await next.count()) await next.click();
        await expect(ui.locator('span[role="status"]')).toHaveText("Ready", { timeout: 2_000 });
      }).toPass({ timeout: 150_000, intervals: [1_000] });
      expect(fs.readFileSync(path.join(fixture, "planned.txt"), "utf8")).toContain("hello plan");
    });
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  } catch (error) {
    // Capture while the core is still up; the page looks "offline" once the finally block stops it.
    fs.mkdirSync(path.join(root, ".impeccable/review"), { recursive: true });
    await page.screenshot({ path: path.join(root, `.impeccable/review/native-composer-${provider}-failure.png`) }).catch(() => {});
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    // The Terminal view shows what the CLI itself is waiting on.
    await setChatMode(page, "cli").catch(() => {});
    await testInfo.attach("terminal", { body: await cli.locator(".xterm-rows").innerText({ timeout: 8_000 }).catch(() => "unavailable (CLI view is not mounted)"), contentType: "text/plain" });
    await testInfo.attach("snapshots", { body: snapshots.slice(-40).join("\n"), contentType: "text/plain" });
    fs.writeFileSync(`/tmp/nc-${provider}-snapshots.txt`, snapshots.join("\n") + "\n" + failures.join("\n---\n"));
    await testInfo.attach("prompts", { body: JSON.stringify(prompts, null, 2), contentType: "application/json" });
    throw error;
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    // Cleanup refuses a runtime whose agent left a detached process group. That daemon and its agent belong
    // to this fixture alone, so stop them here rather than leave a paid CLI running after the test.
    await cleanupFixtureRuntime(root, fixture).catch((error) => {
      testInfo.annotations.push({ type: "cleanup", description: String(error).slice(0, 400) });
      const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      const owned = execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((line) => line.includes(daemonDir));
      for (const line of owned) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
    });
    if (sessionId) fs.rmSync(path.join(os.homedir(), ".perch/uploads", sessionId), { recursive: true, force: true });
    fs.closeSync(log);
    fs.copyFileSync(path.join(fixture, "core.log"), `/tmp/nc-core-${provider}.log`);
    await testInfo.attach("core.log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").split("\n").filter((line) => /commands|WARN|ERROR|DBG/.test(line)).join("\n"), contentType: "text/plain" });
    // The daemon may still be writing into its directory as it stops.
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
