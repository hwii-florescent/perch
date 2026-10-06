// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Terminal } from "@xterm/xterm";
import { attachTerminalTuiWheel } from "./terminalTuiWheel";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }) })) as never;
  window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
  // jsdom has no layout. Supply xterm's DOM font probe with an 8×16 cell;
  // otherwise it correctly refuses to report mouse coordinates at all.
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("xterm-char-measure-element") ? 256 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("xterm-char-measure-element") ? 16 : 0;
  });
});
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

async function terminal() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const term = new Terminal({ allowProposedApi: true });
  term.open(host);
  const screen = host.querySelector<HTMLElement>(".xterm-screen")!;
  const bounds = vi.spyOn(screen, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 384, width: 800, height: 384,
    toJSON() {},
  });
  const stop = attachTerminalTuiWheel(term);
  const reports: string[] = [];
  term.onData((data) => reports.push(data));
  const write = (data: string) => new Promise<void>((resolve) => term.write(data, resolve));
  await write("\x1b[?1000h\x1b[?1006h"); // vt200 mouse tracking, SGR encoding
  const wheel = (deltaY: number, init: WheelEventInit = {}, legacyDelta?: number) => {
    const event = new WheelEvent("wheel", {
      bubbles: true, cancelable: true, deltaY, clientX: 8, clientY: 8, ...init,
    });
    if (legacyDelta !== undefined) Object.defineProperty(event, "wheelDeltaY", { value: legacyDelta });
    screen.dispatchEvent(event);
    return event;
  };
  cleanups.push(() => { stop(); term.dispose(); host.remove(); });
  return { term, reports, write, wheel, stop, bounds };
}

// These are real xterm onData events, not mocked replay counts: each string
// goes through the same input/lease path as keyboard input in the app.
describe("TUI trackpad wheel distance", () => {
  it("sends one mouse report per row, not one per wheel event", async () => {
    const { reports, wheel } = await terminal();
    const original = wheel(48); // three 16px rows
    expect(original.defaultPrevented).toBe(true);
    expect(reports).toHaveLength(0); // drains after the original xterm handler
    await Promise.resolve();
    expect(reports).toHaveLength(3);
    expect(reports.every((report) => report.startsWith("\x1b[<65;"))).toBe(true);
  });

  it("accumulates sub-row input and preserves momentum distance without a cap", async () => {
    const { reports, wheel } = await terminal();
    wheel(8);
    await Promise.resolve();
    expect(reports).toHaveLength(0);
    wheel(8);
    await Promise.resolve();
    expect(reports).toHaveLength(1);
    wheel(160);
    wheel(16);
    await Promise.resolve();
    expect(reports).toHaveLength(12);
  });

  it("drops the old fractional distance and queued reports on direction reversal", async () => {
    const { reports, wheel } = await terminal();
    wheel(24); // one queued report plus half a row
    wheel(-8);
    await Promise.resolve();
    expect(reports).toHaveLength(0);
    wheel(-8);
    await Promise.resolve();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(/^\x1b\[<64;/);
  });

  it("uses the rendered row height and keeps mouse modifiers", async () => {
    const { reports, wheel, bounds } = await terminal();
    bounds.mockReturnValue({ ...bounds.getMockImplementation()!(), height: 768 });
    wheel(64, { ctrlKey: true, altKey: true }); // two 32px rows
    await Promise.resolve();
    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.startsWith("\x1b[<89;"))).toBe(true);
  });

  it("leaves notched mice and non-pixel wheel input on xterm's native path", async () => {
    const { reports, wheel } = await terminal();
    wheel(64, {}, 120);
    expect(reports).toHaveLength(1); // synchronous native report
    wheel(3, { deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(reports).toHaveLength(2);
    wheel(1, { deltaMode: WheelEvent.DOM_DELTA_PAGE });
    expect(reports).toHaveLength(3);
    await Promise.resolve();
    expect(reports).toHaveLength(3);
  });

  it("leaves ordinary scrollback, Shift+scroll and keyboard input alone", async () => {
    const { term, reports, write, wheel } = await terminal();
    wheel(48, { shiftKey: true });
    await Promise.resolve();
    expect(reports).toHaveLength(0);
    await write("\x1b[?1000l");
    wheel(48);
    term.input("hello\r", true);
    await Promise.resolve();
    expect(reports).toEqual(["hello\r"]);
    expect(term.options.scrollSensitivity).toBe(1);
    expect(term.options.fastScrollSensitivity).toBe(5);
  });

  it("clears fractional distance when mouse reporting ends", async () => {
    const { reports, write, wheel } = await terminal();
    wheel(8);
    await write("\x1b[?1000l");
    await write("\x1b[?1000h");
    wheel(8);
    await Promise.resolve();
    expect(reports).toHaveLength(0);
    wheel(8);
    await Promise.resolve();
    expect(reports).toHaveLength(1);
  });

  it("does not replay pending input after disposal or loss of input control", async () => {
    const first = await terminal();
    first.wheel(48);
    first.stop();
    await Promise.resolve();
    expect(first.reports).toHaveLength(0);
    const second = await terminal();
    second.wheel(48);
    second.term.options.disableStdin = true;
    await Promise.resolve();
    expect(second.reports).toHaveLength(0);
  });
});
