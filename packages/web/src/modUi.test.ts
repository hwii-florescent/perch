// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { modUi, surfaceLayout } from "./modUi";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

it("checks a mod's layout content and keeps only what places and names things", () => {
  const node = surfaceLayout({
    type: "row", background: "url(http://x/y.png)", colors: { text: "#fff" }, float: { x: 0, y: 0, width: 9, height: 9 }, gap: 6,
    children: [
      { type: "block", content: "mod:my-mod", props: { mode: "side" }, size: { px: 240, weight: "x" }, theme: "nord" },
      { type: "block", content: "session:abc_1", id: "t" },
    ],
  });
  expect(node).toEqual({
    type: "row", gap: 6, size: { px: undefined, weight: undefined, min: undefined, max: undefined },
    children: [
      { type: "block", content: "mod:my-mod", props: { mode: "side" }, size: { px: 240, weight: undefined, min: undefined, max: undefined } },
      { type: "block", id: "t", content: "session:abc_1", size: { px: undefined, weight: undefined, min: undefined, max: undefined } },
    ],
  });
  for (const bad of [
    null, [], { type: "grid", children: [] }, { type: "row", children: [] },
    { type: "block", content: "terminal:../x" }, { type: "block", content: "session:" }, { type: "block", content: "mod:a b" },
    { type: "block", content: "https://example.com" }, { type: "block", content: "canvas", props: [] },
    { type: "block", content: "canvas", props: { big: "x".repeat(5000) } },
  ]) expect(() => surfaceLayout(bad), JSON.stringify(bad)?.slice(0, 60)).toThrow();
  let deep: object = { type: "block", content: "canvas" };
  for (let i = 0; i < 10; i++) deep = { type: "column", children: [deep] };
  expect(() => surfaceLayout(deep)).toThrow(/deeper/);
});

it("a surface gives focus back where it was when it closes, unless the person moved it", () => {
  const open = new Set<() => void>();
  const ui = modUi("m", open);
  const before = document.body.appendChild(document.createElement("button"));
  before.focus();
  const close = ui.overlay((el) => { const input = el.appendChild(document.createElement("input")); input.focus(); });
  expect(document.activeElement?.tagName).toBe("INPUT");
  close();
  expect(document.activeElement).toBe(before);
  expect(open.size).toBe(0);

  const elsewhere = document.body.appendChild(document.createElement("button"));
  before.focus();
  const again = ui.popup({ x: 0, y: 0 }, () => {});
  elsewhere.focus();
  again();
  expect(document.activeElement).toBe(elsewhere);
});

it("refuses invalid layout content before opening anything, and mounts valid content as a layout", async () => {
  const open = new Set<() => void>();
  const ui = modUi("m", open);
  expect(() => ui.overlay({ layout: { type: "block", content: "terminal:../../x" } })).toThrow(/block content/);
  expect(open.size).toBe(0);
  expect(document.querySelector("[data-testid=mod-api-overlay-m]")).toBeNull();

  const close = ui.window({ title: "w" }, { layout: { type: "block", content: "agent:focused" } });
  await vi.waitFor(() => expect(document.querySelector("[data-testid=mod-api-window-m] [data-testid=layout-content]")).not.toBeNull(), { timeout: 5000 });
  close();
  expect(document.querySelector("[data-testid=mod-api-window-m]")).toBeNull();
});
