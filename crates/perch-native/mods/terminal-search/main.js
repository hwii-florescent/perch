// The web app's stock terminal find bar, unchanged (`terminal-search/` is the app's own export of
// `packages/web/src/stock-ui/terminal-search`), on the native React runtime: the window draws this mod over a
// terminal pane while its find is open (the terminal's find key), one copy per pane (`terminal-search#<tab id>`),
// with the web's props (`perch.props()`: `id`, the tab, and `query`, the terminal's). The bar is drawn in the
// terminal's frame (`.terminal`, as the web holds it), at its top right. The query is held here as the terminal
// holds it and sent to the window (`terminal.findQuery`); Enter, Shift+Enter and the arrows find in the terminal's
// own buffer (`terminal.findNext`, `terminal.findPrevious`), and Escape or × closes find and gives the terminal its
// keyboard back (`terminal.findClose`). Nothing typed here reaches the terminal. Every element the parity table
// names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `terminal-search/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/terminal-search/` to `<native-mods>/terminal-search/` and edit the plain JS there; it
// reloads on save.
import { screen } from "./screen.js";
import { React } from "./runtime.mjs";
import { runningHost } from "./host.js";
import Bar from "./terminal-search/main.js";

const { createElement, useEffect, useState } = React;

/** The pane's box: the screen is the pane, its terminal drawn beneath by the window. */
const PANE = { display: "flex", width: "100%", height: "100%" };

function Find({ id, query: held }) {
  const [query, setQuery] = useState(held);
  // The terminal's query when it changes there (find opened again on a selection).
  useEffect(() => setQuery(held), [held]);
  const run = (command, args = {}) => runningHost().command(command, { id, ...args });
  const bar = createElement(Bar, {
    query,
    setQuery: (next) => {
      setQuery(next);
      run("terminal.findQuery", { query: next });
    },
    findNext: () => run("terminal.findNext"),
    findPrevious: () => run("terminal.findPrevious"),
    close: () => run("terminal.findClose"),
  });
  // The terminal's frame as the web's terminal holds its chrome (`TerminalFrame` in the reference's page).
  return createElement(
    "div",
    { className: "terminal terminal--persistent", "data-testid": "persistent-agent-terminal" },
    bar,
    createElement("div", { className: "terminal__surface" }),
  );
}

function props(raw) {
  return { id: String(raw.id ?? ""), query: typeof raw.query === "string" ? raw.query : "" };
}

export default screen("terminal-search", Find, { container: PANE, keyboard: "in-flow", props });
