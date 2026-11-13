//! `bundle/` is what build.mjs writes from the current sources and the app's current CSS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFiles, differences } from "../build.mjs";

test("the committed bundle is current", async () => {
  assert.deepEqual(differences(await buildFiles()), [], "run npm run build:mods-runtime");
});
