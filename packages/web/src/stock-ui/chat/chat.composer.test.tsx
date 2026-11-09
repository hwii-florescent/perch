// @vitest-environment jsdom
// The chat's draft and its send belong to the host (`chatComposer.ts`), not to a view: a view replaced while a
// send is in flight (a code reload, a clone swap, a hidden copy released, the phone/desktop breakpoint) and two
// copies of one chat must show one draft and dispatch one message.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  prompts: [] as { operationId: string; text: string }[],
  replies: [] as ((value: unknown) => void)[],
}));
vi.mock("../../agentTerminals", async (original) => ({
  ...await original<typeof import("../../agentTerminals")>(),
  agentInputGeneration: () => 1,
  openAgentTerminal: (_session: string, _provider: string, _cols: number, _rows: number,
    onReady: (id: string, status: unknown) => void, _onData: unknown, onStatus: (status: unknown, controlling: boolean) => void) => {
    const status = { inputOwner: { deviceId: "local" } };
    queueMicrotask(() => { onReady("t1", status); onStatus(status, true); });
    return { ready: Promise.resolve(), takeControl: () => Promise.resolve(), release: () => {} };
  },
}));
vi.mock("../../nativeUi", async (original) => ({
  ...await original<typeof import("../../nativeUi")>(),
  subscribeNativeUi: (_session: string, _provider: string, listener: (snapshot: unknown) => void) => {
    queueMicrotask(() => listener({ messages: [], running: false, blocked: false, revision: 1 }));
    return () => {};
  },
  requestNativeUi: (request: { type: string; operationId: string; text: string }) => {
    if (request.type !== "agent.ui.prompt") return new Promise(() => {});
    fake.prompts.push(request);
    return new Promise((resolve) => fake.replies.push(resolve));
  },
}));
import { NativeCliChat } from "./chat";
import { resetChatComposersForTest } from "../../chatComposer";
import { usePerchStore } from "../../store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: { host: HTMLDivElement; root: Root }[] = [];

async function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push({ host, root });
  await act(async () => root.render(<NativeCliChat sessionId="s1" providerId="claude" />));
  // Ready once the (fake) terminal is attached and the first snapshot came: the composer is enabled then.
  for (let i = 0; i < 50 && host.querySelector<HTMLTextAreaElement>("[data-testid=native-cli-composer]")?.disabled !== false; i++) await act(async () => {});
  expect(host.querySelector<HTMLTextAreaElement>("[data-testid=native-cli-composer]")?.disabled).toBe(false);
  return host;
}
async function unmount(host: HTMLDivElement) {
  const at = roots.findIndex((entry) => entry.host === host);
  await act(async () => roots[at]!.root.unmount());
  host.remove();
  roots.splice(at, 1);
}
const composer = (host: HTMLElement) => host.querySelector<HTMLTextAreaElement>("[data-testid=native-cli-composer]")!;
async function type(host: HTMLElement, text: string) {
  const field = composer(host);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(host: HTMLElement) {
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

beforeEach(() => {
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (name: string) => saved.get(name) ?? null, setItem: (name: string, value: string) => void saved.set(name, value), removeItem: (name: string) => void saved.delete(name) });
  resetChatComposersForTest();
  fake.prompts.length = 0;
  fake.replies.length = 0;
  usePerchStore.setState({ connected: true, activeHostId: "local", sessions: [{ id: "s1", title: "", cwd: "/tmp/p", createdAt: 0, status: "idle", hostId: "local" }] as never });
});
afterEach(async () => {
  for (const { host } of [...roots]) await unmount(host);
  vi.unstubAllGlobals();
});

it("keeps a send in flight across the view being replaced, and never sends it twice", async () => {
  const first = await mount();
  await type(first, "ship it");
  await submit(first);
  expect(fake.prompts).toHaveLength(1);
  const { operationId } = fake.prompts[0]!;
  // The view goes (a reload, a swap or the breakpoint) while the send is in flight; a new one comes.
  await unmount(first);
  const second = await mount();
  expect(second.querySelector("[data-native-outbox]")?.getAttribute("data-native-outbox")).toBe("sending");
  await submit(second);
  expect(fake.prompts).toHaveLength(1);
  // The answer lands in the chat, not in the view that sent it.
  await act(async () => fake.replies[0]!({ type: "agent.ui.result", accepted: true }));
  expect(composer(second).value).toBe("");
  expect(second.querySelector("[data-native-outbox]")?.getAttribute("data-native-outbox")).toBe("delivered");
  expect(fake.prompts.map((prompt) => prompt.operationId)).toEqual([operationId]);
});

it("shows two copies of one chat the same draft and lets only one send go", async () => {
  const left = await mount();
  const right = await mount();
  await type(left, "one draft");
  expect(composer(right).value).toBe("one draft");
  await submit(left);
  await submit(right);
  expect(fake.prompts).toHaveLength(1);
  expect(right.querySelector("[data-native-outbox]")?.getAttribute("data-native-outbox")).toBe("sending");
});

it("restores the draft and its operation id after the page reloads", async () => {
  const before = await mount();
  await type(before, "half written");
  await unmount(before);
  resetChatComposersForTest(); // the page reloads: memory goes, the saved draft stays
  const after = await mount();
  expect(composer(after).value).toBe("half written");
  await submit(after);
  const firstId = fake.prompts[0]!.operationId;
  await act(async () => fake.replies[0]!({ type: "error", message: "refused" }));
  await unmount(after);
  resetChatComposersForTest();
  const again = await mount();
  await submit(again);
  // The retry is the same operation, so the core can never deliver it twice.
  expect(fake.prompts.map((prompt) => prompt.operationId)).toEqual([firstId, firstId]);
});
