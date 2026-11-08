// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutNode, ModInfo } from "@perch/shared";

const state = vi.hoisted(() => ({ snapshot: { mods: [] as unknown[] } }));
vi.mock("../mods", async (original) => ({
  ...(await original<typeof import("../mods")>()),
  currentMods: () => state.snapshot,
  subscribeMods: () => () => {},
}));
vi.mock("../Sidebar", () => ({ Sidebar: () => <div>sidebar</div> }));
vi.mock("../StatusBar", () => ({ StatusBar: () => <div>status</div> }));
vi.mock("./SplitCanvas", () => ({ SplitCanvas: () => <div>canvas</div> }));
vi.mock("./TabBar", () => ({ TabBar: () => <div>tabs</div> }));
vi.mock("../views/PersistentTerminal", () => ({ PersistentTerminal: ({ sessionId }: { sessionId: string }) => <div>{`terminal ${sessionId}`}</div> }));
vi.mock("./WorkspaceTools", () => ({ WorkspaceTools: ({ tab }: { tab: string }) => <div>{`tools:${tab}`}</div> }));
vi.mock("./ModView", () => ({ ModView: ({ mod }: { mod: ModInfo }) => <div>{`mod view ${mod.id}`}</div> }));
import { activeLayout } from "../mods";
import { LayoutRoot } from "./LayoutRoot";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mod = (over: Partial<ModInfo> = {}): ModInfo => ({ id: "board", name: "Board", description: "", place: "dock", enabled: true, revision: "r1", error: null, ...over });
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); state.snapshot = { mods: [] }; });

describe("a layout on screen", () => {
  it("draws the tree with Perch's own panes and mods, sized as asked, skipping hidden nodes", async () => {
    state.snapshot = { mods: [mod(), mod({ id: "off", enabled: false })] };
    const tree: LayoutNode = { type: "row", gap: 4, children: [
      { type: "block", content: "sidebar", size: { px: 220 } },
      { type: "column", size: { weight: 3 }, children: [{ type: "block", content: "canvas" }, { type: "block", content: "mod:board", size: { px: 160 } }, { type: "block", content: "mod:off" }] },
      { type: "block", content: "git" },
      { type: "block", content: "files", hidden: true },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const text = host.textContent ?? "";
    for (const shown of ["sidebar", "canvas", "mod view board", "tools:gitReview", "mod:off is off or gone."]) expect(text).toContain(shown);
    expect(text).not.toContain("tools:files");
    const style = (id: string) => (host.querySelector(`[data-testid="layout-${id}"]`) as HTMLElement).style.flex;
    expect(style("sidebar")).toBe("0 0 220px");
    expect(style("canvas")).toBe("1 1 0%");
  });
});

describe("a layout's look", () => {
  it("puts the root's look on <html>, restyles a subtree from its node, and gives the root look back", async () => {
    const tree: LayoutNode = { type: "row", colors: { accent: "#ff8800" }, radius: 2, children: [
      { type: "block", content: "sidebar" },
      { type: "block", content: "canvas", theme: "nord", font: "Geist", border: 1 },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff8800");
    const node = (id: string) => host.querySelector(`[data-testid="layout-${id}"]`) as HTMLElement;
    expect(node("sidebar").style.getPropertyValue("--panel-bg")).toBe(""); // inherits the root's
    expect(node("canvas").style.getPropertyValue("--card-bg")).not.toBe("");
    expect(node("canvas").style.fontFamily).toBe("Geist");
    expect(node("canvas").style.getPropertyValue("--card-border")).toBe("1px");
    act(() => root.unmount());
    expect(document.documentElement.style.getPropertyValue("--accent")).not.toBe("#ff8800");
    root = createRoot(host);
  });
});

describe("backgrounds, floating blocks and terminal blocks", () => {
  it("paints a background, floats a block over the window and shows a session's terminal in a block", async () => {
    const tree: LayoutNode = { type: "row", background: "linear-gradient(#111, #222)", children: [
      { type: "block", content: "canvas", background: "#101010" },
      { type: "block", content: "terminal:abc-1", float: { x: 20, y: 30, width: 400, height: 300 } },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    expect((host.querySelector('[data-testid="layout-root"]') as HTMLElement).style.background).toContain("linear-gradient");
    const node = (id: string) => host.querySelector(`[data-testid="layout-${id}"]`) as HTMLElement;
    expect(node("canvas").style.background).toBe("rgb(16, 16, 16)");
    const floating = node("terminal:abc-1");
    expect(floating.textContent).toBe("terminal abc-1");
    expect([floating.style.position, floating.style.left, floating.style.top, floating.style.width, floating.style.height]).toEqual(["fixed", "20px", "30px", "400px", "300px"]);
  });
});

describe("which layout is drawn", () => {
  const block: LayoutNode = { type: "block", content: "canvas" };
  const base = { mods: [], folder: "", policy: { off: false }, safeMode: false };

  it("is the chosen one only when it parses, otherwise stock Perch", () => {
    expect(activeLayout(null)).toBeNull();
    expect(activeLayout({ ...base })).toBeNull();
    expect(activeLayout({ ...base, layout: "ide", layouts: [{ id: "ide", name: "IDE", root: block, error: null }] })?.id).toBe("ide");
    expect(activeLayout({ ...base, layout: "ide", layouts: [{ id: "ide", name: "IDE", root: null, error: "broken" }] })).toBeNull();
    expect(activeLayout({ ...base, layout: "gone", layouts: [] })).toBeNull();
  });
});
