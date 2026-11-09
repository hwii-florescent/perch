// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AccountUsage, SpendSummary } from "@perch/shared";

vi.mock("./ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const { socket } = await import("./ws");
const { usePerchStore } = await import("./store");
// The stock screen `stock:status` from its source, as the package the app loads is exported from it.
const { default: StatusBar } = await import("./stock-ui/status/main");

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
  usePerchStore.setState({ connected: false, activeHostId: "local", hosts: [], hostStates: {}, sessions: [], sessionId: null, activeWorkspaceId: null, workspaces: [], status: null, usage, spend: null, usageUpdatedAt: 1_791_800_000_000 });
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

it("shows the plan and scoped windows only in the popover, plus banked Codex resets", () => {
  usePerchStore.setState({ usage: [
    { provider: "claude", plan: "Max 5×", windows: [
      { label: "5h", usedPercent: 6, windowMinutes: 300 },
      { label: "7d", usedPercent: 24, windowMinutes: 10080 },
      { label: "7d", usedPercent: 9, windowMinutes: 10080, scope: "Fable" },
    ] },
    { provider: "codex", windows: [{ label: "5h", usedPercent: 20, windowMinutes: 300 }], resetCredits: 3 },
  ] });
  render(<StatusBar />);
  const trigger = get("usage-summary");
  expect(trigger.textContent).toContain("7d 24%");
  expect(trigger.textContent).not.toContain("Fable");
  expect(trigger.textContent).not.toContain("9%");
  click(trigger);
  const details = get("usage-details");
  expect(details.textContent).toContain("Claude Max 5×");
  expect(details.textContent).toContain("7d Fable window");
  expect(details.textContent).toContain("9% used");
  expect(get("usage-reset-credits").textContent).toBe("3 rate-limit resets banked");
});

it("redeems a banked Codex reset only after confirmation and reports the outcome", () => {
  usePerchStore.setState({ usageRedeemResult: null, usage: [
    { provider: "codex", accountId: "codex:abc123abc123", windows: [], resetCredits: 3 },
  ] });
  render(<StatusBar />);
  click(get("usage-summary"));
  // Cancel sends nothing.
  click(get("usage-redeem-reset"));
  expect(get("usage-details").textContent).toContain("This spends 1 of 3 banked resets.");
  click([...document.querySelectorAll("button")].find((b) => b.textContent === "Cancel")!);
  expect(socket.send).not.toHaveBeenCalled();
  expect(document.querySelector("[data-testid='usage-redeem-confirm']")).toBeNull();
  // Confirm sends the request and waits for the result.
  click(get("usage-redeem-reset"));
  click(get("usage-redeem-confirm"));
  expect(socket.send).toHaveBeenCalledWith({ type: "usage.redeemReset", accountId: "codex:abc123abc123" });
  expect((get("usage-redeem-reset") as HTMLButtonElement).disabled).toBe(true);
  act(() => usePerchStore.setState({ usageRedeemResult: { type: "usage.redeemResult", accountId: "codex:abc123abc123", outcome: "reset" } }));
  expect(get("usage-redeem-status").textContent).toBe("Limits reset.");
  expect(socket.send).toHaveBeenLastCalledWith({ type: "usage.get", force: true });
  // A failure shows the core's message and does not refetch.
  vi.mocked(socket.send).mockClear();
  click(get("usage-redeem-reset"));
  click(get("usage-redeem-confirm"));
  act(() => usePerchStore.setState({ usageRedeemResult: { type: "usage.redeemResult", accountId: "codex:abc123abc123", outcome: "error" } }));
  expect(get("usage-redeem-status").textContent).toBe("Could not reach Codex. Try again.");
  expect(socket.send).toHaveBeenCalledTimes(1);
});

const spend: SpendSummary = {
  pricesUpdated: "2026-10-09",
  periods: [
    { days: 1, costUsd: 12.345, savedUsd: 1, tokens: 1_234_567, unpriced: 0, providers: [], models: [], projects: [] },
    { days: 7, costUsd: 80, savedUsd: 5, tokens: 9_500, unpriced: 2, providers: [], models: [], projects: [] },
    {
      days: 30,
      costUsd: 412.4,
      savedUsd: 50,
      tokens: 50_000_000,
      unpriced: 0,
      providers: [{ name: "claude", costUsd: 412.4, tokens: 50_000_000 }],
      models: [
        { name: "Opus 5", provider: "claude", costUsd: 300, tokens: 1 },
        { name: "GPT-6 Luna", provider: "codex", costUsd: 90.5, tokens: 1 },
        { name: "Sonnet 4.5", provider: "claude", costUsd: 21.9, tokens: 1 },
        { name: "Haiku 4.5", provider: "claude", costUsd: 0.04, tokens: 1 },
      ],
      projects: [],
    },
  ],
  block: { start: 1_791_800_000, end: 1_791_810_000, costUsd: 4.1, tokens: 1 },
  burnPerHourUsd: 3.2,
};

it("shows API-equivalent spend in the popover only, with periods, top models, block and burn", () => {
  usePerchStore.setState({ spend });
  render(<StatusBar />);
  expect(get("usage-summary").textContent).not.toContain("$");
  click(get("usage-summary"));
  const section = get("usage-spend");
  expect(section.textContent).toContain("API-equivalent spend");
  expect(section.textContent).toContain("Estimated from local agent logs at list prices (2026-10-09).");
  expect(get("usage-spend-1").textContent).toBe("Today$12.351.2M tokens");
  expect(get("usage-spend-7").textContent).toBe("7 days$80.009.5k tokens · 2 unpriced");
  expect(get("usage-spend-30").textContent).toBe("30 days$41250.0M tokens");
  const models = get("usage-spend-models");
  expect(models.textContent).toContain("Top models, 30 days");
  expect(models.textContent).toContain("Opus 5$300");
  expect(models.textContent).toContain("Sonnet 4.5$21.90");
  expect(models.textContent).not.toContain("Haiku");
  const ends = new Date(1_791_810_000 * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  expect(get("usage-spend-block").textContent).toBe(`Claude 5h block $4.10, ends ${ends}`);
  expect(get("usage-spend-burn").textContent).toBe("Burning $3.20/h");
});

it("leaves the spend section out when the core reports none", () => {
  render(<StatusBar />);
  click(get("usage-summary"));
  expect(document.querySelector("[data-testid='usage-spend']")).toBeNull();
  expect(document.querySelector("[data-testid='usage-plan-value']")).toBeNull();
});

it("compares 30-day API value with the plan price for a single account of that provider", () => {
  const claude: AccountUsage = { provider: "claude", plan: "Max 5×", planMonthlyUsd: 100, windows: [] };
  usePerchStore.setState({ spend, usage: [claude] });
  render(<StatusBar />);
  click(get("usage-summary"));
  expect(get("usage-plan-value").textContent).toBe("30 days: $412 API-equivalent on a $100/mo plan");
  // Two accounts of one provider: the shared log total cannot be split between them.
  act(() => usePerchStore.setState({ usage: [claude, { ...claude, label: "work" }] }));
  expect(document.querySelector("[data-testid='usage-plan-value']")).toBeNull();
  // A plan without a known price shows no comparison.
  act(() => usePerchStore.setState({ usage: [{ ...claude, planMonthlyUsd: undefined }] }));
  expect(document.querySelector("[data-testid='usage-plan-value']")).toBeNull();
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
