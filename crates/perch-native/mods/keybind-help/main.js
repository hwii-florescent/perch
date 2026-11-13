// The web app's stock keybind help, unchanged (`keybind-help/` is the app's own export of
// `packages/web/src/stock-ui/keybind-help`), on the native React runtime: the window opens this mod as its
// `keybind-help` screen over the whole window (Cmd+/, a plain `?` outside a terminal or field, the leader chord then
// `?`), with the web's props (`perch.props()`); its rows are `perch.keybindings()`. Every element the parity table
// names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `keybind-help/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/keybind-help/` to `<native-mods>/keybind-help/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import KeybindHelp from "./keybind-help/main.js";

/** The web portals the help into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("keybind-help", KeybindHelp, { container: WINDOW, keyboard: true });
