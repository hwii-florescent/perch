// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("./NewSessionPopover", () => ({ NewSessionPopover: () => null }));
const { usePerchStore } = await import("../store");
const { NoSessionPanel, CliStartPanel } = await import("./StartScreen");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const createSessionOnHost = vi.fn(), startCli = vi.fn();
const project = (id: string, path: string, name: string) => ({ id, hostId: "local", name, path, favorite: false, createdAt: 1, updatedAt: 1 });
const app = project("app", "/work/app", "app");
const other = project("other", "/work/other", "other");
// A worktree of `app`: a workspace whose path is not a listed project's.
const worktree = { id: "wt", projectId: "app", hostId: "local", path: "/work/app-wt", name: "app-wt", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  // A desktop window: the start screen follows the person's choice there (a phone keeps Perch's own).
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ connected: true, activeHostId: "local", workspaceProjects: [app, other], workspaces: [worktree], activeWorkspaceId: "wt", sessions: [], sessionId: null, createSessionOnHost, startCli, workspaceProjectCreate: null });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const choose = (testId: string, text: string) => {
  act(() => host.querySelector<HTMLButtonElement>(`[data-testid=${testId}]`)!.click());
  const row = Array.from(document.body.querySelectorAll<HTMLElement>("[role=option]")).find((option) => option.textContent?.startsWith(text));
  if (!row) throw new Error(`no option ${text}`);
  act(() => row.click());
};
const start = (id: string) => act(() => host.querySelector<HTMLButtonElement>(`[data-testid=${id}]`)!.click());

it("a workspace's start screen launches in its exact folder by default, even a worktree that is no project", () => {
  act(() => root.render(<NoSessionPanel connected />));
  start("workspace-start-claude");
  expect(createSessionOnHost).toHaveBeenCalledExactlyOnceWith("local", "/work/app-wt", "claude");
});

it("launches in the project or Quickchat picked instead", () => {
  act(() => root.render(<NoSessionPanel connected />));
  choose("workspace-start-target", "other");
  start("workspace-start-codex");
  expect(createSessionOnHost).toHaveBeenLastCalledWith("local", "/work/other", "codex");
  choose("workspace-start-target", "No project");
  start("workspace-start-claude");
  expect(createSessionOnHost).toHaveBeenLastCalledWith("local", "~", "claude");
});

it("the CLI start screen launches in the picked project, Quickchat, or resumes the open session in place", () => {
  act(() => root.render(<CliStartPanel />));
  choose("cli-start-target", "other");
  start("cli-start-agent-claude");
  expect(createSessionOnHost).toHaveBeenLastCalledWith("local", "/work/other", "claude");
  choose("cli-start-target", "No project");
  start("cli-start-agent-codex");
  expect(createSessionOnHost).toHaveBeenLastCalledWith("local", "~", "codex");

  act(() => usePerchStore.setState({ sessionId: "open", sessions: [{ id: "open", title: "t", hostId: "local", workspaceId: "wt", projectId: "app", cwd: "/work/app-wt", cliProviderId: "terminal", createdAt: 1, status: "idle" as const }] }));
  choose("cli-start-target", "app-wt (this session)");
  start("cli-start-agent-claude");
  expect(startCli).toHaveBeenCalledExactlyOnceWith("open", "claude");
});

it("Add project selects the project it creates, and launches there", () => {
  act(() => root.render(<NoSessionPanel connected />));
  choose("workspace-start-target", "Add project");
  expect(createSessionOnHost).not.toHaveBeenCalled();
  const fresh = project("fresh", "/work/fresh", "fresh");
  act(() => usePerchStore.setState({ workspaceProjects: [app, other, fresh], workspaceProjectCreate: { requestId: "r", hostId: "local", path: "/work/fresh", status: "success" } }));
  start("workspace-start-claude");
  expect(createSessionOnHost).toHaveBeenCalledExactlyOnceWith("local", "/work/fresh", "claude");
});

it("a cancelled Add project keeps the previous folder", () => {
  act(() => root.render(<NoSessionPanel connected />));
  choose("workspace-start-target", "other");
  choose("workspace-start-target", "Add project");
  start("workspace-start-claude");
  expect(createSessionOnHost).toHaveBeenCalledExactlyOnceWith("local", "/work/other", "claude");
});
