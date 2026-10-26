// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../browserNative", () => ({
  nativeBrowser: true,
  browserId: (key: string) => key,
  browserCall: vi.fn().mockResolvedValue(null),
  onPassthrough: () => () => {},
  passthroughActive: () => false,
}));
const { browserCall } = await import("../browserNative");
const { WorkspaceBrowser } = await import("./WorkspaceBrowser");
const { usePerchStore } = await import("../store");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  usePerchStore.setState({ settings: null });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function show(initialUrl: string) {
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl={initialUrl} />));
  await act(async () => vi.advanceTimersByTimeAsync(20));
  vi.mocked(browserCall).mockClear();
}

async function enter(value: string, isComposing = false) {
  const input = host.querySelector("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing })));
  await act(async () => vi.advanceTimersByTimeAsync(20));
  return input;
}

it.each(["", "https://example.org/"])("Enter navigates addresses and keywords from initial page %j", async (initial) => {
  await show(initial);
  const input = await enter("localhost:3000");
  expect(input.value).toBe("http://localhost:3000/");
  expect(browserCall).toHaveBeenCalledWith(initial ? "go" : "show", expect.objectContaining({ id: "test", url: input.value }));

  // After a page exists, the same Enter path navigates rather than attempting to create it again.
  await enter("hello");
  expect(browserCall).toHaveBeenCalledWith("go", { id: "test", url: "https://www.google.com/search?q=hello" });
  await enter("example.com");
  expect(browserCall).toHaveBeenCalledWith("go", { id: "test", url: "https://example.com/" });
});

it("creates a search page when the very first input is a keyword", async () => {
  await show("");
  await enter("hello world");
  expect(browserCall).toHaveBeenCalledWith("show", expect.objectContaining({ url: "https://www.google.com/search?q=hello+world" }));
  // A native URL query returning null before the first load commits keeps the submitted address.
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(host.querySelector("input")!.value).toBe("https://www.google.com/search?q=hello+world");
});

it("uses the current search setting without remounting an existing browser", async () => {
  await show("");
  act(() => usePerchStore.setState({ settings: { browserSearchEngine: "duckduckgo" } as never }));
  await enter("hello");
  expect(browserCall).toHaveBeenCalledWith("show", expect.objectContaining({ url: "https://duckduckgo.com/?q=hello" }));
  act(() => usePerchStore.setState({ settings: { browserSearchEngine: "brave" } as never }));
  await enter("hello again");
  expect(browserCall).toHaveBeenCalledWith("go", { id: "test", url: "https://search.brave.com/search?q=hello+again" });
});

it("does not navigate empty input, non-web schemes, or an IME composition Enter", async () => {
  await show("");
  for (const value of ["  ", "javascript:alert(1)", "file:///etc/passwd"]) await enter(value);
  await enter("hello", true);
  expect(browserCall).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Search or enter an address above");
});
