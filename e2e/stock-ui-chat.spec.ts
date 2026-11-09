/**
 * The native chat runs from its stock package (`stock:chat`) on @perch/sdk against a real Claude (haiku, banner and
 * model checked before any turn): an untouched clone chosen in its place shows the same chat and the same unsent
 * draft (Perch's own `chatComposer`), a deep edit changes only the clone, a send started in the clone and carried
 * through a swap back to stock reaches the agent exactly once, and the phone keeps its own chat. One paid turn.
 * Isolated core and daemon, see docs/TESTING.md.
 *
 *   cd e2e && npx playwright test -c native-composer.config.ts stock-ui-chat.spec.ts
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
import { cheapModelEnv, CHEAP_CLAUDE_MODEL } from "./cheapModel";

/** `mods.set` over a short-lived socket of the page's own origin; resolves with the reply's error. */
const modsSet = (page: Page, body: Record<string, unknown>) => page.evaluate((body) => new Promise<string | null>((resolve, reject) => {
  const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws`);
  const requestId = crypto.randomUUID();
  const timer = setTimeout(() => { ws.close(); reject(new Error("mods.set timed out")); }, 10_000);
  ws.onopen = () => ws.send(JSON.stringify({ type: "mods.set", requestId, ...body }));
  ws.onmessage = (event) => {
    const answer = JSON.parse(event.data);
    if (answer.type !== "mods.state" || answer.requestId !== requestId) return;
    clearTimeout(timer); ws.close(); resolve(answer.error ?? null);
  };
}), body);

test("the chat runs from its stock package; a clone in its place keeps the unsent draft, a deep edit changes only the clone, a send carried through a swap is sent once, and the phone keeps its own", async ({ page, context }, testInfo) => {
  test.setTimeout(300_000);
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-stock-chat-"));
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); });
  });
  fs.writeFileSync(path.join(fixture, "hosts.json"), '{"hosts":[]}');
  fs.writeFileSync(path.join(fixture, "providers.json"), '{"version":1,"providers":[]}');
  const project = path.join(fixture, "project");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "README.md"), "stock chat check\n");
  const log = fs.openSync(path.join(fixture, "core.log"), "a");
  const url = `http://127.0.0.1:${port}`;
  let core: ChildProcess | undefined;
  const prompts: string[] = [];
  page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => { const message = JSON.parse(String(payload)); if (message.type === "agent.ui.prompt") prompts.push(message.text); });
  });
  await context.addInitScript((directory) => {
    if (location.protocol !== "http:" || window !== window.top) return;
    localStorage.setItem("perch.onboarding.seen", "1");
    localStorage.setItem("perch.dirBrowser.lastPath.local", directory);
  }, project);
  const cli = page.getByTestId("persistent-agent-terminal");
  const view = (owner: string) => page.locator(`[data-testid="mod-view-${owner}"]`);
  const composer = (owner: string) => view(owner).getByTestId("native-cli-composer");
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--db-path", path.join(fixture, "history.sqlite"), "--hosts-path", path.join(fixture, "hosts.json"), "--providers-path", path.join(fixture, "providers.json")], { cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture), PERCH_NO_LOGIN_PATH: "1", ...cheapModelEnv("claude", fixture) }, stdio: ["ignore", log, log] });
    await expect.poll(async () => { if (core?.exitCode !== null) throw new Error("Core exited"); try { return (await fetch(url)).ok; } catch { return false; } }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await addProject(page, project);
    await startFromPanel(page, { agent: "claude", where: path.basename(project) });
    await expect(cli).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30_000 });
    await expect(cli.locator(".xterm-rows")).toContainText(/Claude Code/, { timeout: 30_000 });
    await setChatMode(page, "ui");

    // Stock, from the build's package, on the SDK alone; the cheap model is checked before anything is sent.
    await expect(view("stock:chat").getByTestId("native-cli-chat")).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(view("stock:chat").locator(".native-cli-chat__model")).toHaveAttribute("data-model", CHEAP_CLAUDE_MODEL);
    const files = ["main", "chat"];
    const shipped = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await (await page.request.get(`${url}/stock-ui/chat/${file}.js`)).text()] as const)));
    expect(shipped.chat).toContain('from "@perch/sdk"');
    for (const text of Object.values(shipped)) expect(text).not.toMatch(/from "\.\.?\/[^"]*(store|ws|chatComposer|chatSession|markdown|nativeChat\/)/);
    await expect(composer("stock:chat")).toHaveAttribute("placeholder", "Message this CLI…");
    await composer("stock:chat").fill("UNSENT_CHAT_DRAFT");

    // The untouched clone, chosen in its place, shows the same chat and the same unsent draft.
    expect(await modsSet(page, { id: "stock:chat", op: "clone", as: "e2e-my-chat" })).toBeNull();
    await expect.poll(() => modsSet(page, { id: "stock:chat", op: "use", target: "e2e-my-chat" }), { timeout: 15_000 }).toBeNull();
    await expect(view("e2e-my-chat").getByTestId("native-cli-chat")).toHaveAttribute("data-native-pid", /\d+/, { timeout: 25_000 });
    await expect(view("stock:chat")).toHaveCount(0);
    await expect(composer("e2e-my-chat")).toHaveValue("UNSENT_CHAT_DRAFT");

    // A deep edit (not the entry file): the clone's composer asks differently. Stock's files are untouched.
    const at = path.join(fixture, "mods", "e2e-my-chat", "chat.js");
    const text = fs.readFileSync(at, "utf8");
    expect(text).toContain('"Message this CLI…"');
    fs.writeFileSync(at, text.replace('"Message this CLI…"', '"Ask the clone…"'));
    await expect(composer("e2e-my-chat")).toHaveAttribute("placeholder", "Ask the clone…", { timeout: 15_000 });
    await expect(composer("e2e-my-chat")).toHaveValue("UNSENT_CHAT_DRAFT");
    for (const file of files) expect(await (await page.request.get(`${url}/stock-ui/chat/${file}.js`)).text()).toBe(shipped[file]);

    // A send from the clone, carried through a swap back to stock while it is in flight: one prompt, one turn.
    await composer("e2e-my-chat").fill("Reply with exactly STOCK_CHAT_OK and nothing else.");
    await view("e2e-my-chat").getByRole("button", { name: "Send", exact: true }).click();
    expect(await modsSet(page, { id: "stock:chat", op: "use", target: "" })).toBeNull();
    const stock = view("stock:chat").getByTestId("native-cli-chat");
    await expect(stock.locator('[data-native-role="user"]')).toHaveCount(1, { timeout: 60_000 });
    await expect(stock.getByRole("status")).toHaveText("Ready", { timeout: 150_000 });
    await expect(stock.locator('[data-native-role="assistant"]').last()).toContainText("STOCK_CHAT_OK");
    expect(prompts.filter((prompt) => prompt.includes("STOCK_CHAT_OK"))).toHaveLength(1);
    await expect(composer("stock:chat")).toHaveAttribute("placeholder", "Message this CLI…");

    // The phone keeps its own chat: the stock source compiled in, with the same transcript.
    await modsSet(page, { id: "stock:chat", op: "use", target: "e2e-my-chat" });
    await expect(composer("e2e-my-chat")).toHaveAttribute("placeholder", "Ask the clone…", { timeout: 15_000 });
    await page.setViewportSize({ width: 375, height: 700 });
    const phone = page.getByTestId("mobile-pane-shell");
    await expect(phone.getByTestId("native-cli-composer")).toHaveAttribute("placeholder", "Message this CLI…", { timeout: 15_000 });
    await expect(phone.locator('[data-native-role="assistant"]').last()).toContainText("STOCK_CHAT_OK");
    await expect(page.locator('[data-testid="mod-view-e2e-my-chat"]')).toHaveCount(0);
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGKILL"); });
    }
    await cleanupFixtureRuntime(root, fixture).catch((error) => {
      testInfo.annotations.push({ type: "cleanup", description: String(error).slice(0, 400) });
      const daemonDir = `--dir ${fs.realpathSync(fixture)}/daemon`;
      for (const line of execFileSync("ps", ["-axo", "pid,command"], { encoding: "utf8" }).split("\n").filter((entry) => entry.includes(daemonDir))) {
        const pid = Number(line.trim().split(/\s+/)[0]);
        try { process.kill(-pid, "SIGTERM"); process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
      }
    });
    fs.closeSync(log);
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
