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
