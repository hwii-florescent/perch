//! The DOM shim's own copies of a subtree: `outerHTML` (and `copyMarkup`) write them, `dangerouslySetInnerHTML` takes
//! them back as the same nodes, and anything else is not drawn; and direct `element.style` writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";

const settle = () => new Promise((r) => setTimeout(r, 20));

test("a copied subtree is drawn again from the shim's markup, and other HTML is not", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h, useState } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  let setHtml;
  let copied;
  function Probe() {
    const [html, set] = useState(null);
    setHtml = set;
    return h("div", null,
      h("span", { id: "x", "data-testid": "source", "data-tab-entry": "a", className: "flex gap-2", style: { left: 4 }, onClick: () => {} },
        h("button", { type: "button", title: "Tab A", "aria-label": "A" }, "Tab ", h("b", null, "A"))),
      html !== null && h("div", { "data-testid": "ghost", dangerouslySetInnerHTML: { __html: html } }));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 100, height: 100 } });
  try {
    const document = handle.globals.document;
    const source = document.querySelector('[data-testid="source"]');
    copied = source.copyMarkup(["data-testid", "data-tab-entry", "id", "style"]);
    assert.ok(source.outerHTML.includes('"data-testid":"source"'), "outerHTML keeps every attribute");
    setHtml(copied);
    await settle();
    const ghost = document.querySelector('[data-testid="ghost"]');
    const span = ghost.children[0];
    assert.equal(span.tagName, "span");
    assert.equal(span.className, "flex gap-2");
    assert.equal(span.getAttribute("id"), null);
    assert.equal(span.props.style, undefined, "no inline style");
    assert.equal(span.props["data-tab-entry"], undefined);
    assert.equal(typeof span.props.onClick, "undefined", "no handlers");
    assert.equal(span.textContent, "Tab A");
    assert.equal(span.querySelector("button").getAttribute("title"), "Tab A");
    assert.equal(document.querySelectorAll('[data-testid="source"]').length, 1, "one real tab");
    // A new copy replaces the old; HTML the shim did not write is not drawn.
    setHtml("<b>raw</b>");
    await settle();
    assert.equal(ghost.childNodes.length, 0);
    setHtml(`${copied.slice(0, 20)}{broken`);
    await settle();
    assert.equal(ghost.childNodes.length, 0);
  } finally {
    handle.unmount();
  }
});

test("a write to element.style is drawn on the next frame and a write back leaves nothing", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h, useState } = await import("react");
  let drawn = 0;
  const perch = { isMac: true, render() { drawn++; }, error: (e) => { throw e; } };
  let setGap;
  function Probe() {
    const [gap, set] = useState(4);
    setGap = set;
    return h("div", { style: { display: "flex" } },
      h("div", { "data-testid": "a", style: { width: 50, marginLeft: gap } }),
      h("div", { "data-testid": "b", style: { width: 50 } }));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 200, height: 20 } });
  const find = (id) => {
    const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
    return walk(handle.description.root);
  };
  try {
    const a = handle.globals.document.querySelector('[data-testid="a"]');
    assert.equal(a.style.marginLeft, "4px", "a read is the props' style");
    const before = drawn;
    a.style.transform = "translateX(30px)";
    a.style.setProperty("z-index", "30");
    assert.equal(a.style.transform, "translateX(30px)");
    await settle();
    assert.equal(drawn, before + 1, "one frame for the writes");
    assert.deepEqual([find("a").style.position, find("a").style.left], ["relative", 30], "moved without moving b");
    assert.equal(find("b").style.left, undefined);
    a.style.transform = "";
    await settle();
    assert.equal(find("a").style.left, undefined, "no stray transform");
    // The source setting a property again replaces a write to it.
    a.style.marginLeft = "9px";
    await settle();
    assert.equal(find("a").style.ml, 9);
    setGap(6);
    await settle();
    assert.equal(find("a").style.ml, 6);
    assert.equal(a.style.marginLeft, "6px");
  } finally {
    handle.unmount();
  }
});

test("a box comes from the last frame's layout, and an effect that measures waits for a fresh one", async () => {
  const { runtime } = await loadSidebar();
  const { React } = runtime;
  const h = React.createElement;
  const boxes = new Map();
  const forgotten = [];
  const perch = { isMac: true, render() {}, error: (e) => { throw e; }, bounds: (key) => boxes.get(key) ?? null, forgetBounds: (p) => forgotten.push(p) };
  const seen = [];
  function Probe() {
    const ref = React.useRef(null);
    const [width, setWidth] = React.useState(0);
    React.useLayoutEffect(() => {
      const box = ref.current.getBoundingClientRect();
      seen.push(box.width);
      if (box.width !== width) setWidth(box.width);
    }, [width]);
    return h("div", { ref, "data-testid": "m", style: { width: 40 } }, String(width));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 100, height: 20 } });
  const find = (id) => {
    const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
    return walk(handle.description.root);
  };
  try {
    assert.deepEqual(seen, [], "the effect waits for the element's first layout");
    await settle();
    const key = find("m").measure;
    assert.match(key, /^m[a-z0-9]+:n\d+$/, "the element is measured from now on");
    boxes.set(key, { x: 5, y: 6, width: 40, height: 10 });
    // A frame lays the tree out; then the effect runs, measures and moves the state.
    assert.equal(handle.drawing(), true);
    handle.retry();
    assert.deepEqual(seen, [40]);
    await settle();
    assert.deepEqual(seen, [40], "after its commit the box is stale again: the effect waits");
    handle.drawing();
    handle.retry();
    assert.deepEqual(seen, [40, 40], "settled: no further move");
    assert.equal(handle.drawing(), false, "nothing waits");
    // Outside an effect a read answers at once from the last frame; the measurement properties follow it.
    const element = handle.globals.document.querySelector('[data-testid="m"]');
    assert.equal(element.getBoundingClientRect().x, 5);
    assert.equal(element.offsetWidth, 40);
  } finally {
    handle.unmount();
  }
  // An element that is never laid out holds an effect off for three frames, then the effect runs with a zero box.
  const runs = [];
  function Never() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => { runs.push(ref.current.getBoundingClientRect().width); }, []);
    return h("div", { ref });
  }
  const other = runtime.mount(perch, Never, { container: { width: 10, height: 10 } });
  let frames = 0;
  while (other.drawing() && frames < 10) { other.retry(); frames++; }
  other.unmount();
  assert.deepEqual([runs, frames], [[0], 3]);
  assert.equal(forgotten.length, 2, "a tree's boxes are let go when it unmounts");
});

test("a form control's bare system-ui and the app's system stack are asked for under different names", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const APP = "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif";
  function Probe() {
    return h("div", { style: { fontFamily: "Times" } },
      h("button", { type: "button", "data-testid": "control" }, "Delete"),
      h("span", { "data-testid": "stack", style: { fontFamily: APP } }, "Title"),
      h("span", { "data-testid": "bare", style: { fontFamily: "system-ui" } }, "Bare"),
      h("span", { "data-testid": "mono", style: { fontFamily: "ui-monospace, Menlo, monospace" } }, "x"));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 200, height: 100 } });
  try {
    await settle();
    const family = (id) => {
      const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
      return walk(handle.description.root)?.style?.font_family;
    };
    assert.equal(family("control"), ".AppleSystemUIFont", "a button's own face, WebKit's -webkit-small-control");
    assert.equal(family("bare"), ".AppleSystemUIFont");
    assert.equal(family("stack"), ".SystemUIFont");
    assert.equal(family("mono"), "Menlo");
  } finally {
    handle.unmount();
  }
});

test("a disabled control gets no click, as in a browser, and an enabled one does", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const clicks = [];
  function Probe() {
    return h("div", null,
      h("button", { type: "button", "data-testid": "off", disabled: true, onClick: () => clicks.push("off") }, h("span", { "data-testid": "inner" }, "Off")),
      h("button", { type: "button", "data-testid": "on", onClick: () => clicks.push("on") }, "On"));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 100, height: 40 } });
  try {
    const document = handle.globals.document;
    const by = (id) => document.querySelector(`[data-testid="${id}"]`);
    handle.click(by("off").id);
    handle.click(by("inner").id);
    handle.click(by("on").id);
    assert.deepEqual(clicks, ["on"]);
  } finally {
    handle.unmount();
  }
});

test("a content-sized box moved by a percentage of itself is moved by its laid-out size", async () => {
  const { runtime } = await loadSidebar();
  const { React } = runtime;
  const h = React.createElement;
  const boxes = new Map();
  const perch = { isMac: true, render() {}, error: (e) => { throw e; }, bounds: (key) => boxes.get(key) ?? null, forgetBounds() {} };
  const centred = { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  const Probe = () => h("div", { style: { position: "relative", width: 200, height: 100 } }, h("div", { "data-testid": "c", style: centred }, "centred"));
  const handle = runtime.mount(perch, Probe, { container: { width: 200, height: 100 } });
  const find = () => {
    const walk = (n) => (n.meta?.attrs?.["data-testid"] === "c" ? n : (n.children ?? []).map(walk).find(Boolean));
    return walk(handle.description.root);
  };
  try {
    await settle();
    assert.equal(find().style.ml, undefined, "no box yet: not moved");
    assert.equal(handle.drawing(), true, "described again after the frame");
    boxes.set(find().measure, { x: 100, y: 50, width: 60, height: 20 });
    handle.retry();
    assert.deepEqual([find().style.ml, find().style.mt], [-30, -10]);
    // The same size the next frame: settled, nothing waits.
    handle.drawing();
    handle.retry();
    assert.deepEqual([find().style.ml, find().style.mt], [-30, -10]);
    assert.equal(handle.drawing(), false);
  } finally {
    handle.unmount();
  }
});
