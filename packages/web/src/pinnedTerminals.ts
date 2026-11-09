/** Terminals the person (or a mod) pinned, and the order a mod's own panel puts them in: kept on this device
 * (localStorage), named as such wherever they are reported. Neither is shared terminal metadata, and Perch's own views
 * ignore both; a mod's sidebar or a package reads them through `agents()`, `terminals()` and the SDK's records. */
const PINS = "perch.pinnedTerminals";
const ORDER = "perch.terminalOrder";

// What was last written, for a page with no usable storage (private mode, an opaque origin): it then lasts for the page.
const memory = new Map<string, string[]>();
const read = (key: string): string[] => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? [];
  }
  if (raw === null) return memory.get(key) ?? [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return []; // a damaged value reads as none
  }
};
// Bumped on every write, so a view that orders by pins (`useTerminals`) draws again when one changes.
let version = 0;
const listeners = new Set<() => void>();
export const pinsVersion = () => version;
export const subscribePins = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const write = (key: string, ids: string[]) => {
  memory.set(key, ids);
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // No storage to keep it in: it lasts for this page only.
  }
  version++;
  for (const listener of [...listeners]) listener();
};

export const isPinned = (id: string) => read(PINS).includes(id);

export const setPinned = (id: string, pinned: boolean) => {
  const rest = read(PINS).filter((other) => other !== id);
  write(PINS, pinned ? [...rest, id] : rest);
};

/** The session ids in the order last set on this device; [] is the app's own order. */
export const terminalOrder = (): string[] => read(ORDER);

/** Sets that order (session ids, at most 1000, duplicates dropped); [] goes back to the app's order. */
export function setTerminalOrder(ids: unknown): void {
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some((id) => typeof id !== "string" || !id || id.length > 200)) {
    throw new Error("The order is a list of session ids.");
  }
  write(ORDER, [...new Set(ids as string[])]);
}

/** Where `id` is in that order (0 = first), or null when it is not in it. */
export const orderOf = (id: string): number | null => {
  const at = read(ORDER).indexOf(id);
  return at === -1 ? null : at;
};
