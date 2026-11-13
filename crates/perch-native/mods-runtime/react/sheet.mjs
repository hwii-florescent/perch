//! The app's compiled stylesheet as a table (`build.mjs` writes it from Vite + Tailwind's output and bundles it as
//! `virtual:perch-css-table`), parsed once on first use.
import table from "virtual:perch-css-table";
import { StyleSheet } from "./css.mjs";

let sheet = null;
export const styleSheet = () => (sheet ??= new StyleSheet(table));
