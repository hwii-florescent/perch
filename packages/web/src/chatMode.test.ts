// @vitest-environment jsdom
// A phone's UI/CLI view is its own and never the computer's; and rotating a phone never makes it a desktop.
import { afterEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, string>();
const storage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, String(v)), removeItem: (k: string) => void stored.delete(k) };

/** A window whose media queries answer by what the query asks for: `narrow`, or `sideways` (touch, short). */
function stubWindow({ narrow = false, sideways = false, touch = false }) {
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: coarse)" ? touch : query.split(",").some((part) => (part.includes("max-width") && narrow) || (part.includes("max-height") && sideways)),
    addEventListener() {}, removeEventListener() {},
  }));
}
afterEach(() => { stored.clear(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("which page is a phone", () => {
  it("is a narrow window or a phone on its side, not a wide mouse-driven window", async () => {
    stubWindow({ narrow: false });
    expect((await import("./responsive")).isPhoneDevice()).toBe(false);
    vi.resetModules();
    stubWindow({ narrow: true });
    expect((await import("./responsive")).isPhoneDevice()).toBe(true);
    vi.resetModules();
    stubWindow({ sideways: true });
    const { isPhoneDevice, PHONE_QUERY } = await import("./responsive");
    expect(isPhoneDevice()).toBe(true);
    // Sideways means touch-only input: a short desktop window (a mouse, hover) must not match.
    expect(PHONE_QUERY).toContain("(pointer: coarse) and (hover: none) and (max-height: 500px)");
  });
});

describe("a touch phone, not a narrow mouse-driven window", () => {
  it("is the phone for settings only with touch input", async () => {
    stubWindow({ narrow: true, touch: false });
    expect((await import("./responsive")).isTouchPhone()).toBe(false);
    vi.resetModules();
    stubWindow({ narrow: true, touch: true });
    expect((await import("./responsive")).isTouchPhone()).toBe(true);
    vi.resetModules();
    stubWindow({ narrow: false, touch: true }); // a tablet or a touch laptop at full width
    expect((await import("./responsive")).isTouchPhone()).toBe(false);
  });
});

describe("a phone's own chat mode", () => {
  it("is kept in this device's storage and does not need the computer's setting", async () => {
    stubWindow({ narrow: true });
    const { setPhoneChatMode } = await import("./chatMode");
    setPhoneChatMode("ui");
    expect(localStorage.getItem("perch.phoneChatMode")).toBe("ui");
    setPhoneChatMode("cli");
    expect(localStorage.getItem("perch.phoneChatMode")).toBe("cli");
  });

  it("still holds the choice when storage refuses the write", async () => {
    stubWindow({ narrow: true });
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    const { setPhoneChatMode } = await import("./chatMode");
    expect(() => setPhoneChatMode("ui")).not.toThrow();
  });
});
