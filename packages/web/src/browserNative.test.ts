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

it("drops a deselected focus request behind a slow show, without dropping its cleanup", async () => {
  const { browserCall } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  let finish!: () => void;
  invoke.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(null);
  const showing = browserCall("show", { id: "old" });
  await Promise.resolve();
  let selected = true;
  const focusing = browserCall("focus", { id: "old" }, () => selected);
  const hiding = browserCall("hide", { id: "old" });
  selected = false;
  finish();
  await Promise.all([showing, focusing, hiding]);
  expect(invoke.mock.calls.map(([command]) => command)).toEqual(["browser_show", "browser_hide"]);
});

it("captures the outgoing native owner before committing the next focus target", async () => {
  const { browserCall, noteBrowserFocus } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  invoke.mockResolvedValue(null);
  noteBrowserFocus("old");
  await browserCall("focus", { id: "next" }, () => { noteBrowserFocus("next"); return true; });
  expect(invoke).toHaveBeenCalledWith("browser_focus", { id: "next", from: "old" });
});

it("returns from covers to the invoking page, but main-content focus cancels that return", async () => {
  const { browserCall, browserHasFocus, focusMainResponder, noteBrowserFocus } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  invoke.mockResolvedValue(null);
  const onFocus = (event: FocusEvent) => focusMainResponder(event.target);
  document.addEventListener("focusin", onFocus);
  const dialog = document.createElement("div");
  dialog.role = "dialog";
  const search = document.createElement("input");
  dialog.append(search);
  const terminal = document.createElement("textarea");
  document.body.append(dialog, terminal);
  try {
    noteBrowserFocus("page");
    search.focus();
    await browserCall("url", { id: "barrier" });
    expect(browserHasFocus("page")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("browser_focus", { id: null, from: "page" });
    terminal.focus();
    await browserCall("url", { id: "barrier" });
    expect(browserHasFocus("page")).toBe(false);
  } finally {
    document.removeEventListener("focusin", onFocus);
    dialog.remove();
    terminal.remove();
  }
});

it.each([true, false])("hands off an already-focused main input, with native owner=%s, without duplicate IPC", async (nativeOwner) => {
  const { browserCall, focusMainResponder, noteBrowserFocus } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  invoke.mockResolvedValue(null);
  const input = document.createElement("textarea");
  document.body.append(input);
  input.focus();
  const onFocus = vi.fn((event: FocusEvent) => focusMainResponder(event.target));
  document.addEventListener("focusin", onFocus);
  try {
    if (nativeOwner) noteBrowserFocus("page");
    input.focus(); // Main DOM focus survived even though its native responder did not.
    expect(onFocus).not.toHaveBeenCalled();
    focusMainResponder(input);
    focusMainResponder(input); // Listener + explicit activation must coalesce.
    await browserCall("url", { id: "barrier" });
    expect(invoke.mock.calls.filter(([command]) => command === "browser_focus")).toEqual(
      nativeOwner ? [["browser_focus", { id: null, from: "page" }]] : [],
    );
  } finally {
    document.removeEventListener("focusin", onFocus);
    input.remove();
  }
});

it("keeps the outgoing owner through rapid main-input changes and failed DOM focus", async () => {
  const { browserCall, browserHasFocus, focusMainResponder, noteBrowserFocus } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  invoke.mockResolvedValue(null);
  const first = document.createElement("textarea"), second = document.createElement("textarea");
  document.body.append(first, second);
  try {
    noteBrowserFocus("page");
    focusMainResponder(first); // Not focused: must not forget the outgoing native owner.
    expect(browserHasFocus("page")).toBe(true);
    first.focus();
    focusMainResponder(first);
    second.focus();
    focusMainResponder(second);
    await browserCall("url", { id: "barrier" });
    expect(invoke.mock.calls.filter(([command]) => command === "browser_focus")).toEqual([["browser_focus", { id: null, from: "page" }]]);
  } finally { first.remove(); second.remove(); }
});

it.each(["page", "other"])("rejects a queued main handoff after newer native focus on %s", async (next) => {
  const { browserCall, focusMainResponder, noteBrowserFocus } = await import("./browserNative");
  const invoke = (window as unknown as { __TAURI_INTERNALS__: { invoke: ReturnType<typeof vi.fn> } }).__TAURI_INTERNALS__.invoke;
  invoke.mockResolvedValue(null);
  const input = document.createElement("textarea");
  document.body.append(input);
  try {
    noteBrowserFocus("page");
    input.focus();
    focusMainResponder(input);
    noteBrowserFocus(next);
    await browserCall("url", { id: "barrier" });
    expect(invoke.mock.calls.filter(([command]) => command === "browser_focus")).toEqual([]);
  } finally { input.remove(); }
});

it("closing forgets address drafts even when unmount saved one after the close was queued", async () => {
  const { browserCall, browserAddressDrafts } = await import("./browserNative");
  const closing = browserCall("close", { id: "page" });
  browserAddressDrafts.set("page", { value: "draft", start: 1, end: 3, direction: "forward" });
  await closing;
  expect(browserAddressDrafts.has("page")).toBe(false);
});
