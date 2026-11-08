// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../ws", () => ({ socket: { send: vi.fn(), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
const { usePerchStore } = await import("../store");
const { Toast } = await import("./Toast");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.useRealTimers());

it("shows what happened, opens the session, pauses on hover and auto-dismisses", () => {
  vi.useFakeTimers();
  const switchSession = vi.fn();
  usePerchStore.setState({
    switchSession,
    sessions: [],
    toasts: [
      { id: "a", sessionId: "s1", title: "Fix build", kind: "done" },
      { id: "b", sessionId: "s2", title: "Deploy", kind: "blocked" },
      { id: "u", sessionId: "usage", title: "Claude 5h limit at 82%", body: "Resets in 2h", text: "x", kind: "usage" },
    ],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<Toast />));
    expect(host.textContent).toContain("Session finished");
    expect(host.textContent).toContain("Fix build");
    expect(host.textContent).toContain("Needs your attention");
    expect(host.textContent).toContain("Resets in 2h");
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="toast-s1"]')!.click());
    expect(switchSession).toHaveBeenCalledWith("s1");
    // Usage toasts never open a session; the close button only dismisses.
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="toast-usage"]')!.click());
    expect(switchSession).toHaveBeenCalledTimes(1);
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="toast-dismiss-s2"]')!.click());
    expect(usePerchStore.getState().toasts).toEqual([]);
    // Hover pauses the timer; leaving restarts it.
    act(() => usePerchStore.setState({ toasts: [{ id: "c", sessionId: "s3", title: "T", kind: "done" }] }));
    const card = () => host.querySelector('[data-testid="toast-s3"]')!.parentElement!;
    act(() => { card().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    act(() => { card().dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(6100); });
    expect(usePerchStore.getState().toasts).toEqual([]);
  } finally { act(() => root.unmount()); host.remove(); }
});

it("names the agent that finished, as the program table does (programs.json can rename it)", async () => {
  const { setProgramsFile } = await import("../programs");
  const { AgentIcon } = await import("./AgentIcon");
  usePerchStore.setState({
    sessions: [{ id: "k", title: "Fix", cwd: "/p", createdAt: 1, status: "idle", cliProviderId: "kiro" }, { id: "t", title: "sh", cwd: "/p", createdAt: 2, status: "idle", cliProviderId: "terminal" }] as never,
    toasts: [{ id: "a", sessionId: "k", title: "Fix", kind: "done" }, { id: "b", sessionId: "t", title: "sh", kind: "done" }] as never,
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<Toast />));
    expect(host.textContent).toContain("Kiro finished");
    expect(host.textContent).toContain("Session finished"); // a plain terminal
    setProgramsFile({ programs: { kiro: { name: "Kiro CLI", icon: "my-icons/kiro.svg", tint: false } } });
    act(() => root.render(<Toast />));
    expect(host.textContent).toContain("Kiro CLI finished");
    // And its icon is the person's own file, served from inside their folder.
    act(() => root.render(<AgentIcon provider="kiro" />));
    expect(host.querySelector("img")?.getAttribute("src")).toMatch(/mods\/file\?icon=my-icons%2Fkiro\.svg$/);
  } finally {
    setProgramsFile(undefined);
    act(() => root.unmount());
    host.remove();
  }
});
