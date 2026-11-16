// The web app's stock browser toolbar, unchanged (`browser-toolbar/` is the app's own export of
// `packages/web/src/stock-ui/browser-toolbar`), on the native React runtime: the window draws one copy over each
// browser page on screen (`browser-toolbar#<page key>`). The page, its address, the dropdown's rows and the keys that
// walk them are the window's (as the web's `WorkspaceBrowser`): `perch.props()` holds `key`, `native`, `started`,
// `icon`, the address `value`, its `rows` and the `picked` row, and every action is a window command (`browser.*`,
// with the page's `key`). The field keeps what is typed while it has the keyboard, so typing never waits for the
// window; the window's value comes back when the page moves on its own.
//
// The runtime files beside this one are `mods/react-runtime/`, which the mod host writes into this folder;
// `browser-toolbar/` is written by `mods-runtime/react/build.mjs`. To change it, copy this folder from
// `<native-mods>/.stock/browser-toolbar/` to `<native-mods>/browser-toolbar/` and edit the plain JS there; it reloads
// on save.
import { screen } from "./screen.js";
import { React } from "./runtime.mjs";
import { runningHost } from "./host.js";
import BrowserToolbar from "./browser-toolbar/main.js";

const { createElement, useEffect, useRef, useState } = React;

/** The box the toolbar fills, as the web lays it over the page. */
const BAR = { display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", position: "relative" };

/** Keys the window's address bar answers (the web's `onKeyDown`); any other key types. */
const BAR_KEYS = new Set(["ArrowDown", "ArrowUp", "Escape", "Enter"]);

function Toolbar({ pageKey, native, started, icon, value, rows, picked }) {
  const run = (command, args = {}) => runningHost().command(command, { key: pageKey, ...args });
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  // The page moved on its own (a link, a redirect, Back): the bar follows unless someone is typing in it.
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  const address = {
    ref: () => {},
    value: draft,
    rows,
    picked,
    onChange: (next) => {
      setDraft(next);
      run("browser.addressChange", { value: next });
    },
    onFocus: (e) => {
      editing.current = true;
      e?.currentTarget?.select?.();
      run("browser.addressFocus");
    },
    onMouseUp: () => {},
    onBlur: () => {
      editing.current = false;
      run("browser.addressBlur");
    },
    onKeyDown: (e) => {
      if (e?.nativeEvent?.isComposing || !BAR_KEYS.has(e?.key)) return;
      e.preventDefault?.();
      if (e.key === "Escape" && rows.length === 0) setDraft(value);
      if (e.key === "Enter") {
        editing.current = false;
        e.currentTarget?.blur?.();
      }
      run("browser.addressKey", { name: e.key });
    },
  };
  return createElement(BrowserToolbar, {
    native,
    started,
    icon,
    address,
    onChoose: (row) => run("browser.choose", { url: row.url }),
    onRemove: (row) => run("browser.forget", { url: row.url }),
    onBack: () => run("browser.back"),
    onForward: () => run("browser.forward"),
    onReload: () => run("browser.reload"),
    onOpenExternal: () => run("browser.openExternal"),
  });
}

function props(raw) {
  const rows = Array.isArray(raw.rows)
    ? raw.rows.filter((row) => row && typeof row.url === "string" && typeof row.title === "string" && typeof row.kind === "string")
    : [];
  return {
    pageKey: String(raw.key ?? ""),
    native: raw.native !== false,
    started: raw.started === true,
    icon: typeof raw.icon === "string" && raw.icon ? raw.icon : undefined,
    value: typeof raw.value === "string" ? raw.value : "",
    rows,
    picked: Number.isInteger(raw.picked) ? raw.picked : -1,
  };
}

export default screen("browser-toolbar", Toolbar, { container: BAR, props, keyboard: "in-flow" });
