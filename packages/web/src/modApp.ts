import { getWorkspaceFileUrl } from "./base";
import { newId } from "./ids";
import type { SessionSummary } from "@perch/shared";
import { claimSlot, type SlotRender } from "./slots";
import { prefersDark } from "./themes";
import { zoomFactor } from "./zoom";
import { nodeIds, shownLayout } from "./layoutState";
import { playBlockedTone, playDoneTone } from "./sound";
import { currentPrograms, programFor, programTable } from "./programs";
import { exec, getShared, listDir, onShared, readTextFile, setShared, statFile, watchPath, writeTextFile, type ExecResult, type FileStat, type OnHost } from "./modHost";
import { modUi } from "./modUi";
import type { WorkspaceProject, WorkspaceRecord } from "./store";
import { isRelayMode, relayBlobUrl } from "./relay/transport";
import { usePerchStore } from "./store";
import { workspaceRecord } from "./terminalScope";
import { sessionDotState } from "./statusDot";
import { socket } from "./ws";

/** Colors by name plus which appearance is on. */
export type ModTheme = { [color: string]: string | boolean; dark: boolean };

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
  command(def: { name: string; description: string; keys?: string; run?: (args?: unknown) => void }): () => void;
  /** Resolves with the next `{name, args}` of a command this mod registered without `run` (herdr's `nextCommand()`): `for (;;) { const c = await api.nextCommand(); … }`. Rejects when the mod is replaced. */
  nextCommand(): Promise<{ name: string; args?: unknown }>;
  /** Runs a program on this computer (`timeout` ms, default 30 s; output past 1 MiB is cut). A
   * nonzero `code` is a result; it rejects if the program cannot start or runs out of time. */
  exec(cmd: string, args?: string[], options?: { cwd?: string; timeout?: number; host?: string }): Promise<ExecResult>;
  /** Runs Perch's own `perch` command line (what herdr's `hc(args)` is to herdr-core): `perch(["ps"])`. Same results as `exec`. */
  perch(args?: string[], options?: { cwd?: string; timeout?: number }): Promise<ExecResult>;
  /** Files anywhere on this computer by absolute or `~/` path (reads stop at 5 MiB). */
  readTextFile(path: string, on?: OnHost): Promise<string>;
  writeTextFile(path: string, text: string, on?: OnHost & { expected?: string | null }): Promise<void>;
  statFile(path: string, on?: OnHost): Promise<FileStat>;
  listDir(path: string, on?: OnHost): Promise<{ name: string; isDir: boolean }[]>;
  /** Calls `changed` when a file or folder's size or modified time changes (polled every 2 s). */
  watch(path: string, changed: () => void, on?: OnHost): () => void;
  /** Resolves with the paths that changed in `dir` (its entries, one level down; polled every 2 s) the next time any does: loop `for (;;) { await api.watchFolder(dir); refresh(); }`. Rejects when the mod is replaced. */
  watchFolder(dir: string, on?: OnHost): Promise<string[]>;
  /** A folder chooser: the system's picker in the desktop app (for this computer), else Perch's own over `listDir`: resolves with the chosen folder, or null if closed. Starts at `start` or the home folder. */
  pickFolder(options?: { prompt?: string; start?: string; host?: string }): Promise<string | null>;
  /** The agents a computer can start (Settings > Agents): `{id, name, installed, isDefault}`. Start one with `store.getState().createSessionOnHost(host, cwd, id)`. */
  knownAgents(on?: OnHost): Promise<{ id: string; name: string; installed: boolean; isDefault: boolean; run?: string[] }[]>;
  /** The program table (built-ins changed or added to by `programs.json`): `{id, name, tile, color?, icon?, tint?, match?, run?}`. */
  programs(): { id: string; name: string; tile: string; color?: string; icon?: string; tint?: boolean; match?: string[]; run?: string[] }[];
  /** What a command line is: `program("npx vitest run")` is Vitest, `["node", "x/vite.js"]` Vite, a shell is `shell`, else `program`. */
  program(command: string | string[]): { id: string; name: string; tile: string; color?: string; icon?: string; tint?: boolean };
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
  /** The computers in Settings > Hosts; an `id` goes in `exec`/file calls as `host`. */
  hosts(): { id: string; name: string; enabled: boolean }[];
  focused(): { sessionId: string | null; projectId: string | null; workspaceId: string | null };
  /** The sessions that run an agent (not a plain terminal), with their status. */
  agents(): { id: string; title: string; provider: string; status: "working" | "idle" | "blocked" | "done"; workspaceId?: string; hostId: string; focused: boolean }[];
  /** The sessions that are plain terminals. */
  terminals(): { id: string; title: string; cwd: string; workspaceId?: string; hostId: string; focused: boolean }[];
  /** What the tab on screen shows: its tiles when split, else the one tab. `kind` is session, file, review, browser or mod. */
  panes(): { id: string; kind: string; title: string; mod?: string; focused: boolean }[];
  /** The last `lines` lines (default 50) of a terminal's text, screen and scrollback: `id` is a session id or a terminal id, and it must be on screen (herdr's `hc read`). */
  readTerminal(id: string, lines?: number): string;
  /** Types `text` into a terminal like the person would (add "\r" for Enter): herdr's `hc send`. Throws if there is no such terminal. */
  sendText(id: string, text: string): void;
  /** This computer (id "local") and the computers in Settings > Hosts, with whether they can be reached now. */
  machines(): { id: string; name: string; state: "ready" | "loading" | "unavailable" }[];
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
  notify(note: { title: string; body?: string; level?: "info" | "warning" | "error"; action?: { command: string; args?: unknown }; icon?: string; timeout?: number }): void;
  /** The props the layout gave this copy (`{"type":"block","content":"mod:id","props":{...}}`); `{}` when none. */
  props(): Record<string, unknown>;
  /** The colors in use, by name: background, canvas, surface, raised, border, dim, foreground, muted, accent, working, blocked, done, idle, unknown and the palette (green, yellow, red, blue, teal, peach, mauve); `dark` says which appearance. */
  theme(): ModTheme;
  /** The settings the person chose, plus `dark` (the appearance now) and `zoom` (1 = 100%). */
  settings(): Record<string, unknown>;
  /** Every key binding in force: the command and its keys as shown in Settings > Keyboard. */
  keys(): { command: string; keys: string }[];
  /** The id of the layout shown (null: Perch as shipped), and the ids of the layouts that load. */
  layout(): string | null;
  layouts(): string[];
  /** The computer's home folder, and the folder that holds `mods/`, `layouts/` and `themes/`. */
  home(): string;
  appHome(): string;
  /** Where this copy floats (`{edge, align, vertical, dragging}`), null unless a layout floats its block. */
  placement(): { edge: string; align: string; vertical: boolean; dragging: boolean } | null;
  /** Plays Perch's own tone for a finished (`"done"`) or blocked (`"blocked"`) session. */
  playSound(name: "done" | "blocked"): void;
  /** A modal over the app: `draw(el, close)` fills it (and may return a cleanup). Esc or clicking
   * outside closes it, as does the mod being replaced. Returns `close`. */
  overlay(draw: Draw): () => void;
  /** A small panel next to an element (or a `{x, y}` point), kept on screen; Esc or a click
   * elsewhere closes it. Returns `close`. */
  popup(anchor: HTMLElement | { x: number; y: number }, draw: Draw): () => void;
  /** A window that stays until closed, under modals and over the app: drag it by its title bar. A
   * `key` remembers where it was put and replaces an open window with the same key. */
  window(options: { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number }; frame?: "none" }, draw: Draw): () => void;
  /** A picture of the app as a PNG data URL: the OS's own capture of the window in the desktop app, else drawn from the page (terminal canvases are copied, web fonts fall back). */
  screenshot(): Promise<string>;
  /** Calls `frame(ms)` (milliseconds since the loop began) before each repaint, at most `fps` times a
   * second (default 60), and pauses while the page is hidden: for motion. Stops when the mod is
   * replaced, or call the returned function. */
  loop(frame: (ms: number) => void, options?: { fps?: number }): () => void;
  /** Steps through `list` every `every` ms (a spinner: ["⠋", "⠙", …], 90), calling `show(item, index)` when it changes; returns the way to stop. */
  frames<T>(list: T[], every: number, show: (item: T, index: number) => void): () => void;
}
type Draw = (el: HTMLElement, close: () => void) => void | (() => void);

/** What the app hands mods for `commands`/`run`: App.tsx owns the handlers a command needs. */
export interface CommandBridge {
  list(): { id: string; description: string; args?: string }[];
  run(command: string, args?: unknown): boolean;
  register(id: string, description: string, keys: string | undefined, run: (args?: unknown) => void): () => void;
  bind(command: string, keys: string | null): void;
  keys?(): { command: string; keys: string }[];
}
let bridge: CommandBridge = { list: () => [], run: () => false, register: () => () => {}, bind: () => {} };
export const setCommandBridge = (next: CommandBridge) => {
  bridge = next;
};
/** For the app's own parts that run a command by name (a toast's action). */
export const runCommand = (command: string, args?: unknown) => bridge.run(command, args);
/** Rebinds a command's key as the person's setting (`key.bind`). */
export const bindKey = (command: string, keys: string | null) => bridge.bind(command, keys);
/** Every command a key, a mod or `perch mod do` can run. */
export const commandList = () => bridge.list();

/** Which layout is shown and which load; `mods.ts` sets it as the core reports (this file cannot import it). */
let layoutInfo: { layout: string | null; layouts: string[]; home: string; folder: string } = { layout: null, layouts: [], home: "", folder: "" };
export const setLayoutInfo = (next: typeof layoutInfo) => { layoutInfo = next; };

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

/** The colors in use, by name (herdr's `theme()`): read from the page's custom properties so a layout's look,
 * a theme file and the person's theme all show. */
function theme(): ModTheme {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const named: Record<string, string> = {
    background: "--panel-bg", canvas: "--surface-dim", chrome: "--panel-bg", surface: "--surface-0", popover: "--surface-0", raised: "--surface-1",
    hover: "--surface-1", selected: "--surface-1", border: "--overlay-0", input: "--overlay-1", dim: "--overlay-1", foreground: "--text", muted: "--subtext-0",
    accent: "--accent", mauve: "--mauve", green: "--green", yellow: "--yellow", red: "--red", blue: "--blue", teal: "--teal", peach: "--peach",
    working: "--yellow", blocked: "--red", done: "--teal", idle: "--green", unknown: "--overlay-1",
  };
  const out: Record<string, string> = {};
  for (const [name, variable] of Object.entries(named)) out[name] = read(variable);
  return { ...out, dark: css.getPropertyValue("color-scheme").includes("dark") || (!css.getPropertyValue("color-scheme") && prefersDark()) };
}

/** The API for one load of a mod, and `dispose` for what it left open (overlays). */
// Read when used, not at import: links.ts (the usual home of this) pulls in the whole store.
const tauriInternals = () => (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;

export function modApi(modId: string, given: Record<string, unknown> = {}): ModApi & { dispose(): void } {
  const open = new Set<() => void>();
  const ui = modUi(modId, open);
  let waiting: ((value: { name: string; args?: unknown }) => void)[] = [];
  const queued: { name: string; args?: unknown }[] = [];
  /** Things the mod started that its replacement must stop (watchers, subscriptions). */
  const track = (stop: () => void) => {
    const gone = () => { open.delete(gone); stop(); };
    open.add(gone);
    return gone;
  };
  const loop: ModApi["loop"] = (frame, { fps = 60 } = {}) => {
      let id = 0, last = -Infinity, begin = -1, stopped = false;
      const step = (now: number) => {
        if (stopped) return;
        id = requestAnimationFrame(step);
        if (begin < 0) begin = now;
        if (now - last < 1000 / Math.max(1, Math.min(fps, 120)) - 1) return;
        last = now;
        try { frame(now - begin); } catch (error) { console.error("a mod's loop threw", error); stopped = true; cancelAnimationFrame(id); }
      };
      id = requestAnimationFrame(step);
      return track(() => { stopped = true; cancelAnimationFrame(id); });
    };
  return {
    dispose: () => [...open].forEach((close) => close()),
    commands: () => bridge.list(),
    run: (command, args) => bridge.run(command, args),
    exec,
    perch: (args, options) => exec("perch", args, options),
    readTextFile,
    writeTextFile,
    statFile,
    listDir,
    // The desktop app asks the OS's own web view for the picture; the browser draws the page itself.
    screenshot: () => tauriInternals()
      ? (tauriInternals()!.invoke("capture_window") as Promise<string>).catch(() => import("./shot").then(({ screenshot }) => screenshot()))
      : import("./shot").then(({ screenshot }) => screenshot()),
    loop,
    frames: (list, every, show) => {
      let shown = -1;
      return loop((ms) => {
        const at = Math.floor(ms / Math.max(16, every)) % Math.max(1, list.length);
        if (at !== shown) { shown = at; show(list[at]!, at); }
      }, { fps: Math.min(60, 1000 / Math.max(16, every)) });
    },
    watch: (path, changed, on) => track(watchPath(path, changed, 2000, on)),
    watchFolder: (dir, on) => new Promise<string[]>((resolve, reject) => {
      const base = dir.replace(/\/$/, "");
      let seen: Map<string, number> | undefined;
      const entry = { stop: () => { clearInterval(timer); open.delete(entry.stop); reject(new Error("the mod was replaced")); } };
      const scan = async () => {
        const now = new Map<string, number>();
        for (const item of (await listDir(dir, on)).slice(0, 200)) now.set(item.name, (await statFile(`${base}/${item.name}`, on).catch(() => ({ modified: 0 }))).modified ?? 0);
        const before = seen;
        seen = now;
        if (!before) return;
        const changed = [...new Set([...now.keys(), ...before.keys()])].filter((name) => now.get(name) !== before.get(name)).map((name) => `${base}/${name}`);
        if (changed.length) { clearInterval(timer); open.delete(entry.stop); resolve(changed); }
      };
      const timer = setInterval(() => void scan().catch(() => {}), 2000);
      void scan().catch(() => {});
      open.add(entry.stop);
    }),
    pickFolder: ({ prompt = "Choose a folder", start, host } = {}) => !host && tauriInternals()
      // The desktop app is on this computer: use the system's own picker (the same one Add project uses).
      ? tauriInternals()!.invoke("plugin:dialog|open", { options: { directory: true, title: prompt, ...(start ? { defaultPath: start } : {}) } }).then((picked: unknown) => (typeof picked === "string" ? picked : null))
      : new Promise<string | null>((resolve) => {
      let closeIt = () => {};
      const finish = (folder: string | null) => { resolve(folder); closeIt(); };
      closeIt = ui.overlay((box, close) => {
        const on = { host };
        let here = start ?? (host ? "~" : layoutInfo.home || "~");
        const title = document.createElement("div");
        const list = document.createElement("div");
        const choose = document.createElement("button");
        title.textContent = prompt;
        title.style.cssText = "font-weight:600;margin-bottom:6px";
        list.style.cssText = "max-height:50vh;overflow:auto;min-width:22rem;margin:6px 0";
        choose.textContent = "Choose this folder";
        const show = async (path: string) => {
          here = path.replace(/(.)\/+$/, "$1");
          list.textContent = "";
          const row = (label: string, to: string) => {
            const b = document.createElement("button");
            b.textContent = label;
            b.style.cssText = "display:block;width:100%;text-align:left;padding:3px 6px;background:none;border:0;color:inherit;cursor:pointer";
            b.onclick = () => void show(to);
            list.append(b);
          };
          if (here !== "/" && here !== "~") row("../", here.lastIndexOf("/") > 0 ? here.slice(0, here.lastIndexOf("/")) : here.startsWith("/") ? "/" : "~");
          try { for (const item of (await listDir(here, on)).filter((entry) => entry.isDir).sort((a, b) => a.name.localeCompare(b.name))) row(`${item.name.replace(/\/$/, "")}/`, `${here}/${item.name.replace(/\/$/, "")}`); } catch (error) { list.textContent = String(error instanceof Error ? error.message : error); }
          title.textContent = `${prompt}: ${here}`;
        };
        choose.onclick = () => finish(here);
        box.append(title, list, choose);
        void show(here);
        return () => resolve(null);
      });
    }),
    programs: () => programTable(currentPrograms()),
    program: (command) => programFor(command, currentPrograms()),
    knownAgents: async (on) => {
      const host = on?.host ?? "local";
      const read = () => usePerchStore.getState().agentManifestsByHost[host]?.manifests;
      if (!read()) {
        usePerchStore.getState().fetchAgentManifests(host);
        await new Promise<void>((done) => { const stop = usePerchStore.subscribe(() => { if (read()) { stop(); clearTimeout(timer); done(); } }); const timer = setTimeout(() => { stop(); done(); }, 5000); });
      }
      const found = (read() ?? []).filter((m) => m.enabled !== false && m.supportedModes.includes("cli")).map((m) => ({ id: m.id, name: m.displayName, installed: m.available, isDefault: m.isDefault === true } as { id: string; name: string; installed: boolean; isDefault: boolean; run?: string[] }));
      // programs.json entries with a `run` are agents a menu can start; installed means the program is on that computer's login PATH.
      for (const entry of programTable(currentPrograms()).filter((p) => p.run?.length && !found.some((m) => m.id === p.id))) {
        const probe = await exec("sh", ["-lc", `command -v '${entry.run![0]!.replace(/'/g, "'\\''")}'`], on).catch(() => null);
        found.push({ id: entry.id, name: entry.name, installed: probe?.code === 0, isDefault: false, run: entry.run });
      }
      return found;
    },
    shared: getShared,
    setShared,
    onShared: (watch) => track(onShared(watch)),
    sessions: () => usePerchStore.getState().sessions,
    projects: () => usePerchStore.getState().workspaceProjects,
    workspaces: () => usePerchStore.getState().workspaces,
    hosts: () => {
      const { hosts, fetchHosts } = usePerchStore.getState();
      if (!hosts.length) fetchHosts(); // the list is only loaded once Settings has been opened
      return hosts.map(({ id, name, enabled }) => ({ id, name, enabled }));
    },
    agents: () => usePerchStore.getState().sessions.filter((s) => s.cliProviderId !== "terminal").map((s) => ({ id: s.id, title: s.title, provider: s.cliProviderId ?? "", status: sessionDotState(s) as "working" | "idle" | "blocked" | "done", workspaceId: s.workspaceId, hostId: s.hostId ?? "local", focused: s.id === usePerchStore.getState().sessionId })),
    terminals: () => usePerchStore.getState().sessions.filter((s) => s.cliProviderId === "terminal").map((s) => ({ id: s.id, title: s.title, cwd: s.cwd, workspaceId: s.workspaceId, hostId: s.hostId ?? "local", focused: s.id === usePerchStore.getState().sessionId })),
    panes: () => panesOnScreen(),
    readTerminal: (id, lines) => {
      const text = terminalText(terminalElement(id), lines);
      if (text === null) throw new Error(`Terminal ${id} is not on screen.`);
      return text;
    },
    sendText: (id, text) => {
      const terminalId = terminalElement(id).getAttribute("data-terminal-id");
      if (!terminalId) throw new Error(`No terminal ${id}.`);
      usePerchStore.getState().sendTerminalInput(terminalId, text);
    },
    machines: () => {
      const s = usePerchStore.getState();
      return [
        { id: "local", name: "This computer", state: s.connected ? "ready" : "unavailable" } as const,
        ...s.hosts.filter((host) => host.enabled).map((host) => ({ id: host.id, name: host.name, state: ({ connected: "ready", connecting: "loading" } as const)[s.hostStates[host.id]?.state as "connected"] ?? "unavailable" })),
      ];
    },
    focused: () => {
      const s = usePerchStore.getState();
      return { sessionId: s.sessionId, projectId: s.activeProjectId, workspaceId: s.activeWorkspaceId };
    },
    subscribe: (changed) => track(usePerchStore.subscribe(changed)),
    ...ui,
    bind: (command, keys) => bridge.bind(command, keys),
    slot: (name, render) => {
      const release = claimSlot(name, modId, render);
      const gone = () => { open.delete(gone); release(); };
      open.add(gone);
      return gone;
    },
    nextCommand: () => new Promise((resolve, reject) => {
      if (queued.length) return resolve(queued.shift()!);
      const waiter = (value: { name: string; args?: unknown }) => { open.delete(stop); resolve(value); };
      const stop = () => { open.delete(stop); waiting = waiting.filter((w) => w !== waiter); reject(new Error("the mod was replaced")); };
      waiting.push(waiter);
      open.add(stop);
    }),
    command: ({ name, description, keys, run }) => {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw new Error("A command name is letters, digits, - and _.");
      // Without `run` the command is queued for nextCommand().
      const handler = run ?? ((args?: unknown) => { const next = { name, args }; const w = waiting.shift(); if (w) w(next); else queued.push(next); });
      const remove = bridge.register(`mod.${modId}.${name}`, description, keys, handler);
      const gone = () => { open.delete(gone); remove(); };
      open.add(gone);
      return gone;
    },
    notify: ({ title, body, level, action, icon, timeout }) =>
      usePerchStore.setState((s) => ({ toasts: [...s.toasts, { id: newId(), sessionId: `mod:${modId}`, title, body, level, action, icon, timeout: timeout === undefined ? undefined : Math.min(60_000, Math.max(1000, timeout)), kind: "usage" as const }] })),
    props: () => structuredClone(given),
    theme,
    settings: () => ({ ...usePerchStore.getState().settings, dark: theme().dark, zoom: zoomFactor() }),
    keys: () => bridge.keys?.() ?? [],
    layout: () => layoutInfo.layout,
    layouts: () => [...layoutInfo.layouts],
    home: () => layoutInfo.home,
    appHome: () => layoutInfo.folder.replace(/[\\/]mods[\\/]?$/, ""),
    placement: () => {
      const shown = shownLayout();
      const node = shown && [...nodeIds(shown).values()].find((n) => n.float && n.type === "block" && n.content === `mod:${modId}`);
      return node?.id ? ((getShared(`layout.float.${node.id}`) as { edge: string; align: string; vertical: boolean; dragging: boolean } | undefined) ?? null) : null;
    },
    playSound: (name) => { if (name === "done") playDoneTone(); else if (name === "blocked") playBlockedTone(); else throw new Error('playSound takes "done" or "blocked".'); },
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
// The tab strip pulls in the whole file store, so the canvas code hands this in (modCommands) instead of modApp importing it.
let panesOnScreen: () => ReturnType<ModApi["panes"]> = () => [];
// xtermSetup pulls in the file store too, so the canvas code hands the reader over (modCommands).
let terminalText: (root: Element, lines?: number) => string | null = () => null;
export const setTerminalReader = (reader: typeof terminalText) => { terminalText = reader; };
/** The element of a terminal on screen, by its terminal id or its session's (a persistent terminal names both). */
const terminalElement = (id: string): Element => {
  const terminalId = usePerchStore.getState().cliTerminalIds[id] ?? id;
  const quoted = CSS.escape(terminalId);
  return document.querySelector(`[data-terminal-id="${quoted}"], [data-session-id="${quoted}"][data-terminal-id]`) ?? document.createElement("div");
};
export const setPanesSource = (source: typeof panesOnScreen) => { panesOnScreen = source; };

export function createSwapper(host: HTMLElement, report: (error: string | null) => void, importer: (src: string) => Promise<ModMount> = importMod) {
  let undo: (() => void) | undefined;
  let live = true;
  return {
    /** `done` hears how this load went: `null` when it mounted, else why not. */
    async load(src: string, modId: string, done?: (error: string | null) => void, props: Record<string, unknown> = {}): Promise<void> {
      const next = document.createElement("div");
      next.style.cssText = "display:none;height:100%;width:100%";
      host.append(next);
      try {
        const api = modApi(modId, props);
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
