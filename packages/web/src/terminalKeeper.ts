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
const kept = new Map<string, { sessionId: string; view: KeptTerminal<unknown> }>();

export function forgetTerminal(key: string) {
  kept.get(key)?.view.dispose();
  kept.delete(key);
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

/** Show `key`'s kept terminal in `container`, or `create` it there. One
 * already on screen (the same session in a split) gets a second, unkept
 * terminal. `hide` parks it, or drops it once its session is gone. */
export function showTerminal<V extends KeptTerminal<unknown>>(
  key: string, sessionId: string, container: HTMLElement, create: () => V,
): { view: V; hide: () => void } {
  const existing = kept.get(key);
  if (existing?.view.mounted) {
    const view = create();
    return { view, hide: () => view.dispose() };
  }
  kept.delete(key);
  const view = (existing?.view as V | undefined) ?? create();
  if (existing) view.show(container);
  kept.set(key, { sessionId, view });
  return {
    view,
    hide: () => {
      if (kept.get(key)?.view !== view) { view.dispose(); return; }
      if (!usePerchStore.getState().sessions.some((session) => session.id === sessionId)) { forgetTerminal(key); return; }
      view.park();
      const parked = [...kept].filter(([, entry]) => !entry.view.mounted);
      for (const [stale] of parked.slice(0, Math.max(0, parked.length - KEEP))) forgetTerminal(stale);
    },
  };
}
