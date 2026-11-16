// The web app's stock files screen, unchanged (`files/` is the app's own export of `packages/web/src/stock-ui/files`), on
// the native React runtime: the window places a copy in the drawer's Files tab (`layout: "explorer"`) and one in each
// file tab's pane (`layout: "editor"`), each with the web's props. Its drafts are the window's file store's, so a copy
// that reloads or is swapped for a clone loses none. To change it, copy this folder from `<native-mods>/.stock/files/`
// to `<native-mods>/files/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import { runCommand } from "@perch/sdk";
import Files from "./files/main.js";

/** The box the screen fills: its pane or the drawer's body. */
const BOX = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", position: "relative", containerType: "inline-size" };

/** The web's props; a file opened from the explorer opens in a tab (the workspace's preview tab unless `pinned`). */
const props = (raw) => ({
  ...raw,
  onOpenFile: (path, pinned) => runCommand("file.open", { workspaceId: raw.workspaceId, path, preview: !pinned }),
});

export default screen("files", Files, { container: BOX, props, keyboard: "in-flow" });
