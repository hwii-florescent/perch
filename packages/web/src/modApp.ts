import { getWorkspaceFileUrl } from "./base";
import { newId } from "./ids";
import type { SessionSummary } from "@perch/shared";
import { claimSlot, type SlotRender } from "./slots";
import { exec, getShared, listDir, onShared, readTextFile, setShared, statFile, watchPath, writeTextFile, type ExecResult, type FileStat } from "./modHost";
import { modUi } from "./modUi";
import type { WorkspaceProject, WorkspaceRecord } from "./store";
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
  /** Every app command: its id (as in Settings > Keyboard), what it does and, for those that take
   * arguments, what they are. */
  commands(): { id: string; description: string; args?: string }[];
  /** Runs an app command by id (`tabs.new`, `global.settings`, `session.open` with `{id}`, ...);
   * false for an unknown id. */
  run(command: string, args?: unknown): boolean;
  /** Adds a command of the mod's own, id `mod.<modId>.<name>`: it shows in the keyboard help and
   * Settings > Keyboard and `run(id, args)` can start it (`run` receives the args). `keys` (e.g.
   * "cmd+shift+y") is its default key, dropped if it is already taken or has no modifier. It goes
   * when the mod is replaced; returns the way to remove it sooner. */
  command(def: { name: string; description: string; keys?: string; run: (args?: unknown) => void }): () => void;
  /** Runs a program on this computer (`timeout` ms, default 30 s; output past 1 MiB is cut). A
   * nonzero `code` is a result; it rejects if the program cannot start or runs out of time. */
  exec(cmd: string, args?: string[], options?: { cwd?: string; timeout?: number }): Promise<ExecResult>;
  /** Files anywhere on this computer by absolute or `~/` path (reads stop at 5 MiB). */
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, text: string): Promise<void>;
  statFile(path: string): Promise<FileStat>;
  listDir(path: string): Promise<{ name: string; isDir: boolean }[]>;
  /** Calls `changed` when a file or folder's size or modified time changes (polled every 2 s). */
  watch(path: string, changed: () => void): () => void;
  /** State every mod sees, kept across reloads on this screen: `shared(key)`, `setShared(key,
   * value)` (JSON values; `undefined` removes) and `onShared(fn)` for changes. */
  shared(key: string): unknown;
  setShared(key: string, value: unknown): void;
  onShared(watch: (key: string, value: unknown) => void): () => void;
  /** Perch's own data, as plain objects: the sessions, projects and workspaces, and what is focused.
   * `subscribe` calls `changed` after any of it changes. */
  sessions(): SessionSummary[];
  projects(): WorkspaceProject[];
  workspaces(): WorkspaceRecord[];
  focused(): { sessionId: string | null; projectId: string | null; workspaceId: string | null };
  subscribe(changed: () => void): () => void;
  /** Draws one of Perch's own interface parts instead of the stock one (`SLOTS` in `slots.ts`:
   * `toast`, `session-row`). `render(el, {data, actions})` fills `el` and may return a cleanup; it
   * runs again whenever `data` changes. The part keeps its behavior; if the mod throws, the stock
   * one shows. Released when the mod is replaced; returns the way to release it sooner. */
  slot(name: string, render: SlotRender): () => void;
  /** Rebinds a command's key like Settings > Keyboard does (`""` unbinds, `null` restores the
   * default). Throws for a key that is reserved or has no modifier. This is the person's setting:
   * it stays after the mod is gone. */
  bind(command: string, keys: string | null): void;
  /** Shows a notification toast. `level` colors it; `action` runs a command when it is clicked. */
  notify(note: { title: string; body?: string; level?: "info" | "warning" | "error"; action?: { command: string; args?: unknown } }): void;
  /** A modal over the app: `draw(el, close)` fills it (and may return a cleanup). Esc or clicking
   * outside closes it, as does the mod being replaced. Returns `close`. */
  overlay(draw: Draw): () => void;
  /** A small panel next to an element (or a `{x, y}` point), kept on screen; Esc or a click
   * elsewhere closes it. Returns `close`. */
  popup(anchor: HTMLElement | { x: number; y: number }, draw: Draw): () => void;
  /** A window that stays until closed, under modals and over the app: drag it by its title bar. A
   * `key` remembers where it was put and replaces an open window with the same key. */
  window(options: { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number } }, draw: Draw): () => void;
}
type Draw = (el: HTMLElement, close: () => void) => void | (() => void);

/** What the app hands mods for `commands`/`run`: App.tsx owns the handlers a command needs. */
export interface CommandBridge {
  list(): { id: string; description: string; args?: string }[];
  run(command: string, args?: unknown): boolean;
  register(id: string, description: string, keys: string | undefined, run: (args?: unknown) => void): () => void;
  bind(command: string, keys: string | null): void;
}
let bridge: CommandBridge = { list: () => [], run: () => false, register: () => () => {}, bind: () => {} };
export const setCommandBridge = (next: CommandBridge) => {
  bridge = next;
};
/** For the app's own parts that run a command by name (a toast's action). */
export const runCommand = (command: string, args?: unknown) => bridge.run(command, args);
/** Every command a key, a mod or `perch mod do` can run. */
export const commandList = () => bridge.list();

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
  /** Things the mod started that its replacement must stop (watchers, subscriptions). */
  const track = (stop: () => void) => {
    const gone = () => { open.delete(gone); stop(); };
    open.add(gone);
    return gone;
  };
  return {
    dispose: () => [...open].forEach((close) => close()),
    commands: () => bridge.list(),
    run: (command, args) => bridge.run(command, args),
    exec,
    readTextFile,
    writeTextFile,
    statFile,
    listDir,
    watch: (path, changed) => track(watchPath(path, changed)),
    shared: getShared,
    setShared,
    onShared: (watch) => track(onShared(watch)),
    sessions: () => usePerchStore.getState().sessions,
    projects: () => usePerchStore.getState().workspaceProjects,
    workspaces: () => usePerchStore.getState().workspaces,
    focused: () => {
      const s = usePerchStore.getState();
      return { sessionId: s.sessionId, projectId: s.activeProjectId, workspaceId: s.activeWorkspaceId };
    },
    subscribe: (changed) => track(usePerchStore.subscribe(changed)),
    ...modUi(modId, open),
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
    notify: ({ title, body, level, action }) =>
      usePerchStore.setState((s) => ({ toasts: [...s.toasts, { id: newId(), sessionId: `mod:${modId}`, title, body, level, action, kind: "usage" as const }] })),
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
