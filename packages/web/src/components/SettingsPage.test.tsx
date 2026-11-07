// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { chooseDropdown, openDropdown, optionLabels } from "./ui/selectTesting";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("./AgentPicker", () => ({ useAgentChoices: () => ({ choices: [] }) }));
vi.mock("../xtermSetup", () => ({ MIN_SCROLLBACK: 100, MAX_SCROLLBACK: 100000 }));
const { usePerchStore } = await import("../store");
const { SettingsPage } = await import("./SettingsPage");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("detects real macOS notification permission, requests only on opt-in, and rechecks banner settings", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  let snapshot = { permission: "default", alerts: false, alertStyle: "none" };
  let failTest = false;
  const invoke = vi.fn(async (command: string) => {
    if (command === "notification_request_permission") snapshot = { ...snapshot, permission: "denied" };
    if (command === "notify_session" && failTest) throw new Error("macOS enqueue failed");
    return snapshot;
  });
  const pluginRequest = vi.fn();
  vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: pluginRequest });
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settingsPage: "main", settings: { theme: "perch", soundEnabled: true, toastDelivery: "app" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const click = async (label: string) => {
    const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  };
  try {
    await act(async () => root.render(<SettingsPage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="settings-nav-notifications"]')!.click());
    expect(host.textContent).toContain("Not requested");
    expect(invoke.mock.calls.map(([command]) => command)).toEqual(["notification_status"]);
    await click("Allow notifications");
    expect(invoke).toHaveBeenLastCalledWith("notification_request_permission");
    expect(host.textContent).toContain("Blocked by macOS");
    await click("Open macOS Settings");
    expect(invoke).toHaveBeenLastCalledWith("notification_open_settings");
    snapshot = { permission: "granted", alerts: false, alertStyle: "none" };
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(host.textContent).toContain("macOS banners are off");
    snapshot = { permission: "granted", alerts: true, alertStyle: "banner" };
    await click("Refresh");
    expect(host.textContent).toContain("Allowed. System notifications");
    failTest = true;
    await click("Send test");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("macOS enqueue failed");
    failTest = false;
    await click("Send test");
    expect(invoke).toHaveBeenCalledWith("notify_session", { title: "Perch test notification", body: expect.any(String), sessionId: "usage" });
    expect(host.textContent).toContain("Test submitted");
    await chooseDropdown(host.querySelector('[data-testid="settings-toast-delivery"]')!, "system");
    expect(updateSettings).toHaveBeenCalledWith({ toastDelivery: "system" });
    expect(invoke).toHaveBeenLastCalledWith("notification_request_permission");
    expect(pluginRequest).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount()); host.remove();
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

it("keeps a failed native permission check unknown, not the plugin’s fake grant", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  const invoke = vi.fn().mockRejectedValue(new Error("Cannot read native settings"));
  vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
  vi.stubGlobal("Notification", { permission: "granted" });
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch", soundEnabled: true } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn() });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="settings-nav-notifications"]')!.click());
    expect(host.textContent).toContain("could not be verified");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Cannot read native settings");
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Send test")!.disabled).toBe(true);
  } finally {
    act(() => root.unmount()); host.remove();
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

it("searches rows across sections, matches a group title, clears on Escape and says when nothing matches", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings: vi.fn() });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const input = () => host.querySelector<HTMLInputElement>('[data-testid="settings-search"]')!;
  const type = async (value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const rows = () => [...host.querySelectorAll("[data-setting-row]")].map((r) => r.textContent ?? "");
  try {
    await act(async () => root.render(<SettingsPage />));
    await type("search engine");
    expect(rows().some((r) => r.includes("Default search engine"))).toBe(true);
    expect(host.textContent).not.toContain("Warn before closing an agent");
    await type("tab shape");
    expect(rows()).toHaveLength(1);
    await type("theme"); // a group title shows its whole group
    expect(host.querySelector('[data-testid="theme-option-perch"]')).not.toBeNull();
    await type("zzzz");
    expect(rows()).toHaveLength(0);
    expect(host.querySelector("[data-none]")).not.toBeNull();
    await act(async () => { input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(input().value).toBe("");
    expect(usePerchStore.getState().settingsOpen).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("persists the dropped-path quoting toggle and follows authoritative settings", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="settings-nav-terminal"]')!.click());
    const toggle = host.querySelector<HTMLInputElement>('[aria-label="Wrap dropped paths in double quotes"]')!;
    expect(toggle.checked).toBe(false);
    await act(async () => toggle.click());
    expect(toggle.checked).toBe(true);
    expect(updateSettings).toHaveBeenCalledWith({ droppedPathDoubleQuotes: true });
    act(() => usePerchStore.setState({ settings: { theme: "perch", droppedPathDoubleQuotes: false } as never }));
    expect(toggle.checked).toBe(false);
    expect(host.textContent).toContain("1 GiB");
    expect(host.textContent).toContain("SCP");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("sets the usage alert thresholds from Notifications and follows the saved values", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="settings-nav-notifications"]')!.click());
    const limit = host.querySelector<HTMLElement>('[data-testid="settings-usage-limit-alert"]')!;
    const budget = host.querySelector<HTMLElement>('[data-testid="settings-usage-daily-budget"]')!;
    expect(limit.dataset.value).toBe("80");
    expect(budget.dataset.value).toBe("0");
    expect(optionLabels(await openDropdown(limit))).toEqual(["Off", "50%", "75%", "80%", "90%", "95%"]);
    await act(async () => { limit.click(); });
    expect(optionLabels(await openDropdown(budget))).toEqual(["Off", "$5", "$10", "$25", "$50", "$100", "$250"]);
    await act(async () => { budget.click(); });
    await chooseDropdown(limit, "90");
    expect(updateSettings).toHaveBeenCalledWith({ usageLimitAlert: 90 });
    await chooseDropdown(budget, "25");
    expect(updateSettings).toHaveBeenCalledWith({ usageDailyBudgetUsd: 25 });
    act(() => usePerchStore.setState({ settings: { theme: "perch", usageLimitAlert: 0, usageDailyBudgetUsd: 100 } as never }));
    expect(limit.dataset.value).toBe("0");
    expect(budget.dataset.value).toBe("100");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("turns the sub-session summaries off and saves a model only when it changed", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="settings-nav-notifications"]')!.click());
    const toggle = host.querySelector<HTMLInputElement>('[data-testid="settings-reporter-enabled"]')!;
    expect(toggle.checked).toBe(true);
    await act(async () => toggle.click());
    expect(updateSettings).toHaveBeenCalledWith({ reporterEnabled: false });
    const claude = host.querySelector<HTMLInputElement>('[data-testid="settings-reporter-claude-model"]')!;
    expect(claude.value).toBe("haiku");
    expect(host.querySelector<HTMLInputElement>('[data-testid="settings-reporter-codex-model"]')!.value).toBe("gpt-6-luna");
    const pi = host.querySelector<HTMLInputElement>('[data-testid="settings-reporter-pi-model"]')!;
    const omp = host.querySelector<HTMLInputElement>('[data-testid="settings-reporter-omp-model"]')!;
    expect([pi.value, omp.value]).toEqual(["", ""]);
    const type = (input: HTMLInputElement, text: string) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => { claude.focus(); type(claude, "haiku"); claude.blur(); });
    expect(updateSettings).not.toHaveBeenCalledWith(expect.objectContaining({ reporterClaudeModel: expect.anything() }));
    await act(async () => { type(claude, "  "); claude.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(claude.value).toBe("haiku");
    // Pi and OMP have no default: a model is saved as typed and clearing the field clears the setting.
    await act(async () => { type(pi, "anthropic/claude-haiku-4-5"); pi.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(updateSettings).toHaveBeenCalledWith({ reporterPiModel: "anthropic/claude-haiku-4-5" });
    act(() => usePerchStore.setState({ settings: { theme: "perch", reporterPiModel: "anthropic/claude-haiku-4-5" } as never }));
    await act(async () => { type(pi, ""); pi.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(updateSettings).toHaveBeenCalledWith({ reporterPiModel: "" });
    expect(updateSettings).not.toHaveBeenCalledWith(expect.objectContaining({ reporterOmpModel: expect.anything() }));
    await act(async () => { type(claude, "claude-sonnet-4-5"); claude.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(updateSettings).toHaveBeenCalledWith({ reporterClaudeModel: "claude-sonnet-4-5" });
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("offers the supported engines in General and follows the saved setting", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    const select = host.querySelector<HTMLElement>('[aria-label="Default search engine"]')!;
    expect(select.dataset.value).toBe("google");
    expect(optionLabels(await openDropdown(select))).toEqual(["Google", "DuckDuckGo", "Bing", "Brave"]);
    await act(async () => { select.click(); });
    await chooseDropdown(select, "duckduckgo");
    expect(updateSettings).toHaveBeenCalledWith({ browserSearchEngine: "duckduckgo" });
    act(() => usePerchStore.setState({ settings: { theme: "perch", browserSearchEngine: "brave" } as never }));
    expect(select.dataset.value).toBe("brave");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
