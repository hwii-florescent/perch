//! The screens' host (`mods/react-runtime/host.js`): snapshots read again share every unchanged part with the last
//! read, so a memoised row of the source sees a session that did not change as the same object.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { repo } from "./support.mjs";

// The host modules `host.js` imports exist only inside the window's engine; nothing here calls them.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "perch" || specifier === "perch-react" || specifier === "perch-engine" || specifier === "perch-editor" || specifier === "perch-diff" || specifier === "perch-media") return { url: "data:text/javascript,export const Icon=0,bounds=0,forgetBounds=0,probing=0,textWidth=0,Engine=0,events=0", shortCircuit: true, format: "module" };
    return next(specifier, context);
  },
});

test("a snapshot read again keeps the objects of the parts that did not change, list items matched by id", async () => {
  const { share } = await import(pathToFileURL(path.join(repo, "crates/perch-native/mods/react-runtime/host.js")).href);
  const session = (id, state) => ({ id, title: `Session ${id}`, state, tags: ["a"] });
  const old = { hostId: "local", sessions: [session("s1", "idle"), session("s2", "idle"), session("s3", "working")] };
  assert.equal(share(old, structuredClone(old)), old, "an equal read is the same snapshot");
  // s3 moves to the front and s2 changes.
  const next = { hostId: "local", sessions: [session("s3", "working"), session("s1", "idle"), session("s2", "done")] };
  const shared = share(old, next);
  assert.notEqual(shared, old);
  assert.equal(shared.sessions[0], old.sessions[2], "a moved session that did not change is the same object");
  assert.equal(shared.sessions[1], old.sessions[0]);
  assert.notEqual(shared.sessions[2], old.sessions[1], "a changed session is a new object");
  assert.equal(shared.sessions[2].tags, old.sessions[1].tags, "with its unchanged parts shared");
  assert.deepEqual(shared, next, "and the value is the new read's");
  assert.deepEqual(share({ a: 1 }, { a: 1, b: undefined }), { a: 1, b: undefined }, "a key that appears is a change");
});
