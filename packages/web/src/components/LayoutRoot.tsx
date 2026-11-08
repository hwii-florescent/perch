import { Fragment, useEffect, useRef, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { tauriInvoke } from "../links";
import { setPaneLook } from "../paneLook";
import { lookVars, prefersDark, setRootLook } from "../themes";
import { activeOverride, floatOverride, hiddenOverride, layoutStateVersion, pointAtLayout, publishFloat, publishStack, setActive, setFloat, setShownLayout, setSizes, sizeOverride, snapSpot, subscribeLayoutState } from "../layoutState";
import type { LayoutNode, ModInfo } from "@perch/shared";
import { currentMods, subscribeMods } from "../mods";
import { cn } from "../lib/cn";
import { StatusBar } from "../StatusBar";
import { Sidebar } from "../Sidebar";
import { ModView } from "./ModView";
import { SplitCanvas } from "./SplitCanvas";
import { TabBar } from "./TabBar";
import { PersistentTerminal } from "../views/PersistentTerminal";
import { WorkspaceTools } from "./WorkspaceTools";

// The same card the stock window draws its three panes on.
const CARD = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--card-radius,12px)] bg-[var(--card-bg)]";
const OUTLINE: CSSProperties = { borderStyle: "solid", borderWidth: "var(--card-border, 0px)", borderColor: "var(--overlay-0)", boxShadow: "var(--card-shadow, none)" };

/** One of Perch's own panes, or a mod's view, by the name a layout gives it. */
function Block({ content, mods }: { content: string; mods: ModInfo[] }) {
  switch (content) {
    case "sidebar": return <Sidebar />;
    case "tabs": return <div className="flex h-11 shrink-0 items-center"><TabBar /></div>;
    case "canvas": return <main className="dock-area relative flex min-h-0 min-w-0 flex-1"><SplitCanvas /></main>;
    case "files": return <WorkspaceTools tab="files" />;
    case "git": return <WorkspaceTools tab="gitReview" />;
    case "status": return <StatusBar />;
  }
  // A live terminal of a session. A terminal shows in one place at a time: if the session is also in
  // the canvas, put it in this block or the canvas, not both.
  if (content.startsWith("terminal:")) return <PersistentTerminal active sessionId={content.slice("terminal:".length)} />;
  const mod = mods.find((candidate) => `mod:${candidate.id}` === content);
  if (!mod?.enabled || mod.error) return <div className="inactive-session-pane">{`${content} is off or gone.`}</div>;
  return <ModView mod={mod} />;
}

const EDGE_GAP = 12;
/** Where a floating node sits: at x, y, or docked to a window edge (a drawer when it peeks). */
function floatStyle(float: NonNullable<LayoutNode["float"]>): CSSProperties {
  const { x, y, width, height, edge, align = "center", peek } = float;
  const base: CSSProperties = { position: "fixed", width, height, zIndex: 1500, flex: "none" };
  if (!edge) return { ...base, left: x, top: y };
  const vertical = edge === "left" || edge === "right";
  const along = (start: "top" | "left", end: "bottom" | "right", size: number) =>
    align === "start" ? { [start]: EDGE_GAP } : align === "end" ? { [end]: EDGE_GAP } : { [start]: `calc(50% - ${size / 2}px)` };
  const hide = peek != null ? { "--float-hide": `${edge === "left" ? "-" : ""}${width - peek + EDGE_GAP}px` } : {};
  return { ...base, ...(vertical ? along("top", "bottom", height) : along("left", "right", width)), [edge]: EDGE_GAP, ...hide } as CSSProperties;
}

/** Where a floating node is now: where the person dropped it, else what the file says. A drawer (peek)
 * only makes sense on a side, so it is a plain float once dropped on the top or bottom. */
function floatNow(node: LayoutNode, path: string): NonNullable<LayoutNode["float"]> | undefined {
  const spot = node.float && floatOverride(node.id ?? path);
  if (!node.float || !spot) return node.float;
  return { ...node.float, ...spot, peek: spot.edge === "left" || spot.edge === "right" ? node.float.peek : undefined };
}

/** The strip along a floating node's top edge that moves it. On release the node springs to the nearest
 * edge and third of the window and that spot is kept (herdr's floating spots). While moving it only
 * shifts with `translate`, which nothing else here touches. */
function FloatGrip({ id, spot }: { id: string; spot: { edge: string; align: string } }) {
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const frame = event.currentTarget.parentElement;
    if (!frame || event.button !== 0) return;
    event.preventDefault();
    const [x, y] = [event.clientX, event.clientY];
    const move = (e: globalThis.PointerEvent) => {
      frame.style.translate = `${e.clientX - x}px ${e.clientY - y}px`;
      frame.style.outline = "2px solid var(--accent)";
    };
    const up = (e: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const box = frame.getBoundingClientRect(); // still shifted: this is where it was dropped
      frame.style.translate = "";
      frame.style.outline = "";
      publishFloat(id, spot, false);
      if (Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 3) {
        setFloat(id, snapSpot(box.left + box.width / 2, box.top + box.height / 2, window.innerWidth, window.innerHeight));
      }
    };
    publishFloat(id, spot, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <div className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-grab bg-[var(--accent)] opacity-0 transition-opacity hover:opacity-60" onPointerDown={drag} data-testid="float-grip" />;
}

/** The node's size, as the person last dragged it or else as the file says. */
const sizeOf = (node: LayoutNode, parentPath: string, index: number) => ({ ...node.size, ...sizeOverride(parentPath)?.[index] }) as NonNullable<LayoutNode["size"]>;

const shownNode = (node: LayoutNode) => !(hiddenOverride(node.id) ?? node.hidden);

/** The boundary between two children of a row or column: a line when the layout draws a divider, and
 * always a wider invisible grip over it. Dragging moves the boundary; the sizes are kept per layout. */
function Boundary({ row, divider, path, prev, next, siblings }: { row: boolean; divider?: { width: number; color?: string }; path: string; prev: number; next: number; siblings: LayoutNode[] }) {
  const grip = useRef<HTMLDivElement>(null);
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const before = grip.current?.parentElement?.previousElementSibling as HTMLElement | null;
    const after = grip.current?.parentElement?.nextElementSibling as HTMLElement | null;
    if (!before || !after) return;
    event.preventDefault();
    const measure = (el: HTMLElement) => (row ? el.getBoundingClientRect().width : el.getBoundingClientRect().height);
    const start = { at: row ? event.clientX : event.clientY, a: measure(before), b: measure(after) };
    const sizes = [...(sizeOverride(path) ?? [])];
    const clamp = (value: number, node: LayoutNode) => Math.max(node.size?.min ?? 24, Math.min(node.size?.max ?? 10_000, value));
    const fixed = (index: number) => sizeOf(siblings[index]!, path, index).px != null;
    const move = (ev: globalThis.PointerEvent) => {
      const delta = (row ? ev.clientX : ev.clientY) - start.at;
      const a = clamp(start.a + delta, siblings[prev]!);
      const b = clamp(start.b - (a - start.a), siblings[next]!);
      const total = start.a + start.b;
      // A fixed-size child keeps a fixed size; two flexible ones share the same total by weight.
      sizes[prev] = fixed(prev) ? { px: a } : { weight: (a / total) * 2 };
      sizes[next] = fixed(next) ? { px: b } : { weight: (b / total) * 2 };
      setSizes(path, [...sizes]);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const width = divider?.width ?? 0;
  return (
    <div className="relative shrink-0" style={{ [row ? "width" : "height"]: width, background: width ? divider?.color ?? "var(--overlay-0)" : undefined }} data-testid="layout-boundary">
      <div ref={grip} onPointerDown={drag} className="absolute z-10" style={row ? { top: 0, bottom: 0, left: -4, width: 8, cursor: "col-resize" } : { left: 0, right: 0, top: -4, height: 8, cursor: "row-resize" }} />
    </div>
  );
}

function StackHeader({ node, active, mods }: { node: Extract<LayoutNode, { type: "stack" }>; active: string; mods: ModInfo[] }) {
  if (node.header?.startsWith("mod:")) return <div className="flex h-9 shrink-0 items-stretch"><Block content={node.header} mods={mods} /></div>;
  if (node.header !== "tabs") return null;
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-1" role="tablist" data-testid={`stack-tabs-${node.id ?? "stack"}`}>
      {node.children.map((child, index) => {
        const id = child.id ?? String(index);
        return (
          <button key={id} type="button" role="tab" aria-selected={id === active}
            className={cn("h-7 rounded-[var(--card-radius,8px)] px-3 text-[0.8rem]", id === active ? "bg-[var(--surface-1)] text-[var(--text)]" : "text-[var(--subtext-0)] hover:bg-[var(--surface-0)]")}
            onClick={() => node.id && setActive(node.id, id)}>{child.title ?? child.id ?? `Tab ${index + 1}`}</button>
        );
      })}
    </div>
  );
}

function Node({ node, mods, root, inRow, path, parentPath, index }: { node: LayoutNode; mods: ModInfo[]; root?: boolean; inRow?: boolean; path: string; parentPath: string; index: number }) {
  if (!shownNode(node)) return null;
  const float = root ? undefined : floatNow(node, path);
  const grip = float && <FloatGrip id={node.id ?? path} spot={{ edge: float.edge ?? "", align: float.align ?? "" }} />;
  const { px, weight, min, max } = root ? ({} as NonNullable<LayoutNode["size"]>) : sizeOf(node, parentPath, index);
  // The root's look is on <html> (menus and dialogs outside this tree follow it); below it, the
  // custom properties cascade to the children from here.
  const style: CSSProperties = {
    ...(root ? {} : lookVars(node, true)),
    fontFamily: root ? undefined : node.font,
    flex: root ? "1 1 0%" : px != null ? `0 0 ${px}px` : `${weight ?? 1} 1 0%`,
    padding: node.padding || undefined,
    background: node.background,
    // Along the parent's direction; a root has none.
    ...(root ? {} : inRow ? { minWidth: min, maxWidth: max } : { minHeight: min, maxHeight: max }),
    // Out of the flow, over the window and under dialogs.
    ...(float ? floatStyle(float) : {}),
  };
  const common = { "data-node-id": node.id, "data-tauri-drag-region": node.windowDrag ? true : undefined };
  if (node.type === "block") return <div className={cn(CARD, "relative", float?.peek != null && "layout-drawer")} style={{ ...style, ...OUTLINE }} data-testid={`layout-${node.content}`} {...common}>{grip}<Block content={node.content} mods={mods} /></div>;
  if (node.type === "stack") {
    const ids = node.children.map((child, i) => child.id ?? String(i));
    const current = Math.max(0, ids.indexOf(activeOverride(node.id) ?? node.active ?? ids[0]!));
    return (
      <div className="flex min-h-0 min-w-0 flex-col" style={style} data-testid={`layout-stack-${node.id ?? path}`} {...common}>
        {grip}
        <StackHeader node={node} active={ids[current]!} mods={mods} />
        <Node node={node.children[current]!} mods={mods} path={`${path}/${current}`} parentPath={path} index={current} inRow={false} />
      </div>
    );
  }
  const row = node.type === "row";
  const visible = node.children.map((child, i) => (shownNode(child) && !child.float ? i : -1)).filter((i) => i >= 0);
  return (
    <div className={cn("flex min-h-0 min-w-0", row ? "flex-row" : "flex-col")} style={{ ...style, gap: node.gap || undefined }} {...common}>
      {grip}
      {node.children.map((child, i) => {
        const before = visible[visible.indexOf(i) - 1];
        const line = before !== undefined && (node.resizable !== false || node.divider);
        return (
          <Fragment key={i}>
            {line && (node.resizable !== false
              ? <Boundary row={row} divider={node.divider} path={path} prev={before} next={i} siblings={node.children} />
              : <div className="shrink-0" style={{ [row ? "width" : "height"]: node.divider?.width, background: node.divider?.color ?? "var(--overlay-0)" }} />)}
            <Node node={child} mods={mods} path={`${path}/${i}`} parentPath={path} index={i} inRow={row} />
          </Fragment>
        );
      })}
    </div>
  );
}

/** Publishes each stack's children and shown child for a mod that draws its header, and where each docked float sits. */
function publishStacks(node: LayoutNode, path = "r") {
  const float = path === "r" ? undefined : floatNow(node, path);
  if (float?.edge && node.id) publishFloat(node.id, { edge: float.edge, align: float.align ?? "center" });
  if (node.type === "stack" && node.id) {
    const ids = node.children.map((child, i) => child.id ?? String(i));
    publishStack(node.id, node.children.map((child, i) => ({ id: ids[i]!, title: child.title ?? child.id ?? `Tab ${i + 1}` })), activeOverride(node.id) ?? node.active ?? ids[0]!);
  }
  if ("children" in node) node.children.forEach((child, i) => publishStacks(child, `${path}/${i}`));
}

const watchDark = (watch: () => void) => {
  const query = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  query?.addEventListener("change", watch);
  return () => query?.removeEventListener("change", watch);
};

/** The whole window as a layout file describes it, in the place the stock three cards would be. The
 * core has already checked the shape; a layout that stops parsing is never passed here. */
export function LayoutRoot({ root }: { root: LayoutNode }) {
  const mods = useSyncExternalStore(subscribeMods, currentMods)?.mods ?? [];
  pointAtLayout(root);
  useSyncExternalStore(subscribeLayoutState, layoutStateVersion);
  const dark = useSyncExternalStore(watchDark, prefersDark);
  const { theme, colors, font, radius, border, shadow, terminalPadding, terminalOpacity, paneRadius, paneBorder, paneFocus, movable, paneGap, paneLone } = root;
  const look = JSON.stringify({ theme, colors, font, radius, border, shadow, terminalPadding, terminalOpacity, paneRadius, paneBorder, paneFocus, movable, paneGap, paneLone, dark });
  // A root background paints the window behind the cards.
  useEffect(() => {
    const { dark: _dark, ...rest } = JSON.parse(look);
    setRootLook(lookVars(rest, false));
    setPaneLook({ gap: rest.paneGap, lone: rest.paneLone });
    return () => { setRootLook({}); setPaneLook(null); };
  }, [look]);
  useEffect(() => { setShownLayout(root); return () => setShownLayout(null); }, [root]);
  useEffect(() => { publishStacks(root); });
  // The desktop draws its window buttons over the layout's top-left corner (macOS): say how much room
  // they need, for a layout that sets `titlebar: "none"` and draws its own bar.
  const lights = root.trafficLights;
  const [lightsX, lightsY] = lights ?? [];
  useEffect(() => {
    const mac = "__TAURI_INTERNALS__" in window && /Mac/.test(navigator.platform);
    // Room to leave on the left: the buttons' own span past where the layout put them.
    document.documentElement.style.setProperty("--titlebar-inset", mac ? `${(lightsX ?? 14) + 70}px` : "0px");
    if (mac && lightsX !== undefined && lightsY !== undefined) void tauriInvoke?.("set_traffic_lights", { at: [lightsX, lightsY] });
    return () => {
      document.documentElement.style.removeProperty("--titlebar-inset");
      if (mac && lightsX !== undefined) void tauriInvoke?.("set_traffic_lights", { at: null });
    };
  }, [lightsX, lightsY]);
  return <div className="flex min-h-0 flex-1 px-2 pt-2" style={{ background: root.background }} data-testid="layout-root"><Node node={{ ...root, background: undefined }} mods={mods} root path="r" parentPath="" index={0} /></div>;
}
