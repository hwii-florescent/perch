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
