import { getWorkspaceFileUrl } from "./base";
import { newId } from "./ids";
import { claimSlot, type SlotRender } from "./slots";
import { isRelayMode, relayBlobUrl } from "./relay/transport";
import { usePerchStore } from "./store";
import { workspaceRecord } from "./terminalScope";
import { socket } from "./ws";

/** What a mod gets: the whole app, as in herdr's desktop app. A mod is trusted code that runs inside
 * Perch's own page with the person's full access (no sandbox, no approval), so `store` and `socket`
 * are the real ones. Everything else here is a convenience over them. */
export interface ModApi {
  modId: string;
  store: typeof usePerchStore;
  socket: typeof socket;
  focusSession(sessionId: string): void;
  /** A text file of the open local project. */
  readFile(path: string): Promise<string>;
  /** Every app command a key can run: its id (as in Settings > Keyboard) and what it does. */
  commands(): { id: string; description: string }[];
  /** Runs an app command by id (`tabs.new`, `global.settings`, ...); false for an unknown id. */
  run(command: string): boolean;
  /** Adds a command of the mod's own, id `mod.<modId>.<name>`: it shows in the keyboard help and
   * Settings > Keyboard and `run` can start it. `keys` (e.g. "cmd+shift+y") is its default key,
   * dropped if it is already taken or has no modifier. It goes when the mod is replaced; returns
   * the way to remove it sooner. */
  command(def: { name: string; description: string; keys?: string; run: () => void }): () => void;
  /** Draws one of Perch's own interface parts instead of the stock one (`SLOTS` in `slots.ts`:
   * `toast`, `session-row`). `render(el, {data, actions})` fills `el` and may return a cleanup; it
   * runs again whenever `data` changes. The part keeps its behavior; if the mod throws, the stock
   * one shows. Released when the mod is replaced; returns the way to release it sooner. */
  slot(name: string, render: SlotRender): () => void;
  /** Rebinds a command's key like Settings > Keyboard does (`""` unbinds, `null` restores the
   * default). Throws for a key that is reserved or has no modifier. This is the person's setting:
   * it stays after the mod is gone. */
  bind(command: string, keys: string | null): void;
  /** Shows a notification toast. */
  notify(note: { title: string; body?: string }): void;
  /** A modal over the app: `draw(el, close)` fills it (and may return a cleanup). Esc or clicking
   * outside closes it, as does the mod being replaced. Returns `close`. */
  overlay(draw: (el: HTMLElement, close: () => void) => void | (() => void)): () => void;
}

/** What the app hands mods for `commands`/`run`: App.tsx owns the handlers a command needs. */
export interface CommandBridge {
  list(): { id: string; description: string }[];
  run(command: string): boolean;
  register(id: string, description: string, keys: string | undefined, run: () => void): () => void;
  bind(command: string, keys: string | null): void;
}
let bridge: CommandBridge = { list: () => [], run: () => false, register: () => () => {}, bind: () => {} };
export const setCommandBridge = (next: CommandBridge) => {
  bridge = next;
};

/** A mod's default export: draws into `el` and may return what to undo when it is replaced. */
export type ModMount = (el: HTMLElement, api: ModApi) => void | (() => void) | Promise<void | (() => void)>;

/** Text from the core, through the relay when that is how this page is connected. */
async function fetchText(url: string): Promise<string> {
  const target = isRelayMode() ? await relayBlobUrl(url) : url;
  try {
    const response = await fetch(target, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load it (${response.status}).`);
    return await response.text();
  } finally {
    if (target !== url) URL.revokeObjectURL(target);
  }
}

/** The API for one load of a mod, and `dispose` for what it left open (overlays). */
export function modApi(modId: string): ModApi & { dispose(): void } {
  const open = new Set<() => void>();
  return {
    dispose: () => [...open].forEach((close) => close()),
    commands: () => bridge.list(),
    run: (command) => bridge.run(command),
    bind: (command, keys) => bridge.bind(command, keys),
    slot: (name, render) => {
      const release = claimSlot(name, modId, render);
      const gone = () => { open.delete(gone); release(); };
      open.add(gone);
      return gone;
    },
    command: ({ name, description, keys, run }) => {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw new Error("A command name is letters, digits, - and _.");
      const remove = bridge.register(`mod.${modId}.${name}`, description, keys, run);
      const gone = () => { open.delete(gone); remove(); };
      open.add(gone);
      return gone;
    },
    notify: ({ title, body }) =>
      usePerchStore.setState((s) => ({ toasts: [...s.toasts, { id: newId(), sessionId: `mod:${modId}`, title, body, kind: "usage" as const }] })),
    overlay: (draw) => {
      const shade = document.createElement("div");
      shade.setAttribute("role", "dialog");
      shade.setAttribute("aria-modal", "true");
      shade.setAttribute("data-testid", `mod-api-overlay-${modId}`);
      shade.style.cssText = "position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)";
      const panel = document.createElement("div");
      panel.style.cssText = "max-width:56rem;max-height:90vh;overflow:auto;border-radius:8px;background:var(--panel-bg,#1e1e1e);padding:12px";
      shade.append(panel);
      let cleanup: void | (() => void);
      const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
      function close() {
        if (!open.delete(close)) return;
        document.removeEventListener("keydown", onKey);
        shade.remove();
        cleanup?.();
      }
      shade.addEventListener("mousedown", (event) => { if (event.target === shade) close(); });
      document.addEventListener("keydown", onKey);
      document.body.append(shade);
      open.add(close);
      try { cleanup = draw(panel, close); } catch (error) { close(); throw error; }
      return close;
    },
    modId,
    store: usePerchStore,
    socket,
    focusSession: (sessionId) => usePerchStore.getState().switchSession(sessionId),
    readFile: (path) => {
      const state = usePerchStore.getState();
      const workspaceId = state.activeWorkspaceId;
      if (!workspaceId || workspaceRecord(state, workspaceId)?.hostId !== "local") return Promise.reject(new Error("No local project is open."));
      return fetchText(getWorkspaceFileUrl(workspaceId, path));
    },
  };
}

/** Fetches a mod's code and imports it from a blob, so each edit is a fresh module. Nothing is
 * mounted if it fails to load, which is what lets the caller keep the last good version. */
export async function importMod(src: string): Promise<ModMount> {
  const url = URL.createObjectURL(new Blob([await fetchText(src)], { type: "text/javascript" }));
  try {
    const loaded = (await import(/* @vite-ignore */ url)) as { default?: unknown };
    if (typeof loaded.default !== "function") throw new Error("The mod must export a default function (el, api).");
    return loaded.default as ModMount;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mounts a new version into `host`, and only once it has mounted removes the old one. A version that
 * fails to load or throws leaves the previous one on screen and reports why. */
export function createSwapper(host: HTMLElement, report: (error: string | null) => void, importer: (src: string) => Promise<ModMount> = importMod) {
  let undo: (() => void) | undefined;
  let live = true;
  return {
    /** `done` hears how this load went: `null` when it mounted, else why not. */
    async load(src: string, modId: string, done?: (error: string | null) => void): Promise<void> {
      const next = document.createElement("div");
      next.style.cssText = "display:none;height:100%;width:100%";
      host.append(next);
      try {
        const api = modApi(modId);
        const mount = await importer(src);
        let cleanup: void | (() => void);
        try { cleanup = await mount(next, api); } catch (error) { api.dispose(); throw error; }
        const undoThis = () => { cleanup?.(); api.dispose(); };
        if (!live) { undoThis(); next.remove(); return; }
        const previous = undo;
        undo = undoThis;
        for (const child of [...host.children]) if (child !== next) child.remove();
        next.style.display = "";
        previous?.();
        report(null);
        done?.(null);
      } catch (error) {
        next.remove();
        const text = error instanceof Error ? error.message : String(error);
        report(text);
        done?.(text);
      }
    },
    stop() {
      live = false;
      undo?.();
      undo = undefined;
    },
  };
}
