// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const mods = vi.hoisted(() => ({
  state: null as unknown,
  watchers: new Set<() => void>(),
  approveMod: vi.fn(async () => null),
  opens: new Set<(modId: string, panelId: string) => void>(),
}));
vi.mock("../mods", () => ({
  currentMods: () => mods.state,
  subscribeMods: (watch: () => void) => (mods.watchers.add(watch), () => mods.watchers.delete(watch)),
  approveMod: mods.approveMod,
  modPanelUrl: (id: string, panel: string) => `/mods/panel?id=${id}&panel=${panel}`,
  onModOpen: (handler: (modId: string, panelId: string) => void) => (mods.opens.add(handler), () => mods.opens.delete(handler)),
}));
vi.mock("../store", () => ({ usePerchStore: (select: (s: unknown) => unknown) => select({ activeWorkspaceId: null, workspaces: [], sessions: [] }) }));
import { dockNewPanels, ModsHost } from "./ModsHost";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (over: Partial<ModInfo> = {}): ModInfo => ({
  id: "board", name: "Board", version: "1", description: "", actions: [],
  panels: [{ id: "main", title: "Board", placement: "dock" }], preview: ["docked panel main: board.html"],
  hash: "h1", required: ["panel"], status: { state: "active" }, approvedBy: "person", ...over,
});

describe("docked mod panels", () => {
  it("opens an active mod's docked panel once per version, and nothing that is not active or not docked", () => {
    const dock = { openModPanel: vi.fn() };
    const seen = dockNewPanels([mod()], [], dock as never);
    expect(dock.openModPanel).toHaveBeenCalledWith("board", "main", "Board: Board");
    expect(dockNewPanels([mod()], seen, dock as never)).toEqual(seen);
    expect(dock.openModPanel).toHaveBeenCalledTimes(1);
    dockNewPanels([mod({ hash: "h2" })], seen, dock as never);
    expect(dock.openModPanel).toHaveBeenCalledTimes(2);
    dockNewPanels([mod({ id: "off", status: { state: "disabled" } }), mod({ id: "wait", status: { state: "pending", reason: "new" } }), mod({ id: "over", panels: [{ id: "p", title: "P", placement: "overlay" }] })], [], dock as never);
    expect(dock.openModPanel).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a dock", () => {
    expect(dockNewPanels([mod()], ["x"], null as never)).toEqual(["x"]);
  });
});

describe("the approval card", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); mods.state = null; mods.approveMod.mockClear(); });
  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it("shows a waiting mod outside Settings, approves the hash it showed, and can be put off", async () => {
    mods.state = { mods: [mod({ status: { state: "pending", reason: "new" } })] };
    await act(async () => root.render(<ModsHost />));
    expect(q("mods-waiting-toggle")?.textContent).toBe("1 mod waiting for approval");
    await act(async () => q("mods-waiting-toggle")!.click());
    expect(q("mods-waiting-board")?.textContent).toContain("docked panel main: board.html");
    await act(async () => (q("mods-waiting-board")!.querySelector("button") as HTMLButtonElement).click());
    expect(mods.approveMod).toHaveBeenCalledWith("board", "h1");
    await act(async () => ([...q("mods-waiting-board")!.querySelectorAll("button")].at(-1) as HTMLButtonElement).click());
    expect(q("mods-waiting")).toBeNull();
  });

  it("shows nothing when no mod waits", async () => {
    mods.state = { mods: [mod()] };
    await act(async () => root.render(<ModsHost />));
    expect(q("mods-waiting")).toBeNull();
  });
});
