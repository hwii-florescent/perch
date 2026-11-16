//! Engine slots: an element with `data-perch-engine` is described as an engine node with its key, and drawn as a box
//! holding the host's element for that key (`files.engine`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";
import { describeToGpui } from "../gpui.mjs";

const settle = () => new Promise((r) => setTimeout(r, 20));

/** The first node of `kind` in a description subtree. */
function find(node, kind) {
  if (!node || node.kind === "text") return null;
  if (node.kind === kind) return node;
  for (const child of node.children ?? []) {
    const found = find(child, kind);
    if (found) return found;
  }
  return null;
}

/** A gpui-kit stand-in recording each builder's children and calls. */
function kit() {
  const make = (kind) => {
    const record = { kind, children: [], calls: [] };
    const proxy = new Proxy(record, {
      get(target, name) {
        if (name === "record") return target;
        return (...args) => {
          if (name === "child") target.children.push(args[0]);
          else target.calls.push(name);
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { div: () => make("div"), image: () => make("image") };
}

async function mounted(slot) {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const Probe = () => h("div", { className: "flex h-full flex-col" }, slot(h));
  return runtime.mount(perch, Probe, { container: { display: "flex", width: 400, height: 300 } });
}

test("describes an engine element as an engine node with its key", async () => {
  const handle = await mounted((h) => h("div", { "data-perch-engine": "stub", "data-perch-key": "doc-1", className: "min-h-0 flex-1" }, h("span", null, "not drawn")));
  try {
    await settle();
    const node = find(handle.description.root, "engine");
    assert.ok(node, "an engine node");
    assert.equal(node.engine, "stub");
    assert.equal(node.key, "doc-1");
    assert.equal(node.children, undefined, "its source children are not drawn");
    assert.equal(node.style.flex_grow, 1, "laid out as the element's box");
  } finally { handle.unmount?.(); }
});

test("draws an engine node through files.engine inside a styled box", async () => {
  const handle = await mounted((h) => h("div", { "data-perch-engine": "stub", "data-perch-key": "doc-2", className: "flex-1" }));
  try {
    await settle();
    const asked = [];
    const files = { icon: () => ({}), engine: (engine, key) => { asked.push([engine, key]); return { engineElement: key }; } };
    describeToGpui(handle.description, kit(), handle, files, 2);
    assert.deepEqual(asked, [["stub", "doc-2"]]);
  } finally { handle.unmount?.(); }
});

test("an engine slot without a host draws an empty box", async () => {
  const handle = await mounted((h) => h("div", { "data-perch-engine": "stub", "data-perch-key": "doc-3" }));
  try {
    await settle();
    assert.doesNotThrow(() => describeToGpui(handle.description, kit(), handle, { icon: () => ({}) }, 2));
  } finally { handle.unmount?.(); }
});

test("an engine slot's height is not guessed from its (absent) children", async () => {
  const handle = await mounted((h) => h("div", { "data-perch-engine": "stub", "data-perch-key": "doc-4", className: "flex-1" }));
  try {
    await settle();
    const { snapColumns } = await import("../gpui.mjs");
    const node = find(handle.description.root, "engine");
    const snapped = snapColumns([handle.description.root], 2);
    assert.notEqual(snapped.get(node)?.h, 0, "no zero height from an empty content");
  } finally { handle.unmount?.(); }
});
