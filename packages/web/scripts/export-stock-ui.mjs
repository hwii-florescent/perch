//! export-stock-ui.mjs: turns Perch's stock screens (`src/stock-ui/<id>/`, TSX) into the plain-JS
//! packages the app runs and `perch mod clone stock:<id>` copies: `dist/stock-ui/<id>/` and
//! `dist/stock-ui/catalog.json`, plus the stock layouts `dist/stock-ui/layouts/<id>.json` as they are. `npm run build`
//! runs it inside Vite (`exportStockUi`, the `perch-stock-ui` plugin in vite.config.ts), so the files are written with
//! the app's own and the service worker precaches them with the shell. Run alone it writes `dist/stock-ui/` (or
//! `--out <dir>`); `--check` compares a fresh export with what is on disk and fails on any difference.
//!
//! Each file is compiled on its own by TypeScript's `transpileModule` (comments and `//!` headers
//! stay, JSX becomes `react/jsx-runtime` calls) and keeps its name with a `.js` extension. A screen
//! may import only its own files and the host modules (`HOST_MODULES`: React and `@perch/sdk`, which
//! the page supplies), so nothing of the app is copied into a package: a relative import that
//! leaves the screen's folder (the store, the socket, the bootstrap, any app module), any other npm
//! package, Vite-only forms (`import.meta.glob`, `?url`/`?raw` imports, `import.meta.env`, CSS
//! modules) and computed `import()` stop the export with the file and the reason.
//!
//! CSS and assets go into the package as files. `import "./look.css"` copies the stylesheet and drops
//! the import (the loader puts every `.css` file of a package on the page while it shows), and every
//! `url(...)` in it, read by a CSS tokenizer, must name a file of the screen, which is copied too.
//! `import logo from "./art/logo.svg"` copies the file and becomes `const logo =
//! __perchAssetUrl("art/logo.svg")`, `assetUrl` from `@perch/sdk`. Any other form of either import
//! (named, namespace, `import()`, re-export, `.module.css`) is refused. Tailwind classes are not
//! compiled per package: a screen uses classes the app's build already has, or plain CSS.
//!
//! A package's revision is the core's (`crates/perch-core/src/mods.rs`, `package`): SHA-256 over its
//! served files sorted by path, each path and its bytes preceded by their length as a little-endian
//! u64. The output depends only on the source files, so the same tree exports the same bytes.
import ts from "typescript";
import { isTokenAtKeyword, isTokenCloseParen, isTokenFunction, isTokenString, isTokenURL, isTokenWhiteSpaceOrComment, tokenize } from "@csstools/css-tokenizer";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Modules the page provides to every package (`mod-runtime.ts`); never copied into one. */
export const HOST_MODULES = ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "@perch/sdk"];
/** What the core serves from a package (`PACKAGE_KINDS` in mods.rs); only these count in the revision. */
const SERVED = new Set(["js", "mjs", "css", "json", "svg", "png", "jpg", "webp", "woff2", "woff"]);
const CODE = [".tsx", ".ts", ".jsx", ".js", ".mjs"];
/** Files a screen imports for their URL (a default import becomes `assetUrl(path)`). */
const ASSETS = new Set([".svg", ".png", ".jpg", ".webp", ".woff2", ".woff"]);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COMPILER = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  isolatedModules: true,
  sourceMap: false,
  inlineSourceMap: false,
  removeComments: false,
  newLine: ts.NewLineKind.LineFeed,
};

const posix = (p) => p.split(path.sep).join("/");
const outName = (rel) => (CODE.includes(path.extname(rel)) ? rel.slice(0, -path.extname(rel).length) + ".js" : rel);

/** SHA-256 of a package's served files, as the core computes its revision. */
export function packageDigest(files) {
  const hash = createHash("sha256");
  const served = [...files.entries()].filter(([rel]) => SERVED.has(rel.split(".").pop())).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [rel, bytes] of served) {
    for (const part of [Buffer.from(rel), Buffer.from(bytes)]) {
      const length = Buffer.alloc(8);
      length.writeBigUInt64LE(BigInt(part.length));
      hash.update(length);
      hash.update(part);
    }
  }
  return hash.digest("hex");
}

/** `specifier` as imported from `from` (`shape`: `side` for `import "x"`, `default` for `import x from "x"`, else
 * `other`): the file it names inside `root` (`kind`: `code`, `css` or `asset`), or why it may not be imported. */
function resolve(specifier, from, root, srcRoot, shape = "other") {
  if (specifier.includes("?")) return { error: `"${specifier}" is a Vite query import (?url, ?raw, ?worker); a package cannot use it` };
  if (HOST_MODULES.includes(specifier)) return { host: true };
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    const hint = specifier === "react" || specifier.startsWith("react") ? ` (React comes from the page: import ${HOST_MODULES.map((m) => `"${m}"`).join(", ")})` : "";
    return { error: `"${specifier}" would copy an npm package into the screen${hint}; import @perch/sdk or ship the code beside it` };
  }
  const base = path.resolve(path.dirname(from), specifier);
  const ext = path.extname(base);
  let kind = "code";
  if (ext === ".css") {
    if (base.endsWith(".module.css")) return { error: `"${specifier}" is a CSS module, which only Vite understands; use plain class names in a .css file` };
    if (shape !== "side") return { error: `"${specifier}" is a stylesheet: import it only for its effect (import "${specifier}")` };
    kind = "css";
  } else if (ASSETS.has(ext)) {
    if (shape !== "default") return { error: `"${specifier}" is an asset: import its URL as a default import (import url from "${specifier}")` };
    kind = "asset";
  } else if (ext && !CODE.includes(ext) && ext !== ".json") {
    return { error: `"${specifier}" imports a ${ext} file, which a package cannot serve; it imports JS, JSON, CSS and ${[...ASSETS].join(" ")} files` };
  }
  const candidates = [base, ...CODE.map((e) => base + e), ...CODE.map((e) => path.join(base, "index" + e))];
  const found = candidates.find((file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile());
  const target = found ?? base;
  if (path.relative(root, target).startsWith("..") || path.isAbsolute(path.relative(root, target))) {
    const named = posix(path.relative(srcRoot, target)) || specifier;
    return { error: `"${specifier}" reaches app-internal module ${named} (a store, socket, bootstrap or any other app file is not part of the public API); use @perch/sdk or move the code into the screen's folder` };
  }
  if (!found) return { error: `"${specifier}" names no file in the screen's folder` };
  return { file: found, kind };
}

/** The package files a stylesheet's `url(...)`s name (relative to it), or why it cannot be shipped: what the loader
 * accepts (`rewriteCss` in mod-runtime.ts), read by the same tokenizer. */
function cssFiles(css, file, root) {
  const found = [];
  const errors = [];
  const tokens = tokenize({ css });
  const name = (value) => {
    if (/^([a-z][a-z0-9+.-]*:|#)/i.test(value)) return;
    const target = path.resolve(path.dirname(file), decodeURIComponent(value.split("#")[0].split("?")[0]));
    const rel = path.relative(root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.statSync(target, { throwIfNoEntry: false })?.isFile()) errors.push(`url(${value}) names no file in the screen's folder`);
    else if (!ASSETS.has(path.extname(target))) errors.push(`url(${value}) is not one of ${[...ASSETS].join(" ")}`);
    else found.push(target);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isTokenAtKeyword(token) && token[4].value.toLowerCase() === "import") errors.push("@import is not needed: every .css file of a package is on the page");
    else if (isTokenURL(token)) name(token[4].value);
    else if (isTokenFunction(token) && token[4].value.toLowerCase() === "url") {
      let at = i + 1;
      while (tokens[at] && isTokenWhiteSpaceOrComment(tokens[at])) at++;
      if (tokens[at] && isTokenString(tokens[at])) name(tokens[at][4].value);
      let end = at + 1;
      while (tokens[end] && isTokenWhiteSpaceOrComment(tokens[end])) end++;
      if (!tokens[end] || !isTokenCloseParen(tokens[end])) errors.push("a url( ... ) is not a single quoted path");
    }
  }
  return { found, errors };
}

/** Every import of a source file, `{text, shape}` (static, re-export, literal `import()`; `shape` as `resolve`
 * takes it), and the Vite-only forms it uses. */
function scan(source, fileName) {
  const kind = fileName.endsWith(".tsx") || fileName.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, kind);
  const imports = [];
  const problems = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const typeOnly = ts.isImportDeclaration(node) ? clause?.isTypeOnly : node.isTypeOnly;
      const shape = !ts.isImportDeclaration(node) ? "other" : !clause ? "side" : clause.name && !clause.namedBindings ? "default" : "other";
      if (!typeOnly) imports.push({ text: node.moduleSpecifier.text, shape });
    } else if (ts.isImportEqualsDeclaration(node)) {
      problems.push("`import x = require(...)` is CommonJS; use `import`");
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) imports.push({ text: arg.text, shape: "other" });
      else problems.push("`import()` of a computed path cannot be checked; name the file");
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      problems.push("`require()` is CommonJS; use `import`");
    } else if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword && ["glob", "env", "hot"].includes(node.name.text)) {
      problems.push(`\`import.meta.${node.name.text}\` is Vite-only; a package runs without Vite`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { imports, problems };
}

/** Whether `node` is a call the JSX transform wrote (`_jsx(...)`, `_jsxs(...)`). */
const jsxCall = (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ts.idText(node.expression).startsWith("_jsx");

/** Rewrites every relative module specifier through `map` (source text to emitted path), drops stylesheet imports
 * (`styles`), turns asset imports (`assets`: source text to package path) into `assetUrl` calls, and lays each
 * element's props (and a `children` list) out one per line, as the JSX it came from was. */
const ASSET_URL = "__perchAssetUrl";
const rewrite = (map, styles = new Set(), assets = new Map()) => (context) => {
  const f = context.factory;
  const swap = (literal) => (ts.isStringLiteralLike(literal) && map.has(literal.text) ? f.createStringLiteral(map.get(literal.text)) : literal);
  const lines = (props) => f.createObjectLiteralExpression(props.properties.map((p) =>
    ts.isPropertyAssignment(p) && ts.isArrayLiteralExpression(p.initializer) ? f.updatePropertyAssignment(p, p.name, f.createArrayLiteralExpression(p.initializer.elements, true)) : p), true);
  const visit = (input) => {
    const node = ts.visitEachChild(input, visit, context);
    if (jsxCall(node) && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1]) && node.arguments[1].properties.length > 1) {
      const [tag, props, ...rest] = node.arguments;
      return f.updateCallExpression(node, node.expression, node.typeArguments, [tag, lines(props), ...rest]);
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && styles.has(node.moduleSpecifier.text)) return undefined;
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && assets.has(node.moduleSpecifier.text)) {
      const call = f.createCallExpression(f.createIdentifier(ASSET_URL), undefined, [f.createStringLiteral(assets.get(node.moduleSpecifier.text))]);
      return f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration(node.importClause.name, undefined, undefined, call)], ts.NodeFlags.Const));
    }
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      return f.updateImportDeclaration(node, node.modifiers, node.importClause, swap(node.moduleSpecifier), node.attributes);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      return f.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, swap(node.moduleSpecifier), node.attributes);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
      return f.updateCallExpression(node, node.expression, node.typeArguments, [swap(node.arguments[0]), ...node.arguments.slice(1)]);
    }
    return node;
  };
  return (file) => {
    const out = ts.visitNode(file, visit);
    if (!assets.size) return out;
    const named = f.createImportSpecifier(false, f.createIdentifier("assetUrl"), f.createIdentifier(ASSET_URL));
    const sdk = f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([named])), f.createStringLiteral("@perch/sdk"));
    return f.updateSourceFile(out, [sdk, ...out.statements]);
  };
};

/** One screen: its files as `rel path -> Buffer` and its catalog entry. Throws with every reason it cannot be exported. */
function exportScreen(id, root, srcRoot, sdkTypes) {
  const fail = (text) => { throw new Error(`stock screen "${id}": ${text}`); };
  if (!ID.test(id)) fail("its folder name is not a plain id (letters, digits, - and _)");
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, "mod.json"), "utf8")); } catch (error) { fail(`mod.json is not valid JSON: ${error.message}`); }
  for (const key of ["name", "version", "api"]) if (typeof manifest[key] !== "string" || !manifest[key]) fail(`mod.json needs "${key}"`);
  const sourceEntry = manifest.entry ?? "main.tsx";
  const entry = path.join(root, sourceEntry);
  if (!fs.existsSync(entry)) fail(`its entry ${sourceEntry} is missing`);

  const files = new Map();
  const seen = new Set();
  const queue = [entry];
  const errors = [];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const rel = posix(path.relative(root, file));
    const source = fs.readFileSync(file, "utf8");
    if (file.endsWith(".json")) {
      files.set(rel, Buffer.from(source));
      continue;
    }
    if (ASSETS.has(path.extname(file))) {
      files.set(rel, fs.readFileSync(file));
      continue;
    }
    if (file.endsWith(".css")) {
      const { found, errors: wrong } = cssFiles(source, file, root);
      errors.push(...wrong.map((e) => `${rel}: ${e}`));
      queue.push(...found);
      files.set(rel, Buffer.from(source));
      continue;
    }
    const { imports, problems } = scan(source, file);
    errors.push(...problems.map((p) => `${rel}: ${p}`));
    const map = new Map();
    const styles = new Set();
    const assets = new Map();
    for (const { text: specifier, shape } of imports) {
      const found = resolve(specifier, file, root, srcRoot, shape);
      if (found.error) errors.push(`${rel}: ${found.error}`);
      if (!found.file) continue;
      queue.push(found.file);
      if (found.kind === "css") { styles.add(specifier); continue; }
      if (found.kind === "asset") { assets.set(specifier, posix(path.relative(root, found.file))); continue; }
      let emitted = posix(path.relative(path.dirname(file), outName(found.file)));
      if (!emitted.startsWith(".")) emitted = `./${emitted}`;
      map.set(specifier, emitted);
    }
    if (errors.length) continue;
    const { outputText } = ts.transpileModule(source, { fileName: path.basename(file), compilerOptions: COMPILER, transformers: { after: [rewrite(map, styles, assets)] } });
    const header = `// ${rel} of Perch's stock screen "stock:${id}", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.\n`;
    files.set(outName(rel), Buffer.from(header + outputText));
  }
  if (errors.length) fail(`\n  ${errors.join("\n  ")}`);
  for (const [rel, bytes] of files) {
    const text = bytes.toString("utf8");
    if (text.includes(srcRoot) || /(^|["'\s(])\/(Users|home|private|tmp)\//m.test(text) || /file:\/\//.test(text)) fail(`${rel} would carry a path of this computer`);
    if (text.includes("sourceMappingURL")) fail(`${rel} would carry a source map`);
  }
  const outputEntry = outName(sourceEntry);
  const packageManifest = {
    name: manifest.name,
    description: manifest.description ?? "",
    version: manifest.version,
    api: manifest.api,
    format: "esm",
    entry: outputEntry,
    place: "layout",
    origin: "stock",
  };
  files.set("mod.json", Buffer.from(JSON.stringify(packageManifest, null, 2) + "\n"));
  files.set("perch-sdk.d.ts", Buffer.from(sdkTypes));
  const served = [...files.keys()].filter((rel) => SERVED.has(rel.split(".").pop())).sort();
  return {
    files,
    entry: { id, name: manifest.name, version: manifest.version, api: manifest.api, entry: outputEntry, files: served, revision: packageDigest(files) },
  };
}

/** Every screen under `sourceDir` (a folder with a `mod.json`), as the files of `stock-ui/`:
 * `<id>/<file>` and `catalog.json`, keyed by path relative to it. */
export function exportStockUi({ sourceDir, sdkTypesFile }) {
  const sdkTypes = fs.readFileSync(sdkTypesFile);
  const srcRoot = path.resolve(sourceDir, "..");
  const out = new Map();
  const packages = [];
  const ids = fs.readdirSync(sourceDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(sourceDir, d.name, "mod.json"))).map((d) => d.name).sort();
  for (const id of ids) {
    const { files, entry } = exportScreen(id, path.resolve(sourceDir, id), srcRoot, sdkTypes);
    for (const [rel, bytes] of files) out.set(`${id}/${rel}`, bytes);
    packages.push(entry);
  }
  out.set("catalog.json", Buffer.from(JSON.stringify({ packages }, null, 2) + "\n"));
  // Stock layouts (`layouts/<id>.json`: `stock:main` is Perch's own window as a layout file) go out as they are; the
  // core lists them as `stock:<id>` and `perch mod clone` copies one into the person's `layouts/`.
  const layouts = path.join(sourceDir, "layouts");
  const names = fs.existsSync(layouts) ? fs.readdirSync(layouts).filter((name) => name.endsWith(".json")).sort() : [];
  for (const name of names) {
    if (!ID.test(name.slice(0, -5))) throw new Error(`stock-ui/layouts/${name}: a layout id is letters, digits, - and _`);
    const bytes = fs.readFileSync(path.join(layouts, name));
    try { JSON.parse(bytes.toString("utf8")); } catch (error) { throw new Error(`stock-ui/layouts/${name}: ${error instanceof Error ? error.message : error}`); }
    out.set(`layouts/${name}`, bytes);
  }
  return out;
}

function listFiles(dir, prefix = "") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? listFiles(path.join(dir, d.name), `${prefix}${d.name}/`) : [`${prefix}${d.name}`]));
}

/** Replaces `outDir` with exactly `files`. */
export function writeExport(outDir, files) {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [rel, bytes] of files) {
    fs.mkdirSync(path.dirname(path.join(outDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(outDir, rel), bytes);
  }
}

/** What differs between `outDir` and `files`: missing, changed and extra paths (empty when equal). */
export function checkExport(outDir, files) {
  const differences = [];
  for (const [rel, bytes] of files) {
    const file = path.join(outDir, rel);
    if (!fs.existsSync(file)) differences.push(`missing ${rel}`);
    else if (!fs.readFileSync(file).equals(bytes)) differences.push(`changed ${rel}`);
  }
  for (const rel of listFiles(outDir)) if (!files.has(rel)) differences.push(`extra ${rel}`);
  return differences.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? path.resolve(args[args.indexOf(name) + 1]) : fallback);
  const outDir = option("--out", path.join(web, "dist", "stock-ui"));
  try {
    const files = exportStockUi({ sourceDir: option("--src", path.join(web, "src", "stock-ui")), sdkTypesFile: path.join(web, "src", "perch-sdk.d.ts") });
    if (args.includes("--check")) {
      const differences = checkExport(outDir, files);
      if (differences.length) {
        console.error(`stock-ui in ${outDir} is not what the sources export (run npm run build):\n  ${differences.join("\n  ")}`);
        process.exit(1);
      }
      console.log(`stock-ui matches its sources (${files.size} files)`);
    } else {
      writeExport(outDir, files);
      console.log(`exported ${files.size} stock-ui files to ${outDir}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
