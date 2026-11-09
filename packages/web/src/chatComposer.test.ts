// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ requests: [] as { operationId?: string; text?: string }[], replies: [] as { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] }));
vi.mock("./nativeUi", async (original) => {
  const real = await original<typeof import("./nativeUi")>();
  return {
    ...real,
    requestNativeUi: vi.fn((request: { operationId?: string; text?: string }) => {
      native.requests.push(request);
      return new Promise((resolve, reject) => native.replies.push({ resolve, reject }));
    }),
  };
});
import { NativeUiError } from "./nativeUi";
import { chatComposer, chatKey, clearOutbox, editDraft, resetChatComposersForTest, restoreUnconfirmed, sendDraft } from "./chatComposer";

const key = chatKey("s1", "claude");
const send = () => sendDraft(key, { sessionId: "s1", providerId: "claude", generation: 1, baseline: () => 0 });
const accept = (at = native.replies.length - 1) => native.replies[at]!.resolve({ type: "agent.ui.result", accepted: true });

beforeEach(() => {
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (name: string) => saved.get(name) ?? null, setItem: (name: string, value: string) => void saved.set(name, value), removeItem: (name: string) => void saved.delete(name) });
  resetChatComposersForTest();
  native.requests.length = 0;
  native.replies.length = 0;
});

describe("the chat composer the host keeps", () => {
  it("lets one send through while one is in flight, whichever copy or view asks", async () => {
    editDraft(key, "hello");
    const first = send();
    // Another copy of the chat (a clone, a reloaded view, the phone layout) presses Send meanwhile.
    expect(await send()).toEqual({ kind: "busy" });
    expect(chatComposer(key).outbox?.phase).toBe("sending");
    accept();
    expect(await first).toEqual({ kind: "sent" });
    expect(native.requests).toHaveLength(1);
    // The draft settled even though no view is mounted to do it.
    expect(chatComposer(key).draft.text).toBe("");
    expect(chatComposer(key).outbox?.phase).toBe("delivered");
  });

  it("retries a refused send with the same operation id, also after the page reloads", async () => {
    editDraft(key, "fix the bug");
    const id = chatComposer(key).draft.operationId;
    const first = send();
    native.replies[0]!.reject(new Error("Take control of this agent before sending input"));
    expect(await first).toEqual({ kind: "failed", error: "Take control of this agent before sending input" });
    expect(chatComposer(key).draft).toMatchObject({ text: "fix the bug", operationId: id });
    // A page reload: memory is gone, the saved draft is not.
    resetChatComposersForTest();
    expect(chatComposer(key).draft).toMatchObject({ text: "fix the bug", operationId: id });
    const retry = send();
    expect(native.requests[1]!.operationId).toBe(id);
    accept();
    expect(await retry).toEqual({ kind: "sent" });
  });

  it("gives an edited draft a new operation id", () => {
    editDraft(key, "a");
    const before = chatComposer(key).draft.operationId;
    editDraft(key, "ab");
    expect(chatComposer(key).draft.operationId).not.toBe(before);
    expect(editDraft(key, "x".repeat(64 * 1024 + 1))).toBe(false);
    expect(chatComposer(key).draft.text).toBe("ab");
  });

  it("never replays an unconfirmed send; its text comes back only as a new message", async () => {
    editDraft(key, "maybe sent");
    const id = chatComposer(key).draft.operationId;
    const first = send();
    native.replies[0]!.reject(new NativeUiError("The CLI has not confirmed this action.", true));
    expect((await first).kind).toBe("unconfirmed");
    expect(chatComposer(key).draft.text).toBe("");
    expect(chatComposer(key).outbox).toMatchObject({ phase: "unconfirmed", operationId: id });
    expect(restoreUnconfirmed(key)).toBe(true);
    expect(chatComposer(key).draft.text).toBe("maybe sent");
    expect(chatComposer(key).draft.operationId).not.toBe(id);
    expect(chatComposer(key).outbox).toBeNull();
  });

  it("keeps an edit typed while the send was in flight", async () => {
    editDraft(key, "first");
    const first = send();
    editDraft(key, "second");
    accept();
    await first;
    expect(chatComposer(key).draft.text).toBe("second");
    clearOutbox(key);
    expect(chatComposer(key).outbox).toBeNull();
  });
});
