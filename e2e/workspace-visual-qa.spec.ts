/**
 * V-11 populated desktop/mobile visual and interaction QA.
 *
 * The open defect this targets is *pane-width* responsiveness: dockview can
 * hand a pane a narrow width while the browser itself is wide, so viewport
 * media queries never fire and controls clip. Everything here is therefore
 * measured against the pane's own box, not the window's.
 *
 * Each surface is populated before it is measured — an empty pane cannot show
 * an overflow — and every run leaves screenshots in `screenshots-visual-qa/`
 * (gitignored) to be looked at, not only asserted on.
 *
 * Boots its own core with its own database, so it never touches the shared hub
 * or ~/.perch. Headless only.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as net from "node:net";
import * as path from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";

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

interface Clipped {
  label: string;
  right: number;
  bottom: number;
}

/**
 * Every visible control inside `pane` must sit within the pane's own box.
 * Anything inside a scroll container is skipped: a diff body is *meant* to
 * scroll horizontally, while a toolbar or a row action is not.
 */
async function clippedControls(pane: Locator): Promise<Clipped[]> {
  return pane.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    const scrollable = (element: Element): boolean => {
      for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowX)) return true;
      }
      return false;
    };
    const clipped: Clipped[] = [];
    for (const element of Array.from(root.querySelectorAll("button, select, input, textarea, a[href]"))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(element).visibility === "hidden") continue;
      if (scrollable(element)) continue;
      const label = (element.getAttribute("data-testid") ?? element.textContent?.trim().slice(0, 40) ?? element.tagName).trim();
      if (box.right > bounds.right + 1 || box.left < bounds.left - 1) {
        clipped.push({ label: `${label} (horizontal)`, right: box.right, bottom: box.bottom });
      }
    }
    return clipped;
  });
}


/**
 * A focus ring the user can actually see. Checked by focusing the control and
 * reading the computed style, because "we set :focus-visible somewhere" is not
 * evidence that this particular control shows one.
 */
async function expectFocusVisible(pane: Locator, selector: string): Promise<void> {
  const control = pane.locator(selector).first();
  await control.focus();
  const visible = await control.evaluate((element) => {
    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth || "0") > 0;
    const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
    const border = parseFloat(style.borderWidth || "0") > 0;
    return outline || shadow || border;
  });
  expect(visible, `${selector} shows no focus indicator`).toBe(true);
}


/**
 * Status text a user can actually read: present, not blank, not shrunk below
 * ~11px, and not silently truncated to nothing.
 */
async function expectReadableStatus(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  const metrics = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      text: (element.textContent ?? "").trim(),
      size: parseFloat(style.fontSize || "0"),
      width: element.getBoundingClientRect().width,
    };
  });
  expect(metrics.text.length, "status text is empty").toBeGreaterThan(0);
  expect(metrics.size, "status text is below 11px").toBeGreaterThanOrEqual(11);
  expect(metrics.width, "status text has collapsed").toBeGreaterThan(20);
}

/** No surface may make the page itself scroll sideways. */
async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, "page scrolls horizontally").toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test("populated surfaces stay usable at narrow panes, wide desktop and phone width", async ({ page, context }, testInfo) => {
  const root = path.resolve(__dirname, "..");
  const shots = path.join(__dirname, "screenshots-visual-qa");
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "perch-qa-home-"));
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "perch-qa-repo-")));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const hosts = path.join(home, "hosts.json");
  const coreLog: string[] = [];
  const errors: string[] = [];
  let core: ChildProcess | null = null;

  fs.mkdirSync(shots, { recursive: true });
  fs.mkdirSync(path.join(repo, "src", "deeply", "nested"), { recursive: true });
  fs.writeFileSync(path.join(repo, RELATIVE_FILE), "committed sentinel\n");
  fs.writeFileSync(path.join(repo, "src", "deeply", "nested", "a-rather-long-file-name.txt"), "nested\n");
  fs.writeFileSync(path.join(repo, "README.md"), "# populated fixture\n");
  git("-c init.defaultBranch=main init -q", repo);
  git("add -A", repo);
  git('commit -q -m "initial"', repo);
  // Populate what the surfaces render: a modification and an addition.
  fs.writeFileSync(path.join(repo, RELATIVE_FILE), "modified sentinel with a fairly long line of content\n");
  fs.writeFileSync(path.join(repo, "untracked-with-a-long-name.txt"), "new file\n");
  fs.writeFileSync(hosts, JSON.stringify({ hosts: [] }));

  await context.addInitScript(() => localStorage.setItem("perch.onboarding.seen", "1"));
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    core = spawn(
      path.join(root, "target/debug/perch-core"),
      ["--port", String(port), "--db-path", path.join(home, "history.sqlite"), "--hosts-path", hosts, "--cwd", repo],
      { cwd: root, env: { ...process.env, PERCH_NO_LOGIN_PATH: "1" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    core.stdout?.on("data", (chunk) => coreLog.push(String(chunk)));
    core.stderr?.on("data", (chunk) => coreLog.push(String(chunk)));
    await expect.poll(async () => {
      if (core?.exitCode !== null) throw new Error(`fixture core exited: ${coreLog.join("")}`);
      try { return (await fetch(url)).ok; } catch { return false; }
    }, { timeout: 20_000 }).toBe(true);

    // A deliberately narrow desktop window: wide enough that no phone media
    // query applies, narrow enough that the panes themselves are cramped.
    await page.setViewportSize({ width: 900, height: 820 });
    await page.goto(url, { waitUntil: "networkidle" });
    await expect(page.getByTestId("workspace-overview")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-add-project").click();
    await page.getByTestId("workspace-project-path").fill(repo);
    await page.getByRole("button", { name: "Register project", exact: true }).click();
    const project = page.locator(".workspace-project").filter({ hasText: path.basename(repo) });
    await expect(project).toBeVisible({ timeout: 15000 });
    const gitButton = project.locator('[data-testid^="workspace-git-"]').first();
    await expect(gitButton).toBeVisible({ timeout: 15000 });
    const workspaceId = (await gitButton.getAttribute("data-testid"))!.slice("workspace-git-".length);

    // --- Git review, narrow desktop pane ---------------------------------
    await gitButton.click();
    const review = page.getByTestId("workspace-git-review");
    await expect(review).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("git-status")).toContainText("changed path", { timeout: 20000 });
    await expect(page.getByTestId("git-diff")).toContainText("modified sentinel", { timeout: 20000 });
    await page.screenshot({ path: path.join(shots, "git-narrow-desktop.png"), fullPage: false });
    expect(await clippedControls(review), "Git review controls clipped at a narrow pane width").toEqual([]);
    await expectNoPageOverflow(page);

    // The whole point of the pane is the review action, so exercise it here
    // rather than only measuring boxes.
    const line = page.locator('[data-testid="git-diff-line"][data-side="new"]').filter({ hasText: "modified sentinel" }).first();
    await expect(line).toBeVisible({ timeout: 15000 });
    await line.getByTestId("git-comment-add").click();
    await expect(page.getByTestId("git-comment-composer")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("git-comment-body").fill("narrow pane note");
    await page.getByRole("button", { name: "Add comment", exact: true }).click();
    await expect(page.locator(".workspace-git__comment").filter({ hasText: "narrow pane note" })).toBeVisible({ timeout: 15000 });
    expect(await clippedControls(review), "Git review controls clipped once a comment thread renders").toEqual([]);

    // --- Files, narrow desktop pane --------------------------------------
    await project.locator(`[data-testid="workspace-files-${workspaceId}"]`).click();
    const files = page.getByTestId("workspace-files-view");
    await expect(files).toBeVisible({ timeout: 15000 });
    await page.getByTestId("workspace-file-entry-src").click();
    await page.getByTestId(`workspace-file-entry-${RELATIVE_FILE}`).click();
    await expect(page.getByTestId("workspace-file-editor")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(shots, "files-narrow-desktop.png"), fullPage: false });
    expect(await clippedControls(files), "file controls clipped at a narrow pane width").toEqual([]);
    await expectNoPageOverflow(page);

    // --- Phone width ------------------------------------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("mobile-switch").click();
    await page.getByTestId("mobile-switcher").locator(`[data-testid="workspace-git-${workspaceId}"]`).click();
    await expect(page.getByTestId("mobile-active-pane-gitReview")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("git-diff")).toContainText("modified sentinel", { timeout: 20000 });
    await page.screenshot({ path: path.join(shots, "git-phone.png"), fullPage: false });
    expect(await clippedControls(page.getByTestId("workspace-git-review")), "Git review controls clipped at phone width").toEqual([]);
    await expectNoPageOverflow(page);

    await page.getByTestId("mobile-switch").click();
    await page.getByTestId("mobile-switcher").locator(`[data-testid="workspace-files-${workspaceId}"]`).click();
    await expect(page.getByTestId("workspace-files-view")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(shots, "files-phone.png"), fullPage: false });
    expect(await clippedControls(page.getByTestId("workspace-files-view")), "file controls clipped at phone width").toEqual([]);
    await expectNoPageOverflow(page);

    // --- Wide desktop: the same surfaces, plus terminal and settings -----
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(`[data-testid="workspace-git-${workspaceId}"]`).first().click();
    await expect(review).toBeVisible({ timeout: 15000 });
    expect(await clippedControls(review), "Git review controls clipped at a wide viewport").toEqual([]);
    await expectFocusVisible(review, '[data-testid="git-refresh"]');
    await expectNoPageOverflow(page);

    await expectReadableStatus(page.locator(".status-item--cwd").first());

    await page.getByRole("button", { name: "Open terminal", exact: true }).click();
    const shell = page.locator(".terminal--persistent[data-pane-id]:visible").first();
    await expect(shell).toHaveAttribute("data-terminal-id", /.+/, { timeout: 30000 });
    expect(await clippedControls(shell), "terminal controls clipped at a wide viewport").toEqual([]);
    await expectNoPageOverflow(page);

    await page.getByTestId("settings-gear").click();
    const settings = page.getByTestId("settings-modal");
    await expect(settings).toBeVisible({ timeout: 10000 });
    expect(await clippedControls(settings), "settings controls clipped at a wide viewport").toEqual([]);
    await page.screenshot({ path: path.join(shots, "settings-wide-desktop.png"), fullPage: false });
    await page.keyboard.press("Escape");

    // Settings must not become a desktop-only dead end at phone width.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("settings-gear").click();
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 10000 });
    expect(await clippedControls(page.getByTestId("settings-modal")), "settings controls clipped at phone width").toEqual([]);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: path.join(shots, "settings-phone.png"), fullPage: false });
    await page.keyboard.press("Escape");

    await expectReadableStatus(page.getByTestId("mobile-header"));

    // Every workspace surface stays reachable from the phone shell.
    for (const pane of ["chat", "terminal", "files", "git"] as const) {
      const tab = page.getByTestId(`mobile-pane-${pane}`);
      if (!(await tab.count())) continue;
      await tab.click();
      await expect(page.getByTestId(`mobile-active-pane-${pane === "git" ? "gitReview" : pane}`))
        .toBeVisible({ timeout: 15000 });
      await expectNoPageOverflow(page);
    }

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
