// The host the React runtime and `@perch/sdk` call (`globalThis.perch`), made of the engine's real `perch`
// module, its timers, clipboard and `localStorage`, and `perch-react` (icons). Shared by every React screen
// (`mods/react-runtime/`); imported first (through `screen.js`): the runtime reads timers from it when it loads.
//
// Data: the SDK's hooks read snapshots (`navigation(options)`, `hosts()`) that stay the same object until the data
// changes. `refresh()` (each `render()`, which the engine runs again exactly when something the mod read moved)
// reads them again and tells React's subscribers which changed.
//
// Overlays: an overlay the web draws over a screen opens as the window's screen of that kind when a mod draws it
// (`OVERLAY_SCREENS`: the New session menu as `new-session`, a confirmation as `confirm`), and its callbacks get the
// screen's result. What the `perch` module or the window cannot do yet is an inert default (`INERT`), so a screen
// draws and its other actions work: an overlay with no screen (or whose screen no mod draws) closes at once and says
// so on stderr, session folders are empty, the add-project flow does not run and a row drag stays a press. A
// workspace line's `workspace.open` runs `workspace.focus` (`STAND_IN`); other commands the module lacks are refused
// by it and logged.
import * as perch from "perch";
import { Icon } from "perch-react";
import { ICONS, LETTERS, LETTER } from "./agent-icons.js";

/** Commands the module does not run yet, and the one it does that comes closest. */
const STAND_IN = { "workspace.open": "workspace.focus" };

export const INERT = [
  "sessionFolders",
  "addProject",
  "beginReorderDrag",
  "overlay:session-menu",
  "overlay:select",
  "overlay:folder-browser",
  "overlay:instructions",
  "overlay:memory",
  "overlay:worktree",
];

/** Overlays that open as one of the window's screens: the screen, its props from the overlay's, and what the
 * screen's result does with the overlay's callbacks. */
const OVERLAY_SCREENS = {
  "new-session-menu": {
    screen: "new-session",
    props: (p) => ({ hostId: p.hostId, projectCwds: p.projects ?? [], ...(p.cwd ? { fixedCwd: p.cwd } : {}), ...(p.anchorRect ? { anchorRect: p.anchorRect } : {}) }),
    result: (p, r) => {
      if (r && typeof r === "object" && typeof r.agent === "string") p.onSelect?.(r.cwd ?? null, r.agent);
      p.onClose?.();
    },
  },
  confirm: {
    screen: "confirm",
    props: (p) => ({ message: p.message, confirmLabel: p.confirmLabel, cancelLabel: p.cancelLabel, busy: !!p.busy }),
    result: (p, r) => (r && r.confirmed === true ? p.onConfirm?.() : p.onCancel?.()),
  },
};

/** An overlay that cannot open: its screen ends as if dismissed, so the screen's own state does not wait on it. */
function dismiss(kind, props, why) {
  console.error(`react-runtime: the ${kind} overlay does not open: ${why}`);
  if (kind === "confirm") props.onCancel?.();
  else props.onClose?.();
}

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
// The settings as the screen last read or wrote them. The web reads them once, when it mounts, so a change made
// elsewhere (a key, another screen) is seen by mounting the screen again (`settingsMoved`).
let seen = null;
const settings = () => {
  const now = perch.sidebarSettings();
  seen = JSON.stringify(now);
  return now;
};
/** Whether the window's sidebar settings changed since the screen last read or wrote them. */
export const settingsMoved = () => seen !== null && JSON.stringify(perch.sidebarSettings()) !== seen;
const storage = {
  getItem: (key) => (SETTINGS[key] ? SETTINGS[key][0](settings()) : (own?.getItem(key) ?? null)),
  setItem: (key, value) => {
    if (!SETTINGS[key]) return own?.setItem(key, String(value));
    seen = JSON.stringify(perch.setSidebarSettings(SETTINGS[key][1](String(value))));
  },
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
let nextOverlay = 1;
const openOverlays = new Set();

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
  startSession: (hostId, cwd, agent) => {
    perch.startSession(hostId, cwd ?? undefined, agent).catch((error) => console.error(`perch.startSession: ${error?.message ?? error}`));
  },
  command(name, args) {
    const id = STAND_IN[name] ?? name;
    perch.run(id, args && Object.keys(args).length ? args : undefined).catch((error) => console.error(`perch.run ${name}: ${error?.message ?? error}`));
    return true;
  },
  // The web's own marks (`agent-icons.js`, rendered from its `AgentIcon`); a provider without one gets the letter
  // tile, with the letter the web picks (a built-in program's name, else the provider's first letter). A person's
  // own icon from `programs.json` is not drawn: the module gives a mod neither that file nor the icon files.
  agentIcon(provider) {
    if (ICONS[provider]) return ICONS[provider];
    const letter = LETTERS[provider] ?? (provider?.[0]?.toUpperCase() || "?");
    const escaped = letter.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    return { markup: LETTER.replace("{letter}", escaped), tint: true };
  },
  openOverlay(kind, props = {}) {
    const id = nextOverlay++;
    const known = OVERLAY_SCREENS[kind];
    if (!known) {
      dismiss(kind, props, "no screen draws it yet");
      return id;
    }
    openOverlays.add(id);
    perch.openScreen(known.screen, known.props(props)).then(
      (result) => {
        if (openOverlays.delete(id)) known.result(props, result);
      },
      (error) => {
        if (openOverlays.delete(id)) dismiss(kind, props, error?.message ?? String(error));
      },
    );
    return id;
  },
  // The screen unmounted the overlay before it answered: close the window's screen (the top modal one).
  closeOverlay(id) {
    if (openOverlays.delete(id)) perch.run("overlay.close").catch(() => {});
  },
  render: () => { if (!rendering) ambient?.notify(); },
  error: (error) => console.error(`react-runtime: ${error?.stack ?? error}`),
};

/** Runs `fn` as the mod's `render()`: a commit inside it needs no extra frame. */
export function asRender(fn) {
  rendering = true;
  try { return fn(); } finally { rendering = false; }
}

/** Icons: `perch-react` draws an icon's markup (gpui-kit's `svg()` reads files this window does not serve). */
export const files = { icon: (id, markup, color) => Icon.new(id, { markup, color: color ?? "" }) };

globalThis.perch = host;
