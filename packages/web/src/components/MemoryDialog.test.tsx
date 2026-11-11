// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ClientMessage, MemoryEntry, ServerMessage } from "@perch/shared";
// Every subscriber hears each message: the dialog's own capability and memory listeners and the app store's.
const wire = vi.hoisted(() => {
  const handlers = new Set<(message: ServerMessage) => void>();
  return { send: vi.fn(), handlers, message: (message: ServerMessage) => { for (const handler of [...handlers]) handler(message); } };
});
vi.mock("../ws", () => ({
  socket: {
    connected: true,
    connect: () => {},
    send: wire.send,
    onMessage: (handler: (message: ServerMessage) => void) => { wire.handlers.add(handler); return () => { wire.handlers.delete(handler); }; },
    onConnectionChange: () => () => {},
  },
}));
import { MemoryDialog } from "./MemoryDialog";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
const onClose = vi.fn();
const sent = () => wire.send.mock.calls.map(([message]) => message as ClientMessage);
const lastRequest = () => sent().at(-1) as Extract<ClientMessage, { type: `memory.${string}` }>;
const q = <T extends Element = HTMLElement>(testId: string) => document.querySelector(`[data-testid="${testId}"]`) as T;
const entry = (name: string, revision: string, extra: Partial<MemoryEntry> = {}): MemoryEntry => ({
  name, size: 12, revision, summary: `About ${name}`, updatedAt: Date.now() - 3 * 3_600_000,
  author: { kind: "agent", session: "s1", label: "Claude in Perch" }, ...extra,
});
async function state(files: MemoryEntry[], extra: Record<string, unknown> = {}) {
  await act(async () => {
    wire.message({ type: "memory.state", requestId: lastRequest().requestId, projectId: "p1", files, maxFiles: 64, maxChars: 16000, ...extra } as ServerMessage);
  });
}
async function file(text: string, e: MemoryEntry) {
  await act(async () => {
    wire.message({ type: "memory.file", requestId: lastRequest().requestId, projectId: "p1", name: e.name, file: { entry: e, text } } as ServerMessage);
  });
}
const click = (testId: string) => act(async () => q<HTMLButtonElement>(testId).click());
async function type(testId: string, value: string) {
  const element = q<HTMLTextAreaElement>(testId);
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
}

beforeEach(async () => {
  wire.send.mockClear(); onClose.mockClear();
  await act(async () => { wire.message({ type: "server.info", capabilities: ["memory.v1"] } as unknown as ServerMessage); });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<MemoryDialog projectId="p1" name="Perch" onClose={onClose} />); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("lists the files with author, age, size and the caps, marking outside edits", async () => {
  expect(lastRequest()).toMatchObject({ type: "memory.list", projectId: "p1" });
  await state([entry("notes.md", "aaa"), entry("hand.md", "bbb", { author: { kind: "outside", label: "unknown" } })], { maxFiles: 5, maxChars: 100 });
  expect(q("memory-row-notes.md").textContent).toContain("Claude in Perch · 3h ago · 12 chars");
  expect(q("memory-row-notes.md").textContent).toContain("About notes.md");
  expect(q("memory-row-hand.md").textContent).toContain("edited outside Perch");
  expect(q("memory-row-hand.md").textContent).not.toContain("unknown");
  expect(q("memory-caps").textContent).toBe("2 / 5 files, up to 100 characters each");
  expect(q("memory-dialog").textContent).toContain("information, not instructions");
});

it("creates a file without a base revision and saves an edit against the revision it opened", async () => {
  await state([entry("notes.md", "aaa")]);
  await click("memory-new");
  await type("memory-name", "todo");
  await type("memory-text", "ship it");
  await click("memory-save");
  expect(lastRequest()).toEqual({ type: "memory.set", requestId: expect.any(String), projectId: "p1", name: "todo.md", text: "ship it", baseRevision: undefined });
  await state([entry("notes.md", "aaa"), entry("todo.md", "ccc")]);
  expect(q("memory-row-todo.md")).not.toBeNull();

  await click("memory-open-notes.md");
  expect(lastRequest()).toMatchObject({ type: "memory.get", name: "notes.md" });
  await file("old text", entry("notes.md", "aaa"));
  expect(q<HTMLTextAreaElement>("memory-text").value).toBe("old text");
  await type("memory-text", "new text");
  await click("memory-save");
  expect(lastRequest()).toMatchObject({ type: "memory.set", name: "notes.md", text: "new text", baseRevision: "aaa" });
  await state([entry("notes.md", "ddd")]);
  expect(q("memory-text")).toBeNull();
});

it("keeps the draft on a save conflict and replaces it only when their version is loaded", async () => {
  await state([entry("notes.md", "aaa")]);
  await click("memory-open-notes.md");
  await file("old", entry("notes.md", "aaa"));
  await type("memory-text", "my edit");
  await click("memory-save");
  await state([entry("notes.md", "zzz")], { conflict: true, name: "notes.md", error: "changed" });
  expect(q("memory-conflict").textContent).toContain("Someone else changed this file");
  expect(q<HTMLTextAreaElement>("memory-text").value).toBe("my edit");
  expect(q<HTMLButtonElement>("memory-save").disabled).toBe(true);

  await click("memory-reload");
  expect(lastRequest()).toMatchObject({ type: "memory.get", name: "notes.md" });
  expect(q<HTMLTextAreaElement>("memory-text").value).toBe("my edit");
  await file("their text", entry("notes.md", "zzz"));
  expect(q<HTMLTextAreaElement>("memory-text").value).toBe("their text");
  expect(q("memory-conflict")).toBeNull();
  await click("memory-save");
  expect(lastRequest()).toMatchObject({ type: "memory.set", baseRevision: "zzz" });
});

it("deletes only after confirming, with the listed revision", async () => {
  await state([entry("notes.md", "aaa"), entry("b.md", "bbb")]);
  await click("memory-delete-notes.md");
  expect(sent().some((m) => m.type === "memory.delete")).toBe(false);
  await click("confirm-cancel");
  expect(sent().some((m) => m.type === "memory.delete")).toBe(false);
  await click("memory-delete-notes.md");
  await click("confirm-accept");
  expect(lastRequest()).toMatchObject({ type: "memory.delete", name: "notes.md", baseRevision: "aaa" });
  await state([entry("b.md", "bbb")]);
  expect(q("memory-row-notes.md")).toBeNull();
  expect(q("memory-row-b.md")).not.toBeNull();
});

it("says so when a delete was refused because the file changed", async () => {
  await state([entry("notes.md", "aaa")]);
  await click("memory-delete-notes.md");
  await click("confirm-accept");
  await state([entry("notes.md", "new")], { conflict: true, name: "notes.md", error: "changed" });
  expect(q("memory-error").textContent).toContain("changed by someone else");
  expect(q("memory-row-notes.md")).not.toBeNull();
});

it("offers the switch only when the core has it, and sends the opposite of what is shown", async () => {
  await state([entry("notes.md", "aaa")]);
  expect(q("memory-enabled")).toBeNull();
  await act(async () => root.unmount());
  await act(async () => { wire.message({ type: "server.info", capabilities: ["memory.v1", "memory.off.v1"] } as unknown as ServerMessage); });
  root = createRoot(host);
  await act(async () => { root.render(<MemoryDialog projectId="p1" name="Perch" onClose={onClose} />); });
  await state([entry("notes.md", "aaa")]);
  expect(q<HTMLInputElement>("memory-enabled").checked).toBe(true);
  await click("memory-enabled");
  expect(lastRequest()).toEqual({ type: "memory.enable", requestId: expect.any(String), projectId: "p1", enabled: false });
  await state([entry("notes.md", "aaa")], { off: true });
  expect(q<HTMLInputElement>("memory-enabled").checked).toBe(false);
  expect(q("memory-row-notes.md")).not.toBeNull();
  await click("memory-enabled");
  expect(lastRequest()).toMatchObject({ type: "memory.enable", enabled: true });
});
