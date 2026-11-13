// The web app's stock pane header, unchanged (`pane-header/` is the app's own export of
// `packages/web/src/stock-ui/pane-header`), on the native React runtime: the window places one copy over each pane of a
// split because its id is `pane-header`, with the pane's tab as `perch.props()` (`{ id, corner }`). To change it, copy
// this folder from `<native-mods>/.stock/pane-header/` to `<native-mods>/pane-header/` and edit the plain JS there; it
// reloads on save. The runtime files beside this one are `mods/react-runtime/`, written into this folder by the mod
// host.
import { screen } from "./screen.js";
import PaneHeader from "./pane-header/main.js";

/** The box the header fills, as the web lays it on its card. */
const CARD = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--card-bg)", position: "relative" };

export default screen("pane-header", PaneHeader, { container: CARD, props: (raw) => raw });
