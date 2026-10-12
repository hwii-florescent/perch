// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = { invoke: vi.fn() };
});
afterEach(() => { delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__; });

it("drag passthrough holds nest, release is idempotent, and listeners hear each change", async () => {
  const { acquirePassthrough, onPassthrough, passthroughActive } = await import("./browserNative");
  const heard = vi.fn();
  onPassthrough(heard);
  expect(passthroughActive()).toBe(false);
  const tabDrag = acquirePassthrough();
  const divider = acquirePassthrough();
  expect(passthroughActive()).toBe(true);
  tabDrag();
  tabDrag(); // a second release of the same hold changes nothing
  expect(passthroughActive()).toBe(true);
  divider();
  expect(passthroughActive()).toBe(false);
  expect(heard).toHaveBeenCalledTimes(4);
});

it("is a no-op without the desktop app (a web page's iframe is covered by the drag layer)", async () => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  const { acquirePassthrough, passthroughActive } = await import("./browserNative");
  acquirePassthrough();
  expect(passthroughActive()).toBe(false);
});
