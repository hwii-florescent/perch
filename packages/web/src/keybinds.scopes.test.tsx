// @vitest-environment jsdom
/** Mounted command ownership: changes must affect execution, not only Settings labels. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ grow: vi.fn(), shrink: vi.fn() }));
vi.mock("./browserNative", async (original) => ({ ...await original<typeof import("./browserNative")>(), nativeBrowser: false }));
vi.mock("./tiledPanes", () => ({ getPaneController: () => ({ growActivePane: mocks.grow, shrinkActivePane: mocks.shrink }), splitActiveTab: vi.fn() }));
const { useLeaderKey, terminalKeyHandler, shortcutLabel, shortcutsBoundTo } = await import("./keybinds");
const { usePerchStore } = await import("./store");
const { CodeEditor } = await import("./components/CodeEditor");
const { Navigator } = await import("./components/Navigator");
const { KeybindingsSection } = await import("./components/KeybindingsSection");
const { DirectoryBrowser } = await import("./components/DirectoryBrowser");
const { EditorView } = await import("@codemirror/view");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLElement.prototype.scrollIntoView = vi.fn();
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
let root: Root, host: HTMLDivElement;
const handlers = { openNavigator: vi.fn(), openKeybindHelp: vi.fn(), toggleDrawer: vi.fn() };
const save = vi.fn();
function Harness({ children }: { children?: React.ReactNode }) { useLeaderKey(handlers); return children; }
const settings = (keybindings: Record<string, string>) => ({ keybindings }) as never;
async function rebind(keybindings: Record<string, string>) { await act(async () => usePerchStore.setState({ settings: settings(keybindings) })); }
async function render(children?: React.ReactNode) { await act(async () => root.render(<Harness>{children}</Harness>)); }
function press(key: string, code: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init });
  act(() => target.dispatchEvent(event));
  return event;
}
const editor = () => host.querySelector<HTMLElement>(".cm-content")!;
const mountEditor = () => render(<CodeEditor value="one two\nthree" path="a.txt" docKey="scoped-test" readOnly={false} wrap={false} label="File" onChange={() => {}} onSave={save} onCaret={() => {}} />);
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  usePerchStore.setState({ settings: settings({}), settingsOpen: false, connected: false, sessions: [{ id: "one", title: "One", cwd: "/one", createdAt: 2, status: "idle" }, { id: "two", title: "Two", cwd: "/two", createdAt: 1, status: "idle" }] as never, sessionId: "one" });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("lists every command family in Settings, including leader and scoped editor commands", async () => {
  await render(<KeybindingsSection />);
  for (const id of ["leader.arm", "leader.navigator", "leader.resize", "resize.left", "editor.save", "editor.find", "navigator.next", "directory.use", "global.helpPlain"]) expect(host.querySelector(`[data-testid="keybinding-${id}"]`), id).not.toBeNull();
});
it("rebinds and disables the leader prefix without swallowing its freed terminal key", async () => {
  await render(); await rebind({ "leader.arm": "ctrl+alt+space" });
  expect(terminalKeyHandler(new KeyboardEvent("keydown", { key: " ", code: "Space", ctrlKey: true }))).toBe(true);
  press(" ", "Space", { ctrlKey: true }); press("g", "KeyG"); expect(handlers.openNavigator).not.toHaveBeenCalled();
  press(" ", "Space", { ctrlKey: true, altKey: true }); press("g", "KeyG"); expect(handlers.openNavigator).toHaveBeenCalledOnce();
  await rebind({ "leader.arm": "" }); press(" ", "Space", { ctrlKey: true }); press("g", "KeyG"); expect(handlers.openNavigator).toHaveBeenCalledOnce();
});
it("uses current leader and resize follow-up bindings, not a second letter map", async () => {
  await render(); await rebind({ "leader.navigator": "y", "leader.resize": "e", "resize.left": "a", "resize.down": "" });
  press(" ", "Space", { ctrlKey: true }); press("g", "KeyG"); expect(handlers.openNavigator).not.toHaveBeenCalled();
  press(" ", "Space", { ctrlKey: true }); press("y", "KeyY"); expect(handlers.openNavigator).toHaveBeenCalledOnce();
  press(" ", "Space", { ctrlKey: true }); press("e", "KeyE"); press("a", "KeyA"); expect(mocks.shrink).toHaveBeenCalledOnce();
  press("a", "KeyA", { repeat: true }); expect(mocks.shrink).toHaveBeenCalledTimes(2);
  press("Escape", "Escape"); press("a", "KeyA"); expect(mocks.shrink).toHaveBeenCalledTimes(2);
});
it("honors editor save overrides and disabling without rebuilding the mounted editor", async () => {
  await mountEditor(); const view = EditorView.findFromDOM(editor())!;
  await rebind({ "editor.save": "ctrl+alt+s" });
  press("s", "KeyS", { ctrlKey: true }, editor()); expect(save).not.toHaveBeenCalled();
  press("s", "KeyS", { ctrlKey: true, altKey: true }, editor()); expect(save).toHaveBeenCalledOnce();
  await rebind({ "editor.save": "" }); press("s", "KeyS", { ctrlKey: true, altKey: true }, editor()); expect(save).toHaveBeenCalledOnce();
  expect(EditorView.findFromDOM(editor())).toBe(view);
});
it("gives a rebound global app key sole ownership before CodeMirror save/select-all", async () => {
  await mountEditor(); await rebind({ "global.navigator": "ctrl+s", "editor.save": "" });
  press("s", "KeyS", { ctrlKey: true }, editor()); expect(save).not.toHaveBeenCalled(); expect(handlers.openNavigator).toHaveBeenCalledOnce();
  await rebind({ "global.navigator": "ctrl+a" });
  press("a", "KeyA", { ctrlKey: true }, editor()); expect(handlers.openNavigator).toHaveBeenCalledTimes(2);
  expect(EditorView.findFromDOM(editor())!.state.selection.main.empty).toBe(true);
});
it("updates editor find live while preserving typing, native dismissal and IME", async () => {
  await mountEditor(); await rebind({ "editor.find": "f6" });
  press("f", "KeyF", { ctrlKey: true }, editor()); expect(host.querySelector(".cm-search")).toBeNull();
  press("F6", "F6", { isComposing: true }, editor()); expect(host.querySelector(".cm-search")).toBeNull();
  press("F6", "F6", {}, editor()); expect(host.querySelector(".cm-search")).not.toBeNull();
  press("Escape", "Escape", {}, editor()); expect(host.querySelector(".cm-search")).toBeNull();
  await rebind({ "editor.find": "f7" }); press("F6", "F6", {}, editor()); expect(host.querySelector(".cm-search")).toBeNull();
  press("F7", "F7", {}, editor()); expect(host.querySelector(".cm-search")).not.toBeNull();
});
it("preserves contextual Navigator ownership and basic arrow navigation after rebinding", async () => {
  await render(<Navigator open onClose={() => {}} />);
  const input = document.querySelector<HTMLElement>('[data-testid="navigator-input"]')!;
  const selection = () => document.querySelector('[data-testid="navigator"] [data-selected="true"]')?.textContent;
  const first = selection(); await rebind({ "navigator.next": "ctrl+l", "navigator.nextAlt": "" });
  press("j", "KeyJ", { ctrlKey: true }, input); expect(selection()).toBe(first);
  press("l", "KeyL", { ctrlKey: true }, input); expect(selection()).not.toBe(first);
  press("ArrowUp", "ArrowUp", {}, input); expect(selection()).toBe(first);
});
it("keeps conflict domains separate and moves only commands that can really fire together", async () => {
  await render();
  expect(shortcutsBoundTo("ctrl+f", "editor.save", false).map((s) => s.id)).toEqual(["editor.find"]);
  expect(shortcutsBoundTo("h", "leader.navigator", false).map((s) => s.id)).toEqual(["leader.focus.left"]);
  expect(shortcutsBoundTo("ctrl+shift+p", "editor.save", false).map((s) => s.id)).toEqual(["global.navigator"]);
  await rebind({ "leader.arm": "ctrl+alt+space", "leader.navigator": "y" });
  expect(shortcutLabel("leader.navigator", false)).toBe("Ctrl+Alt+Space, Y");
  await rebind({ "leader.arm": "" });
  expect(shortcutLabel("leader.navigator", false)).toBeNull();
});
it("records plain follow-ups but never turns an ordinary global key into a typing trap", async () => {
  const update = vi.fn((patch) => usePerchStore.setState({ settings: { ...usePerchStore.getState().settings, ...patch } }));
  usePerchStore.setState({ updateSettings: update });
  await render(<KeybindingsSection />);
  act(() => host.querySelector<HTMLButtonElement>('[data-testid="keybinding-leader.navigator"]')!.click());
  press("a", "KeyA");
  expect(usePerchStore.getState().settings?.keybindings?.["leader.navigator"]).toBe("a");
  act(() => host.querySelector<HTMLButtonElement>('[data-testid="keybinding-global.navigator"]')!.click());
  press("a", "KeyA");
  expect(update).toHaveBeenCalledOnce();
  expect(handlers.openNavigator).not.toHaveBeenCalled();
  press("Escape", "Escape");
});
it("makes the help alias configurable without stealing typing from inputs or terminals", async () => {
  await render(); await rebind({ "global.helpPlain": "ctrl+alt+/" });
  press("?", "Slash", { shiftKey: true }); expect(handlers.openKeybindHelp).not.toHaveBeenCalled();
  press("/", "Slash", { ctrlKey: true, altKey: true }); expect(handlers.openKeybindHelp).toHaveBeenCalledOnce();
  const input = document.createElement("input"); host.append(input);
  expect(press("/", "Slash", { ctrlKey: true, altKey: true }, input).defaultPrevented).toBe(false);
  expect(handlers.openKeybindHelp).toHaveBeenCalledOnce();
  expect(terminalKeyHandler(new KeyboardEvent("keydown", { key: "?", code: "Slash", shiftKey: true }))).toBe(true);
});
it("rebinds folder confirmation in its owner, frees modified Enter, and preserves ordinary Enter navigation", async () => {
  const useFolder = vi.fn(), browse = vi.fn(async () => ({ path: "/project", parent: "/", entries: [{ name: "child", path: "/project/child", isDir: true }] }));
  usePerchStore.setState({ browseDirectory: browse as never });
  await render(<DirectoryBrowser hostId="local" onUseFolder={useFolder} />);
  const input = host.querySelector<HTMLInputElement>('[data-testid="dir-browser-filter"]')!;
  await rebind({ "directory.use": "ctrl+alt+u", "directory.useAlt": "" });
  press("Enter", "Enter", { ctrlKey: true }, input); expect(useFolder).not.toHaveBeenCalled(); expect(browse).toHaveBeenCalledOnce();
  press("u", "KeyU", { ctrlKey: true, altKey: true }, input); expect(useFolder).toHaveBeenCalledExactlyOnceWith("/project");
  expect(host.querySelector('[data-testid="dir-browser-use"]')?.getAttribute("title")).toContain("Ctrl+Alt+U");
  await rebind({ "directory.use": "", "directory.useAlt": "" });
  press("u", "KeyU", { ctrlKey: true, altKey: true }, input); expect(useFolder).toHaveBeenCalledOnce();
  await act(async () => { press("Enter", "Enter", {}, input); });
  expect(browse).toHaveBeenLastCalledWith("local", "/project/child");
});
it("refuses macOS menu keys for recording and hand-edited overrides but keeps every default usable", async () => {
  const { reservedCombo, recordCombo } = await import("./keyCombo");
  const { SHORTCUTS, effectiveSpec } = await import("./keybinds");
  for (const spec of ["cmd+q", "cmd+h", "cmd+alt+h", "cmd+m", "cmd+ctrl+f", "cmd+z", "cmd+shift+z", "cmd+x", "cmd+c", "cmd+v", "cmd+a"]) expect(reservedCombo(spec, true), spec).toBe(true);
  expect(reservedCombo("cmd+a", false)).toBe(false);
  expect(reservedCombo("cmd+shift+a", true)).toBe(false);
  expect(recordCombo(new KeyboardEvent("keydown", { key: "q", code: "KeyQ", metaKey: true })) !== null).toBe(true);
  await rebind({ "global.sidebar": "cmd+q" });
  expect(effectiveSpec(SHORTCUTS.find((s) => s.id === "global.sidebar")!, true)).toBeNull();
  await rebind({});
  for (const mac of [true, false]) for (const s of SHORTCUTS) { const spec = effectiveSpec(s, mac); if (spec) expect(reservedCombo(spec, mac), s.id).toBe(false); }
});
it("compiles native leader/resize metadata from the effective registry, not from a Rust key map", async () => {
  const { nativeShortcutBindings, nativeShortcutModes, LEADER_TIMEOUT_MS } = await import("./keybinds");
  const fixture = (await import("./nativeShortcutBindings.fixture.json")).default;
  for (const key of fixture.modeKeys) expect(nativeShortcutBindings(true)).toContainEqual(key);
  for (const mode of fixture.modes) expect(nativeShortcutModes(true)).toContainEqual(mode);
  expect(LEADER_TIMEOUT_MS).toBe(fixture.chordTimeoutMs);
  await rebind({ "leader.arm": "ctrl+alt+space", "leader.navigator": "y", "resize.left": "" });
  expect(nativeShortcutBindings(true)).toContainEqual(["leader.arm", "Space", null, 6]);
  expect(nativeShortcutBindings(true)).toContainEqual(["leader.navigator", "KeyY", "y", 0]);
  expect(nativeShortcutBindings(true).some(([id]) => id === "resize.left")).toBe(false);
  expect(nativeShortcutModes(true).some(([id]) => id === "resize.left")).toBe(false);
  await rebind({ "leader.arm": "" });
  // No prefix: follow-up keys are never native bindings that could steal page typing.
  expect(nativeShortcutBindings(true).some(([id]) => id.startsWith("leader.") || id.startsWith("resize."))).toBe(true);
  expect(nativeShortcutModes(true).find(([id]) => id === "leader.navigator")).toEqual(["leader.navigator", "leader", null, true]);
});
it("cancels modes on blur or settings changes and lets unmatched ordinary keys reach the terminal", async () => {
  await render();
  press(" ", "Space", { ctrlKey: true }); act(() => window.dispatchEvent(new Event("blur")));
  press("g", "KeyG"); expect(handlers.openNavigator).not.toHaveBeenCalled();
  press(" ", "Space", { ctrlKey: true }); await rebind({ "leader.navigator": "y" });
  press("y", "KeyY"); expect(handlers.openNavigator).not.toHaveBeenCalled();
  press(" ", "Space", { ctrlKey: true }); const other = press("a", "KeyA");
  expect(other.defaultPrevented).toBe(false); expect(terminalKeyHandler(other)).toBe(true);
});
