/**
 * Live check of herdr's "ask the agent to change the app": a Claude lead (haiku) that a person has just
 * spoken to reads `perch guide` and `perch mod api`, writes a mod that shows a todo list, enables it and
 * puts it on screen, and the page then draws it and the list works; then it is asked to turn Perch into an
 * IDE and writes a layout (files, panes, git) and selects it. A second lead, given only `perch mod guide` and
 * the CLI, copies Perch's own status bar, puts the copy in its place, then edits it to add a working button, and
 * checks each stage with `perch mod check`/`dom`. A third, with the same tools, makes a deep edit in four staged
 * turns: a sidebar copy grouped by agent then project, its group headings folding by click, Enter and touch, a
 * dialog-shell copy that Instructions (opened from the sidebar copy's menu) is drawn in, and a chat copy the next turn
 * goes through. What is asserted is the files in the core's folder, what the agent saved from the CLI and the page's
 * own DOM, not what the model said. Perch's own files stay as shipped. Isolated core and daemon, see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts agent-mods.spec.ts --workers 1
 */
import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { setChatMode } from "./chatMode";
import { addProject, expectActive, startChat, startFromPanel } from "./projects";
import { holdRow } from "./workspaceTools";
import { cheapModelEnv, pinReporterModels, CHEAP_CLAUDE_MODEL } from "./cheapModel";

const root = path.resolve(__dirname, "..");

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
}

/** Wait for the chat to be ready again, approving a command the lead asks leave to run. */
async function untilReady(ui: ReturnType<Page["getByTestId"]>, timeout: number) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    // The chat may hold other live notes too ("Ran … in the CLI"): Ready is one of its status lines.
    if (await ui.getByRole("status").filter({ hasText: /^Ready$/ }).count()) return;
    const card = ui.getByTestId("native-cli-request");
    if (await card.isVisible().catch(() => false)) await card.getByTestId("native-cli-request-option-1").click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("the lead did not become ready");
}

interface Lead { fixture: string; url: string; ui: Locator; box: Locator }

/** An isolated core with a Claude lead in a project at a private fixture, its chat in UI mode and its model checked
 * to be the approved cheap one before any turn; `turns` runs with it, then the core and its daemon go. */
async function withLead(page: Page, testInfo: TestInfo, turns: (lead: Lead) => Promise<void>) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-agentmods-"));
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
  try {
    fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
    fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
    pinReporterModels(fixture);
    log = fs.openSync(path.join(fixture, "core.log"), "a");
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], {
      cwd: root,
      env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...cheapModelEnv("claude", fixture) },
      stdio: ["ignore", log, log],
    });
    const url = `http://127.0.0.1:${port}`;
    await expect.poll(async () => { if (core!.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.context().addInitScript((directory) => {
      if (location.protocol !== "http:" || window !== window.top) return;
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sidebar.organize", "project");
      localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
    }, fixture);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, fixture);
    await startFromPanel(page, { agent: "claude", where: path.basename(fixture) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 30_000 });
    await setChatMode(page, "ui");
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(box).toBeEnabled();
    // Fail before any paid turn if the cheap-model pin did not take.
    await expect(ui.locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);
    await turns({ fixture, url, ui, box });
  } catch (error) {
    await testInfo.attach("core-log", { body: fs.readFileSync(path.join(fixture, "core.log"), "utf8").slice(-6000), contentType: "text/plain" });
    await testInfo.attach("visible-state", { body: await page.locator("body").innerText().catch(() => "unavailable"), contentType: "text/plain" });
    await page.screenshot({ path: testInfo.outputPath("agent-mods-failed.png") }).catch(() => {});
    throw error;
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    await cleanupFixtureRuntime(root, fixture).catch(() => {
      const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((entry) => entry.includes(daemonDir))) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
    });
    if (log !== undefined) fs.closeSync(log);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

/** Send one turn and wait until the lead is ready again. */
async function turn(ui: Locator, box: Locator, prompt: string) {
  // A dialog the agent opened to look at a copy (`perch mod do`) and left open covers the chat: close it first.
  const open = ui.page().locator('[role="dialog"]:visible, [data-testid="settings-modal"]:visible');
  for (let tries = 0; tries < 6 && (await open.count()); tries++) {
    await ui.page().keyboard.press("Escape");
    await ui.page().waitForTimeout(300);
  }
  await box.fill(prompt);
  await ui.getByRole("button", { name: "Send", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
}

test("an agent asked to change Perch writes a todo-list mod and an IDE layout that the page draws", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const heading = `Todos${Date.now().toString(36)}`;
  // A mod's element is anything outside the chat transcript that holds the heading; the first ancestor with an
  // input and a button is the list. The prompt holds the heading too, so the chat itself never counts.
  const findList = () => page.evaluate((text) => {
    const hit = [...document.querySelectorAll("body *")].find((el) =>
      el.children.length === 0 && el.textContent?.includes(text) && !el.closest('[data-testid="native-cli-chat"]'));
    let at = hit?.parentElement ?? null;
    while (at && !(at.querySelector("input") && at.querySelector("button"))) at = at.parentElement;
    document.querySelectorAll("[data-e2e-todo]").forEach((el) => el.removeAttribute("data-e2e-todo"));
    at?.setAttribute("data-e2e-todo", "1");
    return !!at;
  }, heading);
  await withLead(page, testInfo, async ({ fixture, ui, box }) => {
    await turn(ui, box,
      "Use the shell and no other tools, and only the perch command to reach Perch. First run `perch guide`, then `perch mod api` and `perch mod examples`. " +
      `Then change Perch so it shows a todo list: write a Perch mod (named todo-list) whose view has the heading "${heading}", a text input and an "Add" button; ` +
      "each time Add is pressed the input's text is added to a list under it. Enable the mod, put it on screen with `perch mod open todo-list`, and check it with `perch mod check todo-list`. " +
      "Reply with the one word done and nothing else.",
    );
    await expect(ui.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    // The mod's folder appears while the turn runs; the turn then ends.
    const mods = path.join(fixture, "mods");
    await expect.poll(() => fs.existsSync(mods) && fs.readdirSync(mods).some((name) => fs.existsSync(path.join(mods, name, "main.js"))), { timeout: 240_000, intervals: [2_000] }).toBe(true);
    await untilReady(ui, 360_000);

    // The page draws it: the heading, an input and a button, outside the chat.
    await expect.poll(findList, { timeout: 60_000, intervals: [1_000] }).toBe(true);
    const list = page.locator("[data-e2e-todo]").first();
    await list.locator("input").first().fill("Buy milk");
    await list.getByRole("button", { name: /add/i }).first().click();
    await expect(list).toContainText("Buy milk");
    await page.screenshot({ path: testInfo.outputPath("agent-mods.png") });

    // Then the whole window: "make Perch an IDE" is a layout, chosen with `perch mod layout`.
    await turn(ui, box,
      "Use the shell and no other tools, and only the perch command to reach Perch. " +
      "Now change Perch into an IDE: write a layout named ide with the project's files on the left, the open session's panes in the middle and git on the right, " +
      "select it with `perch mod layout ide`, and check it with `perch mod status`. Reply with the one word done and nothing else.",
    );
    const layouts = path.join(fixture, "layouts");
    await expect.poll(() => fs.existsSync(layouts) && fs.readdirSync(layouts).some((name) => name.endsWith(".json")), { timeout: 240_000, intervals: [2_000] }).toBe(true);
    await untilReady(ui, 360_000);
    const written = fs.readdirSync(layouts).filter((name) => name.endsWith(".json"));
    const contents = written.flatMap((name) => JSON.stringify(JSON.parse(fs.readFileSync(path.join(layouts, name), "utf8"))).match(/"content":"(\w+)/g) ?? []);
    expect(contents.join(" "), "the layout holds the files, panes and git blocks").toMatch(/files[\s\S]*canvas|canvas[\s\S]*files/);
    expect(contents.join(" ")).toContain("git");
    // The page now draws that layout instead of stock Perch.
    for (const block of ["files", "canvas", "git"]) await expect(page.getByTestId(`layout-${block}`)).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: testInfo.outputPath("agent-ide-layout.png") });
  });
});

test("an agent with only perch mod guide and the CLI copies Perch's status bar, puts it in place, adds a working button and checks it live", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  // The agent's tools: the `perch` binary the core puts beside it.
  execFileSync("cargo", ["build", "-q", "-p", "perchd", "--bin", "perch"], { cwd: root, stdio: "inherit" });
  const label = `Hi${Date.now().toString(36)}`;
  await withLead(page, testInfo, async ({ fixture, url, ui, box }) => {
    const shipped = await (await page.request.get(`${url}/stock-ui/status/main.js`)).text();
    const copy = path.join(fixture, "mods", "my-status");
    const statusView = page.locator('[data-testid="mod-view-my-status"]');

    // Stage 1: the guide, a copy of Perch's own status bar, chosen in its place and checked untouched.
    await turn(ui, box,
      "Use the shell and no other tools, and only the perch command to reach Perch; do not read any other repository or install anything. " +
      "Run `perch mod guide` and follow it to copy Perch's own status bar (stock:status) as my-status and put the copy in place of Perch's own. " +
      "Do not change any file yet. Then run `perch mod check my-status` and `perch mod dom my-status`. Reply with the one word done and nothing else.",
    );
    await expect.poll(() => fs.existsSync(path.join(copy, "main.js")), { timeout: 240_000, intervals: [2_000] }).toBe(true);
    await untilReady(ui, 360_000);
    const manifest = JSON.parse(fs.readFileSync(path.join(copy, "mod.json"), "utf8")) as { clonedFrom?: { id: string } };
    expect(manifest.clonedFrom?.id).toBe("stock:status");
    await expect(statusView.getByTestId("status-host")).toHaveText("Local", { timeout: 30_000 });
    await expect(page.locator('[data-testid="mod-view-stock:status"]')).toHaveCount(0);

    // Stage 2: a real change, a button that acts through Perch, verified by the agent with the CLI.
    await turn(ui, box,
      "Use the shell and no other tools, and only the perch command to reach Perch. " +
      `Edit your copy my-status (its folder is the one \`perch mod clone\` printed) so the status bar also has a button labeled "${label}" that opens Perch's Settings when pressed: ` +
      "do it the way `perch mod guide` says a copied screen acts, and find the command name with `perch mod commands`. Keep everything else the bar shows. " +
      "After the edit run `perch mod check my-status` and `perch mod dom my-status` and fix the file until the button is drawn. Reply with the one word done and nothing else.",
    );
    await expect.poll(() => fs.readdirSync(copy).some((name) => name.endsWith(".js") && fs.readFileSync(path.join(copy, name), "utf8").includes(label)), { timeout: 300_000, intervals: [2_000] }).toBe(true);
    await untilReady(ui, 420_000);
    // What the agent wrote, kept with the result (the fixture is removed afterwards).
    for (const name of fs.readdirSync(copy).filter((file) => file.endsWith(".js"))) {
      fs.copyFileSync(path.join(copy, name), testInfo.outputPath(`my-status-${name}`));
    }

    // The window draws the copy's button, it opens Settings through Perch, and the bar still says where it runs.
    const button = statusView.getByRole("button", { name: label });
    await expect(button).toBeVisible({ timeout: 30_000 });
    await expect(statusView.getByTestId("status-host")).toHaveText("Local");
    await button.click();
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: testInfo.outputPath("agent-status-copy.png") });
    // Only the copy changed, and it imports nothing but what the guide allows.
    expect(await (await page.request.get(`${url}/stock-ui/status/main.js`)).text()).toBe(shipped);
    onlyAllowedImports(copy);
  });
});

/** Every JS file of the package at `dir` imports only React, `@perch/sdk` or its own files. */
function onlyAllowedImports(dir: string) {
  const files = (at: string): string[] => fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(path.join(at, entry.name)) : entry.name.endsWith(".js") ? [path.join(at, entry.name)] : []);
  for (const file of files(dir)) {
    const specifiers = [...fs.readFileSync(file, "utf8").matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]);
    for (const specifier of specifiers) expect(specifier, `${file} imports ${specifier}`).toMatch(/^(react|react\/jsx-runtime|react-dom|react-dom\/client|@perch\/sdk|\.\.?\/.+)$/);
  }
}

/** A short touch on `target` (Chromium's CDP touch: the page gets touch pointer events and the tap's click). */
async function tap(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("an agent with only perch mod guide and the CLI regroups a sidebar copy by agent, makes its groups fold by key and touch, edits the dialog shell a nested dialog uses and the chat it is talking through, stage by stage", async ({ page }, testInfo) => {
  test.setTimeout(3_000_000);
  execFileSync("cargo", ["build", "-q", "-p", "perchd", "--bin", "perch"], { cwd: root, stdio: "inherit" });
  const mark = Date.now().toString(36);
  const dialogLine = `Shell ${mark}`;
  const chatLine = `Chat ${mark}`;
  const rules = "Use the shell and no other tools, and only the perch command to reach Perch; do not read any other repository, any node_modules or Perch's own source, and do not install anything. ";
  // Terminals are listed, so the project's shell joins the agent's chat in the sidebar.
  await page.context().addInitScript(() => { if (location.protocol === "http:") localStorage.setItem("perch.sidebar.showTerminals", "1"); });
  await withLead(page, testInfo, async ({ fixture, url, ui, box }) => {
    const lead = (await page.evaluate(() => localStorage.getItem("perch.sessionId")))!;
    const project = path.basename(fs.realpathSync(fixture));
    // A shell session in the same project, then back to the lead.
    const shell = await startChat(page, "terminal", fixture);
    await page.getByTestId(`workspace-session-${lead}`).first().click();
    await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 30_000 });
    await expect(ui.locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);

    // Perch's own files of the screens the agent copies, as shipped: they must never change.
    const catalog = (await (await page.request.get(`${url}/stock-ui/catalog.json`)).json()) as { packages: { id: string; files: string[] }[] };
    const shippedFiles = async () => Object.fromEntries(await Promise.all(catalog.packages.filter((entry) => ["sidebar", "dialog", "chat"].includes(entry.id))
      .flatMap((entry) => entry.files.map(async (file) => [`${entry.id}/${file}`, await (await page.request.get(`${url}/stock-ui/${entry.id}/${file}`)).text()] as const))));
    const shipped = await shippedFiles();
    const mods = path.join(fixture, "mods");
    const keep = (name: string) => { if (fs.existsSync(path.join(mods, name))) fs.cpSync(path.join(mods, name), testInfo.outputPath(name), { recursive: true }); };
    /** What the agent saw with the CLI, saved where it was told to. */
    const evidence = (file: string) => {
      const at = path.join(fixture, file);
      expect(fs.existsSync(at), `${file} was written by the agent`).toBe(true);
      fs.copyFileSync(at, testInfo.outputPath(file));
      return fs.readFileSync(at, "utf8");
    };
    /** What the agent was asked to see with the CLI. When its saved output does not show it yet, it is told so in a
     * new turn, as a person reading that file would, at most twice; each follow-up is recorded on the result. */
    const untilShown = async (chat: Locator, composer: Locator, file: string, needles: string[]) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const at = path.join(fixture, file);
        const text = fs.existsSync(at) ? fs.readFileSync(at, "utf8") : "";
        const missing = needles.filter((needle) => !text.includes(needle));
        if (!missing.length) return;
        testInfo.annotations.push({ type: "follow-up", description: `${file}: missing ${missing.join(", ")}` });
        console.log(`FOLLOW-UP ${file}: missing ${missing.join(", ")}`);
        await turn(chat, composer, rules + `${file} does not show ${missing.join(" and ")} yet. Fix your files and run the same perch commands again until it does. Reply with the one word done and nothing else.`);
        await untilReady(chat, 900_000);
      }
    };
    const afterStage = async (copies: string[]) => {
      for (const name of copies) { keep(name); onlyAllowedImports(path.join(mods, name)); }
      expect(await shippedFiles()).toEqual(shipped);
    };
    const sidebar = page.locator('[data-testid="mod-view-my-sidebar"]');
    const group = (agent: string) => sidebar.locator(`[data-agent-group="${agent}"]`);

    // Stage 1: grouping. A copy of the sidebar with a new organize choice: agent, then project, then session. The
    // window has that choice saved already (Perch's own sidebar reads an unknown one as its default), so the agent's
    // `perch mod dom` shows its groups as soon as the copy draws them.
    await page.evaluate(() => localStorage.setItem("perch.sidebar.organize", "agent"));
    try {
      await turn(ui, box, rules +
        "Run `perch mod guide` and follow it. Copy Perch's own sidebar (stock:sidebar) as my-sidebar and put the copy in place of Perch's own. " +
        "Then edit only your copy: add a fourth choice to its organize menu (beside By project, By status and In one list) with the key agent and the label By agent. " +
        "When it is chosen the session list is grouped by agent, then by project: one element per agent (the session's provider, such as claude or terminal) with the attribute data-agent-group set to the agent and a heading naming it; " +
        "inside it one element per project with the attribute data-project set to the project's name; inside that the sessions, each drawn as the sidebar already draws a session row. Keep everything else the sidebar does. " +
        "This window already has that choice saved (as agent), so `perch mod dom my-sidebar` shows your groups once your copy draws them. " +
        "After each edit run `perch mod check my-sidebar > stage1-check.txt` and `perch mod dom my-sidebar > stage1-dom.txt` in the project folder and fix your files until the check passes and stage1-dom.txt shows data-agent-group=\"claude\" and data-agent-group=\"terminal\". Reply with the one word done and nothing else.",
      );
      await expect.poll(() => fs.existsSync(path.join(mods, "my-sidebar", "overview.js")), { timeout: 300_000, intervals: [2_000] }).toBe(true);
      await untilReady(ui, 900_000);
      await untilShown(ui, box, "stage1-dom.txt", ['data-agent-group="claude"', 'data-agent-group="terminal"']);
      expect(evidence("stage1-check.txt")).toContain("my-sidebar loaded without errors");
      expect(evidence("stage1-dom.txt")).toContain('data-agent-group="claude"');
      expect(evidence("stage1-dom.txt")).toContain('data-agent-group="terminal"');
      expect((JSON.parse(fs.readFileSync(path.join(mods, "my-sidebar", "mod.json"), "utf8")) as { clonedFrom?: { id: string } }).clonedFrom?.id).toBe("stock:sidebar");
      await expect(sidebar).toBeAttached({ timeout: 30_000 });
      await expect(page.locator('[data-testid="mod-view-stock:sidebar"]')).toHaveCount(0);
      await sidebar.getByTestId("workspace-organize").click();
      await page.getByTestId("workspace-organize-agent").click();
      await expect(group("claude").locator(`[data-project="${project}"]`).getByTestId(`workspace-session-${lead}`)).toBeVisible({ timeout: 30_000 });
      await expect(group("terminal").locator(`[data-project="${project}"]`).getByTestId(`workspace-session-${shell}`)).toBeVisible();
      // The rows are still Perch's: a click shows the session, and back.
      await group("terminal").getByTestId(`workspace-session-${shell}`).click();
      await expectActive(page, shell);
      await group("claude").getByTestId(`workspace-session-${lead}`).click();
      await expectActive(page, lead);
      await expect(ui).toHaveAttribute("data-native-pid", /\d+/, { timeout: 30_000 });
      await afterStage(["my-sidebar"]);

      // Stage 2: interaction. The group headings fold by click, Enter and touch; a held row still opens Perch's menu.
      await turn(ui, box, rules +
        "Edit your copy my-sidebar again: in its By agent list make each agent's heading a button with the attribute data-agent-heading set to the agent. " +
        "Pressing it (a click, a tap or the Enter key; first read what step 4 of `perch mod guide` says about anything pressed) hides that agent's sessions, and pressing it again shows them. Keep everything else. " +
        "By agent is already chosen in the window. After each edit run `perch mod check my-sidebar > stage2-check.txt` and `perch mod dom my-sidebar > stage2-dom.txt` in the project folder and fix your files until the check passes and the dom shows data-agent-heading. Reply with the one word done and nothing else.",
      );
      await expect.poll(() => fs.readdirSync(path.join(mods, "my-sidebar")).some((name) => name.endsWith(".js") && fs.readFileSync(path.join(mods, "my-sidebar", name), "utf8").includes("data-agent-heading")), { timeout: 300_000, intervals: [2_000] }).toBe(true);
      await untilReady(ui, 900_000);
      await untilShown(ui, box, "stage2-dom.txt", ["data-agent-heading"]);
      expect(evidence("stage2-check.txt")).toContain("my-sidebar loaded without errors");
      expect(evidence("stage2-dom.txt")).toContain("data-agent-heading");
      const heading = sidebar.locator('[data-agent-heading="terminal"]');
      const shellRow = sidebar.getByTestId(`workspace-session-${shell}`);
      await expect(shellRow).toBeVisible({ timeout: 30_000 });
      await heading.click();
      await expect(shellRow).toBeHidden();
      await heading.click();
      await expect(shellRow).toBeVisible();
      await heading.focus();
      await page.keyboard.press("Enter");
      await expect(shellRow).toBeHidden();
      await page.keyboard.press("Enter");
      await expect(shellRow).toBeVisible();
      await tap(page, heading);
      await expect(shellRow).toBeHidden();
      await tap(page, heading);
      await expect(shellRow).toBeVisible();
      await holdRow(page, shellRow);
      await expect(page.getByTestId("tab-split-menu")).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("tab-split-menu")).toHaveCount(0);
      await afterStage(["my-sidebar"]);

      // Stage 3: a nested dialog. A second window opens Instructions from the sidebar copy's project menu and keeps
      // it open; it is drawn in the dialog shell, so the agent's copy of the shell shows there as soon as it runs.
      const second = await page.context().newPage();
      await second.goto(url, { waitUntil: "networkidle" });
      const openInstructions = async (p: Page) => {
        await p.locator('[data-testid="mod-view-my-sidebar"] [data-testid^="workspace-project-"]', { hasText: project }).first().locator('[data-testid^="workspace-project-menu-"]').click();
        await p.locator('[data-testid^="workspace-project-instructions-"]').first().click();
        const dialog = p.getByTestId("instructions-dialog");
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        return dialog;
      };
      const kept = await openInstructions(second);
      await turn(ui, box, rules +
        `Copy Perch's dialog shell (stock:dialog) as my-dialog and put it in place of Perch's own. Edit only your copy so every dialog it draws shows the text "${dialogLine}" at its bottom, under what the dialog shows. ` +
        "Keep everything else. A dialog shell is drawn only while a dialog is open; another Perch window has one open now (a project's Instructions) and keeps it open, so do not close it. " +
        "After each edit run `perch mod check my-dialog > stage3-check.txt` and `perch mod dom my-dialog > stage3-dom.txt` in the project folder and fix your files until the check passes and stage3-dom.txt shows that text. Reply with the one word done and nothing else.",
      );
      await expect.poll(() => fs.existsSync(path.join(mods, "my-dialog")) && fs.readdirSync(path.join(mods, "my-dialog")).some((name) => name.endsWith(".js") && fs.readFileSync(path.join(mods, "my-dialog", name), "utf8").includes(dialogLine)), { timeout: 300_000, intervals: [2_000] }).toBe(true);
      await untilReady(ui, 900_000);
      await untilShown(ui, box, "stage3-dom.txt", [dialogLine]);
      expect(evidence("stage3-check.txt")).toContain("my-dialog loaded without errors");
      expect(evidence("stage3-dom.txt")).toContain(dialogLine);
      // The open dialog took the edit live, and one opened now from this window's sidebar copy is drawn in it too.
      await expect(kept).toContainText(dialogLine, { timeout: 15_000 });
      await second.close();
      await sidebar.getByTestId("workspace-organize").click();
      await page.getByTestId("workspace-organize-project").click();
      const dialog = await openInstructions(page);
      await expect(dialog).toContainText(dialogLine);
      await expect(page.locator('[data-testid="mod-view-my-dialog"]')).toBeAttached();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await afterStage(["my-sidebar", "my-dialog"]);

      // Stage 4: chat composition. The chat the agent talks through becomes its copy; the next turn goes through it.
      await turn(ui, box, rules +
        `Copy Perch's chat (stock:chat) as my-chat and put it in place of Perch's own. Edit only your copy so the text "${chatLine}" shows directly above the message box. ` +
        "Keep everything else the chat does; this chat is the one you are talking through. After each edit run `perch mod check my-chat > stage4-check.txt` and `perch mod dom my-chat > stage4-dom.txt` in the project folder and fix your files until the check passes. Reply with the one word done and nothing else.",
      );
      await expect.poll(() => fs.existsSync(path.join(mods, "my-chat")) && fs.readdirSync(path.join(mods, "my-chat")).some((name) => name.endsWith(".js") && fs.readFileSync(path.join(mods, "my-chat", name), "utf8").includes(chatLine)), { timeout: 300_000, intervals: [2_000] }).toBe(true);
      const chatCopy = page.locator('[data-testid="mod-view-my-chat"]');
      const copiedUi = chatCopy.getByTestId("native-cli-chat");
      await untilReady(copiedUi, 900_000);
      await untilShown(copiedUi, copiedUi.getByTestId("native-cli-composer"), "stage4-dom.txt", [chatLine]);
      expect(evidence("stage4-check.txt")).toContain("my-chat loaded without errors");
      expect(evidence("stage4-dom.txt")).toContain(chatLine);
      await expect(chatCopy).toContainText(chatLine, { timeout: 30_000 });
      await expect(page.locator('[data-testid="mod-view-stock:chat"]')).toHaveCount(0);
      // A turn through the copy reaches the same agent and its answer shows there.
      const answers = copiedUi.locator('[data-native-role="assistant"]');
      const before = await answers.count();
      await turn(copiedUi, copiedUi.getByTestId("native-cli-composer"), "Reply with the one word pong and nothing else.");
      await untilReady(copiedUi, 300_000);
      await expect.poll(() => answers.count(), { timeout: 60_000 }).toBeGreaterThan(before);
      await expect(answers.last()).toContainText(/pong/i);
      await page.screenshot({ path: testInfo.outputPath("agent-deep-edit.png") });
      await afterStage(["my-sidebar", "my-dialog", "my-chat"]);
    } finally {
      // What the agent wrote, kept with the result whatever the outcome (the fixture is removed afterwards).
      for (const name of ["my-sidebar", "my-dialog", "my-chat"]) keep(name);
    }
  });
});
