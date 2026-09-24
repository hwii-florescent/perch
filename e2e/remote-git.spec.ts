/**
 * remote-git.spec.ts — git state and worktrees on a remote perch host.
 *
 * The hub (:7799) reaches the remote (:7800) by `directUrl`, no ssh. One real
 * turn, pinned to claude-haiku-4-5 on the wire, creates the remote session the
 * sidebar groups by cwd. Then, all through the hub:
 *
 *   RG1 — `host.info` relays the remote's worktree/git/review capabilities
 *         and nothing else (`hub::RELAYED_CAPABILITIES`)
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

const HUB_WS = "ws://127.0.0.1:7799/ws";
const HOST_ID = "e2e-remote-git";
const HOST_NAME = "e2e remote git";
const FIXTURE_NAME = `perch-e2e-remote-git-${Date.now().toString(36)}`;
let FIXTURE = path.join(os.tmpdir(), FIXTURE_NAME);
const WORKTREES_ROOT = path.join(os.homedir(), ".perch", "worktrees", FIXTURE_NAME);

function sh(cmd: string, cwd = FIXTURE): string {
  // stdin closed + bounded: see workspace-git.spec.ts on git hooks reading stdin.
  return execSync(cmd, { cwd, input: "", timeout: 15000 }).toString();
}

type Message = Record<string, unknown> & { type: string };

/** Send `messages` on a fresh hub connection; resolve with the first reply
 * matching `until`. */
async function hubRequest(messages: object[], until: (m: Message) => boolean, timeout = 20000): Promise<Message> {
  const ws = new WebSocket(HUB_WS);
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
  await page.goto("http://127.0.0.1:7799", { waitUntil: "networkidle" });
  await page.locator('[data-testid="host-switcher"]').click();
  await page.locator(`[data-testid="host-option-${HOST_ID}"]`).click();
  await expect(page.locator('[data-testid="host-switcher"] .sidebar__env-host')).toHaveText(HOST_NAME, { timeout: 10000 });
  const row = page.locator(".sidebar__project-header", { has: page.locator(`[data-project-cwd="${FIXTURE}"]`) });
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
      [{ type: "hosts.upsert", host: { id: HOST_ID, name: HOST_NAME, sshHost: "", remotePort: 7800, enabled: true, directUrl: "ws://127.0.0.1:7800/ws" } }],
      (m) => m.type === "host.info" && m.hostId === HOST_ID && m.state === "connected",
    );
    capabilities = (info.capabilities as string[] | undefined) ?? [];
    // The one paid call: a haiku turn so the remote persists the session.
    const ws = new WebSocket(HUB_WS);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("remote turn timed out")), 150000);
      let sessionId = "";
      ws.onmessage = (event) => {
        const m = JSON.parse(String(event.data)) as Message;
        if (m.type === "session.created" && !sessionId) {
          sessionId = m.sessionId as string;
          ws.send(JSON.stringify({ type: "chat.send", sessionId, text: "Reply with just: OK", agent: "claude", model: "claude-haiku-4-5" }));
        }
        if (m.type === "chat.done" && m.sessionId === sessionId) {
          clearTimeout(timer);
          resolve();
        }
      };
      ws.onopen = () => ws.send(JSON.stringify({ type: "session.create", cwd: FIXTURE, hostId: HOST_ID }));
    });
    ws.close();
  });

  test.afterAll(async () => {
    await hubRequest([{ type: "hosts.delete", id: HOST_ID }, { type: "hosts.list" }], (m) => m.type === "hosts.list").catch(() => {});
    fs.rmSync(WORKTREES_ROOT, { recursive: true, force: true });
    fs.rmSync(FIXTURE, { recursive: true, force: true });
  });

  test("RG1. host.info relays only the worktree, git and review capabilities", () => {
    expect(capabilities).toEqual(expect.arrayContaining(["worktree.startFrom", "worktree.delete", "git.status", "git.commit", "review.list"]));
    expect(capabilities.every((cap) => /^(worktree\.(startFrom|delete)|git\.|review\.)/.test(cap))).toBe(true);
  });

  test("RG2. The sidebar branch line follows a branch switch on the remote", async ({ page }) => {
    const row = await openRemoteHost(page);
    await expect(row.locator(`[data-testid="workspace-git-${HOST_ID}"]`)).toHaveText(/main/, { timeout: 20000 });
    sh("git switch -q -c remote-feature");
    await expect(row.locator(`[data-testid="workspace-git-${HOST_ID}"]`)).toHaveText(/remote-feature/, { timeout: 20000 });
    sh("git switch -q main");
  });

  test("RG3. Git & review works on the remote checkout", async ({ page }) => {
    fs.writeFileSync(path.join(FIXTURE, "remote-change.txt"), "from the hub\n");
    const row = await openRemoteHost(page);
    await row.locator(`[data-testid="project-git-review-${HOST_ID}"]`).click();
    // No local workspace row names it, so the panel uses the session's folder.
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
    await popover.locator('[data-testid="worktree-new"]').click();
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
