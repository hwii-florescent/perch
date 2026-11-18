// The web app's stock Navigator (the command palette), unchanged (`navigator/` is the app's own export of
// `packages/web/src/stock-ui/navigator`), on the native React runtime: the window opens this mod as its `navigator`
// screen over the whole window, with the web's props (`perch.props()`), and acts on the result it closes with.
// Every element the parity table names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `navigator/`
// is written by `mods-runtime/react/build.mjs`. To change the Navigator, copy this folder from
// `<native-mods>/.stock/navigator/` to `<native-mods>/navigator/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import Navigator from "./navigator/main.js";

/** The web portals the palette into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("navigator", Navigator, { container: WINDOW, keyboard: true });
