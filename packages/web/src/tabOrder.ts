/**
 * tabOrder.ts — Wave 2 item 10: client-only tab reorder persistence.
 *
 * Drag-to-reorder in TabBar.tsx is purely presentational: perch's protocol
 * has no notion of tab order (sessions are just rows with a `createdAt`), so
 * rather than inventing a new protocol field, the reordered position is
 * persisted client-side in localStorage, keyed per project (`hostId:cwd`) —
 * the same project grouping TabBar/Sidebar already use elsewhere.
 */

const STORAGE_PREFIX = "perch.tabOrder.";

function storageKey(projectKey: string): string {
  return `${STORAGE_PREFIX}${projectKey}`;
}

function readOrder(projectKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(projectKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return []; // localStorage unavailable, or corrupt value — fall back to createdAt order
  }
}

function writeOrder(projectKey: string, order: string[]): void {
  try {
    localStorage.setItem(storageKey(projectKey), JSON.stringify(order));
  } catch {
    // ignore — worst case tabs just fall back to creation order next time
  }
}

/** Reorder `sessions` (already filtered to one project, sorted by
 * `createdAt`) according to any stored drag order for `projectKey`. Sessions
 * with no stored position (new since the last reorder, or the order was
 * never customized) keep their relative `createdAt` order and are appended
 * after any that do have a stored position. Closed/removed sessions are
 * simply absent from the result since this only ever iterates the live
 * `sessions` array — no separate pruning of stale ids is needed. */
export function applyStoredTabOrder<T extends { id: string }>(projectKey: string, sessions: T[]): T[] {
  const order = readOrder(projectKey);
  if (order.length === 0) return sessions;
  const remaining = new Map(sessions.map((s) => [s.id, s]));
  const ordered: T[] = [];
  for (const id of order) {
    const s = remaining.get(id);
    if (s) {
      ordered.push(s);
      remaining.delete(id);
    }
  }
  for (const s of sessions) {
    if (remaining.has(s.id)) ordered.push(s);
  }
  return ordered;
}

/** Persist a new drag-resolved tab order for `projectKey`. */
export function saveTabOrder(projectKey: string, orderedIds: string[]): void {
  writeOrder(projectKey, orderedIds);
}
