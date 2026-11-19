// A stock screen on the native React runtime, as a mod's default export: `screen(id, Component, options)` mounts the
// unchanged web component (its exported source beside the mod's `main.js`), keeps it current with the `perch` data it
// read, and draws it through the translator. Every React screen's `main.js` is one call of this:
//
//   import { screen } from "./screen.js";
//   import Sidebar from "./sidebar/main.js";
//   export default screen("sidebar", Sidebar, { container: { display: "flex", ... } });
//
// Props and results: a screen the window opens gets its props from `perch.props()` (the web's names), and every
// callback prop the web passes is made here from `perch.close(result)`, as the window reads results:
// `onClose()` is `close()`, `onConfirm()` / `onCancel()` are `{ confirmed }`, `onSelect(cwd, agent)` is
// `{ cwd, agent }`, `onSubmit(value)` is `{ value }`, the close guard's `onStop(never, stopSubSessions)` is `{ confirmed: true, never, stopSubSessions }`
// and `onKeepRunning()` is `{ keepRunning: true }`, and `actions.x(...args)` is `{ action: "x", args }`.
// `options.props(raw)` replaces that mapping for a screen whose callbacks differ. The web often calls an action and
// `onClose()` from one handler, in either order; the screen closes once, at the end of that turn, with the action's
// result when there was one (a plain close is the dismissal `null`).
//
// Escape (`options.escapeForKeys`): the window dismisses a modal screen with Escape before the screen sees it; a screen
// that listens for keys on the window (Settings > Keyboard, recording one) keeps Escape while it does, and gives it
// back when it stops. A screen may also ask for it by `host.holdEscape(reason, want)` (a search text to clear).
//
// The keyboard (`options.keyboard`, for a modal screen): the screen takes it when the source focuses one of its
// elements (an `autoFocus` field, `ref.focus()`, a press on a field), and every key it then gets goes to the focused
// element as a DOM `keydown`, through the document's listeners, and types into a text field (`handle.key`). Escape is
// the window's: it closes the screen before the mod sees it. A screen without the option never takes the keyboard (the
// notifications, over a terminal that keeps it). An in-flow screen (`options.keyboard: "in-flow"`, the sidebar) holds
// the keyboard only while one of its own elements has the focus: it tells the window so (`holdKeyboard`), which then
// leaves the keyboard there and types into it, and lets go once nothing of its own is focused (a form closed).
//
// The web reads its per-viewer settings (`localStorage`, here the window's sidebar settings) once, when it mounts;
// when they change anywhere but in the screen (a key such as `sidebar.organize`), the screen is mounted again.
//
// Engine slots (`perch-engine`, an element with `data-perch-engine`): GPUI focus is the truth. A key that reaches the
// screen while its own focus handle is not the focused one came from an engine inside it and stays the engine's; an
// engine that took the keyboard becomes the document's `activeElement` (so the in-flow hold counts it as the screen's
// own); the source focusing an engine's node (`ref.focus()`) gives that engine the keyboard.
//
// Copies: each `init` is a copy of the screen with its own host, data and timers (`copyFor` in `host.js`), entered
// whenever the engine calls into it (`init`, `render`, its events and timers), and closed by the view's final call
// (`close`), which unmounts the tree.
//
// This file is written by hand and shared by every React screen (`mods/react-runtime/`, which the mod host writes into
// each screen's folder); `build.mjs` leaves it alone.
import { copyFor, files, naming, runningHost } from "./host.js";
import { View, div, image, renderGeneration, reuse, unchanged } from "gpui-kit";
import { ScrollHandle } from "gpui-base";
import { close, inRegion as inRegionOf, props as screenProps, scale } from "perch";
import { describeToGpui, mount, NAMED_ELEMENTS, sdk } from "./runtime.mjs";

// This folder's `@perch/sdk` calls the host of this folder's running copy, whichever screen loads after it.
sdk.bindHost(runningHost);

// `reuse`/`renderGeneration`: unchanged subtrees keep the last frame's elements (`toGpui` in the runtime).
const KIT = { div, image, reuse, renderGeneration };

// The result the screen closes with at the end of this turn (`undefined`: none yet).
let ending;
/** Closes the screen with `result` once the current handler has run: a result outranks a plain close (`null`). */
export function closeWith(result) {
  const first = ending === undefined;
  if (first || result !== null) ending = result;
  if (first) queueMicrotask(() => { const out = ending; ending = undefined; close(out ?? undefined); });
}

/** The parity names of screen `id`'s elements (`options.names` where the table has none), and those of the stock
 * screens it draws inside it (`options.alsoNamed`: the sidebar's folder browser). */
function namesOf(id, options) {
  const own = NAMED_ELEMENTS[id] ?? options.names ?? [];
  return [...own, ...(options.alsoNamed ?? []).flatMap((other) => NAMED_ELEMENTS[other] ?? [])];
}
/** Whether an element of `document` that is still in it has the focus. */
function focusedHere(document) {
  let node = document?.activeElement;
  if (!node || node === document.body) return false;
  while (node && node !== document.documentElement) node = node.parentNode;
  return node === document.documentElement;
}
/** The engine slot of `document` that has the keyboard (`perch-engine`'s `focused()`), or null. */
export function focusedEngine(host, document) {
  const at = host?.engines?.focused?.();
  if (!at || !document?.querySelectorAll) return null;
  for (const node of document.querySelectorAll("[data-perch-engine]")) {
    if (node.getAttribute("data-perch-engine") === at.engine && node.getAttribute("data-perch-key") === at.key) return node;
  }
  return null;
}
/** The web's DOM `key` for a GPUI key name. */
const KEY_NAMES = {
  escape: "Escape", enter: "Enter", tab: "Tab", backspace: "Backspace", delete: "Delete", up: "ArrowUp", down: "ArrowDown",
  left: "ArrowLeft", right: "ArrowRight", home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown", space: " ",
};
/** A GPUI key event as the DOM's `KeyboardEvent` fields. */
export function domKey(event) {
  const m = event.modifiers ?? {};
  const named = KEY_NAMES[event.key];
  const key = named ?? (event.key_char && !m.control && !m.platform ? event.key_char : m.shift && event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return { key, ctrlKey: !!m.control, metaKey: !!m.platform, shiftKey: !!m.shift, altKey: !!m.alt, repeat: !!event.is_held };
}

/** The web's callback props for a screen opened with `raw`, each closing the screen with its result. */
/** `value` as a result can carry it: a DOM event (an action given straight to `onClick`) is null. */
const plain = (value) => (value && typeof value === "object" && "nativeEvent" in value ? null : value);

export function resultProps(raw) {
  return {
    ...raw,
    onClose: () => closeWith(null),
    onConfirm: () => closeWith({ confirmed: true }),
    onCancel: () => closeWith({ confirmed: false }),
    onSelect: (cwd, agent) => closeWith({ cwd, agent }),
    onSubmit: (value) => closeWith({ value }),
    onStop: (never, stopSubSessions) => closeWith({ confirmed: true, never: !!never, stopSubSessions: !!stopSubSessions }),
    onKeepRunning: () => closeWith({ keepRunning: true }),
    // An action given straight to `onClick` gets the click's event, which is not a result: it goes as null.
    actions: new Proxy({}, { get: (_, action) => (...args) => closeWith({ action: String(action), args: args.map(plain) }) }),
  };
}

/** `handle` with each of its methods run as `copy`: the engine's events reach the tree through it. */
function entered(copy, handle) {
  return new Proxy(handle, {
    get(target, key) {
      const value = target[key];
      return typeof value === "function" ? (...args) => { copy.enter(); return value.apply(target, args); } : value;
    },
  });
}

/** What the web sidebar listens for to read its settings again (`SIDEBAR_SETTINGS_EVENT` in its source). */
const SETTINGS_EVENT = "perch:sidebar-settings";

/** The mod class for stock screen `id` drawn by `Component`. `options.container`: the style of the box the screen
 * fills (as the web's layout gives it); `options.props`: props from `perch.props()` (default `resultProps`);
 * `options.names`: the names of its elements, as the parity table's, for a screen the table has none for;
 * `options.alsoNamed`: stock screens drawn inside it whose table names its elements get too. */
export function screen(id, Component, options = {}) {
  const inRegion = inRegionOf(id) === true;
  const toProps = options.props ?? resultProps;
  return class Screen extends View {
    init(_props, cx) {
      const copy = (this.copy = copyFor(cx, id));
      copy.enter();
      if (options.keyboard) {
        this.keys = cx.focus_handle();
        // The source focused an element: the keyboard comes to the screen (after this turn: focus needs the window).
        copy.onFocus(() => {
          // Before the focus moves, so the window does not hand the keyboard straight back to a terminal.
          if (options.keyboard === "in-flow") this.hold(true);
          cx.timer.after(0, (task) => {
            // An engine slot focused by the source (`ref.focus()`, a press) takes the keyboard itself.
            const active = this.handle.document?.activeElement;
            const engine = active?.getAttribute?.("data-perch-engine");
            if (engine != null) copy.host.engines?.focus?.(engine, active.getAttribute("data-perch-key") ?? "");
            else if (!this.keys.is_focused()) this.keys.focus();
            this.armed = true;
            task.notify();
          });
        });
      }
      this.mounts = 0;
      this.mountTree();
      // Where `scrollIntoView()` leaves its request (a handle can only be made here, not while drawing).
      this.kit = { ...KIT, scroll: ScrollHandle.new() };
      copy.ready = true;
    }

    /** Mounts the source's tree with the props the window gives now. */
    mountTree() {
      const { copy } = this;
      this.raw = JSON.stringify(screenProps());
      const props = { ...toProps(JSON.parse(this.raw)), key: this.mounts };
      const handle = mount(copy.host, Component, { container: options.container, names: naming() ? namesOf(id, options) : null, props });
      copy.attach(handle);
      this.handle = entered(copy, handle);
    }

    /** The window let this copy go: its tree unmounts and its listeners and timers go with it. */
    close() {
      this.hold(false);
      this.copy.close();
    }

    /** An in-flow screen tells the window whether one of its own fields has the keyboard. */
    hold(held) {
      if (options.keyboard !== "in-flow" || !!this.held === held) return;
      this.held = held;
      this.armed = false;
      this.copy.host.holdKeyboard(held);
    }

    render(cx) {
      const { copy } = this;
      return copy.asRender(() => {
        // A call into React was cut past its time budget and React was replaced (`renderer.mjs`, `fresh`): the tree
        // is mounted again, as on a first mount; what the window keeps (drafts, listings) is not lost.
        // ponytail: the dead tree's subscriptions stay in the copy until it closes; a cut is rare.
        if (this.handle.dead()) this.mountTree();
        // `render()` has a 50 ms script budget per frame (an event or a timer has 500 ms), so catching up with new
        // data or props, which re-renders React and describes the tree again, runs in a timer, and this frame draws
        // the last description. The engine runs `render()` again when something the screen read changed.
        const raw = JSON.stringify(screenProps());
        if (copy.refresh(false) || raw !== this.raw || copy.settingsMoved()) {
          cx.timer.after(0, (task) => {
            if (copy.closed) return;
            copy.enter();
            const size = JSON.stringify(copy.host.viewport());
            copy.refresh(true);
            // A new window size changes media rules and `vw`, which no component re-renders for: describe again.
            if (JSON.stringify(copy.host.viewport()) !== size) this.handle.describe();
            // Settings changed elsewhere: a source that follows them (`SIDEBAR_SETTINGS_EVENT`) reads them again,
            // which is far cheaper than mounting it again; one that reads them only when it mounts is mounted again.
            let moved = copy.settingsMoved();
            if (moved && this.handle.listensFor(SETTINGS_EVENT)) {
              const event = { type: SETTINGS_EVENT, target: this.handle.window, currentTarget: this.handle.window };
              for (const { type, listener } of [...this.handle.window.listeners]) {
                if (type === SETTINGS_EVENT) listener.call(this.handle.window, event);
              }
              moved = false;
            }
            if (moved) this.mounts += 1;
            if (raw !== this.raw || moved) {
              this.raw = raw;
              this.handle.update({ ...toProps(JSON.parse(raw)), key: this.mounts });
            }
            this.handle.flush();
            task.notify();
          });
        }
        // What the elements are built from: when it is what the last frame was built from (this frame only waits for
        // the catch-up, or something the screen read moved and changed nothing), the engine keeps that frame's
        // elements and no element is built again.
        const look = [this.handle.description, scale(), this.handle.document?.scrollTarget ?? null];
        const same = !!this.look && look.every((part, i) => part === this.look[i]);
        // `mode`: how the elements are wrapped for the keyboard, part of what the kept frame was built with.
        const draw = (mode, wrap) => {
          if (same && mode === this.mode) return unchanged();
          // Vertical lengths are laid on the window's device pixels (`snapColumns` in the runtime).
          // A screen in a region of the window (a sidebar, a status bar) portals into the window's layer.
          const built = wrap(describeToGpui(this.handle.description, this.kit, this.handle, files, scale(), inRegion));
          // Only a build that finished is one to keep: one the engine cut off (its time budget) drew nothing.
          this.look = look;
          this.mode = mode;
          return built;
        };
        // Effects that measured a box older than the tree run again once this frame has laid it out.
        if (this.handle.drawing?.()) {
          cx.timer.after(0, () => {
            if (copy.closed) return;
            copy.enter();
            this.handle.retry();
          });
        }
        // A page that listens for keys on the window (the Keyboard page, recording one) gets every key, Escape too.
        if (options.escapeForKeys) {
          const listening = this.handle.listensFor("keydown");
          copy.host.holdEscape("keys", listening);
          if (listening && this.keys && !this.keys.is_focused() && !this.taking) {
            this.taking = true;
            cx.timer.after(0, (task) => {
              this.taking = false;
              if (!this.keys.is_focused()) this.keys.focus();
              task.notify();
            });
          }
        }
        if (!this.keys) return draw(0, (drawn) => drawn);
        // An engine slot that took the keyboard (a press on it) is the document's focused element, as on the web.
        const engine = focusedEngine(copy.host, this.handle.document);
        if (engine && this.handle.document.activeElement !== engine && !this.focusingEngine) {
          this.focusingEngine = true;
          cx.timer.after(0, (task) => {
            this.focusingEngine = false;
            if (copy.closed) return;
            copy.enter();
            this.handle.focus(engine.id);
            task.notify();
          });
        }
        const ownFocus = this.keys.is_focused() || !!engine;
        // Nothing of its own is focused any more (its form closed), or the keyboard went elsewhere: it lets go.
        if (this.held && (!focusedHere(this.handle.document) || (this.armed && !ownFocus))) this.hold(false);
        // Not holding it, an in-flow screen takes no keyboard: a press on it leaves the keyboard where it was.
        if (options.keyboard === "in-flow" && !this.held) return draw(1, (drawn) => drawn);
        return draw(2, (drawn) => drawn.track_focus(this.keys).on_key_down((event, cx) => {
          // A key from an engine inside the screen (its focus is not the screen's own) is the engine's alone.
          if (!this.keys.is_focused()) return;
          if (this.handle.key(domKey(event))) cx.stop_propagation();
          cx.notify();
        }));
      });
    }
  };
}
