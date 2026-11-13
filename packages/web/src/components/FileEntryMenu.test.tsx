// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DirectoryEntry } from "@perch/shared";

const native = vi.hoisted(() => ({ available: true, invoke: vi.fn() }));
const mutate = vi.hoisted(() => vi.fn());
const openTab = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ workspaces: [{ id: "w", hostId: "local" }] }));
vi.mock("../links", () => ({ get tauriInvoke() { return native.available ? native.invoke : undefined; } }));
vi.mock("../store", () => ({ usePerchStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { subscribe: () => () => {}, getState: () => state, setState: () => {} }) }));
// The confirmation is a stock screen with its own tests; this file is about the menu.
vi.mock("./ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("../fileTabs", () => ({ useFileTabs: { getState: () => ({ open: openTab }) } }));
vi.mock("../contextBridge", () => ({ contextBridgeAvailable: () => false, askAgentAboutFile: vi.fn() }));
vi.mock("../fileOps", () => ({
  mutateEntry: mutate,
  joinPath: (dir: string, name: string) => dir ? `${dir}/${name}` : name,
  parentPath: (path: string) => path.split("/").slice(0, -1).join("/"),
  useEntryClipboard: (select: (value: { entry: null }) => unknown) => select({ entry: null }),
}));
// The screen's source imports `@perch/sdk`; here it gets the SDK's own leaf primitives, not the whole app graph
// behind `sdk.ts`, and its route renders Perch's stock source.
vi.mock("./mod-root", () => ({ StockRoute: ({ props, stock: Stock }: { props: object; stock: (props: object) => unknown }) => Stock(props) }));
vi.mock("@perch/sdk", async () => ({
  buttonClass: (await import("./ui/button")).button, ConfirmDialog: () => null, Dialog: (await import("../stock-ui/dialog/main")).default,
  menuDividerClass: (await import("./ui/menu")).menuDivider, menuItemClass: (await import("./ui/menu")).menuItem, menuPanel: (await import("./ui/menu")).menuPanel,
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

async function typePath(value: string) {
  await act(async () => root.render(
    <FileEntryMenu workspaceId="w" workspacePath="/repo with spaces/" target={null} x={0} y={0} onClose={onClose} onOpenFile={onOpenFile} onExpand={() => {}} onRefresh={() => {}} initialStage="newFile" />,
  ));
  const input = document.querySelector<HTMLInputElement>('[data-testid="file-name-input"]')!;
  const initial = input.value;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("file-name-confirm");
  return initial;
}

it("new file shows the full default directory and creates in the workspace for a bare name", async () => {
  mutate.mockResolvedValue(undefined);
  expect(await typePath("a.txt")).toBe("/repo with spaces/");
  expect(mutate).toHaveBeenCalledExactlyOnceWith("w", "createFile", "a.txt");
  expect(onOpenFile).toHaveBeenCalledExactlyOnceWith("a.txt");
});

it("new file in a changed directory outside the workspace goes through that directory's scope", async () => {
  mutate.mockResolvedValue(undefined);
  await typePath("/tmp/x/../notes/a.txt");
  const scope = mutate.mock.calls[0]![0] as string;
  expect(scope).toMatch(/^dir:w:/);
  expect(mutate).toHaveBeenCalledWith(scope, "createFile", "a.txt");
  expect(openTab).toHaveBeenCalledExactlyOnceWith("w", "a.txt", undefined, scope);
  expect(atob(scope.slice(6).replace(/-/g, "+").replace(/_/g, "/"))).toBe("/tmp/notes");
  expect(onOpenFile).not.toHaveBeenCalled();
});

it("new file typed as a path inside the workspace stays a workspace file", async () => {
  mutate.mockResolvedValue(undefined);
  await typePath("/repo with spaces/src/a.txt");
  expect(mutate).toHaveBeenCalledExactlyOnceWith("w", "createFile", "src/a.txt");
  expect(onOpenFile).toHaveBeenCalledExactlyOnceWith("src/a.txt");
});
