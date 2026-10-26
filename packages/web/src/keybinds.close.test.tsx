// @vitest-environment jsdom
/** Exercise the mounted key listener and native menu capture, not Shortcut.run: menu accelerators
 * consume the key before the document sees it, including normal tabs and blank browser tabs. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), paneClose: vi.fn(), watching: vi.fn(), forget: vi.fn(), mac: true, native: true }));
vi.mock("./links", async (original) => ({ ...await original<typeof import("./links")>(), tauriInvoke: mocks.invoke }));
vi.mock("./browserNative", async (original) => ({ ...await original<typeof import("./browserNative")>(), get nativeBrowser() { return mocks.native; } }));
vi.mock("./keyCombo", async (original) => ({ ...await original<typeof import("./keyCombo")>(), get IS_MAC() { return mocks.mac; } }));
vi.mock("./tiledPanes", () => ({ getPaneController: () => ({ closeActiveTerminalPanel: mocks.paneClose }), splitActiveTab: vi.fn() }));
vi.mock("./agentTerminals", () => ({ isWatchingAgent: mocks.watching }));
vi.mock("./terminalKeeper", () => ({ forgetSessionTerminals: mocks.forget }));

const { CLOSE_TAB_EVENT, NATIVE_COMMAND_EVENT, SHORTCUTS, nativeShortcutBindings, useLeaderKey } = await import("./keybinds");
const { usePerchStore } = await import("./store");
const { useCloseGuard } = await import("./closeGuard");
const { useFileTabs, fileTabKey } = await import("./fileTabs");
const { useDrawerBrowsers, drawerPageKey } = await import("./drawerBrowsers");
const { browserId } = await import("./browserNative");
const { default: nativeFixture } = await import("./nativeShortcutBindings.fixture.json");
const { KeybindingsSection } = await import("./components/KeybindingsSection");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const handlers = { openNavigator: vi.fn(), openKeybindHelp: vi.fn(), toggleDrawer: vi.fn() };
function Keys() { useLeaderKey(handlers); return null; }
const settings = (keybindings: Record<string, string>) => ({ keybindings, warnCloseAgent: true }) as never;
const session = (provider = "terminal") => ({ id: "session", workspaceId: "w", hostId: "local", cliProviderId: provider, status: "idle", createdAt: 1 }) as never;
const currentConfig = () => mocks.invoke.mock.calls.filter(([command]) => command === "browser_shortcuts").at(-1)?.[1] ?? { accelerator: "Super+KeyW", generation: 1, epoch: crypto.randomUUID() };
const menu = (id = "", config = currentConfig()) => act(() => window.dispatchEvent(new CustomEvent(CLOSE_TAB_EVENT, { detail: { id, ...config } })));
const nativeCommand = (command: string, id: string, config = currentConfig(), focused = true) => act(() => {
  const index = config.bindings.findIndex((binding: [string]) => binding[0] === command);
  window.dispatchEvent(new CustomEvent(NATIVE_COMMAND_EVENT, { detail: { index, id, epoch: config.epoch, generation: config.generation, focused } }));
});
const key = (key = "w", init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}`, metaKey: true, bubbles: true, cancelable: true, ...init });
  act(() => (document.activeElement ?? document).dispatchEvent(event));
  return event;
};
async function mount() { await act(async () => root.render(<Keys />)); }
async function rebind(keybindings: Record<string, string>) { await act(async () => usePerchStore.setState({ settings: settings(keybindings) })); }
function file(kind?: "review" | "browser", path = "a.ts") {
  const tab = { workspaceId: "w", path, ...(kind ? { kind } : {}) };
  useFileTabs.setState({ tabs: [tab, { workspaceId: "w", path: "keep.ts" }], active: fileTabKey(tab) });
  return tab;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mac = true;
  mocks.native = true;
  mocks.invoke.mockResolvedValue(null);
  mocks.paneClose.mockReturnValue(false);
  mocks.watching.mockReturnValue(false);
  usePerchStore.setState({ settings: settings({}), settingsOpen: false, sessionId: "session", sessions: [session()], activeWorkspaceId: "w", workspaces: [{ id: "w", hostId: "local", path: "/tmp" }] as never, deleteSession: vi.fn(), showWorkspaceHome: vi.fn() });
  useFileTabs.setState({ tabs: [], active: null });
  useDrawerBrowsers.setState({ pages: [], active: {} });
  useCloseGuard.setState({ pending: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("native capture preserves the existing close contract", () => {
  it.each([
    ["file", undefined, "a.ts"], ["review", "review", ""],
    ["blank browser", "browser", "blank:1"], ["loaded browser toolbar", "browser", "https://example.com/"],
  ] as const)("closes the main view's %s without needing a DOM keydown", async (_name, kind, path) => {
    file(kind, path);
    await mount();
    menu(); // native menu consumes the key: no DOM event is delivered
    expect(useFileTabs.getState().tabs.map((tab) => tab.path)).toEqual(["keep.ts"]);
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
  });

  it("closes a normal terminal through the existing session close path", async () => {
    await mount();
    menu();
    expect(usePerchStore.getState().deleteSession).toHaveBeenCalledExactlyOnceWith("session");
  });

  it("keeps agent confirmation and watcher dismissal semantics", async () => {
    usePerchStore.setState({ sessions: [session("claude")] });
    await mount();
    menu();
    expect(useCloseGuard.getState().pending?.id).toBe("session");
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
    mocks.watching.mockReturnValue(true);
    useCloseGuard.setState({ pending: null });
    menu();
    expect(mocks.forget).toHaveBeenCalledWith("session");
    expect(usePerchStore.getState().showWorkspaceHome).toHaveBeenCalledOnce();
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
    expect(useCloseGuard.getState().pending).toBeNull();
  });

  it("uses the focused split's close path before closing the session", async () => {
    mocks.paneClose.mockReturnValue(true);
    await mount();
    menu();
    expect(mocks.paneClose).toHaveBeenCalledOnce();
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
  });

  it("closes the named page, not a different active tab, and ignores stale or malformed targets", async () => {
    const tab = file("browser", "https://example.com/");
    useFileTabs.setState({ active: fileTabKey({ workspaceId: "w", path: "keep.ts" }) });
    useDrawerBrowsers.setState({ pages: [{ id: "page", workspaceId: "w", url: "https://example.org/" }] });
    await mount();
    menu("missing");
    act(() => window.dispatchEvent(new CustomEvent(CLOSE_TAB_EVENT, { detail: 42 })));
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    menu(browserId(fileTabKey(tab)));
    expect(useFileTabs.getState().tabs.map((t) => t.path)).toEqual(["keep.ts"]);
    menu(browserId(drawerPageKey("page")));
    expect(useDrawerBrowsers.getState().pages).toHaveLength(0);
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
  });

  it.each(["", "https://example.org/"])("closes a drawer address field for page %j, never the central tab", async (url) => {
    file();
    useDrawerBrowsers.setState({ pages: [{ id: "page", workspaceId: "w", url }] });
    await mount();
    const wrapper = document.createElement("div");
    wrapper.dataset.browserId = browserId(drawerPageKey("page"));
    const input = document.createElement("input");
    wrapper.append(input);
    host.append(wrapper);
    input.focus();
    menu();
    expect(useDrawerBrowsers.getState().pages).toHaveLength(0);
    expect(useFileTabs.getState().tabs).toHaveLength(2);
  });
});

describe("native pages share every global command", () => {
  it.each(SHORTCUTS.filter((s) => s.scope !== "terminal" && s.id !== "tabs.close").map((s) => [s.id]))("dispatches %s through the same registry action", async (id) => {
    const tab = file("browser", "https://example.com/");
    await mount();
    const shortcut = SHORTCUTS.find((s) => s.id === id)!;
    const run = vi.spyOn(shortcut, "run").mockImplementation(() => {});
    try {
      nativeCommand(id!, browserId(fileTabKey(tab)));
      expect(run).toHaveBeenCalledExactlyOnceWith(handlers);
    } finally { run.mockRestore(); }
  });

  it("the universal browser bridge closes its exact owner through the existing close guard", async () => {
    const tab = file("browser", "https://example.com/");
    useFileTabs.setState({ active: fileTabKey({ workspaceId: "w", path: "keep.ts" }) });
    await mount();
    nativeCommand("tabs.close", browserId(fileTabKey(tab)));
    expect(useFileTabs.getState().tabs.map((t) => t.path)).toEqual(["keep.ts"]);
    expect(usePerchStore.getState().deleteSession).not.toHaveBeenCalled();
  });

  it("the native probe fixture is produced by the effective Settings keymap", async () => {
    await mount();
    for (const binding of nativeFixture.global) expect(nativeShortcutBindings(true)).toContainEqual(binding);
    for (const [accelerator, binding] of Object.entries(nativeFixture.close)) {
      const spec = accelerator.toLowerCase().replace("super", "cmd").replace("control", "ctrl").replace("key", "");
      await rebind({ "tabs.close": spec });
      expect(nativeShortcutBindings(true)).toContainEqual(binding);
    }
  });

  it("tab jumps and consecutive cycles advance from the latest selection, not the source browser", async () => {
    const tab = file("browser", "https://example.com/");
    await mount();
    nativeCommand("tabs.jump1", browserId(fileTabKey(tab)));
    expect(useFileTabs.getState().active).toBeNull();
    nativeCommand("tabs.next", browserId(fileTabKey(tab)), currentConfig(), false);
    expect(useFileTabs.getState().active).toBe(fileTabKey(tab));
    nativeCommand("tabs.next", browserId(fileTabKey(tab)), currentConfig(), false);
    expect(useFileTabs.getState().active).toBe(fileTabKey({ workspaceId: "w", path: "keep.ts" }));
  });

  it("compiles the full effective keymap, including shifted digits, and no terminal-only keys", async () => {
    await mount();
    expect(currentConfig().bindings).toEqual(nativeShortcutBindings(true));
    expect(currentConfig().bindings).toContainEqual(["tabs.jump1", "Digit1", null, 1]);
    expect(currentConfig().bindings).toContainEqual(["nests.jump1", "Digit1", null, 10]);
    expect(currentConfig().bindings.some(([id]: [string]) => id.startsWith("terminal."))).toBe(false);
    await rebind({ "tabs.jump1": "ctrl+alt+f8", "nests.jump1": "" });
    expect(currentConfig().bindings).toContainEqual(["tabs.jump1", "F8", null, 6]);
    expect(currentConfig().bindings.some(([id]: [string]) => id === "nests.jump1")).toBe(false);
  });

  it("rejects stale/foreign events and unknown pages for every command, not just Close Tab", async () => {
    const tab = file("browser", "https://example.com/");
    await mount();
    const before = currentConfig();
    await rebind({ "global.navigator": "cmd+j" });
    nativeCommand("global.navigator", browserId(fileTabKey(tab)), before);
    nativeCommand("global.navigator", browserId(fileTabKey(tab)), { ...currentConfig(), epoch: crypto.randomUUID() });
    nativeCommand("global.navigator", "missing");
    expect(handlers.openNavigator).not.toHaveBeenCalled();
    nativeCommand("global.navigator", browserId(fileTabKey(tab)));
    expect(handlers.openNavigator).toHaveBeenCalledOnce();
  });
});

describe("configured shortcut ownership", () => {
  it("installs the table's default and updates the native binding on settings changes", async () => {
    file();
    await mount();
    expect(currentConfig()).toMatchObject({ accelerator: "Super+KeyW" });
    const original = currentConfig();
    await rebind({ "tabs.close": "cmd+shift+j" });
    expect(currentConfig()).toMatchObject({ accelerator: "Super+Shift+KeyJ" });
    menu("", original); // late event from the old key
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("ignores stale A→B→A events and removes the accelerator for disabled or invalid bindings", async () => {
    file();
    await mount();
    const original = currentConfig();
    await rebind({ "tabs.close": "cmd+j" });
    await rebind({});
    menu("", original);
    menu("", { ...currentConfig(), epoch: crypto.randomUUID() }); // an old document after reload
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    for (const spec of ["", "invalid+binding"]) {
      const before = currentConfig();
      await rebind({ "tabs.close": spec });
      expect(currentConfig()).toMatchObject({ accelerator: null });
      menu("", before);
      key();
      expect(useFileTabs.getState().tabs).toHaveLength(2);
    }
  });

  it("frees the old default for a different configured action", async () => {
    file();
    await mount();
    await rebind({ "tabs.close": "ctrl+shift+j", "global.navigator": "cmd+w" });
    expect(currentConfig()).toMatchObject({ accelerator: "Control+Shift+KeyJ" });
    key();
    expect(handlers.openNavigator).toHaveBeenCalledOnce();
    const rebound = key("j", { metaKey: false, ctrlKey: true, shiftKey: true });
    expect(rebound.defaultPrevented).toBe(false); // native, not a second DOM close
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("serializes in-flight setting changes and accepts only the final generation", async () => {
    let release!: () => void;
    mocks.invoke.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    file();
    await mount();
    const first = currentConfig();
    await rebind({ "tabs.close": "cmd+j" });
    await rebind({ "tabs.close": "cmd+shift+k" });
    expect(mocks.invoke).toHaveBeenCalledOnce();
    await act(async () => release());
    expect(mocks.invoke.mock.calls.map(([, args]) => args.accelerator)).toEqual(["Super+KeyW", "Super+KeyJ", "Super+Shift+KeyK"]);
    menu("", first);
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("handles a configured native key only once if the DOM also receives it", async () => {
    file();
    await mount();
    key();
    expect(useFileTabs.getState().tabs).toHaveLength(2); // native owns this key
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("respects main-view composition and an armed leader instead of closing underneath them", async () => {
    file();
    await mount();
    act(() => window.dispatchEvent(new Event("compositionstart")));
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    act(() => window.dispatchEvent(new Event("compositionend")));
    key(" ", { code: "Space", ctrlKey: true, metaKey: false });
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    key("Escape", { code: "Escape", metaKey: false });
    menu();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it("lets Settings record the current native shortcut without closing a tab", async () => {
    file();
    usePerchStore.setState({ settingsOpen: true, updateSettings: vi.fn(async (patch) => {
      usePerchStore.setState({ settings: { ...usePerchStore.getState().settings!, ...patch } });
    }) });
    await act(async () => root.render(<><Keys /><KeybindingsSection /></>));
    expect(currentConfig()).toMatchObject({ accelerator: null });
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="keybinding-global.navigator"]')!.click());
    await act(async () => { key(); });
    expect(useFileTabs.getState().tabs).toHaveLength(2);
    expect(usePerchStore.getState().settings?.keybindings?.["tabs.close"]).toBe("");
    expect(usePerchStore.getState().settings?.keybindings?.["global.navigator"]).toBe("cmd+w");
  });

  it("restores native ownership when Settings closes", async () => {
    await mount();
    const before = currentConfig();
    await act(async () => usePerchStore.setState({ settingsOpen: true }));
    expect(currentConfig()).toMatchObject({ accelerator: null });
    menu("", before); // queued before Settings opened
    await act(async () => usePerchStore.setState({ settingsOpen: false }));
    expect(currentConfig()).toMatchObject({ accelerator: "Super+KeyW" });
    expect(currentConfig().generation).not.toBe(before.generation);
  });

  it("falls back to DOM handling if native configuration fails", async () => {
    mocks.invoke.mockRejectedValue(new Error("unavailable"));
    file();
    await mount();
    key();
    expect(useFileTabs.getState().tabs).toHaveLength(1);
  });

  it.each([[true, false], [false, true]])("preserves DOM shortcuts outside macOS desktop (mac=%s native=%s)", async (mac, native) => {
    mocks.mac = mac;
    mocks.native = native;
    file("browser", "blank:1");
    await mount();
    key("w", { metaKey: mac, ctrlKey: !mac, shiftKey: !mac });
    expect(useFileTabs.getState().tabs).toHaveLength(1);
    expect(mocks.invoke.mock.calls.some(([command]) => command === "browser_shortcuts")).toBe(false);
  });

  it("keeps other default shortcuts and terminal Ctrl keys unchanged", async () => {
    file();
    await mount();
    key("p");
    expect(handlers.openNavigator).toHaveBeenCalledOnce();
    const ctrlW = key("w", { metaKey: false, ctrlKey: true });
    expect(ctrlW.defaultPrevented).toBe(false);
    expect(useFileTabs.getState().tabs).toHaveLength(2);
  });

  it("starts a fresh epoch after a document reload and rejects old-document events", async () => {
    await mount();
    const previous = currentConfig();
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.resetModules();
    const { useLeaderKey: reloadedKeys } = await import("./keybinds");
    const { usePerchStore: reloadedStore } = await import("./store");
    const { useFileTabs: reloadedFiles, fileTabKey: reloadedKey } = await import("./fileTabs");
    reloadedStore.setState({ settings: settings({}), settingsOpen: false });
    const tab = { workspaceId: "w", path: "a.ts" };
    reloadedFiles.setState({ tabs: [tab, { ...tab, path: "keep.ts" }], active: reloadedKey(tab) });
    function Reloaded() { reloadedKeys(handlers); return null; }
    await act(async () => root.render(<Reloaded />));
    expect(currentConfig().epoch).not.toBe(previous.epoch);
    expect(currentConfig().generation).toBe(1);
    menu("", { ...currentConfig(), epoch: previous.epoch });
    expect(reloadedFiles.getState().tabs).toHaveLength(2);
    menu();
    expect(reloadedFiles.getState().tabs).toHaveLength(1);
  });
});
