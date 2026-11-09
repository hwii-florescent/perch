// @vitest-environment jsdom
// The stock window and the stock layout are the same parts: the shipped `stock:main` file names exactly the parts
// the recovery shell draws, in its order; a copy of it drawn as a layout gives the same window; an edit to the copy
// rearranges the parts, and the drawer and widths stay the window's own wherever the parts are.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LayoutNode } from "@perch/shared";

const snapshot = vi.hoisted(() => ({ mods: [] }));
vi.mock("../mods", async (original) => ({ ...(await original<typeof import("../mods")>()), currentMods: () => snapshot, subscribeMods: () => () => {} }));
vi.mock("./mod-root", () => ({ StockView: ({ name }: { name: string }) => <div data-testid={`stock-${name}`}>{name}</div> }));
vi.mock("./SplitCanvas", () => ({ SplitCanvas: () => <div data-testid="split-canvas" /> }));
vi.mock("./WorkspaceTools", () => ({ WorkspaceTools: ({ tab }: { tab: string }) => <div>{`tools:${tab}`}</div>, WorkspaceToolsTabs: () => <div data-testid="workspace-tools-tabs" /> }));
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
import shipped from "../stock-ui/layouts/main.json";
import { LayoutRoot } from "./LayoutRoot";
import { STOCK_WINDOW_PARTS, StockWindow, useWindowChrome } from "./StockWindow";
import { usePerchStore } from "../store";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  usePerchStore.setState({ sidebarCollapsed: false });
  useWindowChrome.getState().setTools("files");
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const stockTree = shipped as unknown as LayoutNode;
/** A row or column, as these tests read and edit one. */
type Group = { type: string; children: LayoutNode[] };
/** The window's cards and handles, left to right. */
const order = () => [...host.querySelectorAll('[data-testid="sidebar-card"], [data-testid="resize-sidebar"], [data-testid="main-card"], [data-testid="resize-tools"], [data-testid="tools-card"]')].map((el) => el.getAttribute("data-testid"));

it("ships a stock layout whose window row is the recovery shell's parts in its order, with the status bar below", () => {
  expect(stockTree.type).toBe("column");
  const [window, status] = (stockTree as unknown as Group).children;
  expect(window!.type).toBe("row");
  expect((window as unknown as Group).children.map((child) => (child as { content?: string }).content)).toEqual([...STOCK_WINDOW_PARTS]);
  expect(status).toMatchObject({ type: "block", content: "status" });
});

it("a copy of the stock layout draws the same window as Perch as shipped, and an edit to the copy rearranges it", async () => {
  act(() => root.render(<StockWindow />));
  const shell = order();
  expect(shell).toEqual(["sidebar-card", "resize-sidebar", "main-card", "resize-tools", "tools-card"]);
  act(() => root.unmount());
  root = createRoot(host);

  await act(async () => root.render(<LayoutRoot root={stockTree} />));
  expect(order()).toEqual(shell);
  // The parts keep their own heads: the tabs and toggles live in the main card, the drawer's tabs in its card.
  const main = host.querySelector('[data-testid="main-card"]')!;
  expect(main.querySelector('[data-testid="stock-tabs"]')).not.toBeNull();
  expect(main.querySelector('[data-testid="split-canvas"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="tools-card"] [data-testid="workspace-tools-toggle"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="layout-status"] [data-testid="stock-status"]')).not.toBeNull();

  // The person's edit: the drawer on the left of the main card. The drawer's tab is still the window's.
  const edited = JSON.parse(JSON.stringify(stockTree)) as Group;
  const row = edited.children[0] as unknown as Group;
  row.children = [row.children[0]!, row.children[2]!, row.children[1]!];
  await act(async () => root.render(<LayoutRoot root={edited as unknown as LayoutNode} />));
  expect(order()).toEqual(["sidebar-card", "resize-sidebar", "resize-tools", "tools-card", "main-card"]);
  expect(host.textContent).toContain("tools:files");
  act(() => useWindowChrome.getState().toggleDrawer());
  expect(host.querySelector('[data-testid="tools-card"]')).toBeNull();
  expect(host.querySelector('[data-testid="main-card"] [data-testid="workspace-tools-toggle"]')).not.toBeNull();
});
