/** Managed workspace federation without agent turns. The second core is a
 * deterministic transport regression, not actual-Linux D3 certification. */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

const HUB = "ws://127.0.0.1:7794/ws";
const REMOTE = "ws://127.0.0.1:7795/ws";
const HOST = "workspace-remote";
const ALIAS = "workspace-remote-alias";
const fixture = path.join(fs.realpathSync(os.tmpdir()), `perch-remote-workspace-${crypto.randomUUID()}`);
const local = path.join(fs.realpathSync(os.tmpdir()), `perch-local-workspace-${crypto.randomUUID()}`);
type Message = Record<string, any>;
let workspaceId: string;
let projectId: string;
const checkout = `${fixture}-linked`;
function git(...args: string[]) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: fixture, input: "", timeout: 15000 }).toString();
}

async function request(message: Message, until?: (reply: Message) => boolean, url = HUB): Promise<Message> {
  const ws = new WebSocket(url);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out: ${message.type}`)), 15000);
      ws.onerror = () => { clearTimeout(timer); reject(new Error("WebSocket failed")); };
      ws.onopen = () => ws.send(JSON.stringify(message));
      ws.onmessage = (event) => {
        const reply = JSON.parse(String(event.data));
        if (!(until ? until(reply) : reply.requestId === message.requestId)) return;
        clearTimeout(timer);
        resolve(reply);
      };
    });
  } finally { ws.close(); }
}

async function configure(id: string, enabled = true) {
  return request({ type: "hosts.upsert", host: { id, name: id, sshHost: "", remotePort: 7795, enabled, directUrl: REMOTE } },
    (reply) => reply.type === "host.info" && reply.hostId === id && reply.state === (enabled ? "connected" : "disabled"));
}

function ask(type: string, rest: Message = {}, url = HUB) {
  return request({ type, requestId: crypto.randomUUID(), ...rest }, undefined, url);
}

test.describe("Managed remote workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    fs.mkdirSync(fixture);
    fs.mkdirSync(local);
    fs.writeFileSync(path.join(fixture, "hello.txt"), "remote baseline\n");
    fs.writeFileSync(path.join(local, "hello.txt"), "local sentinel\n");
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Perch test");
    git("config", "user.email", "test@perch.test");
    git("add", ".");
    git("commit", "-qm", "baseline");
    await configure(HOST);
    await configure(ALIAS);
    const created = await request({ type: "project.create", requestId: "create-remote", hostId: HOST, path: fixture, name: "Remote workspace fixture" },
      (reply) => reply.requestId === "create-remote" && (reply.type === "workspace.snapshot" || reply.type === "error"));
    expect(created.type).toBe("workspace.snapshot");
    const workspace = created.workspaces.find((row: Message) => row.path === fixture);
    workspaceId = workspace.id;
    projectId = workspace.projectId;
    await request({ type: "project.create", requestId: "create-local", path: local },
      (reply) => reply.requestId === "create-local" && reply.type === "workspace.snapshot");
  });

  test.afterAll(async () => {
    // Files/drafts are confined to these fixtures. No runtime was launched.
    for (const id of [HOST, ALIAS]) {
      await request({ type: "hosts.delete", id }, (reply) => reply.type === "hosts.updated").catch(() => {});
    }
    if (fs.existsSync(checkout)) git("worktree", "remove", "--force", checkout);
    fs.rmSync(fixture, { recursive: true, force: true });
    fs.rmSync(local, { recursive: true, force: true });
  });

  test("RW1. Inventory is host-qualified, collision-safe and never imported locally", async () => {
    const snapshot = await ask("workspace.snapshot", { hostId: HOST });
    const alias = await ask("workspace.snapshot", { hostId: ALIAS });
    const localSnapshot = await ask("workspace.snapshot");
    const one = snapshot.workspaces.find((row: Message) => row.path === fixture);
    const two = alias.workspaces.find((row: Message) => row.path === fixture);
    expect(one.hostId).toBe(HOST);
    expect(two.hostId).toBe(ALIAS);
    expect(one.id).not.toBe(two.id); // same underlying remote UUID, two hosts
    expect(JSON.parse(one.id.slice("remote:".length))[1]).toBe(JSON.parse(two.id.slice("remote:".length))[1]);
    expect(localSnapshot.workspaces.some((row: Message) => row.path === fixture)).toBe(false);
    expect((await ask("workspace.focus", { workspaceId })).hostId).toBe(HOST);
    expect((await ask("project.rename", { projectId, name: "Remote renamed" })).project.hostId).toBe(HOST);
    const unsupported = await ask("workspace.nest", { workspaceId, parentWorkspaceId: two.id });
    expect(unsupported.code).toBe("invalid_remote_identity");
  });

  test("RW2. Files, search, durable drafts, versioned saves and conflicts stay remote", async () => {
    expect((await ask("fs.tree", { workspaceId })).entries.some((entry: Message) => entry.path === "hello.txt")).toBe(true);
    expect((await ask("fs.search", { workspaceId, query: "hello" })).entries).toHaveLength(1);
    const read = await ask("fs.read", { workspaceId, path: "hello.txt" });
    expect(read.content).toBe("remote baseline\n");
    const buffer = await ask("fs.buffer.get", { workspaceId, path: "hello.txt" });
    const draft = await ask("fs.buffer.set", { workspaceId, path: "hello.txt", content: "draft survives\n", expectedBufferRevision: buffer.buffer.revision });
    expect(draft.buffer.workspaceId).toBe(workspaceId);
    expect(draft.buffer.dirty).toBe(true);
    const diskBefore = fs.readFileSync(path.join(fixture, "hello.txt"), "utf8");
    expect(diskBefore).toBe("remote baseline\n");
    const saved = await ask("fs.write", { workspaceId, path: "hello.txt", content: "draft survives\n", expectedVersion: read.version, expectedBufferRevision: draft.buffer.revision });
    expect(saved.type).toBe("fs.write.result");
    expect(fs.readFileSync(path.join(fixture, "hello.txt"), "utf8")).toBe("draft survives\n");
    expect(fs.readFileSync(path.join(local, "hello.txt"), "utf8")).toBe("local sentinel\n");
    const conflict = await ask("fs.write", { workspaceId, path: "hello.txt", content: "must not overwrite", expectedVersion: read.version, expectedBufferRevision: saved.bufferRevision });
    expect(conflict.type).toBe("fs.error");
    expect(conflict.code).toBe("conflict");
    expect((await ask("fs.read", { workspaceId, path: "../outside" })).type).toBe("fs.error");
    const url = new URL("http://127.0.0.1:7794/workspace-file");
    url.searchParams.set("workspaceId", workspaceId); url.searchParams.set("path", "hello.txt");
    expect((await fetch(url)).status).toBe(501);
  });

  test("RW3. Canonical surfaces and opaque per-viewer presentation belong to the remote", async () => {
    const opened = await ask("surface.open", { workspaceId, viewerId: "remote-workspace-viewer", kind: "file", locator: { path: "hello.txt" } });
    expect(opened.type).toBe("surface.opened");
    expect(opened.surface.hostId).toBe(HOST);
    expect(opened.surface.workspaceId).toBe(workspaceId);
    const layout = { v: 1, strip: [`${workspaceId}\nhello.txt`], sets: [] };
    const saved = await ask("viewer.presentation.set", { workspaceId, viewerId: "remote-workspace-viewer", presentation: { order: [opened.surface.id], activeResourceId: opened.surface.id, layout } });
    expect(saved.presentation.workspaceId).toBe(workspaceId);
    const restored = await ask("viewer.presentation.get", { workspaceId, viewerId: "remote-workspace-viewer" });
    expect(restored.presentation.layout).toEqual(layout);
    const rawWorkspace = JSON.parse(workspaceId.slice("remote:".length))[1];
    const remote = await ask("surface.list", { workspaceId: rawWorkspace }, REMOTE);
    expect(remote.surfaces.find((surface: Message) => surface.id === opened.surface.id).hostId).toBe("local");
    expect((await ask("surface.close", { workspaceId, viewerId: "remote-workspace-viewer", resourceId: opened.surface.id })).type).toBe("surface.closed");
  });

  test("RW4. Sidebar and file editor browse the remote without a remote session", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("host-switcher").click();
    await page.getByTestId(`host-option-${HOST}`).click();
    const row = page.getByTestId(`project-toggle-${projectId}`);
    await expect(row).toBeVisible();
    await row.click();
    if (!(await page.getByTestId("workspace-tools").count())) await page.getByTestId("workspace-tools-toggle").click();
    await page.getByTestId("workspace-tools-files").click();
    await expect(page.getByTestId("workspace-tools")).toContainText("hello.txt");
    await page.getByTestId("workspace-tools").getByText("hello.txt", { exact: true }).dblclick();
    await expect(page.locator(".cm-content")).toContainText("draft survives");
    await page.reload();
    await expect(page.locator(".cm-content")).toContainText("draft survives");
    await configure(HOST, false);
    await page.getByTestId("file-tab-close-hello.txt").click();
    // An unconfirmed remote close cannot remove the canonical tab locally.
    await expect(page.getByTestId("file-tab-close-hello.txt")).toBeVisible();
    await configure(HOST);
    const sessions = await request({ type: "session.list" }, (reply) => reply.type === "session.list", REMOTE);
    expect(sessions.sessions).toHaveLength(0);
  });

  test("RW5. Qualified Git/review and nested worktrees use the same remote inventory", async () => {
    const status = await ask("git.status", { workspaceId, hostId: HOST });
    expect(status.type).toBe("git.status.result");
    expect(status.workspaceId).toBe(workspaceId);
    const comments = await ask("review.list", { workspaceId, hostId: HOST });
    expect(comments.type).toBe("review.list.result");
    const created = await ask("worktree.create", { hostId: HOST, repoPath: fixture, name: "Linked test", path: checkout, parentWorkspaceId: workspaceId });
    expect(created.type).toBe("worktree.done");
    expect(created.workspace.parentWorkspaceId).toBe(workspaceId);
    expect(created.workspace.hostId).toBe(HOST);
    const removed = await ask("worktree.remove", { hostId: HOST, repoPath: fixture, path: checkout, deleteBranch: true });
    expect(removed.type).toBe("worktree.done");
    expect(fs.existsSync(checkout)).toBe(false);
  });

  test("RW6. Disabled host refuses writes, retains draft and recovers on reconnect", async () => {
    const buffer = await ask("fs.buffer.get", { workspaceId, path: "hello.txt" });
    await ask("fs.buffer.set", { workspaceId, path: "hello.txt", content: "offline draft\n", expectedBufferRevision: buffer.buffer.revision });
    await configure(HOST, false);
    const refused = await ask("fs.write", { workspaceId, path: "hello.txt", content: "wrong-host-write" });
    expect(refused.type).toBe("fs.error");
    expect(refused.code).toBe("remote_unavailable");
    expect(fs.readFileSync(path.join(local, "hello.txt"), "utf8")).toBe("local sentinel\n");
    await configure(HOST);
    const recovered = await ask("fs.buffer.get", { workspaceId, path: "hello.txt" });
    expect(recovered.buffer.content).toBe("offline draft\n");
    expect(fs.readFileSync(path.join(fixture, "hello.txt"), "utf8")).toBe("draft survives\n");
  });
});
