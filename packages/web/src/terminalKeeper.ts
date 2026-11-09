/**
 * terminalKeeper.ts — terminals that outlive their React view, like a native
 * terminal's tabs. Switching sessions clears the dockview layout and
 * unmounts every pane; a terminal rebuilt from the server's replay comes back
 * with only the scrollback the replay carries. A kept terminal (xterm, its
 * connection and its view state) is parked off screen instead, and shown
 * again as it was.
 *
 * Dropped when the connection goes (its binding is dead), when its session
 * is deleted, or when too many are parked.
 */
import { createContext } from "react";
import { usePerchStore } from "./store";
import { socket } from "./ws";
import type { PerchTerminal } from "./xtermSetup";

export abstract class KeptTerminal<S> {
  readonly host = document.createElement("div");
  abstract readonly created: PerchTerminal;
  mounted = true;
  protected disposed = false;
  private listeners = new Set<() => void>();

  /** Mounts `host` in `container` first: xterm measures on open. */
  constructor(public state: S, container: HTMLElement) {
    this.host.className = "terminal__host";
    container.appendChild(this.host);
  }

  protected set(patch: Partial<S>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getState = () => this.state;

  show(container: HTMLElement) {
    this.mounted = true;
    container.appendChild(this.host);
    this.created.fit();
  }
  park() {
    this.mounted = false;
    // Detached, it frees its WebGL context (`createPerchTerminal`).
    this.host.remove();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.host.remove();
    this.teardown();
  }
  protected abstract teardown(): void;
}

// ponytail: at most KEEP parked, least recently shown dropped first (it
// replays when shown again). Each holds its scrollback in memory; a byte
// budget would replace the count if that bites.
const KEEP = 12;
/** `holders`: the containers that placed it, oldest first; it is drawn in the last one. */
const kept = new Map<string, { sessionId: string; view: KeptTerminal<unknown>; holders: HTMLElement[] }>();

/**
 * True under a surface that borrows terminals instead of drawing a second copy: a mod's overlay, popup or window
 * with layout content, a peek, a package's `Layout`. There a terminal already on screen moves in (the same xterm,
 * connection, input and resize owner) and goes back where it was when the surface lets go; elsewhere a second
 * view of an on-screen terminal stays a separate, unkept one (a split showing one session twice).
 */
export const BorrowTerminals = createContext(false);

export function forgetTerminal(key: string) {
  kept.get(key)?.view.dispose();
  kept.delete(key);
}

/** Dismiss observation only; releasing bindings never stops execution. */
export function forgetSessionTerminals(sessionId: string) {
  for (const [key, entry] of [...kept]) if (entry.sessionId === sessionId) forgetTerminal(key);
}

socket.onConnectionChange((connected) => {
  if (!connected) for (const key of [...kept.keys()]) forgetTerminal(key);
});
usePerchStore.subscribe((state, previous) => {
  if (state.sessions === previous.sessions) return;
  const live = new Set(state.sessions.map((session) => session.id));
  const known = new Set(previous.sessions.map((session) => session.id));
  for (const [key, entry] of [...kept]) {
    if (known.has(entry.sessionId) && !live.has(entry.sessionId) && !entry.view.mounted) forgetTerminal(key);
  }
});

/** Views that cannot be kept (a remote session's legacy terminal attaches with its view and ends with it), by
 * session: each one's terminal element and the places holding it, its own place first. */
const lenders = new Map<string, { surface: HTMLElement; holders: HTMLElement[]; fit: () => void }[]>();

/** A view that is not kept offers its terminal element to borrowing surfaces (`BorrowTerminals`) while it is mounted,
 * so a peek of its session moves that one terminal instead of attaching a second viewer. Returns the way to withdraw
 * it (the view is ending; its element leaves any borrower). */
export function lendTerminal(sessionId: string, home: HTMLElement, surface: HTMLElement, fit: () => void): () => void {
  const entry = { surface, holders: [home], fit };
  lenders.set(sessionId, [...(lenders.get(sessionId) ?? []), entry]);
  return () => {
    const rest = (lenders.get(sessionId) ?? []).filter((other) => other !== entry);
    if (rest.length) lenders.set(sessionId, rest); else lenders.delete(sessionId);
    entry.holders.length = 0;
  };
}

/** Moves the newest lent terminal of `sessionId` into `container`; null when no view lends one (then the borrower
 * shows a placeholder, never a view of its own). The returned release moves it back to where it was. */
export function borrowLentTerminal(sessionId: string, container: HTMLElement): (() => void) | null {
  const entry = lenders.get(sessionId)?.at(-1);
  if (!entry) return null;
  entry.holders.push(container);
  container.appendChild(entry.surface);
  entry.fit();
  return () => {
    const at = entry.holders.lastIndexOf(container);
    if (at < 0) return;
    entry.holders.splice(at, 1);
    const back = entry.holders.at(-1);
    // Only the place it is drawn in gives it back; a borrower further down the list just leaves it.
    if (at === entry.holders.length && back?.isConnected) {
      back.appendChild(entry.surface);
      entry.fit();
    }
  };
}

/** The terminals this page keeps for `sessionId`, shown or parked off screen: each one's element (its xterm is
 * under it, so its text can be read without it being on screen) and the terminal it types into (null: none now). */
export function keptTerminals(sessionId: string): { host: HTMLElement; inputId: string | null; shown: boolean }[] {
  return [...kept.values()].filter((entry) => entry.sessionId === sessionId)
    .map(({ view }) => ({ host: view.host, inputId: (view as { inputId?: string | null }).inputId ?? null, shown: view.mounted }));
}

/** Show `key`'s kept terminal in `container`, or `create` it there. One already on screen (the same session in a
 * split) gets a second, unkept terminal, unless `borrow`: then the kept one moves into `container` and returns to its
 * previous holder when this one lets go. `hide` lets go: back to the previous holder if there is one, else it parks,
 * or is dropped once its session is gone. Neither ever stops the process. */
export function showTerminal<V extends KeptTerminal<unknown>>(
  key: string, sessionId: string, container: HTMLElement, create: () => V, options: { borrow?: boolean } = {},
): { view: V; hide: () => void } {
  const existing = kept.get(key);
  if (existing?.view.mounted && !options.borrow) {
    const view = create();
    return { view, hide: () => view.dispose() };
  }
  kept.delete(key);
  const view = (existing?.view as V | undefined) ?? create();
  if (existing) view.show(container);
  const holders = existing?.view.mounted ? [...existing.holders, container] : [container];
  const entry = { sessionId, view, holders };
  kept.set(key, entry);
  return {
    view,
    hide: () => {
      const current = kept.get(key);
      if (current?.view !== view) { view.dispose(); return; }
      const at = current.holders.lastIndexOf(container);
      if (at >= 0) current.holders.splice(at, 1);
      const back = current.holders[current.holders.length - 1];
      if (back) {
        // A borrower let go: the previous place shows it again. One that is not the top only leaves the list.
        if (at === current.holders.length && back.isConnected) view.show(back);
        return;
      }
      if (!usePerchStore.getState().sessions.some((session) => session.id === sessionId)) { forgetTerminal(key); return; }
      view.park();
      const parked = [...kept].filter(([, other]) => !other.view.mounted);
      for (const [stale] of parked.slice(0, Math.max(0, parked.length - KEEP))) forgetTerminal(stale);
    },
  };
}
