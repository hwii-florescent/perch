//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
import table from "virtual:perch-css-table";
import { StyleSheet } from "./css.mjs";

// Every screen's copy of the runtime runs in one script context: screens built from the same table (its `digest`)
// share one parsed sheet, which only caches what follows from the sheet itself. A few are kept (a reloaded runtime
// with a new sheet beside screens still on the old one).
const SHEETS = (globalThis[Symbol.for("perch.styleSheets")] ??= new Map());
let sheet = null;
export function styleSheet() {
  if (sheet) return sheet;
  sheet = (table.digest && SHEETS.get(table.digest)) || new StyleSheet(table);
  if (table.digest && !SHEETS.has(table.digest)) {
    if (SHEETS.size >= 4) SHEETS.delete(SHEETS.keys().next().value);
    SHEETS.set(table.digest, sheet);
  }
  return sheet;
}
