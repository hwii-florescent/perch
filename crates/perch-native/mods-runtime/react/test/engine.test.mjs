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

// ---- CodeEditor over a recording `perch.editor` ----------------------------------------------------------------

/** A `perch.editor` that records calls and lets a test send the editor's events. */
function recordingEditor() {
  const calls = [];
  const texts = new Map();
  const handlers = new Map();
  let selection = null;
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  const editor = {
    open: (key, options) => { calls.push(["open", key]); texts.set(key, options.value); return { restored: false }; },
    park: record("park"),
    setValue: (key, text, options) => { calls.push(["setValue", key, text, options]); texts.set(key, text); },
    setReadonly: record("setReadonly"), setWrap: record("setWrap"), focus: record("focus"), goTo: record("goTo"),
    value: (key) => texts.get(key) ?? "",
    selection: () => selection,
    canUndo: () => false, canRedo: () => false,
    watch: (key, handler) => { handlers.set(key, handler); return () => handlers.delete(key); },
  };
  return {
    editor, calls,
    count: (name) => calls.filter((c) => c[0] === name).length,
    type: (key, text) => { texts.set(key, text); handlers.get(key)?.([{ type: "change" }]); },
    send: (key, ...events) => handlers.get(key)?.(events),
    select: (value) => { selection = value; },
  };
}

async function mountEditor(rec, props) {
  const { runtime } = await loadSidebar();
  const perch = { isMac: true, render() {}, error: (e) => { throw e; }, editor: rec.editor };
  // `@perch/sdk` calls the host it is bound to (a screen binds its copy's).
  runtime.sdk.bindHost(perch);
  const handle = runtime.mount(perch, runtime.sdk.CodeEditor, { container: { display: "flex", width: 400, height: 300 }, props });
  await settle();
  return handle;
}
const base = { path: "a.ts", value: "x", readOnly: false, wrap: false, label: "Editing a.ts", docKey: "w|a.ts|0" };
const update = async (handle, props) => { handle.update(props); handle.flush?.(); await settle(); };

test("CodeEditor opens once and survives re-renders with the same docKey", async () => {
  const rec = recordingEditor();
  const handle = await mountEditor(rec, base);
  try {
    for (let i = 0; i < 10; i++) await update(handle, { ...base, label: `Editing a.ts ${i}` });
    assert.equal(rec.count("open"), 1);
    assert.equal(rec.count("setValue"), 0);
    assert.equal(find(handle.description.root, "engine")?.key, base.docKey);
  } finally { handle.unmount?.(); }
});

test("a new docKey parks the old editor and opens the new one; unmount parks", async () => {
  const rec = recordingEditor();
  const handle = await mountEditor(rec, base);
  await update(handle, { ...base, docKey: "w|a.ts|1" });
  assert.deepEqual(rec.calls.filter((c) => c[0] === "park" || c[0] === "open").map((c) => c.join(" ")),
    [`open ${base.docKey}`, `park ${base.docKey}`, "open w|a.ts|1"]);
  handle.unmount();
  await settle();
  assert.deepEqual(rec.calls.at(-1), ["park", "w|a.ts|1"]);
});

test("a store value the editor reported sets nothing; a different one goes in as external", async () => {
  const rec = recordingEditor();
  let seen = null;
  const handle = await mountEditor(rec, { ...base, onChange: (text) => { seen = text; } });
  try {
    rec.type(base.docKey, "xy");
    assert.equal(seen, "xy");
    await update(handle, { ...base, value: "xy" });
    assert.equal(rec.count("setValue"), 0, "the store's echo is not applied back");
    await update(handle, { ...base, value: "from disk" });
    assert.deepEqual(rec.calls.at(-1), ["setValue", base.docKey, "from disk", { external: true }]);
  } finally { handle.unmount?.(); }
});

test("save and caret reach the latest props", async () => {
  const rec = recordingEditor();
  const heard = [];
  const handle = await mountEditor(rec, { ...base, onSave: () => heard.push("old save") });
  try {
    await update(handle, { ...base, onSave: () => heard.push("save"), onCaret: (c) => heard.push(`${c.line}:${c.col}`) });
    rec.send(base.docKey, { type: "save" }, { type: "caret", line: 3, col: 7 });
    assert.deepEqual(heard, ["save", "3:7"]);
  } finally { handle.unmount?.(); }
});

test("readOnly and wrap toggles reach the editor", async () => {
  const rec = recordingEditor();
  const handle = await mountEditor(rec, base);
  try {
    await update(handle, { ...base, readOnly: true, wrap: true });
    assert.deepEqual(rec.calls.filter((c) => c[0] === "setReadonly").at(-1), ["setReadonly", base.docKey, true]);
    assert.deepEqual(rec.calls.filter((c) => c[0] === "setWrap").at(-1), ["setWrap", base.docKey, true]);
  } finally { handle.unmount?.(); }
});

test("askAgent passes the selection and its lines, or the whole file without one", async () => {
  const rec = recordingEditor();
  const asked = [];
  const ref = { current: null };
  const handle = await mountEditor(rec, { ...base, value: "a\nb\nc\n", onAskAgent: (...args) => asked.push(args), ref });
  try {
    ref.current.askAgent();
    rec.select({ text: "b", startLine: 2, endLine: 2 });
    ref.current.askAgent();
    assert.deepEqual(asked, [["a\nb\nc\n", 1, 3], ["b", 2, 2]]);
  } finally { handle.unmount?.(); }
});

test("a goto event shows the go-to-line bar, and Enter goes to line:col", async () => {
  const rec = recordingEditor();
  const handle = await mountEditor(rec, base);
  try {
    rec.send(base.docKey, { type: "goto" });
    await settle();
    const document = handle.globals.document;
    const input = document.querySelector("#perch-editor-goto");
    assert.ok(input, "the bar is shown");
    handle.focus(input.id);
    for (const key of ["1", "2", ":", "4"]) handle.key({ key });
    handle.key({ key: "Enter" });
    await settle();
    assert.deepEqual(rec.calls.find((c) => c[0] === "goTo"), ["goTo", base.docKey, 12, 4]);
    assert.equal(document.querySelector("#perch-editor-goto"), null, "and closes");
  } finally { handle.unmount?.(); }
});
