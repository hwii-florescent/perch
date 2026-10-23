/**
 * remote-git.spec.ts — git state and worktrees on a remote perch host.
 *
 * The hub reaches a second core by directUrl, no SSH or paid agent turns.
 * Durable remote metadata makes the sidebar useful without a session.
 * All operations go through the hub:
 *
 *   RG1 — `host.info` relays verified workspace/file/surface and Git/review
 *         capabilities, not unsupported media/jobs/runtime families
 *   RG2 — the sidebar's branch line follows a branch switch on the remote
 *   RG3 — Git & review opens for the remote checkout; stage and commit land
 *         in the remote repo
 *   RG4 — the worktree menu offers the task name + start-from form, and
 *         Delete reviews a branch with unmerged work
 *
 * The fixture repo lives in the OS temp dir. The remote is this machine, so
 * its default worktree root is `~/.perch/worktrees/<fixture>`, removed in
 * `afterAll`.
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const HUB_PORT = process.env.PERCH_E2E_HUB_PORT ?? "7799";
const REMOTE_PORT = Number(process.env.PERCH_E2E_REMOTE_PORT ?? "7800");
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;
const HUB_WS = `ws://127.0.0.1:${HUB_PORT}/ws`;
const REMOTE_WS = `ws://127.0.0.1:${REMOTE_PORT}/ws`;
const HOST_ID = "e2e-remote-git";
const HOST_NAME = "e2e remote git";
const FIXTURE_NAME = `perch-e2e-remote-git-${Date.now().toString(36)}`;
let FIXTURE = path.join(os.tmpdir(), FIXTURE_NAME);
let REMOTE_PROJECT_ID = "";
let REMOTE_WORKSPACE_ID = "";
const WORKTREES_ROOT = path.join(os.homedir(), ".perch", "worktrees", FIXTURE_NAME);

function sh(cmd: string, cwd = FIXTURE): string {
  // stdin closed + bounded: see workspace-git.spec.ts on git hooks reading stdin.
  return execSync(cmd, { cwd, input: "", timeout: 15000 }).toString();
}

type Message = Record<string, unknown> & { type: string };

/** Send `messages` on a fresh hub connection; resolve with the first reply
 * matching `until`. */
async function hubRequest(messages: object[], until: (m: Message) => boolean, timeout = 20000, url = HUB_WS): Promise<Message> {
  const ws = new WebSocket(url);
  try {
    return await new Promise<Message>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("hub request timed out")), timeout);
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as Message;
        if (until(message)) {
          clearTimeout(timer);
          resolve(message);
        }
      };
      ws.onopen = () => messages.forEach((m) => ws.send(JSON.stringify(m)));
    });
  } finally {
    ws.close();
  }
}

async function openRemoteHost(page: Page): Promise<Locator> {
  await page.goto(HUB_URL, { waitUntil: "networkidle" });
  await page.locator('[data-testid="host-switcher"]').click();
  await page.locator(`[data-testid="host-option-${HOST_ID}"]`).click();
  await expect(page.locator('[data-testid="host-switcher"] .sidebar__env-host')).toHaveText(HOST_NAME, { timeout: 10000 });
  const row = page.getByTestId(`workspace-project-${REMOTE_PROJECT_ID}`);
  await expect(row).toBeVisible({ timeout: 20000 });
  return row;
}

test.describe("Remote host git and worktrees", () => {
  test.describe.configure({ mode: "serial" });
  let capabilities: string[] = [];

  test.beforeAll(async () => {
    test.setTimeout(180000);
    fs.mkdirSync(FIXTURE, { recursive: true });
    FIXTURE = fs.realpathSync(FIXTURE);
    sh("git init -q -b main");
    sh('git config user.name "perch e2e" && git config user.email e2e@perch.test');
    sh("git commit -q --allow-empty -m init");
    const info = await hubRequest(
      [{ type: "hosts.upsert", host: { id: HOST_ID, name: HOST_NAME, sshHost: "", remotePort: REMOTE_PORT, enabled: true, directUrl: REMOTE_WS } }],
      (m) => m.type === "host.info" && m.hostId === HOST_ID && m.state === "connected",
    );
    capabilities = (info.capabilities as string[] | undefined) ?? [];
    const snapshot = await hubRequest([{ type: "project.create", requestId: "rg-project", hostId: HOST_ID, path: FIXTURE }],
      (m) => m.requestId === "rg-project" && m.type === "workspace.snapshot");
    const workspace = (snapshot.workspaces as Array<{ id: string; projectId: string; path: string }>).find((row) => row.path === FIXTURE)!;
    REMOTE_PROJECT_ID = workspace.projectId;
    REMOTE_WORKSPACE_ID = workspace.id;

  });

  test.afterAll(async () => {
    await hubRequest([{ type: "hosts.delete", id: HOST_ID }, { type: "hosts.list" }], (m) => m.type === "hosts.list").catch(() => {});
    fs.rmSync(WORKTREES_ROOT, { recursive: true, force: true });
    fs.rmSync(FIXTURE, { recursive: true, force: true });
  });

  test("RG1. host.info relays verified workspace and resource capabilities", () => {
    expect(capabilities).toEqual(expect.arrayContaining(["workspace.snapshot", "project.create", "fs.read", "fs.write", "surface.v1", "worktree.startFrom", "worktree.delete", "git.status", "git.commit", "review.list"]));
    for (const unsupported of ["fs.content", "worktree.job", "attention.v1", "terminal.open"]) expect(capabilities).not.toContain(unsupported);
  });

  test("RG2. The sidebar branch line follows a branch switch on the remote", async ({ page }) => {
    const row = await openRemoteHost(page);
    await expect(row.getByTestId(`project-toggle-${REMOTE_PROJECT_ID}`)).toHaveText(/main/, { timeout: 20000 });
    sh("git switch -q -c remote-feature");
    await expect(row.getByTestId(`project-toggle-${REMOTE_PROJECT_ID}`)).toHaveText(/remote-feature/, { timeout: 20000 });
    sh("git switch -q main");
  });

  test("RG3. Git & review works on the remote checkout", async ({ page }) => {
    fs.writeFileSync(path.join(FIXTURE, "remote-change.txt"), "from the hub\n");
    const row = await openRemoteHost(page);
    await row.getByTestId(`workspace-entry-${REMOTE_WORKSPACE_ID}`).click({ button: "right" });
    await page.getByTestId(`workspace-menu-git-${REMOTE_WORKSPACE_ID}`).click();
    // The owning host's durable workspace names the review.
    await expect(page.locator('[data-testid="workspace-git-review"]')).toContainText(FIXTURE_NAME, { timeout: 20000 });
    const status = page.locator('[data-testid="git-status"]');
    await expect(status).toContainText("1 changed path", { timeout: 20000 });
    await expect(status).toContainText("remote-change.txt");
    await status.getByLabel("Select all changed paths").check();
    await status.getByRole("button", { name: "Stage selected" }).click();
    await expect.poll(() => sh("git diff --cached --name-only"), { timeout: 10000 }).toContain("remote-change.txt");
    await status.getByPlaceholder("Describe the change").fill("Commit from the hub");
    await status.getByRole("button", { name: "Preview commit" }).click();
    await page.locator('[data-testid="git-confirm-action"]').click();
    await expect.poll(() => sh("git log -1 --format=%s"), { timeout: 10000 }).toBe("Commit from the hub\n");
    await expect(status).toContainText("No changes", { timeout: 10000 });
    await page.screenshot({ path: "artifacts/remote-git-rg3-committed.png" });
  });

  test("RG4. The remote worktree menu offers start-from and reviews Delete", async ({ page }) => {
    const row = await openRemoteHost(page);
    await row.locator(`[data-testid="worktree-menu-${HOST_ID}-${FIXTURE}"]`).click();
    const popover = page.locator(`[data-testid="worktree-popover-${HOST_ID}-${FIXTURE}"]`);
    if (await popover.locator('[data-testid="worktree-new"]').isVisible()) await popover.locator('[data-testid="worktree-new"]').click(); // + opens on the form
    await popover.locator('[data-testid="worktree-name-input"]').fill("Remote task");
    await expect(popover.locator('[data-testid="worktree-start-input"]')).toBeVisible();
    await expect(popover.locator('[data-testid="worktree-new-branch"]')).toHaveCount(0);
    await popover.locator('[data-testid="worktree-create-submit"]').click();
    const entry = popover.locator(".worktree-menu__entry").filter({ has: page.locator(".worktree-menu__entry-branch", { hasText: "remote-task" }) });
    await expect(entry).toBeVisible({ timeout: 30000 });
    const checkout = path.join(WORKTREES_ROOT, "remote-task");
    sh('git commit -q --allow-empty -m "remote only work"', checkout);

    await entry.locator('[data-testid^="worktree-remove-"]').click();
    await expect(page.locator('[data-testid="confirm-accept"]')).toHaveText("Delete");
    await page.locator('[data-testid="confirm-accept"]').click();
    await expect(page.locator(".confirm-dialog__message")).toContainText("branch remote-task was kept", { timeout: 20000 });
    await expect(page.locator(".confirm-dialog__message")).toContainText("remote only work");
    await page.screenshot({ path: "artifacts/remote-git-rg4-review.png" });
    await page.locator('[data-testid="confirm-accept"]').click();
    await expect.poll(() => sh("git branch"), { timeout: 10000 }).not.toContain("remote-task");
    expect(fs.existsSync(checkout)).toBe(false);
  });
});
