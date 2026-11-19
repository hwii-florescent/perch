// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";

vi.mock("../ws", () => ({ socket: { connect: vi.fn(), send: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
const { usePerchStore } = await import("../store");
const { useToolsContext } = await import("./WorkspaceTools");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it.each([true, false])("a Quickchat tab's Files follow its folder from ~, with Git only inside a repo (desktop: %s)", (scoped) => {
  let seen: ReturnType<typeof useToolsContext> | null = null;
  const Probe = () => { seen = useToolsContext(null, scoped); return null; };
  const quickchat = { id: "q", hostId: "local", name: "Quickchat", path: "/home/me", favorite: false, createdAt: 1, updatedAt: 1, quickchat: true };
  const home = { id: "wq", projectId: "q", hostId: "local", path: "/home/me", name: "me", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
  const tab = (over: Partial<SessionSummary>) => ({ id: "chat", cwd: "/home/me", hostId: "local", projectId: "q", workspaceId: "wq", status: "idle", createdAt: 1, ...over }) as SessionSummary;
  usePerchStore.setState({ workspaceProjects: [quickchat], workspaces: [home], sessionId: "chat", activeWorkspaceId: "wq", sessions: [tab({ currentCwd: "/home/me" })] });
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  const shown = () => ({ path: seen!.row?.path, git: seen!.isGit });
  expect(shown()).toEqual({ path: "/home/me", git: false });
  act(() => usePerchStore.setState({ sessions: [tab({ currentCwd: "/home/me/repo", currentBranch: "main" })] }));
  expect(shown()).toEqual({ path: "/home/me/repo", git: true });
  act(() => usePerchStore.setState({ sessions: [tab({ currentCwd: "/home/me/notes" })] }));
  expect(shown()).toEqual({ path: "/home/me/notes", git: false });
  act(() => root.unmount());
});
