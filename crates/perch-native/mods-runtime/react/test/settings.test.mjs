//! The Settings pages' props: what the native client copies from the app (`settings-props.js`) must stay the app's, and
//! the Keyboard page's pages must hold every row the keymap gave and no more than the engine draws in a frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { registerHooks } from "node:module";
import { loadSidebar, repo } from "./support.mjs";

// The host module `settings-props.js` reaches through `host.js` exists only inside the window's engine; nothing here calls it.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "perch" || specifier === "perch-react" || specifier === "perch-engine") return { url: `data:text/javascript,export const Icon=0,bounds=0,forgetBounds=0,probing=0,textWidth=0,Engine=0,focus=0,focused=0,release=0`, shortCircuit: true, format: "module" };
    return next(specifier, context);
  },
});

const web = (file) => fs.readFileSync(path.join(repo, "packages/web/src", file), "utf8");

test("the search engines, chat text sizes and scrollback range are the app's", async () => {
  await loadSidebar();
  const props = await import(path.join(repo, "crates/perch-native/mods/react-runtime/settings-props.js"));
  const engines = [...web("links.ts").matchAll(/\{ id: "(\w+)", label: "([^"]+)", url:/g)].map(([, id, label]) => ({ id, label }));
  assert.deepEqual(props.SEARCH_ENGINES, engines);
  const sizes = [...web("chatFont.ts").matchAll(/\{ value: "([\d.]+)", label: "([^"]+)" \}/g)].map(([, value, label]) => ({ value, label }));
  assert.deepEqual(props.CHAT_FONT_SIZES, sizes);
  const xterm = web("xtermSetup.ts");
  assert.deepEqual(props.SCROLLBACK, { min: +/MIN_SCROLLBACK = (\d+)/.exec(xterm)[1], max: +/MAX_SCROLLBACK = (\d+)/.exec(xterm)[1] });
});

test("the Keyboard page is cut into pages that keep every row and stay small enough to draw", async () => {
  await loadSidebar();
  const { keyboardPages, KEYBOARD_PAGE_ROWS } = await import(path.join(repo, "crates/perch-native/mods/react-runtime/settings-props.js"));
  const rows = (n, id) => Array.from({ length: n }, (_, i) => ({ id: `${id}.${i}`, description: `Row ${i}`, keys: "", edited: false }));
  const groups = [{ id: "a", title: "A", rows: rows(3, "a") }, { id: "b", title: "B", rows: rows(2 * KEYBOARD_PAGE_ROWS + 1, "b") }, { id: "c", title: "C", rows: [] }];
  const pages = keyboardPages(groups);
  assert.deepEqual(pages.map((p) => p.title), ["A", "B (1/3)", "B (2/3)", "B (3/3)", "C"]);
  assert.equal(new Set(pages.map((p) => p.id)).size, pages.length, "a button each");
  assert.ok(pages.every((p) => p.groups.length === 1 && p.groups[0].rows.length <= KEYBOARD_PAGE_ROWS));
  assert.deepEqual(pages.flatMap((p) => p.groups[0].rows.map((r) => r.id)), groups.flatMap((g) => g.rows.map((r) => r.id)), "in order, none lost");
});
