/**
 * What a person did to the shown layout without editing its file: hid or showed a node, picked a stack's
 * child, dragged a boundary. Kept on this device per layout, and dropped when the layout file's content
 * changes (a deliberate edit beats a click, as in herdr). `layout.toggle` and `layout.stack` run on it.
 */
import type { LayoutNode } from "@perch/shared";
import { getShared, setShared } from "./modHost";

export interface SizeOverride { px?: number; weight?: number }
/** Where a person dropped a floating node: the edge it snapped to and the third along it. */
export interface FloatSpot { edge: "top" | "right" | "bottom" | "left"; align: "start" | "center" | "end" }
interface State { hidden: Record<string, boolean>; active: Record<string, string>; sizes: Record<string, SizeOverride[]>; floats: Record<string, FloatSpot> }

const PREFIX = "perch.layoutState.";
const empty = (): State => ({ hidden: {}, active: {}, sizes: {}, floats: {} });
let key = "";
let state: State = empty();
const watchers = new Set<() => void>();
let version = 0;

const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7).toString(36);

/** Points the store at a layout (by its content); the previous layout's clicks stay for when it returns. */
export function pointAtLayout(root: LayoutNode): void {
  const next = PREFIX + hash(JSON.stringify(root));
  if (next === key) return;
  key = next;
  try { state = { ...empty(), ...JSON.parse(localStorage.getItem(key) ?? "{}") }; } catch { state = empty(); }
  version++;
}

function change(update: (draft: State) => void) {
  state = { hidden: { ...state.hidden }, active: { ...state.active }, sizes: { ...state.sizes }, floats: { ...state.floats } };
  update(state);
  version++;
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* a full disk only loses the memory */ }
  watchers.forEach((watch) => watch());
}

export const subscribeLayoutState = (watch: () => void) => (watchers.add(watch), () => void watchers.delete(watch));
export const layoutStateVersion = () => version;
export const hiddenOverride = (id: string | undefined) => (id === undefined ? undefined : state.hidden[id]);
export const activeOverride = (id: string | undefined) => (id === undefined ? undefined : state.active[id]);
export const sizeOverride = (path: string) => state.sizes[path];
export const floatOverride = (id: string) => state.floats[id];

export const setHidden = (id: string, hidden: boolean) => change((s) => { s.hidden[id] = hidden; });
export const setActive = (stack: string, child: string) => change((s) => { s.active[stack] = child; });
export const setSizes = (path: string, sizes: SizeOverride[]) => change((s) => { s.sizes[path] = sizes; });
export const setFloat = (id: string, spot: FloatSpot | null) => change((s) => { if (spot) s.floats[id] = spot; else delete s.floats[id]; });

/** Where a dropped float lands: the window edge nearest its centre, and the third of that edge it is over. */
export function snapSpot(centerX: number, centerY: number, width: number, height: number): FloatSpot {
  const near: [FloatSpot["edge"], number][] = [["left", centerX], ["right", width - centerX], ["top", centerY], ["bottom", height - centerY]];
  const edge = near.reduce((best, now) => (now[1] < best[1] ? now : best))[0];
  const along = edge === "left" || edge === "right" ? centerY / height : centerX / width;
  return { edge, align: along < 1 / 3 ? "start" : along > 2 / 3 ? "end" : "center" };
}

/** The ids a layout names, so commands can refuse one that is not there. */
export function nodeIds(node: LayoutNode, into = new Map<string, LayoutNode>()): Map<string, LayoutNode> {
  if (node.id) into.set(node.id, node);
  if ("children" in node) node.children.forEach((child) => nodeIds(child, into));
  return into;
}

let shown: LayoutNode | null = null;
export const setShownLayout = (root: LayoutNode | null) => { shown = root; };

/** `layout.toggle {id, hidden?}`: hide or show a node of the shown layout by its `id`. */
export function toggleNode(args: unknown): void {
  const { id, hidden } = (args ?? {}) as { id?: unknown; hidden?: unknown };
  const node = typeof id === "string" && shown ? nodeIds(shown).get(id) : undefined;
  if (!node || typeof id !== "string") throw new Error(`No node "${String(id)}" in the shown layout (give a node an "id" in the layout file).`);
  setHidden(id, typeof hidden === "boolean" ? hidden : !(hiddenOverride(id) ?? node.hidden ?? false));
}

/** `layout.stack {stack, child}`: show a stack's child by its `id`. */
export function showStackChild(args: unknown): void {
  const { stack, child } = (args ?? {}) as { stack?: unknown; child?: unknown };
  const node = typeof stack === "string" && shown ? nodeIds(shown).get(stack) : undefined;
  if (node?.type !== "stack" || typeof child !== "string" || !node.children.some((c) => c.id === child)) {
    throw new Error("layout.stack needs {stack: <a stack's id>, child: <one of its children's ids>}.");
  }
  setActive(stack as string, child);
}

/** `layout.float {id, edge?, align?}`: put a floating node at a spot, or back where the file says (no edge). */
export function placeFloat(args: unknown): void {
  const { id, edge, align } = (args ?? {}) as { id?: unknown; edge?: unknown; align?: unknown };
  const node = typeof id === "string" && shown ? nodeIds(shown).get(id) : undefined;
  if (!node?.float || typeof id !== "string") throw new Error(`No floating node "${String(id)}" in the shown layout (give it an "id" and a "float").`);
  if (edge === undefined) return setFloat(id, null);
  if (!["top", "right", "bottom", "left"].includes(edge as string) || !["start", "center", "end"].includes((align ?? "center") as string)) {
    throw new Error('layout.float needs edge top|right|bottom|left and align start|center|end.');
  }
  setFloat(id, { edge: edge as FloatSpot["edge"], align: (align ?? "center") as FloatSpot["align"] });
}

/** What a floating node's mod reads (`shared("layout.float.<id>")`): where it sits and whether it is being dragged. */
export function publishFloat(id: string, spot: { edge: string; align: string }, dragging = false) {
  const old = getShared(`layout.float.${id}`) as { edge?: string; align?: string; dragging?: boolean } | undefined;
  if (old?.edge === spot.edge && old.align === spot.align && !!old.dragging === dragging) return;
  setShared(`layout.float.${id}`, { ...spot, vertical: spot.edge === "left" || spot.edge === "right", dragging });
}

/** What a mod that draws a stack's header reads (`shared("layout.stack.<id>")`). */
export function publishStack(id: string, children: { id: string; title: string }[], active: string) {
  setShared(`layout.stack.${id}`, { children, active });
}
