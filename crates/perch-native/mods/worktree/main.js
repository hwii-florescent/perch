// The web app's stock worktree menu, unchanged (`worktree/` is the app's own export of
// `packages/web/src/stock-ui/worktree`), on the native React runtime, as a screen of its own: the menu's "+" at the
// fixture's place (`at`) with the web's props (`perch.props()`: `hostId`, `cwd`, and what the computer can do when
// given). The window draws the sidebar's own copy of it, in place on each git project's row (`WorktreeMenu` in
// `@perch/sdk`); this screen has no place in the window yet. The worktrees and every operation are the core's
// (`worktree.list`, `worktree.create` or `worktree.job.start`, `worktree.remove`, `worktree.branch.delete`), and the
// questions before a removal are the stock confirmation, drawn in place (`confirm/`). Every element the parity table
// names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `worktree/`
// and `confirm/` are written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/worktree/` to `<native-mods>/worktree/` and edit the plain JS there; it reloads on save.
// `screen.js` first: it sets up the host the runtime reads when it loads.
import { screen } from "./screen.js";
import { React, sdk } from "./runtime.mjs";
import Worktree from "./worktree/main.js";
import Confirm from "./confirm/main.js";

sdk.drawWorktreeInPlace(Worktree);
sdk.drawConfirmationsInPlace(Confirm);

/** The web portals the popover into the page: the screen's own box is the whole window, the "+" at `at` in it. */
const WINDOW = { position: "relative", width: "100%", height: "100%" };

const flag = (value) => (typeof value === "boolean" ? value : undefined);

function Menu({ at, ...props }) {
  return React.createElement("div", { style: { position: "absolute", left: at.x, top: at.y } }, React.createElement(sdk.WorktreeMenu, props));
}

function props(raw) {
  const at = { x: Number(raw.at?.x) || 0, y: Number(raw.at?.y) || 0 };
  return {
    at,
    hostId: typeof raw.hostId === "string" ? raw.hostId : "local",
    path: String(raw.cwd ?? ""),
    worktrees: raw.worktrees && typeof raw.worktrees === "object" ? raw.worktrees : undefined,
    background: flag(raw.background),
    startFromSupported: flag(raw.startFromSupported),
    deleteSupported: flag(raw.deleteSupported),
    parentChoices: Array.isArray(raw.parentChoices) ? raw.parentChoices : undefined,
    emptyAgent: typeof raw.emptyAgent === "string" ? raw.emptyAgent : undefined,
    request: raw.request && typeof raw.request === "object" ? raw.request : null,
  };
}

export default screen("worktree", Menu, { container: WINDOW, keyboard: true, props });
