// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HeldMessage } from "@perch/shared";
import { HeldMessages, senderLine } from "./HeldMessages";
import type { InboundState } from "../../inbound";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const held = (id: string, text = `text ${id}`): HeldMessage => ({ id, fromSessionId: "lead", fromProvider: "claude", fromLabel: "the lead", text, at: 0 });
const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const done = () => Promise.resolve({ outcome: "done", count: 1 });

it("is quiet while the session accepts and nothing is held", () => {
  act(() => root.render(<HeldMessages state={{ mode: "accept", held: [] }} canAct onAct={done} onOpen={() => {}} />));
  expect(q("native-cli-inbound")).toBeNull();
});

it("shows each held message with its sender and Deliver and Discard, never as the person's own", async () => {
  expect(senderLine(held("a"))).toBe("claude “the lead”");
  const onAct = vi.fn().mockReturnValue(done());
  const onOpen = vi.fn();
  const state: InboundState = { mode: "hold", held: [held("a", "please run the tests"), held("b")] };
  act(() => root.render(<HeldMessages state={state} canAct onAct={onAct} onOpen={onOpen} />));
  expect(host.querySelectorAll('[data-testid="native-cli-held"]')).toHaveLength(2);
  expect(q("native-cli-held-text")!.textContent).toBe("please run the tests");
  expect(q("native-cli-held-from")!.textContent).toBe("claude “the lead”");
  expect(q("native-cli-inbound")!.textContent).toContain("2 messages from other sessions wait for you");
  await click(q("native-cli-held-deliver")!);
  expect(onAct).toHaveBeenLastCalledWith({ action: "deliver", messageId: "a" });
  await click(q("native-cli-held-discard")!);
  expect(onAct).toHaveBeenLastCalledWith({ action: "discard", messageId: "a" });
  await click(q("native-cli-held-deliver-all")!);
  expect(onAct).toHaveBeenLastCalledWith({ action: "deliver_all" });
  await click(q("native-cli-held-discard-all")!);
  expect(onAct).toHaveBeenLastCalledWith({ action: "discard_all" });
  await click(q("native-cli-held-open")!);
  expect(onOpen).toHaveBeenCalledWith("lead");
});

it("changes the mode from the card and shows the core's reason when it refuses", async () => {
  const onAct = vi.fn().mockResolvedValue({ outcome: "refused", reason: "Take control of this chat before answering a held message" });
  act(() => root.render(<HeldMessages state={{ mode: "hold", held: [held("a")] }} canAct onAct={onAct} onOpen={() => {}} />));
  const select = q("native-cli-inbound-mode") as unknown as HTMLSelectElement;
  expect([...select.options].map((option) => option.value)).toEqual(["accept", "hold", "refuse"]);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(select, "refuse");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onAct).toHaveBeenCalledWith({ action: "set_mode", mode: "refuse" });
  await click(q("native-cli-held-deliver")!);
  expect(q("native-cli-inbound-note")!.textContent).toContain("Take control of this chat");
});

it("shows a quiet line while holding or refusing with nothing waiting, and cannot act without control", () => {
  act(() => root.render(<HeldMessages state={{ mode: "refuse", held: [] }} canAct={false} onAct={done} onOpen={() => {}} />));
  expect(q("native-cli-inbound")!.textContent).toContain("Refusing messages from other sessions");
  expect((q("native-cli-inbound-mode") as unknown as HTMLSelectElement).disabled).toBe(true);
  act(() => root.render(<HeldMessages state={{ mode: "hold", held: [held("a")] }} canAct={false} onAct={done} onOpen={() => {}} />));
  expect((q("native-cli-held-deliver") as HTMLButtonElement).disabled).toBe(true);
  expect(host.textContent).toContain("Take control of this chat to answer");
});
