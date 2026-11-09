/**
 * Live check of herdr's "ask the agent to change the app": a Claude lead (haiku) that a person has just
 * spoken to reads `perch guide` and `perch mod api`, writes a mod that shows a todo list, enables it and
 * puts it on screen, and the page then draws it and the list works; then it is asked to turn Perch into an
 * IDE and writes a layout (files, panes, git) and selects it. What is asserted is the mod's files
 * in the core's folder and the page's own DOM, not what the model said. Isolated core and daemon, see
 * docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts agent-mods.spec.ts --workers 1
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
    if ((await ui.getByRole("status").innerText().catch(() => "")) === "Ready") return;
    const card = ui.getByTestId("native-cli-request");
    if (await card.isVisible().catch(() => false)) await card.getByTestId("native-cli-request-option-1").click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("the lead did not become ready");
}

test("an agent asked to change Perch writes a todo-list mod and an IDE layout that the page draws", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-agentmods-"));
  const heading = `Todos${Date.now().toString(36)}`;
  const port = await freePort();
  let core: ChildProcess | undefined;
  let log: number | undefined;
  const ui = page.getByTestId("native-cli-chat");
  const cli = page.getByTestId("persistent-agent-terminal");
  const box = ui.getByTestId("native-cli-composer");
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

    await box.fill(
      "Use the shell and no other tools, and only the perch command to reach Perch. First run `perch guide`, then `perch mod api` and `perch mod examples`. " +
      `Then change Perch so it shows a todo list: write a Perch mod (named todo-list) whose view has the heading "${heading}", a text input and an "Add" button; ` +
      "each time Add is pressed the input's text is added to a list under it. Enable the mod, put it on screen with `perch mod open todo-list`, and check it with `perch mod check todo-list`. " +
      "Reply with the one word done and nothing else.",
    );
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
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
    await box.fill(
      "Use the shell and no other tools, and only the perch command to reach Perch. " +
      "Now change Perch into an IDE: write a layout named ide with the project's files on the left, the open session's panes in the middle and git on the right, " +
      "select it with `perch mod layout ide`, and check it with `perch mod status`. Reply with the one word done and nothing else.",
    );
    await ui.getByRole("button", { name: "Send", exact: true }).click();
    await expect(box).toHaveValue("", { timeout: 15_000 });
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
});
