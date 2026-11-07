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
  useAttention.setState({ supported: true, events: [] });
  usePerchStore.setState({ sessions: [], hostStates: {} });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  matches.mobile = false;
});
const get = (testId: string) => { const element = host.querySelector(`[data-testid="${testId}"]`); expect(element).not.toBeNull(); return element as HTMLElement; };

it("has no Needs You button or panel in the top row or status bar, and drops the wordmark", () => {
  act(() => root.render(<App />));
  const topRow = get("tab-bar").parentElement!;
  expect(host.querySelector('[data-testid="needs-you-toggle"]')).toBeNull();
  expect(topRow.textContent).not.toContain("perch");
  expect(get("sidebar-card").querySelector('[data-testid="sidebar-collapse-toggle"]')).not.toBeNull();
  expect(get("status-connection").closest("footer")?.className).toContain("status-bar");
});

it("keeps the alert when the sidebar is collapsed: a count on the control that opens it", () => {
  usePerchStore.setState({ sessions: [{ id: "q", title: "t", cwd: "/p", createdAt: 1, status: "running", blocked: true } as never] });
  act(() => root.render(<App />));
  // Open sidebar: By status lists it, so no badge on the toggle.
  expect(host.querySelector('[data-testid="needs-you-count"]')).toBeNull();
  act(() => usePerchStore.setState({ sidebarCollapsed: true }));
  expect(get("needs-you-count").textContent).toBe("1");
  expect(get("sidebar-collapse-toggle").getAttribute("aria-label")).toBe("Expand sidebar, 1 chat needs you");
  act(() => usePerchStore.setState({ sessions: [] }));
  expect(host.querySelector('[data-testid="needs-you-count"]')).toBeNull();
  expect(get("sidebar-collapse-toggle").getAttribute("aria-label")).toBe("Expand sidebar");
});

it("has no rules: no border on the cards, their head rows or the status bar", () => {
  act(() => root.render(<App />));
  const topRow = get("tab-bar").parentElement!;
  const footer = get("status-connection").closest("footer")!;
  for (const element of [topRow, get("sidebar-card"), get("main-card"), get("tools-card"), get("workspace-tools-header"), footer]) {
    expect(element.className, element.className).not.toMatch(/(^|\s)border(-[lrtb])?(-|\s|$)/);
  }
});

it("lays out three full-height cards with the resize handles as the 8px gutters", () => {
  act(() => root.render(<App />));
  const row = get("main-card").parentElement!;
  // The row insets the cards 8px from the window's top and sides; the status bar is the space below.
  expect(row.className).toMatch(/(^|\s)px-2(\s|$)/);
  expect(row.className).toMatch(/(^|\s)pt-2(\s|$)/);
  expect(get("sidebar-card").parentElement).toBe(row);
  expect(get("tools-card").parentElement).toBe(row);
  expect(get("resize-sidebar").className).toContain("flex-[0_0_8px]");
  expect(get("resize-tools").className).toContain("flex-[0_0_8px]");
  // The tabs live inside the main card, above the canvas, so the card runs the full height.
  expect(get("main-card").contains(get("tab-bar"))).toBe(true);
  expect(get("main-card").contains(host.querySelector("main"))).toBe(true);
  // The drawer's header is inside its card, as wide as the drawer itself.
  expect(get("tools-card").className).toContain("w-[var(--tools-width)]");
  expect(get("tools-card").contains(get("workspace-tools-header"))).toBe(true);
  expect(host.firstElementChild!.className).toContain("app--cards");
});

it("moves the sidebar toggle into the main card when the sidebar is closed, and drops the drawer card", () => {
  act(() => usePerchStore.setState({ sidebarCollapsed: true }));
  storage.delete("perch.workspaceTools");
  act(() => root.render(<App />));
  expect(host.querySelector('[data-testid="sidebar-card"]')).toBeNull();
  expect(host.querySelector('[data-testid="tools-card"]')).toBeNull();
  expect(host.querySelector('[data-testid="resize-sidebar"]')).toBeNull();
  expect(host.querySelector('[data-testid="resize-tools"]')).toBeNull();
  expect(get("main-card").querySelector('[data-testid="sidebar-collapse-toggle"]')).not.toBeNull();
  // The drawer toggle stays reachable in the main card's head row when the drawer is closed.
  expect(get("workspace-tools-header").querySelector('[data-testid="workspace-tools-toggle"]')).not.toBeNull();
  expect(get("main-card").contains(get("workspace-tools-header"))).toBe(true);
});

it("leaves the phone layout alone: no gutters, no desktop status bar", () => {
  matches.mobile = true;
  act(() => root.render(<App />));
  expect(host.querySelector("main")!.className).not.toMatch(/mb-\[6px\]|ml-2|mr-2/);
  expect(host.querySelector('[data-testid="main-card"]')).toBeNull();
  expect(host.firstElementChild!.className).not.toContain("app--cards");
  expect(host.querySelector("footer.status-bar")).toBeNull();
  expect(host.querySelector('[data-testid="workspace-tools-header"]')).toBeNull();
});
