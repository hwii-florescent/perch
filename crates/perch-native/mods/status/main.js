// The web app's stock status bar, unchanged (`status/` is the app's own export of `packages/web/src/stock-ui/status`),
// on the native React runtime: the window places this mod along the bottom because its id is `status`. To change it,
// copy this folder from `<native-mods>/.stock/status/` to `<native-mods>/status/` and edit the plain JS there; it
// reloads on save. The runtime files beside this one are `mods/react-runtime/`, written into this folder by the mod
// host.
import { screen } from "./screen.js";
import StatusBar from "./status/main.js";

/** The box the bar fills, as the web lays it on its card. */
const CARD = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--card-bg)", position: "relative" };

export default screen("status", StatusBar, { container: CARD, props: (raw) => raw });
