//! The Markdown preview's renderer: the web's elements from `marked`'s tokens, raw HTML drawn as text, images as
//! text placeholders, and links drawn only for http(s) addresses, opening on a click.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";
import { markdownElements, previewSource, FILE_PREVIEW_MAX_CHARS } from "../markdown.mjs";

test("a Markdown file draws as the web's elements and loads nothing", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const opened = [];
  const text = [
    "# Title", "", "Some **bold**, *em* and `code` with [a link](https://perch.dev) and [a path](./docs/a.md).", "",
    "- [x] done", "- item", "", "1. one", "2. two", "", "> quoted", "", "```rust", "fn main() {}", "```", "",
    "| a | b |", "| :- | -: |", "| 1 | 2 |", "", "<script>alert(1)</script>", "", "![logo](logo.png)", "", "---",
  ].join("\n");
  const Preview = () => h("div", { "data-testid": "root" }, markdownElements(text, (url) => opened.push(url)));
  const perch = { isMac: true, render() {}, error: (e) => { throw e; } };
  const handle = runtime.mount(perch, Preview, { container: { width: 600, height: 800 } });
  try {
    const doc = handle.globals.document;
    const root = doc.querySelector('[data-testid="root"]');
    assert.deepEqual([...root.children].map((e) => e.tagName), ["h1", "p", "ul", "ol", "blockquote", "pre", "table", "p", "p", "hr"]);
    assert.equal(root.querySelector("strong").textContent, "bold");
    assert.equal(root.querySelector("pre > code").className, "language-rust");
    assert.equal(root.querySelector('input[type="checkbox"]').props.checked, true);
    assert.equal(root.querySelector("th").props.style.textAlign, "left");
    assert.equal(root.children[7].textContent, "<script>alert(1)</script>", "raw HTML is text");
    assert.equal(root.querySelector(".md-placeholder").textContent, "[image: logo] logo.png");
    const [web, local] = root.querySelectorAll("a");
    assert.equal(web.getAttribute("href"), "https://perch.dev");
    assert.equal(local.getAttribute("href"), null, "a path is not a link");
    assert.equal(local.getAttribute("title"), "./docs/a.md");
    handle.dispatch(web.id, "click", { button: 0 });
    assert.deepEqual(opened, ["https://perch.dev"]);
  } finally {
    handle.unmount();
  }
});

test("a long document is cut where the web cuts it", () => {
  const line = "x".repeat(99) + "\n";
  const { source, truncated } = previewSource(line.repeat(3000));
  assert.equal(truncated, true);
  assert.ok(source.length <= FILE_PREVIEW_MAX_CHARS && source.endsWith("x"));
  assert.deepEqual(previewSource("short"), { source: "short", truncated: false });
});

test("a long document lexed section by section draws what lexing it whole draws", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { repo } = await import("./support.mjs");
  const { markdownSections, markdownLexer } = await import("../markdown.mjs");
  // The tree as drawn: tags, props and text, without React's keys or the link handlers.
  const shape = (node) => {
    if (Array.isArray(node)) return node.map(shape).filter((n) => n != null && n !== "");
    if (node == null || typeof node !== "object") return node;
    const { children, onClick, ...props } = node.props ?? {};
    return [node.type === Symbol.for("react.fragment") ? "#" : node.type, props, shape(children)];
  };
  for (const name of ["docs/ARCHITECTURE.md", "docs/DECISIONS.md", "docs/TESTING.md", "docs/UI-UX-DIRECTION.md"]) {
    const text = fs.readFileSync(path.join(repo, name), "utf8");
    const sections = markdownSections(text);
    assert.equal(sections.join(""), text, name);
    assert.ok(sections.length > 3 && sections.every((s) => s.length < 12_000), `${name}: ${sections.map((s) => s.length)}`);
    const lexer = markdownLexer(() => {});
    for (const section of sections) lexer.add(section);
    assert.deepEqual(shape(lexer.elements()), shape(markdownElements(text, () => {})), name);
  }
});
