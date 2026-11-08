/**
 * What a person did to the shown layout without editing its file: hid or showed a node, picked a stack's
 * child, dragged a boundary. Kept on this device per layout, and dropped when the layout file's content
 * changes (a deliberate edit beats a click, as in herdr). `layout.toggle` and `layout.stack` run on it.
 */
import type { LayoutNode } from "@perch/shared";
import { setShared } from "./modHost";

export interface SizeOverride { px?: number; weight?: number }
interface State { hidden: Record<string, boolean>; active: Record<string, string>; sizes: Record<string, SizeOverride[]> }

const PREFIX = "perch.layoutState.";
const empty = (): State => ({ hidden: {}, active: {}, sizes: {} });
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
  state = { hidden: { ...state.hidden }, active: { ...state.active }, sizes: { ...state.sizes } };
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

export const setHidden = (id: string, hidden: boolean) => change((s) => { s.hidden[id] = hidden; });
export const setActive = (stack: string, child: string) => change((s) => { s.active[stack] = child; });
export const setSizes = (path: string, sizes: SizeOverride[]) => change((s) => { s.sizes[path] = sizes; });

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

/** What a mod that draws a stack's header reads (`shared("layout.stack.<id>")`). */
export function publishStack(id: string, children: { id: string; title: string }[], active: string) {
  setShared(`layout.stack.${id}`, { children, active });
}
