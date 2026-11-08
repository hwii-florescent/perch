// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const mods = vi.hoisted(() => ({ state: null as unknown, enableMod: vi.fn(async () => null), setLayout: vi.fn(async () => null), updateSettings: vi.fn(), off: false }));
vi.mock("../mods", () => ({ currentMods: () => mods.state, subscribeMods: () => () => {}, refreshMods: () => {}, enableMod: mods.enableMod, setLayout: mods.setLayout }));
vi.mock("../store", () => ({
  usePerchStore: (select: (s: unknown) => unknown) => select({ settings: { mods: { off: mods.off } }, updateSettings: mods.updateSettings }),
}));
import { ModsSection } from "./ModsSection";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (over: Partial<ModInfo> = {}): ModInfo => ({ id: "board", name: "Board", description: "A board", place: "dock", enabled: true, revision: "r1", error: null, ...over });
let host: HTMLDivElement, root: Root;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); mods.enableMod.mockClear(); mods.updateSettings.mockClear(); mods.state = null; });

describe("Settings > Mods", () => {
  it("lists each mod with where it stands, and turns one off or on", async () => {
    mods.state = { mods: [mod(), mod({ id: "old", name: "Old", enabled: false }), mod({ id: "bad", name: "Bad", error: "main.js is missing" })], folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(q("mod-board-status")?.textContent).toBe("On");
    expect(q("mod-old-status")?.textContent).toBe("Off");
    expect(q("mod-bad-status")?.textContent).toBe("Cannot load: main.js is missing");
    expect(q("mod-bad")?.querySelector("button")).toBeNull();
    await act(async () => q("mod-board")!.querySelector("button")!.click());
    expect(mods.enableMod).toHaveBeenCalledWith("board", false);
    await act(async () => q("mod-old")!.querySelector("button")!.click());
    expect(mods.enableMod).toHaveBeenCalledWith("old", true);
  });

  it("lists layouts, marks the one in use, and chooses one or goes back to stock", async () => {
    const block = { type: "block", content: "canvas" };
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: false, layout: "ide", layouts: [{ id: "ide", name: "IDE", root: block, error: null }, { id: "solo", name: "Solo", root: block, error: null }, { id: "bad", name: "bad", root: null, error: "unknown content" }] };
    await act(async () => root.render(<ModsSection />));
    expect(q("layout-ide")?.textContent).toContain("In use");
    expect(q("layout-ide")?.querySelector("button")).toBeNull();
    expect(q("layout-bad")?.textContent).toContain("Cannot load: unknown content");
    expect(q("layout-bad")?.querySelector("button")).toBeNull();
    await act(async () => q("layout-solo")!.querySelector("button")!.click());
    expect(mods.setLayout).toHaveBeenCalledWith("solo");
    await act(async () => q("layout-stock")!.querySelector("button")!.click());
    expect(mods.setLayout).toHaveBeenCalledWith(null);
  });

  it("says how to make a mod when there are none, and the off switch sets the one setting", async () => {
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(host.textContent).toContain("No mods yet");
    await act(async () => (q("settings-mods-off") as HTMLButtonElement).click());
    expect(mods.updateSettings).toHaveBeenCalledWith({ mods: { off: true } });
  });
});
