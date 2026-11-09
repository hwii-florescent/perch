// @vitest-environment jsdom
// The sidebar body's two navigation paths: a host with projects (`workspace.snapshot`) gets the project overview, an
// older host without them the legacy list of sessions by folder, whose rows still act through Perch's commands.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionSummary } from "@perch/shared";

const socket = vi.hoisted(() => ({ send: () => {}, connect: () => {}, switchSession: (_id: string) => {}, onMessage: () => () => {}, onConnectionChange: () => () => {} }));
vi.mock("../../ws", () => ({ socket }));
vi.mock("../../keybinds", async (original) => ({ ...(await original<object>()), useNestShortcutHints: () => [] }));
const { usePerchStore } = await import("../../store");
const { SidebarContent } = await import("./content");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
const chat = (id: string, cwd: string) => ({ id, title: `${id} chat`, hostId: "local", cwd, cliProviderId: "claude", createdAt: 1, status: "idle" }) as SessionSummary;

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  storage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({
    connected: true, activeHostId: "local", hostStates: {}, hosts: [], workspaceProjects: [], workspaces: [], workspaceCapabilities: [],
    sessionId: "a", activeProject: null, sessions: [chat("a", "/tmp/alpha"), chat("b", "/tmp/alpha"), chat("c", "/tmp/beta")],
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const get = (selector: string) => host.querySelector(selector);

it("a host without projects lists its sessions by folder, and a row opens its session through Perch", () => {
  act(() => root.render(<SidebarContent />));
  expect(get('[data-testid="workspace-overview"]')).toBeNull();
  expect(get('[data-testid="project-list"]')).not.toBeNull();
  const folders = [...host.querySelectorAll('[data-testid="project-row"]')].map((row) => row.getAttribute("data-project-cwd"));
  expect(folders.sort()).toEqual(["/tmp/alpha", "/tmp/beta"]);
  const row = get('[data-session-id="b"]') as HTMLButtonElement | null;
  expect(row).not.toBeNull();
  const switched = vi.spyOn(socket, "switchSession");
  act(() => row!.click());
  expect(switched).toHaveBeenCalledWith("b");
});

it("a host with projects gets the project overview instead", () => {
  usePerchStore.setState({ workspaceCapabilities: ["workspace.snapshot"] });
  act(() => root.render(<SidebarContent />));
  expect(get('[data-testid="workspace-overview"]')).not.toBeNull();
  expect(get('[data-testid="project-row"]')).toBeNull();
});
