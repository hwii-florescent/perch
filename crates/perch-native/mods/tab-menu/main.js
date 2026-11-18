// The web app's stock tab menu, unchanged (`tab-menu/` is the app's own export of `packages/web/src/stock-ui/tab-menu`),
// on the native React runtime: the window opens this mod as its `tab-menu` screen over the whole window, for a tab
// (the strip's `tab.menu`, a pane menu's "Show beside an open tab…") or a sidebar row (`SessionMenu`), with the web's
// props (`perch.props()`: what may be done, the open tabs a split can take) and acts on the result it closes with:
// `actions.x(...args)` is `{ action, args }`, a row of `extraItems` is `{ item: testId }`.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `tab-menu/`
// is written by `mods-runtime/react/build.mjs`. To change the menu, copy this folder from
// `<native-mods>/.stock/tab-menu/` to `<native-mods>/tab-menu/` and edit the plain JS there; it reloads on save.
import { screen, resultProps, closeWith } from "./screen.js";
import TabMenu from "./tab-menu/main.js";

/** The web portals the menu into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

const props = (raw) => ({
  ...resultProps(raw),
  extraItems: (raw.extraItems ?? []).map((item) => ({ ...item, onSelect: () => closeWith({ item: item.testId }) })),
});

export default screen("tab-menu", TabMenu, { container: WINDOW, keyboard: true, props });
