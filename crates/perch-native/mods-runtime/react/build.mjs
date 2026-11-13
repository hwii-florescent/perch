//! build.mjs: writes the generated files of the stock mod `crates/perch-native/mods/sidebar-react/`, the unchanged
//! stock sidebar on the native React runtime:
//! - `runtime.mjs`: React 19, `react-reconciler`, the renderer, the DOM shim, the cascade, `@perch/sdk`, the app's
//!   compiled stylesheet as a table and the parity names (`e2e/native-parity/named-elements.json`), in one ES module
//!   (`runtime.mjs` here is its entry);
//! - `react.js`, `react/jsx-runtime.js`, `react-dom.js`, `@perch/sdk.js`: one module per bare specifier a screen
//!   imports, where the mod engine looks for it (a bare `name` is `<mod>/name` or `<mod>/name.js`), each re-exporting
//!   a namespace of `runtime.mjs`, so every screen shares one React;
//! - `sidebar/*.js`: the stock sidebar as the app exports it (`packages/web/scripts/export-stock-ui.mjs`).
//! `main.js`, `host.js` and `mod.json` there are written by hand and left alone.
//!
//! The stylesheet is the app's own: `packages/web/src/styles/index.css` compiled by Vite with the app's Tailwind
//! plugin, so the table has exactly the classes the app's build has. `--check` builds in memory and fails, listing
//! the files, when the mod folder differs (a stale bundle after a change to the runtime, the SDK modules it compiles
//! in, any class in the app, the stock sidebar or the parity names).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const web = path.join(repo, "packages/web");
export const OUT = path.join(repo, "crates/perch-native/mods/sidebar-react");
/** Files of the mod folder the build does not write. */
const HAND_WRITTEN = new Set(["main.js", "host.js", "mod.json"]);
const requireWeb = createRequire(path.join(web, "package.json"));
const load = async (name) => import(pathToFileURL(requireWeb.resolve(name)).href);

/** The app's stylesheet, as its own build compiles it. */
export async function compileCss() {
  const { build } = await load("vite");
  const tailwind = (await load("@tailwindcss/vite")).default;
  const entry = "virtual:perch-app-css";
  const result = await build({
    configFile: false,
    root: web,
    logLevel: "silent",
    plugins: [tailwind(), { name: "perch-app-css", resolveId: (id) => (id === entry ? `\0${entry}` : null), load: (id) => (id === `\0${entry}` ? `import ${JSON.stringify(path.join(web, "src/styles/index.css"))};` : null) }],
    build: { write: false, cssMinify: false, minify: false, rollupOptions: { input: entry } },
  });
  const css = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output).filter((o) => o.fileName.endsWith(".css")).map((o) => o.source).join("\n");
  if (!css.includes("@layer utilities")) throw new Error("the compiled app CSS has no utilities layer: Tailwind did not run");
  return css;
}

/** Whether an `@supports` condition holds in the engine's terms: the app's guards are either for modern features
 * the reference browser has (`color-mix`) or `not ...` fallbacks for engines without them. */
const supports = (condition) => !/\bnot\b/.test(condition);

/** The stylesheet as the cascade reads it (`css.mjs` `StyleSheet`). */
export async function cssTable(css) {
  const postcss = (await load("postcss")).default;
  const root = postcss.parse(css);
  const layers = [];
  const layerRank = (name) => {
    if (!layers.includes(name)) layers.push(name);
    return layers.indexOf(name) + 1;
  };
  const UNLAYERED = 1000;
  const rules = [];
  const properties = {};
  const skipped = {};
  const skip = (what) => { skipped[what] = (skipped[what] ?? 0) + 1; };
  const walk = (container, media, layer) => {
    container.each((node) => {
      if (node.type === "rule") {
        const decls = [];
        node.each((child) => {
          if (child.type === "decl") decls.push(child.important ? [child.prop.toLowerCase(), child.value, 1] : [child.prop.startsWith("--") ? child.prop : child.prop.toLowerCase(), child.value]);
          else if (child.type !== "comment") skip(`nested ${child.type} in a rule`);
        });
        if (decls.length) rules.push([node.selector, media.length ? media : null, layer, decls]);
        return;
      }
      if (node.type !== "atrule") return;
      const name = node.name.toLowerCase();
      if (name === "layer") {
        const names = node.params.split(",").map((n) => n.trim()).filter(Boolean);
        names.forEach(layerRank);
        if (node.nodes) walk(node, media, layerRank(names[0] ?? `anonymous-${layers.length}`));
      } else if (name === "media") walk(node, [...media, node.params], layer);
      else if (name === "supports") { if (supports(node.params)) walk(node, media, layer); else skip("@supports evaluated false"); }
      else if (name === "property") {
        const def = {};
        node.each((child) => { if (child.type === "decl") def[child.prop] = child.value; });
        properties[node.params.trim()] = { inherits: def.inherits === "true", initial: def["initial-value"] ?? null };
      } else skip(`@${name}`);
    });
  };
  walk(root, [], UNLAYERED);
  return { layers, properties, rules, skipped };
}

/** The parity names by screen: what the runtime needs of `named-elements.json`. */
function namedElements() {
  const table = JSON.parse(fs.readFileSync(path.join(repo, "e2e/native-parity/named-elements.json"), "utf8"));
  const pick = ({ name, selector, key, textRange }) => ({ name, selector, ...(key ? { key } : {}), ...(textRange ? { textRange } : {}) });
  return Object.fromEntries(Object.entries(table.screens).map(([screen, { elements }]) => [screen, elements.map(pick)]));
}

/** The runtime bundle's code. */
async function bundleRuntime(table) {
  const { build } = await load("vite");
  const virtual = { "virtual:perch-css-table": table, "virtual:perch-named-elements": namedElements() };
  const result = await build({
    configFile: false,
    root: here,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    esbuild: { jsx: "automatic" },
    resolve: {
      alias: [
        { find: /^react-dom$/, replacement: path.join(here, "react-dom.mjs") },
        { find: /^@perch\/sdk$/, replacement: path.join(here, "sdk.mjs") },
      ],
    },
    plugins: [{ name: "perch-virtual", resolveId: (source) => (source in virtual ? `\0${source}` : null), load: (source) => (source.startsWith("\0virtual:") ? `export default ${JSON.stringify(virtual[source.slice(1)])};` : null) }],
    build: {
      write: false,
      target: "es2022",
      minify: "esbuild",
      lib: { entry: path.join(here, "runtime.mjs"), formats: ["es"], fileName: () => "runtime.mjs" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const chunk = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output).find((o) => o.type === "chunk" && o.isEntry);
  if (!chunk) throw new Error("the runtime build produced no entry chunk");
  return chunk.code;
}

/** Bare specifier -> the file the engine resolves it to, and the namespace of `runtime.mjs` it re-exports. */
export const MODULES = [
  ["react", "react.js", "React"],
  ["react/jsx-runtime", "react/jsx-runtime.js", "jsxRuntime"],
  ["react-dom", "react-dom.js", "reactDom"],
  ["@perch/sdk", "@perch/sdk.js", "sdk"],
];

/** The re-export modules, from the names the built runtime really exports. */
async function moduleFiles(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-runtime-"));
  try {
    const file = path.join(dir, "runtime.mjs");
    fs.writeFileSync(file, code);
    globalThis.perch ??= { isMac: true };
    const runtime = await import(pathToFileURL(file).href);
    const files = new Map();
    for (const [specifier, name, namespace] of MODULES) {
      const keys = Object.keys(runtime[namespace]).filter((key) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key)).sort();
      const up = "../".repeat(name.split("/").length - 1) || "./";
      const lines = [`// Generated by build.mjs: "${specifier}" for a screen, from the one React in runtime.mjs.`, `import { ${namespace} } from "${up}runtime.mjs";`];
      lines.push(`export const { ${keys.join(", ")} } = ${namespace};`);
      lines.push(`export default ${runtime[namespace].default ? `${namespace}.default` : namespace};`);
      files.set(name, `${lines.join("\n")}\n`);
    }
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The stock sidebar's code as the app exports it (its types file and manifest are the web package's). */
async function sidebarFiles() {
  const { exportStockUi } = await import(pathToFileURL(path.join(web, "scripts/export-stock-ui.mjs")).href);
  const files = exportStockUi({ sourceDir: path.join(web, "src/stock-ui"), sdkTypesFile: path.join(web, "src/perch-sdk.d.ts") });
  return [...files].filter(([rel]) => rel.startsWith("sidebar/") && rel.endsWith(".js")).map(([rel, bytes]) => [rel, Buffer.from(bytes).toString("utf8")]);
}

/** Every generated file of the mod folder, by path. */
export async function buildFiles() {
  const table = await cssTable(await compileCss());
  const code = await bundleRuntime(table);
  const files = await moduleFiles(code);
  files.set("runtime.mjs", code);
  for (const [rel, text] of await sidebarFiles()) files.set(rel, text);
  return files;
}

/** Every file under `dir`, by path relative to it (`/`-separated). */
function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(file, base) : [path.relative(base, file).split(path.sep).join("/")];
  });
}

/** What differs between the mod folder and `files` (empty when equal). Hand-written files are not compared. */
export function differences(files, dir = OUT) {
  const out = [];
  for (const [name, text] of files) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) out.push(`missing ${name}`);
    else if (fs.readFileSync(file, "utf8") !== text) out.push(`changed ${name}`);
  }
  for (const name of listFiles(dir)) if (!files.has(name) && !HAND_WRITTEN.has(name) && !path.basename(name).startsWith(".")) out.push(`extra ${name}`);
  return out.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const check = process.argv.includes("--check");
  try {
    const files = await buildFiles();
    if (check) {
      const stale = differences(files);
      if (stale.length) {
        console.error(`mods-runtime bundle is stale (run npm run build:mods-runtime):\n  ${stale.join("\n  ")}`);
        process.exit(1);
      }
      console.log(`mods-runtime bundle is current (${files.size} files)`);
    } else {
      for (const name of differences(files)) if (name.startsWith("extra ")) fs.rmSync(path.join(OUT, name.slice(6)));
      for (const [name, text] of files) {
        fs.mkdirSync(path.dirname(path.join(OUT, name)), { recursive: true });
        fs.writeFileSync(path.join(OUT, name), text);
      }
      const size = (name) => `${(Buffer.byteLength(files.get(name)) / 1024).toFixed(1)} KiB`;
      console.log(`wrote ${files.size} files in ${path.relative(repo, OUT)}: runtime.mjs ${size("runtime.mjs")}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}
