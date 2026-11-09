// @vitest-environment jsdom
// Which of the person's code may run on a phone: never the desktop's, and the phone's own screens only once the person
// turned that on for this phone; off is immediate.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPhoneScreen, personCodeAllowed, phoneModsOn, setPhoneMods } from "./phoneMods";

// This Node's jsdom has no `localStorage`: a plain one, as a browser's.
const stored = new Map<string, string>();
const storage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, String(v)), removeItem: (k: string) => void stored.delete(k) };
beforeEach(() => vi.stubGlobal("localStorage", storage));
afterEach(() => { stored.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("a phone's packages", () => {
  it("never runs the desktop's code on a phone, and a phone screen's copy only after the person turned it on there", () => {
    // Desktop: everything but the phone's own screens.
    expect(personCodeAllowed(false, false, null)).toBe(true);
    expect(personCodeAllowed(false, true, "status")).toBe(true);
    expect(personCodeAllowed(false, true, "mobile-header")).toBe(false);
    // Phone: no layout, docked, hidden or overlaid package, no copy of a desktop screen, opted in or not.
    for (const optedIn of [false, true]) {
      expect(personCodeAllowed(true, optedIn, null)).toBe(false);
      expect(personCodeAllowed(true, optedIn, "select")).toBe(false);
      expect(personCodeAllowed(true, optedIn, "phone-size")).toBe(false); // a desktop notice, despite its name
    }
    expect(personCodeAllowed(true, false, "mobile-header")).toBe(false);
    expect(personCodeAllowed(true, true, "mobile-header")).toBe(true);
    expect(["mobile-header", "mobile-switcher", "mobile-panes", "mobile-files", "mobile-keys"].every(isPhoneScreen)).toBe(true);
  });

  it("keeps the choice in this device's storage, off by default, and says so when storage refuses it", () => {
    expect(phoneModsOn()).toBe(false);
    setPhoneMods(true);
    expect(phoneModsOn()).toBe(true);
    expect(localStorage.getItem("perch.phoneMods")).toBe("on");
    setPhoneMods(false);
    expect(phoneModsOn()).toBe(false);
    expect(localStorage.getItem("perch.phoneMods")).toBeNull();
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(() => setPhoneMods(true)).toThrow();
    expect(phoneModsOn()).toBe(false);
  });
});
