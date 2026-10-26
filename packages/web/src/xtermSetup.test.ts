// @vitest-environment jsdom
//
// xtermSetup.ts is not side-effect-free at *import* time either: `@xterm/
// addon-fit`'s bundled UMD wrapper references `self` at module-eval time
// (webpack's universalModuleDefinition preamble), which doesn't exist under
// vitest's repo-default "node" environment (see vitest.config.ts) and throws
// on import before a single test runs. jsdom supplies `self`/`window`/etc. so
// the module loads. xtermSetup.ts also imports `./store` (to read
// `settings.terminalScrollback` without threading it through every caller),
// and store.ts's own module-scope `socket.connect()` constructs a real
// `WebSocket` — same problem store.test.ts already has, same fix: install a
// no-op stub before import (see that file's comment for the details).
//
// Constructor tests below stub the canvas and observers needed by real xterm.
import { describe, it, expect, vi } from "vitest";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  addEventListener(): void {}
  removeEventListener(): void {}
  send(): void {}
  close(): void {}
}
(globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;

const { clampScrollback, selectTerminalTheme, DEFAULT_SCROLLBACK, MIN_SCROLLBACK, MAX_SCROLLBACK } =
  await import("./xtermSetup");

describe("clampScrollback", () => {
  it("clamps a value below the minimum up to MIN_SCROLLBACK", () => {
    expect(clampScrollback(1)).toBe(MIN_SCROLLBACK);
    expect(clampScrollback(0)).toBe(MIN_SCROLLBACK);
    expect(clampScrollback(-500)).toBe(MIN_SCROLLBACK);
  });

  it("clamps a value above the maximum down to MAX_SCROLLBACK", () => {
    expect(clampScrollback(10_000_000)).toBe(MAX_SCROLLBACK);
    expect(clampScrollback(Infinity)).toBe(DEFAULT_SCROLLBACK); // not finite
  });

  it("resolves undefined to the exact pre-existing hardcoded default", () => {
    expect(clampScrollback(undefined)).toBe(DEFAULT_SCROLLBACK);
    expect(DEFAULT_SCROLLBACK).toBe(10000);
  });

  it("resolves null to the default", () => {
    expect(clampScrollback(null)).toBe(DEFAULT_SCROLLBACK);
  });

  it("resolves NaN to the default rather than clamping it into range", () => {
    expect(clampScrollback(NaN)).toBe(DEFAULT_SCROLLBACK);
  });

  it("passes an in-range value straight through unchanged", () => {
    expect(clampScrollback(DEFAULT_SCROLLBACK)).toBe(DEFAULT_SCROLLBACK);
    expect(clampScrollback(50000)).toBe(50000);
  });

  it("floors a fractional in-range value", () => {
    expect(clampScrollback(1234.9)).toBe(1234);
  });
});

describe("selectTerminalTheme", () => {
  const theme = { background: "#000000", foreground: "#ffffff" };
  const themeDark = { background: "#111111", foreground: "#eeeeee" };
  const themeLight = { background: "#ffffff", foreground: "#000000" };

  it("picks themeDark when dark mode is active and themeDark is non-empty", () => {
    expect(selectTerminalTheme({ theme, themeDark, themeLight }, true)).toBe(themeDark);
  });

  it("falls back to theme in dark mode when themeDark is absent", () => {
    expect(selectTerminalTheme({ theme }, true)).toBe(theme);
  });

  it("picks themeLight when light mode is active and themeLight is non-empty", () => {
    expect(selectTerminalTheme({ theme, themeDark, themeLight }, false)).toBe(themeLight);
  });

  it("returns undefined when neither the scoped palette nor theme is present", () => {
    expect(selectTerminalTheme({}, true)).toBeUndefined();
    expect(selectTerminalTheme(null, true)).toBeUndefined();
    expect(selectTerminalTheme(undefined, false)).toBeUndefined();
  });

  it("treats an empty themeDark/themeLight object as absent, falling back to theme", () => {
    expect(selectTerminalTheme({ theme, themeDark: {} }, true)).toBe(theme);
    expect(selectTerminalTheme({ theme, themeLight: {} }, false)).toBe(theme);
  });

  it("treats an empty theme as absent too, yielding undefined", () => {
    expect(selectTerminalTheme({ theme: {} }, true)).toBeUndefined();
  });
});

describe("createPerchTerminal", () => {
  it("keeps an empty write's callback, and later writes, across a resize", async () => {
    // jsdom has no canvas, matchMedia, ResizeObserver or IntersectionObserver; xterm only uses them to measure and pause.
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }) })) as never;
    window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
    globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
    globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
    const { createPerchTerminal } = await import("./xtermSetup");
    const { socket } = await import("./ws");
    const recover = vi.spyOn(socket, "recoverTerminalStream").mockImplementation(() => {});
    const { term, dispose } = createPerchTerminal(document.createElement("div"), () => {});
    const fired: string[] = [];
    term.write("", () => fired.push("replay"));
    term.write("live", () => fired.push("live"));
    term.resize(100, 30); // flushes queued writes synchronously
    expect(fired).toEqual(["replay", "live"]);
    expect(term.buffer.active.getLine(0)?.translateToString(true)).toBe("live");
    term.write(new Uint8Array(16 * 1024 * 1024 + 1));
    term.write("ignored until reconnect");
    expect(recover).toHaveBeenCalledTimes(1);
    dispose();
    // terminalKeeper disposes disconnected views. The reconnected view gets
    // a fresh parser and budget rather than remaining in overload forever.
    const fresh = createPerchTerminal(document.createElement("div"), () => {});
    fresh.term.write("fresh replay");
    fresh.term.resize(100, 30);
    expect(fresh.term.buffer.active.getLine(0)?.translateToString(true)).toBe("fresh replay");
    fresh.dispose();
    recover.mockRestore();
  });

  it.each(["text", "bytes", "stream"])("does not replay parsed %s when a resize interrupts a write batch", async (kind) => {
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }), clearRect() {}, fillRect() {} })) as never;
    window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
    globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
    globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
    const { createPerchTerminal } = await import("./xtermSetup");
    const { term, dispose } = createPerchTerminal(document.createElement("div"), () => {});
    const parsed = vi.fn();
    let now = 0;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    let completed = () => {};
    const marker = term.parser.registerCsiHandler({ final: "z" }, () => { completed(); return true; });
    try {
      const frame = "transcript\r\nprompt\r\nfooter🙂";
      const encoded = new TextEncoder().encode(frame);
      await new Promise<void>((resolve) => {
        // Split the UTF-8 emoji too: retiring a byte chunk must not reset the decoder.
        completed = () => {
          parsed();
          now = 20; // Exceed xterm's 12ms parser budget after the first chunk.
          resolve();
        };
        // Streaming PTY writes have no client callback; the marker gives this
        // test the same deterministic parser barrier without adding one.
        if (kind === "stream") term.write(frame + "\x1b[0z");
        else term.write(kind === "bytes" ? encoded.slice(0, -1) : frame, completed);
        term.write(kind === "bytes" ? new Uint8Array([...encoded.slice(-1), ...new TextEncoder().encode("\r\nnext frame")]) : "\r\nnext frame");
      });
      clock.mockRestore();
      // Tab reattachment fits the terminal while another parser slice is pending.
      term.resize(100, 30);
      const lines = Array.from({ length: 4 }, (_, i) => term.buffer.active.getLine(i)?.translateToString(true));
      expect(lines).toEqual(["transcript", "prompt", "footer🙂", "next frame"]);
      expect(parsed).toHaveBeenCalledTimes(1);
      // Subsequent cursor-relative updates must still target the original rows.
      await new Promise<void>((resolve) => term.write("\x1b[2A\rPROMPT\x1b[K", resolve));
      expect(term.buffer.active.getLine(1)?.translateToString(true)).toBe("PROMPT");
      expect(term.buffer.active.getLine(2)?.translateToString(true)).toBe("footer🙂");
      expect(parsed).toHaveBeenCalledTimes(1);
    } finally { clock.mockRestore(); marker.dispose(); dispose(); }
  });

  it("defers and coalesces fits requested inside a write callback without losing later output", async () => {
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }), clearRect() {}, fillRect() {} })) as never;
    window.matchMedia ??= (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) as never;
    globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
    globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
    const { createPerchTerminal } = await import("./xtermSetup");
    const host = document.createElement("div");
    let width = 800;
    Object.defineProperties(host, {
      offsetWidth: { get: () => width }, clientWidth: { get: () => width },
      offsetHeight: { value: 480 }, clientHeight: { value: 480 },
    });
    host.getBoundingClientRect = () => new DOMRect(0, 0, width, 480);
    document.body.append(host);
    const resized = vi.fn();
    const created = createPerchTerminal(host, resized);
    const dimensions = vi.spyOn(created.term, "dimensions", "get").mockReturnValue({ css: { cell: { width: 8, height: 16 } } } as never);
    try {
      created.fit();
      resized.mockClear();
      await new Promise<void>((resolve) => {
        created.term.write("frame", () => {
          created.term.write(" before");
          width = 640;
          expect(created.fit()).toBeNull();
          expect(created.fit()).toBeNull();
          created.term.write(" after", resolve);
        });
      });
      expect(created.term.cols).toBe(80);
      expect(resized.mock.calls).toEqual([[80, 30]]);
      expect(created.term.buffer.active.getLine(0)?.translateToString(true)).toBe("frame before after");
      // A queued fit must also be safe if the callback disposes its terminal.
      await new Promise<void>((resolve) => created.term.write("", () => { created.fit(); created.dispose(); resolve(); }));
      await Promise.resolve();
    } finally { dimensions.mockRestore(); created.dispose(); host.remove(); }
  });

  it("classifies real xterm user input separately from replies without inspecting or rewriting bytes", async () => {
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }), clearRect() {}, fillRect() {} })) as never;
    window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
    globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
    globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
    const { createPerchTerminal, onTerminalInput } = await import("./xtermSetup");
    const { term, dispose } = createPerchTerminal(document.createElement("div"), () => {});
    const events: { data: string; user: boolean }[] = [];
    const input = onTerminalInput(term, (data, user) => events.push({ data, user }));
    const write = (data: string) => new Promise<void>((resolve) => term.write(data, resolve));
    try {
      expect(input.tracksUserInput, "the pinned xterm source hook must exist").toBe(true);
      term.input("typed");
      await write("\x1b[6n"); // Fresh cursor-position query, not user input.
      expect(events.splice(0)).toEqual([{ data: "typed", user: true }, { data: "\x1b[1;1R", user: false }]);
      await write("\x1b[?2004h");
      term.input("\x1b[1;2R"); // Reply-shaped user input is never filtered.
      expect(events.splice(0)).toEqual([{ data: "\x1b[1;2R", user: true }]);
      term.paste("\x1b[1;2R\x1b]11;rgb:00/00/00\x07");
      // Preserve exactly what xterm emits, including its own paste sanitization.
      expect(events.splice(0)).toEqual([{ data: "\x1b[200~␛[1;2R␛]11;rgb:00/00/00\x07\x1b[201~", user: true }]);
      await write("\x1b]11;?\x07");
      expect(events).toHaveLength(1);
      expect(events[0].user).toBe(false);
      expect(events[0].data).toContain("\x1b]11;");
      events.length = 0;
      term.options.disableStdin = true;
      await write("\x1b[6n");
      expect(events, "replay replies are suppressed even for the size owner").toEqual([]);
    } finally { input.dispose(); dispose(); }
  });

  it.each([0, 1, 5, 7])("recovers macOS's context-menu-only Ctrl+Enter through xterm (Kitty flags %i)", async (flags) => {
    HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ width: 8 }), clearRect() {}, fillRect() {} })) as never;
    window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
    globalThis.ResizeObserver ??= class { observe() {} disconnect() {} } as never;
    globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} } as never;
    const userAgent = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15");
    const { createPerchTerminal } = await import("./xtermSetup");
    const { terminalKeyHandler } = await import("./keybinds");
    const container = document.createElement("div");
    document.body.append(container);
    const { term, dispose } = createPerchTerminal(container, () => {});
    term.attachCustomKeyEventHandler(terminalKeyHandler);
    const sent: string[] = [];
    term.onData((data) => sent.push(data));
    const textarea = term.textarea!;
    const key = (type: string, key: string, ctrlKey = true) => textarea.dispatchEvent(new KeyboardEvent(type, {
      key, code: key === "Control" ? "ControlLeft" : "Enter", keyCode: key === "Control" ? 17 : 13,
      ctrlKey, bubbles: true, cancelable: true,
    }));
    // Native keyboard menus target the hovered sidebar/gutter, not the focused textarea.
    const menu = (ctrlKey = false) => document.body.dispatchEvent(new MouseEvent("contextmenu", { button: 2, ctrlKey, bubbles: true, cancelable: true }));
    const expected = flags ? "\x1b[13;5u" : "\r";
    try {
      await new Promise<void>((resolve) => term.write(`\x1b[=${flags}u`, resolve));
      term.focus();
      key("keydown", "Control");
      menu(); // Physical macOS Ctrl+Return: no keydown, menu has ctrlKey=false.
      key("keyup", "Enter");
      key("keyup", "Control", false);
      expect(sent.splice(0)).toEqual([expected]);

      key("keydown", "Control");
      menu();
      key("keyup", "Control", false); // Modifier released before Enter.
      key("keyup", "Enter", false);
      expect(sent.splice(0)).toEqual([expected]);

      key("keydown", "Control");
      key("keydown", "Enter");
      menu(); // A browser that also delivered keydown must not double-send.
      key("keyup", "Enter");
      key("keyup", "Control", false);
      expect(sent.splice(0)).toEqual([expected]);

      menu(); // A mouse menu alone is never terminal input.
      expect(sent).toEqual([]);
      key("keydown", "Control");
      menu(true); // Ctrl+click without an Enter release must not type anything.
      key("keyup", "Control", false);
      expect(sent).toEqual([]);
      key("keydown", "Enter", false);
      key("keyup", "Enter", false);
      expect(sent.splice(0)).toEqual(["\r"]);
      key("keyup", "Enter"); // A stray keyup/focus transfer has no menu to recover.
      expect(sent).toEqual([]);

      key("keydown", "Control");
      menu();
      textarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      key("keyup", "Enter");
      expect(sent).toEqual([]);

      const other = document.createElement("input");
      container.append(other);
      other.focus();
      menu();
      key("keyup", "Enter");
      expect(sent).toEqual([]); // A terminal that isn't focused cannot claim the menu.
      other.remove();
      term.focus();
      term.options.disableStdin = true;
      key("keydown", "Control");
      menu();
      key("keyup", "Enter");
      expect(sent).toEqual([]); // A watcher still cannot type through recovery.
      term.options.disableStdin = false;
      term.attachCustomKeyEventHandler(() => false);
      menu();
      key("keyup", "Enter");
      expect(sent).toEqual([]); // Perch/custom key gates still own intercepted keys.
    } finally {
      dispose();
      container.remove();
      userAgent.mockRestore();
    }
  });
});
