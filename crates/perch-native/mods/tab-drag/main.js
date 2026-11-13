// The web app's stock tab drag layer, unchanged (`tab-drag/` is the app's own export of
// `packages/web/src/stock-ui/tab-drag`), on the native React runtime: while a tab is dragged off the strip the window
// draws this mod as its `tab-drag` screen over the whole window, with the drag in flight as the web's `TabDragLayer`
// hands it (`perch.props().drag`: the pointer, whether it is over the strip, and the pane a drop would split with the
// half it would take). The drag itself (the pointer, where a drop lands, the move or split it makes) is the window's.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `tab-drag/`
// is written by `mods-runtime/react/build.mjs`. To change the layer, copy this folder from
// `<native-mods>/.stock/tab-drag/` to `<native-mods>/tab-drag/` and edit the plain JS there; it reloads on save.
import { screen } from "./screen.js";
import TabDrag from "./tab-drag/main.js";

/** The web portals the layer into the page: the screen's own box is the whole window. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("tab-drag", TabDrag, { container: WINDOW });
