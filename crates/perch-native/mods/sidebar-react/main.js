// The stock sidebar, unchanged, on the native React runtime: `sidebar/` is the app's own export of
// `packages/web/src/stock-ui/sidebar`, `runtime.mjs` renders it into a host tree, computes each element's style from
// the app's compiled stylesheet and describes it as gpui-kit elements. `host.js` is the `perch` host it runs on.
// Every element the parity table names (`e2e/native-parity/named-elements.json`) has that name as its id.
// Generated files are written by `crates/perch-native/mods-runtime/react/build.mjs`; this file and `host.js` are not.
import { asRender, files, host, refresh, setContext } from "./host.js";
import { View, div, image } from "gpui-kit";
import { describeToGpui, mount, NAMED_ELEMENTS } from "./runtime.mjs";
import Sidebar from "./sidebar/main.js";

const KIT = { div, image };
/** The box the sidebar fills, as the web lays it on its card. */
const CARD = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--card-bg)" };

// `render()` has a 50 ms script budget per frame (an event or a timer has 500 ms), so catching up with new data,
// which re-renders React and describes the tree again, runs in a timer, and `render()` draws the last description.
export default class SidebarReact extends View {
  init(_props, cx) {
    setContext(cx);
    this.handle = mount(host, Sidebar, { container: CARD, names: NAMED_ELEMENTS.sidebar });
  }

  render(cx) {
    return asRender(() => {
      // The engine runs this again when data the sidebar read changed: read it again, and let React catch up in a
      // timer when it did (this frame shows the last description).
      if (refresh(false)) {
        cx.timer.after(0, (task) => {
          refresh(true);
          this.handle.flush();
          task.notify();
        });
      }
      return describeToGpui(this.handle.description, KIT, this.handle, files);
    });
  }
}
