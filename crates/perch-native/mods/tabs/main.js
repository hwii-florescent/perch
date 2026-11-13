// The web app's stock tab strip, unchanged (`tabs/` is the app's own export of `packages/web/src/stock-ui/tabs`), on
// the native React runtime: the window places this mod above the panes because its id is `tabs`. To change it, copy
// this folder from `<native-mods>/.stock/tabs/` to `<native-mods>/tabs/` and edit the plain JS there; it reloads on
// save. The runtime files beside this one are `mods/react-runtime/`, written into this folder by the mod host.
import { screen } from "./screen.js";
import TabBar from "./tabs/main.js";

/** The box the strip fills, as the web lays it on its card. */
const CARD = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--card-bg)", position: "relative" };

export default screen("tabs", TabBar, { container: CARD, props: (raw) => raw });
