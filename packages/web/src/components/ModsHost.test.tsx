// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const mods = vi.hoisted(() => ({ state: null as unknown, updateSettings: vi.fn() }));
vi.mock("../mods", () => ({
  currentMods: () => mods.state,
  subscribeMods: () => () => {},
  onModOpen: () => () => {},
  modFileUrl: (id: string) => `/mods/file?id=${id}`,
}));
vi.mock("../store", () => ({ usePerchStore: (select: (s: unknown) => unknown) => select({ updateSettings: mods.updateSettings }) }));
import { dockNewMods, ModsHost } from "./ModsHost";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (over: Partial<ModInfo> = {}): ModInfo => ({ id: "board", name: "Board", description: "", place: "dock", enabled: true, revision: "r1", error: null, ...over });

describe("docked mods", () => {
  it("docks an enabled docked mod once per version, and nothing off, headless or overlay", () => {
    const dock = { openModPanel: vi.fn() };
    const seen = dockNewMods([mod()], [], dock as never);
    expect(dock.openModPanel).toHaveBeenCalledWith("board", "Board");
    expect(dockNewMods([mod()], seen, dock as never)).toEqual(seen);
    expect(dock.openModPanel).toHaveBeenCalledTimes(1);
    dockNewMods([mod({ revision: "r2" })], seen, dock as never);
    expect(dock.openModPanel).toHaveBeenCalledTimes(2);
    dockNewMods([mod({ id: "off", enabled: false }), mod({ id: "bg", place: "none" }), mod({ id: "over", place: "overlay" })], [], dock as never);
    expect(dock.openModPanel).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a dock", () => {
    expect(dockNewMods([mod()], ["x"], null as never)).toEqual(["x"]);
  });
});

describe("the escape hatch", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); mods.updateSettings.mockClear(); });

  it("ctrl+alt+shift+Escape turns every mod off, and a plain Escape does not", async () => {
    await act(async () => root.render(<ModsHost />));
    const press = (init: KeyboardEventInit) => act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", init)); });
    await press({ key: "Escape" });
    expect(mods.updateSettings).not.toHaveBeenCalled();
    await press({ key: "Escape", ctrlKey: true, altKey: true, shiftKey: true });
    expect(mods.updateSettings).toHaveBeenCalledWith({ mods: { off: true } });
  });
});
