//! General settings, the stock screen `stock:settings-general`: the chat mode and agent warnings, the interface
//! toggle, the browser's search and history, and the default working directory. Settings > General shows it (the
//! phone keeps Perch's own); or the person's package chosen for it (`perch mod use stock:settings-general <id>`) with
//! the same props.
//!
//! The saved values and every write are Perch's (`actions`); the default folder being typed is kept by Perch under
//! `settings:general:defaultCwd` until Save, so swapping this page for a copy loses nothing. The rows are
//! `SettingsGroup` and `SettingRow` from `@perch/sdk`, which is what makes the Settings search find them.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-general` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { ModeSwitch, Select, SettingRow, SettingsGroup, settingsClass, Switch, type GeneralSettingsProps } from "@perch/sdk";
import { useDraft } from "./draft";

type Props = GeneralSettingsProps;

function ChatMode({ settings, isMobile, agentChoices, actions }: Props) {
  // Optimistic local mirror: the control flips on click, the saved value follows once it lands.
  const [chatMode, setChatMode] = useState<"ui" | "cli">(settings?.chatMode ?? "cli");
  useEffect(() => {
    if (!settings) return;
    setChatMode(settings.chatMode ?? "cli");
  }, [settings?.chatMode]);

  const handleChange = (mode: "ui" | "cli") => {
    setChatMode(mode);
    actions.updateSettings({ chatMode: mode });
  };

  return (
    <SettingsGroup title="Chat mode">
      <SettingRow title="UI / CLI" description="CLI shows each agent's terminal; UI shows the native chat over the same agent. Agents without a chat view always use the terminal.">
        <ModeSwitch mode={chatMode} onChange={handleChange} testId="settings-chat-mode" />
      </SettingRow>
      <SettingRow title="Warn before closing an agent" description="Ask first when closing a tab that runs an agent. Terminals close without asking.">
        <Switch label="Warn before closing an agent" testId="settings-warn-close-agent" checked={settings?.warnCloseAgent !== false} onChange={(on) => actions.updateSettings({ warnCloseAgent: on })} />
      </SettingRow>
      {!isMobile && <SettingRow title="Preview files in tabs" description="A single-clicked file opens in an italic preview tab that the next clicked file replaces. Edit or double-click it to keep it. Off opens every clicked file in its own tab.">
        <Switch label="Preview files in tabs" testId="settings-preview-tabs" checked={settings?.previewTabs !== false} onChange={(on) => actions.updateSettings({ previewTabs: on })} />
      </SettingRow>}
      <SettingRow title="Empty workspace opens" description="What clicking a workspace with no open tabs starts.">
        <Select
          className={settingsClass.select}
          testId="settings-empty-workspace-agent"
          ariaLabel="Empty workspace opens"
          value={settings?.emptyWorkspaceAgent ?? ""}
          onChange={(value) => actions.updateSettings({ emptyWorkspaceAgent: value })}
          options={[{ value: "", label: "Ask (show the picker)" }, ...agentChoices.map((choice) => ({ value: choice.id, label: choice.label }))]}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

function Interface({ paneLabels, isMobile, actions }: Props) {
  // Its only row labels a tab the phone doesn't have.
  if (isMobile) return null;
  return (
    <SettingsGroup title="Interface">
      <SettingRow title="Agent on the chat tab" description={'Show the active agent on the chat pane\'s tab (e.g. "Chat · claude").'}>
        <Switch label="Show the active agent on the chat pane's tab" testId="settings-pane-labels" checked={paneLabels} onChange={actions.setPaneLabels} />
      </SettingRow>
    </SettingsGroup>
  );
}

function Browser({ settings, searchEngines, actions }: Props) {
  return (
    <SettingsGroup title="Browser">
      <SettingRow title="Default search engine" description="Used for searches from the address bar in browser tabs and the drawer.">
        <Select
          className={settingsClass.select}
          testId="settings-browser-search-engine"
          ariaLabel="Default search engine"
          disabled={!settings}
          value={settings?.browserSearchEngine ?? "google"}
          onChange={(value) => actions.updateSettings({ browserSearchEngine: value })}
          options={searchEngines.map(({ id, label }) => ({ value: id, label }))}
        />
      </SettingRow>
      <SettingRow title="Search suggestions" description="Ask the search engine to complete what you type in the address bar. Off by default: everything you type, even if you never search, is sent to the engine. Addresses are never sent.">
        <Switch label="Search suggestions" testId="settings-browser-search-suggestions" checked={settings?.browserSearchSuggestions === true} onChange={(on) => actions.updateSettings({ browserSearchSuggestions: on })} />
      </SettingRow>
      <SettingRow title="Browsing history" description="Pages suggested in the address bar. Kept on this device only.">
        <button type="button" className={settingsClass.select} data-testid="settings-browser-clear-history" onClick={() => actions.clearBrowsingHistory()}>Clear history</button>
      </SettingRow>
    </SettingsGroup>
  );
}

function DefaultCwd({ settings, actions }: Props) {
  const [cwd, setCwd] = useDraft("settings:general:defaultCwd", settings?.defaultCwd ?? "");

  const handleSave = () => {
    const val = cwd.trim();
    setCwd(val);
    actions.updateSettings({ defaultCwd: val === "" ? null : val });
  };

  return (
    <SettingsGroup title="Default Working Directory">
      <div className="py-3">
      <div className={settingsClass.addRow}>
        <input
          type="text"
          className={settingsClass.inputWide}
          placeholder="/path/to/your/project"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
        />
        <button
          type="button"
          className={settingsClass.primary}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      <p className={settingsClass.muted}>
        Used as the cwd for new sessions. Leave empty to use the server process directory.
      </p>
      </div>
    </SettingsGroup>
  );
}

export default function GeneralSettings(props: Props) {
  return <><ChatMode {...props} /><Interface {...props} /><Browser {...props} /><DefaultCwd {...props} /></>;
}
