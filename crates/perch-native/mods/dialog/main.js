// The web app's stock dialog (the modal shell of Perch's forms, `Dialog` in `@perch/sdk`, compiled from
// `packages/web/src/stock-ui/dialog`) with what its callers put in it: the file menu's name prompts (`file-menu/`, the
// app's own export of `packages/web/src/stock-ui/file-menu`), unchanged, on the native React runtime. A script opens
// it with `perch.openScreen("dialog", props)` and the web's `FileMenuScreenProps` (`initialStage: "newFile"` or
// `"newFolder"`); the window draws it over the whole window, and it closes with the action the prompt asked for
// (`{ action: "createFileAt", args: [folder, name] }`, `{ action: "mutate", args: ["createDir", path] }`), or with
// nothing when cancelled. No window caller opens it yet: the native client has no file explorer.
//
// An action's refusal is the caller's answer, given while the prompt stays open; a screen closes with its result, so a
// caller cannot answer. `rejects` in the props stands for that answer (every action refuses with it), so the prompt's
// error line can be drawn.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `file-menu/` and `dialog/` are written by `mods-runtime/react/build.mjs`. To change the dialog, copy this folder from
// `<native-mods>/.stock/dialog/` to `<native-mods>/dialog/` and edit the plain JS there; it reloads on save.
import { resultProps, screen } from "./screen.js";
import FileMenu from "./file-menu/main.js";

const nothing = () => {};

function props(raw) {
  const out = { onOpenFile: nothing, onExpand: nothing, onRefresh: nothing, target: null, held: null, ...resultProps(raw) };
  if (typeof raw.rejects === "string") {
    out.actions = new Proxy({}, { get: () => () => Promise.reject(new Error(raw.rejects)) });
  }
  return out;
}

/** The web portals the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("dialog", FileMenu, { container: WINDOW, keyboard: true, props });
