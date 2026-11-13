// The web app's stock Split with session picker, unchanged (`session-split/` is the app's own export of
// `packages/web/src/stock-ui/session-split`), on the native React runtime: the window opens this mod as its
// `session-split` screen over the whole window from the pane menu's "Add session inside this tab…", with the web's
// props (`perch.props()`: the workspace's other sessions, the press's `x`, `y`), and splits the session picked in
// beside the pane the menu was opened on. A row's drag is a tab drag (`beginTabDrag`), which the window carries.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `session-split/` is written by `mods-runtime/react/build.mjs`. To change the picker, copy this folder from
// `<native-mods>/.stock/session-split/` to `<native-mods>/session-split/` and edit the plain JS there; it reloads on
// save.
import { screen, resultProps, closeWith } from "./screen.js";
import { sdk } from "./runtime.mjs";
import SessionSplit from "./session-split/main.js";

/** The web portals the picker into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

/** `onPick(id)` closes with `{ pick: id }`; a row's drag carries the session as a tab drag. */
const props = (raw) => ({
  ...resultProps(raw),
  onPick: (id) => closeWith({ pick: id }),
  beginDrag: (event, id) => sdk.beginTabDrag(event, id, raw.sessions?.find((s) => s.id === id)?.title ?? id),
});

/** Names of its parts (the parity table has none for this screen): the picker, its title and one row per session. */
const names = [
  { name: "session-split", selector: '[data-testid="session-split-popover"]' },
  { name: "session-split-header", selector: ".session-split-popover__header" },
  { name: "session-split-empty", selector: ".session-split-popover__empty" },
  { name: "session-split-option", selector: ".session-split-popover__item", key: { self: true, attr: "data-testid", strip: "session-split-option-" } },
];

export default screen("session-split", SessionSplit, { container: WINDOW, keyboard: true, props, names });
