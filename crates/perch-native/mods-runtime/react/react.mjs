//! "react" as the runtime bundles it, for its own code, the stock screens and every screen's `react` import: React
//! itself, with `useEffect` and `useLayoutEffect` run through `measured` (`dom.mjs`), so an effect that measures a
//! box the engine has not laid out yet runs again once it has (layout readback).
import * as React from "react";
import { measured } from "./dom.mjs";

export * from "react";
export default React.default ?? React;

export function useEffect(effect, deps) { return React.useEffect(measured(effect), deps); }
export function useLayoutEffect(effect, deps) { return React.useLayoutEffect(measured(effect), deps); }
