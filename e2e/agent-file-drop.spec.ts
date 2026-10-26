import { test, expect, type Locator } from "@playwright/test";
import { spawn, execFileSync, spawnSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { startChat, startFromPanel } from "./projects";

async function drop(target: Locator, names: string[], type = "drop") {
  return target.evaluate((element, { names, type }) => {
    const dataTransfer = new DataTransfer();
    for (const name of names) dataTransfer.items.add(new File(["drop fixture"], name, { type: name.endsWith(".png") ? "image/png" : "text/plain" }));
    const rect = element.getBoundingClientRect();
    const event = new DragEvent(type, {
      bubbles: true, cancelable: true, dataTransfer,
      clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
    });
    // Observe drop at the surface, before Dockview's existing bubble listener.
    // Its capture-phase dragover listener always cancels, including for shells.
    let handled = false;
    element.addEventListener(type, (event) => { handled = event.defaultPrevented; }, { once: true });
    element.dispatchEvent(event);
    return handled;
  }, { names, type });
}

test("external files reach only agent prompts through native paste, without submitting", async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-file-drop-"));
  const daemon = path.join(fixture, "daemon");
  const port = await new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const providers = path.join(fixture, "providers.json");
  fs.writeFileSync(providers, JSON.stringify({ version: 1, providers: [{
    id: "drop-fixture", display_name: "Drop fixture",
    launch: {
      executable: "/bin/sh",
      prefix_args: ["-c", "printf '\\033[?2004hDROP_READY\\n'; while IFS= read -r line; do printf 'SUBMITTED_%s\\n' \"$line\"; done"],
      prompt: "stdin", suffix_args: [], resume: "Unsupported",
    },
    supported_modes: ["cli"], resumability: "persistentProcess",
    capabilities: ["interactiveTerminal"], status_detection: "ExitStatus",
    environment: { inherit: true, allow: [], set: {}, unset: [] },
  }] }));
  const logPath = path.join(fixture, "core.log");
  const log = fs.openSync(logPath, "a");
  let core: ChildProcess | undefined;
  const input: { terminalId: string; data: string; shared?: boolean }[] = [];
  const errors: string[] = [];
  let uploads = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/upload") uploads++; });
  page.on("websocket", (socket) => socket.on("framesent", ({ payload }) => {
    const message = JSON.parse(String(payload));
    if (message.type === "terminal.input") input.push(message);
  }));
  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--providers-path", providers], {
      cwd: root, env: {
        ...process.env, HOME: fixture, PERCH_NO_LOGIN_PATH: "1",
        PERCH_DB: path.join(fixture, "history.sqlite"), PERCH_HOSTS: path.join(fixture, "hosts.json"),
        PERCHD_DIR: daemon, PERCH_SETTINGS: path.join(fixture, "settings.json"),
      }, stdio: ["ignore", log, log],
    });
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(fs.readFileSync(logPath, "utf8"));
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);
    await page.goto(url, { waitUntil: "networkidle" });
    await startFromPanel(page, { agent: "drop-fixture" });
    const terminal = page.getByTestId("persistent-agent-terminal");
    await expect(terminal).toHaveAttribute("data-writable", "true");
    await expect(terminal.locator(".xterm-rows")).toContainText("DROP_READY");
    const sessionId = await page.evaluate(() => localStorage.getItem("perch.sessionId"));
    const surface = terminal.locator(".terminal__surface");
    await drop(surface, ["image.png"], "dragenter");
    expect(await drop(surface, ["notes with 'quotes'.txt", "image.png"], "dragover")).toBe(true);
    await expect(page.locator(".dv-drop-target")).toHaveCount(0);
    expect(uploads).toBe(0);
    expect(await drop(surface, ["notes with 'quotes'.txt", "image.png"])).toBe(true);
    await expect.poll(() => uploads).toBe(2);
    await expect.poll(() => input.filter((message) => message.data.includes("/uploads/")).length).toBe(1);
    const pasted = input.find((message) => message.data.includes("/uploads/"))!;
    expect(pasted.data).toMatch(/^\x1b\[200~'.*notes_with__quotes_.txt' '.*image.png' \x1b\[201~$/);
    expect(pasted.data).not.toMatch(/[\r\n]/);
    const paths = [...pasted.data.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    for (const staged of paths) expect(fs.readFileSync(staged, "utf8")).toBe("drop fixture");
    await expect(terminal.locator(".xterm-rows")).not.toContainText("SUBMITTED_");

    // A second writable viewer can drop without taking the resize/stop lease.
    await phoneContext.addInitScript((sessionId) => {
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sessionId", sessionId!);
    }, sessionId);
    const phone = await phoneContext.newPage();
    const phoneInput: { data: string; shared?: boolean }[] = [];
    phone.on("websocket", (socket) => socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "terminal.input") phoneInput.push(message);
    }));
    await phone.goto(url, { waitUntil: "networkidle" });
    const phoneTerminal = phone.getByTestId("persistent-agent-terminal");
    await expect(phoneTerminal).toHaveAttribute("data-writable", "true");
    await expect(phoneTerminal).not.toHaveAttribute("data-controlling", "true");
    expect(await drop(phoneTerminal.locator(".terminal__surface"), ["phone.png"])).toBe(true);
    await expect.poll(() => phoneInput.some((message) => message.shared && message.data.includes("phone.png"))).toBe(true);
    await expect(terminal.locator(".xterm-rows")).toContainText("phone.png");
    await expect(phoneTerminal.locator(".xterm-rows")).not.toContainText("SUBMITTED_");
    await page.screenshot({ path: testInfo.outputPath("agent-drop-desktop.png") });
    await phone.screenshot({ path: testInfo.outputPath("agent-drop-mobile.png") });

    await startChat(page, "terminal");
    await expect(page.getByTestId("chat-tab-agent-badge")).toContainText("terminal");
    await expect(terminal).toHaveAttribute("data-writable", "true");
    const uploadsBeforeShellDrop = uploads;
    await drop(surface, ["shell.png"], "dragover");
    expect(await drop(surface, ["shell.png"])).toBe(false);
    await expect(terminal.getByRole("status")).toHaveCount(0);
    await expect(terminal.getByRole("alert")).toHaveCount(0);
    expect(uploads).toBe(uploadsBeforeShellDrop);
    expect(input.some((message) => message.data.includes("shell.png"))).toBe(false);
    await terminal.locator(".xterm-helper-textarea").pressSequentially("printf SHELL_INPUT_OK");
    await terminal.locator(".xterm-helper-textarea").press("Enter");
    await expect(terminal.locator(".xterm-rows")).toContainText("SHELL_INPUT_OK");
    expect(uploads).toBe(uploadsBeforeShellDrop);
    expect(errors).toEqual([]);
  } finally {
    await phoneContext.close();
    await context.close();
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
    }
    // This daemon and its PTYs are private to this fixture, never the installed app.
    const daemonPattern = `__perchd serve --dir ${daemon}$`;
    try { execFileSync("pkill", ["-f", daemonPattern]); }
    catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
    await expect.poll(() => spawnSync("pgrep", ["-f", daemonPattern]).status, { timeout: 5000 }).toBe(1);
    fs.closeSync(log);
    await testInfo.attach("core.log", { body: fs.readFileSync(logPath), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
