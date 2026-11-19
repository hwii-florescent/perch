// @vitest-environment jsdom
// What Perch binds for the agent close warning and the docked pane menu, whichever copy of their screens shows: the
// route gets the screen's name and props, and each answer does Perch's own action, never more.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  routed: [] as { name: string; props: Record<string, any> }[],
  pending: null as { id: string } | null,
  stopping: false,
  calls: [] as unknown[][],
}));
vi.mock("./mod-root", () => ({ StockRoute: ({ name, props }: { name: string; props: Record<string, any> }) => { h.routed.push({ name, props }); return null; } }));
vi.mock("../stock-ui/close-guard/main", () => ({ default: () => null }));
vi.mock("../stock-ui/pane-menu/main", () => ({ default: () => null }));
vi.mock("../workspaceTabs", () => ({ sessionLabel: (s: { id: string }) => `label ${s.id}` }));
vi.mock("../closeGuard", () => ({
  useCloseGuard: Object.assign((select: (s: { pending: unknown; stopping: boolean }) => unknown) => select({ pending: h.pending, stopping: h.stopping }), { setState: (next: { pending: null }) => { h.pending = next.pending; h.calls.push(["dismiss"]); } }),
  dismissSessionView: (id: string) => h.calls.push(["dismissView", id]),
  subSessionsOf: () => 2,
  requestStopAgent: (id: string) => h.calls.push(["stop", id]),
}));
vi.mock("../store", () => ({ usePerchStore: { getState: () => ({
  updateSettings: (patch: unknown) => h.calls.push(["settings", patch]),
  deleteSession: (id: string, stopSubSessions?: boolean) => h.calls.push(stopSubSessions === undefined ? ["delete", id] : ["delete", id, stopSubSessions]),
}) } }));
vi.mock("../agentTerminals", () => ({ canStopAgent: () => true, stopAgent: (id: string, subs?: boolean) => h.calls.push(subs === undefined ? ["stop", id] : ["stop", id, subs]) }));
vi.mock("../splitSets", () => ({ useSplitSets: { getState: () => ({ openMenu: (...args: unknown[]) => h.calls.push(["beside", ...args]) }) } }));
vi.mock("../tiledPanes", () => ({ splitActiveTab: (direction: string) => h.calls.push(["split", direction]) }));

import { CloseAgentGuard } from "./CloseAgentGuard";
import { PaneContextMenu } from "./PaneContextMenu";
import type { DockviewController } from "../dockview/dockviewController";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  h.routed = []; h.calls = []; h.pending = null; h.stopping = false;
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

it("routes the close warning as stock:close-guard; stop, keep running and cancel do Perch's own actions once", () => {
  act(() => root.render(<CloseAgentGuard />));
  expect(h.routed).toEqual([]);
  h.pending = { id: "s1" };
  act(() => root.render(<CloseAgentGuard />));
  const { name, props } = h.routed.at(-1)!;
  expect(name).toBe("close-guard");
  expect(props).toMatchObject({ sessionId: "s1", label: "label s1", subSessions: 2 });
  props.onStop(false, true);
  expect(h.calls).toEqual([["delete", "s1", true], ["dismiss"]]);
  h.calls = [];
  props.onStop(true);
  expect(h.calls).toEqual([["settings", { warnCloseAgent: false }], ["delete", "s1"], ["dismiss"]]);
  h.calls = [];
  props.onStop(false);
  expect(h.calls).toEqual([["delete", "s1"], ["dismiss"]]);
  h.calls = [];
  props.onKeepRunning();
  expect(h.calls).toEqual([["dismissView", "s1"], ["dismiss"]]);
  h.calls = [];
  props.onCancel();
  expect(h.calls).toEqual([["dismiss"]]);
});

it("routes the docked pane menu as stock:pane-menu, bound to its own panel; a pane that cannot close is never closed", () => {
  const controller = {
    canClosePanel: vi.fn(() => false), isPanelMaximized: vi.fn(() => true), setActivePanel: vi.fn(), toggleMaximizeActive: vi.fn(),
    renamePanel: vi.fn(), closeActiveTerminalPanel: vi.fn(),
  } as unknown as DockviewController & Record<string, ReturnType<typeof vi.fn>>;
  const onSplitSession = vi.fn();
  act(() => root.render(<PaneContextMenu panelId="p1" title="Chat" x={3} y={4} controller={controller} sessionId="s1" onSplitSession={onSplitSession} onClose={() => {}} />));
  const { name, props } = h.routed.at(-1)!;
  expect(name).toBe("pane-menu");
  expect(props).toMatchObject({ panelId: "p1", title: "Chat", x: 3, y: 4, canClose: false, maximized: true, canStopAgent: true });
  props.actions.close();
  expect(controller.closeActiveTerminalPanel).not.toHaveBeenCalled();
  props.actions.rename("Mine");
  expect(controller.renamePanel).toHaveBeenCalledWith("p1", "Mine");
  props.actions.toggleZoom();
  expect(controller.setActivePanel).toHaveBeenCalledWith("p1");
  expect(controller.toggleMaximizeActive).toHaveBeenCalledTimes(1);
  props.actions.splitNew("below");
  props.actions.showBesideTab(10, 20);
  props.actions.stopAgent();
  props.actions.splitSession();
  expect(h.calls).toEqual([["split", "below"], ["beside", "s1", 10, 20], ["stop", "s1"]]);
  expect(onSplitSession).toHaveBeenCalledTimes(1);
});

it("routes a lead's Stop question as stock:close-guard; each answer stops the lead, with or without its sub-sessions", () => {
  h.pending = { id: "s1" };
  h.stopping = true;
  act(() => root.render(<CloseAgentGuard />));
  const { name, props } = h.routed.at(-1)!;
  expect(name).toBe("close-guard");
  expect(props).toMatchObject({ sessionId: "s1", action: "stop", subSessions: 2 });
  props.onStop(false, false);
  props.onStop(false, true);
  props.onCancel();
  expect(h.calls).toEqual([["stop", "s1", false], ["dismiss"], ["stop", "s1", true], ["dismiss"], ["dismiss"]]);
});
