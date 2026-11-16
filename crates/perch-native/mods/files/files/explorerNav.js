// explorerNav.ts of Perch's stock screen "stock:files", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
/** The explorer's visible rows, top to bottom: each loaded level in order, a folder's children right
 * after it while it is expanded and its listing has arrived. `trees` is keyed by folder path ("" = root). */
export function flattenTree(trees, expanded, path = "") {
    return (trees[path]?.entries ?? []).flatMap((entry) => [
        entry,
        ...(entry.kind === "directory" && expanded.has(entry.path) && trees[entry.path]?.state === "ready" ? flattenTree(trees, expanded, entry.path) : []),
    ]);
}
const parentOf = (path) => path.split("/").slice(0, -1).join("/");
/** The effect of `key` with the cursor on `cursor` (null/unknown = none yet), or null when the key is not the explorer's. */
export function explorerKey(rows, cursor, key, expanded) {
    if (rows.length === 0)
        return null;
    const at = rows.findIndex((row) => row.path === cursor);
    const current = rows[at];
    const go = (row) => (row ? { cursor: row.path } : null);
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
            if (current?.kind !== "directory")
                return null;
            if (!expanded.has(current.path))
                return { toggle: current.path };
            return rows[at + 1] && parentOf(rows[at + 1].path) === current.path ? go(rows[at + 1]) : null;
        case "ArrowLeft":
            if (!current)
                return null;
            if (current.kind === "directory" && expanded.has(current.path))
                return { toggle: current.path };
            return go(rows.find((row) => row.path === parentOf(current.path) && row.kind === "directory"));
        case " ":
        case "Enter":
            if (!current)
                return null;
            if (current.kind === "directory")
                return { toggle: current.path };
            return { open: { path: current.path, pin: key === "Enter" } };
        default:
            return null;
    }
}
