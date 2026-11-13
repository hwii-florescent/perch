//! `@perch/sdk` as stock screens use it: the hooks over a host double, the layout steps a screen leans on, and the
//! constants the runtime copies from app modules it cannot import (they create stores), which must stay the app's.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { loadSidebar, repo } from "./support.mjs";

const tick = () => new Promise((r) => setTimeout(r, 0));

test("useAgentChoices reads the host's answer, remembers a built-in pick and asks the host to manage agents", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const sdk = await import("@perch/sdk");
  const kept = new Map();
  const ran = [];
  const answer = { connected: true, discovery: true, state: "error", error: "refused", choices: [] };
  const perch = {
    isMac: true, render() {}, error: (e) => { throw e; },
    storage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) },
    agentChoices: (host) => (host === "box" ? answer : null),
    command: (name, args) => { ran.push([name, args]); return true; },
  };
  globalThis.perch = perch;
  let seen;
  function Probe() { seen = sdk.useAgentChoices("box"); return h("div"); }
  const handle = runtime.mount(perch, Probe, { container: { width: 10, height: 10 } });
  try {
    assert.deepEqual({ state: seen.state, error: seen.error, lastChoice: seen.lastChoice }, { state: "error", error: "refused", lastChoice: "claude" });
    seen.rememberChoice("pi");
    seen.rememberChoice("codex");
    // React commits a state change made outside an event on a later turn.
    await tick();
    await tick();
    handle.flush();
    assert.equal(seen.lastChoice, "codex", "only the built-in agents are remembered");
    assert.equal(kept.get("perch.lastAgentChoice"), "codex");
    seen.manage();
    assert.deepEqual(ran, [["agents.manage", {}]]);
  } finally {
    handle.unmount();
  }
});

test("a width of the whole parent less the box's side margins is drawn as a stretch", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  globalThis.perch = perch;
  const field = (className) => h("input", { type: "text", className, readOnly: true, value: "" });
  const Fields = () => h("div", null, field("mx-2 w-[calc(100%_-_1rem)]"), field("mx-1 w-[calc(100%_-_1rem)]"));
  const handle = runtime.mount(perch, Fields, { container: { width: 200, height: 80 } });
  try {
    const inputs = [];
    const walk = (n) => { if (n.kind === "input") inputs.push(n); for (const c of n.children ?? []) walk(c); };
    walk(handle.description.root);
    assert.equal(inputs[0].style.self, "stretch");
    assert.equal(inputs[0].style.w, undefined);
    assert.notEqual(inputs[1].style.self, "stretch", "margins that do not add up are not a stretch");
  } finally {
    handle.unmount();
  }
});

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
