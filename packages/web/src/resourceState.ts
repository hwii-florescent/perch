//! State the host keeps for a resource rather than for one view of it (`useResourceState`, `@perch/sdk` 1.4): a
//! review's unsent commit message and comment, its pending batch and its operation id, keyed by the screen's
//! own name for the resource (`review:<workspace>:commit`). Every view and copy that names the same key shares the
//! value, and it outlives a reload or swap of the screen's code, a released hidden copy and the phone/desktop
//! layouts trading places. In memory: a page reload starts empty (durable drafts live in their own services).
import { useCallback, useSyncExternalStore } from "react";

// ponytail: at most MAX keys, the least recently set without a live view dropped first; a byte budget would
// replace the count if screens start keeping large values here.
const MAX = 512;
const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function touch(key: string, value: unknown) {
  values.delete(key);
  values.set(key, value);
  for (const old of values.keys()) {
    if (values.size <= MAX) break;
    if (!listeners.get(old)?.size) values.delete(old);
  }
}

export function readResourceState<T>(key: string, initial: T): T {
  return (values.has(key) ? values.get(key) : initial) as T;
}

export function setResourceState<T>(key: string, next: T | ((previous: T) => T), initial: T): void {
  const previous = readResourceState(key, initial);
  const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
  if (values.has(key) && Object.is(value, previous)) return;
  touch(key, value);
  for (const listener of [...(listeners.get(key) ?? [])]) listener();
}

/** A React hook shaped like `useState`, whose value the host keeps under `key` (see the header). */
export function useResourceState<T>(key: string, initial: T): [T, (next: T | ((previous: T) => T)) => void] {
  if (typeof key !== "string" || !key) throw new Error("useResourceState needs a non-empty key.");
  // `initial` counts only while nothing is kept under `key`, as useState's does on the first render.
  if (!values.has(key)) touch(key, initial);
  const subscribe = useCallback((changed: () => void) => {
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(changed);
    return () => { set.delete(changed); if (!set.size) listeners.delete(key); };
  }, [key]);
  const value = useSyncExternalStore(subscribe, () => values.get(key) as T);
  const set = useCallback((next: T | ((previous: T) => T)) => setResourceState(key, next, initial), [key]); // `initial` only fills a missing value, so it is not a dependency
  return [value, set];
}

/** Tests only: forget everything, as a page reload does. */
export function resetResourceStateForTest() {
  values.clear();
}
