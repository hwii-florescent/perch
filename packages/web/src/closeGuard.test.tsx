// @vitest-environment jsdom
// A lead's close asks what becomes of its sub-sessions, even with the agent warning off; the stock guard's default
// keeps them, its other button stops them.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("./agentTerminals", () => ({ isWatchingAgent: () => false }));
const { usePerchStore } = await import("./store");
const { requestCloseSession, useCloseGuard } = await import("./closeGuard");
const { default: CloseGuard } = await import("./stock-ui/close-guard/main");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session = (id: string, parentSessionId?: string) =>
  ({ id, title: id, cwd: "/w", createdAt: 1, status: "idle", cliProviderId: "terminal", parentSessionId }) as never;

it("a lead with sub-sessions asks even with the warning off, and a plain terminal does not", () => {
  const deleted: unknown[][] = [];
  usePerchStore.setState({
    sessions: [session("lead"), session("kid", "lead"), session("plain")],
    settings: { warnCloseAgent: false } as never,
    deleteSession: (...args: unknown[]) => { deleted.push(args); },
  } as never);
  requestCloseSession("plain");
  expect(deleted).toEqual([["plain"]]);
  requestCloseSession("lead");
  expect(useCloseGuard.getState().pending?.id).toBe("lead");
  expect(deleted).toEqual([["plain"]]);
  useCloseGuard.setState({ pending: null });
});

it("the guard keeps the sub-sessions by default and closes them on its own button", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const stops: unknown[][] = [];
  act(() => root.render(<CloseGuard sessionId="lead" label="lead" subSessions={2} onStop={(...a) => stops.push(a)} onKeepRunning={() => {}} onCancel={() => {}} />));
  const button = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  expect(button("confirm-accept").textContent).toBe("Keep them as sessions");
  expect(document.activeElement).toBe(button("confirm-accept"));
  act(() => button("confirm-accept").click());
  act(() => button("close-guard-stop-sub-sessions").click());
  expect(stops).toEqual([[false, false], [false, true]]);
  act(() => root.unmount());
  host.remove();
});
