//! `FileAsset` on the native runtime: an image opens through `perch-media` and is released on unmount, the toolbar
//! drives its zoom as the web's does, PDF/audio/video show a card whose buttons open the workspace's real file, and a
//! remote workspace gets the web's card with no buttons and opens nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSidebar } from "./support.mjs";

const tick = () => new Promise((r) => setTimeout(r, 0));

function mediaDouble(answer) {
  const calls = [];
  return {
    calls,
    open: (key, file) => { calls.push(["open", key, file]); return answer; },
    release: (key) => calls.push(["release", key]),
    setZoom: (key, zoom) => calls.push(["setZoom", key, zoom]),
    fitScale: () => 0.5,
    quickLook: (path) => calls.push(["quickLook", path]),
    openDefault: (path) => calls.push(["openDefault", path]),
  };
}

async function mount(metadata, media, root = "/work/repo") {
  const { runtime } = await loadSidebar();
  const { createElement: h } = await import("react");
  const sdk = await import("@perch/sdk");
  const perch = {
    isMac: true, render() {}, error: (e) => { throw e; }, media,
    mediaFile: (workspaceId, path) => (workspaceId === "w" && path === metadata.path ? { root, extraction: null } : null),
    command: () => true,
  };
  globalThis.perch = perch;
  const handle = runtime.mount(perch, () => h(sdk.FileAsset, { workspaceId: "w", metadata }), { container: { width: 600, height: 400 } });
  const document = handle.globals.document;
  const text = () => document.querySelector('[data-testid="workspace-file-asset"]').textContent;
  const button = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent === label);
  return { handle, document, text, button };
}

test("an image opens through perch-media, zooms from Fit's scale and is released on unmount", async () => {
  const media = mediaDouble(Promise.resolve({ width: 64, height: 48 }));
  const { handle, document, text, button } = await mount({ path: "img/a.png", name: "a.png", mediaType: "image/png", size: 900 }, media);
  try {
    assert.deepEqual(media.calls[0].slice(2), [{ workspaceId: "w", path: "img/a.png", mediaType: "image/png", size: 900 }]);
    await tick(); await tick(); handle.flush();
    assert.match(text(), /64 × 48 · Fit/);
    const engine = document.querySelector('[data-perch-engine="image"]');
    assert.equal(engine.getAttribute("data-perch-key"), media.calls[0][1], "the engine node carries the opened key");
    handle.click(button("+").id);
    await tick(); handle.flush();
    assert.match(text(), /63%/, "one step in from Fit's 0.5");
    assert.deepEqual(media.calls.filter((c) => c[0] === "setZoom").at(-1).slice(2), [0.625]);
    handle.click(button("100%").id);
    await tick(); handle.flush();
    assert.match(text(), /100%/);
  } finally {
    handle.unmount();
  }
  assert.equal(media.calls.at(-1)[0], "release");
});

test("an image that fails to decode shows the web's fallback", async () => {
  const media = mediaDouble(Promise.reject(new Error("decode")));
  const { handle, text } = await mount({ path: "b.png", name: "b.png", mediaType: "image/png", size: 9 }, media);
  try {
    await tick(); await tick(); handle.flush();
    assert.match(text(), /Preview unavailable/);
  } finally {
    handle.unmount();
  }
});

test("a PDF shows a card whose buttons open the real file", async () => {
  const media = mediaDouble(null);
  const { handle, text, button } = await mount({ path: "docs/r.pdf", name: "r.pdf", mediaType: "application/pdf", size: 2048 }, media);
  try {
    assert.match(text(), /PDF document · 2 KB/);
    handle.click(button("Quick Look").id);
    handle.click(button("Open with Default App").id);
    assert.deepEqual(media.calls, [["quickLook", "/work/repo/docs/r.pdf"], ["openDefault", "/work/repo/docs/r.pdf"]]);
  } finally {
    handle.unmount();
  }
});

test("a remote workspace shows the remote card and opens nothing", async () => {
  const media = mediaDouble(null);
  const { handle, text, button } = await mount({ path: "v.mp4", name: "v.mp4", mediaType: "video/mp4", size: 1 }, media, null);
  try {
    assert.match(text(), /Remote media is not available yet/);
    assert.equal(button("Quick Look"), undefined);
    assert.deepEqual(media.calls, []);
  } finally {
    handle.unmount();
  }
});
