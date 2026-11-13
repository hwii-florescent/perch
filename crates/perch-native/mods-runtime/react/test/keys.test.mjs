//! Keys while a screen has the keyboard: they reach the focused element as the DOM's `keydown`, and a text field the
//! source does not stop edits itself as a browser's would, so a controlled field's `onChange` sees each character.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";

test("typing reaches a focused field: characters, Backspace, and keys the source prevents", async () => {
  const { runtime } = await loadSidebar();
  // The screen's own React (the mod engine's), which the support module's hooks resolve after it loads.
  const { createElement: h, useState } = await import("react");
  const seen = [];
  function Field() {
    const [value, setValue] = useState("");
    seen.push(value);
    return h("input", {
      autoFocus: true,
      value,
      onChange: (e) => setValue(e.target.value),
      onKeyDown: (e) => { if (e.key === "Enter") e.preventDefault(); },
    });
  }
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const handle = runtime.mount(perch, Field, { container: { width: 200, height: 40 } });
  try {
    await new Promise((r) => setTimeout(r, 0));
    for (const key of ["a", "b", "c"]) assert.equal(handle.key({ key }), true, `${key} edits the field`);
    assert.equal(handle.key({ key: "Backspace" }), true);
    assert.equal(handle.key({ key: "Enter" }), true, "the source took Enter");
    assert.equal(handle.key({ key: "p", metaKey: true }), false, "a command is not typed");
    assert.equal(handle.key({ key: "ArrowLeft" }), false, "a key that types nothing is left to the window");
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(seen.at(-1), "ab", "the field holds what was typed");
  } finally {
    handle.unmount();
  }
});

test("a click ticks a check box, and the source sees it in onChange", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h, useState } = await import("react");
  const seen = [];
  function Box() {
    const [on, setOn] = useState(false);
    seen.push(on);
    return h("input", { type: "checkbox", id: "box", checked: on, onChange: (e) => setOn(e.target.checked) });
  }
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const handle = runtime.mount(perch, Box, { container: { width: 200, height: 40 } });
  try {
    const find = (n) => (n.kind === "input" ? n : (n.children ?? []).map(find).find(Boolean));
    const id = find(handle.description.root).id;
    handle.toggle(id);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(seen.at(-1), true, "ticked");
    handle.toggle(id);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(seen.at(-1), false, "and off again");
    assert.equal(find(handle.description.root).checked, false);
  } finally {
    handle.unmount();
  }
});
