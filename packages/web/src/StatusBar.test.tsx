// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AccountUsage } from "@perch/shared";

vi.mock("./ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const { socket } = await import("./ws");
const { usePerchStore } = await import("./store");
const { StatusBar } = await import("./StatusBar");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const usage: AccountUsage[] = [{
  provider: "claude",
  windows: [
    { label: "5h", usedPercent: 41, windowMinutes: 300, resetsAt: "2026-10-07T12:30:00Z" },
    { label: "7d", usedPercent: 62, windowMinutes: 10080, resetsAt: 1791800000 },
  ],
}];

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ connected: false, activeHostId: "local", hosts: [], hostStates: {}, sessions: [], sessionId: null, activeWorkspaceId: null, workspaces: [], status: null, usage, usageUpdatedAt: 1_791_800_000_000 });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.querySelector("[data-testid='usage-details']")?.remove();
});
function render(node: ReactNode) { act(() => root.render(node)); }
function click(element: Element) { act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
function get(testId: string) { const element = document.querySelector(`[data-testid="${testId}"]`); expect(element).not.toBeNull(); return element!; }

it("opens reset details from the complete usage block and can force a fresh fetch", () => {
  render(<StatusBar />);
  const trigger = get("usage-summary") as HTMLButtonElement;
  expect(trigger.className).toContain("[border:0]");
  expect(trigger.textContent).toContain("Claude");
  expect(trigger.textContent).toContain("5h 41%");
  click(trigger);

  const details = get("usage-details");
  expect(details.textContent).toContain("5h window");
  expect(details.textContent).toContain("41% used");
  expect(details.textContent).toContain(new Date("2026-10-07T12:30:00Z").toLocaleString());
  expect(details.textContent).toContain("7d window");

  click(get("usage-refresh"));
  expect(socket.send).toHaveBeenCalledWith({ type: "usage.get", force: true });
  act(() => usePerchStore.setState({ usageUpdatedAt: Date.now() + 1 }));
  expect((get("usage-refresh") as HTMLButtonElement).disabled).toBe(false);
  expect(get("usage-details").querySelector('[role="status"]')?.textContent).toBe("Plan usage refreshed.");
  expect(document.activeElement).toBe(get("usage-refresh"));
  act(() => get("usage-refresh").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector("[data-testid='usage-details']")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("keeps an empty usage block available so the user can retry", () => {
  usePerchStore.setState({ usage: [] });
  render(<StatusBar />);
  click(get("usage-summary"));
  expect(get("usage-empty").textContent).toContain("No usage available");
  expect(get("usage-refresh")).not.toBeNull();
  act(() => usePerchStore.setState({ usageUpdatedAt: 1_791_800_000_001 }));
  expect(get("usage-details").querySelector('[role="status"]')?.textContent).toBe("");
});

it("shows a failed Claude account when refreshing could not restore usage", () => {
  usePerchStore.setState({ usage: [{ provider: "claude", windows: [], error: "Check Claude Code's sign-in." }] });
  render(<StatusBar />);
  click(get("usage-summary"));
  expect(get("usage-details").textContent).toContain("Check Claude Code's sign-in.");
  expect(get("usage-refresh")).not.toBeNull();
});


it("keeps vertically centered usage at the right end, just before the connection mark", () => {
  render(<StatusBar />);
  const footer = get("usage-summary").closest("footer")!;
  expect(footer.className).toContain("status-bar");
  expect(footer.lastElementChild).toBe(get("status-connection"));
  expect(get("usage-summary").parentElement!.nextElementSibling).toBe(get("status-connection"));
  expect(footer.className).toContain("h-6");
  expect(get("usage-summary").className).toContain("px-1.5");
  expect(get("usage-summary").className).toContain("h-5");
  expect(get("usage-summary").className).toContain("leading-none");
  expect(get("usage-summary").parentElement!.className).toContain("flex h-5");
  // The fields before the slot truncate rather than push it.
  expect(footer.className).toContain("overflow-hidden");
  expect(get("usage-summary").parentElement!.className).toContain("overflow-hidden");
  expect(footer.querySelector(".status-item--cwd")!.className).toContain("truncate");
  expect(footer.querySelector(".status-item--cwd")!.className).toContain("min-w-0");
  expect(footer.querySelector(".status-bar__details")!.className).toContain("min-w-0");
});

it("truncates a long branch instead of widening the bar", () => {
  const branch = "feature/".repeat(40);
  usePerchStore.setState({ status: { cwd: "/a".repeat(200), branch } as never });
  render(<StatusBar />);
  const shown = document.querySelector(".status-bar__branch > span")!;
  expect(shown.className).toContain("truncate");
  expect(shown.className).toContain("min-w-0");
  expect(shown.parentElement!.getAttribute("title")).toBe(branch);
});

it("orders host, path and branch before attention and usage, and never invents a branch", () => {
  usePerchStore.setState({ connected: true, status: { cwd: "/tmp/nest", branch: "main" } });
  render(<StatusBar />);
  const location = document.querySelector(".status-bar__location")!;
  expect(location.textContent).toBe("Local/tmp/nestmain");
  expect(location.querySelector(".status-bar__branch svg")).not.toBeNull();
  expect(get("status-connection").getAttribute("aria-label")).toBe("Connected");
  act(() => usePerchStore.setState({ status: null }));
  expect(location.querySelector(".status-bar__branch")).toBeNull();
  expect(document.querySelector(".agent-status-dot")).toBeNull();
});

it("labels the actual remote host and does not report unknown remote connectivity as connected", () => {
  usePerchStore.setState({ connected: true, activeHostId: "remote", hosts: [{ id: "remote", name: "Build host", sshHost: "example.test", remotePort: 7788, enabled: true, mode: "perch" }] });
  render(<StatusBar />);
  expect(get("status-host").textContent).toBe("Build host");
  expect(get("status-connection").getAttribute("aria-label")).toBe("Reconnecting…");
  act(() => usePerchStore.setState({ hostStates: { remote: { type: "host.info", hostId: "remote", name: "Build host", state: "connected" } } }));
  expect(get("status-connection").getAttribute("aria-label")).toBe("Connected");
});

it("no longer has a Needs You control: that moved to the sidebar's By status view", () => {
  render(<StatusBar />);
  expect(document.querySelector("[data-testid='needs-you-toggle']")).toBeNull();
  expect(document.querySelector("[data-testid='needs-you-panel']")).toBeNull();
});
