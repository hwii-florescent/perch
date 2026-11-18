// The web app's stock phone-size notice, unchanged (`phone-size/` is the app's own export of
// `packages/web/src/stock-ui/phone-size`), on the native React runtime: the window draws this mod over a terminal
// pane while a paired phone holds its size and this window may take it back, one copy per pane
// (`phone-size#<tab id>`), with the web's props (`perch.props()`: `id`, the tab, `generation`, which a new hold
// raises so a folded notice shows again, and `pending`). Take back this tab and Take back all tabs are the window's
// (`terminal.takeBack` for that tab, `terminal.takeBackAll`); × folds it to a chip. The notice is drawn in the
// terminal's frame (`.terminal`, as the web holds it), at its top right. Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `phone-size/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/phone-size/` to `<native-mods>/phone-size/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import { React } from "./runtime.mjs";
import { runningHost } from "./host.js";
import Notice from "./phone-size/main.js";

const { createElement } = React;

/** The pane's box: the screen is the pane, its terminal drawn beneath by the window. */
const PANE = { display: "flex", width: "100%", height: "100%" };

function PhoneSize({ id, generation, pending }) {
  const run = (command, args) => runningHost().command(command, args);
  return createElement(
    "div",
    { className: "terminal terminal--persistent", "data-testid": "persistent-agent-terminal" },
    createElement(Notice, {
      generation,
      pending,
      onThisTab: () => run("terminal.takeBack", { id }),
      onAllTabs: () => run("terminal.takeBackAll", {}),
    }),
    createElement("div", { className: "terminal__surface" }),
  );
}

function props(raw) {
  return { id: String(raw.id ?? ""), generation: Number(raw.generation) || 0, pending: raw.pending === true };
}

export default screen("phone-size", PhoneSize, { container: PANE, props });
