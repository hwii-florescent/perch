#!/usr/bin/env node
/**
 * Regression check for the visual harness itself: a failed, empty or
 * incomplete run must never print IDENTICAL or exit 0.
 *
 *   node e2e/visual/selftest.mjs              # diff checks (seconds)
 *   node e2e/visual/selftest.mjs --with-snap  # also: snap exits nonzero on failure (bounded, under a minute)
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const visual = path.join(here, "visual.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perch-vis-selftest-"));
const run = (...args) => spawnSync("node", [visual, ...args], { encoding: "utf8" });
const states = JSON.parse(run("states").stdout);

// --- fixtures -------------------------------------------------------------

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function png(shade) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
  const row = Buffer.from([0, shade, shade, shade, 255, shade, shade, shade, 255]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat([row, row]))), chunk("IEND", Buffer.alloc(0))]);
}
const element = (p, extra = {}) => ({ p, tag: "div", id: "", cls: "", rect: [0, 0, 10, 10], text: "", s: { color: "rgb(0, 0, 0)", ...extra } });

/** A complete, valid, clean engine directory. */
function writeRun(dir, { engine = "chromium", skip = [], failures = [], color = "rgb(0, 0, 0)", shade = 10, elements = 8 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "failures.json"), JSON.stringify(failures));
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ engine, only: null, states }));
  for (const name of states) {
    if (skip.includes(name)) continue;
    fs.writeFileSync(path.join(dir, `${name}.dump.json`), JSON.stringify(Array.from({ length: elements }, (_, i) => element(`body/${i}`, { color }))));
    fs.writeFileSync(path.join(dir, `${name}.hover.json`), "[]");
    fs.writeFileSync(path.join(dir, `${name}.focus.json`), "[]");
    fs.writeFileSync(path.join(dir, `${name}.png`), png(shade));
  }
}
let n = 0;
const fresh = (engines = ["chromium"], opts = {}) => {
  const root = path.join(tmp, `r${n++}`);
  for (const e of engines) writeRun(path.join(root, e), { engine: e, ...opts });
  return root;
};

// --- cases ----------------------------------------------------------------

let failed = 0;
function check(name, result, { exit, shows, hides }) {
  const out = result.stdout + result.stderr;
  const problems = [];
  if (exit === 0 ? result.status !== 0 : result.status === 0) problems.push(`exit ${result.status}, wanted ${exit === 0 ? "0" : "nonzero"}`);
  if (shows && !out.includes(shows)) problems.push(`output lacks "${shows}"`);
  if (hides && out.includes(hides)) problems.push(`output must not contain "${hides}"`);
  console.log(`${problems.length ? "✗" : "✓"} ${name}${problems.length ? "\n    " + problems.join("\n    ") + "\n" + out.slice(0, 600) : ""}`);
  if (problems.length) failed++;
}
const diff = (a, b, ...flags) => run("diff", a, b, "--engines", "chromium", ...flags);

check("identical complete runs pass", diff(fresh(), fresh()), { exit: 0, shows: "IDENTICAL" });
const failuresOnly = (tag) => {
  const r = path.join(tmp, tag);
  fs.mkdirSync(path.join(r, "chromium"), { recursive: true });
  fs.writeFileSync(path.join(r, "chromium/failures.json"), '["boom"]');
  return r;
};
check("both runs only have capture failures and no snapshots (the reported false positive)",
  diff(failuresOnly("fp-a"), failuresOnly("fp-b")), { exit: 1, shows: "INVALID RUN", hides: "IDENTICAL" });
check("empty directories fail", diff(fresh([]), fresh([])), { exit: 1, hides: "IDENTICAL" });
check("recorded failures fail even with complete snapshots", diff(fresh(["chromium"], { failures: ["05-session-running: timeout"] }), fresh()), { exit: 1, shows: "recorded failure", hides: "IDENTICAL" });
check("a state missing from BOTH runs fails", diff(fresh(["chromium"], { skip: [states[3]] }), fresh(["chromium"], { skip: [states[3]] })), { exit: 1, shows: "missing", hides: "IDENTICAL" });
check("a state missing from one run fails", diff(fresh(), fresh(["chromium"], { skip: [states[0]] })), { exit: 1, hides: "IDENTICAL" });
check("an empty capture (no elements) fails", diff(fresh(["chromium"], { elements: 0 }), fresh(["chromium"], { elements: 0 })), { exit: 1, shows: "empty capture", hides: "IDENTICAL" });
check("missing failures.json (interrupted run) fails", (() => { const a = fresh(), b = fresh(); fs.rmSync(path.join(b, "chromium/failures.json")); return diff(a, b); })(), { exit: 1, hides: "IDENTICAL" });
check("a missing engine (webkit) fails when both are required", run("diff", fresh(), fresh(), "--engines", "chromium,webkit"), { exit: 1, shows: "webkit", hides: "IDENTICAL" });
check("a computed-style change fails", diff(fresh(), fresh(["chromium"], { color: "rgb(1, 2, 3)" })), { exit: 1, shows: "difference", hides: "IDENTICAL" });
check("a screenshot-only change fails (not dismissed by matching styles)", diff(fresh(), fresh(["chromium"], { shade: 200 })), { exit: 1, shows: "px differ", hides: "IDENTICAL" });
check("a screenshot change passes only when that state was reviewed by name",
  diff(fresh(), fresh(["chromium"], { shade: 200 }), "--reviewed", states.join(",")), { exit: 0, shows: "reviewed" });
check("an unknown --only filter fails", diff(fresh(), fresh(), "--only", "no-such-state"), { exit: 1, hides: "IDENTICAL" });

if (process.argv.includes("--with-snap")) {
  const snapOnly = (dist, tag) => spawnSync("node", [visual, "snap", dist, path.join(tmp, tag), "--engines", "chromium", "--only", "01-home"], { encoding: "utf8", timeout: 60_000 });
  // No web build at all: must fail before booting anything.
  const t0 = Date.now();
  const missing = snapOnly(path.join(tmp, "no-dist"), "snap-missing");
  check("snap exits nonzero, fast, when the web build is missing", missing, { exit: 1, shows: "no web build" });
  if (Date.now() - t0 > 15_000) { console.log("✗ missing-build failure was not fast"); failed++; }
  // A build that renders nothing: must fail on the empty capture, and diff must reject its output.
  const junk = path.join(tmp, "junk-dist");
  fs.mkdirSync(junk);
  fs.writeFileSync(path.join(junk, "index.html"), "<!doctype html><title>x</title>");
  const blank = snapOnly(junk, "snap-blank");
  check("snap exits nonzero when the app renders nothing", blank, { exit: 1, shows: "empty capture" });
  check("diff rejects that failed snap even against itself", run("diff", path.join(tmp, "snap-blank"), path.join(tmp, "snap-blank"), "--engines", "chromium", "--only", "01-home"), { exit: 1, shows: "INVALID RUN", hides: "IDENTICAL" });
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} selftest case(s) FAILED` : "\nvisual harness selftest ok");
process.exit(failed ? 1 : 0);
