// The web app's stock Project memory dialog, unchanged (`memory/` is the app's own export of
// `packages/web/src/stock-ui/memory`), on the native React runtime: the window opens this mod as its `memory` screen
// over the whole window when the sidebar's project menu picks Memory… (`MemoryDialog` in `@perch/sdk`), with the
// web's props (`perch.props()`: `projectId`, `name`). It lists, opens, saves and deletes files through the core
// (`memory.list`, `memory.get`, `memory.set`, `memory.delete`, and `memory.enable` where the core can turn memory
// off), as the web's client does; a stale revision is the core's to refuse. A delete asks first with the stock
// confirmation, drawn in place over the dialog (`confirm/`, the app's own export of `stock-ui/confirm`). Close,
// Escape and a press on the backdrop close it. Every element the parity table names
// (`e2e/native-parity/named-elements.json`) has that name as its id.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder; `memory/`
// and `confirm/` are written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/memory/` to `<native-mods>/memory/` and edit the plain JS there; it reloads on save.
// `screen.js` first: it sets up the host the runtime reads when it loads.
import { closeWith, screen } from "./screen.js";
import { runningHost } from "./host.js";
import { sdk } from "./runtime.mjs";
import Memory from "./memory/main.js";
import Confirm from "./confirm/main.js";

sdk.drawConfirmationsInPlace(Confirm);

/** The web portals the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

function props(raw) {
  const projectId = String(raw.projectId ?? "");
  const ask = (kind, args) => runningHost().ask(kind, { projectId, ...args });
  return {
    projectId,
    name: String(raw.name ?? ""),
    onClose: () => closeWith(null),
    list: () => ask("memory.list", {}),
    get: (name) => ask("memory.get", { name }),
    save: (name, text, baseRevision) => ask("memory.set", { name, text, baseRevision: baseRevision ?? null }),
    remove: (name, baseRevision) => ask("memory.delete", { name, baseRevision }),
    setEnabled: runningHost().coreCan("memory.off.v1") ? (enabled) => ask("memory.enable", { enabled: !!enabled }) : undefined,
  };
}

export default screen("memory", Memory, { container: WINDOW, keyboard: true, props });
