// The web app's stock dialog (the modal shell of Perch's forms, `Dialog` in `@perch/sdk`, compiled from
// `packages/web/src/stock-ui/dialog`) with what its callers put in it: the file menu's name prompts (`file-menu/`, the
// app's own export of `packages/web/src/stock-ui/file-menu`), unchanged, on the native React runtime. A script opens
// it with `perch.openScreen("dialog", props)` and the web's `FileMenuScreenProps` (`initialStage: "newFile"` or
// `"newFolder"`); the window draws it over the whole window, and it closes with the action the prompt asked for
// (`{ action: "createFileAt", args: [folder, name] }`, `{ action: "mutate", args: ["createDir", path] }`), or with
// nothing when cancelled. The explorer's right-click menu and New file open it (`FileEntryMenu`, `NewFilePrompt`):
// the menu's Open, Refresh and a folder to show close it with `openFile`, `refresh` and `expand`, and a free name for
// a copy is worked out here from the folders' names the caller gave (`names`, by folder).
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

/** `name` itself if free in `taken`, else Finder-style "name copy.ext", "name copy 2.ext", … (the web's `freeName`). */
function freeName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 1; ; n += 1) {
    const candidate = `${stem} copy${n > 1 ? ` ${n}` : ""}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function props(raw) {
  const out = { target: null, held: null, ...resultProps(raw) };
  const closing = out.actions;
  // An action closes the screen with itself as the result; the prompt waits on nothing more.
  const pending = () => new Promise(() => {});
  out.actions = new Proxy({}, {
    get: (_, action) => {
      if (typeof raw.rejects === "string") return () => Promise.reject(new Error(raw.rejects));
      if (action === "freeName") return (name, dir) => freeName(name, new Set(raw.names?.[dir] ?? []));
      return (...args) => { closing[action](...args); return pending(); };
    },
  });
  out.onOpenFile = (path) => out.actions.openFile(path);
  out.onExpand = (path) => out.actions.expand(path);
  out.onRefresh = () => out.actions.refresh();
  return out;
}

/** The web portals the dialog into the page: the screen's own box is the whole window and draws nothing. */
const WINDOW = { width: "100%", height: "100%" };

export default screen("dialog", FileMenu, { container: WINDOW, keyboard: true, props });
