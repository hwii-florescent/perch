// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionSummary, WorkspaceSummary } from "@perch/shared";

const send = vi.hoisted(() => vi.fn());
vi.mock("../ws", () => ({ socket: { connect: vi.fn(), send, onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
const { usePerchStore } = await import("../store");
const { useFileTabs, fileTabKey } = await import("../fileTabs");
const { saveTabOrder } = await import("../tabOrder");
const { tabOrderKey } = await import("../workspaceTabs");
const { MobileTabRow } = await import("./MobileTabRow");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const switchSession = vi.fn();
const onPane = vi.fn();
const workspace: WorkspaceSummary = { id: "w1", projectId: "p", hostId: "local", path: "/p", name: "p", dirty: false, state: "active", createdAt: 1, updatedAt: 1 };
const session = (id: string, createdAt: number) => ({ id, title: id, cwd: "/p", hostId: "local", workspaceId: "w1", status: "idle", createdAt, cliProviderId: "terminal" }) as SessionSummary;
const file = { workspaceId: "w1", path: "src/x.rs" };

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  useFileTabs.setState({ tabs: [file], active: null });
  usePerchStore.setState({ sessions: [session("a", 1), session("b", 2)], sessionId: "a", activeHostId: "local", activeWorkspaceId: "w1", workspaces: [workspace], switchSession });
  // The desktop's order, as the core shared it: the file between the two sessions.
  saveTabOrder(tabOrderKey(usePerchStore.getState())!, ["a", fileTabKey(file), "b"]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<MobileTabRow onPane={onPane} />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const tabs = () => [...host.querySelectorAll<HTMLButtonElement>("[data-testid=mobile-tab]")];

it("shows the workspace's tabs in the desktop's order and shows a tapped one on this phone only", () => {
  expect(tabs().map((tab) => tab.textContent)).toEqual(["a", "x.rs", "b"]);
  expect(tabs()[0]!.getAttribute("aria-current")).toBe("page");
  act(() => tabs()[1]!.click());
  expect(onPane).toHaveBeenLastCalledWith("files");
  expect(useFileTabs.getState().active).toBe(fileTabKey(file));
  expect(useFileTabs.getState().tabs).toEqual([file]); // the shared tabs did not change
  act(() => tabs()[2]!.click());
  expect(switchSession).toHaveBeenCalledWith("b");
  expect(onPane).toHaveBeenLastCalledWith("chat");
  expect(send).not.toHaveBeenCalled();
});

it("offers a held tab's close, and closing it closes the tab", () => {
  const fileTab = tabs()[1]!;
  act(() => { fileTab.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); vi.advanceTimersByTime(600); });
  act(() => { fileTab.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); fileTab.click(); });
  expect(onPane).not.toHaveBeenCalled(); // the hold's click only offers the close
  const close = host.querySelector<HTMLButtonElement>("[data-testid=mobile-tab-close]")!;
  expect(close.getAttribute("aria-label")).toBe("Close x.rs");
  act(() => close.click());
  expect(useFileTabs.getState().tabs).toEqual([]);
  expect(tabs().map((tab) => tab.textContent)).toEqual(["a", "b"]);
});
