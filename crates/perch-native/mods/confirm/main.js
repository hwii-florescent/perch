// The web app's stock confirmation, unchanged (`confirm/` is the app's own export of `packages/web/src/stock-ui/confirm`),
// on the native React runtime: the window opens this mod as its `confirm` screen over the whole window and acts on the
// result it closes with (`{ confirmed }`). Every element the parity table names (`e2e/native-parity/named-elements.json`)
// has that name as its id.
//
// The close guard (`close-guard/`, the app's own export of `packages/web/src/stock-ui/close-guard`) asks through it:
// props that are the close guard's (`label`, as the window gives when an agent's tab is closed) draw the close guard,
// whose question is this confirmation drawn in place, with the guard's own rows in it; its answers close the screen
// with `{ confirmed: true, never, stopSubSessions }`, `{ keepRunning: true }` or `{ confirmed: false }`.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `confirm/` and
// `close-guard/` are written by `mods-runtime/react/build.mjs`. To change the confirmation, copy this folder from
// `<native-mods>/.stock/confirm/` to `<native-mods>/confirm/` and edit the plain JS there; it reloads on save.
// `screen.js` first: it sets up the host the runtime reads when it loads.
import { screen } from "./screen.js";
import { sdk, React } from "./runtime.mjs";
import Confirm from "./confirm/main.js";
import CloseGuard from "./close-guard/main.js";

sdk.drawConfirmationsInPlace(Confirm);

/** The close guard for its props, else the plain confirmation. */
function Question(props) {
  return React.createElement(props.label !== undefined ? CloseGuard : Confirm, props);
}

/** The web portals the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("confirm", Question, { container: WINDOW, keyboard: true });
