// The web app's stock drawer Browser section, unchanged (`browser/` is the app's own export of
// `packages/web/src/stock-ui/browser`), on the native React runtime: the window draws it in the drawer while the
// drawer shows Browser, with the workspace shown as `perch.props()` (`{ workspaceId }`). Its pages are the window's
// (`useBrowserPages`); `BrowserPage` is a box the window fills with the native page and its toolbar
// (`data-perch-engine="browser"`). To change it, copy this folder from `<native-mods>/.stock/browser/` to
// `<native-mods>/browser/` and edit the plain JS there; it reloads on save. The runtime files beside this one are
// `mods/react-runtime/`, written into this folder by the mod host.
import { screen } from "./screen.js";
import Browser from "./browser/main.js";

/** The drawer's body, as the web lays the section in it. */
const BODY = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", position: "relative" };

export default screen("browser", Browser, {
  container: BODY,
  props: (raw) => ({ workspaceId: typeof raw.workspaceId === "string" ? raw.workspaceId : "" }),
});
