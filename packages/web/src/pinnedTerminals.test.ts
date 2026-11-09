// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { isPinned, setPinned } from "./pinnedTerminals";

it("remembers pins, unpins, and survives a damaged value", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  setPinned("a", true);
  setPinned("a", true);
  setPinned("b", true);
  expect([isPinned("a"), isPinned("b"), isPinned("c")]).toEqual([true, true, false]);
  setPinned("a", false);
  expect(isPinned("a")).toBe(false);
  localStorage.setItem("perch.pinnedTerminals", "{oops");
  expect(isPinned("b")).toBe(false);
});
