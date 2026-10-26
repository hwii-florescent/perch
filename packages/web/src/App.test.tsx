// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
// The shell's chrome is what is under test: stand in for the heavy panes and overlays.
const stub = (testId: string) => () => <div data-testid={testId} />;
vi.mock("./Sidebar", () => ({ Sidebar: stub("sidebar"), NewSessionPopover: () => null }));
vi.mock("./components/SplitCanvas", () => ({ SplitCanvas: stub("split-canvas") }));
vi.mock("./components/SettingsPage", () => ({ SettingsPage: () => null }));
vi.mock("./components/Navigator", () => ({ Navigator: () => null }));
vi.mock("./components/ContextBridge", () => ({ ContextBridge: () => null }));
vi.mock("./components/CloseAgentGuard", () => ({ CloseAgentGuard: () => null }));
vi.mock("./components/KeybindHelp", () => ({ KeybindHelp: () => null }));
vi.mock("./components/Onboarding", () => ({ Onboarding: () => null }));
vi.mock("./components/MacPermissions", () => ({ MacPermissionSetup: () => null }));
vi.mock("./components/Toast", () => ({ Toast: () => null }));
vi.mock("./components/TabBar", () => ({ TabBar: stub("tab-bar") }));
vi.mock("./components/MobilePaneShell", () => ({ MobilePaneShell: stub("mobile-pane-shell") }));
vi.mock("./components/MobileSwitcher", () => ({ MobileSwitcher: () => null }));
vi.mock("./components/WorkspaceTools", () => ({ WorkspaceTools: stub("workspace-tools"), WorkspaceToolsTabs: stub("workspace-tools-tabs") }));

const storage = new Map<string, string>([["perch.onboarding.seen", "1"], ["perch.workspaceTools", "files"]]);
vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
const { usePerchStore } = await import("./store");
const { useAttention } = await import("./attention");
const { default: App } = await import("./App");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const matches = { mobile: false };

beforeEach(() => {
  storage.set("perch.workspaceTools", "files");
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches.mobile && query.includes("max-width"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ connected: true, sidebarCollapsed: false });
  useAttention.setState({ supported: true, events: [], open: false, welcome: null });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  matches.mobile = false;
});
const get = (testId: string) => { const element = host.querySelector(`[data-testid="${testId}"]`); expect(element).not.toBeNull(); return element as HTMLElement; };

it("puts Needs You in the status bar, not the top row, and drops the wordmark", () => {
  act(() => root.render(<App />));
  const topRow = get("tab-bar").parentElement!;
  expect(topRow.querySelector('[data-testid="needs-you-toggle"]')).toBeNull();
  expect(topRow.textContent).not.toContain("perch");
  expect(topRow.querySelector('[data-testid="sidebar-collapse-toggle"]')).not.toBeNull();
  expect(get("needs-you-toggle").closest("footer")?.className).toContain("status-bar");
});

it("has no rules: no border on the top row, sidebar column, drawer column or status bar", () => {
  act(() => root.render(<App />));
  const topRow = get("tab-bar").parentElement!;
  const footer = get("needs-you-toggle").closest("footer")!;
  for (const element of [topRow, topRow.firstElementChild!, get("workspace-tools-header"), footer]) {
    expect(element.className, element.className).not.toMatch(/(^|\s)border(-[lrtb])?(-|\s|$)/);
  }
});

it("floats the canvas between 8px gutters and flush on the status bar, with the handles as the gutters", () => {
  act(() => root.render(<App />));
  const main = host.querySelector("main")!;
  // No gap below: the status bar's own height is the space under the canvas, so its text is centred in it.
  expect(main.className).not.toMatch(/(^|\s)mb-/);
  // Both columns open: the resize handles are the 8px gutters, so main needs no side margin.
  expect(get("resize-sidebar").className).toContain("flex-[0_0_8px]");
  expect(get("resize-tools").className).toContain("flex-[0_0_8px]");
  expect(main.className).not.toMatch(/(^|\s)m[lr]-2/);
  // The drawer's header column is as wide as the drawer itself.
  expect(get("workspace-tools-header").className).toContain("w-[var(--tools-width)]");
});

it("keeps an 8px gutter where a column is closed", () => {
  act(() => usePerchStore.setState({ sidebarCollapsed: true }));
  storage.delete("perch.workspaceTools");
  act(() => root.render(<App />));
  const main = host.querySelector("main")!;
  expect(main.className).toContain("ml-2");
  expect(main.className).toContain("mr-2");
  expect(host.querySelector('[data-testid="resize-sidebar"]')).toBeNull();
  expect(host.querySelector('[data-testid="resize-tools"]')).toBeNull();
  // The drawer toggle stays reachable in the header column when the drawer is closed.
  expect(get("workspace-tools-header").querySelector('[data-testid="workspace-tools-toggle"]')).not.toBeNull();
});

it("leaves the phone layout alone: no gutters, no desktop status bar", () => {
  matches.mobile = true;
  act(() => root.render(<App />));
  expect(host.querySelector("main")!.className).not.toMatch(/mb-\[6px\]|ml-2|mr-2/);
  expect(host.querySelector("footer.status-bar")).toBeNull();
  expect(host.querySelector('[data-testid="workspace-tools-header"]')).toBeNull();
});
