// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SDK_VERSION, sdkSatisfies } from "./mod-runtime";
import { sdkSurface } from "./sdk";

describe("@perch/sdk", () => {
  // The public surface is versioned: adding or removing an export means changing this list and SDK_VERSION together
  // (a removal or an incompatible change is a new major), and docs/MOD-SDK.md with them.
  it("exports exactly the 1.10 surface", async () => {
    expect(SDK_VERSION).toBe("1.10.2");
    expect(Object.keys(sdkSurface()).sort()).toEqual([
      "AgentIcon", "BrowserPage", "Chevron", "CloseIcon", "CodeEditor", "ConfirmDialog", "CopyButton", "Dialog",
      "EllipsisIcon", "FileAsset", "FileEntryMenu", "FileIcon", "FolderBrowser", "GearIcon", "GitMarker", "HostStateDot", "InstructionsDialog",
      "Layout", "Markdown", "MarkdownPreview", "MemoryDialog", "ModeSwitch", "NewFilePrompt", "NewSessionMenu",
      "PageIcon", "PlusIcon", "QrCode", "Select", "SessionDot", "SessionMenu", "SettingRow", "SettingsGroup", "SlashPopover", "Slot", "Switch",
      "TabDragLayer", "TabMenu", "WorktreeMenu", "agentStateColor", "anchoredPopoverStyle", "assetKind", "assetUrl",
      "beginReorderDrag", "beginTabDrag", "buttonClass", "cn", "fetchTerminal", "focus", "ghostButton", "glassClass", "iconButton",
      "isMac", "keyLabel", "layoutTree", "menuDividerClass", "menuItemClass", "menuPanel", "nestSessions", "newId",
      "openBrowserTab", "openFileTab", "pickFolder", "readTerminal", "redeemUsageReset", "refreshUsage", "resetZoom",
      "rowActionClass", "runCommand", "segmentClass", "sendToTerminal", "settingsClass", "shortcutFor",
      "shortcutLabel", "startSession", "tabStateClass", "tapButtonClass", "terminals", "useAddProject", "useAddProjectRequest",
      "useAgentChoices", "useBrowserPages", "useDismissOnOutsideClick", "useGitReview", "useHosts", "useInstance",
      "useInstanceState", "useKeybindings", "useModData", "useNativeChat", "useNavigation", "useNewTabRequest",
      "useNotifications", "usePaneLook", "usePlanUsage", "useResourceState", "useSessionFolders", "useSettingsQuery",
      "useStatusLine", "useTerminals", "useWorkspaceFiles", "useWorkspaceTabs", "useZoom", "version",
    ]);
    // The same objects by name (what Perch's own code imports as `@perch/sdk`), and nothing more.
    const sdk = sdkSurface();
    const named = { ...(await import("./sdk")) } as Record<string, unknown>;
    delete named.sdkSurface;
    expect(Object.keys(named).sort()).toEqual(Object.keys(sdk).sort());
    for (const [name, value] of Object.entries(sdk)) expect(named[name], name).toBe(value);
    // A package's own `@perch/sdk` binds `assetUrl` to it; the shared one has no package to name a file of.
    expect(() => sdk.assetUrl("a.png")).toThrow(/only in a package's own modules/);
    expect(sdk.version).toBe(SDK_VERSION);
  });

  it("useTerminals draws again when a pin or this device's order changes, so a copy can group and order by them", async () => {
    const { act, createElement } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { usePerchStore } = await import("./store");
    const { runCommand, useTerminals } = await import("./sdk");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const before = usePerchStore.getState().sessions;
    usePerchStore.setState({ sessions: [
      { id: "s1", title: "One", cwd: "/p", cliProviderId: "terminal" },
      { id: "s2", title: "Two", cwd: "/p", cliProviderId: "terminal" },
    ] as never });
    const seen: string[] = [];
    function Pinned() {
      const records = useTerminals();
      const text = records.filter((record) => record.pinned).map((record) => record.sessionId).join(",") + "|" + records.map((record) => record.order).join(",");
      seen.push(text);
      return createElement("span", null, text);
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(Pinned)));
      expect(host.textContent).toBe("|,");
      await act(async () => runCommand("terminal.pin", { terminal: "s2", pinned: true }));
      expect(host.textContent).toBe("s2|,");
      await act(async () => runCommand("terminal.order", { ids: ["s2", "s1"] }));
      expect(host.textContent).toBe("s2|1,0");
    } finally {
      await act(async () => runCommand("terminal.pin", { terminal: "s2", pinned: false }));
      await act(async () => runCommand("terminal.order", { ids: [] }));
      await act(async () => root.unmount());
      usePerchStore.setState({ sessions: before });
    }
  });

  it("reads a package's api range against the page's version", () => {
    const yes: [string, string][] = [["^1", "1.0.0"], ["^1.2", "1.3.0"], ["^1.2.3", "1.2.3"], ["~1.2", "1.2.9"], ["1", "1.4.0"], ["1.x", "1.0.0"], ["1.2.3", "1.2.3"], ["*", "2.0.0"], ["", "1.0.0"]];
    const no: [string, string][] = [["^2", "1.0.0"], ["^1.2", "1.1.9"], ["~1.2", "1.3.0"], ["1.2.3", "1.2.4"], [">=1", "1.0.0"], ["latest", "1.0.0"], ["^0", "1.0.0"]];
    for (const [range, version] of yes) expect(sdkSatisfies(range, version), `${range} ${version}`).toBe(true);
    for (const [range, version] of no) expect(sdkSatisfies(range, version), `${range} ${version}`).toBe(false);
  });
});
