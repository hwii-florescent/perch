// The web app's stock notifications, unchanged (`toast/` is the app's own export of `packages/web/src/stock-ui/toast`),
// on the native React runtime: the window draws this mod as its `toast` screen over the whole window, on a layer that
// takes no input of its own, so presses beside the cards reach what is beneath and the keyboard stays where it is. The
// list is the window's (`useNotifications` over `perch.notifications()`); a card opens what it is about
// (`notification.open`) and × puts it away (`notification.dismiss`). Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `toast/` is
// written by `mods-runtime/react/build.mjs`. To change the notifications, copy this folder from
// `<native-mods>/.stock/toast/` to `<native-mods>/toast/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import Notifications from "./toast/main.js";

/** The web portals the list into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("toast", Notifications, { container: WINDOW });
