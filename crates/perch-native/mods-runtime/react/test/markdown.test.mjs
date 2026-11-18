//! The Markdown preview: the web's box with the window's Markdown engine in it, handed the draft as the web cuts it,
//! and let go when the preview goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";
import { previewSource, FILE_PREVIEW_MAX_CHARS } from "../markdown.mjs";

test("the preview places the Markdown engine with the draft and lets it go", async () => {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const shown = [];
  const released = [];
  const perch = {
    isMac: true, render() {}, error: (e) => { throw e; },
    markdown: { show: (key, text) => shown.push([key, text]), release: (key) => released.push(key) },
  };
  runtime.sdk.bindHost(perch);
  const Preview = () => h(runtime.sdk.MarkdownPreview, { path: "docs/a.md", content: "# Title\n\nSome `code`." });
  const handle = runtime.mount(perch, Preview, { container: { width: 600, height: 800 } });
  try {
    const doc = handle.globals.document;
    const region = doc.querySelector('[data-testid="workspace-markdown-preview"]');
    assert.equal(region.getAttribute("aria-label"), "Rendered preview of docs/a.md");
    const slot = region.querySelector('.file-markdown > [data-perch-engine="markdown"]');
    const key = slot.getAttribute("data-perch-key");
    assert.deepEqual(shown, [[key, "# Title\n\nSome `code`."]]);
    assert.equal(region.querySelector('[data-testid="workspace-markdown-truncated"]'), null);
  } finally {
    handle.unmount();
  }
  assert.deepEqual(released, [shown[0][0]]);
});

test("a long document is cut where the web cuts it", () => {
  const line = "x".repeat(99) + "\n";
  const { source, truncated } = previewSource(line.repeat(3000));
  assert.equal(truncated, true);
  assert.ok(source.length <= FILE_PREVIEW_MAX_CHARS && source.endsWith("x"));
  assert.deepEqual(previewSource("short"), { source: "short", truncated: false });
});
