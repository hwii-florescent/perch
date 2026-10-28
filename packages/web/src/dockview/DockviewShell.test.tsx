// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ ready: (_: { api: unknown }) => {} }));
vi.mock("dockview-react", () => ({
  themeAbyss: {},
  DockviewReact: (props: { onReady: typeof mock.ready }) => { mock.ready = props.onReady; return null; },
}));
class FakeWebSocket {
  static OPEN = 1;
  readyState = 1;
  addEventListener() {}
  send() {}
  close() {}
}
(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { usePerchStore } = await import("../store");
const { DockviewShell } = await import("./DockviewShell");
const browserNative = await import("../browserNative");

it("explicitly hands off native focus even when its terminal textarea is already DOM-focused", async () => {
  vi.useFakeTimers();
  const handoff = vi.spyOn(browserNative, "focusMainResponder").mockImplementation(() => {});
  const sessionId = "split-focus-session";
  usePerchStore.setState({ sessionId, sessionLayouts: {}, sessions: [], settingsOpen: false });
  const mount = document.createElement("div"), panel = document.createElement("div"), input = document.createElement("textarea");
  panel.append(input);
  document.body.append(mount, panel);
  input.focus();
  const focused = vi.fn();
  input.addEventListener("focusin", focused);
  const root = createRoot(mount);
  const api = {
    addPanel: vi.fn(), fromJSON: vi.fn(), panels: [], groups: [],
    activePanel: { view: { content: { element: panel } } },
    toJSON: vi.fn(() => ({ panels: {} })),
    onDidLayoutChange: vi.fn(), onUnhandledDragOver: vi.fn(), onDidDrop: vi.fn(),
    onDidActivePanelChange: vi.fn(() => ({ dispose: vi.fn() })),
  };
  try {
    await act(async () => root.render(<DockviewShell />));
    await act(async () => usePerchStore.setState({ sessionLayouts: { [sessionId]: { panels: {} } } }));
    await act(async () => mock.ready({ api }));
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(document.activeElement).toBe(input);
    expect(focused).not.toHaveBeenCalled();
    expect(handoff).toHaveBeenCalledExactlyOnceWith(input);
  } finally {
    await act(async () => root.unmount());
    mount.remove();
    panel.remove();
    handoff.mockRestore();
    vi.useRealTimers();
  }
});

it("applies a saved layout that arrives before Dockview is ready", async () => {
  const sessionId = "early-layout-session";
  const saved = { grid: { root: { type: "branch", data: [] } }, panels: { restored: { id: "restored", contentComponent: "terminal" } } };
  usePerchStore.setState({ sessionId, sessionLayouts: {}, sessions: [], workspaceFilesWorkspaceId: null, workspaceGitReviewWorkspaceId: null });
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const root = createRoot(mount);
  const api = {
    addPanel: vi.fn(), fromJSON: vi.fn(), panels: [], groups: [],
    toJSON: vi.fn(() => ({ panels: {} })),
    onDidLayoutChange: vi.fn(), onUnhandledDragOver: vi.fn(), onDidDrop: vi.fn(),
    onDidActivePanelChange: vi.fn(() => ({ dispose: vi.fn() })),
  };
  try {
    await act(async () => { root.render(<DockviewShell />); });
    await act(async () => { usePerchStore.setState({ sessionLayouts: { [sessionId]: saved } }); });
    expect(api.fromJSON).not.toHaveBeenCalled();
    await act(async () => { mock.ready({ api }); });
    expect(api.fromJSON).toHaveBeenCalledExactlyOnceWith(saved);
  } finally {
    await act(async () => root.unmount());
    mount.remove();
  }
});
