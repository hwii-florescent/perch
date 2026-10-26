// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("./AgentPicker", () => ({ useAgentChoices: () => ({ choices: [] }) }));
vi.mock("../xtermSetup", () => ({ MIN_SCROLLBACK: 100, MAX_SCROLLBACK: 100000 }));
const { usePerchStore } = await import("../store");
const { SettingsPage } = await import("./SettingsPage");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("offers the supported engines in General and follows the saved setting", async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
  const updateSettings = vi.fn();
  usePerchStore.setState({ settingsOpen: true, settings: { theme: "perch" } as never, fetchSettings: vi.fn(), fetchHosts: vi.fn(), updateSettings });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SettingsPage />));
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Default search engine"]')!;
    expect(select.value).toBe("google");
    expect([...select.options].map((option) => option.text)).toEqual(["Google", "DuckDuckGo", "Bing", "Brave"]);
    await act(async () => {
      select.value = "duckduckgo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(updateSettings).toHaveBeenCalledWith({ browserSearchEngine: "duckduckgo" });
    act(() => usePerchStore.setState({ settings: { theme: "perch", browserSearchEngine: "brave" } as never }));
    expect(select.value).toBe("brave");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
