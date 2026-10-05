/**
 * This window's viewer identity: the owner of its presentation rows in the core
 * (`surfaceSync.ts`) and of its local tab state (`fileTabs`, `splitSets`, `tabOrder`
 * keys carry `@<viewerId>`), so two windows never overwrite each other.
 *
 * A window holds a Web Lock on its id for as long as the page lives (released by the
 * browser on close or crash), which is what tells a live owner from a gone one:
 * - a reload keeps the id kept in `sessionStorage` (waiting for the old page to let go);
 * - a window created with an opener copies that `sessionStorage`, finds the id held,
 *   and takes another;
 * - a window with no id (new, or the app restarted) takes the most recently used id no
 *   window holds, so a restart gets its layout and selection back, else a fresh one.
 * Without Web Locks (an insecure origin) a window keeps its `sessionStorage` id or
 * starts fresh; two windows there are still separate, a restart is not recovered.
 */
import { newId } from "./ids";

const SESSION_KEY = "perch.viewerId";
/** Viewer id -> last time a window held it (ms), in localStorage. */
const REGISTRY_KEY = "perch.viewers";
const FORGET_AFTER_MS = 30 * 24 * 3_600_000;
const HANDOFF_WAIT_MS = 1_000;

let current: string | undefined;

function session(): string | undefined {
  try { return sessionStorage.getItem(SESSION_KEY) ?? undefined; } catch { return undefined; }
}

/** Before `claimViewer` has run (unit tests) this is the window's stored id, else a throwaway one. */
export const viewerId = (): string => (current ??= session() ?? newId());

/** `base` made this viewer's own. */
export const viewerKey = (base: string): string => `${base}@${viewerId()}`;

/** This viewer's stored value for `base`. A value from before keys were per viewer is adopted by the first reader. */
export function readViewerStored(base: string): string | null {
  const own = localStorage.getItem(viewerKey(base));
  if (own !== null) return own;
  const legacy = localStorage.getItem(base);
  if (legacy !== null) {
    localStorage.setItem(viewerKey(base), legacy);
    localStorage.removeItem(base);
  }
  return legacy;
}

function registry(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function remember(id: string): void {
  try {
    const known = registry();
    known[id] = Date.now();
    for (const [other, seen] of Object.entries(known)) {
      if (Date.now() - seen <= FORGET_AFTER_MS) continue;
      delete known[other];
      for (const key of Object.keys(localStorage)) if (key.endsWith(`@${other}`)) localStorage.removeItem(key);
    }
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(known));
  } catch { /* convenience only */ }
}

/** Hold `id` for the page's life. False if another window has it (after `wait`, when waiting). */
function hold(id: string, wait: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const options: LockOptions = wait ? { signal: AbortSignal.timeout(HANDOFF_WAIT_MS) } : { ifAvailable: true };
    navigator.locks.request(`perch.viewer.${id}`, options, (lock) => {
      if (!lock) return void resolve(false);
      resolve(true);
      return new Promise<never>(() => {});
    }).catch(() => resolve(false));
  });
}

/** Settle this window's viewer id. Run once, before anything reads `viewerId()` for storage. */
export async function claimViewer(): Promise<string> {
  const mine = session();
  if (typeof navigator !== "undefined" && navigator.locks) {
    const idle = Object.entries(registry()).sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => id !== mine);
    if (mine && await hold(mine, true)) current = mine;
    for (const id of current ? [] : idle) if (await hold(id, false)) { current = id; break; }
    if (!current) {
      const fresh = newId();
      if (await hold(fresh, false)) current = fresh;
    }
  }
  current ??= mine ?? newId();
  try { sessionStorage.setItem(SESSION_KEY, current); } catch { /* a reload then starts as a new window */ }
  const id = current;
  remember(id);
  setInterval(() => remember(id), 3_600_000);
  if (typeof window !== "undefined") window.addEventListener("pagehide", () => remember(id));
  return id;
}
