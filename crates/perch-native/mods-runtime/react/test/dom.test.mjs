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

test("a put-off effect runs again from its top: what it does before measuring is repeated, after it once", async () => {
  const { runtime } = await loadSidebar();
  const { React } = runtime;
  const h = React.createElement;
  const perch = { isMac: true, render() {}, error: (e) => { throw e; }, bounds: () => null, forgetBounds() {} };
  const before = [];
  const after = [];
  function Probe() {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
      before.push("acted");
      ref.current.getBoundingClientRect();
      after.push("acted");
    }, []);
    return h("div", { ref });
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 10, height: 10 } });
  while (handle.drawing()) handle.retry();
  handle.unmount();
  assert.deepEqual([before.length, after.length], [4, 1], "three put-off runs, then the one that finished");
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
      h("span", { "data-testid": "mono", style: { fontFamily: "ui-monospace, Menlo, monospace" } }, "x"),
      h("span", { "data-testid": "menlo", style: { fontFamily: "Menlo, monospace" } }, "x"));
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
    assert.equal(family("mono"), ".AppleSystemUIFontMonospaced", "the app's stack is the monospaced system face (SF Mono)");
    assert.equal(family("menlo"), "Menlo", "a stack that leads with Menlo is Menlo");
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

test("letter spacing: room after a run; a negative one takes it back, or where the element clips, draws the run smaller", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  function Probe() {
    return h("div", null,
      h("span", { "data-testid": "wide", style: { letterSpacing: "1px" } }, "Quickchat"),
      h("span", { "data-testid": "tight", style: { letterSpacing: "-0.5px" } }, "Quickchat"),
      // The start card's heading: tracked tighter inside a box that clips.
      h("h1", { "data-testid": "clipped", style: { letterSpacing: "-0.5px", fontSize: 25, overflow: "hidden", whiteSpace: "nowrap" } }, "Quickchat"));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 300, height: 100 } });
  try {
    await settle();
    const node = (id) => {
      const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
      return walk(handle.description.root);
    };
    const pads = (n) => [n.style?.pr, ...(n.children ?? []).flatMap(pads)].filter((v) => v !== undefined);
    assert.deepEqual(pads(node("wide")), [9], "1px after each of 9 letters");
    assert.deepEqual(pads(node("tight")), [-4.5], "the box is the tracked width");
    const clipped = node("clipped");
    assert.deepEqual(pads(clipped), [], "no glyph is pushed past the clip");
    const run = clipped.children[0];
    assert.ok(run.style.text_size < 25 && run.style.text_size > 24, `drawn a little smaller: ${run.style.text_size}`);
    assert.match(run.style.line_height, /^[\d.]+px$/, "on the heading's line height");
  } finally {
    handle.unmount();
  }
});

test("a switch's knob (its ::before) is drawn inside its track, moved across when it is checked", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  // `components/ui/switch.tsx`'s classes.
  const SWITCH = "relative h-[1.25rem] w-[2.25rem] shrink-0 cursor-pointer appearance-none rounded-full bg-overlay-0 [transition:background_0.12s_ease] before:absolute before:top-[0.15rem] before:left-[0.15rem] before:h-[0.95rem] before:w-[0.95rem] before:rounded-full before:bg-fg before:content-[''] before:[transition:transform_0.12s_ease] checked:bg-accent checked:before:translate-x-[1rem] checked:before:bg-panel-bg focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px]";
  function Probe() {
    return h("div", null,
      h("input", { type: "checkbox", role: "switch", "data-testid": "off", checked: false, onChange() {}, className: SWITCH }),
      h("input", { type: "checkbox", role: "switch", "data-testid": "on", checked: true, onChange() {}, className: SWITCH }));
  }
  const handle = runtime.mount(perch, Probe, { container: { width: 300, height: 100 } });
  try {
    await settle();
    const node = (id) => {
      const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
      return walk(handle.description.root);
    };
    for (const id of ["off", "on"]) {
      const knob = node(id).children?.[0];
      assert.ok(knob, `${id}: the knob is drawn`);
      assert.equal(knob.style.position, "absolute");
      assert.ok(Math.abs(knob.style.w - 15.2) < 0.01 && Math.abs(knob.style.h - 15.2) < 0.01, `${id}: 0.95rem square: ${JSON.stringify(knob.style)}`);
      assert.ok(knob.style.rounded > 0 || knob.style.rounded === "full" || knob.style.rounded_full, `${id}: round: ${JSON.stringify(knob.style)}`);
    }
    const left = (id) => (node(id).children[0].style.left ?? 0) + (node(id).children[0].style.ml ?? 0);
    assert.ok(Math.abs(left("on") - left("off") - 16) < 0.01, `checked moves it 1rem across: ${left("on") - left("off")}`);
    const fill = (id) => JSON.stringify([node(id).children[0].style.bg, node(id).children[0].tokens]);
    assert.notEqual(fill("on"), fill("off"), `its colour follows the state: ${fill("on")}`);
    assert.ok(node("off").children[0].style.bg !== undefined || Object.keys(node("off").children[0].tokens).length, "it is filled");
  } finally {
    handle.unmount();
  }
});

test("a plain check box shows it is ticked: the accent fill and a mark, none when it is not", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const Probe = () => h("div", null,
    h("input", { type: "checkbox", "data-testid": "off", checked: false, onChange() {} }),
    h("input", { type: "checkbox", "data-testid": "on", checked: true, onChange() {} }));
  const handle = runtime.mount(perch, Probe, { container: { width: 300, height: 100 } });
  try {
    await settle();
    const node = (id) => {
      const walk = (n) => (n.meta?.attrs?.["data-testid"] === id ? n : (n.children ?? []).map(walk).find(Boolean));
      return walk(handle.description.root);
    };
    assert.equal(node("off").children?.length ?? 0, 0, "an unticked box has no mark");
    assert.equal(node("on").children?.[0]?.children?.[0]?.text, "\u2713", "a ticked box draws a check mark");
    assert.notEqual(JSON.stringify([node("on").style.bg, node("on").tokens]), JSON.stringify([node("off").style.bg, node("off").tokens]), "and fills with the accent");
  } finally {
    handle.unmount();
  }
});

test("rows styled alike compute their style once, and a row that differs gets its own", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const row = (id, extra = {}) => h("div", { key: id, "data-testid": id, className: "flex px-2 text-sm", ...extra }, id);
  const Probe = () => h("div", null, row("a"), row("b"), row("red", { style: { color: "rgb(255, 0, 0)" } }), row("bold", { className: "flex px-2 text-sm font-bold" }));
  const handle = runtime.mount(perch, Probe, { container: { width: 200, height: 100 } });
  try {
    const document = handle.globals.document;
    const style = (id) => document.computed(document.querySelector(`[data-testid="${id}"]`));
    assert.equal(style("a"), style("b"), "one computed style for two rows alike");
    assert.notEqual(style("red"), style("a"));
    assert.deepEqual(style("red").color.rgba, [255, 0, 0, 1]);
    assert.notDeepEqual(style("a").color.rgba, [255, 0, 0, 1]);
    assert.equal(style("bold")["font-weight"], 700);
    assert.notEqual(style("a")["font-weight"], 700);
  } finally {
    handle.unmount();
  }
});

test("a re-sorted list keeps the descriptions of rows that did not change, and equals a fresh description", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const row = (item) => h("div", { key: item.id, "data-testid": item.id, className: "group/row flex items-center px-2 text-sm hover:bg-black/5" },
    h("span", { className: "truncate" }, item.title),
    h("button", { type: "button", className: "opacity-0 group-hover/row:opacity-100 px-1", onClick: () => {} }, "…"));
  const first = ["a", "b", "c", "d", "e"].map((id) => ({ id, title: `Row ${id}` }));
  const List = ({ items }) => h("div", { className: "flex flex-col space-y-0.5" }, items.map(row));
  // Host ids differ between mounts: name each by its first appearance, so two trees alike compare equal.
  const canonical = (description) => {
    const names = new Map();
    return JSON.stringify(description.root).replace(/n\d+/g, (id) => (names.has(id) ? names.get(id) : (names.set(id, `#${names.size}`), names.get(id))));
  };
  const fresh = (items) => {
    const other = runtime.mount(perch, List, { container: { width: 240, height: 200 }, props: { items } });
    try { return canonical(other.description); } finally { other.unmount(); }
  };
  const handle = runtime.mount(perch, List, { container: { width: 240, height: 200 }, props: { items: first } });
  try {
    const rows = () => Object.fromEntries(handle.description.root.children[0].children.map((n) => [n.meta.attrs["data-testid"], n]));
    const before = rows();
    // "e" moves to the top; "c" gets a new title.
    const next = [first[4], first[0], first[1], { id: "c", title: "Row c, renamed" }, first[3]];
    handle.update({ items: next });
    const after = rows();
    assert.equal(after.b, before.b, "a row that neither changed nor moved keeps its description");
    assert.notEqual(after.c, before.c, "a row whose text changed is described again");
    assert.equal(canonical(handle.description), fresh(next), "the kept description is the one a fresh mount describes");
  } finally {
    handle.unmount();
  }
});
