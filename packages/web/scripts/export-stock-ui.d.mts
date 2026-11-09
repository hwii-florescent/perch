// Types for the part of export-stock-ui.mjs that vite.config.ts uses.
/** Every stock screen under `sourceDir` as the files of `stock-ui/` (`<id>/<file>`, `catalog.json`, `layouts/<id>.json`). */
export function exportStockUi(options: { sourceDir: string; sdkTypesFile: string }): Map<string, Buffer>;
