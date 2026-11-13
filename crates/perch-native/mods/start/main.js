// The web app's stock start page, unchanged (`start/` is the app's own export of `packages/web/src/stock-ui/start`),
// on the native React runtime: the window draws this mod in the main area while nothing is open in it, with the web's
// props (`perch.props()`: `connecting` while the core is away, `workspace` for a focused workspace with no session,
// else `home`), and acts on each action it closes with (the window keeps the chosen place). Every element the parity
// table names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `start/`
// is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from `<native-mods>/.stock/start/` to
// `<native-mods>/start/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import Start from "./start/main.js";

/** The main area's box: the page is a column that fills it. */
const AREA = { display: "flex", flexDirection: "column", width: "100%", height: "100%" };

export default screen("start", Start, { container: AREA });
