//! Safe start for packages that hang or crash the page while starting (a clone in place of a stock screen, a package in
//! a layout): the one failure the reset key cannot reach, since a page stuck in a loop takes no keys.
//!
//! Before a person's package starts, its id and revision are written to this device's storage; once it has rendered
//! (and the page got back to its own work, `setTimeout`) or failed with an error, the entry goes; so do the entries
//! of a page left normally while they were still starting (`pagehide`: a reload mid-load). An entry still there
//! when the next page loads means that page never got that far with it: the page froze or died. That package is then
//! turned off (`mods.set disable`, the same as Settings > Mods > Turn off, so it also shows there and on the phone),
//! stock comes back where it stood, and a notification says which one and why. Nothing else is changed: its files, the
//! `perch mod use` choice and every other mod stay as they are; Turn on in Settings > Mods tries it again.
//!
//! Stock screens are never guarded or turned off: they are Perch as shipped. Without storage (private mode) there is
//! no guard, as before.
const KEY = "perch.mods.booting";

type Booting = Record<string, { revision: string; at: number }>;

function read(): Booting {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Booting) : {};
  } catch {
    return {};
  }
}

function write(booting: Booting) {
  try {
    if (Object.keys(booting).length) localStorage.setItem(KEY, JSON.stringify(booting));
    else localStorage.removeItem(KEY);
  } catch { /* storage full or off: no guard */ }
}

/** What the previous page left starting, read once before this page starts anything. */
let leftover: Booting | null = null;
const fromLastPage = (): Booting => (leftover ??= read());

/** Marks `id` as starting until the returned `settle` runs (any number of copies; the entry goes with the last). */
const starting = new Map<string, number>();
export function guardStart(id: string, revision: string): () => void {
  fromLastPage();
  starting.set(id, (starting.get(id) ?? 0) + 1);
  write({ ...read(), [id]: { revision, at: Date.now() } });
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    const left = (starting.get(id) ?? 1) - 1;
    if (left > 0) { starting.set(id, left); return; }
    starting.delete(id);
    const now = read();
    delete now[id];
    write(now);
  };
}

/** This page is being left normally (a reload, a navigation, the tab closing) while packages are still starting: they
 * did not stop it, so their marks go. A frozen page runs no handler and a crashed one fires no event, so theirs stay. */
export function leavingPage() {
  if (!starting.size) return;
  const now = read();
  for (const id of starting.keys()) delete now[id];
  write(now);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", leavingPage);

/** The packages the previous page never finished starting, each once: the caller turns them off. */
export function takeStalledStarts(): { id: string; revision: string }[] {
  const found = Object.entries(fromLastPage()).map(([id, entry]) => ({ id, revision: String(entry?.revision ?? "") }));
  leftover = {};
  const now = read();
  for (const { id } of found) if (!starting.has(id)) delete now[id];
  write(now);
  return found;
}

/** For tests: forget what this module read. */
export const resetBootGuard = () => { leftover = null; starting.clear(); };
