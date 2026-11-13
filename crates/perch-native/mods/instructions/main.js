// The web app's stock Instructions dialog, unchanged (`instructions/` is the app's own export of
// `packages/web/src/stock-ui/instructions`), on the native React runtime: the window opens this mod as its
// `instructions` screen over the whole window when the sidebar's project or workspace menu picks Instructions…
// (`InstructionsDialog` in `@perch/sdk`), with the web's props (`perch.props()`: `scope`, `id`, `name`). It loads and
// saves through the core (`instructions.get`, `instructions.set`), as the web's client does; Save closes it once the
// core takes the text, and Cancel, Escape and a press on the backdrop close it. Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `instructions/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/instructions/` to `<native-mods>/instructions/` and edit the plain JS there; it reloads on
// save.
import { closeWith, screen } from "./screen.js";
import { runningHost } from "./host.js";
import Instructions from "./instructions/main.js";

/** The web portals the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

function props(raw) {
  const scope = raw.scope === "workspace" ? "workspace" : "project";
  const id = String(raw.id ?? "");
  return {
    scope,
    id,
    name: String(raw.name ?? ""),
    onClose: () => closeWith(null),
    load: () => runningHost().ask("instructions.get", { scope, id }),
    save: (text, folders) => runningHost().ask("instructions.set", { scope, id, text, folders }),
  };
}

export default screen("instructions", Instructions, { container: WINDOW, keyboard: true, props });
