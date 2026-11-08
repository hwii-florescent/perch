// Types for a Perch mod (`perch mod api` prints this file). A mod is `mods/<id>/main.js`, an ES
// module whose default export is `(el, api) => cleanup?`: draw into `el` with plain DOM; `api` is
// below. A mod runs inside Perch's own page with the person's full access, so a bug in it can break
// the page (ctrl+alt+shift+Escape turns every mod off). Run `perch mod check <id>` after each edit.

export default function mod(el: HTMLElement, api: ModApi): void | (() => void) | Promise<void | (() => void)>;

type Draw = (el: HTMLElement, close: () => void) => void | (() => void);

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
  /** Calls `changed` after any of that changes. Returns the way to stop. */
  subscribe(changed: () => void): () => void;

  // Commands and keys
  /** Every app command: its id (as in Settings > Keyboard), what it does, and its arguments if any. */
  commands(): { id: string; description: string; args?: string }[];
  /** Runs a command like its key does; `session.open`, `session.close`, `project.focus` and `workspace.focus` take `{id}`. False for an unknown id. */
  run(command: string, args?: unknown): boolean;
  /** Adds `mod.<modId>.<name>` to the keyboard help and Settings > Keyboard. `keys` ("mod+shift+y") is its default key, dropped if taken or without a modifier. */
  command(def: { name: string; description: string; keys?: string; run: (args?: unknown) => void }): () => void;
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

  // Floating surfaces (all close when the mod is replaced)
  /** A modal. Esc or a click outside closes it. */
  overlay(draw: Draw): () => void;
  /** A small panel next to an element or a {x, y} point; Esc or a click elsewhere closes it. */
  popup(anchor: HTMLElement | { x: number; y: number }, draw: Draw): () => void;
  /** A window that stays until closed: drag it by its title bar. A `key` remembers where it was put and replaces an open one with the same key. `frame: "none"` drops the border, shadow and title bar: draw your own, and a press you do not stop (`stopPropagation`) drags the window. */
  window(options: { key?: string; title?: string; width?: number; height?: number; at?: { x: number; y: number }; frame?: "none" }, draw: Draw): () => void;
  /** Calls `frame(ms)` (milliseconds since the loop began) before each repaint, at most `fps` times a second (default 60), and pauses while the page is hidden: for motion. Stops when the mod is replaced, or call the returned function. */
  /** A picture of the app as a PNG data URL (drawn from the page: terminal canvases are copied, web fonts fall back). */
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
  /** Files anywhere by absolute or ~/ path (reads stop at 5 MiB). The last argument `{host}` acts on that host over ssh. */
  readTextFile(path: string, on?: { host?: string }): Promise<string>;
  /** `expected`: the text the file must hold now (null: it must not exist); if it differs this rejects and writes nothing. */
  writeTextFile(path: string, text: string, on?: { host?: string; expected?: string | null }): Promise<void>;
  statFile(path: string, on?: { host?: string }): Promise<{ exists: boolean; isDir?: boolean; size?: number; modified?: number }>;
  listDir(path: string, on?: { host?: string }): Promise<{ name: string; isDir: boolean }[]>;
  /** Calls `changed` when a file or folder's size or modified time changes (polled every 2 s). */
  watch(path: string, changed: () => void, on?: { host?: string }): () => void;
  /** A text file of the open local project (relative path). */
  readFile(path: string): Promise<string>;

  // State shared between mods, kept across reloads on this screen (JSON values)
  shared(key: string): unknown;
  setShared(key: string, value: unknown): void;
  onShared(watch: (key: string, value: unknown) => void): () => void;
}
