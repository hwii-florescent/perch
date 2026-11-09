// @vitest-environment jsdom
// The Settings pages that are screens (`stock:settings-*`), as Perch binds them: a copy chosen with `perch mod use`
// gets the page's props and its actions reach Perch; text typed and not yet saved survives leaving the page and
// swapping stock for a copy; the Keyboard page lists package commands with the reason one has no key; and a phone
// keeps Perch's own page whatever was chosen.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModInfo } from "@perch/shared";

const h = vi.hoisted(() => ({
  mods: null as { mods: ModInfo[]; uses?: Record<string, string> } | null,
  views: new Map<string, unknown>(),
  sent: [] as Record<string, any>[],
  mobile: false,
}));
vi.mock("../ws", () => ({ socket: { send: (message: Record<string, any>) => void h.sent.push(message), connect: vi.fn(), onMessage: vi.fn(() => () => {}), onConnectionChange: vi.fn(() => () => {}) } }));
vi.mock("./AgentPicker", () => ({ useAgentChoices: () => ({ choices: [] }) }));
vi.mock("../mods", async (actual) => ({ ...(await actual<typeof import("../mods")>()), currentMods: () => h.mods, subscribeMods: () => () => {}, reportMod: () => {} }));
vi.mock("../modApp", async (actual) => ({ ...(await actual<typeof import("../modApp")>()), modApi: () => ({ dispose: () => [] }) }));
vi.mock("../mod-runtime", async (actual) => ({
  ...(await actual<typeof import("../mod-runtime")>()),
  importPackage: async (_id: string, revision: string) => ({ default: h.views.get(revision) }),
}));
const { usePerchStore } = await import("../store");
const { useResourceState } = await import("@perch/sdk");
const { resetResourceStateForTest } = await import("../resourceState");
const { SHORTCUTS, effectiveSpec, registerCommand } = await import("../keybinds");
const { GeneralSettings, HostsSettings } = await import("./settingsRoutes");
const { KeybindingsSection } = await import("./KeybindingsSection");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const copy = (id: string, revision: string): ModInfo => ({ id, name: id, description: "", place: "layout", enabled: true, revision, error: null, format: "esm", files: [] });
const choose = (stock: string, id: string, revision = `${id}-r1`) => { h.mods = { mods: [copy(id, revision)], uses: { [`stock:${stock}`]: id } }; };
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0)); });
const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const type = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

let root: Root;
let host: HTMLDivElement;
const updateSettings = vi.fn();
const upsertHost = vi.fn();
const deleteHost = vi.fn();
const mount = (node: React.ReactNode) => { root = createRoot(host); act(() => root.render(node)); };
beforeEach(() => {
  h.mods = null; h.views.clear(); h.sent.length = 0; h.mobile = false;
  resetResourceStateForTest();
  vi.clearAllMocks();
  window.matchMedia = (() => ({ matches: h.mobile, addEventListener() {}, removeEventListener() {} })) as never;
  usePerchStore.setState({
    settings: { theme: "perch", defaultCwd: "/work" } as never, updateSettings, upsertHost, deleteHost,
    hosts: [{ id: "h1", name: "devpod", sshHost: "dev", remotePort: 7788, enabled: true, mode: "direct" }], hostStates: {},
    activeHostId: "local", fetchHarnessModels: vi.fn(),
  });
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("a copy chosen for a Settings page", () => {
  it("gets the page's data, and its actions do Perch's own saving, adding and deleting", async () => {
    let seen: any;
    h.views.set("my-hosts-r1", (props: unknown) => { seen = props; return <p data-testid="copy-hosts">copy</p>; });
    choose("settings-hosts", "my-hosts");
    mount(<HostsSettings />);
    await settle();
    expect(byId("copy-hosts")).not.toBeNull();
    expect(byId("host-add")).toBeNull(); // Perch's own page is not drawn beside it
    expect(seen.hosts).toEqual([expect.objectContaining({ id: "h1", name: "devpod" })]);
    expect(seen.machine).toMatchObject({ sshConfigHosts: [], pending: null, result: null });

    expect(seen.actions.addHost({ name: "  ", sshHost: "x", port: "22", mode: "direct", directUrl: "", remoteCmd: "" })).toBe(false);
    expect(upsertHost).not.toHaveBeenCalled();
    expect(seen.actions.addHost({ name: " box ", sshHost: " b ", port: "nope", mode: "perch", directUrl: " ws://x ", remoteCmd: "" })).toBe(true);
    expect(upsertHost).toHaveBeenCalledWith({ id: expect.any(String), name: "box", sshHost: "b", remotePort: 7788, enabled: true, mode: "perch", directUrl: "ws://x" });
    seen.actions.deleteHost("h1");
    expect(deleteHost).toHaveBeenCalledWith("h1");
    act(() => seen.actions.checkMachine(" box "));
    expect(h.sent.at(-1)).toMatchObject({ type: "machine.probe", sshHost: "box" });
  });

  it("saves settings through Perch, and leaves the page's own rows to the page", async () => {
    let seen: any;
    h.views.set("my-general-r1", (props: unknown) => { seen = props; return <p data-testid="copy-general">copy</p>; });
    choose("settings-general", "my-general");
    mount(<GeneralSettings />);
    await settle();
    expect(byId("copy-general")).not.toBeNull();
    expect(seen.settings).toMatchObject({ defaultCwd: "/work" });
    expect(seen.isMobile).toBe(false);
    expect(seen.searchEngines.map((engine: { id: string }) => engine.id)).toEqual(["google", "duckduckgo", "bing", "brave"]);
    seen.actions.updateSettings({ chatMode: "ui" });
    expect(updateSettings).toHaveBeenCalledWith({ chatMode: "ui" });
  });

  it("keeps Perch's own page on a phone, whatever was chosen", async () => {
    h.views.set("my-general-r1", () => <p data-testid="copy-general">copy</p>);
    choose("settings-general", "my-general");
    h.mobile = true;
    mount(<GeneralSettings />);
    await settle();
    expect(byId("copy-general")).toBeNull();
    expect(byId("settings-chat-mode")).not.toBeNull();
    // The same choice on a desktop-width window is used.
    act(() => root.unmount());
    h.mobile = false;
    root = createRoot(host);
    act(() => root.render(<GeneralSettings />));
    await settle();
    expect(byId("copy-general")).not.toBeNull();
    expect(byId("settings-chat-mode")).toBeNull();
  });
});

describe("text typed and not yet saved", () => {
  it("stays in the new-host form when the page is left and shown again, and is added only on Add", async () => {
    mount(<HostsSettings />);
    await type(byId("host-name-input") as HTMLInputElement, "box");
    await type(byId("host-ssh-input") as HTMLInputElement, "dev.example");
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<HostsSettings />));
    expect((byId("host-name-input") as HTMLInputElement).value).toBe("box");
    expect((byId("host-ssh-input") as HTMLInputElement).value).toBe("dev.example");
    expect(upsertHost).not.toHaveBeenCalled();
    act(() => byId("host-add")!.click());
    expect(upsertHost).toHaveBeenCalledTimes(1);
    expect(upsertHost).toHaveBeenCalledWith(expect.objectContaining({ name: "box", sshHost: "dev.example", mode: "direct" }));
    expect((byId("host-name-input") as HTMLInputElement).value).toBe("");
  });

  it("is shown by a copy that swaps in for the stock page, which reads the same Perch-kept value", async () => {
    mount(<HostsSettings />);
    await type(byId("host-name-input") as HTMLInputElement, "box");
    h.views.set("my-hosts-r1", function Copy() {
      const [name] = useResourceState("settings:hosts:newName", "");
      return <p data-testid="copy-name">{name}</p>;
    });
    choose("settings-hosts", "my-hosts");
    act(() => root.render(<HostsSettings />));
    await settle();
    expect(byId("copy-name")?.textContent).toBe("box");
    expect(byId("host-name-input")).toBeNull();
  });

  it("keeps the default folder being typed until Save, and saves it trimmed (empty clears it)", async () => {
    mount(<GeneralSettings />);
    const field = () => document.querySelector<HTMLInputElement>('input[placeholder="/path/to/your/project"]')!;
    expect(field().value).toBe("/work");
    await type(field(), "  /elsewhere ");
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<GeneralSettings />));
    expect(field().value).toBe("  /elsewhere ");
    expect(updateSettings).not.toHaveBeenCalled();
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Save")!.click());
    expect(updateSettings).toHaveBeenCalledWith({ defaultCwd: "/elsewhere" });
    await type(field(), "");
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Save")!.click());
    expect(updateSettings).toHaveBeenLastCalledWith({ defaultCwd: null });
  });
});

describe("Settings > Keyboard lists package commands", () => {
  it("shows a command under Package commands with why it has no key, and drops it when the package lets it go", async () => {
    const taken = effectiveSpec(SHORTCUTS.find((shortcut) => shortcut.id === "global.sidebar")!)!;
    mount(<KeybindingsSection />);
    expect(byId("keybindings-mods")).toBeNull();
    let remove = () => {};
    act(() => { remove = registerCommand("mod.demo.run", "Run the demo", taken, () => {}); });
    expect(byId("keybindings-mods")?.textContent).toContain("Package commands");
    expect(byId("keybindings-mods")?.textContent).toContain("Run the demo");
    expect(byId("keybinding-mod.demo.run")?.textContent).toBe("Not set");
    expect(byId("keybinding-conflict-mod.demo.run")?.textContent).toContain('is taken by "Toggle sidebar"');
    // The person can still give it a key of their own, recorded on its row (it has no default key to compare with).
    act(() => byId("keybinding-mod.demo.run")!.click());
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "9", code: "Digit9", ctrlKey: true, shiftKey: true, bubbles: true })); });
    expect(updateSettings).toHaveBeenLastCalledWith({ keybindings: { "mod.demo.run": "ctrl+shift+9" } });
    // The reason goes away with the key it explained.
    act(() => usePerchStore.setState({ settings: { theme: "perch", keybindings: { "mod.demo.run": "ctrl+shift+9" } } as never }));
    expect(byId("keybinding-mod.demo.run")?.textContent).not.toBe("Not set");
    expect(byId("keybinding-conflict-mod.demo.run")).toBeNull();
    expect(byId("keybinding-reset-mod.demo.run")!.className).not.toContain("invisible");
    act(() => remove());
    expect(byId("keybindings-mods")).toBeNull();
  });

  it("keeps the other groups and their row test ids", () => {
    mount(<KeybindingsSection />);
    expect(byId("keybindings-global")).not.toBeNull();
    expect(byId("keybinding-global.sidebar")).not.toBeNull();
    expect(byId("keybinding-clear-global.sidebar")).not.toBeNull();
    expect(byId("keybindings-reset-all")).not.toBeNull();
  });
});
