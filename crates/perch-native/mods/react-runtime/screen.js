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
// `{ cwd, agent }`, `onSubmit(value)` is `{ value }` and `actions.x(...args)` is `{ action: "x", args }`.
// `options.props(raw)` replaces that mapping for a screen whose callbacks differ.
//
// The web reads its per-viewer settings (`localStorage`, here the window's sidebar settings) once, when it mounts;
// when they change anywhere but in the screen (a key such as `sidebar.organize`), the screen is mounted again.
//
// This file is written by hand and shared by every React screen (`mods/react-runtime/`, which the mod host writes into
// each screen's folder); `build.mjs` leaves it alone.
import { asRender, files, host, refresh, setContext, settingsMoved } from "./host.js";
import { View, div, image } from "gpui-kit";
import { ScrollHandle } from "gpui-base";
import { close, props as screenProps, scale } from "perch";
import { describeToGpui, mount, NAMED_ELEMENTS } from "./runtime.mjs";

const KIT = { div, image };

/** The web's callback props for a screen opened with `raw`, each closing the screen with its result. */
export function resultProps(raw) {
  return {
    ...raw,
    onClose: () => close(),
    onConfirm: () => close({ confirmed: true }),
    onCancel: () => close({ confirmed: false }),
    onSelect: (cwd, agent) => close({ cwd, agent }),
    onSubmit: (value) => close({ value }),
    actions: new Proxy({}, { get: (_, action) => (...args) => close({ action: String(action), args }) }),
  };
}

/** The mod class for stock screen `id` drawn by `Component`. `options.container`: the style of the box the screen
 * fills (as the web's layout gives it); `options.props`: props from `perch.props()` (default `resultProps`). */
export function screen(id, Component, options = {}) {
  const toProps = options.props ?? resultProps;
  return class Screen extends View {
    init(_props, cx) {
      setContext(cx);
      this.raw = JSON.stringify(screenProps());
      this.mounts = 0;
      const props = { ...toProps(JSON.parse(this.raw)), key: this.mounts };
      this.handle = mount(host, Component, { container: options.container, names: NAMED_ELEMENTS[id], props });
      // Where `scrollIntoView()` leaves its request (a handle can only be made here, not while drawing).
      this.kit = { ...KIT, scroll: ScrollHandle.new() };
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
        return describeToGpui(this.handle.description, this.kit, this.handle, files, scale());
      });
    }
  };
}
