// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ClientMessage, ModInfo, ServerMessage } from "@perch/shared";
const wire = vi.hoisted(() => ({ send: vi.fn(), message: (_: ServerMessage) => {}, connection: (_: boolean) => {} }));
vi.mock("../ws", () => ({
  socket: {
    connected: true,
    send: wire.send,
    onMessage: (handler: (message: ServerMessage) => void) => { wire.message = handler; },
    onConnectionChange: (handler: (connected: boolean) => void) => { wire.connection = handler; },
  },
}));
const store = vi.hoisted(() => ({ settings: { mods: { mode: "ask", off: false } } as unknown, updateSettings: vi.fn(), activeWorkspaceId: null, workspaces: [], sessions: [] }));
vi.mock("../store", () => ({ usePerchStore: (select: (s: typeof store) => unknown) => select(store) }));
import { ModsSection } from "./ModsSection";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const updateSettings = store.updateSettings;
const sent = () => wire.send.mock.calls.map(([message]) => message as ClientMessage);
const lastRequest = () => sent().at(-1) as Extract<ClientMessage, { type: `mods.${string}` }>;
const q = <T extends Element = HTMLElement>(testId: string) => document.querySelector(`[data-testid="${testId}"]`) as T;
const mod = (extra: Partial<ModInfo> = {}): ModInfo => ({
  id: "board", name: "Board", version: "1", description: "A plan board", actions: [{ id: "hi", title: "Say hi" }], panels: [{ id: "main", title: "Main" }],
  preview: ["action hi: echo hi", "panel main: index.html"], hash: "abcdef0123456789", required: ["panel"],
  status: { state: "pending", reason: "waiting for a person to approve it" }, approvedBy: null, ...extra,
});
async function state(mods: ModInfo[], extra: Record<string, unknown> = {}) {
  await act(async () => {
    wire.message({ type: "mods.state", requestId: lastRequest().requestId, mods, policy: { mode: "ask", off: false }, safeMode: false, folder: "/home/me/.perch/mods", ...extra } as ServerMessage);
  });
}
const click = (testId: string) => act(async () => q<HTMLButtonElement>(testId).click());
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

beforeEach(async () => {
  wire.send.mockClear(); updateSettings.mockClear();
  await act(async () => { wire.message({ type: "server.info", capabilities: ["mods.v1"] } as unknown as ServerMessage); });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<ModsSection />); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("shows what approving a waiting mod lets run, and approving names the hash that was looked at", async () => {
  expect(lastRequest()).toMatchObject({ type: "mods.list" });
  await state([mod()]);
  expect(q("mod-board-status").textContent).toContain("Waiting for you to approve it");
  expect(q("mod-board").textContent).toContain("Approving lets this run as you");
  expect(q("mod-board").textContent).toContain("action hi: echo hi");
  expect(button("Say hi")).toBeUndefined(); // nothing runs before approval
  await act(async () => button("Approve").click());
  expect(lastRequest()).toMatchObject({ type: "mods.set", id: "board", op: "approve", hash: "abcdef0123456789" });
  await state([mod({ status: { state: "active" }, approvedBy: "person" })]);
  expect(q("mod-board-status").textContent).toBe("On · approved by you");
  expect(button("Approve")).toBeUndefined();
});

it("runs an action and shows what it printed or why it failed", async () => {
  await state([mod({ status: { state: "active" }, approvedBy: "policy:auto-safe" })]);
  expect(q("mod-board-status").textContent).toContain("your policy: auto-safe");
  await act(async () => button("Say hi").click());
  expect(lastRequest()).toMatchObject({ type: "mods.set", op: "run", action: "hi" });
  const run = { mod: "board", what: "action:hi", ok: true, exitCode: 0, timedOut: false, error: null, output: "hi\n", truncated: false, at: 1, millis: 3 };
  await state([mod({ status: { state: "active" } })], { run });
  expect(q("mod-run-result").textContent).toContain("Done.");
  expect(q("mod-run-result").textContent).toContain("hi");
});

it("opens a panel only inside a sandboxed iframe that cannot reach the app", async () => {
  await state([mod({ status: { state: "active" } })]);
  await act(async () => button("Open Main").click());
  const frame = q<HTMLIFrameElement>("mod-panel").querySelector("iframe")!;
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
  expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  expect(frame.getAttribute("src")).toContain("mods/panel?id=board&panel=main");
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
});

it("saves the policy the person picks and turns every mod off from a switch", async () => {
  await state([]);
  expect(host.textContent).toContain("No mods yet");
  expect(host.textContent).toContain("/home/me/.perch/mods");
  await act(async () => q<HTMLInputElement | HTMLButtonElement>("settings-mods-off").click());
  expect(updateSettings).toHaveBeenCalledWith({ mods: { mode: "ask", off: true } });
});

it("explains a refusal and an unanswered request instead of failing silently", async () => {
  await state([mod()], { error: "mod \"board\" changed since you looked at it; review it again" });
  expect(q("mods-message").textContent).toContain("changed since you looked");
});
