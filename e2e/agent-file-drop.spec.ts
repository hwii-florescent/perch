import { test, expect, type Locator } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime";
import { startChat, startFromPanel } from "./projects";
import { LOCAL_TOKEN, localHeaders, localStorageState, withLocalToken } from "./localAuth";

// This core's own UI is the only caller: every request here carries its local token.
const fetch = (input: string, init: RequestInit = {}) => globalThis.fetch(input, { ...init, headers: { ...localHeaders(), ...init.headers } });

async function drop(target: Locator, names: string[], type = "drop", bytes = 0) {
  return target.evaluate((element, { names, type, bytes }) => {
    const dataTransfer = new DataTransfer();
    for (const name of names) dataTransfer.items.add(new File([bytes ? new Uint8Array(bytes).fill(65) : "drop fixture"], name, { type: name.endsWith(".png") ? "image/png" : "text/plain" }));
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
  }, { names, type, bytes });
}

test("external files reach agent and shell prompts through native paste, without submitting", async ({ page, context, browser }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "perch-file-drop-"));
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
  // SSH/SCP stand-ins execute only inside this fixture; no network, credentials,
  // remote machines, or real agent turns are used by the transfer checks.
  const remoteHome = path.join(fixture, "remote home");
  const bin = path.join(fixture, "bin");
  fs.mkdirSync(remoteHome);
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "ssh"), `#!${process.execPath}\nconst { spawnSync } = require('node:child_process');\nconst result = spawnSync('/bin/sh', ['-c', process.argv.at(-1)], { env: { ...process.env, HOME: ${JSON.stringify(remoteHome)}, PATH: '/usr/bin:/bin' }, stdio: 'inherit' });\nprocess.exit(result.status ?? 1);\n`, { mode: 0o700 });
  fs.writeFileSync(path.join(bin, "scp"), `#!${process.execPath}\nconst fs = require('node:fs');\nconst [source, target] = process.argv.slice(-2);\nconst dest = target.slice(target.indexOf(':') + 1);\nfs.copyFileSync(source, dest);\nif (fs.existsSync(${JSON.stringify(path.join(fixture, "fail-scp"))})) { process.stderr.write('fixture SCP failure'); process.exit(1); }\n`, { mode: 0o700 });
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
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: localStorageState() });
  try {
    core = spawn(path.join(root, "target/debug/perch-core"), ["--port", String(port), "--providers-path", providers], {
      cwd: root, env: {
        ...process.env, PERCH_NO_LOGIN_PATH: "1", PATH: `${bin}:${process.env.PATH}`,
        ...fixtureRuntimeEnv(fixture), HOME: fixture,
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
    // The legacy localStorage session can differ from the visible workspace tab.
    // The staged path is keyed by the actual agent session that accepted the drop.
    const sessionId = path.basename(path.dirname(paths[0]));
    for (const staged of paths) expect(fs.readFileSync(staged, "utf8")).toBe("drop fixture");
    await expect(terminal.locator(".xterm-rows")).not.toContainText("SUBMITTED_");

    // The real HTTP route must accept the PDF-sized body that Axum previously
    // rejected at 2 MiB, and the persisted toggle changes only path quoting.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-nav-terminal").click();
    await page.getByTestId("settings-dropped-path-double-quotes").check();
    await page.getByTestId("settings-close").click();
    await expect(terminal).toHaveAttribute("data-writable", "true");
    const largeResponse = page.waitForResponse((response) => response.url().includes("name=presentation.pdf"));
    expect(await drop(surface, ["presentation.pdf"], "drop", 3 * 1024 * 1024)).toBe(true);
    const receivedLarge = await largeResponse;
    expect(receivedLarge.status(), await receivedLarge.text()).toBe(200);
    await expect.poll(async () => {
      const alert = terminal.getByRole("alert");
      if (await alert.count()) throw new Error(await alert.innerText());
      return input.filter((message) => message.data.includes("presentation.pdf")).length;
    }).toBe(1);
    const largePaste = input.find((message) => message.data.includes("presentation.pdf"))!.data;
    expect(largePaste).toMatch(/^\x1b\[200~".*presentation.pdf" \x1b\[201~$/);
    const largePath = /"([^"]+)"/.exec(largePaste)![1];
    expect(fs.statSync(largePath).size).toBe(3 * 1024 * 1024);
    await expect(terminal.locator(".xterm-rows")).not.toContainText("SUBMITTED_");

    // Unpaired viewers share the local device identity. Assert the gesture
    // acquires no control, rather than assuming an initial ownership state.
    await phoneContext.addInitScript((sessionId) => {
      localStorage.setItem("perch.onboarding.seen", "1");
      localStorage.setItem("perch.sessionId", sessionId!);
    }, sessionId);
    const phone = await phoneContext.newPage();
    const phoneInput: { data: string; shared?: boolean }[] = [];
    let acquisitions = 0;
    phone.on("websocket", (socket) => socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "terminal.input") phoneInput.push(message);
      if (message.type === "agent.control.acquire") acquisitions++;
    }));
    await phone.goto(url, { waitUntil: "networkidle" });
    const phoneTerminal = phone.getByTestId("persistent-agent-terminal");
    await expect(phoneTerminal).toHaveAttribute("data-writable", "true");
    await expect(phoneTerminal).toHaveAttribute("data-terminal-id", (await terminal.getAttribute("data-terminal-id"))!);
    const acquisitionsBeforeDrop = acquisitions;
    expect(await drop(phoneTerminal.locator(".terminal__surface"), ["phone.png"])).toBe(true);
    await expect.poll(() => phoneInput.some((message) => message.shared && message.data.includes("phone.png"))).toBe(true);
    await expect(terminal.locator(".xterm-rows")).toContainText("phone.png");
    expect(acquisitions).toBe(acquisitionsBeforeDrop);
    await expect(phoneTerminal.locator(".xterm-rows")).not.toContainText("SUBMITTED_");

    await page.screenshot({ path: testInfo.outputPath("agent-drop-desktop.png") });
    await phone.screenshot({ path: testInfo.outputPath("agent-drop-mobile.png") });

    // Reject a declared over-cap body before receiving or allocating it.
    const oversized = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection(port, "127.0.0.1");
      socket.setTimeout(5000, () => { socket.destroy(); reject(new Error("oversized upload was not rejected")); });
      socket.on("error", reject);
      socket.on("connect", () => socket.write("POST /upload HTTP/1.1\r\nHost: 127.0.0.1:" + port + "\r\nAuthorization: Bearer " + LOCAL_TOKEN + "\r\nContent-Length: 1073741825\r\n\r\n"));
      socket.once("data", (data) => { resolve(data.toString()); socket.destroy(); });
    });
    expect(oversized).toContain("413");
    expect((await fetch(`${url}/upload`, { method: "POST", body: "" })).status).toBe(400);

    // Exercise configured-host ownership, explicit SCP intent, success and
    // partial-transfer cleanup through the real endpoint and subprocess flow.
    const ws = new WebSocket(withLocalToken(`${url.replace("http", "ws")}/ws`));
    const messages: { type: string; sessionId?: string }[] = [];
    ws.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data))));
    await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error("fixture socket failed")); });
    try {
      ws.send(JSON.stringify({ type: "hosts.upsert", host: { id: "scp-fixture", name: "SCP fixture", sshHost: "fixture.invalid", remotePort: 7788, enabled: true, mode: "direct" } }));
      await expect.poll(() => messages.some((message) => message.type === "hosts.updated")).toBe(true);
      const createdBefore = messages.filter((message) => message.type === "session.created").length;
      ws.send(JSON.stringify({ type: "session.create", cwd: "/fixture/workspace", hostId: "scp-fixture" }));
      await expect.poll(() => messages.filter((message) => message.type === "session.created").length).toBe(createdBefore + 1);
      const remoteSession = messages.findLast((message) => message.type === "session.created")!.sessionId!;
      // Legacy direct sessions become durable when their agent PTY attaches.
      // The fake SSH process cannot reach a host or launch a real agent.
      ws.send(JSON.stringify({ type: "terminal.create", cols: 80, rows: 24, agentAttach: { sessionId: remoteSession, agent: "codex" } }));
      await expect.poll(() => messages.some((message) => message.type === "terminal.created")).toBe(true);
      const uploadUrl = `${url}/upload?sessionId=${remoteSession}&hostId=scp-fixture&name=presentation.pdf`;
      expect((await fetch(uploadUrl, { method: "POST", body: "missing intent" })).status).toBe(400);
      expect((await fetch(`${url}/upload?sessionId=${sessionId}&hostId=scp-fixture&scp=1`, { method: "POST", body: "wrong owner" })).status).toBe(409);
      const uploaded = await fetch(`${uploadUrl}&scp=1`, { method: "POST", body: new Uint8Array(3 * 1024 * 1024).fill(66) });
      expect(uploaded.status, await uploaded.clone().text()).toBe(200);
      const remotePath = (await uploaded.json()).path as string;
      expect(remotePath.startsWith(path.join(remoteHome, ".perch/uploads", remoteSession) + "/drop.")).toBe(true);
      expect(fs.statSync(remotePath).size).toBe(3 * 1024 * 1024);
      expect(fs.statSync(remotePath).mode & 0o777).toBe(0o600);
      const remoteRoot = path.dirname(path.dirname(remotePath));
      const before = fs.readdirSync(remoteRoot);
      fs.writeFileSync(path.join(fixture, "fail-scp"), "fail");
      expect((await fetch(`${uploadUrl}&scp=1`, { method: "POST", body: "failed transfer" })).status).toBe(502);
      await expect.poll(() => fs.readdirSync(remoteRoot)).toEqual(before);
      expect(fs.readFileSync(remotePath)[0]).toBe(66);
      expect(fs.readdirSync(path.join(fixture, ".perch/uploads", remoteSession))).toEqual([]);
      expect((await fetch(`${url}/upload?sessionId=${remoteSession}&hostId=missing&scp=1`, { method: "POST", body: "missing host" })).status).toBe(400);

      // Seed a persisted Terminal launch: legacy agentAttach supports only
      // Claude/Codex. Upload authorization must not reject the shell provider.
      execFileSync("sqlite3", ["-cmd", ".timeout 5000", path.join(fixture, "history.sqlite"),
        `UPDATE sessions SET cli_provider_id = 'terminal' WHERE id = '${remoteSession.replace(/'/g, "''")}'`]);
      fs.unlinkSync(path.join(fixture, "fail-scp"));
      const shellUploadUrl = `${url}/upload?sessionId=${remoteSession}&hostId=scp-fixture&name=shell.txt`;
      expect((await fetch(shellUploadUrl, { method: "POST", body: "missing intent" })).status).toBe(400);
      const shellUploaded = await fetch(`${shellUploadUrl}&scp=1`, { method: "POST", body: "remote shell drop" });
      expect(shellUploaded.status, await shellUploaded.clone().text()).toBe(200);
      expect(fs.readFileSync((await shellUploaded.json()).path, "utf8")).toBe("remote shell drop");
    } finally { ws.close(); }

    await startChat(page, "terminal");
    await expect(page.getByTestId("chat-tab-agent-badge")).toContainText("terminal");
    await expect(terminal).toHaveAttribute("data-writable", "true");
    const uploadsBeforeShellDrop = uploads;
    expect(await drop(surface, ["shell.png"], "dragover")).toBe(true);
    expect(await drop(surface, ["shell.png"])).toBe(true);
    await expect.poll(() => uploads).toBe(uploadsBeforeShellDrop + 1);
    await expect.poll(() => input.filter((message) => message.data.includes("shell.png")).length).toBe(1);
    const shellPaste = input.find((message) => message.data.includes("shell.png"))!;
    expect(shellPaste.data).not.toMatch(/[\r\n]/);
    await expect(terminal.getByRole("alert")).toHaveCount(0);

    // An agent started by typing in a Terminal tab must accept the same drops,
    // without changing the tab's saved launch provider or submitting the prompt.
    const shellInput = terminal.locator(".xterm-helper-textarea");
    await shellInput.press("Control+u");
    const manualAgent = `printf '\\033[2J\\033[H\\033[?2004hMANUAL_READY\\n'; while IFS= read -r line; do printf 'MANUAL_SUBMITTED_%s\\n' "$line"; done`;
    // exec keeps the stand-in in the fixture's owned process group for cleanup.
    await shellInput.pressSequentially(`exec /bin/sh -c '${manualAgent.replace(/'/g, "'\\''")}'`);
    await shellInput.press("Enter");
    await expect(terminal.locator(".xterm-rows")).toContainText("MANUAL_READY");
    await expect(terminal.locator(".xterm-rows")).not.toContainText("while IFS=");
    const inputBeforeManualDrop = input.length;
    expect(await drop(surface, ["manual-agent.png"])).toBe(true);
    await expect.poll(() => input.slice(inputBeforeManualDrop).filter((message) => message.data.includes("manual-agent.png")).length).toBe(1);
    const manualPaste = input.slice(inputBeforeManualDrop).find((message) => message.data.includes("manual-agent.png"))!;
    expect(manualPaste.data).toMatch(/^\x1b\[200~".*manual-agent.png" \x1b\[201~$/);
    expect(manualPaste.data).not.toMatch(/[\r\n]/);
    await expect(terminal.locator(".xterm-rows")).not.toContainText("MANUAL_SUBMITTED_");
    await expect(page.getByTestId("chat-tab-agent-badge")).toContainText("terminal");
    // A second shell tab must receive its own drop, not paste into the first.
    const manualTerminalId = await terminal.getAttribute("data-terminal-id");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+p" : "Control+Shift+p");
    await page.getByTestId("navigator-input").fill("new terminal");
    await page.getByTestId("navigator-command-terminal").click();
    const shell = page.locator(`[data-testid="persistent-agent-terminal"]:not([data-terminal-id="${manualTerminalId}"])`);
    await expect(shell).toHaveAttribute("data-writable", "true");
    const inputBeforePaneDrop = input.length;
    expect(await drop(shell.locator(".terminal__surface"), ["shell-pane.png"])).toBe(true);
    await expect.poll(() => input.slice(inputBeforePaneDrop).filter((message) => message.data.includes("shell-pane.png")).length).toBe(1);
    const panePaste = input.slice(inputBeforePaneDrop).find((message) => message.data.includes("shell-pane.png"))!;
    expect(panePaste.terminalId).toBe(await shell.getAttribute("data-terminal-id"));
    expect(panePaste.data).not.toMatch(/[\r\n]/);
    expect(errors).toEqual([]);
    // Inspect both settings layouts only after terminal assertions: changing
    // device layout can remount a terminal view and change its control lease.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("settings-nav-terminal").click();
    await expect(page.getByTestId("settings-dropped-path-double-quotes")).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath("drop-settings-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("settings-dropped-path-double-quotes")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("drop-settings-mobile.png") });
  } finally {
    if (core && core.exitCode === null && core.signalCode === null) {
      const child = core;
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
    }
    await cleanupFixtureRuntime(root, fixture);
    await phoneContext.close();
    await context.close();
    fs.closeSync(log);
    await testInfo.attach("core.log", { body: fs.readFileSync(logPath), contentType: "text/plain" });
    fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
