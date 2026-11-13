//! The runtime bundle's entry (`build.mjs` writes it into the stock mod `sidebar-react`): React 19, its JSX runtime, `react-dom`'s portal, `@perch/sdk` and `mount`, in one ES
//! module for the engine's JS (QuickJS). The host resolves a screen's `react`, `react/jsx-runtime`, `react-dom` and
//! `@perch/sdk` imports to the generated modules beside it, each of which re-exports one namespace from here, so
//! every screen shares this one React. `globalThis.perch` must be set before this module is evaluated.
import "./prelude.mjs";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as reactDom from "./react-dom.mjs";
import * as sdk from "./sdk.mjs";
import { mount } from "./renderer.mjs";
import { SCHEMA } from "./describe.mjs";
import { describeToGpui, STYLE_KEYS } from "./gpui.mjs";
import NAMED_ELEMENTS from "virtual:perch-named-elements";

/** The parity table's names by screen (`e2e/native-parity/named-elements.json`), for `mount`'s `names`. */
export { React, jsxRuntime, reactDom, sdk, mount, SCHEMA, describeToGpui, STYLE_KEYS, NAMED_ELEMENTS };
