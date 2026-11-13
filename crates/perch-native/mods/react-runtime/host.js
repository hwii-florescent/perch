// The host the React runtime and `@perch/sdk` call, made of the engine's real `perch` module, its timers, clipboard
// and `localStorage`, and `perch-react` (icons). Shared by every React screen (`mods/react-runtime/`); imported first
// (through `screen.js`): the runtime reads timers from it when it loads.
//
// Copies: every mod shares one script context, and the engine evaluates a folder's files once for all its copies (each
// pane's header, each time a floating screen opens). So each copy (`copyFor(cx, screen)`, one per `init`) has its own
// host, data snapshots, listeners and timers, and the browser globals a stock screen names (`window`, `document`,
// `localStorage`, `setTimeout`) are those of the copy the engine last called into (`copy.enter()`, on every entry:
// `init`, `render`, an event, a timer, the answer to a request it made, React working on its tree). When a copy leaves
// the window (`copy.close()`, the view's final call) its tree is unmounted, so its effects clean up, and its listeners
// and timers go; a build replaced by a save, or by a person's folder taking over from the stock one, gets the same
// final call.
// React's scheduler takes its turns in promise jobs (`setImmediate` below), which no copy owns.
// ponytail: the engine ends a timer with the screen whose call set it (`scope::current_application_generation` in
// `scheduler.rs`), whatever `cx` set it, so a timer a copy sets while another's call runs (an effect of a commit
// that call caused, such as a request's answer) ends if that screen closes first; a timer owned by its copy's view
// needs the engine to take the generation from `cx`.
//
// Data: the SDK's hooks read snapshots (`navigation(options)`, `hosts()`) that stay the same object until the data
// changes. `refresh()` (each `render()`, which the engine runs again exactly when something the mod read moved)
// reads them again and tells React's subscribers which changed.
//
// Overlays: an overlay the web draws over a screen opens as the window's screen of that kind when a mod draws it
// (`OVERLAY_SCREENS`: the New session menu as `new-session`, a confirmation as `confirm`, a session row's menu as
// `tab-menu`), and its callbacks get the screen's result. What the `perch` module or the window cannot do yet is an
// inert default (`INERT`), so a screen
// draws and its other actions work: an overlay with no screen (or whose screen no mod draws) closes at once and says
// so on stderr, and a row drag stays a press. Add project is the window's (`addProjectFolder`, through the core's
// `project.create`), and so are the folder browser's listing (`browse`) and the sessions by folder. A tab's
// press (`beginTabDrag`) is the window's from then on (`tab.beginDrag`, with where the strip's tabs are): it follows
// the pointer, draws the `tab-drag` screen and moves or splits the tab once it is let go. Commands the module and the
// window lack are refused by it and logged.
import * as perch from "perch";
import { Icon, bounds, forgetBounds, textWidth } from "perch-react";
import { ICONS, LETTERS, LETTER } from "./agent-icons.js";

export const INERT = [
  // Only a screen's own scope (`directory`) is matched; the window's own keys are the window's.
  "shortcutFor",
  "beginReorderDrag",
  "overlay:folder-browser",
  "overlay:worktree",
  "overlay:new-file",
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
  // The sidebar row's menu is the tab menu for that session (`SessionMenu`): the window works out what may be done and
  // runs the tab's actions and the session's inbound choices; a row of the sidebar's own is its `onSelect`.
  "session-menu": {
    screen: "tab-menu",
    props: (p) => ({ sessionMenu: true, id: p.id, x: p.x, y: p.y, extraItems: (p.extraItems ?? []).map(({ label, testId }) => ({ label, testId })) }),
    result: (p, r) => {
      const item = r && typeof r.item === "string" ? (p.extraItems ?? []).find((row) => row.testId === r.item) : null;
      item?.onSelect?.();
      p.onClose?.();
    },
  },
  // Instructions and Project memory: the screen asks the core itself (`ask`); closing it is the overlay's close.
  instructions: {
    screen: "instructions",
    props: (p) => ({ scope: p.scope, id: p.id, name: p.name }),
    result: (p) => p.onClose?.(),
  },
  memory: {
    screen: "memory",
    props: (p) => ({ projectId: p.projectId, name: p.name }),
    result: (p) => p.onClose?.(),
  },
  confirm: {
    screen: "confirm",
    props: (p) => ({ message: p.message, confirmLabel: p.confirmLabel, cancelLabel: p.cancelLabel, busy: !!p.busy }),
    result: (p, r) => (r && r.confirmed === true ? p.onConfirm?.() : p.onCancel?.()),
  },
};

// A clock a test holds (`perch.heldClock()`: its reference page's instant) is the screens' `Date.now`.
const HELD_CLOCK = perch.heldClock?.();
if (typeof HELD_CLOCK === "number") Date.now = () => HELD_CLOCK;

/** How long a question for the core waits for its answer, as the web's clients wait. */
const ASK_TIMEOUT_MS = 5000;

/** An overlay that cannot open: its screen ends as if dismissed, so the screen's own state does not wait on it. */
function dismiss(kind, props, why) {
  console.error(`react-runtime: the ${kind} overlay does not open: ${why}`);
  if (kind === "confirm") props.onCancel?.();
  else props.onClose?.();
}

// Every live copy of every React screen and the browser globals of the running one, on `globalThis`: each screen's
// folder has its own copy of this file, and they share one script context.
const COPIES = (globalThis[Symbol.for("perch.react.copies")] ??= new Set());
const RUNNING = Symbol.for("perch.react.running");
// Where the runtime's `window`, `document` and `localStorage` globals read (`installGlobals` in `dom.mjs`).
const GLOBALS = Symbol.for("perch.react.globals");
const TIMERS = (globalThis[Symbol.for("perch.react.timers")] ??= { next: 1, all: new Map() });

/** A copy that stays, other than `gone`: the running one, else the newest. */
function heir(gone) {
  const now = globalThis[RUNNING];
  if (COPIES.has(now) && now !== gone) return now;
  return [...COPIES].reverse().find((copy) => copy !== gone) ?? null;
}

// Timers for React's scheduler and the screens, on the engine's clock (`cx.timer.after`); each fire runs as the copy
// that set it and redraws. One table for every copy, so `clearTimeout` finds a timer whichever folder's file set it.
function setTimeout(fn, ms = 0, ...args) {
  const copy = COPIES.has(globalThis[RUNNING]) ? globalThis[RUNNING] : heir(null);
  if (!copy) throw new Error("react-runtime: setTimeout with no screen running");
  const id = TIMERS.next++;
  const handle = copy.cx.timer.after(Math.max(0, Number(ms) || 0), (task) => {
    TIMERS.all.delete(id);
    copy.enter();
    fn(...args);
    task.notify();
  });
  TIMERS.all.set(id, { copy, handle });
  return id;
}
function clearTimeout(id) {
  const timer = TIMERS.all.get(id);
  if (!timer) return;
  TIMERS.all.delete(id);
  try { timer.handle.cancel(); } catch { /* its copy is gone, and the timer with it */ }
}
// React's scheduler runs its work loop on `setImmediate` when there is one (it reads it once, when the runtime loads),
// else on a 0 ms timer, and holds that the loop runs until the turn it asked for comes. A timer is a copy's and ends
// with it (and the engine ends every timer set during a screen's final call, where unmounting arms the loop), so the
// folder's scheduler would wait forever for the copies after it. A promise job is no one's: it runs before the call
// that queued it returns.
const setImmediate = (fn, ...args) => { Promise.resolve().then(() => fn(...args)); };
for (const [name, value] of Object.entries({ setTimeout, clearTimeout, setImmediate })) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: false });
}
// `globalThis.perch`: the running copy's host (a script reading it while this file loads gets the platform's facts).
const BASE = { isMac: true, hostname: "localhost" };
Object.defineProperty(globalThis, "perch", { get: () => globalThis[RUNNING]?.host ?? BASE, configurable: true, enumerable: false });

// Per-viewer view settings the sidebar keeps in `localStorage` are the window's sidebar settings in the `perch`
// module, so they follow the window (and the fixture a test publishes); every other key is the mod's own storage.
// The engine's own, kept by the first folder to load: later, `localStorage` is the running copy's (`installGlobals`).
const OWN = Symbol.for("perch.react.storage");
if (!(OWN in globalThis)) globalThis[OWN] = globalThis.localStorage;
const own = globalThis[OWN];
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
const sessionsOf = (nav) => {
  const out = new Map();
  const add = (list) => { for (const s of list ?? []) out.set(s.id, s); };
  const walk = (workspaces) => { for (const w of workspaces ?? []) { add(w.sessions); walk(w.children); } };
  add(nav.sessions);
  for (const project of [...(nav.projects ?? []), nav.quickchat].filter(Boolean)) { add(project.sessions); walk(project.workspaces); }
  for (const section of nav.status ?? []) add(section.sessions);
  return out;
};

// The requests some copy took, by kind (every copy shares one script context): a late copy takes only a newer one.
const TAKEN = (globalThis[Symbol.for("perch.react.requests")] ??= {});
const DESKTOP = { width: 1000, height: 800 };
let nextOverlay = 1;


/** The running copy of this folder's screen, which this folder's `@perch/sdk` calls (`screen.js` binds it). */
let mine = null;
export const runningHost = () => mine?.host ?? BASE;

/**
 * A new copy of screen `screen` for the view `init` handed `cx`. `copy.enter()` before running anything for it;
 * `copy.attach(handle)` with its mounted tree; `copy.close()` once, when it leaves the window.
 */
export function copyFor(cx, screen) {
  // The settings as this copy last read or wrote them. The web reads them once, when it mounts, so a change made
  // elsewhere (a key, another screen) is seen by mounting the screen again (`settingsMoved`).
  let seen = null;
  const settings = () => {
    const now = perch.sidebarSettings();
    seen = JSON.stringify(now);
    return now;
  };
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
  const focusListeners = new Set();
  const openOverlays = new Set();
  function snapshot(key, read) {
    let entry = snapshots.get(key);
    if (!entry) {
      const value = read();
      snapshots.set(key, (entry = { read, value, text: JSON.stringify(value) }));
    }
    return entry.value;
  }
  let rendering = false;
  let handle = null;

  // The strip's tabs slide while the window drags one of them (`perch.tabSlide()`, the offsets of the web's
  // `slideOffsets`), with the inline styles the web's `createSlide` sets, all put back when the drag ends however it
  // ends (or a new press begins).
  let sliding = null;
  const SLIDE_STYLED = ["transform", "transition", "zIndex", "filter", "pointerEvents", "position"];
  const entryId = (el) => el.dataset?.tabEntry ?? el.getAttribute?.("data-tab-entry");
  function slideWith(items, id) {
    sliding?.();
    const saved = items.map((el) => SLIDE_STYLED.map((key) => el.style[key]));
    const read = () => snapshot("tabSlide", () => perch.tabSlide?.() ?? null);
    let started = false;
    const end = () => {
      listeners.delete(check);
      if (sliding === end) sliding = null;
      if (started) items.forEach((el, i) => SLIDE_STYLED.forEach((key, k) => { el.style[key] = saved[i][k]; }));
    };
    function check() {
      const slide = read();
      if (slide?.id !== id) {
        if (started) end();
        return;
      }
      if (!started) {
        started = true;
        for (const el of items) {
          el.style.pointerEvents = "none";
          if (entryId(el) !== id) el.style.transition = "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)";
          else {
            el.style.position = "relative";
            el.style.zIndex = "30";
            el.style.filter = "drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))";
          }
        }
      }
      const offsets = new Map((slide.offsets ?? []).map((o) => [o.id, o.px]));
      for (const el of items) {
        const px = offsets.get(entryId(el)) ?? 0;
        el.style.transform = px ? `translateX(${px}px)` : "";
      }
    }
    sliding = end;
    listeners.add(check);
    read();
  }

  const host = {
    isMac: true,
    hostname: "localhost",
    storage,
    clipboard: { writeText: async (text) => cx.write_to_clipboard(String(text)) },
    theme: () => perch.theme(),
    // Where an element the runtime measures was last laid out, and letting a tree's boxes go (`HostDocument.measure`).
    bounds: (key) => bounds(key),
    forgetBounds: (prefix) => forgetBounds(prefix),
    // The window's logical size (`window.innerWidth`/`innerHeight`, media rules, `vw`/`vh`); a resize re-renders.
    // Before a window has drawn the mod there is none: a desktop window's size.
    viewport: () => snapshot("viewport", () => perch.viewport() ?? DESKTOP),
    /** The source focused `element`: the screen takes the keyboard (`screen.js`). */
    focused: () => { for (const listener of [...focusListeners]) listener(); },
    /** React is about to work on this copy's tree (render or commit it). */
    enter: () => copy.enter(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigation: (options = {}) => {
      const opts = { showTerminals: !!options.showTerminals, sortByAttention: !!options.sortByAttention };
      return snapshot(`navigation:${JSON.stringify(opts)}`, () => perch.navigation(opts));
    },
    hosts: () => snapshot("hosts", () => perch.hosts()),
    workspaceTabs: () => snapshot("workspaceTabs", () => perch.workspaceTabs()),
    statusLine: () => snapshot("statusLine", () => perch.statusLine()),
    zoom: () => snapshot("zoom", () => perch.zoom()),
    paneLook: () => snapshot("paneLook", () => perch.paneLook()),
    keybindings: () => snapshot("keybindings", () => perch.keybindings()),
    planUsage: () => snapshot("planUsage", () => perch.planUsage()),
    notifications: () => snapshot("notifications", () => perch.notifications()),
    // The window's requests (`perch.requests()`: a count per kind, one more per request), as the web's window events:
    // `listener` runs once for each request made after it subscribed.
    onRequest(kind, listener) {
      const count = () => snapshot("requests", () => perch.requests())[kind] ?? 0;
      let heard = count();
      // A request made a moment before this screen mounted (the sidebar that same request showed) is still its, once.
      if (heard > (TAKEN[kind] ?? 0) && perch.requestFresh(kind)) {
        TAKEN[kind] = heard;
        queueMicrotask(listener);
      }
      const check = () => {
        const now = count();
        if (now === heard) return;
        heard = now;
        TAKEN[kind] = now;
        listener();
      };
      listeners.add(check);
      return () => listeners.delete(check);
    },
    agentChoices: (hostId) => snapshot(`agentChoices:${hostId}`, () => perch.agentChoices(hostId)),
    // A session on any computer (the web's store has them all): the shown computer's first, then the others'.
    session: (id) => {
      const shown = sessionsOf(host.navigation({})).get(id);
      if (shown) return shown;
      for (const other of host.hosts().list ?? []) {
        const found = sessionsOf(snapshot(`navigation:host:${other.id}`, () => perch.navigation({ hostId: other.id }))).get(id);
        if (found) return found;
      }
      return null;
    },
    sessionFolders: () => snapshot("sessionFolders", () => perch.sessionFolders()),
    addProject: () => snapshot("addProject", () => perch.addProject()),
    addProjectFolder: (path, name, hostId) => {
      try {
        perch.addProjectFolder(String(path), name ? String(name) : null, hostId ?? null);
      } catch (error) {
        console.error(`perch.addProjectFolder: ${error?.message ?? error}`);
      }
    },
    clearAddProject: () => perch.clearAddProject(),
    /** The folder browser's listing of `path` (absent: home) on `hostId` (`FolderBrowserProps.browse`). */
    browse: (hostId, path) =>
      perch.ask("fs.browse", { hostId, path: path ?? null }).then((listing) => listing ?? Promise.reject(new Error("No core is connected to list folders."))),
    /**
     * A question for the core (`perch.ask`: Instructions, Project memory), as the web's clients ask it: the core's
     * answer, its refusal as `{ error }`, or null when no core answers within `ASK_TIMEOUT_MS`.
     */
    ask: (kind, args) =>
      new Promise((resolve) => {
        let done = false;
        const settle = (value) => { if (!done) { done = true; resolve(value); } };
        const timer = setTimeout(() => settle(null), ASK_TIMEOUT_MS);
        let asking;
        try {
          asking = perch.ask(kind, args);
        } catch (error) {
          // No window to ask through (a screen drawn on its own): no answer.
          console.error(`perch.ask ${kind}: ${error?.message ?? error}`);
          clearTimeout(timer);
          return settle(null);
        }
        asking.then(
          answer((value) => { clearTimeout(timer); settle(value ?? null); }),
          answer((error) => { clearTimeout(timer); settle({ error: String(error?.message ?? error) }); }),
        );
      }),
    /** Whether the connected core has `capability` (`server.info`), as the web's clients check it. */
    coreCan: (capability, hostId = "local") => snapshot(`coreCan:${hostId}:${capability}`, () => perch.coreCan(capability, hostId)),
    /** One of the folder's own fields has the keyboard, or none does now (`screen.js`). */
    holdKeyboard: (held) => perch.holdKeyboard(!!held),
    shortcutLabel: (id) => perch.shortcutLabel(id),
    startSession: (hostId, cwd, agent) => {
      perch.startSession(hostId, cwd ?? undefined, agent).catch(answer((error) => console.error(`perch.startSession: ${error?.message ?? error}`)));
    },
    command(name, args) {
      perch.run(name, args && Object.keys(args).length ? args : undefined).catch(answer((error) => console.error(`perch.run ${name}: ${error?.message ?? error}`)));
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
      let opening;
      try {
        opening = perch.openScreen(known.screen, known.props(props));
      } catch (error) {
        // No window opens screens for this copy (a mod drawn on its own): the overlay closes, the screen stays.
        dismiss(kind, props, error?.message ?? String(error));
        return id;
      }
      openOverlays.add(id);
      opening.then(
        answer((result) => {
          if (openOverlays.delete(id)) known.result(props, result);
        }),
        answer((error) => {
          if (openOverlays.delete(id)) dismiss(kind, props, error?.message ?? String(error));
        }),
      );
      return id;
    },
    // The screen unmounted the overlay before it answered: close the window's screen (the top modal one).
    closeOverlay(id) {
      if (openOverlays.delete(id)) perch.run("overlay.close").catch(() => {});
    },
    // A screen's own keys (`directory`: Use this folder); the native keymap has no `navigator.*` bindings, so the
    // Navigator's home-row keys are not matched, and the window's own keys stay the window's.
    shortcutFor: (event, scope) => {
      if (!event || typeof scope !== "string") return null;
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
      return perch.shortcutFor({ key, ctrlKey: !!ctrlKey, metaKey: !!metaKey, shiftKey: !!shiftKey, altKey: !!altKey }, scope);
    },
    // A press on a tab, which the window turns into a drag after a few pixels. The strip's tabs as laid out now are
    // where a drop on the strip lands (`slotIndex` in the web).
    beginTabDrag(event, id, label) {
      if ((event?.button ?? 0) !== 0) return;
      const items = [...(globalThis.document?.querySelectorAll?.("[data-tab-entry]") ?? [])];
      const entries = items.map((el) => {
        const box = el.getBoundingClientRect();
        return { id: el.dataset?.tabEntry ?? el.getAttribute?.("data-tab-entry"), left: box.left, width: box.width };
      });
      // A copy of the tab's own markup, so off the strip its ghost looks as it does on it (`tabDrag.ts`): no ids or
      // test ids (there is one real tab) and no inline style (the drag's own offset is on the original).
      const source = items.find((el) => (el.dataset?.tabEntry ?? el.getAttribute?.("data-tab-entry")) === String(id));
      let look = null;
      if (typeof source?.copyMarkup === "function") {
        const rect = source.getBoundingClientRect();
        const html = source.copyMarkup(["data-testid", "data-tab-entry", "id", "style"]);
        look = { html, width: rect.width, height: rect.height, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      }
      const args = { id: String(id), label: String(label ?? ""), x: event.clientX, y: event.clientY, entries, look };
      slideWith(items, String(id));
      perch.run("tab.beginDrag", args).catch(answer((error) => console.error(`perch.run tab.beginDrag: ${error?.message ?? error}`)));
    },
    render: () => { if (!rendering && !copy.closed) cx.notify(); },
    error: (error) => console.error(`react-runtime: ${error?.stack ?? error}`),
  };
  /** `fn` as the answer to a request this copy made: it runs as this copy (whichever screen's call settled it). */
  const answer = (fn) => (value) => { if (copy.closed) return; copy.enter(); fn(value); };

  const copy = {
    screen,
    host,
    closed: false,
    cx,
    /** How many listeners this copy has on the window's data and on its own focus. */
    listening: () => listeners.size + focusListeners.size,
    /** The engine is calling into this copy: the browser globals are its own until it calls into another. */
    enter() {
      globalThis[RUNNING] = copy;
      if (handle) globalThis[GLOBALS] = handle.globals;
      mine = copy;
    },
    attach(mounted) {
      handle = mounted;
      globalThis[GLOBALS] = handle.globals;
    },
    /** Reads every snapshot again; returns whether one changed. With `tell`, keeps the new values and tells the
     * subscribers; without, only looks. */
    refresh(tell) {
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
    },
    /** Whether the window's sidebar settings changed since this copy last read or wrote them. */
    settingsMoved: () => seen !== null && JSON.stringify(perch.sidebarSettings()) !== seen,
    /** Calls `listener` whenever the source focuses one of its elements. */
    onFocus: (listener) => { focusListeners.add(listener); return () => focusListeners.delete(listener); },
    /** Runs `fn` as the mod's `render()`: a commit inside it needs no extra frame. */
    asRender(fn) {
      copy.enter();
      rendering = true;
      try { return fn(); } finally { rendering = false; }
    },
    /** The copy left the window: its tree is unmounted (its effects clean up) and it stops listening; the timers it
     * still has go with it, as the engine ends them with its view. */
    close() {
      if (copy.closed) return;
      copy.enter();
      // Unmounting commits once more: that commit has nothing to draw (`render` above does nothing once closed).
      copy.closed = true;
      try { handle?.unmount(); } catch (error) { host.error(error); }
      COPIES.delete(copy);
      listeners.clear();
      focusListeners.clear();
      openOverlays.clear();
      snapshots.clear();
      for (const [id, timer] of TIMERS.all) if (timer.copy === copy) clearTimeout(id);
      const next = heir(copy);
      if (globalThis[RUNNING] === copy && next) next.enter();
      if (mine === copy) mine = null;
    },
  };
  COPIES.add(copy);
  return copy;
}

/** Icons: `perch-react` draws an icon's markup (gpui-kit's `svg()` reads files this window does not serve), and
 * measures text. */
export const files = {
  icon: (id, markup, color) => Icon.new(id, { markup, color: color ?? "" }),
  // The exact width of a line of text (`perch-react` shapes it), for laying rows out on device pixels.
  measure: (text, font) => {
    const key = `${font.size}|${font.weight}|${font.family}|${font.italic ? 1 : 0}|${text}`;
    let width = widths.get(key);
    if (width === undefined) {
      if (widths.size >= 4096) widths.clear();
      // A host without the app's fonts measures nothing: rows keep the engine's own layout.
      try { width = textWidth(text, font); } catch { width = NaN; }
      widths.set(key, width);
    }
    return width;
  },
};
const widths = new Map();

