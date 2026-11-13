// The web app's stock sidebar, unchanged (`sidebar/` is the app's own export of `packages/web/src/stock-ui/sidebar`),
// on the native React runtime: the window places this mod in the sidebar's place because its id is `sidebar`.
// Every element the parity table names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one (`runtime.mjs`, `host.js`, `screen.js`, `react.js`, ...) are `mods/react-runtime/`,
// which the mod host writes into this folder; `sidebar/` is written by `mods-runtime/react/build.mjs`. To change the
// sidebar, copy this folder from `<native-mods>/.stock/sidebar/` to `<native-mods>/sidebar/` and edit the plain JS
// there; it reloads on save. `folder-browser/` is the stock folder browser its Add project dialog draws, and
// `worktree/` the stock worktree menu on each git project's row.
import { screen } from "./screen.js";
import { sdk } from "./runtime.mjs";
import Sidebar from "./sidebar/main.js";
import FolderBrowser from "./folder-browser/main.js";
import Worktree from "./worktree/main.js";

// The Add project dialog draws the folder browser in place (`FolderBrowser` in `@perch/sdk`), and a git project's +
// its worktree menu (`WorktreeMenu`): this folder's own copies.
sdk.drawFolderBrowserInPlace(FolderBrowser);
sdk.drawWorktreeInPlace(Worktree);

/** The box the sidebar fills, as the web lays it on its card. */
const CARD = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--card-bg)" };

// The keyboard comes to the sidebar while one of its own fields has it (the Add project form), and goes back after.
export default screen("sidebar", Sidebar, { container: CARD, keyboard: "in-flow", alsoNamed: ["folder-browser", "worktree"] });
