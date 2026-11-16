#!/usr/bin/env node
//! compare.mjs: the parity gate. Checks a native rendering (JSON and PNG, schema `perch-native-parity/1`) against the
//! web reference that `web-reference.spec.ts` wrote, and prints a Markdown report.
//!
//!   node compare.mjs --web <web.json> --native <native.json> [--web-png p] [--native-png p] [--out dir]
//!   node compare.mjs --web-dir <dir> --native-dir <dir> [--out dir]     (every web JSON found, same file name natively)
//!
//! The gate, per state. Every named element of the web reference must be in the native output (a missing or an extra
//! one fails; an instance is its name and key, or its index among its name when it has no key), and:
//!   - its box (x, y, width, height, in logical pixels relative to the sidebar root) is within 2 px;
//!   - every colour the web side took from a theme token is identical (`#rrggbbaa`), and the token table is identical;
//!   - for a `textSized` element (its width comes from its own text) x, y and height are within 2 px, font family, size,
//!     weight and line height are exact, and width is within 2 px or 3 % of the web width, whichever is larger. Every
//!     width difference of such an element is listed, passing or not;
//!   - for a `fontGated` element (`font: true` in the names: text an engine draws, as the file editor's) font family,
//!     size, weight and line height are exact; so is every element the web draws in the app's monospace stack
//!     (`ui-monospace`, SF Mono in WebKit), named for its font or not, so a native element drawn in Menlo fails;
//! Not gated, only reported: colours that come from no token, text differences, fonts of other elements, and the pixel
//! difference between the two PNGs (plus a side-by-side image, written to --out).
//!
//! Accepted failures: `accepted-failures.json` beside this file (or `--accepted <file>`) lists failing states by label
//! (`screen/state/theme`) with a reason. Exits 1 when a state fails that is not listed, or when a listed state was
//! compared and now passes (take it off the list). Listed states that were not compared in this run are ignored.
//!
//! With --web-dir, every state of every screen in the state list (`screens.json`, or `PARITY_SCREENS` / `--screens`
//! for a part of it; each screen's states in `fixtures/<screen>.json`, in both themes) must have a web reference: a
//! state without one fails and cannot be accepted, so a stale or partial reference set cannot drop states silently.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "./png.mjs";

export const SCHEMA = "perch-native-parity/1";
export const BOX_TOLERANCE_PX = 2;
export const TEXT_WIDTH_TOLERANCE = { px: 2, ratio: 0.03 };
/** `line-height` is stored rounded to two decimals; anything closer than this is the same value. */
/** The app's monospace stack (`--font-mono`), as the web reference reads it from an element's computed style. */
const MONO_STACK = /^ui-monospace\b/;
const NUMBER_EPSILON = 0.01;
/** A pixel counts as different when any channel differs by more than this (of 255). */
export const PIXEL_THRESHOLD = 16;

const idOf = (element, index) => (element.key != null ? `${element.name}:${element.key}` : `${element.name}#${index}`);

/** Instances by id; an instance without a key is numbered in order within its name (its `index`, when given). */
function instances(doc) {
  const seen = new Map();
  const out = new Map();
  for (const element of doc.elements ?? []) {
    const next = seen.get(element.name) ?? 0;
    seen.set(element.name, next + 1);
    const id = idOf(element, element.index ?? next);
    if (out.has(id)) throw new Error(`two elements are both ${id}`);
    out.set(id, element);
  }
  return out;
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const signed = (n) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
const boxText = (b) => `x ${fmt(b.x)}, y ${fmt(b.y)}, w ${fmt(b.width)}, h ${fmt(b.height)}`;
const colourText = (c) => (c ? `${c.value}${c.token ? ` (${c.token})` : ""}` : "none");

/** The gate on two parsed documents. Pure: no files. */
export function compareDocs(web, native) {
  const failures = [];
  const widths = [];
  const info = { textDiffs: [], colourDiffs: 0, fontDiffs: 0 };
  const fail = (id, check, webValue, nativeValue, detail = "") => failures.push({ id, check, web: webValue, native: nativeValue, detail });
  const label = `${web.screen}/${web.state}/${web.theme}`;

  for (const doc of [web, native]) if (doc.schema !== SCHEMA) fail("document", "schema", SCHEMA, String(doc.schema));
  for (const field of ["screen", "state", "theme"]) if (web[field] !== native[field]) fail("document", field, String(web[field]), String(native[field]));
  if (failures.length) return { label, pass: false, failures, widths, info, counts: { web: 0, native: 0, missing: 0, extra: 0 } };

  for (const [name, value] of Object.entries(web.tokens ?? {})) {
    const other = native.tokens?.[name];
    if (other !== value) fail(`token ${name}`, "theme token", value, other ?? "missing");
  }

  const mine = instances(web);
  const theirs = instances(native);
  let missing = 0;
  let extra = 0;
  for (const [id, w] of mine) {
    const n = theirs.get(id);
    if (!n) { missing++; fail(id, "missing in native", boxText(w.box), "-"); continue; }
    if (!["x", "y", "width", "height"].every((d) => Number.isFinite(n.box?.[d]))) { fail(id, "box", boxText(w.box), "missing or not numbers"); continue; }

    const dims = w.textSized ? ["x", "y", "height"] : ["x", "y", "width", "height"];
    const off = dims.filter((d) => Math.abs(n.box[d] - w.box[d]) > BOX_TOLERANCE_PX + 1e-9);
    if (off.length) fail(id, "box", boxText(w.box), boxText(n.box), off.map((d) => `${d} ${signed(n.box[d] - w.box[d])}`).join(", "));

    for (const [prop, colour] of Object.entries(w.colors ?? {})) {
      const other = n.colors?.[prop];
      if (colour.token) {
        if (other?.value !== colour.value) fail(id, `colour ${prop}`, colourText(colour), colourText(other));
      } else if (other?.value !== colour.value) info.colourDiffs++;
    }

    if (w.text !== undefined && n.text !== w.text) info.textDiffs.push({ id, web: w.text, native: n.text ?? "" });

    if (w.textSized) {
      const delta = n.box.width - w.box.width;
      const allowed = Math.max(TEXT_WIDTH_TOLERANCE.px, TEXT_WIDTH_TOLERANCE.ratio * w.box.width);
      const ok = Math.abs(delta) <= allowed + 1e-9;
      if (Math.abs(delta) >= NUMBER_EPSILON / 2) widths.push({ id, web: w.box.width, native: n.box.width, delta, percent: w.box.width ? (delta / w.box.width) * 100 : 0, allowed, ok });
      if (!ok) fail(id, "text width", fmt(w.box.width), fmt(n.box.width), `${signed(delta)} px, allowed ${fmt(allowed)}`);
    }
    if (w.textSized || w.fontGated || MONO_STACK.test(w.font?.family ?? "")) {
      if (!w.font) continue;
      if (!n.font) { fail(id, "font", JSON.stringify(w.font), "missing"); continue; }
      const bad = [];
      if (n.font.family !== w.font.family) bad.push(`family ${JSON.stringify(n.font.family)}`);
      if (Math.abs(n.font.size - w.font.size) > NUMBER_EPSILON / 2) bad.push(`size ${fmt(n.font.size)}`);
      if (n.font.weight !== w.font.weight) bad.push(`weight ${n.font.weight}`);
      if (Math.abs(n.font.lineHeight - w.font.lineHeight) > NUMBER_EPSILON + 1e-9) bad.push(`line height ${fmt(n.font.lineHeight)}`);
      if (bad.length) fail(id, "font", `${w.font.family}, ${fmt(w.font.size)}px/${fmt(w.font.lineHeight)}, ${w.font.weight}`, bad.join("; "));
    } else if (w.font && n.font && (n.font.family !== w.font.family || n.font.size !== w.font.size || n.font.weight !== w.font.weight)) info.fontDiffs++;
  }
  for (const [id, n] of theirs) if (!mine.has(id)) { extra++; fail(id, "extra in native", "-", boxText(n.box)); }

  return { label, pass: failures.length === 0, failures, widths, info, counts: { web: mine.size, native: theirs.size, missing, extra } };
}

/** Pixel difference of two RGBA images: pixels (of the larger canvas) differing by more than PIXEL_THRESHOLD in any channel,
 * where a pixel only one image has counts as different, and the mean absolute channel difference. */
export function pixelDiff(a, b) {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const mask = new Uint8Array(width * height);
  let differing = 0;
  let sum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inA = x < a.width && y < a.height;
      const inB = x < b.width && y < b.height;
      let max = 255;
      if (inA && inB) {
        max = 0;
        for (let c = 0; c < 4; c++) {
          const d = Math.abs(a.data[(y * a.width + x) * 4 + c] - b.data[(y * b.width + x) * 4 + c]);
          sum += d;
          if (d > max) max = d;
        }
      } else sum += 4 * 255;
      if (max > PIXEL_THRESHOLD) { differing++; mask[y * width + x] = 1; }
    }
  }
  const total = width * height;
  return { width, height, sizeMatch: a.width === b.width && a.height === b.height, differing, total, percent: total ? (differing / total) * 100 : 0, meanAbs: total ? sum / (total * 4) : 0, mask };
}

/** The web image, the native image and the difference (red where they differ over the dimmed web image), 8 px apart. */
export function sideBySide(a, b, diff) {
  const gap = 8;
  const height = diff.height;
  const width = a.width + b.width + diff.width + 2 * gap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([128, 128, 128, 255], i * 4);
  const paste = (image, left, tint) => {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const from = (y * image.width + x) * 4;
        data.set(tint ? tint(x, y, image.data.subarray(from, from + 4)) : image.data.subarray(from, from + 4), (y * width + left + x) * 4);
      }
    }
  };
  paste(a, 0);
  paste(b, a.width + gap);
  const dimmed = (x, y, px) => (diff.mask[y * diff.width + x] ? [255, 0, 0, 255] : [px[0] * 0.25 + 96, px[1] * 0.25 + 96, px[2] * 0.25 + 96, 255]);
  paste({ width: a.width, height: a.height, data: a.data }, a.width + b.width + 2 * gap, dimmed);
  // Where only the native image has pixels the web panel has none: mark those red too.
  for (let y = 0; y < diff.height; y++) for (let x = a.width; x < diff.width; x++) if (diff.mask[y * diff.width + x]) data.set([255, 0, 0, 255], (y * width + a.width + b.width + 2 * gap + x) * 4);
  for (let y = a.height; y < diff.height; y++) for (let x = 0; x < Math.min(a.width, diff.width); x++) if (diff.mask[y * diff.width + x]) data.set([255, 0, 0, 255], (y * width + a.width + b.width + 2 * gap + x) * 4);
  return { width, height, data };
}

const cell = (value) => String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (...cells) => `| ${cells.map(cell).join(" | ")} |`;
const table = (head, rows) => [row(...head), row(...head.map(() => "---")), ...rows.map((r) => row(...r))].join("\n");

/** One state: compareDocs plus the PNGs (both paths optional). Returns the result with its pixel report. */
export function compareFiles({ webJson, nativeJson, webPng, nativePng, outDir }) {
  const web = JSON.parse(fs.readFileSync(webJson, "utf8"));
  const native = JSON.parse(fs.readFileSync(nativeJson, "utf8"));
  const result = compareDocs(web, native);
  result.pixels = null;
  result.pixelNote = "";
  try {
    if (!webPng || !nativePng || !fs.existsSync(webPng) || !fs.existsSync(nativePng)) throw new Error(`PNG missing (${!fs.existsSync(webPng ?? "") ? webPng : nativePng})`);
    const a = decodePng(fs.readFileSync(webPng));
    const b = decodePng(fs.readFileSync(nativePng));
    const diff = pixelDiff(a, b);
    result.pixels = { differing: diff.differing, total: diff.total, percent: diff.percent, meanAbs: diff.meanAbs, sizeMatch: diff.sizeMatch, web: `${a.width}x${a.height}`, native: `${b.width}x${b.height}` };
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      result.sideBySide = path.join(outDir, `${path.basename(webJson, ".json")}.side-by-side.png`);
      fs.writeFileSync(result.sideBySide, encodePng(sideBySide(a, b, diff)));
    }
  } catch (error) {
    result.pixelNote = `pixel difference not computed: ${error.message}`;
  }
  return result;
}

/** The Markdown report for any number of states. */
export function report(results, verdict = judge(results, new Map())) {
  const out = [];
  const failed = results.filter((r) => !r.pass);
  const accepted = failed.length - verdict.unlisted.length;
  out.push(`# Native parity: ${verdict.ok ? "PASS" : "FAIL"} (${results.length - failed.length} of ${results.length} states pass, ${accepted} failing accepted, ${verdict.unlisted.length} failing not accepted, ${verdict.nowPassing.length} accepted but now passing)`, "");
  const noReference = results.filter((r) => r.noReference).map((r) => r.label);
  if (noReference.length) out.push(`No web reference (in the state list, never compared; regenerate the references): ${noReference.join(", ")}.`, "");
  if (verdict.unlisted.length) out.push(`Failing and not accepted: ${verdict.unlisted.join(", ")}.`, "");
  if (verdict.nowPassing.length) out.push(`Accepted but now passing (take them off the accepted list): ${verdict.nowPassing.join(", ")}.`, "");
  out.push(table(
    ["State", "Gate", "Elements web/native", "Missing", "Extra", "Failed checks", "Pixels differing", "Side by side"],
    results.map((r) => [
      r.label, r.pass ? "PASS" : r.noReference ? "NO REFERENCE" : verdict.accepted.has(r.label) ? "FAIL (accepted)" : "FAIL", `${r.counts.web}/${r.counts.native}`, r.counts.missing, r.counts.extra, r.failures.length,
      r.pixels ? `${r.pixels.percent.toFixed(2)}% (${r.pixels.differing} of ${r.pixels.total}, mean ${r.pixels.meanAbs.toFixed(2)}/255${r.pixels.sizeMatch ? "" : `, SIZE web ${r.pixels.web} native ${r.pixels.native}`})` : r.pixelNote || "n/a",
      r.sideBySide ?? "-",
    ]),
  ), "");
  for (const r of results) {
    out.push(`## ${r.label}: ${r.pass ? "PASS" : verdict.accepted.has(r.label) ? `FAIL (accepted: ${verdict.accepted.get(r.label)})` : "FAIL"}`, "");
    if (r.failures.length) out.push(table(["Element", "Check", "Web", "Native", "Detail"], r.failures.map((f) => [f.id, f.check, f.web, f.native, f.detail])), "");
    if (r.widths.length) out.push("Width differences of text-sized elements (every one, gated or not):", "", table(
      ["Element", "Web width", "Native width", "Delta px", "Delta %", "Allowed px", "Result"],
      r.widths.map((w) => [w.id, fmt(w.web), fmt(w.native), signed(w.delta), `${signed(w.percent)}%`, fmt(w.allowed), w.ok ? "within" : "OVER"]),
    ), "");
    const notes = [];
    if (r.info.colourDiffs) notes.push(`${r.info.colourDiffs} colour(s) that come from no theme token differ`);
    if (r.info.fontDiffs) notes.push(`${r.info.fontDiffs} font(s) of elements that are not text-sized differ`);
    if (r.info.textDiffs.length) notes.push(`${r.info.textDiffs.length} text(s) differ: ${r.info.textDiffs.slice(0, 5).map((t) => `${t.id} web "${t.web}" native "${t.native}"`).join("; ")}${r.info.textDiffs.length > 5 ? "; ..." : ""}`);
    if (r.pixelNote) notes.push(r.pixelNote);
    if (notes.length) out.push(`Not gated: ${notes.join("; ")}.`, "");
  }
  return out.join("\n");
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The state list: `screen.state.theme` for every state of every screen named (default: `screens.json`). */
export function expectedStates(fixturesDir, screens) {
  const out = [];
  for (const screen of screens) {
    const file = path.join(fixturesDir, `${screen}.json`);
    if (!fs.existsSync(file)) throw new Error(`the state list names ${screen}, which has no fixture ${file}`);
    for (const state of JSON.parse(fs.readFileSync(file, "utf8")).states) for (const theme of ["light", "dark"]) out.push(`${screen}.${state.id}.${theme}`);
  }
  return out;
}

const DEFAULT_ACCEPTED = path.join(path.dirname(fileURLToPath(import.meta.url)), "accepted-failures.json");

/** Accepted failures by label, from `{ "accepted": [{ "state": "screen/state/theme", "reason": "..." }] }`. */
export function loadAccepted(file) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = new Map();
  for (const entry of doc.accepted ?? []) {
    if (typeof entry.state !== "string" || typeof entry.reason !== "string" || !entry.reason.trim()) throw new Error(`${file}: every entry needs a state and a reason`);
    if (out.has(entry.state)) throw new Error(`${file}: ${entry.state} is listed twice`);
    out.set(entry.state, entry.reason);
  }
  return out;
}

/** The exit verdict: failing states not on the list, and listed states compared in this run that now pass. */
export function judge(results, accepted) {
  const unlisted = results.filter((r) => !r.pass && (r.noReference || !accepted.has(r.label))).map((r) => r.label);
  const nowPassing = results.filter((r) => r.pass && accepted.has(r.label)).map((r) => r.label);
  return { ok: unlisted.length === 0 && nowPassing.length === 0, unlisted, nowPassing, accepted };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag?.startsWith("--") || argv[i + 1] === undefined) throw new Error(`bad argument ${flag ?? ""}`);
    args[flag.slice(2)] = argv[i + 1];
  }
  return args;
}

const USAGE = "usage: compare.mjs --web <web.json> --native <native.json> [--web-png p] [--native-png p] [--out dir] [--accepted file]\n       compare.mjs --web-dir <dir> --native-dir <dir> [--out dir] [--accepted file] [--screens a,b] [--fixtures dir]";

export function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (error) { console.error(`${error.message}\n${USAGE}`); return 2; }
  let accepted;
  try { accepted = args.accepted || fs.existsSync(DEFAULT_ACCEPTED) ? loadAccepted(args.accepted ?? DEFAULT_ACCEPTED) : new Map(); } catch (error) { console.error(error.message); return 2; }
  const out = args.out ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../artifacts-native-parity/compare");
  const jobs = [];
  let missing = [];
  if (args["web-dir"] && args["native-dir"]) {
    for (const file of fs.readdirSync(args["web-dir"]).filter((f) => f.endsWith(".json")).sort()) {
      const base = file.slice(0, -5);
      jobs.push({ label: base, webJson: path.join(args["web-dir"], file), nativeJson: path.join(args["native-dir"], file), webPng: path.join(args["web-dir"], `${base}.png`), nativePng: path.join(args["native-dir"], `${base}.png`), outDir: out });
    }
    if (!jobs.length) { console.error(`no web JSON in ${args["web-dir"]}`); return 2; }
    const screens = (args.screens ?? process.env.PARITY_SCREENS)?.split(",") ?? JSON.parse(fs.readFileSync(path.join(HERE, "screens.json"), "utf8")).screens;
    let expected;
    try { expected = expectedStates(args.fixtures ?? path.join(HERE, "fixtures"), screens); } catch (error) { console.error(error.message); return 2; }
    const found = new Set(jobs.map((job) => job.label));
    missing = expected.filter((label) => !found.has(label));
  } else if (args.web && args.native) {
    jobs.push({ label: path.basename(args.web, ".json"), webJson: args.web, nativeJson: args.native, webPng: args["web-png"] ?? args.web.replace(/\.json$/, ".png"), nativePng: args["native-png"] ?? args.native.replace(/\.json$/, ".png"), outDir: out });
  } else { console.error(USAGE); return 2; }

  const results = jobs.map((job) => {
    try { return compareFiles(job); } catch (error) {
      // A missing or unreadable native output is a failed state, not a crash.
      return { label: job.label.replace(/^([^.]+)\.(.+)\.(dark|light)$/, "$1/$2/$3"), pass: false, failures: [{ id: "document", check: "readable", web: job.webJson, native: job.nativeJson, detail: error.message }], widths: [], info: { textDiffs: [], colourDiffs: 0, fontDiffs: 0 }, counts: { web: 0, native: 0, missing: 0, extra: 0 }, pixels: null, pixelNote: "" };
    }
  });
  for (const label of missing) {
    const [screen, state, theme] = [label.split(".")[0], label.split(".").slice(1, -1).join("."), label.split(".").at(-1)];
    results.push({ label: `${screen}/${state}/${theme}`, pass: false, noReference: true, failures: [{ id: "document", check: "web reference", web: path.join(args["web-dir"], `${label}.json`), native: "", detail: "the state is in the state list but has no web reference: regenerate the references (npm run parity:web in e2e) rather than copying an older set" }], widths: [], info: { textDiffs: [], colourDiffs: 0, fontDiffs: 0 }, counts: { web: 0, native: 0, missing: 0, extra: 0 }, pixels: null, pixelNote: "" });
  }
  const verdict = judge(results, accepted);
  console.log(report(results, verdict));
  return verdict.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
