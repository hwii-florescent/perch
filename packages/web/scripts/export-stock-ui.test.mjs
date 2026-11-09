// node --test packages/web/scripts/export-stock-ui.test.mjs
// The stock-screen exporter on real source trees written to a temp folder: what it emits, that the
// same sources always give the same bytes and revision (the core's digest), and every import it must
// refuse rather than copy into a package.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkExport, exportStockUi, packageDigest, writeExport } from "./export-stock-ui.mjs";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SDK_TYPES = path.join(web, "src", "perch-sdk.d.ts");

/** A fresh `src/` with `files` (paths relative to it); returns its `stock-ui/` folder. */
function tree(files) {
  const src = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "perch-stock-export-")), "src");
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
    fs.writeFileSync(path.join(src, rel), text);
  }
  test.after(() => fs.rmSync(path.dirname(src), { recursive: true, force: true }));
  return path.join(src, "stock-ui");
}
const MANIFEST = JSON.stringify({ name: "Demo", description: "a demo", version: "1.2.0", api: "^1" });
const run = (sourceDir) => exportStockUi({ sourceDir, sdkTypesFile: SDK_TYPES });
const text = (files, rel) => files.get(rel).toString("utf8");

const GRAPH = {
  "stock-ui/demo/mod.json": MANIFEST,
  "stock-ui/demo/main.tsx": [
    "//! The demo screen: a header that must survive the export.",
    'import { useState } from "react";',
    'import { CloseIcon, type KeybindGroup } from "@perch/sdk";',
    'import { Row } from "./parts/row";',
    'import { ping } from "./a";',
    'import data from "./data.json";',
    "",
    "type Props = { group: KeybindGroup };",
    "/** The screen itself. */",
    "export default function Demo({ group }: Props) {",
    "  const [lazy, setLazy] = useState(\"\");",
    "  // an intent comment",
    '  return <div onClick={() => import("./lazy").then((m) => setLazy(m.value))}><Row label={group + ping() + data.n + lazy} /><CloseIcon /></div>;',
    "}",
  ].join("\n"),
  "stock-ui/demo/parts/row.tsx": 'export function Row({ label }: { label: string }) { return <span>{label}</span>; }\n',
  "stock-ui/demo/a.ts": 'import { pong } from "./b";\nexport const ping = (): string => "ping" + typeof pong;\n',
  "stock-ui/demo/b.ts": 'import { ping } from "./a";\nexport const pong = () => typeof ping;\n',
  "stock-ui/demo/lazy.ts": 'export const value: string = "lazy";\n',
  "stock-ui/demo/data.json": '{ "n": 3 }\n',
  "stock-ui/demo/unused.ts": "export const notImported = 1;\n",
  "stock-ui/notes/README.md": "a folder without mod.json is not a screen\n",
};

test("a screen's graph becomes readable per-file JS beside a catalog", () => {
  const files = run(tree(GRAPH));
  assert.deepEqual([...files.keys()].sort(), [
    "catalog.json", "demo/a.js", "demo/b.js", "demo/data.json", "demo/lazy.js", "demo/main.js", "demo/mod.json", "demo/parts/row.js", "demo/perch-sdk.d.ts",
  ]);
  const main = text(files, "demo/main.js");
  assert.match(main, /^\/\/ main\.tsx of Perch's stock screen "stock:demo"/);
  assert.match(main, /\/\/! The demo screen: a header that must survive the export\./);
  assert.match(main, /\/\*\* The screen itself\. \*\/\nexport default/);
  assert.match(main, /\/\/ an intent comment/);
  assert.match(main, /from "\.\/parts\/row\.js"/);
  assert.match(main, /from "\.\/a\.js"/);
  assert.match(main, /import\("\.\/lazy\.js"\)/);
  assert.match(main, /from "\.\/data\.json"/);
  assert.match(main, /from "react\/jsx-runtime"/);
  assert.match(main, /_jsxs\("div", \{\n\s+onClick: [^\n]*\n\s+children: \[\n\s+_jsx\(Row/, "an element's props and children read one per line");
  assert.match(main, /import \{ CloseIcon \} from "@perch\/sdk"/, "type-only names are dropped, host imports kept");
  assert.match(main, /export default function Demo\(\{ group \}\)/, "exports stay where they were");
  assert.doesNotMatch(main, /KeybindGroup|: Props|<div/);
  assert.match(text(files, "demo/b.js"), /from "\.\/a\.js"/);
  assert.equal(text(files, "demo/perch-sdk.d.ts"), fs.readFileSync(SDK_TYPES, "utf8"));
  assert.deepEqual(JSON.parse(text(files, "demo/mod.json")), {
    name: "Demo", description: "a demo", version: "1.2.0", api: "^1", format: "esm", entry: "main.js", place: "layout", origin: "stock",
  });
  const { packages } = JSON.parse(text(files, "catalog.json"));
  assert.equal(packages.length, 1);
  const [demo] = packages;
  assert.deepEqual({ ...demo, revision: undefined }, {
    id: "demo", name: "Demo", version: "1.2.0", api: "^1", entry: "main.js", revision: undefined,
    files: ["a.js", "b.js", "data.json", "lazy.js", "main.js", "mod.json", "parts/row.js"],
  });
  const own = new Map([...files].filter(([rel]) => rel.startsWith("demo/")).map(([rel, bytes]) => [rel.slice(5), bytes]));
  assert.equal(demo.revision, packageDigest(own));
});

test("the same sources export the same bytes, wherever they are", () => {
  const first = run(tree(GRAPH));
  const second = run(tree(GRAPH));
  assert.deepEqual([...first.keys()].sort(), [...second.keys()].sort());
  for (const [rel, bytes] of first) assert.ok(bytes.equals(second.get(rel)), rel);
  for (const [rel, bytes] of first) assert.doesNotMatch(bytes.toString(), /\/(var|tmp|Users|home|private)\/|sourceMappingURL/, rel);
});

test("the revision is the core's package digest (mods.rs pins the same value)", () => {
  const files = new Map([["main.js", Buffer.from("export default 1;\n")], ["mod.json", Buffer.from("{}\n")], ["perch-sdk.d.ts", Buffer.from("not served")]]);
  assert.equal(packageDigest(files), "5b7477fe52e6579f4473624a6d7a7c385e63f84b8273af9986dd2fceec6db433");
});

const refused = (name, main, extra = {}, reason) => test(`refuses ${name}`, () => {
  const sourceDir = tree({ "stock-ui/demo/mod.json": MANIFEST, "stock-ui/demo/main.tsx": main, ...extra });
  assert.throws(() => run(sourceDir), reason);
});
refused("a domain singleton (the app store)", 'import { usePerchStore } from "../../store";\nexport default () => usePerchStore.getState();\n', { "store.ts": "export const usePerchStore = {};\n" }, /reaches app-internal module store\.ts/);
refused("the bootstrap", 'import "../../main";\nexport default () => null;\n', { "main.tsx": "createRoot();\n" }, /reaches app-internal module main\.tsx/);
refused("an undeclared private module", 'import { x } from "../../components/ui/private";\nexport default () => x;\n', { "components/ui/private.ts": "export const x = 1;\n" }, /app-internal module components\/ui\/private\.ts/);
refused("a second React copied in", 'import * as R from "react/cjs/react.development.js";\nexport default () => R;\n', {}, /would copy an npm package.*React comes from the page/);
refused("any other npm package", 'import { create } from "zustand";\nexport default () => create;\n', {}, /"zustand" would copy an npm package/);
refused("import.meta.glob", 'const icons = import.meta.glob("./icons/*.svg", { eager: true });\nexport default () => icons;\n', {}, /import\.meta\.glob` is Vite-only/);
refused("a ?url import", 'import worker from "./worker.mjs?url";\nexport default () => worker;\n', {}, /Vite query import/);
refused("import.meta.env", "export default () => import.meta.env.DEV;\n", {}, /import\.meta\.env` is Vite-only/);
refused("a stylesheet imported for a binding", 'import look from "./look.css";\nexport default () => look;\n', { "stock-ui/demo/look.css": "a{}" }, /import it only for its effect/);
refused("a CSS module", 'import "./look.module.css";\nexport default () => null;\n', { "stock-ui/demo/look.module.css": "a{}" }, /is a CSS module/);
refused("an asset imported other than by default", 'import * as dot from "./dot.svg";\nexport default () => dot;\n', { "stock-ui/demo/dot.svg": "<svg/>" }, /import its URL as a default import/);
refused("an @import", 'import "./look.css";\nexport default () => null;\n', { "stock-ui/demo/look.css": '@import "other.css";' }, /look\.css: @import is not needed/);
refused("a CSS url() that leaves the screen", 'import "./look.css";\nexport default () => null;\n', { "stock-ui/demo/look.css": ".a{background:url(../../logo.png)}", "logo.png": "x" }, /look\.css: url\(\.\.\/\.\.\/logo\.png\) names no file/);
refused("a file a package cannot serve", 'import clip from "./clip.gif";\nexport default () => clip;\n', { "stock-ui/demo/clip.gif": "x" }, /\.gif file, which a package cannot serve/);

test("a stylesheet and its url()s, and an asset's URL, go into the package", () => {
  const files = run(tree({
    "stock-ui/demo/mod.json": MANIFEST,
    "stock-ui/demo/main.tsx": 'import "./look.css";\nimport logo from "./art/logo.svg";\nexport default () => <img className="demo" src={logo} />;\n',
    "stock-ui/demo/look.css": '/* url(not-a-file.png) */ .demo { background: url( "art/dot.png" ); mask: url(#m) }\n',
    "stock-ui/demo/art/logo.svg": "<svg/>",
    "stock-ui/demo/art/dot.png": "png",
  }));
  const main = text(files, "demo/main.js");
  assert.doesNotMatch(main, /look\.css|from "\.\/art/);
  assert.match(main, /import \{ assetUrl as __perchAssetUrl \} from "@perch\/sdk";/);
  assert.match(main, /const logo = __perchAssetUrl\("art\/logo\.svg"\);/);
  assert.equal(text(files, "demo/look.css"), '/* url(not-a-file.png) */ .demo { background: url( "art/dot.png" ); mask: url(#m) }\n');
  assert.equal(text(files, "demo/art/dot.png"), "png");
  const { packages } = JSON.parse(text(files, "catalog.json"));
  assert.deepEqual(packages[0].files, ["art/dot.png", "art/logo.svg", "look.css", "main.js", "mod.json"]);
});
refused("a computed import()", "export default (name: string) => import(`./${name}`);\n", {}, /computed path/);
refused("a missing file", 'import { x } from "./nope";\nexport default () => x;\n', {}, /names no file/);
refused("a nested violation, naming the file", 'import { y } from "./helper";\nexport default () => y;\n', { "stock-ui/demo/helper.ts": 'import { socket } from "../../ws";\nexport const y = socket;\n', "ws.ts": "export const socket = 1;\n" }, /helper\.ts: "\.\.\/\.\.\/ws" reaches app-internal module ws\.ts/);

test("--check finds a changed, a missing and an extra file", () => {
  const files = run(tree(GRAPH));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "perch-stock-out-")), "stock-ui");
  test.after(() => fs.rmSync(path.dirname(out), { recursive: true, force: true }));
  writeExport(out, files);
  assert.deepEqual(checkExport(out, files), []);
  fs.appendFileSync(path.join(out, "demo/main.js"), "\n");
  fs.rmSync(path.join(out, "demo/lazy.js"));
  fs.writeFileSync(path.join(out, "demo/stale.js"), "");
  assert.deepEqual(checkExport(out, files), ["changed demo/main.js", "extra demo/stale.js", "missing demo/lazy.js"]);
});

test("Perch's own stock screens export", () => {
  const files = run(path.join(web, "src", "stock-ui"));
  const { packages } = JSON.parse(text(files, "catalog.json"));
  assert.ok(packages.some((p) => p.id === "keybind-help"));
  for (const p of packages) assert.ok(files.has(`${p.id}/${p.entry}`), p.id);
});

test("stock layouts go out byte for byte beside the packages, and a bad one stops the export", () => {
  const layout = '{ "name": "Perch", "type": "block", "content": "canvas" }\n';
  const files = run(tree({ ...GRAPH, "stock-ui/layouts/main.json": layout }));
  assert.equal(text(files, "layouts/main.json"), layout);
  assert.ok(!JSON.parse(text(files, "catalog.json")).packages.some((entry) => entry.id === "layouts"), "a layout is not a package");
  assert.throws(() => run(tree({ ...GRAPH, "stock-ui/layouts/main.json": "{" })), /stock-ui\/layouts\/main\.json/);
  assert.throws(() => run(tree({ ...GRAPH, "stock-ui/layouts/bad id.json": "{}" })), /layout id/);
});
