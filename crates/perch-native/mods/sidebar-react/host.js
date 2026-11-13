// The host the React runtime and `@perch/sdk` call (`globalThis.perch`), made of the engine's real `perch`
// module, its timers, clipboard and `localStorage`, and `perch-react` (icons). Imported first by `main.js`:
// the runtime reads timers from it when it loads.
//
// Data: the SDK's hooks read snapshots (`navigation(options)`, `hosts()`) that stay the same object until the data
// changes. `refresh()` (each `render()`, which the engine runs again exactly when something the mod read moved)
// reads them again and tells React's subscribers which changed.
//
// What the `perch` module does not offer yet is an inert default (`INERT`), so the sidebar draws and its other
// actions work: session folders are empty, overlays Perch would draw (session menu, new session menu, confirm,
// select, folder browser, instructions, memory, worktree) do not open, the add-project flow does not run, a row
// drag stays a press, `startSession` does nothing and agent marks are a plain dot. A workspace line's
// `workspace.open` runs `workspace.focus` (`STAND_IN`); other commands the module lacks are refused by it and logged.
import * as perch from "perch";
import { Icon } from "perch-react";

/** Commands the module does not run yet, and the one it does that comes closest. */
const STAND_IN = { "workspace.open": "workspace.focus" };

export const INERT = ["sessionFolders", "openOverlay", "addProject", "beginReorderDrag", "startSession", "agentIcon"];

// The ambient `cx` `init` is handed: usable during any later host call (render, an event, a timer), which is when
// React schedules work.
let ambient = null;
let rendering = false;
export const setContext = (cx) => { ambient = cx; };

// Timers for React's scheduler and the screen, on the engine's clock (`cx.timer.after`); each fire redraws.
let nextTimer = 1;
const timers = new Map();
function setTimeout(fn, ms = 0, ...args) {
  const id = nextTimer++;
  const handle = ambient.timer.after(Math.max(0, Number(ms) || 0), (cx) => {
    timers.delete(id);
    fn(...args);
    cx.notify();
  });
  timers.set(id, handle);
  return id;
}
function clearTimeout(id) {
  timers.get(id)?.cancel();
  timers.delete(id);
}
for (const [name, value] of Object.entries({ setTimeout, clearTimeout })) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: false });
}

// Per-viewer view settings the sidebar keeps in `localStorage` are the window's sidebar settings in the `perch`
// module, so they follow the window (and the fixture a test publishes); every other key is the mod's own storage.
const own = globalThis.localStorage;
const SETTINGS = {
  "perch.sidebar.organize": [(s) => s.organize, (v) => ({ organize: v === "status" || v === "list" ? v : "project" })],
  "perch.sidebar.sort": [(s) => (s.sortByAttention ? "attention" : "manual"), (v) => ({ sortByAttention: v === "attention" })],
  "perch.sidebar.showTerminals": [(s) => (s.showTerminals ? "1" : "0"), (v) => ({ showTerminals: v === "1" })],
  "perch.sidebar.collapsedProjects": [(s) => JSON.stringify(s.collapsedProjects), (v) => ({ collapsedProjects: parseList(v) })],
};
function parseList(text) {
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
const storage = {
  getItem: (key) => (SETTINGS[key] ? SETTINGS[key][0](perch.sidebarSettings()) : (own?.getItem(key) ?? null)),
  setItem: (key, value) => (SETTINGS[key] ? perch.setSidebarSettings(SETTINGS[key][1](String(value))) : own?.setItem(key, String(value))),
  removeItem: (key) => (SETTINGS[key] ? undefined : own?.removeItem(key)),
  clear: () => own?.clear(),
  key: (index) => own?.key(index) ?? null,
  get length() { return own?.length ?? 0; },
};

// Snapshots by key, read again on `refresh()`.
const snapshots = new Map();
const listeners = new Set();
function snapshot(key, read) {
  let entry = snapshots.get(key);
  if (!entry) {
    const value = read();
    snapshots.set(key, (entry = { read, value, text: JSON.stringify(value) }));
  }
  return entry.value;
}
/** Reads every snapshot again; returns whether one changed. With `tell`, keeps the new values and tells the
 * subscribers; without, only looks. */
export function refresh(tell) {
  let changed = false;
  for (const entry of snapshots.values()) {
    const value = entry.read();
    const text = JSON.stringify(value);
    if (text === entry.text) continue;
    changed = true;
    if (tell) Object.assign(entry, { value, text });
  }
  if (changed && tell) for (const listener of [...listeners]) listener();
  return changed;
}
const sessionsOf = (nav) => {
  const out = new Map();
  const add = (list) => { for (const s of list ?? []) out.set(s.id, s); };
  const walk = (workspaces) => { for (const w of workspaces ?? []) { add(w.sessions); walk(w.children); } };
  add(nav.sessions);
  for (const project of [...(nav.projects ?? []), nav.quickchat].filter(Boolean)) { add(project.sessions); walk(project.workspaces); }
  for (const section of nav.status ?? []) add(section.sessions);
  return out;
};

const NO_ADD = { status: "idle", error: null };

export const host = {
  isMac: true,
  hostname: "localhost",
  storage,
  clipboard: { writeText: async (text) => ambient?.write_to_clipboard(String(text)) },
  theme: () => perch.theme(),
  // ponytail: the sidebar sits in the desktop layout, so its media queries (`min-[701px]:`) take a desktop window;
  // a host call for the window's size would let a narrow window use the phone rules.
  viewport: () => ({ width: 1000, height: 800 }),
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  navigation: (options = {}) => {
    const opts = { showTerminals: !!options.showTerminals, sortByAttention: !!options.sortByAttention };
    return snapshot(`navigation:${JSON.stringify(opts)}`, () => perch.navigation(opts));
  },
  hosts: () => snapshot("hosts", () => perch.hosts()),
  session: (id) => sessionsOf(host.navigation({})).get(id) ?? null,
  sessionFolders: () => snapshot("sessionFolders", () => ({ hostId: perch.navigation().hostId, folders: [] })),
  addProject: () => NO_ADD,
  addProjectFolder: () => {},
  clearAddProject: () => {},
  command(name, args) {
    const id = STAND_IN[name] ?? name;
    perch.run(id, args && Object.keys(args).length ? args : undefined).catch((error) => console.error(`perch.run ${name}: ${error?.message ?? error}`));
    return true;
  },
  openOverlay: (kind) => { console.error(`sidebar-react: the host draws no ${kind} overlay yet`); return 0; },
  closeOverlay: () => {},
  render: () => { if (!rendering) ambient?.notify(); },
  error: (error) => console.error(`sidebar-react: ${error?.stack ?? error}`),
};

/** Runs `fn` as the mod's `render()`: a commit inside it needs no extra frame. */
export function asRender(fn) {
  rendering = true;
  try { return fn(); } finally { rendering = false; }
}

/** Icons: `perch-react` draws an icon's markup (gpui-kit's `svg()` reads files this window does not serve). */
export const files = { icon: (id, markup, color) => Icon.new(id, { markup, color: color ?? "" }) };

globalThis.perch = host;
