//! The explorer's keyboard policy (part of `stock:files`): which rows the cursor walks and what each key does.
import type { DirectoryEntry } from "@perch/sdk";

/** The explorer's visible rows, top to bottom: each loaded level in order, a folder's children right
 * after it while it is expanded and its listing has arrived. `trees` is keyed by folder path ("" = root). */
export function flattenTree(
  trees: Record<string, { entries: DirectoryEntry[]; state: string } | undefined>,
  expanded: ReadonlySet<string>,
  path = "",
): DirectoryEntry[] {
  return (trees[path]?.entries ?? []).flatMap((entry) => [
    entry,
    ...(entry.kind === "directory" && expanded.has(entry.path) && trees[entry.path]?.state === "ready" ? flattenTree(trees, expanded, entry.path) : []),
  ]);
}

/** One row of the explorer as drawn: a file or folder at its depth, or a folder's state line (loading, failed,
 * empty, cut short) at its children's depth. */
export type TreeItem =
  | { kind: "entry"; entry: DirectoryEntry; level: number }
  | { kind: "loading" | "empty" | "truncated"; path: string; level: number }
  | { kind: "error"; path: string; level: number; error?: string; entry: DirectoryEntry };

/** The explorer's rows, top to bottom, as the nested tree draws them: a folder's state line or its children right
 * after it while it is expanded and its listing has been asked for. */
export function treeItems(
  trees: Record<string, { entries: DirectoryEntry[]; state: string; truncated?: boolean; error?: string } | undefined>,
  expanded: ReadonlySet<string>,
  path = "",
  level = 0,
): TreeItem[] {
  const tree = trees[path];
  if (!tree) return [];
  const items: TreeItem[] = [];
  for (const entry of tree.entries) {
    items.push({ kind: "entry", entry, level });
    const child = entry.kind === "directory" && expanded.has(entry.path) ? trees[entry.path] : undefined;
    if (child?.state === "loading") items.push({ kind: "loading", path: entry.path, level: level + 1 });
    else if (child?.state === "error") items.push({ kind: "error", path: entry.path, level: level + 1, error: child.error, entry });
    else if (child?.state === "ready") items.push(...treeItems(trees, expanded, entry.path, level + 1));
  }
  if (tree.truncated) items.push({ kind: "truncated", path, level });
  if (tree.state === "ready" && tree.entries.length === 0) items.push({ kind: "empty", path, level });
  return items;
}

/** The rows a tree of `count` rows draws when the view shows `shown` rows from row `top`: the chunks (of `chunk`
 * rows) the view is in, with one more chunk before and after it. A move inside a chunk keeps the same rows. */
export function treeWindow(count: number, top: number, shown: number, chunk: number): { start: number; end: number } {
  const first = Math.floor(Math.max(0, top) / chunk) - 1;
  const last = Math.floor((Math.max(0, top) + shown) / chunk) + 1;
  const start = Math.min(Math.max(0, first * chunk), Math.max(0, count - chunk));
  return { start: Math.max(0, start), end: Math.min(count, Math.max(start + chunk, (last + 1) * chunk)) };
}

/** What a key does in the explorer. Arrows only move the cursor (VS Code's list focus); Space
 * previews the file under it while keeping focus here; Enter opens it as a regular tab and moves
 * focus to the editor. Folders expand and collapse instead of opening. */
export interface ExplorerKeyResult {
  /** Move the cursor to this path. */
  cursor?: string;
  /** Toggle this folder open or closed. */
  toggle?: string;
  /** Open this file; `pin` = a regular tab, else the preview tab. */
  open?: { path: string; pin: boolean };
}

const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");

/** The effect of `key` with the cursor on `cursor` (null/unknown = none yet), or null when the key is not the explorer's. */
export function explorerKey(
  rows: readonly DirectoryEntry[],
  cursor: string | null,
  key: string,
  expanded: ReadonlySet<string>,
): ExplorerKeyResult | null {
  if (rows.length === 0) return null;
  const at = rows.findIndex((row) => row.path === cursor);
  const current = rows[at];
  const go = (row: DirectoryEntry | undefined): ExplorerKeyResult | null => (row ? { cursor: row.path } : null);
  switch (key) {
    case "ArrowDown":
      return go(rows[at + 1] ?? (at < 0 ? rows[0] : undefined));
    case "ArrowUp":
      return go(at < 0 ? rows[0] : rows[at - 1]);
    case "Home":
      return go(rows[0]);
    case "End":
      return go(rows[rows.length - 1]);
    case "ArrowRight":
      if (current?.kind !== "directory") return null;
      if (!expanded.has(current.path)) return { toggle: current.path };
      return rows[at + 1] && parentOf(rows[at + 1]!.path) === current.path ? go(rows[at + 1]) : null;
    case "ArrowLeft":
      if (!current) return null;
      if (current.kind === "directory" && expanded.has(current.path)) return { toggle: current.path };
      return go(rows.find((row) => row.path === parentOf(current.path) && row.kind === "directory"));
    case " ":
    case "Enter":
      if (!current) return null;
      if (current.kind === "directory") return { toggle: current.path };
      return { open: { path: current.path, pin: key === "Enter" } };
    default:
      return null;
  }
}
