//! build.mjs: writes the generated files of the native React screens under `crates/perch-native/mods/`:
//! - `react-runtime/` (shared, shipped once in the binary; not a mod itself, it has no `main.js`):
//!   - `runtime.mjs`: React 19, `react-reconciler`, the renderer, the DOM shim, the cascade, the translator to
//!     GPUI, `@perch/sdk`, the app's compiled stylesheet as a table and the parity names
//!     (`e2e/native-parity/named-elements.json`) for every screen, in one ES module (`runtime.mjs` here is its
//!     entry);
//!   - `react.js`, `react/jsx-runtime.js`, `react-dom.js`, `@perch/sdk.js`: one module per bare specifier a
//!     screen imports, where the mod engine looks for it (a bare `name` is `<mod>/name` or `<mod>/name.js`), each
//!     re-exporting a namespace of `runtime.mjs`;
//!   - `agent-icons.js`: the web's agent marks;
//!   - `host.js` and `screen.js` there are written by hand and left alone.
//! - `<screen>/<screen>/*.js` for every id in [`SCREENS`]: that stock screen as the app exports it
//!   (`packages/web/scripts/export-stock-ui.mjs`), and `<screen>/<other>/*.js` for a stock screen drawn inside it
//!   ([`ALSO`]). `<screen>/main.js` and `<screen>/mod.json` are written by hand.
//!
//! A screen's `mod.json` says `"runtime": "react"`, and the mod host writes `react-runtime/` into that screen's
//! folder when it writes the stock mods out (`mods.rs`), so a written-out screen folder is complete on its own and a
//! copy of it is a working override.
//!
//! The stylesheet is the app's own: `packages/web/src/styles/index.css` compiled by Vite with the app's Tailwind
//! plugin, so the table has exactly the classes the app's build has (every screen's). `--check` builds in memory
//! and fails, listing the files, when anything it writes differs (a stale bundle after a change to the runtime, the
//! SDK modules it compiles in, any class in the app, a stock screen or the parity names).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const web = path.join(repo, "packages/web");
/** The stock mods folder. */
export const OUT = path.join(repo, "crates/perch-native/mods");
/** The shared runtime's folder under it. */
export const RUNTIME = "react-runtime";
/** The stock screens on the React runtime, by the id of their folder in `packages/web/src/stock-ui/`. Adding a screen:
 * its id here, then `npm run build:mods-runtime`, then its `main.js`, `mod.json` and tests (see the findings recipe). */
export const SCREENS = [
  "sidebar",
  "navigator",
  "pane-menu",
  "confirm",
  "new-session",
  "tabs",
  "status",
  "pane-header",
  "dialog",
  "toast",
];
/** Other stock screens a screen's folder carries, by the screen: they draw inside it (the close guard asks its question
 * through the confirmation, with its own rows in it; the New session menu draws the tab strip's icons; the dialog draws
 * the file menu's name prompts). */
export const ALSO = {
  confirm: ["close-guard"],
  "new-session": ["tabs"],
  dialog: ["file-menu"],
};
/** Files under the folders the build writes that it does not write. */
const HAND_WRITTEN = new Set([`${RUNTIME}/host.js`, `${RUNTIME}/screen.js`, ...SCREENS.flatMap((id) => [`${id}/main.js`, `${id}/mod.json`])]);
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

/** The stock screens' code as the app exports it, `<screen>/<screen>/<file>.js` (and `<screen>/<other>/<file>.js` for
 * the screens in [`ALSO`]; their types files and manifests are the web package's). */
async function screenFiles() {
  const { exportStockUi } = await import(pathToFileURL(path.join(web, "scripts/export-stock-ui.mjs")).href);
  const files = exportStockUi({ sourceDir: path.join(web, "src/stock-ui"), sdkTypesFile: path.join(web, "src/perch-sdk.d.ts") });
  const out = [];
  for (const screen of SCREENS) {
    for (const id of [screen, ...(ALSO[screen] ?? [])]) {
      const own = [...files].filter(([rel]) => rel.startsWith(`${id}/`) && rel.endsWith(".js"));
      if (!own.length) throw new Error(`packages/web/src/stock-ui has no screen ${id}`);
      for (const [rel, bytes] of own) out.push([`${screen}/${rel}`, Buffer.from(bytes).toString("utf8")]);
    }
  }
  return out;
}

/** The web's agent marks as markup, rendered from its own `AgentIcon` (`components/AgentIcon.tsx`) at build time:
 * every provider it draws (its `switch`, the built-in programs and the bundled favicons) at 14 px, with `tint`
 * false for a favicon (drawn as is); a provider it draws as a letter tile keeps only its letter. A favicon PNG is inlined into an SVG `<image>`; `oklch()` colours, which the
 * engine's SVG renderer does not read, are written as `#rrggbb`. `letter` is the tile an unknown provider gets, with
 * `{letter}` where its letter goes. */
async function agentIcons() {
  const { createServer } = await load("vite");
  const server = await createServer({ configFile: false, root: web, logLevel: "silent", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, esbuild: { jsx: "automatic" } });
  try {
    const source = path.join(web, "src/components/AgentIcon.tsx");
    const icons = await server.ssrLoadModule(source);
    const { BUILTIN_COUNT, programTable } = await server.ssrLoadModule(path.join(web, "src/programs.ts"));
    const { createElement } = await load("react");
    const { renderToStaticMarkup } = await load("react-dom/server");
    const pngDir = path.join(web, "src/assets/agent-icons");
    const pngs = fs.readdirSync(pngDir).filter((name) => name.endsWith(".png")).map((name) => name.slice(0, -4));
    const cases = [...fs.readFileSync(source, "utf8").matchAll(/case "([^"]+)":/g)].map((m) => m[1]);
    const builtin = programTable().slice(0, BUILTIN_COUNT).map((p) => p.id);
    const letter = renderToStaticMarkup(createElement(icons.AgentLetterIcon, { letter: "\u0001", size: 14 }));
    const [before, after] = letter.split("\u0001");
    const out = {};
    const letters = {};
    for (const provider of [...new Set([...cases, ...builtin, ...pngs])].sort()) {
      // React writes an image preload hint before an `<img>`; the mark is the element after it.
      const markup = renderToStaticMarkup(createElement(icons.AgentIcon, { provider, size: 14 })).replace(/^<link [^>]*\/>/, "");
      if (markup.startsWith("<img")) {
        const png = fs.readFileSync(path.join(pngDir, `${provider}.png`)).toString("base64");
        out[provider] = { markup: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 14 14"><image width="14" height="14" xlink:href="data:image/png;base64,${png}"/></svg>`, tint: false };
      } else if (markup.startsWith(before) && markup.endsWith(after)) letters[provider] = markup.slice(before.length, -after.length);
      else if (markup.startsWith("<svg")) out[provider] = { markup: oklchToHex(markup), tint: true };
      else throw new Error(`AgentIcon draws ${provider} as neither an <svg> nor an <img>: ${markup.slice(0, 80)}`);
    }
    return [
      "// Generated by build.mjs from packages/web/src/components/AgentIcon.tsx: the web's agent marks by provider.",
      `export const ICONS = ${JSON.stringify(out)};`,
      "// The letter a built-in program's tile shows, and the tile (`{letter}` where the letter goes).",
      `export const LETTERS = ${JSON.stringify(letters)};`,
      `export const LETTER = ${JSON.stringify(`${before}{letter}${after}`)};`,
      "",
    ].join("\n");
  } finally {
    await server.close();
  }
}

/** `oklch(L C H)` colours (L 0-1 or %, C, H in degrees) as `#rrggbb`, through OKLab and linear sRGB. */
export function oklchToHex(text) {
  return text.replace(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/g, (_, l, percent, c, h) => {
    const L = Number(l) / (percent ? 100 : 1), C = Number(c), H = (Number(h) * Math.PI) / 180;
    const a = C * Math.cos(H), b = C * Math.sin(H);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_];
    const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
    return `#${linear.map((x) => Math.round(Math.min(1, Math.max(0, gamma(x))) * 255).toString(16).padStart(2, "0")).join("")}`;
  });
}

/** Every generated file of the mod folder, by path. */
export async function buildFiles() {
  const table = await cssTable(await compileCss());
  const code = await bundleRuntime(table);
  const files = new Map();
  for (const [name, text] of await moduleFiles(code)) files.set(`${RUNTIME}/${name}`, text);
  files.set(`${RUNTIME}/runtime.mjs`, code);
  files.set(`${RUNTIME}/agent-icons.js`, await agentIcons());
  for (const [rel, text] of await screenFiles()) files.set(rel, text);
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

/** What differs between the folders the build writes (the runtime's and each screen's) and `files` (empty when
 * equal). Hand-written files are not compared. */
export function differences(files, dir = OUT) {
  const out = [];
  for (const [name, text] of files) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) out.push(`missing ${name}`);
    else if (fs.readFileSync(file, "utf8") !== text) out.push(`changed ${name}`);
  }
  for (const folder of [RUNTIME, ...SCREENS]) {
    for (const rel of listFiles(path.join(dir, folder))) {
      const name = `${folder}/${rel}`;
      if (!files.has(name) && !HAND_WRITTEN.has(name) && !path.basename(name).startsWith(".")) out.push(`extra ${name}`);
    }
    for (const name of HAND_WRITTEN) if (name.startsWith(`${folder}/`) && !fs.existsSync(path.join(dir, name))) out.push(`missing hand-written ${name}`);
  }
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
      const stale = differences(files);
      for (const name of stale) if (name.startsWith("extra ")) fs.rmSync(path.join(OUT, name.slice(6)));
      const handMissing = stale.filter((name) => name.startsWith("missing hand-written "));
      if (handMissing.length) console.error(`write these by hand (see the recipe):\n  ${handMissing.join("\n  ")}`);
      for (const [name, text] of files) {
        fs.mkdirSync(path.dirname(path.join(OUT, name)), { recursive: true });
        fs.writeFileSync(path.join(OUT, name), text);
      }
      const size = (name) => `${(Buffer.byteLength(files.get(name)) / 1024).toFixed(1)} KiB`;
      console.log(`wrote ${files.size} files in ${path.relative(repo, OUT)} (${[RUNTIME, ...SCREENS].join(", ")}): runtime.mjs ${size(`${RUNTIME}/runtime.mjs`)}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}
