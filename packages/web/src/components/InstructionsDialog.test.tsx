// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ClientMessage, ServerMessage } from "@perch/shared";
const wire = vi.hoisted(() => ({ send: vi.fn(), message: (_: ServerMessage) => {}, connection: (_: boolean) => {} }));
vi.mock("../ws", () => ({
  socket: {
    connected: true,
    send: wire.send,
    onMessage: (handler: (message: ServerMessage) => void) => { wire.message = handler; },
    onConnectionChange: (handler: (connected: boolean) => void) => { wire.connection = handler; },
  },
}));
import { InstructionsDialog } from "./InstructionsDialog";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const onClose = vi.fn();
const sent = () => wire.send.mock.calls.map(([message]) => message as ClientMessage);
const lastRequest = () => sent().at(-1) as Extract<ClientMessage, { type: "instructions.get" | "instructions.set" }>;
const field = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) as HTMLTextAreaElement;
async function reply(state: Partial<Extract<ServerMessage, { type: "instructions.state" }>>) {
  const request = lastRequest();
  await act(async () => {
    wire.message({ type: "instructions.state", requestId: request.requestId, scope: request.scope, id: request.id, text: "", folders: [], revision: 0, maxChars: 16000, ...state });
  });
}
const serverInfo = (capabilities: string[]) => ({ type: "server.info", capabilities } as unknown as ServerMessage);
async function type(testId: string, value: string) {
  const element = field(testId);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => { setter.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
}

beforeEach(async () => {
  wire.send.mockClear(); onClose.mockClear();
  await act(async () => { wire.message(serverInfo(["instructions.v1"])); });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<InstructionsDialog scope="project" id="p1" name="Perch" onClose={onClose} />); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("loads what the core stored and saves the text with one folder per line", async () => {
  expect(lastRequest()).toMatchObject({ type: "instructions.get", scope: "project", id: "p1" });
  expect(field("instructions-text").disabled).toBe(true);
  await reply({ text: "Use tabs", folders: ["/ref"], revision: 2 });
  expect(field("instructions-text").value).toBe("Use tabs");
  expect(field("instructions-folders").value).toBe("/ref");
  await type("instructions-text", "Use tabs\nand small commits");
  await type("instructions-folders", "/ref\n\n  /other  \n");
  await act(async () => (document.querySelector('[data-testid="instructions-save"]') as HTMLButtonElement).click());
  expect(lastRequest()).toMatchObject({ type: "instructions.set", scope: "project", id: "p1", text: "Use tabs\nand small commits", folders: ["/ref", "/other"] });
  expect(onClose).not.toHaveBeenCalled();
  await reply({ text: "Use tabs\nand small commits", folders: ["/ref", "/other"], revision: 3 });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("keeps the dialog open and shows the core's reason when a save is refused", async () => {
  await reply({ text: "old" });
  await type("instructions-text", "new");
  await act(async () => (document.querySelector('[data-testid="instructions-save"]') as HTMLButtonElement).click());
  await reply({ text: "old", error: "Instructions are limited to 16000 characters." });
  expect(document.querySelector('[data-testid="instructions-error"]')?.textContent).toBe("Instructions are limited to 16000 characters.");
  expect(onClose).not.toHaveBeenCalled();
});

it("cannot save past the cap and shows a core that has no Instructions as unavailable", async () => {
  await reply({ text: "", maxChars: 5 });
  await type("instructions-text", "123456");
  expect((document.querySelector('[data-testid="instructions-save"]') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => { wire.message(serverInfo([])); });
  wire.send.mockClear();
  await act(async () => { root.render(<InstructionsDialog scope="workspace" id="w1" name="Nest" onClose={onClose} />); });
  expect(wire.send).not.toHaveBeenCalled();
  await act(async () => { await Promise.resolve(); });
  expect(field("instructions-text").disabled).toBe(true);
  expect(document.querySelector('[data-testid="instructions-error"]')?.textContent).toContain("cannot store Instructions");
});
