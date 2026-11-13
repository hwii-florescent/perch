//! build.mjs: writes the native client's React runtime into `bundle/`, the files a QuickJS mod imports:
//! - `runtime.mjs`: React 19, `react-reconciler`, the renderer, the DOM shim, the cascade, `@perch/sdk` and the app's
//!   compiled stylesheet as a table, in one ES module (`runtime.mjs` is its entry);
//! - `react.mjs`, `react-jsx-runtime.mjs`, `react-dom.mjs`, `perch-sdk.mjs`: one module per specifier a screen imports,
//!   each re-exporting a namespace of `runtime.mjs`; `imports.json` maps each specifier to its file;
//! - `css-table.json`: the stylesheet table (the copy inside `runtime.mjs` is what runs; this one is for reading).
//!
//! The stylesheet is the app's own: `packages/web/src/styles/index.css` compiled by Vite with the app's Tailwind
//! plugin, so the table has exactly the classes the app's build has. `--check` builds in memory and fails, listing
//! the files, when `bundle/` differs (a stale bundle after a change to the runtime, the SDK modules it compiles in, or
//! any class in the app).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const web = path.join(repo, "packages/web");
const OUT = path.join(here, "bundle");
const requireWeb = createRequire(path.join(web, "package.json"));
const load = async (name) => import(pathToFileURL(requireWeb.resolve(name)).href);

/** The app's stylesheet, as its own build compiles it. */
async function compileCss() {
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

/** The runtime bundle's code. */
async function bundleRuntime(table) {
  const { build } = await load("vite");
  const id = "virtual:perch-css-table";
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
    plugins: [{ name: "perch-css-table", resolveId: (source) => (source === id ? `\0${id}` : null), load: (source) => (source === `\0${id}` ? `export default ${JSON.stringify(table)};` : null) }],
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

/** Specifier -> generated module, and the namespace of `runtime.mjs` each re-exports. */
const MODULES = [
  ["react", "react.mjs", "React"],
  ["react/jsx-runtime", "react-jsx-runtime.mjs", "jsxRuntime"],
  ["react-dom", "react-dom.mjs", "reactDom"],
  ["@perch/sdk", "perch-sdk.mjs", "sdk"],
];

/** The re-export modules, from the names the built runtime really exports. */
async function moduleFiles(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perch-runtime-"));
  try {
    const file = path.join(dir, "runtime.mjs");
    fs.writeFileSync(file, code);
    const runtime = await import(pathToFileURL(file).href);
    const files = new Map();
    for (const [specifier, name, namespace] of MODULES) {
      const keys = Object.keys(runtime[namespace]).filter((key) => key !== "default" && /^[A-Za-z_$][\w$]*$/.test(key)).sort();
      const lines = [`// Generated by build.mjs: "${specifier}" for a screen, from the one React in runtime.mjs.`, `import { ${namespace} } from "./runtime.mjs";`];
      lines.push(`export const { ${keys.join(", ")} } = ${namespace};`);
      lines.push(`export default ${runtime[namespace].default ? `${namespace}.default` : namespace};`);
      files.set(name, `${lines.join("\n")}\n`);
    }
    files.set("imports.json", `${JSON.stringify({ ...Object.fromEntries(MODULES.map(([specifier, name]) => [specifier, name])), "@perch/runtime": "runtime.mjs" }, null, 2)}\n`);
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Every file of `bundle/`, by name. */
export async function buildFiles() {
  const table = await cssTable(await compileCss());
  const code = await bundleRuntime(table);
  const files = await moduleFiles(code);
  files.set("runtime.mjs", code);
  files.set("css-table.json", `${JSON.stringify(table)}\n`);
  return files;
}

/** What differs between `bundle/` and `files` (empty when equal). */
export function differences(files, dir = OUT) {
  const out = [];
  for (const [name, text] of files) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) out.push(`missing ${name}`);
    else if (fs.readFileSync(file, "utf8") !== text) out.push(`changed ${name}`);
  }
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir)) if (!files.has(name)) out.push(`extra ${name}`);
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
      fs.rmSync(OUT, { recursive: true, force: true });
      fs.mkdirSync(OUT, { recursive: true });
      for (const [name, text] of files) fs.writeFileSync(path.join(OUT, name), text);
      const size = (name) => `${(Buffer.byteLength(files.get(name)) / 1024).toFixed(1)} KiB`;
      console.log(`wrote ${path.relative(repo, OUT)}: runtime.mjs ${size("runtime.mjs")}, css-table.json ${size("css-table.json")}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}
