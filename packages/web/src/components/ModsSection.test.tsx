// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const mods = vi.hoisted(() => ({ state: null as unknown, enableMod: vi.fn(async () => null), setLayout: vi.fn(async () => null), removeMod: vi.fn(async () => null), updateSettings: vi.fn(), off: false, capabilities: ["mods.v1"] as string[] | null,
  useForStock: vi.fn(async () => null), cloneMod: vi.fn(async (_id: string, as: string) => as) }));
vi.mock("../mods", () => ({ currentMods: () => mods.state, subscribeMods: () => () => {}, refreshMods: () => {}, enableMod: mods.enableMod, setLayout: mods.setLayout, removeMod: mods.removeMod,
  useForStock: mods.useForStock, cloneMod: mods.cloneMod }));
vi.mock("../store", () => ({
  usePerchStore: Object.assign((select: (s: unknown) => unknown) => select({ settings: { mods: { off: mods.off } }, updateSettings: mods.updateSettings, serverInfo: mods.capabilities && { capabilities: mods.capabilities } }), { subscribe: () => () => {}, getState: () => ({}), setState: () => {} }),
}));
// Settings > Mods uses the stock Select source; it gets the SDK's own leaf primitives, not the whole app graph.
vi.mock("@perch/sdk", async () => ({
  Chevron: (await import("./ui/chevron")).Chevron, cn: (await import("../lib/cn")).cn, menuPanel: (await import("./ui/menu")).menuPanel,
  useDismissOnOutsideClick: (await import("./popoverPosition")).useDismissOnOutsideClick,
}));
import { ModsSection } from "./ModsSection";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (over: Partial<ModInfo> = {}): ModInfo => ({ id: "board", name: "Board", description: "A board", place: "dock", enabled: true, revision: "r1", error: null, ...over });
let host: HTMLDivElement, root: Root;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); mods.enableMod.mockClear(); mods.updateSettings.mockClear(); mods.state = null; mods.capabilities = ["mods.v1"]; });

describe("Settings > Mods", () => {
  it("says so when the computer's Perch is too old to list mods, and when it was started in safe mode", async () => {
    mods.capabilities = ["terminal.sharedInput"];
    await act(async () => root.render(<ModsSection />));
    expect(q("mods-older-core")?.textContent).toContain("older Perch");
    // Not yet answered (no server info): still loading, no claim about the core.
    mods.capabilities = null;
    await act(async () => root.render(<ModsSection key="2" />));
    expect(q("mods-older-core")).toBeNull();
    expect(host.textContent).toContain("Loading…");
    mods.capabilities = ["mods.v1"];
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: true };
    await act(async () => root.render(<ModsSection key="3" />));
    expect(q("mods-safe-mode")?.textContent).toContain("PERCH_MODS=off");
    expect(q("mods-older-core")).toBeNull();
  });

  it("lists each mod with where it stands, and turns one off or on", async () => {
    mods.state = { mods: [mod(), mod({ id: "old", name: "Old", enabled: false }), mod({ id: "bad", name: "Bad", error: "main.js is missing" })], folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(q("mod-board-status")?.textContent).toBe("On");
    expect(q("mod-old-status")?.textContent).toBe("Off");
    expect(q("mod-bad-status")?.textContent).toBe("Cannot load: main.js is missing");
    expect(q("mod-bad")?.querySelectorAll("button")).toHaveLength(1); // only Remove, nothing to turn on
    await act(async () => q("mod-board")!.querySelector("button")!.click());
    expect(mods.enableMod).toHaveBeenCalledWith("board", false);
    await act(async () => q("mod-old")!.querySelector("button")!.click());
    expect(mods.enableMod).toHaveBeenCalledWith("old", true);
    await act(async () => q("mod-bad-remove")!.click());
    expect(mods.removeMod).toHaveBeenCalledWith("bad", "mod");
  });

  it("lists layouts, marks the one in use, and chooses one or goes back to stock", async () => {
    const block = { type: "block", content: "canvas" };
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: false, layout: "ide", layouts: [{ id: "ide", name: "IDE", root: block, error: null }, { id: "solo", name: "Solo", root: block, error: null, preview: "data:image/svg+xml;base64,PHN2Zy8+" }, { id: "bad", name: "bad", root: null, error: "unknown content" }] };
    await act(async () => root.render(<ModsSection />));
    expect(q("layout-ide")?.textContent).toContain("In use");
    expect(q("layout-ide")?.querySelectorAll("button")).toHaveLength(1); // in use: only Remove
    expect(q("layout-bad")?.textContent).toContain("Cannot load: unknown content");
    expect(q("layout-bad")?.querySelectorAll("button")).toHaveLength(1);
    await act(async () => q("layout-solo")!.querySelector("button")!.click());
    expect(q("layout-solo-preview")?.getAttribute("src")).toContain("data:image/svg+xml");
    expect(q("layout-ide-preview")).toBeNull();
    expect(mods.setLayout).toHaveBeenCalledWith("solo");
    await act(async () => q("layout-stock")!.querySelector("button")!.click());
    expect(mods.setLayout).toHaveBeenCalledWith(null);
    expect(q("layout-stock-remove")).toBeNull();
    await act(async () => q("layout-solo-remove")!.click());
    expect(mods.removeMod).toHaveBeenCalledWith("solo", "layout");
  });

  it("copies Perch's own window as a layout file to edit and uses the copy, and shows what a layout was copied from", async () => {
    const block = { type: "block", content: "canvas" };
    mods.setLayout.mockClear();
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: false, layout: "my-window", layouts: [
      { id: "my-window", name: "Perch", root: null, error: "block content \"window:nope\" is unknown", clonedFrom: { id: "stock:main", version: "1.0.0" } },
      { id: "solo", name: "Solo", root: block, error: null },
    ] };
    await act(async () => root.render(<ModsSection />));
    expect(q("layout-my-window-from")?.textContent).toBe("copy of stock:main 1.0.0");
    expect(q("layout-solo-from")).toBeNull();
    // A chosen copy that stops loading says so, and that Perch as shipped is what shows.
    expect(q("layout-my-window")?.textContent).toContain("Perch as shipped is shown");
    // A second copy takes the next free id, and is used once made.
    await act(async () => q("layout-stock-copy")!.click());
    expect(mods.cloneMod).toHaveBeenCalledWith("stock:main", "my-window-2");
    expect(mods.setLayout).toHaveBeenCalledWith("my-window-2");
  });

  it("says how to make a mod when there are none, and the off switch sets the one setting", async () => {
    mods.state = { mods: [], folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(host.textContent).toContain("No mods yet");
    await act(async () => (q("settings-mods-off") as HTMLButtonElement).click());
    expect(mods.updateSettings).toHaveBeenCalledWith({ mods: { off: true } });
  });

  it("lists Perch's screens with what is shown for each, chooses a copy or Perch's own, and makes a copy to edit", async () => {
    const stock = mod({ id: "stock:sidebar", name: "Sidebar", origin: "stock", format: "esm", version: "1.3.0" });
    const mine = mod({ id: "my-sidebar", name: "My sidebar", format: "esm", clonedFrom: { id: "stock:sidebar", revision: "r", version: "1.3.0" } });
    const broken = mod({ id: "my-status", name: "My status", format: "esm", error: "main.js is missing" });
    mods.state = { mods: [stock, mod({ id: "stock:status", name: "Status", origin: "stock", format: "esm" }), mine, broken, mod({ id: "single" })],
      uses: { "stock:status": "my-status" }, folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(q("screen-stock:sidebar-status")?.textContent).toBe("Perch's own 1.3.0");
    expect(q("screen-stock:status-status")?.textContent).toContain("which cannot load (main.js is missing); Perch's own is shown");
    expect(q("mod-my-sidebar-from")?.textContent).toBe("copy of stock:sidebar 1.3.0");
    // Only packages can stand in for a screen; a copy of this screen is listed first.
    await act(async () => q("screen-stock:sidebar-use")!.click());
    const options = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.replace("✓", ""));
    expect(options).toEqual(["Perch's own", "My sidebar (copy of stock:sidebar 1.3.0)", "My status"]);
    await act(async () => (document.querySelectorAll('[role="option"]')[1] as HTMLElement).click());
    expect(mods.useForStock).toHaveBeenCalledWith("stock:sidebar", "my-sidebar");
    await act(async () => q("screen-stock:status-use")!.click());
    await act(async () => (document.querySelectorAll('[role="option"]')[0] as HTMLElement).click());
    expect(mods.useForStock).toHaveBeenLastCalledWith("stock:status", null);
    // A new copy takes a free id and is chosen at once.
    await act(async () => q("screen-stock:sidebar-copy")!.click());
    expect(mods.cloneMod).toHaveBeenCalledWith("stock:sidebar", "my-sidebar-2");
    expect(mods.useForStock).toHaveBeenLastCalledWith("stock:sidebar", "my-sidebar-2");
  });

  it("after an upgrade, keeps a copy as it was, says what Perch ships now, and says when the copy's api range no longer fits", async () => {
    const shipped = mod({ id: "stock:status", name: "Status", origin: "stock", format: "esm", version: "1.1.0" });
    const old = mod({ id: "my-status", name: "My status", format: "esm", api: "^1.2", clonedFrom: { id: "stock:status", revision: "r0", version: "1.0.0" } });
    const future = mod({ id: "my-tabs", name: "My tabs", format: "esm", api: "^2", clonedFrom: { id: "stock:tabs", revision: "r0", version: "1.0.0" } });
    mods.state = { mods: [shipped, old, future], uses: { "stock:status": "my-tabs" }, folder: "/x/mods", policy: { off: false }, safeMode: false };
    await act(async () => root.render(<ModsSection />));
    expect(q("mod-my-status-from")?.textContent).toBe("copy of stock:status 1.0.0");
    expect(q("mod-my-status-upgrade")?.textContent).toBe("Perch now ships stock:status 1.1.0; your copy is unchanged");
    expect(q("mod-my-tabs-upgrade")?.textContent).toMatch(/^needs @perch\/sdk \^2, but this Perch has 1\.\d+\.\d+, so it does not run and Perch's own stock:tabs is shown/);
    expect(q("screen-stock:status-status")?.textContent).toMatch(/^Your My tabs needs @perch\/sdk \^2 \(this Perch has 1\.\d+\.\d+\); Perch's own is shown$/);
  });

  it("on a phone, runs copies of the phone's screens only once turned on here, says why the computer's choices do not show, and turns it off at once", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v), removeItem: (k: string) => void stored.delete(k) });
    window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    try {
      mods.state = { mods: [mod({ id: "stock:select", name: "Dropdown", origin: "stock", format: "esm" }), mod({ id: "stock:mobile-header", name: "Phone header", origin: "stock", format: "esm" }),
        mod({ id: "my-select", name: "My select", format: "esm" }), mod({ id: "my-header", name: "My header", format: "esm" })],
        uses: { "stock:select": "my-select", "stock:mobile-header": "my-header" }, folder: "/x/mods", policy: { off: false }, safeMode: false };
      await act(async () => root.render(<ModsSection />));
      expect(q("screen-stock:select-status")?.textContent).toBe("Your My select is chosen for the computer; this phone shows Perch's own");
      expect(q("screen-stock:mobile-header-status")?.textContent).toContain("this phone shows Perch's own until phone screens from your packages are on");
      const toggle = q("settings-phone-mods") as HTMLInputElement;
      expect(toggle.checked).toBe(false);
      await act(async () => toggle.click());
      expect(stored.get("perch.phoneMods")).toBe("on");
      expect(q("screen-stock:mobile-header-status")?.textContent).toBe("Showing your My header");
      await act(async () => (q("settings-phone-mods") as HTMLInputElement).click());
      expect(stored.has("perch.phoneMods")).toBe(false);
      expect(q("screen-stock:mobile-header-status")?.textContent).toContain("until phone screens from your packages are on");
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
      vi.unstubAllGlobals();
    }
  });
});
