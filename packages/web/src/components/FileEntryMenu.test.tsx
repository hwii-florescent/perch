// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DirectoryEntry } from "@perch/shared";

const native = vi.hoisted(() => ({ available: true, invoke: vi.fn() }));
const state = vi.hoisted(() => ({ workspaces: [{ id: "w", hostId: "local" }] }));
vi.mock("../links", () => ({ get tauriInvoke() { return native.available ? native.invoke : undefined; } }));
vi.mock("../store", () => ({ usePerchStore: (select: (value: typeof state) => unknown) => select(state) }));
vi.mock("../contextBridge", () => ({ contextBridgeAvailable: () => false, askAgentAboutFile: vi.fn() }));
vi.mock("../fileOps", () => ({
  joinPath: (dir: string, name: string) => dir ? `${dir}/${name}` : name,
  parentPath: (path: string) => path.split("/").slice(0, -1).join("/"),
  useEntryClipboard: (select: (value: { entry: null }) => unknown) => select({ entry: null }),
}));
import { FileEntryMenu } from "./FileEntryMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const onClose = vi.fn(), onOpenFile = vi.fn();
const file = { name: "report #1.pdf", path: "docs/report #1.pdf", kind: "file" } as DirectoryEntry;
const folder = { name: "docs", path: "docs", kind: "directory" } as DirectoryEntry;
const button = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
async function render(target: DirectoryEntry | null = file) {
  await act(async () => root.render(
    <FileEntryMenu
      workspaceId="w"
      workspacePath="/repo with spaces/"
      target={target}
      x={100}
      y={window.innerHeight - 10}
      onClose={onClose}
      onOpenFile={onOpenFile}
      onExpand={() => {}}
      onRefresh={() => {}}
    />,
  ));
}
async function click(id: string) { await act(async () => button(id)!.click()); }

beforeEach(() => {
  vi.clearAllMocks();
  native.available = true;
  native.invoke.mockReset().mockResolvedValue(undefined);
  state.workspaces = [{ id: "w", hostId: "local" }];
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("opens the exact on-disk path through native IPC without opening an editor or saving", async () => {
  await render();
  await click("file-menu-open-default");
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("open_in_default_app", { path: "/repo with spaces/docs/report #1.pdf" });
  expect(onOpenFile).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("supports folders but keeps the empty-space menu free of a default-app action", async () => {
  await render(folder);
  await click("file-menu-open-default");
  expect(native.invoke).toHaveBeenCalledWith("open_in_default_app", { path: "/repo with spaces/docs" });
  expect(button("file-menu-open")).toBeNull();
  await render(null);
  expect(button("file-menu-open-default")).toBeNull();
  expect(button("file-menu-reveal")).not.toBeNull();
});

it("keeps Open as the existing in-perch action", async () => {
  await render();
  await click("file-menu-open");
  expect(onOpenFile).toHaveBeenCalledExactlyOnceWith(file.path);
  expect(native.invoke).not.toHaveBeenCalled();
});

it.each(["remote", "missing", "browser"])("hides both native file actions for %s workspaces/clients", async (mode) => {
  if (mode === "remote") state.workspaces[0]!.hostId = "remote";
  if (mode === "missing") state.workspaces = [];
  if (mode === "browser") native.available = false;
  await render();
  expect(button("file-menu-open-default")).toBeNull();
  expect(button("file-menu-reveal")).toBeNull();
  expect(button("file-menu-open")).not.toBeNull();
});

it("surfaces native failures instead of silently closing", async () => {
  native.invoke.mockRejectedValueOnce("No application is associated with this file.");
  await render();
  await click("file-menu-open-default");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("No application is associated");
  expect(document.querySelector('[data-testid="file-error-dialog"]')).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

it("uses the rendered menu height to stay above the bottom edge", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 520 } as DOMRect);
  await render();
  const menu = document.querySelector<HTMLElement>('[data-testid="file-entry-menu"]')!;
  expect(menu.style.top).toBe(`${window.innerHeight - 520 - 8}px`);
  expect(menu.style.maxHeight).toBe("calc(100vh - 16px)");
  expect(menu.style.overflowY).toBe("auto");
});
