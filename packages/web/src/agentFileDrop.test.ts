// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";

const { state, upload } = vi.hoisted(() => ({
  state: { connected: true, activeHostId: "remote", sessions: [{ id: "agent", hostId: "local" as string | undefined }] },
  upload: vi.fn(),
}));
vi.mock("./store", () => ({ usePerchStore: { getState: () => state } }));
vi.mock("./attachments", () => ({ uploadAttachment: upload }));
import { attachAgentFileDrop } from "./agentFileDrop";

const cleanups: (() => void)[] = [];
beforeEach(() => {
  state.connected = true;
  state.sessions = [{ id: "agent", hostId: "local" }];
  upload.mockReset().mockImplementation(async (_session: string, file: File) => ({ path: `/uploads/${file.name}` }));
});
afterEach(() => { cleanups.splice(0).forEach((stop) => stop()); });

function setup() {
  const element = document.createElement("div");
  const child = document.createElement("textarea");
  element.append(child);
  document.body.append(element);
  let terminalId: string | null = "pty-1";
  const paste = vi.fn();
  const report = vi.fn();
  const stop = attachAgentFileDrop(element, "agent", () => terminalId, paste, report);
  cleanups.push(() => { stop(); element.remove(); });
  return { element, child, paste, report, stop, setId: (id: string | null) => { terminalId = id; } };
}
function drag(element: HTMLElement, type: string, files: File[] = [], types = ["Files"]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = { types, files, dropEffect: "none" };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  element.dispatchEvent(event);
  return { event, dataTransfer };
}
const file = (name = "notes.txt") => new File(["content"], name, { type: name.endsWith("png") ? "image/png" : "text/plain" });

it("uploads files and images in drop order and inserts one quoted native paste, never Enter", async () => {
  const { child, paste, report } = setup();
  const files = [file("a file's.txt"), file("image.png")];
  const { event } = drag(child, "drop", files);
  expect(event.defaultPrevented).toBe(true);
  expect(report).toHaveBeenCalledWith({ message: "Uploading 2 files…" });
  await vi.waitFor(() => expect(paste).toHaveBeenCalledOnce());
  expect(upload.mock.calls).toEqual(files.map((file) => ["agent", file]));
  expect(paste).toHaveBeenCalledWith("'/uploads/a file'\\''s.txt' '/uploads/image.png' ");
  expect(paste.mock.calls[0][0]).not.toMatch(/[\r\n]/);
  expect(report).toHaveBeenLastCalledWith(null);
});

it("consumes only external file drags, not text or internal tab drags", () => {
  const { child, element } = setup();
  const parent = vi.fn();
  document.body.addEventListener("drop", parent);
  cleanups.push(() => document.body.removeEventListener("drop", parent));
  for (const types of [["text/plain"], ["application/x-perch-session"], []]) {
    expect(drag(child, "dragover", [], types).event.defaultPrevented).toBe(false);
    expect(drag(child, "drop", [], types).event.defaultPrevented).toBe(false);
  }
  expect(parent).toHaveBeenCalledTimes(3);
  expect(drag(element, "dragover").dataTransfer.dropEffect).toBe("copy");
  drag(child, "drop", [file()]);
  expect(parent).toHaveBeenCalledTimes(3);
});

it.each(["disconnected", "read-only", "remote", "direct", "missing-session"])("refuses %s targets before upload and prevents browser navigation", (kind) => {
  const { child, setId, report, paste } = setup();
  if (kind === "disconnected") state.connected = false;
  if (kind === "read-only") setId(null);
  if (kind === "remote" || kind === "direct") state.sessions[0].hostId = kind;
  if (kind === "missing-session") state.sessions = [];
  expect(drag(child, "dragover").dataTransfer.dropEffect).toBe("none");
  expect(drag(child, "drop", [file()]).event.defaultPrevented).toBe(true);
  expect(upload).not.toHaveBeenCalled();
  expect(paste).not.toHaveBeenCalled();
  expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ error: true }));
});

it("uses the owning session, including legacy absent hostId, not the selected host", async () => {
  state.sessions[0].hostId = undefined;
  const { child, paste } = setup();
  drag(child, "drop", [file()]);
  await vi.waitFor(() => expect(paste).toHaveBeenCalledOnce());
});

it.each(["unmount", "replacement", "lease-loss", "disconnect", "deleted"])("does not insert a late upload after %s", async (change) => {
  let finish!: (value: { path: string }) => void;
  upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { child, paste, stop, setId, report } = setup();
  drag(child, "drop", [file(), file("second.txt")]);
  if (change === "unmount") stop();
  if (change === "replacement") setId("pty-2");
  if (change === "lease-loss") setId(null);
  if (change === "disconnect") state.connected = false;
  if (change === "deleted") state.sessions = [];
  finish({ path: "/uploads/late.txt" });
  await vi.waitFor(() => expect(upload).toHaveResolved());
  await Promise.resolve();
  expect(paste).not.toHaveBeenCalled();
  expect(upload).toHaveBeenCalledOnce();
  if (change === "unmount") expect(report).toHaveBeenCalledOnce();
});

it("inserts successes once and reports failed files, including unsafe paths", async () => {
  upload.mockRejectedValueOnce(new Error("upload failed (413)"))
    .mockResolvedValueOnce({ path: "/uploads/bad\npath" });
  const { child, paste, report } = setup();
  drag(child, "drop", [file("large.bin"), file("unsafe.txt"), file("good.png")]);
  await vi.waitFor(() => expect(paste).toHaveBeenCalledWith("'/uploads/good.png' "));
  expect(report).toHaveBeenLastCalledWith({ message: "large.bin: upload failed (413); unsafe.txt: Upload returned an unsafe path", error: true });
});

it("ignores overlapping drops and removes all listeners on cleanup", async () => {
  let finish!: (value: { path: string }) => void;
  upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { child, paste, stop } = setup();
  drag(child, "drop", [file()]);
  expect(drag(child, "dragover").dataTransfer.dropEffect).toBe("none");
  drag(child, "drop", [file("second.txt")]);
  expect(upload).toHaveBeenCalledOnce();
  finish({ path: "/uploads/one" });
  await vi.waitFor(() => expect(paste).toHaveBeenCalledOnce());
  stop();
  expect(drag(child, "drop", [file()]).event.defaultPrevented).toBe(false);
  expect(drag(child, "dragover").event.defaultPrevented).toBe(false);
});

it("rejects folders or an empty file payload", () => {
  const { child, report } = setup();
  drag(child, "drop");
  expect(upload).not.toHaveBeenCalled();
  expect(report).toHaveBeenLastCalledWith({ message: "Drop files or images, not folders.", error: true });
});

describe("native xterm drop input", () => {
  it("marks paste as user input and preserves bracketed paste without submitting", async () => {
    const { element, stop } = setup();
    stop();
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }) })) as never;
    window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
    const term = new Terminal({ allowProposedApi: true });
    term.open(element);
    const user = vi.fn();
    // Same private hook used by onTerminalInput to allow shared user input.
    const core = (term as unknown as { _core: { coreService: { onUserInput: (fn: () => void) => { dispose(): void } } } })._core.coreService;
    const source = core.onUserInput(user);
    const data = vi.fn();
    term.onData(data);
    const detach = attachAgentFileDrop(element, "agent", () => "pty-1", (text) => term.paste(text), vi.fn());
    cleanups.push(() => { detach(); source.dispose(); term.dispose(); });
    await new Promise<void>((resolve) => term.write("\x1b[?2004h", resolve));
    drag(element.querySelector("textarea")!, "drop", [file("image.png")]);
    await vi.waitFor(() => expect(data).toHaveBeenCalledOnce());
    expect(data).toHaveBeenCalledWith("\x1b[200~'/uploads/image.png' \x1b[201~");
    expect(user).toHaveBeenCalledOnce();
  });
});
