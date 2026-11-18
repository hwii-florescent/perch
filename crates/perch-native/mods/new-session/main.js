// The web app's stock New session menu, unchanged (`new-session/` is the app's own export of
// `packages/web/src/stock-ui/new-session`), on the native React runtime: the window opens this mod as its `new-session`
// screen over the whole window and starts the session the result names (`{ cwd, agent }`). Every element the parity
// table names (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The window gives the anchor as a plain box (`{ x, y, width, height }`); the web reads a `DOMRect`, so its edges are
// added here. An extra (a browser, a file, as the tab strip offers) gets the tab strip's own icon (`tabs/`, the app's
// export of `packages/web/src/stock-ui/tabs`) and closes the screen with `{ extra: id }`.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `new-session/` and `tabs/` are written by `mods-runtime/react/build.mjs`. To change the menu, copy this folder from
// `<native-mods>/.stock/new-session/` to `<native-mods>/new-session/` and edit the plain JS there; it reloads on save.
import { closeWith, resultProps, screen } from "./screen.js";
import { React } from "./runtime.mjs";
import NewSessionMenu from "./new-session/main.js";
import { BrowserIcon, FileIcon } from "./tabs/icons.js";

const ICONS = { browser: BrowserIcon, file: FileIcon };

/** A plain box as the `DOMRect` the web reads. */
function rect({ x = 0, y = 0, width = 0, height = 0 } = {}) {
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}

function props(raw) {
  const out = { ...resultProps(raw), anchorRect: rect(raw.anchorRect) };
  if (raw.fixedCwd === null) delete out.fixedCwd;
  if (Array.isArray(raw.extras)) {
    out.extras = raw.extras.map((extra) => ({
      ...extra,
      icon: ICONS[extra.id] ? React.createElement(ICONS[extra.id]) : undefined,
      onSelect: () => closeWith({ extra: extra.id }),
    }));
  } else delete out.extras;
  return out;
}

/** The web portals the menu into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("new-session", NewSessionMenu, { container: WINDOW, keyboard: true, props });
