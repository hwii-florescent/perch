// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DirectoryEntry, GitStatusEntry } from "@perch/shared";
import { fileAppearance, gitPresentation, indexGitDecorations } from "./fileDecorations";

vi.mock("../ws", () => ({ socket: { connected: true, send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const { WorkspaceFilesView } = await import("./WorkspaceFiles");
const { usePerchStore } = await import("../store");
const { useWorkspaceFilesStore } = await import("../filesystemStore");
const { useWorkspaceGitReviewStore, EMPTY_GIT_REVIEW_STATE } = await import("../gitReviewStore");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout/scrolling implementation; the browser regression checks real keyboard scrolling.
HTMLElement.prototype.scrollIntoView = vi.fn();

const entry = (path: string, overrides: Partial<GitStatusEntry> = {}): GitStatusEntry => ({ path, index: "unmodified", worktree: "modified", staged: false, unstaged: true, ...overrides });
it.each([
  ["App.tsx", "react"], ["view.JSX", "react"], ["types.d.ts", "language"], ["script.mjs", "language"],
  ["main.rs", "language"], ["main.py", "language"], ["base.scss", "style"], ["README.md", "book"],
  ["package.json", "package"], ["Cargo.toml", "package"], ["pyproject.toml", "package"], ["go.mod", "package"],
  ["pnpm-lock.yaml", "config"], ["Cargo.lock", "config"], [".env.local", "config"], [".gitignore", "branch"],
  ["Dockerfile.dev", "package"], ["icon.svg", "image"], ["page.html", "code"], ["unknown.blob", "file"],
  ["file.__proto__", "file"], ["file.constructor", "file"],
])("recognizes %s as %s without inspecting file contents", (name, kind) => expect(fileAppearance(name).kind).toBe(kind));
it("uses folder conventions without mistaking dotted folders for files or known names for ignore rules", () => {
  expect(fileAppearance("lib", true).kind).toBe("library");
  expect(fileAppearance("node_modules", true)).toEqual({ kind: "package", tone: "text-subtext-0" });
  expect(fileAppearance("App.tsx", true).kind).toBe("folder");
  expect(fileAppearance("ts").kind).toBe("file");
});
it.each([
  [entry("a"), "M"],
  [entry("a", { index: "untracked", worktree: "untracked" }), "U"],
  [entry("a", { index: "added", worktree: "unmodified", staged: true, unstaged: false }), "A"],
  [entry("a", { index: "modified", staged: true }), "M/M"],
  [entry("a", { index: "added", staged: true }), "A/M"],
  [entry("a", { worktree: "deleted" }), "D"],
  [entry("a", { index: "renamed", worktree: "unmodified", staged: true, unstaged: false }), "R"],
  [entry("a", { worktree: "copied" }), "C"], [entry("a", { worktree: "typeChanged" }), "T"],
  [entry("a", { index: "conflicted", worktree: "deleted", staged: true }), "!"],
  [entry("a", { worktree: { unknown: "future" } }), "?"],
  [entry("a", { index: "unmodified", worktree: "unmodified", unstaged: false }), ""],
])("presents index/working-tree states accurately: %j → %s", (value, label) => expect(gitPresentation(value).label).toBe(label));
it("explains staged vs working-tree changes and rename origins without implying diagnostics", () => {
  const badge = gitPresentation(entry("new.ts", { index: "renamed", originalPath: "old.ts", staged: true }));
  expect(badge.label).toBe("R/M");
  expect(badge.title).toBe("Git · Index: renamed; working tree: modified; from old.ts");
  expect(gitPresentation(entry("a", { index: "conflicted" })).tone).toBe("text-red");
});
it("indexes exact paths and descendant summaries, including deleted and renamed paths, without prefix/case collisions", () => {
  const changes = indexGitDecorations([
    entry("src/deep/a.ts"), entry("src/deleted.ts", { worktree: "deleted" }),
    entry("other/new.ts", { index: "renamed", worktree: "unmodified", originalPath: "old/deep.ts", staged: true, unstaged: false }),
    entry("conflict/x.ts", { worktree: "conflicted" }), entry("srcx/a.ts"), entry(" spaced .ts"),
    entry("dest/copy.ts", { worktree: "copied", originalPath: "source/a.ts" }),
  ]);
  expect(changes.get("src")?.containsChanges).toBe(true);
  expect(changes.get("src/deep")?.containsChanges).toBe(true);
  expect(changes.get("src/deleted.ts")?.entry?.worktree).toBe("deleted");
  expect(changes.get("old")?.containsChanges).toBe(true);
  expect(changes.get("old/deep.ts")).toBeUndefined();
  expect(changes.get("conflict")?.conflicted).toBe(true);
  expect(changes.get("src/a.ts")).toBeUndefined();
  expect(changes.get("SRC")).toBeUndefined();
  expect(changes.get("source")).toBeUndefined();
  expect(changes.get(" spaced .ts")?.entry).toBeDefined();
});

let root: Root;
let host: HTMLDivElement;
const refresh = vi.fn(() => null);
const requestTree = vi.fn();
const open = vi.fn();
const workspace = { id: "w", projectId: "p", hostId: "local", path: "/tmp/explorer", name: "Original", branch: "main", dirty: true, state: "active" as const, createdAt: 1, updatedAt: 1 };
const project = { id: "p", hostId: "local", path: workspace.path, repoPath: workspace.path, name: "Birdhouse", favorite: false, createdAt: 1, updatedAt: 1 };
const file = (path: string, kind: DirectoryEntry["kind"] = "file"): DirectoryEntry => ({ path, name: path.split("/").at(-1)!, kind, size: 0, readonly: false, executable: false });
const tree = { workspaceId: "w", path: "", entries: [file("src", "directory"), file("package.json"), file("fresh.ts")], state: "ready" as const, truncated: false };
const initialFiles = useWorkspaceFilesStore.getState();
const initialGit = useWorkspaceGitReviewStore.getState();
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  usePerchStore.setState({ connected: true, activeHostId: "local", workspaces: [workspace], workspaceProjects: [project], sessions: [], serverInfo: { hostname: "test", isSsh: false, platform: "test", protocolVersion: 2, capabilities: ["git.status"] } });
  useWorkspaceFilesStore.setState({ trees: { w: { "": tree, src: { ...tree, path: "src", entries: [file("src/App.tsx")] } } }, documents: {}, previews: {}, searches: {}, requestTree });
  useWorkspaceGitReviewStore.setState({ refreshStatus: refresh, workspaces: { w: { ...EMPTY_GIT_REVIEW_STATE, statusState: "ready", status: { workspaceId: "w", root: workspace.path, branch: "main", dirty: true, conflicted: false, entries: [entry("src/App.tsx"), entry("fresh.ts", { index: "untracked", worktree: "untracked" })] } } } });
});
afterEach(() => { act(() => root.unmount()); host.remove(); useWorkspaceFilesStore.setState(initialFiles, true); useWorkspaceGitReviewStore.setState(initialGit, true); });
const render = () => act(() => root.render(<WorkspaceFilesView workspaceId="w" layout="explorer" onOpenFile={open} />));
const get = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const click = (el: HTMLElement) => act(() => el.click());
it("renders shared icons, ancestor dots and file markers while preserving explorer opening", () => {
  render();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(get("workspace-file-entry-package.json").querySelector('[data-file-icon="package"]')).not.toBeNull();
  expect(get("workspace-file-entry-src").querySelector('[aria-label="Contains Git changes"]')).not.toBeNull();
  expect(get("workspace-file-entry-fresh.ts").querySelector('[data-testid="file-git-marker"]')?.textContent).toBe("U");
  click(get("workspace-file-entry-src"));
  expect(get("workspace-file-entry-src/App.tsx").querySelector('[data-file-icon="react"]')).not.toBeNull();
  expect(get("workspace-file-entry-src/App.tsx").textContent).toBe("App.tsxM");
  click(get("workspace-file-entry-src/App.tsx"));
  expect(open).toHaveBeenCalledWith("src/App.tsx", false);
  expect(host.textContent).not.toMatch(/errors|warnings|diagnostics/i);
});
it("labels snapshots and refresh/error/disconnection honestly, retries on reconnect, and doesn't fetch in flight", () => {
  render();
  expect(get("explorer-git-state").textContent).toBe("Git snapshot");
  act(() => useWorkspaceGitReviewStore.setState(s => ({ workspaces: { w: { ...s.workspaces.w!, statusState: "loading" } } })));
  expect(get("explorer-git-state").textContent).toBe("Updating Git…");
  expect(get("workspace-file-entry-fresh.ts").textContent).toContain("U");
  act(() => useWorkspaceFilesStore.setState({ trees: { w: { "": { ...tree } } } }));
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => useWorkspaceGitReviewStore.setState(s => ({ workspaces: { w: { ...s.workspaces.w!, statusState: "error", statusError: "Offline" } } })));
  expect(get("explorer-git-state").textContent).toBe("Git unavailable");
  expect(host.querySelector('[data-testid="file-git-marker"]')).toBeNull();
  act(() => usePerchStore.setState({ connected: false }));
  act(() => usePerchStore.setState({ connected: true }));
  expect(refresh).toHaveBeenCalledTimes(2);
});
it("uses the same icons and Git markers in search results", () => {
  render();
  click(host.querySelector<HTMLButtonElement>('[aria-label="Search files"]')!);
  act(() => {
    const input = get("workspace-files-search") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "fresh");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    useWorkspaceFilesStore.setState({ searches: { w: { query: "fresh", state: "ready", entries: [file("fresh.ts")], truncated: false } } });
  });
  const row = get("workspace-file-entry-fresh.ts");
  expect(row.querySelector('[data-file-icon="language"]')).not.toBeNull();
  expect(row.querySelector('[data-testid="file-git-marker"]')?.textContent).toBe("U");
});
it("keeps plain folders useful without Git or diagnostic placeholders", () => {
  usePerchStore.setState({ workspaces: [{ ...workspace, branch: undefined }], workspaceProjects: [{ ...project, repoPath: undefined }] });
  render();
  expect(refresh).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="explorer-git-state"]')).toBeNull();
  expect(host.querySelector('[data-testid="file-git-marker"]')).toBeNull();
  expect(get("workspace-file-entry-package.json").querySelector("svg")).not.toBeNull();
});
