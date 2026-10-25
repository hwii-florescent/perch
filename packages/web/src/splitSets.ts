import { create } from "zustand";
import { readViewerStored, viewerKey } from "./viewer";

/**
 * Split sets: tabs shown side by side in the canvas while the strip stays one
 * row of ordinary tabs (like Vivaldi's tiled tabs, unlike a pane per tab bar).
 * A set is a view relationship, not an owner: closing or unsplitting a member
 * never touches its process or file. Members are strip entry ids
 * (`workspaceTabs.ts`), per viewer, kept in localStorage.
 *
 * A set is flat (`ids`, `sizes`, `dir`: one row or column) until a tab is
 * dropped on the side of a pane across that axis; then `tree` holds the nested
 * layout (a row of a pane and a column of two, and so on). `ids` always lists
 * every member, so membership checks never need the tree, and an older client
 * that ignores `tree` still shows the members.
 */
export type SplitDir = "row" | "col";
/** The side of a pane a dragged tab is dropped on. */
export type DropZone = "left" | "right" | "up" | "down";

/** A pane (a tab id) or a row/column of nodes with size fractions summing to 1. */
export type SplitNode = string | { dir: SplitDir; kids: SplitNode[]; sizes: number[] };
type Branch = Exclude<SplitNode, string>;

export interface SplitSet {
  ids: string[];
  /** Size fractions along `dir`, one per id, summing to 1 (flat sets). */
  sizes: number[];
  /** Side by side (default) or stacked. */
  dir?: SplitDir;
  /** The nested layout; absent for a flat set. */
  tree?: SplitNode;
}

export const MAX_SPLIT = 4;
/** Space between neighbouring panes: a strip of the shell, so each pane's corners stay round. */
export const PANE_GAP_PX = 6;
/** A dragged divider never leaves a pane narrower than this (measured on shared edges, before `gapped`),
 * so at least 48px of it stays visible: barely visible, still grabbable. */
export const MIN_PANE_PX = 48 + PANE_GAP_PX;

const equal = (n: number) => Array.from({ length: n }, () => 1 / n);
const isLeaf = (node: SplitNode): node is string => typeof node === "string";

export const leaves = (node: SplitNode): string[] => (isLeaf(node) ? [node] : node.kids.flatMap(leaves));

/** A set as a tree; a flat set is one row or column of its members. */
export function treeOf(set: SplitSet): SplitNode {
  if (set.tree) return set.tree;
  return { dir: set.dir === "col" ? "col" : "row", kids: set.ids.slice(), sizes: set.sizes.length === set.ids.length ? set.sizes : equal(set.ids.length) };
}

/** A tree as a set: flat when it is one row or column of panes; null for fewer than two panes. */
function toSet(node: SplitNode): SplitSet | null {
  if (isLeaf(node)) return null;
  const ids = leaves(node);
  if (node.kids.every(isLeaf)) return { ids, sizes: node.sizes, dir: node.dir };
  return { ids, sizes: equal(ids.length), dir: node.dir, tree: node };
}

/** `node` without pane `id`: a column left with one child becomes that child, and a child of
 * the parent's own direction merges into it. The others keep their proportions. */
function without(node: SplitNode, id: string): SplitNode | null {
  if (isLeaf(node)) return node === id ? null : node;
  const kept = node.kids
    .map((kid, i) => ({ kid: without(kid, id), size: node.sizes[i] ?? 0 }))
    .filter((entry): entry is { kid: SplitNode; size: number } => entry.kid !== null);
  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0]!.kid;
  const total = kept.reduce((sum, entry) => sum + entry.size, 0);
  const kids: SplitNode[] = [];
  const sizes: number[] = [];
  for (const { kid, size } of kept) {
    const share = total > 0 ? size / total : 1 / kept.length;
    if (!isLeaf(kid) && kid.dir === node.dir) {
      kids.push(...kid.kids);
      sizes.push(...kid.sizes.map((inner) => inner * share));
    } else {
      kids.push(kid);
      sizes.push(share);
    }
  }
  return { dir: node.dir, kids, sizes };
}

/** `dragged` on the `zone` side of pane `target`: a sibling when the parent runs that way, else
 * `target` is replaced by a row/column of the two. */
function insertBeside(node: SplitNode, target: string, dragged: string, zone: DropZone): SplitNode {
  const dir: SplitDir = zone === "left" || zone === "right" ? "row" : "col";
  const after = zone === "right" || zone === "down";
  if (isLeaf(node)) return node === target ? { dir, kids: after ? [target, dragged] : [dragged, target], sizes: [0.5, 0.5] } : node;
  const at = node.kids.indexOf(target);
  if (at >= 0 && node.dir === dir) {
    const kids = node.kids.slice();
    kids.splice(at + (after ? 1 : 0), 0, dragged);
    return { dir, kids, sizes: equal(kids.length) };
  }
  return { ...node, kids: node.kids.map((kid) => insertBeside(kid, target, dragged, zone)) };
}

const settle = (sets: SplitSet[]): SplitSet[] =>
  sets.filter((set) => set.ids.length >= 2).map((set) => (set.sizes.length === set.ids.length ? set : { ...set, sizes: equal(set.ids.length) }));

/** `id` out of one set; null when fewer than two panes are left. */
function leaveSet(set: SplitSet, id: string): SplitSet | null {
  if (!set.ids.includes(id)) return set;
  const rest = without(treeOf(set), id);
  return rest ? toSet(rest) : null;
}

/** Put `other` beside `anchor`. Into anchor's set if it has one (`other` leaves
 * any set it was in); else `anchor` joins `other`'s set; else a new two-pane
 * set. No change when the set is full. */
export function joinSplit(sets: SplitSet[], anchor: string, other: string): SplitSet[] {
  if (anchor === other) return sets;
  const home = sets.find((set) => set.ids.includes(anchor));
  if (home?.ids.includes(other)) return sets;
  const dest = home ?? sets.find((set) => set.ids.includes(other));
  if (dest && dest.ids.length >= MAX_SPLIT) return sets;
  const joiner = home || !dest ? other : anchor;
  const member = joiner === other ? anchor : other;
  const base = dest ? treeOf(dest) : member;
  // Appended to the set's outermost row/column.
  const grown: SplitNode = isLeaf(base)
    ? { dir: "row", kids: [base, joiner], sizes: [0.5, 0.5] }
    : { ...base, kids: [...base.kids, joiner], sizes: equal(base.kids.length + 1) };
  const rest = sets.filter((set) => set !== dest).flatMap((set) => leaveSet(set, joiner) ?? []);
  const made = toSet(grown);
  return settle(made ? [...rest, made] : rest);
}

/** The sets after dropping `dragged` on the `zone` side of `target`, or null when it cannot be:
 * onto itself, or into a full set. The set `dragged` lands in is last. */
function placeBeside(sets: SplitSet[], dragged: string, target: string, zone: DropZone): SplitSet[] | null {
  if (dragged === target) return null;
  const home = sets.find((set) => set.ids.includes(target));
  const rest = without(home ? treeOf(home) : target, dragged) ?? target;
  if (leaves(rest).length + 1 > MAX_SPLIT) return null;
  const made = toSet(insertBeside(rest, target, dragged, zone));
  if (!made) return null;
  return [...sets.filter((set) => set !== home).flatMap((set) => leaveSet(set, dragged) ?? []), made];
}

/** The set that dropping `dragged` on `target`'s `zone` would make, or null when it cannot. */
export function planDrop(sets: SplitSet[], dragged: string, target: string, zone: DropZone): SplitSet | null {
  return placeBeside(sets, dragged, target, zone)?.at(-1) ?? null;
}

/** Drop `dragged` on a side of `target`: it joins (or starts) target's set, leaving any other. A
 * side across the set's direction nests: the target pane becomes a row or column of the two. */
export function dropSplit(sets: SplitSet[], dragged: string, target: string, zone: DropZone): SplitSet[] {
  const next = placeBeside(sets, dragged, target, zone);
  return next ? settle(next) : sets;
}

/** Take `id` out of its set; a set left with one member dissolves. */
export function leaveSplit(sets: SplitSet[], id: string): SplitSet[] {
  if (!sets.some((set) => set.ids.includes(id))) return sets;
  return settle(sets.flatMap((set) => leaveSet(set, id) ?? []));
}

/** Swap two panes' places in a nested set's layout. */
export function swapPanes(sets: SplitSet[], a: string, b: string): SplitSet[] {
  const swap = (node: SplitNode): SplitNode => isLeaf(node) ? (node === a ? b : node === b ? a : node) : { ...node, kids: node.kids.map(swap) };
  return sets.map((set) => (set.tree && set.ids.includes(a) && set.ids.includes(b) ? { ...set, tree: swap(set.tree) } : set));
}

export interface VisibleSplit {
  /** Every visible pane: strip order for a flat set, layout order for a nested one. */
  ids: string[];
  /** Size fractions of the outermost row/column (see `tree` for nested ones). */
  sizes: number[];
  dir: SplitDir;
  /** The layout, always a row/column. */
  tree: Branch;
  nested: boolean;
}

/** The set `activeId` belongs to, limited to members that exist now. A flat set is laid out in the
 * strip's order (`available` lists the strip's ids left to right); a nested one by its tree.
 * Null when fewer than two remain: a lone member just shows alone. */
export function visibleSplit(sets: SplitSet[], available: readonly string[], activeId: string | null): VisibleSplit | null {
  const set = activeId ? sets.find((candidate) => candidate.ids.includes(activeId)) : undefined;
  if (!set) return null;
  let tree: SplitNode | null = treeOf(set);
  for (const id of set.ids) if (tree && !available.includes(id)) tree = without(tree, id);
  if (!tree || isLeaf(tree)) return null;
  if (!tree.kids.every(isLeaf)) return { ids: leaves(tree), sizes: tree.sizes, dir: tree.dir, tree, nested: true };
  const members = tree.kids as string[];
  const kept = members.map((id, i) => ({ id, size: tree.sizes[i] ?? 0, at: available.indexOf(id) }))
    .sort((a, b) => a.at - b.at);
  const total = kept.reduce((sum, member) => sum + member.size, 0);
  const sizes = total > 0 ? kept.map((member) => member.size / total) : equal(kept.length);
  const ids = kept.map((member) => member.id);
  return { ids, sizes, dir: tree.dir, tree: { dir: tree.dir, kids: ids, sizes }, nested: false };
}

/** `node` with the sizes of the row/column at `path` (child indices from the root) replaced. */
function withSizes(node: SplitNode, path: number[], sizes: number[]): SplitNode {
  if (isLeaf(node)) return node;
  if (path.length === 0) return { ...node, sizes: sizes.slice() };
  const [at, ...rest] = path;
  return { ...node, kids: node.kids.map((kid, i) => (i === at ? withSizes(kid, rest, sizes) : kid)) };
}

/** Save dragged sizes for the row/column at `path` of the visible members' set. */
export function storeSizes(sets: SplitSet[], ids: string[], sizes: number[], path: number[] = []): SplitSet[] {
  const set = sets.find((candidate) => candidate.ids.includes(ids[0]!));
  // ponytail: a set with a hidden member (a closed or other-session tab) keeps its old sizes; resizing then is not remembered.
  if (!set || set.ids.length !== ids.length) return sets;
  if (!set.tree) return sets.map((candidate) => (candidate === set ? { ...candidate, ids: ids.slice(), sizes: sizes.slice() } : candidate));
  const next = toSet(withSizes(set.tree, path, sizes));
  return next ? sets.map((candidate) => (candidate === set ? next : candidate)) : sets;
}

export interface Rect { x: number; y: number; w: number; h: number }
/** A row/column of the layout: where it is, its sizes, and the `edges` between its children. */
export interface Strip { path: number[]; dir: SplitDir; rect: Rect; sizes: number[]; edges: number[] }

/** Where each pane goes in `rect`, and the rows/columns holding them. With `round`, edges fall on
 * whole pixels and neighbours share them. `live` overrides the sizes of one row/column mid-drag. */
export function layout(tree: SplitNode, rect: Rect, options: { round?: boolean; live?: { path: number[]; sizes: number[] } | null } = {}): { panes: Map<string, Rect>; strips: Strip[] } {
  const panes = new Map<string, Rect>();
  const strips: Strip[] = [];
  const { round, live } = options;
  const walk = (node: SplitNode, r: Rect, path: number[]) => {
    if (isLeaf(node)) { panes.set(node, r); return; }
    const sizes = live && live.sizes.length === node.kids.length && live.path.join() === path.join() ? live.sizes : node.sizes;
    const row = node.dir === "row";
    const origin = row ? r.x : r.y;
    const length = row ? r.w : r.h;
    const edges: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < node.kids.length - 1; i++) {
      cumulative += sizes[i]!;
      const at = origin + cumulative * length;
      edges.push(round ? Math.round(at) : at);
    }
    strips.push({ path, dir: node.dir, rect: r, sizes, edges });
    const bounds = [origin, ...edges, origin + length];
    node.kids.forEach((kid, i) => {
      const from = bounds[i]!;
      const span = bounds[i + 1]! - from;
      walk(kid, row ? { x: from, y: r.y, w: span, h: r.h } : { x: r.x, y: from, w: r.w, h: span }, [...path, i]);
    });
  };
  walk(tree, rect, []);
  return { panes, strips };
}

/** `r` with `gap / 2` taken off each side that borders another pane rather than the edge of `box`,
 * so two neighbours sharing an edge end up `gap` apart. A pane at the canvas edge stays flush with it. */
export function gapped(r: Rect, box: { width: number; height: number }, gap = PANE_GAP_PX): Rect {
  const half = gap / 2;
  const left = r.x > 0.5 ? half : 0;
  const top = r.y > 0.5 ? half : 0;
  const right = r.x + r.w < box.width - 0.5 ? half : 0;
  const bottom = r.y + r.h < box.height - 0.5 ? half : 0;
  return { x: r.x + left, y: r.y + top, w: Math.max(0, r.w - left - right), h: Math.max(0, r.h - top - bottom) };
}

const STORAGE_KEY = "perch.splitSets";

/** A tree whose panes are exactly `ids`, each once, with sizes for every row/column. */
function validTree(node: unknown, ids: string[]): node is SplitNode {
  const seen: string[] = [];
  const ok = (candidate: unknown): boolean => {
    if (typeof candidate === "string") { seen.push(candidate); return true; }
    const branch = candidate as Partial<Branch> | null;
    return Array.isArray(branch?.kids) && branch.kids.length >= 2 && (branch.dir === "row" || branch.dir === "col")
      && Array.isArray(branch.sizes) && branch.sizes.length === branch.kids.length && branch.sizes.every((size) => typeof size === "number")
      && branch.kids.every(ok);
  };
  return ok(node) && seen.length === ids.length && ids.every((id) => seen.includes(id));
}

function load(): SplitSet[] {
  try {
    const parsed: unknown = JSON.parse(readViewerStored(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return settle(parsed.filter((set): set is SplitSet =>
      Array.isArray(set?.ids) && set.ids.every((id: unknown) => typeof id === "string")
      && Array.isArray(set?.sizes) && set.sizes.every((size: unknown) => typeof size === "number"))
      .map((set) => (set.tree !== undefined && !validTree(set.tree, set.ids) ? { ids: set.ids, sizes: [], dir: set.dir } : set)));
  } catch {
    return [];
  }
}

interface SplitSetsState {
  sets: SplitSet[];
  split: (anchor: string, other: string) => void;
  drop: (dragged: string, target: string, zone: DropZone) => void;
  unsplit: (id: string) => void;
  untile: (id: string) => void;
  swap: (a: string, b: string) => void;
  /** Temporary zoom: keeps the split for the zoom/restore shortcut. */
  zoomedId: string | null;
  zoom: (id: string | null) => void;
  resize: (ids: string[], sizes: number[], path?: number[]) => void;
  /** The tab whose split menu is open, if any. */
  menu: { id: string; x: number; y: number } | null;
  openMenu: (id: string, x: number, y: number) => void;
  closeMenu: () => void;
}

export const useSplitSets = create<SplitSetsState>((set) => ({
  sets: load(),
  split: (anchor, other) => set((state) => ({ sets: joinSplit(state.sets, anchor, other) })),
  drop: (dragged, target, zone) => set((state) => ({ sets: dropSplit(state.sets, dragged, target, zone) })),
  unsplit: (id) => set((state) => ({ sets: leaveSplit(state.sets, id) })),
  untile: (id) => set((state) => ({ sets: state.sets.filter((group) => !group.ids.includes(id)), zoomedId: null })),
  swap: (a, b) => set((state) => ({ sets: swapPanes(state.sets, a, b) })),
  zoomedId: null,
  zoom: (id) => set({ zoomedId: id }),
  resize: (ids, sizes, path) => set((state) => ({ sets: storeSizes(state.sets, ids, sizes, path) })),
  menu: null,
  openMenu: (id, x, y) => set({ menu: { id, x, y } }),
  closeMenu: () => set({ menu: null }),
}));

useSplitSets.subscribe((state, previous) => {
  if (state.sets === previous.sets) return;
  try { localStorage.setItem(viewerKey(STORAGE_KEY), JSON.stringify(state.sets)); } catch { /* convenience only */ }
});
