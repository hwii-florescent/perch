import { create } from "zustand";

/**
 * Split sets: tabs shown side by side in the canvas while the strip stays one
 * row of ordinary tabs (like Vivaldi's tiled tabs, unlike a pane per tab bar).
 * A set is a view relationship, not an owner: closing or unsplitting a member
 * never touches its process or file. Members are strip entry ids
 * (`workspaceTabs.ts`), per viewer, kept in localStorage.
 */
export interface SplitSet {
  ids: string[];
  /** Width fractions, one per id, summing to 1. */
  sizes: number[];
}

export const MAX_SPLIT = 4;
/** A pane never shrinks below this share of the canvas. */
export const MIN_PANE = 0.15;

const equal = (n: number) => Array.from({ length: n }, () => 1 / n);
const settle = (sets: SplitSet[]): SplitSet[] =>
  sets.filter((set) => set.ids.length >= 2).map((set) => (set.sizes.length === set.ids.length ? set : { ...set, sizes: equal(set.ids.length) }));

/** Put `other` beside `anchor`. Into anchor's set if it has one (`other` leaves
 * any set it was in); else `anchor` joins `other`'s set; else a new two-pane
 * set. No change when the set is full. */
export function joinSplit(sets: SplitSet[], anchor: string, other: string): SplitSet[] {
  if (anchor === other) return sets;
  const home = sets.find((set) => set.ids.includes(anchor));
  if (home?.ids.includes(other)) return sets;
  if (home && home.ids.length >= MAX_SPLIT) return sets;
  const dest = home ? undefined : sets.find((set) => set.ids.includes(other));
  if (dest) {
    if (dest.ids.length >= MAX_SPLIT) return sets;
    return sets.map((set) => (set === dest ? { ids: [...set.ids, anchor], sizes: [] } : set)).map((set) => (set.ids.length === set.sizes.length ? set : { ...set, sizes: equal(set.ids.length) }));
  }
  const rest = sets.map((set) => ({ ...set, ids: set.ids.filter((id) => id !== other) }));
  const target = rest.find((set) => set.ids.includes(anchor));
  if (target) target.ids = [...target.ids, other];
  else rest.push({ ids: [anchor, other], sizes: [] });
  return settle(rest.map((set) => (set.ids.length === set.sizes.length ? set : { ...set, sizes: [] })));
}

/** Take `id` out of its set; a set left with one member dissolves. */
export function leaveSplit(sets: SplitSet[], id: string): SplitSet[] {
  if (!sets.some((set) => set.ids.includes(id))) return sets;
  return settle(sets.map((set) => ({ ...set, ids: set.ids.filter((member) => member !== id), sizes: [] })));
}

export interface VisibleSplit {
  ids: string[];
  sizes: number[];
}

/** The set `activeId` belongs to, limited to members that exist now and laid out
 * in the strip's order (`available` lists the strip's ids left to right).
 * Null when fewer than two remain: a lone member just shows alone. */
export function visibleSplit(sets: SplitSet[], available: readonly string[], activeId: string | null): VisibleSplit | null {
  const set = activeId ? sets.find((candidate) => candidate.ids.includes(activeId)) : undefined;
  if (!set) return null;
  const kept = set.ids.map((id, i) => ({ id, size: set.sizes[i] ?? 0, at: available.indexOf(id) }))
    .filter((member) => member.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (kept.length < 2) return null;
  const total = kept.reduce((sum, member) => sum + member.size, 0);
  const sizes = total > 0 ? kept.map((member) => member.size / total) : equal(kept.length);
  return { ids: kept.map((member) => member.id), sizes };
}

/** Save dragged widths for the visible members of their set. */
export function storeSizes(sets: SplitSet[], ids: string[], sizes: number[]): SplitSet[] {
  const set = sets.find((candidate) => candidate.ids.includes(ids[0]!));
  // ponytail: a set with a hidden member (a closed or other-session tab) keeps its old sizes; resizing then is not remembered.
  if (!set || set.ids.length !== ids.length) return sets;
  return sets.map((candidate) => (candidate === set ? { ids: ids.slice(), sizes: sizes.slice() } : candidate));
}

const STORAGE_KEY = "perch.splitSets";

function load(): SplitSet[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return settle(parsed.filter((set): set is SplitSet =>
      Array.isArray(set?.ids) && set.ids.every((id: unknown) => typeof id === "string")
      && Array.isArray(set?.sizes) && set.sizes.every((size: unknown) => typeof size === "number")));
  } catch {
    return [];
  }
}

interface SplitSetsState {
  sets: SplitSet[];
  split: (anchor: string, other: string) => void;
  unsplit: (id: string) => void;
  resize: (ids: string[], sizes: number[]) => void;
  /** The tab whose split menu is open, if any. */
  menu: { id: string; x: number; y: number } | null;
  openMenu: (id: string, x: number, y: number) => void;
  closeMenu: () => void;
}

export const useSplitSets = create<SplitSetsState>((set) => ({
  sets: load(),
  split: (anchor, other) => set((state) => ({ sets: joinSplit(state.sets, anchor, other) })),
  unsplit: (id) => set((state) => ({ sets: leaveSplit(state.sets, id) })),
  resize: (ids, sizes) => set((state) => ({ sets: storeSizes(state.sets, ids, sizes) })),
  menu: null,
  openMenu: (id, x, y) => set({ menu: { id, x, y } }),
  closeMenu: () => set({ menu: null }),
}));

useSplitSets.subscribe((state, previous) => {
  if (state.sets === previous.sets) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sets)); } catch { /* convenience only */ }
});
