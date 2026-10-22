// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContextAgent, ContextSendMessage, ContextPreviewMessage } from "@perch/shared";
const transport = vi.hoisted(() => ({ send: vi.fn(), connection: (_: boolean) => {} }));
const state = vi.hoisted(() => ({ connected: true, serverInfo: { capabilities: ["context.bridge.v1"] }, workspaces: [{ id: "w", hostId: "local" }], sessions: [{ id: "claude" }], switchSession: vi.fn() }));
vi.mock("../ws", () => ({ socket: { connected: true, send: transport.send, onConnectionChange: (handler: (value: boolean) => void) => { transport.connection = handler; } } }));
vi.mock("../store", () => ({ usePerchStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) }));
vi.mock("../workspaceTabs", () => ({ activateTab: (entry: { session: { id: string } }) => state.switchSession(entry.session.id) }));
vi.mock("../filesystemStore", () => ({ useWorkspaceFilesStore: { getState: () => ({ documents: {} }) } }));
import { askAgent, handleContextBridgeMessage, useContextBridge } from "../contextBridge";
import { ContextBridge } from "./ContextBridge";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const agent: ContextAgent = { sessionId: "claude", title: "Investigation", providerId: "claude", canSend: true, reason: "" };
const packet = { workspaceId: "w", markdown: "Exact prepared context", digest: "hash" };
const button = (label: string) => [...document.querySelectorAll("button")].find((item) => item.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function respond(agents: ContextAgent[] = [agent]) {
  await act(async () => vi.advanceTimersByTimeAsync(201));
  const request = transport.send.mock.calls.at(-1)![0] as ContextPreviewMessage;
  expect(request.type).toBe("context.preview");
  await act(async () => { handleContextBridgeMessage({ type: "context.preview.result", requestId: request.requestId, packet, agents }); });
}
beforeEach(async () => {
  vi.useFakeTimers(); transport.send.mockClear(); state.switchSession.mockClear(); state.connected = true;
  useContextBridge.setState({ capture: null, menu: null });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  await act(async () => { root.render(<ContextBridge />); askAgent("w", { kind: "editor", path: "main.ts", text: "captured draft", startLine: 3, endLine: 3, dirty: true }); });
});
afterEach(async () => { await act(async () => { root.unmount(); transport.connection(false); }); host.remove(); vi.useRealTimers(); });

it("only previews on open; cancel and copy never dispatch or save", async () => {
  await respond();
  expect(document.body.textContent).toContain("unsaved draft");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Question for agent");
  expect(button("Send to agent").disabled).toBe(true);
  await click("Copy context");
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(packet.markdown);
  await click("Cancel");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(transport.send.mock.calls.map(([request]) => request.type)).toEqual(["context.preview"]);
});

it("requires an explicit target and sends the reviewed bytes exactly once", async () => {
  await respond();
  const select = document.querySelector("select")!;
  await act(async () => { select.value = agent.sessionId; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(button("Send to agent").disabled).toBe(false);
  await act(async () => { button("Send to agent").click(); button("Send to agent").click(); });
  const sends = transport.send.mock.calls.map(([request]) => request).filter((request) => request.type === "context.send") as ContextSendMessage[];
  expect(sends).toHaveLength(1);
  expect(sends[0]).toMatchObject({ digest: packet.digest, targetSessionId: "claude", source: { kind: "editor", text: "captured draft", dirty: true } });
  await act(async () => { handleContextBridgeMessage({ type: "agent.ui.result", requestId: sends[0]!.requestId, sessionId: "claude", accepted: true }); });
  expect(document.body.textContent).toContain("Context delivered");
  await click("Open agent");
  expect(state.switchSession).toHaveBeenCalledWith("claude");
});

it("supports copy-only agents and traps Tab without Enter sending", async () => {
  await respond([{ ...agent, providerId: "pi", canSend: false, reason: "Copy context for this agent" }]);
  const select = document.querySelector("select")!;
  await act(async () => { select.value = agent.sessionId; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(button("Send to agent").disabled).toBe(true);
  expect(document.body.textContent).toContain("Copy context for this agent");
  const copy = button("Copy context");
  await act(async () => { copy.focus(); copy.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })); });
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Question for agent");
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(transport.send.mock.calls.every(([request]) => request.type === "context.preview")).toBe(true);
});

it("keeps context visible but refuses another send after uncertain delivery", async () => {
  await respond();
  const select = document.querySelector("select")!;
  await act(async () => { select.value = agent.sessionId; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await click("Send to agent");
  await act(async () => { state.connected = false; transport.connection(false); });
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Nothing will be retried");
  expect(button("Send to agent").disabled).toBe(true);
  expect((document.querySelector('[aria-label="Prepared context"]') as HTMLTextAreaElement).value).toBe(packet.markdown);
  await click("Copy context");
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(packet.markdown);
  expect(transport.send.mock.calls.filter(([request]) => request.type === "context.send")).toHaveLength(1);
});
