//! Terminal settings, the stock screen `stock:settings-terminal`: scrollback length, the login shell for plain terminal
//! panes, and how dropped paths are quoted. Settings > Terminal shows it (the phone keeps Perch's own); or the
//! person's package chosen for it (`perch mod use stock:settings-terminal <id>`) with the same props.
//!
//! Saving is Perch's (`actions.updateSettings`) and so is the range scrollback may take (`scrollback`): the box shows
//! exactly what is typed, but only a value in range is saved. The text being typed is kept by Perch under
//! `settings:terminal:scrollback`, so swapping this page for a copy loses nothing.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-terminal` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { SettingRow, SettingsGroup, settingsClass, Switch, type TerminalSettingsProps } from "@perch/sdk";
import { useDraft } from "./draft";

export default function TerminalSettings({ settings, scrollback: range, actions }: TerminalSettingsProps) {
  // Optimistic local mirrors: the control flips on click, then follows the saved value once it lands.
  const [scrollback, setScrollback] = useDraft("settings:terminal:scrollback", String(settings?.terminalScrollback ?? 10000));
  const [loginShell, setLoginShell] = useState(settings?.terminalLoginShell ?? false);
  const [doubleQuotes, setDoubleQuotes] = useState(settings?.droppedPathDoubleQuotes ?? false);

  useEffect(() => {
    if (!settings) return;
    setLoginShell(settings.terminalLoginShell ?? false);
    setDoubleQuotes(settings.droppedPathDoubleQuotes ?? false);
  }, [settings?.terminalLoginShell, settings?.droppedPathDoubleQuotes]);

  const handleScrollbackChange = (value: string) => {
    // The text box always shows exactly what was typed: clamping mid-keystroke would fight the user (typing "5000"
    // passes through "5", which would snap to the minimum and eat the rest of the input).
    setScrollback(value);
    // But only save a value that is in range. Writing every intermediate keystroke would store "5" on the way to
    // "5000", and the clamp lives at terminal-creation time, so the settings file would hold a number never honoured.
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= range.min && parsed <= range.max) {
      actions.updateSettings({ terminalScrollback: parsed });
    }
  };

  const handleLoginShellChange = (checked: boolean) => {
    setLoginShell(checked);
    actions.updateSettings({ terminalLoginShell: checked });
  };

  return (
    <SettingsGroup>
      <SettingRow title="Scrollback (lines)" description={`${range.min}–${range.max} lines; takes effect on newly-opened terminal panes.`}>
        <input
          type="number"
          className={settingsClass.inputPort}
          data-testid="settings-terminal-scrollback"
          min={range.min}
          max={range.max}
          value={scrollback}
          onChange={(e) => handleScrollbackChange(e.target.value)}
        />
      </SettingRow>
      <SettingRow title="Login shell" description="Spawn plain terminal panes as a login shell. Applies to plain terminal panes only, not CLI-mode agent panes, and only to newly-created terminals.">
        <Switch label="Spawn plain terminal panes as a login shell" testId="settings-terminal-login-shell" checked={loginShell} onChange={handleLoginShellChange} />
      </SettingRow>
      <SettingRow title="Wrap dropped paths in double quotes" description="Applies to file drops in agent and shell terminals. Off uses single quotes; both safely escape shell characters.">
        <Switch label="Wrap dropped paths in double quotes" testId="settings-dropped-path-double-quotes" checked={doubleQuotes} onChange={(on) => { setDoubleQuotes(on); actions.updateSettings({ droppedPathDoubleQuotes: on }); }} />
      </SettingRow>
      <SettingRow title="Remote file drops" description="Hold Option (Mac) or Alt while dropping onto a remote terminal to upload via SCP to a private staging folder. Up to 1 GiB per file on direct connections; 64 MiB through the phone relay. Dropping never presses Enter." />
    </SettingsGroup>
  );
}
