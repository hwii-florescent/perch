// The web app's stock pane menu (a pane's right-click menu), unchanged (`pane-menu/` is the app's own export of
// `packages/web/src/stock-ui/pane-menu`), on the native React runtime: the window opens this mod as its `pane-menu`
// screen over the whole window, with the web's props (`perch.props()`, the press's `x`, `y`), and acts on the result
// it closes with. Every element the parity table names (`e2e/native-parity/named-elements.json`) has that name as its
// id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `pane-menu/`
// is written by `mods-runtime/react/build.mjs`. To change the menu, copy this folder from
// `<native-mods>/.stock/pane-menu/` to `<native-mods>/pane-menu/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import PaneMenu from "./pane-menu/main.js";

/** The web portals the menu into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("pane-menu", PaneMenu, { container: WINDOW, keyboard: true });
