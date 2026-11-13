// The web app's stock folder browser, unchanged (`folder-browser/` is the app's own export of
// `packages/web/src/stock-ui/folder-browser`), on the native React runtime, as a screen of its own: the browser's box
// alone, with the web's props (`perch.props()`: `hostId`). The window draws the sidebar's own copy of it, in place in
// its Add project dialog (`FolderBrowser` in `@perch/sdk`); this screen has no place in the window yet. The host
// lists a folder through `perch.browse(hostId, path)` (the core's `fs.browse`, which routes a remote host's listing),
// and the folder used is the screen's result (`{ path }`). Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `folder-browser/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/folder-browser/` to `<native-mods>/folder-browser/` and edit the plain JS there; it reloads
// on save.
import { closeWith, screen } from "./screen.js";
import { runningHost } from "./host.js";
import FolderBrowser from "./folder-browser/main.js";

/** The browser's box as the Add project dialog gives it: the dialog's panel and its padding. */
const BOX = { display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 16, background: "var(--panel-bg)" };

function props(raw) {
  const hostId = typeof raw.hostId === "string" ? raw.hostId : "local";
  return {
    hostId,
    browse: (path) => runningHost().browse(hostId, path),
    onUseFolder: (path) => closeWith({ path }),
  };
}

export default screen("folder-browser", FolderBrowser, { container: BOX, keyboard: true, props });
