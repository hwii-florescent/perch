// Types for a Perch mod (`perch mod api` prints this file). A mod is `mods/<id>/main.js`, an ES
// module whose default export is `(el, api) => cleanup?`: draw into `el` with plain DOM; `api` is
// below. A mod runs inside Perch's own page with the person's full access, so a bug in it can break
// the page (ctrl+alt+shift+Escape turns every mod off). Run `perch mod check <id>` after each edit.

export default function mod(el: HTMLElement, api: ModApi): void | (() => void) | Promise<void | (() => void)>;

type Draw = (el: HTMLElement, close: () => void) => void | (() => void);
/** Layout content for an overlay, popup or window (see "Floating surfaces"); `width`/`height` size an overlay or popup (px). */
type SurfaceLayout = { layout: LayoutNode; width?: number; height?: number };
/** A layout node: the window layout's shape (layouts/*.json), without its looks. */
type LayoutNode =
  | { type: "row" | "column"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; gap?: number; children: LayoutNode[] }
  | { type: "stack"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; active?: string; header?: "tabs"; children: LayoutNode[] }
  | { type: "block"; id?: string; title?: string; hidden?: boolean; size?: { px?: number; weight?: number; min?: number; max?: number }; content: string; props?: Record<string, unknown> };
/** One node of `layoutTree()`. */
type LayoutTreeNode = { path: string; id?: string; type: "row" | "column" | "block" | "stack"; content?: string; title?: string; hidden: boolean; active?: string; children?: LayoutTreeNode[] };

interface ModApi {
  modId: string;

  // The app itself
  /** Perch's own zustand store: `getState()` has sessions, workspaces and the rest. */
  store: { getState(): any; subscribe(listener: () => void): () => void; setState(patch: any): void };
  /** The app's client: send any message, `onMessage(handler)`. */
  socket: any;
  focusSession(sessionId: string): void;

  // Data, as plain objects
  sessions(): { id: string; title: string; cwd: string; status: "running" | "idle"; blocked?: boolean; unseen?: boolean; createdAt: number; currentBranch?: string; projectId?: string; workspaceId?: string }[];
  projects(): { id: string; name: string }[];
  /** The computers in Settings > Hosts. */
  hosts(): { id: string; name: string; enabled: boolean }[];
  workspaces(): { id: string; projectId: string; state: string }[];
  focused(): { sessionId: string | null; projectId: string | null; workspaceId: string | null };
  /** The sessions that run an agent (not a plain terminal), with their status. */
  agents(): { id: string; title: string; provider: string; status: "working" | "idle" | "blocked" | "done"; workspaceId?: string; hostId: string; focused: boolean; pinned: boolean; order: number | null }[];
  /** Make `agent.next` and `agent.prev` walk the agents in this order (session ids), as a mod's own list shows them. Kept on this device (the same order as `terminal.order`, reported as `order` in the SDK's terminal records): agents left out follow in the app's order, unknown ids are ignored; an empty list goes back to the app's order. */
  setAgentOrder(ids: string[]): void;
  /** Every theme `app.theme` can use (the shipped ones, then your themes/*.json): its name, whether it is light, and its colors. */
  themes(): { name: string; light: boolean; colors: Record<string, string> }[];
  /** The sessions that are plain terminals. */
  terminals(): { id: string; title: string; cwd: string; workspaceId?: string; hostId: string; focused: boolean; pinned: boolean; order: number | null }[];
  /** What the tab on screen shows: its tiles when split, else the one tab. `kind` is session, file, review, browser or mod. */
  panes(): { id: string; kind: string; title: string; mod?: string; focused: boolean }[];
  /** Every session's terminal, agents and sub-sessions included, shown or not, on every computer this page knows. `target` (`<host>/<session>`) names it to readTerminal/sendText; `state` is what this page knows (`unknown` is no evidence, never "exited"; `host-unavailable` is a computer it cannot reach now). */
  terminalRecords(): { target: string; hostId: string; sessionId: string; kind: "agent" | "terminal"; provider: string; title: string; cwd: string; workspaceId?: string; parentSessionId?: string; terminalId: string | null; shown: boolean; open: boolean; pinned: boolean; order: number | null; focused: boolean; state: "running" | "exited" | "unknown" | "host-unavailable" }[];
  /** The shown layout as a tree, the person's hides and stack choices applied: each node's `path` (child indexes, "" for the root), `id`, `type`, a block's `content`, `title`, `hidden`, a stack's shown child `active`, and `children`. `root` is null for Perch as shipped. */
  layoutTree(): { name: string | null; root: LayoutTreeNode | null };
  /** What has focus, host-qualified: the host, workspace and session, the focused session's terminal on this page, and the panes on screen. */
  focus(): { hostId: string; workspaceId: string | null; sessionId: string | null; terminalId: string | null; panes: { id: string; kind: string; title: string; mod?: string; focused: boolean }[] };
  /** The last `lines` lines (default 50) of a terminal's text, screen and scrollback (herdr's `hc read`): `id` is a `<host>/<session>` target, a session id or a terminal id. It need not be on screen (a terminal this page keeps off screen reads too); it throws, saying why, for one this page has not opened or a bare id two computers share. */
  readTerminal(id: string, lines?: number): string;
  /** readTerminal, also for a terminal this page never opened: then the core reads the terminal daemon's own screen (opening, starting and resizing nothing). A session on another computer this page has not opened, or a read over the relay, rejects saying so. */
  fetchTerminal(id: string, lines?: number): Promise<string>;
  /** This mod's durable data, kept by the core in mod-data/<id> outside the mod's folder: it survives reloads, restarts and edits, a clone starts without it, removing the mod keeps it. Keys are 1-120 of letters, digits, . - _; a value is at most 1 MiB of JSON; at most 1000 keys. `expected` (a revision, or null for "must not exist") makes a write or remove reject with `code: "conflict"` (and the current `revision`) instead of overwriting; a file that is not JSON rejects reads with `code: "corrupt"` until written with its revision. */
  data: {
    read<T = unknown>(key: string): Promise<{ value: T; revision: string } | null>;
    write(key: string, value: unknown, options?: { expected?: string | null }): Promise<string>;
    remove(key: string, options?: { expected?: string | null }): Promise<boolean>;
    list(): Promise<{ key: string; revision: string; size: number }[]>;
    /** Calls `changed` with every key when any revision changes (a write from this page at once, others within `every` ms, default 2000). Stopped with the mod. */
    watch(changed: (entries: { key: string; revision: string; size: number }[]) => void, every?: number): () => void;
  };
  /** Types `text` into a terminal like the person would (add "\r" for Enter): herdr's `hc send`. Same targets as readTerminal, on screen or not. Throws if there is no such terminal open on this page. */
  sendText(id: string, text: string): void;
  /** This computer (id "local") and the computers in Settings > Hosts, with whether they can be reached now. */
  machines(): { id: string; name: string; state: "ready" | "loading" | "unavailable" }[];
  /** Calls `changed` after any of that changes. Returns the way to stop. */
  subscribe(changed: () => void): () => void;

  // Commands and keys
  /** Every app command: its id (as in Settings > Keyboard), what it does, and its arguments if any. */
  commands(): { id: string; description: string; args?: string; keys?: string; conflict?: string }[];
  /** Runs a command like its key does; `session.open`, `session.close`, `project.focus` and `workspace.focus` take `{id}`. False for an unknown id. */
  run(command: string, args?: unknown): boolean;
  /** Adds `mod.<modId>.<name>` to the keyboard help and Settings > Keyboard. `keys` ("mod+shift+y") is its default key, dropped if taken or without a modifier: then `commands()` gives the command a `conflict` (why) and no `keys`, and Settings > Keyboard shows the same under Package commands. */
  command(def: { name: string; description: string; keys?: string; run?: (args?: unknown) => void }): () => void;
  /** Resolves with the next `{name, args}` of a command this mod registered without `run` (herdr's `nextCommand()`): `for (;;) { const c = await api.nextCommand(); … }`. Rejects when the mod is replaced. */
  nextCommand(): Promise<{ name: string; args?: unknown }>;
  /** Rebinds a command's key as the person's setting ("" unbinds, null restores the default). Throws for a reserved or modifier-less key. */
  bind(command: string, keys: string | null): void;

  // Drawing Perch's own parts
  /**
   * Draws one of Perch's parts instead of the stock one, which keeps its behavior and comes back if the mod throws. Called again with new `data` whenever it changes.
   *  toast        data {id, kind: "done"|"blocked"|"usage", level?, title, body?, sessionId, sessionTitle?}  actions open, dismiss
   *  session-row  data {id, title, status, blocked?, unseen?, createdAt, cwd, branch?, active}  actions open, remove
   *  project-row  data {cwd, name, state, sessionCount, active, hostId}  actions open, closeAll   (the sidebar's project header; its other buttons stay)
   *  tab          data {id, title, label, state: "focused"|"visible"|"hidden", provider?, blocked?, unseen?}  actions open, rename, menu(x, y)   (its close button stays)
   *  status-bar   data {online, host, cwd, branch?, sessionId?, contextTokens?, costUsd?, zoom}  actions resetZoom
   *  terminal-menu  data {x, y, workspaceId, sessionId?, selection?}  actions ask, close   (the menu on a right-click over selected terminal text)
   *  pane-header  data {id, title, label, state: "working"|"idle"|"blocked"|"done"|"unknown", provider?, focused}  actions open, menu(x, y)   (a tiled pane's header row; its expand and close buttons stay)
   *  confirm      data {message, confirmLabel, cancelLabel, busy}  actions confirm, cancel   (the dialog's panel; backdrop, Enter and Esc stay)
   */
  slot(name: string, render: (el: HTMLElement, props: { data: Record<string, any>; actions: Record<string, (...args: any[]) => void> }) => void | (() => void)): () => void;

  // Floating surfaces (all close when the mod is replaced, and give focus back on closing). Each takes a draw function
  // or layout content: {layout, width?, height?} with the window layout's nodes (rows, columns, stacks; blocks of
  // mod:<id> with props, terminal:<session>, session:<session>, agent:focused, files, git…), so a live terminal can sit
  // beside your own view (a mod:<your id> block). A terminal already on screen moves into the surface and back when it
  // closes: the same process, input and size owner; closing never stops it. Looks, floats and backgrounds are ignored.
  /** A modal. Esc or a click outside closes it. */
  overlay(draw: Draw | SurfaceLayout): () => void;
  /** A small panel next to an element or a {x, y} point; Esc or a click elsewhere closes it. */
  popup(anchor: HTMLElement | { x: number; y: number }, draw: Draw | SurfaceLayout): () => void;
  /** A window that stays until closed: drag it by its title bar, size it by its corner. A `key` remembers where it was put and how big, on this device across restarts (at most 64 keys, least recently used dropped), and replaces an open one with the same key. `frame: "none"` drops the border, shadow and title bar: draw your own, and a press you do not stop (`stopPropagation`) drags the window.
   * `keep: true` (needs a key, layout content and a frame) keeps the window itself: it belongs to the layout shown when it opened, reopens with that layout after a restart, closes while another layout is shown, and is not closed by replacing or removing your mod. Its x, or the returned close, forgets it. */
  window(options: { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number }; frame?: "none"; keep?: boolean }, draw: Draw | SurfaceLayout): () => void;
  /** Calls `frame(ms)` (milliseconds since the loop began) before each repaint, at most `fps` times a second (default 60), and pauses while the page is hidden: for motion. Stops when the mod is replaced, or call the returned function. */
  /** A picture of the app as a PNG data URL: the OS's own capture of the window in the desktop app, else drawn from the page (terminal canvases are copied, web fonts fall back). */
  screenshot(): Promise<string>;
  loop(frame: (ms: number) => void, options?: { fps?: number }): () => void;
  /** Steps through `list` every `every` ms (a spinner: ["⠋", "⠙", …], 90), calling `show(item, index)` when it changes; returns the way to stop. */
  frames<T>(list: T[], every: number, show: (item: T, index: number) => void): () => void;
  /** A toast. `action` runs a command when it is clicked. */
  notify(note: { title: string; body?: string; level?: "info" | "warning" | "error"; action?: { command: string; args?: unknown }; icon?: string; timeout?: number }): void;
  /** The props the layout gave this copy (`{"type":"block","content":"mod:id","props":{...}}`, at most 4 KiB); `{}` when none. */
  props(): Record<string, unknown>;
  /** The colors in use, by name: background, canvas, chrome, surface, popover, raised, hover, selected, border, input, dim, foreground, muted, accent, working, blocked, done, idle, unknown and the palette (green, yellow, red, blue, teal, peach, mauve); `dark` says which appearance. */
  theme(): { [color: string]: string | boolean; dark: boolean };
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

  // The computer
  /** Runs a program (timeout ms, default 30 s, at most 10 min; output past 1 MiB is cut). A nonzero `code` is a result; it rejects if the program cannot start or runs out of time. `host` is an id from `hosts()`: it runs there over ssh instead of on this computer. */
  exec(cmd: string, args?: string[], options?: { cwd?: string; timeout?: number; host?: string }): Promise<{ code: number | null; stdout: string; stderr: string }>;
  /** Runs Perch's own `perch` command line (what herdr's `hc(args)` is to herdr-core). `perch(["daemon", "ls", "--json"])` lists every terminal the daemon runs, `["daemon", "read", id, "--lines", "50"]` reads one's screen (on screen or not), `["daemon", "send", id, text, "--enter"]` types into it, `["daemon", "run", "--cwd", dir, "--", cmd]` starts one and prints its id, `["daemon", "wait", id, "--timeout", "30"]` (or `--quiet 5`) waits for it, and `["daemon", "kill", id]` stops one `run` started. Same results as `exec`. */
  perch(args?: string[], options?: { cwd?: string; timeout?: number }): Promise<{ code: number | null; stdout: string; stderr: string }>;
  /** Files anywhere by absolute or ~/ path (reads stop at 5 MiB). The last argument `{host}` acts on that host over ssh. */
  readTextFile(path: string, on?: { host?: string }): Promise<string>;
  /** `expected`: the text the file must hold now (null: it must not exist); if it differs this rejects and writes nothing. */
  writeTextFile(path: string, text: string, on?: { host?: string; expected?: string | null }): Promise<void>;
  statFile(path: string, on?: { host?: string }): Promise<{ exists: boolean; isDir?: boolean; size?: number; modified?: number }>;
  listDir(path: string, on?: { host?: string }): Promise<{ name: string; isDir: boolean }[]>;
  /** Calls `changed` when a file or folder's size or modified time changes (polled every 2 s). */
  watch(path: string, changed: () => void, on?: { host?: string }): () => void;
  /** Resolves with the paths that changed in `dir` (its entries, one level down; polled every 2 s) the next time any does: loop `for (;;) { await api.watchFolder(dir); refresh(); }`. Rejects when the mod is replaced. */
  watchFolder(dir: string, on?: { host?: string }): Promise<string[]>;
  /** A folder chooser: the system's picker in the desktop app (for this computer), else Perch's own over `listDir`: resolves with the chosen folder, or null if closed. Starts at `start` or the home folder. */
  pickFolder(options?: { prompt?: string; start?: string; host?: string }): Promise<string | null>;
  /** The agents a computer can start (Settings > Agents): `{id, name, installed, isDefault}`. Start one with `store.getState().createSession{ host?: string }(host, cwd, id)`. */
  knownAgents(on?: { host?: string }): Promise<{ id: string; name: string; installed: boolean; isDefault: boolean; run?: string[] }[]>;
  /** The program table (built-ins changed or added to by `programs.json`): `{id, name, tile, color?, icon?, tint?, match?, run?}`. */
  programs(): { id: string; name: string; tile: string; color?: string; icon?: string; tint?: boolean; match?: string[]; run?: string[] }[];
  /** What a command line is: `program("npx vitest run")` is Vitest, `["node", "x/vite.js"]` Vite, a shell is `shell`, else `program`. */
  program(command: string | string[]): { id: string; name: string; tile: string; color?: string; icon?: string; tint?: boolean };
  /** A text file of the open local project (relative path). */
  readFile(path: string): Promise<string>;

  // State shared between mods, kept across reloads on this screen (JSON values)
  shared(key: string): unknown;
  setShared(key: string, value: unknown): void;
  onShared(watch: (key: string, value: unknown) => void): () => void;
}
