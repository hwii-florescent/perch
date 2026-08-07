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
// This file still never calls `createPerchTerminal` itself — it only
// exercises the two pure helpers below, never constructing a real xterm
// `Terminal` or touching `ResizeObserver`/`document.fonts`.
import { describe, it, expect } from "vitest";

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
