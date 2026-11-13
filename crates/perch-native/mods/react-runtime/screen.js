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
// `{ cwd, agent }`, `onSubmit(value)` is `{ value }`, the close guard's `onStop(never)` is `{ confirmed: true, never }`
// and `onKeepRunning()` is `{ keepRunning: true }`, and `actions.x(...args)` is `{ action: "x", args }`.
// `options.props(raw)` replaces that mapping for a screen whose callbacks differ. The web often calls an action and
// `onClose()` from one handler, in either order; the screen closes once, at the end of that turn, with the action's
// result when there was one (a plain close is the dismissal `null`).
//
// The keyboard (`options.keyboard`, for a modal screen): the screen takes it when the source focuses one of its
// elements (an `autoFocus` field, `ref.focus()`, a press on a field), and every key it then gets goes to the focused
// element as a DOM `keydown`, through the document's listeners, and types into a text field (`handle.key`). Escape is
// the window's: it closes the screen before the mod sees it. A screen without the option never takes the keyboard (the
// notifications, over a terminal that keeps it).
//
// The web reads its per-viewer settings (`localStorage`, here the window's sidebar settings) once, when it mounts;
// when they change anywhere but in the screen (a key such as `sidebar.organize`), the screen is mounted again.
//
// This file is written by hand and shared by every React screen (`mods/react-runtime/`, which the mod host writes into
// each screen's folder); `build.mjs` leaves it alone.
import { asRender, files, host, onFocus, refresh, setContext, settingsMoved } from "./host.js";
import { View, div, image } from "gpui-kit";
import { close, props as screenProps, scale } from "perch";
import { describeToGpui, mount, NAMED_ELEMENTS } from "./runtime.mjs";

const KIT = { div, image };

// The result the screen closes with at the end of this turn (`undefined`: none yet).
let ending;
/** Closes the screen with `result` once the current handler has run: a result outranks a plain close (`null`). */
export function closeWith(result) {
  const first = ending === undefined;
  if (first || result !== null) ending = result;
  if (first) queueMicrotask(() => { const out = ending; ending = undefined; close(out ?? undefined); });
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
export function resultProps(raw) {
  return {
    ...raw,
    onClose: () => closeWith(null),
    onConfirm: () => closeWith({ confirmed: true }),
    onCancel: () => closeWith({ confirmed: false }),
    onSelect: (cwd, agent) => closeWith({ cwd, agent }),
    onSubmit: (value) => closeWith({ value }),
    onStop: (never) => closeWith({ confirmed: true, never: !!never }),
    onKeepRunning: () => closeWith({ keepRunning: true }),
    actions: new Proxy({}, { get: (_, action) => (...args) => closeWith({ action: String(action), args }) }),
  };
}

/** The mod class for stock screen `id` drawn by `Component`. `options.container`: the style of the box the screen
 * fills (as the web's layout gives it); `options.props`: props from `perch.props()` (default `resultProps`). */
export function screen(id, Component, options = {}) {
  const toProps = options.props ?? resultProps;
  return class Screen extends View {
    init(_props, cx) {
      setContext(cx);
      if (options.keyboard) {
        this.keys = cx.focus_handle();
        // The source focused an element: the keyboard comes to the screen (after this turn: focus needs the window).
        onFocus(() => cx.timer.after(0, () => { if (!this.keys.is_focused()) this.keys.focus(); }));
      }
      this.raw = JSON.stringify(screenProps());
      this.mounts = 0;
      const props = { ...toProps(JSON.parse(this.raw)), key: this.mounts };
      this.handle = mount(host, Component, { container: options.container, names: NAMED_ELEMENTS[id], props });
    }

    render(cx) {
      return asRender(() => {
        // `render()` has a 50 ms script budget per frame (an event or a timer has 500 ms), so catching up with new
        // data or props, which re-renders React and describes the tree again, runs in a timer, and this frame draws
        // the last description. The engine runs `render()` again when something the screen read changed.
        const raw = JSON.stringify(screenProps());
        if (refresh(false) || raw !== this.raw || settingsMoved()) {
          cx.timer.after(0, (task) => {
            refresh(true);
            // The web reads its view settings when it mounts: settings changed elsewhere mount it again.
            const moved = settingsMoved();
            if (moved) this.mounts += 1;
            if (raw !== this.raw || moved) {
              this.raw = raw;
              this.handle.update({ ...toProps(JSON.parse(raw)), key: this.mounts });
            }
            this.handle.flush();
            task.notify();
          });
        }
        // Vertical lengths are laid on the window's device pixels (`snapColumns` in the runtime).
        const drawn = describeToGpui(this.handle.description, KIT, this.handle, files, scale());
        if (!this.keys) return drawn;
        return drawn.track_focus(this.keys).on_key_down((event, cx) => {
          if (this.handle.key(domKey(event))) cx.stop_propagation();
          cx.notify();
        });
      });
    }
  };
}
