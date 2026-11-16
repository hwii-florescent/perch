//! Self-test of the comparator: `node --test e2e/native-parity/compare.test.mjs`. The web reference compared with
//! itself passes; a box moved 3 px, a changed token colour, a missing or extra element and a wrong font fail; a
//! text-sized width off by 2.5 % passes and by 4 % on a wide element fails. It runs on the real reference output when
//! `web-reference.spec.ts` has written it, and always on a small built-in document.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compareDocs, pixelDiff } from "./compare.mjs";
import { decodePng, encodePng } from "./png.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL = path.resolve(here, "../artifacts-native-parity/web/sidebar.by-project.dark.json");
const FONT = { family: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif", size: 12.5, weight: 500, lineHeight: 15.6, lineHeightNormal: false };
const el = (name, key, box, extra = {}) => ({ name, key, index: 0, box: { x: 0, y: 0, width: 0, height: 0, ...box }, textSized: false, colors: {}, ...extra });
const synthetic = () => ({
  schema: "perch-native-parity/1", screen: "demo", state: "one", theme: "dark",
  tokens: { accent: "#c8c8c8ff", text: "#d8d8d8ff", "surface-1": "#333333ff" },
  elements: [
    el("root", null, { width: 240, height: 800 }),
    el("row", "a", { x: 10, y: 100, width: 220, height: 32 }, { colors: { backgroundColor: { value: "#333333ff", token: "surface-1" } } }),
    el("title", "a", { x: 40, y: 108, width: 200, height: 16 }, { textSized: true, text: "A wide title", colors: { color: { value: "#d8d8d8ff", token: "text" } }, font: FONT }),
    el("title", "b", { x: 40, y: 140, width: 40, height: 16 }, { textSized: true, text: "Hi", colors: { color: { value: "#123456ff", token: null } }, font: FONT }),
  ],
});
const clone = (doc) => structuredClone(doc);
const find = (doc, name, key = null) => doc.elements.find((e) => e.name === name && e.key === key);
const checks = (result) => result.failures.map((f) => `${f.id} ${f.check}`);

for (const [label, load] of [["built-in document", synthetic], ...(fs.existsSync(REAL) ? [["web reference output", () => JSON.parse(fs.readFileSync(REAL, "utf8"))]] : [])]) {
  test(`${label}: compared with itself it passes`, () => {
    const doc = load();
    const result = compareDocs(doc, clone(doc));
    assert.deepEqual(result.failures, []);
    assert.equal(result.pass, true);
    assert.equal(result.counts.missing + result.counts.extra, 0);
  });

  test(`${label}: a box moved 3 px fails, 2 px passes`, () => {
    const doc = load();
    const target = doc.elements.find((e) => !e.textSized && e.box.width > 0);
    const moved = clone(doc);
    find(moved, target.name, target.key).box.x += 3;
    assert.equal(compareDocs(doc, moved).pass, false);
    assert.match(checks(compareDocs(doc, moved)).join(), /box/);
    const near = clone(doc);
    find(near, target.name, target.key).box.x += 2;
    assert.equal(compareDocs(doc, near).pass, true);
  });

  test(`${label}: a changed token colour fails, a changed non-token colour does not`, () => {
    const doc = load();
    const target = doc.elements.find((e) => Object.values(e.colors).some((c) => c.token));
    const prop = Object.keys(target.colors).find((p) => target.colors[p].token);
    const changed = clone(doc);
    find(changed, target.name, target.key).colors[prop].value = "#010203ff";
    const result = compareDocs(doc, changed);
    assert.equal(result.pass, false);
    assert.match(checks(result).join(), /colour/);
    const untoken = clone(doc);
    for (const e of untoken.elements) for (const c of Object.values(e.colors)) if (!c.token) c.value = "#010203ff";
    assert.equal(compareDocs(doc, untoken).pass, true);
  });

  test(`${label}: a changed theme token fails`, () => {
    const doc = load();
    const changed = clone(doc);
    changed.tokens[Object.keys(changed.tokens)[0]] = "#010203ff";
    assert.match(checks(compareDocs(doc, changed)).join(), /theme token/);
  });

  test(`${label}: a missing and an extra element fail`, () => {
    const doc = load();
    const fewer = clone(doc);
    const dropped = fewer.elements.pop();
    const result = compareDocs(doc, fewer);
    assert.equal(result.pass, false);
    assert.equal(result.counts.missing, 1);
    assert.ok(result.failures.some((f) => f.check === "missing in native" && f.id.startsWith(dropped.name)));
    const more = clone(doc);
    more.elements.push(el("surprise", "x", { width: 10, height: 10 }));
    const extra = compareDocs(doc, more);
    assert.equal(extra.pass, false);
    assert.equal(extra.counts.extra, 1);
  });
}

test("a text-sized width off by 2.5 % passes and by 4 % on a wide element fails; every difference is listed", () => {
  const web = synthetic();
  const at = (percent) => { const doc = clone(web); find(doc, "title", "a").box.width *= 1 + percent / 100; return doc; };
  const within = compareDocs(web, at(2.5)); // 5 px of 200: over 2 px, inside 3 %
  assert.equal(within.pass, true);
  assert.equal(within.widths.length, 1);
  assert.equal(within.widths[0].ok, true);
  const over = compareDocs(web, at(4)); // 8 px of 200
  assert.equal(over.pass, false);
  assert.match(checks(over).join(), /title:a text width/);
  assert.equal(over.widths[0].ok, false);
  assert.ok(Math.abs(over.widths[0].percent - 4) < 1e-9);
});

test("a narrow text-sized element is held to 2 px, not 3 %", () => {
  const web = synthetic();
  const wider = (px) => { const doc = clone(web); find(doc, "title", "b").box.width += px; return doc; };
  assert.equal(compareDocs(web, wider(2)).pass, true);
  assert.equal(compareDocs(web, wider(2.5)).pass, false); // 6.25 % of 40, but over 2 px and over 3 % (1.2 px)
});

test("a text-sized element's width is not a box failure, its x, y and height still are", () => {
  const web = synthetic();
  const doc = clone(web);
  find(doc, "title", "a").box.width += 6;
  find(doc, "title", "a").box.height += 3;
  assert.match(checks(compareDocs(web, doc)).join(), /title:a box/);
});

test("a text-sized element's font must be exact", () => {
  const web = synthetic();
  for (const change of [(f) => { f.family = "Helvetica"; }, (f) => { f.size = 13; }, (f) => { f.weight = 600; }, (f) => { f.lineHeight = 16; }]) {
    const doc = clone(web);
    change(find(doc, "title", "a").font);
    assert.match(checks(compareDocs(web, doc)).join(), /title:a font/);
  }
  const missing = clone(web);
  delete find(missing, "title", "a").font;
  assert.match(checks(compareDocs(web, missing)).join(), /title:a font/);
});

test("a font-gated element's font must be exact; another element's font is only counted", () => {
  const web = synthetic();
  const MONO = { family: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace", size: 12, weight: 400, lineHeight: 18, lineHeightNormal: false };
  web.elements.push(el("editor", null, { x: 0, y: 200, width: 240, height: 300 }, { fontGated: true, font: MONO }));
  const larger = clone(web);
  Object.assign(find(larger, "editor").font, { size: 13, lineHeight: 20 });
  assert.match(checks(compareDocs(web, larger)).join(), /editor\S* font/);
  const plain = clone(web);
  delete find(plain, "editor").fontGated;
  const other = clone(plain);
  Object.assign(find(other, "editor").font, { size: 13 });
  const result = compareDocs(plain, other);
  assert.deepEqual(checks(result), []);
  assert.equal(result.info.fontDiffs, 1);
});

test("documents of different schema, screen, state or theme are not compared", () => {
  const web = synthetic();
  for (const [field, value] of [["schema", "other/1"], ["screen", "tabs"], ["state", "two"], ["theme", "light"]]) {
    const doc = clone(web);
    doc[field] = value;
    const result = compareDocs(web, doc);
    assert.equal(result.pass, false, field);
    assert.equal(result.failures[0].id, "document");
  }
});

test("pixelDiff counts what differs and the cli writes the side-by-side image and exits by the gate", () => {
  const solid = (width, height, rgba) => ({ width, height, data: Uint8Array.from({ length: width * height * 4 }, (_, i) => rgba[i % 4]) });
  const a = solid(8, 4, [10, 20, 30, 255]);
  const b = solid(8, 4, [10, 20, 30, 255]);
  b.data.set([200, 20, 30, 255], 0);
  const diff = pixelDiff(a, b);
  assert.equal(diff.differing, 1);
  assert.equal(diff.total, 32);
  assert.equal(pixelDiff(a, solid(8, 6, [10, 20, 30, 255])).differing, 16); // the rows only one image has
  assert.deepEqual(decodePng(encodePng(a)).data, a.data);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-compare-"));
  try {
    const write = (name, doc, image) => { fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(doc)); fs.writeFileSync(path.join(dir, `${name}.png`), encodePng(image)); };
    const web = synthetic();
    const moved = clone(web);
    find(moved, "row", "a").box.y += 3;
    write("web", web, a);
    write("same", web, a);
    write("moved", moved, b);
    const run = (native) => spawnSync(process.execPath, [path.join(here, "compare.mjs"), "--web", path.join(dir, "web.json"), "--native", path.join(dir, `${native}.json`), "--out", path.join(dir, "out")], { encoding: "utf8" });
    const same = run("same");
    assert.equal(same.status, 0, same.stdout + same.stderr);
    assert.match(same.stdout, /PASS/);
    const failing = run("moved");
    assert.equal(failing.status, 1, failing.stdout + failing.stderr);
    assert.match(failing.stdout, /row:a \| box/);
    assert.ok(fs.existsSync(path.join(dir, "out", "web.side-by-side.png")));
    const image = decodePng(fs.readFileSync(path.join(dir, "out", "web.side-by-side.png")));
    assert.equal(image.width, 8 * 3 + 16);
    assert.equal(spawnSync(process.execPath, [path.join(here, "compare.mjs"), "--web", path.join(dir, "web.json"), "--native", path.join(dir, "nope.json")], { encoding: "utf8" }).status, 1);
    assert.equal(spawnSync(process.execPath, [path.join(here, "compare.mjs")], { encoding: "utf8" }).status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("accepted failures: an unlisted failure fails, a listed one is accepted, a listed state that passes fails", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-accepted-"));
  try {
    const web = synthetic();
    const moved = clone(web);
    find(moved, "row", "a").box.y += 3;
    for (const [name, doc] of [["web", web], ["same", web], ["moved", moved]]) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(doc));
    const list = (states) => { const file = path.join(dir, `accepted-${states.length}.json`); fs.writeFileSync(file, JSON.stringify({ accepted: states.map((state) => ({ state, reason: "known" })) })); return file; };
    const run = (native, accepted) => spawnSync(process.execPath, [path.join(here, "compare.mjs"), "--web", path.join(dir, "web.json"), "--native", path.join(dir, `${native}.json`), "--out", path.join(dir, "out"), "--accepted", accepted], { encoding: "utf8" });

    const unlisted = run("moved", list([]));
    assert.equal(unlisted.status, 1, unlisted.stdout);
    assert.match(unlisted.stdout, /Failing and not accepted: demo\/one\/dark/);

    const listed = run("moved", list(["demo/one/dark"]));
    assert.equal(listed.status, 0, listed.stdout);
    assert.match(listed.stdout, /FAIL \(accepted: known\)/);

    const nowPassing = run("same", list(["demo/one/dark"]));
    assert.equal(nowPassing.status, 1, nowPassing.stdout);
    assert.match(nowPassing.stdout, /now passing \(take them off the accepted list\): demo\/one\/dark/);

    // A listed state this run did not compare is no reason to fail.
    assert.equal(run("same", list(["demo/other/dark"])).status, 0);
    fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ accepted: [{ state: "demo/one/dark" }] }));
    assert.equal(run("same", path.join(dir, "bad.json")).status, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("with --web-dir, a state of the state list that has no web reference fails, even when accepted", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-list-"));
  try {
    for (const sub of ["web", "native", "fixtures"]) fs.mkdirSync(path.join(dir, sub));
    fs.writeFileSync(path.join(dir, "fixtures", "demo.json"), JSON.stringify({ states: [{ id: "one" }, { id: "two" }] }));
    const doc = synthetic();
    for (const theme of ["light", "dark"]) {
      const themed = { ...clone(doc), theme };
      for (const side of ["web", "native"]) fs.writeFileSync(path.join(dir, side, `demo.one.${theme}.json`), JSON.stringify(themed));
    }
    const accepted = path.join(dir, "accepted.json");
    fs.writeFileSync(accepted, JSON.stringify({ accepted: [{ state: "demo/two/dark", reason: "known" }] }));
    const run = (screens) => spawnSync(process.execPath, [path.join(here, "compare.mjs"), "--web-dir", path.join(dir, "web"), "--native-dir", path.join(dir, "native"), "--out", path.join(dir, "out"), "--accepted", accepted, "--fixtures", path.join(dir, "fixtures"), "--screens", screens], { encoding: "utf8" });

    const partial = run("demo");
    assert.equal(partial.status, 1, partial.stdout);
    assert.match(partial.stdout, /2 of 4 states pass/);
    assert.match(partial.stdout, /No web reference \(.*\): demo\/two\/light, demo\/two\/dark\./);

    fs.writeFileSync(path.join(dir, "fixtures", "demo.json"), JSON.stringify({ states: [{ id: "one" }] }));
    const whole = run("demo");
    assert.equal(whole.status, 0, whole.stdout);
    assert.equal(run("demo,gone").status, 2, "a screen without a fixture is a broken list");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
