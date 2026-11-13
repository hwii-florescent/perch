// The web app's stock New session launcher, unchanged (`launcher/` is the app's own export of
// `packages/web/src/stock-ui/launcher`), on the native React runtime: the window opens this mod as its `launcher`
// screen over the whole window on Cmd+Shift+T, with the web's props (`perch.props()`: the computer's projects with the
// workspace a new tab lands in), and acts on the action it closes with. Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `launcher/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/launcher/` to `<native-mods>/launcher/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import Launcher from "./launcher/main.js";

/** The web portals the launcher into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("launcher", Launcher, { container: WINDOW, keyboard: true });
