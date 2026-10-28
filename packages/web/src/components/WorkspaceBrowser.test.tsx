// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../browserNative", () => ({
  nativeBrowser: true,
  browserAddressDrafts: new Map(),
  BROWSER_COVERS: '[role="dialog"], [role="menu"], [role="listbox"]',
  browserHasFocus: vi.fn().mockReturnValue(false),
  noteBrowserFocus: vi.fn(),
  browserId: (key: string) => key,
  browserCall: vi.fn().mockResolvedValue(null),
  onPassthrough: () => () => {},
  passthroughActive: () => false,
}));
vi.mock("../browserHistory", () => ({ searchHistory: vi.fn().mockResolvedValue([]), searchSuggestions: vi.fn().mockResolvedValue([]), recordPage: vi.fn(), removePage: vi.fn() }));
const { browserCall, browserAddressDrafts, browserHasFocus, BROWSER_COVERS } = await import("../browserNative");
const { searchHistory, searchSuggestions, removePage } = await import("../browserHistory");
const { WorkspaceBrowser } = await import("./WorkspaceBrowser");
const { usePerchStore } = await import("../store");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  browserAddressDrafts.clear();
  vi.mocked(browserHasFocus).mockReturnValue(false);
  vi.mocked(browserCall).mockImplementation(async (_command, _args, current) => { current?.(); return null; });
  usePerchStore.setState({ settings: null, settingsOpen: false });
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
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl={initialUrl} active />));
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

function type(value: string) {
  const input = host.querySelector("input")!;
  act(() => {
    input.dispatchEvent(new FocusEvent("focus"));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}
const press = (input: HTMLInputElement, key: string) => act(() => { input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })); });

it("suggests history while typing, picks with the arrows, and Esc closes the list", async () => {
  vi.mocked(searchHistory).mockResolvedValue([{ url: "https://news.example.org/today", title: "Today's news" }]);
  await show("");
  const input = type("news");
  await act(async () => vi.advanceTimersByTimeAsync(20));
  const options = [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent);
  expect(options[0]).toContain("Search for");
  expect(options[1]).toContain("Today's news");
  press(input, "Escape");
  expect(host.querySelector('[role="listbox"]')).toBeNull();
  type("today");
  await act(async () => vi.advanceTimersByTimeAsync(20));
  press(input, "ArrowDown");
  press(input, "ArrowDown");
  press(input, "Enter");
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(input.value).toBe("https://news.example.org/today");
  expect(browserCall).toHaveBeenCalledWith("show", expect.objectContaining({ url: "https://news.example.org/today" }));
  expect(host.querySelector('[role="listbox"]')).toBeNull();
});

it("asks the engine for suggestions only when the setting is on, after a pause, and opens one as a search", async () => {
  vi.mocked(searchSuggestions).mockResolvedValue(["perch fish"]);
  await show("");
  const input = type("perch");
  await act(async () => vi.advanceTimersByTimeAsync(400));
  expect(searchSuggestions).not.toHaveBeenCalled();
  act(() => usePerchStore.setState({ settings: { browserSearchSuggestions: true } as never }));
  type("perc");
  type("perch");
  await act(async () => vi.advanceTimersByTimeAsync(400));
  // The burst of keys sent one request, for the final text.
  expect(searchSuggestions).toHaveBeenCalledTimes(1);
  expect(searchSuggestions).toHaveBeenCalledWith("perch");
  press(input, "ArrowDown");
  press(input, "ArrowDown");
  press(input, "Enter");
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(input.value).toBe("https://www.google.com/search?q=perch+fish");
});

it("removes a suggestion from history without navigating", async () => {
  vi.mocked(searchHistory).mockResolvedValue([{ url: "https://gone.example.org/", title: "Gone page" }]);
  await show("");
  type("gone");
  await act(async () => vi.advanceTimersByTimeAsync(20));
  const remove = host.querySelector('[aria-label^="Remove Gone page"]')!;
  act(() => { remove.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); });
  expect(removePage).toHaveBeenCalledWith("https://gone.example.org/");
  expect(host.querySelector('[aria-label^="Remove Gone page"]')).toBeNull();
  expect(browserCall).not.toHaveBeenCalled();
});

const focusCalls = () => vi.mocked(browserCall).mock.calls.filter(([command]) => command === "focus");
const frame = () => act(async () => { await vi.advanceTimersByTimeAsync(25); });

it("focuses only an activated pane, not a visible sibling or a restored background drawer", async () => {
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active={false} />));
  await frame();
  expect(focusCalls()).toHaveLength(0);
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active />));
  await frame();
  expect(focusCalls()).toHaveLength(1);
  // Geometry changes do not refocus the page.
  window.dispatchEvent(new Event("resize"));
  await frame();
  expect(focusCalls()).toHaveLength(1);
  await act(async () => root.render(<WorkspaceBrowser key="drawer" tabId="drawer" initialUrl="https://example.net/" />));
  await frame();
  expect(focusCalls()).toHaveLength(1);
});

it("rejects a queued focus after deselection or unmount", async () => {
  await show("https://example.org/");
  // Capture rather than execute the next request's execution-time guard.
  vi.mocked(browserCall).mockResolvedValue(null);
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active={false} />));
  await frame();
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active />));
  await frame();
  const current = focusCalls().at(-1)![2]!;
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active={false} />));
  expect(current()).toBe(false);
  await act(async () => root.render(null));
  expect(current()).toBe(false);
});

it("rejects a queued focus if Settings opens or the host becomes hidden", async () => {
  await show("https://example.org/");
  vi.mocked(browserCall).mockResolvedValue(null);
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active={false} />));
  await frame();
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active />));
  await frame();
  const current = focusCalls().at(-1)![2]!;
  act(() => usePerchStore.setState({ settingsOpen: true }));
  expect(current()).toBe(false);
  act(() => usePerchStore.setState({ settingsOpen: false }));
  vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 0, 0));
  expect(current()).toBe(false);
});

it("hides for a dialog and restores only the page that owned native focus", async () => {
  await show("https://example.org/");
  vi.mocked(browserHasFocus).mockReturnValue(true);
  const dialog = document.createElement("div");
  dialog.role = "dialog";
  document.body.append(dialog);
  await frame();
  expect(browserCall).toHaveBeenCalledWith("hide", { id: "test" });
  dialog.remove();
  await frame();
  expect(focusCalls()).toHaveLength(1);

  vi.mocked(browserCall).mockClear();
  vi.mocked(browserHasFocus).mockReturnValue(false);
  document.body.append(dialog);
  await frame();
  dialog.remove();
  await frame();
  expect(focusCalls()).toHaveLength(0);
});

it("returns from Settings without tearing down and refocusing on every geometry update", async () => {
  await show("https://example.org/");
  vi.mocked(browserHasFocus).mockReturnValue(true);
  act(() => usePerchStore.setState({ settingsOpen: true }));
  await frame();
  expect(browserCall).toHaveBeenCalledWith("hide", { id: "test" });
  act(() => usePerchStore.setState({ settingsOpen: false }));
  await frame();
  expect(focusCalls()).toHaveLength(1);
  expect(BROWSER_COVERS).toContain('[role="dialog"]');
});

it("keeps the address draft and exact selection across a tab unmount/remount", async () => {
  await show("https://example.org/");
  const input = type("unfinished address");
  act(() => { input.focus(); input.setSelectionRange(3, 8, "backward"); });
  await act(async () => root.render(null));
  expect(browserAddressDrafts.get("test")).toMatchObject({ value: "unfinished address", start: 3, end: 8, direction: "backward" });
  await act(async () => root.render(<WorkspaceBrowser tabId="test" initialUrl="https://example.org/" active />));
  await frame();
  const restored = host.querySelector("input")!;
  expect(document.activeElement).toBe(restored);
  expect(restored.value).toBe("unfinished address");
  expect([restored.selectionStart, restored.selectionEnd, restored.selectionDirection]).toEqual([3, 8, "backward"]);
});

it("submitting an address hands focus to the page, not the address bar", async () => {
  await show("https://example.org/");
  const input = type("example.net");
  act(() => input.focus());
  press(input, "Enter");
  await frame();
  expect(document.activeElement).not.toBe(input);
  expect(focusCalls()).toHaveLength(1);
});
