//! The runtime's `@perch/sdk` copies a few constants from app modules it cannot import (they create stores); the
//! copies must stay the app's.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { repo } from "./support.mjs";

/** The `key: "value"` pairs of the object literal after `name` in `file`. */
function pairs(file, name) {
  const text = fs.readFileSync(`${repo}/${file}`, "utf8");
  const start = text.indexOf(name);
  assert.ok(start >= 0, `${name} is in ${file}`);
  const body = text.slice(text.indexOf("{", start), text.indexOf("};", start));
  return Object.fromEntries([...body.matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

test("a tab's classes by pane state are the app's", () => {
  const app = pairs("packages/web/src/tabPaneState.ts", "TAB_PANE_CLASS");
  assert.deepEqual(Object.keys(app).sort(), ["focused", "hidden", "visible"]);
  assert.deepEqual(pairs("crates/perch-native/mods-runtime/react/sdk.mjs", "export const tabStateClass"), app);
});
