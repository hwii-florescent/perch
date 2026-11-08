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

describe("a layout's frame and terminal look", () => {
  it("sets shadow, terminal padding and opacity as variables, and min/max along the parent's direction", async () => {
    const tree: LayoutNode = { type: "row", terminalPadding: 10, terminalOpacity: 0.5, children: [
      { type: "block", content: "sidebar", size: { px: 200, min: 100, max: 300 }, shadow: "md" },
      { type: "column", children: [{ type: "block", content: "canvas", size: { min: 50, max: 400 } }] },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const html = document.documentElement.style;
    expect(html.getPropertyValue("--terminal-padding")).toBe("10px");
    expect(html.getPropertyValue("--terminal-opacity")).toBe("0.5");
    const node = (id: string) => host.querySelector(`[data-testid="layout-${id}"]`) as HTMLElement;
    expect(node("sidebar").style.getPropertyValue("--card-shadow")).toContain("rgb(0 0 0");
    expect([node("sidebar").style.minWidth, node("sidebar").style.maxWidth]).toEqual(["100px", "300px"]); // in a row: width
    expect([node("canvas").style.minHeight, node("canvas").style.maxHeight]).toEqual(["50px", "400px"]); // in a column: height
  });

  it("docks a float to an edge, makes a drawer of one that peeks, and frames panes", async () => {
    const tree: LayoutNode = { type: "row", paneRadius: 3, paneBorder: 1, paneFocus: "#ff8800", movable: false, children: [
      { type: "block", content: "sidebar", float: { x: 0, y: 0, width: 300, height: 200, edge: "left", align: "center", peek: 40 } },
      { type: "block", content: "files", float: { x: 0, y: 0, width: 200, height: 100, edge: "bottom", align: "end" } },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const node = (id: string) => host.querySelector(`[data-testid="layout-${id}"]`) as HTMLElement;
    expect(node("sidebar").className).toContain("layout-drawer");
    expect(node("sidebar").style.left).toBe("12px");
    expect(node("sidebar").style.top).toBe("calc(50% - 100px)");
    expect(node("sidebar").style.getPropertyValue("--float-hide")).toBe("-272px"); // 300 - 40 + 12
    expect(node("files").className).not.toContain("layout-drawer");
    expect([node("files").style.bottom, node("files").style.right]).toEqual(["12px", "12px"]);
    const html = document.documentElement.style;
    expect([html.getPropertyValue("--radius-pane"), html.getPropertyValue("--pane-border"), html.getPropertyValue("--pane-focus")]).toEqual(["3px", "1px", "#ff8800"]);
    expect(html.getPropertyValue("--pane-grip")).toBe("none"); // movable: false takes the pane grip away
    // paneGap and paneLone are not CSS: the canvas reads them from paneLook while the layout is shown.
    const { usePaneLook, STOCK_PANE_LOOK } = await import("../paneLook");
    expect(usePaneLook).toBeTypeOf("function");
    const seen = await import("../paneLook");
    await act(async () => root.render(<LayoutRoot root={{ type: "block", content: "canvas", paneGap: 14, paneLone: true }} />));
    let now = STOCK_PANE_LOOK;
    const Probe = () => { now = seen.usePaneLook(); return null; };
    const probe = document.createElement("div");
    const probeRoot = createRoot(probe);
    await act(async () => probeRoot.render(<Probe />));
    expect(now).toEqual({ gap: 14, lone: true });
    await act(async () => root.render(<div />)); // the layout goes: the stock canvas is back
    expect(now).toEqual(STOCK_PANE_LOOK);
    act(() => probeRoot.unmount());
  });

  it("drags a float by its grip, springs it to the nearest edge and third, keeps the spot, and a command puts it back", async () => {
    const { placeFloat, snapSpot } = await import("../layoutState");
    expect(snapSpot(10, 400, 1000, 800)).toEqual({ edge: "left", align: "center" });
    expect(snapSpot(900, 20, 1000, 800)).toEqual({ edge: "top", align: "end" });
    expect(snapSpot(500, 790, 1000, 800)).toEqual({ edge: "bottom", align: "center" });
    expect(snapSpot(990, 100, 1000, 800)).toEqual({ edge: "right", align: "start" });

    const tree: LayoutNode = { type: "row", children: [
      { type: "block", id: "board", content: "files", float: { x: 0, y: 0, width: 200, height: 100, edge: "left", align: "start", peek: 40 } },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const board = () => host.querySelector('[data-testid="layout-files"]') as HTMLElement;
    expect(board().className).toContain("layout-drawer");
    // Dropped near the bottom edge, in the middle: it docks there and, no longer on a side, stops being a drawer.
    board().getBoundingClientRect = () => ({ left: 400, top: 650, width: 200, height: 100, right: 600, bottom: 750, x: 400, y: 650, toJSON() {} });
    const grip = host.querySelector('[data-testid="float-grip"]')!;
    await act(async () => { grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 50, clientY: 50 })); });
    await act(async () => { window.dispatchEvent(new MouseEvent("pointermove", { clientX: 80, clientY: 90 })); });
    expect(board().style.translate).toBe("30px 40px");
    await act(async () => { window.dispatchEvent(new MouseEvent("pointerup", { clientX: 80, clientY: 90 })); });
    expect(board().style.translate).toBe("");
    expect(board().className).not.toContain("layout-drawer");
    expect([board().style.bottom, board().style.left]).toEqual(["12px", "calc(50% - 100px)"]);

    await act(async () => placeFloat({ id: "board", edge: "right", align: "end" }));
    expect([board().style.right, board().style.bottom]).toEqual(["12px", "12px"]);
    await act(async () => placeFloat({ id: "board" })); // no edge: back to the file's spot
    expect(board().style.left).toBe("12px");
    expect(board().className).toContain("layout-drawer");
    expect(() => placeFloat({ id: "nope", edge: "left" })).toThrow('No floating node "nope"');
  });

  it("shows one child of a stack under a tab strip, hides and shows nodes by command, and drags a boundary", async () => {
    const { toggleNode, showStackChild, sizeOverride } = await import("../layoutState");
    const tree: LayoutNode = { type: "row", divider: { width: 2, color: "#334455" }, children: [
      { type: "block", id: "side", content: "sidebar", windowDrag: true },
      { type: "stack", id: "work", header: "tabs", active: "b", children: [
        { type: "block", id: "a", title: "Files", content: "files" },
        { type: "block", id: "b", title: "Git", content: "git" },
      ] },
    ] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const text = () => host.textContent ?? "";
    expect(text()).toContain("tools:gitReview");
    expect(text()).not.toContain("tools:files");
    expect(host.querySelector('[data-testid="stack-tabs-work"]')?.textContent).toBe("FilesGit");
    expect((host.querySelector('[data-node-id="side"]') as HTMLElement).hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(host.querySelectorAll('[data-testid="layout-boundary"]')).toHaveLength(1);
    expect((host.querySelector('[data-testid="layout-boundary"]') as HTMLElement).style.background).toContain("rgb(51, 68, 85)");

    await act(async () => (host.querySelector('[role="tab"]') as HTMLElement).click()); // Files
    expect(text()).toContain("tools:files");
    await act(async () => showStackChild({ stack: "work", child: "b" }));
    expect(text()).toContain("tools:gitReview");
    expect(() => showStackChild({ stack: "work", child: "zz" })).toThrow(/layout.stack needs/);

    await act(async () => toggleNode({ id: "side" }));
    expect(text()).not.toContain("sidebar");
    await act(async () => toggleNode({ id: "side", hidden: false }));
    expect(text()).toContain("sidebar");
    expect(() => toggleNode({ id: "nope" })).toThrow(/No node/);

    // A drag on the boundary keeps the new sizes for this layout.
    const grip = host.querySelector('[data-testid="layout-boundary"] > div') as HTMLElement;
    const sizes = [{ left: 0, width: 100 }, { left: 102, width: 300 }];
    const children = [...(host.querySelector('[data-testid="layout-root"] > div') as HTMLElement).children].filter((el) => !el.matches('[data-testid="layout-boundary"]'));
    children.forEach((el, i) => { (el as HTMLElement).getBoundingClientRect = () => ({ width: sizes[i]!.width, height: 50, left: sizes[i]!.left, right: 0, top: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }); });
    await act(async () => { grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 101 })); });
    await act(async () => { window.dispatchEvent(new MouseEvent("pointermove", { clientX: 151 })); });
    await act(async () => { window.dispatchEvent(new MouseEvent("pointerup")); });
    const [first, second] = sizeOverride("r") ?? [];
    expect(first?.weight).toBeCloseTo(0.75, 1); // 150 of 400, times two
    expect(second?.weight).toBeCloseTo(1.25, 1);
  });

  it("picks the half of a light/dark theme pair that fits the system", async () => {
    const tree: LayoutNode = { type: "row", theme: { light: "catppuccin-latte", dark: "catppuccin" }, children: [{ type: "block", content: "sidebar" }] };
    await act(async () => root.render(<LayoutRoot root={tree} />));
    const panel = document.documentElement.style.getPropertyValue("--panel-bg");
    expect(panel).not.toBe("");
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    const { resolveTheme } = await import("../themes");
    expect(panel).toBe(resolveTheme(dark ? "catppuccin" : "catppuccin-latte").panelBg);
  });
});
