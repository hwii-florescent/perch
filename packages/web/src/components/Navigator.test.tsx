// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Navigator } from "./Navigator";
import { usePerchStore } from "../store";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { useFileTabs } from "../fileTabs";
const run = vi.hoisted(() => vi.fn());
vi.mock("../runs", () => ({ runInWorkspace: run }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLElement.prototype.scrollIntoView = vi.fn();
let root: Root, host: HTMLDivElement;
const search = vi.fn();
const close = vi.fn();
const originalSearch = useWorkspaceFilesStore.getState().searchFiles;
function type(value: string) {
  const input = document.querySelector<HTMLInputElement>('[data-testid="navigator-input"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function results(query: string, path = "src/Example.ts") {
  await act(async () => useWorkspaceFilesStore.setState({ searches: { w: { query, state: "ready", truncated: false, entries: [{ name: "Example.ts", path, kind: "file" } as never] } } }));
}
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  usePerchStore.setState({ connected: true, sessions: [], activeHostId: "local", activeWorkspaceId: "w", workspaces: [{ id: "w", hostId: "local", path: "/project" }] as never, serverInfo: { capabilities: ["fs.search"] } as never, fetchAgentManifests: vi.fn() });
  useWorkspaceFilesStore.setState({ searches: {}, searchFiles: search });
  useFileTabs.setState({ tabs: [], active: null });
  await act(async () => root.render(<Navigator open onClose={close} />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useWorkspaceFilesStore.setState({ searchFiles: originalSearch }); vi.useRealTimers(); });
it("debounces within the selected workspace, ignores stale results and opens a file with Enter", async () => {
  type("Exam"); type("Example");
  await act(async () => { vi.advanceTimersByTime(180); });
  expect(search).toHaveBeenCalledExactlyOnceWith("w", "Example");
  await results("Exam");
  expect(document.querySelector('[data-testid="navigator-command-file:src/Example.ts"]')).toBeNull();
  await results("Example");
  expect(document.querySelector('[data-testid="navigator-command-file:src/Example.ts"]')).not.toBeNull();
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(useFileTabs.getState().active).toBe("w\nsrc/Example.ts");
  expect(close).toHaveBeenCalledOnce();
});
it("confirms a frozen Run target; cancelling creates nothing", async () => {
  await act(async () => usePerchStore.setState({ serverInfo: { capabilities: ["fs.search", "workspace.run.v1"] } as never }));
  type("> printf hello");
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(document.querySelector('[data-testid="confirm-dialog"]')?.textContent).toContain("Folder: /project");
  expect(run).not.toHaveBeenCalled();
  act(() => document.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel"]')!.click());
  expect(run).not.toHaveBeenCalled();
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  await act(async () => usePerchStore.setState({ activeWorkspaceId: "other", workspaces: [{ id: "other", hostId: "local", path: "/other" }] as never }));
  let fail!: (error: Error) => void;
  run.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  act(() => document.querySelector<HTMLButtonElement>('[data-testid="confirm-accept"]')!.click());
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(run).toHaveBeenCalledExactlyOnceWith("w", "printf hello");
  await act(async () => fail(new Error("unknown outcome")));
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("unknown outcome");
});
it("cancels pending debounce on close and never searches an older peer", async () => {
  type("Example");
  await act(async () => root.render(<Navigator open={false} onClose={close} />));
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(search).not.toHaveBeenCalled();
  await act(async () => { usePerchStore.setState({ serverInfo: { capabilities: [] } as never }); root.render(<Navigator open onClose={close} />); });
  type("Example");
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(search).not.toHaveBeenCalled();
});
